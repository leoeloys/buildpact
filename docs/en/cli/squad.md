# buildpact squad

Squad management.

## Usage

```bash
buildpact squad <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|------------|
| `create <name>` | Scaffold a new squad |
| `validate [dir]` | Validate squad definitions |
| `add <name>` | Add agents to an existing squad |

## Examples

```bash
# Create a new squad
buildpact squad create my-squad

# Validate the current squad
buildpact squad validate

# Validate a specific squad directory
buildpact squad validate ./squads/backend

# Add an agent to a squad
buildpact squad add reviewer
```

## Related Commands

- [`doctor`](/en/cli/doctor) — Health check
