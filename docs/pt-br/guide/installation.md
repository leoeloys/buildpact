# Instalação

## Requisitos

- **Node.js** 20 ou superior (22+ recomendado)
- **Git** instalado e disponível no PATH
- Uma ferramenta de IA para código: Claude Code, Cursor, Gemini CLI ou Codex

## Instalar o BuildPact

```bash
curl -fsSL https://raw.githubusercontent.com/leoeloys/buildpact/main/scripts/install.sh | bash
```

Só isso. Verifique com `buildpact --version`.

**Alternativa via npm:**

```bash
npm install -g github:leoeloys/buildpact
```

## Projeto Novo (Greenfield)

Use `buildpact init` para começar do zero:

```bash
# Inicializar no diretório atual
cd meu-novo-projeto
buildpact init

# Ou criar um novo diretório
buildpact init meu-novo-projeto
```

O wizard interativo conduz você por 6 passos:

| Passo | O que pergunta | O que faz |
|-------|---------------|-----------|
| 1. Idioma | Português (Brasil) ou English | Define o idioma de todas as mensagens da CLI |
| 2. Local | Aqui ou nova pasta | Decide onde o `.buildpact/` será criado |
| 3. Domínio | Software, Marketing, Saúde, Pesquisa, Gestão, Personalizado | Configura regras específicas do domínio |
| 4. IDE | Claude Code, Cursor, Gemini, Codex (seleção múltipla) | Instala slash commands e arquivos de configuração |
| 5. Experiência | Iniciante, Intermediário, Especialista | Controla o nível de orientação da CLI |
| 6. Squad | Instalar o Squad de Software? | Adiciona uma equipe multi-agente |

Após a inicialização:

```
meu-projeto/
  .buildpact/
    config.yaml          # Suas configurações
    constitution.md      # Regras do projeto (edite!)
    project-context.md   # Contexto para os agentes IA
    profiles/            # Perfis de custo/qualidade dos modelos
    squads/software/     # Sua equipe de agentes (se instalada)
    audit/               # Logs de ações
  .claude/commands/bp/   # Slash commands (se Claude Code selecionado)
```

**Próximo passo:** Execute `buildpact specify` para criar sua primeira spec.

## Projeto Existente (Brownfield)

Use `buildpact adopt` quando você já tem um projeto em andamento:

```bash
cd meu-projeto-existente
buildpact adopt
```

O comando adopt **primeiro escaneia seu projeto** e pré-preenche a configuração:

| O que detecta | Como usa |
|--------------|---------|
| `package.json`, `Cargo.toml`, `go.mod` | Identifica linguagem e gerenciador de pacotes |
| `tsconfig.json` | Adiciona "TypeScript strict mode" à constituição |
| `.eslintrc`, `biome.json`, `.prettierrc` | Adiciona regras de linter à constituição |
| `.github/workflows/` | Adiciona quality gates de CI à constituição |
| Histórico Git | Exibe contagem de commits e contribuidores |

A `constitution.md` gerada já contém regras extraídas dos seus linters e CI — revise e ajuste conforme necessário.

**Próximo passo:** Execute `buildpact doctor` para verificar o setup.

## O Que Commitar no Git

**Sempre commite:**
- `.buildpact/config.yaml`, `constitution.md`, `project-context.md`
- `.buildpact/profiles/`, `.buildpact/squads/`
- `.claude/commands/bp/`

**Não commite:**
- `.buildpact/audit/` — logs locais de ações
- `.buildpact/memory/` — memória local dos agentes
