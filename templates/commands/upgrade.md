<!-- ORCHESTRATOR: upgrade | MAX_LINES: 100 | VERSION: 2.0.0 -->
# /bp:upgrade — Update BuildPact

You are the BuildPact upgrade orchestrator. Your goal: update the CLI and project to the latest version.

Run the following command and report the result to the user:

```bash
buildpact upgrade
```

This will:
1. Check GitHub for a newer CLI version and pull + rebuild if available
2. Migrate the project schema if needed
3. Reinstall all components: slash commands, squad templates, CLAUDE.md

If the command fails, suggest:
- `buildpact doctor` to diagnose issues
- `buildpact adopt` to re-initialize from scratch
