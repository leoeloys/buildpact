import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  listAvailableLocales,
  checkLocaleCompleteness,
  resolveLocale,
  fallbackKey,
  extractKeys,
  parseSimpleYaml,
} from '../../../src/engine/localization.js'

// ---------------------------------------------------------------------------
// parseSimpleYaml / extractKeys
// ---------------------------------------------------------------------------

describe('parseSimpleYaml', () => {
  it('parses nested YAML-like content', () => {
    const yaml = `cli:\n  install:\n    welcome: Hello\n    goodbye: Bye`
    const obj = parseSimpleYaml(yaml)
    expect((obj as any).cli.install.welcome).toBe('Hello')
    expect((obj as any).cli.install.goodbye).toBe('Bye')
  })
})

describe('extractKeys', () => {
  it('extracts dot-notation keys from nested object', () => {
    const obj = { cli: { install: { welcome: 'Hello', goodbye: 'Bye' } } }
    const keys = extractKeys(obj)
    expect(keys).toContain('cli.install.welcome')
    expect(keys).toContain('cli.install.goodbye')
    expect(keys).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// listAvailableLocales
// ---------------------------------------------------------------------------

describe('listAvailableLocales', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-locale-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true })
  })

  it('returns locale metadata for yaml files', async () => {
    await writeFile(join(tmpDir, 'en.yaml'), 'cli:\n  hello: Hello\n  bye: Bye')
    await writeFile(join(tmpDir, 'es.yaml'), 'cli:\n  hello: Hola')

    const result = await listAvailableLocales(tmpDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value).toHaveLength(2)
    const en = result.value.find((l) => l.code === 'en')
    expect(en?.name).toBe('English')
    expect(en?.completeness).toBe(100)

    const es = result.value.find((l) => l.code === 'es')
    expect(es?.name).toBe('Spanish')
    expect(es?.completeness).toBe(50) // 1 of 2 keys
  })

  it('returns error for non-existent directory', async () => {
    const result = await listAvailableLocales('/tmp/nonexistent-xyz-999')
    expect(result.ok).toBe(false)
  })

  it('handles empty directory', async () => {
    const result = await listAvailableLocales(tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// checkLocaleCompleteness
// ---------------------------------------------------------------------------

describe('checkLocaleCompleteness', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-compl-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true })
  })

  it('detects missing keys in target locale', async () => {
    await writeFile(join(tmpDir, 'en.yaml'), 'cli:\n  a: A\n  b: B\n  c: C')
    await writeFile(join(tmpDir, 'fr.yaml'), 'cli:\n  a: Ah')

    const result = await checkLocaleCompleteness('en', 'fr', tmpDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.missing).toContain('cli.b')
    expect(result.value.missing).toContain('cli.c')
    expect(result.value.completeness).toBe(33) // 1 of 3
  })

  it('returns 100% when all keys present', async () => {
    await writeFile(join(tmpDir, 'en.yaml'), 'cli:\n  a: A')
    await writeFile(join(tmpDir, 'de.yaml'), 'cli:\n  a: Ah')

    const result = await checkLocaleCompleteness('en', 'de', tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.completeness).toBe(100)
  })

  it('returns error when file is missing', async () => {
    await writeFile(join(tmpDir, 'en.yaml'), 'cli:\n  a: A')
    const result = await checkLocaleCompleteness('en', 'missing', tmpDir)
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// resolveLocale
// ---------------------------------------------------------------------------

describe('resolveLocale', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('uses BP_LOCALE when set', () => {
    process.env['BP_LOCALE'] = 'pt-BR'
    expect(resolveLocale()).toBe('pt-br')
  })

  it('falls back to LANG env var', () => {
    delete process.env['BP_LOCALE']
    process.env['LANG'] = 'fr_FR.UTF-8'
    expect(resolveLocale()).toBe('fr-fr')
  })

  it('returns en as default fallback', () => {
    delete process.env['BP_LOCALE']
    delete process.env['LANG']
    expect(resolveLocale()).toBe('en')
  })
})

// ---------------------------------------------------------------------------
// fallbackKey
// ---------------------------------------------------------------------------

describe('fallbackKey', () => {
  it('returns value from primary locale', () => {
    const primary = { cli: { hello: 'Hola' } }
    const fallback = { cli: { hello: 'Hello' } }
    expect(fallbackKey('cli.hello', primary, fallback)).toBe('Hola')
  })

  it('falls back when key missing in primary', () => {
    const primary = { cli: {} }
    const fallback = { cli: { hello: 'Hello' } }
    expect(fallbackKey('cli.hello', primary, fallback)).toBe('Hello')
  })

  it('returns null when key missing in both', () => {
    expect(fallbackKey('cli.hello', {}, {})).toBeNull()
  })

  it('handles deeply nested keys', () => {
    const primary = { a: { b: { c: 'deep' } } }
    expect(fallbackKey('a.b.c', primary, {})).toBe('deep')
  })
})
