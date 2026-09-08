# Especificação Técnica do Formato de Ficheiro `.mural`
**Mural (OrdemTools) — Versão do Schema: 1.0.0**

Este documento detalha o funcionamento, estrutura, tipos de dados e padrões de serialização dos ficheiros de campanha com extensão `.mural` utilizados pelo **Mural (OrdemTools)**.

---

## 1. Visão Geral

Um ficheiro `.mural` é um ficheiro de texto estruturado em formato **JSON (JavaScript Object Notation)** codificado em **UTF-8**. Embora possua a extensão `.mural` para associação de tipo de ficheiro pelo sistema operativo, ele pode ser inspecionado, lido e editado por qualquer editor de texto padrão (VS Code, Notepad, etc.) ou validado por analisadores de JSON.

### Onde os Ficheiros são Guardados
* **Ambiente Desktop (Tauri v2 - Windows):**
  `%APPDATA%\com.mural.app\campaigns\<id-da-campanha>.mural`  
  (Geralmente em `C:\Users\<Utilizador>\AppData\Roaming\com.mural.app\campaigns\`)
* **Ambiente Desktop (Linux / macOS):**
  - Linux: `~/.local/share/com.mural.app/campaigns/`
  - macOS: `~/Library/Application Support/com.mural.app/campaigns/`
* **Ambiente Web / Navegador:**
  - Armazenamento primário em **IndexedDB** (`mural_db` -> store `campaigns`), com exportação manual e download direto de ficheiros `.mural`.

### Sistema de Salvaguarda Automática e Backups
1. **Auto-Save com Debounce:** A aplicação monitoriza qualquer alteração no grafo ou painéis e guarda o ficheiro após **500ms** de inatividade.
2. **Cópias de Segurança Rotativas (Backup Snapshots):**
   - A cada sessão ou guardado crítico, é criado um ficheiro:  
     `<id-da-campanha>_backup_<TIMESTAMP_ISO>.mural`
   - O sistema mantém um histórico rotativo de segurança com as **5 cópias mais recentes**, eliminando versões mais antigas para poupar espaço.

---

## 2. Estrutura Raiz do Ficheiro (Schema Top-Level)

O objeto JSON principal contém metadados globais da campanha e as coleções de todos os módulos operacionais:

```typescript
interface CampaignData {
  // Metadados Gerais
  id: string;               // Identificador único (ex: "camp-1725378291000")
  name: string;             // Nome da campanha (ex: "O Segredo na Floresta")
  system: string;           // Sistema de RPG (ex: "Ordem Paranormal", "Call of Cthulhu", "D&D 5e")
  currentSession: number;   // Número da sessão atual (inteiro >= 1)
  inGamePeriod: string;     // Época/tempo na narrativa (ex: "Inverno de 1998", "Dias Atuais")
  description?: string;     // Sinopse ou descrição resumida da campanha
  createdAt: number | string; // Timestamp numérico de criação (ms) ou string ISO
  updatedAt: string;        // Timestamp ISO da última alteração
  version: string;          // Versão do schema de dados ("1.0.0")

  // Módulos do Mural
  nodes: Node<EntityNodeData>[];  // Nós visuais do grafo de investigação (Svelte Flow)
  edges: Edge[];                  // Conexões e relações entre nós
  clocks: ThreatClock[];          // Relógios de Ameaça segmentados
  lore: LoreEntry[];              // Registo de mistérios, pistas e factos (SABIDO / SEGREDO)
  timeline: TimelineMarker[];     // Marcadores de sessões e datas in-game
  maps?: MapData[];               // Cartografia e Atlas com pins geográficos
  playlists?: AudioPlaylist[];    // Playlists de áudio e soundboard tático
  customCalendar?: CustomCalendarConfig; // Calendário fictício / fases lunares
  settings?: CampaignSettings;    // Preferências locais e configuração do Assistente IA
}
```

---

## 3. Detalhamento dos Módulos

### 3.1. Nós do Grafo de Investigação (`nodes`)
Utiliza o formato padrão do [Svelte Flow](https://svelteflow.dev/) (`@xyflow/svelte`). Cada elemento da lista representa uma entidade visual no canvas.

```json
{
  "id": "node-1725380001",
  "type": "entityNode",
  "position": { "x": 350.0, "y": 180.0 },
  "data": {
    "id": "node-1725380001",
    "type": "npc",
    "category": "npc",
    "title": "Arthur Cervero",
    "subtitle": "Especialista em Ocultismo",
    "description": "Ex-agente que investiga estranhos desaparecimentos perto da serraria.",
    "tags": ["Aliado", "Ordem", "Investigador"],
    "isSecret": false,
    "revealed": true,
    "icon": "user",
    "color": "#d4a359",
    "tables": [],
    "notes": []
  }
}
```

#### Propriedades de `data`:
* **`type` / `category`**: Categoria da entidade. Valores suportados:
  * `"npc"`: Personagens não-jogáveis (aliados, vilões, neutros).
  * `"faction"`: Organizações, cultos, corporações, agências.
  * `"location"`: Locais, edifícios, cidades, salas.
  * `"secret"`: Mistérios ocultos exclusivos do Mestre.
  * `"clue"`: Pistas físicas, provas forenses ou documentos.
  * `"note"`: Anotações soltas e fichas de texto livre.
  * `"table"`: Tabelas de encontros e rolagem de dados embutidas.
* **`isSecret`** *(boolean)*: Quando `true`, indica que este nó contém informações sigilosas visíveis apenas na interface do Mestre.
* **`color`** *(hex string)*: Cor primária do cartão (ex: `"#d4a359"` para NPCs, `"#a855f7"` para Facções, `"#38bdf8"` para Locais, `"#f87171"` para Ameaças/Segredos).
* **`tables`** *(array)*: Lista de tabelas de encontros anexadas ao nó (`EncounterTable`), com dados de rolagem (d4, d6, d8, d10, d12, d20, d100) e faixas de valores.
* **`notes`** *(array)*: Lista de sub-documentos/anotações adicionais (`AttachedNote`).

---

### 3.2. Conexões e Relações Semânticas (`edges`)
Representa as linhas de ligação entre duas entidades no tabuleiro:

```json
{
  "id": "edge-node1-node2",
  "source": "node-1725380001",
  "target": "node-1725380002",
  "type": "custom",
  "data": {
    "label": "desconfia de",
    "relationType": "hostile",
    "pathType": "smoothstep",
    "bidirectional": false,
    "color": "#ef4444",
    "notes": "Arthur descobriu documentos comprometedores."
  }
}
```

#### Tipos de Relação (`relationType`):
* `"allied"`: Aliança ou amizade (geralmente verde `#22c55e`).
* `"hostile"`: Inimizade, rivalidade ou ameaça (geralmente vermelho `#ef4444`).
* `"secret"`: Ligação clandestina ou conspiração oculta (roxo `#a855f7`).
* `"neutral"`: Relação comercial, profissional ou neutra (cinzento `#71717a`).
* `"investigates"`: Relação de inquérito ou suspeita (azul/âmbar `#f59e0b`).
* `"custom"`: Relação personalizada com cor e texto livres.

---

### 3.3. Relógios de Ameaça (`clocks`)
Estruturas matemáticas para medir tensão e progressão de perigos com fatias em SVG:

```json
{
  "id": "clock-1",
  "title": "Ritual do Culto da Meia-Noite",
  "totalSegments": 6,
  "filledSegments": 4,
  "consequence": "O portal para a dimensão do Medo abre-se e a cidade é inundada de névoa.",
  "category": "Apocalipse",
  "createdAt": 1725378291000
}
```
* **`totalSegments`**: Suporta **4, 6, 8, 10 ou 12** fatias.
* **`filledSegments`**: Número de fatias preenchidas (`0 <= filledSegments <= totalSegments`).

---

### 3.4. Registo de Pistas e Segredos (`lore`)
Mural de factos e revelações da campanha:

```json
{
  "id": "lore-1",
  "title": "A Marca nos Cadáveres",
  "content": "Todos os corpos encontrados têm uma tatuagem em espiral no pulso esquerdo.",
  "status": "SABIDO",
  "sessionNumber": 2,
  "associatedNodeIds": ["node-1725380001", "node-1725380005"],
  "createdAt": 1725378291000,
  "updatedAt": 1725379000000
}
```
* **`status`**: Define se os jogadores já descobriram o facto:
  * `"SABIDO"`: A informação já foi revelada à mesa.
  * `"SEGREDO"`: Segredo exclusivo do Mestre até ser descoberto.
* **`associatedNodeIds`**: IDs de nós do canvas conectados diretamente a este facto.

---

### 3.5. Atlas e Cartografia (`maps`)
Permite carregar mapas geográficos da região ou planta baixa de edifícios, com pins ligados ao grafo:

```json
{
  "id": "map-1",
  "name": "Mapa do Vale das Sombras",
  "imageUrl": "data:image/jpeg;base64,...",
  "pins": [
    {
      "id": "pin-1",
      "label": "Mansão Assombrada",
      "xPercent": 42.5,
      "yPercent": 68.2,
      "color": "#f59e0b",
      "targetNodeId": "node-1725380002",
      "notes": "Local onde decorreu o massacre de 1985."
    }
  ]
}
```
* **`xPercent` / `yPercent`**: Coordenadas percentuais normalizadas (`0.0` a `100.0`), garantindo que os pins mantêm o posicionamento exato em qualquer resolução ou zoom do ecrã.
* **`targetNodeId`**: Permite clicar no pin e saltar diretamente para a ficha da entidade no Mural.

---

### 3.6. Calendário Customizado Fantástico (`customCalendar`)
Sistema de medição de tempo no mundo de jogo com cálculo em tempo real de fases lunares:

```json
{
  "id": "cal-custom-1",
  "name": "Calendário da Ordem",
  "weekdays": ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
  "months": [
    { "id": "m-1", "name": "Janeiro", "days": 31, "season": "Verão" },
    { "id": "m-2", "name": "Fevereiro", "days": 28, "season": "Verão" }
  ],
  "currentYear": 2026,
  "currentMonthIndex": 8,
  "currentDay": 8,
  "moons": [
    {
      "id": "moon-1",
      "name": "Lua Prateada",
      "cycleDays": 29.5,
      "startingPhaseDay": 0,
      "color": "#f8fafc"
    }
  ]
}
```

---

### 3.7. Configurações da Campanha (`settings`)
Guarda preferências estéticas e parâmetros de IA (Bring Your Own Key):

```json
{
  "theme": "dark",
  "autoSaveIntervalMs": 500,
  "aiProvider": "gemini",
  "apiKey": "SUA_CHAVE_AQUI",
  "aiModel": "gemini-1.5-flash",
  "ollamaEndpoint": "http://localhost:11434"
}
```
> **Nota de Segurança:** As chaves de API guardadas são estritamente locais à máquina do utilizador e nunca são transmitidas para qualquer servidor externo, exceto nos pedidos diretos aos respetivos fornecedores de IA configurados pelo Mestre.

---

## 4. Exemplo Completo de um Ficheiro `.mural`

Abaixo encontra-se um exemplo funcional completo e válido de uma campanha simples:

```json
{
  "id": "camp-exemplo-01",
  "name": "Investigação em Carpazinha",
  "system": "Ordem Paranormal",
  "currentSession": 3,
  "inGamePeriod": "Outono de 2023",
  "description": "Uma equipa de novatos investiga aparições estranhas num sanatório desativado.",
  "createdAt": 1725378291000,
  "updatedAt": "2026-09-08T19:00:00.000Z",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "node-1",
      "type": "entityNode",
      "position": { "x": 150, "y": 200 },
      "data": {
        "id": "node-1",
        "type": "npc",
        "title": "Dr. Hans Keller",
        "subtitle": "Diretor Médico",
        "description": "Conduzia experiências não autorizadas nos doentes.",
        "tags": ["Suspeito", "Médico"],
        "isSecret": false,
        "revealed": true,
        "color": "#d4a359"
      }
    },
    {
      "id": "node-2",
      "type": "entityNode",
      "position": { "x": 500, "y": 200 },
      "data": {
        "id": "node-2",
        "type": "location",
        "title": "Sanatório Santa Cruz",
        "subtitle": "Ala Psiquiátrica",
        "description": "Abandonado após um incêndio em 1994.",
        "tags": ["Local", "Perigo"],
        "isSecret": false,
        "revealed": true,
        "color": "#38bdf8"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "type": "custom",
      "data": {
        "label": "trabalhava em",
        "relationType": "neutral",
        "pathType": "smoothstep"
      }
    }
  ],
  "clocks": [
    {
      "id": "clock-1",
      "title": "A Manifestação do Vulto",
      "totalSegments": 6,
      "filledSegments": 3,
      "consequence": "O monstro ataca os agentes na escuridão."
    }
  ],
  "lore": [
    {
      "id": "lore-1",
      "title": "Registo de Pacientes Queimado",
      "content": "Página encontrada com o nome de 5 pacientes desaparecidos.",
      "status": "SABIDO",
      "sessionNumber": 2,
      "associatedNodeIds": ["node-2"]
    }
  ],
  "timeline": [
    {
      "id": "t-1",
      "sessionNumber": 1,
      "sessionText": "A Chegada à Vila",
      "inGameDate": "12 de Outubro",
      "isCurrent": false
    },
    {
      "id": "t-2",
      "sessionNumber": 2,
      "sessionText": "Primeiras Pistas",
      "inGameDate": "13 de Outubro",
      "isCurrent": false
    },
    {
      "id": "t-3",
      "sessionNumber": 3,
      "sessionText": "Explorando o Sanatório",
      "inGameDate": "14 de Outubro",
      "isCurrent": true
    }
  ],
  "maps": [],
  "settings": {
    "theme": "dark",
    "autoSaveIntervalMs": 500,
    "aiProvider": "gemini"
  }
}
```

---

## 5. Validação Defensiva e Migração Automática

O motor de persistência do Mural (`src/lib/services/storage.ts`) implementa políticas de validação estritas e tolerantes:
1. **Validação de Integridade (`validateCampaignSchema`)**:
   Verifica a presença obrigatória de `name`, e garante que `nodes`, `edges`, `clocks` e `lore` são arrays válidos.
2. **Auto-Cura e Migração de Ficheiros Legados (`migrateLegacyCampaign`)**:
   Caso abras um ficheiro antigo que não tenha campos mais recentes (como `timeline`, `customCalendar` ou `playlists`), o sistema injeta os valores padrão automaticamente, garantindo que o ficheiro é atualizado para a versão **1.0.0** sem qualquer perda de dados.
