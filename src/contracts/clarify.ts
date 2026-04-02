// Clarify Contracts — ambiguity taxonomy and markers (Concept 6.1)
// Contracts are stubs in Alpha — shapes stable from commit one

/** 10 categories of specification ambiguity */
export type AmbiguityCategory =
  | 'SCOPE'
  | 'DATA_MODEL'
  | 'USER_FLOW'
  | 'ERROR_HANDLING'
  | 'PERFORMANCE'
  | 'SECURITY'
  | 'INTEGRATION'
  | 'PERSISTENCE'
  | 'UI_UX'
  | 'BUSINESS_RULES'

/** A marker flagging an ambiguous section in a spec */
export interface ClarificationMarker {
  /** Marker identifier (CLR-001, CLR-002, ...) */
  id: string
  /** Category from the ambiguity taxonomy */
  category: AmbiguityCategory
  /** Section reference in the spec (e.g. "§3.2 Data Model") */
  location: string
  /** Specific question to resolve the ambiguity */
  question: string
  /** Whether this marker has been resolved */
  status: 'open' | 'resolved'
  /** How the ambiguity was resolved (null while open) */
  resolution: string | null
}

/** State of a clarification session between specify and plan */
export interface ClarificationSession {
  /** Spec being clarified */
  specId: string
  /** All clarification markers */
  markers: ClarificationMarker[]
  /** Maximum open markers allowed to proceed to plan (default: 3) */
  maxUnresolvedAfterClarify: number
  /** Number of clarification rounds completed */
  roundsCompleted: number
}
