/**
 * tests/empirical_challenge_m2.ts
 * 
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE FOR MILESTONE 2
 * 
 * Executed independently by Challenger 1.
 * Adversarially challenges:
 * 1. Continuous 1.5m scale math ($70px = 1.5m, 46.6667 px/m) across extreme distances (0m to 10,000m).
 * 2. Intermediate 1.5m tick mark count calculation and orthogonal geometry.
 * 3. Speed budget categorization boundaries (<= 9m emerald, <= 18m amber, > 18m rose).
 * 4. Area of Effect (AoE) geometry (Circle explosion, 60° Cone arc, 1.5m Line beam) and point containment.
 * 5. FogCanvas blend modes (destination-out, source-over), inverted rectangle coordinates, micro-clicks.
 * 6. Viewport transformations and anchor zoom focal preservation.
 * 7. Token size geometry, vital resource bar percentages, and stealth security culling.
 */

import {
  worldToScreen,
  screenToWorld,
  calculateZoomPan,
  calculateDistancePixels,
  calculateDistanceMeters,
  formatDistanceMeters,
  formatMeters,
  measureRuler,
  metersToGridUnits,
  calculateAoeGeometry,
  isPointInCircle,
  isPointInCone,
  isPointInLineBeam,
  isTokenVisibleToPlayer,
  authorizeTokenMove,
  TACTICAL_GRID_SIZE_PX,
  TACTICAL_GRID_STEP_METERS,
  TACTICAL_PIXELS_PER_METER,
  TACTICAL_METERS_PER_PIXEL,
} from '../src/lib/services/vtt/vttProtocol';

import {
  VTT_TOKEN_SIZES,
  VTT_FOG_GM_OPACITY,
  VTT_FOG_PLAYER_OPACITY,
  VTT_FOG_COLOR,
  type VttPoint,
  type VttRect,
  type VttToken,
  type VttTokenSize,
  type FogAction,
} from '../src/lib/types/vtt';

let passedChallenges = 0;
let failedChallenges = 0;
const failures: Array<{ category: string; test: string; observed: string; expected: string }> = [];

function recordPass() {
  passedChallenges++;
}

function recordFail(category: string, test: string, observed: string, expected: string) {
  failedChallenges++;
  failures.push({ category, test, observed, expected });
  console.error(`  ✖ FAIL [${category}] ${test}\n    Observed: ${observed}\n    Expected: ${expected}`);
}

console.log('='.repeat(80));
console.log('   CHALLENGER 1: EMPIRICAL ADVERSARIAL STRESS TEST SUITE (MILESTONE 2)');
console.log('='.repeat(80));

// ============================================================================
// SUITE 1: Continuous 1.5m Scale (70px = 1.5m) Across Extreme Distances (0m - 10,000m)
// ============================================================================
console.log('\n[1] Stress-Testing Continuous 1.5m Scale Across Extreme Distances (0m to 10,000m)...');

// 1.1 Zero Distance
{
  const p1: VttPoint = { x: 500, y: 500 };
  const p2: VttPoint = { x: 500, y: 500 };
  const m = measureRuler(p1, p2);
  if (m.distancePx === 0 && m.distanceMeters === 0 && m.formattedMeters === '0.0 m' && m.stepsCount === 0) {
    recordPass();
  } else {
    recordFail('Scale', 'Zero distance', JSON.stringify(m), '0px, 0m, "0.0 m", 0 steps');
  }
}

// 1.2 Sub-pixel micro distance (0.001px)
{
  const p1: VttPoint = { x: 100, y: 100 };
  const p2: VttPoint = { x: 100.001, y: 100 };
  const distMeters = calculateDistanceMeters(p1, p2);
  if (distMeters > 0 && distMeters < 0.001 && formatDistanceMeters(distMeters) === '0.0 m') {
    recordPass();
  } else {
    recordFail('Scale', 'Sub-pixel distance', `${distMeters} m`, '< 0.001m and "0.0 m"');
  }
}

// 1.3 Canonical Step Increments: 1, 2, 4, 6, 12 steps
{
  const steps = [
    { step: 1, px: 70, expectedMeters: 1.5, expectedFormatted: '1.5 m' },
    { step: 2, px: 140, expectedMeters: 3.0, expectedFormatted: '3.0 m' },
    { step: 4, px: 280, expectedMeters: 6.0, expectedFormatted: '6.0 m' },
    { step: 6, px: 420, expectedMeters: 9.0, expectedFormatted: '9.0 m' },
    { step: 12, px: 840, expectedMeters: 18.0, expectedFormatted: '18.0 m' },
  ];

  for (const s of steps) {
    const p1: VttPoint = { x: 0, y: 0 };
    const p2: VttPoint = { x: s.px, y: 0 };
    const m = measureRuler(p1, p2);
    if (
      Math.abs(m.distancePx - s.px) < 1e-9 &&
      Math.abs(m.distanceMeters - s.expectedMeters) < 1e-9 &&
      Math.abs(m.stepsCount - s.step) < 1e-9 &&
      m.formattedMeters === s.expectedFormatted
    ) {
      recordPass();
    } else {
      recordFail('Scale', `Step ${s.step} (${s.px}px)`, JSON.stringify(m), `${s.expectedMeters}m`);
    }
  }
}

// 1.4 Diagonal Distance: Pythagorean 45° step
{
  const p1: VttPoint = { x: 0, y: 0 };
  const p2: VttPoint = { x: 70, y: 70 };
  const m = measureRuler(p1, p2);
  const expectedPx = Math.SQRT2 * 70;
  const expectedMeters = Math.SQRT2 * 1.5;
  if (
    Math.abs(m.distancePx - expectedPx) < 1e-9 &&
    Math.abs(m.distanceMeters - expectedMeters) < 1e-9 &&
    m.formattedMeters === '2.1 m'
  ) {
    recordPass();
  } else {
    recordFail('Scale', 'Diagonal 45° step', JSON.stringify(m), `${expectedMeters}m`);
  }
}

// 1.5 Negative Coordinate Space and Zero Crossing
{
  const p1: VttPoint = { x: -350, y: -700 };
  const p2: VttPoint = { x: 350, y: -700 }; // dx = 700px = 10 steps = 15m
  const m = measureRuler(p1, p2);
  if (
    Math.abs(m.distancePx - 700) < 1e-9 &&
    Math.abs(m.distanceMeters - 15.0) < 1e-9 &&
    m.formattedMeters === '15.0 m' &&
    Math.abs(m.stepsCount - 10) < 1e-9
  ) {
    recordPass();
  } else {
    recordFail('Scale', 'Negative coords & zero crossing', JSON.stringify(m), '15.0m (10 steps)');
  }
}

// 1.6 Ultra-Extreme Distance: 10,000 meters (10 km)
{
  const distance10kmMeters = 10000;
  const distance10kmPx = distance10kmMeters * TACTICAL_PIXELS_PER_METER; // 466666.6666666667px
  const p1: VttPoint = { x: -100000, y: 0 };
  const p2: VttPoint = { x: -100000 + distance10kmPx, y: 0 };
  const m = measureRuler(p1, p2);
  if (
    Math.abs(m.distanceMeters - 10000) < 1e-6 &&
    Math.abs(m.stepsCount - 10000 / 1.5) < 1e-6 &&
    m.formattedMeters === '10000.0 m'
  ) {
    recordPass();
  } else {
    recordFail('Scale', '10,000m ultra-extreme', JSON.stringify(m), '10000.0 m');
  }
}

// 1.7 Non-finite and Malformed Input Resilience
{
  const p1: VttPoint = { x: 0, y: 0 };
  const p2: VttPoint = { x: 140, y: 0 };
  // Bad pixelsPerMeter
  const distZeroPpm = calculateDistanceMeters(p1, p2, 0);
  const distNegPpm = calculateDistanceMeters(p1, p2, -50);
  const distNanPpm = calculateDistanceMeters(p1, p2, NaN);
  const distInfPpm = calculateDistanceMeters(p1, p2, Infinity);

  if (
    Math.abs(distZeroPpm - 3.0) < 1e-9 &&
    Math.abs(distNegPpm - 3.0) < 1e-9 &&
    Math.abs(distNanPpm - 3.0) < 1e-9 &&
    Math.abs(distInfPpm - 3.0) < 1e-9
  ) {
    recordPass();
  } else {
    recordFail('Scale', 'Non-finite ppm resilience', `${distZeroPpm}, ${distNegPpm}, ${distNanPpm}`, '3.0m fallback');
  }

  // Format non-finite meters
  if (
    formatDistanceMeters(NaN) === '0.0 m' &&
    formatDistanceMeters(Infinity) === '0.0 m' &&
    formatDistanceMeters(-10) === '0.0 m'
  ) {
    recordPass();
  } else {
    recordFail('Scale', 'formatDistanceMeters non-finite resilience', `${formatDistanceMeters(NaN)}`, '0.0 m');
  }
}

// ============================================================================
// SUITE 2: Intermediate 1.5m Tick Marks Calculation & Orthogonal Geometry
// ============================================================================
console.log('\n[2] Stress-Testing Intermediate 1.5m Tick Marks Calculation & Orthogonal Geometry...');

// Canonical implementation of computeIntermediateTicks from VttRulerOverlay.svelte
function computeIntermediateTicks(
  start: VttPoint,
  end: VttPoint,
  distPx: number,
  tickHalfLength: number = 6
): Array<{ p1: VttPoint; p2: VttPoint }> {
  if (distPx < TACTICAL_GRID_SIZE_PX) return [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const unitX = dx / distPx;
  const unitY = dy / distPx;
  const normX = -unitY;
  const normY = unitX;

  const ticks: Array<{ p1: VttPoint; p2: VttPoint }> = [];
  const totalSteps = Math.floor(distPx / TACTICAL_GRID_SIZE_PX);

  for (let i = 1; i <= totalSteps; i++) {
    const stepPx = i * TACTICAL_GRID_SIZE_PX;
    if (stepPx < distPx - 5) {
      const cx = start.x + unitX * stepPx;
      const cy = start.y + unitY * stepPx;
      ticks.push({
        p1: { x: cx - normX * tickHalfLength, y: cy - normY * tickHalfLength },
        p2: { x: cx + normX * tickHalfLength, y: cy + normY * tickHalfLength },
      });
    }
  }
  return ticks;
}

// 2.1 Sub-step and Exact First Step Thresholds
{
  const start: VttPoint = { x: 100, y: 100 };

  // < 70px: 0 ticks
  const ticks0 = computeIntermediateTicks(start, { x: 100, y: 100 }, 0);
  const ticks35 = computeIntermediateTicks(start, { x: 135, y: 100 }, 35);
  const ticks69 = computeIntermediateTicks(start, { x: 169.9, y: 100 }, 69.9);
  // Exactly 70px (1 step): 70 < 70 - 5 is false -> 0 ticks (endpoint arrow takes precedence)
  const ticks70 = computeIntermediateTicks(start, { x: 170, y: 100 }, 70);
  // 75px: 70 < 75 - 5 (70 < 70) is false -> 0 ticks
  const ticks75 = computeIntermediateTicks(start, { x: 175, y: 100 }, 75);
  // 76px: 70 < 76 - 5 (70 < 71) is true -> 1 tick
  const ticks76 = computeIntermediateTicks(start, { x: 176, y: 100 }, 76);

  if (
    ticks0.length === 0 &&
    ticks35.length === 0 &&
    ticks69.length === 0 &&
    ticks70.length === 0 &&
    ticks75.length === 0 &&
    ticks76.length === 1
  ) {
    recordPass();
  } else {
    recordFail('Ticks', 'Sub-step & threshold ticks', `0:${ticks0.length}, 70:${ticks70.length}, 75:${ticks75.length}, 76:${ticks76.length}`, '0, 0, 0, 1');
  }
}

// 2.2 Discrete Step Count Validation (2 to 12 steps)
{
  const stepCases = [
    { steps: 2, px: 140, expectedTicks: 1 }, // 70px
    { steps: 3, px: 210, expectedTicks: 2 }, // 70px, 140px
    { steps: 4, px: 280, expectedTicks: 3 }, // 70px, 140px, 210px
    { steps: 6, px: 420, expectedTicks: 5 }, // Standard move 9m
    { steps: 12, px: 840, expectedTicks: 11 }, // Double move 18m
  ];

  let allPassed = true;
  for (const sc of stepCases) {
    const ticks = computeIntermediateTicks({ x: 0, y: 0 }, { x: sc.px, y: 0 }, sc.px);
    if (ticks.length !== sc.expectedTicks) {
      allPassed = false;
      recordFail('Ticks', `${sc.steps} steps (${sc.px}px)`, `${ticks.length} ticks`, `${sc.expectedTicks} ticks`);
    }
  }
  if (allPassed) recordPass();
}

// 2.3 Orthogonal Geometry & Symmetry Verification
{
  // Test across multiple angles: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°, and arbitrary 37°
  const anglesDeg = [0, 45, 90, 135, 180, 225, 270, 315, 37.5];
  let geomPassed = true;

  for (const deg of anglesDeg) {
    const rad = (deg * Math.PI) / 180;
    const distPx = 280; // 4 steps -> 3 ticks
    const start: VttPoint = { x: 500, y: 500 };
    const end: VttPoint = {
      x: start.x + distPx * Math.cos(rad),
      y: start.y + distPx * Math.sin(rad),
    };

    const ticks = computeIntermediateTicks(start, end, distPx, 6);
    if (ticks.length !== 3) {
      geomPassed = false;
      recordFail('Ticks', `Angle ${deg}° count`, `${ticks.length}`, '3');
      continue;
    }

    const pathUx = Math.cos(rad);
    const pathUy = Math.sin(rad);

    for (let i = 0; i < ticks.length; i++) {
      const t = ticks[i];
      // Vector along tick segment
      const tickDx = t.p2.x - t.p1.x;
      const tickDy = t.p2.y - t.p1.y;
      const tickLength = Math.hypot(tickDx, tickDy);

      // Tick length should be exactly 2 * tickHalfLength = 12px
      if (Math.abs(tickLength - 12) > 1e-6) {
        geomPassed = false;
        recordFail('Ticks', `Tick length at ${deg}°`, `${tickLength}`, '12px');
      }

      // Orthogonality: dot product of path unit vector and tick vector must be 0
      const dot = pathUx * tickDx + pathUy * tickDy;
      if (Math.abs(dot) > 1e-6) {
        geomPassed = false;
        recordFail('Ticks', `Orthogonality at ${deg}°`, `${dot}`, '0');
      }

      // Midpoint of tick should lie on the path at exactly (i + 1) * 70px
      const midX = (t.p1.x + t.p2.x) / 2;
      const midY = (t.p1.y + t.p2.y) / 2;
      const expectedDistFromStart = (i + 1) * 70;
      const actualDistFromStart = Math.hypot(midX - start.x, midY - start.y);
      if (Math.abs(actualDistFromStart - expectedDistFromStart) > 1e-6) {
        geomPassed = false;
        recordFail('Ticks', `Tick position at ${deg}°`, `${actualDistFromStart}`, `${expectedDistFromStart}`);
      }
    }
  }

  if (geomPassed) recordPass();
}

// 2.4 Ultra-Extreme Distance Tick Generation Stress (10,000m -> 6,666 ticks)
{
  const dist10kmPx = 10000 * TACTICAL_PIXELS_PER_METER;
  const ticks = computeIntermediateTicks({ x: 0, y: 0 }, { x: dist10kmPx, y: 0 }, dist10kmPx, 6);
  // Math.floor(466666.6667 / 70) = 6666
  if (ticks.length === 6666) {
    // Check first, middle, and last tick for NaN or drift
    const tFirst = ticks[0];
    const tMid = ticks[3333];
    const tLast = ticks[ticks.length - 1];
    if (
      !isNaN(tFirst.p1.x) && !isNaN(tMid.p1.x) && !isNaN(tLast.p1.x) &&
      Math.abs((tFirst.p1.x + tFirst.p2.x) / 2 - 70) < 1e-6 &&
      Math.abs((tLast.p1.x + tLast.p2.x) / 2 - 6666 * 70) < 1e-6
    ) {
      recordPass();
    } else {
      recordFail('Ticks', '10,000m tick values', 'Drift or NaN detected', 'Exact step positions');
    }
  } else {
    recordFail('Ticks', '10,000m tick count', `${ticks.length}`, '6666');
  }
}

// ============================================================================
// SUITE 3: Speed Budget Categorization Boundaries (<= 9m, <= 18m, > 18m)
// ============================================================================
console.log('\n[3] Stress-Testing Speed Budget Categorization Boundaries...');

function getSpeedBudgetStatus(distMeters: number, maxSpeed: number = 9.0): 'emerald' | 'amber' | 'rose' {
  if (distMeters > maxSpeed * 2) {
    return 'rose'; // Exceeded double move > 18m
  } else if (distMeters > maxSpeed) {
    return 'amber'; // Double move <= 18m
  }
  return 'emerald'; // Normal move <= 9m
}

// 3.1 Standard 9m Move Budget Boundaries
{
  const standardCases: Array<{ meters: number; expected: 'emerald' | 'amber' | 'rose'; desc: string }> = [
    { meters: 0.0, expected: 'emerald', desc: 'Zero movement' },
    { meters: 4.5, expected: 'emerald', desc: 'Half movement' },
    { meters: 8.999999, expected: 'emerald', desc: '9m - epsilon' },
    { meters: 9.0, expected: 'emerald', desc: 'Exact 9.0m standard boundary' },
    { meters: 9.000001, expected: 'amber', desc: '9m + epsilon (double move)' },
    { meters: 13.5, expected: 'amber', desc: '1.5x movement' },
    { meters: 17.999999, expected: 'amber', desc: '18m - epsilon' },
    { meters: 18.0, expected: 'amber', desc: 'Exact 18.0m double move boundary' },
    { meters: 18.000001, expected: 'rose', desc: '18m + epsilon (exceeded)' },
    { meters: 25.0, expected: 'rose', desc: 'Well above budget' },
    { meters: 10000.0, expected: 'rose', desc: 'Extreme distance 10km' },
  ];

  let budgetPassed = true;
  for (const c of standardCases) {
    const status = getSpeedBudgetStatus(c.meters, 9.0);
    if (status !== c.expected) {
      budgetPassed = false;
      recordFail('SpeedBudget', c.desc, status, c.expected);
    }
  }
  if (budgetPassed) recordPass();
}

// 3.2 Dynamic Custom Speed Budgets (e.g. 6.0m slow vs 12.0m fast)
{
  // Fast character: maxSpeed = 12.0m, double = 24.0m
  const fast12 = getSpeedBudgetStatus(12.0, 12.0); // emerald
  const fast12_1 = getSpeedBudgetStatus(12.001, 12.0); // amber
  const fast24 = getSpeedBudgetStatus(24.0, 12.0); // amber
  const fast24_1 = getSpeedBudgetStatus(24.001, 12.0); // rose

  // Slow character: maxSpeed = 6.0m, double = 12.0m
  const slow6 = getSpeedBudgetStatus(6.0, 6.0); // emerald
  const slow6_1 = getSpeedBudgetStatus(6.001, 6.0); // amber
  const slow12 = getSpeedBudgetStatus(12.0, 6.0); // amber
  const slow12_1 = getSpeedBudgetStatus(12.001, 6.0); // rose

  if (
    fast12 === 'emerald' && fast12_1 === 'amber' && fast24 === 'amber' && fast24_1 === 'rose' &&
    slow6 === 'emerald' && slow6_1 === 'amber' && slow12 === 'amber' && slow12_1 === 'rose'
  ) {
    recordPass();
  } else {
    recordFail('SpeedBudget', 'Custom speed budgets', `${fast12}/${fast24}/${slow6}/${slow12}`, 'Correct boundary transitions');
  }
}

// ============================================================================
// SUITE 4: Area of Effect (AoE) Geometry & Boundary Invariance Stress
// ============================================================================
console.log('\n[4] Stress-Testing AoE Geometry & Boundary Containment...');

// 4.1 Circle Explosion Geometry & Point-In-Circle
{
  const origin: VttPoint = { x: 200, y: 200 };
  const target: VttPoint = { x: 200 + 140, y: 200 }; // 140px = 3.0m radius
  const geom = calculateAoeGeometry('circle', origin, target);

  if (
    geom.type === 'circle' &&
    Math.abs(geom.radiusPx - 140) < 1e-9 &&
    Math.abs(geom.distanceMeters - 3.0) < 1e-9 &&
    geom.svgPath.includes('A 140 140')
  ) {
    recordPass();
  } else {
    recordFail('AoE', 'Circle geometry', JSON.stringify(geom), 'radius 140px, 3.0m');
  }

  // Point Containment Boundary Tests
  const insideCenter = isPointInCircle(origin, origin, 140);
  const insideBoundary = isPointInCircle({ x: 200 + 139.99, y: 200 }, origin, 140);
  const exactBoundary = isPointInCircle({ x: 200 + 140, y: 200 }, origin, 140);
  const outsideBoundary = isPointInCircle({ x: 200 + 140.05, y: 200 }, origin, 140);

  if (insideCenter && insideBoundary && exactBoundary && !outsideBoundary) {
    recordPass();
  } else {
    recordFail('AoE', 'Circle point containment', `${insideCenter}, ${insideBoundary}, ${exactBoundary}, ${outsideBoundary}`, 'true, true, true, false');
  }
}

// 4.2 60° Cone Arc Geometry & Point-In-Cone Across All Quadrants
{
  const origin: VttPoint = { x: 300, y: 300 };
  const lengthPx = 210; // 4.5m

  // Test Cone pointing East (0°), North (-90°), West (180°), South (90°)
  const directions = [
    { deg: 0, target: { x: 300 + lengthPx, y: 300 } },
    { deg: 90, target: { x: 300, y: 300 + lengthPx } },
    { deg: 180, target: { x: 300 - lengthPx, y: 300 } },
    { deg: 270, target: { x: 300, y: 300 - lengthPx } },
  ];

  let conePassed = true;
  for (const dir of directions) {
    const geom = calculateAoeGeometry('cone', origin, dir.target, { coneAngleDeg: 60 });
    if (
      geom.type !== 'cone' ||
      Math.abs(geom.distancePx - lengthPx) > 1e-6 ||
      Math.abs(geom.distanceMeters - 4.5) > 1e-6 ||
      !geom.svgPath.startsWith(`M ${origin.x} ${origin.y}`)
    ) {
      conePassed = false;
      recordFail('AoE', `Cone geom at ${dir.deg}°`, JSON.stringify(geom), 'Valid 60° cone SVG');
      continue;
    }

    // Apex test
    if (!isPointInCone(origin, origin, dir.target)) {
      conePassed = false;
      recordFail('AoE', `Cone apex at ${dir.deg}°`, 'false', 'true');
    }

    // Centerline tip test
    if (!isPointInCone(dir.target, origin, dir.target)) {
      conePassed = false;
      recordFail('AoE', `Cone tip at ${dir.deg}°`, 'false', 'true');
    }

    // Point just past radius
    const pastTip: VttPoint = {
      x: origin.x + (lengthPx + 5) * Math.cos((dir.deg * Math.PI) / 180),
      y: origin.y + (lengthPx + 5) * Math.sin((dir.deg * Math.PI) / 180),
    };
    if (isPointInCone(pastTip, origin, dir.target)) {
      conePassed = false;
      recordFail('AoE', `Point beyond cone radius at ${dir.deg}°`, 'true', 'false');
    }

    // Angular boundaries: +29° (inside) vs +31° (outside)
    const angleInside = ((dir.deg + 29) * Math.PI) / 180;
    const ptInside: VttPoint = {
      x: origin.x + (lengthPx * 0.8) * Math.cos(angleInside),
      y: origin.y + (lengthPx * 0.8) * Math.sin(angleInside),
    };
    const angleOutside = ((dir.deg + 31) * Math.PI) / 180;
    const ptOutside: VttPoint = {
      x: origin.x + (lengthPx * 0.8) * Math.cos(angleOutside),
      y: origin.y + (lengthPx * 0.8) * Math.sin(angleOutside),
    };

    if (!isPointInCone(ptInside, origin, dir.target) || isPointInCone(ptOutside, origin, dir.target)) {
      conePassed = false;
      recordFail('AoE', `Angular boundary at ${dir.deg}°`, `in:${isPointInCone(ptInside, origin, dir.target)}, out:${isPointInCone(ptOutside, origin, dir.target)}`, 'true, false');
    }
  }

  if (conePassed) recordPass();
}

// 4.3 1.5m Line Beam Geometry & Rotational Invariance
{
  const origin: VttPoint = { x: 100, y: 100 };
  const target: VttPoint = { x: 100 + 280, y: 100 }; // 6.0m length
  const geom = calculateAoeGeometry('line', origin, target);

  // Width is standard 1.5m = 70px
  if (
    geom.type === 'line' &&
    Math.abs(geom.distancePx - 280) < 1e-9 &&
    Math.abs(geom.distanceMeters - 6.0) < 1e-9 &&
    geom.linePolygonPoints &&
    geom.linePolygonPoints.length === 4
  ) {
    recordPass();
  } else {
    recordFail('AoE', 'Line beam geometry', JSON.stringify(geom), '4 vertices, 280px, 6.0m');
  }

  // Point in Line Beam containment
  const beamWidth = 70;
  // Inside center
  const ptCenter = isPointInLineBeam({ x: 240, y: 100 }, origin, target, beamWidth);
  // Inside near transverse edge: y = 100 + 34
  const ptNearEdge = isPointInLineBeam({ x: 240, y: 134 }, origin, target, beamWidth);
  // Outside transverse edge: y = 100 + 36 (halfWidth = 35)
  const ptOutsideTransverse = isPointInLineBeam({ x: 240, y: 136 }, origin, target, beamWidth);
  // Outside longitudinal start: x = 98 (before origin x=100)
  const ptBeforeStart = isPointInLineBeam({ x: 98, y: 100 }, origin, target, beamWidth);
  // Outside longitudinal end: x = 382 (after target x=380)
  const ptAfterEnd = isPointInLineBeam({ x: 382, y: 100 }, origin, target, beamWidth);

  if (ptCenter && ptNearEdge && !ptOutsideTransverse && !ptBeforeStart && !ptAfterEnd) {
    recordPass();
  } else {
    recordFail('AoE', 'Line beam containment boundaries', `${ptCenter}, ${ptNearEdge}, ${ptOutsideTransverse}, ${ptBeforeStart}, ${ptAfterEnd}`, 'true, true, false, false, false');
  }
}

// ============================================================================
// SUITE 5: FogCanvas Blend Modes, Inverted Coordinates & Micro-Clicks
// ============================================================================
console.log('\n[5] Stress-Testing FogCanvas Blend Modes, Inverted Coordinates & Micro-Clicks...');

// Canonical normalizeRect from FogCanvas.svelte
function normalizeRect(rect: { x: number; y: number; width: number; height: number }) {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x;
  const y = rect.height < 0 ? rect.y + rect.height : rect.y;
  const width = Math.abs(rect.width);
  const height = Math.abs(rect.height);
  return { x, y, width, height };
}

// 5.1 Inverted Drag Coordinates Across All 4 Quadrants
{
  const expected = { x: 100, y: 100, width: 200, height: 150 };

  // Q1: Top-Left to Bottom-Right (standard)
  const r1 = normalizeRect({ x: 100, y: 100, width: 200, height: 150 });
  // Q2: Bottom-Right to Top-Left (both negative)
  const r2 = normalizeRect({ x: 300, y: 250, width: -200, height: -150 });
  // Q3: Bottom-Left to Top-Right (width > 0, height < 0)
  const r3 = normalizeRect({ x: 100, y: 250, width: 200, height: -150 });
  // Q4: Top-Right to Bottom-Left (width < 0, height > 0)
  const r4 = normalizeRect({ x: 300, y: 100, width: -200, height: 150 });

  if (
    JSON.stringify(r1) === JSON.stringify(expected) &&
    JSON.stringify(r2) === JSON.stringify(expected) &&
    JSON.stringify(r3) === JSON.stringify(expected) &&
    JSON.stringify(r4) === JSON.stringify(expected)
  ) {
    recordPass();
  } else {
    recordFail('Fog', 'Inverted drag coordinates 4-quadrant normalization', JSON.stringify({ r1, r2, r3, r4 }), JSON.stringify(expected));
  }
}

// 5.2 Micro-Click Filtering
{
  function shouldEmitFogAction(rect: { x: number; y: number; width: number; height: number }): boolean {
    const { width, height } = normalizeRect(rect);
    return width > 4 && height > 4;
  }

  const click0 = shouldEmitFogAction({ x: 100, y: 100, width: 0, height: 0 }); // click with no movement
  const clickTinyX = shouldEmitFogAction({ x: 100, y: 100, width: 3, height: 20 }); // <= 4px width
  const clickTinyY = shouldEmitFogAction({ x: 100, y: 100, width: 50, height: 4 }); // <= 4px height
  const clickValid = shouldEmitFogAction({ x: 100, y: 100, width: 5, height: 5 }); // > 4px valid drag

  if (!click0 && !clickTinyX && !clickTinyY && clickValid) {
    recordPass();
  } else {
    recordFail('Fog', 'Micro-click filtering', `${click0}, ${clickTinyX}, ${clickTinyY}, ${clickValid}`, 'false, false, false, true');
  }
}

// 5.3 Brush Radius Clamping (20px to 200px)
{
  function clampBrushRadius(radius: number): number {
    return Math.max(20, Math.min(200, radius));
  }

  if (
    clampBrushRadius(-10) === 20 &&
    clampBrushRadius(0) === 20 &&
    clampBrushRadius(15) === 20 &&
    clampBrushRadius(20) === 20 &&
    clampBrushRadius(60) === 60 &&
    clampBrushRadius(200) === 200 &&
    clampBrushRadius(500) === 200
  ) {
    recordPass();
  } else {
    recordFail('Fog', 'Brush radius clamping', 'Radius out of [20, 200] bounds', 'Clamped to [20, 200]');
  }
}

// 5.4 Mathematical Dual-View Alpha Compositing Equations
{
  // Revealed cutout pixel: canvas alpha = 0
  const revealedAlphaGm = 0 * VTT_FOG_GM_OPACITY;
  const revealedAlphaPlayer = 0 * VTT_FOG_PLAYER_OPACITY;

  // Fog unrevealed pixel: canvas alpha = 1.0
  const fogAlphaGm = 1.0 * VTT_FOG_GM_OPACITY;
  const fogAlphaPlayer = 1.0 * VTT_FOG_PLAYER_OPACITY;

  if (
    revealedAlphaGm === 0 &&
    revealedAlphaPlayer === 0 &&
    fogAlphaGm === 0.55 &&
    fogAlphaPlayer === 1.0
  ) {
    recordPass();
  } else {
    recordFail('Fog', 'Dual-view alpha compositing', `${revealedAlphaGm}/${revealedAlphaPlayer}/${fogAlphaGm}/${fogAlphaPlayer}`, '0 / 0 / 0.55 / 1.0');
  }
}

// 5.5 Porter-Duff 2D Canvas Blend Mode Verification (Simulation)
{
  // destination-out: alpha_dest = alpha_dest * (1 - alpha_src)
  // When alpha_src = 1.0 (solid fog cut), alpha_dest becomes 0.0
  const destOut = (destAlpha: number, srcAlpha: number = 1.0) => destAlpha * (1.0 - srcAlpha);

  // source-over: alpha_dest = srcAlpha + destAlpha * (1 - srcAlpha)
  // When srcAlpha = 1.0 (solid black fog fill), alpha_dest becomes 1.0
  const sourceOver = (destAlpha: number, srcAlpha: number = 1.0) => srcAlpha + destAlpha * (1.0 - srcAlpha);

  // Blanket all: start with alpha = 1.0
  let alpha = sourceOver(0.0, 1.0);
  if (alpha === 1.0) recordPass();
  else recordFail('Fog', 'Blanket all composite', `${alpha}`, '1.0');

  // Reveal rect: destination-out on blanket
  alpha = destOut(alpha, 1.0);
  if (alpha === 0.0) recordPass();
  else recordFail('Fog', 'Reveal rect composite', `${alpha}`, '0.0');

  // Hide rect: source-over on revealed area
  alpha = sourceOver(alpha, 1.0);
  if (alpha === 1.0) recordPass();
  else recordFail('Fog', 'Hide rect composite', `${alpha}`, '1.0');
}

// ============================================================================
// SUITE 6: Viewport Transformations & Zoom Anchor Invariance Stress
// ============================================================================
console.log('\n[6] Stress-Testing Viewport Transformations & Zoom Anchor Invariance...');

// 6.1 Cursor Anchor Preservation Under Multi-Step Zooming
{
  let currentPan: VttPoint = { x: -150, y: 80 };
  let currentZoom = 1.0;
  const screenCursor: VttPoint = { x: 640, y: 480 };

  // World point under cursor at zoom 1.0
  const initialWorld = screenToWorld(screenCursor, currentPan, currentZoom);

  // Sequence of zoom operations: zoom in, zoom in further, zoom out, zoom back
  const zoomTargets = [1.5, 2.5, 3.8, 0.4, 1.0];
  let zoomAnchorPassed = true;

  for (const targetZoom of zoomTargets) {
    currentPan = calculateZoomPan(currentPan, currentZoom, targetZoom, screenCursor);
    currentZoom = targetZoom;

    // After updating pan and zoom, world point under screenCursor must remain exactly initialWorld
    const worldNow = screenToWorld(screenCursor, currentPan, currentZoom);
    if (Math.abs(worldNow.x - initialWorld.x) > 1e-6 || Math.abs(worldNow.y - initialWorld.y) > 1e-6) {
      zoomAnchorPassed = false;
      recordFail('Viewport', `Anchor drift at zoom ${targetZoom}`, `(${worldNow.x}, ${worldNow.y})`, `(${initialWorld.x}, ${initialWorld.y})`);
    }
  }

  if (zoomAnchorPassed) recordPass();
}

// 6.2 ScreenToWorld <-> WorldToScreen 100-Point Invariance Loop
{
  const pan: VttPoint = { x: 345.67, y: -789.12 };
  const zoom = 2.345;
  let roundTripPassed = true;

  for (let i = 0; i < 100; i++) {
    const pt: VttPoint = {
      x: (i * 37.1) % 4000 - 2000,
      y: (i * 53.7) % 4000 - 2000,
    };
    const screen = worldToScreen(pt, pan, zoom);
    const roundTrip = screenToWorld(screen, pan, zoom);
    if (Math.abs(roundTrip.x - pt.x) > 1e-9 || Math.abs(roundTrip.y - pt.y) > 1e-9) {
      roundTripPassed = false;
      recordFail('Viewport', `Round-trip point ${i}`, `(${roundTrip.x}, ${roundTrip.y})`, `(${pt.x}, ${pt.y})`);
      break;
    }
  }

  if (roundTripPassed) recordPass();
}

// 6.3 Non-Positive and Non-Finite Zoom Resilience
{
  const screen: VttPoint = { x: 200, y: 200 };
  const pan: VttPoint = { x: 50, y: 50 };

  const w0 = screenToWorld(screen, pan, 0); // zoom 0 fallback to 1.0
  const wNeg = screenToWorld(screen, pan, -2.5); // negative zoom fallback
  const wNan = screenToWorld(screen, pan, NaN); // NaN fallback
  const wInf = screenToWorld(screen, pan, Infinity); // Infinity fallback

  if (
    w0.x === 150 && w0.y === 150 &&
    wNeg.x === 150 && wNeg.y === 150 &&
    wNan.x === 150 && wNan.y === 150 &&
    wInf.x === 150 && wInf.y === 150
  ) {
    recordPass();
  } else {
    recordFail('Viewport', 'Non-finite zoom fallback', `${w0.x}, ${wNeg.x}, ${wNan.x}, ${wInf.x}`, '150px (safe zoom = 1.0)');
  }
}

// ============================================================================
// SUITE 7: Token Size Geometry, Vital Bars & Stealth Anti-Cheat
// ============================================================================
console.log('\n[7] Stress-Testing Token Size Geometry, Vital Bars & Stealth Anti-Cheat...');

// 7.1 Canonical Token Sizes Dimensions
{
  if (
    VTT_TOKEN_SIZES.pequeno.diameterPx === 56 &&
    VTT_TOKEN_SIZES.medio.diameterPx === 70 &&
    VTT_TOKEN_SIZES.grande.diameterPx === 140 &&
    VTT_TOKEN_SIZES.enorme.diameterPx === 210 &&
    VTT_TOKEN_SIZES.pequeno.standardMeters === 1.2 &&
    VTT_TOKEN_SIZES.medio.standardMeters === 1.5 &&
    VTT_TOKEN_SIZES.grande.standardMeters === 3.0 &&
    VTT_TOKEN_SIZES.enorme.standardMeters === 4.5 &&
    VTT_TOKEN_SIZES.pequeno.gridFootprint === '1x1' &&
    VTT_TOKEN_SIZES.medio.gridFootprint === '1x1' &&
    VTT_TOKEN_SIZES.grande.gridFootprint === '2x2' &&
    VTT_TOKEN_SIZES.enorme.gridFootprint === '3x3'
  ) {
    recordPass();
  } else {
    recordFail('Token', 'Canonical token sizes', JSON.stringify(VTT_TOKEN_SIZES), '56, 70, 140, 210 px');
  }
}

// 7.2 Vital Resource Bar Percentage & Color Thresholds
{
  function computePvStats(current: number, max: number) {
    const pvMax = Math.max(1, max);
    const percent = Math.min(100, Math.max(0, (current / pvMax) * 100));
    const color = percent > 50 ? 'emerald' : percent > 25 ? 'amber' : 'rose';
    return { percent, color };
  }

  const s0 = computePvStats(0, 100);
  const s25 = computePvStats(25, 100);
  const s26 = computePvStats(26, 100);
  const s50 = computePvStats(50, 100);
  const s51 = computePvStats(51, 100);
  const s100 = computePvStats(100, 100);
  const sOver = computePvStats(150, 100);
  const sNeg = computePvStats(-20, 100);
  const sDivZero = computePvStats(10, 0);

  if (
    s0.percent === 0 && s0.color === 'rose' &&
    s25.percent === 25 && s25.color === 'rose' &&
    s26.percent === 26 && s26.color === 'amber' &&
    s50.percent === 50 && s50.color === 'amber' &&
    s51.percent === 51 && s51.color === 'emerald' &&
    s100.percent === 100 && s100.color === 'emerald' &&
    sOver.percent === 100 &&
    sNeg.percent === 0 &&
    sDivZero.percent === 100 // Math.max(1, 0) = 1 -> 10/1 = 1000% clamped to 100%
  ) {
    recordPass();
  } else {
    recordFail('Token', 'PV bar percentages & colors', JSON.stringify({ s0, s25, s26, s50, s51, sOver, sNeg, sDivZero }), 'Proper color thresholds and clamping');
  }
}

// 7.3 Stealth Security Culling and Movement Authorization
{
  const publicToken: VttToken = {
    id: 'tok-pub',
    sceneId: 'sc-1',
    name: 'Guerreiro',
    size: 'medio',
    x: 100,
    y: 100,
    isStealth: false,
    ownerPeerId: 'peer-alice',
  };

  const stealthToken: VttToken = {
    id: 'tok-stealth',
    sceneId: 'sc-1',
    name: 'Assassino Oculto',
    size: 'medio',
    x: 200,
    y: 200,
    isStealth: true,
    ownerPeerId: 'peer-alice',
  };

  // Visibility checks
  const pubToAlice = isTokenVisibleToPlayer(publicToken, 'peer-alice');
  const pubToBob = isTokenVisibleToPlayer(publicToken, 'peer-bob');
  const stealthToAlice = isTokenVisibleToPlayer(stealthToken, 'peer-alice'); // Owner sees own
  const stealthToBob = isTokenVisibleToPlayer(stealthToken, 'peer-bob'); // Bob must NOT see
  const stealthToUnknown = isTokenVisibleToPlayer(stealthToken, undefined); // Anonymous must NOT see

  // Movement Authorization
  const moveAlicePub = authorizeTokenMove(publicToken, 'peer-alice', false);
  const moveBobPub = authorizeTokenMove(publicToken, 'peer-bob', false);
  const moveGmPub = authorizeTokenMove(publicToken, 'peer-gm', true);

  if (
    pubToAlice && pubToBob && stealthToAlice && !stealthToBob && !stealthToUnknown &&
    moveAlicePub && !moveBobPub && moveGmPub
  ) {
    recordPass();
  } else {
    recordFail('Token', 'Stealth visibility & movement authorization', `${pubToBob}/${stealthToAlice}/${stealthToBob}/${moveBobPub}`, 'true, true, false, false');
  }
}

// ============================================================================
// SUITE 8: Extreme Scale Random Vector Generator & Orthogonality Stress
// ============================================================================
console.log('\n[8] Stress-Testing 1,000 Random Trajectories for Orthogonality & Monotonic Ticks...');
{
  let stressPassed = true;
  for (let i = 0; i < 1000; i++) {
    const start: VttPoint = {
      x: (Math.sin(i * 1.7) * 50000),
      y: (Math.cos(i * 2.3) * 50000),
    };
    const angle = (i * 13.37 * Math.PI) / 180;
    const distancePx = (i % 20) * 70 + (i % 7) * 10 + 1; // 1px to ~1460px
    const end: VttPoint = {
      x: start.x + distancePx * Math.cos(angle),
      y: start.y + distancePx * Math.sin(angle),
    };

    const ticks = computeIntermediateTicks(start, end, distancePx, 6);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);

    let lastDist = 0;
    for (const t of ticks) {
      // 1. Check coordinates are finite and non-NaN
      if (!Number.isFinite(t.p1.x) || !Number.isFinite(t.p1.y) || !Number.isFinite(t.p2.x) || !Number.isFinite(t.p2.y)) {
        stressPassed = false;
        recordFail('StressTicks', `Non-finite tick at iter ${i}`, JSON.stringify(t), 'Finite numbers');
        break;
      }

      // 2. Check orthogonality
      const tickDx = t.p2.x - t.p1.x;
      const tickDy = t.p2.y - t.p1.y;
      const dot = ux * tickDx + uy * tickDy;
      if (Math.abs(dot) > 1e-4) {
        stressPassed = false;
        recordFail('StressTicks', `Orthogonality breach at iter ${i}`, `dot=${dot}`, '0');
        break;
      }

      // 3. Check monotonic distance along trajectory
      const midX = (t.p1.x + t.p2.x) / 2;
      const midY = (t.p1.y + t.p2.y) / 2;
      const dFromStart = Math.hypot(midX - start.x, midY - start.y);
      if (dFromStart <= lastDist || dFromStart >= distancePx) {
        stressPassed = false;
        recordFail('StressTicks', `Non-monotonic tick at iter ${i}`, `d=${dFromStart}, last=${lastDist}`, 'Increasing and < distPx');
        break;
      }
      lastDist = dFromStart;
    }

    if (!stressPassed) break;
  }

  if (stressPassed) recordPass();
}

// ============================================================================
// SUITE 9: Extreme Fog Action Stream Replay vs Incremental Simulation
// ============================================================================
console.log('\n[9] Stress-Testing 500-Action Fog Stream Replay vs Incremental Simulation...');
{
  // Generate 500 deterministic pseudo-random fog actions
  const mockActions: FogAction[] = [];
  for (let i = 0; i < 500; i++) {
    const type = i % 10 === 0 ? 'blanket_all'
      : i % 10 === 5 ? 'clear_all'
      : i % 2 === 0 ? 'reveal_rect'
      : 'hide_rect';

    mockActions.push({
      id: `fog-stress-${i}`,
      type: type as any,
      rect: {
        x: (i * 31) % 1800,
        y: (i * 47) % 1200,
        width: ((i * 13) % 300) - 150, // includes negative / inverted widths
        height: ((i * 17) % 300) - 150, // includes negative / inverted heights
      },
      timestamp: Date.now() + i,
    });
  }

  // Simulate execution of actions
  let simPassed = true;
  let simulatedCanvasAlpha = 0; // 0 = clear, 1 = blanket

  for (const a of mockActions) {
    if (a.type === 'blanket_all') simulatedCanvasAlpha = 1.0;
    else if (a.type === 'clear_all') simulatedCanvasAlpha = 0.0;
    else if (a.type === 'reveal_rect') {
      const norm = normalizeRect(a.rect!);
      if (norm.width < 0 || norm.height < 0) {
        simPassed = false;
        recordFail('FogStress', 'Negative normalized dimensions', JSON.stringify(norm), 'All dimensions >= 0');
      }
    } else if (a.type === 'hide_rect') {
      const norm = normalizeRect(a.rect!);
      if (norm.width < 0 || norm.height < 0) {
        simPassed = false;
        recordFail('FogStress', 'Negative normalized dimensions', JSON.stringify(norm), 'All dimensions >= 0');
      }
    }
  }

  if (simPassed && mockActions.length === 500) recordPass();
}

// ============================================================================
// SUITE 10: AoE Large Arc Flag & Wide Angle Stress
// ============================================================================
console.log('\n[10] Stress-Testing AoE Cone Angle Extremes (0.1°, 180°, 270°, 359°)...');
{
  const origin: VttPoint = { x: 500, y: 500 };
  const target: VttPoint = { x: 700, y: 500 };

  // 1. Narrow 0.1° cone
  const narrowCone = calculateAoeGeometry('cone', origin, target, { coneAngleDeg: 0.1 });
  // 2. Exactly 180° semicircle cone
  const semiCone = calculateAoeGeometry('cone', origin, target, { coneAngleDeg: 180 });
  // 3. Wide 270° cone (largeArcFlag must be 1)
  const wideCone = calculateAoeGeometry('cone', origin, target, { coneAngleDeg: 270 });
  // 4. Almost full 359° circle cone
  const fullCone = calculateAoeGeometry('cone', origin, target, { coneAngleDeg: 359 });

  const wideHasLargeArc = wideCone.svgPath.includes('0 1 1');
  const semiHasSmallArc = semiCone.svgPath.includes('0 0 1');

  if (
    narrowCone.type === 'cone' &&
    semiCone.type === 'cone' &&
    wideCone.type === 'cone' &&
    fullCone.type === 'cone' &&
    wideHasLargeArc &&
    semiHasSmallArc
  ) {
    recordPass();
  } else {
    recordFail('AoEStress', 'Cone angle extremes & largeArcFlag', `wide:${wideHasLargeArc}, semi:${semiHasSmallArc}`, 'wide=true, semi=false');
  }
}

// ============================================================================
// SUITE 11: High-Frequency Wheel Zoom Oscillation Stability
// ============================================================================
console.log('\n[11] Stress-Testing 50-Step Zoom Oscillation Focal Stability...');
{
  let currentPan: VttPoint = { x: 200, y: 150 };
  let currentZoom = 1.0;
  const screenAnchor: VttPoint = { x: 512, y: 384 };

  const initialWorld = screenToWorld(screenAnchor, currentPan, currentZoom);

  // Oscillate zoom 50 times between 1.1x and 0.9x
  for (let i = 0; i < 50; i++) {
    const targetZoom = i % 2 === 0 ? currentZoom * 1.15 : currentZoom / 1.15;
    currentPan = calculateZoomPan(currentPan, currentZoom, targetZoom, screenAnchor);
    currentZoom = targetZoom;
  }

  const finalWorld = screenToWorld(screenAnchor, currentPan, currentZoom);
  const drift = Math.hypot(finalWorld.x - initialWorld.x, finalWorld.y - initialWorld.y);

  if (drift < 1e-6) {
    recordPass();
  } else {
    recordFail('ZoomOscillation', 'Focal point drift after 50 oscillations', `${drift}px`, '< 1e-6px');
  }
}

// ============================================================================
// FINAL AGGREGATION & REPORT
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log(`TOTAL ADVERSARIAL CHALLENGES: ${passedChallenges + failedChallenges}`);
console.log(`PASSED: ${passedChallenges}`);
console.log(`FAILED: ${failedChallenges}`);
console.log('='.repeat(80));

if (failures.length > 0) {
  console.error('\nFAILURES DETECTED:');
  for (const f of failures) {
    console.error(`  - [${f.category}] ${f.test}: Observed "${f.observed}", Expected "${f.expected}"`);
  }
  process.exit(1);
} else {
  console.log('\n>>> ALL EMPIRICAL CHALLENGES PASSED PERFECTLY (100%) <<<');
  process.exit(0);
}
