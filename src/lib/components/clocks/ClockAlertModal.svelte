<script lang="ts">
  import type { ThreatClock } from '../../types';
  import { AlertOctagon, X, Sparkles, BookOpen } from 'lucide-svelte';
  import { campaignStore } from '../../stores/campaignStore.svelte';

  let {
    clock,
    isOpen = $bindable(false),
  }: {
    clock: ThreatClock | null;
    isOpen: boolean;
  } = $props();

  function addConsequenceToLore() {
    if (clock && clock.consequence) {
      campaignStore.addLoreEntry(
        `[AMEAÇA CONCLUÍDA - ${clock.title}]: ${clock.consequence}`,
        'SABIDO'
      );
    }
    isOpen = false;
  }
</script>

{#if isOpen && clock}
  <div class="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
    <div class="w-full max-w-md bg-zinc-900 border-2 border-red-500/80 rounded-2xl p-6 shadow-2xl shadow-red-500/20 space-y-5 animate-in fade-in zoom-in-95 duration-200">
      <!-- Alert Header -->
      <div class="flex items-center justify-between border-b border-red-900/50 pb-3">
        <div class="flex items-center gap-2.5 text-red-400">
          <AlertOctagon class="w-6 h-6 animate-pulse" />
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wider text-red-300">
              Relógio de Ameaça Concluído!
            </h2>
            <p class="text-xs text-zinc-400">A contagem atingiu o limite crítico</p>
          </div>
        </div>
        <button
          onclick={() => (isOpen = false)}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Clock Details -->
      <div class="p-4 rounded-xl bg-red-950/30 border border-red-900/40 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-zinc-100">{clock.title}</span>
          <span class="text-xs font-mono font-bold text-red-400 bg-red-950 px-2 py-0.5 rounded border border-red-800">
            {clock.totalSegments} / {clock.totalSegments} FATIAS
          </span>
        </div>

        {#if clock.consequence}
          <div class="pt-2 border-t border-red-900/30 text-xs text-zinc-300 leading-relaxed">
            <span class="text-red-400 font-semibold block mb-0.5">Consequência Imediata:</span>
            {clock.consequence}
          </div>
        {:else}
          <p class="text-xs text-zinc-400 italic">
            Nenhuma consequência personalizada definida para este relógio.
          </p>
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
        <button
          onclick={() => (isOpen = false)}
          class="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
        >
          Fechar
        </button>

        {#if clock.consequence}
          <button
            onclick={addConsequenceToLore}
            class="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 hover:bg-red-500/30 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
          >
            <BookOpen class="w-3.5 h-3.5" />
            <span>Adicionar ao Lore (SABIDO)</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
