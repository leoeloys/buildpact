# buildpact export-web

Export as web bundle for web interfaces.

## Usage

```bash
buildpact export-web [options]
```

## Options

| Flag | Description |
|------|------------|
| `--compress` | Compression level for the bundle |

## Examples

```bash
# Export a web bundle
buildpact export-web

# Export with maximum compression
buildpact export-web --compress high
```

Generates a portable bundle that can be used with web-based AI interfaces such as Claude.ai, ChatGPT, or Gemini.

## Related Commands

- [`squad`](/en/cli/squad) — Squad management
