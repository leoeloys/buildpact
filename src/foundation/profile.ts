/**
 * Model profile loader and resolution utilities.
 * This is the sole reader of .buildpact/profiles/*.yaml — no other module reads these files.
 * @see FR-603 — Model Profile Configuration
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { ModelProfile, FailoverChain, PhaseModelConfig, OperationModelConfig } from '../contracts/profile.js'
import { AuditLogger } from './audit.js'

// ---------------------------------------------------------------------------
// Profile name aliases
// ---------------------------------------------------------------------------

const PROFILE_ALIASES: Record<string, string> = {
  default: 'balanced',
}

/** Default model used when no profile/phase config is available */
const DEFAULT_MODEL = 'claude-sonnet-4-6'

// ---------------------------------------------------------------------------
// Minimal YAML parser — handles the specific subset used in profile files
// ---------------------------------------------------------------------------

type ParsedLine = { indent: number; content: string }
type ScalarValue = string | number | string[]

function getIndent(line: string): number {
  return line.length - line.trimStart().length
}

function parseScalar(raw: string): ScalarValue {
  let trimmed = raw.trim()

  // Inline JSON array: models: ["a", "b"]
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed as string[]
    } catch {
      // fall through
    }
  }

  // Strip inline comment (only when not inside quotes)
  if (!trimmed.startsWith('"') && !trimmed.startsWith("'")) {
    const commentIdx = trimmed.indexOf(' #')
    if (commentIdx !== -1) trimmed = trimmed.slice(0, commentIdx).trim()
  }

  const stripped = trimmed.replace(/^["']|["']$/g, '')
  const num = Number(stripped)
  if (!isNaN(num) && stripped !== '') return num

  return stripped
}

function filterLines(content: string): ParsedLine[] {
  return content
    .split('\n')
    .map(raw => ({ raw, indent: getIndent(raw), content: raw.trim() }))
    .filter(({ content }) => content.length > 0 && !content.startsWith('#'))
    .map(({ indent, content }) => ({ indent, content }))
}

function parseMapping(
  lines: ParsedLine[],
  start: number,
  minIndent: number,
): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {}
  let i = start

  while (i < lines.length) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const line = lines[i]!
    if (line.indent < minIndent) break
    if (line.indent > minIndent) { i++; continue }
    if (line.content.startsWith('- ')) break

    const colonIdx = line.content.indexOf(':')
    if (colonIdx === -1) { i++; continue }

    const key = line.content.slice(0, colonIdx).trim()
    const rest = line.content.slice(colonIdx + 1).trim()
    i++

    if (rest) {
      result[key] = parseScalar(rest)
    } else if (i < lines.length) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const next = lines[i]!
      if (next.indent > minIndent) {
        if (next.content.startsWith('- ')) {
          const [seq, nextI] = parseSequence(lines, i, next.indent)
          result[key] = seq
          i = nextI
        } else {
          const [nested, nextI] = parseMapping(lines, i, next.indent)
          result[key] = nested
          i = nextI
        }
      }
    }
  }

  return [result, i]
}

function parseSequence(
  lines: ParsedLine[],
  start: number,
  baseIndent: number,
): [Record<string, unknown>[], number] {
  const items: Record<string, unknown>[] = []
  let i = start

  while (i < lines.length) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const line = lines[i]!
    if (line.indent < baseIndent) break
    if (!line.content.startsWith('- ')) break

    const firstEntry = line.content.slice(2).trim()
    const item: Record<string, unknown> = {}
    const colonIdx = firstEntry.indexOf(':')
    if (colonIdx !== -1) {
      const key = firstEntry.slice(0, colonIdx).trim()
      const value = firstEntry.slice(colonIdx + 1).trim()
      item[key] = value ? parseScalar(value) : ''
    }
    i++

    // Continuation keys at +2 indent
    const continuationIndent = baseIndent + 2
    while (i < lines.length) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const next = lines[i]!
      if (next.indent < continuationIndent) break
      if (next.content.startsWith('- ')) break
      const nColonIdx = next.content.indexOf(':')
      if (nColonIdx !== -1) {
        const nKey = next.content.slice(0, nColonIdx).trim()
        const nValue = next.content.slice(nColonIdx + 1).trim()
        item[nKey] = nValue ? parseScalar(nValue) : ''
      }
      i++
    }

    items.push(item)
  }

  return [items, i]
}

/** Parse profile YAML content into a plain JS object. */
function parseProfileYaml(content: string): Record<string, unknown> {
  const lines = filterLines(content)
  const [result] = parseMapping(lines, 0, 0)
  return result
}

// ---------------------------------------------------------------------------
// Profile validation
// ---------------------------------------------------------------------------

function validateFailoverChain(raw: Record<string, unknown>, path: string): FailoverChain {
  const models = raw.models
  if (!Array.isArray(models)) throw new Error(`${path}.models must be an array`)

  const retry = raw.retry_delay_ms
  const maxWait = raw.max_wait_ms

  return {
    models: models as string[],
    retry_delay_ms: typeof retry === 'number' ? retry : 1000,
    max_wait_ms: typeof maxWait === 'number' ? maxWait : 30000,
  }
}

function validatePhaseModelConfig(raw: Record<string, unknown>, phase: string): PhaseModelConfig {
  if (typeof raw.primary !== 'string') throw new Error(`phases.${phase}.primary must be a string`)
  if (typeof raw.failover !== 'object' || !raw.failover) throw new Error(`phases.${phase}.failover must be an object`)

  const failover = validateFailoverChain(raw.failover as Record<string, unknown>, `phases.${phase}.failover`)

  let operations: OperationModelConfig[] | undefined
  if (Array.isArray(raw.operations)) {
    operations = (raw.operations as Record<string, unknown>[]).map(op => ({
      operation: String(op.operation ?? ''),
      model: String(op.model ?? ''),
    }))
  }

  return {
    primary: raw.primary,
    failover,
    ...(operations !== undefined && { operations }),
  }
}

function validateModelProfile(raw: Record<string, unknown>): ModelProfile {
  if (typeof raw.name !== 'string') throw new Error('profile.name must be a string')
  if (typeof raw.phases !== 'object' || !raw.phases || Array.isArray(raw.phases)) {
    throw new Error('profile.phases must be a mapping')
  }

  const phases: Record<string, PhaseModelConfig> = {}
  for (const [phase, phaseRaw] of Object.entries(raw.phases as Record<string, unknown>)) {
    phases[phase] = validatePhaseModelConfig(phaseRaw as Record<string, unknown>, phase)
  }

  return { name: raw.name, phases }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a named model profile from .buildpact/profiles/<name>.yaml.
 * The name "default" maps to "balanced".
 * Profile files are read relative to process.cwd() (the project root).
 */
/** Safe profile name: alphanumeric, hyphens, and underscores only */
const SAFE_PROFILE_NAME = /^[a-zA-Z0-9_-]+$/

export async function loadProfile(
  name: string,
  projectDir = process.cwd(),
): Promise<Result<ModelProfile>> {
  const resolved = PROFILE_ALIASES[name] ?? name

  if (!SAFE_PROFILE_NAME.test(resolved)) {
    return err({
      code: 'CONFIG_INVALID',
      i18nKey: 'error.profile.invalid_name',
      params: { name: resolved },
    })
  }

  const profilePath = join(projectDir, '.buildpact', 'profiles', `${resolved}.yaml`)

  let content: string
  try {
    content = await readFile(profilePath, 'utf-8')
  } catch {
    return err({
      code: 'FILE_READ_FAILED',
      i18nKey: 'error.profile.not_found',
      params: { name: resolved, path: profilePath },
    })
  }

  try {
    const raw = parseProfileYaml(content)
    const profile = validateModelProfile(raw)
    return ok(profile)
  } catch (cause) {
    return err({
      code: 'CONFIG_INVALID',
      i18nKey: 'error.profile.invalid',
      params: { name: resolved },
      cause,
    })
  }
}

/**
 * Resolve the model name for a specific pipeline phase.
 * Returns the primary model configured for that phase.
 * Falls back to the first available phase if the requested phase is not found.
 */
export function resolveModelForPhase(profile: ModelProfile, phase: string): string {
  const phaseConfig = profile.phases[phase]
  if (phaseConfig) return phaseConfig.primary

  // Fall back to first defined phase
  const first = Object.values(profile.phases)[0]
  return first?.primary ?? DEFAULT_MODEL
}

/**
 * Resolve the model name for a specific operation within a pipeline phase.
 * Searches the phase's operations array for a matching operation name.
 * Falls back to resolveModelForPhase if no operation-level config is found.
 */
export function resolveModelForOperation(
  profile: ModelProfile,
  phase: string,
  operation: string,
): string {
  const phaseConfig = profile.phases[phase]
  if (!phaseConfig) return resolveModelForPhase(profile, phase)

  const opConfig = phaseConfig.operations?.find(op => op.operation === operation)
  return opConfig?.model ?? phaseConfig.primary
}

/**
 * Execute a function with automatic failover through the models in a FailoverChain.
 * Tries each model in order, waiting retry_delay_ms between attempts.
 * Logs each failover attempt via the provided AuditLogger.
 * Returns Result — never throws.
 */
export async function executeWithFailover<T>(
  chain: FailoverChain,
  fn: (model: string) => Promise<T>,
  audit?: AuditLogger,
): Promise<Result<T>> {
  const { models, retry_delay_ms, max_wait_ms } = chain
  const startTime = Date.now()
  let lastError: unknown

  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    if (model === undefined) continue

    // Check total wait budget
    if (i > 0 && Date.now() - startTime >= max_wait_ms) break

    try {
      const result = await fn(model)
      return ok(result)
    } catch (error) {
      lastError = error

      if (audit) {
        await audit.log({
          action: 'profile.failover',
          agent: 'profile',
          files: [],
          outcome: 'failure',
          error: `Model ${model} failed — trying next in chain`,
        }).catch(() => undefined) // swallow audit errors
      }

      // Wait before next attempt (skip delay after last attempt)
      if (i < models.length - 1 && retry_delay_ms > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, retry_delay_ms))
      }
    }
  }

  return err({
    code: 'FAILOVER_EXHAUSTED',
    i18nKey: 'error.profile.failover_exhausted',
    cause: lastError,
  })
}
