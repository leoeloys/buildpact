# PRODUCT REQUIREMENTS DOCUMENT

## BuildPact

### The First Universal Spec-Driven Development Framework

**buildpact.dev** · MIT License · Bilingual PT-BR/EN

---

| Field | Value |
|-------|-------|
| Version | 2.3.0-draft |
| Date | March 14, 2026 |
| Author | Dr. Leonardo Eloy Sousa |
| Reviewer | Claude (PM Review) |
| Status | DRAFT — Validated (v2.3.0) |
| Classification | Open Source — MIT License |
| Primary Language | PT-BR + EN (Bilingual) |
| Standards | IEEE 830 / ISO/IEC 29148:2018 / Shape Up |
| Sustainability | GitHub Sponsors (donation-based) |

> **Confidentiality:** This document is intended for the founding team. Upon public release, this PRD becomes the project constitution.

---

## Table of Contents

1. Executive Summary (incl. 1.5 Product Scope)
2. Stakeholders and User Personas (incl. 2.1.0 Persona Interaction Levels)
3. Product Architecture
4. Functional Requirements
5. Non-Functional Requirements
6. Technical Architecture
7. Security and Trust Model
8. Testing Strategy
9. Release Plan and Milestones
10. Risks and Mitigations
11. Success Metrics and KPIs
12. Open Questions and Decisions Pending
13. Appendices

---

## 1. Executive Summary

### 1.1 Vision Statement

BuildPact is the first Spec-Driven Development (SDD) framework designed to be simultaneously accessible for non-developer end-users (via domain-specific Squads and Web Bundles created by framework users), powerful for the engineers and domain experts building those Squads, universal across domains, and natively bilingual (PT-BR/EN). It synthesizes the best components from the four leading SDD frameworks (SpecKit, BMAD, GSD, AIOX) into a unified, progressive-disclosure architecture that adapts to the user's expertise level and professional domain.

The framework is fully open source under MIT license and sustained exclusively through community contributions and GitHub Sponsors donations. There are no paid tiers, premium features, or marketplace commissions.

### 1.2 Problem Statement

The current SDD ecosystem in 2026 presents a fragmented landscape where users must choose between conflicting trade-offs:

- **SpecKit (~71K★)** is simple and broadly supported but limited to software development and lacks active orchestration.
- **BMAD (~25–40K★)** provides deep agile simulation but overwhelms non-developers with 19+ agents and complex module architecture.
- **GSD (~29K★)** delivers superior context engineering but is CLI-only and primarily Claude Code-dependent.
- **AIOX (~2.3K★)** pioneered multi-domain Squads but inherits excessive complexity and gates core features behind a paid tier.

No single framework solves the complete problem. Non-developers (physicians, marketers, clinic managers) cannot use any of these tools without significant technical assistance. The opportunity is a unified framework that bridges the gap between simplicity and power through progressive disclosure.

### 1.3 Target Outcome

Within 12 months of launch, the framework should achieve:

- 5,000+ GitHub stars and active community contributions in PT-BR and EN.
- 3+ active Squads in production use, including the public Software Squad and community-created domain Squads.
- < 10 minutes from `npx install` to first successful spec generation for a first-time developer user (Persona B).
- 80%+ user satisfaction in post-session surveys across both developer and non-developer personas.

**Intermediate checkpoints (leading indicators):**

| Timeframe | Metric | Target | Signal |
|-----------|--------|--------|--------|
| 30 days post-Alpha | Alpha testers onboarded | 10+ | Demand validation |
| 60 days post-Alpha | Community PRs submitted | 3+ | Contributor interest |
| 90 days post-Alpha | Non-dev users (Persona A) completing a session | 5+ | Accessibility validated |
| 6 months | GitHub stars | 1,000+ | Growth trajectory |
| 6 months | NPM weekly downloads | 500+ | Active usage |

**Benchmark context:** SpecKit achieved ~71K stars backed by GitHub's organic distribution. GSD reached ~29K as CLI-only. Achieving 5K stars in 12 months as an independent project is ambitious but achievable with a differentiated bilingual story and medical/non-dev community targeting. For GitHub Sponsors, realistic projections follow a pessimistic ($200/mo), base ($800/mo), and optimistic ($2,000/mo) scenario at 12 months, with a concrete sponsor outreach plan targeting Brazilian healthtech companies and AI tooling sponsors.

### 1.4 Sustainability Model

The framework adopts a donation-based sustainability model following successful precedents in the open-source ecosystem (Vue.js, Evan You; curl, Daniel Stenberg; Homebrew):

- **GitHub Sponsors** as the primary funding channel, with individual and organizational tiers.
- **All features are free and open source** — no freemium, no Commons Clause, no feature gating.
- **Community-contributed Squads** are shared freely through the community hub repository.
- **Corporate sponsorship** welcomed for priority feature requests and logo placement in documentation.

This model aligns incentives: the framework's value grows with community adoption, and sponsors fund the development that benefits everyone. The explicit rejection of paid tiers removes friction for adoption in educational, medical, and public-sector contexts where procurement processes for paid tools create barriers.

**Sponsor Outreach Plan (Post-v1.0):**

| Tier | Target | Value Proposition |
|------|--------|-------------------|
| Individual ($5–25/mo) | Developers using the framework daily | Priority support, sponsor badge |
| Team ($100–500/mo) | Startups and small agencies | Logo in docs, priority feature input |
| Corporate ($1,000+/mo) | Healthtech companies, AI tooling vendors | Featured sponsor, joint case studies |

---

### 1.5 Product Scope

#### MVP (Alpha — Months 1–2)
Foundation + Engine in Prompt Mode, Software Squad (public), Claude Code + Cursor support, PT-BR/EN bilingual parity, Web Bundle export. Full deliverables: see Section 9.1 Alpha.

#### Growth (Beta + v1.0 — Months 3–6)
Multi-IDE support, Medical Marketing Squad (private), community hub, Quick Flow, Memory Layer, AutoResearch for code/copy, Recovery System. Full deliverables: see Section 9.1 Beta and v1.0.

#### Vision (v2.0 — Months 7–12)
Agent Mode (TypeScript CLI), crash recovery, auto-advance, Self-Optimizing Squads, full token economy dashboard. Full deliverables: see Section 9.1 v2.0.

---

## 2. Stakeholders and User Personas

### 2.1 Primary Personas

#### 2.1.0 Persona Interaction Levels

BuildPact operates at two distinct user interaction levels. This distinction is critical for downstream UX Design, Architecture, and Epic breakdown:

- **Framework Users (Personas B, C, D):** Install and use BuildPact directly via CLI or IDE. They run `npx buildpact init`, use slash commands, create Squads, manage model profiles, and execute the full pipeline (specify → plan → execute → verify).

- **Squad Output Users (Persona A):** Never interact with BuildPact directly. They interact with Web Bundles or Squad-powered interfaces *created by framework users*. Their experience is a downstream product of BuildPact — not BuildPact itself. Persona A's satisfaction validates Squad quality, not framework usability.

This means: any requirement referencing Persona A as a direct user of framework features (CLI, API, budget guards, slash commands) should be reread as "Persona D builds a Squad that serves Persona A." The framework's responsibility for Persona A is to enable *Squad creators* to build great end-user experiences.

---

#### 2.1.1 Persona A: The Non-Technical Professional

**Dr. Ana — Ophthalmologist & Clinic Owner**

Age 42 · Rio de Janeiro, Brazil · Zero coding experience · Needs marketing content, patient flow optimization, and compliance documentation · Works in Portuguese · Uses Claude.ai web interface · Time-constrained: 15 min max per session.

**Jobs to be done:** Create CFM-compliant marketing landing pages, generate SEO content calendars, optimize appointment scheduling workflows, produce patient education materials — all via a Squad-powered interface built by Persona D. Dr. Ana never installs BuildPact; she receives a Web Bundle (a single prompt file) that, when pasted into Claude.ai, activates a guided Portuguese-language workflow. The BuildPact framework's responsibility is to enable Persona D to build this interface, not to serve Dr. Ana directly.

**Success criteria (Squad-level, not framework-level):** Dr. Ana completes a full marketing content brief using a Medical Marketing Squad Web Bundle in Claude.ai within her first session, entirely in Portuguese, with CFM compliance gates built into the process. She interacts through natural language conversation — no slash commands, no CLI, no technical setup. This success criteria validates the *Medical Marketing Squad* (FR-1002), not BuildPact core. Framework-level validation for this persona is deferred to Beta (see Section 9.1).

**Persona A End-to-End User Journey:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DR. ANA — WEB BUNDLE JOURNEY                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. SETUP (one-time, <2 min)                                        │
│     • Colleague shares Web Bundle text file or link                 │
│     • Dr. Ana opens Claude.ai, pastes the Web Bundle prompt         │
│     • Framework activates in Portuguese, introduces itself          │
│     • "Olá! Sou seu assistente de marketing médico.                 │
│       Me conte: qual é o objetivo principal de hoje?"               │
│                                                                     │
│  2. GUIDED DISCOVERY (<5 min)                                       │
│     • Framework asks 3-5 sequential questions in plain Portuguese:  │
│       ① "Qual a sua especialidade médica?"                          │
│       ② "O que você quer criar hoje?" (options presented)           │
│       ③ "Quem é seu paciente ideal?"                                │
│       ④ "Alguma restrição importante?" (CFM auto-suggested)         │
│     • Dr. Ana answers naturally — no forms, no commands             │
│     • Framework builds a structured brief internally                │
│                                                                     │
│  3. GENERATION + COMPLIANCE CHECK (<5 min)                          │
│     • Framework generates the deliverable (landing page copy,       │
│       content calendar, patient materials)                          │
│     • CFM compliance gate runs automatically                        │
│     • If violations found: explains in plain language, suggests fix │
│     • Output delivered as formatted text in the chat                │
│                                                                     │
│  4. REFINEMENT (<3 min)                                             │
│     • "Quer ajustar alguma coisa?"                                  │
│     • Dr. Ana requests changes in natural language                  │
│     • Framework iterates without re-asking previous questions       │
│                                                                     │
│  5. EXPORT                                                          │
│     • Final output formatted for copy/paste                         │
│     • Optional: "Quer que eu salve essas preferências para a        │
│       próxima vez?" (seeds Memory Layer feedback)                   │
│                                                                     │
│  Total time: 10-15 minutes │ Zero technical knowledge required      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2.1.2 Persona B: The Solo Developer / Vibe Coder

**Lucas — Indie Developer**

Age 28 · São Paulo, Brazil · Self-taught programmer · Builds SaaS products with Claude Code · Frustrated with vibe coding quality degradation · Bilingual PT-BR/EN · Uses Claude Code CLI daily.

**Jobs to be done:** Transform product ideas into structured specs, plan features with proper architecture, execute with parallel waves and atomic commits, maintain quality as projects scale beyond MVP. Lucas has used GSD and SpecKit separately but wants one integrated workflow.

**Success criteria:** Lucas builds a complete SaaS feature (auth + dashboard + settings) through the full pipeline (specify → plan → execute → verify) with parallel waves, atomic commits, context window monitoring, and zero quality degradation across 3+ phases.

**Persona B End-to-End User Journey:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LUCAS — DEVELOPER JOURNEY                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. INSTALL (<2 min)                                                │
│     • npx buildpact init my-saas                                    │
│     • TUI: language=EN, domain=Software, IDE=Claude Code,           │
│       level=Intermediate, Squad=Software                            │
│     • Framework generates .buildpact/, .claude/commands/            │
│                                                                     │
│  2. SPECIFY (<10 min)                                               │
│     • /bp:specify "add user auth with email + Google OAuth"         │
│     • Framework asks 5-7 targeted questions (wizard mode)           │
│     • Constitution validates: coding standards, no any types        │
│     • spec.md generated with user stories + acceptance criteria     │
│                                                                     │
│  3. PLAN (<5 min)                                                   │
│     • /bp:plan                                                      │
│     • Parallel research agents investigate stack + codebase         │
│     • Wave analysis: Wave 1 (DB schema), Wave 2 (API),             │
│       Wave 3 (UI), Wave 4 (tests)                                   │
│     • Nyquist validation: completeness + risk + efficiency          │
│     • plan files generated (max 2-3 tasks each)                     │
│                                                                     │
│  4. EXECUTE (<30 min)                                               │
│     • /bp:execute                                                   │
│     • Wave 1: subagent runs in clean context, atomic commit         │
│     • Context monitor: WARNING at >50%, CRITICAL at >75%           │
│     • Wave N: budget guard checks between waves                     │
│     • All waves complete: N atomic commits in Git history           │
│                                                                     │
│  5. VERIFY (<10 min)                                                │
│     • /bp:verify                                                    │
│     • Walks through each acceptance criterion: PASS/FAIL            │
│     • Failed items → fix plan generated automatically               │
│     • Memory Layer captures patterns + decisions                    │
│                                                                     │
│  Total time: ~1 hour for a medium feature │ Zero quality degradation │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2.1.3 Persona C: The Senior Engineer / Tech Lead

**Mariana — Staff Engineer at a Healthtech Startup**

Age 35 · Remote · 10+ years experience · Manages 4 developers using AI agents · Needs governance, model cost control, and cross-IDE consistency · Uses Cursor + Claude Code · Evaluates frameworks for team adoption.

**Jobs to be done:** Define project constitutions that enforce architectural standards, configure model profiles to control costs, create custom Squads for her healthtech domain, onboard junior devs with progressive disclosure, review specs and plans for completeness before execution.

**Success criteria:** Mariana configures the framework for her team with Constitution + custom Squad + model profiles in under 30 minutes. Junior developers onboard using beginner mode within one session. The team achieves consistent output quality across Cursor and Claude Code with the same spec files.

**Persona C End-to-End User Journey:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MARIANA — TECH LEAD JOURNEY                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. TEAM SETUP (<30 min, one-time)                                  │
│     • npx buildpact init healthtech-platform                        │
│     • TUI: EN, domain=Software, IDEs=[Claude Code, Cursor],         │
│       level=Expert, Squad=Software                                  │
│     • /bp:constitution → defines coding standards, LGPD rules,      │
│       no direct DB access from UI, 80% coverage gate               │
│     • config.yaml: quality profile (Opus for plan, Sonnet for exec) │
│     • budget: per_phase_usd=10, per_day_usd=50                     │
│                                                                     │
│  2. JR DEV ONBOARDING (<1 session)                                  │
│     • Jr dev clones repo, runs buildpact (inherits config)          │
│     • Beginner mode: /bp:start guides through wizard               │
│     • Constitution auto-injected: jr dev can't violate arch rules   │
│     • Mariana reviews plan via Nyquist validation report            │
│                                                                     │
│  3. ONGOING GOVERNANCE                                              │
│     • Context monitor alerts surface on CRITICAL (>75%)            │
│     • Budget guards pause runaway sessions, notify Mariana          │
│     • /bp:squad validate → checks squad structural integrity        │
│     • Agent Leveling: approves L1→L2 promotions after 7-day review  │
│                                                                     │
│  4. CROSS-IDE CONSISTENCY CHECK                                     │
│     • Same spec.md produces equivalent plans in Claude Code+Cursor  │
│     • Cross-IDE test suite validates wave structure equivalence      │
│                                                                     │
│  Total value: governance + cost control + quality consistency       │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2.1.4 Persona D: The Domain Expert Building AI Squads

**Ricardo — Medical Marketing Agency Owner**

Age 38 · Rio de Janeiro · Non-developer building a medical marketing agency · Needs to create reusable agent teams for client projects · Works in Portuguese · Wants to publish Squads for the community.

**Jobs to be done:** Design specialized Squad agents with Voice DNA cloned from domain experts, create repeatable workflows for client onboarding, validate Squad quality using the built-in validator, iterate on agent heuristics based on output quality. Ricardo may keep Squads private for competitive advantage or publish them to the community hub.

**Success criteria:** Ricardo creates a Medical Marketing Squad with 4 agents (Strategist, Copywriter, Designer, Compliance), each with Voice DNA following the mandatory 5-section template and heuristics, validates it with the built-in validator, and deploys it for client work. Optionally, he publishes a generalized version to the community hub for other users to install with a single command.

**Persona D End-to-End User Journey:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                  RICARDO — SQUAD CREATOR JOURNEY                     │
│            (The most critical journey for Persona A enablement)      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. INSTALL & SETUP (<5 min)                                        │
│     • npx buildpact init medical-marketing-agency                   │
│     • TUI: PT-BR, domain=Custom, IDE=Claude Code, level=Expert      │
│     • Installs Agent Builder Squad (FR-1005) as scaffolding tool    │
│                                                                     │
│  2. SQUAD DESIGN (<2 hours)                                         │
│     • /bp:squad create medical-marketing                            │
│     • Scaffold generates 4-tier hierarchy template                  │
│     • Ricardo defines 4 agents: Strategist (T1), Copywriter (T1),  │
│       Designer (T2), Compliance Checker (T2)                        │
│     • Each agent: 6-layer anatomy (identity, persona, voice_dna,   │
│       heuristics, examples ×3, handoffs)                            │
│                                                                     │
│  3. VOICE DNA CREATION (per agent)                                  │
│     • Analyzes 50+ pieces of real specialist content                │
│     • Fills 5-section template: Personality Anchors, Opinion Stance,│
│       Anti-Patterns (min 5 ✘/✔ pairs), Never-Do Rules,             │
│       Inspirational Anchors                                         │
│     • Copywriter agent: "Speak like a seasoned CFM-aware marketer,  │
│       never like a FAQ bot"                                         │
│                                                                     │
│  4. VALIDATION                                                      │
│     • /bp:squad validate medical-marketing                          │
│     • Checks: all 6 layers present, Voice DNA 5-section compliance, │
│       min 3 examples per agent, handoff graph validity              │
│     • Fixes any structural gaps flagged                             │
│                                                                     │
│  5. BENCHMARK CREATION                                              │
│     • Creates benchmark/ with 10+ input-output golden pairs         │
│     • Runs /bp:optimize-squad for Voice DNA tuning (v2.0)          │
│                                                                     │
│  6. DEPLOY FOR PERSONA A                                            │
│     • /bp:export-web claude.ai → generates Web Bundle               │
│     • Sends single .txt file to Dra. Ana via WhatsApp/email         │
│     • Dra. Ana pastes Bundle into Claude.ai → guided PT-BR flow    │
│                                                                     │
│  7. ITERATE (ongoing)                                               │
│     • Reviews feedback loop files (approve/reject per session)      │
│     • Agent Leveling: promotes agents L1→L2 after 85% approval      │
│     • Monthly: /bp:memory consolidate → curates lessons             │
│                                                                     │
│  8. PUBLISH (optional)                                              │
│     • Generalizes private Squad, removes client-specific data       │
│     • PR to buildpact-squads → CI validates + maintainer reviews    │
│     • Community installs via: npx buildpact squad add medical-mktg  │
│                                                                     │
│  Total value: Ricardo creates Dra. Ana's entire experience          │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Anti-Personas (Who This Framework Does NOT Serve)

Defining anti-personas prevents scope creep and clarifies positioning:

| Anti-Persona | Why Not Served | What They Should Use Instead |
|--------------|----------------|------------------------------|
| **Enterprise DevOps Lead** needing SOC2/ISO27001 compliance, JIRA/Confluence integration, SSO, and audit trails for regulated industries | The framework prioritizes simplicity and open-source over enterprise compliance infrastructure. Adding enterprise features would compromise the progressive disclosure model. | Existing enterprise AI platforms (Copilot for Business, internal tooling) |
| **AI-Skeptic Developer** who prefers writing all specs, plans, and code manually without AI assistance | The framework's entire value proposition is AI-augmented development. Without AI, it's just a folder structure. | Traditional spec templates, JIRA, Notion |
| **Large Team (20+ devs)** needing concurrent multi-user collaboration on the same spec/plan files | The framework is designed for solo-to-small-team workflows. Multi-user merge conflicts on spec files are out of scope for v1.x. | Linear, Shortcut, or JIRA with AI copilots |

### 2.3 Persona-to-Feature Traceability Matrix

Every functional requirement must serve at least one primary persona. The following matrix maps personas to key feature areas, ensuring no feature is built without a clear user need:

> **Note:** Persona A is a *Squad output user*, not a direct framework user (see Section 2.1.0). Her row reflects indirect benefit via Squads/Web Bundles built by Persona D, not direct framework interaction.

| Feature Area | Persona A (Dr. Ana) | Persona B (Lucas) | Persona C (Mariana) | Persona D (Ricardo) |
|-------------|---------------------|-------------------|---------------------|---------------------|
| Progressive Disclosure | N/A (no commands) | Uses | Configures | Uses |
| Web Bundles | **Receives** (end-user) | — | — | **Creates** (PRIMARY) |
| Constitution System | N/A | Uses | PRIMARY | — |
| Pipeline (Specify→Verify) | N/A | PRIMARY | Reviews | Uses |
| Automation Maturity (FR-505) | N/A | Uses | — | PRIMARY |
| Squad Architecture | N/A | — | Creates | PRIMARY |
| Squad Builder | N/A | — | Uses | PRIMARY |
| Agent Leveling L1–L4 (FR-907) | N/A | Uses | PRIMARY | PRIMARY |
| Voice DNA 5-Section (FR-903) | N/A | — | Uses | PRIMARY |
| AutoResearch | N/A | Uses | Configures | Uses |
| Budget Guards | N/A | PRIMARY | PRIMARY | Uses |
| Feedback Loops (FR-803) | N/A | Uses | Configures | Uses |
| Multi-Perspective Nyquist (FR-605) | N/A | Uses | PRIMARY | — |
| Token Economy | N/A | Uses | PRIMARY | — |
| Bilingual (PT-BR/EN) | **Indirect** (Squad UX) | Uses | — | PRIMARY |

---
## 3. Product Architecture

### 3.1 Three-Layer Architecture

The framework is organized in three layers, each with clear boundaries, responsibilities, and extension points:

| Layer | Responsibility | Inspiration Source |
|-------|---------------|-------------------|
| **Foundation** | Constitution, context management, project state, installation CLI | SpecKit (Constitution) + GSD (Context Engineering) + BMAD (TUI installer) |
| **Engine** | Pipeline phases (Quick → Specify → Plan → Execute → Verify+Learn), waves, recovery, memory, automation maturity | GSD (waves, commits, monitor) + BMAD (sharding, tracks) + AIOX (recovery, memory) + OpenClaw (automation maturity pattern) |
| **Domains** | Squads, Voice DNA, agent leveling, domain templates, knowledge bases, community hub | AIOX (Squads, Voice DNA, tiers) + BMAD (Builder, expansion packs) + OpenClaw (leveling system L1–L4) |

**Architecture Diagram:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │Claude Code│  │  Cursor  │  │ Windsurf │  │Gemini CLI│  │ Web Chat │ │
│  │  (CLI)    │  │ (Agent)  │  │ (Agent)  │  │  (CLI)   │  │ (Bundle) │ │
│  └─────┬─────┘  └─────┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│        │              │            │              │              │       │
│        └──────────────┴────────────┴──────────────┴──────────────┘       │
│                                    │                                     │
│                        ┌───────────▼───────────┐                         │
│                        │   PROMPT DISPATCHER    │                         │
│                        │ (Slash Commands / NL)  │                         │
│                        └───────────┬───────────┘                         │
├────────────────────────────────────┼─────────────────────────────────────┤
│  DOMAIN LAYER                      │                                     │
│  ┌─────────────────────────────────▼──────────────────────────────────┐  │
│  │                        SQUAD ROUTER                                │  │
│  │  Routes tasks to appropriate Squad agents based on domain context  │  │
│  └──┬──────────┬──────────┬──────────┬──────────┬────────────────────┘  │
│     │          │          │          │          │                        │
│  ┌──▼───┐  ┌──▼───┐  ┌──▼───┐  ┌──▼───┐  ┌──▼───┐                    │
│  │ SW   │  │ Med  │  │ Sci  │  │Agent │  │Custom│                    │
│  │Squad │  │Mktg  │  │ Res  │  │Build │  │Squad │                    │
│  │(pub) │  │(priv)│  │(priv)│  │(pub) │  │(user)│                    │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘                    │
├──────────────────────────────────────────────────────────────────────────┤
│  ENGINE LAYER                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                     PIPELINE ORCHESTRATOR                          │  │
│  │                    (≤300 lines, ≤15% context)                      │  │
│  │                                                                    │  │
│  │  ┌─────┐   ┌───────┐   ┌────┐   ┌───────┐   ┌──────┐            │  │
│  │  │Quick├──►│Specify├──►│Plan├──►│Execute├──►│Verify│            │  │
│  │  │Flow │   │       │   │    │   │       │   │+Learn│            │  │
│  │  └─────┘   └───────┘   └────┘   └───────┘   └──────┘            │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ CROSS-CUTTING: Context Monitor │ Budget Guards │ Recovery    │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│  FOUNDATION LAYER                                                        │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │Constitution│  │Project State │  │  i18n       │  │ Config/Model   │  │
│  │  (.md)     │  │(context, mem)│  │ (PT-BR/EN) │  │  Profiles      │  │
│  └────────────┘  └──────────────┘  └────────────┘  └────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │           FILE SYSTEM (.buildpact/ directory — all Markdown/      │    │
│  │            JSON/YAML, human-readable, Git-friendly)              │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Layer Communication Rules:**

1. **Domain → Engine:** Squads submit tasks to the Pipeline Orchestrator via standardized task payloads. Squads never bypass the Engine to access Foundation directly.
2. **Engine → Foundation:** The Orchestrator reads Constitution and project state from Foundation. Engine writes pipeline outputs (specs, plans, code) to Foundation's file system.
3. **Engine → Domain:** The Orchestrator dispatches tasks to Squad agents via the Squad Router. Each dispatch creates a clean subagent context (FR-302).
4. **Foundation → All:** Constitution rules are injected into every context window. Project state is available to all layers via file reads.

### 3.2 Dual-Mode Architecture (Critical Design Decision)

Based on the GSD v1→v2 evolution, the framework must plan for two operational modes from day one:

- **Prompt Mode (v1.0):** Templates and slash commands in Markdown. Works in any IDE (Claude Code, Cursor, Windsurf, Gemini CLI, Codex) and web interfaces (Claude.ai, ChatGPT, Gemini). Low barrier to entry. Analogous to GSD v1 and SpecKit.
- **Agent Mode (v2.0):** Standalone TypeScript CLI with direct control over context windows, sessions, Git branches, cost tracking, crash recovery, and auto-advance. Analogous to GSD-2 built on Pi SDK. Requires Node.js runtime.

This dual-mode approach ensures maximum adoption (Prompt Mode) without sacrificing technical evolution (Agent Mode). Users start in Prompt Mode and graduate to Agent Mode as projects scale. Both modes share the same spec files, Constitution, and Squads.

**Mode Comparison:**

| Capability | Prompt Mode (v1.0) | Agent Mode (v2.0) |
|-----------|-------------------|-------------------|
| IDE support | Any IDE + web interfaces | Node.js 18+ environments |
| Context control | Managed by host IDE | Direct session management |
| Crash recovery | Manual (state on disk) | Automatic (checkpoint/resume) |
| Cost tracking | Estimated (model-dependent) | Precise (API-level) |
| Auto-advance | No (user triggers each phase) | Yes (pipeline runs to completion) |
| Parallel execution | Sequential within IDE | True parallel subagent dispatch |
| Setup complexity | Zero (paste prompt or run npx) | npm install + configuration |

### 3.3 Progressive Disclosure System

The framework exposes different command sets based on user-declared experience level:

| Level | Visible Commands | Description |
|-------|-----------------|-------------|
| **Beginner** | `/bp:start`, `/bp:build`, `/bp:help` | Guided wizard unifying specify+plan, auto-execution, contextual bilingual help |
| **Intermediate** | +5: `quick`, `specify`, `plan`, `execute`, `verify` | Individual phase control, quick flow for ad-hoc tasks, manual verification |
| **Expert** | +13: `constitution`, `analyze`, `squad`, `memory`, `waves`, `profile`, `shard`, `recover`, `party`, `export`, `map-codebase`, `nyquist`, `token-audit` | Full governance, model cost control, Squad management, parallel waves, Nyquist validation, codebase mapping, token economy analysis |
| **Expert+** | +3: `optimize`, `optimize-squad`, `benchmark` | AutoResearch Pattern: autonomous overnight experimentation loop for code, copy, and Squad agent self-optimization |

**Progressive Disclosure Flow:**

```
┌──────────┐      ┌──────────────┐      ┌────────┐      ┌─────────┐
│ Beginner │ ───► │ Intermediate │ ───► │ Expert │ ───► │ Expert+ │
│ 3 cmds   │      │ 8 cmds       │      │ 21 cmds│      │ 24 cmds │
└──────────┘      └──────────────┘      └────────┘      └─────────┘
     │                   │                   │                │
     ▼                   ▼                   ▼                ▼
  "I want to          "I want to          "I want full     "I want
   describe            control each        governance       autonomous
   what I need"        phase"              and tuning"      optimization"
```

**Web Bundle Equivalence:** The "Beginner" disclosure level refers to first-time developer users of the framework (Persona B new to BuildPact), not to Persona A end-users. Persona A never interacts with commands — she interacts with Web Bundles created by Persona D. In Web Bundle mode, all commands are replaced with natural language conversation flows. The Web Bundle prompt instructs the model to present options conversationally: "O que você gostaria de fazer?" instead of requiring `/bp:start`. See FR-105 for full specification.

---
## 4. Functional Requirements

### 4.1 Foundation Layer

#### 4.1.1 Installation and Setup (FR-100 Series)

**FR-101 — One-Command Installation.** The framework MUST install via `npx buildpact init <project-name>` with no prior dependencies beyond Node.js 18+. No Python, no uv, no global npm packages required. Priority: **MUST**.

**FR-102 — Interactive TUI.** The installer MUST provide a bilingual (PT-BR/EN) Terminal User Interface using `@clack/prompts` with: language selection, domain selection (Software/Marketing/Health/Research/Management/Custom), IDE selection (multi-select from 10+ options), experience level selection (Beginner/Intermediate/Expert), and optional Squad installation. Priority: **MUST**.

**FR-103 — Diagnostic Tool.** The command `buildpact doctor` MUST check: Node.js version, Git availability, IDE configuration validity, Squad integrity, and context file consistency. Output in the user's selected language. Priority: **SHOULD**.

**FR-104 — Cross-IDE Configuration.** Installation MUST generate correct configuration files for all selected IDEs simultaneously: `.claude/commands/` for Claude Code, `.cursor/rules/` for Cursor, `.gemini/` for Gemini CLI, `.codex/` skills for Codex, and `CLAUDE.md`/`.cursorrules` as appropriate. Priority: **MUST**.

**FR-105 — Web Bundle Export.** The command `/bp:export-web <platform>` MUST generate a single copiable prompt for Claude.ai, ChatGPT, and Gemini web interfaces, containing compressed versions of all active commands, Constitution, and project context. Web Bundles are the primary delivery mechanism for serving Persona A end-users: Persona D (Squad creators) runs this command to generate a Bundle; Persona A receives and pastes it into their web interface. Because this is the only BuildPact touchpoint accessible to non-technical end-users (indirectly), it is elevated to MUST priority. Priority: **MUST**.

The Web Bundle system MUST satisfy the following sub-requirements:

- **FR-105a — Token Budget Management.** Each generated bundle MUST include a token count estimate and MUST NOT exceed platform-specific limits: 180K tokens for Claude.ai, 128K for ChatGPT (GPT-4), 1M for Gemini. The export command MUST warn if the bundle approaches 80% of any platform's limit. Priority: **MUST**.
- **FR-105b — Compression Strategy.** The bundle MUST apply progressive compression: (1) inline only active Squad agent definitions (not all installed Squads), (2) compress Constitution to essential rules only, (3) exclude optimization history and memory lessons, (4) include only the current project context, not full history. The compression algorithm MUST be documented and deterministic. Priority: **MUST**.
- **FR-105c — Conversational Interface Adaptation.** For web interfaces, the bundle MUST replace all slash commands with natural language conversation flows. Beginner-level commands (`/bp:start`, `/bp:build`, `/bp:help`) MUST be expressed as guided questions in the user's selected language. The bundle MUST instruct the host model to present numbered options instead of expecting command syntax. Priority: **MUST**.
- **FR-105d — Bundle Versioning and Staleness Detection.** Each bundle MUST include a generation timestamp and a hash of source files. The bundle SHOULD include instructions for the host model to warn the user if the bundle is older than 7 days or if it detects references to files that may have changed. Priority: **SHOULD**.
- **FR-105e — Graceful Degradation.** If a bundle exceeds a platform's token limit, the export command MUST offer tiered degradation: (1) remove examples from agent definitions, (2) remove heuristics detail, (3) reduce to single-agent mode (Chief only), (4) generate a minimal "quick session" bundle that supports only the specify phase. Each degradation tier MUST be documented in the bundle with a note explaining what was removed. Priority: **SHOULD**.

**FR-106 — Prompt-to-Agent Mode Migration.** When a project transitions from Prompt Mode (v1.0) to Agent Mode (v2.0), the framework MUST preserve full backwards compatibility of all existing artifacts: spec files, Constitution, memory files (including feedback loops), Squad configurations, and optimization history. The migration command (`npx buildpact migrate-to-agent`) MUST: (a) validate all existing files against Agent Mode schema requirements, (b) generate any additional configuration files needed by Agent Mode, (c) preserve all Git history, (d) report a compatibility summary listing any manual adjustments needed. Projects MUST be able to operate in Prompt Mode even after Agent Mode is available, with no forced migration. Priority: **SHOULD**.

#### 4.1.2 Constitution System (FR-200 Series)

**FR-201 — Constitution Creation.** The command `/bp:constitution` MUST create or update `.buildpact/constitution.md` containing immutable project principles. The Constitution MUST support: coding standards, compliance requirements (CFM, ANVISA, LGPD, HIPAA), architectural constraints, quality gates, and domain-specific rules. Priority: **MUST**.

**FR-202 — Constitution Enforcement.** All subsequent commands (specify, plan, execute) MUST reference and validate against the Constitution automatically. Violations MUST generate warnings with specific references to violated principles. Priority: **MUST**.

**FR-203 — Constitution Versioning.** Each modification to the Constitution MUST generate an update checklist (`constitution_update_checklist.md`) tracking what changed, why, and what downstream artifacts need review. Priority: **SHOULD**.

#### 4.1.3 Context Engineering (FR-300 Series)

**FR-301 — Orchestrator Size Limit.** No orchestrator workflow or command file MUST exceed 300 lines or consume more than 15% of the active model's maximum context window (as reported by the model provider's API for the currently configured model). This is a hard architectural constraint. Priority: **MUST**.

**FR-302 — Subagent Isolation with Mandatory Session Reset.** All heavy computation (research, planning, execution, verification) MUST be delegated to subagents via Task() dispatch, each receiving a clean context window. Subagents MUST NOT inherit accumulated context from the orchestrator beyond the specific task payload. Each subagent session MUST start from a clean state with only the injected task-specific context (plan file, relevant codebase excerpts, project constitution). This is a hard architectural requirement based on documented evidence that session context accumulation is the single largest source of cost bloat and quality degradation in AI agent systems, with sessions growing to 2.9MB+ after ~35 messages. Priority: **MUST**.

**Task Dispatch Payload Schema:**

```yaml
# Task Dispatch Payload — sent from Orchestrator to Subagent
task:
  id: "task-{phase}-{plan}-{sequence}"      # e.g., "task-execute-02-03"
  type: "research|specify|plan|execute|verify|optimize"
  description: "Human-readable task summary"
  
context:
  constitution: "path/to/constitution.md"    # Always included
  project_context: "path/to/project-context.md"  # Always included
  plan_file: "path/to/plan.md"              # Phase-specific
  relevant_files:                            # Curated file list
    - "src/auth/login.ts"
    - "src/auth/login.test.ts"
  squad_agent: "path/to/agent-definition.md" # If Squad active
  memory_feedback: "path/to/relevant-feedback.json"  # If exists
  
constraints:
  max_tokens: 20000                          # Hard limit per NFR-02
  model_profile: "quality|balanced|budget"
  time_budget_minutes: 5                     # For AutoResearch
  budget_remaining_usd: 2.50                 # From Budget Guards
  
output:
  format: "markdown|json|code"
  destination: "path/to/output/"
  commit_format: "type(phase-plan): description"
```

**FR-303 — Context and Cost Monitor.** In CLI environments, the framework MUST display real-time context usage in the status bar with WARNING (>50% usage) and CRITICAL (>75% usage) alerts. Additionally, the monitor SHOULD display: estimated cost of the current phase, accumulated cost of the current milestone, and a comparison showing what the same operation would cost with an alternative model profile. Priority: **SHOULD**.

**FR-304 — Document Sharding.** Any spec, plan, or PRD exceeding 500 lines MUST be automatically sharded into atomic files organized by epic/section, with an `index.md` providing navigation. Target: ~90% token savings per agent load vs. monolithic documents. Priority: **MUST**.

### 4.2 Engine Layer

#### 4.2.1 Phase 0 — Quick Flow (FR-400 Series)

**FR-401 — Quick Command.** `/bp:quick <description>` MUST bypass all ceremony and execute: minimal spec generation → execution → atomic commit in under 5 minutes for bugs, small features, and configuration changes. Priority: **MUST**.

**FR-402 — Quick Discuss Flag.** `/bp:quick --discuss` MUST optionally gather lightweight context before execution (3–5 targeted questions) without entering the full planning pipeline. Priority: **SHOULD**.

**FR-403 — Quick Full Flag.** `/bp:quick --full` MUST add plan-checking and verification steps to the quick flow for higher-risk ad-hoc tasks. Priority: **SHOULD**.

#### 4.2.2 Phase 1 — Specify (FR-500 Series)

**FR-501 — Natural Language Input.** `/bp:specify` MUST capture requirements in plain natural language. Technical implementation details MUST be explicitly prohibited at this stage. For beginner users, MUST use guided sequential questions (wizard mode). Priority: **MUST**.

**FR-502 — Spec Output.** The command MUST generate `spec.md` containing: user stories with acceptance criteria, functional requirements, non-functional requirements, assumptions, and a self-assessment against the Constitution. Priority: **MUST**.

**FR-503 — Clarification Flow.** `/bp:specify` MUST offer clarification questions when ambiguities are detected, presenting a minimum of 3 numbered options per detected ambiguity rather than requiring free-text answers. An "Other (free text)" option MUST always be included as the final choice. Priority: **SHOULD**.

**FR-504a — Domain Awareness (Framework → Spec Author).** When a Squad is active, the specify phase MUST inject domain-specific question templates into the `/bp:specify` workflow for the spec author (Persona B or D). These templates capture domain constraints from the person creating the spec (e.g., when using a Medical Marketing Squad: target specialty, CFM compliance scope, geographic service area). Priority: **MUST**.

**FR-504b — Domain Awareness (Squad → End-User).** Squad agent definitions MAY include domain-specific conversational question flows for end-users (Persona A). These flows are a Squad responsibility defined in Squad templates, not a framework core requirement. The framework MUST support Squad-defined question flows in Web Bundle mode. Priority: **MUST**.

**FR-505 — Automation Maturity Advisor.** During the Specify phase, the framework SHOULD evaluate the task against a 5-stage automation maturity model: (1) Manual — task is new, user is still learning the process; (2) Documented Skill — task has been done 2–3 times, steps are known and captured in a skill template; (3) Alias/Shortcut — task is weekly, a quick command reduces friction; (4) Heartbeat Check — task is sometimes forgotten, a periodic reminder ensures execution; (5) Full Automation — task is 100% predictable with zero human decision needed, suitable for cron/pipeline. The advisor MUST recommend the appropriate maturity stage based on: task frequency, predictability, human decision requirements, and a cost-benefit heuristic (time saved per year > 3x time to automate). For Persona A (non-developers), the advisor prevents over-engineering by defaulting to stage 2–3 unless the task clearly qualifies for full automation. Inspired by OpenClaw's Automation Maturity framework. Priority: **SHOULD**.

#### 4.2.3 Phase 2 — Plan (FR-600 Series)

**FR-601 — Automated Research.** `/bp:plan` MUST spawn parallel research agents to investigate the domain, technology stack, and existing codebase (if applicable) before generating the plan. Priority: **SHOULD**.

**FR-602 — Wave Analysis.** The planner MUST analyze task dependencies and group them into execution waves: independent tasks run in parallel within a wave; waves execute sequentially. Vertical slices MUST be preferred over horizontal layers. Priority: **MUST**.

**FR-603 — Atomic Plans.** Each plan file MUST contain a maximum of 2–3 tasks to keep context focused. Plans exceeding this limit MUST be automatically split. Priority: **MUST**.

**FR-604 — Model Profiles with Operation-Level Routing and Failover Chains.** Users MUST be able to configure quality/balanced/budget profiles assigning different models to different pipeline phases (e.g., Opus for planning, Sonnet for execution, Haiku for research). Beyond phase-level routing, the system SHOULD support operation-level granularity: within a single phase, different operation types (domain research, dependency analysis, code generation, test writing) MAY route to different models. Real-world data from OpenClaw token optimization shows that operation-level routing achieves 10x cost reduction for 80% of work without quality loss. Each model profile MUST include a failover chain specifying fallback models when the primary is unavailable (rate-limited, down, or over budget). The chain MUST define: ordered model sequence, retry delays between attempts (e.g., 1m → 5m → 1h), and maximum wait before escalating to the next model in the chain. Priority: **SHOULD**.

**Model Profile Configuration Schema:**

```yaml
# .buildpact/config.yaml — model profiles section
model_profiles:
  quality:
    planning: "claude-opus-4"
    execution: "claude-sonnet-4"
    research: "claude-haiku-4"
    verification: "claude-opus-4"
    failover_chain:
      - model: "claude-opus-4"
        retry_delays: ["1m", "5m"]
      - model: "claude-sonnet-4"
        retry_delays: ["1m"]
      - model: "gemini-2.5-pro"
        retry_delays: ["5m", "1h"]
  balanced:
    planning: "claude-sonnet-4"
    execution: "claude-sonnet-4"
    research: "claude-haiku-4"
    verification: "claude-sonnet-4"
  budget:
    planning: "claude-haiku-4"
    execution: "claude-haiku-4"
    research: "claude-haiku-4"
    verification: "claude-sonnet-4"
```

**FR-605 — Nyquist Validation with Multi-Perspective Analysis.** Before execution, all plans MUST pass through a quality validation layer (inspired by GSD's Nyquist auditor) that checks for: completeness vs. spec, internal consistency, dependency correctness, and feasibility. The validation MUST use a multi-perspective analysis pattern: the plan is evaluated by 3–4 independent analysis perspectives running in parallel without mutual influence, each focused on a different concern: (a) Completeness — does the plan cover all spec requirements? (b) Risk — what could fail, and are there mitigation strategies? (c) Efficiency — is the task decomposition optimal, or is there unnecessary complexity? (d) Domain Compliance — does the plan respect Constitution rules and domain-specific constraints (CFM, LGPD, etc.)? A synthesizer then consolidates findings, eliminates duplicates, and produces a prioritized validation report. Priority: **SHOULD**.

**FR-606 — Non-Software Plans.** For non-software domains, plans MUST clearly distinguish between human actions and AI agent actions, with checklists for human steps and automated execution for agent steps. Priority: **MUST**.

#### 4.2.4 Phase 3 — Execute (FR-700 Series)

**FR-701 — Wave Execution.** `/bp:execute` MUST execute plans in waves with subagent isolation. Each subagent receives a clean context window with only the relevant plan, task files, and necessary codebase context. Priority: **MUST**.

**FR-702 — Atomic Commits.** Each completed task MUST produce exactly one Git commit with a standardized format: `type(phase-plan): description` (e.g., `feat(02-03): create login endpoint`). Priority: **MUST**.

**FR-703 — Recovery System.** If a task fails, the system MUST: (a) track the failure, (b) attempt up to 3 different approaches automatically, (c) detect stuck loops, (d) rollback to the last functional state, (e) escalate to the user only after exhausting automated options. Priority: **MUST**.

**FR-704 — Goal-Backward Verification.** After each wave, the system MUST generate a pass/fail report for each spec acceptance criterion relevant to the completed wave. A 100% pass rate is required before the wave is marked complete; failed criteria MUST block progression to the next wave and trigger a fix plan (see FR-802). Verification proceeds backward from goal (spec) to code, not forward from code to spec. Priority: **SHOULD**.

**FR-705 — Budget Guards.** The framework MUST allow users to configure spending limits at three levels: maximum cost per session, maximum cost per phase, and maximum cost per day. When a limit is reached, the system MUST pause execution, notify the user with a clear cost summary, and offer options: (a) increase the limit, (b) switch to a cheaper model profile, or (c) abort the phase with state preserved. This is critical for Persona B (solo developers with personal API budgets), Persona C (Tech Leads managing team API costs), and Persona D (Squad creators running optimization loops). Persona A end-users are not exposed to API costs as they use Web Bundles in web interfaces with their own chat subscriptions. Documented cases show individual automation loops burning $200+ in a single day without user awareness. Priority: **MUST**.

**Budget Guards Configuration Schema:**

```yaml
# .buildpact/config.yaml — budget section
budget:
  limits:
    per_session_usd: 5.00        # Default for Beginner
    per_phase_usd: 10.00         # Default for Intermediate
    per_day_usd: 25.00           # Default for all levels
  alerts:
    warn_at_percent: 70          # Yellow warning
    critical_at_percent: 90      # Red warning before pause
  on_limit_reached: "pause"      # pause | switch_profile | ask_user
  default_fallback_profile: "budget"
```

#### 4.2.5 Phase 4 — Verify + Learn (FR-800 Series)

**FR-801 — Guided UAT.** `/bp:verify` MUST walk the user through a structured acceptance test based on the spec's acceptance criteria, generating a pass/fail report per criterion. Priority: **MUST**.

**FR-802 — Fix Plan Generation.** Failed verification items MUST automatically generate fix plans that can be executed via `/bp:execute` without re-running the full pipeline. Priority: **SHOULD**.

**FR-803 — Memory Layer with Structured Feedback Loops.** After verification, the system MUST automatically capture insights (what worked), patterns (reusable approaches), and decisions (architectural choices) in `.buildpact/memory/`. This memory MUST be loaded in subsequent sessions to improve planning quality. Priority: **MUST**.

The Memory Layer implements a structured feedback loop system with progressive tiers:

**Tier 1 — Feedback Files (v1.0, MUST):** Granular JSON files stored per domain (e.g., `memory/feedback/content.json`, `memory/feedback/tasks.json`). Each entry records: date, context of the suggestion, user decision (approve/reject), reason for the decision, and tags. Maximum 30 entries per file using FIFO (oldest removed when limit reached). The 30-entry limit is configurable via `config.yaml` (`memory.feedback_max_entries`). Agents MUST consult relevant feedback files before making suggestions to avoid repeating rejected patterns.

**Tier 2 — Lessons Files (v1.1, SHOULD):** Curated prose extracted from feedback patterns, stored in `memory/lessons/`. These capture higher-order patterns (e.g., "user prefers short-form content over long threads"). Consolidation trigger: automated monthly via `/bp:memory consolidate` command, or manually at any time. The consolidation agent analyzes feedback entries, identifies patterns with 3+ occurrences, and drafts lesson entries for user approval.

**Tier 3 — Decisions Files (v1.1, SHOULD):** Permanent policy rules consolidated from lessons into `memory/decisions/`. These become quasi-constitutional rules that persist indefinitely. Promotion from Lesson to Decision requires explicit user confirmation.

**Memory Layer Lifecycle:**

```
     ┌──────────────────────────────────────────────────────────┐
     │                    MEMORY LIFECYCLE                       │
     │                                                          │
     │  User approves/rejects    Monthly consolidation          │
     │  agent suggestion         (auto or manual)               │
     │        │                        │                        │
     │        ▼                        ▼                        │
     │  ┌──────────┐  patterns   ┌─────────┐  policy   ┌──────────┐
     │  │ Feedback  │───3+ hits──►│ Lessons │───user────►│Decisions │
     │  │ (JSON)    │            │ (prose) │  confirms  │ (policy) │
     │  │ max 30    │            │ monthly │            │permanent │
     │  │ FIFO      │            │ curated │            │          │
     │  └──────────┘            └─────────┘            └──────────┘
     │    v1.0 MUST               v1.1 SHOULD           v1.1 SHOULD
     └──────────────────────────────────────────────────────────┘
```

**FR-804 — Memory Layer Free.** The Memory Layer MUST be included in the open-source core at no cost. It MUST NOT be gated behind a paid tier. Priority: **MUST**.

### 4.3 Domain Layer (Squads)

#### 4.3.1 Squad Architecture (FR-900 Series)

**FR-901 — 4-Tier Hierarchy.** Each Squad MUST follow the hierarchy: Tier 0 (Chief/Orchestrator) → Tier 1 (Masters/Primary Specialists) → Tier 2 (Specialists/Niche Experts) → Tier 3 (Support/Utilities). Priority: **MUST**.

**Squad Hierarchy Diagram:**

```
┌─────────────────────────────────────────────────────────┐
│                     SQUAD STRUCTURE                       │
│                                                          │
│  Tier 0 ─── Chief ──────────────────────────────────     │
│              │  Routes tasks, maintains coherence         │
│              │  Always loaded in context                  │
│              │                                            │
│  Tier 1 ─── ├── Master A (e.g., PM)                      │
│              ├── Master B (e.g., Architect)               │
│              │   Primary specialists, loaded on demand    │
│              │                                            │
│  Tier 2 ─── ├── Specialist A (e.g., QA)                  │
│              ├── Specialist B (e.g., Security)            │
│              │   Niche expertise, loaded on demand        │
│              │                                            │
│  Tier 3 ─── └── Support A (e.g., Tech Writer)            │
│                  Utility roles, loaded on demand          │
│                                                          │
│  Each agent: 6-layer anatomy (FR-902)                    │
│  Each agent: Autonomy level L1-L4 (FR-907)              │
└─────────────────────────────────────────────────────────┘
```

**FR-902 — 6-Layer Agent Anatomy.** Each agent MUST define 6 layers: identity (name, id, tier, initial autonomy level), persona (role, communication style), voice_dna (vocabulary patterns, sentence starters, anti-patterns — see FR-903 for mandatory template), heuristics (IF/THEN decision rules with veto conditions), examples (concrete input/output pairs, minimum 3), and handoffs (delegation rules to other agents). Priority: **MUST**.

**Agent Definition Schema:**

```yaml
# Squad Agent Definition Template
agent:
  # Layer 1: Identity
  identity:
    name: "Strategic Planner"
    id: "strategist-01"
    tier: 1                    # 0=Chief, 1=Master, 2=Specialist, 3=Support
    autonomy_level: "L2"       # L1=Observer, L2=Contributor, L3=Operator, L4=Trusted
    version: "1.0.0"
  
  # Layer 2: Persona
  persona:
    role: "Marketing Strategy Lead"
    communication_style: "Direct, data-driven, challenges assumptions"
    language: "pt-br"          # Primary operating language
  
  # Layer 3: Voice DNA (5-section template — see FR-903)
  voice_dna:
    personality_anchors: [...]
    opinion_stance: "..."
    anti_patterns: [...]       # Min 5 ✘/✔ pairs
    never_do_rules: [...]
    inspirational_anchors: [...]
  
  # Layer 4: Heuristics
  heuristics:
    rules:
      - condition: "IF target audience includes minors"
        action: "THEN escalate CFM compliance check to L1 review"
        veto: true             # Can block pipeline progression
    
  # Layer 5: Examples
  examples:                    # Minimum 3 input/output pairs
    - input: "Create content for laser eye surgery promotion"
      output: "..."
      reasoning: "CFM prohibits before/after photos..."
    
  # Layer 6: Handoffs
  handoffs:
    - to: "compliance-checker"
      condition: "Any content mentioning procedures, pricing, or guarantees"
    - to: "copywriter-01"
      condition: "Strategy approved, ready for content creation"
```

**FR-903 — Voice DNA System with Mandatory 5-Section Template.** Voice DNA MUST enable cloning of real-specialist communication styles. Every Voice DNA definition MUST follow a mandatory 5-section template:

1. **Personality Anchors** — 3–5 core behavioral traits expressed as actionable statements (e.g., "Proactive, not reactive. Anticipates problems, suggests solutions.").
2. **Opinion Stance** — explicit declaration that the agent has preferences, can disagree, and is not neutral. Includes domain-specific opinion examples.
3. **Anti-Patterns with Concrete Examples** — paired ✘/✔ examples showing what the agent NEVER does vs. what it ALWAYS does. Minimum 5 pairs per agent. Includes forbidden phrases and red-flag patterns.
4. **"Never Do" Rules** — explicit prohibitions with no ambiguity (e.g., "Never respond with 'I don't know.' Always investigate or ask for more context.").
5. **Inspirational Anchors** — reference personas or archetypes that calibrate the agent's tone (e.g., "Speak like a seasoned COO, never like a FAQ bot.").

Documentation MUST include a step-by-step Voice DNA creation guide that walks users through analyzing 50+ pieces of existing content to extract vocabulary patterns, sentence structures, hooks, and anti-patterns. Inspired by OpenClaw's SOUL.md pattern. Priority: **MUST**.

**FR-904 — Squad Installation.** `npx buildpact squad add <n>` MUST install a Squad from the community hub or a local path. `npx buildpact squad create <n>` MUST scaffold a new Squad with all required files. Priority: **MUST**.

**FR-905 — Squad Validation.** `/bp:squad validate` MUST check: structural completeness (all 6 layers for all agents), Voice DNA consistency (5-section template compliance), heuristic coverage, example quality (minimum 3 per agent), and handoff graph validity. Priority: **MUST**.

**FR-906 — Lazy Agent Loading.** In Agent Mode (v2.0), Squad agents MUST NOT all be loaded into context simultaneously. The system MUST use a Lazy Loading pattern: only the Chief agent definition and a lightweight agent index (≤1KB) are loaded initially. Specialist agents are loaded into context on-demand when triggered by a handoff from the Chief or another agent. After a specialist completes its task, its definition is unloaded from active context. In Prompt Mode (v1.0), agent loading is managed by the host IDE's context window; the framework MUST provide documented guidance on manual agent loading best practices (e.g., "load only the agent file relevant to your current task") as part of the Squad usage documentation. Priority: **SHOULD**.

**FR-907 — Agent Autonomy Leveling System (L1–L4).** Each agent within a Squad MUST have an autonomy level independent of its tier (role). The leveling system defines four levels:

- **L1 (Observer)** — agent output is always reviewed by the user before any action; read-only by default.
- **L2 (Contributor)** — agent executes simple tasks but requests confirmation before changes; user reviews after.
- **L3 (Operator)** — agent has partial autonomy; executes without asking but user reviews periodically.
- **L4 (Trusted)** — full autonomy; user trusts the output completely.

New agents MUST start at L1 or L2. Promotion rules: after a configurable review period (default: 7 days), if the agent's approve/reject ratio in the feedback loop (FR-803) exceeds 85% approval, the system SHOULD suggest promotion. Demotion rules: if an agent's rejection rate exceeds 30% in a rolling 7-day window, the system MUST suggest demotion and explain why. Inspired by the Kevin Simback leveling system documented in OpenClaw's multi-agent architecture. Priority: **SHOULD**.

#### 4.3.2 Pre-Built Squads (FR-1000 Series)

The framework ships with one public open-source Squad included in the core distribution. Additional domain-specific Squads are developed as private extensions by the founding team for internal use:

**FR-1001 — Software Squad (Alpha, Public).** PM, Architect, Developer, QA, Tech Writer. Based on BMAD v6 agent profiles with GSD execution patterns. This is the only Squad included in the open-source distribution. It serves as both the default Squad and the reference implementation for community-created Squads. Priority: **MUST**.

**FR-1002 — Medical Marketing Squad (Private).** Strategist, Copywriter (with Voice DNA for regulatory CFM tone), Designer, Analytics. Includes CFM nº 1.974/2011 compliance checklists, ANVISA reference rules, WhatsApp CTA templates, and Schema JSON-LD medical templates. Developed for internal use by the founding team; not included in the open-source distribution. Priority: **MUST**.

**FR-1003 — Scientific Research Squad (Private).** Research Lead, Literature Reviewer, Data Analyst, Peer Reviewer, LaTeX Writer. Includes systematic review protocols, PRISMA checklists, statistical analysis plan templates. Developed for internal use; not distributed. Priority: **SHOULD**.

**FR-1004 — Clinic Management Squad (Private).** Operations Manager, Finance Analyst, Compliance Checker, Patient Flow Optimizer. Internal use only. Priority: **SHOULD**.

**FR-1005 — Agent Builder Squad (Public).** Agent Designer, Workflow Architect, Tester. Enables meta-creation of new Squads. This Squad SHOULD be included in the open-source distribution as it directly enables community Squad creation by Persona D. Priority: **SHOULD**.

#### 4.3.3 Community Hub (FR-1100 Series)

**FR-1101 — Public Hub Repository.** A dedicated GitHub repository (`buildpact-squads`) MUST serve as the community hub for discovering, sharing, and installing community-created Squads. All Squads in the hub are free and open source under MIT license. The Software Squad (FR-1001) serves as the canonical example for community contributors. Priority: **SHOULD**.

**FR-1102 — Contribution Flow.** Contributors MUST be able to: fork, create a Squad, validate locally, and submit a Pull Request. Automated CI MUST run Squad validation (including 5-section Voice DNA template compliance) on all PRs. Priority: **SHOULD**.

**FR-1103 — Squad Security Review.** All community-submitted Squads MUST pass automated security checks before acceptance: (a) no external URL references in agent definitions, (b) no executable code in YAML/Markdown files, (c) heuristic rules must not reference file system paths outside `.buildpact/`, (d) Voice DNA must not contain prompt injection patterns. Maintainers MUST manually review Squads flagged by automated checks before merge. Priority: **MUST**.

### 4.4 Autonomous Optimization Layer (AutoResearch Pattern)

Inspired by Andrej Karpathy's AutoResearch (github.com/karpathy/autoresearch, 32K★ in 7 days, March 2026), the framework incorporates an autonomous experimentation loop as a first-class architectural component. The core insight: instead of producing outputs once and declaring them finished, the framework can iteratively refine any artifact — code, copy, configurations, or agent definitions — through a modify-execute-measure-keep/revert cycle that runs unattended.

The AutoResearch Pattern is defined by four invariants: (1) a `program.md` file written in natural language that defines the optimization goal, constraints, and suggested experiments; (2) a single target file that the agent modifies iteratively; (3) a metric function that returns a numeric score after each experiment; and (4) a Git-based ratchet where only improvements are committed, and failures are reverted.

#### 4.4.1 Core Requirements (FR-1200 Series)

**FR-1201 — AutoResearch Command.** The command `/bp:optimize` MUST launch an autonomous experimentation loop on a specified target file with a defined metric. The command accepts: target file path, metric command or script, time budget (default: 30 minutes), maximum experiments (default: 50), and model profile. Available at Expert level. Priority: **MUST**.

**FR-1202 — Program File.** Each optimization session MUST be governed by a `program.md` file that defines: the optimization goal in natural language, constraints the agent must respect, suggested experiment directions, and acceptance criteria for keeping changes. Priority: **MUST**.

**FR-1203 — Fixed-Budget Experiments.** Each individual experiment within the loop MUST execute within a fixed time budget (configurable, default: 5 minutes). The total optimization session has its own budget (default: 30 minutes, configurable up to 24 hours for overnight runs). Priority: **MUST**.

**FR-1204 — Git Ratchet Mechanism.** After each experiment, the system MUST: (a) run the metric function, (b) compare the result to the current best, (c) if improved: commit the change with a standardized message (`optimize(N): description | metric: X.XX → Y.YY`), (d) if equal or worse: git-revert to the last successful state. Priority: **MUST**.

**FR-1205 — Target File Size Constraint.** Any file targeted for AutoResearch optimization MUST be under 600 lines. Files exceeding this limit MUST be sharded before optimization (leveraging FR-304 Document Sharding). Priority: **MUST**.

**FR-1206 — Budget Guard Integration.** The AutoResearch loop MUST respect the Budget Guards defined in FR-705. If the cost limit is reached during an optimization session, the loop MUST pause, preserve all results to date, and notify the user. Priority: **MUST**.

#### 4.4.2 Domain-Specific Metrics (FR-1300 Series)

**FR-1301 — Code Metrics.** For Software Squad: test pass rate, bundle size, Lighthouse score, build time, code coverage, type-check pass/fail. The metric script runs the tests/build and reports a numeric score. Priority: **MUST**.

**FR-1302 — Copy Metrics with Structured Evaluation Rubric.** For Marketing Squad: readability score (Flesch-Kincaid or equivalent for Portuguese via Gunning Fog adapted index), compliance check pass rate (CFM/ANVISA rules executed as deterministic checklist — not LLM-judged), keyword density, and CTA clarity score. The CTA clarity score uses a structured rubric with explicit criteria (action verb presence, benefit statement, urgency indicator, character count) evaluated deterministically. LLM-as-judge is used only for subjective tone evaluation, with a documented rubric of 5+ criteria, a 1–5 scale per criterion, and mandatory justification per score. To mitigate auto-evaluation circularity, the evaluator model MUST differ from the generator model. Priority: **SHOULD**.

**FR-1303 — Agent Metrics.** For Squad optimization: output quality score (LLM-as-judge against golden examples with documented rubric and model separation), Voice DNA consistency score (vocabulary adherence rate measured deterministically via keyword/pattern matching), heuristic coverage rate, and task completion rate across a benchmark set of 10+ test inputs. Priority: **SHOULD**.

**FR-1304 — Custom Metrics.** Users MUST be able to define custom metric scripts (any executable that returns a numeric score to stdout). This enables domain-specific optimization for any field. Priority: **MUST**.

#### 4.4.3 Self-Optimizing Squads (FR-1400 Series)

> **Scope note:** Self-Optimizing Squads are deferred to v2.0 to reduce scope pressure on v1.0. Code/copy-level AutoResearch ships in v1.0; Squad-level optimization follows in v2.0.

**FR-1401 — Squad AutoResearch Mode.** The command `/bp:optimize-squad <squad-name>` MUST launch an optimization loop that targets Squad agent definitions (Voice DNA, heuristics, examples) rather than project files. Priority: **SHOULD** (v2.0).

**FR-1402 — Benchmark Sets.** Each Squad SHOULD include a `benchmark/` directory containing at least 10 input-output pairs that represent ideal agent behavior. These golden examples serve as the metric function for Squad optimization. Priority: **SHOULD** (v2.0).

**FR-1403 — Optimization Isolation.** Squad optimization MUST occur on a dedicated Git branch (`optimize/{squad-name}/{timestamp}`). Only after human review and approval are optimized agent definitions merged into the main Squad configuration. Priority: **MUST**.

**FR-1404 — Optimization Report.** After an optimization session, the system MUST generate `optimization-report.md` containing: number of experiments run, improvements found, specific changes made to agent definitions, before/after metric comparison, and a diff of all kept modifications. Priority: **MUST**.

#### 4.4.4 File Structure for AutoResearch

- `.buildpact/optimize/{session-name}/program.md` — Human-written optimization directive
- `.buildpact/optimize/{session-name}/results.tsv` — Append-only experiment log
- `.buildpact/optimize/{session-name}/optimization-report.md` — Post-session summary
- `.buildpact/optimize/{session-name}/config.yaml` — Time budget, max experiments, model profile
- `.buildpact/squads/{domain}/benchmark/` — Golden input/output pairs for Squad optimization
- `.buildpact/squads/{domain}/optimization-history/` — Past optimization reports

---
## 5. Non-Functional Requirements

### 5.1 Performance

**NFR-01 — Installation Speed.** `npx buildpact init` MUST complete in under 60 seconds on a standard broadband connection. Priority: **MUST**.

**NFR-02 — Context Efficiency.** Orchestrator commands MUST consume less than 15% of the model's context window. Individual agent payloads MUST be under 20KB of text. Priority: **MUST**.

**NFR-03 — Token Savings.** Document Sharding MUST achieve at least 70% token reduction vs. monolithic document loading, as measured by token count comparison on the Software Squad benchmark set. The stretch target for v1.0 is 90% (matching BMAD's documented results). The 70% figure is the minimum acceptance criterion; the 90% figure is aspirational. Priority: **SHOULD**.

### 5.2 Usability

**NFR-04 — First-Value Time.** A beginner user MUST achieve first useful output (a completed spec) within 10 minutes of installation. Priority: **MUST**.

**NFR-05 — Bilingual Parity.** All user-facing text (CLI output, error messages, help text, templates, checklist items) MUST be available in both PT-BR and EN with equal quality. No language should feel like a translation of the other. Priority: **MUST**.

**NFR-06 — Zero Jargon in Beginner Mode.** In beginner mode, the framework MUST NOT use terms like: repository, branch, commit, YAML, merge, subagent, context window, orchestrator, or pipeline. All concepts MUST be expressed in domain-appropriate natural language. Priority: **MUST**.

### 5.3 Reliability

**NFR-07 — Recovery Resilience.** The Recovery System MUST handle: task failure (3 retry strategies), session interruption (state persisted to disk), context overflow (automatic subagent delegation), and network errors (graceful degradation with state preservation). Priority: **MUST**.

**NFR-08 — State Persistence.** All project state MUST be stored in human-readable files (Markdown + JSON + YAML) in the `.buildpact/` directory. No databases, no binary files, no external services. Priority: **MUST**.

### 5.4 Compatibility

**NFR-09 — Runtime Support.** Prompt Mode MUST support: Claude Code, Cursor Agent, Windsurf, Gemini CLI, Codex CLI, OpenCode, and web interfaces (Claude.ai, ChatGPT, Gemini). Agent Mode MUST support any environment with Node.js 18+. Priority: **MUST**.

**NFR-10 — OS Support.** The CLI MUST work on macOS (ARM64/x64), Linux (x64/ARM64), and Windows (x64) without platform-specific workarounds. Priority: **MUST**.

### 5.5 Extensibility

**NFR-11 — Squad Extensibility.** Any user MUST be able to create a custom Squad without modifying core framework code. Squad creation MUST require only YAML/Markdown files. Priority: **MUST**.

**NFR-12 — Agent-Agnostic Design.** The framework MUST NOT hard-code dependencies on any specific AI model or provider. Model profiles MUST support any provider accessible via the selected runtime. Priority: **MUST**.

### 5.6 Licensing and Legal

**NFR-13 — MIT License.** The entire core framework, the Software Squad, the Agent Builder Squad, and the community hub MUST be released under MIT license with no restrictive clauses (no Commons Clause, no SSPL, no BSL). Private Squads developed by the founding team (Medical Marketing, Scientific Research, Clinic Management) are excluded from the open-source distribution and are not subject to this requirement. Priority: **MUST**.

**NFR-14 — Attribution.** All components inspired by existing frameworks MUST include clear attribution in source comments and documentation, respecting the original projects' licenses. Priority: **MUST**.

### 5.7 Token Economy

**NFR-15 — Cache-Aware File Structure.** All framework files that are loaded repeatedly across subagent sessions (Constitution, project-context.md, agent definitions, Squad configs) MUST be structured for maximum prompt cache efficiency: static content at the top of each file, dynamic/session-specific content at the bottom. File ordering in context injection MUST be deterministic to maximize cache hit rates. Target: >80% cache hit rate on static content. Priority: **SHOULD**.

**NFR-16 — Token Budget Transparency.** The framework MUST provide, upon request, a breakdown of token consumption per component: orchestrator overhead, agent definitions loaded, spec/plan content, codebase context, and system prompt. The `/bp:token-audit` command SHOULD display this breakdown with actionable recommendations. Priority: **SHOULD**.

### 5.8 Developer Experience (DX) and Contribution

**NFR-17 — Contribution Architecture.** The repository MUST include: `CONTRIBUTING.md` with step-by-step setup instructions in both PT-BR and EN, a development environment that bootstraps with a single command (`npm run dev`), and a clear module boundary map showing which directories correspond to which architectural layers. Priority: **MUST**.

**NFR-18 — Code Review Standards.** All PRs MUST include: a description of which FR/NFR the change addresses, tests covering the changed behavior, and i18n strings for both languages if user-facing text is modified. A PR template MUST enforce this structure. Priority: **SHOULD**.

**NFR-19 — First-Contribution Path.** The repository SHOULD maintain a curated list of "good first issue" labels with clear scope, expected effort (< 2 hours), and mentor assignment. Target: 5+ good-first-issue tickets available at all times. Priority: **SHOULD**.

**NFR-20 — Architecture Decision Records (ADRs).** Significant architectural decisions MUST be documented as ADRs in `docs/decisions/` following the MADR template format. Priority: **SHOULD**.

**NFR-26 — Project Decision Log (DECISIONS.md + STATUS.md).** The project root MUST maintain two companion files designed for AI-assisted development continuity:

- **DECISIONS.md** — A compact, append-only log of every significant project decision. Each entry records: decision ID, date, what was decided, alternatives considered, rationale, and impact on the PRD. This file is NOT a narrative journal — it is a structured lookup table optimized for pasting into an AI context window to restore decision history. Maximum target: 200 lines. When the file approaches this limit, older entries that are fully reflected in the PRD or ADRs SHOULD be archived to `docs/decisions/archive/`.

- **STATUS.md** — A living document (overwritten, not appended) that captures the project's current state at any moment: current phase, what was last completed, what is blocked, and the prioritized list of next actions. This file answers the question "where did we leave off?" when starting a new AI-assisted session. Maximum target: 50 lines.

**Relationship to other artifacts:**
- DECISIONS.md captures *why* (rationale) — the PRD Revision History captures *what* (changes made).
- STATUS.md captures *now* (current state) — project-context.md captures *project configuration* (stack, squad, phase).
- ADRs (NFR-20) capture *architectural* decisions in full detail — DECISIONS.md captures *all* decisions in compact form including naming, scope, strategy, and process decisions that don't warrant a full ADR.

**Usage protocol:** At the start of every new AI-assisted session (Claude, Cursor, Gemini), the user SHOULD paste or reference both files to restore context. The framework's Web Bundle (FR-105) SHOULD include STATUS.md content automatically. Priority: **MUST**.

### 5.9 Security and Trust

**NFR-21 — Execution Sandboxing.** In Agent Mode (v2.0), all subagent-executed code MUST run within the host IDE's existing sandboxing mechanism. The framework MUST NOT bypass or weaken any IDE security controls. In Prompt Mode, execution is inherently sandboxed by the host (Claude Code's tool permissions, Cursor's approval flow, etc.). Priority: **MUST**.

**NFR-22 — Filesystem Permission Boundaries.** Squad agents and pipeline operations MUST NOT access files outside the project directory and `.buildpact/` directory unless explicitly granted via Constitution rules. Any file access outside these boundaries MUST require user confirmation. Priority: **MUST**.

**NFR-23 — Audit Trail.** All pipeline actions (spec generation, plan creation, code execution, commits, recovery attempts) MUST be logged to `.buildpact/audit/session-{timestamp}.log` with: timestamp, action type, agent responsible, files modified, and outcome (success/failure/rollback). Audit logs MUST be human-readable and MUST NOT be deleted by any automated process. Priority: **MUST**.

**NFR-24 — Community Squad Security.** Community-submitted Squads MUST be treated as untrusted input. The framework MUST validate Squad files against the security checks defined in FR-1103 before loading any community Squad into context. Users MUST receive a warning when installing a Squad that has not been reviewed by a maintainer. Priority: **MUST**.

**NFR-25 — Consent Model.** The framework MUST define clear consent boundaries per autonomy level (FR-907):

| Autonomy Level | Actions Requiring Consent | Actions Allowed Without Consent |
|----------------|--------------------------|-------------------------------|
| L1 (Observer) | All actions | Reading files, generating suggestions (displayed only) |
| L2 (Contributor) | File modifications, commits, external calls | Reading files, generating plans, running tests |
| L3 (Operator) | Destructive operations (delete, overwrite), external API calls | File modifications, commits, test execution, recovery |
| L4 (Trusted) | None (full autonomy) | All operations within project scope |

Regardless of autonomy level, the following actions ALWAYS require explicit user consent: (a) modifying the Constitution, (b) deleting audit logs, (c) spending above configured budget limits, (d) modifying Squad agent definitions outside of AutoResearch branches. Priority: **MUST**.

---

## 6. Technical Architecture

### 6.1 Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Package Manager | NPX (Node.js 18+) | Most accessible; used by BMAD, GSD, AIOX. No Python dependency. |
| CLI Framework | @clack/prompts | Modern TUI with spinners, multi-select, progress. Used by AIOX. |
| Agent Files | Markdown + YAML frontmatter | Human-readable; no compilation step. |
| State Management | Markdown + JSON on disk | Human-readable, Git-friendly, no external dependencies. |
| Agent Mode (v2.0) | TypeScript + Pi SDK (or equivalent) | Direct session control, crash recovery, multi-provider. Proven by GSD-2. |
| Testing | Vitest + Markdown snapshot tests | Fast, TypeScript-native, snapshot testing for generated artifacts. |
| CI/CD | GitHub Actions | Free for OSS, integrates with npm publish, Squad validation. |
| Documentation | VitePress (PT-BR + EN) | Fast, Vue-powered, native i18n support, Markdown-based. |

### 6.2 System Data Flow

**Pipeline Sequence Diagram:**

```
User          Orchestrator       Foundation        Subagent(s)       Git
 │                │                  │                  │              │
 │  /bp:specify   │                  │                  │              │
 │───────────────►│                  │                  │              │
 │                │  read config     │                  │              │
 │                │─────────────────►│                  │              │
 │                │  constitution +  │                  │              │
 │                │  project-context │                  │              │
 │                │◄─────────────────│                  │              │
 │                │                  │                  │              │
 │                │  dispatch Task() │                  │              │
 │                │  {specify payload}                  │              │
 │                │─────────────────────────────────────►              │
 │                │                  │                  │              │
 │                │                  │   read relevant  │              │
 │                │                  │◄─────────────────│              │
 │                │                  │   feedback files │              │
 │                │                  │─────────────────►│              │
 │                │                  │                  │              │
 │  clarification │                  │                  │              │
 │  questions     │                  │                  │              │
 │◄───────────────┼──────────────────┼──────────────────│              │
 │  answers       │                  │                  │              │
 │───────────────►│─────────────────────────────────────►              │
 │                │                  │                  │              │
 │                │                  │  write spec.md   │              │
 │                │                  │◄─────────────────│              │
 │                │                  │                  │              │
 │                │  validate vs     │                  │              │
 │                │  constitution    │                  │              │
 │                │─────────────────►│                  │              │
 │                │  validation OK   │                  │              │
 │                │◄─────────────────│                  │              │
 │                │                  │                  │              │
 │                │  log to audit    │                  │              │
 │                │─────────────────►│                  │              │
 │                │                  │                  │              │
 │  spec.md ready │                  │                  │              │
 │◄───────────────│                  │                  │              │
 │                │                  │                  │              │
 │  /bp:plan      │                  │                  │              │
 │───────────────►│                  │                  │              │
 │                │  dispatch Task() │                  │              │
 │                │  {plan payload + spec.md}           │              │
 │                │─────────────────────────────────────►              │
 │                │                  │                  │              │
 │                │                  │                  │  research    │
 │                │                  │                  │  (parallel)  │
 │                │                  │                  │              │
 │                │                  │  write plan files│              │
 │                │                  │◄─────────────────│              │
 │                │                  │                  │              │
 │                │  Nyquist validate│                  │              │
 │                │  (multi-perspective)                │              │
 │                │─────────────────────────────────────►              │
 │                │                  │                  │              │
 │  plan ready    │                  │                  │              │
 │◄───────────────│                  │                  │              │
 │                │                  │                  │              │
 │  /bp:execute   │                  │                  │              │
 │───────────────►│                  │                  │              │
 │                │  for each wave:  │                  │              │
 │                │  dispatch Task() │                  │              │
 │                │  {execute payload}                  │              │
 │                │─────────────────────────────────────►              │
 │                │                  │                  │              │
 │                │                  │                  │  commit      │
 │                │                  │                  │─────────────►│
 │                │                  │                  │              │
 │                │  wave complete   │                  │              │
 │                │  verify backward │                  │              │
 │                │─────────────────────────────────────►              │
 │                │                  │                  │              │
 │                │  budget check    │                  │              │
 │                │─────────────────►│                  │              │
 │                │                  │                  │              │
 │  execution done│                  │                  │              │
 │◄───────────────│                  │                  │              │
```

### 6.3 Extension Interface — Squad Plugin API

Squads integrate with the Engine through a well-defined contract:

**Squad Registration (at install time):**

```yaml
# .buildpact/squads/{domain}/squad.yaml — Squad manifest
squad:
  name: "Medical Marketing"
  version: "1.0.0"
  domain: "medical-marketing"
  language: "pt-br"
  
  agents:
    - id: "strategist-01"
      file: "agents/strategist.md"
      tier: 1
      initial_level: "L2"
    - id: "copywriter-01"
      file: "agents/copywriter.md"
      tier: 1
      initial_level: "L1"
      
  templates:
    specify: "templates/specify-questions.md"
    plan: "templates/plan-structure.md"
    verify: "templates/verification-checklist.md"
    
  compliance:
    rules_file: "data/compliance-rules.yaml"
    auto_check: true   # Run compliance check after every output
    
  hooks:
    on_specify_start: "hooks/inject-domain-questions.md"
    on_plan_complete: "hooks/validate-compliance.md"
    on_verify_complete: "hooks/generate-domain-report.md"
```

**Hook System:** Squads can inject behavior at 6 pipeline points: `on_specify_start`, `on_specify_complete`, `on_plan_complete`, `on_execute_start`, `on_execute_complete`, `on_verify_complete`. Each hook is a Markdown file containing instructions that the Orchestrator appends to the relevant subagent's context. Hooks MUST NOT exceed 2KB to preserve context budget.

### 6.4 File Schemas

**Constitution Schema:**

```markdown
# Project Constitution — [Project Name]

## Immutable Principles
<!-- Rules that NEVER change during the project lifecycle -->

### Coding Standards
- [e.g., TypeScript strict mode required]
- [e.g., No `any` types]

### Compliance Requirements
- [e.g., CFM nº 1.974/2011 — all marketing content]
- [e.g., LGPD — all patient data handling]

### Architectural Constraints
- [e.g., Monorepo with feature-based modules]
- [e.g., No direct database access from UI layer]

### Quality Gates
- [e.g., All PRs require passing tests]
- [e.g., Minimum 80% code coverage on new code]

## Domain-Specific Rules
<!-- Rules that apply when specific Squads are active -->
- [e.g., Medical Marketing: no before/after photos]

## Version History
| Date | Change | Reason |
|------|--------|--------|
```

**Project Context Schema:**

```yaml
# .buildpact/project-context.md
---
project_name: ""
created_at: ""
language: "pt-br"           # or "en"
experience_level: "beginner" # beginner|intermediate|expert
active_squad: "software"     # domain name
active_model_profile: "balanced"
---

## Current State
- Phase: specify              # quick|specify|plan|execute|verify
- Active feature: ""
- Open specs: []
- Open plans: []

## Technology Stack
<!-- Populated during setup or specify phase -->
- Framework: ""
- Language: ""
- Database: ""

## Team Context
<!-- Optional, for Persona C -->
- Team size: 1
- IDE standards: ["claude-code"]
```

### 6.5 File Structure

The following directory structure represents a fully configured project with one Squad installed:

```
# Project Root
DECISIONS.md                           # Compact decision log (append-only, ~200 lines max)
STATUS.md                              # Current state + next actions (overwritten, ~50 lines max)

.buildpact/
├── constitution.md                    # Immutable project rules
├── project-context.md                 # Current state (stack, squad, phase)
├── config.yaml                        # Language, IDE, level, model profiles, failover chains, budget
├── memory/
│   ├── feedback/
│   │   ├── content.json               # Feedback for content suggestions (approve/reject, max 30 FIFO)
│   │   ├── tasks.json                 # Feedback for task recommendations
│   │   └── recommendations.json       # Feedback for general suggestions
│   ├── lessons/                       # Monthly curated patterns (prose, from feedback)
│   └── decisions/                     # Permanent policy rules (from lessons)
├── audit/
│   └── session-{timestamp}.log        # Pipeline action audit trail
├── specs/{feature}/                   # Sharded specs and plans per feature
├── squads/{domain}/
│   ├── squad.yaml                     # Squad manifest
│   ├── agents/                        # Agent definition files (.md)
│   ├── templates/                     # Phase-specific templates
│   ├── data/                          # Domain knowledge, compliance rules
│   ├── hooks/                         # Pipeline hooks (.md)
│   ├── benchmark/                     # Golden examples for optimization
│   └── optimization-history/          # Past AutoResearch reports
├── optimize/{session}/
│   ├── program.md                     # Optimization directive
│   ├── results.tsv                    # Experiment log
│   ├── optimization-report.md         # Session summary
│   └── config.yaml                    # Session configuration
└── templates/                         # Core templates

# IDE Configuration (generated at install)
.claude/commands/buildpact/            # Claude Code slash commands
.cursor/rules/                         # Cursor rules
.gemini/                               # Gemini CLI config
CLAUDE.md / .cursorrules               # Agent context files
```

---

## 7. Security and Trust Model

### 7.1 Threat Model

The framework operates in a trust environment where:

- **The user is trusted** — they install the framework, configure it, and approve outputs.
- **The host IDE is trusted** — Claude Code, Cursor, etc., provide their own sandboxing.
- **AI model outputs are untrusted** — all generated code, plans, and content may contain errors.
- **Community Squads are untrusted** — third-party agent definitions may contain malicious instructions.
- **API costs are a risk vector** — runaway loops can cause unexpected charges.

### 7.2 Security Controls Summary

| Threat | Control | NFR Reference |
|--------|---------|---------------|
| Runaway API costs | Budget Guards (3-level limits) | FR-705, NFR-25 |
| Malicious community Squads | Automated security scan + manual review | FR-1103, NFR-24 |
| Unauthorized file access | Filesystem permission boundaries | NFR-22 |
| Untracked automated changes | Audit trail logging | NFR-23 |
| AI acting without consent | Autonomy leveling + consent model | FR-907, NFR-25 |
| Context injection via Squad | Squad file validation, no executable code in YAML | FR-1103 |
| Prompt injection in Web Bundle | Bundle generation is deterministic from source files; user-generated content is escaped | FR-105b |

### 7.3 Incident Response

If a user reports a security issue with a community Squad:

1. The Squad is immediately removed from the community hub (not from users who already installed it).
2. A security advisory is published with the Squad name, risk description, and remediation steps.
3. The `buildpact doctor` command (FR-103) SHOULD check installed Squads against a known-vulnerable list and warn users.

---

## 8. Testing Strategy

### 8.1 Testing Pyramid

| Layer | Type | Scope | Tooling | Target Coverage |
|-------|------|-------|---------|-----------------|
| Unit | Automated | Individual functions, parsers, validators | Vitest | >80% on core modules |
| Integration | Automated | Pipeline phase transitions, Squad loading, context injection | Vitest + fixtures | >60% on Engine layer |
| Snapshot | Automated | Generated spec/plan/commit outputs against golden files | Vitest snapshots | All core templates |
| Cross-IDE | Semi-automated | Same spec files produce equivalent outputs across IDEs | Custom test harness | Claude Code + Cursor (Alpha), 4+ IDEs (Beta) |
| End-to-End | Manual + scripted | Full pipeline from install to verify | Shell scripts + personas | 3 personas × 2 languages (Alpha) |
| Model Regression | Automated | Output quality when model version changes | Benchmark sets + metric scripts | Software Squad benchmark set |

### 8.2 Output Quality Testing

Testing the quality of AI-generated outputs (specs, plans, code) requires a different approach than traditional unit testing:

- **Golden File Comparison:** Each Squad's `benchmark/` directory contains ideal input-output pairs. After each framework release, the benchmark inputs are run through the pipeline and outputs are compared to golden files using a structured diff (not exact match — semantic similarity above threshold).
- **Metric-Based Regression:** For code outputs, metrics from FR-1301 (test pass rate, coverage, type-check) are run automatically. A regression is flagged if any metric degrades by more than 5% from the previous release.
- **Cross-IDE Consistency:** The same spec file is processed through Claude Code and Cursor, and the resulting plan files are compared for structural equivalence (same wave structure, same task count, same dependency graph).

### 8.3 Pre-Release Checklist

Before any release (Alpha, Beta, v1.0, v2.0), the following gates MUST pass:

- [ ] All unit and integration tests pass
- [ ] Snapshot tests are up to date
- [ ] Benchmark set runs without regressions
- [ ] Cross-IDE test passes on target IDEs for this release
- [ ] i18n completeness check passes (no missing PT-BR or EN strings)
- [ ] `buildpact doctor` passes on clean install (macOS, Linux, Windows)
- [ ] Persona A User Journey completes successfully via Web Bundle
- [ ] No P0/P1 bugs open
- [ ] Documentation for all shipped FRs is published in both languages
- [ ] CHANGELOG is updated
- [ ] ATTRIBUTION.md is current

---
## 9. Release Plan and Milestones

### 9.1 Phased Release Strategy

Each phase follows the Shape Up methodology with fixed time appetite (not estimate). If scope doesn't fit, scope is cut — not timeline extended.

| Phase | Timeline | Deliverables | Definition of Done | Shape Up Cut Line |
|-------|----------|-------------|-------------------|-------------------|
| **Alpha** | Month 1–2 | Foundation + Engine (Prompt Mode), Software Squad (public), Claude Code + Cursor support, PT-BR/EN, Web Bundle export | **FRs shipped:** FR-101, FR-102, FR-104, FR-105(a–c), FR-201, FR-202, FR-301, FR-302, FR-304, FR-401, FR-501, FR-502, FR-504, FR-602, FR-603, FR-606, FR-701, FR-702, FR-801, FR-901–905, FR-1001. **Quality gates:** 0 P0/P1 bugs; Persona B pipeline completes end-to-end (specify → plan → execute → verify) using the Software Squad; Web Bundle export functional and validated by Persona D using Claude.ai; docs for all shipped FRs in PT-BR + EN; 3 testers validate. *Note: Persona A (Dr. Ana) end-to-end journey deferred to Beta, pending Medical Marketing Squad (FR-1002).* | If Cursor doesn't fit, defer to Beta. If sharding doesn't fit, ship without it. |
| **Beta** | Month 3–4 | Medical Marketing Squad (private), 6+ IDE support, community hub scaffold, web bundles for Claude.ai/ChatGPT, Quick Flow, Agent Builder Squad scaffold | **FRs shipped:** +FR-103, FR-104 (6+ IDEs), FR-105(d–e), FR-402, FR-403, FR-503, FR-601, FR-705, FR-803 (Tier 1 only), FR-904, FR-1005 (scaffold), FR-1002, FR-1101. **Quality gates:** 0 P0/P1 bugs; Persona A (Dr. Ana) journey validates end-to-end using Medical Marketing Squad Web Bundle in Claude.ai; 10+ users across 2 domains; 1 community PR submitted; Budget Guards tested with real API costs. | If full Agent Builder doesn't fit, ship scaffold only. Quick Flow is must-have. |
| **v1.0** | Month 5–6 | Scientific Research Squad (private), Recovery System, Memory Layer Tier 1 (feedback), AutoResearch for code/copy, full documentation, GitHub Sponsors setup | **FRs shipped:** +FR-106, FR-203, FR-303, FR-505, FR-604, FR-605, FR-703, FR-704, FR-802, FR-803 (consolidation trigger), FR-907, FR-1003, FR-1102, FR-1103, FR-1201–1206, FR-1301, FR-1304, FR-1404. **Quality gates:** 0 P0/P1 bugs; <5 P2 bugs; 1,000+ stars; Software Squad in production use; full docs in both languages; Sponsors page live. | If Memory Tier 2+3 don't fit, ship Tier 1 only (feedback files). Self-Optimizing Squads deferred to v2.0. |
| **v2.0** | Month 7–12 | Agent Mode (TypeScript CLI), crash recovery, auto-advance, multi-provider, cost dashboard, Agent Leveling System, Self-Optimizing Squads via AutoResearch, Memory Layer Tier 2+3 | **FRs shipped:** +FR-906, FR-1004, FR-1302, FR-1303, FR-1401, FR-1402, FR-1403. **Quality gates:** 5,000+ stars; Agent Mode adoption by 20%+; all NFRs validated; community hub with 5+ Squads. | Core: context control + crash recovery + auto-advance. Dashboard and LSP deferred to v2.1. |

### 9.2 Squad Distribution Policy

The framework distinguishes between public Squads (included in the open-source distribution) and private Squads (developed by the founding team for internal use):

- **Public (open source):** Software Squad (FR-1001), Agent Builder Squad (FR-1005). These are included in the npm package and community hub.
- **Private (founding team only):** Medical Marketing Squad (FR-1002), Scientific Research Squad (FR-1003), Clinic Management Squad (FR-1004). These are developed using the same Squad architecture but are not published to the community hub or included in the distribution.

The Software Squad serves as the canonical reference implementation that community contributors use as a template for creating their own domain Squads. The Squad architecture (FR-900 series) is fully documented and open, enabling anyone to build Squads equivalent to or better than the private ones.

---

## 10. Risks and Mitigations

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R-01 | Scope creep from 4 framework synthesis | HIGH — delays all phases | HIGH | Shape Up appetite: cut scope, not timeline. Alpha = pipeline + Software Squad only. FR checklist per milestone (Section 9.1). |
| R-02 | IDE compatibility fragmentation | HIGH — broken installs | MEDIUM | Alpha ships Claude Code + Cursor only. Add IDEs incrementally with per-IDE test suites (Section 8.1). |
| R-03 | Bilingual maintenance burden | MEDIUM — stale translations | MEDIUM | All strings in i18n YAML files from day one. CI check for missing translations. NFR-18 enforces dual-language PRs. |
| R-04 | Attribution/legal issues from incorporating framework ideas | MEDIUM — reputation | LOW | Explicit attribution to all 4 frameworks + OpenClaw in README, ATTRIBUTION.md, and source comments. MIT license. |
| R-05 | Non-developers abandoning due to complexity | HIGH — misses key persona | HIGH | Weekly usability tests with Persona A during Alpha. Documented User Journey (Section 2.1.1). Automation Maturity Advisor (FR-505) prevents over-engineering. |
| R-06 | Pi SDK or equivalent becomes unavailable | MEDIUM — blocks Agent Mode | LOW | Agent Mode deferred to v2.0. Prompt Mode provides full value independently. Failover chains (FR-604) mitigate provider outages. |
| R-07 | Community adoption slower than projected in PT-BR | LOW — growth delay | MEDIUM | Leverage existing Brazilian AI/dev communities. Portuguese-first documentation. Target medical professionals through existing networks. |
| R-08 | AutoResearch loop produces degraded outputs | MEDIUM — quality and trust | MEDIUM | All sessions on dedicated Git branches. Human review required. Budget Guards prevent runaway costs. Agent Leveling (FR-907) demotes underperforming agents. |
| R-09 | ~~Framework name conflict with existing SpecFlow (.NET)~~ | ~~HIGH~~ → MITIGATED | ~~HIGH~~ → RESOLVED | ✅ Resolved: "BuildPact" selected. No conflicts with SpecFlow (.NET) or any other framework. Domains and npm verified clean. |
| R-10 | Malicious community Squad compromises user projects | HIGH — security, trust | LOW | Automated security scan (FR-1103), manual review gate, `doctor` command checks against vulnerability list (NFR-24). |
| R-11 | Model version changes degrade output quality | MEDIUM — inconsistent UX | MEDIUM | Benchmark sets per Squad, automated regression testing (Section 8.2), model profiles allow pinning specific versions. |
| R-12 | Single founder bottleneck | HIGH — project stalls | HIGH | Prioritize community onboarding (NFR-17, NFR-19). BDFL model transitioning to committee at 50+ contributors (OQ-04). Document all architecture decisions (NFR-20). |

---

## 11. Success Metrics and KPIs

### 11.1 Adoption Metrics

| Metric | 6 Month | 12 Month | Measurement | Pessimistic / Base / Optimistic |
|--------|---------|----------|-------------|-------------------------------|
| GitHub Stars | 1,000+ | 5,000+ | GitHub API | 500 / 1,000 / 2,500 at 6mo |
| NPM weekly downloads | 500+ | 2,000+ | npm stats | 200 / 500 / 1,200 at 6mo |
| Active Squads in community hub | 5+ | 15+ | GitHub repository count | 2 / 5 / 10 at 6mo |
| Non-developer active users | 50+ | 200+ | Survey + domain Squad usage | 10 / 50 / 100 at 6mo |
| PT-BR content/issues ratio | >30% | >40% | GitHub issues language analysis | 15% / 30% / 45% at 6mo |
| GitHub Sponsors (monthly) | $500+ | $2,000+ | GitHub Sponsors dashboard | $100 / $500 / $1,500 at 6mo |
| Contributors (unique) | 10+ | 30+ | GitHub contributor count | 5 / 10 / 20 at 6mo |

**Benchmark context:** SpecKit (~71K★) is backed by GitHub's distribution. GSD (~29K★) achieved growth via Claude Code's ecosystem. AIOX (~2.3K★) demonstrates that paid tiers limit adoption. These benchmarks inform the optimistic scenario but are not directly comparable to an independent bilingual framework.

### 11.2 Quality Metrics

| Metric | Target | Primary Persona | Measurement Method |
|--------|--------|-----------------|-------------------|
| First-Value Time (Beginner) | < 10 minutes from install to first completed spec | Persona A, B | Timed user session recording |
| Pipeline Completion Rate | > 80% of started pipelines reach verification without manual intervention | Persona B, C | Telemetry (opt-in) or manual tracking |
| Context Degradation Incidents | < 5% of execution phases trigger CRITICAL context alerts | Persona B, C | Context Monitor logs |
| Recovery System Success Rate | > 70% of automated recovery attempts resolve without user intervention | Persona B, C | Recovery System logs |
| Cross-IDE Consistency | Same spec files produce equivalent results across Claude Code, Cursor, and Gemini CLI | Persona C | Cross-IDE test suite (Section 8.1) |
| AutoResearch Improvement Rate | > 15% of experiments yield kept improvements | Persona B, D | AutoResearch results.tsv analysis |
| Web Bundle Adoption (Persona A) | > 60% of non-developer users access the framework exclusively via web bundles | Persona A | Survey + usage tracking |
| Agent Leveling Adoption | > 50% of active Squads have at least one agent promoted beyond L1 within 30 days | Persona C, D | Memory Layer feedback files |
| Feedback Loop Utilization | > 70% of active users have at least one feedback file with 10+ entries within 60 days | Persona B, C, D | Feedback file analysis |
| Automation Maturity Advisor Accuracy | > 80% of users agree with the recommended maturity stage in post-session surveys | Persona A, D | Post-session survey |
| Security Incidents from Community Squads | 0 confirmed incidents in first 12 months | All | Incident tracking |

---

## 12. Open Questions and Decisions Pending

The following architectural and strategic decisions require resolution before or during Alpha development:

| ID | Question | Criticality | Owner | Deadline | Decision Criteria | Fallback if Unresolved |
|----|----------|------------|-------|----------|-------------------|----------------------|
| OQ-01 | **Framework Name** — ✅ **RESOLVED: BuildPact.** Verified clean across npm, GitHub, .dev/.com domains, and software trademarks. No conflicts found. "Pacto" works natively in PT-BR; "Pact" is universal in EN. Differentiates from all competitors by being the only SDD framework without "spec" in the name. CLI prefix: `/bp:`. Directory: `.buildpact/`. | ~~CRITICAL~~ → RESOLVED | Leonardo | ~~Before Alpha~~ → Resolved 2026-03-14 | All 6 criteria met: (a) ✅ no trademark conflict, (b) ✅ buildpact.dev + .com available, (c) ✅ npm "buildpact" available, (d) ✅ bilingual, (e) ✅ "build" + "pact" conveys structured development, (f) ✅ memorable and distinct | N/A — resolved. |
| OQ-02 | **Pi SDK Dependency** — Should Agent Mode use Pi SDK or build a lightweight agent harness? | SHOULD — v2.0 blocker | Leonardo | Before v2.0 planning (Month 5) | (a) Maintenance burden, (b) community adoption of Pi SDK, (c) feature parity with custom harness | Build minimal custom harness; migrate to Pi SDK later if stable. |
| OQ-03 | **BMAD/AIOX Component Licensing** — AIOX uses MIT + Commons Clause. Can AIOX-inspired components be incorporated under pure MIT? | SHOULD — Pre-Alpha | Leonardo | Before Alpha | Legal review confirming clean-room implementation vs. derivative work | Rewrite all AIOX-inspired components from scratch. |
| OQ-04 | **Governance Model** — BDFL, committee, or foundation? | SHOULD — Post-v1.0 | Leonardo | Month 6 | Contributor count, diversity of contributions, community demand | Start BDFL, transition to committee at 50+ contributors. |
| OQ-05 | **Integration with Existing Tools** — Should the framework offer migration paths from SpecKit, BMAD, GSD, or AIOX? | SHOULD — Post-v1.0 | Community | Post-v1.0 | Community demand, technical feasibility | Defer to post-v1.0 unless community demand is strong. |

---

## 13. Appendices

### 13.1 Competitive Framework Summary

| Capability | SpecKit | BMAD | GSD | AIOX | BuildPact |
|-----------|---------|------|-----|------|-------------|
| Non-dev friendly | ✅ Partial | ❌ | ❌ | ❌ | ✅ Full |
| Multi-domain | ❌ Software | ⚠ Packs | ❌ Software | ✅ Squads | ✅ Squads |
| Context Eng. | ❌ | ⚠ Sharding | ✅ Best | ⚠ Partial | ✅ Full |
| Bilingual PT/EN | ❌ EN only | ❌ EN only | ❌ EN only | ✅ PT-BR | ✅ PT + EN |
| IDE Support | ✅ 20+ | ✅ 10+ | ⚠ 4–6 | ⚠ 4–6 | ✅ 10+ |
| Web Interface | ❌ | ✅ Bundles | ❌ | ❌ | ✅ Bundles |
| Agent Mode | ❌ | ❌ | ✅ GSD-2 | ❌ | ✅ v2.0 |
| Free Memory | ❌ N/A | ❌ N/A | ❌ N/A | ❌ Paid | ✅ Free |
| Token Economy | ❌ | ❌ | ⚠ Monitor | ❌ | ✅ Full |
| AutoResearch | ❌ | ❌ | ❌ | ❌ | ✅ Built-in |
| Agent Leveling | ❌ | ❌ | ❌ | ❌ | ✅ L1–L4 |
| Feedback Loops | ❌ | ❌ | ❌ | ⚠ Partial | ✅ 3-tier |
| Open Source (pure) | ✅ MIT | ✅ MIT | ✅ MIT | ⚠ MIT+CC | ✅ MIT |
| Sustainability | ❌ | ❌ | ❌ | ⚠ Paid tier | ✅ Sponsors |
| Security Model | ❌ | ❌ | ❌ | ❌ | ✅ Full |

### 13.2 Requirement Priority Summary (MoSCoW)

Conforming to ISO/IEC 29148:2018 traceability standards. Functional Requirements (FR) and Non-Functional Requirements (NFR) counted separately:

| Priority | FR Count | NFR Count | FR Examples |
|----------|----------|-----------|-------------|
| **MUST** | 44 | 17 | FR-101–105(a-c), FR-201–202, FR-301–302, FR-304, FR-401, FR-501–502, FR-504, FR-602–603, FR-606, FR-701–703, FR-705, FR-801, FR-803(T1), FR-804, FR-901–905, FR-1001–1002, FR-1103, FR-1201–1206, FR-1301, FR-1304, FR-1403–1404 |
| **SHOULD** | 24 | 6 | FR-103, FR-105(d-e), FR-106, FR-203, FR-303, FR-402–403, FR-503, FR-505, FR-601, FR-604–605, FR-704, FR-802, FR-803(T2-T3), FR-906–907, FR-1003–1005, FR-1101–1102, FR-1302–1303, FR-1401–1402 *(v2.0 scope)* |
| **COULD** | 0 | 0 | No COULD-priority items in current version |
| **WON'T (this version)** | 0 | 0 | Deferred items tracked in OQ section |

### 13.3 Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0-draft | 2026-03-14 | Dr. Leonardo Eloy Sousa | Initial PRD based on verified competitive analysis of SpecKit, BMAD, GSD, and AIOX frameworks. |
| 1.1.0-draft | 2026-03-14 | Dr. Leonardo Eloy Sousa | Added Token Economy requirements (NFR-15, NFR-16), Budget Guards (FR-705), Lazy Agent Loading (FR-906), expanded FR-302 with mandatory session reset, expanded FR-303 with cost tracking, expanded FR-604 with operation-level routing. |
| 1.2.0-draft | 2026-03-14 | Dr. Leonardo Eloy Sousa | Added AutoResearch Pattern as Section 4.4 with FR-1200 through FR-1404. Incorporates Karpathy's autonomous experimentation loop as core architectural component. |
| 1.3.0-draft | 2026-03-14 | Dr. Leonardo Eloy Sousa | Major revision: Sustainability model, revised Squad delivery sequence, Web Bundle elevated to MUST, structured evaluation rubric for copy metrics, Developer Experience section (NFR-17–20), Persona-to-Feature Traceability Matrix, MoSCoW priority summary, ISO/IEC 29148:2018 alignment. |
| 1.4.0-draft | 2026-03-14 | Dr. Leonardo Eloy Sousa | Incorporated 6 architectural patterns from OpenClaw production analysis. Revised Squad distribution policy. |
| 1.5.0-draft | 2026-03-14 | Dr. Leonardo Eloy Sousa | Final review pass with 10 corrections and improvements including FR-106 migration path. |
| **2.0.0-draft** | **2026-03-14** | **Dr. Leonardo Eloy Sousa + Claude (PM Review)** | **Major revision addressing 14 review findings:** (1) Expanded Section 6 Technical Architecture with data flow diagrams, sequence diagrams, Squad Plugin API, and file schemas. (2) Added Definition of Done per milestone with explicit FR checklists in Section 9.1. (3) Expanded FR-105 into 5 sub-requirements (FR-105a–e) covering token budgets, compression, conversational adaptation, versioning, and graceful degradation. (4) Added Persona A End-to-End User Journey with textual wireframe. (5) Added Section 7 Security and Trust Model with threat model, NFR-21–25. (6) Added Section 8 Testing Strategy with testing pyramid, output quality testing, and pre-release checklist. (7) Added Anti-Personas (Section 2.2). (8) Added pessimistic/base/optimistic scenarios to all KPIs. (9) Phased Memory Layer: Tier 1 MUST for v1.0, Tier 2+3 SHOULD for v1.1. (10) Moved Self-Optimizing Squads (FR-1401–1402) to v2.0 scope. (11) Added FR-1103 Squad Security Review. (12) Added owners, deadlines, and fallbacks to Open Questions. (13) Added Task Dispatch Payload Schema, Agent Definition Schema, Model Profile Schema, Budget Guards Schema. (14) Completed glossary with 7 additional terms. |
| **2.1.0-draft** | **2026-03-14** | **Dr. Leonardo Eloy Sousa** | **Naming decision resolved: BuildPact.** (1) Framework name finalized as "BuildPact" after competitive analysis across npm, GitHub, domain registrars, and trademark databases. (2) All placeholders replaced: `[Framework Name TBD]` → BuildPact, `.specflow/` → `.buildpact/`, `/sf:` → `/bp:`. (3) OQ-01 marked as RESOLVED. (4) R-09 (name conflict risk) marked as MITIGATED. (5) Community hub repository named `buildpact-squads`. (6) Domain strategy: buildpact.dev (primary) + buildpact.com. |
| **2.2.0-draft** | **2026-03-14** | **Dr. Leonardo Eloy Sousa** | **Added Project Decision Log system (NFR-26).** (1) New NFR-26 defining DECISIONS.md (compact append-only decision log, ~200 lines max) and STATUS.md (living current-state file, ~50 lines max) as MUST requirements. (2) Documented relationship to existing artifacts (PRD Revision History, ADRs, project-context.md). (3) Defined usage protocol for AI-assisted session continuity. (4) Updated file structure (Section 6.5) with DECISIONS.md and STATUS.md at project root. (5) Added 2 glossary terms. (6) Updated MoSCoW count (NFR MUST: 16 → 17). |
| **2.3.0-draft** | **2026-03-14** | **Dr. Leonardo Eloy Sousa + Claude (PM Review)** | **Persona model clarification and PRD structural fixes following BMAD validation.** (1) Added Section 1.5 Product Scope (MVP/Growth/Vision). (2) Added Section 2.1.0 Persona Interaction Levels — explicitly distinguishes framework users (B, C, D) from Squad output users (A). (3) Added End-to-End User Journeys for Personas B, C, and D (Persona D journey identified as the most critical missing artifact). (4) Corrected Persona A description, jobs-to-be-done, and success criteria to reflect Squad-mediated interaction. (5) Fixed Persona-to-Feature Traceability Matrix — Persona A's direct attributions replaced with N/A or Indirect/Receives. (6) Fixed FR-105 subject (Persona D creates Bundles, Persona A receives them). (7) Split FR-504 into FR-504a (framework → spec author) and FR-504b (Squad → end-user). (8) Corrected FR-705 Budget Guards persona attribution (removed Persona A). (9) Fixed FR-301 testability (references active model's context window). (10) Fixed FR-503 testability (minimum 3 numbered options). (11) Fixed FR-704 testability (100% pass rate criterion, blocks wave progression). (12) Fixed NFR-03 dual-target ambiguity (70% mandatory, 90% stretch). (13) Fixed FR-906 to document Prompt Mode behavior. (14) Fixed Section 3.3 Progressive Disclosure note re: Persona A. (15) Fixed Alpha DoD (removed incorrect Persona A gate, deferred to Beta). (16) Added Persona A journey gate to Beta DoD. (17) Added v2.0 scope tag to FR-1401–1402 in MoSCoW table. |

### 13.4 References

- IEEE 830-1998 — Recommended Practice for Software Requirements Specifications
- ISO/IEC 29148:2018 — Systems and software engineering — Life cycle processes — Requirements engineering
- Shape Up — Basecamp's product development methodology (Ryan Singer, 2019)
- github.com/github/spec-kit — SpecKit framework (Den Delimarsky, John Lam)
- github.com/bmad-code-org/BMAD-METHOD — BMAD framework v6 (Brian Madison / BMad Code, LLC)
- github.com/gsd-build/get-shit-done — GSD framework v1 (TÂCHES)
- github.com/gsd-build/gsd-2 — GSD-2 TypeScript agent (TÂCHES)
- github.com/SynkraAI/aiox-core — AIOX framework (SynkraAI)
- April Dunford, *Obviously Awesome* (2019) — Positioning methodology
- OpenClaw (Bruno Okamoto / Pixel Educação, 2026) — AI agent architecture patterns
- Kevin Simback — Agent Leveling System (L1–L4)
- OpenClaw Token Optimization Guide (ScaleUP Media / Matt Ganzak, 2026)
- github.com/karpathy/autoresearch — AutoResearch (Andrej Karpathy, March 2026)
- MADR — Markdown Any Decision Records (adr.github.io/madr/)
- OWASP — Prompt Injection prevention guidelines (referenced in Security Model)

### 13.5 Glossary

| Term | Definition |
|------|-----------|
| **Constitution** | An immutable Markdown file (`.buildpact/constitution.md`) defining project-wide rules, standards, and constraints that all pipeline phases must respect. |
| **Voice DNA** | A structured 5-section personality definition for Squad agents that enables cloning of real-specialist communication styles. Sections: Personality Anchors, Opinion Stance, Anti-Patterns, Never-Do Rules, Inspirational Anchors. |
| **Squad** | A domain-specific team of AI agents organized in a 4-tier hierarchy (Chief → Masters → Specialists → Support), each with Voice DNA, heuristics, and examples. |
| **Progressive Disclosure** | A UX pattern where the framework exposes different command sets (Beginner/Intermediate/Expert/Expert+) based on the user's declared experience level. |
| **Nyquist Validation** | A multi-perspective quality gate that evaluates plans from 3–4 independent analytical perspectives before execution. Named after the signal processing concept of minimum sampling frequency. |
| **Git Ratchet** | A mechanism where only improvements are committed and failures are reverted, ensuring monotonic quality improvement during AutoResearch optimization loops. |
| **Subagent Isolation** | The architectural constraint that every heavy computation task runs in a clean context window via Task() dispatch, preventing context accumulation bloat. |
| **Automation Maturity** | A 5-stage progression model (Manual → Documented Skill → Alias → Heartbeat Check → Full Automation) that guides users on when and whether to automate a task. |
| **Agent Leveling (L1–L4)** | An autonomy system where agents progress from Observer (L1) to Trusted (L4) based on feedback loop approval rates, independent of their tier (role). |
| **Feedback Loop** | A structured approve/reject system stored as JSON files (max 30 entries FIFO) that agents consult before making suggestions, preventing repeated mistakes. |
| **Memory Layer** | A 3-tier knowledge persistence system: Feedback (granular, JSON) → Lessons (curated, prose) → Decisions (permanent, policy), with monthly consolidation. |
| **Document Sharding** | Automatic splitting of large specs/plans (>500 lines) into atomic files organized by epic/section, achieving ~90% token savings per agent load. |
| **Failover Chain** | An ordered sequence of fallback models with retry delays, activated when the primary model is unavailable (rate-limited, down, or over budget). |
| **Web Bundle** | A single compressed prompt exported for use in web interfaces (Claude.ai, ChatGPT, Gemini) that contains all active commands, Constitution, and project context. |
| **Prompt Mode** | The v1.0 operational mode using Markdown templates and slash commands, compatible with any IDE and web interface. |
| **Agent Mode** | The v2.0 operational mode using a standalone TypeScript CLI with direct session control, crash recovery, and auto-advance. |
| **Wave** | A group of independent tasks that can execute in parallel within the Execute phase. Waves execute sequentially; tasks within a wave execute concurrently. |
| **Pipeline** | The full sequence of phases a feature passes through: Quick Flow (optional) → Specify → Plan → Execute → Verify + Learn. |
| **Atomic Commit** | A single Git commit produced by exactly one completed task, following the format `type(phase-plan): description`. |
| **Quick Flow** | A lightweight bypass of the full pipeline for bugs, small features, and configuration changes. Executes in under 5 minutes. |
| **Shape Up** | A product development methodology (Basecamp/Ryan Singer) using fixed time appetites. If scope exceeds appetite, scope is cut — not timeline extended. |
| **MoSCoW** | A prioritization framework: Must have, Should have, Could have, Won't have (this time). Used for FR/NFR priority classification. |
| **TUI** | Terminal User Interface — an interactive text-based interface in the terminal, used by the installer (FR-102). |
| **Task Dispatch** | The mechanism by which the Pipeline Orchestrator sends work to subagents. Each dispatch includes a structured payload (see FR-302 schema) and creates a clean context window. |
| **Decision Log (DECISIONS.md)** | A compact, append-only file at the project root recording every significant decision with ID, date, rationale, and alternatives considered. Optimized for pasting into AI context windows to restore decision history across sessions. Max ~200 lines; older entries archived when limit approaches. |
| **Status File (STATUS.md)** | A living, overwritten file at the project root capturing the project's current state: phase, last completed work, blockers, and prioritized next actions. Answers "where did we leave off?" at the start of each AI-assisted session. Max ~50 lines. |

---

*— End of Document —*
