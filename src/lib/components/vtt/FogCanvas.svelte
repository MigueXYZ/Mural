<script lang="ts">
  /**
   * src/lib/components/vtt/FogCanvas.svelte
   * 
   * Tactical 2D Fog of War HTML5 Canvas Component for Mural VTT.
   * Implements Milestone 2 Tactical Canvas Requirements:
   * - Dual-View rendering: GM (opacity: 0.55, VTT_FOG_GM_OPACITY) vs Player (opacity: 1.0, solid #000000, VTT_FOG_PLAYER_OPACITY)
   * - Deterministic FogAction stream execution with Canvas 2D blend modes:
   *   * destination-out: cuts transparent holes in the fog (reveal_rect, reveal_brush)
   *   * source-over: adds black fog back (hide_rect, hide_brush, blanket_all)
   *   * clearRect: clears entire fog layer (clear_all)
   * - GM drawing tools (brush with 20px-200px radius, rect reveal/hide)
   * - Real-time interactive preview overlay while dragging
   * - Emits onFogAction(action) on stroke/drag completion
   */

  import {
    VTT_FOG_GM_OPACITY,
    VTT_FOG_PLAYER_OPACITY,
    VTT_FOG_COLOR,
    type FogAction,
    type FogActionType,
  } from '../../types/vtt';

  export type VttFogTool =
    | 'select'
    | 'brush_reveal'
    | 'brush_hide'
    | 'rect_reveal'
    | 'rect_hide'
    | 'fog_brush_reveal'
    | 'fog_brush_hide'
    | 'fog_rect_reveal'
    | 'fog_rect_hide';

  interface Props {
    /** Scene natural width in world pixels */
    sceneWidth?: number;
    /** Alias for sceneWidth */
    width?: number;
    /** Scene natural height in world pixels */
    sceneHeight?: number;
    /** Alias for sceneHeight */
    height?: number;
    /** Chronological history of geometric fog operations */
    fogActions?: FogAction[];
    /** Whether the current client has GM privileges */
    isGm?: boolean;
    /** Whether fog of war is enabled for this scene */
    isFogEnabled?: boolean;
    /** Currently active tool in the VTT workspace */
    activeTool?: VttFogTool | string;
    /** Brush radius in world pixels (clamped between 20 and 200) */
    brushRadius?: number;
    /** Whether canvas should start blanketed when actions array is empty */
    defaultBlanket?: boolean;
    /** Callback emitted when GM finishes drawing an action */
    onFogAction?: (action: FogAction) => void;
    /** Optional CSS class for the container */
    class?: string;
  }

  let {
    sceneWidth: rawSceneWidth,
    width: rawWidth,
    sceneHeight: rawSceneHeight,
    height: rawHeight,
    fogActions = [],
    isGm = false,
    isFogEnabled = true,
    activeTool = 'select',
    brushRadius = 50,
    defaultBlanket = true,
    onFogAction,
    class: className = '',
  }: Props = $props();

  const sceneWidth = $derived(rawSceneWidth ?? rawWidth ?? 2048);
  const sceneHeight = $derived(rawSceneHeight ?? rawHeight ?? 1536);

  // Canvas DOM references
  let fogCanvas = $state<HTMLCanvasElement | null>(null);
  let overlayCanvas = $state<HTMLCanvasElement | null>(null);

  // GM Drawing Interaction State
  let isDrawing = $state(false);
  let startPoint = $state<{ x: number; y: number } | null>(null);
  let currentPoint = $state<{ x: number; y: number } | null>(null);
  let brushPoints = $state<Array<{ x: number; y: number }>>([]);

  // Track rendered action count for incremental replay optimization
  let lastRenderedCount = 0;

  /**
   * Checks whether the given tool name represents an active GM fog manipulation tool.
   * Supports both plain ('brush_reveal') and prefixed ('fog_brush_reveal') tool strings.
   */
  export function isFogTool(tool: string): boolean {
    return (
      tool === 'brush_reveal' ||
      tool === 'brush_hide' ||
      tool === 'rect_reveal' ||
      tool === 'rect_hide' ||
      tool === 'fog_brush_reveal' ||
      tool === 'fog_brush_hide' ||
      tool === 'fog_rect_reveal' ||
      tool === 'fog_rect_hide'
    );
  }

  function isBrushTool(tool: string): boolean {
    return (
      tool === 'brush_reveal' ||
      tool === 'brush_hide' ||
      tool === 'fog_brush_reveal' ||
      tool === 'fog_brush_hide'
    );
  }

  function isRectTool(tool: string): boolean {
    return (
      tool === 'rect_reveal' ||
      tool === 'rect_hide' ||
      tool === 'fog_rect_reveal' ||
      tool === 'fog_rect_hide'
    );
  }

  function isRevealTool(tool: string): boolean {
    return (
      tool === 'brush_reveal' ||
      tool === 'rect_reveal' ||
      tool === 'fog_brush_reveal' ||
      tool === 'fog_rect_reveal'
    );
  }

  /**
   * Normalizes a rectangle so width and height are always positive.
   */
  function normalizeRect(rect: { x: number; y: number; width: number; height: number }) {
    const x = rect.width < 0 ? rect.x + rect.width : rect.x;
    const y = rect.height < 0 ? rect.y + rect.height : rect.y;
    const width = Math.abs(rect.width);
    const height = Math.abs(rect.height);
    return { x, y, width, height };
  }

  /**
   * Translates client pointer event coordinates into native world canvas coordinates.
   * Invariant to CSS scale, pan, margins, devicePixelRatio, and container offsets.
   */
  function getCanvasCoordinates(e: PointerEvent, canvasEl: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvasEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const scaleX = sceneWidth / rect.width;
    const scaleY = sceneHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  /**
   * Draws a continuous circular stroke along a sequence of points.
   */
  function drawBrushStroke(
    ctx: CanvasRenderingContext2D,
    points: Array<{ x: number; y: number }>,
    radius: number
  ) {
    if (!points || points.length === 0) return;

    const clampedRadius = Math.max(20, Math.min(200, radius));

    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, clampedRadius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.lineWidth = clampedRadius * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  /**
   * Applies a single deterministic FogAction onto the canvas context.
   */
  function applyFogAction(
    ctx: CanvasRenderingContext2D,
    action: FogAction,
    width: number,
    height: number
  ) {
    switch (action.type) {
      case 'blanket_all': {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = VTT_FOG_COLOR;
        ctx.fillRect(0, 0, width, height);
        break;
      }

      case 'clear_all': {
        ctx.clearRect(0, 0, width, height);
        break;
      }

      case 'reveal_rect': {
        if (!action.rect) break;
        const { x, y, width: rw, height: rh } = normalizeRect(action.rect);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = VTT_FOG_COLOR;
        ctx.fillRect(x, y, rw, rh);
        break;
      }

      case 'hide_rect': {
        if (!action.rect) break;
        const { x, y, width: rw, height: rh } = normalizeRect(action.rect);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = VTT_FOG_COLOR;
        ctx.fillRect(x, y, rw, rh);
        break;
      }

      case 'reveal_brush': {
        if (!action.points || action.points.length === 0) break;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = VTT_FOG_COLOR;
        ctx.strokeStyle = VTT_FOG_COLOR;
        drawBrushStroke(ctx, action.points, action.radius ?? 50);
        break;
      }

      case 'hide_brush': {
        if (!action.points || action.points.length === 0) break;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = VTT_FOG_COLOR;
        ctx.strokeStyle = VTT_FOG_COLOR;
        drawBrushStroke(ctx, action.points, action.radius ?? 50);
        break;
      }
    }
  }

  /**
   * Deterministic replay pass for all actions in the fogAction stream.
   */
  function renderAllFogActions(
    canvas: HTMLCanvasElement,
    actions: FogAction[],
    width: number,
    height: number,
    enabled: boolean,
    blanket: boolean
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset whole canvas
    ctx.clearRect(0, 0, width, height);

    if (!enabled) {
      lastRenderedCount = 0;
      return;
    }

    // Apply base fill if blanket is enabled
    if (blanket) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = VTT_FOG_COLOR;
      ctx.fillRect(0, 0, width, height);
    }

    // Deterministically execute all actions
    for (const action of actions) {
      applyFogAction(ctx, action, width, height);
    }

    lastRenderedCount = actions.length;
  }

  /**
   * Clears the GM preview overlay canvas.
   */
  function clearOverlay() {
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, sceneWidth, sceneHeight);
  }

  /**
   * Renders real-time visual feedback on the overlay canvas while GM is hovering or dragging.
   */
  function renderPreview() {
    if (!overlayCanvas || !isGm || !isFogTool(activeTool)) {
      clearOverlay();
      return;
    }

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, sceneWidth, sceneHeight);

    const clampedRadius = Math.max(20, Math.min(200, brushRadius));
    const isReveal = isRevealTool(activeTool);
    const primaryColor = isReveal ? '#06b6d4' : '#f43f5e';
    const fillColor = isReveal ? 'rgba(6, 182, 212, 0.25)' : 'rgba(244, 63, 94, 0.25)';

    if (isBrushTool(activeTool)) {
      // 1. Draw ongoing drag stroke path if dragging
      if (isDrawing && brushPoints.length > 0) {
        ctx.lineWidth = clampedRadius * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = fillColor;
        ctx.beginPath();
        ctx.moveTo(brushPoints[0].x, brushPoints[0].y);
        for (let i = 1; i < brushPoints.length; i++) {
          ctx.lineTo(brushPoints[i].x, brushPoints[i].y);
        }
        ctx.stroke();
      }

      // 2. Draw circular cursor reticle at pointer position
      if (currentPoint) {
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = primaryColor;
        ctx.fillStyle = fillColor;

        ctx.beginPath();
        ctx.arc(currentPoint.x, currentPoint.y, clampedRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash

        // Center crosshair
        ctx.beginPath();
        ctx.moveTo(currentPoint.x - 5, currentPoint.y);
        ctx.lineTo(currentPoint.x + 5, currentPoint.y);
        ctx.moveTo(currentPoint.x, currentPoint.y - 5);
        ctx.lineTo(currentPoint.x, currentPoint.y + 5);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else if (isRectTool(activeTool)) {
      // Draw rectangular bounding box while dragging
      if (isDrawing && startPoint && currentPoint) {
        const rect = normalizeRect({
          x: startPoint.x,
          y: startPoint.y,
          width: currentPoint.x - startPoint.x,
          height: currentPoint.y - startPoint.y,
        });

        ctx.fillStyle = fillColor;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = primaryColor;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.setLineDash([]);

        // Small metric label
        if (rect.width > 30 && rect.height > 20) {
          ctx.font = '11px sans-serif';
          ctx.fillStyle = primaryColor;
          ctx.fillText(
            `${Math.round(rect.width)} × ${Math.round(rect.height)} px`,
            rect.x + 6,
            rect.y + 16
          );
        }
      }
    }
  }

  // Pointer event listeners for GM drawing
  function handlePointerDown(e: PointerEvent) {
    if (!isGm || !isFogTool(activeTool)) return;
    if (e.button !== 0) return; // Only accept primary mouse click / touch

    const canvas = overlayCanvas;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    const pt = getCanvasCoordinates(e, canvas);

    isDrawing = true;
    startPoint = pt;
    currentPoint = pt;

    if (isBrushTool(activeTool)) {
      brushPoints = [pt];
    }

    renderPreview();
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isGm || !isFogTool(activeTool)) return;

    const canvas = overlayCanvas;
    if (!canvas) return;

    const pt = getCanvasCoordinates(e, canvas);
    currentPoint = pt;

    if (isDrawing) {
      if (isBrushTool(activeTool)) {
        const last = brushPoints[brushPoints.length - 1];
        // Only append point if moved >= 2px to optimize WebRTC packet size
        if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 2) {
          brushPoints.push(pt);
        }
      }
    }

    renderPreview();
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDrawing) return;
    isDrawing = false;

    const canvas = overlayCanvas;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    const timestamp = Date.now();
    const actionId = `fog-${timestamp}-${Math.random().toString(36).slice(2, 7)}`;

    if (isBrushTool(activeTool)) {
      if (brushPoints.length > 0) {
        const action: FogAction = {
          id: actionId,
          type: isRevealTool(activeTool) ? 'reveal_brush' : 'hide_brush',
          points: [...brushPoints],
          radius: Math.max(20, Math.min(200, brushRadius)),
          timestamp,
        };
        onFogAction?.(action);
      }
    } else if (isRectTool(activeTool)) {
      if (startPoint && currentPoint) {
        const rect = normalizeRect({
          x: startPoint.x,
          y: startPoint.y,
          width: currentPoint.x - startPoint.x,
          height: currentPoint.y - startPoint.y,
        });

        // Ignore micro-clicks (< 4px)
        if (rect.width >= 4 && rect.height >= 4) {
          const action: FogAction = {
            id: actionId,
            type: isRevealTool(activeTool) ? 'reveal_rect' : 'hide_rect',
            rect,
            timestamp,
          };
          onFogAction?.(action);
        }
      }
    }

    startPoint = null;
    brushPoints = [];
    renderPreview();
  }

  function handlePointerLeave() {
    if (!isDrawing) {
      currentPoint = null;
      clearOverlay();
    }
  }

  /**
   * Blanket the entire battlemap in fog.
   */
  export function blanketAll() {
    const action: FogAction = {
      id: `fog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'blanket_all',
      timestamp: Date.now(),
    };
    onFogAction?.(action);
  }

  /**
   * Clear all fog from the battlemap.
   */
  export function clearAll() {
    const action: FogAction = {
      id: `fog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'clear_all',
      timestamp: Date.now(),
    };
    onFogAction?.(action);
  }

  // Reactive effect for fog action stream rendering
  $effect(() => {
    const canvas = fogCanvas;
    const actions = fogActions;
    const width = sceneWidth;
    const height = sceneHeight;
    const enabled = isFogEnabled;
    const blanket = defaultBlanket;

    if (!canvas || width <= 0 || height <= 0) return;

    // Check if we can perform an incremental render (single append)
    if (
      enabled &&
      lastRenderedCount > 0 &&
      actions.length === lastRenderedCount + 1
    ) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        applyFogAction(ctx, actions[actions.length - 1], width, height);
        lastRenderedCount = actions.length;
        return;
      }
    }

    // Full deterministic replay
    renderAllFogActions(canvas, actions, width, height, enabled, blanket);
  });

  // Re-render preview overlay if tool or radius changes
  $effect(() => {
    // Read dependencies
    const _tool = activeTool;
    const _isGm = isGm;
    if (_isGm && isFogTool(_tool)) {
      renderPreview();
    } else {
      clearOverlay();
    }
  });
</script>

<div
  class="vtt-fog-container absolute inset-0 pointer-events-none select-none {className}"
  style="width: {sceneWidth}px; height: {sceneHeight}px;"
>
  <!-- Layer 1: Base Fog Canvas (Rendered Action Stream) -->
  <canvas
    bind:this={fogCanvas}
    width={sceneWidth}
    height={sceneHeight}
    class="vtt-fog-canvas absolute inset-0 transition-opacity duration-150"
    style="opacity: {isGm ? VTT_FOG_GM_OPACITY : VTT_FOG_PLAYER_OPACITY}; pointer-events: none;"
    aria-hidden="true"
  ></canvas>

  <!-- Layer 2: Interactive GM Drawing & Preview Canvas -->
  {#if isGm}
    <canvas
      bind:this={overlayCanvas}
      width={sceneWidth}
      height={sceneHeight}
      class="vtt-fog-overlay absolute inset-0"
      style="pointer-events: {isFogTool(activeTool) ? 'auto' : 'none'}; cursor: {isFogTool(activeTool) ? 'crosshair' : 'default'};"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
      onpointerleave={handlePointerLeave}
      aria-hidden="true"
    ></canvas>
  {/if}
</div>
