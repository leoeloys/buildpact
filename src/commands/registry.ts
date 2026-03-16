import { err } from '../contracts/errors.js'
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
