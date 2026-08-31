import { autoLayoutNodes, alignNodes, distributeNodes } from '../../src/lib/services/layout';
import type { Node, Edge } from '@xyflow/svelte';
import type { EntityNodeData } from '../../src/lib/types';

function runAdversarialTests() {
  console.log('=== Starting Adversarial Auto-Layout Stress Tests ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Empty graph
  const r0 = autoLayoutNodes([], []);
  assert(r0.nodes.length === 0, 'Empty nodes array returns empty without throwing');

  // 2. Single node
  const r1 = autoLayoutNodes([{ id: 'single', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'single', type: 'npc', title: 'Solo', description: '' } }], []);
  assert(r1.nodes.length === 1 && r1.nodes[0].position.x === 300 && r1.nodes[0].position.y === 200, 'Single node positioned at centered default (300, 200)');

  // 3. Dense cyclical graph with 50 nodes and 150 edges (feedback arcs + chords)
  const count = 50;
  const denseNodes: Node<EntityNodeData>[] = Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: 'entityNode',
    position: { x: 0, y: 0 },
    data: { id: `node-${i}`, type: 'npc', title: `Node ${i}`, description: '' }
  }));
  const denseEdges: Edge[] = [];
  for (let i = 0; i < count; i++) {
    denseEdges.push({ id: `e-${i}`, source: `node-${i}`, target: `node-${(i + 1) % count}` });
    denseEdges.push({ id: `chord1-${i}`, source: `node-${i}`, target: `node-${(i + 5) % count}` });
    denseEdges.push({ id: `chord2-${i}`, source: `node-${i}`, target: `node-${(i + 13) % count}` });
  }

  const dagDense = autoLayoutNodes(denseNodes, denseEdges, { algorithm: 'hierarchical' });
  assert(dagDense.nodes.length === count, 'Hierarchical layout survives dense 50-node cyclic graph');
  assert(dagDense.nodes.every(n => Number.isFinite(n.position.x) && Number.isFinite(n.position.y)), 'All 50 nodes have finite valid coordinates');

  const forceDense = autoLayoutNodes(denseNodes, denseEdges, { algorithm: 'force', iterations: 60 });
  assert(forceDense.nodes.length === count, 'Force-directed layout survives dense 50-node cyclic graph');
  assert(forceDense.nodes.every(n => n.position.x >= 0 && n.position.y >= 0), 'All force nodes have non-negative normalized coordinates');

  // 4. Fully disconnected 30 orphan nodes
  const orphanNodes: Node<EntityNodeData>[] = Array.from({ length: 30 }, (_, i) => ({
    id: `orphan-${i}`,
    type: 'entityNode',
    position: { x: 0, y: 0 },
    data: { id: `orphan-${i}`, type: 'npc', title: `Orphan ${i}`, description: '' }
  }));
  const dagOrphans = autoLayoutNodes(orphanNodes, [], { algorithm: 'hierarchical' });
  assert(dagOrphans.nodes.length === 30, 'Hierarchical layout arranges 30 orphan nodes into clean matrix');
  const orphanPositions = new Set(dagOrphans.nodes.map(n => `${n.position.x},${n.position.y}`));
  assert(orphanPositions.size === 30, 'All 30 orphan nodes receive distinct positions');

  // 5. Mixed graph: 2 connected subgraphs + 5 orphans + self-loops
  const mixedNodes: Node<EntityNodeData>[] = [
    { id: 'sub1-a', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'sub1-a', type: 'npc', title: '1A', description: '' } },
    { id: 'sub1-b', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'sub1-b', type: 'npc', title: '1B', description: '' } },
    { id: 'sub2-a', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'sub2-a', type: 'npc', title: '2A', description: '' } },
    { id: 'sub2-b', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'sub2-b', type: 'npc', title: '2B', description: '' } },
    { id: 'orph-1', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'orph-1', type: 'npc', title: 'O1', description: '' } },
    { id: 'orph-2', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'orph-2', type: 'npc', title: 'O2', description: '' } },
  ];
  const mixedEdges: Edge[] = [
    { id: 'e1', source: 'sub1-a', target: 'sub1-b' },
    { id: 'e2', source: 'sub2-a', target: 'sub2-b' },
    { id: 'self-loop', source: 'sub1-a', target: 'sub1-a' },
  ];
  const mixedResult = autoLayoutNodes(mixedNodes, mixedEdges, { algorithm: 'hierarchical' });
  assert(mixedResult.nodes.length === 6, 'Mixed subgraphs and orphans handled correctly');

  // 6. Direction variations (LR, RL, BT)
  const dirLR = autoLayoutNodes(mixedNodes, mixedEdges, { algorithm: 'hierarchical', direction: 'LR' });
  assert(dirLR.nodes.length === 6 && dirLR.nodes.every(n => Number.isFinite(n.position.x) && Number.isFinite(n.position.y)), 'LR direction computes valid coordinates');

  const dirBT = autoLayoutNodes(mixedNodes, mixedEdges, { algorithm: 'hierarchical', direction: 'BT' });
  assert(dirBT.nodes.length === 6 && dirBT.nodes.every(n => Number.isFinite(n.position.x) && Number.isFinite(n.position.y)), 'BT direction computes valid coordinates');

  const dirRL = autoLayoutNodes(mixedNodes, mixedEdges, { algorithm: 'hierarchical', direction: 'RL' });
  assert(dirRL.nodes.length === 6 && dirRL.nodes.every(n => Number.isFinite(n.position.x) && Number.isFinite(n.position.y)), 'RL direction computes valid coordinates');

  // 7. Bulk Align and Distribute Edge Cases
  const alignEmpty = alignNodes([], [], 'top');
  assert(alignEmpty.length === 0, 'alignNodes with empty array is safe');

  const alignSingle = alignNodes(mixedNodes, ['sub1-a'], 'left');
  assert(alignSingle.length === 6, 'alignNodes with single selection is a safe no-op');

  const alignCenterV = alignNodes(mixedNodes, ['sub1-a', 'sub1-b'], 'center-v');
  assert(alignCenterV.length === 6, 'alignNodes center-v calculates properly');

  const distEmpty = distributeNodes([], [], 'horizontal');
  assert(distEmpty.length === 0, 'distributeNodes with empty array is safe');

  const distTwo = distributeNodes(mixedNodes, ['sub1-a', 'sub1-b'], 'horizontal');
  assert(distTwo.length === 6, 'distributeNodes with fewer than 3 items is a safe no-op');

  const distVertical = distributeNodes(mixedNodes, ['sub1-a', 'sub1-b', 'sub2-a'], 'vertical');
  assert(distVertical.length === 6, 'distributeNodes vertical calculates properly');

  console.log(`\n=== Adversarial Stress Tests Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

runAdversarialTests();
