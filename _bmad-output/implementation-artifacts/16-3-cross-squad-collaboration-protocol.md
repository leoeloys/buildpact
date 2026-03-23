# Story 16.3: Cross-Squad Collaboration Protocol

Status: ready-for-dev

## Story

As a project using multiple squads (e.g., Software + Medical Marketing),
I want a defined protocol for how agents from different squads communicate during execution,
so that cross-domain tasks can be coordinated with clear message formats, handoff rules, and shared context boundaries.

## Acceptance Criteria

**AC-1: Cross-Squad Message Contract**

Given agents from two different squads need to collaborate
When a handoff occurs between squads
Then the message follows a defined `CrossSquadMessage` interface with: source squad, source agent, target squad, target agent, payload type, payload data, and conversation context summary

**AC-2: Handoff Protocol Definition**

Given a Software Squad developer needs input from a Medical Marketing Squad compliance agent
When the cross-squad handoff is initiated
Then the orchestrator validates that both squads are installed and the target agent exists
And the handoff includes a context summary (not full conversation history) to respect context budget
And the target agent's response is routed back to the requesting agent

**AC-3: Shared Context Boundaries**

Given two squads with different constitutions or domain rules
When a cross-squad collaboration occurs
Then each agent operates under its own squad's constitution rules
And shared context is limited to: task description, relevant file paths, and explicit data passed in the message payload
And no agent can access another squad's internal memory or private heuristics

**AC-4: Protocol Validation**

Given a cross-squad collaboration is configured in a plan
When the plan is validated
Then the orchestrator checks that all referenced squads and agents exist
And warns if a handoff targets a non-existent squad or agent

## Tasks / Subtasks

- [ ] Task 1: Define cross-squad contracts (AC: #1, #3)
  - [ ] 1.1: Add `CrossSquadMessage` interface to `src/contracts/squad.ts`
  - [ ] 1.2: Add `CrossSquadHandoff` type defining source/target agent references and payload schema
  - [ ] 1.3: Define shared context boundary rules as a `SharedContextPolicy` type
  - [ ] 1.4: Document protocol constraints in JSDoc (no full history sharing, constitution isolation)

- [ ] Task 2: Implement handoff routing (AC: #2)
  - [ ] 2.1: Create `src/engine/cross-squad-router.ts` with `routeCrossSquadHandoff(message)` returning `Result<CrossSquadResponse>`
  - [ ] 2.2: Implement context summarizer that extracts task-relevant info from conversation history
  - [ ] 2.3: Implement squad/agent existence validation before handoff
  - [ ] 2.4: Integrate with orchestrator's execution flow in `src/engine/orchestrator.ts`

- [ ] Task 3: Implement protocol validation (AC: #4)
  - [ ] 3.1: Add cross-squad reference validation to plan validation step
  - [ ] 3.2: Warn on missing squad/agent references in plan's handoff graph
  - [ ] 3.3: Add doctor check for cross-squad configuration consistency

- [ ] Task 4: i18n and tests (AC: all)
  - [ ] 4.1: Add EN/PT-BR strings for cross-squad handoff messages and errors
  - [ ] 4.2: Unit tests for CrossSquadMessage validation and routing
  - [ ] 4.3: Unit tests for context boundary enforcement (no leakage of internal squad data)
  - [ ] 4.4: Integration test with two mock squads performing a handoff

## Dev Notes

### Project Structure Notes

- This is primarily a contract/interface definition story — the runtime implementation may be partially stubbed
- `CrossSquadMessage` should be added to `src/contracts/squad.ts` alongside existing squad types
- Router goes in `src/engine/cross-squad-router.ts` — follows the same pattern as `src/engine/wave-executor.ts` for agent dispatch
- Context budget is critical: cross-squad messages must include a summary, not full history — use a token-budget-aware summarizer
- Constitution isolation: each agent enforces its own squad's constitution — the cross-squad router must not merge constitutions
- The orchestrator (`src/engine/orchestrator.ts`) needs to be aware of cross-squad handoffs in the execution plan

### References

- `src/contracts/squad.ts` — existing SquadConfig, AgentDefinition types
- `src/engine/orchestrator.ts` — execution flow, subagent dispatch
- `src/engine/wave-executor.ts` — parallel execution pattern (reference for agent dispatch)
- `src/engine/community-hub.ts` — squad resolution and loading

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
### File List
