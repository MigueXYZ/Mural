<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { X, Map as MapIcon, Upload, Globe, Image as ImageIcon, Sparkles, Check } from 'lucide-svelte';
  import type { MapData } from '../../types';

  let {
    isOpen = $bindable(false),
    mode = 'create',
    mapToEdit = null,
    onSave,
  }: {
    isOpen: boolean;
    mode?: 'create' | 'edit';
    mapToEdit?: MapData | null;
    onSave?: (savedMap: MapData) => void;
  } = $props();

  let title = $state('');
  let imageUrl = $state('');
  let imageSourceType = $state<'url' | 'upload'>('url');
  let imageError = $state(false);
  let isDraggingFile = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  const presetMaps = [
    {
      name: 'Província / Fantasia',
      url: 'https://images.unsplash.com/photo-1524654458049-e36be0721fa2?auto=format&fit=crop&w=1600&q=80',
    },
    {
      name: 'Masmorra / Ruínas',
      url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80',
    },
    {
      name: 'Mares / Costa',
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
    },
  ];

  $effect(() => {
    if (isOpen) {
      imageError = false;
      if (mode === 'edit' && mapToEdit) {
        title = mapToEdit.title || mapToEdit.name || '';
        imageUrl = mapToEdit.imageUrl || '';
        imageSourceType = mapToEdit.imageUrl?.startsWith('data:') ? 'upload' : 'url';
      } else {
        title = '';
        imageUrl = '';
        imageSourceType = 'url';
      }
    }
  });

  function handleFileSelected(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      processFile(target.files[0]);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDraggingFile = false;
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }

  function processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecione um ficheiro de imagem válido (PNG, JPG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        imageUrl = event.target.result as string;
        imageError = false;
        if (!title.trim()) {
          // Suggest name from file name without extension
          title = file.name.replace(/\.[^/.]+$/, '');
        }
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    if (!title.trim() || !imageUrl.trim()) return;

    if (mode === 'edit' && mapToEdit) {
      campaignStore.updateMap(mapToEdit.id, {
        title: title.trim(),
        name: title.trim(),
        imageUrl: imageUrl.trim(),
      });
      if (onSave) {
        onSave({ ...mapToEdit, title: title.trim(), name: title.trim(), imageUrl: imageUrl.trim() });
      }
    } else {
      const created = campaignStore.addMap(title.trim(), imageUrl.trim());
      if (onSave) {
        onSave(created);
      }
    }

    isOpen = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      isOpen = false;
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div
      class="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <MapIcon class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-zinc-100">
              {mode === 'edit' ? 'Editar Mapa do Atlas' : 'Adicionar Novo Mapa ao Atlas'}
            </h2>
            <p class="text-xs text-zinc-400">
              {mode === 'edit' ? 'Altere o nome ou imagem do mapa' : 'Configure a imagem e nome do mapa cartográfico'}
            </p>
          </div>
        </div>
        <button
          onclick={() => (isOpen = false)}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4 text-xs">
        <!-- Title Input -->
        <div>
          <label for="map-title-input" class="block font-medium text-zinc-300 mb-1.5">
            Nome do Mapa <span class="text-amber-400">*</span>
          </label>
          <input
            id="map-title-input"
            type="text"
            placeholder="Ex: Continente de Faerûn, Taverna do Javali, Cidade Baixa..."
            bind:value={title}
            required
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
          />
        </div>

        <!-- Image Source Selector Tabs -->
        <div>
          <span class="block font-medium text-zinc-300 mb-2">Origem da Imagem</span>
          <div class="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onclick={() => (imageSourceType = 'url')}
              class="py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-medium transition cursor-pointer {imageSourceType === 'url'
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <Globe class="w-3.5 h-3.5" />
              <span>Link / URL da Web</span>
            </button>
            <button
              type="button"
              onclick={() => (imageSourceType = 'upload')}
              class="py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-medium transition cursor-pointer {imageSourceType === 'upload'
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
            >
              <Upload class="w-3.5 h-3.5" />
              <span>Carregar do Computador</span>
            </button>
          </div>

          {#if imageSourceType === 'url'}
            <div class="space-y-2">
              <input
                type="url"
                placeholder="https://exemplo.com/mapa.jpg"
                bind:value={imageUrl}
                oninput={() => (imageError = false)}
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
              />

              <!-- Quick Presets -->
              <div class="flex items-center gap-1.5 flex-wrap pt-1">
                <span class="text-[10px] text-zinc-500">Exemplos rápidos:</span>
                {#each presetMaps as preset}
                  <button
                    type="button"
                    onclick={() => { imageUrl = preset.url; if (!title.trim()) title = preset.name; imageError = false; }}
                    class="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-[10px] text-zinc-300 border border-zinc-700 transition cursor-pointer"
                  >
                    {preset.name}
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <!-- File Upload Zone -->
            <button
              type="button"
              ondragover={(e) => { e.preventDefault(); isDraggingFile = true; }}
              ondragleave={() => (isDraggingFile = false)}
              ondrop={handleDrop}
              onclick={() => fileInput?.click()}
              class="w-full border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 {isDraggingFile
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-950/70'}"
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                bind:this={fileInput}
                onchange={handleFileSelected}
                class="hidden"
              />
              <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300">
                <Upload class="w-5 h-5" />
              </div>
              <div>
                <p class="text-xs font-medium text-zinc-200">Clique para carregar ou arraste a imagem aqui</p>
                <p class="text-[10px] text-zinc-500 mt-0.5">PNG, JPG ou WEBP</p>
              </div>
            </button>
          {/if}
        </div>

        <!-- Image Preview -->
        {#if imageUrl}
          <div>
            <span class="block font-medium text-zinc-300 mb-1.5">Pré-visualização</span>
            <div class="relative w-full h-36 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center">
              {#if imageError}
                <div class="text-center p-3 text-rose-400 text-xs">
                  <ImageIcon class="w-6 h-6 mx-auto mb-1 opacity-70" />
                  <span>Não foi possível carregar a imagem deste link.</span>
                </div>
              {:else}
                <img
                  src={imageUrl}
                  alt="Pré-visualização do Mapa"
                  onerror={() => (imageError = true)}
                  class="w-full h-full object-cover"
                />
              {/if}
            </div>
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
          <button
            type="button"
            onclick={() => (isOpen = false)}
            class="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !imageUrl.trim() || imageError}
            class="px-5 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
          >
            {#if mode === 'edit'}
              <Check class="w-3.5 h-3.5" />
              <span>Guardar Alterações</span>
            {:else}
              <Sparkles class="w-3.5 h-3.5" />
              <span>Criar Mapa</span>
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
