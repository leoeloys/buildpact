# BuildPact GitHub Actions Adapter

Run BuildPact commands in CI with budget enforcement, GitHub Checks annotations, and automatic pull-request summary comments.

---

## Basic Usage

```yaml
- uses: ./  # or leoeloys/buildpact@v1 once published
  with:
    command: plan
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Full Pipeline Example

A multi-job workflow that mirrors the Spec-Driven Development flow: specify, plan, execute, verify. Each job passes artifacts to the next.

```yaml
name: BuildPact Pipeline

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  specify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./
        with:
          command: specify
          budget: '0.50'
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/upload-artifact@v4
        with:
          name: spec
          path: .buildpact/specs/

  plan:
    needs: specify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: spec
          path: .buildpact/specs/
      - uses: ./
        id: plan
        with:
          command: plan
          budget: '0.50'
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/upload-artifact@v4
        with:
          name: plan
          path: .buildpact/plans/

  execute:
    needs: plan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: plan
          path: .buildpact/plans/
      - uses: ./
        with:
          command: execute
          budget: '3.00'
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/upload-artifact@v4
        with:
          name: execution-output
          path: .buildpact/

  verify:
    needs: execute
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: execution-output
          path: .buildpact/
      - uses: ./
        with:
          command: verify
          budget: '0.50'
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `command` | Yes | — | BuildPact command to run. Allowed values: `plan`, `execute`, `quick`, `verify`, `specify`, `orchestrate`, `doctor`, `status`, `quality`, `audit`, `diff`. |
| `plan` | No | `''` | Path to an existing plan file or directory to pass as an argument. |
| `budget` | No | `1.00` | Per-session budget ceiling in USD. Set to `"0"` to disable the guard. |
| `ci-mode` | No | `true` | When `"true"`, passes `--ci` to every BuildPact command for non-interactive output. |
| `node-version` | No | `22` | Node.js version used to install BuildPact. |
| `buildpact-version` | No | `latest` | npm version tag or range for BuildPact (e.g. `"0.1.0-alpha.5"`). |

## Outputs

| Output | Description |
|--------|-------------|
| `exit-code` | Exit code returned by the BuildPact command. |
| `cost` | Reported cost in USD extracted from the `[ci:cost]` output marker. |
| `summary` | One-line summary extracted from the `[ci:summary]` output marker. |

---

## Budget Configuration

The `budget` input writes or updates `.buildpact/config.yaml` with:

```yaml
budget:
  per_session_usd: 1.00
```

If the file already exists, the existing `budget` block is replaced rather than duplicated. Set `budget: "0"` to skip writing the guard entirely.

---

## Permissions Required

Add the following to your workflow to enable annotations and PR comments:

```yaml
permissions:
  contents: read
  pull-requests: write   # Required to post/update PR comments
  checks: write          # Required to emit check annotations
```

The `GITHUB_TOKEN` secret is used automatically via `${{ secrets.GITHUB_TOKEN }}` — no personal access token is required for public repositories or repositories where Actions has write access.
