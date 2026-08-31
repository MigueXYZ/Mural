<script lang="ts">
  import type { LoreEntry } from '../../types';
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { get } from 'svelte/store';
  import { Edit2, Trash2, Link2 } from 'lucide-svelte';

  let {
    entry,
    onEdit,
  }: {
    entry: LoreEntry;
    onEdit?: (entry: LoreEntry) => void;
  } = $props();

  const isSabido = $derived(entry.status === 'SABIDO' || entry.visibility === 'SABIDO');
  const allNodes = $derived(get(campaignStore.nodes));

  const associatedNodes = $derived(
    (entry.associatedNodeIds || [])
      .map((id) => allNodes.find((n) => n.id === id))
      .filter(Boolean)
  );

  function toggle() {
    campaignStore.toggleLoreStatus(entry.id);
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    campaignStore.deleteLoreEntry(entry.id);
  }

  function handleEdit(e: MouseEvent) {
    e.stopPropagation();
    if (onEdit) onEdit(entry);
  }
</script>

<div class="p-2.5 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/90 border border-zinc-800/60 hover:border-zinc-700/80 transition group space-y-2 select-none">
  <div class="flex items-start justify-between gap-2">
    <!-- Status Badge with Instant Toggle -->
    <button
      onclick={toggle}
      title="Clique para alternar entre SABIDO e SEGREDO"
      class="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase transition cursor-pointer select-none shrink-0 {isSabido
        ? 'bg-emerald-950/80 border border-emerald-600/60 text-emerald-400 hover:bg-emerald-900'
        : 'bg-rose-950/80 border border-rose-600/60 text-rose-400 hover:bg-rose-900'}"
    >
      {isSabido ? 'SABIDO' : 'SEGREDO'}
    </button>

    <!-- Actions (Edit / Delete) -->
    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
      <button
        onclick={handleEdit}
        title="Editar Nota"
        class="w-6 h-6 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 flex items-center justify-center transition cursor-pointer"
      >
        <Edit2 class="w-3 h-3" />
      </button>
      <button
        onclick={handleDelete}
        title="Eliminar Nota"
        class="w-6 h-6 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 flex items-center justify-center transition cursor-pointer"
      >
        <Trash2 class="w-3 h-3" />
      </button>
    </div>
  </div>

  <!-- Lore text -->
  <p class="text-xs text-zinc-200 leading-relaxed break-words">
    {entry.content}
  </p>

  <!-- Associated Entity Nodes Pills -->
  {#if associatedNodes.length > 0}
    <div class="flex flex-wrap items-center gap-1 pt-1 border-t border-zinc-800/40">
      <Link2 class="w-3 h-3 text-zinc-500 shrink-0" />
      {#each associatedNodes as node}
        <span
          class="px-1.5 py-0.2 rounded text-[10px] bg-zinc-950 border border-zinc-800 text-zinc-400 flex items-center gap-1"
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            style="background-color: {node?.data.color || '#d4a359'}"
          ></span>
          <span class="truncate max-w-[100px]">{node?.data.title}</span>
        </span>
      {/each}
    </div>
  {/if}
</div>
