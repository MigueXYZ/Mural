// File: src/lib/services/p2p/ordoP2PService.svelte.ts

import { Peer, type DataConnection } from 'peerjs';
import type {
  OrdoCharacter,
  OrdoDiceRollEvent,
  OrdoAudioSyncPayload,
  OrdoP2PMessage,
} from '../../types/ordo';
import { audioEngine } from '../audio/audioEngine.svelte';
import { campaignStore } from '../../stores/campaignStore.svelte';

class OrdoP2PService {
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();

  // Reactive State (Svelte 5 Runes)
  isOpen = $state<boolean>(false);
  isConnecting = $state<boolean>(false);
  isModalOpen = $state<boolean>(false);
  roomCode = $state<string>('');
  characters = $state<OrdoCharacter[]>([]);
  recentRolls = $state<OrdoDiceRollEvent[]>([]);
  lastError = $state<string | null>(null);
  connectedCount = $state<number>(0);
  isAudioSyncActive = $state<boolean>(true);

  constructor() {
    // Generate an initial random 6-character room code if none exists
    this.roomCode = this.generateRoomCode();
    
    // Automatically broadcast audio sync on audioEngine changes
    audioEngine.onAudioSyncCallback = () => {
      this.broadcastAudioSync();
    };
  }

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.lastError = null;
  }

  generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'ORD-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  get fullPeerId(): string {
    return `mural-ordo-${this.roomCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }

  /**
   * Starts the P2P Host Room using WebRTC & PeerJS.
   */
  async createRoom(customCode?: string) {
    if (this.peer) {
      this.closeRoom();
    }

    if (customCode && customCode.trim()) {
      this.roomCode = customCode.trim().toUpperCase();
    }

    this.isConnecting = true;
    this.lastError = null;

    try {
      const targetId = this.fullPeerId;
      console.log(`[OrdoP2P] Starting host room with Peer ID: ${targetId}`);

      this.peer = new Peer(targetId, {
        debug: 1,
      });

      this.peer.on('open', (id) => {
        console.log(`[OrdoP2P] Room opened successfully with ID: ${id}`);
        this.isOpen = true;
        this.isConnecting = false;
        this.lastError = null;
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('[OrdoP2P] PeerJS error:', err);
        this.lastError = err.message || 'Erro na conexão P2P';
        this.isConnecting = false;
      });

      this.peer.on('close', () => {
        this.isOpen = false;
        this.isConnecting = false;
        this.connections.clear();
        this.connectedCount = 0;
      });
    } catch (err: any) {
      console.error('[OrdoP2P] Failed to initialize peer:', err);
      this.lastError = err?.message || 'Falha ao criar sala P2P';
      this.isConnecting = false;
    }
  }

  /**
   * Closes the active P2P room and notifies connected peers.
   */
  closeRoom() {
    if (this.peer) {
      this.broadcastMessage('LEAVE', { message: 'Sala encerrada pelo Mestre.' });
      this.peer.destroy();
      this.peer = null;
    }
    this.connections.clear();
    this.isOpen = false;
    this.isConnecting = false;
    this.connectedCount = 0;
  }

  /**
   * Handles new incoming connection from an Ordo player.
   */
  private handleIncomingConnection(conn: DataConnection) {
    console.log(`[OrdoP2P] Incoming player connection from peer: ${conn.peer}`);

    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.connectedCount = this.connections.size;
      console.log(`[OrdoP2P] Player connection ready. Total connected: ${this.connectedCount}`);

      // Send initial welcome & current soundtrack sync
      if (this.isAudioSyncActive) {
        this.sendAudioSyncToPeer(conn);
      }
    });

    conn.on('data', (raw: any) => {
      this.handleIncomingMessage(conn.peer, raw);
    });

    conn.on('close', () => {
      console.log(`[OrdoP2P] Connection closed for peer: ${conn.peer}`);
      this.connections.delete(conn.peer);
      this.connectedCount = this.connections.size;
      // Mark character as disconnected
      this.characters = this.characters.map((c) =>
        c.peerId === conn.peer ? { ...c, connected: false } : c
      );
    });

    conn.on('error', (err) => {
      console.warn(`[OrdoP2P] Connection error on peer ${conn.peer}:`, err);
      this.connections.delete(conn.peer);
      this.connectedCount = this.connections.size;
    });
  }

  /**
   * Parses and reacts to incoming messages from Ordo players.
   */
  private handleIncomingMessage(peerId: string, message: OrdoP2PMessage) {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'JOIN':
      case 'CHARACTER_UPDATE': {
        const charData = message.payload as OrdoCharacter;
        if (!charData || !charData.name) return;

        const normalizedChar: OrdoCharacter = {
          ...charData,
          id: charData.id || `char-${Date.now()}`,
          peerId,
          connected: true,
          lastUpdated: Date.now(),
          attributes: charData.attributes || { agi: 1, for: 1, int: 1, pre: 1, vig: 1 },
          skills: charData.skills || {},
          pv: charData.pv || { current: 20, max: 20 },
          san: charData.san || { current: 20, max: 20 },
          pe: charData.pe || { current: 2, max: 2 },
        };

        const existingIdx = this.characters.findIndex(
          (c) => c.id === normalizedChar.id || c.peerId === peerId
        );

        if (existingIdx >= 0) {
          this.characters[existingIdx] = normalizedChar;
          this.characters = [...this.characters];
        } else {
          this.characters = [...this.characters, normalizedChar];
        }
        break;
      }

      case 'DICE_ROLL': {
        const rawRoll = (message.payload || {}) as any;

        // Find matched character from connected peers if characterName is not supplied or is placeholder
        const matchedChar = this.characters.find(
          (c) => c.peerId === peerId || (rawRoll.characterId && c.id === rawRoll.characterId)
        );

        let charName = '';
        if (typeof rawRoll.characterName === 'string' && rawRoll.characterName.trim() && rawRoll.characterName !== '0') {
          charName = rawRoll.characterName.trim();
        } else if (typeof rawRoll.nomePersonagem === 'string' && rawRoll.nomePersonagem.trim() && rawRoll.nomePersonagem !== '0') {
          charName = rawRoll.nomePersonagem.trim();
        } else if (typeof rawRoll.character === 'string' && rawRoll.character.trim() && rawRoll.character !== '0') {
          charName = rawRoll.character.trim();
        } else if (typeof rawRoll.nome === 'string' && rawRoll.nome.trim() && rawRoll.nome !== '0') {
          charName = rawRoll.nome.trim();
        } else if (matchedChar?.name) {
          charName = matchedChar.name;
        } else if (message.senderName && message.senderName !== 'Jogador' && message.senderName !== '0') {
          charName = message.senderName;
        } else {
          charName = 'Personagem';
        }

        let playerName = '';
        if (typeof rawRoll.playerName === 'string' && rawRoll.playerName.trim() && rawRoll.playerName !== '0') {
          playerName = rawRoll.playerName.trim();
        } else if (matchedChar?.playerName) {
          playerName = matchedChar.playerName;
        } else if (message.senderName && message.senderName !== '0' && message.senderName !== charName) {
          playerName = message.senderName;
        }

        const diceResults = Array.isArray(rawRoll.diceResults)
          ? rawRoll.diceResults
          : Array.isArray(rawRoll.dices)
          ? rawRoll.dices
          : Array.isArray(rawRoll.dados)
          ? rawRoll.dados
          : [rawRoll.total ?? 0];

        const eventWithId: OrdoDiceRollEvent = {
          ...rawRoll,
          id: rawRoll.id || `roll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          characterId: rawRoll.characterId || matchedChar?.id || peerId,
          characterName: charName,
          playerName: playerName || '',
          rollType: rawRoll.rollType || 'pericia',
          label: rawRoll.label || rawRoll.pericia || rawRoll.skill || rawRoll.nome || 'Rolagem',
          diceFormula: rawRoll.diceFormula || rawRoll.formula || '',
          diceResults,
          keptValue: rawRoll.keptValue ?? Math.max(...diceResults),
          total: rawRoll.total ?? Math.max(...diceResults),
          isCritical: Boolean(rawRoll.isCritical || rawRoll.critico || diceResults.includes(20)),
          isFumble: Boolean(rawRoll.isFumble || rawRoll.desastre || (diceResults.length > 0 && diceResults.every((d: number) => d === 1))),
          timestamp: rawRoll.timestamp || message.timestamp || Date.now(),
        };

        this.recentRolls = [eventWithId, ...this.recentRolls.slice(0, 49)];
        break;
      }

      case 'PING': {
        const conn = this.connections.get(peerId);
        if (conn && conn.open) {
          conn.send({
            type: 'PONG',
            senderId: 'mural-gm',
            senderName: 'Mural GM Screen',
            timestamp: Date.now(),
            payload: {},
          });
        }
        break;
      }
    }
  }

  /**
   * Broadcasts a message to all connected Ordo players.
   */
  broadcastMessage(type: string, payload: any) {
    const envelope: OrdoP2PMessage = {
      type: type as any,
      senderId: 'mural-gm',
      senderName: 'Mestre (Mural)',
      timestamp: Date.now(),
      payload,
    };

    for (const [peerId, conn] of this.connections.entries()) {
      if (conn.open) {
        try {
          conn.send(envelope);
        } catch (err) {
          console.warn(`[OrdoP2P] Failed to send message to ${peerId}:`, err);
        }
      }
    }
  }

  /**
   * Broadcasts current soundtrack playback state to all Ordo players.
   */
  broadcastAudioSync() {
    if (!this.isOpen || !this.isAudioSyncActive) return;

    const track = audioEngine.currentMusicTrack;
    const payload: OrdoAudioSyncPayload = {
      trackId: track?.id || '',
      title: track?.title || '',
      artist: track?.artist || '',
      src: track?.src || '',
      url: track?.src || '',
      isPlaying: audioEngine.isPlayingMusic,
      currentTime: audioEngine.currentTime,
      duration: audioEngine.duration,
      volumeMultiplier: audioEngine.masterVolume,
      timestamp: Date.now(),
    };

    this.broadcastMessage('AUDIO_SYNC', payload);
  }

  private sendAudioSyncToPeer(conn: DataConnection) {
    const track = audioEngine.currentMusicTrack;
    const payload: OrdoAudioSyncPayload = {
      trackId: track?.id || '',
      title: track?.title || '',
      artist: track?.artist || '',
      src: track?.src || '',
      url: track?.src || '',
      isPlaying: audioEngine.isPlayingMusic,
      currentTime: audioEngine.currentTime,
      duration: audioEngine.duration,
      volumeMultiplier: audioEngine.masterVolume,
      timestamp: Date.now(),
    };

    conn.send({
      type: 'AUDIO_SYNC',
      senderId: 'mural-gm',
      senderName: 'Mestre (Mural)',
      timestamp: Date.now(),
      payload,
    });
  }

  /**
   * Creates or links a Mural Canvas Node from a connected Ordo player character.
   */
  createCanvasNodeFromCharacter(char: OrdoCharacter) {
    const subtitle = `${char.class ? char.class.toUpperCase() : 'JOGADOR'}${char.nex ? ` · NEX ${char.nex}%` : ''}`;
    const desc = `**Jogador:** ${char.playerName}\n**Origem:** ${char.origin || 'Não informada'}\n\n` +
      `**Atributos:** AGI ${char.attributes.agi} | FOR ${char.attributes.for} | INT ${char.attributes.int} | PRE ${char.attributes.pre} | VIG ${char.attributes.vig}\n` +
      `**Recursos:** PV: ${char.pv.current}/${char.pv.max} | SAN: ${char.san.current}/${char.san.max} | PE: ${char.pe.current}/${char.pe.max}\n` +
      (char.defense ? `**Defesa:** ${char.defense}\n` : '');

    const nodeId = `ordo-${char.id}`;
    
    // Add node via campaignStore
    campaignStore.recordSnapshot();
    const newNode = {
      id: nodeId,
      type: 'entityNode' as const,
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 150 },
      data: {
        id: nodeId,
        title: char.name,
        subtitle,
        description: desc,
        type: 'npc' as const,
        category: 'npc' as const,
        color: char.color || '#38bdf8',
        colorTheme: char.color || '#38bdf8',
        icon: 'user',
        tags: ['Jogador', char.class || 'Personagem', `NEX ${char.nex || 5}%`].filter(Boolean),
      },
    };

    campaignStore.nodes.update((list) => [...list, newNode]);
    campaignStore.markDirty();
  }

  clearRolls() {
    this.recentRolls = [];
  }
}

export const ordoP2P = new OrdoP2PService();
