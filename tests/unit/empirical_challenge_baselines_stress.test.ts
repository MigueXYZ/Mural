// tests/unit/empirical_challenge_baselines_stress.test.ts
// Empirical Adversarial Stress Test Harness for Pre-Live Baseline Tracking
// Challenger 2 Verification Suite - Mural Milestone 1 Iteration 2

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
  (globalThis as any).$derived.by = (fn: any) => (typeof fn === 'function' ? fn() : fn);
  (globalThis as any).$effect = (fn: any) => {};
}

import { get } from 'svelte/store';
import type { EntityNodeData, CanvasRelationEdgeData } from '../../src/lib/types';

async function runBaselinesStressTest() {
  const { campaignStore } = await import('../../src/lib/stores/campaignStore.svelte');

  console.log('======================================================================');
  console.log('  EMPIRICAL CHALLENGE HARNESS: PRE-LIVE BASELINE TRACKING STRESS');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

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
      failures.push(testName);
    }
  }

  function getStoreInternal(): any {
    return campaignStore as any;
  }

  function setupStressCampaign(nodeCount = 5) {
    storageMap.clear();
    getStoreInternal().undoStack = [];
    getStoreInternal().redoStack = [];
    getStoreInternal().liveNodeBaselines.clear();
    getStoreInternal().liveEdgeBaselines.clear();

    const nodes = [];
    for (let i = 1; i <= nodeCount; i++) {
      nodes.push({
        id: `node-${i}`,
        type: 'entityNode',
        position: { x: i * 100, y: 100 },
        data: {
          id: `node-${i}`,
          type: 'npc',
          title: `Entity ${i}`,
          subtitle: `ROLE ${i}`,
          description: `Description for entity ${i}`,
          color: `#11000${i}`,
          colorTheme: `#11000${i}`,
          textColor: i % 2 === 0 ? `#aa000${i}` : undefined,
        },
      });
    }

    const edges = [
      {
        id: 'edge-1-2',
        source: 'node-1',
        target: 'node-2',
        type: 'customLabeledEdge',
        data: {
          label: 'rel-1-2',
          relationType: 'allied' as const,
          color: '#10b981',
          textColor: '#22c55e',
        },
      },
      {
        id: 'edge-2-3',
        source: 'node-2',
        target: 'node-3',
        type: 'customLabeledEdge',
        data: {
          label: 'rel-2-3',
          relationType: 'enemy' as const,
          color: '#ef4444',
          textColor: undefined,
        },
      },
      {
        id: 'edge-3-4',
        source: 'node-3',
        target: 'node-4',
        type: 'customLabeledEdge',
        data: {
          label: 'rel-3-4',
          relationType: 'neutral' as const,
          color: '#3b82f6',
          textColor: '#60a5fa',
        },
      },
    ];

    campaignStore.loadCampaign({
      id: 'stress-campaign-baselines',
      title: 'Baseline Stress Test Campaign',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes,
      edges,
    });
  }

  // =========================================================================
  // SUITE 1: Multiple Nodes and Edges Edited in Sequence with Live Updates
  // =========================================================================
  console.log('--- SUITE 1: Multiple Nodes and Edges Edited in Sequence with Live Updates ---');
  setupStressCampaign(5);

  const initialBaselines: Record<string, string | undefined> = {
    'node-1': undefined,
    'node-2': '#aa0002',
    'node-3': undefined,
    'node-4': '#aa0004',
    'node-5': undefined,
  };

  const committedColors: Record<string, string> = {
    'node-1': '#ff0001',
    'node-2': '#ff0002',
    'node-3': '#ff0003',
    'node-4': '#ff0004',
    'node-5': '#ff0005',
  };

  // Edit 5 nodes in sequence with 25 live intermediate updates each
  for (let i = 1; i <= 5; i++) {
    const nodeId = `node-${i}`;
    const nodeObj = get(campaignStore.nodes).find((n) => n.id === nodeId)!;
    campaignStore.openNodeEditor(nodeObj.data);

    // Rapid intermediate slider drags
    for (let s = 1; s <= 25; s++) {
      campaignStore.updateNodeDataLive(nodeId, {
        textColor: `#slider-${i}-${s}`,
        color: `#temp-color-${i}-${s}`,
      });
    }

    // Commit
    campaignStore.updateNodeData(nodeId, {
      textColor: committedColors[nodeId],
      color: `#committed-color-${i}`,
    });
    campaignStore.closeNodeEditor();
  }

  // Verify all 5 have committed colors and undoStack has 5 entries
  assert(getStoreInternal().undoStack.length === 5, '5 sequential node commits created exactly 5 undo snapshots');
  for (let i = 1; i <= 5; i++) {
    const current = get(campaignStore.nodes).find((n) => n.id === `node-${i}`);
    assert(
      current?.data.textColor === committedColors[`node-${i}`],
      `Node ${i} has committed textColor ${committedColors[`node-${i}`]}`
    );
  }

  // Undo sequentially 5 times and verify pristine baseline restoration at each step
  for (let step = 5; step >= 1; step--) {
    campaignStore.undo();
    const currentUndoneNode = get(campaignStore.nodes).find((n) => n.id === `node-${step}`);
    const expectedColor = initialBaselines[`node-${step}`];
    assert(
      currentUndoneNode?.data.textColor === expectedColor,
      `Undo step ${6 - step}: Node ${step} reverted to pre-live baseline (${expectedColor})`,
      `Got: ${currentUndoneNode?.data.textColor}`
    );

    // Also verify nodes lower than step still retain their committed colors
    for (let lower = 1; lower < step; lower++) {
      const lowerNode = get(campaignStore.nodes).find((n) => n.id === `node-${lower}`);
      assert(
        lowerNode?.data.textColor === committedColors[`node-${lower}`],
        `Undo step ${6 - step}: Intact lower Node ${lower} maintains committed color`
      );
    }
  }

  // Redo sequentially 5 times and verify committed colors re-apply
  for (let step = 1; step <= 5; step++) {
    campaignStore.redo();
    const currentRedoneNode = get(campaignStore.nodes).find((n) => n.id === `node-${step}`);
    assert(
      currentRedoneNode?.data.textColor === committedColors[`node-${step}`],
      `Redo step ${step}: Node ${step} successfully restored committed textColor`
    );
  }

  // 1.2 Multiple edges edited in sequence with live updates and sequential undo/redo
  const edgeBaselines: Record<string, string | undefined> = {
    'edge-1-2': '#22c55e',
    'edge-2-3': undefined,
    'edge-3-4': '#60a5fa',
  };
  const committedEdgeColors: Record<string, string> = {
    'edge-1-2': '#e11d48',
    'edge-2-3': '#f59e0b',
    'edge-3-4': '#8b5cf6',
  };

  for (const edgeId of ['edge-1-2', 'edge-2-3', 'edge-3-4']) {
    const edgeObj = get(campaignStore.edges).find((e) => e.id === edgeId)!;
    campaignStore.openEdgeEditor(edgeObj);

    for (let s = 1; s <= 20; s++) {
      campaignStore.updateEdgeDataLive(edgeId, { textColor: `#edge-drag-${s}` });
    }

    campaignStore.updateEdgeData(edgeId, { textColor: committedEdgeColors[edgeId] });
    campaignStore.closeEdgeEditor();
  }

  // Undo 3 edge commits
  for (const edgeId of ['edge-3-4', 'edge-2-3', 'edge-1-2']) {
    campaignStore.undo();
    const revertedEdge = get(campaignStore.edges).find((e) => e.id === edgeId);
    assert(
      revertedEdge?.data?.textColor === edgeBaselines[edgeId],
      `Undo edge commit: ${edgeId} restored pristine baseline (${edgeBaselines[edgeId]})`,
      `Got: ${revertedEdge?.data?.textColor}`
    );
  }

  // Redo 3 edge commits
  for (const edgeId of ['edge-1-2', 'edge-2-3', 'edge-3-4']) {
    campaignStore.redo();
    const restoredEdge = get(campaignStore.edges).find((e) => e.id === edgeId);
    assert(
      restoredEdge?.data?.textColor === committedEdgeColors[edgeId],
      `Redo edge commit: ${edgeId} restored committed color (${committedEdgeColors[edgeId]})`
    );
  }

  // =========================================================================
  // SUITE 2: Canceling One Modal, Saving Another, Then Undoing Multiple Steps
  // =========================================================================
  console.log('\n--- SUITE 2: Canceling One Modal, Saving Another, Then Undoing Multiple Steps ---');
  setupStressCampaign(4);

  // Initial states:
  // node-1: textColor undefined, color #110001
  // node-2: textColor #aa0002,   color #110002
  // node-3: textColor undefined, color #110003
  // node-4: textColor #aa0004,   color #110004

  // Action 1: Open node-1, live update to #live1, then CANCEL
  campaignStore.openNodeEditor(get(campaignStore.nodes).find((n) => n.id === 'node-1')!.data);
  for (let s = 0; s < 15; s++) {
    campaignStore.updateNodeDataLive('node-1', { textColor: `#drag-1-${s}`, color: `#color-1-${s}` });
  }
  // Modal cancel simulates EditEntityModal handleCancel:
  campaignStore.updateNodeDataLive('node-1', {
    color: '#110001',
    colorTheme: '#110001',
    textColor: undefined,
  });
  campaignStore.closeNodeEditor();

  assert(getStoreInternal().undoStack.length === 0, 'Canceled modal for node-1 pushed 0 undo snapshots');
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-1')?.data.textColor === undefined,
    'Node-1 textColor rolled back to undefined after cancel'
  );

  // Action 2: Open node-2, live update to #live2, then SAVE #saved2
  campaignStore.openNodeEditor(get(campaignStore.nodes).find((n) => n.id === 'node-2')!.data);
  for (let s = 0; s < 15; s++) {
    campaignStore.updateNodeDataLive('node-2', { textColor: `#drag-2-${s}` });
  }
  campaignStore.updateNodeData('node-2', { textColor: '#saved-2-color' });
  campaignStore.closeNodeEditor();

  assert(getStoreInternal().undoStack.length === 1, 'Saved modal for node-2 pushed exactly 1 undo snapshot');
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-2')?.data.textColor === '#saved-2-color',
    'Node-2 has #saved-2-color'
  );

  // Action 3: Open node-3, live update to #live3, then CANCEL
  campaignStore.openNodeEditor(get(campaignStore.nodes).find((n) => n.id === 'node-3')!.data);
  for (let s = 0; s < 15; s++) {
    campaignStore.updateNodeDataLive('node-3', { textColor: `#drag-3-${s}` });
  }
  campaignStore.updateNodeDataLive('node-3', {
    color: '#110003',
    colorTheme: '#110003',
    textColor: undefined,
  });
  campaignStore.closeNodeEditor();

  assert(getStoreInternal().undoStack.length === 1, 'Canceled modal for node-3 did NOT increment undo stack');
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-3')?.data.textColor === undefined,
    'Node-3 textColor rolled back to undefined after cancel'
  );

  // Action 4: Open node-4, live update to #live4, then SAVE #saved4
  campaignStore.openNodeEditor(get(campaignStore.nodes).find((n) => n.id === 'node-4')!.data);
  for (let s = 0; s < 15; s++) {
    campaignStore.updateNodeDataLive('node-4', { textColor: `#drag-4-${s}` });
  }
  campaignStore.updateNodeData('node-4', { textColor: '#saved-4-color' });
  campaignStore.closeNodeEditor();

  assert(getStoreInternal().undoStack.length === 2, 'Saved modal for node-4 pushed second undo snapshot');
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-4')?.data.textColor === '#saved-4-color',
    'Node-4 has #saved-4-color'
  );

  // Undoing Step 1 (should undo node-4 save)
  campaignStore.undo();
  assert(getStoreInternal().undoStack.length === 1, 'Undo popped 1 snapshot');
  const node4AfterUndo = get(campaignStore.nodes).find((n) => n.id === 'node-4');
  assert(
    node4AfterUndo?.data.textColor === '#aa0004',
    'Undoing Node-4 save restores original pre-live baseline (#aa0004)',
    `Got: ${node4AfterUndo?.data.textColor}`
  );
  // Node-2 must STILL be #saved-2-color
  const node2AfterUndo1 = get(campaignStore.nodes).find((n) => n.id === 'node-2');
  assert(
    node2AfterUndo1?.data.textColor === '#saved-2-color',
    'Node-2 preserves #saved-2-color after Node-4 undo'
  );
  // Node-1 and Node-3 must still be undefined
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-1')?.data.textColor === undefined,
    'Node-1 remains clean undefined'
  );
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-3')?.data.textColor === undefined,
    'Node-3 remains clean undefined'
  );

  // Undoing Step 2 (should undo node-2 save)
  campaignStore.undo();
  assert(getStoreInternal().undoStack.length === 0, 'Undo popped remaining snapshot');
  const node2AfterUndo2 = get(campaignStore.nodes).find((n) => n.id === 'node-2');
  assert(
    node2AfterUndo2?.data.textColor === '#aa0002',
    'Undoing Node-2 save restores original pre-live baseline (#aa0002)',
    `Got: ${node2AfterUndo2?.data.textColor}`
  );

  // Redoing both steps
  campaignStore.redo();
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-2')?.data.textColor === '#saved-2-color',
    'Redo 1 restores Node-2 saved color'
  );
  campaignStore.redo();
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-4')?.data.textColor === '#saved-4-color',
    'Redo 2 restores Node-4 saved color'
  );

  // =========================================================================
  // SUITE 3: Rapidly Switching Between Nodes
  // =========================================================================
  console.log('\n--- SUITE 3: Rapidly Switching Between Nodes ---');
  setupStressCampaign(3);

  // 3.1 Switch from Node-1 to Node-2 without closeNodeEditor
  // Node-1 pre-live textColor: undefined
  // Node-2 pre-live textColor: #aa0002
  campaignStore.openNodeEditor(get(campaignStore.nodes).find((n) => n.id === 'node-1')!.data);
  campaignStore.updateNodeDataLive('node-1', { textColor: '#temp-A-uncommitted' });

  assert(getStoreInternal().liveNodeBaselines.has('node-1'), 'Baseline for node-1 is registered');

  // Direct switch to Node-2 (e.g. user clicks another node on canvas)
  campaignStore.openNodeEditor(get(campaignStore.nodes).find((n) => n.id === 'node-2')!.data);
  campaignStore.updateNodeDataLive('node-2', { textColor: '#temp-B-uncommitted' });

  assert(getStoreInternal().liveNodeBaselines.has('node-2'), 'Baseline for node-2 is registered');
  assert(getStoreInternal().liveNodeBaselines.has('node-1'), 'Baseline for node-1 is still preserved');

  // Save Node-2
  campaignStore.updateNodeData('node-2', { textColor: '#committed-B' });
  campaignStore.closeNodeEditor(); // This clears baselines

  // Switch back to Node-1 and save Node-1
  campaignStore.openNodeEditor(get(campaignStore.nodes).find((n) => n.id === 'node-1')!.data);
  campaignStore.updateNodeDataLive('node-1', { textColor: '#temp-A2-uncommitted' });
  campaignStore.updateNodeData('node-1', { textColor: '#committed-A' });
  campaignStore.closeNodeEditor();

  // Now undo Node-1 commit
  campaignStore.undo();
  const node1Undone = get(campaignStore.nodes).find((n) => n.id === 'node-1');
  assert(
    node1Undone?.data.textColor === '#temp-A-uncommitted' || node1Undone?.data.textColor === undefined,
    'Node-1 successfully reverted upon undo'
  );

  // 3.2 High-pressure randomized rapid switching test (100 iterations)
  setupStressCampaign(5);
  const originalColors = ['#100', '#200', '#300', '#400', '#500'];
  for (let i = 1; i <= 5; i++) {
    campaignStore.updateNodeData(`node-${i}`, { textColor: originalColors[i - 1] });
  }
  // Clear undoStack to start fresh baseline
  getStoreInternal().undoStack = [];
  getStoreInternal().redoStack = [];

  let commitsCount = 0;
  for (let iter = 0; iter < 100; iter++) {
    const nodeIdx = (iter % 5) + 1;
    const nodeId = `node-${nodeIdx}`;
    const targetNode = get(campaignStore.nodes).find((n) => n.id === nodeId)!;

    campaignStore.openNodeEditor(targetNode.data);
    campaignStore.updateNodeDataLive(nodeId, { textColor: `#live-${iter}` });

    if (iter % 3 === 0) {
      // Save
      campaignStore.updateNodeData(nodeId, { textColor: `#commit-${iter}` });
      campaignStore.closeNodeEditor();
      commitsCount++;
    } else if (iter % 3 === 1) {
      // Cancel
      campaignStore.updateNodeDataLive(nodeId, { textColor: targetNode.data.textColor });
      campaignStore.closeNodeEditor();
    } else {
      // Direct jump without close
      // Switch next turn
    }
  }
  campaignStore.closeNodeEditor(); // Final clean close

  assert(
    getStoreInternal().undoStack.length === commitsCount,
    `Rapid randomized stress test: Exactly ${commitsCount} snapshots in undoStack after 100 mixed cycles`
  );
  assert(
    getStoreInternal().liveNodeBaselines.size === 0,
    'liveNodeBaselines completely cleared after rapid switching stress test'
  );
  assert(
    getStoreInternal().liveEdgeBaselines.size === 0,
    'liveEdgeBaselines completely cleared after rapid switching stress test'
  );

  // =========================================================================
  // SUITE 4: Clearing Baselines on undo/redo/loadCampaign/closeNodeEditor/delete
  // =========================================================================
  console.log('\n--- SUITE 4: Clearing Baselines on undo/redo/loadCampaign/closeNodeEditor/delete ---');
  setupStressCampaign(3);

  // 4.1 undo() clears baselines
  campaignStore.updateNodeDataLive('node-1', { textColor: '#live-before-undo' });
  assert(getStoreInternal().liveNodeBaselines.size === 1, 'Baseline registered before undo');
  campaignStore.undo(); // undoStack was 0, but undo() unconditionally clears baselines
  assert(getStoreInternal().liveNodeBaselines.size === 0, 'undo() unconditionally cleared liveNodeBaselines');
  assert(getStoreInternal().liveEdgeBaselines.size === 0, 'undo() unconditionally cleared liveEdgeBaselines');

  // Verify fresh baseline capture after undo
  campaignStore.updateNodeDataLive('node-1', { textColor: '#live-after-undo-1' });
  assert(getStoreInternal().liveNodeBaselines.size === 1, 'Fresh baseline captured after undo');
  campaignStore.updateNodeData('node-1', { textColor: '#saved-after-undo-1' });
  assert(getStoreInternal().liveNodeBaselines.size === 0, 'Baseline consumed on commit');

  // 4.2 redo() clears baselines
  // First, create an action and undo it so redoStack has an item
  campaignStore.updateNodeData('node-2', { textColor: '#commit-for-redo' });
  campaignStore.undo();
  assert(getStoreInternal().redoStack.length === 1, 'RedoStack has 1 entry ready');

  // Live update while redo is available
  campaignStore.updateNodeDataLive('node-2', { textColor: '#live-before-redo' });
  assert(getStoreInternal().liveNodeBaselines.size === 1, 'Baseline registered before redo');
  campaignStore.redo();
  assert(getStoreInternal().liveNodeBaselines.size === 0, 'redo() unconditionally cleared liveNodeBaselines');
  assert(getStoreInternal().liveEdgeBaselines.size === 0, 'redo() unconditionally cleared liveEdgeBaselines');
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-2')?.data.textColor === '#commit-for-redo',
    'redo() restored committed color successfully'
  );

  // 4.3 loadCampaign() clears baselines and prevents stale leakage
  campaignStore.updateNodeDataLive('node-1', { textColor: '#dirty-old-campaign' });
  assert(getStoreInternal().liveNodeBaselines.size === 1, 'Baseline registered before loadCampaign');

  campaignStore.loadCampaign({
    id: 'fresh-campaign-id',
    title: 'Fresh Campaign',
    nodes: [
      {
        id: 'node-1', // Same ID!
        type: 'entityNode',
        position: { x: 0, y: 0 },
        data: {
          id: 'node-1',
          type: 'npc',
          title: 'Brand New Node 1',
          textColor: '#brand-new-pristine',
        },
      },
    ],
    edges: [],
  });

  assert(getStoreInternal().liveNodeBaselines.size === 0, 'loadCampaign() cleared liveNodeBaselines');
  assert(getStoreInternal().liveEdgeBaselines.size === 0, 'loadCampaign() cleared liveEdgeBaselines');

  // Now live update node-1 in new campaign
  campaignStore.updateNodeDataLive('node-1', { textColor: '#dirty-new-campaign' });
  assert(
    getStoreInternal().liveNodeBaselines.get('node-1')?.textColor === '#brand-new-pristine',
    'Baseline in new campaign captures pristine new data (#brand-new-pristine), NOT stale old data',
    `Got: ${getStoreInternal().liveNodeBaselines.get('node-1')?.textColor}`
  );
  campaignStore.updateNodeData('node-1', { textColor: '#committed-new' });
  campaignStore.undo();
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-1')?.data.textColor === '#brand-new-pristine',
    'Undo in new campaign restores new campaign pristine baseline'
  );

  // 4.4 closeNodeEditor() and closeEdgeEditor() clear baselines
  setupStressCampaign(2);
  campaignStore.updateNodeDataLive('node-1', { textColor: '#temp-for-close' });
  assert(getStoreInternal().liveNodeBaselines.has('node-1'), 'Baseline present before closeNodeEditor');
  campaignStore.closeNodeEditor();
  assert(getStoreInternal().liveNodeBaselines.size === 0, 'closeNodeEditor() cleared liveNodeBaselines');
  assert(getStoreInternal().liveEdgeBaselines.size === 0, 'closeNodeEditor() cleared liveEdgeBaselines');

  campaignStore.updateEdgeDataLive('edge-1-2', { textColor: '#temp-edge-close' });
  assert(getStoreInternal().liveEdgeBaselines.has('edge-1-2'), 'Baseline present before closeEdgeEditor');
  campaignStore.closeEdgeEditor();
  assert(getStoreInternal().liveEdgeBaselines.size === 0, 'closeEdgeEditor() cleared liveEdgeBaselines');
  assert(getStoreInternal().liveNodeBaselines.size === 0, 'closeEdgeEditor() cleared liveNodeBaselines');

  // 4.5 deleteNode(id) and deleteEdge(id) prune baseline entry
  campaignStore.updateNodeDataLive('node-1', { textColor: '#node-to-delete' });
  assert(getStoreInternal().liveNodeBaselines.has('node-1'), 'Baseline present before deleteNode');
  campaignStore.deleteNode('node-1');
  assert(!getStoreInternal().liveNodeBaselines.has('node-1'), 'deleteNode() removed node baseline');

  campaignStore.updateEdgeDataLive('edge-1-2', { textColor: '#edge-to-delete' });
  // edge-1-2 was already deleted by deleteNode('node-1') cascade, but if we create a live baseline for an edge:
  getStoreInternal().liveEdgeBaselines.set('edge-test', { textColor: '#test' } as any);
  campaignStore.deleteEdge('edge-test');
  assert(!getStoreInternal().liveEdgeBaselines.has('edge-test'), 'deleteEdge() removed edge baseline');

  // =========================================================================
  // SUITE 5: Boundary & Schema Edge Cases
  // =========================================================================
  console.log('\n--- SUITE 5: Boundary & Schema Edge Cases ---');
  setupStressCampaign(2);

  // 5.1 Node initially has NO textColor (undefined)
  // Step 1: Live update to #color1
  campaignStore.updateNodeDataLive('node-1', { textColor: '#color1' });
  // Step 2: Commit #color2
  campaignStore.updateNodeData('node-1', { textColor: '#color2' });
  // Step 3: Undo
  campaignStore.undo();
  const node1UndefinedCheck = get(campaignStore.nodes).find((n) => n.id === 'node-1');
  assert(
    node1UndefinedCheck?.data.textColor === undefined,
    'Undo strictly restores undefined textColor (not null, not empty string)',
    `Got: ${JSON.stringify(node1UndefinedCheck?.data.textColor)}`
  );
  // Step 4: Redo
  campaignStore.redo();
  const node1RedoCheck = get(campaignStore.nodes).find((n) => n.id === 'node-1');
  assert(
    node1RedoCheck?.data.textColor === '#color2',
    'Redo restores committed textColor (#color2)'
  );

  // 5.2 Node initially HAS textColor (#aa0002), live update removes it (textColor: undefined)
  campaignStore.updateNodeDataLive('node-2', { textColor: undefined });
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-2')?.data.textColor === undefined,
    'Live update successfully removed textColor'
  );
  campaignStore.updateNodeData('node-2', { textColor: undefined });
  // Undo: should restore original #aa0002
  campaignStore.undo();
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-2')?.data.textColor === '#aa0002',
    'Undo restores original textColor (#aa0002) after committing undefined'
  );
  // Redo: should re-remove it (undefined)
  campaignStore.redo();
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-2')?.data.textColor === undefined,
    'Redo restores committed undefined textColor'
  );

  // 5.3 Multi-property baseline mutation simultaneously
  setupStressCampaign(1);
  const initialNodeData = JSON.parse(JSON.stringify(get(campaignStore.nodes)[0].data));

  // Live update mutating 6 properties at once
  campaignStore.updateNodeDataLive('node-1', {
    title: 'Mutated Live Title',
    subtitle: 'MUTATED SUBTITLE',
    description: 'Mutated Live Description',
    color: '#990000',
    colorTheme: '#990000',
    textColor: '#ff9900',
  });

  // Commit with different final values
  campaignStore.updateNodeData('node-1', {
    title: 'Committed Final Title',
    subtitle: 'COMMITTED SUBTITLE',
    description: 'Committed Final Description',
    color: '#009900',
    colorTheme: '#009900',
    textColor: '#00ff99',
  });

  // Undo: verify ALL 6 properties revert to initial pristine values!
  campaignStore.undo();
  const node1AfterMultiUndo = get(campaignStore.nodes).find((n) => n.id === 'node-1')!.data;

  assert(
    node1AfterMultiUndo.title === initialNodeData.title &&
      node1AfterMultiUndo.subtitle === initialNodeData.subtitle &&
      node1AfterMultiUndo.description === initialNodeData.description &&
      node1AfterMultiUndo.color === initialNodeData.color &&
      node1AfterMultiUndo.colorTheme === initialNodeData.colorTheme &&
      node1AfterMultiUndo.textColor === initialNodeData.textColor,
    'Multi-property baseline mutation: ALL 6 properties reverted cleanly to pre-live values on undo',
    `Got: ${JSON.stringify(node1AfterMultiUndo)}`
  );

  // 5.4 Rapid 20-cycle Undo/Redo thrashing under live updates
  setupStressCampaign(1);
  campaignStore.updateNodeData('node-1', { textColor: '#thrash-base' });

  for (let cycle = 0; cycle < 20; cycle++) {
    campaignStore.updateNodeDataLive('node-1', { textColor: `#thrash-live-${cycle}` });
    campaignStore.updateNodeData('node-1', { textColor: `#thrash-commit-${cycle}` });
    campaignStore.undo();
    campaignStore.redo();
  }

  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-1')?.data.textColor === '#thrash-commit-19',
    'Survives 20 rapid live-update commit/undo/redo thrash cycles with perfect integrity'
  );
  assert(
    getStoreInternal().liveNodeBaselines.size === 0,
    'Baseline map clean with zero leak after thrashing'
  );

  // =========================================================================
  // SUITE 6: Edge Data Undefined, Stack Boundaries & Extreme History Depth
  // =========================================================================
  console.log('\n--- SUITE 6: Edge Data Undefined, Stack Boundaries & Extreme History Depth ---');

  // 6.1 Edge with originally undefined data object undergoing live update, commit, and undo
  setupStressCampaign(2);
  campaignStore.loadCampaign({
    id: 'edge-undefined-data-campaign',
    nodes: [
      { id: 'n1', type: 'entityNode', position: { x: 0, y: 0 }, data: { id: 'n1', title: 'N1' } },
      { id: 'n2', type: 'entityNode', position: { x: 100, y: 0 }, data: { id: 'n2', title: 'N2' } },
    ],
    edges: [
      {
        id: 'e-bare',
        source: 'n1',
        target: 'n2',
        type: 'customLabeledEdge',
        // data completely undefined!
      } as any,
    ],
  });

  campaignStore.updateEdgeDataLive('e-bare', { textColor: '#live-bare-color' });
  const liveBareEdge = get(campaignStore.edges).find((e) => e.id === 'e-bare');
  assert(
    liveBareEdge?.data?.textColor === '#live-bare-color',
    'updateEdgeDataLive works seamlessly when edge.data was originally undefined'
  );
  campaignStore.updateEdgeData('e-bare', { textColor: '#commit-bare-color' });
  assert(
    get(campaignStore.edges).find((e) => e.id === 'e-bare')?.data?.textColor === '#commit-bare-color',
    'updateEdgeData commits cleanly when edge.data was originally undefined'
  );
  campaignStore.undo();
  const undoneBareEdge = get(campaignStore.edges).find((e) => e.id === 'e-bare');
  assert(
    undoneBareEdge?.data?.textColor === undefined,
    'Undo restores original undefined textColor on originally bare edge'
  );

  // 6.2 Stack underflow resilience: calling undo/redo when stacks are empty
  setupStressCampaign(1);
  assert(getStoreInternal().undoStack.length === 0, 'Precondition: undoStack is empty');
  assert(getStoreInternal().redoStack.length === 0, 'Precondition: redoStack is empty');

  // Calling undo on empty stack
  try {
    campaignStore.undo();
    assert(true, 'Calling undo() with empty undoStack does not throw and executes safely');
  } catch (err: any) {
    assert(false, 'Calling undo() on empty stack threw error', err.message);
  }

  // Calling redo on empty stack
  try {
    campaignStore.redo();
    assert(true, 'Calling redo() with empty redoStack does not throw and executes safely');
  } catch (err: any) {
    assert(false, 'Calling redo() on empty stack threw error', err.message);
  }

  // 6.3 Non-existent node and edge IDs in baseline tracking methods
  try {
    campaignStore.updateNodeDataLive('non-existent-node-id', { textColor: '#fff' });
    campaignStore.updateNodeData('non-existent-node-id', { textColor: '#fff' });
    campaignStore.updateEdgeDataLive('non-existent-edge-id', { textColor: '#fff' });
    campaignStore.updateEdgeData('non-existent-edge-id', { textColor: '#fff' });
    assert(true, 'Baseline live updates and commits on non-existent IDs fail gracefully without exceptions');
  } catch (err: any) {
    assert(false, 'Non-existent ID operations threw error', err.message);
  }

  // 6.4 History stack depth limit (maxHistorySize = 50) under live update pressure
  setupStressCampaign(1);
  const TOTAL_COMMITS = 65;
  for (let c = 1; c <= TOTAL_COMMITS; c++) {
    campaignStore.updateNodeDataLive('node-1', { textColor: `#live-depth-${c}` });
    campaignStore.updateNodeData('node-1', { textColor: `#commit-depth-${c}` });
  }

  const stackSize = getStoreInternal().undoStack.length;
  assert(
    stackSize === 50,
    `undoStack strictly obeys maxHistorySize (50) under 65 sequential live-update commits (got ${stackSize})`
  );

  // Now perform 50 continuous undos
  for (let u = 1; u <= 50; u++) {
    campaignStore.undo();
  }
  assert(
    getStoreInternal().undoStack.length === 0,
    '50 continuous undos cleanly drained the capped undoStack to 0'
  );
  assert(
    getStoreInternal().redoStack.length === 50,
    'redoStack contains all 50 popped snapshots ready for replay'
  );

  // Replay all 50 redos
  for (let r = 1; r <= 50; r++) {
    campaignStore.redo();
  }
  assert(
    get(campaignStore.nodes).find((n) => n.id === 'node-1')?.data.textColor === `#commit-depth-${TOTAL_COMMITS}`,
    `50 redos re-applied final commit textColor (#commit-depth-${TOTAL_COMMITS})`
  );

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n======================================================================');
  console.log('  EMPIRICAL CHALLENGE BASELINE STRESS RESULTS:');
  console.log(`  TOTAL TESTS EXECUTED: ${passed + failed}`);
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    console.error('FAILURES:');
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('>>> ALL BASELINE STRESS TESTS PASSED (100%) <<<');
  }
}

runBaselinesStressTest().catch((err) => {
  console.error('Fatal error running stress harness:', err);
  process.exit(1);
});
