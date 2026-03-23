# Referência CLI

Todos os comandos BuildPact disponíveis via `buildpact <comando>`.

## Pipeline Principal

| Comando | Descrição |
|---------|----------|
| [`quick`](/pt-br/cli/quick) | Tudo-em-um: descrição direto para código commitado |
| [`specify`](/pt-br/cli/specify) | Captura um requisito como spec estruturada |
| [`plan`](/pt-br/cli/plan) | Gera um plano de implementação baseado em ondas |
| [`execute`](/pt-br/cli/execute) | Executa o plano com isolamento de subagentes |
| [`verify`](/pt-br/cli/verify) | Teste de aceite guiado |
| [`orchestrate`](/pt-br/cli/orchestrate) | Conheça o Pacto, seu orquestrador de projeto |

## Configuração e Manutenção

| Comando | Descrição |
|---------|----------|
| [`init`](/pt-br/cli/init) | Inicializa um novo projeto |
| [`adopt`](/pt-br/cli/adopt) | Adota um projeto existente |
| [`doctor`](/pt-br/cli/doctor) | Check-up — verifica Node.js, Git, configs e squads |
| [`upgrade`](/pt-br/cli/upgrade) | Migra o projeto para a versão atual do schema da CLI |
| [`constitution`](/pt-br/cli/constitution) | Cria ou edita as regras do projeto |

## Squads e Agentes

| Comando | Descrição |
|---------|----------|
| [`squad`](/pt-br/cli/squad) | Cria, valida e instala squads |

## Avançado

| Comando | Descrição |
|---------|----------|
| [`memory`](/pt-br/cli/memory) | Gerencia as camadas de memória dos agentes |
| [`status`](/pt-br/cli/status) | Dashboard do pipeline e status do projeto |
| [`export-web`](/pt-br/cli/export-web) | Exporta como bundle web para Claude.ai / ChatGPT / Gemini |
| [`optimize`](/pt-br/cli/optimize) | Melhoria contínua com git ratchet |
| [`quality`](/pt-br/cli/quality) | Relatório de qualidade inspirado na ISO 9001 |
| [`docs`](/pt-br/cli/docs) | Organiza e indexa a documentação do projeto |
| [`investigate`](/pt-br/cli/investigate) | Pesquisa domínio, codebase ou tecnologia |
| [`audit`](/pt-br/cli/audit) | Exporta e inspeciona trilhas de auditoria |
| [`diff`](/pt-br/cli/diff) | Rastreia mudanças entre execuções do pipeline |
| [`completion`](/pt-br/cli/completion) | Autocompletar para bash/zsh/fish |
| [`help`](/pt-br/cli/help) | Mostra comandos disponíveis e status do projeto |

## Slash Commands (Integração com IDE)

Ao selecionar Claude Code durante o init, o BuildPact instala slash commands em `.claude/commands/bp/`:

| Slash Command | Equivale a |
|--------------|-----------|
| `/bp:quick` | `buildpact quick` |
| `/bp:specify` | `buildpact specify` |
| `/bp:plan` | `buildpact plan` |
| `/bp:execute` | `buildpact execute` |
| `/bp:verify` | `buildpact verify` |
| `/bp:orchestrate` | Orquestrador do projeto |
| `/bp:doctor` | `buildpact doctor` |
| `/bp:help` | Status do projeto e próximos passos |
