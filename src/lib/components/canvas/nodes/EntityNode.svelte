<!-- File: src/lib/components/canvas/nodes/EntityNode.svelte -->
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { EntityNodeData } from '../../../types';
  import { campaignStore } from '../../../stores/campaignStore.svelte';
  import { getEntityIcon } from '../../../utils/icons';
  import {
    Pencil,
    Trash2,
    Copy,
    Lock,
    Unlock,
    Tag,
    Dices,
    FileText,
    Music,
    Play,
  } from 'lucide-svelte';
  import { audioEngine } from '../../../services/audio/audioEngine.svelte';

  // Props passed by Svelte Flow
  let {
    id,
    data,
    selected = false,
  }: {
    id?: string;
    data: EntityNodeData;
    selected?: boolean;
  } = $props();

  const nodeId = $derived(id || data?.id);

  // Category visual defaults
  const typeConfig = $derived.by(() => {
    const t = data?.type || data?.category || 'npc';
    switch (t) {
      case 'npc':
        return {
          label: 'NPC',
          textColor: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
          dotColor: 'bg-amber-400',
          defaultColor: '#d4a359',
        };
      case 'faction':
        return {
          label: 'FACÇÃO',
          textColor: 'text-purple-400',
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-500/30',
          dotColor: 'bg-purple-400',
          defaultColor: '#a855f7',
        };
      case 'location':
        return {
          label: 'LOCAL',
          textColor: 'text-sky-400',
          bgColor: 'bg-sky-500/10',
          borderColor: 'border-sky-500/30',
          dotColor: 'bg-sky-400',
          defaultColor: '#38bdf8',
        };
      case 'secret':
      case 'clue':
        return {
          label: t === 'secret' ? 'SEGREDO' : 'PISTA',
          textColor: 'text-rose-400',
          bgColor: 'bg-rose-500/10',
          borderColor: 'border-rose-500/30',
          dotColor: 'bg-rose-400',
          defaultColor: '#f87171',
        };
      case 'note':
        return {
          label: 'NOTA',
          textColor: 'text-zinc-300',
          bgColor: 'bg-zinc-800/40',
          borderColor: 'border-zinc-700/50',
          dotColor: 'bg-zinc-400',
          defaultColor: '#71717a',
        };
      case 'table':
        return {
          label: 'TABELA',
          textColor: 'text-amber-300',
          bgColor: 'bg-amber-500/15',
          borderColor: 'border-amber-500/40',
          dotColor: 'bg-amber-400',
          defaultColor: '#d4a359',
        };
      default:
        return {
          label: 'ENTIDADE',
          textColor: 'text-zinc-400',
          bgColor: 'bg-zinc-500/10',
          borderColor: 'border-zinc-500/30',
          dotColor: 'bg-zinc-400',
          defaultColor: '#d4a359',
        };
    }
  });

  const activeColor = $derived(data?.color || data?.colorTheme || typeConfig.defaultColor);
  const IconComponent = $derived(getEntityIcon(data?.icon, data?.type || data?.category));
  const isSecretNode = $derived(Boolean(data?.isSecret || data?.type === 'secret'));

  // Card border styling based on Secret / Selection state
  const containerClasses = $derived.by(() => {
    let classes = 'group relative w-68 rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all duration-200 select-none cursor-pointer ';
    if (selected) {
      classes += 'ring-2 ring-amber-400 shadow-[0_0_24px_rgba(212,163,89,0.35)] ';
    }
    if (isSecretNode) {
      classes += 'border-rose-900/70 bg-gradient-to-b from-zinc-950 via-zinc-900 to-rose-950/30 hover:border-rose-600/80';
    } else {
      classes += 'border-zinc-800/90 bg-zinc-900/95 hover:border-zinc-600';
    }
    return classes;
  });

  function handleDoubleClick(e: MouseEvent) {
    e.stopPropagation();
    campaignStore.openNodeEditor(data);
  }

  function handleEditClick(e: MouseEvent) {
    e.stopPropagation();
    campaignStore.openNodeEditor(data);
  }

  function handleDuplicateClick(e: MouseEvent) {
    e.stopPropagation();
    if (nodeId) {
      campaignStore.duplicateNode(nodeId);
    }
  }

  function handleToggleSecretClick(e: MouseEvent) {
    e.stopPropagation();
    if (nodeId) {
      campaignStore.toggleNodeSecret(nodeId);
    }
  }

  function handleDeleteClick(e: MouseEvent) {
    e.stopPropagation();
    if (nodeId) {
      campaignStore.deleteNode(nodeId);
    }
  }

  function rollQuickTable(e: MouseEvent) {
    e.stopPropagation();
    if (data?.tables && data.tables.length > 0 && nodeId) {
      const targetTable = data.tables[0];
      const sides = parseInt(targetTable.diceType.replace('d', ''), 10) || 6;
      const roll = Math.floor(Math.random() * sides) + 1;

      let matchedRowId: string | undefined;
      for (const row of targetTable.rows) {
        if (row.range.includes('-')) {
          const [min, max] = row.range.split('-').map((n) => parseInt(n.trim(), 10));
          if (!isNaN(min) && !isNaN(max) && roll >= min && roll <= max) {
            matchedRowId = row.id;
            break;
          }
        } else {
          const val = parseInt(row.range.trim(), 10);
          if (!isNaN(val) && val === roll) {
            matchedRowId = row.id;
            break;
          }
        }
      }

      targetTable.lastRoll = {
        diceValue: roll,
        matchedRowId,
        rolledAt: Date.now(),
      };

      campaignStore.updateNodeData(nodeId, {
        tables: [...data.tables],
      });
    }
  }

  function triggerEntityAudio(e: MouseEvent) {
    e.stopPropagation();
    if (data?.audioPlaylistId) {
      const pl = audioEngine.playlists.find((p) => p.id === data.audioPlaylistId);
      if (pl && pl.tracks.length > 0) {
        audioEngine.playMusic(pl.tracks[0], pl);
        return;
      }
    }
    // Contextual fallback based on location / faction title
    const t = (data?.title || '').toLowerCase();
    if (t.includes('taverna') || t.includes('estalagem') || t.includes('bar')) {
      audioEngine.playAmbience({ id: 'amb-tavern', title: 'Taverna Movimentada', src: 'synth:tavern_chatter', category: 'ambience' });
    } else if (t.includes('cripta') || t.includes('ruína') || t.includes('masmorra') || t.includes('poço')) {
      audioEngine.playAmbience({ id: 'amb-dungeon', title: 'Gotejar na Masmorra', src: 'synth:dungeon', category: 'ambience' });
    } else if (t.includes('floresta') || t.includes('bosque') || t.includes('montanha') || t.includes('vento')) {
      audioEngine.playAmbience({ id: 'amb-wind', title: 'Vento Uivante', src: 'synth:wind', category: 'ambience' });
    } else {
      audioEngine.playAmbience({ id: 'amb-rain', title: 'Chuva & Tempestade', src: 'synth:rain', category: 'ambience' });
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  ondblclick={handleDoubleClick}
  class={containerClasses}
  style="--node-accent: {activeColor};"
>
  <!-- Connection Handles (Top, Right, Bottom, Left) -->
  <Handle
    type="target"
    position={Position.Top}
    id="top"
    class="!w-3 !h-3 !bg-zinc-700 hover:!bg-amber-400 !border-2 !border-zinc-950 !rounded-full transition-all duration-150 -top-1.5"
  />
  <Handle
    type="source"
    position={Position.Bottom}
    id="bottom"
    class="!w-3 !h-3 !bg-zinc-700 hover:!bg-amber-400 !border-2 !border-zinc-950 !rounded-full transition-all duration-150 -bottom-1.5"
  />
  <Handle
    type="target"
    position={Position.Left}
    id="left"
    class="!w-3 !h-3 !bg-zinc-700 hover:!bg-amber-400 !border-2 !border-zinc-950 !rounded-full transition-all duration-150 -left-1.5"
  />
  <Handle
    type="source"
    position={Position.Right}
    id="right"
    class="!w-3 !h-3 !bg-zinc-700 hover:!bg-amber-400 !border-2 !border-zinc-950 !rounded-full transition-all duration-150 -right-1.5"
  />

  <!-- Top Action Bar on Hover -->
  <div
    class="absolute -top-3.5 right-2 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center gap-1 bg-zinc-950/95 border border-zinc-700/90 rounded-lg p-0.5 shadow-xl z-20"
  >
    <button
      type="button"
      onclick={handleEditClick}
      title="Editar Nó (duplo-clique)"
      class="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition cursor-pointer"
    >
      <Pencil class="w-3 h-3" />
    </button>
    <button
      type="button"
      onclick={handleDuplicateClick}
      title="Duplicar Nó"
      class="p-1 rounded text-zinc-400 hover:text-sky-400 hover:bg-zinc-800 transition cursor-pointer"
    >
      <Copy class="w-3 h-3" />
    </button>
    <button
      type="button"
      onclick={handleToggleSecretClick}
      title={isSecretNode ? 'Alternar Visibilidade Secreta' : 'Marcar como Segredo'}
      class="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer"
    >
      {#if isSecretNode}
        <Lock class="w-3 h-3 text-rose-400" />
      {:else}
        <Unlock class="w-3 h-3" />
      {/if}
    </button>
    <button
      type="button"
      onclick={handleDeleteClick}
      title="Eliminar Nó"
      class="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer"
    >
      <Trash2 class="w-3 h-3" />
    </button>
  </div>

  <!-- Header: Category Badge, Icon & Secret Indicator -->
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-2">
      <div
        class="w-6 h-6 rounded-lg flex items-center justify-center {typeConfig.bgColor} {typeConfig.textColor} border {typeConfig.borderColor}"
        style="color: {activeColor};"
      >
        <IconComponent class="w-3.5 h-3.5" />
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full" style="background-color: {activeColor};"></span>
        <span class="text-[10px] font-bold tracking-wider uppercase" style="color: {activeColor};">
          {data?.subtitle || typeConfig.label}
        </span>
      </div>
    </div>

    {#if isSecretNode}
      <span class="px-1.5 py-0.5 rounded-md bg-rose-950/80 border border-rose-800/70 text-[9px] font-extrabold text-rose-300 tracking-wide flex items-center gap-1">
        <Lock class="w-2.5 h-2.5" />
        <span>SEGREDO</span>
      </span>
    {/if}
  </div>

  <!-- Main Title -->
  <h3 class="text-sm font-bold text-zinc-100 tracking-tight leading-snug group-hover:text-amber-300 transition">
    {data?.title || 'Sem Título'}
  </h3>

  <!-- Tags Chip Rack -->
  {#if data?.tags && data.tags.length > 0}
    <div class="flex flex-wrap gap-1 mt-2 mb-1">
      {#each data.tags as tag}
        <span class="text-[10px] font-medium px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/50 text-zinc-300 flex items-center gap-1">
          <Tag class="w-2.5 h-2.5 text-zinc-500" />
          <span>{tag}</span>
        </span>
      {/each}
    </div>
  {/if}

  <!-- Location Mini Graphic Schematic -->
  {#if (data?.type === 'location' || data?.category === 'location')}
    <div class="my-2 h-9 w-full rounded-lg bg-zinc-950/80 border border-zinc-800 flex items-center justify-center relative overflow-hidden">
      <svg class="w-full h-7 px-2 text-sky-500/40" viewBox="0 0 100 24" fill="none" stroke="currentColor">
        <path d="M 0,18 L 20,18 L 20,8 L 60,8 L 60,18 L 100,18" stroke-width="2" stroke-linecap="round" />
        <circle cx="40" cy="13" r="2.5" fill="#38bdf8" />
      </svg>
    </div>
  {/if}

  <!-- Direct Table Preview & Dice Roller if Table Node -->
  {#if (data?.type === 'table' || data?.category === 'table') && data?.tables && data.tables.length > 0}
    {@const tbl = data.tables[0]}
    <div class="my-2 p-2.5 rounded-xl bg-zinc-950/80 border border-amber-500/30 space-y-1.5">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold text-amber-300 truncate">{tbl.title}</span>
        <button
          type="button"
          onclick={rollQuickTable}
          class="px-2 py-0.5 rounded-lg bg-amber-500 text-zinc-950 font-bold text-[10px] flex items-center gap-1 hover:bg-amber-400 transition cursor-pointer active:scale-95"
        >
          <Dices class="w-3 h-3" />
          <span>Rolar {tbl.diceType}</span>
        </button>
      </div>

      {#if tbl.lastRoll}
        <div class="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] flex items-center gap-2">
          <span class="w-5 h-5 rounded bg-amber-500 text-zinc-950 font-black flex items-center justify-center">
            {tbl.lastRoll.diceValue}
          </span>
          <span class="text-zinc-200 truncate flex-1">
            {tbl.rows.find((r) => r.id === tbl.lastRoll?.matchedRowId)?.title || 'Resultado sorteado'}
          </span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Description / GM Notes with Secret Blur Filter -->
  {#if data?.description}
    <p
      class="text-xs text-zinc-400 leading-relaxed mt-1.5 line-clamp-3 transition duration-150 {isSecretNode && !data?.revealed ? 'filter blur-[1px] hover:blur-none select-none text-zinc-500' : ''}"
      title={isSecretNode ? 'Passe o rato para pré-visualizar notas secretas' : undefined}
    >
      {data.description}
    </p>
  {/if}

  <!-- Quick Audio / Atmospheric Trigger Button -->
  {#if data?.audioPlaylistId || (data?.type === 'location' || data?.category === 'location')}
    <button
      type="button"
      onclick={triggerEntityAudio}
      class="mt-2 w-full py-1 px-2.5 rounded-lg bg-zinc-950/80 border border-amber-500/20 hover:border-amber-500/50 text-amber-300 text-[10px] font-semibold flex items-center justify-between transition cursor-pointer active:scale-95 group/audio shadow-sm"
      title="Tocar Ambiência / Trilha Sonora vinculada a este local"
    >
      <span class="flex items-center gap-1.5">
        <Music class="w-3 h-3 text-amber-400 group-hover/audio:animate-bounce" />
        <span>Tocar Ambiência</span>
      </span>
      <Play class="w-3 h-3 text-amber-400" />
    </button>
  {/if}

  <!-- Attached Tables and Sub-Notes Badges Footer -->
  {#if (data?.tables && data.tables.length > 0) || (data?.notes && data.notes.length > 0)}
    <div class="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-zinc-800/80 text-[10px]">
      {#if data.tables && data.tables.length > 0}
        <span class="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1 font-medium">
          <Dices class="w-3 h-3" />
          <span>{data.tables.length} {data.tables.length === 1 ? 'Tabela' : 'Tabelas'}</span>
        </span>
      {/if}
      {#if data.notes && data.notes.length > 0}
        <span class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center gap-1 font-medium">
          <FileText class="w-3 h-3" />
          <span>{data.notes.length} {data.notes.length === 1 ? 'Nota' : 'Notas'}</span>
        </span>
      {/if}
    </div>
  {/if}
</div>
