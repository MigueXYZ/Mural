<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import MapPinItem from './MapPinItem.svelte';
  import CreatePinModal from './CreatePinModal.svelte';
  import MapModal from './MapModal.svelte';
  import {
    Map as MapIcon,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Plus,
    Pencil,
    Trash2,
    ChevronDown,
    Check,
    MapPin as PinIcon,
    AlertTriangle,
  } from 'lucide-svelte';
  import type { MapData } from '../../types';

  let zoom = $state(1.0);
  let pan = $state({ x: 0, y: 0 });
  let isDragging = $state(false);
  let dragStart = $state({ x: 0, y: 0 });

  let isPinModalOpen = $state(false);
  let clickedCoords = $state({ xPercent: 50, yPercent: 50 });

  let isMapModalOpen = $state(false);
  let mapModalMode = $state<'create' | 'edit'>('create');
  let isMapDropdownOpen = $state(false);
  let isDeleteConfirmOpen = $state(false);

  let mapContainer: HTMLDivElement | undefined = $state();

  const maps = $derived<MapData[]>(campaignStore.campaign.maps || []);

  const activeMap = $derived<MapData | null>(
    maps.length > 0
      ? maps.find((m) => m.id === campaignStore.activeMapId) || maps[0]
      : null
  );

  // Sync activeMapId if it was not set or out of sync
  $effect(() => {
    if (activeMap && campaignStore.activeMapId !== activeMap.id) {
      campaignStore.setActiveMap(activeMap.id);
    }
  });

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoom = Math.max(0.4, Math.min(3.0, zoom * factor));
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 0 && !(e.target as HTMLElement).closest('.map-pin-marker')) {
      isDragging = true;
      dragStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (isDragging) {
      pan = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      };
    }
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function handleMapDoubleClick(e: MouseEvent) {
    if (!mapContainer || !activeMap) return;
    const rect = mapContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, (clickY / rect.height) * 100));

    clickedCoords = { xPercent, yPercent };
    isPinModalOpen = true;
  }

  function openAddPin() {
    clickedCoords = { xPercent: 50, yPercent: 50 };
    isPinModalOpen = true;
  }

  function handlePinCreated(data: {
    targetNodeId: string;
    label?: string;
    xPercent: number;
    yPercent: number;
    color?: string;
    notes?: string;
  }) {
    if (!activeMap) return;
    campaignStore.addMapPin(activeMap.id, {
      targetNodeId: data.targetNodeId,
      label: data.label || 'Ponto de Interesse',
      xPercent: data.xPercent,
      yPercent: data.yPercent,
      color: data.color,
      notes: data.notes,
    });
  }

  function handleDeletePin(pinId: string) {
    if (!activeMap) return;
    campaignStore.deleteMapPin(activeMap.id, pinId);
  }

  function selectMap(mapId: string) {
    campaignStore.setActiveMap(mapId);
    isMapDropdownOpen = false;
    resetView();
  }

  function handleDeleteActiveMap() {
    if (!activeMap) return;
    campaignStore.deleteMap(activeMap.id);
    isDeleteConfirmOpen = false;
    resetView();
  }

  function resetView() {
    zoom = 1.0;
    pan = { x: 0, y: 0 };
  }
</script>

{#if !activeMap}
  <!-- Empty State (No maps in campaign) -->
  <div class="relative w-full h-full bg-[#0b0d11] overflow-hidden select-none flex flex-col items-center justify-center p-6 text-center">
    <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10 animate-in zoom-in-95 duration-200">
      <MapIcon class="w-8 h-8" />
    </div>
    <h2 class="text-base font-semibold text-zinc-100 mb-1">Nenhum Mapa no Atlas</h2>
    <p class="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
      Adicione mapas das suas regiões, cidades, masmorras ou edifícios para posicionar marcadores de exploração interativos e vincular às notas do seu Mural.
    </p>
    <button
      onclick={() => { mapModalMode = 'create'; isMapModalOpen = true; }}
      class="px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center gap-2 transition active:scale-95 shadow-md cursor-pointer"
    >
      <Plus class="w-4 h-4" />
      <span>Adicionar Primeiro Mapa</span>
    </button>
  </div>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="relative w-full h-full bg-[#0b0d11] overflow-hidden select-none cursor-grab active:cursor-grabbing flex items-center justify-center"
    onwheel={handleWheel}
    onmousedown={handleMouseDown}
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    role="region"
    aria-label="Interactive Atlas Map View"
  >
    <!-- Map Image & Pins Container -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={mapContainer}
      ondblclick={handleMapDoubleClick}
      class="relative transition-transform duration-75 shadow-2xl rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950 w-fit h-fit max-w-[90vw] max-h-[84vh] flex items-center justify-center select-none"
      style="transform: translate({pan.x}px, {pan.y}px) scale({zoom});"
    >
      <img
        src={activeMap.imageUrl}
        alt={activeMap.title}
        draggable="false"
        class="block max-w-[90vw] max-h-[84vh] w-auto h-auto object-contain pointer-events-none filter brightness-90 contrast-105"
      />

      <!-- Render Map Pins -->
      {#each activeMap.pins || [] as pin (pin.id)}
        <div class="map-pin-marker">
          <MapPinItem {pin} mapId={activeMap.id} onDelete={handleDeletePin} />
        </div>
      {/each}

      <!-- Double-click hint -->
      <div class="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 backdrop-blur-xs pointer-events-none">
        Duplo clique para adicionar marcador
      </div>
    </div>

    <!-- Top Left: Map Switcher & Map Actions -->
    <div class="absolute top-4 left-4 flex items-center gap-2 z-20">
      <!-- Map Switcher Dropdown Button -->
      <div class="relative">
        <button
          type="button"
          onclick={() => (isMapDropdownOpen = !isMapDropdownOpen)}
          class="bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-xl flex items-center gap-2.5 transition cursor-pointer text-left"
        >
          <MapIcon class="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div class="max-w-[160px] sm:max-w-[220px]">
            <h3 class="text-xs font-semibold text-zinc-100 truncate">{activeMap.title || activeMap.name || 'Mapa'}</h3>
            <p class="text-[10px] text-zinc-400 truncate">{(activeMap.pins || []).length} marcadores · {maps.length} {maps.length === 1 ? 'mapa' : 'mapas'}</p>
          </div>
          <ChevronDown class="w-3.5 h-3.5 text-zinc-400 ml-1 transition-transform {isMapDropdownOpen ? 'rotate-180' : ''}" />
        </button>

        <!-- Dropdown Menu -->
        {#if isMapDropdownOpen}
          <button
            type="button"
            class="fixed inset-0 z-30 cursor-default bg-transparent border-0"
            onclick={() => (isMapDropdownOpen = false)}
            aria-label="Fechar menu de mapas"
          ></button>
          <div class="absolute top-full left-0 mt-1.5 w-64 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl p-1.5 z-40 backdrop-blur-md space-y-1 animate-in fade-in zoom-in-95 duration-100">
            <div class="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Mapas da Campanha
            </div>
            <div class="max-h-60 overflow-y-auto space-y-0.5">
              {#each maps as m (m.id)}
                <button
                  type="button"
                  onclick={() => selectMap(m.id)}
                  class="w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left transition cursor-pointer {m.id === activeMap.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium'
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'}"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-5 h-5 rounded overflow-hidden bg-zinc-950 flex-shrink-0 border border-zinc-800 flex items-center justify-center">
                      {#if m.imageUrl}
                        <img src={m.imageUrl} alt="" class="w-full h-full object-cover" />
                      {:else}
                        <MapIcon class="w-3 h-3 text-zinc-500" />
                      {/if}
                    </div>
                    <span class="text-xs truncate">{m.title || m.name || 'Mapa'}</span>
                  </div>
                  <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <span class="text-[10px] text-zinc-500 font-mono">{(m.pins || []).length}</span>
                    {#if m.id === activeMap.id}
                      <Check class="w-3.5 h-3.5 text-amber-400" />
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
            <div class="pt-1 border-t border-zinc-800">
              <button
                type="button"
                onclick={() => { mapModalMode = 'create'; isMapModalOpen = true; isMapDropdownOpen = false; }}
                class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-amber-500/20 text-zinc-300 hover:text-amber-300 border border-zinc-700/60 hover:border-amber-500/40 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Adicionar Novo Mapa</span>
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- Quick Map Action Buttons -->
      <div class="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl backdrop-blur-md shadow-xl">
        <button
          type="button"
          onclick={() => { mapModalMode = 'create'; isMapModalOpen = true; }}
          title="Adicionar Novo Mapa"
          class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 flex items-center justify-center transition cursor-pointer"
        >
          <Plus class="w-4 h-4" />
        </button>
        <button
          type="button"
          onclick={() => { mapModalMode = 'edit'; isMapModalOpen = true; }}
          title="Editar Nome e Imagem do Mapa"
          class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
        >
          <Pencil class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onclick={() => (isDeleteConfirmOpen = true)}
          title="Remover Mapa Atual"
          class="w-8 h-8 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition cursor-pointer"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Top Right: Actions & Zoom Controls -->
    <div class="absolute top-4 right-4 flex items-center gap-2 z-20">
      <button
        type="button"
        onclick={openAddPin}
        title="Adicionar Marcador no Centro do Mapa"
        class="h-9 px-3 rounded-xl bg-zinc-900/90 hover:bg-amber-500/20 border border-zinc-800 hover:border-amber-500/50 text-zinc-300 hover:text-amber-300 backdrop-blur-md shadow-xl flex items-center gap-1.5 text-xs font-medium transition cursor-pointer active:scale-95"
      >
        <PinIcon class="w-3.5 h-3.5 text-amber-400" />
        <span>+ Marcador</span>
      </button>

      <div class="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl backdrop-blur-md shadow-xl">
        <button
          type="button"
          onclick={() => (zoom = Math.min(3.0, zoom * 1.2))}
          title="Aumentar Zoom"
          class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
        >
          <ZoomIn class="w-4 h-4" />
        </button>
        <span class="text-[11px] font-mono text-zinc-400 px-1 select-none min-w-[38px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onclick={() => (zoom = Math.max(0.4, zoom / 1.2))}
          title="Diminuir Zoom"
          class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
        >
          <ZoomOut class="w-4 h-4" />
        </button>
        <div class="w-[1px] h-4 bg-zinc-800 my-auto"></div>
        <button
          type="button"
          onclick={resetView}
          title="Repor Vista Original"
          class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
        >
          <RotateCcw class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal to create pin -->
<CreatePinModal
  bind:isOpen={isPinModalOpen}
  xPercent={clickedCoords.xPercent}
  yPercent={clickedCoords.yPercent}
  onPinCreated={handlePinCreated}
/>

<!-- Modal to create or edit map -->
<MapModal
  bind:isOpen={isMapModalOpen}
  mode={mapModalMode}
  mapToEdit={mapModalMode === 'edit' ? activeMap : null}
/>

<!-- Delete Map Confirmation Modal -->
{#if isDeleteConfirmOpen && activeMap}
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="w-full max-w-sm bg-zinc-900 border border-zinc-700/80 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
          <AlertTriangle class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-zinc-100">Remover Mapa?</h3>
          <p class="text-xs text-zinc-400 mt-0.5">Esta ação não pode ser desfeita.</p>
        </div>
      </div>
      <p class="text-xs text-zinc-300 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800 leading-relaxed">
        Tem a certeza que deseja remover o mapa <strong class="text-amber-300">"{activeMap.title || activeMap.name}"</strong>? Os <strong class="text-zinc-100">{activeMap.pins?.length || 0} marcadores</strong> associados a este mapa serão eliminados.
      </p>
      <div class="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onclick={() => (isDeleteConfirmOpen = false)}
          class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onclick={handleDeleteActiveMap}
          class="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition active:scale-95 shadow-md cursor-pointer"
        >
          Remover Mapa
        </button>
      </div>
    </div>
  </div>
{/if}
