# Guias de Migracao

O BuildPact se baseia em ideias de diversos frameworks de desenvolvimento com IA. Se voce vem do BMAD, GSD ou SpecKit, estes guias mapeiam o seu conhecimento atual para os equivalentes no BuildPact, para que voce ganhe produtividade rapidamente.

## Qual Guia e Para Voce?

| Vindo de | Guia | O que muda |
|---|---|---|
| **BMAD** | [Migrando do BMAD](./from-bmad) | Agents viram membros do squad com Voice DNA; workflows viram fases do pipeline; `_bmad-output/` vira `.buildpact/` |
| **GSD** | [Migrando do GSD](./from-gsd) | `.planning/` vira `.buildpact/`; fases mapeiam para o pipeline; executor vira `execute` com isolamento de subagents |
| **SpecKit** | [Migrando do SpecKit](./from-speckit) | `.cursorrules` vira constitution; templates viram command templates; regras viram principios aplicaveis |

## Comparacao Rapida entre Frameworks

| Capacidade | BMAD | GSD | SpecKit | BuildPact |
|---|---|---|---|---|
| Personas de agentes | Prompts genericos por papel | Sem agentes | Sem agentes | Anatomia de 6 camadas com Voice DNA |
| Fases do pipeline | Workflows manuais | Research, plan, execute | N/A | specify, plan, execute, verify |
| Execucao paralela | Nao | Por fase | Nao | Paralelismo por waves de tarefas |
| Controle de custo | Nao | Nao | Nao | Budget guards com projecao de custo |
| Aplicacao de regras | Nao | Nao | Arquivos de regras (por IDE) | Constitution versionada, agnostica de IDE, auditavel |
| Suporte multi-dominio | Apenas software | Apenas software | Apenas software | Software, marketing, saude, pesquisa |
| Bilingue | Nao | Nao | Nao | Ingles + Portugues (BR) |
| Hub comunitario | Nao | Nao | Nao | Compartilhamento e descoberta de squads |

## Passos Gerais de Migracao

Independente do framework de origem, a migracao segue o mesmo roteiro:

### 1. Instalar o BuildPact

```bash
npm install -g buildpact
```

### 2. Executar o Comando Adopt

```bash
cd seu-projeto
buildpact adopt
```

O comando `adopt` escaneia seu projeto em busca de artefatos de frameworks existentes (configs do BMAD, diretorios de planejamento do GSD, regras do SpecKit), detecta sua configuracao de IDE e gera um diretorio `.buildpact/` com configuracoes pre-preenchidas. Seus arquivos existentes sao preservados -- nada e deletado.

### 3. Revisar a Configuracao Gerada

```bash
cat .buildpact/config.yaml
cat .buildpact/constitution.md
```

Verifique se idioma, dominio e preferencias de squad estao corretos. Edite conforme necessario.

### 4. Executar o Doctor para Verificar

```bash
buildpact doctor
```

Isso confirma que sua configuracao esta completa e relata qualquer item faltante.

### 5. Testar com uma Tarefa Rapida

```bash
buildpact quick "descreva uma pequena mudanca relevante ao seu projeto"
```

Se isso completar com sucesso, sua migracao esta feita.

## Estimativa de Tempo

Cada migracao leva **menos de 30 minutos** para um projeto tipico. O comando `buildpact adopt` faz a maior parte do trabalho automaticamente -- o tempo restante e gasto revisando a configuracao e executando uma tarefa de teste.

## O que Acontece com Seus Arquivos Antigos?

O BuildPact nao deleta nem modifica seus arquivos de frameworks anteriores. Seus arquivos `_bmad-output/`, `.planning/` ou `.cursorrules` permanecem intocados. Voce pode remove-los quando estiver confiante de que a migracao esta completa.

## Precisa de Ajuda?

- [FAQ](/pt-br/faq) -- perguntas frequentes sobre o BuildPact
- [Referencia CLI](/pt-br/cli/) -- todos os comandos disponiveis
- [Arquitetura](/pt-br/architecture/overview) -- como o BuildPact e estruturado
