# Documentação Técnica: Nova Arquitetura de Dossiê, File Explorer e Otimização do Mural

**Mural (OrdemTools) — Atualização de Arquitetura & Sistema de Campanhas Grandes**  
**Data:** Setembro de 2026  
**Autores:** Equipa Mural / Antigravity

---

## 1. Contexto e Objetivos

Ao construir campanhas extensas no Mural (como campanhas de 5 ou mais missões, dezenas de NPCs, pistas, locais e fações), identificaram-se dois desafios críticos de usabilidade e arquitetura:

1. **Problema de Performance (Lag no Gráfico):**
   * Conforme o número de nós e arestas com rótulos semânticos crescia, o arrasto de nós e a navegação pela câmara apresentavam uma latência notória (desfasamento de ~200ms e esforço desnecessário de composição de camadas da GPU).
2. **Problema de Organização Espacial:**
   * Organizar uma campanha monumental apenas num quadro 2D infinito tornava-se confuso e difícil de manusear à medida que novas missões eram acrescentadas. 
   * Tornava-se imperativo ter uma **organização em pastas e ficheiros estilo Obsidian**, onde cada documento pudesse ser redigido independentemente com suporte a `[[wikilinks]]`, mantendo o vínculo total ao grafo visual.

---

## 2. A Nova Arquitetura Híbrida (Dossiê + Grafo)

A nova implementação introduz uma experiência de **Dossiê Unificado**:

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         BARRA DE NAVEGAÇÃO LATERAL                          │
 │  [Quadro / Canvas]   │   [Dossiê / Notas]   │   [Atlas]   │   [Mesa VTT]   │
 └──────────┬──────────────────────┬───────────────────────────────────────────┘
            │                      │
            ▼                      ▼
 ┌──────────────────────┐   ┌──────────────────────────────────────────────────┐
 │    MURAL DO GRAFO    │   │         EXPLORADOR DE FICHEIROS & EDITOR         │
 │                      │   │                                                  │
 │  - Escopo Global     │   │  - Árvore de Pastas Livre (Missão 1, 2, Lore...) │
 │  - Escopo por Missão │◄──┼─►- Editor Markdown + Live Preview + Split        │
 │  - Auto-Layout por   │   │  - [[Wikilinks]] Bidirecionais (Sync com Grafo)  │
 │    Núcleos (Cluster) │   │  - Ficha de Combate Retrátil (PV, PE, Atributos) │
 │  - Culling de Visão  │   │  - Exportador para Obsidian Vault (.zip)         │
 └──────────────────────┘   └──────────────────────────────────────────────────┘
```

Ambos os modos operam sobre o **mesmo modelo de dados subjacente**:
* Criar uma nota no Dossiê cria um nó correspondente no Mural (e vice-versa).
* Ligar dois documentos via `[[Nome da Entidade]]` cria imediatamente a aresta correspondente no Mural.
* Focar uma entidade no Dossiê permite saltar instantaneamente para a sua localização no Mural com o botão **"Ver no Mural"**.

---

## 3. Otimizações de Performance & Eliminação de Lag

Para garantir 60 FPS contínuos mesmo com grafos densos de investigação:

### 3.1. Remoção de Conflitos de Animação CSS
* **Ficheiro:** `src/lib/components/canvas/nodes/EntityNode.svelte`
* **Causa do Lag:** O nó possuía a classe utilitária `transition-all duration-200`. Quando a biblioteca `@xyflow/svelte` calculava a posição do cursor a cada evento de `mousemove` e aplicava o estilo `transform: translate(...)`, o motor CSS do navegador tentava interpolar a transição durante 200ms, gerando um efeito de arrasto lento (*rubber-banding*).
* **Solução:** Removido o `transition-all` dos nós e limitado apenas a pequenas animações de foco e cor das bordas.

### 3.2. Redução Drástica de Camadas GPU (Compositing Overhead)
* **Ficheiro:** `src/lib/components/canvas/edges/CustomLabeledEdge.svelte`
* **Causa do Lag:** Cada uma das 33+ arestas possuía `backdrop-blur-md` na etiqueta flutuante. O motor gráfico do navegador era obrigado a alocar dezenas de texturas de desfoque fora do ecrã a cada frame de movimento da câmara.
* **Solução:** Substituído por fundos opacos elegantes (`bg-zinc-900/90 border border-zinc-700/80`), mantendo a legibilidade impecável sem custo computacional.

### 3.3. Element Culling Automático
* **Ficheiro:** `src/lib/components/canvas/CanvasContent.svelte`
* **Implementação:** Ativada a propriedade `onlyRenderVisibleElements={true}` no componente `<SvelteFlow>`. Os elementos fora do campo de visão da câmara são virtualizados e não sobrecarregam a árvore do DOM.

### 3.4. Novo Algoritmo de Organização: Núcleos de Investigação (`cluster`)
* **Ficheiro:** `src/lib/services/layout.ts`
* Adicionado o algoritmo `'cluster'`, acessível pelo botão de **Auto-Layout**. Ele identifica os centros de gravidade (fações, distritos principais) e organiza os nós satélites (pistas, segredos e NPCs associados) em órbitas coesas à volta do núcleo, evitando a sobreposição de nós.

---

## 4. O Sistema de Ficheiros do Dossiê (`CampaignFileNode`)

Na raiz da campanha (`CampaignData`), foi introduzida a estrutura `fileSystem`:

```typescript
export interface CampaignFileNode {
  id: string;               // Identificador único (ex: "file-node-123" ou "folder-m1")
  name: string;             // Nome apresentado (ex: "Padre Silveira", "Missão 1")
  type: 'file' | 'folder';  // Se é uma pasta de agrupamento ou documento
  parentId?: string | null; // ID da pasta pai (null para a raiz)
  nodeId?: string;          // Referência ao nó correspondente no Mural
  color?: string;           // Cor de destaque visual da pasta/ficheiro
  isMissionFolder?: boolean;// Indica se a pasta representa uma missão isolável
}
```

### Funcionalidades do Explorador
* **Criação Rápida:** Botões para criar pastas raiz, subpastas e novos documentos de várias categorias (NPC, Local, Pista, Segredo, Facção, Nota ou Tabela de Encontros).
* **Renomeação em Linha (Inline):** Clique duplo ou botão "Renomear" permite editar o nome diretamente na árvore, sincronizando em tempo real com o título do nó no Mural.
* **Mover entre Pastas:** Dropdown integrado no cabeçalho do documento para alterar a pasta de destino com um clique.
* **Eliminação Segura em Cascata:** Eliminar uma pasta limpa recursivamente todos os seus ficheiros e nós associados no canvas, mantendo o histórico de Undo/Redo.

---

## 5. Sincronização Bidirecional com `[[wikilinks]]`

O editor de texto suporta a sintaxe padrão de hiperligações do Obsidian:
* `[[Nome do Ficheiro]]`
* `[[Nome do Ficheiro|Nome Alternativo]]`

### Como Funciona a Sincronização
1. **Autocompletar Inteligente:** Ao escrever `[[`, abre-se imediatamente uma lista flutuante filtrável com os documentos existentes. Premir `Enter`, `Tab` ou clicar na sugestão insere o link formatado.
2. **Criação Automática de Arestas:** Quando o texto é atualizado, o método `campaignStore.syncWikilinksForNode(nodeId, content)` extrai todos os links `[[...]]`. Se o documento alvo existir na campanha e ainda não estiver conectado no Mural, é criada automaticamente uma conexão semântica:
   ```typescript
   {
     id: `edge-wikilink-${sourceId}-${targetId}`,
     source: sourceId,
     target: targetId,
     type: 'customLabeledEdge',
     data: {
       label: 'menciona',
       relationType: 'investigates',
       notes: 'Ligação gerada por [[wikilink]]'
     }
   }
   ```
3. **Limpeza Automática (Pruning):** Se o utilizador apagar o `[[wikilink]]` do texto, a ligação correspondente é removida do Mural de forma transparente.
4. **Painel de Menções (Backlinks):** No rodapé de cada documento aberto, é exibida a secção **"Mencionam este documento"**, listando todas as outras notas que o referenciam, permitindo navegar entre mistérios com um clique.

---

## 6. Escopo de Murais por Missão

Para não sobrecarregar visualmente o Mestre com 50 nós simultâneos:

* **Seletor de Escopo:** Na barra superior do Mural, o Mestre pode alternar entre:
  * **Mural: Geral (Tudo)** — Apresenta toda a teia de conspiração da campanha.
  * **Mural: [Missão X]** — Filtra o canvas para exibir **apenas os nós e conexões contidos nessa pasta/missão**.
* Ao selecionar uma pasta específica, a câmara enquadra automaticamente os nós relevantes com animação suave de zoom (`fitView`).
* Na árvore de ficheiros, qualquer pasta com nós possui o botão de atalho **"Abrir Mural da Missão"**.

---

## 7. Ficha de Combate Integrada (RPG)

Cada documento associado a um NPC, criatura ou monstro possui um cartão retrátil de combate (`CombatStatblockCard`):

* **Vitalidade & Recursos:**
  * Pontos de Vida (PV atual / PV máximo com barra de progresso colorida).
  * Pontos de Esforço (PE atual / PE máximo).
  * Defesa e Deslocamento em metros.
* **Atributos de Ordem Paranormal / d20:**
  * Agilidade (`AGI`), Força (`FOR`), Intelecto (`INT`), Presença (`PRE`), Vigor (`VIG`).
* **Ações e Ataques Rápidos:**
  * Lista de ataques personalizados com teste configurável (ex: `2d20, 19`) e dano (ex: `1d4+1 corte`).
  * Botão de rolagem de dados embutido com simulação imediata de d20 no próprio cartão.
* **Rituais & Habilidades:**
  * Círculo, custo em PE, alcance, duração e descrição tática.

---

## 8. Exportação para Obsidian Vault

O sistema inclui um gerador de arquivos ZIP nativo em TypeScript (`createZipArchive`), sem dependências externas:

1. No explorador de ficheiros, basta clicar em **"Exportar como Obsidian Vault (.zip)"**.
2. A aplicação percorre toda a árvore de pastas e documentos e gera ficheiros `.md` correspondentes:
   * **YAML Frontmatter:** Identificadores, tipo de entidade, subtítulo, tags e estado de segredo.
   * **Bloco de Combate:** Tabela formatada com PV, PE, Defesa e Atributos.
   * **Corpo do Texto:** Descrições e ligações `[[wikilinks]]` intactas.
3. O download do arquivo `.zip` é disparado automaticamente no navegador ou gravado diretamente no Desktop. Ao extrair a pasta no Obsidian, todo o grafo de conhecimento e links funcionam instantaneamente.

---

## 9. Atualização do Schema `.mural`

O formato de ficheiro `.mural` passa a incluir formalmente os seguintes campos na raiz:

```json
{
  "id": "camp-exemplo-01",
  "name": "Religião: O Elo da Luz Carnal",
  "version": "1.1.0",
  "activeScopeFolderId": "all",
  "fileSystem": [
    {
      "id": "folder-m1",
      "name": "Missão 1 - Luz Carnal",
      "type": "folder",
      "parentId": null,
      "isMissionFolder": true
    },
    {
      "id": "file-padre",
      "name": "Padre Silveira",
      "type": "file",
      "parentId": "folder-m1",
      "nodeId": "node-padre-1"
    }
  ],
  "nodes": [
    {
      "id": "node-padre-1",
      "type": "entityNode",
      "position": { "x": 300, "y": 200 },
      "data": {
        "title": "Padre Silveira",
        "category": "npc",
        "folderId": "folder-m1",
        "content": "O pároco local. Costuma visitar as [[Catacumbas]].",
        "wikilinks": ["Catacumbas"],
        "combatStats": {
          "pvCurrent": 25,
          "pvMax": 25,
          "peCurrent": 12,
          "peMax": 12,
          "defense": 14,
          "attributes": { "AGI": 1, "FOR": 1, "INT": 3, "PRE": 3, "VIG": 2 }
        }
      }
    }
  ],
  "edges": [ ... ]
}
```

*Nota de Retrocompatibilidade:* Campanhas criadas em versões anteriores sem `fileSystem` são migradas automaticamente na primeira abertura (`initializeDefaultFileSystem`), agrupando todos os nós existentes na raiz sem qualquer perda de dados.

---

## 10. Resumo dos Ficheiros Criados e Modificados

| Ficheiro | Tipo | Descrição |
| :--- | :--- | :--- |
| `src/lib/components/explorer/FileExplorerView.svelte` | **NOVO** | Vista principal do Dossiê com árvore de pastas, editor markdown, live preview e backlinks. |
| `src/lib/components/explorer/FileTreeItem.svelte` | **NOVO** | Item recursivo de pasta/ficheiro com renomeação inline e ações rápidas. |
| `src/lib/components/explorer/CombatStatblockCard.svelte` | **NOVO** | Ficha tática de combate com atributos d20, rolagens e rituais. |
| `src/lib/utils/obsidianZip.ts` | **NOVO** | Gerador autónomo de arquivos ZIP para exportação direta do Obsidian Vault. |
| `tests/tier10_file_explorer.test.ts` | **NOVO** | Testes automatizados para o sistema de ficheiros, wikilinks, scoping e exportação. |
| `src/lib/stores/campaignStore.svelte.ts` | **MODIFICADO** | Estado reativo da árvore de pastas, escopos de canvas e sincronização de wikilinks. |
| `src/lib/components/canvas/CanvasContent.svelte` | **MODIFICADO** | Inclusão do seletor de escopo de missão e ativação do culling de visão. |
| `src/lib/components/canvas/nodes/EntityNode.svelte` | **MODIFICADO** | Remoção do `transition-all` para eliminar os 200ms de atraso ao arrastar nós. |
| `src/lib/components/canvas/edges/CustomLabeledEdge.svelte` | **MODIFICADO** | Otimização de GPU nas etiquetas de ligação (remoção de backdrop-blur). |
| `src/lib/services/layout.ts` | **MODIFICADO** | Implementação do layout por núcleos de investigação (`cluster`). |
| `src/App.svelte` | **MODIFICADO** | Inclusão do roteamento do separador `docs` para o `FileExplorerView`. |
