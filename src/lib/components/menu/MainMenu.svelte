<script lang="ts">
  import { appState } from '../../stores/appState.svelte';
  import CampaignCard from './CampaignCard.svelte';
  import CampaignWizard from './CampaignWizard.svelte';
  import DocsModal from './DocsModal.svelte';
  import HelpModal from './HelpModal.svelte';
  import {
    Plus,
    FolderOpen,
    Sparkles,
    Search,
    Compass,
    Skull,
    Timer,
    BookOpen,
    HelpCircle,
    Shield,
    Layers,
  } from 'lucide-svelte';

  let isWizardOpen = $state(false);
  let isDocsOpen = $state(false);
  let isHelpOpen = $state(false);
  let fileInput: HTMLInputElement;

  const filteredCampaigns = $derived(
    appState.campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(appState.searchFilter.toLowerCase()) ||
        (c.system || '').toLowerCase().includes(appState.searchFilter.toLowerCase())
    )
  );

  function handleFileImport(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          appState.importCampaign(content);
        }
      };
      reader.readAsText(target.files[0]);
    }
  }

  function startTemplate(templateType: 'mystery' | 'faction' | 'oneshot' | 'blank') {
    if (templateType === 'blank') {
      appState.createNewCampaign({
        name: 'Campanha Sem Título',
        system: 'Personalizado',
        inGamePeriod: 'Presente',
        description: 'Quadro limpo para planeamento livre.',
        templateType: 'blank',
      });
    } else if (templateType === 'mystery') {
      appState.createNewCampaign({
        name: 'O Enigma das Sombras',
        system: 'Ordem Paranormal',
        inGamePeriod: 'Novembro de 2024',
        description: 'Um caso de desaparecimento que esconde rituais esquecidos.',
        templateType: 'mystery',
      });
    } else if (templateType === 'faction') {
      appState.createNewCampaign({
        name: 'Guerra dos Três Barões',
        system: 'D&D 5e',
        inGamePeriod: 'Era da Peste, Ano 412',
        description: 'Três casas nobres disputam o controle da província fronteiriça.',
        templateType: 'faction',
      });
    } else {
      appState.createNewCampaign({
        name: 'Fuga do Complexo 9',
        system: 'Cyberpunk RED',
        inGamePeriod: 'Ano 2077',
        description: 'Uma invasão corporativa em ritmo acelerado com contagem de minutos.',
        templateType: 'oneshot',
      });
    }
  }
</script>

<div class="h-screen w-full bg-[#0b0d11] text-zinc-100 flex flex-col overflow-y-auto font-sans selection:bg-amber-500/30 selection:text-amber-200">
  <!-- Top App Navigation -->
  <header class="h-16 border-b border-zinc-800/80 bg-zinc-950/90 px-8 flex items-center justify-between backdrop-blur-md sticky top-0 z-30 flex-shrink-0">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-base shadow-inner">
        O
      </div>
      <div>
        <h1 class="text-sm font-bold text-zinc-100 tracking-wide flex items-center gap-2">
          Mural <span class="text-xs font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">OrdemTools</span>
        </h1>
        <p class="text-[11px] text-zinc-500">GM Screen & Conspiracy Board para RPG de Mesa</p>
      </div>
    </div>

    <div class="flex items-center gap-4 text-xs text-zinc-400">
      <button
        onclick={() => (isDocsOpen = true)}
        class="hover:text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
      >
        <BookOpen class="w-3.5 h-3.5" />
        <span>Documentação</span>
      </button>
      <div class="w-[1px] h-4 bg-zinc-800"></div>
      <button
        onclick={() => (isHelpOpen = true)}
        class="hover:text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
      >
        <HelpCircle class="w-3.5 h-3.5" />
        <span>Ajuda</span>
      </button>
    </div>
  </header>

  <!-- Main Content Container -->
  <main class="flex-1 max-w-6xl w-full mx-auto px-8 py-10 space-y-12">
    <!-- Hero Banner & Main Actions -->
    <div class="rounded-3xl bg-gradient-to-b from-zinc-900/90 via-zinc-900/50 to-zinc-950/40 border border-zinc-800/90 p-8 sm:p-10 shadow-2xl relative overflow-hidden">
      <!-- Glow effect -->
      <div class="absolute -right-20 -top-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="max-w-2xl space-y-3 mb-8">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
          <Sparkles class="w-3.5 h-3.5" />
          <span>Local-First & Pronto para Sessões ao Vivo</span>
        </div>
        <h2 class="text-3xl font-extrabold text-zinc-100 tracking-tight leading-tight">
          Conecta pistas, mestra campanhas e domina a narrativa.
        </h2>
        <p class="text-sm text-zinc-400 leading-relaxed">
          O teu ecrã de mestre definitivo com nós interativos de conspiração, relógios de ameaça, registo de lore e assistente de improviso.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-3.5">
        <button
          onclick={() => (isWizardOpen = true)}
          class="px-5 py-3 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-xs flex items-center gap-2 hover:bg-amber-400 transition active:scale-95 shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          <Plus class="w-4 h-4 stroke-[2.5]" />
          <span>Nova Campanha</span>
        </button>

        <!-- Hidden input for file upload -->
        <input
          type="file"
          accept=".json,.mural"
          bind:this={fileInput}
          onchange={handleFileImport}
          class="hidden"
        />

        <button
          onclick={() => fileInput?.click()}
          class="px-5 py-3 rounded-xl bg-zinc-800/90 border border-zinc-700/80 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium text-xs flex items-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <FolderOpen class="w-4 h-4 text-zinc-400" />
          <span>Abrir Ficheiro (.mural)</span>
        </button>

        <button
          onclick={() => appState.openCampaign('aerthys-01')}
          class="px-5 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:border-amber-500/40 hover:text-amber-300 font-medium text-xs flex items-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <Compass class="w-4 h-4 text-amber-400" />
          <span>Ver Demo (As Crónicas de Aerthys)</span>
        </button>
      </div>
    </div>

    <!-- Campaigns Section -->
    <div class="space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h3 class="text-base font-bold text-zinc-100 flex items-center gap-2">
            <span>As Tuas Campanhas</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-normal">
              {filteredCampaigns.length}
            </span>
          </h3>
          <p class="text-xs text-zinc-500">Acede aos teus quadros de preparação recentes</p>
        </div>

        <!-- Search Bar -->
        <div class="relative w-full sm:w-72">
          <Search class="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por nome ou sistema..."
            bind:value={appState.searchFilter}
            class="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      <!-- Campaign Cards Grid -->
      {#if filteredCampaigns.length > 0}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {#each filteredCampaigns as camp (camp.id)}
            <CampaignCard campaign={camp} />
          {/each}
        </div>
      {:else}
        <div class="py-16 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 space-y-3">
          <p class="text-sm text-zinc-400">Nenhuma campanha encontrada com esse filtro.</p>
          <button
            onclick={() => (isWizardOpen = true)}
            class="text-xs text-amber-400 hover:underline font-medium"
          >
            Criar uma nova campanha agora →
          </button>
        </div>
      {/if}
    </div>

    <!-- Starter Templates Section -->
    <div class="space-y-4 pt-4">
      <div>
        <h3 class="text-sm font-bold text-zinc-200">Modelos Rápidos (Starter Presets)</h3>
        <p class="text-xs text-zinc-500">Inicia uma campanha pré-configurada para o teu estilo de jogo</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onclick={() => startTemplate('blank')}
          class="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-500/50 hover:bg-zinc-900 transition text-left space-y-2 group cursor-pointer"
        >
          <div class="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300 group-hover:scale-105 transition">
            <Layers class="w-4 h-4" />
          </div>
          <h4 class="text-xs font-semibold text-zinc-200 group-hover:text-amber-400 transition">
            Quadro em Branco
          </h4>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            Canvas 100% limpo, sem nós ou regras prévias para começares do zero absoluto.
          </p>
        </button>

        <button
          onclick={() => startTemplate('mystery')}
          class="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-red-500/40 hover:bg-zinc-900 transition text-left space-y-2 group cursor-pointer"
        >
          <div class="w-8 h-8 rounded-lg bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400 group-hover:scale-105 transition">
            <Skull class="w-4 h-4" />
          </div>
          <h4 class="text-xs font-semibold text-zinc-200 group-hover:text-red-400 transition">
            Investigação Paranormal
          </h4>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            Preset ideal para *Ordem Paranormal* e *Call of Cthulhu*, focado em pistas e segredos ocultos.
          </p>
        </button>

        <button
          onclick={() => startTemplate('faction')}
          class="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-amber-500/40 hover:bg-zinc-900 transition text-left space-y-2 group cursor-pointer"
        >
          <div class="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400 group-hover:scale-105 transition">
            <Shield class="w-4 h-4" />
          </div>
          <h4 class="text-xs font-semibold text-zinc-200 group-hover:text-amber-400 transition">
            Facções & Sandbox
          </h4>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            Estrutura voltada para *D&D 5e* e *Tormenta20*, mapeando conflitos de poder e territórios.
          </p>
        </button>

        <button
          onclick={() => startTemplate('oneshot')}
          class="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-sky-500/40 hover:bg-zinc-900 transition text-left space-y-2 group cursor-pointer"
        >
          <div class="w-8 h-8 rounded-lg bg-sky-950/60 border border-sky-800/50 flex items-center justify-center text-sky-400 group-hover:scale-105 transition">
            <Timer class="w-4 h-4" />
          </div>
          <h4 class="text-xs font-semibold text-zinc-200 group-hover:text-sky-400 transition">
            One-Shot de Tensão
          </h4>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            Preparado com múltiplos Relógios de Ameaça para sessões intensas e contagens decrescentes.
          </p>
        </button>
      </div>
    </div>
  </main>

  <!-- Campaign Wizard Modal -->
  <CampaignWizard bind:isOpen={isWizardOpen} />

  <!-- Docs Modal -->
  <DocsModal bind:isOpen={isDocsOpen} />

  <!-- Help Modal -->
  <HelpModal bind:isOpen={isHelpOpen} />
</div>
