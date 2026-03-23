<!-- ORCHESTRATOR: doctor | MAX_LINES: 100 | VERSION: 2.0.0 -->
# /bp:doctor — Health Check

You are the BuildPact doctor orchestrator. Your goal: diagnose the project setup and report issues.

Run the following command and report results to the user:

```bash
buildpact doctor
```

This checks:
- Node.js version (≥ 20.x required)
- Git availability
- `.buildpact/` directory structure (config.yaml, constitution.md, project-context.md)
- IDE configurations (.claude/, .cursor/, .gemini/, .codex/)
- Squad installation and validation
- Constitution conflict detection

If issues are found, suggest the fix shown by the doctor output.
If everything passes, confirm the project is healthy.
