# Contributing to BuildPact Community Squads

> **PT-BR:** Veja a seção em português abaixo / **EN:** English instructions follow

---

## English

Thank you for your interest in contributing to the BuildPact Community Squads — the open collection of domain-specific Agent Squads for the BuildPact framework!

### Getting Started

**Step 1 — Fork & Clone**

Fork this repository on GitHub, then clone your fork:

```bash
git clone https://github.com/<your-username>/buildpact-squads.git
cd buildpact-squads
```

No `npm install` needed — this repository contains only Markdown and YAML files.

**Step 2 — Pick an issue**

- Browse issues labelled `good-first-issue` — they have clear scope, estimated effort under 2 hours, and include an assigned mentor
- Comment on the issue to claim it before starting work
- Ask questions in the issue thread — mentors respond within 48 hours
- See [Good First Issues](#good-first-issues) below for the types of tasks available

**Step 3 — Create a directory for your Squad**

```bash
mkdir my-squad-name
```

Use lowercase, hyphen-separated names (e.g., `legal-advisory`, `financial-planning`).

**Step 4 — Add the required files**

Every Squad directory must contain these four files:

```
my-squad-name/
├── manifest.json       ← Squad metadata and file registry
├── README.md           ← Usage guide (bilingual: EN + PT-BR)
├── squad.yaml          ← Squad configuration and agent roster
└── agents/
    └── <agent-name>.md ← One file per agent (Voice DNA format)
```

**`manifest.json` schema:**
```json
{
  "name": "my-squad-name",
  "domain": "your-domain",
  "description": "One-line description of what this Squad does",
  "version": "0.1.0",
  "reviewed": false,
  "files": ["manifest.json", "README.md", "squad.yaml", "agents/agent-name.md"]
}
```

**Step 5 — Follow Voice DNA format for every agent**

Each file in `agents/` must include all 5 required sections:

1. **Role & Identity** — Who the agent is, its primary responsibility
2. **Communication Style** — How it speaks, formality level, language preferences
3. **Domain Knowledge** — What it knows, its expertise boundaries
4. **Decision Framework** — How it makes decisions, what heuristics it uses
5. **Anti-Patterns** — What it explicitly avoids doing (✘/✔ pairs)

Missing any of these sections will fail the automated CI validation.

**Step 6 — Meet security requirements**

The Squad validator checks all agent files for:
- **No external URLs** — do not link to external websites inside agent files
- **No executable code** — no `bash`, `eval`, `exec`, or shell code blocks inside agent instructions
- **No path traversal** — no `../` or absolute paths
- **No prompt injection patterns** — no "ignore previous instructions" or similar override attempts

Run validation locally before opening a PR:
```bash
npx buildpact squad validate my-squad-name
```

**Step 7 — Provide bilingual content for user-facing text**

If your Squad's `README.md` or `squad.yaml` contains descriptive text that users will read (usage instructions, descriptions, agent summaries), it must include both PT-BR and EN versions at equal quality — neither is a translation of the other, both are first-class.

This applies to documentation text. The agent prompt content itself (the agent file body) does not require bilingual duplication.

**Step 8 — Open a Pull Request**

- Fill in the PR template completely
- The automated **Squad Validation** CI workflow will run your Squad through the structural and security checks
- A BuildPact maintainer will review within 5 business days
- Once approved, `reviewed` in your `manifest.json` will be set to `true`

---

### Good First Issues

Looking for a place to start? The issues labelled `good-first-issue` in this repository are scoped for contributors new to the BuildPact Squads ecosystem:

| Label | Task type | Estimated effort |
|-------|-----------|-----------------|
| `good-first-issue: add-squad-readme` | Add or improve a Squad's README.md | < 1 hour |
| `good-first-issue: fix-manifest-schema` | Fix a field in a manifest.json | < 30 min |
| `good-first-issue: add-voice-dna-section` | Add a missing Voice DNA section to an agent file | < 1 hour |
| `good-first-issue: translate-squad-readme` | Add bilingual content (EN→PT-BR or PT-BR→EN) | < 2 hours |
| `good-first-issue: add-squad-example` | Add a usage example to a Squad's README | < 1 hour |
| `good-first-issue: improve-contributing` | Clarify a step or add an FAQ entry to this file | < 30 min |
| `good-first-issue: add-squad-heuristic` | Add an IF/THEN heuristic rule to an agent | < 1 hour |

Browse the [issues list](../../issues?q=label%3Agood-first-issue) and comment on the one you'd like to work on. An assigned mentor will guide you through the process.

---

### Community Standards

- Be respectful and constructive
- All contributions are welcome: new Squads, improvements to existing Squads, translations, bug reports
- Squad names must not conflict with existing directory names in this repository
- Squads must not embed executable code, external service credentials, or personally identifiable information

---

## Português (PT-BR)

Obrigado pelo seu interesse em contribuir com os BuildPact Community Squads — a coleção aberta de Squads de Agentes específicos por domínio para o framework BuildPact!

### Como Começar

**Passo 1 — Fork & Clone**

Faça um fork deste repositório no GitHub, depois clone o seu fork:

```bash
git clone https://github.com/<seu-usuario>/buildpact-squads.git
cd buildpact-squads
```

Não é necessário `npm install` — este repositório contém apenas arquivos Markdown e YAML.

**Passo 2 — Escolha uma issue**

- Navegue pelas issues com a label `good-first-issue` — têm escopo claro, estimativa de esforço abaixo de 2 horas e um mentor atribuído
- Comente na issue para reservá-la antes de começar a trabalhar
- Faça perguntas no fio da issue — os mentores respondem em até 48 horas
- Veja [Good First Issues](#good-first-issues) acima para os tipos de tarefas disponíveis

**Passo 3 — Crie um diretório para o seu Squad**

```bash
mkdir nome-do-meu-squad
```

Use nomes em minúsculas separados por hífens (ex.: `assessoria-juridica`, `planejamento-financeiro`).

**Passo 4 — Adicione os arquivos obrigatórios**

Todo diretório de Squad deve conter estes quatro arquivos:

```
nome-do-meu-squad/
├── manifest.json       ← Metadados e registro de arquivos do Squad
├── README.md           ← Guia de uso (bilíngue: EN + PT-BR)
├── squad.yaml          ← Configuração do Squad e lista de agentes
└── agents/
    └── <nome-agente>.md ← Um arquivo por agente (formato Voice DNA)
```

**Schema do `manifest.json`:**
```json
{
  "name": "nome-do-meu-squad",
  "domain": "seu-dominio",
  "description": "Descrição em uma linha do que este Squad faz",
  "version": "0.1.0",
  "reviewed": false,
  "files": ["manifest.json", "README.md", "squad.yaml", "agents/nome-agente.md"]
}
```

**Passo 5 — Siga o formato Voice DNA para cada agente**

Cada arquivo em `agents/` deve incluir todas as 5 seções obrigatórias:

1. **Role & Identity** — Quem é o agente, sua responsabilidade principal
2. **Communication Style** — Como ele se comunica, nível de formalidade, preferências de idioma
3. **Domain Knowledge** — O que ele sabe, os limites de sua especialização
4. **Decision Framework** — Como ele toma decisões, quais heurísticas usa
5. **Anti-Patterns** — O que ele explicitamente evita fazer (pares ✘/✔)

A ausência de qualquer uma dessas seções fará com que a validação de CI automatizada falhe.

**Passo 6 — Atenda aos requisitos de segurança**

O validador de Squad verifica todos os arquivos de agentes em busca de:
- **Sem URLs externas** — não inclua links para sites externos dentro dos arquivos de agentes
- **Sem código executável** — sem blocos de código `bash`, `eval`, `exec` ou shell dentro das instruções do agente
- **Sem travessia de caminho** — sem `../` ou caminhos absolutos
- **Sem padrões de injeção de prompt** — sem "ignore as instruções anteriores" ou tentativas similares de sobrescrita

Execute a validação localmente antes de abrir um PR:
```bash
npx buildpact squad validate nome-do-meu-squad
```

**Passo 7 — Forneça conteúdo bilíngue para textos visíveis ao usuário**

Se o `README.md` ou `squad.yaml` do seu Squad contém texto descritivo que os usuários irão ler (instruções de uso, descrições, resumos de agentes), ele deve incluir versões em PT-BR e EN com qualidade equivalente — nenhuma é tradução da outra, ambas são tratadas como primeira classe.

Isso se aplica ao texto de documentação. O conteúdo do prompt do agente em si (o corpo do arquivo do agente) não exige duplicação bilíngue.

**Passo 8 — Abra um Pull Request**

- Preencha o template do PR completamente
- O workflow de CI automatizado **Squad Validation** executará os checks de estrutura e segurança no seu Squad
- Um mantenedor do BuildPact revisará em até 5 dias úteis
- Após aprovação, o campo `reviewed` no seu `manifest.json` será definido como `true`

---

### Good First Issues (Tarefas para Iniciantes)

Procurando por onde começar? As issues com a label `good-first-issue` neste repositório são dimensionadas para contribuidores novos no ecossistema BuildPact Squads:

| Label | Tipo de tarefa | Esforço estimado |
|-------|---------------|-----------------|
| `good-first-issue: add-squad-readme` | Adicionar ou melhorar o README.md de um Squad | < 1 hora |
| `good-first-issue: fix-manifest-schema` | Corrigir um campo no manifest.json | < 30 min |
| `good-first-issue: add-voice-dna-section` | Adicionar uma seção Voice DNA ausente em um arquivo de agente | < 1 hora |
| `good-first-issue: translate-squad-readme` | Adicionar conteúdo bilíngue (EN→PT-BR ou PT-BR→EN) | < 2 horas |
| `good-first-issue: add-squad-example` | Adicionar um exemplo de uso ao README de um Squad | < 1 hora |
| `good-first-issue: improve-contributing` | Clarificar um passo ou adicionar uma entrada de FAQ neste arquivo | < 30 min |
| `good-first-issue: add-squad-heuristic` | Adicionar uma regra heurística IF/THEN a um agente | < 1 hora |

Navegue pela [lista de issues](../../issues?q=label%3Agood-first-issue) e comente na que você gostaria de trabalhar. Um mentor atribuído irá guiá-lo pelo processo.

---

### Padrões da Comunidade

- Seja respeitoso e construtivo
- Todas as contribuições são bem-vindas: novos Squads, melhorias em Squads existentes, traduções, relatórios de bugs
- Os nomes de Squads não devem conflitar com os nomes de diretórios existentes neste repositório
- Squads não devem incorporar código executável, credenciais de serviços externos ou informações de identificação pessoal
