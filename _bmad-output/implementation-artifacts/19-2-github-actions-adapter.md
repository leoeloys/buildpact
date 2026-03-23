# Story 19.2: GitHub Actions Adapter

Status: done

## Story

As a team lead integrating BuildPact into our GitHub Actions workflow,
I want a reusable GitHub Action that runs BuildPact commands and reports results as check annotations,
So that AI-assisted tasks are part of our automated CI/CD pipeline.

**FRs:** FR-1505, FR-1506, FR-1507
**Priority:** SHOULD (FR-1506)
**Depends on:** Story 19-1 (Non-Interactive Mode Hardening) — the `--ci` flag must be fully functional before this story begins.

## Acceptance Criteria

**AC-1: Composite Action Installs and Runs BuildPact**

Given a repository with a GitHub Actions workflow
When the workflow includes `uses: buildpact/action@v1` with `command: plan`
Then BuildPact installs via `npm install -g buildpact`, runs `buildpact plan --ci`, and completes without manual intervention
And exit code 0 indicates success, non-zero indicates failure

**AC-2: Budget Guard Enforcement**

Given the action configuration
When user specifies `budget: 1.00`
Then a `.buildpact/config.yaml` budget block is written with `per_session_usd: 1.00` before execution
And the budget guard halts execution if projected costs exceed $1.00
And the action exits with a non-zero code and a clear error message when budget is exceeded

**AC-3: Failed Tasks as Check Annotations**

Given a BuildPact execution fails in CI
When the action completes
Then failed tasks appear as GitHub check annotations using `::error file={path},line={line}::{message}` workflow commands
And each annotation includes: file path (when available), error message, and fix suggestion (when available)
And the action step summary includes the full error list

**AC-4: PR Comment with Execution Summary**

Given the action runs successfully on a `pull_request` event
When the workflow completes
Then an execution summary is posted as a PR comment using the GitHub API (`$GITHUB_TOKEN`)
And the comment contains: tasks completed count, cost incurred (USD), time elapsed, command executed
And repeated runs update the existing comment (identified by a marker) rather than posting duplicates

**AC-5: Composite Action Definition**

Given the action source code at `action.yml` (repo root)
When a developer inspects it
Then it is a composite action (not Docker-based) with the following inputs:
- `command` (required) — BuildPact command to run (plan, execute, quick, verify, etc.)
- `plan` (optional) — path to an existing plan file for execute/verify commands
- `budget` (optional, default `"1.00"`) — maximum session budget in USD
- `ci-mode` (optional, default `"true"`) — enables `--ci` flag (can be disabled for debugging)
- `node-version` (optional, default `"22"`) — Node.js version to use
- `buildpact-version` (optional, default `"latest"`) — BuildPact npm version to install
And it has the following outputs:
- `exit-code` — the BuildPact command exit code
- `cost` — total cost incurred in USD
- `summary` — one-line execution summary

## Tasks / Subtasks

- [x] Task 1: Create composite action definition (AC: #5)
  - [x] 1.1: Create `action.yml` at repo root defining a composite action with all specified inputs and outputs
  - [x] 1.2: Define steps: setup Node.js via `actions/setup-node@v4`, install BuildPact globally, configure budget, run command, post-process results
  - [x] 1.3: Add input validation step that fails early if `command` is empty or contains disallowed characters (injection prevention)

- [x] Task 2: Budget guard integration (AC: #2)
  - [x] 2.1: Create `action/setup-budget.sh` — shell script that writes `.buildpact/config.yaml` with `per_session_usd` from the `budget` input before command execution
  - [x] 2.2: Script must preserve existing config.yaml content if present (merge, not overwrite) — read existing file, update only the budget block
  - [x] 2.3: Add guard that skips budget setup if `budget` input is empty or `"0"`

- [x] Task 3: Command execution with output capture (AC: #1, #3)
  - [x] 3.1: Create `action/run-command.sh` — shell script that invokes `buildpact <command> --ci` with proper argument forwarding
  - [x] 3.2: Capture stdout/stderr to files (`$RUNNER_TEMP/bp-stdout.txt`, `$RUNNER_TEMP/bp-stderr.txt`) while also streaming to the console
  - [x] 3.3: Extract exit code, cost summary, and task results from captured output
  - [x] 3.4: Write outputs (`exit-code`, `cost`, `summary`) to `$GITHUB_OUTPUT`
  - [x] 3.5: Pass `--plan <path>` argument when the `plan` input is provided
  - [x] 3.6: Set `BP_CI=true` environment variable unconditionally (belt-and-suspenders with `--ci` flag)

- [x] Task 4: Check annotations for failures (AC: #3)
  - [x] 4.1: Create `action/annotate-failures.sh` — parses BuildPact stderr/stdout for task failure patterns
  - [x] 4.2: Emit `::error file=<path>,line=<line>::<message>` for each failed task that includes a file path
  - [x] 4.3: Emit `::error ::<message>` for failures without file context
  - [x] 4.4: Write a step summary (`$GITHUB_STEP_SUMMARY`) with a markdown table of all failures (file, error, suggestion)

- [x] Task 5: PR comment summary (AC: #4)
  - [x] 5.1: Create `action/post-pr-comment.sh` — posts/updates a PR comment via GitHub REST API using `$GITHUB_TOKEN`
  - [x] 5.2: Use a hidden HTML marker (`<!-- buildpact-summary -->`) to identify existing comments for update-in-place
  - [x] 5.3: Comment body includes: BuildPact logo/header, command executed, tasks completed, cost incurred, time elapsed, budget remaining, and a link to the workflow run
  - [x] 5.4: Skip PR comment when not running on `pull_request` event (check `$GITHUB_EVENT_NAME`)
  - [x] 5.5: Gracefully handle missing `$GITHUB_TOKEN` — warn but do not fail the action

- [x] Task 6: Testing (AC: all)
  - [x] 6.1: Create `test/unit/action/action-yml.test.ts` — validates `action.yml` is valid YAML, has required inputs, correct defaults, uses composite `runs.using`
  - [x] 6.2: Create `test/unit/action/setup-budget.test.ts` — unit tests for budget config writing (new file, existing file merge, skip on zero)
  - [x] 6.3: Create `test/unit/action/annotate-failures.test.ts` — tests annotation output parsing from sample BuildPact error output
  - [x] 6.4: Create `test/unit/action/pr-comment.test.ts` — tests comment body generation and marker detection

- [x] Task 7: Documentation and examples (AC: #1, #5)
  - [x] 7.1: Create `action/README.md` with usage examples covering: basic plan, execute with budget, custom node version, multiple commands in a matrix
  - [x] 7.2: Create `action/examples/basic-plan.yml` — minimal workflow example
  - [x] 7.3: Create `action/examples/full-pipeline.yml` — specify, plan, execute, verify as separate jobs with artifact passing

## Dev Notes

### Architecture Decisions

- **Composite action, not Docker**: Composite actions run directly on the runner, avoiding container build time. This is critical for fast CI — Docker-based actions add 30-60s of overhead. The action uses shell scripts (`bash`) for maximum portability across GitHub-hosted runners.
- **Shell scripts in `action/` directory**: Keep all action-related scripts in an `action/` directory at the repo root. This directory will be extracted to its own repo (`buildpact/action`) later when the action is published to the GitHub Marketplace.
- **Budget injection via config file**: Rather than passing budget as a CLI argument (which would require changes to every command handler), the action writes the budget to `.buildpact/config.yaml` before execution. The existing `readBudgetConfig()` in `src/engine/budget-guard.ts` already reads from this path — no engine changes needed.
- **Update-in-place PR comments**: Using a hidden HTML marker prevents comment spam on PRs with many pushes. The GitHub REST API `PATCH /repos/{owner}/{repo}/issues/{issue_number}/comments/{comment_id}` is used for updates.

### Existing Code to Leverage

- `src/engine/budget-guard.ts` — `readBudgetConfig()`, `checkBudget()`, `formatCostSummary()` — all budget logic already exists
- `src/contracts/errors.ts` — `ERROR_CODES.BUDGET_EXCEEDED` already defined
- `.github/workflows/test.yml` — existing CI pattern (Node.js setup, npm ci, test) to reference
- `.github/workflows/squad-validate.yml` — PR-triggered workflow pattern
- `src/cli/index.ts` — exit code handling already returns non-zero on error (`process.exit(1)`)

### Output Parsing Contract

BuildPact `--ci` mode (from story 19-1) must produce machine-parseable output. The action scripts will parse:
- **Exit code**: 0 = success, 1 = failure, 2 = budget exceeded
- **Cost line**: `[ci:cost] $X.XXXX` written to stdout (convention from 19-1)
- **Task failures**: `[ci:error] file=<path> line=<line> message=<msg>` written to stderr (convention from 19-1)
- **Summary line**: `[ci:summary] <tasks_completed>/<tasks_total> tasks, $<cost> spent, <duration>s elapsed`

These `[ci:*]` prefixed lines are the contract between the CLI and the action scripts. If story 19-1 uses a different format, update the parsing scripts accordingly.

### Security Considerations

- **No hardcoded API keys**: AI provider keys (e.g., `ANTHROPIC_API_KEY`) must be passed as environment variables by the user in their workflow file, never stored in the action
- **Token permissions**: `$GITHUB_TOKEN` needs `pull-requests: write` permission for PR comments and `checks: write` for annotations
- **Input sanitization**: The `command` input is validated against an allowlist of known BuildPact commands to prevent shell injection
- **Budget as guardrail**: The budget guard prevents runaway costs in CI — the default $1.00 limit is intentionally conservative

### File Structure

```
action.yml                          # Composite action definition (repo root)
action/
  setup-budget.sh                   # Budget config writer
  run-command.sh                    # Command executor with output capture
  annotate-failures.sh              # Check annotation emitter
  post-pr-comment.sh                # PR comment poster/updater
  README.md                         # Action usage documentation
  examples/
    basic-plan.yml                  # Minimal workflow example
    full-pipeline.yml               # Multi-job pipeline example
test/unit/action/
  action-yml.test.ts                # Action definition validation
  setup-budget.test.ts              # Budget setup tests
  annotate-failures.test.ts         # Annotation parsing tests
  pr-comment.test.ts                # Comment generation tests
```

### Example Usage (for reference during implementation)

```yaml
# .github/workflows/buildpact.yml
name: BuildPact Pipeline
on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: buildpact/action@v1
        with:
          command: plan
          budget: "2.00"
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Anti-Patterns to Avoid

- **No Docker-based action** — composite only, for speed
- **No hardcoded API keys** — require via env inputs
- **No provider lock-in** — action is provider-agnostic; users pass their own keys
- **No budget bypass** — budget guard always runs; even `budget: "0"` means "no limit" (not "skip guard")
- **No duplicate PR comments** — always update-in-place via marker

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 + Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- Composite action at `action.yml` with all 6 inputs and 3 outputs
- 4 shell scripts in `action/`: setup-budget.sh, run-command.sh, annotate-failures.sh, post-pr-comment.sh
- Action README with usage docs
- 2 example workflows: basic-plan.yml and full-pipeline.yml
- 4 test files (47 tests) covering action.yml validation, budget setup, annotation parsing, PR comment generation
- Command input validated against allowlist for injection prevention
- PR comment uses update-in-place via `<!-- buildpact-summary -->` marker

### File List

- action.yml (new)
- action/setup-budget.sh (new)
- action/run-command.sh (new)
- action/annotate-failures.sh (new)
- action/post-pr-comment.sh (new)
- action/README.md (new)
- action/examples/basic-plan.yml (new)
- action/examples/full-pipeline.yml (new)
- test/unit/action/action-yml.test.ts (new)
- test/unit/action/setup-budget.test.ts (new)
- test/unit/action/annotate-failures.test.ts (new)
- test/unit/action/pr-comment.test.ts (new)

### Change Log
- Story created by create-story workflow (Date: 2026-03-22)
- Implementation completed (Date: 2026-03-22)
