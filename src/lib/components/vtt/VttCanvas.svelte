<!--
  src/lib/components/vtt/VttCanvas.svelte
  
  Mural Tactical Virtual Tabletop (VTT) Canvas Viewport
  Milestone 2: Hardware-Accelerated Viewport, Layer Stacking & Coordinate Bridging
  
  Architecture:
  - Viewport Container: infinite pan/zoom with pointer focal preservation
  - World Layer: CSS 3D transform (translate3d + scale), will-change: transform
  - Layer Stacking:
      Layer 1: Battlemap Background Image (img / fallback texture)
      Layer 2: Tactical Grid Overlay (subtle 70px / 1.5m guide)
      Layer 3: Fog of War Mask Canvas (FogCanvas.svelte)
      Layer 4: Circular Pawn Tokens (VttToken.svelte)
      Layer 5: Interactive SVG Overlay (VttRulerOverlay.svelte)
      Layer 6: Screen Space Floating HUD Controls & Metric Readout
  - Coordinate Bridging: screenToWorld & worldToScreen conversions
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    worldToScreen,
    screenToWorld,
    calculateZoomPan,
    calculateDistanceMeters,
    formatDistanceMeters,
    calculateAoeGeometry,
    measureRuler,
    isTokenVisibleToPlayer,
    authorizeTokenMove,
    TACTICAL_GRID_SIZE_PX,
    TACTICAL_PIXELS_PER_METER,
  } from '../../services/vtt/vttProtocol';
  import type {
    VttScene,
    VttToken,
    FogAction,
    VttPing,
    VttPoint,
    VttRulerMeasurement,
    VttAoEGeometry,
    VttAoEType,
  } from '../../types/vtt';
  import FogCanvas from './FogCanvas.svelte';
  import VttTokenItem from './VttToken.svelte';
  import VttRulerOverlay from './VttRulerOverlay.svelte';
  import {
    ZoomIn,
    ZoomOut,
    Maximize2,
    RotateCcw,
    Grid,
    Move,
    Compass,
    Navigation,
    Eye,
    EyeOff,
  } from 'lucide-svelte';

  // ==========================================================================
  // Props Definition (Svelte 5 Runes)
  // ==========================================================================
  interface Props {
    /** Tactical battlemap scene */
    scene: VttScene;
    /** Whether current user is the GM host */
    isGm?: boolean;
    /** Current peer ID (for ownership and stealth security checks) */
    myPeerId?: string;
    /** Current player character ID (if synced with Ordo) */
    myCharacterId?: string;
    /** Currently selected tactical tool */
    activeTool?:
      | 'select'
      | 'pan'
      | 'ruler'
      | 'aoe_circle'
      | 'aoe_cone'
      | 'aoe_line'
      | 'ping'
      | 'fog_brush_reveal'
      | 'fog_brush_hide'
      | 'fog_rect_reveal'
      | 'fog_rect_hide'
      | string;
    /** Brush radius for fog drawing tools in world pixels */
    brushRadius?: number;
    /** Whether to render the subtle 70px tactical grid */
    showGrid?: boolean;
    /** Active radar pings to render */
    pings?: VttPing[];
    /** ID of currently selected token */
    selectedTokenId?: string | null;
    /** Token movement callback */
    onTokenMove?: (tokenId: string, x: number, y: number, isFinal: boolean) => void;
    /** Token selection callback */
    onTokenSelect?: (tokenId: string | null) => void;
    /** Fog action applied callback */
    onFogAction?: (action: FogAction) => void;
    /** Radar ping broadcast callback */
    onPing?: (ping: VttPing) => void;
    /** Continuous ruler measurement callback */
    onRulerMeasure?: (measurement: VttRulerMeasurement | null) => void;
    /** Partial scene update callback (e.g. dimensions, background) */
    onSceneUpdate?: (partial: Partial<VttScene>) => void;
  }

  let {
    scene = $bindable(),
    isGm = false,
    myPeerId = '',
    myCharacterId = '',
    activeTool = 'select',
    brushRadius = 60,
    showGrid = true,
    pings = [],
    selectedTokenId = null,
    onTokenMove,
    onTokenSelect,
    onFogAction,
    onPing,
    onRulerMeasure,
    onSceneUpdate,
  }: Props = $props();

  // ==========================================================================
  // Viewport State (Pan & Zoom)
  // ==========================================================================
  let pan = $state<VttPoint>({ x: 0, y: 0 });
  let zoom = $state<number>(1.0); // Clamped between 0.15 and 4.0
  const MIN_ZOOM = 0.15;
  const MAX_ZOOM = 4.0;

  // Interaction tracking state
  let isPanning = $state<boolean>(false);
  let panStart = $state<VttPoint>({ x: 0, y: 0 });
  let isSpacePressed = $state<boolean>(false);
  let isImageLoaded = $state<boolean>(false);
  let isImageError = $state<boolean>(false);

  // Live cursor readout in world space
  let cursorWorld = $state<VttPoint>({ x: 0, y: 0 });
  const cursorMeters = $derived<{ x: string; y: string }>({
    x: formatDistanceMeters(cursorWorld.x / (scene?.scaleRatio || TACTICAL_PIXELS_PER_METER)),
    y: formatDistanceMeters(cursorWorld.y / (scene?.scaleRatio || TACTICAL_PIXELS_PER_METER)),
  });

  // Ruler & AoE Drafting State
  let isDraftingTool = $state<boolean>(false);
  let toolOrigin = $state<VttPoint | null>(null);
  let toolCurrent = $state<VttPoint | null>(null);

  // Token Dragging Measurement State
  let draggingToken = $state<VttToken | null>(null);
  let tokenDragOrigin = $state<VttPoint | null>(null);
  let tokenDragCurrent = $state<VttPoint | null>(null);

  // Element Bindings
  let containerEl = $state<HTMLDivElement | null>(null);
  let worldEl = $state<HTMLDivElement | null>(null);

  // Touch gesture state
  let initialTouchDist = $state<number | null>(null);
  let initialTouchZoom = $state<number>(1.0);
  let initialTouchMidpoint = $state<VttPoint | null>(null);

  // Long press ping timer
  let longPressTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  // ==========================================================================
  // Computed Derived Properties
  // ==========================================================================
  const sceneWidth = $derived(Math.max(800, scene?.width || 2048));
  const sceneHeight = $derived(Math.max(600, scene?.height || 1536));
  const ppm = $derived(scene?.scaleRatio && scene.scaleRatio > 0 ? scene.scaleRatio : TACTICAL_PIXELS_PER_METER);

  // Filter visible tokens based on anti-cheat stealth rules
  const visibleTokens = $derived<VttToken[]>(
    (scene?.tokens || []).filter((token) => {
      if (isGm) return true;
      return isTokenVisibleToPlayer(token, myPeerId);
    })
  );

  // Active continuous ruler measurement (if tool === 'ruler' and drafting)
  const activeRuler = $derived<VttRulerMeasurement | null>(
    isDraftingTool && activeTool === 'ruler' && toolOrigin && toolCurrent
      ? measureRuler(toolOrigin, toolCurrent, ppm)
      : null
  );

  // Active Area of Effect template (if tool is cone, circle, or line)
  const activeAoe = $derived<VttAoEGeometry | null>(
    isDraftingTool && (activeTool === 'aoe_circle' || activeTool === 'aoe_cone' || activeTool === 'aoe_line') && toolOrigin && toolCurrent
      ? calculateAoeGeometry(
          activeTool === 'aoe_circle' ? 'circle' : activeTool === 'aoe_cone' ? 'cone' : 'line',
          toolOrigin,
          toolCurrent,
          { pixelsPerMeter: ppm }
        )
      : null
  );

  // Active token drag measurement
  const tokenDragMeasure = $derived<{
    origin: VttPoint;
    current: VttPoint;
    distanceMeters: number;
    formattedMeters: string;
  } | null>(
    draggingToken && tokenDragOrigin && tokenDragCurrent
      ? {
          origin: tokenDragOrigin,
          current: tokenDragCurrent,
          distanceMeters: calculateDistanceMeters(tokenDragOrigin, tokenDragCurrent, ppm),
          formattedMeters: formatDistanceMeters(calculateDistanceMeters(tokenDragOrigin, tokenDragCurrent, ppm)),
        }
      : null
  );

  // Cursor style derived from current tool and key states
  const cursorClass = $derived<string>(
    isPanning
      ? 'cursor-grabbing'
      : isSpacePressed || activeTool === 'pan'
        ? 'cursor-grab'
        : activeTool === 'ruler' || activeTool.startsWith('aoe_')
          ? 'cursor-crosshair'
          : activeTool === 'ping'
            ? 'cursor-cell'
            : activeTool.startsWith('fog_') || activeTool.startsWith('brush_') || activeTool.startsWith('rect_')
              ? 'cursor-crosshair'
              : 'cursor-default'
  );

  // ==========================================================================
  // Coordinate Bridging Helpers
  // ==========================================================================

  /**
   * Converts viewport client coordinates to world battlemap coordinates.
   */
  export function toWorldCoords(screenPoint: VttPoint): VttPoint {
    return screenToWorld(screenPoint, pan, zoom);
  }

  /**
   * Converts world battlemap coordinates to viewport screen coordinates.
   */
  export function toScreenCoords(worldPoint: VttPoint): VttPoint {
    return worldToScreen(worldPoint, pan, zoom);
  }

  /**
   * Translates a DOM pointer event to world coordinates within the container.
   */
  function getPointerWorldPos(clientX: number, clientY: number): VttPoint {
    if (!containerEl) return { x: 0, y: 0 };
    const rect = containerEl.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    return screenToWorld({ x: screenX, y: screenY }, pan, zoom);
  }

  // ==========================================================================
  // Viewport Navigation: Pan, Zoom & Fit-to-Screen
  // ==========================================================================

  /**
   * Smooth pointer-anchored wheel zooming using calculateZoomPan.
   */
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (!containerEl) return;

    const rect = containerEl.getBoundingClientRect();
    const screenAnchor: VttPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * zoomFactor));

    // Calculate new pan to keep the world point directly under the pointer
    const newPan = calculateZoomPan(pan, zoom, targetZoom, screenAnchor);
    pan = newPan;
    zoom = targetZoom;
  }

  /**
   * Centers the viewport on a specific world point.
   */
  export function centerOnWorldPoint(point: VttPoint, targetZoom?: number) {
    if (!containerEl) return;
    const currentZ = targetZoom || zoom;
    const cW = containerEl.clientWidth;
    const cH = containerEl.clientHeight;

    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZ));
    pan = {
      x: cW / 2 - point.x * zoom,
      y: cH / 2 - point.y * zoom,
    };
  }

  /**
   * Centers the viewport smoothly on a specific token.
   */
  export function centerOnToken(token: VttToken) {
    centerOnWorldPoint({ x: token.x, y: token.y });
  }

  /**
   * Resets zoom to 1.0 and centers the battlemap scene.
   */
  export function resetView() {
    if (!containerEl) return;
    zoom = 1.0;
    pan = {
      x: (containerEl.clientWidth - sceneWidth) / 2,
      y: (containerEl.clientHeight - sceneHeight) / 2,
    };
  }

  /**
   * Automatically calculates optimal zoom and pan to fit the entire battlemap.
   */
  export function fitToScreen() {
    if (!containerEl) return;
    const cW = containerEl.clientWidth;
    const cH = containerEl.clientHeight;

    const scaleX = (cW * 0.92) / sceneWidth;
    const scaleY = (cH * 0.92) / sceneHeight;
    const fitZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)));

    zoom = fitZoom;
    pan = {
      x: (cW - sceneWidth * fitZoom) / 2,
      y: (cH - sceneHeight * fitZoom) / 2,
    };
  }

  function zoomStep(factor: number) {
    if (!containerEl) return;
    const screenCenter: VttPoint = {
      x: containerEl.clientWidth / 2,
      y: containerEl.clientHeight / 2,
    };
    const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    pan = calculateZoomPan(pan, zoom, targetZoom, screenCenter);
    zoom = targetZoom;
  }

  // ==========================================================================
  // Mouse & Pointer Event Handlers
  // ==========================================================================

  function handlePointerDown(e: PointerEvent) {
    // Suppress if event originated from a floating control or token interaction
    if ((e.target as HTMLElement).closest('.vtt-floating-control, .vtt-token-element')) {
      return;
    }

    const isMiddleClick = e.button === 1;
    const isRightClick = e.button === 2;
    const isPanTrigger =
      isMiddleClick ||
      isRightClick ||
      isSpacePressed ||
      activeTool === 'pan';

    // Start Panning
    if (isPanTrigger) {
      isPanning = true;
      panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      if (containerEl) {
        containerEl.setPointerCapture(e.pointerId);
      }
      return;
    }

    // Left click on canvas with primary tools
    if (e.button === 0) {
      const worldPos = getPointerWorldPos(e.clientX, e.clientY);

      // Radar Ping Tool
      if (activeTool === 'ping') {
        triggerPing(worldPos);
        return;
      }

      // Ruler & AoE Drafting Tools
      if (activeTool === 'ruler' || activeTool.startsWith('aoe_')) {
        isDraftingTool = true;
        toolOrigin = worldPos;
        toolCurrent = worldPos;
        if (containerEl) {
          containerEl.setPointerCapture(e.pointerId);
        }
        return;
      }

      // Default select tool: deselect active token
      if (activeTool === 'select') {
        onTokenSelect?.(null);
      }
    }
  }

  function handlePointerMove(e: PointerEvent) {
    // Update live world cursor position
    cursorWorld = getPointerWorldPos(e.clientX, e.clientY);

    // Active Panning
    if (isPanning) {
      pan = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      };
      return;
    }

    // Active Ruler / AoE Drafting
    if (isDraftingTool && toolOrigin) {
      toolCurrent = cursorWorld;
      if (activeTool === 'ruler') {
        onRulerMeasure?.(measureRuler(toolOrigin, toolCurrent, ppm));
      }
      return;
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (isPanning) {
      isPanning = false;
      try {
        containerEl?.releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (isDraftingTool) {
      isDraftingTool = false;
      toolOrigin = null;
      toolCurrent = null;
      onRulerMeasure?.(null);
      try {
        containerEl?.releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  // ==========================================================================
  // Touch Gestures (Pinch-to-Zoom & Two-Finger Pan)
  // ==========================================================================

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      initialTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      initialTouchZoom = zoom;

      if (containerEl) {
        const rect = containerEl.getBoundingClientRect();
        initialTouchMidpoint = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left,
          y: (t1.clientY + t2.clientY) / 2 - rect.top,
        };
      }
    } else if (e.touches.length === 1 && (activeTool === 'ping' || !isSpacePressed)) {
      // Long press (400ms) for tactical ping on touch devices
      const touch = e.touches[0];
      const worldPos = getPointerWorldPos(touch.clientX, touch.clientY);
      longPressTimer = setTimeout(() => {
        triggerPing(worldPos);
      }, 450);
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    if (e.touches.length === 2 && initialTouchDist && initialTouchMidpoint && containerEl) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scale = currentDist / initialTouchDist;
      const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialTouchZoom * scale));

      const rect = containerEl.getBoundingClientRect();
      const currentMidpoint: VttPoint = {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      };

      const newPan = calculateZoomPan(pan, zoom, targetZoom, currentMidpoint);
      pan = {
        x: newPan.x + (currentMidpoint.x - initialTouchMidpoint.x),
        y: newPan.y + (currentMidpoint.y - initialTouchMidpoint.y),
      };
      zoom = targetZoom;
    }
  }

  function handleTouchEnd() {
    initialTouchDist = null;
    initialTouchMidpoint = null;
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  // ==========================================================================
  // Tactical Radar Ping Trigger
  // ==========================================================================

  function triggerPing(worldPoint: VttPoint) {
    const ping: VttPing = {
      id: `ping-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      x: worldPoint.x,
      y: worldPoint.y,
      color: isGm ? '#f59e0b' : '#38bdf8', // Amber for GM, Sky Blue for players
      senderId: myPeerId || 'local',
      senderName: isGm ? 'Mestre' : 'Jogador',
      timestamp: Date.now(),
      durationMs: 2500,
    };
    onPing?.(ping);
  }

  // ==========================================================================
  // Token Drag Event Coordination
  // ==========================================================================

  function handleTokenDragStart(token: VttToken, startPos: VttPoint) {
    draggingToken = token;
    tokenDragOrigin = { ...startPos };
    tokenDragCurrent = { ...startPos };
    onTokenSelect?.(token.id);
  }

  function handleTokenDragMove(token: VttToken, currentPos: VttPoint) {
    tokenDragCurrent = { ...currentPos };
    token.x = currentPos.x;
    token.y = currentPos.y;
    onTokenMove?.(token.id, currentPos.x, currentPos.y, false);
  }

  function handleTokenDragEnd(token: VttToken, finalPos: VttPoint) {
    draggingToken = null;
    tokenDragOrigin = null;
    tokenDragCurrent = null;
    token.x = finalPos.x;
    token.y = finalPos.y;
    onTokenMove?.(token.id, finalPos.x, finalPos.y, true);
  }

  // ==========================================================================
  // Background Image Handling & Auto-Dimensions
  // ==========================================================================

  function handleImageLoad(e: Event) {
    isImageLoaded = true;
    isImageError = false;
    const img = e.currentTarget as HTMLImageElement;
    if (img.naturalWidth && img.naturalHeight) {
      // If scene dimensions were uninitialized or default (2800x2000 / 2048x1536), sync with natural resolution
      const isDefaultDim =
        !scene.width ||
        !scene.height ||
        (scene.width === 2800 && scene.height === 2000) ||
        (scene.width === 2048 && scene.height === 1536);

      if (isDefaultDim || scene.width !== img.naturalWidth) {
        onSceneUpdate?.({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      }
      // Automatically fit map into viewport on first load so nothing is cut off
      tick().then(() => fitToScreen());
    }
  }

  function handleImageError() {
    isImageLoaded = false;
    isImageError = true;
  }

  // ==========================================================================
  // Keyboard Shortcuts (Spacebar Pan, WASD Nudges, + / - Zoom)
  // ==========================================================================

  function handleKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.code === 'Space' && !e.repeat) {
      isSpacePressed = true;
    } else if (e.key === '+' || e.key === '=') {
      zoomStep(1.15);
    } else if (e.key === '-' || e.key === '_') {
      zoomStep(0.85);
    } else if (e.key === '0') {
      resetView();
    } else if (e.key === 'f' || e.key === 'F') {
      fitToScreen();
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      isSpacePressed = false;
      if (isPanning && activeTool !== 'pan') {
        isPanning = false;
      }
    }
  }

  // ==========================================================================
  // Lifecycle & Non-Passive Wheel Event Registration
  // ==========================================================================

  $effect(() => {
    const el = containerEl;
    if (!el) return;

    // Register wheel listener with passive: false so preventDefault works reliably
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  });

  onMount(() => {
    // Initial fit-to-screen on battlemap mount
    tick().then(() => {
      fitToScreen();
    });
  });
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

<!--
  Viewport Container:
  Receives pointer/touch events, supports infinite pan and zoom.
-->
<div
  bind:this={containerEl}
  class="vtt-canvas-viewport relative w-full h-full bg-[#080a0f] overflow-hidden select-none outline-none {cursorClass}"
  tabindex="-1"
  role="region"
  aria-label="Tactical Virtual Tabletop Battlemap Canvas"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  ontouchcancel={handleTouchEnd}
  oncontextmenu={(e) => e.preventDefault()}
>
  <!--
    Hardware-Accelerated World Container:
    CSS 3D transform with transform-origin: 0 0 and will-change: transform
  -->
  <div
    bind:this={worldEl}
    class="vtt-world-container absolute top-0 left-0 transition-transform duration-0 ease-linear origin-top-left"
    style="
      transform: translate3d({pan.x}px, {pan.y}px, 0px) scale({zoom});
      width: {sceneWidth}px;
      height: {sceneHeight}px;
      will-change: transform;
    "
  >
    <!-- ================================================================== -->
    <!-- LAYER 1: Battlemap Background Layer                                -->
    <!-- ================================================================== -->
    <div
      class="vtt-layer-background absolute inset-0 z-0 overflow-hidden bg-zinc-950 shadow-2xl pointer-events-none"
      style="width: {sceneWidth}px; height: {sceneHeight}px;"
    >
      {#if scene?.backgroundUrl}
        <img
          src={scene.backgroundUrl}
          alt={scene.name || 'Battlemap'}
          class="w-full h-full object-fill filter brightness-95 contrast-105 select-none"
          onload={handleImageLoad}
          onerror={handleImageError}
          draggable="false"
        />
      {:else}
        <!-- Default Tactical Dark Grid Texture Fallback -->
        <div class="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-600 border border-zinc-800">
          <div class="text-center p-6">
            <p class="text-sm font-medium text-zinc-400">Nenhum mapa carregado</p>
            <p class="text-xs text-zinc-600 mt-1">Carregue uma imagem no painel de cenas</p>
          </div>
        </div>
      {/if}
    </div>

    <!-- ================================================================== -->
    <!-- LAYER 2: Subtle Tactical Grid Overlay (1.5m / 70px standard scale) -->
    <!-- ================================================================== -->
    {#if showGrid}
      <svg
        class="vtt-layer-grid absolute inset-0 z-10 pointer-events-none opacity-20"
        width={sceneWidth}
        height={sceneHeight}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="vtt-tactical-grid-pattern"
            width={TACTICAL_GRID_SIZE_PX}
            height={TACTICAL_GRID_SIZE_PX}
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M {TACTICAL_GRID_SIZE_PX} 0 L 0 0 0 {TACTICAL_GRID_SIZE_PX}"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
              class="text-zinc-400"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#vtt-tactical-grid-pattern)" />
      </svg>
    {/if}

    <!-- ================================================================== -->
    <!-- LAYER 3: Dual-View Fog of War Canvas (FogCanvas.svelte)            -->
    <!-- ================================================================== -->
    <div
      class="vtt-layer-fog absolute inset-0 z-20 {activeTool.startsWith('fog_') || activeTool.startsWith('brush_') || activeTool.startsWith('rect_') ? 'pointer-events-auto' : 'pointer-events-none'}"
      style="width: {sceneWidth}px; height: {sceneHeight}px;"
    >
      <FogCanvas
        {sceneWidth}
        {sceneHeight}
        fogActions={scene?.fogActions || []}
        {isGm}
        {activeTool}
        {brushRadius}
        onFogAction={(action) => onFogAction?.(action)}
      />
    </div>

    <!-- ================================================================== -->
    <!-- LAYER 4: Circular Pawn Tokens (VttToken.svelte)                   -->
    <!-- ================================================================== -->
    <div
      class="vtt-layer-tokens absolute inset-0 z-30 pointer-events-none"
      style="width: {sceneWidth}px; height: {sceneHeight}px;"
    >
      {#each visibleTokens as token (token.id)}
        <div class="pointer-events-auto">
          <VttTokenItem
            {token}
            {isGm}
            isOwned={
              isGm ||
              (Boolean(myPeerId) && token.ownerPeerId === myPeerId) ||
              (Boolean(myCharacterId) && (
                token.characterId === myCharacterId ||
                token.name.toLowerCase() === myCharacterId.toLowerCase()
              )) ||
              (token.type === 'character' && visibleTokens.filter(t => t.type === 'character').length === 1)
            }
            {zoom}
            isSelected={selectedTokenId === token.id}
            onSelect={(t) => onTokenSelect?.(t.id)}
            onDragStart={(t, pos) => handleTokenDragStart(t, pos)}
            onDragMove={(t, pos) => handleTokenDragMove(t, pos)}
            onDragEnd={(t, pos) => handleTokenDragEnd(t, pos)}
          />
        </div>
      {/each}
    </div>

    <!-- ================================================================== -->
    <!-- LAYER 5: Interactive Tactical SVG Overlay (VttRulerOverlay.svelte)  -->
    <!-- ================================================================== -->
    <div
      class="vtt-layer-ruler absolute inset-0 z-40 pointer-events-none"
      style="width: {sceneWidth}px; height: {sceneHeight}px;"
    >
      <VttRulerOverlay
        {sceneWidth}
        {sceneHeight}
        {zoom}
        {pan}
        {activeTool}
        {pings}
        {activeRuler}
        {activeAoe}
        {tokenDragMeasure}
      />
    </div>
  </div>

  <!-- ==================================================================== -->
  <!-- LAYER 6: Screen Space Floating HUD Controls & Metric Readout         -->
  <!-- ==================================================================== -->
  <!-- Top-Right Viewport Controls -->
  <div
    class="vtt-floating-control absolute top-4 right-4 z-50 flex flex-col gap-1.5 bg-zinc-900/90 border border-zinc-800/90 p-1.5 rounded-xl backdrop-blur-md shadow-2xl text-zinc-300"
  >
    <button
      onclick={() => zoomStep(1.2)}
      title="Aproximar (+)"
      class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
    >
      <ZoomIn class="w-4 h-4" />
    </button>
    <button
      onclick={() => zoomStep(0.8)}
      title="Afastar (-)"
      class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
    >
      <ZoomOut class="w-4 h-4" />
    </button>
    <button
      onclick={fitToScreen}
      title="Ajustar ao Ecrã (F)"
      class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
    >
      <Maximize2 class="w-4 h-4" />
    </button>
    <button
      onclick={resetView}
      title="Repor 100% (0)"
      class="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
    >
      <RotateCcw class="w-4 h-4" />
    </button>
    <div class="my-0.5 border-t border-zinc-800"></div>
    <button
      onclick={() => (showGrid = !showGrid)}
      title="Alternar Grelha Tática"
      class="w-8 h-8 rounded-lg {showGrid ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100'} flex items-center justify-center transition cursor-pointer"
    >
      <Grid class="w-4 h-4" />
    </button>
  </div>

  <!-- Bottom-Left Tactical Metric Readout & Coordinates -->
  <div
    class="vtt-floating-control absolute bottom-4 left-4 z-50 flex items-center gap-3 bg-zinc-950/80 border border-zinc-800/80 px-3 py-1.5 rounded-xl backdrop-blur-md shadow-lg text-[11px] text-zinc-400 pointer-events-none select-none font-mono"
  >
    <span class="flex items-center gap-1 text-zinc-300">
      <Navigation class="w-3.5 h-3.5 text-amber-400" />
      <span>{cursorMeters.x}, {cursorMeters.y}</span>
    </span>
    <span class="text-zinc-700">|</span>
    <span>Zoom: {Math.round(zoom * 100)}%</span>
    <span class="text-zinc-700">|</span>
    <span class="text-zinc-500">Escala: 70px = 1.5m</span>
  </div>

  <!-- Spacebar Panning Mode Pill Indicator -->
  {#if isSpacePressed}
    <div
      class="vtt-floating-control absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs px-3 py-1 rounded-full backdrop-blur-md shadow-lg flex items-center gap-1.5 pointer-events-none animate-pulse"
    >
      <Move class="w-3.5 h-3.5" />
      <span>Modo Panorâmica Ativo (Barra de Espaço)</span>
    </div>
  {/if}
</div>
