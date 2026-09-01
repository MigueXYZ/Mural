<!-- File: src/lib/components/calendar/CalendarConfigModal.svelte -->
<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import type {
    CustomCalendarConfig,
    CalendarMonth,
    MoonPhaseConfig,
    CalendarHoliday,
  } from '../../types';
  import {
    CALENDAR_PRESETS,
    getDaysInYear,
  } from '../../services/calendar/calendarEngine';
  import {
    X,
    Calendar,
    Check,
    Plus,
    Trash2,
    Sliders,
    Moon,
    Sparkles,
    Sun,
    RotateCcw,
    Layers,
    Clock,
    BookOpen,
    HelpCircle,
  } from 'lucide-svelte';

  // Working copy of calendar config
  let config = $state<CustomCalendarConfig>(
    JSON.parse(JSON.stringify(campaignStore.activeCalendar))
  );

  let activeTab = $state<'general' | 'months' | 'weekdays' | 'leap' | 'moons' | 'holidays'>('general');

  let newWeekdayInput = $state('');
  let newHolidayName = $state('');
  let newHolidayMonth = $state(0);
  let newHolidayDay = $state(1);
  let newHolidayDesc = $state('');

  function applyPreset(preset: CustomCalendarConfig) {
    if (confirm(`Substituir configuração pelo preset "${preset.name}"?`)) {
      config = JSON.parse(JSON.stringify(preset));
    }
  }

  function addMonth() {
    const newM: CalendarMonth = {
      id: `m-${Date.now()}`,
      name: `Mês ${config.months.length + 1}`,
      days: 30,
      season: 'Primavera',
    };
    config.months = [...config.months, newM];
  }

  function removeMonth(index: number) {
    if (config.months.length <= 1) {
      alert('O calendário precisa de pelo menos 1 mês.');
      return;
    }
    config.months = config.months.filter((_, i) => i !== index);
    if (config.currentMonthIndex >= config.months.length) {
      config.currentMonthIndex = Math.max(0, config.months.length - 1);
    }
  }

  function addWeekday() {
    const trimmed = newWeekdayInput.trim();
    if (trimmed && !config.weekdays.includes(trimmed)) {
      config.weekdays = [...config.weekdays, trimmed];
      newWeekdayInput = '';
    }
  }

  function removeWeekday(index: number) {
    if (config.weekdays.length <= 1) {
      alert('O calendário precisa de pelo menos 1 dia da semana.');
      return;
    }
    config.weekdays = config.weekdays.filter((_, i) => i !== index);
  }

  function addMoon() {
    const newMoon: MoonPhaseConfig = {
      id: `moon-${Date.now()}`,
      name: `Lua ${ (config.moons?.length || 0) + 1 }`,
      cycleDays: 28,
      startingPhaseDay: 0,
      color: '#e2e8f0',
    };
    config.moons = [...(config.moons || []), newMoon];
  }

  function removeMoon(index: number) {
    config.moons = (config.moons || []).filter((_, i) => i !== index);
  }

  function addHoliday() {
    if (!newHolidayName.trim()) return;
    const h: CalendarHoliday = {
      id: `h-${Date.now()}`,
      name: newHolidayName.trim(),
      monthIndex: newHolidayMonth,
      day: newHolidayDay,
      description: newHolidayDesc.trim(),
    };
    config.holidays = [...(config.holidays || []), h];
    newHolidayName = '';
    newHolidayDesc = '';
  }

  function removeHoliday(id: string) {
    config.holidays = (config.holidays || []).filter((h) => h.id !== id);
  }

  function handleSave() {
    campaignStore.updateCustomCalendar(config);
    campaignStore.closeCalendarConfig();
  }
</script>

{#if campaignStore.isCalendarConfigOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-150 font-sans"
    onclick={(e) => { if (e.target === e.currentTarget) campaignStore.closeCalendarConfig(); }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="w-full max-w-4xl max-h-[92vh] bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Calendar class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>Personalizar Calendário Custom</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                {getDaysInYear(config.currentYear, config)} dias/ano
              </span>
            </h2>
            <p class="text-[11px] text-zinc-400">
              Configura meses, semanas, anos bissextos, luas e festivais para a tua campanha
            </p>
          </div>
        </div>

        <button
          type="button"
          onclick={() => campaignStore.closeCalendarConfig()}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-1.5 px-6 pt-2.5 border-b border-zinc-800 bg-zinc-950/50 text-xs overflow-x-auto">
        <button
          type="button"
          onclick={() => (activeTab = 'general')}
          class="px-3.5 py-2 rounded-t-xl font-medium flex items-center gap-1.5 transition border-b-2 cursor-pointer {activeTab === 'general'
            ? 'border-amber-400 text-amber-300 bg-zinc-900'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
        >
          <Sliders class="w-3.5 h-3.5" />
          <span>Geral & Presets</span>
        </button>

        <button
          type="button"
          onclick={() => (activeTab = 'months')}
          class="px-3.5 py-2 rounded-t-xl font-medium flex items-center gap-1.5 transition border-b-2 cursor-pointer {activeTab === 'months'
            ? 'border-amber-400 text-amber-300 bg-zinc-900'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
        >
          <Layers class="w-3.5 h-3.5" />
          <span>Meses ({config.months.length})</span>
        </button>

        <button
          type="button"
          onclick={() => (activeTab = 'weekdays')}
          class="px-3.5 py-2 rounded-t-xl font-medium flex items-center gap-1.5 transition border-b-2 cursor-pointer {activeTab === 'weekdays'
            ? 'border-amber-400 text-amber-300 bg-zinc-900'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
        >
          <Calendar class="w-3.5 h-3.5" />
          <span>Dias da Semana ({config.weekdays.length})</span>
        </button>

        <button
          type="button"
          onclick={() => (activeTab = 'leap')}
          class="px-3.5 py-2 rounded-t-xl font-medium flex items-center gap-1.5 transition border-b-2 cursor-pointer {activeTab === 'leap'
            ? 'border-amber-400 text-amber-300 bg-zinc-900'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
        >
          <Clock class="w-3.5 h-3.5" />
          <span>Anos Bissextos</span>
        </button>

        <button
          type="button"
          onclick={() => (activeTab = 'moons')}
          class="px-3.5 py-2 rounded-t-xl font-medium flex items-center gap-1.5 transition border-b-2 cursor-pointer {activeTab === 'moons'
            ? 'border-amber-400 text-amber-300 bg-zinc-900'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
        >
          <Moon class="w-3.5 h-3.5" />
          <span>Fases da Lua ({config.moons?.length || 0})</span>
        </button>

        <button
          type="button"
          onclick={() => (activeTab = 'holidays')}
          class="px-3.5 py-2 rounded-t-xl font-medium flex items-center gap-1.5 transition border-b-2 cursor-pointer {activeTab === 'holidays'
            ? 'border-amber-400 text-amber-300 bg-zinc-900'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>Festivais ({config.holidays?.length || 0})</span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-zinc-200">
        <!-- TAB 1: GERAL & PRESETS -->
        {#if activeTab === 'general'}
          <div class="space-y-5">
            <!-- Preset Cards Grid -->
            <div>
              <span class="block text-zinc-400 font-medium mb-2">Modelos Prontos (Presets Populares)</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {#each CALENDAR_PRESETS as preset}
                  <button
                    type="button"
                    onclick={() => applyPreset(preset)}
                    class="p-3 rounded-2xl border text-left flex flex-col justify-between gap-2 transition cursor-pointer {config.name ===
                    preset.name
                      ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-400/30'
                      : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'}"
                  >
                    <div>
                      <div class="font-bold text-xs text-zinc-100 flex items-center justify-between">
                        <span>{preset.name}</span>
                        {#if config.name === preset.name}
                          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                        {/if}
                      </div>
                      <p class="text-[10px] text-zinc-400 mt-1 line-clamp-2">{preset.description}</p>
                    </div>
                    <div class="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                      <span>{preset.months.length} meses</span>
                      <span>•</span>
                      <span>{preset.weekdays.length} dias/sem</span>
                    </div>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Basic Info Fields -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <div class="sm:col-span-2">
                <label for="cal-name-input" class="block font-medium text-zinc-300 mb-1">Nome do Calendário</label>
                <input
                  id="cal-name-input"
                  type="text"
                  bind:value={config.name}
                  placeholder="Ex: Calendário Solar de Vallenmoor"
                  class="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label for="cal-year-prefix" class="block font-medium text-zinc-300 mb-1">Prefixo do Ano</label>
                <input
                  id="cal-year-prefix"
                  type="text"
                  bind:value={config.yearPrefix}
                  placeholder="Ex: Ano, Ciclo, Era"
                  class="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label for="cal-year-suffix" class="block font-medium text-zinc-300 mb-1">Sufixo do Ano</label>
                <input
                  id="cal-year-suffix"
                  type="text"
                  bind:value={config.yearSuffix}
                  placeholder="Ex: DR, da 3ª Era, AC"
                  class="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>
          </div>

        <!-- TAB 2: MESES -->
        {:else if activeTab === 'months'}
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold text-zinc-100">Configuração de Meses & Duração</h3>
                <p class="text-[11px] text-zinc-400">Define o nome, quantidade de dias e estação de cada mês</p>
              </div>
              <button
                type="button"
                onclick={addMonth}
                class="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Adicionar Mês</span>
              </button>
            </div>

            <div class="space-y-2 max-h-96 overflow-y-auto pr-1">
              {#each config.months as month, idx (month.id || idx)}
                <div class="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-3">
                  <span class="w-6 text-center text-xs font-mono text-zinc-500">{idx + 1}.</span>
                  
                  <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      bind:value={month.name}
                      placeholder="Nome do Mês"
                      class="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 font-medium focus:outline-none focus:border-amber-500/60"
                    />

                    <div class="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        bind:value={month.days}
                        class="w-20 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-amber-400 font-mono text-center focus:outline-none focus:border-amber-500/60"
                      />
                      <span class="text-[11px] text-zinc-500">dias</span>
                    </div>

                    <select
                      bind:value={month.season}
                      class="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-amber-500/60"
                    >
                      <option value="Inverno">❄️ Inverno</option>
                      <option value="Primavera">🌸 Primavera</option>
                      <option value="Verão">☀️ Verão</option>
                      <option value="Outono">🍂 Outono</option>
                      <option value="Especial">✨ Especial / Festival</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onclick={() => removeMonth(idx)}
                    class="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                    title="Remover Mês"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              {/each}
            </div>
          </div>

        <!-- TAB 3: DIAS DA SEMANA -->
        {:else if activeTab === 'weekdays'}
          <div class="space-y-4">
            <div>
              <h3 class="text-xs font-bold text-zinc-100">Estrutura da Semana</h3>
              <p class="text-[11px] text-zinc-400">Nomes e ciclo de dias que compõem cada semana no teu mundo</p>
            </div>

            <!-- Add Weekday Form -->
            <div class="flex items-center gap-2 p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <input
                type="text"
                placeholder="Nome do dia (ex: Solstício, Lunare, Terçum...)"
                bind:value={newWeekdayInput}
                onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addWeekday())}
                class="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
              <button
                type="button"
                onclick={addWeekday}
                disabled={!newWeekdayInput.trim()}
                class="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Adicionar Dia</span>
              </button>
            </div>

            <!-- Weekdays List -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {#each config.weekdays as dayName, idx}
                <div class="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-2 group">
                  <div class="flex items-center gap-2">
                    <span class="w-5 h-5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      bind:value={config.weekdays[idx]}
                      class="px-2 py-1 bg-transparent border-b border-transparent focus:border-amber-500 text-xs text-zinc-100 font-medium focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onclick={() => removeWeekday(idx)}
                    class="text-zinc-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              {/each}
            </div>
          </div>

        <!-- TAB 4: ANOS BISSEXTOS -->
        {:else if activeTab === 'leap'}
          <div class="space-y-4">
            <div>
              <h3 class="text-xs font-bold text-zinc-100">Regras de Anos Bissextos</h3>
              <p class="text-[11px] text-zinc-400">Adiciona dias extras intercalares em intervalos periódicos de anos</p>
            </div>

            <div class="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
              <label class="flex items-center justify-between cursor-pointer">
                <div>
                  <div class="font-semibold text-xs text-zinc-100">Ativar Anos Bissextos</div>
                  <div class="text-[10px] text-zinc-400">Permite adicionar dias a cada X anos (como Shieldmeet ou 29 de Fev)</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(config.leapYearRule?.enabled)}
                  onchange={(e) => {
                    config.leapYearRule = {
                      enabled: (e.target as HTMLInputElement).checked,
                      intervalYears: config.leapYearRule?.intervalYears || 4,
                      monthIndex: config.leapYearRule?.monthIndex || 0,
                      extraDays: config.leapYearRule?.extraDays || 1,
                    };
                  }}
                  class="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500/30 accent-amber-500 cursor-pointer"
                />
              </label>

              {#if config.leapYearRule?.enabled}
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-800/80">
                  <div>
                    <label for="leap-interval" class="block font-medium text-zinc-300 mb-1">Intervalo de Anos</label>
                    <input
                      id="leap-interval"
                      type="number"
                      min="1"
                      bind:value={config.leapYearRule.intervalYears}
                      class="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-amber-400 font-mono focus:outline-none focus:border-amber-500/60"
                    />
                    <span class="text-[10px] text-zinc-500">Ex: A cada 4 anos</span>
                  </div>

                  <div>
                    <label for="leap-month" class="block font-medium text-zinc-300 mb-1">Mês que Recebe o Dia</label>
                    <select
                      id="leap-month"
                      bind:value={config.leapYearRule.monthIndex}
                      class="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60"
                    >
                      {#each config.months as m, idx}
                        <option value={idx}>{idx + 1}. {m.name}</option>
                      {/each}
                    </select>
                    <span class="text-[10px] text-zinc-500">Mês onde o dia extra ocorre</span>
                  </div>

                  <div>
                    <label for="leap-extra" class="block font-medium text-zinc-300 mb-1">Dias Adicionais</label>
                    <input
                      id="leap-extra"
                      type="number"
                      min="1"
                      max="30"
                      bind:value={config.leapYearRule.extraDays}
                      class="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-amber-400 font-mono focus:outline-none focus:border-amber-500/60"
                    />
                    <span class="text-[10px] text-zinc-500">Ex: +1 dia</span>
                  </div>
                </div>
              {/if}
            </div>
          </div>

        <!-- TAB 5: LUAS & CICLOS LUNARES -->
        {:else if activeTab === 'moons'}
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold text-zinc-100">Satélites Celestes & Fases da Lua</h3>
                <p class="text-[11px] text-zinc-400">Configura múltiplas luas celestes, ciclos em dias e iluminação</p>
              </div>
              <button
                type="button"
                onclick={addMoon}
                class="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Adicionar Lua</span>
              </button>
            </div>

            {#if (config.moons || []).length > 0}
              <div class="space-y-3">
                {#each config.moons || [] as moon, idx (moon.id || idx)}
                  <div class="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 shadow-md"
                      style="background-color: {moon.color || '#e2e8f0'}20; color: {moon.color || '#e2e8f0'}; border: 1px solid {moon.color || '#e2e8f0'}40;"
                    >
                      🌕
                    </div>

                    <div class="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div class="sm:col-span-2">
                        <label for={`moon-name-${idx}`} class="text-[10px] text-zinc-400 block mb-0.5">Nome da Lua</label>
                        <input
                          id={`moon-name-${idx}`}
                          type="text"
                          bind:value={moon.name}
                          placeholder="Ex: Selûne, Lua de Sangue"
                          class="w-full px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                        />
                      </div>

                      <div>
                        <label for={`moon-cycle-${idx}`} class="text-[10px] text-zinc-400 block mb-0.5">Ciclo (Dias)</label>
                        <input
                          id={`moon-cycle-${idx}`}
                          type="number"
                          step="0.1"
                          min="1"
                          bind:value={moon.cycleDays}
                          class="w-full px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-amber-400 font-mono text-center focus:outline-none focus:border-amber-500/60"
                        />
                      </div>

                      <div>
                        <label for={`moon-offset-${idx}`} class="text-[10px] text-zinc-400 block mb-0.5">Deslocamento</label>
                        <input
                          id={`moon-offset-${idx}`}
                          type="number"
                          min="0"
                          bind:value={moon.startingPhaseDay}
                          class="w-full px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 font-mono text-center focus:outline-none focus:border-amber-500/60"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onclick={() => removeMoon(idx)}
                      class="p-1.5 text-zinc-500 hover:text-rose-400 cursor-pointer"
                      title="Remover Lua"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="p-8 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2 bg-zinc-950/40">
                <Moon class="w-8 h-8 mx-auto text-zinc-600" />
                <h4 class="text-xs font-semibold text-zinc-300">Sem Luas Configuradas</h4>
                <p class="text-[11px] text-zinc-500 max-w-xs mx-auto">
                  Adiciona uma ou mais luas para calcular automaticamente fases lunares durante a sessão.
                </p>
                <button
                  type="button"
                  onclick={addMoon}
                  class="px-4 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition cursor-pointer"
                >
                  Adicionar Primeira Lua
                </button>
              </div>
            {/if}
          </div>

        <!-- TAB 6: FESTIVAIS & FERIADOS -->
        {:else if activeTab === 'holidays'}
          <div class="space-y-4">
            <div>
              <h3 class="text-xs font-bold text-zinc-100">Festivais, Feriados & Solstícios</h3>
              <p class="text-[11px] text-zinc-400">Dias comemorativos anuais marcados no calendário da campanha</p>
            </div>

            <!-- Add Holiday Form -->
            <div class="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Nome do Festival (ex: Midsummer, Solstício)"
                  bind:value={newHolidayName}
                  class="sm:col-span-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                />

                <div class="grid grid-cols-2 gap-1.5">
                  <select
                    bind:value={newHolidayMonth}
                    class="px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60"
                  >
                    {#each config.months as m, idx}
                      <option value={idx}>{m.name}</option>
                    {/each}
                  </select>

                  <input
                    type="number"
                    min="1"
                    placeholder="Dia"
                    bind:value={newHolidayDay}
                    class="px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-amber-400 font-mono text-center focus:outline-none focus:border-amber-500/60"
                  />
                </div>
              </div>

              <div class="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Descrição ou tradições do festival..."
                  bind:value={newHolidayDesc}
                  class="flex-1 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-amber-500/60"
                />
                <button
                  type="button"
                  onclick={addHoliday}
                  disabled={!newHolidayName.trim()}
                  class="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>

            <!-- Holidays List -->
            {#if (config.holidays || []).length > 0}
              <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
                {#each config.holidays || [] as h (h.id)}
                  <div class="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-3 group">
                    <div>
                      <div class="font-semibold text-xs text-amber-300 flex items-center gap-2">
                        <span>{h.name}</span>
                        <span class="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-700 text-zinc-400 font-mono">
                          Dia {h.day} de {config.months[h.monthIndex]?.name || `Mês ${h.monthIndex + 1}`}
                        </span>
                      </div>
                      {#if h.description}
                        <p class="text-[11px] text-zinc-400 mt-0.5">{h.description}</p>
                      {/if}
                    </div>

                    <button
                      type="button"
                      onclick={() => removeHoliday(h.id)}
                      class="text-zinc-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-[11px] text-zinc-500 italic text-center py-4">Nenhum festival registrado.</p>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <button
          type="button"
          onclick={() => (config = JSON.parse(JSON.stringify(campaignStore.activeCalendar)))}
          class="px-3 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1.5 transition cursor-pointer"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Restaurar</span>
        </button>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => campaignStore.closeCalendarConfig()}
            class="px-4 py-1.5 rounded-xl text-xs text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onclick={handleSave}
            class="px-5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 hover:from-amber-400 hover:to-amber-300 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Check class="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Guardar Configuração</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
