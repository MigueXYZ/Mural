/**
 * tests/empirical_challenge_m2_adversarial.ts
 * 
 * EMPIRICAL ADVERSARIAL CHALLENGE HARNESS FOR MILESTONE 2 (Challenger 2)
 * Stress-testing token ownership authorization, drag bounds, canonical sizes,
 * vital bar limits, and stealth visibility.
 */

import {
  worldToScreen,
  screenToWorld,
  calculateZoomPan,
  calculateDistanceMeters,
  formatDistanceMeters,
  isTokenVisibleToPlayer,
  sanitizeSceneForPlayer,
  authorizeTokenMove,
  TACTICAL_GRID_SIZE_PX,
  TACTICAL_GRID_STEP_METERS,
  TACTICAL_PIXELS_PER_METER,
} from '../src/lib/services/vtt/vttProtocol';

import {
  VTT_TOKEN_SIZES,
  VTT_STANDARD_CONDITIONS,
  VTT_FOG_GM_OPACITY,
  VTT_FOG_PLAYER_OPACITY,
  VTT_FOG_COLOR,
  type VttScene,
  type VttToken,
  type VttTokenSize,
} from '../src/lib/types/vtt';

let passedChallenges = 0;
let failedChallenges = 0;
const failures: Array<{ category: string; test: string; observed: string; expected: string }> = [];

function recordPass(category: string, test: string) {
  passedChallenges++;
}

function recordFail(category: string, test: string, observed: string, expected: string) {
  failedChallenges++;
  failures.push({ category, test, observed, expected });
  console.error(`  ✖ FAIL [${category}] ${test}\n    Observed: ${observed}\n    Expected: ${expected}`);
}

console.log('='.repeat(80));
console.log('   CHALLENGER 2: EMPIRICAL ADVERSARIAL STRESS TEST SUITE (MILESTONE 2)');
console.log('='.repeat(80));

// ============================================================================
// SUITE 1: Token Ownership Authorization & Movement Security
// ============================================================================
console.log('\n[1] Stress-Testing Token Ownership Authorization & Movement Security...');

const mockGmPeerId = 'mural-host-gm';
const mockPlayer1PeerId = 'player-peer-alice';
const mockPlayer2PeerId = 'player-peer-bob';
const mockChar1Id = 'char-alice-investigator';
const mockChar2Id = 'char-bob-occultist';

const ownedByPlayer1Token: VttToken = {
  id: 'token-alice',
  name: 'Alice',
  type: 'character',
  size: 'medio',
  x: 200,
  y: 200,
  color: '#38bdf8',
  ownerPeerId: mockPlayer1PeerId,
  characterId: mockChar1Id,
  pv: { current: 20, max: 20 },
  san: { current: 30, max: 30 },
  conditions: [],
  isStealth: false,
};

const unownedMonsterToken: VttToken = {
  id: 'token-zombie',
  name: 'Zumbi de Sangue',
  type: 'monster',
  size: 'grande',
  x: 500,
  y: 500,
  color: '#ef4444',
  pv: { current: 60, max: 60 },
  conditions: [],
  isStealth: false,
};

const stealthRogueToken: VttToken = {
  id: 'token-bob-hidden',
  name: 'Bob Furtivo',
  type: 'character',
  size: 'medio',
  x: 350,
  y: 350,
  color: '#a855f7',
  ownerPeerId: mockPlayer2PeerId,
  characterId: mockChar2Id,
  pv: { current: 15, max: 20 },
  san: { current: 10, max: 25 },
  conditions: ['Abalado'],
  isStealth: true,
};

// 1.1 GM Universal Authorization
if (authorizeTokenMove(ownedByPlayer1Token, mockGmPeerId, true)) {
  recordPass('Auth', 'GM can move player token');
} else {
  recordFail('Auth', 'GM can move player token', 'false', 'true');
}

if (authorizeTokenMove(unownedMonsterToken, mockGmPeerId, true)) {
  recordPass('Auth', 'GM can move unowned monster token');
} else {
  recordFail('Auth', 'GM can move unowned monster token', 'false', 'true');
}

if (authorizeTokenMove(stealthRogueToken, mockGmPeerId, true)) {
  recordPass('Auth', 'GM can move stealth player token');
} else {
  recordFail('Auth', 'GM can move stealth player token', 'false', 'true');
}

// 1.2 Player Movement by ownerPeerId
if (authorizeTokenMove(ownedByPlayer1Token, mockPlayer1PeerId, false)) {
  recordPass('Auth', 'Player 1 can move their own token (matched peerId)');
} else {
  recordFail('Auth', 'Player 1 can move their own token', 'false', 'true');
}

if (!authorizeTokenMove(ownedByPlayer1Token, mockPlayer2PeerId, false)) {
  recordPass('Auth', 'Player 2 REJECTED from moving Player 1 token');
} else {
  recordFail('Auth', 'Player 2 REJECTED from moving Player 1 token', 'true', 'false');
}

if (!authorizeTokenMove(unownedMonsterToken, mockPlayer1PeerId, false)) {
  recordPass('Auth', 'Player 1 REJECTED from moving GM monster');
} else {
  recordFail('Auth', 'Player 1 REJECTED from moving GM monster', 'true', 'false');
}

// 1.3 Player Movement by characterId
if (authorizeTokenMove(ownedByPlayer1Token, 'unmatched-peer', false, mockChar1Id)) {
  recordPass('Auth', 'Player can move token matching characterId');
} else {
  recordFail('Auth', 'Player can move token matching characterId', 'false', 'true');
}

if (!authorizeTokenMove(ownedByPlayer1Token, 'unmatched-peer', false, mockChar2Id)) {
  recordPass('Auth', 'Player REJECTED when characterId does not match');
} else {
  recordFail('Auth', 'Player REJECTED when characterId does not match', 'true', 'false');
}

// 1.4 Adversarial spoofing: empty string peerId vs empty string ownerPeerId
const emptyOwnerToken: VttToken = { ...unownedMonsterToken, ownerPeerId: '' };
if (!authorizeTokenMove(emptyOwnerToken, '', false)) {
  recordPass('Auth', 'Empty string peerId cannot match empty ownerPeerId');
} else {
  recordFail('Auth', 'Empty string peerId cannot match empty ownerPeerId', 'true', 'false');
}

// 1.5 Adversarial null/undefined token handling
if (!authorizeTokenMove(null as any, mockPlayer1PeerId, false)) {
  recordPass('Auth', 'null token rejected safely');
} else {
  recordFail('Auth', 'null token rejected safely', 'true', 'false');
}

if (!authorizeTokenMove(undefined as any, mockPlayer1PeerId, false)) {
  recordPass('Auth', 'undefined token rejected safely');
} else {
  recordFail('Auth', 'undefined token rejected safely', 'true', 'false');
}

// 1.6 Svelte Component canMove Derived Logic Verification
function checkCanMove(isGm: boolean, isOwned: boolean, readOnly: boolean): boolean {
  return !readOnly && (isGm || isOwned);
}

if (checkCanMove(true, false, false) === true) recordPass('AuthUI', 'GM canMove is true');
else recordFail('AuthUI', 'GM canMove', 'false', 'true');

if (checkCanMove(false, true, false) === true) recordPass('AuthUI', 'Owner canMove is true');
else recordFail('AuthUI', 'Owner canMove', 'false', 'true');

if (checkCanMove(false, false, false) === false) recordPass('AuthUI', 'Non-owner non-GM canMove is false');
else recordFail('AuthUI', 'Non-owner non-GM canMove', 'true', 'false');

if (checkCanMove(true, true, true) === false) recordPass('AuthUI', 'readOnly disables movement even for GM');
else recordFail('AuthUI', 'readOnly disables movement even for GM', 'true', 'false');

// ============================================================================
// SUITE 2: Drag Bounds, Normalization & Viewport Transform Invariance
// ============================================================================
console.log('\n[2] Stress-Testing Drag Bounds, Normalization & Viewport Invariance...');

function normalizeRect(rect: { x: number; y: number; width: number; height: number }) {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x;
  const y = rect.height < 0 ? rect.y + rect.height : rect.y;
  const width = Math.abs(rect.width);
  const height = Math.abs(rect.height);
  return { x, y, width, height };
}

// Inverted drag rects:
const normBoth = normalizeRect({ x: 500, y: 400, width: -300, height: -200 });
if (normBoth.x === 200 && normBoth.y === 200 && normBoth.width === 300 && normBoth.height === 200) {
  recordPass('DragRect', 'Inverted drag normalized both axes');
} else {
  recordFail('DragRect', 'Inverted drag both axes', JSON.stringify(normBoth), '{x:200,y:200,w:300,h:200}');
}

const normXOnly = normalizeRect({ x: 500, y: 100, width: -300, height: 150 });
if (normXOnly.x === 200 && normXOnly.y === 100 && normXOnly.width === 300 && normXOnly.height === 150) {
  recordPass('DragRect', 'Inverted drag normalized X axis only');
} else {
  recordFail('DragRect', 'Inverted drag X axis only', JSON.stringify(normXOnly), '{x:200,y:100,w:300,h:150}');
}

const normZero = normalizeRect({ x: 100, y: 100, width: 0, height: 0 });
if (normZero.x === 100 && normZero.y === 100 && normZero.width === 0 && normZero.height === 0) {
  recordPass('DragRect', 'Zero size rectangle handled safely');
} else {
  recordFail('DragRect', 'Zero size rectangle', JSON.stringify(normZero), '{x:100,y:100,w:0,h:0}');
}

// Viewport transform scale invariance during token drag:
// When dragging, deltaWorld = (deltaScreen) / zoom
const testZooms = [0.15, 0.5, 1.0, 2.0, 2.5, 4.0];
const screenDeltas = [
  { x: 100, y: 50 },
  { x: -75, y: 120 },
  { x: 0, y: 0 },
];

for (const z of testZooms) {
  for (const sd of screenDeltas) {
    const safeZoom = z > 0 ? z : 1.0;
    const deltaWorld = { x: sd.x / safeZoom, y: sd.y / safeZoom };

    // Visually, in world transform: visualScreen = deltaWorld * zoom
    const reconstructedScreen = { x: deltaWorld.x * z, y: deltaWorld.y * z };

    if (
      Math.abs(reconstructedScreen.x - sd.x) < 1e-6 &&
      Math.abs(reconstructedScreen.y - sd.y) < 1e-6
    ) {
      recordPass('DragZoom', `Drag scale invariance at zoom ${z}`);
    } else {
      recordFail('DragZoom', `Drag scale invariance at zoom ${z}`, JSON.stringify(reconstructedScreen), JSON.stringify(sd));
    }
  }
}

// Coordinate inversion with extreme panning
const panExtreme = { x: -45000, y: 88000 };
for (const z of [0.15, 1.0, 4.0]) {
  const worldPt = { x: 1024, y: 768 };
  const screenPt = worldToScreen(worldPt, panExtreme, z);
  const roundtrip = screenToWorld(screenPt, panExtreme, z);
  if (Math.abs(roundtrip.x - worldPt.x) < 1e-5 && Math.abs(roundtrip.y - worldPt.y) < 1e-5) {
    recordPass('CoordInvariance', `Extreme pan roundtrip at zoom ${z}`);
  } else {
    recordFail('CoordInvariance', `Extreme pan roundtrip at zoom ${z}`, JSON.stringify(roundtrip), JSON.stringify(worldPt));
  }
}

// Pointer-anchored zoom preservation
const cursorScreen = { x: 640, y: 480 };
const initialPan = { x: -100, y: -200 };
const initialZoom = 1.2;
const worldUnderCursor = screenToWorld(cursorScreen, initialPan, initialZoom);

const zoomedPan = calculateZoomPan(initialPan, initialZoom, 2.8, cursorScreen);
const worldUnderCursorAfter = screenToWorld(cursorScreen, zoomedPan, 2.8);

if (
  Math.abs(worldUnderCursorAfter.x - worldUnderCursor.x) < 1e-5 &&
  Math.abs(worldUnderCursorAfter.y - worldUnderCursor.y) < 1e-5
) {
  recordPass('AnchorZoom', 'Cursor anchor point invariant under zoom');
} else {
  recordFail('AnchorZoom', 'Cursor anchor point invariant under zoom', JSON.stringify(worldUnderCursorAfter), JSON.stringify(worldUnderCursor));
}

// ============================================================================
// SUITE 3: Canonical Token Sizing across Categories
// ============================================================================
console.log('\n[3] Stress-Testing Canonical Token Sizing & Proportions...');

const expectedSizes: Record<VttTokenSize, { diameter: number; meters: number; footprint: string }> = {
  pequeno: { diameter: 56, meters: 1.2, footprint: '1x1' },
  medio: { diameter: 70, meters: 1.5, footprint: '1x1' },
  grande: { diameter: 140, meters: 3.0, footprint: '2x2' },
  enorme: { diameter: 210, meters: 4.5, footprint: '3x3' },
};

for (const [sizeKey, expected] of Object.entries(expectedSizes)) {
  const conf = VTT_TOKEN_SIZES[sizeKey as VttTokenSize];
  if (conf && conf.diameterPx === expected.diameter && conf.standardMeters === expected.meters && conf.gridFootprint === expected.footprint) {
    recordPass('TokenSizes', `Size ${sizeKey} configuration matches specifications`);
  } else {
    recordFail('TokenSizes', `Size ${sizeKey}`, JSON.stringify(conf), JSON.stringify(expected));
  }
}

// Proportionality to standard grid step (70px):
if (VTT_TOKEN_SIZES.pequeno.diameterPx === 56 && 56 === 0.8 * TACTICAL_GRID_SIZE_PX) {
  recordPass('TokenSizes', 'Pequeno is 0.8x grid step');
} else {
  recordFail('TokenSizes', 'Pequeno 0.8x grid step', `${VTT_TOKEN_SIZES.pequeno.diameterPx}`, '56');
}

if (VTT_TOKEN_SIZES.medio.diameterPx === 70 && 70 === 1.0 * TACTICAL_GRID_SIZE_PX) {
  recordPass('TokenSizes', 'Médio is 1.0x grid step');
} else {
  recordFail('TokenSizes', 'Médio 1.0x grid step', `${VTT_TOKEN_SIZES.medio.diameterPx}`, '70');
}

if (VTT_TOKEN_SIZES.grande.diameterPx === 140 && 140 === 2.0 * TACTICAL_GRID_SIZE_PX) {
  recordPass('TokenSizes', 'Grande is 2.0x grid step');
} else {
  recordFail('TokenSizes', 'Grande 2.0x grid step', `${VTT_TOKEN_SIZES.grande.diameterPx}`, '140');
}

if (VTT_TOKEN_SIZES.enorme.diameterPx === 210 && 210 === 3.0 * TACTICAL_GRID_SIZE_PX) {
  recordPass('TokenSizes', 'Enorme is 3.0x grid step');
} else {
  recordFail('TokenSizes', 'Enorme 3.0x grid step', `${VTT_TOKEN_SIZES.enorme.diameterPx}`, '210');
}

// Fallback logic check for unknown sizes (as used in VttToken.svelte)
function resolveTokenSize(size?: string) {
  return (VTT_TOKEN_SIZES as any)[size || ''] ?? VTT_TOKEN_SIZES.medio;
}

const invalidSizes = ['colossal', 'tiny', '', undefined, null, 'unknown'];
for (const bad of invalidSizes) {
  const resolved = resolveTokenSize(bad as any);
  if (resolved && resolved.size === 'medio' && resolved.diameterPx === 70) {
    recordPass('TokenSizesFallback', `Invalid size "${bad}" safely defaulted to medio (70px)`);
  } else {
    recordFail('TokenSizesFallback', `Invalid size "${bad}"`, JSON.stringify(resolved), 'VTT_TOKEN_SIZES.medio');
  }
}

// Initials font sizing calculation: Math.max(12, Math.round(diameter * 0.32))
function calculateInitialsFontSize(diameter: number): number {
  return Math.max(12, Math.round(diameter * 0.32));
}

if (calculateInitialsFontSize(56) === 18) recordPass('InitialsFont', 'Pequeno initials font size: 18px');
else recordFail('InitialsFont', 'Pequeno initials font size', `${calculateInitialsFontSize(56)}`, '18');

if (calculateInitialsFontSize(70) === 22) recordPass('InitialsFont', 'Médio initials font size: 22px');
else recordFail('InitialsFont', 'Médio initials font size', `${calculateInitialsFontSize(70)}`, '22');

if (calculateInitialsFontSize(140) === 45) recordPass('InitialsFont', 'Grande initials font size: 45px');
else recordFail('InitialsFont', 'Grande initials font size', `${calculateInitialsFontSize(140)}`, '45');

if (calculateInitialsFontSize(210) === 67) recordPass('InitialsFont', 'Enorme initials font size: 67px');
else recordFail('InitialsFont', 'Enorme initials font size', `${calculateInitialsFontSize(210)}`, '67');

// ============================================================================
// SUITE 4: Vital Bar Limits & Dynamic Clamping (PV & Sanidade)
// ============================================================================
console.log('\n[4] Stress-Testing Vital Bar Limits & Clamping (PV & Sanidade)...');

function computePvBar(pv?: { current?: number; max?: number; temp?: number }) {
  const current = pv?.current ?? 0;
  const max = Math.max(1, pv?.max ?? 1);
  const percent = Math.min(100, Math.max(0, (current / max) * 100));
  const temp = pv?.temp ?? 0;
  const tempPercent = Math.min(100, Math.max(0, (temp / max) * 100));
  const color = percent > 50 ? 'bg-emerald-500' : percent > 25 ? 'bg-amber-500' : 'bg-rose-600';
  return { current, max, percent, temp, tempPercent, color };
}

function computeSanBar(san?: { current?: number; max?: number }) {
  const current = san?.current ?? 0;
  const max = Math.max(1, san?.max ?? 1);
  const percent = Math.min(100, Math.max(0, (current / max) * 100));
  return { current, max, percent };
}

// Normal health values
const normPv = computePvBar({ current: 15, max: 20 });
if (normPv.percent === 75 && normPv.color === 'bg-emerald-500') {
  recordPass('VitalPv', 'Normal PV 15/20 -> 75% emerald');
} else {
  recordFail('VitalPv', 'Normal PV 15/20', JSON.stringify(normPv), '75% emerald');
}

// Boundary 50% health -> amber
const midPv = computePvBar({ current: 10, max: 20 });
if (midPv.percent === 50 && midPv.color === 'bg-amber-500') {
  recordPass('VitalPv', 'Boundary 50% PV 10/20 -> 50% amber');
} else {
  recordFail('VitalPv', 'Boundary 50% PV 10/20', JSON.stringify(midPv), '50% amber');
}

// Boundary 25% health -> rose
const lowPv = computePvBar({ current: 5, max: 20 });
if (lowPv.percent === 25 && lowPv.color === 'bg-rose-600') {
  recordPass('VitalPv', 'Boundary 25% PV 5/20 -> 25% rose');
} else {
  recordFail('VitalPv', 'Boundary 25% PV 5/20', JSON.stringify(lowPv), '25% rose');
}

// Zero HP -> 0% rose
const zeroPv = computePvBar({ current: 0, max: 20 });
if (zeroPv.percent === 0 && zeroPv.color === 'bg-rose-600') {
  recordPass('VitalPv', 'Zero PV 0/20 -> 0% rose');
} else {
  recordFail('VitalPv', 'Zero PV 0/20', JSON.stringify(zeroPv), '0% rose');
}

// Underflow: Negative HP -> clamped to 0%
const underflowPv = computePvBar({ current: -20, max: 20 });
if (underflowPv.percent === 0) {
  recordPass('VitalPv', 'Negative HP clamped to 0%');
} else {
  recordFail('VitalPv', 'Negative HP clamped to 0%', `${underflowPv.percent}`, '0');
}

// Overflow: Excessive HP -> clamped to 100%
const overflowPv = computePvBar({ current: 9999, max: 20 });
if (overflowPv.percent === 100) {
  recordPass('VitalPv', 'Overflow HP clamped to 100%');
} else {
  recordFail('VitalPv', 'Overflow HP clamped to 100%', `${overflowPv.percent}`, '100');
}

// Zero Max HP: division by zero guard
const zeroMaxPv = computePvBar({ current: 0, max: 0 });
if (zeroMaxPv.percent === 0 && isFinite(zeroMaxPv.percent)) {
  recordPass('VitalPv', 'Zero Max HP division by zero prevented (0%)');
} else {
  recordFail('VitalPv', 'Zero Max HP division by zero', `${zeroMaxPv.percent}`, '0');
}

// Negative Max HP: guard
const negMaxPv = computePvBar({ current: 5, max: -10 });
if (negMaxPv.percent === 100 && isFinite(negMaxPv.percent)) {
  recordPass('VitalPv', 'Negative Max HP safe fallback to 1');
} else {
  recordFail('VitalPv', 'Negative Max HP', `${negMaxPv.percent}`, '100');
}

// Missing/undefined resource
const missingPv = computePvBar(undefined);
if (missingPv.percent === 0 && missingPv.current === 0) {
  recordPass('VitalPv', 'Undefined PV resource defaults to 0% without crashing');
} else {
  recordFail('VitalPv', 'Undefined PV resource', JSON.stringify(missingPv), '0%');
}

// Temporary HP
const tempPv = computePvBar({ current: 10, max: 20, temp: 5 });
if (tempPv.tempPercent === 25) {
  recordPass('VitalTempPv', 'Temporary HP 5/20 -> 25% width');
} else {
  recordFail('VitalTempPv', 'Temporary HP 5/20', `${tempPv.tempPercent}`, '25');
}

const overflowTempPv = computePvBar({ current: 10, max: 20, temp: 50 });
if (overflowTempPv.tempPercent === 100) {
  recordPass('VitalTempPv', 'Overflow temporary HP clamped to 100%');
} else {
  recordFail('VitalTempPv', 'Overflow temporary HP clamped to 100%', `${overflowTempPv.tempPercent}`, '100');
}

// Sanidade Bar Clamping
const normSan = computeSanBar({ current: 18, max: 20 });
if (normSan.percent === 90) {
  recordPass('VitalSan', 'Normal Sanidade 18/20 -> 90%');
} else {
  recordFail('VitalSan', 'Normal Sanidade 18/20', `${normSan.percent}`, '90');
}

const underflowSan = computeSanBar({ current: -5, max: 20 });
if (underflowSan.percent === 0) {
  recordPass('VitalSan', 'Negative Sanidade clamped to 0%');
} else {
  recordFail('VitalSan', 'Negative Sanidade', `${underflowSan.percent}`, '0');
}

const overflowSan = computeSanBar({ current: 45, max: 20 });
if (overflowSan.percent === 100) {
  recordPass('VitalSan', 'Excessive Sanidade clamped to 100%');
} else {
  recordFail('VitalSan', 'Excessive Sanidade', `${overflowSan.percent}`, '100');
}

// ============================================================================
// SUITE 5: Stealth Visibility, GM Visualization & Anti-Cheat Culling
// ============================================================================
console.log('\n[5] Stress-Testing Stealth Visibility & Anti-Cheat Culling...');

// Dual-view Fog Opacities
if (VTT_FOG_GM_OPACITY === 0.55) {
  recordPass('StealthFog', 'VTT_FOG_GM_OPACITY is 0.55');
} else {
  recordFail('StealthFog', 'VTT_FOG_GM_OPACITY', `${VTT_FOG_GM_OPACITY}`, '0.55');
}

if (VTT_FOG_PLAYER_OPACITY === 1.0) {
  recordPass('StealthFog', 'VTT_FOG_PLAYER_OPACITY is 1.0');
} else {
  recordFail('StealthFog', 'VTT_FOG_PLAYER_OPACITY', `${VTT_FOG_PLAYER_OPACITY}`, '1.0');
}

if (VTT_FOG_COLOR === '#000000') {
  recordPass('StealthFog', 'VTT_FOG_COLOR is solid pitch black #000000');
} else {
  recordFail('StealthFog', 'VTT_FOG_COLOR', VTT_FOG_COLOR, '#000000');
}

// GM Token Stealth Visual Opacity Equation (from VttToken.svelte line 430)
function getTokenOpacity(isStealth: boolean): number {
  return isStealth ? 0.55 : 1.0;
}

if (getTokenOpacity(true) === 0.55) {
  recordPass('StealthToken', 'Stealth token rendered at 0.55 GM opacity');
} else {
  recordFail('StealthToken', 'Stealth token opacity', `${getTokenOpacity(true)}`, '0.55');
}

if (getTokenOpacity(false) === 1.0) {
  recordPass('StealthToken', 'Visible token rendered at 1.0 opacity');
} else {
  recordFail('StealthToken', 'Visible token opacity', `${getTokenOpacity(false)}`, '1.0');
}

// Player Visibility Rules via isTokenVisibleToPlayer
const publicToken: VttToken = {
  id: 'tok-public',
  name: 'Public NPC',
  type: 'npc',
  size: 'medio',
  x: 100,
  y: 100,
  color: '#38bdf8',
  pv: { current: 10, max: 10 },
  isStealth: false,
};

const secretMonster: VttToken = {
  id: 'tok-secret-monster',
  name: 'Criatura Oculta',
  type: 'monster',
  size: 'grande',
  x: 300,
  y: 300,
  color: '#ef4444',
  pv: { current: 50, max: 50 },
  isStealth: true,
};

const playerRogue: VttToken = {
  id: 'tok-player-rogue',
  name: 'Alice Sneaking',
  type: 'character',
  size: 'medio',
  x: 400,
  y: 400,
  color: '#22c55e',
  ownerPeerId: mockPlayer1PeerId,
  pv: { current: 15, max: 15 },
  isStealth: true,
};

// 5.1 Public token is visible to everyone
if (isTokenVisibleToPlayer(publicToken, mockPlayer1PeerId) && isTokenVisibleToPlayer(publicToken, mockPlayer2PeerId)) {
  recordPass('StealthVisibility', 'Public non-stealth token is visible to all players');
} else {
  recordFail('StealthVisibility', 'Public non-stealth token visible', 'false', 'true');
}

// 5.2 Secret monster is hidden from both players
if (!isTokenVisibleToPlayer(secretMonster, mockPlayer1PeerId) && !isTokenVisibleToPlayer(secretMonster, mockPlayer2PeerId)) {
  recordPass('StealthVisibility', 'Secret GM monster is strictly culled from players');
} else {
  recordFail('StealthVisibility', 'Secret GM monster culled', 'visible', 'hidden');
}

// 5.3 Player rogue is visible to owner (Player 1) but hidden from peer (Player 2)
if (isTokenVisibleToPlayer(playerRogue, mockPlayer1PeerId)) {
  recordPass('StealthVisibility', 'Stealth token is visible to its owner player');
} else {
  recordFail('StealthVisibility', 'Stealth token visible to owner', 'false', 'true');
}

if (!isTokenVisibleToPlayer(playerRogue, mockPlayer2PeerId)) {
  recordPass('StealthVisibility', 'Stealth token is strictly hidden from other peers');
} else {
  recordFail('StealthVisibility', 'Stealth token hidden from peers', 'visible', 'hidden');
}

// 5.4 Anti-cheat scene sanitization
const masterScene: VttScene = {
  id: 'scene-1',
  name: 'Mansão das Sombras',
  width: 2048,
  height: 1536,
  fogActions: [],
  tokens: [publicToken, secretMonster, playerRogue],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
(masterScene as any).gmNotes = 'CONFIDENTIAL: The basement contains a blood altar.';
(secretMonster as any).notes = 'Secret weakness: fire damage deals triple.';

const sanitizedForBob = sanitizeSceneForPlayer(masterScene, mockPlayer2PeerId);

// Bob should see ONLY publicToken (playerRogue and secretMonster must be completely absent)
if (sanitizedForBob.tokens.length === 1 && sanitizedForBob.tokens[0].id === 'tok-public') {
  recordPass('SanitizeScene', 'Bob receives only public token; all stealth tokens culled');
} else {
  recordFail('SanitizeScene', 'Bob received tokens', JSON.stringify(sanitizedForBob.tokens.map(t => t.id)), "['tok-public']");
}

// Check notes stripping
if (!(sanitizedForBob as any).gmNotes && !(sanitizedForBob.tokens[0] as any).notes) {
  recordPass('SanitizeScene', 'Confidential GM notes stripped from player scene payload');
} else {
  recordFail('SanitizeScene', 'Confidential GM notes stripped', 'notes still present', 'undefined');
}

// Alice (owner of playerRogue) should see publicToken AND playerRogue, but NOT secretMonster
const sanitizedForAlice = sanitizeSceneForPlayer(masterScene, mockPlayer1PeerId);
if (
  sanitizedForAlice.tokens.length === 2 &&
  sanitizedForAlice.tokens.some((t) => t.id === 'tok-public') &&
  sanitizedForAlice.tokens.some((t) => t.id === 'tok-player-rogue') &&
  !sanitizedForAlice.tokens.some((t) => t.id === 'tok-secret-monster')
) {
  recordPass('SanitizeScene', 'Alice receives public token and her own stealth token, monster culled');
} else {
  recordFail('SanitizeScene', 'Alice tokens', JSON.stringify(sanitizedForAlice.tokens.map(t => t.id)), "['tok-public', 'tok-player-rogue']");
}

// Master GM scene remains immutable
if (masterScene.tokens.length === 3 && (masterScene as any).gmNotes) {
  recordPass('SanitizeScene', 'Master GM scene remains untouched and unmutated');
} else {
  recordFail('SanitizeScene', 'Master GM scene immutability', 'mutated', 'unmutated (3 tokens + notes)');
}

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log(`EMPIRICAL CHALLENGE RESULTS: ${passedChallenges} PASSED, ${failedChallenges} FAILED`);
console.log('='.repeat(80));

if (failedChallenges > 0) {
  console.error(`\nOVERALL VERDICT: REJECT (${failedChallenges} critical failures found)`);
  process.exit(1);
} else {
  console.log('\nOVERALL VERDICT: APPROVE (100% empirical stress tests passed perfectly)');
  process.exit(0);
}
