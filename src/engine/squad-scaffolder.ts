/**
 * Squad Scaffolder — create and install Squads.
 * Implements FR-801 (squad create) and FR-802 (squad add / install).
 */

import { mkdir, writeFile, readFile, readdir, cp } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** Generates squad.yaml content for a new scaffold */
function buildSquadYaml(name: string): string {
  return [
    `# Squad Manifest — ${name}`,
    `# Edit this file to configure your Squad.`,
    ``,
    `name: ${name}`,
    `version: "0.1.0"`,
    `domain: custom`,
    `description: "Custom Squad — describe your squad's purpose here"`,
    `initial_level: L2`,
    ``,
    `# Agent files are relative to this squad directory`,
    `agents:`,
    `  chief:`,
    `    file: agents/chief.md`,
    `  specialist:`,
    `    file: agents/specialist.md`,
    `  support:`,
    `    file: agents/support.md`,
    `  reviewer:`,
    `    file: agents/reviewer.md`,
    ``,
    `# Optional: attach hooks to pipeline events`,
    `# hooks:`,
    `#   on_specify_start: hooks/on-specify-start.md`,
    `#   on_plan_complete: hooks/on-plan-complete.md`,
    ``,
    `bundle_disclaimers:`,
    `  en: "This content was AI-generated and should be reviewed before production use."`,
    `  pt-br: "Este conteúdo foi gerado por IA e deve ser revisado antes do uso em produção."`,
  ].join('\n') + '\n'
}

/** Generates a README for a new scaffold */
function buildReadme(name: string): string {
  return [
    `# ${name} Squad`,
    ``,
    `> A BuildPact Squad — domain-aware agents for structured AI collaboration.`,
    ``,
    `## Structure`,
    ``,
    `\`\`\``,
    `${name}/`,
    `├── squad.yaml          # Squad manifest (name, version, agents, hooks)`,
    `├── README.md           # This file`,
    `├── agents/             # Agent definitions (6-layer anatomy)`,
    `│   ├── chief.md        # T1 — Chief: orchestrates the Squad workflow`,
    `│   ├── specialist.md   # T2 — Specialist: core domain expert`,
    `│   ├── support.md      # T3 — Support: assists specialists with sub-tasks`,
    `│   └── reviewer.md     # T4 — Reviewer: validates output quality`,
    `├── hooks/              # Optional pipeline hook handlers`,
    `└── benchmark/          # Quality benchmarks for agent evaluation`,
    `\`\`\``,
    ``,
    `## Getting Started`,
    ``,
    `1. Edit \`squad.yaml\` to set the squad name, domain, and description.`,
    `2. Fill in each agent file in \`agents/\` following the 6-layer anatomy.`,
    `3. Run \`buildpact squad validate\` (v2.0) to verify your Squad.`,
    ``,
    `## 6-Layer Agent Anatomy`,
    ``,
    `Each agent file must contain all 6 layers:`,
    ``,
    `| Layer | Purpose |`,
    `|-------|---------|`,
    `| **Identity** | Who the agent is — name, squad, tier, level |`,
    `| **Persona** | Behavioral style and working approach |`,
    `| **Voice DNA** | Personality anchors, opinions, anti-patterns, never-do rules |`,
    `| **Heuristics** | IF/THEN decision rules (min 3, with veto conditions) |`,
    `| **Examples** | Concrete input/output pairs demonstrating behavior (min 3) |`,
    `| **Handoffs** | Incoming triggers and outgoing signals to other agents |`,
    ``,
    `## Validation`,
    ``,
    `Run \`npx buildpact squad validate ${name}\` to check structural integrity.`,
  ].join('\n') + '\n'
}

/** Generates a tier-specific agent template with all 6 layers and inline docs */
function buildAgentTemplate(squadName: string, role: string, tier: 'T1' | 'T2' | 'T3' | 'T4', level: 'L1' | 'L2'): string {
  const tierLabel: Record<string, string> = {
    T1: 'Chief — Orchestrator',
    T2: 'Specialist — Core Expert',
    T3: 'Support — Sub-task Assistant',
    T4: 'Reviewer — Quality Validator',
  }
  const label = tierLabel[tier] ?? role

  return [
    `---`,
    `agent: ${role}`,
    `squad: ${squadName}`,
    `tier: ${tier}`,
    `level: ${level}`,
    `---`,
    ``,
    `# ${capitalize(role)} — ${label}`,
    ``,
    `<!-- LAYER 1: IDENTITY`,
    `     Who this agent is. Keep it one concise sentence. -->`,
    `## Identity`,
    ``,
    `You are the ${capitalize(role)} of the ${capitalize(squadName)} Squad.`,
    `[Describe the agent's primary role and responsibility here.]`,
    ``,
    `<!-- LAYER 2: PERSONA`,
    `     How this agent behaves — work style, communication tone, priorities. -->`,
    `## Persona`,
    ``,
    `[Describe the agent's personality and working style. 2-4 sentences.]`,
    ``,
    `<!-- LAYER 3: VOICE DNA`,
    `     Five required sections that define how the agent thinks and communicates. -->`,
    `## Voice DNA`,
    ``,
    `### Personality Anchors`,
    `<!-- Core traits — at least 3 short statements. -->`,
    `- [Trait 1 — e.g. "Precise — always cites sources"]`,
    `- [Trait 2 — e.g. "Concise — no unnecessary words"]`,
    `- [Trait 3 — e.g. "Systematic — follows a defined process"]`,
    ``,
    `### Opinion Stance`,
    `<!-- What this agent believes strongly. At least 1 statement. -->`,
    `- [e.g. "Quality over speed — ship only when it's right"]`,
    ``,
    `### Anti-Patterns`,
    `<!-- Min 5 pairs of ✘ prohibited → ✔ required behaviors. -->`,
    `- ✘ Never skip validation steps`,
    `- ✔ Always verify before marking done`,
    `- ✘ Never assume — ask if unclear`,
    `- ✔ Always clarify ambiguous requirements`,
    `- ✘ Never ignore edge cases`,
    `- ✔ Always consider failure paths`,
    `- ✘ Never [prohibited behavior 4]`,
    `- ✔ Always [required behavior 4]`,
    `- ✘ Never [prohibited behavior 5]`,
    `- ✔ Always [required behavior 5]`,
    ``,
    `### Never-Do Rules`,
    `<!-- Hard prohibitions — no exceptions. -->`,
    `- Never ship output that hasn't been reviewed`,
    `- Never [add domain-specific prohibition here]`,
    ``,
    `### Inspirational Anchors`,
    `<!-- Books, principles, or frameworks that shape this agent. -->`,
    `- Inspired by: [e.g. "The Checklist Manifesto — Atul Gawande"]`,
    ``,
    `<!-- LAYER 4: HEURISTICS`,
    `     IF/THEN rules. Include veto conditions where applicable. -->`,
    `## Heuristics`,
    ``,
    `<!-- Heuristic format: "When [situation], do [action]" or "If [condition] VETO: [blocker]" -->`,
    `1. When [situation], [action]`,
    `2. If [input is ambiguous], ask for clarification before proceeding VETO: never assume`,
    `3. When [quality criterion fails], [remediation action]`,
    ``,
    `<!-- LAYER 5: EXAMPLES`,
    `     Min 3 concrete input/output pairs. Show real-world agent behavior. -->`,
    `## Examples`,
    ``,
    `1. **[Input scenario 1]:** [description] → **[Output]:** [what the agent produces]`,
    `2. **[Input scenario 2]:** [description] → **[Output]:** [what the agent produces]`,
    `3. **[Input scenario 3]:** [description] → **[Output]:** [what the agent produces]`,
    ``,
    `<!-- LAYER 6: HANDOFFS`,
    `     Incoming triggers and outgoing signals. Use ← for incoming, → for outgoing. -->`,
    `## Handoffs`,
    ``,
    `- ← [Agent]: when [trigger condition]`,
    `- → [Agent]: when [completion condition]`,
  ].join('\n') + '\n'
}

/** Capitalizes first letter of a string */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Generates a benchmark placeholder */
function buildBenchmarkReadme(squadName: string): string {
  return [
    `# ${capitalize(squadName)} Squad — Benchmarks`,
    ``,
    `Place benchmark test cases here to evaluate agent output quality.`,
    ``,
    `## Format`,
    ``,
    `Each benchmark file should contain:`,
    `- Input prompt or scenario`,
    `- Expected output characteristics`,
    `- Evaluation criteria (pass/fail conditions)`,
    ``,
    `## Running Benchmarks`,
    ``,
    `Run \`npx buildpact squad benchmark ${squadName}\` (v2.0) to evaluate agent quality.`,
  ].join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScaffoldResult {
  squadDir: string
  filesCreated: string[]
}

export interface ValidationResult {
  errors: string[]
}

/**
 * Scaffold a new Squad directory with 4-tier hierarchy and all 6 layers.
 * Creates at `targetDir/<name>/`.
 */
export async function scaffoldSquad(name: string, targetDir: string): Promise<Result<ScaffoldResult>> {
  const squadDir = join(targetDir, name)
  const files: string[] = []

  try {
    // Root structure
    await mkdir(join(squadDir, 'agents'), { recursive: true })
    await mkdir(join(squadDir, 'hooks'), { recursive: true })
    await mkdir(join(squadDir, 'benchmark'), { recursive: true })

    // squad.yaml
    const yamlPath = join(squadDir, 'squad.yaml')
    await writeFile(yamlPath, buildSquadYaml(name), 'utf-8')
    files.push(yamlPath)

    // README.md
    const readmePath = join(squadDir, 'README.md')
    await writeFile(readmePath, buildReadme(name), 'utf-8')
    files.push(readmePath)

    // 4 tier agents
    const agents: Array<{ role: string; tier: 'T1' | 'T2' | 'T3' | 'T4'; level: 'L1' | 'L2' }> = [
      { role: 'chief', tier: 'T1', level: 'L2' },
      { role: 'specialist', tier: 'T2', level: 'L2' },
      { role: 'support', tier: 'T3', level: 'L1' },
      { role: 'reviewer', tier: 'T4', level: 'L2' },
    ]

    for (const agent of agents) {
      const agentPath = join(squadDir, 'agents', `${agent.role}.md`)
      await writeFile(agentPath, buildAgentTemplate(name, agent.role, agent.tier, agent.level), 'utf-8')
      files.push(agentPath)
    }

    // benchmark README
    const benchmarkPath = join(squadDir, 'benchmark', 'README.md')
    await writeFile(benchmarkPath, buildBenchmarkReadme(name), 'utf-8')
    files.push(benchmarkPath)

    return ok({ squadDir, filesCreated: files })
  } catch (cause) {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.file.write_failed',
      params: { path: squadDir, reason: String(cause) },
      cause,
    })
  }
}

/**
 * Validate squad directory structure: required fields in squad.yaml + 6-layer agent anatomy.
 * Returns list of errors (empty = valid).
 */
export async function validateSquadStructure(squadDir: string): Promise<Result<ValidationResult>> {
  const errors: string[] = []

  // Check squad.yaml exists and has required fields
  const yamlPath = join(squadDir, 'squad.yaml')
  let yamlContent = ''
  try {
    yamlContent = await readFile(yamlPath, 'utf-8')
  } catch {
    errors.push(`Missing squad.yaml in ${basename(squadDir)}/`)
    return ok({ errors })
  }

  const requiredYamlFields = ['name:', 'version:', 'domain:', 'description:', 'initial_level:']
  for (const field of requiredYamlFields) {
    if (!yamlContent.includes(field)) {
      errors.push(`squad.yaml is missing required field: ${field.replace(':', '')}`)
    }
  }

  // Check at least one agent directory exists
  const agentsDir = join(squadDir, 'agents')
  let agentFiles: string[] = []
  try {
    const entries = await readdir(agentsDir)
    agentFiles = entries.filter(f => f.endsWith('.md'))
  } catch {
    errors.push(`Missing agents/ directory in squad`)
    return ok({ errors })
  }

  if (agentFiles.length === 0) {
    errors.push(`No agent files found in agents/ — add at least one .md agent`)
    return ok({ errors })
  }

  // Validate 6-layer anatomy for each agent
  const required6Layers = ['## Identity', '## Persona', '## Voice DNA', '## Heuristics', '## Examples', '## Handoffs']

  for (const agentFile of agentFiles) {
    const agentPath = join(agentsDir, agentFile)
    let agentContent = ''
    try {
      agentContent = await readFile(agentPath, 'utf-8')
    } catch {
      errors.push(`Could not read agent file: agents/${agentFile}`)
      continue
    }

    for (const layer of required6Layers) {
      if (!agentContent.includes(layer)) {
        const layerName = layer.replace('## ', '')
        errors.push(`agents/${agentFile}: missing layer "${layerName}"`)
      }
    }

    // Voice DNA 5-section check
    const voiceDnaSections = [
      '### Personality Anchors',
      '### Opinion Stance',
      '### Anti-Patterns',
      '### Never-Do Rules',
      '### Inspirational Anchors',
    ]
    for (const section of voiceDnaSections) {
      if (!agentContent.includes(section)) {
        const sectionName = section.replace('### ', '')
        errors.push(`agents/${agentFile}: Voice DNA missing section "${sectionName}"`)
      }
    }

    // Minimum 3 examples check
    const exampleMatches = agentContent.match(/^\d+\.\s+\*\*/gm) ?? []
    if (exampleMatches.length < 3) {
      errors.push(`agents/${agentFile}: Examples requires minimum 3 concrete input/output pairs (found ${exampleMatches.length})`)
    }
  }

  return ok({ errors })
}

/**
 * Run security checks on a community Squad.
 * Checks: no external URLs, no executable code, no path traversal, no prompt injection.
 */
export async function validateSquadSecurity(squadDir: string): Promise<Result<ValidationResult>> {
  const errors: string[] = []

  const collectMarkdownFiles = async (dir: string): Promise<string[]> => {
    const collected: string[] = []
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          const nested = await collectMarkdownFiles(fullPath)
          collected.push(...nested)
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
          collected.push(fullPath)
        }
      }
    } catch {
      // skip unreadable dirs
    }
    return collected
  }

  const files = await collectMarkdownFiles(squadDir)

  const externalUrlPattern = /https?:\/\/[^\s)>\]"']+/gi
  const executableCodePatterns = [
    /```\s*(bash|sh|shell|zsh|fish|powershell|cmd)\b/gi,
    /\beval\s*\(/gi,
    /\bexec\s*\(/gi,
    /\bspawnSync\b/gi,
    /\bexecSync\b/gi,
  ]
  const pathTraversalPattern = /\.\.[/\\]/g
  const promptInjectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
    /disregard\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
    /you\s+are\s+now\s+\w/gi,
    /forget\s+(everything|all)\s+(you|I)\s+(know|told)/gi,
    /new\s+system\s+prompt/gi,
  ]

  for (const filePath of files) {
    let content = ''
    try {
      content = await readFile(filePath, 'utf-8')
    } catch {
      continue
    }

    const relPath = filePath.replace(squadDir + '/', '')

    const urlMatches = content.match(externalUrlPattern)
    if (urlMatches) {
      for (const url of urlMatches) {
        errors.push(`${relPath}: external URL not allowed: ${url}`)
      }
    }

    for (const pattern of executableCodePatterns) {
      if (pattern.test(content)) {
        errors.push(`${relPath}: executable code detected — not permitted in community Squads`)
        break
      }
    }

    if (pathTraversalPattern.test(content)) {
      errors.push(`${relPath}: path traversal pattern detected (../)`)
    }

    for (const pattern of promptInjectionPatterns) {
      if (pattern.test(content)) {
        errors.push(`${relPath}: potential prompt injection pattern detected`)
        break
      }
    }
  }

  return ok({ errors })
}

/**
 * Install a Squad from sourceDir into `projectDir/.buildpact/squads/<name>`.
 */
export async function installSquad(sourceDir: string, projectDir: string): Promise<Result<string>> {
  const name = basename(sourceDir)
  const destDir = join(projectDir, '.buildpact', 'squads', name)

  try {
    await mkdir(join(projectDir, '.buildpact', 'squads'), { recursive: true })
    await cp(sourceDir, destDir, { recursive: true })
    return ok(destDir)
  } catch (cause) {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.file.write_failed',
      params: { path: destDir, reason: String(cause) },
      cause,
    })
  }
}
