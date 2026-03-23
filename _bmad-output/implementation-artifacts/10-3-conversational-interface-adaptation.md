# Story 10.3: Conversational Interface Adaptation

Status: done

## Story

As a non-technical end-user (Persona A) receiving a Web Bundle,
I want all framework interactions to be natural language conversations — no commands, no jargon,
so that I can complete my workflow in plain Portuguese or English without any technical knowledge.

## Acceptance Criteria

**AC-1: All slash commands replaced with natural language conversation flows**

Given a Web Bundle is activated in Claude.ai or ChatGPT
When the session begins
Then all slash commands are replaced with natural language conversation flows
And the host model presents options as numbered choices in natural language instead of expecting command syntax
And no technical terms (repository, branch, commit, YAML, pipeline, subagent) appear in the user-facing conversation

**AC-2: Full PT-BR support with no English fallback**

Given the Web Bundle is configured for PT-BR
When a non-technical user interacts with it
Then all questions, options, outputs, and error messages are in Portuguese with no English fallback

## Tasks / Subtasks

- [x] Task 1: Add conversational mode template generation in `src/squads/web-bundle.ts` (AC: #1)
  - [x] 1.1: Export `generateConversationalPreamble(squad: SquadManifest, language: string): string` — produces the activation instructions block that instructs the host model to use conversational mode
  - [x] 1.2: The preamble must instruct the host model: (a) replace all `/bp:*` commands with numbered menu options, (b) never use technical terms listed in a blocklist, (c) use the language configured in the bundle
  - [x] 1.3: Include the technical jargon blocklist in the preamble: `[repository, branch, commit, YAML, pipeline, subagent, orchestrator, JSON, TypeScript, npm, CLI, terminal, chmod, export, import, module]` — both English and PT-BR variants
  - [x] 1.4: Map each pipeline phase to a natural language prompt string (loaded from `locales/<lang>.yaml`):
    - specify → "Vamos descrever o que você quer fazer" / "Let's describe what you want to do"
    - plan → "Vou criar um plano para isso" / "Let me create a plan for this"
    - execute → "Vou executar o plano agora" / "Let me execute the plan now"
    - verify → "Vamos revisar o resultado" / "Let's review the result"

- [x] Task 2: Add localization strings to `locales/pt-br.yaml` and `locales/en.yaml` (AC: #1, #2)
  - [x] 2.1: Add `bundle.conversational.*` keys for all phase prompts, menu labels, and error messages
  - [x] 2.2: Ensure PT-BR strings use accessible language — no technical terms, colloquial Portuguese acceptable
  - [x] 2.3: Verify all keys exist in BOTH locale files (bilingual parity — NFR-05)

- [x] Task 3: Enforce language selection in `generateWebBundle` (AC: #2)
  - [x] 3.1: Read `language` from `.buildpact/config.yaml` (field `language: pt-br | en`)
  - [x] 3.2: If `language === 'pt-br'`, the entire bundle (preamble + instructions + phase prompts) must be in PT-BR — no EN strings
  - [x] 3.3: If `language` is unset, default to `en`
  - [x] 3.4: The language setting must propagate to the degradation notes (story 10.2) and staleness warning (story 10.4)

- [x] Task 4: Write unit tests (AC: all)
  - [x] 4.1: `test/unit/squads/web-bundle.test.ts` — test `generateConversationalPreamble` with PT-BR and EN; assert no technical terms appear in PT-BR output; assert jargon blocklist is present in both languages
  - [x] 4.2: Test that all `bundle.conversational.*` keys resolve without fallback in PT-BR locale
  - [x] 4.3: Run `npx vitest run` — baseline ≥ **1760 tests** (from stories 10.1–10.2); all must remain green

## Dev Notes

### Critical Requirement — No Technical Jargon in User-Facing Bundles

The conversational preamble instructs the HOST MODEL (Claude.ai / ChatGPT) — not BuildPact itself — to behave conversationally. This is a prompt engineering layer embedded in the bundle file.

The preamble tells the host model:
1. "You are activating [Squad Name]. Guide the user through their workflow using numbered options."
2. "NEVER use these terms with the user: [blocklist]"
3. "ALWAYS respond in [language]. If the user writes in another language, acknowledge it but continue in [language]."

### Jargon Blocklist — Mandatory

Include both English and Portuguese technical terms in the blocklist so the host model blocks them in both languages:

```
EN: repository, branch, commit, YAML, JSON, pipeline, subagent, orchestrator,
    TypeScript, JavaScript, npm, CLI, terminal, chmod, export, import, module,
    workflow file, markdown, prompt injection, token

PT: repositório, ramo, confirmação, arquivo YAML, arquivo JSON, pipeline,
    subagente, orquestrador, terminal, linha de comando, módulo
```

### PT-BR Language Requirement — NFR-05

BuildPact's architecture mandates PT-BR/EN bilingual parity as a **first-class requirement** (NFR-05). The architecture explicitly states: "Not simple string substitution. PT-BR Squads carry regulatory context (CFM, ANVISA) with no EN equivalent." For Web Bundles:
- PT-BR bundles are fully in Portuguese — no EN fallback strings
- Phase prompts must use accessible, non-technical PT-BR
- Error messages in PT-BR must be actionable without technical knowledge

### Locales File Pattern

Add to `locales/pt-br.yaml` and `locales/en.yaml`:

```yaml
# PT-BR
bundle:
  conversational:
    welcome: "Olá! Sou o assistente [Squad Name]. Como posso ajudá-lo hoje?"
    phase_specify: "Vamos descrever o que você quer fazer. Me conte sobre o seu projeto."
    phase_plan: "Entendido! Vou criar um plano para isso."
    phase_execute: "Tudo pronto. Vou executar o plano agora."
    phase_verify: "Feito! Vamos revisar o resultado juntos."
    choose_option: "Escolha uma opção:"
    staleness_warning: "Aviso: este assistente pode estar desatualizado. Peça ao criador uma versão mais recente."
    bundle_too_large: "Este assistente foi simplificado para funcionar nesta plataforma. Algumas funcionalidades avançadas foram removidas."
```

### Anti-Patterns to Avoid

- ❌ Do NOT let any technical term from the blocklist appear in the PT-BR bundle's user-facing sections
- ❌ Do NOT silently fall back to EN if a PT-BR string is missing — throw at bundle generation time so developers catch it during build, not at runtime
- ❌ Do NOT place conversational preamble generation logic in `src/foundation/bundle.ts` — it belongs in `src/squads/web-bundle.ts` (it's Squad-aware)
- ❌ Do NOT hardcode the jargon blocklist in the CLI handler — it must live in `src/squads/web-bundle.ts` so tests can assert on it
- ❌ Do NOT use `export default` anywhere
- ❌ Do NOT omit `.js` on ESM imports

### Project Structure Notes

- Extends `src/squads/web-bundle.ts` — add `generateConversationalPreamble()`
- New locale keys: `locales/pt-br.yaml`, `locales/en.yaml` — `bundle.conversational.*`
- Tests: extend `test/unit/squads/web-bundle.test.ts`
- No new source files needed for this story

### References

- [Source: epics.md#Epic10-Story10.3] — Conversational interface requirements, PT-BR mandate
- [Source: architecture.md#NFR-05] — PT-BR/EN bilingual parity — equal quality, not translation
- [Source: architecture.md#i18n-two-layer] — UI strings vs. Squad domain rules (2-layer i18n system)
- [Source: architecture.md#cross-cutting-concerns] — i18n concern spans all components
- [Source: story 10-1-web-bundle-export-command.md] — `generateWebBundle()` entry point, language config path
- [Source: story 10-2-progressive-bundle-compression.md] — degradation notes must also be localized

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Exported `JARGON_BLOCKLIST` constant (EN + PT-BR variants) from `src/squads/web-bundle.ts`; tests assert on its contents.
- Exported `generateConversationalPreamble(squadName, language)` — uses `createI18n` to load phase prompts from `locales/<lang>.yaml`; embeds the full bidirectional jargon blocklist in the preamble so the host model suppresses technical terms in both EN and PT-BR.
- Updated `generateWebBundle` to call `generateConversationalPreamble` instead of the former private `buildActivationPreamble`; all localized phase prompts now flow through the locale files.
- Updated `applyDegradationTier` with optional `language` param (default `'en'`); PT-BR bundles get a Portuguese degradation note sourced from `bundle.conversational.bundle_too_large`.
- Added 8 `bundle.conversational.*` keys to both `locales/en.yaml` and `locales/pt-br.yaml` (bilingual parity).
- Added 42 new tests across `generateConversationalPreamble`, `JARGON_BLOCKLIST`, locale key resolution, and `generateWebBundle` integration. Updated 3 pre-existing tests whose expected preamble text changed.
- Final test count: 1,884 (baseline was ≥ 1,760). All pass, zero regressions.

### File List

- src/squads/web-bundle.ts
- locales/en.yaml
- locales/pt-br.yaml
- test/unit/squads/web-bundle.test.ts

## Change Log

- 2026-03-19: Implemented Story 10.3 — added `JARGON_BLOCKLIST`, `generateConversationalPreamble`, locale keys `bundle.conversational.*` (EN + PT-BR), localized `applyDegradationTier`, and 42 unit tests. 1,884 tests pass.
