# Dispatch: Explorer M1.3 (Auto-Layout Engine & Canvas View Controls)

**Role**: Graph Layout & Canvas Integration Explorer
**Working Directory**: e:\DEV\Projects\Mural\.agents\explorer_m1_3
**Task**:
1. Read `e:\DEV\Projects\Mural\.agents\ORIGINAL_REQUEST.md` and `e:\DEV\Projects\Mural\PROJECT.md`.
2. Design the full implementation blueprint for:
   - `src/lib/services/layout.ts`: Robust auto-layout algorithms for Svelte Flow nodes and edges (Hierarchical DAG layout using topological layering / rank calculation, plus Force-directed / Grid auto-arrangement fallback).
   - `src/lib/components/canvas/CanvasView.svelte`:
     - Register `nodeTypes` and `edgeTypes`.
     - Multi-selection marquee (`selectionMode="partial"`, group dragging, delete selected).
     - Toolbar with buttons: Auto-Arrange / Auto-Layout, Add NPC, Add Faction, Add Location, Add Secret, Fit View, Zoom Controls.
     - Connection lifecycle handler (`handleConnect` creating typed `CanvasRelationEdgeData`).
     - Edge click / double-click event handling to open `EditEdgeModal.svelte`.
3. Provide concrete code diffs and recommendations in `e:\DEV\Projects\Mural\.agents\explorer_m1_3\analysis.md` and deliver `handoff.md`.

## 2026-08-31T20:50:31Z
You are explorer_m1_3. Working directory: e:\DEV\Projects\Mural\.agents\explorer_m1_3.
Read ORIGINAL_REQUEST.md, PROJECT.md, and your dispatch e:\DEV\Projects\Mural\.agents\explorer_m1_3\DISPATCH.md.
Design complete blueprint for layout.ts (auto-arrange algorithms) and CanvasView.svelte integration. Write analysis to analysis.md and deliver handoff.md. Send a message to parent when done.

