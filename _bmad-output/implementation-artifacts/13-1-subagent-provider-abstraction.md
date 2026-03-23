# Story 13.1: Subagent Provider Abstraction

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a framework developer replacing the Alpha execution stub,
I want a provider abstraction layer that routes task dispatch to real AI providers,
so that `executeWave()` can call live AI models instead of returning hardcoded success.

## Acceptance Criteria

**AC-1: SubagentProvider interface defines the dispatch contract**

Given the framework needs to support multiple AI providers (NFR-12),
When I define the provider abstraction,
Then a `SubagentProvider` interface exists with a single `dispatch(payload: TaskDispatchPayload): Promise<TaskResult>` method,
And a `StubProvider` implements it wrapping the existing `executeTaskStub` behavior (returns synthetic success),
And an `AnthropicProvider` implements it using the `@anthropic-ai/sdk` package,
And provider selection is driven by configuration (not hardcoded).

**AC-2: AnthropicProvider dispatches real API calls**

Given the user has `ANTHROPIC_API_KEY` set in their environment,
When a task is dispatched through `AnthropicProvider`,
Then it sends the `TaskDispatchPayload.content` as a user message to the Claude API,
And it uses the model resolved by `ModelProfileManager` for the current operation,
And it respects the failover chain (FR-604) — if the primary model fails, it tries the next model,
And it returns a `TaskResult` with `tokensUsed` and `costUsd` populated from the API response,
And the payload size is validated before dispatch (existing `validatePayloadSize`, 20KB limit).

**AC-3: Provider factory resolves provider from configuration**

Given the project has a `.buildpact/config.yaml` with provider settings,
When the execute command resolves a provider,
Then `resolveProvider(projectDir)` returns `AnthropicProvider` when `ANTHROPIC_API_KEY` is set,
And returns `StubProvider` when no API key is available (Alpha fallback),
And the factory is extensible for future providers without modifying existing code.

**AC-4: executeWave becomes async with real provider dispatch**

Given `executeWave()` currently calls `executeTaskStub()` synchronously,
When provider abstraction is integrated,
Then `executeWave()` becomes `async` and accepts a `SubagentProvider` parameter,
And tasks within a wave are dispatched in parallel via `Promise.all()`,
And the execute handler in `src/commands/execute/handler.ts` is updated to pass the resolved provider,
And all existing tests continue to pass using `StubProvider`.

**AC-5: Cost tracking uses real API response data**

Given a task completes via `AnthropicProvider`,
When the result is returned,
Then `TaskResult.tokensUsed` reflects actual input + output tokens from the API,
And `TaskResult.costUsd` is calculated using the model's cost rate from `MODEL_CATALOG`,
And the budget guard accumulates real cost instead of `STUB_COST_PER_TASK_USD`.

## Tasks / Subtasks

- [x] Task 1: Create SubagentProvider interface and StubProvider (AC: 1)
  - [x] 1.1: Define `SubagentProvider` interface in `src/contracts/provider.ts` with `dispatch(payload: TaskDispatchPayload): Promise<TaskResult>` and `name: string`
  - [x] 1.2: Create `StubProvider` in `src/engine/providers/stub.ts` wrapping existing `executeTaskStub` logic (returns synthetic success with `tokensUsed: 0`, `costUsd: STUB_COST_PER_TASK_USD`)
  - [x] 1.3: Write unit tests for StubProvider — verify it returns same results as current executeTaskStub

- [x] Task 2: Implement AnthropicProvider (AC: 2)
  - [x] 2.1: Add `@anthropic-ai/sdk` as a dependency in package.json
  - [x] 2.2: Create `AnthropicProvider` in `src/engine/providers/anthropic.ts`
  - [x] 2.3: Implement `dispatch()`: build Messages API request from `TaskDispatchPayload.content`, call Claude API, parse response into `TaskResult`
  - [x] 2.4: Integrate with `ModelProfileManager` — use `resolveModelForOperation()` to select model for the task type
  - [x] 2.5: Implement failover — on API error (rate limit, timeout, 5xx), call `advanceFailover()` and retry with next model in chain
  - [x] 2.6: Populate `tokensUsed` from `response.usage.input_tokens + response.usage.output_tokens` and calculate `costUsd` using `MODEL_CATALOG` rates
  - [x] 2.7: Validate payload size before dispatch (call existing `validatePayloadSize`)
  - [x] 2.8: Write unit tests with mocked Anthropic SDK — verify dispatch, failover, cost calculation, payload validation

- [x] Task 3: Create provider factory (AC: 3)
  - [x] 3.1: Create `resolveProvider(projectDir: string): Promise<Result<SubagentProvider>>` in `src/engine/providers/index.ts`
  - [x] 3.2: Resolution logic: check `ANTHROPIC_API_KEY` env var → return `AnthropicProvider` if set, `StubProvider` if not
  - [x] 3.3: Export all providers and factory from `src/engine/providers/index.ts`
  - [x] 3.4: Add provider exports to `src/engine/index.ts`
  - [x] 3.5: Write unit tests for factory resolution with mocked env vars

- [x] Task 4: Make executeWave async with provider injection (AC: 4)
  - [x] 4.1: Change `executeWave(tasks: WaveTask[])` signature to `executeWave(tasks: WaveTask[], provider: SubagentProvider): Promise<WaveExecutionResult>`
  - [x] 4.2: Replace `tasks.map(task => executeTaskStub(task))` with `await Promise.all(tasks.map(task => provider.dispatch(buildSubagentContext(task))))`
  - [x] 4.3: Map `TaskResult` back to `TaskExecutionResult` (preserve commitMessage generation)
  - [x] 4.4: Update `executeWaves()` (if it exists as a higher-level function) to be async
  - [x] 4.5: Update execute handler (`src/commands/execute/handler.ts`) to call `resolveProvider()` and pass provider to `executeWave()`
  - [x] 4.6: Update all existing wave-executor tests to pass `StubProvider` — no behavior change for existing tests
  - [x] 4.7: Update engine exports if needed

- [x] Task 5: Integrate real cost tracking (AC: 5)
  - [x] 5.1: In execute handler, replace `sessionSpendUsd += waveTasks.length * STUB_COST_PER_TASK_USD` with actual cost from `TaskResult.costUsd` sum
  - [x] 5.2: Ensure `updateDailySpend()` receives real cost data when using AnthropicProvider
  - [x] 5.3: Add `costUsd` and `tokensUsed` fields to `TaskExecutionResult` interface (pass through from TaskResult)
  - [x] 5.4: Write integration test verifying cost accumulation with StubProvider (uses STUB_COST_PER_TASK_USD) and mock AnthropicProvider (uses real cost values)

## Dev Notes

### Architecture Requirements

**Provider abstraction is NFR-12 mandatory** — the framework MUST NOT hard-code to any specific AI model or provider. The `SubagentProvider` interface is the seam between the framework's execution engine and any AI backend.

**Subagent isolation is FR-302 mandatory** — each dispatch MUST send a clean context. The existing `buildSubagentContext()` already handles this correctly; the provider just needs to forward the assembled payload content as a message to the API.

**Payload size limit is NFR-02** — 20KB max. Already enforced by `validatePayloadSize()` in `src/engine/subagent.ts`. Call it before dispatch.

### Existing Code to Reuse (DO NOT Reinvent)

| Component | Location | Reuse How |
|-----------|----------|-----------|
| `TaskDispatchPayload` interface | `src/contracts/task.ts` | Provider dispatch input type |
| `TaskResult` interface | `src/contracts/task.ts` | Provider dispatch return type |
| `buildSubagentContext()` | `src/engine/wave-executor.ts:68-89` | Builds the payload from WaveTask |
| `validatePayloadSize()` | `src/engine/subagent.ts` | Pre-dispatch validation |
| `MODEL_CATALOG` | `src/engine/model-profile-manager.ts` | Cost rates for cost calculation |
| `resolveModelForOperation()` | `src/engine/model-profile-manager.ts` | Model selection per task type |
| `buildFailoverChain()` / `advanceFailover()` | `src/engine/model-profile-manager.ts` | Failover on API errors |
| `readActiveProfileTier()` | `src/engine/model-profile-manager.ts` | Get active profile (quality/balanced/budget) |
| `STUB_COST_PER_TASK_USD` | `src/engine/budget-guard.ts:14` | StubProvider cost value |
| `formatCommitMessage()` | `src/engine/wave-executor.ts` | Commit message generation for results |
| `Result<T, CliError>` | `src/contracts/errors.ts` | Return type for all fallible operations |
| `ERROR_CODES` | `src/contracts/errors.ts` | Error code constants |

### Key Implementation Details

**AnthropicProvider.dispatch() flow:**
1. Call `validatePayloadSize(payload)` — return `err(PAYLOAD_TOO_LARGE)` if fails
2. Resolve model via `resolveModelForOperation(config, tier, taskType)`
3. Build Anthropic Messages API request: `{ model, max_tokens, messages: [{ role: 'user', content: payload.content }] }`
4. Call `client.messages.create(request)` — on success, extract response text + usage
5. On API error: check if retryable (429, 500, 503) → call `advanceFailover()` → retry with next model
6. On non-retryable error: return `err()` with descriptive error
7. Build `TaskResult` with: `success: true`, `tokensUsed: usage.input_tokens + usage.output_tokens`, `costUsd: tokens * MODEL_CATALOG[model].costPer1kOutputUsd / 1000`

**executeWave() async migration:**
- Current: `const results = tasks.map(task => executeTaskStub(task))` (sync)
- New: `const taskResults = await Promise.all(tasks.map(t => provider.dispatch(buildSubagentContext(t))))` (async)
- Must map `TaskResult` → `TaskExecutionResult` (add `waveNumber`, `title`, `commitMessage`)

**API key handling:**
- Read from `process.env.ANTHROPIC_API_KEY`
- Factory returns `StubProvider` if key is missing (graceful Alpha fallback, no error)
- AnthropicProvider constructor validates key is non-empty, returns error if blank

### Project Structure Notes

New files follow existing kebab-case pattern:
```
src/engine/providers/         # New directory
  index.ts                    # Factory + re-exports
  stub.ts                     # StubProvider
  anthropic.ts                # AnthropicProvider
src/contracts/provider.ts     # SubagentProvider interface
test/unit/engine/providers/   # Test mirror
  stub.test.ts
  anthropic.test.ts
  factory.test.ts
```

### Coding Conventions (from codebase analysis)

- ESM imports with `.js` extension: `import { foo } from './bar.js'`
- Named exports only (no default exports)
- `Result<T, CliError>` for all fallible operations — never throw for business errors
- Error codes: `ERROR_CODES.SCREAMING_SNAKE_CASE` in `src/contracts/errors.ts`
- i18n: dot-notation keys like `'error.provider.api_key_missing'` — add to both `locales/en.yaml` and `locales/pt-br.yaml`
- Factory pattern with `opts()` helpers in tests
- `vi.mock()` for module-level mocking, `vi.fn()` for function mocks

### Previous Story Learnings

From Epic 12 (AutoResearch):
- **Injectable I/O pattern** — all write/append use injected functions for testability. Apply same pattern: AnthropicProvider should accept injected `client` for testing.
- **Result type is universal** — every fallible path returns `Result<T, CliError>`. Provider dispatch must follow this.
- **Audit logging** — use `AuditLogger` from `src/foundation/audit.ts` to log dispatch events
- **Alpha stub cost** — `STUB_COST_PER_TASK_USD = 0.001` is the existing baseline

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-302] — Subagent Isolation with Mandatory Session Reset
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-701] — Wave Execution
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-604] — Model Profiles with Failover Chains
- [Source: docs/prd/buildpact-prd-v2.3.0.md#NFR-12] — Agent-Agnostic Design
- [Source: docs/prd/buildpact-prd-v2.3.0.md#NFR-02] — Context Efficiency (20KB payload limit)
- [Source: src/engine/wave-executor.ts:91-124] — Current executeTaskStub implementation
- [Source: src/engine/wave-executor.ts:127-146] — Current executeWave implementation
- [Source: src/engine/model-profile-manager.ts] — Model selection, failover, cost rates
- [Source: src/contracts/task.ts] — TaskDispatchPayload and TaskResult interfaces
- [Source: src/engine/subagent.ts] — Payload builder and size validator
- [Source: ROADMAP.md#Epic13] — Live Subagent Dispatch epic definition

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- Fixed TS exactOptionalPropertyTypes error in wave-executor.ts provider dispatch mapping
- Fixed Anthropic SDK APIError constructor in tests (requires Headers object — used prototype-based mock instead)

### Completion Notes List

- Created `SubagentProvider` interface as the core abstraction for AI task dispatch (NFR-12)
- Implemented `StubProvider` wrapping existing Alpha stub behavior — zero breaking changes
- Implemented `AnthropicProvider` with Messages API dispatch, model profile routing (FR-604), and automatic failover chains
- Created `resolveProvider()` factory — auto-detects ANTHROPIC_API_KEY for live dispatch, falls back to stub
- Made `executeWave()` and `executeWaves()` async with optional provider parameter — backward compatible (no provider = stub fallback)
- Updated execute handler to resolve provider and pass to wave execution
- Integrated real cost tracking — `TaskExecutionResult` now carries `tokensUsed` and `costUsd` from provider responses
- Execute handler accumulates real costs when available, falls back to STUB_COST_PER_TASK_USD otherwise
- Added `@anthropic-ai/sdk` ^0.52.0 as production dependency
- Added error codes PROVIDER_API_KEY_MISSING and PROVIDER_DISPATCH_FAILED
- Added i18n keys for provider errors in both EN and PT-BR locales
- All 2063 existing tests pass — zero regressions
- 20 new tests added across 3 test files (stub, anthropic, factory)

### Change Log

- 2026-03-22: Story 13.1 implemented — SubagentProvider abstraction with AnthropicProvider, StubProvider, factory, async wave execution, real cost tracking

### File List

- src/contracts/provider.ts (new) — SubagentProvider interface
- src/contracts/errors.ts (modified) — Added PROVIDER_API_KEY_MISSING, PROVIDER_DISPATCH_FAILED error codes
- src/contracts/index.ts (modified) — Export SubagentProvider type
- src/engine/providers/stub.ts (new) — StubProvider implementation
- src/engine/providers/anthropic.ts (new) — AnthropicProvider with Messages API, failover, cost tracking
- src/engine/providers/index.ts (new) — Provider factory and re-exports
- src/engine/wave-executor.ts (modified) — async executeWave/executeWaves with optional provider, tokensUsed/costUsd on TaskExecutionResult
- src/engine/index.ts (modified) — Export providers
- src/commands/execute/handler.ts (modified) — Resolve provider, pass to executeWave, accumulate real costs
- package.json (modified) — Added @anthropic-ai/sdk ^0.52.0 dependency
- locales/en.yaml (modified) — Added error.provider.* i18n keys
- locales/pt-br.yaml (modified) — Added error.provider.* i18n keys
- test/unit/engine/providers/stub.test.ts (new) — 6 tests for StubProvider
- test/unit/engine/providers/anthropic.test.ts (new) — 10 tests for AnthropicProvider
- test/unit/engine/providers/factory.test.ts (new) — 4 tests for resolveProvider factory
- test/unit/engine/wave-executor.test.ts (modified) — Updated to async for executeWave/executeWaves tests
