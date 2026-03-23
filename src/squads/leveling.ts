/**
 * Leveling — Agent autonomy leveling facade for the squads domain.
 * Exposes engine/autonomy-manager through the squads module boundary.
 * @module squads
 * @see FR-851 Agent Autonomy Leveling
 * @see NFR-25 Consent model tied to autonomy level
 */

import {
  getAgentLevel,
  requiresWriteConfirmation,
  scanAgentSuggestions,
  recordApproval,
  applyLevelChange,
  checkPromotion,
  checkDemotion,
  readApprovalStore,
} from '../engine/autonomy-manager.js'
import type { AutomationLevel } from '../contracts/squad.js'

export type {
  AgentApprovalRecord,
  AgentLevelState,
  AgentApprovalStore,
  LevelChangeSuggestion,
} from '../engine/autonomy-manager.js'

export {
  getAgentLevel,
  requiresWriteConfirmation,
  scanAgentSuggestions,
  recordApproval,
  applyLevelChange,
  checkPromotion,
  checkDemotion,
  readApprovalStore,
}

/** Default autonomy level for a new agent by tier. T3 Support starts at L1 (Observer); all others at L2 (Contributor). */
export function defaultLevelForTier(tier: 'T1' | 'T2' | 'T3' | 'T4'): AutomationLevel {
  return tier === 'T3' ? 'L1' : 'L2'
}
