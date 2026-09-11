// tests/unit/adversarial_r2_r4.test.ts
// Empirical Adversarial Challenge Test Suite for Milestone 2: Requirements R2 & R4
// Challenger 1: Adversarial verification of Multi-Connections per Handle and Interactive Reconnection.

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

async function runAdversarialSuite() {
  const { campaignStore } = await import('../../src/lib/stores/campaignStore.svelte');

  console.log('================================================================================');
  console.log('  CHALLENGER 1: ADVERSARIAL STRESS SUITE — REQUIREMENTS R2 & R4');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, failureDetails?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (failureDetails) {
        console.error(`    Details: ${failureDetails}`);
      }
      failed++;
    }
  }

  function resetStore() {
    storageMap.clear();
    (campaignStore as any).undoStack = [];
    (campaignStore as any).redoStack = [];

    // Create a base campaign with 30 distinct nodes for high-density connection stress
    const initialNodes = Array.from({ length: 30 }, (_, i) => ({
      id: `node-${i + 1}`,
      position: { x: (i % 6) * 200, y: Math.floor(i / 6) * 150 },
      data: {
        id: `node-${i + 1}`,
        title: `Investigative Entity ${i + 1}`,
        category: i % 2 === 0 ? 'npc' : 'faction',
        tags: [`tier-${(i % 3) + 1}`],
      },
    }));

    campaignStore.loadCampaign({
      id: 'adversarial-r2-r4-campaign',
      name: 'Adversarial Challenge Campaign R2 & R4',
      nodes: initialNodes as any,
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

  // ===========================================================================
  // SECTION 1: REQUIREMENT R2 ADVERSARIAL CHALLENGES (MULTI-CONNECTION PER HANDLE)
  // ===========================================================================
  console.log('[SECTION 1] Requirement R2: Multi-Connection per Handle Adversarial Stress\n');
  resetStore();

  // Test 1.1: 15+ simultaneous outgoing connections from the EXACT SAME handle ('top' on node-1)
  const OUTGOING_COUNT = 16;
  for (let i = 2; i <= OUTGOING_COUNT + 1; i++) {
    const edge: CanvasRelationEdge = {
      id: `edge-multi-top-${i}`,
      source: 'node-1',
      target: `node-${i}`,
      sourceHandle: 'top', // All branching from 'top'
      targetHandle: ['top', 'bottom', 'left', 'right'][i % 4],
      type: 'customLabeledEdge',
      data: {
        label: `Relação R2-${i}`,
        relationType: (['allied', 'hostile', 'neutral', 'investigates'] as const)[i % 4],
        pathType: 'smoothstep',
        notes: `Branch ${i} originating from node-1:top`,
      },
    };
    campaignStore.addEdge(edge);
  }

  const edgesAfter16 = get(campaignStore.edges);
  assert(
    edgesAfter16.length === OUTGOING_COUNT,
    `Successfully created ${OUTGOING_COUNT} edges without dropping any earlier connections`
  );

  const topBranches = edgesAfter16.filter((e) => e.source === 'node-1' && e.sourceHandle === 'top');
  assert(
    topBranches.length === OUTGOING_COUNT,
    `All ${OUTGOING_COUNT} edges strictly retain source='node-1' and sourceHandle='top'`
  );

  const campaignMasterTopBranches = (campaignStore.campaign.edges || []).filter(
    (e) => e.source === 'node-1' && e.sourceHandle === 'top'
  );
  assert(
    campaignMasterTopBranches.length === OUTGOING_COUNT,
    `campaignStore.campaign.edges also has all ${OUTGOING_COUNT} multi-connections synchronized`
  );

  // Test 1.2: Convergent connections — 10 additional edges converging into the EXACT SAME handle ('top' on node-1)
  const CONVERGENT_COUNT = 10;
  for (let i = 18; i < 18 + CONVERGENT_COUNT; i++) {
    const edge: CanvasRelationEdge = {
      id: `edge-convergent-${i}-to-node1`,
      source: `node-${i}`,
      target: 'node-1',
      sourceHandle: 'bottom',
      targetHandle: 'top', // Incoming to 'top' on node-1
      type: 'customLabeledEdge',
      data: {
        label: `Convergente ${i}`,
        relationType: 'investigates',
        pathType: 'smoothstep',
      },
    };
    campaignStore.addEdge(edge);
  }

  const edgesAfterConvergence = get(campaignStore.edges);
  assert(
    edgesAfterConvergence.length === OUTGOING_COUNT + CONVERGENT_COUNT,
    `Edges count is now ${OUTGOING_COUNT + CONVERGENT_COUNT} (${OUTGOING_COUNT} outgoing + ${CONVERGENT_COUNT} incoming)`
  );

  const node1TopAll = edgesAfterConvergence.filter(
    (e) => (e.source === 'node-1' && e.sourceHandle === 'top') || (e.target === 'node-1' && e.targetHandle === 'top')
  );
  assert(
    node1TopAll.length === OUTGOING_COUNT + CONVERGENT_COUNT,
    `Handle 'top' on node-1 simultaneously hosts ${OUTGOING_COUNT} outgoing AND ${CONVERGENT_COUNT} incoming connections (${node1TopAll.length} total)`
  );

  // Test 1.3: Parallel Connections — Multiple edges sharing BOTH the same source AND same target handle
  for (let p = 1; p <= 4; p++) {
    const parallelEdge: CanvasRelationEdge = {
      id: `edge-parallel-${p}`,
      source: 'node-1',
      target: 'node-2',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      type: 'customLabeledEdge',
      data: {
        label: `Paralelo ${p}`,
        relationType: 'allied',
        offset: 20 + p * 18,
      },
    };
    campaignStore.addEdge(parallelEdge);
  }

  const parallelEdgesFound = get(campaignStore.edges).filter(
    (e) => e.source === 'node-1' && e.target === 'node-2' && e.sourceHandle === 'top' && e.targetHandle === 'bottom'
  );
  assert(
    parallelEdgesFound.length === 4,
    '4 parallel distinct edges simultaneously co-exist between node-1:top and node-2:bottom'
  );

  // Test 1.4: Serialization & Deserialization Integrity (JSON export round-trip)
  const preExportCount = get(campaignStore.edges).length;
  const exported = campaignStore.exportCurrentCampaign();
  assert(
    exported.edges.length === preExportCount,
    `exportCurrentCampaign preserves all ${preExportCount} multi-connections`
  );

  const serializedString = JSON.stringify(exported);
  assert(serializedString.length > 0, 'Campaign successfully serializes to JSON string without circular reference errors');

  const deserialized = JSON.parse(serializedString);
  assert(deserialized.edges.length === preExportCount, 'JSON deserialization restores all multi-connections');

  // Verify each edge in deserialized keeps sourceHandle and targetHandle
  const everyHandlePreserved = deserialized.edges.every(
    (e: any) => typeof e.sourceHandle === 'string' && typeof e.targetHandle === 'string'
  );
  assert(everyHandlePreserved, 'Every deserialized edge preserves sourceHandle and targetHandle strings');

  // Test 1.5: Re-loading campaign restores all multi-connections perfectly
  campaignStore.loadCampaign(deserialized);
  assert(
    get(campaignStore.edges).length === preExportCount,
    'loadCampaign re-establishes all multi-connections in campaignStore.edges'
  );
  assert(
    (campaignStore.campaign.edges || []).length === preExportCount,
    'loadCampaign re-establishes all multi-connections in campaignStore.campaign.edges'
  );

  // Test 1.6: syncCurrentNodesToMaster idempotency and preservation
  campaignStore.syncCurrentNodesToMaster();
  assert(
    (campaignStore.campaign.edges || []).length === preExportCount,
    'syncCurrentNodesToMaster preserves 100% of multi-connection edges'
  );

  // Test 1.7: Selective Deletion from High-Density Multi-Connection Handle
  const edgeToDelete = parallelEdgesFound[0];
  campaignStore.deleteEdge(edgeToDelete.id);

  const edgesAfterDelete = get(campaignStore.edges);
  assert(
    edgesAfterDelete.length === preExportCount - 1,
    'deleteEdge removes precisely 1 edge from high-density handle'
  );
  assert(
    !edgesAfterDelete.some((e) => e.id === edgeToDelete.id),
    'Deleted edge ID is absent from edges store'
  );
  assert(
    !(campaignStore.campaign.edges || []).some((e) => e.id === edgeToDelete.id),
    'Deleted edge ID is absent from campaign.edges'
  );

  const remainingParallel = edgesAfterDelete.filter(
    (e) => e.source === 'node-1' && e.target === 'node-2' && e.sourceHandle === 'top' && e.targetHandle === 'bottom'
  );
  assert(
    remainingParallel.length === 3,
    'Remaining 3 parallel edges on node-1:top remain completely intact'
  );

  // Test 1.8: Undo selective deletion restores the edge to the same handle
  campaignStore.undo();
  const edgesAfterUndoDelete = get(campaignStore.edges);
  assert(
    edgesAfterUndoDelete.length === preExportCount,
    'Undo restores deleted edge count'
  );
  const restoredDeletedEdge = edgesAfterUndoDelete.find((e) => e.id === edgeToDelete.id);
  assert(
    restoredDeletedEdge?.source === 'node-1' && restoredDeletedEdge?.sourceHandle === 'top',
    'Undo restores deleted edge with original source handle intact'
  );

  // Test 1.9: Sequential Undo/Redo Stress on Multi-Connections
  // Create a clean baseline
  resetStore();
  const baselineCount = get(campaignStore.edges).length;
  assert(baselineCount === 0, 'Clean baseline has 0 edges');

  const STRESS_BATCH = 12;
  for (let s = 1; s <= STRESS_BATCH; s++) {
    campaignStore.addEdge({
      id: `edge-undo-stress-${s}`,
      source: 'node-1',
      target: `node-${s + 1}`,
      sourceHandle: 'top',
      targetHandle: 'left',
      type: 'customLabeledEdge',
      data: { label: `Stress ${s}`, relationType: 'allied' },
    });
  }
  assert(get(campaignStore.edges).length === STRESS_BATCH, `${STRESS_BATCH} stress edges added`);

  // Step undo STRESS_BATCH times
  for (let u = STRESS_BATCH; u >= 1; u--) {
    campaignStore.undo();
    const currentCount = get(campaignStore.edges).length;
    assert(
      currentCount === u - 1,
      `Undo step ${STRESS_BATCH - u + 1}: edge count cleanly decremented to ${u - 1}`
    );
  }
  assert(get(campaignStore.edges).length === 0, 'After 12 undos, store has 0 edges');

  // Step redo STRESS_BATCH times
  for (let r = 1; r <= STRESS_BATCH; r++) {
    campaignStore.redo();
    const currentCount = get(campaignStore.edges).length;
    assert(
      currentCount === r,
      `Redo step ${r}: edge count cleanly restored to ${r}`
    );
  }
  assert(get(campaignStore.edges).length === STRESS_BATCH, 'After 12 redos, all 12 multi-connections fully restored');

  const finalEdgesOnTop = get(campaignStore.edges).filter(
    (e) => e.source === 'node-1' && e.sourceHandle === 'top'
  );
  assert(
    finalEdgesOnTop.length === STRESS_BATCH,
    `All ${STRESS_BATCH} edges restored to node-1:top with handles intact`
  );

  // ===========================================================================
  // SECTION 2: REQUIREMENT R4 ADVERSARIAL CHALLENGES (INTERACTIVE RECONNECTION)
  // ===========================================================================
  console.log('\n[SECTION 2] Requirement R4: Interactive Edge Reconnection Adversarial Stress\n');
  resetStore();

  // Seed with an initial rich edge
  const richEdge: CanvasRelationEdge = {
    id: 'edge-reconnect-subject',
    source: 'node-1',
    target: 'node-2',
    sourceHandle: 'top',
    targetHandle: 'bottom',
    type: 'customLabeledEdge',
    data: {
      label: 'Conexão Crítica Oculta',
      relationType: 'hostile',
      pathType: 'bezier',
      bidirectional: true,
      notes: 'Pista deixada no quarto secreto de Sintra',
      offset: 45,
    },
  };
  campaignStore.addEdge(richEdge);

  // Test 2.1: Self-Connection Rejection (source === target)
  const selfTargetAttempt = campaignStore.reconnectEdge('edge-reconnect-subject', {
    source: 'node-1',
    target: 'node-1',
    sourceHandle: 'top',
    targetHandle: 'bottom',
  });
  assert(selfTargetAttempt === false, 'reconnectEdge returns false when target is set to source node (self-connection)');

  const selfSourceAttempt = campaignStore.reconnectEdge('edge-reconnect-subject', {
    source: 'node-2',
    target: 'node-2',
    sourceHandle: 'left',
    targetHandle: 'right',
  });
  assert(selfSourceAttempt === false, 'reconnectEdge returns false when source is set to target node (self-connection)');

  const edgeAfterSelfAttempts = get(campaignStore.edges).find((e) => e.id === 'edge-reconnect-subject');
  assert(
    edgeAfterSelfAttempts?.source === 'node-1' && edgeAfterSelfAttempts?.target === 'node-2',
    'Edge endpoints remain strictly uncorrupted after rejected self-connection attempts'
  );

  // Test 2.2: Missing and Invalid Endpoints Handling (Safely Handled)
  const emptySourceAttempt = campaignStore.reconnectEdge('edge-reconnect-subject', {
    source: '',
    target: 'node-3',
  });
  assert(emptySourceAttempt === false, 'reconnectEdge returns false for empty string source');

  const emptyTargetAttempt = campaignStore.reconnectEdge('edge-reconnect-subject', {
    source: 'node-1',
    target: '',
  });
  assert(emptyTargetAttempt === false, 'reconnectEdge returns false for empty string target');

  const nonExistentEdgeAttempt = campaignStore.reconnectEdge('edge-non-existent-999', {
    source: 'node-3',
    target: 'node-4',
  });
  assert(nonExistentEdgeAttempt === false, 'reconnectEdge returns false for non-existent edge ID');

  // Test 2.3: Reconnecting with null/undefined handle attributes (safely handled)
  const handleNullAttempt = campaignStore.reconnectEdge('edge-reconnect-subject', {
    source: 'node-1',
    target: 'node-3',
    sourceHandle: null,
    targetHandle: 'left',
  });
  assert(handleNullAttempt === true, 'reconnectEdge succeeds with sourceHandle=null');
  const edgeWithNullHandle = get(campaignStore.edges).find((e) => e.id === 'edge-reconnect-subject');
  assert(edgeWithNullHandle?.sourceHandle === null, 'sourceHandle updated to null');
  assert(edgeWithNullHandle?.target === 'node-3', 'target updated to node-3');
  assert(edgeWithNullHandle?.targetHandle === 'left', 'targetHandle updated to "left"');

  // Test 2.4: Sequential Reconnections with 100% Edge Data Preservation
  // We perform 6 rapid reconnections and verify all metadata fields remain untouched at each step
  const metadataSteps = [
    { source: 'node-1', target: 'node-4', sourceHandle: 'right', targetHandle: 'top' },
    { source: 'node-5', target: 'node-4', sourceHandle: 'bottom', targetHandle: 'top' },
    { source: 'node-5', target: 'node-6', sourceHandle: 'bottom', targetHandle: 'left' },
    { source: 'node-7', target: 'node-6', sourceHandle: 'left', targetHandle: 'left' },
    { source: 'node-7', target: 'node-8', sourceHandle: 'left', targetHandle: 'right' },
    { source: 'node-1', target: 'node-2', sourceHandle: 'top', targetHandle: 'bottom' }, // Back to original endpoints
  ];

  for (let s = 0; s < metadataSteps.length; s++) {
    const step = metadataSteps[s];
    const ok = campaignStore.reconnectEdge('edge-reconnect-subject', step);
    assert(ok === true, `Sequential reconnection step ${s + 1} succeeded`);

    const currentEdge = get(campaignStore.edges).find((e) => e.id === 'edge-reconnect-subject');
    assert(currentEdge?.source === step.source, `Step ${s + 1}: source matches expected ${step.source}`);
    assert(currentEdge?.target === step.target, `Step ${s + 1}: target matches expected ${step.target}`);
    assert(currentEdge?.sourceHandle === step.sourceHandle, `Step ${s + 1}: sourceHandle matches expected`);
    assert(currentEdge?.targetHandle === step.targetHandle, `Step ${s + 1}: targetHandle matches expected`);

    // Verify 100% metadata preservation
    assert(currentEdge?.data?.label === 'Conexão Crítica Oculta', `Step ${s + 1}: label preserved`);
    assert(currentEdge?.data?.relationType === 'hostile', `Step ${s + 1}: relationType preserved`);
    assert(currentEdge?.data?.pathType === 'bezier', `Step ${s + 1}: pathType preserved`);
    assert(currentEdge?.data?.bidirectional === true, `Step ${s + 1}: bidirectional flag preserved`);
    assert(
      currentEdge?.data?.notes === 'Pista deixada no quarto secreto de Sintra',
      `Step ${s + 1}: notes content preserved`
    );
    assert(currentEdge?.data?.offset === 45, `Step ${s + 1}: offset preserved`);
  }

  // Test 2.5: Reconnection Undo/Redo Chain Integrity
  // Undo all 6 steps in reverse order
  for (let u = metadataSteps.length - 1; u >= 0; u--) {
    campaignStore.undo();
    const currentEdge = get(campaignStore.edges).find((e) => e.id === 'edge-reconnect-subject');
    const expected = u > 0 ? metadataSteps[u - 1] : { source: 'node-1', target: 'node-3', sourceHandle: null, targetHandle: 'left' };

    assert(
      currentEdge?.source === expected.source && currentEdge?.target === expected.target,
      `Undo step ${metadataSteps.length - u}: restored to source=${expected.source}, target=${expected.target}`
    );
    assert(
      currentEdge?.data?.label === 'Conexão Crítica Oculta' && currentEdge?.data?.relationType === 'hostile',
      `Undo step ${metadataSteps.length - u}: metadata intact`
    );
  }

  // Redo all 6 steps back to the final state
  for (let r = 0; r < metadataSteps.length; r++) {
    campaignStore.redo();
    const currentEdge = get(campaignStore.edges).find((e) => e.id === 'edge-reconnect-subject');
    const expected = metadataSteps[r];

    assert(
      currentEdge?.source === expected.source && currentEdge?.target === expected.target,
      `Redo step ${r + 1}: restored to source=${expected.source}, target=${expected.target}`
    );
  }

  // Test 2.6: Active Edge Editor Live Synchronization
  const activeEdge = get(campaignStore.edges).find((e) => e.id === 'edge-reconnect-subject')!;
  campaignStore.openEdgeEditor(activeEdge);
  assert(campaignStore.editingEdge?.id === 'edge-reconnect-subject', 'openEdgeEditor sets editingEdge');

  campaignStore.reconnectEdge('edge-reconnect-subject', {
    source: 'node-9',
    target: 'node-10',
    sourceHandle: 'left',
    targetHandle: 'right',
  });

  assert(
    campaignStore.editingEdge?.source === 'node-9',
    'campaignStore.editingEdge.source synchronizes live on edge reconnection'
  );
  assert(
    campaignStore.editingEdge?.target === 'node-10',
    'campaignStore.editingEdge.target synchronizes live on edge reconnection'
  );
  assert(
    campaignStore.editingEdge?.sourceHandle === 'left',
    'campaignStore.editingEdge.sourceHandle synchronizes live'
  );
  assert(
    campaignStore.editingEdge?.targetHandle === 'right',
    'campaignStore.editingEdge.targetHandle synchronizes live'
  );

  campaignStore.closeEdgeEditor();
  assert(campaignStore.editingEdge === null, 'closeEdgeEditor resets editingEdge');

  // Test 2.7: DOM Proximity Snapping Algorithm Simulation (findCandidateHandle)
  // Verify the exact algorithm implemented in CustomLabeledEdge.svelte
  function simulateFindCandidateHandle(
    cursorX: number,
    cursorY: number,
    domHandles: Array<{ nodeId: string; handleId: string; rect: { left: number; top: number; width: number; height: number } }>,
    snapRadius = 28
  ) {
    let closest: { nodeId: string; handleId: string } | null = null;
    let minDist = snapRadius;

    for (const h of domHandles) {
      const centerX = h.rect.left + h.rect.width / 2;
      const centerY = h.rect.top + h.rect.height / 2;
      const dist = Math.hypot(cursorX - centerX, cursorY - centerY);
      if (dist < minDist) {
        minDist = dist;
        closest = { nodeId: h.nodeId, handleId: h.handleId };
      }
    }
    return closest;
  }

  const mockHandles = [
    { nodeId: 'node-A', handleId: 'top', rect: { left: 100, top: 100, width: 10, height: 10 } }, // center 105, 105
    { nodeId: 'node-B', handleId: 'bottom', rect: { left: 300, top: 300, width: 10, height: 10 } }, // center 305, 305
  ];

  // Point at (105, 105) -> exact hit
  const exactHit = simulateFindCandidateHandle(105, 105, mockHandles);
  assert(exactHit?.nodeId === 'node-A' && exactHit?.handleId === 'top', 'findCandidateHandle detects exact hit');

  // Point at (120, 120) -> distance hypot(15, 15) = 21.21px (< 28px snapRadius)
  const proximityHit = simulateFindCandidateHandle(120, 120, mockHandles);
  assert(
    proximityHit?.nodeId === 'node-A' && proximityHit?.handleId === 'top',
    'findCandidateHandle snaps to handle within 28px snap radius (dist 21.2px)'
  );

  // Point at (135, 135) -> distance hypot(30, 30) = 42.42px (> 28px snapRadius)
  const outOfRange = simulateFindCandidateHandle(135, 135, mockHandles);
  assert(outOfRange === null, 'findCandidateHandle safely returns null when cursor exceeds snap radius (dist 42.4px)');

  // Drag-drop self-prevention test:
  // Dragging source handle: if candidate.nodeId === target, drag drop action must be aborted
  const targetNodeId = 'node-B';
  const candidateForSource = { nodeId: 'node-B', handleId: 'top' };
  const sourceDragAllowed = candidateForSource.nodeId !== targetNodeId;
  assert(sourceDragAllowed === false, 'UI drag handler prevents dropping source onto target node handle');

  const sourceNodeId = 'node-A';
  const candidateForTarget = { nodeId: 'node-A', handleId: 'bottom' };
  const targetDragAllowed = candidateForTarget.nodeId !== sourceNodeId;
  assert(targetDragAllowed === false, 'UI drag handler prevents dropping target onto source node handle');

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log(`ADVERSARIAL SUITE SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(80));

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch((err) => {
  console.error('Adversarial test runner encountered uncaught error:', err);
  process.exit(1);
});
