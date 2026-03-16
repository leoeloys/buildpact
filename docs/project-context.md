---
project_name: "BuildPact"
created_at: "2026-03-14"
language: "pt-br"
document_language: "en"
experience_level: "expert"
active_squad: "software"
active_model_profile: "balanced"
prd_version: "2.3.0"
workflow_phase: "pre-alpha"
---

# BuildPact — Project Context

> Paste this file at the start of any AI-assisted session to restore full project context.
> Keep in sync with STATUS.md (current state) and DECISIONS.md (decision history).

---

## What is BuildPact?

BuildPact is an **open-source Spec-Driven Development (SDD) framework** — an evolution of BMAD, synthesizing the best of SpecKit, BMAD, GSD, and AIOX into a unified, progressive-disclosure architecture. MIT license, donation-based sustainability (GitHub Sponsors), natively bilingual PT-BR/EN.

**Not a product for end-users directly.** BuildPact is a framework for developers and domain experts (like BMAD). End-users (e.g., medical professionals) interact with *Squads* built with BuildPact — never with BuildPact itself.

**CLI prefix:** `/bp:` | **Directory:** `.buildpact/` | **Package:** `buildpact` on npm

---

## Three-Layer Architecture

| Layer | Responsibility |
|-------|---------------|
| **Foundation** | Constitution, context management, project state, installation CLI |
| **Engine** | Pipeline (Quick→Specify→Plan→Execute→Verify+Learn), waves, recovery, memory, budget guards |
| **Domain** | Squads, Voice DNA, agent leveling L1–L4, community hub |

**Two operational modes:**
- **Prompt Mode (v1.0):** Markdown templates + slash commands. Works in any IDE + web interfaces.
- **Agent Mode (v2.0):** TypeScript CLI with direct session control, crash recovery, auto-advance.

---

## User Personas — Interaction Levels

| Level | Persona | Description |
|-------|---------|-------------|
| Framework User | **B — Lucas** (Solo Dev) | Uses BuildPact CLI daily. Full pipeline. |
| Framework User | **C — Mariana** (Tech Lead) | Configures framework for teams. Governance. |
| Framework User | **D — Ricardo** (Domain Expert) | Creates Squads + Web Bundles for others. |
| Squad Output User | **A — Dr. Ana** (Non-Technical) | Never touches BuildPact. Uses Web Bundles created by Persona D. |

> **Critical distinction:** Persona A validates *Squad quality*, not framework usability.

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Package manager | NPX (Node.js 18+) | Most accessible, no Python dependency |
| CLI framework | @clack/prompts | Modern TUI, used by AIOX |
| Agent files | Markdown + YAML frontmatter | Human-readable, no compilation |
| State management | Markdown + JSON on disk | Git-friendly, no external deps |
| Agent Mode (v2.0) | TypeScript + Pi SDK (TBD — OQ-02) | Direct session control |
| Testing | Vitest + Markdown snapshot tests | Fast, TypeScript-native |
| CI/CD | GitHub Actions | Free OSS, npm publish, Squad validation |
| Docs | VitePress (PT-BR + EN) | Native i18n, Markdown-based |

---

## Key Architectural Constraints

- **Orchestrators:** ≤300 lines, ≤15% of active model's context window (FR-301)
- **Subagent isolation:** Every heavy task dispatched via Task() with clean context (FR-302)
- **Document sharding:** Any file >500 lines auto-sharded with index.md (FR-304)
- **Atomic commits:** One commit per completed task, format `type(phase-plan): description` (FR-702)
- **Agent loading:** Only Chief + agent index (≤1KB) loaded initially; specialists on-demand (FR-906)
- **Budget guards:** 3-level limits (session/phase/day) — pauses execution, never silently continues (FR-705)
- **Constitution:** Immutable rules injected into every context window (FR-202)

---

## Squad Architecture

- **4-tier hierarchy:** Chief (T0) → Masters (T1) → Specialists (T2) → Support (T3)
- **6-layer agent anatomy:** identity, persona, voice_dna, heuristics, examples (min 3), handoffs
- **Voice DNA:** Mandatory 5-section template — Personality Anchors, Opinion Stance, Anti-Patterns (min 5 ✘/✔), Never-Do Rules, Inspirational Anchors
- **Agent Leveling:** L1 (Observer) → L2 (Contributor) → L3 (Operator) → L4 (Trusted). Starts at L1/L2, promoted after 85% approval rate over 7 days.

**Shipped Squads:**
- Software Squad (FR-1001) — public, open source, Alpha
- Agent Builder Squad (FR-1005) — public, open source, Beta
- Medical Marketing Squad (FR-1002) — private, founding team, Beta
- Scientific Research Squad (FR-1003) — private, SHOULD, v1.0
- Clinic Management Squad (FR-1004) — private, SHOULD, v2.0

---

## Release Milestones

| Phase | Timeline | Key Deliverables |
|-------|----------|-----------------|
| **Alpha** | Month 1–2 | Foundation + Engine (Prompt Mode), Software Squad, Claude Code + Cursor, PT-BR/EN, Web Bundle |
| **Beta** | Month 3–4 | Medical Marketing Squad, 6+ IDEs, community hub, Quick Flow, Budget Guards, Memory Tier 1 |
| **v1.0** | Month 5–6 | Recovery System, AutoResearch, full docs, GitHub Sponsors live |
| **v2.0** | Month 7–12 | Agent Mode (TypeScript CLI), Self-Optimizing Squads, Memory Tier 2+3 |

---

## Open Questions

| ID | Question | Deadline |
|----|----------|----------|
| OQ-02 | Pi SDK vs. custom agent harness for Agent Mode | Before v2.0 planning (Month 5) |
| OQ-04 | Governance: BDFL vs. committee | Month 6 (post-v1.0) |
| OQ-05 | Migration paths from SpecKit/BMAD/GSD/AIOX | Post-v1.0, community-driven |

*(OQ-01 resolved: BuildPact. OQ-03 resolved: clean-room MIT rewrite.)*

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/prd/buildpact-prd-v2.3.0.md` | Product Requirements Document (validated) |
| `docs/DECISIONS.md` | Decision log — why things were decided |
| `docs/STATUS.md` | Current state — where we left off |
| `docs/project-context.md` | This file — AI session context |

---

## Current State (as of 2026-03-14)

- PRD v2.3.0 validated and finalized
- Architecture phase: **not started**
- No code written
- Domains/npm not yet registered
- Next action: `bmad-bmm-create-architecture` (Winston 🏗️)
