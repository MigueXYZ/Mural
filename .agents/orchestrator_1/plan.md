# Project Plan: Mural (OrdemTools)

## Overview
Mural (OrdemTools) is a modern, local-first Tabletop RPG (TTRPG) Game Master (GM) Screen, investigation conspiracy board, and campaign manager built with Svelte 5 (Runes), Svelte Flow (@xyflow/svelte), Tailwind CSS, and Tauri v2.

## Phases
1. **Phase 0: Survey & Technical Baseline Assessment**
   - Survey the existing codebase in `e:\DEV\Projects\Mural` (frontend structure, Tauri backend, types, package.json, Cargo.toml).
   - Extract specifications and gap analysis against R1, R2, R3, R4 and Acceptance Criteria.
   - Author `PROJECT.md` at project root with Feature Inventory, Architecture, Milestones, and Interface Contracts.

2. **Phase 1: Dual Track Initiation**
   - Track A (E2E Testing): Spawn E2E Testing Orchestrator to create testing harness and test cases (Tiers 1-4).
   - Track B (Implementation): Sub-orchestrators for Core Milestones:
     - M1: Advanced Canvas & Relationship Graph Engine (Svelte Flow, Runes, Nodes, Semantic Edges, Auto-layout).
     - M2: Local-First Native Persistence & Campaign Management (Tauri FS, auto-save debounce, .mural/.json import/export, backup history).
     - M3: Interactive GM Operational Suite (Threat Clocks, Lore/Clue Registry SABIDO/SEGREDO, Interactive Timeline, Interactive Atlas/Map).
     - M4: Context-Aware AI GM Session Assistant ("A mesa descarrilou?", board context payload builder, BYOK provider engine).

3. **Phase 2: Milestone Verification & Gate Reviews**
   - Iteration loops with Worker -> Reviewers -> Challengers -> Forensic Auditor.
   - Ensure clean cargo check, svelte-check, npm run build.

4. **Phase 3: Final Milestone — E2E Testing Pass & Hardening**
   - Run 100% E2E test suite (Tiers 1-4).
   - Tier 5 Adversarial Coverage Hardening.

5. **Phase 4: Final Synthesis and Reporting**
   - Verify all acceptance criteria.
   - Deliver final report to Sentinel / Parent.
