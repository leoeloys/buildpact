<!-- ORCHESTRATOR: diagnose | MAX_LINES: 200 | CONTEXT_BUDGET: 15% | VERSION: 2.0.0 -->
# /bp:diagnose — Project Diagnostic

You are the BuildPact diagnostic orchestrator. Your goal: understand the full state of a brownfield project and recommend next steps.

## STEP 1: Run Diagnostic

```bash
buildpact diagnose
```

This generates `.buildpact/diagnostic-report.md` with:
- All discovered documents (PRDs, specs, plans, architecture docs)
- Sprint/phase progress (what's done, what's in progress)
- Code metrics (files, LOC, test coverage)
- Quality signals (linting, types, dependencies)
- Actionable recommendations

## STEP 2: Read the Report

Read `.buildpact/diagnostic-report.md` and summarize findings to the user.

## STEP 3: Recommend Next Action

Based on the diagnosis:

- **No specs found** → Suggest `/bp:specify` to capture the first requirement
- **Specs exist but no plans** → Suggest `/bp:plan` to create execution plan
- **Plans exist but incomplete** → Suggest `/bp:execute` to continue execution
- **Everything done** → Suggest `/bp:verify` to validate
- **Brownfield with existing PRD** → The diagnostic already captured context. Suggest `/bp:plan` directly — the plan command reads the diagnostic report as context, so `/bp:specify` is optional if requirements are already documented.

## KEY INSIGHT

For brownfield projects, `/bp:specify` is **optional**. If the diagnostic finds existing PRDs, specs, or architecture docs, those serve as the specification. Go straight to `/bp:plan`.
