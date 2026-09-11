// tests/unit/tier12_connections_reconnect_copy.test.ts
// Unit & Integration Test Suite for Milestone 2: Interactive Connections & Edge Subsystem (R2, R4, R5)

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

async function runTests() {
  const { campaignStore } = await import('../../src/lib/stores/campaignStore.svelte');

  console.log('=== Starting Milestone 2: Connections, Reconnect & Copy/Paste Tests ===\n');
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
  // Suite 1: Requirement R2 — Múltiplas Conexões por Ponto de Ancoragem
  // -------------------------------------------------------------------------
  console.log('[Suite 1] Requirement R2: Multiple Connections per Anchor Handle');

  // Reset store to a clean state
  storageMap.clear();
  campaignStore.loadCampaign({
    id: 'campaign-test-r2',
    name: 'Campanha de Teste R2',
    nodes: [
      { id: 'node-A', position: { x: 100, y: 100 }, data: { label: 'Card A' } },
      { id: 'node-B', position: { x: 300, y: 100 }, data: { label: 'Card B' } },
      { id: 'node-C', position: { x: 500, y: 100 }, data: { label: 'Card C' } },
      { id: 'node-D', position: { x: 300, y: 300 }, data: { label: 'Card D' } },
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

  // Edge 1: Card A (right) -> Card B (left)
  const edge1: CanvasRelationEdge = {
    id: 'edge-A-B-1',
    source: 'node-A',
    target: 'node-B',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'customLabeledEdge',
    data: {
      label: 'ligação 1',
      relationType: 'allied',
      pathType: 'smoothstep',
    },
  };
  campaignStore.addEdge(edge1);

  assert(get(campaignStore.edges).length === 1, 'First edge added to campaignStore.edges');
  assert((campaignStore.campaign.edges || []).length === 1, 'First edge synced to campaignStore.campaign.edges');

  // Edge 2: Card A (right) -> Card C (top) — Same sourceHandle 'right' on Card A!
  const edge2: CanvasRelationEdge = {
    id: 'edge-A-C-2',
    source: 'node-A',
    target: 'node-C',
    sourceHandle: 'right', // Branching from same handle
    targetHandle: 'top',
    type: 'customLabeledEdge',
    data: {
      label: 'ligação 2 (ramificada)',
      relationType: 'hostile',
      pathType: 'smoothstep',
    },
  };
  campaignStore.addEdge(edge2);

  const edgesAfterBranch = get(campaignStore.edges);
  assert(edgesAfterBranch.length === 2, 'Second edge branching from same handle added without dropping first');
  const cardABranches = edgesAfterBranch.filter(
    (e) => e.source === 'node-A' && e.sourceHandle === 'right'
  );
  assert(cardABranches.length === 2, 'Card A handle "right" has 2 active branching connections');

  // Edge 3: Card D (top) -> Card B (left) — Converging into same targetHandle 'left' on Card B!
  const edge3: CanvasRelationEdge = {
    id: 'edge-D-B-3',
    source: 'node-D',
    target: 'node-B',
    sourceHandle: 'top',
    targetHandle: 'left', // Converging on same handle
    type: 'customLabeledEdge',
    data: {
      label: 'ligação 3 (convergente)',
      relationType: 'neutral',
      pathType: 'smoothstep',
    },
  };
  campaignStore.addEdge(edge3);

  const edgesAfterConvergence = get(campaignStore.edges);
  assert(edgesAfterConvergence.length === 3, 'Third converging edge added successfully');
  const cardBInputs = edgesAfterConvergence.filter(
    (e) => e.target === 'node-B' && e.targetHandle === 'left'
  );
  assert(cardBInputs.length === 2, 'Card B handle "left" receives 2 simultaneous incoming connections');

  // Verify syncCurrentNodesToMaster preserves all multi-connections
  campaignStore.syncCurrentNodesToMaster();
  assert(
    (campaignStore.campaign.edges || []).length === 3,
    'syncCurrentNodesToMaster preserves all 3 multi-connections without dropping any'
  );

  // Verify exportCurrentCampaign preserves multi-connections
  const exported = campaignStore.exportCurrentCampaign();
  assert(
    exported.edges.length === 3,
    'exportCurrentCampaign includes all 3 multi-connections with handles intact'
  );
  assert(
    exported.edges.some((e: any) => e.id === 'edge-A-B-1') &&
      exported.edges.some((e: any) => e.id === 'edge-A-C-2') &&
      exported.edges.some((e: any) => e.id === 'edge-D-B-3'),
    'Exported payload contains exact multi-connection IDs'
  );

  // -------------------------------------------------------------------------
  // Suite 2: Requirement R4 — Reconexão Interativa de Linhas
  // -------------------------------------------------------------------------
  console.log('\n[Suite 2] Requirement R4: Interactive Edge Reconnection');

  // Reconnect target of edge-A-C-2 from node-C (top) to node-D (bottom)
  const reconnectSuccess1 = campaignStore.reconnectEdge('edge-A-C-2', {
    source: 'node-A',
    target: 'node-D',
    sourceHandle: 'right',
    targetHandle: 'bottom',
  });
  assert(reconnectSuccess1 === true, 'reconnectEdge returns true on successful reconnection');

  const reconnectedEdge1 = get(campaignStore.edges).find((e) => e.id === 'edge-A-C-2');
  assert(reconnectedEdge1?.target === 'node-D', 'Edge target updated to node-D in edges store');
  assert(reconnectedEdge1?.targetHandle === 'bottom', 'Edge targetHandle updated to "bottom"');

  const masterEdge1 = (campaignStore.campaign.edges || []).find((e) => e.id === 'edge-A-C-2');
  assert(masterEdge1?.target === 'node-D', 'Edge target updated in campaign.edges');
  assert(masterEdge1?.targetHandle === 'bottom', 'Edge targetHandle updated in campaign.edges');
  assert(
    masterEdge1?.data?.label === 'ligação 2 (ramificada)',
    'Edge metadata (label, relationType) preserved across reconnection'
  );

  // Reconnect source of edge-D-B-3 from node-D to node-C (left)
  const reconnectSuccess2 = campaignStore.reconnectEdge('edge-D-B-3', {
    source: 'node-C',
    target: 'node-B',
    sourceHandle: 'left',
    targetHandle: 'left',
  });
  assert(reconnectSuccess2 === true, 'reconnectEdge returns true when updating source endpoint');
  const reconnectedEdge2 = get(campaignStore.edges).find((e) => e.id === 'edge-D-B-3');
  assert(reconnectedEdge2?.source === 'node-C', 'Edge source updated to node-C');
  assert(reconnectedEdge2?.sourceHandle === 'left', 'Edge sourceHandle updated to "left"');

  // Self-connection rejection: cannot connect card to itself
  const selfConnectAttempt = campaignStore.reconnectEdge('edge-A-B-1', {
    source: 'node-A',
    target: 'node-A',
  });
  assert(selfConnectAttempt === false, 'reconnectEdge rejects self-connection (source === target)');
  const uncorruptedEdge = get(campaignStore.edges).find((e) => e.id === 'edge-A-B-1');
  assert(uncorruptedEdge?.target === 'node-B', 'Edge remains connected to original target on rejected reconnection');

  // Non-existent edge rejection
  const nonExistentReconnect = campaignStore.reconnectEdge('edge-ghost-999', {
    source: 'node-A',
    target: 'node-B',
  });
  assert(nonExistentReconnect === false, 'reconnectEdge returns false for non-existent edge');

  // Reconnection modal synchronization
  campaignStore.openEdgeEditor(reconnectedEdge1!);
  assert(campaignStore.editingEdge?.id === 'edge-A-C-2', 'openEdgeEditor sets editingEdge');

  campaignStore.reconnectEdge('edge-A-C-2', {
    source: 'node-A',
    target: 'node-B',
    sourceHandle: 'top',
    targetHandle: 'top',
  });
  assert(campaignStore.editingEdge?.target === 'node-B', 'editingEdge synchronizes live when active edge is reconnected');
  assert(campaignStore.editingEdge?.targetHandle === 'top', 'editingEdge targetHandle updated');
  campaignStore.closeEdgeEditor();

  // Undo & Redo for reconnection
  assert(campaignStore.undoStack.length > 0, 'Undo stack populated after reconnection operations');
  campaignStore.undo(); // Undo last reconnection
  const edgeAfterUndo = get(campaignStore.edges).find((e) => e.id === 'edge-A-C-2');
  assert(edgeAfterUndo?.target === 'node-D', 'Undo restores edge target to previous connection endpoint (node-D)');

  campaignStore.redo(); // Redo reconnection
  const edgeAfterRedo = get(campaignStore.edges).find((e) => e.id === 'edge-A-C-2');
  assert(edgeAfterRedo?.target === 'node-B', 'Redo re-applies reconnected endpoint (node-B)');

  // -------------------------------------------------------------------------
  // Suite 3: Requirement R5 — Copiar e Colar Linhas (Ctrl+C & Ctrl+V)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 3] Requirement R5: Copy & Paste Connections with Routing Offset');

  // Deselect all edges first
  campaignStore.edges.update((list) => list.map((e) => ({ ...e, selected: false })));
  assert(campaignStore.hasCopiedEdges() === false, 'Clipboard starts empty');

  // Try copying when no edges selected
  const copiedCountZero = campaignStore.copyEdges();
  assert(copiedCountZero === 0, 'copyEdges returns 0 when no edges are selected');
  assert(campaignStore.hasCopiedEdges() === false, 'hasCopiedEdges remains false');

  // Select edge-A-B-1 and copy
  campaignStore.edges.update((list) =>
    list.map((e) => (e.id === 'edge-A-B-1' ? { ...e, selected: true } : e))
  );
  const copiedCount = campaignStore.copyEdges();
  assert(copiedCount === 1, 'copyEdges returns 1 for single selected edge');
  assert(campaignStore.hasCopiedEdges() === true, 'hasCopiedEdges returns true after copy');

  // Paste edge
  const initialEdgeCount = get(campaignStore.edges).length;
  const pastedList1 = campaignStore.pasteEdges();
  assert(pastedList1.length === 1, 'pasteEdges duplicates copied edge');

  const pastedEdge1 = pastedList1[0];
  assert(pastedEdge1.id !== 'edge-A-B-1', 'Pasted edge receives a brand new unique ID');
  assert(pastedEdge1.source === 'node-A', 'Pasted edge preserves source node');
  assert(pastedEdge1.target === 'node-B', 'Pasted edge preserves target node');
  assert(pastedEdge1.sourceHandle === 'right', 'Pasted edge preserves sourceHandle');
  assert(pastedEdge1.targetHandle === 'left', 'Pasted edge preserves targetHandle');
  assert(pastedEdge1.data?.label === 'ligação 1', 'Pasted edge preserves relationship label');
  assert(pastedEdge1.data?.relationType === 'allied', 'Pasted edge preserves relationType');
  assert(pastedEdge1.selected === true, 'Newly pasted edge is selected');

  // Routing offset verification (R5)
  assert(typeof pastedEdge1.data?.offset === 'number', 'Pasted edge has numerical routing offset');
  assert((pastedEdge1.data?.offset as number) >= 38, 'Routing offset incremented from default to avoid visual collision');

  // Check store contents
  assert(get(campaignStore.edges).length === initialEdgeCount + 1, 'Edges store length incremented by 1');
  assert(
    (campaignStore.campaign.edges || []).some((e) => e.id === pastedEdge1.id),
    'Pasted edge synchronized immediately to campaign.edges'
  );

  // Original edge should now be deselected
  const origEdgeAfterPaste = get(campaignStore.edges).find((e) => e.id === 'edge-A-B-1');
  assert(origEdgeAfterPaste?.selected === false, 'Original edge deselected upon paste');

  // Consecutive paste increments offset even further
  const pastedList2 = campaignStore.pasteEdges();
  assert(pastedList2.length === 1, 'Second paste operation succeeds');
  const pastedEdge2 = pastedList2[0];
  assert(
    (pastedEdge2.data?.offset as number) > (pastedEdge1.data?.offset as number),
    'Second pasted edge offset is greater than first pasted edge offset (parallel cascade)'
  );

  // Multi-edge copy & paste
  campaignStore.edges.update((list) =>
    list.map((e) => ({ ...e, selected: e.id === 'edge-A-B-1' || e.id === 'edge-A-C-2' }))
  );
  const multiCopyCount = campaignStore.copyEdges();
  assert(multiCopyCount === 2, 'copyEdges copies multiple selected edges at once');

  const preMultiPasteCount = get(campaignStore.edges).length;
  const multiPastedList = campaignStore.pasteEdges();
  assert(multiPastedList.length === 2, 'pasteEdges duplicates all selected edges in clipboard');
  assert(get(campaignStore.edges).length === preMultiPasteCount + 2, 'Both duplicated edges added to store');

  // Undo & Redo for pasteEdges
  campaignStore.undo(); // Undo multi-paste
  assert(
    get(campaignStore.edges).length === preMultiPasteCount,
    'Undo pasteEdges cleanly removes the pasted duplicates'
  );
  campaignStore.redo(); // Redo multi-paste
  assert(
    get(campaignStore.edges).length === preMultiPasteCount + 2,
    'Redo pasteEdges cleanly re-inserts the pasted duplicates'
  );

  // -------------------------------------------------------------------------
  // Suite 4: Edge Deletion and Bi-Store Pruning
  // -------------------------------------------------------------------------
  console.log('\n[Suite 4] Edge Deletion & Store Pruning');

  const edgeToDeleteId = pastedEdge1.id;
  campaignStore.deleteEdge(edgeToDeleteId);

  assert(
    get(campaignStore.edges).some((e) => e.id === edgeToDeleteId) === false,
    'deleteEdge removes edge from campaignStore.edges'
  );
  assert(
    (campaignStore.campaign.edges || []).some((e) => e.id === edgeToDeleteId) === false,
    'deleteEdge removes edge from campaignStore.campaign.edges'
  );

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`TIER 12 TEST SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner encountered uncaught error:', err);
  process.exit(1);
});
