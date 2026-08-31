import { autoLayoutNodes, alignNodes, distributeNodes } from '../../src/lib/services/layout';
import type { Node, Edge } from '@xyflow/svelte';
import type {
  EntityNodeData,
  CanvasRelationEdgeData,
  CampaignData,
  RelationType,
  EdgePathType,
} from '../../src/lib/types';
import { initialCampaign, initialNodes, initialEdges } from '../../src/lib/data/sampleCampaign';

function runGraphMutationStressTests() {
  console.log('=== Starting Graph Mutation & State Transition Stress Tests ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  // =========================================================================
  // SUITE 1: Node Deletion & Multi-Edge Cascade Cleanup
  // =========================================================================
  console.log('[Suite 1] Node Deletion & Incident Edge Cleanup');

  // Helper simulating the exact store deleteNode logic
  function simulateDeleteNode(
    nodes: Node<EntityNodeData>[],
    edges: Edge<CanvasRelationEdgeData>[],
    idToDelete: string
  ) {
    const updatedNodes = nodes.filter((n) => n.id !== idToDelete);
    const updatedEdges = edges.filter((e) => e.source !== idToDelete && e.target !== idToDelete);
    return { nodes: updatedNodes, edges: updatedEdges };
  }

  // Setup complex graph: Node A connected to B, C, D, E via various directions
  const complexNodes: Node<EntityNodeData>[] = [
    { id: 'nA', type: 'entityNode', position: { x: 100, y: 100 }, data: { id: 'nA', type: 'npc', title: 'Target Hub A' } },
    { id: 'nB', type: 'entityNode', position: { x: 300, y: 100 }, data: { id: 'nB', type: 'npc', title: 'Node B' } },
    { id: 'nC', type: 'entityNode', position: { x: 100, y: 300 }, data: { id: 'nC', type: 'faction', title: 'Node C' } },
    { id: 'nD', type: 'entityNode', position: { x: 300, y: 300 }, data: { id: 'nD', type: 'location', title: 'Node D' } },
    { id: 'nE', type: 'entityNode', position: { x: 500, y: 200 }, data: { id: 'nE', type: 'secret', title: 'Node E' } },
  ];

  const complexEdges: Edge<CanvasRelationEdgeData>[] = [
    { id: 'e-A-B', source: 'nA', target: 'nB', data: { label: 'outbound from A', relationType: 'allied' } },
    { id: 'e-C-A', source: 'nC', target: 'nA', data: { label: 'inbound to A', relationType: 'hostile' } },
    { id: 'e-A-D', source: 'nA', target: 'nD', data: { label: 'outbound from A', relationType: 'secret' } },
    { id: 'e-A-A', source: 'nA', target: 'nA', data: { label: 'self-loop on A', relationType: 'neutral' } }, // Self-loop!
    { id: 'e-B-C', source: 'nB', target: 'nC', data: { label: 'independent edge B->C', relationType: 'allied' } },
    { id: 'e-D-E', source: 'nD', target: 'nE', data: { label: 'independent edge D->E', relationType: 'investigates' } },
  ];

  const deleteResultA = simulateDeleteNode(complexNodes, complexEdges, 'nA');

  assert(
    deleteResultA.nodes.length === 4 && !deleteResultA.nodes.some((n) => n.id === 'nA'),
    'deleteNode successfully removes target node nA from nodes list'
  );

  assert(
    deleteResultA.edges.length === 2,
    `deleteNode purges all 4 incident edges on nA (inbound, outbound, self-loop), leaving 2 independent edges. Actual: ${deleteResultA.edges.length}`
  );

  assert(
    deleteResultA.edges.every((e) => e.source !== 'nA' && e.target !== 'nA'),
    'Verified 0 remaining edges have source or target equal to deleted nA'
  );

  assert(
    deleteResultA.edges.some((e) => e.id === 'e-B-C') && deleteResultA.edges.some((e) => e.id === 'e-D-E'),
    'Independent edges (B->C and D->E) remain completely intact and unaltered'
  );

  // Deleting non-existent node
  const deleteNonExistent = simulateDeleteNode(complexNodes, complexEdges, 'non-existent-xyz');
  assert(
    deleteNonExistent.nodes.length === complexNodes.length && deleteNonExistent.edges.length === complexEdges.length,
    'Deleting a non-existent node ID is a safe no-op that preserves all nodes and edges'
  );

  // Multi-delete (group deletion)
  const idsToDelete = new Set(['nB', 'nC']);
  const multiDeleteNodes = complexNodes.filter((n) => !idsToDelete.has(n.id));
  const multiDeleteEdges = complexEdges.filter((e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target));

  assert(
    multiDeleteNodes.length === 3 &&
    !multiDeleteNodes.some((n) => idsToDelete.has(n.id)),
    'Multi-delete removes exactly the specified set of nodes'
  );

  assert(
    multiDeleteEdges.every((e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)),
    'Multi-delete cleans up all edges incident to ANY deleted node in the batch'
  );

  // =========================================================================
  // SUITE 2: Node Duplication Semantics & Deep Clone Isolation
  // =========================================================================
  console.log('\n[Suite 2] Node Duplication Semantics & Isolation');

  function simulateDuplicateNode(nodes: Node<EntityNodeData>[], sourceId: string) {
    const existing = nodes.find((n) => n.id === sourceId);
    if (!existing) return nodes;

    const newId = `node-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const duplicatedNode: Node<EntityNodeData> = {
      ...JSON.parse(JSON.stringify(existing)),
      id: newId,
      position: {
        x: existing.position.x + 40,
        y: existing.position.y + 40,
      },
      data: {
        ...JSON.parse(JSON.stringify(existing.data)),
        id: newId,
        title: `${existing.data.title || 'Entidade'} (Cópia)`,
      },
    };

    return [...nodes, duplicatedNode];
  }

  const originNode: Node<EntityNodeData> = {
    id: 'orig-1',
    type: 'entityNode',
    position: { x: 200, y: 150 },
    data: {
      id: 'orig-1',
      type: 'location',
      category: 'location',
      title: 'Templo Submerso',
      subtitle: 'LOCAL ANCESTRAL',
      description: 'Ruínas subaquáticas protegidas por guardiões.',
      tags: ['Ancestral', 'Água', 'Perigoso'],
      isSecret: true,
      colorTheme: '#38bdf8',
      icon: 'map-pin',
    },
  };

  const duplicatedList = simulateDuplicateNode([originNode], 'orig-1');
  const dup = duplicatedList.find((n) => n.id !== 'orig-1');

  assert(duplicatedList.length === 2, 'simulateDuplicateNode appends 1 new node to the store list');
  assert(Boolean(dup && dup.id.startsWith('node-dup-')), 'Duplicated node receives a distinct generated ID');
  assert(
    dup?.position.x === originNode.position.x + 40 && dup?.position.y === originNode.position.y + 40,
    `Duplicated node is placed at (+40, +40) offset. Expected: (${originNode.position.x + 40}, ${originNode.position.y + 40}), Actual: (${dup?.position.x}, ${dup?.position.y})`
  );
  assert(
    dup?.data.title === 'Templo Submerso (Cópia)',
    `Duplicated node title receives " (Cópia)" suffix. Actual: "${dup?.data.title}"`
  );
  assert(
    dup?.data.subtitle === originNode.data.subtitle &&
    dup?.data.description === originNode.data.description &&
    dup?.data.isSecret === originNode.data.isSecret &&
    dup?.data.colorTheme === originNode.data.colorTheme,
    'Duplicated node preserves all attributes (subtitle, description, isSecret, colorTheme)'
  );

  // Deep clone verification: Mutating duplicate does not affect original
  if (dup && dup.data.tags) {
    dup.data.tags.push('NovaTagModificada');
    dup.data.title = 'Título Alterado';
  }
  assert(
    originNode.data.tags?.length === 3 && !originNode.data.tags.includes('NovaTagModificada'),
    'Deep clone isolation: modifying duplicate tags array does NOT mutate original node tags'
  );
  assert(
    originNode.data.title === 'Templo Submerso',
    'Deep clone isolation: modifying duplicate title does NOT mutate original node title'
  );

  // Duplicating non-existent node
  const dupNonExistent = simulateDuplicateNode([originNode], 'phantom-id');
  assert(dupNonExistent.length === 1, 'Duplicating a non-existent node ID returns original list without error');

  // =========================================================================
  // SUITE 3: Edge Manipulation (Self-Loops, Duplicate Edges, Bidirectional)
  // =========================================================================
  console.log('\n[Suite 3] Edge Manipulation & State Transitions');

  function simulateUpdateEdgeData(
    edges: Edge<CanvasRelationEdgeData>[],
    id: string,
    partial: Partial<CanvasRelationEdgeData>
  ) {
    return edges.map((edge) => {
      if (edge.id === id) {
        return {
          ...edge,
          label: partial.label !== undefined ? partial.label : edge.label,
          data: {
            ...(edge.data || {
              label: 'ligação',
              relationType: 'neutral',
              pathType: 'smoothstep',
              bidirectional: false,
            }),
            ...partial,
          },
        };
      }
      return edge;
    });
  }

  let edgeStore: Edge<CanvasRelationEdgeData>[] = [
    {
      id: 'e1',
      source: 'nA',
      target: 'nB',
      type: 'customLabeledEdge',
      data: {
        label: 'ligação inicial',
        relationType: 'neutral',
        pathType: 'smoothstep',
        bidirectional: false,
      },
    },
  ];

  // 1. Update edge label and relation type
  edgeStore = simulateUpdateEdgeData(edgeStore, 'e1', {
    label: 'é aliado jurado de',
    relationType: 'allied',
    bidirectional: true,
  });

  assert(
    edgeStore[0].data?.label === 'é aliado jurado de' && edgeStore[0].label === 'é aliado jurado de',
    'updateEdgeData updates both edge.label and edge.data.label synchronously'
  );
  assert(edgeStore[0].data?.relationType === 'allied', 'updateEdgeData updates relationType to "allied"');
  assert(edgeStore[0].data?.bidirectional === true, 'updateEdgeData toggles bidirectional flag to true');

  // 2. Change pathType between smoothstep, bezier, straight
  edgeStore = simulateUpdateEdgeData(edgeStore, 'e1', { pathType: 'bezier' });
  assert(edgeStore[0].data?.pathType === 'bezier', 'updateEdgeData updates pathType to "bezier"');

  edgeStore = simulateUpdateEdgeData(edgeStore, 'e1', { pathType: 'straight' });
  assert(edgeStore[0].data?.pathType === 'straight', 'updateEdgeData updates pathType to "straight"');

  // 3. Parallel Duplicate Edges between same nodes
  const parallelEdge: Edge<CanvasRelationEdgeData> = {
    id: 'e2-parallel',
    source: 'nA',
    target: 'nB',
    type: 'customLabeledEdge',
    data: {
      label: 'segredo compartilhado',
      relationType: 'secret',
      pathType: 'smoothstep',
      bidirectional: false,
    },
  };
  edgeStore = [...edgeStore, parallelEdge];

  assert(edgeStore.length === 2, 'Graph store accommodates multiple parallel edges between same pair (nA -> nB)');

  // 4. Delete single edge among parallel edges
  edgeStore = edgeStore.filter((e) => e.id !== 'e1');
  assert(
    edgeStore.length === 1 && edgeStore[0].id === 'e2-parallel',
    'Deleting a specific edge ID removes only that edge, preserving parallel edge'
  );

  // 5. Self-Loop Edge
  const selfLoopEdge: Edge<CanvasRelationEdgeData> = {
    id: 'e-self-loop',
    source: 'nA',
    target: 'nA',
    type: 'customLabeledEdge',
    data: {
      label: 'obsessão pessoal',
      relationType: 'hostile',
      pathType: 'bezier',
      bidirectional: false,
    },
  };
  edgeStore = [...edgeStore, selfLoopEdge];
  assert(
    edgeStore.some((e) => e.source === e.target),
    'Graph store supports self-loop edge representation (source === target)'
  );

  // Deleting node nA should prune both the parallel edge and self-loop edge
  const prunedAfterDelete = simulateDeleteNode(complexNodes, edgeStore, 'nA');
  assert(
    prunedAfterDelete.edges.length === 0,
    'deleteNode on nA purges both parallel outbound edge and self-loop edge completely'
  );

  // =========================================================================
  // SUITE 4: Layout Algorithms under Adversarial Graph Topologies
  // =========================================================================
  console.log('\n[Suite 4] Layout Resilience on Adversarial Graph Topologies');

  // Scenario A: Self-loop graph
  const selfLoopNodes: Node<EntityNodeData>[] = [
    { id: 'sl1', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'sl1', type: 'npc', title: 'Self Loop Node' } },
  ];
  const selfLoopEdges: Edge<CanvasRelationEdgeData>[] = [
    { id: 'esl1', source: 'sl1', target: 'sl1', data: { label: 'loop', relationType: 'neutral' } },
  ];

  const dagSelfLoop = autoLayoutNodes(selfLoopNodes, selfLoopEdges, { algorithm: 'hierarchical' });
  assert(
    dagSelfLoop.nodes.length === 1 && Number.isFinite(dagSelfLoop.nodes[0].position.x) && Number.isFinite(dagSelfLoop.nodes[0].position.y),
    'Hierarchical DAG layout handles self-loop graph gracefully without infinite recursion'
  );

  const forceSelfLoop = autoLayoutNodes(selfLoopNodes, selfLoopEdges, { algorithm: 'force', iterations: 50 });
  assert(
    forceSelfLoop.nodes.length === 1 && forceSelfLoop.nodes[0].position.x >= 0 && forceSelfLoop.nodes[0].position.y >= 0,
    'Force-directed layout handles self-loop graph with valid non-negative coordinates'
  );

  // Scenario B: Dense Hub & Spoke (Star Topology with 30 nodes)
  const starNodes: Node<EntityNodeData>[] = [
    { id: 'hub', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'hub', type: 'faction', title: 'Central Faction' } },
    ...Array.from({ length: 29 }, (_, i) => ({
      id: `leaf-${i}`,
      type: 'entityNode',
      position: { x: 0, y: 0 },
      data: { id: `leaf-${i}`, type: 'npc' as const, title: `Agent ${i}` },
    })),
  ];
  const starEdges: Edge<CanvasRelationEdgeData>[] = Array.from({ length: 29 }, (_, i) => ({
    id: `e-hub-${i}`,
    source: 'hub',
    target: `leaf-${i}`,
    data: { label: 'comanda', relationType: 'allied' },
  }));

  const dagStar = autoLayoutNodes(starNodes, starEdges, { algorithm: 'hierarchical', direction: 'TB' });
  const hubY = dagStar.nodes.find((n) => n.id === 'hub')!.position.y;
  const leafYs = dagStar.nodes.filter((n) => n.id !== 'hub').map((n) => n.position.y);
  assert(
    leafYs.every((y) => y > hubY),
    'Hierarchical layout places all 29 leaf nodes below the root hub node'
  );

  const forceStar = autoLayoutNodes(starNodes, starEdges, { algorithm: 'force', iterations: 80 });
  assert(
    forceStar.nodes.every((n) => Number.isFinite(n.position.x) && Number.isFinite(n.position.y) && n.position.x >= 0 && n.position.y >= 0),
    'Force-directed layout stabilizes 30-node dense star topology into valid bounded coordinates'
  );

  // Scenario C: Disconnected / Isolated Graph (10 independent disconnected nodes)
  const disconnectedNodes: Node<EntityNodeData>[] = Array.from({ length: 10 }, (_, i) => ({
    id: `iso-${i}`,
    type: 'entityNode',
    position: { x: 0, y: 0 },
    data: { id: `iso-${i}`, type: 'location' as const, title: `Island ${i}` },
  }));
  const dagDisconnected = autoLayoutNodes(disconnectedNodes, [], { algorithm: 'hierarchical' });
  assert(
    dagDisconnected.nodes.length === 10 && new Set(dagDisconnected.nodes.map((n) => `${n.position.x},${n.position.y}`)).size === 10,
    'Hierarchical layout assigns distinct non-overlapping coordinates to all 10 disconnected nodes'
  );

  // Scenario D: Cyclic 5-Node Graph (A->B->C->D->E->A)
  const cycle5Nodes: Node<EntityNodeData>[] = Array.from({ length: 5 }, (_, i) => ({
    id: `c5-${i}`,
    type: 'entityNode',
    position: { x: 0, y: 0 },
    data: { id: `c5-${i}`, type: 'npc' as const, title: `Ring Member ${i}` },
  }));
  const cycle5Edges: Edge<CanvasRelationEdgeData>[] = [
    { id: 'ec-0-1', source: 'c5-0', target: 'c5-1', data: { label: 'leads to', relationType: 'allied' } },
    { id: 'ec-1-2', source: 'c5-1', target: 'c5-2', data: { label: 'leads to', relationType: 'allied' } },
    { id: 'ec-2-3', source: 'c5-2', target: 'c5-3', data: { label: 'leads to', relationType: 'allied' } },
    { id: 'ec-3-4', source: 'c5-3', target: 'c5-4', data: { label: 'leads to', relationType: 'allied' } },
    { id: 'ec-4-0', source: 'c5-4', target: 'c5-0', data: { label: 'cycles back to', relationType: 'allied' } },
  ];

  const dagCycle5 = autoLayoutNodes(cycle5Nodes, cycle5Edges, { algorithm: 'hierarchical' });
  assert(
    dagCycle5.nodes.length === 5 && new Set(dagCycle5.nodes.map((n) => `${n.position.x},${n.position.y}`)).size === 5,
    'Sugiyama cycle breaking successfully resolves 5-node directed cycle into distinct layers'
  );

  // =========================================================================
  // SUITE 5: Campaign Serialization & Graph State Symmetry
  // =========================================================================
  console.log('\n[Suite 5] Graph State Export/Import Symmetry');

  const fullCampaign: CampaignData = {
    ...JSON.parse(JSON.stringify(initialCampaign)),
    nodes: complexNodes,
    edges: complexEdges,
  };

  // Export serialization
  const serialized = JSON.stringify(fullCampaign);
  const reimported: CampaignData = JSON.parse(serialized);

  assert(reimported.nodes.length === complexNodes.length, 'Serialized campaign preserves exact node count');
  assert(reimported.edges.length === complexEdges.length, 'Serialized campaign preserves exact edge count');
  assert(
    reimported.edges.find((e) => e.id === 'e-A-A')?.target === 'nA',
    'Serialized campaign preserves self-loop edge source and target identity'
  );
  assert(
    reimported.nodes.find((n) => n.id === 'nE')?.data.title === 'Node E',
    'Serialized campaign preserves entity node data payload integrity'
  );

  console.log(`\n=== Graph Mutation Stress Tests Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runGraphMutationStressTests();
