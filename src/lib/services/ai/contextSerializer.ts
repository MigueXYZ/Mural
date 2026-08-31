/**
 * Mural (OrdemTools) - Board Context Serializer
 * Serializes active canvas state, clocks, secrets, and lore into a compressed prompt payload (< 1200 tokens).
 */

import type { CampaignData } from '../../types';

export function buildBoardContextPayload(campaign: CampaignData): string {
  const clocksStr = (campaign.clocks || [])
    .map(
      (c) =>
        `- ${c.title}: ${c.filledSegments}/${c.totalSegments} fatias${
          c.filledSegments >= c.totalSegments ? ' (COMPLETO)' : ''
        }${c.consequence ? ` [Consequência: ${c.consequence}]` : ''}`
    )
    .join('\n');

  const nodes = campaign.nodes || [];
  const npcs = nodes
    .filter((n) => n.data?.type === 'npc')
    .map((n) => `- NPC: ${n.data.title} (${n.data.subtitle || 'Papel não especificado'}) - ${n.data.description || 'Sem descrição'}`)
    .slice(0, 8);

  const factions = nodes
    .filter((n) => n.data?.type === 'faction')
    .map((n) => `- Facção: ${n.data.title} - ${n.data.description || 'Sem descrição'}`)
    .slice(0, 4);

  const locations = nodes
    .filter((n) => n.data?.type === 'location')
    .map((n) => `- Local: ${n.data.title} - ${n.data.description || 'Sem descrição'}`)
    .slice(0, 6);

  const secrets = nodes
    .filter((n) => n.data?.type === 'secret' || n.data?.isSecret)
    .map((n) => `- Segredo Oculto: ${n.data.title} (${n.data.description || 'Sem descrição'})`)
    .slice(0, 5);

  const edgesStr = (campaign.edges || [])
    .map((e) => {
      const sourceNode = nodes.find((n) => n.id === e.source);
      const targetNode = nodes.find((n) => n.id === e.target);
      const sourceTitle = sourceNode?.data?.title || e.source;
      const targetTitle = targetNode?.data?.title || e.target;
      return `- "${sourceTitle}" ${e.label || e.data?.label || 'relaciona-se com'} "${targetTitle}"`;
    })
    .slice(0, 10)
    .join('\n');

  const recentLore = (campaign.lore || [])
    .slice(0, 6)
    .map((l) => `- [${l.status || l.visibility || 'SEGREDO'}] ${l.content}`)
    .join('\n');

  return `
CAMPANHA: ${campaign.name} (Sistema: ${campaign.system}) | Sessão: ${campaign.currentSession} | Época: ${campaign.inGamePeriod}

RELÓGIOS DE AMEAÇA:
${clocksStr || '(Nenhum relógio ativo)'}

ENTIDADES PRINCIPAIS:
${[...npcs, ...factions, ...locations].join('\n') || '(Sem entidades)'}

RELAÇÕES CONHECIDAS:
${edgesStr || '(Sem ligações explícitas)'}

SEGREDOS OCULTOS (NÃO REVELADOS AOS JOGADORES):
${secrets.join('\n') || '(Sem segredos registados)'}

REGISTO RECENTE DE LORE:
${recentLore || '(Sem registos)'}
`.trim();
}
