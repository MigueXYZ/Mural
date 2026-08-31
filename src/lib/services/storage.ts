/**
 * Mural (OrdemTools) - Local-First Storage & Persistence Service
 * Dual-engine persistence: Tauri v2 File System & Native Dialogs on Desktop,
 * IndexedDB & localStorage on Web, 500ms Debounced Auto-Save with Dirty Tracking,
 * Versioned Schema v1.0.0, Rolling Backup Snapshot Ring (5 max), and Schema Migration.
 */

import type {
  CampaignData,
  CampaignSummary,
  EntityNodeData,
  ThreatClock,
  LoreEntry,
  TimelineMarker,
  MapData,
  CampaignSettings,
} from '../types';
import type { Node, Edge } from '@xyflow/svelte';

// ============================================================================
// 1. Interfaces & Types
// ============================================================================

export type AutoSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface AutoSaveState {
  status: AutoSaveStatus;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  lastError: string | null;
}

export interface BackupSnapshotInfo {
  id: string;
  campaignId: string;
  timestamp: number;
  formattedDate: string;
  filePath?: string;
  sizeBytes?: number;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  data?: CampaignData;
}

export interface IStorageService {
  saveCampaign(campaign: CampaignData, explicitPath?: string): Promise<string>;
  loadCampaign(idOrPath: string): Promise<CampaignData>;
  listCampaigns(): Promise<CampaignSummary[]>;
  exportCampaignFile(campaign: CampaignData, defaultPath?: string): Promise<string>;
  importCampaignFile(fileContentOrPath?: string): Promise<CampaignData>;
  duplicateCampaign(sourceIdOrCampaign: string | CampaignData, newName?: string): Promise<CampaignData>;
  deleteCampaign(id: string): Promise<void>;
  createBackupSnapshot(campaign: CampaignData): Promise<string>;
  listBackupSnapshots(campaignId: string): Promise<BackupSnapshotInfo[]>;
  restoreBackupSnapshot(campaignId: string, snapshotIdOrPath: string): Promise<CampaignData>;
}

// ============================================================================
// 2. Schema Validation & Legacy Migration Engine
// ============================================================================

export const SCHEMA_VERSION = '1.0.0';

export function validateCampaignSchema(raw: unknown): SchemaValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Input is not a valid JSON object'] };
  }

  const obj = raw as Record<string, any>;

  if (!obj.name || typeof obj.name !== 'string' || !obj.name.trim()) {
    errors.push('Missing or invalid campaign "name"');
  }
  if (!Array.isArray(obj.nodes)) {
    errors.push('"nodes" must be an array');
  }
  if (!Array.isArray(obj.edges)) {
    errors.push('"edges" must be an array');
  }
  if (!Array.isArray(obj.clocks)) {
    errors.push('"clocks" must be an array');
  }
  if (!Array.isArray(obj.lore)) {
    errors.push('"lore" must be an array');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const nowIso = new Date().toISOString();
  const data: CampaignData = {
    id: obj.id || `camp-${Date.now()}`,
    name: String(obj.name).trim(),
    system: obj.system || 'Ordem Paranormal',
    currentSession: typeof obj.currentSession === 'number' ? obj.currentSession : 1,
    inGamePeriod: obj.inGamePeriod || 'Presente',
    description: obj.description || '',
    createdAt: obj.createdAt || Date.now(),
    updatedAt: obj.updatedAt || nowIso,
    version: SCHEMA_VERSION,
    nodes: obj.nodes || [],
    edges: obj.edges || [],
    clocks: obj.clocks || [],
    lore: obj.lore || [],
    timeline: obj.timeline || [{ id: 't-1', sessionNumber: 1, sessionText: 'Sessão 1', isCurrent: true }],
    maps: obj.maps || [],
    settings: obj.settings || {
      aiProvider: 'gemini',
      theme: 'dark',
      autoSaveIntervalMs: 500,
    },
  };

  return { valid: true, errors: [], data };
}

export function migrateLegacyCampaign(raw: unknown): CampaignData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Formato de ficheiro inválido. O conteúdo não é um objeto JSON.');
  }

  const obj = raw as Record<string, any>;
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'Campanha Sem Título';

  const nodes: Node<EntityNodeData>[] = Array.isArray(obj.nodes)
    ? obj.nodes.map((node: any) => {
        const type = node.data?.type || node.data?.category || 'npc';
        const color =
          node.data?.color ||
          node.data?.colorTheme ||
          (type === 'npc' ? '#d4a359' : type === 'faction' ? '#a855f7' : type === 'location' ? '#38bdf8' : '#f87171');
        const isSecret = Boolean(node.data?.isSecret || type === 'secret');

        return {
          id: node.id || `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: node.type || 'entityNode',
          position: node.position || { x: 200, y: 150 },
          data: {
            id: node.id || `node-${Date.now()}`,
            type,
            category: type,
            title: node.data?.title || 'Entidade',
            subtitle: node.data?.subtitle || type.toUpperCase(),
            description: node.data?.description || '',
            tags: Array.isArray(node.data?.tags) ? node.data.tags : [],
            isSecret,
            revealed: node.data?.revealed ?? !isSecret,
            color,
            colorTheme: color,
            icon: node.data?.icon,
            statusText: node.data?.statusText,
          },
        };
      })
    : [];

  const edges = Array.isArray(obj.edges)
    ? obj.edges.map((edge: any) => ({
        id: edge.id || `e-${edge.source}-${edge.target}-${Date.now()}`,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'smoothstep',
        label: edge.label || edge.data?.label || 'ligação',
        data: {
          label: edge.data?.label || edge.label || 'ligação',
          relationType: edge.data?.relationType || 'neutral',
          pathType: edge.data?.pathType || edge.type || 'smoothstep',
          bidirectional: Boolean(edge.data?.bidirectional),
          notes: edge.data?.notes || '',
          color: edge.data?.color,
        },
      }))
    : [];

  const clocks: ThreatClock[] = Array.isArray(obj.clocks)
    ? obj.clocks.map((clock: any) => ({
        id: clock.id || `clock-${Date.now()}`,
        title: clock.title || 'Ameaça',
        totalSegments: [4, 6, 8, 10, 12].includes(clock.totalSegments) ? clock.totalSegments : 6,
        filledSegments: Math.max(0, Math.min(clock.totalSegments || 6, clock.filledSegments || 0)),
        consequence: clock.consequence || clock.consequenceText,
        category: clock.category || 'threat',
        createdAt: clock.createdAt || Date.now(),
      }))
    : [];

  const lore: LoreEntry[] = Array.isArray(obj.lore)
    ? obj.lore.map((item: any) => ({
        id: item.id || `lore-${Date.now()}`,
        title: item.title,
        content: item.content || item.description || '',
        status: item.status === 'SABIDO' ? 'SABIDO' : 'SEGREDO',
        visibility: item.visibility || item.status || 'SEGREDO',
        sessionNumber: typeof item.sessionNumber === 'number' ? item.sessionNumber : 1,
        associatedNodeIds: Array.isArray(item.associatedNodeIds) ? item.associatedNodeIds : [],
        tags: Array.isArray(item.tags) ? item.tags : [],
        createdAt: item.createdAt || Date.now(),
        updatedAt: item.updatedAt || Date.now(),
      }))
    : [];

  const timeline: TimelineMarker[] =
    Array.isArray(obj.timeline) && obj.timeline.length > 0
      ? obj.timeline.map((tm: any, idx: number) => ({
          id: tm.id || `tm-${idx + 1}`,
          sessionNumber: typeof tm.sessionNumber === 'number' ? tm.sessionNumber : idx + 1,
          sessionText: tm.sessionText || `Sessão ${idx + 1}`,
          title: tm.title,
          description: tm.description,
          inGameDate: tm.inGameDate,
          isCurrent: Boolean(tm.isCurrent),
          label: tm.label,
          timestamp: tm.timestamp || Date.now(),
        }))
      : [{ id: 't-1', sessionNumber: 1, sessionText: 'Sessão 1', isCurrent: true }];

  return {
    id: obj.id || `camp-${Date.now()}`,
    name,
    system: obj.system || 'Ordem Paranormal',
    currentSession: typeof obj.currentSession === 'number' ? obj.currentSession : 1,
    inGamePeriod: obj.inGamePeriod || 'Presente',
    description: obj.description || '',
    createdAt: obj.createdAt || Date.now(),
    updatedAt: new Date().toISOString(),
    version: SCHEMA_VERSION,
    nodes,
    edges,
    clocks,
    lore,
    timeline,
    maps: obj.maps || [],
    settings: obj.settings || {
      aiProvider: 'gemini',
      theme: 'dark',
      autoSaveIntervalMs: 500,
    },
  };
}

export function duplicateCampaign(source: CampaignData, newName?: string): CampaignData {
  const clone: CampaignData = JSON.parse(JSON.stringify(source));
  const newId = `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  clone.id = newId;
  clone.name = newName || `${source.name} (Cópia)`;
  clone.updatedAt = new Date().toISOString();
  clone.createdAt = Date.now();
  return clone;
}

export function rotateBackupSnapshots(existingBackups: string[], newBackup: string, maxLimit = 5): string[] {
  const combined = [newBackup, ...existingBackups];
  return combined.slice(0, maxLimit);
}

// ============================================================================
// 3. Web Storage Engine (IndexedDB + localStorage Fallback)
// ============================================================================

class WebIndexedDbAdapter {
  private dbName = 'MuralDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  private async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB is not supported in this environment.'));
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('campaigns')) {
          db.createObjectStore('campaigns', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('backups')) {
          const backupStore = db.createObjectStore('backups', { keyPath: 'id' });
          backupStore.createIndex('campaignId', 'campaignId', { unique: false });
          backupStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB.'));
      };
    });

    return this.initPromise;
  }

  async putCampaign(campaign: CampaignData): Promise<void> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('campaigns', 'readwrite');
        const store = tx.objectStore('campaigns');
        const req = store.put(campaign);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to localStorage
      if (typeof localStorage !== 'undefined') {
        const json = JSON.stringify(campaign);
        localStorage.setItem(`mural_campaign_${campaign.id}`, json);
        this.updateLocalStorageIndex(campaign);
      }
    }
  }

  async getCampaign(id: string): Promise<CampaignData | null> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('campaigns', 'readonly');
        const store = tx.objectStore('campaigns');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(`mural_campaign_${id}`);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }

  async getAllCampaigns(): Promise<CampaignData[]> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('campaigns', 'readonly');
        const store = tx.objectStore('campaigns');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      const list: CampaignData[] = [];
      if (typeof localStorage === 'undefined') return list;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mural_campaign_')) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) list.push(JSON.parse(raw));
          } catch {
            // ignore malformed
          }
        }
      }
      return list;
    }
  }

  async deleteCampaign(id: string): Promise<void> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('campaigns', 'readwrite');
        const store = tx.objectStore('campaigns');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`mural_campaign_${id}`);
      }
    }
  }

  async addBackup(campaignId: string, data: CampaignData): Promise<string> {
    const timestamp = Date.now();
    const backupId = `${campaignId}_backup_${timestamp}`;
    const record = {
      id: backupId,
      campaignId,
      timestamp,
      data,
    };

    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('backups', 'readwrite');
        const store = tx.objectStore('backups');
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      await this.pruneBackups(campaignId, 5);
      return backupId;
    } catch {
      if (typeof localStorage !== 'undefined') {
        const key = `mural_backups_${campaignId}`;
        const existingRaw = localStorage.getItem(key);
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        const updated = rotateBackupSnapshots(existing, JSON.stringify(record), 5);
        localStorage.setItem(key, JSON.stringify(updated));
      }
      return backupId;
    }
  }

  async getBackups(campaignId: string): Promise<BackupSnapshotInfo[]> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('backups', 'readonly');
        const store = tx.objectStore('backups');
        const index = store.index('campaignId');
        const req = index.getAll(campaignId);
        req.onsuccess = () => {
          const results = (req.result || []).map((r: any) => ({
            id: r.id,
            campaignId: r.campaignId,
            timestamp: r.timestamp,
            formattedDate: new Date(r.timestamp).toLocaleString('pt-PT'),
          }));
          results.sort((a, b) => b.timestamp - a.timestamp);
          resolve(results);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      if (typeof localStorage === 'undefined') return [];
      const key = `mural_backups_${campaignId}`;
      const existingRaw = localStorage.getItem(key);
      if (!existingRaw) return [];
      const list = JSON.parse(existingRaw);
      return list.map((itemStr: string) => {
        const item = JSON.parse(itemStr);
        return {
          id: item.id,
          campaignId: item.campaignId,
          timestamp: item.timestamp,
          formattedDate: new Date(item.timestamp).toLocaleString('pt-PT'),
        };
      });
    }
  }

  async getBackupData(backupId: string): Promise<CampaignData | null> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('backups', 'readonly');
        const store = tx.objectStore('backups');
        const req = store.get(backupId);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      if (typeof localStorage === 'undefined') return null;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mural_backups_')) {
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          for (const itemStr of list) {
            const item = JSON.parse(itemStr);
            if (item.id === backupId) return item.data;
          }
        }
      }
      return null;
    }
  }

  private async pruneBackups(campaignId: string, maxLimit = 5): Promise<void> {
    try {
      const db = await this.getDb();
      const tx = db.transaction('backups', 'readwrite');
      const store = tx.objectStore('backups');
      const index = store.index('campaignId');
      const req = index.getAll(campaignId);

      req.onsuccess = () => {
        const items = req.result || [];
        if (items.length > maxLimit) {
          items.sort((a: any, b: any) => b.timestamp - a.timestamp);
          const toDelete = items.slice(maxLimit);
          for (const old of toDelete) {
            store.delete(old.id);
          }
        }
      };
    } catch {
      // Ignored
    }
  }

  private updateLocalStorageIndex(campaign: CampaignData) {
    if (typeof localStorage === 'undefined') return;
    try {
      const indexRaw = localStorage.getItem('mural_campaigns_index') || '[]';
      const index: CampaignSummary[] = JSON.parse(indexRaw);
      const summary: CampaignSummary = {
        id: campaign.id,
        name: campaign.name,
        system: campaign.system,
        currentSession: campaign.currentSession,
        inGamePeriod: campaign.inGamePeriod,
        description: campaign.description,
        updatedAt: typeof campaign.updatedAt === 'string' ? campaign.updatedAt : new Date().toISOString(),
        nodeCount: campaign.nodes.length,
        clockCount: campaign.clocks.length,
        loreCount: campaign.lore.length,
      };
      const existingIdx = index.findIndex((c) => c.id === campaign.id);
      if (existingIdx >= 0) {
        index[existingIdx] = summary;
      } else {
        index.unshift(summary);
      }
      localStorage.setItem('mural_campaigns_index', JSON.stringify(index));
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// 4. Master Storage Service Implementation
// ============================================================================

export class StorageService implements IStorageService {
  private webDb = new WebIndexedDbAdapter();
  private lastBackupTimeMap = new Map<string, number>();

  isTauri(): boolean {
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  }

  private async getTauriCampaignsDir(): Promise<string> {
    const { appDataDir } = await import('@tauri-apps/api/path');
    const { exists, mkdir } = await import('@tauri-apps/plugin-fs');

    const appDir = await appDataDir();
    const campaignsDir = `${appDir}/mural/campaigns`.replace(/\\/g, '/');
    if (!(await exists(campaignsDir))) {
      await mkdir(campaignsDir, { recursive: true });
    }
    return campaignsDir;
  }

  private async getTauriBackupsDir(campaignId: string): Promise<string> {
    const { appDataDir } = await import('@tauri-apps/api/path');
    const { exists, mkdir } = await import('@tauri-apps/plugin-fs');

    const appDir = await appDataDir();
    const backupDir = `${appDir}/mural/backups/${campaignId}`.replace(/\\/g, '/');
    if (!(await exists(backupDir))) {
      await mkdir(backupDir, { recursive: true });
    }
    return backupDir;
  }

  async saveCampaign(campaign: CampaignData, explicitPath?: string): Promise<string> {
    const now = new Date().toISOString();
    const payload: CampaignData = {
      ...campaign,
      updatedAt: now,
      version: SCHEMA_VERSION,
    };

    const json = JSON.stringify(payload, null, 2);

    if (this.isTauri()) {
      try {
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        let targetPath = explicitPath;

        if (!targetPath) {
          const campaignsDir = await this.getTauriCampaignsDir();
          targetPath = `${campaignsDir}/${payload.id}.mural`;
        }

        await writeTextFile(targetPath, json);

        // Auto backup snapshot every 2 minutes
        const lastBackup = this.lastBackupTimeMap.get(payload.id) || 0;
        if (Date.now() - lastBackup > 120_000) {
          await this.createBackupSnapshot(payload);
          this.lastBackupTimeMap.set(payload.id, Date.now());
        }

        return targetPath;
      } catch (err: any) {
        console.error('[StorageService] Tauri FS Save failed, falling back to Web DB:', err);
        await this.webDb.putCampaign(payload);
        return `indexeddb://${payload.id}`;
      }
    } else {
      await this.webDb.putCampaign(payload);
      const lastBackup = this.lastBackupTimeMap.get(payload.id) || 0;
      if (Date.now() - lastBackup > 120_000) {
        await this.createBackupSnapshot(payload);
        this.lastBackupTimeMap.set(payload.id, Date.now());
      }
      return `indexeddb://${payload.id}`;
    }
  }

  async loadCampaign(idOrPath: string): Promise<CampaignData> {
    if (
      this.isTauri() &&
      (idOrPath.includes('/') || idOrPath.includes('\\') || idOrPath.endsWith('.mural') || idOrPath.endsWith('.json'))
    ) {
      try {
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        const content = await readTextFile(idOrPath);
        const parsed = JSON.parse(content);
        return migrateLegacyCampaign(parsed);
      } catch (e: any) {
        console.warn(`[StorageService] Failed to read from path ${idOrPath}, checking WebDB:`, e);
      }
    }

    const found = await this.webDb.getCampaign(idOrPath);
    if (found) {
      return migrateLegacyCampaign(found);
    }

    if (this.isTauri()) {
      try {
        const campaignsDir = await this.getTauriCampaignsDir();
        const fullPath = `${campaignsDir}/${idOrPath}.mural`;
        const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
        if (await exists(fullPath)) {
          const content = await readTextFile(fullPath);
          const parsed = JSON.parse(content);
          return migrateLegacyCampaign(parsed);
        }
      } catch (err) {
        console.error('[StorageService] Error loading from Tauri campaigns folder:', err);
      }
    }

    throw new Error(`Campanha com ID ou caminho "${idOrPath}" não encontrada.`);
  }

  async listCampaigns(): Promise<CampaignSummary[]> {
    const summaryMap = new Map<string, CampaignSummary>();

    if (this.isTauri()) {
      try {
        const campaignsDir = await this.getTauriCampaignsDir();
        const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs');
        const entries = await readDir(campaignsDir);

        for (const entry of entries) {
          if (entry.name && (entry.name.endsWith('.mural') || entry.name.endsWith('.json'))) {
            try {
              const filePath = `${campaignsDir}/${entry.name}`;
              const content = await readTextFile(filePath);
              const parsed = JSON.parse(content);
              if (parsed && parsed.name) {
                summaryMap.set(parsed.id || entry.name, {
                  id: parsed.id || entry.name,
                  name: parsed.name,
                  system: parsed.system || 'Ordem Paranormal',
                  currentSession: parsed.currentSession || 1,
                  inGamePeriod: parsed.inGamePeriod || 'Presente',
                  description: parsed.description || '',
                  updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : 'Recentemente',
                  nodeCount: Array.isArray(parsed.nodes) ? parsed.nodes.length : 0,
                  clockCount: Array.isArray(parsed.clocks) ? parsed.clocks.length : 0,
                  loreCount: Array.isArray(parsed.lore) ? parsed.lore.length : 0,
                });
              }
            } catch {
              // Ignore corrupted entry
            }
          }
        }
      } catch (err) {
        console.warn('[StorageService] Error reading Tauri directory:', err);
      }
    }

    try {
      const webCampaigns = await this.webDb.getAllCampaigns();
      for (const camp of webCampaigns) {
        if (!summaryMap.has(camp.id)) {
          summaryMap.set(camp.id, {
            id: camp.id,
            name: camp.name,
            system: camp.system || 'Ordem Paranormal',
            currentSession: camp.currentSession || 1,
            inGamePeriod: camp.inGamePeriod || 'Presente',
            description: camp.description || '',
            updatedAt: typeof camp.updatedAt === 'string' ? camp.updatedAt : 'Recentemente',
            nodeCount: Array.isArray(camp.nodes) ? camp.nodes.length : 0,
            clockCount: Array.isArray(camp.clocks) ? camp.clocks.length : 0,
            loreCount: Array.isArray(camp.lore) ? camp.lore.length : 0,
          });
        }
      }
    } catch {
      // Ignore webDb error
    }

    return Array.from(summaryMap.values());
  }

  async exportCampaignFile(campaign: CampaignData, defaultPath?: string): Promise<string> {
    const json = JSON.stringify(campaign, null, 2);
    const sanitizedName = campaign.name.replace(/[\\/:*?"<>|]+/g, '_').toLowerCase().trim() || 'campanha';
    const filename = `${sanitizedName}.mural`;

    if (this.isTauri()) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

        const chosenPath = await save({
          defaultPath: defaultPath || filename,
          filters: [
            { name: 'Campanha Mural (*.mural)', extensions: ['mural'] },
            { name: 'Ficheiro JSON (*.json)', extensions: ['json'] },
          ],
        });

        if (chosenPath) {
          await writeTextFile(chosenPath, json);
          return chosenPath;
        }
        return '';
      } catch (e) {
        console.warn('[StorageService] Tauri export dialog error, using web fallback:', e);
      }
    }

    if (typeof document !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      return filename;
    }

    return '';
  }

  async importCampaignFile(fileContentOrPath?: string): Promise<CampaignData> {
    let rawContent = '';

    if (this.isTauri() && !fileContentOrPath) {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');

      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Campanha Mural', extensions: ['mural', 'json'] },
          { name: 'Todos os Ficheiros', extensions: ['*'] },
        ],
      });

      if (!selected || typeof selected !== 'string') {
        throw new Error('Nenhum ficheiro selecionado para importação.');
      }

      rawContent = await readTextFile(selected);
    } else if (fileContentOrPath) {
      if (fileContentOrPath.trim().startsWith('{')) {
        rawContent = fileContentOrPath;
      } else if (this.isTauri()) {
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        rawContent = await readTextFile(fileContentOrPath);
      } else {
        rawContent = fileContentOrPath;
      }
    } else {
      throw new Error('Conteúdo ou caminho de importação inválido.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e: any) {
      throw new Error(`Erro de sintaxe JSON: O ficheiro não é um JSON válido. (${e.message})`);
    }

    const campaign = migrateLegacyCampaign(parsed);
    await this.saveCampaign(campaign);
    return campaign;
  }

  async duplicateCampaign(sourceIdOrCampaign: string | CampaignData, newName?: string): Promise<CampaignData> {
    let source: CampaignData;
    if (typeof sourceIdOrCampaign === 'string') {
      source = await this.loadCampaign(sourceIdOrCampaign);
    } else {
      source = sourceIdOrCampaign;
    }

    const duplicated = duplicateCampaign(source, newName);
    await this.saveCampaign(duplicated);
    return duplicated;
  }

  async deleteCampaign(id: string): Promise<void> {
    if (this.isTauri()) {
      try {
        const { exists, remove } = await import('@tauri-apps/plugin-fs');
        const campaignsDir = await this.getTauriCampaignsDir();
        const primaryPath = `${campaignsDir}/${id}.mural`;
        if (await exists(primaryPath)) {
          await remove(primaryPath);
        }

        const backupsDir = await this.getTauriBackupsDir(id);
        if (await exists(backupsDir)) {
          await remove(backupsDir, { recursive: true });
        }
      } catch (err) {
        console.warn('[StorageService] Error deleting from Tauri FS:', err);
      }
    }

    await this.webDb.deleteCampaign(id);
  }

  async createBackupSnapshot(campaign: CampaignData): Promise<string> {
    const timestamp = Date.now();
    const formattedIso = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
    const filename = `${campaign.id}_backup_${formattedIso}.mural`;

    if (this.isTauri()) {
      try {
        const { writeTextFile, readDir, remove } = await import('@tauri-apps/plugin-fs');
        const backupDir = await this.getTauriBackupsDir(campaign.id);
        const snapshotPath = `${backupDir}/${filename}`;

        await writeTextFile(snapshotPath, JSON.stringify(campaign, null, 2));

        const files = await readDir(backupDir);
        const backupFiles = files
          .filter((f) => f.name && f.name.includes('_backup_'))
          .sort((a, b) => (b.name || '').localeCompare(a.name || ''));

        if (backupFiles.length > 5) {
          const toRemove = backupFiles.slice(5);
          for (const item of toRemove) {
            if (item.name) {
              await remove(`${backupDir}/${item.name}`);
            }
          }
        }

        return snapshotPath;
      } catch (e) {
        console.warn('[StorageService] Tauri backup snapshot error, using webDb fallback:', e);
      }
    }

    return await this.webDb.addBackup(campaign.id, campaign);
  }

  async listBackupSnapshots(campaignId: string): Promise<BackupSnapshotInfo[]> {
    if (this.isTauri()) {
      try {
        const { readDir } = await import('@tauri-apps/plugin-fs');
        const backupDir = await this.getTauriBackupsDir(campaignId);
        const files = await readDir(backupDir);

        const snapshots: BackupSnapshotInfo[] = [];
        for (const file of files) {
          if (file.name && file.name.includes('_backup_')) {
            const filePath = `${backupDir}/${file.name}`;
            const parts = file.name.replace('.mural', '').split('_backup_');
            const dateStr = parts[1] || '';
            const approxTimestamp = new Date(dateStr.replace(/-/g, ':')).getTime() || Date.now();

            snapshots.push({
              id: file.name,
              campaignId,
              timestamp: approxTimestamp,
              formattedDate: new Date(approxTimestamp).toLocaleString('pt-PT'),
              filePath,
            });
          }
        }

        snapshots.sort((a, b) => b.timestamp - a.timestamp);
        return snapshots;
      } catch (err) {
        console.warn('[StorageService] Error listing Tauri backups:', err);
      }
    }

    return await this.webDb.getBackups(campaignId);
  }

  async restoreBackupSnapshot(campaignId: string, snapshotIdOrPath: string): Promise<CampaignData> {
    if (this.isTauri() && (snapshotIdOrPath.includes('/') || snapshotIdOrPath.includes('\\'))) {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const content = await readTextFile(snapshotIdOrPath);
      const parsed = JSON.parse(content);
      const restored = migrateLegacyCampaign(parsed);
      await this.saveCampaign(restored);
      return restored;
    }

    const data = await this.webDb.getBackupData(snapshotIdOrPath);
    if (!data) {
      throw new Error(`Backup snapshot "${snapshotIdOrPath}" não encontrado.`);
    }

    const restored = migrateLegacyCampaign(data);
    await this.saveCampaign(restored);
    return restored;
  }
}

export const storageService = new StorageService();

// ============================================================================
// 5. Reactive Debounced AutoSave Engine
// ============================================================================

export class AutoSaveEngine {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isSaving = false;
  private isDirty = false;
  private lastSavedAt: number | null = null;
  private lastError: string | null = null;
  private status: AutoSaveStatus = 'idle';
  private listeners: Set<(state: AutoSaveState) => void> = new Set();
  private pendingCampaign: CampaignData | null = null;

  constructor() {
    this.setupWindowHooks();
  }

  private setupWindowHooks() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.isDirty && this.pendingCampaign) {
          this.flushNow();
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && this.isDirty && this.pendingCampaign) {
          this.flushNow();
        }
      });
    }
  }

  getState(): AutoSaveState {
    return {
      status: this.status,
      isDirty: this.isDirty,
      isSaving: this.isSaving,
      lastSavedAt: this.lastSavedAt,
      lastError: this.lastError,
    };
  }

  subscribe(listener: (state: AutoSaveState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[AutoSaveEngine] Listener error:', e);
      }
    }
  }

  schedule(campaign: CampaignData, delayMs = 500) {
    this.pendingCampaign = campaign;
    this.isDirty = true;
    this.status = 'dirty';
    this.emit();

    if (this.timer) {
      clearTimeout(this.timer);
    }

    const interval = campaign.settings?.autoSaveIntervalMs ?? delayMs;

    this.timer = setTimeout(() => {
      this.flushNow();
    }, interval);
  }

  async flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.pendingCampaign || this.isSaving) return;

    const campaignToSave = this.pendingCampaign;
    this.isSaving = true;
    this.status = 'saving';
    this.emit();

    try {
      await storageService.saveCampaign(campaignToSave);
      this.isDirty = false;
      this.isSaving = false;
      this.lastSavedAt = Date.now();
      this.lastError = null;
      this.status = 'saved';
      this.emit();

      setTimeout(() => {
        if (this.status === 'saved' && !this.isDirty) {
          this.status = 'idle';
          this.emit();
        }
      }, 2500);
    } catch (err: any) {
      this.isSaving = false;
      this.lastError = err?.message || 'Erro ao guardar campanha';
      this.status = 'error';
      this.emit();
      console.error('[AutoSaveEngine] Auto-save error:', err);
    }
  }

  cancel() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isDirty = false;
    this.status = 'idle';
    this.emit();
  }
}

export const autoSaveEngine = new AutoSaveEngine();
