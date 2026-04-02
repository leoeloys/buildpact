/**
 * Approval Gates — formal human governance at pipeline checkpoints.
 * Status: pending → approved/rejected/revision_requested.
 *
 * @module engine/approval-gates
 * @see Concept 14.3 (Paperclip approval gates)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { ApprovalRequest, ApprovalType, ApprovalStatus } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateApprovalId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `APR-${ts}-${rand}`
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createApprovalRequest(
  type: ApprovalType,
  description: string,
  artifacts: string[],
): ApprovalRequest {
  return {
    id: generateApprovalId(),
    type,
    description,
    requestedAt: new Date().toISOString(),
    status: 'pending',
    decidedAt: null,
    decisionNote: null,
    artifacts,
  }
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export function approveRequest(request: ApprovalRequest, note: string = ''): ApprovalRequest {
  return {
    ...request,
    status: 'approved',
    decidedAt: new Date().toISOString(),
    decisionNote: note || null,
  }
}

export function rejectRequest(request: ApprovalRequest, note: string): ApprovalRequest {
  return {
    ...request,
    status: 'rejected',
    decidedAt: new Date().toISOString(),
    decisionNote: note,
  }
}

export function requestRevision(request: ApprovalRequest, feedback: string): ApprovalRequest {
  return {
    ...request,
    status: 'revision_requested',
    decidedAt: new Date().toISOString(),
    decisionNote: feedback,
  }
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Check if an approval request allows proceeding.
 * BLOCKS if pending or rejected.
 */
export function requireApproval(request: ApprovalRequest): Result<ApprovalRequest> {
  if (request.status === 'pending') {
    return err({
      code: ERROR_CODES.APPROVAL_PENDING,
      i18nKey: 'error.approval.pending',
      params: { id: request.id, type: request.type },
    })
  }

  if (request.status === 'rejected') {
    return err({
      code: ERROR_CODES.APPROVAL_REJECTED,
      i18nKey: 'error.approval.rejected',
      params: { id: request.id, note: request.decisionNote ?? '' },
    })
  }

  if (request.status === 'revision_requested') {
    return err({
      code: ERROR_CODES.APPROVAL_REJECTED,
      i18nKey: 'error.approval.revision_requested',
      params: { id: request.id, feedback: request.decisionNote ?? '' },
    })
  }

  return ok(request)
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function saveApproval(
  projectDir: string,
  request: ApprovalRequest,
): Promise<Result<void>> {
  const dir = join(projectDir, '.buildpact', 'approvals')
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${request.id}.json`)
  try {
    await writeFile(path, JSON.stringify(request, null, 2), 'utf-8')
    return ok(undefined)
  } catch {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.file.write_failed',
      params: { path },
    })
  }
}

/** Type guard: validate parsed object is an ApprovalRequest */
function isApprovalRequest(obj: unknown): obj is ApprovalRequest {
  if (typeof obj !== 'object' || obj === null) return false
  const o = obj as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.type === 'string' &&
    typeof o.status === 'string' && typeof o.requestedAt === 'string'
}

export async function loadApproval(
  projectDir: string,
  approvalId: string,
): Promise<Result<ApprovalRequest>> {
  const path = join(projectDir, '.buildpact', 'approvals', `${approvalId}.json`)
  try {
    const content = await readFile(path, 'utf-8')
    const parsed = JSON.parse(content)
    if (!isApprovalRequest(parsed)) {
      return err({ code: ERROR_CODES.FILE_READ_FAILED, i18nKey: 'error.file.read_failed', params: { path } })
    }
    return ok(parsed)
  } catch {
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'error.file.read_failed',
      params: { path },
    })
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Check if an approval type requires human sign-off.
 * By default, all types require approval. Constitution can override.
 */
export function requiresHumanApproval(type: ApprovalType): boolean {
  // All types require approval by default
  return true
}

/**
 * Get pending approvals summary.
 */
export function getPendingCount(requests: ApprovalRequest[]): number {
  return requests.filter(r => r.status === 'pending').length
}
