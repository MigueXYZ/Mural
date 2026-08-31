# 📜 Mural (OrdemTools)

> **Modern TTRPG GM Screen, Investigation Board & Narrative Campaign Manager**  
> Construído com **Svelte 5**, **Svelte Flow (@xyflow/svelte)**, **Tailwind CSS**, **shadcn-svelte**, **Lucide Icons** e empacotado nativamente com **Tauri v2**.

---

## ✨ Funcionalidades Principais

- 🕸️ **Quadro de Relações & Conspiração (Canvas Interativo):**
  - Mapeamento visual em grafo de NPCs, Facções, Locais, Pistas e Segredos.
  - Conexões semânticas personalizadas (*"é aliado de"*, *"esconde-se sob"*, *"investiga"*).
  - Nós customizados com cores e ícones de identificação rápida.

- ⏱️ **Relógios de Ameaça (Progress Clocks):**
  - Relógios segmentados interativos (estilo *Blades in the Dark / PbtA*) com 4, 6, 8, 10 ou 12 fatias.
  - Controlo instantâneo por clique para avançar ou recuar perigos da sessão.

- 🔒 **Gestão de Segredos & Lore:**
  - Registro de fatos e pistas com controle de visibilidade (`SABIDO` vs `SEGREDO`).
  - Revelação de segredos em tempo real com um único clique.

- 📅 **Linha do Tempo de Sessões:**
  - Marcadores temporais in-game e histórico de sessões na barra inferior.

- 🤖 **Assistente de Emergência ("A mesa descarrilou?"):**
  - Assistente com IA que ingere o contexto atual do tabuleiro (NPCs, ameaças ativas, segredos ocultos) e fornece 3 ganchos imediatos de improviso quando os jogadores saem do roteiro.
  - Suporte a chaves de API próprias (Gemini, OpenAI, Claude) ou modelos 100% locais via Ollama.

- ⚡ **Local-First & Desktop Nativo:**
  - Guarda as tuas campanhas em ficheiros locais (`.mural` / `.json`).
  - Funciona totalmente offline com consumo mínimo de memória (< 40MB de RAM) via **Tauri v2**.

---

## 🛠️ Stack Tecnológico

- **Frontend:** [Svelte 5](https://svelte.dev/) (Runes), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Motor de Grafo:** [@xyflow/svelte (Svelte Flow)](https://svelteflow.dev/)
- **Estilização & UI:** [Tailwind CSS v4](https://tailwindcss.com/), [shadcn-svelte](https://shadcn-svelte.com/)
- **Ícones:** [lucide-svelte](https://lucide.dev/)
- **Desktop Runtime:** [Tauri v2](https://v2.tauri.app/) (Rust)

---

## 🚀 Como Começar

### Pré-requisitos
- **Node.js** (v18+)
- **Rust & Cargo** (para compilação nativa com Tauri)

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/MigueXYZ/Mural.git
cd Mural

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento web
npm run dev

# Iniciar em modo desktop nativo com Tauri
npm run tauri dev
```

---

## 📁 Estrutura do Projeto

Para detalhes aprofundados sobre arquitetura, contratos de tipos TypeScript, modelos de dados e roadmap de desenvolvimento, consulta o ficheiro [`context_ai.md`](./context_ai.md).

---

## 📄 Licença

Este projeto é desenvolvido para a comunidade de RPG de mesa. Distribuído sob a licença MIT.
