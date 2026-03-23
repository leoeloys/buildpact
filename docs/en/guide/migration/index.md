# Migration Guides

BuildPact builds on ideas from several AI development frameworks. If you're coming from BMAD, GSD, or SpecKit, these guides map your existing knowledge to BuildPact equivalents so you can get productive fast.

## Which Guide Is for You?

| Coming from | Guide | What changes |
|---|---|---|
| **BMAD** | [Migrating from BMAD](./from-bmad) | Agents become squad members with Voice DNA; workflows become pipeline phases; `_bmad-output/` becomes `.buildpact/` |
| **GSD** | [Migrating from GSD](./from-gsd) | `.planning/` becomes `.buildpact/`; phases map to pipeline; executor becomes `execute` with subagent isolation |
| **SpecKit** | [Migrating from SpecKit](./from-speckit) | `.cursorrules` becomes a constitution; templates become command templates; rules become enforceable principles |

## Framework Comparison at a Glance

| Capability | BMAD | GSD | SpecKit | BuildPact |
|---|---|---|---|---|
| Agent personas | Generic role prompts | No agents | No agents | 6-layer anatomy with Voice DNA |
| Pipeline phases | Manual workflows | Research, plan, execute | N/A | specify, plan, execute, verify |
| Parallel execution | No | Phase-level | No | Wave-based task parallelism |
| Budget control | No | No | No | Budget guards with cost projection |
| Constitution enforcement | No | No | Rule files (IDE-specific) | Versioned, IDE-agnostic, auditable |
| Multi-domain support | Software only | Software only | Software only | Software, marketing, health, research |
| Bilingual | No | No | No | English + Portuguese (BR) |
| Community hub | No | No | No | Squad sharing and discovery |

## General Migration Steps

Regardless of which framework you're coming from, the migration follows the same pattern:

### 1. Install BuildPact

```bash
npm install -g buildpact
```

### 2. Run the Adopt Command

```bash
cd your-project
buildpact adopt
```

The `adopt` command scans your project for existing framework artifacts (BMAD configs, GSD planning directories, SpecKit rules), detects your IDE setup, and generates a `.buildpact/` directory with pre-filled configuration. Your existing files are preserved -- nothing is deleted.

### 3. Review the Generated Configuration

```bash
cat .buildpact/config.yaml
cat .buildpact/constitution.md
```

Check that your language, domain, and squad preferences are correct. Edit as needed.

### 4. Run Doctor to Verify

```bash
buildpact doctor
```

This confirms your setup is complete and reports any missing pieces.

### 5. Try a Quick Task

```bash
buildpact quick "describe a small change relevant to your project"
```

If this completes successfully, your migration is done.

## Time Estimate

Each migration takes **under 30 minutes** for a typical project. The `buildpact adopt` command handles most of the work automatically -- the remaining time is spent reviewing configuration and running a test task.

## What Happens to Your Old Files?

BuildPact does not delete or modify your existing framework files. Your `_bmad-output/`, `.planning/`, or `.cursorrules` files remain untouched. You can remove them when you're confident the migration is complete.

## Need Help?

- [FAQ](/en/faq) -- common questions about BuildPact
- [CLI Reference](/en/cli/) -- all available commands
- [Architecture](/en/architecture/overview) -- how BuildPact is structured
