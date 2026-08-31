# Technical Analysis & Implementation Blueprint: Custom Semantic Edges & Relationship Types

**Author**: Explorer M1.2 (`explorer_m1_2`)  
**Milestone**: M1 (Advanced Canvas & Relationship Graph Engine)  
**Features Addressed**: F03 (Custom Semantic Edge Connectors), F04 (Inline Edge Management), R1 Edge Customization  
**Date**: 2026-08-31  

---

## 1. Executive Summary

This document establishes the comprehensive architectural design and drop-in code blueprints for the semantic relationship edge subsystem in **Mural (OrdemTools)**.

The solution consists of:
1. **`src/lib/components/canvas/edges/CustomLabeledEdge.svelte`**: A fully customizable Svelte Flow edge component leveraging `@xyflow/svelte` (`BaseEdge`, `EdgeLabelRenderer`, `getSmoothStepPath`, `getBezierPath`, `getStraightPath`) and Svelte 5 Runes (`$props`, `$derived`, `$derived.by`).
2. **`src/lib/components/canvas/EditEdgeModal.svelte`**: A detailed GM modal editor for edge semantics (label, category, path geometry, bidirectionality, master notes).
3. **Store & Type Extensions**: Reactive edge management methods in `campaignStore.svelte.ts` and canonical type definitions in `src/lib/types/index.ts`.
4. **Canvas Integration**: Seamless registration in `CanvasView.svelte` with `edgeTypes` mapping and `defaultEdgeOptions`.

---

## 2. Architecture & Design Decisions

### 2.1 Relationship Category Taxonomy & Styling Matrix

Six semantic relationship categories are supported, each with specialized stroke graphics, color themes, icons, and default label presets:

| Category | Semantics | Accent / Color | SVG Stroke Style | Icon | Default Label Presets |
|---|---|---|---|---|---|
| **`allied`** | Alliance, friendship, faction pact | Emerald (`#10b981`) | Solid `2px` | `Users` | *"é aliado de"*, *"protege"*, *"colabora com"*, *"financia"* |
| **`hostile`** | Rivalry, conflict, hunted by | Crimson / Rose (`#f43f5e`) | Solid `2px` | `Swords` | *"é inimigo de"*, *"caça"*, *"odeia"*, *"combate"* |
| **`secret`** | Hidden link, conspiracy, undercover | Purple (`#a855f7`) | Dashed `stroke-dasharray: 6 4; 2px` | `EyeOff` | *"esconde segredo com"*, *"esconde-se sob"*, *"infiltrado em"*, *"controla nas sombras"* |
| **`investigates`** | Active investigation, clue trail, suspect | Amber (`#f59e0b`) | Dash-dot `stroke-dasharray: 8 3; 2px` | `Search` | *"investiga"*, *"suspeita de"*, *"segue os passos de"*, *"procura provas contra"* |
| **`neutral`** | Standard connection, location link | Slate / Zinc (`#71717a`) | Solid `1.5px` | `Link2` | *"ligação com"*, *"localizado em"*, *"conhece"*, *"reside em"* |
| **`custom`** | User-defined custom dynamics | Sky (`#38bdf8`) / Hex | Solid `2px` | `Tag` | *"relação"*, *"vínculo místico"*, *"pacto de sangue"* |

### 2.2 Path Routing Geometry

Supports three runtime path algorithms dynamically selected via `data.pathType`:
1. **`smoothstep` (Default)**: Uses `getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 10, offset: 20 })`. Ideal for structured architectural/investigation boards.
2. **`bezier`**: Uses `getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })`. Delivers flowing, organic curves between entities.
3. **`straight`**: Uses `getStraightPath({ sourceX, sourceY, targetX, targetY })`. Renders direct vector lines resembling string-and-pin conspiracy boards.

### 2.3 Interactive Midpoint Label Pill & Hover Actions

- Rendered via `<EdgeLabelRenderer>` inside `.svelte-flow__edgelabel-renderer` using CSS positioning:
  `style="position: absolute; transform: translate(-50%, -50%) translate(${labelX}px, ${labelY}px); pointer-events: all;"`
- Marked with classes `nodrag nopan select-none` to isolate label clicks and button triggers from canvas pan/drag handlers.
- Displays:
  - Relationship icon & text label.
  - Bidirectional icon (`ArrowLeftRight`) when `bidirectional: true`.
  - Secret notes indicator icon (`FileText`) when GM notes exist.
  - Quick action toolbar on hover:
    - ✏️ **Edit button**: Triggers `campaignStore.openEdgeEditor(edge)`.
    - ❌ **Delete button**: Triggers `campaignStore.deleteEdge(id)` without deleting connected nodes.
  - Double-click on pill opens the full modal editor.

---

## 3. Complete Code Blueprints

### 3.1 Type Definitions (`src/lib/types/index.ts`)

```typescript
import type { Node, Edge } from '@xyflow/svelte';

export type EntityType = 'npc' | 'faction' | 'location' | 'secret' | 'clue';

export interface EntityNodeData extends Record<string, unknown> {
  id: string;
  type: EntityType;
  title: string;
  subtitle?: string;
  description: string;
  tags?: string[];
  isSecret?: boolean;
  revealed?: boolean;
  statusText?: string;
  icon?: string;
  color?: string;
}

export type RelationType = 'allied' | 'hostile' | 'secret' | 'neutral' | 'investigates' | 'custom';
export type EdgePathType = 'smoothstep' | 'bezier' | 'straight';

export interface CanvasRelationEdgeData extends Record<string, unknown> {
  label: string;
  relationType: RelationType;
  pathType?: EdgePathType;
  bidirectional?: boolean;
  notes?: string;
  color?: string;
}

export type CanvasRelationEdge = Edge<CanvasRelationEdgeData>;

export interface ThreatClock {
  id: string;
  title: string;
  totalSegments: number; // e.g. 4, 6, 8, 10, 12
  filledSegments: number;
}

export interface LoreEntry {
  id: string;
  content: string;
  status: 'SABIDO' | 'SEGREDO';
  sessionNumber?: number;
}

export interface TimelineMarker {
  id: string;
  sessionText: string;
  sessionNumber: number;
  isCurrent?: boolean;
  label?: string;
}

export interface CampaignData {
  id: string;
  name: string;
  system: string;
  currentSession: number;
  inGamePeriod: string;
  description?: string;
  updatedAt: string;
  clocks: ThreatClock[];
  lore: LoreEntry[];
  timeline: TimelineMarker[];
  nodes: Node<EntityNodeData>[];
  edges: CanvasRelationEdge[];
}

export interface CampaignSummary {
  id: string;
  name: string;
  system: string;
  currentSession: number;
  inGamePeriod: string;
  description?: string;
  updatedAt: string;
  nodeCount: number;
  clockCount: number;
  loreCount: number;
}
```

---

### 3.2 Custom Edge Component (`src/lib/components/canvas/edges/CustomLabeledEdge.svelte`)

```svelte
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

  const computedStyle = $derived(
    `stroke: ${stylingConfig.strokeColor}; stroke-width: ${stylingConfig.strokeWidth}; ${
      stylingConfig.strokeDash !== 'none' ? `stroke-dasharray: ${stylingConfig.strokeDash};` : ''
    } ${style}`
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
    style="position: absolute; transform: translate(-50%, -50%) translate({labelX}px, {labelY}px); pointer-events: all;"
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
        {@const Icon = stylingConfig.icon}
        <Icon class="w-3 h-3 {stylingConfig.iconColor} shrink-0" />

        <span class="text-[11px] font-medium tracking-tight whitespace-nowrap {stylingConfig.textColor}">
          {labelText}
        </span>

        {#if isBidirectional}
          <ArrowLeftRight class="w-2.5 h-2.5 text-zinc-400 shrink-0" title="Bidirecional (Mútuo)" />
        {/if}

        {#if hasNotes}
          <FileText class="w-2.5 h-2.5 text-amber-400/80 shrink-0" title="Possui notas do Mestre" />
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
```

---

### 3.3 Modal Editor Component (`src/lib/components/canvas/EditEdgeModal.svelte`)

```svelte
<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import type { RelationType, EdgePathType, CanvasRelationEdgeData } from '../../types';
  import {
    X,
    Trash2,
    Check,
    Users,
    Swords,
    EyeOff,
    Search,
    Link2,
    Tag,
    ArrowLeftRight,
    CornerDownRight,
    Spline,
    MoveRight,
  } from 'lucide-svelte';

  const edge = $derived(campaignStore.editingEdge);
  const nodes = campaignStore.nodes;

  // Form local state
  let label = $state('');
  let relationType = $state<RelationType>('neutral');
  let pathType = $state<EdgePathType>('smoothstep');
  let bidirectional = $state(false);
  let notes = $state('');
  let customColor = $state('#38bdf8');

  // Synchronize state when editingEdge changes
  $effect(() => {
    if (edge) {
      const data = (edge.data || {}) as CanvasRelationEdgeData;
      label = data.label || '';
      relationType = data.relationType || 'neutral';
      pathType = data.pathType || 'smoothstep';
      bidirectional = Boolean(data.bidirectional);
      notes = data.notes || '';
      customColor = (data.color as string) || '#38bdf8';
    }
  });

  // Resolve source and target node names for context
  const sourceNode = $derived.by(() => {
    if (!edge) return null;
    return $nodes.find((n) => n.id === edge.source) || null;
  });

  const targetNode = $derived.by(() => {
    if (!edge) return null;
    return $nodes.find((n) => n.id === edge.target) || null;
  });

  const relationCategories: {
    id: RelationType;
    label: string;
    description: string;
    icon: any;
    colorClass: string;
    defaultLabels: string[];
  }[] = [
    {
      id: 'allied',
      label: 'Aliado / Parceria',
      description: 'Cooperação mútua, amizade ou pacto',
      icon: Users,
      colorClass: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
      defaultLabels: ['é aliado de', 'protege', 'colabora com', 'financia'],
    },
    {
      id: 'hostile',
      label: 'Inimigo / Hostil',
      description: 'Rivalidade, ameaça aberta ou guerra',
      icon: Swords,
      colorClass: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
      defaultLabels: ['é inimigo de', 'caça', 'odeia', 'combate'],
    },
    {
      id: 'secret',
      label: 'Segredo / Oculto',
      description: 'Conspiração oculta ou espião infiltrado',
      icon: EyeOff,
      colorClass: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
      defaultLabels: ['esconde segredo com', 'esconde-se sob', 'infiltrado em', 'controla nas sombras'],
    },
    {
      id: 'investigates',
      label: 'Investiga / Pista',
      description: 'Busca de pistas ou suspeita ativa',
      icon: Search,
      colorClass: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
      defaultLabels: ['investiga', 'suspeita de', 'segue os passos de', 'procura provas contra'],
    },
    {
      id: 'neutral',
      label: 'Neutro / Vínculo',
      description: 'Conexão simples ou localização',
      icon: Link2,
      colorClass: 'text-zinc-400 border-zinc-700/60 bg-zinc-800/40',
      defaultLabels: ['ligação com', 'localizado em', 'conhece', 'reside em'],
    },
    {
      id: 'custom',
      label: 'Personalizado',
      description: 'Defina cor e dinâmica própria',
      icon: Tag,
      colorClass: 'text-sky-400 border-sky-500/40 bg-sky-500/10',
      defaultLabels: ['relação', 'vínculo místico', 'pacto de sangue'],
    },
  ];

  const pathTypesList: {
    id: EdgePathType;
    label: string;
    icon: any;
    description: string;
  }[] = [
    {
      id: 'smoothstep',
      label: 'Ortogonal Suave',
      icon: CornerDownRight,
      description: 'Ângulos retos arredondados',
    },
    {
      id: 'bezier',
      label: 'Curva Bezier',
      icon: Spline,
      description: 'Curvas orgânicas fluidas',
    },
    {
      id: 'straight',
      label: 'Linha Reta',
      icon: MoveRight,
      description: 'Fio direto de conspiração',
    },
  ];

  const activeCategory = $derived(
    relationCategories.find((c) => c.id === relationType) || relationCategories[4]
  );

  function handleSelectCategory(catId: RelationType) {
    relationType = catId;
    const cat = relationCategories.find((c) => c.id === catId);
    if (cat && (!label || label === 'ligação' || relationCategories.some((r) => r.defaultLabels.includes(label)))) {
      label = cat.defaultLabels[0];
    }
  }

  function handleSave() {
    if (edge) {
      campaignStore.updateEdgeData(edge.id, {
        label: label.trim() || 'ligação',
        relationType,
        pathType,
        bidirectional,
        notes: notes.trim(),
        color: relationType === 'custom' ? customColor : undefined,
      });
      campaignStore.closeEdgeEditor();
    }
  }

  function handleDelete() {
    if (edge) {
      campaignStore.deleteEdge(edge.id);
      campaignStore.closeEdgeEditor();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      campaignStore.closeEdgeEditor();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if edge}
  <!-- Backdrop -->
  <div class="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
    <div
      class="w-full max-w-lg bg-zinc-900 border border-zinc-700/90 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <span>Editar Ligação / Relação</span>
          </h2>
          {#if sourceNode && targetNode}
            <p class="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
              <span class="text-zinc-300 font-medium">{sourceNode.data.title}</span>
              <span class="text-zinc-500">➔</span>
              <span class="text-zinc-300 font-medium">{targetNode.data.title}</span>
            </p>
          {:else}
            <p class="text-[11px] text-zinc-400 mt-0.5">Altera semântica, cor, curvatura e anotações desta conexão</p>
          {/if}
        </div>
        <button
          type="button"
          onclick={() => campaignStore.closeEdgeEditor()}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
          title="Fechar (Esc)"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Relationship Category Selector -->
      <div>
        <label for="relation-category-selector" class="block text-xs font-medium text-zinc-400 mb-1.5">
          Tipo de Relação
        </label>
        <div id="relation-category-selector" class="grid grid-cols-3 gap-2">
          {#each relationCategories as item}
            {@const Icon = item.icon}
            <button
              type="button"
              onclick={() => handleSelectCategory(item.id)}
              class="p-2 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer {relationType ===
              item.id
                ? `${item.colorClass} ring-1 ring-amber-500/50`
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <div class="flex items-center gap-1.5 text-xs font-semibold">
                <Icon class="w-3.5 h-3.5 shrink-0" />
                <span class="truncate">{item.label}</span>
              </div>
              <span class="text-[10px] text-zinc-500 line-clamp-1 leading-tight">{item.description}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Label Input with Presets -->
      <div class="space-y-2">
        <div>
          <label for="edge-label-input" class="block text-xs font-medium text-zinc-300 mb-1">
            Rótulo da Ligação *
          </label>
          <input
            id="edge-label-input"
            type="text"
            placeholder="Ex: é aliado de, investiga, esconde-se sob..."
            bind:value={label}
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        <!-- Quick Preset Pills -->
        {#if activeCategory.defaultLabels.length > 0}
          <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span class="text-[10px] text-zinc-500 font-medium">Sugestões:</span>
            {#each activeCategory.defaultLabels as preset}
              <button
                type="button"
                onclick={() => (label = preset)}
                class="px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                {preset}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Path Type and Bidirectional Toggle Row -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Path Geometry Selector -->
        <div>
          <label for="path-type-selector" class="block text-xs font-medium text-zinc-400 mb-1.5">
            Formato da Linha
          </label>
          <div id="path-type-selector" class="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {#each pathTypesList as p}
              {@const Icon = p.icon}
              <button
                type="button"
                onclick={() => (pathType = p.id)}
                class="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer {pathType ===
                p.id
                  ? 'bg-zinc-800 text-amber-300 border border-zinc-700 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-300'}"
                title={p.description}
              >
                <Icon class="w-3.5 h-3.5" />
                <span class="text-[11px]">{p.label.split(' ')[0]}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Bidirectional Toggle -->
        <div>
          <label for="bidirectional-toggle-box" class="block text-xs font-medium text-zinc-400 mb-1.5">
            Direcionalidade
          </label>
          <button
            id="bidirectional-toggle-box"
            type="button"
            onclick={() => (bidirectional = !bidirectional)}
            class="w-full h-[38px] px-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer {bidirectional
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
          >
            <div class="flex items-center gap-1.5 text-xs font-medium">
              <ArrowLeftRight class="w-3.5 h-3.5 {bidirectional ? 'text-amber-400' : 'text-zinc-500'}" />
              <span>Bidirecional (⇄)</span>
            </div>
            <span
              class="w-3 h-3 rounded-full border flex items-center justify-center {bidirectional
                ? 'bg-amber-400 border-amber-400'
                : 'border-zinc-700'}"
            >
              {#if bidirectional}
                <Check class="w-2.5 h-2.5 text-zinc-950 stroke-[3]" />
              {/if}
            </span>
          </button>
        </div>
      </div>

      <!-- Notes Textarea -->
      <div>
        <label for="edge-notes-input" class="block text-xs font-medium text-zinc-300 mb-1">
          Notas Secretas do Mestre sobre esta Relação
        </label>
        <textarea
          id="edge-notes-input"
          rows="3"
          placeholder="Ex: Como descobriram a ligação, DT de teste de Intuição, implicações de revelar aos jogadores..."
          bind:value={notes}
          class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 resize-none leading-relaxed"
        ></textarea>
      </div>

      <!-- Footer Actions -->
      <div class="flex items-center justify-between pt-3 border-t border-zinc-800">
        <button
          type="button"
          onclick={handleDelete}
          class="px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-950/40 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>Eliminar Ligação</span>
        </button>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => campaignStore.closeEdgeEditor()}
            class="px-4 py-2 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onclick={handleSave}
            class="px-5 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
          >
            <Check class="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Guardar Alterações</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
```

---

### 3.4 Store Enhancements (`src/lib/stores/campaignStore.svelte.ts`)

```typescript
import { initialCampaign } from '../data/sampleCampaign';
import type {
  CampaignData,
  ThreatClock,
  LoreEntry,
  EntityNodeData,
  CanvasRelationEdgeData,
  CanvasRelationEdge,
} from '../types';
import type { Node } from '@xyflow/svelte';
import { writable, get } from 'svelte/store';

class CampaignStore {
  campaign = $state<CampaignData>(initialCampaign);
  nodes = writable<Node<EntityNodeData>[]>(initialCampaign.nodes);
  edges = writable<CanvasRelationEdge[]>(initialCampaign.edges as CanvasRelationEdge[]);
  searchQuery = $state<string>('');
  selectedEntity = $state<EntityNodeData | null>(null);

  // Editing modal state
  editingNode = $state<EntityNodeData | null>(null);
  editingEdge = $state<CanvasRelationEdge | null>(null);

  loadCampaign(data: CampaignData) {
    this.campaign = JSON.parse(JSON.stringify(data));
    this.nodes.set(JSON.parse(JSON.stringify(data.nodes || [])));
    this.edges.set(JSON.parse(JSON.stringify(data.edges || [])));
    this.searchQuery = '';
    this.selectedEntity = null;
    this.editingNode = null;
    this.editingEdge = null;
  }

  exportCurrentCampaign(): CampaignData {
    return {
      ...JSON.parse(JSON.stringify(this.campaign)),
      nodes: JSON.parse(JSON.stringify(get(this.nodes))),
      edges: JSON.parse(JSON.stringify(get(this.edges))),
      updatedAt: 'Agora mesmo',
    };
  }

  openNodeEditor(data: EntityNodeData) {
    this.editingNode = JSON.parse(JSON.stringify(data));
  }

  closeNodeEditor() {
    this.editingNode = null;
  }

  openEdgeEditor(edge: CanvasRelationEdge) {
    this.editingEdge = JSON.parse(JSON.stringify(edge));
  }

  closeEdgeEditor() {
    this.editingEdge = null;
  }

  updateNodeData(id: string, partial: Partial<EntityNodeData>) {
    this.nodes.update((list) =>
      list.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...partial,
            },
          };
        }
        return node;
      })
    );
  }

  updateEdgeData(id: string, partialData: Partial<CanvasRelationEdgeData>) {
    this.edges.update((list) =>
      list.map((edge) => {
        if (edge.id === id) {
          const currentData = (edge.data || {}) as CanvasRelationEdgeData;
          return {
            ...edge,
            data: {
              ...currentData,
              ...partialData,
            },
          };
        }
        return edge;
      })
    );
  }

  deleteNode(id: string) {
    this.nodes.update((list) => list.filter((n) => n.id !== id));
    this.edges.update((list) => list.filter((e) => e.source !== id && e.target !== id));
    if (this.editingNode?.id === id) {
      this.editingNode = null;
    }
    if (this.editingEdge && (this.editingEdge.source === id || this.editingEdge.target === id)) {
      this.editingEdge = null;
    }
  }

  deleteEdge(id: string) {
    this.edges.update((list) => list.filter((e) => e.id !== id));
    if (this.editingEdge?.id === id) {
      this.editingEdge = null;
    }
  }

  incrementClock(clockId: string) {
    const clock = this.campaign.clocks.find((c) => c.id === clockId);
    if (clock && clock.filledSegments < clock.totalSegments) {
      clock.filledSegments += 1;
    }
  }

  decrementClock(clockId: string) {
    const clock = this.campaign.clocks.find((c) => c.id === clockId);
    if (clock && clock.filledSegments > 0) {
      clock.filledSegments -= 1;
    }
  }

  toggleLoreStatus(loreId: string) {
    const item = this.campaign.lore.find((l) => l.id === loreId);
    if (item) {
      item.status = item.status === 'SABIDO' ? 'SEGREDO' : 'SABIDO';
    }
  }

  addLoreEntry(content: string, status: 'SABIDO' | 'SEGREDO' = 'SEGREDO') {
    const newEntry: LoreEntry = {
      id: `lore-${Date.now()}`,
      content,
      status,
      sessionNumber: this.campaign.currentSession,
    };
    this.campaign.lore = [newEntry, ...this.campaign.lore];
  }

  addEntityNode(data: Partial<EntityNodeData>, x = 300, y = 200) {
    const id = `node-${Date.now()}`;
    const newNode: Node<EntityNodeData> = {
      id,
      type: 'entityNode',
      position: { x, y },
      data: {
        id,
        type: data.type || 'npc',
        title: data.title || 'Nova Entidade',
        subtitle: data.subtitle || (data.type || 'npc').toUpperCase(),
        description: data.description || 'Clica duas vezes para editar a descrição...',
        color: data.color || '#d4a359',
        isSecret: data.isSecret || false,
      },
    };
    this.nodes.update((list) => [...list, newNode]);
  }
}

export const campaignStore = new CampaignStore();
```

---

### 3.5 Canvas View Registration (`src/lib/components/canvas/CanvasView.svelte`)

```svelte
<script lang="ts">
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    type NodeTypes,
    type EdgeTypes,
    type Connection,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import EntityNode from './nodes/EntityNode.svelte';
  import CustomLabeledEdge from './edges/CustomLabeledEdge.svelte';
  import EditEntityModal from './EditEntityModal.svelte';
  import EditEdgeModal from './EditEdgeModal.svelte';
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import type { CanvasRelationEdge } from '../../types';
  import { User, Shield, MapPin, Skull, Plus } from 'lucide-svelte';

  const nodeTypes: NodeTypes = {
    entityNode: EntityNode as any,
  };

  const edgeTypes: EdgeTypes = {
    customLabeled: CustomLabeledEdge as any,
    smoothstep: CustomLabeledEdge as any,
    default: CustomLabeledEdge as any,
  };

  const nodes = campaignStore.nodes;
  const edges = campaignStore.edges;

  function addQuickEntity(type: 'npc' | 'faction' | 'location' | 'secret') {
    const titles = {
      npc: 'Novo NPC',
      faction: 'Nova Fação',
      location: 'Novo Local',
      secret: 'Novo Segredo',
    };
    const subtitles = {
      npc: 'NPC',
      faction: 'FACÇÃO',
      location: 'LOCAL',
      secret: 'SEGREDO',
    };
    const colors = {
      npc: '#d4a359',
      faction: '#a855f7',
      location: '#38bdf8',
      secret: '#f87171',
    };

    const x = 250 + Math.random() * 80;
    const y = 150 + Math.random() * 80;

    campaignStore.addEntityNode(
      {
        type,
        title: titles[type],
        subtitle: subtitles[type],
        description: 'Clica duas vezes para editar a descrição e notas...',
        color: colors[type],
        isSecret: type === 'secret',
      },
      x,
      y
    );
  }

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target || connection.source === connection.target) {
      return;
    }
    const newEdge: CanvasRelationEdge = {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'customLabeled',
      data: {
        label: 'ligação',
        relationType: 'neutral',
        pathType: 'smoothstep',
        bidirectional: false,
        notes: '',
      },
    };
    edges.update((list) => [...list, newEdge]);
  }
</script>

<div class="w-full h-full bg-[#0b0d11] relative overflow-hidden">
  <!-- Floating Node Creation Toolbar -->
  <div class="absolute top-4 left-4 z-10 flex items-center gap-1.5 p-1.5 rounded-xl bg-zinc-900/95 border border-zinc-800/90 backdrop-blur-md shadow-xl select-none">
    <span class="text-[10px] font-bold text-zinc-500 uppercase px-2">Adicionar:</span>

    <button
      onclick={() => addQuickEntity('npc')}
      class="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
      title="Adicionar Personagem / NPC"
    >
      <User class="w-3 h-3" />
      <span>+ NPC</span>
    </button>

    <button
      onclick={() => addQuickEntity('faction')}
      class="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
      title="Adicionar Fação / Organização"
    >
      <Shield class="w-3 h-3" />
      <span>+ Fação</span>
    </button>

    <button
      onclick={() => addQuickEntity('location')}
      class="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
      title="Adicionar Local / Região"
    >
      <MapPin class="w-3 h-3" />
      <span>+ Local</span>
    </button>

    <button
      onclick={() => addQuickEntity('secret')}
      class="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
      title="Adicionar Pista / Segredo Oculto"
    >
      <Skull class="w-3 h-3" />
      <span>+ Segredo</span>
    </button>
  </div>

  <!-- Empty Canvas Watermark / Hint -->
  {#if $nodes.length === 0}
    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0">
      <div class="p-6 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-center space-y-2 max-w-sm pointer-events-auto backdrop-blur-sm shadow-2xl">
        <div class="w-10 h-10 mx-auto rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
          <Plus class="w-5 h-5" />
        </div>
        <h3 class="text-sm font-semibold text-zinc-200">Quadro sem Nós</h3>
        <p class="text-xs text-zinc-400 leading-relaxed">
          O teu canvas está pronto. Clica nos botões acima para adicionar o teu primeiro NPC, Local, Fação ou Segredo!
        </p>
      </div>
    </div>
  {/if}

  <SvelteFlow
    {nodes}
    {edges}
    {nodeTypes}
    {edgeTypes}
    defaultEdgeOptions={{ type: 'customLabeled' }}
    onconnect={handleConnect}
    fitView
    class="bg-[#0b0d11]"
  >
    <Background gap={28} size={1.2} bgColor="#0b0d11" patternColor="#222733" />
    <Controls class="!bg-zinc-900 !border-zinc-800 !text-zinc-200 fill-zinc-200" />
    <MiniMap
      nodeColor="#3f3f46"
      maskColor="rgba(11, 13, 17, 0.85)"
      class="!bg-zinc-950 !border !border-zinc-800/90 rounded-lg overflow-hidden"
    />
  </SvelteFlow>

  <!-- Modals -->
  <EditEntityModal />
  <EditEdgeModal />
</div>
```

---

## 4. Integration Verification & Edge Case Matrix

| ID | Edge Case / Scenario | Implemented Protection |
|---|---|---|
| 1 | **Self-Connecting Loops** | `handleConnect` guards with `if (connection.source === connection.target) return;` preventing self-referencing cycles on single entity nodes. |
| 2 | **Node Deletion with Connected Edges** | `deleteNode(id)` in `campaignStore` atomically filters both `$nodes` and `$edges`, and resets `editingEdge` if the deleted node was source or target. |
| 3 | **Canvas Pan Triggered by Edge Label Click** | `<div class="nodrag nopan ...">` on the label container prevents Svelte Flow from capturing drag events during modal triggers. |
| 4 | **Missing or Undefined Edge Data** | Fallbacks: `data?.relationType || 'neutral'`, `data?.pathType || 'smoothstep'`, `data?.label || 'ligação'`. |
| 5 | **Bidirectional Graph Representation** | Rendered with visual `ArrowLeftRight` icon badge and bidirectional flags saved to `.mural` JSON. |
| 6 | **Special Characters & Accented Labels** | Unicode strings (`"é aliado de"`, `"esconde-se sob"`, `"investiga"`) render crisply with SVG/HTML escaping and UTF-8 encoding. |

---

## 5. Summary of Recommended Files to Create/Update

1. **Create** `src/lib/components/canvas/edges/CustomLabeledEdge.svelte` (Custom semantic edge with label renderer, 6 styling modes, 3 path geometries, inline delete button).
2. **Create** `src/lib/components/canvas/EditEdgeModal.svelte` (Complete modal for label presets, relation category, geometry, bidirectionality, and notes).
3. **Update** `src/lib/types/index.ts` (Add `RelationType`, `EdgePathType`, `CanvasRelationEdgeData`, `CanvasRelationEdge`).
4. **Update** `src/lib/stores/campaignStore.svelte.ts` (Add `editingEdge`, `openEdgeEditor`, `closeEdgeEditor`, `updateEdgeData`, `deleteEdge`).
5. **Update** `src/lib/components/canvas/CanvasView.svelte` (Register `edgeTypes`, add `defaultEdgeOptions`, update `handleConnect`, mount `EditEdgeModal`).
