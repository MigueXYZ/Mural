# Dispatch: Explorer M2.3 (Campaign Management UI & Store Integration)

**Role**: Campaign UI & Store Integration Explorer
**Working Directory**: e:\DEV\Projects\Mural\.agents\explorer_m2_3
**Task**:
1. Read `e:\DEV\Projects\Mural\.agents\ORIGINAL_REQUEST.md`, `PROJECT.md`, and `spec_miner_survey_2/spec_r1_r2.md`.
2. Design the campaign management UI and reactive integration:
   - `src/lib/components/menu/MainMenu.svelte`: List local campaigns, search filter, active campaign indicator, action buttons (Open, Duplicate, Export .mural/.json, Delete), starter templates (Blank, Mystery, Faction, One-Shot), and Import .mural/.json button.
   - `src/lib/components/menu/NewCampaignModal.svelte`: Modal for creating new campaign with template selection and title/description.
   - `src/lib/components/layout/Header.svelte`: Campaign title display, auto-save status indicator (Salvando... / Salvo há X min / Modificado), Manual Save button (`Ctrl+S`), Menu toggle button.
   - `src/lib/stores/campaignStore.svelte.ts`: Integration with `storage.ts` for reactive auto-saving, campaign loading/saving, and state persistence.
3. Provide complete code blueprint in `analysis.md` and deliver `handoff.md`.
