import type { CommandHandler } from '../registry.js'
import { runDiagnose } from './handler.js'

export const handler: CommandHandler = {
  run: runDiagnose,
}
