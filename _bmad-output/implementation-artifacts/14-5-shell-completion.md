# Story 14.5: Shell Completion

Status: review

## Story

As a developer using BuildPact from the terminal,
I want tab completion for all commands, flags, and common arguments,
so that I can navigate the CLI faster and discover available options without consulting documentation.

## Acceptance Criteria

1. **Completion Script Generation**
   - Given I run `bp completion bash`
   - When the command executes
   - Then it outputs a valid bash completion script to stdout
   - And the script can be sourced directly: `eval "$(bp completion bash)"`

2. **Multi-Shell Support**
   - Given I run `bp completion <shell>` with `bash`, `zsh`, or `fish`
   - When the command executes
   - Then it outputs a completion script specific to that shell's completion API
   - And each script registers completions for the `bp` command

3. **Command and Flag Completion**
   - Given the completion script is sourced and I type `bp ` then press Tab
   - When the shell queries completions
   - Then it suggests all registered commands: specify, plan, execute, verify, quick, squad, doctor, help, memory, status, diff, export-web, constitution, adopt, upgrade, quality, docs, orchestrate, investigate, optimize
   - And typing `bp plan --` suggests available flags for that command

4. **Invalid Shell Error**
   - Given I run `bp completion powershell`
   - When the command validates the shell argument
   - Then it returns an error with i18n key `cli.completion.invalid_shell` listing supported shells

5. **Installation Instructions**
   - Given I run `bp completion bash`
   - When the script is output
   - Then a comment header in the output explains how to install permanently (e.g., add to `.bashrc`)
   - And `bp completion --help` shows setup instructions for all three shells

## Tasks / Subtasks

- [x] Task 1: Create `src/commands/completion/handler.ts` — script generator (AC: #1, #2, #4)
  - [x] 1.1: Parse shell arg; validate against `['bash', 'zsh', 'fish']`; if invalid, return `err()` with `cli.completion.invalid_shell`
  - [x] 1.2: Import `CommandId` type from registry; extract all command names dynamically for forward-compatibility
  - [x] 1.3: Route to `generateBash()`, `generateZsh()`, or `generateFish()` based on shell arg
  - [x] 1.4: Output script to stdout via `process.stdout.write()` (not clack, since output is piped)

- [x] Task 2: Implement bash completion script (AC: #1, #3)
  - [x] 2.1: Generate `_bp_completions()` function using bash `complete -F` API
  - [x] 2.2: First-level completions: all command names from `CommandId`
  - [x] 2.3: Second-level completions: per-command flags (e.g., `plan` has `--research`, `--nyquist`, `--dry-run`; `quick` has `--discuss`, `--full`)
  - [x] 2.4: Add installation comment header: `# Add to ~/.bashrc: eval "$(bp completion bash)"`

- [x] Task 3: Implement zsh and fish completion scripts (AC: #2, #3)
  - [x] 3.1: Zsh: generate `#compdef bp` script using `_arguments` and `_describe` functions
  - [x] 3.2: Zsh: include command descriptions in completions (e.g., `specify:Capture natural language specifications`)
  - [x] 3.3: Fish: generate script using `complete -c bp` commands for each subcommand and flag
  - [x] 3.4: Fish: add `--description` for each completion entry

- [x] Task 4: Define per-command flag registry (AC: #3)
  - [x] 4.1: Create `src/commands/completion/flags.ts` exporting `COMMAND_FLAGS: Record<CommandId, Flag[]>` where `Flag = { name: string, description: string, takesValue: boolean }`
  - [x] 4.2: Populate flags for all existing commands by reading their `parseArgs` / option parsing logic
  - [x] 4.3: Include common global flags: `--help`, `--verbose`, `--lang`

- [x] Task 5: Wire command and add i18n (AC: all)
  - [x] 5.1: Create `src/commands/completion/index.ts` exporting `handler` as `CommandHandler`
  - [x] 5.2: Add `'completion'` to `CommandId` union in `src/commands/registry.ts`; add registry entry
  - [x] 5.3: Add i18n keys to `locales/en.yaml`: `cli.completion.invalid_shell`, `cli.completion.help`
  - [x] 5.4: Add same keys to `locales/pt-br.yaml`
  - [x] 5.5: Add unit tests in `test/unit/commands/completion.test.ts`; verify generated scripts contain expected commands

## Dev Notes

### Architecture Requirements
- Completion output goes to `process.stdout.write()` directly, NOT through `@clack/prompts`, since the output is meant to be `eval`'d or piped
- The handler still returns `Result<void>` for consistency but the primary output is stdout
- Named exports only, `.js` extensions on all imports (ESM)
- Flag registry should be the single source of truth for all command flags — other commands can reference it for `--help` output in the future
- Audit log: skip for completion (it is a utility command, not a pipeline action)

### Existing Code to Reuse
- `src/commands/registry.ts` — `CommandId` type for dynamic command list extraction
- `src/contracts/errors.ts` — `err()`, `ok()`, `ERROR_CODES`

### Project Structure Notes
- New command directory: `src/commands/completion/`
- Files: `index.ts` (CommandHandler), `handler.ts` (shell routing), `flags.ts` (flag registry), `bash.ts`, `zsh.ts`, `fish.ts` (per-shell generators)
- No template needed — pure TypeScript code generation

### References
- npm `tabtab` package — prior art for Node.js shell completion patterns
- Cobra (Go) completion API — inspiration for multi-shell support pattern

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
- Implemented completion command with bash, zsh, and fish generators
- Output goes to process.stdout.write (not clack) for piping/eval
- Created COMMAND_FLAGS registry as single source of truth for all command flags
- Bash: generates _bp_completions() with complete -F, per-command flag cases
- Zsh: generates #compdef script with _arguments and _describe
- Fish: generates complete -c commands with descriptions
- Each script includes installation instructions in comments
- Invalid shell returns cli.completion.invalid_shell error

### Change Log
- 2026-03-22: Implemented all tasks and subtasks

### File List
- src/commands/completion/handler.ts (new)
- src/commands/completion/index.ts (new)
- src/commands/completion/flags.ts (new: flag registry)
- src/commands/registry.ts (updated: added 'completion')
- locales/en.yaml (added cli.completion.* keys)
- locales/pt-br.yaml (added cli.completion.* keys)
- test/unit/commands/completion.test.ts (new)
