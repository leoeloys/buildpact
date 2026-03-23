import type { CommandHandler } from '../registry.js'
import { runUpgrade } from './handler.js'

export const handler: CommandHandler = {
  run: runUpgrade,
}
