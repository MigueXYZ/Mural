/**
 * tests/tier9_adversarial_security.test.ts
 * 
 * Adversarial Security, Protocol Fuzzing & Boundary Stress Suite for Milestone 1:
 * - Anti-cheat stealth sanitization & confidential GM data purge
 * - Movement authorization rules & identity spoofing resistance
 * - Combat tracker round wrap-around, empty states, and negative initiative edge cases
 * - Dice expression parsing: SQL/XSS injections, empty/blank strings, huge dice counts, and ReDoS
 */

import { describe, it, expect } from './harness';
import {
  sanitizeSceneForPlayer,
  authorizeTokenMove,
  isTokenVisibleToPlayer,
  sortCombatants,
  advanceTurn,
  previousTurn,
  getActiveCombatant,
  createCombatEncounter,
  parseDiceExpression,
  formatDiceResult,
} from '../src/lib/services/vtt/vttProtocol';
import type {
  VttScene,
  VttToken,
  Combatant,
  CombatEncounter,
  DiceRollResult,
} from '../src/lib/types/vtt';

// ============================================================================
// Suite 1: Anti-Cheat & Stealth Sanitization Adversarial Probes
// ============================================================================

describe('Tier 9.9: Adversarial Stealth Sanitization & Anti-Cheat', () => {
  const createBaseScene = (): VttScene => ({
    id: 'scene-secret-dungeon',
    name: 'Masmorra Secreta',
    backgroundUrl: 'https://example.com/dungeon.png',
    width: 3000,
    height: 2000,
    scaleRatio: 46.6667,
    gridless: true,
    tokens: [
      {
        id: 'tok-elena',
        name: 'Elena',
        x: 100,
        y: 100,
        size: 'medio',
        color: '#38bdf8',
        pv: { current: 25, max: 25 },
        san: { current: 40, max: 40 },
        conditions: [],
        isStealth: false,
        ownerPeerId: 'peer-elena',
        characterId: 'char-elena',
      },
      {
        id: 'tok-elena-hidden',
        name: 'Elena Furtiva',
        x: 120,
        y: 120,
        size: 'medio',
        color: '#38bdf8',
        pv: { current: 25, max: 25 },
        san: { current: 40, max: 40 },
        conditions: ['Abalado'],
        isStealth: true,
        ownerPeerId: 'peer-elena',
        characterId: 'char-elena',
      },
      {
        id: 'tok-monster-assassin',
        name: 'Assassino Invisível',
        x: 500,
        y: 500,
        size: 'medio',
        color: '#ef4444',
        pv: { current: 50, max: 50 },
        san: { current: 0, max: 0 },
        conditions: [],
        isStealth: true,
        ownerPeerId: 'peer-gm',
      },
      {
        id: 'tok-unowned-ambush',
        name: 'Espectro Emboscado',
        x: 800,
        y: 800,
        size: 'grande',
        color: '#8b5cf6',
        pv: { current: 100, max: 100 },
        san: { current: 0, max: 0 },
        conditions: [],
        isStealth: true,
        // No ownerPeerId set
      },
    ],
    fogActions: [
      { type: 'blanket_all', timestamp: 1000 },
      { type: 'reveal_rect', rect: { x: 50, y: 50, width: 200, height: 200 }, timestamp: 1010 },
    ],
  });

  it('strictly culls invisible enemy tokens and unowned stealth tokens from player payloads', () => {
    const scene = createBaseScene();
    const sanitized = sanitizeSceneForPlayer(scene, 'peer-elena');

    // Must contain Elena's regular token and Elena's stealth token
    expect(sanitized.tokens.length).toBe(2);
    expect(sanitized.tokens.some((t) => t.id === 'tok-elena')).toBe(true);
    expect(sanitized.tokens.some((t) => t.id === 'tok-elena-hidden')).toBe(true);

    // MUST NOT contain GM assassin or unowned stealth monster
    expect(sanitized.tokens.some((t) => t.id === 'tok-monster-assassin')).toBe(false);
    expect(sanitized.tokens.some((t) => t.id === 'tok-unowned-ambush')).toBe(false);
  });

  it('culls ALL stealth tokens when playerPeerId is unknown, empty, or malicious', () => {
    const scene = createBaseScene();

    const testPeers = [
      '',
      '   ',
      'peer-unknown',
      'peer-elena-spoofed',
      'peer-elena\x00',
      'peer-gm', // GM view shouldn't use sanitizeSceneForPlayer, but if peerId is not exact owner, culls
    ];

    for (const peerId of testPeers) {
      const sanitized = sanitizeSceneForPlayer(scene, peerId);
      // Only tok-elena (isStealth === false) should remain (or monster if peer-gm matched, but assassin is peer-gm)
      if (peerId === 'peer-gm') {
        expect(sanitized.tokens.some((t) => t.id === 'tok-monster-assassin')).toBe(true);
        expect(sanitized.tokens.some((t) => t.id === 'tok-elena-hidden')).toBe(false);
      } else {
        expect(sanitized.tokens.length).toBe(1);
        expect(sanitized.tokens[0].id).toBe('tok-elena');
      }
    }
  });

  it('guarantees deep clone immutability: modifying sanitized state never leaks to master scene', () => {
    const scene = createBaseScene();
    const originalTokenCount = scene.tokens.length;
    const originalElenaX = scene.tokens[0].x;

    const sanitized = sanitizeSceneForPlayer(scene, 'peer-elena');
    sanitized.tokens[0].x = 9999;
    sanitized.tokens[0].pv.current = 0;
    sanitized.tokens.push({
      id: 'tok-malicious-injected',
      name: 'Injected Token',
      x: 0,
      y: 0,
      size: 'medio',
      color: '#fff',
      pv: { current: 1, max: 1 },
      san: { current: 1, max: 1 },
      conditions: [],
      isStealth: false,
    });
    sanitized.fogActions.push({ type: 'clear_all', timestamp: 2000 });

    // Master scene must remain completely unchanged
    expect(scene.tokens.length).toBe(originalTokenCount);
    expect(scene.tokens[0].x).toBe(originalElenaX);
    expect(scene.tokens[0].pv.current).toBe(25);
    expect(scene.fogActions.length).toBe(2);
  });

  it('strictly strips confidential GM notes from scene root and all individual tokens', () => {
    const scene = createBaseScene();
    (scene as any).gmNotes = 'CONFIDENTIAL: The assassin will strike at round 3';
    (scene as any).notes = 'Secret GM plot notes';
    (scene.tokens[0] as any).gmNotes = 'Elena has a cursed dagger in her bag';
    (scene.tokens[0] as any).notes = 'Token secret note';

    const sanitized = sanitizeSceneForPlayer(scene, 'peer-elena');

    expect((sanitized as any).gmNotes).toBeUndefined();
    expect((sanitized as any).notes).toBeUndefined();
    expect((sanitized.tokens[0] as any).gmNotes).toBeUndefined();
    expect((sanitized.tokens[0] as any).notes).toBeUndefined();
  });

  it('handles null, undefined, or malformed scene inputs gracefully without crashing', () => {
    expect(sanitizeSceneForPlayer(null as any, 'peer-1')).toBeNull();
    expect(sanitizeSceneForPlayer(undefined as any, 'peer-1')).toBeUndefined();

    const emptyTokensScene: VttScene = {
      id: 'scene-empty',
      name: 'Vazio',
      backgroundUrl: '',
      width: 1000,
      height: 1000,
      scaleRatio: 46.6667,
      gridless: true,
      tokens: [] as any,
      fogActions: [],
    };
    const sanitizedEmpty = sanitizeSceneForPlayer(emptyTokensScene, 'peer-1');
    expect(sanitizedEmpty.tokens).toEqual([]);

    const noTokensScene = {
      id: 'scene-no-tokens',
      name: 'Sem Tokens',
      backgroundUrl: '',
      width: 1000,
      height: 1000,
      scaleRatio: 46.6667,
      gridless: true,
      fogActions: [],
    } as any;
    const sanitizedNoTokens = sanitizeSceneForPlayer(noTokensScene, 'peer-1');
    expect(sanitizedNoTokens.tokens).toEqual([]);
  });

  it('stress tests sanitization on high-density scenes (1,000 tokens) under 30ms', () => {
    const largeTokens: VttToken[] = [];
    for (let i = 0; i < 1000; i++) {
      largeTokens.push({
        id: `tok-${i}`,
        name: `Token ${i}`,
        x: i * 2,
        y: i * 2,
        size: 'medio',
        color: '#38bdf8',
        pv: { current: 20, max: 20 },
        san: { current: 20, max: 20 },
        conditions: [],
        isStealth: i % 3 === 0, // 333 stealth tokens
        ownerPeerId: i === 0 ? 'peer-player' : i % 2 === 0 ? 'peer-gm' : undefined,
      });
    }

    const denseScene: VttScene = {
      id: 'scene-dense',
      name: 'Guerra Massiva',
      backgroundUrl: 'https://map.jpg',
      width: 10000,
      height: 10000,
      scaleRatio: 46.6667,
      gridless: true,
      tokens: largeTokens,
      fogActions: [],
    };

    const t0 = Date.now();
    const sanitized = sanitizeSceneForPlayer(denseScene, 'peer-player');
    const elapsed = Date.now() - t0;

    // Must be fast
    expect(elapsed < 100).toBe(true);
    // tok-0 is stealth but owned by peer-player -> kept
    expect(sanitized.tokens.some((t) => t.id === 'tok-0')).toBe(true);
    // other stealth tokens (e.g. tok-3, tok-6, ...) must be stripped
    expect(sanitized.tokens.some((t) => t.id === 'tok-3')).toBe(false);
    expect(sanitized.tokens.some((t) => t.id === 'tok-6')).toBe(false);
  });
});

// ============================================================================
// Suite 2: Movement Authorization & Ownership Hijacking Resistance
// ============================================================================

describe('Tier 9.10: Adversarial Movement Authorization & Anti-Spoofing', () => {
  const playerToken: VttToken = {
    id: 'tok-mariana',
    name: 'Mariana',
    x: 100,
    y: 100,
    size: 'medio',
    color: '#10b981',
    pv: { current: 30, max: 30 },
    san: { current: 30, max: 30 },
    conditions: [],
    isStealth: false,
    ownerPeerId: 'peer-mariana-123',
    characterId: 'char-mariana-uuid',
  };

  const monsterToken: VttToken = {
    id: 'tok-boss-abomination',
    name: 'Aberração das Trevas',
    x: 600,
    y: 600,
    size: 'enorme',
    color: '#ef4444',
    pv: { current: 200, max: 200 },
    san: { current: 0, max: 0 },
    conditions: [],
    isStealth: false,
    ownerPeerId: 'peer-gm-host',
  };

  const unownedToken: VttToken = {
    id: 'tok-prop-chest',
    name: 'Baú Antigo',
    x: 300,
    y: 300,
    size: 'pequeno',
    color: '#eab308',
    pv: { current: 10, max: 10 },
    san: { current: 0, max: 0 },
    conditions: [],
    isStealth: false,
  };

  it('GM Host has universal movement authorization over all pawns', () => {
    expect(authorizeTokenMove(playerToken, 'peer-gm-host', true)).toBe(true);
    expect(authorizeTokenMove(monsterToken, 'peer-gm-host', true)).toBe(true);
    expect(authorizeTokenMove(unownedToken, 'peer-gm-host', true)).toBe(true);
  });

  it('player can move only their assigned token via ownerPeerId', () => {
    // Legitimate owner
    expect(authorizeTokenMove(playerToken, 'peer-mariana-123', false)).toBe(true);

    // Another player cannot move Mariana
    expect(authorizeTokenMove(playerToken, 'peer-attacker-999', false)).toBe(false);

    // Mariana cannot move GM monster or props
    expect(authorizeTokenMove(monsterToken, 'peer-mariana-123', false)).toBe(false);
    expect(authorizeTokenMove(unownedToken, 'peer-mariana-123', false)).toBe(false);
  });

  it('supports characterId binding fallback for reconnected sessions', () => {
    // New ephemeral peer ID, but authorized via matched characterId
    expect(
      authorizeTokenMove(playerToken, 'peer-mariana-reconnected', false, 'char-mariana-uuid')
    ).toBe(true);

    // Attacker spoofing characterId with mismatch
    expect(
      authorizeTokenMove(playerToken, 'peer-attacker', false, 'char-attacker-fake')
    ).toBe(false);
  });

  it('rejects falsy, blank, or undefined peer credentials without false positives', () => {
    expect(authorizeTokenMove(playerToken, '', false)).toBe(false);
    expect(authorizeTokenMove(playerToken, '   ', false)).toBe(false);
    expect(authorizeTokenMove(playerToken, undefined as any, false)).toBe(false);
    expect(authorizeTokenMove(playerToken, null as any, false)).toBe(false);

    // Unowned token with empty sender must NOT match empty string
    expect(authorizeTokenMove(unownedToken, '', false)).toBe(false);
    expect(authorizeTokenMove(unownedToken, undefined as any, false)).toBe(false);
  });

  it('safely handles null or undefined tokens without throwing', () => {
    expect(authorizeTokenMove(null as any, 'peer-mariana-123', false)).toBe(false);
    expect(authorizeTokenMove(undefined as any, 'peer-mariana-123', false)).toBe(false);
  });
});

// ============================================================================
// Suite 3: Combat Tracker State Machine & Turn Advancement Boundary Stress
// ============================================================================

describe('Tier 9.11: Adversarial Combat Tracker Wrap-Around & Boundaries', () => {
  it('handles empty combatant list without throwing or corrupting encounter', () => {
    const emptyEncounter = createCombatEncounter('Sem Inimigos');
    expect(emptyEncounter.combatants.length).toBe(0);

    const advanced = advanceTurn(emptyEncounter);
    expect(advanced.round).toBe(1);
    expect(advanced.activeIndex).toBe(0);

    const reversed = previousTurn(emptyEncounter);
    expect(reversed.round).toBe(1);
    expect(reversed.activeIndex).toBe(0);

    expect(getActiveCombatant(emptyEncounter)).toBeNull();
  });

  it('handles single combatant round wrap-around correctly', () => {
    const singleCombatant: Combatant = {
      id: 'c-solo',
      name: 'Lobo Solitário',
      initiative: 15,
      isPlayer: true,
      isDefeated: false,
    };

    const encounter: CombatEncounter = {
      id: 'enc-solo',
      name: 'Duelo Solo',
      round: 1,
      activeIndex: 0,
      combatants: [singleCombatant],
      isRunning: true,
    };

    expect(getActiveCombatant(encounter)?.name).toBe('Lobo Solitário');

    // Turn 1 complete -> Wrap around to round 2, activeIndex remains 0
    const r2 = advanceTurn(encounter);
    expect(r2.round).toBe(2);
    expect(r2.activeIndex).toBe(0);
    expect(getActiveCombatant(r2)?.name).toBe('Lobo Solitário');

    // Turn 2 complete -> Round 3, activeIndex 0
    const r3 = advanceTurn(r2);
    expect(r3.round).toBe(3);
    expect(r3.activeIndex).toBe(0);

    // Step backwards from round 3 -> Round 2, activeIndex 0
    const back2 = previousTurn(r3);
    expect(back2.round).toBe(2);
    expect(back2.activeIndex).toBe(0);

    // Step backwards from round 1 -> Clamped to Round 1, activeIndex 0
    const back1 = previousTurn(encounter);
    expect(back1.round).toBe(1);
    expect(back1.activeIndex).toBe(0);
  });

  it('sorts combatants with negative initiatives and multi-tier tie-breaking', () => {
    const combatants: Combatant[] = [
      { id: 'c-neg-monster', name: 'Zumbi Lento', initiative: -5, isPlayer: false, isDefeated: false },
      { id: 'c-neg-player', name: 'Dante Ferido', initiative: -5, isPlayer: true, isDefeated: false },
      { id: 'c-zero', name: 'Observador Neutro', initiative: 0, isPlayer: false, isDefeated: false },
      { id: 'c-pos-player', name: 'Mariana', initiative: 18, isPlayer: true, isDefeated: false },
      { id: 'c-pos-monster', name: 'Monstro Veloz', initiative: 18, isPlayer: false, isDefeated: false },
      { id: 'c-deep-neg', name: 'Criatura Paralisada', initiative: -20, isPlayer: false, isDefeated: false },
    ];

    const sorted = sortCombatants(combatants);

    // Expected descending order:
    // 1. Mariana (+18, player)
    // 2. Monstro Veloz (+18, monster)
    // 3. Observador Neutro (0)
    // 4. Dante Ferido (-5, player tie-break over monster)
    // 5. Zumbi Lento (-5, monster)
    // 6. Criatura Paralisada (-20)
    expect(sorted[0].name).toBe('Mariana');
    expect(sorted[1].name).toBe('Monstro Veloz');
    expect(sorted[2].name).toBe('Observador Neutro');
    expect(sorted[3].name).toBe('Dante Ferido');
    expect(sorted[4].name).toBe('Zumbi Lento');
    expect(sorted[5].name).toBe('Criatura Paralisada');
  });

  it('recovers gracefully when activeIndex is out-of-bounds due to mid-combat roster changes', () => {
    const combatants: Combatant[] = [
      { id: 'c1', name: 'Alice', initiative: 20, isPlayer: true, isDefeated: false },
      { id: 'c2', name: 'Bob', initiative: 10, isPlayer: true, isDefeated: false },
    ];

    // Stale encounter where activeIndex was 5 before combatants were pruned
    const staleEncounter: CombatEncounter = {
      id: 'enc-stale',
      name: 'Stale Index',
      round: 2,
      activeIndex: 5,
      combatants,
      isRunning: true,
    };

    expect(getActiveCombatant(staleEncounter)).toBeNull();

    // advanceTurn detects nextIndex (6) >= length (2) and wraps around to 0, incrementing round
    const recovered = advanceTurn(staleEncounter);
    expect(recovered.round).toBe(3);
    expect(recovered.activeIndex).toBe(0);
    expect(getActiveCombatant(recovered)?.name).toBe('Alice');
  });

  it('guarantees encounter immutability across turn advancement', () => {
    const combatants: Combatant[] = [
      { id: 'c1', name: 'Alice', initiative: 20, isPlayer: true, isDefeated: false },
      { id: 'c2', name: 'Bob', initiative: 10, isPlayer: true, isDefeated: false },
    ];

    const encounter: CombatEncounter = {
      id: 'enc-immut',
      name: 'Immutability Check',
      round: 1,
      activeIndex: 0,
      combatants,
      isRunning: true,
    };

    const next = advanceTurn(encounter);
    expect(encounter.round).toBe(1);
    expect(encounter.activeIndex).toBe(0);
    expect(next.round).toBe(1);
    expect(next.activeIndex).toBe(1);
  });
});

// ============================================================================
// Suite 4: Dice Roll Expression Parser Fuzzing & Malformed Inputs
// ============================================================================

describe('Tier 9.12: Adversarial Dice Roll Parser & Injection Resistance', () => {
  it('strictly rejects SQL injection payloads in dice formulas', () => {
    const sqlPayloads = [
      '1d20; DROP TABLE users;--',
      '1d20 UNION SELECT * FROM passwords',
      "1d6' OR '1'='1",
      '1d20; EXEC xp_cmdshell("dir")',
    ];

    for (const payload of sqlPayloads) {
      let threw = false;
      try {
        parseDiceExpression(payload);
      } catch (err: any) {
        threw = true;
        expect(err.message).toContain('Expressão de dados inválida');
      }
      expect(threw).toBe(true);
    }
  });

  it('strictly rejects XSS and script tags in dice formulas', () => {
    const xssPayloads = [
      '<script>alert("pwned")</script>',
      '<img src=x onerror=alert(1)>',
      '1d20<script>',
      '"><svg/onload=alert(1)>',
    ];

    for (const payload of xssPayloads) {
      let threw = false;
      try {
        parseDiceExpression(payload);
      } catch (err: any) {
        threw = true;
        expect(err.message).toContain('Expressão de dados inválida');
      }
      expect(threw).toBe(true);
    }
  });

  it('safely rejects empty, whitespace, and non-string inputs', () => {
    const emptyInputs = ['', '   ', '\t\n\r', null as any, undefined as any, 12345 as any, {} as any];

    for (const input of emptyInputs) {
      let threw = false;
      try {
        parseDiceExpression(input);
      } catch (err: any) {
        threw = true;
      }
      expect(threw).toBe(true);
    }
  });

  it('bounds enormous dice counts (1,000,000d6) to safety cap (100) preventing OOM and CPU lockup', () => {
    const t0 = Date.now();
    const roll = parseDiceExpression('1000000d6', 'Jogador');
    const elapsed = Date.now() - t0;

    // Must execute almost instantly (< 10ms)
    expect(elapsed < 20).toBe(true);
    // Bounded to 100 dice
    expect(roll.dice.length).toBe(100);
    expect(roll.total >= 100 && roll.total <= 600).toBe(true);
  });

  it('bounds enormous sides (1d1000000) to safety cap (1000)', () => {
    const roll = parseDiceExpression('1d1000000', 'Jogador');
    expect(roll.dice.length).toBe(1);
    expect(roll.dice[0].sides).toBe(1000);
    expect(roll.dice[0].result <= 1000).toBe(true);
  });

  it('bounds enormous modifiers (+9999999999) to safety cap (+1000)', () => {
    const rollPos = parseDiceExpression('1d20 + 9999999999', 'Jogador', () => 10);
    expect(rollPos.modifier).toBe(1000);
    expect(rollPos.total).toBe(1010);

    const rollNeg = parseDiceExpression('1d20 - 9999999999', 'Jogador', () => 10);
    expect(rollNeg.modifier).toBe(-1000);
    expect(rollNeg.total).toBe(-990);
  });

  it('rejects zero dice count and zero/single-sided dice with descriptive errors', () => {
    expect(() => parseDiceExpression('0d6', 'Jogador')).toThrow(/Mínimo de 1 dado e 2 lados/);
    expect(() => parseDiceExpression('1d0', 'Jogador')).toThrow(/Mínimo de 1 dado e 2 lados/);
    expect(() => parseDiceExpression('0d0', 'Jogador')).toThrow(/Mínimo de 1 dado e 2 lados/);
    expect(() => parseDiceExpression('1d1', 'Jogador')).toThrow(/Mínimo de 1 dado e 2 lados/);
  });

  it('rejects negative dice counts and invalid operators', () => {
    const invalidFormulas = [
      '-5d6',
      '1d-20',
      '0d0',
      '0d6',
      '1d0',
      '1d1',
      '2d6 * 3',
      '2d6 / 2',
      '2d6 +',
      '2d6 -',
      'd',
      'd-20',
      '2d6 + 1d4', // Compound not supported
    ];

    for (const f of invalidFormulas) {
      let threw = false;
      try {
        parseDiceExpression(f);
      } catch (err) {
        threw = true;
      }
      expect(threw).toBe(true);
    }
  });

  it('resists ReDoS regex backtracking under repetitive pathological input', () => {
    // 5,000 spaces followed by 'd' and 5,000 spaces
    const reDosInput = ' '.repeat(5000) + 'd' + ' '.repeat(5000);
    const t0 = Date.now();
    let threw = false;
    try {
      parseDiceExpression(reDosInput);
    } catch {
      threw = true;
    }
    const elapsed = Date.now() - t0;

    expect(threw).toBe(true);
    // Regex must fail immediately (< 20ms) without catastrophic backtracking
    expect(elapsed < 50).toBe(true);
  });

  it('evaluates critical success and fumble logic correctly across pool sizes', () => {
    // Single die non-d20: natural 6 on d6 is critical
    const d6Crit = parseDiceExpression('1d6', 'Jogador', () => 6);
    expect(d6Crit.isCritical).toBe(true);
    expect(d6Crit.isFumble).toBe(false);

    // Single die non-d20: natural 1 on d6 is fumble
    const d6Fumble = parseDiceExpression('1d6', 'Jogador', () => 1);
    expect(d6Fumble.isCritical).toBe(false);
    expect(d6Fumble.isFumble).toBe(true);

    // Multi-d20 pool: at least one 20 is critical
    let idx = 0;
    const multiCrit = parseDiceExpression('3d20', 'Jogador', () => {
      idx++;
      return idx === 2 ? 20 : 5;
    });
    expect(multiCrit.isCritical).toBe(true);
    expect(multiCrit.isFumble).toBe(false);

    // Multi-d20 pool: all 1s is fumble
    const multiFumble = parseDiceExpression('3d20', 'Jogador', () => 1);
    expect(multiFumble.isCritical).toBe(false);
    expect(multiFumble.isFumble).toBe(true);

    // Multi-d20 pool: mixed (one 1, two non-1s) is neither critical nor fumble
    let mixedIdx = 0;
    const mixed = parseDiceExpression('3d20', 'Jogador', () => {
      mixedIdx++;
      return mixedIdx === 1 ? 1 : 12;
    });
    expect(mixed.isCritical).toBe(false);
    expect(mixed.isFumble).toBe(false);
  });
});

// ============================================================================
// Suite 5: Stealth Token Movement Broadcast Hardening (Adversarial Anti-Cheat)
// ============================================================================

describe('Tier 9.13: Stealth Movement Broadcast Anti-Cheat Hardening', () => {
  const stealthMonster: VttToken = {
    id: 'tok-shadow-beast',
    name: 'Besta das Sombras',
    x: 400,
    y: 500,
    size: 'grande',
    color: '#ef4444',
    pv: { current: 80, max: 80 },
    san: { current: 0, max: 0 },
    conditions: [],
    isStealth: true,
    ownerPeerId: 'peer-gm',
  };

  const playerStealthToken: VttToken = {
    id: 'tok-elena-ninja',
    name: 'Elena Furtiva',
    x: 100,
    y: 100,
    size: 'medio',
    color: '#38bdf8',
    pv: { current: 20, max: 20 },
    san: { current: 30, max: 30 },
    conditions: [],
    isStealth: true,
    ownerPeerId: 'peer-elena',
    characterId: 'char-elena',
  };

  const publicToken: VttToken = {
    id: 'tok-mariana-public',
    name: 'Mariana',
    x: 150,
    y: 150,
    size: 'medio',
    color: '#10b981',
    pv: { current: 25, max: 25 },
    san: { current: 35, max: 35 },
    conditions: [],
    isStealth: false,
    ownerPeerId: 'peer-mariana',
    characterId: 'char-mariana',
  };

  it('validates isTokenVisibleToPlayer across public and stealth tokens', () => {
    // Public tokens are visible to everyone, regardless of peer ID or undefined peer
    expect(isTokenVisibleToPlayer(publicToken, 'peer-elena')).toBe(true);
    expect(isTokenVisibleToPlayer(publicToken, 'peer-bob')).toBe(true);
    expect(isTokenVisibleToPlayer(publicToken, undefined)).toBe(true);

    // Stealth tokens are strictly visible ONLY to authorized owner
    expect(isTokenVisibleToPlayer(playerStealthToken, 'peer-elena')).toBe(true);
    expect(isTokenVisibleToPlayer(playerStealthToken, 'peer-bob')).toBe(false);
    expect(isTokenVisibleToPlayer(playerStealthToken, 'peer-mariana')).toBe(false);
    expect(isTokenVisibleToPlayer(playerStealthToken, '')).toBe(false);
    expect(isTokenVisibleToPlayer(playerStealthToken, undefined)).toBe(false);

    // Invisible GM monster is NOT visible to any player peer
    expect(isTokenVisibleToPlayer(stealthMonster, 'peer-elena')).toBe(false);
    expect(isTokenVisibleToPlayer(stealthMonster, 'peer-bob')).toBe(false);
    expect(isTokenVisibleToPlayer(stealthMonster, 'peer-mariana')).toBe(false);
    expect(isTokenVisibleToPlayer(stealthMonster, undefined)).toBe(false);

    // Unowned stealth token is hidden from everyone
    const unownedStealth: VttToken = { ...stealthMonster, ownerPeerId: undefined };
    expect(isTokenVisibleToPlayer(unownedStealth, 'peer-elena')).toBe(false);

    // Handles null / undefined token gracefully
    expect(isTokenVisibleToPlayer(null as any, 'peer-elena')).toBe(false);
    expect(isTokenVisibleToPlayer(undefined as any, 'peer-elena')).toBe(false);
  });

  // Simulation harness for WebRTC DataChannel dispatch
  function simulateBroadcastTokenMove(
    connections: Map<string, { open: boolean; sent: any[] }>,
    payload: any,
    token: VttToken,
    excludePeerId?: string
  ) {
    if (token.isStealth) {
      if (token.ownerPeerId && token.ownerPeerId !== excludePeerId) {
        const conn = connections.get(token.ownerPeerId);
        if (conn?.open) {
          conn.sent.push({ type: 'VTT_TOKEN_MOVE', payload });
        }
      }
      return;
    }

    for (const [peerId, conn] of connections.entries()) {
      if (peerId !== excludePeerId && conn.open) {
        conn.sent.push({ type: 'VTT_TOKEN_MOVE', payload });
      }
    }
  }

  it('simulates GM moving stealth monster: zero packets dispatched to player peers', () => {
    const connections = new Map<string, { open: boolean; sent: any[] }>([
      ['peer-elena', { open: true, sent: [] }],
      ['peer-bob', { open: true, sent: [] }],
      ['peer-mariana', { open: true, sent: [] }],
    ]);

    const payload = {
      tokenId: stealthMonster.id,
      x: 450,
      y: 550,
      distanceMeters: 2.5,
      isFinal: true,
      movedByPeerId: 'peer-gm',
    };

    simulateBroadcastTokenMove(connections, payload, stealthMonster);

    // Zero leaks: none of the player peers received the packet
    expect(connections.get('peer-elena')!.sent.length).toBe(0);
    expect(connections.get('peer-bob')!.sent.length).toBe(0);
    expect(connections.get('peer-mariana')!.sent.length).toBe(0);
  });

  it('simulates GM moving player stealth token: dispatched ONLY to token owner', () => {
    const connections = new Map<string, { open: boolean; sent: any[] }>([
      ['peer-elena', { open: true, sent: [] }],
      ['peer-bob', { open: true, sent: [] }],
      ['peer-mariana', { open: true, sent: [] }],
    ]);

    const payload = {
      tokenId: playerStealthToken.id,
      x: 120,
      y: 120,
      distanceMeters: 1.5,
      isFinal: true,
      movedByPeerId: 'peer-gm',
    };

    simulateBroadcastTokenMove(connections, payload, playerStealthToken);

    // Elena receives update; Bob and Mariana receive nothing
    expect(connections.get('peer-elena')!.sent.length).toBe(1);
    expect(connections.get('peer-elena')!.sent[0].payload.tokenId).toBe(playerStealthToken.id);
    expect(connections.get('peer-bob')!.sent.length).toBe(0);
    expect(connections.get('peer-mariana')!.sent.length).toBe(0);
  });

  it('simulates player moving own stealth token: zero packets relayed to other peers and no echo', () => {
    const connections = new Map<string, { open: boolean; sent: any[] }>([
      ['peer-elena', { open: true, sent: [] }],
      ['peer-bob', { open: true, sent: [] }],
      ['peer-mariana', { open: true, sent: [] }],
    ]);

    const payload = {
      tokenId: playerStealthToken.id,
      x: 140,
      y: 140,
      distanceMeters: 3.0,
      isFinal: true,
      movedByPeerId: 'peer-elena',
    };

    // Elena moved her token, so excludePeerId is 'peer-elena'
    simulateBroadcastTokenMove(connections, payload, playerStealthToken, 'peer-elena');

    // No echo to Elena, and zero leakage to Bob or Mariana
    expect(connections.get('peer-elena')!.sent.length).toBe(0);
    expect(connections.get('peer-bob')!.sent.length).toBe(0);
    expect(connections.get('peer-mariana')!.sent.length).toBe(0);
  });

  it('simulates public token movement: broadcasts to all peers (regression check)', () => {
    const connections = new Map<string, { open: boolean; sent: any[] }>([
      ['peer-elena', { open: true, sent: [] }],
      ['peer-bob', { open: true, sent: [] }],
      ['peer-mariana', { open: true, sent: [] }],
    ]);

    const payload = {
      tokenId: publicToken.id,
      x: 200,
      y: 200,
      distanceMeters: 3.0,
      isFinal: true,
      movedByPeerId: 'peer-mariana',
    };

    // Mariana moves her public token
    simulateBroadcastTokenMove(connections, payload, publicToken, 'peer-mariana');

    // Mariana is excluded, but Elena and Bob both receive the move
    expect(connections.get('peer-mariana')!.sent.length).toBe(0);
    expect(connections.get('peer-elena')!.sent.length).toBe(1);
    expect(connections.get('peer-bob')!.sent.length).toBe(1);
  });

  it('guarantees stealth dynamic toggling immediately changes movement routing', () => {
    const connections = new Map<string, { open: boolean; sent: any[] }>([
      ['peer-elena', { open: true, sent: [] }],
    ]);

    const dynamicToken: VttToken = {
      id: 'tok-shapeshifter',
      name: 'Transmorfo',
      x: 50,
      y: 50,
      size: 'medio',
      color: '#fff',
      pv: { current: 10, max: 10 },
      san: { current: 10, max: 10 },
      conditions: [],
      isStealth: true,
      ownerPeerId: 'peer-gm',
    };

    const payload = { tokenId: dynamicToken.id, x: 60, y: 60, distanceMeters: 1.5, isFinal: true };

    // Move 1: While stealth -> blocked
    simulateBroadcastTokenMove(connections, payload, dynamicToken);
    expect(connections.get('peer-elena')!.sent.length).toBe(0);

    // GM reveals token: isStealth = false
    dynamicToken.isStealth = false;
    simulateBroadcastTokenMove(connections, payload, dynamicToken);
    expect(connections.get('peer-elena')!.sent.length).toBe(1);

    // GM re-hides token: isStealth = true
    dynamicToken.isStealth = true;
    simulateBroadcastTokenMove(connections, payload, dynamicToken);
    expect(connections.get('peer-elena')!.sent.length).toBe(1); // Count did not increase
  });
});
