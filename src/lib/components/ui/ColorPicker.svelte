<!-- File: src/lib/components/ui/ColorPicker.svelte -->
<script lang="ts">
  import { Check, RotateCcw, Palette, X } from 'lucide-svelte';
  import {
    recentColors,
    DEFAULT_PRESET_COLORS,
    isValidHex,
    normalizeHex,
  } from '../../stores/recentColorsStore.svelte';

  let {
    value = $bindable(''),
    label = 'Cor',
    showPresets = true,
    showRecent = true,
    allowEmpty = false,
    emptyLabel = 'Padrão / Herdado',
    oninput,
    onchange,
  }: {
    value?: string;
    label?: string;
    showPresets?: boolean;
    showRecent?: boolean;
    allowEmpty?: boolean;
    emptyLabel?: string;
    oninput?: (color: string) => void;
    onchange?: (color: string) => void;
  } = $props();

  let hexInput = $state(value || '');

  $effect(() => {
    hexInput = value || '';
  });

  const pickerHex = $derived(isValidHex(value || '') ? normalizeHex(value || '') : '#d4a359');
  const hasValue = $derived(isValidHex(value || ''));

  function handleSelectColor(color: string) {
    const norm = normalizeHex(color);
    value = norm;
    hexInput = norm;
    recentColors.addColor(norm);
    oninput?.(norm);
    onchange?.(norm);
  }

  function handleLiveInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const color = target.value;
    value = color;
    hexInput = color;
    oninput?.(color);
  }

  function handleCommitChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const color = target.value;
    value = color;
    hexInput = color;
    recentColors.addColor(color);
    oninput?.(color);
    onchange?.(color);
  }

  function handleHexBlur() {
    let clean = hexInput.trim();
    if (!clean) {
      if (allowEmpty) {
        handleClearColor();
      } else {
        hexInput = value || '';
      }
      return;
    }
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (isValidHex(clean)) {
      handleSelectColor(clean);
    } else {
      hexInput = value || '';
    }
  }

  function handleClearColor() {
    value = '';
    hexInput = '';
    oninput?.('');
    onchange?.('');
  }
</script>

<div class="space-y-3 p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800">
  <!-- Header: Label, Live Color Badge, Hex Input & Native Picker -->
  <div class="flex items-center justify-between gap-2">
    <span class="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
      <Palette class="w-3.5 h-3.5 text-zinc-400" />
      <span>{label}</span>
    </span>

    <div class="flex items-center gap-1.5">
      {#if hasValue}
        <div
          class="w-5 h-5 rounded-full border border-zinc-600 shadow-sm shrink-0"
          style="background-color: {value};"
          title="Cor atual: {value}"
        ></div>
      {:else}
        <div
          class="w-5 h-5 rounded-full border border-dashed border-zinc-600 flex items-center justify-center shrink-0 text-[9px] text-zinc-500 font-mono"
          title={emptyLabel}
        >
          ∅
        </div>
      {/if}

      <input
        type="text"
        bind:value={hexInput}
        onblur={handleHexBlur}
        onkeydown={(e) => e.key === 'Enter' && handleHexBlur()}
        class="w-20 px-1.5 py-0.5 text-[11px] font-mono rounded-md bg-zinc-900 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-amber-400"
        placeholder="#RRGGBB"
        maxlength="7"
        aria-label="Código Hexadecimal da {label}"
      />

      <input
        type="color"
        value={pickerHex}
        oninput={handleLiveInput}
        onchange={handleCommitChange}
        class="w-6 h-6 rounded cursor-pointer border border-zinc-700 bg-transparent p-0 shrink-0"
        title="Seletor de cor livre"
        aria-label="Seletor de cor interativo"
      />

      {#if allowEmpty && hasValue}
        <button
          type="button"
          onclick={handleClearColor}
          class="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          title="Limpar cor (usar padrão)"
          aria-label="Limpar cor personalizada"
        >
          <X class="w-3 h-3" />
        </button>
      {/if}
    </div>
  </div>

  <!-- Standard Palette Presets -->
  {#if showPresets}
    <div class="space-y-1.5">
      <span class="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Paleta Padrão</span>
      <div class="flex items-center gap-1.5 flex-wrap">
        {#each DEFAULT_PRESET_COLORS as preset}
          {@const isActive = Boolean(value && value.toLowerCase() === preset.hex.toLowerCase())}
          <button
            type="button"
            onclick={() => handleSelectColor(preset.hex)}
            class="w-6 h-6 rounded-full border transition-all cursor-pointer flex items-center justify-center {isActive
              ? 'scale-110 border-zinc-100 ring-2 ring-amber-400 shadow-md'
              : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100'}"
            style="background-color: {preset.hex};"
            title="{preset.name}: {preset.hex}"
            aria-label="{preset.name}: {preset.hex}"
          >
            {#if isActive}
              <Check class="w-3 h-3 text-zinc-950 stroke-[3]" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Recent Colors Section (US R6) -->
  {#if showRecent}
    <div class="space-y-1.5 pt-2 border-t border-zinc-800/80">
      <div class="flex items-center justify-between">
        <span class="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Cores Recentes</span>
        {#if recentColors.colors.length > 0}
          <button
            type="button"
            onclick={() => recentColors.clear()}
            class="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 cursor-pointer transition"
            title="Limpar histórico de cores recentes"
            aria-label="Limpar histórico de cores recentes"
          >
            <RotateCcw class="w-2.5 h-2.5" />
            <span>Limpar</span>
          </button>
        {/if}
      </div>

      {#if recentColors.colors.length === 0}
        <p class="text-[10px] text-zinc-500 italic">Nenhuma cor recente ainda.</p>
      {:else}
        <div class="flex items-center gap-1.5 flex-wrap">
          {#each recentColors.colors as color}
            {@const isActive = Boolean(value && value.toLowerCase() === color.toLowerCase())}
            <button
              type="button"
              onclick={() => handleSelectColor(color)}
              class="w-6 h-6 rounded-full border transition-all cursor-pointer flex items-center justify-center {isActive
                ? 'scale-110 border-zinc-100 ring-2 ring-amber-400 shadow-md'
                : 'border-zinc-700/60 hover:scale-105 opacity-85 hover:opacity-100'}"
              style="background-color: {color};"
              title="Reaplicar cor recente: {color}"
              aria-label="Cor recente: {color}"
            >
              {#if isActive}
                <Check class="w-3 h-3 text-zinc-950 stroke-[3]" />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
