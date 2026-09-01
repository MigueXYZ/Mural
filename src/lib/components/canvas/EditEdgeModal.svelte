<!-- File: src/lib/components/canvas/EditEdgeModal.svelte -->
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

  import { ICON_OPTIONS } from '../../utils/icons';

  const edge = $derived(campaignStore.editingEdge);
  const nodes = campaignStore.nodes;

  // Form local state
  let label = $state('');
  let relationType = $state<RelationType>('neutral');
  let pathType = $state<EdgePathType>('smoothstep');
  let bidirectional = $state(false);
  let notes = $state('');
  let customColor = $state('#38bdf8');
  let selectedIcon = $state('tag');

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
      selectedIcon = (data.icon as string) || 'tag';
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
    if (cat && (!label || label === 'ligação' || label === 'ligado a' || relationCategories.some((r) => r.defaultLabels.includes(label)))) {
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
        icon: selectedIcon !== 'tag' || relationType === 'custom' ? selectedIcon : undefined,
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
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
    onclick={(e) => {
      if (e.target === e.currentTarget) campaignStore.closeEdgeEditor();
    }}
  >
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

        <!-- Custom Style Section (Color & Icon Picker) -->
        {#if relationType === 'custom'}
          <div class="mt-3 space-y-3 p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 animate-in fade-in duration-150">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-zinc-200">Personalização da Conexão</span>
              <div class="flex items-center gap-2">
                <span class="text-[11px] text-zinc-400">Cor da Linha:</span>
                <input
                  type="color"
                  bind:value={customColor}
                  class="w-6 h-6 rounded cursor-pointer border border-zinc-700 bg-transparent p-0"
                />
              </div>
            </div>

            <!-- Icon Picker -->
            <div>
              <span class="block text-[11px] font-medium text-zinc-400 mb-1.5">
                Ícone Customizado
              </span>
              <div class="grid grid-cols-6 sm:grid-cols-10 gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
                {#each ICON_OPTIONS as opt}
                  {@const IconComp = opt.component}
                  <button
                    type="button"
                    onclick={() => (selectedIcon = opt.id)}
                    title={opt.name}
                    class="h-8 rounded-lg flex items-center justify-center transition cursor-pointer {selectedIcon === opt.id
                      ? 'bg-amber-500/20 border border-amber-500 text-amber-300'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent'}"
                  >
                    <IconComp class="w-4 h-4" />
                  </button>
                {/each}
              </div>
            </div>
          </div>
        {/if}
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
