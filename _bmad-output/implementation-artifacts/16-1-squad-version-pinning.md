# Story 16.1: Squad Version Pinning

Status: ready-for-dev

## Story

As a project lead using community squads,
I want squad versions locked in a `squad-lock.yaml` file with drift detection,
so that my team always uses the exact squad versions I approved and gets notified when updates are available.

## Acceptance Criteria

**AC-1: Lock File Generation on Squad Install**

Given I run `bp squad add scientific-research`
When the squad is installed to `.buildpact/squads/scientific-research/`
Then a `.buildpact/squad-lock.yaml` entry is created (or updated) with the squad name, version, install timestamp, and content hash

**AC-2: Version Drift Detection**

Given `.buildpact/squad-lock.yaml` records version 1.0.0 for a squad
When the community hub has version 1.1.0 available
Then `bp doctor` reports "Squad 'scientific-research' has update available: 1.0.0 → 1.1.0"

**AC-3: Squad Update Command**

Given a squad has an available update
When I run `bp squad update scientific-research`
Then the squad files are updated to the latest version
And the lock file is updated with the new version, timestamp, and hash
And a confirmation prompt is shown before overwriting (with diff summary)

**AC-4: Lock File Integrity Check**

Given a squad's files have been manually modified (hash mismatch)
When `bp doctor` runs
Then it warns "Squad 'scientific-research' has local modifications not matching lock file"

## Tasks / Subtasks

- [ ] Task 1: Implement lock file manager (AC: #1, #4)
  - [ ] 1.1: Create `src/engine/squad-lock.ts` with `SquadLockEntry` type and `readLockFile()` / `writeLockFile()` functions
  - [ ] 1.2: Implement content hash calculator for squad directory (hash all files in squad dir)
  - [ ] 1.3: Integrate lock file write into squad installation flow in `src/squads/` or community-hub install path
  - [ ] 1.4: Implement integrity checker comparing installed files hash vs lock file hash

- [ ] Task 2: Implement drift detection (AC: #2)
  - [ ] 2.1: Add version comparison function to `src/engine/squad-lock.ts`
  - [ ] 2.2: Extend community hub to expose `getLatestVersion(squadName)` query
  - [ ] 2.3: Add drift check to `src/commands/doctor/checks.ts`

- [ ] Task 3: Implement update command (AC: #3)
  - [ ] 3.1: Add `update` subcommand to `bp squad` in `src/commands/squad/handler.ts`
  - [ ] 3.2: Implement diff summary (show changed files count and version delta)
  - [ ] 3.3: Add confirmation prompt before overwriting
  - [ ] 3.4: Update lock file after successful update

- [ ] Task 4: i18n and tests (AC: all)
  - [ ] 4.1: Add EN/PT-BR strings for lock file, drift, and update messages
  - [ ] 4.2: Unit tests for lock file read/write, hash calculation, version comparison
  - [ ] 4.3: Unit test for drift detection with mocked community hub responses

## Dev Notes

### Project Structure Notes

- Lock file format: `.buildpact/squad-lock.yaml` — YAML with entries keyed by squad name
- Example lock entry: `{ name, version, installedAt, hash, source: "community" | "bundled" | "local" }`
- Hash: SHA-256 of concatenated squad file contents (sorted by path for determinism)
- Reuse community hub's `fetchManifest()` from `src/engine/community-hub.ts` to check latest version
- The `bp squad` command already exists — add `update` as a new subcommand
- `bp doctor` already has a checks system in `src/commands/doctor/checks.ts` — add squad integrity and drift checks there

### References

- `src/engine/community-hub.ts` — SquadManifest type, fetchManifest(), REGISTRY_BASE_URL
- `src/commands/squad/handler.ts` — existing squad command handler
- `src/commands/doctor/checks.ts` — doctor check registration
- `src/squads/` — squad management modules

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
### File List
