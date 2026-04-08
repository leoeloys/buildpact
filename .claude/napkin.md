# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-04-01] Disk space critically low on internal drive (~470MB free)**
   Do instead: Avoid agent subprocesses that write to /tmp. Use Read/Edit/Grep directly. External drive /Volumes/Leo has 887GB free.

2. **[2026-04-01] Section numbering drifts when inserting content into large specs**
   Do instead: After every insertion, grep `^## [0-9]+\.` and fix duplicates immediately before proceeding.

3. **[2026-04-01] Spec distillation before planning is essential**
   Do instead: Always distill large specs (>1000 lines) using `/bp:distill` before feeding to `/bp:plan`. Target 90% compression.

## Architecture & Patterns
1. **[2026-04-01] BuildPact uses enforcement programatico, not prompt pressure**
   Do instead: Implement concepts as TypeScript modules with gates/validators, not as .md skills that "ask" the LLM.

2. **[2026-04-01] All commands follow prompt-mode pattern in Alpha**
   Do instead: CLI handler shows guidance directing to slash-command mode. Real logic lives in `templates/commands/*.md`.

3. **[2026-04-01] Role bleeding is the #1 multi-agent problem across ALL frameworks**
   Do instead: Implement role-boundary.ts with whitelist/blacklist BEFORE any other multi-agent feature.

## User Directives
1. **[2026-04-01] User (Leo) presents repos for analysis → present findings → wait for OK → then add to spec**
   Do instead: Never add to spec without explicit "sim" from user. Present analysis first, wait.

2. **[2026-04-01] User prefers Portuguese for communication, English for code**
   Do instead: Speak in Portuguese, write code/comments in English.

3. **[2026-04-01] Agent personas must embody real-world industry legends**
   Do instead: Reference memory `project_agent_personas.md` for persona requirements.

## Domain Behavior Guardrails
1. **[2026-04-01] Constitution enforcement is programmatic, not advisory**
   Do instead: Use `constitution-enforcer.ts` patterns — BLOCK violations, don't WARN.

2. **[2026-04-01] Every new module needs: contracts type, error codes, i18n keys, audit logging**
   Do instead: Check contracts/errors.ts, contracts/task.ts, foundation/audit.ts integration for every new engine module.
