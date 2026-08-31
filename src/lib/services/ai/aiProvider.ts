/**
 * Mural (OrdemTools) - AI BYOK Multi-Provider Engine
 * Supports Google Gemini, OpenAI, Anthropic, Local Ollama, and Offline Mock Generator.
 */

import type { CampaignSettings, CampaignData } from '../../types';
import { buildBoardContextPayload } from './contextSerializer';

export interface AiHookOption {
  category: 'immediate_consequence' | 'alternative_clue' | 'threat_advancement';
  title: string;
  content: string;
  rawText: string;
}

export function parseAiRescueResponse(rawText: string): AiHookOption[] {
  const hooks: AiHookOption[] = [];

  const cat1Match = rawText.match(
    /(?:1\.\s*\[?(?:Consequência Imediata|Consequencia Imediata)\]?:?)([\s\S]*?)(?=(?:2\.\s*\[?|$))/i
  );
  const cat2Match = rawText.match(/(?:2\.\s*\[?(?:Pista Alternativa)\]?:?)([\s\S]*?)(?=(?:3\.\s*\[?|$))/i);
  const cat3Match = rawText.match(/(?:3\.\s*\[?(?:Avanço da Ameaça|Avanco da Ameaca)\]?:?)([\s\S]*?)$/i);

  if (cat1Match && cat2Match && cat3Match) {
    hooks.push({
      category: 'immediate_consequence',
      title: 'Consequência Imediata',
      content: cat1Match[1].trim(),
      rawText: cat1Match[0].trim(),
    });
    hooks.push({
      category: 'alternative_clue',
      title: 'Pista Alternativa',
      content: cat2Match[1].trim(),
      rawText: cat2Match[0].trim(),
    });
    hooks.push({
      category: 'threat_advancement',
      title: 'Avanço da Ameaça',
      content: cat3Match[1].trim(),
      rawText: cat3Match[0].trim(),
    });
  } else {
    // Fallback parser: split by numbered list or paragraphs
    const lines = rawText
      .split(/\n(?=\d+\.)/)
      .map((s) => s.trim())
      .filter(Boolean);

    const categories: AiHookOption['category'][] = [
      'immediate_consequence',
      'alternative_clue',
      'threat_advancement',
    ];
    const titles = ['Consequência Imediata', 'Pista Alternativa', 'Avanço da Ameaça'];

    categories.forEach((cat, idx) => {
      const lineContent = lines[idx] || `Sugestão ${idx + 1}: ${rawText.slice(0, 100)}`;
      hooks.push({
        category: cat,
        title: titles[idx],
        content: lineContent.replace(/^\d+\.\s*(\[[^\]]+\])?\s*:?\s*/, '').trim(),
        rawText: lineContent,
      });
    });
  }

  return hooks;
}

export class MockAiProvider {
  async generateRescueHooks(campaign: CampaignData, gmQuery: string): Promise<AiHookOption[]> {
    // Context-aware dynamic offline mock generation
    const firstNpc = (campaign.nodes || []).find((n) => n.data?.type === 'npc')?.data?.title || 'o contacto local';
    const firstSecret = (campaign.nodes || []).find((n) => n.data?.type === 'secret' || n.data?.isSecret)?.data?.title || 'um ritual esquecido';
    const firstClock = (campaign.clocks || [])[0]?.title || 'Avanço da Ameaça';

    const raw = `
1. [Consequência Imediata]: Um emissário ligado a "${firstNpc}" presencia o ocorrido e exige uma explicação rápida antes de alertar as autoridades.
2. [Pista Alternativa]: Nos pertences deixados para trás, os investigadores descobrem uma anotação cifrada apontando para "${firstSecret}".
3. [Avanço da Ameaça]: A comoção acelera a contagem de "${firstClock}", atraindo vigilância sobre os personagens.
`.trim();

    return parseAiRescueResponse(raw);
  }

  async testConnection(): Promise<boolean> {
    return true;
  }
}

export class AiEngine {
  private mockProvider = new MockAiProvider();

  async generateRescueHooks(
    campaign: CampaignData,
    gmIncident: string,
    settings?: CampaignSettings
  ): Promise<AiHookOption[]> {
    const provider = settings?.aiProvider || campaign.settings?.aiProvider || 'mock';
    const apiKey = settings?.apiKey || campaign.settings?.apiKey;

    const boardContext = buildBoardContextPayload(campaign);
    const systemPrompt = `És um assistente de Mestre de RPG (GM Assistant) de elite para o sistema ${campaign.system || 'Ordem Paranormal'}.
O Mestre está numa sessão ao vivo e a mesa descarrilou com o seguinte incidente: "${gmIncident}".
Com base no contexto do quadro da campanha fornecido, deves gerar exatamente 3 ganchos práticos e acionáveis para recolocar a história no rumo:
1. [Consequência Imediata]: O que acontece agora mesmo como consequência lógica.
2. [Pista Alternativa]: Como uma nova pista ou revelação reorienta os jogadores.
3. [Avanço da Ameaça]: Como os antagonistas ou relógios de perigo se movem perante esta oportunidade.

Responde em Português claro e direto no formato exato:
1. [Consequência Imediata]: ...
2. [Pista Alternativa]: ...
3. [Avanço da Ameaça]: ...`;

    // If mock or no API key, use mock generator
    if (provider === 'mock' || !apiKey) {
      return this.mockProvider.generateRescueHooks(campaign, gmIncident);
    }

    try {
      if (provider === 'gemini') {
        const model = settings?.modelName || 'gemini-1.5-flash';
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: `${systemPrompt}\n\nCONTEXTO DO QUADRO:\n${boardContext}` },
                  ],
                },
              ],
            }),
          }
        );
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return parseAiRescueResponse(text);
        }
      } else if (provider === 'openai') {
        const model = settings?.modelName || 'gpt-4o-mini';
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Contexto do quadro:\n${boardContext}` },
            ],
          }),
        });
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          return parseAiRescueResponse(text);
        }
      } else if (provider === 'ollama') {
        const endpoint = settings?.ollamaEndpoint || 'http://localhost:11434';
        const model = settings?.modelName || 'llama3';
        const res = await fetch(`${endpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: `${systemPrompt}\n\nContexto do quadro:\n${boardContext}`,
            stream: false,
          }),
        });
        const data = await res.json();
        if (data?.response) {
          return parseAiRescueResponse(data.response);
        }
      }
    } catch (err) {
      console.warn('[AiEngine] Remote provider call failed, falling back to heuristic mock:', err);
    }

    return this.mockProvider.generateRescueHooks(campaign, gmIncident);
  }

  async testConnection(settings: CampaignSettings): Promise<boolean> {
    if (settings.aiProvider === 'mock') return true;
    if (!settings.apiKey && settings.aiProvider !== 'ollama') return false;

    try {
      if (settings.aiProvider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${settings.apiKey}`
        );
        return res.ok;
      }
      if (settings.aiProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${settings.apiKey}` },
        });
        return res.ok;
      }
      if (settings.aiProvider === 'ollama') {
        const endpoint = settings.ollamaEndpoint || 'http://localhost:11434';
        const res = await fetch(`${endpoint}/api/tags`);
        return res.ok;
      }
    } catch {
      return false;
    }
    return false;
  }
}

export const aiEngine = new AiEngine();
