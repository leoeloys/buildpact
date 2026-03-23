# buildpact upgrade

Migrate project schema to the latest version.

## Usage

```bash
buildpact upgrade [options]
```

## Options

| Flag | Description |
|------|------------|
| `--dry-run` | Preview changes without applying them |

## Examples

```bash
# Upgrade project schema
buildpact upgrade

# Preview what would change
buildpact upgrade --dry-run
```

Runs sequential migrations to bring your project configuration up to date.

## Related Commands

- [`doctor`](/en/cli/doctor) — Health check
