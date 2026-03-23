// Performance Mode — simplified UX for model profile selection
// Maps user-friendly labels to internal model profiles
// Inspired by OpenSquad's Alta Performance / Economico toggle

export type PerformanceMode = 'quality' | 'balanced' | 'speed'

export interface PerformanceModeConfig {
  mode: PerformanceMode
  label: string
  description: string
  profile: string  // maps to .buildpact/profiles/{profile}.yaml
}

export const PERFORMANCE_MODES: Record<PerformanceMode, PerformanceModeConfig> = {
  quality: {
    mode: 'quality',
    label: 'Quality First',
    description: 'Best models for all phases — slower, more expensive, highest accuracy',
    profile: 'quality',
  },
  balanced: {
    mode: 'balanced',
    label: 'Balanced',
    description: 'Smart model mix — good quality with reasonable cost',
    profile: 'balanced',
  },
  speed: {
    mode: 'speed',
    label: 'Speed First',
    description: 'Fastest models — cheaper, faster, good for iteration',
    profile: 'budget',
  },
}

/**
 * Get performance mode config from a profile name.
 */
export function getPerformanceMode(profileName: string): PerformanceModeConfig {
  if (profileName === 'quality') return PERFORMANCE_MODES.quality
  if (profileName === 'budget') return PERFORMANCE_MODES.speed
  return PERFORMANCE_MODES.balanced
}

/**
 * Format performance mode for display.
 */
export function formatPerformanceMode(mode: PerformanceModeConfig): string {
  const icons: Record<PerformanceMode, string> = {
    quality: '🎯',
    balanced: '⚖️',
    speed: '⚡',
  }
  return `${icons[mode.mode]} ${mode.label} — ${mode.description}`
}

/**
 * Get all available modes for selection UI.
 */
export function getAvailableModes(): PerformanceModeConfig[] {
  return [PERFORMANCE_MODES.quality, PERFORMANCE_MODES.balanced, PERFORMANCE_MODES.speed]
}
