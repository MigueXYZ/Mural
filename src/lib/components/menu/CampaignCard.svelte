<script lang="ts">
  import type { CampaignData } from '../../types';
  import { appState } from '../../stores/appState.svelte';
  import { Play, Copy, Download, Trash2, MoreVertical, Layers, Clock, BookMarked } from 'lucide-svelte';

  let { campaign }: { campaign: CampaignData } = $props();

  let showMenu = $state(false);

  const systemColor = $derived(
    (campaign.system || '').includes('Ordem')
      ? 'bg-red-950/70 border-red-800/60 text-red-400'
      : (campaign.system || '').includes('D&D')
      ? 'bg-amber-950/70 border-amber-800/60 text-amber-400'
      : (campaign.system || '').includes('Cthulhu')
      ? 'bg-emerald-950/70 border-emerald-800/60 text-emerald-400'
      : 'bg-indigo-950/70 border-indigo-800/60 text-indigo-400'
  );
</script>

<div class="relative group rounded-2xl bg-zinc-900/90 border border-zinc-800/90 p-5 hover:border-amber-500/40 hover:bg-zinc-900 transition-all duration-200 shadow-lg flex flex-col justify-between">
  <!-- Card Header -->
  <div>
    <div class="flex items-start justify-between gap-3 mb-2.5">
      <div class="flex flex-wrap items-center gap-2">
        <span class="px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider {systemColor}">
          {campaign.system || 'Geral'}
        </span>
        <span class="text-xs text-zinc-500 font-medium">
          Sessão {campaign.currentSession}
        </span>
      </div>

      <!-- More Actions Menu -->
      <div class="relative">
        <button
          onclick={() => (showMenu = !showMenu)}
          class="w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 flex items-center justify-center transition"
          title="Opções"
        >
          <MoreVertical class="w-3.5 h-3.5" />
        </button>

        {#if showMenu}
          <div
            class="absolute right-0 top-8 w-36 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl py-1 z-30 text-xs animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              onclick={() => {
                showMenu = false;
                appState.duplicateCampaign(campaign.id);
              }}
              class="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
            >
              <Copy class="w-3.5 h-3.5 text-zinc-400" />
              <span>Duplicar</span>
            </button>
            <button
              onclick={() => {
                showMenu = false;
                appState.exportCampaign(campaign.id);
              }}
              class="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
            >
              <Download class="w-3.5 h-3.5 text-zinc-400" />
              <span>Exportar .mural</span>
            </button>
            <div class="my-1 border-t border-zinc-800"></div>
            <button
              onclick={() => {
                showMenu = false;
                appState.deleteCampaign(campaign.id);
              }}
              class="w-full px-3 py-1.5 text-left text-rose-400 hover:bg-rose-950/40 flex items-center gap-2"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>Eliminar</span>
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Title & Description -->
    <h3 class="text-base font-semibold text-zinc-100 group-hover:text-amber-300 transition leading-snug mb-1">
      {campaign.name}
    </h3>
    <p class="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-4">
      {campaign.description || 'Sem descrição definida para esta campanha.'}
    </p>
  </div>

  <!-- Card Footer -->
  <div class="pt-3 border-t border-zinc-800/80">
    <!-- Stats Row -->
    <div class="flex items-center gap-4 text-[11px] text-zinc-500 mb-3.5">
      <div class="flex items-center gap-1.5" title="Nós no Canvas">
        <Layers class="w-3.5 h-3.5 text-zinc-400" />
        <span>{campaign.nodes?.length || 0} nós</span>
      </div>
      <div class="flex items-center gap-1.5" title="Relógios de Ameaça">
        <Clock class="w-3.5 h-3.5 text-zinc-400" />
        <span>{campaign.clocks?.length || 0} relógios</span>
      </div>
      <div class="flex items-center gap-1.5" title="Fatos de Lore">
        <BookMarked class="w-3.5 h-3.5 text-zinc-400" />
        <span>{campaign.lore?.length || 0} notas</span>
      </div>
    </div>

    <!-- Actions Row -->
    <div class="flex items-center justify-between">
      <span class="text-[10px] text-zinc-600 font-mono">{campaign.updatedAt}</span>

      <button
        onclick={() => appState.openCampaign(campaign.id)}
        class="px-4 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-sm"
      >
        <Play class="w-3 h-3 fill-amber-300" />
        <span>Abrir Sessão</span>
      </button>
    </div>
  </div>
</div>
