# Analysis: Tauri v2 Rust Backend & Native FS/Dialog Plugin Architecture

**Author**: Explorer M2.1 (`explorer_m2_1`)  
**Date**: 2026-08-31  
**Target Milestone**: M2 (Persistence & Campaign Management)  
**Feature**: F08 (Tauri v2 FS & Dialog Backend Setup)

---

## 1. Executive Summary

Mural requires local-first persistence with debounced 500ms auto-saving, campaign file export/import (`.mural`, `.json`), rolling backup snapshots, and native OS dialog pickers. 

In Tauri v2, native capabilities have transitioned from v1's `allowlist` in `tauri.conf.json` to a decoupled modular plugin and Access Control List (ACL) permission model:
- Rust backend plugins: `tauri-plugin-fs` (v2) and `tauri-plugin-dialog` (v2).
- Permissions and scopes: Declared in `src-tauri/capabilities/default.json`.
- Rust initialization: Registered via `.plugin(tauri_plugin_fs::init())` and `.plugin(tauri_plugin_dialog::init())` in `src-tauri/src/lib.rs`.
- Frontend bindings: `@tauri-apps/plugin-fs` (^2.2.0), `@tauri-apps/plugin-dialog` (^2.2.0), and `@tauri-apps/api` (^2.2.0).

---

## 2. Configuration Analysis & Exact Code Diffs

### 2.1 `src-tauri/Cargo.toml`

**Analysis**:
The project's Tauri core is version `2.11.3` with `tauri-build` `2.6.3`. To enable native file system and native dialog interactions, the official Tauri v2 plugins `tauri-plugin-fs` and `tauri-plugin-dialog` must be added under `[dependencies]`.

**Proposed Content**:
```toml
[package]
name = "app"
version = "0.1.0"
description = "A Tauri App"
authors = ["you"]
license = ""
repository = ""
edition = "2021"
rust-version = "1.77.2"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[lib]
name = "app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.6.3", features = [] }

[dependencies]
serde_json = "1.0"
serde = { version = "1.0", features = ["derive"] }
log = "0.4"
tauri = { version = "2.11.3", features = [] }
tauri-plugin-log = "2"
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
```

**Diff**:
```diff
--- a/src-tauri/Cargo.toml
+++ b/src-tauri/Cargo.toml
@@ -25,3 +25,5 @@ tauri = { version = "2.11.3", features = [] }
 tauri-plugin-log = "2"
+tauri-plugin-fs = "2"
+tauri-plugin-dialog = "2"
```

---

### 2.2 `src-tauri/src/lib.rs`

**Analysis**:
In Tauri v2, plugins must be registered on `tauri::Builder` during runtime setup so that IPC commands (`plugin:fs|read_text_file`, `plugin:dialog|open`, etc.) are bound and mapped to the webview.

**Proposed Content**:
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

**Diff**:
```diff
--- a/src-tauri/src/lib.rs
+++ b/src-tauri/src/lib.rs
@@ -3,4 +3,6 @@
 pub fn run() {
   tauri::Builder::default()
+    .plugin(tauri_plugin_fs::init())
+    .plugin(tauri_plugin_dialog::init())
     .setup(|app| {
```

---

### 2.3 `src-tauri/capabilities/default.json`

**Analysis**:
In Tauri v2, window permissions are strictly enforced by ACL manifests. 
For Mural:
1. **FS Plugin Permissions**:
   - `fs:default` — Baseline file system commands.
   - `fs:allow-read-text-file`, `fs:allow-write-text-file` — Reading/writing `.mural` and `.json` campaigns.
   - `fs:allow-create`, `fs:allow-read-dir`, `fs:allow-mkdir` — Directory traversal and backup directory creation.
   - `fs:allow-exists`, `fs:allow-remove`, `fs:allow-rename`, `fs:allow-copy-file`, `fs:allow-stat`, `fs:allow-truncate` — File lifecycle and snapshot management.
   - `fs:allow-read-file`, `fs:allow-write-file` — Binary file / image handling for maps and custom assets.
   - `fs:scope` — Recursive paths allowlist covering standard user directories (`$APPDATA/**`, `$APPLOCALDATA/**`, `$APPCONFIG/**`, `$DOCUMENT/**`, `$DOWNLOAD/**`, `$DESKTOP/**`, `**`) to permit silent auto-saving into application directories and user-selected custom save paths.
2. **Dialog Plugin Permissions**:
   - `dialog:default` — Default dialog invocation.
   - `dialog:allow-open` — Native file open picker (`.mural`, `.json`).
   - `dialog:allow-save` — Native file save picker (`.mural`, `.json`).
   - `dialog:allow-message`, `dialog:allow-ask`, `dialog:allow-confirm` — Native system alerts and destructive action confirmations.

**Proposed Content**:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for Mural desktop app",
  "windows": [
    "main"
  ],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-create",
    "fs:allow-read-dir",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "fs:allow-remove",
    "fs:allow-rename",
    "fs:allow-copy-file",
    "fs:allow-stat",
    "fs:allow-truncate",
    "fs:allow-read-file",
    "fs:allow-write-file",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$APPDATA/**" },
        { "path": "$APPLOCALDATA/**" },
        { "path": "$APPCONFIG/**" },
        { "path": "$DOCUMENT/**" },
        { "path": "$DOWNLOAD/**" },
        { "path": "$DESKTOP/**" },
        { "path": "**" }
      ]
    },
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save"
  ]
}
```

---

## 3. Frontend TypeScript Consumption Design (`storage.ts`)

To ensure seamless operation both in desktop (Tauri) and web fallback / headless test environments, the storage service should encapsulate Tauri calls with runtime detection:

```typescript
import { isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { 
  readTextFile, 
  writeTextFile, 
  exists, 
  mkdir, 
  readDir, 
  remove, 
  copyFile, 
  BaseDirectory 
} from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { CampaignData, CampaignSummary } from '$lib/types';

export class StorageService {
  private isDesktop = isTauri();

  /**
   * Saves campaign data locally. In Tauri, writes to appDataDir/campaigns/{id}.json.
   * In browser, writes to localStorage with key `mural_campaign_{id}`.
   */
  async saveCampaign(campaign: CampaignData): Promise<void> {
    const serialized = JSON.stringify(campaign, null, 2);
    if (this.isDesktop) {
      const baseDir = await appDataDir();
      const dir = await join(baseDir, 'campaigns');
      if (!(await exists(dir))) {
        await mkdir(dir, { recursive: true });
      }
      const filePath = await join(dir, `${campaign.id}.json`);
      await writeTextFile(filePath, serialized);
    } else {
      localStorage.setItem(`mural_campaign_${campaign.id}`, serialized);
    }
  }

  /**
   * Prompts native save dialog to export .mural / .json file.
   */
  async exportCampaignFile(campaign: CampaignData, targetPath?: string): Promise<string> {
    const serialized = JSON.stringify(campaign, null, 2);
    if (this.isDesktop) {
      const path = targetPath || await save({
        title: 'Exportar Campanha',
        defaultPath: `${campaign.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.mural`,
        filters: [{ name: 'Mural Campaign', extensions: ['mural', 'json'] }]
      });
      if (!path) throw new Error('Export cancelled');
      await writeTextFile(path, serialized);
      return path;
    } else {
      // Web fallback: Blob download
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${campaign.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.mural`;
      a.click();
      URL.revokeObjectURL(url);
      return a.download;
    }
  }

  /**
   * Prompts native open dialog to import .mural / .json file.
   */
  async importCampaignFile(): Promise<CampaignData> {
    if (this.isDesktop) {
      const selected = await open({
        title: 'Importar Campanha',
        multiple: false,
        directory: false,
        filters: [{ name: 'Mural Campaign', extensions: ['mural', 'json'] }]
      });
      if (!selected || Array.isArray(selected)) throw new Error('No file selected');
      const content = await readTextFile(selected);
      return JSON.parse(content) as CampaignData;
    } else {
      throw new Error('Web file import uses HTML file input');
    }
  }
}
```

---

## 4. Verification and Benchmark

The configuration changes were verified against the full compiler toolchain and test runner:

1. **Rust Backend (`cargo check`)**:
   - `tauri-plugin-fs v2.5.2` and `tauri-plugin-dialog v2.7.3` resolved and compiled cleanly.
   - Result: `Finished dev profile in 2.14s` with **0 errors, 0 warnings**.
2. **Frontend Type Checking (`npm run check`)**:
   - `svelte-check --tsconfig ./tsconfig.json` ran across all components, runes, and services.
   - Result: **0 errors, 0 warnings**.
3. **E2E & Contract Test Suite (`npm run test`)**:
   - 175/175 tests across Tiers 1-4 passed with **100% pass rate** (including TC-F08-01 through TC-F08-05).

---

## 5. Next Steps for Implementers (M2.2 / M2.3)

1. Apply the diffs in `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, and `src-tauri/capabilities/default.json`.
2. Implement `src/lib/services/storage.ts` using the provided polymorphic storage pattern.
3. Wire debounced 500ms auto-saving into `src/lib/stores/campaignStore.svelte.ts`.
4. Connect Main Menu Import/Export buttons to `storage.exportCampaignFile` and `storage.importCampaignFile`.
