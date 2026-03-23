/**
 * Error completeness validation.
 * Ensures every ERROR_CODE has i18n entries in both EN and PT-BR.
 * Ensures all i18n keys used in err() calls resolve to actual locale strings.
 * @see Story 17.3 — Error Message Audit
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ERROR_CODES } from '../../../src/contracts/errors.js'
import { createI18n } from '../../../src/foundation/i18n.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ---------------------------------------------------------------------------
// Helper: parse locale file to get all keys
// ---------------------------------------------------------------------------

function parseYamlKeys(content: string): Set<string> {
  const keys = new Set<string>()
  const lines = content.split('\n')
  const stack: string[] = []

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line || line.startsWith('#')) continue

    const indent = line.length - line.trimStart().length
    const level = Math.floor(indent / 2)
    stack.splice(level)

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(indent, colonIdx).trim()
    const valueRaw = line.slice(colonIdx + 1).trim()

    if (valueRaw === '' || valueRaw.startsWith('#')) {
      stack[level] = key
    } else {
      const fullKey = [...stack.slice(0, level), key].join('.')
      keys.add(fullKey)
    }
  }

  return keys
}

// Load locale files
function localesDir(): string {
  // From test/unit/contracts → locales/ is 3 levels up
  const fromTest = join(__dirname, '..', '..', '..', 'locales')
  return fromTest
}

const enContent = readFileSync(join(localesDir(), 'en.yaml'), 'utf-8')
const ptBrContent = readFileSync(join(localesDir(), 'pt-br.yaml'), 'utf-8')
const enKeys = parseYamlKeys(enContent)
const ptBrKeys = parseYamlKeys(ptBrContent)

// ---------------------------------------------------------------------------
// All i18n keys used in err() calls across the codebase
// These are maintained as a registry for validation.
// ---------------------------------------------------------------------------

const ERROR_I18N_KEYS = [
  // error.* keys (error section of locale files)
  'error.recovery.session_create_failed',
  'error.recovery.rollback_failed',
  'error.squad.not_found',
  'error.squad.validation_failed',
  'error.squad.invalid_name',
  'error.ide.config_failed',
  'error.file.write_failed',
  'error.file.read_failed',
  'error.network.remote_fetch_failed',
  'error.not_implemented',
  'error.execute.wave_failed',
  'error.model.failover_exhausted',
  'error.feedback.write_failed',
  'error.lessons.write_failed',
  'error.decisions.write_failed',
  'error.autonomy.store_failed',
  'error.agent.load_failed',
  'error.agent.not_in_index',
  'error.engine.file_read_failed',
  'error.engine.orchestrator_too_long',
  'error.engine.missing_orchestrator_header',
  'error.engine.missing_implementation_notes',
  'error.engine.payload_too_large',
  'error.constitution.not_found',
  'error.constitution.empty',
  'error.sharding.write_failed',
  'error.stub.not_implemented',
  'error.command.not_found',
  'error.optimize.report_write_failed',
  'error.optimize.tsv_write_failed',
  'error.metrics.custom_exec_failed',
  'error.metrics.custom_non_numeric',
  'error.ratchet.branch_failed',
  'error.ratchet.commit_failed',
  'error.ratchet.revert_failed',
]

// ---------------------------------------------------------------------------
// AC-3: Full i18n coverage — every error key exists in both locales
// ---------------------------------------------------------------------------

describe('AC-3: i18n error coverage', () => {
  it('every error i18n key exists in EN locale', () => {
    const missing: string[] = []
    for (const key of ERROR_I18N_KEYS) {
      if (!enKeys.has(key)) {
        missing.push(key)
      }
    }
    expect(missing, `Missing EN keys: ${missing.join(', ')}`).toEqual([])
  })

  it('every error i18n key exists in PT-BR locale', () => {
    const missing: string[] = []
    for (const key of ERROR_I18N_KEYS) {
      if (!ptBrKeys.has(key)) {
        missing.push(key)
      }
    }
    expect(missing, `Missing PT-BR keys: ${missing.join(', ')}`).toEqual([])
  })

  it('all EN error keys have PT-BR counterparts', () => {
    const enErrorKeys = [...enKeys].filter(k => k.startsWith('error.'))
    const missing: string[] = []
    for (const key of enErrorKeys) {
      if (!ptBrKeys.has(key)) {
        missing.push(key)
      }
    }
    expect(missing, `EN error keys missing in PT-BR: ${missing.join(', ')}`).toEqual([])
  })

  it('all PT-BR error keys have EN counterparts', () => {
    const ptBrErrorKeys = [...ptBrKeys].filter(k => k.startsWith('error.'))
    const missing: string[] = []
    for (const key of ptBrErrorKeys) {
      if (!enKeys.has(key)) {
        missing.push(key)
      }
    }
    expect(missing, `PT-BR error keys missing in EN: ${missing.join(', ')}`).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// AC-5: Error code consistency
// ---------------------------------------------------------------------------

describe('AC-5: Error code consistency', () => {
  it('all ERROR_CODES follow SCREAMING_SNAKE_CASE convention', () => {
    const codes = Object.values(ERROR_CODES)
    for (const code of codes) {
      expect(code, `Error code "${code}" should be SCREAMING_SNAKE_CASE`).toMatch(
        /^[A-Z][A-Z0-9_]*$/,
      )
    }
  })

  it('ERROR_CODES keys match their values', () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value, `ERROR_CODES.${key} value should match key`).toBe(key)
    }
  })
})

// ---------------------------------------------------------------------------
// Error message quality — no raw i18n key fallback
// ---------------------------------------------------------------------------

describe('Error message resolution (no fallback to raw keys)', () => {
  it('EN error keys resolve to actual text, not [UPPERCASE_FALLBACK]', () => {
    const i18n = createI18n('en')
    for (const key of ERROR_I18N_KEYS) {
      const resolved = i18n.t(key)
      expect(resolved, `EN key "${key}" should not fall back to raw key indicator`).not.toMatch(
        /^\[.*\]$/,
      )
    }
  })

  it('PT-BR error keys resolve to actual text, not [UPPERCASE_FALLBACK]', () => {
    const i18n = createI18n('pt-br')
    for (const key of ERROR_I18N_KEYS) {
      const resolved = i18n.t(key)
      expect(
        resolved,
        `PT-BR key "${key}" should not fall back to raw key indicator`,
      ).not.toMatch(/^\[.*\]$/)
    }
  })
})

// ---------------------------------------------------------------------------
// Locale parity — EN and PT-BR should have the same top-level key structure
// ---------------------------------------------------------------------------

describe('Locale parity', () => {
  it('EN and PT-BR have the same number of error keys', () => {
    const enErrorKeys = [...enKeys].filter(k => k.startsWith('error.'))
    const ptBrErrorKeys = [...ptBrKeys].filter(k => k.startsWith('error.'))
    expect(enErrorKeys.length).toBe(ptBrErrorKeys.length)
  })

  it('EN and PT-BR cli keys are in sync', () => {
    const enCliKeys = [...enKeys].filter(k => k.startsWith('cli.'))
    const ptBrCliKeys = [...ptBrKeys].filter(k => k.startsWith('cli.'))

    const missingInPtBr = enCliKeys.filter(k => !ptBrKeys.has(k))
    const missingInEn = ptBrCliKeys.filter(k => !enKeys.has(k))

    expect(
      missingInPtBr,
      `CLI keys in EN but missing in PT-BR: ${missingInPtBr.join(', ')}`,
    ).toEqual([])
    expect(
      missingInEn,
      `CLI keys in PT-BR but missing in EN: ${missingInEn.join(', ')}`,
    ).toEqual([])
  })
})
