# Dispatch: Explorer M2.2 (Storage Service & Debounced Autosave Engine)

**Role**: Persistence Architecture & Storage Engine Explorer
**Working Directory**: e:\DEV\Projects\Mural\.agents\explorer_m2_2
**Task**:
1. Read `e:\DEV\Projects\Mural\.agents\ORIGINAL_REQUEST.md`, `PROJECT.md`, and `spec_miner_survey_2/spec_r1_r2.md`.
2. Design `src/lib/services/storage.ts`:
   - Dual-engine storage: Native Tauri FS (@tauri-apps/plugin-fs) when in Tauri runtime, seamless IndexedDB/localStorage fallback when in web browser mode.
   - 500ms debounced autosave with dirty tracking (`isDirty`, `isSaving`, `lastSavedAt`).
   - `.mural` / `.json` atomic file serialization with schema versioning (`version: "1.0.0"`).
   - Rolling backup snapshot ring (keeps last 5 snapshots to prevent data loss).
   - Schema validation on import with graceful repair/fallback for older formats.
3. Provide complete code blueprint in `analysis.md` and deliver `handoff.md`.
