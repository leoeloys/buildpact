/**
 * Persona test helpers — factory functions for creating persona-specific test projects.
 * Each persona gets a unique squad, language, and fixture data.
 * @see Story 17.2 — Persona Validation Scripts
 */
import { createTempProject, type TempProject, type TempProjectOptions } from '../helpers.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

/** Persona-specific fixture data */
export interface PersonaFixture {
  specDescription: string
  specContent: string
  squadName: string
  lang: 'en' | 'pt-br'
  experienceLevel: 'beginner' | 'intermediate' | 'expert'
}

// ---------------------------------------------------------------------------
// Persona B: Developer (Software Squad)
// ---------------------------------------------------------------------------

export const DEVELOPER_FIXTURE: PersonaFixture = {
  specDescription: 'Add user authentication with JWT tokens',
  squadName: 'software',
  lang: 'en',
  experienceLevel: 'intermediate',
  specContent: [
    '# Spec — add-jwt-auth',
    '',
    '## User Story',
    '',
    'As a registered user, I want to authenticate using JWT tokens, so that my sessions are stateless and secure.',
    '',
    '## Acceptance Criteria',
    '',
    '- User can obtain a JWT token by providing valid credentials',
    '- JWT tokens expire after 24 hours',
    '- Invalid tokens return a 401 response',
    '- Refresh tokens allow session extension without re-authentication',
    '',
    '## Non-Functional Requirements',
    '',
    '- Token validation < 10ms',
    '- Tokens use RS256 signing algorithm',
    '',
    '## Assumptions',
    '',
    '- User table exists with hashed passwords',
    '- HTTPS is enforced in production',
  ].join('\n'),
}

// ---------------------------------------------------------------------------
// Persona A: Dr. Ana (Medical Marketing Squad)
// ---------------------------------------------------------------------------

export const MEDICAL_MARKETING_FIXTURE: PersonaFixture = {
  specDescription: 'Create CFM-compliant patient brochure for dental implants',
  squadName: 'medical-marketing',
  lang: 'pt-br',
  experienceLevel: 'beginner',
  specContent: [
    '# Spec — brochure-implantes',
    '',
    '## User Story',
    '',
    'Como dentista, quero criar um folheto informativo sobre implantes dentarios para pacientes, seguindo as normas do CFM/CRO.',
    '',
    '## Acceptance Criteria',
    '',
    '- Brochure includes patient-friendly explanations of dental implant procedures',
    '- All claims are evidence-based with citations',
    '- Content complies with CFM Resolution 1974/2011 advertising rules',
    '- No before/after photos without proper consent documentation',
    '- Includes required disclaimer text for health advertising',
    '',
    '## Domain-Specific Rules',
    '',
    '- CFM compliance: no sensationalist language',
    '- CRO ethics code: accurate procedure descriptions only',
    '',
    '## Assumptions',
    '',
    '- Target audience: adult patients considering implants',
    '- Distribution: waiting room and website download',
  ].join('\n'),
}

// ---------------------------------------------------------------------------
// Persona D: Web User (Bundle Export)
// ---------------------------------------------------------------------------

export const WEB_USER_FIXTURE: PersonaFixture = {
  specDescription: 'Export project as web bundle for ChatGPT',
  squadName: 'software',
  lang: 'en',
  experienceLevel: 'beginner',
  specContent: [
    '# Spec — web-bundle-export',
    '',
    '## User Story',
    '',
    'As a non-technical user, I want to export my BuildPact project as a web bundle, so that I can paste it into ChatGPT.',
    '',
    '## Acceptance Criteria',
    '',
    '- Web bundle is generated as a single .txt file',
    '- Bundle includes squad definitions and project context',
    '- Bundle is under the platform token limit',
  ].join('\n'),
}

// ---------------------------------------------------------------------------
// Persona project factory
// ---------------------------------------------------------------------------

/**
 * Create a persona-specific project with squad and fixtures pre-configured.
 */
export async function createPersonaProject(
  fixture: PersonaFixture,
): Promise<TempProject & { fixture: PersonaFixture }> {
  const project = await createTempProject({
    squad: fixture.squadName,
    lang: fixture.lang,
    experienceLevel: fixture.experienceLevel,
  })

  return { ...project, fixture }
}

/**
 * Write a spec into a persona project.
 */
export async function writePersonaSpec(
  dir: string,
  slug: string,
  content: string,
): Promise<void> {
  const specDir = join(dir, '.buildpact', 'specs', slug)
  await mkdir(specDir, { recursive: true })
  await writeFile(join(specDir, 'spec.md'), content, 'utf-8')
}

/**
 * Write a plan into a persona project for execution.
 */
export async function writePersonaPlan(
  dir: string,
  slug: string,
  fixture: PersonaFixture,
): Promise<void> {
  const planDir = join(dir, '.buildpact', 'plans', slug)
  await mkdir(planDir, { recursive: true })

  await writeFile(
    join(planDir, 'plan.md'),
    [
      `# Plan — ${slug}`,
      '',
      '> Generated: 2026-03-22',
      '',
      '## Research Findings',
      '',
      '### Tech Stack',
      '- Inferred from spec context',
      '',
      '### Codebase Context',
      '- Result pattern, AuditLogger',
      '',
      '### Domain Constraints',
      '- Constitution enforcement',
      '',
      '## Wave Plan',
      '',
      '### Wave 1',
      '- [ ] [AGENT] Foundation setup',
      '- [ ] [AGENT] Core implementation',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(planDir, 'plan-wave-1.md'),
    [
      `# Plan — ${slug} — Wave 1`,
      '',
      '## Tasks',
      '',
      '- [ ] [AGENT] Foundation setup',
      '- [ ] [AGENT] Core implementation',
      '',
      '## Key References',
      '- `TypeScript`',
    ].join('\n'),
    'utf-8',
  )
}
