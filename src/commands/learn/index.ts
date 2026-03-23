import type { CommandHandler } from '../registry.js'
import { runLearn } from './handler.js'

export const handler: CommandHandler = {
  run: runLearn,
}
