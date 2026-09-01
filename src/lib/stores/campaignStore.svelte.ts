import { initialCampaign } from '../data/sampleCampaign';
import type {
  CampaignData,
  ThreatClock,
  LoreEntry,
  TimelineMarker,
  EntityNodeData,
  CanvasRelationEdgeData,
  CanvasRelationEdge,
  RelationType,
} from '../types';
import type { Node, Edge } from '@xyflow/svelte';
import { writable, get } from 'svelte/store';
import { storageService, autoSaveEngine } from '../services/storage';

class CampaignStore {
  // Active Campaign Reactive State
  campaign = $state<CampaignData>(initialCampaign);
  nodes = writable<Node<EntityNodeData>[]>(initialCampaign.nodes);
  edges = writable<Edge<CanvasRelationEdgeData>[]>(initialCampaign.edges as Edge<CanvasRelationEdgeData>[]);
  
  // Search & Selection State
  searchQuery = $state<string>('');
  selectedEntity = $state<EntityNodeData | null>(null);
  activeEdgeFilter = $state<RelationType | 'all'>('all');

  // Node & Edge Editing Modal State
  editingNode = $state<EntityNodeData | null>(null);
  editingEdge = $state<CanvasRelationEdge | null>(null);

  // Persistence & Autosave Reactive State
  isDirty = $state<boolean>(false);
  isSaving = $state<boolean>(false);
  lastSavedAt = $state<number | null>(null);

  // Undo / Redo History Stack (Ctrl+Z / Ctrl+Y)
  undoStack = $state<string[]>([]);
  redoStack = $state<string[]>([]);
  private isRestoringHistory = false;
  private maxHistorySize = 50;

  canUndo = $derived(this.undoStack.length > 0);
  canRedo = $derived(this.redoStack.length > 0);

  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveIntervalMs = 500;
  private isInitialized = false;

  constructor() {
    this.initLifecycleHooks();
  }

  private initLifecycleHooks() {
    if (typeof window !== 'undefined' && !this.isInitialized) {
      this.isInitialized = true;
      try {
        const savedCampaign = localStorage.getItem('mural_active_campaign');
        if (savedCampaign) {
          const parsed = JSON.parse(savedCampaign);
          if (parsed && parsed.name) {
            this.loadCampaign(parsed);
          }
        } else {
          const savedSettings = localStorage.getItem('mural_global_settings');
          if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            this.campaign.settings = { ...this.campaign.settings, ...parsedSettings };
          }
        }
      } catch (e) {
        console.warn('Failed to load saved campaign from localStorage:', e);
      }

      window.addEventListener('beforeunload', () => {
        if (this.isDirty) {
          this.flushSync();
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // History & Undo / Redo (Ctrl+Z / Ctrl+Y)
  // ---------------------------------------------------------------------------

  recordSnapshot() {
    if (this.isRestoringHistory) return;
    try {
      const snapshot = JSON.stringify(this.exportCurrentCampaign());
      if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snapshot) {
        return;
      }
      this.undoStack = [...this.undoStack, snapshot];
      if (this.undoStack.length > this.maxHistorySize) {
        this.undoStack = this.undoStack.slice(this.undoStack.length - this.maxHistorySize);
      }
      this.redoStack = [];
    } catch {
      // Ignore serialization errors if any
    }
  }

  undo() {
    if (this.undoStack.length === 0) return;
    try {
      const currentSnapshot = JSON.stringify(this.exportCurrentCampaign());
      this.redoStack = [...this.redoStack, currentSnapshot];

      const previousSnapshot = this.undoStack[this.undoStack.length - 1];
      this.undoStack = this.undoStack.slice(0, -1);

      if (previousSnapshot) {
        this.isRestoringHistory = true;
        const restored: CampaignData = JSON.parse(previousSnapshot);
        this.campaign = { ...restored };
        this.nodes.set(JSON.parse(JSON.stringify(restored.nodes || [])));
        this.edges.set(JSON.parse(JSON.stringify(restored.edges || [])));
        this.markDirty();
      }
    } finally {
      this.isRestoringHistory = false;
    }
  }

  redo() {
    if (this.redoStack.length === 0) return;
    try {
      const currentSnapshot = JSON.stringify(this.exportCurrentCampaign());
      this.undoStack = [...this.undoStack, currentSnapshot];

      const nextSnapshot = this.redoStack[this.redoStack.length - 1];
      this.redoStack = this.redoStack.slice(0, -1);

      if (nextSnapshot) {
        this.isRestoringHistory = true;
        const restored: CampaignData = JSON.parse(nextSnapshot);
        this.campaign = { ...restored };
        this.nodes.set(JSON.parse(JSON.stringify(restored.nodes || [])));
        this.edges.set(JSON.parse(JSON.stringify(restored.edges || [])));
        this.markDirty();
      }
    } finally {
      this.isRestoringHistory = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle & Campaign Loading
  // ---------------------------------------------------------------------------

  loadCampaign(data: CampaignData) {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    this.campaign = JSON.parse(JSON.stringify(data));
    this.nodes.set(JSON.parse(JSON.stringify(data.nodes || [])));
    this.edges.set(JSON.parse(JSON.stringify(data.edges || [])));
    this.searchQuery = '';
    this.selectedEntity = null;
    this.editingNode = null;
    this.editingEdge = null;
    this.undoStack = [];
    this.redoStack = [];
    this.isDirty = false;
    this.isSaving = false;
    this.lastSavedAt = Date.now();
  }

  exportCurrentCampaign(): CampaignData {
    return {
      ...JSON.parse(JSON.stringify(this.campaign)),
      nodes: JSON.parse(JSON.stringify(get(this.nodes))),
      edges: JSON.parse(JSON.stringify(get(this.edges))),
      updatedAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Persistence & Auto-Save Mechanics
  // ---------------------------------------------------------------------------

  markDirty() {
    this.isDirty = true;
    this.scheduleAutoSave();
  }

  scheduleAutoSave() {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = setTimeout(async () => {
      await this.saveCurrentCampaign();
    }, this.autoSaveIntervalMs);
  }

  async saveCurrentCampaign() {
    if (!this.campaign?.id) return;
    this.isSaving = true;

    try {
      const fullData = this.exportCurrentCampaign();
      this.campaign.updatedAt = fullData.updatedAt;

      // Instant local persistence
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('mural_active_campaign', JSON.stringify(fullData));
          localStorage.setItem(`mural_campaign_${fullData.id}`, JSON.stringify(fullData));
          if (fullData.settings) {
            localStorage.setItem('mural_global_settings', JSON.stringify(fullData.settings));
          }
        }
      } catch {}

      await storageService.saveCampaign(fullData);
      this.isDirty = false;
      this.lastSavedAt = Date.now();
    } catch (err) {
      console.error('[CampaignStore] Failed to auto-save campaign:', err);
    } finally {
      this.isSaving = false;
    }
  }

  flushSync() {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    const fullData = this.exportCurrentCampaign();
    try {
      if (typeof localStorage !== 'undefined' && fullData.id) {
        localStorage.setItem('mural_active_campaign', JSON.stringify(fullData));
        localStorage.setItem(`mural_campaign_${fullData.id}`, JSON.stringify(fullData));
        if (fullData.settings) {
          localStorage.setItem('mural_global_settings', JSON.stringify(fullData.settings));
        }
      }
    } catch {
      // Ignore
    }
  }

  // ---------------------------------------------------------------------------
  // Node Actions
  // ---------------------------------------------------------------------------

  openNodeEditor(data: EntityNodeData) {
    this.editingNode = JSON.parse(JSON.stringify(data));
  }

  closeNodeEditor() {
    this.editingNode = null;
  }

  updateNodeData(id: string, partial: Partial<EntityNodeData>) {
    this.recordSnapshot();
    this.nodes.update((list) =>
      list.map((node) => {
        if (node.id === id) {
          const updatedData: EntityNodeData = {
            ...node.data,
            ...partial,
          };
          return {
            ...node,
            data: updatedData,
          };
        }
        return node;
      })
    );
    this.markDirty();
  }

  deleteNode(id: string) {
    this.recordSnapshot();
    this.nodes.update((list) => list.filter((n) => n.id !== id));
    this.edges.update((list) => list.filter((e) => e.source !== id && e.target !== id));
    if (this.editingNode?.id === id) {
      this.editingNode = null;
    }
    this.markDirty();
  }

  deleteNodes(ids: string[]) {
    if (!ids || ids.length === 0) return;
    this.recordSnapshot();
    const set = new Set(ids);
    this.nodes.update((list) => list.filter((n) => !set.has(n.id)));
    this.edges.update((list) => list.filter((e) => !set.has(e.source) && !set.has(e.target)));
    if (this.editingNode && set.has(this.editingNode.id)) {
      this.editingNode = null;
    }
    this.markDirty();
  }

  duplicateNode(id: string) {
    this.recordSnapshot();
    const list = get(this.nodes);
    const existing = list.find((n) => n.id === id);
    if (!existing) return;

    const newId = `node-${Date.now()}`;
    const duplicatedNode: Node<EntityNodeData> = {
      ...JSON.parse(JSON.stringify(existing)),
      id: newId,
      position: {
        x: existing.position.x + 40,
        y: existing.position.y + 40,
      },
      data: {
        ...JSON.parse(JSON.stringify(existing.data)),
        id: newId,
        title: `${existing.data.title || 'Entidade'} (Cópia)`,
      },
    };

    this.nodes.update((nodes) => [...nodes, duplicatedNode]);
    this.markDirty();
  }

  toggleNodeSecret(id: string) {
    this.recordSnapshot();
    this.nodes.update((list) =>
      list.map((node) => {
        if (node.id === id) {
          const currentSecret = Boolean(node.data.isSecret || node.data.type === 'secret');
          return {
            ...node,
            data: {
              ...node.data,
              isSecret: !currentSecret,
              revealed: currentSecret,
            },
          };
        }
        return node;
      })
    );
    this.markDirty();
  }

  addEntityNode(data: Partial<EntityNodeData>, x = 300, y = 200) {
    this.recordSnapshot();
    const id = `node-${Date.now()}`;
    const entityType = data.type || data.category || 'npc';
    const isSecret = Boolean(data.isSecret || entityType === 'secret');
    const newNode: Node<EntityNodeData> = {
      id,
      type: 'entityNode',
      position: { x, y },
      data: {
        id,
        type: entityType,
        category: entityType,
        title: data.title || 'Nova Entidade',
        subtitle: data.subtitle || entityType.toUpperCase(),
        description: data.description || 'Clica duas vezes para editar a descrição...',
        colorTheme: data.colorTheme || data.color || '#d4a359',
        color: data.color || data.colorTheme || '#d4a359',
        isSecret,
        revealed: !isSecret,
        tags: data.tags || [],
        icon: data.icon || (entityType === 'npc' ? 'user' : entityType === 'faction' ? 'shield' : entityType === 'location' ? 'map-pin' : entityType === 'note' ? 'file-text' : entityType === 'table' ? 'dices' : 'skull'),
        tables: data.tables || [],
        notes: data.notes || [],
      },
    };

    this.nodes.update((nodes) => [...nodes, newNode]);
    this.markDirty();
  }

  // ---------------------------------------------------------------------------
  // Edge Actions
  // ---------------------------------------------------------------------------

  openEdgeEditor(edge: CanvasRelationEdge) {
    this.editingEdge = JSON.parse(JSON.stringify(edge));
  }

  closeEdgeEditor() {
    this.editingEdge = null;
  }

  updateEdgeData(id: string, partial: Partial<CanvasRelationEdgeData>) {
    this.recordSnapshot();
    this.edges.update((list) =>
      list.map((edge) => {
        if (edge.id === id) {
          return {
            ...edge,
            data: {
              ...(edge.data || { label: '', relationType: 'neutral' }),
              ...partial,
            },
          };
        }
        return edge;
      })
    );
    this.markDirty();
  }

  deleteEdge(id: string) {
    this.recordSnapshot();
    this.edges.update((list) => list.filter((e) => e.id !== id));
    if (this.editingEdge?.id === id) {
      this.editingEdge = null;
    }
    this.markDirty();
  }

  // ---------------------------------------------------------------------------
  // Threat Clock Actions
  // ---------------------------------------------------------------------------

  addClock(title: string, totalSegments: number = 6, consequence?: string) {
    this.recordSnapshot();
    const newClock: ThreatClock = {
      id: `clock-${Date.now()}`,
      title: title.trim(),
      totalSegments,
      filledSegments: 0,
      consequence: consequence?.trim(),
      createdAt: Date.now(),
    };
    this.campaign.clocks = [...(this.campaign.clocks || []), newClock];
    this.markDirty();
  }

  stepClock(clockId: string, delta: number) {
    this.recordSnapshot();
    this.campaign.clocks = (this.campaign.clocks || []).map((clock) => {
      if (clock.id === clockId) {
        const next = Math.max(0, Math.min(clock.totalSegments, clock.filledSegments + delta));
        return { ...clock, filledSegments: next };
      }
      return clock;
    });
    this.markDirty();
  }

  incrementClock(clockId: string) {
    this.stepClock(clockId, 1);
  }

  decrementClock(clockId: string) {
    this.stepClock(clockId, -1);
  }

  deleteClock(clockId: string) {
    this.recordSnapshot();
    this.campaign.clocks = (this.campaign.clocks || []).filter((c) => c.id !== clockId);
    this.markDirty();
  }

  // ---------------------------------------------------------------------------
  // Lore Actions
  // ---------------------------------------------------------------------------

  toggleLoreStatus(loreId: string) {
    this.toggleLoreVisibility(loreId);
  }

  toggleLoreVisibility(loreId: string) {
    this.recordSnapshot();
    this.campaign.lore = (this.campaign.lore || []).map((lore) => {
      if (lore.id === loreId) {
        const current = lore.status || lore.visibility || 'SEGREDO';
        const next = current === 'SABIDO' ? 'SEGREDO' : 'SABIDO';
        return { ...lore, status: next, visibility: next, updatedAt: Date.now() };
      }
      return lore;
    });
    this.markDirty();
  }

  addLoreEntry(content: string, status: 'SABIDO' | 'SEGREDO' = 'SEGREDO', associatedNodeIds: string[] = []) {
    this.recordSnapshot();
    const newEntry: LoreEntry = {
      id: `lore-${Date.now()}`,
      content: content.trim(),
      status,
      visibility: status,
      associatedNodeIds,
      sessionNumber: this.campaign.currentSession,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.campaign.lore = [newEntry, ...(this.campaign.lore || [])];
    this.markDirty();
  }

  deleteLoreEntry(loreId: string) {
    this.recordSnapshot();
    this.campaign.lore = (this.campaign.lore || []).filter((l) => l.id !== loreId);
    this.markDirty();
  }

  // ---------------------------------------------------------------------------
  // Timeline & Session Actions
  // ---------------------------------------------------------------------------

  addTimelineMarker(title: string, sessionNumber: number, inGameDate?: string) {
    this.recordSnapshot();
    const newMarker: TimelineMarker = {
      id: `tm-${Date.now()}`,
      title: title.trim(),
      sessionNumber,
      sessionText: `Sessão ${sessionNumber}`,
      inGameDate: inGameDate || this.campaign.inGamePeriod,
      realDate: new Date().toLocaleDateString('pt-PT'),
      notes: '',
      timestamp: Date.now(),
    };
    this.campaign.timeline = [...(this.campaign.timeline || []), newMarker];
    this.markDirty();
  }

  updateSessionData(sessionNumber: number, data: Partial<TimelineMarker>) {
    if (this.campaign.timeline) {
      this.campaign.timeline = this.campaign.timeline.map((tm) => {
        if (tm.sessionNumber === sessionNumber) {
          return { ...tm, ...data };
        }
        return tm;
      });
      if (data.inGameDate) {
        this.campaign.inGamePeriod = data.inGameDate;
      }
      this.markDirty();
    }
  }

  updateInGamePeriod(newDate: string) {
    this.recordSnapshot();
    this.campaign.inGamePeriod = newDate.trim();
    if (this.campaign.timeline) {
      this.updateSessionData(this.campaign.currentSession, { inGameDate: newDate.trim() });
    }
    this.markDirty();
  }

  switchActiveSession(sessionNumber: number) {
    this.campaign.currentSession = sessionNumber;
    if (this.campaign.timeline) {
      this.campaign.timeline = this.campaign.timeline.map((tm) => {
        const isCurrent = tm.sessionNumber === sessionNumber;
        if (isCurrent && tm.inGameDate) {
          this.campaign.inGamePeriod = tm.inGameDate;
        }
        return {
          ...tm,
          isCurrent,
        };
      });
    }
    this.markDirty();
  }
}

export const campaignStore = new CampaignStore();
