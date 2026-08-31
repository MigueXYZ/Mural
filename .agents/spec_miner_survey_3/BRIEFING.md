# BRIEFING — 2026-08-31T20:49:30Z

## Mission
Specification mining and architectural definition for R3 (Interactive GM Operational Suite: Threat Clocks, Lore Registry, Timeline, Atlas/Map) and R4 (Context-Aware AI GM Assistant, Context Serializer, BYOK Provider Engine) + Acceptance Criteria.

## 🔒 My Identity
- Archetype: SPECIFICATION MINER
- Roles: Requirements & Architecture Specification Miner (R3: GM Suite, R4: AI Assistant, Acceptance Criteria)
- Working directory: e:\DEV\Projects\Mural\.agents\spec_miner_survey_3
- Original parent: 58d7d5b6-673b-473e-a568-31e00653a284
- Milestone: Requirements & Architecture Analysis

## 🔒 Key Constraints
- Do NOT implement anything (spec miner role is read-only analysis and documentation).
- Probe all features in assigned group and any discovered related features.
- Define UI specs, mathematical SVG calculations for segmented clocks (4, 6, 8, 10, 12 slices), payload structures, BYOK provider interface, and validation criteria.
- Output findings in e:\DEV\Projects\Mural\.agents\spec_miner_survey_3\spec_r3_r4.md and handoff.md.

## Current Parent
- Conversation ID: 58d7d5b6-673b-473e-a568-31e00653a284
- Updated: 2026-08-31T20:49:30Z

## Task Summary
- **What to build**: Comprehensive technical specification document `spec_r3_r4.md` detailing R3, R4, and Acceptance Criteria.
- **Success criteria**: Exhaustive, mathematically precise, runnable-verified specifications delivered in `spec_r3_r4.md` and `handoff.md`.
- **Interface contracts**: `e:\DEV\Projects\Mural\src\lib\types\index.ts`, `context_ai.md`, `ORIGINAL_REQUEST.md`.
- **Code layout**: Svelte 5 runes (`.svelte.ts`), Tailwind CSS v4, `@xyflow/svelte`, Tauri v2 Rust backend.

## Key Decisions Made
- SVG Segmented Ring Math: Defined both parametric polar arc paths (`<path d="...">`) and GPU-accelerated `stroke-dasharray` formulations with exact radial constants for $N \in \{4, 6, 8, 10, 12\}$ and gap scaling.
- Threat Clock Completion Triggers: Specified animated glow halo, `isCompleted = true`, consequence alert banner/toast, and 1-click consequence lore creation.
- Lore & Clue Registry: Standardized dual-state (`SABIDO` vs `SEGREDO`), entity-node linkage (`associatedNodeIds`), session discovery attribution, status filtering, and cross-canvas node focus.
- Interactive Timeline: Dual-chronometry model combining in-game fictional calendar with sequenced play session markers, active session glowing halo, and marker CRUD.
- Interactive Atlas / Map: Multi-map canvas with normalized percentage coordinates $(x\%, y\%)$ to ensure resolution-independent pin placement, entity linking, and deep-link camera animations to canvas nodes.
- AI GM Assistant ("A mesa descarrilou?"): Defined 3-hook structured response contract (`[Consequência Imediata]`, `[Pista Alternativa]`, `[Avanço da Ameaça]`), action buttons (+ Lore, + Clock, Copy), and offline heuristic fallback generator.
- Context Serializer: Built bounded < 1,200 token payload serializing active clocks, visible nodes, hidden secrets, and relations.
- BYOK Engine: Universal `IAiProvider` adapter architecture supporting Google Gemini, OpenAI, Anthropic Claude, and 100% offline Local Ollama (`http://localhost:11434`), including connection testing and API key masking.

## Artifact Index
- `e:\DEV\Projects\Mural\.agents\spec_miner_survey_3\spec_r3_r4.md` — Authoritative technical specification for R3, R4, and Acceptance Criteria.
- `e:\DEV\Projects\Mural\.agents\spec_miner_survey_3\handoff.md` — 5-Component Hard Handoff Report.
- `e:\DEV\Projects\Mural\.agents\spec_miner_survey_3\progress.md` — Task progress and heartbeat tracking.
- `e:\DEV\Projects\Mural\.agents\spec_miner_survey_3\DISPATCH.md` — Dispatch log with timestamped requests.
