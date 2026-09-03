<!--
  src/lib/components/vtt/VttRulerOverlay.svelte
  
  Interactive Tactical SVG Measurement Ruler & Area of Effect (AoE) Templates Overlay
  for Mural Virtual Tabletop (VTT).
  Implements Requirements R1 (1.5m continuous ruler, intermediate 1.5m ticks, Cone 60°,
  Circle explosion, 1.5m Line beam) and R2 (Tactical Radar Pings).
  
  Svelte 5 Runes: $props, $state, $derived.
-->

<script lang="ts">
  import type {
    VttPoint,
    VttPing,
    VttAoEType,
    VttAoEGeometry,
    VttRulerMeasurement,
  } from '../../types/vtt';
  import {
    calculateDistanceMeters,
    formatDistanceMeters,
    calculateAoeGeometry,
    measureRuler,
    TACTICAL_PIXELS_PER_METER,
    TACTICAL_GRID_STEP_METERS,
    TACTICAL_GRID_SIZE_PX,
  } from '../../services/vtt/vttProtocol';

  export interface PlacedAoE {
    id: string;
    type: VttAoEType;
    origin: VttPoint;
    target: VttPoint;
    color?: string;
    label?: string;
  }

  interface Props {
    /** World width of the scene in pixels */
    sceneWidth?: number;
    /** Alias for sceneWidth */
    width?: number;
    /** World height of the scene in pixels */
    sceneHeight?: number;
    /** Alias for sceneHeight */
    height?: number;
    /** Current canvas viewport zoom level */
    zoom?: number;
    /** Current canvas pan */
    pan?: VttPoint;
    /** Currently selected tool */
    activeTool?: string;
    /** Active tactical radar pings */
    pings?: VttPing[];

    /** Active Dragging Ruler emitted by a token being moved */
    dragRuler?: {
      active: boolean;
      start: VttPoint;
      current: VttPoint;
      tokenName?: string;
      tokenColor?: string;
      maxSpeedMeters?: number; // Standard: 9.0m
    } | null;

    /** Token drag measurement object (alternative format) */
    tokenDragMeasure?: {
      origin: VttPoint;
      current: VttPoint;
      distanceMeters: number;
      formattedMeters: string;
    } | null;

    /** Active Interactive Tool Mode */
    toolMode?: 'none' | 'ruler' | 'circle' | 'cone' | 'line' | string;

    /** Standalone ruler measurement state */
    activeRuler?:
      | {
          start: VttPoint;
          end: VttPoint;
        }
      | VttRulerMeasurement
      | null;

    /** Active AoE drafting state */
    activeAoe?:
      | {
          type: VttAoEType;
          origin: VttPoint;
          target: VttPoint;
          fixedRadiusMeters?: number;
          coneAngleDeg?: number;
          lineWidthMeters?: number;
        }
      | VttAoEGeometry
      | null;

    /** Persistent / Placed AoE templates on the battlemap */
    placedAoEs?: PlacedAoE[];

    /** Callbacks */
    onPlaceAoE?: (aoe: {
      type: VttAoEType;
      origin: VttPoint;
      target: VttPoint;
    }) => void;
    onClearAoE?: (id: string) => void;
  }

  let {
    sceneWidth: rawSceneWidth,
    width: rawWidth,
    sceneHeight: rawSceneHeight,
    height: rawHeight,
    zoom = 1.0,
    pan = { x: 0, y: 0 },
    activeTool = 'select',
    pings = [],
    dragRuler = null,
    tokenDragMeasure = null,
    toolMode = 'none',
    activeRuler = null,
    activeAoe = null,
    placedAoEs = [],
    onPlaceAoE,
    onClearAoE,
  }: Props = $props();

  const sceneWidth = $derived(rawSceneWidth ?? rawWidth ?? 2048);
  const sceneHeight = $derived(rawSceneHeight ?? rawHeight ?? 1536);

  // Helper to compute intermediate 1.5m tick marks
  function computeIntermediateTicks(
    start: VttPoint,
    end: VttPoint,
    distPx: number,
    tickHalfLength: number = 6
  ): Array<{ p1: VttPoint; p2: VttPoint }> {
    if (distPx < TACTICAL_GRID_SIZE_PX) return [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const unitX = dx / distPx;
    const unitY = dy / distPx;
    const normX = -unitY;
    const normY = unitX;

    const ticks: Array<{ p1: VttPoint; p2: VttPoint }> = [];
    const totalSteps = Math.floor(distPx / TACTICAL_GRID_SIZE_PX);

    for (let i = 1; i <= totalSteps; i++) {
      const stepPx = i * TACTICAL_GRID_SIZE_PX;
      if (stepPx < distPx - 5) {
        const cx = start.x + unitX * stepPx;
        const cy = start.y + unitY * stepPx;
        ticks.push({
          p1: { x: cx - normX * tickHalfLength, y: cy - normY * tickHalfLength },
          p2: { x: cx + normX * tickHalfLength, y: cy + normY * tickHalfLength },
        });
      }
    }
    return ticks;
  }

  // --- Derived Calculations for Standalone Ruler Tool ---
  const standaloneRuler = $derived.by(() => {
    if (!activeRuler) return null;
    const start = activeRuler.start;
    const end = 'end' in activeRuler ? activeRuler.end : (activeRuler as any).target;
    if (!start || !end) return null;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    if (distPx < 1) return null;

    const distMeters = distPx / TACTICAL_PIXELS_PER_METER;
    const stepsCount = distMeters / TACTICAL_GRID_STEP_METERS;
    const ticks = computeIntermediateTicks(start, end, distPx, 6);

    return {
      start,
      end,
      distPx,
      distMeters,
      stepsCount,
      formattedMeters: formatDistanceMeters(distMeters),
      midX: (start.x + end.x) / 2,
      midY: (start.y + end.y) / 2,
      ticks,
    };
  });

  // --- Derived Calculations for Token Drag Ruler ---
  const dragMeasurement = $derived.by(() => {
    let start: VttPoint | null = null;
    let current: VttPoint | null = null;
    let maxSpeed = 9.0;

    if (tokenDragMeasure) {
      start = tokenDragMeasure.origin;
      current = tokenDragMeasure.current;
    } else if (dragRuler && dragRuler.active) {
      start = dragRuler.start;
      current = dragRuler.current;
      maxSpeed = dragRuler.maxSpeedMeters ?? 9.0;
    }

    if (!start || !current) return null;
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    if (distPx < 1) return null;

    const distMeters = distPx / TACTICAL_PIXELS_PER_METER;
    const stepsCount = distMeters / TACTICAL_GRID_STEP_METERS;

    // Movement speed budget color coding
    let statusColor = '#10b981'; // Emerald (Normal move <= 9m)
    let badgeBorder = 'border-emerald-500/80';
    let badgeText = 'text-emerald-400';
    let badgeBg = 'bg-emerald-950/90 text-emerald-300 border-emerald-500/80';

    if (distMeters > maxSpeed * 2) {
      statusColor = '#f43f5e'; // Rose (Exceeded double move > 18m)
      badgeBorder = 'border-rose-500/80';
      badgeText = 'text-rose-400';
      badgeBg = 'bg-rose-950/90 text-rose-300 border-rose-500/80';
    } else if (distMeters > maxSpeed) {
      statusColor = '#f59e0b'; // Amber (Double move / Corrida <= 18m)
      badgeBorder = 'border-amber-500/80';
      badgeText = 'text-amber-400';
      badgeBg = 'bg-amber-950/90 text-amber-300 border-amber-500/80';
    }

    const ticks = computeIntermediateTicks(start, current, distPx, 5);

    return {
      start,
      current,
      distPx,
      distMeters,
      stepsCount,
      formattedMeters: formatDistanceMeters(distMeters),
      midX: (start.x + current.x) / 2,
      midY: (start.y + current.y) / 2,
      statusColor,
      badgeBorder,
      badgeText,
      badgeBg,
      ticks,
    };
  });

  // --- Derived Calculations for Active AoE Template ---
  const activeAoeGeom = $derived.by<VttAoEGeometry | null>(() => {
    if (!activeAoe) return null;
    if ('svgPath' in activeAoe && activeAoe.svgPath) {
      return activeAoe as VttAoEGeometry;
    }
    const a = activeAoe as any;
    if (!a.type || !a.origin || !a.target) return null;
    return calculateAoeGeometry(a.type, a.origin, a.target, {
      fixedRadiusMeters: a.fixedRadiusMeters,
      coneAngleDeg: a.coneAngleDeg ?? 60,
      lineWidthMeters: a.lineWidthMeters ?? 1.5,
    });
  });

  // --- Helper for Placed AoE Geometries ---
  function getPlacedAoeGeom(aoe: PlacedAoE): VttAoEGeometry {
    return calculateAoeGeometry(aoe.type, aoe.origin, aoe.target, {
      coneAngleDeg: 60,
      lineWidthMeters: 1.5,
    });
  }
</script>

<svg
  class="vtt-ruler-svg-overlay w-full h-full pointer-events-none select-none overflow-visible absolute inset-0 z-25"
  viewBox="0 0 {sceneWidth} {sceneHeight}"
  xmlns="http://www.w3.org/2000/svg"
>
  <defs>
    <!-- Crosshair Marker for Target Points -->
    <pattern id="rulerGridPattern" width="70" height="70" patternUnits="userSpaceOnUse">
      <path d="M 70 0 L 0 0 0 70" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
    </pattern>

    <!-- Arrow marker for measurement rulers -->
    <marker
      id="ruler-arrow"
      viewBox="0 0 10 10"
      refX="5"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
    </marker>

    <!-- Glowing Filters -->
    <filter id="rulerGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- ======================================================================= -->
  <!-- 1. PERSISTENT / PLACED AoE TEMPLATES                                   -->
  <!-- ======================================================================= -->
  {#each placedAoEs as aoe (aoe.id)}
    {@const geom = getPlacedAoeGeom(aoe)}
    <g class="placed-aoe opacity-75">
      {#if geom.type === 'circle'}
        <circle
          cx={geom.origin.x}
          cy={geom.origin.y}
          r={geom.radiusPx}
          fill="rgba(239, 68, 68, 0.18)"
          stroke="#ef4444"
          stroke-width="2"
          stroke-dasharray="6 4"
        />
        <circle cx={geom.origin.x} cy={geom.origin.y} r="4" fill="#ef4444" />
      {:else if geom.type === 'cone' && geom.svgPath}
        <path
          d={geom.svgPath}
          fill="rgba(245, 158, 11, 0.18)"
          stroke="#f59e0b"
          stroke-width="2"
        />
        <circle cx={geom.origin.x} cy={geom.origin.y} r="4" fill="#f59e0b" />
      {:else if geom.type === 'line' && geom.svgPath}
        <path
          d={geom.svgPath}
          fill="rgba(59, 130, 246, 0.18)"
          stroke="#3b82f6"
          stroke-width="2"
        />
        <circle cx={geom.origin.x} cy={geom.origin.y} r="4" fill="#3b82f6" />
      {/if}

      <!-- Placed AoE Label -->
      <g transform="translate({geom.target.x}, {geom.target.y - 12})">
        <rect
          x="-50"
          y="-11"
          width="100"
          height="22"
          rx="11"
          fill="#09090b"
          fill-opacity="0.85"
          stroke="#52525b"
          stroke-width="1"
        />
        <text
          text-anchor="middle"
          y="4"
          fill="#e4e4e7"
          font-size="10"
          font-weight="600"
          font-family="ui-sans-serif, system-ui, sans-serif"
        >
          {aoe.label || geom.label.split(':')[0]}
        </text>
      </g>
    </g>
  {/each}

  <!-- ======================================================================= -->
  <!-- 2. ACTIVE AoE DRAFTING TEMPLATE (Real-time Preview)                    -->
  <!-- ======================================================================= -->
  {#if activeAoeGeom}
    <g class="active-aoe-draft">
      {#if activeAoeGeom.type === 'circle'}
        <!-- Circle Explosion Area -->
        <circle
          cx={activeAoeGeom.origin.x}
          cy={activeAoeGeom.origin.y}
          r={activeAoeGeom.radiusPx}
          fill="rgba(239, 68, 68, 0.25)"
          stroke="#ef4444"
          stroke-width="2.5"
          stroke-dasharray="8 4"
          filter="url(#rulerGlow)"
        />
        <!-- Center Origin Anchor -->
        <circle cx={activeAoeGeom.origin.x} cy={activeAoeGeom.origin.y} r="5" fill="#ef4444" />
        <!-- Radius Guideline -->
        <line
          x1={activeAoeGeom.origin.x}
          y1={activeAoeGeom.origin.y}
          x2={activeAoeGeom.target.x}
          y2={activeAoeGeom.target.y}
          stroke="#ef4444"
          stroke-width="2"
          stroke-dasharray="4 3"
        />
        <circle cx={activeAoeGeom.target.x} cy={activeAoeGeom.target.y} r="4" fill="#ef4444" />

        <!-- Readout Badge at Target -->
        <foreignObject
          x={activeAoeGeom.target.x - 75}
          y={activeAoeGeom.target.y - 14}
          width="150"
          height="28"
        >
          <div class="flex items-center justify-center w-full h-full">
            <span
              class="px-2 py-0.5 rounded-full bg-rose-950/90 border border-rose-500/80 text-[11px] font-mono text-rose-200 shadow-lg whitespace-nowrap"
            >
              {activeAoeGeom.label}
            </span>
          </div>
        </foreignObject>

      {:else if activeAoeGeom.type === 'cone' && activeAoeGeom.svgPath}
        <!-- 60° Tactical Cone Arc Sector -->
        <path
          d={activeAoeGeom.svgPath}
          fill="rgba(245, 158, 11, 0.25)"
          stroke="#f59e0b"
          stroke-width="2.5"
          filter="url(#rulerGlow)"
        />
        <!-- Apex Point -->
        <circle cx={activeAoeGeom.origin.x} cy={activeAoeGeom.origin.y} r="5" fill="#f59e0b" />
        <!-- Centerline Trajectory Guide -->
        <line
          x1={activeAoeGeom.origin.x}
          y1={activeAoeGeom.origin.y}
          x2={activeAoeGeom.target.x}
          y2={activeAoeGeom.target.y}
          stroke="#f59e0b"
          stroke-width="1.5"
          stroke-dasharray="4 3"
        />
        <circle cx={activeAoeGeom.target.x} cy={activeAoeGeom.target.y} r="4" fill="#f59e0b" />

        <!-- Readout Badge at Cone Target -->
        <foreignObject
          x={activeAoeGeom.target.x - 60}
          y={activeAoeGeom.target.y - 14}
          width="120"
          height="28"
        >
          <div class="flex items-center justify-center w-full h-full">
            <span
              class="px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/80 text-[11px] font-mono text-amber-200 shadow-lg whitespace-nowrap"
            >
              {activeAoeGeom.label}
            </span>
          </div>
        </foreignObject>

      {:else if activeAoeGeom.type === 'line' && activeAoeGeom.svgPath}
        <!-- 1.5m Tactical Line Beam -->
        <path
          d={activeAoeGeom.svgPath}
          fill="rgba(59, 130, 246, 0.25)"
          stroke="#3b82f6"
          stroke-width="2.5"
          filter="url(#rulerGlow)"
        />
        <!-- Origin & Target Anchors -->
        <circle cx={activeAoeGeom.origin.x} cy={activeAoeGeom.origin.y} r="5" fill="#3b82f6" />
        <circle cx={activeAoeGeom.target.x} cy={activeAoeGeom.target.y} r="4" fill="#3b82f6" />
        <!-- Center Trajectory Guide -->
        <line
          x1={activeAoeGeom.origin.x}
          y1={activeAoeGeom.origin.y}
          x2={activeAoeGeom.target.x}
          y2={activeAoeGeom.target.y}
          stroke="#60a5fa"
          stroke-width="1.5"
          stroke-dasharray="4 3"
        />

        <!-- Readout Badge at Line Midpoint -->
        <foreignObject
          x={(activeAoeGeom.origin.x + activeAoeGeom.target.x) / 2 - 75}
          y={(activeAoeGeom.origin.y + activeAoeGeom.target.y) / 2 - 14}
          width="150"
          height="28"
        >
          <div class="flex items-center justify-center w-full h-full">
            <span
              class="px-2 py-0.5 rounded-full bg-blue-950/90 border border-blue-500/80 text-[11px] font-mono text-blue-200 shadow-lg whitespace-nowrap"
            >
              {activeAoeGeom.label}
            </span>
          </div>
        </foreignObject>
      {/if}
    </g>
  {/if}

  <!-- ======================================================================= -->
  <!-- 3. STANDALONE POINT-TO-POINT MEASUREMENT RULER                          -->
  <!-- ======================================================================= -->
  {#if standaloneRuler}
    <g class="standalone-ruler">
      <!-- Shadow Underlay -->
      <line
        x1={standaloneRuler.start.x}
        y1={standaloneRuler.start.y}
        x2={standaloneRuler.end.x}
        y2={standaloneRuler.end.y}
        stroke="#000000"
        stroke-width="5"
        stroke-opacity="0.6"
        stroke-linecap="round"
      />
      <!-- Dashed Ruler Guide -->
      <line
        x1={standaloneRuler.start.x}
        y1={standaloneRuler.start.y}
        x2={standaloneRuler.end.x}
        y2={standaloneRuler.end.y}
        stroke="#38bdf8"
        stroke-width="2.5"
        stroke-dasharray="8 6"
        stroke-linecap="round"
        marker-end="url(#ruler-arrow)"
        filter="url(#rulerGlow)"
      />

      <!-- 1.5m Intermediate Tick Marks -->
      {#each standaloneRuler.ticks as tick}
        <line
          x1={tick.p1.x}
          y1={tick.p1.y}
          x2={tick.p2.x}
          y2={tick.p2.y}
          stroke="#38bdf8"
          stroke-width="2"
          stroke-linecap="round"
        />
      {/each}

      <!-- Origin Bullseye -->
      <circle
        cx={standaloneRuler.start.x}
        cy={standaloneRuler.start.y}
        r="10"
        fill="none"
        stroke="#38bdf8"
        stroke-width="1.5"
        stroke-dasharray="2 2"
      />
      <circle cx={standaloneRuler.start.x} cy={standaloneRuler.start.y} r="4" fill="#38bdf8" />

      <!-- End Target Marker -->
      <circle cx={standaloneRuler.end.x} cy={standaloneRuler.end.y} r="4" fill="#38bdf8" />

      <!-- Distance Metric Readout Badge -->
      <foreignObject
        x={standaloneRuler.midX - 70}
        y={standaloneRuler.midY - 14}
        width="140"
        height="28"
      >
        <div class="flex items-center justify-center w-full h-full">
          <span
            class="px-2.5 py-0.5 rounded-full bg-zinc-950/95 border border-sky-500/90 text-sky-300 font-mono text-xs font-semibold shadow-2xl whitespace-nowrap"
          >
            {standaloneRuler.formattedMeters} ({standaloneRuler.stepsCount.toFixed(1)}p)
          </span>
        </div>
      </foreignObject>
    </g>
  {/if}

  <!-- ======================================================================= -->
  <!-- 4. DYNAMIC TOKEN DRAG MEASUREMENT RULER                                 -->
  <!-- ======================================================================= -->
  {#if dragMeasurement}
    <g class="drag-token-ruler">
      <!-- Shadow Underlay -->
      <line
        x1={dragMeasurement.start.x}
        y1={dragMeasurement.start.y}
        x2={dragMeasurement.current.x}
        y2={dragMeasurement.current.y}
        stroke="#000000"
        stroke-width="5"
        stroke-opacity="0.65"
        stroke-linecap="round"
      />

      <!-- Trajectory Dashed Path -->
      <line
        x1={dragMeasurement.start.x}
        y1={dragMeasurement.start.y}
        x2={dragMeasurement.current.x}
        y2={dragMeasurement.current.y}
        stroke={dragMeasurement.statusColor}
        stroke-width="2.5"
        stroke-dasharray="6 4"
        stroke-linecap="round"
        filter="url(#rulerGlow)"
      />

      <!-- Intermediate 1.5m Step Ticks -->
      {#each dragMeasurement.ticks as tick}
        <line
          x1={tick.p1.x}
          y1={tick.p1.y}
          x2={tick.p2.x}
          y2={tick.p2.y}
          stroke={dragMeasurement.statusColor}
          stroke-width="2"
          stroke-linecap="round"
        />
      {/each}

      <!-- Origin Ghost Circle Bullseye -->
      <circle
        cx={dragMeasurement.start.x}
        cy={dragMeasurement.start.y}
        r="14"
        fill="none"
        stroke={dragMeasurement.statusColor}
        stroke-width="1.5"
        stroke-dasharray="3 2"
        opacity="0.75"
      />
      <circle
        cx={dragMeasurement.start.x}
        cy={dragMeasurement.start.y}
        r="5"
        fill={dragMeasurement.statusColor}
      />

      <!-- Dynamic Metric Badge at Midpoint -->
      <foreignObject
        x={dragMeasurement.midX - 60}
        y={dragMeasurement.midY - 14}
        width="120"
        height="28"
      >
        <div class="flex items-center justify-center w-full h-full">
          <span
            class="px-2 py-0.5 rounded-full border text-xs font-mono font-bold shadow-xl whitespace-nowrap {dragMeasurement.badgeBg}"
          >
            {dragMeasurement.formattedMeters}
          </span>
        </div>
      </foreignObject>
    </g>
  {/if}

  <!-- ======================================================================= -->
  <!-- 5. TACTICAL RADAR PINGS                                                -->
  <!-- ======================================================================= -->
  {#each pings as ping (ping.id || `${ping.x}-${ping.y}-${ping.timestamp}`)}
    <g class="vtt-radar-ping-group">
      <!-- Expanding Concentric Ripple 1 -->
      <circle
        cx={ping.x}
        cy={ping.y}
        r="30"
        fill="none"
        stroke={ping.color || '#38bdf8'}
        stroke-width="2"
        class="animate-ping"
        style="animation-duration: 2s; transform-origin: {ping.x}px {ping.y}px;"
      />
      <!-- Expanding Concentric Ripple 2 -->
      <circle
        cx={ping.x}
        cy={ping.y}
        r="18"
        fill="none"
        stroke={ping.color || '#38bdf8'}
        stroke-width="2.5"
        class="animate-ping"
        style="animation-duration: 1.4s; transform-origin: {ping.x}px {ping.y}px;"
      />
      <!-- Center Core -->
      <circle
        cx={ping.x}
        cy={ping.y}
        r="5"
        fill={ping.color || '#38bdf8'}
      />
      <!-- Sender Identification Label -->
      <foreignObject x={ping.x - 50} y={ping.y - 32} width="100" height="24">
        <div class="flex items-center justify-center w-full h-full">
          <span
            class="px-2 py-0.5 rounded-full bg-zinc-950/90 border border-zinc-800 text-[10px] text-zinc-200 font-medium shadow-md whitespace-nowrap flex items-center gap-1"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            {ping.senderName || 'Jogador'}
          </span>
        </div>
      </foreignObject>
    </g>
  {/each}
</svg>
