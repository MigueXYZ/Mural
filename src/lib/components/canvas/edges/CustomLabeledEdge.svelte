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
    useSvelteFlow,
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
    sourceHandleId = null,
    targetHandleId = null,
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
  }: EdgeProps & {
    data?: CanvasRelationEdgeData;
    sourceHandleId?: string | null;
    targetHandleId?: string | null;
  } = $props();

  // Svelte Flow instance for screen-to-flow coordinate conversion
  let svelteFlowInstance: ReturnType<typeof useSvelteFlow> | null = null;
  try {
    svelteFlowInstance = useSvelteFlow();
  } catch {
    // Graceful fallback when outside SvelteFlow context
  }

  function screenToFlow(clientPos: { x: number; y: number }) {
    if (svelteFlowInstance?.screenToFlowPosition) {
      return svelteFlowInstance.screenToFlowPosition(clientPos);
    }
    return clientPos;
  }

  // Reconnection Drag State (R4)
  let isReconnecting = $state(false);
  let reconnectEndpoint = $state<'source' | 'target' | null>(null);
  let liveCursorPos = $state<{ x: number; y: number } | null>(null);

  const edgeOffset = $derived(typeof data?.offset === 'number' ? data.offset : 20);

  // 1. Reactive relationship config
  const relationType = $derived<RelationType>(data?.relationType || 'neutral');
  const pathType = $derived(data?.pathType || 'smoothstep');
  const labelText = $derived(data?.label || 'ligação');
  const isBidirectional = $derived(Boolean(data?.bidirectional));
  const hasNotes = $derived(Boolean(data?.notes && data.notes.trim().length > 0));

  // 2. Path & Midpoint Calculation
  const pathResult = $derived.by(() => {
    const activeSourceX =
      isReconnecting && reconnectEndpoint === 'source' && liveCursorPos ? liveCursorPos.x : sourceX;
    const activeSourceY =
      isReconnecting && reconnectEndpoint === 'source' && liveCursorPos ? liveCursorPos.y : sourceY;
    const activeTargetX =
      isReconnecting && reconnectEndpoint === 'target' && liveCursorPos ? liveCursorPos.x : targetX;
    const activeTargetY =
      isReconnecting && reconnectEndpoint === 'target' && liveCursorPos ? liveCursorPos.y : targetY;

    const params = {
      sourceX: activeSourceX,
      sourceY: activeSourceY,
      sourcePosition,
      targetX: activeTargetX,
      targetY: activeTargetY,
      targetPosition,
    };

    if (pathType === 'bezier') {
      const baseCurvature = typeof data?.curvature === 'number' ? data.curvature : 0.25;
      const curvature =
        typeof data?.offset === 'number' ? baseCurvature + (data.offset - 20) * 0.01 : baseCurvature;
      return getBezierPath({ ...params, curvature });
    } else if (pathType === 'straight') {
      return getStraightPath({
        sourceX: activeSourceX,
        sourceY: activeSourceY,
        targetX: activeTargetX,
        targetY: activeTargetY,
      });
    } else {
      // Default: smoothstep with rounded corners and routing offset (R5)
      return getSmoothStepPath({ ...params, borderRadius: 10, offset: edgeOffset });
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
          textColor: data?.textColor || data?.color ? '' : 'text-sky-300',
          iconColor: data?.textColor || data?.color ? '' : 'text-sky-400',
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
  const explicitTextColor = $derived(
    (data?.textColor as string) ||
      (relationType === 'custom' && data?.color ? (data.color as string) : undefined)
  );

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
    e.preventDefault();
    e.stopPropagation();
    campaignStore.deleteEdge(id);
  }

  // 5. Interactive Reconnection Logic (R4)
  function findCandidateHandle(clientX: number, clientY: number, snapRadius = 28) {
    if (typeof document === 'undefined') return null;

    // 1. Direct hit via elementsFromPoint
    const elements = document.elementsFromPoint(clientX, clientY);
    for (const el of elements) {
      const handleEl = el.closest('.svelte-flow__handle') as HTMLElement | null;
      if (handleEl) {
        const nodeId = handleEl.getAttribute('data-nodeid') || handleEl.dataset.nodeid;
        const handleId = handleEl.getAttribute('data-handleid') || handleEl.dataset.handleid;
        if (nodeId) {
          return { nodeId, handleId: handleId || null };
        }
      }
    }

    // 2. Proximity snap to closest .svelte-flow__handle within snapRadius
    const handles = document.querySelectorAll('.svelte-flow__handle');
    let closest: { nodeId: string; handleId: string | null } | null = null;
    let minDist = snapRadius;

    for (const handle of handles) {
      const rect = handle.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dist = Math.hypot(clientX - centerX, clientY - centerY);
      if (dist < minDist) {
        const nodeId = handle.getAttribute('data-nodeid') || (handle as HTMLElement).dataset.nodeid;
        const handleId = handle.getAttribute('data-handleid') || (handle as HTMLElement).dataset.handleid;
        if (nodeId) {
          minDist = dist;
          closest = { nodeId, handleId: handleId || null };
        }
      }
    }

    return closest;
  }

  function handleStartReconnect(e: PointerEvent, endpoint: 'source' | 'target') {
    e.stopPropagation();
    e.preventDefault();
    const btn = e.currentTarget as HTMLElement;
    if (btn.setPointerCapture) {
      btn.setPointerCapture(e.pointerId);
    }

    isReconnecting = true;
    reconnectEndpoint = endpoint;
    liveCursorPos = screenToFlow({ x: e.clientX, y: e.clientY });

    function onPointerMove(moveEvent: PointerEvent) {
      liveCursorPos = screenToFlow({ x: moveEvent.clientX, y: moveEvent.clientY });
    }

    function onPointerUp(upEvent: PointerEvent) {
      btn.removeEventListener('pointermove', onPointerMove);
      btn.removeEventListener('pointerup', onPointerUp);
      btn.removeEventListener('pointercancel', onPointerUp);
      if (btn.releasePointerCapture) {
        try {
          btn.releasePointerCapture(upEvent.pointerId);
        } catch {
          // ignore if already released
        }
      }

      const candidate = findCandidateHandle(upEvent.clientX, upEvent.clientY);
      if (candidate) {
        if (endpoint === 'source' && candidate.nodeId !== target) {
          campaignStore.reconnectEdge(id, {
            source: candidate.nodeId,
            target,
            sourceHandle: candidate.handleId,
            targetHandle: targetHandleId,
          });
        } else if (endpoint === 'target' && candidate.nodeId !== source) {
          campaignStore.reconnectEdge(id, {
            source,
            target: candidate.nodeId,
            sourceHandle: sourceHandleId,
            targetHandle: candidate.handleId,
          });
        }
      }

      isReconnecting = false;
      reconnectEndpoint = null;
      liveCursorPos = null;
    }

    btn.addEventListener('pointermove', onPointerMove);
    btn.addEventListener('pointerup', onPointerUp);
    btn.addEventListener('pointercancel', onPointerUp);
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
  {#if selected && !isFilteredOut}
    <!-- Source Reconnection Endpoint Handle -->
    <div
      style="position: absolute; transform: translate(-50%, -50%) translate({isReconnecting && reconnectEndpoint === 'source' && liveCursorPos ? liveCursorPos.x : sourceX}px, {isReconnecting && reconnectEndpoint === 'source' && liveCursorPos ? liveCursorPos.y : sourceY}px); pointer-events: all;"
      class="nodrag nopan z-30"
      data-testid="edge-reconnect-source"
    >
      <button
        type="button"
        onpointerdown={(e) => handleStartReconnect(e, 'source')}
        class="w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-zinc-950 shadow-[0_0_8px_rgba(251,191,36,0.8)] hover:scale-125 cursor-grab active:cursor-grabbing transition-transform flex items-center justify-center {isReconnecting && reconnectEndpoint === 'source' ? 'scale-125 ring-2 ring-amber-300' : ''}"
        title="Arrastar para reconectar origem"
        aria-label="Reconectar origem"
      >
        <span class="w-1 h-1 rounded-full bg-zinc-950 pointer-events-none"></span>
      </button>
    </div>

    <!-- Target Reconnection Endpoint Handle -->
    <div
      style="position: absolute; transform: translate(-50%, -50%) translate({isReconnecting && reconnectEndpoint === 'target' && liveCursorPos ? liveCursorPos.x : targetX}px, {isReconnecting && reconnectEndpoint === 'target' && liveCursorPos ? liveCursorPos.y : targetY}px); pointer-events: all;"
      class="nodrag nopan z-30"
      data-testid="edge-reconnect-target"
    >
      <button
        type="button"
        onpointerdown={(e) => handleStartReconnect(e, 'target')}
        class="w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-zinc-950 shadow-[0_0_8px_rgba(251,191,36,0.8)] hover:scale-125 cursor-grab active:cursor-grabbing transition-transform flex items-center justify-center {isReconnecting && reconnectEndpoint === 'target' ? 'scale-125 ring-2 ring-amber-300' : ''}"
        title="Arrastar para reconectar destino"
        aria-label="Reconectar destino"
      >
        <span class="w-1 h-1 rounded-full bg-zinc-950 pointer-events-none"></span>
      </button>
    </div>
  {/if}
  <div
    style="position: absolute; transform: translate(-50%, -50%) translate({labelX}px, {labelY}px); pointer-events: all; {isFilteredOut ? 'opacity: 0.08; pointer-events: none;' : ''}"
    class="nodrag nopan select-none group/edge z-20"
  >
    <div
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-md transition-all duration-150 {stylingConfig.badgeBg} {stylingConfig.badgeBorder} {stylingConfig.glowClass} {selected ? 'ring-2 ring-amber-400/80 scale-105' : 'hover:scale-105'}"
    >
      <!-- Clickable Label & Category Icon -->
      <button
        type="button"
        onclick={handleOpenEditor}
        ondblclick={handleOpenEditor}
        class="flex items-center gap-1.5 cursor-pointer text-left focus:outline-none"
        title="Duplo clique para editar ligação"
      >
        <IconComponent
          class="w-3 h-3 {explicitTextColor ? '' : stylingConfig.iconColor} shrink-0"
          style={explicitTextColor ? `color: ${explicitTextColor};` : undefined}
        />

        <span
          class="text-[11px] font-medium tracking-tight whitespace-nowrap {explicitTextColor ? '' : stylingConfig.textColor}"
          style={explicitTextColor ? `color: ${explicitTextColor};` : undefined}
        >
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

      <!-- Hover / Selection Action Buttons (Edit & Delete) -->
      <div class="{selected ? 'flex' : 'hidden group-hover/edge:flex'} items-center gap-0.5 pl-1 border-l border-zinc-700/60 ml-0.5">
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
