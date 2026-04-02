import { describe, it, expect, beforeEach } from 'vitest'
import {
  createTddCycle,
  recordFileModification,
  recordTestRun,
  advanceTddPhase,
  isExemptFromTdd,
  isTestFile,
  detectTddAntipatterns,
} from '../../../src/engine/tdd-enforcer.js'
import type { TddCycleState } from '../../../src/contracts/task.js'

describe('createTddCycle', () => {
  it('starts in RED phase with empty state', () => {
    const cycle = createTddCycle('task-1')
    expect(cycle.taskId).toBe('task-1')
    expect(cycle.phase).toBe('RED')
    expect(cycle.testFilePath).toBeNull()
    expect(cycle.testRunResults).toEqual([])
    expect(cycle.productionFilesModified).toEqual([])
  })
})

describe('isExemptFromTdd', () => {
  it('exempts package.json', () => {
    expect(isExemptFromTdd('package.json')).toBe(true)
  })
  it('exempts tsconfig files', () => {
    expect(isExemptFromTdd('tsconfig.build.json')).toBe(true)
  })
  it('exempts .md files', () => {
    expect(isExemptFromTdd('README.md')).toBe(true)
  })
  it('does not exempt .ts source files', () => {
    expect(isExemptFromTdd('src/engine/foo.ts')).toBe(false)
  })
})

describe('isTestFile', () => {
  it('recognizes .test.ts', () => {
    expect(isTestFile('src/foo.test.ts')).toBe(true)
  })
  it('recognizes .spec.js', () => {
    expect(isTestFile('lib/bar.spec.js')).toBe(true)
  })
  it('rejects non-test files', () => {
    expect(isTestFile('src/engine/foo.ts')).toBe(false)
  })
})

describe('recordFileModification', () => {
  let cycle: TddCycleState

  beforeEach(() => {
    cycle = createTddCycle('task-1')
  })

  it('RED phase blocks production files', () => {
    const result = recordFileModification(cycle, 'src/app.ts')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TDD_PRODUCTION_BEFORE_TEST')
  })

  it('RED phase allows test files', () => {
    const result = recordFileModification(cycle, 'test/app.test.ts')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.testFilePath).toBe('test/app.test.ts')
  })

  it('GREEN phase allows production files', () => {
    const green = { ...cycle, phase: 'GREEN' as const }
    const result = recordFileModification(green, 'src/app.ts')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.productionFilesModified).toContain('src/app.ts')
  })

  it('exempt files always pass', () => {
    const result = recordFileModification(cycle, 'package.json')
    expect(result.ok).toBe(true)
  })
})

describe('recordTestRun', () => {
  it('RED phase rejects passing tests (exit 0, 0 failures)', () => {
    const cycle = createTddCycle('task-1')
    const result = recordTestRun(cycle, 0, 0)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TDD_TEST_NOT_FAILING')
  })

  it('RED phase accepts failing tests', () => {
    const cycle = createTddCycle('task-1')
    const result = recordTestRun(cycle, 1, 2)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.testRunResults).toHaveLength(1)
  })
})

describe('advanceTddPhase', () => {
  it('RED → GREEN after test failure recorded', () => {
    let cycle = createTddCycle('task-1')
    const run = recordTestRun(cycle, 1, 1)
    expect(run.ok).toBe(true)
    if (!run.ok) return
    const advance = advanceTddPhase(run.value)
    expect(advance.ok).toBe(true)
    if (advance.ok) expect(advance.value.phase).toBe('GREEN')
  })

  it('RED → GREEN blocked without failing test', () => {
    const cycle = createTddCycle('task-1')
    const result = advanceTddPhase(cycle)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TDD_PHASE_VIOLATION')
  })

  it('GREEN → REFACTOR after test passes', () => {
    const cycle: TddCycleState = {
      ...createTddCycle('task-1'),
      phase: 'GREEN',
      testRunResults: [{ phase: 'GREEN', exitCode: 0, failureCount: 0, timestamp: '' }],
    }
    const result = advanceTddPhase(cycle)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.phase).toBe('REFACTOR')
  })

  it('GREEN → REFACTOR blocked if test still failing', () => {
    const cycle: TddCycleState = {
      ...createTddCycle('task-1'),
      phase: 'GREEN',
      testRunResults: [{ phase: 'GREEN', exitCode: 1, failureCount: 1, timestamp: '' }],
    }
    const result = advanceTddPhase(cycle)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TDD_PHASE_VIOLATION')
  })

  it('REFACTOR → RED resets cycle', () => {
    const cycle: TddCycleState = {
      ...createTddCycle('task-1'),
      phase: 'REFACTOR',
      testFilePath: 'test/x.test.ts',
      productionFilesModified: ['src/x.ts'],
    }
    const result = advanceTddPhase(cycle)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.phase).toBe('RED')
      expect(result.value.testFilePath).toBeNull()
      expect(result.value.productionFilesModified).toEqual([])
    }
  })
})

describe('detectTddAntipatterns', () => {
  it('detects known anti-patterns', () => {
    const found = detectTddAntipatterns("I'll test after the feature is done")
    expect(found).toContain("i'll test after")
  })

  it('returns empty for clean text', () => {
    expect(detectTddAntipatterns('Writing test first as required')).toEqual([])
  })
})
