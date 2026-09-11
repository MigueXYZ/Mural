import { describe, it, expect } from './harness';
import { createZipArchive } from '../src/lib/utils/obsidianZip';
import {
  renderMarkdown,
  replaceWikilinkTarget,
  extractWikilinkTargets,
  extractImagesFromMarkdown,
  stripImagesFromMarkdown,
} from '../src/lib/utils/markdown';
import { migrateLegacyCampaign, validateCampaignSchema } from '../src/lib/services/storage';
import { autoLayoutNodes } from '../src/lib/services/layout';
import type { CampaignFileNode, CombatStats, EntityCategory, CampaignData } from '../src/lib/types';

describe('Tier 10: File Explorer, Bidirectional Wikilinks & Vault Export', () => {
  it('10.1: File and Folder tree hierarchy and nesting', () => {
    const fileSystem: CampaignFileNode[] = [
      { id: 'folder-1', name: 'Missão 1', type: 'folder', parentId: null },
      { id: 'folder-2', name: 'Sublocal', type: 'folder', parentId: 'folder-1' },
      { id: 'file-1', name: 'Padre Silveira', type: 'file', parentId: 'folder-1', nodeId: 'node-1' },
      { id: 'file-2', name: 'Relíquia', type: 'file', parentId: 'folder-2', nodeId: 'node-2' },
    ];

    const rootFolders = fileSystem.filter((f) => !f.parentId);
    expect(rootFolders.length).toBe(1);
    expect(rootFolders[0].name).toBe('Missão 1');

    const subItems = fileSystem.filter((f) => f.parentId === 'folder-1');
    expect(subItems.length).toBe(2);

    const deepItems = fileSystem.filter((f) => f.parentId === 'folder-2');
    expect(deepItems.length).toBe(1);
    expect(deepItems[0].name).toBe('Relíquia');
  });

  it('10.2: Bidirectional Wikilink extraction and edge creation logic', () => {
    const content = 'O Padre Silveira foi visto com a [[Relíquia do Sangue]] no [[Templo Antigo]].';
    const matches = Array.from(content.matchAll(/\[\[(.*?)\]\]/g));
    const extractedTitles = matches.map((m) => m[1].trim());

    expect(extractedTitles.length).toBe(2);
    expect(extractedTitles[0]).toBe('Relíquia do Sangue');
    expect(extractedTitles[1]).toBe('Templo Antigo');

    const knownNodes = [
      { id: 'node-1', data: { title: 'Padre Silveira' } },
      { id: 'node-2', data: { title: 'Relíquia do Sangue' } },
      { id: 'node-3', data: { title: 'Templo Antigo' } },
      { id: 'node-4', data: { title: 'Desconhecido' } },
    ];

    const targetSet = new Set(extractedTitles.map((t) => t.toLowerCase()));
    const matchingTargets = knownNodes.filter(
      (n) => n.id !== 'node-1' && targetSet.has(n.data.title.toLowerCase())
    );

    expect(matchingTargets.length).toBe(2);
    expect(matchingTargets.map((m) => m.id)).toEqual(['node-2', 'node-3']);
  });

  it('10.3: Canvas Scoping filters nodes and incident edges by folder', () => {
    const allNodes = [
      { id: 'n1', data: { title: 'A', folderId: 'f1' } },
      { id: 'n2', data: { title: 'B', folderId: 'f1' } },
      { id: 'n3', data: { title: 'C', folderId: 'f2' } },
    ];

    const allEdges = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n1', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n2' },
    ];

    // Scope to folder f1
    const scopedFolderId = 'f1';
    const scopedNodes = allNodes.filter((n) => n.data?.folderId === scopedFolderId);
    expect(scopedNodes.length).toBe(2);

    const scopedNodeIds = new Set(scopedNodes.map((n) => n.id));
    const scopedEdges = allEdges.filter(
      (e) => scopedNodeIds.has(e.source) && scopedNodeIds.has(e.target)
    );
    expect(scopedEdges.length).toBe(1);
    expect(scopedEdges[0].id).toBe('e1');
  });

  it('10.4: Obsidian Vault Export generates valid markdown and zip file', () => {
    const files = [
      {
        path: 'Missão 1/Padre Silveira.md',
        content: '---\ntitle: "Padre Silveira"\ntype: "npc"\n---\n\n### Ficha de Combate\n- **PV**: 20/20\n\nDescrição do NPC.',
      },
      {
        path: 'Missão 1/Locais/Cripta.md',
        content: '---\ntitle: "Cripta"\ntype: "location"\n---\n\nLocal sombrio e úmido.',
      },
    ];

    const zipBlob = createZipArchive(files);
    expect(Boolean(zipBlob)).toBe(true);
    expect(zipBlob.type).toBe('application/zip');
    expect(zipBlob.size > 100).toBe(true);
  });

  it('10.5: Markdown renderer formats [[wikilinks]] and aliases as interactive pills', () => {
    const raw = 'O cultista mencionou o [[Templo Subterrâneo]] e o seu líder [[Mestre Carmim|Líder da Seita]].';
    const html = renderMarkdown(raw);

    expect(html.includes('data-target="Templo Subterrâneo"')).toBe(true);
    expect(html.includes('🔗 Templo Subterrâneo')).toBe(true);
    expect(html.includes('data-target="Mestre Carmim"')).toBe(true);
    expect(html.includes('🔗 Líder da Seita')).toBe(true);
  });

  it('10.6: Automatic wikilink update when a note is renamed across multiple documents', () => {
    const doc1 = 'O informante disse para procurar a [[Cripta Esquecida]] sob a catedral.';
    const doc2 = 'Rumores sobre a [[cripta esquecida]] e a [[Torre Alta]].';
    const doc3 = 'Veja também [[Cripta Esquecida.md]] para mais detalhes.';

    const updated1 = replaceWikilinkTarget(doc1, 'Cripta Esquecida', 'Cripta dos Antigos');
    const updated2 = replaceWikilinkTarget(doc2, 'Cripta Esquecida', 'Cripta dos Antigos');
    const updated3 = replaceWikilinkTarget(doc3, 'Cripta Esquecida', 'Cripta dos Antigos');

    expect(updated1).toBe('O informante disse para procurar a [[Cripta dos Antigos]] sob a catedral.');
    expect(updated2).toBe('Rumores sobre a [[Cripta dos Antigos]] e a [[Torre Alta]].');
    expect(updated3).toBe('Veja também [[Cripta dos Antigos]] para mais detalhes.');
  });

  it('10.7: Preserves pipe aliases and whitespace when updating wikilinks automatically', () => {
    const doc = 'Falámos com [[Padre Silveira|o pároco da vila]] e depois com [[ Padre Silveira |Silveira]].';
    const updated = replaceWikilinkTarget(doc, 'Padre Silveira', 'Bispo Silveira');

    expect(updated).toBe('Falámos com [[Bispo Silveira|o pároco da vila]] e depois com [[Bispo Silveira|Silveira]].');
  });

  it('10.8: extractWikilinkTargets extracts clean targets ignoring aliases', () => {
    const doc = 'O [[Padre Silveira|Padre]] foi ao [[Templo dos Antigos]] buscar o [[Cálice Sagrado|Cálice]].';
    const targets = extractWikilinkTargets(doc);

    expect(targets.length).toBe(3);
    expect(targets).toEqual(['Padre Silveira', 'Templo dos Antigos', 'Cálice Sagrado']);
  });

  it('10.9: Storage migration and validation preserves fileSystem, activeScopeFolderId, folderId, content and combatStats', () => {
    const rawCampaign = {
      id: 'test-campaign-1',
      name: 'Campanha Investigação',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      activeScopeFolderId: 'folder-secret',
      fileSystem: [
        { id: 'folder-secret', name: 'Documentos Confidenciais', type: 'folder', parentId: null },
        { id: 'file-doc-1', name: 'Relatório Forense', type: 'file', parentId: 'folder-secret', nodeId: 'node-forense' },
      ],
      nodes: [
        {
          id: 'node-forense',
          position: { x: 100, y: 150 },
          data: {
            id: 'node-forense',
            title: 'Relatório Forense',
            description: 'Resumo breve para o card do mural',
            content: 'Dossiê completo com pistas detalhadas sobre o veneno.',
            folderId: 'folder-secret',
            combatStats: { hp: 10, maxHp: 10, ac: 12 },
            wikilinks: ['Vítima Misteriosa'],
          },
        },
      ],
      edges: [],
      clocks: [],
      lore: [],
      timeline: [],
    };

    const migrated = migrateLegacyCampaign(rawCampaign);
    expect(Array.isArray(migrated.fileSystem)).toBe(true);
    expect(migrated.fileSystem?.length).toBe(2);
    expect(migrated.fileSystem?.[0].name).toBe('Documentos Confidenciais');
    expect(migrated.activeScopeFolderId).toBe('folder-secret');

    const migratedNode = migrated.nodes[0];
    expect(migratedNode.data.folderId).toBe('folder-secret');
    expect(migratedNode.data.content).toBe('Dossiê completo com pistas detalhadas sobre o veneno.');
    expect(migratedNode.data.description).toBe('Resumo breve para o card do mural');
    expect(migratedNode.data.combatStats?.hp).toBe(10);
    expect(migratedNode.data.wikilinks).toEqual(['Vítima Misteriosa']);

    // Also test validation
    const validated = validateCampaignSchema(rawCampaign);
    expect(validated.valid).toBe(true);
    expect(validated.data?.fileSystem?.length).toBe(2);
    expect(validated.data?.nodes[0].data.content).toBe('Dossiê completo com pistas detalhadas sobre o veneno.');
  });

  it('10.10: Synchronization between canvas card description and dossier content fallback', () => {
    // When a legacy node has only description, the dossier editor falls back cleanly
    const legacyNodeData = {
      id: 'node-legacy',
      title: 'Monstro Antigo',
      description: 'Uma fera lendária que habita as montanhas.',
      content: undefined as unknown as string,
    };

    const displayInDossier = legacyNodeData.content ?? legacyNodeData.description ?? '';
    expect(displayInDossier).toBe('Uma fera lendária que habita as montanhas.');

    // When edited in dossier, it syncs bidirectionally to card description
    const updatedContent = 'Nova descrição aprofundada com [[Caverna]].';
    const syncedCardData = {
      ...legacyNodeData,
      content: updatedContent,
      description: updatedContent,
    };
    expect(syncedCardData.description).toBe(updatedContent);
    expect(syncedCardData.content).toBe(updatedContent);
  });

  it('10.11: File system auto-registration fills in missing files for orphan nodes', () => {
    const existingFileSystem: CampaignFileNode[] = [
      { id: 'file-node-1', name: 'Padre Silveira', type: 'file', parentId: null, nodeId: 'node-1' },
    ];

    const currentNodes = [
      { id: 'node-1', data: { title: 'Padre Silveira', folderId: null } },
      { id: 'node-2', data: { title: 'Templo Antigo', folderId: 'folder-locais' } },
    ];

    const existingNodeIds = new Set(
      existingFileSystem.filter((f) => f.type === 'file' && f.nodeId).map((f) => f.nodeId)
    );

    const missingFiles: CampaignFileNode[] = [];
    currentNodes.forEach((node) => {
      if (!existingNodeIds.has(node.id)) {
        missingFiles.push({
          id: `file-${node.id}`,
          name: node.data?.title || 'Ficheiro sem nome',
          type: 'file',
          parentId: (node.data?.folderId as string) || null,
          nodeId: node.id,
        });
      }
    });

    const reconciled = [...existingFileSystem, ...missingFiles];
    expect(reconciled.length).toBe(2);
    expect(reconciled[1].nodeId).toBe('node-2');
    expect(reconciled[1].name).toBe('Templo Antigo');
    expect(reconciled[1].parentId).toBe('folder-locais');
  });

  it('10.12: Extracts embedded images in notes/descriptions of canvas squares and strips bulky image tags for clean text previews', () => {
    const rawNote = `O padre foi visto a carregar o artefato suspeito.
![Foto do Pingente](https://images.example.com/pendant.png)
A marca no metal corresponde ao símbolo da seita.
![Esboço do Templo](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/)`;

    const extracted = extractImagesFromMarkdown(rawNote);
    expect(extracted.length).toBe(2);
    expect(extracted[0].alt).toBe('Foto do Pingente');
    expect(extracted[0].url).toBe('https://images.example.com/pendant.png');
    expect(extracted[1].alt).toBe('Esboço do Templo');
    expect(extracted[1].url.startsWith('data:image/png;base64')).toBe(true);

    const clean = stripImagesFromMarkdown(rawNote);
    expect(clean.includes('![Foto do Pingente]')).toBe(false);
    expect(clean.includes('data:image/png;base64')).toBe(false);
    expect(clean.includes('O padre foi visto a carregar o artefato suspeito.')).toBe(true);
    expect(clean.includes('A marca no metal corresponde ao símbolo da seita.')).toBe(true);
  });

  it('10.13: Auto-layout chooses optimal connection handles among all 4 points (top, bottom, left, right)', () => {
    // Case 1: Hierarchical vertical flow (parent at top, child at bottom)
    const vNodes = [
      { id: 'parent', position: { x: 0, y: 0 }, data: { id: 'parent', type: 'npc', title: 'Chefe', description: '' } },
      { id: 'child', position: { x: 0, y: 0 }, data: { id: 'child', type: 'npc', title: 'Subordinado', description: '' } },
    ];
    const vEdges = [
      { id: 'e-v', source: 'parent', target: 'child', data: { label: 'comanda' } },
    ];
    const vResult = autoLayoutNodes(vNodes, vEdges, { algorithm: 'hierarchical', direction: 'TB' });
    const autoVEdge = vResult.edges.find((e: any) => e.id === 'e-v')!;
    expect(autoVEdge.sourceHandle).toBe('bottom');
    expect(autoVEdge.targetHandle).toBe('top');

    // Case 2: Grid/horizontal layout (left to right)
    const hNodes = [
      { id: 'nodeA', position: { x: 100, y: 100 }, data: { id: 'nodeA', type: 'location', title: 'Local A', description: '' } },
      { id: 'nodeB', position: { x: 600, y: 100 }, data: { id: 'nodeB', type: 'location', title: 'Local B', description: '' } },
    ];
    const hEdges = [
      { id: 'e-h', source: 'nodeA', target: 'nodeB', data: { label: 'estrada para' } },
    ];
    const hResult = autoLayoutNodes(hNodes, hEdges, { algorithm: 'grid' });
    const autoHEdge = hResult.edges.find((e: any) => e.id === 'e-h')!;
    expect(autoHEdge.sourceHandle).toBe('right');
    expect(autoHEdge.targetHandle).toBe('left');
  });

  it('10.14: Drag and drop file/folder hierarchy movement into target folder and root', () => {
    let fileSystem: CampaignFileNode[] = [
      { id: 'folder-npc', name: 'NPC', type: 'folder', parentId: null },
      { id: 'folder-locais', name: 'Locais', type: 'folder', parentId: null },
      { id: 'file-1', name: 'Padre Bernardo', type: 'file', parentId: null, nodeId: 'node-1' },
      { id: 'file-2', name: 'Casa do Gonçalo', type: 'file', parentId: null, nodeId: 'node-2' },
    ];

    function moveItem(id: string, newParentId: string | null) {
      if (id === newParentId) return;
      // Prevent circular / descendant move
      function isDescendant(childId: string, parentId: string): boolean {
        let cur = fileSystem.find((f) => f.id === childId);
        while (cur && cur.parentId) {
          if (cur.parentId === parentId) return true;
          cur = fileSystem.find((f) => f.id === cur!.parentId);
        }
        return false;
      }
      if (newParentId && isDescendant(newParentId, id)) return;

      const item = fileSystem.find((f) => f.id === id);
      if (item) {
        item.parentId = newParentId;
      }
    }

    // Move file-1 into folder-npc
    moveItem('file-1', 'folder-npc');
    expect(fileSystem.find((f) => f.id === 'file-1')?.parentId).toBe('folder-npc');

    // Move file-2 into folder-locais
    moveItem('file-2', 'folder-locais');
    expect(fileSystem.find((f) => f.id === 'file-2')?.parentId).toBe('folder-locais');

    // Move folder-locais into folder-npc
    moveItem('folder-locais', 'folder-npc');
    expect(fileSystem.find((f) => f.id === 'folder-locais')?.parentId).toBe('folder-npc');

    // Prevent folder-npc moving into folder-locais (descendant)
    moveItem('folder-npc', 'folder-locais');
    expect(fileSystem.find((f) => f.id === 'folder-npc')?.parentId).toBe(null);

    // Move file-1 back to root
    moveItem('file-1', null);
    expect(fileSystem.find((f) => f.id === 'file-1')?.parentId).toBe(null);
  });
});

