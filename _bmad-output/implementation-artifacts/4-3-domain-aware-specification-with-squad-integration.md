
# Story 4.3: Domain-Aware Specification with Squad Integration

Status: done

## Story

As a developer or Squad creator working in a specific domain,
I want `/bp:specify` to inject domain-specific question templates when a Squad is active,
So that my spec automatically captures domain constraints without me having to know them upfront.

## Acceptance Criteria

1. **Squad Question Injection**
   - Given I have a Squad active (e.g., `active_squad: software` in `.buildpact/config.yaml`)
   - When I run `/bp:specify`
   - Then `getSquadQuestions(domain)` returns domain-specific questions
   - And `runSquadFlow()` presents them after the main NL input capture
   - And the generated `spec.md` includes `## Domain Constraints` with the Squad name, domain, and answers table

2. **Domain Coverage — 4 Domains**
   - Given the active Squad domain is one of: software, marketing, health, research
   - When `getSquadQuestions(domain)` is called
   - Then it returns ≥3 questions for each domain
   - And each question has ≥3 numbered options

3. **Web Bundle Mode — Conversational Format**
   - Given `mode: web-bundle` in `.buildpact/config.yaml`
   - When the Squad question flow runs
   - Then `runSquadFlow()` uses `clack.text` with numbered options embedded in the message (NOT `clack.select`)
   - And no technical jargon is included in the question prompts

4. **No Squad Questions When No Squad Active**
   - Given `active_squad: none` or no Squad configured
   - When the specify flow runs
   - Then `readActiveSquad()` returns undefined and Squad questions are skipped entirely
   - And the spec has no `## Domain Constraints` section

5. **Squad Integration Section in specify.md**
   - Given Stories 4.1 and 4.2 established the base orchestrator
   - When Story 4.3 adds Squad integration
   - Then `templates/commands/specify.md` includes a `## Squad Domain Questions` section that documents when to inject domain questions and which 4 domains are supported

## Tasks / Subtasks

- [x] Task 1: Add `## Squad Domain Questions` section to `templates/commands/specify.md` (AC: #5)
  - [x] 1.1: After ambiguity detection (Story 4.2), add Squad injection step: check for active Squad via `readActiveSquad()` from `handler.ts`
  - [x] 1.2: Document domain question categories: software (tech stack, quality standards, deployment), marketing (audience, metric, compliance), health (content type, compliance level, users), research (methodology, review protocol, statistics)
  - [x] 1.3: Add rule: if `active_squad === undefined` → skip Squad section entirely; no `## Domain Constraints` in spec
  - [x] 1.4: Add Web Bundle mode rule: use `clack.text` with embedded numbered options (not `clack.select`); `squad_web_bundle_placeholder` i18n key
  - [x] 1.5: Reference the `on_specify_complete` hook trigger (for Squad plugin API) in Implementation Notes
  - [x] 1.6: Verify specify.md total still ≤300 lines — 221 lines

- [x] Task 2: Verify `getSquadQuestions()`, `readActiveSquad()`, `runSquadFlow()` — no new implementation needed (AC: #1, #2, #3, #4)
  - [x] 2.1: Run `npx vitest run test/unit/commands/specify.test.ts -t "getSquadQuestions"` — passed
  - [x] 2.2: Run `npx vitest run test/unit/commands/specify.test.ts -t "readActiveSquad"` — passed
  - [x] 2.3: Run `npx vitest run test/unit/commands/specify.test.ts -t "Squad domain"` — passed

- [x] Task 3: Add Squad domain constraints snapshot schema (AC: #1, #4)
  - [x] 3.1: Created `test/snapshots/specify/with-squad-constraints.schema.ts` with all required fields
  - [x] 3.2: Test: `buildSpecContent({ squadConstraints: { ... } })` → spec contains `## Domain Constraints` with Squad name — passes
  - [x] 3.3: Test: `buildSpecContent({})` → spec does NOT contain `## Domain Constraints` — passes

- [x] Task 4: Run full test suite (AC: all)
  - [x] 4.1: `npx vitest run` — 1639 tests pass, zero regressions
  - [x] 4.2: Verify `specify.md` line count ≤300 — 221 lines

## Dev Notes

### What Was Already Built (DO NOT REBUILD)

| Asset | Location | Notes |
|-------|----------|-------|
| `getSquadQuestions(domain: string): SquadQuestion[]` | `handler.ts` | Case-insensitive; empty array for unknown domains |
| `readActiveSquad(projectDir): Promise<ActiveSquad \| undefined>` | `handler.ts` | Reads `config.yaml` + `squad.yaml`; returns undefined for `none` or missing |
| `readWebBundleMode(projectDir): Promise<boolean>` | `handler.ts` | `mode: web-bundle` in config.yaml |
| `runSquadFlow(questions, i18n, isWebBundle)` | `handler.ts` | CLI: clack.select + "Other"; Web Bundle: clack.text with embedded options |
| `DOMAIN_QUESTIONS` | `handler.ts` | 4 domains × 3 questions × 4+ options each |
| `SquadQuestion`, `SquadConstraintAnswer`, `ActiveSquad` | `handler.ts` | All exported interfaces |
| `buildSpecContent()` — Domain Constraints section | `handler.ts` | Renders `## Domain Constraints` table with Squad metadata |
| Existing unit tests | `specify.test.ts` | getSquadQuestions (6 tests), readActiveSquad (7+ tests), Squad integration handler tests |

### Domain Question Reference (for Orchestrator Documentation)

**software domain (3 questions):**
- `tech_stack`: "What is the primary technology stack?" → Frontend/Backend/Full-stack/Mobile/CLI
- `quality_standards`: "What quality standards apply?" → Unit tests ≥80% / E2E / TS strict / ESLint / None
- `deployment_target`: "What is the deployment target?" → Cloud / Self-hosted / Docker / Serverless / TBD

**marketing domain (3 questions):**
- `primary_audience`: B2B / B2C / Internal / Mixed / TBD
- `key_metric`: Conversions / Traffic / Brand awareness / Leads / Retention
- `compliance`: GDPR/LGPD / ANVISA/CFM / None / Industry-specific

**health domain (3 questions):**
- `content_type`: Patient info / Clinical workflows / Medical device / Research data / None
- `compliance_level`: CFM nº 1.974/2011 / HIPAA/LGPD / ANVISA / None
- `primary_users`: Healthcare professionals / Patients / Administrative / Researchers / Public

**research domain (3 questions):**
- `methodology`: Systematic review / Experimental / Observational / Survey / Data analysis
- `review_protocol`: PRISMA / CONSORT / STROBE / None
- `statistical_approach`: Descriptive / Inferential / Regression / Survival / TBD

### Squad Plugin API — on_specify_complete Hook

The `on_specify_complete` hook is triggered after spec generation if a Squad is active. This hook allows Squad plugins to post-process the spec (add compliance annotations, domain-specific FR sections, etc.).

Reference: `src/contracts/squad.ts` — `SquadHook` interface, 6 pipeline hook points.
The orchestrator should document this hook point in Implementation Notes to enable Ricardo (Persona D — Squad creator) to extend the specify flow.

### Dual-Mode Interface Contract

`readWebBundleMode()` returns `true` only when `mode: web-bundle` is explicitly set in `.buildpact/config.yaml`. This config value is set by the Web Bundle Generator — Squad creators don't set it manually.

In Web Bundle mode, ALL clack.select calls must be replaced with clack.text + embedded options. This is enforced throughout `runSquadFlow()` and `runClarificationFlow()`.

### 300-Line Budget (specify.md)

Story 4.1: ~215 lines | Story 4.2 addition: ~25 lines → total ~240 lines
Story 4.3 `## Squad Domain Questions` addition: ~30 lines
Running total after 4.3: ~270 lines (still within 300)

### NFR Compliance

| NFR | Compliance |
|-----|------------|
| NFR-02 | specify.md ≤300 lines after Story 4.3 additions |
| NFR-05 | PT-BR Squad questions not required (domain questions are English in handler.ts — i18n is framework-level only; Squad domain rules use Layer 2 i18n via squad.yaml, not locales/) |
| NFR-23 | Squad name, domain, and answers included in audit log (existing `specify.create` action via `handler.run()`) |

### Project Structure Notes

- No new files beyond `test/snapshots/specify/with-squad-constraints.schema.ts`
- Squad domain questions live in `handler.ts` (not externalized to YAML files — intentional design decision for Alpha)
- Community Squad domain questions will be injectable via `on_specify_complete` hook in a future story

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic4-Story4.3] — User story and AC
- [Source: src/commands/specify/handler.ts#getSquadQuestions] — DOMAIN_QUESTIONS map (4 domains)
- [Source: src/commands/specify/handler.ts#runSquadFlow] — CLI vs Web Bundle mode handling
- [Source: src/contracts/squad.ts] — SquadHook interface + 6 pipeline hook points
- [Source: _bmad-output/planning-artifacts/architecture.md#i18n-Architecture] — Two-layer i18n (UI strings vs Squad domain rules)
- [Source: templates/commands/specify.md] — Prerequisite: Stories 4.1 and 4.2 must be complete

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `## Squad Domain Questions` section to `templates/commands/specify.md` with all 4 domains, Web Bundle mode, skip rule, and on_specify_complete hook reference
- Created `test/snapshots/specify/with-squad-constraints.schema.ts` and `with-squad-constraints.test.ts` — 8 tests covering Domain Constraints presence/absence and getSquadQuestions() for all 4 domains
- All tests pass (1639 total, zero regressions)

### File List

- templates/commands/specify.md (modified — added Squad Domain Questions section)
- test/snapshots/specify/with-squad-constraints.schema.ts (new)
- test/snapshots/specify/with-squad-constraints.test.ts (new)
