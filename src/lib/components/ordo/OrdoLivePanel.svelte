<!-- File: src/lib/components/ordo/OrdoLivePanel.svelte -->
<script lang="ts">
  import { ordoP2P } from '../../services/p2p/ordoP2PService.svelte';
  import type { OrdoCharacter, OrdoDiceRollEvent } from '../../types/ordo';
  import {
    Radio,
    Users,
    Heart,
    Brain,
    Zap,
    Shield,
    Dices,
    Plus,
    Trash2,
    Check,
    Copy,
    Share2,
    Sparkles,
    Activity,
    UserCheck,
    Layers,
  } from 'lucide-svelte';

  let isCopied = $state(false);
  let selectedTab = $state<'characters' | 'rolls'>('characters');

  function handleCopyCode() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(ordoP2P.roomCode);
      isCopied = true;
      setTimeout(() => (isCopied = false), 2000);
    }
  }

  function handleStartRoom() {
    ordoP2P.createRoom();
  }

  function handleCreateNode(char: OrdoCharacter) {
    ordoP2P.createCanvasNodeFromCharacter(char);
  }
</script>

<div class="flex flex-col h-full overflow-hidden text-xs text-zinc-200">
  <!-- Top Room Bar -->
  <div class="p-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between gap-2 shrink-0">
    <div class="flex items-center gap-2 min-w-0">
      <div class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 {ordoP2P.isOpen ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-zinc-800 border border-zinc-700 text-zinc-400'}">
        <Radio class="w-3.5 h-3.5 {ordoP2P.isOpen ? 'animate-pulse' : ''}" />
      </div>

      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="font-bold text-xs text-zinc-100 truncate">Sala Ordo Live</span>
          {#if ordoP2P.isOpen}
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          {:else}
            <span class="w-2 h-2 rounded-full bg-zinc-600"></span>
          {/if}
        </div>
        <div class="text-[10px] text-zinc-400 font-mono">
          {#if ordoP2P.isOpen}
            Código: <span class="text-cyan-400 font-bold">{ordoP2P.roomCode}</span>
          {:else}
            Desconectado
          {/if}
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1 shrink-0">
      {#if ordoP2P.isOpen}
        <button
          type="button"
          onclick={handleCopyCode}
          class="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-500/40 text-zinc-300 hover:text-cyan-300 transition cursor-pointer"
          title="Copiar Código da Sala"
        >
          {#if isCopied}
            <Check class="w-3.5 h-3.5 text-emerald-400" />
          {:else}
            <Copy class="w-3.5 h-3.5" />
          {/if}
        </button>

        <button
          type="button"
          onclick={() => ordoP2P.closeRoom()}
          class="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-rose-400 hover:bg-rose-950/40 transition cursor-pointer font-medium"
        >
          Encerrar
        </button>
      {:else}
        <button
          type="button"
          onclick={handleStartRoom}
          class="px-3 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
        >
          <Radio class="w-3 h-3" />
          <span>Ligar</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Internal Sub-Tabs: Characters vs Live Activity Feed -->
  <div class="flex items-center border-b border-zinc-800 bg-zinc-950/60 px-3 pt-1.5 gap-2 text-xs">
    <button
      type="button"
      onclick={() => (selectedTab = 'characters')}
      class="pb-1.5 px-2 font-medium flex items-center gap-1.5 transition border-b-2 cursor-pointer {selectedTab === 'characters'
        ? 'border-cyan-400 text-cyan-300'
        : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
    >
      <Users class="w-3.5 h-3.5" />
      <span>Fichas ({ordoP2P.characters.length})</span>
    </button>

    <button
      type="button"
      onclick={() => (selectedTab = 'rolls')}
      class="pb-1.5 px-2 font-medium flex items-center gap-1.5 transition border-b-2 cursor-pointer {selectedTab === 'rolls'
        ? 'border-cyan-400 text-cyan-300'
        : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
    >
      <Dices class="w-3.5 h-3.5" />
      <span>Rolagens ({ordoP2P.recentRolls.length})</span>
    </button>
  </div>

  <!-- Tab Content Area -->
  <div class="flex-1 overflow-y-auto p-3 space-y-3">
    {#if selectedTab === 'characters'}
      {#if ordoP2P.characters.length > 0}
        <div class="space-y-3">
          {#each ordoP2P.characters as char (char.id || char.peerId)}
            <div class="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 space-y-3 shadow-sm hover:border-zinc-700 transition">
              <!-- Character Header -->
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-xs text-zinc-100 truncate">{char.name}</span>
                    {#if char.connected}
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Online"></span>
                    {:else}
                      <span class="w-1.5 h-1.5 rounded-full bg-zinc-600" title="Desconectado"></span>
                    {/if}
                  </div>
                  <div class="text-[10px] text-zinc-400 flex items-center gap-1">
                    <span class="text-cyan-400 font-medium">{char.playerName}</span>
                    <span>•</span>
                    <span>{char.class || 'Agente'}</span>
                    {#if char.nex}
                      <span>• NEX {char.nex}%</span>
                    {/if}
                  </div>
                </div>

                <!-- Add to Mural Board Button -->
                <button
                  type="button"
                  onclick={() => handleCreateNode(char)}
                  class="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-amber-500/40 text-[10px] text-zinc-300 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer shrink-0"
                  title="Criar cartão deste personagem no Mural de investigação"
                >
                  <Layers class="w-3 h-3" />
                  <span>No Mural</span>
                </button>
              </div>

              <!-- Resource Pools (PV, SAN, PE) -->
              <div class="space-y-1.5 text-[11px]">
                <!-- PV -->
                <div>
                  <div class="flex items-center justify-between text-[10px] mb-0.5">
                    <span class="text-rose-400 font-semibold flex items-center gap-1">
                      <Heart class="w-2.5 h-2.5 fill-rose-500/30" /> PV (Vida)
                    </span>
                    <span class="font-mono text-zinc-300">{char.pv.current} / {char.pv.max}</span>
                  </div>
                  <div class="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                    <div
                      class="h-full bg-rose-500 transition-all duration-300"
                      style="width: {Math.max(0, Math.min(100, (char.pv.current / char.pv.max) * 100))}%;"
                    ></div>
                  </div>
                </div>

                <!-- SAN -->
                <div>
                  <div class="flex items-center justify-between text-[10px] mb-0.5">
                    <span class="text-purple-400 font-semibold flex items-center gap-1">
                      <Brain class="w-2.5 h-2.5 fill-purple-500/30" /> Sanidade
                    </span>
                    <span class="font-mono text-zinc-300">{char.san.current} / {char.san.max}</span>
                  </div>
                  <div class="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                    <div
                      class="h-full bg-purple-500 transition-all duration-300"
                      style="width: {Math.max(0, Math.min(100, (char.san.current / char.san.max) * 100))}%;"
                    ></div>
                  </div>
                </div>

                <!-- PE -->
                <div>
                  <div class="flex items-center justify-between text-[10px] mb-0.5">
                    <span class="text-amber-400 font-semibold flex items-center gap-1">
                      <Zap class="w-2.5 h-2.5 fill-amber-500/30" /> PE (Esforço)
                    </span>
                    <span class="font-mono text-zinc-300">{char.pe.current} / {char.pe.max}</span>
                  </div>
                  <div class="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                    <div
                      class="h-full bg-amber-500 transition-all duration-300"
                      style="width: {Math.max(0, Math.min(100, (char.pe.current / char.pe.max) * 100))}%;"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Attributes Grid -->
              <div class="grid grid-cols-5 gap-1 text-center font-mono">
                <div class="p-1 rounded-lg bg-zinc-900 border border-zinc-800/80">
                  <div class="text-[9px] text-zinc-500">AGI</div>
                  <div class="font-bold text-xs text-zinc-100">{char.attributes.agi}</div>
                </div>
                <div class="p-1 rounded-lg bg-zinc-900 border border-zinc-800/80">
                  <div class="text-[9px] text-zinc-500">FOR</div>
                  <div class="font-bold text-xs text-zinc-100">{char.attributes.for}</div>
                </div>
                <div class="p-1 rounded-lg bg-zinc-900 border border-zinc-800/80">
                  <div class="text-[9px] text-zinc-500">INT</div>
                  <div class="font-bold text-xs text-zinc-100">{char.attributes.int}</div>
                </div>
                <div class="p-1 rounded-lg bg-zinc-900 border border-zinc-800/80">
                  <div class="text-[9px] text-zinc-500">PRE</div>
                  <div class="font-bold text-xs text-zinc-100">{char.attributes.pre}</div>
                </div>
                <div class="p-1 rounded-lg bg-zinc-900 border border-zinc-800/80">
                  <div class="text-[9px] text-zinc-500">VIG</div>
                  <div class="font-bold text-xs text-zinc-100">{char.attributes.vig}</div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="p-8 rounded-2xl border border-dashed border-zinc-800 text-center space-y-3 bg-zinc-950/40">
          <Radio class="w-8 h-8 mx-auto text-zinc-600 {ordoP2P.isOpen ? 'animate-pulse text-cyan-400' : ''}" />
          <div>
            <h4 class="text-xs font-semibold text-zinc-300">Nenhum Jogador Conectado</h4>
            <p class="text-[11px] text-zinc-500 max-w-xs mx-auto mt-1">
              {#if ordoP2P.isOpen}
                Os jogadores devem entrar no Ordo com o código <span class="text-cyan-400 font-mono font-bold">{ordoP2P.roomCode}</span>.
              {:else}
                Inicia a sala P2P para permitir que os jogadores sincronizem as suas fichas com o Mural.
              {/if}
            </p>
          </div>
          {#if !ordoP2P.isOpen}
            <button
              type="button"
              onclick={handleStartRoom}
              class="px-4 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-medium hover:bg-cyan-500/25 transition cursor-pointer"
            >
              Iniciar Sala P2P
            </button>
          {/if}
        </div>
      {/if}

    <!-- TAB 2: ROLLS FEED -->
    {:else if selectedTab === 'rolls'}
      <div class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <span class="text-[10px] uppercase font-bold text-zinc-500">Feed de Rolagens ao Vivo</span>
          {#if ordoP2P.recentRolls.length > 0}
            <button
              type="button"
              onclick={() => ordoP2P.clearRolls()}
              class="text-[10px] text-zinc-500 hover:text-rose-400 cursor-pointer"
            >
              Limpar
            </button>
          {/if}
        </div>

        {#if ordoP2P.recentRolls.length > 0}
          <div class="space-y-1.5">
            {#each ordoP2P.recentRolls as roll (roll.id)}
              <div class="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1 animate-in fade-in duration-150">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-xs text-zinc-200">{roll.characterName}</span>
                    <span class="text-[10px] text-zinc-500">({roll.playerName})</span>
                  </div>
                  <span class="text-[10px] text-zinc-500 font-mono">
                    {new Date(roll.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] text-amber-400 font-medium">{roll.label}</span>
                  <div class="flex items-center gap-1 font-mono">
                    <span class="text-[10px] text-zinc-500">[{roll.diceResults.join(', ')}]</span>
                    <span class="text-xs font-black text-cyan-300">= {roll.total}</span>
                  </div>
                </div>

                {#if roll.isCritical}
                  <div class="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles class="w-3 h-3" /> ACERTO CRÍTICO!
                  </div>
                {:else if roll.isFumble}
                  <div class="text-[10px] text-rose-400 font-bold">
                    ⚠️ DESASTRE!
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-[11px] text-zinc-500 italic text-center py-6">
            Nenhuma rolagem de dados recebida ainda.
          </p>
        {/if}
      </div>
    {/if}
  </div>
</div>
