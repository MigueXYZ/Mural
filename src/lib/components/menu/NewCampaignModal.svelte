<script lang="ts">
  import { appState } from '../../stores/appState.svelte';
  import { X, Sparkles, FolderPlus } from 'lucide-svelte';

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  let name = $state('');
  let system = $state('Ordem Paranormal');
  let inGamePeriod = $state('Outubro de 2024');
  let description = $state('');
  let templateType = $state<'blank' | 'mystery' | 'faction' | 'oneshot'>('mystery');

  const systemsList = [
    'Ordem Paranormal',
    'D&D 5e',
    'Call of Cthulhu 7e',
    'Tormenta20',
    'Cyberpunk RED',
    'Blades in the Dark',
    'Vampiro: A Máscara',
    'Personalizado / Outro',
  ];

  function handleSubmit() {
    if (!name.trim()) return;
    appState.createNewCampaign({
      name: name.trim(),
      system,
      inGamePeriod: inGamePeriod.trim() || 'Presente',
      description: description.trim(),
      templateType,
    });
    isOpen = false;
    name = '';
    description = '';
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FolderPlus class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-zinc-100">Criar Nova Campanha</h2>
            <p class="text-xs text-zinc-400">Prepara o quadro de investigação para a tua mesa</p>
          </div>
        </div>
        <button
          onclick={() => (isOpen = false)}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form Inputs -->
      <div class="space-y-4 text-xs">
        <div>
          <label for="campaign-name-input" class="block font-medium text-zinc-300 mb-1.5">Nome da Campanha *</label>
          <input
            id="campaign-name-input"
            type="text"
            placeholder="Ex: Operação Crisol, As Crónicas de Aerthys..."
            bind:value={name}
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="campaign-system-select" class="block font-medium text-zinc-300 mb-1.5">Sistema de RPG</label>
            <select
              id="campaign-system-select"
              bind:value={system}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
            >
              {#each systemsList as sys}
                <option value={sys}>{sys}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="campaign-period-input" class="block font-medium text-zinc-300 mb-1.5">Data / Época no Mundo</label>
            <input
              id="campaign-period-input"
              type="text"
              placeholder="Ex: Ano 998, Outubro 2024..."
              bind:value={inGamePeriod}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
            />
          </div>
        </div>

        <div>
          <label for="campaign-description-input" class="block font-medium text-zinc-300 mb-1.5">Breve Descrição / Premissa</label>
          <textarea
            id="campaign-description-input"
            rows="2"
            placeholder="Ex: Uma série de homicídios ritualísticos ameaça o centro histórico..."
            bind:value={description}
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 resize-none"
          ></textarea>
        </div>

        <!-- Template selector -->
        <div>
          <span class="block font-medium text-zinc-300 mb-2">Modelo Inicial</span>
          <div class="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onclick={() => (templateType = 'mystery')}
              class="p-2.5 rounded-lg border text-left transition {templateType === 'mystery'
                ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <div class="font-semibold text-[11px] mb-0.5">🔍 Mistério</div>
              <div class="text-[10px] text-zinc-400 leading-tight">Foco em Pistas e Segredos</div>
            </button>

            <button
              type="button"
              onclick={() => (templateType = 'faction')}
              class="p-2.5 rounded-lg border text-left transition {templateType === 'faction'
                ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <div class="font-semibold text-[11px] mb-0.5">⚔️ Facções</div>
              <div class="text-[10px] text-zinc-400 leading-tight">Foco em Política e Terras</div>
            </button>

            <button
              type="button"
              onclick={() => (templateType = 'oneshot')}
              class="p-2.5 rounded-lg border text-left transition {templateType === 'oneshot'
                ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 shadow-sm'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <div class="font-semibold text-[11px] mb-0.5">⏳ One-Shot</div>
              <div class="text-[10px] text-zinc-400 leading-tight">Com Relógios de Tensão</div>
            </button>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
        <button
          onclick={() => (isOpen = false)}
          class="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition"
        >
          Cancelar
        </button>
        <button
          onclick={handleSubmit}
          disabled={!name.trim()}
          class="px-5 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-md"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>Começar Campanha</span>
        </button>
      </div>
    </div>
  </div>
{/if}
