/**
 * src/lib/services/vtt/vttP2PService.svelte.ts
 * 
 * Local-First P2P WebRTC Synchronization Service for Mural Virtual Tabletop (VTT).
 * Manages PeerJS DataChannels for Desktop GM Host and Browser Player Client with
 * Svelte 5 Runes ($state, $derived).
 * 
 * Implements Requirements R2 (Player Client) and R3 (WebRTC P2P Sync Engine).
 */

import { Peer, type DataConnection } from 'peerjs';
import type {
  VttScene,
  VttToken,
  FogAction,
  CombatEncounter,
  Combatant,
  VttPing,
  DiceRollResult,
  VTTEnvelope,
  VTTMessageType,
  VttTokenMovePayload,
  VttFogUpdatePayload,
} from '../../types/vtt';
import {
  generateRoomCode,
  normalizeRoomCode,
  roomCodeToHostPeerId,
  sanitizeSceneForPlayer,
  authorizeTokenMove,
  isTokenVisibleToPlayer,
} from './vttProtocol';

export interface ConnectedPeerInfo {
  peerId: string;
  playerName: string;
  characterName?: string;
  color?: string;
}

export class VttP2PService {
  // Internal networking primitives
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>(); // Host mode: peerId -> conn
  private hostConnection: DataConnection | null = null;    // Client mode: conn to GM
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  // --- Svelte 5 Rune State ---
  isConnected = $state<boolean>(false);
  isHost = $state<boolean>(false);
  isConnecting = $state<boolean>(false);
  roomCode = $state<string>('');
  localPeerId = $state<string>('');
  lastError = $state<string | null>(null);
  latencyMs = $state<number>(0);

  // Tactical state
  connectedPeers = $state<ConnectedPeerInfo[]>([]);
  activeScene = $state<VttScene | null>(null);
  encounter = $state<CombatEncounter | null>(null);
  recentPings = $state<VttPing[]>([]);
  diceFeed = $state<DiceRollResult[]>([]);

  // Player identity
  assignedTokenId = $state<string | null>(null);
  playerName = $state<string>('Jogador');
  playerColor = $state<string>('#38bdf8');

  // --- Svelte 5 Derived Runes ---
  isGm = $derived(this.isHost);
  connectedCount = $derived(this.connectedPeers.length);
  activeCombatant = $derived(
    this.encounter && this.encounter.combatants.length > 0
      ? this.encounter.combatants[this.encounter.activeIndex] ?? null
      : null
  );

  constructor() {
    this.roomCode = generateRoomCode();
  }

  // =========================================================================
  // GM Host Routines
  // =========================================================================

  async createRoom(customCode?: string): Promise<string> {
    this.destroy();

    const code = customCode ? (normalizeRoomCode(customCode) || generateRoomCode()) : generateRoomCode();
    this.roomCode = code;
    this.isHost = true;
    this.isConnecting = true;
    this.lastError = null;

    const hostPeerId = roomCodeToHostPeerId(code);
    console.log(`[VttP2P] Initializing GM Host room with Peer ID: ${hostPeerId}`);

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(hostPeerId, { debug: 1 });

        this.peer.on('open', (id) => {
          console.log(`[VttP2P] GM Room opened successfully: ${id}`);
          this.localPeerId = id;
          this.isConnected = true;
          this.isConnecting = false;
          this.lastError = null;
          this.startHeartbeat();
          resolve(this.roomCode);
        });

        this.peer.on('connection', (conn) => {
          this.handleHostIncomingConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          console.error('[VttP2P] Host PeerJS error:', err);
          if (err?.type === 'unavailable-id') {
            this.lastError = 'Código de sala já em uso. Tente outro código.';
          } else {
            this.lastError = err?.message || 'Erro na conexão P2P do Mestre.';
          }
          this.isConnecting = false;
          reject(err);
        });

        this.peer.on('close', () => {
          this.destroy();
        });
      } catch (err: any) {
        this.lastError = err?.message || 'Falha ao instanciar Host Peer.';
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  private handleHostIncomingConnection(conn: DataConnection) {
    console.log(`[VttP2P] Player incoming connection: ${conn.peer}`);

    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      console.log(`[VttP2P] Player connection ready: ${conn.peer}`);
    });

    conn.on('data', (raw: unknown) => {
      this.handleHostIncomingMessage(conn.peer, raw as VTTEnvelope);
    });

    conn.on('close', () => {
      console.log(`[VttP2P] Player disconnected: ${conn.peer}`);
      this.connections.delete(conn.peer);
      this.connectedPeers = this.connectedPeers.filter((p) => p.peerId !== conn.peer);
    });

    conn.on('error', (err) => {
      console.warn(`[VttP2P] Player connection error: ${conn.peer}`, err);
      this.connections.delete(conn.peer);
      this.connectedPeers = this.connectedPeers.filter((p) => p.peerId !== conn.peer);
    });
  }

  // =========================================================================
  // Browser Player Client Routines
  // =========================================================================

  async joinRoom(
    roomCode: string,
    playerName: string,
    characterInfo?: { characterId?: string; characterName?: string; color?: string }
  ): Promise<void> {
    this.destroy();

    const cleanCode = normalizeRoomCode(roomCode);
    if (!cleanCode) {
      this.lastError = 'Código de sala inválido. Formato esperado: ORD-XXXX';
      throw new Error(this.lastError);
    }

    this.roomCode = cleanCode;
    this.playerName = playerName.trim() || 'Jogador';
    if (characterInfo?.color) this.playerColor = characterInfo.color;
    this.isHost = false;
    this.isConnecting = true;
    this.lastError = null;

    const targetHostPeerId = roomCodeToHostPeerId(cleanCode);
    console.log(`[VttP2P] Connecting to GM Host: ${targetHostPeerId}`);

    return new Promise((resolve, reject) => {
      try {
        const rand = Math.random().toString(36).slice(2, 7);
        const ephemeralId = `mural-player-${Date.now().toString(36)}-${rand}`;
        this.peer = new Peer(ephemeralId, { debug: 1 });

        this.peer.on('open', (id) => {
          this.localPeerId = id;
          console.log(`[VttP2P] Client Peer ready with ID: ${id}. Connecting to host...`);

          const conn = this.peer!.connect(targetHostPeerId, { reliable: true });
          this.hostConnection = conn;

          conn.on('open', () => {
            console.log(`[VttP2P] Connected to GM Host successfully!`);
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            this.startHeartbeat();

            // Send handshake JOIN message
            this.sendToHost('VTT_JOIN', {
              playerPeerId: id,
              playerName: this.playerName,
              characterId: characterInfo?.characterId,
              characterName: characterInfo?.characterName,
              color: this.playerColor,
            });

            resolve();
          });

          conn.on('data', (raw: unknown) => {
            this.handleClientIncomingMessage(raw as VTTEnvelope);
          });

          conn.on('close', () => {
            console.warn('[VttP2P] Host connection closed.');
            this.isConnected = false;
            this.scheduleReconnect();
          });

          conn.on('error', (err) => {
            console.error('[VttP2P] Host connection error:', err);
            this.lastError = 'Erro na conexão com o Mestre.';
            this.isConnected = false;
          });
        });

        this.peer.on('error', (err: any) => {
          console.error('[VttP2P] Client Peer error:', err);
          if (err?.type === 'peer-unavailable') {
            this.lastError = 'Mestre não encontrado. Verifique o código da sala.';
          } else {
            this.lastError = err?.message || 'Erro ao conectar à sala.';
          }
          this.isConnecting = false;
          reject(err);
        });
      } catch (err: any) {
        this.lastError = err?.message || 'Falha ao inicializar conexão.';
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  // =========================================================================
  // Packet Routing & Authoritative Dispatch
  // =========================================================================

  private handleHostIncomingMessage(peerId: string, envelope: VTTEnvelope) {
    if (!envelope || !envelope.type) return;

    switch (envelope.type) {
      case 'VTT_JOIN': {
        const payload = envelope.payload as any;
        const peerInfo: ConnectedPeerInfo = {
          peerId,
          playerName: payload?.playerName || 'Jogador',
          characterName: payload?.characterName,
          color: payload?.color || '#38bdf8',
        };

        this.connectedPeers = [...this.connectedPeers.filter((p) => p.peerId !== peerId), peerInfo];

        // Find matching pawn
        let boundTokenId: string | undefined = undefined;
        if (this.activeScene) {
          const match = this.activeScene.tokens.find(
            (t) => (payload?.characterId && t.characterId === payload.characterId) || t.ownerPeerId === peerId
          );
          if (match) {
            match.ownerPeerId = peerId;
            boundTokenId = match.id;
          }
        }

        // Send JOIN_ACK back to player
        const conn = this.connections.get(peerId);
        if (conn?.open) {
          conn.send(this.createEnvelope('VTT_JOIN_ACK', {
            accepted: true,
            isGm: false,
            gmPeerId: this.localPeerId,
            assignedTokenId: boundTokenId,
          }));

          // Send immediate sanitized scene sync
          if (this.activeScene) {
            const playerScene = sanitizeSceneForPlayer(this.activeScene, peerId);
            conn.send(this.createEnvelope('VTT_SCENE_SYNC', { scene: playerScene }));
          }

          // Send current encounter state if in combat
          if (this.encounter) {
            conn.send(this.createEnvelope('VTT_INITIATIVE_UPDATE', { encounter: this.encounter }));
          }
        }
        break;
      }

      case 'VTT_TOKEN_MOVE': {
        const payload = envelope.payload as VttTokenMovePayload;
        const { tokenId, x, y } = payload;
        if (!this.activeScene) return;

        const token = this.activeScene.tokens.find((t) => t.id === tokenId);
        if (!token) return;

        // Authoritative verification
        if (!authorizeTokenMove(token, peerId, false)) {
          console.warn(`[VttP2P] Unauthorized token move attempt by ${peerId} on token ${tokenId}`);
          // Send correction back to revert player position
          const conn = this.connections.get(peerId);
          if (conn?.open) {
            conn.send(this.createEnvelope('VTT_TOKEN_MOVE', {
              tokenId: token.id,
              x: token.x,
              y: token.y,
              distanceMeters: 0,
              isFinal: true,
              movedByPeerId: 'mural-gm',
            }));
          }
          return;
        }

        // Update host state
        token.x = x;
        token.y = y;

        // Broadcast to authorized peers only (anti-cheat stealth protection)
        this.broadcastTokenMove(payload, token, peerId);
        break;
      }

      case 'VTT_MAP_PING': {
        const ping = envelope.payload as VttPing;
        this.addPing(ping);
        // Relay to other peers
        this.broadcastMessage('VTT_MAP_PING', ping, peerId);
        break;
      }

      case 'VTT_DICE_ROLL': {
        const roll = envelope.payload as DiceRollResult;
        this.diceFeed = [roll, ...this.diceFeed.slice(0, 49)];
        // Relay to all other peers
        this.broadcastMessage('VTT_DICE_ROLL', roll, peerId);
        break;
      }

      case 'VTT_PING': {
        const conn = this.connections.get(peerId);
        if (conn?.open) {
          conn.send(this.createEnvelope('VTT_PONG', {
            clientTimestamp: (envelope.payload as any)?.clientTimestamp,
            serverTimestamp: Date.now(),
          }));
        }
        break;
      }
    }
  }

  private handleClientIncomingMessage(envelope: VTTEnvelope) {
    if (!envelope || !envelope.type) return;

    switch (envelope.type) {
      case 'VTT_JOIN_ACK': {
        const payload = envelope.payload as any;
        if (payload?.assignedTokenId) {
          this.assignedTokenId = payload.assignedTokenId;
        }
        break;
      }

      case 'VTT_SCENE_SYNC': {
        const payload = envelope.payload as any;
        if (payload?.scene) {
          this.activeScene = payload.scene;
        }
        break;
      }

      case 'VTT_TOKEN_MOVE': {
        const payload = envelope.payload as VttTokenMovePayload;
        const { tokenId, x, y } = payload;
        if (this.activeScene) {
          const token = this.activeScene.tokens.find((t) => t.id === tokenId);
          if (token) {
            token.x = x;
            token.y = y;
          }
        }
        break;
      }

      case 'VTT_FOG_UPDATE': {
        if (!this.activeScene) return;
        const payload = envelope.payload as VttFogUpdatePayload;
        const { action, fullActions, actions } = payload;
        if (action) {
          this.activeScene.fogActions = [...this.activeScene.fogActions, action];
        } else if (actions) {
          this.activeScene.fogActions = actions;
        } else if (fullActions) {
          this.activeScene.fogActions = fullActions;
        }
        break;
      }

      case 'VTT_MAP_PING': {
        this.addPing(envelope.payload as VttPing);
        break;
      }

      case 'VTT_INITIATIVE_UPDATE': {
        const payload = envelope.payload as any;
        this.encounter = payload?.encounter ?? null;
        break;
      }

      case 'VTT_DICE_ROLL': {
        const roll = envelope.payload as DiceRollResult;
        this.diceFeed = [roll, ...this.diceFeed.slice(0, 49)];
        break;
      }

      case 'VTT_PONG': {
        const payload = envelope.payload as any;
        const rtt = Date.now() - (payload?.clientTimestamp ?? Date.now());
        this.latencyMs = Math.max(0, rtt);
        break;
      }

      case 'VTT_LEAVE': {
        const payload = envelope.payload as any;
        this.lastError = payload?.message || 'Sessão encerrada pelo Mestre.';
        this.isConnected = false;
        break;
      }
    }
  }

  // =========================================================================
  // Public Action Triggers
  // =========================================================================

  syncScene(scene: VttScene) {
    this.activeScene = scene;
    if (!this.isHost) return;

    // Send personalized sanitized scenes to each connected peer
    for (const [peerId, conn] of this.connections.entries()) {
      if (conn.open) {
        const sanitized = sanitizeSceneForPlayer(scene, peerId);
        conn.send(this.createEnvelope('VTT_SCENE_SYNC', { scene: sanitized }));
      }
    }
  }

  sendTokenMove(tokenId: string, x: number, y: number, distanceMeters: number, isFinal: boolean) {
    const payload: VttTokenMovePayload = {
      tokenId,
      x,
      y,
      distanceMeters,
      isFinal,
      movedByPeerId: this.localPeerId,
    };

    if (this.isHost) {
      let targetToken: VttToken | undefined;
      if (this.activeScene) {
        targetToken = this.activeScene.tokens.find((t) => t.id === tokenId);
        if (targetToken) {
          targetToken.x = x;
          targetToken.y = y;
        }
      }

      if (targetToken) {
        this.broadcastTokenMove(payload, targetToken);
      } else {
        this.broadcastMessage('VTT_TOKEN_MOVE', payload);
      }
    } else {
      this.sendToHost('VTT_TOKEN_MOVE', payload);
    }
  }

  sendFogAction(action: FogAction) {
    if (!this.isHost || !this.activeScene) return;
    this.activeScene.fogActions = [...this.activeScene.fogActions, action];
    this.broadcastMessage('VTT_FOG_UPDATE', { action });
  }

  sendPing(x: number, y: number) {
    const ping: VttPing = {
      id: `ping-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x,
      y,
      color: this.playerColor,
      senderName: this.playerName,
      senderId: this.localPeerId,
      durationMs: 2500,
      timestamp: Date.now(),
    };

    this.addPing(ping);

    if (this.isHost) {
      this.broadcastMessage('VTT_MAP_PING', ping);
    } else {
      this.sendToHost('VTT_MAP_PING', ping);
    }
  }

  sendInitiativeUpdate(encounter: CombatEncounter | null) {
    this.encounter = encounter;
    if (this.isHost) {
      this.broadcastMessage('VTT_INITIATIVE_UPDATE', { encounter });
    }
  }

  sendDiceRoll(roll: DiceRollResult) {
    this.diceFeed = [roll, ...this.diceFeed.slice(0, 49)];
    if (this.isHost) {
      this.broadcastMessage('VTT_DICE_ROLL', roll);
    } else {
      this.sendToHost('VTT_DICE_ROLL', roll);
    }
  }

  // =========================================================================
  // Internal Helpers & Cleanup
  // =========================================================================

  private addPing(ping: VttPing) {
    this.recentPings = [...this.recentPings, ping];
    const timer = setTimeout(() => {
      this.recentPings = this.recentPings.filter((p) => p.id !== ping.id);
      this.pingTimers.delete(ping.id ?? '');
    }, ping.durationMs || 2500);
    if (ping.id) {
      this.pingTimers.set(ping.id, timer);
    }
  }

  private createEnvelope<T>(type: VTTMessageType, payload: T): VTTEnvelope<T> {
    return {
      type,
      senderId: this.localPeerId || 'local',
      senderName: this.playerName,
      timestamp: Date.now(),
      payload,
      version: '1.0.0',
    };
  }

  private broadcastMessage<T>(type: VTTMessageType, payload: T, excludePeerId?: string) {
    const envelope = this.createEnvelope(type, payload);
    for (const [peerId, conn] of this.connections.entries()) {
      if (peerId !== excludePeerId && conn.open) {
        try {
          conn.send(envelope);
        } catch (err) {
          console.warn(`[VttP2P] Failed to send ${type} to ${peerId}:`, err);
        }
      }
    }
  }

  /**
   * Dispatches VTT_TOKEN_MOVE to player peers adhering to anti-cheat stealth rules:
   * - Public tokens (isStealth !== true): broadcast to all connected peers (except excludePeerId).
   * - Stealth tokens (isStealth === true): only dispatched to the authorized owner peer (token.ownerPeerId),
   *   provided ownerPeerId !== excludePeerId. All other peers receive 0 packets.
   */
  private broadcastTokenMove(payload: VttTokenMovePayload, token: VttToken, excludePeerId?: string) {
    if (token.isStealth) {
      // Stealth token: dispatch strictly to authorized owner peer if connected and not the move originator
      if (token.ownerPeerId && token.ownerPeerId !== excludePeerId) {
        const conn = this.connections.get(token.ownerPeerId);
        if (conn?.open) {
          try {
            conn.send(this.createEnvelope('VTT_TOKEN_MOVE', payload));
          } catch (err) {
            console.warn(`[VttP2P] Failed to send stealth VTT_TOKEN_MOVE to owner ${token.ownerPeerId}:`, err);
          }
        }
      }
      // Unowned or GM-owned stealth monsters are never broadcast to player peers
      return;
    }

    // Public / non-stealth token: broadcast to all connected peers
    this.broadcastMessage('VTT_TOKEN_MOVE', payload, excludePeerId);
  }

  private sendToHost<T>(type: VTTMessageType, payload: T) {
    if (this.hostConnection?.open) {
      try {
        this.hostConnection.send(this.createEnvelope(type, payload));
      } catch (err) {
        console.warn(`[VttP2P] Failed to send ${type} to GM Host:`, err);
      }
    }
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (!this.isHost) {
      this.heartbeatTimer = setInterval(() => {
        if (this.hostConnection?.open) {
          this.hostConnection.send(this.createEnvelope('VTT_PING', { clientTimestamp: Date.now() }));
        }
      }, 5000);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.lastError = 'Conexão perdida. Não foi possível reconectar após 5 tentativas.';
      this.isConnecting = false;
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    console.log(`[VttP2P] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})...`);

    setTimeout(() => {
      if (!this.isConnected && this.roomCode) {
        this.joinRoom(this.roomCode, this.playerName);
      }
    }, delay);
  }

  destroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.pingTimers.forEach((timer) => clearTimeout(timer));
    this.pingTimers.clear();

    if (this.isHost) {
      this.broadcastMessage('VTT_LEAVE', { message: 'Mestre encerrou a sessão.' });
    } else if (this.hostConnection?.open) {
      this.sendToHost('VTT_LEAVE', { message: 'Jogador desconectou.' });
    }

    this.connections.forEach((conn) => conn.close());
    this.connections.clear();

    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.isHost = false;
    this.connectedPeers = [];
    this.activeScene = null;
    this.encounter = null;
    this.recentPings = [];
    this.lastError = null;
    this.latencyMs = 0;
  }
}

export const vttP2P = new VttP2PService();
