/**
 * CI/CD non-interactive mode utilities.
 * Detects --ci flag or BP_CI=true environment variable and provides
 * logging helpers for non-interactive pipeline execution.
 * @see FR-1505
 */

/**
 * Check if CI mode is active.
 * CI mode is enabled when `--ci` is in the args array or `BP_CI=true` is set.
 */
export function isCiMode(args: string[]): boolean {
  return args.includes('--ci') || process.env.BP_CI === 'true'
}

/**
 * Log a CI mode action to stdout.
 * Format: `[ci] {step}: {detail}` or `[ci] {step}` when no detail provided.
 */
export function ciLog(step: string, detail?: string): void {
  console.log(`[ci] ${step}${detail ? ': ' + detail : ''}`)
}

/**
 * Strip the `--ci` flag from an args array.
 * Used in CLI entry point to prevent `--ci` from being treated as a command name token.
 */
export function stripCiFlag(args: string[]): string[] {
  return args.filter(a => a !== '--ci')
}
