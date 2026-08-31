# Dispatch: Explorer M2.1 (Tauri v2 Native Plugins & Rust Backend)

**Role**: Tauri Backend & FS/Dialog Plugins Explorer
**Working Directory**: e:\DEV\Projects\Mural\.agents\explorer_m2_1
**Task**:
1. Read `e:\DEV\Projects\Mural\.agents\ORIGINAL_REQUEST.md` and `e:\DEV\Projects\Mural\PROJECT.md`.
2. Investigate `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`.
3. Design the exact changes needed to configure `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog` on both Rust and TypeScript sides:
   - `Cargo.toml`: Add `tauri-plugin-fs = "2"` and `tauri-plugin-dialog = "2"`.
   - `src/lib.rs`: Register `.plugin(tauri_plugin_fs::init())` and `.plugin(tauri_plugin_dialog::init())`.
   - `capabilities/default.json`: Enable permissions for fs (`fs:allow-read-text-file`, `fs:allow-write-text-file`, `fs:allow-create`, `fs:allow-read-dir`, `fs:default`) and dialog (`dialog:default`, `dialog:allow-open`, `dialog:allow-save`).
4. Ensure `cargo check` and `npm run check` compatibility.
5. Provide code diffs in `analysis.md` and deliver `handoff.md`.
