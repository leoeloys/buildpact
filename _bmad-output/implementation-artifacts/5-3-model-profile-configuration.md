# Story 5.3: Model Profile Configuration

Status: done

## Story

As a tech lead managing AI costs,
I want to configure model profiles that assign different AI models to different pipeline phases,
So that I use expensive models only where quality matters and cheaper models for routine work — with automatic failover if a model is unavailable.

## Acceptance Criteria

1. **Profile Resolution from config.yaml**
   - Given I configure `model_profile: "quality"` in `.buildpact/config.yaml`
   - When `/bp:plan` or any pipeline command executes
   - Then the framework resolves the named profile from `.buildpact/profiles/{{profile_name}}.yaml`
   - And uses the model specified for the current phase in the active profile

2. **Automatic Failover Chain**
   - Given a primary model is unavailable for a phase
   - When execution attempts to use that model
   - Then it automatically falls back to the next model in the failover chain
   - And waits the configured `retry_delay_ms` between attempts
   - And escalates to the user if all models in the chain fail

3. **Operation-Level Routing**
   - Given I configure operation-level routing in my profile
   - When a phase executes operations of different types (e.g., research vs. plan-writing)
   - Then the framework applies the correct model per operation type within the phase

4. **Three Built-in Profiles**
   - Given the framework is freshly installed
   - When I check `.buildpact/profiles/`
   - Then three profile files exist: `quality.yaml`, `balanced.yaml`, `budget.yaml`
   - And `config.yaml` defaults to `model_profile: "default"` which maps to `balanced.yaml`

5. **Profile Contracts Implemented**
   - Given `src/contracts/profile.ts` defines `ModelProfile` and `FailoverChain`
   - When `src/foundation/profile.ts` implements profile loading
   - Then it reads `.buildpact/profiles/{{name}}.yaml`, validates schema, and returns typed `ModelProfile`
   - And profile reading goes through `src/foundation/config.ts` indirection — no module reads profile files directly

## Tasks / Subtasks

- [x] Task 1: Implement `src/contracts/profile.ts` — ModelProfile + FailoverChain interfaces (AC: #1, #2, #3)
  - [x] 1.1: Define `ModelProfile` interface: `name`, `phases` map, `operations` map, `failover_chain` per phase
  - [x] 1.2: Define `FailoverChain` interface: `models: string[]`, `retry_delay_ms: number`, `max_wait_ms: number`
  - [x] 1.3: Define `PhaseModelConfig`: `primary: string`, `failover: FailoverChain`
  - [x] 1.4: Define `OperationModelConfig`: `operation: string`, `model: string` (for operation-level routing)
  - [x] 1.5: Export all types from `src/contracts/profile.ts` (file already exists as stub — implement it)

- [x] Task 2: Create three built-in profile YAML templates (AC: #4)
  - [x] 2.1: Create `templates/profiles/quality.yaml` — all phases use most capable model, large failover chain
  - [x] 2.2: Create `templates/profiles/balanced.yaml` — research uses quality, writing uses standard
  - [x] 2.3: Create `templates/profiles/budget.yaml` — all phases use cheapest available model
  - [x] 2.4: Each YAML file follows `config.yaml` snake_case key convention
  - [x] 2.5: Update installer template to copy `templates/profiles/` → `.buildpact/profiles/` on `init`

- [x] Task 3: Implement `src/foundation/profile.ts` — profile reader (AC: #1, #5)
  - [x] 3.1: Export `loadProfile(name: string): Promise<Result<ModelProfile, CliError>>`
  - [x] 3.2: Reads `.buildpact/profiles/{{name}}.yaml` — validates file exists, parses YAML
  - [x] 3.3: Validates schema against `ModelProfile` contract — returns `CliError` if invalid
  - [x] 3.4: `"default"` name maps to `balanced` profile
  - [x] 3.5: Export from `src/foundation/index.ts` (add to existing named exports)

- [x] Task 4: Implement failover resolution in `src/foundation/profile.ts` (AC: #2)
  - [x] 4.1: Export `resolveModelForPhase(profile: ModelProfile, phase: string): string` — returns primary model for phase
  - [x] 4.2: Export `resolveModelForOperation(profile: ModelProfile, phase: string, operation: string): string` — operation-level routing
  - [x] 4.3: Export `executeWithFailover<T>(chain: FailoverChain, fn: (model: string) => Promise<T>): Promise<T>` — tries each model in chain, waits `retry_delay_ms`, throws if all fail
  - [x] 4.4: `executeWithFailover` logs each failover attempt via `AuditLogger`

- [x] Task 5: Integrate profile loading into `src/commands/plan/handler.ts` (AC: #1, #3)
  - [x] 5.1: At plan start, call `loadProfile(config.model_profile)` to get active profile
  - [x] 5.2: Pass profile to `spawnResearchAgents()` (Story 5.1) — each research agent uses `research` operation model
  - [x] 5.3: Wave generation (Story 5.2) uses `plan-writing` operation model
  - [x] 5.4: Log active profile name in audit: `audit.log({ event: 'plan.profile.loaded', profile: name })`

- [x] Task 6: Write unit tests for profile.ts (AC: #1, #2, #3, #4, #5)
  - [x] 6.1: Create `test/unit/foundation/profile.test.ts`
  - [x] 6.2: Test: `loadProfile('quality')` returns valid `ModelProfile` with all phases defined
  - [x] 6.3: Test: `loadProfile('default')` resolves to `balanced` profile
  - [x] 6.4: Test: `loadProfile('nonexistent')` returns `{ ok: false, error: CliError }`
  - [x] 6.5: Test: `resolveModelForOperation(profile, 'plan', 'research')` returns `research` operation model
  - [x] 6.6: Test: `executeWithFailover` — primary fails → tries secondary → returns result from secondary
  - [x] 6.7: Test: `executeWithFailover` — all models fail → throws escalation error

- [x] Task 7: Write integration test for profile + plan integration (AC: #1, #3)
  - [x] 7.1: Create `test/integration/pipeline/plan-with-profile.test.ts`
  - [x] 7.2: Test: given `config.yaml` with `model_profile: "budget"`, `planCommand()` uses budget profile models
  - [x] 7.3: Mock: `TaskDispatch` — verify the dispatched model matches budget profile config

- [x] Task 8: Run full test suite (AC: all)
  - [x] 8.1: `npx vitest run` — all existing tests pass
  - [x] 8.2: New `profile.test.ts` + `plan-with-profile.test.ts` pass

## Dev Notes

### Architecture Context

**profile.ts contract** — file already exists as a stub in `src/contracts/profile.ts`. This story implements it fully.
[Source: architecture.md#Contracts-Layer]

**Critical rule:** `src/foundation/config.ts` is the sole reader of `config.yaml`. Similarly, `src/foundation/profile.ts` is the sole reader of profile YAML files. No command or engine module reads these files directly.
[Source: architecture.md#GAP-04 — "No other module reads config.yaml directly"]

**config.yaml schema (already implemented):**
```yaml
model_profile: "default"    # string, profile name from .buildpact/profiles/
```
The `model_profile` key already exists in the canonical schema from Story 1.1.
[Source: architecture.md#GAP-04]

### ModelProfile Interface (IMPLEMENT THIS)

```typescript
// src/contracts/profile.ts — implement the stub
export interface FailoverChain {
  models: string[]        // ordered list: [primary, secondary, tertiary...]
  retry_delay_ms: number  // wait between attempts
  max_wait_ms: number     // total max wait before escalation
}

export interface OperationModelConfig {
  operation: string  // e.g., "research", "plan-writing", "validation"
  model: string      // e.g., "claude-opus-4-6", "claude-sonnet-4-6"
}

export interface PhaseModelConfig {
  primary: string
  failover: FailoverChain
  operations?: OperationModelConfig[]  // operation-level overrides
}

export interface ModelProfile {
  name: string
  phases: Record<string, PhaseModelConfig>  // phase → model config
  // phase keys: "research", "plan", "execute", "verify", "specify"
}
```

### Built-in Profile YAML Format

```yaml
# templates/profiles/quality.yaml
name: quality
phases:
  research:
    primary: "claude-opus-4-6"
    failover:
      models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
      retry_delay_ms: 1000
      max_wait_ms: 30000
    operations:
      - operation: research
        model: "claude-opus-4-6"
      - operation: plan-writing
        model: "claude-sonnet-4-6"
  plan:
    primary: "claude-opus-4-6"
    failover:
      models: ["claude-opus-4-6", "claude-sonnet-4-6"]
      retry_delay_ms: 1000
      max_wait_ms: 30000
```

```yaml
# templates/profiles/balanced.yaml — DEFAULT
name: balanced
phases:
  research:
    primary: "claude-sonnet-4-6"
    failover:
      models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
      retry_delay_ms: 500
      max_wait_ms: 15000
    operations:
      - operation: research
        model: "claude-sonnet-4-6"
      - operation: plan-writing
        model: "claude-sonnet-4-6"
  plan:
    primary: "claude-sonnet-4-6"
    failover:
      models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
      retry_delay_ms: 500
      max_wait_ms: 15000
```

```yaml
# templates/profiles/budget.yaml
name: budget
phases:
  research:
    primary: "claude-haiku-4-5-20251001"
    failover:
      models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"]
      retry_delay_ms: 200
      max_wait_ms: 10000
  plan:
    primary: "claude-haiku-4-5-20251001"
    failover:
      models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"]
      retry_delay_ms: 200
      max_wait_ms: 10000
```

### Installer Update

`src/foundation/installer.ts` already copies `templates/` → `.buildpact/` on init (Story 1.1). This story only needs to add `templates/profiles/` as a new directory to be copied. Do NOT rewrite the installer — only add the new source directory to the copy list.

### "default" Profile Resolution

```typescript
// src/foundation/profile.ts
const PROFILE_ALIASES: Record<string, string> = {
  'default': 'balanced',
}

export async function loadProfile(name: string): Promise<Result<ModelProfile, CliError>> {
  const resolved = PROFILE_ALIASES[name] ?? name
  const profilePath = `.buildpact/profiles/${resolved}.yaml`
  // ... read, parse, validate
}
```

### ESM + Module Exports

```typescript
// src/foundation/index.ts — ADD these exports
export { loadProfile, resolveModelForPhase, resolveModelForOperation, executeWithFailover } from './profile.js'
export type { ModelProfile, FailoverChain, PhaseModelConfig } from '../contracts/profile.js'
```

### plan.md Impact

This story adds a `## Model Profile` section to `templates/commands/plan.md` (~30 lines) documenting:
- Profile resolution from config.yaml
- Per-phase model selection
- Failover chain behavior
Plan.md budget: ~115 lines after Stories 5.1+5.2+5.3 (well under 300).

### Anti-Patterns

- ❌ Do NOT hardcode model names in handler.ts — always resolve from profile
- ❌ Do NOT read profile YAML files from anywhere except `src/foundation/profile.ts`
- ❌ Do NOT add profile reading to `src/foundation/config.ts` — keep them separate modules
- ❌ Do NOT implement model API calls — profile just resolves model *names* (actual calls are Agent Mode v2.0)

### Testing for Failover

```typescript
// test/unit/foundation/profile.test.ts
it('executeWithFailover: retries secondary on primary failure', async () => {
  const chain: FailoverChain = {
    models: ['model-a', 'model-b'],
    retry_delay_ms: 0,  // 0 for tests
    max_wait_ms: 1000
  }
  const fn = vi.fn()
    .mockRejectedValueOnce(new Error('model-a unavailable'))
    .mockResolvedValueOnce('success-from-model-b')

  const result = await executeWithFailover(chain, fn)
  expect(result).toBe('success-from-model-b')
  expect(fn).toHaveBeenCalledTimes(2)
})
```

### References

- [Source: epics.md#Epic5-Story5.3] — User story, AC
- [Source: architecture.md#Contracts-Layer] — profile.ts stub location
- [Source: architecture.md#GAP-04] — config.yaml schema (model_profile key)
- [Source: architecture.md#Complete-Project-Tree] — src/contracts/profile.ts
- [Source: architecture.md#Implementation-Patterns] — naming, ESM patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1 already done: `src/contracts/profile.ts` was pre-implemented as a full stub with all interfaces (not just a stub). No changes needed.
- Task 2: Created three profile YAML templates (`quality.yaml`, `balanced.yaml`, `budget.yaml`) with all five pipeline phases (`research`, `plan`, `execute`, `verify`, `specify`) plus per-phase operations. Updated `src/foundation/installer.ts` step 6 to copy `templates/profiles/` → `.buildpact/profiles/` on init.
- Task 3 & 4: Implemented `src/foundation/profile.ts` with a bespoke line-based YAML parser (no external YAML library — none in project dependencies). Handles nested mappings, sequences, inline JSON arrays for `models:` field. `loadProfile()`, `resolveModelForPhase()`, `resolveModelForOperation()`, `executeWithFailover()` all exported. `"default"` aliases to `"balanced"`. Exported all functions from `src/foundation/index.ts`.
- Task 5: Integrated into `src/commands/plan/handler.ts` — reads `active_model_profile` from config.yaml, loads profile, resolves `research` and `plan-writing` model names, logs `plan.profile.loaded` to audit. Model names are stored for production Task() dispatch (Alpha stub).
- Task 6 & 7: 20 new tests — 15 unit + 5 integration — all green. No regressions. Full suite: 1692 tests, 64 files.
- TypeScript lint: no new errors introduced (4 pre-existing errors in unrelated files).

### File List

- `templates/profiles/quality.yaml` — NEW
- `templates/profiles/balanced.yaml` — NEW
- `templates/profiles/budget.yaml` — NEW
- `src/foundation/profile.ts` — NEW
- `src/foundation/index.ts` — MODIFIED (added profile exports)
- `src/foundation/installer.ts` — MODIFIED (added profiles directory copy step)
- `src/commands/plan/handler.ts` — MODIFIED (added profile loading integration)
- `test/unit/foundation/profile.test.ts` — NEW
- `test/integration/pipeline/plan-with-profile.test.ts` — NEW

## Change Log

- Implemented Story 5.3 — Model Profile Configuration (Date: 2026-03-18)
