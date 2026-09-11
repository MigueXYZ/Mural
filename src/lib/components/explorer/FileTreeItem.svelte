<!-- File: src/lib/components/explorer/FileTreeItem.svelte -->
<script lang="ts">
  import type { CampaignFileNode, EntityCategory } from '../../types';
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { appState } from '../../stores/appState.svelte';
  import {
    Folder,
    FolderOpen,
    FileText,
    User,
    Shield,
    MapPin,
    Skull,
    Tag,
    Dices,
    ChevronRight,
    ChevronDown,
    Plus,
    Pencil,
    Trash2,
    LayoutGrid,
    MoreVertical,
  } from 'lucide-svelte';
  import FileTreeItem from './FileTreeItem.svelte';

  let {
    item,
    level = 0,
    onSelectFile,
  }: {
    item: CampaignFileNode;
    level?: number;
    onSelectFile?: (fileId: string) => void;
  } = $props();

  let isOpen = $state(true);
  let isRenaming = $state(false);
  let renameValue = $state('');
  let showMenu = $state(false);

  // Derive child items for folder
  const children = $derived(
    item.type === 'folder'
      ? (campaignStore.fileSystem || []).filter((f) => f.parentId === item.id)
      : []
  );

  // Associated Node info if linked
  const associatedNode = $derived(
    item.nodeId ? (campaignStore.campaign.nodes || []).find((n) => n.id === item.nodeId) : null
  );

  const nodeCategory = $derived<EntityCategory>(
    (associatedNode?.data?.type || associatedNode?.data?.category || 'note') as EntityCategory
  );

  const isSelected = $derived(campaignStore.selectedFileId === item.id);

  function handleItemClick(e: MouseEvent) {
    e.stopPropagation();
    if (item.type === 'folder') {
      isOpen = !isOpen;
    } else {
      campaignStore.openFile(item.id);
      if (onSelectFile) onSelectFile(item.id);
    }
  }

  function handleStartRename(e: MouseEvent) {
    e.stopPropagation();
    isRenaming = true;
    renameValue = item.name;
    showMenu = false;
  }

  function handleSaveRename() {
    if (renameValue.trim() && renameValue.trim() !== item.name) {
      campaignStore.renameFileOrFolder(item.id, renameValue.trim());
    }
    isRenaming = false;
  }

  function handleRenameKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      isRenaming = false;
      renameValue = item.name;
    }
  }

  function handleCreateFileInFolder(e: MouseEvent) {
    e.stopPropagation();
    showMenu = false;
    isOpen = true;
    campaignStore.createFile('Nova Nota', item.id, 'note');
  }

  function handleCreateSubFolder(e: MouseEvent) {
    e.stopPropagation();
    showMenu = false;
    isOpen = true;
    campaignStore.createFolder('Nova Pasta', item.id);
  }

  function handleScopeCanvasToFolder(e: MouseEvent) {
    e.stopPropagation();
    showMenu = false;
    campaignStore.setCanvasScope(item.id);
    appState.activeTab = 'board';
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    showMenu = false;
    campaignStore.deleteFileOrFolder(item.id, true);
  }

  function getNodeIconComponent(cat: EntityCategory) {
    switch (cat) {
      case 'npc': return User;
      case 'faction': return Shield;
      case 'location': return MapPin;
      case 'secret': return Skull;
      case 'clue': return Tag;
      case 'table': return Dices;
      default: return FileText;
    }
  }

  function getNodeColorClass(cat: EntityCategory) {
    switch (cat) {
      case 'npc': return 'text-amber-400';
      case 'faction': return 'text-purple-400';
      case 'location': return 'text-sky-400';
      case 'secret': return 'text-rose-400';
      case 'clue': return 'text-emerald-400';
      case 'table': return 'text-amber-300';
      default: return 'text-zinc-400';
    }
  }

  // Shared drag-and-drop state across all tree items and explorer
  let isDragOverFolder = $state(false);

  function handleDragStart(e: DragEvent) {
    if (isRenaming) {
      e.preventDefault();
      return;
    }
    campaignStore.setDraggedFileId(item.id);
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/mural-file-id', item.id);
      e.dataTransfer.setData('text/plain', item.id);
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragEnd() {
    campaignStore.setDraggedFileId(null);
    isDragOverFolder = false;
  }

  function handleDragOver(e: DragEvent) {
    if (item.type !== 'folder') return;
    const draggedId = campaignStore.draggedFileId || (e.dataTransfer?.types?.includes('application/mural-file-id') ? 'pending' : null);
    if (!draggedId) return;

    if (campaignStore.draggedFileId) {
      if (campaignStore.draggedFileId === item.id || isDescendantOf(item.id, campaignStore.draggedFileId)) {
        return;
      }
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    isDragOverFolder = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if the pointer actually left this row element (not entered a child)
    const currentTarget = e.currentTarget as HTMLElement | null;
    const relatedTarget = e.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }
    isDragOverFolder = false;
  }

  function handleDrop(e: DragEvent) {
    if (item.type !== 'folder') return;
    e.preventDefault();
    e.stopPropagation();
    isDragOverFolder = false;

    const draggedId =
      campaignStore.draggedFileId ||
      e.dataTransfer?.getData('application/mural-file-id') ||
      e.dataTransfer?.getData('text/plain');

    campaignStore.setDraggedFileId(null);

    if (!draggedId || draggedId === item.id) return;

    // Prevent dragging a folder into itself or its own descendants
    if (isDescendantOf(item.id, draggedId)) return;

    campaignStore.moveFileOrFolder(draggedId, item.id);
    isOpen = true;
  }

  function isDescendantOf(potentialChildId: string, potentialParentId: string): boolean {
    const fs = campaignStore.fileSystem || [];
    let cur = fs.find((f) => f.id === potentialChildId);
    while (cur && cur.parentId) {
      if (cur.parentId === potentialParentId) return true;
      const pid = cur.parentId;
      cur = fs.find((f) => f.id === pid);
    }
    return false;
  }
</script>

<div class="select-none text-xs">
  <!-- Item Row -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    onclick={handleItemClick}
    draggable={!isRenaming}
    ondragstart={handleDragStart}
    ondragend={handleDragEnd}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    class="group flex items-center justify-between py-1 px-2 rounded-lg cursor-pointer transition-colors relative {isSelected
      ? 'bg-amber-500/15 text-amber-300 font-semibold'
      : isDragOverFolder
      ? 'bg-amber-500/25 text-amber-200 ring-2 ring-amber-400 border border-amber-400'
      : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100'}"
    style="padding-left: {level * 16 + 8}px;"
  >
    <!-- Left Icon & Title -->
    <div class="flex items-center gap-1.5 flex-1 min-w-0 pr-1 pointer-events-none">
      {#if item.type === 'folder'}
        <span class="text-zinc-500 hover:text-zinc-300">
          {#if isOpen}
            <ChevronDown class="w-3 h-3" />
          {:else}
            <ChevronRight class="w-3 h-3" />
          {/if}
        </span>
        {#if isOpen}
          <FolderOpen class="w-3.5 h-3.5 {item.color ? '' : 'text-amber-400/80'} shrink-0" style={item.color ? `color: ${item.color}` : ''} />
        {:else}
          <Folder class="w-3.5 h-3.5 {item.color ? '' : 'text-zinc-400'} shrink-0" style={item.color ? `color: ${item.color}` : ''} />
        {/if}
      {:else}
        {@const Icon = getNodeIconComponent(nodeCategory)}
        <Icon class="w-3.5 h-3.5 {getNodeColorClass(nodeCategory)} shrink-0 ml-3" />
      {/if}

      {#if isRenaming}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          bind:value={renameValue}
          onblur={handleSaveRename}
          onkeydown={handleRenameKeyDown}
          autofocus
          class="flex-1 px-1.5 py-0.5 rounded bg-zinc-950 border border-amber-400 text-xs text-zinc-100 outline-none pointer-events-auto"
        />
      {:else}
        <span class="truncate {item.isMissionFolder ? 'font-bold text-amber-300' : ''}">
          {item.name}
        </span>
      {/if}
    </div>

    <!-- Right Badges & Hover Actions -->
    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {#if item.type === 'folder'}
        <button
          type="button"
          onclick={handleCreateFileInFolder}
          class="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition cursor-pointer"
          title="Novo Ficheiro nesta pasta"
        >
          <Plus class="w-3 h-3" />
        </button>

        {#if children.some(c => c.type === 'file' && c.nodeId)}
          <button
            type="button"
            onclick={handleScopeCanvasToFolder}
            class="p-1 rounded text-zinc-400 hover:text-indigo-400 hover:bg-zinc-700 transition cursor-pointer"
            title="Ver Mural focado nesta missão"
          >
            <LayoutGrid class="w-3 h-3" />
          </button>
        {/if}
      {/if}

      <div class="relative">
        <button
          type="button"
          onclick={(e) => { e.stopPropagation(); showMenu = !showMenu; }}
          class="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition cursor-pointer"
          title="Opções"
        >
          <MoreVertical class="w-3 h-3" />
        </button>

        {#if showMenu}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            onclick={(e) => { e.stopPropagation(); showMenu = false; }}
            class="fixed inset-0 z-30 cursor-default"
          ></div>

          <div
            class="absolute right-0 top-full mt-1 w-44 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1 z-40 space-y-0.5 text-left animate-in fade-in zoom-in-95 duration-100"
          >
            {#if item.type === 'folder'}
              <button
                type="button"
                onclick={handleCreateFileInFolder}
                class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-zinc-200 hover:bg-zinc-800 flex items-center gap-2 transition cursor-pointer"
              >
                <Plus class="w-3 h-3 text-zinc-400" />
                <span>+ Ficheiro</span>
              </button>
              <button
                type="button"
                onclick={handleCreateSubFolder}
                class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-zinc-200 hover:bg-zinc-800 flex items-center gap-2 transition cursor-pointer"
              >
                <Folder class="w-3 h-3 text-zinc-400" />
                <span>+ Subpasta</span>
              </button>
              <button
                type="button"
                onclick={handleScopeCanvasToFolder}
                class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-indigo-300 hover:bg-zinc-800 flex items-center gap-2 transition cursor-pointer"
              >
                <LayoutGrid class="w-3 h-3 text-indigo-400" />
                <span>Abrir Mural da Missão</span>
              </button>
              <div class="h-px bg-zinc-800 my-1"></div>
            {/if}

            <button
              type="button"
              onclick={handleStartRename}
              class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-zinc-200 hover:bg-zinc-800 flex items-center gap-2 transition cursor-pointer"
            >
              <Pencil class="w-3 h-3 text-zinc-400" />
              <span>Renomear</span>
            </button>

            <button
              type="button"
              onclick={handleDelete}
              class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 transition cursor-pointer"
            >
              <Trash2 class="w-3 h-3 text-rose-400" />
              <span>Eliminar</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Recursive Child Items -->
  {#if item.type === 'folder' && isOpen && children.length > 0}
    <div class="space-y-0.5">
      {#each children as child (child.id)}
        <FileTreeItem item={child} level={level + 1} {onSelectFile} />
      {/each}
    </div>
  {/if}
</div>
