# Handoff Report — Specification Mining: R3, R4 & Acceptance Criteria

**Agent:** `spec_miner_survey_3`  
**Working Directory:** `e:\DEV\Projects\Mural\.agents\spec_miner_survey_3`  
**Target Milestone:** R3 (Interactive GM Operational Suite), R4 (Context-Aware AI GM Assistant & BYOK Engine), Acceptance Criteria  
**Handoff Type:** Hard (Task Complete)  

---

## 1. Observation

1. **User Requirements & Context Specifications**:
   - `e:\DEV\Projects\Mural\.agents\ORIGINAL_REQUEST.md` lines 22–32 specify:
     - **R3. Interactive GM Operational Suite**: Threat Clocks with SVG segmented ring graphics (4, 6, 8, 10, 12 slices) with click-to-advance and completion triggers; Lore and clue registry with quick visibility toggles (`SABIDO` vs `SEGREDO`); Interactive timeline tracking session numbers and in-game chronological markers; Interactive Map/Atlas view with pin placement linked to canvas entities.
     - **R4. Context-Aware AI GM Session Assistant**: Emergency assistant *"A mesa descarrilou?"*; compressed board context prompt payload; BYOK settings engine for Gemini, OpenAI, Anthropic, and local Ollama.
   - `e:\DEV\Projects\Mural\context_ai.md` lines 201–240 & 281–309 define the canonical data models for `ThreatClock`, `LoreEntry`, `TimelineMarker`, `CampaignSettings`, and the AI prompt structure.

2. **Existing Implementation Analysis**:
   - `src/lib/components/clocks/ThreatClockItem.svelte` (lines 8–32): Currently implements a basic SVG ring using `stroke-dasharray` on `<circle>` elements with fixed radius 14 and gap 2, supporting arbitrary segments without validation clamping, direct slice picking, or completion triggers.
   - `src/lib/components/clocks/ThreatClocksPanel.svelte` (lines 6–16): Uses a basic browser `prompt()` dialog hardcoded to 6 segments.
   - `src/lib/components/lore/LoreEntryItem.svelte` (lines 12–29): Implements a toggle button flipping `SABIDO` and `SEGREDO` states, but lacks entity link pills (`associatedNodeIds`) and session attribution tags.
   - `src/lib/components/lore/LorePanel.svelte` (lines 6–12): Uses `prompt()` without status selection or filtering tabs.
   - `src/lib/components/layout/BottomTimeline.svelte` (lines 6–34): Implements a visual timeline bar with session nodes, but lacks active session switching and marker creation dialogs.
   - `src/lib/components/assistant/AiAssistantPanel.svelte` (lines 9–24): Uses a simulated `setTimeout` mock returning 3 hardcoded strings without board context serialization, provider configuration, or actionable hook buttons.
   - `src/lib/types/index.ts` (lines 19–39): Defines initial interfaces for `ThreatClock`, `LoreEntry`, `TimelineMarker`, `CampaignData`.

3. **Build & Tool Verification**:
   - Running `npx svelte-check --tsconfig ./tsconfig.json` exited with code 0:
     ```text
     Loading svelte-check in workspace: e:\DEV\Projects\Mural
     Getting Svelte diagnostics...
     svelte-check found 0 errors and 0 warnings
     ```
   - Running `npm run build` exited with code 0 in 23.79s:
     ```text
     dist/index.html                   0.59 kB │ gzip:  0.37 kB
     dist/assets/index-CKTxP04A.css   74.05 kB │ gzip: 11.98 kB
     dist/assets/index-Bnc_hKX0.js   329.62 kB │ gzip: 97.62 kB
     ✓ built in 23.79s
     ```
   - Running `cargo check --manifest-path src-tauri/Cargo.toml` exited with code 0 in 0.42s:
     ```text
     Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.42s
     ```

---

## 2. Logic Chain

1. **R3.1 Mathematical SVG Clocks**:
   - The requirement demands supporting $N \in \{4, 6, 8, 10, 12\}$ slices.
   - For a circular radius $R=13\text{px}$ ($C \approx 81.6814\text{px}$), the stroke-dasharray approach requires dynamic gap scaling ($g \in [1.2, 2.0]\text{px}$) to avoid overlapping arcs when $N=10$ or $N=12$.
   - For slice-level hover and direct click selection, parametric arc path math ($\theta_{\text{start}}, \theta_{\text{end}}$ with SVG `<path d="M... A... L... A... Z">`) is formulated in `spec_r3_r4.md` §4.1.2.
   - Completion triggers must fire when `filledSegments === totalSegments`, activating visual pulse animations, consequence alert text, and a one-click action to record the consequence into the Lore ledger.

2. **R3.2 Lore & Clue Registry**:
   - `SABIDO` (green / player-known) and `SEGREDO` (red / GM-only) require instant 1-click toggling with real-time badge updates.
   - Entity linkage via `associatedNodeIds: string[]` allows bidirectional focus: clicking a linked entity in the lore list centers the Svelte Flow canvas onto the corresponding node.
   - Filtering tabs (`TODOS`, `SABIDO`, `SEGREDO`) and search indexing provide fast lookup during live sessions.

3. **R3.3 Interactive Timeline**:
   - Fictional narrative time (`inGamePeriod`) and real tabletop play sequencing (`timeline: TimelineMarker[]`) must coexist.
   - Exactly one marker has `isCurrent = true` (glowing amber pulse). Clicking any marker switches the active session context.

4. **R3.4 Interactive Map / Atlas View**:
   - Maps must support pan/zoom ($0.2\times$ to $5.0\times$) with mouse wheel and drag panning.
   - Pins must use normalized percentage coordinates $(x\%, y\% \in [0.0, 100.0])$ so pins never drift when resizing or zooming.
   - Each pin links to a `CanvasEntityNode` (`targetNodeId`), with a popover offering "Ver no Mural" deep navigation that switches tabs and centers on the node.

5. **R4.1 AI Assistant & Context Serializer**:
   - "A mesa descarrilou?" requires an emergency response with exactly 3 structured hooks: `[Consequência Imediata]`, `[Pista Alternativa]`, `[Avanço da Ameaça]`.
   - `buildBoardContextPayload()` must prune verbose layout coordinates to fit under 1,200 tokens, selecting visible nodes, active threat clocks, hidden secrets, and semantic relationships.
   - Generated hooks feature direct action buttons (`+ Adicionar ao Lore`, `+ Avançar Relógio`, `📋 Copiar`).

6. **R4.2 BYOK Multi-Provider Engine**:
   - Polymorphic `IAiProvider` interface handles Google Gemini (v1beta REST), OpenAI (chat completions), Anthropic (Messages API), Ollama Local (`http://localhost:11434`), and offline Mock simulation.
   - API keys are masked in UI, tested with a 0-token ping ("Testar Conexão"), and omitted from public export files.

---

## 3. Caveats

1. **Tauri HTTP vs Browser Fetch for BYOK APIs**: In the web browser build, calling Anthropic or OpenAI directly from the frontend may encounter CORS restrictions if custom proxy headers are omitted. In the Tauri desktop build, requests should utilize Tauri's native HTTP fetch plugin or direct Rust commands to bypass browser CORS entirely.
2. **Ollama Daemon Pre-requisite**: For the local Ollama provider, the user must have the Ollama service running locally with a pulled model (e.g. `ollama run llama3.2`). Clear error detection for `ECONNREFUSED` is specified in the error recovery matrix.
3. **Map Image Storage**: Large map images (> 10MB) stored as Base64 strings inside `.mural` JSON files can increase file size. Using compressed WebP/JPEG or local Tauri file paths is recommended for production.

---

## 4. Conclusion

The specification mining for R3 (Interactive GM Operational Suite), R4 (Context-Aware AI Assistant & BYOK Engine), and Acceptance Criteria is complete and documented in full detail in `e:\DEV\Projects\Mural\.agents\spec_miner_survey_3\spec_r3_r4.md`.

All mathematical models for SVG segmented rings, data structures, provider abstractions, context serializers, and test verification matrices are fully defined and ready for implementation.

---

## 5. Verification Method

To independently verify the findings and specifications:

1. **Inspect Technical Specification File**:
   - Read `e:\DEV\Projects\Mural\.agents\spec_miner_survey_3\spec_r3_r4.md` to review the feature tables, mathematical formulas, prompt contracts, and test matrices.
2. **Run TypeScript & Svelte Integrity Check**:
   - Run `npx svelte-check --tsconfig ./tsconfig.json` from project root -> Must yield 0 errors and 0 warnings.
3. **Run Production Build Verification**:
   - Run `npm run build` from project root -> Must compile cleanly with exit code 0.
4. **Run Tauri Rust Backend Compilation Check**:
   - Run `cargo check --manifest-path src-tauri/Cargo.toml` from project root -> Must complete with exit code 0.
5. **Review Acceptance Matrix**:
   - Confirm all 10 Functional Acceptance Criteria (`AC-R3-01` to `AC-R3-10` and `AC-R2-01`) map to testable assertions.
