# Story 13.6: Real Cost Tracking Integration

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer running live AI execution,
I want accurate cost projection before execution and a detailed cost summary afterward,
so that I can make informed decisions about budget and compare cost across model profiles.

## Acceptance Criteria

**AC-1: Before execution begins, display estimated cost projection based on task count and model average cost**

Given a plan has been loaded with N total tasks across W waves,
When the execute handler is about to start wave execution,
Then it displays an estimated cost projection: `Estimated cost: $X.XX ({N} tasks x ${model_avg_cost} per task on {profile_tier})`,
And the projection uses the active model profile's `costPer1kOutputUsd` rate with an estimated average token count per task,
And the user is shown the projection before any API calls are made,
And if a budget limit is configured, the projection warns when estimated cost exceeds the remaining budget.

**AC-2: During execution, accumulate real costs from TaskResult.costUsd**

Given tasks are completing via a live provider,
When each `TaskExecutionResult` is collected,
Then `sessionSpendUsd` accumulates the actual `costUsd` from each result,
And `updateDailySpend()` is called with real cost data after each wave,
And cost tracking works correctly for both successful and failed tasks (failed tasks may still have partial cost).

**AC-3: Budget guard checks use real accumulated cost, not STUB_COST_PER_TASK_USD**

Given the budget guard checks run before each wave,
When `checkBudget()` evaluates the session spend,
Then it uses the real accumulated `sessionSpendUsd` (sum of `TaskExecutionResult.costUsd` values),
And `STUB_COST_PER_TASK_USD` is NOT used when a live provider is active,
And budget warnings trigger at the configured `warningThreshold` (default 80%) of the limit,
And budget exceeded halts execution with a clear i18n message.

**AC-4: Cost summary displayed after execution shows total tokens, total cost, cost per wave, and profile comparison**

Given execution has completed (all waves or halted on failure),
When the post-execution summary is displayed,
Then it shows: total tokens used (input + output), total cost in USD, cost per wave breakdown,
And it shows a comparison: "With {alternative_profile} profile, estimated cost would be ${alt_cost}",
And the comparison uses the alternative profile's cost rates applied to the actual token counts,
And for the `quality` profile, the comparison shows `balanced` and `budget` alternatives; for `balanced`, it shows `quality` and `budget`.

**AC-5: STUB_COST_PER_TASK_USD only used when StubProvider is active (fallback)**

Given the provider resolved by `resolveProvider()` may be `StubProvider` or `AnthropicProvider`,
When cost tracking logic runs,
Then `STUB_COST_PER_TASK_USD` is used only when the active provider is `StubProvider` (identified by `provider.name === 'stub'`),
And when a live provider is active, all cost data comes from `TaskResult.costUsd` returned by the provider,
And cost display code gracefully handles `costUsd: 0` or `undefined` (treats as zero cost).

## Tasks / Subtasks

- [ ] Task 1: Implement pre-execution cost projection (AC: 1)
  - [ ] 1.1: Create `estimateExecutionCost(taskCount: number, profileTier: string, projectDir: string): Promise<CostProjection>` in `src/engine/cost-projector.ts`
  - [ ] 1.2: Calculate projection: `taskCount * estimatedAvgTokensPerTask * MODEL_CATALOG[activeModel].costPer1kOutputUsd / 1000` — use 2000 tokens as default avg estimate
  - [ ] 1.3: Return `CostProjection` with: `estimatedCostUsd`, `taskCount`, `modelId`, `profileTier`, `exceedsBudget` (compare with remaining budget)
  - [ ] 1.4: In execute handler, display projection via `clack.log.info()` before wave loop starts
  - [ ] 1.5: If `exceedsBudget` is true, show warning via `clack.log.warn()` with i18n message
  - [ ] 1.6: Write unit tests for cost projection calculation with different profiles and task counts

- [ ] Task 2: Ensure real cost accumulation during execution (AC: 2, 3)
  - [ ] 2.1: Audit execute handler cost accumulation logic — verify it sums `TaskExecutionResult.costUsd` (already partially done in 13-1)
  - [ ] 2.2: Ensure `updateDailySpend()` is called with real accumulated cost after each wave completes
  - [ ] 2.3: Ensure `checkBudget()` input uses the real `sessionSpendUsd` accumulated from live results
  - [ ] 2.4: Add guard: when `provider.name !== 'stub'`, do NOT fall back to `STUB_COST_PER_TASK_USD` for cost estimation
  - [ ] 2.5: Write test: verify budget guard with real cost data halts execution when limit exceeded

- [ ] Task 3: Build post-execution cost summary (AC: 4)
  - [ ] 3.1: Create `formatExecutionCostSummary(results: TaskExecutionResult[][], profileTier: string): string` in `src/engine/cost-projector.ts` — accepts results grouped by wave
  - [ ] 3.2: Calculate totals: total tokens (sum of `tokensUsed`), total cost (sum of `costUsd`), per-wave cost breakdown
  - [ ] 3.3: Calculate profile comparison: apply alternative profile cost rates to actual total tokens — show what the same execution would cost on other profiles
  - [ ] 3.4: Format as a multi-line summary suitable for `clack.log.info()` or `clack.note()`
  - [ ] 3.5: In execute handler, call and display the summary after the wave loop completes
  - [ ] 3.6: Write unit tests for summary formatting with various result combinations

- [ ] Task 4: Add profile comparison logic (AC: 4)
  - [ ] 4.1: Create `calculateProfileComparison(totalTokens: number, currentTier: string): ProfileComparison[]` in `src/engine/cost-projector.ts`
  - [ ] 4.2: For each alternative tier (excluding current), calculate: `totalTokens * MODEL_CATALOG[tierModel].costPer1kOutputUsd / 1000`
  - [ ] 4.3: Return array of `{ tier: string, estimatedCostUsd: number, savingsPercent: number }` sorted by cost
  - [ ] 4.4: Write unit tests: quality profile shows balanced/budget comparisons with correct savings percentages

- [ ] Task 5: Ensure StubProvider fallback and edge cases (AC: 5)
  - [ ] 5.1: Add provider name check in execute handler: `const isLive = provider.name !== 'stub'`
  - [ ] 5.2: When `isLive` is false, use `STUB_COST_PER_TASK_USD` for cost accumulation (existing Alpha behavior)
  - [ ] 5.3: When `isLive` is true, skip cost projection if `costUsd` is 0 or undefined on results (graceful handling)
  - [ ] 5.4: Skip profile comparison display when using StubProvider (comparison is meaningless with stub costs)
  - [ ] 5.5: Add i18n keys for cost projection, summary, and comparison messages in both `locales/en.yaml` and `locales/pt-br.yaml`
  - [ ] 5.6: Write test: StubProvider execution uses STUB_COST_PER_TASK_USD, live provider uses real costs

## Dev Notes

### Architecture Requirements

**Story 13-1 already wired real costs into budget accumulation.** The execute handler sums `TaskExecutionResult.costUsd` when available. This story adds: (1) pre-execution projection, (2) post-execution summary with profile comparison, and (3) ensuring budget guards use real data consistently.

**Profile comparison enables cost optimization decisions.** Users can see "you spent $2.40 on quality; balanced would have been $0.48" — this drives profile selection for future executions.

**Cost projection is an estimate, not a guarantee.** Use 2000 tokens as average output per task (based on typical code generation). The projection should be clearly labeled as an estimate.

### Existing Code to Reuse (DO NOT Reinvent)

| Component | Location | Reuse How |
|-----------|----------|-----------|
| `MODEL_CATALOG` | `src/engine/model-profile-manager.ts:66-85` | Cost rates per model |
| `PROFILE_TIERS` | `src/engine/model-profile-manager.ts:120-148` | Profile -> model mapping |
| `readActiveProfileTier()` | `src/engine/model-profile-manager.ts` | Get active profile tier |
| `resolveModelForOperation()` | `src/engine/model-profile-manager.ts` | Get model for operation type |
| `STUB_COST_PER_TASK_USD` | `src/engine/budget-guard.ts:14` | Stub cost constant (0.001) |
| `checkBudget()` | `src/engine/budget-guard.ts` | Budget limit enforcement |
| `updateDailySpend()` | `src/engine/budget-guard.ts` | Daily spend persistence |
| `readBudgetConfig()` | `src/engine/budget-guard.ts` | Budget limits from config |
| `formatCostSummary()` | `src/engine/budget-guard.ts` | Existing cost formatting (extend, don't replace) |
| `SubagentProvider.name` | `src/contracts/provider.ts` | Provider identification |
| `TaskExecutionResult.costUsd` | `src/engine/wave-executor.ts` | Per-task cost from provider |
| `TaskExecutionResult.tokensUsed` | `src/engine/wave-executor.ts` | Per-task token usage |

### Key Implementation Details

**CostProjection type:**
```typescript
interface CostProjection {
  estimatedCostUsd: number
  taskCount: number
  modelId: string
  profileTier: string
  estimatedTokensPerTask: number
  exceedsBudget: boolean
  budgetRemainingUsd?: number
}
```

**Profile comparison calculation:**
```typescript
// Current tier: quality, model: claude-opus-4-6, rate: $0.075/1k
// Total tokens: 50000
// Quality cost: 50000 * 0.075 / 1000 = $3.75
// Balanced (sonnet): 50000 * 0.015 / 1000 = $0.75 (80% savings)
// Budget (haiku): 50000 * 0.00125 / 1000 = $0.0625 (98% savings)
```

**Post-execution summary format:**
```
╭─────────────────────────────────────╮
│ Execution Cost Summary              │
│                                     │
│ Total tokens: 47,832                │
│ Total cost:   $3.59                 │
│                                     │
│ Wave 1: $1.22 (3 tasks)             │
│ Wave 2: $1.89 (4 tasks)             │
│ Wave 3: $0.48 (2 tasks)             │
│                                     │
│ Profile comparison:                 │
│  balanced → $0.72 (80% savings)     │
│  budget   → $0.06 (98% savings)     │
╰─────────────────────────────────────╯
```

### Previous Story Learnings (from 13-1, 13-2)

- **Result type universal** — cost projector returns `Result<CostProjection, CliError>`
- **Injectable I/O pattern** — projector should accept injected profile reader for testability
- **exactOptionalPropertyTypes** — use conditional inclusion for optional fields
- **ESM imports** — always `.js` extension
- **i18n required** — cost messages shown to user need EN + PT-BR keys
- **Factory + opts() helpers** in tests for DRY fixtures

### Project Structure Notes

```
src/engine/cost-projector.ts           (new) — estimateExecutionCost, formatExecutionCostSummary, calculateProfileComparison
src/commands/execute/handler.ts        (modify) — pre/post cost display, provider name check
src/engine/budget-guard.ts             (existing) — no changes needed, already correct
locales/en.yaml                        (modify) — add cost projection/summary i18n keys
locales/pt-br.yaml                     (modify) — add cost projection/summary i18n keys
test/unit/engine/cost-projector.test.ts      (new)
test/unit/commands/execute-cost.test.ts      (new)
```

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-705] — Budget Guards
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-604] — Model Profiles with Failover Chains
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-105] — Real-Time Context and Cost Monitoring
- [Source: src/engine/budget-guard.ts] — Budget checking, daily spend, STUB_COST_PER_TASK_USD
- [Source: src/engine/model-profile-manager.ts] — MODEL_CATALOG, PROFILE_TIERS, cost rates
- [Source: src/engine/wave-executor.ts] — TaskExecutionResult with costUsd, tokensUsed
- [Source: src/commands/execute/handler.ts] — Cost accumulation loop
- [Source: _bmad-output/implementation-artifacts/13-1-subagent-provider-abstraction.md] — Real cost tracking integration (partial)
- [Source: ROADMAP.md#Epic13] — Live Subagent Dispatch epic definition

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

### Completion Notes List

### File List
