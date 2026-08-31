# Dispatch: E2E Test Suite Creator

**Role**: E2E Test Writer & Harness Architect
**Working Directory**: e:\DEV\Projects\Mural\.agents\test_writer_e2e
**Reference Files**:
- `e:\DEV\Projects\Mural\.agents\ORIGINAL_REQUEST.md` (Read thoroughly first!)
- `e:\DEV\Projects\Mural\PROJECT.md`
- `e:\DEV\Projects\Mural\.agents\spec_miner_survey_2\spec_r1_r2.md`
- `e:\DEV\Projects\Mural\.agents\spec_miner_survey_3\spec_r3_r4.md`

**Task**:
1. Create `TEST_INFRA.md` at project root (`e:\DEV\Projects\Mural\TEST_INFRA.md`) detailing the 4-tier opaque-box test architecture.
2. Implement complete, robust, executable E2E test suites in `tests/`:
   - `tests/tier1_features.test.ts`: Feature coverage (>=5 test cases per feature across all 27 features F01-F27).
   - `tests/tier2_boundaries.test.ts`: Boundary and corner cases (empty strings, extreme segment counts, special characters, max sizes, invalid JSON, corrupted files, timeout resilience).
   - `tests/tier3_combinations.test.ts`: Pairwise cross-feature interactions (e.g. node deletion pruning connected edges, clock completion logging consequence to Lore, timeline switching active session context, atlas pin navigation to canvas node, AI prompt serialization pruning secrets).
   - `tests/tier4_scenarios.test.ts`: Real-world Tabletop GM session scenarios (investigation board setup, threat escalation cycle, session log compilation, full campaign backup/restore).
   - `tests/run-e2e.ts`: Standalone runner script executable via `npx tsx tests/run-e2e.ts` (or `node`) that executes all tiers, prints clear test summary matrices, and exits with code 0 if all pass or non-zero on failure.
3. Configure `package.json` test script (`"test:e2e": "tsx tests/run-e2e.ts"` and `"test": "npm run test:e2e"`), installing `tsx` if needed or using existing tsx/vite-node.
4. Verify execution of tests and publish `TEST_READY.md` at `e:\DEV\Projects\Mural\TEST_READY.md`.
5. Deliver `handoff.md` in your working directory.
