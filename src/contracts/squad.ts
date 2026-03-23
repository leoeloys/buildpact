// Squad Manifest + Hook Interface
// Contracts are stubs in Alpha — shapes stable from commit one

/** Squad automation level — L1 to L4 */
export type AutomationLevel = 'L1' | 'L2' | 'L3' | 'L4'

/** Domain type determines human/agent task tagging behavior */
export type DomainType = 'software' | 'medical' | 'research' | 'management' | 'custom'

/** Bilingual disclaimer displayed in web bundle exports */
export interface BundleDisclaimer {
  'pt-br': string
  en: string
}

/** 6-layer agent anatomy in a Squad */
export interface AgentDefinition {
  identity: string
  persona: string
  voice_dna: string
  heuristics: string[]
  examples: string[]  // minimum 3 required
  handoffs: string[]
}

/** Squad manifest — loaded from squad.yaml */
export interface SquadManifest {
  name: string
  version: string
  domain: string
  description: string
  initial_level: AutomationLevel
  /** Domain type for human/agent task tagging. Default: 'software' (all tasks AGENT) */
  domain_type?: DomainType
  bundle_disclaimers?: BundleDisclaimer
  agents: Record<string, AgentDefinition>
  /** Available hook points in the pipeline */
  hooks?: Partial<Record<SquadHookPoint, string>>
}

/** The 6 pipeline hook points a Squad can attach to */
export type SquadHookPoint =
  | 'on_specify_start'
  | 'on_specify_complete'
  | 'on_plan_start'
  | 'on_plan_complete'
  | 'on_execute_start'
  | 'on_execute_complete'

/** A concrete hook registered by a Squad */
export interface SquadHook {
  point: SquadHookPoint
  /** Path to the hook handler file (relative to squad root) */
  handler: string
  /** Whether to halt pipeline on hook failure */
  blocking: boolean
}

// ---------------------------------------------------------------------------
// Voice DNA — Enhanced agent personality definition (from AIOX Squads pattern)
// ---------------------------------------------------------------------------

export interface VoiceDna {
  /** Words and phrases the agent uses frequently */
  anchor_words: string[]
  /** Communication style description */
  tone: string
  /** Things the agent NEVER says or does */
  anti_patterns: string[]
  /** Greeting style */
  greeting_style?: string
  /** Closing style */
  closing_style?: string
  /** Emoji frequency: none | low | medium | high */
  emoji_frequency?: 'none' | 'low' | 'medium' | 'high'
}

// ---------------------------------------------------------------------------
// Cognitive DNA — How the agent thinks (inspired by Mega Brain, clean-room)
// ---------------------------------------------------------------------------

export interface CognitiveDna {
  /** Core beliefs and worldview (L1) */
  philosophies?: string[]
  /** Thinking frameworks and decision patterns (L2) */
  mental_models?: string[]
  /** Practical rules and decision shortcuts (L3) */
  heuristics?: string[]
  /** Structured methodologies the agent uses (L4) */
  methodologies?: string[]
}

// ---------------------------------------------------------------------------
// Smoke Tests — Behavioral validation per agent (from AIOX Squads pattern)
// ---------------------------------------------------------------------------

export interface SmokeTest {
  /** What is being validated */
  description: string
  /** Sample input to give the agent */
  input: string
  /** Expected behavioral pattern in output (keywords, tone, structure) */
  expected_behavior: string
  /** Keywords that MUST appear in the response */
  must_contain?: string[]
  /** Keywords that must NOT appear in the response */
  must_not_contain?: string[]
}

// ---------------------------------------------------------------------------
// Workflow Chains — Deterministic handoff routing (from AIOX Core pattern)
// ---------------------------------------------------------------------------

export interface WorkflowChainStep {
  from_agent: string
  last_command: string
  next_commands: string[]
  next_agent?: string
}

export interface WorkflowChains {
  version: string
  chains: WorkflowChainStep[]
}

// ---------------------------------------------------------------------------
// Executor Type — Declarative task routing (from AIOX Squads pattern)
// ---------------------------------------------------------------------------

export type ExecutorType = 'agent' | 'human' | 'hybrid' | 'worker'

export interface ExecutorTypeConfig {
  requires_creativity?: ExecutorType
  requires_judgment?: ExecutorType[]
  requires_speed?: ExecutorType[]
  requires_consistency?: ExecutorType
  requires_validation?: ExecutorType
}

// ---------------------------------------------------------------------------
// Enhanced AgentDefinition — extends existing 6-layer anatomy
// ---------------------------------------------------------------------------

export interface EnhancedAgentDefinition extends AgentDefinition {
  /** Tier in the squad hierarchy: 0=Chief, 1=Master, 2=Specialist, 3=Support */
  tier?: 0 | 1 | 2 | 3
  /** Explicit scope declarations */
  scope?: {
    does: string[]
    does_not: string[]
  }
  /** Enhanced Voice DNA */
  voice_dna_enhanced?: VoiceDna
  /** Cognitive DNA layers */
  cognitive_dna?: CognitiveDna
  /** Behavioral smoke tests */
  smoke_tests?: SmokeTest[]
  /** autoClaude feature permissions */
  auto_permissions?: {
    canExecute?: boolean
    canVerify?: boolean
    canRollback?: boolean
    selfCritique?: boolean
    stuckDetection?: boolean
    maxRetryAttempts?: number
  }
}

// ---------------------------------------------------------------------------
// Enhanced SquadManifest — extends existing manifest
// ---------------------------------------------------------------------------

export interface EnhancedSquadManifest extends SquadManifest {
  /** Executor type rules for declarative task routing */
  executor_types?: ExecutorTypeConfig
  /** Workflow chains for deterministic handoffs */
  workflow_chains?: WorkflowChains
  /** Squad maturity: draft | developing | operational */
  maturity?: 'draft' | 'developing' | 'operational'
  /** Goal lineage — the mission context for all agents */
  mission?: string
}
