# Dispatch: Explorer M1.1 (Custom Nodes & Modal Editing)

**Role**: Custom Node & Entity Editor Explorer
**Working Directory**: e:\DEV\Projects\Mural\.agents\explorer_m1_1
**Task**:
1. Read `e:\DEV\Projects\Mural\.agents\ORIGINAL_REQUEST.md` and `e:\DEV\Projects\Mural\PROJECT.md`.
2. Investigate `src/lib/components/canvas/nodes/EntityNode.svelte` and `src/lib/components/canvas/EditEntityModal.svelte` and `src/lib/types/index.ts`.
3. Design the full implementation blueprint for custom entity nodes (NPC, Faction, Location, Secret/Clue) with:
   - Category badges, Lucide icons, color themes, tags, secret blur/indicator.
   - Svelte Flow Handles (top, right, bottom, left) with smooth connectability.
   - In-place hover actions (edit modal, duplicate, delete) and selection glow.
   - Detailed modal editor (`EditEntityModal.svelte`) supporting title, category, subtitle, description, tags list, secret toggle, color picker, and custom icon selection.
4. Provide concrete code diffs and recommendations in `e:\DEV\Projects\Mural\.agents\explorer_m1_1\analysis.md` and deliver `handoff.md`.
