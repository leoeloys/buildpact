<!-- ORCHESTRATOR: squad | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:squad — Squad Architecture

## Squad Create

Run `npx buildpact squad create <name>` to scaffold a new Squad in the current directory.

### Generated Structure

```
<name>/
├── squad.yaml          # Manifest (name, version, domain, initial_level, agents)
├── README.md           # Structure docs + 6-layer anatomy reference
├── agents/             # 4-tier hierarchy — fill in each file
│   ├── chief.md        # T1 Chief — orchestrates the Squad workflow
│   ├── specialist.md   # T2 Specialist — core domain expert
│   ├── support.md      # T3 Support — assists specialists with sub-tasks
│   └── reviewer.md     # T4 Reviewer — validates output quality
├── hooks/              # Optional pipeline hook handlers (6 hook points)
└── benchmark/          # Quality benchmarks for agent evaluation
```

### 6-Layer Agent Anatomy

Each generated agent template includes all 6 required layers with inline documentation:

| Layer | Requirement |
|-------|-------------|
| Identity | Who the agent is — one sentence |
| Persona | Behavioral style and working approach |
| Voice DNA | 5 sections: Personality Anchors, Opinion Stance, Anti-Patterns (≥5 ✘/✔ pairs), Never-Do Rules, Inspirational Anchors |
| Heuristics | ≥3 IF/THEN rules; at least one VETO condition |
| Examples | ≥3 concrete input/output pairs |
| Handoffs | ≥1 valid `- ←` or `- →` entry |

Implementation: `scaffoldSquad()`, `validateSquadStructure()` in `src/engine/squad-scaffolder.ts`.
Types: `AgentDefinition`, `SquadManifest`, `AutomationLevel` in `src/contracts/squad.ts`.

## Squad Installation

Run `npx buildpact squad add <name>` to install a Squad from the community hub or a local path.

### Installation Flow

1. **Community warning** — user confirms they trust the source (NFR-24, FR-1103)
2. **Source detection** — no `/` or `.` prefix → registry name (download from hub); otherwise → local path
3. **Structural validation** — squad.yaml fields + 6-layer anatomy + Voice DNA 5 sections
4. **Security validation** — no external URLs, no executable code (`bash`/`eval`/`exec`), no `../` paths, no prompt injection
5. **Install** — copies to `.buildpact/squads/<name>/`

Community Squads are blocked from activation if security checks fail.

### Community Hub Registry

Registry: `github.com/buildpact/buildpact-squads`
Protocol: fetch `<name>/manifest.json` → download all listed files to temp dir → validate → install → cleanup.

Implementation: `isRegistryName()`, `downloadSquadFromHub()` in `src/engine/community-hub.ts`.
Types: `SquadManifest`, `RegistrySquad` in `src/engine/community-hub.ts`.

## 6-Layer Agent Definition

Every agent file in a Squad MUST define exactly 6 layers. Scaffolded templates include inline documentation with a concrete example for each layer.

| Layer | Section | Minimum Requirement |
|-------|---------|---------------------|
| 1 | `## Identity` | One sentence: who the agent is |
| 2 | `## Persona` | Behavioral style and working approach |
| 3 | `## Voice DNA` | 5 subsections — see `## Voice DNA Creation` |
| 4 | `## Heuristics` | ≥3 IF/THEN rules; 1 VETO condition |
| 5 | `## Examples` | ≥3 concrete input/output pairs |
| 6 | `## Handoffs` | ≥1 `- →` or `- ←` entry with trigger |

Validation errors report the agent filename and the missing/incomplete layer:

```
agent "specialist.md": missing layer "examples" (min 3 pairs, found 0)
```

Inline docs in scaffolded templates: `<!-- LAYER N: description — example -->` above each section.
Reference agent: `templates/squads/software/agents/pm.md` (complete valid example).
Implementation: `buildAgentTemplate()`, `validateSquadStructure()` in `src/engine/squad-scaffolder.ts`.

## Voice DNA Creation

Voice DNA (Layer 3) defines how an agent thinks and communicates. Every agent MUST include all 5 subsections.

**Step 1 — Analyze.** Collect 10–50 samples of the specialist's real output: emails, reports, decisions, feedback threads. Note recurring vocabulary, sentence length, opinion directness, and what the specialist refuses to do.

**Step 2 — Extract.** Distill patterns into each subsection:
| Subsection | What to extract | Min |
|-----------|----------------|-----|
| `### Personality Anchors` | 3–5 core traits as action statements | 3 |
| `### Opinion Stance` | Strong preferences — does the agent disagree? | 1 |
| `### Anti-Patterns` | ✘ (what they NEVER do) / ✔ (what they ALWAYS do) | 5 pairs |
| `### Never-Do Rules` | Hard prohibitions, no exceptions | 1 |
| `### Inspirational Anchors` | Archetypes or books that calibrate tone | 1 |

**Step 3 — Fill.** Paste into the agent file following the template structure in each scaffolded agent.

Reference example: `templates/squads/software/agents/pm.md` — complete valid Voice DNA.
Validation: `validateSquadStructure()` reports missing sections and Anti-Patterns < 5 pairs.

## Squad Validation

Run `npx buildpact squad validate <path> [--community]` to check a Squad before deploying.

### Checks Performed

| Check | What it validates |
|-------|------------------|
| Structural | squad.yaml required fields + all 6 layers for every agent |
| Voice DNA | 5 subsections present; Anti-Patterns ≥ 5 ✘/✔ pairs |
| Heuristics | ≥ 3 IF/THEN rules + at least one `VETO:` condition per agent |
| Examples | ≥ 3 concrete input/output pairs per agent |
| Handoffs | At least one `- ←` or `- →` entry per agent |
| Security¹ | No external URLs, no executable code, no `../` paths, no prompt injection |

¹ Security runs automatically on `squad add` (community source). Use `--community` flag to enforce it manually.

Output: detailed PASS/FAIL report per check with agent filename and specific violation.
Implementation: `validateSquad()` in `src/squads/validator.ts` (FR-905, FR-1103).

## Agent Autonomy Leveling

Each agent in a Squad operates at one of four autonomy levels. New agents start at L1 or L2 by default.

| Level | Name | Behavior | Default for |
|-------|------|----------|-------------|
| L1 | Observer | Requires user confirmation for ALL write operations | T3 Support |
| L2 | Contributor | Standard oversight — user confirmation for commits | T1/T2/T4 agents |
| L3 | Specialist | Reduced oversight — user confirms commits only | — (earned) |
| L4 | Autonomous | Full autonomy — explicit opt-in required | — (earned) |

Level is recorded in the agent's YAML frontmatter `level:` field and tracked in `.buildpact/agent-levels.json`.

**Promotion criteria:** ≥85% approval rate over a rolling 7-day window (minimum 5 records).
**Demotion criteria:** >30% rejection rate in a rolling 7-day window.

Run `npx buildpact squad level check` to review pending promotions and demotions.
Implementation: `defaultLevelForTier()`, `scanAgentSuggestions()` in `src/squads/leveling.ts` (FR-851).

## Lazy Agent Loading

In Prompt Mode (v1.0), context budget is managed manually. Follow these best practices when working with multi-agent Squads to stay within your IDE's context window.

**Loading Strategy:**

1. **Start with Chief only.** Paste only `agents/chief.md` into context at session start.
2. **Load the agent index.** Paste the `squad.yaml` agent list (names and files only) alongside the Chief — this is your ≤1KB navigation map.
3. **Load Specialists on-demand.** When the Chief delegates to a Specialist, paste that agent's `.md` file into context before continuing.
4. **Unload when done.** Start a fresh context or remove the Specialist definition before loading the next one if context is tight.

**Agent Mode (v2.0):** Lazy loading is automatic — only Chief + index (≤1KB) loads on Squad init; Specialists load on handoff and unload after completion (FR-906).

Implementation: `readSquadManifest()`, `buildAgentIndex()`, `loadAgentDefinition()` in `src/squads/loader.ts`.

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/squad/index.ts`
- Output files written to: `.buildpact/squads/{{squad_name}}/`
- Squad Validator runs before any Squad is loaded into context (FR-1103)
- Triggers: `on_squad_install` hook after successful installation
