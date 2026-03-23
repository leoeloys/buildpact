# Migrando do BMAD

O BuildPact evoluiu a partir das ideias do BMAD. Se voce ja usa os workflows de agents do BMAD, vai achar o BuildPact familiar -- mas com adicoes significativas como budget guards, execucao paralela por waves, aplicacao de constitution e suporte multi-dominio.

Este guia mapeia cada conceito do BMAD para seu equivalente no BuildPact e conduz voce por uma migracao completa.

## Por que Migrar?

O BMAD oferece workflows baseados em agents para desenvolvimento de software. O BuildPact mantem essa base e adiciona:

- **Agents estruturados** com anatomia de 6 camadas e Voice DNA (nao apenas prompts de papel)
- **Budget guards** que impedem custos descontrolados com IA
- **Execucao por waves** que roda tarefas independentes em paralelo
- **Aplicacao de constitution** verificada em cada fase do pipeline
- **Model profiles** que direcionam tarefas para modelos de IA com custo apropriado
- **Trilha de auditoria** com rastreabilidade completa de cada decisao da IA
- **Suporte multi-dominio** alem de software (marketing, saude, pesquisa)
- **CLI bilingue** com suporte nativo em ingles e portugues (BR)

## Mapeamento de Conceitos

### Agents

| Agent BMAD | Agent BuildPact | O que Muda |
|---|---|---|
| `pm` | **Sofia** (Product Manager) | Personalidade Voice DNA, nivelamento de autonomia, formato de saida estruturado |
| `architect` | **Renzo** (Architect) | Geracao de plano por waves, validacao multi-perspectiva (Nyquist) |
| `dev` | **Coda** (Developer) | Isolamento de subagent, commits git atomicos, recuperacao de falhas |
| `qa` | **Crivo** (QA Engineer) | Verificacao goal-backward, checagem de conformidade com a constitution |
| `tech-writer` | **Lira** (Tech Writer) | Geracao de documentacao integrada ao pipeline |

Os agents do BuildPact possuem uma anatomia de 6 camadas: papel, expertise, Voice DNA, ferramentas, restricoes e nivel de autonomia. Os agents do BMAD sao definidos por um unico arquivo de prompt. A estrutura mais rica faz com que os agents do BuildPact produzam saidas mais consistentes e possam ser ajustados para o seu projeto.

### Workflows

| Workflow BMAD | Comando BuildPact | O que Muda |
|---|---|---|
| `create-prd` | `buildpact specify` | Captura em linguagem natural com deteccao de ambiguidade; produz uma spec estruturada, nao um documento PRD |
| `create-architecture` | `buildpact plan` | Gera tarefas organizadas em waves com grupos paralelos; inclui fase de pesquisa automatizada |
| `create-epics` | `buildpact plan` (saida) | Planos produzem waves e tarefas, nao epicos tradicionais; cada tarefa e executavel independentemente |
| `dev-story` | `buildpact execute` | Isolamento de subagent por tarefa; budget guards; commits git atomicos; recuperacao de falhas com retry |
| `code-review` | `buildpact verify` | Verificacao goal-backward checa resultados contra a spec original, nao apenas qualidade de codigo |
| `party-mode` | `buildpact orchestrate` | Deliberacao estruturada em conclave com protocolo de consenso; nao e chat multi-agent livre |

### Artefatos e Configuracao

| BMAD | BuildPact | Notas |
|---|---|---|
| `_bmad-output/` | `.buildpact/` | Subdiretorios estruturados: `output/`, `audit/`, `memory/`, `config.yaml` |
| `config.yaml` (raiz do projeto) | `.buildpact/config.yaml` | Inclui model profiles, limites de budget, configuracao de squad, preferencia de idioma |
| `.cursorrules` | `.buildpact/constitution.md` | Agnostico de IDE; aplicado em tempo de execucao; versionado com rastreamento de mudancas |
| Arquivos de prompt dos agents | Squad YAML + agent markdown | Agents definidos em `templates/squads/{dominio}/agents/` com anatomia estruturada |

## Passo a Passo da Migracao

### 1. Instalar o BuildPact

```bash
npm install -g buildpact
```

### 2. Executar o Adopt no Seu Projeto

```bash
cd seu-projeto-bmad
buildpact adopt
```

O comando `adopt` detecta sua configuracao BMAD automaticamente:

- Encontra `_bmad-output/` e le os artefatos existentes
- Detecta seu `config.yaml` e mapeia as configuracoes para o formato BuildPact
- Identifica `.cursorrules` e converte regras em principios da constitution
- Solicita suas preferencias de idioma, dominio e IDE
- Gera `.buildpact/` com configuracao pre-preenchida

### 3. Revisar Sua Configuracao

```bash
cat .buildpact/config.yaml
```

Verifique que:

- `language` corresponde a sua preferencia (`en` ou `pt-br`)
- `domain` esta definido corretamente (provavelmente `software`)
- `squad` referencia o template de squad correto
- `budget` tem limites definidos (BMAD nao tem equivalente -- defina agora)

### 4. Revisar a Constitution

```bash
cat .buildpact/constitution.md
```

Se voce tinha `.cursorrules`, o comando adopt converteu suas regras em principios da constitution. Revise e ajuste conforme necessario. A constitution e aplicada em cada fase do pipeline -- e mais do que um arquivo de sugestoes.

### 5. Executar o Doctor

```bash
buildpact doctor
```

Corrija quaisquer problemas reportados.

### 6. Testar com uma Tarefa Rapida

```bash
buildpact quick "adicionar um endpoint de health check"
```

Se isso completar com sucesso, sua migracao esta feita.

## Novidades do BuildPact

Estas funcionalidades nao possuem equivalente no BMAD:

- **Budget guards**: Defina limites de gasto por tarefa, plano ou sessao. O BuildPact rastreia o uso de tokens e para a execucao antes de exceder seu orcamento.
- **Execucao por waves**: Tarefas independentes rodam em paralelo dentro de waves, reduzindo o tempo total de execucao.
- **Model profiles**: Direcione tarefas simples para modelos rapidos e tarefas complexas para modelos mais capazes. O BMAD envia tudo para o mesmo modelo.
- **Tiers de memoria**: Feedback de sessao, padroes aprendidos e registro de decisoes persistem entre sessoes.
- **Hub comunitario**: Compartilhe e descubra squads criados por outros times.
- **Versionamento de constitution**: Acompanhe mudancas nas regras do seu projeto ao longo do tempo com trilha de auditoria completa.

## Diferencas Conhecidas

Esteja ciente destas diferencas de comportamento:

- **Sem documento PRD**: A fase `specify` do BuildPact produz uma spec estruturada, nao um PRD tradicional. A spec e projetada para consumo por maquinas, nao para revisao de stakeholders.
- **Sem estrutura de epicos**: Planos produzem waves e tarefas em vez de epicos e stories. A estrutura de waves otimiza para execucao paralela.
- **Nomes de agents sao fixos por squad**: O squad de software sempre usa Sofia, Renzo, Coda, Crivo e Lira. Voce personaliza o comportamento deles pela constitution e configuracao do squad, nao renomeando-os.
- **Local dos artefatos**: Artefatos vao para `.buildpact/` em vez de `_bmad-output/`. Se outras ferramentas dependem de `_bmad-output/`, voce precisara atualizar essas referencias.

## Seus Arquivos BMAD Estao Seguros

O BuildPact nao toca no seu diretorio `_bmad-output/` nem no seu `config.yaml` existente. Voce pode rodar ambos os frameworks lado a lado enquanto avalia o BuildPact. Remova os arquivos do BMAD quando estiver confiante na migracao.
