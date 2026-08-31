import { campaignStore } from '../../src/lib/stores/campaignStore.svelte';
import { initialCampaign } from '../../src/lib/data/sampleCampaign';
import { get } from 'svelte/store';
import type { EntityNodeData, CanvasRelationEdgeData } from '../../src/lib/types';

console.log('=== FORENSIC AUDITOR STORE REACTIVITY & LIFECYCLE AUDIT ===\n');

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  total++;
  if (condition) {
    console.log(`  ✓ [AUDIT-PASS]: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [AUDIT-FAIL]: ${testName}`);
    failed++;
  }
}

// 1. Initial State
campaignStore.loadCampaign(initialCampaign);
const initialNodesList = get(campaignStore.nodes);
const initialEdgesList = get(campaignStore.edges);

assert(initialNodesList.length === 5, 'Store loads initial campaign nodes correctly');
assert(initialEdgesList.length === 3, 'Store loads initial campaign edges correctly');

// 2. Add Entity Node
campaignStore.addEntityNode({
  title: 'Test Merchant',
  category: 'npc',
  description: 'Sells potions',
  tags: ['Merchant', 'Potions']
}, 500, 300);

let nodesAfterAdd = get(campaignStore.nodes);
assert(nodesAfterAdd.length === 6, 'addEntityNode appends new node to store');
const addedNode = nodesAfterAdd.find(n => n.data.title === 'Test Merchant');
assert(Boolean(addedNode && addedNode.position.x === 500 && addedNode.position.y === 300), 'Added node retains coordinates and data');

// 3. Update Entity Node Data
if (addedNode) {
  campaignStore.updateNodeData(addedNode.id, {
    title: 'Master Alchemist',
    subtitle: 'MESTRE',
    isSecret: true,
  });

  const updatedNode = get(campaignStore.nodes).find(n => n.id === addedNode.id);
  assert(updatedNode?.data.title === 'Master Alchemist', 'updateNodeData modifies node title');
  assert(updatedNode?.data.subtitle === 'MESTRE', 'updateNodeData modifies node subtitle');
  assert(updatedNode?.data.isSecret === true, 'updateNodeData toggles isSecret boolean');

  // 4. Duplicate Node
  campaignStore.duplicateNode(addedNode.id);
  const nodesAfterDup = get(campaignStore.nodes);
  assert(nodesAfterDup.length === 7, 'duplicateNode increments total node count');
  const dupNode = nodesAfterDup.find(n => n.data.title === 'Master Alchemist (Cópia)');
  assert(Boolean(dupNode), 'Duplicated node has "(Cópia)" suffix');
  assert(Boolean(dupNode && dupNode.position.x === 540 && dupNode.position.y === 340), 'Duplicated node is offset by +40px');

  // 5. Connect Edge to Added Node
  campaignStore.addEdge({
    id: `edge-alchemist-vallenmoor`,
    source: addedNode.id,
    target: 'loc-vallenmoor',
    data: {
      label: 'abastece',
      relationType: 'allied',
      pathType: 'smoothstep',
      bidirectional: true,
      notes: 'Fornece poções curativas ao conselho.'
    }
  });

  let edgesAfterAdd = get(campaignStore.edges);
  assert(edgesAfterAdd.length === 4, 'addEdge connects newly created node');

  // 6. Update Edge Data
  campaignStore.updateEdgeData(`edge-alchemist-vallenmoor`, {
    label: 'monopoliza o comércio de',
    relationType: 'hostile',
  });

  const updatedEdge = get(campaignStore.edges).find(e => e.id === `edge-alchemist-vallenmoor`);
  assert(updatedEdge?.data?.label === 'monopoliza o comércio de', 'updateEdgeData modifies edge label');
  assert(updatedEdge?.data?.relationType === 'hostile', 'updateEdgeData modifies relationType');

  // 7. Cascading Deletion: deleting a node MUST delete all connected edges
  campaignStore.deleteNode(addedNode.id);
  const nodesAfterDelete = get(campaignStore.nodes);
  const edgesAfterDelete = get(campaignStore.edges);

  assert(!nodesAfterDelete.some(n => n.id === addedNode.id), 'deleteNode removes the target node');
  assert(!edgesAfterDelete.some(e => e.source === addedNode.id || e.target === addedNode.id), 'deleteNode cascadingly removes all incident edges');
}

console.log(`\n=== STORE AUDIT SUMMARY: ${passed} passed, ${failed} failed (${total} total) ===`);
if (failed > 0) process.exit(1);
