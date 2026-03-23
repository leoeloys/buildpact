# buildpact audit

Export and inspect audit trails.

## Usage

```bash
buildpact audit [options]
```

## Options

| Flag | Description |
|------|------------|
| `--format` | Output format: `json` or `csv` |
| `--from` | Start date for the range filter |
| `--to` | End date for the range filter |

## Examples

```bash
# Export the full audit trail
buildpact audit

# Export as CSV
buildpact audit --format csv

# Export a date range as JSON
buildpact audit --format json --from 2026-01-01 --to 2026-03-01
```

## Related Commands

- [`quality`](/en/cli/quality) — ISO 9001-inspired quality report
