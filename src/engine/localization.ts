/**
 * Multi-language localization — scan locale files, check completeness,
 * resolve user locale preference, and provide key fallback.
 * @module engine/localization
 * @see Epic 25.2 — Multi-Language Localization
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { ok, err, ERROR_CODES, type Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocaleMetadata {
  code: string
  name: string
  completeness: number
  contributors: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Well-known locale code → display name mapping */
const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  'pt-br': 'Portuguese (Brazil)',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  it: 'Italian',
  ko: 'Korean',
  zh: 'Chinese',
}

/**
 * Recursively extract all dot-notation keys from a nested object.
 * Handles simple YAML-style key: value structures parsed manually.
 */
export function extractKeys(
  obj: Record<string, unknown>,
  prefix = '',
): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...extractKeys(v as Record<string, unknown>, full))
    } else {
      keys.push(full)
    }
  }
  return keys
}

/**
 * Minimal YAML parser — handles only the subset used by BuildPact locale files:
 * nested keys with string values (no arrays, no flow syntax).
 */
export function parseSimpleYaml(content: string): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  const stack: { indent: number; obj: Record<string, unknown> }[] = [
    { indent: -1, obj: root },
  ]

  for (const rawLine of content.split('\n')) {
    // Skip comments and blank lines
    if (/^\s*(#|$)/.test(rawLine)) continue
    const match = /^(\s*)([\w.@-]+)\s*:\s*(.*)$/.exec(rawLine)
    if (!match) continue

    const indent = match[1]!.length
    const key = match[2]!
    const value = match[3]!.replace(/^["']|["']$/g, '').trim()

    // Pop stack until we find a parent with lower indent
    while (stack.length > 1 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]!.obj

    if (value === '' || value.startsWith('|') || value.startsWith('>')) {
      // Map node (or multiline — treat as branch)
      const child: Record<string, unknown> = {}
      parent[key] = child
      stack.push({ indent, obj: child })
    } else {
      parent[key] = value
    }
  }

  return root
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Scan the locales/ directory and return metadata for each .yaml file found.
 */
export async function listAvailableLocales(
  localesDir: string,
): Promise<Result<LocaleMetadata[]>> {
  try {
    const entries = await readdir(localesDir)
    const yamlFiles = entries.filter(
      (f) => extname(f) === '.yaml' || extname(f) === '.yml',
    )

    // Read 'en' as reference for completeness calculation
    let referenceKeyCount = 0
    const enPath = join(localesDir, 'en.yaml')
    try {
      const enContent = await readFile(enPath, 'utf-8')
      const enObj = parseSimpleYaml(enContent)
      referenceKeyCount = extractKeys(enObj).length
    } catch {
      // No reference — completeness will be 100 for all
    }

    const locales: LocaleMetadata[] = []
    for (const file of yamlFiles) {
      const code = basename(file, extname(file))
      const content = await readFile(join(localesDir, file), 'utf-8')
      const obj = parseSimpleYaml(content)
      const keyCount = extractKeys(obj).length

      // Extract contributors from a top-level comment or meta key
      const contributorMatch = /contributors?\s*:\s*\[([^\]]*)\]/.exec(content)
      const contributors = contributorMatch
        ? contributorMatch[1]!.split(',').map((c) => c.trim().replace(/["']/g, ''))
        : []

      const completeness =
        referenceKeyCount > 0
          ? Math.round((keyCount / referenceKeyCount) * 100)
          : 100

      locales.push({
        code,
        name: LOCALE_NAMES[code] ?? code,
        completeness: Math.min(100, completeness),
        contributors,
      })
    }

    return ok(locales)
  } catch (e) {
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'error.locales.scan_failed',
      cause: e,
    })
  }
}

/**
 * Compare keys between a reference locale and a target locale.
 * Returns the missing keys and a completeness percentage.
 */
export async function checkLocaleCompleteness(
  referenceLocale: string,
  targetLocale: string,
  localesDir: string,
): Promise<Result<{ missing: string[]; completeness: number }>> {
  try {
    const refContent = await readFile(
      join(localesDir, `${referenceLocale}.yaml`),
      'utf-8',
    )
    const targetContent = await readFile(
      join(localesDir, `${targetLocale}.yaml`),
      'utf-8',
    )

    const refKeys = extractKeys(parseSimpleYaml(refContent))
    const targetKeys = new Set(extractKeys(parseSimpleYaml(targetContent)))

    const missing = refKeys.filter((k) => !targetKeys.has(k))
    const completeness =
      refKeys.length > 0
        ? Math.round(((refKeys.length - missing.length) / refKeys.length) * 100)
        : 100

    return ok({ missing, completeness })
  } catch (e) {
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'error.locales.completeness_failed',
      cause: e,
    })
  }
}

/**
 * Resolve the user's preferred locale.
 * Priority: BP_LOCALE env → LANG env → 'en' fallback.
 */
export function resolveLocale(): string {
  const bpLocale = process.env['BP_LOCALE']
  if (bpLocale) return bpLocale.toLowerCase()

  const lang = process.env['LANG']
  if (lang) {
    // LANG is typically like "en_US.UTF-8" — extract the language part
    const match = /^([a-z]{2}(?:[_-][a-z]{2})?)/.exec(lang.toLowerCase())
    if (match) return match[1]!.replace('_', '-')
  }

  return 'en'
}

/**
 * Return the value for a key from the primary locale, falling back
 * to the fallback locale if the key is missing. Returns null if
 * neither has the key.
 */
export function fallbackKey(
  key: string,
  primaryLocale: Record<string, unknown>,
  fallbackLocale: Record<string, unknown>,
): string | null {
  const resolve = (obj: Record<string, unknown>, k: string): string | null => {
    const parts = k.split('.')
    let current: unknown = obj
    for (const part of parts) {
      if (current === null || typeof current !== 'object') return null
      current = (current as Record<string, unknown>)[part]
    }
    return typeof current === 'string' ? current : null
  }

  return resolve(primaryLocale, key) ?? resolve(fallbackLocale, key)
}
