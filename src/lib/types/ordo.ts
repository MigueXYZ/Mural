// File: src/lib/types/ordo.ts

// ---------------------------------------------------------------------------
// 1. Ordo Character Sheets & Attributes (Ordem Paranormal / TTRPG Companion)
// ---------------------------------------------------------------------------

export interface OrdoAttributes {
  agi: number; // Agilidade
  for: number; // Força
  int: number; // Intelecto
  pre: number; // Presença
  vig: number; // Vigor
}

export interface OrdoStatResource {
  current: number;
  max: number;
  temp?: number;
}

export type OrdoSkillTraining = 'destreinado' | 'treinado' | 'veterano' | 'expert';

export interface OrdoSkill {
  name: string;
  attribute: 'AGI' | 'FOR' | 'INT' | 'PRE' | 'VIG';
  training: OrdoSkillTraining;
  bonus?: number;
  custom?: boolean;
}

export interface OrdoCharacter {
  id: string;
  name: string;
  playerName: string;
  origin?: string; // e.g. "Acadêmico", "Policial", "Investigador"
  class?: string; // "Combatente", "Especialista", "Ocultista"
  nex?: number; // Nível de Exposição Paranormal (5% a 99%)
  
  // Vital Resource Pools
  pv: OrdoStatResource; // Pontos de Vida
  san: OrdoStatResource; // Sanidade
  pe: OrdoStatResource; // Pontos de Esforço
  pd?: OrdoStatResource; // Pontos de Determinação

  // Defenses & Movement
  defense?: number;
  movement?: number;
  passivePerception?: number;

  // Core Attributes & Skills
  attributes: OrdoAttributes;
  skills: Record<string, OrdoSkill>;

  // Conditions & Status
  statusEffects?: string[]; // e.g. ["Abalado", "Sangrando", "Inconsciente"]
  avatarUrl?: string;
  color?: string;
  lastUpdated?: number;
  peerId: string;
  connected: boolean;
}

// ---------------------------------------------------------------------------
// 2. Dice Rolls & Events Log
// ---------------------------------------------------------------------------

export type OrdoRollType = 'pericia' | 'atributo' | 'dano' | 'sanidade' | 'iniciativa' | 'custom';

export interface OrdoDiceRollEvent {
  id: string;
  characterId: string;
  characterName: string;
  playerName: string;
  rollType: OrdoRollType;
  label: string; // e.g. "Ocultismo", "Teste de Vigor", "Ataque com Revólver"
  diceFormula: string; // e.g. "3d20 + 5"
  diceResults: number[]; // e.g. [12, 19, 7]
  keptValue: number; // e.g. 19
  total: number; // e.g. 24
  isCritical?: boolean;
  isFumble?: boolean;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// 3. Audio Synchronization Contract (Mural GM -> Ordo Players)
// ---------------------------------------------------------------------------

export interface OrdoAudioSyncPayload {
  trackId: string;
  title: string;
  artist?: string;
  url?: string;
  src?: string;
  isPlaying: boolean;
  currentTime: number;
  duration?: number;
  volumeMultiplier: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// 4. P2P Communication Envelope
// ---------------------------------------------------------------------------

export type OrdoMessageType =
  | 'JOIN'
  | 'LEAVE'
  | 'CHARACTER_UPDATE'
  | 'DICE_ROLL'
  | 'AUDIO_SYNC'
  | 'AUDIO_STREAM_CHUNK'
  | 'GM_ANNOUNCEMENT'
  | 'PING'
  | 'PONG';

export interface OrdoP2PMessage<T = any> {
  type: OrdoMessageType;
  senderId: string;
  senderName: string;
  timestamp: number;
  payload: T;
}

export interface OrdoRoomStatus {
  roomCode: string;
  fullPeerId: string;
  isOpen: boolean;
  connectedPeersCount: number;
  lastError: string | null;
}
