<!-- File: src/lib/components/audio/PlaylistManagerModal.svelte -->
<script lang="ts">
  import { audioEngine, DEFAULT_PLAYLISTS } from '../../services/audio/audioEngine.svelte';
  import type { AudioPlaylist, AudioTrack } from '../../types';
  import {
    X,
    Music,
    Plus,
    Trash2,
    Play,
    Pause,
    FolderPlus,
    Upload,
    Swords,
    Search,
    Compass,
    Beer,
    Skull,
    Folder,
    Volume2,
  } from 'lucide-svelte';

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  let selectedPlaylistId = $state<string>(audioEngine.playlists[0]?.id || '');
  let newPlaylistName = $state('');
  let newPlaylistCategory = $state<AudioPlaylist['category']>('custom');
  let fileInputRef = $state<HTMLInputElement | null>(null);
  let folderInputRef = $state<HTMLInputElement | null>(null);

  const activePlaylist = $derived(
    audioEngine.playlists.find((p) => p.id === selectedPlaylistId) || audioEngine.playlists[0]
  );

  function handleCreatePlaylist() {
    if (!newPlaylistName.trim()) return;
    const created = audioEngine.createPlaylist(newPlaylistName.trim(), newPlaylistCategory);
    selectedPlaylistId = created.id;
    newPlaylistName = '';
  }

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0 && activePlaylist) {
      await audioEngine.addFilesToPlaylist(activePlaylist.id, input.files);
      input.value = '';
    }
  }

  async function handleFolderSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      // Find folder name if available
      const firstPath = (input.files[0] as any).webkitRelativePath || '';
      const folderName = firstPath.split('/')[0] || 'Pasta de Músicas';
      await audioEngine.importFromDirectory(input.files, folderName);
      if (audioEngine.currentPlaylist) {
        selectedPlaylistId = audioEngine.currentPlaylist.id;
      }
      input.value = '';
    }
  }

  function getCategoryIcon(cat?: string) {
    switch (cat) {
      case 'combat':
        return Swords;
      case 'mystery':
        return Search;
      case 'exploration':
        return Compass;
      case 'tavern':
        return Beer;
      case 'horror':
        return Skull;
      default:
        return Folder;
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    onclick={(e) => { if (e.target === e.currentTarget) isOpen = false; }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="w-full max-w-3xl max-h-[85vh] bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Music class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-zinc-100">Gestor de Playlists & Áudio Local</h2>
            <p class="text-[11px] text-zinc-400">Organiza trilhas sonoras locais para diferentes momentos da sessão</p>
          </div>
        </div>
        <button
          onclick={() => (isOpen = false)}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Main Body: Sidebar + Track List -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Playlists Sidebar -->
        <aside class="w-64 border-r border-zinc-800 bg-zinc-950/60 p-3 flex flex-col justify-between overflow-y-auto select-none">
          <div class="space-y-1">
            <div class="text-[10px] font-bold text-zinc-500 uppercase px-2 py-1">As Tuas Playlists</div>

            {#each audioEngine.playlists as pl}
              {@const Icon = getCategoryIcon(pl.category)}
              <div
                class="w-full group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition {activePlaylist?.id ===
                pl.id
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'}"
              >
                <button
                  type="button"
                  class="flex items-center gap-2 truncate flex-1 text-left cursor-pointer bg-transparent border-0 p-0 text-inherit font-inherit"
                  onclick={() => (selectedPlaylistId = pl.id)}
                >
                  <Icon class="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                  <span class="truncate">{pl.name}</span>
                </button>
                <div class="flex items-center gap-1.5 pl-1.5">
                  <span class="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-500 font-mono">
                    {pl.tracks.length}
                  </span>
                  {#if !DEFAULT_PLAYLISTS.some((d) => d.id === pl.id)}
                    <button
                      type="button"
                      onclick={(e) => {
                        e.stopPropagation();
                        audioEngine.deletePlaylist(pl.id);
                      }}
                      class="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition p-0.5 cursor-pointer"
                    >
                      <Trash2 class="w-3 h-3" />
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>

          <!-- Create Playlist Form -->
          <div class="pt-3 border-t border-zinc-800/80 space-y-2">
            <input
              type="text"
              placeholder="Nome da Playlist..."
              bind:value={newPlaylistName}
              class="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
            />
            <div class="flex items-center gap-2">
              <select
                bind:value={newPlaylistCategory}
                class="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] text-zinc-300 focus:outline-none"
              >
                <option value="custom">Geral / Livre</option>
                <option value="combat">Combate</option>
                <option value="mystery">Mistério</option>
                <option value="exploration">Exploração</option>
                <option value="tavern">Taverna</option>
                <option value="horror">Terror</option>
              </select>
              <button
                type="button"
                onclick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                class="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 disabled:opacity-30 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Criar</span>
              </button>
            </div>
          </div>
        </aside>

        <!-- Tracks Panel -->
        <main class="flex-1 p-6 overflow-y-auto space-y-4">
          {#if activePlaylist}
            <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div>
                <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <span>{activePlaylist.name}</span>
                </h3>
                <p class="text-xs text-zinc-400">
                  {activePlaylist.tracks.length} {activePlaylist.tracks.length === 1 ? 'faixa' : 'faixas'} configuradas
                </p>
              </div>

              <!-- Upload / Add Local Files & Folder Buttons -->
              <div class="flex items-center gap-2">
                <input
                  type="file"
                  multiple
                  accept="audio/mp3,audio/wav,audio/ogg,audio/flac,audio/m4a,audio/*"
                  class="hidden"
                  bind:this={fileInputRef}
                  onchange={handleFileSelect}
                />
                <input
                  type="file"
                  /* @ts-ignore */
                  webkitdirectory="true"
                  directory="true"
                  multiple
                  class="hidden"
                  bind:this={folderInputRef}
                  onchange={handleFolderSelect}
                />
                <button
                  type="button"
                  onclick={() => folderInputRef?.click()}
                  class="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 border border-zinc-700 cursor-pointer"
                  title="Importar todos os ficheiros de áudio de uma pasta do computador"
                >
                  <FolderPlus class="w-3.5 h-3.5" />
                  <span>Importar Pasta</span>
                </button>
                <button
                  type="button"
                  onclick={() => fileInputRef?.click()}
                  class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 hover:from-amber-400 hover:to-amber-300 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Upload class="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ Ficheiros (.mp3)</span>
                </button>
              </div>
            </div>

            <!-- Tracks Table -->
            {#if activePlaylist.tracks.length > 0}
              <div class="space-y-1.5">
                {#each activePlaylist.tracks as track, idx (track.id)}
                  {@const isThisPlaying = audioEngine.currentMusicTrack?.id === track.id && audioEngine.isPlayingMusic}
                  <div
                    class="p-2.5 rounded-xl border flex items-center justify-between gap-3 transition group {isThisPlaying
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                      : 'bg-zinc-950/80 border-zinc-800 text-zinc-300 hover:border-zinc-700'}"
                  >
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onclick={() => {
                          if (isThisPlaying) {
                            audioEngine.pauseMusic();
                          } else {
                            audioEngine.playMusic(track, activePlaylist);
                          }
                        }}
                        class="w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer {isThisPlaying
                          ? 'bg-amber-500 text-zinc-950 font-bold'
                          : 'bg-zinc-900 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800'}"
                      >
                        {#if isThisPlaying}
                          <Pause class="w-3.5 h-3.5" />
                        {:else}
                          <Play class="w-3.5 h-3.5 ml-0.5" />
                        {/if}
                      </button>

                      <div class="min-w-0 flex-1">
                        <div class="text-xs font-semibold truncate text-zinc-100">{track.title}</div>
                        <div class="text-[10px] text-zinc-500 truncate">{track.artist || 'Local'}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onclick={() => audioEngine.removeTrackFromPlaylist(activePlaylist.id, track.id)}
                      class="text-zinc-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      title="Remover faixa da playlist"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="p-8 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2 bg-zinc-950/40">
                <Music class="w-8 h-8 mx-auto text-zinc-600" />
                <h4 class="text-xs font-semibold text-zinc-300">Playlist Vazia</h4>
                <p class="text-[11px] text-zinc-500 max-w-xs mx-auto">
                  Clica no botão acima para carregar as tuas faixas locais de música e efeitos.
                </p>
              </div>
            {/if}
          {/if}
        </main>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-3 border-t border-zinc-800 bg-zinc-950 flex justify-end">
        <button
          onclick={() => (isOpen = false)}
          class="px-5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
{/if}
