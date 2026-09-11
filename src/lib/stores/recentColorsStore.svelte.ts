/**
 * Mural - Recent Colors Swatches Store (US R6)
 * Maintains an MRU/FIFO deduplicated list of up to 10 recently used colors,
 * persisted in localStorage under 'mural_recent_colors'.
 */

export const STORAGE_KEY = 'mural_recent_colors';
export const MAX_RECENT_COLORS = 10;

// Default starter swatches matching standard Mural themes
export const DEFAULT_PRESET_COLORS = [
  { name: 'Ouro / Âmbar', hex: '#d4a359' },
  { name: 'Púrpura / Arcano', hex: '#a855f7' },
  { name: 'Azul Celeste / Local', hex: '#38bdf8' },
  { name: 'Carmesim / Sangue', hex: '#f87171' },
  { name: 'Esmeralda / Natureza', hex: '#10b981' },
  { name: 'Laranja / Chama', hex: '#f97316' },
  { name: 'Índigo / Mistério', hex: '#6366f1' },
  { name: 'Cinza / Sombra', hex: '#71717a' },
];

export function normalizeHex(color: string): string {
  if (!color || typeof color !== 'string') return '';
  let c = color.trim().toLowerCase();
  if (!c.startsWith('#')) c = `#${c}`;
  if (/^#[0-9a-f]{3}$/.test(c)) {
    c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  return c;
}

export function isValidHex(color: string): boolean {
  const norm = normalizeHex(color);
  return /^#[0-9a-f]{6}$/.test(norm);
}

function loadInitialRecentColors(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item === 'string' && isValidHex(item)) {
        const norm = normalizeHex(item);
        if (!result.includes(norm)) {
          result.push(norm);
        }
      }
    }
    return result.slice(0, MAX_RECENT_COLORS);
  } catch {
    return [];
  }
}

export class RecentColorsStore {
  colors = $state<string[]>(loadInitialRecentColors());

  get recentColors(): string[] {
    return this.colors;
  }

  set recentColors(val: string[]) {
    this.colors = val;
  }

  addColor(color: string) {
    if (!color || typeof color !== 'string') return;
    if (!isValidHex(color)) return;
    const hex = normalizeHex(color);

    // Deduplicate and place at front (newest first)
    const filtered = this.colors.filter((c) => c !== hex);
    this.colors = [hex, ...filtered].slice(0, MAX_RECENT_COLORS);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.colors));
      } catch (e) {
        console.warn('Failed to save recent colors to localStorage:', e);
      }
    }
  }

  addRecentColor(color: string) {
    this.addColor(color);
  }

  clear() {
    this.colors = [];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn('Failed to clear recent colors from localStorage:', e);
      }
    }
  }

  clearRecentColors() {
    this.clear();
  }
}

export const recentColors = new RecentColorsStore();
export const recentColorsStore = recentColors;
