<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { get } from 'svelte/store';
  import { X, MapPin, Sparkles, Link2 } from 'lucide-svelte';

  let {
    isOpen = $bindable(false),
    xPercent = 50,
    yPercent = 50,
    onPinCreated,
  }: {
    isOpen: boolean;
    xPercent: number;
    yPercent: number;
    onPinCreated: (pin: { targetNodeId: string; label?: string; xPercent: number; yPercent: number }) => void;
  } = $props();

  let label = $state('');
  let selectedTargetNodeId = $state('');

  const availableNodes = $derived(get(campaignStore.nodes));

  function handleSubmit() {
    onPinCreated({
      targetNodeId: selectedTargetNodeId,
      label: label.trim() || 'Ponto de Interesse',
      xPercent,
      yPercent,
    });
    isOpen = false;
    label = '';
    selectedTargetNodeId = '';
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
            <MapPin class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-zinc-100">Criar Marcador no Mapa</h2>
            <p class="text-xs text-zinc-400">Posição: {xPercent.toFixed(1)}%, {yPercent.toFixed(1)}%</p>
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
          <label for="pin-label-input" class="block font-medium text-zinc-300 mb-1.5">
            Nome do Local / Marcador <span class="text-amber-400">*</span>
          </label>
          <input
            id="pin-label-input"
            type="text"
            placeholder="Ex: Mansão Abandonada, Praça Central..."
            bind:value={label}
            required
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
          />
        </div>

        <!-- Target Entity Node Link -->
        <div>
          <label for="pin-node-select" class="block font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
            <Link2 class="w-3.5 h-3.5 text-zinc-400" />
            <span>Vincular a uma Entidade do Mural</span>
          </label>
          <select
            id="pin-node-select"
            bind:value={selectedTargetNodeId}
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
          >
            <option value="">Nenhuma (Marcador livre)</option>
            {#each availableNodes as node}
              <option value={node.id}>
                {node.data.title} ({node.data.type?.toUpperCase() || 'ENTIDADE'})
              </option>
            {/each}
          </select>
          <p class="text-[10px] text-zinc-500 mt-1">
            Vincular permite saltar diretamente para este nó no quadro de investigação.
          </p>
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
            disabled={!label.trim()}
            class="px-5 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Colocar Marcador</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
