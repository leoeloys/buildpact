# buildpact init

Initialize a new project.

## Usage

```bash
buildpact init [name] [options]
```

## Options

| Flag | Description |
|------|------------|
| `--name` | Project name |
| `--lang` | Language (`en` or `pt-br`) |

## Examples

```bash
# Initialize with the interactive 6-step wizard
buildpact init

# Initialize with a project name
buildpact init my-app

# Initialize with language preset
buildpact init my-app --lang pt-br
```

The 6-step wizard guides you through: language, location, domain, IDE, experience level, and squad selection.

## Related Commands

- [`adopt`](/en/cli/adopt) — Onboard an existing project
- [`doctor`](/en/cli/doctor) — Health check
