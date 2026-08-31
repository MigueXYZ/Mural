# Mural (OrdemTools) — Comprehensive Codebase Survey & Architecture Report

**Date**: 2026-08-31  
**Author**: `explorer_survey_1` (Codebase Architecture & Technical Baseline Explorer)  
**Target Repository**: `e:\DEV\Projects\Mural`  
**Integrity Mode**: Development / Local-First Desktop & Web  

---

## 1. Executive Summary

**Mural (OrdemTools)** is a modern, local-first Tabletop RPG (TTRPG) Game Master (GM) Screen, conspiracy investigation board, and campaign manager. It is architected around **Svelte 5 (Runes)**, **Svelte Flow (`@xyflow/svelte`)**, **Tailwind CSS v4**, and **Tauri v2 (Rust)**.

### Baseline Status Summary
- **Svelte Check (`npx svelte-check --tsconfig ./tsconfig.json`)**: Passed with **0 errors and 0 warnings**.
- **Frontend Production Build (`npm run build` / Vite v6)**: Built cleanly with **0 errors** (Output: `dist/index.html` 0.59 kB, `dist/assets/index-*.css` 74.05 kB, `dist/assets/index-*.js` 329.62 kB in 22.16s).
- **Rust Backend Check (`cargo check` in `src-tauri`)**: Finished `dev` profile with **0 warnings / 0 errors** in 0.40s.
- **Current Maturity**: Solid functional foundation for MVP UI (Main Menu, Canvas with entity nodes, basic clock ring rendering, basic lore toggle, timeline footer, mock AI panel). However, key functional gaps exist regarding Tauri native plugins (FS & Dialogs), editable semantic edge connectors, auto-layout, Threat Clock completion triggers, Atlas/Map pin view, debounced persistence, and real BYOK AI integration.

---

## 2. Technology Stack & Toolchain Verification

### 2.1 Package Dependencies & Versions (`package.json`)

```json
{
  "name": "mural",
  "version": "0.1.0",
  "dependencies": {
    "@tauri-apps/api": "^2.2.0",
    "@tauri-apps/plugin-dialog": "^2.2.0",
    "@tauri-apps/plugin-fs": "^2.2.0",
    "@xyflow/svelte": "^0.1.24",
    "clsx": "^2.1.1",
    "lucide-svelte": "^0.475.0",
    "tailwind-merge": "^3.0.1"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^5.0.3",
    "@tailwindcss/vite": "^4.0.7",
    "@tauri-apps/cli": "^2.2.4",
    "svelte": "^5.20.2",
    "svelte-check": "^4.1.4",
    "tailwindcss": "^4.0.7",
    "typescript": "^5.7.3",
    "vite": "^6.1.0"
  }
}
```

### 2.2 Rust Backend Dependencies (`src-tauri/Cargo.toml`)

```toml
[package]
name = "app"
version = "0.1.0"
edition = "2021"
rust-version = "1.77.2"

[build-dependencies]
tauri-build = { version = "2.6.3", features = [] }

[dependencies]
serde_json = "1.0"
serde = { version = "1.0", features = ["derive"] }
log = "0.4"
tauri = { version = "2.11.3", features = [] }
tauri-plugin-log = "2"
```

> **⚠️ Critical Observation**: While `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog` exist in `package.json`, `src-tauri/Cargo.toml` is **missing** `tauri-plugin-fs = "2"` and `tauri-plugin-dialog = "2"`. Furthermore, `src-tauri/src/lib.rs` and `src-tauri/capabilities/default.json` do not currently register or permit these plugins.

### 2.3 Configuration Files Overview
- **`svelte.config.js`**: Configured with `vitePreprocess()` from `@sveltejs/vite-plugin-svelte`.
- **`vite.config.ts`**: Uses `tailwindcss()` (`@tailwindcss/vite`) and `svelte()` plugins; strict port 5173, host `0.0.0.0`, ignores `src-tauri` from file watching.
- **`tsconfig.json`**: Target `ES2022`, module `ESNext`, `moduleResolution: "bundler"`, `strict: true`, `skipLibCheck: true`.
- **`src-tauri/tauri.conf.json`**: Product name `mural`, identifier `com.ordemtools.mural`, window size 1280x800 (min 960x600), `frontendDist: "../dist"`.

---

## 3. Architecture & Codebase Map

### 3.1 Directory Structure & File Inventory

```
e:\DEV\Projects\Mural\
├── package.json                   # Project dependencies and build scripts
├── svelte.config.js               # Svelte preprocessor config
├── vite.config.ts                 # Vite + Tailwind v4 + Svelte bundler config
├── tsconfig.json                  # TypeScript compiler configuration
├── index.html                     # HTML root template with #app target
├── context_ai.md                  # Comprehensive architectural specification document
├── README.md                      # Human documentation & quick start guide
├── src/
│   ├── main.ts                    # Svelte 5 mount(App, { target }) entry point
│   ├── app.css                    # Tailwind CSS v4 import, color tokens & SvelteFlow dark theme
│   ├── app.d.ts                   # Ambient TypeScript types for Svelte and Vite client
│   ├── App.svelte                 # Root layout switcher (menu vs campaign workspace)
│   └── lib/
│       ├── types/
│       │   └── index.ts           # Core TypeScript data contracts (Campaign, Nodes, Clocks, Lore)
│       ├── data/
│       │   └── sampleCampaign.ts  # Demo campaigns ('As Crónicas de Aerthys', 'Operação Crisol')
│       ├── stores/
│       │   ├── appState.svelte.ts       # Global app view state, campaign list, import/export
│       │   └── campaignStore.svelte.ts  # Active campaign state ($state + writable flow stores)
│       └── components/
│           ├── layout/
│           │   ├── Header.svelte            # Top bar (campaign title, search input, quick note, export)
│           │   ├── NavigationSidebar.svelte # Left navigation rail (board, maps, timeline, settings)
│           │   └── BottomTimeline.svelte    # Bottom session timeline and period indicator
│           ├── canvas/
│           │   ├── CanvasView.svelte        # SvelteFlow container with floating node creator toolbar
│           │   ├── EditEntityModal.svelte   # Modal dialog for editing entity node properties
│           │   └── nodes/
│           │       └── EntityNode.svelte    # Custom SvelteFlow node component (NPC, Faction, Location, Secret)
│           ├── clocks/
│           │   ├── ThreatClockItem.svelte   # SVG segmented circular clock with click handlers
│           │   └── ThreatClocksPanel.svelte # Right panel list of Threat Clocks
│           ├── lore/
│           │   ├── LoreEntryItem.svelte     # Lore item with SABIDO/SEGREDO toggle badge
│           │   └── LorePanel.svelte         # Right panel list of lore and clue facts
│           ├── assistant/
│           │   └── AiAssistantPanel.svelte  # Emergency AI panel ("A mesa descarrilou?")
│           └── menu/
│               ├── MainMenu.svelte          # Main launcher screen with hero, presets, and campaign grid
│               ├── CampaignCard.svelte      # Campaign summary card (Open, Duplicate, Export, Delete)
│               ├── CampaignWizard.svelte    # 5-step interactive campaign creation wizard
│               └── NewCampaignModal.svelte  # Quick modal for creating a new campaign
└── src-tauri/
    ├── Cargo.toml                 # Cargo dependencies (tauri, tauri-plugin-log, serde)
    ├── build.rs                   # Tauri build script (tauri_build::build())
    ├── tauri.conf.json            # Tauri v2 application configuration
    ├── capabilities/
    │   └── default.json           # Tauri v2 capability permissions (currently core:default)
    └── src/
        ├── main.rs                # Windows subsystem entry point
        └── lib.rs                 # Tauri builder setup & logger initialization
```

### 3.2 State Management & Reactive Data Flow

1. **`appState.svelte.ts` (Application Shell State)**:
   - Uses Svelte 5 `$state` runes for `currentView` (`'menu' | 'campaign'`), `campaigns` list, and `searchFilter`.
   - Manages campaign lifecycle: `openCampaign(id)`, `returnToMenu()`, `createNewCampaign(...)`, `duplicateCampaign(id)`, `deleteCampaign(id)`, `exportCampaign(id)`, `importCampaign(jsonString)`.
   - Employs browser DOM anchor download for export and HTML file input for import.

2. **`campaignStore.svelte.ts` (Active Workspace State)**:
   - Uses Svelte 5 `$state` for `campaign: CampaignData`, `searchQuery`, `selectedEntity`, and `editingNode`.
   - Uses Svelte stores `writable<Node<EntityNodeData>[]>` and `writable<Edge[]>` to maintain bidirectional reactivity with `@xyflow/svelte`'s internal graph engine.
   - Provides mutators for:
     - Entity nodes: `openNodeEditor()`, `closeNodeEditor()`, `updateNodeData()`, `deleteNode()`, `addEntityNode()`.
     - Clocks: `incrementClock(id)` (left click), `decrementClock(id)` (right click).
     - Lore: `toggleLoreStatus(id)`, `addLoreEntry(content, status)`.

---

## 4. Comprehensive Requirements Audit (R1–R4 vs Current Implementation)

### Requirement 1: Advanced Canvas & Relationship Graph Engine

| Requirement Feature | Current State | Code Location | Status & Gaps |
| :--- | :--- | :--- | :--- |
| **Entity Nodes (NPC, Faction, Location, Secret/Clue)** | Implemented with custom colors and category tags | `EntityNode.svelte:1-109`, `CanvasView.svelte:9-51` | **Partial**: Custom icons selection is missing; tags array exists in type but is not editable or rendered in node; status field (alive/dead/missing) is not exposed; attributes key-value pairs are missing. |
| **In-place / Modal Editing** | Modal editing implemented via `EditEntityModal` | `EditEntityModal.svelte:1-184` | **Substantial**: Modal works for Title, Role, Description, Category, and Secret flag. Missing in-place quick editing on canvas, color palette selection, and tag management. |
| **Editable Semantic Edge Connectors** | Edge creation connects nodes via `handleConnect` with default `smoothstep` and `'ligação'` label | `CanvasView.svelte:53-64`, `sampleCampaign.ts:74-98` | **Major Gap**: No custom edge component (`CustomLabeledEdge.svelte`); edge labels cannot be edited after creation via UI; edge path curvature cannot be switched (bezier, straight, smoothstep); no UI to delete an edge; no semantic color themes (allied, hostile, secret). |
| **Multi-selection & Group Movement** | Default SvelteFlow multi-selection is enabled | `@xyflow/svelte` integration in `CanvasView.svelte:124-139` | **Partial**: Basic box selection works via `@xyflow/svelte`, but no group actions (group movement tools, align horizontal/vertical, batch delete/color) are implemented. |
| **Canvas Auto-Layout / Auto-Arrange** | Not implemented | `CanvasView.svelte` | **Missing**: No auto-layout button or algorithm (e.g., dagre, hierarchy, or force layout). |
| **Zoom/Pan Shortcuts & Controls** | SvelteFlow Controls & MiniMap embedded | `CanvasView.svelte:133-138` | **Substantial**: Controls toolbar and MiniMap exist. Dedicated keyboard shortcut legend/overlay (`Ctrl+A`, `Delete`, `Shift+1` fit view, `Ctrl+D` duplicate) is missing. |

---

### Requirement 2: Local-First Native Persistence & Campaign Management

| Requirement Feature | Current State | Code Location | Status & Gaps |
| :--- | :--- | :--- | :--- |
| **Tauri v2 Native File System & Dialogs** | Web DOM fallback only; Tauri plugins missing in Rust backend | `Cargo.toml:20-25`, `src/lib.rs:1-17`, `appState.svelte.ts:111-136` | **Critical Gap**: `tauri-plugin-fs` and `tauri-plugin-dialog` are absent in `Cargo.toml`, uninitialized in `lib.rs`, and unpermitted in `capabilities/default.json`. Frontend currently uses `<a>` download and `<input type="file">`. |
| **Debounced Auto-Saving (500ms)** | State is held in memory and saved to array on menu exit | `appState.svelte.ts:18-28` | **Missing**: No debounced watcher (500ms) that writes changes to local file / IndexedDB / Tauri app data directory in real-time. |
| **Backup History / Data Loss Prevention** | Not implemented | None | **Missing**: No rotating snapshot history, undo log, or autosave recovery. |
| **Import, Export, and Duplication** | Web-based JSON/mural import/export and object duplication | `appState.svelte.ts:94-136`, `MainMenu.svelte:30-42`, `CampaignCard.svelte:48-79` | **Substantial**: Functional in web mode. Needs native Tauri file picker integration when running under desktop runtime and schema validation on imported data. |

---

### Requirement 3: Interactive GM Operational Suite (Clocks, Lore, Timeline, Atlas)

| Requirement Feature | Current State | Code Location | Status & Gaps |
| :--- | :--- | :--- | :--- |
| **Threat Clocks (SVG Segmented Ring Graphics)** | SVG segmented ring with dynamic stroke-dasharray and rotation math | `ThreatClockItem.svelte:8-32` | **Substantial**: SVG math works smoothly for arbitrary segments. Left-click increments, right-click decrements. |
| **Clock Slices (4, 6, 8, 10, 12) & Creation** | Panel uses browser `prompt()` with hardcoded 6 slices; Wizard supports 4, 6, 8, 10 | `ThreatClocksPanel.svelte:6-16`, `CampaignWizard.svelte:549-563` | **Partial**: Adding clocks from the active sidebar uses browser `prompt()` without segment selector or 12-slice option. Needs dedicated clock creator/editor modal. |
| **Clock Completion Triggers** | No action when `filledSegments === totalSegments` | `ThreatClockItem.svelte:34-42` | **Missing**: No completion alert, consequence banner, visual celebration/danger glow, or trigger event when clock fills up. |
| **Lore Registry & Visibility Toggles** | Lore feed with SABIDO (green) and SEGREDO (rose) toggle | `LoreEntryItem.svelte:12-30`, `LorePanel.svelte:1-34` | **Substantial**: Status toggle is instant and reactive. Adding lore uses browser `prompt()`. Missing search/filter, category tagging, and node association links. |
| **Interactive Timeline & Session Markers** | Horizontal session track on bottom bar | `BottomTimeline.svelte:1-35` | **Partial**: Static visualization of timeline items. Missing interactive controls to advance sessions, add in-game date markers, edit chronological notes, or switch active session. |
| **Interactive Map / Atlas View with Pin Placement** | Sidebar icon exists but does not switch view | `NavigationSidebar.svelte:8, 20-27`, `App.svelte:21-38` | **Missing**: No Map/Atlas component exists. App.svelte unconditionally renders `CanvasView`. Need Map/Atlas view with map image upload/viewer, zoom/pan, and pin placement linked to canvas entity nodes. |

---

### Requirement 4: Context-Aware AI GM Session Assistant

| Requirement Feature | Current State | Code Location | Status & Gaps |
| :--- | :--- | :--- | :--- |
| **"A mesa descarrilou?" Emergency Assistant UI** | Sidebar input and button with mock suggestions | `AiAssistantPanel.svelte:1-76` | **UI Skeleton**: UI layout is present, but uses a hardcoded 900ms `setTimeout` returning 3 static mock strings. |
| **Board Context Serializer & Compressed Payload** | Documented in `context_ai.md:286-309`, not implemented in code | None | **Missing**: No context aggregator that serializes active nodes, secrets, filled clocks, and current session into a concise prompt. |
| **Configurable BYOK Settings Interface** | Interface defined in `context_ai.md:123-129`; Settings button in sidebar has no action | `NavigationSidebar.svelte:32-37` | **Missing**: No Settings modal for BYOK provider selection (Gemini, OpenAI, Anthropic, Ollama local endpoint, None/Mock), API keys, and model selection. |
| **Actionable 3-Hook Generation Driver** | Not implemented | None | **Missing**: No HTTP / API service calling Gemini, OpenAI, Claude, or Ollama (`http://localhost:11434`), or offline heuristic generator fallback. |

---

## 5. Detailed Component & Module Gap Analysis

### 5.1 Missing Components & Files to Create
1. **`src/lib/services/storage.ts`**:
   - Platform detection (`isTauri()`).
   - Tauri v2 FS integration (`@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`) with fallback to `localStorage` / `IndexedDB`.
   - Debounced auto-saver (500ms).
   - Campaign file serialization and deserialization with schema validation.
2. **`src/lib/services/aiAssistant.ts`**:
   - Context builder extracting active canvas nodes, active threat clocks, hidden secrets, and campaign timeline.
   - Multi-provider BYOK LLM client:
     - Google Gemini API (`https://generativelanguage.googleapis.com/v1beta/models/...:generateContent`)
     - OpenAI API (`https://api.openai.com/v1/chat/completions`)
     - Anthropic API (`https://api.anthropic.com/v1/messages`)
     - Ollama Local API (`http://localhost:11434/api/generate` or `/v1/chat/completions`)
     - Offline dynamic heuristic generator (when no key or offline).
3. **`src/lib/components/canvas/edges/CustomLabeledEdge.svelte`**:
   - Custom SvelteFlow edge supporting editable label on double-click, path styling (curved, straight, smoothstep), relation type colors (allied, hostile, secret, neutral), and delete button on hover/click.
4. **`src/lib/components/atlas/AtlasView.svelte` / `MapView.svelte`**:
   - Interactive Map/Atlas view with image upload / default maps, pan & zoom, and pin placement linked to canvas entities.
5. **`src/lib/components/settings/SettingsModal.svelte`**:
   - Campaign settings, theme selection, and BYOK AI configuration (Provider, API Key, Model, Custom Endpoint).
6. **`src/lib/components/clocks/ClockModal.svelte`**:
   - Create and edit threat clocks with title, 4/6/8/10/12 segment selector, category, and consequence text.
7. **`src/lib/components/clocks/ClockCompletionBanner.svelte` / Toast**:
   - Alert notification and visual trigger when a threat clock fills all segments.
8. **`src/lib/components/canvas/CanvasToolbar.svelte` / Auto-layout Utility**:
   - Auto-arrange / auto-layout utility (arranging nodes hierarchically or by cluster).

### 5.2 Required Modifications to Existing Files
1. **`src-tauri/Cargo.toml`**:
   - Add `tauri-plugin-fs = "2"` and `tauri-plugin-dialog = "2"`.
2. **`src-tauri/src/lib.rs`**:
   - Register `.plugin(tauri_plugin_fs::init())` and `.plugin(tauri_plugin_dialog::init())`.
3. **`src-tauri/capabilities/default.json`**:
   - Add permissions for filesystem and dialogs (`"fs:default"`, `"fs:allow-read-text-file"`, `"fs:allow-write-text-file"`, `"dialog:default"`).
4. **`src/lib/types/index.ts`**:
   - Expand `CampaignSettings` (AI provider, API keys, custom endpoint, theme), `ThreatClock` (category, consequenceText, isCompleted), `LoreEntry` (associatedNodeIds), `CanvasRelationEdge` (relationType, pathStyle), and `AtlasMap` (pins, imageUrl).
5. **`src/App.svelte` & `NavigationSidebar.svelte`**:
   - Connect sidebar tabs to switch main view between Canvas (`'board'`), Atlas/Map (`'maps'`), Timeline detail (`'calendar'`), Characters list (`'characters'`), Compendium (`'compendium'`), and Settings modal.
6. **`src/lib/components/canvas/CanvasView.svelte`**:
   - Register custom edge types (`customEdge: CustomLabeledEdge`).
   - Add auto-layout button and keyboard shortcuts.
7. **`src/lib/components/assistant/AiAssistantPanel.svelte`**:
   - Connect to real `aiAssistant.ts` service with BYOK settings and board context ingestion.

---

## 6. Verification Method & Reproducibility

To independently verify all findings in this survey:

1. **Verify TypeScript & Svelte compiler**:
   ```bash
   npx svelte-check --tsconfig ./tsconfig.json
   ```
   *Expected result: 0 errors, 0 warnings.*

2. **Verify Frontend Vite Production Build**:
   ```bash
   npm run build
   ```
   *Expected result: Clean compilation producing `dist/` bundle.*

3. **Verify Rust Desktop Backend**:
   ```bash
   cd src-tauri
   cargo check
   ```
   *Expected result: Clean compilation with 0 errors.*

4. **Verify Missing Tauri Plugins in Backend**:
   Inspect `src-tauri/Cargo.toml` line 20-26 and `src-tauri/src/lib.rs` line 1-17 to confirm absence of `tauri-plugin-fs` and `tauri-plugin-dialog`.

---
*Report generated and self-verified by `explorer_survey_1`.*
