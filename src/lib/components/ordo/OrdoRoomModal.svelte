<!-- File: src/lib/components/ordo/OrdoRoomModal.svelte -->
<script lang="ts">
  import { ordoP2P } from '../../services/p2p/ordoP2PService.svelte';
  import {
    X,
    Radio,
    Copy,
    Check,
    Users,
    Music,
    Shield,
    RefreshCw,
    Power,
    Sparkles,
    HelpCircle,
  } from 'lucide-svelte';

  let isCopied = $state(false);
  let customCodeInput = $state(ordoP2P.roomCode);

  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(ordoP2P.roomCode);
      isCopied = true;
      setTimeout(() => (isCopied = false), 2000);
    }
  }

  function handleCreateRoom() {
    ordoP2P.createRoom(customCodeInput);
  }

  function handleCloseRoom() {
    ordoP2P.closeRoom();
  }
</script>

{#if ordoP2P.isConnecting || ordoP2P.isOpen || ordoP2P.lastError}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-150 font-sans"
    onclick={(e) => { if (e.target === e.currentTarget) ordoP2P.lastError = null; }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Radio class="w-4 h-4 {ordoP2P.isOpen ? 'animate-pulse' : ''}" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>Sala P2P Ordo & Mural</span>
              {#if ordoP2P.isOpen}
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  ONLINE
                </span>
              {:else if ordoP2P.isConnecting}
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  A CONECTAR...
                </span>
              {:else}
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
                  OFFLINE
                </span>
              {/if}
            </h2>
            <p class="text-[11px] text-zinc-400">
              Conexão direta WebRTC entre o Mural do Mestre e as fichas dos jogadores no Ordo
            </p>
          </div>
        </div>

        <button
          type="button"
          onclick={() => {
            ordoP2P.lastError = null;
          }}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-5 text-xs text-zinc-200">
        <!-- Room Code Hero Box -->
        <div class="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-center space-y-3">
          <span class="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Código de Acesso da Sala</span>
          
          <div class="flex items-center justify-center gap-3">
            <span class="text-3xl font-black font-mono tracking-wider text-cyan-400 bg-cyan-950/40 px-4 py-2 rounded-2xl border border-cyan-500/30 shadow-inner">
              {ordoP2P.roomCode}
            </span>

            <button
              type="button"
              onclick={handleCopy}
              class="p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-cyan-500/50 text-zinc-300 hover:text-cyan-300 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Copiar Código da Sala"
            >
              {#if isCopied}
                <Check class="w-4 h-4 text-emerald-400" />
                <span class="text-[11px] text-emerald-400 font-medium">Copiado!</span>
              {:else}
                <Copy class="w-4 h-4" />
                <span class="text-[11px] font-medium">Copiar</span>
              {/if}
            </button>
          </div>

          <p class="text-[11px] text-zinc-400 max-w-xs mx-auto">
            Partilha este código com os teus jogadores no Ordo para sincronizar fichas, rolagens e trilha sonora em tempo real.
          </p>
        </div>

        <!-- Connection Status & Sync Options -->
        <div class="space-y-3">
          <div class="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <Users class="w-4 h-4 text-amber-400" />
              <div>
                <div class="font-semibold text-xs text-zinc-100">Jogadores Conectados</div>
                <div class="text-[10px] text-zinc-400">{ordoP2P.connectedCount} peer(s) ativo(s) na sala</div>
              </div>
            </div>

            <span class="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-amber-400">
              {ordoP2P.connectedCount}
            </span>
          </div>

          <!-- Audio Sync Toggle -->
          <label class="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between cursor-pointer">
            <div class="flex items-center gap-2.5">
              <Music class="w-4 h-4 text-purple-400" />
              <div>
                <div class="font-semibold text-xs text-zinc-100">Sincronização de Trilha Sonora</div>
                <div class="text-[10px] text-zinc-400">Transmite música e ambiente do Mestre para os navegadores dos players</div>
              </div>
            </div>

            <input
              type="checkbox"
              bind:checked={ordoP2P.isAudioSyncActive}
              class="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-purple-500 focus:ring-purple-500/30 accent-purple-500 cursor-pointer"
            />
          </label>
        </div>

        <!-- Error Alert if any -->
        {#if ordoP2P.lastError}
          <div class="p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs">
            {ordoP2P.lastError}
          </div>
        {/if}
      </div>

      <!-- Modal Footer Actions -->
      <div class="px-6 py-3.5 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
        {#if ordoP2P.isOpen}
          <button
            type="button"
            onclick={handleCloseRoom}
            class="px-4 py-1.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 hover:bg-rose-900/50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Power class="w-3.5 h-3.5" />
            <span>Encerrar Sala</span>
          </button>
        {:else}
          <button
            type="button"
            onclick={handleCreateRoom}
            class="px-5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 hover:from-cyan-400 hover:to-cyan-300 transition active:scale-95 shadow-md shadow-cyan-500/20 cursor-pointer"
          >
            <Radio class="w-3.5 h-3.5" />
            <span>Iniciar Sala P2P</span>
          </button>
        {/if}

        <button
          type="button"
          onclick={() => {
            ordoP2P.lastError = null;
          }}
          class="px-4 py-1.5 rounded-xl text-xs text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
{/if}
