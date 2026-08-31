<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import LoreEntryItem from './LoreEntryItem.svelte';
  import EditLoreModal from './EditLoreModal.svelte';
  import { Plus, BookOpen, Search } from 'lucide-svelte';
  import type { LoreEntry } from '../../types';

  let isModalOpen = $state(false);
  let entryToEdit = $state<LoreEntry | null>(null);
  let statusFilter = $state<'TODOS' | 'SABIDO' | 'SEGREDO'>('TODOS');
  let searchQuery = $state('');

  const filteredLore = $derived(
    (campaignStore.campaign.lore || []).filter((item) => {
      const currentStatus = item.status || item.visibility || 'SEGREDO';
      const matchesStatus = statusFilter === 'TODOS' || currentStatus === statusFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchesStatus && matchesSearch;
    })
  );

  function openCreate() {
    entryToEdit = null;
    isModalOpen = true;
  }

  function handleEdit(entry: LoreEntry) {
    entryToEdit = entry;
    isModalOpen = true;
  }
</script>

<div class="p-3 border-b border-zinc-800/80 flex-1 flex flex-col min-h-0">
  <!-- Header -->
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-1.5">
      <BookOpen class="w-3.5 h-3.5 text-amber-400" />
      <h2 class="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
        Registo de Lore & Pistas
      </h2>
      <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
        {filteredLore.length}
      </span>
    </div>

    <button
      onclick={openCreate}
      title="Adicionar Nota de Lore"
      class="text-zinc-500 hover:text-amber-400 p-1 rounded hover:bg-zinc-900 transition cursor-pointer"
    >
      <Plus class="w-4 h-4" />
    </button>
  </div>

  <!-- Filter Tabs & Search -->
  <div class="space-y-1.5 mb-2.5">
    <!-- Filter Tabs -->
    <div class="grid grid-cols-3 gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[10px] font-medium">
      <button
        onclick={() => (statusFilter = 'TODOS')}
        class="py-1 rounded transition {statusFilter === 'TODOS'
          ? 'bg-zinc-800 text-amber-300 font-semibold shadow-xs'
          : 'text-zinc-500 hover:text-zinc-300'}"
      >
        Todos
      </button>
      <button
        onclick={() => (statusFilter = 'SABIDO')}
        class="py-1 rounded transition {statusFilter === 'SABIDO'
          ? 'bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-800/60 shadow-xs'
          : 'text-zinc-500 hover:text-emerald-400'}"
      >
        Sabido
      </button>
      <button
        onclick={() => (statusFilter = 'SEGREDO')}
        class="py-1 rounded transition {statusFilter === 'SEGREDO'
          ? 'bg-rose-950/80 text-rose-300 font-semibold border border-rose-800/60 shadow-xs'
          : 'text-zinc-500 hover:text-rose-400'}"
      >
        Segredo
      </button>
    </div>

    <!-- Search Input -->
    <div class="relative">
      <Search class="w-3 h-3 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
      <input
        type="text"
        placeholder="Filtrar pistas..."
        bind:value={searchQuery}
        class="w-full h-7 pl-7 pr-2 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
      />
    </div>
  </div>

  <!-- List -->
  <div class="space-y-2 overflow-y-auto flex-1 pr-1">
    {#if filteredLore.length > 0}
      {#each filteredLore as entry (entry.id)}
        <LoreEntryItem {entry} onEdit={handleEdit} />
      {/each}
    {:else}
      <div class="py-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-900 rounded-lg">
        Nenhum registo de lore encontrado.
      </div>
    {/if}
  </div>
</div>

<!-- Modal -->
<EditLoreModal bind:isOpen={isModalOpen} bind:entryToEdit />
