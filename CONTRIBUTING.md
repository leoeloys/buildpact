# Contributing to BuildPact

> **PT-BR:** Veja a seção em português abaixo / **EN:** English instructions follow

---

## English

Thank you for your interest in contributing to BuildPact — the Universal Spec-Driven Development Framework!

### Getting Started

**Step 1 — Fork & Clone**
```bash
git clone https://github.com/<your-username>/buildpact.git
cd buildpact
npm install
```

**Step 2 — Set up your environment**
- Node.js ≥ 20.x (22.x LTS recommended)
- Git ≥ 2.x
- Run `npm run typecheck` and `npm test` to confirm a clean baseline

**Step 3 — Pick an issue**
- Browse issues labelled `good-first-issue` — they have clear scope, are estimated at < 2 hours, and include a mentor
- Comment on the issue to claim it before starting work
- Ask questions in the issue thread — mentors respond within 48 hours

**Step 4 — Create a branch**
```bash
git checkout -b feat/short-description
```
Use conventional-commit style prefixes: `feat/`, `fix/`, `docs/`, `chore/`.

**Step 5 — Implement your change**
- Follow the layered architecture: `contracts` ← `foundation` ← `engine` ← `commands` ← `cli`
- All imports use ESM `.js` extensions: `import { ok } from '../contracts/errors.js'`
- All fallible functions return `Result<T, CliError>` — never `throw`
- All user-facing strings use `I18nResolver.t()` with keys in `locales/en.yaml` AND `locales/pt-br.yaml`
- Add unit tests — keep coverage green

**Step 6 — Quality checks**
```bash
npm run typecheck   # must pass with zero errors
npm test            # must pass with zero failures
```

**Step 7 — Commit with conventional commits**
```bash
git commit -m "feat(specify): add clarification flow for ambiguous specs"
```

**Step 8 — Open a Pull Request**
- Fill in the PR template completely
- Every user-facing string must include both EN and PT-BR keys (see PR template checklist)
- A maintainer will review within 5 business days

### Code Style

- Named exports only — no `export default`
- `ok()` / `err()` helpers — never raw `{ ok: true, value }` objects
- `ERROR_CODES.*` constants in `src/contracts/errors.ts` — add new codes there
- Audit logging first — log intent before writing files
- Tests use Vitest 4.x, factory functions, `mkdtemp` for temp dirs

### Community Standards

- Be respectful and constructive
- All contributions are welcome: code, docs, translations, bug reports
- See our [Code of Conduct](CODE_OF_CONDUCT.md) (coming soon)

---

## Português (PT-BR)

Obrigado pelo seu interesse em contribuir com o BuildPact — o Framework Universal de Desenvolvimento Orientado a Spec!

### Como Começar

**Passo 1 — Fork & Clone**
```bash
git clone https://github.com/<seu-usuario>/buildpact.git
cd buildpact
npm install
```

**Passo 2 — Configure seu ambiente**
- Node.js ≥ 20.x (22.x LTS recomendado)
- Git ≥ 2.x
- Execute `npm run typecheck` e `npm test` para confirmar uma base limpa

**Passo 3 — Escolha uma issue**
- Navegue pelas issues com a label `good-first-issue` — têm escopo claro, estimativa < 2 horas e incluem um mentor
- Comente na issue para reservá-la antes de começar
- Faça perguntas no fio da issue — mentores respondem em até 48 horas

**Passo 4 — Crie um branch**
```bash
git checkout -b feat/descricao-curta
```
Use prefixos no estilo conventional-commit: `feat/`, `fix/`, `docs/`, `chore/`.

**Passo 5 — Implemente sua mudança**
- Siga a arquitetura em camadas: `contracts` ← `foundation` ← `engine` ← `commands` ← `cli`
- Todos os imports usam extensões ESM `.js`: `import { ok } from '../contracts/errors.js'`
- Todas as funções falíveis retornam `Result<T, CliError>` — nunca `throw`
- Todas as strings visíveis ao usuário usam `I18nResolver.t()` com chaves em `locales/en.yaml` E `locales/pt-br.yaml`
- Adicione testes unitários — mantenha a cobertura no verde

**Passo 6 — Verificações de qualidade**
```bash
npm run typecheck   # deve passar com zero erros
npm test            # deve passar com zero falhas
```

**Passo 7 — Commit com conventional commits**
```bash
git commit -m "feat(specify): adicionar fluxo de clarificação para specs ambíguas"
```

**Passo 8 — Abra um Pull Request**
- Preencha completamente o template do PR
- Toda string visível ao usuário deve incluir chaves em EN e PT-BR (veja o checklist do template)
- Um mantenedor revisará em até 5 dias úteis

### Estilo de Código

- Somente named exports — sem `export default`
- Helpers `ok()` / `err()` — nunca objetos brutos `{ ok: true, value }`
- Constantes `ERROR_CODES.*` em `src/contracts/errors.ts` — adicione novos códigos lá
- Audit logging primeiro — registre a intenção antes de escrever arquivos
- Testes usam Vitest 4.x, factory functions, `mkdtemp` para diretórios temporários

### Padrões da Comunidade

- Seja respeitoso e construtivo
- Todas as contribuições são bem-vindas: código, documentação, traduções, relatórios de bugs
- Veja nosso [Código de Conduta](CODE_OF_CONDUCT.md) (em breve)
