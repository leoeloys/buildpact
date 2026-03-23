/**
 * Per-command flag registry.
 * Single source of truth for all CLI command flags.
 * Used by shell completion generators and --help output.
 */

/** A CLI flag definition */
export interface Flag {
  name: string
  description: string
  takesValue: boolean
}

/** Global flags shared by all commands */
export const GLOBAL_FLAGS: Flag[] = [
  { name: '--help', description: 'Show help for this command', takesValue: false },
  { name: '--verbose', description: 'Enable verbose output', takesValue: false },
  { name: '--lang', description: 'Override UI language (en, pt-br)', takesValue: true },
]

/** Per-command flags */
export const COMMAND_FLAGS: Record<string, Flag[]> = {
  specify: [],
  plan: [
    { name: '--research', description: 'Enable automated research phase', takesValue: false },
    { name: '--nyquist', description: 'Enable Nyquist multi-perspective validation', takesValue: false },
    { name: '--dry-run', description: 'Preview plan without writing files', takesValue: false },
  ],
  execute: [
    { name: '--dry-run', description: 'Preview execution without running tasks', takesValue: false },
  ],
  verify: [],
  quick: [
    { name: '--discuss', description: 'Enable context-gathering discussion mode', takesValue: false },
    { name: '--full', description: 'Enable full flow with plan verification', takesValue: false },
  ],
  constitution: [],
  squad: [],
  doctor: [],
  memory: [
    { name: '--json', description: 'Output results as JSON', takesValue: false },
    { name: '--tier', description: 'Filter by memory tier (session, lessons, decisions)', takesValue: true },
    { name: '--clear', description: 'Preview clearing entries for a tier', takesValue: true },
  ],
  optimize: [
    { name: '--loop', description: 'Start the experiment loop', takesValue: false },
  ],
  'export-web': [],
  'migrate-to-agent': [],
  status: [
    { name: '--json', description: 'Output status as JSON', takesValue: false },
  ],
  diff: [
    { name: '--json', description: 'Output diff as JSON', takesValue: false },
    { name: '--since', description: 'Diff since a specific commit ref', takesValue: true },
  ],
  completion: [
    { name: '--install', description: 'Auto-install completion to shell profile', takesValue: false },
  ],
  help: [],
  adopt: [],
  upgrade: [],
  quality: [],
  docs: [],
  orchestrate: [],
  investigate: [],
}
