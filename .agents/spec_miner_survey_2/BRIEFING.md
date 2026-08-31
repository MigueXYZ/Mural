# BRIEFING — 2026-08-31T20:51:00Z

## Mission
Deeply analyze and specify R1 (Advanced Canvas & Relationship Graph Engine) and R2 (Local-First Native Persistence & Campaign Management) for Mural (OrdemTools).

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Requirements & Architecture Specification Miner (R1: Graph Engine & R2: Persistence)
- Working directory: e:\DEV\Projects\Mural\.agents\spec_miner_survey_2
- Original parent: 58d7d5b6-673b-473e-a568-31e00653a284
- Milestone: Specification Mining (R1 & R2)

## 🔒 Key Constraints
- Sole job is discovering and documenting features by probing authoritative specification. Do NOT implement anything.
- Thoroughly map R1 (NPC/Faction/Location/Secret nodes, editable semantic edges, auto-layout, multi-selection, zoom/pan) and R2 (Tauri v2 FS, 500ms debounced auto-save, .mural/.json schema, import/export/duplicate, backup history).
- Define detailed data models, TypeScript interfaces, component architectures, edge cases, and verification strategies.
- Output findings in tables and structured sections in spec_r1_r2.md and handoff.md.

## Current Parent
- Conversation ID: 58d7d5b6-673b-473e-a568-31e00653a284
- Updated: 2026-08-31T20:51:00Z

## Task Summary
- **What to build**: Specification document (`spec_r1_r2.md`) and handoff report (`handoff.md`) covering R1 and R2.
- **Success criteria**: Exhaustive specification with concrete schemas, interfaces, architecture, auto-layout designs, persistence workflows, and edge case matrices.
- **Interface contracts**: e:\DEV\Projects\Mural\context_ai.md, e:\DEV\Projects\Mural\.agents\ORIGINAL_REQUEST.md
- **Code layout**: e:\DEV\Projects\Mural\src\

## Key Decisions Made
- Fully documented 27 granular features and 12 resilience edge cases for R1 and R2.
- Designed comprehensive TypeScript contracts for all entity types (NPC, Faction, Location, Secret/Clue), custom handles, edge relation types, customizable curves (straight, bezier, smoothstep), auto-layout algorithms (hierarchical DAG and force-directed), 500ms debouncing engine with backup rotation, and Tauri v2 FS plugin capabilities.

## Artifact Index
- `e:\DEV\Projects\Mural\.agents\spec_miner_survey_2\spec_r1_r2.md` — Comprehensive R1 & R2 Specification
- `e:\DEV\Projects\Mural\.agents\spec_miner_survey_2\handoff.md` — 5-component hard handoff report
- `e:\DEV\Projects\Mural\.agents\spec_miner_survey_2\progress.md` — Liveness & progress tracking
- `e:\DEV\Projects\Mural\.agents\spec_miner_survey_2\DISPATCH.md` — Logged dispatch instructions
