<!-- File: src/lib/components/canvas/CanvasContent.svelte -->
<script lang="ts">
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    useSvelteFlow,
    SelectionMode,
    type NodeTypes,
    type EdgeTypes,
    type Connection,
    type Edge,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import EntityNode from './nodes/EntityNode.svelte';
  import CustomLabeledEdge from './edges/CustomLabeledEdge.svelte';
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import {
    autoLayoutNodes,
    alignNodes,
    distributeNodes,
    type LayoutAlgorithm,
    type LayoutDirection,
  } from '../../services/layout';
  import type { EntityCategory, CanvasRelationEdgeData } from '../../types';
  import {
    User,
    Shield,
    MapPin,
    Skull,
    Plus,
    Sparkles,
    Maximize2,
    ZoomIn,
    ZoomOut,
    LayoutGrid,
    GitFork,
    Activity,
    AlignStartVertical,
    AlignCenterHorizontal,
    AlignStartHorizontal,
    AlignHorizontalDistributeCenter,
    Trash2,
    ChevronDown,
    FileText,
    Dices,
    Filter,
    Link2,
    Users,
    Swords,
    EyeOff,
    Search as SearchIcon,
    Tag,
  } from 'lucide-svelte';
  import { get } from 'svelte/store';
  import type { RelationType } from '../../types';

  // 1. Register Custom Node & Edge Types
  const nodeTypes: NodeTypes = {
    entityNode: EntityNode as any,
  };

  const edgeTypes: EdgeTypes = {
    customLabeledEdge: CustomLabeledEdge as any,
    smoothstep: CustomLabeledEdge as any,
    default: CustomLabeledEdge as any,
    straight: CustomLabeledEdge as any,
    bezier: CustomLabeledEdge as any,
    step: CustomLabeledEdge as any,
  };

  const nodesStore = campaignStore.nodes;
  const edgesStore = campaignStore.edges;

  // Svelte Flow flow control instance
  const { fitView, zoomIn, zoomOut, setZoom } = useSvelteFlow();

  // Local Reactive State using Svelte 5 Runes
  let showLayoutDropdown = $state(false);
  let showEdgeFilterDropdown = $state(false);
  let activeLayoutAlgo = $state<LayoutAlgorithm>('hierarchical');

  // Derive selection state
  const selectedNodes = $derived($nodesStore.filter((n) => n.selected));
  const selectedCount = $derived(selectedNodes.length);

  // 2. Quick Entity Creation Handler
  function addQuickEntity(type: EntityCategory) {
    const titles: Record<EntityCategory, string> = {
      npc: 'Novo NPC',
      faction: 'Nova Facção',
      location: 'Novo Local',
      secret: 'Novo Segredo',
      clue: 'Nova Pista',
      note: 'Nova Nota / Documento',
      table: 'Tabela de Encontros',
    };
    const subtitles: Record<EntityCategory, string> = {
      npc: 'NPC',
      faction: 'FACÇÃO',
      location: 'LOCAL',
      secret: 'SEGREDO',
      clue: 'PISTA',
      note: 'NOTA',
      table: 'TABELA 1d6',
    };
    const colors: Record<EntityCategory, string> = {
      npc: '#d4a359',
      faction: '#a855f7',
      location: '#38bdf8',
      secret: '#f87171',
      clue: '#10b981',
      note: '#71717a',
      table: '#d4a359',
    };

    // Stagger spawn coordinates near center
    const x = 280 + (Math.random() * 120 - 60);
    const y = 180 + (Math.random() * 120 - 60);

    const initialTables =
      type === 'table'
        ? [
            {
              id: `table-${Date.now()}`,
              title: 'Tabela de Encontros (1d6)',
              diceType: 'd6' as const,
              description: 'Eventos ou encontros aleatórios.',
              rows: [
                { id: 'r-1', range: '1-2', title: 'Patrulha de Guardas', description: '2 guardas vigilantes aproximam-se.' },
                { id: 'r-2', range: '3-4', title: 'Comerciante Suspeito', description: 'Oferece itens raros.' },
                { id: 'r-3', range: '5', title: 'Ruído Misterioso', description: 'Passos ou sussurros nas sombras.' },
                { id: 'r-4', range: '6', title: 'Pista Revelada', description: 'Um rastro deixado para trás.' },
              ],
            },
          ]
        : [];

    campaignStore.addEntityNode(
      {
        category: type,
        type,
        title: titles[type] || 'Nova Entidade',
        subtitle: subtitles[type] || type.toUpperCase(),
        description:
          type === 'table'
            ? 'Clica em Rolar para sortear um evento aleatório.'
            : 'Clica duas vezes para editar a descrição e notas...',
        colorTheme: colors[type] || '#d4a359',
        color: colors[type] || '#d4a359',
        isSecret: type === 'secret',
        icon: type === 'note' ? 'file-text' : type === 'table' ? 'dices' : undefined,
        tables: initialTables,
      },
      x,
      y
    );
  }

  // 3. Typed Connection Lifecycle Handler
  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;

    campaignStore.recordSnapshot();

    const newEdge: Edge<CanvasRelationEdgeData> = {
      id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'customLabeledEdge',
      data: {
        label: 'ligado a',
        relationType: 'neutral',
        pathType: 'smoothstep',
        bidirectional: false,
        notes: '',
      },
    };

    edgesStore.update((list) => [...list, newEdge]);
    campaignStore.markDirty();
  }

  // 3.5. Native Svelte Flow Elements Deletion Callback
  function handleDeleteElements(params: { nodes?: any[]; edges?: any[] }) {
    const { nodes: deletedNodes, edges: deletedEdges } = params || {};
    let changed = false;

    if (deletedEdges && deletedEdges.length > 0) {
      campaignStore.recordSnapshot();
      for (const e of deletedEdges) {
        edgesStore.update((list) => list.filter((item) => item.id !== e.id));
      }
      changed = true;
    }

    if (deletedNodes && deletedNodes.length > 0) {
      if (!changed) campaignStore.recordSnapshot();
      const nodeSet = new Set(deletedNodes.map((n) => n.id));
      nodesStore.update((list) => list.filter((n) => !nodeSet.has(n.id)));
      edgesStore.update((list) => list.filter((e) => !nodeSet.has(e.source) && !nodeSet.has(e.target)));
      changed = true;
    }

    if (changed) {
      campaignStore.markDirty();
    }
  }

  // 4. Auto-Layout Application Trigger
  function applyLayout(algorithm: LayoutAlgorithm = 'hierarchical', direction: LayoutDirection = 'TB') {
    activeLayoutAlgo = algorithm;
    showLayoutDropdown = false;

    const currentNodes = get(nodesStore);
    const currentEdges = get(edgesStore);

    const result = autoLayoutNodes(currentNodes, currentEdges, {
      algorithm,
      direction,
      nodeWidth: 260,
      nodeHeight: 140,
      spacingX: 70,
      spacingY: 100,
      iterations: 100,
    });

    nodesStore.set(result.nodes);

    // Smoothly animate viewport to fit the freshly organized graph
    setTimeout(() => {
      fitView({ duration: 500, padding: 0.15 });
    }, 50);
  }

  // 5. Bulk Alignment & Distribution Handlers
  function handleAlign(alignment: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') {
    if (selectedCount < 2) return;
    const currentNodes = get(nodesStore);
    const selectedIds = selectedNodes.map((n) => n.id);
    const aligned = alignNodes(currentNodes, selectedIds, alignment);
    nodesStore.set(aligned);
  }

  function handleDistribute(direction: 'horizontal' | 'vertical') {
    if (selectedCount < 3) return;
    const currentNodes = get(nodesStore);
    const selectedIds = selectedNodes.map((n) => n.id);
    const distributed = distributeNodes(currentNodes, selectedIds, direction);
    nodesStore.set(distributed);
  }

  // 6. Delete Selected Elements Handler
  function handleDeleteSelected() {
    const currentNodes = get(nodesStore);
    const currentEdges = get(edgesStore);
    const selectedNodeIds = currentNodes.filter((n) => n.selected).map((n) => n.id);
    const selectedEdgeIds = currentEdges.filter((e) => e.selected).map((e) => e.id);

    if (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0) {
      // 1. Take snapshot BEFORE deleting
      campaignStore.recordSnapshot();

      // 2. Delete nodes and connected edges
      if (selectedNodeIds.length > 0) {
        const nodeSet = new Set(selectedNodeIds);
        nodesStore.update((list) => list.filter((n) => !nodeSet.has(n.id)));
        edgesStore.update((list) => list.filter((e) => !nodeSet.has(e.source) && !nodeSet.has(e.target)));
      }

      // 3. Delete individually selected edges
      if (selectedEdgeIds.length > 0) {
        const edgeSet = new Set(selectedEdgeIds);
        edgesStore.update((list) => list.filter((e) => !edgeSet.has(e.id)));
      }

      campaignStore.markDirty();
    }
  }

  // 7. Keyboard Shortcuts (Delete / Backspace, Undo / Redo)
  function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (isInput) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      const currentNodes = get(nodesStore);
      const currentEdges = get(edgesStore);
      const selectedNodeIds = currentNodes.filter((n) => n.selected).map((n) => n.id);
      const selectedEdgeIds = currentEdges.filter((e) => e.selected).map((e) => e.id);

      if (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        handleDeleteSelected();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        campaignStore.redo();
      } else {
        campaignStore.undo();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      campaignStore.redo();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="w-full h-full bg-[#0b0d11] relative overflow-hidden select-none">
  <!-- Top Floating Master Toolbar -->
  <div class="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 max-w-[calc(100%-24px)]">
    <!-- Group 1: Entity Creation Buttons -->
    <div class="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-xl">
      <span class="text-[10px] font-bold text-zinc-500 uppercase px-1.5 hidden sm:inline">Adicionar:</span>

      <button
        type="button"
        onclick={() => addQuickEntity('npc')}
        class="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        title="Adicionar Personagem / NPC"
      >
        <User class="w-3 h-3" />
        <span>+ NPC</span>
      </button>

      <button
        type="button"
        onclick={() => addQuickEntity('faction')}
        class="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        title="Adicionar Facção / Organização"
      >
        <Shield class="w-3 h-3" />
        <span>+ Facção</span>
      </button>

      <button
        type="button"
        onclick={() => addQuickEntity('location')}
        class="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        title="Adicionar Local / Região"
      >
        <MapPin class="w-3 h-3" />
        <span>+ Local</span>
      </button>

      <button
        type="button"
        onclick={() => addQuickEntity('secret')}
        class="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        title="Adicionar Pista / Segredo Oculto"
      >
        <Skull class="w-3 h-3" />
        <span>+ Segredo</span>
      </button>

      <button
        type="button"
        onclick={() => addQuickEntity('note')}
        class="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        title="Adicionar Nota / Documento de Lore"
      >
        <FileText class="w-3 h-3" />
        <span>+ Nota</span>
      </button>

      <button
        type="button"
        onclick={() => addQuickEntity('table')}
        class="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        title="Adicionar Tabela de Encontros / Dados"
      >
        <Dices class="w-3 h-3" />
        <span>+ Tabela</span>
      </button>
    </div>

    <!-- Group 2: Auto-Layout Engine Dropdown -->
    <div class="relative">
      <div class="flex items-center rounded-xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-xl p-1">
        <button
          type="button"
          onclick={() => applyLayout('hierarchical')}
          class="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          title="Organizar Grafo Automaticamente"
        >
          <Sparkles class="w-3 h-3 text-indigo-400" />
          <span>Auto-Layout</span>
        </button>

        <button
          type="button"
          onclick={() => (showLayoutDropdown = !showLayoutDropdown)}
          class="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition cursor-pointer"
          title="Escolher Algoritmo de Auto-Organização"
        >
          <ChevronDown class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Layout Dropdown Menu -->
      {#if showLayoutDropdown}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onclick={() => (showLayoutDropdown = false)}
          class="fixed inset-0 z-20 cursor-default"
        ></div>
        <div class="absolute left-0 top-full mt-1.5 w-56 rounded-xl bg-zinc-900 border border-zinc-700/90 shadow-2xl p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-100">
          <div class="text-[10px] font-bold text-zinc-400 uppercase px-2 py-1">Algoritmo de Organização</div>

          <button
            type="button"
            onclick={() => applyLayout('hierarchical', 'TB')}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer {activeLayoutAlgo === 'hierarchical' ? 'bg-indigo-500/20 text-indigo-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <GitFork class="w-3.5 h-3.5 text-indigo-400" />
            <div>
              <div>Hierárquico (DAG)</div>
              <div class="text-[10px] text-zinc-500">Fluxo vertical de cima para baixo</div>
            </div>
          </button>

          <button
            type="button"
            onclick={() => applyLayout('hierarchical', 'LR')}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-zinc-300 hover:bg-zinc-800"
          >
            <GitFork class="w-3.5 h-3.5 text-indigo-400 rotate-90" />
            <div>
              <div>Hierárquico (Esquerda-Direita)</div>
              <div class="text-[10px] text-zinc-500">Fluxo horizontal expandido</div>
            </div>
          </button>

          <button
            type="button"
            onclick={() => applyLayout('force')}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer {activeLayoutAlgo === 'force' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <Activity class="w-3.5 h-3.5 text-emerald-400" />
            <div>
              <div>Orgânico (Física / Forças)</div>
              <div class="text-[10px] text-zinc-500">Agrupa nós relacionados por gravidade</div>
            </div>
          </button>

          <button
            type="button"
            onclick={() => applyLayout('grid')}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer {activeLayoutAlgo === 'grid' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <LayoutGrid class="w-3.5 h-3.5 text-sky-400" />
            <div>
              <div>Grelha / Matriz</div>
              <div class="text-[10px] text-zinc-500">Distribuição uniforme em linhas e colunas</div>
            </div>
          </button>
        </div>
      {/if}
    </div>

    <!-- Group 2.5: Edge / Connection Type Filter Dropdown (US 148) -->
    <div class="relative">
      <div class="flex items-center rounded-xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-xl p-1">
        <button
          type="button"
          onclick={() => (showEdgeFilterDropdown = !showEdgeFilterDropdown)}
          class="px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer {campaignStore.activeEdgeFilter === 'all'
            ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:text-white'
            : 'bg-amber-500/15 border-amber-500/40 text-amber-300'}"
          title="Filtrar Conexões Visíveis"
        >
          <Filter class="w-3 h-3 {campaignStore.activeEdgeFilter !== 'all' ? 'text-amber-400' : 'text-zinc-400'}" />
          <span class="capitalize">
            {campaignStore.activeEdgeFilter === 'all' ? 'Conexões' : `Filtro: ${campaignStore.activeEdgeFilter}`}
          </span>
          <ChevronDown class="w-3 h-3 text-zinc-400" />
        </button>
      </div>

      {#if showEdgeFilterDropdown}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onclick={() => (showEdgeFilterDropdown = false)}
          class="fixed inset-0 z-20 cursor-default"
        ></div>
        <div class="absolute left-0 top-full mt-1.5 w-52 rounded-xl bg-zinc-900 border border-zinc-700/90 shadow-2xl p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-100">
          <div class="text-[10px] font-bold text-zinc-400 uppercase px-2 py-1 flex items-center justify-between">
            <span>Filtro de Conexões</span>
            {#if campaignStore.activeEdgeFilter !== 'all'}
              <button
                type="button"
                onclick={() => (campaignStore.activeEdgeFilter = 'all')}
                class="text-[10px] text-amber-400 hover:underline cursor-pointer"
              >
                Limpar
              </button>
            {/if}
          </div>

          <button
            type="button"
            onclick={() => { campaignStore.activeEdgeFilter = 'all'; showEdgeFilterDropdown = false; }}
            class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer {campaignStore.activeEdgeFilter === 'all' ? 'bg-zinc-800 text-amber-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <div class="flex items-center gap-2">
              <Link2 class="w-3.5 h-3.5 text-zinc-400" />
              <span>Todas as Conexões</span>
            </div>
            <span class="text-[10px] text-zinc-500 font-mono">{$edgesStore.length}</span>
          </button>

          <button
            type="button"
            onclick={() => { campaignStore.activeEdgeFilter = 'allied'; showEdgeFilterDropdown = false; }}
            class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer {campaignStore.activeEdgeFilter === 'allied' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <div class="flex items-center gap-2">
              <Users class="w-3.5 h-3.5 text-emerald-400" />
              <span>Aliados / Cooperação</span>
            </div>
            <span class="text-[10px] text-zinc-500 font-mono">{$edgesStore.filter(e => (e.data?.relationType || 'neutral') === 'allied').length}</span>
          </button>

          <button
            type="button"
            onclick={() => { campaignStore.activeEdgeFilter = 'hostile'; showEdgeFilterDropdown = false; }}
            class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer {campaignStore.activeEdgeFilter === 'hostile' ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <div class="flex items-center gap-2">
              <Swords class="w-3.5 h-3.5 text-rose-400" />
              <span>Inimigos / Hostil</span>
            </div>
            <span class="text-[10px] text-zinc-500 font-mono">{$edgesStore.filter(e => (e.data?.relationType || 'neutral') === 'hostile').length}</span>
          </button>

          <button
            type="button"
            onclick={() => { campaignStore.activeEdgeFilter = 'secret'; showEdgeFilterDropdown = false; }}
            class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer {campaignStore.activeEdgeFilter === 'secret' ? 'bg-purple-500/20 text-purple-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <div class="flex items-center gap-2">
              <EyeOff class="w-3.5 h-3.5 text-purple-400" />
              <span>Segredos / Ocultos</span>
            </div>
            <span class="text-[10px] text-zinc-500 font-mono">{$edgesStore.filter(e => (e.data?.relationType || 'neutral') === 'secret').length}</span>
          </button>

          <button
            type="button"
            onclick={() => { campaignStore.activeEdgeFilter = 'investigates'; showEdgeFilterDropdown = false; }}
            class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer {campaignStore.activeEdgeFilter === 'investigates' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <div class="flex items-center gap-2">
              <SearchIcon class="w-3.5 h-3.5 text-amber-400" />
              <span>Investiga / Pistas</span>
            </div>
            <span class="text-[10px] text-zinc-500 font-mono">{$edgesStore.filter(e => (e.data?.relationType || 'neutral') === 'investigates').length}</span>
          </button>

          <button
            type="button"
            onclick={() => { campaignStore.activeEdgeFilter = 'custom'; showEdgeFilterDropdown = false; }}
            class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition cursor-pointer {campaignStore.activeEdgeFilter === 'custom' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <div class="flex items-center gap-2">
              <Tag class="w-3.5 h-3.5 text-sky-400" />
              <span>Customizados</span>
            </div>
            <span class="text-[10px] text-zinc-500 font-mono">{$edgesStore.filter(e => (e.data?.relationType || 'neutral') === 'custom').length}</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- Group 3: Contextual Selection Actions (Appears when >= 2 nodes selected) -->
    {#if selectedCount >= 2}
      <div class="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/95 border border-amber-500/40 backdrop-blur-md shadow-xl animate-in fade-in duration-150">
        <span class="text-[10px] font-bold text-amber-400 uppercase px-1.5">{selectedCount} selecionados</span>

        <button
          type="button"
          onclick={() => handleAlign('top')}
          class="p-1 rounded-md text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
          title="Alinhar ao Topo"
        >
          <AlignStartVertical class="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onclick={() => handleAlign('center-h')}
          class="p-1 rounded-md text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
          title="Alinhar ao Centro Horizontal"
        >
          <AlignCenterHorizontal class="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onclick={() => handleAlign('left')}
          class="p-1 rounded-md text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
          title="Alinhar à Esquerda"
        >
          <AlignStartHorizontal class="w-3.5 h-3.5" />
        </button>

        {#if selectedCount >= 3}
          <button
            type="button"
            onclick={() => handleDistribute('horizontal')}
            class="p-1 rounded-md text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
            title="Distribuir Horizontalmente"
          >
            <AlignHorizontalDistributeCenter class="w-3.5 h-3.5" />
          </button>
        {/if}

        <div class="w-px h-4 bg-zinc-800 mx-0.5"></div>

        <button
          type="button"
          onclick={handleDeleteSelected}
          class="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-950/40 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
          title="Eliminar nós selecionados (Delete)"
        >
          <Trash2 class="w-3 h-3" />
          <span>Eliminar</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Top-Right Floating Viewport Controls -->
  <div class="absolute top-3 right-3 z-10 flex items-center gap-1 p-1 rounded-xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-xl">
    <button
      type="button"
      onclick={() => fitView({ duration: 400, padding: 0.2 })}
      class="p-1.5 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
      title="Ajustar Vista (Fit View)"
    >
      <Maximize2 class="w-3.5 h-3.5" />
    </button>

    <button
      type="button"
      onclick={() => zoomIn({ duration: 200 })}
      class="p-1.5 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
      title="Aumentar Zoom (+)"
    >
      <ZoomIn class="w-3.5 h-3.5" />
    </button>

    <button
      type="button"
      onclick={() => zoomOut({ duration: 200 })}
      class="p-1.5 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
      title="Diminuir Zoom (-)"
    >
      <ZoomOut class="w-3.5 h-3.5" />
    </button>

    <button
      type="button"
      onclick={() => setZoom(1, { duration: 200 })}
      class="px-2 py-1 rounded-lg text-[11px] font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
      title="Zoom 100%"
    >
      1:1
    </button>
  </div>

  <!-- Empty Canvas Watermark -->
  {#if $nodesStore.length === 0}
    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0">
      <div class="p-6 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-center space-y-2 max-w-sm pointer-events-auto backdrop-blur-sm shadow-2xl">
        <div class="w-10 h-10 mx-auto rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
          <Plus class="w-5 h-5" />
        </div>
        <h3 class="text-sm font-semibold text-zinc-200">Quadro de Investigação Vazio</h3>
        <p class="text-xs text-zinc-400 leading-relaxed">
          Clica nos botões da barra superior para adicionar o teu primeiro NPC, Facção, Local ou Segredo!
        </p>
      </div>
    </div>
  {/if}

  <!-- Main SvelteFlow Graph Canvas -->
  <SvelteFlow
    nodes={nodesStore}
    edges={edgesStore}
    {nodeTypes}
    {edgeTypes}
    defaultEdgeOptions={{
      type: 'customLabeledEdge',
    }}
    onconnect={handleConnect}
    ondelete={handleDeleteElements}
    deleteKey={['Delete', 'Backspace']}
    selectionMode={SelectionMode.Partial}
    panOnDrag={true}
    selectionKey="Shift"
    nodesDraggable={true}
    fitView
    class="bg-[#0b0d11]"
  >
    <Background gap={28} size={1.2} bgColor="#0b0d11" patternColor="#222733" />
    <Controls class="!bg-zinc-900 !border-zinc-800 !text-zinc-200 fill-zinc-200" showZoom={false} showFitView={false} />
    <MiniMap
      nodeColor="#3f3f46"
      maskColor="rgba(11, 13, 17, 0.85)"
      class="!bg-zinc-950 !border !border-zinc-800/90 rounded-lg overflow-hidden"
    />
  </SvelteFlow>
</div>
