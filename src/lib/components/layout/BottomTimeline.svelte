<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { audioEngine } from '../../services/audio/audioEngine.svelte';
  import {
    Calendar,
    Plus,
    Check,
    Edit2,
    Music,
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Shuffle,
    Repeat,
    Volume2,
  } from 'lucide-svelte';

  let isEditingDate = $state(false);
  let tempDate = $state('');
  let isHovered = $state(false);
  let hoverTimeout: any = null;

  function handleMouseEnter() {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    isHovered = true;
  }

  function handleMouseLeave() {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      isHovered = false;
    }, 450); // 450ms grace period
  }

  const moonPhases = $derived(campaignStore.getCurrentMoonPhases());
  const primaryMoon = $derived(moonPhases[0]);

  function handleOpenCalendar() {
    campaignStore.openCalendar();
  }

  function handleAddSession() {
    const nextSession = (campaignStore.campaign.timeline?.length || 0) + 1;
    campaignStore.addTimelineMarker(`Sessão ${nextSession}`, nextSession, campaignStore.campaign.inGamePeriod);
    campaignStore.switchActiveSession(nextSession);
  }
</script>

<footer class="h-10 border-t border-zinc-800/80 bg-zinc-950 px-4 flex items-center justify-between text-xs select-none z-20">
  <!-- Interactive Custom Calendar Date Button (US 154) -->
  <div class="flex items-center gap-1.5">
    <button
      type="button"
      onclick={handleOpenCalendar}
      title="Abrir Calendário da Campanha e Gerir Tempo"
      class="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900 text-zinc-300 hover:text-amber-300 transition cursor-pointer shadow-xs group"
    >
      <Calendar class="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition" />
      <span class="font-medium text-[11px] text-zinc-200 group-hover:text-amber-300 transition">
        {campaignStore.campaign.inGamePeriod || 'Presente'}
      </span>
      {#if primaryMoon}
        <span class="text-xs" title={`${primaryMoon.moon.name}: ${primaryMoon.phaseName} (${primaryMoon.illuminationPercent}%)`}>
          {primaryMoon.phaseIcon}
        </span>
      {/if}
    </button>

    <!-- Quick +1 Day Advancement Button -->
    <button
      type="button"
      onclick={() => campaignStore.advanceCalendarDays(1)}
      title="Avançar 1 Dia no Calendário"
      class="p-1 rounded-lg text-zinc-500 hover:text-amber-300 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition text-[11px] font-mono font-bold flex items-center gap-0.5 cursor-pointer"
    >
      <Plus class="w-3 h-3 text-amber-400" />
      <span>1d</span>
    </button>
  </div>

  <!-- Timeline nodes track -->
  <div class="flex items-center gap-6 text-zinc-500 overflow-x-auto max-w-2xl px-2">
    {#if campaignStore.campaign.timeline && campaignStore.campaign.timeline.length > 0}
      {#each campaignStore.campaign.timeline as item, index (item.id || index)}
        {@const isCurrent = item.sessionNumber === campaignStore.campaign.currentSession}
        <div class="flex items-center gap-2 relative shrink-0">
          {#if index > 0}
            <div class="w-6 h-[1px] bg-zinc-800 absolute -left-4 top-1/2 -translate-y-1/2"></div>
          {/if}
          <span class="w-2 h-2 rounded-full transition-all {isCurrent ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] scale-125' : 'bg-zinc-700'}"></span>
          <button
            onclick={() => campaignStore.switchActiveSession(item.sessionNumber)}
            title={item.inGameDate ? `${item.title || item.sessionText} (${item.inGameDate})` : `Mudar para Sessão ${item.sessionNumber}`}
            class="hover:text-zinc-300 transition text-[11px] font-medium cursor-pointer {isCurrent ? 'text-amber-400 font-bold' : 'text-zinc-400'}"
          >
            {item.sessionText || `Sessão ${item.sessionNumber}`}
          </button>
        </div>
      {/each}
    {/if}

    <button
      onclick={handleAddSession}
      title="Adicionar Nova Sessão"
      class="text-zinc-500 hover:text-amber-400 p-1 rounded hover:bg-zinc-900 transition flex items-center gap-1 text-[11px] cursor-pointer"
    >
      <Plus class="w-3 h-3" />
      <span class="hidden sm:inline">Nova Sessão</span>
    </button>
  </div>

  <!-- Bottom Right Mini Soundtrack Player with Hover Controls -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative flex items-center select-none"
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
  >
    <!-- Default state: Title of track -->
    <button
      type="button"
      onclick={() => (audioEngine.isPopupOpen = !audioEngine.isPopupOpen)}
      class="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 transition hover:border-amber-500/50 hover:bg-zinc-900 cursor-pointer shadow-sm"
      title="Clica para abrir o Soundboard completo"
    >
      <div class="w-2 h-2 rounded-full {audioEngine.isPlayingMusic ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'}"></div>
      <Music class="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
      <span class="font-medium text-[11px] text-zinc-200 truncate max-w-[130px] sm:max-w-[190px]">
        {audioEngine.currentMusicTrack?.title || 'Trilha Sonora'}
      </span>
    </button>

    <!-- On Hover Floating Bar with Full Soundtrack Controls (Seamless Hit Bridge with padding) -->
    {#if isHovered}
      <div class="absolute right-0 bottom-full pb-1 z-50 animate-in fade-in zoom-in-95 duration-100">
        <div class="flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-950/98 border border-amber-500/50 backdrop-blur-2xl shadow-2xl">
          <!-- Shuffle -->
          <button
            type="button"
            onclick={() => audioEngine.toggleShuffle()}
            class="p-1.5 rounded-lg transition cursor-pointer {audioEngine.isShuffle ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}"
            title={audioEngine.isShuffle ? 'Modo Aleatório Ativado' : 'Ativar Modo Aleatório (Shuffle)'}
          >
            <Shuffle class="w-3.5 h-3.5" />
          </button>

          <!-- Previous -->
          <button
            type="button"
            onclick={() => audioEngine.previousTrack()}
            class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition cursor-pointer"
            title="Música Anterior"
          >
            <SkipBack class="w-3.5 h-3.5" />
          </button>

          <!-- Play/Pause -->
          <button
            type="button"
            onclick={() => audioEngine.toggleMusic()}
            class="w-7 h-7 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold flex items-center justify-center hover:from-amber-400 hover:to-amber-300 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
            title={audioEngine.isPlayingMusic ? 'Pausar' : 'Reproduzir'}
          >
            {#if audioEngine.isPlayingMusic}
              <Pause class="w-3.5 h-3.5" />
            {:else}
              <Play class="w-3.5 h-3.5 ml-0.5" />
            {/if}
          </button>

          <!-- Next / Skip -->
          <button
            type="button"
            onclick={() => audioEngine.nextTrack()}
            class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition cursor-pointer"
            title="Próxima Música"
          >
            <SkipForward class="w-3.5 h-3.5" />
          </button>

          <!-- Loop -->
          <button
            type="button"
            onclick={() => audioEngine.toggleLoop()}
            class="p-1.5 rounded-lg transition cursor-pointer {audioEngine.isLoop ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}"
            title={audioEngine.isLoop ? 'Loop / Repetir Ativado' : 'Repetição Desativada'}
          >
            <Repeat class="w-3.5 h-3.5" />
          </button>

          <div class="w-px h-4 bg-zinc-800 mx-0.5"></div>

          <!-- Soundtrack Volume Slider (Apenas canal de trilha sonora) -->
          <div class="flex items-center gap-1.5 px-1.5">
            <Volume2 class="w-3.5 h-3.5 text-amber-400" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioEngine.musicVolume}
              oninput={(e) => audioEngine.setMusicVolume(parseFloat((e.target as HTMLInputElement).value))}
              class="w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              title={`Volume da Trilha Sonora: ${Math.round(audioEngine.musicVolume * 100)}%`}
            />
            <span class="text-[10px] text-zinc-400 font-mono w-6 text-right">
              {Math.round(audioEngine.musicVolume * 100)}%
            </span>
          </div>
        </div>
      </div>
    {/if}
  </div>
</footer>
