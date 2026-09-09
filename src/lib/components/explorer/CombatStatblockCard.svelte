<!-- File: src/lib/components/explorer/CombatStatblockCard.svelte -->
<script lang="ts">
  import type { CombatStats, CombatAttack, CombatRitual } from '../../types';
  import {
    Shield,
    Heart,
    Zap,
    Brain,
    Swords,
    Sparkles,
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
    Dices,
  } from 'lucide-svelte';

  let {
    stats = $bindable<CombatStats>({}),
    onchange,
  }: {
    stats?: CombatStats;
    onchange?: (updated: CombatStats) => void;
  } = $props();

  let isExpanded = $state(true);
  let lastDiceRoll = $state<{ name: string; roll: number; text: string } | null>(null);

  // Default attributes for Ordem Paranormal / d20
  const defaultAttrs = ['AGI', 'FOR', 'INT', 'PRE', 'VIG'];

  function notifyChange() {
    if (onchange) {
      onchange({ ...stats });
    }
  }

  function updateAttr(attrName: string, val: number) {
    if (!stats.attributes) stats.attributes = {};
    stats.attributes[attrName] = Math.max(0, Math.min(10, val));
    notifyChange();
  }

  function addAttack() {
    if (!stats.attacks) stats.attacks = [];
    stats.attacks.push({
      id: `atk-${Date.now()}`,
      name: 'Novo Ataque',
      test: '2d20, 19',
      damage: '1d4+1 corte',
    });
    notifyChange();
  }

  function removeAttack(id: string) {
    if (stats.attacks) {
      stats.attacks = stats.attacks.filter((a) => a.id !== id);
      notifyChange();
    }
  }

  function addRitual() {
    if (!stats.rituals) stats.rituals = [];
    stats.rituals.push({
      id: `rit-${Date.now()}`,
      name: 'Novo Ritual',
      element: 'Sangue',
      costPe: 1,
      dt: 15,
      description: '',
    });
    notifyChange();
  }

  function removeRitual(id: string) {
    if (stats.rituals) {
      stats.rituals = stats.rituals.filter((r) => r.id !== id);
      notifyChange();
    }
  }

  function rollAttackTest(atk: CombatAttack) {
    // Basic d20 expression parsing e.g. "2d20" or "1d20+5"
    let count = 1;
    let mod = 0;
    if (atk.test.includes('d20')) {
      const parts = atk.test.split('d20');
      count = parseInt(parts[0], 10) || 1;
      if (parts[1] && parts[1].includes('+')) {
        mod = parseInt(parts[1].replace('+', '').trim(), 10) || 0;
      }
    }
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * 20) + 1);
    const best = Math.max(...rolls);
    const finalVal = best + mod;

    lastDiceRoll = {
      name: atk.name,
      roll: finalVal,
      text: `Rolou ${count}d20 [${rolls.join(', ')}] ${mod ? `+ ${mod}` : ''} = ${finalVal}`,
    };
  }
</script>

<div class="rounded-xl border border-zinc-800 bg-zinc-950/90 overflow-hidden shadow-xl mb-4 transition">
  <!-- Card Header -->
  <div class="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800/80 flex items-center justify-between">
    <button
      type="button"
      onclick={() => (isExpanded = !isExpanded)}
      class="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider cursor-pointer hover:text-amber-300 transition"
    >
      <Shield class="w-4 h-4 text-amber-400" />
      <span>Ficha de Combate & Estatísticas (Ordem Paranormal)</span>
      {#if isExpanded}
        <ChevronUp class="w-3.5 h-3.5 text-zinc-400" />
      {:else}
        <ChevronDown class="w-3.5 h-3.5 text-zinc-400" />
      {/if}
    </button>

    {#if lastDiceRoll}
      <div class="text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1.5 animate-in fade-in duration-100">
        <Dices class="w-3.5 h-3.5 text-amber-400" />
        <span>{lastDiceRoll.name}: <strong>{lastDiceRoll.roll}</strong></span>
      </div>
    {/if}
  </div>

  {#if isExpanded}
    <div class="p-4 space-y-4 text-xs">
      <!-- 1. Attributes Grid (AGI, FOR, INT, PRE, VIG) -->
      <div>
        <div class="text-[10px] font-bold text-zinc-400 uppercase mb-1.5">Atributos</div>
        <div class="grid grid-cols-5 gap-2">
          {#each defaultAttrs as attr}
            {@const val = stats.attributes?.[attr] ?? 1}
            <div class="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-900/90 border border-zinc-800">
              <span class="text-[10px] font-bold text-zinc-400">{attr}</span>
              <div class="flex items-center gap-1 mt-1">
                <button
                  type="button"
                  onclick={() => updateAttr(attr, val - 1)}
                  class="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center justify-center cursor-pointer active:scale-95"
                >-</button>
                <span class="w-6 text-center font-bold font-mono text-sm text-amber-400">{val}</span>
                <button
                  type="button"
                  onclick={() => updateAttr(attr, val + 1)}
                  class="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center justify-center cursor-pointer active:scale-95"
                >+</button>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- 2. Vital Stats (PV, PE, SAN, Defesa, Deslocamento) -->
      <div>
        <div class="text-[10px] font-bold text-zinc-400 uppercase mb-1.5">Estatísticas Vitais & Defesa</div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <!-- PV -->
          <div class="p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/40 flex flex-col justify-between">
            <div class="flex items-center justify-between text-rose-400 text-[10px] font-bold">
              <span class="flex items-center gap-1"><Heart class="w-3 h-3" /> PV</span>
              <span>Vida</span>
            </div>
            <div class="flex items-center gap-1 mt-1 font-mono">
              <input
                type="number"
                bind:value={stats.pvCurrent}
                onchange={notifyChange}
                placeholder="Atual"
                class="w-14 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-rose-200 text-xs text-center font-bold focus:border-rose-400 outline-none"
              />
              <span class="text-zinc-500">/</span>
              <input
                type="number"
                bind:value={stats.pvMax}
                onchange={notifyChange}
                placeholder="Max"
                class="w-14 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs text-center font-bold focus:border-rose-400 outline-none"
              />
            </div>
          </div>

          <!-- PE -->
          <div class="p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/40 flex flex-col justify-between">
            <div class="flex items-center justify-between text-amber-400 text-[10px] font-bold">
              <span class="flex items-center gap-1"><Zap class="w-3 h-3" /> PE</span>
              <span>Esforço</span>
            </div>
            <div class="flex items-center gap-1 mt-1 font-mono">
              <input
                type="number"
                bind:value={stats.peCurrent}
                onchange={notifyChange}
                placeholder="Atual"
                class="w-14 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-amber-200 text-xs text-center font-bold focus:border-amber-400 outline-none"
              />
              <span class="text-zinc-500">/</span>
              <input
                type="number"
                bind:value={stats.peMax}
                onchange={notifyChange}
                placeholder="Max"
                class="w-14 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs text-center font-bold focus:border-amber-400 outline-none"
              />
            </div>
          </div>

          <!-- SAN -->
          <div class="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-900/40 flex flex-col justify-between">
            <div class="flex items-center justify-between text-indigo-400 text-[10px] font-bold">
              <span class="flex items-center gap-1"><Brain class="w-3 h-3" /> SAN</span>
              <span>Sanidade</span>
            </div>
            <div class="flex items-center gap-1 mt-1 font-mono">
              <input
                type="number"
                bind:value={stats.sanCurrent}
                onchange={notifyChange}
                placeholder="Atual"
                class="w-14 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-indigo-200 text-xs text-center font-bold focus:border-indigo-400 outline-none"
              />
              <span class="text-zinc-500">/</span>
              <input
                type="number"
                bind:value={stats.sanMax}
                onchange={notifyChange}
                placeholder="Max"
                class="w-14 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs text-center font-bold focus:border-indigo-400 outline-none"
              />
            </div>
          </div>

          <!-- Defesa & Deslocamento -->
          <div class="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
            <div class="flex items-center justify-between text-zinc-400 text-[10px] font-bold">
              <span class="flex items-center gap-1"><Shield class="w-3 h-3 text-sky-400" /> Defesa / Desl</span>
            </div>
            <div class="flex items-center gap-1.5 mt-1 font-mono">
              <input
                type="number"
                bind:value={stats.defense}
                onchange={notifyChange}
                placeholder="Defesa"
                class="w-14 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-sky-300 text-xs text-center font-bold focus:border-sky-400 outline-none"
              />
              <input
                type="text"
                bind:value={stats.displacement}
                onchange={notifyChange}
                placeholder="9m"
                class="w-14 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs text-center font-bold focus:border-sky-400 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Attacks List -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <div class="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1.5">
            <Swords class="w-3 h-3 text-rose-400" />
            <span>Ataques & Armas</span>
          </div>
          <button
            type="button"
            onclick={addAttack}
            class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
          >
            <Plus class="w-3 h-3" />
            <span>Adicionar</span>
          </button>
        </div>

        {#if stats.attacks && stats.attacks.length > 0}
          <div class="space-y-1.5">
            {#each stats.attacks as atk}
              <div class="p-2 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center gap-2">
                <input
                  type="text"
                  bind:value={atk.name}
                  onchange={notifyChange}
                  placeholder="Nome da Arma"
                  class="flex-1 px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs focus:border-amber-400 outline-none"
                />
                <input
                  type="text"
                  bind:value={atk.test}
                  onchange={notifyChange}
                  placeholder="Teste (ex: 2d20)"
                  class="w-24 px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-amber-300 text-xs font-mono focus:border-amber-400 outline-none"
                />
                <input
                  type="text"
                  bind:value={atk.damage}
                  onchange={notifyChange}
                  placeholder="Dano (ex: 1d4+1)"
                  class="w-28 px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-rose-300 text-xs font-mono focus:border-rose-400 outline-none"
                />
                <button
                  type="button"
                  onclick={() => rollAttackTest(atk)}
                  class="p-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition cursor-pointer active:scale-95"
                  title="Rolar Teste de Ataque"
                >
                  <Dices class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onclick={() => removeAttack(atk.id)}
                  class="p-1 rounded text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                  title="Eliminar Ataque"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="p-2 rounded-lg bg-zinc-900/50 border border-dashed border-zinc-800 text-center text-[11px] text-zinc-500">
            Nenhum ataque configurado. Clica em "+ Adicionar".
          </div>
        {/if}
      </div>

      <!-- 4. Rituals List -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <div class="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1.5">
            <Sparkles class="w-3 h-3 text-purple-400" />
            <span>Rituais Ocultistas</span>
          </div>
          <button
            type="button"
            onclick={addRitual}
            class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
          >
            <Plus class="w-3 h-3" />
            <span>Adicionar</span>
          </button>
        </div>

        {#if stats.rituals && stats.rituals.length > 0}
          <div class="space-y-1.5">
            {#each stats.rituals as rit}
              <div class="p-2 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center gap-2">
                <input
                  type="text"
                  bind:value={rit.name}
                  onchange={notifyChange}
                  placeholder="Nome do Ritual"
                  class="flex-1 px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-purple-200 text-xs focus:border-purple-400 outline-none"
                />
                <select
                  bind:value={rit.element}
                  onchange={notifyChange}
                  class="px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-zinc-300 text-xs focus:border-purple-400 outline-none cursor-pointer"
                >
                  <option value="Sangue">Sangue</option>
                  <option value="Energia">Energia</option>
                  <option value="Morte">Morte</option>
                  <option value="Conhecimento">Conhecimento</option>
                  <option value="Medo">Medo</option>
                </select>
                <div class="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                  <span>PE:</span>
                  <input
                    type="number"
                    bind:value={rit.costPe}
                    onchange={notifyChange}
                    class="w-10 px-1 py-1 rounded bg-zinc-950 border border-zinc-700 text-amber-300 text-xs text-center font-bold focus:border-amber-400 outline-none"
                  />
                </div>
                <div class="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                  <span>DT:</span>
                  <input
                    type="number"
                    bind:value={rit.dt}
                    onchange={notifyChange}
                    class="w-10 px-1 py-1 rounded bg-zinc-950 border border-zinc-700 text-zinc-300 text-xs text-center font-bold focus:border-purple-400 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onclick={() => removeRitual(rit.id)}
                  class="p-1 rounded text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                  title="Eliminar Ritual"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="p-2 rounded-lg bg-zinc-900/50 border border-dashed border-zinc-800 text-center text-[11px] text-zinc-500">
            Nenhum ritual configurado. Clica em "+ Adicionar".
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
