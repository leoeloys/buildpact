import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  parseStepReference,
  loadStep,
  isStepCompleted,
  createStepFile,
} from '../../../src/engine/micro-file-architecture.js'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'bp-micro-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('parseStepReference', () => {
  it('extracts step references from template', () => {
    const refs = parseStepReference('Do {{step:1}} then {{step:2}} and {{step:10}}')
    expect(refs).toEqual(['step:1', 'step:2', 'step:10'])
  })

  it('returns empty for no references', () => {
    expect(parseStepReference('no steps here')).toEqual([])
  })

  it('returns empty for empty string', () => {
    expect(parseStepReference('')).toEqual([])
  })
})

describe('loadStep', () => {
  it('loads an existing step file', async () => {
    await createStepFile(tempDir, 3, 'Test goal', ['rule1'], 'body')
    const result = await loadStep(tempDir, 3)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('Step 3')
      expect(result.value).toContain('Test goal')
    }
  })

  it('returns error for missing step file', async () => {
    const result = await loadStep(tempDir, 99)
    expect(result.ok).toBe(false)
  })
})

describe('isStepCompleted', () => {
  it('returns true when step is in completed list', () => {
    const fm = 'completed_steps: [1, 2, 3]'
    expect(isStepCompleted(fm, 2)).toBe(true)
  })

  it('returns false when step is not in list', () => {
    const fm = 'completed_steps: [1, 3]'
    expect(isStepCompleted(fm, 2)).toBe(false)
  })

  it('returns false when no completed_steps field', () => {
    expect(isStepCompleted('title: test', 1)).toBe(false)
  })

  it('returns false for empty completed list', () => {
    expect(isStepCompleted('completed_steps: []', 1)).toBe(false)
  })
})

describe('createStepFile', () => {
  it('creates a step file with correct naming', async () => {
    const result = await createStepFile(tempDir, 5, 'My goal', ['r1', 'r2'], 'content body')
    expect(result.ok).toBe(true)

    const content = await readFile(join(tempDir, 'step-05.md'), 'utf-8')
    expect(content).toContain('step: 5')
    expect(content).toContain('goal: "My goal"')
    expect(content).toContain('- r1')
    expect(content).toContain('- r2')
    expect(content).toContain('content body')
  })

  it('zero-pads step numbers to 2 digits', async () => {
    await createStepFile(tempDir, 1, 'g', [], 'c')
    const content = await readFile(join(tempDir, 'step-01.md'), 'utf-8')
    expect(content).toContain('step: 1')
  })
})
