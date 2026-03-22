# External Integrations

**Analysis Date:** 2026-03-22

## APIs & External Services

**AI Provider (Primary):**
- Anthropic Claude API — Dispatches all AI tasks (specify, plan, execute, verify, quick, optimize)
  - SDK/Client: `@anthropic-ai/sdk` ^0.52.0
  - Client instantiation: `src/engine/providers/anthropic.ts` → `new Anthropic({ apiKey })`
  - API surface used: `client.messages.create()` (Messages API only; no streaming, no tools)
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Fallback: `StubProvider` in `src/engine/providers/stub.ts` is used automatically when key is absent

**Community Squad Registry:**
- GitHub Raw Content — Fetches squad manifests and files from the community hub
  - Base URL: `https://raw.githubusercontent.com/buildpact/buildpact-squads/main`
  - Client: native `fetch` (Node.js built-in; injectable for testing)
  - Implementation: `src/engine/community-hub.ts`
  - Endpoints accessed:
    - `{base}/{squad-name}/manifest.json` — Squad file listing
    - `{base}/{squad-name}/{file}` — Individual squad files (YAML, Markdown)
  - Auth: None (public repository)
  - Trigger: `buildpact squad add <squad-name>` command

## Data Storage

**Databases:**
- None — no database used at any layer

**File Storage:**
- Local filesystem only
  - Project config: `.buildpact/config.yaml`
  - Constitution: `.buildpact/constitution.md`
  - Audit logs: `.buildpact/audit/*.jsonl` (JSON Lines, append-only)
  - Squad definitions: `.buildpact/squads/<name>/`
  - Squad lock: `.buildpact/squad-lock.yaml`
  - Project context: `.buildpact/project-context.md`
  - Decisions log: `DECISIONS.md` (project root)
  - Status file: `STATUS.md` (project root)
  - IDE configs: `.claude/commands/bp/`, `.cursorrules`, `.cursor/rules/`, `.gemini/`, `.codex/`

**Caching:**
- None — no in-memory or persistent caching layer

## Authentication & Identity

**Auth Provider:**
- None — no user authentication system
- The only credential is `ANTHROPIC_API_KEY` for the AI provider (env var, not managed by BuildPact)

## AI Model Catalog

**Supported Claude Models** (hardcoded in `src/engine/model-profile-manager.ts`):
- `claude-opus-4-6` — Quality/research operations ($0.075/1k output tokens)
- `claude-sonnet-4-6` — Balanced default ($0.015/1k output tokens)
- `claude-haiku-4-5-20251001` — Budget tier ($0.00125/1k output tokens)

**Model Profile Tiers:**
- `quality` — Opus for research/execution, Sonnet for other ops; Sonnet → Haiku failover
- `balanced` (default) — Sonnet for all ops; Haiku failover
- `budget` — Haiku for all ops; no failover

**Failover behavior:** HTTP 429, 500, 502, 503, 529 trigger automatic model failover in `src/engine/providers/anthropic.ts`

## Monitoring & Observability

**Error Tracking:**
- None — no external error tracking service (e.g., Sentry)

**Logs:**
- Append-only JSON Lines audit trail written to `.buildpact/audit/cli.jsonl` (and `install.jsonl`)
- Implemented in `src/foundation/audit.ts` (`AuditLogger` class)
- Every CLI command start/end is logged with action, agent, files, outcome, cost_usd, tokens

**Cost Tracking:**
- Real-time cost accumulation tracked in `src/engine/cost-projector.ts`
- Budget guards enforced in `src/engine/budget-guard.ts` (configurable USD ceiling)

## CI/CD & Deployment

**Hosting:**
- npm public registry (`"access": "public"` in `package.json`)
- GitHub repository: `https://github.com/leoeloys/buildpact.git`

**CI Pipeline:**
- Not detected (no `.github/workflows/`, no CI config files observed)

## IDE Integrations

BuildPact generates configuration files for the following IDEs during `buildpact init`:

- **Claude Code** — Slash commands written to `.claude/commands/bp/` + `CLAUDE.md` in project root
- **Cursor** — `.cursorrules` file + `.cursor/rules/` directory
- **Gemini CLI** — `.gemini/` directory
- **Codex CLI** — `.codex/` directory

Implementation: `src/foundation/installer.ts` → `installIdeConfig()`

## Webhooks & Callbacks

**Incoming:**
- None — BuildPact is a CLI tool with no HTTP server

**Outgoing:**
- GitHub Raw Content fetches (squad download) — see Community Squad Registry above
- Anthropic Messages API calls — see AI Provider above

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` — Enables live AI dispatch. Without it, `StubProvider` is used (synthetic success, no real AI output)

**Optional env vars:**
- None explicitly defined beyond `ANTHROPIC_API_KEY`

**Secrets location:**
- No secrets stored by BuildPact itself; `ANTHROPIC_API_KEY` must be set in the shell environment by the user

---

*Integration audit: 2026-03-22*
