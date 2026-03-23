/**
 * Completion command handler.
 * Generates shell completion scripts for bash, zsh, and fish.
 * Output goes to stdout for eval/sourcing — not through clack.
 * Flags: --install
 * @see Story 14.5 — Shell Completion
 */

import { ok, err } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import { listCommands } from '../registry.js'
import { COMMAND_FLAGS, GLOBAL_FLAGS } from './flags.js'
import type { Flag } from './flags.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShellType = 'bash' | 'zsh' | 'fish'

const VALID_SHELLS: ShellType[] = ['bash', 'zsh', 'fish']

// ---------------------------------------------------------------------------
// Bash completion generator
// ---------------------------------------------------------------------------

export function generateBash(commands: string[], flagMap: Record<string, Flag[]>): string {
  const cmdList = commands.join(' ')
  const globalFlags = GLOBAL_FLAGS.map(f => f.name).join(' ')

  const cases: string[] = []
  for (const cmd of commands) {
    const cmdFlags = [...(flagMap[cmd] ?? []), ...GLOBAL_FLAGS].map(f => f.name).join(' ')
    cases.push(`      ${cmd}) COMPREPLY=( $(compgen -W "${cmdFlags}" -- "$cur") ) ;;`)
  }

  return `# Add to ~/.bashrc: eval "$(bp completion bash)"
_bp_completions() {
  local cur prev commands
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="${cmdList}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
    return 0
  fi

  case "\${COMP_WORDS[1]}" in
${cases.join('\n')}
      *) COMPREPLY=( $(compgen -W "${globalFlags}" -- "$cur") ) ;;
  esac
}
complete -F _bp_completions bp
complete -F _bp_completions buildpact
`
}

// ---------------------------------------------------------------------------
// Zsh completion generator
// ---------------------------------------------------------------------------

export function generateZsh(commands: string[], flagMap: Record<string, Flag[]>): string {
  const cmdDescriptions = commands.map(cmd => `    '${cmd}:${cmd} command'`).join(' \\\n')

  const subcmds: string[] = []
  for (const cmd of commands) {
    const flags = [...(flagMap[cmd] ?? []), ...GLOBAL_FLAGS]
    if (flags.length > 0) {
      const flagArgs = flags.map(f => `'${f.name}[${f.description}]'`).join(' ')
      subcmds.push(`  ${cmd}) _arguments ${flagArgs} ;;`)
    }
  }

  return `#compdef bp buildpact
# Add to ~/.zshrc: eval "$(bp completion zsh)"

_bp() {
  local -a commands
  commands=(
${cmdDescriptions}
  )

  _arguments '1:command:->cmd' '*::arg:->args'

  case $state in
  cmd)
    _describe 'bp commands' commands
    ;;
  args)
    case \${words[1]} in
${subcmds.join('\n')}
    esac
    ;;
  esac
}

compdef _bp bp buildpact
`
}

// ---------------------------------------------------------------------------
// Fish completion generator
// ---------------------------------------------------------------------------

export function generateFish(commands: string[], flagMap: Record<string, Flag[]>): string {
  const lines: string[] = [
    '# Add to ~/.config/fish/completions/bp.fish',
    '# Or run: bp completion fish > ~/.config/fish/completions/bp.fish',
    '',
    '# Disable file completions for bp',
    'complete -c bp -f',
    'complete -c buildpact -f',
    '',
    '# Commands',
  ]

  for (const cmd of commands) {
    lines.push(`complete -c bp -n "__fish_use_subcommand" -a "${cmd}" --description "${cmd} command"`)
    lines.push(`complete -c buildpact -n "__fish_use_subcommand" -a "${cmd}" --description "${cmd} command"`)
  }

  lines.push('', '# Flags per command')

  for (const cmd of commands) {
    const flags = [...(flagMap[cmd] ?? []), ...GLOBAL_FLAGS]
    for (const flag of flags) {
      const longName = flag.name.replace(/^--/, '')
      lines.push(
        `complete -c bp -n "__fish_seen_subcommand_from ${cmd}" -l "${longName}" --description "${flag.description}"`,
      )
    }
  }

  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Shell detection and install helpers
// ---------------------------------------------------------------------------

/** Detect the user's current shell from SHELL env var */
export function detectShell(): ShellType | undefined {
  const shell = process.env.SHELL ?? ''
  if (shell.includes('zsh')) return 'zsh'
  if (shell.includes('bash')) return 'bash'
  if (shell.includes('fish')) return 'fish'
  return undefined
}

/** Get the shell profile file path for a given shell type */
export function getProfilePath(shell: ShellType): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '~'
  switch (shell) {
    case 'bash': return `${home}/.bashrc`
    case 'zsh': return `${home}/.zshrc`
    case 'fish': return `${home}/.config/fish/config.fish`
  }
}

/** Get the eval line to append to the profile */
export function getEvalLine(shell: ShellType): string {
  switch (shell) {
    case 'bash': return 'eval "$(buildpact completion bash)"'
    case 'zsh': return 'eval "$(buildpact completion zsh)"'
    case 'fish': return 'buildpact completion fish | source'
  }
}

/** Install completion by appending eval line to the shell profile */
export async function installCompletion(shell: ShellType): Promise<{ profilePath: string; evalLine: string; alreadyInstalled: boolean }> {
  const { readFile, appendFile, mkdir: mkdirAsync } = await import('node:fs/promises')
  const { dirname } = await import('node:path')

  const profilePath = getProfilePath(shell)
  const evalLine = getEvalLine(shell)

  // Check if already installed
  try {
    const content = await readFile(profilePath, 'utf-8')
    if (content.includes('buildpact completion')) {
      return { profilePath, evalLine, alreadyInstalled: true }
    }
  } catch {
    // Profile doesn't exist yet — we'll create it
  }

  // Ensure directory exists (for fish)
  try {
    await mkdirAsync(dirname(profilePath), { recursive: true })
  } catch {
    // Directory likely already exists
  }

  // Append eval line
  await appendFile(profilePath, `\n# BuildPact shell completion\n${evalLine}\n`)

  return { profilePath, evalLine, alreadyInstalled: false }
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

export const handler: CommandHandler = {
  async run(args: string[]): Promise<Result<void>> {
    const hasInstall = args.includes('--install')
    const shell = args.find(a => a !== '--install')?.toLowerCase()

    // --install mode: detect shell and install
    if (hasInstall) {
      const targetShell = (shell && VALID_SHELLS.includes(shell as ShellType))
        ? shell as ShellType
        : detectShell()

      if (!targetShell) {
        return err({
          code: 'INVALID_SHELL',
          i18nKey: 'cli.completion.invalid_shell',
          params: { shells: VALID_SHELLS.join(', ') },
        })
      }

      try {
        const result = await installCompletion(targetShell)
        if (result.alreadyInstalled) {
          process.stdout.write(`Completion already installed in ${result.profilePath}\n`)
        } else {
          process.stdout.write(`Completion installed to ${result.profilePath}\n`)
          process.stdout.write(`Added: ${result.evalLine}\n`)
          process.stdout.write(`Restart your shell or run: source ${result.profilePath}\n`)
        }
        return ok(undefined)
      } catch (cause) {
        return err({
          code: 'INSTALL_FAILED',
          i18nKey: 'cli.completion.install_failed',
          params: { reason: String(cause) },
          cause,
        })
      }
    }

    if (!shell || !VALID_SHELLS.includes(shell as ShellType)) {
      return err({
        code: 'INVALID_SHELL',
        i18nKey: 'cli.completion.invalid_shell',
        params: { shells: VALID_SHELLS.join(', ') },
      })
    }

    const commands = listCommands()

    let script: string
    switch (shell as ShellType) {
      case 'bash':
        script = generateBash(commands, COMMAND_FLAGS)
        break
      case 'zsh':
        script = generateZsh(commands, COMMAND_FLAGS)
        break
      case 'fish':
        script = generateFish(commands, COMMAND_FLAGS)
        break
    }

    process.stdout.write(script)
    return ok(undefined)
  },
}
