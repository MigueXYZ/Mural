/**
 * Mural (OrdemTools) - Tier 4: Real-World GM Session Scenarios Test Suite
 * End-to-End simulation of multi-step GM workflows during live TTRPG campaign management.
 */

import { describe, test, it, expect } from './harness';
import {
  createEntityNode,
  createSemanticEdge,
  deleteNodeWithIncidentEdges,
  calculateHierarchicalDag,
  calculateForceDirectedLayout,
  createThreatClock,
  stepThreatClock,
  createLoreEntry,
  toggleLoreEntryStatus,
  filterLoreEntries,
  createTimelineMarker,
  switchActiveSession,
  calculateNormalizedPinCoords,
  createMapPin,
  validateCampaignSchema,
  duplicateCampaign,
  rotateBackupSnapshots,
  buildBoardContextPayload,
  parseAiRescueResponse,
  MockAiProvider,
} from './engine';
import type { CampaignData, ThreatClock, LoreEntry } from '../src/lib/types';
import type { Node, Edge } from '@xyflow/svelte';
import { initialCampaign } from '../src/lib/data/sampleCampaign';

// ============================================================================
// Scenario 1: Investigation Conspiracy Board Setup
// ============================================================================
describe('Scenario 1: Full Investigation Conspiracy Board Setup Workflow', () => {
  test('TC-SCEN-01: GM creates Paranormal Mystery campaign, builds graph, auto-arranges, and exports', () => {
    // 1. Initialize campaign from Paranormal Mystery preset
    const campaign: CampaignData = {
      id: 'camp-ordem-misterio',
      name: 'O Enigma do Sanatório Abandonado',
      system: 'Ordem Paranormal',
      currentSession: 1,
      inGamePeriod: 'Outubro de 2024, Noite Chuvosa',
      description: 'Uma série de mortes inexplicáveis leva os agentes ao antigo Sanatório Santa Helena.',
      updatedAt: new Date().toISOString(),
      nodes: [],
      edges: [],
      clocks: [createThreatClock('Despertar da Entidade', 6)],
      lore: [
        createLoreEntry(
          'O sanatório foi encerrado em 1982 após o desaparecimento do diretor.',
          'SABIDO',
          1
        ),
      ],
      timeline: [createTimelineMarker(1, 'Sessão 1: A Chegada', { isCurrent: true })],
    };

    // 2. Add Crime Scene Location
    const locCrime = createEntityNode(
      {
        type: 'location',
        title: 'Ala Psiquiátrica Oeste',
        subtitle: 'CENA DE CRIME',
        description: 'Paredes cobertas de lodo avermelhado e símbolos de Sangue.',
        color: '#38bdf8',
      },
      100,
      100
    );
    campaign.nodes.push(locCrime);

    // 3. Add Suspect NPC
    const npcSuspect = createEntityNode(
      {
        type: 'npc',
        title: 'Enfermeiro Raul',
        subtitle: 'SUSPEITO',
        description: 'Último funcionário a sair do turno antes do massacre.',
        color: '#d4a359',
      },
      350,
      100
    );
    campaign.nodes.push(npcSuspect);

    // 4. Add Cult Faction
    const factionCult = createEntityNode(
      {
        type: 'faction',
        title: 'Irmandade da Carne Rubra',
        subtitle: 'SEITA OCULTA',
        description: 'Grupo que pratica rituais com relíquias de Sangue.',
        color: '#a855f7',
      },
      600,
      100
    );
    campaign.nodes.push(factionCult);

    // 5. Add Hidden Secret Clue
    const secretRitual = createEntityNode(
      {
        type: 'secret',
        title: 'O Diário Oculto no Forro',
        subtitle: 'PISTA OCULTA',
        description: 'Contém os nomes de todos os membros proeminentes da Irmandade.',
        isSecret: true,
        revealed: false,
        color: '#f87171',
      },
      350,
      300
    );
    campaign.nodes.push(secretRitual);

    // 6. Connect with semantic relationship edges
    const e1 = createSemanticEdge(npcSuspect.id, locCrime.id, 'esteve presente em', 'hostile');
    const e2 = createSemanticEdge(npcSuspect.id, factionCult.id, 'é devoto secreto de', 'secret');
    const e3 = createSemanticEdge(locCrime.id, secretRitual.id, 'esconde', 'secret');
    campaign.edges.push(e1, e2, e3);

    expect(campaign.nodes).toHaveLength(4);
    expect(campaign.edges).toHaveLength(3);

    // 7. Run DAG Auto-Layout
    const arrangedNodes = calculateHierarchicalDag(campaign.nodes, campaign.edges);
    campaign.nodes = arrangedNodes;

    expect(campaign.nodes.every((n) => typeof n.position.x === 'number')).toBe(true);

    // 8. Serialize and validate schema export
    const jsonStr = JSON.stringify(campaign);
    const validated = validateCampaignSchema(JSON.parse(jsonStr));

    expect(validated.valid).toBe(true);
    expect(validated.data?.nodes).toHaveLength(4);
    expect(validated.data?.clocks[0].title).toBe('Despertar da Entidade');
  });
});

// ============================================================================
// Scenario 2: High-Tension Session Threat Escalation Cycle
// ============================================================================
describe('Scenario 2: High-Tension Threat Clock Escalation & Clue Revelation Cycle', () => {
  test('TC-SCEN-02: Advances threat clock to completion, triggers consequence into Lore, and maps hideout on Atlas', () => {
    // 1. Setup active campaign at Session 14
    const campaign: CampaignData = JSON.parse(JSON.stringify(initialCampaign));
    campaign.currentSession = 14;

    const invasionClock = createThreatClock('Cerco a Vallenmoor', 8, {
      initialFilled: 6,
      consequence: 'Os invasores quebram o portão leste e incendeiam as barricadas.',
    });
    campaign.clocks = [invasionClock];

    // 2. GM steps clock by +2 during intense battle
    const step1 = stepThreatClock(invasionClock, 1);
    expect(step1.clock.filledSegments).toBe(7);
    expect(step1.justCompleted).toBe(false);

    const step2 = stepThreatClock(step1.clock, 1);
    expect(step2.clock.filledSegments).toBe(8);
    expect(step2.justCompleted).toBe(true);
    expect(step2.clock.isCompleted).toBe(true);

    // 3. Automated consequence creation into Lore as SEGREDO
    const consequenceEntry = createLoreEntry(
      `[AMEAÇA CONCRETIZADA: ${step2.clock.title}] ${step2.clock.consequence}`,
      'SEGREDO',
      campaign.currentSession,
      ['loc-vallenmoor']
    );
    campaign.lore = [consequenceEntry, ...campaign.lore];

    expect(campaign.lore[0].status).toBe('SEGREDO');
    expect(campaign.lore[0].content).toContain('incendeiam as barricadas');

    // 4. Players interrogate scout; GM flips clue to SABIDO
    const revealedEntry = toggleLoreEntryStatus(campaign.lore[0]);
    campaign.lore[0] = revealedEntry;
    expect(campaign.lore[0].status).toBe('SABIDO');

    // 5. GM places pin on City Atlas map indicating breached East Gate
    const coords = calculateNormalizedPinCoords(750, 480, 1000, 800);
    const mapPin = createMapPin(
      'city-map',
      coords.xPercent,
      coords.yPercent,
      'Portão Leste (Brechado)',
      'danger',
      'loc-vallenmoor'
    );

    expect(mapPin.xPercent).toBe(75);
    expect(mapPin.yPercent).toBe(60);
    expect(mapPin.category).toBe('danger');
    expect(mapPin.targetNodeId).toBe('loc-vallenmoor');
  });
});

// ============================================================================
// Scenario 3: Emergency Mid-Session Plot Derailment ("A mesa descarrilou?")
// ============================================================================
describe('Scenario 3: Emergency Mid-Session Plot Derailment Resolution', () => {
  test('TC-SCEN-03: Resolves unexpected party action using AI Context Serializer & Action Hooks', () => {
    const campaign: CampaignData = JSON.parse(JSON.stringify(initialCampaign));

    // Incident: Players execute the informant tavern keeper in broad daylight
    const incidentReport = 'Os jogadores executaram o taverneiro suspeito na praça pública diante de testemunhas.';

    // 1. Serialize active board context (< 1,200 tokens)
    const contextPayload = buildBoardContextPayload(campaign);
    expect(contextPayload).toContain('Serah, a Espia');
    expect(contextPayload).toContain('O Poço Selado');
    expect(contextPayload.length).toBeLessThan(4800);

    // 2. Generate structured 3-hook contingency options
    const aiOutput = `
1. [Consequência Imediata]: O alarme geral da cidade é acionado pela guarda; Serah aproveita o tumulto para fugir.
2. [Pista Alternativa]: Ao revistarem o corpo, encontram a chave de bronze que abre o Poço Selado.
3. [Avanço da Ameaça]: A Ordem da Chama Pálida percebe a morte do aliado e antecipa o cerco em 1 etapa.
`;
    const hooks = parseAiRescueResponse(aiOutput);
    expect(hooks).toHaveLength(3);

    // 3. GM applies Hook 2: Discover Alternative Clue
    const altClueLore = createLoreEntry(
      `[PISTA: Chave de Bronze] Encontrada no taverneiro. Abre o Poço Selado sob o mercado.`,
      'SABIDO',
      campaign.currentSession,
      ['secret-poco']
    );
    campaign.lore = [altClueLore, ...campaign.lore];

    // 4. GM applies Hook 3: Advance Threat Clock
    const targetClock = campaign.clocks[0];
    const { clock: advancedClock } = stepThreatClock(targetClock, 1);
    campaign.clocks[0] = advancedClock;

    expect(campaign.lore[0].status).toBe('SABIDO');
    expect(campaign.lore[0].associatedNodeIds).toContain('secret-poco');
    expect(campaign.clocks[0].filledSegments).toBe(5);
  });
});

// ============================================================================
// Scenario 4: Full Lifecycle, Rolling Backup Snapshot Ring, & Disaster Recovery
// ============================================================================
describe('Scenario 4: Lifecycle, Rolling Backup Snapshots & Disaster Recovery', () => {
  test('TC-SCEN-04: Continuously mutates campaign, creates rolling backups, restores from snapshot after corruption', () => {
    // 1. Initial State
    let campaign: CampaignData = JSON.parse(JSON.stringify(initialCampaign));
    let backupSnapshots: string[] = [];

    // 2. Simulation of 6 consecutive edit & save cycles
    for (let cycle = 1; cycle <= 6; cycle++) {
      campaign.clocks[0].filledSegments = Math.min(6, cycle);
      campaign.updatedAt = `Cycle-${cycle}-Timestamp`;

      const snapshot = JSON.stringify(campaign);
      backupSnapshots = rotateBackupSnapshots(backupSnapshots, snapshot, 5);
    }

    // Backup ring should strictly maintain 5 most recent snapshots
    expect(backupSnapshots).toHaveLength(5);
    const newest = JSON.parse(backupSnapshots[0]);
    const oldestInRing = JSON.parse(backupSnapshots[4]);

    expect(newest.updatedAt).toBe('Cycle-6-Timestamp');
    expect(oldestInRing.updatedAt).toBe('Cycle-2-Timestamp');

    // 3. Disaster Simulation: primary campaign file corrupted / truncated
    const corruptedPayload = '{"id": "aerthys-01", "name": "Corrupted"'; // truncated JSON
    const validationCheck = validateCampaignSchema(
      (() => {
        try {
          return JSON.parse(corruptedPayload);
        } catch {
          return null;
        }
      })()
    );
    expect(validationCheck.valid).toBe(false);

    // 4. Disaster Recovery: Restore from most recent valid backup snapshot
    const restoredCampaign: CampaignData = JSON.parse(backupSnapshots[0]);
    const restoredValidation = validateCampaignSchema(restoredCampaign);

    expect(restoredValidation.valid).toBe(true);
    expect(restoredCampaign.name).toBe('As Crónicas de Aerthys');
    expect(restoredCampaign.clocks[0].filledSegments).toBe(6);
    expect(restoredCampaign.nodes).toHaveLength(5);
  });
});

// ============================================================================
// Scenario 5: Multi-Faction Urban Warfare & Multi-Map Cartography
// ============================================================================
describe('Scenario 5: Multi-Faction Urban Warfare & Multi-Map Cartography', () => {
  test('TC-SCEN-05: Orchestrates 2 rival factions, 6 NPCs, 12-segment grand doom clock, and 3 atlas map pins', () => {
    // 1. Build complex urban campaign
    const campaign: CampaignData = {
      id: 'camp-urban-war',
      name: 'Guerra nas Sombras de Vallenmoor',
      system: 'D&D 5e',
      currentSession: 15,
      inGamePeriod: 'Outono, Ano 998',
      updatedAt: new Date().toISOString(),
      nodes: [],
      edges: [],
      clocks: [
        createThreatClock('Guerra Aberta nas Ruas', 12, { initialFilled: 7 }),
      ],
      lore: [],
      timeline: [createTimelineMarker(15, 'Sessão 15: O Confronto', { isCurrent: true })],
    };

    // 2. Factions
    const facA = createEntityNode({ type: 'faction', title: 'Guarda da Cidade' }, 200, 100);
    const facB = createEntityNode({ type: 'faction', title: 'Sindicato dos Ladrões' }, 600, 100);
    campaign.nodes.push(facA, facB);

    // 3. Semantic Hostility Edge between Factions
    const warEdge = createSemanticEdge(facA.id, facB.id, 'em conflito com', 'hostile');
    campaign.edges.push(warEdge);

    // 4. NPCs under factions
    const npcsA = [
      createEntityNode({ type: 'npc', title: 'Capitão Vane' }, 100, 250),
      createEntityNode({ type: 'npc', title: 'Tenente Rina' }, 250, 250),
    ];
    const npcsB = [
      createEntityNode({ type: 'npc', title: 'Mestre Sombra' }, 550, 250),
      createEntityNode({ type: 'npc', title: 'Lâmina Rápida' }, 700, 250),
    ];
    campaign.nodes.push(...npcsA, ...npcsB);

    campaign.edges.push(
      createSemanticEdge(npcsA[0].id, facA.id, 'lidera'),
      createSemanticEdge(npcsA[1].id, facA.id, 'serve em'),
      createSemanticEdge(npcsB[0].id, facB.id, 'comanda'),
      createSemanticEdge(npcsB[1].id, facB.id, 'assassino de')
    );

    expect(campaign.nodes).toHaveLength(6);
    expect(campaign.edges).toHaveLength(5);

    // 5. Atlas Pins across City Map
    const pins = [
      createMapPin('city-map', 20.0, 30.0, 'Quartel da Guarda', 'location', facA.id),
      createMapPin('city-map', 80.0, 75.0, 'Covil Subterrâneo', 'location', facB.id),
      createMapPin('city-map', 50.0, 50.0, 'Praça Central (Campo de Batalha)', 'danger'),
    ];

    expect(pins).toHaveLength(3);
    expect(pins[0].targetNodeId).toBe(facA.id);
    expect(pins[1].targetNodeId).toBe(facB.id);

    // 6. Execute Force-Directed Layout
    const relaxed = calculateForceDirectedLayout(campaign.nodes, campaign.edges, 30);
    expect(relaxed).toHaveLength(6);
  });
});
