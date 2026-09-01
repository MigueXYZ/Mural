<!-- File: src/lib/components/calendar/CalendarModal.svelte -->
<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import type { CustomCalendarConfig, MoonPhaseResult } from '../../types';
  import {
    getDaysInMonth,
    getDayOfWeek,
    getMoonPhases,
    formatDate,
    isLeapYear,
  } from '../../services/calendar/calendarEngine';
  import {
    X,
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Plus,
    Minus,
    Moon,
    Sun,
    Sparkles,
    Settings,
    Clock,
    Flame,
    Coffee,
    Bed,
    Check,
  } from 'lucide-svelte';

  const cal = $derived(campaignStore.activeCalendar);

  // Viewing month and year in the grid (can browse without immediately changing in-game date)
  let viewYear = $state(campaignStore.activeCalendar.currentYear);
  let viewMonthIndex = $state(campaignStore.activeCalendar.currentMonthIndex);
  let customDaysStep = $state(1);

  // Sync view when activeCalendar changes
  $effect(() => {
    viewYear = cal.currentYear;
    viewMonthIndex = cal.currentMonthIndex;
  });

  const daysInViewMonth = $derived(getDaysInMonth(viewYear, viewMonthIndex, cal));
  const currentMonthData = $derived(cal.months[viewMonthIndex] || { name: `Mês ${viewMonthIndex + 1}`, season: 'Inverno' });
  const firstDayWeekday = $derived(getDayOfWeek(viewYear, viewMonthIndex, 1, cal));
  const moonPhasesToday = $derived(campaignStore.getCurrentMoonPhases());
  const isViewingLeapYear = $derived(isLeapYear(viewYear, cal));

  // Today's holidays
  const holidaysToday = $derived(
    (cal.holidays || []).filter(
      (h) => h.monthIndex === cal.currentMonthIndex && h.day === cal.currentDay
    )
  );

  function prevMonth() {
    if (viewMonthIndex > 0) {
      viewMonthIndex--;
    } else {
      viewMonthIndex = cal.months.length - 1;
      viewYear--;
    }
  }

  function nextMonth() {
    if (viewMonthIndex < cal.months.length - 1) {
      viewMonthIndex++;
    } else {
      viewMonthIndex = 0;
      viewYear++;
    }
  }

  function prevYear() {
    viewYear--;
  }

  function nextYear() {
    viewYear++;
  }

  function selectDay(day: number) {
    campaignStore.setCalendarDate(viewYear, viewMonthIndex, day);
  }

  function advanceDays(amount: number) {
    campaignStore.advanceCalendarDays(amount);
  }

  function advanceWeeks(amount: number) {
    const weekLength = cal.weekdays.length || 7;
    campaignStore.advanceCalendarDays(amount * weekLength);
  }

  function advanceMonths(amount: number) {
    campaignStore.advanceCalendarMonths(amount);
  }

  function advanceYears(amount: number) {
    campaignStore.advanceCalendarYears(amount);
  }

  function jumpToToday() {
    viewYear = cal.currentYear;
    viewMonthIndex = cal.currentMonthIndex;
  }
</script>

{#if campaignStore.isCalendarOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-150 font-sans"
    onclick={(e) => { if (e.target === e.currentTarget) campaignStore.closeCalendar(); }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="w-full max-w-5xl max-h-[94vh] bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
      <!-- Modal Header -->
      <div class="px-6 py-3.5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <CalendarIcon class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>{cal.name || 'Calendário da Campanha'}</span>
              {#if isViewingLeapYear}
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  Ano Bissexto
                </span>
              {/if}
            </h2>
            <p class="text-[11px] text-zinc-400">
              Data Atual no Mundo: <span class="text-amber-400 font-bold">{formatDate(cal)}</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Config Button -->
          <button
            type="button"
            onclick={() => {
              campaignStore.closeCalendar();
              campaignStore.openCalendarConfig();
            }}
            class="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-amber-300 hover:border-amber-500/40 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            title="Personalizar Meses, Luas e Regras do Calendário"
          >
            <Settings class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Configurar Calendário</span>
          </button>

          <!-- Close Modal -->
          <button
            type="button"
            onclick={() => campaignStore.closeCalendar()}
            class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Quick GM Operational Time Stepper Bar -->
      <div class="px-6 py-2.5 bg-zinc-950/90 border-b border-zinc-800/80 flex items-center justify-between gap-2 overflow-x-auto text-xs select-none">
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">Avançar Tempo:</span>

          <button
            type="button"
            onclick={() => advanceDays(1)}
            class="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-amber-300 font-medium transition cursor-pointer flex items-center gap-1"
          >
            <Plus class="w-3 h-3 text-amber-400" />
            <span>+1 Dia</span>
          </button>

          <button
            type="button"
            onclick={() => advanceWeeks(1)}
            class="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-amber-300 font-medium transition cursor-pointer flex items-center gap-1"
          >
            <Plus class="w-3 h-3 text-amber-400" />
            <span>+1 Semana</span>
          </button>

          <button
            type="button"
            onclick={() => advanceMonths(1)}
            class="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-amber-300 font-medium transition cursor-pointer flex items-center gap-1"
          >
            <Plus class="w-3 h-3 text-amber-400" />
            <span>+1 Mês</span>
          </button>

          <button
            type="button"
            onclick={() => advanceYears(1)}
            class="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-amber-300 font-medium transition cursor-pointer flex items-center gap-1"
          >
            <Plus class="w-3 h-3 text-amber-400" />
            <span>+1 Ano</span>
          </button>
        </div>

        <!-- Resting Presets -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onclick={() => advanceDays(1)}
            class="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-medium transition cursor-pointer flex items-center gap-1"
            title="Descanso Longo (+1 Dia)"
          >
            <Bed class="w-3.5 h-3.5" />
            <span>Descanso Longo (+1d)</span>
          </button>

          <!-- Custom Days Step -->
          <div class="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onclick={() => advanceDays(-customDaysStep)}
              class="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              title={`Voltar ${customDaysStep} dia(s)`}
            >
              <Minus class="w-3 h-3" />
            </button>
            <input
              type="number"
              min="1"
              max="999"
              bind:value={customDaysStep}
              class="w-10 text-center bg-transparent text-xs font-mono text-zinc-100 focus:outline-none"
            />
            <button
              type="button"
              onclick={() => advanceDays(customDaysStep)}
              class="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              title={`Avançar ${customDaysStep} dia(s)`}
            >
              <Plus class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <!-- Main Calendar Body: Left Month Grid + Right Celestial & Lore Sidebar -->
      <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
        <!-- Center/Left Calendar Grid Area -->
        <div class="flex-1 p-6 overflow-y-auto space-y-4">
          <!-- Month & Year Navigation Bar -->
          <div class="flex items-center justify-between bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onclick={prevYear}
                class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
                title="Ano Anterior"
              >
                <ChevronsLeft class="w-4 h-4" />
              </button>
              <button
                type="button"
                onclick={prevMonth}
                class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft class="w-4 h-4" />
              </button>
            </div>

            <div class="flex items-center gap-3 text-center">
              <div>
                <div class="flex items-center gap-2 justify-center">
                  <select
                    bind:value={viewMonthIndex}
                    class="bg-transparent font-bold text-sm text-zinc-100 cursor-pointer focus:outline-none hover:text-amber-400 transition"
                  >
                    {#each cal.months as m, idx}
                      <option value={idx} class="bg-zinc-900 text-zinc-100">{m.name}</option>
                    {/each}
                  </select>
                  <span class="text-xs font-mono text-amber-400 font-bold">
                    {cal.yearPrefix ? `${cal.yearPrefix} ` : ''}{viewYear}{cal.yearSuffix ? ` ${cal.yearSuffix}` : ''}
                  </span>
                </div>
                <div class="text-[10px] text-zinc-500 flex items-center justify-center gap-1.5 mt-0.5">
                  <span>{currentMonthData.season || 'Estação'}</span>
                  <span>•</span>
                  <span>{daysInViewMonth} dias</span>
                  {#if isViewingLeapYear && cal.leapYearRule?.monthIndex === viewMonthIndex}
                    <span class="text-amber-400 font-medium">({cal.leapYearRule.extraDays} dia extra)</span>
                  {/if}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onclick={jumpToToday}
                class="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition cursor-pointer mr-1"
                title="Voltar ao dia atual"
              >
                Hoje
              </button>
              <button
                type="button"
                onclick={nextMonth}
                class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight class="w-4 h-4" />
              </button>
              <button
                type="button"
                onclick={nextYear}
                class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
                title="Próximo Ano"
              >
                <ChevronsRight class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Weekday Columns Header -->
          <div
            class="grid gap-1 text-center font-bold text-[11px] text-zinc-400 uppercase tracking-wider py-1 border-b border-zinc-800/80"
            style="grid-template-columns: repeat({cal.weekdays.length || 7}, minmax(0, 1fr));"
          >
            {#each cal.weekdays as weekday}
              <div class="py-1 truncate" title={weekday}>
                {weekday.slice(0, 3)}
              </div>
            {/each}
          </div>

          <!-- Monthly Grid Day Cells -->
          <div
            class="grid gap-1.5"
            style="grid-template-columns: repeat({cal.weekdays.length || 7}, minmax(0, 1fr));"
          >
            <!-- Empty offset days before Day 1 -->
            {#each Array(firstDayWeekday.index) as _}
              <div class="min-h-[64px] rounded-xl bg-zinc-950/20 border border-transparent opacity-25 pointer-events-none"></div>
            {/each}

            <!-- Actual Month Days -->
            {#each Array(daysInViewMonth) as _, dIdx}
              {@const dayNum = dIdx + 1}
              {@const isToday = cal.currentYear === viewYear && cal.currentMonthIndex === viewMonthIndex && cal.currentDay === dayNum}
              {@const dayMoonPhases = getMoonPhases(viewYear, viewMonthIndex, dayNum, cal)}
              {@const dayHolidays = (cal.holidays || []).filter((h) => h.monthIndex === viewMonthIndex && h.day === dayNum)}

              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                onclick={() => selectDay(dayNum)}
                class="min-h-[64px] p-1.5 rounded-xl border transition flex flex-col justify-between cursor-pointer group {isToday
                  ? 'bg-amber-500/20 border-amber-500/80 shadow-md shadow-amber-500/10 ring-1 ring-amber-400'
                  : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/80'}"
              >
                <!-- Day Number + Moon Phase Icons -->
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold font-mono {isToday ? 'text-amber-300 font-black' : 'text-zinc-300 group-hover:text-zinc-100'}">
                    {dayNum}
                  </span>

                  <!-- Mini Moon Icons for Day -->
                  {#if dayMoonPhases.length > 0}
                    <div class="flex items-center gap-0.5 text-[11px]" title={dayMoonPhases.map((m) => `${m.moon.name}: ${m.phaseName} (${m.illuminationPercent}%)`).join('\n')}>
                      {#each dayMoonPhases as mp}
                        <span>{mp.phaseIcon}</span>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- Day Holidays / Festivals -->
                {#if dayHolidays.length > 0}
                  <div class="space-y-0.5 mt-1">
                    {#each dayHolidays as h}
                      <div class="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold truncate" title={`${h.name}: ${h.description || ''}`}>
                        ✨ {h.name}
                      </div>
                    {/each}
                  </div>
                {/if}

                <!-- Current Day Indicator Pill -->
                {#if isToday}
                  <div class="text-[9px] text-center font-bold text-amber-400 bg-amber-500/10 rounded py-0.2 mt-auto">
                    Hoje
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Right Celestial & Lore Sidebar -->
        <aside class="w-full md:w-80 border-t md:border-t-0 md:border-l border-zinc-800 bg-zinc-950/90 p-5 flex flex-col gap-4 shrink-0 overflow-y-auto shadow-2xl">
          <!-- Active In-Game Date Hero Badge -->
          <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] uppercase font-black tracking-widest text-amber-400">Data Oficial Ativa</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-zinc-950 font-bold">EM JOGO</span>
            </div>
            <div class="font-bold text-xs text-zinc-100">
              {formatDate(cal)}
            </div>
            <div class="text-[11px] text-zinc-400">
              Dia da semana: <span class="text-amber-300 font-semibold">{getDayOfWeek(cal.currentYear, cal.currentMonthIndex, cal.currentDay, cal).name}</span>
            </div>
          </div>

          <!-- Holidays / Special Events Today -->
          {#if holidaysToday.length > 0}
            <div class="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-600/50 space-y-1.5 animate-in fade-in">
              <div class="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                <Sparkles class="w-3.5 h-3.5" />
                <span>Festival em Vigor Hoje:</span>
              </div>
              {#each holidaysToday as h}
                <div class="text-xs text-zinc-100 font-semibold">{h.name}</div>
                {#if h.description}
                  <p class="text-[11px] text-zinc-300 leading-relaxed">{h.description}</p>
                {/if}
              {/each}
            </div>
          {/if}

          <!-- Moon Phases Widget -->
          <div class="space-y-2">
            <h3 class="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Moon class="w-3.5 h-3.5 text-amber-400" />
              <span>Fases Lunares em {cal.currentDay} de {cal.months[cal.currentMonthIndex]?.name}</span>
            </h3>

            {#if moonPhasesToday.length > 0}
              <div class="space-y-2">
                {#each moonPhasesToday as mp}
                  <div class="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-2 shadow-xs">
                    <div class="flex items-center gap-2.5">
                      <div class="text-2xl">{mp.phaseIcon}</div>
                      <div>
                        <div class="font-bold text-xs text-zinc-100">{mp.moon.name}</div>
                        <div class="text-[11px] text-amber-400 font-medium">{mp.phaseName}</div>
                      </div>
                    </div>

                    <div class="text-right">
                      <div class="text-xs font-mono font-bold text-zinc-200">{mp.illuminationPercent}%</div>
                      <div class="text-[10px] text-zinc-500">Iluminação</div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="p-3 rounded-xl border border-zinc-800 bg-zinc-950 text-center text-[11px] text-zinc-500">
                Nenhuma lua celeste configurada.
              </div>
            {/if}
          </div>

          <!-- GM Session Tip -->
          <div class="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1.5 mt-auto">
            <div class="flex items-center gap-1 text-amber-400 font-semibold">
              <Clock class="w-3 h-3" />
              <span>Sincronização com o Mural</span>
            </div>
            <p class="leading-relaxed">
              Alterações de data sincronizam automaticamente com os marcadores de sessão, lore e linha do tempo da campanha.
            </p>
          </div>
        </aside>
      </div>
    </div>
  </div>
{/if}
