/**
 * src/lib/types/vtt.ts
 * 
 * Core Virtual Tabletop (VTT) Data Models, Types, Constants & Type Guards
 * for Mural 100% Local-First P2P Tactical System.
 * 
 * Covers Requirements R1 (Tactical Canvas & Fog of War), R2 (Player Client),
 * R3 (P2P WebRTC Synchronization), and R4 (Combat Initiative Tracker).
 */

// ============================================================================
// 1. Tactical Scale & Coordinate Math Constants & Types
// ============================================================================

/**
 * Standard pixel diameter for a 1.5m medium grid step (e.g. standard character).
 */
export const VTT_STANDARD_GRID_SIZE_PX = 70;

/**
 * Standard tactical distance in meters per standard step.
 */
export const VTT_STANDARD_GRID_STEP_METERS = 1.5;

/**
 * Tactical scale factor: 70 pixels = 1.5 meters -> 46.666666666666664 px/m.
 */
export const VTT_PIXELS_PER_METER = VTT_STANDARD_GRID_SIZE_PX / VTT_STANDARD_GRID_STEP_METERS;

/**
 * Inverse scale factor: meters per pixel -> 0.02142857142857143 m/px.
 */
export const VTT_METERS_PER_PIXEL = VTT_STANDARD_GRID_STEP_METERS / VTT_STANDARD_GRID_SIZE_PX;

/**
 * Visual opacity for Fog of War in the GM workspace (semi-transparent dark overlay).
 */
export const VTT_FOG_GM_OPACITY = 0.55;

/**
 * Visual opacity for Fog of War in the Player workspace (100% opaque black mask).
 */
export const VTT_FOG_PLAYER_OPACITY = 1.0;

/**
 * Color of the unrevealed fog mask.
 */
export const VTT_FOG_COLOR = '#000000';

/**
 * Default duration for animated radar pings in milliseconds.
 */
export const VTT_PING_DURATION_MS = 2500;

/**
 * Prefix for Mural VTT room codes (ORD-XXXX).
 */
export const VTT_ROOM_CODE_PREFIX = 'ORD-';

/**
 * Prefix for host PeerJS IDs.
 */
export const VTT_HOST_PEER_PREFIX = 'mural-vtt-';

/**
 * 2D point in Euclidean coordinate space (pixels or meters depending on context).
 */
export interface VttPoint {
  x: number;
  y: number;
}

/**
 * 2D rectangle in world coordinate space.
 */
export interface VttRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Viewport transformation state for canvas pan and zoom.
 */
export interface VttViewportTransform {
  pan: VttPoint;
  zoom: number; // Clamped between 0.15 and 4.0
}

// ============================================================================
// 2. Token Size Categories & Configuration (Req 1)
// ============================================================================

/**
 * Standard token size categories calibrated to 1.5m tactical grid steps.
 */
export type VttTokenSize = 'pequeno' | 'medio' | 'grande' | 'enorme';

export interface VttTokenSizeConfig {
  readonly size: VttTokenSize;
  readonly label: string;
  readonly diameterPx: number;
  readonly gridFootprint: '1x1' | '2x2' | '3x3';
  readonly standardMeters: number;
}

/**
 * Canonical dimensions and footprints for circular pawn tokens.
 */
export const VTT_TOKEN_SIZES: Readonly<Record<VttTokenSize, VttTokenSizeConfig>> = {
  pequeno: {
    size: 'pequeno',
    label: 'Pequeno',
    diameterPx: 56,
    gridFootprint: '1x1',
    standardMeters: 1.2,
  },
  medio: {
    size: 'medio',
    label: 'Médio',
    diameterPx: 70,
    gridFootprint: '1x1',
    standardMeters: 1.5,
  },
  grande: {
    size: 'grande',
    label: 'Grande',
    diameterPx: 140,
    gridFootprint: '2x2',
    standardMeters: 3.0,
  },
  enorme: {
    size: 'enorme',
    label: 'Enorme',
    diameterPx: 210,
    gridFootprint: '3x3',
    standardMeters: 4.5,
  },
} as const;

// ============================================================================
// 3. Vital Resource Pools & Status Conditions
// ============================================================================

/**
 * Vital stat resource pool (PV, Sanidade, Pontos de Esforço).
 */
export interface VttStatResource {
  current: number;
  max: number;
  temp?: number;
}

/**
 * Standard tactical conditions from Ordem Paranormal / TTRPG systems.
 */
export type VttStandardCondition =
  | 'Abalado'
  | 'Sangrando'
  | 'Inconsciente'
  | 'Morrendo'
  | 'Cego'
  | 'Paralisado'
  | 'Envenenado'
  | 'Vulnerável'
  | 'Fatigado'
  | 'Surpreendido'
  | 'Desesperado';

export const VTT_STANDARD_CONDITIONS: readonly VttStandardCondition[] = [
  'Abalado',
  'Sangrando',
  'Inconsciente',
  'Morrendo',
  'Cego',
  'Paralisado',
  'Envenenado',
  'Vulnerável',
  'Fatigado',
  'Surpreendido',
  'Desesperado',
] as const;

// ============================================================================
// 4. Circular Pawn Token Model (Req 2)
// ============================================================================

export type VttTokenType = 'character' | 'npc' | 'monster';

/**
 * Circular tactical pawn token placed on a battlemap.
 */
export interface VttToken {
  /** Unique token identifier */
  id: string;
  /** Display name of the token */
  name: string;
  /** World coordinate X on the battlemap */
  x: number;
  /** World coordinate Y on the battlemap */
  y: number;
  /** Standard tactical size category */
  size: VttTokenSize;
  /** Hex color for the high-contrast token ring border */
  color: string;
  /** Optional image URL or base64 data for the circular portrait */
  imageUrl?: string;
  /** Pontos de Vida (Hit Points) */
  pv: VttStatResource;
  /** Sanidade (Sanity) */
  san: { current: number; max: number };
  /** Pontos de Esforço (Effort Points, optional) */
  pe?: { current: number; max: number };
  /** Active status condition badges (e.g. 'Abalado', 'Sangrando') */
  conditions: string[];
  /** Stealth / Invisibility toggle; stealth tokens are strictly stripped from player views */
  isStealth: boolean;
  /** WebRTC Peer ID of the authorized player owner (for movement authorization) */
  ownerPeerId?: string;
  /** Associated Ordo character sheet ID (if synced from Ordo) */
  characterId?: string;
  /** Token rotation / facing direction in degrees (0 to 360) */
  rotation?: number;
  /** Token classification */
  type?: VttTokenType;
  /** Scene ID where this token resides */
  sceneId?: string;
  /** Secret GM notes attached to token */
  notes?: string;
}

// ============================================================================
// 5. Fog of War Geometric Action Model (Req 3)
// ============================================================================

export type FogActionType =
  | 'reveal_rect'
  | 'hide_rect'
  | 'reveal_brush'
  | 'hide_brush'
  | 'blanket_all'
  | 'clear_all';

/**
 * Deterministic geometric action applied to the Fog of War mask canvas.
 */
export interface FogAction {
  /** Unique action identifier (useful for undo/redo stacks) */
  id?: string;
  /** Type of geometric operation */
  type: FogActionType;
  /** Coordinate points array for freeform brush strokes */
  points?: Array<{ x: number; y: number }>;
  /** Bounding box for rectangular reveal/hide */
  rect?: { x: number; y: number; width: number; height: number };
  /** Brush or shape radius in world pixels */
  radius?: number;
  /** Unix timestamp in milliseconds when action was applied */
  timestamp: number;
}

// ============================================================================
// 6. Tactical Battlemap Scene Model (Req 4)
// ============================================================================

/**
 * Tactical Battlemap Scene holding the background artwork, tokens, and fog state.
 */
export interface VttScene {
  /** Unique scene identifier */
  id: string;
  /** Human-readable scene name (e.g. 'Floresta Sombria', 'Mansão Antiga') */
  name: string;
  /** URL or base64 data URI of the battlemap background image */
  backgroundUrl: string;
  /** Scene natural width in pixels */
  width: number;
  /** Scene natural height in pixels */
  height: number;
  /** Pixels per meter scale ratio (default: 46.6667, 70px = 1.5m) */
  scaleRatio: number;
  /** All tokens currently placed in this scene */
  tokens: VttToken[];
  /** Chronological history of geometric fog operations */
  fogActions: FogAction[];
  /** Whether movement and ruler are 100% gridless (default: true) */
  gridless: boolean;
  /** Whether the fog of war overlay is enabled for this scene */
  isFogEnabled?: boolean;
  /** Creation timestamp */
  createdAt?: number;
  /** Last update timestamp */
  updatedAt?: number;
}

// ============================================================================
// 7. Tactical Initiative & Combat Tracker (Req 5 & Req 6)
// ============================================================================

/**
 * Individual participant in a tactical combat encounter.
 */
export interface Combatant {
  /** Unique combatant identifier */
  id: string;
  /** Optional link to canvas VttToken id (clicking centers camera on token) */
  tokenId?: string;
  /** Optional link to Ordo character sheet id */
  characterId?: string;
  /** Optional connected WebRTC Peer ID */
  peerId?: string;
  /** Display name of the combatant */
  name: string;
  /** Computed or rolled initiative value */
  initiative: number;
  /** Tie-breaking initiative modifier (e.g. Agilidade attribute) */
  modifier?: number;
  /** Whether this combatant represents a connected player */
  isPlayer: boolean;
  /** Whether this combatant has been defeated or eliminated from turn order */
  isDefeated: boolean;
  /** Current and maximum Hit Points (PV) */
  hp?: { current: number; max: number };
  /** Current and maximum Sanity (Sanidade) */
  san?: { current: number; max: number };
  /** Avatar portrait URL */
  avatarUrl?: string;
  /** Accent ring color */
  color?: string;
  /** Active status condition badges */
  conditions?: string[];
  /** Whether initiative has been rolled for this combatant */
  hasRolled?: boolean;
}

/**
 * State machine representation of an active combat encounter.
 */
export interface CombatEncounter {
  /** Unique encounter identifier */
  id: string;
  /** Human-readable encounter name (e.g. 'Emboscada no Galpão') */
  name: string;
  /** Current combat round (1, 2, 3...) */
  round: number;
  /** Index in combatants array whose turn is currently active */
  activeIndex: number;
  /** Ordered list of combatants sorted descending by initiative */
  combatants: Combatant[];
  /** Whether the encounter is actively running */
  isRunning: boolean;
  /** Linked scene ID */
  sceneId?: string;
  /** Creation timestamp */
  createdAt?: number;
  /** Last update timestamp */
  updatedAt?: number;
}

// ============================================================================
// 8. Tactical Radar Ping (Req 7)
// ============================================================================

/**
 * Temporary radar ping broadcast on the battlemap.
 */
export interface VttPing {
  /** Optional ping identifier */
  id?: string;
  /** World coordinate X */
  x: number;
  /** World coordinate Y */
  y: number;
  /** Hex color for the expanding radar ripple */
  color: string;
  /** Peer ID of the sender */
  senderId: string;
  /** Display name of the sender (e.g. 'Mariana', 'Mestre') */
  senderName: string;
  /** Creation timestamp */
  timestamp: number;
  /** Lifetime in milliseconds before the ping is pruned (default: 2500) */
  durationMs?: number;
}

// ============================================================================
// 9. Live Dice Roll Result (Req 8)
// ============================================================================

export interface DieResult {
  /** Number of sides on the die (e.g. 4, 6, 8, 10, 12, 20, 100) */
  sides: number;
  /** Rolled outcome value */
  result: number;
}

/**
 * Structured outcome of a parsed dice roll expression.
 */
export interface DiceRollResult {
  /** Unique roll event identifier */
  id?: string;
  /** Original formula expression (e.g. '3d20 + 5', '2d6 + 3') */
  expression: string;
  /** Individual dice rolled */
  dice: DieResult[];
  /** Static modifier added to total */
  modifier: number;
  /** Final calculated total */
  total: number;
  /** For roll-and-keep systems (e.g. Ordem Paranormal highest d20) */
  keptValue?: number;
  /** Whether the roll achieved a critical success (e.g. natural 20) */
  isCritical: boolean;
  /** Whether the roll suffered a critical fumble (e.g. natural 1) */
  isFumble: boolean;
  /** Sender display name */
  senderName: string;
  /** Sender peer ID */
  senderId?: string;
  /** Roll timestamp */
  timestamp: number;
  /** Optional descriptive label (e.g. 'Iniciativa', 'Percepção') */
  label?: string;
}

// ============================================================================
// 10. WebRTC P2P Envelope & Core Message Payloads (Req 9)
// ============================================================================

/**
 * Supported message types in the Mural VTT WebRTC protocol.
 */
export type VTTMessageType =
  | 'VTT_SCENE_SYNC'
  | 'VTT_TOKEN_MOVE'
  | 'VTT_TOKEN_UPSERT'
  | 'VTT_FOG_UPDATE'
  | 'VTT_MAP_PING'
  | 'VTT_INITIATIVE_UPDATE'
  | 'VTT_DICE_ROLL'
  | 'VTT_JOIN'
  | 'VTT_JOIN_ACK'
  | 'VTT_LEAVE'
  | 'VTT_PING'
  | 'VTT_PONG'
  | 'VTT_ERROR';

/**
 * Standardized envelope for all VTT P2P DataChannel packets.
 */
export interface VTTEnvelope<T = unknown> {
  /** Event packet type */
  type: VTTMessageType;
  /** Peer ID of the originating sender */
  senderId: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Strongly-typed message payload */
  payload: T;
  /** Optional display name of the sender */
  senderName?: string;
  /** Protocol version string (e.g. '1.0.0') */
  version?: string;
  /** Optional correlation id for request/response pairs */
  requestId?: string;
}

// ----------------------------------------------------------------------------
// Core Packet Payloads
// ----------------------------------------------------------------------------

/**
 * Payload for 'VTT_SCENE_SYNC' (Host -> Player or Scene Reset).
 * NOTE: Tokens must be pre-sanitized by GM host (stripping isStealth tokens).
 */
export interface VttSceneSyncPayload {
  scene: VttScene;
}
export type VTTSceneSyncPayload = VttSceneSyncPayload;

/**
 * Payload for 'VTT_TOKEN_MOVE' (Bidirectional token repositioning).
 */
export interface VttTokenMovePayload {
  tokenId: string;
  x: number;
  y: number;
  rotation?: number;
  /** Distance moved in meters during this drag step */
  distanceMeters?: number;
  /** Optional breadcrumb path recorded during continuous drag */
  trail?: Array<{ x: number; y: number }>;
  /** True if user has released the drag, committing the position */
  isFinal?: boolean;
  /** Peer ID of the user moving the token */
  movedByPeerId?: string;
}
export type VTTTokenMovePayload = VttTokenMovePayload;

/**
 * Payload for 'VTT_FOG_UPDATE' (GM Host -> Player clients).
 */
export interface VttFogUpdatePayload {
  /** Single geometric action to apply */
  action?: FogAction;
  /** Full action stream replacement (e.g. on join or clear/blanket) */
  actions?: FogAction[];
  /** Alias for actions matching some service call conventions */
  fullActions?: FogAction[];
  /** Reset flag instructing client to re-render base fog */
  reset?: boolean;
}
export type VTTFogUpdatePayload = VttFogUpdatePayload;

/**
 * Payload for 'VTT_MAP_PING' (Bidirectional radar ripple).
 */
export interface VttMapPingPayload {
  ping: VttPing;
}
export type VTTMapPingPayload = VttMapPingPayload;

/**
 * Payload for 'VTT_INITIATIVE_UPDATE' (Combat encounter state sync).
 */
export interface VttInitiativeUpdatePayload {
  encounter: CombatEncounter | null;
}
export type VTTInitiativeUpdatePayload = VttInitiativeUpdatePayload;

/**
 * Payload for 'VTT_DICE_ROLL' (Live dice drawer broadcast).
 */
export interface VttDiceRollPayload {
  roll: DiceRollResult;
}
export type VTTDiceRollPayload = VttDiceRollPayload;

/**
 * Payload for 'VTT_JOIN' (Browser Player -> GM Host).
 */
export interface VttJoinPayload {
  playerPeerId: string;
  playerName: string;
  characterId?: string;
  characterName?: string;
  pawnColor?: string;
  pawnAvatar?: string;
  color?: string;
}
export type VTTJoinPayload = VttJoinPayload;

/**
 * Payload for 'VTT_JOIN_ACK' (GM Host -> Browser Player).
 */
export interface VttJoinAckPayload {
  accepted: boolean;
  isGm?: boolean;
  gmPeerId?: string;
  scene?: VttScene;
  encounter?: CombatEncounter | null;
  assignedTokenId?: string;
  message?: string;
}
export type VTTJoinAckPayload = VttJoinAckPayload;

/**
 * Payload for 'VTT_LEAVE' (Peer disconnection notification).
 */
export interface VttLeavePayload {
  peerId?: string;
  message?: string;
  reason?: string;
}
export type VTTLeavePayload = VttLeavePayload;

/**
 * Payload for 'VTT_PING' and 'VTT_PONG' (Latency measurements).
 */
export interface VttPingPongPayload {
  clientTimestamp: number;
  serverTimestamp?: number;
}

/**
 * Payload for 'VTT_ERROR' (Error notification).
 */
export interface VttErrorPayload {
  code: string;
  message: string;
}
export type VTTErrorPayload = VttErrorPayload;

// ----------------------------------------------------------------------------
// Strongly-Typed Envelopes
// ----------------------------------------------------------------------------

export type VttSceneSyncEnvelope = VTTEnvelope<VttSceneSyncPayload>;
export type VttTokenMoveEnvelope = VTTEnvelope<VttTokenMovePayload>;
export type VttFogUpdateEnvelope = VTTEnvelope<VttFogUpdatePayload>;
export type VttMapPingEnvelope = VTTEnvelope<VttMapPingPayload>;
export type VttInitiativeUpdateEnvelope = VTTEnvelope<VttInitiativeUpdatePayload>;
export type VttDiceRollEnvelope = VTTEnvelope<VttDiceRollPayload>;
export type VttJoinEnvelope = VTTEnvelope<VttJoinPayload>;
export type VttJoinAckEnvelope = VTTEnvelope<VttJoinAckPayload>;
export type VttLeaveEnvelope = VTTEnvelope<VttLeavePayload>;
export type VttErrorEnvelope = VTTEnvelope<VttErrorPayload>;

/**
 * Union of all valid VTT message envelopes.
 */
export type VttAnyEnvelope =
  | VttSceneSyncEnvelope
  | VttTokenMoveEnvelope
  | VttFogUpdateEnvelope
  | VttMapPingEnvelope
  | VttInitiativeUpdateEnvelope
  | VttDiceRollEnvelope
  | VttJoinEnvelope
  | VttJoinAckEnvelope
  | VttLeaveEnvelope
  | VttErrorEnvelope;

// ============================================================================
// 11. Tactical Ruler & Area of Effect (AoE) Geometry Types
// ============================================================================

export type VttAoEType = 'cone' | 'circle' | 'line';

/**
 * Area of Effect geometry calculation result for SVG overlay rendering.
 */
export interface VttAoEGeometry {
  type: VttAoEType;
  origin: VttPoint;
  target: VttPoint;
  distancePx: number;
  distanceMeters: number;
  /** SVG path string (e.g. for 60° cone arc sector) */
  svgPath?: string;
  /** Radius in pixels for circle explosion */
  radiusPx?: number;
  /** 4 corner points for 1.5m-wide rotated rectangular beam */
  linePolygonPoints?: [VttPoint, VttPoint, VttPoint, VttPoint];
  /** Formatted metric readout (e.g. 'Cone: 6.0m (60°)') */
  label: string;
}

/**
 * Continuous measurement ruler result.
 */
export interface VttRulerMeasurement {
  start: VttPoint;
  end: VttPoint;
  distancePx: number;
  distanceMeters: number;
  formattedMeters: string;
  stepsCount: number;
}

// ============================================================================
// 12. P2P Host & Player Connection Status
// ============================================================================

/**
 * Reactive status of the local VTT P2P service.
 */
export interface VttRoomStatus {
  roomCode: string;
  hostPeerId: string;
  isOpen: boolean;
  isConnecting: boolean;
  connectedPeersCount: number;
  connectedPeerIds: string[];
  lastError: string | null;
}

// ============================================================================
// 13. Runtime Type Guards
// ============================================================================

/**
 * Checks if a string is a valid VttTokenSize.
 */
export function isVttTokenSize(value: unknown): value is VttTokenSize {
  return typeof value === 'string' && (value === 'pequeno' || value === 'medio' || value === 'grande' || value === 'enorme');
}

/**
 * Type guard for VttToken.
 */
export function isVttToken(val: unknown): val is VttToken {
  if (typeof val !== 'object' || val === null) return false;
  const t = val as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    typeof t.x === 'number' &&
    typeof t.y === 'number' &&
    isVttTokenSize(t.size) &&
    typeof t.color === 'string' &&
    typeof t.pv === 'object' &&
    t.pv !== null &&
    typeof (t.pv as Record<string, unknown>).current === 'number' &&
    typeof (t.pv as Record<string, unknown>).max === 'number' &&
    typeof t.san === 'object' &&
    t.san !== null &&
    typeof (t.san as Record<string, unknown>).current === 'number' &&
    typeof (t.san as Record<string, unknown>).max === 'number' &&
    Array.isArray(t.conditions) &&
    typeof t.isStealth === 'boolean'
  );
}

/**
 * Type guard for FogAction.
 */
export function isFogAction(val: unknown): val is FogAction {
  if (typeof val !== 'object' || val === null) return false;
  const a = val as Record<string, unknown>;
  const validTypes: FogActionType[] = [
    'reveal_rect',
    'hide_rect',
    'reveal_brush',
    'hide_brush',
    'blanket_all',
    'clear_all',
  ];
  return (
    typeof a.type === 'string' &&
    validTypes.includes(a.type as FogActionType) &&
    typeof a.timestamp === 'number'
  );
}

/**
 * Type guard for VttScene.
 */
export function isVttScene(val: unknown): val is VttScene {
  if (typeof val !== 'object' || val === null) return false;
  const s = val as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.backgroundUrl === 'string' &&
    typeof s.width === 'number' &&
    typeof s.height === 'number' &&
    typeof s.scaleRatio === 'number' &&
    Array.isArray(s.tokens) &&
    Array.isArray(s.fogActions) &&
    typeof s.gridless === 'boolean'
  );
}

/**
 * Type guard for Combatant.
 */
export function isCombatant(val: unknown): val is Combatant {
  if (typeof val !== 'object' || val === null) return false;
  const c = val as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.initiative === 'number' &&
    typeof c.isPlayer === 'boolean' &&
    typeof c.isDefeated === 'boolean'
  );
}

/**
 * Type guard for CombatEncounter.
 */
export function isCombatEncounter(val: unknown): val is CombatEncounter {
  if (typeof val !== 'object' || val === null) return false;
  const e = val as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.round === 'number' &&
    typeof e.activeIndex === 'number' &&
    Array.isArray(e.combatants) &&
    typeof e.isRunning === 'boolean'
  );
}

/**
 * Type guard for VttPing.
 */
export function isVttPing(val: unknown): val is VttPing {
  if (typeof val !== 'object' || val === null) return false;
  const p = val as Record<string, unknown>;
  return (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    typeof p.color === 'string' &&
    typeof p.senderId === 'string' &&
    typeof p.senderName === 'string' &&
    typeof p.timestamp === 'number'
  );
}

/**
 * Type guard for DiceRollResult.
 */
export function isDiceRollResult(val: unknown): val is DiceRollResult {
  if (typeof val !== 'object' || val === null) return false;
  const d = val as Record<string, unknown>;
  return (
    typeof d.expression === 'string' &&
    Array.isArray(d.dice) &&
    typeof d.modifier === 'number' &&
    typeof d.total === 'number' &&
    typeof d.isCritical === 'boolean' &&
    typeof d.isFumble === 'boolean' &&
    typeof d.senderName === 'string' &&
    typeof d.timestamp === 'number'
  );
}

/**
 * Type guard for VTTEnvelope.
 */
export function isVttEnvelope(val: unknown): val is VTTEnvelope {
  if (typeof val !== 'object' || val === null) return false;
  const env = val as Record<string, unknown>;
  const validTypes: VTTMessageType[] = [
    'VTT_SCENE_SYNC',
    'VTT_TOKEN_MOVE',
    'VTT_FOG_UPDATE',
    'VTT_MAP_PING',
    'VTT_INITIATIVE_UPDATE',
    'VTT_DICE_ROLL',
    'VTT_JOIN',
    'VTT_JOIN_ACK',
    'VTT_LEAVE',
    'VTT_PING',
    'VTT_PONG',
    'VTT_ERROR',
  ];
  return (
    typeof env.type === 'string' &&
    validTypes.includes(env.type as VTTMessageType) &&
    typeof env.senderId === 'string' &&
    typeof env.timestamp === 'number' &&
    env.payload !== undefined
  );
}
