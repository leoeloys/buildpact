/**
 * Squad Validator — pure aggregate validation for Squads.
 * Composes structural, handoff, and security checks from the engine.
 * @module squads
 * @see FR-905 Squad validation — structural and security compliance
 * @see FR-1103 Squad trust model — security checks before activation
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { validateSquadStructure, validateSquadSecurity, validateHandoffGraph } from '../engine/squad-scaffolder.js'
import { ok } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

/** Valid values for the `domain_type` field in squad.yaml */
export const VALID_DOMAIN_TYPES = ['software', 'medical', 'research', 'management', 'custom'] as const

export interface SquadCheckResult {
  name: string
  passed: boolean
  errors: string[]
}

export interface SquadValidationReport {
  squadDir: string
  structural: SquadCheckResult
  handoffs: SquadCheckResult
  security: SquadCheckResult | null  // null when community = false
  totalErrors: number
  passed: boolean
}

export interface ValidateSquadOptions {
  community?: boolean  // enforce security checks — default: false
}

/** Structured check item for machine-parseable JSON output (CI/CD consumption) */
export interface SquadJsonCheckItem {
  check: string
  passed: boolean
  file?: string
  message: string
  suggestedFix: string
}

/**
 * Validate a Squad directory: structural, handoff graph, and optional security checks.
 * Pure function — no filesystem side effects, no clack prompts, no audit logging.
 */
export async function validateSquad(
  squadDir: string,
  opts: ValidateSquadOptions = {}
): Promise<Result<SquadValidationReport>> {
  const { community = false } = opts

  const structResult = await validateSquadStructure(squadDir)
  if (!structResult.ok) return structResult

  const handoffResult = await validateHandoffGraph(squadDir)
  if (!handoffResult.ok) return handoffResult

  let security: SquadCheckResult | null = null
  if (community) {
    const secResult = await validateSquadSecurity(squadDir)
    if (!secResult.ok) return secResult
    security = { name: 'security', passed: secResult.value.errors.length === 0, errors: secResult.value.errors }
  }

  // Validate domain_type if present in squad.yaml
  const manifestErrors: string[] = []
  try {
    const yamlContent = await readFile(join(squadDir, 'squad.yaml'), 'utf-8')
    const match = yamlContent.match(/^domain_type:\s*(.+)$/m)
    if (match?.[1]) {
      const domainType = match[1].trim().replace(/^["']|["']$/g, '')
      if (!VALID_DOMAIN_TYPES.includes(domainType as typeof VALID_DOMAIN_TYPES[number])) {
        manifestErrors.push(
          `squad.yaml: invalid domain_type "${domainType}" — must be one of: ${VALID_DOMAIN_TYPES.join(', ')}`
        )
      }
    }
  } catch {
    // squad.yaml readability already checked by validateSquadStructure
  }

  const structuralErrors = [...structResult.value.errors, ...manifestErrors]
  const structural = { name: 'structural', passed: structuralErrors.length === 0, errors: structuralErrors }
  const handoffs = { name: 'handoffs', passed: handoffResult.value.errors.length === 0, errors: handoffResult.value.errors }
  const totalErrors = structural.errors.length + handoffs.errors.length + (security?.errors.length ?? 0)

  return ok({ squadDir, structural, handoffs, security, totalErrors, passed: totalErrors === 0 })
}

// ---------------------------------------------------------------------------
// JSON output helpers (Task 2.2, Story 11-2)
// ---------------------------------------------------------------------------

/** Extract file path from validator error string (e.g. "agents/chief.md: missing layer...") */
function extractFile(error: string): string | undefined {
  const colonIdx = error.indexOf(': ')
  if (colonIdx === -1) return undefined
  const candidate = error.slice(0, colonIdx)
  // Only treat as file if it looks like a path (contains / or ends with known extension)
  if (candidate.includes('/') || /\.(md|yaml|yml)$/.test(candidate)) return candidate
  return undefined
}

/** Map a security error string to a suggestedFix */
function securitySuggestedFix(error: string): string {
  if (error.includes('external URL')) return 'Remove or replace with local reference'
  if (error.includes('executable code')) return 'Replace with plain markdown; no `exec`, `eval`, or shell blocks'
  if (error.includes('path traversal')) return 'Use only relative paths within the Squad directory'
  if (error.includes('prompt injection')) return 'Remove instruction override patterns (e.g., \'ignore previous instructions\')'
  return 'Review and remove the flagged content'
}

/** Map a structural/handoff error string to a suggestedFix */
function structuralSuggestedFix(error: string): string {
  if (error.includes('Voice DNA') || error.includes('missing section') || error.includes('missing layer')) {
    return 'Add required section per the Voice DNA template'
  }
  if (error.includes('Anti-Patterns')) return 'Add at least 5 prohibited/required pairs using ✘ markers in Anti-Patterns'
  if (error.includes('Examples')) return 'Add at least 3 concrete input/output example pairs (numbered 1. **Input** → **Output**)'
  if (error.includes('Heuristics') && error.includes('IF/THEN')) return 'Add at least 3 numbered heuristic rules starting with "When" or "If"'
  if (error.includes('VETO:')) return 'Add at least one VETO: condition to the Heuristics section'
  if (error.includes('squad.yaml') && error.includes('missing required field')) {
    return 'Add the required field to squad.yaml — required: name, version, domain, description, initial_level'
  }
  if (error.includes('domain_type')) return 'Set domain_type to one of: software, medical, research, management, custom'
  if (error.includes('Handoff')) return 'Add at least one "- ←" or "- →" handoff entry to the Handoffs section'
  return 'Check squad.yaml structure and agent files against the Squad template'
}

/**
 * Convert a SquadValidationReport to a machine-parseable array of check items.
 * Suitable for CI/CD consumption — output as JSON via `bp squad validate --json`.
 */
export function toJsonOutput(report: SquadValidationReport): SquadJsonCheckItem[] {
  const items: SquadJsonCheckItem[] = []

  if (report.structural.passed) {
    items.push({ check: 'structural', passed: true, message: 'Structural checks passed', suggestedFix: '' })
  } else {
    for (const error of report.structural.errors) {
      const file = extractFile(error)
      items.push({
        check: 'structural',
        passed: false,
        ...(file !== undefined && { file }),
        message: error,
        suggestedFix: structuralSuggestedFix(error),
      })
    }
  }

  if (report.handoffs.passed) {
    items.push({ check: 'handoffs', passed: true, message: 'Handoff graph checks passed', suggestedFix: '' })
  } else {
    for (const error of report.handoffs.errors) {
      const file = extractFile(error)
      items.push({
        check: 'handoffs',
        passed: false,
        ...(file !== undefined && { file }),
        message: error,
        suggestedFix: 'Add at least one "- ←" or "- →" handoff entry to the Handoffs section',
      })
    }
  }

  if (report.security !== null) {
    if (report.security.passed) {
      items.push({ check: 'security', passed: true, message: 'Security checks passed', suggestedFix: '' })
    } else {
      for (const error of report.security.errors) {
        const file = extractFile(error)
        items.push({
          check: 'security',
          passed: false,
          ...(file !== undefined && { file }),
          message: error,
          suggestedFix: securitySuggestedFix(error),
        })
      }
    }
  }

  return items
}
