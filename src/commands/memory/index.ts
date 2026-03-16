import type { CommandHandler } from '../registry.js'
import { err } from '../../contracts/errors.js'

export const handler: CommandHandler = {
  async run(_args: string[]) {
    return err({
      code: 'NOT_IMPLEMENTED',
      i18nKey: 'error.not_implemented',
      params: { feature: 'COMMAND', phase: 'v1.0' },
      phase: 'v1.0',
    })
  },
}
