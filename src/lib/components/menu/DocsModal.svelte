<script lang="ts">
  import { X, BookOpen, Layers, Clock, Skull, Dices, Sparkles, FolderOpen, CheckCircle2 } from 'lucide-svelte';

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  let activeSection = $state<'intro' | 'canvas' | 'clocks' | 'tables' | 'ai' | 'persistence'>('intro');

  const sections = [
    { id: 'intro', label: 'Visão Geral', icon: BookOpen },
    { id: 'canvas', label: 'Canvas & Relações', icon: Layers },
    { id: 'clocks', label: 'Relógios de Ameaça', icon: Clock },
    { id: 'tables', label: 'Tabelas & Sub-Notas', icon: Dices },
    { id: 'ai', label: 'Assistente de IA', icon: Sparkles },
    { id: 'persistence', label: 'Ficheiros & Backup', icon: FolderOpen },
  ];
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="w-full max-w-4xl max-h-[85vh] bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <BookOpen class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-zinc-100">Documentação & Guia do Mestre</h2>
            <p class="text-[11px] text-zinc-400">Manual completo de utilização do Mural (OrdemTools)</p>
          </div>
        </div>
        <button
          onclick={() => (isOpen = false)}
          class="w-8 h-8 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body: Sidebar + Content -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Docs Navigation Sidebar -->
        <aside class="w-56 border-r border-zinc-800 bg-zinc-950/60 p-3 space-y-1 overflow-y-auto select-none">
          {#each sections as sec}
            {@const Icon = sec.icon}
            <button
              onclick={() => (activeSection = sec.id as any)}
              class="w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition text-left cursor-pointer {activeSection ===
              sec.id
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}"
            >
              <Icon class="w-3.5 h-3.5 flex-shrink-0" />
              <span>{sec.label}</span>
            </button>
          {/each}
        </aside>

        <!-- Content Panel -->
        <main class="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-zinc-300 leading-relaxed">
          {#if activeSection === 'intro'}
            <div class="space-y-4">
              <h3 class="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Bem-vindo ao Mural (OrdemTools)</span>
              </h3>
              <p>
                O **Mural** foi concebido especificamente para Mestres de RPG que necessitam de preparar, organizar e conduzir sessões complexas com múltiplos nós de investigação, relações entre personagens, locais misteriosos e contagens de perigo.
              </p>
              <div class="grid grid-cols-2 gap-3 pt-2">
                <div class="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1.5">
                  <span class="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <CheckCircle2 class="w-3.5 h-3.5" /> 100% Local-First
                  </span>
                  <p class="text-[11px] text-zinc-400">
                    Todos os teus dados são guardados diretamente no teu computador. Podes mestrar offline sem internet sem receio de perder notas.
                  </p>
                </div>
                <div class="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1.5">
                  <span class="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <CheckCircle2 class="w-3.5 h-3.5" /> Grafo Semântico
                  </span>
                  <p class="text-[11px] text-zinc-400">
                    Conecta suspeitos, cultos, pistas e segredos com etiquetas visuais inteligentes e navega pelo mistério com facilidade.
                  </p>
                </div>
              </div>
            </div>

          {:else if activeSection === 'canvas'}
            <div class="space-y-4">
              <h3 class="text-base font-bold text-zinc-100">Canvas & Grafo de Relações</h3>
              <p>
                O tabuleiro central é um espaço infinito para diagramação e planeamento.
              </p>
              <div class="space-y-2.5">
                <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                  <strong class="text-amber-400">Nós de Entidade:</strong> Podes criar **NPCs**, **Facções**, **Locais**, **Segredos**, **Notas** e **Tabelas**. Faz duplo clique em qualquer nó para abrir o editor completo.
                </div>
                <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                  <strong class="text-amber-400">Arestas Semânticas:</strong> Arrasta uma linha entre os conectores (*handles*) para ligar dois nós. Clica duas vezes na aresta para editar o rótulo (ex: *"é aliado de"*, *"esconde-se sob"*) ou mudar o estilo para curva ou reta.
                </div>
                <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                  <strong class="text-amber-400">Auto-Organização:</strong> Usa o menu de layout para organizar automaticamente os nós em formato Hierárquico, Força ou Grelha.
                </div>
              </div>
            </div>

          {:else if activeSection === 'clocks'}
            <div class="space-y-4">
              <h3 class="text-base font-bold text-zinc-100">Relógios de Ameaça (Progress Clocks)</h3>
              <p>
                Inspirados nos sistemas *Blades in the Dark* e *PbtA*, os relógios servem para acompanhar a aproximação de perigos, rituais ou patrulhas:
              </p>
              <ul class="list-disc list-inside space-y-1 text-zinc-400 pl-2">
                <li><strong class="text-zinc-200">Clique Esquerdo:</strong> Preenche +1 fatia do relógio.</li>
                <li><strong class="text-zinc-200">Clique Direito:</strong> Reduz -1 fatia.</li>
                <li><strong class="text-zinc-200">Alerta de Conclusão:</strong> Ao preencher todas as fatias, o relógio conclui e dispara o evento planeado.</li>
              </ul>
            </div>

          {:else if activeSection === 'tables'}
            <div class="space-y-4">
              <h3 class="text-base font-bold text-zinc-100">Tabelas de Encontros & Sub-Notas</h3>
              <p>
                Qualquer nó ou local pode ter **Tabelas de Rolagem** (1d4 a 1d100) e **Sub-Notas** de contexto:
              </p>
              <div class="space-y-2">
                <p>
                  1. Abre o editor do nó e clica na aba **"🎲 Tabelas de Encontros"**.
                </p>
                <p>
                  2. Adiciona linhas com intervalos (ex: 1-2: *Patrulha*, 3-4: *Mercador*, 5: *Emboscada*).
                </p>
                <p>
                  3. Clica em **"🎲 Rolar Encontro"** para sortear instantaneamente com destaque visual durante o jogo!
                </p>
              </div>
            </div>

          {:else if activeSection === 'ai'}
            <div class="space-y-4">
              <h3 class="text-base font-bold text-zinc-100">Assistente de Improviso ("A mesa descarrilou?")</h3>
              <p>
                Quando os jogadores tomam uma atitude totalmente inesperada, digita o acontecimento no assistente lateral. O Mural serializa os nós ativos, relógios e segredos da campanha e gera **3 ganchos imediatos** de contingência.
              </p>
              <p>
                Podes configurar a tua chave de API (**Gemini**, **OpenAI**, **Anthropic**) ou ligar a um **Ollama local** na aba de Configurações da barra lateral.
              </p>
            </div>

          {:else if activeSection === 'persistence'}
            <div class="space-y-4">
              <h3 class="text-base font-bold text-zinc-100">Ficheiros & Backup</h3>
              <p>
                As tuas campanhas são gravadas automaticamente a cada alteração. Podes exportar a qualquer momento um ficheiro `.mural` (JSON) para partilhar com outros mestres ou criar cópias de segurança.
              </p>
            </div>
          {/if}
        </main>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-3 border-t border-zinc-800 bg-zinc-950 flex justify-end">
        <button
          onclick={() => (isOpen = false)}
          class="px-5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold transition cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
{/if}
