# Dispatch: Worker M1 (Canvas & Relationship Graph Engine)

**Role**: Frontend Graph Engine Implementer
**Working Directory**: e:\DEV\Projects\Mural\.agents\worker_m1
**Reference Files**:
- `e:\DEV\Projects\Mural\.agents\ORIGINAL_REQUEST.md` (Read thoroughly first!)
- `e:\DEV\Projects\Mural\PROJECT.md`
- `e:\DEV\Projects\Mural\.agents\explorer_m1_1\analysis.md`
- `e:\DEV\Projects\Mural\.agents\explorer_m1_2\analysis.md`
- `e:\DEV\Projects\Mural\.agents\explorer_m1_3\analysis.md`

**Write Ownership**:
- `src/lib/types/index.ts`
- `src/lib/services/layout.ts`
- `src/lib/utils/icons.ts` (or `src/lib/services/icons.ts`)
- `src/lib/components/canvas/nodes/EntityNode.svelte`
- `src/lib/components/canvas/edges/CustomLabeledEdge.svelte`
- `src/lib/components/canvas/EditEntityModal.svelte`
- `src/lib/components/canvas/EditEdgeModal.svelte`
- `src/lib/components/canvas/CanvasView.svelte`
- `src/lib/stores/campaignStore.svelte.ts`

**Mandatory Integrity Warning**:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

**Tasks**:
1. Implement the complete Canvas & Relationship Graph Engine per the specifications in M1 Explorer analyses:
   - `src/lib/types/index.ts`: Full types for `EntityNodeData`, `CanvasRelationEdgeData`, `RelationType`, `EdgePathType`, `ClockSegmentCount`, `LoreEntry`, etc.
   - `src/lib/utils/icons.ts`: Centralized Lucide icon mapping registry.
   - `src/lib/components/canvas/nodes/EntityNode.svelte`: Rich custom node with 4 handles (top, right, bottom, left), category badges, icon resolver, tags, secret blur/tint, hover action bar (Edit, Duplicate, Toggle Secret, Delete), reactive selection glow.
   - `src/lib/components/canvas/edges/CustomLabeledEdge.svelte`: Custom edge component registered in `edgeTypes` with editable label pill (click/double click), semantic relationship colors (allied, hostile, secret, neutral, investigates, custom), smoothstep/bezier/straight paths, inline delete button (`×`).
   - `src/lib/components/canvas/EditEntityModal.svelte`: Modal editor for category, title, subtitle, description, tags, icon, color theme, and secret toggle with live preview.
   - `src/lib/components/canvas/EditEdgeModal.svelte`: Modal editor for label, relationType, pathType, bidirectional flag, and GM notes.
   - `src/lib/services/layout.ts`: Robust auto-layout algorithms (Hierarchical DAG layout and Force-directed/Grid auto-arrangement).
   - `src/lib/stores/campaignStore.svelte.ts`: Node/edge state management with `addNode`, `updateNode`, `deleteNode`, `duplicateNode`, `toggleNodeSecret`, `addEdge`, `updateEdge`, `deleteEdge`.
   - `src/lib/components/canvas/CanvasView.svelte`: Register `nodeTypes` and `edgeTypes`, marquee multi-selection, floating toolbar (Auto-arrange, Add NPC/Faction/Location/Secret, Fit view, Zoom), connection handler creating `CanvasRelationEdgeData`, and edge/node click handlers opening edit modals.
2. Run `npm run check` and `npm run build` and `cargo check --manifest-path src-tauri/Cargo.toml` to verify zero errors.
3. Deliver `handoff.md` with complete verification output. Send message to parent when done.
