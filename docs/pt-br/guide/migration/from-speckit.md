# Migrando do SpecKit

O SpecKit oferece arquivos de regras especificos de IDE e templates de projeto para desenvolvimento assistido por IA. O BuildPact leva a ideia de regras codificadas adiante com uma constitution agnostica de IDE, um pipeline completo de execucao e squads de agents com consciencia de dominio.

Este guia mapeia os conceitos do SpecKit para equivalentes no BuildPact e conduz voce por uma migracao completa.

## Por que Migrar?

O SpecKit oferece `.cursorrules` e arquivos de template que moldam o comportamento da IA na sua IDE. O BuildPact mantem o principio de regras codificadas e adiciona:

- **Constitution agnostica de IDE** que funciona com Claude Code, Cursor, Gemini CLI e Codex
- **Aplicacao em tempo de execucao**, nao apenas como sugestoes para a IDE
- **Pipeline completo** (specify, plan, execute, verify) em vez de prompts avulsos de IA
- **Personas de agents** com expertise de dominio e comportamento estruturado
- **Budget guards** que impedem custos descontrolados com IA
- **Trilha de auditoria** com rastreabilidade para cada decisao da IA
- **Versionamento de constitution** com rastreamento de mudancas ao longo do tempo
- **Suporte multi-dominio** alem de software

## Mapeamento de Conceitos

| Conceito SpecKit | Equivalente BuildPact | O que Muda |
|---|---|---|
| `.cursorrules` | `.buildpact/constitution.md` | Agnostico de IDE; aplicado em tempo de execucao; versionado com rastreamento de mudancas |
| Templates do SpecKit | Command templates (`templates/commands/`) | Templates direcionam fases do pipeline, nao apenas completacao da IDE |
| Regras / convencoes do SpecKit | Principios da constitution | Versionados, aplicados, auditaveis; nao sao dicas passivas da IDE |
| Setup de projeto do SpecKit | `buildpact init` ou `buildpact adopt` | Wizard interativo com selecao de squad, configuracao de dominio, preferencia de idioma |
| *(sem equivalente)* | Squads de agents | Agents nomeados com anatomia de 6 camadas, Voice DNA e niveis de autonomia |
| *(sem equivalente)* | Fases do pipeline | specify, plan, execute, verify -- workflow estruturado em vez de prompts avulsos |
| *(sem equivalente)* | Budget guards | Rastreamento de custo e limites de gasto por tarefa e sessao |
| *(sem equivalente)* | Trilha de auditoria | Log completo de decisoes da IA, checagens de constitution e resultados de tarefas |

## Passo a Passo da Migracao

### 1. Instalar o BuildPact

```bash
npm install -g buildpact
```

### 2. Executar o Adopt no Seu Projeto

```bash
cd seu-projeto-speckit
buildpact adopt
```

O comando `adopt` detecta sua configuracao SpecKit:

- Encontra `.cursorrules` e extrai regras como principios da constitution
- Identifica arquivos de template e os mapeia para command templates do BuildPact
- Detecta sua IDE (Cursor, VS Code, etc.) e configura conforme necessario
- Solicita suas preferencias de idioma, dominio e squad
- Gera `.buildpact/` com configuracao pre-preenchida

### 3. Revisar Sua Constitution

```bash
cat .buildpact/constitution.md
```

O comando adopt converte suas regras do SpecKit em principios da constitution. Revise com cuidado:

- Regras do SpecKit se tornam secoes da constitution
- Sugestoes passivas se tornam principios aplicaveis
- Instrucoes especificas de IDE sao separadas em arquivos de configuracao de IDE

A constitution e verificada em cada fase do pipeline. Se uma regra importa, ela pertence aqui.

### 4. Revisar Sua Configuracao

```bash
cat .buildpact/config.yaml
```

Verifique que:

- `language` corresponde a sua preferencia
- `domain` esta definido corretamente
- `ide` reflete sua ferramenta atual
- `budget` tem limites configurados (SpecKit nao tem equivalente)

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

Estas funcionalidades nao possuem equivalente no SpecKit:

- **Pipeline completo**: Em vez de prompts avulsos de IA moldados por regras, o BuildPact oferece um pipeline estruturado: especifique requisitos, gere um plano, execute tarefas e verifique resultados.
- **Personas de agents**: Agents nomeados com expertise de dominio. O squad de software inclui Sofia (PM), Renzo (Architect), Coda (Developer), Crivo (QA) e Lira (Tech Writer).
- **Budget guards**: Defina limites de gasto por tarefa ou sessao. O SpecKit nao tem consciencia de custo.
- **Execucao por waves**: Tarefas independentes rodam em paralelo, reduzindo o tempo de execucao.
- **Aplicacao de constitution**: Regras sao verificadas programaticamente em cada fase, nao apenas apresentadas a IDE como contexto.
- **Versionamento de constitution**: Acompanhe como as regras do seu projeto evoluem ao longo do tempo com historico completo de mudancas.
- **Tiers de memoria**: Feedback de sessao, padroes aprendidos e decisoes persistem entre sessoes.
- **Suporte multi-dominio**: Squads de marketing, saude e pesquisa alem de software.
- **Hub comunitario**: Compartilhe e descubra squads criados por outros times.

## Diferencas Conhecidas

Esteja ciente destas diferencas de comportamento:

- **Nao e especifico de IDE**: A constitution do BuildPact e agnostica de IDE. Se voce dependia de funcionalidades especificas do Cursor no `.cursorrules`, esses comportamentos especificos de IDE nao serao transferidos. O BuildPact gera arquivos de configuracao de IDE separados durante o setup.
- **Regras sao aplicadas, nao sugeridas**: No SpecKit, regras orientam a IA mas nao bloqueiam a execucao. No BuildPact, violacoes da constitution podem interromper o pipeline. Isso e mais restritivo por design.
- **Mais estrutura, mais arquivos**: O SpecKit e leve -- alguns arquivos de regras e templates. O BuildPact cria um diretorio `.buildpact/` com config, constitution, saidas, logs de auditoria e memoria. A contrapartida e rastreabilidade e reprodutibilidade.
- **Curva de aprendizado**: O SpecKit e simples de aprender em minutos. O pipeline do BuildPact tem mais conceitos para entender. Comece com `buildpact quick` para tarefas simples e adote o pipeline completo gradualmente.

## Seus Arquivos SpecKit Estao Seguros

O BuildPact nao deleta nem modifica seus arquivos `.cursorrules` ou de template. Voce pode continuar usando o SpecKit junto com o BuildPact enquanto avalia a migracao. Remova os arquivos do SpecKit quando estiver confiante na troca.
