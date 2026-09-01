<!-- File: src/lib/components/canvas/edges/CustomLabeledEdge.svelte -->
<script lang="ts">
  import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    getSmoothStepPath,
    getStraightPath,
    type EdgeProps,
    Position,
  } from '@xyflow/svelte';
  import type { CanvasRelationEdgeData, RelationType } from '../../../types';
  import { campaignStore } from '../../../stores/campaignStore.svelte';
  import {
    Users,
    Swords,
    EyeOff,
    Search,
    Link2,
    Tag,
    Pencil,
    Trash2,
    ArrowLeftRight,
    FileText,
  } from 'lucide-svelte';

  let {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition = Position.Bottom,
    targetPosition = Position.Top,
    data = {
      label: 'ligação',
      relationType: 'neutral',
      pathType: 'smoothstep',
      bidirectional: false,
    },
    style = '',
    markerEnd,
    markerStart,
    selected = false,
  }: EdgeProps & { data?: CanvasRelationEdgeData } = $props();

  // 1. Reactive relationship config
  const relationType = $derived<RelationType>(data?.relationType || 'neutral');
  const pathType = $derived(data?.pathType || 'smoothstep');
  const labelText = $derived(data?.label || 'ligação');
  const isBidirectional = $derived(Boolean(data?.bidirectional));
  const hasNotes = $derived(Boolean(data?.notes && data.notes.trim().length > 0));

  // 2. Path & Midpoint Calculation
  const pathResult = $derived.by(() => {
    const params = {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    };

    if (pathType === 'bezier') {
      return getBezierPath(params);
    } else if (pathType === 'straight') {
      return getStraightPath({ sourceX, sourceY, targetX, targetY });
    } else {
      // Default: smoothstep with rounded corners
      return getSmoothStepPath({ ...params, borderRadius: 10, offset: 20 });
    }
  });

  const edgePath = $derived(pathResult[0]);
  const labelX = $derived(pathResult[1]);
  const labelY = $derived(pathResult[2]);

  // 3. Styling rules per relationType
  const stylingConfig = $derived.by(() => {
    switch (relationType) {
      case 'allied':
        return {
          strokeColor: '#10b981', // emerald-500
          strokeDash: 'none',
          strokeWidth: selected ? '2.5px' : '2px',
          badgeBg: 'bg-emerald-950/90',
          badgeBorder: 'border-emerald-500/50 hover:border-emerald-400',
          textColor: 'text-emerald-300',
          iconColor: 'text-emerald-400',
          glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]',
          icon: Users,
        };
      case 'hostile':
        return {
          strokeColor: '#f43f5e', // rose-500
          strokeDash: 'none',
          strokeWidth: selected ? '2.5px' : '2px',
          badgeBg: 'bg-rose-950/90',
          badgeBorder: 'border-rose-500/50 hover:border-rose-400',
          textColor: 'text-rose-300',
          iconColor: 'text-rose-400',
          glowClass: 'shadow-[0_0_12px_rgba(244,63,94,0.25)]',
          icon: Swords,
        };
      case 'secret':
        return {
          strokeColor: '#a855f7', // purple-500
          strokeDash: '6 4',
          strokeWidth: selected ? '2.5px' : '2px',
          badgeBg: 'bg-purple-950/90',
          badgeBorder: 'border-purple-500/50 hover:border-purple-400',
          textColor: 'text-purple-300',
          iconColor: 'text-purple-400',
          glowClass: 'shadow-[0_0_12px_rgba(168,85,247,0.25)]',
          icon: EyeOff,
        };
      case 'investigates':
        return {
          strokeColor: '#f59e0b', // amber-500
          strokeDash: '8 3',
          strokeWidth: selected ? '2.5px' : '2px',
          badgeBg: 'bg-amber-950/90',
          badgeBorder: 'border-amber-500/50 hover:border-amber-400',
          textColor: 'text-amber-300',
          iconColor: 'text-amber-400',
          glowClass: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
          icon: Search,
        };
      case 'custom':
        return {
          strokeColor: (data?.color as string) || '#38bdf8', // sky-400
          strokeDash: 'none',
          strokeWidth: selected ? '2.5px' : '2px',
          badgeBg: 'bg-sky-950/90',
          badgeBorder: 'border-sky-500/50 hover:border-sky-400',
          textColor: 'text-sky-300',
          iconColor: 'text-sky-400',
          glowClass: 'shadow-[0_0_12px_rgba(56,189,248,0.25)]',
          icon: Tag,
        };
      case 'neutral':
      default:
        return {
          strokeColor: '#71717a', // zinc-500
          strokeDash: 'none',
          strokeWidth: selected ? '2px' : '1.5px',
          badgeBg: 'bg-zinc-900/95',
          badgeBorder: 'border-zinc-700/80 hover:border-zinc-500',
          textColor: 'text-zinc-300',
          iconColor: 'text-zinc-400',
          glowClass: 'shadow-[0_0_8px_rgba(0,0,0,0.4)]',
          icon: Link2,
        };
    }
  });

  import { getEntityIcon } from '../../../utils/icons';

  const isFilteredOut = $derived(
    campaignStore.activeEdgeFilter !== 'all' && relationType !== campaignStore.activeEdgeFilter
  );

  const CustomIcon = $derived(data?.icon ? getEntityIcon(data.icon) : null);
  const IconComponent = $derived(CustomIcon || stylingConfig.icon);

  const computedStyle = $derived(
    `stroke: ${stylingConfig.strokeColor}; stroke-width: ${stylingConfig.strokeWidth}; ${
      stylingConfig.strokeDash !== 'none' ? `stroke-dasharray: ${stylingConfig.strokeDash};` : ''
    } ${isFilteredOut ? 'opacity: 0.08; pointer-events: none;' : ''} ${style}`
  );

  // 4. Interaction handlers
  function handleOpenEditor(e: MouseEvent) {
    e.stopPropagation();
    campaignStore.openEdgeEditor({
      id,
      source,
      target,
      data,
    } as any);
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    campaignStore.deleteEdge(id);
  }
</script>

<!-- SVG Edge Path via Svelte Flow BaseEdge -->
<BaseEdge
  {id}
  path={edgePath}
  style={computedStyle}
  {markerStart}
  {markerEnd}
  interactionWidth={24}
/>

<!-- Midpoint HTML Interactive Label Pill via EdgeLabelRenderer -->
<EdgeLabelRenderer>
  <div
    style="position: absolute; transform: translate(-50%, -50%) translate({labelX}px, {labelY}px); pointer-events: all; {isFilteredOut ? 'opacity: 0.08; pointer-events: none;' : ''}"
    class="nodrag nopan select-none group/edge"
  >
    <div
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-md transition-all duration-150 {stylingConfig.badgeBg} {stylingConfig.badgeBorder} {stylingConfig.glowClass} {selected ? 'ring-2 ring-amber-400/80 scale-105' : 'hover:scale-105'}"
    >
      <!-- Clickable Label & Category Icon -->
      <button
        type="button"
        onclick={handleOpenEditor}
        ondblclick={handleOpenEditor}
        class="flex items-center gap-1.5 cursor-pointer text-left focus:outline-none"
        title="Duplo clique para editar ligação"
      >
        <IconComponent class="w-3 h-3 {stylingConfig.iconColor} shrink-0" />

        <span class="text-[11px] font-medium tracking-tight whitespace-nowrap {stylingConfig.textColor}">
          {labelText}
        </span>

        {#if isBidirectional}
          <span title="Bidirecional (Mútuo)">
            <ArrowLeftRight class="w-2.5 h-2.5 text-zinc-400 shrink-0" />
          </span>
        {/if}

        {#if hasNotes}
          <span title="Possui notas do Mestre">
            <FileText class="w-2.5 h-2.5 text-amber-400/80 shrink-0" />
          </span>
        {/if}
      </button>

      <!-- Hover Action Buttons (Edit & Delete) -->
      <div class="hidden group-hover/edge:flex items-center gap-0.5 pl-1 border-l border-zinc-700/60 ml-0.5">
        <button
          type="button"
          onclick={handleOpenEditor}
          class="p-0.5 rounded text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
          title="Editar Relação"
        >
          <Pencil class="w-2.5 h-2.5" />
        </button>

        <button
          type="button"
          onclick={handleDelete}
          class="p-0.5 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer"
          title="Eliminar Ligação"
        >
          <Trash2 class="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  </div>
</EdgeLabelRenderer>
