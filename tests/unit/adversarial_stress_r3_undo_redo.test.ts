// tests/unit/adversarial_stress_r3_undo_redo.test.ts
// Empirical Adversarial Stress Harness for Undo Snapshot Isolation & Color Sync

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
import type { EntityNodeData, CanvasRelationEdgeData } from '../../src/lib/types';

async function runAdversarialStressSuite() {
  const { campaignStore } = await import('../../src/lib/stores/campaignStore.svelte');

  console.log('======================================================================');
  console.log('  ADVERSARIAL STRESS HARNESS: Undo/Redo Isolation & Edge Cases');
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

  function setupCampaign() {
    storageMap.clear();
    (campaignStore as any).undoStack = [];
    (campaignStore as any).redoStack = [];

    campaignStore.loadCampaign({
      id: 'stress-campaign',
      title: 'Stress Test Campaign',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: 'node-1',
          type: 'entityNode',
          position: { x: 50, y: 50 },
          data: {
            id: 'node-1',
            type: 'npc',
            title: 'Investigator Prime',
            textColor: '#112233',
            color: '#d4a359',
            colorTheme: '#d4a359',
            tags: ['tag1', 'tag2'],
          },
        },
        {
          id: 'node-2',
          type: 'entityNode',
          position: { x: 250, y: 50 },
          data: {
            id: 'node-2',
            type: 'location',
            title: 'Arkham Sanitarium',
            color: '#38bdf8',
            colorTheme: '#38bdf8',
            // initially UNDEFINED textColor
          },
        },
      ],
      edges: [
        {
          id: 'edge-1-2',
          source: 'node-1',
          target: 'node-2',
          type: 'customLabeledEdge',
          data: {
            label: 'visits',
            relationType: 'investigates',
            textColor: '#445566',
          },
        },
        {
          id: 'edge-2-1',
          source: 'node-2',
          target: 'node-1',
          type: 'customLabeledEdge',
          data: {
            label: 'confines',
            relationType: 'hostile',
            // initially UNDEFINED textColor
          },
        },
      ],
    } as any);
  }

  // -------------------------------------------------------------------------
  // STRESS 1: Initially undefined textColor -> live updates -> commit -> undo -> redo
  // -------------------------------------------------------------------------
  console.log('--- STRESS 1: Undefined Initial textColor Commit & Undo ---');
  setupCampaign();

  const node2Init = get(campaignStore.nodes).find(n => n.id === 'node-2');
  assert(node2Init?.data.textColor === undefined, 'Node-2 initial textColor is undefined');

  // 20 rapid live updates
  for (let i = 0; i < 20; i++) {
    campaignStore.updateNodeDataLive('node-2', { textColor: `#aa${i.toString(16).padStart(2, '0')}cc` });
  }

  // Commit new color
  campaignStore.updateNodeData('node-2', { textColor: '#ff00aa' });
  const node2Committed = get(campaignStore.nodes).find(n => n.id === 'node-2');
  assert(node2Committed?.data.textColor === '#ff00aa', 'Node-2 successfully committed with #ff00aa');
  assert((campaignStore as any).undoStack.length === 1, 'Exactly 1 undo snapshot recorded for commit');

  // Undo should revert textColor to UNDEFINED (not any intermediate live color)
  campaignStore.undo();
  const node2Undone = get(campaignStore.nodes).find(n => n.id === 'node-2');
  const node2MasterUndone = (campaignStore.campaign.nodes || []).find(n => n.id === 'node-2');
  assert(
    node2Undone?.data.textColor === undefined,
    'Undo successfully reverted node-2 textColor to undefined in writable store',
    `Expected undefined, got ${node2Undone?.data.textColor}`
  );
  assert(
    node2MasterUndone?.data.textColor === undefined,
    'Undo successfully reverted node-2 textColor to undefined in master nodes',
    `Expected undefined, got ${node2MasterUndone?.data.textColor}`
  );

  // Redo should restore the committed color
  campaignStore.redo();
  const node2Redone = get(campaignStore.nodes).find(n => n.id === 'node-2');
  assert(
    node2Redone?.data.textColor === '#ff00aa',
    'Redo successfully restored committed textColor #ff00aa',
    `Expected #ff00aa, got ${node2Redone?.data.textColor}`
  );

  // -------------------------------------------------------------------------
  // STRESS 2: Edge initially undefined textColor -> live updates -> commit -> undo -> redo
  // -------------------------------------------------------------------------
  console.log('\n--- STRESS 2: Undefined Initial Edge textColor Commit & Undo ---');
  setupCampaign();

  const edge21Init = get(campaignStore.edges).find(e => e.id === 'edge-2-1');
  assert(edge21Init?.data?.textColor === undefined, 'Edge-2-1 initial textColor is undefined');

  // 15 live updates
  for (let i = 0; i < 15; i++) {
    campaignStore.updateEdgeDataLive('edge-2-1', { textColor: `#10${i.toString(16).padStart(2, '0')}ee` });
  }

  campaignStore.updateEdgeData('edge-2-1', { textColor: '#00ffcc' });
  assert((campaignStore as any).undoStack.length === 1, 'Exactly 1 undo snapshot recorded for edge commit');

  campaignStore.undo();
  const edge21Undone = get(campaignStore.edges).find(e => e.id === 'edge-2-1');
  assert(
    edge21Undone?.data?.textColor === undefined,
    'Undo reverted edge textColor to undefined',
    `Expected undefined, got ${edge21Undone?.data?.textColor}`
  );

  campaignStore.redo();
  const edge21Redone = get(campaignStore.edges).find(e => e.id === 'edge-2-1');
  assert(
    edge21Redone?.data?.textColor === '#00ffcc',
    'Redo restored edge committed textColor #00ffcc',
    `Expected #00ffcc, got ${edge21Redone?.data?.textColor}`
  );

  // -------------------------------------------------------------------------
  // STRESS 3: Sequential multi-session edit & rollback history (3 iterations)
  // -------------------------------------------------------------------------
  console.log('\n--- STRESS 3: Multi-Session Sequential Edits & History Reversal ---');
  setupCampaign();

  const COLORS = ['#e11d48', '#2563eb', '#16a34a'];

  for (let round = 0; round < 3; round++) {
    // 5 live preview adjustments
    for (let j = 0; j < 5; j++) {
      campaignStore.updateNodeDataLive('node-1', { textColor: `#${round}${j}1122` });
    }
    // Commit round target
    campaignStore.updateNodeData('node-1', { textColor: COLORS[round] });
  }

  assert((campaignStore as any).undoStack.length === 3, 'Undo stack has exactly 3 entries after 3 sessions');
  assert(get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === COLORS[2], 'Current color is round 3 color');

  // Step 1: Undo round 3 -> should be COLORS[1]
  campaignStore.undo();
  assert(
    get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === COLORS[1],
    `Undo 1 restored round 2 color (${COLORS[1]})`,
    `Got ${get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor}`
  );

  // Step 2: Undo round 2 -> should be COLORS[0]
  campaignStore.undo();
  assert(
    get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === COLORS[0],
    `Undo 2 restored round 1 color (${COLORS[0]})`,
    `Got ${get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor}`
  );

  // Step 3: Undo round 1 -> should be initial '#112233'
  campaignStore.undo();
  assert(
    get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === '#112233',
    'Undo 3 restored pristine initial color (#112233)',
    `Got ${get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor}`
  );

  // Step 4: Redo back forward through all 3 steps
  campaignStore.redo();
  assert(get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === COLORS[0], 'Redo 1 re-applies round 1 color');
  campaignStore.redo();
  assert(get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === COLORS[1], 'Redo 2 re-applies round 2 color');
  campaignStore.redo();
  assert(get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === COLORS[2], 'Redo 3 re-applies round 3 color');

  // -------------------------------------------------------------------------
  // STRESS 4: Interleaved live edits on multiple entities
  // -------------------------------------------------------------------------
  console.log('\n--- STRESS 4: Interleaved Multi-Entity Live Edits ---');
  setupCampaign();

  // Node-1 live update
  campaignStore.updateNodeDataLive('node-1', { textColor: '#aaaaaa' });
  // Node-2 live update
  campaignStore.updateNodeDataLive('node-2', { textColor: '#bbbbbb' });

  // Edge-1-2 live update
  campaignStore.updateEdgeDataLive('edge-1-2', { textColor: '#cccccc' });

  // Commit Node-1
  campaignStore.updateNodeData('node-1', { textColor: '#111111' });

  // Commit Node-2
  campaignStore.updateNodeData('node-2', { textColor: '#222222' });

  // Commit Edge-1-2
  campaignStore.updateEdgeData('edge-1-2', { textColor: '#333333' });

  assert((campaignStore as any).undoStack.length === 3, 'Undo stack has 3 snapshots');

  // Undo Edge-1-2 commit -> should restore edge-1-2 to '#445566'
  campaignStore.undo();
  assert(
    get(campaignStore.edges).find(e => e.id === 'edge-1-2')?.data?.textColor === '#445566',
    'Undo Edge commit properly restored edge pre-modal textColor'
  );
  assert(
    get(campaignStore.nodes).find(n => n.id === 'node-2')?.data.textColor === '#222222',
    'Node-2 still retains committed color after edge undo'
  );

  // Undo Node-2 commit -> should restore node-2 to undefined
  campaignStore.undo();
  assert(
    get(campaignStore.nodes).find(n => n.id === 'node-2')?.data.textColor === undefined,
    'Undo Node-2 commit restored node-2 to undefined'
  );
  assert(
    get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === '#111111',
    'Node-1 still retains committed color after node-2 undo'
  );

  // Undo Node-1 commit -> should restore node-1 to '#112233'
  campaignStore.undo();
  assert(
    get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === '#112233',
    'Undo Node-1 commit restored node-1 to #112233'
  );

  // -------------------------------------------------------------------------
  // STRESS 5: Rapid 100x Undo/Redo Oscillation
  // -------------------------------------------------------------------------
  console.log('\n--- STRESS 5: Rapid 100x Undo/Redo Oscillation ---');
  setupCampaign();

  campaignStore.updateNodeDataLive('node-1', { textColor: '#998877' });
  campaignStore.updateNodeData('node-1', { textColor: '#123123' });

  let oscillationOk = true;
  for (let i = 0; i < 50; i++) {
    campaignStore.undo();
    if (get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor !== '#112233') {
      oscillationOk = false;
      break;
    }
    campaignStore.redo();
    if (get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor !== '#123123') {
      oscillationOk = false;
      break;
    }
  }
  assert(oscillationOk, '50 cycles of undo() -> redo() remained 100% deterministic and consistent');

  // -------------------------------------------------------------------------
  // STRESS 6: Mixed property commit (title, tags, and textColor)
  // -------------------------------------------------------------------------
  console.log('\n--- STRESS 6: Mixed Properties (Title, Tags, Color) Isolation ---');
  setupCampaign();

  campaignStore.updateNodeDataLive('node-1', { textColor: '#abcdef' });
  campaignStore.updateNodeData('node-1', {
    title: 'Inspector Updated',
    tags: ['new-tag-1', 'new-tag-2'],
    textColor: '#abcdef',
  });

  campaignStore.undo();
  const restoredNode = get(campaignStore.nodes).find(n => n.id === 'node-1')!.data;
  assert(
    restoredNode.textColor === '#112233' &&
    restoredNode.title === 'Investigator Prime' &&
    JSON.stringify(restoredNode.tags) === JSON.stringify(['tag1', 'tag2']),
    'Undo cleanly restores original title, tags, AND textColor together'
  );

  campaignStore.redo();
  const reRestoredNode = get(campaignStore.nodes).find(n => n.id === 'node-1')!.data;
  assert(
    reRestoredNode.textColor === '#abcdef' &&
    reRestoredNode.title === 'Inspector Updated' &&
    JSON.stringify(reRestoredNode.tags) === JSON.stringify(['new-tag-1', 'new-tag-2']),
    'Redo cleanly restores modified title, tags, AND textColor together'
  );

  // -------------------------------------------------------------------------
  // STRESS 7: Modal Keyboard Shortcuts & Lifecycle Flow
  // -------------------------------------------------------------------------
  console.log('\n--- STRESS 7: Modal Keyboard Shortcuts & Lifecycle Flow ---');
  setupCampaign();

  // Test 7.1: Node Modal - Escape key triggers handleCancel()
  {
    const targetNode = get(campaignStore.nodes).find(n => n.id === 'node-1')!.data;
    campaignStore.openNodeEditor(targetNode);
    // Live modify
    campaignStore.updateNodeDataLive('node-1', { textColor: '#990099', color: '#ff00ff' });
    assert(get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === '#990099', 'Node preview updated');

    // Simulate handleKeyDown with Escape
    const editing = campaignStore.editingNode;
    if (editing) {
      campaignStore.updateNodeDataLive(editing.id, {
        color: editing.colorTheme || editing.color || '#d4a359',
        colorTheme: editing.colorTheme || editing.color || '#d4a359',
        textColor: editing.textColor,
      });
    }
    campaignStore.closeNodeEditor();

    assert(
      get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === '#112233',
      'Escape simulation successfully rolled back node textColor'
    );
    assert(
      (campaignStore as any).undoStack.length === 0,
      'Escape cancel left undoStack at 0'
    );
  }

  // Test 7.2: Node Modal - Ctrl+Enter triggers handleSave()
  {
    const targetNode = get(campaignStore.nodes).find(n => n.id === 'node-1')!.data;
    campaignStore.openNodeEditor(targetNode);
    campaignStore.updateNodeDataLive('node-1', { textColor: '#778899' });

    // Simulate Ctrl+Enter save
    campaignStore.updateNodeData('node-1', { textColor: '#778899' });
    campaignStore.closeNodeEditor();

    assert(
      get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === '#778899',
      'Ctrl+Enter simulation saved committed textColor'
    );
    assert(
      (campaignStore as any).undoStack.length === 1,
      'Ctrl+Enter save recorded exactly 1 snapshot'
    );

    // Verify undo still restores pristine state
    campaignStore.undo();
    assert(
      get(campaignStore.nodes).find(n => n.id === 'node-1')?.data.textColor === '#112233',
      'Undo after Ctrl+Enter correctly restores pristine pre-modal textColor'
    );
  }

  // Test 7.3: Edge Modal - Escape triggers rollback
  {
    const targetEdge = get(campaignStore.edges).find(e => e.id === 'edge-1-2')!;
    campaignStore.openEdgeEditor(targetEdge);
    campaignStore.updateEdgeDataLive('edge-1-2', { textColor: '#ff8800' });

    // Simulate Escape on edge
    const editing = campaignStore.editingEdge;
    if (editing) {
      const d = (editing.data || {}) as CanvasRelationEdgeData;
      campaignStore.updateEdgeDataLive(editing.id, {
        color: d.color,
        textColor: d.textColor,
      });
    }
    campaignStore.closeEdgeEditor();

    assert(
      get(campaignStore.edges).find(e => e.id === 'edge-1-2')?.data?.textColor === '#445566',
      'Escape simulation successfully rolled back edge textColor'
    );
  }

  // Test 7.4: Edge Modal - Ctrl+Enter triggers save and baseline isolation
  {
    const targetEdge = get(campaignStore.edges).find(e => e.id === 'edge-1-2')!;
    campaignStore.openEdgeEditor(targetEdge);
    campaignStore.updateEdgeDataLive('edge-1-2', { textColor: '#334455' });

    // Simulate Ctrl+Enter save on edge
    campaignStore.updateEdgeData('edge-1-2', { textColor: '#334455' });
    campaignStore.closeEdgeEditor();

    assert(
      get(campaignStore.edges).find(e => e.id === 'edge-1-2')?.data?.textColor === '#334455',
      'Ctrl+Enter saved committed edge textColor'
    );

    campaignStore.undo();
    assert(
      get(campaignStore.edges).find(e => e.id === 'edge-1-2')?.data?.textColor === '#445566',
      'Undo after edge Ctrl+Enter restored pristine pre-modal edge textColor'
    );
  }

  // -------------------------------------------------------------------------
  // Final Score & Verdict
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log(`  ADVERSARIAL STRESS RESULTS:`);
  console.log(`  TOTAL TESTS EXECUTED: ${passed + failed}`);
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log('='.repeat(70) + '\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAdversarialStressSuite().catch(err => {
  console.error('Fatal error in stress test:', err);
  process.exit(1);
});
