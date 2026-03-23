import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SCRIPT = join(process.cwd(), 'action/post-pr-comment.sh')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ScriptResult {
  stdout: string
  stderr: string
  code: number
}

async function runScript(env: Record<string, string>): Promise<ScriptResult> {
  try {
    const { stdout, stderr } = await execFileAsync('bash', [SCRIPT], {
      env: { ...process.env, ...env },
    })
    return { stdout, stderr, code: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number }
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', code: e.code ?? 1 }
  }
}

// ---------------------------------------------------------------------------
// Comment body generation — tested by running the script in a non-PR context
// and verifying guard-clause output, plus unit-testing the body template logic.
// ---------------------------------------------------------------------------

describe('post-pr-comment.sh — guard clauses', () => {
  it('exits 0 and skips when event is not pull_request', async () => {
    const { code, stdout } = await runScript({
      GITHUB_EVENT_NAME: 'push',
      GITHUB_TOKEN: 'tok',
    })
    expect(code).toBe(0)
    expect(stdout).toContain('Not a pull_request event')
  })

  it('exits 0 with warning when GITHUB_TOKEN is missing', async () => {
    const { code, stdout, stderr } = await runScript({
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_TOKEN: '',
    })
    expect(code).toBe(0)
    // Warning is emitted via ::warning annotation or plain text.
    expect(stdout + stderr).toMatch(/GITHUB_TOKEN|token/i)
  })

  it('exits 0 with warning when PR number cannot be determined', async () => {
    const { code, stdout, stderr } = await runScript({
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_TOKEN: 'some-token',
      GITHUB_REF: 'refs/heads/main', // not a PR ref
    })
    expect(code).toBe(0)
    expect(stdout + stderr).toMatch(/PR number|pull request/i)
  })
})

describe('post-pr-comment.sh — comment body content', () => {
  // We verify the body template by inspecting the script source directly —
  // the script builds the COMMENT_BODY variable and we confirm it embeds the
  // hidden marker and required table fields.

  it('script source contains the hidden marker string', async () => {
    const src = await readFile(SCRIPT, 'utf8')
    expect(src).toContain('<!-- buildpact-summary -->')
  })

  it('script source contains BuildPact CI Report header', async () => {
    const src = await readFile(SCRIPT, 'utf8')
    expect(src).toContain('### BuildPact CI Report')
  })

  it('script source includes command field in table', async () => {
    const src = await readFile(SCRIPT, 'utf8')
    expect(src).toContain('Command')
    expect(src).toContain('BP_COMMAND')
  })

  it('script source includes cost field in table', async () => {
    const src = await readFile(SCRIPT, 'utf8')
    expect(src).toContain('Cost')
    expect(src).toContain('BP_COST')
  })

  it('script source includes a workflow run link', async () => {
    const src = await readFile(SCRIPT, 'utf8')
    expect(src).toContain('View workflow run')
    expect(src).toContain('GITHUB_RUN_ID')
  })
})

describe('post-pr-comment.sh — marker detection', () => {
  it('script uses find_existing_comment to search for marker before posting', async () => {
    const src = await readFile(SCRIPT, 'utf8')
    expect(src).toContain('find_existing_comment')
    expect(src).toContain('update_comment')
    expect(src).toContain('post_comment')
  })

  it('marker is defined and referenced via variable in COMMENT_BODY', async () => {
    const src = await readFile(SCRIPT, 'utf8')
    // The literal marker appears at least once (in the MARKER= assignment).
    const markerMatches = src.match(/<!-- buildpact-summary -->/g) ?? []
    expect(markerMatches.length).toBeGreaterThanOrEqual(1)
    // The variable is then interpolated into COMMENT_BODY.
    expect(src).toContain('${MARKER}')
    // And is used as the search string when looking for an existing comment.
    expect(src).toContain('"$MARKER"')
  })

  it('uses curl with Authorization header for API calls', async () => {
    const src = await readFile(SCRIPT, 'utf8')
    expect(src).toContain('curl')
    expect(src).toContain('Authorization: Bearer')
    expect(src).toContain('GITHUB_TOKEN')
  })

  it('targets the correct GitHub REST API endpoint', async () => {
    const src = await readFile(SCRIPT, 'utf8')
    expect(src).toContain('api.github.com')
    expect(src).toContain('/issues/')
    expect(src).toContain('/comments')
  })
})
