# buildpact memory

Manage agent memory layers.

## Usage

```bash
buildpact memory <subcommand>
```

## Subcommands

| Subcommand | Description |
|------------|------------|
| `list` | List all stored memories |
| `clear` | Clear memory entries |
| `export` | Export memories to file |

## Memory Tiers

1. **Session feedback** — Short-term context from the current session
2. **Lessons and patterns** — Reusable insights learned across sessions
3. **Decisions log** — Architectural and design decisions with rationale

## Examples

```bash
# List all memories
buildpact memory list

# Clear session memories
buildpact memory clear

# Export memories
buildpact memory export
```

## Related Commands

- [`verify`](/en/cli/verify) — Guided acceptance testing
