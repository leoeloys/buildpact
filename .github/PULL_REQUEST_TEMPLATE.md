## Description / Descrição

<!-- EN: Briefly describe the change and its motivation. -->
<!-- PT-BR: Descreva brevemente a mudança e sua motivação. -->

Fixes # (issue)

---

## Type of Change / Tipo de Mudança

- [ ] Bug fix / Correção de bug
- [ ] New feature / Nova funcionalidade
- [ ] Documentation / Documentação
- [ ] Refactoring / Refatoração
- [ ] Other / Outro: ___

---

## Checklist

### Code Quality / Qualidade de Código

- [ ] `npm run typecheck` passes with zero errors / passa com zero erros
- [ ] `npm test` passes with zero failures / passa com zero falhas
- [ ] No new `any` types introduced / Nenhum novo tipo `any` introduzido
- [ ] All fallible functions return `Result<T, CliError>` (no `throw`) / Todas as funções falíveis retornam `Result<T, CliError>` (sem `throw`)

### Bilingual i18n Strings / Strings Bilíngues i18n

> **REQUIRED for any user-facing text / OBRIGATÓRIO para qualquer texto visível ao usuário**

- [ ] All new user-facing strings have a key in `locales/en.yaml`
- [ ] All new user-facing strings have the **same key** in `locales/pt-br.yaml`
- [ ] No hardcoded English or Portuguese text passed directly to clack prompts
- [ ] `I18nResolver.t('key')` used for every user-facing string

### Architecture / Arquitetura

- [ ] Layer dependency order respected: `contracts` ← `foundation` ← `engine` ← `commands` ← `cli`
- [ ] All imports use ESM `.js` extension
- [ ] New `ERROR_CODES` added to `src/contracts/errors.ts` (not inline strings)
- [ ] Named exports only — no `export default`

### Tests / Testes

- [ ] Unit tests added for all new pure functions
- [ ] Handler integration tests added for new CLI flows
- [ ] Tests use factory functions and `mkdtemp` for temp dirs
- [ ] No global state or hardcoded paths in tests

### Documentation / Documentação

- [ ] Relevant CLAUDE.md updated if reusable patterns were discovered
- [ ] ADR created in `docs/decisions/` if a significant architectural decision was made

---

## Test Plan / Plano de Testes

<!-- List the test commands you ran and what you verified manually -->
<!-- Liste os comandos de teste que executou e o que verificou manualmente -->

```bash
npm run typecheck
npm test
```

---

## Screenshots (if applicable) / Capturas de Tela (se aplicável)

<!-- Add screenshots for any TUI/UI changes -->
<!-- Adicione capturas de tela para mudanças de TUI/UI -->
