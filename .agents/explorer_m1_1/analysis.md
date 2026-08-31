# Architectural Analysis & Implementation Blueprint: Custom Entity Nodes & Modal Editor

**Role**: Custom Node & Entity Editor Explorer (`explorer_m1_1`)  
**Target Milestone**: M1 (Canvas & Relationship Graph Engine — F01, F02)  
**Status**: COMPLETE BLUEPRINT  

---

## 1. Executive Summary & Scope

Under **ORIGINAL_REQUEST §R1** and **PROJECT.md (F01 & F02)**, Mural requires a rich visual and interactive foundation for entity nodes on the conspiracy/investigation canvas. The entity nodes represent the core storytelling elements of any TTRPG campaign:
- **NPCs / Characters** (Suspects, Allies, Witnesses, Villains)
- **Factions / Cults / Organizations** (Orders, Gangs, Guilds, Syndicates)
- **Locations / Regions** (Mansions, Ruins, Streets, Safehouses)
- **Secrets / Clues / Mysteries** (Hidden truths, occult symbols, revelations)

This blueprint delivers the complete architectural design and production-ready source code for:
1. `src/lib/components/canvas/nodes/EntityNode.svelte`: High-fidelity custom node component with 4-way Svelte Flow connection handles, selection glow, in-place hover quick action bar (Edit, Duplicate, Toggle Secret, Delete), dynamic Lucide icon resolver, tags chip rack, color theme engine, and secret blur/reveal badge.
2. `src/lib/components/canvas/EditEntityModal.svelte`: Comprehensive modal editor featuring category switcher, dynamic icon selector grid, color palette & hex picker, interactive tag management with auto-suggestions, secret toggle, and real-time live preview.
3. `src/lib/utils/icons.ts`: Centralized, type-safe Lucide icon mapping matrix.
4. Extensions to `src/lib/stores/campaignStore.svelte.ts` and `src/lib/types/index.ts` to support seamless node duplication, secret toggling, and data model backward-compatibility.

---

## 2. Current State & Gap Analysis

### 2.1 Codebase Audit
| Component / File | Current State | Identified Gaps |
|---|---|---|
| `src/lib/types/index.ts` | Defines `EntityNodeData` with basic `type`, `title`, `description`, `color`, `isSecret`. | Lacks optional aliases (`category`, `colorTheme`), icon mapping types, tag defaults. |
| `src/lib/components/canvas/nodes/EntityNode.svelte` | Basic card rendering, static handles, limited hover bar (only edit/delete), no tag rendering, no dynamic custom icon, no duplicate action, no selection glow reactivity from `@xyflow/svelte`. | Missing `selected` prop binding for outer selection glow; missing tag chips list; missing duplicate node button; missing secret toggle button; missing custom icon rendering; handles need precise styling and distinct IDs. |
| `src/lib/components/canvas/EditEntityModal.svelte` | Basic modal with title, subtitle, description, type, and secret checkbox. | Missing tags input/manager; missing icon picker grid; missing color theme palette; missing live card preview; missing keyboard shortcuts (`Ctrl+Enter` save, `Escape` close). |
| `src/lib/stores/campaignStore.svelte.ts` | Has `openNodeEditor`, `closeNodeEditor`, `updateNodeData`, `deleteNode`, `addEntityNode`. | Missing `duplicateNode(id: string)` and `toggleNodeSecret(id: string)` convenience methods for in-place actions. |

---

## 3. Data Model Architecture (`src/lib/types/index.ts`)

To ensure 100% interoperability between `PROJECT.md` contracts and existing UI components, `EntityNodeData` is updated with backward-compatible aliases and rich metadata.

```typescript
export type EntityType = 'npc' | 'faction' | 'location' | 'secret' | 'clue';
export type EntityCategory = EntityType;

export interface EntityNodeData extends Record<string, unknown> {
  id: string;
  type: EntityType;
  category?: EntityCategory; // Alias for type
  title: string;
  subtitle?: string;         // e.g. "Suspeito", "Líder", "Ruínas Antigas"
  description: string;
  tags?: string[];           // Array of tag strings: ['Aliado', 'Nível 5', 'Alquimia']
  isSecret?: boolean;        // True if GM secret
  revealed?: boolean;        // True if revealed to players
  statusText?: string;       // Custom status tag
  icon?: string;             // Lucide icon identifier (e.g. 'user', 'shield', 'skull', 'sword')
  color?: string;            // Primary accent color hex (e.g. '#d4a359', '#f87171')
  colorTheme?: string;       // Alias for color
}
```

---

## 4. Icon Registry Utility (`src/lib/utils/icons.ts`)

A dedicated icon helper provides a curated set of 18 RPG icons from `lucide-svelte`, providing consistent rendering across nodes, modals, and lists.

```typescript
import {
  User,
  Users,
  Shield,
  MapPin,
  Castle,
  Building,
  Skull,
  Search,
  Sparkles,
  Sword,
  Crown,
  BookOpen,
  Scroll,
  Flame,
  Eye,
  EyeOff,
  Ghost,
  Key,
  Compass,
  HeartPulse,
  AlertTriangle,
  HelpCircle,
} from 'lucide-svelte';

export interface IconOption {
  id: string;
  name: string;
  component: any;
  category: 'general' | 'character' | 'organization' | 'location' | 'mystery';
}

export const ICON_OPTIONS: IconOption[] = [
  { id: 'user', name: 'Personagem', component: User, category: 'character' },
  { id: 'users', name: 'Grupo / Aliados', component: Users, category: 'character' },
  { id: 'crown', name: 'Líder / Nobreza', component: Crown, category: 'character' },
  { id: 'sword', name: 'Guerreiro / Ameaça', component: Sword, category: 'character' },
  { id: 'shield', name: 'Fação / Guarda', component: Shield, category: 'organization' },
  { id: 'building', name: 'Instituição', component: Building, category: 'organization' },
  { id: 'map-pin', name: 'Localização', component: MapPin, category: 'location' },
  { id: 'castle', name: 'Fortaleza / Base', component: Castle, category: 'location' },
  { id: 'compass', name: 'Região / Exploração', component: Compass, category: 'location' },
  { id: 'skull', name: 'Perigo Mortal / Vilão', component: Skull, category: 'mystery' },
  { id: 'ghost', name: 'Sobrenatural / Mistério', component: Ghost, category: 'mystery' },
  { id: 'eye', name: 'Vigilância / Segredo', component: Eye, category: 'mystery' },
  { id: 'search', name: 'Pista / Investigação', component: Search, category: 'mystery' },
  { id: 'key', name: 'Chave / Revelação', component: Key, category: 'mystery' },
  { id: 'book-open', name: 'Tomo / Documento', component: BookOpen, category: 'general' },
  { id: 'scroll', name: 'Pergaminho / Contrato', component: Scroll, category: 'general' },
  { id: 'flame', name: 'Fogo / Caos', component: Flame, category: 'general' },
  { id: 'sparkles', name: 'Magia / Artefacto', component: Sparkles, category: 'general' },
];

export const ICON_MAP: Record<string, any> = Object.fromEntries(
  ICON_OPTIONS.map((item) => [item.id, item.component])
);

export function getEntityIcon(iconId?: string, type?: string) {
  if (iconId && ICON_MAP[iconId]) {
    return ICON_MAP[iconId];
  }
  switch (type) {
    case 'npc':
      return User;
    case 'faction':
      return Shield;
    case 'location':
      return MapPin;
    case 'secret':
      return Skull;
    case 'clue':
      return Search;
    default:
      return HelpCircle;
  }
}
```

---

## 5. Complete Blueprint: `EntityNode.svelte`

### 5.1 Key Features
- **Svelte 5 Runes**: Full use of `$props()`, `$derived()`, `$state()` with TypeScript types.
- **Selection Glow**: Listens to `@xyflow/svelte` `selected` prop to apply reactive gold/amber focus rings and soft bloom glow.
- **Connection Handles (4 cardinal directions)**:
  - Top (`id="top"`): Target handle
  - Bottom (`id="bottom"`): Source handle
  - Left (`id="left"`): Target handle
  - Right (`id="right"`): Source handle
  - Prominent hover styles (`hover:scale-135 hover:!bg-amber-400`).
- **Hover Quick Actions Bar**:
  - `Pencil`: Opens modal editor (`campaignStore.openNodeEditor(data)`)
  - `Copy`: Clones node with offset (`campaignStore.duplicateNode(data.id)`)
  - `Eye` / `EyeOff`: Quick secret state toggle (`campaignStore.toggleNodeSecret(data.id)`)
  - `Trash2`: Deletes node (`campaignStore.deleteNode(data.id)`)
- **Category Badge & Lucide Icon**:
  - Dynamically renders configured Lucide icon with type-specific color palette.
- **Tags Display**:
  - Renders tag chips with `#tag` styling.
- **Secret Blur & GM Indicator**:
  - If `isSecret` is true, displays red "SEGREDO" pill, sinister dark-red gradient border, and blurred text filter with instant reveal toggle on hover/click.

### 5.2 Source Code Implementation

```svelte
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
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Tag,
  } from 'lucide-svelte';

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
  {#if data?.type === 'location'}
    <div class="my-2 h-9 w-full rounded-lg bg-zinc-950/80 border border-zinc-800 flex items-center justify-center relative overflow-hidden">
      <svg class="w-full h-7 px-2 text-sky-500/40" viewBox="0 0 100 24" fill="none" stroke="currentColor">
        <path d="M 0,18 L 20,18 L 20,8 L 60,8 L 60,18 L 100,18" stroke-width="2" stroke-linecap="round" />
        <circle cx="40" cy="13" r="2.5" fill="#38bdf8" />
      </svg>
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
</div>
```

---

## 6. Complete Blueprint: `EditEntityModal.svelte`

### 6.1 Key Features
- **Svelte 5 Runes**: Full state binding with `$state`, `$derived`, `$effect`.
- **Category Switcher**: 5 distinct categories (NPC, Fação, Local, Segredo, Pista) with dynamic default styling and icon adjustments.
- **Interactive Tag Management**:
  - Active tags displayed as removable badge chips.
  - Tag text input with `Enter` trigger to add.
  - Quick-add suggestion pills (`Aliado`, `Inimigo`, `Suspeito`, `Mágico`, `Perigoso`, `Crucial`).
- **Icon Selector Matrix**:
  - Curated 18-icon grid from `src/lib/utils/icons.ts`.
  - Highlights selected icon with animated gold ring.
- **Color Theme Palette & Custom Hex Swatch**:
  - 8 one-click RPG theme presets (`Gold`, `Purple`, `Sky`, `Rose`, `Emerald`, `Orange`, `Indigo`, `Zinc`).
  - Native color picker input + text input for custom hex values.
- **Live Real-Time Card Preview**:
  - Renders a real-time miniaturized preview of the entity card directly within the modal.
- **Keyboard Ergonomics**:
  - `Escape` closes modal.
  - `Ctrl + Enter` immediately saves and closes.

### 6.2 Source Code Implementation

```svelte
<!-- File: src/lib/components/canvas/EditEntityModal.svelte -->
<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import type { EntityType } from '../../types';
  import { ICON_OPTIONS, getEntityIcon } from '../../utils/icons';
  import {
    X,
    Trash2,
    Check,
    User,
    Shield,
    MapPin,
    Skull,
    Search,
    Lock,
    Tag,
    Plus,
    Palette,
    Eye,
  } from 'lucide-svelte';

  const node = $derived(campaignStore.editingNode);

  let title = $state('');
  let subtitle = $state('');
  let description = $state('');
  let type = $state<EntityType>('npc');
  let isSecret = $state(false);
  let tags = $state<string[]>([]);
  let tagInput = $state('');
  let color = $state('#d4a359');
  let selectedIcon = $state('user');

  // Color preset palette
  const COLOR_PALETTE = [
    { name: 'Ouro / Âmbar', hex: '#d4a359' },
    { name: 'Púrpura / Arcano', hex: '#a855f7' },
    { name: 'Azul Celeste / Local', hex: '#38bdf8' },
    { name: 'Carmesim / Sangue', hex: '#f87171' },
    { name: 'Esmeralda / Natureza', hex: '#10b981' },
    { name: 'Laranja / Chama', hex: '#f97316' },
    { name: 'Índigo / Mistério', hex: '#6366f1' },
    { name: 'Cinza / Sombra', hex: '#71717a' },
  ];

  // Category types list
  const typesList: { id: EntityType; label: string; icon: any; color: string; defaultColor: string; defaultIcon: string }[] = [
    { id: 'npc', label: 'NPC / Personagem', icon: User, color: 'text-amber-400 border-amber-500/40 bg-amber-500/10', defaultColor: '#d4a359', defaultIcon: 'user' },
    { id: 'faction', label: 'Façâo / Culto', icon: Shield, color: 'text-purple-400 border-purple-500/40 bg-purple-500/10', defaultColor: '#a855f7', defaultIcon: 'shield' },
    { id: 'location', label: 'Local / Região', icon: MapPin, color: 'text-sky-400 border-sky-500/40 bg-sky-500/10', defaultColor: '#38bdf8', defaultIcon: 'map-pin' },
    { id: 'secret', label: 'Segredo Oculto', icon: Skull, color: 'text-rose-400 border-rose-500/40 bg-rose-500/10', defaultColor: '#f87171', defaultIcon: 'skull' },
    { id: 'clue', label: 'Pista / Evidência', icon: Search, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10', defaultColor: '#10b981', defaultIcon: 'search' },
  ];

  const suggestedTags = ['Aliado', 'Inimigo', 'Suspeito', 'Mágico', 'Perigoso', 'Crucial', 'Investigado'];

  // Sync state whenever editingNode changes
  $effect(() => {
    if (node) {
      title = node.title || '';
      subtitle = node.subtitle || '';
      description = node.description || '';
      type = (node.type || node.category || 'npc') as EntityType;
      isSecret = Boolean(node.isSecret || node.type === 'secret');
      tags = Array.isArray(node.tags) ? [...node.tags] : [];
      color = node.color || node.colorTheme || '#d4a359';
      selectedIcon = node.icon || 'user';
    }
  });

  function handleTypeSelect(item: typeof typesList[0]) {
    type = item.id;
    if (!subtitle || subtitle === 'NPC' || subtitle === 'FACÇÃO' || subtitle === 'LOCAL' || subtitle === 'SEGREDO' || subtitle === 'PISTA') {
      subtitle = item.id.toUpperCase();
    }
    if (!node?.color) {
      color = item.defaultColor;
    }
    if (!node?.icon) {
      selectedIcon = item.defaultIcon;
    }
    if (item.id === 'secret') {
      isSecret = true;
    }
  }

  function addTag() {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      tags = [...tags, trimmed];
      tagInput = '';
    }
  }

  function removeTag(tagToRemove: string) {
    tags = tags.filter((t) => t !== tagToRemove);
  }

  function addSuggestedTag(tag: string) {
    if (!tags.includes(tag)) {
      tags = [...tags, tag];
    }
  }

  function handleSave() {
    if (node) {
      campaignStore.updateNodeData(node.id, {
        title: title.trim() || 'Sem Título',
        subtitle: subtitle.trim() || type.toUpperCase(),
        description: description.trim(),
        type,
        category: type,
        isSecret: isSecret || type === 'secret',
        tags,
        color,
        colorTheme: color,
        icon: selectedIcon,
      });
      campaignStore.closeNodeEditor();
    }
  }

  function handleDelete() {
    if (node && confirm(`Tens a certeza que desejas eliminar "${node.title}"?`)) {
      campaignStore.deleteNode(node.id);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      campaignStore.closeNodeEditor();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  }

  const PreviewIcon = $derived(getEntityIcon(selectedIcon, type));
</script>

<svelte:window onkeydown={handleKeydown} />

{#if node}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
    onclick={(e) => {
      if (e.target === e.currentTarget) campaignStore.closeNodeEditor();
    }}
  >
    <div
      class="w-full max-w-2xl bg-zinc-900 border border-zinc-700/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <span>Editar Elemento do Quadro</span>
          </h2>
          <p class="text-[11px] text-zinc-400">Personaliza categoria, aparência, tags e notas da entidade</p>
        </div>
        <button
          onclick={() => campaignStore.closeNodeEditor()}
          class="w-8 h-8 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-zinc-200">
        <!-- 1. Category Switcher -->
        <div>
          <label class="block text-xs font-semibold text-zinc-400 mb-2">Categoria da Entidade</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {#each typesList as item}
              {@const Icon = item.icon}
              <button
                type="button"
                onclick={() => handleTypeSelect(item)}
                class="p-2.5 rounded-xl border text-left flex items-center gap-2.5 text-xs font-semibold transition cursor-pointer {type ===
                item.id
                  ? `${item.color} ring-2 ring-amber-500/50 shadow-md`
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
              >
                <Icon class="w-4 h-4 flex-shrink-0" />
                <span class="truncate">{item.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- 2. Title and Subtitle Row -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="sm:col-span-2">
            <label for="entity-title" class="block font-medium text-zinc-300 mb-1">Título / Nome *</label>
            <input
              id="entity-title"
              type="text"
              placeholder="Ex: Serah a Espia, O Poço Selado..."
              bind:value={title}
              class="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
            />
          </div>
          <div>
            <label for="entity-subtitle" class="block font-medium text-zinc-300 mb-1">Rótulo / Papel</label>
            <input
              id="entity-subtitle"
              type="text"
              placeholder="Ex: Suspeito, Guarda, Aliado"
              bind:value={subtitle}
              class="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
            />
          </div>
        </div>

        <!-- 3. Tags Rack & Manager -->
        <div>
          <label class="block font-medium text-zinc-300 mb-1.5">Tags & Classificadores</label>
          <div class="flex items-center gap-2 mb-2">
            <div class="relative flex-1">
              <Tag class="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Escreve uma tag e prime Enter..."
                bind:value={tagInput}
                onkeydown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                class="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <button
              type="button"
              onclick={addTag}
              class="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          </div>

          <!-- Active tags list -->
          {#if tags.length > 0}
            <div class="flex flex-wrap gap-1.5 mb-2">
              {#each tags as tag}
                <span class="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] font-medium flex items-center gap-1.5">
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onclick={() => removeTag(tag)}
                    class="text-zinc-500 hover:text-rose-400 transition"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </span>
              {/each}
            </div>
          {/if}

          <!-- Suggested tags -->
          <div class="flex flex-wrap items-center gap-1.5 pt-1">
            <span class="text-[10px] text-zinc-500 font-medium">Sugestões:</span>
            {#each suggestedTags as stag}
              {#if !tags.includes(stag)}
                <button
                  type="button"
                  onclick={() => addSuggestedTag(stag)}
                  class="text-[10px] px-2 py-0.5 rounded-md bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 transition cursor-pointer"
                >
                  +{stag}
                </button>
              {/if}
            {/each}
          </div>
        </div>

        <!-- 4. Description / GM Notes -->
        <div>
          <label for="entity-desc" class="block font-medium text-zinc-300 mb-1">Descrição & Notas do Mestre</label>
          <textarea
            id="entity-desc"
            rows="3"
            placeholder="Informações chave, motivações, segredos e pistas associadas a este nó..."
            bind:value={description}
            class="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 resize-none leading-relaxed"
          ></textarea>
        </div>

        <!-- 5. Icon Selector Grid -->
        <div>
          <label class="block font-medium text-zinc-300 mb-1.5">Ícone Personalizado</label>
          <div class="grid grid-cols-6 sm:grid-cols-9 gap-1.5 p-2 bg-zinc-950/80 border border-zinc-800 rounded-2xl max-h-32 overflow-y-auto">
            {#each ICON_OPTIONS as opt}
              {@const IconCmp = opt.component}
              <button
                type="button"
                onclick={() => (selectedIcon = opt.id)}
                title={opt.name}
                class="p-2 rounded-xl border flex items-center justify-center transition cursor-pointer {selectedIcon === opt.id
                  ? 'bg-amber-500/20 border-amber-500/80 text-amber-300 ring-1 ring-amber-500/50 shadow-md'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}"
              >
                <IconCmp class="w-4 h-4" />
              </button>
            {/each}
          </div>
        </div>

        <!-- 6. Color Theme Palette & Custom Hex -->
        <div>
          <label class="block font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
            <Palette class="w-3.5 h-3.5 text-zinc-400" />
            <span>Tema de Cor do Nó</span>
          </label>
          <div class="flex flex-wrap items-center gap-2">
            {#each COLOR_PALETTE as cp}
              <button
                type="button"
                onclick={() => (color = cp.hex)}
                title={cp.name}
                class="w-6 h-6 rounded-full border transition cursor-pointer flex items-center justify-center {color === cp.hex
                  ? 'ring-2 ring-white scale-110 border-white'
                  : 'border-zinc-700 hover:scale-105'}"
                style="background-color: {cp.hex};"
              >
                {#if color === cp.hex}
                  <Check class="w-3 h-3 text-zinc-950 stroke-[3]" />
                {/if}
              </button>
            {/each}

            <!-- Custom Hex Input -->
            <div class="flex items-center gap-1.5 ml-auto">
              <input
                type="color"
                bind:value={color}
                class="w-6 h-6 rounded-lg bg-transparent border border-zinc-700 cursor-pointer"
              />
              <input
                type="text"
                bind:value={color}
                class="w-20 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-mono text-zinc-200 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>
        </div>

        <!-- 7. Secret Toggle -->
        <div class="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-3">
          <input
            id="modal-secret-toggle"
            type="checkbox"
            bind:checked={isSecret}
            class="mt-0.5 w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-rose-500 focus:ring-rose-500/30 accent-rose-500 cursor-pointer"
          />
          <label for="modal-secret-toggle" class="cursor-pointer select-none space-y-0.5 flex-1">
            <div class="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
              <Lock class="w-3.5 h-3.5 text-rose-400" />
              <span>Informação Secreta (Apenas para o Mestre)</span>
            </div>
            <p class="text-[11px] text-zinc-500">
              Aplica visual sombrio de mistério e desfoca notas quando visualizado em modo de jogador.
            </p>
          </label>
        </div>

        <!-- 8. Real-Time Mini Live Preview -->
        <div>
          <span class="block font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
            <Eye class="w-3.5 h-3.5 text-zinc-400" />
            <span>Pré-visualização em Tempo Real</span>
          </span>
          <div class="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 flex justify-center">
            <div
              class="w-64 rounded-2xl border p-3.5 shadow-lg backdrop-blur-md transition-all duration-150 {isSecret
                ? 'border-rose-900/80 bg-gradient-to-b from-zinc-950 to-rose-950/30'
                : 'border-zinc-800 bg-zinc-900/90'}"
            >
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-1.5">
                  <div class="w-5 h-5 rounded-lg flex items-center justify-center bg-zinc-800 text-zinc-200" style="color: {color};">
                    <PreviewIcon class="w-3 h-3" />
                  </div>
                  <span class="text-[10px] font-bold uppercase tracking-wider" style="color: {color};">
                    {subtitle || type.toUpperCase()}
                  </span>
                </div>
                {#if isSecret}
                  <span class="px-1.5 py-0.2 rounded bg-rose-950 text-[9px] font-bold text-rose-400 border border-rose-800">
                    SEGREDO
                  </span>
                {/if}
              </div>

              <h4 class="text-xs font-bold text-zinc-100">{title || 'Título do Nó'}</h4>

              {#if tags.length > 0}
                <div class="flex flex-wrap gap-1 mt-1.5">
                  {#each tags as tag}
                    <span class="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">#{tag}</span>
                  {/each}
                </div>
              {/if}

              <p class="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                {description || 'Sem descrição...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer Actions -->
      <div class="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
        <button
          type="button"
          onclick={handleDelete}
          class="px-3.5 py-2 rounded-xl text-rose-400 hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>Eliminar Nó</span>
        </button>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => campaignStore.closeNodeEditor()}
            class="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onclick={handleSave}
            class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Check class="w-3.5 h-3.5 stroke-[3]" />
            <span>Guardar Alterações</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
```

---

## 7. Store Extensions (`src/lib/stores/campaignStore.svelte.ts`)

To empower the in-place hover action bar on `EntityNode.svelte`, `campaignStore` must include two simple methods:

```typescript
  duplicateNode(id: string) {
    const list = get(this.nodes);
    const existing = list.find((n) => n.id === id);
    if (!existing) return;

    const newId = `node-${Date.now()}`;
    const duplicatedNode: Node<EntityNodeData> = {
      ...JSON.parse(JSON.stringify(existing)),
      id: newId,
      position: {
        x: existing.position.x + 40,
        y: existing.position.y + 40,
      },
      data: {
        ...JSON.parse(JSON.stringify(existing.data)),
        id: newId,
        title: `${existing.data.title || 'Entidade'} (Cópia)`,
      },
    };

    this.nodes.update((nodes) => [...nodes, duplicatedNode]);
  }

  toggleNodeSecret(id: string) {
    this.nodes.update((list) =>
      list.map((node) => {
        if (node.id === id) {
          const currentSecret = Boolean(node.data.isSecret || node.data.type === 'secret');
          return {
            ...node,
            data: {
              ...node.data,
              isSecret: !currentSecret,
            },
          };
        }
        return node;
      })
    );
  }
```

---

## 8. Verification & Acceptance Testing Strategy

### 8.1 Automated Compiler & Lint Gate
1. `npm run check` (`svelte-check --tsconfig ./tsconfig.json`): Verify 0 TypeScript and Svelte 5 rune errors.
2. `npm run build`: Verify production bundle generates cleanly with zero asset or style errors.

### 8.2 Interactive Functional Verification
1. **Creation & Theming**:
   - Click each toolbar quick-creation button (+ NPC, + Fação, + Local, + Segredo).
   - Verify node renders with appropriate category badge, default icon, and theme color.
2. **Handle Connectability**:
   - Drag connection lines from Top, Right, Bottom, and Left handles to other nodes.
   - Verify edges connect cleanly with high hit-box accuracy.
3. **Hover Quick Actions**:
   - Hover over card: action bar fades in.
   - Click `Pencil`: Opens `EditEntityModal`.
   - Click `Duplicate`: Clones node with offset + "(Cópia)" title.
   - Click `Secret Toggle`: Instantly flips secret state and applies/removes red gradient border.
   - Click `Trash`: Deletes node and cascades edge deletions.
4. **Modal Editing Experience**:
   - Add/remove tags, type custom tags with `Enter`.
   - Select custom icon from the 18-icon grid; check that live mini-preview updates instantly.
   - Pick color preset or custom hex; check live preview and saved canvas card.
   - Press `Ctrl+Enter` to save, `Escape` to cancel.
