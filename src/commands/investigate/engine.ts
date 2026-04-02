/**
 * @module commands/investigate/engine
 * @see Story 15.5 — CLI Investigate Command
 *
 * Investigation engine: scope detection, codebase scanning,
 * report generation.
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { ok, type Result } from '../../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvestigationType = 'domain' | 'codebase' | 'technology'

export interface InvestigationReport {
  type: InvestigationType
  slug: string
  query: string
  findings: string[]
  recommendations: string[]
  bestPractices: string[]
  techStack?: TechStackInfo | undefined
  timestamp: string
}

export interface TechStackInfo {
  languages: string[]
  frameworks: string[]
  buildTools: string[]
  testFrameworks: string[]
  configFiles: string[]
  sourceFileCount: number
  testFileCount: number
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

/**
 * Generate a filesystem-safe slug from an investigation query.
 */
export function generateSlug(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

// ---------------------------------------------------------------------------
// Scope detection
// ---------------------------------------------------------------------------

const DOMAIN_KEYWORDS = ['squad', 'industry', 'healthcare', 'medical', 'finance', 'legal', 'compliance', 'regulation', 'standard', 'practice', 'domain']
const CODEBASE_KEYWORDS = ['codebase', 'architecture', 'code', 'understand', 'analyze', 'scan', 'audit', 'structure']
const TECHNOLOGY_KEYWORDS = ['compare', 'versus', 'vs', 'alternative', 'benchmark', 'library', 'framework', 'react', 'svelte', 'vue', 'angular', 'technology', 'tech']

/**
 * Detect the investigation type from user intent/query.
 */
export function detectScope(query: string, explicitType?: InvestigationType): InvestigationType {
  if (explicitType) return explicitType

  const lower = query.toLowerCase()

  const domainScore = DOMAIN_KEYWORDS.filter((kw) => lower.includes(kw)).length
  const codebaseScore = CODEBASE_KEYWORDS.filter((kw) => lower.includes(kw)).length
  const techScore = TECHNOLOGY_KEYWORDS.filter((kw) => lower.includes(kw)).length

  if (techScore > domainScore && techScore > codebaseScore) return 'technology'
  if (codebaseScore > domainScore && codebaseScore > techScore) return 'codebase'
  return 'domain' // default to domain investigation
}

// ---------------------------------------------------------------------------
// Codebase investigation (filesystem-based)
// ---------------------------------------------------------------------------

const KNOWN_LANGUAGES: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (React)',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (React)',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.rb': 'Ruby',
  '.cs': 'C#',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.cpp': 'C++',
  '.c': 'C',
}

const KNOWN_CONFIGS: Record<string, string> = {
  'package.json': 'Node.js / npm',
  'tsconfig.json': 'TypeScript',
  'vitest.config.ts': 'Vitest',
  'jest.config.js': 'Jest',
  'jest.config.ts': 'Jest',
  '.eslintrc': 'ESLint',
  '.eslintrc.json': 'ESLint',
  '.eslintrc.js': 'ESLint',
  'eslint.config.js': 'ESLint (flat)',
  '.prettierrc': 'Prettier',
  'webpack.config.js': 'Webpack',
  'vite.config.ts': 'Vite',
  'vite.config.js': 'Vite',
  'next.config.js': 'Next.js',
  'nuxt.config.ts': 'Nuxt',
  'docker-compose.yml': 'Docker Compose',
  'Dockerfile': 'Docker',
  '.github/workflows': 'GitHub Actions',
  'Makefile': 'Make',
  'turbo.json': 'Turborepo',
  'pnpm-workspace.yaml': 'pnpm workspace',
  'Cargo.toml': 'Rust/Cargo',
  'go.mod': 'Go modules',
  'requirements.txt': 'Python pip',
  'pyproject.toml': 'Python (modern)',
  'Gemfile': 'Ruby Bundler',
}

/**
 * Investigate the codebase at projectDir.
 */
export async function investigateCodebase(projectDir: string): Promise<TechStackInfo> {
  const languages = new Set<string>()
  const frameworks = new Set<string>()
  const buildTools = new Set<string>()
  const testFrameworks = new Set<string>()
  const configFiles: string[] = []
  let sourceFileCount = 0
  let testFileCount = 0

  // Check root config files
  try {
    const rootEntries = await readdir(projectDir)
    for (const entry of rootEntries) {
      if (KNOWN_CONFIGS[entry]) {
        configFiles.push(entry)
        const category = KNOWN_CONFIGS[entry]!
        if (category.includes('Vitest') || category.includes('Jest')) {
          testFrameworks.add(category)
        } else if (category.includes('Webpack') || category.includes('Vite') || category.includes('Turbo')) {
          buildTools.add(category)
        } else if (category.includes('Next') || category.includes('Nuxt')) {
          frameworks.add(category)
        }
      }
    }
  } catch {
    // Can't read root — partial info
  }

  // Check for package.json deps
  try {
    const pkgJson = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf-8'))
    const allDeps = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies,
    }
    if (allDeps['react']) frameworks.add('React')
    if (allDeps['vue']) frameworks.add('Vue')
    if (allDeps['@angular/core']) frameworks.add('Angular')
    if (allDeps['svelte']) frameworks.add('Svelte')
    if (allDeps['express']) frameworks.add('Express')
    if (allDeps['fastify']) frameworks.add('Fastify')
    if (allDeps['next']) frameworks.add('Next.js')
    if (allDeps['vitest']) testFrameworks.add('Vitest')
    if (allDeps['jest']) testFrameworks.add('Jest')
    if (allDeps['mocha']) testFrameworks.add('Mocha')
    if (allDeps['typescript']) buildTools.add('TypeScript')
    if (allDeps['esbuild']) buildTools.add('esbuild')
    if (allDeps['tsup']) buildTools.add('tsup')
  } catch {
    // No package.json
  }

  // Walk src/ for language detection and file counts
  async function walkForStats(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walkForStats(fullPath)
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase()
          if (KNOWN_LANGUAGES[ext]) {
            languages.add(KNOWN_LANGUAGES[ext]!)
          }
          if (
            entry.name.includes('.test.') ||
            entry.name.includes('.spec.') ||
            dir.includes('/test') ||
            dir.includes('/__tests__')
          ) {
            testFileCount++
          } else if (KNOWN_LANGUAGES[ext]) {
            sourceFileCount++
          }
        }
      }
    } catch {
      // Can't read dir
    }
  }

  await walkForStats(projectDir)

  return {
    languages: Array.from(languages),
    frameworks: Array.from(frameworks),
    buildTools: Array.from(buildTools),
    testFrameworks: Array.from(testFrameworks),
    configFiles,
    sourceFileCount,
    testFileCount,
  }
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

/**
 * Generate a codebase investigation brief as markdown.
 */
export function formatCodebaseBrief(info: TechStackInfo): string {
  const lines: string[] = [
    '## Tech Stack',
    `- **Languages**: ${info.languages.join(', ') || 'Unknown'}`,
    `- **Frameworks**: ${info.frameworks.join(', ') || 'None detected'}`,
    `- **Build Tools**: ${info.buildTools.join(', ') || 'None detected'}`,
    `- **Test Frameworks**: ${info.testFrameworks.join(', ') || 'None detected'}`,
    '',
    '## Project Stats',
    `- Source files: ${info.sourceFileCount}`,
    `- Test files: ${info.testFileCount}`,
    `- Config files: ${info.configFiles.join(', ') || 'None'}`,
    '',
  ]

  if (info.testFileCount === 0 && info.sourceFileCount > 0) {
    lines.push('## Pain Points')
    lines.push('- No test files detected — consider adding a test framework')
  }

  return lines.join('\n')
}

/**
 * Generate a domain investigation brief (template-based).
 */
export function formatDomainBrief(query: string): string {
  return [
    `## Domain Investigation: ${query}`,
    '',
    '### Industry Standards',
    '- (Requires further research — use an LLM subagent for deep domain analysis)',
    '',
    '### Best Practices',
    '- (Requires further research)',
    '',
    '### Common Workflows',
    '- (Requires further research)',
    '',
    '### Key Terminology',
    '- (Requires further research)',
    '',
    '### Quality Criteria',
    '- (Requires further research)',
    '',
    '> Note: For a comprehensive domain investigation, run this command with an LLM provider configured.',
  ].join('\n')
}

/**
 * Generate a technology investigation brief (template-based).
 */
export function formatTechBrief(query: string): string {
  return [
    `## Technology Investigation: ${query}`,
    '',
    '### Alternatives Comparison',
    '- (Requires further research — use an LLM subagent for technology comparison)',
    '',
    '### Community Health',
    '- (Requires further research)',
    '',
    '### Compatibility',
    '- (Requires further research)',
    '',
    '### Performance',
    '- (Requires further research)',
    '',
    '### Migration Cost',
    '- (Requires further research)',
    '',
    '> Note: For a comprehensive technology comparison, run this command with an LLM provider configured.',
  ].join('\n')
}

/**
 * Format the final investigation report as markdown.
 */
export function formatInvestigationReport(report: InvestigationReport): string {
  const lines: string[] = [
    `# Investigation Report — ${report.slug}`,
    `> Generated: ${report.timestamp} | Type: ${report.type}`,
    '',
  ]

  if (report.findings.length > 0) {
    lines.push('## Key Findings')
    for (let i = 0; i < report.findings.length; i++) {
      lines.push(`${i + 1}. ${report.findings[i]}`)
    }
    lines.push('')
  }

  if (report.recommendations.length > 0) {
    lines.push('## Recommendations')
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`)
    }
    lines.push('')
  }

  if (report.bestPractices.length > 0) {
    lines.push('## Relevant Best Practices')
    for (const bp of report.bestPractices) {
      lines.push(`- ${bp}`)
    }
    lines.push('')
  }

  lines.push('## Next Steps')
  lines.push('- If designing a squad: Use this brief to inform agent roles and heuristics')
  lines.push('- If planning a feature: Use this brief as research input for /bp:plan')
  lines.push('- If understanding codebase: Use this brief for /bp:adopt or new team onboarding')
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Best practices auto-injection
// ---------------------------------------------------------------------------

/**
 * Load matching best practices from templates/best-practices/.
 */
export async function loadMatchingBestPractices(
  projectDir: string,
  query: string,
): Promise<string[]> {
  const bpDir = join(projectDir, 'templates', 'best-practices')
  try {
    const files = await readdir(bpDir)
    const practices: string[] = []
    const lower = query.toLowerCase()

    for (const file of files) {
      const name = file.replace(extname(file), '').toLowerCase()
      if (lower.includes(name) || name.includes(lower.split(' ')[0] ?? '')) {
        const content = await readFile(join(bpDir, file), 'utf-8')
        const firstLine = content.split('\n').find((l) => l.trim().startsWith('#'))
        practices.push(firstLine?.replace(/^#+\s*/, '') ?? file)
      }
    }

    return practices
  } catch {
    return []
  }
}

/**
 * Run a full investigation and return a report.
 */
export async function runInvestigation(
  type: InvestigationType,
  query: string,
  projectDir: string,
): Promise<Result<InvestigationReport>> {
  const slug = generateSlug(query)
  const timestamp = new Date().toISOString()
  const bestPractices = await loadMatchingBestPractices(projectDir, query)
  const findings: string[] = []
  const recommendations: string[] = []
  let techStack: TechStackInfo | undefined

  if (type === 'codebase') {
    techStack = await investigateCodebase(projectDir)
    findings.push(`Languages detected: ${techStack.languages.join(', ') || 'None'}`)
    findings.push(`${techStack.sourceFileCount} source file(s), ${techStack.testFileCount} test file(s)`)
    if (techStack.frameworks.length > 0) {
      findings.push(`Frameworks: ${techStack.frameworks.join(', ')}`)
    }
    if (techStack.testFileCount === 0 && techStack.sourceFileCount > 0) {
      recommendations.push('Add a test framework and write unit tests')
    }
    recommendations.push('Document architecture patterns in docs/architecture.md')
  } else if (type === 'domain') {
    findings.push(`Domain investigation requested for: ${query}`)
    recommendations.push('Use an LLM provider for comprehensive domain analysis')
    recommendations.push('Consider creating a domain-specific squad after investigation')
  } else {
    findings.push(`Technology investigation requested for: ${query}`)
    recommendations.push('Use an LLM provider for comprehensive technology comparison')
    recommendations.push('Create a proof-of-concept before committing to a technology choice')
  }

  return ok({
    type,
    slug,
    query,
    findings,
    recommendations,
    bestPractices,
    techStack,
    timestamp,
  })
}
