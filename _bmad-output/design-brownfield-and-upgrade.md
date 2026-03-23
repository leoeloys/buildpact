# Design: Brownfield Adoption & CLI Upgrade System

> BuildPact v0.1.0-alpha → v1.0 readiness

---

## Part 1 — Brownfield Adoption (`buildpact adopt`)

### Problema

O `buildpact init` assume projeto greenfield. Quando um dev tem um projeto existente (Node, Python, Rust, Go, etc.) e quer adotar BuildPact, o init:

- Ignora stack existente (package.json, tsconfig, CI, linters)
- Gera constitution.md genérica sem considerar convenções já estabelecidas
- Gera project-context.md vazio quando já há contexto rico no repo
- Sobrescreve `.buildpact/` se já existir (sem aviso)

### Solução: comando `adopt`

```
buildpact adopt [--dir <path>]
```

Fluxo interativo que escaneia o projeto existente e gera artefatos BuildPact pré-preenchidos.

### Fluxo Detalhado

```
┌─ buildpact adopt
│
├─ 1. Language selection (en / pt-br)
│
├─ 2. Detect existing .buildpact/
│     ├─ Se existe → perguntar: "Merge with existing?" / "Overwrite?" / "Cancel"
│     └─ Se não existe → continuar
│
├─ 3. Scan project stack (parallel, ~2s)
│     ├─ Package managers: package.json, Cargo.toml, pyproject.toml, go.mod, pom.xml
│     ├─ Languages: tsconfig.json, .python-version, rust-toolchain.toml
│     ├─ Linters/formatters: .eslintrc*, .prettierrc*, biome.json, ruff.toml
│     ├─ CI/CD: .github/workflows/, .gitlab-ci.yml, Jenkinsfile
│     ├─ Git: commit count, branch count, contributors count
│     └─ Existing AI configs: CLAUDE.md, .cursorrules, .gemini/
│
├─ 4. Infer domain from scan results
│     ├─ package.json → software
│     ├─ requirements.txt + medical keywords → health
│     └─ Fallback → ask user (same as init)
│
├─ 5. Present scan summary (read-only, não interativo)
│     │  "Detected: TypeScript + Node.js 22, ESLint flat config,
│     │   GitHub Actions CI, 847 commits, 3 contributors"
│     └─ User confirms or corrects
│
├─ 6. Generate pre-filled artifacts
│     ├─ constitution.md → populated from linter rules + CI checks
│     ├─ project-context.md → populated from package.json, README, etc.
│     ├─ config.yaml → with detected stack info
│     └─ IDE configs → only for IDEs not already configured
│
├─ 7. Show diff preview (what will be created/modified)
│     └─ User approves or edits before write
│
└─ 8. Write files + audit log
```

### Módulo: `src/foundation/scanner.ts`

```typescript
export interface ScanResult {
  /** Detected package managers and their lock files */
  packageManagers: PackageManagerInfo[]
  /** Primary language(s) detected */
  languages: string[]
  /** Linter/formatter configs found */
  linters: LinterInfo[]
  /** CI/CD systems detected */
  ci: CiInfo[]
  /** Git repository stats (null if not a git repo) */
  git: GitStats | null
  /** Existing AI IDE configs found */
  existingAiConfigs: ExistingAiConfig[]
  /** Inferred domain (software, health, etc.) */
  inferredDomain: string
  /** Raw file paths that informed each detection */
  evidence: Record<string, string[]>
}

export interface PackageManagerInfo {
  name: 'npm' | 'pnpm' | 'yarn' | 'cargo' | 'pip' | 'poetry' | 'go' | 'maven' | 'gradle'
  configFile: string
  projectName?: string
  version?: string
}

export interface LinterInfo {
  tool: string              // 'eslint' | 'prettier' | 'biome' | 'ruff' | 'clippy'
  configFile: string
  /** Key rules extracted (e.g., "strict mode", "no-any") */
  extractedRules: string[]
}

export interface CiInfo {
  platform: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'circleci'
  configFile: string
  /** Quality gates detected (test, lint, build steps) */
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

/** Scan a project directory and return detection results. */
export async function scanProject(projectDir: string): Promise<ScanResult>
```

### Módulo: `src/foundation/adopter.ts`

```typescript
export interface AdoptOptions {
  projectDir: string
  language: SupportedLanguage
  scan: ScanResult
  mergeExisting: boolean       // true = merge with .buildpact/, false = overwrite
  ides: IdeId[]
  experienceLevel: 'beginner' | 'intermediate' | 'expert'
  installSquad: boolean
}

export interface AdoptResult {
  created: string[]            // files criados
  modified: string[]           // files existentes que foram merged
  skipped: string[]            // files que já existiam e não foram tocados
}

/** Generate pre-filled constitution from scan results. */
export function generateConstitutionFromScan(scan: ScanResult, projectName: string): string

/** Generate pre-filled project-context from scan results. */
export function generateContextFromScan(scan: ScanResult, projectName: string): string

/** Execute adoption: generate and write all artifacts. */
export async function adopt(options: AdoptOptions): Promise<Result<AdoptResult>>
```

### Constitution Generation Rules

O `generateConstitutionFromScan` extrai regras concretas:

| Source | Constitution Section | Example |
|--------|---------------------|---------|
| tsconfig.json `strict: true` | Coding Standards | "TypeScript strict mode enabled — no implicit any" |
| .eslintrc `no-console` | Coding Standards | "No console.log in production code" |
| biome.json | Coding Standards | "Biome formatter enforced (indent: tabs)" |
| .github/workflows (test step) | Quality Gates | "All tests must pass (CI: GitHub Actions)" |
| .github/workflows (lint step) | Quality Gates | "Linting must pass before merge" |
| package.json `engines.node` | Architectural Constraints | "Node.js >= 22 required" |
| go.mod `go 1.22` | Architectural Constraints | "Go 1.22+ required" |

Regras extraídas são **sugestões** — o diff preview permite o user editar antes do write.

### Merge Strategy (quando `.buildpact/` já existe)

| File | Merge behavior |
|------|---------------|
| `constitution.md` | Append new detected rules como `<!-- Detected by adopt -->` comments. Preserve existing user rules. |
| `config.yaml` | Keep existing values. Only add new keys introduced by newer CLI version. |
| `project-context.md` | Keep existing content. Append detected stack info as new sections if not present. |
| `profiles/*.yaml` | Skip if exists. Only copy missing profiles. |
| `squads/` | Skip if squad already installed. |
| IDE configs | Skip if IDE already configured (detected in scan). |

### Novos ERROR_CODES

```typescript
ADOPT_SCAN_FAILED: 'ADOPT_SCAN_FAILED'
ADOPT_MERGE_CONFLICT: 'ADOPT_MERGE_CONFLICT'
```

### Novas i18n keys

```yaml
cli:
  adopt:
    welcome: "BuildPact — Adopt Existing Project"
    scanning: "Scanning project structure…"
    scan_complete: "Scan complete"
    detected_stack: "Detected: {summary}"
    existing_detected: "Existing .buildpact/ found"
    merge_prompt: "How to handle existing configuration?"
    merge_option: "Merge (keep existing, add new)"
    overwrite_option: "Overwrite (fresh start)"
    cancel_option: "Cancel"
    preview_title: "Files to be created/modified:"
    preview_create: "  + {path}"
    preview_modify: "  ~ {path}"
    preview_skip: "  - {path} (already exists)"
    confirm: "Apply changes?"
    success: "Project adopted successfully"
    created_count: "{count} file(s) created"
    modified_count: "{count} file(s) modified"
    skipped_count: "{count} file(s) skipped"
```

---

## Part 2 — CLI Upgrade System

### Problema

Quando um user atualiza o CLI (`npm update -g buildpact`):

1. Não sabe se o projeto local é compatível
2. Estrutura `.buildpact/` pode ter mudado (novos campos em config.yaml, novo formato)
3. Templates podem ter sido atualizados (constitution, profiles)
4. Squads bundled podem ter nova versão
5. Nenhum aviso se CLI antigo abrir projeto de CLI novo

### Solução: Schema Versioning + Migration Runner

#### 2.1 — Schema Version em config.yaml

**Novo campo no template:**

```yaml
# BuildPact project configuration
buildpact_schema: 1
created_by_cli: "0.1.0-alpha.5"
last_upgraded_by_cli: "0.1.0-alpha.5"

project_name: "{{project_name}}"
language: "{{language}}"
experience_level: "{{experience_level}}"
active_squad: "{{active_squad}}"
active_model_profile: "balanced"
created_at: "{{created_at}}"
```

- `buildpact_schema` — inteiro monotonicamente crescente. Incrementa APENAS quando a estrutura `.buildpact/` tem breaking change.
- `created_by_cli` — versão semver do CLI que rodou `init` ou `adopt`. Informacional.
- `last_upgraded_by_cli` — versão semver do CLI que rodou `upgrade` pela última vez.

#### 2.2 — Version Check on Every Command

**Módulo: `src/foundation/version-guard.ts`**

```typescript
/** The schema version this CLI version expects. */
export const CURRENT_SCHEMA_VERSION = 1

/** Schema version range this CLI can read (inclusive). */
export const MIN_READABLE_SCHEMA = 1
export const MAX_READABLE_SCHEMA = 1

export type VersionCheckResult =
  | { status: 'compatible' }
  | { status: 'upgrade_available'; projectSchema: number; cliSchema: number }
  | { status: 'upgrade_required'; projectSchema: number; cliSchema: number }
  | { status: 'cli_too_old'; projectSchema: number; cliSchema: number }
  | { status: 'no_schema' }  // projeto pre-schema (alpha)

/**
 * Read buildpact_schema from config.yaml and compare with CLI expectations.
 * Called at the start of every command (except init, adopt, doctor).
 */
export async function checkProjectVersion(projectDir: string): Promise<VersionCheckResult>
```

**Comportamento por status:**

| Status | UX |
|--------|-----|
| `compatible` | Silêncio — continua normalmente |
| `upgrade_available` | Warning amarelo: "Project schema v{N} can be upgraded to v{M}. Run `buildpact upgrade`." Continua normalmente. |
| `upgrade_required` | Erro vermelho: "Project schema v{N} is incompatible. Run `buildpact upgrade` to migrate." Bloqueia execução. |
| `cli_too_old` | Erro vermelho: "Project uses schema v{N} but this CLI only supports up to v{M}. Update BuildPact: `npm update -g buildpact`." Bloqueia execução. |
| `no_schema` | Warning: "Legacy project detected (no schema version). Run `buildpact upgrade` to add version tracking." Continua normalmente (backward compat). |

#### 2.3 — Migration System

**Módulo: `src/foundation/migrator.ts`**

```typescript
export interface Migration {
  /** Schema version this migration upgrades FROM */
  fromSchema: number
  /** Schema version this migration upgrades TO */
  toSchema: number
  /** Human-readable description */
  description: string
  /** The migration function — receives projectDir, returns files modified */
  up(projectDir: string): Promise<MigrationResult>
}

export interface MigrationResult {
  filesCreated: string[]
  filesModified: string[]
  filesDeleted: string[]
  warnings: string[]
}

/** Registry of all migrations, ordered by fromSchema. */
export const MIGRATIONS: Migration[] = [
  // Example: schema 0 (no schema) → schema 1
  {
    fromSchema: 0,
    toSchema: 1,
    description: 'Add schema versioning to config.yaml',
    async up(projectDir) {
      // 1. Read config.yaml
      // 2. Prepend buildpact_schema: 1, created_by_cli, last_upgraded_by_cli
      // 3. Write back
      return { filesModified: ['.buildpact/config.yaml'], filesCreated: [], filesDeleted: [], warnings: [] }
    },
  },
  // Future: schema 1 → 2 when .buildpact/ structure changes
]

/**
 * Run all necessary migrations from current schema to target.
 * Migrations are sequential: 0→1→2→3, never skip.
 * Each migration is atomic — if it fails, previous migrations are preserved.
 */
export async function runMigrations(
  projectDir: string,
  currentSchema: number,
  targetSchema: number,
): Promise<Result<MigrationSummary>>

export interface MigrationSummary {
  migrationsRun: number
  fromSchema: number
  toSchema: number
  results: MigrationResult[]
}
```

#### 2.4 — Comando `buildpact upgrade`

```
buildpact upgrade [--dry-run]
```

**Fluxo:**

```
┌─ buildpact upgrade
│
├─ 1. Read current schema from config.yaml
│     ├─ Schema found → compare with CURRENT_SCHEMA_VERSION
│     └─ No schema → treat as schema 0 (legacy)
│
├─ 2. Check if upgrade needed
│     ├─ Already current → "Project is up to date (schema v{N})"
│     └─ Upgrade needed → continue
│
├─ 3. Show migration plan (always, even without --dry-run)
│     │  "Migrations to run:"
│     │  "  v0 → v1: Add schema versioning to config.yaml"
│     │  "  v1 → v2: Add budget block to config.yaml"
│     └─ etc.
│
├─ 4. If --dry-run → stop here
│
├─ 5. Confirm with user
│     └─ "Apply {N} migration(s)?"
│
├─ 6. Run migrations sequentially
│     ├─ Each migration logged to audit
│     └─ If any migration fails → stop, report which succeeded
│
├─ 7. Update config.yaml
│     ├─ buildpact_schema: <new version>
│     └─ last_upgraded_by_cli: <current CLI version>
│
└─ 8. Summary
      "Upgraded from schema v0 to v1. 1 file(s) modified."
```

#### 2.5 — Novas i18n keys

```yaml
cli:
  upgrade:
    welcome: "BuildPact — Project Upgrade"
    reading_schema: "Reading project schema…"
    already_current: "Project is already up to date (schema v{version})"
    migrations_planned: "Migrations to run:"
    migration_entry: "  v{from} → v{to}: {description}"
    dry_run_notice: "Dry run — no changes applied"
    confirm: "Apply {count} migration(s)?"
    running: "Running migration v{from} → v{to}…"
    migration_done: "Migration v{from} → v{to} complete"
    migration_failed: "Migration v{from} → v{to} failed: {error}"
    success: "Upgraded from schema v{from} to v{to}"
    files_modified: "{count} file(s) modified"
  version_guard:
    upgrade_available: "Project schema v{project} can be upgraded to v{cli}. Run 'buildpact upgrade'."
    upgrade_required: "Project schema v{project} is incompatible with this CLI. Run 'buildpact upgrade'."
    cli_too_old: "Project uses schema v{project} but this CLI only supports up to v{cli}. Run: npm update -g buildpact"
    no_schema: "Legacy project detected. Run 'buildpact upgrade' to add version tracking."
```

#### 2.6 — Novos ERROR_CODES

```typescript
SCHEMA_INCOMPATIBLE: 'SCHEMA_INCOMPATIBLE'
CLI_TOO_OLD: 'CLI_TOO_OLD'
MIGRATION_FAILED: 'MIGRATION_FAILED'
```

---

## Part 3 — Integração entre Adopt e Upgrade

Cenários de interação:

| Cenário | Comportamento |
|---------|--------------|
| `adopt` em projeto sem `.buildpact/` | Cria tudo com schema atual + `created_by_cli` |
| `adopt` em projeto com `.buildpact/` antigo (sem schema) | Merge + roda migration 0→1 automaticamente |
| `adopt` em projeto com `.buildpact/` atual | Merge only — schema já está correto |
| `init` (greenfield) | Gera com schema atual |
| `upgrade` em projeto sem `.buildpact/` | Erro: "No BuildPact project found. Run `buildpact init` or `buildpact adopt`." |
| CLI novo, projeto com schema futuro | Bloqueia: "Update your CLI" |

---

## Part 4 — Impacto nos Arquivos Existentes

### Arquivos modificados

| File | Change |
|------|--------|
| `templates/config.yaml` | Add `buildpact_schema`, `created_by_cli`, `last_upgraded_by_cli` |
| `src/contracts/errors.ts` | Add 5 new ERROR_CODES |
| `src/commands/registry.ts` | Add `adopt` and `upgrade` to CommandId + REGISTRY |
| `src/cli/index.ts` | Add `adopt` and `upgrade` to command routing |
| `locales/en.yaml` | Add `adopt:`, `upgrade:`, `version_guard:` sections |
| `locales/pt-br.yaml` | Add `adopt:`, `upgrade:`, `version_guard:` sections |
| `src/commands/doctor/checks.ts` | Add schema version check |

### Arquivos novos

| File | Purpose |
|------|---------|
| `src/foundation/scanner.ts` | Project stack detection |
| `src/foundation/adopter.ts` | Adoption logic (generate pre-filled artifacts) |
| `src/foundation/version-guard.ts` | Schema version checking |
| `src/foundation/migrator.ts` | Migration registry and runner |
| `src/commands/adopt/index.ts` | Adopt command handler |
| `src/commands/adopt/handler.ts` | Adopt interactive flow |
| `src/commands/upgrade/index.ts` | Upgrade command handler |
| `src/commands/upgrade/handler.ts` | Upgrade interactive flow |
| `test/unit/foundation/scanner.test.ts` | Scanner unit tests |
| `test/unit/foundation/adopter.test.ts` | Adopter unit tests |
| `test/unit/foundation/version-guard.test.ts` | Version guard tests |
| `test/unit/foundation/migrator.test.ts` | Migrator tests |
| `test/unit/commands/adopt.test.ts` | Adopt command tests |
| `test/unit/commands/upgrade.test.ts` | Upgrade command tests |

---

## Part 5 — Ordem de Implementação

### Fase A: Schema Versioning (prerequisito para tudo)

1. `version-guard.ts` — leitura de schema + check
2. `migrator.ts` — registry + runner (com migration 0→1)
3. Atualizar `templates/config.yaml` — adicionar campos novos
4. Atualizar `installer.ts` — escrever schema version no init
5. `upgrade` command — handler + i18n
6. Integrar version guard no command dispatch (registry.ts ou cli/index.ts)
7. Doctor: adicionar check de schema version

### Fase B: Brownfield Adoption

1. `scanner.ts` — detecção de stack
2. `adopter.ts` — geração de artefatos pré-preenchidos
3. `adopt` command — handler + i18n
4. Integrar com version guard (adopt sempre gera schema atual)

### Fase C: Polish

1. `--dry-run` no adopt
2. Testes de integração (adopt em fixture projects)
3. Documentação (README, templates de ajuda)
