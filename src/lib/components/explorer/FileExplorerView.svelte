<!-- File: src/lib/components/explorer/FileExplorerView.svelte -->
<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { appState } from '../../stores/appState.svelte';
  import type { CampaignFileNode, EntityCategory, EntityNodeData, CombatStats } from '../../types';
  import FileTreeItem from './FileTreeItem.svelte';
  import CombatStatblockCard from './CombatStatblockCard.svelte';
  import { renderMarkdown } from '../../utils/markdown';
  import { createZipArchive } from '../../utils/obsidianZip';
  import {
    FolderPlus,
    FilePlus,
    Download,
    Search,
    Compass,
    Eye,
    Code,
    Columns2,
    Lock,
    Unlock,
    Tag,
    User,
    Shield,
    MapPin,
    Skull,
    FileText,
    Dices,
    Folder,
    ExternalLink,
    Layers,
    X,
    Plus,
    ArrowRight,
    Sparkles,
    CheckCircle2,
  } from 'lucide-svelte';

  // Search & Filter
  let searchQuery = $state('');
  let viewMode = $state<'split' | 'edit' | 'preview'>('split');
  let exportSuccessMsg = $state('');

  // Wikilink Autocomplete State
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let showWikilinkMenu = $state(false);
  let wikilinkQuery = $state('');
  let wikilinkInsertIndex = $state(-1);
  let selectedWikilinkIndex = $state(0);

  // New Tag input
  let newTagInput = $state('');

  // ---------------------------------------------------------------------------
  // Reactive Derivations
  // ---------------------------------------------------------------------------

  // Active Selected File Node
  const selectedItem = $derived(
    campaignStore.selectedFileId
      ? (campaignStore.fileSystem || []).find((f) => f.id === campaignStore.selectedFileId)
      : null
  );

  // Active Entity Node on the Graph
  const activeNode = $derived(
    selectedItem && selectedItem.nodeId
      ? (campaignStore.campaign.nodes || []).find((n) => n.id === selectedItem.nodeId)
      : null
  );

  const activeNodeData = $derived<EntityNodeData | null>(
    activeNode ? activeNode.data : null
  );

  // Root file system items
  const rootItems = $derived(
    (campaignStore.fileSystem || []).filter((item) => !item.parentId)
  );

  // Filtered items when searching
  const isSearching = $derived(searchQuery.trim().length > 0);
  const searchResults = $derived.by(() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase().trim();
    return (campaignStore.fileSystem || []).filter((item) => {
      const matchName = item.name.toLowerCase().includes(q);
      const node = item.nodeId ? (campaignStore.campaign.nodes || []).find((n) => n.id === item.nodeId) : null;
      const matchTags = (node?.data?.tags || []).some((t) => t.toLowerCase().includes(q));
      const matchContent = (node?.data?.content || '').toLowerCase().includes(q);
      return matchName || matchTags || matchContent;
    });
  });

  // All available folders for moving documents
  const allFolders = $derived(
    (campaignStore.fileSystem || []).filter((item) => item.type === 'folder')
  );

  // All other entities for [[wikilink]] suggestions
  const wikilinkSuggestions = $derived.by(() => {
    if (!showWikilinkMenu) return [];
    const q = wikilinkQuery.toLowerCase().trim();
    const allFiles = (campaignStore.fileSystem || []).filter((f) => f.type === 'file');
    return allFiles
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .slice(0, 8);
  });

  // Backlinks: other nodes that reference this node
  const backlinks = $derived.by(() => {
    if (!activeNode) return [];
    const currentTitle = (activeNodeData?.title || selectedItem?.name || '').toLowerCase();
    const currentId = activeNode.id;

    const results: Array<{ id: string; name: string; type: EntityCategory; reason: string }> = [];

    // 1. Check wikilinks in content of other nodes
    (campaignStore.campaign.nodes || []).forEach((n) => {
      if (n.id === currentId) return;
      const content = (n.data?.content || '').toLowerCase();
      const wikilinks = (n.data?.wikilinks || []).map((w) => w.toLowerCase());

      if (wikilinks.includes(currentTitle) || content.includes(`[[${currentTitle}]]`)) {
        results.push({
          id: n.id,
          name: n.data.title || 'Sem título',
          type: (n.data.type || n.data.category || 'note') as EntityCategory,
          reason: 'Menciona no texto',
        });
      }
    });

    // 2. Check edges
    (campaignStore.campaign.edges || []).forEach((edge) => {
      if (edge.target === currentId) {
        const sourceNode = (campaignStore.campaign.nodes || []).find((n) => n.id === edge.source);
        if (sourceNode && !results.some((r) => r.id === sourceNode.id)) {
          results.push({
            id: sourceNode.id,
            name: sourceNode.data.title || 'Sem título',
            type: (sourceNode.data.type || sourceNode.data.category || 'note') as EntityCategory,
            reason: String(edge.data?.label || 'Conectado no Mural'),
          });
        }
      }
    });

    return results;
  });

  // ---------------------------------------------------------------------------
  // Document Operations
  // ---------------------------------------------------------------------------

  function handleCreateRootFolder() {
    const name = prompt('Nome da nova pasta:', 'Nova Pasta');
    if (name && name.trim()) {
      campaignStore.createFolder(name.trim());
    }
  }

  function handleCreateNewFile(category: EntityCategory = 'note') {
    const defaultTitles: Record<EntityCategory, string> = {
      npc: 'Novo NPC',
      faction: 'Nova Facção',
      location: 'Novo Local',
      secret: 'Novo Segredo',
      clue: 'Nova Pista',
      note: 'Nova Nota',
      table: 'Nova Tabela',
    };

    const targetFolderId = selectedItem?.type === 'folder' ? selectedItem.id : (selectedItem?.parentId || null);
    const newFileId = campaignStore.createFile(defaultTitles[category], targetFolderId, category);
    campaignStore.openFile(newFileId);
  }

  function handleTitleChange(newTitle: string) {
    if (!selectedItem) return;
    campaignStore.renameFileOrFolder(selectedItem.id, newTitle);
  }

  function handleCategoryChange(newCategory: EntityCategory) {
    if (!activeNode) return;
    const colors: Record<EntityCategory, string> = {
      npc: '#d4a359',
      faction: '#a855f7',
      location: '#38bdf8',
      secret: '#f87171',
      clue: '#10b981',
      note: '#71717a',
      table: '#d4a359',
    };
    campaignStore.updateNodeData(activeNode.id, {
      category: newCategory,
      type: newCategory,
      color: colors[newCategory],
    });
  }

  function handleFolderMove(newFolderIdStr: string) {
    if (!selectedItem) return;
    const targetFolderId = newFolderIdStr === 'root' ? null : newFolderIdStr;
    campaignStore.moveFileOrFolder(selectedItem.id, targetFolderId);
  }

  function handleContentInput(e: Event) {
    if (!activeNode) return;
    const target = e.target as HTMLTextAreaElement;
    const content = target.value;

    checkWikilinkTrigger(target);
    campaignStore.syncWikilinksForNode(activeNode.id, content, activeNode.data.combatStats);
  }

  function handleCombatStatsChange(updatedStats: CombatStats) {
    if (!activeNode) return;
    campaignStore.updateNodeData(activeNode.id, { combatStats: updatedStats });
    campaignStore.syncWikilinksForNode(activeNode.id, activeNode.data.content || '', updatedStats);
  }

  function handleToggleSecret() {
    if (!activeNode) return;
    campaignStore.updateNodeData(activeNode.id, { isSecret: !activeNode.data.isSecret });
  }

  function handleAddTag() {
    if (!activeNode || !newTagInput.trim()) return;
    const clean = newTagInput.trim().replace(/^#/, '');
    const currentTags = activeNode.data.tags || [];
    if (!currentTags.includes(clean)) {
      campaignStore.updateNodeData(activeNode.id, { tags: [...currentTags, clean] });
    }
    newTagInput = '';
  }

  function handleRemoveTag(tagToRemove: string) {
    if (!activeNode) return;
    const currentTags = activeNode.data.tags || [];
    campaignStore.updateNodeData(activeNode.id, {
      tags: currentTags.filter((t) => t !== tagToRemove),
    });
  }

  // Jump to Canvas and focus node
  function handleJumpToCanvas() {
    if (!activeNode) return;
    campaignStore.selectedEntity = activeNode.data;
    campaignStore.nodes.update((list) =>
      list.map((n) => ({
        ...n,
        selected: n.id === activeNode.id,
      }))
    );
    appState.activeTab = 'board';
  }

  // ---------------------------------------------------------------------------
  // [[Wikilink]] Autocomplete Logic
  // ---------------------------------------------------------------------------

  function checkWikilinkTrigger(textarea: HTMLTextAreaElement) {
    const pos = textarea.selectionStart;
    const text = textarea.value.slice(0, pos);
    const lastOpen = text.lastIndexOf('[[');

    if (lastOpen !== -1) {
      const queryPart = text.slice(lastOpen + 2);
      // Check if there is no closing bracket or linebreak
      if (!queryPart.includes(']]') && !queryPart.includes('\n')) {
        showWikilinkMenu = true;
        wikilinkQuery = queryPart;
        wikilinkInsertIndex = lastOpen;
        selectedWikilinkIndex = 0;
        return;
      }
    }

    showWikilinkMenu = false;
  }

  function insertWikilink(targetFileName: string) {
    if (!textareaEl || !activeNode || wikilinkInsertIndex === -1) return;

    const currentText = textareaEl.value;
    const cursor = textareaEl.selectionStart;
    const before = currentText.slice(0, wikilinkInsertIndex);
    const after = currentText.slice(cursor);

    const replacement = `[[${targetFileName}]]`;
    const newContent = before + replacement + after;

    textareaEl.value = newContent;
    const newPos = before.length + replacement.length;
    textareaEl.setSelectionRange(newPos, newPos);
    textareaEl.focus();

    showWikilinkMenu = false;
    campaignStore.syncWikilinksForNode(activeNode.id, newContent, activeNode.data.combatStats);
  }

  function handleTextareaKeydown(e: KeyboardEvent) {
    if (!showWikilinkMenu || wikilinkSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedWikilinkIndex = (selectedWikilinkIndex + 1) % wikilinkSuggestions.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedWikilinkIndex = (selectedWikilinkIndex - 1 + wikilinkSuggestions.length) % wikilinkSuggestions.length;
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const choice = wikilinkSuggestions[selectedWikilinkIndex];
      if (choice) {
        insertWikilink(choice.name);
      }
    } else if (e.key === 'Escape') {
      showWikilinkMenu = false;
    }
  }

  // Handle clicking wikilinks in Preview mode
  function handlePreviewClick(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest('.wikilink-pill') as HTMLElement | null;
    if (target) {
      const linkTargetName = target.dataset.target;
      if (linkTargetName) {
        const found = (campaignStore.fileSystem || []).find(
          (f) => f.name.toLowerCase() === linkTargetName.toLowerCase()
        );
        if (found) {
          campaignStore.openFile(found.id);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Obsidian Vault Export
  // ---------------------------------------------------------------------------

  async function handleExportObsidian() {
    const vaultFiles = campaignStore.exportToObsidianVault();
    const zipBlob = createZipArchive(vaultFiles);

    // Trigger browser download of .zip archive
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    const cleanCampaignName = (campaignStore.campaign.name || 'Campanha_Mural').replace(/[\\/:*?"<>|]/g, '_');
    a.download = `${cleanCampaignName}_Obsidian_Vault.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    exportSuccessMsg = `Vault gerado com sucesso! (${vaultFiles.length} documentos exportados)`;
    setTimeout(() => {
      exportSuccessMsg = '';
    }, 4000);
  }

  const categoryIcons: Record<EntityCategory, any> = {
    npc: User,
    faction: Shield,
    location: MapPin,
    secret: Skull,
    clue: Tag,
    note: FileText,
    table: Dices,
  };
</script>

<div class="h-full w-full flex bg-[#090b0e] text-zinc-100 overflow-hidden font-sans">
  <!-- ========================================================================= -->
  <!-- LEFT COLUMN: Explorer Tree Sidebar                                        -->
  <!-- ========================================================================= -->
  <aside class="w-72 border-r border-zinc-800/80 bg-zinc-950 flex flex-col justify-between shrink-0 select-none">
    <!-- Explorer Header & Action Bar -->
    <div class="p-3 border-b border-zinc-800/80 space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Layers class="w-4 h-4 text-amber-400" />
          <h2 class="text-xs font-bold text-zinc-100 tracking-wider uppercase">Dossiê & Notas</h2>
        </div>
        <span class="text-[10px] text-zinc-500 font-mono">
          {(campaignStore.fileSystem || []).length} itens
        </span>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center gap-1">
        <button
          type="button"
          onclick={handleCreateRootFolder}
          class="flex-1 px-2 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
          title="Criar nova pasta raiz"
        >
          <FolderPlus class="w-3.5 h-3.5 text-amber-400" />
          <span>+ Pasta</span>
        </button>

        <button
          type="button"
          onclick={() => handleCreateNewFile('note')}
          class="flex-1 px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
          title="Criar nova nota"
        >
          <FilePlus class="w-3.5 h-3.5" />
          <span>+ Ficheiro</span>
        </button>

        <button
          type="button"
          onclick={handleExportObsidian}
          class="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition cursor-pointer"
          title="Exportar como Obsidian Vault (.zip)"
        >
          <Download class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative">
        <Search class="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Filtrar notas, tags, pistas..."
          class="w-full pl-8 pr-6 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition"
        />
        {#if searchQuery}
          <button
            type="button"
            onclick={() => (searchQuery = '')}
            class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
          >
            <X class="w-3 h-3" />
          </button>
        {/if}
      </div>

      <!-- Scoped Canvas Notification if Scoped -->
      {#if campaignStore.activeScopeFolderId !== 'all'}
        {@const activeScopeFolder = (campaignStore.fileSystem || []).find(
          (f) => f.id === campaignStore.activeScopeFolderId
        )}
        <div class="px-2 py-1 rounded-lg bg-indigo-950/50 border border-indigo-800/60 flex items-center justify-between text-[11px] text-indigo-300">
          <div class="flex items-center gap-1.5 truncate">
            <Compass class="w-3 h-3 text-indigo-400 shrink-0" />
            <span class="truncate">Mural: {activeScopeFolder?.name || 'Missão'}</span>
          </div>
          <button
            type="button"
            onclick={() => campaignStore.setCanvasScope('all')}
            class="text-[10px] text-indigo-400 hover:text-indigo-200 underline cursor-pointer shrink-0"
          >
            Reset
          </button>
        </div>
      {/if}
    </div>

    <!-- Tree View Body -->
    <div class="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800">
      {#if isSearching}
        <!-- Search Results View -->
        <div class="text-[10px] uppercase font-bold text-zinc-500 px-2 py-1">
          Resultados ({searchResults.length})
        </div>
        {#if searchResults.length === 0}
          <div class="text-xs text-zinc-500 text-center py-6">Nenhum ficheiro encontrado.</div>
        {:else}
          {#each searchResults as item (item.id)}
            <FileTreeItem {item} onSelectFile={(id) => campaignStore.openFile(id)} />
          {/each}
        {/if}
      {:else}
        <!-- Hierarchical Tree View -->
        {#if rootItems.length === 0}
          <div class="flex flex-col items-center justify-center text-center p-6 space-y-2 text-zinc-500">
            <Folder class="w-8 h-8 text-zinc-700" />
            <div class="text-xs">Nenhum documento ainda.</div>
            <button
              type="button"
              onclick={() => handleCreateNewFile('note')}
              class="text-xs text-amber-400 hover:underline cursor-pointer"
            >
              Criar primeira nota
            </button>
          </div>
        {:else}
          {#each rootItems as item (item.id)}
            <FileTreeItem {item} onSelectFile={(id) => campaignStore.openFile(id)} />
          {/each}
        {/if}
      {/if}
    </div>

    <!-- Explorer Footer / Vault Status -->
    <div class="p-2.5 border-t border-zinc-800/80 bg-zinc-950 flex flex-col gap-1 text-[11px] text-zinc-400">
      {#if exportSuccessMsg}
        <div class="flex items-center gap-1.5 text-emerald-400 text-xs py-0.5">
          <CheckCircle2 class="w-3.5 h-3.5" />
          <span>{exportSuccessMsg}</span>
        </div>
      {:else}
        <div class="flex items-center justify-between text-zinc-500">
          <span>Obsidian Markdown Vault</span>
          <span class="font-mono text-[10px] text-amber-500/80">[[wikilinks]] ✓</span>
        </div>
      {/if}
    </div>
  </aside>

  <!-- ========================================================================= -->
  <!-- RIGHT MAIN COLUMN: Document Editor & Live Preview                        -->
  <!-- ========================================================================= -->
  <main class="flex-1 flex flex-col overflow-hidden bg-[#0c0e12] relative">
    {#if selectedItem && activeNode && activeNodeData}
      <!-- 1. Document Header & Toolbar -->
      <header class="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-4 py-2.5 space-y-2 z-10">
        <!-- Row 1: Breadcrumbs & Main Actions -->
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2 min-w-0 text-xs text-zinc-400">
            <!-- Folder selector -->
            <Folder class="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={selectedItem.parentId || 'root'}
              onchange={(e) => handleFolderMove((e.target as HTMLSelectElement).value)}
              class="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
            >
              <option value="root">📁 Raiz (Sem Pasta)</option>
              {#each allFolders as folder}
                <option value={folder.id}>📁 {folder.name}</option>
              {/each}
            </select>

            <span class="text-zinc-600">/</span>
            <span class="font-medium text-zinc-200 truncate">{selectedItem.name}</span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <!-- Jump to Canvas Button -->
            <button
              type="button"
              onclick={handleJumpToCanvas}
              class="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Focar esta entidade no Mural"
            >
              <ExternalLink class="w-3 h-3" />
              <span>Ver no Mural</span>
            </button>

            <!-- Mode Switcher -->
            <div class="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-xs">
              <button
                type="button"
                onclick={() => (viewMode = 'edit')}
                class="px-2 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1 {viewMode === 'edit' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}"
                title="Apenas Editor Markdown"
              >
                <Code class="w-3 h-3" />
                <span>Editor</span>
              </button>
              <button
                type="button"
                onclick={() => (viewMode = 'split')}
                class="px-2 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1 {viewMode === 'split' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}"
                title="Dividido: Editor & Pré-visualização"
              >
                <Columns2 class="w-3 h-3" />
                <span>Dividido</span>
              </button>
              <button
                type="button"
                onclick={() => (viewMode = 'preview')}
                class="px-2 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1 {viewMode === 'preview' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}"
                title="Apenas Pré-visualização Formatada"
              >
                <Eye class="w-3 h-3" />
                <span>Leitura</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Row 2: Title, Category, Secret, and Tags -->
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <!-- Category Selector -->
          <select
            value={activeNodeData.type || activeNodeData.category || 'note'}
            onchange={(e) => handleCategoryChange((e.target as HTMLSelectElement).value as EntityCategory)}
            class="bg-zinc-900 border border-zinc-800 text-xs text-amber-300 font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="npc">👤 NPC</option>
            <option value="faction">🛡️ Facção</option>
            <option value="location">📍 Local</option>
            <option value="secret">💀 Segredo</option>
            <option value="clue">🏷️ Pista</option>
            <option value="note">📄 Nota / Dossiê</option>
            <option value="table">🎲 Tabela de Encontros</option>
          </select>

          <!-- Title Input -->
          <input
            type="text"
            value={activeNodeData.title || selectedItem.name}
            oninput={(e) => handleTitleChange((e.target as HTMLInputElement).value)}
            placeholder="Título do Documento..."
            class="flex-1 min-w-[200px] text-base font-bold text-zinc-100 bg-transparent border-b border-transparent hover:border-zinc-800 focus:border-amber-500/80 focus:outline-none px-1 py-0.5 transition"
          />

          <!-- Secret Toggle Button -->
          <button
            type="button"
            onclick={handleToggleSecret}
            class="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer {activeNodeData.isSecret ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}"
            title={activeNodeData.isSecret ? 'Documento Secreto (Apenas Mestre)' : 'Documento Revelado'}
          >
            {#if activeNodeData.isSecret}
              <Lock class="w-3 h-3 text-rose-400" />
              <span>Secreto</span>
            {:else}
              <Unlock class="w-3 h-3 text-zinc-500" />
              <span>Visível</span>
            {/if}
          </button>

          <!-- Tags List -->
          <div class="flex items-center gap-1 flex-wrap">
            {#each activeNodeData.tags || [] as t}
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
                #{t}
                <button
                  type="button"
                  onclick={() => handleRemoveTag(t)}
                  class="text-zinc-500 hover:text-rose-400 cursor-pointer ml-0.5"
                >
                  ×
                </button>
              </span>
            {/each}

            <!-- Add Tag inline -->
            <form onsubmit={(e) => { e.preventDefault(); handleAddTag(); }} class="inline-flex items-center">
              <input
                type="text"
                bind:value={newTagInput}
                placeholder="+tag"
                class="w-16 px-1.5 py-0.5 rounded bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
              />
            </form>
          </div>
        </div>
      </header>

      <!-- 2. Document Content Area (Editor / Preview / Split) -->
      <div class="flex-1 flex overflow-hidden relative">
        <!-- Optional Combat Statblock Accordion at top for NPCs / Bosses -->
        <div class="flex-1 flex flex-col overflow-y-auto">
          {#if activeNodeData.category === 'npc' || activeNodeData.combatStats}
            <div class="p-4 border-b border-zinc-800/60 bg-zinc-950/40">
              <CombatStatblockCard
                stats={activeNodeData.combatStats}
                onchange={handleCombatStatsChange}
              />
            </div>
          {/if}

          <!-- Editor Body Grid -->
          <div class="flex-1 flex overflow-hidden min-h-[350px]">
            <!-- Editor Textarea Panel -->
            {#if viewMode === 'edit' || viewMode === 'split'}
              <div class="flex-1 flex flex-col border-r border-zinc-800/80 bg-[#090b0e] relative">
                <div class="px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-950/60 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Markdown & Wikilinks (digite <kbd class="px-1 py-0.5 bg-zinc-800 rounded font-mono text-amber-300">[[</kbd> para ligar)</span>
                  <span>{(activeNodeData.content || '').length} caracteres</span>
                </div>

                <div class="flex-1 relative p-3">
                  <textarea
                    bind:this={textareaEl}
                    value={activeNodeData.content || ''}
                    oninput={handleContentInput}
                    onkeydown={handleTextareaKeydown}
                    placeholder="Escreva o dossiê, pistas, descrição ou segredos aqui... Use [[Nome do Ficheiro]] para criar ligações automáticas no Mural!"
                    class="w-full h-full bg-transparent text-zinc-200 text-sm font-mono leading-relaxed resize-none focus:outline-none scrollbar-thin scrollbar-thumb-zinc-800"
                  ></textarea>

                  <!-- [[Wikilink]] Autocomplete Popup -->
                  {#if showWikilinkMenu && wikilinkSuggestions.length > 0}
                    <div class="absolute left-8 bottom-12 w-64 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      <div class="text-[10px] font-bold text-zinc-400 uppercase px-2 py-0.5">
                        Ligar a documento existente:
                      </div>
                      {#each wikilinkSuggestions as suggestion, idx}
                        <button
                          type="button"
                          onclick={() => insertWikilink(suggestion.name)}
                          class="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 transition cursor-pointer {idx === selectedWikilinkIndex ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}"
                        >
                          <FileText class="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span class="truncate">{suggestion.name}</span>
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Live Preview Panel -->
            {#if viewMode === 'preview' || viewMode === 'split'}
              <div class="flex-1 flex flex-col bg-[#0b0d11] overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-zinc-800 select-text">
                <div class="max-w-3xl w-full mx-auto space-y-4">
                  <!-- Description Quote if present -->
                  {#if activeNodeData.description}
                    <blockquote class="p-3 rounded-xl bg-zinc-950/80 border-l-4 border-amber-500/70 text-xs text-zinc-300 italic">
                      {activeNodeData.description}
                    </blockquote>
                  {/if}

                  <!-- Formatted HTML Preview -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="prose prose-invert prose-amber max-w-none text-sm text-zinc-200 leading-relaxed font-sans"
                    onclick={handlePreviewClick}
                  >
                    {@html renderMarkdown(activeNodeData.content || '')}
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <!-- 3. Obsidian-style Backlinks / Mentioned In Footer -->
          <footer class="border-t border-zinc-800/80 bg-zinc-950/90 p-4 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                <Compass class="w-3.5 h-3.5 text-amber-400" />
                <span>Mencionam este documento ({backlinks.length})</span>
              </div>
              <span class="text-[10px] text-zinc-500">Conexões no Mural & [[wikilinks]]</span>
            </div>

            {#if backlinks.length === 0}
              <div class="text-xs text-zinc-500 italic">
                Nenhum outro documento menciona ou conecta a este ainda.
              </div>
            {:else}
              <div class="flex flex-wrap gap-2 pt-1">
                {#each backlinks as bl}
                  {@const Icon = categoryIcons[bl.type] || FileText}
                  <button
                    type="button"
                    onclick={() => {
                      const file = (campaignStore.fileSystem || []).find((f) => f.nodeId === bl.id);
                      if (file) campaignStore.openFile(file.id);
                    }}
                    class="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs flex items-center gap-2 transition cursor-pointer group"
                    title="{bl.reason} • Clique para abrir"
                  >
                    <Icon class="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span class="font-medium">{bl.name}</span>
                    <span class="text-[10px] text-zinc-500 group-hover:text-amber-400/80">({bl.reason})</span>
                  </button>
                {/each}
              </div>
            {/if}
          </footer>
        </div>
      </div>
    {:else}
      <!-- Empty Dashboard / Welcome State -->
      <div class="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
        <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl">
          <Layers class="w-8 h-8" />
        </div>

        <div class="space-y-2 max-w-md">
          <h2 class="text-xl font-bold text-zinc-100">Dossiê da Campanha & Documentos</h2>
          <p class="text-xs text-zinc-400 leading-relaxed">
            Selecione uma nota no explorador à esquerda ou crie um novo registo para escrever descrições ricas, fichas de combate e criar ligações com <span class="text-amber-300 font-mono">[[wikilinks]]</span>.
          </p>
        </div>

        <!-- Quick Creation Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-lg w-full">
          <button
            type="button"
            onclick={() => handleCreateNewFile('npc')}
            class="p-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-left space-y-1 transition hover:border-amber-500/40 cursor-pointer group"
          >
            <User class="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <div class="text-xs font-bold text-zinc-200">+ Novo NPC</div>
            <div class="text-[10px] text-zinc-500">Personagens e aliados</div>
          </button>

          <button
            type="button"
            onclick={() => handleCreateNewFile('location')}
            class="p-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-left space-y-1 transition hover:border-sky-500/40 cursor-pointer group"
          >
            <MapPin class="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
            <div class="text-xs font-bold text-zinc-200">+ Novo Local</div>
            <div class="text-[10px] text-zinc-500">Cenários e distritos</div>
          </button>

          <button
            type="button"
            onclick={() => handleCreateNewFile('clue')}
            class="p-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-left space-y-1 transition hover:border-emerald-500/40 cursor-pointer group"
          >
            <Tag class="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <div class="text-xs font-bold text-zinc-200">+ Nova Pista</div>
            <div class="text-[10px] text-zinc-500">Evidências e cartas</div>
          </button>

          <button
            type="button"
            onclick={() => handleCreateNewFile('secret')}
            class="p-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-left space-y-1 transition hover:border-rose-500/40 cursor-pointer group"
          >
            <Skull class="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
            <div class="text-xs font-bold text-zinc-200">+ Novo Segredo</div>
            <div class="text-[10px] text-zinc-500">Mistérios do mestre</div>
          </button>

          <button
            type="button"
            onclick={() => handleCreateNewFile('faction')}
            class="p-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-left space-y-1 transition hover:border-purple-500/40 cursor-pointer group"
          >
            <Shield class="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            <div class="text-xs font-bold text-zinc-200">+ Nova Facção</div>
            <div class="text-[10px] text-zinc-500">Cultos e organizações</div>
          </button>

          <button
            type="button"
            onclick={() => handleCreateNewFile('note')}
            class="p-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-left space-y-1 transition hover:border-zinc-500/40 cursor-pointer group"
          >
            <FileText class="w-4 h-4 text-zinc-400 group-hover:scale-110 transition-transform" />
            <div class="text-xs font-bold text-zinc-200">+ Nova Nota</div>
            <div class="text-[10px] text-zinc-500">Dossiê genérico</div>
          </button>
        </div>
      </div>
    {/if}
  </main>
</div>
