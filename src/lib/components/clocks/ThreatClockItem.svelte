<script lang="ts">
  import type { ThreatClock } from '../../types';
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { Trash2, AlertTriangle, CheckCircle2 } from 'lucide-svelte';

  let {
    clock,
    onCompleted,
  }: {
    clock: ThreatClock;
    onCompleted?: (clock: ThreatClock) => void;
  } = $props();

  const isFull = $derived(clock.filledSegments >= clock.totalSegments);

  // Generate SVG segments with parametric mathematical arc gaps
  function getSegments() {
    const total = Math.max(1, clock.totalSegments);
    const filled = Math.max(0, Math.min(total, clock.filledSegments));
    const radius = 13;
    const circumference = 2 * Math.PI * radius;

    // Gap scaling as specified in spec_r3_r4.md §4.1.2
    const gap = total <= 8 ? 2.0 : total === 10 ? 1.5 : 1.2;
    const totalGap = total * gap;
    const segmentLength = Math.max(0.1, (circumference - totalGap) / total);

    const segments = [];
    for (let i = 0; i < total; i++) {
      const isFilled = i < filled;
      const strokeDasharray = `${segmentLength.toFixed(2)} ${(circumference - segmentLength).toFixed(2)}`;
      const rotation = (360 / total) * i - 90;

      segments.push({
        index: i,
        isFilled,
        strokeDasharray,
        rotation,
      });
    }
    return segments;
  }

  function handleLeftClick() {
    const prev = clock.filledSegments;
    campaignStore.incrementClock(clock.id);
    if (prev < clock.totalSegments && clock.filledSegments + 1 === clock.totalSegments && onCompleted) {
      onCompleted(clock);
    }
  }

  function handleRightClick(e: MouseEvent) {
    e.preventDefault();
    campaignStore.decrementClock(clock.id);
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    campaignStore.deleteClock(clock.id);
  }
</script>

<div
  role="button"
  tabindex="0"
  onclick={handleLeftClick}
  oncontextmenu={handleRightClick}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') handleLeftClick();
  }}
  class="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-900/80 border border-transparent hover:border-zinc-800 transition group cursor-pointer relative select-none {isFull
    ? 'bg-red-950/20 border-red-900/40 hover:border-red-800/60'
    : ''}"
  title="Clique esquerdo: +1 | Clique direito: -1 {clock.consequence ? `| Consequência: ${clock.consequence}` : ''}"
>
  <!-- Circular SVG Progress Clock -->
  <div class="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
    <svg class="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
      <!-- Background Ring -->
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="transparent"
        stroke="#27272a"
        stroke-width="3.5"
      />
      <!-- Active Segments -->
      {#each getSegments() as seg}
        <circle
          cx="16"
          cy="16"
          r="13"
          fill="transparent"
          stroke={seg.isFilled ? (isFull ? '#ef4444' : '#f59e0b') : '#3f3f46'}
          stroke-width="3.5"
          stroke-dasharray={seg.strokeDasharray}
          transform={`rotate(${seg.rotation} 16 16)`}
          class="transition-all duration-300 {seg.isFilled
            ? isFull
              ? 'stroke-red-500 animate-pulse'
              : 'stroke-amber-500'
            : 'stroke-zinc-800'}"
        />
      {/each}
    </svg>

    {#if isFull}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span class="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
      </div>
    {/if}
  </div>

  <!-- Text Details -->
  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-1.5">
      <span class="text-xs font-medium text-zinc-200 truncate group-hover:text-amber-300 transition {isFull ? 'text-red-300 font-semibold' : ''}">
        {clock.title}
      </span>
      {#if isFull}
        <span class="px-1 py-0.2 rounded text-[9px] font-bold bg-red-950 border border-red-800 text-red-400 shrink-0 uppercase">
          Full
        </span>
      {/if}
    </div>
    <div class="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5">
      <span>{clock.filledSegments} / {clock.totalSegments} fatias</span>
      {#if clock.consequence}
        <span class="text-zinc-600 truncate max-w-[120px]" title={clock.consequence}>• {clock.consequence}</span>
      {/if}
    </div>
  </div>

  <!-- Delete Clock button on hover -->
  <button
    onclick={handleDelete}
    title="Eliminar Relógio"
    class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 flex items-center justify-center transition cursor-pointer"
  >
    <Trash2 class="w-3.5 h-3.5" />
  </button>
</div>
