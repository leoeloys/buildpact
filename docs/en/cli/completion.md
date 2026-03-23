# buildpact completion

Generate shell completion scripts.

## Usage

```bash
buildpact completion [options]
```

## Options

| Flag | Description |
|------|------------|
| `--shell` | Target shell: `bash`, `zsh`, or `fish` |

## Examples

```bash
# Generate zsh completions
buildpact completion --shell zsh

# Add bash completions to your profile
buildpact completion --shell bash >> ~/.bashrc

# Generate fish completions
buildpact completion --shell fish
```

## Related Commands

- [`help`](/en/cli/help) — Show commands and project status
