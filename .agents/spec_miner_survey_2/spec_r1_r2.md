# Specification: R1 (Advanced Canvas & Relationship Graph Engine) & R2 (Local-First Native Persistence)

**Project:** Mural (OrdemTools)  
**Document Version:** 1.0.0  
**Author:** Specification Miner (Survey 2)  
**Date:** 2026-08-31  
**Scope:** R1 (Graph Engine, Custom Nodes, Semantic Edges, Auto-Layout, Selection, Pan/Zoom) & R2 (Tauri v2 FS Persistence, 500ms Debouncing, .mural Schema, Backup History, Campaign Management)

---

## 1. Executive Summary & Scope Overview

Mural (OrdemTools) is a local-first Tabletop RPG (TTRPG) Game Master (GM) Screen, investigation conspiracy board, and campaign manager built with Svelte 5 (Runes), Svelte Flow (`@xyflow/svelte`), Tailwind CSS, and Tauri v2.

This specification provides the authoritative, exhaustive technical blueprint for:
- **R1: Advanced Canvas & Relationship Graph Engine**: The visual conspiracy board where GMs orchestrate NPCs, Factions, Locations, and Secrets, connected by labeled semantic relationship edges, supported by multi-selection, group drag, auto-layout algorithms, and smooth canvas controls.
- **R2: Local-First Native Persistence & Campaign Management**: Robust native desktop (Tauri v2 FS & native dialogs) and web fallback persistence, 500ms debounced auto-saving, schema validation (`.mural` / `.json`), rolling backup snapshots, and seamless campaign lifecycle operations (New, Open, Duplicate, Export, Import, Delete).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R1: Nodes | NPC Node (`npc`) | Visual character card displaying name, role/occupation, status (alive, dead, missing, hostile, unknown), faction affiliation, tags, avatar, and master notes. | `NpcEntityData` object, position `{x, y}` | Svelte Flow Node rendered on canvas with amber theme and 4 connection handles | Fallback to default title and role if undefined | `ORIGINAL_REQUEST.md`, `context_ai.md`, `EntityNode.svelte` |
| 2 | R1: Nodes | Faction Node (`faction`) | Organization/Cult entity card displaying faction name, motto, goals, influence level, and associated leader. | `FactionEntityData` object, position `{x, y}` | Svelte Flow Node rendered with purple/indigo theme | Fallback to default faction title | `ORIGINAL_REQUEST.md`, `context_ai.md`, `EntityNode.svelte` |
| 3 | R1: Nodes | Location Node (`location`) | Region/Point of Interest card displaying location title, region, danger rating, access conditions, mini-map schematic, and linked atlas pin. | `LocationEntityData` object, position `{x, y}` | Svelte Flow Node rendered with sky/cyan theme and SVG floorplan graphic | Fallback to default location title | `ORIGINAL_REQUEST.md`, `context_ai.md`, `EntityNode.svelte` |
| 4 | R1: Nodes | Secret / Clue Node (`secret` / `clue`) | Conspiracy mystery card with fog-of-war secrecy flag, discovery session, clue type (physical, testimony, document), and trigger condition. | `SecretEntityData` object, position `{x, y}` | Svelte Flow Node rendered with rose/crimson theme and secret indicator | Fallback to hidden status `isSecret: true` | `ORIGINAL_REQUEST.md`, `context_ai.md`, `EntityNode.svelte` |
| 5 | R1: Nodes | In-Place Node Action Bar | Hover overlay bar on each node providing instant access to Edit (Pencil), Delete (Trash), Duplicate, and Visibility toggle without opening menus. | Mouse hover event on node container | Renders floating action pill at top-right of node | Traps mouse event propagation to prevent canvas drag | `EntityNode.svelte`, `CanvasView.svelte` |
| 6 | R1: Nodes | Entity Editor Modal (`EditEntityModal`) | Comprehensive dialog for editing entity category, title, subtitle, tags, master notes, secret toggle, and custom color accents. | Node click/double-click, `editingNode` store | Opens modal backdrop with accessible form inputs; updates node reactively | Validates non-empty title; retains previous state on cancel | `EditEntityModal.svelte`, `campaignStore.svelte.ts` |
| 7 | R1: Edges | Editable Semantic Edge Connectors | Directed/undirected relationship lines between node handles with semantic labels (e.g., *"é aliado de"*, *"esconde-se sob"*, *"investiga"*, *"deve favores a"*). | Source node ID, Target node ID, connection handles, relation type | Svelte Flow custom edge with interactive midpoint label | Rejects self-connections or duplicate identical edges | `ORIGINAL_REQUEST.md`, `context_ai.md`, `CanvasView.svelte` |
| 8 | R1: Edges | Edge Path Customization | Configurable edge routing algorithms: `smoothstep` (curved orthogonal), `bezier` (smooth cubic curves), and `straight` (direct line). | Edge property `pathType` | Dynamically renders SVG path using Svelte Flow path generator functions | Falls back to `smoothstep` if invalid path type | `context_ai.md`, `@xyflow/svelte` spec |
| 9 | R1: Edges | Edge Semantic Styling & Color Coding | Visual classification of relationship nature: `allied` (emerald), `hostile` (rose), `secret` (dashed purple), `neutral` (zinc), `financial` (amber). | Edge property `relationType` | Applies specific stroke color, dash array, and label badge styles | Falls back to `neutral` style | `context_ai.md`, `CanvasRelationEdge` |
| 10 | R1: Edges | In-Place Edge Label Editing & Deletion | Interactive label pill rendered on edge midpoint with one-click text editing and direct deletion button (`X`). | Click on edge label pill | Activates inline input or opens relationship selector; delete removes edge from store | Avoids deleting connected nodes on edge deletion | `ORIGINAL_REQUEST.md`, `CustomLabeledEdge.svelte` |
| 11 | R1: Layout | Auto-Layout: Hierarchical DAG | Automated graph arrangement using barycenter / hierarchical topological layering to organize faction hierarchies and dependency flows. | Trigger button "Organizar Grafo (Hierárquico)", nodes & edges list | Computes new `(x, y)` positions for all nodes with animated transition | Handles cyclic graphs gracefully by reversing back-edges during rank sort | `ORIGINAL_REQUEST.md`, `CanvasView.svelte` |
| 12 | R1: Layout | Auto-Layout: Force-Directed / Organic | Physics-based spring layout that naturally clusters closely connected NPCs, clues, and locations while repelling unconnected elements. | Trigger button "Organizar Grafo (Orgânico)", iterations count | Computes repulsion/attraction vectors and repositions nodes | Clamps max movement per step to prevent node explosion | `ORIGINAL_REQUEST.md`, `CanvasView.svelte` |
| 13 | R1: Layout | Grid Snap & Alignment Tools | Snap-to-grid alignment during drag and bulk align operations (Align Horizontal, Align Vertical, Distribute Evenly). | Grid size (e.g. 24px) or Align command on selected nodes | Aligns selected nodes to uniform X/Y axes | Requires >= 2 selected nodes for alignment operations | `ORIGINAL_REQUEST.md`, `CanvasView.svelte` |
| 14 | R1: Selection | Multi-Selection & Marquee Box | Area selection via mouse drag (marquee rubberband) or Shift/Ctrl+Click to select multiple nodes and edges concurrently. | Drag on empty canvas with selection box or Click with modifier key | Updates Svelte Flow selected state; displays multi-selection bounding box | Ignores clicks on handles or node controls | `ORIGINAL_REQUEST.md`, `@xyflow/svelte` |
| 15 | R1: Selection | Group Movement & Bulk Actions | Simultaneous dragging of all selected nodes, maintaining relative offsets, plus bulk deletion and bulk tagging. | Dragging any node in active selection set | Displaces all selected nodes by delta `(dx, dy)` | Reverts position if dragged out of canvas boundaries | `ORIGINAL_REQUEST.md`, `CanvasView.svelte` |
| 16 | R1: Navigation | Zoom & Pan Controls & Minimap | Smooth infinite canvas navigation with mouse wheel, middle-click pan, spacebar drag, MiniMap viewport preview, and Controls overlay. | Mouse wheel, drag gestures, Zoom buttons | Updates canvas viewport `{x, y, zoom}` (clamped 0.1x to 2.5x) | Prevents runaway zoom via clamping | `CanvasView.svelte`, `@xyflow/svelte` |
| 17 | R1: Navigation | Viewport Shortcuts & Search Focus | Keyboard shortcuts: `Fit View` (`Ctrl+0`), `Zoom In/Out` (`Ctrl +/-`), and Global Search (`Ctrl+K`) that pans and zooms directly to target entity. | Keyboard events (`keydown`), Search selection | Smoothly pans and centers viewport on target node ID | Handles unfound node ID gracefully | `ORIGINAL_REQUEST.md`, `Header.svelte` |
| 18 | R2: Persistence | Tauri v2 File System Plugin Integration | Native file reading/writing on desktop via `@tauri-apps/plugin-fs` (`readTextFile`, `writeTextFile`, `exists`, `mkdir`) with proper permission capabilities. | Campaign JSON payload, file path string | Writes campaign file directly to user's local disk | Catches FS permission errors and prompts user | `ORIGINAL_REQUEST.md`, `context_ai.md`, `Cargo.toml` |
| 19 | R2: Persistence | Tauri Native Open & Save Dialogs | Native OS file picker dialogs via `@tauri-apps/plugin-dialog` supporting custom `.mural` and `.json` file filters. | User click "Abrir Ficheiro" / "Guardar Como" | Native file browser dialog returning selected file path string | Handles user cancellation without error | `ORIGINAL_REQUEST.md`, `MainMenu.svelte` |
| 20 | R2: Persistence | Web & Browser Storage Fallback | Transparent fallback to browser `IndexedDB` and `localStorage` when running in browser mode without Tauri runtime. | Browser environment detection (`!window.__TAURI_INTERNALS__`) | Persists active campaign and campaign index in IndexedDB | Warns if browser storage quota exceeded | `context_ai.md`, `appState.svelte.ts` |
| 21 | R2: Persistence | Debounced Auto-Save Engine (500ms) | Automated background persistence triggered 500ms after the last mutation in nodes, edges, clocks, lore, or timeline markers. | Mutation in Svelte 5 Runes state (`campaignStore`) | Executes save to disk / IndexedDB, updates `updatedAt`, clears dirty state | Debounce timer resets on every new keystroke/drag | `ORIGINAL_REQUEST.md`, `context_ai.md` |
| 22 | R2: Persistence | `.mural` / `.json` Schema Specification | Standardized JSON data format (v1.0.0) containing campaign metadata, nodes, edges, clocks, lore, timeline, settings, and checksums. | Complete Campaign Object | Validated UTF-8 JSON file formatted with 2-space indentation | Schema validator rejects corrupted/malformed JSON | `context_ai.md`, `types/index.ts` |
| 23 | R2: Persistence | Rolling Backup History & Recovery | Automatic generation of timestamped backup snapshots (`<id>_backup_<timestamp>.mural`) in a local `backups/` directory (max 5-10 rolling snapshots). | Campaign save events, session markers | Writes rolling backup files; provides 1-click restore if primary file corrupts | Automatically prunes oldest backup beyond retention limit | `ORIGINAL_REQUEST.md`, `context_ai.md` |
| 24 | R2: Management | Campaign Wizard & Starter Presets | Step-by-step creation modal offering pre-configured templates: Blank Canvas, Paranormal Mystery, Faction Sandbox, and One-Shot Tension. | Template selection, campaign name, system, period | Generates new campaign with initial nodes, clocks, and lore entries | Enforces valid campaign name | `MainMenu.svelte`, `CampaignWizard.svelte` |
| 25 | R2: Management | Seamless Campaign Duplication | 1-click cloning of any existing campaign, creating an independent duplicate with new UUID, updated timestamp, and copied graph data. | Target campaign ID | Adds duplicated campaign to campaign list and saves to storage | Handles large campaigns with 100+ nodes instantly | `ORIGINAL_REQUEST.md`, `appState.svelte.ts` |
| 26 | R2: Management | Campaign Import & Export | Single-click export of active campaign to `.mural` / `.json` file download, and drag-and-drop or file picker import with validation. | File upload event or Export button click | Generates downloadable file or parses and loads imported campaign | Validates required schema fields, reports error on syntax failure | `ORIGINAL_REQUEST.md`, `MainMenu.svelte`, `Header.svelte` |
| 27 | R2: Management | Safe Campaign Deletion | Deletion workflow with double-confirmation modal, removing campaign from registry and cleaning associated backup files. | Delete button click, confirmation prompt | Removes campaign from active lists and persistent storage | Prevents accidental deletion via confirmation dialog | `appState.svelte.ts`, `CampaignCard.svelte` |

---

## 3. Edge Cases & Resilience Matrix

| # | Feature | Input / Trigger Condition | Observed / Required Behavior |
|---|---------|---------------------------|------------------------------|
| 1 | Node Deletion with Active Edges | User deletes a node that has 5 connected edges. | Store must atomically remove the node AND all incident edges where `source === id || target === id`. Prevents orphaned edges and canvas render crashes. |
| 2 | Self-Connecting Edge | User drags a connection line from a node's handle back to another handle on the exact same node. | Graph connection handler detects `source === target` and rejects the connection silently or shows an alert. No self-loops allowed on entity nodes. |
| 3 | Duplicate Edge Creation | User creates a connection between Node A and Node B when an edge between A and B already exists. | Handler checks `edges.some(e => (e.source === A && e.target === B) || (e.source === B && e.target === A))`. Updates existing edge label or prevents duplicate parallel edge spam. |
| 4 | Rapid Mutation Debounce Thrashing | User types quickly in entity description (50 keystrokes in 3 seconds). | Debounce timer resets on every input event; only 1 disk write operation executes 500ms after the final keystroke. UI remains 60fps with zero disk I/O lag. |
| 5 | Application Quit During Pending Auto-Save | User closes window while a 500ms debounce timer is active (e.g. at 200ms). | `beforeunload` lifecycle hook intercepts window close, immediately flushes dirty state synchronously or triggers instant save before process termination. |
| 6 | Corrupted `.mural` File Import | User attempts to import an invalid JSON file or truncated file. | Import service wraps `JSON.parse` in try/catch, verifies required fields (`id`, `name`, `nodes`, `edges`), displays user-friendly error notification, and prevents application crash. |
| 7 | Legacy Schema Version Migration | User opens a `.mural` file from version 0.1.0 missing new fields (e.g. `isSecret`, `relationType`, `timeline`). | Migration engine runs schema upgrader: fills missing properties with sensible defaults (`isSecret: false`, `relationType: 'neutral'`) and increments `schemaVersion` to 1.0.0. |
| 8 | Huge Graph Auto-Layout (500+ Nodes) | User triggers Hierarchical Auto-Layout on a very large campaign graph. | Layout algorithm executes efficiently with optimized coordinate assignment; wraps layout in `requestAnimationFrame` to prevent UI thread freeze. |
| 9 | Tauri FS Permission Denied | Application attempts to write to a protected system folder or read-only drive on Windows/macOS. | Tauri FS error caught; fallback to Native Save Dialog ("Salvar Como...") prompting user to select an accessible folder, or saves to local cache. |
| 10 | Disconnected Node Island in Auto-Layout | Canvas contains clusters of nodes with zero connecting edges. | Auto-layout groups connected subgraphs into distinct spatial components and arranges disconnected nodes into a clean orderly grid below the main graph. |
| 11 | Special Characters & Unicode in Edge Labels | Edge label contains emojis, Portuguese accents, quotes (e.g., *"é o verdadeiro assassino de «Dom Rodrigo» ⚔️"*). | JSON serialization properly encodes UTF-8; Svelte SVG text renderer safely escapes and displays characters without clipping. |
| 12 | Dragging Nodes Beyond Canvas Bounds | User drags a group of selected nodes far off into negative infinity coordinates. | Svelte Flow viewport clamps bounds or allows boundless infinite navigation with `fitView()` shortcut (`Ctrl+0`) instantly resetting focus to all nodes. |

---

## 4. Detailed Requirements Specification

### 4.1 R1: Advanced Canvas & Relationship Graph Engine

```
+---------------------------------------------------------------------------------------------------------------+
| [Floating Add Toolbar]  [+ NPC]  [+ Faction]  [+ Location]  [+ Secret]  |  [⚡ Auto-Layout ▾]  [⛶ Fit View]   |
+---------------------------------------------------------------------------------------------------------------+
|                                                                                                               |
|     +-------------------------+                               +-------------------------+                     |
|     | NPC: Serah             |==============================>| FAÇÃO: Culto do Véu     |                     |
|     | Status: Vivo (Espia)    |        "é infiltrada em"      | Líder: Mestre Caelen    |                     |
|     +-------------------------+                               +-------------------------+                     |
|                  |                                                         |                                  |
|                  | "esconde-se sob"                       "tem sede em"   |                                  |
|                  v                                                         v                                  |
|     +-------------------------+                               +-------------------------+                     |
|     | LOCAL: Ruínas Subterr.  |<------------------------------| SEGREDO: O Poço Selado  |                     |
|     | Perigo: ★★★★☆          |       "guarda a entrada"      | Revelado: NÃO (Mestre)  |                     |
|     +-------------------------+                               +-------------------------+                     |
|                                                                                                               |
+---------------------------------------------------------------------------------------------------------------+
| [MiniMap Viewport]                                            [Zoom: 100%] [Selected: 2 nodes, 1 edge]        |
+---------------------------------------------------------------------------------------------------------------+
```

#### 4.1.1 Node Specialization Architecture
Each entity node on the canvas represents a core narrative element in the RPG campaign.
1. **NPC Node (`npc`)**:
   - Primary Accent: Amber / Gold (`#d4a359`, `text-amber-400`, `border-amber-500/30`, `bg-zinc-900/95`).
   - Header: Icon `User`, subtitle `NPC` or custom role (e.g. *"Espia"*, *"Guarda Real"*, *"Investigador Particular"*).
   - Body: Character Title, status indicator (`alive` [green dot], `dead` [red skull], `missing` [yellow question], `hostile` [red badge], `unknown` [gray dot]), master summary text.
   - Handles: 4 bidirectional connection ports (Top, Right, Bottom, Left).
2. **Faction Node (`faction`)**:
   - Primary Accent: Purple / Violet (`#a855f7`, `text-purple-400`, `border-purple-500/30`, `bg-zinc-900/95`).
   - Header: Icon `Shield`, subtitle `FACÇÃO` or organization tier.
   - Body: Organization Name, Leader name / affiliation, current operational goals / motto, member count badge.
3. **Location Node (`location`)**:
   - Primary Accent: Sky Blue / Cyan (`#38bdf8`, `text-sky-400`, `border-sky-500/30`, `bg-zinc-900/95`).
   - Header: Icon `MapPin`, subtitle `LOCAL` or Region name.
   - Body: Location Title, danger rating (1-5 stars or tier), access condition (e.g. *"Requer chave do porão"*), integrated floorplan / mini schematic SVG visualization.
4. **Secret / Clue Node (`secret` / `clue`)**:
   - Primary Accent: Rose / Crimson (`#f87171`, `text-rose-400`, `border-rose-500/40`, `bg-zinc-900/95`).
   - Header: Icon `Skull` / `EyeOff`, subtitle `SEGREDO` or `PISTA OCULTA`.
   - Body: Mystery title, trigger condition (e.g. *"Interrogar Serah com Sucesso DT 15"*), discovery session badge, Fog-of-War secrecy lock.

#### 4.1.2 Semantic Edges Architecture
Edges are first-class interactive entities representing narrative links:
- **Label Renderer (`EdgeLabelRenderer`)**: Renders custom HTML/Svelte pill directly at the SVG midpoint $(x_{mid}, y_{mid})$.
- **Direct Interactivity**:
  - Clicking on the label activates an inline text input or presets dropdown (*"é aliado de"*, *"esconde-se sob"*, *"investiga"*, *"deve favores a"*, *"odeia"*, *"é suspeito de"*, *"tem posse de"*).
  - Hovering reveals a mini `X` button for instant edge removal.
- **Visual Relation Types**:
  - `allied`: Solid green line (`#10b981`), glowing label border.
  - `hostile`: Solid red line (`#ef4444`), sharp contrast.
  - `secret`: Dashed purple line (`#a855f7`, `stroke-dasharray: 6 4`), animated pulse optional.
  - `neutral`: Solid slate line (`#64748b`), clean contrast.
  - `financial`: Solid amber line (`#f59e0b`).
- **Path Geometry**:
  - `smoothstep`: Rounded orthogonal routing (ideal for structured diagrams).
  - `bezier`: Smooth cubic Bezier curve with handle tangents.
  - `straight`: Direct straight line vector (ideal for dense spider-web conspiracy boards).

#### 4.1.3 Auto-Layout Engine Specification
The auto-layout module organizes messy boards into intelligible structures:
1. **Hierarchical DAG Algorithm (Topological Ranking)**:
   - Identifies source/root nodes (e.g. high-level Factions or starting Locations).
   - Assigns hierarchical rank $L_0, L_1, \dots, L_k$ based on longest path / BFS layering.
   - Minimizes edge crossings by ordering nodes within each rank using median/barycenter heuristics.
   - Sets positions: $X_i = \text{rankIndex} \times \Delta X$, $Y_i = \text{level} \times \Delta Y$.
2. **Force-Directed Physics Algorithm**:
   - Node repulsion force: $F_{rep}(u, v) = \frac{k_{rep}^2}{\text{dist}(u, v)}$ (Coulomb's Law).
   - Edge spring attraction: $F_{attr}(u, v) = \frac{\text{dist}(u, v)^2}{k_{spring}}$ (Hooke's Law).
   - Iterates $N=100$ steps with simulated annealing temperature cooldown to reach equilibrium.
3. **Alignment & Grid Snap**:
   - Align Top: $Y_i = \min(Y_{\text{selected}})$
   - Align Center: $X_i = \text{average}(X_{\text{selected}})$
   - Distribute Horizontally: equidistant spacing between leftmost and rightmost selected nodes.

---

### 4.2 R2: Local-First Native Persistence & Campaign Management

```
+---------------------------------------------------------------------------------------------------------------+
|                                    CAMPAIGN PERSISTENCE PIPELINE                                              |
+---------------------------------------------------------------------------------------------------------------+
|                                                                                                               |
|  [Svelte 5 Runes State]                                                                                       |
|   (campaignStore / nodes / edges / clocks / lore)                                                             |
|           │                                                                                                   |
|           ▼ (State Mutation Event)                                                                            |
|  [Debounce Controller (500ms)] ──(Timer Cancel & Reset if new mutation)                                       |
|           │                                                                                                   |
|           ▼ (500ms Inactivity Elapsed)                                                                        |
|  [Serialization & Checksum Generation]                                                                        |
|           │                                                                                                   |
|     ┌─────┴──────────────────────────────────────┐                                                            |
|     ▼ (Desktop: Tauri v2 Runtime)                ▼ (Web Browser: Fallback)                                    |
|  [Tauri FS Plugin (@tauri-apps/plugin-fs)]     [IndexedDB Engine]                                             |
|   ├── Primary: writeTextFile(filePath)          ├── Primary: db.campaigns.put(data)                          |
|   └── Backup: writeTextFile(backupPath)         └── Backup: db.backups.add(snapshot)                         |
|                                                                                                               |
+---------------------------------------------------------------------------------------------------------------+
```

#### 4.2.1 Tauri v2 Desktop Integration Details
- **Cargo.toml Dependencies**:
  ```toml
  [dependencies]
  serde = { version = "1.0", features = ["derive"] }
  serde_json = "1.0"
  log = "0.4"
  tauri = { version = "2.11.3", features = [] }
  tauri-plugin-log = "2"
  tauri-plugin-fs = "2"
  tauri-plugin-dialog = "2"
  ```
- **Tauri Plugin Registration (`src-tauri/src/lib.rs`)**:
  ```rust
  #[cfg_attr(mobile, tauri::mobile_entry_point)]
  pub fn run() {
    tauri::Builder::default()
      .plugin(tauri_plugin_fs::init())
      .plugin(tauri_plugin_dialog::init())
      .setup(|app| {
        if cfg!(debug_assertions) {
          app.handle().plugin(
            tauri_plugin_log::Builder::default()
              .level(log::LevelFilter::Info)
              .build(),
          )?;
        }
        Ok(())
      })
      .run(tauri::generate_context!())
      .expect("error while running tauri application");
  }
  ```
- **Permissions Capability (`src-tauri/capabilities/default.json`)**:
  ```json
  {
    "$schema": "../gen/schemas/desktop-schema.json",
    "identifier": "default",
    "description": "Enables default permissions including full FS and dialog capabilities",
    "windows": ["main"],
    "permissions": [
      "core:default",
      "fs:default",
      "fs:allow-read-text-file",
      "fs:allow-write-text-file",
      "fs:allow-read-file",
      "fs:allow-write-file",
      "fs:allow-exists",
      "fs:allow-mkdir",
      "fs:allow-remove",
      "dialog:default",
      "dialog:allow-open",
      "dialog:allow-save"
    ]
  }
  ```

#### 4.2.2 500ms Debounced Auto-Save Workflow
1. Svelte 5 `$effect` watches reactive stores (`campaignStore.campaign`, `campaignStore.nodes`, `campaignStore.edges`).
2. When any property changes, `autoSaveScheduler.scheduleSave()` is invoked.
3. If an existing timer is pending, it is cleared (`clearTimeout(saveTimer)`).
4. A new 500ms timer starts:
   ```typescript
   let debounceTimer: ReturnType<typeof setTimeout> | null = null;
   export function scheduleAutoSave(campaign: CampaignData) {
     if (debounceTimer) clearTimeout(debounceTimer);
     debounceTimer = setTimeout(async () => {
       await executeSave(campaign);
     }, 500);
   }
   ```
5. `executeSave`:
   - Serializes campaign with `updatedAt: new Date().toISOString()`.
   - Saves to native file path (if Tauri active) or IndexedDB.
   - Rotates backup snapshot if > 5 minutes have elapsed since the last backup snapshot.

#### 4.2.3 Campaign Lifecycle Management Operations
1. **New Campaign**:
   - Initialized via `CampaignWizard` modal.
   - User chooses Preset: Blank, Paranormal Mystery, Faction Sandbox, or One-Shot Tension.
   - Generates unique ID (`campaign-${Date.now()}`), sets initial session to 1, and opens canvas.
2. **Duplicate Campaign**:
   - Clones entire state deep object.
   - Replaces `id` with new UUID, appends `(Cópia)` to `name`, updates timestamps.
   - Persists duplicate immediately to disk/storage.
3. **Export Campaign**:
   - Desktop: Offers Native Save Dialog (`@tauri-apps/plugin-dialog`) with default filename `<campaign_name>.mural`.
   - Web: Generates Blob and triggers `<a download="campaign.mural">`.
4. **Import Campaign**:
   - Desktop: Opens Native Open Dialog (`@tauri-apps/plugin-dialog`).
   - Web: Opens `<input type="file" accept=".mural,.json">`.
   - Validates JSON format and schema integrity; if valid, adds to campaign registry and loads onto canvas.
5. **Delete Campaign**:
   - Requires explicit user confirmation dialog.
   - Deletes from campaign index and removes primary file and associated backup snapshots.

---

## 5. Data Models & TypeScript Interfaces

```typescript
// ============================================================================
// MURAL (ORDEMTOOLS) - CORE TYPESCRIPT DATA CONTRACTS (R1 & R2)
// Schema Version: 1.0.0
// ============================================================================

import type { Node, Edge } from '@xyflow/svelte';

// ----------------------------------------------------------------------------
// 1. Entity Types & Node Data Payloads
// ----------------------------------------------------------------------------

export type EntityType = 'npc' | 'faction' | 'location' | 'secret' | 'clue' | 'quest';

export type NpcStatus = 'alive' | 'dead' | 'missing' | 'hostile' | 'unknown' | 'imprisoned';
export type RelationType = 'neutral' | 'allied' | 'hostile' | 'secret' | 'family' | 'financial' | 'custom';
export type EdgePathType = 'smoothstep' | 'bezier' | 'straight' | 'step';

export interface BaseEntityData extends Record<string, unknown> {
  id: string;
  type: EntityType;
  title: string;
  subtitle?: string;
  description: string;
  tags?: string[];
  isSecret?: boolean;
  revealedToPlayers?: boolean;
  avatarUrl?: string;
  color?: string;
  attributes?: Record<string, string | number>;
  notes?: string;
}

export interface NpcEntityData extends BaseEntityData {
  type: 'npc';
  role: string; // Ex: "Espia", "Investigador", "Cultista"
  factionId?: string;
  status: NpcStatus;
}

export interface FactionEntityData extends BaseEntityData {
  type: 'faction';
  leader?: string;
  motto?: string;
  goals?: string;
  influenceLevel?: 1 | 2 | 3 | 4 | 5;
  headquartersId?: string;
}

export interface LocationEntityData extends BaseEntityData {
  type: 'location';
  region?: string;
  dangerLevel?: 1 | 2 | 3 | 4 | 5;
  accessCondition?: string;
  layoutThumbnail?: string;
  associatedAtlasPinId?: string;
}

export interface SecretEntityData extends BaseEntityData {
  type: 'secret' | 'clue';
  triggerCondition?: string;
  discoveredInSession?: number;
  clueType?: 'physical' | 'testimony' | 'document' | 'supernatural';
}

export type CanvasEntityNodeData = NpcEntityData | FactionEntityData | LocationEntityData | SecretEntityData;

export type CanvasEntityNode = Node<CanvasEntityNodeData, 'entityNode'>;

// ----------------------------------------------------------------------------
// 2. Semantic Edge Connectors
// ----------------------------------------------------------------------------

export interface CanvasRelationEdgeData extends Record<string, unknown> {
  label: string;
  relationType: RelationType;
  pathType?: EdgePathType;
  bidirectional?: boolean;
  notes?: string;
  animated?: boolean;
  color?: string;
}

export type CanvasRelationEdge = Edge<CanvasRelationEdgeData>;

// ----------------------------------------------------------------------------
// 3. GM Operational Suite Entities (Clocks, Lore, Timeline)
// ----------------------------------------------------------------------------

export interface ThreatClock {
  id: string;
  title: string;
  totalSegments: 4 | 6 | 8 | 10 | 12 | number;
  filledSegments: number;
  category?: 'threat' | 'faction_progress' | 'countdown' | 'environmental';
  color?: string;
  isCompleted?: boolean;
  consequenceText?: string;
}

export interface LoreEntry {
  id: string;
  content: string;
  status: 'SABIDO' | 'SEGREDO';
  sessionNumber: number;
  associatedNodeIds?: string[];
  createdAt?: string;
}

export interface TimelineMarker {
  id: string;
  sessionNumber: number;
  sessionText?: string;
  inGameDate?: string;
  title?: string;
  description?: string;
  isCurrent?: boolean;
}

// ----------------------------------------------------------------------------
// 4. Campaign Settings & Configuration
// ----------------------------------------------------------------------------

export interface CampaignSettings {
  aiProvider: 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'none';
  aiApiKey?: string;
  aiModel?: string;
  aiCustomEndpoint?: string;
  theme: 'dark' | 'midnight' | 'paper';
  autoSaveIntervalMs?: number;
  gridSnap?: boolean;
  gridSize?: number;
}

// ----------------------------------------------------------------------------
// 5. Root Campaign File Schema (.mural / .json)
// ----------------------------------------------------------------------------

export interface CampaignData {
  schemaVersion: string; // Ex: "1.0.0"
  id: string;
  name: string;
  system: string; // Ex: "Ordem Paranormal", "D&D 5e", "Call of Cthulhu"
  currentSession: number;
  inGamePeriod: string; // Ex: "Bruma, Ano 998"
  description?: string;
  createdAt: string;
  updatedAt: string;
  filePath?: string; // Absolute path when running on desktop
  nodes: CanvasEntityNode[];
  edges: CanvasRelationEdge[];
  clocks: ThreatClock[];
  lore: LoreEntry[];
  timeline: TimelineMarker[];
  settings?: CampaignSettings;
  meta?: {
    appVersion?: string;
    nodeCount?: number;
    edgeCount?: number;
  };
}

export interface CampaignSummary {
  id: string;
  name: string;
  system: string;
  currentSession: number;
  inGamePeriod: string;
  description?: string;
  updatedAt: string;
  filePath?: string;
  nodeCount: number;
  clockCount: number;
  loreCount: number;
}

export interface BackupSnapshot {
  id: string;
  campaignId: string;
  timestamp: string;
  filePath?: string;
  data: CampaignData;
}
```

---

## 6. Component Architecture & State Management

### 6.1 State Architecture (Svelte 5 Runes)

The application leverages Svelte 5 Runes (`$state`, `$derived`, `$effect`) for fine-grained reactivity combined with `@xyflow/svelte` stores for the graph canvas:

```
src/lib/
├── stores/
│   ├── campaignStore.svelte.ts     # Active campaign state, nodes/edges stores, selection
│   ├── appState.svelte.ts          # Application-level routing (menu vs campaign), campaign list
│   └── persistenceStore.svelte.ts  # Auto-save debouncer, dirty flags, Tauri/Web storage bridge
├── services/
│   ├── storageService.ts           # FS / Dialog / IndexedDB / Backup abstraction
│   ├── autoLayoutService.ts        # DAG / Force-directed layout calculation engine
│   └── schemaMigration.ts          # Upgrades legacy .mural JSON schemas to v1.0.0
└── components/
    ├── canvas/
    │   ├── CanvasView.svelte        # SvelteFlow wrapper, Toolbar, Background, MiniMap, Controls
    │   ├── EditEntityModal.svelte   # Entity editor dialog
    │   ├── nodes/
    │   │   ├── EntityNode.svelte    # Master polymorphic entity node component
    │   │   ├── NpcCard.svelte       # NPC-specific card layout
    │   │   ├── FactionCard.svelte   # Faction-specific card layout
    │   │   ├── LocationCard.svelte  # Location card layout + schematic
    │   │   └── SecretCard.svelte    # Secret / Clue card layout
    │   └── edges/
    │       ├── CustomLabeledEdge.svelte # Custom edge renderer with editable midpoint pill
    │       └── EdgeEditPopover.svelte   # Popover for relationship type & label editing
    ├── menu/
    │   ├── MainMenu.svelte          # Main hub with campaigns grid, templates, import/export
    │   ├── CampaignCard.svelte      # Campaign summary card
    │   └── CampaignWizard.svelte    # New campaign creation wizard
    └── layout/
        ├── Header.svelte            # Top bar: Session, Search focus, Quick Notes, Export
        └── NavigationSidebar.svelte # Left navigation rail
```

### 6.2 Component Interactions

1. **`CanvasView.svelte`**:
   - Integrates `<SvelteFlow {nodes} {edges} {nodeTypes} {edgeTypes} onconnect={handleConnect} selectionMode="marquee">`.
   - Mounts `<Background gap={28} size={1.2} bgColor="#0b0d11" patternColor="#222733" />`.
   - Mounts `<MiniMap />` and `<Controls />`.
   - Floating Toolbar provides quick buttons: `+ NPC`, `+ Faction`, `+ Location`, `+ Secret`, `⚡ Organizar Grafo (Hierárquico)`, `⚡ Organizar Grafo (Orgânico)`, `⛶ Enquadrar (Fit View)`.
2. **`CustomLabeledEdge.svelte`**:
   - Injected into Svelte Flow via `edgeTypes: { customLabeled: CustomLabeledEdge }`.
   - Uses `getSmoothStepPath()` or `getBezierPath()` based on `data.pathType`.
   - Renders `<EdgeLabelRenderer>` containing an interactive pill with relation icon, label text, and delete button.
3. **`EditEntityModal.svelte`**:
   - Reactive modal bound to `campaignStore.editingNode`.
   - Provides live previews of node tags, color themes, and type-specific attributes.
   - Emits updates to `campaignStore.updateNodeData(id, partial)` upon save.

---

## 7. Storage Service & Auto-Save Implementation Spec

```typescript
// ============================================================================
// STORAGE SERVICE SPECIFICATION (Tauri v2 + Web Fallback)
// ============================================================================

import type { CampaignData, CampaignSummary } from '../types';

export class StorageService {
  private isTauriEnv(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }

  async saveCampaign(campaign: CampaignData, explicitPath?: string): Promise<string> {
    const json = JSON.stringify(campaign, null, 2);

    if (this.isTauriEnv()) {
      const { writeTextFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');
      const { appDataDir } = await import('@tauri-apps/api/path');

      let targetPath = explicitPath || campaign.filePath;
      if (!targetPath) {
        const appDir = await appDataDir();
        const campaignsDir = `${appDir}/campaigns`;
        if (!(await exists(campaignsDir))) {
          await mkdir(campaignsDir, { recursive: true });
        }
        targetPath = `${campaignsDir}/${campaign.id}.mural`;
      }

      await writeTextFile(targetPath, json);
      await this.createBackupSnapshot(campaign);
      return targetPath;
    } else {
      // Browser IndexedDB / localStorage fallback
      localStorage.setItem(`mural_campaign_${campaign.id}`, json);
      this.updateWebCampaignIndex(campaign);
      return `indexeddb://${campaign.id}`;
    }
  }

  async loadCampaign(idOrPath: string): Promise<CampaignData> {
    if (this.isTauriEnv() && (idOrPath.includes('/') || idOrPath.includes('\\'))) {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const content = await readTextFile(idOrPath);
      const parsed = JSON.parse(content);
      return this.validateAndMigrate(parsed, idOrPath);
    } else {
      const raw = localStorage.getItem(`mural_campaign_${idOrPath}`);
      if (!raw) throw new Error('Campanha não encontrada no armazenamento local.');
      const parsed = JSON.parse(raw);
      return this.validateAndMigrate(parsed);
    }
  }

  async openNativeFileDialog(): Promise<CampaignData | null> {
    if (this.isTauriEnv()) {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Campanha Mural', extensions: ['mural', 'json'] }],
      });
      if (selected && typeof selected === 'string') {
        return this.loadCampaign(selected);
      }
    }
    return null;
  }

  private validateAndMigrate(raw: any, filePath?: string): CampaignData {
    if (!raw || typeof raw !== 'object') throw new Error('Ficheiro inválido.');
    return {
      schemaVersion: raw.schemaVersion || '1.0.0',
      id: raw.id || `camp-${Date.now()}`,
      name: raw.name || 'Campanha Sem Título',
      system: raw.system || 'Ordem Paranormal',
      currentSession: raw.currentSession || 1,
      inGamePeriod: raw.inGamePeriod || 'Presente',
      description: raw.description || '',
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
      filePath: filePath || raw.filePath,
      nodes: raw.nodes || [],
      edges: raw.edges || [],
      clocks: raw.clocks || [],
      lore: raw.lore || [],
      timeline: raw.timeline || [],
      settings: raw.settings || {
        aiProvider: 'gemini',
        theme: 'dark',
      },
    };
  }

  private async createBackupSnapshot(campaign: CampaignData): Promise<void> {
    if (!this.isTauriEnv()) return;
    try {
      const { writeTextFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');
      const { appDataDir } = await import('@tauri-apps/api/path');
      const appDir = await appDataDir();
      const backupDir = `${appDir}/backups/${campaign.id}`;
      if (!(await exists(backupDir))) {
        await mkdir(backupDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${backupDir}/${campaign.id}_${timestamp}.mural`;
      await writeTextFile(backupPath, JSON.stringify(campaign, null, 2));
    } catch (e) {
      console.warn('Falha ao gravar backup secundário:', e);
    }
  }
}

export const storageService = new StorageService();
```

---

## 8. Acceptance & Verification Criteria

| Test ID | Test Category | Target Feature | Acceptance Verification Step | Expected Result |
|---|---|---|---|---|
| TC-R1-01 | R1: Graph | Node Creation | Click "+ NPC", "+ Faction", "+ Location", "+ Secret" on floating toolbar. | 4 new styled nodes appear with distinct category colors, icons, and handles. |
| TC-R1-02 | R1: Graph | Node Editing | Double-click an NPC node, edit name, role, and toggle secret flag, click Save. | Node updates reactively on canvas and is marked with secret border if enabled. |
| TC-R1-03 | R1: Graph | Semantic Edges | Connect handle from Node A to Node B. Edit label to *"investiga"*, set style to `hostile`. | Edge renders red stroke with interactive label *"investiga"* at midpoint. |
| TC-R1-04 | R1: Graph | Edge Deletion | Click delete button on edge label pill. | Edge is removed from store and canvas; both connected nodes remain intact. |
| TC-R1-05 | R1: Graph | Node Deletion | Delete a node with 3 connected edges using hover action bar. | Node and all 3 connected edges are deleted atomically without canvas error. |
| TC-R1-06 | R1: Graph | Auto-Layout | Add 8 interconnected nodes; click "⚡ Organizar Grafo (Hierárquico)". | Nodes automatically reposition into cleanly separated vertical tiers without overlaps. |
| TC-R1-07 | R1: Graph | Multi-Selection | Drag selection marquee over 4 nodes; drag one node. | All 4 nodes move synchronously maintaining relative distances. |
| TC-R1-08 | R1: Graph | Viewport Zoom/Pan | Use mouse wheel to zoom in/out; press `Ctrl+0`. | Viewport zooms smoothly between 0.1x and 2.5x; `Ctrl+0` fits all nodes in view. |
| TC-R2-01 | R2: Persistence | Debounced Auto-Save | Modify node title; observe disk/storage write activity after 500ms. | File is saved automatically after 500ms delay with updated timestamp. |
| TC-R2-02 | R2: Persistence | Export Campaign | Click "Exportar" button in header or Main Menu card. | Browser triggers download of `<name>.mural` containing valid JSON v1.0.0. |
| TC-R2-03 | R2: Persistence | Import Campaign | Import exported `.mural` file via "Abrir Ficheiro" in Main Menu. | Campaign is parsed, validated, added to campaign list, and loaded cleanly onto canvas. |
| TC-R2-04 | R2: Persistence | Duplicate Campaign | Click Duplicate icon on a campaign card in Main Menu. | Independent copy named `[Name] (Cópia)` appears and is saved to storage. |
| TC-R2-05 | R2: Persistence | Backup Rotation | Trigger 3 consecutive save cycles. | Backup directory retains rolling snapshots without exceeding storage limits. |
| TC-R2-06 | R2: Persistence | Tauri Native FS | Run in Tauri desktop mode; open campaign from custom folder. | Loads and saves directly to specified native file path via `@tauri-apps/plugin-fs`. |
