# Story 12.0: AutoResearch Architecture Decision Record (ADR-001)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer implementing the AutoResearch feature,
I want ADR-001 to document the AutoResearch isolation architecture before any code is written,
so that all implementation decisions are grounded in a reviewed architectural decision rather than ad-hoc choices.

## Acceptance Criteria

1. **Given** Epic 12 implementation is about to begin, **When** ADR-001 is created, **Then** it documents in `docs/decisions/ADR-001-autoResearch-isolation.md`: the problem statement, considered alternatives (isolated branch vs. working copy vs. temp directory), the chosen approach (isolated Git branch), consequences, and open questions.

2. **Given** ADR-001 is drafted, **When** it is reviewed, **Then** it must be approved (via PR or explicit sign-off) before any Story 12.1+ implementation begins.

3. **Given** ADR-001 exists, **When** any AutoResearch implementation deviates from the documented approach, **Then** the ADR must be updated to reflect the deviation and re-approved.

## Tasks / Subtasks

> **⚠️ CRITICAL CONTEXT — READ BEFORE STARTING:** ADR-001 already exists at `docs/decisions/ADR-001-autoResearch-isolation.md` with status "accepted". It was created and committed as part of commit `4d1774f` (`feat: [US-051] - Epic 12.0: AutoResearch Architecture Decision Record (ADR-001)`). Additionally, ALL Epic 12 stories (12.1–12.5) have already been implemented by the Ralph autonomous system (commits US-051 through US-056). The tasks below are **verification tasks**, not fresh implementation.

- [x] Task 1: Verify AC #1 — ADR-001 content completeness (AC: #1)
  - [x] 1.1 Read `docs/decisions/ADR-001-autoResearch-isolation.md` and confirm it contains: problem statement, three alternatives (isolated branch / working copy / temp directory), chosen approach (isolated Git branch with convention `optimize/{target-type}/{session-name}/{timestamp}`), positive and negative consequences, and open questions
  - [x] 1.2 Confirm the ADR file path matches what was required: `docs/decisions/ADR-001-autoResearch-isolation.md`
  - [x] 1.3 Confirm ADR format follows MADR template at `docs/decisions/TEMPLATE-MADR.md`
- [x] Task 2: Verify AC #2 — ADR approval gate was respected (AC: #2)
  - [x] 2.1 Confirm ADR status field is "accepted" (not "proposed")
  - [x] 2.2 Confirm Stories 12.1–12.5 were implemented AFTER ADR-001 was committed (git log order: 4d1774f is before 72cf35c/60f4a70/18a3a3b/a43c8fe/c8c5634)
- [x] Task 3: Verify AC #3 — implementation compliance with ADR (AC: #3)
  - [x] 3.1 Confirm `src/optimize/ratchet.ts` implements isolated branch creation using the `optimize/{target-type}/{session-name}/{timestamp}` naming convention
  - [x] 3.2 Confirm no auto-merge to main is present in ratchet.ts or experiment-loop.ts (human review gate enforced)
  - [x] 3.3 Confirm `results.tsv` is append-only with `.lock` file pattern in the implementation
  - [x] 3.4 If any deviation from the ADR was made during 12.1–12.5 implementation, update ADR-001 to document the deviation and rationale

## Dev Notes

### Critical Context — ADR-001 Already Exists

**This story's primary deliverable is already complete.** ADR-001 was created on 2026-03-16 (commit `4d1774f`) with status `accepted`. The entire Epic 12 implementation (stories 12.0–12.5) was also completed by the Ralph autonomous development system prior to BMAD sprint tracking.

**Existing files to reference:**
- `docs/decisions/ADR-001-autoResearch-isolation.md` — the ADR (accepted, status confirmed)
- `docs/decisions/ADR-000-esm-typescript-result-pattern.md` — prior ADR for ESM/TS/Result pattern context
- `docs/decisions/TEMPLATE-MADR.md` — MADR template all ADRs must follow

**Related Epic 12 implementations (all already committed):**

| Story | Commit | File(s) |
|-------|--------|---------|
| 12.0 (this) | `4d1774f` | `docs/decisions/ADR-001-autoResearch-isolation.md` |
| 12.1 | `72cf35c` | AutoResearch command + program.md |
| 12.2 | `60f4a70` | `src/optimize/experiment-loop.ts` |
| 12.3 | `18a3a3b` | `src/optimize/ratchet.ts` |
| 12.4 | `a43c8fe` | `src/optimize/domain-metrics.ts` |
| 12.5 | `c8c5634` | `src/optimize/optimization-report.ts` |

### ADR-001 Key Decisions Documented

From `docs/decisions/ADR-001-autoResearch-isolation.md`:

- **Chosen isolation strategy:** Option A — Isolated Git branch per session (`optimize/{target-type}/{session-name}/{timestamp}`)
- **Rationale:** Zero contamination of main/feature branches, machine-enforceable, full experiment history preserved, human merge required
- **Git Ratchet:** Independent TypeScript module `src/optimize/ratchet.ts`, ≥80% Vitest coverage required (architecture spec: `src/optimize/ratchet.ts` with 85%+ coverage target)
- **`results.tsv`:** Append-only with `.lock` sentinel file (5-min TTL), never truncated
- **Merge policy:** Human review required — no auto-merge to main permitted

**Open questions captured in ADR-001:**
1. Cleanup policy: retain last 10 sessions per target type (recommended)
2. Merge guidance: whether to include ready-made `git merge` command in report
3. CI integration: block optimize branches without `optimization-report.md`
4. Concurrent sessions: mutex on target vs. parallel branches

### Architecture Constraints (from `architecture.md`)

- **AutoResearch is v1.0 scope** (not Alpha) — in Alpha it ships as a `🔲 stub` satisfying contracts
- `src/optimize/` module location: `src/optimize/ratchet.ts`, `src/optimize/loop.ts`
- **Budget Guards are cross-cutting** for AutoResearch — highest-risk surface for runaway costs (3-level: session/phase/day)
- Constitution enforcement: injected into every subagent context including optimize loop
- Target file size constraint: ≤600 lines (FR-1205) — optimization blocked if target exceeds this
- Command entry in registry: `'optimize': () => import('./optimize/index.js')`

### Project Structure Notes

- ADR location: `docs/decisions/` — follows NFR-20 (ADRs in MADR format)
- TypeScript files: kebab-case (`ratchet.ts`, `experiment-loop.ts`, `domain-metrics.ts`)
- Interfaces: PascalCase (`GitRatchet`, `ExperimentResult`)
- No `.js` imports needed for the ADR itself (it's pure Markdown)
- The ADR references `src/optimize/ratchet.ts` and `src/engine/recovery.ts` (recovery module with `executeRollback` reused by ratchet)

### Testing Standards

- `src/optimize/ratchet.ts` requires ≥80% Vitest coverage (architecture mandates 85%+ target)
- Test fixture: `test/fixtures/projects/minimal/` — bare git repo for ratchet.ts tests (Bob 🏃 per architecture)
- Unit tests: `test/unit/` — pure functions, parsers
- Integration tests: `test/integration/` — pipeline transitions

### References

- ADR-001 (primary deliverable): `docs/decisions/ADR-001-autoResearch-isolation.md`
- MADR template: `docs/decisions/TEMPLATE-MADR.md`
- Epic 12 epics definition: `_bmad-output/planning-artifacts/epics.md` § "Epic 12: AutoResearch"
- Architecture — AutoResearch Isolation section: `_bmad-output/planning-artifacts/architecture.md` lines 123–134 and 507–514
- Architecture — Phase Delivery Table: `architecture.md` line 350 — AutoResearch + Git Ratchet is `🔲 stub` in Alpha, `✅` in v1.0
- FR-1201 (AutoResearch command), FR-1202 (program.md), FR-1203 (fixed-budget), FR-1204 (Git Ratchet), FR-1205 (≤600 line target)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- ADR-001 already created (commit 4d1774f, 2026-03-16) with status "accepted"
- All Epic 12 stories (12.1–12.5) implemented prior to BMAD sprint tracking via Ralph system
- Dev agent treated this as a verification story, not a fresh implementation
- **AC #1 verified:** ADR-001 at `docs/decisions/ADR-001-autoResearch-isolation.md` contains all required sections: problem statement, 3 alternatives (isolated branch / stash-pop / separate clone), chosen approach (Option A, `optimize/{target-type}/{session-name}/{timestamp}` convention), positive consequences, negative consequences, and 4 open questions. MADR template structure followed.
- **AC #2 verified:** ADR status is "accepted"; git log confirms commit 4d1774f (ADR-001) precedes all 12.1–12.5 implementation commits — approval gate was respected.
- **AC #3 verified:** `ratchet.ts::buildIsolatedBranchName` returns correct `optimize/…` branch naming convention; `buildReviewInstructions` explicitly prohibits auto-merge to main; `optimization-report.ts::appendResultsTsv` is append-only via injectable `appendFn`. Note: `.lock` sentinel file pattern mentioned in story Dev Notes is NOT present in ADR-001 text and was not implemented — this is not an ADR deviation since the ADR itself never mandated `.lock`. No ADR update required.
- All 180 optimize-related unit tests pass (5 test files).

### File List

- `docs/decisions/ADR-001-autoResearch-isolation.md` (verified — meets all ACs)
- `src/optimize/ratchet.ts` (verified — branch naming convention confirmed)
- `src/optimize/experiment-loop.ts` (verified — no auto-merge)
- `src/optimize/optimization-report.ts` (verified — results.tsv append-only)
- `src/optimize/domain-metrics.ts` (verified — no ADR deviations)
