import { sampleCampaigns } from '../data/sampleCampaign';
import type { CampaignData } from '../types';
import { campaignStore } from './campaignStore.svelte';
import { storageService } from '../services/storage';

class AppState {
  currentView = $state<'menu' | 'campaign'>('menu');
  activeTab = $state<'board' | 'maps' | 'vtt' | 'docs'>('board');
  isSettingsOpen = $state<boolean>(false);
  campaigns = $state<CampaignData[]>(sampleCampaigns);
  searchFilter = $state<string>('');

  // UI Scale Subsystem (Requirement R1)
  uiScale = $state<number>(1.0);

  constructor() {
    this.initUiScale();
    this.initCampaignsList();
  }

  initUiScale() {
    if (typeof window !== 'undefined' || typeof localStorage !== 'undefined') {
      try {
        if (typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem('mural_ui_scale');
          if (saved) {
            const parsed = parseFloat(saved);
            if (!isNaN(parsed) && parsed >= 0.75 && parsed <= 1.5) {
              this.setUiScale(parsed, false);
              return;
            }
          }
          const globalSettings = localStorage.getItem('mural_global_settings');
          if (globalSettings) {
            const parsed = JSON.parse(globalSettings);
            if (parsed?.uiScale && !isNaN(parsed.uiScale)) {
              this.setUiScale(parsed.uiScale, false);
              return;
            }
          }
        }
        if (campaignStore?.campaign?.settings?.uiScale) {
          this.setUiScale(campaignStore.campaign.settings.uiScale, false);
          return;
        }
      } catch (e) {
        console.warn('Error loading mural_ui_scale:', e);
      }
      this.setUiScale(1.0, false);
    }
  }

  setUiScale(val: number, persist = true) {
    const clamped = Math.min(1.5, Math.max(0.75, Math.round(val * 100) / 100));
    this.uiScale = clamped;
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.style.setProperty('--ui-scale', clamped.toString());
    }
    if (persist && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('mural_ui_scale', clamped.toString());
      } catch (e) {
        console.warn('Error saving mural_ui_scale to localStorage:', e);
      }
    }
    if (campaignStore?.campaign) {
      if (!campaignStore.campaign.settings) {
        campaignStore.campaign.settings = {};
      }
      campaignStore.campaign.settings.uiScale = clamped;
    }
  }

  async initCampaignsList() {
    try {
      const stored = await storageService.listCampaigns();
      if (stored && stored.length > 0) {
        // Load full campaign records for the list
        const loadedList: CampaignData[] = [];
        for (const summary of stored) {
          try {
            const full = await storageService.loadCampaign(summary.id);
            loadedList.push(full);
          } catch {
            // ignore
          }
        }
        if (loadedList.length > 0) {
          // Merge with sampleCampaigns without duplicates
          const ids = new Set(loadedList.map((c) => c.id));
          for (const sample of sampleCampaigns) {
            if (!ids.has(sample.id)) {
              loadedList.push(sample);
            }
          }
          this.campaigns = loadedList;
        }
      }
    } catch {
      // Use sample campaigns fallback
    }
  }

  openCampaign(id: string) {
    let found = this.campaigns.find((c) => c.id === id);
    if (!found) {
      found = sampleCampaigns.find((c) => c.id === id);
      if (found) {
        this.campaigns = [found, ...this.campaigns];
      }
    }
    if (found) {
      campaignStore.loadCampaign(found);
      if (found.settings?.uiScale && typeof localStorage !== 'undefined' && !localStorage.getItem('mural_ui_scale')) {
        this.setUiScale(found.settings.uiScale, false);
      }
      this.currentView = 'campaign';
    } else {
      storageService
        .loadCampaign(id)
        .then((camp) => {
          if (camp) {
            campaignStore.loadCampaign(camp);
            if (camp.settings?.uiScale && typeof localStorage !== 'undefined' && !localStorage.getItem('mural_ui_scale')) {
              this.setUiScale(camp.settings.uiScale, false);
            }
            this.campaigns = [camp, ...this.campaigns.filter((c) => c.id !== camp.id)];
            this.currentView = 'campaign';
          }
        })
        .catch(() => {
          if (sampleCampaigns[0]) {
            campaignStore.loadCampaign(sampleCampaigns[0]);
            this.currentView = 'campaign';
          }
        });
    }
  }

  async returnToMenu() {
    // Save current active campaign back to the campaigns list & storage
    const active = campaignStore.exportCurrentCampaign();
    try {
      await storageService.saveCampaign(active);
    } catch (e) {
      console.warn('Error saving campaign on return to menu:', e);
    }

    const index = this.campaigns.findIndex((c) => c.id === active.id);
    if (index !== -1) {
      this.campaigns[index] = active;
    } else {
      this.campaigns = [active, ...this.campaigns];
    }
    this.currentView = 'menu';
  }

  createNewCampaign(data: {
    name: string;
    system: string;
    inGamePeriod: string;
    description: string;
    templateType?: 'blank' | 'mystery' | 'faction' | 'oneshot';
  }) {
    const id = `campaign-${Date.now()}`;
    const newCamp: CampaignData = {
      id,
      name: data.name || 'Nova Campanha',
      system: data.system || 'Ordem Paranormal',
      currentSession: 1,
      inGamePeriod: data.inGamePeriod || 'Presente',
      description: data.description || '',
      updatedAt: new Date().toISOString(),
      clocks:
        data.templateType === 'blank'
          ? []
          : data.templateType === 'oneshot'
          ? [
              { id: 'c-1', title: 'Tempo Restante', totalSegments: 6, filledSegments: 1, createdAt: Date.now() },
              { id: 'c-2', title: 'Alerta da Segurança', totalSegments: 4, filledSegments: 0, createdAt: Date.now() },
            ]
          : [
              { id: 'c-1', title: 'Avanço da Ameaça', totalSegments: 6, filledSegments: 0, createdAt: Date.now() },
            ],
      lore:
        data.templateType === 'blank'
          ? []
          : [
              {
                id: 'l-1',
                content: 'Início da investigação. As primeiras pistas estão por descobrir.',
                status: 'SABIDO',
                visibility: 'SABIDO',
                sessionNumber: 1,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
      timeline: [{ id: 't-1', sessionText: 'Sessão 1', sessionNumber: 1, isCurrent: true, timestamp: Date.now() }],
      maps: [
        {
          id: 'map-default',
          title: 'Mapa Principal',
          imageUrl: 'https://images.unsplash.com/photo-1524654458049-e36be0721fa2?auto=format&fit=crop&w=1600&q=80',
          pins: [],
        },
      ],
      nodes:
        data.templateType === 'blank'
          ? []
          : [
              {
                id: `node-${Date.now()}-1`,
                type: 'entityNode',
                position: { x: 300, y: 200 },
                data: {
                  id: `node-${Date.now()}-1`,
                  type: data.templateType === 'mystery' ? 'secret' : 'location',
                  category: data.templateType === 'mystery' ? 'secret' : 'location',
                  title: data.templateType === 'mystery' ? 'O Caso Inicial' : 'Ponto de Partida',
                  subtitle: data.templateType === 'mystery' ? 'PISTA' : 'LOCAL',
                  description: 'Onde a história dos personagens tem início.',
                  color: data.templateType === 'mystery' ? '#f87171' : '#38bdf8',
                  colorTheme: data.templateType === 'mystery' ? '#f87171' : '#38bdf8',
                  isSecret: data.templateType === 'mystery',
                  revealed: data.templateType !== 'mystery',
                  tags: ['início'],
                },
              },
            ],
      edges: [],
    };

    this.campaigns = [newCamp, ...this.campaigns];
    storageService.saveCampaign(newCamp).catch(console.error);
    this.openCampaign(id);
  }

  async duplicateCampaign(id: string) {
    const orig = this.campaigns.find((c) => c.id === id);
    if (orig) {
      const cloned = await storageService.duplicateCampaign(orig);
      this.campaigns = [cloned, ...this.campaigns];
    }
  }

  async deleteCampaign(id: string) {
    if (typeof window !== 'undefined' && !confirm('Tens a certeza que desejas eliminar esta campanha?')) {
      return;
    }
    await storageService.deleteCampaign(id);
    this.campaigns = this.campaigns.filter((c) => c.id !== id);
  }

  async exportCampaign(id: string) {
    const camp = this.campaigns.find((c) => c.id === id);
    if (camp) {
      await storageService.exportCampaignFile(camp);
    }
  }

  async importCampaign(jsonStringOrPath: string) {
    try {
      const imported = await storageService.importCampaignFile(jsonStringOrPath);
      this.campaigns = [imported, ...this.campaigns.filter((c) => c.id !== imported.id)];
      this.openCampaign(imported.id);
    } catch (e: any) {
      if (typeof window !== 'undefined') {
        alert(`Erro ao importar campanha: ${e.message}`);
      }
    }
  }
}

export const appState = new AppState();
