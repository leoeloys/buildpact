# Migrando do GSD

O GSD (Get Shit Done) oferece um framework estruturado de planejamento e execucao para desenvolvimento assistido por IA. O BuildPact compartilha a enfase do GSD em fases e saida estruturada, e estende isso com personas de agents, controle de custos, aplicacao de constitution e suporte multi-dominio.

Este guia mapeia os conceitos do GSD para equivalentes no BuildPact e conduz voce por uma migracao completa.

## Por que Migrar?

O GSD oferece fases de research-plan-execute com rastreamento de estado em arquivos. O BuildPact mantem essa abordagem estruturada e adiciona:

- **Personas de agents** com Voice DNA e expertise de dominio (GSD nao tem conceito de agents)
- **Budget guards** que impedem custos descontrolados com IA
- **Execucao por waves** com isolamento de subagent por tarefa
- **Aplicacao de constitution** que valida a saida da IA contra as regras do seu projeto
- **Fase specify** para captura estruturada de requisitos antes do planejamento
- **Fase verify** com validacao goal-backward apos a execucao
- **Trilha de auditoria** com rastreabilidade completa de cada decisao
- **Suporte multi-dominio** alem de software

## Mapeamento de Conceitos

### Estrutura de Diretorios

| GSD | BuildPact | O que Muda |
|---|---|---|
| `.planning/` | `.buildpact/` | Adiciona `audit/`, `memory/`, configuracao estruturada |
| `.planning/STATE.md` | `.buildpact/output/` (saidas por fase) | Estado rastreado pelos artefatos do pipeline, nao por um unico arquivo de estado |
| `.planning/ROADMAP.md` | Saida do `buildpact plan` | Tarefas organizadas em waves em vez de roadmap linear |
| `.planning/REQUIREMENTS.md` | Saida do `buildpact specify` | Spec em linguagem natural com deteccao de ambiguidade |
| `.planning/phases/` | `.buildpact/output/` | Saidas organizadas por fase do pipeline, nao por fases numeradas |

### Fases do Workflow

| Fase GSD | Fase BuildPact | O que Muda |
|---|---|---|
| Research | `buildpact plan --research` | Pesquisa paralela automatizada integrada ao planejamento; nao e uma fase manual separada |
| Plan | `buildpact plan` | Grupos de tarefas por waves com suporte a execucao paralela; validacao multi-perspectiva |
| Execute | `buildpact execute` | Isolamento de subagent por tarefa; commits git atomicos; recuperacao de falhas; budget guards |
| *(sem equivalente)* | `buildpact specify` | Captura estruturada de requisitos com deteccao de ambiguidade antes do planejamento |
| *(sem equivalente)* | `buildpact verify` | Verificacao goal-backward checa resultados contra a spec original |

### Configuracao

| GSD | BuildPact | Notas |
|---|---|---|
| `config.json` / configuracao manual | `.buildpact/config.yaml` | Formato YAML; inclui model profiles, limites de budget, configuracao de squad, preferencia de idioma |
| Selecao de modelo do executor | Model profiles no config | Direciona tarefas para diferentes modelos baseado em complexidade e custo |
| Frontmatter do plano | Saida YAML do plano | Plano estruturado com waves, dependencias e metadados de tarefas |

### Modelo de Execucao

| GSD | BuildPact | Notas |
|---|---|---|
| Agent executor unico | Subagent por tarefa | Cada tarefa roda em isolamento com sua propria janela de contexto |
| Execucao sequencial de tarefas | Paralelismo por waves | Tarefas independentes dentro de uma wave rodam concorrentemente |
| Checkpoints manuais | Gates de verificacao automatizados | Checagens de constitution em cada fronteira de fase |
| Commits por fase | Commit atomico por tarefa | Cada tarefa produz exatamente um commit git |

## Passo a Passo da Migracao

### 1. Instalar o BuildPact

```bash
npm install -g buildpact
```

### 2. Executar o Adopt no Seu Projeto

```bash
cd seu-projeto-gsd
buildpact adopt
```

O comando `adopt` detecta sua configuracao GSD:

- Encontra o diretorio `.planning/` e le o estado existente
- Identifica o idioma e dominio do seu projeto pelos artefatos existentes
- Solicita selecao de squad, preferencias de IDE e limites de budget
- Gera `.buildpact/` com configuracao pre-preenchida

### 3. Revisar Sua Configuracao

```bash
cat .buildpact/config.yaml
```

Verifique que:

- `language` corresponde a sua preferencia
- `domain` esta definido corretamente
- `budget` tem limites configurados (GSD nao tem equivalente -- defina agora)
- `squad` referencia o template de squad apropriado

### 4. Configurar uma Constitution

O GSD nao tem conceito de constitution. O BuildPact gera uma constitution padrao durante o `adopt`, mas voce deve revisa-la e personaliza-la:

```bash
cat .buildpact/constitution.md
```

Adicione os padroes de codigo do seu projeto, restricoes arquiteturais e requisitos de qualidade. A constitution e aplicada em cada fase do pipeline.

### 5. Executar o Doctor

```bash
buildpact doctor
```

Corrija quaisquer problemas reportados.

### 6. Testar com uma Tarefa Rapida

```bash
buildpact quick "descreva uma pequena mudanca relevante ao seu projeto"
```

Se isso completar com sucesso, sua migracao esta feita.

## Novidades do BuildPact

Estas funcionalidades nao possuem equivalente no GSD:

- **Personas de agents**: Agents nomeados com expertise de dominio, Voice DNA e niveis de autonomia. O GSD usa prompts genericos de executor.
- **Fase specify**: Captura estruturada de requisitos com deteccao de ambiguidade antes do inicio do planejamento.
- **Fase verify**: Verificacao goal-backward checa se os resultados da execucao correspondem a spec original.
- **Aplicacao de constitution**: Regras do projeto validadas em cada fronteira de fase, nao apenas por revisao humana.
- **Budget guards**: Defina limites de gasto e receba avisos antes de excede-los.
- **Tiers de memoria**: Feedback de sessao, padroes aprendidos e decisoes persistem entre sessoes.
- **Hub comunitario**: Compartilhe e descubra squads criados por outros times.
- **Suporte multi-dominio**: Squads de marketing, saude e pesquisa alem de software.

## Diferencas Conhecidas

Esteja ciente destas diferencas de comportamento:

- **Sem STATE.md**: O BuildPact rastreia estado pelos artefatos do pipeline e logs de auditoria, nao por um unico arquivo de estado. Use `buildpact status` para ver o estado atual.
- **Sem ROADMAP.md**: Planos produzem tarefas organizadas em waves, nao um roadmap linear. A estrutura de waves e otimizada para execucao paralela.
- **Sem numeracao de fases**: O GSD usa fases numeradas (01, 02, ...). O BuildPact usa fases nomeadas (specify, plan, execute, verify) que sempre rodam na mesma ordem.
- **Sem checkpoints manuais**: O GSD depende de checkpoints humanos durante a execucao. O BuildPact automatiza a verificacao por meio de checagens de constitution e da fase verify.
- **Pesquisa e integrada**: O GSD trata a pesquisa como uma fase separada. O BuildPact integra a pesquisa na fase plan via `buildpact plan --research`.

## Seus Arquivos GSD Estao Seguros

O BuildPact nao toca no seu diretorio `.planning/`. Voce pode rodar ambos os frameworks lado a lado enquanto avalia o BuildPact. Remova os arquivos do GSD quando estiver confiante na migracao.
