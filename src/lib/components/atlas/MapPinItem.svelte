<script lang="ts">
  import type { MapPin } from '../../types';
  import { appState } from '../../stores/appState.svelte';
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { get } from 'svelte/store';
  import { MapPin as PinIcon, ArrowUpRight, Trash2 } from 'lucide-svelte';

  let {
    pin,
    onDelete,
  }: {
    pin: MapPin;
    onDelete?: (pinId: string) => void;
  } = $props();

  let showTooltip = $state(false);

  const targetNode = $derived(
    pin.targetNodeId
      ? get(campaignStore.nodes).find((n) => n.id === pin.targetNodeId)
      : null
  );

  function handleNavigateToCanvas() {
    if (pin.targetNodeId) {
      if (targetNode) {
        campaignStore.selectedEntity = targetNode.data;
      }
      appState.activeTab = 'board';
    }
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    if (onDelete) onDelete(pin.id);
  }
</script>

<div
  class="absolute -translate-x-1/2 -translate-y-full cursor-pointer group z-10"
  style="left: {pin.xPercent}%; top: {pin.yPercent}%;"
  role="button"
  tabindex="0"
  onclick={() => (showTooltip = !showTooltip)}
  onkeydown={(e) => e.key === 'Enter' && (showTooltip = !showTooltip)}
>
  <!-- Animated Pin Icon -->
  <div class="relative flex items-center justify-center">
    <div class="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-zinc-950 transition shadow-lg shadow-black/60">
      <PinIcon class="w-4 h-4" />
    </div>
    <div class="w-2 h-2 rounded-full bg-amber-400 absolute -bottom-1 shadow-md shadow-amber-400/80"></div>
  </div>

  <!-- Popover / Tooltip -->
  <div
    class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 rounded-xl bg-zinc-950/95 border border-zinc-700/80 text-zinc-100 shadow-2xl transition duration-150 pointer-events-auto {showTooltip
      ? 'opacity-100 scale-100'
      : 'opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto'}"
  >
    <div class="flex items-start justify-between gap-1 mb-1">
      <span class="text-xs font-bold text-zinc-100 truncate">
        {pin.label || targetNode?.data.title || 'Marcador'}
      </span>
      <button
        onclick={handleDelete}
        title="Eliminar Marcador"
        class="text-zinc-500 hover:text-rose-400 p-0.5 rounded transition cursor-pointer"
      >
        <Trash2 class="w-3 h-3" />
      </button>
    </div>

    {#if targetNode}
      <div class="text-[10px] text-zinc-400 mb-2 flex items-center gap-1">
        <span
          class="w-1.5 h-1.5 rounded-full"
          style="background-color: {targetNode.data.color || '#d4a359'}"
        ></span>
        <span class="truncate">{targetNode.data.title}</span>
      </div>

      <button
        onclick={handleNavigateToCanvas}
        class="w-full py-1 px-2 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-medium flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
      >
        <span>Ver no Mural</span>
        <ArrowUpRight class="w-3 h-3" />
      </button>
    {:else}
      <p class="text-[10px] text-zinc-500 italic">Marcador de exploração livre</p>
    {/if}
  </div>
</div>
