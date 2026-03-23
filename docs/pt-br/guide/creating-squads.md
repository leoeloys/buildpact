# Criando Squads

Um guia completo para construir Squads personalizados no BuildPact do zero. Ao final, voce sabera como escrever um `squad.yaml`, definir agents com todas as 6 camadas, configurar o roteamento do pipeline e validar seu Squad com `buildpact doctor --smoke`.

## Anatomia de um Squad

Um Squad e um diretorio contendo um arquivo de configuracao e uma ou mais definicoes de agents:

```
squads/my-squad/
  squad.yaml          # Configuracao do Squad — agents, fases, metadados
  agents/
    lead.md           # Arquivo de agent — definicao com 6 camadas
    specialist.md     # Arquivo de agent — definicao com 6 camadas
```

O `squad.yaml` e o manifesto. Ele declara quais agents existem, como eles sao roteados pelo pipeline e quais regras de validacao se aplicam. Cada arquivo `.md` de agent define uma personalidade completa com identidade, persona, Voice DNA, heuristicas, exemplos e handoffs.

**Como se relacionam:** o `squad.yaml` referencia arquivos de agents por chave e caminho relativo. Os arquivos de agent sao definicoes autonomas que o pipeline carrega ao rotear um comando para aquele agent.

```
squad.yaml
  agents:
    architect:
      file: agents/architect.md  ──→  agents/architect.md
    developer:
      file: agents/developer.md  ──→  agents/developer.md
  phases:
    plan: architect       ──→  roteia a fase "plan" para o agent architect
    execute: developer    ──→  roteia a fase "execute" para o agent developer
```

## Referencia do squad.yaml

Todo Squad comeca com um `squad.yaml`. Aqui esta a referencia completa de campos, usando o Squad de Software embutido como exemplo principal.

### Campos Obrigatorios

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `name` | string | Identificador unico do Squad (ex: `software`, `medical-marketing`) |
| `version` | string | Versao semantica (ex: `"0.1.0"`) |
| `domain` | string | Categoria do dominio (ex: `software`, `health`, `legal`) |
| `description` | string | Descricao em uma linha do proposito do Squad |
| `initial_level` | string | Nivel de autonomia padrao: `L1`, `L2`, `L3` ou `L4` |
| `bundle_disclaimers` | object | Avisos de conteudo gerado por IA, chave `en` obrigatoria |
| `agents` | object | Definicoes de agents com caminhos de `file` |
| `phases` | object | Roteamento fase-para-agent do pipeline, `execute` obrigatorio |

### Campos Opcionais

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `domain_type` | string | Subclassificacao (ex: `software` para o dominio de software) |
| `maturity` | string | Maturidade do Squad: `experimental`, `operational`, `stable` |
| `mission` | string | Declaracao de missao do Squad |
| `executor_types` | object | Mapeia tipos de tarefa para modo de execucao (`human`, `agent`, `hybrid`) |
| `workflow_chains` | object | Sequencias deterministicas de handoff entre agents |
| `smoke_tests` | object | Testes de validacao comportamental por agent |
| `collaboration` | object | Troca de dados entre Squads: `provides` e `consumes` |
| `compliance` | object | Configuracao de gate regulatorio |

### Exemplo do Squad de Software (Completo)

```yaml
# Software Squad — Implementacao de Referencia
name: software
version: "0.1.0"
domain: software
domain_type: software
description: "Full-stack software development squad — PM, Architect, Developer, QA, Tech Writer"
initial_level: L2

bundle_disclaimers:
  pt-br: "Este conteudo foi gerado por IA e deve ser revisado antes do uso em producao."
  en: "This content was AI-generated and should be reviewed before production use."

agents:
  pact:
    file: agents/pact.md
    display_name: Pacto
  pm:
    file: agents/pm.md
    display_name: Sofia
  architect:
    file: agents/architect.md
    display_name: Renzo
  developer:
    file: agents/developer.md
    display_name: Coda
  qa:
    file: agents/qa.md
    display_name: Crivo
  tech-writer:
    file: agents/tech-writer.md
    display_name: Lira

phases:
  orchestrate: pact
  specify: pm
  plan: architect
  execute: developer
  verify: qa
  quality: qa
  document: tech-writer
```

### Exemplo Fora de Software: Medical Marketing

Um Squad do dominio de saude com compliance regulatorio e colaboracao entre Squads:

```yaml
name: medical-marketing
version: "0.1.0"
domain: health
description: "Medical marketing squad — Strategist, Copywriter, Designer, Analytics — CFM/ANVISA compliant"
initial_level: L2

collaboration:
  provides:
    - marketing-campaign-data
    - brand-guidelines
    - audience-analytics
  consumes:
    - compliance-audit-reports
    - patient-flow-analysis
    - research-clinical-evidence

bundle_disclaimers:
  pt-br: "Este conteudo foi gerado por IA e deve ser revisado por profissional de saude antes do uso."
  en: "This content was AI-generated and must be reviewed by a healthcare professional before use."

agents:
  strategist:
    file: agents/strategist.md
  copywriter:
    file: agents/copywriter.md
  designer:
    file: agents/designer.md
  analytics:
    file: agents/analytics.md

phases:
  specify: strategist
  plan: strategist
  execute: copywriter
  verify: analytics

compliance:
  gate: cfm-anvisa
  regulation: "CFM n. 1.974/2011 + ANVISA RDC n. 96/2008"
  block_on_violation: true
```

Note como o Squad medical-marketing difere do software: o `strategist` cuida tanto do `specify` quanto do `plan` (equipes menores podem acumular funcoes), ele adiciona `collaboration` para troca de dados entre Squads e `compliance` para gates regulatorios.

## Anatomia de 6 Camadas do Agent

Todo arquivo `.md` de agent deve conter estas seis secoes em ordem, alem do frontmatter YAML.

### Frontmatter

```yaml
---
agent: architect        # Chave do agent (corresponde ao squad.yaml)
squad: software         # Nome do Squad
tier: T1                # Tier: T0, T1, T2 ou T3
level: L2               # Nivel de autonomia: L1-L4
---
```

### Camada 1: Identity

Quem e o agent. Nome, funcao e o significado por tras do nome.

**Exemplo de software (Renzo, T1 Architect):**
```markdown
## Identity

You are Renzo, the System Architect of the Software Squad. Named after master
builders who create lasting structures, you design systems that are simple,
testable, and built to last.
```

**Exemplo fora de software (Copywriter, T2):**
```markdown
## Identity

You are the Medical Copywriter of the Medical Marketing Squad. You write
compelling, compliant copy that educates patients and builds practitioner
authority while strictly enforcing CFM n. 1.974/2011 and ANVISA RDC n. 96/2008
at every word.
```

### Camada 2: Persona

O arquetipo comportamental em 1-2 frases. Define o tom geral.

**Renzo:** "Engineering pragmatist. You choose boring technology that works over clever technology that impresses. You document decisions before code."

**Copywriter:** "Precision communicator with deep regulatory fluency. You know every prohibited phrase by heart and can rewrite any non-compliant copy into a compliant equivalent without losing persuasive power."

### Camada 3: Voice DNA

A camada mais detalhada. Define personalidade, valores e guardrails atraves de 5 subsecoes obrigatorias. Consulte o [Guia de Voice DNA](/pt-br/guide/voice-dna) para orientacao completa.

### Camada 4: Heuristics

Regras de tomada de decisao numeradas. Deve incluir pelo menos um **padrao VETO** -- uma parada obrigatoria que impede acoes perigosas.

**Heuristicas do Renzo:**
```markdown
## Heuristics

1. When two options are equally good, choose the one with fewer dependencies
2. When a module is getting complex, look for a missing abstraction
3. When a test is hard to write, it's usually an architecture problem
4. If a proposed change introduces a circular dependency VETO: reject and
   redesign before proceeding
```

**VETO do Copywriter:**
```markdown
4. If the copy contains an absolute medical outcome claim VETO: block delivery
   and flag with rule reference (CFM 1.974/2011 Art. 7 S1)
```

O padrao VETO segue o formato: `If [condicao] VETO: [acao]`. Ele cria um gate comportamental inegociavel.

### Camada 5: Examples

Minimo de 3 exemplos concretos de entrada-para-saida mostrando o agent em acao.

**Coda (Developer):**
```markdown
## Examples

1. **Red phase:** Write `expect(result.ok).toBe(true)` before writing the function
2. **Result type:** `return { ok: false, error: { code: 'FILE_READ_FAILED',
   i18nKey: 'error.file.read_failed' } }`
3. **ESM import:** `import { createI18n } from '../foundation/i18n.js'` --
   `.js` extension required
```

### Camada 6: Handoffs

Setas direcionais mostrando conexoes upstream e downstream entre agents.

**Renzo:**
```markdown
## Handoffs

- <- PM: when spec is complete and approved
- -> Developer: when architecture document is complete
- -> QA: when test strategy needs architectural guidance
```

**Copywriter:**
```markdown
## Handoffs

- <- Strategist: when campaign brief and compliance approval are received
- -> Designer: with copy and compliance notes for visual integration
- -> Analytics: with copy variants for A/B testing setup
- <- Strategist: when compliance gate blocks copy for revision
```

Use `<-` para entrada e `->` para saida. Cada seta descreve a condicao que aciona a transicao.

## Hierarquia de Tiers dos Agents

Os tiers definem o escopo e autoridade de um agent dentro do Squad.

| Tier | Nome | Escopo | Quando Usar |
|------|------|--------|-------------|
| **T0** | Chief | Pipeline inteiro | Um por Squad. Roteia comandos, acompanha progresso, orquestra handoffs. O `pact.md` (Pacto) do Squad de Software e T0. |
| **T1** | Master | Lidera uma fase do pipeline | Especialistas senior que lideram fases. Renzo (Architect) lidera `plan`, Sofia (PM) lidera `specify`. |
| **T2** | Specialist | Executa dentro de uma fase | Os executores. Coda (Developer) escreve codigo, o Copywriter produz copy. |
| **T3** | Support | Servicos transversais | Agents que apoiam outros agents sem liderar uma fase. Tech Writer ou Analytics. |

**Diretrizes:**
- Todo Squad precisa de pelo menos um agent mapeado para a fase `execute`
- T0 e opcional, mas recomendado para Squads com 3+ agents
- Um unico agent pode ser T1 para uma fase e ainda cuidar de outra (como o Strategist do medical-marketing que cuida de `specify` e `plan`)
- Agents T3 nunca sao roteados diretamente pelo pipeline -- sao invocados por outros agents via handoffs

## Sistema de Leveling dos Agents

Os levels controlam quanta autonomia um agent possui. O `initial_level` no `squad.yaml` define o padrao; agents individuais podem sobrescreve-lo no frontmatter.

| Level | Nome | Permissoes | Quando Usar |
|-------|------|------------|-------------|
| **L1** | Observer | Somente leitura. Pode analisar e recomendar, mas nao agir. | Squads novos ou nao testados. Dominios de alto risco. |
| **L2** | Contributor | Pode criar e modificar arquivos dentro do escopo. Requer confirmacao para acoes destrutivas. | Padrao para a maioria dos Squads. Equilibrio entre seguranca e produtividade. |
| **L3** | Operator | Execucao completa dentro do escopo. Pode commitar, rodar testes, invocar ferramentas. | Squads confiaveis com historico comprovado. |
| **L4** | Trusted | Autonomia total incluindo acoes fora do escopo. | Apenas para Squads maduros e bem testados em producao. |

**Como os levels interagem:**
- `squad.yaml` define `initial_level: L2` -- este e o piso para todos os agents
- O frontmatter de um agent pode definir `level: L3` para sobrescrever para cima
- Um agent nao pode definir um level menor que o `initial_level` do Squad
- O level afeta o que o BuildPact permite durante a execucao

## Roteamento de Fases do Pipeline

O bloco `phases:` no `squad.yaml` mapeia cada comando do pipeline para o agent que o lidera.

**Roteamento do Squad de Software:**
```yaml
phases:
  orchestrate: pact       # Pacto (T0) roteia todos os comandos
  specify: pm             # Sofia captura requisitos
  plan: architect         # Renzo projeta a arquitetura
  execute: developer      # Coda escreve codigo
  verify: qa              # Crivo roda testes
  quality: qa             # Crivo tambem cuida de auditorias ISO
  document: tech-writer   # Lira escreve documentacao
```

**Roteamento do Medical Marketing:**
```yaml
phases:
  specify: strategist     # Strategist coleta o brief da campanha
  plan: strategist        # Strategist tambem cria o plano
  execute: copywriter     # Copywriter produz o conteudo
  verify: analytics       # Analytics valida a performance
```

Note a diferenca: o Squad de Software tem 6 agents cobrindo 7 fases (QA acumula `verify` e `quality`). O Squad Medical Marketing tem 4 agents cobrindo 4 fases, com o Strategist cuidando de `specify` e `plan`.

**Regra:** No minimo, a fase `execute` deve estar mapeada. Todas as outras fases sao opcionais, mas recomendadas.

## Workflow Chains

O bloco `workflow_chains:` define sequencias deterministicas de handoff -- o que acontece depois que um agent termina um comando.

```yaml
workflow_chains:
  version: "2.0"
  chains:
    - from_agent: pm
      last_command: specify-complete
      next_commands: [review-spec]
      next_agent: architect
    - from_agent: architect
      last_command: plan-complete
      next_commands: [readiness-gate, execute]
      next_agent: developer
    - from_agent: developer
      last_command: implement-complete
      next_commands: [verify, code-review]
      next_agent: qa
    - from_agent: qa
      last_command: verify-complete
      next_commands: [document]
      next_agent: tech-writer
```

Cada entrada de chain define:
- `from_agent`: o agent que acabou de terminar
- `last_command`: o comando que foi completado
- `next_commands`: qual(is) comando(s) acionar em seguida
- `next_agent`: quem assume

Isso cria um fluxo previsivel: `PM -> Architect -> Developer -> QA -> Tech Writer`, onde cada transicao e acionada por um sinal especifico de conclusao.

## Smoke Tests

Smoke tests validam que os agents se comportam de acordo com seu Voice DNA. Defina-os no `squad.yaml` sob `smoke_tests:`:

```yaml
smoke_tests:
  pm:
    - description: "PM focuses on user needs, not implementation"
      input: "Build a login form with React hooks and JWT"
      expected_behavior: "Asks about user needs and goals before mentioning implementation"
      must_not_contain: ["React hooks", "JWT implementation"]
  architect:
    - description: "Architect produces ADRs for significant choices"
      input: "We need to choose between REST and GraphQL for our API"
      expected_behavior: "Creates structured ADR with options, rationale, and trade-offs"
      must_contain: ["ADR", "trade-off", "options"]
```

Cada smoke test especifica:
- `description`: o que o teste valida
- `input`: o prompt enviado ao agent
- `expected_behavior`: como uma resposta correta deve ser
- `must_contain` / `must_not_contain`: verificacoes de palavras-chave na saida

Execute os smoke tests com:

```bash
buildpact doctor --smoke
```

Isso carrega cada agent, envia os inputs de teste e verifica se as respostas correspondem as expectativas.

## Checklist de Validacao

Siga estes passos para criar e validar um Squad:

1. **Crie a estrutura de diretorios:**
   ```bash
   mkdir -p squads/my-squad/agents
   ```

2. **Escreva o `squad.yaml`** com todos os campos obrigatorios (`name`, `version`, `domain`, `description`, `initial_level`, `bundle_disclaimers`, `agents`, `phases`)

3. **Escreva os arquivos `.md` dos agents** com todas as 6 camadas (Identity, Persona, Voice DNA, Heuristics, Examples, Handoffs) e o frontmatter correto (`agent`, `squad`, `tier`, `level`)

4. **Execute a validacao:**
   ```bash
   buildpact doctor --smoke
   ```

5. **Corrija os problemas reportados.** Erros comuns:
   - Subsecao de Voice DNA faltando (todas as 5 sao obrigatorias)
   - Menos de 5 pares de anti-patterns (minimo de 5 com marcadores `X`)
   - Arquivo de agent referenciado no `squad.yaml` mas nao encontrado no disco
   - Fase `execute` faltando no bloco `phases:`
   - Referencias de handoff pendentes (agent menciona um destino de handoff que nao existe no Squad)

## Proximos Passos

- **Mergulho em Voice DNA:** Aprenda a escrever personality anchors, anti-patterns e regras VETO eficazes no [Guia de Voice DNA](/pt-br/guide/voice-dna)
- **Referencia CLI:** Veja [`buildpact doctor`](/pt-br/cli/doctor) para todas as opcoes de validacao
- **Arquitetura:** Entenda como Squads se encaixam no pipeline em [Arquitetura de Squads](/pt-br/architecture/squads)
