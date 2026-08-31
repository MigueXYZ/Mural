/**
 * Mural (OrdemTools) - Tier 3: Pairwise Cross-Feature Combinations Test Suite
 * Validates complex interactions between subsystems (Nodes + Edges, Clocks + Lore,
 * Timeline + Lore, Atlas + Canvas, AI + Lore/Clocks, Duplication + Serialization).
 */

import { describe, test, it, expect } from './harness';
import {
  createEntityNode,
  createSemanticEdge,
  deleteNodeWithIncidentEdges,
  applyGroupDisplacement,
  calculateHierarchicalDag,
  createThreatClock,
  stepThreatClock,
  createLoreEntry,
  toggleLoreEntryStatus,
  filterLoreEntries,
  createTimelineMarker,
  switchActiveSession,
  createMapPin,
  validateCampaignSchema,
  duplicateCampaign,
  buildBoardContextPayload,
  parseAiRescueResponse,
} from './engine';
import { initialCampaign } from '../src/lib/data/sampleCampaign';
import type { CampaignData, ThreatClock, LoreEntry } from '../src/lib/types';

// ============================================================================
// Combination 1: Node Deletion & Edge Pruning Cascades (F01 + F04 + F05)
// ============================================================================
describe('Combination 1: Node Deletion & Edge Pruning Cascades (F01 + F04 + F05)', () => {
  test('TC-COMB-01: Deleting a central hub node atomically cleans 4 connected edges', () => {
    const hub = createEntityNode({ type: 'location', title: 'Castelo Central' });
    const leaf1 = createEntityNode({ type: 'npc', title: 'Guarda 1' });
    const leaf2 = createEntityNode({ type: 'npc', title: 'Guarda 2' });
    const leaf3 = createEntityNode({ type: 'faction', title: 'Guarnição' });
    const leaf4 = createEntityNode({ type: 'secret', title: 'Passagem Subterrânea' });

    const nodes = [hub, leaf1, leaf2, leaf3, leaf4];
    const edges = [
      createSemanticEdge(leaf1.id, hub.id, 'guarnece'),
      createSemanticEdge(leaf2.id, hub.id, 'patrulha'),
      createSemanticEdge(hub.id, leaf3.id, 'sede de'),
      createSemanticEdge(leaf4.id, hub.id, 'esconde-se sob'),
      createSemanticEdge(leaf1.id, leaf2.id, 'parceiro de'), // non-incident edge
    ];

    const result = deleteNodeWithIncidentEdges(nodes, edges, hub.id);

    expect(result.nodes).toHaveLength(4);
    expect(result.deletedEdgesCount).toBe(4);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].label).toBe('parceiro de');
  });

  test('TC-COMB-02: Bulk deletion of multiple nodes purges all inner and outer incident edges', () => {
    const n1 = createEntityNode({ type: 'npc', title: 'N1' });
    const n2 = createEntityNode({ type: 'npc', title: 'N2' });
    const n3 = createEntityNode({ type: 'npc', title: 'N3' });
    const n4 = createEntityNode({ type: 'npc', title: 'N4' });

    const nodes = [n1, n2, n3, n4];
    const edges = [
      createSemanticEdge(n1.id, n2.id, 'inner-1'),
      createSemanticEdge(n2.id, n3.id, 'inner-2'),
      createSemanticEdge(n1.id, n4.id, 'outer-1'),
      createSemanticEdge(n3.id, n4.id, 'outer-2'),
    ];

    // Delete n1, n2, n3
    let currentNodes = nodes;
    let currentEdges = edges;
    for (const id of [n1.id, n2.id, n3.id]) {
      const res = deleteNodeWithIncidentEdges(currentNodes, currentEdges, id);
      currentNodes = res.nodes;
      currentEdges = res.edges;
    }

    expect(currentNodes).toHaveLength(1);
    expect(currentNodes[0].id).toBe(n4.id);
    expect(currentEdges).toHaveLength(0);
  });
});

// ============================================================================
// Combination 2: Threat Clock Completion Logging Consequence to Lore (F15 + F17 + F18)
// ============================================================================
describe('Combination 2: Clock Completion Triggers Lore Consequence (F15 + F17 + F18)', () => {
  test('TC-COMB-03: Clock reaching 100% capacity logs consequence entry into Lore as SEGREDO', () => {
    const campaign: CampaignData = JSON.parse(JSON.stringify(initialCampaign));
    const targetClock = createThreatClock('Invasão dos Cultistas', 4, {
      initialFilled: 3,
      consequence: 'Os cultistas invadem a praça e sequestram o bibliotecário.',
    });
    campaign.clocks = [targetClock];

    // Advance clock by 1 to trigger completion
    const { clock: updatedClock, justCompleted } = stepThreatClock(targetClock, 1);
    expect(justCompleted).toBe(true);
    expect(updatedClock.isCompleted).toBe(true);

    if (justCompleted && updatedClock.consequence) {
      const consequenceLore = createLoreEntry(
        `[CONSEQUÊNCIA: ${updatedClock.title}] ${updatedClock.consequence}`,
        'SEGREDO',
        campaign.currentSession
      );
      campaign.lore = [consequenceLore, ...campaign.lore];
    }

    expect(campaign.lore[0].content).toContain('sequestram o bibliotecário');
    expect(campaign.lore[0].status).toBe('SEGREDO');
  });

  test('TC-COMB-04: GM reveals completed clock consequence to players by toggling Lore to SABIDO', () => {
    const consequenceLore = createLoreEntry('A ponte foi destruída pelo monstro', 'SEGREDO', 14);
    expect(consequenceLore.status).toBe('SEGREDO');

    const revealed = toggleLoreEntryStatus(consequenceLore);
    expect(revealed.status).toBe('SABIDO');
  });
});

// ============================================================================
// Combination 3: Timeline Session Switching & Lore Filtering (F18 + F19)
// ============================================================================
describe('Combination 3: Timeline Switching & Lore Filtering (F18 + F19)', () => {
  test('TC-COMB-05: Switching active session filters lore items introduced in that session', () => {
    const campaign: CampaignData = JSON.parse(JSON.stringify(initialCampaign));
    campaign.timeline = [
      createTimelineMarker(11, 'S11'),
      createTimelineMarker(12, 'S12'),
      createTimelineMarker(14, 'S14', { isCurrent: true }),
    ];

    // Switch to Session 12
    const { timeline, activeSession } = switchActiveSession(campaign.timeline, 12);
    campaign.timeline = timeline;
    campaign.currentSession = activeSession;

    const session12Lore = campaign.lore.filter((l) => l.sessionNumber === 12);
    expect(session12Lore).toHaveLength(1);
    expect(session12Lore[0].content).toContain('ruínas a norte de Vallenmoor');
  });

  test('TC-COMB-06: Adding new lore automatically inherits current active session number', () => {
    const campaign: CampaignData = JSON.parse(JSON.stringify(initialCampaign));
    campaign.currentSession = 16;

    const newClue = createLoreEntry('Novo rastro encontrado', 'SABIDO', campaign.currentSession);
    expect(newClue.sessionNumber).toBe(16);
  });
});

// ============================================================================
// Combination 4: Atlas Pin Navigation & Canvas Entity Linking (F20 + F21 + F22 + F07)
// ============================================================================
describe('Combination 4: Atlas Pin Deep-Link Navigation to Canvas (F20 + F21 + F22 + F07)', () => {
  test('TC-COMB-07: Clicking "Ver no Mural" on an Atlas pin resolves node and prepares focus coordinates', () => {
    const locNode = createEntityNode({ type: 'location', title: 'Catedral Antiga' }, 650, 420);
    const pin = createMapPin('city-map', 65.0, 42.0, 'Catedral', 'location', locNode.id);

    // Deep-link resolution
    let activeView = 'atlas';
    let focusedNodeId: string | null = null;
    let cameraTarget: { x: number; y: number } | null = null;

    const onVerNoMural = (targetPin: typeof pin, nodesList: typeof locNode[]) => {
      const node = nodesList.find((n) => n.id === targetPin.targetNodeId);
      if (node) {
        activeView = 'board';
        focusedNodeId = node.id;
        cameraTarget = { x: node.position.x, y: node.position.y };
      }
    };

    onVerNoMural(pin, [locNode]);

    expect(activeView).toBe('board');
    expect(focusedNodeId).toBe(locNode.id);
    expect(cameraTarget?.x).toBe(650);
    expect(cameraTarget?.y).toBe(420);
  });
});

// ============================================================================
// Combination 5: AI Assistant Emergency Resolution Cascades (F23 + F24 + F27 + F15 + F17)
// ============================================================================
describe('Combination 5: AI Emergency Context Serialization & Action Execution (F23 + F24 + F27)', () => {
  test('TC-COMB-08: Ingests campaign state into AI prompt and applies Consequence Hook into Lore & Clocks', () => {
    const campaign: CampaignData = JSON.parse(JSON.stringify(initialCampaign));
    const promptPayload = buildBoardContextPayload(campaign);
    expect(promptPayload).toContain('Serah, a Espia');
    expect(promptPayload).toContain('Avanço do Culto');

    // Simulate AI response
    const mockOutput = `
1. [Consequência Imediata]: Serah avista os heróis fugindo e envia um corvo à Ordem da Chama Pálida.
2. [Pista Alternativa]: O corpo do vigia contém um frasco com o símbolo do Poço Selado.
3. [Avanço da Ameaça]: A Ordem da Chama Pálida mobiliza os cultistas. Avança o relógio em 1 fatia.
`;
    const hooks = parseAiRescueResponse(mockOutput);
    expect(hooks).toHaveLength(3);

    // GM executes Hook 1: Add to Lore
    const hook1Lore = createLoreEntry(hooks[0].content, 'SEGREDO', campaign.currentSession, ['npc-serah']);
    campaign.lore = [hook1Lore, ...campaign.lore];

    // GM executes Hook 3: Advance Clock
    const targetClock = campaign.clocks.find((c) => c.title.includes('Avanço'))!;
    const { clock: updatedClock } = stepThreatClock(targetClock, 1);
    const clockIdx = campaign.clocks.findIndex((c) => c.id === targetClock.id);
    campaign.clocks[clockIdx] = updatedClock;

    expect(campaign.lore[0].content).toContain('Serah avista os heróis');
    expect(campaign.lore[0].associatedNodeIds).toContain('npc-serah');
    expect(campaign.clocks[0].filledSegments).toBe(5);
  });
});

// ============================================================================
// Combination 6: Campaign Duplication State Isolation & Export Roundtrip (F12 + F10 + F11)
// ============================================================================
describe('Combination 6: Duplication Isolation & Export/Import Roundtrip (F12 + F10 + F11)', () => {
  test('TC-COMB-09: Cloned campaign can be exported, modified, and re-imported without collisions', () => {
    const original = initialCampaign;
    const duplicate = duplicateCampaign(original, 'Aerthys - Linha do Tempo B');

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.name).toBe('Aerthys - Linha do Tempo B');

    // Modify duplicate
    duplicate.nodes.push(createEntityNode({ type: 'location', title: 'Nova Masmorra' }));
    duplicate.clocks[0].filledSegments = 6;

    // Export to JSON string and re-import
    const jsonString = JSON.stringify(duplicate);
    const validated = validateCampaignSchema(JSON.parse(jsonString));

    expect(validated.valid).toBe(true);
    expect(validated.data?.nodes).toHaveLength(original.nodes.length + 1);
    expect(validated.data?.clocks[0].filledSegments).toBe(6);

    // Ensure original campaign is completely untouched
    expect(original.nodes).toHaveLength(5);
    expect(original.clocks[0].filledSegments).toBe(4);
  });
});
