/**
 * Project Diagnostician — deep brownfield analysis after adoption.
 * Finds PRDs/specs, analyzes sprint progress, evaluates code quality,
 * identifies improvements, and generates a diagnostic report.
 * @module foundation/diagnostician
 */

import { readFile, readdir, access, stat } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { ScanResult } from './scanner.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FoundDocument {
  path: string
  relativePath: string
  type: 'prd' | 'spec' | 'plan' | 'status' | 'decision' | 'architecture' | 'context'
  title: string
  lineCount: number
}

export interface PhaseProgress {
  id: string
  name: string
  status: 'complete' | 'in-progress' | 'not-started'
  evidence: string
}

export interface CodeMetrics {
  totalFiles: number
  totalLines: number
  byDirectory: Record<string, { files: number; lines: number }>
  testFiles: number
  testLines: number
}

export interface QualitySignal {
  category: 'positive' | 'improvement'
  description: string
}

export interface DiagnosticReport {
  projectName: string
  generatedAt: string
  documents: FoundDocument[]
  phases: PhaseProgress[]
  metrics: CodeMetrics
  qualitySignals: QualitySignal[]
  requirements: RequirementStatus[]
  recommendations: string[]
}

export interface RequirementStatus {
  id: string
  description: string
  status: 'implemented' | 'partial' | 'not-started' | 'unknown'
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

async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

async function countFileLines(path: string): Promise<number> {
  const content = await safeReadFile(path)
  if (!content) return 0
  return content.split('\n').length
}

async function walkDir(dir: string, extensions: string[]): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__'
          || entry.name === 'dist' || entry.name === 'build' || entry.name === '.git'
          || entry.name === 'venv' || entry.name === '.venv') continue
      if (entry.isDirectory()) {
        const sub = await walkDir(fullPath, extensions)
        results.push(...sub)
      } else if (extensions.includes(extname(entry.name))) {
        results.push(fullPath)
      }
    }
  } catch { /* skip inaccessible dirs */ }
  return results
}

// ---------------------------------------------------------------------------
// Document discovery
// ---------------------------------------------------------------------------

const DOC_PATTERNS: Array<{
  glob: string[]
  type: FoundDocument['type']
  titlePrefix: string
}> = [
  { glob: ['PRD.md', 'prd.md', 'product-requirements.md'], type: 'prd', titlePrefix: 'PRD' },
  { glob: ['SPEC.md', 'spec.md', 'requirements.md', 'REQUIREMENTS.md'], type: 'spec', titlePrefix: 'Spec' },
  { glob: ['PLAN.md', 'plan.md', 'roadmap.md', 'ROADMAP.md'], type: 'plan', titlePrefix: 'Plan' },
  { glob: ['STATUS.md', 'status.md'], type: 'status', titlePrefix: 'Status' },
  { glob: ['DECISIONS.md', 'decisions.md', 'ADR.md'], type: 'decision', titlePrefix: 'Decisions' },
  { glob: ['ARCHITECTURE.md', 'architecture.md'], type: 'architecture', titlePrefix: 'Architecture' },
  { glob: ['project-context.md', 'CONTEXT.md'], type: 'context', titlePrefix: 'Context' },
]

async function discoverDocuments(projectDir: string): Promise<FoundDocument[]> {
  const docs: FoundDocument[] = []
  const searchDirs = [
    projectDir,
    join(projectDir, 'docs'),
    join(projectDir, '.buildpact'),
    join(projectDir, '.buildpact', 'specs'),
    join(projectDir, '.planning'),
    join(projectDir, '_bmad-output'),
  ]

  // Search fixed patterns in known dirs
  for (const dir of searchDirs) {
    if (!await fileExists(dir)) continue
    for (const pattern of DOC_PATTERNS) {
      for (const filename of pattern.glob) {
        const fullPath = join(dir, filename)
        if (await fileExists(fullPath)) {
          const lines = await countFileLines(fullPath)
          const content = await safeReadFile(fullPath)
          const h1 = content?.match(/^#\s+(.+)$/m)?.[1]
          docs.push({
            path: fullPath,
            relativePath: relative(projectDir, fullPath),
            type: pattern.type,
            title: h1 ?? `${pattern.titlePrefix}: ${filename}`,
            lineCount: lines,
          })
        }
      }
    }
  }

  // Deep scan .buildpact/specs/ subdirectories
  const specsDir = join(projectDir, '.buildpact', 'specs')
  if (await fileExists(specsDir)) {
    try {
      const slugs = await readdir(specsDir)
      for (const slug of slugs) {
        const slugDir = join(specsDir, slug)
        const s = await stat(slugDir).catch(() => null)
        if (!s?.isDirectory()) continue
        for (const name of ['SPEC.md', 'spec.md', 'PLAN.md', 'plan.md']) {
          const fp = join(slugDir, name)
          if (await fileExists(fp)) {
            const already = docs.some(d => d.path === fp)
            if (already) continue
            const lines = await countFileLines(fp)
            const content = await safeReadFile(fp)
            const h1 = content?.match(/^#\s+(.+)$/m)?.[1]
            docs.push({
              path: fp,
              relativePath: relative(projectDir, fp),
              type: name.toLowerCase().includes('plan') ? 'plan' : 'spec',
              title: h1 ?? name,
              lineCount: lines,
            })
          }
        }
      }
    } catch { /* skip */ }
  }

  return docs
}

// ---------------------------------------------------------------------------
// Phase / Sprint analysis
// ---------------------------------------------------------------------------

function extractPhases(docs: FoundDocument[], projectDir: string): PhaseProgress[] {
  const phases: PhaseProgress[] = []

  // Find the plan or status doc that has phase info
  const planDocs = docs.filter(d => d.type === 'plan' || d.type === 'status')

  for (const doc of planDocs) {
    try {
      const content = require('node:fs').readFileSync(doc.path, 'utf-8') as string
      // Match patterns like: "FASE 1 — Name  ✅ Complete" or "Phase 1: Name (Complete)"
      // Also: "- [x] Phase 1" or "FASE 1 ... ✅" or "Phase 1 ... ⏳"
      const phaseRegex = /(?:fase|phase|sprint|etapa)\s*(\d+(?:\.\d+)?)\s*[—:–\-]\s*(.+)/gi
      let match: RegExpExecArray | null
      while ((match = phaseRegex.exec(content)) !== null) {
        const id = match[1]!
        const rest = match[2]!.trim()
        // Extract name (before status markers)
        const name = rest.replace(/[✅⏳❌🔄]+.*$/, '').replace(/\(.*\)$/, '').trim()
        // Determine status
        let status: PhaseProgress['status'] = 'unknown' as PhaseProgress['status']
        if (/✅|complete|done|concluíd/i.test(rest)) status = 'complete'
        else if (/⏳|in.?progress|em andamento|next|atual/i.test(rest)) status = 'in-progress'
        else if (/❌|not.?started|não iniciad|pending|planejad/i.test(rest)) status = 'not-started'
        else status = 'not-started'

        // Avoid duplicates
        if (!phases.some(p => p.id === id)) {
          phases.push({ id: `fase-${id}`, name, status, evidence: doc.relativePath })
        }
      }
    } catch { /* skip unreadable */ }
  }

  // Also check git tags/commits for phase evidence
  try {
    const log = execFileSync('git', ['log', '--oneline', '-50'], { cwd: projectDir, encoding: 'utf-8' })
    const commitPhases = new Set<string>()
    const commitRegex = /\(fase-?(\d+)\)/gi
    let cm: RegExpExecArray | null
    while ((cm = commitRegex.exec(log)) !== null) {
      commitPhases.add(cm[1]!)
    }
    // Mark phases found in commits as at least complete (they were committed)
    for (const p of phases) {
      const num = p.id.replace('fase-', '')
      if (commitPhases.has(num) && p.status === 'not-started') {
        p.status = 'complete'
        p.evidence += ' + git history'
      }
    }
  } catch { /* no git */ }

  return phases
}

// ---------------------------------------------------------------------------
// Requirements extraction
// ---------------------------------------------------------------------------

function extractRequirements(docs: FoundDocument[]): RequirementStatus[] {
  const reqs: RequirementStatus[] = []
  const specDocs = docs.filter(d => d.type === 'spec' || d.type === 'prd')

  for (const doc of specDocs) {
    try {
      const content = require('node:fs').readFileSync(doc.path, 'utf-8') as string
      // Match REQ-1.1, FR-101, AC-1, etc.
      const reqRegex = /((?:REQ|FR|AC|NFR|US)-?\d+(?:\.\d+)?)\s*[:\-—]\s*(.+)/gi
      let match: RegExpExecArray | null
      while ((match = reqRegex.exec(content)) !== null) {
        const id = match[1]!.trim()
        const desc = match[2]!.trim().slice(0, 120)
        // Check for status markers
        let status: RequirementStatus['status'] = 'unknown'
        const line = content.slice(Math.max(0, match.index - 20), match.index + match[0].length + 50)
        if (/\[x\]|✅|implemented|complete|done/i.test(line)) status = 'implemented'
        else if (/\[ \]|⏳|partial|wip/i.test(line)) status = 'partial'
        else if (/❌|not started|deferred|excluded/i.test(line)) status = 'not-started'

        if (!reqs.some(r => r.id === id)) {
          reqs.push({ id, description: desc, status })
        }
      }
    } catch { /* skip */ }
  }

  return reqs
}

// ---------------------------------------------------------------------------
// Code metrics
// ---------------------------------------------------------------------------

async function collectCodeMetrics(projectDir: string, scan: ScanResult): Promise<CodeMetrics> {
  // Determine source extensions from detected languages
  const sourceExts: string[] = ['.ts', '.js', '.tsx', '.jsx', '.py', '.rs', '.go', '.java', '.kt']
  const testPatterns = ['test', 'spec', '__tests__', 'tests']

  const allFiles = await walkDir(projectDir, sourceExts)
  let totalLines = 0
  let testFiles = 0
  let testLines = 0
  const byDirectory: Record<string, { files: number; lines: number }> = {}

  for (const file of allFiles) {
    const rel = relative(projectDir, file)
    const lines = await countFileLines(file)
    totalLines += lines

    // Categorize by top-level directory
    const topDir = rel.split('/')[0] ?? 'root'
    if (!byDirectory[topDir]) byDirectory[topDir] = { files: 0, lines: 0 }
    byDirectory[topDir].files++
    byDirectory[topDir].lines += lines

    // Check if test file
    const isTest = testPatterns.some(p => rel.toLowerCase().includes(p))
    if (isTest) {
      testFiles++
      testLines += lines
    }
  }

  return {
    totalFiles: allFiles.length,
    totalLines,
    byDirectory,
    testFiles,
    testLines,
  }
}

// ---------------------------------------------------------------------------
// Quality signals
// ---------------------------------------------------------------------------

async function assessQuality(projectDir: string, scan: ScanResult, metrics: CodeMetrics): Promise<QualitySignal[]> {
  const signals: QualitySignal[] = []

  // Positive: has linters
  if (scan.linters.length > 0) {
    signals.push({ category: 'positive', description: `Linting configured: ${scan.linters.map(l => l.tool).join(', ')}` })
  } else {
    signals.push({ category: 'improvement', description: 'No linter/formatter detected — consider adding one for consistency' })
  }

  // Positive: has CI
  if (scan.ci.length > 0) {
    const gates = scan.ci.flatMap(c => c.qualityGates)
    signals.push({ category: 'positive', description: `CI/CD configured: ${scan.ci.map(c => c.platform).join(', ')}${gates.length > 0 ? ` (gates: ${gates.join(', ')})` : ''}` })
  } else {
    signals.push({ category: 'improvement', description: 'No CI/CD pipeline detected — consider adding automated testing and deployment' })
  }

  // Positive: has tests
  if (metrics.testFiles > 0) {
    const testRatio = metrics.testFiles / Math.max(metrics.totalFiles - metrics.testFiles, 1)
    signals.push({ category: 'positive', description: `${metrics.testFiles} test file(s) found (${(testRatio * 100).toFixed(0)}% test-to-source ratio)` })
    if (testRatio < 0.2) {
      signals.push({ category: 'improvement', description: 'Test coverage appears low — consider adding tests for critical paths' })
    }
  } else {
    signals.push({ category: 'improvement', description: 'No test files detected — consider adding unit tests for core logic' })
  }

  // Check for type checking
  if (await fileExists(join(projectDir, 'tsconfig.json'))) {
    signals.push({ category: 'positive', description: 'TypeScript type checking configured' })
  }
  if (await fileExists(join(projectDir, 'pyproject.toml'))) {
    const content = await safeReadFile(join(projectDir, 'pyproject.toml'))
    if (content?.includes('mypy') || content?.includes('pyright')) {
      signals.push({ category: 'positive', description: 'Python type checking configured (mypy/pyright)' })
    }
  }

  // Check for documentation
  if (await fileExists(join(projectDir, 'README.md'))) {
    signals.push({ category: 'positive', description: 'README.md present' })
  } else {
    signals.push({ category: 'improvement', description: 'No README.md found — consider adding project documentation' })
  }

  // Git hygiene
  if (scan.git) {
    if (scan.git.commitCount > 10) {
      signals.push({ category: 'positive', description: `Active git history (${scan.git.commitCount} commits, ${scan.git.contributorCount} contributor(s))` })
    }
    // Check commit message quality (sample last 10)
    try {
      const log = execFileSync('git', ['log', '--oneline', '-10'], { cwd: projectDir, encoding: 'utf-8' })
      const hasConventional = /^[a-f0-9]+ (feat|fix|chore|docs|test|refactor|ci)\(/m.test(log)
      if (hasConventional) {
        signals.push({ category: 'positive', description: 'Conventional commit messages detected' })
      }
    } catch { /* skip */ }
  }

  // Check for TODO/FIXME/HACK
  try {
    const todoCount = execFileSync(
      'grep', ['-r', '--include=*.py', '--include=*.ts', '--include=*.js', '-c', '-E', 'TODO|FIXME|HACK', '.'],
      { cwd: projectDir, encoding: 'utf-8' },
    )
    const total = todoCount.split('\n')
      .map(l => parseInt(l.split(':').pop() ?? '0', 10))
      .filter(n => !isNaN(n))
      .reduce((a, b) => a + b, 0)
    if (total > 0) {
      signals.push({ category: 'improvement', description: `${total} TODO/FIXME/HACK comment(s) found — review and address` })
    } else {
      signals.push({ category: 'positive', description: 'No TODO/FIXME/HACK debt markers in code' })
    }
  } catch {
    // grep returns exit 1 when no matches — that's positive
    signals.push({ category: 'positive', description: 'No TODO/FIXME/HACK debt markers in code' })
  }

  return signals
}

// ---------------------------------------------------------------------------
// Recommendations engine
// ---------------------------------------------------------------------------

function generateRecommendations(
  phases: PhaseProgress[],
  reqs: RequirementStatus[],
  quality: QualitySignal[],
  metrics: CodeMetrics,
): string[] {
  const recs: string[] = []

  // Phase-based recommendations
  const inProgress = phases.filter(p => p.status === 'in-progress')
  const notStarted = phases.filter(p => p.status === 'not-started')
  const complete = phases.filter(p => p.status === 'complete')

  if (inProgress.length > 0) {
    recs.push(`Continue current work: ${inProgress.map(p => `${p.id} (${p.name})`).join(', ')}`)
  }
  if (notStarted.length > 0 && complete.length > 0) {
    const next = notStarted[0]!
    recs.push(`Next phase to start: ${next.id} — ${next.name}`)
  }

  // Requirement gaps
  const unknownReqs = reqs.filter(r => r.status === 'unknown')
  const partialReqs = reqs.filter(r => r.status === 'partial')
  const notStartedReqs = reqs.filter(r => r.status === 'not-started')

  if (partialReqs.length > 0) {
    recs.push(`${partialReqs.length} requirement(s) partially implemented — review and complete: ${partialReqs.slice(0, 3).map(r => r.id).join(', ')}`)
  }
  if (notStartedReqs.length > 0) {
    recs.push(`${notStartedReqs.length} requirement(s) not yet started — prioritize for next sprint`)
  }
  if (unknownReqs.length > 5) {
    recs.push(`${unknownReqs.length} requirements have unclear status — run \`buildpact verify\` to assess coverage`)
  }

  // Quality-based recommendations
  const improvements = quality.filter(s => s.category === 'improvement')
  for (const imp of improvements.slice(0, 5)) {
    recs.push(imp.description)
  }

  // General
  if (recs.length === 0) {
    recs.push('Project appears healthy — run `buildpact specify` to capture your next requirement')
  }

  return recs
}

// ---------------------------------------------------------------------------
// Report formatter
// ---------------------------------------------------------------------------

export function formatDiagnosticReport(report: DiagnosticReport, lang: string): string {
  const ispt = lang === 'pt-br'
  const lines: string[] = []

  lines.push(`# ${ispt ? 'Diagnóstico do Projeto' : 'Project Diagnostic'} — ${report.projectName}`)
  lines.push('')
  lines.push(`> ${ispt ? 'Gerado em' : 'Generated on'} ${report.generatedAt}`)
  lines.push(`> ${ispt ? 'por' : 'by'} \`buildpact adopt\``)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Documents found
  lines.push(`## ${ispt ? 'Documentos Encontrados' : 'Documents Found'}`)
  lines.push('')
  if (report.documents.length === 0) {
    lines.push(ispt ? '_Nenhum documento de requisitos encontrado._' : '_No requirements documents found._')
  } else {
    lines.push(`| ${ispt ? 'Tipo' : 'Type'} | ${ispt ? 'Arquivo' : 'File'} | ${ispt ? 'Título' : 'Title'} | ${ispt ? 'Linhas' : 'Lines'} |`)
    lines.push('|------|------|-------|-------|')
    for (const doc of report.documents) {
      lines.push(`| ${doc.type} | \`${doc.relativePath}\` | ${doc.title} | ${doc.lineCount} |`)
    }
  }
  lines.push('')

  // Phase progress
  if (report.phases.length > 0) {
    lines.push(`## ${ispt ? 'Progresso por Fase' : 'Phase Progress'}`)
    lines.push('')
    const statusIcon = (s: string) => s === 'complete' ? '✅' : s === 'in-progress' ? '⏳' : '⬜'
    for (const phase of report.phases) {
      lines.push(`${statusIcon(phase.status)} **${phase.id}** — ${phase.name}`)
    }
    const completeCount = report.phases.filter(p => p.status === 'complete').length
    lines.push('')
    lines.push(`**${completeCount}/${report.phases.length}** ${ispt ? 'fases concluídas' : 'phases complete'}`)
    lines.push('')
  }

  // Code metrics
  lines.push(`## ${ispt ? 'Métricas do Código' : 'Code Metrics'}`)
  lines.push('')
  lines.push(`| ${ispt ? 'Métrica' : 'Metric'} | ${ispt ? 'Valor' : 'Value'} |`)
  lines.push('|--------|-------|')
  lines.push(`| ${ispt ? 'Arquivos fonte' : 'Source files'} | ${report.metrics.totalFiles} |`)
  lines.push(`| ${ispt ? 'Linhas de código' : 'Lines of code'} | ${report.metrics.totalLines.toLocaleString()} |`)
  lines.push(`| ${ispt ? 'Arquivos de teste' : 'Test files'} | ${report.metrics.testFiles} |`)
  lines.push(`| ${ispt ? 'Linhas de teste' : 'Test lines'} | ${report.metrics.testLines.toLocaleString()} |`)
  lines.push('')

  if (Object.keys(report.metrics.byDirectory).length > 0) {
    lines.push(`### ${ispt ? 'Por Diretório' : 'By Directory'}`)
    lines.push('')
    lines.push(`| ${ispt ? 'Diretório' : 'Directory'} | ${ispt ? 'Arquivos' : 'Files'} | ${ispt ? 'Linhas' : 'Lines'} |`)
    lines.push('|-----------|-------|-------|')
    const sorted = Object.entries(report.metrics.byDirectory).sort(([, a], [, b]) => b.lines - a.lines)
    for (const [dir, m] of sorted) {
      lines.push(`| \`${dir}/\` | ${m.files} | ${m.lines.toLocaleString()} |`)
    }
    lines.push('')
  }

  // Requirements
  if (report.requirements.length > 0) {
    lines.push(`## ${ispt ? 'Requisitos' : 'Requirements'} (${report.requirements.length})`)
    lines.push('')
    const statusIcon = (s: string) => s === 'implemented' ? '✅' : s === 'partial' ? '🔶' : s === 'not-started' ? '⬜' : '❓'
    const groups = {
      implemented: report.requirements.filter(r => r.status === 'implemented'),
      partial: report.requirements.filter(r => r.status === 'partial'),
      'not-started': report.requirements.filter(r => r.status === 'not-started'),
      unknown: report.requirements.filter(r => r.status === 'unknown'),
    }
    for (const [status, reqs] of Object.entries(groups)) {
      if (reqs.length === 0) continue
      const label = status === 'implemented' ? (ispt ? 'Implementados' : 'Implemented')
        : status === 'partial' ? (ispt ? 'Parciais' : 'Partial')
        : status === 'not-started' ? (ispt ? 'Não iniciados' : 'Not Started')
        : (ispt ? 'Status desconhecido' : 'Unknown Status')
      lines.push(`### ${statusIcon(status)} ${label} (${reqs.length})`)
      lines.push('')
      for (const r of reqs.slice(0, 20)) {
        lines.push(`- **${r.id}**: ${r.description}`)
      }
      if (reqs.length > 20) lines.push(`- _...e mais ${reqs.length - 20}_`)
      lines.push('')
    }
  }

  // Quality signals
  lines.push(`## ${ispt ? 'Qualidade' : 'Quality Assessment'}`)
  lines.push('')
  const positives = report.qualitySignals.filter(s => s.category === 'positive')
  const improvements = report.qualitySignals.filter(s => s.category === 'improvement')

  if (positives.length > 0) {
    lines.push(`### ${ispt ? 'Pontos Fortes' : 'Strengths'}`)
    lines.push('')
    for (const s of positives) {
      lines.push(`- ✅ ${s.description}`)
    }
    lines.push('')
  }
  if (improvements.length > 0) {
    lines.push(`### ${ispt ? 'Oportunidades de Melhoria' : 'Improvement Opportunities'}`)
    lines.push('')
    for (const s of improvements) {
      lines.push(`- 💡 ${s.description}`)
    }
    lines.push('')
  }

  // Recommendations
  lines.push('---')
  lines.push('')
  lines.push(`## ${ispt ? 'Recomendações' : 'Recommendations'}`)
  lines.push('')
  for (let i = 0; i < report.recommendations.length; i++) {
    lines.push(`${i + 1}. ${report.recommendations[i]}`)
  }
  lines.push('')

  // Next steps
  lines.push('---')
  lines.push('')
  lines.push(`## ${ispt ? 'Próximos Passos' : 'Next Steps'}`)
  lines.push('')
  lines.push(ispt
    ? '1. Revise este relatório e ajuste a `constitution.md` se necessário'
    : '1. Review this report and adjust `constitution.md` if needed')
  lines.push(ispt
    ? '2. Execute `buildpact specify` para capturar o próximo requisito'
    : '2. Run `buildpact specify` to capture the next requirement')
  lines.push(ispt
    ? '3. Execute `buildpact plan` para gerar um plano de implementação'
    : '3. Run `buildpact plan` to generate an implementation plan')
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a full diagnostic on a brownfield project.
 * Discovers docs, analyzes phases, collects metrics, assesses quality.
 */
export async function diagnoseProject(
  projectDir: string,
  scan: ScanResult,
): Promise<DiagnosticReport> {
  const projectName = scan.projectName

  // 1. Discover documents
  const documents = await discoverDocuments(projectDir)

  // 2. Extract phases from found docs
  const phases = extractPhases(documents, projectDir)

  // 3. Extract requirements
  const requirements = extractRequirements(documents)

  // 4. Collect code metrics
  const metrics = await collectCodeMetrics(projectDir, scan)

  // 5. Assess quality
  const qualitySignals = await assessQuality(projectDir, scan, metrics)

  // 6. Generate recommendations
  const recommendations = generateRecommendations(phases, requirements, qualitySignals, metrics)

  return {
    projectName,
    generatedAt: new Date().toISOString().slice(0, 10),
    documents,
    phases,
    metrics,
    qualitySignals,
    requirements,
    recommendations,
  }
}
