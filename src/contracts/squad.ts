// Squad Manifest + Hook Interface
// Contracts are stubs in Alpha — shapes stable from commit one

/** Squad automation level — L1 to L4 */
export type AutomationLevel = 'L1' | 'L2' | 'L3' | 'L4'

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
