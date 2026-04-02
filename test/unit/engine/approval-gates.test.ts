import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createApprovalRequest,
  approveRequest,
  rejectRequest,
  requestRevision,
  requireApproval,
  saveApproval,
  loadApproval,
} from '../../../src/engine/approval-gates.js'

describe('createApprovalRequest', () => {
  it('creates request with pending status and generated id', () => {
    const req = createApprovalRequest('SPEC_APPROVAL', 'Approve spec', ['spec.md'])
    expect(req.id).toMatch(/^APR-/)
    expect(req.type).toBe('SPEC_APPROVAL')
    expect(req.status).toBe('pending')
    expect(req.decidedAt).toBeNull()
    expect(req.artifacts).toEqual(['spec.md'])
  })
})

describe('approveRequest', () => {
  it('sets status to approved with timestamp', () => {
    const req = createApprovalRequest('SPEC_APPROVAL', 'desc', [])
    const approved = approveRequest(req, 'Looks good')
    expect(approved.status).toBe('approved')
    expect(approved.decidedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(approved.decisionNote).toBe('Looks good')
  })

  it('handles empty note', () => {
    const req = createApprovalRequest('PLAN_APPROVAL', 'desc', [])
    const approved = approveRequest(req)
    expect(approved.decisionNote).toBeNull()
  })
})

describe('rejectRequest', () => {
  it('sets status to rejected with note', () => {
    const req = createApprovalRequest('SPEC_APPROVAL', 'desc', [])
    const rejected = rejectRequest(req, 'Missing requirements')
    expect(rejected.status).toBe('rejected')
    expect(rejected.decisionNote).toBe('Missing requirements')
  })
})

describe('requestRevision', () => {
  it('sets status to revision_requested', () => {
    const req = createApprovalRequest('SPEC_APPROVAL', 'desc', [])
    const revised = requestRevision(req, 'Add more detail to section 3')
    expect(revised.status).toBe('revision_requested')
    expect(revised.decisionNote).toBe('Add more detail to section 3')
  })
})

describe('requireApproval', () => {
  it('blocks pending requests', () => {
    const req = createApprovalRequest('SPEC_APPROVAL', 'desc', [])
    const result = requireApproval(req)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('APPROVAL_PENDING')
  })

  it('blocks rejected requests', () => {
    const req = rejectRequest(createApprovalRequest('SPEC_APPROVAL', 'desc', []), 'No')
    const result = requireApproval(req)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('APPROVAL_REJECTED')
  })

  it('blocks revision_requested', () => {
    const req = requestRevision(createApprovalRequest('SPEC_APPROVAL', 'desc', []), 'Fix it')
    const result = requireApproval(req)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('APPROVAL_REJECTED')
  })

  it('allows approved requests', () => {
    const req = approveRequest(createApprovalRequest('SPEC_APPROVAL', 'desc', []), 'LGTM')
    const result = requireApproval(req)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.status).toBe('approved')
  })
})

describe('saveApproval / loadApproval', () => {
  let tmpDir: string

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
  })

  it('round-trips approval to disk', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-approval-'))
    const req = approveRequest(createApprovalRequest('PLAN_APPROVAL', 'Approve plan', ['plan.md']), 'Approved')

    const saveResult = await saveApproval(tmpDir, req)
    expect(saveResult.ok).toBe(true)

    const loadResult = await loadApproval(tmpDir, req.id)
    expect(loadResult.ok).toBe(true)
    if (loadResult.ok) {
      expect(loadResult.value.id).toBe(req.id)
      expect(loadResult.value.status).toBe('approved')
    }
  })

  it('fails to load non-existent approval', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-approval-'))
    const result = await loadApproval(tmpDir, 'APR-nonexistent')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FILE_READ_FAILED')
  })
})
