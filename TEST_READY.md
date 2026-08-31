# Mural (OrdemTools) - TEST_READY Report

**Status**: READY & VERIFIED  
**Date**: 2026-08-31T20:55:00Z  
**Author**: `test_writer_e2e`  
**Test Suite Path**: `e:\DEV\Projects\Mural\tests\`  
**Execution Command**: `npm test` or `npm run test:e2e` or `npx tsx tests/run-e2e.ts`

---

## 1. Test Suite Summary Matrix

| Tier | Suite File | Description | Test Count | Pass | Fail | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **Tier 1** | `tests/tier1_features.test.ts` | Complete feature coverage across F01-F27 (>=5 tests each) | 136 | 136 | 0 | **PASS** |
| **Tier 2** | `tests/tier2_boundaries.test.ts` | Boundaries, extreme segments, unicode, malformed inputs, scaling | 25 | 25 | 0 | **PASS** |
| **Tier 3** | `tests/tier3_combinations.test.ts` | Pairwise cross-feature cascades & state transitions | 9 | 9 | 0 | **PASS** |
| **Tier 4** | `tests/tier4_scenarios.test.ts` | Real-world Tabletop GM session workflows & disaster recovery | 5 | 5 | 0 | **PASS** |
| **TOTAL** | — | **All Tiers Executed** | **175** | **175** | **0** | **100% PASS** |

---

## 2. Feature Coverage Detail (Tier 1: F01 - F27)

| Feature ID | Feature Name | Test Cases | Result |
|:---|:---|:---|:---|
| **F01** | Entity Node Specialization (NPC, Faction, Location, Secret/Clue) | 5 | PASS |
| **F02** | In-Place & Modal Entity Editing | 5 | PASS |
| **F03** | Custom Semantic Edge Connectors | 5 | PASS |
| **F04** | Inline Edge Management & Edge Deletion | 5 | PASS |
| **F05** | Canvas Multi-selection & Group Movement | 5 | PASS |
| **F06** | Canvas Auto-Layout Engine (Hierarchical DAG & Force-Directed) | 5 | PASS |
| **F07** | Canvas Navigation, Zoom Clamping & Shortcuts | 5 | PASS |
| **F08** | Tauri v2 FS & Dialog Backend Setup | 5 | PASS |
| **F09** | Local-First Storage & 500ms Debounced Autosave | 5 | PASS |
| **F10** | Campaign Serialization (.mural / .json v1.0.0) | 5 | PASS |
| **F11** | Campaign File Import & Schema Validation | 5 | PASS |
| **F12** | Campaign Duplication & Rolling Backup History | 5 | PASS |
| **F13** | Main Menu Campaign Hub & Starter Presets | 5 | PASS |
| **F14** | Mathematical SVG Threat Clocks (4, 6, 8, 10, 12 Slices) | 6 | PASS |
| **F15** | Interactive Clock Stepping & Completion Triggers | 5 | PASS |
| **F16** | Dedicated Clock Creation & Management Dialog | 5 | PASS |
| **F17** | Lore & Clue Visibility Toggles (SABIDO / SEGREDO) | 5 | PASS |
| **F18** | Lore Entity Association & Filter Tabs | 5 | PASS |
| **F19** | Interactive Session Timeline & Chronometry | 5 | PASS |
| **F20** | Interactive Atlas & Map Subsystem (Normalized Pins) | 5 | PASS |
| **F21** | Atlas Pin Entity Linking ("Ver no Mural" Deep Navigation) | 5 | PASS |
| **F22** | App Navigation & View Routing | 5 | PASS |
| **F23** | "A mesa descarrilou?" Emergency AI Assistant | 5 | PASS |
| **F24** | Board Context Payload Serializer (< 1,200 tokens) | 5 | PASS |
| **F25** | BYOK Multi-Provider Client Engine | 5 | PASS |
| **F26** | BYOK Settings Configuration Modal | 5 | PASS |
| **F27** | AI Narrative Actionable Hooks (+ Lore, + Clocks, Copy) | 5 | PASS |

---

## 3. Boundary & Resilience Coverage (Tier 2)
- **Empty & Whitespace Inputs**: Validation handles empty campaign names, empty node titles, empty lore entries, and whitespace-only incident prompts.
- **Extreme Clock Segment Counts**: Strict type-safe rejection of unsupported segment counts (3, 5, 7, 9, 11, 13, 100, negatives).
- **Mathematical Slicing**: Dynamic gap scaling prevents stroke overlap and negative stroke lengths in SVG annular segments.
- **Unicode & Injection**: Safely stores and escapes emojis, Portuguese diacritics, multiline strings, and `<script>` HTML tags without execution.
- **Scaling Limits**: Tested graph handling 150 nodes, 200 edges, 1,000 lore entries, and huge context payload compression (< 4,800 characters).
- **Corrupt File Recovery**: Rejects non-JSON, missing mandatory fields, and gracefully migrates legacy schema versions.

---

## 4. Cross-Feature Combinations (Tier 3)
1. **Node Deletion**: Atomically purges all connected incident edges without orphaned visual links.
2. **Clock Completion**: Full threat clocks automatically append consequence items to the Lore registry.
3. **Timeline & Lore**: Switching active session automatically filters lore entries introduced in that session.
4. **Atlas & Canvas Deep Navigation**: Clicking "Ver no Mural" from a map pin transitions view to canvas and centers camera on the linked node.
5. **AI Rescue Actions**: Applying generated emergency hooks updates both Lore entries and active Threat Clock segments.
6. **Duplication State Isolation**: Duplicating a campaign generates an independent mutable instance without mutating the source campaign.

---

## 5. Real-World GM Scenarios (Tier 4)
- **Scenario 1**: Full Investigation Conspiracy Board Setup (Paranormal Mystery preset, crime scene, suspect, cult, secret, semantic edges, hierarchical DAG auto-layout, export).
- **Scenario 2**: High-Tension Session Threat Escalation Cycle (Session 14 tracking, advance threat clock from 6/8 to 8/8, completion alert, consequence logged to Lore as SEGREDO, revealed to players as SABIDO, pin placed on Atlas map).
- **Scenario 3**: Emergency Mid-Session Plot Derailment ("A mesa descarrilou?" incident, AI prompt context serialization, 3 structured hooks generated, consequence applied to Lore, clock advanced).
- **Scenario 4**: Full Lifecycle, Rolling Backup Snapshots & Disaster Recovery (Continuous editing with debounced autosave, file corruption simulation, restore from rolling backup, export to .mural, import into fresh workspace, 100% fidelity verified).
- **Scenario 5**: Multi-Faction Urban Warfare & Map Cartography (Dual faction conspiracy, 6 interconnected NPCs, 12-segment grand doom clock, 3-pin atlas map navigation, force-directed layout).

---

## 6. Verification Commands

```bash
# Execute the complete automated E2E test suite
npm test

# Or run explicitly via e2e script
npm run test:e2e

# Or run directly via tsx
npx tsx tests/run-e2e.ts
```

All 175 tests execute in ~130ms with 0 failures and exit code 0.
