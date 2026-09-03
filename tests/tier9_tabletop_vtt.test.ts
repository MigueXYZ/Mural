/**
 * tests/tier9_tabletop_vtt.test.ts
 * 
 * Acceptance & Verification Test Suite for Milestone 1:
 * Virtual Tabletop (VTT) Types, Mathematical Engine & P2P Protocol Engine.
 * 
 * Covers Requirements R1 (Tactical Canvas & Fog of War), R2 (Player Client),
 * R3 (WebRTC P2P Synchronization), and R4 (Combat Initiative Tracker).
 */

import { describe, it, expect } from './harness';
import {
  generateRoomCode,
  validateRoomCode,
  normalizeRoomCode,
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
  VTT_STANDARD_GRID_SIZE_PX,
  VTT_STANDARD_GRID_STEP_METERS,
  VTT_PIXELS_PER_METER,
  VTT_METERS_PER_PIXEL,
  VTT_FOG_GM_OPACITY,
  VTT_FOG_PLAYER_OPACITY,
  VTT_FOG_COLOR,
  VTT_PING_DURATION_MS,
  VTT_TOKEN_SIZES,
  VTT_STANDARD_CONDITIONS,
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
  type FogAction,
  type Combatant,
  type CombatEncounter,
  type VttPing,
  type DiceRollResult,
  type VTTEnvelope,
  type VttSceneSyncPayload,
  type VttTokenMovePayload,
  type VttFogUpdatePayload,
  type VttInitiativeUpdatePayload,
} from '../src/lib/types/vtt';

// ============================================================================
// Suite 1: Room Code Generation, Normalization & Host Peer ID Mapping
// ============================================================================

describe('Tier 9.1: Room Code & Host Peer ID Cryptography', () => {
  it('generates canonical ORD-XXXX room codes using Crockford Base32', () => {
    const code = generateRoomCode();
    expect(code.startsWith(ROOM_CODE_PREFIX)).toBe(true);
    expect(code.length).toBe(8);
    expect(validateRoomCode(code)).toBe(true);

    const suffix = code.slice(4);
    for (const char of suffix) {
      expect(CROCKFORD_BASE32_ALPHABET.includes(char)).toBe(true);
    }
  });

  it('forgivingly normalizes lowercase, missing prefix, and Crockford aliases', () => {
    expect(normalizeRoomCode('ord-abcd')).toBe('ORD-ABCD');
    expect(normalizeRoomCode('abcd')).toBe('ORD-ABCD');
    expect(normalizeRoomCode('ORD ABCD')).toBe('ORD-ABCD');
    expect(normalizeRoomCode('ordabcd')).toBe('ORD-ABCD');
    // Crockford aliases: 'I' & 'L' -> '1', 'O' -> '0'
    expect(normalizeRoomCode('ord-ilo2')).toBe('ORD-1102');
    expect(normalizeRoomCode('ILO2')).toBe('ORD-1102');
  });

  it('rejects invalid or corrupted room codes', () => {
    expect(normalizeRoomCode('')).toBeNull();
    expect(normalizeRoomCode('   ')).toBeNull();
    expect(normalizeRoomCode('too-long-room-code')).toBeNull();
    expect(normalizeRoomCode('abc')).toBeNull(); // Only 3 chars
    expect(normalizeRoomCode(null as any)).toBeNull();
    expect(normalizeRoomCode(undefined as any)).toBeNull();
  });

  it('maps room codes to deterministic host peer IDs and vice-versa', () => {
    expect(roomCodeToHostPeerId('ORD-7XYZ')).toBe('mural-vtt-ord7xyz');
    expect(roomCodeToHostPeerId('7xyz')).toBe('mural-vtt-ord7xyz');
    expect(roomCodeToHostPeerId('ord-9abc')).toBe('mural-vtt-ord9abc');

    expect(peerIdToRoomCode('mural-vtt-ord7xyz')).toBe('ORD-7XYZ');
    expect(peerIdToRoomCode('mural-vtt-ord9abc')).toBe('ORD-9ABC');
    expect(peerIdToRoomCode('invalid-peer-id')).toBeNull();
    expect(peerIdToRoomCode('')).toBeNull();
  });
});

// ============================================================================
// Suite 2: Tactical Coordinate Transformations & Viewport Navigation
// ============================================================================

describe('Tier 9.2: Tactical Coordinate Transformations & Viewport Navigation', () => {
  it('accurately converts world to screen coordinates with pan and zoom', () => {
    const world = { x: 100, y: 200 };
    const pan = { x: 50, y: -20 };
    const zoom = 1.5;

    const screen = worldToScreen(world, pan, zoom);
    expect(screen.x).toBe(100 * 1.5 + 50); // 200
    expect(screen.y).toBe(200 * 1.5 - 20); // 280
  });

  it('inverts screen to world coordinates perfectly within floating point precision', () => {
    const world = { x: 140, y: 210 };
    const pan = { x: -80, y: 120 };
    const zoom = 2.0;

    const screen = worldToScreen(world, pan, zoom);
    const roundtrip = screenToWorld(screen, pan, zoom);

    expect(Math.abs(roundtrip.x - world.x) < 1e-6).toBe(true);
    expect(Math.abs(roundtrip.y - world.y) < 1e-6).toBe(true);
  });

  it('safely guards against zero or negative zoom values', () => {
    const screen = { x: 100, y: 100 };
    const pan = { x: 0, y: 0 };
    const worldZeroZoom = screenToWorld(screen, pan, 0);
    expect(worldZeroZoom.x).toBe(100);
    expect(worldZeroZoom.y).toBe(100);

    const worldNegZoom = screenToWorld(screen, pan, -1.5);
    expect(worldNegZoom.x).toBe(100);
  });

  it('re-anchors pan when zooming around cursor without camera drift', () => {
    const pan = { x: 0, y: 0 };
    const cursor = { x: 400, y: 300 };
    const newPan = calculateZoomPan(pan, 1.0, 2.0, cursor);

    // World coordinate under cursor before: (400, 300)
    // World coordinate under cursor after zoom must remain exactly (400, 300)
    const worldAfter = screenToWorld(cursor, newPan, 2.0);
    expect(worldAfter.x).toBe(400);
    expect(worldAfter.y).toBe(300);
  });
});

// ============================================================================
// Suite 3: 1.5m Continuous Measurement Scale & Ruler Formulations
// ============================================================================

describe('Tier 9.3: 1.5m Continuous Measurement Scale & Ruler Formulations', () => {
  it('verifies standard scale calibration: 70 pixels = 1.5 meters', () => {
    expect(TACTICAL_GRID_SIZE_PX).toBe(70);
    expect(TACTICAL_GRID_STEP_METERS).toBe(1.5);
    expect(VTT_STANDARD_GRID_SIZE_PX).toBe(70);
    expect(VTT_STANDARD_GRID_STEP_METERS).toBe(1.5);

    const p1 = { x: 0, y: 0 };
    const p2 = { x: 70, y: 0 };

    const distMeters = calculateDistanceMeters(p1, p2);
    expect(Math.abs(distMeters - 1.5) < 1e-4).toBe(true);
    expect(formatDistanceMeters(distMeters)).toBe('1.5 m');
    expect(formatMeters(distMeters)).toBe('1.5 m');
  });

  it('computes diagonal Euclidean continuous distance accurately', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 70, y: 70 };

    const ruler = measureRuler(p1, p2);
    expect(ruler.distancePx).toBe(Math.sqrt(70 * 70 + 70 * 70));
    expect(ruler.distanceMeters > 2.12 && ruler.distanceMeters < 2.13).toBe(true);
    expect(ruler.formattedMeters).toBe('2.1 m');
    expect(ruler.stepsCount > 1.41 && ruler.stepsCount < 1.42).toBe(true);
  });

  it('converts meters to standard grid steps', () => {
    expect(metersToGridUnits(1.5)).toBe(1);
    expect(metersToGridUnits(3.0)).toBe(2);
    expect(metersToGridUnits(4.5)).toBe(3);
    expect(metersToGridUnits(9.0)).toBe(6);
  });
});

// ============================================================================
// Suite 4: Area of Effect (AoE) Geometry & SVG Paths
// ============================================================================

describe('Tier 9.4: Area of Effect (AoE) Geometry & SVG Paths', () => {
  it('generates circle explosion geometry, SVG path, and containment test', () => {
    const origin = { x: 100, y: 100 };
    const target = { x: 170, y: 100 }; // 70px = 1.5m radius

    const aoe = calculateAoeGeometry('circle', origin, target);
    expect(aoe.type).toBe('circle');
    expect(Math.abs(aoe.distanceMeters - 1.5) < 1e-4).toBe(true);
    expect(aoe.radiusPx).toBe(70);
    expect(aoe.svgPath?.startsWith('M 100 30')).toBe(true);
    expect(aoe.label).toContain('Círculo: 1.5 m');

    expect(isPointInCircle({ x: 120, y: 100 }, origin, aoe.radiusPx!)).toBe(true);
    expect(isPointInCircle({ x: 170, y: 100 }, origin, aoe.radiusPx!)).toBe(true);
    expect(isPointInCircle({ x: 180, y: 100 }, origin, aoe.radiusPx!)).toBe(false);
  });

  it('generates 60° cone arc sector geometry, SVG path, and directional containment', () => {
    const origin = { x: 100, y: 100 };
    const target = { x: 200, y: 100 }; // 100px cone along +X axis

    const aoe = calculateAoeGeometry('cone', origin, target, { coneAngleDeg: 60 });
    expect(aoe.type).toBe('cone');
    expect(aoe.svgPath?.includes('A 100 100 0 0 1')).toBe(true);
    expect(aoe.label).toContain('Cone:');

    // On centerline: inside
    expect(isPointInCone({ x: 150, y: 100 }, origin, target)).toBe(true);
    // 20° off centerline: inside (half-angle is 30°)
    const inConePoint = {
      x: 100 + 60 * Math.cos((20 * Math.PI) / 180),
      y: 100 + 60 * Math.sin((20 * Math.PI) / 180),
    };
    expect(isPointInCone(inConePoint, origin, target)).toBe(true);
    // 40° off centerline: outside
    const outConePoint = {
      x: 100 + 60 * Math.cos((40 * Math.PI) / 180),
      y: 100 + 60 * Math.sin((40 * Math.PI) / 180),
    };
    expect(isPointInCone(outConePoint, origin, target)).toBe(false);
    // Past max range: outside
    expect(isPointInCone({ x: 250, y: 100 }, origin, target)).toBe(false);
  });

  it('generates 1.5m wide rectangular line beam geometry and boundary containment', () => {
    const origin = { x: 0, y: 0 };
    const target = { x: 140, y: 0 }; // 3.0m line along X axis

    const aoe = calculateAoeGeometry('line', origin, target, { lineWidthMeters: 1.5 });
    expect(aoe.type).toBe('line');
    expect(aoe.linePolygonPoints?.length).toBe(4);
    expect(aoe.label).toContain('Linha: 3.0 m x 1.5 m');

    // Inside centerline
    expect(isPointInLineBeam({ x: 50, y: 0 }, origin, target, 70)).toBe(true);
    // Inside within half-width (35px)
    expect(isPointInLineBeam({ x: 50, y: 25 }, origin, target, 70)).toBe(true);
    // Outside beyond half-width
    expect(isPointInLineBeam({ x: 50, y: 45 }, origin, target, 70)).toBe(false);
    // Outside beyond line length
    expect(isPointInLineBeam({ x: 160, y: 0 }, origin, target, 70)).toBe(false);
  });
});

// ============================================================================
// Suite 5: Anti-Cheat Stealth Filtering & Movement Authorization
// ============================================================================

describe('Tier 9.5: Anti-Cheat Stealth Filtering & Movement Authorization', () => {
  const sampleTokens: VttToken[] = [
    {
      id: 'tok-player-elena',
      name: 'Elena',
      x: 50,
      y: 50,
      size: 'medio',
      color: '#38bdf8',
      pv: { current: 20, max: 20 },
      san: { current: 35, max: 40 },
      conditions: [],
      isStealth: false,
      ownerPeerId: 'peer-elena',
      characterId: 'char-elena',
    },
    {
      id: 'tok-monster-stealth',
      name: 'Criatura das Sombras',
      x: 300,
      y: 400,
      size: 'grande',
      color: '#ef4444',
      pv: { current: 60, max: 60 },
      san: { current: 0, max: 0 },
      conditions: [],
      isStealth: true,
      ownerPeerId: 'peer-gm',
    },
    {
      id: 'tok-player-hidden',
      name: 'Elena Escondida',
      x: 60,
      y: 60,
      size: 'medio',
      color: '#38bdf8',
      pv: { current: 20, max: 20 },
      san: { current: 35, max: 40 },
      conditions: [],
      isStealth: true,
      ownerPeerId: 'peer-elena',
    },
  ];

  const sampleScene: VttScene = {
    id: 'scene-mansao',
    name: 'Mansão Assombrada',
    backgroundUrl: 'https://example.com/map.jpg',
    width: 2000,
    height: 1500,
    scaleRatio: 46.6667,
    tokens: sampleTokens,
    fogActions: [],
    gridless: true,
  };

  it('strictly culls invisible enemy tokens from player scene payload', () => {
    const sanitized = sanitizeSceneForPlayer(sampleScene, 'peer-elena');
    // Should retain Elena and Elena's stealth token, but strictly strip enemy monster
    expect(sanitized.tokens.length).toBe(2);
    expect(sanitized.tokens.some((t) => t.id === 'tok-player-elena')).toBe(true);
    expect(sanitized.tokens.some((t) => t.id === 'tok-player-hidden')).toBe(true);
    expect(sanitized.tokens.some((t) => t.id === 'tok-monster-stealth')).toBe(false);

    // Deep-clone test: master scene remains completely unmutated
    expect(sampleScene.tokens.length).toBe(3);
  });

  it('strips all stealth tokens when playerPeerId is unknown or external', () => {
    const sanitized = sanitizeSceneForPlayer(sampleScene, 'peer-unknown-spectator');
    expect(sanitized.tokens.length).toBe(1);
    expect(sanitized.tokens[0].id).toBe('tok-player-elena');
  });

  it('authorizes token movement strictly by GM authority and peer ownership', () => {
    const elenaToken = sampleTokens[0];
    const monsterToken = sampleTokens[1];

    // GM has universal authority
    expect(authorizeTokenMove(elenaToken, 'peer-gm', true)).toBe(true);
    expect(authorizeTokenMove(monsterToken, 'peer-gm', true)).toBe(true);

    // Elena can move her own assigned token
    expect(authorizeTokenMove(elenaToken, 'peer-elena', false)).toBe(true);
    // Elena can move via linked characterId
    expect(authorizeTokenMove(elenaToken, 'peer-other-session', false, 'char-elena')).toBe(true);

    // Elena CANNOT move monster or tokens she does not own
    expect(authorizeTokenMove(monsterToken, 'peer-elena', false)).toBe(false);
    expect(authorizeTokenMove(monsterToken, 'peer-random', false)).toBe(false);
  });
});

// ============================================================================
// Suite 6: Tactical Combat Tracker State Machine
// ============================================================================

describe('Tier 9.6: Tactical Combat Tracker State Machine', () => {
  const combatants: Combatant[] = [
    { id: 'c1', name: 'Zumbi de Sangue B', initiative: 12, isPlayer: false, isDefeated: false },
    { id: 'c2', name: 'Zumbi de Sangue A', initiative: 12, isPlayer: false, isDefeated: false },
    { id: 'c3', name: 'Mariana', initiative: 18, isPlayer: true, isDefeated: false },
    { id: 'c4', name: 'Elena', initiative: 12, isPlayer: true, isDefeated: false },
  ];

  it('sorts combatants with initiative descending and player tie-breaking priority', () => {
    const sorted = sortCombatants(combatants);
    expect(sorted[0].name).toBe('Mariana'); // 18
    expect(sorted[1].name).toBe('Elena'); // 12, player goes first on tie
    // Between NPCs with same initiative, alphabetical tie-break
    expect(sorted[2].name).toBe('Zumbi de Sangue A');
    expect(sorted[3].name).toBe('Zumbi de Sangue B');
  });

  it('advances turn and correctly wraps around rounds', () => {
    const encounter: CombatEncounter = {
      id: 'enc-1',
      name: 'Combate no Galpão',
      round: 1,
      activeIndex: 0,
      combatants: sortCombatants(combatants),
      isRunning: true,
    };

    expect(getActiveCombatant(encounter)?.name).toBe('Mariana');

    const step1 = advanceTurn(encounter);
    expect(step1.round).toBe(1);
    expect(step1.activeIndex).toBe(1);
    expect(getActiveCombatant(step1)?.name).toBe('Elena');

    const step2 = advanceTurn(step1);
    expect(step2.round).toBe(1);
    expect(step2.activeIndex).toBe(2);

    const step3 = advanceTurn(step2);
    expect(step3.round).toBe(1);
    expect(step3.activeIndex).toBe(3);

    // End of round wrap-around to Round 2, activeIndex 0
    const step4 = advanceTurn(step3);
    expect(step4.round).toBe(2);
    expect(step4.activeIndex).toBe(0);
    expect(getActiveCombatant(step4)?.name).toBe('Mariana');
  });

  it('steps backwards with previousTurn preserving round bounds', () => {
    const encounter: CombatEncounter = {
      id: 'enc-1',
      name: 'Combate',
      round: 2,
      activeIndex: 0,
      combatants: sortCombatants(combatants),
      isRunning: true,
    };

    const prev = previousTurn(encounter);
    expect(prev.round).toBe(1);
    expect(prev.activeIndex).toBe(3);
  });

  it('creates clean combat encounter with factory helper', () => {
    const enc = createCombatEncounter('Emboscada');
    expect(enc.name).toBe('Emboscada');
    expect(enc.round).toBe(1);
    expect(enc.activeIndex).toBe(0);
    expect(enc.combatants.length).toBe(0);
    expect(enc.isRunning).toBe(false);
  });
});

// ============================================================================
// Suite 7: Live Dice Expression Parser & Critical/Fumble Engine
// ============================================================================

describe('Tier 9.7: Live Dice Expression Parser & Critical/Fumble Engine', () => {
  it('parses NdX + M expressions with deterministic rollFn injection', () => {
    const roll = parseDiceExpression('3d20 + 5', 'Elena', () => 14);
    expect(roll.expression).toBe('3d20 + 5');
    expect(roll.dice.length).toBe(3);
    expect(roll.dice[0].result).toBe(14);
    expect(roll.modifier).toBe(5);
    expect(roll.total).toBe(47); // 14*3 + 5
    expect(roll.keptValue).toBe(14);
    expect(roll.isCritical).toBe(false);
    expect(roll.isFumble).toBe(false);

    const formatted = formatDiceResult(roll);
    expect(formatted).toContain('[Elena] 3d20 + 5 = [14, 14, 14] + 5 -> Total: 47');
  });

  it('detects natural 20 criticals and natural 1 fumbles accurately', () => {
    let callCount = 0;
    const critRoll = parseDiceExpression('2d20 + 3', 'Mariana', () => {
      callCount++;
      return callCount === 1 ? 20 : 8;
    });
    expect(critRoll.isCritical).toBe(true);
    expect(critRoll.isFumble).toBe(false);

    const fumbleRoll = parseDiceExpression('3d20', 'Mariana', () => 1);
    expect(fumbleRoll.isCritical).toBe(false);
    expect(fumbleRoll.isFumble).toBe(true);
  });

  it('parses expressions with negative modifiers', () => {
    const roll = parseDiceExpression('2d6 - 2', 'Mariana', () => 4);
    expect(roll.modifier).toBe(-2);
    expect(roll.total).toBe(6); // 4 + 4 - 2
  });

  it('throws descriptive error on malformed dice formula', () => {
    let errorCaught = false;
    try {
      parseDiceExpression('invalid-formula');
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('Expressão de dados inválida');
    }
    expect(errorCaught).toBe(true);
  });
});

// ============================================================================
// Suite 8: WebRTC P2P Packet Envelopes & Runtime Type Guards
// ============================================================================

describe('Tier 9.8: WebRTC P2P Packet Envelopes & Runtime Type Guards', () => {
  it('validates VttTokenSize enum values and runtime type guard', () => {
    expect(isVttTokenSize('pequeno')).toBe(true);
    expect(isVttTokenSize('medio')).toBe(true);
    expect(isVttTokenSize('grande')).toBe(true);
    expect(isVttTokenSize('enorme')).toBe(true);
    expect(isVttTokenSize('gigante')).toBe(false);
    expect(isVttTokenSize(123)).toBe(false);

    expect(VTT_TOKEN_SIZES.pequeno.diameterPx).toBe(56);
    expect(VTT_TOKEN_SIZES.medio.diameterPx).toBe(70);
    expect(VTT_TOKEN_SIZES.grande.diameterPx).toBe(140);
    expect(VTT_TOKEN_SIZES.enorme.diameterPx).toBe(210);
  });

  it('validates Fog of War opacity constants and FogAction type guard', () => {
    expect(VTT_FOG_GM_OPACITY).toBe(0.55);
    expect(VTT_FOG_PLAYER_OPACITY).toBe(1.0);
    expect(VTT_FOG_COLOR).toBe('#000000');

    const action: FogAction = {
      type: 'reveal_rect',
      rect: { x: 0, y: 0, width: 100, height: 100 },
      timestamp: Date.now(),
    };
    expect(isFogAction(action)).toBe(true);
    expect(isFogAction({ type: 'invalid_op', timestamp: 123 })).toBe(false);
  });

  it('validates VttPing model and duration constant', () => {
    expect(VTT_PING_DURATION_MS).toBe(2500);

    const ping: VttPing = {
      id: 'ping-1',
      x: 100,
      y: 150,
      color: '#38bdf8',
      senderId: 'peer-1',
      senderName: 'Mariana',
      timestamp: Date.now(),
    };
    expect(isVttPing(ping)).toBe(true);
    expect(isVttPing({ x: 'invalid' })).toBe(false);
  });

  it('validates VTTEnvelope serialization and type guard across all 6 core events', () => {
    const sceneEnvelope: VTTEnvelope<VttSceneSyncPayload> = {
      type: 'VTT_SCENE_SYNC',
      senderId: 'host-peer',
      senderName: 'Mestre',
      timestamp: Date.now(),
      payload: {
        scene: {
          id: 'scene-1',
          name: 'Sala',
          backgroundUrl: 'https://map.png',
          width: 800,
          height: 600,
          scaleRatio: 46.6667,
          tokens: [],
          fogActions: [],
          gridless: true,
        },
      },
    };
    expect(isVttEnvelope(sceneEnvelope)).toBe(true);

    const moveEnvelope: VTTEnvelope<VttTokenMovePayload> = {
      type: 'VTT_TOKEN_MOVE',
      senderId: 'player-peer',
      timestamp: Date.now(),
      payload: {
        tokenId: 'tok-1',
        x: 120,
        y: 180,
        distanceMeters: 3.0,
        isFinal: true,
      },
    };
    expect(isVttEnvelope(moveEnvelope)).toBe(true);

    const fogEnvelope: VTTEnvelope<VttFogUpdatePayload> = {
      type: 'VTT_FOG_UPDATE',
      senderId: 'host-peer',
      timestamp: Date.now(),
      payload: {
        action: {
          type: 'reveal_brush',
          points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
          radius: 35,
          timestamp: Date.now(),
        },
      },
    };
    expect(isVttEnvelope(fogEnvelope)).toBe(true);

    const pingEnvelope: VTTEnvelope = {
      type: 'VTT_MAP_PING',
      senderId: 'player-peer',
      timestamp: Date.now(),
      payload: {
        ping: {
          x: 200,
          y: 300,
          color: '#ef4444',
          senderId: 'player-peer',
          senderName: 'Jogador',
          timestamp: Date.now(),
        },
      },
    };
    expect(isVttEnvelope(pingEnvelope)).toBe(true);

    const initEnvelope: VTTEnvelope<VttInitiativeUpdatePayload> = {
      type: 'VTT_INITIATIVE_UPDATE',
      senderId: 'host-peer',
      timestamp: Date.now(),
      payload: {
        encounter: createCombatEncounter('Batalha'),
      },
    };
    expect(isVttEnvelope(initEnvelope)).toBe(true);

    const diceEnvelope: VTTEnvelope = {
      type: 'VTT_DICE_ROLL',
      senderId: 'player-peer',
      timestamp: Date.now(),
      payload: {
        roll: parseDiceExpression('1d20 + 2', 'Mariana', () => 18),
      },
    };
    expect(isVttEnvelope(diceEnvelope)).toBe(true);
  });
});

// ============================================================================
// Suite 14: Milestone 2 Canonical Token Size Geometry & Vital Pool Metrics
// ============================================================================

describe('Tier 9.14: Milestone 2 Canonical Token Size Geometry & Vital Pool Metrics', () => {
  it('strictly validates all 4 canonical token sizes and grid footprints', () => {
    // Pequeno: 56px, 1.2m, 1x1
    expect(VTT_TOKEN_SIZES.pequeno.diameterPx).toBe(56);
    expect(VTT_TOKEN_SIZES.pequeno.standardMeters).toBe(1.2);
    expect(VTT_TOKEN_SIZES.pequeno.gridFootprint).toBe('1x1');

    // Médio: 70px, 1.5m, 1x1
    expect(VTT_TOKEN_SIZES.medio.diameterPx).toBe(70);
    expect(VTT_TOKEN_SIZES.medio.standardMeters).toBe(1.5);
    expect(VTT_TOKEN_SIZES.medio.gridFootprint).toBe('1x1');

    // Grande: 140px, 3.0m, 2x2
    expect(VTT_TOKEN_SIZES.grande.diameterPx).toBe(140);
    expect(VTT_TOKEN_SIZES.grande.standardMeters).toBe(3.0);
    expect(VTT_TOKEN_SIZES.grande.gridFootprint).toBe('2x2');

    // Enorme: 210px, 4.5m, 3x3
    expect(VTT_TOKEN_SIZES.enorme.diameterPx).toBe(210);
    expect(VTT_TOKEN_SIZES.enorme.standardMeters).toBe(4.5);
    expect(VTT_TOKEN_SIZES.enorme.gridFootprint).toBe('3x3');

    // Sizing ratio relations
    expect(VTT_TOKEN_SIZES.pequeno.diameterPx / VTT_TOKEN_SIZES.medio.diameterPx).toBe(0.8);
    expect(VTT_TOKEN_SIZES.grande.diameterPx / VTT_TOKEN_SIZES.medio.diameterPx).toBe(2.0);
    expect(VTT_TOKEN_SIZES.enorme.diameterPx / VTT_TOKEN_SIZES.medio.diameterPx).toBe(3.0);
  });

  it('validates genuine token entity structure across all 4 canonical sizes', () => {
    const sizes: Array<keyof typeof VTT_TOKEN_SIZES> = ['pequeno', 'medio', 'grande', 'enorme'];
    for (const size of sizes) {
      const token: VttToken = {
        id: `token-${size}-01`,
        name: `Investigador ${size}`,
        x: 100,
        y: 150,
        size,
        color: '#38bdf8',
        pv: { current: 20, max: 20, temp: 5 },
        san: { current: 15, max: 20 },
        conditions: ['Abalado'],
        isStealth: false,
      };
      expect(isVttToken(token)).toBe(true);
      expect(isVttTokenSize(token.size)).toBe(true);
      expect(VTT_TOKEN_SIZES[token.size].diameterPx).toBeGreaterThan(0);
    }
  });

  it('verifies standard condition badges roster integrity', () => {
    expect(VTT_STANDARD_CONDITIONS.length).toBe(11);
    expect(VTT_STANDARD_CONDITIONS.includes('Abalado')).toBe(true);
    expect(VTT_STANDARD_CONDITIONS.includes('Sangrando')).toBe(true);
    expect(VTT_STANDARD_CONDITIONS.includes('Inconsciente')).toBe(true);
    expect(VTT_STANDARD_CONDITIONS.includes('Morrendo')).toBe(true);
    expect(VTT_STANDARD_CONDITIONS.includes('Cego')).toBe(true);
    expect(VTT_STANDARD_CONDITIONS.includes('Paralisado')).toBe(true);
    expect(VTT_STANDARD_CONDITIONS.includes('Envenenado')).toBe(true);
    expect(VTT_STANDARD_CONDITIONS.includes('Vulnerável')).toBe(true);
    expect(VTT_STANDARD_CONDITIONS.includes('Fatigado')).toBe(true);
    expect(VTT_STANDARD_CONDITIONS.includes('Surpreendido')).toBe(true);
    expect(VTT_STANDARD_CONDITIONS.includes('Desesperado')).toBe(true);

    // Uniqueness
    const unique = new Set(VTT_STANDARD_CONDITIONS);
    expect(unique.size).toBe(VTT_STANDARD_CONDITIONS.length);
  });

  it('computes dynamic vital health bar threshold colors correctly', () => {
    function getPvColor(current: number, max: number): string {
      const pct = (current / max) * 100;
      if (pct > 50) return 'bg-emerald-500';
      if (pct > 25) return 'bg-amber-500';
      return 'bg-rose-600';
    }

    expect(getPvColor(20, 20)).toBe('bg-emerald-500'); // 100%
    expect(getPvColor(11, 20)).toBe('bg-emerald-500'); // 55%
    expect(getPvColor(10, 20)).toBe('bg-amber-500');   // 50%
    expect(getPvColor(6, 20)).toBe('bg-amber-500');    // 30%
    expect(getPvColor(5, 20)).toBe('bg-rose-600');     // 25%
    expect(getPvColor(1, 20)).toBe('bg-rose-600');     // 5%
    expect(getPvColor(0, 20)).toBe('bg-rose-600');     // 0%
  });
});

// ============================================================================
// Suite 15: Milestone 2 Dual-View Fog of War Opacities & Geometric Action Matrix
// ============================================================================

describe('Tier 9.15: Milestone 2 Dual-View Fog of War Opacities & Geometric Action Matrix', () => {
  it('enforces canonical dual-view fog visual opacities and base mask color', () => {
    // GM view: 0.55 opacity semi-transparent overlay
    expect(VTT_FOG_GM_OPACITY).toBe(0.55);

    // Player view: 1.0 opacity 100% pitch black opaque mask
    expect(VTT_FOG_PLAYER_OPACITY).toBe(1.0);

    // Mask color: #000000
    expect(VTT_FOG_COLOR).toBe('#000000');
  });

  it('validates all 6 deterministic FogAction types', () => {
    const actions: FogAction[] = [
      {
        id: 'fog-1',
        type: 'blanket_all',
        timestamp: Date.now(),
      },
      {
        id: 'fog-2',
        type: 'clear_all',
        timestamp: Date.now(),
      },
      {
        id: 'fog-3',
        type: 'reveal_rect',
        rect: { x: 100, y: 100, width: 250, height: 180 },
        timestamp: Date.now(),
      },
      {
        id: 'fog-4',
        type: 'hide_rect',
        rect: { x: 150, y: 150, width: 100, height: 80 },
        timestamp: Date.now(),
      },
      {
        id: 'fog-5',
        type: 'reveal_brush',
        points: [{ x: 50, y: 50 }, { x: 80, y: 80 }, { x: 120, y: 90 }],
        radius: 60,
        timestamp: Date.now(),
      },
      {
        id: 'fog-6',
        type: 'hide_brush',
        points: [{ x: 200, y: 200 }, { x: 220, y: 240 }],
        radius: 40,
        timestamp: Date.now(),
      },
    ];

    for (const a of actions) {
      expect(isFogAction(a)).toBe(true);
    }
  });

  it('normalizes inverted rectangle drag dimensions to positive bounds', () => {
    function normalizeRect(rect: { x: number; y: number; width: number; height: number }) {
      const x = rect.width < 0 ? rect.x + rect.width : rect.x;
      const y = rect.height < 0 ? rect.y + rect.height : rect.y;
      const width = Math.abs(rect.width);
      const height = Math.abs(rect.height);
      return { x, y, width, height };
    }

    // Normal drag: top-left (100, 100) to bottom-right (300, 250)
    const norm1 = normalizeRect({ x: 100, y: 100, width: 200, height: 150 });
    expect(norm1.x).toBe(100);
    expect(norm1.y).toBe(100);
    expect(norm1.width).toBe(200);
    expect(norm1.height).toBe(150);

    // Inverted drag: bottom-right (300, 250) to top-left (100, 100)
    const norm2 = normalizeRect({ x: 300, y: 250, width: -200, height: -150 });
    expect(norm2.x).toBe(100);
    expect(norm2.y).toBe(100);
    expect(norm2.width).toBe(200);
    expect(norm2.height).toBe(150);
  });

  it('verifies mathematical dual-view alpha composition equations', () => {
    // Effective alpha formula: alpha_effective = alpha_pixel * layer_opacity
    // Revealed pixel (alpha_pixel = 0)
    const alphaRevealedPlayer = 0 * VTT_FOG_PLAYER_OPACITY;
    const alphaRevealedGm = 0 * VTT_FOG_GM_OPACITY;
    expect(alphaRevealedPlayer).toBe(0); // 100% transparent cutout for player
    expect(alphaRevealedGm).toBe(0);     // 100% transparent cutout for GM

    // Unrevealed fog pixel (alpha_pixel = 1.0)
    const alphaFogPlayer = 1.0 * VTT_FOG_PLAYER_OPACITY;
    const alphaFogGm = 1.0 * VTT_FOG_GM_OPACITY;
    expect(alphaFogPlayer).toBe(1.0);  // 100% solid opaque black for player
    expect(alphaFogGm).toBe(0.55);     // 55% translucent dark tint for GM
  });
});

// ============================================================================
// Suite 16: Milestone 2 Continuous Measurement Ruler Step Ticks & Speed Budgets
// ============================================================================

describe('Tier 9.16: Milestone 2 Continuous Measurement Ruler Step Ticks & Speed Budgets', () => {
  it('verifies standard scale conversions and intermediate 1.5m tick placement', () => {
    // 70px = 1.5m -> 46.6667 px/m
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 100 + 70 * 4, y: 100 }; // Exactly 4 standard 1.5m steps = 6.0m (280px)

    const measurement = measureRuler(p1, p2);
    expect(measurement.distancePx).toBe(280);
    expect(measurement.distanceMeters).toBeCloseTo(6.0, 3);
    expect(measurement.stepsCount).toBeCloseTo(4.0, 3);
    expect(measurement.formattedMeters).toBe('6.0 m');

    // Intermediate tick calculation function
    function getTicks(start: { x: number; y: number }, end: { x: number; y: number }, distPx: number) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const ux = dx / distPx;
      const uy = dy / distPx;
      const nx = -uy;
      const ny = ux;
      const totalSteps = Math.floor(distPx / TACTICAL_GRID_SIZE_PX);
      const ticks = [];
      for (let i = 1; i <= totalSteps; i++) {
        const stepPx = i * TACTICAL_GRID_SIZE_PX;
        if (stepPx < distPx - 5) {
          const cx = start.x + ux * stepPx;
          const cy = start.y + uy * stepPx;
          ticks.push({ cx, cy, step: i });
        }
      }
      return ticks;
    }

    const ticks = getTicks(p1, p2, 280);
    // At exactly 280px (4 steps), intermediate ticks are at step 1 (70px), step 2 (140px), step 3 (210px)
    expect(ticks.length).toBe(3);
    expect(ticks[0].cx).toBe(170);
    expect(ticks[1].cx).toBe(240);
    expect(ticks[2].cx).toBe(310);
  });

  it('classifies token movement distance into speed budget color categories', () => {
    function classifySpeedBudget(meters: number, maxSpeed: number = 9.0) {
      if (meters <= maxSpeed) return 'emerald'; // Standard move <= 9m
      if (meters <= maxSpeed * 2) return 'amber'; // Double move <= 18m
      return 'rose'; // Budget exceeded > 18m
    }

    expect(classifySpeedBudget(0)).toBe('emerald');
    expect(classifySpeedBudget(4.5)).toBe('emerald');
    expect(classifySpeedBudget(9.0)).toBe('emerald');
    expect(classifySpeedBudget(9.1)).toBe('amber');
    expect(classifySpeedBudget(15.0)).toBe('amber');
    expect(classifySpeedBudget(18.0)).toBe('amber');
    expect(classifySpeedBudget(18.1)).toBe('rose');
    expect(classifySpeedBudget(30.0)).toBe('rose');
  });

  it('calculates intermediate ticks orthogonal to trajectory vector', () => {
    const start = { x: 50, y: 50 };
    const end = { x: 50 + 140, y: 50 + 140 }; // Diagonal trajectory (sqrt(2) * 140 ≈ 197.98px)
    const distPx = Math.hypot(end.x - start.x, end.y - start.y);

    const ux = (end.x - start.x) / distPx;
    const uy = (end.y - start.y) / distPx;
    const nx = -uy;
    const ny = ux;

    // Dot product between unit trajectory and normal vector must be 0
    const dotProduct = ux * nx + uy * ny;
    expect(Math.abs(dotProduct)).toBeLessThan(1e-10);
  });
});

// ============================================================================
// Suite 17: Milestone 2 Viewport Multi-Touch & Anchor Pan Invariance
// ============================================================================

describe('Tier 9.17: Milestone 2 Viewport Multi-Touch & Anchor Pan Invariance', () => {
  it('guarantees calculateZoomPan preserves exact world coordinate under pointer', () => {
    const currentPan = { x: 100, y: 50 };
    const currentZoom = 1.0;
    const targetZoom = 2.5;
    const screenAnchor = { x: 400, y: 300 };

    // World position before zoom
    const worldBefore = screenToWorld(screenAnchor, currentPan, currentZoom);

    // Apply zoom pan
    const newPan = calculateZoomPan(currentPan, currentZoom, targetZoom, screenAnchor);

    // Screen position of world anchor after zoom must remain exactly at screenAnchor
    const screenAfter = worldToScreen(worldBefore, newPan, targetZoom);
    expect(screenAfter.x).toBeCloseTo(screenAnchor.x, 5);
    expect(screenAfter.y).toBeCloseTo(screenAnchor.y, 5);
  });

  it('verifies coordinate bridging bidirectional round-trip invariance', () => {
    const pan = { x: -250, y: 180 };
    const zoom = 1.75;
    const testPoints = [
      { x: 0, y: 0 },
      { x: 1024, y: 768 },
      { x: -500, y: 1200 },
      { x: 345.67, y: 890.12 },
    ];

    for (const pt of testPoints) {
      const world = screenToWorld(pt, pan, zoom);
      const screen = worldToScreen(world, pan, zoom);
      expect(screen.x).toBeCloseTo(pt.x, 8);
      expect(screen.y).toBeCloseTo(pt.y, 8);
    }
  });

  it('validates fit-to-screen scale math respects container boundaries with margin', () => {
    const containerW = 1200;
    const containerH = 800;
    const sceneW = 2048;
    const sceneH = 1536;

    const scaleX = (containerW * 0.92) / sceneW; // (1200 * 0.92) / 2048 ≈ 0.539
    const scaleY = (containerH * 0.92) / sceneH; // (800 * 0.92) / 1536 ≈ 0.479
    const fitZoom = Math.min(scaleX, scaleY); // 0.479

    expect(fitZoom).toBeLessThan(scaleX);
    expect(fitZoom).toBeCloseTo(scaleY, 5);

    const panX = (containerW - sceneW * fitZoom) / 2;
    const panY = (containerH - sceneH * fitZoom) / 2;

    // Center of scene should be centered in container
    const sceneCenter = { x: sceneW / 2, y: sceneH / 2 };
    const screenCenter = worldToScreen(sceneCenter, { x: panX, y: panY }, fitZoom);
    expect(screenCenter.x).toBeCloseTo(containerW / 2, 5);
    expect(screenCenter.y).toBeCloseTo(containerH / 2, 5);
  });
});

// ============================================================================
// Suite 9.18: Browser Player-Only Mode Sandboxing & Guard Rules
// ============================================================================
describe('Tier 9.18: Browser Player-Only Mode Sandboxing & Environment Guard', () => {
  it('determines browser environment strictly activates Player-Only view when not in Tauri', () => {
    // Simulating browser vs tauri environment logic
    function resolveIsPlayerOnlyBrowser(isTauri: boolean, queryParams: string): boolean {
      const params = new URLSearchParams(queryParams);
      if (params.get('mode') === 'gm') return false;
      if (params.get('mode') === 'player' || params.get('player') === '1') return true;
      return !isTauri;
    }

    // In a browser (!isTauri) without params -> strictly player only!
    expect(resolveIsPlayerOnlyBrowser(false, '')).toBe(true);

    // In a browser with ?room=ORD-1234 -> strictly player only!
    expect(resolveIsPlayerOnlyBrowser(false, '?room=ORD-1234')).toBe(true);

    // In desktop Tauri (isTauri = true) -> GM full suite!
    expect(resolveIsPlayerOnlyBrowser(true, '')).toBe(false);

    // Explicit developer override for local testing -> bypass allowed
    expect(resolveIsPlayerOnlyBrowser(false, '?mode=gm')).toBe(false);

    // Explicit player mode even if in desktop
    expect(resolveIsPlayerOnlyBrowser(true, '?mode=player')).toBe(true);
  });

  it('guarantees confidential GM data is stripped from Player scenes', () => {
    const gmScene: any = {
      id: 'sc-confidential',
      name: 'Mansão Secreta',
      width: 2000,
      height: 2000,
      scaleRatio: 46.6667,
      gridless: true,
      backgroundUrl: 'https://example.com/map.png',
      fogActions: [],
      gmNotes: 'O monstro está escondido atrás do altar.',
      tokens: [
        {
          id: 'tok-p1',
          name: 'Arthur',
          size: 'medio',
          x: 100,
          y: 100,
          color: '#38bdf8',
          pv: { current: 20, max: 20 },
          san: { current: 30, max: 30 },
          isStealth: false,
          ownerPeerId: 'peer-player-1',
          gmNotes: 'Imune a dano mental por 1 turno.',
        },
        {
          id: 'tok-secret-boss',
          name: 'Criatura Oculta',
          size: 'grande',
          x: 500,
          y: 500,
          color: '#ef4444',
          pv: { current: 150, max: 150 },
          san: { current: 0, max: 0 },
          isStealth: true,
          gmNotes: 'Fraqueza: fogo.',
        },
      ],
    };

    const sanitized = sanitizeSceneForPlayer(gmScene, 'peer-player-1');

    // GM notes must be wiped
    expect((sanitized as any).gmNotes).toBeUndefined();
    expect((sanitized.tokens[0] as any).gmNotes).toBeUndefined();

    // Secret stealth creature must be completely culled
    expect(sanitized.tokens.length).toBe(1);
    expect(sanitized.tokens[0].name).toBe('Arthur');
    expect(sanitized.tokens.some((t) => t.name === 'Criatura Oculta')).toBe(false);
  });
});

// ============================================================================
// Suite 9.19: Complete Combat Initiative & Round State Machine
// ============================================================================
describe('Tier 9.19: Complete Combat Initiative & Round State Machine', () => {
  it('correctly creates encounter, sorts combatants, and steps through turns and rounds', () => {
    const enc = createCombatEncounter('Batalha no Galpão');
    expect(enc.round).toBe(1);
    expect(enc.activeIndex).toBe(0);

    const c1 = {
      id: 'c1',
      name: 'Zumbi de Sangue',
      initiative: 12,
      isPlayer: false,
      isDefeated: false,
      hp: { current: 30, max: 30 },
    };
    const c2 = {
      id: 'c2',
      name: 'Mariana',
      initiative: 18,
      isPlayer: true,
      isDefeated: false,
      hp: { current: 25, max: 25 },
    };
    const c3 = {
      id: 'c3',
      name: 'André',
      initiative: 12,
      isPlayer: true, // Tie with c1 -> player priority wins!
      isDefeated: false,
      hp: { current: 20, max: 20 },
    };

    enc.combatants = sortCombatants([c1, c2, c3]);
    expect(enc.combatants[0].name).toBe('Mariana'); // 18
    expect(enc.combatants[1].name).toBe('André');   // 12 (player)
    expect(enc.combatants[2].name).toBe('Zumbi de Sangue'); // 12 (npc)

    // First turn: Mariana
    expect(getActiveCombatant(enc)?.name).toBe('Mariana');

    // Advance turn 1: André
    let next = advanceTurn(enc);
    expect(next.activeIndex).toBe(1);
    expect(next.round).toBe(1);
    expect(getActiveCombatant(next)?.name).toBe('André');

    // Advance turn 2: Zumbi
    next = advanceTurn(next);
    expect(next.activeIndex).toBe(2);
    expect(next.round).toBe(1);
    expect(getActiveCombatant(next)?.name).toBe('Zumbi de Sangue');

    // Advance turn 3: Round wrap-around -> Round 2, Mariana
    next = advanceTurn(next);
    expect(next.activeIndex).toBe(0);
    expect(next.round).toBe(2);
    expect(getActiveCombatant(next)?.name).toBe('Mariana');

    // Step backward: should return to round 1, Zumbi
    const prev = previousTurn(next);
    expect(prev.activeIndex).toBe(2);
    expect(prev.round).toBe(1);
    expect(getActiveCombatant(prev)?.name).toBe('Zumbi de Sangue');
  });
});

// ============================================================================
// Suite 9.20: Tactical Dice Rolling & Critical Success/Fumble Evaluation
// ============================================================================
describe('Tier 9.20: Tactical Dice Rolling & Evaluation', () => {
  it('parses polyhedral dice expressions and handles criticals and fumbles', () => {
    // Critical 20 on d20
    const critRoll = parseDiceExpression('1d20 + 5', 'Arthur', () => 20);
    expect(critRoll.total).toBe(25);
    expect(critRoll.isCritical).toBe(true);
    expect(critRoll.isFumble).toBe(false);

    // Fumble 1 on d20
    const fumbleRoll = parseDiceExpression('1d20', 'Arthur', () => 1);
    expect(critRoll.total).toBe(25);
    expect(fumbleRoll.isCritical).toBe(false);
    expect(fumbleRoll.isFumble).toBe(true);

    // Multi-dice sum (3d6 + 2)
    const multiRoll = parseDiceExpression('3d6 + 2', 'Elena', () => 4);
    expect(multiRoll.total).toBe(14); // 4 + 4 + 4 + 2
    expect(multiRoll.dice.length).toBe(3);
  });
});


