/**
 * tests/unit/empirical_challenge_r6.test.ts
 *
 * EMPIRICAL ADVERSARIAL CHALLENGE HARNESS FOR REQUIREMENT R6
 * Recent Colors Swatches in Color Picker (Mural Milestone 1)
 *
 * Challenger 2 Verification Suite
 */

// Setup mock localStorage and Svelte 5 runes for Node test runner
const storageBackend = new Map<string, string>();
let shouldThrowOnGet = false;
let shouldThrowOnSet = false;

const mockLocalStorage = {
  getItem: (key: string) => {
    if (shouldThrowOnGet) throw new Error('Simulated SecurityError / QuotaExceeded on getItem');
    return storageBackend.has(key) ? storageBackend.get(key)! : null;
  },
  setItem: (key: string, val: string) => {
    if (shouldThrowOnSet) throw new Error('Simulated QuotaExceededError on setItem');
    storageBackend.set(key, String(val));
  },
  removeItem: (key: string) => {
    storageBackend.delete(key);
  },
  clear: () => {
    storageBackend.clear();
  },
};

(globalThis as any).localStorage = mockLocalStorage;

if (typeof (globalThis as any).$state === 'undefined') {
  (globalThis as any).$state = (v: any) => v;
  (globalThis as any).$derived = (v: any) => v;
  (globalThis as any).$derived.by = (fn: any) => (typeof fn === 'function' ? fn() : fn);
  (globalThis as any).$effect = (fn: any) => {};
}

async function runEmpiricalChallenge() {
  const {
    RecentColorsStore,
    STORAGE_KEY,
    MAX_RECENT_COLORS,
    DEFAULT_PRESET_COLORS,
    normalizeHex,
    isValidHex,
    recentColors,
    recentColorsStore,
  } = await import('../../src/lib/stores/recentColorsStore.svelte');

  console.log('================================================================');
  console.log(' EMPIRICAL ADVERSARIAL CHALLENGE: REQUIREMENT R6 (RECENT COLORS)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      const msg = `  ✗ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`;
      console.error(msg);
      failed++;
      failures.push(testName);
    }
  }

  // =========================================================================
  // CATEGORY 1: STORE INITIALIZATION WITH & WITHOUT LOCALSTORAGE
  // =========================================================================
  console.log('[Category 1] Initialization with & without localStorage');

  // 1.1 Initialization when localStorage is clean/empty
  storageBackend.clear();
  const cleanStore = new RecentColorsStore();
  assert(
    Array.isArray(cleanStore.colors) && cleanStore.colors.length === 0,
    'Store initializes with empty array when localStorage is empty',
    `got: ${JSON.stringify(cleanStore.colors)}`
  );

  // 1.2 Initialization with existing valid localStorage data
  storageBackend.set(
    STORAGE_KEY,
    JSON.stringify(['#d4a359', '#38bdf8', '#f87171'])
  );
  const populatedStore = new RecentColorsStore();
  assert(
    populatedStore.colors.length === 3 &&
      populatedStore.colors[0] === '#d4a359' &&
      populatedStore.colors[1] === '#38bdf8' &&
      populatedStore.colors[2] === '#f87171',
    'Store correctly loads pre-existing array from localStorage',
    `got: ${JSON.stringify(populatedStore.colors)}`
  );

  // 1.3 Corrupted / non-JSON data in localStorage
  storageBackend.set(STORAGE_KEY, '<<<INVALID_MALFORMED_JSON>>{foo:');
  let corruptStore: any;
  try {
    corruptStore = new RecentColorsStore();
    assert(
      Array.isArray(corruptStore.colors) && corruptStore.colors.length === 0,
      'Recovers safely to [] when localStorage has malformed JSON syntax',
      `got: ${JSON.stringify(corruptStore.colors)}`
    );
  } catch (err: any) {
    assert(false, 'Recovers safely to [] when localStorage has malformed JSON', err.message);
  }

  // 1.4 Non-array JSON in localStorage (object, number, string, null)
  for (const invalidJson of ['{"color": "#ffffff"}', '12345', '"hello"', 'null', 'true']) {
    storageBackend.set(STORAGE_KEY, invalidJson);
    const nonArrayStore = new RecentColorsStore();
    assert(
      Array.isArray(nonArrayStore.colors) && nonArrayStore.colors.length === 0,
      `Recovers safely to [] when localStorage JSON is non-array (${invalidJson})`,
      `got: ${JSON.stringify(nonArrayStore.colors)}`
    );
  }

  // 1.5 Array with mixed dirty elements (nulls, numbers, invalid hex, duplicates)
  storageBackend.set(
    STORAGE_KEY,
    JSON.stringify([
      '#112233',
      null,
      42,
      'not-a-color',
      '#ABC',        // 3-digit shorthand
      '#112233',     // duplicate of first
      '   #334455  ', // with whitespace
      '',
      undefined,
      '#998877',
    ])
  );
  const dirtyStore = new RecentColorsStore();
  assert(
    dirtyStore.colors.length === 4 &&
      dirtyStore.colors[0] === '#112233' &&
      dirtyStore.colors[1] === '#aabbcc' &&
      dirtyStore.colors[2] === '#334455' &&
      dirtyStore.colors[3] === '#998877',
    'Sanitizes dirty array on initialization: discards non-hex, normalizes shorthand, deduplicates',
    `got: ${JSON.stringify(dirtyStore.colors)}`
  );

  // 1.6 Truncates localStorage array exceeding MAX_RECENT_COLORS (10) on load
  const oversizedList = Array.from({ length: 25 }, (_, i) => {
    const byte = (i + 1).toString(16).padStart(2, '0');
    return `#${byte}${byte}${byte}`;
  });
  storageBackend.set(STORAGE_KEY, JSON.stringify(oversizedList));
  const oversizedStore = new RecentColorsStore();
  assert(
    oversizedStore.colors.length === MAX_RECENT_COLORS,
    `Truncates oversized localStorage array to MAX_RECENT_COLORS (${MAX_RECENT_COLORS}) on load`,
    `got length ${oversizedStore.colors.length}`
  );
  assert(
    oversizedStore.colors[0] === oversizedList[0] &&
      oversizedStore.colors[9] === oversizedList[9],
    'Preserves the first 10 items in order from oversized localStorage',
    `got: ${JSON.stringify(oversizedStore.colors)}`
  );

  // 1.7 SecurityError / exception in localStorage.getItem
  shouldThrowOnGet = true;
  try {
    const errorStore = new RecentColorsStore();
    assert(
      Array.isArray(errorStore.colors) && errorStore.colors.length === 0,
      'Handles localStorage.getItem exception gracefully without throwing',
      `got: ${JSON.stringify(errorStore?.colors)}`
    );
  } catch (err: any) {
    assert(false, 'Handles localStorage.getItem exception gracefully', err.message);
  } finally {
    shouldThrowOnGet = false;
  }

  // 1.8 QuotaExceededError / exception in localStorage.setItem during addColor
  storageBackend.clear();
  const quotaStore = new RecentColorsStore();
  shouldThrowOnSet = true;
  try {
    quotaStore.addColor('#123456');
    assert(
      quotaStore.colors.length === 1 && quotaStore.colors[0] === '#123456',
      'addColor survives localStorage.setItem QuotaExceeded exception in memory',
      `got: ${JSON.stringify(quotaStore.colors)}`
    );
  } catch (err: any) {
    assert(false, 'addColor survives localStorage.setItem exception', err.message);
  } finally {
    shouldThrowOnSet = false;
  }

  // 1.9 Environment without localStorage (simulating SSR / non-browser)
  const savedLocalStorage = (globalThis as any).localStorage;
  delete (globalThis as any).localStorage;
  try {
    const noStorageStore = new RecentColorsStore();
    assert(
      Array.isArray(noStorageStore.colors) && noStorageStore.colors.length === 0,
      'Initializes safely when localStorage is undefined',
      `got: ${JSON.stringify(noStorageStore.colors)}`
    );
    noStorageStore.addColor('#654321');
    assert(
      noStorageStore.colors[0] === '#654321',
      'addColor works in-memory when localStorage is undefined',
      `got: ${JSON.stringify(noStorageStore.colors)}`
    );
    noStorageStore.clear();
    assert(
      noStorageStore.colors.length === 0,
      'clear works in-memory when localStorage is undefined'
    );
  } finally {
    (globalThis as any).localStorage = savedLocalStorage;
  }

  // =========================================================================
  // CATEGORY 2: ADDING COLORS, DEDUPLICATION & NEWEST TO FRONT (MRU)
  // =========================================================================
  console.log('\n[Category 2] Adding Colors, MRU Ordering & Deduplication');
  storageBackend.clear();
  const mruStore = new RecentColorsStore();

  // 2.1 Sequential insertions
  mruStore.addColor('#111111');
  assert(
    mruStore.colors.length === 1 && mruStore.colors[0] === '#111111',
    'Adding first color places it at index 0'
  );

  mruStore.addColor('#222222');
  assert(
    mruStore.colors.length === 2 &&
      mruStore.colors[0] === '#222222' &&
      mruStore.colors[1] === '#111111',
    'Adding second color pushes it to index 0, previous shifts to index 1'
  );

  mruStore.addColor('#333333');
  assert(
    mruStore.colors.length === 3 &&
      mruStore.colors[0] === '#333333' &&
      mruStore.colors[1] === '#222222' &&
      mruStore.colors[2] === '#111111',
    'Adding third color maintains reverse chronological order'
  );

  // 2.2 Re-adding head color (already at index 0)
  mruStore.addColor('#333333');
  assert(
    mruStore.colors.length === 3 &&
      mruStore.colors[0] === '#333333' &&
      mruStore.colors[1] === '#222222' &&
      mruStore.colors[2] === '#111111',
    'Re-adding head color does not duplicate or change order'
  );

  // 2.3 Re-adding middle color (#222222)
  mruStore.addColor('#222222');
  assert(
    mruStore.colors.length === 3 &&
      mruStore.colors[0] === '#222222' &&
      mruStore.colors[1] === '#333333' &&
      mruStore.colors[2] === '#111111',
    'Re-adding middle color promotes it to index 0 without duplicating'
  );

  // 2.4 Re-adding tail color (#111111)
  mruStore.addColor('#111111');
  assert(
    mruStore.colors.length === 3 &&
      mruStore.colors[0] === '#111111' &&
      mruStore.colors[1] === '#222222' &&
      mruStore.colors[2] === '#333333',
    'Re-adding tail color promotes it to index 0 without duplicating'
  );

  // 2.5 Randomized MRU stress test with small alphabet
  const alphabet = ['#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd', '#eeeeee'];
  const testStore = new RecentColorsStore();
  testStore.clear();

  let ok = true;
  for (let step = 0; step < 100; step++) {
    const chosen = alphabet[Math.floor(Math.random() * alphabet.length)];
    testStore.addColor(chosen);
    // Invariants:
    // 1. Index 0 must be chosen
    // 2. No duplicates
    // 3. Length <= 5
    if (testStore.colors[0] !== chosen) {
      ok = false;
      break;
    }
    const unique = new Set(testStore.colors);
    if (unique.size !== testStore.colors.length) {
      ok = false;
      break;
    }
    if (testStore.colors.length > alphabet.length) {
      ok = false;
      break;
    }
  }
  assert(ok, 'Stress test: 100 random addColor operations strictly maintain MRU & deduplication invariants');

  // =========================================================================
  // CATEGORY 3: CAPACITY CONSTRAINT (MAX_RECENT_COLORS = 10)
  // =========================================================================
  console.log('\n[Category 3] Capacity Constraint (MAX = 10)');
  storageBackend.clear();
  const capStore = new RecentColorsStore();

  // 3.1 Adding exactly 10 distinct colors
  for (let i = 1; i <= 10; i++) {
    const hex = `#${i.toString().padStart(2, '0')}${i.toString().padStart(2, '0')}${i.toString().padStart(2, '0')}`;
    capStore.addColor(hex);
  }
  assert(
    capStore.colors.length === 10,
    'Store holds exactly 10 colors when 10 unique colors are added'
  );

  // 3.2 Adding 11th distinct color: oldest (item 1) dropped
  capStore.addColor('#ffffff');
  assert(
    capStore.colors.length === 10,
    'Store length remains 10 after adding 11th color (truncation enforced)'
  );
  assert(
    capStore.colors[0] === '#ffffff',
    '11th color is at index 0'
  );
  assert(
    !capStore.colors.includes('#010101'),
    'Oldest color (#010101) was successfully evicted from the tail'
  );

  // 3.3 Adding 50 distinct colors continuously
  for (let i = 12; i <= 60; i++) {
    const byte = i.toString(16).padStart(2, '0');
    capStore.addColor(`#${byte}0000`);
    if (capStore.colors.length > 10) {
      assert(false, 'Capacity invariant violated during burst addition');
      break;
    }
  }
  assert(
    capStore.colors.length === 10,
    'Capacity stays locked at 10 across 50 continuous unique additions'
  );
  const expectedNewest = `#${(60).toString(16).padStart(2, '0')}0000`;
  assert(
    capStore.colors[0] === expectedNewest,
    `Newest added color (${expectedNewest}) is at index 0`,
    `got: ${capStore.colors[0]}`
  );

  // 3.4 LocalStorage mirrors the capped list
  const storedJson = storageBackend.get(STORAGE_KEY);
  const storedParsed = JSON.parse(storedJson || '[]');
  assert(
    Array.isArray(storedParsed) && storedParsed.length === 10,
    'localStorage persists exactly 10 items and matches in-memory capacity'
  );
  assert(
    storedParsed[0] === capStore.colors[0] && storedParsed[9] === capStore.colors[9],
    'localStorage matches in-memory elements index-for-index'
  );

  // =========================================================================
  // CATEGORY 4: CASE-INSENSITIVITY & HEX NORMALIZATION
  // =========================================================================
  console.log('\n[Category 4] Case-Insensitivity & Hex Normalization');
  storageBackend.clear();
  const normStore = new RecentColorsStore();

  // 4.1 Uppercase vs Lowercase deduplication
  normStore.addColor('#A855F7');
  assert(
    normStore.colors[0] === '#a855f7',
    'Uppercase hex #A855F7 is normalized to lowercase #a855f7'
  );

  normStore.addColor('#a855f7');
  assert(
    normStore.colors.length === 1,
    'Adding lowercase #a855f7 deduplicates against existing uppercase input'
  );

  normStore.addColor('#A855f7');
  assert(
    normStore.colors.length === 1,
    'Adding mixed-case #A855f7 deduplicates seamlessly'
  );

  // 4.2 3-digit shorthand expansion (#rgb -> #rrggbb)
  normStore.addColor('#fff');
  assert(
    normStore.colors[0] === '#ffffff',
    '3-digit shorthand #fff expands to 6-digit #ffffff'
  );

  normStore.addColor('#FFFFFF');
  assert(
    normStore.colors.length === 2 && normStore.colors[0] === '#ffffff',
    'Adding #FFFFFF deduplicates against previously added #fff shorthand'
  );

  normStore.addColor('#000');
  assert(
    normStore.colors[0] === '#000000',
    '#000 expands to #000000'
  );

  normStore.addColor('#f80');
  assert(
    normStore.colors[0] === '#ff8800',
    '#f80 expands to #ff8800'
  );

  // 4.3 Missing hash prefix (#)
  normStore.addColor('38bdf8');
  assert(
    normStore.colors[0] === '#38bdf8',
    'Color string without hash prefix (38bdf8) automatically prepends #'
  );

  normStore.addColor('#38BDF8');
  assert(
    normStore.colors.length === 5 && normStore.colors[0] === '#38bdf8',
    'Re-adding #38BDF8 with hash deduplicates against 38bdf8 without hash'
  );

  // 4.4 Whitespace trimming
  normStore.addColor('   #f97316   ');
  assert(
    normStore.colors[0] === '#f97316',
    'Trims leading and trailing spaces before normalization'
  );

  // 4.5 Normalizer idempotence
  const testInputs = ['#38bdf8', '#38BDF8', '38bdf8', '#abc', '#ABC', 'abc'];
  let idempotent = true;
  for (const input of testInputs) {
    const once = normalizeHex(input);
    const twice = normalizeHex(once);
    if (once !== twice) {
      idempotent = false;
      break;
    }
  }
  assert(idempotent, 'normalizeHex is strictly idempotent: normalizeHex(normalizeHex(x)) === normalizeHex(x)');

  // =========================================================================
  // CATEGORY 5: HANDLING INVALID COLOR STRINGS & EMPTY INPUTS
  // =========================================================================
  console.log('\n[Category 5] Graceful Handling of Invalid / Empty Inputs');
  storageBackend.clear();
  const safeStore = new RecentColorsStore();
  safeStore.addColor('#10b981');
  const baselineLength = safeStore.colors.length;

  // 5.1 Empty string and whitespace
  safeStore.addColor('');
  assert(safeStore.colors.length === baselineLength, 'addColor("") is safely ignored');
  safeStore.addColor('    ');
  assert(safeStore.colors.length === baselineLength, 'addColor("    ") is safely ignored');

  // 5.2 Non-string inputs (type violations)
  safeStore.addColor(null as any);
  assert(safeStore.colors.length === baselineLength, 'addColor(null) does not throw and is ignored');
  safeStore.addColor(undefined as any);
  assert(safeStore.colors.length === baselineLength, 'addColor(undefined) does not throw and is ignored');
  safeStore.addColor(12345 as any);
  assert(safeStore.colors.length === baselineLength, 'addColor(12345) does not throw and is ignored');
  safeStore.addColor({} as any);
  assert(safeStore.colors.length === baselineLength, 'addColor({}) does not throw and is ignored');

  // 5.3 Invalid lengths
  const invalidLengths = ['#', '#1', '#12', '#1234', '#12345', '#1234567', '#12345678'];
  for (const inv of invalidLengths) {
    assert(isValidHex(inv) === false, `isValidHex rejects invalid length: "${inv}"`);
    safeStore.addColor(inv);
  }
  assert(
    safeStore.colors.length === baselineLength,
    'None of the invalid length colors were added to the store'
  );

  // 5.4 Non-hex characters
  const nonHexStrings = ['#gggggg', '#zzzzzz', '#12345g', '#hello!', 'red', 'transparent', 'inherit'];
  for (const inv of nonHexStrings) {
    assert(isValidHex(inv) === false, `isValidHex rejects non-hex: "${inv}"`);
    safeStore.addColor(inv);
  }
  assert(
    safeStore.colors.length === baselineLength,
    'None of the non-hex strings were added to the store'
  );

  // 5.5 CSS color expressions (rgb, rgba, hsl)
  const cssExpressions = ['rgb(255, 0, 0)', 'rgba(0, 0, 0, 0.5)', 'hsl(200, 50%, 50%)'];
  for (const expr of cssExpressions) {
    assert(isValidHex(expr) === false, `isValidHex rejects CSS function expression: "${expr}"`);
    safeStore.addColor(expr);
  }
  assert(
    safeStore.colors.length === baselineLength,
    'CSS functions (rgb, rgba, hsl) rejected safely by store'
  );

  // 5.6 XSS / Injection attempts
  const injectionAttempts = [
    '<script>alert(1)</script>',
    '"; alert("xss"); "',
    'javascript:alert(1)',
    '#ffffff;<style>',
    'url("test.png")',
  ];
  for (const attack of injectionAttempts) {
    assert(isValidHex(attack) === false, `isValidHex blocks injection string: "${attack.slice(0, 20)}..."`);
    safeStore.addColor(attack);
  }
  assert(
    safeStore.colors.length === baselineLength,
    'Injection attempts completely blocked from store'
  );

  // =========================================================================
  // CATEGORY 6: 1-CLICK REAPPLICATION LOGIC & COMPONENT FLOW SIMULATION
  // =========================================================================
  console.log('\n[Category 6] 1-Click Reapplication Logic & Swatch Simulation');
  storageBackend.clear();
  const flowStore = new RecentColorsStore();
  flowStore.clear();

  // Populate store with recent colors from previous actions
  const swatch1 = '#a855f7'; // Purple
  const swatch2 = '#38bdf8'; // Sky blue
  const swatch3 = '#f87171'; // Crimson
  flowStore.addColor(swatch1);
  flowStore.addColor(swatch2);
  flowStore.addColor(swatch3);

  // Order in recents is now [swatch3, swatch2, swatch1]
  assert(
    flowStore.colors[0] === swatch3 &&
      flowStore.colors[1] === swatch2 &&
      flowStore.colors[2] === swatch1,
    'Store has 3 recent swatches ready for 1-click reapplication'
  );

  class ColorPickerSimulation {
    value: string;
    hexInput: string;
    inputEvents: string[] = [];
    changeEvents: string[] = [];
    store: any;

    constructor(initialValue: string, storeInstance: any) {
      this.value = initialValue;
      this.hexInput = initialValue;
      this.store = storeInstance;
    }

    oninput = (val: string) => {
      this.inputEvents.push(val);
    };

    onchange = (val: string) => {
      this.changeEvents.push(val);
    };

    // Exactly replicating handleSelectColor in ColorPicker.svelte
    handleSelectColor(color: string) {
      const norm = normalizeHex(color);
      this.value = norm;
      this.hexInput = norm;
      this.store.addColor(norm);
      this.oninput(norm);
      this.onchange(norm);
    }
  }

  // Simulation: User opens Entity A editor, clicks recent swatch #a855f7 (index 2)
  const pickerA = new ColorPickerSimulation('#d4a359', flowStore);
  assert(pickerA.value === '#d4a359', 'Entity A initial color is #d4a359');

  pickerA.handleSelectColor(swatch1); // 1-click on recent swatch

  assert(
    pickerA.value === '#a855f7',
    '1-click updates picker value immediately to #a855f7'
  );
  assert(
    pickerA.hexInput === '#a855f7',
    '1-click synchronizes hex text input to #a855f7'
  );
  assert(
    pickerA.inputEvents.length === 1 && pickerA.inputEvents[0] === '#a855f7',
    '1-click fires oninput callback for live canvas preview'
  );
  assert(
    pickerA.changeEvents.length === 1 && pickerA.changeEvents[0] === '#a855f7',
    '1-click fires onchange callback for property commit'
  );
  assert(
    flowStore.colors[0] === '#a855f7',
    'Reapplied swatch #a855f7 is promoted to MRU head (index 0) in recent colors'
  );

  // Simulation: User opens Entity B editor, re-applies same color with 1 click
  const pickerB = new ColorPickerSimulation('#10b981', flowStore);
  assert(
    flowStore.colors[0] === '#a855f7',
    'Recent swatch #a855f7 is immediately available at top of picker for Entity B'
  );

  pickerB.handleSelectColor(flowStore.colors[0]); // 1-click on index 0 swatch

  assert(
    pickerB.value === '#a855f7',
    'Entity B successfully adopts #a855f7 with 1 click'
  );
  assert(
    pickerB.inputEvents[0] === '#a855f7' && pickerB.changeEvents[0] === '#a855f7',
    'Entity B triggers live canvas sync and commit events'
  );
  assert(
    flowStore.colors.length === 3,
    'Store length remains 3 without duplicating #a855f7'
  );

  // 6.3 Clear functionality
  flowStore.clear();
  assert(flowStore.colors.length === 0, 'flowStore.clear() empties in-memory list');
  assert(!storageBackend.has(STORAGE_KEY), 'flowStore.clear() removes key from localStorage');

  // 6.4 API completeness and aliases
  assert(typeof flowStore.addRecentColor === 'function', 'addRecentColor alias exists');
  assert(typeof flowStore.clearRecentColors === 'function', 'clearRecentColors alias exists');
  assert(recentColorsStore === recentColors, 'recentColorsStore singleton alias matches recentColors');
  assert(
    Array.isArray(DEFAULT_PRESET_COLORS) && DEFAULT_PRESET_COLORS.length === 8,
    'DEFAULT_PRESET_COLORS is exported with 8 standard Mural swatches'
  );
  for (const preset of DEFAULT_PRESET_COLORS) {
    assert(
      typeof preset.name === 'string' && isValidHex(preset.hex),
      `Preset "${preset.name}" has valid hex (${preset.hex})`
    );
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(64));
  console.log(` EMPIRICAL CHALLENGE SUMMARY:`);
  console.log(` TOTAL TESTS : ${passed + failed}`);
  console.log(` PASSED      : ${passed}`);
  console.log(` FAILED      : ${failed}`);
  if (failures.length > 0) {
    console.log(` FAILURES    :\n  - ${failures.join('\n  - ')}`);
  }
  console.log('='.repeat(64));

  if (failed > 0) {
    process.exit(1);
  }
}

runEmpiricalChallenge().catch((err) => {
  console.error('Unhandled fatal error in test harness:', err);
  process.exit(1);
});
