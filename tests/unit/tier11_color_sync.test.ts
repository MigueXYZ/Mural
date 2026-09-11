// Mock localStorage and Svelte 5 runes for Node test runner
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

import type { EntityNodeData, CanvasRelationEdgeData } from '../../src/lib/types';
import { get } from 'svelte/store';

async function runTests() {
  const {
    RecentColorsStore,
    normalizeHex,
    isValidHex,
    MAX_RECENT_COLORS,
  } = await import('../../src/lib/stores/recentColorsStore.svelte');
  const { campaignStore } = await import('../../src/lib/stores/campaignStore.svelte');
  console.log('=== Starting Milestone 1: Color Sync & Recent Swatches Tests ===\n');
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
  // Suite 1: Hex Normalization and Validation
  // -------------------------------------------------------------------------
  console.log('[Suite 1] Hex Normalization & Validation');
  assert(isValidHex('#d4a359') === true, 'Valid 6-digit hex returns true');
  assert(isValidHex('#D4A359') === true, 'Uppercase 6-digit hex returns true');
  assert(isValidHex('#fff') === true, 'Valid 3-digit hex returns true');
  assert(isValidHex('d4a359') === true, 'Hex without leading # returns true');
  assert(isValidHex('invalid') === false, 'Non-hex string returns false');
  assert(isValidHex('#12') === false, 'Too short hex returns false');
  assert(isValidHex('#1234567') === false, 'Too long hex returns false');

  assert(normalizeHex('#D4A359') === '#d4a359', 'Normalizes uppercase hex to lowercase');
  assert(normalizeHex('d4a359') === '#d4a359', 'Prepends # if omitted');
  assert(normalizeHex('#abc') === '#aabbcc', 'Expands 3-digit hex to 6-digit hex');
  assert(normalizeHex('   #38bdf8  ') === '#38bdf8', 'Trims whitespace');

  // -------------------------------------------------------------------------
  // Suite 2: RecentColorsStore Logic & FIFO/LRU Deduplication (R6)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 2] RecentColorsStore (R6)');
  storageMap.clear();
  const store = new RecentColorsStore();
  store.clear();

  assert(store.colors.length === 0, 'Store starts empty after clear');

  store.addColor('#d4a359');
  assert(store.colors.length === 1, 'Adds first color');
  assert(store.colors[0] === '#d4a359', 'Added color is at index 0');

  // Add different color
  store.addColor('#38bdf8');
  assert(store.colors.length === 2, 'Adds second color');
  assert(store.colors[0] === '#38bdf8', 'Newest color is at index 0');
  assert(store.colors[1] === '#d4a359', 'Previous color shifted to index 1');

  // Deduplication: re-adding existing color brings it to front
  store.addColor('#d4a359');
  assert(store.colors.length === 2, 'Re-adding existing color does not duplicate');
  assert(store.colors[0] === '#d4a359', 'Existing color moves to index 0 (MRU)');
  assert(store.colors[1] === '#38bdf8', 'Other color is now index 1');

  // Case-insensitive deduplication
  store.addColor('#38BDF8');
  assert(store.colors.length === 2, 'Case-insensitive re-adding does not duplicate');
  assert(store.colors[0] === '#38bdf8', 'Brings #38bdf8 to front in normalized lowercase');

  // Capped at MAX_RECENT_COLORS (10)
  for (let i = 1; i <= 15; i++) {
    const hex = `#${i.toString(16).padStart(2, '0')}0000`;
    store.addColor(hex);
  }
  assert(store.colors.length === MAX_RECENT_COLORS, `Store capped at maximum ${MAX_RECENT_COLORS} colors`);
  assert(store.colors.length <= 10, 'No more than 10 colors maintained');

  // Persistence to localStorage
  const rawSaved = storageMap.get('mural_recent_colors');
  assert(Boolean(rawSaved), 'Persists recent colors into localStorage');
  const parsedSaved = JSON.parse(rawSaved || '[]');
  assert(parsedSaved.length === 10, 'Saved localStorage has 10 items');
  assert(parsedSaved[0] === store.colors[0], 'Saved localStorage matches in-memory store');

  // Clear removes from localStorage
  store.clear();
  assert(store.colors.length === 0, 'In-memory list empty after clear()');
  assert(!storageMap.has('mural_recent_colors'), 'localStorage entry removed after clear()');

  // -------------------------------------------------------------------------
  // Suite 3: Campaign Store Live Updates vs Regular Snapshots (R3)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 3] Campaign Store Live Sync vs Snapshots (R3)');

  campaignStore.loadCampaign({
    id: 'test-campaign',
    title: 'Color Sync Test Campaign',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-1',
        type: 'entityNode',
        position: { x: 100, y: 100 },
        data: {
          id: 'node-1',
          type: 'npc',
          title: 'Test Character',
          description: '',
          color: '#d4a359',
        },
      },
      {
        id: 'node-2',
        type: 'entityNode',
        position: { x: 300, y: 100 },
        data: {
          id: 'node-2',
          type: 'location',
          title: 'Target Location',
          description: '',
          color: '#38bdf8',
        },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'customLabeledEdge',
        data: {
          label: 'relação',
          relationType: 'custom',
          color: '#38bdf8',
        },
      },
    ],
  } as any);

  const nodesList = get(campaignStore.nodes);
  assert(nodesList.length === 2, 'Nodes loaded into campaign');
  const testNode = nodesList[0];
  const initialUndoLength = (campaignStore as any).undoStack.length;

  // Live update of node color and textColor
  campaignStore.updateNodeDataLive(testNode.id, {
    color: '#f87171',
    colorTheme: '#f87171',
    textColor: '#ffffff',
  });

  const liveNode = get(campaignStore.nodes).find((n) => n.id === testNode.id);
  assert(liveNode !== undefined, 'Live updated node exists');
  assert(liveNode?.data.color === '#f87171', 'Live color updated on node');
  assert(liveNode?.data.textColor === '#ffffff', 'Live textColor updated on node');
  assert(
    (campaignStore as any).undoStack.length === initialUndoLength,
    'updateNodeDataLive DOES NOT create an undo snapshot'
  );

  // Regular updateNodeData records snapshot
  campaignStore.updateNodeData(testNode.id, {
    textColor: '#10b981',
  });

  const committedNode = get(campaignStore.nodes).find((n) => n.id === testNode.id);
  assert(committedNode?.data.textColor === '#10b981', 'Committed textColor persisted on node');
  assert(
    (campaignStore as any).undoStack.length === initialUndoLength + 1,
    'updateNodeData records snapshot in undoStack'
  );

  // -------------------------------------------------------------------------
  // Suite 4: Edge Live Updates & Text Color (R3)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 4] Edge Live Sync & Text Color (R3)');

  const edgesList = get(campaignStore.edges);
  assert(edgesList.length === 1, 'Edge loaded into campaign');
  const testEdge = edgesList[0];
  const undoAfterEdge = (campaignStore as any).undoStack.length;

  // Live edge update
  campaignStore.updateEdgeDataLive(testEdge.id, {
    color: '#a855f7',
    textColor: '#f97316',
  });

  const liveEdge = get(campaignStore.edges).find((e) => e.id === testEdge.id);
  assert(liveEdge !== undefined, 'Live updated edge exists');
  assert(liveEdge?.data?.color === '#a855f7', 'Live edge color updated');
  assert(liveEdge?.data?.textColor === '#f97316', 'Live edge textColor updated');
  assert(
    (campaignStore as any).undoStack.length === undoAfterEdge,
    'updateEdgeDataLive DOES NOT create an undo snapshot'
  );

  // Regular updateEdgeData records snapshot
  campaignStore.updateEdgeData(testEdge.id, {
    textColor: '#38bdf8',
  });

  const committedEdge = get(campaignStore.edges).find((e) => e.id === testEdge.id);
  assert(committedEdge?.data?.textColor === '#38bdf8', 'Committed edge textColor persisted');
  assert(
    (campaignStore as any).undoStack.length === undoAfterEdge + 1,
    'updateEdgeData records snapshot in undoStack'
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(50));
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('='.repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
