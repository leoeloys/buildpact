/**
 * Constitution command handler.
 * Implements guided TUI for creating or editing the project constitution.
 * @see FR-201 (Create), FR-202 (Enforcement via AC #3)
 */

import * as clack from '@clack/prompts'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'
import { loadConstitution, saveConstitution, constitutionExists } from '../../foundation/constitution.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read language from .buildpact/config.yaml, fallback to 'en' */
async function readLanguage(projectDir: string): Promise<SupportedLanguage> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('language:')) {
        const value = trimmed.slice('language:'.length).trim().replace(/^["']|["']$/g, '')
        if (value === 'pt-br' || value === 'en') return value
      }
    }
  } catch {
    // Config missing or unreadable — fall back to English
  }
  return 'en'
}

/** Build the constitution markdown content from collected sections */
function buildConstitutionContent(
  projectName: string,
  sections: {
    coding_standards: string
    compliance: string
    architecture: string
    quality_gates: string
    domain_rules: string
  },
  createdAt: string,
): string {
  return [
    `# Project Constitution — ${projectName}`,
    '',
    '## Immutable Principles',
    '',
    '### Coding Standards',
    sections.coding_standards,
    '',
    '### Compliance Requirements',
    sections.compliance,
    '',
    '### Architectural Constraints',
    sections.architecture,
    '',
    '### Quality Gates',
    sections.quality_gates,
    '',
    '## Domain-Specific Rules',
    sections.domain_rules,
    '',
    '## Version History',
    '| Date | Change | Reason |',
    '|------|--------|--------|',
    `| ${createdAt} | Initial creation | Project setup |`,
    '',
  ].join('\n')
}

/** Read project name from config.yaml, fallback to directory basename */
async function readProjectName(projectDir: string): Promise<string> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('project_name:')) {
        return trimmed.slice('project_name:'.length).trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // Ignore
  }
  return projectDir.split('/').pop() ?? 'Project'
}

// ---------------------------------------------------------------------------
// Section labels for edit mode
// ---------------------------------------------------------------------------

const SECTION_KEYS = [
  'coding_standards',
  'compliance',
  'architecture',
  'quality_gates',
  'domain_rules',
] as const

type SectionKey = (typeof SECTION_KEYS)[number]

/** Parse the constitution markdown into editable sections */
function parseSections(content: string): Record<SectionKey, string> {
  const sections: Record<SectionKey, string> = {
    coding_standards: '',
    compliance: '',
    architecture: '',
    quality_gates: '',
    domain_rules: '',
  }

  // Simple extraction by finding heading boundaries
  const headingMap: Record<string, SectionKey> = {
    '### Coding Standards': 'coding_standards',
    '### Compliance Requirements': 'compliance',
    '### Architectural Constraints': 'architecture',
    '### Quality Gates': 'quality_gates',
    '## Domain-Specific Rules': 'domain_rules',
  }

  const lines = content.split('\n')
  let current: SectionKey | null = null
  const accumulated: Record<SectionKey, string[]> = {
    coding_standards: [],
    compliance: [],
    architecture: [],
    quality_gates: [],
    domain_rules: [],
  }

  for (const line of lines) {
    const mapped = headingMap[line.trim()]
    if (mapped) {
      current = mapped
      continue
    }
    // Stop domain_rules at Version History
    if (current === 'domain_rules' && line.startsWith('## Version History')) {
      current = null
      continue
    }
    if (current) {
      accumulated[current].push(line)
    }
  }

  for (const key of SECTION_KEYS) {
    sections[key] = accumulated[key].join('\n').trim()
  }

  return sections
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

export const handler: CommandHandler = {
  async run(_args: string[]) {
    const projectDir = process.cwd()
    const lang = await readLanguage(projectDir)
    const i18n = createI18n(lang)
    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))
    const today = new Date().toISOString().slice(0, 10)

    const exists = await constitutionExists(projectDir)

    clack.intro(i18n.t('cli.constitution.welcome'))

    if (!exists) {
      // ---------------------------------------------------------------
      // CREATE MODE — guided TUI to collect all 5 sections
      // ---------------------------------------------------------------
      const projectName = await readProjectName(projectDir)

      const sections = await clack.group(
        {
          coding_standards: () =>
            clack.text({
              message: i18n.t('cli.constitution.section_coding'),
              placeholder: '- Use TypeScript strict mode\n- ESM modules only',
            }),
          compliance: () =>
            clack.text({
              message: i18n.t('cli.constitution.section_compliance'),
              placeholder: 'None',
            }),
          architecture: () =>
            clack.text({
              message: i18n.t('cli.constitution.section_architecture'),
              placeholder: '- Layered architecture\n- No circular dependencies',
            }),
          quality_gates: () =>
            clack.text({
              message: i18n.t('cli.constitution.section_quality'),
              placeholder: '- 80% test coverage\n- All tests must pass',
            }),
          domain_rules: () =>
            clack.text({
              message: i18n.t('cli.constitution.section_domain'),
              placeholder: 'N/A',
            }),
        },
        {
          onCancel: () => {
            clack.outro(i18n.t('cli.constitution.no_changes'))
          },
        },
      )

      if (clack.isCancel(sections)) {
        return ok(undefined)
      }

      const content = buildConstitutionContent(
        projectName,
        sections as {
          coding_standards: string
          compliance: string
          architecture: string
          quality_gates: string
          domain_rules: string
        },
        today,
      )

      const saveResult = await saveConstitution(projectDir, content)
      if (!saveResult.ok) {
        clack.log.error(i18n.t('error.file.write_failed'))
        return saveResult
      }

      await audit.log({
        action: 'constitution.create',
        agent: 'constitution',
        files: ['.buildpact/constitution.md'],
        outcome: 'success',
      })

      clack.outro(i18n.t('cli.constitution.saved'))
      return ok(undefined)
    }

    // ---------------------------------------------------------------
    // EDIT MODE — show current content, allow targeted section edits
    // ---------------------------------------------------------------
    const loadResult = await loadConstitution(projectDir)
    if (!loadResult.ok) {
      clack.log.error(i18n.t('error.file.read_failed'))
      return loadResult
    }

    const currentSections = parseSections(loadResult.value)
    let updated = false

    // Loop: allow editing multiple sections
    let continueEditing = true
    while (continueEditing) {
      const sectionChoice = await clack.select({
        message: i18n.t('cli.constitution.edit_prompt'),
        options: SECTION_KEYS.map((key) => ({
          value: key,
          label: i18n.t(`cli.constitution.section_${key === 'coding_standards' ? 'coding' : key === 'compliance' ? 'compliance' : key === 'architecture' ? 'architecture' : key === 'quality_gates' ? 'quality' : 'domain'}`),
          hint: currentSections[key] ? currentSections[key].slice(0, 60) + '…' : '(empty)',
        })),
      })

      if (clack.isCancel(sectionChoice)) {
        break
      }

      const newValue = await clack.text({
        message: i18n.t('cli.constitution.edit_prompt'),
        initialValue: currentSections[sectionChoice as SectionKey],
      })

      if (!clack.isCancel(newValue) && typeof newValue === 'string') {
        currentSections[sectionChoice as SectionKey] = newValue
        updated = true
      }

      const keepEditing = await clack.confirm({
        message: i18n.t('cli.constitution.edit_prompt'),
        initialValue: false,
      })

      if (clack.isCancel(keepEditing) || !keepEditing) {
        continueEditing = false
      }
    }

    if (updated) {
      const projectName = await readProjectName(projectDir)
      const newContent = buildConstitutionContent(projectName, currentSections, today)
      const saveResult = await saveConstitution(projectDir, newContent)
      if (!saveResult.ok) {
        clack.log.error(i18n.t('error.file.write_failed'))
        return saveResult
      }

      await audit.log({
        action: 'constitution.update',
        agent: 'constitution',
        files: ['.buildpact/constitution.md'],
        outcome: 'success',
      })

      clack.outro(i18n.t('cli.constitution.saved'))
    } else {
      clack.outro(i18n.t('cli.constitution.no_changes'))
    }

    return ok(undefined)
  },
}
