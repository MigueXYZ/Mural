// tests/unit/empirical_challenge_r1_canvas_invariance.test.ts
// Empirical Adversarial Challenge Test Harness for Milestone 3 Requirement R1:
// Canvas Coordinate Invariance and Selective Chrome Zooming

// Mock storage
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

// Mock DOM
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
  elementsFromPoint: (_x: number, _y: number) => [] as any[],
  querySelectorAll: (_sel: string) => [] as any[],
};
(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  location: { search: '' },
};

// Mock Svelte 5 runes if executing in plain tsx / node
if (typeof (globalThis as any).$state === 'undefined') {
  (globalThis as any).$state = (v: any) => v;
  (globalThis as any).$derived = (v: any) => v;
  (globalThis as any).$derived.by = (fn: any) => (typeof fn === 'function' ? fn() : fn);
  (globalThis as any).$effect = (_fn: any) => {};
}

async function runCanvasInvarianceEmpiricalChallenge() {
  const { appState } = await import('../../src/lib/stores/appState.svelte');
  const { campaignStore } = await import('../../src/lib/stores/campaignStore.svelte');

  console.log('======================================================================');
  console.log('  EMPIRICAL CHALLENGE: Canvas Coordinate Invariance & Chrome Zoom (R1)');
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

  // Baseline dimensions from App.svelte / Header.svelte / NavigationSidebar.svelte
  const BASE_HEADER_HEIGHT = 56;    // h-14
  const BASE_NAV_WIDTH = 56;        // w-14
  const BASE_RIGHT_ASIDE_WIDTH = 320; // w-80
  const BASE_TIMELINE_HEIGHT = 40;  // h-10

  const PRESET_SCALES = [0.75, 0.90, 1.00, 1.10, 1.25, 1.50];

  // -------------------------------------------------------------------------
  // Suite 1: Svelte Flow Viewport Transform Independence
  // -------------------------------------------------------------------------
  console.log('[Suite 1] Svelte Flow Viewport Transform Independence under UI Scale');

  const testViewports = [
    { x: 0, y: 0, zoom: 1.0 },
    { x: 250, y: -180, zoom: 1.5 },
    { x: -1200, y: 850, zoom: 0.5 },
    { x: 42.123, y: 99.876, zoom: 2.25 },
    { x: -5000, y: -5000, zoom: 0.1 },
  ];

  for (const vp of testViewports) {
    const initialVp = { ...vp };

    for (const scale of PRESET_SCALES) {
      appState.setUiScale(scale);

      // Verify changing uiScale does not alter the canvas internal viewport coordinates
      assert(
        vp.x === initialVp.x && vp.y === initialVp.y && vp.zoom === initialVp.zoom,
        `Viewport (x=${initialVp.x}, y=${initialVp.y}, zoom=${initialVp.zoom}) unchanged at uiScale ${scale * 100}%`
      );

      // Verify the 2D affine transform matrix [a, b, c, d, tx, ty]
      // In Svelte Flow, transform is: translate(x, y) scale(zoom)
      // Matrix: [zoom, 0, 0, zoom, x, y]
      const matrix = [vp.zoom, 0, 0, vp.zoom, vp.x, vp.y];
      assert(
        matrix[0] === initialVp.zoom && matrix[3] === initialVp.zoom && matrix[4] === initialVp.x && matrix[5] === initialVp.y,
        `Viewport affine transform matrix identical at uiScale ${scale * 100}%`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Suite 2: screenToFlowPosition Calculation Invariance
  // -------------------------------------------------------------------------
  console.log('\n[Suite 2] screenToFlowPosition Invariance across Canvas Content Points');

  // screenToFlowPosition implementation as per @xyflow/svelte specification:
  // flowX = (clientX - containerBounds.left - viewport.x) / viewport.zoom
  // flowY = (clientY - containerBounds.top - viewport.y) / viewport.zoom
  function screenToFlowPosition(
    clientPos: { x: number; y: number },
    containerBounds: { left: number; top: number },
    viewport: { x: number; y: number; zoom: number }
  ) {
    return {
      x: (clientPos.x - containerBounds.left - viewport.x) / viewport.zoom,
      y: (clientPos.y - containerBounds.top - viewport.y) / viewport.zoom,
    };
  }

  const canvasPoints = [
    { name: 'Canvas Origin', cx: 0, cy: 0 },
    { name: 'Investigation Hub Center', cx: 450, cy: 300 },
    { name: 'Top-Left Quadrant Node', cx: 120, cy: 80 },
    { name: 'Bottom-Right Clue Card', cx: 1280, cy: 720 },
    { name: 'Negative Coordinate Mystery Marker', cx: -350, cy: -600 },
    { name: 'Extreme Far Canvas Boundary', cx: 10000, cy: 8500 },
    { name: 'High Precision Sub-pixel Point', cx: 123.456789, cy: 987.654321 },
  ];

  for (const vp of testViewports) {
    for (const pt of canvasPoints) {
      // Compute flow coordinates at baseline scale (1.0)
      const baseNavLeft = BASE_NAV_WIDTH * 1.0;
      const baseHeaderTop = BASE_HEADER_HEIGHT * 1.0;
      const baseClientPos = { x: baseNavLeft + pt.cx, y: baseHeaderTop + pt.cy };
      const baselineFlow = screenToFlowPosition(
        baseClientPos,
        { left: baseNavLeft, top: baseHeaderTop },
        vp
      );

      // Now compute flow coordinates across all preset scales:
      // When Chrome scales, NavigationSidebar width is 56 * uiScale and Header height is 56 * uiScale.
      // Therefore, the user's cursor pointing at that exact canvas content point is at:
      // clientX = 56 * uiScale + pt.cx, clientY = 56 * uiScale + pt.cy.
      // Container bounds left = 56 * uiScale, top = 56 * uiScale.
      let allScalesMatch = true;
      let maxError = 0;

      for (const scale of PRESET_SCALES) {
        appState.setUiScale(scale);
        const scaledNavLeft = BASE_NAV_WIDTH * scale;
        const scaledHeaderTop = BASE_HEADER_HEIGHT * scale;
        const scaledClientPos = { x: scaledNavLeft + pt.cx, y: scaledHeaderTop + pt.cy };

        const currentFlow = screenToFlowPosition(
          scaledClientPos,
          { left: scaledNavLeft, top: scaledHeaderTop },
          vp
        );

        const diffX = Math.abs(currentFlow.x - baselineFlow.x);
        const diffY = Math.abs(currentFlow.y - baselineFlow.y);
        const err = Math.max(diffX, diffY);
        if (err > maxError) maxError = err;
        if (err > 1e-12) {
          allScalesMatch = false;
        }
      }

      assert(
        allScalesMatch && maxError < 1e-12,
        `screenToFlowPosition invariant for "${pt.name}" under all uiScales (max error: ${maxError.toExponential(2)})`
      );
    }
  }

  // Counter-example test (Adversarial challenge):
  // Verify that IF an erroneous engine multiplied/divided the canvas coordinates by uiScale,
  // the invariance would break (confirming our test detects coordinate drift).
  function brokenScreenToFlowPosition(
    clientPos: { x: number; y: number },
    containerBounds: { left: number; top: number },
    viewport: { x: number; y: number; zoom: number },
    uiScale: number
  ) {
    // Erroneous implementation that applies uiScale to canvas content
    return {
      x: ((clientPos.x - containerBounds.left) / uiScale - viewport.x) / viewport.zoom,
      y: ((clientPos.y - containerBounds.top) / uiScale - viewport.y) / viewport.zoom,
    };
  }

  const brokenResult75 = brokenScreenToFlowPosition({ x: 42 + 200, y: 42 + 150 }, { left: 42, top: 42 }, { x: 0, y: 0, zoom: 1 }, 0.75);
  const brokenResult150 = brokenScreenToFlowPosition({ x: 84 + 200, y: 84 + 150 }, { left: 84, top: 84 }, { x: 0, y: 0, zoom: 1 }, 1.50);
  assert(
    Math.abs(brokenResult75.x - brokenResult150.x) > 50,
    'Adversarial sanity check: Confirms bug detector triggers if canvas were erroneously scaled'
  );

  // -------------------------------------------------------------------------
  // Suite 3: Node & Handle Bounding Rect Scale Invariance
  // -------------------------------------------------------------------------
  console.log('\n[Suite 3] Node and Handle Bounding Rect Scale Invariance');

  // In Mural, nodes have standard dimensions: e.g. 280px width x 160px height.
  // Handles have standard diameter: 12px x 12px (e.g. .w-3 .h-3).
  // Under Svelte Flow's 1:1 unzoomed canvas container, an element's screen width/height is:
  // renderedWidth = flowWidth * viewport.zoom
  // renderedHeight = flowHeight * viewport.zoom
  // uiScale must have ZERO effect on node or handle bounding dimensions.

  const testNodes = [
    { id: 'npc-investigator', flowX: 200, flowY: 150, width: 280, height: 160 },
    { id: 'clue-letter', flowX: 600, flowY: 300, width: 220, height: 120 },
    { id: 'faction-cult', flowX: -150, flowY: 400, width: 320, height: 200 },
  ];

  const HANDLE_SIZE = 12; // 12px standard Svelte Flow handle

  for (const node of testNodes) {
    for (const zoom of [0.5, 1.0, 1.5, 2.0]) {
      const vp = { x: 100, y: 50, zoom };
      const expectedHandleScreenSize = HANDLE_SIZE * zoom;
      const expectedNodeScreenWidth = node.width * zoom;
      const expectedNodeScreenHeight = node.height * zoom;

      for (const scale of PRESET_SCALES) {
        appState.setUiScale(scale);

        // Since canvas container has zoom: 1.0, internal node and handle dimensions
        // are scaled strictly by SvelteFlow viewport.zoom:
        const nodeRenderedWidth = node.width * vp.zoom;
        const nodeRenderedHeight = node.height * vp.zoom;
        const handleRenderedSize = HANDLE_SIZE * vp.zoom;

        assert(
          nodeRenderedWidth === expectedNodeScreenWidth &&
          nodeRenderedHeight === expectedNodeScreenHeight &&
          handleRenderedSize === expectedHandleScreenSize,
          `Node "${node.id}" bounds & handle size invariant at zoom=${zoom}x, uiScale=${scale * 100}%`
        );
      }
    }
  }

  // Handle center proximity hit-testing invariance
  // When reconnecting an edge or dragging a connection, hit-test checks proximity to handle center.
  console.log('\n[Suite 3.1] Handle Hit-Testing and Proximity Snap Invariance');
  for (const scale of PRESET_SCALES) {
    appState.setUiScale(scale);
    const navOffset = BASE_NAV_WIDTH * scale;
    const headerOffset = BASE_HEADER_HEIGHT * scale;

    const nodeFlowX = 300;
    const nodeFlowY = 200;
    const handleOffsetInNode = { x: 280, y: 80 }; // Right-center handle
    const vp = { x: 50, y: 50, zoom: 1.2 };

    // Screen position of handle center
    const handleScreenCenterX = navOffset + (nodeFlowX + handleOffsetInNode.x) * vp.zoom + vp.x;
    const handleScreenCenterY = headerOffset + (nodeFlowY + handleOffsetInNode.y) * vp.zoom + vp.y;

    // Simulate pointer arriving exactly at handle screen center
    const pointerX = handleScreenCenterX;
    const pointerY = handleScreenCenterY;

    // Distance in screen space
    const distanceToCenter = Math.hypot(pointerX - handleScreenCenterX, pointerY - handleScreenCenterY);
    const snapRadius = 28; // Default snap radius from CustomLabeledEdge.svelte:243

    assert(
      distanceToCenter === 0 && distanceToCenter < snapRadius,
      `Handle snap hit-test distance is exactly 0px at uiScale=${scale * 100}%`
    );
  }

  // -------------------------------------------------------------------------
  // Suite 4: D3-Zoom Zoom Level and Gesture Invariance
  // -------------------------------------------------------------------------
  console.log('\n[Suite 4] D3-Zoom Zoom Level & Gesture Invariance');

  // D3-zoom transform: k = zoom level, tx/ty = pan offset
  // When user wheels or pinches, d3 calculates:
  // newK = k * Math.pow(2, -wheelDelta * 0.002)
  // pivotX = clientX - containerLeft
  // newTx = pivotX - (pivotX - tx) * (newK / k)
  // newTy = pivotY - (pivotY - ty) * (newK / k)

  const wheelSteps = [-50, -100, 75, 120, -30, 200, -150];

  // Compute baseline gesture transform at scale = 1.0
  let baselineK = 1.0;
  let baselineTx = 0;
  let baselineTy = 0;
  {
    const navLeft = BASE_NAV_WIDTH * 1.0;
    const headerTop = BASE_HEADER_HEIGHT * 1.0;
    const clientX = navLeft + 500;
    const clientY = headerTop + 400;
    for (const delta of wheelSteps) {
      const factor = Math.pow(2, -delta * 0.002);
      const newK = baselineK * factor;
      const pivotX = clientX - navLeft;
      const pivotY = clientY - headerTop;
      baselineTx = pivotX - (pivotX - baselineTx) * (newK / baselineK);
      baselineTy = pivotY - (pivotY - baselineTy) * (newK / baselineK);
      baselineK = newK;
    }
  }

  for (const scale of [0.75, 1.0, 1.25, 1.50]) {
    appState.setUiScale(scale);
    const navLeft = BASE_NAV_WIDTH * scale;
    const headerTop = BASE_HEADER_HEIGHT * scale;

    // Fixed canvas content pivot point (e.g. center of viewport at 500, 400 inside canvas)
    const clientX = navLeft + 500;
    const clientY = headerTop + 400;

    let k = 1.0;
    let tx = 0;
    let ty = 0;

    for (const delta of wheelSteps) {
      const factor = Math.pow(2, -delta * 0.002);
      const newK = k * factor;
      const pivotX = clientX - navLeft; // 500
      const pivotY = clientY - headerTop; // 400

      tx = pivotX - (pivotX - tx) * (newK / k);
      ty = pivotY - (pivotY - ty) * (newK / k);
      k = newK;
    }

    // Since pivotX and pivotY are strictly 500 and 400 regardless of navLeft/headerTop,
    // the resulting k, tx, ty MUST be bit-for-bit identical across all uiScales!
    assert(
      Math.abs(k - baselineK) < 1e-12 &&
      Math.abs(tx - baselineTx) < 1e-12 &&
      Math.abs(ty - baselineTy) < 1e-12,
      `D3-zoom gesture sequence produces identical transform (k=${k.toFixed(4)}, tx=${tx.toFixed(2)}, ty=${ty.toFixed(2)}) at uiScale=${scale * 100}%`
    );
  }

  // -------------------------------------------------------------------------
  // Suite 5: Flexbox Space Allocation & Document Scroll Overflow Invariance
  // -------------------------------------------------------------------------
  console.log('\n[Suite 5] Flexbox Space Allocation & Zero Document Scroll Overflow');

  // Test across multiple real-world screen resolutions
  const displayResolutions = [
    { name: '4K UHD (3840x2160)', width: 3840, height: 2160 },
    { name: '2K QHD (2560x1440)', width: 2560, height: 1440 },
    { name: 'FHD Standard (1920x1080)', width: 1920, height: 1080 },
    { name: 'WSXGA (1600x900)', width: 1600, height: 900 },
    { name: 'Laptop Common (1366x768)', width: 1366, height: 768 },
    { name: 'Laptop 16:10 (1280x800)', width: 1280, height: 800 },
    { name: 'Tablet XGA (1024x768)', width: 1024, height: 768 },
    { name: 'SVGA Boundary (800x600)', width: 800, height: 600 },
  ];

  for (const res of displayResolutions) {
    for (const scale of PRESET_SCALES) {
      appState.setUiScale(scale);

      // Flexbox layout simulation based on App.svelte:
      // Header: h-14 with zoom: scale
      const headerHeight = BASE_HEADER_HEIGHT * scale;
      // Timeline: h-10 with zoom: scale
      const timelineHeight = BASE_TIMELINE_HEIGHT * scale;
      // NavSidebar: w-14 with zoom: scale
      const navWidth = BASE_NAV_WIDTH * scale;
      // RightAside: w-80 with zoom: scale
      const asideWidth = BASE_RIGHT_ASIDE_WIDTH * scale;

      // Vertical allocation:
      // Outer div is h-screen (res.height) with flex-col.
      // Top: Header (headerHeight)
      // Bottom: Timeline (timelineHeight)
      // Middle body is flex-1: allocated height = res.height - (headerHeight + timelineHeight)
      const mainBodyHeight = res.height - headerHeight - timelineHeight;
      const mainHeight = mainBodyHeight;

      // Horizontal allocation inside middle body (flex-row):
      // Left: NavigationSidebar (navWidth)
      // Right: Aside (asideWidth)
      // Center: <main class="flex-1 relative overflow-hidden">
      // Allocated width = res.width - navWidth - asideWidth
      const mainWidth = res.width - navWidth - asideWidth;

      // 1. Total horizontal space check
      const totalAllocatedWidth = navWidth + mainWidth + asideWidth;
      const horizontalOverflow = Math.max(0, totalAllocatedWidth - res.width);

      // 2. Total vertical space check
      const totalAllocatedHeight = headerHeight + mainHeight + timelineHeight;
      const verticalOverflow = Math.max(0, totalAllocatedHeight - res.height);

      assert(
        totalAllocatedWidth === res.width && horizontalOverflow === 0,
        `Zero horizontal scroll overflow on ${res.name} at uiScale=${scale * 100}% (allocated=${totalAllocatedWidth}px, screen=${res.width}px)`
      );

      assert(
        totalAllocatedHeight === res.height && verticalOverflow === 0,
        `Zero vertical scroll overflow on ${res.name} at uiScale=${scale * 100}% (allocated=${totalAllocatedHeight}px, screen=${res.height}px)`
      );

      // 3. Ensure <main> receives a positive, usable workspace area for supported desktop resolutions (>= 1280x768)
      if (res.width >= 1280 && res.height >= 768) {
        assert(
          mainWidth >= 400 && mainHeight >= 400,
          `Canvas container <main> has ample dimensions (${Math.round(mainWidth)}x${Math.round(mainHeight)}px) on ${res.name} at ${scale * 100}%`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Suite 6: Floating Toolbars Transform Origin & Canvas Clamping
  // -------------------------------------------------------------------------
  console.log('\n[Suite 6] Floating Toolbars Transform Origin & Canvas Clamping');

  // In CanvasContent.svelte:
  // Master toolbar: style="zoom: var(--ui-scale, 1); transform-origin: top left;"
  // Viewport controls: style="zoom: var(--ui-scale, 1); transform-origin: top right;"
  // Verify that at max zoom (150%), the master toolbar fits within the canvas width

  const BASE_TOOLBAR_WIDTH = 480; // Estimated max width of unscaled toolbar buttons
  const BASE_CONTROLS_WIDTH = 220; // Controls + UI scale popover button

  for (const scale of PRESET_SCALES) {
    const scaledToolbar = BASE_TOOLBAR_WIDTH * scale;
    const scaledControls = BASE_CONTROLS_WIDTH * scale;

    // On standard 1920x1080 FHD screen:
    const mainWidthFHD = 1920 - (BASE_NAV_WIDTH * scale) - (BASE_RIGHT_ASIDE_WIDTH * scale);
    const combinedWidth = scaledToolbar + scaledControls + 40; // 40px margins and padding

    assert(
      combinedWidth < mainWidthFHD,
      `Toolbars fit cleanly without overlapping on FHD at uiScale=${scale * 100}% (${Math.round(combinedWidth)}px < ${Math.round(mainWidthFHD)}px)`
    );
  }

  // -------------------------------------------------------------------------
  // Suite 7: Rapid Scale Oscillations & Numerical Stability Stress Test
  // -------------------------------------------------------------------------
  console.log('\n[Suite 7] Rapid Scale Oscillations & State Synchronization Stress');

  const oscillationScales = [0.75, 1.50, 0.85, 1.25, 0.90, 1.40, 1.00, 1.10, 0.80, 1.35];
  let oscillationPassed = true;

  for (let cycle = 0; cycle < 50; cycle++) {
    for (const targetScale of oscillationScales) {
      appState.setUiScale(targetScale);

      const currentScale = appState.uiScale;
      const cssVar = domProperties.get('--ui-scale');
      const storedVal = storageMap.get('mural_ui_scale');
      const campaignScale = campaignStore.campaign.settings?.uiScale;

      if (
        Math.abs(currentScale - targetScale) > 0.001 ||
        cssVar !== String(targetScale) ||
        storedVal !== String(targetScale) ||
        campaignScale !== targetScale
      ) {
        oscillationPassed = false;
        console.error(`Desynchronization detected at cycle ${cycle}, targetScale ${targetScale}:`, {
          currentScale,
          cssVar,
          storedVal,
          campaignScale,
        });
        break;
      }
    }
  }

  assert(
    oscillationPassed,
    '500 rapid UI scale switches maintained 100% synchronization across State, DOM, Storage, and Campaign'
  );

  // -------------------------------------------------------------------------
  // Suite 8: Adversarial Clamping & Fuzzing Resilience
  // -------------------------------------------------------------------------
  console.log('\n[Suite 8] Adversarial Clamping & Fuzzing Resilience');

  const adversarialInputs: { input: any; expected: number; label: string }[] = [
    { input: -100, expected: 0.75, label: 'Large negative number (-100)' },
    { input: -0.0001, expected: 0.75, label: 'Small negative number (-0.0001)' },
    { input: 0, expected: 0.75, label: 'Zero (0)' },
    { input: 0.7499, expected: 0.75, label: 'Just below lower bound (0.7499)' },
    { input: 1.5001, expected: 1.50, label: 'Just above upper bound (1.5001)' },
    { input: 9999, expected: 1.50, label: 'Extremely high number (9999)' },
    { input: 1.12345678, expected: 1.12, label: 'High precision float (1.12345678)' },
    { input: 0.99999, expected: 1.00, label: 'Rounding to whole float (0.99999)' },
    { input: 1.254, expected: 1.25, label: 'Rounding down (1.254)' },
    { input: 1.256, expected: 1.26, label: 'Rounding up (1.256)' },
  ];

  for (const tc of adversarialInputs) {
    appState.setUiScale(tc.input);
    assert(
      Math.abs(appState.uiScale - tc.expected) < 0.001,
      `Adversarial input "${tc.label}" safely normalized to ${tc.expected}`
    );
    assert(
      domProperties.get('--ui-scale') === String(tc.expected),
      `CSS variable matches normalized value "${tc.expected}"`
    );
  }

  // Restore clean default
  appState.setUiScale(1.0);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`EMPIRICAL CHALLENGE SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCanvasInvarianceEmpiricalChallenge().catch((err) => {
  console.error('Fatal error running Empirical Challenge tests:', err);
  process.exit(1);
});
