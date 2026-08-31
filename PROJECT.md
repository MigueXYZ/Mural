# Project: Mural (OrdemTools)

## Architecture
Mural (OrdemTools) is a modern, local-first Tabletop RPG (TTRPG) Game Master (GM) Screen, investigation conspiracy board, and campaign manager.
- **Frontend Stack**: Svelte 5 (Runes `$state`, `$derived`, `$effect`), Svelte Flow (`@xyflow/svelte`), Tailwind CSS v4, Lucide Svelte.
- **Desktop Runtime**: Tauri v2 with `@tauri-apps/api`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`, and Rust backend crates.
- **State Management**: Svelte 5 Runes centralized reactive store (`campaignStore.svelte.ts`) with reactive dirty tracking and debounced local-first persistence (`storage.ts`).
- **Graph & Canvas Subsystem**: Custom Node types (`EntityNode.svelte` for NPC, Faction, Location, Secret/Clue) and Custom Edge types (`CustomLabeledEdge.svelte` for semantic relationships with editable labels, relationship semantics, and deletion).
- **GM Operational Suite**:
  - Segmented Threat Clocks (4, 6, 8, 10, 12 slices) with mathematical SVG arcs, click-to-advance, and completion triggers.
  - Lore & Clue Registry with instant `SABIDO` vs `SEGREDO` toggles and bidirectional node linking.
  - Timeline subsystem tracking session numbers and in-game chronological markers.
  - Atlas / Map subsystem with normalized percentage pin coordinates linked to canvas nodes.
- **AI Session Assistant Subsystem**:
  - Context serializer pruning active board state (visible nodes, active clocks, secrets, connections) into compressed payloads (< 1,200 tokens).
  - BYOK Multi-provider engine supporting Google Gemini, OpenAI, Anthropic, local Ollama (`http://localhost:11434`), and offline heuristic generator.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Entity Node Specialization | NPC, Faction, Location, Secret/Clue custom nodes with categories, tags, color themes | M1 | ORIGINAL_REQUEST §R1 |
| F02 | In-Place & Modal Entity Editing | Quick hover action bar and detailed modal editor for titles, notes, categories, tags | M1 | ORIGINAL_REQUEST §R1 |
| F03 | Custom Semantic Edge Connectors | Editable labels (e.g. "é aliado de", "esconde-se sob"), custom path types (smoothstep, bezier, straight), relation types | M1 | ORIGINAL_REQUEST §R1 |
| F04 | Inline Edge Management | Delete edge button on hover/click, relation category badges | M1 | ORIGINAL_REQUEST §R1 |
| F05 | Canvas Multi-selection & Group Movement | Marquee selection, multi-node dragging, group delete | M1 | ORIGINAL_REQUEST §R1 |
| F06 | Canvas Auto-Layout Engine | Hierarchical DAG and force-directed auto-arrange utilities | M1 | ORIGINAL_REQUEST §R1 |
| F07 | Canvas Navigation & Shortcuts | Zoom/pan controls, fit view, minimap, keyboard shortcuts | M1 | ORIGINAL_REQUEST §R1 |
| F08 | Tauri v2 FS & Dialog Backend Setup | `Cargo.toml`, `lib.rs`, `capabilities/default.json` configured for native fs/dialog | M2 | ORIGINAL_REQUEST §R2 |
| F09 | Local-First Storage & 500ms Autosave | Debounced auto-save engine (500ms) with dirty tracking and web storage fallback | M2 | ORIGINAL_REQUEST §R2 |
| F10 | Campaign Serialization (.mural / .json) | Versioned schema v1.0.0 for full campaign export and atomic save | M2 | ORIGINAL_REQUEST §R2 |
| F11 | Campaign File Import & Validation | Native file picker to load .mural/.json files with schema validation | M2 | ORIGINAL_REQUEST §R2 |
| F12 | Campaign Duplication & Backup History | In-app campaign duplication and rolling backup snapshot ring | M2 | ORIGINAL_REQUEST §R2 |
| F13 | Main Menu Campaign Hub | Campaign cards, preset templates (Blank, Mystery, Faction, One-Shot), search filter | M2 | ORIGINAL_REQUEST §R2 |
| F14 | Mathematical SVG Threat Clocks (4/6/8/10/12) | Parametric SVG segmented ring graphics for 4, 6, 8, 10, 12 slices | M3 | ORIGINAL_REQUEST §R3 |
| F15 | Interactive Clock Stepping & Completion | Click to advance, right-click to decrement, pulse animation & trigger alert on full | M3 | ORIGINAL_REQUEST §R3 |
| F16 | Dedicated Clock Creation Dialog | Modal to create clocks with title, total segments (4, 6, 8, 10, 12), and consequence note | M3 | ORIGINAL_REQUEST §R3 |
| F17 | Lore & Clue Visibility Toggles | Instant toggle between SABIDO (green) and SEGREDO (red) with real-time UI updates | M3 | ORIGINAL_REQUEST §R3 |
| F18 | Lore Entity Association & Filter Tabs | Link lore items to canvas nodes; filter by All / Sabido / Segredo; search bar | M3 | ORIGINAL_REQUEST §R3 |
| F19 | Interactive Session Timeline | Session markers, in-game period tracking, active session context switching | M3 | ORIGINAL_REQUEST §R3 |
| F20 | Interactive Atlas & Map Subsystem | Map view with zoom/pan, custom map image/preset, pin placement | M3 | ORIGINAL_REQUEST §R3 |
| F21 | Atlas Pin Entity Linking | Pins linked to canvas entities with "Ver no Mural" deep navigation | M3 | ORIGINAL_REQUEST §R3 |
| F22 | App Navigation & View Routing | Sidebar tab routing between Canvas (Mural), Atlas (Map), and Settings | M3 | ORIGINAL_REQUEST §R3 |
| F23 | "A mesa descarrilou?" Emergency AI Assistant | Dedicated emergency UI panel for instant narrative rescue hooks | M4 | ORIGINAL_REQUEST §R4 |
| F24 | Board Context Payload Serializer | Intelligent payload builder pruning canvas nodes, clocks, secrets (< 1,200 tokens) | M4 | ORIGINAL_REQUEST §R4 |
| F25 | BYOK Multi-Provider Client Engine | Polymorphic adapter for Google Gemini, OpenAI, Anthropic, local Ollama, and offline mock | M4 | ORIGINAL_REQUEST §R4 |
| F26 | BYOK Settings Configuration Modal | UI to configure provider, API keys, models, Ollama endpoints, with "Testar Conexão" | M4 | ORIGINAL_REQUEST §R4 |
| F27 | AI Narrative Actionable Hooks | One-click actions to add suggestions to Lore (`+ Adicionar ao Lore`), advance clocks, copy | M4 | ORIGINAL_REQUEST §R4 |
| F28 | Automated Test Suite (Tiers 1-4) | Comprehensive opaque-box test runner for features, boundaries, pairwise, scenarios | E2E | ORIGINAL_REQUEST Acceptance |
| F29 | Clean Build & Compiler Zero-Error Gate | 0 svelte-check errors, 0 npm run build errors, 0 cargo check errors | M5 | ORIGINAL_REQUEST Acceptance |
| F30 | Adversarial Coverage Hardening (Tier 5) | White-box stress testing and edge-case bug fixes | M5 | ORIGINAL_REQUEST Acceptance |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Test harness, runner, and test suites (Tiers 1-4: Features, Boundaries, Combinations, Scenarios) | none | DONE |
| M1 | Canvas & Relationship Graph Engine | F01, F02, F03, F04, F05, F06, F07 (Custom nodes, custom labeled edges, auto-layout, selection) | none | DONE |
| M2 | Persistence & Campaign Management | F08, F09, F10, F11, F12, F13 (Tauri FS/Dialog, 500ms debounced autosave, .mural export/import, menu) | none | DONE |
| M3 | Interactive GM Operational Suite | F14, F15, F16, F17, F18, F19, F20, F21, F22 (Threat clocks 4-12, Lore SABIDO/SEGREDO, Timeline, Atlas) | M1 | DONE |
| M4 | Context-Aware AI Session Assistant | F23, F24, F25, F26, F27 (Emergency assistant, board context serializer, BYOK engine, action hooks) | M1, M3 | DONE |
| M5 | Final Milestone: E2E Pass & Hardening | F28, F29, F30 (100% E2E test pass across Tiers 1-5, Tier 5 Adversarial Hardening, clean build verification) | E2E, M1, M2, M3, M4 | DONE |

---

## Interface Contracts

### 1. Data Models (`src/lib/types/index.ts`)
```typescript
export type EntityCategory = 'npc' | 'faction' | 'location' | 'secret';

export interface EntityNodeData {
  title: string;
  category: EntityCategory;
  subtitle?: string;
  description?: string;
  tags?: string[];
  isSecret?: boolean;
  colorTheme?: string;
  icon?: string;
}

export type RelationType = 'allied' | 'hostile' | 'secret' | 'neutral' | 'investigates' | 'custom';
export type EdgePathType = 'smoothstep' | 'bezier' | 'straight';

export interface CanvasRelationEdgeData {
  label: string;
  relationType: RelationType;
  pathType?: EdgePathType;
  bidirectional?: boolean;
  notes?: string;
}

export type ClockSegmentCount = 4 | 6 | 8 | 10 | 12;

export interface ThreatClock {
  id: string;
  title: string;
  totalSegments: ClockSegmentCount;
  filledSegments: number;
  consequence?: string;
  category?: string;
  createdAt: number;
}

export type LoreVisibility = 'SABIDO' | 'SEGREDO';

export interface LoreEntry {
  id: string;
  title: string;
  content: string;
  visibility: LoreVisibility;
  associatedNodeIds?: string[];
  sessionNumber?: number;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TimelineMarker {
  id: string;
  sessionNumber: number;
  title: string;
  description?: string;
  inGameDate?: string;
  isCurrent?: boolean;
  timestamp: number;
}

export interface MapPin {
  id: string;
  targetNodeId: string;
  xPercent: number; // 0.0 - 100.0
  yPercent: number; // 0.0 - 100.0
  label?: string;
}

export interface MapData {
  id: string;
  title: string;
  imageUrl: string;
  pins: MapPin[];
}

export interface CampaignSettings {
  aiProvider: 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'mock';
  apiKey?: string;
  modelName?: string;
  ollamaEndpoint?: string;
  theme: 'dark' | 'ordem' | 'cyberpunk';
  autoSaveIntervalMs: number;
}

export interface CampaignData {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  version: string; // "1.0.0"
  nodes: any[]; // Svelte Flow Node<EntityNodeData>[]
  edges: any[]; // Svelte Flow Edge<CanvasRelationEdgeData>[]
  clocks: ThreatClock[];
  lore: LoreEntry[];
  timeline: TimelineMarker[];
  maps: MapData[];
  settings: CampaignSettings;
}
```

### 2. Storage Service (`src/lib/services/storage.ts`)
```typescript
export interface IStorageService {
  saveCampaign(campaign: CampaignData): Promise<void>;
  loadCampaign(id: string): Promise<CampaignData | null>;
  listCampaigns(): Promise<Array<{ id: string; name: string; updatedAt: number; nodeCount: number }>>;
  exportCampaignFile(campaign: CampaignData, filePath?: string): Promise<string>;
  importCampaignFile(fileContentOrPath: string): Promise<CampaignData>;
  duplicateCampaign(sourceId: string, newName: string): Promise<CampaignData>;
  deleteCampaign(id: string): Promise<void>;
  createBackupSnapshot(campaign: CampaignData): Promise<void>;
}
```

### 3. AI Provider Interface (`src/lib/services/ai/aiProvider.ts`)
```typescript
export interface AiPromptPayload {
  scenarioContext: string;
  visibleEntities: Array<{ title: string; category: string; description?: string }>;
  hiddenSecrets: Array<{ title: string; description?: string }>;
  activeThreats: Array<{ title: string; filled: number; total: number; consequence?: string }>;
  relations: Array<{ source: string; target: string; label: string }>;
  gmQuery: string;
}

export interface AiHookOption {
  type: 'immediate_consequence' | 'alternative_clue' | 'threat_escalation';
  title: string;
  description: string;
  actionPayload?: {
    type: 'add_lore' | 'advance_clock';
    data: any;
  };
}

export interface IAiProvider {
  generateRescueOptions(payload: AiPromptPayload, settings: CampaignSettings): Promise<AiHookOption[]>;
  testConnection(settings: CampaignSettings): Promise<boolean>;
}
```

---

## Code Layout
```
e:\DEV\Projects\Mural\
├── src/
│   ├── lib/
│   │   ├── types/
│   │   │   └── index.ts                 # Canonical TypeScript contracts
│   │   ├── stores/
│   │   │   ├── campaignStore.svelte.ts  # Reactive Svelte 5 Runes campaign store
│   │   │   └── uiStore.svelte.ts        # UI routing, active modal, active view
│   │   ├── services/
│   │   │   ├── storage.ts               # Debounced autosave, Tauri FS & fallback
│   │   │   ├── layout.ts                # Graph auto-layout algorithms
│   │   │   └── ai/
│   │   │       ├── aiProvider.ts        # AI polymorphic provider interface
│   │   │       ├── geminiProvider.ts    # Google Gemini client
│   │   │       ├── openAiProvider.ts    # OpenAI client
│   │   │       ├── anthropicProvider.ts # Anthropic client
│   │   │       ├── ollamaProvider.ts    # Local Ollama client
│   │   │       ├── mockProvider.ts      # Offline heuristic generator
│   │   │       └── contextSerializer.ts # Board context compressor
│   │   └── components/
│   │       ├── canvas/
│   │       │   ├── CanvasView.svelte    # Svelte Flow canvas container
│   │       │   ├── nodes/
│   │       │   │   └── EntityNode.svelte # Custom entity node component
│   │       │   ├── edges/
│   │       │   │   └── CustomLabeledEdge.svelte # Semantic edge with edit/delete
│   │       │   ├── EditEntityModal.svelte   # Entity node modal editor
│   │       │   └── EditEdgeModal.svelte     # Edge relation modal editor
│   │       ├── clocks/
│   │       │   ├── ThreatClocksPanel.svelte # Clocks dock & management
│   │       │   ├── ThreatClockItem.svelte   # SVG segmented ring graphic
│   │       │   ├── CreateClockModal.svelte  # 4/6/8/10/12 segment selector
│   │       │   └── ClockAlertModal.svelte   # Clock completion consequence trigger
│   │       ├── lore/
│   │       │   ├── LorePanel.svelte         # Lore registry dock
│   │       │   ├── LoreEntryItem.svelte     # SABIDO / SEGREDO card & toggle
│   │       │   └── EditLoreModal.svelte     # Create / edit lore entry
│   │       ├── timeline/
│   │       │   └── BottomTimeline.svelte    # Interactive chronological timeline
│   │       ├── atlas/
│   │       │   ├── AtlasView.svelte         # Interactive map view with pan/zoom
│   │       │   ├── MapPinItem.svelte        # Normalized percentage pin
│   │       │   └── CreatePinModal.svelte    # Pin creator linked to entity
│   │       ├── assistant/
│   │       │   ├── AiAssistantPanel.svelte  # Emergency "A mesa descarrilou?" dock
│   │       │   └── AiSettingsModal.svelte   # BYOK API settings modal
│   │       ├── menu/
│   │       │   ├── MainMenu.svelte          # Campaign manager hub & presets
│   │       │   └── NewCampaignModal.svelte  # New campaign creator
│   │       └── layout/
│   │           ├── Header.svelte            # Top bar with title, save status, menu
│   │           └── NavigationSidebar.svelte # Tab switcher (Canvas, Atlas, Settings)
│   ├── App.svelte                       # Main application shell & tab router
│   ├── main.ts                          # App entry point
│   └── app.css                          # Tailwind CSS v4 & theme variables
├── src-tauri/
│   ├── Cargo.toml                       # Rust dependencies (tauri-plugin-fs/dialog)
│   ├── src/
│   │   ├── lib.rs                       # Plugin registrations
│   │   └── main.rs                      # Tauri runtime entry
│   └── capabilities/
│       └── default.json                 # Tauri permission grants
├── tests/                               # E2E test suites & test runner
│   ├── run-e2e.ts                       # Automated test runner
│   ├── tier1_features.test.ts           # Tier 1 Feature coverage
│   ├── tier2_boundaries.test.ts         # Tier 2 Boundary & Corner cases
│   ├── tier3_combinations.test.ts       # Tier 3 Cross-feature combinations
│   └── tier4_scenarios.test.ts          # Tier 4 Real-world GM scenarios
└── package.json
```
