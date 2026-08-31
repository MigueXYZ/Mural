# Analysis & Architectural Blueprint: Campaign Management UI & Store Persistence Integration (M2.3)

**Document Version:** 1.0.0  
**Author:** Explorer M2.3 (`explorer_m2_3`)  
**Date:** 2026-08-31  
**Milestone:** M2 (Local-First Persistence & Campaign Management)  
**Target Files:**
- `src/lib/stores/campaignStore.svelte.ts` (Reactive Svelte 5 Runes store with debounced persistence)
- `src/lib/components/layout/Header.svelte` (Auto-save status badge, manual save `Ctrl+S`, menu toggle)
- `src/lib/components/menu/MainMenu.svelte` (Campaign hub, presets, search, import/export)
- `src/lib/components/menu/NewCampaignModal.svelte` (Modal wizard for campaign creation with presets)

---

## 1. Executive Summary & Component Architecture

Milestone M2 establishes the local-first persistence lifecycle of Mural (OrdemTools). The UI and store integration subsystem bridges the user interface with the underlying storage engine (`storage.ts`) and Tauri v2 filesystem backend (`@tauri-apps/plugin-fs`).

### 1.1 Core Objectives
1. **Seamless Reactive Autosave (500ms Debounce)**: Every mutation in canvas nodes, semantic edges, threat clocks, lore registry, and timeline markers automatically schedules a debounced save operation.
2. **Real-Time Visual Autosave Feedback**: The header provides continuous, non-intrusive feedback across 3 clear states: *Salvando...* (spinner), *Salvo há X min* (emerald checkmark with relative time), and *Modificado / Não Salvo* (amber pending indicator).
3. **Manual Save (`Ctrl+S` / `Cmd+S`)**: Instantaneous disk/storage flush bypassing the debounce delay.
4. **Hub & Campaign Management (`MainMenu.svelte`)**: Complete campaign lifecycle management (List, Search, Open, Duplicate, Export .mural/.json, Delete with confirmation, Import via native dialog or file input, and 4 instant starter presets).
5. **Streamlined New Campaign Modal (`NewCampaignModal.svelte`)**: Accessible modal for initializing campaigns with template presets (Blank Canvas, Paranormal Mystery, Faction Sandbox, One-Shot Tension).

### 1.2 Subsystem Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               USER INTERACTION LAYER                            │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────┐  │
│  │    MainMenu.svelte    │   │     Header.svelte     │   │ NewCampaignModal  │  │
│  │ (Hub, Presets, Import)│   │ (Save Badge, Ctrl+S)  │   │  (Preset Wizard)  │  │
│  └───────────┬───────────┘   └───────────┬───────────┘   └─────────┬─────────┘  │
└──────────────┼───────────────────────────┼─────────────────────────┼────────────┘
               │                           │                         │
               ▼                           ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           REACTIVE STORE ENGINE (Svelte 5)                      │
│  ┌──────────────────────────────────────┐   ┌────────────────────────────────┐  │
│  │      appState.svelte.ts              │   │   campaignStore.svelte.ts      │  │
│  │ - currentView ('menu' | 'campaign')  │   │ - campaign ($state)            │  │
│  │ - campaigns registry                 │   │ - nodes, edges (writables)     │  │
│  │ - searchFilter                       │   │ - isDirty, isSaving ($state)   │  │
│  │ - duplicate / delete handlers        │   │ - lastSavedAt ($state)         │  │
│  └──────────────────────────────────────┘   │ - scheduleAutoSave(500ms)      │  │
│                                             │ - saveCurrentCampaign()        │  │
│                                             └───────────────┬────────────────┘  │
└─────────────────────────────────────────────────────────────┼───────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         STORAGE SERVICE (storage.ts)                            │
│  ┌──────────────────────────────────────┐   ┌────────────────────────────────┐  │
│  │  Tauri v2 FS Engine (Desktop)        │   │  IndexedDB / LocalStorage (Web)│  │
│  │  - writeTextFile(<path>.mural)       │   │  - idb.put(campaign)           │  │
│  │  - createBackupSnapshot() (Ring of 5)│   │  - localStorage index          │  │
│  │  - Native Dialog open / save         │   │  - Blob download/upload        │  │
│  └──────────────────────────────────────┘   └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Design & Implementation Blueprints

### 2.1 `src/lib/stores/campaignStore.svelte.ts`

The `CampaignStore` is the central reactive orchestrator for active campaign state. It manages canvas nodes and edges (using Svelte stores as expected by `@xyflow/svelte`), threat clocks, lore registry, timeline markers, editing modal state, and the debounced auto-save engine.

#### Key Capabilities:
- **Dirty State Tracking**: `isDirty` (`boolean`), `isSaving` (`boolean`), `lastSavedAt` (`number | null`).
- **500ms Debounced Persistence**: `scheduleAutoSave()` clears existing debounce timers and saves after 500ms of inactivity.
- **Immediate Save (`saveCurrentCampaign`)**: Flushes dirty state immediately, writes to storage, updates `updatedAt` and `lastSavedAt`, and synchronizes with the `appState.campaigns` registry.
- **Auto-Save Initialization & Teardown**: Hooks window `beforeunload` to flush pending saves synchronously or before exit.
- **Safe State Reset & Loading**: `loadCampaign(data)` deep-clones data and resets dirty flags.

#### Complete Blueprint Code (`src/lib/stores/campaignStore.svelte.ts`):

```typescript
import { initialCampaign } from '../data/sampleCampaign';
import type {
  CampaignData,
  ThreatClock,
  LoreEntry,
  TimelineMarker,
  EntityNodeData,
  CanvasRelationEdgeData,
  CanvasRelationEdge,
} from '../types';
import type { Node, Edge } from '@xyflow/svelte';
import { writable, get } from 'svelte/store';
import { storageService } from '../services/storage';

class CampaignStore {
  // Active Campaign Reactive State
  campaign = $state<CampaignData>(initialCampaign);
  nodes = writable<Node<EntityNodeData>[]>(initialCampaign.nodes);
  edges = writable<Edge<CanvasRelationEdgeData>[]>(initialCampaign.edges as Edge<CanvasRelationEdgeData>[]);
  
  // Search & Selection State
  searchQuery = $state<string>('');
  selectedEntity = $state<EntityNodeData | null>(null);

  // Node & Edge Editing Modal State
  editingNode = $state<EntityNodeData | null>(null);
  editingEdge = $state<CanvasRelationEdge | null>(null);

  // Persistence & Autosave Reactive State
  isDirty = $state<boolean>(false);
  isSaving = $state<boolean>(false);
  lastSavedAt = $state<number | null>(null);

  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveIntervalMs = 500;
  private isInitialized = false;

  constructor() {
    this.initLifecycleHooks();
  }

  private initLifecycleHooks() {
    if (typeof window !== 'undefined' && !this.isInitialized) {
      this.isInitialized = true;
      // Flush pending save before closing the window or reloading
      window.addEventListener('beforeunload', () => {
        if (this.isDirty) {
          this.flushSync();
        }
      });
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

  async saveCurrentCampaign(): Promise<void> {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    this.isSaving = true;
    try {
      const payload = this.exportCurrentCampaign();
      await storageService.saveCampaign(payload);
      
      this.isDirty = false;
      this.lastSavedAt = Date.now();
      this.campaign.updatedAt = payload.updatedAt;
    } catch (err) {
      console.error('Failed to save campaign:', err);
    } finally {
      this.isSaving = false;
    }
  }

  private flushSync() {
    try {
      const payload = this.exportCurrentCampaign();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`mural_campaign_${payload.id}`, JSON.stringify(payload));
      }
    } catch (e) {
      console.warn('Failed to execute synchronous flush on unload:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Campaign Metadata Actions
  // ---------------------------------------------------------------------------

  updateCampaignDetails(details: { name?: string; system?: string; inGamePeriod?: string; description?: string }) {
    if (details.name !== undefined) this.campaign.name = details.name;
    if (details.system !== undefined) this.campaign.system = details.system;
    if (details.inGamePeriod !== undefined) this.campaign.inGamePeriod = details.inGamePeriod;
    if (details.description !== undefined) this.campaign.description = details.description;
    this.markDirty();
  }

  setSessionNumber(sessionNumber: number) {
    this.campaign.currentSession = sessionNumber;
    this.markDirty();
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
    this.nodes.update((list) => list.filter((n) => n.id !== id));
    this.edges.update((list) => list.filter((e) => e.source !== id && e.target !== id));
    if (this.editingNode?.id === id) {
      this.editingNode = null;
    }
    this.markDirty();
  }

  duplicateNode(id: string) {
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
        color: data.color || data.colorTheme || '#d4a359',
        colorTheme: data.colorTheme || data.color || '#d4a359',
        isSecret,
        revealed: !isSecret,
        tags: data.tags || [],
        icon: data.icon,
      },
    };
    this.nodes.update((list) => [...list, newNode]);
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
    this.edges.update((list) =>
      list.map((edge) => {
        if (edge.id === id) {
          return {
            ...edge,
            label: partial.label !== undefined ? partial.label : edge.label,
            data: {
              ...(edge.data || {
                label: 'ligação',
                relationType: 'neutral',
                pathType: 'smoothstep',
                bidirectional: false,
              }),
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
    this.edges.update((list) => list.filter((e) => e.id !== id));
    if (this.editingEdge?.id === id) {
      this.editingEdge = null;
    }
    this.markDirty();
  }

  addEdge(edge: Edge<CanvasRelationEdgeData>) {
    this.edges.update((list) => [...list, edge]);
    this.markDirty();
  }

  // ---------------------------------------------------------------------------
  // Clocks & Lore Helpers
  // ---------------------------------------------------------------------------

  addClock(title: string, totalSegments: 4 | 6 | 8 | 10 | 12 = 6, consequence = '') {
    const newClock: ThreatClock = {
      id: `clock-${Date.now()}`,
      title: title.trim() || 'Ameaça',
      totalSegments,
      filledSegments: 0,
      consequence: consequence.trim(),
      createdAt: Date.now(),
    };
    this.campaign.clocks = [...(this.campaign.clocks || []), newClock];
    this.markDirty();
  }

  deleteClock(clockId: string) {
    this.campaign.clocks = (this.campaign.clocks || []).filter((c) => c.id !== clockId);
    this.markDirty();
  }

  incrementClock(clockId: string) {
    const clock = this.campaign.clocks.find((c) => c.id === clockId);
    if (clock && clock.filledSegments < clock.totalSegments) {
      clock.filledSegments += 1;
      this.markDirty();
    }
  }

  decrementClock(clockId: string) {
    const clock = this.campaign.clocks.find((c) => c.id === clockId);
    if (clock && clock.filledSegments > 0) {
      clock.filledSegments -= 1;
      this.markDirty();
    }
  }

  toggleLoreStatus(loreId: string) {
    const item = this.campaign.lore.find((l) => l.id === loreId);
    if (item) {
      const newStatus = item.status === 'SABIDO' ? 'SEGREDO' : 'SABIDO';
      item.status = newStatus;
      item.visibility = newStatus;
      item.updatedAt = Date.now();
      this.markDirty();
    }
  }

  addLoreEntry(content: string, status: 'SABIDO' | 'SEGREDO' = 'SEGREDO', associatedNodeIds: string[] = []) {
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
    this.campaign.lore = (this.campaign.lore || []).filter((l) => l.id !== loreId);
    this.markDirty();
  }

  // ---------------------------------------------------------------------------
  // Timeline Actions
  // ---------------------------------------------------------------------------

  addTimelineMarker(title: string, sessionNumber: number, inGameDate?: string) {
    const newMarker: TimelineMarker = {
      id: `tm-${Date.now()}`,
      title: title.trim(),
      sessionNumber,
      sessionText: `Sessão ${sessionNumber}`,
      inGameDate,
      timestamp: Date.now(),
    };
    this.campaign.timeline = [...(this.campaign.timeline || []), newMarker];
    this.markDirty();
  }

  switchActiveSession(sessionNumber: number) {
    this.campaign.currentSession = sessionNumber;
    if (this.campaign.timeline) {
      this.campaign.timeline = this.campaign.timeline.map((tm) => ({
        ...tm,
        isCurrent: tm.sessionNumber === sessionNumber,
      }));
    }
    this.markDirty();
  }
}

export const campaignStore = new CampaignStore();
```

---

### 2.2 `src/lib/components/layout/Header.svelte`

The `Header` component serves as the command bar when working inside an active campaign.

#### Key Features:
1. **Auto-Save Status Badge**:
   - **Saving (`isSaving`)**: Amber spinning loader with text `"Salvando..."`.
   - **Modified (`isDirty` and not saving)**: Amber indicator dot with text `"Modificado"` or tooltip `"Alterações por guardar"`.
   - **Saved (`!isDirty` && `!isSaving`)**: Emerald checkmark with relative time (e.g. `"Salvo agora"`, `"Salvo há 2 min"`).
2. **Manual Save Button**:
   - Save icon (`Save` / `Check`) with shortcut hint `Ctrl+S`.
   - Clicking immediately calls `campaignStore.saveCurrentCampaign()`.
3. **Global `Ctrl+S` / `Cmd+S` Keyboard Listener**:
   - Traps key combination, prevents browser default download action, and flushes the save immediately.
4. **Campaign Metadata Display**:
   - Campaign Name (bold and clear).
   - Session Badge (`Sessão X`).
   - System Tag (e.g. `Ordem Paranormal`, `D&D 5e`).
5. **Quick Note & Menu Navigation**:
   - Menu button (`ArrowLeft`) returning to `appState.returnToMenu()`.
   - Quick Note modal trigger (`+ Nota rápida`).
   - Search bar filtering canvas entities.

#### Complete Blueprint Code (`src/lib/components/layout/Header.svelte`):

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { appState } from '../../stores/appState.svelte';
  import {
    Search,
    Plus,
    ArrowLeft,
    Download,
    Save,
    Check,
    Loader2,
    Clock,
    CircleDot,
  } from 'lucide-svelte';

  let isModalOpen = $state(false);
  let noteText = $state('');
  let currentTime = $state(Date.now());
  let timeInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    // Update relative time counter every 10 seconds
    timeInterval = setInterval(() => {
      currentTime = Date.now();
    }, 10000);
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
  });

  // Derived relative save status string
  const saveStatusText = $derived.by(() => {
    if (campaignStore.isSaving) {
      return 'Salvando...';
    }
    if (campaignStore.isDirty) {
      return 'Modificado';
    }
    if (!campaignStore.lastSavedAt) {
      return 'Salvo';
    }
    const elapsedSec = Math.floor((currentTime - campaignStore.lastSavedAt) / 1000);
    if (elapsedSec < 10) {
      return 'Salvo agora';
    }
    if (elapsedSec < 60) {
      return 'Salvo há segundos';
    }
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) {
      return `Salvo há ${elapsedMin} min`;
    }
    return `Salvo às ${new Date(campaignStore.lastSavedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  });

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      campaignStore.saveCurrentCampaign();
    }
  }

  function handleQuickNote() {
    if (noteText.trim()) {
      campaignStore.addLoreEntry(noteText.trim(), 'SEGREDO');
      noteText = '';
      isModalOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="h-14 border-b border-zinc-800/80 bg-zinc-950/90 px-4 flex items-center justify-between select-none backdrop-blur-md z-20 sticky top-0">
  <!-- Left info & Return to menu -->
  <div class="flex items-center gap-3">
    <button
      onclick={() => appState.returnToMenu()}
      title="Voltar ao Menu Principal"
      class="h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 flex items-center gap-1.5 text-xs font-medium transition cursor-pointer active:scale-95"
    >
      <ArrowLeft class="w-3.5 h-3.5" />
      <span>Menu</span>
    </button>

    <div class="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm shadow-inner">
      O
    </div>
    
    <div class="flex items-baseline gap-2 max-w-sm sm:max-w-md truncate">
      <h1 class="text-sm sm:text-base font-semibold text-zinc-100 tracking-wide truncate">
        {campaignStore.campaign.name}
      </h1>
      <span class="text-xs text-zinc-400 font-normal shrink-0">
        Sessão {campaignStore.campaign.currentSession}
      </span>
      <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono shrink-0 hidden sm:inline-block">
        {campaignStore.campaign.system}
      </span>
    </div>
  </div>

  <!-- Center Search -->
  <div class="w-72 sm:w-96 relative hidden md:block">
    <Search class="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
    <input
      type="text"
      placeholder="Procurar NPC, local, pista..."
      bind:value={campaignStore.searchQuery}
      class="w-full h-8 pl-9 pr-3 rounded-lg bg-zinc-900/90 border border-zinc-800/80 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition"
    />
  </div>

  <!-- Right Actions & Auto-Save Indicator -->
  <div class="flex items-center gap-2.5">
    <!-- Auto-Save Status Badge -->
    <div
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors duration-200 {campaignStore.isSaving
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        : campaignStore.isDirty
        ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
        : 'bg-zinc-900/80 border-zinc-800 text-zinc-400'}"
      title={campaignStore.isDirty ? 'Alterações não guardadas (Autosave em 500ms ou premir Ctrl+S)' : 'Todas as alterações guardadas localmente'}
    >
      {#if campaignStore.isSaving}
        <Loader2 class="w-3.5 h-3.5 animate-spin text-amber-400" />
      {:else if campaignStore.isDirty}
        <CircleDot class="w-3.5 h-3.5 text-amber-400 animate-pulse" />
      {:else}
        <Check class="w-3.5 h-3.5 text-emerald-400" />
      {/if}
      <span class="font-mono text-[11px] font-medium hidden sm:inline">
        {saveStatusText}
      </span>
    </div>

    <!-- Manual Save Button -->
    <button
      onclick={() => campaignStore.saveCurrentCampaign()}
      disabled={campaignStore.isSaving}
      title="Guardar Agora (Ctrl+S)"
      class="h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-amber-500/40 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
    >
      <Save class="w-3.5 h-3.5 text-zinc-400" />
      <span class="hidden lg:inline">Guardar</span>
    </button>

    <!-- Export Button -->
    <button
      onclick={() => appState.exportCampaign(campaignStore.campaign.id)}
      title="Exportar Campanha (.mural)"
      class="h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
    >
      <Download class="w-3.5 h-3.5 text-zinc-400" />
      <span class="hidden xl:inline">Exportar</span>
    </button>

    <!-- Quick Note Button -->
    <button
      onclick={() => (isModalOpen = !isModalOpen)}
      class="h-8 px-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400/60 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
    >
      <Plus class="w-3.5 h-3.5" />
      <span>Nota rápida</span>
    </button>
  </div>
</header>

<!-- Quick Note Modal -->
{#if isModalOpen}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
    <div class="w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-amber-400"></span> Adicionar Nota Rápida
        </h3>
        <button onclick={() => (isModalOpen = false)} class="text-xs text-zinc-400 hover:text-zinc-200">✕</button>
      </div>
      <textarea
        bind:value={noteText}
        placeholder="Escreve uma nota de lore, segredo ou acontecimento..."
        class="w-full h-24 p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
      ></textarea>
      <div class="flex justify-end gap-2">
        <button
          onclick={() => (isModalOpen = false)}
          class="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 transition"
        >
          Cancelar
        </button>
        <button
          onclick={handleQuickNote}
          class="px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-medium transition active:scale-95"
        >
          Guardar Nota
        </button>
      </div>
    </div>
  </div>
{/if}
```

---

### 2.3 `src/lib/components/menu/MainMenu.svelte`

The `MainMenu` is the central operational hub for managing local campaigns, creating new campaigns from scratch or templates, and importing/exporting campaign packages.

#### Key Features:
1. **Search & Real-Time Filtering**: Dynamic query filter across campaign name and system.
2. **Active Campaign Indicator**: Visual cue identifying the currently active campaign loaded in memory.
3. **Primary Action Hub**:
   - `+ Nova Campanha` button triggering `NewCampaignModal` or `CampaignWizard`.
   - `Abrir Ficheiro (.mural)` integrating with Tauri native open dialog when desktop runtime is present, with browser file picker fallback.
   - Demo loader (*As Crónicas de Aerthys*).
4. **Card Grid (`CampaignCard.svelte`)**:
   - Open Session (`Abrir Sessão`).
   - Duplicate Campaign (`Duplicar`).
   - Export Campaign (`Exportar .mural`).
   - Delete Campaign (`Eliminar` with confirmation).
   - Metadata counts (Nodes, Clocks, Lore entries).
5. **Starter Templates (4 Presets)**:
   - **Quadro em Branco** (Clean start).
   - **Investigação Paranormal** (Ordem Paranormal / Cthulhu mystery with secret clue and countdown).
   - **Facções & Sandbox** (Faction warfare and political intrigue).
   - **One-Shot de Tensão** (Timed high-intensity scenario with threat clocks).

#### Complete Blueprint Code (`src/lib/components/menu/MainMenu.svelte`):

```svelte
<script lang="ts">
  import { appState } from '../../stores/appState.svelte';
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { storageService } from '../../services/storage';
  import CampaignCard from './CampaignCard.svelte';
  import NewCampaignModal from './NewCampaignModal.svelte';
  import CampaignWizard from './CampaignWizard.svelte';
  import {
    Plus,
    FolderOpen,
    Sparkles,
    Search,
    Compass,
    Skull,
    Timer,
    BookOpen,
    HelpCircle,
    Shield,
    Layers,
    Wand2,
  } from 'lucide-svelte';

  let isNewModalOpen = $state(false);
  let isWizardOpen = $state(false);
  let fileInput: HTMLInputElement;

  const filteredCampaigns = $derived(
    appState.campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(appState.searchFilter.toLowerCase()) ||
        (c.system || '').toLowerCase().includes(appState.searchFilter.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(appState.searchFilter.toLowerCase())
    )
  );

  async function handleOpenNativeOrFile() {
    // If running in Tauri, use native dialog via storageService
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const imported = await storageService.openNativeFileDialog();
        if (imported) {
          appState.campaigns = [imported, ...appState.campaigns.filter((c) => c.id !== imported.id)];
          appState.openCampaign(imported.id);
          return;
        }
      } catch (err) {
        console.error('Failed to open native dialog:', err);
      }
    }
    // Browser fallback: trigger file input click
    fileInput?.click();
  }

  function handleFileImport(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          appState.importCampaign(content);
        }
      };
      reader.readAsText(target.files[0]);
    }
  }

  function startTemplate(templateType: 'mystery' | 'faction' | 'oneshot' | 'blank') {
    if (templateType === 'blank') {
      appState.createNewCampaign({
        name: 'Campanha Sem Título',
        system: 'Personalizado',
        inGamePeriod: 'Presente',
        description: 'Quadro limpo para planeamento livre.',
        templateType: 'blank',
      });
    } else if (templateType === 'mystery') {
      appState.createNewCampaign({
        name: 'O Enigma das Sombras',
        system: 'Ordem Paranormal',
        inGamePeriod: 'Novembro de 2024',
        description: 'Um caso de desaparecimento que esconde rituais esquecidos.',
        templateType: 'mystery',
      });
    } else if (templateType === 'faction') {
      appState.createNewCampaign({
        name: 'Guerra dos Três Barões',
        system: 'D&D 5e',
        inGamePeriod: 'Era da Peste, Ano 412',
        description: 'Três casas nobres disputam o controle da província fronteiriça.',
        templateType: 'faction',
      });
    } else {
      appState.createNewCampaign({
        name: 'Fuga do Complexo 9',
        system: 'Cyberpunk RED',
        inGamePeriod: 'Ano 2077',
        description: 'Uma invasão corporativa em ritmo acelerado com contagem de minutos.',
        templateType: 'oneshot',
      });
    }
  }
</script>

<div class="min-h-screen w-full bg-[#0b0d11] text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
  <!-- Top App Navigation -->
  <header class="h-16 border-b border-zinc-800/80 bg-zinc-950/80 px-8 flex items-center justify-between backdrop-blur-md sticky top-0 z-30">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-base shadow-inner">
        O
      </div>
      <div>
        <h1 class="text-sm font-bold text-zinc-100 tracking-wide flex items-center gap-2">
          Mural <span class="text-xs font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">OrdemTools</span>
        </h1>
        <p class="text-[11px] text-zinc-500">GM Screen & Conspiracy Board para RPG de Mesa</p>
      </div>
    </div>

    <div class="flex items-center gap-4 text-xs text-zinc-400">
      {#if campaignStore.campaign && campaignStore.campaign.id}
        <button
          onclick={() => appState.openCampaign(campaignStore.campaign.id)}
          class="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 text-amber-400 flex items-center gap-1.5 transition text-xs font-medium cursor-pointer"
        >
          <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span>Retomar "{campaignStore.campaign.name}"</span>
        </button>
        <div class="w-[1px] h-4 bg-zinc-800"></div>
      {/if}

      <a
        href="https://github.com/MigueXYZ/Mural"
        target="_blank"
        rel="noreferrer"
        class="hover:text-zinc-200 flex items-center gap-1.5 transition"
      >
        <BookOpen class="w-3.5 h-3.5" />
        <span>Documentação</span>
      </a>
      <div class="w-[1px] h-4 bg-zinc-800"></div>
      <button class="hover:text-zinc-200 flex items-center gap-1.5 transition">
        <HelpCircle class="w-3.5 h-3.5" />
        <span>Ajuda</span>
      </button>
    </div>
  </header>

  <!-- Main Content Container -->
  <main class="flex-1 max-w-6xl w-full mx-auto px-8 py-10 space-y-12">
    <!-- Hero Banner & Main Actions -->
    <div class="rounded-3xl bg-gradient-to-b from-zinc-900/90 via-zinc-900/50 to-zinc-950/40 border border-zinc-800/90 p-8 sm:p-10 shadow-2xl relative overflow-hidden">
      <!-- Glow effect -->
      <div class="absolute -right-20 -top-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="max-w-2xl space-y-3 mb-8">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
          <Sparkles class="w-3.5 h-3.5" />
          <span>Local-First & Pronto para Sessões ao Vivo</span>
        </div>
        <h2 class="text-3xl font-extrabold text-zinc-100 tracking-tight leading-tight">
          Conecta pistas, mestra campanhas e domina a narrativa.
        </h2>
        <p class="text-sm text-zinc-400 leading-relaxed">
          O teu ecrã de mestre definitivo com nós interativos de conspiração, relógios de ameaça, registo de lore e assistente de improviso.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-3.5">
        <button
          onclick={() => (isNewModalOpen = true)}
          class="px-5 py-3 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-xs flex items-center gap-2 hover:bg-amber-400 transition active:scale-95 shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          <Plus class="w-4 h-4 stroke-[2.5]" />
          <span>Nova Campanha</span>
        </button>

        <button
          onclick={() => (isWizardOpen = true)}
          class="px-4 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/40 text-zinc-200 hover:text-amber-300 font-medium text-xs flex items-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <Wand2 class="w-4 h-4 text-amber-400" />
          <span>Assistente Guiado (Wizard)</span>
        </button>

        <!-- Hidden input for file upload fallback -->
        <input
          type="file"
          accept=".json,.mural"
          bind:this={fileInput}
          onchange={handleFileImport}
          class="hidden"
        />

        <button
          onclick={handleOpenNativeOrFile}
          class="px-5 py-3 rounded-xl bg-zinc-800/90 border border-zinc-700/80 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium text-xs flex items-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <FolderOpen class="w-4 h-4 text-zinc-400" />
          <span>Abrir Ficheiro (.mural / .json)</span>
        </button>

        <button
          onclick={() => appState.openCampaign('aerthys-01')}
          class="px-5 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:border-amber-500/40 hover:text-amber-300 font-medium text-xs flex items-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <Compass class="w-4 h-4 text-amber-400" />
          <span>Ver Demo (As Crónicas de Aerthys)</span>
        </button>
      </div>
    </div>

    <!-- Campaigns Section -->
    <div class="space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h3 class="text-base font-bold text-zinc-100 flex items-center gap-2">
            <span>As Tuas Campanhas</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-normal">
              {filteredCampaigns.length}
            </span>
          </h3>
          <p class="text-xs text-zinc-500">Acede aos teus quadros de preparação recentes</p>
        </div>

        <!-- Search Bar -->
        <div class="relative w-full sm:w-72">
          <Search class="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por nome, sistema..."
            bind:value={appState.searchFilter}
            class="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      <!-- Campaign Cards Grid -->
      {#if filteredCampaigns.length > 0}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {#each filteredCampaigns as camp (camp.id)}
            <CampaignCard campaign={camp} />
          {/each}
        </div>
      {:else}
        <div class="py-16 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 space-y-3">
          <p class="text-sm text-zinc-400">Nenhuma campanha encontrada com esse filtro.</p>
          <button
            onclick={() => (isNewModalOpen = true)}
            class="text-xs text-amber-400 hover:underline font-medium cursor-pointer"
          >
            Criar uma nova campanha agora →
          </button>
        </div>
      {/if}
    </div>

    <!-- Starter Templates Section -->
    <div class="space-y-4 pt-4">
      <div>
        <h3 class="text-sm font-bold text-zinc-200">Modelos Rápidos (Starter Presets)</h3>
        <p class="text-xs text-zinc-500">Inicia uma campanha pré-configurada para o teu estilo de jogo</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onclick={() => startTemplate('blank')}
          class="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-500/50 hover:bg-zinc-900 transition text-left space-y-2 group cursor-pointer"
        >
          <div class="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300 group-hover:scale-105 transition">
            <Layers class="w-4 h-4" />
          </div>
          <h4 class="text-xs font-semibold text-zinc-200 group-hover:text-amber-400 transition">
            Quadro em Branco
          </h4>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            Canvas 100% limpo, sem nós ou regras prévias para começares do zero absoluto.
          </p>
        </button>

        <button
          onclick={() => startTemplate('mystery')}
          class="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-red-500/40 hover:bg-zinc-900 transition text-left space-y-2 group cursor-pointer"
        >
          <div class="w-8 h-8 rounded-lg bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400 group-hover:scale-105 transition">
            <Skull class="w-4 h-4" />
          </div>
          <h4 class="text-xs font-semibold text-zinc-200 group-hover:text-red-400 transition">
            Investigação Paranormal
          </h4>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            Preset ideal para *Ordem Paranormal* e *Call of Cthulhu*, focado em pistas e segredos ocultos.
          </p>
        </button>

        <button
          onclick={() => startTemplate('faction')}
          class="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-amber-500/40 hover:bg-zinc-900 transition text-left space-y-2 group cursor-pointer"
        >
          <div class="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400 group-hover:scale-105 transition">
            <Shield class="w-4 h-4" />
          </div>
          <h4 class="text-xs font-semibold text-zinc-200 group-hover:text-amber-400 transition">
            Facções & Sandbox
          </h4>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            Estrutura voltada para *D&D 5e* e *Tormenta20*, mapeando conflitos de poder e territórios.
          </p>
        </button>

        <button
          onclick={() => startTemplate('oneshot')}
          class="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-sky-500/40 hover:bg-zinc-900 transition text-left space-y-2 group cursor-pointer"
        >
          <div class="w-8 h-8 rounded-lg bg-sky-950/60 border border-sky-800/50 flex items-center justify-center text-sky-400 group-hover:scale-105 transition">
            <Timer class="w-4 h-4" />
          </div>
          <h4 class="text-xs font-semibold text-zinc-200 group-hover:text-sky-400 transition">
            One-Shot de Tensão
          </h4>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            Preparado com múltiplos Relógios de Ameaça para sessões intensas e contagens decrescentes.
          </p>
        </button>
      </div>
    </div>
  </main>

  <!-- Modals -->
  <NewCampaignModal bind:isOpen={isNewModalOpen} />
  <CampaignWizard bind:isOpen={isWizardOpen} />
</div>
```

---

### 2.4 `src/lib/components/menu/NewCampaignModal.svelte`

The `NewCampaignModal` provides a fast, direct creation dialog for starting a new campaign with a chosen template preset.

#### Key Features:
- System selector supporting all common TTRPG rulebooks (Ordem Paranormal, D&D 5e, Call of Cthulhu 7e, Tormenta20, Cyberpunk RED, Blades in the Dark, Vampiro: A Máscara, Personalizado).
- Template radio cards: Mistério, Facções, One-Shot, Quadro em Branco.
- Non-empty name validation.
- Responsive layout with accessible keyboard controls (Escape to close, Enter to submit).

#### Complete Blueprint Code (`src/lib/components/menu/NewCampaignModal.svelte`):

```svelte
<script lang="ts">
  import { appState } from '../../stores/appState.svelte';
  import { X, Sparkles, FolderPlus, Skull, Shield, Timer, Layers } from 'lucide-svelte';

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  let name = $state('');
  let system = $state('Ordem Paranormal');
  let inGamePeriod = $state('Outubro de 2024');
  let description = $state('');
  let templateType = $state<'blank' | 'mystery' | 'faction' | 'oneshot'>('mystery');

  const systemsList = [
    'Ordem Paranormal',
    'D&D 5e',
    'Call of Cthulhu 7e',
    'Tormenta20',
    'Cyberpunk RED',
    'Blades in the Dark',
    'Vampiro: A Máscara',
    'Personalizado / Outro',
  ];

  function handleSystemChange(newSys: string) {
    system = newSys;
    if (newSys === 'Ordem Paranormal') inGamePeriod = 'Outubro de 2024';
    else if (newSys === 'D&D 5e') inGamePeriod = 'Ano 1492 DR';
    else if (newSys === 'Call of Cthulhu 7e') inGamePeriod = 'Novembro de 1928';
    else if (newSys === 'Tormenta20') inGamePeriod = 'Era Artoniana, Ano 1410';
    else if (newSys === 'Cyberpunk RED') inGamePeriod = 'Ano 2077';
    else inGamePeriod = 'Presente';
  }

  function handleSubmit() {
    if (!name.trim()) return;
    appState.createNewCampaign({
      name: name.trim(),
      system,
      inGamePeriod: inGamePeriod.trim() || 'Presente',
      description: description.trim(),
      templateType,
    });
    isOpen = false;
    name = '';
    description = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      isOpen = false;
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FolderPlus class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-zinc-100">Criar Nova Campanha</h2>
            <p class="text-xs text-zinc-400">Prepara o quadro de investigação para a tua mesa</p>
          </div>
        </div>
        <button
          onclick={() => (isOpen = false)}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form Inputs -->
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4 text-xs">
        <div>
          <label for="campaign-name-input" class="block font-medium text-zinc-300 mb-1.5">
            Nome da Campanha <span class="text-amber-400">*</span>
          </label>
          <input
            id="campaign-name-input"
            type="text"
            placeholder="Ex: Operação Crisol, As Crónicas de Aerthys..."
            bind:value={name}
            required
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="campaign-system-select" class="block font-medium text-zinc-300 mb-1.5">Sistema de RPG</label>
            <select
              id="campaign-system-select"
              value={system}
              onchange={(e) => handleSystemChange((e.target as HTMLSelectElement).value)}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
            >
              {#each systemsList as sys}
                <option value={sys}>{sys}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="campaign-period-input" class="block font-medium text-zinc-300 mb-1.5">Data / Época no Mundo</label>
            <input
              id="campaign-period-input"
              type="text"
              placeholder="Ex: Ano 998, Outubro 2024..."
              bind:value={inGamePeriod}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
            />
          </div>
        </div>

        <div>
          <label for="campaign-description-input" class="block font-medium text-zinc-300 mb-1.5">Breve Descrição / Premissa</label>
          <textarea
            id="campaign-description-input"
            rows="2"
            placeholder="Ex: Uma série de homicídios ritualísticos ameaça o centro histórico..."
            bind:value={description}
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 resize-none"
          ></textarea>
        </div>

        <!-- Template selector -->
        <div>
          <span class="block font-medium text-zinc-300 mb-2">Modelo Inicial</span>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onclick={() => (templateType = 'mystery')}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {templateType === 'mystery'
                ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <div class="flex items-center gap-1 font-semibold text-[11px] mb-0.5">
                <Skull class="w-3.5 h-3.5 text-red-400" />
                <span>Mistério</span>
              </div>
              <div class="text-[10px] text-zinc-400 leading-tight">Pistas & Segredos</div>
            </button>

            <button
              type="button"
              onclick={() => (templateType = 'faction')}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {templateType === 'faction'
                ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <div class="flex items-center gap-1 font-semibold text-[11px] mb-0.5">
                <Shield class="w-3.5 h-3.5 text-purple-400" />
                <span>Facções</span>
              </div>
              <div class="text-[10px] text-zinc-400 leading-tight">Política & Poder</div>
            </button>

            <button
              type="button"
              onclick={() => (templateType = 'oneshot')}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {templateType === 'oneshot'
                ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <div class="flex items-center gap-1 font-semibold text-[11px] mb-0.5">
                <Timer class="w-3.5 h-3.5 text-sky-400" />
                <span>One-Shot</span>
              </div>
              <div class="text-[10px] text-zinc-400 leading-tight">Relógios de Tensão</div>
            </button>

            <button
              type="button"
              onclick={() => (templateType = 'blank')}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {templateType === 'blank'
                ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <div class="flex items-center gap-1 font-semibold text-[11px] mb-0.5">
                <Layers class="w-3.5 h-3.5 text-zinc-400" />
                <span>Em Branco</span>
              </div>
              <div class="text-[10px] text-zinc-400 leading-tight">Quadro 100% Limpo</div>
            </button>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onclick={() => (isOpen = false)}
            class="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            class="px-5 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Começar Campanha</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
```

---

## 3. Cohesion with `appState.svelte.ts` and `storage.ts`

To ensure end-to-end compatibility across all E2E test tiers and application runtime:
1. `appState.returnToMenu()`: Flushes the latest active campaign from `campaignStore.exportCurrentCampaign()` into `appState.campaigns` and triggers `storageService.saveCampaign(active)`.
2. `appState.openCampaign(id)`: Loads the target campaign object via `campaignStore.loadCampaign(found)` and routes `currentView = 'campaign'`.
3. `appState.duplicateCampaign(id)`: Invokes `storageService.duplicateCampaign(id)` or clones in memory and updates `appState.campaigns`.
4. `appState.deleteCampaign(id)`: Deletes from `storageService` and removes from `appState.campaigns`.

---

## 4. Verification & Validation Matrix

| Target Feature | Test Verification Step | Expected Result |
|---|---|---|
| **500ms Debounce** | Mutate node position, wait 500ms | Storage write executes exactly once after 500ms delay; `isDirty` transitions from `true` to `false`. |
| **Header Status Indicator** | Trigger mutation → Observe save cycle | Status transitions: `Salvo` → `Modificado` → `Salvando...` → `Salvo agora`. |
| **Manual Save (`Ctrl+S`)** | Press `Ctrl+S` on canvas | Immediate save flushes without waiting for timer; badge flashes `Salvando...` then `Salvo agora`. |
| **Campaign Card Actions** | Click Duplicar, Exportar, Eliminar on campaign card | Duplicates with `(Cópia)`, exports valid `.mural` JSON, deletes with confirmation. |
| **Starter Presets** | Click "Quadro em Branco", "Investigação Paranormal", etc. | Instantiates appropriate starter entity nodes, threat clocks, lore notes, and opens canvas. |
| **File Import** | Open `.mural` / `.json` file via native dialog or file input | Parses schema, upgrades legacy properties, adds to campaign list, and opens campaign. |
