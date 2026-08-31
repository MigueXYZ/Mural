<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { aiEngine, type AiHookOption } from '../../services/ai/aiProvider';
  import AiSettingsModal from './AiSettingsModal.svelte';
  import {
    Sparkles,
    ArrowRight,
    Settings,
    BookPlus,
    Clock,
    Copy,
    Check,
    AlertTriangle,
  } from 'lucide-svelte';

  let inputIncident = $state('');
  let isGenerating = $state(false);
  let suggestions = $state<AiHookOption[]>([]);
  let isSettingsOpen = $state(false);
  let copiedIdx = $state<number | null>(null);

  async function generateHooks() {
    if (!inputIncident.trim()) return;

    isGenerating = true;
    suggestions = [];

    try {
      const fullCampaign = campaignStore.exportCurrentCampaign();
      const results = await aiEngine.generateRescueHooks(
        fullCampaign,
        inputIncident.trim(),
        campaignStore.campaign.settings
      );
      suggestions = results;
    } catch (e) {
      console.error('Failed to generate rescue hooks:', e);
    } finally {
      isGenerating = false;
    }
  }

  function handleAddLore(hook: AiHookOption) {
    campaignStore.addLoreEntry(
      `[IMPROVISO]: ${hook.content}`,
      hook.category === 'immediate_consequence' ? 'SABIDO' : 'SEGREDO'
    );
  }

  function handleAdvanceClock() {
    const firstClock = campaignStore.campaign.clocks?.[0];
    if (firstClock) {
      campaignStore.incrementClock(firstClock.id);
    }
  }

  function handleCopy(text: string, idx: number) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    copiedIdx = idx;
    setTimeout(() => {
      if (copiedIdx === idx) copiedIdx = null;
    }, 2000);
  }
</script>

<div class="p-3">
  <div class="flex items-center justify-between mb-2">
    <h2 class="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5">
      <Sparkles class="w-3.5 h-3.5 text-amber-400" /> Assistente de Sessão
    </h2>

    <button
      onclick={() => (isSettingsOpen = true)}
      title="Configurações de IA (BYOK)"
      class="text-zinc-500 hover:text-amber-400 p-1 rounded hover:bg-zinc-900 transition cursor-pointer"
    >
      <Settings class="w-3.5 h-3.5" />
    </button>
  </div>

  <div class="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/90 space-y-2.5 shadow-lg">
    <div>
      <h3 class="text-xs font-semibold text-amber-400">A mesa descarrilou?</h3>
      <p class="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
        Descreve o imprevisto e recebe 3 ganchos contextualizados para retomar o controlo.
      </p>
    </div>

    <div class="space-y-2">
      <input
        type="text"
        placeholder="Ex: Os jogadores mataram o informante antes do interrogatório..."
        bind:value={inputIncident}
        onkeydown={(e) => e.key === 'Enter' && generateHooks()}
        class="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
      />

      <button
        onclick={generateHooks}
        disabled={isGenerating || !inputIncident.trim()}
        class="w-full py-2 px-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 disabled:opacity-40 text-xs font-medium flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer shadow-sm"
      >
        {#if isGenerating}
          <span class="animate-spin text-xs">⏳</span> A analisar o quadro e a gerar ideias...
        {:else}
          <span>Gerar 3 Ganchos de Resgate</span>
          <ArrowRight class="w-3.5 h-3.5" />
        {/if}
      </button>
    </div>

    {#if suggestions.length > 0}
      <div class="pt-2 border-t border-zinc-800/80 space-y-2 text-xs">
        {#each suggestions as hook, idx}
          <div class="p-2.5 rounded-lg bg-zinc-950/90 border border-zinc-800 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider {hook.category ===
              'immediate_consequence'
                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                : hook.category === 'alternative_clue'
                ? 'bg-sky-950 text-sky-300 border border-sky-800/60'
                : 'bg-rose-950 text-rose-300 border border-rose-800/60'}">
                {hook.title}
              </span>

              <button
                onclick={() => handleCopy(hook.content, idx)}
                title="Copiar texto"
                class="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition cursor-pointer"
              >
                {#if copiedIdx === idx}
                  <Check class="w-3 h-3 text-emerald-400" />
                {:else}
                  <Copy class="w-3 h-3" />
                {/if}
              </button>
            </div>

            <p class="text-[11px] text-zinc-200 leading-relaxed">
              {hook.content}
            </p>

            <!-- Actionable Hook Buttons -->
            <div class="flex items-center gap-1.5 pt-1 border-t border-zinc-900">
              <button
                onclick={() => handleAddLore(hook)}
                title="Guardar esta sugestão no Registo de Lore"
                class="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
              >
                <BookPlus class="w-3 h-3 text-amber-400" />
                <span>+ Lore</span>
              </button>

              {#if (campaignStore.campaign.clocks || []).length > 0}
                <button
                  onclick={handleAdvanceClock}
                  title="Avançar 1 fatia no relógio principal"
                  class="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 hover:text-red-400 flex items-center gap-1 transition cursor-pointer"
                >
                  <Clock class="w-3 h-3 text-red-400" />
                  <span>Avançar Relógio</span>
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- BYOK Settings Modal -->
<AiSettingsModal bind:isOpen={isSettingsOpen} />
