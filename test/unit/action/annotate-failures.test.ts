import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SCRIPT = join(process.cwd(), 'action/annotate-failures.sh')

interface ScriptResult {
  stdout: string
  stderr: string
  code: number
  stepSummary: string
}

async function runScript(
  stdoutContent: string,
  stderrContent: string,
): Promise<ScriptResult> {
  const runnerTemp = await mkdtemp(join(tmpdir(), 'bp-annotate-test-'))
  const stdoutFile = join(runnerTemp, 'bp-stdout.txt')
  const stderrFile = join(runnerTemp, 'bp-stderr.txt')
  const summaryFile = join(runnerTemp, 'step-summary.md')

  await writeFile(stdoutFile, stdoutContent, 'utf8')
  await writeFile(stderrFile, stderrContent, 'utf8')
  await writeFile(summaryFile, '', 'utf8')

  try {
    const { stdout, stderr } = await execFileAsync('bash', [SCRIPT], {
      env: {
        ...process.env,
        RUNNER_TEMP: runnerTemp,
        GITHUB_STEP_SUMMARY: summaryFile,
      },
    })
    const stepSummary = await readFile(summaryFile, 'utf8').catch(() => '')
    await rm(runnerTemp, { recursive: true, force: true })
    return { stdout, stderr, code: 0, stepSummary }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number }
    const stepSummary = await readFile(summaryFile, 'utf8').catch(() => '')
    await rm(runnerTemp, { recursive: true, force: true })
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      code: e.code ?? 1,
      stepSummary,
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('annotate-failures.sh — structured [ci:error] lines', () => {
  it('emits ::error annotation with file and line', async () => {
    const stdout = '[ci:error] file=src/foo.ts line=42 message=Type mismatch on return\n'
    const { stdout: out, code } = await runScript(stdout, '')
    expect(code).toBe(0)
    expect(out).toContain('::error file=src/foo.ts,line=42::Type mismatch on return')
  })

  it('emits ::error annotation without file/line when absent', async () => {
    const stdout = '[ci:error] message=Something went wrong\n'
    const { stdout: out, code } = await runScript(stdout, '')
    expect(code).toBe(0)
    expect(out).toContain('::error ::Something went wrong')
  })

  it('writes structured errors as markdown table in step summary', async () => {
    const stdout = '[ci:error] file=src/bar.ts line=10 message=Unexpected token\n'
    const { stepSummary, code } = await runScript(stdout, '')
    expect(code).toBe(0)
    expect(stepSummary).toContain('## BuildPact Failures')
    expect(stepSummary).toContain('| File | Line | Message |')
    expect(stepSummary).toContain('src/bar.ts')
    expect(stepSummary).toContain('10')
    expect(stepSummary).toContain('Unexpected token')
  })

  it('handles multiple structured errors', async () => {
    const stdout = [
      '[ci:error] file=src/a.ts line=1 message=Error A',
      '[ci:error] file=src/b.ts line=2 message=Error B',
    ].join('\n') + '\n'
    const { stdout: out, stepSummary, code } = await runScript(stdout, '')
    expect(code).toBe(0)
    expect(out).toContain('file=src/a.ts,line=1::Error A')
    expect(out).toContain('file=src/b.ts,line=2::Error B')
    expect(stepSummary).toContain('Error A')
    expect(stepSummary).toContain('Error B')
  })
})

describe('annotate-failures.sh — generic error lines', () => {
  it('emits ::error for lines containing "error" in stderr', async () => {
    const stderr = 'BuildPact error: subagent crashed unexpectedly\n'
    const { stdout: out, code } = await runScript('', stderr)
    expect(code).toBe(0)
    expect(out).toContain('::error ::')
    expect(out).toContain('subagent crashed unexpectedly')
  })

  it('includes generic errors in step summary', async () => {
    const stderr = 'Unhandled error in wave executor\n'
    const { stepSummary } = await runScript('', stderr)
    expect(stepSummary).toContain('error')
  })
})

describe('annotate-failures.sh — empty output', () => {
  it('writes success message to step summary when no errors', async () => {
    const { stepSummary, code } = await runScript(
      'Task 1 complete\nTask 2 complete\n',
      '',
    )
    expect(code).toBe(0)
    expect(stepSummary).toContain('All tasks completed successfully')
  })

  it('exits 0 when both stdout and stderr are empty', async () => {
    const { code } = await runScript('', '')
    expect(code).toBe(0)
  })
})
