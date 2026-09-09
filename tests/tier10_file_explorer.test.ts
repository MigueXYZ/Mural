import { describe, it, expect } from './harness';
import { createZipArchive } from '../src/lib/utils/obsidianZip';
import { renderMarkdown } from '../src/lib/utils/markdown';
import type { CampaignFileNode, CombatStats, EntityCategory } from '../src/lib/types';

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
});
