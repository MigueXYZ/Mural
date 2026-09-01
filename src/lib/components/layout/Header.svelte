<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { appState } from '../../stores/appState.svelte';
  import {
    Search,
    Plus,
    ArrowLeft,
    Download,
    Save,
    Check,
    Loader2,
    CircleDot,
    Undo2,
    Redo2,
  } from 'lucide-svelte';

  import { get } from 'svelte/store';
  import { getEntityIcon } from '../../utils/icons';
  import {
    X,
    Clock,
    MapPin as MapPinIcon,
    FileText,
    Dices,
  } from 'lucide-svelte';

  let isModalOpen = $state(false);
  let noteText = $state('');
  let currentTime = $state(Date.now());
  let timeInterval: ReturnType<typeof setInterval> | null = null;
  let searchInputRef: HTMLInputElement | null = $state(null);
  let isSearchFocused = $state(false);

  const searchResults = $derived.by(() => {
    const q = campaignStore.searchQuery.trim().toLowerCase();
    if (!q) return null;

    const allNodes = get(campaignStore.nodes);
    const matchedNodes = allNodes
      .filter((n) => {
        const title = (n.data?.title || '').toLowerCase();
        const subtitle = (n.data?.subtitle || '').toLowerCase();
        const desc = (n.data?.description || '').toLowerCase();
        const tags = Array.isArray(n.data?.tags) ? n.data.tags.join(' ').toLowerCase() : '';
        return title.includes(q) || subtitle.includes(q) || desc.includes(q) || tags.includes(q);
      })
      .slice(0, 6);

    const matchedLore = (campaignStore.campaign.lore || [])
      .filter((l) => (l.title || '').toLowerCase().includes(q) || (l.content || '').toLowerCase().includes(q))
      .slice(0, 4);

    const matchedClocks = (campaignStore.campaign.clocks || [])
      .filter((c) => (c.title || '').toLowerCase().includes(q))
      .slice(0, 3);

    const matchedPins = (campaignStore.campaign.maps?.[0]?.pins || [])
      .filter((p) => p.label.toLowerCase().includes(q))
      .slice(0, 3);

    const totalMatches = matchedNodes.length + matchedLore.length + matchedClocks.length + matchedPins.length;

    return {
      nodes: matchedNodes,
      lore: matchedLore,
      clocks: matchedClocks,
      pins: matchedPins,
      total: totalMatches,
    };
  });

  onMount(() => {
    timeInterval = setInterval(() => {
      currentTime = Date.now();
    }, 10000);
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
  });

  const saveStatusText = $derived.by(() => {
    if (campaignStore.isSaving) {
      return 'Salvando...';
    }
    if (campaignStore.isDirty) {
      return 'Modificado';
    }
    if (!campaignStore.lastSavedAt) {
      return 'Salvo';
    }
    const elapsedSec = Math.floor((currentTime - campaignStore.lastSavedAt) / 1000);
    if (elapsedSec < 10) {
      return 'Salvo agora';
    }
    if (elapsedSec < 60) {
      return 'Salvo há segundos';
    }
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) {
      return `Salvo há ${elapsedMin} min`;
    }
    return `Salvo às ${new Date(campaignStore.lastSavedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  });

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    // Ctrl+K: Focus Search Input
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInputRef?.focus();
      return;
    }

    // Escape: Clear search / blur
    if (e.key === 'Escape' && isSearchFocused) {
      isSearchFocused = false;
      campaignStore.searchQuery = '';
      searchInputRef?.blur();
      return;
    }

    // Ctrl+S: Manual Save
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      campaignStore.saveCurrentCampaign();
      return;
    }

    // Ctrl+Z / Ctrl+Y: Undo / Redo
    if ((e.ctrlKey || e.metaKey) && !isInput) {
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        campaignStore.undo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        campaignStore.redo();
      }
    }
  }

  function handleQuickNote() {
    if (noteText.trim()) {
      campaignStore.addLoreEntry(noteText.trim(), 'SEGREDO');
      noteText = '';
      isModalOpen = false;
    }
  }

  function handleSelectNode(nodeData: any) {
    campaignStore.selectedEntity = nodeData;
    appState.activeTab = 'board';
    isSearchFocused = false;
  }

  function handleSelectLore(entry: any) {
    appState.activeTab = 'board';
    campaignStore.searchQuery = entry.title || '';
    isSearchFocused = false;
  }

  function handleSelectPin(pin: any) {
    appState.activeTab = 'maps';
    isSearchFocused = false;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="h-14 border-b border-zinc-800/80 bg-zinc-950/90 px-4 flex items-center justify-between select-none backdrop-blur-md z-20 sticky top-0">
  <!-- Left info & Return to menu -->
  <div class="flex items-center gap-3">
    <button
      onclick={() => appState.returnToMenu()}
      title="Voltar ao Menu Principal"
      class="h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 flex items-center gap-1.5 text-xs font-medium transition cursor-pointer active:scale-95"
    >
      <ArrowLeft class="w-3.5 h-3.5" />
      <span>Menu</span>
    </button>

    <div class="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm shadow-inner">
      O
    </div>
    
    <div class="flex items-baseline gap-2 max-w-sm sm:max-w-md truncate">
      <h1 class="text-sm sm:text-base font-semibold text-zinc-100 tracking-wide truncate">
        {campaignStore.campaign.name}
      </h1>
      <span class="text-xs text-zinc-400 font-normal shrink-0">
        Sessão {campaignStore.campaign.currentSession}
      </span>
      <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono shrink-0 hidden sm:inline-block">
        {campaignStore.campaign.system}
      </span>
    </div>
  </div>

  <!-- Center Search & Undo / Redo Control Bar -->
  <div class="flex items-center gap-3">
    <!-- Undo / Redo Buttons -->
    <div class="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-0.5">
      <button
        type="button"
        onclick={() => campaignStore.undo()}
        disabled={!campaignStore.canUndo}
        title="Desfazer (Ctrl+Z)"
        class="h-7 w-7 rounded-md text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:text-zinc-400 disabled:hover:bg-transparent flex items-center justify-center transition cursor-pointer"
      >
        <Undo2 class="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onclick={() => campaignStore.redo()}
        disabled={!campaignStore.canRedo}
        title="Refazer (Ctrl+Y ou Ctrl+Shift+Z)"
        class="h-7 w-7 rounded-md text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:text-zinc-400 disabled:hover:bg-transparent flex items-center justify-center transition cursor-pointer"
      >
        <Redo2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Interactive Search Bar & Spotlight (US 144) -->
    <div class="w-64 sm:w-80 relative hidden md:block">
      <Search class="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        type="text"
        bind:this={searchInputRef}
        placeholder="Procurar NPC, local, pista... (Ctrl+K)"
        bind:value={campaignStore.searchQuery}
        onfocus={() => (isSearchFocused = true)}
        class="w-full h-8 pl-9 pr-8 rounded-lg bg-zinc-900/90 border border-zinc-800/80 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition"
      />
      {#if campaignStore.searchQuery}
        <button
          type="button"
          onclick={() => { campaignStore.searchQuery = ''; searchInputRef?.focus(); }}
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 p-0.5 rounded cursor-pointer"
        >
          <X class="w-3 h-3" />
        </button>
      {/if}

      <!-- Search Spotlight Dropdown -->
      {#if isSearchFocused && searchResults}
        <!-- Backdrop to close -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onclick={() => (isSearchFocused = false)}
          class="fixed inset-0 z-30 cursor-default"
        ></div>

        <div class="absolute left-0 top-full mt-2 w-96 max-h-[460px] overflow-y-auto rounded-2xl bg-zinc-900 border border-zinc-700/90 shadow-2xl p-2.5 z-40 space-y-3 animate-in fade-in zoom-in-95 duration-100 text-xs">
          {#if searchResults.total === 0}
            <div class="py-6 text-center text-zinc-500 italic">
              Nenhum resultado encontrado para "{campaignStore.searchQuery}"
            </div>
          {:else}
            <!-- Entities / Nodes Category -->
            {#if searchResults.nodes.length > 0}
              <div class="space-y-1">
                <div class="text-[10px] font-bold text-zinc-500 uppercase px-2 py-0.5 tracking-wider">
                  Mural ({searchResults.nodes.length})
                </div>
                {#each searchResults.nodes as n}
                  {@const IconComp = getEntityIcon(n.data?.icon, n.data?.type || n.data?.category)}
                  <button
                    type="button"
                    onclick={() => handleSelectNode(n.data)}
                    class="w-full p-2 rounded-xl text-left flex items-center justify-between hover:bg-zinc-800 transition cursor-pointer group"
                  >
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div
                        class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style="background-color: {n.data?.color || '#d4a359'}20; color: {n.data?.color || '#d4a359'};"
                      >
                        <IconComp class="w-3.5 h-3.5" />
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs font-semibold text-zinc-100 truncate group-hover:text-amber-300">
                          {n.data?.title || 'Sem título'}
                        </div>
                        <div class="text-[10px] text-zinc-500 truncate">
                          {n.data?.subtitle || n.data?.type?.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 uppercase font-mono">
                      {n.data?.type || 'Nó'}
                    </span>
                  </button>
                {/each}
              </div>
            {/if}

            <!-- Lore Entries Category -->
            {#if searchResults.lore.length > 0}
              <div class="space-y-1 border-t border-zinc-800/80 pt-2">
                <div class="text-[10px] font-bold text-zinc-500 uppercase px-2 py-0.5 tracking-wider">
                  Lore & Pistas ({searchResults.lore.length})
                </div>
                {#each searchResults.lore as entry}
                  <button
                    type="button"
                    onclick={() => handleSelectLore(entry)}
                    class="w-full p-2 rounded-xl text-left flex items-center justify-between hover:bg-zinc-800 transition cursor-pointer group"
                  >
                    <div class="flex items-center gap-2.5 min-w-0">
                      <FileText class="w-4 h-4 text-emerald-400 shrink-0" />
                      <div class="min-w-0">
                        <div class="text-xs font-medium text-zinc-100 truncate group-hover:text-amber-300">
                          {entry.title}
                        </div>
                        <div class="text-[10px] text-zinc-500 truncate">
                          {entry.content}
                        </div>
                      </div>
                    </div>
                    <span class="text-[10px] px-1.5 py-0.5 rounded {entry.visibility === 'SEGREDO' ? 'bg-rose-950/60 text-rose-300 border border-rose-800' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'} uppercase font-mono">
                      {entry.visibility}
                    </span>
                  </button>
                {/each}
              </div>
            {/if}

            <!-- Threat Clocks Category -->
            {#if searchResults.clocks.length > 0}
              <div class="space-y-1 border-t border-zinc-800/80 pt-2">
                <div class="text-[10px] font-bold text-zinc-500 uppercase px-2 py-0.5 tracking-wider">
                  Relógios de Ameaça ({searchResults.clocks.length})
                </div>
                {#each searchResults.clocks as clock}
                  <div class="w-full p-2 rounded-xl text-left flex items-center justify-between bg-zinc-950/60 border border-zinc-800">
                    <div class="flex items-center gap-2 min-w-0">
                      <Clock class="w-4 h-4 text-amber-400 shrink-0" />
                      <div class="min-w-0">
                        <div class="text-xs font-medium text-zinc-100 truncate">{clock.title}</div>
                        <div class="text-[10px] text-zinc-500 truncate">{clock.filledSegments}/{clock.totalSegments} segmentos</div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Map Pins Category -->
            {#if searchResults.pins.length > 0}
              <div class="space-y-1 border-t border-zinc-800/80 pt-2">
                <div class="text-[10px] font-bold text-zinc-500 uppercase px-2 py-0.5 tracking-wider">
                  Atlas & Mapa ({searchResults.pins.length})
                </div>
                {#each searchResults.pins as pin}
                  <button
                    type="button"
                    onclick={() => handleSelectPin(pin)}
                    class="w-full p-2 rounded-xl text-left flex items-center gap-2 hover:bg-zinc-800 transition cursor-pointer"
                  >
                    <MapPinIcon class="w-4 h-4 text-sky-400 shrink-0" />
                    <span class="text-xs font-medium text-zinc-100 truncate">{pin.label || 'Marcador do Mapa'}</span>
                  </button>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Right Actions & Auto-Save Indicator -->
  <div class="flex items-center gap-2.5">
    <!-- Auto-Save Status Badge -->
    <div
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors duration-200 {campaignStore.isSaving
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        : campaignStore.isDirty
        ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
        : 'bg-zinc-900/80 border-zinc-800 text-zinc-400'}"
      title={campaignStore.isDirty ? 'Alterações não guardadas (Autosave em 500ms ou premir Ctrl+S)' : 'Todas as alterações guardadas localmente'}
    >
      {#if campaignStore.isSaving}
        <Loader2 class="w-3.5 h-3.5 animate-spin text-amber-400" />
      {:else if campaignStore.isDirty}
        <CircleDot class="w-3.5 h-3.5 text-amber-400 animate-pulse" />
      {:else}
        <Check class="w-3.5 h-3.5 text-emerald-400" />
      {/if}
      <span class="font-mono text-[11px] font-medium hidden sm:inline">
        {saveStatusText}
      </span>
    </div>

    <!-- Manual Save Button -->
    <button
      onclick={() => campaignStore.saveCurrentCampaign()}
      disabled={campaignStore.isSaving}
      title="Guardar Agora (Ctrl+S)"
      class="h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-amber-500/40 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
    >
      <Save class="w-3.5 h-3.5 text-zinc-400" />
      <span class="hidden lg:inline">Guardar</span>
    </button>

    <!-- Export Button -->
    <button
      onclick={() => appState.exportCampaign(campaignStore.campaign.id)}
      title="Exportar Campanha (.mural)"
      class="h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
    >
      <Download class="w-3.5 h-3.5 text-zinc-400" />
      <span class="hidden xl:inline">Exportar</span>
    </button>

    <!-- Quick Note Button -->
    <button
      onclick={() => (isModalOpen = !isModalOpen)}
      class="h-8 px-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400/60 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
    >
      <Plus class="w-3.5 h-3.5" />
      <span>Nota rápida</span>
    </button>
  </div>
</header>

<!-- Quick Note Modal -->
{#if isModalOpen}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
    <div class="w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-amber-400"></span> Adicionar Nota Rápida
        </h3>
        <button onclick={() => (isModalOpen = false)} class="text-xs text-zinc-400 hover:text-zinc-200">✕</button>
      </div>
      <textarea
        bind:value={noteText}
        placeholder="Escreve uma nota de lore, segredo ou acontecimento..."
        class="w-full h-24 p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
      ></textarea>
      <div class="flex justify-end gap-2">
        <button
          onclick={() => (isModalOpen = false)}
          class="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 transition"
        >
          Cancelar
        </button>
        <button
          onclick={handleQuickNote}
          class="px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-medium transition active:scale-95"
        >
          Guardar Nota
        </button>
      </div>
    </div>
  </div>
{/if}
