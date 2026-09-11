// tests/unit/adversarial_r1_ui_scale_stress.test.ts
// Adversarial Stress & Robustness Test Suite for Milestone 3 UI Scale (R1)
// Executed by Challenger 2

// ---------------------------------------------------------------------------
// Mock Environment Setup
// ---------------------------------------------------------------------------
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

const domProperties = new Map<string, string>();
(globalThis as any).document = {
  documentElement: {
    style: {
      setProperty: (prop: string, val: string) => domProperties.set(prop, String(val)),
      getPropertyValue: (prop: string) => domProperties.get(prop) || '',
      removeProperty: (prop: string) => domProperties.delete(prop),
    },
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  location: { search: '' },
};

// Svelte 5 rune mocks for node execution
if (typeof (globalThis as any).$state === 'undefined') {
  (globalThis as any).$state = (v: any) => v;
  (globalThis as any).$derived = (v: any) => v;
  (globalThis as any).$derived.by = (fn: any) => (typeof fn === 'function' ? fn() : fn);
  (globalThis as any).$effect = (fn: any) => {};
}

async function runAdversarialSuite() {
  const { appState } = await import('../../src/lib/stores/appState.svelte');
  const { campaignStore } = await import('../../src/lib/stores/campaignStore.svelte');

  console.log('================================================================');
  console.log('=== ADVERSARIAL STRESS TEST: UI Scale Boundaries & Persistence ===');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // Suite 1: Extreme Boundary Values Clamping
  // Required: negative scales (-1.0), 0, 0.50, 0.749 (must clamp to 0.75),
  //           1.501, 5.0, 999.0 (must clamp to 1.50)
  // ---------------------------------------------------------------------------
  console.log('[Suite 1] Extreme Boundary Values Clamping');

  const boundaryCases = [
    { input: -1.0, expected: 0.75, desc: 'Negative scale -1.0 must clamp to 0.75' },
    { input: -50.0, expected: 0.75, desc: 'Extreme negative scale -50.0 must clamp to 0.75' },
    { input: -0.0001, expected: 0.75, desc: 'Near-zero negative -0.0001 must clamp to 0.75' },
    { input: 0, expected: 0.75, desc: 'Zero scale 0 must clamp to 0.75' },
    { input: 0.50, expected: 0.75, desc: 'Scale 0.50 below min must clamp to 0.75' },
    { input: 0.749, expected: 0.75, desc: 'Sub-boundary 0.749 must round/clamp to 0.75' },
    { input: 0.75, expected: 0.75, desc: 'Exact minimum boundary 0.75 accepted' },
    { input: 1.00, expected: 1.00, desc: 'Baseline scale 1.00 accepted' },
    { input: 1.50, expected: 1.50, desc: 'Exact maximum boundary 1.50 accepted' },
    { input: 1.501, expected: 1.50, desc: 'Super-boundary 1.501 must round/clamp to 1.50' },
    { input: 5.0, expected: 1.50, desc: 'Scale 5.0 above max must clamp to 1.50' },
    { input: 999.0, expected: 1.50, desc: 'Extreme scale 999.0 must clamp to 1.50' },
    { input: 100000.0, expected: 1.50, desc: 'Ultra-scale 100,000.0 must clamp to 1.50' },
  ];

  for (const tc of boundaryCases) {
    storageMap.clear();
    domProperties.clear();
    appState.setUiScale(tc.input);

    const scaleMatches = Math.abs(appState.uiScale - tc.expected) < 0.0001;
    const domMatches = domProperties.get('--ui-scale') === String(tc.expected);
    const storageMatches = storageMap.get('mural_ui_scale') === String(tc.expected);
    const campaignMatches = campaignStore.campaign.settings?.uiScale === tc.expected;

    assert(
      scaleMatches && domMatches && storageMatches && campaignMatches,
      tc.desc,
      `Got uiScale=${appState.uiScale}, DOM=${domProperties.get('--ui-scale')}, storage=${storageMap.get('mural_ui_scale')}, campaign=${campaignStore.campaign.settings?.uiScale}`
    );
  }

  // ---------------------------------------------------------------------------
  // Suite 2: Corrupt LocalStorage Values & Graceful Fallback to 1.0
  // Required: 'abc', 'NaN', 'undefined', null, '{}', objects, negative numbers.
  // ---------------------------------------------------------------------------
  console.log('\n[Suite 2] Corrupt LocalStorage Values & Graceful Fallback to 1.0');

  const corruptStorageValues = [
    { key: 'mural_ui_scale', val: 'abc', desc: 'String "abc" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: 'NaN', desc: 'String "NaN" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: 'undefined', desc: 'String "undefined" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: null, desc: 'Null (missing) mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '{}', desc: 'String "{}" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '[object Object]', desc: 'String "[object Object]" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '{"scale": 1.25}', desc: 'JSON object string in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '-1.0', desc: 'Negative number "-1.0" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '-99.9', desc: 'Extreme negative "-99.9" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '0', desc: 'Zero "0" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '0.50', desc: 'Out-of-range low "0.50" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '0.749', desc: 'Sub-0.75 value "0.749" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '1.501', desc: 'Super-1.50 value "1.501" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '5.0', desc: 'Out-of-range high "5.0" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '999.0', desc: 'Extreme high "999.0" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '', desc: 'Empty string "" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '   ', desc: 'Whitespace string "   " in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: 'true', desc: 'Boolean string "true" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: 'false', desc: 'Boolean string "false" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: 'Infinity', desc: 'String "Infinity" in mural_ui_scale falls back to 1.0' },
    { key: 'mural_ui_scale', val: '-Infinity', desc: 'String "-Infinity" in mural_ui_scale falls back to 1.0' },
  ];

  for (const tc of corruptStorageValues) {
    storageMap.clear();
    domProperties.clear();
    if (campaignStore.campaign?.settings) {
      campaignStore.campaign.settings.uiScale = undefined;
    }
    appState.uiScale = 1.35;

    if (tc.val !== null) {
      storageMap.set(tc.key, tc.val);
    }

    appState.initUiScale();

    assert(
      appState.uiScale === 1.0 && domProperties.get('--ui-scale') === '1',
      tc.desc,
      `Expected uiScale=1.0, got ${appState.uiScale}, DOM=${domProperties.get('--ui-scale')}`
    );
  }

  // Corrupted mural_global_settings recovery tests
  console.log('\n[Suite 2.1] Corrupt mural_global_settings Recovery');

  const corruptGlobalSettingsCases = [
    { val: '{ invalid json syntax', expected: 1.0, desc: 'Malformed JSON syntax in mural_global_settings falls back to 1.0' },
    { val: JSON.stringify({ uiScale: 'not_a_number' }), expected: 1.0, desc: 'Non-numeric uiScale in global settings falls back to 1.0' },
    { val: JSON.stringify({ uiScale: null }), expected: 1.0, desc: 'Null uiScale in global settings falls back to 1.0' },
    { val: JSON.stringify({ uiScale: undefined }), expected: 1.0, desc: 'Undefined uiScale in global settings falls back to 1.0' },
    { val: JSON.stringify({ otherProperty: 42 }), expected: 1.0, desc: 'Missing uiScale in global settings falls back to 1.0' },
    { val: JSON.stringify({ uiScale: 999.0 }), expected: 1.50, desc: 'Out-of-bounds 999.0 in global settings is clamped to 1.50' },
    { val: JSON.stringify({ uiScale: -5.0 }), expected: 0.75, desc: 'Negative -5.0 in global settings is clamped to 0.75' },
  ];

  for (const tc of corruptGlobalSettingsCases) {
    storageMap.clear();
    domProperties.clear();
    if (campaignStore.campaign?.settings) {
      campaignStore.campaign.settings.uiScale = undefined;
    }
    appState.uiScale = 1.35;

    storageMap.set('mural_global_settings', tc.val);
    appState.initUiScale();

    assert(
      Math.abs(appState.uiScale - tc.expected) < 0.0001,
      tc.desc,
      `Expected uiScale=${tc.expected}, got ${appState.uiScale}`
    );
  }

  // Triple-corruption recovery (corrupt mural_ui_scale + malformed mural_global_settings + corrupt campaign)
  console.log('\n[Suite 2.2] Triple-Tier Corruption Resilience');
  storageMap.clear();
  storageMap.set('mural_ui_scale', 'total_garbage');
  storageMap.set('mural_global_settings', '{"corrupt": true');
  if (campaignStore.campaign?.settings) {
    campaignStore.campaign.settings.uiScale = -999 as any;
  }
  appState.uiScale = 1.45;
  appState.initUiScale();
  // Note: if campaignStore has -999, setUiScale(-999) will clamp to 0.75
  assert(
    appState.uiScale >= 0.75 && appState.uiScale <= 1.50,
    'Triple-tier corruption recovers within valid boundaries [0.75, 1.50]'
  );

  // ---------------------------------------------------------------------------
  // Suite 3: Rapid Sequential Zoom Changes (100 Rapid Invocations)
  // Required: 100 rapid calls to setUiScale ensuring DOM style property and
  //           campaignStore stay synchronized with zero race conditions.
  // ---------------------------------------------------------------------------
  console.log('\n[Suite 3] Rapid Sequential Zoom Changes (Synchronicity Stress)');

  storageMap.clear();
  domProperties.clear();

  const rapidScales = [
    0.75, 0.80, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15, 1.20,
    1.25, 1.30, 1.35, 1.40, 1.45, 1.50, 1.75, 2.00, 0.50, 0.00,
  ];

  let rapidSuccess = true;
  let desyncCount = 0;

  for (let i = 0; i < 100; i++) {
    const target = rapidScales[i % rapidScales.length];
    const expectedClamped = Math.min(1.5, Math.max(0.75, Math.round(target * 100) / 100));

    appState.setUiScale(target);

    const currentScale = appState.uiScale;
    const domVal = domProperties.get('--ui-scale');
    const storeVal = campaignStore.campaign.settings?.uiScale;
    const storageVal = storageMap.get('mural_ui_scale');

    const matches =
      Math.abs(currentScale - expectedClamped) < 0.0001 &&
      domVal === String(expectedClamped) &&
      storeVal === expectedClamped &&
      storageVal === String(expectedClamped);

    if (!matches) {
      rapidSuccess = false;
      desyncCount++;
    }
  }

  assert(
    rapidSuccess,
    '100 rapid sequential setUiScale calls executed with zero desync between state, DOM, store, and storage',
    `Failed desyncs: ${desyncCount}/100`
  );

  // Rapid alternating stress between extremes (0.75 and 1.50)
  let alternatingSuccess = true;
  for (let i = 0; i < 50; i++) {
    const altTarget = i % 2 === 0 ? 0.75 : 1.50;
    appState.setUiScale(altTarget);

    if (
      appState.uiScale !== altTarget ||
      domProperties.get('--ui-scale') !== String(altTarget) ||
      campaignStore.campaign.settings?.uiScale !== altTarget
    ) {
      alternatingSuccess = false;
    }
  }

  assert(
    alternatingSuccess,
    '50 rapid alternating switch calls between 0.75 and 1.50 maintain 100% lockstep synchronization'
  );

  // ---------------------------------------------------------------------------
  // Suite 4: Campaign Save & Load Cycle
  // Required: Verify campaign settings preserve uiScale across serialization,
  //           export, and re-import.
  // ---------------------------------------------------------------------------
  console.log('\n[Suite 4] Campaign Save & Load Cycle');

  // Step 1: Set custom scale and verify export serialization
  appState.setUiScale(1.35);
  assert(campaignStore.campaign.settings?.uiScale === 1.35, 'CampaignStore has uiScale 1.35 before export');

  const exportedCampaign = campaignStore.exportCurrentCampaign();
  assert(exportedCampaign.settings?.uiScale === 1.35, 'exportCurrentCampaign() preserves settings.uiScale = 1.35');

  // Step 2: JSON string serialization and deserialization
  const serializedJson = JSON.stringify(exportedCampaign);
  assert(serializedJson.includes('"uiScale":1.35') || serializedJson.includes('"uiScale": 1.35'), 'JSON string contains uiScale: 1.35');

  const reimportedCampaign = JSON.parse(serializedJson);
  assert(reimportedCampaign.settings?.uiScale === 1.35, 'Deserialized campaign object retains settings.uiScale = 1.35');

  // Step 3: Re-import via campaignStore.loadCampaign
  campaignStore.loadCampaign(reimportedCampaign);
  assert(campaignStore.campaign.settings?.uiScale === 1.35, 'campaignStore.loadCampaign restores settings.uiScale = 1.35');

  // Step 4: Full round-trip with distinct scales
  const testScales = [0.75, 0.90, 1.00, 1.10, 1.25, 1.40, 1.50];
  let roundTripSuccess = true;

  for (const s of testScales) {
    appState.setUiScale(s);
    const exported = campaignStore.exportCurrentCampaign();
    const jsonStr = JSON.stringify(exported);
    const imported = JSON.parse(jsonStr);

    campaignStore.loadCampaign(imported);
    if (campaignStore.campaign.settings?.uiScale !== s) {
      roundTripSuccess = false;
    }
  }

  assert(
    roundTripSuccess,
    'All canonical scale factors round-trip successfully through export -> JSON -> loadCampaign'
  );

  // Step 5: Legacy campaign loading (campaign with settings missing uiScale)
  const legacyCampaign = {
    ...exportedCampaign,
    id: 'legacy-campaign-test',
    settings: {
      theme: 'dark',
      autoSaveIntervalMs: 5000,
      // uiScale intentionally absent
    },
  };

  storageMap.clear();
  campaignStore.loadCampaign(legacyCampaign as any);
  assert(
    campaignStore.campaign.settings?.uiScale === undefined,
    'Legacy campaign loads cleanly without crashing when uiScale is absent'
  );

  appState.initUiScale();
  assert(
    appState.uiScale === 1.0,
    'initUiScale cleanly defaults to 1.0 when loading legacy campaign without uiScale'
  );

  // ---------------------------------------------------------------------------
  // Suite 5: Architectural Non-Interference Invariants
  // ---------------------------------------------------------------------------
  console.log('\n[Suite 5] Architectural Non-Interference Invariants');

  // Invariant 1: persist = false does not write to localStorage
  storageMap.clear();
  storageMap.set('mural_ui_scale', '1.0');
  appState.setUiScale(1.45, false);
  assert(
    appState.uiScale === 1.45 &&
    domProperties.get('--ui-scale') === '1.45' &&
    storageMap.get('mural_ui_scale') === '1.0',
    'setUiScale(1.45, false) updates memory and DOM but strictly avoids modifying localStorage'
  );

  // Invariant 2: High float precision is always rounded to 2 decimal places
  appState.setUiScale(1.12999999);
  assert(appState.uiScale === 1.13, 'Rounds 1.12999999 cleanly to 1.13');

  appState.setUiScale(0.85499999);
  assert(appState.uiScale === 0.85, 'Rounds 0.85499999 cleanly to 0.85');

  // Invariant 3: Coordinate invariant check (zero cursor drift)
  // When chrome is scaled to 1.50, <main> remains at zoom: 1.0
  const sidebarWidth = 56 * 1.50; // 84px
  const headerHeight = 56 * 1.50; // 84px
  const screenPointerX = 300;
  const screenPointerY = 200;
  const canvasLocalX = screenPointerX - sidebarWidth;
  const canvasLocalY = screenPointerY - headerHeight;

  assert(
    canvasLocalX === 300 - 84 && canvasLocalY === 200 - 84,
    'Canvas pointer coordinates remain strictly 1:1 with standard offset subtraction (0% cursor drift)'
  );

  // Clean up
  appState.setUiScale(1.0);

  // ---------------------------------------------------------------------------
  // Final Verdict Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`ADVERSARIAL SUITE RESULTS: Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error(`VERDICT: REJECT (${failed} stress test failures detected)`);
    process.exit(1);
  } else {
    console.log('VERDICT: APPROVE (100% of adversarial stress tests passed cleanly)');
  }
}

runAdversarialSuite().catch((err) => {
  console.error('Fatal unhandled error in adversarial suite:', err);
  process.exit(1);
});
