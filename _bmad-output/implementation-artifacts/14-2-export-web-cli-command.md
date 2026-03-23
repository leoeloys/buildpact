# Story 14.2: Export Web CLI Command

Status: review

## Story

As a developer who wants to continue work in a web-based AI chat,
I want to run `bp export-web <platform>` to generate a copiable prompt bundle optimized for my target platform,
so that I can paste my project context into Claude, ChatGPT, or Gemini without exceeding token limits.

## Acceptance Criteria

1. **Platform-Specific Bundle Generation**
   - Given I run `bp export-web claude`
   - When the bundle is assembled
   - Then it produces a single markdown file under `.buildpact/exports/` containing project context, constitution, specs, and plans
   - And the total estimated tokens stay within the platform limit (180K for Claude, 128K for ChatGPT, 1M for Gemini)

2. **Progressive Compression**
   - Given the raw bundle exceeds the target platform's token budget
   - When the export runs
   - Then it applies progressive compression stages: (1) remove code comments, (2) collapse whitespace, (3) summarize large files, (4) drop lowest-priority sections
   - And a compression report is shown indicating which stages were applied and how many tokens were saved

3. **Clipboard-Ready Output**
   - Given the export completes successfully
   - When the output file is written
   - Then the path is displayed and the user is prompted to copy to clipboard (if `pbcopy`/`xclip` is available)
   - And the bundle includes a header comment with platform name, token count, and generation timestamp

4. **Invalid Platform Error**
   - Given I run `bp export-web notion`
   - When the command validates the platform argument
   - Then it returns an error with i18n key `cli.export.invalid_platform` listing valid options

5. **Staleness Warning**
   - Given the project state has changed since the last export
   - When I run `bp export-web <platform>`
   - Then a warning is shown indicating the bundle may be stale relative to current project state

## Tasks / Subtasks

- [x] Task 1: Implement `src/commands/export-web/handler.ts` — main export logic (AC: #1, #4)
  - [x] 1.1: Parse platform arg; validate against `PLATFORM_LIMITS` keys from `src/foundation/bundle.ts`; if invalid, return `err()` with `cli.export.invalid_platform`
  - [x] 1.2: Call `assembleBundle(projectDir)` from `src/foundation/bundle.ts` to gather raw project context
  - [x] 1.3: Call `estimateTokens()` on assembled bundle; compare against `PLATFORM_LIMITS[platform]`
  - [x] 1.4: Write final bundle to `.buildpact/exports/${platform}-bundle-${timestamp}.md` with header comment

- [x] Task 2: Implement progressive compression pipeline (AC: #2)
  - [x] 2.1: Define compression stages as ordered array of `CompressionStage` objects in `src/commands/export-web/compressor.ts`
  - [x] 2.2: Stage 1 — strip code comments (single-line `//` and block `/* */`); re-estimate tokens
  - [x] 2.3: Stage 2 — collapse consecutive blank lines and trailing whitespace; re-estimate tokens
  - [x] 2.4: Stage 3 — summarize files over 500 lines to first 50 + last 20 lines with `[... N lines omitted]` marker
  - [x] 2.5: Stage 4 — drop lowest-priority sections (test files, docs, examples) based on priority map
  - [x] 2.6: After each stage, check if within budget; stop early if target is met; log savings per stage

- [x] Task 3: Implement clipboard and staleness features (AC: #3, #5)
  - [x] 3.1: Detect clipboard tool (`pbcopy` on macOS, `xclip` on Linux) via `which`; offer copy prompt using `clack.confirm()`
  - [x] 3.2: Compare `.buildpact/exports/` latest timestamp against `.buildpact/state.json` `lastModified`; if stale, show `clack.log.warn` with `cli.export.stale_warning`
  - [x] 3.3: Generate bundle header: `<!-- BuildPact Export | Platform: ${platform} | Tokens: ${count} | Generated: ${iso} -->`

- [x] Task 4: Replace NOT_IMPLEMENTED stub and add i18n (AC: all)
  - [x] 4.1: Update `src/commands/export-web/index.ts` to wire handler into `CommandHandler.run()`
  - [x] 4.2: Add i18n keys to `locales/en.yaml`: `cli.export.invalid_platform`, `cli.export.generating`, `cli.export.complete`, `cli.export.compression_report`, `cli.export.stale_warning`, `cli.export.copy_prompt`
  - [x] 4.3: Add same keys to `locales/pt-br.yaml`
  - [x] 4.4: Add unit tests in `test/unit/commands/export-web.test.ts`; mock filesystem and clipboard

## Dev Notes

### Architecture Requirements
- Follow Result<T, CliError> pattern for all public functions
- Use `@clack/prompts` for TUI output — no raw `console.log`
- Named exports only, `.js` extensions on all imports (ESM)
- Compressor module should be pure (no side effects) for easy unit testing
- Audit log: append `export-web.generate` action

### Existing Code to Reuse
- `src/foundation/bundle.ts` — `estimateTokens()`, `PLATFORM_LIMITS`, `assembleBundle()`, `BundleSection` type, `hashBundle()`
- `templates/commands/export-web.md` — existing orchestrator template for slash command flow
- `src/engine/output-versioning.ts` — versioning utilities for staleness detection
- `src/contracts/errors.ts` — `err()`, `ok()`, `ERROR_CODES`

### Project Structure Notes
- Handler goes in `src/commands/export-web/handler.ts`
- Compressor goes in `src/commands/export-web/compressor.ts`
- Export output goes to `.buildpact/exports/`

### References
- Epic 10 stories (10-1 through 10-5) — original web bundle export design as slash commands
- `src/foundation/bundle.ts` — already implements token estimation and platform limits

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
- Export-web handler already had full implementation from Epic 10 stories
- Added platform validation with cli.export.invalid_platform error for invalid platforms (previously silently defaulted to claude)
- Added clipboard detection (pbcopy/xclip) with confirm prompt
- Progressive compression was already fully implemented
- Staleness detection was already fully implemented
- Added i18n keys: cli.export.invalid_platform, cli.export.copy_prompt, cli.export.copied
- Updated parsePlatform to return undefined for invalid platform, updated test accordingly

### Change Log
- 2026-03-22: Added platform validation, clipboard support, and i18n keys

### File List
- src/commands/export-web/handler.ts (updated: platform validation, clipboard)
- locales/en.yaml (added cli.export.* keys)
- locales/pt-br.yaml (added cli.export.* keys)
- test/unit/commands/export-web.test.ts (updated: invalid platform test)
