# Technical Specification: R3 (Interactive GM Operational Suite), R4 (Context-Aware AI Assistant & BYOK Engine), and Acceptance Criteria

> **Document ID:** SPEC-SURVEY-03-R3-R4  
> **Author:** `spec_miner_survey_3`  
> **Target Version:** Mural (OrdemTools) v0.2.0  
> **Status:** Authoritative Technical Specification  
> **Date:** 2026-08-31  

---

## 1. Executive Architecture Summary

Mural (OrdemTools) is a local-first Tabletop RPG (TTRPG) Game Master (GM) Screen, investigation conspiracy board, and campaign manager built on **Svelte 5 (Runes)**, **@xyflow/svelte (Svelte Flow)**, **Tailwind CSS v4**, and **Tauri v2**.

This document defines the exhaustive technical specification for:
1. **R3: Interactive GM Operational Suite**:
   - **Threat Clocks (Progress Clocks):** Segmented circular countdowns supporting 4, 6, 8, 10, and 12 slices with mathematical SVG rendering, click-to-advance/decrement interactions, category styling, and completion triggers.
   - **Lore & Clue Registry:** Real-time dual-state tracking (`SABIDO` vs `SEGREDO`), entity-node linkage (`associatedNodeIds`), inline creation, filtering, and cross-canvas node focus.
   - **Interactive Timeline:** Dual chronometry (in-game calendar period vs session sequence), active session indicator, navigation, and event markers.
   - **Interactive Map / Atlas View:** Multi-map pan/zoom canvas, percentage-normalized pin placement, entity deep-linking ("Ver no Mural"), and popover previews.
2. **R4: Context-Aware AI GM Assistant & BYOK Engine**:
   - **"A mesa descarrilou?" Narrative Rescue:** 1-click incident solver generating 3 structured, highly contextual hooks (`[Consequência Imediata]`, `[Pista Alternativa]`, `[Avanço da Ameaça]`) with direct action buttons.
   - **Compressed Board Context Serializer:** Deterministic, token-optimized context extractor (< 1,200 tokens) distilling visible nodes, active threat clocks, hidden secrets, and semantic relationships.
   - **BYOK (Bring Your Own Key) Engine:** Unified polymorphic provider interface (`IAiProvider`) supporting **Google Gemini**, **OpenAI**, **Anthropic Claude**, **Local Ollama** (100% offline), and built-in simulation fallback, complete with credential masking, connection testing, and security sanitization.
3. **Acceptance Criteria & Verification Test Matrix**:
   - Concrete, reproducible verification commands and edge-case validation gates for 0 TypeScript/Svelte errors, clean Tauri Rust builds, and flawless UI/persistence integrity.

---

## 2. Features Discovered & Functional Taxonomy

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R3 - Clocks | Multi-Segment Clocks (4, 6, 8, 10, 12) | Renders circular segmented threat clocks with exact slice counts. | `totalSegments: 4 \| 6 \| 8 \| 10 \| 12`, `filledSegments: number` | SVG radial ring with $N$ distinct visual slices. | Clamps $0 \le filled \le total$. Rejects invalid segment sizes. | `ORIGINAL_REQUEST.md`, `context_ai.md` §4 |
| 2 | R3 - Clocks | Click-to-Advance & Decrement | Left click increments $+1$; Right click (or context menu) decrements $-1$. | Mouse Click / ContextMenu / Enter / Space | Updated `filledSegments` in store + re-rendered SVG. | If filled equals total, left-click is a no-op or re-triggers alert; right-click stops at 0. | `ThreatClockItem.svelte`, `context_ai.md` §3.4 |
| 3 | R3 - Clocks | Direct Slice Selection | Clicking a specific slice index $i \in [0, N-1]$ fills clock to $i+1$ (or toggles slice). | Pointer click on slice `<path>` or `<circle>` | Store update `filledSegments = i + 1`. | Slice hit-box bounds check; prevents negative index. | Feature Expansion (Probed) |
| 4 | R3 - Clocks | Completion Triggers & Alert Banner | When `filledSegments === totalSegments`, visual pulse, badge "COMPLETO!", and consequence display trigger. | Clock reaching full capacity | Animated ring pulse, consequence banner / toast, sound cue hook. | Graceful fallback if `consequenceText` is empty. | `ORIGINAL_REQUEST.md` §R3, `context_ai.md` §4 |
| 5 | R3 - Clocks | Clock CRUD & Categorization | Add, edit title/segments/category/color/consequence, reset, and delete clocks. | User modal/inline inputs | Updated `campaign.clocks` array in store + auto-save. | Validates non-empty title; deletes safely without orphan refs. | `ThreatClocksPanel.svelte`, `context_ai.md` §4 |
| 6 | R3 - Lore | Dual-State Toggle (`SABIDO` vs `SEGREDO`) | Single-click instant toggle between player-known and GM-secret facts. | Button click on badge / keyboard toggle | State switches `SABIDO` $\leftrightarrow$ `SEGREDO` + real-time badge color change. | Idempotent toggle; no data loss. | `ORIGINAL_REQUEST.md` §R3, `LoreEntryItem.svelte` |
| 7 | R3 - Lore | Entity Node Association | Clues/Lore entries link to canvas nodes via `associatedNodeIds: string[]`. | Node IDs array | Click badge/link to focus and highlight node in Svelte Flow canvas. | Ignores deleted node IDs gracefully. | `context_ai.md` §4.5 |
| 8 | R3 - Lore | Session Discovery Attribution | Records in which session a clue was introduced or revealed. | `sessionNumber: number` | Filtered badge display (e.g., "Sessão 14"). | Defaults to current active session if not specified. | `context_ai.md` §4.5 |
| 9 | R3 - Lore | Lore Filtering & Search | Filter lore items by status (`TODOS`, `SABIDO`, `SEGREDO`) or search text. | Filter buttons, search string | Filtered list view with instant reactive update. | Empty search shows all matching status filter. | `LorePanel.svelte`, Feature Expansion |
| 10 | R3 - Lore | Quick Inline & Header Note | Add lore directly via panel input or global `Header.svelte` shortcut modal. | Content text, initial status | New `LoreEntry` prepended to array + auto-save. | Rejects whitespace-only entries. | `Header.svelte`, `LorePanel.svelte` |
| 11 | R3 - Timeline | Dual Chronometry Display | Shows in-game world period (e.g. "Bruma, Ano 998") and real session markers. | `inGamePeriod: string`, `timeline: TimelineMarker[]` | Horizontal bottom footer with timeline track and date display. | Fallbacks to default string if empty. | `BottomTimeline.svelte`, `context_ai.md` §3.5 |
| 12 | R3 - Timeline | Active Session Marker & Switching | Highlights active session with glowing amber pulse and allows switching current session. | Click on session node | Sets `isCurrent` flag, updates `campaign.currentSession`. | Exactly one marker is marked `isCurrent = true`. | `BottomTimeline.svelte`, `context_ai.md` §4.6 |
| 13 | R3 - Timeline | Timeline Marker CRUD | Add new session marker, edit title/inGameDate/description, or remove markers. | Session number, label, date | Updated timeline track + store persistence. | Automatically maintains chronological ordering. | Feature Expansion (Probed) |
| 14 | R3 - Atlas | Multi-Map Viewport | Upload or select image maps (World, City, Dungeon) with pan & zoom capabilities. | Image file (data URI / local file path / URL) | Interactive map canvas with pan/zoom controls. | Fallback placeholder if no map uploaded. | `ORIGINAL_REQUEST.md` §R3, `context_ai.md` §3.2 |
| 15 | R3 - Atlas | Normalized Pin Placement | Place pins at normalized $(x\%, y\%)$ coordinates on the map surface. | Click on map in "Add Pin" mode | Pin rendered with category icon, color, and tooltip. | Normalization prevents coordinate drift on resize. | Feature Expansion (Probed) |
| 16 | R3 - Atlas | Pin Entity Linkage & Deep Navigation | Pins link to `CanvasEntityNode` (e.g. Location, NPC). Clicking navigates to Canvas view and centers on node. | `targetNodeId: string` | View switches to Canvas tab and calls `fitView({ nodes: [id] })`. | Displays warning if linked entity was deleted. | Feature Expansion (Probed) |
| 17 | R4 - AI | "A mesa descarrilou?" Emergency UI | Input incident description and generate 3 immediate narrative contingency hooks. | Incident text string (e.g. "Mataram o taverneiro") | 3 categorized actionable hooks displayed in panel. | Disabled during generation; validation on empty input. | `ORIGINAL_REQUEST.md` §R4, `AiAssistantPanel.svelte` |
| 18 | R4 - AI | Structured 3-Hook Contract | Output strictly formats 3 hooks: `[Consequência Imediata]`, `[Pista Alternativa]`, `[Avanço da Ameaça]`. | Structured LLM output or local fallback | Formatted cards with distinct category icons and action buttons. | Robust parsing regex handles LLM formatting variations. | `context_ai.md` §6 |
| 19 | R4 - AI | Actionable Hook Integration | Direct buttons on generated hooks: "Adicionar ao Lore", "Avançar Relógio", "Copiar". | Click on action button | Appends to Lore registry, increments clock, or copies text. | Feedback toast confirms action completion. | Feature Expansion (Probed) |
| 20 | R4 - AI | Board Context Serializer | Compresses active nodes, high-threat clocks, hidden secrets, and edges into concise prompt (< 1.2k tokens). | `CampaignData` store object | Compressed markdown / JSON payload injected into LLM prompt. | Prunes verbose fields; caps payload size. | `ORIGINAL_REQUEST.md` §R4, `context_ai.md` §6 |
| 21 | R4 - BYOK | Multi-Provider Engine | Configurable BYOK adapter supporting Gemini, OpenAI, Anthropic, Ollama, and Mock simulation. | `CampaignSettings.aiProvider`, API keys, endpoints, models | Unified async generator returning `AiResponse`. | Informative error messages for network/auth failures. | `ORIGINAL_REQUEST.md` §R4, `context_ai.md` §4.1 |
| 22 | R4 - BYOK | Ollama Local Endpoint Support | Connects to local Ollama instance (`http://localhost:11434`) for 100% offline, zero-cloud AI inference. | Endpoint URL, model name (e.g. `llama3.2`) | Local REST call to `/api/chat` or `/api/generate`. | Detects Ollama offline / CORS / connection refused. | `ORIGINAL_REQUEST.md` §R4, `context_ai.md` §4.1 |
| 23 | R4 - BYOK | Connection Test & Credential Masking | "Testar Conexão" button sends a 0-token ping; API keys masked in UI and omitted from public exports. | Settings modal interaction | Status badge (Online / Invalid Key / Network Error). | Keys never exposed in plain text logs or exported .mural files unless explicitly chosen. | Feature Expansion (Probed) |

---

## 3. Edge Cases & Failure Recovery Matrix

| # | Feature | Input / Condition | Observed / Required Behavior | Recovery / Fallback Action |
|---|---------|-------------------|------------------------------|----------------------------|
| E1 | Threat Clocks | Left click when clock is already 100% full (`filled === total`). | Clock does not exceed `totalSegments`. Re-triggers completion animation/sound. | Value clamped to `totalSegments`. No overflow. |
| E2 | Threat Clocks | Right click when clock is at 0 (`filled === 0`). | Clock does not drop below 0. | Value clamped to 0. No negative segments. |
| E3 | Threat Clocks | Slices count set to odd or unsupported number (e.g. 5, 7, 13). | UI restricts selector strictly to `{4, 6, 8, 10, 12}`. | Type-safe union `4 \| 6 \| 8 \| 10 \| 12` prevents invalid values. |
| E4 | Threat Clocks | High segment counts (10, 12) rendered in small container ($32\times 32$ px). | Stroke-dasharray gaps might overlap if gap is too large. | Mathematical gap dynamically scales: $gap = \max(1, \frac{12}{N})$. |
| E5 | Lore Registry | Lore entry created with whitespace only (`"   "`). | Creation is blocked; button disabled or trim check fails. | Input field trimmed; no empty items created. |
| E6 | Lore Registry | Linked entity in `associatedNodeIds` is deleted from canvas. | Lore item still renders text; deleted node pill displays as "(Entidade Removida)". | Graceful fallback without crashing or throwing null reference. |
| E7 | Timeline | Active session marker deleted by user. | System promotes the latest existing session marker to `isCurrent = true`. | If all deleted, recreates default `Sessão 1` marker. |
| E8 | Map / Atlas | Map image URL fails to load or local file is missing. | Atlas view displays placeholder graphic with "Imagem não encontrada - Carregar novo mapa". | Graceful image error state; does not block UI. |
| E9 | Map / Atlas | Map window resized drastically or zoomed to extreme scale. | Normalized coordinates $(x\%, y\%)$ keep pins pinned to exact visual features. | Scale clamped between $0.2\times$ and $5.0\times$. |
| E10 | AI Assistant | AI generation triggered with empty or whitespace-only prompt. | Generate button is disabled (`disabled={!input.trim()}`). | Prevents wasteful API calls. |
| E11 | AI Assistant | LLM returns unformatted plain text instead of 3 numbered sections. | Regex / parsing pipeline extracts sentences into 3 fallback hooks. | Normalizer ensures 3 cards always render in UI. |
| E12 | AI BYOK | Invalid API Key or Quota Exceeded (HTTP 401 / 429). | Displays user-friendly error: "Chave de API inválida ou limite de quota atingido" with option to use offline simulation. | Clear error toast + fallback button "Usar Modo Offline". |
| E13 | AI BYOK | Ollama selected but local daemon is not running (`ECONNREFUSED` at `localhost:11434`). | Error message: "Ollama não detetado em localhost:11434. Inicia o Ollama ou verifica a porta." | Prompt user to start Ollama or switch to Cloud/Mock provider. |
| E14 | AI Context | Massive campaign with 100+ nodes and 50 lore items exceeds token window. | Context Serializer prunes by relevance: top 10 visible/nearby nodes, active clocks, top 5 secrets, last 5 lore items. | Token count strictly bounded under 1,200 tokens. |

---

## 4. R3: Interactive GM Operational Suite Deep Dive

### 4.1. Threat Clocks (Progress Clocks) Specification

Progress Clocks are a foundational TTRPG storytelling mechanism designed to track impending doom, faction maneuvers, stealth alerts, or environmental hazards.

```
      === 4 SLICES ===               === 6 SLICES ===               === 8 SLICES ===
          .---.                          .---.                          .---.
        /   |   \                      / \  |  / \                    /  \|/  \
       |----+----|                    |---|---+---|                  |---|---+---|
        \   |   /                      \ /  |  \ /                    \  /|\  /
          '---'                          '---'                          '---'
```

#### 4.1.1. Supported Segment Configurations
The engine must strictly support segment counts of **4, 6, 8, 10, and 12**:
- **4 Slices:** Simple short countdowns (e.g., "Alerta da Guarda", "Fuga do Refém").
- **6 Slices:** Standard threat clock (e.g., "Avanço do Culto", "Desabamento da Mina").
- **8 Slices:** Major faction schemes (e.g., "Cerco a Vallenmoor", "Invocação do Sangue").
- **10 Slices:** Extended campaign milestones (e.g., "Corrupção da Relíquia").
- **12 Slices:** Epic doom countdowns (e.g., "O Alinhamento dos Astros", "O Despertar da Criatura").

#### 4.1.2. Mathematical SVG Segment Calculations
Two complementary mathematical approaches are specified for rendering the segmented ring:

##### Approach A: Parametric Arc Paths (`<path d="...">`)
For interactive wedge or annular sector rendering where each individual slice can be hovered, styled, and clicked:

Let the center be $(C_x, C_y)$, outer radius $R$, inner radius $r$ (for donut rings; $r=0$ for pie slices), and slice count $N$.  
Let angular gap between slices be $\delta$ radians (typically $\delta \approx 0.05 \text{ rad} \approx 2.86^\circ$).

For slice index $i \in \{0, 1, \dots, N-1\}$:
$$\theta_{\text{start}}(i) = i \cdot \frac{2\pi}{N} - \frac{\pi}{2} + \frac{\delta}{2}$$
$$\theta_{\text{end}}(i) = (i + 1) \cdot \frac{2\pi}{N} - \frac{\pi}{2} - \frac{\delta}{2}$$

The 4 boundary points of the annular slice are:
1. Outer Start: $P_1 = (C_x + R \cos\theta_{\text{start}}, C_y + R \sin\theta_{\text{start}})$
2. Outer End: $P_2 = (C_x + R \cos\theta_{\text{end}}, C_y + R \sin\theta_{\text{end}})$
3. Inner End: $P_3 = (C_x + r \cos\theta_{\text{end}}, C_y + r \sin\theta_{\text{end}})$
4. Inner Start: $P_4 = (C_x + r \cos\theta_{\text{start}}, C_y + r \sin\theta_{\text{start}})$

The SVG path `d` attribute is generated as:
```text
M {P1.x} {P1.y}
A {R} {R} 0 {largeArcFlag} 1 {P2.x} {P2.y}
L {P3.x} {P3.y}
A {r} {r} 0 {largeArcFlag} 0 {P4.x} {P4.y}
Z
```
where `largeArcFlag = (θ_end - θ_start) > π ? 1 : 0` (always `0` for $N \ge 4$).

##### Approach B: Stroked Ring with `stroke-dasharray` and `transform: rotate`
For lightweight, ultra-performant, GPU-accelerated rendering inside lists and nodes:

Let radius $R = 13\text{px}$, center $(16, 16)$, SVG viewBox `0 0 32 32`.  
Circumference:
$$C = 2 \pi R \approx 2 \cdot 3.14159265 \cdot 13 \approx 81.6814\text{px}$$
Let pixel gap between segments be $g = 2\text{px}$ (for $N \le 8$) and $g = 1.5\text{px}$ (for $N \in \{10, 12\}$).  
Total gap allocation: $G_{\text{total}} = N \cdot g$.  
Segment stroke length:
$$L_{\text{seg}} = \frac{C - N \cdot g}{N}$$

For segment index $i \in \{0, 1, \dots, N-1\}$:
- `strokeDasharray`: `"${L_seg} ${C - L_seg}"`
- Rotation angle: $\phi_i = \left(\frac{360^\circ}{N}\right) \cdot i - 90^\circ$
- SVG transform: `rotate(${phi_i} 16 16)`

Exact constants for all supported slice counts ($R=13$, $C=81.6814$):
| Slices ($N$) | Gap ($g$) | Segment Length ($L_{\text{seg}}$) | Dasharray Pattern | Slice Angle Step ($\Delta\phi$) |
|:---|:---|:---|:---|:---|
| **4** | $2.0\text{px}$ | $\frac{81.6814 - 8}{4} = 18.42\text{px}$ | `18.42 63.26` | $90.00^\circ$ |
| **6** | $2.0\text{px}$ | $\frac{81.6814 - 12}{6} = 11.61\text{px}$ | `11.61 70.07` | $60.00^\circ$ |
| **8** | $1.8\text{px}$ | $\frac{81.6814 - 14.4}{8} = 8.41\text{px}$ | `8.41 73.27` | $45.00^\circ$ |
| **10** | $1.5\text{px}$ | $\frac{81.6814 - 15}{10} = 6.67\text{px}$ | `6.67 75.01` | $36.00^\circ$ |
| **12** | $1.2\text{px}$ | $\frac{81.6814 - 14.4}{12} = 5.61\text{px}$ | `5.61 76.07` | $30.00^\circ$ |

#### 4.1.3. Interactive Gestures & State Transitions
1. **Left-Click / Primary Action**: Increments `filledSegments += 1`.
2. **Right-Click / Context Menu**: Decrements `filledSegments -= 1` (calls `e.preventDefault()`).
3. **Keyboard Accessibility**: Focusable (`tabindex="0"`), `Enter` / `Space` increments, `Backspace` / `-` decrements.
4. **Direct Slice Click**: Clicking directly on segment $i$ sets `filledSegments = (current === i + 1) ? i : i + 1`.
5. **Completion Trigger**:
   - Condition: `filledSegments === totalSegments`.
   - Effect: Sets `isCompleted = true`.
   - UI Reactions:
     - Outer ring pulses with a golden/crimson halo (`animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.8)]`).
     - Badge display: `[COMPLETO]` in bold amber.
     - Consequence text popover/toast appears: `consequenceText || "Ameaça concretizada!"`.
     - Optional action: 1-click button "Criar Pista de Consequência no Lore".

#### 4.1.4. Clock Category & Theme Color Palette
| Category | Default Color | Tailwind Token | Semantic Meaning |
|:---|:---|:---|:---|
| `threat` | `#ef4444` (Red) / `#f59e0b` (Amber) | `stroke-amber-500`, `stroke-red-500` | Imminent danger, hostile escalation |
| `faction_progress` | `#a855f7` (Purple) | `stroke-purple-500` | Secret faction agendas, occult rituals |
| `countdown` | `#06b6d4` (Cyan) | `stroke-cyan-500` | Timers, bomb fuses, escape windows |
| `environmental` | `#10b981` (Emerald) | `stroke-emerald-500` | Rising tides, blizzard, collapsing ruins |
| `investigation` | `#eab308` (Yellow) | `stroke-yellow-500` | Clues gathered, mysteries solved |

---

### 4.2. Lore & Clue Registry Specification

The Lore & Clue Registry serves as the GM's live intelligence ledger during sessions, segregating discovered facts from classified plot secrets.

```text
+-------------------------------------------------------------------------------+
| REGISTO DE LORE & PISTAS                    [🔍 Filtrar...]  [+ Nova Pista]  |
+-------------------------------------------------------------------------------+
| [TODOS]  [SABIDO (2)]  [SEGREDO (2)]                        Sessão Atual: 14  |
+-------------------------------------------------------------------------------+
| [SABIDO]   Há um culto nas ruínas a norte de Vallenmoor.           (Sessão 12)|
|            🔗 [Ordem da Chama Pálida] [Vallenmoor]                            |
|-------------------------------------------------------------------------------|
| [SEGREDO]  Serah reporta tudo à Ordem da Chama Pálida.             (Sessão 14)|
|            🔗 [Serah, a Espia] [Ordem da Chama Pálida]   [👁️ Revelar aos PJ] |
|-------------------------------------------------------------------------------|
| [SEGREDO]  O poço sob o mercado foi reaberto.                      (Sessão 13)|
|            🔗 [O Poço Selado]                            [👁️ Revelar aos PJ] |
+-------------------------------------------------------------------------------+
```

#### 4.2.1. Dual-State Visibility Model
- **`SABIDO` (Known / Revealed):** Information that the player characters know with certainty.
  - Visual: Emerald green pill badge (`bg-emerald-950/70 border-emerald-700/50 text-emerald-400`).
  - Safe for Player Presentation / Fog-of-War export.
- **`SEGREDO` (Secret / Hidden):** Information exclusive to the GM.
  - Visual: Crimson rose pill badge (`bg-rose-950/70 border-rose-700/50 text-rose-400`).
  - Rendered with quick-reveal toggle button.

#### 4.2.2. Entity Linkage & Canvas Highlighting
Each `LoreEntry` optionally contains `associatedNodeIds: string[]`.
- Hovering an entity link pill in the lore list adds a soft highlight pulse to the corresponding node on the canvas.
- Clicking the entity link pill:
  1. If on Canvas view: centers and zooms the camera onto the node using `@xyflow/svelte` `fitView({ nodes: [{ id }] })`.
  2. Opens the entity preview or edit modal.

#### 4.2.3. Data Structure & State Mutations
```typescript
export interface LoreEntry {
  id: string;
  content: string;
  status: 'SABIDO' | 'SEGREDO';
  sessionNumber: number;
  associatedNodeIds?: string[];
  tags?: string[];
  createdAt?: string;
  revealedAtSession?: number;
}
```

State operations on `campaignStore`:
- `toggleLoreStatus(id: string)`: Inverts status `SABIDO` $\leftrightarrow$ `SEGREDO`.
- `addLoreEntry(content: string, status: 'SABIDO' | 'SEGREDO', associatedNodeIds?: string[])`: Adds new entry at top.
- `updateLoreEntry(id: string, partial: Partial<LoreEntry>)`: Updates content or associations.
- `deleteLoreEntry(id: string)`: Removes entry from array.

---

### 4.3. Interactive Timeline & Chronological Engine Specification

The Timeline manages the campaign's temporal dimensions, providing instant reference for when events transpired and how far the campaign has progressed.

```text
+----------------------------------------------------------------------------------------------------------+
| 📅 Bruma, Ano 998 |  [S11] ------- [S12] ------- [S13] ------- [★ Hoje · S14] ------- [S15 (Planeado)] |
+----------------------------------------------------------------------------------------------------------+
```

#### 4.3.1. Dual Chronometry Architecture
1. **In-Game Calendar (`inGamePeriod` / `inGameDate`):** Narrative time in the fiction (e.g. *"Bruma, Ano 998"*, *"15 de Outubro de 1923, Noite"*).
2. **Session Track (`timeline: TimelineMarker[]`):** Real-world play sessions indexed numerically.

#### 4.3.2. Timeline Data Model
```typescript
export interface TimelineMarker {
  id: string;
  sessionNumber: number;
  sessionText: string; // e.g. "Sessão 11", "Hoje · 14", "Feira · 20"
  inGameDate?: string;
  title?: string;
  summary?: string;
  isCurrent?: boolean;
  status?: 'completed' | 'active' | 'planned';
}
```

#### 4.3.3. Interaction & Filtering Engine
- **Active Session Pin:** Exactly one marker has `isCurrent = true`, rendered with an animated golden halo (`bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]`).
- **Session Switching:** Clicking any session marker sets `campaign.currentSession = marker.sessionNumber` and activates session-specific lore filtering.
- **Fast Advance (+ Sessão):** GM button to advance to the next session, auto-generating marker `Sessão {N+1}` and archiving past session state.

---

### 4.4. Interactive Map / Atlas View Engine Specification

The Atlas module provides visual cartographic reference for campaigns, linking spatial locations directly to conspiratorial canvas graph entities.

```text
+-------------------------------------------------------------------------------+
| MAPAS & ATLAS: Vallenmoor e Arredores              [🗺️ Mudar Mapa]  [+ Pin]    |
+-------------------------------------------------------------------------------+
|  +-------------------------------------------------------------------------+  |
|  | [Pan / Zoom Map Canvas]                                                 |  |
|  |                                                                         |  |
|  |                  📍 (Praça do Mercado)                                  |  |
|  |                     |                                                   |  |
|  |                     +--> [ Popover Card ]                               |  |
|  |                          "Vallenmoor — Praça do Mercado"                |  |
|  |                          Entidade: [LOCAL: loc-vallenmoor]              |  |
|  |                          Segredo Oculto: O Poço Selado                  |  |
|  |                          [ 🔍 Ver no Mural ] [ Editar Pin ]             |  |
|  |                                                                         |  |
|  |          📍 (Ruínas a Norte)                                            |  |
|  |                                                                         |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
```

#### 4.4.1. Map Data Model
```typescript
export interface MapPin {
  id: string;
  mapId: string;
  xPercent: number; // 0.0 to 100.0 (normalized percentage across any resolution)
  yPercent: number; // 0.0 to 100.0
  title: string;
  description?: string;
  category: 'location' | 'npc' | 'secret' | 'danger' | 'poi';
  color?: string;
  targetNodeId?: string; // ID of CanvasEntityNode in relationship board
}

export interface AtlasMap {
  id: string;
  name: string;
  imageUrl: string; // Base64 data URI, Tauri asset URL, or web link
  width: number;
  height: number;
  pins: MapPin[];
}
```

#### 4.4.2. Viewport & Pan/Zoom Matrix
- **Transform State:** `zoom` ($0.2\times$ to $5.0\times$) and pan offset `(translateX, translateY)`.
- **Gesture Support:**
  - Mouse wheel: Zoom centered at cursor position.
  - Middle-click drag or Left-click drag (when Pan Tool active): Pan map viewport.
  - Reset View button: Centers map and fits bounding box to viewport.
- **Normalized Pin Placement:** When clicking on the map at client coordinate $(P_x, P_y)$:
  $$x_{\text{percent}} = \left(\frac{P_x - \text{mapLeft}}{\text{mapWidth}}\right) \times 100$$
  $$y_{\text{percent}} = \left(\frac{P_y - \text{mapTop}}{\text{mapHeight}}\right) \times 100$$
  This ensures pins stay locked to exact cartographical landmarks regardless of window resizing or zoom level.

#### 4.4.3. Deep-Linking to Canvas Board ("Ver no Mural")
When the GM clicks "Ver no Mural" on a pin popover:
1. Active view switches from `maps` to `board`.
2. Svelte Flow canvas animates to the linked `targetNodeId`.
3. The node is selected and given a brief 1.5s golden glow animation (`ring-4 ring-amber-400/80`).

---

## 5. R4: Context-Aware AI GM Assistant & BYOK Engine Deep Dive

### 5.1. "A mesa descarrilou?" Emergency Narrative Rescue Core

The AI Assistant is designed as an emergency co-GM improvisational engine. When players make unforeseen decisions, the assistant synthesizes the entire active board context to propose 3 immediate, coherent narrative pivots.

```text
+-------------------------------------------------------------------------------+
| ⚡ ASSISTENTE: "A MESA DESCARRILOU?"                                           |
+-------------------------------------------------------------------------------+
| O que aconteceu na mesa?                                                      |
| [ Os jogadores mataram o guarda na entrada e fugiram para os esgotos... ]     |
|                                                                               |
| [ ⚡ Gerar 3 Ideias de Contingência ]                                          |
+-------------------------------------------------------------------------------+
| 1. [CONSEQUÊNCIA IMEDIATA]                                                    |
|    A ronda da Ordem da Chama Pálida encontra o corpo e aciona o alarme       |
|    geral nos esgotos, bloqueando a saída para o porto.                        |
|    [+ Lore: SEGREDO]  [+ Avançar Relógio (+1)]  [📋 Copiar]                    |
|                                                                               |
| 2. [PISTA ALTERNATIVA]                                                        |
|    Nos esgotos, tropeçam na entrada secreta do Poço Selado antes do previsto, |
|    encontrando inscrições que revelam a traição de Serah.                     |
|    [+ Lore: SABIDO]   [👁️ Focar no Mapa]        [📋 Copiar]                    |
|                                                                               |
| 3. [AVANÇO DA AMEAÇA]                                                         |
|    O assassinato força o líder do culto a antecipar o ritual em 2 horas.      |
|    Avança o relógio "Cerco a Vallenmoor" em 2 fatias.                         |
|    [+ Avançar Relógio (+2)]                      [📋 Copiar]                    |
+-------------------------------------------------------------------------------+
```

#### 5.1.1. Structured 3-Hook Output Contract
The response must always deliver exactly 3 actionable hooks mapped to narrative levers:
1. **`[Consequência Imediata]` (Immediate Reaction):** An immediate world or NPC response leveraging existing board factions/NPCs.
2. **`[Pista Alternativa]` (Alternate Path):** A new avenue to discover an existing hidden secret or clue without stalling the game.
3. **`[Avanço da Ameaça]` (Escalating Urgency):** Progression of an active threat clock or villain counter-move that pressures players to act.

#### 5.1.2. Direct Hook Actions
Each generated hook card provides one-click action buttons:
- **`+ Adicionar ao Lore`**: Ingests hook text as a new `LoreEntry` (`SABIDO` or `SEGREDO`).
- **`+ Avançar Relógio`**: Automatically increments the relevant `ThreatClock` by 1 or 2 slices.
- **`📋 Copiar`**: Copies hook text to system clipboard with visual confirmation.

---

### 5.2. Compressed Board Context Serializer

The Context Serializer (`buildBoardContextPayload`) converts the active campaign state into a compact, deterministic prompt payload under 1,200 tokens.

#### 5.2.1. Serialization Algorithm & Logic
```typescript
export function buildBoardContextPayload(campaign: CampaignData): string {
  // 1. Filter and compress Active Threat Clocks
  const clocksStr = campaign.clocks
    .map(c => `- ${c.title}: ${c.filledSegments}/${c.totalSegments} fatias${c.filledSegments === c.totalSegments ? ' (COMPLETO)' : ''}`)
    .join('\n');

  // 2. Filter and compress Entities (NPCs, Factions, Locations)
  const nodes = campaign.nodes || [];
  const npcs = nodes.filter(n => n.data.type === 'npc').map(n => `- NPC: ${n.data.title} (${n.data.subtitle || 'Papel não especificado'}) - ${n.data.description}`).slice(0, 8);
  const factions = nodes.filter(n => n.data.type === 'faction').map(n => `- Facção: ${n.data.title} - ${n.data.description}`).slice(0, 4);
  const locations = nodes.filter(n => n.data.type === 'location').map(n => `- Local: ${n.data.title} - ${n.data.description}`).slice(0, 6);

  // 3. Extract Hidden Secrets
  const secrets = nodes.filter(n => n.data.type === 'secret' || n.data.isSecret).map(n => `- Segredo Oculto: ${n.data.title} (${n.data.description})`).slice(0, 5);

  // 4. Extract Relationships (Edges)
  const edgesStr = (campaign.edges || [])
    .map(e => {
      const source = nodes.find(n => n.id === e.source)?.data.title || e.source;
      const target = nodes.find(n => n.id === e.target)?.data.title || e.target;
      return `- "${source}" ${e.label || 'relaciona-se com'} "${target}"`;
    })
    .slice(0, 10)
    .join('\n');

  // 5. Extract Recent Lore
  const recentLore = (campaign.lore || [])
    .slice(0, 6)
    .map(l => `- [${l.status}] ${l.content}`)
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
```

#### 5.2.2. Master System Prompt Definition
```text
SISTEMA:
És o co-mestre de RPG experiente e ágil da aplicação Mural (OrdemTools).
A tua missão é ajudar o Mestre de Jogo quando a mesa descarrila ou os jogadores tomam decisões completamente imprevistas.
Deves propor soluções inteligentes, tensas e coerentes com as entidades, relógios e segredos já existentes na campanha.

INSTRUÇÕES ESTRITAS:
1. Responde SEMPRE em Português.
2. Fornece EXATAMENTE 3 ganchos curtos, diretos e acionáveis, numerados de 1 a 3.
3. Formata rigorosamente cada opção com as seguintes tags iniciais:
   1. [Consequência Imediata]: Uma reviravolta lógica e imediata que envolve um NPC ou Facção existente.
   2. [Pista Alternativa]: Um novo caminho para revelar um dos Segredos Ocultos existentes.
   3. [Avanço da Ameaça]: Como esta ação acelera um dos Relógios de Ameaça ou eleva a urgência.
4. Mantém cada ponto com no máximo 2 a 3 frases. Não faças introduções nem conclusões genéricas.
```

---

### 5.3. BYOK (Bring Your Own Key) Multi-Provider Engine

#### 5.3.1. Unified Provider Interface (`IAiProvider`)
```typescript
export interface AiProviderConfig {
  provider: 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'mock';
  apiKey?: string;
  model?: string;
  customEndpoint?: string; // e.g. http://localhost:11434 for Ollama
  temperature?: number;
  maxTokens?: number;
}

export interface AiHookOption {
  category: 'immediate_consequence' | 'alternative_clue' | 'threat_advancement';
  title: string;
  content: string;
  rawText: string;
}

export interface AiResponse {
  success: boolean;
  hooks: AiHookOption[];
  rawOutput: string;
  providerUsed: string;
  modelUsed: string;
  errorMessage?: string;
}

export interface IAiProvider {
  generateRescueHooks(prompt: string, contextPayload: string, config: AiProviderConfig): Promise<AiResponse>;
  testConnection(config: AiProviderConfig): Promise<{ ok: boolean; message: string }>;
}
```

#### 5.3.2. Provider Adapter Implementations

##### 1. Google Gemini Provider (`GeminiProvider`)
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
- **Default Models:** `gemini-1.5-flash` (recommended for speed), `gemini-2.0-flash`, `gemini-1.5-pro`.
- **Payload Schema:**
  ```json
  {
    "contents": [
      {
        "role": "user",
        "parts": [{ "text": "${systemPrompt}\n\nCONTEXTO:\n${contextPayload}\n\nOCORRÊNCIA:\n${prompt}" }]
      }
    ],
    "generationConfig": {
      "temperature": 0.7,
      "maxOutputTokens": 800
    }
  }
  ```

##### 2. OpenAI Provider (`OpenAiProvider`)
- **Endpoint:** `${customEndpoint || 'https://api.openai.com/v1'}/chat/completions`
- **Default Models:** `gpt-4o-mini` (recommended), `gpt-4o`, `gpt-3.5-turbo`.
- **Headers:** `Authorization: Bearer ${apiKey}`, `Content-Type: application/json`.
- **Payload Schema:**
  ```json
  {
    "model": "${model || 'gpt-4o-mini'}",
    "messages": [
      { "role": "system", "content": "${systemPrompt}" },
      { "role": "user", "content": "CONTEXTO:\n${contextPayload}\n\nOCORRÊNCIA:\n${prompt}" }
    ],
    "temperature": 0.7
  }
  ```

##### 3. Anthropic Claude Provider (`AnthropicProvider`)
- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Default Models:** `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307`.
- **Headers:** `x-api-key: ${apiKey}`, `anthropic-version: 2023-06-01`, `Content-Type: application/json`.
- **Payload Schema:**
  ```json
  {
    "model": "${model || 'claude-3-5-sonnet-20241022'}",
    "system": "${systemPrompt}",
    "messages": [
      { "role": "user", "content": "CONTEXTO:\n${contextPayload}\n\nOCORRÊNCIA:\n${prompt}" }
    ],
    "max_tokens": 800
  }
  ```

##### 4. Ollama Local Offline Provider (`OllamaProvider`)
- **Endpoint:** `${customEndpoint || 'http://localhost:11434'}/api/chat`
- **Default Models:** `llama3.2`, `mistral`, `qwen2.5`, `phi3`.
- **Features:** 100% offline, zero internet connection required, zero API cost.
- **Payload Schema:**
  ```json
  {
    "model": "${model || 'llama3.2'}",
    "messages": [
      { "role": "system", "content": "${systemPrompt}" },
      { "role": "user", "content": "CONTEXTO:\n${contextPayload}\n\nOCORRÊNCIA:\n${prompt}" }
    ],
    "stream": false,
    "options": {
      "temperature": 0.7
    }
  }
  ```

##### 5. Built-in Simulation Fallback (`MockProvider`)
When no API key is provided or the device is offline without Ollama:
- Generates 3 contextual hooks based on keyword analysis of existing campaign entities, active clocks, and unrevealed secrets.

#### 5.3.3. Response Parser & Normalizer
The raw LLM string is parsed into structured objects using robust multi-pattern regex:
```typescript
export function parseAiRescueResponse(rawText: string): AiHookOption[] {
  const hooks: AiHookOption[] = [];
  
  // Patterns to detect the 3 categories
  const cat1Match = rawText.match(/(?:1\.\s*\[?(?:Consequência Imediata|Consequencia Imediata)\]?:?)([\s\S]*?)(?=(?:2\.\s*\[?|$))/i);
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
    // Fallback: Split by lines starting with numbers
    const lines = rawText.split(/\n(?=\d+\.)/).filter(l => l.trim().length > 0);
    const categories: AiHookOption['category'][] = ['immediate_consequence', 'alternative_clue', 'threat_advancement'];
    const titles = ['Consequência Imediata', 'Pista Alternativa', 'Avanço da Ameaça'];

    for (let i = 0; i < 3; i++) {
      hooks.push({
        category: categories[i],
        title: titles[i],
        content: (lines[i] || `Opção de contingência ${i + 1}`).replace(/^\d+\.\s*(\[[^\]]+\])?\s*:?\s*/, '').trim(),
        rawText: lines[i] || '',
      });
    }
  }

  return hooks;
}
```

---

## 6. Acceptance Criteria & Verification Test Matrix

### 6.1. Build & Compilation Verification Gates

| Target | Command | Expected Output | Verification Criteria |
|:---|:---|:---|:---|
| **TypeScript & Svelte 5 Checks** | `npx svelte-check --tsconfig ./tsconfig.json` | `svelte-check found 0 errors and 0 warnings` | Strict zero error policy across all `.svelte` and `.ts` files. |
| **Vite Production Bundle** | `npm run build` | `dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css` built successfully | Production assets generated with exit code 0. |
| **Desktop Rust Backend** | `cargo check --manifest-path src-tauri/Cargo.toml` | `Finished dev profile target(s)` with exit code 0 | Rust backend compiles cleanly without errors or broken dependencies. |

### 6.2. Functional Acceptance Criteria Test Matrix

| Acceptance Item | Description | Concrete Test Step | Expected Result | Pass/Fail Gate |
|:---|:---|:---|:---|:---|
| **AC-R3-01: Threat Clock Segment Slicing** | Accurate rendering of 4, 6, 8, 10, 12 slices. | Create a clock for each segment count ($N \in \{4, 6, 8, 10, 12\}$). | Exactly $N$ distinct SVG arc segments rendered around the ring. | Required |
| **AC-R3-02: Threat Clock Increment/Decrement** | Left click increments $+1$; Right click decrements $-1$. | Click 3 times left, then 1 time right on a 6-segment clock. | Clock progresses $0 \to 1 \to 2 \to 3 \to 2$ filled segments. | Required |
| **AC-R3-03: Threat Clock Completion State** | Trigger alert/pulse when clock is 100% full. | Increment 4-segment clock to 4/4 filled slices. | Ring pulses with amber glow, consequence banner displays. | Required |
| **AC-R3-04: Lore SABIDO / SEGREDO Toggle** | Real-time 1-click status flip. | Click on `[SEGREDO]` badge on lore item `lore-2`. | Badge immediately turns emerald green `[SABIDO]` without page reload. | Required |
| **AC-R3-05: Lore Fast Creation** | Add note via Header and Lore Panel. | Enter `"O culto tem um esconderijo"` in quick note modal. | Item appears at top of lore list with default `SEGREDO` badge. | Required |
| **AC-R3-06: Interactive Timeline Navigation** | Highlight current session and switch markers. | Click marker `Sessão 11` on bottom timeline. | Current session switches to 11; active indicator highlights marker. | Required |
| **AC-R3-07: Interactive Map Pin Placement & Deep-Link** | Place pin on map, link to entity, navigate to canvas. | Place pin on Map linking to `loc-vallenmoor`, click "Ver no Mural". | View shifts to Canvas tab and centers smoothly on `loc-vallenmoor`. | Required |
| **AC-R3-08: AI Rescue 3-Hook Generation** | Input incident and generate 3 structured hooks. | Type `"Jogadores incendiaram a taverna"` and click "Gerar 3 Ideias". | Generates exactly 3 cards: `[Consequência Imediata]`, `[Pista Alternativa]`, `[Avanço da Ameaça]`. | Required |
| **AC-R3-09: AI Board Context Payload** | Context serializer packages active board elements. | Inspect serialized payload from sample campaign. | Contains campaign name, active clocks, visible NPCs, and hidden secrets under 1,200 tokens. | Required |
| **AC-R3-10: BYOK Multi-Provider & Local Ollama** | BYOK settings allow selecting Gemini, OpenAI, Claude, Ollama. | Select `Ollama` provider with endpoint `http://localhost:11434`. | Configuration persists; test connection verifies local status. | Required |
| **AC-R2-01: Campaign Export / Import Integrity** | Export `.mural` / `.json` and re-import. | Export active campaign, modify state, re-import exported file. | Campaign restores all nodes, edges, clocks, lore, and timeline markers with 100% fidelity. | Required |

---

## 7. Architectural Implementation Blueprint for Development Team

### 7.1. Directory & File Placement
```text
src/
├── lib/
│   ├── types/
│   │   └── index.ts                 # Full unified types (CampaignData, ThreatClock, LoreEntry, TimelineMarker, MapPin, AtlasMap, AiProviderConfig)
│   ├── stores/
│   │   ├── campaignStore.svelte.ts  # Runes store for active campaign, clock mutations, lore toggles, timeline state
│   │   ├── appState.svelte.ts       # Runes store for menu view, multi-campaigns, atlas state, active tabs
│   │   └── settingsStore.svelte.ts  # BYOK credentials, theme, local preferences
│   ├── services/
│   │   ├── ai/
│   │   │   ├── aiService.ts         # Facade orchestrator for AI generation & prompt formatting
│   │   │   ├── contextSerializer.ts # buildBoardContextPayload serializer
│   │   │   ├── geminiProvider.ts    # Google Gemini REST adapter
│   │   │   ├── openAiProvider.ts    # OpenAI Chat completions adapter
│   │   │   ├── anthropicProvider.ts # Anthropic Messages adapter
│   │   │   ├── ollamaProvider.ts    # Ollama local offline adapter
│   │   │   └── mockProvider.ts      # Offline simulation generator
│   │   └── storage/
│   │       └── persistenceService.ts# Tauri FS plugin / IndexedDB Local-First engine
│   └── components/
│       ├── clocks/
│       │   ├── ThreatClocksPanel.svelte # Clocks list + Add Clock modal trigger
│       │   ├── ThreatClockItem.svelte   # SVG segmented ring + left/right click handlers
│       │   └── AddClockModal.svelte     # 4/6/8/10/12 selector + category + consequence modal
│       ├── lore/
│       │   ├── LorePanel.svelte         # Lore ledger + filter tabs + inline search/input
│       │   └── LoreEntryItem.svelte     # SABIDO/SEGREDO badge + entity link pills
│       ├── layout/
│       │   ├── Header.svelte            # Search + quick note modal + export
│       │   ├── NavigationSidebar.svelte # Board / Maps / Timeline / Settings tabs
│       │   └── BottomTimeline.svelte    # In-game date + session markers track
│       ├── atlas/
│       │   ├── AtlasView.svelte         # Pan/zoom map canvas + pin renderer
│       │   ├── MapPinPopover.svelte     # Preview card + "Ver no Mural" deep link
│       │   └── AddPinModal.svelte       # Coordinate & entity linker modal
│       └── assistant/
│           ├── AiAssistantPanel.svelte  # "A mesa descarrilou?" incident input + 3-hook display
│           ├── AiHookCard.svelte        # Individual hook card + Lore/Clock action buttons
│           └── ByokSettingsModal.svelte # API key / Ollama configuration & Test Connection ping
```

---
*End of Technical Specification SPEC-SURVEY-03-R3-R4.*
