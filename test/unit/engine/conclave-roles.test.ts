import { describe, it, expect } from 'vitest'
import {
  FORMALIZED_ROLES,
  selectRolesForReview,
  formatConclaveVote,
} from '../../../src/engine/conclave-roles.js'
import type { ConclaveRole } from '../../../src/engine/conclave-roles.js'

describe('FORMALIZED_ROLES', () => {
  it('contains 6 roles', () => {
    expect(FORMALIZED_ROLES).toHaveLength(6)
  })

  it('each role has id, name, perspective, votingWeight', () => {
    for (const role of FORMALIZED_ROLES) {
      expect(role.id).toBeTruthy()
      expect(role.name).toBeTruthy()
      expect(role.perspective).toBeTruthy()
      expect(typeof role.votingWeight).toBe('number')
    }
  })

  it('includes architect and security roles', () => {
    const ids = FORMALIZED_ROLES.map(r => r.id)
    expect(ids).toContain('architect')
    expect(ids).toContain('security')
  })
})

describe('selectRolesForReview', () => {
  it('returns code-relevant roles for code content', () => {
    const roles = selectRolesForReview('code')
    const ids = roles.map(r => r.id)
    expect(ids).toContain('developer')
    expect(ids).toContain('security')
    expect(ids).toContain('testing')
  })

  it('returns spec-relevant roles for spec content', () => {
    const roles = selectRolesForReview('spec')
    const ids = roles.map(r => r.id)
    expect(ids).toContain('architect')
    expect(ids).toContain('ux')
  })

  it('returns all roles for unknown content type', () => {
    const roles = selectRolesForReview('unknown-type')
    expect(roles).toHaveLength(FORMALIZED_ROLES.length)
  })

  it('returns api-relevant roles for api content', () => {
    const roles = selectRolesForReview('api')
    const ids = roles.map(r => r.id)
    expect(ids).toContain('architect')
    expect(ids).toContain('security')
    expect(ids).toContain('performance')
  })
})

describe('formatConclaveVote', () => {
  const architect: ConclaveRole = FORMALIZED_ROLES.find(r => r.id === 'architect')!

  it('formats approve vote', () => {
    const output = formatConclaveVote(architect, 'approve', 'Good design')
    expect(output).toContain('[APPROVE]')
    expect(output).toContain('Architect')
    expect(output).toContain('Good design')
    expect(output).toContain('weight: 1.5')
  })

  it('formats reject vote', () => {
    const output = formatConclaveVote(architect, 'reject', 'Poor modularity')
    expect(output).toContain('[REJECT]')
  })

  it('formats abstain vote', () => {
    const output = formatConclaveVote(architect, 'abstain', 'Not applicable')
    expect(output).toContain('[ABSTAIN]')
  })
})
