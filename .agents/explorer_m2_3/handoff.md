# Handoff Report: Campaign Management UI & Store Persistence Integration (M2.3)

**Document Version:** 1.0.0  
**Author:** Explorer M2.3 (`explorer_m2_3`)  
**Date:** 2026-08-31  
**Milestone:** M2 (Local-First Persistence & Campaign Management)  
**Working Directory:** `e:\DEV\Projects\Mural\.agents\explorer_m2_3`  

---

## 1. Observation

1. **Existing Code State**:
   - `src/lib/stores/campaignStore.svelte.ts` (Lines 13-234): Currently holds active campaign state, writable `nodes` and `edges`, and helper mutators, but lacks dirty tracking (`isDirty`, `isSaving`, `lastSavedAt`), automated 500ms debounce scheduler, manual save (`saveCurrentCampaign`), and lifecycle hooks (`beforeunload`).
   - `src/lib/components/layout/Header.svelte` (Lines 1-105): Currently displays campaign title, system tag, search input, quick note button, and export button, but lacks the real-time auto-save status badge ("Salvando...", "Salvo há X min", "Modificado"), manual save button, and `Ctrl+S` / `Cmd+S` keyboard trap.
   - `src/lib/components/menu/MainMenu.svelte` (Lines 1-290): Implements campaign listing and starter templates, but needs clean dual-mode file import (Tauri native open dialog with fallback to `<input type="file">`), active campaign resume banner, and integration with `NewCampaignModal.svelte`.
   - `src/lib/components/menu/NewCampaignModal.svelte` (Lines 1-171): Implements a modal dialog for new campaign creation with system selector, in-game period, description, and template selector.
   - `src/lib/stores/appState.svelte.ts` (Lines 1-140): Manages top-level navigation (`menu` vs `campaign`), campaign list, search filtering, template instantiation, and duplication/deletion.
2. **Build and Test Verification**:
   - Running `npx tsx tests/run-e2e.ts` passed 175/175 tests across Tiers 1-4.
   - Running `npm run check` completed with 0 errors and 0 warnings.
   - Running `npm run build` compiled 3,719 modules cleanly in Vite.
3. **M2.1 and M2.2 Coordination**:
   - M2.1 configures Tauri v2 native capabilities (`@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog`).
   - M2.2 specifies `src/lib/services/storage.ts` (`storageService`) implementing `saveCampaign`, `loadCampaign`, `openNativeFileDialog`, `exportCampaignFile`, and rolling backup snapshots.

---

## 2. Logic Chain

1. **Autosave & Persistence Bridge**:
   - From *Observation 1*, `campaignStore.svelte.ts` mutators (adding/updating/deleting nodes, edges, threat clocks, lore, timeline markers) modify reactive state in-memory.
   - To satisfy Requirement R2 and Feature F09 without disk thrashing during fast user inputs, every state mutation must call `markDirty()`, which sets `isDirty = true` and kicks off a 500ms debounce timer via `scheduleAutoSave()`.
   - When the debounce timer triggers, `saveCurrentCampaign()` sets `isSaving = true`, calls `storageService.saveCampaign(payload)`, and on completion sets `isDirty = false`, `isSaving = false`, and records `lastSavedAt = Date.now()`.
2. **Visual Autosave Feedback**:
   - From *Observation 1*, the GM needs clear confidence that their work is continuously persisted.
   - In `Header.svelte`, a reactive status badge uses `$derived.by` to evaluate `campaignStore.isSaving`, `campaignStore.isDirty`, and `campaignStore.lastSavedAt`.
   - A 10-second `setInterval` updates relative time calculation (`Salvo agora`, `Salvo há X min`, `Salvo às HH:MM`), while `Ctrl+S` / `Cmd+S` provides instant manual flush.
3. **Campaign Management Hub**:
   - In `MainMenu.svelte`, the GM can browse existing campaigns filtered in real time by name/system/description, open any campaign, duplicate to create an isolated clone with `(Cópia)` suffix, export `.mural`/`.json`, or delete with confirmation.
   - 4 instant starter presets (Quadro em Branco, Investigação Paranormal, Facções & Sandbox, One-Shot de Tensão) allow 1-click campaign initialization.
   - `NewCampaignModal.svelte` provides custom campaign initialization with template choices and system-specific defaults.

---

## 3. Caveats

- **Web Mode Fallback**: In web browser environments where `__TAURI_INTERNALS__` is absent, file import gracefully falls back to browser `<input type="file">` and export uses Blob download URLs (`storageService`).
- **Synchronous Flush on Unload**: Modern browsers may restrict async network requests during `beforeunload`; `flushSync` stores the latest snapshot in `localStorage` as a fail-safe.

---

## 4. Conclusion

The blueprints in `analysis.md` provide complete, production-ready Svelte 5 and TypeScript implementations for:
1. `src/lib/stores/campaignStore.svelte.ts`: Full Runes reactive state, 500ms debounce autosave scheduler, dirty state tracking, and storage service integration.
2. `src/lib/components/layout/Header.svelte`: 3-state autosave badge, manual save button, `Ctrl+S` keyboard trap, and quick note dialog.
3. `src/lib/components/menu/MainMenu.svelte`: Local campaign management, search filter, resume banner, native/web import, and 4 starter presets.
4. `src/lib/components/menu/NewCampaignModal.svelte`: Accessible creation modal with template presets and system defaults.

---

## 5. Verification Method

To verify the implementation:
1. **Typecheck & Svelte Checks**:
   ```bash
   npm run check
   ```
   *Expected result*: 0 errors, 0 warnings.
2. **Production Build**:
   ```bash
   npm run build
   ```
   *Expected result*: Clean Vite production bundle without syntax or import errors.
3. **E2E Test Suites**:
   ```bash
   npx tsx tests/run-e2e.ts
   ```
   *Expected result*: 175/175 tests passing across all 4 tiers (F08 to F13 covered in Tier 1 and Scenario 4).
4. **Interactive Verification Steps**:
   - Open campaign → Modify node or clock → Observe Header indicator change from "Salvo" → "Modificado" → "Salvando..." → "Salvo agora".
   - Press `Ctrl+S` → Observe instantaneous save cycle.
   - Return to Menu → Create new campaign via "Nova Campanha" or Starter Presets → Verify campaign opens and is added to campaign list.
