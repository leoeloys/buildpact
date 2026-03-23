/**
 * Project scanner — detect technology stack, conventions, and CI from an existing codebase.
 * Used by `buildpact adopt` to pre-populate constitution and project context.
 * @module foundation/scanner
 */

import { readFile, access, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { IdeId } from './installer.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanResult {
  packageManagers: PackageManagerInfo[]
  languages: string[]
  linters: LinterInfo[]
  ci: CiInfo[]
  git: GitStats | null
  existingAiConfigs: ExistingAiConfig[]
  existingBuildpact: boolean
  inferredDomain: string
  projectName: string
}

export interface PackageManagerInfo {
  name: string
  configFile: string
  projectName?: string
  version?: string
}

export interface LinterInfo {
  tool: string
  configFile: string
  extractedRules: string[]
}

export interface CiInfo {
  platform: string
  configFile: string
  qualityGates: string[]
}

export interface GitStats {
  commitCount: number
  branchCount: number
  contributorCount: number
  firstCommitDate: string
  hasUncommittedChanges: boolean
}

export interface ExistingAiConfig {
  ide: IdeId
  files: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

async function detectPackageManagers(dir: string): Promise<PackageManagerInfo[]> {
  const results: PackageManagerInfo[] = []

  // Node.js (npm/pnpm/yarn)
  const pkg = await readJson(join(dir, 'package.json'))
  if (pkg) {
    const lockFiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']
    let manager = 'npm'
    for (const lock of lockFiles) {
      if (await fileExists(join(dir, lock))) {
        if (lock.startsWith('pnpm')) manager = 'pnpm'
        else if (lock.startsWith('yarn')) manager = 'yarn'
        break
      }
    }
    const info: PackageManagerInfo = { name: manager, configFile: 'package.json' }
    if (typeof pkg.name === 'string') info.projectName = pkg.name
    if (typeof pkg.version === 'string') info.version = pkg.version
    results.push(info)
  }

  // Rust
  if (await fileExists(join(dir, 'Cargo.toml'))) {
    results.push({ name: 'cargo', configFile: 'Cargo.toml' })
  }

  // Python
  if (await fileExists(join(dir, 'pyproject.toml'))) {
    results.push({ name: 'poetry', configFile: 'pyproject.toml' })
  } else if (await fileExists(join(dir, 'requirements.txt'))) {
    results.push({ name: 'pip', configFile: 'requirements.txt' })
  }

  // Go
  if (await fileExists(join(dir, 'go.mod'))) {
    results.push({ name: 'go', configFile: 'go.mod' })
  }

  // Java
  if (await fileExists(join(dir, 'pom.xml'))) {
    results.push({ name: 'maven', configFile: 'pom.xml' })
  } else if (await fileExists(join(dir, 'build.gradle'))) {
    results.push({ name: 'gradle', configFile: 'build.gradle' })
  }

  return results
}

async function detectLanguages(dir: string): Promise<string[]> {
  const langs: string[] = []

  if (await fileExists(join(dir, 'tsconfig.json'))) langs.push('TypeScript')
  else if (await fileExists(join(dir, 'package.json'))) langs.push('JavaScript')

  if (await fileExists(join(dir, 'Cargo.toml'))) langs.push('Rust')
  if (await fileExists(join(dir, 'go.mod'))) langs.push('Go')
  if (await fileExists(join(dir, 'pyproject.toml')) || await fileExists(join(dir, 'requirements.txt'))) langs.push('Python')
  if (await fileExists(join(dir, 'pom.xml')) || await fileExists(join(dir, 'build.gradle'))) langs.push('Java')

  return langs
}

async function detectLinters(dir: string): Promise<LinterInfo[]> {
  const results: LinterInfo[] = []

  // ESLint
  const eslintFiles = ['.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yml', 'eslint.config.js', 'eslint.config.mjs', 'eslint.config.ts']
  for (const file of eslintFiles) {
    if (await fileExists(join(dir, file))) {
      const rules: string[] = []
      if (file.startsWith('eslint.config')) rules.push('flat config')
      results.push({ tool: 'eslint', configFile: file, extractedRules: rules })
      break
    }
  }

  // Prettier
  const prettierFiles = ['.prettierrc', '.prettierrc.json', '.prettierrc.yml', '.prettierrc.js', 'prettier.config.js']
  for (const file of prettierFiles) {
    if (await fileExists(join(dir, file))) {
      results.push({ tool: 'prettier', configFile: file, extractedRules: [] })
      break
    }
  }

  // Biome
  if (await fileExists(join(dir, 'biome.json')) || await fileExists(join(dir, 'biome.jsonc'))) {
    const configFile = await fileExists(join(dir, 'biome.json')) ? 'biome.json' : 'biome.jsonc'
    results.push({ tool: 'biome', configFile, extractedRules: [] })
  }

  // Ruff (Python)
  if (await fileExists(join(dir, 'ruff.toml')) || await fileExists(join(dir, '.ruff.toml'))) {
    const configFile = await fileExists(join(dir, 'ruff.toml')) ? 'ruff.toml' : '.ruff.toml'
    results.push({ tool: 'ruff', configFile, extractedRules: [] })
  }

  return results
}

async function detectCi(dir: string): Promise<CiInfo[]> {
  const results: CiInfo[] = []

  // GitHub Actions
  const ghDir = join(dir, '.github', 'workflows')
  if (await fileExists(ghDir)) {
    try {
      const files = await readdir(ghDir)
      const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      if (yamlFiles.length > 0) {
        const gates: string[] = []
        for (const yf of yamlFiles.slice(0, 3)) {
          try {
            const content = await readFile(join(ghDir, yf), 'utf-8')
            if (/\btest\b/i.test(content)) gates.push('test')
            if (/\blint\b/i.test(content)) gates.push('lint')
            if (/\bbuild\b/i.test(content)) gates.push('build')
          } catch { /* skip unreadable */ }
        }
        results.push({ platform: 'github-actions', configFile: '.github/workflows/', qualityGates: [...new Set(gates)] })
      }
    } catch { /* skip */ }
  }

  // GitLab CI
  if (await fileExists(join(dir, '.gitlab-ci.yml'))) {
    results.push({ platform: 'gitlab-ci', configFile: '.gitlab-ci.yml', qualityGates: [] })
  }

  return results
}

function detectGitStats(dir: string): GitStats | null {
  try {
    const commitCount = parseInt(
      execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: dir, encoding: 'utf-8' }).trim(),
      10,
    )
    const branchCount = parseInt(
      execFileSync('git', ['branch', '--list'], { cwd: dir, encoding: 'utf-8' })
        .split('\n').filter(l => l.trim()).length.toString(),
      10,
    )
    const contributorCount = parseInt(
      execFileSync('git', ['shortlog', '-sn', '--no-merges', 'HEAD'], { cwd: dir, encoding: 'utf-8' })
        .split('\n').filter(l => l.trim()).length.toString(),
      10,
    )
    const firstCommitDate = execFileSync(
      'git', ['log', '--reverse', '--format=%aI', '--max-count=1'],
      { cwd: dir, encoding: 'utf-8' },
    ).trim()
    const statusOutput = execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf-8' })
    const hasUncommittedChanges = statusOutput.trim().length > 0

    return { commitCount, branchCount, contributorCount, firstCommitDate, hasUncommittedChanges }
  } catch {
    return null
  }
}

async function detectAiConfigs(dir: string): Promise<ExistingAiConfig[]> {
  const results: ExistingAiConfig[] = []

  const claudeFiles = ['.claude/commands', 'CLAUDE.md']
  const claudeFound: string[] = []
  for (const f of claudeFiles) {
    if (await fileExists(join(dir, f))) claudeFound.push(f)
  }
  if (claudeFound.length > 0) results.push({ ide: 'claude-code', files: claudeFound })

  const cursorFiles = ['.cursor/rules', '.cursorrules']
  const cursorFound: string[] = []
  for (const f of cursorFiles) {
    if (await fileExists(join(dir, f))) cursorFound.push(f)
  }
  if (cursorFound.length > 0) results.push({ ide: 'cursor', files: cursorFound })

  if (await fileExists(join(dir, '.gemini'))) results.push({ ide: 'gemini', files: ['.gemini'] })
  if (await fileExists(join(dir, '.codex'))) results.push({ ide: 'codex', files: ['.codex'] })

  return results
}

function inferDomain(pkgs: PackageManagerInfo[], langs: string[]): string {
  // Default to software for any detected package manager
  if (pkgs.length > 0 || langs.length > 0) return 'software'
  return 'custom'
}

function inferProjectName(dir: string, pkgs: PackageManagerInfo[]): string {
  // Use package.json name if available
  const npmPkg = pkgs.find(p => p.configFile === 'package.json')
  if (npmPkg?.projectName) return npmPkg.projectName

  // Fallback to directory name
  return dir.split('/').pop() ?? 'my-project'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan a project directory and detect its technology stack.
 * All detections are best-effort — never throws.
 */
export async function scanProject(projectDir: string): Promise<ScanResult> {
  const [packageManagers, languages, linters, ci, existingAiConfigs] = await Promise.all([
    detectPackageManagers(projectDir),
    detectLanguages(projectDir),
    detectLinters(projectDir),
    detectCi(projectDir),
    detectAiConfigs(projectDir),
  ])

  const git = detectGitStats(projectDir)
  const existingBuildpact = await fileExists(join(projectDir, '.buildpact'))

  return {
    packageManagers,
    languages,
    linters,
    ci,
    git,
    existingAiConfigs,
    existingBuildpact,
    inferredDomain: inferDomain(packageManagers, languages),
    projectName: inferProjectName(projectDir, packageManagers),
  }
}

/**
 * Format a human-readable summary of the scan results.
 * Used to display to the user before confirmation.
 */
export function formatScanSummary(scan: ScanResult): string {
  const parts: string[] = []

  if (scan.languages.length > 0) parts.push(scan.languages.join(' + '))
  if (scan.packageManagers.length > 0) {
    const mgrs = scan.packageManagers.map(p => p.name).join(', ')
    parts.push(mgrs)
  }
  if (scan.linters.length > 0) {
    const tools = scan.linters.map(l => l.tool).join(', ')
    parts.push(tools)
  }
  if (scan.ci.length > 0) {
    const platforms = scan.ci.map(c => c.platform).join(', ')
    parts.push(platforms)
  }
  if (scan.git) {
    parts.push(`${scan.git.commitCount} commits, ${scan.git.contributorCount} contributor(s)`)
  }

  return parts.join(', ')
}
