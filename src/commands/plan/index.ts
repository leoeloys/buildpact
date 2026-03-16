import type { CommandHandler } from '../registry.js'
import { ok } from '../../contracts/errors.js'

export const handler: CommandHandler = {
  async run(_args: string[]) {
    // TODO: load and execute templates/commands/COMMAND.md orchestrator
    return ok(undefined)
  },
}
