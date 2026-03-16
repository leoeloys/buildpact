import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { I18nResolver, SupportedLanguage } from '../contracts/i18n.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// YAML is intentionally parsed with a minimal hand-rolled parser to avoid
// adding a YAML library dependency for a simple flat key-value structure.
// The locales use only string values with dot-notation keys.

/** Parse a simple YAML file into a flat key→value map */
function parseYaml(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split('\n')
  const stack: string[] = []

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line || line.startsWith('#')) continue

    const indent = line.length - line.trimStart().length
    const level = Math.floor(indent / 2)

    // Trim stack to current level
    stack.splice(level)

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(indent, colonIdx).trim()
    const valueRaw = line.slice(colonIdx + 1).trim()

    if (valueRaw === '' || valueRaw.startsWith('#')) {
      // It's a parent key — push onto stack
      stack[level] = key
    } else {
      // It's a leaf value — strip surrounding quotes if present
      const value = valueRaw.replace(/^["']|["']$/g, '')
      const fullKey = [...stack.slice(0, level), key].join('.')
      result[fullKey] = value
    }
  }

  return result
}

/** Resolve the locales directory (works both in src and dist) */
function localesDir(): string {
  // In dist/ the file is at dist/foundation/i18n.js → locales/ is ../../locales
  // In src/ during tests the file is at src/foundation/i18n.ts → locales/ is ../../locales
  return join(__dirname, '..', '..', 'locales')
}

/** Load and parse a locale file, returning a flat key→value map */
function loadLocale(lang: SupportedLanguage): Record<string, string> {
  const filePath = join(localesDir(), `${lang}.yaml`)
  try {
    const content = readFileSync(filePath, 'utf-8')
    return parseYaml(content)
  } catch {
    // If locale file not found, return empty (caller handles missing keys gracefully)
    return {}
  }
}

/**
 * Create an I18nResolver for the given language.
 * Always implements the I18nResolver contract.
 */
export function createI18n(lang: SupportedLanguage): I18nResolver {
  const strings = loadLocale(lang)

  return {
    lang,
    t(key: string, params?: Record<string, string>): string {
      const template = strings[key]
      if (template === undefined) {
        // Visible bug indicator — never crashes
        return `[${key.toUpperCase().replace(/\./g, '_')}]`
      }
      // Interpolate {param} placeholders
      return template.replace(/\{(\w+)\}/g, (_, k: string) => params?.[k] ?? `{${k}}`)
    },
  }
}
