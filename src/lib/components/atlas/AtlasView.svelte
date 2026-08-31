<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import MapPinItem from './MapPinItem.svelte';
  import CreatePinModal from './CreatePinModal.svelte';
  import {
    Map as MapIcon,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Plus,
    Layers,
    Image as ImageIcon,
  } from 'lucide-svelte';
  import type { MapData, MapPin } from '../../types';

  let zoom = $state(1.0);
  let pan = $state({ x: 0, y: 0 });
  let isDragging = $state(false);
  let dragStart = $state({ x: 0, y: 0 });

  let isPinModalOpen = $state(false);
  let clickedCoords = $state({ xPercent: 50, yPercent: 50 });

  let mapContainer: HTMLDivElement;

  const defaultMap: MapData = {
    id: 'default-map',
    title: 'Mapa da Província',
    imageUrl: 'https://images.unsplash.com/photo-1524654458049-e36be0721fa2?auto=format&fit=crop&w=1600&q=80',
    pins: [
      {
        id: 'pin-1',
        targetNodeId: 'npc-serah',
        xPercent: 42.5,
        yPercent: 38.0,
        label: 'Taverna de Vallenmoor',
      },
      {
        id: 'pin-2',
        targetNodeId: 'secret-poco',
        xPercent: 68.0,
        yPercent: 55.2,
        label: 'O Poço Selado',
      },
    ],
  };

  const activeMap = $derived<MapData>(
    campaignStore.campaign.maps && campaignStore.campaign.maps.length > 0
      ? campaignStore.campaign.maps[0]
      : defaultMap
  );

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
    if (!mapContainer) return;
    const rect = mapContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, (clickY / rect.height) * 100));

    clickedCoords = { xPercent, yPercent };
    isPinModalOpen = true;
  }

  function handlePinCreated(data: { targetNodeId: string; label?: string; xPercent: number; yPercent: number }) {
    const newPin: MapPin = {
      id: `pin-${Date.now()}`,
      targetNodeId: data.targetNodeId,
      label: data.label || '',
      xPercent: data.xPercent,
      yPercent: data.yPercent,
    };

    if (!campaignStore.campaign.maps || campaignStore.campaign.maps.length === 0) {
      campaignStore.campaign.maps = [{ ...defaultMap, pins: [newPin] }];
    } else {
      campaignStore.campaign.maps[0].pins = [...(campaignStore.campaign.maps[0].pins || []), newPin];
    }
    campaignStore.markDirty();
  }

  function handleDeletePin(pinId: string) {
    if (campaignStore.campaign.maps && campaignStore.campaign.maps.length > 0) {
      campaignStore.campaign.maps[0].pins = campaignStore.campaign.maps[0].pins.filter((p) => p.id !== pinId);
      campaignStore.markDirty();
    }
  }

  function resetView() {
    zoom = 1.0;
    pan = { x: 0, y: 0 };
  }
</script>

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
    class="relative transition-transform duration-75 shadow-2xl rounded-2xl overflow-hidden border border-zinc-800/80 max-w-5xl w-11/12 max-h-[85vh] aspect-[16/10] bg-zinc-950"
    style="transform: translate({pan.x}px, {pan.y}px) scale({zoom});"
  >
    <img
      src={activeMap.imageUrl}
      alt={activeMap.title}
      class="w-full h-full object-cover pointer-events-none filter brightness-90 contrast-105"
    />

    <!-- Render Map Pins -->
    {#each activeMap.pins || [] as pin (pin.id)}
      <div class="map-pin-marker">
        <MapPinItem {pin} onDelete={handleDeletePin} />
      </div>
    {/each}

    <!-- Double-click hint -->
    <div class="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 backdrop-blur-xs pointer-events-none">
      Duplo clique para adicionar marcador
    </div>
  </div>

  <!-- Zoom & View Floating Controls -->
  <div class="absolute top-4 right-4 flex flex-col gap-1.5 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl backdrop-blur-md shadow-xl z-20">
    <button
      onclick={() => (zoom = Math.min(3.0, zoom * 1.2))}
      title="Aumentar Zoom"
      class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
    >
      <ZoomIn class="w-4 h-4" />
    </button>
    <button
      onclick={() => (zoom = Math.max(0.4, zoom / 1.2))}
      title="Diminuir Zoom"
      class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
    >
      <ZoomOut class="w-4 h-4" />
    </button>
    <div class="my-0.5 border-t border-zinc-800"></div>
    <button
      onclick={resetView}
      title="Repor Vista Original"
      class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
    >
      <RotateCcw class="w-4 h-4" />
    </button>
  </div>

  <!-- Map Info Overlay -->
  <div class="absolute top-4 left-4 bg-zinc-900/90 border border-zinc-800 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-xl flex items-center gap-2.5 z-20">
    <MapIcon class="w-4 h-4 text-amber-400" />
    <div>
      <h3 class="text-xs font-semibold text-zinc-100">{activeMap.title}</h3>
      <p class="text-[10px] text-zinc-400">{(activeMap.pins || []).length} marcadores ativos</p>
    </div>
  </div>
</div>

<!-- Modal to create pin -->
<CreatePinModal
  bind:isOpen={isPinModalOpen}
  xPercent={clickedCoords.xPercent}
  yPercent={clickedCoords.yPercent}
  onPinCreated={handlePinCreated}
/>
