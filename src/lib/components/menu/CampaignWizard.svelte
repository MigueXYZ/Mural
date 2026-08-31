<script lang="ts">
  import { appState } from '../../stores/appState.svelte';
  import type { CampaignData, EntityNodeData, ThreatClock } from '../../types';
  import type { Node, Edge } from '@xyflow/svelte';
  import {
    X,
    ArrowRight,
    ArrowLeft,
    Sparkles,
    Check,
    Skull,
    Shield,
    Compass,
    Eye,
    Clock,
    User,
    MapPin,
    Flame,
    Layers,
  } from 'lucide-svelte';

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  let step = $state<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Identity & System
  let name = $state('');
  let system = $state('Ordem Paranormal');
  let moodTheme = $state('paranormal');

  // Step 2: Setting & Timeline
  let startingLocationName = $state('Sanatório das Colinas');
  let startingLocationDesc = $state('Um edifício abandonado onde se ouviram ruídos inexplicáveis.');
  let inGamePeriod = $state('Outubro de 2024');
  let campaignDescription = $state('Investigação de desaparecimentos e rituais que ameaçam a cidade.');

  // Step 3: Initial Entities
  let initialNpcName = $state('Inspetor Samuel Vane');
  let initialNpcRole = $state('Aliado');
  let initialNpcDesc = $state('Detetive encarregado do caso oficial, disposto a partilhar pistas.');

  let initialFactionName = $state('Culto da Chama Negra');
  let initialFactionDesc = $state('Seita secreta que opera nos subterrâneos.');

  let initialSecretText = $state('O primeiro desaparecimento ocorreu dentro da sala dos arquivos.');

  // Step 4: Threat Clock
  let clockTitle = $state('Chegada da Entidade');
  let clockSegments = $state<4 | 6 | 8 | 10>(6);
  let clockFilled = $state(1);

  // Blank preset toggle
  let isStartingBlank = $state(false);

  const systems = [
    {
      id: 'Ordem Paranormal',
      name: 'Ordem Paranormal',
      icon: Skull,
      color: 'border-red-600/60 bg-red-950/30 text-red-400',
      defaultPeriod: 'Outubro de 2024',
      defaultLoc: 'Mansão Endiabrada',
      defaultNpc: 'Agente Arthur Brandão',
      defaultFaction: 'Ordem Paranormal',
      defaultSecret: 'O símbolo de Sangue foi pintado com tinta fresca.',
      defaultClock: 'Manifestação Paranormal',
    },
    {
      id: 'D&D 5e',
      name: 'Dungeons & Dragons 5e',
      icon: Shield,
      color: 'border-amber-600/60 bg-amber-950/30 text-amber-400',
      defaultPeriod: 'Era de Ouro, Ano 1492',
      defaultLoc: 'Taverna do Javali Saltitante',
      defaultNpc: 'Elara, a Maga Errante',
      defaultFaction: 'Guilda dos Ladrões das Sombras',
      defaultSecret: 'O taverneiro guarda uma passagem secreta para as catacumbas.',
      defaultClock: 'Avanço do Exército Goblin',
    },
    {
      id: 'Call of Cthulhu 7e',
      name: 'Call of Cthulhu',
      icon: Eye,
      color: 'border-emerald-600/60 bg-emerald-950/30 text-emerald-400',
      defaultPeriod: 'Novembro de 1928',
      defaultLoc: 'Biblioteca Miskatonic',
      defaultNpc: 'Prof. Warren Armitage',
      defaultFaction: 'Irmandade do Olho Amarelo',
      defaultSecret: 'As páginas do Necronomicon foram rasgadas recentemente.',
      defaultClock: 'Despertar no Porto',
    },
    {
      id: 'Tormenta20',
      name: 'Tormenta20',
      icon: Flame,
      color: 'border-purple-600/60 bg-purple-950/30 text-purple-400',
      defaultPeriod: 'Era Artoniana, Ano 1410',
      defaultLoc: 'Forte de Valkaria',
      defaultNpc: 'Gwen, a Paladina de Khalmyr',
      defaultFaction: 'Cultistas da Tormenta',
      defaultSecret: 'A tempestade de rubis aproxima-se pela fronteira sul.',
      defaultClock: 'Corrupção da Área de Tormenta',
    },
    {
      id: 'Personalizado',
      name: 'Personalizado / Outro',
      icon: Layers,
      color: 'border-zinc-600/60 bg-zinc-900/60 text-zinc-300',
      defaultPeriod: 'Presente',
      defaultLoc: 'Local de Partida',
      defaultNpc: 'Primeiro Personagem',
      defaultFaction: 'Grupo Inicial',
      defaultSecret: 'Primeiro mistério da campanha...',
      defaultClock: 'Contagem Regressiva',
    },
  ];

  function selectSystem(sysId: string) {
    system = sysId;
    const sysObj = systems.find((s) => s.id === sysId);
    if (sysObj) {
      inGamePeriod = sysObj.defaultPeriod;
      startingLocationName = sysObj.defaultLoc;
      initialNpcName = sysObj.defaultNpc;
      initialFactionName = sysObj.defaultFaction;
      initialSecretText = sysObj.defaultSecret;
      clockTitle = sysObj.defaultClock;
    }
  }

  function handleCreateCampaign() {
    if (!name.trim()) return;

    const campaignId = `campaign-${Date.now()}`;

    // If starting blank, generate empty lists
    if (isStartingBlank) {
      const blankCampaign: CampaignData = {
        id: campaignId,
        name: name.trim(),
        system,
        currentSession: 1,
        inGamePeriod: inGamePeriod.trim() || 'Presente',
        description: campaignDescription.trim() || 'Quadro em branco.',
        updatedAt: 'Agora mesmo',
        clocks: [],
        lore: [],
        timeline: [
          {
            id: 't-1',
            sessionText: 'Sessão 1',
            sessionNumber: 1,
            isCurrent: true,
          },
        ],
        nodes: [],
        edges: [],
      };

      appState.campaigns = [blankCampaign, ...appState.campaigns];
      appState.openCampaign(campaignId);
      isOpen = false;
      return;
    }

    // Create interconnected canvas nodes
    const locId = `loc-${Date.now()}`;
    const npcId = `npc-${Date.now()}`;
    const factionId = `faction-${Date.now()}`;
    const secretId = `secret-${Date.now()}`;

    const nodes: Node<EntityNodeData>[] = [
      {
        id: locId,
        type: 'entityNode',
        position: { x: 380, y: 260 },
        data: {
          id: locId,
          type: 'location',
          title: startingLocationName,
          subtitle: 'LOCAL INICIAL',
          description: startingLocationDesc,
          color: '#38bdf8',
        },
      },
      {
        id: npcId,
        type: 'entityNode',
        position: { x: 120, y: 140 },
        data: {
          id: npcId,
          type: 'npc',
          title: initialNpcName,
          subtitle: initialNpcRole.toUpperCase(),
          description: initialNpcDesc,
          color: '#d4a359',
        },
      },
      {
        id: factionId,
        type: 'entityNode',
        position: { x: 640, y: 140 },
        data: {
          id: factionId,
          type: 'faction',
          title: initialFactionName,
          subtitle: 'FACÇÃO / AMEAÇA',
          description: initialFactionDesc,
          color: '#a855f7',
        },
      },
      {
        id: secretId,
        type: 'entityNode',
        position: { x: 380, y: 440 },
        data: {
          id: secretId,
          type: 'secret',
          title: 'Segredo Revelador',
          subtitle: 'SEGREDO',
          description: initialSecretText,
          isSecret: true,
          revealed: false,
          color: '#f87171',
        },
      },
    ];

    const edges: Edge[] = [
      {
        id: `e-${npcId}-${locId}`,
        source: npcId,
        target: locId,
        label: 'encontra-se em',
        type: 'smoothstep',
      },
      {
        id: `e-${factionId}-${locId}`,
        source: factionId,
        target: locId,
        label: 'opera sob',
        type: 'smoothstep',
        style: 'stroke: #52525b; stroke-dasharray: 4, 4;',
      },
      {
        id: `e-${locId}-${secretId}`,
        source: locId,
        target: secretId,
        label: 'oculta',
        type: 'smoothstep',
      },
    ];

    const clocks: ThreatClock[] = [
      {
        id: `clock-${Date.now()}`,
        title: clockTitle,
        totalSegments: clockSegments,
        filledSegments: clockFilled,
      },
    ];

    const newCampaign: CampaignData = {
      id: campaignId,
      name: name.trim(),
      system,
      currentSession: 1,
      inGamePeriod: inGamePeriod.trim() || 'Presente',
      description: campaignDescription.trim(),
      updatedAt: 'Agora mesmo',
      clocks,
      lore: [
        {
          id: `lore-${Date.now()}-1`,
          content: initialSecretText,
          status: 'SEGREDO',
          sessionNumber: 1,
        },
        {
          id: `lore-${Date.now()}-2`,
          content: `${initialNpcName} foi o primeiro ponto de contacto da equipa.`,
          status: 'SABIDO',
          sessionNumber: 1,
        },
      ],
      timeline: [
        {
          id: `t-1`,
          sessionText: 'Sessão 1',
          sessionNumber: 1,
          isCurrent: true,
        },
      ],
      nodes,
      edges,
    };

    appState.campaigns = [newCampaign, ...appState.campaigns];
    appState.openCampaign(campaignId);
    isOpen = false;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
    <div class="w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Wizard Top Header & Steps Progress -->
      <div class="px-8 pt-6 pb-4 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Sparkles class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-zinc-100">Assistente de Nova Campanha</h2>
            <p class="text-xs text-zinc-400">Passo {step} de 5</p>
          </div>
        </div>

        <!-- Step Indicator Pills -->
        <div class="flex items-center gap-1.5">
          {#each [1, 2, 3, 4, 5] as s}
            <div
              class="w-6 h-1.5 rounded-full transition-all duration-300 {step === s
                ? 'bg-amber-400 w-8'
                : step > s
                ? 'bg-amber-500/40'
                : 'bg-zinc-800'}"
            ></div>
          {/each}
        </div>

        <button
          onclick={() => (isOpen = false)}
          class="w-8 h-8 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Step Content Area -->
      <div class="p-8 overflow-y-auto flex-1 space-y-6 text-xs text-zinc-200">
        <!-- STEP 1: IDENTIDADE & SISTEMA -->
        {#if step === 1}
          <div class="space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 class="text-base font-bold text-zinc-100 mb-1">Identidade & Sistema de Jogo</h3>
              <p class="text-xs text-zinc-400">Escolhe o sistema de RPG e o nome que dará vida à tua história.</p>
            </div>

            <div>
              <label for="campaign-name-wizard" class="block font-medium text-zinc-300 mb-1.5">Nome da Campanha *</label>
              <input
                id="campaign-name-wizard"
                type="text"
                placeholder="Ex: Operação Nevoeiro Rubro, As Brumas de Ravenloft..."
                bind:value={name}
                class="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
              />
            </div>

            <div>
              <span class="block font-medium text-zinc-300 mb-2">Sistema de RPG</span>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {#each systems as sys}
                  {@const Icon = sys.icon}
                  <button
                    type="button"
                    onclick={() => selectSystem(sys.id)}
                    class="p-3 rounded-xl border text-left flex items-start gap-2.5 transition cursor-pointer {system ===
                    sys.id
                      ? `${sys.color} ring-1 ring-amber-500/50 shadow-md`
                      : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'}"
                  >
                    <div class="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0">
                      <Icon class="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div class="font-semibold text-xs text-zinc-200">{sys.name}</div>
                      <div class="text-[10px] text-zinc-500">Preset configurado</div>
                    </div>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Blank Preset Checkbox / Toggle -->
            <div class="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="blank-mode-checkbox"
                bind:checked={isStartingBlank}
                class="mt-0.5 w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500/30 accent-amber-500 cursor-pointer"
              />
              <label for="blank-mode-checkbox" class="cursor-pointer select-none space-y-0.5 flex-1">
                <div class="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
                  <span>⚪ Iniciar com Quadro 100% em Branco</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-normal">Recomendado para campanhas do zero</span>
                </div>
                <p class="text-[11px] text-zinc-400">
                  Cria uma campanha limpa sem nós, relógios ou notas pré-geradas, permitindo construir tudo à tua maneira.
                </p>
              </label>
            </div>
          </div>

        <!-- STEP 2: CENÁRIO & PREMISSA -->
        {:else if step === 2}
          <div class="space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 class="text-base font-bold text-zinc-100 mb-1">Cenário & Linha do Tempo</h3>
              <p class="text-xs text-zinc-400">Onde e quando começam as investigações da tua mesa.</p>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="starting-location-input" class="block font-medium text-zinc-300 mb-1.5">Local Inicial Principal</label>
                <input
                  id="starting-location-input"
                  type="text"
                  bind:value={startingLocationName}
                  class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label for="ingame-period-wizard" class="block font-medium text-zinc-300 mb-1.5">Data / Época no Mundo</label>
                <input
                  id="ingame-period-wizard"
                  type="text"
                  bind:value={inGamePeriod}
                  class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>

            <div>
              <label for="location-description-wizard" class="block font-medium text-zinc-300 mb-1.5">Descrição do Local Inicial</label>
              <input
                id="location-description-wizard"
                type="text"
                bind:value={startingLocationDesc}
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label for="campaign-synopsis-wizard" class="block font-medium text-zinc-300 mb-1.5">Sinopse / Premissa da Campanha</label>
              <textarea
                id="campaign-synopsis-wizard"
                rows="3"
                bind:value={campaignDescription}
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60 resize-none"
              ></textarea>
            </div>
          </div>

        <!-- STEP 3: ENTIDADES INICIAIS (NÓS) -->
        {:else if step === 3}
          <div class="space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 class="text-base font-bold text-zinc-100 mb-1">Forças em Jogo (Nós Iniciais)</h3>
              <p class="text-xs text-zinc-400">Gera as primeiras conexões e mistérios para o quadro do canvas.</p>
            </div>

            <!-- NPC Card Input -->
            <div class="p-3.5 rounded-2xl bg-zinc-950/80 border border-amber-500/30 space-y-2.5">
              <div class="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <User class="w-3.5 h-3.5" />
                <span>NPC / Suspeito Inicial</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nome do NPC"
                  bind:value={initialNpcName}
                  class="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                />
                <input
                  type="text"
                  placeholder="Papel (ex: Aliado, Informante)"
                  bind:value={initialNpcRole}
                  class="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <input
                type="text"
                placeholder="Breve descrição do NPC..."
                bind:value={initialNpcDesc}
                class="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <!-- Faction Card Input -->
            <div class="p-3.5 rounded-2xl bg-zinc-950/80 border border-purple-500/30 space-y-2.5">
              <div class="flex items-center gap-2 text-purple-400 font-semibold text-xs">
                <Shield class="w-3.5 h-3.5" />
                <span>Fação / Culto / Organização</span>
              </div>
              <input
                type="text"
                placeholder="Nome da Fação"
                bind:value={initialFactionName}
                class="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-purple-500/60"
              />
              <input
                type="text"
                placeholder="Objetivo ou segredo da fação..."
                bind:value={initialFactionDesc}
                class="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-purple-500/60"
              />
            </div>

            <!-- Secret Card Input -->
            <div class="p-3.5 rounded-2xl bg-zinc-950/80 border border-rose-500/30 space-y-2.5">
              <div class="flex items-center gap-2 text-rose-400 font-semibold text-xs">
                <Skull class="w-3.5 h-3.5" />
                <span>Pista ou Segredo Oculto</span>
              </div>
              <input
                type="text"
                placeholder="Algo que os jogadores ainda não descobriram..."
                bind:value={initialSecretText}
                class="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-rose-500/60"
              />
            </div>
          </div>

        <!-- STEP 4: RELÓGIOS DE AMEAÇA -->
        {:else if step === 4}
          <div class="space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 class="text-base font-bold text-zinc-100 mb-1">Relógio de Ameaça Inicial</h3>
              <p class="text-xs text-zinc-400">Define uma contagem regressiva para criar urgência e tensão na narrativa.</p>
            </div>

            <div>
              <label for="threat-clock-title-wizard" class="block font-medium text-zinc-300 mb-1.5">Nome do Perigo / Ameaça</label>
              <input
                id="threat-clock-title-wizard"
                type="text"
                placeholder="Ex: Chegada da Entidade, Cerco à Cidade..."
                bind:value={clockTitle}
                class="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <span class="block font-medium text-zinc-300 mb-2">Total de Fatias</span>
              <div class="grid grid-cols-4 gap-3">
                {#each [4, 6, 8, 10] as num}
                  <button
                    type="button"
                    onclick={() => (clockSegments = num as 4 | 6 | 8 | 10)}
                    class="py-3 rounded-xl border text-center font-bold text-sm transition cursor-pointer {clockSegments ===
                    num
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-400 shadow-md'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
                  >
                    {num} fatias
                  </button>
                {/each}
              </div>
            </div>

            <div>
              <label for="filled-segments-range-wizard" class="block font-medium text-zinc-300 mb-1.5">Fatias já preenchidas no início ({clockFilled} / {clockSegments})</label>
              <input
                id="filled-segments-range-wizard"
                type="range"
                min="0"
                max={clockSegments}
                bind:value={clockFilled}
                class="w-full accent-amber-400"
              />
            </div>
          </div>

        <!-- STEP 5: RESUMO & CONFIRMAÇÃO -->
        {:else if step === 5}
          <div class="space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 class="text-base font-bold text-zinc-100 mb-1">Tudo Pronto para a Sessão!</h3>
              <p class="text-xs text-zinc-400">Revê os dados da tua campanha antes de abrir o quadro interativo.</p>
            </div>

            <div class="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-3">
              <div class="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div>
                  <h4 class="text-sm font-bold text-amber-400">{name || 'Nova Campanha'}</h4>
                  <span class="text-[11px] text-zinc-400">{system} • {inGamePeriod}</span>
                </div>
                <span class="px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 text-[10px] font-semibold">
                  Pronto para Começar
                </span>
              </div>

              <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="space-y-1">
                  <span class="text-zinc-500 font-medium">Nós no Canvas:</span>
                  <p class="text-zinc-300">4 nós interconectados (Local, NPC, Fação, Segredo)</p>
                </div>
                <div class="space-y-1">
                  <span class="text-zinc-500 font-medium">Relógio Inicial:</span>
                  <p class="text-zinc-300">{clockTitle} ({clockFilled}/{clockSegments} fatias)</p>
                </div>
              </div>

              <p class="text-xs text-zinc-400 italic pt-1">
                "{campaignDescription}"
              </p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Wizard Navigation Footer -->
      <div class="px-8 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
        {#if step > 1}
          <button
            onclick={() => (step = (step - 1) as 1 | 2 | 3 | 4 | 5)}
            class="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:bg-zinc-800 flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            <span>Voltar</span>
          </button>
        {:else}
          <div></div>
        {/if}

        {#if step === 1 && isStartingBlank}
          <button
            onclick={handleCreateCampaign}
            disabled={!name.trim()}
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 hover:from-amber-400 hover:to-amber-300 disabled:opacity-40 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>Criar Quadro em Branco Imediatamente</span>
          </button>
        {:else if step < 5}
          <button
            onclick={() => {
              if (step === 1 && !name.trim()) {
                alert('Por favor, insere um nome para a campanha.');
                return;
              }
              step = (step + 1) as 1 | 2 | 3 | 4 | 5;
            }}
            class="px-5 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 hover:bg-amber-400 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <span>Continuar</span>
            <ArrowRight class="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        {:else}
          <button
            onclick={handleCreateCampaign}
            class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 hover:from-amber-400 hover:to-amber-300 transition active:scale-95 shadow-lg shadow-amber-500/30 cursor-pointer"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>Criar Campanha & Abrir Quadro</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
