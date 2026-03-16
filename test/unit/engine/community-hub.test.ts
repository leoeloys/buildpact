import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  isRegistryName,
  buildSquadFileUrl,
  buildValidationBadge,
  formatRegistryIndex,
  parseSquadManifest,
  fetchSquadManifest,
  downloadManifestFiles,
  downloadSquadFromHub,
  REGISTRY_BASE_URL,
  SQUAD_MANIFEST_FILE,
} from '../../../src/engine/community-hub.js'
import type { RegistrySquad, SquadManifest } from '../../../src/engine/community-hub.js'

// ---------------------------------------------------------------------------
// isRegistryName
// ---------------------------------------------------------------------------

describe('isRegistryName', () => {
  it('returns true for plain squad name', () => {
    expect(isRegistryName('software')).toBe(true)
  })

  it('returns true for hyphenated name', () => {
    expect(isRegistryName('medical-marketing')).toBe(true)
  })

  it('returns false for local path with slash', () => {
    expect(isRegistryName('./my-squad')).toBe(false)
  })

  it('returns false for absolute path', () => {
    expect(isRegistryName('/tmp/my-squad')).toBe(false)
  })

  it('returns false for relative path with backslash', () => {
    expect(isRegistryName('some\\path')).toBe(false)
  })

  it('returns false for dot-prefixed name', () => {
    expect(isRegistryName('.hidden-squad')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isRegistryName('')).toBe(false)
  })

  it('returns false for whitespace only', () => {
    expect(isRegistryName('   ')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// buildSquadFileUrl
// ---------------------------------------------------------------------------

describe('buildSquadFileUrl', () => {
  it('builds URL with registry base, squad name, and file path', () => {
    const url = buildSquadFileUrl(REGISTRY_BASE_URL, 'software', 'squad.yaml')
    expect(url).toBe(`${REGISTRY_BASE_URL}/software/squad.yaml`)
  })

  it('builds URL for nested file path', () => {
    const url = buildSquadFileUrl(REGISTRY_BASE_URL, 'medical', 'agents/chief.md')
    expect(url).toBe(`${REGISTRY_BASE_URL}/medical/agents/chief.md`)
  })

  it('works with custom registry base', () => {
    const url = buildSquadFileUrl('https://custom.example.com', 'my-squad', 'manifest.json')
    expect(url).toBe('https://custom.example.com/my-squad/manifest.json')
  })
})

// ---------------------------------------------------------------------------
// buildValidationBadge
// ---------------------------------------------------------------------------

describe('buildValidationBadge', () => {
  it('returns passing badge when validation passes', () => {
    const badge = buildValidationBadge('software', true)
    expect(badge).toContain('passing')
    expect(badge).toContain('brightgreen')
    expect(badge).toContain('software')
  })

  it('returns failing badge when validation fails', () => {
    const badge = buildValidationBadge('broken-squad', false)
    expect(badge).toContain('failing')
    expect(badge).toContain('red')
    expect(badge).toContain('broken-squad')
  })

  it('returns markdown image syntax', () => {
    const badge = buildValidationBadge('test', true)
    expect(badge).toMatch(/^!\[validation\]/)
  })
})

// ---------------------------------------------------------------------------
// formatRegistryIndex
// ---------------------------------------------------------------------------

describe('formatRegistryIndex', () => {
  const squads: RegistrySquad[] = [
    {
      name: 'software',
      version: '1.0',
      domain: 'software',
      description: 'Full-stack development',
      validationPassing: true,
      licenseType: 'MIT',
    },
    {
      name: 'medical-marketing',
      version: '1.0',
      domain: 'health',
      description: 'CFM-compliant medical marketing',
      validationPassing: true,
      licenseType: 'MIT',
    },
  ]

  it('contains title header', () => {
    const readme = formatRegistryIndex(squads)
    expect(readme).toContain('# BuildPact Community Squads')
  })

  it('contains all squad names', () => {
    const readme = formatRegistryIndex(squads)
    expect(readme).toContain('software')
    expect(readme).toContain('medical-marketing')
  })

  it('contains domain information', () => {
    const readme = formatRegistryIndex(squads)
    expect(readme).toContain('health')
  })

  it('includes installation instructions', () => {
    const readme = formatRegistryIndex(squads)
    expect(readme).toContain('npx buildpact squad add')
  })

  it('includes MIT license reference', () => {
    const readme = formatRegistryIndex(squads)
    expect(readme).toContain('MIT')
  })

  it('handles empty squads list', () => {
    const readme = formatRegistryIndex([])
    expect(readme).toContain('# BuildPact Community Squads')
    expect(readme).toContain('| Squad |')
  })
})

// ---------------------------------------------------------------------------
// parseSquadManifest
// ---------------------------------------------------------------------------

describe('parseSquadManifest', () => {
  it('parses valid manifest JSON', () => {
    const json = JSON.stringify({
      name: 'software',
      version: '1.0',
      domain: 'software',
      description: 'Dev squad',
      files: ['squad.yaml', 'agents/pm.md'],
    })
    const result = parseSquadManifest(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('software')
      expect(result.value.files).toEqual(['squad.yaml', 'agents/pm.md'])
    }
  })

  it('returns error for invalid JSON', () => {
    const result = parseSquadManifest('not valid json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('REMOTE_FETCH_FAILED')
  })

  it('returns error when name field is missing', () => {
    const result = parseSquadManifest(JSON.stringify({ files: ['squad.yaml'] }))
    expect(result.ok).toBe(false)
  })

  it('returns error when files field is missing', () => {
    const result = parseSquadManifest(JSON.stringify({ name: 'test' }))
    expect(result.ok).toBe(false)
  })

  it('uses defaults for optional fields', () => {
    const json = JSON.stringify({ name: 'minimal', files: [] })
    const result = parseSquadManifest(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.version).toBe('1.0')
      expect(result.value.domain).toBe('custom')
    }
  })
})

// ---------------------------------------------------------------------------
// fetchSquadManifest — with mocked fetch
// ---------------------------------------------------------------------------

describe('fetchSquadManifest', () => {
  const validManifest: SquadManifest = {
    name: 'software',
    version: '1.0',
    domain: 'software',
    description: 'Dev squad',
    files: ['squad.yaml', 'agents/pm.md'],
  }

  it('returns parsed manifest on 200 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(validManifest),
    })

    const result = await fetchSquadManifest('software', REGISTRY_BASE_URL, mockFetch as unknown as typeof fetch)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.name).toBe('software')
    expect(mockFetch).toHaveBeenCalledWith(
      `${REGISTRY_BASE_URL}/software/${SQUAD_MANIFEST_FILE}`,
    )
  })

  it('returns error on non-200 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })

    const result = await fetchSquadManifest('nonexistent', REGISTRY_BASE_URL, mockFetch as unknown as typeof fetch)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('REMOTE_FETCH_FAILED')
  })

  it('returns error on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await fetchSquadManifest('software', REGISTRY_BASE_URL, mockFetch as unknown as typeof fetch)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('REMOTE_FETCH_FAILED')
      expect(result.error.params?.['reason']).toContain('Network error')
    }
  })
})

// ---------------------------------------------------------------------------
// downloadManifestFiles — with mocked fetch and real temp dirs
// ---------------------------------------------------------------------------

describe('downloadManifestFiles', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-hub-dl-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('downloads all files listed in manifest', async () => {
    const manifest: SquadManifest = {
      name: 'software',
      version: '1.0',
      domain: 'software',
      description: 'Dev squad',
      files: ['squad.yaml', 'agents/pm.md'],
    }

    const fileContents: Record<string, string> = {
      'squad.yaml': 'name: software\n',
      'agents/pm.md': '## Identity\nPM agent\n',
    }

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const filePath = url.split('/software/')[1] ?? ''
      return {
        ok: true,
        text: async () => fileContents[filePath] ?? '',
      }
    })

    const result = await downloadManifestFiles(manifest, tmpDir, REGISTRY_BASE_URL, mockFetch as unknown as typeof fetch)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(2)
    }

    // Verify files actually written
    const squadYaml = await readFile(join(tmpDir, 'squad.yaml'), 'utf-8')
    expect(squadYaml).toBe('name: software\n')
    const pmMd = await readFile(join(tmpDir, 'agents', 'pm.md'), 'utf-8')
    expect(pmMd).toBe('## Identity\nPM agent\n')
  })

  it('returns error if a file fetch fails', async () => {
    const manifest: SquadManifest = {
      name: 'software',
      version: '1.0',
      domain: 'software',
      description: 'Dev squad',
      files: ['squad.yaml'],
    }

    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 403 })

    const result = await downloadManifestFiles(manifest, tmpDir, REGISTRY_BASE_URL, mockFetch as unknown as typeof fetch)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('REMOTE_FETCH_FAILED')
  })
})

// ---------------------------------------------------------------------------
// downloadSquadFromHub — integration of fetch + download
// ---------------------------------------------------------------------------

describe('downloadSquadFromHub', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-hub-full-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('fetches manifest then downloads all files', async () => {
    const manifest: SquadManifest = {
      name: 'software',
      version: '1.0',
      domain: 'software',
      description: 'Dev',
      files: ['squad.yaml'],
    }

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes(SQUAD_MANIFEST_FILE)) {
        return { ok: true, text: async () => JSON.stringify(manifest) }
      }
      return { ok: true, text: async () => 'name: software\n' }
    })

    const result = await downloadSquadFromHub('software', tmpDir, REGISTRY_BASE_URL, mockFetch as unknown as typeof fetch)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.manifest.name).toBe('software')
      expect(result.value.files).toHaveLength(1)
    }
  })

  it('returns error if manifest fetch fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })

    const result = await downloadSquadFromHub('unknown', tmpDir, REGISTRY_BASE_URL, mockFetch as unknown as typeof fetch)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('REMOTE_FETCH_FAILED')
  })
})
