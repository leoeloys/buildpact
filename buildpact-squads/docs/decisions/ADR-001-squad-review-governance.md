# ADR-001 — Squad Review Governance: Two-Stage Automated + Human Review

**Status:** accepted
**Date:** 2026-03-19
**Deciders:** BuildPact maintainers

---

## Context and Problem Statement

The BuildPact Community Squads repository accepts Squad contributions from external developers. Each Squad contains agent definition files that are executed inside a user's LLM session — making security and quality critical. We need to decide how contributed Squads are reviewed before the `reviewed` flag in `manifest.json` is set to `true`, which signals to end users that the Squad has been vetted.

## Decision Drivers

* **Low barrier to contribute** — contributors should not need to wait for a committee to validate basic structural correctness; automation reduces friction
* **Security trust model** — Squads execute as agent prompts inside user sessions; harmful content (prompt injection, executable code, external URL exfiltration) must be blocked before merge
* **Maintainer bandwidth** — the project is maintained by a small team; human review must be focused on quality and intent, not structural boilerplate
* **`reviewed` boolean in manifest** — the existing schema already encodes a two-tier signal: automated pass (`reviewed: false` can be installed with warning) vs. human-reviewed (`reviewed: true`)

## Considered Options

* **Option A** — Fully automated review (CI only, no human review required)
* **Option B** — Two-stage review: automated CI + maintainer human review
* **Option C** — Committee review (multiple maintainers must approve before any Squad merges)

## Decision Outcome

**Chosen option: Option B — Two-stage automated + human review**, because it balances security enforcement (automated CI catches structural and security violations immediately) with quality assurance (human review ensures Squad content is accurate, useful, and aligned with the domain) while keeping maintainer workload manageable.

### Positive Consequences

* Automated CI catches all mechanical violations (missing Voice DNA sections, security patterns, broken manifest schema) without maintainer involvement
* Human review is focused on content quality, domain accuracy, and community fit — not structure
* The `reviewed` boolean in `manifest.json` gives users a clear signal: `false` = automated-only pass, `true` = human-vetted
* Contributors get fast feedback from CI before waiting for human review
* Low-risk improvements (README fixes, typo corrections) can be merged faster if they don't touch agent files

### Negative Consequences

* Human review adds latency for new Squad contributions (target: 5 business days)
* Maintainers must stay familiar with multiple domains to provide meaningful review
* OQ-04 (BDFL vs. committee governance model for maintainer decisions) is deferred to Month 6 — until then, a single maintainer approving is sufficient

## Pros and Cons of the Options

### Option A — Fully automated review

* ✅ Zero latency after CI passes — instant merge for contributors
* ✅ No maintainer bandwidth required
* ❌ No human check on content quality, domain accuracy, or harmful-but-technically-valid prompts
* ❌ The `reviewed` signal in manifest.json would be meaningless — all Squads would claim full review

### Option B — Two-stage: automated CI + maintainer human review

* ✅ Automated CI handles structural validation immediately and consistently
* ✅ Human review adds a quality and trust layer that automation cannot provide
* ✅ Matches the existing `reviewed` boolean semantics in the manifest schema
* ✅ Maintainer effort is focused on intent and quality, not boilerplate
* ❌ Human review adds latency (5 business day target)
* ❌ Requires at least one maintainer familiar with the Squad's domain

### Option C — Committee review

* ✅ Higher confidence: multiple perspectives on each Squad
* ❌ Much higher latency — coordinating multiple reviewers for every Squad is impractical
* ❌ Unrealistic maintainer bandwidth requirement for an early-stage project
* ❌ Discourages contributions by creating a heavy approval process

## Links

* [Story 11-2: Squad Contribution Flow with Automated CI](../../_bmad-output/implementation-artifacts/11-2-squad-contribution-flow-with-automated-ci.md) — defines the automated CI workflow (`squad-validate.yml`)
* [Story 8-4: Squad Structural Validation](../../_bmad-output/implementation-artifacts/8-4-squad-structural-validation.md) — defines the security validators that CI enforces
* [OQ-04: BDFL vs. committee governance model](https://github.com/buildpact/buildpact/issues) — deferred to Month 6; interim model: single maintainer approval is sufficient
