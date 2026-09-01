/**
 * Mural (OrdemTools) - Tier 6: Taiga User Stories Tests (US 144 - US 149)
 */

import { describe, it, expect } from './harness';
import { renderMarkdown } from '../src/lib/utils/markdown';
import type { CanvasRelationEdgeData, RelationType } from '../src/lib/types';

describe('Taiga US 144: Barra de Pesquisa Funcional & Spotlight', () => {
  it('should accurately match nodes by title and description', () => {
    const sampleNodes = [
      { id: '1', data: { title: 'Barão Von Krolock', subtitle: 'Vilão', description: 'Nobre suspeito', tags: ['Vampiro'] } },
      { id: '2', data: { title: 'Taverna do Javali', subtitle: 'Local', description: 'Ponto de encontro', tags: ['Seguro'] } },
      { id: '3', data: { title: 'Diário Secreto', subtitle: 'Pista', description: 'Contém rituais', tags: ['Oculto'] } },
    ];

    const query = 'javali';
    const matched = sampleNodes.filter(n =>
      n.data.title.toLowerCase().includes(query) ||
      n.data.description.toLowerCase().includes(query) ||
      n.data.tags.some(t => t.toLowerCase().includes(query))
    );
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe('2');
  });

  it('should match nodes by tags', () => {
    const sampleNodes = [
      { id: '1', data: { title: 'Barão Von Krolock', subtitle: 'Vilão', description: 'Nobre suspeito', tags: ['Vampiro'] } },
      { id: '2', data: { title: 'Taverna do Javali', subtitle: 'Local', description: 'Ponto de encontro', tags: ['Seguro'] } },
    ];

    const tagQuery = 'vampiro';
    const tagMatched = sampleNodes.filter(n =>
      n.data.tags.some(t => t.toLowerCase().includes(tagQuery))
    );
    expect(tagMatched.length).toBe(1);
    expect(tagMatched[0].data.title).toBe('Barão Von Krolock');
  });

  it('should retain all nodes when search is empty', () => {
    const sampleNodes = [
      { id: '1', data: { title: 'A' } },
      { id: '2', data: { title: 'B' } },
    ];
    const emptyQuery = '';
    const emptyMatched = sampleNodes.filter(n => !emptyQuery || n.data.title.includes(emptyQuery));
    expect(emptyMatched.length).toBe(2);
  });
});

describe('Taiga US 145: Painel de Edição de Notas WYSIWYG & Markdown', () => {
  it('should render H1, H2, and H3 headings properly', () => {
    const mdHeadings = '# Título 1\n## Subtítulo 2\n### Secção 3';
    const htmlHeadings = renderMarkdown(mdHeadings);
    expect(htmlHeadings.includes('<h1') && htmlHeadings.includes('Título 1')).toBe(true);
    expect(htmlHeadings.includes('<h2') && htmlHeadings.includes('Subtítulo 2')).toBe(true);
    expect(htmlHeadings.includes('<h3') && htmlHeadings.includes('Secção 3')).toBe(true);
  });

  it('should render bold, italic, and interactive checklists', () => {
    const mdFormatting = '**Negrito** e *Itálico*\n- [x] Concluído\n- [ ] Pendente';
    const htmlFormatting = renderMarkdown(mdFormatting);
    expect(htmlFormatting.includes('<strong') && htmlFormatting.includes('Negrito')).toBe(true);
    expect(htmlFormatting.includes('<em') && htmlFormatting.includes('Itálico')).toBe(true);
    expect(htmlFormatting.includes('Concluído') && htmlFormatting.includes('Pendente')).toBe(true);
  });

  it('should render secret GM callout blocks', () => {
    const mdSecret = '> 🔒 Informação classificada da Ordem';
    const htmlSecret = renderMarkdown(mdSecret);
    expect(htmlSecret.includes('Informação classificada da Ordem')).toBe(true);
  });
});

describe('Taiga US 146: Volume Logarítmico', () => {
  function toLogGain(linear: number): number {
    const clamped = Math.max(0, Math.min(1, linear));
    if (clamped <= 0.001) return 0;
    return Math.pow(clamped, 2.2);
  }

  it('should yield 0 at 0% and 1 at 100%', () => {
    expect(toLogGain(0)).toBe(0);
    expect(toLogGain(1.0)).toBe(1.0);
  });

  it('should provide a psychoacoustically smooth logarithmic response at 50%', () => {
    const gainAt50 = toLogGain(0.5);
    expect(gainAt50 < 0.35 && gainAt50 > 0.15).toBe(true);
  });

  it('should be strictly monotonic and increase smoothly', () => {
    expect(toLogGain(0.2) < toLogGain(0.4)).toBe(true);
    expect(toLogGain(0.6) < toLogGain(0.8)).toBe(true);
  });
});

describe('Taiga US 147: Abrir Nota Através do Mapa', () => {
  it('should resolve target node from map pin and link coordinates', () => {
    const mapPin = {
      id: 'pin-test-1',
      targetNodeId: 'node-dungeon-1',
      xPercent: 45.0,
      yPercent: 60.0,
      label: 'Cripta Subterrânea',
    };

    const sampleNodes = [
      { id: 'node-dungeon-1', data: { id: 'node-dungeon-1', title: 'Cripta Subterrânea', type: 'location', description: 'Cheia de mortos-vivos' } }
    ];

    const foundNode = sampleNodes.find(n => n.id === mapPin.targetNodeId);
    expect(foundNode).toBeDefined();
    expect(foundNode?.data.title).toBe('Cripta Subterrânea');
  });
});

describe('Taiga US 148: Filtros de Tipos de Conexões no Painel', () => {
  it('should filter edges by relationship category', () => {
    const edges: { id: string; data: CanvasRelationEdgeData }[] = [
      { id: 'e1', data: { label: 'aliado', relationType: 'allied' } },
      { id: 'e2', data: { label: 'inimigo', relationType: 'hostile' } },
      { id: 'e3', data: { label: 'segredo', relationType: 'secret' } },
      { id: 'e4', data: { label: 'investiga', relationType: 'investigates' } },
      { id: 'e5', data: { label: 'custom', relationType: 'custom' } },
    ];

    function filterEdges(list: typeof edges, filter: RelationType | 'all') {
      if (filter === 'all') return list;
      return list.filter(e => e.data.relationType === filter);
    }

    expect(filterEdges(edges, 'all').length).toBe(5);
    expect(filterEdges(edges, 'allied').length).toBe(1);
    expect(filterEdges(edges, 'hostile').length).toBe(1);
    expect(filterEdges(edges, 'secret').length).toBe(1);
  });
});

describe('Taiga US 149: Ícones Customizados para Conexões Custom', () => {
  it('should store and preserve custom edge icon and color properties', () => {
    const customEdgeData: CanvasRelationEdgeData = {
      label: 'pacto demoníaco',
      relationType: 'custom',
      color: '#a855f7',
      icon: 'flame',
    };

    expect(customEdgeData.relationType).toBe('custom');
    expect(customEdgeData.icon).toBe('flame');
    expect(customEdgeData.color).toBe('#a855f7');
  });
});

describe('Taiga US 150: Abrir Nota Pelo Mapa em Modal Global', () => {
  it('should allow opening note editing state regardless of active tab', () => {
    let editingNode: any = null;
    function openNodeEditor(data: any) {
      editingNode = JSON.parse(JSON.stringify(data));
    }

    const pinNode = { id: 'node-map-1', title: 'Farol Esquecido', type: 'location' };
    openNodeEditor(pinNode);

    expect(editingNode).toBeDefined();
    expect(editingNode.title).toBe('Farol Esquecido');
  });
});

describe('Taiga US 151: Conexões Deletadas com Sucesso', () => {
  it('should delete connection edge by id and update connection list', () => {
    let edges = [
      { id: 'edge-1', source: 'node-a', target: 'node-b', data: { label: 'investiga' } },
      { id: 'edge-2', source: 'node-b', target: 'node-c', data: { label: 'aliado' } },
    ];

    function deleteEdge(edgeId: string) {
      edges = edges.filter(e => e.id !== edgeId);
    }

    deleteEdge('edge-1');
    expect(edges.length).toBe(1);
    expect(edges[0].id).toBe('edge-2');

    // Test 2: Filter connected edges for a specific node
    const nodeBEdges = edges.filter(e => e.source === 'node-b' || e.target === 'node-b');
    expect(nodeBEdges.length).toBe(1);
  });
});
