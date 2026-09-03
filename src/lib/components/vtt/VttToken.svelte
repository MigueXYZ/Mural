<!--
  src/lib/components/vtt/VttToken.svelte
  
  Circular Tactical Pawn Token Component for Mural Virtual Tabletop (VTT).
  Implements Requirements R1 (Tokens, Sizes, Bars, Badges, Stealth, Gridless Movement)
  and R2 (Ownership & Movement Authorization).
  
  Svelte 5 Runes: $props, $state, $derived, $effect.
-->

<script lang="ts">
  import type { VttToken, VttTokenSize } from '../../types/vtt';
  import { VTT_TOKEN_SIZES } from '../../types/vtt';
  import {
    calculateDistanceMeters,
    formatDistanceMeters,
  } from '../../services/vtt/vttProtocol';
  import {
    Eye,
    EyeOff,
    Ghost,
    Skull,
    AlertTriangle,
    Droplet,
    Moon,
    ShieldAlert,
    Lock,
    Flame,
    Zap,
    User,
    Sparkles,
  } from 'lucide-svelte';

  interface Props {
    /** The token data model */
    token: VttToken;
    /** Whether the current client is the GM Host */
    isGm?: boolean;
    /** Whether the current client is the authorized owner of this token */
    isOwned?: boolean;
    /** Current zoom level of the tactical canvas */
    zoom?: number;
    /** Whether this token is currently selected on the canvas */
    isSelected?: boolean;
    /** Read-only mode (disables dragging and editing) */
    readOnly?: boolean;

    /** Callbacks for movement and dragging */
    onTokenMove?: (
      tokenId: string,
      x: number,
      y: number,
      isFinal: boolean,
      distanceMeters?: number
    ) => void;
    onDragStart?: (token: VttToken, startPos: { x: number; y: number }) => void;
    onDragMove?: (
      token: VttToken,
      currentPos: { x: number; y: number },
      distanceMeters?: number
    ) => void;
    onDrag?: (
      token: VttToken,
      currentPos: { x: number; y: number },
      distanceMeters: number
    ) => void;
    onDragEnd?: (
      token: VttToken,
      finalPos: { x: number; y: number },
      distanceMeters: number
    ) => void;

    /** Selection and action callbacks */
    onSelect?: (token: VttToken) => void;
    onTokenSelect?: (tokenId: string, e?: MouseEvent | PointerEvent) => void;
    onToggleStealth?: (tokenId: string, newStealth: boolean) => void;
    onConditionToggle?: (tokenId: string, condition: string) => void;
  }

  let {
    token,
    isGm = false,
    isOwned = false,
    zoom = 1.0,
    isSelected = false,
    readOnly = false,
    onTokenMove,
    onDragStart,
    onDragMove,
    onDrag,
    onDragEnd,
    onSelect,
    onTokenSelect,
    onToggleStealth,
    onConditionToggle,
  }: Props = $props();

  // --- Svelte 5 Local Reactive State ---
  let isDragging = $state(false);
  let isHovered = $state(false);
  let showStatsTooltip = $state(false);

  // Drag coordinates tracking
  let dragOriginWorld = $state<{ x: number; y: number }>({ x: 0, y: 0 });
  let dragCurrentWorld = $state<{ x: number; y: number }>({ x: 0, y: 0 });
  let dragStartPointer = $state<{ x: number; y: number }>({ x: 0, y: 0 });
  let dragDistanceMeters = $state(0);

  // --- Svelte 5 Derived Calculations ---
  // Token Size Configuration (Pequeno 56px, Médio 70px, Grande 140px, Enorme 210px)
  const sizeConfig = $derived(
    VTT_TOKEN_SIZES[token.size] ?? VTT_TOKEN_SIZES.medio
  );
  const diameter = $derived(sizeConfig.diameterPx);

  // Authority check: GM has universal control; Player may only move owned pawns
  const canMove = $derived(!readOnly && (isGm || isOwned));

  // Current visual position: during dragging use local coordinates; otherwise token.x/y
  const currentX = $derived(isDragging ? dragCurrentWorld.x : token.x);
  const currentY = $derived(isDragging ? dragCurrentWorld.y : token.y);

  // PV (Pontos de Vida) percentages and colors
  const pvCurrent = $derived(token.pv?.current ?? 0);
  const pvMax = $derived(Math.max(1, token.pv?.max ?? 1));
  const pvPercent = $derived(Math.min(100, Math.max(0, (pvCurrent / pvMax) * 100)));
  const pvTemp = $derived(token.pv?.temp ?? 0);
  const pvTempPercent = $derived(Math.min(100, Math.max(0, (pvTemp / pvMax) * 100)));

  const pvBarColor = $derived(
    pvPercent > 50
      ? 'bg-emerald-500'
      : pvPercent > 25
      ? 'bg-amber-500'
      : 'bg-rose-600'
  );

  // Sanidade (Sanity) percentage and color
  const sanCurrent = $derived(token.san?.current ?? 0);
  const sanMax = $derived(Math.max(1, token.san?.max ?? 1));
  const sanPercent = $derived(Math.min(100, Math.max(0, (sanCurrent / sanMax) * 100)));

  // Fallback initials if no image is present
  const initials = $derived(
    token.name
      ? token.name
          .split(' ')
          .filter(Boolean)
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : '?'
  );

  // Condition metadata map
  const CONDITION_CONFIG: Record<
    string,
    { icon: any; bg: string; text: string; border: string }
  > = {
    Abalado: {
      icon: AlertTriangle,
      bg: 'bg-amber-950/90',
      text: 'text-amber-300',
      border: 'border-amber-500/80',
    },
    Sangrando: {
      icon: Droplet,
      bg: 'bg-rose-950/90',
      text: 'text-rose-300',
      border: 'border-rose-500/80',
    },
    Inconsciente: {
      icon: Moon,
      bg: 'bg-indigo-950/90',
      text: 'text-indigo-300',
      border: 'border-indigo-500/80',
    },
    Morrendo: {
      icon: Skull,
      bg: 'bg-red-950/95',
      text: 'text-red-400',
      border: 'border-red-600',
    },
    Cego: {
      icon: EyeOff,
      bg: 'bg-zinc-900/90',
      text: 'text-zinc-300',
      border: 'border-zinc-500/80',
    },
    Paralisado: {
      icon: Lock,
      bg: 'bg-cyan-950/90',
      text: 'text-cyan-300',
      border: 'border-cyan-500/80',
    },
    Envenenado: {
      icon: Skull,
      bg: 'bg-emerald-950/90',
      text: 'text-emerald-300',
      border: 'border-emerald-500/80',
    },
    Vulnerável: {
      icon: ShieldAlert,
      bg: 'bg-orange-950/90',
      text: 'text-orange-300',
      border: 'border-orange-500/80',
    },
    Fatigado: {
      icon: AlertTriangle,
      bg: 'bg-yellow-950/90',
      text: 'text-yellow-300',
      border: 'border-yellow-500/80',
    },
    Surpreendido: {
      icon: Zap,
      bg: 'bg-purple-950/90',
      text: 'text-purple-300',
      border: 'border-purple-500/80',
    },
    Desesperado: {
      icon: Flame,
      bg: 'bg-fuchsia-950/90',
      text: 'text-fuchsia-300',
      border: 'border-fuchsia-500/80',
    },
  };

  // Visible conditions list
  const activeConditions = $derived(token.conditions || []);

  // --- Pointer Drag Event Handlers ---
  function handlePointerDown(e: PointerEvent) {
    // Only respond to primary mouse button (Left Click)
    if (e.button !== 0) return;

    if (onSelect) {
      onSelect(token);
    }
    if (onTokenSelect) {
      onTokenSelect(token.id, e);
    }

    if (!canMove) return;

    // Stop propagation so canvas panning does not also trigger
    e.stopPropagation();

    // Capture pointer events for reliable drag tracking even outside container
    const target = e.currentTarget as HTMLElement;
    if (target.setPointerCapture) {
      target.setPointerCapture(e.pointerId);
    }

    isDragging = true;
    dragOriginWorld = { x: token.x, y: token.y };
    dragCurrentWorld = { x: token.x, y: token.y };
    dragStartPointer = { x: e.clientX, y: e.clientY };
    dragDistanceMeters = 0;

    if (onDragStart) {
      onDragStart(token, dragOriginWorld);
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    e.stopPropagation();

    const safeZoom = zoom > 0 ? zoom : 1.0;
    const deltaX = (e.clientX - dragStartPointer.x) / safeZoom;
    const deltaY = (e.clientY - dragStartPointer.y) / safeZoom;

    dragCurrentWorld = {
      x: dragOriginWorld.x + deltaX,
      y: dragOriginWorld.y + deltaY,
    };

    dragDistanceMeters = calculateDistanceMeters(dragOriginWorld, dragCurrentWorld);

    if (onDrag) {
      onDrag(token, dragCurrentWorld, dragDistanceMeters);
    }
    if (onDragMove) {
      onDragMove(token, dragCurrentWorld, dragDistanceMeters);
    }

    // Optional real-time preview sync
    if (onTokenMove) {
      onTokenMove(token.id, dragCurrentWorld.x, dragCurrentWorld.y, false, dragDistanceMeters);
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDragging) return;
    e.stopPropagation();

    isDragging = false;
    const target = e.currentTarget as HTMLElement;
    if (target.releasePointerCapture) {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }

    const finalDistance = calculateDistanceMeters(dragOriginWorld, dragCurrentWorld);

    if (onDragEnd) {
      onDragEnd(token, dragCurrentWorld, finalDistance);
    }

    if (onTokenMove) {
      onTokenMove(token.id, dragCurrentWorld.x, dragCurrentWorld.y, true, finalDistance);
    }
  }

  function handlePointerCancel(e: PointerEvent) {
    if (!isDragging) return;
    cancelDrag();
  }

  function cancelDrag() {
    isDragging = false;
    dragCurrentWorld = { x: dragOriginWorld.x, y: dragOriginWorld.y };
    dragDistanceMeters = 0;

    if (onDragEnd) {
      onDragEnd(token, dragOriginWorld, 0);
    }
    if (onTokenMove) {
      onTokenMove(token.id, dragOriginWorld.x, dragOriginWorld.y, true, 0);
    }
  }

  // Keyboard support: Escape cancels dragging
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isDragging) {
      e.stopPropagation();
      cancelDrag();
    }
  }

  function handleStealthToggleClick(e: MouseEvent) {
    e.stopPropagation();
    if (!isGm && !isOwned) return;
    const nextStealth = !token.isStealth;
    if (onToggleStealth) {
      onToggleStealth(token.id, nextStealth);
    }
  }

  function handleConditionClick(condition: string, e: MouseEvent) {
    e.stopPropagation();
    if (isGm && onConditionToggle) {
      onConditionToggle(token.id, condition);
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- Token World Element -->
<div
  class="vtt-token-element absolute select-none pointer-events-auto transition-transform duration-75 ease-out {canMove
    ? 'cursor-grab active:cursor-grabbing'
    : 'cursor-pointer'}"
  style="
    left: {currentX}px;
    top: {currentY}px;
    width: {diameter}px;
    height: {diameter}px;
    transform: translate(-50%, -50%) {isDragging ? 'scale(1.06)' : 'scale(1)'};
    z-index: {isDragging ? 40 : isSelected ? 30 : 20};
  "
  role="button"
  tabindex="0"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => {
    isHovered = false;
    showStatsTooltip = false;
  }}
>
  <!-- 1. DUAL VITAL RESOURCE BARS (PV & SANIDADE) -->
  <div
    class="absolute -top-5 left-1/2 -translate-x-1/2 flex flex-col gap-0.5 w-[90%] min-w-[50px] max-w-[120px] pointer-events-none z-10"
  >
    <!-- PV Bar (Pontos de Vida) -->
    <div
      class="h-1.5 w-full bg-zinc-950/80 rounded-full border border-zinc-700/80 overflow-hidden relative shadow-sm"
      title="PV: {pvCurrent}/{pvMax} {pvTemp > 0 ? `(+${pvTemp} Temp)` : ''}"
    >
      <div
        class="h-full {pvBarColor} transition-all duration-200"
        style="width: {pvPercent}%;"
      ></div>
      {#if pvTemp > 0}
        <div
          class="absolute top-0 right-0 h-full bg-cyan-400/90"
          style="width: {pvTempPercent}%;"
        ></div>
      {/if}
    </div>

    <!-- Sanidade Bar -->
    <div
      class="h-1.5 w-full bg-zinc-950/80 rounded-full border border-zinc-700/80 overflow-hidden shadow-sm"
      title="Sanidade: {sanCurrent}/{sanMax}"
    >
      <div
        class="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-200"
        style="width: {sanPercent}%;"
      ></div>
    </div>
  </div>

  <!-- 2. CIRCULAR PAWN BODY & COLOR RING -->
  <div
    class="w-full h-full rounded-full relative flex items-center justify-center overflow-hidden transition-all duration-150 {token.isStealth
      ? 'border-dashed border-2 border-cyan-400/90 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
      : 'border-[3px]'}"
    style="
      border-color: {token.isStealth ? undefined : token.color || '#38bdf8'};
      box-shadow: {token.isStealth
        ? undefined
        : `0 0 10px ${token.color || '#38bdf8'}66, 0 4px 8px -2px rgba(0,0,0,0.6)`};
      opacity: {token.isStealth ? 0.55 : 1.0};
      background: radial-gradient(circle, #27272a 0%, #09090b 100%);
    "
  >
    <!-- Avatar Image or Fallback Initials -->
    {#if token.imageUrl}
      <img
        src={token.imageUrl}
        alt={token.name}
        class="w-full h-full object-cover rounded-full select-none pointer-events-none"
        draggable="false"
      />
    {:else}
      <div class="flex flex-col items-center justify-center select-none">
        {#if token.type === 'monster'}
          <Skull class="w-1/2 h-1/2 text-rose-400/80" />
        {:else if token.type === 'npc'}
          <User class="w-1/2 h-1/2 text-amber-400/80" />
        {:else}
          <span
            class="font-black text-zinc-100 tracking-wider"
            style="font-size: {Math.max(12, Math.round(diameter * 0.32))}px;"
          >
            {initials}
          </span>
        {/if}
      </div>
    {/if}

    <!-- Rotation / Facing Indicator Pip -->
    {#if token.rotation !== undefined}
      <div
        class="absolute inset-0 pointer-events-none"
        style="transform: rotate({token.rotation}deg);"
      >
        <div
          class="absolute top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-400 rounded-full shadow-md"
        ></div>
      </div>
    {/if}
  </div>

  <!-- 3. SELECTION RING HIGHLIGHT -->
  {#if isSelected}
    <div
      class="absolute -inset-1 rounded-full border-2 border-amber-400 animate-pulse pointer-events-none shadow-[0_0_10px_rgba(251,191,36,0.6)]"
    ></div>
  {/if}

  <!-- 4. GM STEALTH VISUAL INDICATOR & TOGGLE BUTTON -->
  {#if token.isStealth || (isGm && isHovered)}
    <button
      type="button"
      onclick={handleStealthToggleClick}
      title={token.isStealth ? 'Furtivo (Invisível aos jogadores) - Clique para revelar' : 'Tornar invisível aos jogadores'}
      class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer z-20 {token.isStealth
        ? 'bg-cyan-950 border border-cyan-400 text-cyan-300'
        : 'bg-zinc-900/90 border border-zinc-700 text-zinc-400 hover:text-zinc-200'}"
    >
      {#if token.isStealth}
        <Ghost class="w-3 h-3" />
      {:else}
        <Eye class="w-3 h-3" />
      {/if}
    </button>
  {/if}

  <!-- 5. CONDITION BADGES CLUSTER -->
  {#if activeConditions.length > 0}
    <div
      class="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1 z-20 pointer-events-auto"
    >
      {#each activeConditions.slice(0, 3) as condition}
        {@const conf = CONDITION_CONFIG[condition] || {
          icon: AlertTriangle,
          bg: 'bg-zinc-900',
          text: 'text-zinc-200',
          border: 'border-zinc-600',
        }}
        <button
          type="button"
          onclick={(e) => handleConditionClick(condition, e)}
          title="{condition}{isGm ? ' (Clique para remover)' : ''}"
          class="w-4 h-4 rounded-full flex items-center justify-center border {conf.bg} {conf.border} {conf.text} shadow-sm transition-transform hover:scale-125 cursor-pointer"
        >
          <conf.icon class="w-2.5 h-2.5" />
        </button>
      {/each}

      {#if activeConditions.length > 3}
        <div
          class="h-4 px-1 rounded-full bg-zinc-950 border border-zinc-700 text-[9px] font-bold text-zinc-300 flex items-center justify-center shadow"
          title={activeConditions.slice(3).join(', ')}
        >
          +{activeConditions.length - 3}
        </div>
      {/if}
    </div>
  {/if}

  <!-- 6. FLOATING NAMEPLATE -->
  <div
    class="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-xs border border-zinc-800 text-zinc-200 text-[10px] font-semibold tracking-wide whitespace-nowrap shadow-md pointer-events-none max-w-[130px] truncate"
  >
    {token.name}
  </div>

  <!-- 7. HOVER STATS TOOLTIP -->
  {#if isHovered && !isDragging}
    <div
      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-7 px-2.5 py-1.5 rounded-lg bg-zinc-950/95 backdrop-blur-md border border-zinc-700 text-zinc-100 text-[11px] shadow-2xl pointer-events-none whitespace-nowrap z-50 flex flex-col gap-0.5"
    >
      <div class="font-bold text-zinc-200 flex items-center gap-1.5">
        <span
          class="w-2 h-2 rounded-full"
          style="background-color: {token.color || '#38bdf8'};"
        ></span>
        <span>{token.name}</span>
        <span class="text-[9px] text-zinc-400 font-normal">({sizeConfig.label})</span>
      </div>
      <div class="flex items-center gap-2 text-[10px] text-zinc-300 font-mono">
        <span class="text-emerald-400 font-semibold">
          PV: {pvCurrent}/{pvMax}
        </span>
        <span class="text-zinc-600">|</span>
        <span class="text-purple-400 font-semibold">
          SAN: {sanCurrent}/{sanMax}
        </span>
      </div>
      {#if activeConditions.length > 0}
        <div class="text-[9px] text-zinc-400 mt-0.5 flex items-center gap-1">
          <span class="text-zinc-500">Condições:</span>
          <span class="text-amber-300 font-medium">{activeConditions.join(', ')}</span>
        </div>
      {/if}
      {#if token.isStealth}
        <div class="text-[9px] text-cyan-300 flex items-center gap-1 mt-0.5">
          <Ghost class="w-2.5 h-2.5" />
          <span>Furtivo (Invisível para jogadores)</span>
        </div>
      {/if}
    </div>
  {/if}
</div>
