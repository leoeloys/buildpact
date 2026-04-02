/**
 * Budget Policies — scoped budgets with windows, thresholds, and incident tracking.
 * Policies define spend limits per project/squad/agent with monthly or lifetime windows.
 *
 * Status levels: ok → warning → hard_stop
 * Incidents are tracked and require explicit resolution before work can resume.
 *
 * @module engine/budget-policies
 * @see Concept 14.2 (Paperclip budget policies)
 */

import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type {
  BudgetPolicy,
  BudgetPolicyStatus,
  BudgetIncident,
  BudgetScopeType,
  BudgetStatusLevel,
} from '../contracts/budget.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLICIES_FILE = join('budget', 'policies.json')
const INCIDENTS_DIR = join('budget', 'incidents')

/** Default warning threshold (80%) */
export const DEFAULT_WARN_PERCENT = 80

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new budget policy.
 */
export function createPolicy(opts: {
  id: string
  scopeType: BudgetScopeType
  scopeId: string
  windowKind: 'monthly' | 'lifetime'
  amountUsd: number
  warnPercent?: number | undefined
}): BudgetPolicy {
  return {
    id: opts.id,
    scopeType: opts.scopeType,
    scopeId: opts.scopeId,
    windowKind: opts.windowKind,
    amountUsd: opts.amountUsd,
    warnPercent: opts.warnPercent ?? DEFAULT_WARN_PERCENT,
    enabled: true,
  }
}

// ---------------------------------------------------------------------------
// Status check
// ---------------------------------------------------------------------------

/**
 * Check if the current monthly window has expired and return the effective spend.
 * For lifetime windows, always returns observedSpend unchanged.
 * For monthly windows, returns 0 if the window has rolled over.
 */
export function effectiveSpendInWindow(
  policy: BudgetPolicy,
  observedSpend: number,
  windowStartedAt: string | undefined,
): number {
  if (policy.windowKind !== 'monthly' || !windowStartedAt) return observedSpend
  const start = new Date(windowStartedAt)
  const now = new Date()
  // Different UTC month means the window has rolled over
  if (start.getUTCFullYear() !== now.getUTCFullYear() || start.getUTCMonth() !== now.getUTCMonth()) {
    return 0
  }
  return observedSpend
}

/**
 * Check the current status of a budget policy given observed spend.
 * For monthly policies, pass windowStartedAt to enable automatic window reset.
 */
export function checkPolicyStatus(
  policy: BudgetPolicy,
  observedSpend: number,
  windowStartedAt?: string | undefined,
): BudgetPolicyStatus {
  if (!policy.enabled) {
    return {
      policy,
      observed: observedSpend,
      status: 'ok',
      remainingUsd: policy.amountUsd - observedSpend,
    }
  }

  const spend = effectiveSpendInWindow(policy, observedSpend, windowStartedAt)
  const warnThreshold = policy.amountUsd * (policy.warnPercent / 100)
  let status: BudgetStatusLevel = 'ok'

  if (spend >= policy.amountUsd) {
    status = 'hard_stop'
  } else if (spend >= warnThreshold) {
    status = 'warning'
  }

  return {
    policy,
    observed: spend,
    status,
    remainingUsd: Math.max(0, policy.amountUsd - spend),
  }
}

// ---------------------------------------------------------------------------
// Policy lookup
// ---------------------------------------------------------------------------

/**
 * Find the applicable policy for a given scope.
 */
export function findApplicablePolicy(
  policies: BudgetPolicy[],
  scopeType: BudgetScopeType,
  scopeId: string,
): BudgetPolicy | undefined {
  return policies.find(p => p.enabled && p.scopeType === scopeType && p.scopeId === scopeId)
}

// ---------------------------------------------------------------------------
// Incident management
// ---------------------------------------------------------------------------

/**
 * Create a budget incident record.
 */
export function createIncident(
  policyId: string,
  observedAmount: number,
  threshold: number,
): BudgetIncident {
  return {
    policyId,
    triggeredAt: new Date().toISOString(),
    observedAmount,
    threshold,
    resolution: null,
  }
}

/**
 * Resolve a budget incident.
 */
export function resolveIncident(
  incident: BudgetIncident,
  resolution: 'acknowledged' | 'increased' | 'paused',
): BudgetIncident {
  return { ...incident, resolution }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** Type guard: validate a parsed object is a BudgetPolicy */
function isBudgetPolicy(obj: unknown): obj is BudgetPolicy {
  if (typeof obj !== 'object' || obj === null) return false
  const o = obj as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.scopeType === 'string' &&
    typeof o.amountUsd === 'number' && typeof o.enabled === 'boolean'
}

/**
 * Load budget policies from .buildpact/budget/policies.json.
 * Validates each parsed policy with a type guard.
 */
export async function loadPolicies(projectDir: string): Promise<Result<BudgetPolicy[]>> {
  const path = join(projectDir, '.buildpact', POLICIES_FILE)
  try {
    const content = await readFile(path, 'utf-8')
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) return ok([])
    return ok(parsed.filter(isBudgetPolicy))
  } catch {
    return ok([]) // No policies yet
  }
}

/**
 * Save budget policies to .buildpact/budget/policies.json.
 */
export async function savePolicies(
  projectDir: string,
  policies: BudgetPolicy[],
): Promise<Result<void>> {
  const dir = join(projectDir, '.buildpact', 'budget')
  await mkdir(dir, { recursive: true })
  const path = join(projectDir, '.buildpact', POLICIES_FILE)
  try {
    await writeFile(path, JSON.stringify(policies, null, 2), 'utf-8')
    return ok(undefined)
  } catch {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.file.write_failed',
      params: { path },
    })
  }
}

/**
 * Record a budget incident to .buildpact/budget/incidents/.
 */
export async function recordIncident(
  projectDir: string,
  incident: BudgetIncident,
): Promise<Result<void>> {
  const dir = join(projectDir, '.buildpact', INCIDENTS_DIR)
  await mkdir(dir, { recursive: true })
  const filename = `${incident.policyId}-${Date.now()}.json`
  const path = join(dir, filename)
  try {
    await writeFile(path, JSON.stringify(incident, null, 2), 'utf-8')
    return ok(undefined)
  } catch {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.file.write_failed',
      params: { path },
    })
  }
}
