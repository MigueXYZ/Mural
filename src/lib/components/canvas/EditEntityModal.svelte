<!-- File: src/lib/components/canvas/EditEntityModal.svelte -->
<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import type { EntityType, EncounterTable, AttachedNote, DiceType } from '../../types';
  import { ICON_OPTIONS, getEntityIcon } from '../../utils/icons';
  import { audioEngine } from '../../services/audio/audioEngine.svelte';
  import {
    X,
    Sliders,
    Trash2,
    Plus,
    Tag,
    Lock,
    Unlock,
    Dice6,
    FileText,
    Dices,
    User,
    Shield,
    MapPin,
    Skull,
    Search,
    Music,
    Check,
    Palette,
    Link2,
    Sparkles,
    Maximize2,
    Minimize2,
    Bold,
    Italic,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    CheckSquare,
    Quote,
    Code,
    Table,
    Eye,
    Columns,
    Edit3,
    PanelRightClose,
    PanelRightOpen,
    Layout,
    BookOpen,
    ArrowLeftRight,
  } from 'lucide-svelte';
  import { renderMarkdown } from '../../utils/markdown';

  const node = $derived(campaignStore.editingNode);
  const nodesStore = campaignStore.nodes;
  const edgesStore = campaignStore.edges;

  const connectedEdges = $derived.by(() => {
    if (!node?.id) return [];
    const allEdges = $edgesStore;
    const allNodes = $nodesStore;
    return allEdges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((edge) => {
        const isSource = edge.source === node.id;
        const otherNodeId = isSource ? edge.target : edge.source;
        const otherNode = allNodes.find((n) => n.id === otherNodeId);
        return {
          edge,
          isSource,
          otherNode,
        };
      });
  });

  // Tab & Workspace State
  let activeTab = $state<'general' | 'tables' | 'notes' | 'connections'>('general');
  let isFullScreen = $state(false);
  let isSidebarOpen = $state(true);
  let sidebarActiveTab = $state<'tables' | 'notes' | 'connections' | 'meta'>('tables');
  let descViewMode = $state<'edit' | 'preview' | 'split'>('edit');
  let descTextareaRef: HTMLTextAreaElement | null = $state(null);

  // General tab states
  let title = $state('');
  let subtitle = $state('');
  let description = $state('');
  let type = $state<EntityType>('npc');
  let isSecret = $state(false);
  let tags = $state<string[]>([]);
  let tagInput = $state('');
  let color = $state('#d4a359');
  let selectedIcon = $state('user');
  let audioPlaylistId = $state('');

  // Encounter Tables State
  let tables = $state<EncounterTable[]>([]);
  let activeTableIndex = $state(0);

  // Sub-notes State
  let attachedNotes = $state<AttachedNote[]>([]);
  let newNoteTitle = $state('');
  let newNoteContent = $state('');

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
    { id: 'faction', label: 'Facção / Culto', icon: Shield, color: 'text-purple-400 border-purple-500/40 bg-purple-500/10', defaultColor: '#a855f7', defaultIcon: 'shield' },
    { id: 'location', label: 'Local / Região', icon: MapPin, color: 'text-sky-400 border-sky-500/40 bg-sky-500/10', defaultColor: '#38bdf8', defaultIcon: 'map-pin' },
    { id: 'secret', label: 'Segredo Oculto', icon: Skull, color: 'text-rose-400 border-rose-500/40 bg-rose-500/10', defaultColor: '#f87171', defaultIcon: 'skull' },
    { id: 'clue', label: 'Pista / Evidência', icon: Search, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10', defaultColor: '#10b981', defaultIcon: 'search' },
    { id: 'note', label: 'Nota / Documento', icon: FileText, color: 'text-zinc-300 border-zinc-500/40 bg-zinc-800/30', defaultColor: '#71717a', defaultIcon: 'file-text' },
    { id: 'table', label: 'Tabela de Dados', icon: Dices, color: 'text-amber-300 border-amber-500/40 bg-amber-500/10', defaultColor: '#d4a359', defaultIcon: 'dices' },
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
      tagInput = '';
      color = node.colorTheme || node.color || '#d4a359';
      selectedIcon = node.icon || 'user';
      audioPlaylistId = node.audioPlaylistId || '';
      tables = JSON.parse(JSON.stringify(node.tables || []));
      activeTableIndex = 0;
      attachedNotes = JSON.parse(JSON.stringify(node.notes || []));
      newNoteTitle = '';
      newNoteContent = '';
    }
  });

  function handleTypeSelect(item: (typeof typesList)[0]) {
    type = item.id;
    if (item.defaultColor && color === '#d4a359') {
      color = item.defaultColor;
    }
    if (item.defaultIcon) {
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

  function addNewTable() {
    const newTbl: EncounterTable = {
      id: `tbl-${Date.now()}`,
      title: `Tabela de Eventos ${tables.length + 1}`,
      diceType: 'd6',
      rows: [
        { id: `r1-${Date.now()}`, range: '1-2', title: 'Acontecimento menor ou pista falsa', description: '' },
        { id: `r2-${Date.now()}`, range: '3-4', title: 'Encontro com patrulha local', description: '' },
        { id: `r3-${Date.now()}`, range: '5-6', title: 'Revelação crucial do mistério', description: '' },
      ],
    };
    tables = [...tables, newTbl];
    activeTableIndex = tables.length - 1;
  }

  function removeTable(index: number) {
    tables = tables.filter((_, i) => i !== index);
    if (activeTableIndex >= tables.length) {
      activeTableIndex = Math.max(0, tables.length - 1);
    }
  }

  function addTableRow(currentTable: EncounterTable) {
    const count = currentTable.rows.length + 1;
    currentTable.rows = [
      ...currentTable.rows,
      {
        id: `row-${Date.now()}`,
        range: `${count}`,
        title: `Novo Encontro ${count}`,
        description: '',
      },
    ];
  }

  function removeTableRow(currentTable: EncounterTable, rowId: string) {
    currentTable.rows = currentTable.rows.filter((r) => r.id !== rowId);
  }

  function rollDice(currentTable: EncounterTable) {
    let max = 6;
    switch (currentTable.diceType) {
      case 'd4': max = 4; break;
      case 'd6': max = 6; break;
      case 'd8': max = 8; break;
      case 'd10': max = 10; break;
      case 'd12': max = 12; break;
      case 'd20': max = 20; break;
      case 'd100': max = 100; break;
    }
    const roll = Math.floor(Math.random() * max) + 1;

    let matchedRowId = '';
    for (const r of currentTable.rows) {
      const parts = r.range.split('-').map((p) => parseInt(p.trim(), 10));
      if (parts.length === 1 && parts[0] === roll) {
        matchedRowId = r.id;
        break;
      } else if (parts.length === 2 && roll >= parts[0] && roll <= parts[1]) {
        matchedRowId = r.id;
        break;
      }
    }

    currentTable.lastRoll = {
      rolledAt: Date.now(),
      diceValue: roll,
      matchedRowId,
    };
  }

  function addAttachedNote() {
    if (!newNoteTitle.trim()) return;
    attachedNotes = [
      ...attachedNotes,
      {
        id: `note-${Date.now()}`,
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
        createdAt: Date.now(),
      },
    ];
    newNoteTitle = '';
    newNoteContent = '';
  }

  function removeAttachedNote(id: string) {
    attachedNotes = attachedNotes.filter((n) => n.id !== id);
  }

  function insertMarkdown(prefix: string, suffix: string = '', placeholder: string = '') {
    if (!descTextareaRef) {
      description = `${description}\n${prefix}${placeholder}${suffix}`;
      return;
    }
    const start = descTextareaRef.selectionStart;
    const end = descTextareaRef.selectionEnd;
    const selected = description.substring(start, end) || placeholder;
    const replacement = `${prefix}${selected}${suffix}`;
    description = description.substring(0, start) + replacement + description.substring(end);
    setTimeout(() => {
      if (descTextareaRef) {
        descTextareaRef.focus();
        descTextareaRef.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
      }
    }, 10);
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
        tables,
        notes: attachedNotes,
        audioPlaylistId: audioPlaylistId || undefined,
      });
      campaignStore.closeNodeEditor();
    }
  }

  function handleDelete() {
    if (node && confirm(`Tens a certeza que desejas eliminar "${node.title}"?`)) {
      campaignStore.deleteNode(node.id);
    }
  }
</script>

{#snippet editorContent()}
  <!-- Top Metadata Row -->
  <div class="space-y-3">
    <!-- Category Chips -->
    <div>
      <span class="block text-zinc-400 font-medium text-xs mb-1.5">Categoria da Entidade</span>
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
        {#each typesList as item}
          {@const Icon = item.icon}
          <button
            type="button"
            onclick={() => handleTypeSelect(item)}
            class="p-2 rounded-xl border text-left flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer {type ===
            item.id
              ? `${item.color} ring-1 ring-amber-500/50 shadow-xs`
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
          >
            <Icon class="w-3.5 h-3.5 flex-shrink-0" />
            <span class="truncate text-[11px]">{item.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Title & Subtitle Inputs -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="sm:col-span-2">
        <label for="entity-edit-title" class="block font-medium text-zinc-300 text-xs mb-1">Título / Nome *</label>
        <input
          id="entity-edit-title"
          type="text"
          bind:value={title}
          class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
        />
      </div>
      <div>
        <label for="entity-edit-subtitle" class="block font-medium text-zinc-300 text-xs mb-1">Rótulo / Papel</label>
        <input
          id="entity-edit-subtitle"
          type="text"
          bind:value={subtitle}
          placeholder="Ex: Suspeito, Taverna"
          class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
        />
      </div>
    </div>
  </div>

  <!-- WYSIWYG / Markdown Notes & Description Editor -->
  <div class="space-y-2 flex-1 flex flex-col min-h-0">
    <div class="flex items-center justify-between">
      <label for="entity-edit-desc" class="block font-medium text-zinc-300 text-xs">
        Conteúdo & Anotações WYSIWYG
      </label>

      <!-- View Mode Toggles -->
      <div class="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
        <button
          type="button"
          onclick={() => (descViewMode = 'edit')}
          class="px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition cursor-pointer {descViewMode === 'edit'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            : 'text-zinc-400 hover:text-zinc-200'}"
        >
          <Edit3 class="w-3 h-3" />
          <span>Editor</span>
        </button>
        <button
          type="button"
          onclick={() => (descViewMode = 'preview')}
          class="px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition cursor-pointer {descViewMode === 'preview'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            : 'text-zinc-400 hover:text-zinc-200'}"
        >
          <Eye class="w-3 h-3" />
          <span>Prévia</span>
        </button>
        <button
          type="button"
          onclick={() => (descViewMode = 'split')}
          class="px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition cursor-pointer {descViewMode === 'split'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            : 'text-zinc-400 hover:text-zinc-200'}"
        >
          <Columns class="w-3 h-3" />
          <span>Lado a Lado</span>
        </button>
      </div>
    </div>

    <!-- WYSIWYG Quick Formatting Toolbar -->
    {#if descViewMode !== 'preview'}
      <div class="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800 flex-wrap text-zinc-400 shrink-0">
        <button
          type="button"
          onclick={() => insertMarkdown('**', '**', 'texto')}
          class="p-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition cursor-pointer"
          title="Negrito (**texto**)"
        >
          <Bold class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onclick={() => insertMarkdown('*', '*', 'texto')}
          class="p-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition cursor-pointer"
          title="Itálico (*texto*)"
        >
          <Italic class="w-3.5 h-3.5" />
        </button>
        <div class="w-px h-4 bg-zinc-800 mx-0.5"></div>
        <button
          type="button"
          onclick={() => insertMarkdown('# ', '', 'Título 1')}
          class="p-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition cursor-pointer"
          title="Título Principal (# )"
        >
          <Heading1 class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onclick={() => insertMarkdown('## ', '', 'Título 2')}
          class="p-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition cursor-pointer"
          title="Subtítulo (## )"
        >
          <Heading2 class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onclick={() => insertMarkdown('### ', '', 'Título 3')}
          class="p-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition cursor-pointer"
          title="Secção (### )"
        >
          <Heading3 class="w-3.5 h-3.5" />
        </button>
        <div class="w-px h-4 bg-zinc-800 mx-0.5"></div>
        <button
          type="button"
          onclick={() => insertMarkdown('- ', '', 'Item da lista')}
          class="p-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition cursor-pointer"
          title="Lista com Marcadores (- )"
        >
          <List class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onclick={() => insertMarkdown('1. ', '', 'Primeiro passo')}
          class="p-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition cursor-pointer"
          title="Lista Numerada (1. )"
        >
          <ListOrdered class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onclick={() => insertMarkdown('- [ ] ', '', 'Tarefa a investigar')}
          class="p-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition cursor-pointer"
          title="Checklist / Tarefa (- [ ] )"
        >
          <CheckSquare class="w-3.5 h-3.5" />
        </button>
        <div class="w-px h-4 bg-zinc-800 mx-0.5"></div>
        <button
          type="button"
          onclick={() => insertMarkdown('> ', '', 'Citação de lore')}
          class="p-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition cursor-pointer"
          title="Citação (> )"
        >
          <Quote class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onclick={() => insertMarkdown('> 🔒 **Segredo:** ', '', 'Informação oculta')}
          class="p-1.5 hover:bg-rose-950/60 hover:text-rose-300 rounded-md transition cursor-pointer text-rose-400"
          title="Caixa de Segredo (> 🔒 )"
        >
          <Lock class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onclick={() => insertMarkdown('```\n', '\n```', 'Texto de documento')}
          class="p-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition cursor-pointer"
          title="Bloco de Código / Handout (```)"
        >
          <Code class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onclick={() => insertMarkdown('| Coluna 1 | Coluna 2 |\n|---|---|\n| Item 1 | Item 2 |')}
          class="p-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded-md transition cursor-pointer"
          title="Tabela Markdown"
        >
          <Table class="w-3.5 h-3.5" />
        </button>
      </div>
    {/if}

    <!-- Live Split / Editor View Area -->
    <div class="grid flex-1 min-h-[220px] {descViewMode === 'split' ? 'grid-cols-2 gap-3' : 'grid-cols-1'}">
      {#if descViewMode === 'edit' || descViewMode === 'split'}
        <textarea
          id="entity-edit-desc"
          rows={isFullScreen ? 20 : 7}
          bind:this={descTextareaRef}
          bind:value={description}
          placeholder="Escreve aqui notas ricas em Markdown, regras, segredos e descrições narrativas..."
          class="w-full h-full min-h-[160px] px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-2xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 resize-y leading-relaxed font-mono"
        ></textarea>
      {/if}

      {#if descViewMode === 'preview' || descViewMode === 'split'}
        <div
          class="w-full h-full min-h-[160px] overflow-y-auto px-4 py-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl text-xs leading-relaxed text-zinc-200"
        >
          {@html renderMarkdown(description)}
        </div>
      {/if}
    </div>
  </div>

  <!-- Tags & Secret Row -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center shrink-0">
    <div>
      <label for="entity-tag-input" class="block font-medium text-zinc-300 text-xs mb-1">Tags / Palavras-chave</label>
      <div class="flex items-center gap-1.5">
        <input
          id="entity-tag-input"
          type="text"
          placeholder="Adicionar tag..."
          bind:value={tagInput}
          onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          class="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
        />
        <button
          type="button"
          onclick={addTag}
          class="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-200"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
      </div>
      {#if tags.length > 0}
        <div class="flex flex-wrap gap-1 mt-2">
          {#each tags as t}
            <span class="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] flex items-center gap-1">
              <span>{t}</span>
              <button onclick={() => removeTag(t)} class="text-zinc-500 hover:text-rose-400">×</button>
            </span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Secret Mode Toggle -->
    <div class="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between">
      <div>
        <div class="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
          <Lock class="w-3 h-3 text-rose-400" />
          <span>Segredo Oculto</span>
        </div>
        <div class="text-[10px] text-zinc-500">Apenas o Mestre tem conhecimento</div>
      </div>
      <input
        type="checkbox"
        bind:checked={isSecret}
        class="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-rose-500 focus:ring-rose-500/30 accent-rose-500 cursor-pointer"
      />
    </div>
  </div>
{/snippet}

{#snippet tablesContent()}
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-xs font-bold text-zinc-100">Tabelas de Encontros & Eventos Aleatórios</h3>
        <p class="text-[11px] text-zinc-400">Rola dados interativos durante a sessão para gerar acontecimentos</p>
      </div>
      <button
        type="button"
        onclick={addNewTable}
        class="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>Nova Tabela</span>
      </button>
    </div>

    {#if tables.length > 0}
      <!-- Table Selector Tabs -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
        {#each tables as tbl, idx}
          <button
            type="button"
            onclick={() => (activeTableIndex = idx)}
            class="px-3 py-1 rounded-lg text-xs font-medium border flex items-center gap-2 transition cursor-pointer {activeTableIndex ===
            idx
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
          >
            <span>{tbl.title || `Tabela ${idx + 1}`}</span>
            <span class="text-[10px] px-1 rounded bg-zinc-900 border border-zinc-700 font-mono">
              {tbl.diceType}
            </span>
          </button>
        {/each}
      </div>

      <!-- Active Table Editor & Roller -->
      {#if tables[activeTableIndex]}
        {@const currentTable = tables[activeTableIndex]}
        <div class="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
            <div class="flex-1 grid grid-cols-3 gap-2">
              <input
                type="text"
                bind:value={currentTable.title}
                placeholder="Nome da Tabela"
                class="col-span-2 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 font-semibold focus:outline-none focus:border-amber-500/60"
              />
              <select
                bind:value={currentTable.diceType}
                class="px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-amber-400 font-mono focus:outline-none focus:border-amber-500/60"
              >
                <option value="d4">Dado 1d4</option>
                <option value="d6">Dado 1d6</option>
                <option value="d8">Dado 1d8</option>
                <option value="d10">Dado 1d10</option>
                <option value="d12">Dado 1d12</option>
                <option value="d20">Dado 1d20</option>
                <option value="d100">Dado 1d100</option>
              </select>
            </div>

            <!-- Interactive Roll Button -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => rollDice(currentTable)}
                class="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 hover:from-amber-400 hover:to-amber-300 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Dices class="w-4 h-4 stroke-[2.5]" />
                <span>Rolar ({currentTable.diceType})</span>
              </button>

              <button
                type="button"
                onclick={() => removeTable(activeTableIndex)}
                title="Eliminar Tabela"
                class="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition cursor-pointer"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Last Roll Callout Highlight -->
          {#if currentTable.lastRoll}
            <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center gap-3 animate-in fade-in duration-200">
              <div class="w-8 h-8 rounded-lg bg-amber-500 text-zinc-950 font-black text-sm flex items-center justify-center shadow-md">
                {currentTable.lastRoll.diceValue}
              </div>
              <div class="text-xs">
                <span class="font-bold text-amber-300">Resultado Sorteado ({currentTable.diceType}): </span>
                <span class="text-zinc-200">
                  {currentTable.rows.find((r) => r.id === currentTable.lastRoll?.matchedRowId)?.title ||
                    'Sem correspondência de linha'}
                </span>
              </div>
            </div>
          {/if}

          <!-- Rows Table List -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-[11px] text-zinc-500 font-semibold uppercase px-1">
              <span>Linhas de Encontro ({currentTable.rows.length})</span>
              <button
                type="button"
                onclick={() => addTableRow(currentTable)}
                class="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Adicionar Linha</span>
              </button>
            </div>

            <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {#each currentTable.rows as row (row.id)}
                <div
                  class="p-2 rounded-xl border transition flex items-start gap-2 {currentTable.lastRoll
                    ?.matchedRowId === row.id
                    ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-400'
                    : 'bg-zinc-900/90 border-zinc-800'}"
                >
                  <input
                    type="text"
                    placeholder="1-2"
                    bind:value={row.range}
                    class="w-14 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-amber-400 text-center focus:outline-none focus:border-amber-500/60"
                  />
                  <div class="flex-1 space-y-1">
                    <input
                      type="text"
                      placeholder="Nome do Encontro / Evento"
                      bind:value={row.title}
                      class="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 font-medium focus:outline-none focus:border-amber-500/60"
                    />
                    <input
                      type="text"
                      placeholder="Detalhes ou consequências opcionais..."
                      bind:value={row.description}
                      class="w-full px-2 py-0.5 bg-zinc-950/60 border border-zinc-800/60 rounded-md text-[11px] text-zinc-400 focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <button
                    type="button"
                    onclick={() => removeTableRow(currentTable, row.id)}
                    class="p-1 text-zinc-600 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    {:else}
      <div class="p-8 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2 bg-zinc-950/40">
        <Dices class="w-8 h-8 mx-auto text-zinc-600" />
        <h4 class="text-xs font-semibold text-zinc-300">Nenhuma Tabela de Encontros</h4>
        <p class="text-[11px] text-zinc-500 max-w-xs mx-auto">
          Cria tabelas de encontros para rolar patrulhas, eventos ou clima diretamente neste nó.
        </p>
        <button
          type="button"
          onclick={addNewTable}
          class="px-4 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition cursor-pointer"
        >
          Criar Primeira Tabela
        </button>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet notesContent()}
  <div class="space-y-4">
    <div>
      <h3 class="text-xs font-bold text-zinc-100">Caderno de Contexto & Sub-Notas</h3>
      <p class="text-[11px] text-zinc-400">Anexa cartas, regras de ambiente, armadilhas e lore aprofundado a esta entidade</p>
    </div>

    <!-- Add Sub-Note Form -->
    <div class="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
      <input
        type="text"
        placeholder="Título da Sub-Nota (ex: Armadilhas no Teto, Carta do Barão...)"
        bind:value={newNoteTitle}
        class="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
      />
      <textarea
        rows="2"
        placeholder="Conteúdo complementar ou estatísticas..."
        bind:value={newNoteContent}
        class="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 resize-none"
      ></textarea>
      <div class="flex justify-end">
        <button
          type="button"
          onclick={addAttachedNote}
          disabled={!newNoteTitle.trim()}
          class="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Anexar Nota</span>
        </button>
      </div>
    </div>

    <!-- Notes List -->
    {#if attachedNotes.length > 0}
      <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
        {#each attachedNotes as n (n.id)}
          <div class="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800 space-y-1.5 group">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-xs text-amber-400">{n.title}</span>
              <button
                type="button"
                onclick={() => removeAttachedNote(n.id)}
                class="text-zinc-600 hover:text-rose-400 p-1 cursor-pointer opacity-0 group-hover:opacity-100 transition"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
            <p class="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{n.content}</p>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-[11px] text-zinc-500 italic text-center py-4">Nenhuma sub-nota anexada ainda.</p>
    {/if}
  </div>
{/snippet}

{#snippet connectionsContent()}
  <div class="space-y-4">
    <div>
      <h3 class="text-xs font-bold text-zinc-100">Ligações & Conexões no Mural</h3>
      <p class="text-[11px] text-zinc-400">Relações semânticas que conectam esta entidade a outros nós do quadro</p>
    </div>

    {#if connectedEdges.length > 0}
      <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
        {#each connectedEdges as { edge, isSource, otherNode } (edge.id)}
          {@const IconComp = getEntityIcon(edge.data?.icon, edge.data?.relationType)}
          <div class="p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800 flex items-center justify-between gap-3 group hover:border-zinc-700 transition">
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                style="background-color: {otherNode?.data.color || '#d4a359'}20; color: {otherNode?.data.color || '#d4a359'};"
              >
                <IconComp class="w-3.5 h-3.5" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-zinc-100 truncate">
                    {otherNode?.data.title || 'Nó Desconhecido'}
                  </span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono capitalize">
                    {edge.data?.relationType || 'neutral'}
                  </span>
                </div>
                <div class="text-[11px] text-amber-400/90 font-medium truncate">
                  {isSource ? '→ ' : '← '} "{edge.data?.label || 'ligado a'}"
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onclick={() => campaignStore.openEdgeEditor(edge)}
                class="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-amber-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                title="Editar Conexão"
              >
                <Sliders class="w-3 h-3" />
                <span>Editar</span>
              </button>

              <button
                type="button"
                onclick={() => campaignStore.deleteEdge(edge.id)}
                class="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                title="Eliminar Conexão"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="p-8 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2 bg-zinc-950/40">
        <Link2 class="w-8 h-8 mx-auto text-zinc-600" />
        <h4 class="text-xs font-semibold text-zinc-300">Nenhuma Conexão Ativa</h4>
        <p class="text-[11px] text-zinc-500 max-w-xs mx-auto">
          Arrasta conectores dos pontos do nó no Mural para criar fios de investigação e relações.
        </p>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet metaContent()}
  <div class="space-y-4">
    <div>
      <h3 class="text-xs font-bold text-zinc-100">Aparência, Ícones & Ambiência Sonora</h3>
      <p class="text-[11px] text-zinc-400">Personaliza o aspeto visual e a trilha sonora dedicada</p>
    </div>

    <!-- Color Picker -->
    <div class="space-y-2">
      <span class="block text-zinc-400 font-medium text-xs">Paleta de Cores do Nó</span>
      <div class="flex items-center gap-2 flex-wrap">
        {#each COLOR_PALETTE as preset}
          <button
            type="button"
            onclick={() => (color = preset.hex)}
            class="w-6 h-6 rounded-full border-2 transition-transform cursor-pointer {color.toLowerCase() ===
            preset.hex.toLowerCase()
              ? 'scale-125 border-zinc-100 ring-2 ring-amber-500/50 shadow-md'
              : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'}"
            style="background-color: {preset.hex};"
            title={preset.name}
          ></button>
        {/each}
        <input
          type="color"
          bind:value={color}
          class="w-6 h-6 rounded-full border border-zinc-700 bg-transparent cursor-pointer"
          title="Cor personalizada"
        />
      </div>
    </div>

    <!-- Icon Grid Selector -->
    <div class="space-y-2">
      <span class="block text-zinc-400 font-medium text-xs">Ícone Representativo</span>
      <div class="grid grid-cols-6 gap-1.5 p-2 bg-zinc-950 rounded-xl border border-zinc-800 max-h-36 overflow-y-auto">
        {#each ICON_OPTIONS as opt}
          {@const IconC = opt.component}
          <button
            type="button"
            onclick={() => (selectedIcon = opt.id)}
            class="p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition cursor-pointer {selectedIcon ===
            opt.id
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'}"
            title={opt.name}
          >
            <IconC class="w-4 h-4" />
          </button>
        {/each}
      </div>
    </div>

    <!-- Linked Soundtrack Playlist -->
    <div class="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
      <div class="flex items-center justify-between">
        <div class="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
          <Music class="w-3 h-3 text-amber-400" />
          <span>Trilha Sonora Vinculada</span>
        </div>
        {#if audioPlaylistId}
          <button
            type="button"
            onclick={() => (audioPlaylistId = '')}
            class="text-[10px] text-zinc-500 hover:text-rose-400 cursor-pointer"
          >
            Limpar
          </button>
        {/if}
      </div>
      <select
        bind:value={audioPlaylistId}
        class="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60"
      >
        <option value="">Sem playlist vinculada (usa ambiência contextual)</option>
        {#each audioEngine.playlists as pl}
          <option value={pl.id}>🎵 {pl.name} ({pl.tracks.length} faixas)</option>
        {/each}
      </select>
    </div>
  </div>
{/snippet}

{#if node}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  {#if isFullScreen}
    {@const FullscreenIcon = getEntityIcon(selectedIcon, type)}
    <!-- ========================================================================= -->
    <!-- OBSIDIAN-STYLE FULL-SCREEN WORKSPACE MODE -->
    <!-- ========================================================================= -->
    <div
      class="fixed inset-0 z-50 bg-[#0b0d11] text-zinc-100 flex flex-col w-screen h-screen select-text animate-in fade-in duration-150 font-sans"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Top Workspace Bar -->
      <div class="px-6 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shadow-md"
            style="background-color: {color}25; color: {color}; border: 1px solid {color}50;"
          >
            <FullscreenIcon class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>{title || 'Sem Título'}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full border bg-zinc-900 border-zinc-700 text-zinc-400 font-mono capitalize">
                {type}
              </span>
              {#if isSecret}
                <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-950/80 border border-rose-800 text-rose-300 font-semibold flex items-center gap-1">
                  <Lock class="w-2.5 h-2.5" /> Segredo
                </span>
              {/if}
            </h2>
            <p class="text-[11px] text-zinc-400">
              Workspace de Edição em Ecrã Completo (Estilo Obsidian)
            </p>
          </div>
        </div>

        <!-- Right Action Controls -->
        <div class="flex items-center gap-2">
          <!-- Sidebar Toggle Button -->
          <button
            type="button"
            onclick={() => (isSidebarOpen = !isSidebarOpen)}
            class="px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer {isSidebarOpen
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'}"
            title={isSidebarOpen ? 'Ocultar Painel Lateral' : 'Mostrar Painel Lateral'}
          >
            {#if isSidebarOpen}
              <PanelRightClose class="w-3.5 h-3.5" />
              <span>Painel Lateral</span>
            {:else}
              <PanelRightOpen class="w-3.5 h-3.5" />
              <span>Painel Lateral</span>
            {/if}
          </button>

          <!-- Floating Mode Toggle -->
          <button
            type="button"
            onclick={() => (isFullScreen = false)}
            class="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer border border-zinc-800"
            title="Janela Flutuante"
          >
            <Minimize2 class="w-4 h-4" />
          </button>

          <!-- Save Button -->
          <button
            type="button"
            onclick={handleSave}
            class="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 hover:from-amber-400 hover:to-amber-300 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Check class="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Guardar</span>
          </button>

          <!-- Close Button -->
          <button
            type="button"
            onclick={() => campaignStore.closeNodeEditor()}
            class="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Workspace Body: Left Editor + Right Inspector Sidebar -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Main Center Markdown Editor Area -->
        <div class="flex-1 flex flex-col overflow-y-auto p-6 space-y-4">
          {@render editorContent()}
        </div>

        <!-- Obsidian-Style Inspector Sidebar -->
        {#if isSidebarOpen}
          <aside class="w-80 lg:w-96 border-l border-zinc-800 bg-zinc-950/90 flex flex-col shrink-0 overflow-hidden shadow-2xl">
            <!-- Sidebar Navigation Tabs -->
            <div class="flex items-center gap-1 p-2 border-b border-zinc-800 bg-zinc-950 text-xs overflow-x-auto">
              <button
                type="button"
                onclick={() => (sidebarActiveTab = 'tables')}
                class="px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer {sidebarActiveTab === 'tables'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}"
              >
                <Dices class="w-3.5 h-3.5" />
                <span>Tabelas ({tables.length})</span>
              </button>

              <button
                type="button"
                onclick={() => (sidebarActiveTab = 'notes')}
                class="px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer {sidebarActiveTab === 'notes'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}"
              >
                <FileText class="w-3.5 h-3.5" />
                <span>Notas ({attachedNotes.length})</span>
              </button>

              <button
                type="button"
                onclick={() => (sidebarActiveTab = 'connections')}
                class="px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer {sidebarActiveTab === 'connections'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}"
              >
                <Link2 class="w-3.5 h-3.5" />
                <span>Conexões ({connectedEdges.length})</span>
              </button>

              <button
                type="button"
                onclick={() => (sidebarActiveTab = 'meta')}
                class="px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer {sidebarActiveTab === 'meta'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}"
              >
                <Palette class="w-3.5 h-3.5" />
                <span>Estilo</span>
              </button>
            </div>

            <!-- Sidebar Content Panel -->
            <div class="p-4 overflow-y-auto flex-1 space-y-4 text-xs text-zinc-200">
              {#if sidebarActiveTab === 'tables'}
                {@render tablesContent()}
              {:else if sidebarActiveTab === 'notes'}
                {@render notesContent()}
              {:else if sidebarActiveTab === 'connections'}
                {@render connectionsContent()}
              {:else if sidebarActiveTab === 'meta'}
                {@render metaContent()}
              {/if}
            </div>
          </aside>
        {/if}
      </div>

      <!-- Fullscreen Footer -->
      <div class="px-6 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
        <button
          onclick={handleDelete}
          class="px-3 py-1.5 rounded-xl text-rose-400 hover:bg-rose-950/40 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>Eliminar Nó</span>
        </button>

        <div class="flex items-center gap-2">
          <button
            onclick={() => campaignStore.closeNodeEditor()}
            class="px-4 py-1.5 rounded-xl text-xs text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onclick={handleSave}
            class="px-5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 hover:from-amber-400 hover:to-amber-300 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Check class="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Guardar Alterações</span>
          </button>
        </div>
      </div>
    </div>

  {:else}
    <!-- ========================================================================= -->
    <!-- STANDARD MODAL DIALOG MODE -->
    <!-- ========================================================================= -->
    <div
      class="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4"
      onclick={(e) => { if (e.target === e.currentTarget) campaignStore.closeNodeEditor(); }}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="w-full max-w-3xl max-h-[90vh] bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 animate-in fade-in zoom-in-95">
        <!-- Modal Header -->
        <div class="px-6 py-3.5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sliders class="w-4 h-4" />
            </div>
            <div>
              <h2 class="text-sm font-bold text-zinc-100">
                {type === 'note' ? 'Editor de Notas & Lore' : 'Editar Entidade / Contexto'}
              </h2>
              <p class="text-[11px] text-zinc-400">
                {type === 'note' ? 'Documento formatado em WYSIWYG Markdown' : 'Gerencia detalhes, tabelas de encontros e notas vinculadas'}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <!-- Fullscreen Toggle (US 145 & Obsidian Workspace) -->
            <button
              type="button"
              onclick={() => (isFullScreen = true)}
              class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
              title="Ecrã Completo (Modo Workspace / Obsidian)"
            >
              <Maximize2 class="w-4 h-4" />
            </button>

            <button
              type="button"
              onclick={() => campaignStore.closeNodeEditor()}
              class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex items-center gap-2 px-6 pt-3 border-b border-zinc-800 bg-zinc-950/50 text-xs overflow-x-auto">
          <button
            onclick={() => (activeTab = 'general')}
            class="px-3.5 py-2 rounded-t-xl font-medium flex items-center gap-1.5 transition border-b-2 {activeTab === 'general'
              ? 'border-amber-400 text-amber-300 bg-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
          >
            <Sliders class="w-3.5 h-3.5" />
            <span>Geral & Conteúdo</span>
          </button>

          <button
            onclick={() => (activeTab = 'tables')}
            class="px-3.5 py-2 rounded-t-xl font-medium flex items-center gap-1.5 transition border-b-2 {activeTab === 'tables'
              ? 'border-amber-400 text-amber-300 bg-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
          >
            <Dices class="w-3.5 h-3.5" />
            <span>Tabelas de Encontros ({tables.length})</span>
          </button>

          <button
            onclick={() => (activeTab = 'notes')}
            class="px-3.5 py-2 rounded-t-xl font-medium flex items-center gap-1.5 transition border-b-2 {activeTab === 'notes'
              ? 'border-amber-400 text-amber-300 bg-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
          >
            <FileText class="w-3.5 h-3.5" />
            <span>Sub-Notas ({attachedNotes.length})</span>
          </button>

          <button
            onclick={() => (activeTab = 'connections')}
            class="px-3.5 py-2 rounded-t-xl font-medium flex items-center gap-1.5 transition border-b-2 {activeTab === 'connections'
              ? 'border-amber-400 text-amber-300 bg-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
          >
            <Link2 class="w-3.5 h-3.5" />
            <span>Conexões ({connectedEdges.length})</span>
          </button>
        </div>

        <!-- Tab Content Area -->
        <div class="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-zinc-200">
          {#if activeTab === 'general'}
            {@render editorContent()}
            <div class="pt-4 border-t border-zinc-800/80">
              {@render metaContent()}
            </div>
          {:else if activeTab === 'tables'}
            {@render tablesContent()}
          {:else if activeTab === 'notes'}
            {@render notesContent()}
          {:else if activeTab === 'connections'}
            {@render connectionsContent()}
          {/if}
        </div>

        <!-- Modal Footer Actions -->
        <div class="px-6 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <button
            onclick={handleDelete}
            class="px-3 py-1.5 rounded-xl text-rose-400 hover:bg-rose-950/40 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>Eliminar Nó</span>
          </button>

          <div class="flex items-center gap-2">
            <button
              onclick={() => campaignStore.closeNodeEditor()}
              class="px-4 py-1.5 rounded-xl text-xs text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onclick={handleSave}
              class="px-5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 hover:from-amber-400 hover:to-amber-300 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Check class="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Guardar Alterações</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
{/if}
