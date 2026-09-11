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
  MapData,
  MapPin,
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
import { replaceWikilinkTarget, extractWikilinkTargets, normalizeWikilinkTarget } from '../utils/markdown';

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
  draggedFileId = $state<string | null>(null);

  setDraggedFileId(id: string | null) {
    this.draggedFileId = id;
  }

  // Custom Calendar Modal State (US 154)
  isCalendarOpen = $state<boolean>(false);
  isCalendarConfigOpen = $state<boolean>(false);

  // Atlas & Maps State
  activeMapId = $state<string | null>(
    initialCampaign.maps && initialCampaign.maps.length > 0 ? initialCampaign.maps[0].id : null
  );

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
    if (this.fileSystem.length === 0) {
      this.initializeDefaultFileSystem(this.campaign.nodes || []);
    } else {
      this.syncFileSystemWithNodes();
    }
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
    } else {
      this.syncFileSystemWithNodes();
    }

    // Apply active canvas scope if non-default
    if (this.activeScopeFolderId !== 'all') {
      this.setCanvasScope(this.activeScopeFolderId);
    }

    // Normalize maps and activeMapId
    const normalizedMaps = data.maps && Array.isArray(data.maps) ? JSON.parse(JSON.stringify(data.maps)) : [];
    this.campaign.maps = normalizedMaps;
    this.activeMapId = normalizedMaps.length > 0 ? normalizedMaps[0].id : null;

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
    this.campaign.fileSystem = JSON.parse(JSON.stringify(this.fileSystem));
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

  syncFileSystemWithNodes() {
    let changed = false;
    const existingNodeIds = new Set(this.fileSystem.map((f) => f.nodeId).filter(Boolean));

    (this.campaign.nodes || []).forEach((node) => {
      if (!existingNodeIds.has(node.id)) {
        this.fileSystem.push({
          id: `file-${node.id}`,
          name: node.data?.title || 'Sem Título',
          type: 'file',
          parentId: (node.data?.folderId as string) || null,
          nodeId: node.id,
        });
        existingNodeIds.add(node.id);
        changed = true;
      } else {
        const file = this.fileSystem.find((f) => f.nodeId === node.id);
        if (file && node.data?.title && file.name !== node.data.title) {
          file.name = node.data.title;
          changed = true;
        }
      }
    });

    if (changed) {
      this.fileSystem = [...this.fileSystem];
      this.campaign.fileSystem = this.fileSystem;
      this.markDirty();
    }
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

    // Ensure bidirectional synchronization between description (canvas card) and content (dossier)
    if (partial.description !== undefined && partial.content === undefined) {
      partial.content = partial.description;
    } else if (partial.content !== undefined && partial.description === undefined) {
      partial.description = partial.content;
    }

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
    const oldTitle = masterNode?.data?.title;
    if (masterNode) {
      masterNode.data = { ...masterNode.data, ...partial };
    }

    if (this.selectedEntity && this.selectedEntity.id === id) {
      this.selectedEntity = { ...this.selectedEntity, ...partial };
    }

    // Sync file system item name if title changed and cascade wikilink references
    if (partial.title) {
      const cleanTitle = partial.title.trim();
      const file = this.fileSystem.find((f) => f.nodeId === id);
      if (file) {
        file.name = cleanTitle;
        this.fileSystem = [...this.fileSystem];
        this.campaign.fileSystem = this.fileSystem;
      }
      if (oldTitle && cleanTitle && oldTitle.trim().toLowerCase() !== cleanTitle.toLowerCase()) {
        this.updateWikilinkReferences(oldTitle, cleanTitle, id);
      }
    }

    // Auto-scan and connect wikilinks in real-time when content or description changes
    const textToScan = partial.content ?? partial.description;
    if (typeof textToScan === 'string' && textToScan.includes('[[')) {
      this.syncWikilinksForNodeInternal(id, textToScan);
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
    this.fileSystem = this.fileSystem.filter((f) => f.nodeId !== id && f.id !== `file-${id}`);
    this.campaign.fileSystem = this.fileSystem;

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
    this.campaign.fileSystem = this.fileSystem;

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

    this.fileSystem = [
      ...this.fileSystem,
      {
        id: `file-${newId}`,
        name: duplicatedNode.data.title,
        type: 'file',
        parentId: (existing.data?.folderId as string) || null,
        nodeId: newId,
      },
    ];
    this.campaign.fileSystem = this.fileSystem;

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

    this.fileSystem = [
      ...this.fileSystem,
      {
        id: `file-${id}`,
        name: newNode.data.title,
        type: 'file',
        parentId: folderId,
        nodeId: id,
      },
    ];
    this.campaign.fileSystem = this.fileSystem;

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

    const oldName = item.name;
    if (oldName === cleanName) return;

    item.name = cleanName;
    if (item.type === 'file' && item.nodeId) {
      this.updateNodeData(item.nodeId, { title: cleanName });
    } else if (item.type === 'file') {
      this.updateWikilinkReferences(oldName, cleanName);
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

  /**
   * Internal routine to synchronize wikilink edges for a given node based on its markdown text.
   * Uses resilient normalization (accents, underscores, hyphens, .md suffix, casing).
   */
  syncWikilinksForNodeInternal(nodeId: string, content: string): { addedCount: number } {
    const extractedTitles = extractWikilinkTargets(content);
    const normalizedTargets = new Set(extractedTitles.map((t) => normalizeWikilinkTarget(t)).filter(Boolean));

    const allNodes = this.campaign.nodes || [];
    const sourceNode = allNodes.find((n) => n.id === nodeId);
    if (!sourceNode) return { addedCount: 0 };

    sourceNode.data.wikilinks = extractedTitles;

    const targetNodes = allNodes.filter((n) => {
      if (n.id === nodeId) return false;
      const normTitle = normalizeWikilinkTarget(n.data?.title || '');
      const normId = normalizeWikilinkTarget(n.id);
      return normalizedTargets.has(normTitle) || normalizedTargets.has(normId);
    });

    const targetNodeIds = new Set(targetNodes.map((n) => n.id));
    const currentEdges = this.campaign.edges || [];
    let addedCount = 0;

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
        addedCount++;
      }
    });

    // Prune removed wikilink edges originating from this node
    this.campaign.edges = (this.campaign.edges || []).filter((e) => {
      if (e.source === nodeId && (e.id.startsWith(`edge-wikilink-${nodeId}-`) || e.data?.notes === 'Ligação gerada por [[wikilink]]')) {
        return targetNodeIds.has(e.target);
      }
      return true;
    });

    if (this.activeScopeFolderId === 'all') {
      this.edges.set(JSON.parse(JSON.stringify(this.campaign.edges)));
    } else {
      this.setCanvasScope(this.activeScopeFolderId);
    }

    return { addedCount };
  }

  syncWikilinksForNode(nodeId: string, content: string, combatStats?: CombatStats) {
    this.recordSnapshot();
    this.syncCurrentNodesToMaster();

    const allNodes = this.campaign.nodes || [];
    const sourceNode = allNodes.find((n) => n.id === nodeId);
    if (!sourceNode) return;

    sourceNode.data.content = content;
    sourceNode.data.description = content;
    if (combatStats) {
      sourceNode.data.combatStats = { ...combatStats };
    }

    const { addedCount } = this.syncWikilinksForNodeInternal(nodeId, content);

    const extractedTitles = extractWikilinkTargets(content);
    this.nodes.update((list) =>
      list.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              content,
              description: content,
              combatStats: combatStats || n.data.combatStats,
              wikilinks: extractedTitles,
            },
          };
        }
        return n;
      })
    );

    this.markDirty();
  }

  /**
   * Scans all notes/cards across the campaign for [[wikilinks]] and automatically connects them.
   * Returns stats about newly created connections and total discovered references.
   */
  scanAllWikilinkConnections(): { created: number; totalFound: number } {
    this.recordSnapshot();
    this.syncCurrentNodesToMaster();

    let created = 0;
    let totalFound = 0;

    const allNodes = this.campaign.nodes || [];
    for (const node of allNodes) {
      const text = (node.data?.content || '') + ' ' + (node.data?.description || '');
      if (text.includes('[[')) {
        const found = extractWikilinkTargets(text);
        totalFound += found.length;
        const res = this.syncWikilinksForNodeInternal(node.id, text);
        created += res.addedCount;
      }
    }

    this.markDirty();
    return { created, totalFound };
  }

  /**
   * Automatically updates all wikilinks, references, and connections across all documents,
   * notes, and canvas entities when a note/file/entity is renamed.
   */
  updateWikilinkReferences(oldName: string, newName: string, nodeId?: string) {
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanOld || !cleanNew || cleanOld.toLowerCase() === cleanNew.toLowerCase()) {
      return;
    }

    const oldLower = cleanOld.toLowerCase();
    let anyNodeUpdated = false;

    // 1. Update all campaign nodes (content, description, attached notes, wikilinks array)
    const updatedNodes = (this.campaign.nodes || []).map((node) => {
      let nodeChanged = false;
      let newContent = node.data.content || '';
      let newDescription = node.data.description || '';

      if (newContent.includes('[[')) {
        const replaced = replaceWikilinkTarget(newContent, cleanOld, cleanNew);
        if (replaced !== newContent) {
          newContent = replaced;
          nodeChanged = true;
        }
      }

      if (newDescription.includes('[[')) {
        const replaced = replaceWikilinkTarget(newDescription, cleanOld, cleanNew);
        if (replaced !== newDescription) {
          newDescription = replaced;
          nodeChanged = true;
        }
      }

      // Attached sub-notes
      let newNotes = node.data.notes;
      if (Array.isArray(node.data.notes) && node.data.notes.length > 0) {
        let notesChanged = false;
        const mappedNotes = node.data.notes.map((attached) => {
          let aChanged = false;
          let aContent = attached.content || '';
          let aTitle = attached.title || '';
          if (aContent.includes('[[')) {
            const r = replaceWikilinkTarget(aContent, cleanOld, cleanNew);
            if (r !== aContent) {
              aContent = r;
              aChanged = true;
            }
          }
          if (aTitle.includes('[[')) {
            const r = replaceWikilinkTarget(aTitle, cleanOld, cleanNew);
            if (r !== aTitle) {
              aTitle = r;
              aChanged = true;
            }
          }
          if (aChanged) {
            notesChanged = true;
            return { ...attached, content: aContent, title: aTitle };
          }
          return attached;
        });
        if (notesChanged) {
          newNotes = mappedNotes;
          nodeChanged = true;
        }
      }

      // Wikilinks array
      let newWikilinks = node.data.wikilinks;
      if (nodeChanged || Array.isArray(node.data.wikilinks)) {
        newWikilinks = extractWikilinkTargets(newContent);
      }

      if (nodeChanged) {
        anyNodeUpdated = true;
        const updatedData: EntityNodeData = {
          ...node.data,
          content: newContent,
          description: newDescription,
          notes: newNotes,
          wikilinks: newWikilinks,
        };
        return {
          ...node,
          data: updatedData,
        };
      }
      return node;
    });

    if (anyNodeUpdated) {
      this.campaign.nodes = updatedNodes;
      this.nodes.set(JSON.parse(JSON.stringify(updatedNodes)));
      if (this.selectedEntity) {
        const matching = updatedNodes.find((n) => n.id === this.selectedEntity?.id);
        if (matching) {
          this.selectedEntity = { ...matching.data };
        }
      }
    }

    // 2. Update Lore entries if they contain wikilinks
    if (Array.isArray(this.campaign.lore)) {
      this.campaign.lore = this.campaign.lore.map((item) => {
        let changed = false;
        let cContent = item.content || '';
        let cTitle = item.title || '';
        if (cContent.includes('[[')) {
          const r = replaceWikilinkTarget(cContent, cleanOld, cleanNew);
          if (r !== cContent) {
            cContent = r;
            changed = true;
          }
        }
        if (cTitle.includes('[[')) {
          const r = replaceWikilinkTarget(cTitle, cleanOld, cleanNew);
          if (r !== cTitle) {
            cTitle = r;
            changed = true;
          }
        }
        return changed ? { ...item, content: cContent, title: cTitle } : item;
      });
    }

    // 3. Update Timeline markers
    if (Array.isArray(this.campaign.timeline)) {
      this.campaign.timeline = this.campaign.timeline.map((marker) => {
        let changed = false;
        let mNotes = marker.notes || '';
        let mText = marker.sessionText || '';
        if (mNotes.includes('[[')) {
          const r = replaceWikilinkTarget(mNotes, cleanOld, cleanNew);
          if (r !== mNotes) {
            mNotes = r;
            changed = true;
          }
        }
        if (mText.includes('[[')) {
          const r = replaceWikilinkTarget(mText, cleanOld, cleanNew);
          if (r !== mText) {
            mText = r;
            changed = true;
          }
        }
        return changed ? { ...marker, notes: mNotes, sessionText: mText } : marker;
      });
    }

    // 4. Update Map Pins
    if (Array.isArray(this.campaign.maps)) {
      this.campaign.maps.forEach((map) => {
        if (Array.isArray(map.pins)) {
          map.pins.forEach((pin) => {
            if (nodeId && pin.targetNodeId === nodeId) {
              if (pin.label.toLowerCase() === oldLower) {
                pin.label = cleanNew;
              }
              if (pin.title && pin.title.toLowerCase() === oldLower) {
                pin.title = cleanNew;
              }
            }
            if (pin.notes && pin.notes.includes('[[')) {
              pin.notes = replaceWikilinkTarget(pin.notes, cleanOld, cleanNew);
            }
          });
        }
      });
    }

    // 5. Update Canvas Edges
    if (Array.isArray(this.campaign.edges)) {
      let edgesChanged = false;
      this.campaign.edges.forEach((edge) => {
        const edgeData = edge.data as CanvasRelationEdgeData | undefined;
        if (edgeData) {
          if (typeof edgeData.notes === 'string' && edgeData.notes.includes('[[')) {
            const r = replaceWikilinkTarget(edgeData.notes, cleanOld, cleanNew);
            if (r !== edgeData.notes) {
              edgeData.notes = r;
              edgesChanged = true;
            }
          }
          if (typeof edgeData.label === 'string' && edgeData.label.includes('[[')) {
            const r = replaceWikilinkTarget(edgeData.label, cleanOld, cleanNew);
            if (r !== edgeData.label) {
              edgeData.label = r;
              edgesChanged = true;
            }
          }
        }
      });
      if (edgesChanged && this.edges) {
        this.edges.set(JSON.parse(JSON.stringify(this.campaign.edges)));
      }
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

  // ---------------------------------------------------------------------------
  // Atlas & Map Actions
  // ---------------------------------------------------------------------------

  setActiveMap(mapId: string | null) {
    this.activeMapId = mapId;
  }

  addMap(title: string, imageUrl: string, gridSize: number = 50): MapData {
    this.recordSnapshot();
    const newMap: MapData = {
      id: `map-${Date.now()}`,
      title: title.trim() || 'Novo Mapa',
      name: title.trim() || 'Novo Mapa',
      imageUrl: imageUrl.trim(),
      gridSize,
      pins: [],
    };
    this.campaign.maps = [...(this.campaign.maps || []), newMap];
    this.activeMapId = newMap.id;
    this.markDirty();
    return newMap;
  }

  updateMap(mapId: string, updates: Partial<MapData>) {
    this.recordSnapshot();
    this.campaign.maps = (this.campaign.maps || []).map((m) => {
      if (m.id === mapId) {
        const title = updates.title !== undefined ? updates.title.trim() : (updates.name !== undefined ? updates.name.trim() : m.title);
        return {
          ...m,
          ...updates,
          title: title || m.title || 'Mapa Sem Nome',
          name: title || m.name || 'Mapa Sem Nome',
        };
      }
      return m;
    });
    this.markDirty();
  }

  deleteMap(mapId: string) {
    this.recordSnapshot();
    const remaining = (this.campaign.maps || []).filter((m) => m.id !== mapId);
    this.campaign.maps = remaining;
    if (this.activeMapId === mapId) {
      this.activeMapId = remaining.length > 0 ? remaining[0].id : null;
    }
    this.markDirty();
  }

  addMapPin(
    mapId: string,
    pinData: {
      targetNodeId?: string;
      label: string;
      xPercent: number;
      yPercent: number;
      color?: string;
      notes?: string;
      category?: MapPin['category'];
    }
  ): MapPin {
    this.recordSnapshot();
    const newPin: MapPin = {
      id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mapId,
      targetNodeId: pinData.targetNodeId || undefined,
      label: pinData.label.trim() || 'Marcador',
      title: pinData.label.trim() || 'Marcador',
      xPercent: Math.max(0, Math.min(100, pinData.xPercent)),
      yPercent: Math.max(0, Math.min(100, pinData.yPercent)),
      color: pinData.color,
      notes: pinData.notes,
      category: pinData.category || 'location',
    };
    this.campaign.maps = (this.campaign.maps || []).map((m) => {
      if (m.id === mapId) {
        return {
          ...m,
          pins: [...(m.pins || []), newPin],
        };
      }
      return m;
    });
    this.markDirty();
    return newPin;
  }

  updateMapPin(mapId: string, pinId: string, updates: Partial<MapPin>) {
    this.recordSnapshot();
    this.campaign.maps = (this.campaign.maps || []).map((m) => {
      if (m.id === mapId) {
        return {
          ...m,
          pins: (m.pins || []).map((p) => {
            if (p.id === pinId) {
              const label = updates.label !== undefined ? updates.label.trim() : (updates.title !== undefined ? updates.title.trim() : p.label);
              return {
                ...p,
                ...updates,
                label: label || p.label,
                title: label || p.title,
                targetNodeId: updates.targetNodeId !== undefined ? (updates.targetNodeId || undefined) : p.targetNodeId,
              };
            }
            return p;
          }),
        };
      }
      return m;
    });
    this.markDirty();
  }

  deleteMapPin(mapId: string, pinId: string) {
    this.recordSnapshot();
    this.campaign.maps = (this.campaign.maps || []).map((m) => {
      if (m.id === mapId) {
        return {
          ...m,
          pins: (m.pins || []).filter((p) => p.id !== pinId),
        };
      }
      return m;
    });
    this.markDirty();
  }
}

export const campaignStore = new CampaignStore();
