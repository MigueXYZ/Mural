<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { X, Clock, AlertTriangle, Sparkles } from 'lucide-svelte';
  import type { ClockSegmentCount } from '../../types';

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  let title = $state('');
  let totalSegments = $state<ClockSegmentCount>(6);
  let consequence = $state('');
  let category = $state('threat');

  const segmentOptions: ClockSegmentCount[] = [4, 6, 8, 10, 12];

  function handleSubmit() {
    if (!title.trim()) return;
    campaignStore.addClock(title.trim(), totalSegments, consequence.trim());
    isOpen = false;
    title = '';
    consequence = '';
    totalSegments = 6;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      isOpen = false;
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Clock class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-zinc-100">Criar Relógio de Ameaça</h2>
            <p class="text-xs text-zinc-400">Define uma contagem regressiva de perigo ou objetivo</p>
          </div>
        </div>
        <button
          onclick={() => (isOpen = false)}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4 text-xs">
        <div>
          <label for="clock-title-input" class="block font-medium text-zinc-300 mb-1.5">
            Título da Ameaça / Objetivo <span class="text-amber-400">*</span>
          </label>
          <input
            id="clock-title-input"
            type="text"
            placeholder="Ex: Chegada da Guarda Real, Ritual de Evocação..."
            bind:value={title}
            required
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
          />
        </div>

        <!-- Segments Selector -->
        <div>
          <span class="block font-medium text-zinc-300 mb-2">Número de Fatias</span>
          <div class="grid grid-cols-5 gap-2">
            {#each segmentOptions as seg}
              <button
                type="button"
                onclick={() => (totalSegments = seg)}
                class="py-2 px-1 rounded-lg border text-center font-mono font-bold text-xs transition cursor-pointer {totalSegments === seg
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
              >
                {seg}
              </button>
            {/each}
          </div>
          <p class="text-[10px] text-zinc-500 mt-1">
            4: Tensão rápida | 6: Desafio padrão | 8: Ameaça complexa | 10-12: Catástrofe de longo prazo
          </p>
        </div>

        <div>
          <label for="clock-consequence-input" class="block font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
            <AlertTriangle class="w-3.5 h-3.5 text-amber-400" />
            <span>Consequência ao Preencher (Gatilho)</span>
          </label>
          <textarea
            id="clock-consequence-input"
            rows="2"
            placeholder="Ex: O culto liberta a criatura; O alarme soa e o complexo entra em quarentena..."
            bind:value={consequence}
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 resize-none"
          ></textarea>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onclick={() => (isOpen = false)}
            class="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            class="px-5 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Criar Relógio</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
