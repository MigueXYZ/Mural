<!--
  src/lib/components/vtt/GmVttPanel.svelte
  
  Mural Tactical Virtual Tabletop (VTT) - GM Host Master Screen
  Provides the Game Master with complete authority over the battlemap canvas,
  fog of war brush/polygon revelation, token spawning and stealth control,
  room code broadcast, combat initiative, and real-time P2P sync.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { vttP2P } from '../../services/vtt/vttP2PService.svelte';
  import { createCombatEncounter, sortCombatants, compressImageToDataUrl } from '../../services/vtt/vttProtocol';
  import type { VttScene, VttToken, FogAction } from '../../types/vtt';
  import VttCanvas from './VttCanvas.svelte';
  import InitiativeTracker from './InitiativeTracker.svelte';
  import DiceRollDrawer from './DiceRollDrawer.svelte';
  import {
    Radio,
    Eye,
    EyeOff,
    Paintbrush,
    Square,
    Ruler,
    Dices,
    Swords,
    Plus,
    Copy,
    Check,
    Users,
    Upload,
    RotateCcw,
    Sparkles,
    Trash2,
    Compass,
    Sliders,
    Layers,
    Image,
    Maximize2,
    Settings,
    X,
    ChevronDown,
    MapPin,
    BoxSelect,
    User,
  } from 'lucide-svelte';

  let activeTool = $state<
    | 'select'
    | 'pan'
    | 'ruler'
    | 'aoe_circle'
    | 'aoe_cone'
    | 'aoe_line'
    | 'ping'
    | 'fog_brush_reveal'
    | 'fog_brush_hide'
    | 'fog_rect_reveal'
    | 'fog_rect_hide'
  >('select');

  let brushRadius = $state(60);
  let showGrid = $state(true);
  let selectedTokenId = $state<string | null>(null);
  let isDiceDrawerOpen = $state(false);
  let isTokenModalOpen = $state(false);
  let isSceneModalOpen = $state(false);
  let isMapSettingsOpen = $state(false);
  let isInitiativeOpen = $state(false);
  let isFogMenuOpen = $state(false);
  let isMeasureMenuOpen = $state(false);
  let hasCopiedCode = $state(false);
  let canvasRef: any = $state(null);

  const isFogActive = $derived(
    activeTool === 'fog_brush_reveal' ||
    activeTool === 'fog_brush_hide' ||
    activeTool === 'fog_rect_reveal' ||
    activeTool === 'fog_rect_hide'
  );

  const fogLabel = $derived.by(() => {
    switch (activeTool) {
      case 'fog_brush_reveal':
        return 'Pincel Revelar';
      case 'fog_brush_hide':
        return 'Pincel Ocultar';
      case 'fog_rect_reveal':
        return 'Caixa Revelar';
      case 'fog_rect_hide':
        return 'Caixa Ocultar';
      default:
        return 'Névoa';
    }
  });

  const isMeasureActive = $derived(
    activeTool === 'ruler' || activeTool === 'aoe_cone' || activeTool === 'aoe_circle' || activeTool === 'aoe_line'
  );

  const measureLabel = $derived.by(() => {
    switch (activeTool) {
      case 'ruler':
        return 'Régua (1.5m)';
      case 'aoe_cone':
        return 'Cone';
      case 'aoe_circle':
        return 'Círculo';
      default:
        return 'Medição';
    }
  });

  // New token form state
  let tokenName = $state('Criatura');
  let tokenSize = $state<'pequeno' | 'medio' | 'grande' | 'enorme'>('medio');
  let tokenHp = $state(30);
  let tokenMaxHp = $state(30);
  let tokenSan = $state(0);
  let tokenMaxSan = $state(0);
  let tokenIsStealth = $state(false);
  let tokenColor = $state('#f87171');
  let tokenImageUrl = $state<string | undefined>(undefined);

  // New scene form state
  let newSceneName = $state('Masmorra Subterrânea');

  // Background map file input
  let mapFileInput: HTMLInputElement;

  const isConnected = $derived(vttP2P.isConnected && vttP2P.isHost);
  const roomCode = $derived(vttP2P.roomCode);
  const connectedCount = $derived(vttP2P.connectedCount);

  // Multi-scene battlemap registry
  let scenes = $state<VttScene[]>([
    {
      id: 'scene-1',
      name: 'Entrada do Castelo',
      width: 2800,
      height: 2000,
      scaleRatio: 46.6667,
      gridless: true,
      backgroundUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=2000&q=80',
      fogActions: [],
      tokens: [
        {
          id: 'tok-hero-1',
          name: 'Agente Investigador',
          size: 'medio',
          x: 600,
          y: 600,
          color: '#38bdf8',
          pv: { current: 24, max: 24 },
          san: { current: 35, max: 35 },
          isStealth: false,
          conditions: [],
        },
        {
          id: 'tok-monster-1',
          name: 'Zumbi de Sangue',
          size: 'medio',
          x: 900,
          y: 600,
          color: '#ef4444',
          pv: { current: 40, max: 40 },
          san: { current: 0, max: 0 },
          isStealth: false,
          conditions: [],
        },
      ],
    },
  ]);

  let activeSceneIndex = $state(0);
  let localScene = $derived(scenes[activeSceneIndex] || scenes[0]);

  onMount(async () => {
    // Automatically initialize GM room if not already running
    if (!vttP2P.isConnected) {
      await vttP2P.createRoom();
      vttP2P.syncScene(localScene);
    } else if (!vttP2P.activeScene) {
      vttP2P.syncScene(localScene);
    } else {
      // If host already had a scene synced, keep it
      const current = vttP2P.activeScene;
      if (current) {
        const found = scenes.findIndex((s) => s.id === current.id);
        if (found >= 0) {
          activeSceneIndex = found;
        } else {
          scenes = [current, ...scenes];
          activeSceneIndex = 0;
        }
      }
    }
  });

  function copyRoomCode() {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    hasCopiedCode = true;
    setTimeout(() => (hasCopiedCode = false), 2000);
  }

  async function handleMapUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      try {
        const dataUrl = await compressImageToDataUrl(file, 2560, 0.82);
        const img = new window.Image();
        img.onload = () => {
          const scene = scenes[activeSceneIndex];
          if (scene) {
            scene.backgroundUrl = dataUrl;
            scene.name = file.name.replace(/\.[^/.]+$/, '');
            if (img.naturalWidth && img.naturalHeight) {
              scene.width = img.naturalWidth;
              scene.height = img.naturalHeight;
            }
            vttP2P.syncScene(scene);
            setTimeout(() => canvasRef?.fitToScreen?.(), 60);
          }
        };
        img.src = dataUrl;
      } catch (err) {
        console.error('Falha ao processar mapa:', err);
      }
    }
  }

  function handleSelectScene(index: number) {
    activeSceneIndex = index;
    vttP2P.syncScene(scenes[activeSceneIndex]);
    isSceneModalOpen = false;
    setTimeout(() => canvasRef?.fitToScreen?.(), 60);
  }

  function handleCreateScene() {
    const id = `scene-${Date.now()}`;
    const newScene: VttScene = {
      id,
      name: newSceneName.trim() || `Mapa ${scenes.length + 1}`,
      width: 2400,
      height: 1800,
      scaleRatio: 46.6667,
      gridless: true,
      backgroundUrl: '',
      fogActions: [],
      tokens: [],
    };
    scenes = [...scenes, newScene];
    activeSceneIndex = scenes.length - 1;
    vttP2P.syncScene(newScene);
    newSceneName = 'Novo Mapa';
    isSceneModalOpen = false;
  }

  function handleDeleteScene(index: number) {
    if (scenes.length <= 1) return;
    const name = scenes[index].name;
    if (confirm(`Tens a certeza que desejas eliminar o mapa "${name}"?`)) {
      scenes = scenes.filter((_, i) => i !== index);
      if (activeSceneIndex >= scenes.length) {
        activeSceneIndex = scenes.length - 1;
      }
      vttP2P.syncScene(scenes[activeSceneIndex]);
      setTimeout(() => canvasRef?.fitToScreen?.(), 60);
    }
  }

  function handleDuplicateScene(index: number) {
    const src = scenes[index];
    const copy: VttScene = {
      ...JSON.parse(JSON.stringify(src)),
      id: `scene-${Date.now()}`,
      name: `${src.name} (Cópia)`,
    };
    scenes = [...scenes, copy];
    activeSceneIndex = scenes.length - 1;
    vttP2P.syncScene(copy);
    setTimeout(() => canvasRef?.fitToScreen?.(), 60);
  }

  function handleSceneUpdate(patch: Partial<VttScene>) {
    const scene = scenes[activeSceneIndex];
    if (scene) {
      Object.assign(scene, patch);
      vttP2P.syncScene(scene);
    }
  }

  function handleScaleMap(scaleFactor: number) {
    const scene = scenes[activeSceneIndex];
    if (scene) {
      scene.width = Math.round(scene.width * scaleFactor);
      scene.height = Math.round(scene.height * scaleFactor);
      vttP2P.syncScene(scene);
      setTimeout(() => canvasRef?.fitToScreen?.(), 60);
    }
  }

  function handleResetNaturalDimensions() {
    const scene = scenes[activeSceneIndex];
    if (!scene || !scene.backgroundUrl) return;
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        scene.width = img.naturalWidth;
        scene.height = img.naturalHeight;
        vttP2P.syncScene(scene);
        setTimeout(() => canvasRef?.fitToScreen?.(), 60);
      }
    };
    img.src = scene.backgroundUrl;
  }

  function handleAddToken() {
    if (!tokenName.trim()) return;

    const newToken: VttToken = {
      id: `token-${Date.now()}`,
      name: tokenName.trim(),
      size: tokenSize,
      x: 700 + Math.random() * 100,
      y: 700 + Math.random() * 100,
      color: tokenColor,
      imageUrl: tokenImageUrl,
      pv: { current: Number(tokenHp) || 20, max: Number(tokenMaxHp) || 20 },
      san: { current: Number(tokenSan) || 0, max: Number(tokenMaxSan) || 0 },
      isStealth: tokenIsStealth,
      conditions: [],
    };

    localScene.tokens = [...localScene.tokens, newToken];
    vttP2P.syncScene(localScene);
    isTokenModalOpen = false;
    tokenName = 'Criatura';
    tokenImageUrl = undefined;
  }

  function handleDeleteToken(id: string) {
    localScene.tokens = localScene.tokens.filter((t) => t.id !== id);
    vttP2P.syncScene(localScene);
  }

  function handleToggleStealth(token: VttToken) {
    token.isStealth = !token.isStealth;
    vttP2P.syncScene(localScene);
  }

  function handleFogAction(action: FogAction) {
    localScene.fogActions = [...localScene.fogActions, action];
    vttP2P.sendFogAction(action);
  }

  function handleResetFog() {
    if (confirm('Desejas repor toda a Névoa de Guerra no mapa?')) {
      localScene.fogActions = [];
      vttP2P.syncScene(localScene);
    }
  }

  function handleBlanketFog() {
    const action: FogAction = {
      id: `fog-${Date.now()}-blanket`,
      type: 'blanket_all',
      timestamp: Date.now(),
    };
    handleFogAction(action);
  }

  function handleClearFog() {
    const action: FogAction = {
      id: `fog-${Date.now()}-clear`,
      type: 'clear_all',
      timestamp: Date.now(),
    };
    handleFogAction(action);
  }

  function handleTokenMove(tokenId: string, x: number, y: number, isFinal: boolean) {
    const token = localScene.tokens.find((t) => t.id === tokenId);
    if (token) {
      token.x = x;
      token.y = y;
      vttP2P.sendTokenMove(tokenId, x, y, 0, isFinal);
    }
  }

  function handlePing(point: { x: number; y: number }) {
    vttP2P.sendPing(point.x, point.y);
  }
</script>

<div class="h-full w-full bg-[#07090d] text-zinc-100 flex flex-col overflow-hidden relative font-sans select-none">
  <!-- Top GM VTT Toolbar -->
  <!-- Top GM VTT Toolbar (Ultra-clean & uncluttered) -->
  <header class="h-13 bg-zinc-950/95 border-b border-zinc-800 px-3.5 flex items-center justify-between z-20 flex-shrink-0 backdrop-blur-md">
    <!-- Left: Room Code & Map Selector -->
    <div class="flex items-center gap-2">
      <!-- P2P Session Code Badge -->
      <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 shadow-sm">
        <Radio class="w-3.5 h-3.5 text-amber-400 animate-pulse flex-shrink-0" />
        <span class="text-[11px] font-mono font-bold text-amber-400">{roomCode}</span>
        <button
          type="button"
          onclick={copyRoomCode}
          title="Copiar Código de Sala"
          class="p-0.5 rounded text-zinc-400 hover:text-amber-300 transition cursor-pointer"
        >
          {#if hasCopiedCode}
            <Check class="w-3 h-3 text-emerald-400" />
          {:else}
            <Copy class="w-3 h-3" />
          {/if}
        </button>
        <div class="w-[1px] h-3 bg-zinc-800"></div>
        <div class="flex items-center gap-1 text-[10px] text-zinc-500 font-mono" title="{connectedCount} jogador(es) conectado(s)">
          <Users class="w-3 h-3 text-sky-400" />
          <span>{connectedCount}</span>
        </div>
      </div>

      <!-- Hidden file input for battlemap upload -->
      <input
        type="file"
        accept="image/*"
        bind:this={mapFileInput}
        onchange={handleMapUpload}
        class="hidden"
      />

      <!-- Scene / Map Switcher Button -->
      <button
        type="button"
        onclick={() => (isSceneModalOpen = true)}
        class="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm max-w-[180px]"
        title="Gerir e Trocar de Mapas"
      >
        <Layers class="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        <span class="truncate">{localScene.name}</span>
        <ChevronDown class="w-3 h-3 text-zinc-500 flex-shrink-0" />
      </button>

      <!-- Map Settings & Dimensions Button -->
      <button
        type="button"
        onclick={() => (isMapSettingsOpen = true)}
        class="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 transition cursor-pointer shadow-sm"
        title="Configurações e Dimensões do Mapa ({localScene.width}×{localScene.height}px)"
      >
        <Sliders class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Center: Tactical Tool Selector (Clean Compact Segmented Bar) -->
    <div class="relative flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5 gap-1 text-xs shadow-inner">
      <!-- Mover -->
      <button
        type="button"
        onclick={() => {
          activeTool = 'select';
          isFogMenuOpen = false;
          isMeasureMenuOpen = false;
        }}
        class="px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 {activeTool === 'select' ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
        title="Mover e Selecionar Tokens"
      >
        <span>Mover</span>
      </button>

      <div class="w-[1px] h-4 bg-zinc-800"></div>

      <!-- Névoa Group (Dropdown / Popover) -->
      <div class="relative">
        <button
          type="button"
          onclick={() => {
            isFogMenuOpen = !isFogMenuOpen;
            isMeasureMenuOpen = false;
          }}
          class="px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 {isFogActive ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'}"
          title="Ferramentas de Névoa de Guerra (Pincel, Caixa, Balde)"
        >
          {#if activeTool === 'fog_rect_reveal' || activeTool === 'fog_rect_hide'}
            <BoxSelect class="w-3.5 h-3.5" />
          {:else}
            <Paintbrush class="w-3.5 h-3.5" />
          {/if}
          <span>{fogLabel}</span>
          <ChevronDown class="w-3 h-3 text-zinc-400 {isFogActive ? 'text-zinc-950' : ''} transition-transform {isFogMenuOpen ? 'rotate-180' : ''}" />
        </button>

        {#if isFogMenuOpen}
          <!-- Backdrop to close -->
          <div
            class="fixed inset-0 z-40"
            onclick={() => (isFogMenuOpen = false)}
            onkeydown={() => (isFogMenuOpen = false)}
            tabindex="-1"
            role="presentation"
          ></div>

          <!-- Flyout Menu -->
          <div class="absolute top-full mt-1.5 left-0 z-50 w-52 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl p-1.5 text-xs space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95">
            <div class="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Desenhar Névoa</div>

            <button
              type="button"
              onclick={() => { activeTool = 'fog_brush_reveal'; isFogMenuOpen = false; }}
              class="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-zinc-800 transition cursor-pointer {activeTool === 'fog_brush_reveal' ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-zinc-300'}"
            >
              <Paintbrush class="w-3.5 h-3.5 text-amber-400" />
              <span>Pincel Revelar</span>
            </button>

            <button
              type="button"
              onclick={() => { activeTool = 'fog_brush_hide'; isFogMenuOpen = false; }}
              class="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-zinc-800 transition cursor-pointer {activeTool === 'fog_brush_hide' ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-zinc-300'}"
            >
              <Paintbrush class="w-3.5 h-3.5 text-zinc-400 rotate-180" />
              <span>Pincel Ocultar</span>
            </button>

            <button
              type="button"
              onclick={() => { activeTool = 'fog_rect_reveal'; isFogMenuOpen = false; }}
              class="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-zinc-800 transition cursor-pointer {activeTool === 'fog_rect_reveal' ? 'bg-cyan-500/15 text-cyan-300 font-semibold' : 'text-zinc-300'}"
            >
              <BoxSelect class="w-3.5 h-3.5 text-cyan-400" />
              <span>Caixa Revelar (Área)</span>
            </button>

            <button
              type="button"
              onclick={() => { activeTool = 'fog_rect_hide'; isFogMenuOpen = false; }}
              class="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-zinc-800 transition cursor-pointer {activeTool === 'fog_rect_hide' ? 'bg-rose-500/15 text-rose-300 font-semibold' : 'text-zinc-300'}"
            >
              <Square class="w-3.5 h-3.5 text-rose-400" />
              <span>Caixa Ocultar (Área)</span>
            </button>

            <div class="my-1 border-t border-zinc-800"></div>
            <div class="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Ações Globais (Balde)</div>

            <button
              type="button"
              onclick={() => { handleBlanketFog(); isFogMenuOpen = false; }}
              class="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-zinc-800 text-rose-300 transition cursor-pointer"
            >
              <EyeOff class="w-3.5 h-3.5 text-rose-400" />
              <span>Ocultar Mapa Todo</span>
            </button>

            <button
              type="button"
              onclick={() => { handleClearFog(); isFogMenuOpen = false; }}
              class="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-zinc-800 text-cyan-300 transition cursor-pointer"
            >
              <Eye class="w-3.5 h-3.5 text-cyan-400" />
              <span>Revelar Mapa Todo</span>
            </button>

            <button
              type="button"
              onclick={() => { handleResetFog(); isFogMenuOpen = false; }}
              class="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              <RotateCcw class="w-3.5 h-3.5" />
              <span>Repor Névoa Inicial</span>
            </button>
          </div>
        {/if}
      </div>

      <div class="w-[1px] h-4 bg-zinc-800"></div>

      <!-- Medição & Áreas de Efeito (Dropdown / Popover) -->
      <div class="relative">
        <button
          type="button"
          onclick={() => {
            isMeasureMenuOpen = !isMeasureMenuOpen;
            isFogMenuOpen = false;
          }}
          class="px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 {isMeasureActive ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'}"
          title="Régua e Formas de Área de Efeito"
        >
          <Ruler class="w-3.5 h-3.5" />
          <span>{measureLabel}</span>
          <ChevronDown class="w-3 h-3 text-zinc-400 {isMeasureActive ? 'text-zinc-950' : ''} transition-transform {isMeasureMenuOpen ? 'rotate-180' : ''}" />
        </button>

        {#if isMeasureMenuOpen}
          <!-- Backdrop to close -->
          <div
            class="fixed inset-0 z-40"
            onclick={() => (isMeasureMenuOpen = false)}
            onkeydown={() => (isMeasureMenuOpen = false)}
            tabindex="-1"
            role="presentation"
          ></div>

          <!-- Flyout Menu -->
          <div class="absolute top-full mt-1.5 left-0 z-50 w-48 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl p-1.5 text-xs space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95">
            <button
              type="button"
              onclick={() => { activeTool = 'ruler'; isMeasureMenuOpen = false; }}
              class="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-zinc-800 transition cursor-pointer {activeTool === 'ruler' ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-zinc-300'}"
            >
              <Ruler class="w-3.5 h-3.5 text-amber-400" />
              <span>Régua (1.5m)</span>
            </button>

            <button
              type="button"
              onclick={() => { activeTool = 'aoe_cone'; isMeasureMenuOpen = false; }}
              class="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-zinc-800 transition cursor-pointer {activeTool === 'aoe_cone' ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-zinc-300'}"
            >
              <span class="text-amber-400 font-bold">▲</span>
              <span>Cone de Efeito</span>
            </button>

            <button
              type="button"
              onclick={() => { activeTool = 'aoe_circle'; isMeasureMenuOpen = false; }}
              class="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-zinc-800 transition cursor-pointer {activeTool === 'aoe_circle' ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-zinc-300'}"
            >
              <span class="text-amber-400 font-bold">●</span>
              <span>Círculo de Explosão</span>
            </button>
          </div>
        {/if}
      </div>

      <div class="w-[1px] h-4 bg-zinc-800"></div>

      <!-- Ping Tool -->
      <button
        type="button"
        onclick={() => {
          activeTool = 'ping';
          isFogMenuOpen = false;
          isMeasureMenuOpen = false;
        }}
        class="px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 {activeTool === 'ping' ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'}"
        title="Radar / Ping no Mapa"
      >
        <Compass class="w-3.5 h-3.5" />
        <span>Ping</span>
      </button>
    </div>

    <!-- Right: Add Token, Initiative & Dice Drawer -->
    <div class="flex items-center gap-2">
      <!-- Add Token Button -->
      <button
        type="button"
        onclick={() => (isTokenModalOpen = true)}
        class="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
      >
        <Plus class="w-3.5 h-3.5 text-amber-400" />
        <span>Token</span>
      </button>

      <!-- Combat Initiative Tracker Toggle Button -->
      <button
        type="button"
        onclick={() => (isInitiativeOpen = !isInitiativeOpen)}
        class="px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm {isInitiativeOpen ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-amber-500/20' : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800'}"
        title="Abrir / Fechar Painel de Iniciativa de Combate"
      >
        <Swords class="w-3.5 h-3.5" />
        <span>Iniciativa</span>
        {#if vttP2P.encounter?.isRunning}
          <span class="px-1.5 py-0.5 rounded-full bg-emerald-400 text-zinc-950 text-[10px] font-mono font-black">
            R{vttP2P.encounter.round}
          </span>
        {/if}
      </button>

      <!-- Dice Drawer Button -->
      <button
        type="button"
        onclick={() => (isDiceDrawerOpen = true)}
        class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md shadow-amber-500/20"
      >
        <Dices class="w-3.5 h-3.5" />
        <span>Rolar Dados</span>
      </button>
    </div>
  </header>

  <!-- Main Tactical Viewport -->
  <main class="flex-1 relative overflow-hidden">
    <VttCanvas
      bind:this={canvasRef}
      scene={localScene}
      isGm={true}
      myPeerId={vttP2P.localPeerId}
      {activeTool}
      {brushRadius}
      {showGrid}
      pings={vttP2P.recentPings}
      {selectedTokenId}
      onTokenMove={handleTokenMove}
      onTokenSelect={(id) => (selectedTokenId = id)}
      onFogAction={handleFogAction}
      onPing={handlePing}
      onSceneUpdate={handleSceneUpdate}
    />
  </main>

  <!-- Initiative Combat Tracker (GM Authority Mode, Draggable & Independent) -->
  <InitiativeTracker
    bind:isOpen={isInitiativeOpen}
    isGm={true}
    myPeerId={vttP2P.localPeerId}
  />

  <!-- Live Dice Roll Drawer -->
  <DiceRollDrawer
    bind:isOpen={isDiceDrawerOpen}
    playerName="Mestre"
    characterName="Mestre (Mural)"
  />
</div>

<!-- ========================================================================= -->
<!-- Modal: Gestor de Mapas / Cenas                                            -->
<!-- ========================================================================= -->
{#if isSceneModalOpen}
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
      <div class="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div class="flex items-center gap-2">
          <Layers class="w-5 h-5 text-amber-400" />
          <h3 class="text-sm font-bold text-zinc-100">Gestor de Mapas & Cenas</h3>
        </div>
        <button
          type="button"
          onclick={() => (isSceneModalOpen = false)}
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Lista de Cenas Existentes -->
      <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
        {#each scenes as scene, index (scene.id)}
          {@const isActive = index === activeSceneIndex}
          <div
            class="p-3 rounded-xl border flex items-center justify-between gap-3 transition {isActive
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'}"
          >
            <!-- Thumbnail / Icon -->
            <div class="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {#if scene.backgroundUrl}
                <img src={scene.backgroundUrl} alt={scene.name} class="w-full h-full object-cover" />
              {:else}
                <Image class="w-5 h-5 text-zinc-500" />
              {/if}
            </div>

            <!-- Scene Details -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs text-zinc-100 truncate">{scene.name}</span>
                {#if isActive}
                  <span class="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                    Ativa
                  </span>
                {/if}
              </div>
              <div class="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5 font-mono">
                <span>{scene.width}×{scene.height}px</span>
                <span>•</span>
                <span>{scene.tokens.length} {scene.tokens.length === 1 ? 'token' : 'tokens'}</span>
              </div>
            </div>

            <!-- Scene Actions -->
            <div class="flex items-center gap-1 flex-shrink-0">
              {#if !isActive}
                <button
                  type="button"
                  onclick={() => handleSelectScene(index)}
                  class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition cursor-pointer"
                >
                  Ativar
                </button>
              {/if}

              <button
                type="button"
                onclick={() => handleDuplicateScene(index)}
                title="Duplicar Mapa"
                class="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>

              {#if scenes.length > 1}
                <button
                  type="button"
                  onclick={() => handleDeleteScene(index)}
                  title="Eliminar Mapa"
                  class="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Criar Novo Mapa -->
      <div class="pt-3 border-t border-zinc-800 flex items-center gap-2">
        <input
          type="text"
          bind:value={newSceneName}
          placeholder="Nome do novo mapa..."
          class="flex-1 h-9 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onclick={handleCreateScene}
          class="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer flex-shrink-0"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Novo Mapa</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ========================================================================= -->
<!-- Modal: Configurações & Dimensões do Mapa                                  -->
<!-- ========================================================================= -->
{#if isMapSettingsOpen}
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
      <div class="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div class="flex items-center gap-2">
          <Sliders class="w-4 h-4 text-amber-400" />
          <h3 class="text-sm font-bold text-zinc-100">Dimensões do Mapa</h3>
        </div>
        <button
          type="button"
          onclick={() => (isMapSettingsOpen = false)}
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="space-y-3 text-xs">
        <div>
          <label for="scene-name-edit" class="text-zinc-400 block mb-1">Nome do Mapa:</label>
          <input
            id="scene-name-edit"
            type="text"
            bind:value={localScene.name}
            onchange={() => vttP2P.syncScene(localScene)}
            class="w-full h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="scene-width-input" class="text-zinc-400 block mb-1">Largura (px):</label>
            <input
              id="scene-width-input"
              type="number"
              bind:value={localScene.width}
              step="50"
              min="500"
              max="10000"
              onchange={() => {
                vttP2P.syncScene(localScene);
                setTimeout(() => canvasRef?.fitToScreen?.(), 60);
              }}
              class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
            />
          </div>
          <div>
            <label for="scene-height-input" class="text-zinc-400 block mb-1">Altura (px):</label>
            <input
              id="scene-height-input"
              type="number"
              bind:value={localScene.height}
              step="50"
              min="500"
              max="10000"
              onchange={() => {
                vttP2P.syncScene(localScene);
                setTimeout(() => canvasRef?.fitToScreen?.(), 60);
              }}
              class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
            />
          </div>
        </div>

        <!-- Escala Rápida -->
        <div>
          <span class="text-zinc-400 block mb-1.5">Ajustar Escala Rápida:</span>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onclick={() => handleScaleMap(0.75)}
              class="py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition cursor-pointer"
            >
              -25%
            </button>
            <button
              type="button"
              onclick={() => handleScaleMap(1.25)}
              class="py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition cursor-pointer"
            >
              +25%
            </button>
            <button
              type="button"
              onclick={() => handleScaleMap(1.5)}
              class="py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition cursor-pointer"
            >
              +50%
            </button>
            <button
              type="button"
              onclick={() => handleScaleMap(2.0)}
              class="py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition cursor-pointer"
            >
              2x
            </button>
          </div>
        </div>

        <!-- Ações do Mapa -->
        <div class="pt-2 border-t border-zinc-800 space-y-2">
          {#if localScene.backgroundUrl}
            <button
              type="button"
              onclick={handleResetNaturalDimensions}
              class="w-full py-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Image class="w-3.5 h-3.5 text-amber-400" />
              <span>Restaurar Resolução Real (1:1)</span>
            </button>
          {/if}

          <button
            type="button"
            onclick={() => {
              canvasRef?.fitToScreen?.();
              isMapSettingsOpen = false;
            }}
            class="w-full py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Maximize2 class="w-3.5 h-3.5" />
            <span>Enquadrar Mapa no Ecrã (Fit)</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Modal: Criar / Adicionar Token -->
{#if isTokenModalOpen}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
      <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
        <Plus class="w-4 h-4 text-amber-400" />
        <span>Adicionar Token à Mesa</span>
      </h3>

      <div class="space-y-3 text-xs">
        <div>
          <label for="gm-token-name" class="text-zinc-400 block mb-1">Nome:</label>
          <input
            id="gm-token-name"
            type="text"
            bind:value={tokenName}
            placeholder="Ex: Cultista da Morte / Criatura de Sangue"
            class="w-full h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label for="gm-token-size" class="text-zinc-400 block mb-1">Tamanho:</label>
            <select
              id="gm-token-size"
              bind:value={tokenSize}
              class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            >
              <option value="pequeno">Pequeno (0.8x)</option>
              <option value="medio">Médio (1x - 1.5m)</option>
              <option value="grande">Grande (2x - 3m)</option>
              <option value="enorme">Enorme (3x - 4.5m)</option>
            </select>
          </div>

          <div>
            <label for="gm-token-color" class="text-zinc-400 block mb-1">Cor do Anel:</label>
            <div class="flex items-center h-8 gap-2">
              <input
                id="gm-token-color"
                type="color"
                bind:value={tokenColor}
                class="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
              />
              <span class="text-xs font-mono text-zinc-400">{tokenColor}</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label for="gm-token-hp" class="text-zinc-400 block mb-1">Pontos de Vida (PV):</label>
            <input
              id="gm-token-hp"
              type="number"
              bind:value={tokenHp}
              class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
            />
          </div>
          <div>
            <label for="gm-token-maxhp" class="text-zinc-400 block mb-1">PV Máximo:</label>
            <input
              id="gm-token-maxhp"
              type="number"
              bind:value={tokenMaxHp}
              class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
            />
          </div>
        </div>

        <!-- Token Portrait / Imagem do Token -->
        <div>
          <span class="text-zinc-400 block mb-1">Retrato / Foto do Token:</span>
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-full border-2 border-dashed border-zinc-700 bg-zinc-950 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
              {#if tokenImageUrl}
                <img src={tokenImageUrl} alt="Token preview" class="w-full h-full object-cover" />
              {:else}
                <User class="w-5 h-5 text-zinc-600" />
              {/if}
            </div>
            <div class="flex-1 flex flex-col gap-1">
              <input
                type="file"
                accept="image/*"
                onchange={async (e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.files && target.files[0]) {
                    tokenImageUrl = await compressImageToDataUrl(target.files[0], 256, 0.85);
                  }
                }}
                class="text-[11px] text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
              />
              {#if tokenImageUrl}
                <button
                  type="button"
                  onclick={() => (tokenImageUrl = undefined)}
                  class="text-[10px] text-rose-400 hover:text-rose-300 text-left cursor-pointer"
                >
                  Remover Imagem
                </button>
              {/if}
            </div>
          </div>
        </div>

        <!-- Stealth / Furtivo Toggle -->
        <div class="pt-2 border-t border-zinc-800">
          <label class="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
            <div class="flex items-center gap-2">
              {#if tokenIsStealth}
                <EyeOff class="w-4 h-4 text-rose-400" />
                <span class="text-rose-300 font-bold">Furtivo / Oculto</span>
              {:else}
                <Eye class="w-4 h-4 text-emerald-400" />
                <span class="text-zinc-300">Visível para Jogadores</span>
              {/if}
            </div>
            <input
              type="checkbox"
              bind:checked={tokenIsStealth}
              class="accent-amber-400 w-4 h-4 rounded cursor-pointer"
            />
          </label>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
        <button
          type="button"
          onclick={() => (isTokenModalOpen = false)}
          class="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onclick={handleAddToken}
          class="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition cursor-pointer shadow-md shadow-amber-500/20"
        >
          Criar Token
        </button>
      </div>
    </div>
  </div>
{/if}
