# FAQ

## How is BuildPact different from just using Claude Code / Cursor directly?

BuildPact adds **structure** on top of your AI tool. Instead of ad-hoc prompts, you get a repeatable pipeline with specifications, plans, and verification. The AI still does the work — BuildPact makes sure it does the *right* work and that you can prove it.

## Do I need to use all 4 phases?

No. Use what makes sense:

- **Quick changes**: `buildpact quick "fix the login bug"` (one command)
- **Medium features**: `buildpact specify` + `buildpact plan` + `buildpact execute`
- **Critical work**: Full pipeline including `buildpact verify`

## Can I use BuildPact for non-software projects?

Yes. BuildPact supports marketing, health, research, and management domains. The pipeline is the same — specify, plan, execute, verify — but the squads, rules, and vocabulary adapt to your domain.

## What if I disagree with the generated spec or plan?

Edit it. BuildPact generates markdown files that you can modify before proceeding to the next phase. The plan won't execute until you say so.

## How does bilingual support work?

You choose your language during `init` or `adopt`. All CLI prompts, error messages, and generated content respect your choice. Switch by editing `language` in `.buildpact/config.yaml`.

## Does BuildPact send data to external servers?

No. BuildPact is a local CLI tool. It generates files on your machine and delegates to whatever AI tool you're already using. BuildPact itself makes no network requests.

## What's the difference between `init` and `adopt`?

- **`init`** = new project from scratch, generic templates
- **`adopt`** = existing project, scans your stack and pre-fills configuration from what it finds

## What AI providers work with BuildPact?

BuildPact works with any AI coding tool that supports markdown-based prompts: Claude Code, Cursor, Gemini CLI, Codex, and more. The framework is provider-agnostic — it generates prompts and specs, your AI tool does the implementation.

## How do I create a custom squad?

```bash
buildpact squad create my-custom-squad
```

This scaffolds the directory structure. Fill in `squad.yaml` (metadata), `agents/chief.md` (lead agent), and `agents/*.md` (specialists). Validate with `buildpact doctor --smoke`.

## How do I contribute?

BuildPact is open source under MIT license. Clone the repo, install dependencies with `npm install`, run tests with `npm test`. See the [Contributing guide](https://github.com/leoeloys/buildpact) for details.
