# BuildPact Community Squads

A curated collection of domain-specific Agent Squads for the [BuildPact](https://github.com/buildpact/buildpact) framework.

## Badge Legend

| Badge | Meaning |
|-------|---------|
| ![Validated](https://img.shields.io/badge/BuildPact-Validated-brightgreen) | Squad has passed automated structural + security validation |
| `reviewed: true` in manifest | A BuildPact maintainer has reviewed this Squad |

## Available Squads

### Software

| Squad | Domain | Description | Install |
|-------|--------|-------------|---------|
| [software](./software/) | Software / Tech | Full-stack software development Squad (PM, Architect, Developer, QA, Tech Writer) | `npx buildpact squad add software` |

_More domains coming soon. [Contribute a Squad](#contributing) to add yours._

## Installation

```bash
npx buildpact squad add <squad-name>
```

**Example:**

```bash
npx buildpact squad add software
```

This command downloads the Squad from this repository, validates its structure and security locally, and installs it to `.buildpact/squads/<name>/`.

> **Note:** If `reviewed` is `false` in the Squad's manifest, you will see a warning before installation proceeds. This means the Squad has not yet been reviewed by a BuildPact maintainer — install only from sources you trust.

## Manifest Schema

Each Squad directory contains a `manifest.json` file with the following schema:

```json
{
  "name": "string",
  "domain": "string",
  "description": "string",
  "version": "string",
  "reviewed": true,
  "files": ["squad.yaml", "README.md", "agents/chief.md", "..."]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Squad identifier (matches directory name) |
| `domain` | string | ✅ | Domain this Squad targets (e.g. `software`, `health`) |
| `description` | string | ✅ | One-line description of the Squad |
| `version` | string | ✅ | Semantic version (e.g. `0.1.0`) |
| `reviewed` | boolean | ✅ | `true` if reviewed by a BuildPact maintainer; `false` or absent = unreviewed |
| `files` | string[] | ✅ | Paths relative to squad directory — all files to download on install |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

In short:
1. Fork this repository
2. Create a directory for your Squad: `<your-squad-name>/`
3. Add `manifest.json`, `README.md`, `squad.yaml`, and `agents/` per the schema above
4. Open a pull request — automated CI will validate your Squad
5. Once a BuildPact maintainer reviews it, `reviewed` is set to `true`

## License

Each Squad is licensed under MIT unless otherwise noted in its directory.
