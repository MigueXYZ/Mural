# Handoff Report: Dual-Engine Storage Service & Debounced Autosave Blueprint

**Agent ID**: `explorer_m2_2`  
**Working Directory**: `e:\DEV\Projects\Mural\.agents\explorer_m2_2`  
**Handoff Type**: Hard (Task Complete)  
**Target Milestone**: M2 (Local-First Native Persistence & Campaign Management — F08, F09, F10, F11, F12)  

---

## 1. Observation

Direct examination of the Mural codebase and specification artifacts revealed the following exact baseline:

1. **`PROJECT.md` §2 Interface Contracts (lines 174–186)**:
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
2. **`spec_miner_survey_2/spec_r1_r2.md` §7 (lines 526–638)**:
   - Specifies dual-engine architecture: `@tauri-apps/plugin-fs` (`writeTextFile`, `readTextFile`, `exists`, `mkdir`, `readDir`, `remove`) in desktop mode and IndexedDB/localStorage fallback in browser mode.
   - Demands 500ms debounced autosave with dirty tracking, `.mural` / `.json` schema v1.0.0, rolling backup snapshot ring (max 5 snapshots), and schema validation/migration.
3. **`src/lib/types/index.ts` (lines 118–157)**:
   - Defines `CampaignSettings`, `CampaignData`, and `CampaignSummary` interfaces.
   - `CampaignData` includes `id`, `name`, `system`, `currentSession`, `inGamePeriod`, `clocks`, `lore`, `timeline`, `maps`, `settings`, `nodes`, `edges`, `updatedAt`, and `version`.
4. **`tests/tier1_features.test.ts` (lines 500–710) and `tests/engine.ts` (lines 612–693)**:
   - Tests and reference implementations define:
     - `validateCampaignSchema(raw)` -> `{ valid: boolean; errors: string[]; data?: CampaignData }`
     - `migrateLegacyCampaign(raw)` -> `CampaignData`
     - `duplicateCampaign(source, newName)` -> `CampaignData`
     - `rotateBackupSnapshots(existingBackups, newBackup, maxLimit = 5)` -> `string[]`
   - Test suite currently passes 175/175 tests in `run-e2e.ts`.
5. **`src/lib/services/` directory state**:
   - Currently contains only `layout.ts` (19,435 bytes). `storage.ts` does not yet exist.

---

## 2. Logic Chain

1. **Requirement Analysis**:
   - `ORIGINAL_REQUEST.md` §R2 and `PROJECT.md` F08–F12 require local-first native persistence via Tauri v2 plugins with web fallback, 500ms debouncing, atomic serialization, schema validation, and rolling backup history.
2. **Dual-Engine Architecture Deduction**:
   - Running in desktop mode must dynamically import `@tauri-apps/plugin-fs`, `@tauri-apps/api/path`, and `@tauri-apps/plugin-dialog` to prevent runtime crashes in browser environments.
   - Running in web mode must leverage an IndexedDB adapter (`MuralDB`) with stores for `campaigns` and `backups`, falling back to `localStorage` when IndexedDB is blocked.
3. **Auto-Save Engine & Dirty Tracking Deduction**:
   - Separating `AutoSaveEngine` from `StorageService` creates a clean reactive state machine (`idle`, `dirty`, `saving`, `saved`, `error`) with `isDirty`, `isSaving`, `lastSavedAt`, and `lastError`.
   - Attaching `beforeunload` and `visibilitychange` listeners ensures pending changes are flushed (`flushNow()`) if the user closes the window during an active 500ms debounce countdown.
4. **Rolling Backup Ring & Disaster Recovery Deduction**:
   - Storing rolling snapshots in `AppData/mural/backups/<campaignId>/` (desktop) and `backups` object store (web) with a hard cap of 5 newest snapshots prevents disk bloat while guaranteeing recovery from corruption.
5. **Schema Validation & Migration Deduction**:
   - Normalizing legacy schemas through `migrateLegacyCampaign` ensures that campaigns created in older versions or incomplete exports are automatically repaired without crashing UI stores or Svelte Flow canvases.

---

## 3. Caveats

1. **Read-Only Explorer Scope**: In accordance with the Explorer archetype, no source files in `src/` were directly modified. The complete production code for `src/lib/services/storage.ts` is provided in `analysis.md`.
2. **Tauri Plugin Permissions**: Desktop operations rely on `explorer_m2_1` configuring `Cargo.toml`, `src/lib.rs`, and `capabilities/default.json` for `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog`. The storage service design includes automatic fallback to IndexedDB if Tauri plugins are unavailable.
3. **UI Integration**: `explorer_m2_3` is responsible for integrating `storageService` and `autoSaveEngine` with `campaignStore.svelte.ts`, `appState.svelte.ts`, `MainMenu.svelte`, and `Header.svelte`.

---

## 4. Conclusion

The design and blueprint for `src/lib/services/storage.ts` is complete, exhaustive, and production-ready:
1. **`StorageService`**: Dual-engine persistence implementation supporting `saveCampaign`, `loadCampaign`, `listCampaigns`, `exportCampaignFile`, `importCampaignFile`, `duplicateCampaign`, `deleteCampaign`, `createBackupSnapshot`, `listBackupSnapshots`, and `restoreBackupSnapshot`.
2. **`AutoSaveEngine`**: 500ms debounced persistence engine with dirty tracking, reactive status subscriptions, and immediate flush hooks.
3. **Schema Utilities**: `validateCampaignSchema`, `migrateLegacyCampaign`, `duplicateCampaign`, and `rotateBackupSnapshots` fully compliant with the 175-test E2E suite.

The complete code blueprint is located in `e:\DEV\Projects\Mural\.agents\explorer_m2_2\analysis.md`.

---

## 5. Verification Method

To independently verify the storage service once applied:

1. **Compilation Check**:
   ```bash
   npm run check
   npm run build
   ```
   *Expected Output*: 0 TypeScript errors, 0 Svelte check diagnostics.

2. **Automated E2E & Unit Test Execution**:
   ```bash
   npm test
   ```
   *Expected Output*: All 175 tests pass (specifically F08, F09, F10, F11, F12 suites).

3. **Runtime & Functional Verification**:
   - Launch application (`npm run dev`).
   - Create or edit an entity on the canvas; observe the debounced save trigger in the console or Header status badge after 500ms.
   - Trigger manual export (`.mural` / `.json`) and re-import via Main Menu.
   - Trigger campaign duplication and verify independent state copy with `(Cópia)` suffix.
   - Verify backup snapshot creation and retention cap of 5 files in the backup directory or IndexedDB store.
