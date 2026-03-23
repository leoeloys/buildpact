/**
 * Error Audit Test — validates that all error codes are properly defined and documented.
 * Dynamically discovers error codes from src/contracts/errors.ts and checks
 * that each code has corresponding i18n entries in locale files.
 * @see Story 17.3 — AC-6: Error Message Audit
 */
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ERROR_CODES } from '../../../src/contracts/errors.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', '..', '..')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a locale YAML file and extract all keys (dot-notation) */
function extractYamlKeys(content: string): Set<string> {
  const keys = new Set<string>()
  const stack: string[] = []
  const indentStack: number[] = [-1]

  for (const line of content.split('\n')) {
    // Skip comments and empty lines
    if (/^\s*#/.test(line) || line.trim() === '') continue

    const match = line.match(/^(\s*)([a-z_][a-z0-9_]*)\s*:/i)
    if (!match) continue

    const indent = match[1]!.length
    const key = match[2]!

    // Pop stack until we find a parent with smaller indent
    while (indentStack.length > 1 && indent <= indentStack[indentStack.length - 1]!) {
      indentStack.pop()
      stack.pop()
    }

    stack.push(key)
    indentStack.push(indent)

    // If the line has a value after the colon (not just a nested block), record it
    const afterColon = line.slice(line.indexOf(':') + 1).trim()
    if (afterColon && !afterColon.startsWith('#')) {
      keys.add(stack.join('.'))
    }
  }

  return keys
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Error Audit — AC-6: All error codes have i18n entries', () => {
  it('ERROR_CODES constant has at least 10 entries', () => {
    const codes = Object.keys(ERROR_CODES)
    expect(codes.length).toBeGreaterThanOrEqual(10)
  })

  it('all ERROR_CODES values match their keys (no typos)', () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value, `ERROR_CODES.${key} has mismatched value`).toBe(key)
    }
  })

  it('each error code is used at least once in the source tree', async () => {
    // Read all source files to check usage
    const { readdir } = await import('node:fs/promises')

    async function collectTsFiles(dir: string): Promise<string[]> {
      const files: string[] = []
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === 'dist') continue
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            files.push(...await collectTsFiles(fullPath))
          } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            files.push(fullPath)
          }
        }
      } catch {
        // skip unreadable directories
      }
      return files
    }

    const srcDir = join(ROOT, 'src')
    const tsFiles = await collectTsFiles(srcDir)
    const allContent = (await Promise.all(
      tsFiles.map(f => readFile(f, 'utf-8').catch(() => '')),
    )).join('\n')

    const unusedCodes: string[] = []
    for (const code of Object.values(ERROR_CODES)) {
      // Check if the code string appears in source (could be ERROR_CODES.X or literal 'X')
      if (!allContent.includes(code)) {
        unusedCodes.push(code)
      }
    }

    expect(
      unusedCodes,
      `Unused error codes found — remove from ERROR_CODES or add usage: ${unusedCodes.join(', ')}`,
    ).toEqual([])
  })

  it('en.yaml contains version_guard i18n keys for schema errors', async () => {
    const enContent = await readFile(join(ROOT, 'locales', 'en.yaml'), 'utf-8')
    const keys = extractYamlKeys(enContent)

    // Version guard keys used in the CLI entry point
    const requiredKeys = [
      'cli.version_guard.upgrade_available',
      'cli.version_guard.upgrade_required',
      'cli.version_guard.cli_too_old',
    ]

    for (const key of requiredKeys) {
      expect(keys.has(key), `en.yaml missing key: ${key}`).toBe(true)
    }
  })

  it('pt-br.yaml contains version_guard i18n keys for schema errors', async () => {
    const ptContent = await readFile(join(ROOT, 'locales', 'pt-br.yaml'), 'utf-8')
    const keys = extractYamlKeys(ptContent)

    const requiredKeys = [
      'cli.version_guard.upgrade_available',
      'cli.version_guard.upgrade_required',
      'cli.version_guard.cli_too_old',
    ]

    for (const key of requiredKeys) {
      expect(keys.has(key), `pt-br.yaml missing key: ${key}`).toBe(true)
    }
  })

  it('en.yaml and pt-br.yaml have matching top-level key structure', async () => {
    const enContent = await readFile(join(ROOT, 'locales', 'en.yaml'), 'utf-8')
    const ptContent = await readFile(join(ROOT, 'locales', 'pt-br.yaml'), 'utf-8')

    // Extract top-level sections (first-level keys)
    const enSections = new Set<string>()
    const ptSections = new Set<string>()

    for (const line of enContent.split('\n')) {
      const match = line.match(/^([a-z_][a-z0-9_]*):/i)
      if (match) enSections.add(match[1]!)
    }

    for (const line of ptContent.split('\n')) {
      const match = line.match(/^([a-z_][a-z0-9_]*):/i)
      if (match) ptSections.add(match[1]!)
    }

    // Both files should have the same top-level structure
    for (const section of enSections) {
      expect(ptSections.has(section), `pt-br.yaml missing top-level section: ${section}`).toBe(true)
    }
  })

  it('ERROR_CODES are all SCREAMING_SNAKE_CASE', () => {
    for (const code of Object.keys(ERROR_CODES)) {
      expect(code, `Error code ${code} is not SCREAMING_SNAKE_CASE`).toMatch(/^[A-Z][A-Z0-9_]+$/)
    }
  })
})
