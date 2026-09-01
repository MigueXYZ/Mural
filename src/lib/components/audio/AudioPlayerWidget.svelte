<!-- File: src/lib/components/audio/AudioPlayerWidget.svelte -->
<script lang="ts">
  import { audioEngine, AMBIENCE_PRESETS } from '../../services/audio/audioEngine.svelte';
  import PlaylistManagerModal from './PlaylistManagerModal.svelte';
  import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Music,
    CloudRain,
    Beer,
    Flame,
    Wind,
    Skull,
    Sliders,
    ListMusic,
    Radio,
    Shuffle,
    Repeat,
    X,
  } from 'lucide-svelte';

  let isPlaylistModalOpen = $state(false);

  function formatTime(secs: number) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function getAmbienceIcon(id: string) {
    if (id.includes('rain')) return CloudRain;
    if (id.includes('tavern')) return Beer;
    if (id.includes('fire')) return Flame;
    if (id.includes('wind')) return Wind;
    if (id.includes('dungeon')) return Skull;
    return Radio;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (audioEngine.isPopupOpen && e.key === 'Escape') {
      audioEngine.isPopupOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if audioEngine.isPopupOpen}
  <!-- Fixed Docked Popup near Left Navigation Rail -->
  <div
    class="fixed left-16 bottom-16 z-40 w-80 rounded-3xl bg-zinc-950/95 border border-zinc-700/90 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col space-y-3 p-4 animate-in fade-in slide-in-from-left-4 duration-150 select-none"
    role="dialog"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Music class="w-3.5 h-3.5" />
        </div>
        <div class="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
          <span>Áudio & Ambiência</span>
        </div>
      </div>

      <div class="flex items-center gap-1">
        <button
          onclick={() => (isPlaylistModalOpen = true)}
          title="Gerir Playlists e Ficheiros"
          class="p-1 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
        >
          <ListMusic class="w-3.5 h-3.5" />
        </button>
        <button
          onclick={() => (audioEngine.isPopupOpen = false)}
          title="Fechar Popup"
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- CANAL 1: TRILHA SONORA (BGM) -->
    <div class="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
          Canal 1 • Trilha Sonora
        </span>
        <span class="text-[10px] text-zinc-400 font-mono">
          {formatTime(audioEngine.currentTime)} / {formatTime(audioEngine.duration)}
        </span>
      </div>

      <!-- Track Info -->
      <div class="min-w-0">
        <div class="text-xs font-bold text-zinc-100 truncate">
          {audioEngine.currentMusicTrack?.title || 'Nenhuma música selecionada'}
        </div>
        <div class="text-[10px] text-zinc-500 truncate">
          {audioEngine.currentPlaylist?.name || 'Playlist Padrão'}
        </div>
      </div>

      <!-- Scrubber Progress Bar -->
      <input
        type="range"
        min="0"
        max={audioEngine.duration || 100}
        value={audioEngine.currentTime}
        oninput={(e) => audioEngine.seek(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
      />

      <!-- Playback Controls -->
      <div class="flex items-center justify-between pt-1">
        <button
          onclick={() => audioEngine.toggleShuffle()}
          class="p-1.5 rounded-lg transition cursor-pointer {audioEngine.isShuffle ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}"
          title={audioEngine.isShuffle ? 'Modo Aleatório Ativado' : 'Ativar Modo Aleatório (Shuffle)'}
        >
          <Shuffle class="w-3.5 h-3.5" />
        </button>

        <button
          onclick={() => audioEngine.previousTrack()}
          class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
          title="Faixa Anterior"
        >
          <SkipBack class="w-4 h-4" />
        </button>

        <button
          onclick={() => audioEngine.toggleMusic()}
          class="w-9 h-9 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold flex items-center justify-center hover:from-amber-400 hover:to-amber-300 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
          title={audioEngine.isPlayingMusic ? 'Pausar' : 'Reproduzir'}
        >
          {#if audioEngine.isPlayingMusic}
            <Pause class="w-4 h-4" />
          {:else}
            <Play class="w-4 h-4 ml-0.5" />
          {/if}
        </button>

        <button
          onclick={() => audioEngine.nextTrack()}
          class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
          title="Próxima Faixa"
        >
          <SkipForward class="w-4 h-4" />
        </button>

        <button
          onclick={() => audioEngine.toggleLoop()}
          class="p-1.5 rounded-lg transition cursor-pointer {audioEngine.isLoop ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}"
          title={audioEngine.isLoop ? 'Loop / Repetir Ativado' : 'Repetição Desativada'}
        >
          <Repeat class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Music Volume Slider -->
      <div class="flex items-center gap-2 pt-1 border-t border-zinc-800/80">
        <span class="text-[10px] text-zinc-500 font-medium">Vol:</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={audioEngine.musicVolume}
          oninput={(e) => audioEngine.setMusicVolume(parseFloat((e.currentTarget as HTMLInputElement).value))}
          class="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />
        <span class="text-[10px] text-zinc-400 font-mono w-6 text-right">
          {Math.round(audioEngine.musicVolume * 100)}%
        </span>
      </div>
    </div>

    <!-- CANAL 2: AMBIÊNCIA CONTÍNUA (SOUNDBOARD) -->
    <div class="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
          Canal 2 • Ambiência em Loop
        </span>
        {#if audioEngine.isPlayingAmbience}
          <button
            onclick={() => audioEngine.stopAmbience()}
            class="text-[10px] text-rose-400 hover:underline cursor-pointer"
          >
            Parar
          </button>
        {/if}
      </div>

      <!-- Soundboard Grid Buttons -->
      <div class="grid grid-cols-3 gap-1.5">
        {#each AMBIENCE_PRESETS as amb}
          {@const Icon = getAmbienceIcon(amb.id)}
          {@const isThisActive = audioEngine.isPlayingAmbience && audioEngine.currentAmbienceTrack?.id === amb.id}
          <button
            type="button"
            onclick={() => audioEngine.playAmbience(amb)}
            class="p-2 rounded-xl border text-left flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer {isThisActive
              ? 'bg-sky-500/20 border-sky-400 text-sky-300 ring-1 ring-sky-400/50 shadow-md shadow-sky-500/10'
              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'}"
          >
            <Icon class="w-3.5 h-3.5 {isThisActive ? 'text-sky-300 animate-bounce' : 'text-zinc-500'}" />
            <span class="text-[9px] font-medium leading-tight line-clamp-1">{amb.title.split(' ')[0]}</span>
          </button>
        {/each}
      </div>

      <!-- Ambience Volume Slider -->
      <div class="flex items-center gap-2 pt-1 border-t border-zinc-800/80">
        <span class="text-[10px] text-zinc-500 font-medium">Vol:</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={audioEngine.ambienceVolume}
          oninput={(e) => audioEngine.setAmbienceVolume(parseFloat((e.currentTarget as HTMLInputElement).value))}
          class="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
        />
        <span class="text-[10px] text-zinc-400 font-mono w-6 text-right">
          {Math.round(audioEngine.ambienceVolume * 100)}%
        </span>
      </div>
    </div>

    <!-- MASTER VOLUME & QUICK MUTE FOOTER -->
    <div class="flex items-center justify-between pt-1 px-1 text-xs text-zinc-400">
      <button
        onclick={() => audioEngine.toggleMute()}
        class="flex items-center gap-1.5 hover:text-zinc-100 transition cursor-pointer"
      >
        {#if audioEngine.isMuted}
          <VolumeX class="w-4 h-4 text-rose-400" />
          <span class="text-[11px] text-rose-300">Sem Som</span>
        {:else}
          <Volume2 class="w-4 h-4 text-amber-400" />
          <span class="text-[11px]">Master: {Math.round(audioEngine.masterVolume * 100)}%</span>
        {/if}
      </button>

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={audioEngine.masterVolume}
        oninput={(e) => audioEngine.setMasterVolume(parseFloat((e.currentTarget as HTMLInputElement).value))}
        class="w-28 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
      />
    </div>
  </div>
{/if}

<!-- Playlist Manager Modal -->
<PlaylistManagerModal bind:isOpen={isPlaylistModalOpen} />
