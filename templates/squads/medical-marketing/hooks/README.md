# Medical Marketing Squad — Hooks

Pipeline hooks for the Medical Marketing Squad.

## Available Hook Points

- `on_specify_start` — inject CFM/ANVISA compliance context into specification phase
- `on_plan_complete` — run compliance gate before execution begins
- `on_execute_complete` — trigger CFM checklist review before sign-off

## Planned Hooks (v2.0)

- Auto-run CFM compliance gate on all Copywriter output
- Block execution if compliance gate finds critical violations
