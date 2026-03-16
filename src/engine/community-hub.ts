/**
 * Community Hub integration for the buildpact-squads registry.
 * Handles detection, URL building, downloading, and README generation
 * for community Squads hosted on GitHub.
 *
 * Registry layout: https://raw.githubusercontent.com/buildpact/buildpact-squads/main/<squad-name>/
 *   <squad-name>/manifest.json   — lists all files in the squad
 *   <squad-name>/squad.yaml      — squad metadata
 *   <squad-name>/agents/*.md     — agent definition files
 * @see US-048 (Epic 11.1: Public Community Hub Repository)
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default GitHub raw content base for the community registry */
export const REGISTRY_BASE_URL =
  'https://raw.githubusercontent.com/buildpact/buildpact-squads/main'

/** Manifest file name within each squad directory in the registry */
export const SQUAD_MANIFEST_FILE = 'manifest.json'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Entry in the registry index listing available community squads */
export interface RegistrySquad {
  name: string
  version: string
  domain: string
  description: string
  validationPassing: boolean
  licenseType: string
}

/** Parsed squad manifest from the registry */
export interface SquadManifest {
  name: string
  version: string
  domain: string
  description: string
  files: string[]
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Returns true if the input looks like a registry squad name (no path separators,
 * no leading dot) rather than a local file-system path.
 */
export function isRegistryName(input: string): boolean {
  if (!input || input.trim().length === 0) return false
  const trimmed = input.trim()
  return (
    !trimmed.includes('/') &&
    !trimmed.includes('\\') &&
    !trimmed.startsWith('.')
  )
}

/**
 * Build the raw URL for a specific file within a registry squad directory.
 */
export function buildSquadFileUrl(
  registryBase: string,
  squadName: string,
  filePath: string,
): string {
  return `${registryBase}/${squadName}/${filePath}`
}

/**
 * Generate a markdown badge indicating whether a squad passes validation.
 * Used in the community hub README.
 */
export function buildValidationBadge(squadName: string, passing: boolean): string {
  if (passing) {
    return `![validation](https://img.shields.io/badge/${squadName}-passing-brightgreen)`
  }
  return `![validation](https://img.shields.io/badge/${squadName}-failing-red)`
}

/**
 * Generate the README.md content for the community hub registry index.
 * Lists squads in a table with validation badges and license info.
 */
export function formatRegistryIndex(squads: RegistrySquad[]): string {
  const header = [
    '# BuildPact Community Squads',
    '',
    'A curated collection of domain-specific Agent Squads for the BuildPact framework.',
    '',
    '## Available Squads',
    '',
    '| Squad | Domain | Validation | License | Description |',
    '|-------|--------|-----------|---------|-------------|',
  ]

  const rows = squads.map(s => {
    const badge = buildValidationBadge(s.name, s.validationPassing)
    return `| **${s.name}** | ${s.domain} | ${badge} | ${s.licenseType} | ${s.description} |`
  })

  const footer = [
    '',
    '## Installation',
    '',
    '```bash',
    'npx buildpact squad add <squad-name>',
    '```',
    '',
    '## Contributing',
    '',
    'See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution guide.',
    '',
    '## License',
    '',
    'Each Squad is licensed under MIT unless otherwise noted in its directory.',
  ]

  return [...header, ...rows, ...footer].join('\n') + '\n'
}

/**
 * Parse a squad manifest JSON string, returning structured manifest data.
 * Returns err() if JSON is invalid or required fields are missing.
 */
export function parseSquadManifest(json: string): Result<SquadManifest> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return err({
      code: ERROR_CODES.REMOTE_FETCH_FAILED,
      i18nKey: 'error.network.remote_fetch_failed',
      params: { url: SQUAD_MANIFEST_FILE, reason: 'invalid JSON in manifest' },
    })
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('name' in parsed) ||
    !('files' in parsed)
  ) {
    return err({
      code: ERROR_CODES.REMOTE_FETCH_FAILED,
      i18nKey: 'error.network.remote_fetch_failed',
      params: { url: SQUAD_MANIFEST_FILE, reason: 'manifest missing required fields' },
    })
  }

  const m = parsed as Record<string, unknown>
  return ok({
    name: String(m['name'] ?? ''),
    version: String(m['version'] ?? '1.0'),
    domain: String(m['domain'] ?? 'custom'),
    description: String(m['description'] ?? ''),
    files: Array.isArray(m['files']) ? (m['files'] as unknown[]).map(String) : [],
  })
}

// ---------------------------------------------------------------------------
// I/O functions
// ---------------------------------------------------------------------------

/**
 * Fetch the manifest for a squad from the registry.
 * Returns the parsed SquadManifest on success, or an error.
 *
 * @param squadName - Name of the squad in the registry
 * @param registryBase - Optional registry base URL (defaults to REGISTRY_BASE_URL)
 * @param fetchFn - Injectable fetch function (defaults to global fetch) for testing
 */
export async function fetchSquadManifest(
  squadName: string,
  registryBase = REGISTRY_BASE_URL,
  fetchFn: typeof fetch = fetch,
): Promise<Result<SquadManifest>> {
  const url = buildSquadFileUrl(registryBase, squadName, SQUAD_MANIFEST_FILE)
  try {
    const response = await fetchFn(url)
    if (!response.ok) {
      return err({
        code: ERROR_CODES.REMOTE_FETCH_FAILED,
        i18nKey: 'error.network.remote_fetch_failed',
        params: { url, reason: `HTTP ${response.status}` },
      })
    }
    const text = await response.text()
    return parseSquadManifest(text)
  } catch (cause) {
    return err({
      code: ERROR_CODES.REMOTE_FETCH_FAILED,
      i18nKey: 'error.network.remote_fetch_failed',
      params: { url, reason: cause instanceof Error ? cause.message : String(cause) },
      cause,
    })
  }
}

/**
 * Download all files listed in a squad manifest to a local directory.
 * Creates any necessary subdirectories.
 *
 * @param manifest - Parsed squad manifest
 * @param targetDir - Local directory to download files into
 * @param registryBase - Optional registry base URL
 * @param fetchFn - Injectable fetch function for testing
 */
export async function downloadManifestFiles(
  manifest: SquadManifest,
  targetDir: string,
  registryBase = REGISTRY_BASE_URL,
  fetchFn: typeof fetch = fetch,
): Promise<Result<string[]>> {
  const downloaded: string[] = []

  for (const filePath of manifest.files) {
    const url = buildSquadFileUrl(registryBase, manifest.name, filePath)
    try {
      const response = await fetchFn(url)
      if (!response.ok) {
        return err({
          code: ERROR_CODES.REMOTE_FETCH_FAILED,
          i18nKey: 'error.network.remote_fetch_failed',
          params: { url, reason: `HTTP ${response.status}` },
        })
      }
      const content = await response.text()
      const localPath = join(targetDir, filePath)
      await mkdir(dirname(localPath), { recursive: true })
      await writeFile(localPath, content, 'utf-8')
      downloaded.push(localPath)
    } catch (cause) {
      return err({
        code: ERROR_CODES.REMOTE_FETCH_FAILED,
        i18nKey: 'error.network.remote_fetch_failed',
        params: { url, reason: cause instanceof Error ? cause.message : String(cause) },
        cause,
      })
    }
  }

  return ok(downloaded)
}

/**
 * High-level function: download a squad from the community hub into a target directory.
 * Fetches the manifest then downloads all listed files.
 *
 * @param squadName - Registry squad name to download
 * @param targetDir - Local directory to place squad files
 * @param registryBase - Optional registry base URL override
 * @param fetchFn - Injectable fetch function for testing
 */
export async function downloadSquadFromHub(
  squadName: string,
  targetDir: string,
  registryBase = REGISTRY_BASE_URL,
  fetchFn: typeof fetch = fetch,
): Promise<Result<{ manifest: SquadManifest; files: string[] }>> {
  const manifestResult = await fetchSquadManifest(squadName, registryBase, fetchFn)
  if (!manifestResult.ok) return manifestResult

  const manifest = manifestResult.value
  const filesResult = await downloadManifestFiles(manifest, targetDir, registryBase, fetchFn)
  if (!filesResult.ok) return filesResult

  return ok({ manifest, files: filesResult.value })
}
