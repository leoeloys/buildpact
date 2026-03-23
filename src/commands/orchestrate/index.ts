import * as clack from '@clack/prompts'
import { ok } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'

export const handler: CommandHandler = {
  async run(_args: string[]) {
    clack.intro('Pacto — BuildPact Master Orchestrator')
    clack.log.info([
      'Pacto is your project orchestrator. Use /bp:orchestrate in your IDE (Claude Code, Cursor, etc.).',
      '',
      'In CLI mode, use these commands directly:',
      '  buildpact help        — See project status and next steps',
      '  buildpact specify     — Capture a requirement (Sófia, PM)',
      '  buildpact plan        — Create execution plan (Renzo, Architect)',
      '  buildpact execute     — Run the plan (Coda, Developer)',
      '  buildpact verify      — Validate the work (Crivo, QA)',
      '  buildpact quality     — ISO 9001 quality report (Crivo, QA)',
      '  buildpact docs        — Organize documentation (Lira, Tech Writer)',
      '  buildpact investigate — Research domain or codebase',
      '',
      'Your squad: Pacto → Sófia → Renzo → Coda → Crivo → Lira',
    ].join('\n'))
    clack.outro('Run "buildpact help" to see your project status.')
    return ok(undefined)
  },
}
