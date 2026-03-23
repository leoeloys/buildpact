import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Minimal YAML parser for action.yml validation.
// We avoid pulling in a full YAML library — the action file is structured
// enough that we can extract top-level keys and leaf values with simple regex.
// ---------------------------------------------------------------------------

function parseYamlTopLevel(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)
    if (m) {
      result[m[1]] = m[2].trim()
    }
  }
  return result
}

/** Returns true when the YAML content contains a key under `inputs:` */
function hasInput(content: string, inputName: string): boolean {
  // Look for lines matching "  <inputName>:" (two-space indent, top-level under inputs).
  const re = new RegExp(`^  ${inputName}:`, 'm')
  return re.test(content)
}

/** Returns the `default:` value for a given input block. */
function getInputDefault(content: string, inputName: string): string | undefined {
  // Find the input block and extract the default value that follows.
  const blockRe = new RegExp(
    `  ${inputName}:[\\s\\S]*?(?=\\n  \\w|\\noutputs:|\\nruns:)`,
    'm',
  )
  const block = content.match(blockRe)?.[0] ?? ''
  const defaultMatch = block.match(/default:\s*'?([^'\n]*)'?/)
  return defaultMatch?.[1]?.trim()
}

/** Returns true when the YAML content contains a key under `outputs:` */
function hasOutput(content: string, outputName: string): boolean {
  return content.includes(`  ${outputName}:`)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const ACTION_YML = join(process.cwd(), 'action.yml')
let content = ''

beforeAll(async () => {
  content = await readFile(ACTION_YML, 'utf8')
})

describe('action.yml — structure', () => {
  it('has name field', () => {
    expect(content).toMatch(/^name:/m)
  })

  it('has runs.using set to composite', () => {
    expect(content).toContain('using: composite')
  })

  it('declares an inputs section', () => {
    expect(content).toContain('inputs:')
  })

  it('declares an outputs section', () => {
    expect(content).toContain('outputs:')
  })

  it('declares a runs section', () => {
    expect(content).toContain('runs:')
  })
})

describe('action.yml — required inputs', () => {
  it('has command input marked required', () => {
    expect(hasInput(content, 'command')).toBe(true)
    // Verify "required: true" appears somewhere in the command block.
    const idx = content.indexOf('  command:')
    const block = content.slice(idx, idx + 300)
    expect(block).toContain('required: true')
  })

  it('has plan input', () => {
    expect(hasInput(content, 'plan')).toBe(true)
  })

  it('has budget input with default 1.00', () => {
    expect(hasInput(content, 'budget')).toBe(true)
    expect(getInputDefault(content, 'budget')).toBe('1.00')
  })

  it('has ci-mode input with default true', () => {
    expect(hasInput(content, 'ci-mode')).toBe(true)
    expect(getInputDefault(content, 'ci-mode')).toBe('true')
  })

  it('has node-version input with default 22', () => {
    expect(hasInput(content, 'node-version')).toBe(true)
    expect(getInputDefault(content, 'node-version')).toBe('22')
  })

  it('has buildpact-version input with default latest', () => {
    expect(hasInput(content, 'buildpact-version')).toBe(true)
    expect(getInputDefault(content, 'buildpact-version')).toBe('latest')
  })
})

describe('action.yml — outputs', () => {
  it('declares exit-code output', () => {
    expect(hasOutput(content, 'exit-code')).toBe(true)
  })

  it('declares cost output', () => {
    expect(hasOutput(content, 'cost')).toBe(true)
  })

  it('declares summary output', () => {
    expect(hasOutput(content, 'summary')).toBe(true)
  })
})

describe('action.yml — steps', () => {
  it('references actions/setup-node@v4', () => {
    expect(content).toContain('actions/setup-node@v4')
  })

  it('references setup-budget.sh', () => {
    expect(content).toContain('setup-budget.sh')
  })

  it('references run-command.sh', () => {
    expect(content).toContain('run-command.sh')
  })

  it('references annotate-failures.sh', () => {
    expect(content).toContain('annotate-failures.sh')
  })

  it('references post-pr-comment.sh', () => {
    expect(content).toContain('post-pr-comment.sh')
  })

  it('validates command input against known commands', () => {
    // The validate step must list the canonical allowed commands.
    expect(content).toContain('plan execute quick verify specify orchestrate doctor status quality audit diff')
  })
})
