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
  import CalendarModal from './lib/components/calendar/CalendarModal.svelte';
  import CalendarConfigModal from './lib/components/calendar/CalendarConfigModal.svelte';
  import OrdoLivePanel from './lib/components/ordo/OrdoLivePanel.svelte';
  import OrdoRoomModal from './lib/components/ordo/OrdoRoomModal.svelte';
  import { ordoP2P } from './lib/services/p2p/ordoP2PService.svelte';
  import { storageService } from './lib/services/storage';
  import PlayerVttView from './lib/components/vtt/PlayerVttView.svelte';
  import GmVttPanel from './lib/components/vtt/GmVttPanel.svelte';
  import { FileText, Clock, BookOpen, Radio } from 'lucide-svelte';

  let activeRightTab = $state<'session' | 'clocks' | 'lore' | 'ordo'>('session');

  const clocksCount = $derived((campaignStore.campaign.clocks || []).length);
  const loreCount = $derived((campaignStore.campaign.lore || []).length);
  const ordoCount = $derived(ordoP2P.characters.length);

  // Environment Sandboxing (Requirement R2):
  // Browser is strictly locked to Player-Only VTT mode (unless developer overrides with ?mode=gm).
  const isPlayerOnlyBrowser = $derived.by(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'gm') return false;
    if (params.get('mode') === 'player' || params.get('player') === '1') return true;
    return !storageService.isTauri();
  });
</script>

{#if isPlayerOnlyBrowser}
  <!-- Strict Web / Browser Player-Only Client Mode (Requirement R2) -->
  <PlayerVttView />
{:else if appState.currentView === 'menu'}
  <MainMenu />
{:else}
  <div class="h-screen w-screen flex flex-col bg-[#0b0d11] text-zinc-100 overflow-hidden font-sans">
    <!-- Top App Bar -->
    <Header />

    <!-- Main Body -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Navigation Rail -->
      <NavigationSidebar />

      <!-- Central View Router (Graph Canvas vs Atlas Map vs Mesa Tática VTT) -->
      <main class="flex-1 relative overflow-hidden">
        {#if appState.activeTab === 'maps'}
          <AtlasView />
        {:else if appState.activeTab === 'vtt'}
          <GmVttPanel />
        {:else}
          <CanvasView />
        {/if}
      </main>

      <!-- Right Sidebar (Session Log, Clocks, Lore, Ordo, Assistant) -->
      <aside class="w-80 border-l border-zinc-800/80 bg-zinc-950 flex flex-col justify-between overflow-y-auto z-20 select-none">
        <div class="flex flex-col flex-1 min-h-0">
          <!-- Sidebar Section Tabs -->
          <div class="flex items-center border-b border-zinc-800/80 bg-zinc-950 px-2 pt-2 gap-0.5 text-xs">
            <button
              onclick={() => (activeRightTab = 'session')}
              class="flex-1 py-1.5 px-1.5 rounded-t-lg font-semibold flex items-center justify-center gap-1 transition cursor-pointer border-b-2 {activeRightTab ===
              'session'
                ? 'border-amber-400 text-amber-300 bg-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
            >
              <FileText class="w-3.5 h-3.5" />
              <span class="text-[11px]">Sessão</span>
            </button>

            <button
              onclick={() => (activeRightTab = 'clocks')}
              class="flex-1 py-1.5 px-1.5 rounded-t-lg font-semibold flex items-center justify-center gap-1 transition cursor-pointer border-b-2 {activeRightTab ===
              'clocks'
                ? 'border-amber-400 text-amber-300 bg-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
            >
              <Clock class="w-3.5 h-3.5" />
              <span class="text-[11px]">Relógios</span>
              {#if clocksCount > 0}
                <span class="text-[9px] px-1 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {clocksCount}
                </span>
              {/if}
            </button>

            <button
              onclick={() => (activeRightTab = 'lore')}
              class="flex-1 py-1.5 px-1.5 rounded-t-lg font-semibold flex items-center justify-center gap-1 transition cursor-pointer border-b-2 {activeRightTab ===
              'lore'
                ? 'border-amber-400 text-amber-300 bg-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
            >
              <BookOpen class="w-3.5 h-3.5" />
              <span class="text-[11px]">Lore</span>
              {#if loreCount > 0}
                <span class="text-[9px] px-1 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {loreCount}
                </span>
              {/if}
            </button>

            <button
              onclick={() => (activeRightTab = 'ordo')}
              class="flex-1 py-1.5 px-1.5 rounded-t-lg font-semibold flex items-center justify-center gap-1 transition cursor-pointer border-b-2 {activeRightTab ===
              'ordo'
                ? 'border-cyan-400 text-cyan-300 bg-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
            >
              <Radio class="w-3.5 h-3.5 {ordoP2P.isOpen ? 'text-cyan-400' : ''}" />
              <span class="text-[11px]">Ordo</span>
              {#if ordoCount > 0}
                <span class="text-[9px] px-1 rounded bg-cyan-950 text-cyan-300 font-mono">
                  {ordoCount}
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
            {:else if activeRightTab === 'ordo'}
              <OrdoLivePanel />
            {/if}
          </div>
        </div>

        <!-- AI Session Assistant at bottom -->
        <AiAssistantPanel />
      </aside>
    </div>

    <!-- Bottom Session Timeline -->
    <BottomTimeline />
  </div>

  <!-- Settings Modal when requested -->
  <AiSettingsModal bind:isOpen={appState.isSettingsOpen} />

  <!-- Global Entity & Edge Editing Modals (accessible from Canvas, Atlas Map, Spotlight Search) -->
  <EditEntityModal />
  <EditEdgeModal />

  <!-- Global Custom Calendar Modals (US 154) -->
  <CalendarModal />
  <CalendarConfigModal />

  <!-- Ordo P2P Room Modal (US 155) -->
  <OrdoRoomModal />
{/if}

<!-- Floating Audio & Ambience Player Widget (Global for Main Menu and Campaign Views - US 153) -->
<AudioPlayerWidget />
