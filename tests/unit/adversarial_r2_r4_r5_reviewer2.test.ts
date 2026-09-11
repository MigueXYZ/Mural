// tests/unit/adversarial_r2_r4_r5_reviewer2.test.ts
// Independent Adversarial Stress Test Suite by Reviewer 2 (Milestone 2)

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

  console.log('=== Starting Reviewer 2 Adversarial Stress Tests (R2, R4, R5) ===\n');
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

  // ---------------------------------------------------------------------------
  // Adversarial Challenge 1: Multi-Connection Fan-Out, Fan-In and Handle Stress
  // ---------------------------------------------------------------------------
  console.log('[Challenge 1] Arbitrary Branching & Multi-Connection Scalability');

  storageMap.clear();
  campaignStore.loadCampaign({
    id: 'campaign-adv-r2',
    name: 'Campanha Adversarial R2',
    nodes: [
      { id: 'hub', position: { x: 200, y: 200 }, data: { label: 'Central Hub' } },
      ...Array.from({ length: 15 }, (_, i) => ({
        id: `spoke-${i}`,
        position: { x: 500, y: i * 50 },
        data: { label: `Spoke ${i}` },
      })),
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

  // Fan-out: 15 edges all originating from hub.right
  for (let i = 0; i < 15; i++) {
    campaignStore.addEdge({
      id: `edge-fanout-${i}`,
      source: 'hub',
      target: `spoke-${i}`,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'customLabeledEdge',
      data: { label: `Branch ${i}`, relationType: 'allied' },
    });
  }

  const fanoutEdges = get(campaignStore.edges);
  assert(fanoutEdges.length === 15, 'Successfully added 15 edges branching from single handle hub.right');
  const hubRightBranches = fanoutEdges.filter((e) => e.source === 'hub' && e.sourceHandle === 'right');
  assert(hubRightBranches.length === 15, 'All 15 edges correctly identify hub.right as sourceHandle');

  // Fan-in: 15 reverse edges converging into hub.right (same handle used as target in loose mode!)
  for (let i = 0; i < 15; i++) {
    campaignStore.addEdge({
      id: `edge-fanin-${i}`,
      source: `spoke-${i}`,
      target: 'hub',
      sourceHandle: 'left',
      targetHandle: 'right',
      type: 'customLabeledEdge',
      data: { label: `Converge ${i}`, relationType: 'hostile' },
    });
  }

  const totalEdges = get(campaignStore.edges);
  assert(totalEdges.length === 30, 'Total edges reached 30 without handle contention or dropouts');
  const hubRightTargets = totalEdges.filter((e) => e.target === 'hub' && e.targetHandle === 'right');
  assert(hubRightTargets.length === 15, 'Handle hub.right concurrently serves as target for 15 incoming edges');

  // Sync to master and scoping test
  campaignStore.syncCurrentNodesToMaster();
  assert(
    (campaignStore.campaign.edges || []).length === 30,
    'syncCurrentNodesToMaster kept all 30 dense multi-connections in campaign.edges'
  );

  const exported = campaignStore.exportCurrentCampaign();
  assert(exported.edges.length === 30, 'exportCurrentCampaign contains all 30 dense connections');

  // ---------------------------------------------------------------------------
  // Adversarial Challenge 2: Reconnection Robustness & Metadata Preservation
  // ---------------------------------------------------------------------------
  console.log('\n[Challenge 2] Reconnection Edge Cases & Preservation');

  const richEdge: CanvasRelationEdge = {
    id: 'edge-rich-1',
    source: 'spoke-0',
    target: 'spoke-1',
    sourceHandle: 'top',
    targetHandle: 'bottom',
    type: 'customLabeledEdge',
    data: {
      label: 'Conexão Secreta Detalhada',
      relationType: 'secret',
      pathType: 'bezier',
      bidirectional: true,
      notes: 'Notas confidenciais sobre a aliança oculta',
      color: '#a855f7',
      textColor: '#ec4899',
      icon: 'skull',
      offset: 35,
      curvature: 0.45,
    },
  };
  campaignStore.addEdge(richEdge);

  // Self loop rejection
  const rejectSelf = campaignStore.reconnectEdge('edge-rich-1', {
    source: 'spoke-0',
    target: 'spoke-0',
  });
  assert(rejectSelf === false, 'reconnectEdge rejected self-connection attempt');

  // Reconnection with missing endpoints
  const rejectEmpty = campaignStore.reconnectEdge('edge-rich-1', {
    source: '',
    target: 'spoke-1',
  });
  assert(rejectEmpty === false, 'reconnectEdge rejected empty source');

  // Valid reconnection to spoke-5 and spoke-6
  const reconnectOk = campaignStore.reconnectEdge('edge-rich-1', {
    source: 'spoke-5',
    target: 'spoke-6',
    sourceHandle: 'right',
    targetHandle: 'left',
  });
  assert(reconnectOk === true, 'reconnectEdge succeeded for new endpoints spoke-5 -> spoke-6');

  const updatedRich = get(campaignStore.edges).find((e) => e.id === 'edge-rich-1');
  assert(updatedRich?.source === 'spoke-5' && updatedRich?.target === 'spoke-6', 'Source and target correctly updated');
  assert(updatedRich?.sourceHandle === 'right' && updatedRich?.targetHandle === 'left', 'Handles correctly updated');
  assert(updatedRich?.data?.label === 'Conexão Secreta Detalhada', 'Label preserved verbatim');
  assert(updatedRich?.data?.relationType === 'secret', 'relationType preserved');
  assert(updatedRich?.data?.bidirectional === true, 'bidirectional preserved');
  assert(updatedRich?.data?.notes === 'Notas confidenciais sobre a aliança oculta', 'Notes preserved');
  assert(updatedRich?.data?.color === '#a855f7', 'Custom color preserved');
  assert(updatedRich?.data?.textColor === '#ec4899', 'textColor preserved');
  assert(updatedRich?.data?.icon === 'skull', 'Icon preserved');
  assert(updatedRich?.data?.offset === 35, 'Custom offset preserved');
  assert(updatedRich?.data?.curvature === 0.45, 'Curvature preserved');

  // Undo restores exact previous endpoints
  campaignStore.undo();
  const undoneRich = get(campaignStore.edges).find((e) => e.id === 'edge-rich-1');
  assert(
    undoneRich?.source === 'spoke-0' && undoneRich?.target === 'spoke-1',
    'Undo restored original source and target'
  );
  assert(
    undoneRich?.sourceHandle === 'top' && undoneRich?.targetHandle === 'bottom',
    'Undo restored original handles'
  );

  // Redo re-applies
  campaignStore.redo();
  const redoneRich = get(campaignStore.edges).find((e) => e.id === 'edge-rich-1');
  assert(
    redoneRich?.source === 'spoke-5' && redoneRich?.target === 'spoke-6',
    'Redo restored reconnected endpoints'
  );

  // ---------------------------------------------------------------------------
  // Adversarial Challenge 3: Copy & Paste Cascade, Isolation, & Focus Guards
  // ---------------------------------------------------------------------------
  console.log('\n[Challenge 3] Copy & Paste Isolation and Cascading Offsets');

  // Test isInput logic contract
  function isInputElement(tag: string, isContentEditable: boolean): boolean {
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || isContentEditable;
    return isInput;
  }
  assert(isInputElement('INPUT', false) === true, 'isInput correctly identifies INPUT');
  assert(isInputElement('TEXTAREA', false) === true, 'isInput correctly identifies TEXTAREA');
  assert(isInputElement('DIV', true) === true, 'isInput correctly identifies contenteditable DIV');
  assert(isInputElement('SPAN', true) === true, 'isInput correctly identifies contenteditable child');
  assert(isInputElement('DIV', false) === false, 'isInput permits canvas shortcuts on normal DIV');
  assert(isInputElement('BUTTON', false) === false, 'isInput permits canvas shortcuts on toolbar buttons');

  // Select edge-rich-1 for copy
  campaignStore.edges.update((list) =>
    list.map((e) => ({ ...e, selected: e.id === 'edge-rich-1' }))
  );
  const copiedCount = campaignStore.copyEdges();
  assert(copiedCount === 1, 'copyEdges successfully cloned selected rich edge');

  // Mutate source edge in store to verify clipboard deep clone immunity
  campaignStore.edges.update((list) =>
    list.map((e) =>
      e.id === 'edge-rich-1'
        ? { ...e, data: { ...(e.data || {}), label: 'MUTATED' } }
        : e
    )
  );

  // Paste 1: offset was 35, should increment by 20 -> 55
  const paste1 = campaignStore.pasteEdges(20);
  assert(paste1.length === 1, 'pasteEdges created 1 cloned edge');
  assert(paste1[0].data?.label === 'Conexão Secreta Detalhada', 'Clipboard was immune to source edge mutation');
  assert(paste1[0].data?.offset === 55, 'paste 1 incremented offset from 35 to 55');
  assert(paste1[0].selected === true, 'Pasted edge is selected');

  // Verify original edge is deselected
  const origAfterPaste = get(campaignStore.edges).find((e) => e.id === 'edge-rich-1');
  assert(origAfterPaste?.selected === false, 'Original edge was cleanly deselected');

  // Paste 2: should increment to 75
  const paste2 = campaignStore.pasteEdges(20);
  assert(paste2[0].data?.offset === 75, 'paste 2 incremented offset to 75');
  // paste1 should now be deselected
  const p1AfterP2 = get(campaignStore.edges).find((e) => e.id === paste1[0].id);
  assert(p1AfterP2?.selected === false, 'First pasted edge deselected when second paste performed');

  // Paste 3: should increment to 95
  const paste3 = campaignStore.pasteEdges(20);
  assert(paste3[0].data?.offset === 95, 'paste 3 incremented offset to 95');

  // Check unique IDs
  const pastedIds = new Set([paste1[0].id, paste2[0].id, paste3[0].id]);
  assert(pastedIds.size === 3, 'All 3 pasted duplicates have mutually distinct unique IDs');

  // Bi-store synchronization check
  const campaignEdgeIds = new Set((campaignStore.campaign.edges || []).map((e) => e.id));
  assert(
    campaignEdgeIds.has(paste1[0].id) && campaignEdgeIds.has(paste2[0].id) && campaignEdgeIds.has(paste3[0].id),
    'All 3 pasted duplicates present in campaignStore.campaign.edges'
  );

  // ---------------------------------------------------------------------------
  // Adversarial Challenge 4: Node Deletion Edge Cascade in Both Stores
  // ---------------------------------------------------------------------------
  console.log('\n[Challenge 4] Node Deletion Cascading Edge Pruning');

  const preDeleteEdgeCount = get(campaignStore.edges).length;
  // Delete spoke-6 which is connected to edge-rich-1, paste1, paste2, paste3!
  campaignStore.deleteNode('spoke-6');

  const postDeleteEdges = get(campaignStore.edges);
  const remainingConnected = postDeleteEdges.filter(
    (e) => e.source === 'spoke-6' || e.target === 'spoke-6'
  );
  assert(remainingConnected.length === 0, 'No edges referencing deleted node spoke-6 remain in edges store');

  const postDeleteMasterEdges = campaignStore.campaign.edges || [];
  const remainingMasterConnected = postDeleteMasterEdges.filter(
    (e) => e.source === 'spoke-6' || e.target === 'spoke-6'
  );
  assert(
    remainingMasterConnected.length === 0,
    'No edges referencing deleted node spoke-6 remain in campaign.edges master store'
  );

  console.log('\n' + '='.repeat(65));
  console.log(`REVIEWER 2 ADVERSARIAL SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(65));

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
