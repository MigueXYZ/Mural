# Handoff Report: Specification Mining for R1 & R2

**Agent:** `spec_miner_survey_2`  
**Working Directory:** `e:\DEV\Projects\Mural\.agents\spec_miner_survey_2`  
**Date:** 2026-08-31T20:50:00Z  
**Type:** Hard Handoff (Task Complete)

---

## 1. Observation

1. **User Request & Architecture Context**:
   - `e:\DEV\Projects\Mural\.agents\ORIGINAL_REQUEST.md:12-21` specifies R1 (Advanced Canvas & Relationship Graph Engine: custom node types NPC/Faction/Location/Secret, editable semantic edge connectors, auto-layout, multi-selection, zoom/pan) and R2 (Local-First Persistence: Tauri v2 FS, debounced auto-save 500ms, .mural/.json schema, import/export/duplicate).
   - `e:\DEV\Projects\Mural\context_ai.md:100-240` defines initial TypeScript interfaces for `Campaign`, `CanvasEntityNode`, `CanvasRelationEdge`, `ThreatClock`, `LoreEntry`, `TimelineMarker`.
   - `e:\DEV\Projects\Mural\package.json:13-21` confirms dependencies: `@tauri-apps/api@^2.2.0`, `@tauri-apps/plugin-dialog@^2.2.0`, `@tauri-apps/plugin-fs@^2.2.0`, `@xyflow/svelte@^0.1.24`, `clsx@^2.1.1`, `lucide-svelte@^0.475.0`, `tailwind-merge@^3.0.1`.
   - `e:\DEV\Projects\Mural\src-tauri\Cargo.toml:20-25` shows `tauri = { version = "2.11.3" }`, `tauri-plugin-log = "2"`. Note that `tauri-plugin-fs` and `tauri-plugin-dialog` need to be explicitly registered in `Cargo.toml`, `src-tauri/src/lib.rs`, and `capabilities/default.json` for full desktop Tauri runtime operations.

2. **Existing Implementation Probing**:
   - `src/lib/types/index.ts:1-68` contains preliminary schemas for `EntityNodeData`, `ThreatClock`, `LoreEntry`, `TimelineMarker`, and `CampaignData`.
   - `src/lib/stores/campaignStore.svelte.ts:1-119` implements Svelte 5 Runes state with `$state` and writable stores for Svelte Flow nodes and edges.
   - `src/lib/components/canvas/CanvasView.svelte:1-144` mounts `<SvelteFlow>` with node creation toolbar, background grid, minimap, controls, and connection handler.
   - `src/lib/components/canvas/nodes/EntityNode.svelte:1-109` renders 4 handles, hover action bar (edit, delete), type category colors, and title/description.
   - `src/lib/components/canvas/EditEntityModal.svelte:1-184` provides modal editing of entity category, title, subtitle, description, and secret toggle.
   - `src/lib/components/menu/MainMenu.svelte:1-290` provides campaign listing, starter presets (Blank, Mystery, Faction, One-Shot), search filter, and import/export triggers.

3. **Compiler & Diagnostic Verification**:
   - Running `npm run check` (`svelte-check --tsconfig ./tsconfig.json`): completed with **0 errors and 0 warnings**.
   - Running `cargo check` in `src-tauri`: completed with **0 errors** (finished in 2.37s).

---

## 2. Logic Chain

1. **Requirement Mapping (R1 & R2)**:
   - Observation 1 establishes the target functional scope: R1 requires rich node specializations (NPC, Faction, Location, Secret), custom editable semantic edges (labels, path types, relation types, deletion), auto-layout algorithms (DAG and force-directed), multi-selection, group drag, and zoom/pan shortcuts.
   - Observation 1 establishes R2: Tauri v2 FS integration, 500ms debounced auto-saving, schema definition for `.mural` / `.json`, rolling backup snapshots, and campaign management actions (New, Open, Duplicate, Export, Import, Delete).
2. **Interface & Architectural Synthesis**:
   - From Observations 1 and 2, the preliminary interfaces in `src/lib/types/index.ts` needed expansion to support comprehensive typed payloads for `NpcEntityData`, `FactionEntityData`, `LocationEntityData`, `SecretEntityData`, `CanvasRelationEdgeData` (with `relationType`, `pathType`, `bidirectional`, `animated`), `CampaignSettings`, and `BackupSnapshot`.
3. **Specification Output Generation**:
   - In `spec_r1_r2.md`, we documented:
     - 27 discovered features with explicit inputs, outputs, error behaviors, and discovery origins.
     - 12 edge cases and resilience behaviors (atomic edge pruning on node delete, self-loop rejection, debounce thrashing protection, schema migration, and permission fallback).
     - Component architecture and state management model with Svelte 5 Runes and Svelte Flow.
     - Full data models, TypeScript interfaces, auto-layout algorithms, and Tauri v2 storage pipeline.

---

## 3. Caveats

- **Tauri Plugin Rust Crates**: While `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog` are installed in `package.json`, when building the desktop executable, `Cargo.toml` in `src-tauri` must also declare `tauri-plugin-fs = "2"` and `tauri-plugin-dialog = "2"` and register them in `src/lib.rs`.
- **R3 & R4 Modules**: Operational suite (Clocks, Lore, Timeline, Atlas) and AI Assistant are scoped under R3 and R4 (handled in survey 3). R1 and R2 provide clean integration hooks for these modules.

---

## 4. Conclusion

The specification for **R1 (Advanced Canvas & Relationship Graph Engine)** and **R2 (Local-First Native Persistence & Campaign Management)** is fully mined, synthesized, and documented in `e:\DEV\Projects\Mural\.agents\spec_miner_survey_2\spec_r1_r2.md`. All data structures, component hierarchies, auto-layout algorithms, debouncing mechanisms, and edge case rules are ready for subsequent design and implementation phases.

---

## 5. Verification Method

To independently verify the specification and code integrity:

1. **Verify Svelte & TypeScript Integrity**:
   ```powershell
   npm run check
   ```
   *Expected result: `svelte-check found 0 errors and 0 warnings`.*

2. **Verify Desktop Rust Integrity**:
   ```powershell
   cd e:\DEV\Projects\Mural\src-tauri
   cargo check
   ```
   *Expected result: `Finished dev profile target(s)` with 0 errors.*

3. **Inspect Specification Artifact**:
   - Inspect `e:\DEV\Projects\Mural\.agents\spec_miner_survey_2\spec_r1_r2.md` to confirm the presence of all 27 discovered features, 12 edge cases, complete TypeScript contracts, and component architecture diagrams.
