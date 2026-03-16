# ADR-001 — AutoResearch Isolation via Dedicated Git Branch

**Status:** accepted
**Date:** 2026-03-16
**Deciders:** BuildPact core team

---

## Context and Problem Statement

AutoResearch (Epic 12) runs an autonomous experimentation loop that modifies source files, commits changes, and reverts failures. These operations are inherently destructive and must not contaminate the developer's working branch or main history. We need an isolation strategy that lets AutoResearch run experiments freely while guaranteeing that no partial or failed experiment reaches the project's primary branches.

## Decision Drivers

* Experiments may modify and revert the same file many times — this creates noisy commit history
* A failed experiment must be rolled back without affecting other in-flight work
* Human review must be required before any experiment result reaches `main`
* The isolation boundary must be machine-enforceable, not just a convention
* AutoResearch should integrate with the existing Git Ratchet pattern (`src/optimize/ratchet.ts`)

## Considered Options

* **Option A** — Isolated Git branch per session: `optimize/{target-type}/{session-name}/{timestamp}`
* **Option B** — Same branch as developer with stash/pop for each experiment
* **Option C** — Separate local clone of the repository for each session

## Decision Outcome

**Chosen option: Option A**, because a named branch per session provides full isolation with zero risk of polluting the developer's working state, is machine-enforceable by the ratchet module, preserves all experiment history for review, and requires an explicit `git merge` by a human before any result reaches `main`.

### Positive Consequences

* All experiment commits are isolated on `optimize/…` branches — main branch is never touched automatically
* Full diff of every experiment is reviewable before merge
* Multiple concurrent AutoResearch sessions are possible without conflict (different branch names)
* Git Ratchet can use `git reset --hard` freely without risk to the developer's work
* Branch naming convention encodes session metadata (target type, name, timestamp) for auditability

### Negative Consequences

* Developers must manually merge (or discard) the branch after reviewing results — no automation to main
* Over time, many `optimize/…` branches may accumulate; a periodic cleanup command is advisable
* Switching between an AutoResearch branch and a feature branch requires `git checkout` discipline

## Pros and Cons of the Options

### Option A — Isolated Git branch per session

* ✅ Zero contamination risk to `main` or any feature branch
* ✅ Full experiment history preserved and reviewable
* ✅ Machine-enforceable: ratchet creates branch at session start, never leaves it
* ✅ Compatible with existing `executeRollback` (git reset --hard) in recovery.ts
* ❌ Branch accumulation requires periodic cleanup
* ❌ Requires explicit human merge step to promote results

### Option B — Same branch with stash/pop

* ✅ No extra branch overhead
* ❌ Stash conflicts with uncommitted developer work — highly disruptive
* ❌ Any crash leaves the repository in an unknown state
* ❌ Cannot be made machine-enforceable — one bad `git stash pop` corrupts developer changes

### Option C — Separate local clone

* ✅ Absolute isolation — entirely separate working tree
* ❌ Disk overhead: full clone per session
* ❌ Complex cross-clone coordination for results inspection and merge
* ❌ Requires all tooling to know the clone path — breaks standard Git tooling assumptions

## Open Questions

1. **Cleanup policy**: How many `optimize/…` branches should be retained before automatic pruning? Initial recommendation: keep last 10 sessions per target type.
2. **Merge guidance**: Should `optimization-report.md` include a ready-made `git merge` command, or only the branch name?
3. **CI integration**: Should CI block `git merge optimize/…` branches that do not have an `optimization-report.md` attached?
4. **Concurrent sessions**: Should two AutoResearch sessions on the same target file be locked (mutex on target) or allowed to run in parallel on separate branches?

## Links

* Relates to [ADR-000 ESM + TypeScript + Result pattern](ADR-000-esm-typescript-result-pattern.md)
* Implements Epic 12 (US-051 through US-056) AutoResearch feature set
* Git Ratchet module: `src/optimize/ratchet.ts` (implemented in US-054)
* Recovery module: `src/engine/recovery.ts` — `executeRollback` reused by the ratchet
