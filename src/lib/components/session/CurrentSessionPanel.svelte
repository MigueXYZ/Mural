<!-- File: src/lib/components/session/CurrentSessionPanel.svelte -->
<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import {
    Calendar,
    Clock,
    Plus,
    FileText,
    BookOpen,
    Sparkles,
    Check,
    ChevronRight,
    Tag,
  } from 'lucide-svelte';

  const currentSessionNumber = $derived(campaignStore.campaign.currentSession || 1);

  const activeMarker = $derived(
    (campaignStore.campaign.timeline || []).find(
      (t) => t.sessionNumber === currentSessionNumber
    ) || {
      id: `tm-${currentSessionNumber}`,
      sessionNumber: currentSessionNumber,
      sessionText: `Sessão ${currentSessionNumber}`,
      title: `Sessão ${currentSessionNumber}`,
      inGameDate: campaignStore.campaign.inGamePeriod || 'Presente',
      notes: '',
      realDate: new Date().toLocaleDateString('pt-PT'),
    }
  );

  let sessionTitle = $state('');
  let inGameDate = $state('');
  let sessionNotes = $state('');

  // Sync state when active session changes
  $effect(() => {
    sessionTitle = activeMarker.title || `Sessão ${currentSessionNumber}`;
    inGameDate = activeMarker.inGameDate || campaignStore.campaign.inGamePeriod || 'Presente';
    sessionNotes = activeMarker.notes || '';
  });

  // Debounced auto-save for session notes & details
  function handleNotesChange() {
    campaignStore.updateSessionData(currentSessionNumber, {
      title: sessionTitle.trim() || `Sessão ${currentSessionNumber}`,
      inGameDate: inGameDate.trim() || campaignStore.campaign.inGamePeriod,
      notes: sessionNotes,
    });
  }

  function advanceTime(unit: 'hora' | 'dia' | 'semana') {
    let current = inGameDate.trim();
    // Quick heuristic for adding time
    if (unit === 'hora') {
      inGameDate = `${current} (+1h)`;
    } else if (unit === 'dia') {
      inGameDate = `${current} (+1 dia)`;
    } else {
      inGameDate = `${current} (+1 sem)`;
    }
    handleNotesChange();
  }

  // Lore created during this session
  const sessionLore = $derived(
    (campaignStore.campaign.lore || []).filter(
      (l) => l.sessionNumber === currentSessionNumber
    )
  );

  function handleCreateNextSession() {
    const nextNum = (campaignStore.campaign.timeline?.length || 0) + 1;
    campaignStore.addTimelineMarker(`Sessão ${nextNum}`, nextNum, inGameDate);
    campaignStore.switchActiveSession(nextNum);
  }
</script>

<div class="p-3.5 border-b border-zinc-800/80 flex flex-col space-y-3 bg-zinc-950/60">
  <!-- Header: Current Session Indicator -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
        {currentSessionNumber}
      </div>
      <div>
        <h2 class="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
          <span>Diário da Sessão {currentSessionNumber}</span>
        </h2>
        <span class="text-[10px] text-zinc-500">
          Jogada a: {activeMarker.realDate || new Date().toLocaleDateString('pt-PT')}
        </span>
      </div>
    </div>

    <button
      type="button"
      onclick={handleCreateNextSession}
      title="Concluir sessão e iniciar a próxima"
      class="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 hover:text-amber-300 text-zinc-400 text-[10px] font-medium flex items-center gap-1 transition cursor-pointer"
    >
      <Plus class="w-3 h-3" />
      <span>+ Nova</span>
    </button>
  </div>

  <!-- Session Title / Arc -->
  <div class="space-y-1">
    <input
      type="text"
      placeholder="Tema da Sessão (ex: A Emboscada no Cais)"
      bind:value={sessionTitle}
      oninput={handleNotesChange}
      class="w-full px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
    />
  </div>

  <!-- In-Game Date & Fast-Forward Buttons -->
  <div class="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-1.5">
    <div class="flex items-center justify-between text-[10px] text-zinc-400">
      <span class="flex items-center gap-1 font-medium">
        <Calendar class="w-3 h-3 text-amber-400" />
        <span>Data no Mundo (In-Game):</span>
      </span>
      <div class="flex items-center gap-1">
        <button
          type="button"
          onclick={() => advanceTime('hora')}
          class="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[9px] cursor-pointer"
        >
          +1h
        </button>
        <button
          type="button"
          onclick={() => advanceTime('dia')}
          class="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[9px] cursor-pointer"
        >
          +1d
        </button>
        <button
          type="button"
          onclick={() => advanceTime('semana')}
          class="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[9px] cursor-pointer"
        >
          +1sem
        </button>
      </div>
    </div>

    <input
      type="text"
      placeholder="Ex: 14 de Novembro, Outono"
      bind:value={inGameDate}
      oninput={handleNotesChange}
      class="w-full px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded-md text-[11px] text-amber-300 font-mono focus:outline-none focus:border-amber-500/60"
    />
  </div>

  <!-- Session Scratchpad / Live Notes -->
  <div class="space-y-1 flex-1 flex flex-col min-h-0">
    <div class="flex items-center justify-between text-[10px] text-zinc-400 font-medium px-0.5">
      <span class="flex items-center gap-1">
        <FileText class="w-3 h-3 text-zinc-500" />
        <span>Anotações da Sessão (Scratchpad):</span>
      </span>
      <span class="text-[9px] text-zinc-600">Gravação automática</span>
    </div>

    <textarea
      rows="4"
      placeholder="Escreve aqui notas rápidas durante o jogo (decisões dos jogadores, ganchos para a próxima semana, eventos inesperados)..."
      bind:value={sessionNotes}
      oninput={handleNotesChange}
      class="w-full p-2 bg-zinc-950 border border-zinc-800/80 rounded-xl text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
    ></textarea>
  </div>

  <!-- Lore registered in this session snippet -->
  {#if sessionLore.length > 0}
    <div class="pt-1 space-y-1">
      <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        <BookOpen class="w-3 h-3 text-amber-400" />
        <span>Pistas Desta Sessão ({sessionLore.length}):</span>
      </span>
      <div class="space-y-1 max-h-24 overflow-y-auto pr-1">
        {#each sessionLore as lore}
          <div class="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 flex items-start justify-between gap-1">
            <span class="line-clamp-2">{lore.content}</span>
            <span class="text-[8px] font-bold px-1 rounded {lore.status === 'SABIDO' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}">
              {lore.status}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
