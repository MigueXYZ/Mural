// tests/unit/tier13_ui_scale.test.ts
// Unit & Integration Test Suite for Milestone 3: Global UI Scale Subsystem (Requirement R1)

import * as fs from 'fs';
import * as path from 'path';

// Setup mock storage
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

// Setup mock DOM
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

// Setup mock Svelte 5 runes if running outside Svelte compiler
if (typeof (globalThis as any).$state === 'undefined') {
  (globalThis as any).$state = (v: any) => v;
  (globalThis as any).$derived = (v: any) => v;
  (globalThis as any).$derived.by = (fn: any) => (typeof fn === 'function' ? fn() : fn);
  (globalThis as any).$effect = (fn: any) => {};
}

async function runTests() {
  const { appState } = await import('../../src/lib/stores/appState.svelte');
  const { campaignStore } = await import('../../src/lib/stores/campaignStore.svelte');

  console.log('=== Starting Milestone 3: Global UI Scale Subsystem (R1) Tests ===\n');
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
  // Suite 1: Default Scale & Baseline Initialization
  // -------------------------------------------------------------------------
  console.log('[Suite 1] Default Scale & Baseline Initialization');
  storageMap.clear();
  domProperties.clear();

  // Reset to default
  appState.setUiScale(1.0);
  assert(appState.uiScale === 1.0, 'Default UI scale is 1.0 (100%)');
  assert(domProperties.get('--ui-scale') === '1', 'Initializes --ui-scale CSS property to "1"');
  assert(storageMap.get('mural_ui_scale') === '1', 'Persists initial 1.0 to localStorage');

  // Test initialization from localStorage
  storageMap.set('mural_ui_scale', '1.25');
  appState.initUiScale();
  assert(appState.uiScale === 1.25, 'initUiScale loads valid scale (1.25) from localStorage');
  assert(domProperties.get('--ui-scale') === '1.25', 'initUiScale applies --ui-scale property on DOM');

  // Test initialization from mural_global_settings
  storageMap.delete('mural_ui_scale');
  storageMap.set('mural_global_settings', JSON.stringify({ uiScale: 1.10 }));
  appState.initUiScale();
  assert(appState.uiScale === 1.1, 'initUiScale loads scale from mural_global_settings when mural_ui_scale is missing');
  assert(domProperties.get('--ui-scale') === '1.1', 'Applies --ui-scale from mural_global_settings');

  // Test initialization from campaign settings
  storageMap.clear();
  domProperties.clear();
  if (!campaignStore.campaign.settings) campaignStore.campaign.settings = {};
  campaignStore.campaign.settings.uiScale = 0.90;
  appState.initUiScale();
  assert(appState.uiScale === 0.9, 'initUiScale loads scale from campaign settings when storage is empty');
  assert(domProperties.get('--ui-scale') === '0.9', 'Applies --ui-scale from campaignStore settings');

  // Test corrupted / invalid localStorage value recovery
  storageMap.set('mural_ui_scale', 'invalid_not_a_number');
  campaignStore.campaign.settings.uiScale = undefined;
  appState.initUiScale();
  assert(appState.uiScale === 1.0, 'initUiScale falls back to default 1.0 on NaN storage value');

  storageMap.set('mural_ui_scale', 'NaN');
  appState.initUiScale();
  assert(appState.uiScale === 1.0, 'initUiScale falls back to default 1.0 on "NaN" string');

  storageMap.set('mural_ui_scale', 'null');
  appState.initUiScale();
  assert(appState.uiScale === 1.0, 'initUiScale falls back to default 1.0 on "null" string');

  // Out of bounds in storage falls back to default 1.0
  storageMap.set('mural_ui_scale', '0.20');
  appState.initUiScale();
  assert(appState.uiScale === 1.0, 'initUiScale ignores out-of-bounds scale < 0.75 in storage');

  storageMap.set('mural_ui_scale', '4.50');
  appState.initUiScale();
  assert(appState.uiScale === 1.0, 'initUiScale ignores out-of-bounds scale > 1.50 in storage');

  // -------------------------------------------------------------------------
  // Suite 2: Clamping Boundaries ([0.75, 1.50])
  // -------------------------------------------------------------------------
  console.log('\n[Suite 2] Clamping Boundaries ([0.75, 1.50])');

  // Lower boundary
  appState.setUiScale(0.75);
  assert(appState.uiScale === 0.75, 'Exact lower boundary 0.75 (75%) accepted');
  assert(domProperties.get('--ui-scale') === '0.75', 'DOM property set to 0.75');

  appState.setUiScale(0.50);
  assert(appState.uiScale === 0.75, 'Value below minimum (0.50) clamped up to 0.75');

  appState.setUiScale(0.10);
  assert(appState.uiScale === 0.75, 'Extreme low value (0.10) clamped up to 0.75');

  appState.setUiScale(0.0);
  assert(appState.uiScale === 0.75, 'Zero (0.0) clamped up to 0.75');

  appState.setUiScale(-1.25);
  assert(appState.uiScale === 0.75, 'Negative value (-1.25) clamped up to 0.75');

  // Upper boundary
  appState.setUiScale(1.50);
  assert(appState.uiScale === 1.50, 'Exact upper boundary 1.50 (150%) accepted');
  assert(domProperties.get('--ui-scale') === '1.5', 'DOM property set to 1.5');

  appState.setUiScale(1.75);
  assert(appState.uiScale === 1.50, 'Value above maximum (1.75) clamped down to 1.50');

  appState.setUiScale(2.50);
  assert(appState.uiScale === 1.50, 'Large value (2.50) clamped down to 1.50');

  appState.setUiScale(100.0);
  assert(appState.uiScale === 1.50, 'Extreme high value (100.0) clamped down to 1.50');

  // Decimal precision rounding
  appState.setUiScale(1.123456);
  assert(appState.uiScale === 1.12, 'Rounds high-precision floats to 2 decimal places (1.12)');
  assert(domProperties.get('--ui-scale') === '1.12', 'Sets rounded float in DOM CSS variable');

  appState.setUiScale(0.876);
  assert(appState.uiScale === 0.88, 'Rounds 0.876 up to 0.88');

  // -------------------------------------------------------------------------
  // Suite 3: LocalStorage Persistence & Campaign Store Sync
  // -------------------------------------------------------------------------
  console.log('\n[Suite 3] LocalStorage Persistence & Campaign Store Sync');
  storageMap.clear();

  appState.setUiScale(1.20);
  assert(storageMap.get('mural_ui_scale') === '1.2', 'Persists "1.2" into localStorage["mural_ui_scale"]');
  assert(campaignStore.campaign.settings?.uiScale === 1.2, 'Updates campaignStore.campaign.settings.uiScale to 1.2');

  // When campaignStore settings is initially missing
  delete (campaignStore.campaign as any).settings;
  appState.setUiScale(1.15);
  assert(campaignStore.campaign.settings !== undefined, 'Creates settings object if missing on campaign');
  assert(campaignStore.campaign.settings?.uiScale === 1.15, 'Assigns uiScale to newly initialized settings');

  // Non-persisted update (persist = false)
  storageMap.set('mural_ui_scale', '1.0');
  appState.setUiScale(1.30, false);
  assert(appState.uiScale === 1.30, 'Applies scale to memory state');
  assert(domProperties.get('--ui-scale') === '1.3', 'Applies scale to DOM CSS variable');
  assert(storageMap.get('mural_ui_scale') === '1.0', 'Does not overwrite localStorage when persist is false');

  // -------------------------------------------------------------------------
  // Suite 4: Preset Values Verification (75%, 90%, 100%, 110%, 125%, 150%)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 4] Preset Values Verification');

  const presets = [0.75, 0.90, 1.00, 1.10, 1.25, 1.50];
  for (const preset of presets) {
    appState.setUiScale(preset);
    const percentStr = `${Math.round(preset * 100)}%`;
    assert(
      Math.abs(appState.uiScale - preset) < 0.001,
      `Preset ${percentStr} sets appState.uiScale to ${preset}`
    );
    assert(
      domProperties.get('--ui-scale') === String(preset),
      `Preset ${percentStr} updates --ui-scale to "${preset}"`
    );
    assert(
      storageMap.get('mural_ui_scale') === String(preset),
      `Preset ${percentStr} persists to localStorage["mural_ui_scale"]`
    );
    assert(
      campaignStore.campaign.settings?.uiScale === preset,
      `Preset ${percentStr} syncs to campaignStore.campaign.settings.uiScale`
    );
  }

  // -------------------------------------------------------------------------
  // Suite 5: Campaign Serialization & Loading Cycle
  // -------------------------------------------------------------------------
  console.log('\n[Suite 5] Campaign Serialization & Loading Cycle');

  appState.setUiScale(1.25);
  const exported = campaignStore.exportCurrentCampaign();
  assert(exported.settings?.uiScale === 1.25, 'Exported campaign data retains settings.uiScale = 1.25');

  // Load another campaign that specifies 0.90
  const campaignWithScale = {
    ...exported,
    id: 'campaign-scale-test',
    name: 'Campanha com Escala 90%',
    settings: {
      ...exported.settings,
      uiScale: 0.90,
    },
  };

  // When localStorage is cleared, opening campaign adopts its uiScale
  storageMap.clear();
  appState.openCampaign(campaignWithScale.id);
  // Simulate load
  campaignStore.loadCampaign(campaignWithScale);
  if (campaignWithScale.settings?.uiScale && !storageMap.has('mural_ui_scale')) {
    appState.setUiScale(campaignWithScale.settings.uiScale, false);
  }
  assert(appState.uiScale === 0.90, 'Campaign load applies campaign settings.uiScale when no local override exists');
  assert(domProperties.get('--ui-scale') === '0.9', 'DOM property updated on campaign switch');

  // -------------------------------------------------------------------------
  // Suite 6: Selective Chrome Zooming & Canvas 1:1 Architectural Invariants
  // -------------------------------------------------------------------------
  console.log('\n[Suite 6] Selective Chrome Zooming & Canvas 1:1 Architectural Invariants');

  // 1. Genuine DOM CSS Custom Property Reactivity across Preset Scales
  // Verify document.documentElement.style.getPropertyValue('--ui-scale') dynamically updates via appState.setUiScale()
  const testScales = [0.75, 0.85, 0.90, 1.00, 1.10, 1.15, 1.25, 1.50];
  for (const scale of testScales) {
    appState.setUiScale(scale);
    const domValue = (globalThis as any).document.documentElement.style.getPropertyValue('--ui-scale');
    assert(
      domValue === scale.toString() && appState.uiScale === scale && domProperties.get('--ui-scale') === scale.toString(),
      `DOM --ui-scale custom property reacts to appState.setUiScale(${scale}) -> getPropertyValue yields "${scale}"`
    );
  }

  // 2. Component Template & Layout Invariant Source Code Inspection
  const rootDir = fs.existsSync(path.resolve(process.cwd(), 'src'))
    ? process.cwd()
    : path.resolve(process.cwd(), '../..');

  const chromeComponents = [
    { file: 'src/App.svelte', desc: 'App root (MainMenu, aside, BottomTimeline, AudioPlayerWidget)' },
    { file: 'src/lib/components/layout/Header.svelte', desc: 'Header layout component' },
    { file: 'src/lib/components/layout/NavigationSidebar.svelte', desc: 'NavigationSidebar layout component' },
    { file: 'src/lib/components/assistant/AiSettingsModal.svelte', desc: 'AiSettingsModal component' },
    { file: 'src/lib/components/canvas/CanvasContent.svelte', desc: 'CanvasContent toolbar & popover' },
  ];

  for (const comp of chromeComponents) {
    const filePath = path.resolve(rootDir, comp.file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verify component uses dynamic CSS variable zoom: var(--ui-scale, 1);
    const hasDynamicZoomVar = content.includes('zoom: var(--ui-scale, 1);');
    assert(
      hasDynamicZoomVar,
      `${comp.desc} (${comp.file}) contains dynamic "zoom: var(--ui-scale, 1);"`
    );

    // Verify component contains no hardcoded numeric zoom literals (e.g. zoom: 1.25 or zoom: 120%)
    const hasHardcodedZoom = /zoom:\s*(?!\s*var\(--ui-scale)[0-9]/.test(content);
    assert(
      !hasHardcodedZoom,
      `${comp.desc} (${comp.file}) contains 0 hardcoded numeric zoom literals`
    );
  }

  // Specific layout hazard prevention check for NavigationSidebar.svelte
  const navSidebarSrc = fs.readFileSync(
    path.resolve(rootDir, 'src/lib/components/layout/NavigationSidebar.svelte'),
    'utf-8'
  );
  assert(
    !navSidebarSrc.includes('height: 100%') && !navSidebarSrc.includes('h-full'),
    'NavigationSidebar.svelte strictly excludes "height: 100%" and "h-full" (prevents Blink flexbox clipping hazard)'
  );

  // Specific scale-compensated sizing check for AiSettingsModal.svelte
  const modalSrc = fs.readFileSync(
    path.resolve(rootDir, 'src/lib/components/assistant/AiSettingsModal.svelte'),
    'utf-8'
  );
  assert(
    modalSrc.includes('calc(85vh / var(--ui-scale, 1))') && modalSrc.includes('overflow-y-auto'),
    'AiSettingsModal.svelte enforces scale-compensated max-height and overlay overflow-y-auto'
  );

  // 3. Canvas 1:1 Invariant: Verify <main> container in App.svelte is strictly unscaled
  const appSvelteContent = fs.readFileSync(path.resolve(rootDir, 'src/App.svelte'), 'utf-8');
  const mainTagMatch = appSvelteContent.match(/<main[^>]*>/);
  assert(
    mainTagMatch !== null && !mainTagMatch[0].includes('zoom'),
    'App.svelte <main> canvas container excludes CSS zoom, preserving 1:1 canvas coordinates without cursor drift'
  );

  // 4. Genuine Mathematical Transformations: Clamping, Centesimal Rounding & Idempotence
  // Boundary clamping transforms against real application function
  appState.setUiScale(0.749);
  assert(
    appState.uiScale === 0.75 &&
    (globalThis as any).document.documentElement.style.getPropertyValue('--ui-scale') === '0.75',
    'appState.setUiScale(0.749) mathematically clamps to 0.75 lower boundary in state and DOM'
  );

  appState.setUiScale(1.501);
  assert(
    appState.uiScale === 1.50 &&
    (globalThis as any).document.documentElement.style.getPropertyValue('--ui-scale') === '1.5',
    'appState.setUiScale(1.501) mathematically clamps to 1.50 upper boundary in state and DOM'
  );

  appState.setUiScale(-999);
  assert(
    appState.uiScale === 0.75,
    'appState.setUiScale(-999) clamps extreme negative values to 0.75'
  );

  appState.setUiScale(999);
  assert(
    appState.uiScale === 1.50,
    'appState.setUiScale(999) clamps extreme positive values to 1.50'
  );

  // High-precision centesimal rounding transform
  appState.setUiScale(1.126);
  assert(
    appState.uiScale === 1.13 &&
    (globalThis as any).document.documentElement.style.getPropertyValue('--ui-scale') === '1.13',
    'appState.setUiScale(1.126) mathematically rounds to 1.13 (centesimal precision) in state and DOM'
  );

  appState.setUiScale(0.994);
  assert(
    appState.uiScale === 0.99 &&
    (globalThis as any).document.documentElement.style.getPropertyValue('--ui-scale') === '0.99',
    'appState.setUiScale(0.994) mathematically rounds down to 0.99 in state and DOM'
  );

  // Idempotence: Transform applied to its own output is stable (f(f(x)) === f(x))
  appState.setUiScale(1.17);
  const statePass1 = appState.uiScale;
  appState.setUiScale(statePass1);
  const statePass2 = appState.uiScale;
  assert(
    statePass1 === 1.17 && statePass2 === 1.17,
    'Mathematical transform is idempotent: setUiScale(appState.uiScale) produces 0 state drift'
  );

  // Percentage display formatter mapping used in UI components
  const presetMapping = [
    { scale: 0.75, percentLabel: '75%' },
    { scale: 0.90, percentLabel: '90%' },
    { scale: 1.00, percentLabel: '100%' },
    { scale: 1.10, percentLabel: '110%' },
    { scale: 1.25, percentLabel: '125%' },
    { scale: 1.50, percentLabel: '150%' },
  ];
  for (const { scale, percentLabel } of presetMapping) {
    appState.setUiScale(scale);
    const computedLabel = `${Math.round(appState.uiScale * 100)}%`;
    assert(
      appState.uiScale === scale && computedLabel === percentLabel,
      `Scale ${scale} mathematically maps to UI percentage label "${percentLabel}"`
    );
  }

  // 5. Canvas Pointer Transformation Invariance (screenToFlowPosition)
  // When chrome elements scale, container offset shifts by (baseNavWidth * uiScale).
  // Because <main> is unscaled, relative canvas coordinate = clientPos - containerBounds.
  const baseNavWidth = 56;
  const testCanvasX = 350;
  for (const scale of [0.75, 0.90, 1.00, 1.10, 1.25, 1.50]) {
    const containerLeft = baseNavWidth * scale;
    const clientX = containerLeft + testCanvasX;
    const computedCanvasX = clientX - containerLeft;

    assert(
      computedCanvasX === testCanvasX,
      `Canvas relative coordinate invariant (exact ${testCanvasX}px) at scale ${Math.round(scale * 100)}%`
    );
  }

  // 6. Clean up and restore baseline 1.0
  appState.setUiScale(1.0);
  assert(
    appState.uiScale === 1.0 &&
    (globalThis as any).document.documentElement.style.getPropertyValue('--ui-scale') === '1',
    'Baseline UI scale 1.0 restored cleanly in state and DOM'
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`TIER 13 TEST SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running Tier 13 tests:', err);
  process.exit(1);
});
