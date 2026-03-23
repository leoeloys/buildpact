# Início Rápido

Saia do zero até sua primeira tarefa BuildPact em menos de 5 minutos.

## Pré-requisitos

- **Node.js** 20 ou superior (22+ recomendado)
- **Git** instalado e disponível no PATH
- Uma ferramenta de IA para código: Claude Code, Cursor, Gemini CLI ou Codex

## Instalar o BuildPact

```bash
npm install -g buildpact
```

## Inicializar Seu Projeto

```bash
cd meu-projeto
buildpact init
```

O wizard interativo guia você na escolha de idioma, domínio, IDE e squad. Ao finalizar, seu projeto terá um diretório `.buildpact/` com configuração, constituição e um squad instalado.

## Rodar Sua Primeira Tarefa

A forma mais rápida de experimentar o BuildPact é o comando `quick`:

```bash
buildpact quick "adicionar endpoint de health check que retorna { status: ok }"
```

O BuildPact gera uma spec mínima, implementa a mudança e faz o commit — tudo de uma vez.

## Usar o Pipeline Completo

Para trabalhos maiores, use o pipeline de 4 fases:

```bash
# 1. Descreva o que você quer
buildpact specify "autenticação de usuário com email e senha"

# 2. Gere um plano de implementação
buildpact plan

# 3. Execute o plano
buildpact execute

# 4. Verifique os resultados
buildpact verify
```

Cada fase produz artefatos auditáveis. Toda saída de IA é verificada contra a constituição do projeto. Toda tarefa ganha um commit git atômico.

## Próximos Passos

- [Detalhes de instalação](/pt-br/guide/installation) — setup para projetos novos e existentes
- [O Pipeline](/pt-br/guide/pipeline) — entenda cada fase a fundo
- [Referência CLI](/pt-br/cli/) — todos os comandos disponíveis
- [Arquitetura](/pt-br/architecture/overview) — como o BuildPact é estruturado
