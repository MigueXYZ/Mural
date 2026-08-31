<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import ThreatClockItem from './ThreatClockItem.svelte';
  import CreateClockModal from './CreateClockModal.svelte';
  import ClockAlertModal from './ClockAlertModal.svelte';
  import { Plus, Clock } from 'lucide-svelte';
  import type { ThreatClock } from '../../types';

  let isCreateModalOpen = $state(false);
  let isAlertModalOpen = $state(false);
  let completedClock = $state<ThreatClock | null>(null);

  function handleClockCompleted(clock: ThreatClock) {
    completedClock = clock;
    isAlertModalOpen = true;
  }
</script>

<div class="p-3 border-b border-zinc-800/80">
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-1.5">
      <Clock class="w-3.5 h-3.5 text-amber-400" />
      <h2 class="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
        Relógios de Ameaça
      </h2>
      <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
        {campaignStore.campaign.clocks?.length || 0}
      </span>
    </div>

    <button
      onclick={() => (isCreateModalOpen = true)}
      title="Adicionar Novo Relógio (4, 6, 8, 10, 12 fatias)"
      class="text-zinc-500 hover:text-amber-400 p-1 rounded hover:bg-zinc-900 transition cursor-pointer"
    >
      <Plus class="w-4 h-4" />
    </button>
  </div>

  <div class="space-y-1 max-h-56 overflow-y-auto pr-1">
    {#if campaignStore.campaign.clocks && campaignStore.campaign.clocks.length > 0}
      {#each campaignStore.campaign.clocks as clock (clock.id)}
        <ThreatClockItem {clock} onCompleted={handleClockCompleted} />
      {/each}
    {:else}
      <div class="py-4 text-center text-xs text-zinc-500 border border-dashed border-zinc-900 rounded-lg">
        Nenhum relógio ativo.
      </div>
    {/if}
  </div>
</div>

<!-- Modals -->
<CreateClockModal bind:isOpen={isCreateModalOpen} />
<ClockAlertModal clock={completedClock} bind:isOpen={isAlertModalOpen} />
