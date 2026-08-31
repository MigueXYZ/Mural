<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { get } from 'svelte/store';
  import { X, BookOpen, Sparkles, Link2 } from 'lucide-svelte';
  import type { LoreEntry, LoreVisibility } from '../../types';

  let {
    isOpen = $bindable(false),
    entryToEdit = $bindable<LoreEntry | null>(null),
  }: {
    isOpen: boolean;
    entryToEdit?: LoreEntry | null;
  } = $props();

  let content = $state('');
  let status = $state<LoreVisibility>('SEGREDO');
  let selectedNodeIds = $state<string[]>([]);

  const availableNodes = $derived(get(campaignStore.nodes));

  $effect(() => {
    if (isOpen) {
      if (entryToEdit) {
        content = entryToEdit.content || '';
        status = entryToEdit.status || entryToEdit.visibility || 'SEGREDO';
        selectedNodeIds = [...(entryToEdit.associatedNodeIds || [])];
      } else {
        content = '';
        status = 'SEGREDO';
        selectedNodeIds = [];
      }
    }
  });

  function toggleNodeSelection(nodeId: string) {
    if (selectedNodeIds.includes(nodeId)) {
      selectedNodeIds = selectedNodeIds.filter((id) => id !== nodeId);
    } else {
      selectedNodeIds = [...selectedNodeIds, nodeId];
    }
  }

  function handleSubmit() {
    if (!content.trim()) return;

    if (entryToEdit) {
      // Update existing
      const list = campaignStore.campaign.lore || [];
      const idx = list.findIndex((l) => l.id === entryToEdit?.id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          content: content.trim(),
          status,
          visibility: status,
          associatedNodeIds: selectedNodeIds,
          updatedAt: Date.now(),
        };
        campaignStore.campaign.lore = [...list];
        campaignStore.markDirty();
      }
    } else {
      // Add new
      campaignStore.addLoreEntry(content.trim(), status, selectedNodeIds);
    }

    isOpen = false;
    entryToEdit = null;
    content = '';
    selectedNodeIds = [];
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
    <div class="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <BookOpen class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-zinc-100">
              {entryToEdit ? 'Editar Registo de Lore' : 'Novo Registo de Lore'}
            </h2>
            <p class="text-xs text-zinc-400">Pistas, segredos e factos da campanha</p>
          </div>
        </div>
        <button
          onclick={() => {
            isOpen = false;
            entryToEdit = null;
          }}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4 text-xs">
        <div>
          <label for="lore-content-input" class="block font-medium text-zinc-300 mb-1.5">
            Conteúdo da Pista ou Informação <span class="text-amber-400">*</span>
          </label>
          <textarea
            id="lore-content-input"
            rows="3"
            placeholder="Ex: O símbolo gravado na cripta pertence a um ritual de 1842..."
            bind:value={content}
            required
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 resize-none"
          ></textarea>
        </div>

        <!-- Visibility Toggle Buttons -->
        <div>
          <span class="block font-medium text-zinc-300 mb-1.5">Estado de Visibilidade</span>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              onclick={() => (status = 'SEGREDO')}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {status === 'SEGREDO'
                ? 'bg-rose-950/70 border-rose-600 text-rose-300 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <div class="font-bold text-xs uppercase tracking-wider mb-0.5 text-rose-400">SEGREDO</div>
              <div class="text-[10px] text-zinc-400">Apenas o Mestre tem conhecimento</div>
            </button>

            <button
              type="button"
              onclick={() => (status = 'SABIDO')}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {status === 'SABIDO'
                ? 'bg-emerald-950/70 border-emerald-600 text-emerald-300 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <div class="font-bold text-xs uppercase tracking-wider mb-0.5 text-emerald-400">SABIDO</div>
              <div class="text-[10px] text-zinc-400">Revelado aos investigadores / jogadores</div>
            </button>
          </div>
        </div>

        <!-- Entity Node Association -->
        {#if availableNodes.length > 0}
          <div>
            <span class="block font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Link2 class="w-3.5 h-3.5 text-zinc-400" />
              <span>Associar a Entidades do Quadro ({selectedNodeIds.length} selecionadas)</span>
            </span>
            <div class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-zinc-950 border border-zinc-800 rounded-lg">
              {#each availableNodes as node}
                {@const isSelected = selectedNodeIds.includes(node.id)}
                <button
                  type="button"
                  onclick={() => toggleNodeSelection(node.id)}
                  class="px-2 py-1 rounded-md text-[11px] font-medium border transition cursor-pointer flex items-center gap-1 {isSelected
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'}"
                >
                  <span
                    class="w-2 h-2 rounded-full"
                    style="background-color: {node.data.color || '#d4a359'}"
                  ></span>
                  <span>{node.data.title}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onclick={() => {
              isOpen = false;
              entryToEdit = null;
            }}
            class="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!content.trim()}
            class="px-5 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>{entryToEdit ? 'Guardar Alterações' : 'Adicionar ao Lore'}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
