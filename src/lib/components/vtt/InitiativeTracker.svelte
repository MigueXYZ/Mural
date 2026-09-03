<!--
  src/lib/components/vtt/InitiativeTracker.svelte
  
  Mural Tactical Combat Initiative Tracker
  Milestone 4: Combat encounter management, turn ordering, round tracking,
  and real-time P2P synchronization across GM and connected players.
-->
<script lang="ts">
  import { vttP2P } from '../../services/vtt/vttP2PService.svelte';
  import {
    sortCombatants,
    advanceTurn,
    previousTurn,
    createCombatEncounter,
  } from '../../services/vtt/vttProtocol';
  import type { CombatEncounter, Combatant } from '../../types/vtt';
  import {
    Swords,
    ChevronRight,
    ChevronLeft,
    Plus,
    Trash2,
    Shield,
    Heart,
    ChevronDown,
    ChevronUp,
    Play,
    Square,
    RefreshCw,
    User,
    Skull,
    X,
    GripVertical,
  } from 'lucide-svelte';

  interface Props {
    isGm?: boolean;
    myCharacterId?: string;
    myPeerId?: string;
    isOpen?: boolean;
    onClose?: () => void;
  }

  let {
    isGm = false,
    myCharacterId = '',
    myPeerId = '',
    isOpen = $bindable(true),
    onClose,
  }: Props = $props();

  let isCollapsed = $state(false);
  let isAddModalOpen = $state(false);

  // Freeform draggable position (defaults to top-left of canvas, never blocking right sidebar)
  let posX = $state(80);
  let posY = $state(68);
  let isDragging = $state(false);
  let dragOffset = $state({ x: 0, y: 0 });

  function handlePointerDown(e: PointerEvent) {
    // Only drag from header background, not buttons
    if ((e.target as HTMLElement).closest('button')) return;
    isDragging = true;
    dragOffset = {
      x: e.clientX - posX,
      y: e.clientY - posY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const maxX = Math.max(10, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 320);
    const maxY = Math.max(10, (typeof window !== 'undefined' ? window.innerHeight : 800) - 80);
    posX = Math.max(10, Math.min(maxX, e.clientX - dragOffset.x));
    posY = Math.max(10, Math.min(maxY, e.clientY - dragOffset.y));
  }

  function handlePointerUp(e: PointerEvent) {
    if (isDragging) {
      isDragging = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  }

  function closeTracker() {
    isOpen = false;
    onClose?.();
  }

  // Form state for adding combatant
  let newName = $state('');
  let newInitiative = $state(10);
  let newHp = $state(20);
  let newMaxHp = $state(20);
  let newIsPlayer = $state(false);
  let newColor = $state('#38bdf8');

  const encounter = $derived(vttP2P.encounter);
  const activeCombatant = $derived(vttP2P.activeCombatant);
  const isMyTurn = $derived(
    activeCombatant &&
      !isGm &&
      ((myCharacterId && activeCombatant.characterId === myCharacterId) ||
        (myPeerId && activeCombatant.peerId === myPeerId))
  );

  function handleStartCombat() {
    const tokens = vttP2P.activeScene?.tokens || [];
    const combatants: Combatant[] = tokens
      .filter((t) => !t.isStealth) // Don't expose stealth creatures directly
      .map((t) => ({
        id: `comb-${t.id}`,
        tokenId: t.id,
        characterId: t.characterId,
        name: t.name,
        initiative: 10 + Math.floor(Math.random() * 10),
        hp: { current: t.pv.current, max: t.pv.max },
        san: { current: t.san.current, max: t.san.max },
        isPlayer: Boolean(t.ownerPeerId || t.characterId),
        isDefeated: false,
        color: t.color || '#38bdf8',
        conditions: [...(t.conditions || [])],
      }));

    const newEnc: CombatEncounter = {
      ...createCombatEncounter('Combate Tático'),
      combatants: sortCombatants(combatants),
      isRunning: true,
    };

    vttP2P.sendInitiativeUpdate(newEnc);
  }

  function handleEndCombat() {
    if (confirm('Desejas encerrar o combate atual?')) {
      vttP2P.sendInitiativeUpdate(null);
    }
  }

  function handleNextTurn() {
    if (!encounter) return;
    const updated = advanceTurn(encounter);
    vttP2P.sendInitiativeUpdate(updated);
  }

  function handlePrevTurn() {
    if (!encounter) return;
    const updated = previousTurn(encounter);
    vttP2P.sendInitiativeUpdate(updated);
  }

  function handleAddCombatant() {
    if (!newName.trim() || !encounter) return;

    const newCombatant: Combatant = {
      id: `comb-${Date.now()}`,
      name: newName.trim(),
      initiative: Number(newInitiative) || 0,
      hp: { current: Number(newHp) || 20, max: Number(newMaxHp) || 20 },
      isPlayer: newIsPlayer,
      isDefeated: false,
      color: newColor,
      conditions: [],
    };

    const updatedList = sortCombatants([...encounter.combatants, newCombatant]);
    const updated: CombatEncounter = {
      ...encounter,
      combatants: updatedList,
      updatedAt: Date.now(),
    };

    vttP2P.sendInitiativeUpdate(updated);
    newName = '';
    isAddModalOpen = false;
  }

  function handleRemoveCombatant(id: string) {
    if (!encounter) return;
    const updatedList = encounter.combatants.filter((c) => c.id !== id);
    const updated: CombatEncounter = {
      ...encounter,
      combatants: updatedList,
      activeIndex: Math.min(encounter.activeIndex, Math.max(0, updatedList.length - 1)),
      updatedAt: Date.now(),
    };
    vttP2P.sendInitiativeUpdate(updated);
  }

  function handleSortRoster() {
    if (!encounter) return;
    const sorted = sortCombatants(encounter.combatants);
    vttP2P.sendInitiativeUpdate({
      ...encounter,
      combatants: sorted,
      activeIndex: 0,
      updatedAt: Date.now(),
    });
  }
</script>

{#if isOpen}
  <!-- Initiative Tracker Draggable Floating Box -->
  <div
    class="fixed z-40 w-72 rounded-2xl bg-zinc-950/95 border border-zinc-800/90 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col text-zinc-100 select-none transition-shadow duration-200 {isMyTurn ? 'ring-2 ring-amber-400 shadow-amber-500/20' : ''}"
    style="left: {posX}px; top: {posY}px;"
  >
    <!-- Header Bar (Draggable) -->
    <div
      role="region"
      aria-label="Controlo de Iniciativa Arrastável"
      class="px-3 py-2 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
    >
      <div class="flex items-center gap-1.5 min-w-0">
        <GripVertical class="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
        <div class="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
          <Swords class="w-3.5 h-3.5" />
        </div>
        <div class="min-w-0">
          <div class="text-xs font-bold leading-none flex items-center gap-1.5 truncate">
            <span class="truncate">{encounter ? encounter.name : 'Iniciativa'}</span>
            {#if encounter?.isRunning}
              <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-medium border border-emerald-500/30 flex-shrink-0">
                R{encounter.round}
              </span>
            {/if}
          </div>
          {#if isMyTurn}
            <span class="text-[10px] text-amber-400 font-bold animate-pulse block mt-0.5">É O TEU TURNO!</span>
          {/if}
        </div>
      </div>

      <div class="flex items-center gap-0.5 flex-shrink-0">
        {#if isGm && encounter}
          <button
            type="button"
            onclick={handleSortRoster}
            title="Reordenar por Iniciativa"
            class="p-1 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
          >
            <RefreshCw class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onclick={() => (isAddModalOpen = true)}
            title="Adicionar Participante"
            class="p-1 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5" />
          </button>
        {/if}

        <button
          type="button"
          onclick={() => (isCollapsed = !isCollapsed)}
          title={isCollapsed ? 'Expandir' : 'Recolher'}
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
        >
          {#if isCollapsed}
            <ChevronDown class="w-3.5 h-3.5" />
          {:else}
            <ChevronUp class="w-3.5 h-3.5" />
          {/if}
        </button>

        <button
          type="button"
          onclick={closeTracker}
          title="Fechar Rastreador"
          class="p-1 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition cursor-pointer"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

  <!-- Body Content -->
  {#if !isCollapsed}
    {#if !encounter || !encounter.isRunning}
      <!-- No active combat -->
      <div class="p-4 text-center space-y-2">
        <p class="text-xs text-zinc-400">Nenhum combate ativo de momento.</p>
        {#if isGm}
          <button
            type="button"
            onclick={handleStartCombat}
            class="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Play class="w-3.5 h-3.5 fill-current" />
            <span>Iniciar Combate com Tokens</span>
          </button>
        {/if}
      </div>
    {:else}
      <!-- Combatant Roster -->
      <div class="max-h-60 overflow-y-auto divide-y divide-zinc-800/50 p-1">
        {#each encounter.combatants as combatant, index (combatant.id)}
          {@const isActive = index === encounter.activeIndex}
          {@const isMe =
            !isGm &&
            ((myCharacterId && combatant.characterId === myCharacterId) ||
              (myPeerId && combatant.peerId === myPeerId))}

          <div
            class="px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 transition {isActive
              ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200 font-semibold'
              : isMe
              ? 'bg-sky-500/10 border border-sky-500/30 text-sky-200'
              : 'hover:bg-zinc-900/50 text-zinc-300'}"
          >
            <!-- Left: Avatar & Name -->
            <div class="flex items-center gap-2 min-w-0">
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-950 flex-shrink-0"
                style="background-color: {combatant.color || '#38bdf8'}"
              >
                {combatant.isPlayer ? 'J' : 'M'}
              </div>
              <div class="min-w-0">
                <div class="text-xs truncate flex items-center gap-1">
                  <span>{combatant.name}</span>
                  {#if isMe}
                    <span class="text-[9px] text-sky-400 font-normal">(Tu)</span>
                  {/if}
                </div>
                <!-- Mini HP bar -->
                {#if combatant.hp?.max && (isGm || combatant.isPlayer || isMe)}
                  <div class="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden mt-0.5">
                    <div
                      class="h-full bg-emerald-400 rounded-full"
                      style="width: {Math.max(0, Math.min(100, ((combatant.hp.current || 0) / combatant.hp.max) * 100))}%"
                    ></div>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Right: Initiative & Actions -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <span
                class="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200"
              >
                {combatant.initiative}
              </span>

              {#if isGm}
                <button
                  type="button"
                  onclick={() => handleRemoveCombatant(combatant.id)}
                  title="Remover do combate"
                  class="text-zinc-500 hover:text-rose-400 transition cursor-pointer p-0.5"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Turn Navigation Footer (for GM) -->
      {#if isGm}
        <div class="p-2 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-1.5">
          <button
            type="button"
            onclick={handlePrevTurn}
            title="Turno Anterior"
            class="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>

          <button
            type="button"
            onclick={handleNextTurn}
            class="flex-1 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer shadow-sm shadow-amber-500/20"
          >
            <span>Próximo Turno</span>
            <ChevronRight class="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <button
            type="button"
            onclick={handleEndCombat}
            title="Encerrar Combate"
            class="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 transition cursor-pointer"
          >
            <Square class="w-3.5 h-3.5 fill-current" />
          </button>
        </div>
      {/if}
    {/if}
  {/if}
</div>
{/if}

<!-- Add Combatant Modal (GM Only) -->
{#if isAddModalOpen}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
      <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
        <User class="w-4 h-4 text-amber-400" />
        <span>Adicionar Combatente</span>
      </h3>

      <div class="space-y-3 text-xs">
        <div>
          <label for="init-combatant-name" class="text-zinc-400 block mb-1">Nome:</label>
          <input
            id="init-combatant-name"
            type="text"
            bind:value={newName}
            placeholder="Ex: Criatura de Sangue / Jogador"
            class="w-full h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label for="init-combatant-score" class="text-zinc-400 block mb-1">Iniciativa:</label>
            <input
              id="init-combatant-score"
              type="number"
              bind:value={newInitiative}
              class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
            />
          </div>
          <div>
            <label for="init-combatant-hp" class="text-zinc-400 block mb-1">PV Atual:</label>
            <input
              id="init-combatant-hp"
              type="number"
              bind:value={newHp}
              class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
            />
          </div>
          <div>
            <label for="init-combatant-maxhp" class="text-zinc-400 block mb-1">PV Máx:</label>
            <input
              id="init-combatant-maxhp"
              type="number"
              bind:value={newMaxHp}
              class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
            />
          </div>
        </div>

        <div class="flex items-center justify-between pt-1">
          <label class="flex items-center gap-2 text-zinc-300 cursor-pointer">
            <input type="checkbox" bind:checked={newIsPlayer} class="accent-amber-400" />
            <span>É Personagem de Jogador</span>
          </label>

          <input
            type="color"
            bind:value={newColor}
            class="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
          />
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
        <button
          type="button"
          onclick={() => (isAddModalOpen = false)}
          class="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onclick={handleAddCombatant}
          class="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition cursor-pointer"
        >
          Adicionar
        </button>
      </div>
    </div>
  </div>
{/if}
