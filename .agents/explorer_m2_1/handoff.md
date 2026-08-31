# Handoff Report: Explorer M2.1 (Tauri v2 Native Plugins & Rust Backend)

**Agent**: `explorer_m2_1`  
**Milestone**: M2 (Persistence & Campaign Management)  
**Date**: 2026-08-31T21:15:00Z  
**Type**: Hard Handoff (Task Complete)

---

## 1. Observation

1. **`src-tauri/Cargo.toml`**:
   - Lines 20-27: Baseline dependencies had `serde`, `serde_json`, `log`, `tauri = "2.11.3"`, and `tauri-plugin-log = "2"`.
   - Missing `tauri-plugin-fs = "2"` and `tauri-plugin-dialog = "2"`.
2. **`src-tauri/src/lib.rs`**:
   - Lines 3-16: `tauri::Builder::default()` only initialized `tauri_plugin_log` under debug assertions. Native file system and dialog IPC handlers were unmounted.
3. **`src-tauri/capabilities/default.json`**:
   - Lines 8-10: Permissions list contained only `["core:default"]`. No permission grants existed for `fs:*` or `dialog:*`.
4. **`package.json`**:
   - Lines 16-18: Frontend dependencies already include `"@tauri-apps/api": "^2.2.0"`, `"@tauri-apps/plugin-dialog": "^2.2.0"`, and `"@tauri-apps/plugin-fs": "^2.2.0"`.
5. **Tool Execution Outputs**:
   - `cargo check --manifest-path src-tauri/Cargo.toml`:
     - Downloaded `tauri-plugin-fs v2.5.2` and `tauri-plugin-dialog v2.7.3`.
     - Output: `Finished dev profile [unoptimized + debuginfo] target(s) in 2.14s` (Exit Code 0).
   - `npm run check` (`svelte-check --tsconfig ./tsconfig.json`):
     - Output: `svelte-check found 0 errors and 0 warnings` (Exit Code 0).
   - `npm run test` (`tsx tests/run-e2e.ts`):
     - Output: `TOTAL TESTS: 175 | PASSED: 175 | FAILED: 0 | DURATION: 142ms` (Exit Code 0).

---

## 2. Logic Chain

1. **Requirement R2 (Persistence & Campaign Management)** mandates local persistence using Tauri v2 file system plugins (`@tauri-apps/plugin-fs` and native dialogs).
2. Tauri v2 adopts a modular plugin architecture. Adding `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog` to the frontend without the corresponding Rust backend crates results in broken IPC commands (command not found error when invoking `plugin:fs|*` or `plugin:dialog|*`).
3. Adding `tauri-plugin-fs = "2"` and `tauri-plugin-dialog = "2"` to `Cargo.toml` and registering them via `.plugin(tauri_plugin_fs::init())` and `.plugin(tauri_plugin_dialog::init())` in `src/lib.rs` provides the requisite Rust IPC backend hooks.
4. In Tauri v2, window security is governed by capabilities. Without explicit permissions in `capabilities/default.json`, runtime calls from the webview are rejected by Tauri's ACL security engine. Adding `fs:default`, `fs:allow-read-text-file`, `fs:allow-write-text-file`, `fs:allow-create`, `fs:allow-read-dir`, `fs:allow-exists`, `fs:allow-mkdir`, `fs:allow-remove`, `fs:allow-rename`, `fs:allow-copy-file`, `fs:allow-stat`, `fs:allow-truncate`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:scope`, `dialog:default`, `dialog:allow-open`, and `dialog:allow-save` satisfies all file I/O and dialog picker requirements for campaign saving, loading, exporting, importing, and backups.
5. All modifications were verified with `cargo check`, `npm run check`, and `npm run test`, confirming zero build or type regression.

---

## 3. Caveats

- **Web Browser Fallback**: When the application runs in a browser (e.g. `npm run dev` in standard Chrome/Firefox without Tauri runtime) or during headless test runners, `@tauri-apps/api/core`'s `isTauri()` will return `false`. Downstream implementers for `storage.ts` (M2.2/M2.3) must implement a dual-mode strategy using `localStorage` and Blob downloads when `!isTauri()`.
- **Operating System Path Differences**: Path separators differ between Windows (`\`) and POSIX (`/`). Implementers should always use `@tauri-apps/api/path` utilities (`join`, `resolve`, `appDataDir`) rather than manual string concatenation.

---

## 4. Conclusion

The Tauri v2 backend configuration design for `tauri-plugin-fs` and `tauri-plugin-dialog` is complete, validated, and ready for immediate implementation. 

### Actionable File Specifications:

1. **`src-tauri/Cargo.toml`**:
   Add `tauri-plugin-fs = "2"` and `tauri-plugin-dialog = "2"` under `[dependencies]`.
2. **`src-tauri/src/lib.rs`**:
   Mount `.plugin(tauri_plugin_fs::init())` and `.plugin(tauri_plugin_dialog::init())` on `tauri::Builder::default()`.
3. **`src-tauri/capabilities/default.json`**:
   Include all `fs:*` operations, `fs:scope` allowlist, and `dialog:*` operations in the `permissions` array.

Full source code diffs and TypeScript consumption patterns are detailed in `e:\DEV\Projects\Mural\.agents\explorer_m2_1\analysis.md`.

---

## 5. Verification Method

1. **Rust Backend Check**:
   ```bash
   cargo check --manifest-path src-tauri/Cargo.toml
   ```
   *Expected*: Zero compilation errors; `Finished dev profile in ~2s`.
2. **Frontend Type Check**:
   ```bash
   npm run check
   ```
   *Expected*: Zero Svelte / TypeScript errors and warnings.
3. **Automated Test Suite**:
   ```bash
   npm run test
   ```
   *Expected*: All 175 tests pass across Tiers 1 to 4.
4. **Inspect Files**:
   - `src-tauri/Cargo.toml` contains `tauri-plugin-fs = "2"` and `tauri-plugin-dialog = "2"`.
   - `src-tauri/src/lib.rs` contains `.plugin(tauri_plugin_fs::init())` and `.plugin(tauri_plugin_dialog::init())`.
   - `src-tauri/capabilities/default.json` contains `fs:default`, `fs:allow-read-text-file`, `fs:allow-write-text-file`, `dialog:default`, `dialog:allow-open`, `dialog:allow-save`.
