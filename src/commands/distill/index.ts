/**
 * Distill command — Lossless document compression for LLM consumption.
 * Alpha: prompt-mode only. CLI displays guidance directing to /bp:distill.
 * @module commands/distill
 * @see Spec concept 10.1 — Distillator (BMAD)
 */

import * as clack from '@clack/prompts'
import { ok } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'

export const handler: CommandHandler = {
  async run(args: string[]) {
    clack.intro('Destila — BuildPact Document Distillation Engine')
    clack.log.info([
      'Destila compresses documents into token-efficient distillates for LLM consumption.',
      'This is LOSSLESS compression, not summarization — every fact survives.',
      '',
      'Use /bp:distill in your IDE (Claude Code, Cursor, etc.) with these options:',
      '',
      '  /bp:distill <file-or-folder>                    — Distill source documents',
      '  /bp:distill <path> --for "plan creation"        — Optimize for downstream consumer',
      '  /bp:distill <path> --budget 5000                — Target token budget',
      '  /bp:distill <path> --validate                   — Run round-trip verification',
      '  /bp:distill <path> --output ./distilled.md      — Custom output path',
      '',
      'Compression rules:',
      '  STRIP:      Filler, hedging, transitions, self-reference, decorative formatting',
      '  PRESERVE:   Numbers, entities, decisions, constraints, open questions, ACs',
      '  TRANSFORM:  Prose → bullets, verbose → compressed, lists → semicolons',
      '  DEDUPLICATE: Same fact in N sources → keep most detailed version',
      '',
      'Example:',
      '  /bp:distill rascunhos/specs/ --for "plan creation" --validate',
    ].join('\n'))
    clack.outro('Distillation preserves signal, strips noise.')
    return ok(undefined)
  },
}
