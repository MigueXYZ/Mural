<script lang="ts">
  import { X, HelpCircle, Keyboard, MousePointer, ShieldCheck } from 'lucide-svelte';

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  const shortcuts = [
    { keys: ['Ctrl', 'Z'], desc: 'Desfazer a última ação no quadro / campanha (Undo)' },
    { keys: ['Ctrl', 'Y'], desc: 'Refazer a última ação desfeita (Redo)' },
    { keys: ['Ctrl', 'S'], desc: 'Guardar alterações imediatamente no disco' },
    { keys: ['Duplo Clique'], desc: 'Abre o painel de edição do nó ou aresta selecionada' },
    { keys: ['Arrastar Conector'], desc: 'Cria uma nova ligação semântica entre dois nós' },
    { keys: ['Shift', '+ Arrastar'], desc: 'Seleção em caixa retangular de múltiplos nós' },
    { keys: ['Delete', 'Backspace'], desc: 'Elimina o nó ou aresta selecionada' },
    { keys: ['Roda do Rato'], desc: 'Zoom in e Zoom out no canvas' },
    { keys: ['Arrastar Fundo'], desc: 'Move a câmara pelo quadro (Pan)' },
    { keys: ['Clique Esquerdo'], desc: '+1 fatia no Relógio de Ameaça' },
    { keys: ['Clique Direito'], desc: '-1 fatia no Relógio de Ameaça' },
  ];
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <HelpCircle class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-zinc-100">Ajuda & Atalhos de Navegação</h2>
            <p class="text-[11px] text-zinc-400">Controlos essenciais para uma condução rápida na mesa</p>
          </div>
        </div>
        <button
          onclick={() => (isOpen = false)}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Shortcuts List -->
      <div class="space-y-2 text-xs">
        <div class="flex items-center gap-1.5 font-semibold text-amber-400 mb-2">
          <Keyboard class="w-3.5 h-3.5" />
          <span>Atalhos do Teclado & Rato</span>
        </div>

        <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {#each shortcuts as item}
            <div class="flex items-center justify-between p-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
              <span class="text-zinc-300 text-[11px]">{item.desc}</span>
              <div class="flex items-center gap-1">
                {#each item.keys as k}
                  <kbd class="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[10px] shadow-xs">
                    {k}
                  </kbd>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Footer Info -->
      <div class="pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
        <div class="flex items-center gap-1">
          <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
          <span>Mural v1.0.0 • Local-First</span>
        </div>

        <button
          onclick={() => (isOpen = false)}
          class="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition cursor-pointer"
        >
          Entendido
        </button>
      </div>
    </div>
  </div>
{/if}
