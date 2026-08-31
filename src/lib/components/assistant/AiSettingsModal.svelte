<!-- File: src/lib/components/assistant/AiSettingsModal.svelte -->
<script lang="ts">
  import { campaignStore } from '../../stores/campaignStore.svelte';
  import { aiEngine } from '../../services/ai/aiProvider';
  import { audioEngine } from '../../services/audio/audioEngine.svelte';
  import {
    X,
    Sparkles,
    Key,
    Check,
    AlertCircle,
    Loader2,
    Bot,
    Settings,
    Sliders,
    Music,
    FolderPlus,
    Shuffle,
    Repeat,
    Volume2,
    BookOpen,
    Save,
  } from 'lucide-svelte';
  import type { CampaignSettings } from '../../types';

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  // Active Tab
  let activeTab = $state<'campaign' | 'audio' | 'ai'>('campaign');

  // 1. Campaign & General State
  let campaignName = $state('');
  let campaignDescription = $state('');
  let campaignSystem = $state('Ordem Paranormal RPG');
  let currentSession = $state(1);
  let inGamePeriod = $state('');
  let autoSaveIntervalMs = $state(500);
  let theme = $state('dark');

  // 2. Audio State
  let musicDirectoryPath = $state('');
  let audioShuffle = $state(false);
  let audioLoop = $state(true);
  let audioCrossfadeSec = $state(2.5);
  let defaultMasterVolume = $state(0.8);
  let folderInputRef = $state<HTMLInputElement | null>(null);

  // 3. AI State
  let provider = $state<CampaignSettings['aiProvider']>('mock');
  let apiKey = $state('');
  let modelName = $state('');
  let ollamaEndpoint = $state('http://localhost:11434');
  let testStatus = $state<'idle' | 'testing' | 'success' | 'failed'>('idle');

  $effect(() => {
    if (isOpen) {
      const c = campaignStore.campaign;
      const s = c.settings;

      // Campaign Sync
      campaignName = c.name || 'Nova Campanha';
      campaignDescription = c.description || '';
      campaignSystem = c.system || 'Ordem Paranormal RPG';
      currentSession = c.currentSession || 1;
      inGamePeriod = c.inGamePeriod || 'Presente';
      autoSaveIntervalMs = s?.autoSaveIntervalMs || 500;
      theme = s?.theme || 'dark';

      // Audio Sync
      musicDirectoryPath = s?.musicDirectoryPath || audioEngine.musicDirectoryPath || '';
      audioShuffle = s?.audioShuffle ?? audioEngine.isShuffle;
      audioLoop = s?.audioLoop ?? audioEngine.isLoop;
      audioCrossfadeSec = s?.audioCrossfadeSec ?? audioEngine.crossfadeSec;
      defaultMasterVolume = s?.defaultMasterVolume ?? audioEngine.masterVolume;

      // AI Sync
      provider = s?.aiProvider || 'mock';
      apiKey = s?.apiKey || '';
      modelName = s?.modelName || '';
      ollamaEndpoint = s?.ollamaEndpoint || 'http://localhost:11434';
      testStatus = 'idle';
    }
  });

  function handleFolderImport(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const firstPath = (input.files[0] as any).webkitRelativePath || '';
      const folderName = firstPath.split('/')[0] || 'Pasta Local';
      musicDirectoryPath = folderName;
      audioEngine.importFromDirectory(input.files, folderName);
      input.value = '';
    }
  }

  async function handleTestConnection() {
    testStatus = 'testing';
    const settings: CampaignSettings = {
      aiProvider: provider,
      apiKey: apiKey.trim(),
      modelName: modelName.trim(),
      ollamaEndpoint: ollamaEndpoint.trim(),
      theme,
      autoSaveIntervalMs,
    };
    const ok = await aiEngine.testConnection(settings);
    testStatus = ok ? 'success' : 'failed';
  }

  async function handleSave() {
    // 1. Update Campaign core metadata
    campaignStore.campaign.name = campaignName.trim() || 'Nova Campanha';
    campaignStore.campaign.description = campaignDescription.trim();
    campaignStore.campaign.system = campaignSystem;
    campaignStore.campaign.currentSession = Math.max(1, currentSession);
    campaignStore.campaign.inGamePeriod = inGamePeriod.trim() || 'Presente';

    // 2. Update Campaign Settings
    const newSettings: CampaignSettings = {
      ...(campaignStore.campaign.settings || {}),
      theme,
      autoSaveIntervalMs,
      musicDirectoryPath: musicDirectoryPath.trim(),
      audioShuffle,
      audioLoop,
      audioCrossfadeSec,
      defaultMasterVolume,
      aiProvider: provider,
      apiKey: apiKey.trim(),
      modelName: modelName.trim(),
      ollamaEndpoint: ollamaEndpoint.trim(),
    };
    campaignStore.campaign.settings = newSettings;

    // 3. Apply Audio Engine settings directly
    audioEngine.isShuffle = audioShuffle;
    audioEngine.isLoop = audioLoop;
    audioEngine.crossfadeSec = audioCrossfadeSec;
    audioEngine.musicDirectoryPath = musicDirectoryPath;
    audioEngine.setMasterVolume(defaultMasterVolume);

    // 4. Save to localStorage immediately
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mural_global_settings', JSON.stringify(newSettings));
        localStorage.setItem('mural_audio_shuffle', String(audioShuffle));
        localStorage.setItem('mural_audio_loop', String(audioLoop));
        localStorage.setItem('mural_master_volume', String(defaultMasterVolume));
        if (musicDirectoryPath) localStorage.setItem('mural_music_dir', musicDirectoryPath);
      }
    } catch {}

    // 5. Trigger instantaneous save to file system / storage
    await campaignStore.saveCurrentCampaign();
    isOpen = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (isOpen && e.key === 'Escape') {
      isOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    onclick={(e) => { if (e.target === e.currentTarget) isOpen = false; }}
    role="dialog"
  >
    <div class="w-full max-w-2xl max-h-[90vh] bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Settings class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-zinc-100">Definições da Aplicação & Campanha</h2>
            <p class="text-[11px] text-zinc-400">Configurações globais, biblioteca de música e assistente de IA</p>
          </div>
        </div>
        <button
          onclick={() => (isOpen = false)}
          class="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-2 px-6 pt-3 border-b border-zinc-800 bg-zinc-950/40">
        <button
          type="button"
          onclick={() => (activeTab = 'campaign')}
          class="pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer {activeTab ===
          'campaign'
            ? 'border-amber-400 text-amber-300'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
        >
          <BookOpen class="w-3.5 h-3.5" />
          <span>Campanha & Geral</span>
        </button>

        <button
          type="button"
          onclick={() => (activeTab = 'audio')}
          class="pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer {activeTab ===
          'audio'
            ? 'border-amber-400 text-amber-300'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
        >
          <Music class="w-3.5 h-3.5" />
          <span>Áudio & Músicas</span>
        </button>

        <button
          type="button"
          onclick={() => (activeTab = 'ai')}
          class="pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer {activeTab ===
          'ai'
            ? 'border-amber-400 text-amber-300'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
        >
          <Bot class="w-3.5 h-3.5" />
          <span>IA Assistente (BYOK)</span>
        </button>
      </div>

      <!-- Main Form Body -->
      <div class="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
        <!-- TAB 1: CAMPANHA & GERAL -->
        {#if activeTab === 'campaign'}
          <div class="space-y-4 animate-in fade-in duration-100">
            <div>
              <label for="campaign-name-input" class="block font-medium text-zinc-300 mb-1">Nome da Campanha</label>
              <input
                id="campaign-name-input"
                type="text"
                bind:value={campaignName}
                placeholder="Ex: O Segredo na Floresta Negra"
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="campaign-system-select" class="block font-medium text-zinc-300 mb-1">Sistema de RPG</label>
                <select
                  id="campaign-system-select"
                  bind:value={campaignSystem}
                  class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                >
                  <option value="Ordem Paranormal RPG">🔮 Ordem Paranormal RPG</option>
                  <option value="Dungeons & Dragons 5e">🐉 Dungeons & Dragons 5e</option>
                  <option value="Tormenta20">🗡️ Tormenta20</option>
                  <option value="Call of Cthulhu">🐙 Call of Cthulhu</option>
                  <option value="Vampiro: A Máscara">🧛 Vampiro: A Máscara</option>
                  <option value="Feiticeiros & Maldições">⚡ Feiticeiros & Maldições</option>
                  <option value="Sistema Próprio / Genérico">🎲 Sistema Próprio / Genérico</option>
                </select>
              </div>

              <div>
                <label for="current-session-input" class="block font-medium text-zinc-300 mb-1">Número da Sessão Atual</label>
                <input
                  id="current-session-input"
                  type="number"
                  min="1"
                  bind:value={currentSession}
                  class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="in-game-period-input" class="block font-medium text-zinc-300 mb-1">Data / Período no Jogo</label>
                <input
                  id="in-game-period-input"
                  type="text"
                  bind:value={inGamePeriod}
                  placeholder="Ex: Outubro de 1920, Madrugada"
                  class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label for="auto-save-select" class="block font-medium text-zinc-300 mb-1">Frequência de Auto-Save</label>
                <select
                  id="auto-save-select"
                  bind:value={autoSaveIntervalMs}
                  class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none"
                >
                  <option value={500}>500ms (Tempo Real / Recomendado)</option>
                  <option value={1000}>1 segundo</option>
                  <option value={2000}>2 segundos</option>
                  <option value={5000}>5 segundos</option>
                </select>
              </div>
            </div>

            <div>
              <label for="campaign-desc-input" class="block font-medium text-zinc-300 mb-1">Sinopse / Premissa da Campanha</label>
              <textarea
                id="campaign-desc-input"
                rows="3"
                bind:value={campaignDescription}
                placeholder="Breve resumo da investigação, antagonistas e objetivos centrais..."
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 resize-none"
              ></textarea>
            </div>
          </div>

        <!-- TAB 2: ÁUDIO & MÚSICAS -->
        {:else if activeTab === 'audio'}
          <div class="space-y-4 animate-in fade-in duration-100">
            <!-- Music Directory Folder -->
            <div class="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
              <label for="music-directory-input" class="block font-semibold text-zinc-200">
                Diretório / Pasta de Músicas do Computador
              </label>
              <p class="text-[11px] text-zinc-400 leading-relaxed">
                Define uma pasta onde guardas as tuas músicas. O Mural irá indexar automaticamente os teus ficheiros .mp3, .wav, .flac e .ogg.
              </p>

              <div class="flex items-center gap-2 pt-1">
                <input
                  id="music-directory-input"
                  type="text"
                  bind:value={musicDirectoryPath}
                  placeholder="Ex: C:/RPG/Musicas ou clica em Escolher Pasta..."
                  class="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
                />

                <input
                  type="file"
                  /* @ts-ignore */
                  webkitdirectory="true"
                  directory="true"
                  multiple
                  class="hidden"
                  bind:this={folderInputRef}
                  onchange={handleFolderImport}
                />

                <button
                  type="button"
                  onclick={() => folderInputRef?.click()}
                  class="px-3.5 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <FolderPlus class="w-3.5 h-3.5" />
                  <span>Escolher Pasta</span>
                </button>
              </div>
            </div>

            <!-- Audio Playback Defaults -->
            <div class="grid grid-cols-2 gap-3">
              <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div class="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
                    <Shuffle class="w-3.5 h-3.5 text-amber-400" />
                    <span>Modo Aleatório (Shuffle)</span>
                  </div>
                  <div class="text-[10px] text-zinc-500">Alternar faixas de forma aleatória</div>
                </div>
                <input
                  type="checkbox"
                  bind:checked={audioShuffle}
                  class="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500/30 accent-amber-500 cursor-pointer"
                />
              </div>

              <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div class="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
                    <Repeat class="w-3.5 h-3.5 text-amber-400" />
                    <span>Repetição Contínua (Loop)</span>
                  </div>
                  <div class="text-[10px] text-zinc-500">Repetir playlist ao terminar</div>
                </div>
                <input
                  type="checkbox"
                  bind:checked={audioLoop}
                  class="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500/30 accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            <!-- Crossfade & Volume Controls -->
            <div class="grid grid-cols-2 gap-3">
              <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-xs text-zinc-200">Crossfade Cinematográfico</span>
                  <span class="text-[10px] text-amber-400 font-mono">{audioCrossfadeSec}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  bind:value={audioCrossfadeSec}
                  class="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div class="text-[10px] text-zinc-500">Transição suave entre trocas de faixa</div>
              </div>

              <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-xs text-zinc-200">Volume Master Padrão</span>
                  <span class="text-[10px] text-amber-400 font-mono">{Math.round(defaultMasterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  bind:value={defaultMasterVolume}
                  class="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div class="text-[10px] text-zinc-500">Volume de arranque da sessão</div>
              </div>
            </div>
          </div>

        <!-- TAB 3: IA ASSISTENTE (BYOK) -->
        {:else if activeTab === 'ai'}
          <div class="space-y-4 animate-in fade-in duration-100">
            <div>
              <label for="ai-provider-select" class="block font-medium text-zinc-300 mb-1.5">Provedor de IA</label>
              <select
                id="ai-provider-select"
                bind:value={provider}
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
              >
                <option value="mock">Offline / Gerador Heurístico Embutido (Sem API Key)</option>
                <option value="gemini">Google Gemini (Gemini 1.5 Flash / Pro)</option>
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                <option value="anthropic">Anthropic (Claude 3.5 Sonnet / Haiku)</option>
                <option value="ollama">Ollama (100% Local / Offline)</option>
              </select>
            </div>

            <!-- API Key (for cloud providers) -->
            {#if provider === 'gemini' || provider === 'openai' || provider === 'anthropic'}
              <div>
                <label for="api-key-input" class="block font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span>Chave de API (API Key)</span>
                  <span class="text-[10px] text-zinc-500">Guardada apenas localmente</span>
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
                    <Key class="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="api-key-input"
                    type="password"
                    bind:value={apiKey}
                    placeholder="sk-..."
                    class="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 font-mono"
                  />
                </div>
              </div>
            {/if}

            <!-- Ollama Endpoint -->
            {#if provider === 'ollama'}
              <div>
                <label for="ollama-endpoint-input" class="block font-medium text-zinc-300 mb-1.5">Endpoint do Ollama</label>
                <input
                  id="ollama-endpoint-input"
                  type="text"
                  bind:value={ollamaEndpoint}
                  placeholder="http://localhost:11434"
                  class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 font-mono"
                />
              </div>
            {/if}

            <!-- Model Override -->
            <div>
              <label for="model-name-input" class="block font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Nome do Modelo (Opcional)</span>
                <span class="text-[10px] text-zinc-500">Deixa vazio para usar o modelo recomendado</span>
              </label>
              <input
                id="model-name-input"
                type="text"
                bind:value={modelName}
                placeholder={provider === 'gemini'
                  ? 'gemini-1.5-flash'
                  : provider === 'openai'
                    ? 'gpt-4o-mini'
                    : provider === 'anthropic'
                      ? 'claude-3-5-haiku-latest'
                      : provider === 'ollama'
                        ? 'llama3:latest'
                        : 'Padrão do Sistema'}
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 font-mono"
              />
            </div>

            <!-- Test Connection Button & Status -->
            <div class="pt-2 flex items-center gap-3">
              <button
                type="button"
                onclick={handleTestConnection}
                disabled={testStatus === 'testing'}
                class="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                {#if testStatus === 'testing'}
                  <Loader2 class="w-3.5 h-3.5 animate-spin" />
                  <span>A testar...</span>
                {:else}
                  <Sparkles class="w-3.5 h-3.5 text-amber-400" />
                  <span>Testar Conexão</span>
                {/if}
              </button>

              {#if testStatus === 'success'}
                <div class="flex items-center gap-1.5 text-emerald-400 text-xs font-medium animate-in fade-in duration-150">
                  <Check class="w-4 h-4" />
                  <span>Conexão bem sucedida!</span>
                </div>
              {:else if testStatus === 'failed'}
                <div class="flex items-center gap-1.5 text-rose-400 text-xs font-medium animate-in fade-in duration-150">
                  <AlertCircle class="w-4 h-4" />
                  <span>Falha ao conectar com o provedor.</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <button
          type="button"
          onclick={() => (isOpen = false)}
          class="px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition text-xs font-medium cursor-pointer"
        >
          Cancelar
        </button>

        <button
          type="button"
          onclick={handleSave}
          class="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
        >
          <Save class="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Guardar Definições</span>
        </button>
      </div>
    </div>
  </div>
{/if}
