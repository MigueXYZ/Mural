/**
 * Mural (OrdemTools) - Atmospheric Audio Engine
 * Dual-layer Web Audio & HTML5 Audio playback system with smooth crossfading,
 * local file indexing, soundboard ambience loops, and synthetic procedural fallback.
 */

import type { AudioTrack, AudioPlaylist } from '../../types';

// Default built-in sound presets with multiple tracks per category
export const DEFAULT_PLAYLISTS: AudioPlaylist[] = [
  {
    id: 'pl-combat',
    name: 'Combate & Perigo',
    icon: 'Swords',
    category: 'combat',
    loop: true,
    tracks: [
      {
        id: 'synth-combat-1',
        title: 'Tambores de Guerra & Tensão',
        artist: 'OrdemTools Synth',
        src: 'synth:combat_drums',
        category: 'music',
        duration: 180,
      },
      {
        id: 'synth-combat-2',
        title: 'Confronto no Limiar',
        artist: 'OrdemTools Synth',
        src: 'synth:combat_action',
        category: 'music',
        duration: 210,
      },
      {
        id: 'synth-combat-3',
        title: 'Adrenalina Paranormal',
        artist: 'OrdemTools Synth',
        src: 'synth:combat_climax',
        category: 'music',
        duration: 195,
      },
    ],
  },
  {
    id: 'pl-mystery',
    name: 'Investigação & Segredos',
    icon: 'Search',
    category: 'mystery',
    loop: true,
    tracks: [
      {
        id: 'synth-mystery-1',
        title: 'Sussurros na Penumbra',
        artist: 'OrdemTools Synth',
        src: 'synth:mystery_whisper',
        category: 'music',
        duration: 240,
      },
      {
        id: 'synth-mystery-2',
        title: 'Pistas Ocultas & Revelação',
        artist: 'OrdemTools Synth',
        src: 'synth:mystery_clues',
        category: 'music',
        duration: 220,
      },
      {
        id: 'synth-mystery-3',
        title: 'O Enigma da Mansão',
        artist: 'OrdemTools Synth',
        src: 'synth:mystery_manor',
        category: 'music',
        duration: 205,
      },
    ],
  },
  {
    id: 'pl-exploration',
    name: 'Exploração & Viagem',
    icon: 'Compass',
    category: 'exploration',
    loop: true,
    tracks: [
      {
        id: 'synth-explore-1',
        title: 'Ventos da Fronteira',
        artist: 'OrdemTools Synth',
        src: 'synth:explore_winds',
        category: 'music',
        duration: 200,
      },
      {
        id: 'synth-explore-2',
        title: 'Trilha na Névoa',
        artist: 'OrdemTools Synth',
        src: 'synth:explore_mist',
        category: 'music',
        duration: 185,
      },
      {
        id: 'synth-explore-3',
        title: 'Ruínas Esquecidas',
        artist: 'OrdemTools Synth',
        src: 'synth:explore_ruins',
        category: 'music',
        duration: 230,
      },
    ],
  },
  {
    id: 'pl-tavern',
    name: 'Taverna & Descanso',
    icon: 'Beer',
    category: 'tavern',
    loop: true,
    tracks: [
      {
        id: 'synth-tavern-1',
        title: 'Caneca Cheia & Lareira',
        artist: 'OrdemTools Synth',
        src: 'synth:tavern_hearth',
        category: 'music',
        duration: 190,
      },
      {
        id: 'synth-tavern-2',
        title: 'Histórias ao Pé do Fogo',
        artist: 'OrdemTools Synth',
        src: 'synth:tavern_tales',
        category: 'music',
        duration: 175,
      },
      {
        id: 'synth-tavern-3',
        title: 'Bardo & Risos',
        artist: 'OrdemTools Synth',
        src: 'synth:tavern_bard',
        category: 'music',
        duration: 215,
      },
    ],
  },
];

export const AMBIENCE_PRESETS: AudioTrack[] = [
  { id: 'amb-rain', title: 'Chuva & Tempestade', src: 'synth:rain', category: 'ambience' },
  { id: 'amb-tavern', title: 'Taverna Movimentada', src: 'synth:tavern_chatter', category: 'ambience' },
  { id: 'amb-fire', title: 'Fogueira Crepitante', src: 'synth:fire', category: 'ambience' },
  { id: 'amb-wind', title: 'Vento Uivante', src: 'synth:wind', category: 'ambience' },
  { id: 'amb-dungeon', title: 'Gotejar na Masmorra', src: 'synth:dungeon', category: 'ambience' },
  { id: 'amb-clock', title: 'Pêndulo & Tensão', src: 'synth:clock', category: 'ambience' },
];

class AudioEngine {
  // Reactive State (Svelte 5 Runes)
  isPlayingMusic = $state(false);
  isPlayingAmbience = $state(false);

  currentMusicTrack = $state<AudioTrack | null>(null);
  currentAmbienceTrack = $state<AudioTrack | null>(null);
  currentPlaylist = $state<AudioPlaylist | null>(null);

  masterVolume = $state(0.8);
  musicVolume = $state(0.7);
  ambienceVolume = $state(0.5);

  currentTime = $state(0);
  duration = $state(180);
  isMuted = $state(false);
  isShuffle = $state(false);
  isLoop = $state(true);
  isPopupOpen = $state(false);
  musicDirectoryPath = $state('');
  crossfadeSec = $state(2.5);

  playlists = $state<AudioPlaylist[]>(DEFAULT_PLAYLISTS);

  // Audio elements & Web Audio Context
  private musicAudio: HTMLAudioElement | null = null;
  private ambienceAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private syntheticNoiseNode: AudioNode | null = null;
  private syntheticGainNode: GainNode | null = null;
  private synthTickerInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadPersistedAudioSettings();
      this.initAudioElements();
      // Start with default playlist and track loaded
      this.currentPlaylist = this.playlists[0];
      this.currentMusicTrack = this.playlists[0]?.tracks[0] || null;
      this.duration = this.currentMusicTrack?.duration || 180;
    }
  }

  private loadPersistedAudioSettings() {
    try {
      const savedShuffle = localStorage.getItem('mural_audio_shuffle');
      if (savedShuffle !== null) this.isShuffle = savedShuffle === 'true';

      const savedLoop = localStorage.getItem('mural_audio_loop');
      if (savedLoop !== null) this.isLoop = savedLoop === 'true';

      const savedMasterVol = localStorage.getItem('mural_master_volume');
      if (savedMasterVol !== null) this.masterVolume = parseFloat(savedMasterVol);

      const savedMusicVol = localStorage.getItem('mural_music_volume');
      if (savedMusicVol !== null) this.musicVolume = parseFloat(savedMusicVol);

      const savedMusicDir = localStorage.getItem('mural_music_dir');
      if (savedMusicDir !== null) this.musicDirectoryPath = savedMusicDir;
    } catch {}
  }

  private initAudioElements() {
    this.musicAudio = new Audio();
    this.ambienceAudio = new Audio();

    this.musicAudio.loop = false;
    this.ambienceAudio.loop = true;

    this.musicAudio.ontimeupdate = () => {
      if (this.musicAudio && !isNaN(this.musicAudio.currentTime)) {
        this.currentTime = this.musicAudio.currentTime;
        if (this.musicAudio.duration && !isNaN(this.musicAudio.duration)) {
          this.duration = this.musicAudio.duration;
        }
      }
    };

    this.musicAudio.onended = () => {
      this.nextTrack();
    };
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // --- Synthetic Procedural Ambient Fallback Generators ---
  private startSyntheticAmbience(type: string) {
    this.stopSyntheticAmbience();
    try {
      const ctx = this.getAudioContext();
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Pink / Brown noise generation
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Filter based on ambient type
      const filter = ctx.createBiquadFilter();
      if (type.includes('rain')) {
        filter.type = 'lowpass';
        filter.frequency.value = 900;
      } else if (type.includes('wind')) {
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        filter.Q.value = 3.0;
      } else if (type.includes('fire')) {
        filter.type = 'lowpass';
        filter.frequency.value = 1400;
      } else {
        filter.type = 'lowpass';
        filter.frequency.value = 600;
      }

      this.syntheticGainNode = ctx.createGain();
      this.updateEffectiveVolumes();

      whiteNoise.connect(filter);
      filter.connect(this.syntheticGainNode);
      this.syntheticGainNode.connect(ctx.destination);

      whiteNoise.start(0);
      this.syntheticNoiseNode = whiteNoise;
    } catch (e) {
      console.warn('[AudioEngine] Synthetic ambience generation not supported:', e);
    }
  }

  private stopSyntheticAmbience() {
    if (this.syntheticNoiseNode) {
      try {
        (this.syntheticNoiseNode as any).stop?.();
        this.syntheticNoiseNode.disconnect();
      } catch {}
      this.syntheticNoiseNode = null;
    }
  }

  // --- Volume Calculation ---
  private updateEffectiveVolumes() {
    const effectiveMusic = this.isMuted ? 0 : this.masterVolume * this.musicVolume;
    const effectiveAmbience = this.isMuted ? 0 : this.masterVolume * this.ambienceVolume;

    if (this.musicAudio) {
      this.musicAudio.volume = Math.max(0, Math.min(1, effectiveMusic));
    }
    if (this.ambienceAudio) {
      this.ambienceAudio.volume = Math.max(0, Math.min(1, effectiveAmbience));
    }
    if (this.syntheticGainNode && this.audioCtx) {
      this.syntheticGainNode.gain.setValueAtTime(effectiveAmbience * 0.4, this.audioCtx.currentTime);
    }
  }

  // --- Synthetic Track Progress Ticker ---
  private startSynthTicker() {
    this.stopSynthTicker();
    this.synthTickerInterval = setInterval(() => {
      if (this.isPlayingMusic && this.currentMusicTrack?.src.startsWith('synth:')) {
        this.currentTime += 1;
        if (this.currentTime >= this.duration) {
          this.currentTime = 0;
          this.nextTrack();
        }
      }
    }, 1000);
  }

  private stopSynthTicker() {
    if (this.synthTickerInterval) {
      clearInterval(this.synthTickerInterval);
      this.synthTickerInterval = null;
    }
  }

  // --- Music Playback Methods ---
  playMusic(track: AudioTrack, playlist?: AudioPlaylist) {
    if (playlist) {
      this.currentPlaylist = playlist;
    } else if (!this.currentPlaylist) {
      const pl = this.playlists.find((p) => p.tracks.some((t) => t.id === track.id)) || this.playlists[0];
      this.currentPlaylist = pl;
    }

    this.currentMusicTrack = track;
    this.currentTime = 0;
    this.duration = track.duration || 180;

    if (!track.src.startsWith('synth:')) {
      this.stopSynthTicker();
      if (this.musicAudio) {
        this.musicAudio.loop = false;
        this.musicAudio.src = track.src;
        this.musicAudio.currentTime = 0;
        this.musicAudio.play().catch(() => {});
        this.isPlayingMusic = true;
      }
    } else {
      // Synthetic theme playback
      if (this.musicAudio) {
        this.musicAudio.pause();
      }
      this.isPlayingMusic = true;
      this.startSynthTicker();
    }
    this.updateEffectiveVolumes();
  }

  toggleMusic() {
    if (this.isPlayingMusic) {
      this.pauseMusic();
    } else {
      this.resumeMusic();
    }
  }

  pauseMusic() {
    if (this.musicAudio) {
      this.musicAudio.pause();
    }
    this.stopSynthTicker();
    this.isPlayingMusic = false;
  }

  resumeMusic() {
    if (!this.currentMusicTrack) {
      const pl = this.currentPlaylist || this.playlists[0];
      if (pl?.tracks[0]) {
        this.playMusic(pl.tracks[0], pl);
        return;
      }
    }
    if (this.musicAudio && this.currentMusicTrack && !this.currentMusicTrack.src.startsWith('synth:')) {
      this.musicAudio.play().catch(() => {});
    } else if (this.currentMusicTrack?.src.startsWith('synth:')) {
      this.startSynthTicker();
    }
    this.isPlayingMusic = true;
  }

  stopMusic() {
    this.pauseMusic();
    this.currentMusicTrack = null;
    this.currentTime = 0;
  }

  nextTrack() {
    const pl =
      this.currentPlaylist ||
      this.playlists.find((p) => p.tracks.some((t) => t.id === this.currentMusicTrack?.id)) ||
      this.playlists[0];
    if (!pl || pl.tracks.length === 0) return;
    this.currentPlaylist = pl;

    if (pl.tracks.length === 1) {
      this.currentTime = 0;
      this.playMusic(pl.tracks[0], pl);
      return;
    }

    const currentIndex = pl.tracks.findIndex((t) => t.id === this.currentMusicTrack?.id);
    const validCurrent = currentIndex >= 0 ? currentIndex : 0;

    if (this.isShuffle) {
      let randomIndex = Math.floor(Math.random() * pl.tracks.length);
      if (randomIndex === validCurrent && pl.tracks.length > 1) {
        randomIndex = (randomIndex + 1) % pl.tracks.length;
      }
      this.playMusic(pl.tracks[randomIndex], pl);
      return;
    }

    const isLast = validCurrent >= pl.tracks.length - 1;
    if (isLast && !this.isLoop) {
      this.stopMusic();
      return;
    }

    const nextIndex = (validCurrent + 1) % pl.tracks.length;
    this.playMusic(pl.tracks[nextIndex], pl);
  }

  previousTrack() {
    const pl =
      this.currentPlaylist ||
      this.playlists.find((p) => p.tracks.some((t) => t.id === this.currentMusicTrack?.id)) ||
      this.playlists[0];
    if (!pl || pl.tracks.length === 0) return;
    this.currentPlaylist = pl;

    if (pl.tracks.length === 1) {
      this.currentTime = 0;
      this.playMusic(pl.tracks[0], pl);
      return;
    }

    const currentIndex = pl.tracks.findIndex((t) => t.id === this.currentMusicTrack?.id);
    const validCurrent = currentIndex >= 0 ? currentIndex : 0;

    if (this.isShuffle) {
      let randomIndex = Math.floor(Math.random() * pl.tracks.length);
      if (randomIndex === validCurrent && pl.tracks.length > 1) {
        randomIndex = (randomIndex - 1 + pl.tracks.length) % pl.tracks.length;
      }
      this.playMusic(pl.tracks[randomIndex], pl);
      return;
    }

    const prevIndex = (validCurrent - 1 + pl.tracks.length) % pl.tracks.length;
    this.playMusic(pl.tracks[prevIndex], pl);
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    try {
      localStorage.setItem('mural_audio_shuffle', String(this.isShuffle));
    } catch {}
  }

  toggleLoop() {
    this.isLoop = !this.isLoop;
    try {
      localStorage.setItem('mural_audio_loop', String(this.isLoop));
    } catch {}
  }

  importFromDirectory(files: FileList | File[], folderName?: string) {
    const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.webm'];
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const nameLower = file.name.toLowerCase();
      if (audioExts.some((ext) => nameLower.endsWith(ext))) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) return;

    const newTracks: AudioTrack[] = validFiles.map((file, i) => {
      const trackUrl = URL.createObjectURL(file);
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
      return {
        id: `track-${Date.now()}-${i}`,
        title: cleanTitle,
        artist: folderName || 'Pasta Local',
        src: trackUrl,
        category: 'music',
      };
    });

    const playlistName = folderName ? `📂 ${folderName}` : `📂 Músicas Locais (${newTracks.length})`;
    const playlist = this.createPlaylist(playlistName, 'custom');
    this.addTracksToPlaylist(playlist.id, newTracks);
    this.currentPlaylist = playlist;

    // Start playing first or random track
    if (newTracks.length > 0) {
      const startTrack = this.isShuffle
        ? newTracks[Math.floor(Math.random() * newTracks.length)]
        : newTracks[0];
      this.playMusic(startTrack, playlist);
    }
  }

  seek(seconds: number) {
    this.currentTime = seconds;
    if (this.musicAudio && this.musicAudio.duration) {
      this.musicAudio.currentTime = Math.max(0, Math.min(this.musicAudio.duration, seconds));
    }
  }

  // --- Ambience Playback Methods ---
  playAmbience(track: AudioTrack) {
    // If clicking the currently playing ambience, toggle it off
    if (this.currentAmbienceTrack?.id === track.id && this.isPlayingAmbience) {
      this.stopAmbience();
      return;
    }

    this.currentAmbienceTrack = track;
    this.isPlayingAmbience = true;

    if (track.src.startsWith('synth:')) {
      this.startSyntheticAmbience(track.src);
    } else if (this.ambienceAudio) {
      this.stopSyntheticAmbience();
      this.ambienceAudio.src = track.src;
      this.ambienceAudio.currentTime = 0;
      this.ambienceAudio.play().catch(() => {});
    }
    this.updateEffectiveVolumes();
  }

  stopAmbience() {
    this.stopSyntheticAmbience();
    if (this.ambienceAudio) {
      this.ambienceAudio.pause();
    }
    this.currentAmbienceTrack = null;
    this.isPlayingAmbience = false;
  }

  // --- Controls & Setters with LocalStorage Persistence ---
  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateEffectiveVolumes();
    try {
      localStorage.setItem('mural_master_volume', String(this.masterVolume));
    } catch {}
  }

  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateEffectiveVolumes();
    try {
      localStorage.setItem('mural_music_volume', String(this.musicVolume));
    } catch {}
  }

  setAmbienceVolume(volume: number) {
    this.ambienceVolume = Math.max(0, Math.min(1, volume));
    this.updateEffectiveVolumes();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.updateEffectiveVolumes();
  }

  // --- Playlist Management ---
  createPlaylist(name: string, category: AudioPlaylist['category'] = 'custom'): AudioPlaylist {
    const newPlaylist: AudioPlaylist = {
      id: `pl-${Date.now()}`,
      name,
      category,
      tracks: [],
      loop: true,
    };
    this.playlists = [...this.playlists, newPlaylist];
    return newPlaylist;
  }

  deletePlaylist(playlistId: string) {
    if (this.currentPlaylist?.id === playlistId) {
      this.stopMusic();
      this.currentPlaylist = this.playlists[0] || null;
    }
    this.playlists = this.playlists.filter((p) => p.id !== playlistId);
  }

  addTracksToPlaylist(playlistId: string, newTracks: AudioTrack[]) {
    this.playlists = this.playlists.map((pl) => {
      if (pl.id === playlistId) {
        return {
          ...pl,
          tracks: [...pl.tracks, ...newTracks],
        };
      }
      return pl;
    });

    if (this.currentPlaylist?.id === playlistId) {
      this.currentPlaylist = this.playlists.find((p) => p.id === playlistId) || this.currentPlaylist;
    }
  }

  removeTrackFromPlaylist(playlistId: string, trackId: string) {
    if (this.currentMusicTrack?.id === trackId) {
      this.nextTrack();
    }
    this.playlists = this.playlists.map((pl) => {
      if (pl.id === playlistId) {
        return {
          ...pl,
          tracks: pl.tracks.filter((t) => t.id !== trackId),
        };
      }
      return pl;
    });
  }
}

export const audioEngine = new AudioEngine();
