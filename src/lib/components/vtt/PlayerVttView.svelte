<!--
  src/lib/components/vtt/PlayerVttView.svelte
  
  Mural Tactical Virtual Tabletop (VTT) - Strict Player-Only Client
  Milestone 3: Exclusive web browser interface for players connecting via
  P2P room code, viewing battlemaps restricted by Fog of War, moving their
  assigned pawn, and rolling dice.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { vttP2P } from '../../services/vtt/vttP2PService.svelte';
  import type { VttScene, VttToken } from '../../types/vtt';
  import VttCanvas from './VttCanvas.svelte';
  import InitiativeTracker from './InitiativeTracker.svelte';
  import DiceRollDrawer from './DiceRollDrawer.svelte';
  import {
    Shield,
    Swords,
    Dices,
    Radio,
    LogOut,
    Wifi,
    WifiOff,
    User,
    Compass,
    Sparkles,
    Eye,
    Heart,
    Brain,
    Plus,
    X,
    Upload,
    Check,
  } from 'lucide-svelte';
  import { compressImageToDataUrl } from '../../services/vtt/vttProtocol';

  let roomCodeInput = $state('');
  let playerNameInput = $state('');
  let characterNameInput = $state('');
  let playerColorInput = $state('#38bdf8');
  let playerImageUrl = $state<string | undefined>(undefined);
  let characterMaxPv = $state(20);
  let characterCurrentPv = $state(20);
  let characterMaxSan = $state(30);
  let characterCurrentSan = $state(30);
  let characterClass = $state('Combatente');
  let tokenSizeInput = $state<'pequeno' | 'medio' | 'grande' | 'enorme'>('medio');

  let isDiceDrawerOpen = $state(false);
  let isTokenModalOpen = $state(false);
  let selectedTokenId = $state<string | null>(null);
  let activeTool = $state<'select' | 'pan' | 'ruler' | 'ping'>('select');

  const isConnected = $derived(vttP2P.isConnected && !vttP2P.isHost);
  const isConnecting = $derived(vttP2P.isConnecting);
  const activeScene = $derived(vttP2P.activeScene);
  const latency = $derived(vttP2P.latencyMs);

  // My token on the board (if assigned or matching peer/character ID)
  const myToken = $derived.by(() => {
    if (!activeScene) return null;
    return (
      activeScene.tokens.find(
        (t) =>
          (vttP2P.localPeerId && t.ownerPeerId === vttP2P.localPeerId) ||
          (characterNameInput && t.name.toLowerCase() === characterNameInput.toLowerCase())
      ) || null
    );
  });

  onMount(() => {
    // Check if room code was passed via URL search params (e.g. ?room=ORD-1234)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room') || params.get('sala');
      if (urlRoom) {
        roomCodeInput = urlRoom.toUpperCase();
      }
      const urlName = params.get('name') || params.get('nome');
      if (urlName) {
        playerNameInput = urlName;
      }
    }
  });

  async function handleConnect(e: Event) {
    e.preventDefault();
    if (!roomCodeInput.trim()) {
      alert('Por favor, insere o Código da Sala (ex: ORD-1234).');
      return;
    }

    try {
      vttP2P.playerName = playerNameInput.trim() || 'Jogador';
      vttP2P.playerColor = playerColorInput;

      await vttP2P.joinRoom(
        roomCodeInput.trim(),
        vttP2P.playerName,
        {
          characterName: characterNameInput.trim() || vttP2P.playerName,
          color: playerColorInput,
          imageUrl: playerImageUrl,
          pv: { current: characterCurrentPv, max: characterMaxPv },
          san: { current: characterCurrentSan, max: characterMaxSan },
        }
      );
    } catch (err: any) {
      alert(`Falha ao conectar: ${err.message || 'Código de sala inválido ou Mestre indisponível.'}`);
    }
  }

  function handleSavePlayerToken() {
    const finalName = characterNameInput.trim() || playerNameInput.trim() || 'Jogador';
    if (!finalName) return;

    if (myToken && activeScene) {
      const updated: VttToken = {
        ...myToken,
        name: finalName,
        size: tokenSizeInput,
        color: playerColorInput,
        imageUrl: playerImageUrl !== undefined ? playerImageUrl : myToken.imageUrl,
        pv: { current: Number(characterCurrentPv) || 20, max: Number(characterMaxPv) || 20 },
        san: { current: Number(characterCurrentSan) || 30, max: Number(characterMaxSan) || 30 },
      };
      vttP2P.sendTokenUpsert(updated);
    } else {
      const newToken: VttToken = {
        id: `token-${vttP2P.localPeerId || Date.now()}`,
        name: finalName,
        characterId: `char-${vttP2P.localPeerId || Date.now()}`,
        ownerPeerId: vttP2P.localPeerId,
        type: 'character',
        size: tokenSizeInput,
        x: activeScene ? Math.round(activeScene.width / 2) : 1000,
        y: activeScene ? Math.round(activeScene.height / 2) : 800,
        color: playerColorInput,
        imageUrl: playerImageUrl,
        pv: { current: Number(characterCurrentPv) || 20, max: Number(characterMaxPv) || 20 },
        san: { current: Number(characterCurrentSan) || 30, max: Number(characterMaxSan) || 30 },
        isStealth: false,
        conditions: [],
      };
      vttP2P.sendTokenUpsert(newToken);
    }
    isTokenModalOpen = false;
  }

  function handleDisconnect() {
    if (confirm('Desejas sair da mesa de combate?')) {
      vttP2P.destroy();
    }
  }

  function handleTokenMove(tokenId: string, x: number, y: number, isFinal: boolean) {
    vttP2P.sendTokenMove(tokenId, x, y, 0, isFinal);
  }

  function handlePing(point: { x: number; y: number }) {
    vttP2P.sendPing(point.x, point.y);
  }
</script>

<div class="h-screen w-screen bg-[#07090d] text-zinc-100 overflow-hidden font-sans select-none flex flex-col">
  {#if !isConnected}
    <!-- ===================================================================== -->
    <!-- 1. Player Connection Screen (Zero GM Leakage)                          -->
    <!-- ===================================================================== -->
    <div class="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div class="w-full max-w-md rounded-3xl bg-zinc-950/90 border border-zinc-800/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-6">
        <!-- Glow effect -->
        <div class="absolute -right-20 -top-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Header -->
        <div class="text-center space-y-2">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <Radio class="w-3.5 h-3.5 animate-pulse" />
            <span>Mesa Tática P2P · Modo Jogador</span>
          </div>
          <h1 class="text-2xl font-extrabold tracking-tight text-zinc-100">
            Entrar na Sessão
          </h1>
          <p class="text-xs text-zinc-400">
            Conexão ponto-a-ponto local direta com o Mestre. Zero servidores na nuvem.
          </p>
        </div>

        <!-- Join Form -->
        <form onsubmit={handleConnect} class="space-y-4 text-xs">
          <!-- Room Code -->
          <div class="space-y-1.5">
            <label for="room-code" class="text-zinc-300 font-semibold block">
              Código da Sala (fornecido pelo Mestre):
            </label>
            <input
              id="room-code"
              type="text"
              placeholder="Ex: ORD-8421"
              bind:value={roomCodeInput}
              maxlength="10"
              required
              class="w-full h-11 px-3.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-sm font-mono tracking-wider font-bold text-amber-300 placeholder-zinc-500 focus:outline-none focus:border-amber-400 uppercase transition"
            />
          </div>

          <!-- Player Name -->
          <div class="space-y-1.5">
            <label for="player-name" class="text-zinc-300 font-semibold block">
              O teu Nome / Apelido:
            </label>
            <input
              id="player-name"
              type="text"
              placeholder="Ex: Mariana / André"
              bind:value={playerNameInput}
              required
              class="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          <!-- Character Identity -->
          <div class="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-3">
            <span class="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
              Personagem na Mesa
            </span>

            <div class="grid grid-cols-3 gap-2">
              <div class="col-span-2 space-y-1">
                <label for="character-name" class="text-[10px] text-zinc-400 block">Nome do Personagem:</label>
                <input
                  id="character-name"
                  type="text"
                  placeholder="Ex: Arthur Cervero / Elena"
                  bind:value={characterNameInput}
                  class="w-full h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div class="space-y-1">
                <label for="player-color" class="text-[10px] text-zinc-400 block">Cor do Anel:</label>
                <div class="flex items-center h-8 gap-2">
                  <input
                    id="player-color"
                    type="color"
                    bind:value={playerColorInput}
                    class="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <span class="text-[10px] font-mono text-zinc-500">{playerColorInput}</span>
                </div>
              </div>
            </div>

            <!-- Token Portrait Upload in Connect Screen -->
            <div class="pt-2 border-t border-zinc-800/60 space-y-1">
              <span class="text-[10px] text-zinc-400 block">Foto / Retrato do Token (Avatar):</span>
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full border-2 border-dashed border-zinc-700 bg-zinc-950 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                  {#if playerImageUrl}
                    <img src={playerImageUrl} alt="Preview" class="w-full h-full object-cover" />
                  {:else}
                    <User class="w-5 h-5 text-zinc-600" />
                  {/if}
                </div>
                <div class="flex-1 flex flex-col gap-0.5">
                  <input
                    type="file"
                    accept="image/*"
                    onchange={async (e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.files && target.files[0]) {
                        playerImageUrl = await compressImageToDataUrl(target.files[0], 256, 0.85);
                      }
                    }}
                    class="text-[10px] text-zinc-400 file:mr-2 file:py-0.5 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                  />
                  {#if playerImageUrl}
                    <button
                      type="button"
                      onclick={() => (playerImageUrl = undefined)}
                      class="text-[9px] text-rose-400 hover:text-rose-300 text-left cursor-pointer"
                    >
                      Remover Foto
                    </button>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Optional Initial Resources -->
            <div class="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60 text-[10px]">
              <div>
                <label for="character-pv" class="text-emerald-400 font-medium block mb-0.5">Pontos de Vida (PV):</label>
                <input
                  id="character-pv"
                  type="number"
                  min="1"
                  max="300"
                  bind:value={characterCurrentPv}
                  class="w-full h-7 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono"
                />
              </div>
              <div>
                <label for="character-san" class="text-sky-400 font-medium block mb-0.5">Sanidade (SAN):</label>
                <input
                  id="character-san"
                  type="number"
                  min="0"
                  max="150"
                  bind:value={characterCurrentSan}
                  class="w-full h-7 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono"
                />
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            disabled={isConnecting}
            class="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 transition active:scale-98 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            {#if isConnecting}
              <div class="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
              <span>A conectar à mesa...</span>
            {:else}
              <Swords class="w-4 h-4 stroke-[2.5]" />
              <span>Entrar na Sessão de Combate</span>
            {/if}
          </button>

          {#if vttP2P.lastError}
            <div class="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs text-center">
              {vttP2P.lastError}
            </div>
          {/if}
        </form>
      </div>
    </div>
  {:else}
    <!-- ===================================================================== -->
    <!-- 2. Active Tactical Board (Player Mode)                                 -->
    <!-- ===================================================================== -->

    <!-- Top Player Header Bar -->
    <header class="h-12 bg-zinc-950/95 border-b border-zinc-800/90 px-4 flex items-center justify-between z-20 flex-shrink-0 backdrop-blur-md">
      <!-- Left: Room & P2P Status -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <div class="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse"></div>
          <span class="text-xs font-bold font-mono text-zinc-200">{vttP2P.roomCode}</span>
        </div>

        <div class="hidden sm:flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono border-l border-zinc-800 pl-3">
          <Wifi class="w-3 h-3 text-emerald-400" />
          <span>{latency} ms</span>
        </div>

        {#if activeScene}
          <div class="hidden md:block text-xs font-medium text-zinc-400 truncate max-w-[200px]">
            {activeScene.name}
          </div>
        {/if}
      </div>

      <!-- Center: Player Character HUD & Token Setup -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={() => (isTokenModalOpen = true)}
          class="flex items-center gap-2 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-1 rounded-xl transition cursor-pointer"
          title="Configurar e Personalizar o Meu Token"
        >
          <div
            class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-950 overflow-hidden border"
            style="background-color: {playerColorInput}; border-color: {playerColorInput}"
          >
            {#if playerImageUrl}
              <img src={playerImageUrl} alt={characterNameInput} class="w-full h-full object-cover" />
            {:else if myToken?.imageUrl}
              <img src={myToken.imageUrl} alt={myToken.name} class="w-full h-full object-cover" />
            {:else}
              {characterNameInput ? characterNameInput.charAt(0).toUpperCase() : 'J'}
            {/if}
          </div>
          <span class="text-xs font-bold text-zinc-200 truncate max-w-[120px]">
            {characterNameInput || vttP2P.playerName}
          </span>

          {#if myToken}
            <div class="flex items-center gap-2 text-[10px] font-mono pl-2 border-l border-zinc-800">
              <span class="text-emerald-400 font-bold flex items-center gap-0.5">
                <Heart class="w-3 h-3 fill-emerald-400/20" />
                {myToken.pv.current}/{myToken.pv.max}
              </span>
              <span class="text-sky-400 font-bold flex items-center gap-0.5">
                <Brain class="w-3 h-3 fill-sky-400/20" />
                {myToken.san.current}/{myToken.san.max}
              </span>
            </div>
          {/if}
        </button>

        {#if !myToken}
          <button
            type="button"
            onclick={() => (isTokenModalOpen = true)}
            class="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-amber-500/20"
            title="Criar e colocar o teu token no mapa de batalha"
          >
            <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Colocar Token</span>
          </button>
        {/if}
      </div>

      <!-- Right: Action Buttons -->
      <div class="flex items-center gap-2">
        <!-- Tactical Tool Selection -->
        <div class="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          <button
            type="button"
            onclick={() => (activeTool = 'select')}
            title="Mover o Meu Token"
            class="p-1.5 rounded text-xs transition cursor-pointer {activeTool === 'select' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            Mover
          </button>
          <button
            type="button"
            onclick={() => (activeTool = 'ruler')}
            title="Régua de Medição"
            class="p-1.5 rounded text-xs transition cursor-pointer {activeTool === 'ruler' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            Régua
          </button>
          <button
            type="button"
            onclick={() => (activeTool = 'ping')}
            title="Ping / Radar"
            class="p-1.5 rounded text-xs transition cursor-pointer {activeTool === 'ping' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            Ping
          </button>
        </div>

        <!-- Dice Drawer Toggle -->
        <button
          type="button"
          onclick={() => (isDiceDrawerOpen = true)}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition cursor-pointer text-xs font-semibold shadow-sm"
        >
          <Dices class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">Dados</span>
        </button>

        <!-- Disconnect -->
        <button
          type="button"
          onclick={handleDisconnect}
          title="Sair da Sala"
          class="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-300 hover:bg-rose-950/40 hover:border-rose-800 transition cursor-pointer"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>
    </header>

    <!-- Main Canvas Viewport Area -->
    <main class="flex-1 relative overflow-hidden">
      {#if activeScene}
        <VttCanvas
          scene={activeScene}
          isGm={false}
          myPeerId={vttP2P.localPeerId}
          myCharacterId={characterNameInput}
          {activeTool}
          pings={vttP2P.recentPings}
          {selectedTokenId}
          onTokenMove={handleTokenMove}
          onTokenSelect={(id) => (selectedTokenId = id)}
          onPing={handlePing}
        />
      {:else}
        <div class="h-full w-full flex flex-col items-center justify-center p-6 text-center space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 animate-pulse">
            <Radio class="w-6 h-6" />
          </div>
          <h2 class="text-base font-bold text-zinc-200">A aguardar mapa do Mestre...</h2>
          <p class="text-xs text-zinc-500 max-w-sm">
            Estás conectado à sala <span class="font-mono text-amber-400 font-bold">{vttP2P.roomCode}</span>. Assim que o Mestre carregar ou atualizar a cena de combate, ela aparecerá aqui automaticamente.
          </p>
        </div>
      {/if}
    </main>

    <!-- Combat Initiative Tracker (Floating in Top Right) -->
    <InitiativeTracker
      isGm={false}
      myCharacterId={characterNameInput}
      myPeerId={vttP2P.localPeerId}
    />

    <!-- Live Dice Roller Drawer -->
    <DiceRollDrawer
      bind:isOpen={isDiceDrawerOpen}
      playerName={vttP2P.playerName}
      characterName={characterNameInput}
    />

    <!-- Modal: Configurar / Criar Meu Token -->
    {#if isTokenModalOpen}
      <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
          <div class="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <User class="w-4 h-4 text-amber-400" />
              <span>{myToken ? 'Personalizar o Meu Token' : 'Criar o Meu Token'}</span>
            </h3>
            <button
              type="button"
              onclick={() => (isTokenModalOpen = false)}
              class="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="space-y-3 text-xs">
            <!-- Nome -->
            <div>
              <label for="player-token-name" class="text-zinc-400 block mb-1">Nome do Personagem:</label>
              <input
                id="player-token-name"
                type="text"
                bind:value={characterNameInput}
                placeholder="Ex: Arthur Cervero"
                class="w-full h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <!-- Tamanho & Cor -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label for="player-token-size" class="text-zinc-400 block mb-1">Tamanho:</label>
                <select
                  id="player-token-size"
                  bind:value={tokenSizeInput}
                  class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                >
                  <option value="pequeno">Pequeno (0.8x)</option>
                  <option value="medio">Médio (1x - 1.5m)</option>
                  <option value="grande">Grande (2x - 3m)</option>
                  <option value="enorme">Enorme (3x - 4.5m)</option>
                </select>
              </div>

              <div>
                <label for="player-token-color" class="text-zinc-400 block mb-1">Cor do Anel:</label>
                <div class="flex items-center h-8 gap-2">
                  <input
                    id="player-token-color"
                    type="color"
                    bind:value={playerColorInput}
                    class="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <span class="text-xs font-mono text-zinc-400">{playerColorInput}</span>
                </div>
              </div>
            </div>

            <!-- PV & SAN -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label for="player-token-pv" class="text-zinc-400 block mb-1">Pontos de Vida (PV):</label>
                <input
                  id="player-token-pv"
                  type="number"
                  bind:value={characterCurrentPv}
                  class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                />
              </div>
              <div>
                <label for="player-token-maxpv" class="text-zinc-400 block mb-1">PV Máximo:</label>
                <input
                  id="player-token-maxpv"
                  type="number"
                  bind:value={characterMaxPv}
                  class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                />
              </div>
            </div>

            <!-- Foto / Avatar do Token -->
            <div class="pt-1 border-t border-zinc-800 space-y-1">
              <span class="text-zinc-400 block mb-1">Foto / Retrato do Token:</span>
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-full border-2 border-dashed border-zinc-700 bg-zinc-950 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                  {#if playerImageUrl}
                    <img src={playerImageUrl} alt="Preview" class="w-full h-full object-cover" />
                  {:else if myToken?.imageUrl}
                    <img src={myToken.imageUrl} alt={myToken.name} class="w-full h-full object-cover" />
                  {:else}
                    <User class="w-6 h-6 text-zinc-600" />
                  {/if}
                </div>
                <div class="flex-1 flex flex-col gap-1">
                  <input
                    type="file"
                    accept="image/*"
                    onchange={async (e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.files && target.files[0]) {
                        playerImageUrl = await compressImageToDataUrl(target.files[0], 256, 0.85);
                      }
                    }}
                    class="text-[11px] text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                  />
                  {#if playerImageUrl || myToken?.imageUrl}
                    <button
                      type="button"
                      onclick={() => (playerImageUrl = undefined)}
                      class="text-[10px] text-rose-400 hover:text-rose-300 text-left cursor-pointer"
                    >
                      Remover Foto
                    </button>
                  {/if}
                </div>
              </div>
            </div>

            <button
              type="button"
              onclick={handleSavePlayerToken}
              class="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Check class="w-4 h-4 stroke-[2.5]" />
              <span>{myToken ? 'Guardar Alterações' : 'Colocar Token na Mesa'}</span>
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
