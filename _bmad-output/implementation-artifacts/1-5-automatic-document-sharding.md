# Story 1.5: Automatic Document Sharding

Status: done

## Story

As a developer working with large specs, plans, or PRDs,
I want documents exceeding 500 lines to be automatically split into focused atomic files with a navigation index,
So that each AI agent loads only the content it needs and stays well within context budget.

## Acceptance Criteria

**AC-1: Document Splitting at 500-Line Threshold**

Given a spec or plan document reaches 500 lines during generation
When sharding is triggered
Then the document is split into atomic section files organized by section heading
And an `index.md` is generated with navigation links to each shard
And the original file path serves as the index entry point

**AC-2: Token Savings from Shard Loading**

Given sharding has been applied to a document
When a pipeline agent loads a specific section
Then it loads only the relevant shard, not the full document
And token consumption for that agent load is at least 70% lower than the monolithic equivalent

## Tasks / Subtasks

- [x] Task 1: Create `src/foundation/sharding.ts` — types, constants, pure functions (AC: #1, #2)
  - [x] 1.1 Export `SHARD_LINE_THRESHOLD = 500` — FR-304 canonical threshold (strictly `> 500` triggers sharding)
  - [x] 1.2 Export `ShardSection` interface: `{ title: string; slug: string; content: string }` — title from `## ` heading (without `## `), slug is URL-safe, content includes the `## Title` line
  - [x] 1.3 Export `ShardManifest` interface: `{ baseName: string; preamble: string; sections: ShardSection[]; indexContent: string }` — preamble is content before first `## ` heading; indexContent is the generated index.md markdown
  - [x] 1.4 Export `countLines(content: string): number` — pure; returns `content.split('\n').length`
  - [x] 1.5 Export `shouldShard(content: string): boolean` — pure; returns `countLines(content) > SHARD_LINE_THRESHOLD`
  - [x] 1.6 Export `slugify(text: string): string` — pure; lowercase, replace non-alphanumeric with space, replace spaces with hyphens, collapse and trim hyphens: `"Epic 1: Setup"` → `"epic-1-setup"`
  - [x] 1.7 Export `splitIntoSections(content: string): ShardSection[]` — pure; splits on `\n(?=## )` regex; if no `## ` headings found, returns single section with title from first `# ` heading (or `"section-1"` fallback); each section includes its `## Title` line in content
  - [x] 1.8 Export `buildShardManifest(content: string, baseName: string): ShardManifest` — pure orchestrator; extracts preamble (content before first `## `), calls `splitIntoSections`, builds indexContent with header + sharding notice + bullet list of relative links `(./{baseName}/{slug}.md)`
  - [x] 1.9 JSDoc `@module foundation/sharding` and `@see FR-304` on module

- [x] Task 2: Create `writeShards` I/O function (AC: #1)
  - [x] 2.1 Export `writeShards(manifest: ShardManifest, outputDir: string): Promise<Result<string[]>>` — creates `outputDir/{baseName}/` directory (recursive mkdir); writes `outputDir/index.md` from `manifest.indexContent`; writes `outputDir/{baseName}/{slug}.md` for each section; returns `ok([...writtenPaths])` or `err(FILE_WRITE_FAILED)` on any I/O failure
  - [x] 2.2 Imports: `mkdir`, `writeFile` from `node:fs/promises`; `join` from `node:path`; `err, ERROR_CODES, type Result` from `../contracts/errors.js`; nothing else

- [x] Task 3: Update `src/foundation/index.ts` barrel (AC: #1, #2)
  - [x] 3.1 Re-export functions: `countLines`, `shouldShard`, `slugify`, `splitIntoSections`, `buildShardManifest`, `writeShards`, `SHARD_LINE_THRESHOLD` from `./sharding.js`
  - [x] 3.2 Re-export types: `ShardSection`, `ShardManifest` from `./sharding.js`

- [x] Task 4: Write tests (AC: #1, #2)
  - [x] 4.1 Create `test/unit/foundation/sharding.test.ts`; import directly from `../../../src/foundation/sharding.js` (not barrel)
  - [x] 4.2 `countLines` tests: `''` → 1; `'hello'` → 1; `'a\nb'` → 2; `'\n'.repeat(500)` → 501; `'\n'.repeat(499)` → 500
  - [x] 4.3 `shouldShard` tests: 500 lines (499 newlines) → `false`; 501 lines (500 newlines) → `true`; 1 line → `false`
  - [x] 4.4 `slugify` tests: `'Epic 1: Setup'` → `'epic-1-setup'`; `'Section 2 — Core'` → `'section-2-core'`; `'  Leading/Trailing  '` → `'leadingtrailing'`; already-clean → unchanged
  - [x] 4.5 `splitIntoSections` tests: content with no `## ` headings → 1 section; content with 3 `## ` headings → 3 sections; each section `content` starts with `## `; title does NOT include `## ` prefix; slug is URL-safe
  - [x] 4.6 `buildShardManifest` tests: preamble contains content before first `## `; `indexContent` contains each section title; links follow format `(./{baseName}/{slug}.md)`; `baseName` set correctly
  - [x] 4.7 `writeShards` tests (using `mkdtemp` + `afterEach` cleanup): writes `index.md` to `outputDir`; writes each shard to `outputDir/{baseName}/{slug}.md`; returns array of written paths; returns `err` with `code === 'FILE_WRITE_FAILED'` when I/O fails (simulate by passing a file path as `outputDir` subdirectory blocker)
  - [x] 4.8 AC-2 token savings test: build a 600-line document with 6 `## ` sections of ~100 lines each; call `buildShardManifest`; for each section verify `countLines(section.content) / 600 <= 0.30` (≥70% savings)
  - [x] 4.9 `src/foundation/sharding.ts` coverage ≥ 85%

## Dev Notes

### Architecture Compliance MUST-FOLLOW

1. **Layer dependency (unidirectional — strict):**
   ```
   contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
   ```
   `src/foundation/sharding.ts` may import from `../contracts/errors.js` and Node.js built-ins (`node:fs/promises`, `node:path`) ONLY. Never from `src/engine/`, `src/commands/`, etc.

2. **FR-304 threshold semantics:** "exceeding 500 lines" = strictly `> 500`. A 500-line document is NOT sharded; a 501-line document IS. `countLines('content') > SHARD_LINE_THRESHOLD` is the correct check. (Contrast with Story 1.4's `>=` decision — here the FR text is unambiguous: "exceeding".)

3. **Named exports only** — no `export default` anywhere.

4. **ESM `.js` extension mandatory:**
   ```typescript
   import { err, ERROR_CODES, type Result } from '../contracts/errors.js'
   import { mkdir, writeFile } from 'node:fs/promises'
   import { join } from 'node:path'
   ```

5. **All fallible functions return `Result<T, CliError>`** — `writeShards` is the only async/I/O function; `buildShardManifest` and all pure functions return values directly (no `Result` needed unless a future error path is added). `writeShards` uses `Promise<Result<string[]>>`.

6. **No new npm dependencies** — Node.js builtins only. No `gray-matter`, no `remark`, no external markdown libraries.

7. **No new error codes** — `ERROR_CODES.FILE_WRITE_FAILED` covers all I/O failures in `writeShards`. Do NOT add `SHARD_TOO_SMALL`, `SHARD_NO_HEADINGS`, or similar codes.

### Function Implementation Reference

#### `countLines(content: string): number`
```typescript
export function countLines(content: string): number {
  return content.split('\n').length
}
```
Edge case: empty string `''` → `[''].length` → 1 line. Single newline `'\n'` → `['', ''].length` → 2 lines.

#### `shouldShard(content: string): boolean`
```typescript
export function shouldShard(content: string): boolean {
  return countLines(content) > SHARD_LINE_THRESHOLD
}
```

#### `slugify(text: string): string`
```typescript
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
```

#### `splitIntoSections(content: string): ShardSection[]`
Splits on `\n(?=## )` (a newline followed by `## `). Filters out the preamble (content before first `## ` heading). If no `## ` headings exist, wraps entire content in a single section:
```typescript
export function splitIntoSections(content: string): ShardSection[] {
  const parts = content.split(/\n(?=## )/)
  const sectionParts = parts.filter(p => p.trimStart().startsWith('## '))

  if (sectionParts.length === 0) {
    // No ## headings — entire content is one section
    const titleMatch = content.match(/^#\s+(.+)$/m)
    const title = titleMatch?.[1]?.trim() ?? 'section-1'
    return [{ title, slug: slugify(title), content }]
  }

  return sectionParts.map(part => {
    const firstLine = part.split('\n')[0] ?? ''
    const title = firstLine.replace(/^##\s+/, '').trim()
    return { title, slug: slugify(title), content: part }
  })
}
```

#### `buildShardManifest(content: string, baseName: string): ShardManifest`
```typescript
export function buildShardManifest(content: string, baseName: string): ShardManifest {
  const parts = content.split(/\n(?=## )/)
  const preamble = parts.length > 1 && !parts[0]!.trimStart().startsWith('## ')
    ? parts[0]!
    : ''

  const sections = splitIntoSections(content)

  const titleMatch = preamble.match(/^#\s+(.+)$/m)
  const indexTitle = titleMatch?.[1]?.trim() ?? baseName

  const sectionLinks = sections
    .map(s => `- [${s.title}](./${baseName}/${s.slug}.md)`)
    .join('\n')

  const indexContent = [
    `# ${indexTitle}`,
    '',
    `> ⚡ Auto-sharded by BuildPact (FR-304) — ${sections.length} sections. Load individual shards for efficient context usage.`,
    '',
    '## Sections',
    '',
    sectionLinks,
  ].join('\n')

  return { baseName, preamble, sections, indexContent }
}
```

#### `writeShards` I/O pattern (mirrors `installer.ts`)
```typescript
export async function writeShards(
  manifest: ShardManifest,
  outputDir: string,
): Promise<Result<string[]>> {
  const shardsDir = join(outputDir, manifest.baseName)
  try {
    await mkdir(shardsDir, { recursive: true })
    const writtenPaths: string[] = []

    const indexPath = join(outputDir, 'index.md')
    await writeFile(indexPath, manifest.indexContent, 'utf-8')
    writtenPaths.push(indexPath)

    for (const section of manifest.sections) {
      const shardPath = join(shardsDir, `${section.slug}.md`)
      await writeFile(shardPath, section.content, 'utf-8')
      writtenPaths.push(shardPath)
    }
    return { ok: true, value: writtenPaths }
  } catch (cause) {
    return err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.sharding.write_failed', cause })
  }
}
```

### Index Content Format (AC-1 requirement)

For `baseName = 'epics'` with sections "Epic 1: Foundation", "Epic 2: Governance":
```markdown
# Epics

> ⚡ Auto-sharded by BuildPact (FR-304) — 2 sections. Load individual shards for efficient context usage.

## Sections

- [Epic 1: Foundation](./epics/epic-1-foundation.md)
- [Epic 2: Governance](./epics/epic-2-governance.md)
```

### File I/O Layout (AC-1 requirement: "original file path serves as index entry point")

`writeShards(manifest, outputDir)` produces:
```
{outputDir}/
├── index.md              ← caller overwrites original file path with this content
└── {baseName}/
    ├── {slug-1}.md
    ├── {slug-2}.md
    └── {slug-N}.md
```

The **caller** is responsible for copying/renaming `outputDir/index.md` to the original document's path. `writeShards` handles only the writing; the caller handles the path substitution.

### AC-2 Token Savings Test Pattern

```typescript
it('each shard is at least 70% smaller than the original document (AC-2)', () => {
  // Build a 600-line document: 6 sections of ~100 lines each
  const sections = Array.from({ length: 6 }, (_, i) => {
    const lines = [`## Section ${i + 1}`]
    for (let j = 0; j < 99; j++) lines.push(`Line ${j} of section ${i + 1} — some content here.`)
    return lines.join('\n')
  })
  const content = sections.join('\n')
  const manifest = buildShardManifest(content, 'test-doc')

  const originalLineCount = countLines(content)
  for (const section of manifest.sections) {
    const shardLineCount = countLines(section.content)
    const savings = 1 - shardLineCount / originalLineCount
    expect(savings).toBeGreaterThanOrEqual(0.70)
  }
})
```

### Test Pattern for `writeShards` — I/O Error Simulation

To simulate `FILE_WRITE_FAILED`, create a file at a path that `mkdir` will try to use as a directory:
```typescript
it('returns FILE_WRITE_FAILED when outputDir cannot be created', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-shard-'))
  const blockerFile = join(tmpDir, 'blocker')
  await writeFile(blockerFile, 'i am a file, not a dir')

  const manifest = buildShardManifest('## Section\nContent.', 'test')
  const result = await writeShards(manifest, join(blockerFile, 'subdir'))

  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error.code).toBe('FILE_WRITE_FAILED')
})
```

### `foundation/index.ts` — Barrel Extension

Add after existing `monitor.js` exports:
```typescript
export { countLines, shouldShard, slugify, splitIntoSections, buildShardManifest, writeShards, SHARD_LINE_THRESHOLD } from './sharding.js'
export type { ShardSection, ShardManifest } from './sharding.js'
```

### Vitest Coverage — No Config Changes Needed

`src/foundation/sharding.ts` is NOT a barrel/index file — no exclusion needed. `src/foundation/index.ts` is already excluded from coverage. Required coverage: **≥ 85%** for `src/foundation/sharding.ts`.

### Previous Story Intelligence (Stories 1.3 & 1.4)

**Established patterns (reuse exactly):**
- `ERROR_CODES.*` constants — NEVER string literals. Use `ERROR_CODES.FILE_WRITE_FAILED` not `'FILE_WRITE_FAILED'`
- Combined `it()` test block pattern for stub tests (do NOT split guard and assertion into separate `it()`)
- Merged import from same module: `import { err, ERROR_CODES, type Result } from '../contracts/errors.js'`
- Test imports from implementation file directly, NOT from barrel
- `async` I/O pattern mirrors `installer.ts`: `try { ... return { ok: true, value: ... } } catch (cause) { return err({ ... cause }) }`
- `mkdtemp` + `afterEach(rm(tmpDir, { recursive: true }))` for file I/O tests

**Story 1.4 code review fixes to apply from day 1:**
- Guard assertion (`expect(result.ok).toBe(false)`) MUST be in the same `it()` block as property assertions
- No duplicate import lines from the same module

**Tests that must continue passing (0 regressions):** 80 existing tests across 9 test files.

### Technical Stack

| Package / Feature | Version | Notes |
|---|---|---|
| Node.js minimum | **20.x** | `node:fs/promises`, `node:path` builtins |
| TypeScript | **5.x strict** | `NodeNext` moduleResolution; `exactOptionalPropertyTypes: true`; `noUncheckedIndexedAccess: true` |
| Vitest | **^4.1.0** | Unit testing |
| Coverage threshold | **≥ 85%** for `src/foundation/sharding.ts` | `writeShards` I/O branches may reduce line coverage — test both success and error paths |

### File Structure to Create

```
src/foundation/
└── sharding.ts          # NEW — document sharding logic (FR-304)

test/unit/foundation/
└── sharding.test.ts     # NEW — ~20 tests covering all functions + AC-2 savings

src/foundation/index.ts  # MODIFY — add sharding exports
```

No other files need to be created or modified. Do NOT create `src/contracts/sharding.ts` — all types live in `sharding.ts` itself, not in contracts.

### What Exists That sharding.ts Must Use

| Resource | Path | Notes |
|---|---|---|
| `Result<T, CliError>` type | `src/contracts/errors.ts` | Return type for `writeShards` |
| `err()` constructor | `src/contracts/errors.ts` | For `writeShards` failure path |
| `ok()` constructor | `src/contracts/errors.ts` | NOT needed — use `{ ok: true, value: ... }` directly or import |
| `ERROR_CODES.FILE_WRITE_FAILED` | `src/contracts/errors.ts` | The only error code needed |

### What Does NOT Exist Yet (Do Not Import)

- No `src/foundation/config.ts` — sharding doesn't read config this story
- No `src/foundation/context.ts` — not yet implemented
- No `src/engine/` modules — layer violation, never import from engine/
- No external markdown/YAML parsing libraries

### References

- Story requirements: [Source: _bmad-output/planning-artifacts/epics.md lines 546–565]
- FR-304 requirement: [Source: _bmad-output/planning-artifacts/epics.md line 54]
- FR-304 epic mapping: [Source: _bmad-output/planning-artifacts/epics.md line 305]
- Foundation module tree: [Source: _bmad-output/planning-artifacts/architecture.md line 943]
- FR→directory mapping: [Source: _bmad-output/planning-artifacts/architecture.md line 881]
- Layer dependency order: [Source: _bmad-output/planning-artifacts/architecture.md lines 735–736]
- ESM import rule: [Source: _bmad-output/planning-artifacts/architecture.md lines 719–728]
- Coverage thresholds: [Source: _bmad-output/planning-artifacts/architecture.md line 1066]
- 500-line constraint: [Source: _bmad-output/planning-artifacts/architecture.md line 82]
- Error handling pattern: [Source: src/contracts/errors.ts]
- I/O pattern reference: [Source: src/foundation/installer.ts]
- Test pattern reference: [Source: test/unit/foundation/audit.test.ts]
- Previous story patterns: [Source: _bmad-output/implementation-artifacts/1-4-real-time-context-and-cost-monitoring.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed slugify test: `'  Leading/Trailing  '` correctly produces `'leading-trailing'` (the `/` becomes a space → hyphen), not `'leadingtrailing'`. Test expectation corrected; implementation was right.

### Completion Notes List

- Created `src/foundation/sharding.ts` with all exports: `SHARD_LINE_THRESHOLD`, `ShardSection`, `ShardManifest`, `countLines`, `shouldShard`, `slugify`, `splitIntoSections`, `buildShardManifest`, `writeShards`. Fully satisfies AC-1 and AC-2.
- `shouldShard` uses strict `>` (not `>=`) per FR-304 "exceeding 500 lines" semantics.
- `buildShardManifest` is pure — no I/O. `writeShards` handles all disk operations with `Promise<Result<string[]>>`.
- Updated `src/foundation/index.ts` barrel with all sharding exports.
- Created `test/unit/foundation/sharding.test.ts` with 37 tests across all functions including AC-2 token savings verification.
- `sharding.ts` achieves 100% statement/function/line coverage, 91.66% branch — above 85% threshold.
- All 117 tests pass (80 existing + 37 new). Zero regressions.
- Layer dependency respected: imports only `../contracts/errors.js` and Node.js builtins.

### File List

- `src/foundation/sharding.ts` (NEW)
- `test/unit/foundation/sharding.test.ts` (NEW)
- `src/foundation/index.ts` (MODIFIED)

## Senior Developer Review

### Reviewer Model: claude-sonnet-4-6 | Date: 2026-03-15

### Findings

| Severity | Location | Issue | Resolution |
|----------|----------|-------|------------|
| MEDIUM | `sharding.ts:164` | `return { ok: true, value: writtenPaths }` used raw object literal instead of `ok()` helper — inconsistent with the established Result pattern | Fixed: changed to `return ok(writtenPaths)` |
| LOW | `sharding.ts:105-108` | `buildShardManifest` performed `content.split(/\n(?=## )/)` then immediately called `splitIntoSections(content)` which also splits — unnecessary double regex split | Fixed: replaced split with `content.indexOf('\n## ')` for O(n) preamble extraction |
| LOW | `sharding.ts:76` | `slugify` returned empty string `''` for purely special-char input (e.g. `'---'`) — downstream slug used as filename could produce `'.md'` | Fixed: added `|| 'section'` fallback |
| LOW | `sharding.ts:158-162` | No slug deduplication — if two `## ` sections produced the same slug (e.g. both titled "Alpha"), `writeShards` would silently overwrite the first shard | Fixed: added `usedSlugs` Map to append `-2`, `-3` suffixes on collision |

### Tests Added (post-review)

- `slugify('---')` → `'section'` (empty slug fallback)
- `writeShards` with duplicate-slug sections → produces `alpha.md` + `alpha-2.md` (deduplication)

### Final State

- 39 tests pass, 0 failures
- `sharding.ts`: 100% stmt / 93.75% branch / 100% func / 100% lines
- Remaining branch miss: `part.split('\n')[0] ?? ''` — null-coalescing dead branch (split always yields ≥1 element); not testable without mocking native builtins

### Verdict: APPROVED — Story 1.5 complete

## Change Log

- 2026-03-15: Story 1.5 implemented — `src/foundation/sharding.ts` created with document sharding logic for FR-304. Barrel updated. 37 new tests added, 100% stmt/func/line coverage. 117/117 tests pass.
- 2026-03-15: Code review complete — 1 MEDIUM + 3 LOW fixes applied. `ok()` helper usage normalized, double-split removed, empty-slug fallback added, slug deduplication added. 39 tests pass.
