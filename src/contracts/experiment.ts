// Experiment Contracts — single-metric optimization (Concept 4.2)
// Contracts are stubs in Alpha — shapes stable from commit one

/** A single objective metric that defines success for an optimization loop */
export interface OptimizationTarget {
  /** Metric name (e.g. "test_pass_rate", "bundle_size_kb", "val_bpb") */
  metric: string
  /** Whether to minimize or maximize this metric */
  direction: 'minimize' | 'maximize'
  /** Shell command that produces the metric value (e.g. "npm test -- --json") */
  evaluationCommand: string
  /** Regex pattern to extract the numeric value from command output */
  extractPattern: string
  /** Baseline value from first run (null until measured) */
  baseline: number | null
}
