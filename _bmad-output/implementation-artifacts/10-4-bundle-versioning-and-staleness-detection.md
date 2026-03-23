# Story 10.4: Bundle Versioning & Staleness Detection

Status: done

## Story

As a non-technical user who received a Web Bundle weeks ago,
I want the bundle to warn me if it is outdated,
so that I am not working with stale workflows or compliance rules without knowing it.

## Acceptance Criteria

**AC-1: Bundle includes generation timestamp and source file hash**

Given a Web Bundle is generated
When I inspect the bundle file
Then it includes a generation timestamp (ISO 8601) and a SHA-256 hash of the source files it was built from

**AC-2: Staleness warning when bundle is older than 7 days**

Given a Web Bundle older than 7 days is activated
When the host model loads the bundle
Then the bundle instructions cause the host model to warn the user that the bundle may be outdated and suggest requesting a fresh export from the Squad creator

## Tasks / Subtasks

- [x] Task 1: Add versioning metadata to bundle header in `src/foundation/bundle.ts` (AC: #1)
  - [x] 1.1: Export `computeBundleHash(sourceFiles: string[]): string` — concatenate all source file contents, compute SHA-256 using Node.js `crypto.createHash('sha256')`, return hex digest (first 16 chars for readability)
  - [x] 1.2: Export `BundleMetadata` type: `{ generatedAt: string; platform: string; bundleHash: string; sourceFiles: string[]; stalenessThresholdDays: number }`
  - [x] 1.3: Update `assembleBundle()` to accept `BundleMetadata` and include it in the header section:
    ```
    Generated: <ISO timestamp>
    Bundle hash: <16-char hex>
    Source files: <comma-separated list of relative paths>
    Staleness threshold: 7 days
    ```

- [x] Task 2: Add staleness detection instructions to bundle preamble in `src/squads/web-bundle.ts` (AC: #2)
  - [x] 2.1: Compute the expiry date at bundle generation time: `generatedAt + 7 days` (as ISO string)
  - [x] 2.2: Inject a staleness check instruction into the activation preamble:
    ```
    STALENESS CHECK: This bundle expires on <expiry date ISO>.
    If today's date is after <expiry date>, display this warning to the user:
    "<localized staleness warning message>"
    ```
  - [x] 2.3: The warning message must come from `locales/<lang>.yaml` key `bundle.conversational.staleness_warning` (added in story 10.3)
  - [x] 2.4: The host model evaluates the date check — BuildPact cannot evaluate it at runtime (bundle is a static file pasted by user)

- [x] Task 3: Include source file list in `generateWebBundle` (AC: #1)
  - [x] 3.1: Track all source files read during bundle assembly: active Squad agent files, constitution.md, project-context.md, squad.yaml
  - [x] 3.2: Pass the list to `computeBundleHash()` and include relative paths in `BundleMetadata.sourceFiles`
  - [x] 3.3: Relative paths must be relative to `.buildpact/` root for portability

- [x] Task 4: Write unit tests (AC: all)
  - [x] 4.1: `test/unit/foundation/bundle.test.ts` — test `computeBundleHash`: same inputs → same hash, different inputs → different hash; test that metadata appears in assembled bundle header
  - [x] 4.2: `test/unit/squads/web-bundle.test.ts` — test that `generateWebBundle` result includes metadata; test staleness instruction contains expiry date 7 days after generation date; test that staleness warning uses correct locale key
  - [x] 4.3: Run `npx vitest run` — baseline ≥ **1760 tests** (from stories 10.1–10.3); all must remain green

## Dev Notes

### Why the Host Model Handles the Date Check

The bundle is a static `.txt` file. Once exported, BuildPact has no runtime presence when a non-technical user pastes it into Claude.ai. The staleness check must be embedded as instructions to the HOST model (Claude.ai/ChatGPT) — the host model is the runtime evaluator.

Design the staleness instruction as a conditional the host model can evaluate:

```
STALENESS CHECK INSTRUCTION (for host model only — not shown to user):
This bundle was generated on <ISO date>. It expires on <ISO date + 7 days>.
If today's date is later than <expiry ISO date>:
  Display this message to the user (in <language>):
  "<localized_staleness_warning>"
  Then continue with the normal workflow.
```

### SHA-256 Hash — Node.js Built-In

Use Node.js `crypto` module (built-in, no additional dependency):

```typescript
import { createHash } from 'node:crypto';

export function computeBundleHash(sourceFiles: string[]): string {
  const content = sourceFiles.join('\n');
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
```

The hash is over the *contents* of source files (concatenated), not just filenames. This ensures the hash changes when any source file is modified.

### Bundle Header Format After This Story

The `=== BUILDPACT WEB BUNDLE ===` section (established in story 10.1) must be updated to:

```
=== BUILDPACT WEB BUNDLE ===
Platform: <platform>
Generated: <YYYY-MM-DDTHH:mm:ssZ>
Expires: <YYYY-MM-DDTHH:mm:ssZ>  (7 days from generated)
Bundle hash: <16 hex chars>
Source files: squads/<name>/agents/pm.md, squads/<name>/agents/architect.md, ...
Token estimate: ~<N>
```

### File-as-DB Pattern (NFR-08)

BuildPact stores all state in files — no external services. The bundle hash + timestamp is embedded in the bundle file itself. If the Squad creator re-generates the bundle, a new file is created (new timestamp in filename). The old file is not deleted — Squad creators manage their exports folder.

### Staleness Threshold — 7 Days

7 days is hardcoded in the bundle as `stalenessThresholdDays: 7`. This is not configurable in v1.0 (keep it simple). Story 10.4 does not add a config option — a future story can make it configurable if needed.

### Anti-Patterns to Avoid

- ❌ Do NOT try to make BuildPact itself check staleness at paste-time — this is impossible for a static file
- ❌ Do NOT compute hash over filenames only — must be over file contents for meaningful change detection
- ❌ Do NOT use an external hash library — Node.js `crypto` is sufficient and avoids new dependencies
- ❌ Do NOT format the staleness instruction in a way that might be shown to the non-technical user (prefix it clearly as "for host model only")
- ❌ Do NOT use `export default` anywhere
- ❌ Do NOT omit `.js` on ESM imports

### Project Structure Notes

- Extends `src/foundation/bundle.ts` — add `computeBundleHash()`, `BundleMetadata` type, update `assembleBundle()`
- Extends `src/squads/web-bundle.ts` — add staleness instruction generation
- Locale files already updated in story 10.3 (`bundle.conversational.staleness_warning`) — verify key exists
- Tests: extend `test/unit/foundation/bundle.test.ts` + `test/unit/squads/web-bundle.test.ts`
- No new source files needed

### References

- [Source: epics.md#Epic10-Story10.4] — Versioning requirements, 7-day staleness, source hash
- [Source: architecture.md#NFR-08] — All state in Markdown/JSON/YAML — file-as-DB pattern
- [Source: story 10-1-web-bundle-export-command.md] — Bundle header format, `assembleBundle()`, output file path
- [Source: story 10-3-conversational-interface-adaptation.md] — `bundle.conversational.staleness_warning` locale key
- [Source: architecture.md#file-structure] — `src/foundation/bundle.ts` location and responsibility

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `computeBundleHash(sourceFiles: string[]): string` to `src/foundation/bundle.ts` using Node.js built-in `crypto.createHash('sha256')`, returns 16-char hex digest
- Added `BundleMetadata` interface to `src/foundation/bundle.ts` with all required fields
- Updated `assembleBundle()` with optional `metadata?: BundleMetadata` parameter; injects Expires, Bundle hash, Source files, Staleness threshold into BUILDPACT WEB BUNDLE section
- Added `_generateStalenessInstruction()` helper to `src/squads/web-bundle.ts`; instruction clearly marked "for host model only"; loads warning from `bundle.conversational.staleness_warning` locale key
- Updated `generateWebBundle()` to track source files (constitution.md, project-context.md, squad agent files, squad.yaml) with `.buildpact/`-relative paths; computes bundleHash; creates BundleMetadata; injects staleness instruction into activation preamble
- All pre-existing TS lint errors were pre-existing (unrelated files); no new errors introduced
- 1908 tests passing (baseline was 1884; added 24 new tests covering computeBundleHash, assembleBundle with metadata, and generateWebBundle staleness/metadata)

### File List

- `src/foundation/bundle.ts` — added `computeBundleHash`, `BundleMetadata`, updated `assembleBundle`
- `src/squads/web-bundle.ts` — added `_generateStalenessInstruction`, updated `generateWebBundle`
- `test/unit/foundation/bundle.test.ts` — added tests for `computeBundleHash` and `assembleBundle` with metadata
- `test/unit/squads/web-bundle.test.ts` — added tests for bundle metadata and staleness detection

## Change Log

- 2026-03-19: Implemented Story 10.4 — Bundle Versioning & Staleness Detection. Added SHA-256 bundle hash, BundleMetadata type, assembleBundle metadata injection, staleness check instruction (host-model-only, locale-aware), source file tracking. 1908 tests passing (24 new).
