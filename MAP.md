# 🧠 buildpact — Cérebro do Projeto

> Portal de navegação do projeto. Qualquer agente, qualquer momento, acessa o mesmo conteúdo.
> Auto-generated. Updated: 2026-04-03T23:13:49

## 🚀 Comece Aqui

| O que fazer | Comando |
|------------|---------|
| Criar uma especificação | `buildpact specify` ou `/bp:specify` |
| Planejar execução | `buildpact plan` ou `/bp:plan` |
| Executar plano | `buildpact execute` ou `/bp:execute` |
| Verificar resultado | `buildpact verify` ou `/bp:verify` |
| Mapear diretórios | `buildpact map` |
| Saúde do projeto | `buildpact doctor` |

## 📜 Princípios (Constitution)

- Primary language(s): TypeScript
- No linter detected — consider adding one
- Spec before code — no implementation begins without a reviewed specification
- Atomic commits — one commit per completed task
- Package manager: npm (package.json)
- No circular dependencies between modules

> Arquivo completo: `.buildpact/constitution.md`

## 🗂️ Artefatos-Chave

| Artefato | Caminho | Descrição |
|----------|---------|-----------|
| Constitution | `.buildpact/constitution.md` | Regras imutáveis do projeto |
| Configuração | `.buildpact/config.yaml` | Idioma, domínio, IDE, perfil |
| Ledger | `.buildpact/LEDGER.md` | Linha do tempo de todos os eventos |
| Decisões | `DECISIONS.md` | Log append-only de decisões |
| Status | `STATUS.md` | Estado atual do projeto |

---

## 📂 Estrutura do Projeto
| Name | Type | Description | Modified |
|------|------|-------------|----------|
| 📁 action/ | dir | GitHub Action for CI/CD pipeline integration (6 items) | 2026-04-03 |
| 📁 docs/ | dir | Documentation site (VitePress) — English + Português (5 items) | 2026-04-03 |
| 📁 locales/ | dir | Internationalization message files (en, pt-br) (2 items) | 2026-04-03 |
| 📁 scripts/ | dir | Build, release, and installation scripts (3 items) | 2026-04-03 |
| 📁 src/ | dir | TypeScript source code — CLI, engine, commands, contracts, foundation (9 items) | 2026-04-03 |
| 📁 templates/ | dir | IDE-specific prompt templates for squad agents (11 items) | 2026-04-03 |
| 📁 test/ | dir | Test suite — unit, integration, e2e, fixtures, snapshots (5 items) | 2026-04-03 |
| 📄 action.yml | file | GitHub Action manifest for CI/CD pipeline integration | 2026-03-24 |
| 📄 CHANGELOG.md | file | Release history and version changelog | 2026-03-24 |
| 📄 CLAUDE.md | file | Claude Code harness entry point — links to constitution | 2026-04-03 |
| 📄 CONTRIBUTING.md | file | Contributor guide — how to develop and submit changes | 2026-03-24 |
| 📄 DECISIONS.md | file | Append-only log of significant project decisions | 2026-04-03 |
| 📄 LICENSE | file | MIT License | 2026-03-24 |
| 📄 package-lock.json | file | Locked dependency tree for reproducible installs | 2026-03-24 |
| 📄 package.json | file | npm package manifest — dependencies, scripts, metadata | 2026-04-02 |
| 📄 README.md | file | Project overview, installation, and usage guide | 2026-04-03 |
| 📄 STATUS.md | file | Living document of current project state | 2026-04-03 |
| 📄 tsconfig.json | file | TypeScript compiler configuration | 2026-03-15 |
| 📄 tsdown.config.ts | file | Build tool configuration (tsdown bundler) | 2026-04-03 |
| 📄 vitest.config.ts | file | Test runner configuration (Vitest) | 2026-03-15 |
