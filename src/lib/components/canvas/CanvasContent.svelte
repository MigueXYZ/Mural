<!-- File: src/lib/components/canvas/CanvasContent.svelte -->
<script lang="ts">
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    useSvelteFlow,
    SelectionMode,
    ConnectionMode,
    type NodeTypes,
    type EdgeTypes,
    type Connection,
    type Edge,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import EntityNode from './nodes/EntityNode.svelte';
  import CustomLabeledEdge from './edges/CustomLabeledEdge.svelte';
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { appState } from '../../stores/appState.svelte';
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
    Pencil,
    Copy,
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
    Boxes,
    Folder,
    Sliders,
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
  const { fitView, zoomIn, zoomOut, setZoom, screenToFlowPosition } = useSvelteFlow();

  // Local Reactive State using Svelte 5 Runes
  let showAddMenu = $state(false);
  let showLayoutDropdown = $state(false);
  let showEdgeFilterDropdown = $state(false);
  let showUiScaleMenu = $state(false);
  let activeLayoutAlgo = $state<LayoutAlgorithm>('hierarchical');
  let scanToast = $state<string | null>(null);
  let scanToastTimeout: any = null;

  function handleScanWikilinks() {
    const result = campaignStore.scanAllWikilinkConnections();
    if (scanToastTimeout) clearTimeout(scanToastTimeout);
    if (result.created > 0) {
      scanToast = `✨ ${result.created} novas conexões criadas a partir de [[wikilinks]]! (${result.totalFound} referências encontradas)`;
    } else if (result.totalFound > 0) {
      scanToast = `ℹ️ Todas as conexões de [[wikilinks]] (${result.totalFound} encontradas) já estão no mural.`;
    } else {
      scanToast = `🔍 Nenhuma sintaxe [[nome_nota]] encontrada nas notas.`;
    }
    scanToastTimeout = setTimeout(() => {
      scanToast = null;
    }, 4500);
  }
  let contextMenu = $state<{
    show: boolean;
    x: number;
    y: number;
    flowX: number;
    flowY: number;
    nodeId?: string;
  }>({
    show: false,
    x: 0,
    y: 0,
    flowX: 0,
    flowY: 0,
  });

  const targetContextMenuNode = $derived(
    contextMenu.nodeId ? $nodesStore.find((n) => n.id === contextMenu.nodeId) : null
  );

  // Derive selection state
  const selectedNodes = $derived($nodesStore.filter((n) => n.selected));
  const selectedCount = $derived(selectedNodes.length);

  // Available folders for Canvas Scoping
  const availableFolders = $derived(
    (campaignStore.fileSystem || []).filter((f) => f.type === 'folder')
  );

  function handleScopeChange(folderId: string) {
    campaignStore.setCanvasScope(folderId);
    setTimeout(() => {
      fitView({ duration: 400, padding: 0.2 });
    }, 50);
  }

  // Canvas Drag & Drop handlers for dragging files from Dossiê & Notas onto the canvas
  function handleCanvasDragOver(e: DragEvent) {
    if (e.dataTransfer?.types.includes('application/mural-file-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleCanvasDrop(e: DragEvent) {
    const fileId = e.dataTransfer?.getData('application/mural-file-id');
    if (!fileId) return;

    e.preventDefault();

    let dropFlowX = 280;
    let dropFlowY = 180;
    if (typeof screenToFlowPosition === 'function') {
      try {
        const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        dropFlowX = Math.round(pos.x);
        dropFlowY = Math.round(pos.y);
      } catch (err) {
        console.warn('Failed to calculate drop position:', err);
      }
    }

    const fsItem = (campaignStore.fileSystem || []).find((f) => f.id === fileId);
    if (!fsItem) return;

    if (fsItem.nodeId) {
      // The file already has an associated node. Check if it's currently on the board
      const existingNode = get(nodesStore).find((n) => n.id === fsItem.nodeId);
      if (existingNode) {
        // Move existing node to drop position
        nodesStore.update((list) =>
          list.map((n) =>
            n.id === fsItem.nodeId
              ? { ...n, position: { x: dropFlowX - 140, y: dropFlowY - 50 } }
              : n
          )
        );
        const master = (campaignStore.campaign.nodes || []).find((n) => n.id === fsItem.nodeId);
        if (master) {
          master.position = { x: dropFlowX - 140, y: dropFlowY - 50 };
        }
        campaignStore.markDirty();
      } else {
        // Node exists in master campaign (or hidden by scope), bring it into active canvas
        const master = (campaignStore.campaign.nodes || []).find((n) => n.id === fsItem.nodeId);
        if (master) {
          master.position = { x: dropFlowX - 140, y: dropFlowY - 50 };
          nodesStore.update((list) => [...list, master]);
          campaignStore.markDirty();
        }
      }
    } else {
      // Item has no node yet (e.g. folder or bare file), create an entity on the canvas
      const category: EntityCategory = fsItem.type === 'folder' ? 'faction' : 'note';
      campaignStore.addEntityNode(
        {
          title: fsItem.name,
          category,
          type: category,
          folderId: fsItem.parentId,
        },
        dropFlowX - 140,
        dropFlowY - 50
      );
    }
  }

  // 2. Quick Entity Creation Handler
  function addQuickEntity(type: EntityCategory, pos?: { x: number; y: number }) {
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

    // Stagger spawn coordinates near center or use specific position
    const x = pos !== undefined ? pos.x : 280 + (Math.random() * 120 - 60);
    const y = pos !== undefined ? pos.y : 180 + (Math.random() * 120 - 60);

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

  // 2.5. Canvas Context Menu Handlers
  function handleCanvasContextMenu(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    // Do not hijack right clicks in inputs, textareas or contenteditables
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }
    // Do not show canvas menu if clicked on top toolbars, minimap, or controls
    if (target?.closest('.canvas-toolbar, .svelte-flow__minimap, .svelte-flow__controls')) {
      return;
    }

    e.preventDefault();

    showAddMenu = false;
    showLayoutDropdown = false;
    showEdgeFilterDropdown = false;
    showUiScaleMenu = false;

    let flowX = 280;
    let flowY = 180;
    if (typeof screenToFlowPosition === 'function') {
      try {
        const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        flowX = Math.round(pos.x);
        flowY = Math.round(pos.y);
      } catch (err) {
        console.warn('Failed to calculate flow position:', err);
      }
    }

    const nodeEl = target?.closest('.svelte-flow__node') as HTMLElement | null;
    const targetNodeId = nodeEl?.getAttribute('data-id') || undefined;

    const menuWidth = 210;
    const menuHeight = targetNodeId ? 290 : 250;
    const clampedX = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
    const clampedY = Math.min(e.clientY, window.innerHeight - menuHeight - 12);

    contextMenu = {
      show: true,
      x: Math.max(12, clampedX),
      y: Math.max(12, clampedY),
      flowX,
      flowY,
      nodeId: targetNodeId,
    };
  }

  function createEntityFromContextMenu(type: EntityCategory) {
    const spawnX = Math.round(contextMenu.flowX - 100);
    const spawnY = Math.round(contextMenu.flowY - 30);
    addQuickEntity(type, { x: spawnX, y: spawnY });
    contextMenu.show = false;
  }

  // 3. Typed Connection Lifecycle Handler
  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;

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

    campaignStore.addEdge(newEdge);
  }

  // 3.5. Native Svelte Flow Elements Deletion Callback
  function handleDeleteElements(params: { nodes?: any[]; edges?: any[] }) {
    const { nodes: deletedNodes, edges: deletedEdges } = params || {};
    let changed = false;

    if (deletedEdges && deletedEdges.length > 0) {
      campaignStore.recordSnapshot();
      const edgeIds = new Set(deletedEdges.map((e) => e.id));
      edgesStore.update((list) => list.filter((item) => !edgeIds.has(item.id)));
      campaignStore.campaign.edges = (campaignStore.campaign.edges || []).filter((e) => !edgeIds.has(e.id));
      changed = true;
    }

    if (deletedNodes && deletedNodes.length > 0) {
      if (!changed) campaignStore.recordSnapshot();
      const nodeSet = new Set(deletedNodes.map((n) => n.id));
      nodesStore.update((list) => list.filter((n) => !nodeSet.has(n.id)));
      edgesStore.update((list) => list.filter((e) => !nodeSet.has(e.source) && !nodeSet.has(e.target)));
      campaignStore.campaign.nodes = (campaignStore.campaign.nodes || []).filter((n) => !nodeSet.has(n.id));
      campaignStore.campaign.edges = (campaignStore.campaign.edges || []).filter(
        (e) => !nodeSet.has(e.source) && !nodeSet.has(e.target)
      );
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
      nodeWidth: 280,
      nodeHeight: 300,
      spacingX: 100,
      spacingY: 130,
      iterations: 120,
    });

    campaignStore.recordSnapshot();
    nodesStore.set(result.nodes);
    edgesStore.set(result.edges);
    campaignStore.campaign.nodes = result.nodes;
    campaignStore.campaign.edges = result.edges;
    campaignStore.markDirty();

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
        campaignStore.campaign.nodes = (campaignStore.campaign.nodes || []).filter((n) => !nodeSet.has(n.id));
        campaignStore.campaign.edges = (campaignStore.campaign.edges || []).filter(
          (e) => !nodeSet.has(e.source) && !nodeSet.has(e.target)
        );
      }

      // 3. Delete individually selected edges
      if (selectedEdgeIds.length > 0) {
        const edgeSet = new Set(selectedEdgeIds);
        edgesStore.update((list) => list.filter((e) => !edgeSet.has(e.id)));
        campaignStore.campaign.edges = (campaignStore.campaign.edges || []).filter((e) => !edgeSet.has(e.id));
      }

      campaignStore.markDirty();
    }
  }

  // 7. Keyboard Shortcuts (Delete / Backspace, Undo / Redo, Copy / Paste Edges)
  function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (isInput) return;

    if (event.key === 'Escape') {
      if (contextMenu.show) {
        contextMenu.show = false;
        event.preventDefault();
        return;
      }
      showAddMenu = false;
      showLayoutDropdown = false;
      showEdgeFilterDropdown = false;
      showUiScaleMenu = false;
    }

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
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      const currentEdges = get(edgesStore);
      const selectedEdges = currentEdges.filter((e) => e.selected);
      if (selectedEdges.length > 0) {
        event.preventDefault();
        campaignStore.copyEdges(selectedEdges);
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
      if (campaignStore.hasCopiedEdges()) {
        event.preventDefault();
        campaignStore.pasteEdges();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="w-full h-full bg-[#0b0d11] relative overflow-hidden select-none"
  oncontextmenu={handleCanvasContextMenu}
  ondragover={handleCanvasDragOver}
  ondrop={handleCanvasDrop}
>
  <!-- Top Floating Master Toolbar -->
  <div
    class="canvas-toolbar absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 max-w-[calc(100%-24px)]"
    style="zoom: var(--ui-scale, 1); transform-origin: top left;"
  >
    <!-- Group 1: Add Entity Dropdown Menu -->
    <div class="relative">
      <div class="flex items-center rounded-xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-xl p-1">
        <button
          type="button"
          onclick={() => (showAddMenu = !showAddMenu)}
          class="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          title="Adicionar Nova Entidade ao Quadro"
        >
          <Plus class="w-3.5 h-3.5 text-amber-400" />
          <span>Adicionar</span>
          <ChevronDown class="w-3 h-3 text-amber-400/80 transition-transform duration-150 {showAddMenu ? 'rotate-180' : ''}" />
        </button>
      </div>

      <!-- Add Menu Dropdown -->
      {#if showAddMenu}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onclick={() => (showAddMenu = false)}
          class="fixed inset-0 z-20 cursor-default"
        ></div>
        <div class="absolute left-0 top-full mt-1.5 w-48 rounded-xl bg-zinc-900 border border-zinc-700/90 shadow-2xl p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-100">
          <div class="text-[10px] font-bold text-zinc-400 uppercase px-2 py-1">Adicionar ao Mural</div>

          <button
            type="button"
            onclick={() => { addQuickEntity('npc'); showAddMenu = false; }}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-amber-300 hover:bg-amber-500/15 group"
          >
            <div class="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <User class="w-3 h-3 text-amber-400" />
            </div>
            <div class="font-medium">+ NPC</div>
          </button>

          <button
            type="button"
            onclick={() => { addQuickEntity('faction'); showAddMenu = false; }}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-purple-300 hover:bg-purple-500/15 group"
          >
            <div class="w-5 h-5 rounded-md bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Shield class="w-3 h-3 text-purple-400" />
            </div>
            <div class="font-medium">+ Facção</div>
          </button>

          <button
            type="button"
            onclick={() => { addQuickEntity('location'); showAddMenu = false; }}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-sky-300 hover:bg-sky-500/15 group"
          >
            <div class="w-5 h-5 rounded-md bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0">
              <MapPin class="w-3 h-3 text-sky-400" />
            </div>
            <div class="font-medium">+ Local</div>
          </button>

          <button
            type="button"
            onclick={() => { addQuickEntity('secret'); showAddMenu = false; }}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-rose-300 hover:bg-rose-500/15 group"
          >
            <div class="w-5 h-5 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
              <Skull class="w-3 h-3 text-rose-400" />
            </div>
            <div class="font-medium">+ Segredo</div>
          </button>

          <button
            type="button"
            onclick={() => { addQuickEntity('note'); showAddMenu = false; }}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-zinc-300 hover:bg-zinc-800 group"
          >
            <div class="w-5 h-5 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
              <FileText class="w-3 h-3 text-zinc-400" />
            </div>
            <div class="font-medium">+ Nota</div>
          </button>

          <button
            type="button"
            onclick={() => { addQuickEntity('table'); showAddMenu = false; }}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-amber-300 hover:bg-amber-500/15 group"
          >
            <div class="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Dices class="w-3 h-3 text-amber-400" />
            </div>
            <div class="font-medium">+ Tabela</div>
          </button>
        </div>
      {/if}
    </div>

    <!-- Group 1.5: Canvas Scope Selector (Global vs Mission Folder) -->
    <div class="flex items-center rounded-xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-xl px-2 py-1 gap-1.5">
      <Folder class="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <select
        value={campaignStore.activeScopeFolderId}
        onchange={(e) => handleScopeChange((e.target as HTMLSelectElement).value)}
        class="bg-transparent text-xs font-medium text-zinc-200 pr-1 py-0.5 focus:outline-none cursor-pointer max-w-[140px] truncate"
        title="Filtrar Mural por Pasta ou Missão"
      >
        <option value="all" class="bg-zinc-900 text-zinc-100">Mural: Geral (Tudo)</option>
        {#each availableFolders as folder}
          <option value={folder.id} class="bg-zinc-900 text-zinc-100">Mural: {folder.name}</option>
        {/each}
      </select>
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

          <button
            type="button"
            onclick={() => applyLayout('cluster')}
            class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer {activeLayoutAlgo === 'cluster' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
          >
            <Boxes class="w-3.5 h-3.5 text-amber-400" />
            <div>
              <div>Núcleos de Investigação</div>
              <div class="text-[10px] text-zinc-500">Agrupa por facções, suspeitos e locais temáticos</div>
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

          <div class="h-px bg-zinc-800 my-1"></div>

          <button
            type="button"
            onclick={() => { showEdgeFilterDropdown = false; handleScanWikilinks(); }}
            class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-amber-300 hover:bg-amber-500/15 group"
            title="Procura sintaxe [[nome_nota]] no texto e cria ligações automáticas"
          >
            <Sparkles class="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div class="flex-1">
              <div class="font-medium">Escanear [[Wikilinks]]</div>
              <div class="text-[9px] text-zinc-500">Conectar notas do Obsidian</div>
            </div>
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
  <div
    class="canvas-toolbar absolute top-3 right-3 z-10 flex items-center gap-1 p-1 rounded-xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-xl"
    style="zoom: var(--ui-scale, 1); transform-origin: top right;"
  >
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

    <!-- Divider -->
    <div class="w-px h-4 bg-zinc-800 mx-0.5"></div>

    <!-- UI Scale Subsystem Quick Selector (Requirement R1) -->
    <div class="relative">
      <button
        type="button"
        onclick={() => (showUiScaleMenu = !showUiScaleMenu)}
        class="px-2 py-1 rounded-lg text-[11px] font-mono text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer flex items-center gap-1.5"
        title="Ajustar Escala Global da Interface (UI Scale)"
      >
        <Sliders class="w-3 h-3 text-amber-400" />
        <span>{Math.round(appState.uiScale * 100)}%</span>
      </button>

      {#if showUiScaleMenu}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onclick={() => (showUiScaleMenu = false)}
          class="fixed inset-0 z-30 cursor-default"
        ></div>
        <div class="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-zinc-900 border border-zinc-700/90 shadow-2xl p-3 z-40 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
          <div class="flex items-center justify-between text-xs font-semibold text-zinc-300">
            <span class="flex items-center gap-1 text-[11px] uppercase tracking-wider font-bold text-zinc-400">
              <Sliders class="w-3 h-3 text-amber-400" />
              Escala da UI
            </span>
            <span class="font-mono text-xs font-bold text-amber-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
              {Math.round(appState.uiScale * 100)}%
            </span>
          </div>

          <input
            type="range"
            min="0.75"
            max="1.50"
            step="0.05"
            value={appState.uiScale}
            oninput={(e) => appState.setUiScale(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />

          <!-- Preset Buttons: 75%, 90%, 100%, 110%, 125%, 150% -->
          <div class="grid grid-cols-3 gap-1 pt-1">
            {#each [0.75, 0.90, 1.00, 1.10, 1.25, 1.50] as preset}
              <button
                type="button"
                onclick={() => { appState.setUiScale(preset); showUiScaleMenu = false; }}
                class="py-1 text-[10px] font-mono rounded-md border transition cursor-pointer text-center {Math.abs(appState.uiScale - preset) < 0.01
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}"
              >
                {Math.round(preset * 100)}%
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
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
    connectionMode={ConnectionMode.Loose}
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
    onlyRenderVisibleElements={true}
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

  <!-- Canvas Context Menu (Right Click) -->
  {#if contextMenu.show}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      onclick={() => (contextMenu.show = false)}
      oncontextmenu={(e) => {
        e.preventDefault();
        handleCanvasContextMenu(e);
      }}
      class="fixed inset-0 z-40 cursor-default"
    ></div>

    <div
      class="fixed z-50 w-52 rounded-xl bg-zinc-900/98 border border-zinc-700/90 shadow-2xl p-1.5 space-y-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
      style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
    >
      {#if targetContextMenuNode}
        <!-- Node specific context actions -->
        <div class="text-[10px] font-bold text-zinc-400 uppercase px-2 py-0.5 truncate">
          {targetContextMenuNode.data?.title || 'Quadrado'}
        </div>

        <button
          type="button"
          onclick={() => {
            if (targetContextMenuNode?.data) {
              campaignStore.openNodeEditor(targetContextMenuNode.data);
            }
            contextMenu.show = false;
          }}
          class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-zinc-200 hover:bg-zinc-800"
        >
          <Pencil class="w-3.5 h-3.5 text-amber-400" />
          <span>Editar Quadrado</span>
        </button>

        <button
          type="button"
          onclick={() => {
            if (contextMenu.nodeId) {
              campaignStore.duplicateNode(contextMenu.nodeId);
            }
            contextMenu.show = false;
          }}
          class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-zinc-200 hover:bg-zinc-800"
        >
          <Copy class="w-3.5 h-3.5 text-zinc-400" />
          <span>Duplicar</span>
        </button>

        <button
          type="button"
          onclick={() => {
            if (contextMenu.nodeId) {
              campaignStore.deleteNode(contextMenu.nodeId);
            }
            contextMenu.show = false;
          }}
          class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-rose-400 hover:bg-rose-950/40"
        >
          <Trash2 class="w-3.5 h-3.5 text-rose-400" />
          <span>Eliminar</span>
        </button>

        <div class="h-px bg-zinc-800 my-1"></div>
      {/if}

      <!-- Main Creation Action: Novo Quadrado -->
      <div class="text-[10px] font-bold text-zinc-400 uppercase px-2 py-0.5">
        {targetContextMenuNode ? 'Criar Perto' : 'Novo no Mural'}
      </div>

      <button
        type="button"
        onclick={() => createEntityFromContextMenu('note')}
        class="w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold flex items-center gap-2 transition cursor-pointer text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 group"
      >
        <div class="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
          <Plus class="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div class="flex-1">
          <div class="leading-tight">Novo Quadrado</div>
          <div class="text-[10px] font-normal text-amber-400/80">Criar nota / quadrado</div>
        </div>
      </button>

      <div class="h-px bg-zinc-800 my-1"></div>

      <!-- Other entity categories -->
      <button
        type="button"
        onclick={() => createEntityFromContextMenu('npc')}
        class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-amber-300 hover:bg-amber-500/15 group"
      >
        <div class="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
          <User class="w-3 h-3 text-amber-400" />
        </div>
        <span class="font-medium">+ NPC</span>
      </button>

      <button
        type="button"
        onclick={() => createEntityFromContextMenu('faction')}
        class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-purple-300 hover:bg-purple-500/15 group"
      >
        <div class="w-5 h-5 rounded-md bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
          <Shield class="w-3 h-3 text-purple-400" />
        </div>
        <span class="font-medium">+ Facção</span>
      </button>

      <button
        type="button"
        onclick={() => createEntityFromContextMenu('location')}
        class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-sky-300 hover:bg-sky-500/15 group"
      >
        <div class="w-5 h-5 rounded-md bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0">
          <MapPin class="w-3 h-3 text-sky-400" />
        </div>
        <span class="font-medium">+ Local</span>
      </button>

      <button
        type="button"
        onclick={() => createEntityFromContextMenu('secret')}
        class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-rose-300 hover:bg-rose-500/15 group"
      >
        <div class="w-5 h-5 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
          <Skull class="w-3 h-3 text-rose-400" />
        </div>
        <span class="font-medium">+ Segredo</span>
      </button>

      <button
        type="button"
        onclick={() => createEntityFromContextMenu('table')}
        class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-amber-300 hover:bg-amber-500/15 group"
      >
        <div class="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
          <Dices class="w-3 h-3 text-amber-400" />
        </div>
        <span class="font-medium">+ Tabela</span>
      </button>

      <div class="h-px bg-zinc-800 my-1"></div>

      <button
        type="button"
        onclick={() => { contextMenu.show = false; handleScanWikilinks(); }}
        class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer text-amber-300 hover:bg-amber-500/15 group"
        title="Procura sintaxe [[nome_nota]] no texto e cria ligações automáticas"
      >
        <div class="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
          <Sparkles class="w-3 h-3 text-amber-400" />
        </div>
        <div class="flex-1">
          <div class="font-medium text-amber-200">Escanear [[Wikilinks]]</div>
          <div class="text-[9px] text-zinc-500">Conectar referências de notas</div>
        </div>
      </button>
    </div>
  {/if}

  <!-- Scan Wikilinks Toast Alert -->
  {#if scanToast}
    <div
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-zinc-900/95 border border-amber-500/50 shadow-2xl backdrop-blur-md text-xs font-medium text-amber-200 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <span>{scanToast}</span>
      <button
        type="button"
        onclick={() => (scanToast = null)}
        class="ml-2 text-zinc-400 hover:text-white text-xs font-bold px-1"
      >
        ✕
      </button>
    </div>
  {/if}
</div>
