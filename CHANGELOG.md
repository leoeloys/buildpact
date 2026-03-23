# Changelog

All notable changes to BuildPact will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-03-23

### Added

- **Agent Mode Runtime** (Epic 22)
  - `buildpact agent start|stop|status` — persistent agent supervisor with PID management
  - Event Bus with pub/sub, direct messaging, broadcast, priorities, TTL, and correlation tracking
  - Auto-advance walk-away execution — processes waves sequentially, pauses on failure/budget
  - Real-time execution dashboard renderer (terminal + JSON modes)
  - State persistence with atomic checkpoint/recovery (flat-file WAL pattern)
  - Prompt-to-agent migration command (Story 22.6, previously deferred from 10.5)

- **Self-Optimizing Squads** (Epic 23)
  - Squad optimizer with variant generation, benchmark evaluation, and statistical winner selection (p < 0.05)
  - Built-in benchmark sets for software domain (5 tasks)
  - Optimization isolation — experiments run in temp dirs, never touch working squad
  - Markdown + JSON optimization reports with per-variant metrics

- **Enterprise & Marketplace** (Epic 24)
  - RBAC middleware with role resolution (admin/lead/member/viewer) and permission checking
  - Command permission guards — blocks unauthorized actions with clear error messages
  - Centralized org-level constitution management with merge and conflict detection
  - Marketplace ratings & reviews (submit, validate, fetch summaries)
  - Squad certification program — 6-check validation for "Certified" badge

- **Cross-Project Intelligence** (Epic 25)
  - Project fingerprinting with Jaccard similarity and pattern suggestions
  - Differential privacy (Laplace noise) for cross-project data
  - Multi-language localization infrastructure — completeness checking, locale resolution, key fallback
  - Domain expansion packs (healthcare, legal, education, fintech) with constitution merge
  - Org-level memory promotion with project detail stripping

### Changed

- Package marked as private (personal project)
- Release publish script simplified (no npm publish)

---

## [1.0.0] - 2026-03-22

### Added

- **Hub Search & Discovery** — `buildpact hub search` and `buildpact hub info` for browsing community squads with filtering by domain, sorting by downloads/quality/name, and relevance-ranked search (Epic 20.1)
- **Squad Quality Scores** — automated quality scoring (0-100) based on structural completeness, Voice DNA, smoke tests, documentation, and test fixtures. Badges: Gold (90+), Silver (70-89), Bronze (50-69), Unrated (<50). Low-quality warning on install (Epic 20.2)
- **Onboarding Learn Command** — `buildpact learn` opens the getting-started tutorial in the default browser, locale-aware (EN/PT-BR), with SSH/CI fallback (Epic 21.1)
- **GitHub Sponsors & Contributor Onboarding** — FUNDING.yml, first-time contributor welcome bot, sponsor tiers in CONTRIBUTING.md (Epic 21.2)
- **Release Checklist** — `npm run release:check` validates tests, types, npm audit, changelog, version, build, and locales. `npm run release:publish` for full publish workflow (Epic 21.3)
- **Readonly Mode** — `readonly: true` in config.yaml blocks state-modifying commands (execute, specify, plan, quick, constitution) with BP210 error (Epic 21.3)
- **Documentation Site** — VitePress-powered docs at buildpact.dev with EN/PT-BR support (Epic 18.1)
- **Squad Creation Guide** — step-by-step guide for building custom Squads (Epic 18.2)
- **Migration Guides** — Alpha to Beta to v1.0 upgrade documentation (Epic 18.3)
- **Performance Budget Validation** — automated performance benchmarks (Epic 18.4)
- **Non-Interactive CI Mode** — `--ci` flag and `BP_CI=true` for headless pipeline execution (Epic 19.1)
- **GitHub Actions Adapter** — official `buildpact/verify-action` for CI integration (Epic 19.2)
- **Webhook Notifications** — configurable webhooks for pipeline events (Epic 19.3)

### Changed

- Version bumped to 1.0.0 — first stable release
- Error codes expanded: added READONLY_MODE, HUB_NO_RESULTS, HUB_SQUAD_NOT_FOUND, CONSTITUTION_MODIFICATION_BLOCKED, GIT_COMMAND_FAILED, and adopt/upgrade error codes
- CONTRIBUTING.md expanded with Squad contribution guide and sponsorship tiers (EN + PT-BR)

### Migration from Beta

- No breaking changes from 0.2.0-beta.1
- New commands available: `hub`, `learn`
- New config option: `readonly: true` for production lockdown
- Run `buildpact upgrade` if coming from alpha

---

## [0.2.0-beta.1] - 2026-03-22

### Added

- **E2E pipeline test suite** — automated tests for full specify/plan/execute/verify flow with snapshot-based structural validation (Story 17.1)
- **Persona validation scripts** — integration tests for Developer (Persona B), Web User (Persona D), and Medical Marketing (Persona A) user journeys (Story 17.2)
- **Error completeness tests** — programmatic validation that all ERROR_CODES have matching i18n entries in both EN and PT-BR locales (Story 17.3)
- **Structural snapshot comparison** — compare markdown output structure (headings, sections) instead of exact text for regression detection
- `test:e2e` npm script for running E2E tests separately from unit tests
- Missing i18n keys for engine, constitution, sharding, command, optimize, metrics, and ratchet error categories

### Changed

- **Error messages improved** — all error messages now follow "[What happened]. [Why]. [How to fix]" format with actionable remediation guidance (Story 17.3)
- Error messages for file, network, recovery, squad, feedback, lessons, decisions, autonomy, and agent errors enhanced with fix instructions
- PT-BR translations updated to match all EN error message improvements

### Fixed

- Missing PT-BR translations for 17 error i18n keys that would fall back to raw key indicators
- Error code consistency — all codes validated to follow SCREAMING_SNAKE_CASE convention

## [0.1.0-alpha.5] - 2026-03-21

### Fixed

- i18n path resolution for installed packages
- Install slash commands to `.claude/commands/bp/`

## [0.1.0-alpha.4] - 2026-03-20

### Changed

- Redesigned install onboarding with friendly UX and recommendations

## [0.1.0-alpha.3] - 2026-03-19

### Fixed

- Templates path resolution when installed globally

## [0.1.0-alpha.2] - 2026-03-18

### Fixed

- Binary path in package.json
- Added README and LICENSE
