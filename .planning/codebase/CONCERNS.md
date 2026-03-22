# Codebase Concerns

**Analysis Date:** 2026-03-22

---

## Tech Debt

**Alpha stub execution — execute pipeline does not call real AI:**
- Issue: `executeWave()` calls `executeTaskStub()`, which returns a synthetic success result without dispatching to any AI provider. The `AnthropicProvider` exists and is wired, but the wave executor never calls it.
- Files: `src/engine/wave-executor.ts:153`, `src/engine/providers/anthropic.ts`
- Impact: `/bp:execute` produces zero actual work in all deployments. Budget and cost tracking run against stub costs (`STUB_COST_PER_TASK_USD = $0.001`), not real API spend.
- Fix approach: Replace `executeTaskStub(task)` in `executeTaskWithValidation()` with a call to the resolved `SubagentProvider.dispatch()`. Wire provider resolution (`resolveProvider()`) into `executeWave()` via options.

**Research agents are pure stubs — return hardcoded BuildPact-specific findings:**
- Issue: `researchTechStack()`, `researchCodebase()`, `researchSquadConstraints()` in `src/commands/plan/researcher.ts` and `buildStubFindings()` in `src/commands/plan/handler.ts:404` return hardcoded strings describing *BuildPact's own* architecture (e.g., "Layer structure: contracts → foundation → engine → commands → cli"). These findings are injected into every plan regardless of the target project.
- Files: `src/commands/plan/researcher.ts:86`, `src/commands/plan/handler.ts:404–424`
- Impact: Plans generated for any user project contain incorrect, BuildPact-specific context. High risk of plan quality degradation when users run `/bp:plan` on non-TypeScript projects.
- Fix approach: Replace stubs with real Task() dispatch (FR-601). Payload builders (`buildTechStackPayload`, etc.) are already wired but their return values are discarded.

**Monitor (context/cost tracking) returns NOT_IMPLEMENTED for all calls:**
- Issue: `getContextUsage()` and `getCostState()` in `src/foundation/monitor.ts` always return `err({ code: ERROR_CODES.NOT_IMPLEMENTED })`. No caller in the codebase exercises these functions today.
- Files: `src/foundation/monitor.ts:59–73`
- Impact: FR-303 (real-time context & cost monitoring) is fully absent. Budget guard relies on stub cost accumulation only.
- Fix approach: Integrate Claude API token count via `usage` field already available in `AnthropicProvider.dispatch()` response (lines 88–91) — plumb `tokensUsed` up to the monitor.

**Optimize command experiment loop exits after one stub iteration:**
- Issue: The optimize command loop is explicitly stopped after one iteration with `stopSession(session, 'session_time_exhausted')` to prevent an infinite loop in alpha. Real subagent dispatch is commented out.
- Files: `src/commands/optimize/handler.ts:306–329`
- Impact: `/bp:optimize` is non-functional for production use. Users receive a stub outcome record.
- Fix approach: Replace stub block with real subagent dispatch; remove the forced stop.

**`memory clear` subcommand shows preview only — deletion not implemented:**
- Issue: The `clear` subcommand in `src/commands/memory/handler.ts:364` logs "Run with actual deletion not yet implemented. This is a preview." and never deletes files.
- Files: `src/commands/memory/handler.ts:355–373`
- Impact: Users cannot clear memory tiers via CLI.
- Fix approach: Add `rm` / `unlink` calls for the JSON files listed in the preview.

**`plan/researcher.ts` payload builders are called but return `void` — result discarded:**
- Issue: `buildTechStackPayload()`, `buildCodebasePayload()`, `buildSquadConstraintsPayload()` call `buildTaskPayload()` but are typed as `void` functions — the constructed `TaskDispatchPayload` is silently discarded.
- Files: `src/commands/plan/researcher.ts:16–75`
- Impact: Work is done to build payloads that go nowhere. When real Task() dispatch is implemented, these need to return the payload.
- Fix approach: Change return type to `TaskDispatchPayload` and return the result of `buildTaskPayload()`.

**`quick/plan-verifier.ts` semantic step generation deferred:**
- Issue: Comment `// TODO(Beta): Use description for semantic step generation via LLM` in `src/commands/quick/plan-verifier.ts:58` marks a gap in plan verification quality.
- Files: `src/commands/quick/plan-verifier.ts:58`
- Impact: Plan step generation is keyword-based only; semantic gaps are not caught.
- Fix approach: Wire LLM call when SubagentProvider is available.

**Constitution enforcement is structural pattern-matching only, not semantic:**
- Issue: `enforceConstitution()` detects violations by string matching prohibited terms and proximity of override keywords. Comment `// TODO(Beta): Replace structural check with LLM subagent semantic validation` explicitly marks this as temporary.
- Files: `src/foundation/constitution.ts:217`
- Impact: False positives (innocuous uses of prohibited words) and false negatives (semantically violating output that avoids exact terms) are both possible.
- Fix approach: Add LLM subagent validation call in Beta per FR-202.

**Scale router and readiness gate reference undefined FR numbers:**
- Issue: `src/engine/scale-router.ts:1` and `src/engine/readiness-gate.ts:1` both start with `// FR-XXX` — no requirement number assigned.
- Files: `src/engine/scale-router.ts:1`, `src/engine/readiness-gate.ts:1`
- Impact: These modules cannot be traced to formal requirements. Unclear if they are complete per spec.
- Fix approach: Assign FR numbers during Beta requirement review.

**Execution lock module exists but is never imported by the execute handler:**
- Issue: `src/engine/execution-lock.ts` provides `acquireExecutionLock()` / `releaseExecutionLock()` but no command handler imports it. The execute handler has no lock guard.
- Files: `src/engine/execution-lock.ts`, `src/commands/execute/handler.ts`
- Impact: Concurrent `/bp:execute` invocations on the same spec can run simultaneously, potentially corrupting plan state and audit logs.
- Fix approach: Import and call `acquireExecutionLock()` at the start of `execute/handler.ts` run method; call `releaseExecutionLock()` in the finally block.

---

## Known Bugs

**`acquireExecutionLock` returns `acquired: false` when stale lock is removed:**
- Symptoms: When a stale lock is detected and removed, the function returns `{ acquired: false, reason: 'stale_removed' }` instead of `{ acquired: true }`. Any caller treating `acquired: false` as a lock conflict would incorrectly block execution.
- Files: `src/engine/execution-lock.ts:50–51`
- Trigger: Execute is invoked after a previous session crashed and left a lock older than 30 minutes.
- Workaround: Not applicable — lock module is not yet integrated.

**`AnthropicProvider` extracts response `text` variable but never includes it in `TaskResult`:**
- Symptoms: The AI model's text response is parsed into `text` (line 94–97) but the returned `TaskResult` has `artifacts: []` and no `content` field. The text is silently discarded.
- Files: `src/engine/providers/anthropic.ts:94–104`
- Trigger: Every real API call when `ANTHROPIC_API_KEY` is set.
- Workaround: None — output from real API calls is lost. Downstream wave verification and verification steps receive no content to check.

**`stale_removed` return value is a silent false — caller cannot distinguish from conflict:**
- Symptoms: See execution lock bug above. No caller currently uses the lock, but when integrated, this needs fixing.
- Files: `src/engine/execution-lock.ts:51`

---

## Security Considerations

**No path traversal validation on user-supplied plan directory argument:**
- Risk: `execute/handler.ts` accepts `args[0]` as a raw `planDir` path. A user could pass `../../etc` or an arbitrary path.
- Files: `src/commands/execute/handler.ts:223–225`
- Current mitigation: No sanitization exists.
- Recommendations: Validate that `args[0]` is inside `projectDir` or is a subdirectory of `.buildpact/plans/`. Use `path.resolve()` + prefix check.

**`require('node:fs')` in ESM module (diagnostician) — CJS/ESM boundary risk:**
- Risk: Two `require()` calls in `src/foundation/diagnostician.ts:205,262` use CommonJS require inside an ESM module. This works in Node.js due to CJS interop but is fragile and can break under strict ESM or bundlers.
- Files: `src/foundation/diagnostician.ts:205`, `src/foundation/diagnostician.ts:262`
- Current mitigation: Works at runtime due to Node.js CJS interop.
- Recommendations: Replace with the already-imported `readFileSync` at the top of the file (`import { readFileSync } from 'node:fs'` is missing — add it or use the async variant).

**API key passed via environment — no validation of key format:**
- Risk: `resolveProvider()` uses `process.env['ANTHROPIC_API_KEY']` with no format validation. A misconfigured key silently falls through to `StubProvider` if blank, but a malformed non-empty key causes API errors at dispatch time with no pre-flight check.
- Files: `src/engine/providers/index.ts:29–31`
- Current mitigation: None.
- Recommendations: Add a prefix check (`sk-ant-` pattern) and warn the user if the key format is invalid.

**Cost computation uses a hardcoded 1/5 input:output ratio:**
- Risk: `computeCost()` in `src/engine/providers/anthropic.ts:147` uses `model.costPer1kOutputUsd / 5` for input tokens, hardcoding a 5:1 pricing ratio. Actual Anthropic pricing varies per model and changes with API updates.
- Files: `src/engine/providers/anthropic.ts:142–148`
- Current mitigation: Code comment acknowledges this is a conservative estimate.
- Recommendations: Add `costPer1kInputUsd` field to `ModelConfig` in `src/engine/model-profile-manager.ts` and use it directly.

---

## Performance Bottlenecks

**`diagnostician.ts` uses `execFileSync` (blocking) for git operations:**
- Problem: `execFileSync('git', ['log', ...])` and `execFileSync('grep', [...])` in `src/foundation/diagnostician.ts:232,387,397` block the Node.js event loop during project scanning.
- Files: `src/foundation/diagnostician.ts:232`, `src/foundation/diagnostician.ts:387`, `src/foundation/diagnostician.ts:397`
- Cause: Synchronous child process calls in a file scanning loop.
- Improvement path: Replace with `execFile` (async) or `execFileAsync` wrapper using `node:util.promisify`.

**`i18n.ts` reads locale files synchronously at module load time:**
- Problem: `readFileSync` in `src/foundation/i18n.ts:62` blocks on locale file reads when `createI18n()` is first called. Called in every command handler.
- Files: `src/foundation/i18n.ts:62`
- Cause: Synchronous file I/O on startup path.
- Improvement path: Cache at module level after first load; alternatively use async init with lazy loading.

**`plan/handler.ts` and `specify/handler.ts` are 1250 and 1202 lines respectively:**
- Problem: Both files contain mixed responsibilities — data transformation, I/O, UI flow, business logic, and type definitions — making profiling and optimization difficult.
- Files: `src/commands/plan/handler.ts`, `src/commands/specify/handler.ts`
- Cause: Incremental feature growth without extraction.
- Improvement path: Extract pure data transformation functions into dedicated modules (types already in `src/commands/plan/types.ts`).

**Wave executor runs tasks synchronously (`.map()` loop), not in parallel:**
- Problem: `executeWave()` in `src/engine/wave-executor.ts:220` uses `tasks.map(task => {...})` — a synchronous loop — despite the architectural intent of parallel dispatch. In production with real async `dispatch()`, this must become `Promise.all()`.
- Files: `src/engine/wave-executor.ts:220`
- Cause: Alpha stub execution is synchronous; parallel structure not yet built.
- Improvement path: Wrap dispatches in `Promise.all()` with `createLimiter()` from `src/engine/concurrency.ts` (already exported from engine index).

---

## Fragile Areas

**Hand-rolled YAML parser used for i18n locale files:**
- Files: `src/foundation/i18n.ts:14–47`, `src/foundation/profile.ts`
- Why fragile: Custom indent-based YAML parser does not handle multi-line values, anchors, aliases, quoted colons in values, or YAML arrays. Locale strings containing `:` or irregular indentation silently produce wrong keys.
- Safe modification: Only add locale entries with simple `key: "value"` format. Test with `vitest` after any locale file change.
- Test coverage: Unit tests exist for i18n but cover only happy paths.

**Hand-rolled YAML parser used for model profile config:**
- Files: `src/foundation/profile.ts:70–160`, `src/engine/model-profile-manager.ts`
- Why fragile: A second independent custom YAML parser for `.buildpact/profiles/*.yaml`. Does not share code with the i18n parser. Inline arrays (`[...]`) are partially supported via JSON.parse fallback only.
- Safe modification: Keep profile YAML strictly simple; avoid nested arrays or complex structures.
- Test coverage: `test/unit/foundation/profile.test.ts` exists.

**`model-profile-manager.ts` uses 8 non-null assertions (`!`) on `MODEL_CATALOG` lookups:**
- Files: `src/engine/model-profile-manager.ts:125–301`
- Why fragile: `MODEL_CATALOG['claude-sonnet-4-6']!` will throw a runtime error if a model ID is renamed or removed from the catalog. ESLint suppression comments acknowledge the risk.
- Safe modification: Never remove or rename entries in `MODEL_CATALOG` without updating all `!` assertion sites.
- Test coverage: Partial — tests do not cover catalog key removal scenarios.

**Execution lock uses synchronous file I/O (`writeFileSync`, `unlinkSync`) with no atomic write:**
- Files: `src/engine/execution-lock.ts:82–90`
- Why fragile: If the process crashes between `unlinkSync` (stale removal) and `writeFileSync` (new lock), no lock is held and another process can also pass the check — creating a TOCTOU race.
- Safe modification: Not safe to modify without replacing with atomic rename-based locking (write to temp file, then rename).
- Test coverage: `test/unit/engine/squad-lock.test.ts` covers squad lock, but no test covers execution lock.

**`readiness-gate.ts` checks for `nyquist-report.md` status via fragile string match:**
- Files: `src/engine/readiness-gate.ts:121–124`
- Why fragile: `checkNyquistPassed()` searches for the strings `'status: pass'`, `'**PASS**'`, or `'✓ PASS'`. Any change to the Nyquist report format (capitalization, markdown style) silently breaks the gate.
- Safe modification: Keep Nyquist report output format consistent with these exact strings.
- Test coverage: No tests found for `readiness-gate.ts`.

---

## Scaling Limits

**Payload size capped at 20KB per task (NFR-02):**
- Current capacity: 20,480 bytes per `TaskDispatchPayload`
- Limit: Tasks with large plan content or extensive codebase context will fail with `PAYLOAD_TOO_LARGE` before reaching the AI.
- Scaling path: Increase `MAX_PAYLOAD_BYTES` in `src/engine/subagent.ts:14` and re-evaluate NFR-02 per provider context window limits.

**Concurrent wave tasks bounded only by JavaScript event loop (no real limiter wired):**
- Current capacity: All tasks in a wave are dispatched at once (Alpha: synchronously in a map loop).
- Limit: In production with real async dispatch, without the `createLimiter()` wiring, large waves could exhaust API rate limits simultaneously.
- Scaling path: Wire `createLimiter(config.maxParallelTasks)` from `src/engine/execution-config.ts` into `executeWave()`.

---

## Dependencies at Risk

**`@anthropic-ai/sdk` — sole AI provider:**
- Risk: The entire dispatch path depends on one SDK. No abstraction for provider switching at the HTTP level (only a provider interface abstraction above it).
- Impact: An Anthropic API breaking change or SDK major version bump requires updates across `src/engine/providers/anthropic.ts`.
- Migration plan: `SubagentProvider` interface in `src/contracts/provider.ts` is the correct abstraction; additional providers (OpenAI, Gemini) can be added at `src/engine/providers/`.

**`@clack/prompts` — all interactive UI depends on one TUI library:**
- Risk: All 20+ command handlers use `@clack/prompts` directly. No adapter layer.
- Impact: A breaking change in `@clack/prompts` requires changes across every command.
- Migration plan: The `TuiAdapter` interface in `src/engine/progress-renderer.ts` shows the intent — extend this pattern to all commands.

---

## Missing Critical Features

**No real AI dispatch in `/bp:execute`:**
- Problem: The core value proposition (running AI agents to execute tasks) produces no AI output. All waves complete with stub results.
- Blocks: Production use of the execute pipeline, budget tracking accuracy, wave verification, and audit trail value.

**No real-time context or cost monitoring:**
- Problem: `getContextUsage()` and `getCostState()` are not implemented (FR-303). Users have no visibility into token consumption during execution.
- Blocks: Context warning thresholds (50%/75%) are defined but never triggered.

**Memory `clear` subcommand is a preview with no actual deletion:**
- Problem: Users cannot clear session, lessons, or decisions memory tiers.
- Blocks: Memory hygiene workflows.

---

## Test Coverage Gaps

**`src/engine/execution-lock.ts` — no test file found:**
- What's not tested: Lock acquisition, stale lock removal, conflict detection, TOCTOU race behavior.
- Files: `src/engine/execution-lock.ts`
- Risk: The stale-removal bug (returning `acquired: false`) goes undetected.
- Priority: High (when lock is integrated into execute handler)

**`src/engine/readiness-gate.ts` — no test file found:**
- What's not tested: All 7 readiness checks, `PASS`/`CONCERNS`/`FAIL` decision logic, Nyquist string matching.
- Files: `src/engine/readiness-gate.ts`
- Risk: Gate logic regressions are invisible.
- Priority: High

**`src/engine/scale-router.ts` — no test file found:**
- What's not tested: Complexity scoring algorithm, scale level assignments, force-level override.
- Files: `src/engine/scale-router.ts`
- Risk: Incorrect routing recommendations go undetected.
- Priority: Medium

**`src/engine/providers/anthropic.ts` — real API integration not tested:**
- What's not tested: Actual `messages.create()` response parsing, `text` variable discarded (bug), failover chain execution with real HTTP errors.
- Files: `src/engine/providers/anthropic.ts`, `test/unit/engine/providers/anthropic.test.ts`
- Risk: The "text is silently discarded" bug is not caught by any test.
- Priority: High

**`src/foundation/monitor.ts` — exported but no callers and no tests:**
- What's not tested: `getContextUsage()`, `getCostState()` integration with execute pipeline.
- Files: `src/foundation/monitor.ts`
- Risk: Dead code accumulation; any Beta integration work starts from an untested base.
- Priority: Low (blocked by stub nature)

---

*Concerns audit: 2026-03-22*
