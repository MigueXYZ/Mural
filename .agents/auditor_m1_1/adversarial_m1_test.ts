import { autoLayoutNodes, alignNodes, distributeNodes } from '../../src/lib/services/layout';
import { initialCampaign } from '../../src/lib/data/sampleCampaign';
import type { Node, Edge } from '@xyflow/svelte';
import type { EntityNodeData, CanvasRelationEdgeData } from '../../src/lib/types';

console.log('=== FORENSIC AUDITOR ADVERSARIAL STRESS TEST (MILESTONE 1) ===\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [AUDIT-PASS]: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [AUDIT-FAIL]: ${testName} ${detail ? `(${detail})` : ''}`);
    failedTests++;
  }
}

// -----------------------------------------------------------------------------
// ADVERSARIAL TEST SUITE 1: Layout Boundary & Edge Cases
// -----------------------------------------------------------------------------
console.log('[Stress 1] Empty, Single-Node, and Disconnected Graph Layouts');

// 1.1 Empty nodes array
const emptyRes = autoLayoutNodes([], []);
assert(emptyRes.nodes.length === 0 && emptyRes.edges.length === 0, 'Handles empty node array gracefully');

// 1.2 Single node
const singleNode: Node<EntityNodeData>[] = [
  { id: 'lone', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'lone', type: 'npc', title: 'Lone', description: '' } }
];
const singleRes = autoLayoutNodes(singleNode, []);
assert(singleRes.nodes.length === 1 && singleRes.nodes[0].position.x === 300 && singleRes.nodes[0].position.y === 200, 'Single node defaults to centered position (300, 200)');

// 1.3 Disconnected components + orphans
const disjointNodes: Node<EntityNodeData>[] = [
  // Subgraph 1: a1 -> a2
  { id: 'a1', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'a1', type: 'npc', title: 'A1', description: '' } },
  { id: 'a2', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'a2', type: 'npc', title: 'A2', description: '' } },
  // Subgraph 2: b1 -> b2 -> b3
  { id: 'b1', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'b1', type: 'faction', title: 'B1', description: '' } },
  { id: 'b2', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'b2', type: 'faction', title: 'B2', description: '' } },
  { id: 'b3', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'b3', type: 'faction', title: 'B3', description: '' } },
  // Orphan 1 & 2
  { id: 'o1', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'o1', type: 'location', title: 'O1', description: '' } },
  { id: 'o2', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'o2', type: 'secret', title: 'O2', description: '' } },
];

const disjointEdges: Edge<CanvasRelationEdgeData>[] = [
  { id: 'ea', source: 'a1', target: 'a2', data: { label: 'a', relationType: 'allied' } },
  { id: 'eb1', source: 'b1', target: 'b2', data: { label: 'b1', relationType: 'hostile' } },
  { id: 'eb2', source: 'b2', target: 'b3', data: { label: 'b2', relationType: 'secret' } },
];

const disjointRes = autoLayoutNodes(disjointNodes, disjointEdges, { algorithm: 'hierarchical', direction: 'TB' });
assert(disjointRes.nodes.length === 7, 'Retains all 7 nodes across multi-subgraph and orphan partitioning');

// Verify subgraph 1 and subgraph 2 are horizontally partitioned
const a1Pos = disjointRes.nodes.find(n => n.id === 'a1')!.position;
const b1Pos = disjointRes.nodes.find(n => n.id === 'b1')!.position;
assert(a1Pos.x !== b1Pos.x, 'Separate connected components placed in distinct horizontal partitions');

// Verify orphans placed below subgraphs
const o1Pos = disjointRes.nodes.find(n => n.id === 'o1')!.position;
const a2Pos = disjointRes.nodes.find(n => n.id === 'a2')!.position;
const b3Pos = disjointRes.nodes.find(n => n.id === 'b3')!.position;
assert(o1Pos.y > Math.max(a2Pos.y, b3Pos.y), 'Orphans placed cleanly below active subgraphs');

// -----------------------------------------------------------------------------
// ADVERSARIAL TEST SUITE 2: Complex Multi-Cycle & Entangled Graph Layout
// -----------------------------------------------------------------------------
console.log('\n[Stress 2] Complex Entangled Cycles and Mutual Dependencies');

const multiCycleNodes: Node<EntityNodeData>[] = Array.from({ length: 8 }, (_, i) => ({
  id: `mc-${i}`,
  type: 'entityNode',
  position: { x: 0, y: 0 },
  data: { id: `mc-${i}`, type: 'npc', title: `Node ${i}`, description: '' }
}));

// Complex entangled cycle: 0 -> 1 -> 2 -> 3 -> 0; 2 -> 4 -> 5 -> 2; 5 -> 6 -> 7 -> 5; 7 -> 1
const multiCycleEdges: Edge<CanvasRelationEdgeData>[] = [
  { id: 'e01', source: 'mc-0', target: 'mc-1', data: { label: '', relationType: 'neutral' } },
  { id: 'e12', source: 'mc-1', target: 'mc-2', data: { label: '', relationType: 'neutral' } },
  { id: 'e23', source: 'mc-2', target: 'mc-3', data: { label: '', relationType: 'neutral' } },
  { id: 'e30', source: 'mc-3', target: 'mc-0', data: { label: '', relationType: 'neutral' } }, // cycle 1
  { id: 'e24', source: 'mc-2', target: 'mc-4', data: { label: '', relationType: 'neutral' } },
  { id: 'e45', source: 'mc-4', target: 'mc-5', data: { label: '', relationType: 'neutral' } },
  { id: 'e52', source: 'mc-5', target: 'mc-2', data: { label: '', relationType: 'neutral' } }, // cycle 2
  { id: 'e56', source: 'mc-5', target: 'mc-6', data: { label: '', relationType: 'neutral' } },
  { id: 'e67', source: 'mc-6', target: 'mc-7', data: { label: '', relationType: 'neutral' } },
  { id: 'e75', source: 'mc-7', target: 'mc-5', data: { label: '', relationType: 'neutral' } }, // cycle 3
  { id: 'e71', source: 'mc-7', target: 'mc-1', data: { label: '', relationType: 'neutral' } }, // cross cycle link
];

const multiCycleRes = autoLayoutNodes(multiCycleNodes, multiCycleEdges, { algorithm: 'hierarchical' });
assert(multiCycleRes.nodes.length === 8, 'Complex 8-node 3-interlocking-cycle graph completes layout');
const uniquePositions = new Set(multiCycleRes.nodes.map(n => `${n.position.x},${n.position.y}`));
assert(uniquePositions.size === 8, 'All 8 nodes receive unique, non-overlapping coordinates despite multi-cycles');

// -----------------------------------------------------------------------------
// ADVERSARIAL TEST SUITE 3: Layout Directions (LR, BT, RL)
// -----------------------------------------------------------------------------
console.log('\n[Stress 3] Non-Standard Layout Directions');

const chainNodes: Node<EntityNodeData>[] = [
  { id: 'c-root', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'c-root', type: 'npc', title: 'Root', description: '' } },
  { id: 'c-mid', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'c-mid', type: 'npc', title: 'Mid', description: '' } },
  { id: 'c-leaf', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'c-leaf', type: 'npc', title: 'Leaf', description: '' } },
];
const chainEdges: Edge<CanvasRelationEdgeData>[] = [
  { id: 'ce1', source: 'c-root', target: 'c-mid', data: { label: '', relationType: 'neutral' } },
  { id: 'ce2', source: 'c-mid', target: 'c-leaf', data: { label: '', relationType: 'neutral' } },
];

// Left-to-Right (LR)
const lrRes = autoLayoutNodes(chainNodes, chainEdges, { algorithm: 'hierarchical', direction: 'LR' });
const lrRoot = lrRes.nodes.find(n => n.id === 'c-root')!.position;
const lrMid = lrRes.nodes.find(n => n.id === 'c-mid')!.position;
const lrLeaf = lrRes.nodes.find(n => n.id === 'c-leaf')!.position;
assert(lrRoot.x < lrMid.x && lrMid.x < lrLeaf.x, 'LR direction arranges root -> mid -> leaf progressively along X axis');

// Bottom-to-Top (BT)
const btRes = autoLayoutNodes(chainNodes, chainEdges, { algorithm: 'hierarchical', direction: 'BT' });
const btRoot = btRes.nodes.find(n => n.id === 'c-root')!.position;
const btMid = btRes.nodes.find(n => n.id === 'c-mid')!.position;
const btLeaf = btRes.nodes.find(n => n.id === 'c-leaf')!.position;
assert(btRoot.y > btMid.y && btMid.y > btLeaf.y, 'BT direction arranges root at bottom (larger Y) and leaf at top (smaller Y)');

// Right-to-Left (RL)
const rlRes = autoLayoutNodes(chainNodes, chainEdges, { algorithm: 'hierarchical', direction: 'RL' });
const rlRoot = rlRes.nodes.find(n => n.id === 'c-root')!.position;
const rlMid = rlRes.nodes.find(n => n.id === 'c-mid')!.position;
const rlLeaf = rlRes.nodes.find(n => n.id === 'c-leaf')!.position;
assert(rlRoot.x > rlMid.x && rlMid.x > rlLeaf.x, 'RL direction arranges root at right (larger X) and leaf at left (smaller X)');

// -----------------------------------------------------------------------------
// ADVERSARIAL TEST SUITE 4: Alignment & Distribution Edge Cases
// -----------------------------------------------------------------------------
console.log('\n[Stress 4] Alignment & Distribution Math Bounds');

const alignSet: Node<EntityNodeData>[] = [
  { id: 'al-1', type: 'entityNode', position: { x: 50, y: 100 }, data: { id: 'al-1', type: 'npc', title: '1', description: '' } },
  { id: 'al-2', type: 'entityNode', position: { x: 200, y: 300 }, data: { id: 'al-2', type: 'npc', title: '2', description: '' } },
  { id: 'al-3', type: 'entityNode', position: { x: 350, y: 500 }, data: { id: 'al-3', type: 'npc', title: '3', description: '' } },
];

// Single node align (should be no-op)
const singleAlign = alignNodes(alignSet, ['al-1'], 'top');
assert(singleAlign[0].position.y === 50 || singleAlign[0].position.y === 100, 'alignNodes with < 2 nodes returns unchanged');

// Center horizontal alignment
const centerHAlign = alignNodes(alignSet, ['al-1', 'al-2', 'al-3'], 'center-h', 260, 140);
const allCenterHX = centerHAlign.map(n => n.position.x);
assert(allCenterHX[0] === allCenterHX[1] && allCenterHX[1] === allCenterHX[2], 'alignNodes center-h sets uniform center X position for all targets');

// Center vertical alignment
const centerVAlign = alignNodes(alignSet, ['al-1', 'al-2', 'al-3'], 'center-v', 260, 140);
const allCenterVY = centerVAlign.map(n => n.position.y);
assert(allCenterVY[0] === allCenterVY[1] && allCenterVY[1] === allCenterVY[2], 'alignNodes center-v sets uniform center Y position for all targets');

// Vertical distribution
const distVSet: Node<EntityNodeData>[] = [
  { id: 'dv-1', type: 'entityNode', position: { x: 100, y: 100 }, data: { id: 'dv-1', type: 'npc', title: '1', description: '' } },
  { id: 'dv-2', type: 'entityNode', position: { x: 100, y: 120 }, data: { id: 'dv-2', type: 'npc', title: '2', description: '' } },
  { id: 'dv-3', type: 'entityNode', position: { x: 100, y: 700 }, data: { id: 'dv-3', type: 'npc', title: '3', description: '' } },
];
const distVRes = distributeNodes(distVSet, ['dv-1', 'dv-2', 'dv-3'], 'vertical');
const dv2Y = distVRes.find(n => n.id === 'dv-2')!.position.y;
assert(dv2Y === 400, 'distributeNodes vertical aligns middle node to exact midpoint 400 ((700-100)/2 + 100)');

// -----------------------------------------------------------------------------
// ADVERSARIAL TEST SUITE 5: Sample Campaign Integrity & Graph Structure
// -----------------------------------------------------------------------------
console.log('\n[Stress 5] Sample Campaign Graph Validation');

assert(initialCampaign.nodes.length >= 5, 'Sample campaign contains at least 5 rich entity nodes');
assert(initialCampaign.edges.length >= 3, 'Sample campaign contains at least 3 semantic relationship edges');
assert(
  initialCampaign.edges.every(e => Boolean(e.data && e.data.relationType && e.data.label)),
  'Every sample campaign edge has typed relationType and label metadata'
);
assert(
  initialCampaign.nodes.some(n => n.data.isSecret === true),
  'Sample campaign includes GM secret entity node'
);

console.log(`\n=== ADVERSARIAL AUDIT SUMMARY: ${passedTests} passed, ${failedTests} failed (${totalTests} total) ===`);
if (failedTests > 0) {
  process.exit(1);
}
