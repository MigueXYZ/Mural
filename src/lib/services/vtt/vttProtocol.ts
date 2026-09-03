/**
 * src/lib/services/vtt/vttProtocol.ts
 * 
 * Pure TypeScript Mathematical, Security, and Protocol Validation Engine
 * for Mural 100% Local-First P2P Virtual Tabletop (VTT).
 * 
 * Zero DOM / Browser dependency: Fully unit-testable and isomorphic.
 */

import type {
  VttPoint,
  VttRect,
  VttViewportTransform,
  VttToken,
  VttScene,
  Combatant,
  CombatEncounter,
  DiceRollResult,
  DieResult,
  VttAoEType,
  VttAoEGeometry,
  VttRulerMeasurement,
} from '../../types/vtt';

// ============================================================================
// 1. Tactical Scale & Coordinate Constants
// ============================================================================

/**
 * Standard pixel diameter for a 1.5m medium grid step (70px).
 */
export const TACTICAL_GRID_SIZE_PX = 70;

/**
 * Standard tactical distance in meters per standard step (1.5m).
 */
export const TACTICAL_GRID_STEP_METERS = 1.5;

/**
 * Pixels per meter scale ratio: 70 / 1.5 ≈ 46.666666666666664 px/m.
 */
export const TACTICAL_PIXELS_PER_METER = TACTICAL_GRID_SIZE_PX / TACTICAL_GRID_STEP_METERS;

/**
 * Meters per pixel scale ratio: 1.5 / 70 ≈ 0.02142857142857143 m/px.
 */
export const TACTICAL_METERS_PER_PIXEL = TACTICAL_GRID_STEP_METERS / TACTICAL_GRID_SIZE_PX;

/**
 * Crockford Base32 alphabet (32 characters, 0-9 and A-Z excluding I, L, O, U).
 */
export const CROCKFORD_BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Standard room code prefix for Mural VTT sessions.
 */
export const ROOM_CODE_PREFIX = 'ORD-';

/**
 * Standard PeerJS host prefix for Mural VTT sessions.
 */
export const HOST_PEER_PREFIX = 'mural-vtt-';

// ============================================================================
// 2. Room Code & Peer ID Generation / Validation
// ============================================================================

/**
 * Generates an 8-character human-friendly room code in the canonical format 'ORD-XXXX'.
 * Uses Crockford Base32 to prevent visual ambiguity.
 */
export function generateRoomCode(): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * CROCKFORD_BASE32_ALPHABET.length);
    suffix += CROCKFORD_BASE32_ALPHABET.charAt(idx);
  }
  return `${ROOM_CODE_PREFIX}${suffix}`;
}

/**
 * Normalizes user-entered room codes into the canonical 'ORD-XXXX' format.
 * Forgivingly resolves lowercase characters, missing hyphens, and Crockford aliases:
 * - 'i' / 'l' -> '1'
 * - 'o' -> '0'
 * Returns null if the code cannot be resolved to a valid 4-character Crockford suffix.
 */
export function normalizeRoomCode(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  let clean = input.trim().toUpperCase();

  // Strip prefix variations: 'ORD-', 'ORD ', or leading 'ORD' if length >= 7
  if (clean.startsWith('ORD-')) {
    clean = clean.slice(4);
  } else if (clean.startsWith('ORD ')) {
    clean = clean.slice(4);
  } else if (clean.startsWith('ORD') && clean.length >= 7) {
    clean = clean.slice(3);
  }

  // Remove all non-alphanumeric characters
  clean = clean.replace(/[^A-Z0-9]/g, '');

  // Apply Crockford alias normalization
  clean = clean
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');

  // Must be exactly 4 Crockford characters
  if (clean.length !== 4) return null;

  for (let i = 0; i < 4; i++) {
    if (!CROCKFORD_BASE32_ALPHABET.includes(clean.charAt(i))) {
      return null;
    }
  }

  return `${ROOM_CODE_PREFIX}${clean}`;
}

/**
 * Validates whether an entered room code string conforms to the Mural format.
 */
export function validateRoomCode(code: string): boolean {
  return normalizeRoomCode(code) !== null;
}

/**
 * Converts a room code into the deterministic host PeerJS ID.
 * Example: 'ORD-9XYZ' -> 'mural-vtt-ord9xyz'
 * Example: '9xyz' -> 'mural-vtt-ord9xyz'
 */
export function roomCodeToHostPeerId(code: string): string {
  const normalized = normalizeRoomCode(code);
  const raw = (normalized || code).toLowerCase().replace(/[^a-z0-9]/g, '');

  if (raw.startsWith('ord')) {
    return `${HOST_PEER_PREFIX}${raw}`;
  }
  return `${HOST_PEER_PREFIX}ord${raw}`;
}

/**
 * Reverses a host PeerJS ID back into canonical room code format 'ORD-XXXX'.
 * Returns null if the peer ID does not match the Mural VTT host pattern.
 */
export function peerIdToRoomCode(peerId: string): string | null {
  if (!peerId || typeof peerId !== 'string') return null;
  const match = peerId.match(/^mural-vtt-ord([a-z0-9]{4})$/i);
  if (!match) return null;
  return normalizeRoomCode(match[1]);
}

// ============================================================================
// 3. Tactical Coordinate Transformations
// ============================================================================

/**
 * Converts world coordinates (battlemap pixels) to screen/viewport coordinates.
 * Formula: screen = world * zoom + pan
 */
export function worldToScreen(
  world: VttPoint,
  pan: VttPoint,
  zoom: number
): VttPoint {
  return {
    x: world.x * zoom + pan.x,
    y: world.y * zoom + pan.y,
  };
}

/**
 * Converts screen/viewport coordinates to world coordinates (battlemap pixels).
 * Formula: world = (screen - pan) / zoom
 */
export function screenToWorld(
  screen: VttPoint,
  pan: VttPoint,
  zoom: number
): VttPoint {
  const safeZoom = zoom <= 0 || !isFinite(zoom) ? 1.0 : zoom;
  return {
    x: (screen.x - pan.x) / safeZoom,
    y: (screen.y - pan.y) / safeZoom,
  };
}

/**
 * Calculates updated pan offsets when zooming into/out of a specific screen anchor point
 * (such as the mouse cursor during wheel events), preventing camera drift.
 */
export function calculateZoomPan(
  currentPan: VttPoint,
  currentZoom: number,
  targetZoom: number,
  screenAnchor: VttPoint
): VttPoint {
  const safeCurrentZoom = !Number.isFinite(currentZoom) || currentZoom <= 0 ? 1.0 : currentZoom;
  const safeTargetZoom = !Number.isFinite(targetZoom) || targetZoom <= 0 ? 1.0 : targetZoom;

  const safePanX = Number.isFinite(currentPan?.x) ? currentPan.x : 0;
  const safePanY = Number.isFinite(currentPan?.y) ? currentPan.y : 0;
  const safeAnchorX = Number.isFinite(screenAnchor?.x) ? screenAnchor.x : 0;
  const safeAnchorY = Number.isFinite(screenAnchor?.y) ? screenAnchor.y : 0;

  const worldAnchor = {
    x: (safeAnchorX - safePanX) / safeCurrentZoom,
    y: (safeAnchorY - safePanY) / safeCurrentZoom,
  };

  return {
    x: safeAnchorX - worldAnchor.x * safeTargetZoom,
    y: safeAnchorY - worldAnchor.y * safeTargetZoom,
  };
}

// ============================================================================
// 4. Gridless 1.5m Continuous Measurement Ruler
// ============================================================================

/**
 * Calculates Euclidean pixel distance between two points.
 */
export function calculateDistancePixels(p1: VttPoint, p2: VttPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates continuous tactical distance in meters between two points.
 * Standard scale: 70px = 1.5m (46.6667 px/m).
 */
export function calculateDistanceMeters(
  p1: VttPoint,
  p2: VttPoint,
  pixelsPerMeter: number = TACTICAL_PIXELS_PER_METER
): number {
  const safePpm = pixelsPerMeter <= 0 || !isFinite(pixelsPerMeter) ? TACTICAL_PIXELS_PER_METER : pixelsPerMeter;
  const distPx = calculateDistancePixels(p1, p2);
  return distPx / safePpm;
}

/**
 * Formats a metric distance into a localized string readout (e.g. '3.0 m').
 */
export function formatDistanceMeters(meters: number, precision: number = 1): string {
  const safeMeters = isNaN(meters) || !isFinite(meters) ? 0 : Math.max(0, meters);
  return `${safeMeters.toFixed(precision)} m`;
}

/**
 * Alias for formatDistanceMeters matching interface contracts.
 */
export function formatMeters(meters: number): string {
  return formatDistanceMeters(meters, 1);
}

/**
 * Computes a comprehensive continuous ruler measurement package.
 */
export function measureRuler(
  start: VttPoint,
  end: VttPoint,
  pixelsPerMeter: number = TACTICAL_PIXELS_PER_METER
): VttRulerMeasurement {
  const distancePx = calculateDistancePixels(start, end);
  const distanceMeters = calculateDistanceMeters(start, end, pixelsPerMeter);
  const formattedMeters = formatDistanceMeters(distanceMeters);
  const stepsCount = distanceMeters / TACTICAL_GRID_STEP_METERS;

  return {
    start,
    end,
    distancePx,
    distanceMeters,
    formattedMeters,
    stepsCount,
  };
}

/**
 * Converts meters into equivalent 1.5m standard grid steps.
 */
export function metersToGridUnits(meters: number): number {
  return meters / TACTICAL_GRID_STEP_METERS;
}

// ============================================================================
// 5. Area of Effect (AoE) Geometry Calculations
// ============================================================================

export interface AoeCalculationOptions {
  pixelsPerMeter?: number;
  coneAngleDeg?: number; // default 60
  lineWidthMeters?: number; // default 1.5
  fixedRadiusMeters?: number;
}

/**
 * Computes exact mathematical geometry, boundary vertices, and SVG paths
 * for Circle Explosion, 60° Cone Arc, and 1.5m Line Beam AoE templates.
 */
export function calculateAoeGeometry(
  type: VttAoEType,
  origin: VttPoint,
  target: VttPoint,
  options: AoeCalculationOptions = {}
): VttAoEGeometry {
  const ppm = options.pixelsPerMeter && options.pixelsPerMeter > 0 ? options.pixelsPerMeter : TACTICAL_PIXELS_PER_METER;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const rawDistPx = Math.sqrt(dx * dx + dy * dy);

  if (type === 'circle') {
    const radiusPx = options.fixedRadiusMeters !== undefined && options.fixedRadiusMeters > 0
      ? options.fixedRadiusMeters * ppm
      : rawDistPx;
    const distanceMeters = radiusPx / ppm;

    // SVG path using two semicircle arcs
    const r = Math.max(0.1, radiusPx);
    const svgPath = `M ${origin.x} ${origin.y - r} A ${r} ${r} 0 1 0 ${origin.x} ${origin.y + r} A ${r} ${r} 0 1 0 ${origin.x} ${origin.y - r} Z`;

    return {
      type: 'circle',
      origin,
      target,
      distancePx: radiusPx,
      distanceMeters,
      radiusPx,
      svgPath,
      label: `Círculo: ${formatDistanceMeters(distanceMeters)} (${formatDistanceMeters(distanceMeters * 2)} diâm.)`,
    };
  }

  if (type === 'cone') {
    const radiusPx = options.fixedRadiusMeters !== undefined && options.fixedRadiusMeters > 0
      ? options.fixedRadiusMeters * ppm
      : rawDistPx;
    const distanceMeters = radiusPx / ppm;
    const coneAngleDeg = options.coneAngleDeg !== undefined && options.coneAngleDeg > 0 ? options.coneAngleDeg : 60;
    const halfAngleRad = (coneAngleDeg * Math.PI) / 360; // 30° = pi/6

    if (radiusPx < 0.5) {
      return {
        type: 'cone',
        origin,
        target,
        distancePx: 0,
        distanceMeters: 0,
        svgPath: `M ${origin.x} ${origin.y} Z`,
        label: `Cone: 0.0 m (${coneAngleDeg}°)`,
      };
    }

    const baseAngle = Math.atan2(dy, dx);
    const startAngle = baseAngle - halfAngleRad;
    const endAngle = baseAngle + halfAngleRad;

    const startX = origin.x + radiusPx * Math.cos(startAngle);
    const startY = origin.y + radiusPx * Math.sin(startAngle);
    const endX = origin.x + radiusPx * Math.cos(endAngle);
    const endY = origin.y + radiusPx * Math.sin(endAngle);

    const largeArcFlag = coneAngleDeg > 180 ? 1 : 0;
    const svgPath = `M ${origin.x} ${origin.y} L ${startX} ${startY} A ${radiusPx} ${radiusPx} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

    return {
      type: 'cone',
      origin,
      target,
      distancePx: radiusPx,
      distanceMeters,
      svgPath,
      label: `Cone: ${formatDistanceMeters(distanceMeters)} (${coneAngleDeg}°)`,
    };
  }

  // Line Beam (1.5m fixed width standard)
  const lineWidthMeters = options.lineWidthMeters !== undefined && options.lineWidthMeters > 0
    ? options.lineWidthMeters
    : TACTICAL_GRID_STEP_METERS;
  const widthPx = lineWidthMeters * ppm;
  const halfWidthPx = widthPx / 2;
  const lengthPx = rawDistPx;
  const distanceMeters = lengthPx / ppm;

  if (lengthPx < 0.5) {
    return {
      type: 'line',
      origin,
      target,
      distancePx: 0,
      distanceMeters: 0,
      svgPath: `M ${origin.x} ${origin.y} Z`,
      linePolygonPoints: [origin, origin, origin, origin],
      label: `Linha: 0.0 m x ${formatDistanceMeters(lineWidthMeters)}`,
    };
  }

  // Unit vector along the beam
  const ux = dx / lengthPx;
  const uy = dy / lengthPx;

  // Perpendicular normal vector (-uy, ux)
  const nx = -uy;
  const ny = ux;

  // 4 Rotated corner vertices of the rectangular beam
  const c1: VttPoint = { x: origin.x + nx * halfWidthPx, y: origin.y + ny * halfWidthPx };
  const c2: VttPoint = { x: target.x + nx * halfWidthPx, y: target.y + ny * halfWidthPx };
  const c3: VttPoint = { x: target.x - nx * halfWidthPx, y: target.y - ny * halfWidthPx };
  const c4: VttPoint = { x: origin.x - nx * halfWidthPx, y: origin.y - ny * halfWidthPx };

  const svgPath = `M ${c1.x} ${c1.y} L ${c2.x} ${c2.y} L ${c3.x} ${c3.y} L ${c4.x} ${c4.y} Z`;

  return {
    type: 'line',
    origin,
    target,
    distancePx: lengthPx,
    distanceMeters,
    svgPath,
    linePolygonPoints: [c1, c2, c3, c4],
    label: `Linha: ${formatDistanceMeters(distanceMeters)} x ${formatDistanceMeters(lineWidthMeters)}`,
  };
}

/**
 * Checks if a world coordinate point falls within a circle AoE.
 */
export function isPointInCircle(point: VttPoint, origin: VttPoint, radiusPx: number): boolean {
  const EPSILON = 1e-5;
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return Math.sqrt(dx * dx + dy * dy) <= radiusPx + EPSILON;
}

/**
 * Checks if a world coordinate point falls within a cone AoE.
 */
export function isPointInCone(
  point: VttPoint,
  origin: VttPoint,
  target: VttPoint,
  halfAngleRad: number = Math.PI / 6
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const coneLength = Math.sqrt(dx * dx + dy * dy);
  if (coneLength < 0.5) return false;

  const vx = point.x - origin.x;
  const vy = point.y - origin.y;
  const EPSILON = 1e-5;
  const pointDist = Math.sqrt(vx * vx + vy * vy);
  if (pointDist > coneLength + EPSILON) return false;
  if (pointDist < 0.5) return true; // Point is at origin

  // Dot product divided by magnitudes
  const cosAngle = (vx * dx + vy * dy) / (pointDist * coneLength);
  return cosAngle >= Math.cos(halfAngleRad) - EPSILON;
}

/**
 * Checks if a world coordinate point falls within a line beam AoE.
 */
export function isPointInLineBeam(
  point: VttPoint,
  origin: VttPoint,
  target: VttPoint,
  beamWidthPx: number = TACTICAL_GRID_SIZE_PX
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.5) return false;

  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;

  const vx = point.x - origin.x;
  const vy = point.y - origin.y;

  const EPSILON = 1e-5;

  // Longitudinal projection with epsilon tolerance
  const t = vx * ux + vy * uy;
  if (t < -EPSILON || t > length + EPSILON) return false;

  // Transverse distance with epsilon tolerance
  const perp = Math.abs(vx * nx + vy * ny);
  return perp <= (beamWidthPx / 2) + EPSILON;
}

// ============================================================================
// 6. Anti-Cheat Security & Scene Sanitization
// ============================================================================

/**
 * Determines whether a given token is visible to a specific player peer.
 * 
 * Rules:
 * 1. Non-stealth tokens (!token.isStealth) are public and visible to all players.
 * 2. Stealth tokens (token.isStealth === true) are strictly hidden from all player
 *    peers UNLESS the player is the assigned owner (token.ownerPeerId === playerPeerId).
 * 3. Returns false if token is null/undefined or if playerPeerId is blank/unmatched for stealth.
 */
export function isTokenVisibleToPlayer(token: VttToken, playerPeerId?: string): boolean {
  if (!token) return false;
  if (!token.isStealth) return true;
  return Boolean(playerPeerId && token.ownerPeerId && token.ownerPeerId === playerPeerId);
}

/**
 * Authoritative GM Host Sanitizer:
 * Deep-clones the scene and strictly filters out all tokens marked with `isStealth: true`
 * UNLESS the token is owned by the requesting player (`token.ownerPeerId === playerPeerId`).
 * Also removes confidential GM notes to prevent client-side data inspection.
 */
export function sanitizeSceneForPlayer(scene: VttScene, playerPeerId?: string): VttScene {
  if (!scene) return scene;

  // Deep clone to guarantee master GM state immutability
  const cloned: VttScene = JSON.parse(JSON.stringify(scene));

  // Filter stealth tokens using centralized visibility rule
  cloned.tokens = (cloned.tokens || []).filter((token) => isTokenVisibleToPlayer(token, playerPeerId));

  // Strip confidential GM notes from scene and all remaining tokens
  delete (cloned as any).gmNotes;
  delete (cloned as any).notes;

  for (const token of cloned.tokens) {
    delete (token as any).notes;
    delete (token as any).gmNotes;
  }

  return cloned;
}

// ============================================================================
// 7. Movement Authorization Engine
// ============================================================================

/**
 * Validates whether a token reposition action is authorized.
 * Authority rules:
 * 1. GM host is universally authorized (`isGm === true`).
 * 2. Player peers may ONLY reposition tokens where `token.ownerPeerId === senderPeerId`
 *    or `token.characterId === playerCharacterId`.
 */
export function authorizeTokenMove(
  token: VttToken,
  senderPeerId: string,
  isGm: boolean,
  playerCharacterId?: string
): boolean {
  if (!token) return false;
  if (isGm) return true;

  if (senderPeerId && token.ownerPeerId && token.ownerPeerId === senderPeerId) {
    return true;
  }

  if (playerCharacterId && token.characterId && token.characterId === playerCharacterId) {
    return true;
  }

  return false;
}

// ============================================================================
// 8. Combat Tracker State Machine
// ============================================================================

/**
 * Sorts combatants in descending initiative order with multi-tier tie-breaking:
 * 1. Higher initiative score first.
 * 2. Player characters before monsters/NPCs.
 * 3. Case-insensitive alphabetical name comparison.
 * 4. Deterministic combatant ID comparison.
 * Non-mutating: Returns a newly sorted array.
 */
export function sortCombatants(combatants: Combatant[]): Combatant[] {
  if (!combatants || !Array.isArray(combatants)) return [];

  return [...combatants].sort((a, b) => {
    // Defense against null/undefined combatant entries
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;

    // 1. Initiative score (descending) with NaN/undefined defense
    const initA = typeof a.initiative === 'number' && Number.isFinite(a.initiative) ? a.initiative : 0;
    const initB = typeof b.initiative === 'number' && Number.isFinite(b.initiative) ? b.initiative : 0;
    if (initB !== initA) {
      return initB - initA;
    }

    // 2. Player priority (players go first on ties)
    const isPlayerA = Boolean(a.isPlayer);
    const isPlayerB = Boolean(b.isPlayer);
    if (isPlayerA && !isPlayerB) return -1;
    if (!isPlayerA && isPlayerB) return 1;

    // 3. Name (alphabetical) with null/undefined defense
    const nameA = typeof a.name === 'string' ? a.name : '';
    const nameB = typeof b.name === 'string' ? b.name : '';
    const nameDiff = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    if (nameDiff !== 0) return nameDiff;

    // 4. Deterministic ID tie-breaker with null/undefined defense
    const idA = typeof a.id === 'string' ? a.id : '';
    const idB = typeof b.id === 'string' ? b.id : '';
    return idA.localeCompare(idB);
  });
}

/**
 * Advances the active combat encounter turn.
 * Advances activeIndex by 1. When the activeIndex reaches or exceeds the roster length,
 * it wraps around to index 0 and increments the round count by 1.
 * Non-mutating: Returns a new CombatEncounter state.
 */
export function advanceTurn(encounter: CombatEncounter): CombatEncounter {
  if (!encounter || !encounter.combatants || encounter.combatants.length === 0) {
    return { ...encounter };
  }

  const nextIndex = encounter.activeIndex + 1;
  const isWrapAround = nextIndex >= encounter.combatants.length;

  return {
    ...encounter,
    activeIndex: isWrapAround ? 0 : nextIndex,
    round: isWrapAround ? encounter.round + 1 : encounter.round,
    updatedAt: Date.now(),
  };
}

/**
 * Steps backward to the previous combat turn.
 * If at index 0, wraps back to the final combatant and decrements the round (clamped to 1).
 * Non-mutating: Returns a new CombatEncounter state.
 */
export function previousTurn(encounter: CombatEncounter): CombatEncounter {
  if (!encounter || !encounter.combatants || encounter.combatants.length === 0) {
    return { ...encounter };
  }

  const prevIndex = encounter.activeIndex - 1;
  const isWrapAround = prevIndex < 0;

  return {
    ...encounter,
    activeIndex: isWrapAround ? encounter.combatants.length - 1 : prevIndex,
    round: isWrapAround ? Math.max(1, encounter.round - 1) : encounter.round,
    updatedAt: Date.now(),
  };
}

/**
 * Retrieves the combatant whose turn is currently active.
 */
export function getActiveCombatant(encounter: CombatEncounter): Combatant | null {
  if (!encounter || !encounter.combatants || encounter.combatants.length === 0) {
    return null;
  }
  return encounter.combatants[encounter.activeIndex] || null;
}

/**
 * Factory helper for initializing a clean combat encounter.
 */
export function createCombatEncounter(name: string = 'Combate'): CombatEncounter {
  return {
    id: `enc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    round: 1,
    activeIndex: 0,
    combatants: [],
    isRunning: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ============================================================================
// 9. Dice Roll Parser & Evaluation Engine
// ============================================================================

/**
 * Parses dice formulas (e.g. '4d20 + 15', '2d6 + 3', 'd20', '3d10 - 2')
 * and computes outcomes, totals, critical successes, and fumbles.
 * 
 * Supports pluggable RNG `rollFn` for 100% deterministic unit testing.
 */
export function parseDiceExpression(
  expr: string,
  senderName: string = 'Jogador',
  rollFn?: (sides: number) => number
): DiceRollResult {
  if (!expr || typeof expr !== 'string') {
    throw new Error('Expressão de dados não pode ser vazia');
  }

  const cleaned = expr.trim();
  const match = cleaned.match(/^(\d+)?\s*[dD]\s*(\d+)(?:\s*([+-])\s*(\d+))?$/);

  if (!match) {
    throw new Error(`Expressão de dados inválida: "${expr}". Formato esperado: NdX ou NdX + M`);
  }

  const rawCount = match[1] ? parseInt(match[1], 10) : 1;
  const rawSides = parseInt(match[2], 10);
  const sign = match[3];
  const rawMod = match[4] ? parseInt(match[4], 10) : 0;

  // Reject nonsensical zero dice count or zero/single-sided dice
  if (rawCount < 1 || rawSides < 2) {
    throw new Error(`Expressão de dados inválida: "${expr}". Mínimo de 1 dado e 2 lados.`);
  }

  // Bounded safety constraints against DoS / excessive memory allocation
  const count = Math.min(100, rawCount);
  const sides = Math.min(1000, rawSides);
  const modifier = sign === '-' ? -Math.max(0, Math.min(1000, rawMod)) : Math.max(0, Math.min(1000, rawMod));

  const dice: DieResult[] = [];
  for (let i = 0; i < count; i++) {
    const rolled = rollFn
      ? rollFn(sides)
      : Math.floor(Math.random() * sides) + 1;
    const clamped = Math.max(1, Math.min(sides, rolled));
    dice.push({ sides, result: clamped });
  }

  const sumDice = dice.reduce((acc, d) => acc + d.result, 0);
  const total = sumDice + modifier;

  // Roll-and-keep evaluation for Ordo/d20 skill pools
  const keptValue = Math.max(...dice.map((d) => d.result));

  // Critical and fumble logic
  let isCritical = false;
  let isFumble = false;

  if (sides === 20) {
    // Standard Ordo rule: natural 20 is critical; all 1s is fumble
    isCritical = dice.some((d) => d.result === 20);
    isFumble = dice.every((d) => d.result === 1);
  } else if (count === 1) {
    isCritical = dice[0].result === sides;
    isFumble = dice[0].result === 1;
  }

  return {
    id: `roll-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    expression: cleaned,
    dice,
    modifier,
    total,
    keptValue,
    isCritical,
    isFumble,
    senderName,
    timestamp: Date.now(),
  };
}

/**
 * Formats a DiceRollResult into a human-readable chat feed string.
 */
export function formatDiceResult(result: DiceRollResult): string {
  const diceResults = result.dice.map((d) => d.result).join(', ');
  const modStr = result.modifier !== 0
    ? ` ${result.modifier > 0 ? '+' : '-'} ${Math.abs(result.modifier)}`
    : '';
  const critBadge = result.isCritical ? ' [CRÍTICO!]' : result.isFumble ? ' [DESASTRE!]' : '';
  return `[${result.senderName}] ${result.expression} = [${diceResults}]${modStr} -> Total: ${result.total}${critBadge}`;
}
