import { autoLayoutNodes, alignNodes, distributeNodes } from '../../src/lib/services/layout';
import type { Node, Edge } from '@xyflow/svelte';
import type { EntityNodeData, CanvasRelationEdgeData } from '../../src/lib/types';

function runTests() {
  console.log('=== Starting Auto-Layout & Canvas Math Unit Tests ===\n');
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

  // -------------------------------------------------------------------------
  // 1. Auto-Layout: Hierarchical DAG Layout Tests
  // -------------------------------------------------------------------------
  console.log('[Suite 1] Hierarchical DAG Auto-Layout (Sugiyama Framework)');
  const sampleNodes: Node<EntityNodeData>[] = [
    { id: 'n1', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'n1', type: 'npc', title: 'Root Leader', description: '' } },
    { id: 'n2', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'n2', type: 'npc', title: 'Lieutenant A', description: '' } },
    { id: 'n3', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'n3', type: 'npc', title: 'Lieutenant B', description: '' } },
    { id: 'n4', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'n4', type: 'secret', title: 'Deep Secret', description: '' } },
  ];

  const sampleEdges: Edge<CanvasRelationEdgeData>[] = [
    { id: 'e1-2', source: 'n1', target: 'n2', data: { label: 'comanda', relationType: 'allied' } },
    { id: 'e1-3', source: 'n1', target: 'n3', data: { label: 'comanda', relationType: 'allied' } },
    { id: 'e2-4', source: 'n2', target: 'n4', data: { label: 'esconde', relationType: 'secret' } },
  ];

  const dagResult = autoLayoutNodes(sampleNodes, sampleEdges, { algorithm: 'hierarchical', direction: 'TB' });
  const n1Pos = dagResult.nodes.find((n) => n.id === 'n1')!.position;
  const n2Pos = dagResult.nodes.find((n) => n.id === 'n2')!.position;
  const n3Pos = dagResult.nodes.find((n) => n.id === 'n3')!.position;
  const n4Pos = dagResult.nodes.find((n) => n.id === 'n4')!.position;

  assert(n1Pos.y < n2Pos.y, 'Hierarchical layout places root node (n1) above child (n2)');
  assert(n2Pos.y === n3Pos.y, 'Hierarchical layout places sibling nodes (n2, n3) at the same rank height');
  assert(n2Pos.y < n4Pos.y, 'Hierarchical layout places descendant secret (n4) below intermediate node (n2)');
  assert(n2Pos.x !== n3Pos.x, 'Hierarchical layout separates sibling nodes horizontally without overlap');

  // Cycle Handling Test
  console.log('\n[Suite 2] Cycle Detection & Feedback Arc Set');
  const cyclicNodes: Node<EntityNodeData>[] = [
    { id: 'c1', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'c1', type: 'npc', title: 'Node 1', description: '' } },
    { id: 'c2', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'c2', type: 'npc', title: 'Node 2', description: '' } },
    { id: 'c3', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'c3', type: 'npc', title: 'Node 3', description: '' } },
  ];
  const cyclicEdges: Edge<CanvasRelationEdgeData>[] = [
    { id: 'ec1-2', source: 'c1', target: 'c2', data: { label: 'liga', relationType: 'allied' } },
    { id: 'ec2-3', source: 'c2', target: 'c3', data: { label: 'liga', relationType: 'allied' } },
    { id: 'ec3-1', source: 'c3', target: 'c1', data: { label: 'retorna', relationType: 'allied' } }, // Back-edge cycle
  ];

  const cycleResult = autoLayoutNodes(cyclicNodes, cyclicEdges, { algorithm: 'hierarchical' });
  assert(cycleResult.nodes.length === 3, 'Cycle handling successfully terminates without infinite recursion');
  assert(
    new Set(cycleResult.nodes.map((n) => `${n.position.x},${n.position.y}`)).size === 3,
    'Cycle handling assigns distinct, non-overlapping coordinates to all nodes'
  );

  // -------------------------------------------------------------------------
  // 2. Auto-Layout: Force-Directed Physics Tests
  // -------------------------------------------------------------------------
  console.log('\n[Suite 3] Force-Directed Physics Simulation');
  const forceResult = autoLayoutNodes(sampleNodes, sampleEdges, { algorithm: 'force', iterations: 80 });
  assert(forceResult.nodes.length === 4, 'Force-directed layout retains all nodes');
  assert(
    forceResult.nodes.every((n) => n.position.x >= 0 && n.position.y >= 0),
    'Force-directed layout produces strictly non-negative canvas coordinates'
  );

  // -------------------------------------------------------------------------
  // 3. Auto-Layout: Grid Layout Tests
  // -------------------------------------------------------------------------
  console.log('\n[Suite 4] Grid Matrix Layout');
  const gridResult = autoLayoutNodes(sampleNodes, [], { algorithm: 'grid', nodeWidth: 260, nodeHeight: 140, spacingX: 40, spacingY: 40 });
  assert(gridResult.nodes.length === 4, 'Grid layout retains all nodes');
  assert(gridResult.nodes[0].position.x === 100 && gridResult.nodes[0].position.y === 100, 'First grid node placed at (100, 100)');
  assert(gridResult.nodes[1].position.x > gridResult.nodes[0].position.x, 'Second grid node placed in column 2');

  // -------------------------------------------------------------------------
  // 4. Bulk Alignment & Distribution Tests
  // -------------------------------------------------------------------------
  console.log('\n[Suite 5] Bulk Alignment & Distribution Utilities');
  const testNodesForAlign: Node<EntityNodeData>[] = [
    { id: 'a1', type: 'entityNode', position: { x: 100, y: 150 }, data: { id: 'a1', type: 'npc', title: 'A1', description: '' } },
    { id: 'a2', type: 'entityNode', position: { x: 250, y: 300 }, data: { id: 'a2', type: 'npc', title: 'A2', description: '' } },
    { id: 'a3', type: 'entityNode', position: { x: 400, y: 180 }, data: { id: 'a3', type: 'npc', title: 'A3', description: '' } },
  ];

  const alignedTop = alignNodes(testNodesForAlign, ['a1', 'a2', 'a3'], 'top');
  assert(
    alignedTop.every((n) => n.position.y === 150),
    'alignNodes "top" aligns all selected nodes to minimum Y coordinate (150)'
  );

  const alignedLeft = alignNodes(testNodesForAlign, ['a1', 'a2', 'a3'], 'left');
  assert(
    alignedLeft.every((n) => n.position.x === 100),
    'alignNodes "left" aligns all selected nodes to minimum X coordinate (100)'
  );

  const testNodesForDistribute: Node<EntityNodeData>[] = [
    { id: 'd1', type: 'entityNode', position: { x: 100, y: 100 }, data: { id: 'd1', type: 'npc', title: 'D1', description: '' } },
    { id: 'd2', type: 'entityNode', position: { x: 150, y: 100 }, data: { id: 'd2', type: 'npc', title: 'D2', description: '' } },
    { id: 'd3', type: 'entityNode', position: { x: 500, y: 100 }, data: { id: 'd3', type: 'npc', title: 'D3', description: '' } },
  ];

  const distributedH = distributeNodes(testNodesForDistribute, ['d1', 'd2', 'd3'], 'horizontal');
  const d1X = distributedH.find((n) => n.id === 'd1')!.position.x;
  const d2X = distributedH.find((n) => n.id === 'd2')!.position.x;
  const d3X = distributedH.find((n) => n.id === 'd3')!.position.x;
  assert(d1X === 100 && d3X === 500 && d2X === 300, 'distributeNodes "horizontal" spaces middle node at exact midpoint (300)');

  console.log(`\n=== Milestone 1 Unit Tests Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
