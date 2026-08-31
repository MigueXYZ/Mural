# Mural (OrdemTools) - 4-Tier Test Architecture & Infrastructure

## 1. Overview & Test Strategy

Mural (OrdemTools) employs a comprehensive **4-tier opaque-box test architecture** designed to validate system contracts, graph algorithms, mathematical SVG geometry, persistence pipelines, and AI improvisational capabilities without coupling to volatile UI rendering internals.

```
+-----------------------------------------------------------------------------------+
|                           4-TIER TEST ARCHITECTURE                                |
+-----------------------------------------------------------------------------------+
|  TIER 1: FEATURE CONTRACTS (F01 - F27)                                            |
|  - >= 5 test cases per feature (140+ total tests) covering primary happy paths     |
|  - Node specialization, semantic edges, clocks, lore, timeline, atlas, AI BYOK    |
+-----------------------------------------------------------------------------------+
|  TIER 2: BOUNDARIES & CORNER CASES                                                |
|  - Empty strings, special characters, unicode, extreme segments (0 to 100)        |
|  - Scaling stress (150+ nodes, 300+ edges), malformed JSON, debounce bursts       |
+-----------------------------------------------------------------------------------+
|  TIER 3: PAIRWISE CROSS-FEATURE COMBINATIONS                                      |
|  - Node deletion pruning edges, clock completion writing to Lore, Atlas deep-link |
|  - AI prompt serialization pruning secrets, campaign duplicate state isolation   |
+-----------------------------------------------------------------------------------+
|  TIER 4: REAL-WORLD GM SESSION SCENARIOS                                          |
|  - Full investigation conspiracy board setup & auto-layout                        |
|  - Session threat escalation cycle (clocks -> lore -> atlas)                      |
|  - Emergency plot derailment resolution ("A mesa descarrilou?")                   |
|  - Campaign lifecycle, debounced autosave, backup snapshot ring & recovery        |
+-----------------------------------------------------------------------------------+
```

---

## 2. Test Suite Structure & Hierarchy

All tests are placed in the root `tests/` directory:

| File | Tier / Scope | Coverage Focus | Min. Tests |
|:---|:---|:---|:---|
| `tests/tier1_features.test.ts` | **Tier 1: Feature Contracts** | F01 to F27 isolated functional contracts | >= 135 (5 per F01-F27) |
| `tests/tier2_boundaries.test.ts` | **Tier 2: Boundaries & Corners** | Boundary values, extreme counts, unicode, malformed inputs | >= 30 |
| `tests/tier3_combinations.test.ts` | **Tier 3: Pairwise Combinations** | Cross-feature interactions, reactive state cascades | >= 15 |
| `tests/tier4_scenarios.test.ts` | **Tier 4: GM Session Scenarios** | End-to-end multi-step tabletop GM workflows | >= 5 scenarios |
| `tests/run-e2e.ts` | **Master Runner Script** | Standalone runner, CLI matrices, exit code gates | Runner harness |

---

## 3. Test Harness Architecture (`tests/harness.ts`)

The test harness provides a zero-overhead, ultra-fast test execution runtime with:
1. **Assertion Library**: Fluent `expect(actual)` API with equality, truthiness, numeric ranges, string matching, array inclusion, and exception checking.
2. **Suite Isolation**: Independent execution context per test case with `beforeEach` and `afterEach` lifecycle hooks.
3. **Async Support**: Native `Promise` and `async/await` execution with timeout protection.
4. **Structured Reporting**: Formatted output matrices displaying pass/fail status, test counts, execution time, and clear error tracebacks.
5. **Zero Vendor Lock-in**: Powered by TypeScript and executable directly via `tsx` or Node.

### Running Tests

```bash
# Run all tiers via npm
npm test

# Or run explicitly via e2e script
npm run test:e2e

# Or run standalone via tsx
npx tsx tests/run-e2e.ts

# Or run individual tier files
npx tsx tests/tier1_features.test.ts
```

---

## 4. Authoritative Specifications & Expected Output Derivation

All test assertions derive expected outputs strictly from:
- `PROJECT.md` (Interface Contracts & Feature Inventory)
- `ORIGINAL_REQUEST.md` (Core Functional Requirements R1 - R4)
- `.agents/spec_miner_survey_2/spec_r1_r2.md` (R1 Graph Engine & R2 Persistence Blueprint)
- `.agents/spec_miner_survey_3/spec_r3_r4.md` (R3 GM Operational Suite & R4 AI Assistant Blueprint)

### Deterministic Test Fixtures & Oracles
- **SVG Threat Clock Geometry**: Derived from mathematical formulas $C = 2\pi R$, $L_{\text{seg}} = (C - N \cdot g) / N$, and angle step $\Delta\phi = 360^\circ / N$.
- **Auto-Layout DAG**: Derived from topological rank layering $L_0, L_1, \dots, L_k$ and median ordering.
- **AI Context Serializer**: Strict character/token budgeting (< 1,200 tokens) with predictable entity pruning order.
- **Schema Validation**: v1.0.0 JSON schema validation with fallback migration rules.
