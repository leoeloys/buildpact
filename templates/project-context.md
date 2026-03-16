---
project_name: "{{project_name}}"
created_at: "{{created_at}}"
language: "{{language}}"
document_language: "en"
experience_level: "{{experience_level}}"
active_squad: "{{active_squad}}"
active_model_profile: "balanced"
workflow_phase: "pre-alpha"
---

# {{project_name}} — Project Context

> Paste this file at the start of any AI-assisted session to restore full project context.

---

## What is {{project_name}}?

<!-- Describe your project here -->

---

## Technology Stack

<!-- List your key technologies -->

---

## Key Architectural Constraints

- Orchestrators: ≤300 lines, ≤15% of active model's context window
- Subagent isolation: every heavy task dispatched via Task() with clean context
- Document sharding: any file >500 lines auto-sharded with index.md
- Atomic commits: one commit per completed task

---

## Current State

- Next action: Run `/bp:specify` to begin specification pipeline
