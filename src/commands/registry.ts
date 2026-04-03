import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

/** Known command identifiers */
export type CommandId =
  | 'specify'
  | 'plan'
  | 'execute'
  | 'verify'
  | 'quick'
  | 'constitution'
  | 'squad'
  | 'doctor'
  | 'memory'
  | 'optimize'
  | 'export-web'
  | 'migrate-to-agent'
  | 'status'
  | 'diff'
  | 'completion'
  | 'hub'
  | 'learn'
  | 'agent'
  | 'upgrade'
  | 'adopt'
  | 'help'
  | 'quality'
  | 'docs'
  | 'investigate'
  | 'orchestrate'
  | 'audit'
  | 'diagnose'
  | 'distill'
  | 'map'

/** A command handler that processes CLI arguments */
export interface CommandHandler {
  run(args: string[]): Promise<Result<void>>
}

/** Lazy-loading command factory */
type CommandFactory = () => Promise<CommandHandler>

/** Registry of all available commands with lazy loading */
const REGISTRY: Record<CommandId, CommandFactory> = {
  specify:      () => import('./specify/index.js').then(m => m.handler),
  plan:         () => import('./plan/index.js').then(m => m.handler),
  execute:      () => import('./execute/index.js').then(m => m.handler),
  verify:       () => import('./verify/index.js').then(m => m.handler),
  quick:        () => import('./quick/index.js').then(m => m.handler),
  constitution: () => import('./constitution/index.js').then(m => m.handler),
  squad:        () => import('./squad/index.js').then(m => m.handler),
  doctor:       () => import('./doctor/index.js').then(m => m.handler),
  // Stub commands — available in future phases
  memory:       () => import('./memory/index.js').then(m => m.handler),
  optimize:     () => import('./optimize/index.js').then(m => m.handler),
  'export-web': () => import('./export-web/index.js').then(m => m.handler),
  'migrate-to-agent': () => import('./migrate-to-agent/index.js').then(m => m.handler),
  status:             () => import('./status/index.js').then(m => m.handler),
  diff:               () => import('./diff/index.js').then(m => m.handler),
  completion:         () => import('./completion/index.js').then(m => m.handler),
  hub:                () => import('./hub/index.js').then(m => m.handler),
  learn:              () => import('./learn/index.js').then(m => m.handler),
  agent:              () => import('./agent/index.js').then(m => m.handler),
  upgrade:            () => import('./upgrade/index.js').then(m => m.handler),
  adopt:              () => import('./adopt/index.js').then(m => m.handler),
  help:               () => import('./help/index.js').then(m => m.handler),
  quality:            () => import('./quality/index.js').then(m => m.handler),
  docs:               () => import('./docs/index.js').then(m => m.handler),
  investigate:        () => import('./investigate/index.js').then(m => m.handler),
  orchestrate:        () => import('./orchestrate/index.js').then(m => m.handler),
  audit:              () => import('./audit/index.js').then(m => m.handler),
  diagnose:           () => import('./diagnose/index.js').then(m => m.handler),
  distill:            () => import('./distill/index.js').then(m => m.handler),
  map:                () => import('./map/index.js').then(m => m.handler),
}

/**
 * Resolve and load a command by ID.
 * Returns an error if the command is not found.
 */
export async function resolveCommand(id: string): Promise<Result<CommandHandler>> {
  const factory = REGISTRY[id as CommandId]
  if (!factory) {
    return err({
      code: 'COMMAND_NOT_FOUND',
      i18nKey: 'error.command.not_found',
      params: { command: id },
    })
  }
  const handler = await factory()
  return { ok: true, value: handler }
}

/** List all registered command IDs */
export function listCommands(): CommandId[] {
  return Object.keys(REGISTRY) as CommandId[]
}

/**
 * Guard against constitution modification attempts in command output.
 * Detects patterns like `writeFile(".buildpact/constitution.md", ...)` and
 * prompts the user for explicit consent before allowing the modification.
 *
 * @param output - The generated output to check
 * @param projectDir - Project root directory
 * @param i18n - Optional i18n resolver for localized confirm message
 * @returns ok() if no modification or user approves, err() if blocked
 */
export async function guardConstitutionModification(
  output: string,
  projectDir: string,
  i18n?: { t: (key: string) => string } | unknown,
): Promise<Result<void>> {
  // Check if output contains constitution modification patterns
  const modificationPatterns = [
    /writeFile\(["'].*constitution\.md/i,
    /overwrite.*constitution/i,
    /replace.*constitution\.md/i,
    /delete.*constitution/i,
    /rm\s+.*constitution\.md/i,
  ]

  const hasModification = modificationPatterns.some(p => p.test(output))
  if (!hasModification) return ok(undefined)

  // Prompt user for consent
  const clack = await import('@clack/prompts')
  const { AuditLogger } = await import('../foundation/audit.js')
  const { join } = await import('node:path')

  const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))

  const resolver = i18n && typeof (i18n as { t?: unknown }).t === 'function'
    ? i18n as { t: (key: string) => string }
    : null

  const message = resolver
    ? resolver.t('cli.constitution.violation.modification_blocked')
    : 'This output would modify the Constitution. Allow this change?'

  const answer = await clack.confirm({ message })

  if (clack.isCancel(answer) || !answer) {
    await audit.log({
      action: 'constitution.modify.blocked',
      agent: 'guard',
      files: [],
      outcome: 'rollback',
    })
    return err({
      code: ERROR_CODES.CONSTITUTION_MODIFICATION_BLOCKED,
      i18nKey: 'cli.constitution.modification_blocked',
    })
  }

  await audit.log({
    action: 'constitution.modify.approved',
    agent: 'guard',
    files: [],
    outcome: 'success',
  })

  return ok(undefined)
}
