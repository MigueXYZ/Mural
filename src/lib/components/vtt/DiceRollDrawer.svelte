<!--
  src/lib/components/vtt/DiceRollDrawer.svelte
  
  Mural Tactical VTT Live Dice Rolling Drawer
  Supports standard polyhedrals (d4, d6, d8, d10, d12, d20, d100),
  custom NdX + M expressions, criticals/fumbles, and real-time P2P sync.
-->
<script lang="ts">
  import { vttP2P } from '../../services/vtt/vttP2PService.svelte';
  import { parseDiceExpression } from '../../services/vtt/vttProtocol';
  import type { DiceRollResult } from '../../types/vtt';
  import { Dices, X, Sparkles, AlertTriangle, Send } from 'lucide-svelte';

  interface Props {
    isOpen?: boolean;
    playerName?: string;
    characterName?: string;
    onClose?: () => void;
  }

  let {
    isOpen = $bindable(false),
    playerName = 'Jogador',
    characterName = '',
    onClose,
  }: Props = $props();

  let formula = $state('1d20');
  let modifier = $state(0);
  let diceCount = $state(1);
  let rollReason = $state('');

  const quickDice = [4, 6, 8, 10, 12, 20, 100];
  const diceFeed = $derived(vttP2P.diceFeed);

  function handleQuickRoll(sides: number) {
    const modStr = modifier !== 0 ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : '';
    const expr = `${diceCount}d${sides}${modStr}`;
    executeRoll(expr);
  }

  function handleCustomRoll() {
    if (!formula.trim()) return;
    executeRoll(formula.trim());
  }

  function executeRoll(expr: string) {
    try {
      const sender = characterName.trim() || playerName.trim() || 'Jogador';
      const result = parseDiceExpression(expr, sender);
      
      if (rollReason.trim()) {
        result.label = rollReason.trim();
      }

      vttP2P.sendDiceRoll(result);
    } catch (e: any) {
      alert(`Erro ao rolar dados: ${e.message}`);
    }
  }

  function closeDrawer() {
    isOpen = false;
    onClose?.();
  }
</script>

{#if isOpen}
  <!-- Drawer Overlay Backdrop -->
  <div
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
    onclick={closeDrawer}
    role="presentation"
  ></div>

  <!-- Drawer Slide-in Panel (Left side) -->
  <aside
    class="fixed top-0 left-0 bottom-0 z-50 w-80 bg-zinc-950/95 border-r border-zinc-800 backdrop-blur-2xl shadow-2xl flex flex-col text-zinc-100 animate-in slide-in-from-left duration-200 select-none"
  >
    <!-- Header -->
    <div class="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/70">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Dices class="w-4 h-4" />
        </div>
        <div>
          <h2 class="text-xs font-bold leading-tight">Rolagem de Dados</h2>
          <p class="text-[10px] text-zinc-400 leading-tight">Sincronizado via P2P</p>
        </div>
      </div>

      <button
        type="button"
        onclick={closeDrawer}
        class="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Quick Dice Grid -->
    <div class="p-4 border-b border-zinc-800/80 space-y-3 bg-zinc-900/30">
      <span class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
        Dados Rápidos
      </span>

      <div class="grid grid-cols-4 gap-2">
        {#each quickDice as sides}
          <button
            type="button"
            onclick={() => handleQuickRoll(sides)}
            class="py-2.5 px-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300 transition active:scale-95 font-mono font-bold text-xs flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-sm"
          >
            <span>d{sides}</span>
          </button>
        {/each}
      </div>

      <!-- Count & Modifier Row -->
      <div class="grid grid-cols-2 gap-2 pt-1">
        <div>
          <label for="dice-count-input" class="text-[10px] text-zinc-500 block mb-1">Quantidade:</label>
          <input
            id="dice-count-input"
            type="number"
            min="1"
            max="20"
            bind:value={diceCount}
            class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-100 text-center"
          />
        </div>
        <div>
          <label for="dice-mod-input" class="text-[10px] text-zinc-500 block mb-1">Modificador:</label>
          <input
            id="dice-mod-input"
            type="number"
            bind:value={modifier}
            class="w-full h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-100 text-center"
          />
        </div>
      </div>

      <!-- Custom Expression Input -->
      <div class="pt-1">
        <label for="dice-expr-input" class="text-[10px] text-zinc-500 block mb-1">Expressão Customizada:</label>
        <div class="flex items-center gap-1.5">
          <input
            id="dice-expr-input"
            type="text"
            bind:value={formula}
            placeholder="Ex: 3d20 + 5"
            class="flex-1 h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onclick={handleCustomRoll}
            title="Rolar"
            class="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center transition active:scale-95 cursor-pointer shadow-sm shadow-amber-500/20"
          >
            <Send class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Live Roll Feed -->
    <div class="flex-1 flex flex-col min-h-0">
      <div class="px-4 py-2 border-b border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
        <span>Histórico da Sala</span>
        <span class="text-[10px] font-mono text-zinc-500 font-normal">{diceFeed.length} rolagens</span>
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-zinc-800/40">
        {#if diceFeed.length === 0}
          <div class="h-40 flex flex-col items-center justify-center text-center text-zinc-500 text-xs space-y-1">
            <Dices class="w-6 h-6 stroke-[1.5] text-zinc-600" />
            <p>Nenhuma rolagem feita nesta sessão.</p>
          </div>
        {:else}
          {#each diceFeed as roll (roll.id)}
            <div class="pt-2 first:pt-0 space-y-1">
              <!-- Sender & Time -->
              <div class="flex items-center justify-between text-[10px]">
                <span class="font-bold text-zinc-300 truncate max-w-[150px]">{roll.senderName}</span>
                <span class="font-mono text-zinc-500">{roll.expression}</span>
              </div>

              <!-- Label if provided -->
              {#if roll.label}
                <div class="text-[10px] text-amber-400/80 italic truncate">{roll.label}</div>
              {/if}

              <!-- Total Card -->
              <div
                class="p-2 rounded-xl flex items-center justify-between gap-2 border transition {roll.isCritical
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                  : roll.isFumble
                  ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                  : 'bg-zinc-900/80 border-zinc-800 text-zinc-200'}"
              >
                <!-- Dice breakdown -->
                <div class="text-[10px] font-mono text-zinc-400 truncate flex items-center gap-1">
                  <span>[{roll.dice.map((d) => d.result).join(', ')}]</span>
                  {#if roll.modifier !== 0}
                    <span>{roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier}</span>
                  {/if}
                </div>

                <!-- Total and Badge -->
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  {#if roll.isCritical}
                    <Sparkles class="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                    <span class="text-[9px] font-bold uppercase tracking-wider text-amber-400">Crítico!</span>
                  {:else if roll.isFumble}
                    <AlertTriangle class="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    <span class="text-[9px] font-bold uppercase tracking-wider text-rose-400">Desastre!</span>
                  {/if}

                  <span class="text-base font-extrabold font-mono leading-none">
                    {roll.total}
                  </span>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </aside>
{/if}
