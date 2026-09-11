// tests/unit/challenger2_m3_iter2_stress.test.ts
// Empirical Adversarial Stress & Robustness Test Suite
// Authored by Challenger 2 for Mural Milestone 3 Iteration 2 (Requirement R1)

// ---------------------------------------------------------------------------
// Mock Environment Setup
// ---------------------------------------------------------------------------
const storageMap = new Map<string, string>();
let storageShouldThrowGet = false;
let storageShouldThrowSet = false;

(globalThis as any).localStorage = {
  getItem: (key: string) => {
    if (storageShouldThrowGet) {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    }
    return storageMap.get(key) || null;
  },
  setItem: (key: string, val: string) => {
    if (storageShouldThrowSet) {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    }
    storageMap.set(key, String(val));
  },
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
  (globalThis as any).$effect = (_fn: any) => {};
}

async function runChallenger2Suite() {
  const { appState } = await import('../../src/lib/stores/appState.svelte');
  const { campaignStore } = await import('../../src/lib/stores/campaignStore.svelte');

  console.log('========================================================================');
  console.log('  CHALLENGER 2: EMPIRICAL BOUNDARY, CORRUPTION & PERSISTENCE STRESS');
  console.log('========================================================================\n');

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
  // Challenge 1: Precision Float & Epsilon Boundary Clamping
  // ---------------------------------------------------------------------------
  console.log('[Challenge 1] Precision Float & Machine Epsilon Boundary Stress');

  const epsilonCases = [
    { input: 0.75 - Number.EPSILON, expected: 0.75, desc: '0.75 - Number.EPSILON rounds/clamps to 0.75' },
    { input: 0.75 + Number.EPSILON, expected: 0.75, desc: '0.75 + Number.EPSILON rounds/clamps to 0.75' },
    { input: 1.50 - Number.EPSILON, expected: 1.50, desc: '1.50 - Number.EPSILON rounds/clamps to 1.50' },
    { input: 1.50 + Number.EPSILON, expected: 1.50, desc: '1.50 + Number.EPSILON rounds/clamps to 1.50' },
    { input: 0.749999999999999, expected: 0.75, desc: 'Sub-epsilon boundary 0.749999999999999 rounds to 0.75' },
    { input: 1.500000000000001, expected: 1.50, desc: 'Super-epsilon boundary 1.500000000000001 rounds to 1.50' },
    { input: 0.744999999999999, expected: 0.75, desc: '0.744999 rounds to 0.74 then clamps to 0.75' },
    { input: 1.505000000000001, expected: 1.50, desc: '1.505000 rounds to 1.51 then clamps to 1.50' },
    { input: -0, expected: 0.75, desc: 'Negative zero (-0) clamps to 0.75' },
    { input: 0, expected: 0.75, desc: 'Positive zero (+0) clamps to 0.75' },
    { input: Number.MIN_VALUE, expected: 0.75, desc: 'Number.MIN_VALUE (5e-324) clamps to 0.75' },
    { input: Number.MAX_VALUE, expected: 1.50, desc: 'Number.MAX_VALUE clamps to 1.50' },
    { input: Number.MAX_SAFE_INTEGER, expected: 1.50, desc: 'Number.MAX_SAFE_INTEGER clamps to 1.50' },
    { input: Number.MIN_SAFE_INTEGER, expected: 0.75, desc: 'Number.MIN_SAFE_INTEGER clamps to 0.75' },
    { input: Infinity, expected: 1.50, desc: 'Positive Infinity clamps to 1.50' },
    { input: -Infinity, expected: 0.75, desc: 'Negative -Infinity clamps to 0.75' },
  ];

  for (const tc of epsilonCases) {
    storageMap.clear();
    domProperties.clear();
    appState.setUiScale(tc.input);

    const ok =
      Math.abs(appState.uiScale - tc.expected) < 0.0001 &&
      domProperties.get('--ui-scale') === String(tc.expected) &&
      storageMap.get('mural_ui_scale') === String(tc.expected) &&
      campaignStore.campaign.settings?.uiScale === tc.expected;

    assert(
      ok,
      tc.desc,
      `Got uiScale=${appState.uiScale}, DOM=${domProperties.get('--ui-scale')}, storage=${storageMap.get('mural_ui_scale')}`
    );
  }

  // ---------------------------------------------------------------------------
  // Challenge 2: Storage Exception Resilience (DOMException, QuotaExceeded, SecurityError)
  // ---------------------------------------------------------------------------
  console.log('\n[Challenge 2] Storage Exception & Private Browsing Resilience');

  // Test 2.1: localStorage.getItem throws SecurityError (private browsing)
  storageShouldThrowGet = true;
  appState.uiScale = 1.35;
  try {
    appState.initUiScale();
    assert(
      appState.uiScale === 1.0,
      'initUiScale gracefully catches SecurityError from getItem and defaults to 1.0 without unhandled crash'
    );
  } catch (err: any) {
    assert(false, 'initUiScale unhandled throw on SecurityError', err.message);
  } finally {
    storageShouldThrowGet = false;
  }

  // Test 2.2: localStorage.setItem throws QuotaExceededError
  storageShouldThrowSet = true;
  try {
    appState.setUiScale(1.25);
    assert(
      appState.uiScale === 1.25 &&
      domProperties.get('--ui-scale') === '1.25' &&
      campaignStore.campaign.settings?.uiScale === 1.25,
      'setUiScale gracefully catches QuotaExceededError and maintains state, DOM, and campaignStore'
    );
  } catch (err: any) {
    assert(false, 'setUiScale unhandled throw on QuotaExceededError', err.message);
  } finally {
    storageShouldThrowSet = false;
  }

  // ---------------------------------------------------------------------------
  // Challenge 3: Advanced Storage Corruption & Adversarial Injections
  // ---------------------------------------------------------------------------
  console.log('\n[Challenge 3] Advanced Storage Corruption & Adversarial Injections');

  const advancedCorruptCases = [
    {
      key: 'mural_ui_scale',
      val: '\u0000\u001F\u007F',
      desc: 'Control characters in mural_ui_scale recover to 1.0',
    },
    {
      key: 'mural_ui_scale',
      val: '1.25e2', // 125 -> out of bounds
      desc: 'Exponential scientific notation "1.25e2" (125.0) in mural_ui_scale recovers to 1.0',
    },
    {
      key: 'mural_ui_scale',
      val: '0x10', // Hex 16 -> out of bounds
      desc: 'Hex string "0x10" in mural_ui_scale recovers to 1.0',
    },
    {
      key: 'mural_ui_scale',
      val: '1.25; DROP TABLE settings;--',
      desc: 'SQL-injection-like string recovers to 1.25 if parseFloat succeeds or 1.0',
      customCheck: (scale: number) => scale === 1.25 || scale === 1.0,
    },
    {
      key: 'mural_ui_scale',
      val: '<script>alert(1)</script>',
      desc: 'XSS script injection string in mural_ui_scale recovers to 1.0',
    },
    {
      key: 'mural_global_settings',
      val: '{"__proto__": {"uiScale": 999}}',
      desc: 'Prototype pollution JSON in mural_global_settings recovers to 1.0',
    },
    {
      key: 'mural_global_settings',
      val: '[1.25, 1.50]',
      desc: 'JSON array in mural_global_settings recovers to 1.0 without crash',
    },
    {
      key: 'mural_global_settings',
      val: '"1.25"',
      desc: 'JSON primitive string in mural_global_settings recovers to 1.0',
    },
    {
      key: 'mural_global_settings',
      val: 'null',
      desc: 'JSON literal "null" in mural_global_settings recovers to 1.0',
    },
    {
      key: 'mural_global_settings',
      val: 'true',
      desc: 'JSON literal "true" in mural_global_settings recovers to 1.0',
    },
    {
      key: 'mural_global_settings',
      val: '12345',
      desc: 'JSON literal number "12345" in mural_global_settings recovers to 1.0',
    },
  ];

  for (const tc of advancedCorruptCases) {
    storageMap.clear();
    domProperties.clear();
    if (campaignStore.campaign?.settings) {
      campaignStore.campaign.settings.uiScale = undefined;
    }
    appState.uiScale = 1.45;

    storageMap.set(tc.key, tc.val);
    appState.initUiScale();

    if (tc.customCheck) {
      assert(tc.customCheck(appState.uiScale), tc.desc, `Got uiScale=${appState.uiScale}`);
    } else {
      assert(
        appState.uiScale === 1.0 && domProperties.get('--ui-scale') === '1',
        tc.desc,
        `Expected 1.0, got ${appState.uiScale}, DOM=${domProperties.get('--ui-scale')}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Challenge 4: Massive Rapid-Toggle & Stress Loop (10,000 Iterations)
  // ---------------------------------------------------------------------------
  console.log('\n[Challenge 4] Massive Rapid-Toggle & Stress Loop (10,000 Invocations)');

  storageMap.clear();
  domProperties.clear();

  const fuzzInputs = [
    -500, -1, 0, 0.74, 0.75, 0.82, 0.90, 0.999, 1.00, 1.05,
    1.12345, 1.25, 1.333333, 1.49, 1.50, 1.51, 2.0, 100,
  ];

  let stressOk = true;
  let maxDrift = 0;

  for (let i = 0; i < 10000; i++) {
    const rawVal = fuzzInputs[i % fuzzInputs.length];
    const rounded = Math.round(rawVal * 100) / 100;
    const expected = Math.min(1.50, Math.max(0.75, rounded));

    appState.setUiScale(rawVal);

    const current = appState.uiScale;
    const domVal = domProperties.get('--ui-scale');
    const storeVal = campaignStore.campaign.settings?.uiScale;
    const storageVal = storageMap.get('mural_ui_scale');

    const drift = Math.abs(current - expected);
    if (drift > maxDrift) maxDrift = drift;

    if (
      drift > 0.0001 ||
      domVal !== String(expected) ||
      storeVal !== expected ||
      storageVal !== String(expected)
    ) {
      stressOk = false;
      console.error(`Desync at iteration ${i}:`, { rawVal, expected, current, domVal, storeVal, storageVal });
      break;
    }
  }

  assert(
    stressOk && maxDrift < 0.0001,
    `10,000 rapid sequential setUiScale invocations executed with zero desynchronization (max drift: ${maxDrift})`
  );

  // ---------------------------------------------------------------------------
  // Challenge 5: Precedence & Priority Invariants
  // ---------------------------------------------------------------------------
  console.log('\n[Challenge 5] Precedence & Priority Invariants');

  // Priority Rule 1: Local user preference in localStorage takes precedence over campaign settings
  storageMap.clear();
  storageMap.set('mural_ui_scale', '1.25');
  if (!campaignStore.campaign.settings) campaignStore.campaign.settings = {};
  campaignStore.campaign.settings.uiScale = 0.85;

  appState.initUiScale();
  assert(
    appState.uiScale === 1.25,
    'Priority: localStorage mural_ui_scale (1.25) takes precedence over campaign settings (0.85)'
  );

  // Priority Rule 2: When mural_ui_scale is missing, mural_global_settings takes precedence over campaign
  storageMap.clear();
  storageMap.set('mural_global_settings', JSON.stringify({ uiScale: 1.15 }));
  campaignStore.campaign.settings.uiScale = 0.85;

  appState.initUiScale();
  assert(
    appState.uiScale === 1.15,
    'Priority: mural_global_settings (1.15) takes precedence over campaign settings (0.85)'
  );

  // Priority Rule 3: When no local storage override exists, campaign settings are adopted without writing to storage
  storageMap.clear();
  campaignStore.campaign.settings.uiScale = 0.90;

  appState.initUiScale();
  assert(
    appState.uiScale === 0.90 && storageMap.get('mural_ui_scale') === undefined,
    'Priority: When no storage override exists, campaign settings (0.90) are adopted without persisting to localStorage'
  );

  // ---------------------------------------------------------------------------
  // Challenge 6: Campaign Store Lifecycle & Undefined Object Defense
  // ---------------------------------------------------------------------------
  console.log('\n[Challenge 6] Campaign Store Lifecycle & Undefined Object Defense');

  // Test: setUiScale when campaignStore.campaign.settings is undefined
  delete (campaignStore.campaign as any).settings;
  appState.setUiScale(1.10);
  assert(
    campaignStore.campaign.settings?.uiScale === 1.10,
    'setUiScale initializes campaign.settings object when undefined and assigns uiScale'
  );

  // Test: setUiScale when persist is false leaves storage untouched
  storageMap.set('mural_ui_scale', '1.0');
  appState.setUiScale(1.40, false);
  assert(
    appState.uiScale === 1.40 && storageMap.get('mural_ui_scale') === '1.0',
    'setUiScale(1.40, false) updates memory state but leaves storageMap at 1.0'
  );

  // Restore baseline
  appState.setUiScale(1.0);

  // ---------------------------------------------------------------------------
  // Final Summary
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`CHALLENGER 2 SUITE RESULTS: Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    console.error(`VERDICT: REJECT (${failed} empirical failures detected)`);
    process.exit(1);
  } else {
    console.log('VERDICT: APPROVE (100% of empirical boundary & persistence challenges passed)');
  }
}

runChallenger2Suite().catch((err) => {
  console.error('Fatal unhandled error in challenger suite:', err);
  process.exit(1);
});
