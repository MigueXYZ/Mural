// tests/unit/empirical_challenge_r3_color_sync.test.ts
// Empirical Adversarial Challenge Test Harness for Milestone 1 Requirement R3: Text Color Synchronization

// Mock localStorage and Svelte 5 runes for headless Node test execution
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
  (globalThis as any).$derived.by = (fn: any) => typeof fn === 'function' ? fn() : fn;
  (globalThis as any).$effect = (fn: any) => {};
}

import { get } from 'svelte/store';
import type { EntityNodeData, CanvasRelationEdgeData, RelationType } from '../../src/lib/types';

async function runEmpiricalChallengeR3() {
  const { campaignStore } = await import('../../src/lib/stores/campaignStore.svelte');
  const { recentColors } = await import('../../src/lib/stores/recentColorsStore.svelte');

  console.log('======================================================================');
  console.log('  EMPIRICAL CHALLENGE HARNESS: Requirement R3 (Text Color Sync)');
  console.log('======================================================================\n');

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

  // -------------------------------------------------------------------------
  // Helper to re-initialize campaignStore to a clean state
  // -------------------------------------------------------------------------
  function setupFreshCampaign() {
    storageMap.clear();
    (campaignStore as any).undoStack = [];
    (campaignStore as any).redoStack = [];

    campaignStore.loadCampaign({
      id: 'empirical-campaign-r3',
      title: 'R3 Adversarial Campaign',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: 'node-alpha',
          type: 'entityNode',
          position: { x: 100, y: 100 },
          data: {
            id: 'node-alpha',
            type: 'npc',
            title: 'Agent Alpha',
            subtitle: 'INVESTIGATOR',
            description: 'Lead operative',
            color: '#d4a359',
            colorTheme: '#d4a359',
            textColor: '#10b981', // initially explicitly set
          },
        },
        {
          id: 'node-beta',
          type: 'entityNode',
          position: { x: 400, y: 100 },
          data: {
            id: 'node-beta',
            type: 'faction',
            title: 'Syndicate Beta',
            subtitle: 'FACTION',
            description: 'Shadow organization',
            color: '#a855f7',
            colorTheme: '#a855f7',
            // initially NO textColor (undefined)
          },
        },
      ],
      edges: [
        {
          id: 'edge-ab',
          source: 'node-alpha',
          target: 'node-beta',
          type: 'customLabeledEdge',
          data: {
            label: 'infiltrates',
            relationType: 'secret',
            textColor: '#f43f5e', // initially explicitly set
          },
        },
        {
          id: 'edge-ba',
          source: 'node-beta',
          target: 'node-alpha',
          type: 'customLabeledEdge',
          data: {
            label: 'hunts',
            relationType: 'hostile',
            // initially NO textColor (undefined)
          },
        },
        {
          id: 'edge-custom',
          source: 'node-alpha',
          target: 'node-beta',
          type: 'customLabeledEdge',
          data: {
            label: 'pact',
            relationType: 'custom',
            color: '#06b6d4',
            // initially NO textColor (undefined, should fallback to color)
          },
        },
      ],
    } as any);
  }

  // -------------------------------------------------------------------------
  // SUITE 1: Setting textColor on EntityNodeData updates node data reactively
  // -------------------------------------------------------------------------
  console.log('--- SUITE 1: EntityNodeData Reactive textColor Updates ---');
  setupFreshCampaign();

  // Test 1.1: Live update textColor on node-alpha
  campaignStore.updateNodeDataLive('node-alpha', { textColor: '#f97316' });
  const liveNodes1 = get(campaignStore.nodes);
  const nodeAlpha1 = liveNodes1.find((n) => n.id === 'node-alpha');
  const masterAlpha1 = (campaignStore.campaign.nodes || []).find((n) => n.id === 'node-alpha');

  assert(
    nodeAlpha1?.data.textColor === '#f97316',
    'updateNodeDataLive immediately updates textColor in writable $nodes store'
  );
  assert(
    masterAlpha1?.data.textColor === '#f97316',
    'updateNodeDataLive immediately syncs master campaign.nodes representation'
  );

  // Test 1.2: Simultaneous textColor and color/colorTheme update
  campaignStore.updateNodeDataLive('node-alpha', {
    color: '#3b82f6',
    colorTheme: '#3b82f6',
    textColor: '#ffffff',
  });
  const liveNodes2 = get(campaignStore.nodes);
  const nodeAlpha2 = liveNodes2.find((n) => n.id === 'node-alpha');
  assert(
    nodeAlpha2?.data.textColor === '#ffffff' &&
    nodeAlpha2?.data.color === '#3b82f6' &&
    nodeAlpha2?.data.colorTheme === '#3b82f6',
    'Simultaneous update of color, colorTheme, and textColor preserves all fields'
  );

  // Test 1.3: Resetting textColor to undefined
  campaignStore.updateNodeDataLive('node-alpha', { textColor: undefined });
  const liveNodes3 = get(campaignStore.nodes);
  const nodeAlpha3 = liveNodes3.find((n) => n.id === 'node-alpha');
  assert(
    nodeAlpha3?.data.textColor === undefined,
    'Setting textColor: undefined reactively removes/clears custom text color'
  );

  // Test 1.4: Derivation logic stress test (replicating EntityNode.svelte logic)
  // In EntityNode.svelte:
  // const activeColor = $derived(data?.color || data?.colorTheme || typeConfig.defaultColor);
  // const activeTextColor = $derived(data?.textColor || activeColor);
  // titleStyle = data?.textColor ? `color: ${data.textColor};` : ''
  // hasTextZinc100 = !data?.textColor
  function deriveEntityNodeStyles(data: EntityNodeData | undefined, defaultColor = '#d4a359') {
    const activeColor = data?.color || data?.colorTheme || defaultColor;
    const activeTextColor = data?.textColor || activeColor;
    const titleStyle = data?.textColor ? `color: ${data.textColor};` : '';
    const hasDefaultZincClass = !data?.textColor;
    return { activeColor, activeTextColor, titleStyle, hasDefaultZincClass };
  }

  const stylesExplicit = deriveEntityNodeStyles({
    id: 'test',
    type: 'npc',
    color: '#d4a359',
    textColor: '#ef4444',
  });
  assert(
    stylesExplicit.activeTextColor === '#ef4444' &&
    stylesExplicit.titleStyle === 'color: #ef4444;' &&
    stylesExplicit.hasDefaultZincClass === false,
    'EntityNode derivation with explicit textColor applies inline color and removes text-zinc-100'
  );

  const stylesFallback = deriveEntityNodeStyles({
    id: 'test',
    type: 'npc',
    color: '#a855f7',
    textColor: undefined,
  });
  assert(
    stylesFallback.activeTextColor === '#a855f7' &&
    stylesFallback.titleStyle === '' &&
    stylesFallback.hasDefaultZincClass === true,
    'EntityNode derivation with undefined textColor falls back to activeColor and keeps text-zinc-100'
  );

  const stylesEmpty = deriveEntityNodeStyles({
    id: 'test',
    type: 'npc',
    color: '#38bdf8',
    textColor: '',
  });
  assert(
    stylesEmpty.activeTextColor === '#38bdf8' &&
    stylesEmpty.titleStyle === '' &&
    stylesEmpty.hasDefaultZincClass === true,
    'EntityNode derivation with empty string textColor safely falls back to activeColor'
  );

  // Test 1.5: Non-existent node ID handling (does not crash or corrupt store)
  try {
    campaignStore.updateNodeDataLive('non-existent-node', { textColor: '#9333ea' });
    assert(true, 'updateNodeDataLive with non-existent ID gracefully does nothing without throwing');
  } catch (err: any) {
    assert(false, 'updateNodeDataLive with non-existent ID threw error', err.message);
  }

  // -------------------------------------------------------------------------
  // SUITE 2: Setting textColor on CanvasRelationEdgeData updates edge data reactively
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 2: CanvasRelationEdgeData Reactive textColor Updates ---');
  setupFreshCampaign();

  // Test 2.1: Live update textColor on edge-ba (initially undefined)
  campaignStore.updateEdgeDataLive('edge-ba', { textColor: '#84cc16' });
  const liveEdges1 = get(campaignStore.edges);
  const edgeBa1 = liveEdges1.find((e) => e.id === 'edge-ba');
  const masterBa1 = (campaignStore.campaign.edges || []).find((e) => e.id === 'edge-ba');

  assert(
    edgeBa1?.data?.textColor === '#84cc16',
    'updateEdgeDataLive updates edge textColor in writable $edges store'
  );
  assert(
    masterBa1?.data?.textColor === '#84cc16',
    'updateEdgeDataLive updates edge textColor in master campaign.edges'
  );

  // Test 2.2: Reset edge textColor to undefined
  campaignStore.updateEdgeDataLive('edge-ba', { textColor: undefined });
  const liveEdges2 = get(campaignStore.edges);
  const edgeBa2 = liveEdges2.find((e) => e.id === 'edge-ba');
  assert(
    edgeBa2?.data?.textColor === undefined,
    'updateEdgeDataLive setting textColor: undefined removes edge text color'
  );

  // Test 2.3: Edge derivation logic stress test (replicating CustomLabeledEdge.svelte logic)
  // In CustomLabeledEdge.svelte:
  // const explicitTextColor = $derived(
  //   (data?.textColor as string) ||
  //     (relationType === 'custom' && data?.color ? (data.color as string) : undefined)
  // );
  function deriveEdgeTextColor(data: CanvasRelationEdgeData | undefined, relationType: RelationType) {
    const explicitTextColor =
      (data?.textColor as string) ||
      (relationType === 'custom' && data?.color ? (data.color as string) : undefined);
    return explicitTextColor;
  }

  // Standard relation with explicit textColor
  const edgeStandardExplicit = deriveEdgeTextColor({ textColor: '#e11d48' }, 'allied');
  assert(
    edgeStandardExplicit === '#e11d48',
    'CustomLabeledEdge derivation with explicit textColor returns the custom color on standard relation'
  );

  // Standard relation without explicit textColor
  const edgeStandardUndefined = deriveEdgeTextColor({ textColor: undefined }, 'allied');
  assert(
    edgeStandardUndefined === undefined,
    'CustomLabeledEdge derivation on standard relation without textColor yields undefined (uses category CSS)'
  );

  // Custom relation without explicit textColor falls back to data.color
  const edgeCustomFallback = deriveEdgeTextColor({ color: '#14b8a6', textColor: undefined }, 'custom');
  assert(
    edgeCustomFallback === '#14b8a6',
    'CustomLabeledEdge on custom relation falls back to edge color when textColor is undefined'
  );

  // Custom relation with explicit textColor overrides data.color
  const edgeCustomOverride = deriveEdgeTextColor({ color: '#14b8a6', textColor: '#facc15' }, 'custom');
  assert(
    edgeCustomOverride === '#facc15',
    'CustomLabeledEdge on custom relation prefers explicit textColor over edge path color'
  );

  // Test 2.4: Edge with originally undefined data object
  campaignStore.loadCampaign({
    id: 'edge-test',
    nodes: [],
    edges: [
      {
        id: 'bare-edge',
        source: 'a',
        target: 'b',
        type: 'customLabeledEdge',
        // data completely omitted
      },
    ],
  } as any);

  try {
    campaignStore.updateEdgeDataLive('bare-edge', { textColor: '#38bdf8' });
    const bareEdge = get(campaignStore.edges).find((e) => e.id === 'bare-edge');
    assert(
      bareEdge?.data?.textColor === '#38bdf8' && bareEdge?.data?.relationType === 'neutral',
      'updateEdgeDataLive safely handles edge with originally undefined data'
    );
  } catch (err: any) {
    assert(false, 'updateEdgeDataLive threw on edge with undefined data', err.message);
  }

  // Test 2.5: Non-existent edge ID handling
  try {
    campaignStore.updateEdgeDataLive('non-existent-edge', { textColor: '#9333ea' });
    assert(true, 'updateEdgeDataLive with non-existent ID gracefully does nothing without throwing');
  } catch (err: any) {
    assert(false, 'updateEdgeDataLive with non-existent ID threw error', err.message);
  }

  // -------------------------------------------------------------------------
  // SUITE 3: updateNodeDataLive and updateEdgeDataLive DO NOT push undo entries
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Undo History Isolation During Live Updates ---');
  setupFreshCampaign();

  const initialUndoCount = (campaignStore as any).undoStack.length;
  assert(initialUndoCount === 0, 'Initial undo stack is 0');

  // Stress Test: Simulate continuous rapid dragging of the color picker slider (500 events)
  const DRAG_EVENTS_COUNT = 500;
  for (let i = 0; i < DRAG_EVENTS_COUNT; i++) {
    const hex = `#${(i % 255).toString(16).padStart(2, '0')}88ff`;
    campaignStore.updateNodeDataLive('node-alpha', { textColor: hex });
  }

  const undoCountAfterNodeDrag = (campaignStore as any).undoStack.length;
  const currentNodeAlpha = get(campaignStore.nodes).find((n) => n.id === 'node-alpha');
  assert(
    undoCountAfterNodeDrag === 0,
    `500 rapid updateNodeDataLive calls produced ZERO undo snapshots (stack size: ${undoCountAfterNodeDrag})`
  );
  assert(
    currentNodeAlpha?.data.textColor !== undefined,
    'Node data successfully updated to the final live drag color'
  );

  // Stress Test: 500 rapid live updates on edge
  for (let i = 0; i < DRAG_EVENTS_COUNT; i++) {
    const hex = `#ff${(i % 255).toString(16).padStart(2, '0')}44`;
    campaignStore.updateEdgeDataLive('edge-ab', { textColor: hex });
  }
  const undoCountAfterEdgeDrag = (campaignStore as any).undoStack.length;
  assert(
    undoCountAfterEdgeDrag === 0,
    `500 rapid updateEdgeDataLive calls produced ZERO undo snapshots (stack size: ${undoCountAfterEdgeDrag})`
  );

  // Test 3.2: Redo stack integrity preservation during live updates
  // Create an undoable action first
  campaignStore.addEntityNode({ title: 'Undo Test Entity' }, 10, 10);
  assert((campaignStore as any).undoStack.length === 1, 'addEntityNode created 1 undo snapshot');

  // Undo it so redoStack has 1 entry
  campaignStore.undo();
  assert((campaignStore as any).undoStack.length === 0, 'Undo popped undo snapshot');
  assert((campaignStore as any).redoStack.length === 1, 'redoStack has 1 snapshot waiting');

  // Now execute 50 live color updates
  for (let i = 0; i < 50; i++) {
    campaignStore.updateNodeDataLive('node-alpha', { textColor: `#1122${(i % 99).toString().padStart(2, '0')}` });
  }

  assert(
    (campaignStore as any).undoStack.length === 0,
    'Live updates did not touch undoStack'
  );
  assert(
    (campaignStore as any).redoStack.length === 1,
    'Live updates DID NOT invalidate or clear the existing redoStack'
  );

  // Redo can still be cleanly executed
  campaignStore.redo();
  const redoneNode = get(campaignStore.nodes).find((n) => n.data.title === 'Undo Test Entity');
  assert(redoneNode !== undefined, 'Redo successfully restored entity after intervening live color updates');

  // Clean up test node
  campaignStore.deleteNode(redoneNode!.id);

  // Test 3.3: Commit after live update records exactly ONE undo snapshot
  setupFreshCampaign();
  const preCommitUndo = (campaignStore as any).undoStack.length;

  // 10 live updates
  for (let i = 0; i < 10; i++) {
    campaignStore.updateNodeDataLive('node-alpha', { textColor: `#00${i}000` });
  }
  assert((campaignStore as any).undoStack.length === preCommitUndo, 'Undo stack clean after 10 live updates');

  // Final commit via regular updateNodeData
  const COMMITTED_COLOR = '#4ade80';
  campaignStore.updateNodeData('node-alpha', { textColor: COMMITTED_COLOR });

  assert(
    (campaignStore as any).undoStack.length === preCommitUndo + 1,
    'Committing via updateNodeData records exactly ONE snapshot in undoStack'
  );

  // Test 3.4: Undoing the commit reverts the textColor to the pre-modal state
  campaignStore.undo();
  const revertedNode = get(campaignStore.nodes).find((n) => n.id === 'node-alpha');
  assert(
    revertedNode?.data.textColor === '#10b981',
    'Calling campaignStore.undo() reverts node textColor to original pre-modal value (#10b981)',
    `Expected #10b981, but got ${revertedNode?.data.textColor}`
  );

  // Test 3.5: Redoing re-applies the committed textColor
  campaignStore.redo();
  const reAppliedNode = get(campaignStore.nodes).find((n) => n.id === 'node-alpha');
  assert(
    reAppliedNode?.data.textColor === COMMITTED_COLOR,
    'Calling campaignStore.redo() re-applies committed textColor (#4ade80)'
  );

  // Test 3.6: Edge commit and undo test after live updates
  setupFreshCampaign();
  const preEdgeCommitUndo = (campaignStore as any).undoStack.length;
  // Edge initially has textColor: '#f43f5e'
  for (let i = 0; i < 5; i++) {
    campaignStore.updateEdgeDataLive('edge-ab', { textColor: `#1234${i}0` });
  }
  const EDGE_COMMITTED_COLOR = '#06b6d4';
  campaignStore.updateEdgeData('edge-ab', { textColor: EDGE_COMMITTED_COLOR });
  assert(
    (campaignStore as any).undoStack.length === preEdgeCommitUndo + 1,
    'updateEdgeData records exactly ONE snapshot in undoStack'
  );
  campaignStore.undo();
  const revertedEdge = get(campaignStore.edges).find((e) => e.id === 'edge-ab');
  assert(
    revertedEdge?.data?.textColor === '#f43f5e',
    'Calling campaignStore.undo() reverts edge textColor to original pre-modal value (#f43f5e)',
    `Expected #f43f5e, but got ${revertedEdge?.data?.textColor}`
  );

  // -------------------------------------------------------------------------
  // SUITE 4: Color rollback on modal cancellation works as expected
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Color Rollback on Modal Cancellation ---');
  setupFreshCampaign();

  // Test 4.1: Entity Modal Rollback when initial textColor was defined
  // node-alpha initially has textColor: '#10b981', color: '#d4a359'
  const alphaInitial = get(campaignStore.nodes).find((n) => n.id === 'node-alpha')!.data;
  assert(alphaInitial.textColor === '#10b981', 'Precondition: node-alpha has initial textColor #10b981');

  // User opens modal
  campaignStore.openNodeEditor(alphaInitial);
  assert(campaignStore.editingNode?.id === 'node-alpha', 'editingNode clone created');

  // User drags color picker: live update changes color and textColor
  campaignStore.updateNodeDataLive('node-alpha', {
    color: '#ec4899',
    colorTheme: '#ec4899',
    textColor: '#f43f5e',
  });
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-alpha')?.data.textColor === '#f43f5e',
    'Canvas preview reflects live textColor #f43f5e'
  );

  // User cancels modal (simulating handleCancel() in EditEntityModal.svelte)
  const editingNode = campaignStore.editingNode;
  if (editingNode) {
    campaignStore.updateNodeDataLive(editingNode.id, {
      color: editingNode.colorTheme || editingNode.color || '#d4a359',
      colorTheme: editingNode.colorTheme || editingNode.color || '#d4a359',
      textColor: editingNode.textColor,
    });
  }
  campaignStore.closeNodeEditor();

  const restoredAlpha = get(campaignStore.nodes).find((n) => n.id === 'node-alpha')!.data;
  const masterRestoredAlpha = (campaignStore.campaign.nodes || []).find((n) => n.id === 'node-alpha')!.data;

  assert(
    restoredAlpha.textColor === '#10b981',
    'Modal cancellation cleanly rolls back node textColor to original #10b981'
  );
  assert(
    restoredAlpha.color === '#d4a359' && restoredAlpha.colorTheme === '#d4a359',
    'Modal cancellation cleanly rolls back node color to original #d4a359'
  );
  assert(
    masterRestoredAlpha.textColor === '#10b981',
    'Master campaign node also cleanly restored to original #10b981'
  );
  assert(
    (campaignStore as any).undoStack.length === 0,
    'Cancellation flow left undoStack completely pristine (size 0)'
  );

  // Test 4.2: Entity Modal Rollback when initial textColor was UNDEFINED
  // node-beta has NO initial textColor (undefined)
  const betaInitial = get(campaignStore.nodes).find((n) => n.id === 'node-beta')!.data;
  assert(betaInitial.textColor === undefined, 'Precondition: node-beta has no textColor');

  // Open modal
  campaignStore.openNodeEditor(betaInitial);

  // User sets live textColor
  campaignStore.updateNodeDataLive('node-beta', { textColor: '#eab308' });
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-beta')?.data.textColor === '#eab308',
    'Live preview reflects temporary textColor #eab308'
  );

  // User cancels modal
  const editingBeta = campaignStore.editingNode;
  if (editingBeta) {
    campaignStore.updateNodeDataLive(editingBeta.id, {
      color: editingBeta.colorTheme || editingBeta.color || '#d4a359',
      colorTheme: editingBeta.colorTheme || editingBeta.color || '#d4a359',
      textColor: editingBeta.textColor, // undefined!
    });
  }
  campaignStore.closeNodeEditor();

  const restoredBeta = get(campaignStore.nodes).find((n) => n.id === 'node-beta')!.data;
  assert(
    restoredBeta.textColor === undefined,
    'Modal cancellation when initial textColor was undefined correctly restores textColor to undefined'
  );

  // Test 4.3: Edge Modal Rollback when initial textColor was defined
  // edge-ab has textColor: '#f43f5e'
  const edgeAbInitial = get(campaignStore.edges).find((e) => e.id === 'edge-ab')!;
  assert(edgeAbInitial.data?.textColor === '#f43f5e', 'Precondition: edge-ab has initial textColor #f43f5e');

  // Open edge editor
  campaignStore.openEdgeEditor(edgeAbInitial);

  // Live change edge textColor
  campaignStore.updateEdgeDataLive('edge-ab', { textColor: '#a855f7' });
  assert(
    get(campaignStore.edges).find((e) => e.id === 'edge-ab')?.data?.textColor === '#a855f7',
    'Edge preview reflects live textColor #a855f7'
  );

  // Cancel edge editor (simulating handleCancel() in EditEdgeModal.svelte)
  const editingEdge = campaignStore.editingEdge;
  if (editingEdge) {
    const data = (editingEdge.data || {}) as CanvasRelationEdgeData;
    campaignStore.updateEdgeDataLive(editingEdge.id, {
      color: data.color,
      textColor: data.textColor,
    });
  }
  campaignStore.closeEdgeEditor();

  const restoredEdgeAb = get(campaignStore.edges).find((e) => e.id === 'edge-ab')!.data;
  assert(
    restoredEdgeAb?.textColor === '#f43f5e',
    'Edge modal cancellation rolls back edge textColor to original #f43f5e'
  );
  assert(
    (campaignStore as any).undoStack.length === 0,
    'Edge modal cancel left undoStack size at 0'
  );

  // Test 4.4: Edge Modal Rollback when initial textColor was UNDEFINED
  // edge-ba has NO initial textColor
  const edgeBaInitial = get(campaignStore.edges).find((e) => e.id === 'edge-ba')!;
  assert(edgeBaInitial.data?.textColor === undefined, 'Precondition: edge-ba has no textColor');

  campaignStore.openEdgeEditor(edgeBaInitial);
  campaignStore.updateEdgeDataLive('edge-ba', { textColor: '#3b82f6' });
  assert(
    get(campaignStore.edges).find((e) => e.id === 'edge-ba')?.data?.textColor === '#3b82f6',
    'Edge preview reflects temporary textColor #3b82f6'
  );

  const editingEdgeBa = campaignStore.editingEdge;
  if (editingEdgeBa) {
    const data = (editingEdgeBa.data || {}) as CanvasRelationEdgeData;
    campaignStore.updateEdgeDataLive(editingEdgeBa.id, {
      color: data.color,
      textColor: data.textColor, // undefined
    });
  }
  campaignStore.closeEdgeEditor();

  const restoredEdgeBa = get(campaignStore.edges).find((e) => e.id === 'edge-ba')!.data;
  assert(
    restoredEdgeBa?.textColor === undefined,
    'Edge modal cancel restores textColor to undefined when edge had no initial textColor'
  );

  // Test 4.5: Multi-cycle session: Open -> Live Change -> Cancel -> Re-open -> Live Change -> Commit -> Re-open -> Cancel
  // Cycle 1: Change and Cancel
  campaignStore.openNodeEditor(alphaInitial);
  campaignStore.updateNodeDataLive('node-alpha', { textColor: '#990000' });
  if (campaignStore.editingNode) {
    campaignStore.updateNodeDataLive(campaignStore.editingNode.id, {
      textColor: campaignStore.editingNode.textColor,
    });
  }
  campaignStore.closeNodeEditor();
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-alpha')?.data.textColor === '#10b981',
    'Multi-cycle step 1: Cancel reverts color'
  );

  // Cycle 2: Change and Commit
  const alphaSavedTarget = get(campaignStore.nodes).find((n) => n.id === 'node-alpha')!.data;
  campaignStore.openNodeEditor(alphaSavedTarget);
  campaignStore.updateNodeDataLive('node-alpha', { textColor: '#059669' });
  // Commit
  campaignStore.updateNodeData('node-alpha', { textColor: '#059669' });
  campaignStore.closeNodeEditor();
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-alpha')?.data.textColor === '#059669',
    'Multi-cycle step 2: Commit saves #059669'
  );

  // Cycle 3: Re-open and Cancel should revert to the Cycle 2 committed color (#059669)
  const alphaCycle3 = get(campaignStore.nodes).find((n) => n.id === 'node-alpha')!.data;
  campaignStore.openNodeEditor(alphaCycle3);
  campaignStore.updateNodeDataLive('node-alpha', { textColor: '#ffffff' });
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-alpha')?.data.textColor === '#ffffff',
    'Multi-cycle step 3: Live preview shows #ffffff'
  );
  if (campaignStore.editingNode) {
    campaignStore.updateNodeDataLive(campaignStore.editingNode.id, {
      textColor: campaignStore.editingNode.textColor,
    });
  }
  campaignStore.closeNodeEditor();
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-alpha')?.data.textColor === '#059669',
    'Multi-cycle step 3: Cancel properly reverts to the previously committed color (#059669)'
  );

  // -------------------------------------------------------------------------
  // SUITE 5: Serialization & Persistence Roundtrip with textColor
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Campaign Serialization & Persistence ---');
  setupFreshCampaign();

  // Set explicit textColor on node-alpha and edge-ab
  campaignStore.updateNodeData('node-alpha', { textColor: '#f59e0b' });
  campaignStore.updateEdgeData('edge-ab', { textColor: '#8b5cf6' });

  // Serialize campaign
  const rawCampaignJson = JSON.stringify(campaignStore.campaign);
  assert(rawCampaignJson.includes('"textColor":"#f59e0b"'), 'Serialized JSON contains node textColor');
  assert(rawCampaignJson.includes('"textColor":"#8b5cf6"'), 'Serialized JSON contains edge textColor');

  // Reload campaign from serialized JSON
  const parsedCampaign = JSON.parse(rawCampaignJson);
  campaignStore.loadCampaign(parsedCampaign);

  const reloadedNode = get(campaignStore.nodes).find((n) => n.id === 'node-alpha');
  const reloadedEdge = get(campaignStore.edges).find((e) => e.id === 'edge-ab');

  assert(
    reloadedNode?.data.textColor === '#f59e0b',
    'Reloaded campaign retains node textColor in active store'
  );
  assert(
    reloadedEdge?.data?.textColor === '#8b5cf6',
    'Reloaded campaign retains edge textColor in active store'
  );

  // Legacy campaign compatibility (no textColor properties anywhere in JSON)
  const legacyCampaign = {
    id: 'legacy-campaign',
    title: 'Legacy Campaign',
    nodes: [
      {
        id: 'legacy-node',
        type: 'entityNode',
        position: { x: 0, y: 0 },
        data: { id: 'legacy-node', title: 'Legacy Node', color: '#d4a359' },
      },
    ],
    edges: [
      {
        id: 'legacy-edge',
        source: 'legacy-node',
        target: 'legacy-node',
        data: { label: 'self', relationType: 'neutral' },
      },
    ],
  };

  try {
    campaignStore.loadCampaign(legacyCampaign as any);
    const legNode = get(campaignStore.nodes).find((n) => n.id === 'legacy-node');
    const legEdge = get(campaignStore.edges).find((e) => e.id === 'legacy-edge');
    assert(
      legNode?.data.textColor === undefined && legEdge?.data?.textColor === undefined,
      'Legacy campaign without textColor loads without error and textColor remains undefined'
    );
  } catch (err: any) {
    assert(false, 'Loading legacy campaign threw error', err.message);
  }

  // -------------------------------------------------------------------------
  // SUITE 6: ColorPicker Component Live Event Flow Simulation
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 6: ColorPicker Live Event Flow Simulation ---');
  setupFreshCampaign();

  // Test 6.1: Simulated ColorPicker input event dispatching
  let lastLiveDispatched = '';
  let lastCommitDispatched = '';

  const mockOnInput = (c: string) => {
    lastLiveDispatched = c;
    campaignStore.updateNodeDataLive('node-alpha', { textColor: c || undefined });
  };
  const mockOnChange = (c: string) => {
    lastCommitDispatched = c;
    recentColors.addColor(c);
  };

  // Simulating dragging
  mockOnInput('#38bdf8');
  assert(
    lastLiveDispatched === '#38bdf8' &&
    get(campaignStore.nodes).find((n) => n.id === 'node-alpha')?.data.textColor === '#38bdf8',
    'Simulated ColorPicker oninput updates canvas node live'
  );

  // Simulating commit / swatch click
  mockOnChange('#38bdf8');
  assert(
    lastCommitDispatched === '#38bdf8' &&
    recentColors.colors[0] === '#38bdf8',
    'Simulated ColorPicker onchange adds color to recentColors store'
  );

  // Simulating clear / inherit button
  mockOnInput('');
  mockOnChange('');
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-alpha')?.data.textColor === undefined,
    'Simulated ColorPicker clearing color reactively resets node textColor to undefined'
  );

  // -------------------------------------------------------------------------
  // Final Score & Verdict
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log(`  EMPIRICAL CHALLENGE R3 RESULTS:`);
  console.log(`  TOTAL TESTS EXECUTED: ${passed + failed}`);
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log('='.repeat(70) + '\n');

  if (failed > 0) {
    console.error(`Empirical challenge FAILED with ${failed} failing tests.`);
    process.exit(1);
  } else {
    console.log('All empirical challenge tests PASSED successfully.');
    process.exit(0);
  }
}

runEmpiricalChallengeR3().catch((err) => {
  console.error('Fatal unhandled error in empirical test harness:', err);
  process.exit(1);
});
