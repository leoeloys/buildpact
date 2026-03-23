import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  findLatestPlan,
  loadWaveFiles,
  buildWaveTaskGroups,
  formatExecutionSummary,
} from '../../../src/commands/execute/handler.js'
import type { WaveExecutionResult } from '../../../src/engine/wave-executor.js'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
  log: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn(), step: vi.fn() },
  isCancel: vi.fn(() => false),
  confirm: vi.fn(async () => true),
  select: vi.fn(async () => 'proceed'),
  text: vi.fn(async () => 'value'),
}))

// ---------------------------------------------------------------------------
// findLatestPlan
// ---------------------------------------------------------------------------

describe('findLatestPlan', () => {
  it('returns undefined when plans dir does not exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bp-exec-test-'))
    const result = await findLatestPlan(dir)
    expect(result).toBeUndefined()
  })

  it('returns undefined when plans dir is empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bp-exec-test-'))
    await mkdir(join(dir, '.buildpact', 'plans'), { recursive: true })
    const result = await findLatestPlan(dir)
    expect(result).toBeUndefined()
  })

  it('returns last alphabetical slug when plans exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bp-exec-test-'))
    await mkdir(join(dir, '.buildpact', 'plans', 'alpha-feature'), { recursive: true })
    await mkdir(join(dir, '.buildpact', 'plans', 'beta-feature'), { recursive: true })
    const result = await findLatestPlan(dir)
    expect(result?.slug).toBe('beta-feature')
    expect(result?.planDir).toContain('beta-feature')
  })
})

// ---------------------------------------------------------------------------
// loadWaveFiles
// ---------------------------------------------------------------------------

describe('loadWaveFiles', () => {
  it('returns empty array when no wave files exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bp-exec-test-'))
    const files = await loadWaveFiles(dir)
    expect(files).toEqual([])
  })

  it('loads wave files sorted by filename', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bp-exec-test-'))
    await writeFile(join(dir, 'plan-wave-1.md'), '## Tasks\n- [ ] [AGENT] Task A')
    await writeFile(join(dir, 'plan-wave-2.md'), '## Tasks\n- [ ] [AGENT] Task B')
    const files = await loadWaveFiles(dir)
    expect(files).toHaveLength(2)
    expect(files[0]!.filename).toBe('plan-wave-1.md')
    expect(files[0]!.waveNumber).toBe(0)
    expect(files[1]!.filename).toBe('plan-wave-2.md')
    expect(files[1]!.waveNumber).toBe(1)
  })

  it('loads split wave files (plan-wave-1b.md)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bp-exec-test-'))
    await writeFile(join(dir, 'plan-wave-1.md'), '## Tasks\n- [ ] [AGENT] Task A')
    await writeFile(join(dir, 'plan-wave-1b.md'), '## Tasks\n- [ ] [AGENT] Task B')
    const files = await loadWaveFiles(dir)
    expect(files).toHaveLength(2)
    expect(files.every(f => f.waveNumber === 0)).toBe(true)
  })

  it('ignores plan.md and validation-report.md', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bp-exec-test-'))
    await writeFile(join(dir, 'plan.md'), '# Plan')
    await writeFile(join(dir, 'validation-report.md'), '# Validation')
    await writeFile(join(dir, 'plan-wave-1.md'), '## Tasks\n- [ ] [AGENT] Task A')
    const files = await loadWaveFiles(dir)
    expect(files).toHaveLength(1)
  })

  it('reads content of wave files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bp-exec-test-'))
    const content = '# Plan Wave 1\n\n## Tasks\n\n- [ ] [AGENT] Build feature'
    await writeFile(join(dir, 'plan-wave-1.md'), content)
    const files = await loadWaveFiles(dir)
    expect(files[0]!.content).toBe(content)
  })
})

// ---------------------------------------------------------------------------
// buildWaveTaskGroups
// ---------------------------------------------------------------------------

describe('buildWaveTaskGroups', () => {
  it('returns empty array when no wave files provided', () => {
    const groups = buildWaveTaskGroups([])
    expect(groups).toEqual([])
  })

  it('extracts tasks from wave files grouped by wave number', () => {
    const waveFiles = [
      {
        filename: 'plan-wave-1.md',
        waveNumber: 0,
        content: '## Tasks\n- [ ] [AGENT] Setup DB\n- [ ] [AGENT] Write migration',
      },
      {
        filename: 'plan-wave-2.md',
        waveNumber: 1,
        content: '## Tasks\n- [ ] [AGENT] Deploy service',
      },
    ]
    const groups = buildWaveTaskGroups(waveFiles)
    expect(groups).toHaveLength(2)
    expect(groups[0]!).toHaveLength(2)
    expect(groups[1]!).toHaveLength(1)
  })

  it('merges split wave files into same wave group', () => {
    const waveFiles = [
      { filename: 'plan-wave-1.md', waveNumber: 0, content: '## Tasks\n- [ ] [AGENT] Task A' },
      { filename: 'plan-wave-1b.md', waveNumber: 0, content: '## Tasks\n- [ ] [AGENT] Task B' },
    ]
    const groups = buildWaveTaskGroups(waveFiles)
    expect(groups).toHaveLength(1)
    expect(groups[0]!).toHaveLength(2)
  })

  it('passes constitutionPath to all tasks', () => {
    const waveFiles = [
      { filename: 'plan-wave-1.md', waveNumber: 0, content: '## Tasks\n- [ ] [AGENT] Task A' },
    ]
    const groups = buildWaveTaskGroups(waveFiles, '/path/constitution.md')
    expect(groups[0]![0]!.constitutionPath).toBe('/path/constitution.md')
  })

  it('passes phaseSlug to all tasks for atomic commit messages', () => {
    const waveFiles = [
      { filename: 'plan-wave-1.md', waveNumber: 0, content: '## Tasks\n- [ ] [AGENT] Task A\n- [ ] [AGENT] Task B' },
    ]
    const groups = buildWaveTaskGroups(waveFiles, undefined, 'auth-feature')
    expect(groups[0]![0]!.phaseSlug).toBe('auth-feature')
    expect(groups[0]![1]!.phaseSlug).toBe('auth-feature')
  })

  it('passes phaseSlug to tasks across multiple waves', () => {
    const waveFiles = [
      { filename: 'plan-wave-1.md', waveNumber: 0, content: '## Tasks\n- [ ] [AGENT] Task A' },
      { filename: 'plan-wave-2.md', waveNumber: 1, content: '## Tasks\n- [ ] [AGENT] Task B' },
    ]
    const groups = buildWaveTaskGroups(waveFiles, undefined, 'payment-epic')
    expect(groups[0]![0]!.phaseSlug).toBe('payment-epic')
    expect(groups[1]![0]!.phaseSlug).toBe('payment-epic')
  })

  it('returns empty tasks for wave file with no agent/human lines', () => {
    const waveFiles = [
      { filename: 'plan-wave-1.md', waveNumber: 0, content: '# Plan\n\n## Key References\n\n- `TypeScript`' },
    ]
    const groups = buildWaveTaskGroups(waveFiles)
    expect(groups).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// formatExecutionSummary
// ---------------------------------------------------------------------------

describe('formatExecutionSummary', () => {
  const mockI18n = {
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'cli.execute.wave_summary') {
        return `Wave ${params?.['wave']}: ${params?.['passed']}/${params?.['total']} tasks passed (${params?.['failed']} failed)`
      }
      if (key === 'cli.execute.task_failed') {
        return `  ✗ ${params?.['title']}: ${params?.['error']}`
      }
      return key
    },
  }

  it('formats a successful wave result', () => {
    const results: WaveExecutionResult[] = [
      {
        waveNumber: 0,
        allSucceeded: true,
        tasks: [
          { taskId: 't1', title: 'Task A', waveNumber: 0, success: true, artifacts: [] },
        ],
      },
    ]
    const summary = formatExecutionSummary(results, mockI18n as Parameters<typeof formatExecutionSummary>[1])
    expect(summary).toContain('Wave 1')
    expect(summary).toContain('1/1')
  })

  it('includes failed task details in summary', () => {
    const results: WaveExecutionResult[] = [
      {
        waveNumber: 0,
        allSucceeded: false,
        tasks: [
          { taskId: 't1', title: 'Broken Task', waveNumber: 0, success: false, artifacts: [], error: 'PAYLOAD_TOO_LARGE' },
        ],
      },
    ]
    const summary = formatExecutionSummary(results, mockI18n as Parameters<typeof formatExecutionSummary>[1])
    expect(summary).toContain('Broken Task')
    expect(summary).toContain('PAYLOAD_TOO_LARGE')
  })

  it('formats multiple waves', () => {
    const results: WaveExecutionResult[] = [
      { waveNumber: 0, allSucceeded: true, tasks: [{ taskId: 't1', title: 'A', waveNumber: 0, success: true, artifacts: [] }] },
      { waveNumber: 1, allSucceeded: true, tasks: [{ taskId: 't2', title: 'B', waveNumber: 1, success: true, artifacts: [] }] },
    ]
    const summary = formatExecutionSummary(results, mockI18n as Parameters<typeof formatExecutionSummary>[1])
    expect(summary).toContain('Wave 1')
    expect(summary).toContain('Wave 2')
  })
})

// ---------------------------------------------------------------------------
// handler.run() — integration tests
// ---------------------------------------------------------------------------

vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

describe('handler.run() — goal-backward verification', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-exec-integration-test-'))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('completes successfully when wave tasks pass and ACs are satisfied', async () => {
    const planSlug = 'auth-feature'
    const planDir = join(tmpDir, '.buildpact', 'plans', planSlug)
    await mkdir(planDir, { recursive: true })
    const waveContent = [
      '# Plan — auth-feature — Wave 1',
      '',
      '## Tasks',
      '',
      '- [ ] [AGENT] Implement authentication module',
    ].join('\n')
    await writeFile(join(planDir, 'plan-wave-1.md'), waveContent)

    const specDir = join(tmpDir, '.buildpact', 'specs', planSlug)
    await mkdir(specDir, { recursive: true })
    const specContent = [
      '# Spec — auth-feature',
      '',
      '## Acceptance Criteria',
      '',
      '- Authentication module works correctly',
    ].join('\n')
    await writeFile(join(specDir, 'spec.md'), specContent)

    const { handler } = await import('../../../src/commands/execute/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
  })

  it('writes verification report file after successful wave', async () => {
    const planSlug = 'verify-feature'
    const planDir = join(tmpDir, '.buildpact', 'plans', planSlug)
    await mkdir(planDir, { recursive: true })
    const waveContent = [
      '# Plan — verify-feature — Wave 1',
      '',
      '## Tasks',
      '',
      '- [ ] [AGENT] Implement authentication service module',
    ].join('\n')
    await writeFile(join(planDir, 'plan-wave-1.md'), waveContent)

    const specDir = join(tmpDir, '.buildpact', 'specs', planSlug)
    await mkdir(specDir, { recursive: true })
    await writeFile(
      join(specDir, 'spec.md'),
      '# Spec\n\n## Acceptance Criteria\n\n- Authentication service module works correctly\n',
    )

    const { handler } = await import('../../../src/commands/execute/handler.js')
    await handler.run([])

    // Verification report should be written
    const reportPath = join(planDir, 'verification-wave-1.md')
    const reportContent = await readFile(reportPath, 'utf-8')
    expect(reportContent).toContain('Wave 1 Goal-Backward Verification')
  })

  it('writes fix plan when wave ACs fail due to task failure', async () => {
    const planSlug = 'fix-plan-feature'
    const planDir = join(tmpDir, '.buildpact', 'plans', planSlug)
    await mkdir(planDir, { recursive: true })

    // Create a wave file that will fail (oversized payload causes task failure)
    const hugeContent = 'x'.repeat(25 * 1024)
    const waveContent = [
      '# Plan — fix-plan-feature — Wave 1',
      '',
      '## Tasks',
      '',
      `- [ ] [AGENT] Implement authentication module`,
      '',
      `<!-- ${hugeContent} -->`,
    ].join('\n')
    await writeFile(join(planDir, 'plan-wave-1.md'), waveContent)

    const specDir = join(tmpDir, '.buildpact', 'specs', planSlug)
    await mkdir(specDir, { recursive: true })
    await writeFile(
      join(specDir, 'spec.md'),
      '# Spec\n\n## Acceptance Criteria\n\n- Authentication module must be implemented correctly\n',
    )

    const { handler } = await import('../../../src/commands/execute/handler.js')
    await handler.run([])

    // Fix plan should be written under planDir/fix/
    const fixPlanPath = join(planDir, 'fix', 'plan-wave-1.md')
    const fixContent = await readFile(fixPlanPath, 'utf-8')
    expect(fixContent).toContain('# Fix Plan')
    expect(fixContent).toContain('[AGENT] Fix:')
  })

  it('returns ok without verification when no spec exists', async () => {
    const planSlug = 'no-spec-feature'
    const planDir = join(tmpDir, '.buildpact', 'plans', planSlug)
    await mkdir(planDir, { recursive: true })
    await writeFile(
      join(planDir, 'plan-wave-1.md'),
      '## Tasks\n\n- [ ] [AGENT] Implement something',
    )

    // No spec file — should still execute but skip verification

    const { handler } = await import('../../../src/commands/execute/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
  })
})
