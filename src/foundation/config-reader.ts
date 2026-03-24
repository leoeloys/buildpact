import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupportedLanguage } from '../contracts/i18n.js'

/** Read language from .buildpact/config.yaml (sync, with fallback to 'en') */
export function readLanguage(projectDir: string): SupportedLanguage {
  try {
    const content = readFileSync(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('language:')) {
        const value = trimmed.slice('language:'.length).trim().replace(/^["']|["']$/g, '')
        if (value === 'pt-br' || value === 'en') return value
      }
    }
  } catch { /* no config — default to en */ }
  return 'en'
}
