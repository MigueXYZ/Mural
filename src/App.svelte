<script lang="ts">
  import { appState } from './lib/stores/appState.svelte';
  import { campaignStore } from './lib/stores/campaignStore.svelte';
  import MainMenu from './lib/components/menu/MainMenu.svelte';
  import Header from './lib/components/layout/Header.svelte';
  import NavigationSidebar from './lib/components/layout/NavigationSidebar.svelte';
  import BottomTimeline from './lib/components/layout/BottomTimeline.svelte';
  import CanvasView from './lib/components/canvas/CanvasView.svelte';
  import AtlasView from './lib/components/atlas/AtlasView.svelte';
  import ThreatClocksPanel from './lib/components/clocks/ThreatClocksPanel.svelte';
  import LorePanel from './lib/components/lore/LorePanel.svelte';
  import CurrentSessionPanel from './lib/components/session/CurrentSessionPanel.svelte';
  import AiAssistantPanel from './lib/components/assistant/AiAssistantPanel.svelte';
  import AiSettingsModal from './lib/components/assistant/AiSettingsModal.svelte';
  import AudioPlayerWidget from './lib/components/audio/AudioPlayerWidget.svelte';
  import EditEntityModal from './lib/components/canvas/EditEntityModal.svelte';
  import EditEdgeModal from './lib/components/canvas/EditEdgeModal.svelte';
  import { FileText, Clock, BookOpen } from 'lucide-svelte';

  let activeRightTab = $state<'session' | 'clocks' | 'lore'>('session');

  const clocksCount = $derived((campaignStore.campaign.clocks || []).length);
  const loreCount = $derived((campaignStore.campaign.lore || []).length);
</script>

{#if appState.currentView === 'menu'}
  <MainMenu />
{:else}
  <div class="h-screen w-screen flex flex-col bg-[#0b0d11] text-zinc-100 overflow-hidden font-sans">
    <!-- Top App Bar -->
    <Header />

    <!-- Main Body -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Navigation Rail -->
      <NavigationSidebar />

      <!-- Central View Router (Graph Canvas vs Atlas Map) -->
      <main class="flex-1 relative overflow-hidden">
        {#if appState.activeTab === 'maps'}
          <AtlasView />
        {:else}
          <CanvasView />
        {/if}
      </main>

      <!-- Right Sidebar (Session Log, Clocks, Lore, Assistant) -->
      <aside class="w-80 border-l border-zinc-800/80 bg-zinc-950 flex flex-col justify-between overflow-y-auto z-20 select-none">
        <div class="flex flex-col flex-1 min-h-0">
          <!-- Sidebar Section Tabs -->
          <div class="flex items-center border-b border-zinc-800/80 bg-zinc-950 px-2 pt-2 gap-1 text-xs">
            <button
              onclick={() => (activeRightTab = 'session')}
              class="flex-1 py-1.5 px-2 rounded-t-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border-b-2 {activeRightTab ===
              'session'
                ? 'border-amber-400 text-amber-300 bg-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
            >
              <FileText class="w-3.5 h-3.5" />
              <span>Sessão</span>
            </button>

            <button
              onclick={() => (activeRightTab = 'clocks')}
              class="flex-1 py-1.5 px-2 rounded-t-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border-b-2 {activeRightTab ===
              'clocks'
                ? 'border-amber-400 text-amber-300 bg-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
            >
              <Clock class="w-3.5 h-3.5" />
              <span>Relógios</span>
              {#if clocksCount > 0}
                <span class="text-[9px] px-1 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {clocksCount}
                </span>
              {/if}
            </button>

            <button
              onclick={() => (activeRightTab = 'lore')}
              class="flex-1 py-1.5 px-2 rounded-t-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border-b-2 {activeRightTab ===
              'lore'
                ? 'border-amber-400 text-amber-300 bg-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
            >
              <BookOpen class="w-3.5 h-3.5" />
              <span>Lore</span>
              {#if loreCount > 0}
                <span class="text-[9px] px-1 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {loreCount}
                </span>
              {/if}
            </button>
          </div>

          <!-- Active Tab Content -->
          <div class="flex-1 overflow-y-auto min-h-0 flex flex-col">
            {#if activeRightTab === 'session'}
              <CurrentSessionPanel />
            {:else if activeRightTab === 'clocks'}
              <ThreatClocksPanel />
            {:else if activeRightTab === 'lore'}
              <LorePanel />
            {/if}
          </div>
        </div>

        <!-- AI Session Assistant at bottom -->
        <AiAssistantPanel />
      </aside>
    </div>

    <!-- Bottom Session Timeline -->
    <BottomTimeline />

    <!-- Floating Audio & Ambience Player Widget -->
    <AudioPlayerWidget />
  </div>

  <!-- Settings Modal when requested -->
  <AiSettingsModal bind:isOpen={appState.isSettingsOpen} />

  <!-- Global Entity & Edge Editing Modals (accessible from Canvas, Atlas Map, Spotlight Search) -->
  <EditEntityModal />
  <EditEdgeModal />
{/if}
