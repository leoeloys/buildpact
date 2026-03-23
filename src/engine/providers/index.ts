/**
 * Provider factory — resolves the appropriate SubagentProvider based on configuration.
 * @module engine/providers
 * @see NFR-12 — Agent-Agnostic Design
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SubagentProvider } from '../../contracts/provider.js'
import type { Result } from '../../contracts/errors.js'
import { ok } from '../../contracts/errors.js'
import { StubProvider } from './stub.js'
import { AnthropicProvider } from './anthropic.js'
import { parseModelProfiles, readActiveProfileTier } from '../model-profile-manager.js'

export { StubProvider } from './stub.js'
export { AnthropicProvider } from './anthropic.js'

/**
 * Resolve the appropriate SubagentProvider based on environment and project configuration.
 *
 * Resolution order:
 * 1. If ANTHROPIC_API_KEY is set → AnthropicProvider with model profile config
 * 2. Otherwise → StubProvider (Alpha fallback, no error)
 *
 * Extensible: future providers (OpenAI, Gemini) add new env var checks here.
 */
export async function resolveProvider(projectDir: string): Promise<Result<SubagentProvider>> {
  const apiKey = process.env['ANTHROPIC_API_KEY']

  if (apiKey) {
    // Load model profile configuration from project
    let configYaml = ''
    try {
      configYaml = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    } catch {
      // No config file — use defaults
    }

    const profileConfig = parseModelProfiles(configYaml)
    const tier = await readActiveProfileTier(projectDir)

    return ok(new AnthropicProvider({ apiKey, profileConfig, tier }))
  }

  // No API key configured — return stub provider
  return ok(new StubProvider())
}
