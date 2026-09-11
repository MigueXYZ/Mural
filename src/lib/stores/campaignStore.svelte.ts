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
  CustomCalendarConfig,
  MoonPhaseResult,
  CampaignFileNode,
  CombatStats,
  EntityCategory,
} from '../types';
import type { Node, Edge } from '@xyflow/svelte';
import { writable, get } from 'svelte/store';
import { storageService, autoSaveEngine } from '../services/storage';
import {
  formatDate,
  advanceDays,
  advanceMonths,
  advanceYears,
  getMoonPhases,
  AERTHYS_PRESET,
  GREGORIAN_PRESET,
} from '../services/calendar/calendarEngine';

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

  // File Explorer & Mission Scoping Reactive State
  fileSystem = $state<CampaignFileNode[]>([]);
  activeScopeFolderId = $state<string | 'all'>('all');
  selectedFileId = $state<string | null>(null);

  // Custom Calendar Modal State (US 154)
  isCalendarOpen = $state<boolean>(false);
  isCalendarConfigOpen = $state<boolean>(false);

  // Persistence & Autosave Reactive State
  isDirty = $state<boolean>(false);
  isSaving = $state<boolean>(false);
  lastSavedAt = $state<number | null>(null);

  // Undo / Redo History Stack (Ctrl+Z / Ctrl+Y)
  undoStack = $state<string[]>([]);
  redoStack = $state<string[]>([]);
  private isRestoringHistory = false;
  private maxHistorySize = 50;
  private liveNodeBaselines = new Map<string, EntityNodeData>();
  private liveEdgeBaselines = new Map<string, CanvasRelationEdgeData>();
  private copiedEdges: Edge<CanvasRelationEdgeData>[] = [];

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
    this.liveNodeBaselines.clear();
    this.liveEdgeBaselines.clear();
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
    this.liveNodeBaselines.clear();
    this.liveEdgeBaselines.clear();
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
    
    // Normalize custom calendar configuration with backward compatibility
    if (!this.campaign.customCalendar) {
      const isModern = (this.campaign.system || '').toLowerCase().includes('ordem') || (this.campaign.system || '').toLowerCase().includes('modern');
      const defaultCal: CustomCalendarConfig = JSON.parse(JSON.stringify(isModern ? GREGORIAN_PRESET : AERTHYS_PRESET));
      this.campaign.customCalendar = defaultCal;
      if (!this.campaign.inGamePeriod) {
        this.campaign.inGamePeriod = formatDate(defaultCal);
      }
    }

    this.nodes.set(JSON.parse(JSON.stringify(data.nodes || [])));
    const normalizedEdges = (data.edges || []).map((edge: any) => ({
      ...edge,
      type: 'customLabeledEdge',
      data: {
        label: edge.data?.label || 'ligado a',
        relationType: edge.data?.relationType || 'neutral',
        pathType: edge.data?.pathType || 'smoothstep',
        bidirectional: Boolean(edge.data?.bidirectional),
        notes: edge.data?.notes || '',
        ...edge.data,
      },
    }));
    this.edges.set(JSON.parse(JSON.stringify(normalizedEdges)));

    // File System & Mission Scoping Initialization
    this.fileSystem = data.fileSystem && data.fileSystem.length > 0 ? JSON.parse(JSON.stringify(data.fileSystem)) : [];
    this.activeScopeFolderId = data.activeScopeFolderId || 'all';
    this.selectedFileId = null;

    if (this.fileSystem.length === 0) {
      this.initializeDefaultFileSystem(this.campaign.nodes || []);
    }

    // Apply active canvas scope if non-default
    if (this.activeScopeFolderId !== 'all') {
      this.setCanvasScope(this.activeScopeFolderId);
    }

    this.searchQuery = '';
    this.selectedEntity = null;
    this.editingNode = null;
    this.editingEdge = null;
    this.liveNodeBaselines.clear();
    this.liveEdgeBaselines.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.isDirty = false;
    this.isSaving = false;
    this.lastSavedAt = Date.now();
  }

  exportCurrentCampaign(): CampaignData {
    this.syncCurrentNodesToMaster();
    return {
      ...JSON.parse(JSON.stringify(this.campaign)),
      nodes: JSON.parse(JSON.stringify(this.campaign.nodes || [])),
      edges: JSON.parse(JSON.stringify(this.campaign.edges || [])),
      fileSystem: JSON.parse(JSON.stringify(this.fileSystem)),
      activeScopeFolderId: this.activeScopeFolderId,
      updatedAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Canvas Scoping & Master Synchronization
  // ---------------------------------------------------------------------------

  syncCurrentNodesToMaster() {
    const currentList = get(this.nodes);
    const posMap = new Map(currentList.map((n) => [n.id, n.position]));
    const dataMap = new Map(currentList.map((n) => [n.id, n.data]));

    this.campaign.nodes = (this.campaign.nodes || []).map((node) => {
      const p = posMap.get(node.id);
      const d = dataMap.get(node.id);
      return {
        ...node,
        position: p ? { ...p } : node.position,
        data: d ? { ...d } : node.data,
      };
    });

    const currentEdges = get(this.edges);
    const edgeMap = new Map(currentEdges.map((e) => [e.id, e]));
    const updatedEdges = (this.campaign.edges || []).map((e) => {
      return edgeMap.get(e.id) || e;
    });
    const existingIds = new Set(updatedEdges.map((e) => e.id));
    for (const edge of currentEdges) {
      if (!existingIds.has(edge.id)) {
        updatedEdges.push(JSON.parse(JSON.stringify(edge)));
        existingIds.add(edge.id);
      }
    }
    this.campaign.edges = updatedEdges;
  }

  setCanvasScope(folderId: string | 'all') {
    this.syncCurrentNodesToMaster();
    this.activeScopeFolderId = folderId;

    if (folderId === 'all') {
      this.nodes.set(JSON.parse(JSON.stringify(this.campaign.nodes || [])));
      this.edges.set(JSON.parse(JSON.stringify(this.campaign.edges || [])));
      return;
    }

    // Collect all descendant folder IDs recursively
    const targetFolderIds = new Set<string>([folderId]);
    let added = true;
    while (added) {
      added = false;
      for (const item of this.fileSystem) {
        if (
          item.type === 'folder' &&
          item.parentId &&
          targetFolderIds.has(item.parentId) &&
          !targetFolderIds.has(item.id)
        ) {
          targetFolderIds.add(item.id);
          added = true;
        }
      }
    }

    // Collect all node IDs belonging to these folders
    const scopedNodeIds = new Set<string>();
    for (const item of this.fileSystem) {
      if (item.type === 'file' && item.nodeId && item.parentId && targetFolderIds.has(item.parentId)) {
        scopedNodeIds.add(item.nodeId);
      }
    }

    for (const n of this.campaign.nodes || []) {
      if (n.data?.folderId && targetFolderIds.has(n.data.folderId as string)) {
        scopedNodeIds.add(n.id);
      }
    }

    const filteredNodes = (this.campaign.nodes || []).filter((n) => scopedNodeIds.has(n.id));
    const filteredEdges = (this.campaign.edges || []).filter(
      (e) => scopedNodeIds.has(e.source) && scopedNodeIds.has(e.target)
    );

    this.nodes.set(JSON.parse(JSON.stringify(filteredNodes)));
    this.edges.set(JSON.parse(JSON.stringify(filteredEdges)));
  }

  initializeDefaultFileSystem(nodes: Node<EntityNodeData>[]) {
    const defaultFolders: CampaignFileNode[] = [];
    const files: CampaignFileNode[] = [];

    const hasPerafita = nodes.some((n) => {
      const t = (n.data?.tags || []).concat([n.data?.title || '', n.data?.subtitle || '']).join(' ').toLowerCase();
      return t.includes('perafita') || t.includes('caso 1');
    });

    const hasBarcelos = nodes.some((n) => {
      const t = (n.data?.tags || []).concat([n.data?.title || '', n.data?.subtitle || '']).join(' ').toLowerCase();
      return t.includes('barcelos') || t.includes('caso 2') || t.includes('porto');
    });

    let folderCaso1Id: string | null = null;
    let folderCaso2Id: string | null = null;
    let folderOrdemId: string | null = null;
    let folderElenismoId: string | null = null;
    let folderGeralId: string | null = null;

    if (hasPerafita || hasBarcelos) {
      folderCaso1Id = 'folder-caso-1';
      defaultFolders.push({
        id: folderCaso1Id,
        name: 'Caso 1: O Mistério de Perafita',
        type: 'folder',
        parentId: null,
        isMissionFolder: true,
        color: '#38bdf8',
      });

      folderCaso2Id = 'folder-caso-2';
      defaultFolders.push({
        id: folderCaso2Id,
        name: 'Caso 2: A Célula de Barcelos',
        type: 'folder',
        parentId: null,
        isMissionFolder: true,
        color: '#a855f7',
      });

      folderOrdemId = 'folder-ordem';
      defaultFolders.push({
        id: folderOrdemId,
        name: 'Ordo Realitas (Comando & Base)',
        type: 'folder',
        parentId: null,
        color: '#22c55e',
      });

      folderElenismoId = 'folder-elenismo';
      defaultFolders.push({
        id: folderElenismoId,
        name: 'A Seita do Elenismo',
        type: 'folder',
        parentId: null,
        color: '#f87171',
      });

      defaultFolders.push({
        id: 'folder-caso-3',
        name: 'Caso 3: (Planeamento)',
        type: 'folder',
        parentId: null,
        isMissionFolder: true,
      });

      defaultFolders.push({
        id: 'folder-caso-4',
        name: 'Caso 4: (Planeamento)',
        type: 'folder',
        parentId: null,
        isMissionFolder: true,
      });

      defaultFolders.push({
        id: 'folder-caso-5',
        name: 'Caso 5: O Clímax Final',
        type: 'folder',
        parentId: null,
        isMissionFolder: true,
      });
    } else {
      folderGeralId = 'folder-geral';
      defaultFolders.push({
        id: folderGeralId,
        name: 'Dossiê & Ficheiros',
        type: 'folder',
        parentId: null,
      });
    }

    // Assign nodes to folders
    nodes.forEach((n) => {
      const t = (n.data?.tags || []).concat([n.data?.title || '', n.data?.subtitle || '', n.data?.description || '']).join(' ').toLowerCase();
      let parentId: string | null = folderGeralId;

      if (folderCaso1Id) {
        if (t.includes('caso 2') || t.includes('barcelos') || t.includes('porto')) {
          parentId = folderCaso2Id;
        } else if (t.includes('ordo realitas') || t.includes('sr. veríssimo') || t.includes('verissimo') || t.includes('sintra')) {
          parentId = folderOrdemId;
        } else if (t.includes('elenismo') && (t.includes('anjo') || t.includes('1174') || t.includes('ines') || t.includes('inês'))) {
          parentId = folderElenismoId;
        } else {
          parentId = folderCaso1Id;
        }
      }

      n.data.folderId = parentId;
      files.push({
        id: `file-${n.id}`,
        name: n.data?.title || 'Sem Título',
        type: 'file',
        parentId,
        nodeId: n.id,
      });
    });

    this.fileSystem = [...defaultFolders, ...files];
    this.campaign.fileSystem = this.fileSystem;
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
    this.liveNodeBaselines.clear();
    this.liveEdgeBaselines.clear();
  }

  updateNodeDataLive(id: string, partial: Partial<EntityNodeData>) {
    if (!this.liveNodeBaselines.has(id)) {
      const masterNode = (this.campaign.nodes || []).find((n) => n.id === id);
      if (masterNode) {
        this.liveNodeBaselines.set(id, JSON.parse(JSON.stringify(masterNode.data)));
      } else {
        const currentNode = get(this.nodes).find((n) => n.id === id);
        if (currentNode) {
          this.liveNodeBaselines.set(id, JSON.parse(JSON.stringify(currentNode.data)));
        }
      }
    }

    // Immediate reactive update without polluting undo stack
    this.nodes.update((list) =>
      list.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...partial,
            },
          };
        }
        return node;
      })
    );

    const masterNode = (this.campaign.nodes || []).find((n) => n.id === id);
    if (masterNode) {
      masterNode.data = { ...masterNode.data, ...partial };
    }
  }

  updateNodeData(id: string, partial: Partial<EntityNodeData>) {
    if (this.liveNodeBaselines.has(id)) {
      const baseline = this.liveNodeBaselines.get(id)!;
      this.liveNodeBaselines.delete(id);
      this.nodes.update((list) =>
        list.map((n) => (n.id === id ? { ...n, data: { ...baseline } } : n))
      );
      const master = (this.campaign.nodes || []).find((n) => n.id === id);
      if (master) master.data = { ...baseline };
    }

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

    // Sync master nodes
    const masterNode = (this.campaign.nodes || []).find((n) => n.id === id);
    if (masterNode) {
      masterNode.data = { ...masterNode.data, ...partial };
    }

    // Sync file system item name if title changed
    if (partial.title) {
      const file = this.fileSystem.find((f) => f.nodeId === id);
      if (file) {
        file.name = partial.title;
      }
    }

    this.markDirty();
  }

  deleteNode(id: string) {
    this.liveNodeBaselines.delete(id);
    this.recordSnapshot();
    this.nodes.update((list) => list.filter((n) => n.id !== id));
    this.edges.update((list) => list.filter((e) => e.source !== id && e.target !== id));
    this.campaign.nodes = (this.campaign.nodes || []).filter((n) => n.id !== id);
    this.campaign.edges = (this.campaign.edges || []).filter((e) => e.source !== id && e.target !== id);
    this.fileSystem = this.fileSystem.filter((f) => f.nodeId !== id);

    if (this.editingNode?.id === id) {
      this.editingNode = null;
    }
    if (this.selectedFileId && this.selectedFileId === `file-${id}`) {
      this.selectedFileId = null;
    }
    this.markDirty();
  }

  deleteNodes(ids: string[]) {
    if (!ids || ids.length === 0) return;
    this.recordSnapshot();
    const set = new Set(ids);
    this.nodes.update((list) => list.filter((n) => !set.has(n.id)));
    this.edges.update((list) => list.filter((e) => !set.has(e.source) && !set.has(e.target)));
    this.campaign.nodes = (this.campaign.nodes || []).filter((n) => !set.has(n.id));
    this.campaign.edges = (this.campaign.edges || []).filter((e) => !set.has(e.source) && !set.has(e.target));
    this.fileSystem = this.fileSystem.filter((f) => !f.nodeId || !set.has(f.nodeId));

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
    this.campaign.nodes = [...(this.campaign.nodes || []), duplicatedNode];

    this.fileSystem.push({
      id: `file-${newId}`,
      name: duplicatedNode.data.title,
      type: 'file',
      parentId: (existing.data?.folderId as string) || null,
      nodeId: newId,
    });

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
    const id = (data.id as string) || `node-${Date.now()}`;
    const entityType = data.type || data.category || 'npc';
    const isSecret = Boolean(data.isSecret || entityType === 'secret');
    const folderId = this.activeScopeFolderId !== 'all' ? this.activeScopeFolderId : ((data.folderId as string) || null);

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
        folderId,
        content: data.content || '',
        combatStats: data.combatStats,
        wikilinks: data.wikilinks || [],
        tables: data.tables || [],
        notes: data.notes || [],
      },
    };

    this.nodes.update((nodes) => [...nodes, newNode]);
    this.campaign.nodes = [...(this.campaign.nodes || []), newNode];

    this.fileSystem.push({
      id: `file-${id}`,
      name: newNode.data.title,
      type: 'file',
      parentId: folderId,
      nodeId: id,
    });

    this.markDirty();
  }

  // ---------------------------------------------------------------------------
  // File Explorer & Document Management Methods
  // ---------------------------------------------------------------------------

  createFolder(name: string, parentId: string | null = null, isMission = false, color?: string): string {
    this.recordSnapshot();
    const id = `folder-${Date.now()}`;
    const newFolder: CampaignFileNode = {
      id,
      name: name.trim() || 'Nova Pasta',
      type: 'folder',
      parentId,
      isMissionFolder: isMission,
      color,
    };
    this.fileSystem = [...this.fileSystem, newFolder];
    this.campaign.fileSystem = this.fileSystem;
    this.markDirty();
    return id;
  }

  createFile(
    name: string,
    parentId: string | null = null,
    category: EntityCategory = 'note',
    content = '',
    createCanvasNode = true
  ): string {
    this.recordSnapshot();
    const nodeId = `node-${Date.now()}`;
    const fileId = `file-${nodeId}`;

    if (createCanvasNode) {
      this.addEntityNode(
        {
          id: nodeId,
          title: name.trim() || 'Novo Ficheiro',
          type: category,
          category,
          description: content.slice(0, 160),
          content,
          folderId: parentId,
        },
        200 + Math.random() * 200,
        200 + Math.random() * 200
      );
    } else {
      const newFile: CampaignFileNode = {
        id: fileId,
        name: name.trim() || 'Novo Ficheiro',
        type: 'file',
        parentId,
      };
      this.fileSystem = [...this.fileSystem, newFile];
      this.campaign.fileSystem = this.fileSystem;
      this.markDirty();
    }

    this.selectedFileId = fileId;
    return fileId;
  }

  renameFileOrFolder(id: string, newName: string) {
    const cleanName = newName.trim();
    if (!cleanName) return;

    this.recordSnapshot();
    const item = this.fileSystem.find((f) => f.id === id);
    if (!item) return;

    item.name = cleanName;
    if (item.type === 'file' && item.nodeId) {
      this.updateNodeData(item.nodeId, { title: cleanName });
    }
    this.fileSystem = [...this.fileSystem];
    this.campaign.fileSystem = this.fileSystem;
    this.markDirty();
  }

  moveFileOrFolder(id: string, newParentId: string | null) {
    if (id === newParentId) return;
    this.recordSnapshot();

    const item = this.fileSystem.find((f) => f.id === id);
    if (!item) return;

    item.parentId = newParentId;
    if (item.type === 'file' && item.nodeId) {
      this.updateNodeData(item.nodeId, { folderId: newParentId });
    }
    this.fileSystem = [...this.fileSystem];
    this.campaign.fileSystem = this.fileSystem;
    this.markDirty();
  }

  deleteFileOrFolder(id: string, deleteAssociatedNode = true) {
    this.recordSnapshot();
    const item = this.fileSystem.find((f) => f.id === id);
    if (!item) return;

    // If folder, find all descendants recursively
    const toDeleteIds = new Set<string>([id]);
    const nodeIdsToDelete = new Set<string>();

    if (item.type === 'folder') {
      let added = true;
      while (added) {
        added = false;
        for (const f of this.fileSystem) {
          if (f.parentId && toDeleteIds.has(f.parentId) && !toDeleteIds.has(f.id)) {
            toDeleteIds.add(f.id);
            if (f.nodeId) nodeIdsToDelete.add(f.nodeId);
            added = true;
          }
        }
      }
    } else if (item.nodeId) {
      nodeIdsToDelete.add(item.nodeId);
    }

    this.fileSystem = this.fileSystem.filter((f) => !toDeleteIds.has(f.id));
    this.campaign.fileSystem = this.fileSystem;

    if (deleteAssociatedNode && nodeIdsToDelete.size > 0) {
      this.deleteNodes(Array.from(nodeIdsToDelete));
    }

    if (this.selectedFileId && toDeleteIds.has(this.selectedFileId)) {
      this.selectedFileId = null;
    }

    this.markDirty();
  }

  openFile(fileId: string) {
    this.selectedFileId = fileId;
    const item = this.fileSystem.find((f) => f.id === fileId);
    if (item && item.nodeId) {
      const node = (this.campaign.nodes || []).find((n) => n.id === item.nodeId);
      if (node) {
        this.selectedEntity = node.data;
      }
    }
  }

  syncWikilinksForNode(nodeId: string, content: string, combatStats?: CombatStats) {
    this.recordSnapshot();
    this.syncCurrentNodesToMaster();

    const matches = Array.from(content.matchAll(/\[\[(.*?)\]\]/g));
    const extractedTitles = matches.map((m) => m[1].trim()).filter(Boolean);
    const targetSet = new Set(extractedTitles.map((t) => t.toLowerCase()));

    const allNodes = this.campaign.nodes || [];
    const sourceNode = allNodes.find((n) => n.id === nodeId);
    if (!sourceNode) return;

    sourceNode.data.content = content;
    if (combatStats) {
      sourceNode.data.combatStats = { ...combatStats };
    }
    sourceNode.data.wikilinks = extractedTitles;

    const targetNodes = allNodes.filter(
      (n) => n.id !== nodeId && (targetSet.has((n.data?.title || '').toLowerCase()) || targetSet.has(n.id.toLowerCase()))
    );

    const targetNodeIds = new Set(targetNodes.map((n) => n.id));

    const currentEdges = this.campaign.edges || [];
    targetNodes.forEach((targetNode) => {
      const exists = currentEdges.some(
        (e) => (e.source === nodeId && e.target === targetNode.id) || (e.source === targetNode.id && e.target === nodeId)
      );

      if (!exists) {
        const edgeId = `edge-wikilink-${nodeId}-${targetNode.id}`;
        const newEdge: Edge<CanvasRelationEdgeData> = {
          id: edgeId,
          source: nodeId,
          target: targetNode.id,
          type: 'customLabeledEdge',
          data: {
            label: 'menciona',
            relationType: 'investigates',
            pathType: 'smoothstep',
            bidirectional: false,
            notes: 'Ligação gerada por [[wikilink]]',
          },
        };
        this.campaign.edges.push(newEdge);
      }
    });

    // Prune removed wikilink edges
    this.campaign.edges = (this.campaign.edges || []).filter((e) => {
      if (e.source === nodeId && (e.id.startsWith(`edge-wikilink-${nodeId}-`) || e.data?.notes === 'Ligação gerada por [[wikilink]]')) {
        return targetNodeIds.has(e.target);
      }
      return true;
    });

    this.nodes.update((list) =>
      list.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              content,
              combatStats: combatStats || n.data.combatStats,
              wikilinks: extractedTitles,
            },
          };
        }
        return n;
      })
    );

    if (this.activeScopeFolderId === 'all') {
      this.edges.set(JSON.parse(JSON.stringify(this.campaign.edges)));
    } else {
      this.setCanvasScope(this.activeScopeFolderId);
    }

    this.markDirty();
  }

  exportToObsidianVault(): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];
    const folderPathMap = new Map<string, string>();

    const getFolderPath = (folderId: string | null | undefined): string => {
      if (!folderId) return '';
      if (folderPathMap.has(folderId)) return folderPathMap.get(folderId)!;
      const folder = this.fileSystem.find((f) => f.id === folderId);
      if (!folder) return '';
      const parent = getFolderPath(folder.parentId);
      const cleanName = folder.name.replace(/[\\/:*?"<>|]/g, '_');
      const full = parent ? `${parent}/${cleanName}` : cleanName;
      folderPathMap.set(folderId, full);
      return full;
    };

    this.fileSystem.forEach((item) => {
      if (item.type === 'file') {
        const folderPath = getFolderPath(item.parentId);
        const cleanName = item.name.replace(/[\\/:*?"<>|]/g, '_');
        const filePath = folderPath ? `${folderPath}/${cleanName}.md` : `${cleanName}.md`;

        const node = item.nodeId ? (this.campaign.nodes || []).find((n) => n.id === item.nodeId) : null;
        let md = '';

        if (node) {
          md += '---\n';
          md += `id: "${node.id}"\n`;
          md += `title: "${node.data.title || item.name}"\n`;
          md += `type: "${node.data.type || node.data.category || 'note'}"\n`;
          if (node.data.subtitle) md += `subtitle: "${node.data.subtitle}"\n`;
          if (node.data.tags && node.data.tags.length > 0) {
            md += `tags: [${node.data.tags.map((t) => `"${t}"`).join(', ')}]\n`;
          }
          if (node.data.isSecret) md += `isSecret: true\n`;
          if (node.data.color) md += `color: "${node.data.color}"\n`;
          md += '---\n\n';

          if (node.data.description) {
            md += `> ${node.data.description.split('\n').join('\n> ')}\n\n`;
          }

          if (node.data.combatStats) {
            const cs = node.data.combatStats;
            md += '### Ficha de Combate\n';
            if (cs.pvMax) md += `- **PV**: ${cs.pvCurrent || cs.pvMax}/${cs.pvMax}\n`;
            if (cs.peMax) md += `- **PE**: ${cs.peCurrent || cs.peMax}/${cs.peMax}\n`;
            if (cs.defense) md += `- **Defesa**: ${cs.defense}\n`;
            if (cs.displacement) md += `- **Deslocamento**: ${cs.displacement}\n`;
            if (cs.attributes) {
              md += `- **Atributos**: ` + Object.entries(cs.attributes).map(([k, v]) => `${k} ${v}`).join(' | ') + '\n';
            }
            md += '\n';
          }

          if (node.data.content) {
            md += node.data.content;
          }
        } else {
          md = `# ${item.name}\n\n`;
        }

        files.push({ path: filePath, content: md });
      }
    });

    return files;
  }

  // ---------------------------------------------------------------------------
  // Edge Actions
  // ---------------------------------------------------------------------------

  openEdgeEditor(edge: CanvasRelationEdge) {
    this.editingEdge = JSON.parse(JSON.stringify(edge));
  }

  closeEdgeEditor() {
    this.editingEdge = null;
    this.liveNodeBaselines.clear();
    this.liveEdgeBaselines.clear();
  }

  updateEdgeDataLive(id: string, partial: Partial<CanvasRelationEdgeData>) {
    if (!this.liveEdgeBaselines.has(id)) {
      const masterEdge = (this.campaign.edges || []).find((e) => e.id === id);
      if (masterEdge) {
        this.liveEdgeBaselines.set(id, JSON.parse(JSON.stringify(masterEdge.data || {})));
      } else {
        const currentEdge = get(this.edges).find((e) => e.id === id);
        if (currentEdge) {
          this.liveEdgeBaselines.set(id, JSON.parse(JSON.stringify(currentEdge.data || {})));
        }
      }
    }

    // Immediate reactive update without polluting undo stack
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

    const masterEdge = (this.campaign.edges || []).find((e) => e.id === id);
    if (masterEdge) {
      masterEdge.data = { ...(masterEdge.data || { label: '', relationType: 'neutral' }), ...partial };
    }
  }

  updateEdgeData(id: string, partial: Partial<CanvasRelationEdgeData>) {
    if (this.liveEdgeBaselines.has(id)) {
      const baseline = this.liveEdgeBaselines.get(id)!;
      this.liveEdgeBaselines.delete(id);
      this.edges.update((list) =>
        list.map((e) => (e.id === id ? { ...e, data: { ...baseline } } : e))
      );
      const masterEdge = (this.campaign.edges || []).find((e) => e.id === id);
      if (masterEdge) {
        masterEdge.data = { ...baseline };
      }
    }

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
    const masterEdge = (this.campaign.edges || []).find((e) => e.id === id);
    if (masterEdge) {
      masterEdge.data = { ...(masterEdge.data || { label: '', relationType: 'neutral' }), ...partial };
    }
    this.markDirty();
  }

  addEdge(newEdge: CanvasRelationEdge) {
    this.recordSnapshot();
    this.edges.update((list) => [...list, newEdge]);
    this.campaign.edges = [...(this.campaign.edges || []), JSON.parse(JSON.stringify(newEdge))];
    this.markDirty();
  }

  reconnectEdge(
    oldEdgeId: string,
    newConnection: {
      source: string;
      target: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }
  ): boolean {
    if (!newConnection.source || !newConnection.target) {
      return false;
    }
    if (newConnection.source === newConnection.target) {
      return false;
    }

    const currentEdges = get(this.edges);
    const inCurrent = currentEdges.some((e) => e.id === oldEdgeId);
    const inCampaign = (this.campaign.edges || []).some((e) => e.id === oldEdgeId);

    if (!inCurrent && !inCampaign) {
      return false;
    }

    this.recordSnapshot();
    this.liveEdgeBaselines.delete(oldEdgeId);

    let updatedEdge: CanvasRelationEdge | null = null;

    this.edges.update((list) =>
      list.map((edge) => {
        if (edge.id === oldEdgeId) {
          updatedEdge = {
            ...edge,
            source: newConnection.source,
            target: newConnection.target,
            sourceHandle:
              newConnection.sourceHandle !== undefined ? newConnection.sourceHandle : edge.sourceHandle,
            targetHandle:
              newConnection.targetHandle !== undefined ? newConnection.targetHandle : edge.targetHandle,
          };
          return updatedEdge;
        }
        return edge;
      })
    );

    this.campaign.edges = (this.campaign.edges || []).map((edge) => {
      if (edge.id === oldEdgeId) {
        return updatedEdge
          ? JSON.parse(JSON.stringify(updatedEdge))
          : {
              ...edge,
              source: newConnection.source,
              target: newConnection.target,
              sourceHandle:
                newConnection.sourceHandle !== undefined ? newConnection.sourceHandle : edge.sourceHandle,
              targetHandle:
                newConnection.targetHandle !== undefined ? newConnection.targetHandle : edge.targetHandle,
            };
      }
      return edge;
    });

    if (this.editingEdge?.id === oldEdgeId && updatedEdge) {
      this.editingEdge = JSON.parse(JSON.stringify(updatedEdge));
    }

    this.markDirty();
    return true;
  }

  copyEdges(edgesToCopy?: Edge<CanvasRelationEdgeData>[]): number {
    const toCopy =
      edgesToCopy && edgesToCopy.length > 0
        ? edgesToCopy
        : get(this.edges).filter((e) => e.selected);

    if (toCopy.length === 0) {
      return 0;
    }

    this.copiedEdges = JSON.parse(JSON.stringify(toCopy));
    return this.copiedEdges.length;
  }

  copySelectedEdges(): number {
    return this.copyEdges();
  }

  hasCopiedEdges(): boolean {
    return this.copiedEdges.length > 0;
  }

  pasteEdges(offsetStep: number = 20): Edge<CanvasRelationEdgeData>[] {
    if (!this.hasCopiedEdges()) return [];

    this.recordSnapshot();

    // Deselect currently selected edges
    this.edges.update((list) => list.map((e) => (e.selected ? { ...e, selected: false } : e)));

    const pastedList: Edge<CanvasRelationEdgeData>[] = [];

    for (const orig of this.copiedEdges) {
      const currentOffset = typeof orig.data?.offset === 'number' ? orig.data.offset : 20;
      const newOffset = currentOffset + offsetStep;

      // Update baseline in clipboard for consecutive paste offsets
      if (orig.data) {
        orig.data.offset = newOffset;
      }

      const newId = `edge-${orig.source}-${orig.target}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;

      const cloned: Edge<CanvasRelationEdgeData> = {
        ...JSON.parse(JSON.stringify(orig)),
        id: newId,
        selected: true,
        data: {
          ...JSON.parse(JSON.stringify(orig.data || {})),
          offset: newOffset,
        },
      };

      pastedList.push(cloned);
    }

    this.edges.update((list) => [...list, ...pastedList]);
    this.campaign.edges = [...(this.campaign.edges || []), ...JSON.parse(JSON.stringify(pastedList))];
    this.markDirty();
    return pastedList;
  }

  deleteEdge(id: string) {
    this.liveEdgeBaselines.delete(id);
    this.recordSnapshot();
    this.edges.update((list) => list.filter((e) => e.id !== id));
    this.campaign.edges = (this.campaign.edges || []).filter((e) => e.id !== id);
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

  // ---------------------------------------------------------------------------
  // Custom Calendar Actions (US 154)
  // ---------------------------------------------------------------------------

  openCalendar() {
    this.isCalendarOpen = true;
  }

  closeCalendar() {
    this.isCalendarOpen = false;
  }

  openCalendarConfig() {
    this.isCalendarConfigOpen = true;
  }

  closeCalendarConfig() {
    this.isCalendarConfigOpen = false;
  }

  get activeCalendar(): CustomCalendarConfig {
    if (!this.campaign.customCalendar) {
      this.campaign.customCalendar = JSON.parse(JSON.stringify(AERTHYS_PRESET));
    }
    return this.campaign.customCalendar!;
  }

  updateCustomCalendar(config: CustomCalendarConfig) {
    this.recordSnapshot();
    this.campaign.customCalendar = JSON.parse(JSON.stringify(config));
    const formatted = formatDate(config);
    this.campaign.inGamePeriod = formatted;
    if (this.campaign.timeline) {
      this.updateSessionData(this.campaign.currentSession, { inGameDate: formatted });
    }
    this.markDirty();
  }

  advanceCalendarDays(days: number) {
    const cal = this.activeCalendar;
    const updated = advanceDays(cal, days);
    this.updateCustomCalendar(updated);
  }

  advanceCalendarMonths(months: number) {
    const cal = this.activeCalendar;
    const updated = advanceMonths(cal, months);
    this.updateCustomCalendar(updated);
  }

  advanceCalendarYears(years: number) {
    const cal = this.activeCalendar;
    const updated = advanceYears(cal, years);
    this.updateCustomCalendar(updated);
  }

  setCalendarDate(year: number, monthIndex: number, day: number) {
    const cal = this.activeCalendar;
    const updated: CustomCalendarConfig = {
      ...cal,
      currentYear: year,
      currentMonthIndex: monthIndex,
      currentDay: day,
    };
    this.updateCustomCalendar(updated);
  }

  getCurrentMoonPhases(): MoonPhaseResult[] {
    const cal = this.activeCalendar;
    return getMoonPhases(cal.currentYear, cal.currentMonthIndex, cal.currentDay, cal);
  }
}

export const campaignStore = new CampaignStore();
