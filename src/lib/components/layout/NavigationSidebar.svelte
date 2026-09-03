<script lang="ts">
  import { appState } from '../../stores/appState.svelte';
  import { audioEngine } from '../../services/audio/audioEngine.svelte';
  import { LayoutGrid, Map, Settings, Music, Swords } from 'lucide-svelte';

  const navItems = [
    { id: 'board' as const, label: 'Quadro de Relações (Mural)', icon: LayoutGrid },
    { id: 'maps' as const, label: 'Mapas & Atlas', icon: Map },
    { id: 'vtt' as const, label: 'Mesa Tática (VTT)', icon: Swords },
  ];
</script>

<aside class="w-14 border-r border-zinc-800/80 bg-zinc-950 flex flex-col items-center justify-between py-4 select-none z-20">
  <div class="flex flex-col items-center gap-2">
    {#each navItems as item}
      {@const Icon = item.icon}
      <button
        onclick={() => (appState.activeTab = item.id)}
        title={item.label}
        class="w-10 h-10 rounded-lg flex items-center justify-center transition cursor-pointer {appState.activeTab === item.id
          ? 'bg-zinc-800/90 text-amber-400 border border-zinc-700/60 shadow-sm'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}"
      >
        <Icon class="w-4 h-4" />
      </button>
    {/each}
  </div>

  <div class="flex flex-col items-center gap-2">
    <!-- Music & Soundboard Popup Toggle Button -->
    <button
      onclick={() => (audioEngine.isPopupOpen = !audioEngine.isPopupOpen)}
      title="Música & Ambiência Sonora"
      class="w-10 h-10 rounded-lg flex items-center justify-center transition cursor-pointer relative {audioEngine.isPopupOpen
        ? 'bg-zinc-800/90 text-amber-400 border border-zinc-700/60 shadow-sm'
        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}"
    >
      <Music class="w-4 h-4" />
      {#if audioEngine.isPlayingMusic || audioEngine.isPlayingAmbience}
        <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
      {/if}
    </button>

    <!-- Settings Hub Button -->
    <button
      onclick={() => (appState.isSettingsOpen = !appState.isSettingsOpen)}
      title="Definições da Campanha & App"
      class="w-10 h-10 rounded-lg flex items-center justify-center transition cursor-pointer {appState.isSettingsOpen
        ? 'bg-zinc-800/90 text-amber-400 border border-zinc-700/60 shadow-sm'
        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}"
    >
      <Settings class="w-4 h-4" />
    </button>
  </div>
</aside>
