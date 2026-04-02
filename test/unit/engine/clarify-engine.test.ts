import { describe, it, expect, beforeEach } from 'vitest'
import {
  createClarificationSession,
  addMarker,
  resolveMarker,
  completeRound,
  getUnresolvedCount,
  getUnresolvedMarkers,
  canProceedToPlan,
  formatMarkersForSpec,
  formatClarificationReport,
  resetMarkerCounter,
  DEFAULT_MAX_UNRESOLVED,
} from '../../../src/engine/clarify-engine.js'

describe('createClarificationSession', () => {
  it('creates session with defaults', () => {
    const s = createClarificationSession('SPEC-001')
    expect(s.specId).toBe('SPEC-001')
    expect(s.markers).toEqual([])
    expect(s.maxUnresolvedAfterClarify).toBe(DEFAULT_MAX_UNRESOLVED)
    expect(s.roundsCompleted).toBe(0)
  })

  it('accepts custom max unresolved', () => {
    const s = createClarificationSession('SPEC-001', 5)
    expect(s.maxUnresolvedAfterClarify).toBe(5)
  })
})

describe('addMarker', () => {
  beforeEach(() => resetMarkerCounter())

  it('adds marker with auto-generated ID', () => {
    const s = createClarificationSession('SPEC-001')
    const result = addMarker(s, 'SCOPE', '§1.0', 'What is in/out of scope?')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.markers).toHaveLength(1)
      expect(result.value.markers[0]!.id).toMatch(/^CLR-/)
      expect(result.value.markers[0]!.category).toBe('SCOPE')
      expect(result.value.markers[0]!.status).toBe('open')
    }
  })

  it('increments IDs', () => {
    let s = createClarificationSession('SPEC-001')
    s = (addMarker(s, 'SCOPE', '§1', 'Q1') as any).value
    const result = addMarker(s, 'DATA_MODEL', '§2', 'Q2')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.markers[1]!.id).toMatch(/^CLR-/)
    }
  })

  it('rejects invalid category', () => {
    const s = createClarificationSession('SPEC-001')
    const result = addMarker(s, 'INVALID' as any, '§1', 'Q?')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CLARIFICATION_MARKER_NO_CATEGORY')
  })
})

describe('resolveMarker', () => {
  beforeEach(() => resetMarkerCounter())

  it('resolves an open marker', () => {
    let s = createClarificationSession('SPEC-001')
    s = (addMarker(s, 'SCOPE', '§1', 'What scope?') as any).value
    const markerId = s.markers[0]!.id
    const result = resolveMarker(s, markerId, 'Only user-facing features')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.markers[0]!.status).toBe('resolved')
      expect(result.value.markers[0]!.resolution).toBe('Only user-facing features')
    }
  })

  it('returns error for unknown marker', () => {
    const s = createClarificationSession('SPEC-001')
    const result = resolveMarker(s, 'CLR-999', 'answer')
    expect(result.ok).toBe(false)
  })
})

describe('getUnresolvedCount / getUnresolvedMarkers', () => {
  beforeEach(() => resetMarkerCounter())

  it('counts open markers', () => {
    let s = createClarificationSession('SPEC-001')
    s = (addMarker(s, 'SCOPE', '§1', 'Q1') as any).value
    s = (addMarker(s, 'SECURITY', '§2', 'Q2') as any).value
    s = (addMarker(s, 'UI_UX', '§3', 'Q3') as any).value
    expect(getUnresolvedCount(s)).toBe(3)
    expect(getUnresolvedMarkers(s)).toHaveLength(3)

    s = (resolveMarker(s, s.markers[0]!.id, 'resolved') as any).value
    expect(getUnresolvedCount(s)).toBe(2)
  })
})

describe('canProceedToPlan', () => {
  beforeEach(() => resetMarkerCounter())

  it('allows with 0 markers', () => {
    const s = createClarificationSession('SPEC-001')
    expect(canProceedToPlan(s).ok).toBe(true)
  })

  it('allows with markers <= max unresolved', () => {
    let s = createClarificationSession('SPEC-001', 3)
    s = (addMarker(s, 'SCOPE', '§1', 'Q1') as any).value
    s = (addMarker(s, 'SCOPE', '§2', 'Q2') as any).value
    s = (addMarker(s, 'SCOPE', '§3', 'Q3') as any).value
    expect(canProceedToPlan(s).ok).toBe(true)
  })

  it('blocks with markers > max unresolved', () => {
    let s = createClarificationSession('SPEC-001', 3)
    s = (addMarker(s, 'SCOPE', '§1', 'Q1') as any).value
    s = (addMarker(s, 'DATA_MODEL', '§2', 'Q2') as any).value
    s = (addMarker(s, 'SECURITY', '§3', 'Q3') as any).value
    s = (addMarker(s, 'UI_UX', '§4', 'Q4') as any).value
    const result = canProceedToPlan(s)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CLARIFICATION_MARKERS_UNRESOLVED')
  })

  it('allows after resolving enough markers', () => {
    let s = createClarificationSession('SPEC-001', 2)
    s = (addMarker(s, 'SCOPE', '§1', 'Q1') as any).value
    s = (addMarker(s, 'DATA_MODEL', '§2', 'Q2') as any).value
    s = (addMarker(s, 'SECURITY', '§3', 'Q3') as any).value
    expect(canProceedToPlan(s).ok).toBe(false)
    s = (resolveMarker(s, s.markers[0]!.id, 'done') as any).value
    expect(canProceedToPlan(s).ok).toBe(true)
  })
})

describe('completeRound', () => {
  it('increments round counter', () => {
    let s = createClarificationSession('SPEC-001')
    s = completeRound(s)
    expect(s.roundsCompleted).toBe(1)
    s = completeRound(s)
    expect(s.roundsCompleted).toBe(2)
  })
})

describe('formatMarkersForSpec', () => {
  beforeEach(() => resetMarkerCounter())

  it('formats open markers as NEEDS CLARIFICATION tags', () => {
    let s = createClarificationSession('SPEC-001')
    s = (addMarker(s, 'SCOPE', '§1', 'What scope?') as any).value
    const formatted = formatMarkersForSpec(s.markers)
    expect(formatted).toMatch(/\[NEEDS CLARIFICATION: CLR-/)
    expect(formatted).toContain('(SCOPE)')
    expect(formatted).toContain('What scope?')
  })

  it('excludes resolved markers', () => {
    let s = createClarificationSession('SPEC-001')
    s = (addMarker(s, 'SCOPE', '§1', 'Q1') as any).value
    s = (resolveMarker(s, s.markers[0]!.id, 'done') as any).value
    expect(formatMarkersForSpec(s.markers)).toBe('')
  })
})

describe('formatClarificationReport', () => {
  beforeEach(() => resetMarkerCounter())

  it('includes session summary', () => {
    let s = createClarificationSession('SPEC-001')
    s = (addMarker(s, 'SCOPE', '§1', 'Q1') as any).value
    s = (resolveMarker(s, s.markers[0]!.id, 'answer') as any).value
    s = completeRound(s)
    const report = formatClarificationReport(s)
    expect(report).toContain('SPEC-001')
    expect(report).toContain('Rounds completed:** 1')
    expect(report).toContain('Resolved')
  })
})
