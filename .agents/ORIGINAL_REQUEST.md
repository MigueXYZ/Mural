# Original User Request

## 2026-08-31T20:45:54Z

Mural (OrdemTools) is a modern, local-first Tabletop RPG (TTRPG) Game Master (GM) Screen, investigation conspiracy board, and campaign manager built with Svelte 5 (Runes), Svelte Flow (@xyflow/svelte), Tailwind CSS, and Tauri v2.

Working directory: e:\DEV\Projects\Mural
Integrity mode: development

## Requirements

### R1. Advanced Canvas & Relationship Graph Engine
- Support rich interaction for entity nodes (NPC, Faction, Location, Secret/Clue) with in-place/modal editing, custom icons/tags, and color themes.
- Implement editable semantic edge connectors (e.g.  é aliado de, esconde-se sob, investiga) with custom labels, curved/straight paths, and deletion.
- Add multi-selection, group movement, canvas auto-layout / auto-arrange, and zoom/pan shortcuts.

### R2. Local-First Native Persistence & Campaign Management
- Implement robust local persistence using Tauri v2 file system plugins (@tauri-apps/plugin-fs and native dialogs).
- Ensure auto-saving with debouncing (500ms), manual save/load of .mural / .json files, and backup history to prevent data loss.
- Support importing, exporting, and duplicating campaigns seamlessly from the Main Menu.

### R3. Interactive GM Operational Suite (Clocks, Lore, Timeline, Atlas)
- Fully functional interactive Threat Clocks with SVG segmented ring graphics (4, 6, 8, 10, 12 slices) with click-to-advance and completion triggers.
- Lore and clue registry with quick visibility toggles (SABIDO vs SEGREDO).
- Interactive timeline tracking session numbers and in-game chronological markers.
- Interactive Map/Atlas view with pin placement linked to canvas entities.

### R4. Context-Aware AI GM Session Assistant
- Implement the A mesa descarrilou? emergency AI assistant.
- Ingest current active board context (visible nodes, active threat clocks, hidden secrets) into a compressed prompt payload.
- Provide a configurable BYOK settings interface (supporting Gemini API, OpenAI, Anthropic, or 100% local Ollama via custom endpoints) to generate actionable improvisation hooks.

## Acceptance Criteria

### Build & Integrity
- [ ] Application builds cleanly with 0 TypeScript/Svelte errors (npx svelte-check --tsconfig ./tsconfig.json and npm run build).
- [ ] Desktop build compiles with 0 Rust errors (cargo check in src-tauri).

### Functional Verification
- [ ] Creating, editing, connecting, and deleting nodes and edges functions smoothly and persists across application restarts.
- [ ] Threat clocks accurately increment, decrement, and display segment states.
- [ ] Lore entries toggle between SABIDO and SEGREDO and update in real-time.
- [ ] Campaign files can be exported to .mural / .json and re-imported without corruption.
- [ ] AI Assistant generates 3 contextual narrative rescue options when provided with GM input.
