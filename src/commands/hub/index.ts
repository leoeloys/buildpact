import type { CommandHandler } from '../registry.js'
import { runHub } from './handler.js'

export const handler: CommandHandler = {
  run: runHub,
}
