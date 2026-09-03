/**
 * tests/empirical_challenge_m1.ts
 * 
 * EMPIRICAL ADVERSARIAL CHALLENGE HARNESS FOR MILESTONE 1
 * 
 * Executed independently by Challenger 1.
 * Tests mathematical formulations, 1.5m tactical scale, AoE geometry,
 * Crockford Base32 room codes, anti-cheat security, and combat tracker state machine.
 */

import {
  generateRoomCode,
  normalizeRoomCode,
  validateRoomCode,
  roomCodeToHostPeerId,
  peerIdToRoomCode,
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
  sanitizeSceneForPlayer,
  authorizeTokenMove,
  sortCombatants,
  advanceTurn,
  previousTurn,
  getActiveCombatant,
  createCombatEncounter,
  parseDiceExpression,
  formatDiceResult,
  TACTICAL_GRID_SIZE_PX,
  TACTICAL_GRID_STEP_METERS,
  TACTICAL_PIXELS_PER_METER,
  TACTICAL_METERS_PER_PIXEL,
  CROCKFORD_BASE32_ALPHABET,
  ROOM_CODE_PREFIX,
  HOST_PEER_PREFIX,
} from '../src/lib/services/vtt/vttProtocol';

import {
  isVttTokenSize,
  isVttToken,
  isFogAction,
  isVttScene,
  isCombatant,
  isCombatEncounter,
  isVttPing,
  isDiceRollResult,
  isVttEnvelope,
  type VttScene,
  type VttToken,
  type Combatant,
  type CombatEncounter,
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
console.log('   CHALLENGER 1: EMPIRICAL ADVERSARIAL STRESS TEST SUITE (MILESTONE 1)');
console.log('='.repeat(80));

// ============================================================================
// SUITE 1: Crockford Base32 Room Code Engine & Host Peer Mapping
// ============================================================================
console.log('\n[1] Stress-Testing Crockford Base32 Room Code Engine...');

for (let i = 0; i < 20; i++) {
  const code = generateRoomCode();
  if (code.startsWith('ORD-') && code.length === 8 && validateRoomCode(code)) {
    recordPass();
  } else {
    recordFail('RoomCode', `generateRoomCode iteration ${i}`, code, 'ORD-XXXX (8 chars)');
  }
}

// Aliases
if (normalizeRoomCode('ORD-ILO2') === 'ORD-1102') recordPass();
else recordFail('RoomCode', 'Alias ORD-ILO2', String(normalizeRoomCode('ORD-ILO2')), 'ORD-1102');

if (normalizeRoomCode('ord-ilo2') === 'ORD-1102') recordPass();
else recordFail('RoomCode', 'Alias ord-ilo2', String(normalizeRoomCode('ord-ilo2')), 'ORD-1102');

if (normalizeRoomCode('iLoO') === 'ORD-1100') recordPass();
else recordFail('RoomCode', 'Mixed-case alias iLoO', String(normalizeRoomCode('iLoO')), 'ORD-1100');

// Whitespace & messy formatting
if (normalizeRoomCode('   ORD - ILO2   ') === 'ORD-1102') recordPass();
else recordFail('RoomCode', 'Messy whitespace', String(normalizeRoomCode('   ORD - ILO2   ')), 'ORD-1102');

// Excluded characters & invalid inputs
if (normalizeRoomCode('ORD-U123') === null) recordPass();
else recordFail('RoomCode', 'Excluded char U', String(normalizeRoomCode('ORD-U123')), 'null');

if (normalizeRoomCode('') === null) recordPass();
else recordFail('RoomCode', 'Empty string', String(normalizeRoomCode('')), 'null');

if (normalizeRoomCode('ORD-123') === null) recordPass();
else recordFail('RoomCode', 'Too short (3 chars)', String(normalizeRoomCode('ORD-123')), 'null');

if (normalizeRoomCode('ORD-12345') === null) recordPass();
else recordFail('RoomCode', 'Too long (5 chars)', String(normalizeRoomCode('ORD-12345')), 'null');

if (normalizeRoomCode(null as any) === null) recordPass();
else recordFail('RoomCode', 'Null input', String(normalizeRoomCode(null as any)), 'null');

// Peer ID roundtrip
const peerId = roomCodeToHostPeerId('ORD-7XYZ');
if (peerId === 'mural-vtt-ord7xyz' && peerIdToRoomCode(peerId) === 'ORD-7XYZ') recordPass();
else recordFail('RoomCode', 'Peer ID roundtrip', `${peerId} -> ${peerIdToRoomCode(peerId)}`, 'mural-vtt-ord7xyz -> ORD-7XYZ');

// ============================================================================
// SUITE 2: Viewport Navigation, Coordinate Transforms & Non-Finite Zoom
// ============================================================================
console.log('\n[2] Stress-Testing Viewport Transforms & Non-Finite Zoom...');

// Screen/world invertibility at regular zoom
const w0 = { x: 140, y: 210 };
const pan0 = { x: -50, y: 80 };
const z0 = 1.75;
const s0 = worldToScreen(w0, pan0, z0);
const wBack = screenToWorld(s0, pan0, z0);
if (Math.abs(wBack.x - w0.x) < 1e-4 && Math.abs(wBack.y - w0.y) < 1e-4) recordPass();
else recordFail('Viewport', 'Roundtrip screenToWorld', JSON.stringify(wBack), JSON.stringify(w0));

// Safe zoom clamping in screenToWorld
const sZero = screenToWorld({ x: 100, y: 100 }, { x: 0, y: 0 }, 0);
if (sZero.x === 100 && sZero.y === 100) recordPass();
else recordFail('Viewport', 'screenToWorld zoom=0', JSON.stringify(sZero), '{x:100,y:100}');

const sNeg = screenToWorld({ x: 100, y: 100 }, { x: 0, y: 0 }, -2);
if (sNeg.x === 100 && sNeg.y === 100) recordPass();
else recordFail('Viewport', 'screenToWorld zoom=-2', JSON.stringify(sNeg), '{x:100,y:100}');

// calculateZoomPan NaN Zoom Stress Test
const panNaN = calculateZoomPan({ x: 0, y: 0 }, NaN, 1.5, { x: 100, y: 100 });
if (!isNaN(panNaN.x) && !isNaN(panNaN.y)) {
  recordPass();
} else {
  recordFail('Viewport', 'calculateZoomPan with NaN zoom', JSON.stringify(panNaN), 'Finite coordinates (not NaN)');
}

// ============================================================================
// SUITE 3: 1.5m Continuous Measurement Scale & Ruler Math
// ============================================================================
console.log('\n[3] Stress-Testing 1.5m Continuous Measurement Scale...');

const dMeters = calculateDistanceMeters({ x: 0, y: 0 }, { x: 70, y: 0 });
if (Math.abs(dMeters - 1.5) < 1e-5 && formatMeters(dMeters) === '1.5 m') recordPass();
else recordFail('Ruler', '70px calibration', `${dMeters} m`, '1.5 m');

const rulerZero = measureRuler({ x: 50, y: 50 }, { x: 50, y: 50 });
if (rulerZero.distancePx === 0 && rulerZero.distanceMeters === 0 && rulerZero.formattedMeters === '0.0 m') recordPass();
else recordFail('Ruler', 'Zero distance ruler', JSON.stringify(rulerZero), 'distanceMeters: 0');

const extremeDist = calculateDistanceMeters({ x: -100000, y: -100000 }, { x: 100000, y: 100000 });
if (isFinite(extremeDist) && extremeDist > 6000) recordPass();
else recordFail('Ruler', 'Extreme distance >100k px', String(extremeDist), '>6000 m');

if (formatDistanceMeters(NaN) === '0.0 m' && formatDistanceMeters(-10) === '0.0 m') recordPass();
else recordFail('Ruler', 'Non-finite formatDistanceMeters', formatDistanceMeters(NaN), '0.0 m');

// ============================================================================
// SUITE 4: Area of Effect (AoE) Geometry & Boundary Containment
// ============================================================================
console.log('\n[4] Stress-Testing Area of Effect (AoE) Geometry & Boundary Containment...');

// --- 4.1 Circle Perimeter Floating-Point Invariant ---
const cOrig = { x: 500, y: 500 };
const cRad = 70;
let circlePerimeterFails = 0;
for (let deg = 0; deg < 360; deg += 5) {
  const rad = (deg * Math.PI) / 180;
  const perimeterPt = {
    x: cOrig.x + cRad * Math.cos(rad),
    y: cOrig.y + cRad * Math.sin(rad),
  };
  if (!isPointInCircle(perimeterPt, cOrig, cRad)) {
    circlePerimeterFails++;
  }
}
if (circlePerimeterFails === 0) {
  recordPass();
} else {
  recordFail('AoE_Circle', 'Circle Perimeter Boundary Containment', `${circlePerimeterFails}/72 perimeter angles failed`, '0/72 failures');
}

// --- 4.2 Cone Ray Boundary & Outer Arc Invariant Across 360° Rotations ---
const coneOrig = { x: 300, y: 300 };
const coneR = 140;
const halfAngle = Math.PI / 6; // 30°
let coneBoundaryFails = 0;

for (let deg = 0; deg < 360; deg += 15) {
  const rad = (deg * Math.PI) / 180;
  const target = {
    x: coneOrig.x + coneR * Math.cos(rad),
    y: coneOrig.y + coneR * Math.sin(rad),
  };

  // Apex containment
  if (isPointInCone(coneOrig, coneOrig, target, halfAngle)) recordPass();
  else recordFail('AoE_Cone', `Apex inside cone at ${deg}°`, 'false', 'true');

  // Centerline midpoint
  const mid = {
    x: coneOrig.x + (coneR * 0.5) * Math.cos(rad),
    y: coneOrig.y + (coneR * 0.5) * Math.sin(rad),
  };
  if (isPointInCone(mid, coneOrig, target, halfAngle)) recordPass();
  else recordFail('AoE_Cone', `Centerline point inside cone at ${deg}°`, 'false', 'true');

  // Boundary rays (+30° and -30°) at full arc radius
  const ray1 = {
    x: coneOrig.x + coneR * Math.cos(rad + halfAngle),
    y: coneOrig.y + coneR * Math.sin(rad + halfAngle),
  };
  const ray2 = {
    x: coneOrig.x + coneR * Math.cos(rad - halfAngle),
    y: coneOrig.y + coneR * Math.sin(rad - halfAngle),
  };

  if (!isPointInCone(ray1, coneOrig, target, halfAngle) || !isPointInCone(ray2, coneOrig, target, halfAngle)) {
    coneBoundaryFails++;
  }
}

if (coneBoundaryFails === 0) {
  recordPass();
} else {
  recordFail('AoE_Cone', 'Cone Boundary Ray & Outer Arc Containment', `${coneBoundaryFails}/24 angles failed boundary rays`, '0/24 failures');
}

// --- 4.3 Cone SVG Path Arc Flag for Major Sectors (> 180°) ---
const cone270 = calculateAoeGeometry('cone', coneOrig, { x: 400, y: 300 }, { coneAngleDeg: 270 });
if (cone270.svgPath && cone270.svgPath.includes('A 100 100 0 1 1')) {
  recordPass();
} else {
  recordFail('AoE_Cone', 'Cone 270° SVG Path Large Arc Flag', cone270.svgPath || '', 'Contains "A 100 100 0 1 1" (large-arc-flag: 1)');
}

// --- 4.4 Line Beam Target Point & Corner Vertices Containment ---
const lineOrig = { x: 100, y: 100 };
const lineLen = 210;
const lineW = 70;
let lineBeamFails = 0;

for (let deg = 0; deg < 360; deg += 15) {
  const rad = (deg * Math.PI) / 180;
  const target = {
    x: lineOrig.x + lineLen * Math.cos(rad),
    y: lineOrig.y + lineLen * Math.sin(rad),
  };

  // Origin point
  if (!isPointInLineBeam(lineOrig, lineOrig, target, lineW)) {
    lineBeamFails++;
  }

  // Target point itself!
  if (!isPointInLineBeam(target, lineOrig, target, lineW)) {
    lineBeamFails++;
    recordFail('AoE_Line', `Target point itself inside line beam at ${deg}°`, 'false', 'true');
  }

  // Generated corner vertices
  const aoeLine = calculateAoeGeometry('line', lineOrig, target, { lineWidthMeters: 1.5 });
  if (aoeLine.linePolygonPoints) {
    for (let ci = 0; ci < 4; ci++) {
      const corner = aoeLine.linePolygonPoints[ci];
      if (!isPointInLineBeam(corner, lineOrig, target, lineW)) {
        lineBeamFails++;
        recordFail('AoE_Line', `Generated polygon corner ${ci + 1} inside line beam at ${deg}°`, 'false', 'true');
      }
    }
  }
}

if (lineBeamFails === 0) {
  recordPass();
}

// ============================================================================
// SUITE 5: Anti-Cheat Stealth Filtering & Movement Authorization
// ============================================================================
console.log('\n[5] Stress-Testing Anti-Cheat Stealth Filtering & Authorization...');

const testScene: VttScene = {
  id: 'sc-1',
  name: 'Test',
  backgroundUrl: '',
  width: 1000,
  height: 1000,
  scaleRatio: 46.6667,
  tokens: [
    {
      id: 't-visible',
      name: 'V',
      x: 0,
      y: 0,
      size: 'medio',
      color: '#fff',
      pv: { current: 10, max: 10 },
      san: { current: 10, max: 10 },
      conditions: [],
      isStealth: false,
    },
    {
      id: 't-stealth-gm',
      name: 'Monster Stealth',
      x: 10,
      y: 10,
      size: 'grande',
      color: '#f00',
      pv: { current: 50, max: 50 },
      san: { current: 0, max: 0 },
      conditions: [],
      isStealth: true,
      ownerPeerId: 'gm',
      notes: 'Secret GM Lore',
    },
    {
      id: 't-stealth-p1',
      name: 'P1 Stealth',
      x: 20,
      y: 20,
      size: 'medio',
      color: '#0f0',
      pv: { current: 15, max: 15 },
      san: { current: 15, max: 15 },
      conditions: [],
      isStealth: true,
      ownerPeerId: 'p1',
    },
  ],
  fogActions: [],
  gridless: true,
};
(testScene as any).gmNotes = 'Secret Scene Lore';

const sanitizedForP1 = sanitizeSceneForPlayer(testScene, 'p1');
if (
  sanitizedForP1.tokens.length === 2 &&
  sanitizedForP1.tokens.some((t) => t.id === 't-visible') &&
  sanitizedForP1.tokens.some((t) => t.id === 't-stealth-p1') &&
  !sanitizedForP1.tokens.some((t) => t.id === 't-stealth-gm') &&
  (sanitizedForP1 as any).gmNotes === undefined &&
  !sanitizedForP1.tokens.some((t) => (t as any).notes)
) {
  recordPass();
} else {
  recordFail('AntiCheat', 'sanitizeSceneForPlayer culling & note stripping', JSON.stringify(sanitizedForP1), 'Stealth filtered & notes stripped');
}

// Movement authorization
if (
  authorizeTokenMove(testScene.tokens[1], 'gm', true) &&
  authorizeTokenMove(testScene.tokens[2], 'p1', false) &&
  !authorizeTokenMove(testScene.tokens[1], 'p1', false)
) {
  recordPass();
} else {
  recordFail('AntiCheat', 'authorizeTokenMove rules', 'false', 'true');
}

// ============================================================================
// SUITE 6: Tactical Combat Tracker State Machine
// ============================================================================
console.log('\n[6] Stress-Testing Combat Tracker State Machine...');

const combatants: Combatant[] = [
  { id: '1', name: 'Zumbi', initiative: 10, isPlayer: false, isDefeated: false },
  { id: '2', name: 'Arthur', initiative: 10, isPlayer: true, isDefeated: false },
  { id: '3', name: 'Líder', initiative: 20, isPlayer: false, isDefeated: false },
];

const sorted = sortCombatants(combatants);
if (sorted[0].name === 'Líder' && sorted[1].name === 'Arthur' && sorted[2].name === 'Zumbi') {
  recordPass();
} else {
  recordFail('CombatTracker', 'sortCombatants initiative and player priority', JSON.stringify(sorted.map((c) => c.name)), '["Líder", "Arthur", "Zumbi"]');
}

// Undefined name crash test
try {
  sortCombatants([
    { id: '1', initiative: 10, isPlayer: false, isDefeated: false } as any,
    { id: '2', initiative: 10, isPlayer: false, isDefeated: false } as any,
  ]);
  recordPass();
} catch (err: any) {
  recordFail('CombatTracker', 'sortCombatants with undefined combatant.name', err.message, 'Handled safely without crash');
}

// ============================================================================
// SUITE 7: Live Dice Expression Parser & Safety Bounds
// ============================================================================
console.log('\n[7] Stress-Testing Dice Expression Parser...');

const validRoll = parseDiceExpression('3d20 + 5', 'P1', () => 10);
if (validRoll.total === 35 && validRoll.dice.length === 3) recordPass();
else recordFail('DiceParser', '3d20 + 5 evaluation', String(validRoll.total), '35');

// 0d0 should throw Error
let threwOn0d0 = false;
try {
  parseDiceExpression('0d0');
} catch {
  threwOn0d0 = true;
}
if (threwOn0d0) {
  recordPass();
} else {
  recordFail('DiceParser', 'parseDiceExpression("0d0")', 'Accepted and rolled 1d2', 'Throws descriptive error');
}

// 1d0 should throw Error
let threwOn1d0 = false;
try {
  parseDiceExpression('1d0');
} catch {
  threwOn1d0 = true;
}
if (threwOn1d0) {
  recordPass();
} else {
  recordFail('DiceParser', 'parseDiceExpression("1d0")', 'Accepted and rolled 1d2', 'Throws descriptive error');
}

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log(`TOTAL ADVERSARIAL CHALLENGES: ${passedChallenges + failedChallenges}`);
console.log(`PASSED: ${passedChallenges}`);
console.log(`FAILED: ${failedChallenges}`);
console.log('='.repeat(80));

console.log('\nDISTINCT DEFECT CATEGORIES IDENTIFIED:');
const categories = [...new Set(failures.map((f) => f.category))];
for (const cat of categories) {
  const count = failures.filter((f) => f.category === cat).length;
  console.log(`- ${cat}: ${count} test failures`);
}

process.exit(failedChallenges > 0 ? 1 : 0);
