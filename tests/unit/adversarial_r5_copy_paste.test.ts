// tests/unit/adversarial_r5_copy_paste.test.ts
// ============================================================================
// ADVERSARIAL STRESS TEST SUITE: Requirement R5 (Copy & Paste Connections with Offset Routing)
// Evaluator: Challenger 2 (Milestone 2)
//
// Rigorously challenges:
// 1. Zero-selection copy graceful no-op
// 2. Multi-edge simultaneous cloning
// 3. Sequential pasting monotonic offset cascade & rapid ID collision stress
// 4. Undo/redo lifecycle and stack integrity
// 5. Parallel line offset routing & visual coordinate displacement
// 6. Faithful metadata & styling preservation with deep mutation isolation
// 7. Edge case hardening (deletion of original, malformed data, export round-trip)
// ============================================================================

const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, val),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

if (typeof (globalThis as any).$state === 'undefined') {
  (globalThis as any).$state = (v: any) => v;
  (globalThis as any).$derived = (v: any) => v;
  (globalThis as any).$derived.by = (fn: any) => (typeof fn === 'function' ? fn() : fn);
  (globalThis as any).$effect = (fn: any) => {};
}

import type { CanvasRelationEdge, CanvasRelationEdgeData } from '../../src/lib/types';
import { get } from 'svelte/store';
import { getSmoothStepPath, getBezierPath, Position } from '@xyflow/system';

async function runAdversarialR5Tests() {
  const { campaignStore } = await import('../../src/lib/stores/campaignStore.svelte');

  console.log('='.repeat(80));
  console.log('  CHALLENGER 2: ADVERSARIAL TEST SUITE — REQUIREMENT R5 (COPY & PASTE EDGES)');
  console.log('='.repeat(80));

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failureDetails: Array<{ testName: string; reason: string }> = [];

  function assert(condition: boolean, testName: string, failureReason?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (failureReason) console.error(`    Reason: ${failureReason}`);
      failedTests++;
      failureDetails.push({ testName, reason: failureReason || 'Assertion failed' });
    }
  }

  function resetStoreWithNodes() {
    storageMap.clear();
    campaignStore.loadCampaign({
      id: 'campaign-adv-r5',
      name: 'Adversarial R5 Testing Campaign',
      nodes: [
        { id: 'node-A', position: { x: 100, y: 100 }, data: { label: 'Card A' } },
        { id: 'node-B', position: { x: 400, y: 100 }, data: { label: 'Card B' } },
        { id: 'node-C', position: { x: 400, y: 400 }, data: { label: 'Card C' } },
        { id: 'node-D', position: { x: 100, y: 400 }, data: { label: 'Card D' } },
      ] as any,
      edges: [],
      clocks: [],
      lore: [],
      timeline: [],
      audioTracks: [],
      audioPlaylists: [],
      settings: {} as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // =========================================================================
  // SUITE 1: Empty Selection & Graceful No-Op Handling
  // =========================================================================
  console.log('\n[Suite 1] Empty Selection & Graceful No-Op Handling');
  resetStoreWithNodes();

  // Add 2 unselected edges to store
  const edgeSetup1: CanvasRelationEdge = {
    id: 'edge-unsel-1',
    source: 'node-A',
    target: 'node-B',
    selected: false,
    data: { label: 'ligação 1', relationType: 'neutral', offset: 20 },
  };
  const edgeSetup2: CanvasRelationEdge = {
    id: 'edge-unsel-2',
    source: 'node-B',
    target: 'node-C',
    selected: false,
    data: { label: 'ligação 2', relationType: 'neutral', offset: 20 },
  };
  campaignStore.addEdge(edgeSetup1);
  campaignStore.addEdge(edgeSetup2);

  // Ensure nothing is selected
  campaignStore.edges.update((list) => list.map((e) => ({ ...e, selected: false })));

  // Test 1.1: Copy with 0 selected edges
  const copyCount0 = campaignStore.copyEdges();
  assert(copyCount0 === 0, 'copyEdges() returns 0 when no edges are selected in the store');

  // Test 1.2: Clipboard state check
  assert(campaignStore.hasCopiedEdges() === false, 'hasCopiedEdges() returns false when clipboard is empty');

  // Test 1.3: Explicit empty array passed
  const copyCountExplicitEmpty = campaignStore.copyEdges([]);
  assert(copyCountExplicitEmpty === 0, 'copyEdges([]) returns 0 for explicit empty array');

  // Test 1.4: copySelectedEdges alias
  const copySelectedCount = campaignStore.copySelectedEdges();
  assert(copySelectedCount === 0, 'copySelectedEdges() returns 0 when no edges are selected');

  // Test 1.5: Paste with empty clipboard returns empty array
  const prePasteUndoStackLen = campaignStore.undoStack.length;
  const pastedEmptyResult = campaignStore.pasteEdges();
  assert(
    Array.isArray(pastedEmptyResult) && pastedEmptyResult.length === 0,
    'pasteEdges() returns empty array [] when clipboard is empty'
  );

  // Test 1.6: Store lengths remain untouched
  assert(get(campaignStore.edges).length === 2, 'campaignStore.edges length unchanged after no-op paste');
  assert((campaignStore.campaign.edges || []).length === 2, 'campaignStore.campaign.edges length unchanged after no-op paste');

  // Test 1.7: No undo snapshot recorded for empty paste
  assert(
    campaignStore.undoStack.length === prePasteUndoStackLen,
    'No undo snapshot recorded when pasteEdges() is a no-op'
  );

  // =========================================================================
  // SUITE 2: Multiple Selected Edges (All Cloned Simultaneously)
  // =========================================================================
  console.log('\n[Suite 2] Multi-Edge Copying & Simultaneous Cloning');
  resetStoreWithNodes();

  const multiEdgeSpecs: CanvasRelationEdge[] = [
    {
      id: 'edge-m-allied',
      source: 'node-A',
      target: 'node-B',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'customLabeledEdge',
      selected: true,
      data: { label: 'Aliados de Sangue', relationType: 'allied', pathType: 'smoothstep', offset: 20 },
    },
    {
      id: 'edge-m-hostile',
      source: 'node-B',
      target: 'node-C',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: 'customLabeledEdge',
      selected: true,
      data: { label: 'Guerra Aberta', relationType: 'hostile', pathType: 'smoothstep', offset: 20 },
    },
    {
      id: 'edge-m-secret',
      source: 'node-C',
      target: 'node-D',
      sourceHandle: 'left',
      targetHandle: 'right',
      type: 'customLabeledEdge',
      selected: true,
      data: { label: 'Culto Secreto', relationType: 'secret', pathType: 'bezier', curvature: 0.3, offset: 20 },
    },
    {
      id: 'edge-m-investigates',
      source: 'node-D',
      target: 'node-A',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: 'customLabeledEdge',
      selected: true,
      data: { label: 'Inquérito Policial', relationType: 'investigates', pathType: 'straight', offset: 20 },
    },
    {
      id: 'edge-m-custom',
      source: 'node-A',
      target: 'node-C',
      sourceHandle: 'right',
      targetHandle: 'top',
      type: 'customLabeledEdge',
      selected: true,
      data: {
        label: 'Pacto Paranormal',
        relationType: 'custom',
        color: '#8b5cf6',
        textColor: '#ddd6fe',
        pathType: 'smoothstep',
        offset: 20,
      },
    },
  ];

  for (const e of multiEdgeSpecs) {
    campaignStore.addEdge(e);
  }

  // Ensure all 5 edges are selected in the store
  campaignStore.edges.update((list) => list.map((e) => ({ ...e, selected: true })));

  const multiCopiedCount = campaignStore.copyEdges();
  assert(multiCopiedCount === 5, 'copyEdges() clones all 5 selected edges simultaneously');
  assert(campaignStore.hasCopiedEdges() === true, 'hasCopiedEdges() is true after copying 5 edges');

  const preMultiPasteCount = get(campaignStore.edges).length;
  const pastedBatch = campaignStore.pasteEdges();

  assert(pastedBatch.length === 5, 'pasteEdges() returns exactly 5 cloned edges for a 5-edge clipboard');
  assert(
    get(campaignStore.edges).length === preMultiPasteCount + 5,
    'campaignStore.edges count increases by exactly 5'
  );
  assert(
    (campaignStore.campaign.edges || []).length === preMultiPasteCount + 5,
    'campaignStore.campaign.edges count increases by exactly 5'
  );

  // Verify all new edges have unique IDs and none collision with original IDs
  const originalIds = new Set(multiEdgeSpecs.map((e) => e.id));
  const newIds = new Set(pastedBatch.map((e) => e.id));
  assert(newIds.size === 5, 'All 5 pasted edges received mutually distinct unique IDs');

  let collisionWithOriginal = false;
  for (const id of newIds) {
    if (originalIds.has(id)) collisionWithOriginal = true;
  }
  assert(!collisionWithOriginal, 'No pasted edge ID collides with any original edge ID');

  // Verify newly pasted edges have selected = true, while original edges have selected = false
  const currentStoreEdges = get(campaignStore.edges);
  const originalEdgesInStore = currentStoreEdges.filter((e) => originalIds.has(e.id));
  const pastedEdgesInStore = currentStoreEdges.filter((e) => newIds.has(e.id));

  assert(
    originalEdgesInStore.every((e) => e.selected === false),
    'All original edges are deselected (selected: false) upon pasting'
  );
  assert(
    pastedEdgesInStore.every((e) => e.selected === true),
    'All newly pasted edges are marked selected: true'
  );

  // Verify exact endpoint and metadata preservation across all 5 edges
  for (let i = 0; i < multiEdgeSpecs.length; i++) {
    const orig = multiEdgeSpecs[i];
    const clone = pastedBatch[i];

    assert(clone.source === orig.source, `Clone #${i + 1} preserves source node (${orig.source})`);
    assert(clone.target === orig.target, `Clone #${i + 1} preserves target node (${orig.target})`);
    assert(clone.sourceHandle === orig.sourceHandle, `Clone #${i + 1} preserves sourceHandle (${orig.sourceHandle})`);
    assert(clone.targetHandle === orig.targetHandle, `Clone #${i + 1} preserves targetHandle (${orig.targetHandle})`);
    assert(clone.data?.label === orig.data?.label, `Clone #${i + 1} preserves label (${orig.data?.label})`);
    assert(clone.data?.relationType === orig.data?.relationType, `Clone #${i + 1} preserves relationType (${orig.data?.relationType})`);
    assert((clone.data?.offset as number) >= 40, `Clone #${i + 1} offset incremented to ${clone.data?.offset}`);
  }

  // =========================================================================
  // SUITE 3: Sequential Pasting, Monotonic Offset Cascade & ID Collision Stress Test
  // =========================================================================
  console.log('\n[Suite 3] Sequential Pasting, Monotonic Offset Cascade & ID Collision Stress');
  resetStoreWithNodes();

  const singleEdge: CanvasRelationEdge = {
    id: 'edge-seq-test',
    source: 'node-A',
    target: 'node-B',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'customLabeledEdge',
    selected: true,
    data: { label: 'Sequência Teste', relationType: 'allied', offset: 20 },
  };
  campaignStore.addEdge(singleEdge);
  campaignStore.copyEdges([singleEdge]);

  // Paste 1 -> offset 40
  const seqPaste1 = campaignStore.pasteEdges();
  const offset1 = seqPaste1[0].data?.offset as number;
  assert(offset1 === 40, `Paste #1 offset incremented to 40 (actual: ${offset1})`);

  // Paste 2 -> offset 60
  const seqPaste2 = campaignStore.pasteEdges();
  const offset2 = seqPaste2[0].data?.offset as number;
  assert(offset2 === 60, `Paste #2 offset incremented to 60 (actual: ${offset2})`);

  // Paste 3 -> offset 80
  const seqPaste3 = campaignStore.pasteEdges();
  const offset3 = seqPaste3[0].data?.offset as number;
  assert(offset3 === 80, `Paste #3 offset incremented to 80 (actual: ${offset3})`);

  // Paste 4 -> offset 100
  const seqPaste4 = campaignStore.pasteEdges();
  const offset4 = seqPaste4[0].data?.offset as number;
  assert(offset4 === 100, `Paste #4 offset incremented to 100 (actual: ${offset4})`);

  // Paste 5 -> offset 120
  const seqPaste5 = campaignStore.pasteEdges();
  const offset5 = seqPaste5[0].data?.offset as number;
  assert(offset5 === 120, `Paste #5 offset incremented to 120 (actual: ${offset5})`);

  assert(
    offset1 < offset2 && offset2 < offset3 && offset3 < offset4 && offset4 < offset5,
    'Offsets are strictly monotonically increasing across sequential pastes (40 < 60 < 80 < 100 < 120)'
  );

  // Test custom offsetStep parameter
  const customStepPaste = campaignStore.pasteEdges(35);
  const customOffset = customStepPaste[0].data?.offset as number;
  assert(
    customOffset === 155,
    `Custom offsetStep=35 produces offset 155 (120 + 35, actual: ${customOffset})`
  );

  // ADVERSARIAL RAPID PASTING STRESS TEST:
  // Execute 300 sequential pastes synchronously in the same millisecond/tick
  console.log('  Executing rapid 300-paste stress test...');
  const rapidPastedIds: string[] = [];
  const rapidOffsets: number[] = [];

  for (let i = 0; i < 300; i++) {
    const res = campaignStore.pasteEdges(20);
    rapidPastedIds.push(res[0].id);
    rapidOffsets.push(res[0].data?.offset as number);
  }

  const uniqueRapidIds = new Set(rapidPastedIds);
  assert(
    uniqueRapidIds.size === 300,
    `ZERO ID collisions detected across 300 rapid sequential pastes (Unique IDs: ${uniqueRapidIds.size}/300)`
  );

  assert(
    rapidOffsets[rapidOffsets.length - 1] === 155 + 300 * 20,
    `Offsets scaled cleanly up to ${rapidOffsets[rapidOffsets.length - 1]} without NaN or numeric overflow`
  );

  const totalEdgesAfterStress = get(campaignStore.edges).length;
  assert(
    totalEdgesAfterStress === 1 + 6 + 300,
    `Edges count accurate after stress test (Expected: 307, actual: ${totalEdgesAfterStress})`
  );

  // =========================================================================
  // SUITE 4: Undo / Redo Lifecycle of Pasted Connections
  // =========================================================================
  console.log('\n[Suite 4] Undo / Redo Lifecycle of Pasted Connections');
  resetStoreWithNodes();

  const baseEdgeForUndo: CanvasRelationEdge = {
    id: 'edge-undo-base',
    source: 'node-A',
    target: 'node-B',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'customLabeledEdge',
    selected: true,
    data: { label: 'Base Undo Test', relationType: 'neutral', offset: 20 },
  };
  campaignStore.addEdge(baseEdgeForUndo);
  campaignStore.copyEdges([baseEdgeForUndo]);

  const baselineCount = get(campaignStore.edges).length; // 1

  // 1. Single paste undo/redo
  const singlePaste = campaignStore.pasteEdges();
  const singlePastedId = singlePaste[0].id;
  assert(get(campaignStore.edges).length === baselineCount + 1, 'Edge count increases by 1 after paste');

  campaignStore.undo();
  assert(
    get(campaignStore.edges).length === baselineCount,
    'Undo pasteEdges() removes pasted edge and restores baseline count'
  );
  assert(
    !get(campaignStore.edges).some((e) => e.id === singlePastedId),
    'Pasted edge ID no longer exists in campaignStore.edges after undo'
  );
  assert(
    !(campaignStore.campaign.edges || []).some((e) => e.id === singlePastedId),
    'Pasted edge ID no longer exists in campaignStore.campaign.edges after undo'
  );

  campaignStore.redo();
  assert(
    get(campaignStore.edges).length === baselineCount + 1,
    'Redo restores edge count to baseline + 1'
  );
  assert(
    get(campaignStore.edges).some((e) => e.id === singlePastedId),
    'Pasted edge ID restored in campaignStore.edges after redo'
  );
  assert(
    (campaignStore.campaign.edges || []).some((e) => e.id === singlePastedId),
    'Pasted edge ID restored in campaignStore.campaign.edges after redo'
  );

  // 2. Multi-step deep undo/redo sequence
  resetStoreWithNodes();
  campaignStore.addEdge(baseEdgeForUndo);
  campaignStore.copyEdges([baseEdgeForUndo]);

  const p1 = campaignStore.pasteEdges(); // Batch 1 (+1)
  const p2 = campaignStore.pasteEdges(); // Batch 2 (+1)
  const p3 = campaignStore.pasteEdges(); // Batch 3 (+1)

  assert(get(campaignStore.edges).length === 4, 'Store has 4 edges after 3 sequential pastes');

  campaignStore.undo(); // Undo paste 3
  assert(get(campaignStore.edges).length === 3, 'Undo 1/3 restores store length to 3');
  assert(!get(campaignStore.edges).some((e) => e.id === p3[0].id), 'Paste 3 edge removed');

  campaignStore.undo(); // Undo paste 2
  assert(get(campaignStore.edges).length === 2, 'Undo 2/3 restores store length to 2');
  assert(!get(campaignStore.edges).some((e) => e.id === p2[0].id), 'Paste 2 edge removed');

  campaignStore.undo(); // Undo paste 1
  assert(get(campaignStore.edges).length === 1, 'Undo 3/3 restores store length to 1 (clean original)');
  assert(!get(campaignStore.edges).some((e) => e.id === p1[0].id), 'Paste 1 edge removed');

  campaignStore.redo(); // Redo paste 1
  assert(get(campaignStore.edges).length === 2, 'Redo 1/3 re-creates paste 1');
  assert(get(campaignStore.edges).some((e) => e.id === p1[0].id), 'Paste 1 edge restored');

  campaignStore.redo(); // Redo paste 2
  assert(get(campaignStore.edges).length === 3, 'Redo 2/3 re-creates paste 2');
  assert(get(campaignStore.edges).some((e) => e.id === p2[0].id), 'Paste 2 edge restored');

  campaignStore.redo(); // Redo paste 3
  assert(get(campaignStore.edges).length === 4, 'Redo 3/3 re-creates paste 3');
  assert(get(campaignStore.edges).some((e) => e.id === p3[0].id), 'Paste 3 edge restored');

  // 3. Clipboard survives undo operations
  campaignStore.undo(); // Undo paste 3
  assert(campaignStore.hasCopiedEdges() === true, 'Undo does not clear copiedEdges clipboard');
  const freshPaste = campaignStore.pasteEdges();
  assert(freshPaste.length === 1, 'Can paste again after undoing without re-copying');

  // =========================================================================
  // SUITE 5: Parallel Line Offset Routing & Visual Coordinate Displacement
  // =========================================================================
  console.log('\n[Suite 5] Parallel Line Offset Routing & Visual Coordinate Displacement');

  // 5.1: Horizontal SmoothStep displacement (Right -> Left)
  // When routing from Card A (Right) to Card B (Left) with different offsets
  const pathSmooth20 = getSmoothStepPath({
    sourceX: 100,
    sourceY: 100,
    targetX: 400,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    borderRadius: 10,
    offset: 20,
  });

  const pathSmooth40 = getSmoothStepPath({
    sourceX: 100,
    sourceY: 100,
    targetX: 400,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    borderRadius: 10,
    offset: 40,
  });

  const pathSmooth60 = getSmoothStepPath({
    sourceX: 100,
    sourceY: 100,
    targetX: 400,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    borderRadius: 10,
    offset: 60,
  });

  assert(
    pathSmooth20[0] !== pathSmooth40[0],
    'SmoothStep SVG path string at offset 20 is strictly different from offset 40'
  );
  assert(
    pathSmooth40[0] !== pathSmooth60[0],
    'SmoothStep SVG path string at offset 40 is strictly different from offset 60'
  );

  // 5.2: Same-Side Parallel Lines (Top -> Top): Loop Height & LabelY Displacement
  // This is the classic parallel edge collision scenario where two connections emerge from the top handles
  const pathTop20 = getSmoothStepPath({
    sourceX: 100,
    sourceY: 100,
    targetX: 400,
    targetY: 100,
    sourcePosition: Position.Top,
    targetPosition: Position.Top,
    borderRadius: 10,
    offset: 20,
  });

  const pathTop40 = getSmoothStepPath({
    sourceX: 100,
    sourceY: 100,
    targetX: 400,
    targetY: 100,
    sourcePosition: Position.Top,
    targetPosition: Position.Top,
    borderRadius: 10,
    offset: 40,
  });

  const pathTop60 = getSmoothStepPath({
    sourceX: 100,
    sourceY: 100,
    targetX: 400,
    targetY: 100,
    sourcePosition: Position.Top,
    targetPosition: Position.Top,
    borderRadius: 10,
    offset: 60,
  });

  // pathResult is [svgPath, labelX, labelY, offsetX, offsetY]
  const labelY20 = pathTop20[2];
  const labelY40 = pathTop40[2];
  const labelY60 = pathTop60[2];

  assert(labelY20 === 80, `Top->Top offset 20 places labelY at 80 (actual: ${labelY20})`);
  assert(labelY40 === 60, `Top->Top offset 40 places labelY at 60 (actual: ${labelY40})`);
  assert(labelY60 === 40, `Top->Top offset 60 places labelY at 40 (actual: ${labelY60})`);
  assert(
    labelY20 - labelY40 === 20 && labelY40 - labelY60 === 20,
    'Top->Top parallel lines displace label badges vertically by exactly 20px per paste'
  );

  // 5.3: Same-Side Parallel Lines (Bottom -> Bottom): Downward Displacement
  const pathBottom20 = getSmoothStepPath({
    sourceX: 100,
    sourceY: 200,
    targetX: 400,
    targetY: 200,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Bottom,
    borderRadius: 10,
    offset: 20,
  });

  const pathBottom40 = getSmoothStepPath({
    sourceX: 100,
    sourceY: 200,
    targetX: 400,
    targetY: 200,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Bottom,
    borderRadius: 10,
    offset: 40,
  });

  const labelYBottom20 = pathBottom20[2];
  const labelYBottom40 = pathBottom40[2];
  assert(
    labelYBottom40 > labelYBottom20,
    `Bottom->Bottom parallel lines displace downwards (offset 20: ${labelYBottom20}, offset 40: ${labelYBottom40})`
  );
  assert(
    labelYBottom40 - labelYBottom20 === 20,
    'Bottom->Bottom parallel lines displace label badges downwards by exactly 20px'
  );

  // 5.4: Bezier Curvature Displacement (Reverse / Loopback Direction)
  // CustomLabeledEdge.svelte computes: curvature = baseCurvature + (data.offset - 20) * 0.01
  const bezierBaseCurvature = 0.25;
  const curvature20 = bezierBaseCurvature;
  const curvature40 = bezierBaseCurvature + (40 - 20) * 0.01; // 0.45
  const curvature60 = bezierBaseCurvature + (60 - 20) * 0.01; // 0.65

  const bezierPath20 = getBezierPath({
    sourceX: 400,
    sourceY: 100,
    targetX: 100,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    curvature: curvature20,
  });

  const bezierPath40 = getBezierPath({
    sourceX: 400,
    sourceY: 100,
    targetX: 100,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    curvature: curvature40,
  });

  const bezierPath60 = getBezierPath({
    sourceX: 400,
    sourceY: 100,
    targetX: 100,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    curvature: curvature60,
  });

  assert(
    bezierPath20[0] !== bezierPath40[0],
    'Bezier loopback path string at offset 20 is strictly different from offset 40'
  );
  assert(
    bezierPath40[0] !== bezierPath60[0],
    'Bezier loopback path string at offset 40 is strictly different from offset 60'
  );

  // =========================================================================
  // SUITE 6: Metadata, Styling Preservation & Mutation Isolation
  // =========================================================================
  console.log('\n[Suite 6] Metadata, Styling Preservation & Mutation Isolation');
  resetStoreWithNodes();

  const richMasterEdge: CanvasRelationEdge = {
    id: 'edge-rich-master',
    source: 'node-A',
    target: 'node-C',
    sourceHandle: 'top',
    targetHandle: 'bottom',
    type: 'customLabeledEdge',
    selected: true,
    style: 'stroke-width: 3px; stroke-dasharray: 6 3;',
    markerStart: 'arrow',
    markerEnd: 'arrowclosed',
    data: {
      label: 'Conspiração Dinástica Proibida',
      relationType: 'custom',
      color: '#e11d48',
      textColor: '#fef08a',
      notes: 'Texto confidencial ultra-secreto guardado em cofre forte',
      bidirectional: true,
      pathType: 'bezier',
      curvature: 0.35,
      icon: 'crown',
      offset: 20,
    },
  };

  campaignStore.addEdge(richMasterEdge);
  campaignStore.copyEdges([richMasterEdge]);

  const richPastedList = campaignStore.pasteEdges();
  assert(richPastedList.length === 1, 'Pasted rich master edge');
  const richClone = richPastedList[0];

  // Verify all fields are faithfully preserved
  assert(richClone.id !== richMasterEdge.id, 'Clone received distinct ID');
  assert(richClone.source === 'node-A', 'Clone preserved source');
  assert(richClone.target === 'node-C', 'Clone preserved target');
  assert(richClone.sourceHandle === 'top', 'Clone preserved sourceHandle');
  assert(richClone.targetHandle === 'bottom', 'Clone preserved targetHandle');
  assert(richClone.type === 'customLabeledEdge', 'Clone preserved edge component type');
  assert(richClone.style === 'stroke-width: 3px; stroke-dasharray: 6 3;', 'Clone preserved inline CSS style');
  assert(richClone.markerStart === 'arrow', 'Clone preserved markerStart');
  assert(richClone.markerEnd === 'arrowclosed', 'Clone preserved markerEnd');
  assert(richClone.data?.label === 'Conspiração Dinástica Proibida', 'Clone preserved label text');
  assert(richClone.data?.relationType === 'custom', 'Clone preserved relationType');
  assert(richClone.data?.color === '#e11d48', 'Clone preserved custom edge color');
  assert(richClone.data?.textColor === '#fef08a', 'Clone preserved custom text color');
  assert(richClone.data?.notes === 'Texto confidencial ultra-secreto guardado em cofre forte', 'Clone preserved master notes');
  assert(richClone.data?.bidirectional === true, 'Clone preserved bidirectional flag');
  assert(richClone.data?.pathType === 'bezier', 'Clone preserved pathType');
  assert(richClone.data?.curvature === 0.35, 'Clone preserved curvature parameter');
  assert(richClone.data?.icon === 'crown', 'Clone preserved icon identifier');

  // ADVERSARIAL MUTATION ISOLATION TEST:
  // Mutating the cloned edge must NOT contaminate the original edge or subsequent pastes!
  console.log('  Testing deep mutation isolation...');
  (richClone.data as any).label = 'LABEL_MUTADA_INVASIVA';
  (richClone.data as any).color = '#000000';
  (richClone.data as any).textColor = '#ffffff';
  (richClone.data as any).notes = 'NOTAS_ALTERADAS';
  richClone.sourceHandle = 'left';

  // Check original edge in store
  const originalInStore = get(campaignStore.edges).find((e) => e.id === 'edge-rich-master');
  assert(
    originalInStore?.data?.label === 'Conspiração Dinástica Proibida',
    'Original edge label is completely untouched by mutation to clone'
  );
  assert(
    originalInStore?.data?.color === '#e11d48',
    'Original edge color is completely untouched by mutation to clone'
  );
  assert(
    originalInStore?.data?.textColor === '#fef08a',
    'Original edge textColor is completely untouched by mutation to clone'
  );
  assert(
    originalInStore?.data?.notes === 'Texto confidencial ultra-secreto guardado em cofre forte',
    'Original edge notes are completely untouched by mutation to clone'
  );
  assert(
    originalInStore?.sourceHandle === 'top',
    'Original edge sourceHandle is completely untouched by mutation to clone'
  );

  // Subsequent paste should derive from clipboard, not corrupted clone
  const secondPastedList = campaignStore.pasteEdges();
  const secondClone = secondPastedList[0];
  assert(
    secondClone.data?.label === 'Conspiração Dinástica Proibida',
    'Subsequent paste derives from pristine clipboard without contamination'
  );
  assert(
    secondClone.data?.color === '#e11d48',
    'Subsequent paste preserves pristine color from clipboard'
  );

  // =========================================================================
  // SUITE 7: Edge Case Hardening & Campaign Serialization Round-Trip
  // =========================================================================
  console.log('\n[Suite 7] Edge Case Hardening & Campaign Serialization Round-Trip');
  resetStoreWithNodes();

  // 7.1: Clipboard survives deletion of original edge
  const tempEdge: CanvasRelationEdge = {
    id: 'edge-to-be-deleted',
    source: 'node-A',
    target: 'node-B',
    selected: true,
    data: { label: 'Temp Edge', relationType: 'allied', offset: 20 },
  };
  campaignStore.addEdge(tempEdge);
  campaignStore.copyEdges([tempEdge]);

  // Delete the original edge
  campaignStore.deleteEdge('edge-to-be-deleted');
  assert(
    !get(campaignStore.edges).some((e) => e.id === 'edge-to-be-deleted'),
    'Original edge deleted from store'
  );

  // Paste: should still work because clipboard holds deep clone
  const pasteAfterDeletion = campaignStore.pasteEdges();
  assert(pasteAfterDeletion.length === 1, 'pasteEdges() succeeds after original edge was deleted');
  assert(
    pasteAfterDeletion[0].id !== 'edge-to-be-deleted',
    'Pasted edge has new unique ID even when original was deleted'
  );
  assert(
    pasteAfterDeletion[0].data?.label === 'Temp Edge',
    'Pasted edge retains original label after original edge was deleted'
  );

  // 7.2: Edge with undefined / partial data object does not throw
  const edgeNoData: any = {
    id: 'edge-no-data',
    source: 'node-C',
    target: 'node-D',
    selected: true,
  };
  campaignStore.addEdge(edgeNoData);
  campaignStore.copyEdges([edgeNoData]);

  let didThrowOnNoData = false;
  try {
    const pasteNoData = campaignStore.pasteEdges();
    assert(pasteNoData.length === 1, 'Pasted edge with previously missing data object');
    assert(
      typeof pasteNoData[0].data?.offset === 'number',
      'Pasted edge receives default numeric offset cleanly without crashing'
    );
  } catch (err) {
    didThrowOnNoData = true;
  }
  assert(!didThrowOnNoData, 'pasteEdges() handles edge with missing data without throwing TypeError');

  // 7.3: Campaign Export & Reload Round-Trip
  // Verify all duplicated edges with custom offsets serialize and deserialize losslessly
  const exportedCampaign = campaignStore.exportCurrentCampaign();
  assert(
    Array.isArray(exportedCampaign.edges) && exportedCampaign.edges.length > 0,
    'exportCurrentCampaign() includes duplicated edges'
  );

  const exportedOffsetEdges = exportedCampaign.edges.filter((e: any) => typeof e.data?.offset === 'number');
  assert(
    exportedOffsetEdges.length > 0,
    'Exported payload preserves numeric offset routing fields'
  );

  // Reload the exported campaign
  campaignStore.loadCampaign(exportedCampaign);
  const reloadedEdges = get(campaignStore.edges);
  assert(
    reloadedEdges.length === exportedCampaign.edges.length,
    'loadCampaign() restores exact number of edges from exported payload'
  );
  assert(
    reloadedEdges.every((e) => e.type === 'customLabeledEdge'),
    'All restored edges normalized as customLabeledEdge'
  );

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log(`CHALLENGER 2 ADVERSARIAL TEST SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('='.repeat(80));

  if (failedTests > 0) {
    console.error('\nFailures breakdown:');
    for (const f of failureDetails) {
      console.error(` - [${f.testName}]: ${f.reason}`);
    }
    process.exit(1);
  }
}

runAdversarialR5Tests().catch((err) => {
  console.error('Adversarial R5 test runner encountered uncaught error:', err);
  process.exit(1);
});
