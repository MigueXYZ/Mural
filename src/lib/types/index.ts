import type { Node, Edge } from '@xyflow/svelte';

// ---------------------------------------------------------------------------
// 1. Encounter Table & Sub-Note Types
// ---------------------------------------------------------------------------

export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface EncounterTableRow {
  id: string;
  range: string; // e.g. "1-2", "3-4", "5", "6", "1-10", "11-20"
  title: string;
  description?: string;
  isSecret?: boolean;
}

export interface EncounterTable {
  id: string;
  title: string; // e.g. "Encontros Noturnos na Praça", "Rumores da Taverna"
  diceType: DiceType;
  description?: string;
  rows: EncounterTableRow[];
  lastRoll?: {
    diceValue: number;
    matchedRowId?: string;
    rolledAt: number;
  };
}

export interface AttachedNote {
  id: string;
  title: string; // e.g. "Armadilhas & Perigos", "Estatísticas de Combate", "Carta Antiga"
  content: string;
  isSecret?: boolean;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// 2. Audio & Atmospheric Soundboard Types
// ---------------------------------------------------------------------------

export interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  src: string; // file path, blob url, or synthetic generator identifier
  duration?: number;
  category?: 'music' | 'ambience' | 'sfx';
}

export interface AudioPlaylist {
  id: string;
  name: string;
  icon?: string; // Lucide icon or emoji (e.g. 'Swords', 'Trees', 'Beer', 'Flame')
  category?: 'combat' | 'mystery' | 'exploration' | 'tavern' | 'horror' | 'custom';
  tracks: AudioTrack[];
  loop?: boolean;
  shuffle?: boolean;
}

// ---------------------------------------------------------------------------
// 3. Entity Node Types
// ---------------------------------------------------------------------------

export type EntityType = 'npc' | 'faction' | 'location' | 'secret' | 'clue' | 'note' | 'table';
export type EntityCategory = EntityType;

export interface EntityNodeData extends Record<string, unknown> {
  id: string;
  type: EntityType;
  category?: EntityCategory; // Alias for type
  title: string;
  subtitle?: string; // e.g. "Suspeito", "Líder", "Ruínas Antigas", "Tabela 1d6", "Documento"
  description: string;
  tags?: string[]; // Array of tag strings: ['Aliado', 'Nível 5', 'Alquimia']
  isSecret?: boolean; // True if GM secret
  revealed?: boolean; // True if revealed to players
  statusText?: string; // Custom status tag
  icon?: string; // Lucide icon identifier (e.g. 'user', 'shield', 'skull', 'sword', 'file-text', 'dices')
  color?: string; // Primary accent color hex (e.g. '#d4a359', '#f87171')
  colorTheme?: string; // Alias for color

  // Attached Rich Context & Tables
  tables?: EncounterTable[];
  notes?: AttachedNote[];

  // Linked Audio Track or Playlist
  audioTrackId?: string;
  audioPlaylistId?: string;
}

// ---------------------------------------------------------------------------
// 4. Semantic Edge Types
// ---------------------------------------------------------------------------

export type RelationType = 'allied' | 'hostile' | 'secret' | 'neutral' | 'investigates' | 'custom';
export type EdgePathType = 'smoothstep' | 'bezier' | 'straight';

export interface CanvasRelationEdgeData extends Record<string, unknown> {
  label: string;
  relationType: RelationType;
  pathType?: EdgePathType;
  bidirectional?: boolean;
  notes?: string;
  color?: string;
  icon?: string;
}

export type CanvasRelationEdge = Edge<CanvasRelationEdgeData>;

// ---------------------------------------------------------------------------
// 5. Threat Clock Types
// ---------------------------------------------------------------------------

export type ClockSegmentCount = 4 | 6 | 8 | 10 | 12;

export interface ThreatClock {
  id: string;
  title: string;
  totalSegments: ClockSegmentCount | number;
  filledSegments: number;
  consequence?: string;
  category?: string;
  createdAt?: number;
}

// ---------------------------------------------------------------------------
// 6. Lore Entry Types
// ---------------------------------------------------------------------------

export type LoreVisibility = 'SABIDO' | 'SEGREDO';

export interface LoreEntry {
  id: string;
  title?: string;
  content: string;
  status: LoreVisibility;
  visibility?: LoreVisibility; // Alias
  sessionNumber?: number;
  associatedNodeIds?: string[];
  createdAt?: number;
  updatedAt?: number;
}

// ---------------------------------------------------------------------------
// 7. Timeline Marker Types
// ---------------------------------------------------------------------------

export interface TimelineMarker {
  id: string;
  title?: string;
  sessionText: string;
  sessionNumber: number;
  inGameDate?: string;
  realDate?: string;
  notes?: string;
  isCurrent?: boolean;
  label?: string;
  summary?: string;
  timestamp?: number;
}

// ---------------------------------------------------------------------------
// 8. Atlas Map & Pins
// ---------------------------------------------------------------------------

export interface MapPin {
  id: string;
  label: string;
  xPercent: number; // percentage 0 - 100
  yPercent: number; // percentage 0 - 100
  color?: string;
  notes?: string;
  targetNodeId?: string; // Link to canvas node
  x?: number;
  y?: number;
  description?: string;
}

export interface MapData {
  id: string;
  name?: string;
  title?: string;
  imageUrl: string;
  gridSize?: number;
  pins: MapPin[];
}

export type AtlasMapData = MapData;

// ---------------------------------------------------------------------------
// 9. Custom Calendar System Types (US 154)
// ---------------------------------------------------------------------------

export type MoonPhaseType =
  | 'new_moon'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full_moon'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

export interface MoonPhaseConfig {
  id: string;
  name: string; // e.g. "Lua Prateada", "Selûne", "Lua de Sangue"
  cycleDays: number; // e.g. 28, 30.5, 33
  startingPhaseDay?: number; // offset in days
  color?: string; // hex color for icon rendering
}

export interface MoonPhaseResult {
  moon: MoonPhaseConfig;
  phase: MoonPhaseType;
  phaseName: string;
  phaseIcon: string;
  illuminationPercent: number;
}

export interface CalendarMonth {
  id: string;
  name: string;
  days: number;
  season?: 'Inverno' | 'Primavera' | 'Verão' | 'Outono' | string;
  isIntercalary?: boolean; // Festival day outside standard weeks/months
}

export interface LeapYearRule {
  enabled: boolean;
  intervalYears: number; // e.g. every 4 years
  monthIndex: number; // which month receives the extra day(s) (0-indexed)
  extraDays: number; // e.g. 1
}

export interface CalendarHoliday {
  id: string;
  name: string;
  monthIndex: number;
  day: number;
  description?: string;
  color?: string;
}

export interface CustomCalendarConfig {
  id: string;
  name: string; // e.g. "Calendário de Harptos", "Calendário Solar de Aerthys"
  description?: string;
  weekdays: string[]; // e.g. ["Solstício", "Lunare", "Chama", ...]
  months: CalendarMonth[];
  yearPrefix?: string; // e.g. "Ano"
  yearSuffix?: string; // e.g. "da 3ª Era", "DR"
  currentYear: number;
  currentMonthIndex: number; // 0-indexed
  currentDay: number; // 1-indexed
  leapYearRule?: LeapYearRule;
  moons?: MoonPhaseConfig[];
  holidays?: CalendarHoliday[];
}

// ---------------------------------------------------------------------------
// 10. Campaign Settings & Full Campaign Data
// ---------------------------------------------------------------------------

export interface CampaignSettings {
  theme?: string;
  autoSaveIntervalMs?: number;
  aiProvider?: 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'mock' | 'none';
  apiKey?: string;
  aiModel?: string;
  modelName?: string;
  ollamaEndpoint?: string;

  // Music & Audio Settings
  musicDirectoryPath?: string;
  audioShuffle?: boolean;
  audioLoop?: boolean;
  audioCrossfadeSec?: number;
  defaultMasterVolume?: number;
}

export interface CampaignData {
  id: string;
  name: string;
  system: string;
  currentSession: number;
  inGamePeriod: string;
  description?: string;
  createdAt?: number | string;
  updatedAt: string;
  version?: string;
  clocks: ThreatClock[];
  lore: LoreEntry[];
  timeline: TimelineMarker[];
  nodes: Node<EntityNodeData>[];
  edges: Edge[];
  maps?: MapData[];
  atlas?: AtlasMapData[];
  playlists?: AudioPlaylist[];
  settings?: CampaignSettings;
  customCalendar?: CustomCalendarConfig;
}

export interface CampaignSummary {
  id: string;
  name: string;
  system: string;
  currentSession: number;
  inGamePeriod: string;
  description?: string;
  updatedAt: string;
  nodeCount: number;
  clockCount: number;
  loreCount: number;
}
