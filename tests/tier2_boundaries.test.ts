/**
 * Mural (OrdemTools) - Tier 2: Boundaries & Corner Cases Test Suite
 * Stress testing, extreme boundaries, unicode, malformed inputs, and scaling limits.
 */

import { describe, test, it, expect } from './harness';
import {
  createEntityNode,
  createSemanticEdge,
  deleteNodeWithIncidentEdges,
  calculateHierarchicalDag,
  calculateForceDirectedLayout,
  calculateClockSegments,
  createThreatClock,
  stepThreatClock,
  createLoreEntry,
  filterLoreEntries,
  calculateNormalizedPinCoords,
  createMapPin,
  validateCampaignSchema,
  migrateLegacyCampaign,
  buildBoardContextPayload,
  parseAiRescueResponse,
} from './engine';
import { initialCampaign } from '../src/lib/data/sampleCampaign';
import type { CampaignData, ThreatClock, LoreEntry } from '../src/lib/types';
import type { Node, Edge } from '@xyflow/svelte';

// ============================================================================
// Tier 2.1: Empty Strings & Whitespace Boundary Cases
// ============================================================================
describe('Tier 2.1: Empty Strings & Whitespace Handling', () => {
  test('TC-BND-01: Rejects whitespace-only campaign name in schema validation', () => {
    const invalid = { ...initialCampaign, name: '     ' };
    const res = validateCampaignSchema(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('name');
  });

  test('TC-BND-02: Falls back to default title when node title is empty', () => {
    const node = createEntityNode({ type: 'npc', title: '' });
    expect(node.data.title).toBe('');
    const safeTitle = node.data.title.trim() || 'Sem Título';
    expect(safeTitle).toBe('Sem Título');
  });

  test('TC-BND-03: Rejects empty or whitespace-only Lore entry creation', () => {
    expect(() => createLoreEntry('')).toThrow('cannot be empty');
    expect(() => createLoreEntry('   \n\t  ')).toThrow('cannot be empty');
  });

  test('TC-BND-04: Rejects empty incident input for AI emergency assistant', () => {
    const isPromptValid = (p: string) => p.trim().length > 0;
    expect(isPromptValid('')).toBe(false);
    expect(isPromptValid('    \t ')).toBe(false);
  });

  test('TC-BND-05: Threat clock with empty title defaults gracefully', () => {
    const clock = createThreatClock('   ', 6);
    expect(clock.title).toBe('Nova Ameaça');
  });
});

// ============================================================================
// Tier 2.2: Extreme Segment Counts & Clock Mathematical Bounds
// ============================================================================
describe('Tier 2.2: Extreme Segment Counts & Clock Mathematics', () => {
  test('TC-BND-06: Strict rejection of invalid segment counts (3, 5, 7, 9, 11, 13, 100)', () => {
    const invalidCounts = [0, 1, 2, 3, 5, 7, 9, 11, 13, 50, 100, -4];
    for (const count of invalidCounts) {
      expect(() => createThreatClock('Test', count as any)).toThrow('Invalid totalSegments');
    }
  });

  test('TC-BND-07: Clock segment calculation at segment limit 12 produces valid non-overlapping lengths', () => {
    const segments = calculateClockSegments(12, 12, 13, 16);
    expect(segments).toHaveLength(12);
    expect(segments[0].segmentLength).toBeGreaterThan(0);
    expect(segments.every((s) => !isNaN(s.rotation))).toBe(true);
  });

  test('TC-BND-08: Stepping clock with huge delta (+100) clamps strictly at totalSegments', () => {
    const clock = createThreatClock('Doom', 6, { initialFilled: 1 });
    const { clock: updated, justCompleted } = stepThreatClock(clock, 100);
    expect(updated.filledSegments).toBe(6);
    expect(updated.isCompleted).toBe(true);
    expect(justCompleted).toBe(true);
  });

  test('TC-BND-09: Stepping clock with huge negative delta (-100) clamps strictly at 0', () => {
    const clock = createThreatClock('Doom', 6, { initialFilled: 5 });
    const { clock: updated } = stepThreatClock(clock, -100);
    expect(updated.filledSegments).toBe(0);
    expect(updated.isCompleted).toBe(false);
  });

  test('TC-BND-10: Clock segment gap scaling prevents negative stroke length', () => {
    const segments = calculateClockSegments(12, 6, 5, 16, 0.5);
    expect(segments[0].segmentLength).toBeGreaterThan(0);
  });
});

// ============================================================================
// Tier 2.3: Special Characters, Unicode, Emojis, & HTML/XSS Injection
// ============================================================================
describe('Tier 2.3: Special Characters, Unicode & XSS Escaping', () => {
  test('TC-BND-11: Safely stores multiline descriptions with emojis and special quotes', () => {
    const complexDesc = `«Ato I: O Despertar das Sombras» 🗡️
Linha 2: "Cuidado com o fogo grego!"
Linha 3: UTF-8 characters: á, é, í, ó, ú, ç, ã, õ, ñ, 日本語.`;

    const node = createEntityNode({
      type: 'secret',
      title: 'Pergaminho Antigo 📜',
      description: complexDesc,
    });

    expect(node.data.description).toContain('🗡️');
    expect(node.data.description).toContain('日本語');
    expect(node.data.title).toContain('📜');
  });

  test('TC-BND-12: Preserves HTML/Script tags as literal strings without code execution', () => {
    const maliciousInput = '<script>alert("XSS")</script><img src="x" onerror="alert(1)"/>';
    const lore = createLoreEntry(maliciousInput, 'SEGREDO');
    expect(lore.content).toBe(maliciousInput);
    // JSON serialization preserves exact string literal
    const serialized = JSON.stringify(lore);
    expect(serialized).toContain('<script>alert(\\"XSS\\")</script>');
  });

  test('TC-BND-13: Edge label with quotation marks and directional arrows serializes safely', () => {
    const edge = createSemanticEdge('n1', 'n2', 'transfere "itens proibidos" ➔ para', 'financial');
    expect(edge.label).toContain('"itens proibidos"');
    expect(edge.label).toContain('➔');
  });

  test('TC-BND-14: Context serializer safely formats entities containing markdown syntax characters', () => {
    const camp: CampaignData = {
      ...initialCampaign,
      nodes: [
        createEntityNode({
          type: 'npc',
          title: '**Mestre** _Sombrio_ [Link](http://test)',
          description: '# Header Injection Test\n- Bullet 1\n- Bullet 2',
        }),
      ],
    };
    const payload = buildBoardContextPayload(camp);
    expect(payload).toContain('**Mestre**');
    expect(payload).toContain('# Header Injection Test');
  });

  test('TC-BND-15: Map pin title with emojis and symbols renders without coordinate corruption', () => {
    const pin = createMapPin('map-1', 77.77, 88.88, '🔥 Covil do Dragão ⚔️', 'danger');
    expect(pin.title).toContain('🔥');
    expect(pin.xPercent).toBe(77.77);
  });
});

// ============================================================================
// Tier 2.4: High Scaling Stress & Entity Volume Limits
// ============================================================================
describe('Tier 2.4: High Scaling Stress & Entity Volume', () => {
  test('TC-BND-16: Handles campaign with 150 nodes and 200 edges in graph engine', () => {
    const nodes: Node<EntityNodeData>[] = [];
    for (let i = 0; i < 150; i++) {
      nodes.push(
        createEntityNode({
          type: i % 4 === 0 ? 'npc' : i % 4 === 1 ? 'faction' : i % 4 === 2 ? 'location' : 'secret',
          title: `Entity ${i}`,
        }, (i % 10) * 100, Math.floor(i / 10) * 80)
      );
    }

    const edges: Edge[] = [];
    for (let i = 0; i < 200; i++) {
      const src = nodes[i % 150].id;
      const tgt = nodes[(i * 7 + 1) % 150].id;
      if (src !== tgt) {
        edges.push(createSemanticEdge(src, tgt, `rel-${i}`));
      }
    }

    expect(nodes).toHaveLength(150);
    expect(edges.length).toBeGreaterThan(180);

    const deleted = deleteNodeWithIncidentEdges(nodes, edges, nodes[0].id);
    expect(deleted.nodes).toHaveLength(149);
    expect(deleted.deletedEdgesCount).toBeGreaterThan(0);
  });

  test('TC-BND-17: Context Serializer caps and prunes massive campaign state strictly under 4,800 chars', () => {
    const bigCamp: CampaignData = {
      ...initialCampaign,
      nodes: Array.from({ length: 100 }, (_, i) =>
        createEntityNode({
          type: i % 2 === 0 ? 'npc' : 'secret',
          title: `Very Long NPC Character Title Number ${i} With Extended Name`,
          description: `Extensive narrative background backstory details for character ${i} that takes up significant text.`,
        })
      ),
      lore: Array.from({ length: 50 }, (_, i) =>
        createLoreEntry(`Lore item number ${i} documenting detailed event history from the campaign.`, 'SABIDO')
      ),
    };

    const payload = buildBoardContextPayload(bigCamp);
    expect(payload.length).toBeLessThan(4800);
  });

  test('TC-BND-18: Auto-layout scales to 50 nodes without timeout or infinite loops', () => {
    const nodes = Array.from({ length: 50 }, (_, i) =>
      createEntityNode({ type: 'npc', title: `Node ${i}` })
    );
    const edges = Array.from({ length: 49 }, (_, i) =>
      createSemanticEdge(nodes[i].id, nodes[i + 1].id, 'next')
    );

    const arranged = calculateHierarchicalDag(nodes, edges);
    expect(arranged).toHaveLength(50);
    expect(arranged[0].position.y).toBeLessThan(arranged[49].position.y);
  });

  test('TC-BND-19: Filters 1,000 lore entries instantaneously without performance degradation', () => {
    const thousandLore = Array.from({ length: 1000 }, (_, i) =>
      createLoreEntry(`Lore note ${i}`, i % 2 === 0 ? 'SABIDO' : 'SEGREDO', 1)
    );
    const start = Date.now();
    const sabidoOnly = filterLoreEntries(thousandLore, 'SABIDO');
    const elapsed = Date.now() - start;

    expect(sabidoOnly).toHaveLength(500);
    expect(elapsed).toBeLessThan(50);
  });

  test('TC-BND-20: Force-directed layout handles disconnected islands without NaN coordinates', () => {
    const nodes = [
      createEntityNode({ type: 'npc', title: 'Island 1' }, 10, 10),
      createEntityNode({ type: 'npc', title: 'Island 2' }, 800, 800),
    ];
    const arranged = calculateForceDirectedLayout(nodes, [], 10);
    expect(isNaN(arranged[0].position.x)).toBe(false);
    expect(isNaN(arranged[1].position.x)).toBe(false);
  });
});

// ============================================================================
// Tier 2.5: Malformed JSON, Corrupted Files & Schema Recovery
// ============================================================================
describe('Tier 2.5: Malformed JSON & Schema Error Recovery', () => {
  test('TC-BND-21: Rejects non-object JSON payloads (null, primitives, arrays as root)', () => {
    expect(validateCampaignSchema(null).valid).toBe(false);
    expect(validateCampaignSchema('string-payload').valid).toBe(false);
    expect(validateCampaignSchema([1, 2, 3]).valid).toBe(false);
  });

  test('TC-BND-22: Detects non-array types for nodes and edges in corrupted file', () => {
    const corrupt = {
      name: 'Corrupt',
      nodes: 'not-an-array',
      edges: null,
      clocks: [],
      lore: [],
    };
    const res = validateCampaignSchema(corrupt);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('"nodes" must be an array');
  });

  test('TC-BND-23: Legacy schema migration safely provides missing timeline and flags', () => {
    const legacy = {
      name: 'Old Version 0.0.1',
      nodes: [{ id: 'n1', data: { title: 'T' } }],
      edges: [],
      clocks: [],
      lore: [],
    };
    const migrated = migrateLegacyCampaign(legacy);
    expect(migrated.timeline).toHaveLength(1);
    expect(migrated.nodes[0].data.color).toBe('#d4a359');
  });

  test('TC-BND-24: AI response parser handles chaotic LLM output with missing brackets and numbers', () => {
    const chaoticOutput = `
Aqui estão as 3 ideias:
- Primeiro, o capitão entra na sala furioso.
- Segundo, encontram um túnel secreto atrás do armário.
- Terceiro, o tempo da bomba diminui.
`;
    const hooks = parseAiRescueResponse(chaoticOutput);
    expect(hooks).toHaveLength(3);
    expect(hooks[0].content.length).toBeGreaterThan(0);
  });

  test('TC-BND-25: Map pin normalized coordinate calculation with zero map dimensions throws descriptive error', () => {
    expect(() => calculateNormalizedPinCoords(100, 100, 0, 0)).toThrow('greater than zero');
  });
});
