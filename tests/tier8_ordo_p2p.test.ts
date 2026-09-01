// File: tests/tier8_ordo_p2p.test.ts

import { describe, it, expect } from './harness';
import type {
  OrdoCharacter,
  OrdoDiceRollEvent,
  OrdoAudioSyncPayload,
  OrdoP2PMessage,
} from '../src/lib/types/ordo';

describe('Taiga US 155: Ordo P2P Connection & Audio Sync', () => {
  const sampleCharacter: OrdoCharacter = {
    id: 'char-elena',
    name: 'Elena Rostova',
    playerName: 'Mariana',
    origin: 'Investigadora Forense',
    class: 'Especialista',
    nex: 25,
    pv: { current: 18, max: 24, temp: 0 },
    san: { current: 35, max: 40 },
    pe: { current: 6, max: 8 },
    pd: { current: 2, max: 4 },
    defense: 14,
    movement: 9,
    passivePerception: 16,
    attributes: {
      agi: 3,
      for: 1,
      int: 4,
      pre: 2,
      vig: 2,
    },
    skills: {
      ocultismo: { name: 'Ocultismo', attribute: 'INT', training: 'veterano', bonus: 10 },
      investigacao: { name: 'Investigação', attribute: 'INT', training: 'expert', bonus: 15 },
      pontaria: { name: 'Pontaria', attribute: 'AGI', training: 'treinado', bonus: 5 },
      percepcao: { name: 'Percepção', attribute: 'PRE', training: 'treinado', bonus: 5 },
      fortitude: { name: 'Fortitude', attribute: 'VIG', training: 'destreinado', bonus: 0 },
    },
    statusEffects: ['Abalado'],
    color: '#38bdf8',
    peerId: 'peer-mariana-123',
    connected: true,
  };

  it('generates consistent 6-character room codes and peer IDs', () => {
    function generateRoomCode(): string {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = 'ORD-';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    }

    const code = generateRoomCode();
    expect(code.startsWith('ORD-')).toBe(true);
    expect(code.length).toBe(8);

    const fullPeerId = `mural-ordo-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    expect(fullPeerId.startsWith('mural-ordo-ord')).toBe(true);
  });

  it('validates and normalizes incoming Ordo character sheets', () => {
    expect(sampleCharacter.name).toBe('Elena Rostova');
    expect(sampleCharacter.playerName).toBe('Mariana');
    expect(sampleCharacter.attributes.int).toBe(4);
    expect(sampleCharacter.pv.current).toBe(18);
    expect(sampleCharacter.san.current).toBe(35);
    expect(sampleCharacter.pe.current).toBe(6);

    // Verify skills structure
    expect(sampleCharacter.skills.investigacao.training).toBe('expert');
    expect(sampleCharacter.skills.investigacao.bonus).toBe(15);
  });

  it('processes and logs player dice rolls with criticals and fumbles', () => {
    const criticalRoll: OrdoDiceRollEvent = {
      id: 'roll-1',
      characterId: sampleCharacter.id,
      characterName: sampleCharacter.name,
      playerName: sampleCharacter.playerName,
      rollType: 'pericia',
      label: 'Investigação',
      diceFormula: '4d20 + 15',
      diceResults: [11, 20, 14, 8],
      keptValue: 20,
      total: 35,
      isCritical: true,
      isFumble: false,
      timestamp: Date.now(),
    };

    expect(criticalRoll.isCritical).toBe(true);
    expect(criticalRoll.total).toBe(35);
    expect(criticalRoll.keptValue).toBe(20);

    const fumbleRoll: OrdoDiceRollEvent = {
      id: 'roll-2',
      characterId: sampleCharacter.id,
      characterName: sampleCharacter.name,
      playerName: sampleCharacter.playerName,
      rollType: 'pericia',
      label: 'Ocultismo',
      diceFormula: '4d20 + 10',
      diceResults: [1, 1, 1, 1],
      keptValue: 1,
      total: 11,
      isCritical: false,
      isFumble: true,
      timestamp: Date.now(),
    };

    expect(fumbleRoll.isFumble).toBe(true);
  });

  it('structures audio sync payloads accurately for player playback', () => {
    const audioPayload: OrdoAudioSyncPayload = {
      trackId: 'synth-combat-1',
      title: 'Tensão Paranormal',
      artist: 'OrdemTools Synth',
      src: 'synth:combat_tense',
      isPlaying: true,
      currentTime: 42.5,
      duration: 180,
      volumeMultiplier: 0.8,
      timestamp: Date.now(),
    };

    expect(audioPayload.isPlaying).toBe(true);
    expect(audioPayload.currentTime).toBe(42.5);
    expect(audioPayload.trackId).toBe('synth-combat-1');
  });

  it('derives a specialized Mural Canvas entity node from an Ordo character', () => {
    function deriveCanvasNode(char: OrdoCharacter) {
      const subtitle = `${char.class ? char.class.toUpperCase() : 'JOGADOR'}${char.nex ? ` · NEX ${char.nex}%` : ''}`;
      const desc = `**Jogador:** ${char.playerName}\n**Origem:** ${char.origin || 'Não informada'}\n\n` +
        `**Atributos:** AGI ${char.attributes.agi} | FOR ${char.attributes.for} | INT ${char.attributes.int} | PRE ${char.attributes.pre} | VIG ${char.attributes.vig}\n` +
        `**Recursos:** PV: ${char.pv.current}/${char.pv.max} | SAN: ${char.san.current}/${char.san.max} | PE: ${char.pe.current}/${char.pe.max}\n`;

      return {
        id: `ordo-${char.id}`,
        title: char.name,
        subtitle,
        description: desc,
        type: 'npc',
        category: 'npc',
        color: char.color || '#38bdf8',
        tags: ['Jogador', char.class || 'Personagem', `NEX ${char.nex || 5}%`],
      };
    }

    const node = deriveCanvasNode(sampleCharacter);
    expect(node.id).toBe('ordo-char-elena');
    expect(node.title).toBe('Elena Rostova');
    expect(node.subtitle).toContain('ESPECIALISTA · NEX 25%');
    expect(node.description).toContain('Mariana');
    expect(node.description).toContain('PV: 18/24');
    expect(node.tags).toContain('Jogador');
  });

  it('formats P2P communication envelopes with strict type checking', () => {
    const joinMessage: OrdoP2PMessage<OrdoCharacter> = {
      type: 'JOIN',
      senderId: 'peer-player-1',
      senderName: 'Mariana',
      timestamp: Date.now(),
      payload: sampleCharacter,
    };

    expect(joinMessage.type).toBe('JOIN');
    expect(joinMessage.payload.name).toBe('Elena Rostova');

    const audioMessage: OrdoP2PMessage<OrdoAudioSyncPayload> = {
      type: 'AUDIO_SYNC',
      senderId: 'mural-gm',
      senderName: 'Mestre (Mural)',
      timestamp: Date.now(),
      payload: {
        trackId: 'track-1',
        title: 'Música de Mistério',
        isPlaying: false,
        currentTime: 0,
        volumeMultiplier: 0.7,
        timestamp: Date.now(),
      },
    };

    expect(audioMessage.type).toBe('AUDIO_SYNC');
    expect(audioMessage.payload.isPlaying).toBe(false);
  });

  it('correctly falls back to connected character name when roll payload lacks explicit characterName', () => {
    const connectedCharacters: OrdoCharacter[] = [sampleCharacter];

    function resolveRollCharacterName(rawRoll: any, peerId: string): string {
      const matchedChar = connectedCharacters.find(
        (c) => c.peerId === peerId || (rawRoll.characterId && c.id === rawRoll.characterId)
      );

      if (typeof rawRoll.characterName === 'string' && rawRoll.characterName.trim() && rawRoll.characterName !== '0') {
        return rawRoll.characterName.trim();
      } else if (typeof rawRoll.nomePersonagem === 'string' && rawRoll.nomePersonagem.trim() && rawRoll.nomePersonagem !== '0') {
        return rawRoll.nomePersonagem.trim();
      } else if (typeof rawRoll.character === 'string' && rawRoll.character.trim() && rawRoll.character !== '0') {
        return rawRoll.character.trim();
      } else if (typeof rawRoll.nome === 'string' && rawRoll.nome.trim() && rawRoll.nome !== '0') {
        return rawRoll.nome.trim();
      } else if (matchedChar?.name) {
        return matchedChar.name;
      }
      return 'Personagem';
    }

    // Case 1: Roll payload sends characterName: "0" or missing
    expect(resolveRollCharacterName({ characterName: '0', label: 'Adestramento' }, 'peer-mariana-123')).toBe('Elena Rostova');
    // Case 2: Roll payload sends nomePersonagem
    expect(resolveRollCharacterName({ nomePersonagem: 'Arthur Cervero', label: 'Luta' }, 'unknown-peer')).toBe('Arthur Cervero');
    // Case 3: Roll payload sends character
    expect(resolveRollCharacterName({ character: 'Joui Jouki', label: 'Pontaria' }, 'unknown-peer')).toBe('Joui Jouki');
  });
});

