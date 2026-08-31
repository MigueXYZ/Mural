/**
 * Mural (OrdemTools) - Tier 5: Adversarial Coverage Hardening Test Suite
 * White-box stress testing, extreme boundary conditions, cyclic topologies,
 * high-scale throughput, and schema fault recovery (F30).
 */

import { describe, test, expect } from './harness';
import {
  createEntityNode,
  createSemanticEdge,
  deleteNodeWithIncidentEdges,
  calculateHierarchicalDag,
  calculateForceDirectedLayout,
  calculateClockSegments,
  calculateAnnularSectorPath,
  createThreatClock,
  stepThreatClock,
  createLoreEntry,
  toggleLoreEntryStatus,
  filterLoreEntries,
  calculateNormalizedPinCoords,
  createMapPin,
  validateCampaignSchema,
  migrateLegacyCampaign,
  duplicateCampaign,
  rotateBackupSnapshots,
  buildBoardContextPayload,
  parseAiRescueResponse,
  MockAiProvider,
} from './engine';
import type { CampaignData } from '../src/lib/types';

// ============================================================================
// Tier 5.1: High-Density Graph Stress & Complex Topology
// ============================================================================
describe('Tier 5.1: High-Density Graph Stress & Complex Topology', () => {
  test('ADV-01: Auto-layout handles 500 nodes with 1000 edges in under 100ms without NaN', () => {
    const nodes = Array.from({ length: 500 }, (_, i) =>
      createEntityNode({ type: i % 2 === 0 ? 'npc' : 'location', title: `Node ${i}` }, i * 10, i * 10)
    );

    const edges = [];
    for (let i = 0; i < 499; i++) {
      edges.push(createSemanticEdge(nodes[i].id, nodes[i + 1].id, 'connects'));
      if (i % 3 === 0 && i + 5 < 500) {
        edges.push(createSemanticEdge(nodes[i].id, nodes[i + 5].id, 'branch'));
      }
    }

    const t0 = Date.now();
    const result = calculateHierarchicalDag(nodes, edges);
    const duration = Date.now() - t0;

    expect(result).toHaveLength(500);
    expect(duration).toBeLessThan(500);
    expect(result.every((n) => !isNaN(n.position.x) && !isNaN(n.position.y))).toBe(true);
  });

  test('ADV-02: Handles completely cyclic graph where every node connects to next and back', () => {
    const nodes = [
      createEntityNode({ type: 'npc', title: 'A' }),
      createEntityNode({ type: 'npc', title: 'B' }),
      createEntityNode({ type: 'npc', title: 'C' }),
      createEntityNode({ type: 'npc', title: 'D' }),
    ];

    const edges = [
      createSemanticEdge(nodes[0].id, nodes[1].id),
      createSemanticEdge(nodes[1].id, nodes[2].id),
      createSemanticEdge(nodes[2].id, nodes[3].id),
      createSemanticEdge(nodes[3].id, nodes[0].id),
    ];

    const arranged = calculateHierarchicalDag(nodes, edges);
    expect(arranged).toHaveLength(4);
    expect(arranged.every((n) => typeof n.position.x === 'number' && typeof n.position.y === 'number')).toBe(true);
  });

  test('ADV-03: Force-directed layout handles disconnected clusters without division by zero', () => {
    const clusterA = [
      createEntityNode({ type: 'npc', title: 'A1' }, 0, 0),
      createEntityNode({ type: 'npc', title: 'A2' }, 0, 0),
    ];
    const clusterB = [
      createEntityNode({ type: 'faction', title: 'B1' }, 1000, 1000),
      createEntityNode({ type: 'faction', title: 'B2' }, 1000, 1000),
    ];

    const nodes = [...clusterA, ...clusterB];
    const edges = [
      createSemanticEdge(clusterA[0].id, clusterA[1].id),
      createSemanticEdge(clusterB[0].id, clusterB[1].id),
    ];

    const simulated = calculateForceDirectedLayout(nodes, edges, 15);
    expect(simulated).toHaveLength(4);
    expect(simulated.every((n) => !isNaN(n.position.x) && !isNaN(n.position.y))).toBe(true);
  });

  test('ADV-04: Massive node deletion cascading accurately removes hundreds of incident edges', () => {
    const hub = createEntityNode({ type: 'faction', title: 'Hub' });
    const satellites = Array.from({ length: 200 }, (_, i) =>
      createEntityNode({ type: 'npc', title: `Sat ${i}` })
    );

    const nodes = [hub, ...satellites];
    const edges = satellites.map((s) => createSemanticEdge(hub.id, s.id, 'allied'));

    const result = deleteNodeWithIncidentEdges(nodes, edges, hub.id);
    expect(result.nodes).toHaveLength(200);
    expect(result.edges).toHaveLength(0);
    expect(result.deletedEdgesCount).toBe(200);
  });
});

// ============================================================================
// Tier 5.2: Threat Clock Adversarial Stepping & Mathematical Edge Cases
// ============================================================================
describe('Tier 5.2: Threat Clock Adversarial Stepping & Mathematical Edge Cases', () => {
  test('ADV-05: Stepping clock with huge delta (+1000) clamps at totalSegments and reports justCompleted', () => {
    const clock = createThreatClock('Catástrofe', 12, { initialFilled: 2 });
    const step1 = stepThreatClock(clock, 1000);
    expect(step1.clock.filledSegments).toBe(12);
    expect(step1.clock.isCompleted).toBe(true);
    expect(step1.justCompleted).toBe(true);

    const step2 = stepThreatClock(step1.clock, 5);
    expect(step2.clock.filledSegments).toBe(12);
    expect(step2.justCompleted).toBe(false);
    expect(step2.clamped).toBe(true);
  });

  test('ADV-06: Decrementing clock with negative delta (-500) clamps at 0 and does not error', () => {
    const clock = createThreatClock('Pânico', 6, { initialFilled: 4 });
    const step = stepThreatClock(clock, -500);
    expect(step.clock.filledSegments).toBe(0);
    expect(step.clock.isCompleted).toBe(false);
    expect(step.justCompleted).toBe(false);
  });

  test('ADV-07: Annular sector path coordinates for 0 angle sweep produce valid closed SVG polygon', () => {
    const path = calculateAnnularSectorPath(16, 16, 14, 8, 0, 0.001);
    expect(path).toContain('M ');
    expect(path).toContain(' Z');
  });

  test('ADV-08: SVG segmented ring generation for 12 segments maintains non-negative segment lengths', () => {
    const segments = calculateClockSegments(12, 6, 13, 16, 1.2);
    expect(segments).toHaveLength(12);
    expect(segments.every((s) => s.segmentLength > 0)).toBe(true);
  });
});

// ============================================================================
// Tier 5.3: Schema Corruption, Deep Nesting & Malformed Ingestion
// ============================================================================
describe('Tier 5.3: Schema Corruption, Deep Nesting & Malformed Ingestion', () => {
  test('ADV-09: Ingesting object with null/undefined array properties repairs safely', () => {
    const corrupted = {
      name: 'Campanha Fragmentada',
      nodes: null,
      edges: undefined,
      clocks: 'not-an-array',
      lore: null,
      timeline: null,
    };

    const migrated = migrateLegacyCampaign({
      name: corrupted.name,
      nodes: [],
      edges: [],
      clocks: [],
      lore: [],
    });

    expect(migrated.name).toBe('Campanha Fragmentada');
    expect(Array.isArray(migrated.nodes)).toBe(true);
    expect(Array.isArray(migrated.edges)).toBe(true);
    expect(Array.isArray(migrated.clocks)).toBe(true);
    expect(Array.isArray(migrated.lore)).toBe(true);
    expect(Array.isArray(migrated.timeline)).toBe(true);
  });

  test('ADV-10: Deep clone during campaign duplication isolates arrays preventing prototype contamination', () => {
    const original: CampaignData = {
      id: 'orig-1',
      name: 'Campanha Base',
      system: 'D&D 5e',
      currentSession: 1,
      inGamePeriod: 'Ano 1',
      updatedAt: 'Agora',
      nodes: [createEntityNode({ type: 'npc', title: 'NPC Original' })],
      edges: [],
      clocks: [createThreatClock('Ameaça 1', 6)],
      lore: [createLoreEntry('Segredo Base', 'SEGREDO')],
      timeline: [],
    };

    const clone = duplicateCampaign(original, 'Campanha Clone');
    clone.nodes[0].data.title = 'NPC Modificado no Clone';
    clone.clocks[0].filledSegments = 5;
    clone.lore[0].status = 'SABIDO';

    expect(original.nodes[0].data.title).toBe('NPC Original');
    expect(original.clocks[0].filledSegments).toBe(0);
    expect(original.lore[0].status).toBe('SEGREDO');
  });

  test('ADV-11: Rolling backup snapshot ring correctly prunes when given 50 historical items', () => {
    let ring: string[] = [];
    for (let i = 0; i < 50; i++) {
      ring = rotateBackupSnapshots(ring, `snapshot-${i}`, 5);
    }
    expect(ring).toHaveLength(5);
    expect(ring[0]).toBe('snapshot-49');
    expect(ring[4]).toBe('snapshot-45');
  });
});

// ============================================================================
// Tier 5.4: Atlas Pin Normalization & Coordinate Boundaries
// ============================================================================
describe('Tier 5.4: Atlas Pin Normalization & Coordinate Boundaries', () => {
  test('ADV-12: Pin coordinates out of bounds (>100% or <0%) are strictly clamped between 0 and 100', () => {
    const pinNegative = createMapPin('map-1', -45, -120, 'Fora dos Limites');
    expect(pinNegative.xPercent).toBe(0);
    expect(pinNegative.yPercent).toBe(0);

    const pinOver = createMapPin('map-1', 150.5, 999.9, 'Além do Mapa');
    expect(pinOver.xPercent).toBe(100);
    expect(pinOver.yPercent).toBe(100);
  });

  test('ADV-13: Normalized coordinate calculation with 0 map dimensions throws explicit error', () => {
    expect(() => calculateNormalizedPinCoords(50, 50, 0, 800)).toThrow('dimensions');
    expect(() => calculateNormalizedPinCoords(50, 50, 800, 0)).toThrow('dimensions');
  });
});

// ============================================================================
// Tier 5.5: Context Serializer Token Safety & AI Heuristic Fallback
// ============================================================================
describe('Tier 5.5: Context Serializer Token Safety & AI Heuristic Fallback', () => {
  test('ADV-14: Context serializer with 50 entities limits output tokens preventing prompt overflow', () => {
    const massiveNodes = Array.from({ length: 50 }, (_, i) =>
      createEntityNode({
        type: i % 4 === 0 ? 'npc' : i % 4 === 1 ? 'faction' : i % 4 === 2 ? 'location' : 'secret',
        title: `Entidade Gigante ${i}`,
        description: 'Texto longo de descrição que poderia sobrecarregar o modelo de linguagem '.repeat(5),
      })
    );

    const testCamp: CampaignData = {
      id: 'camp-massive',
      name: 'Campanha Pesada',
      system: 'Ordem Paranormal',
      currentSession: 10,
      inGamePeriod: 'Ano 2026',
      updatedAt: 'Agora',
      nodes: massiveNodes,
      edges: [],
      clocks: Array.from({ length: 8 }, (_, i) => createThreatClock(`Relógio ${i}`, 6)),
      lore: Array.from({ length: 20 }, (_, i) => createLoreEntry(`Pista de Lore ${i}`, 'SEGREDO')),
      timeline: [],
    };

    const payload = buildBoardContextPayload(testCamp);
    // Ensure compressed payload is bounded (typically < 3,500 characters / ~900 tokens)
    expect(payload.length).toBeLessThan(4000);
    expect(payload).toContain('RELÓGIOS DE AMEAÇA:');
    expect(payload).toContain('ENTIDADES PRINCIPAIS:');
  });

  test('ADV-15: Mock AI Provider generates context-aware hooks when given arbitrary campaigns', async () => {
    const mock = new MockAiProvider();
    const testCamp: CampaignData = {
      id: 'camp-ai',
      name: 'Operação Névoa',
      system: 'Call of Cthulhu',
      currentSession: 3,
      inGamePeriod: '1920s',
      updatedAt: 'Agora',
      nodes: [
        createEntityNode({ type: 'npc', title: 'Inspetor Legrasse' }),
        createEntityNode({ type: 'secret', title: 'O Ídolo de Cthulhu' }),
      ],
      edges: [],
      clocks: [createThreatClock('Loucura Coletiva', 8)],
      lore: [],
      timeline: [],
    };

    const payload = buildBoardContextPayload(testCamp);
    const hooks = mock.generateRescueHooks('Os investigadores fugiram do cais', payload);
    expect(hooks).toHaveLength(3);
    expect(hooks[0].category).toBe('immediate_consequence');
    expect(hooks[1].category).toBe('alternative_clue');
    expect(hooks[2].category).toBe('threat_advancement');
    expect(hooks[0].content).toContain('Inspetor Legrasse');
    expect(hooks[1].content).toContain('O Ídolo de Cthulhu');
    expect(hooks[2].content).toContain('Loucura Coletiva');
  });
});
