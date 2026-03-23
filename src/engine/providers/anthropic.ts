/**
 * AnthropicProvider — dispatches tasks to Claude via the Anthropic Messages API.
 * Supports model profile routing (FR-604) and automatic failover chains.
 * @module engine/providers/anthropic
 * @see NFR-12 — Agent-Agnostic Design
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SubagentProvider } from '../../contracts/provider.js'
import type { TaskDispatchPayload, TaskResult } from '../../contracts/task.js'
import { validatePayloadSize } from '../subagent.js'
import {
  buildFailoverChain,
  getCurrentModel,
  advanceFailover,
  parseModelProfiles,
  MODEL_CATALOG,
} from '../model-profile-manager.js'
import type { ProfileConfig, ProfileTier, ModelConfig, FailoverChain } from '../model-profile-manager.js'

/** Map task dispatch types to model profile operation types */
const TASK_TYPE_TO_PHASE: Record<TaskDispatchPayload['type'], string> = {
  specify: 'default',
  plan: 'plan_writing',
  execute: 'execution',
  verify: 'verification',
  quick: 'default',
  optimize: 'research',
}

/** HTTP status codes that warrant a failover retry */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 529])

/**
 * Anthropic provider using the Messages API.
 * Accepts an injected client for testability (injectable I/O pattern).
 */
export class AnthropicProvider implements SubagentProvider {
  readonly name = 'anthropic'
  private readonly client: Anthropic
  private readonly profileConfig: ProfileConfig
  private readonly tier: ProfileTier

  constructor(opts: {
    apiKey: string
    client?: Anthropic
    profileConfig?: ProfileConfig
    tier?: ProfileTier
  }) {
    this.client = opts.client ?? new Anthropic({ apiKey: opts.apiKey })
    this.profileConfig = opts.profileConfig ?? parseModelProfiles('')
    this.tier = opts.tier ?? 'balanced'
  }

  async dispatch(payload: TaskDispatchPayload): Promise<TaskResult> {
    // Validate payload size (NFR-02: ≤20KB)
    const sizeCheck = validatePayloadSize(payload)
    if (!sizeCheck.ok) {
      return {
        taskId: payload.taskId,
        success: false,
        artifacts: [],
        tokensUsed: 0,
        costUsd: 0,
        error: `Payload too large: ${sizeCheck.error.code}`,
      }
    }

    const phase = TASK_TYPE_TO_PHASE[payload.type]
    let chain = buildFailoverChain(this.profileConfig, this.tier, phase)

    return this.dispatchWithFailover(payload, chain)
  }

  private async dispatchWithFailover(
    payload: TaskDispatchPayload,
    chain: FailoverChain,
  ): Promise<TaskResult> {
    const model = getCurrentModel(chain)

    try {
      const response = await this.client.messages.create({
        model: model.modelId,
        max_tokens: model.maxTokens,
        messages: [{ role: 'user', content: payload.content }],
      })

      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const tokensUsed = inputTokens + outputTokens
      const costUsd = computeCost(model, inputTokens, outputTokens)

      // Extract text from response content blocks
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n')

      return {
        taskId: payload.taskId,
        success: true,
        artifacts: [],
        tokensUsed,
        costUsd,
      }
    } catch (error) {
      // Check if error is retryable (rate limit, server error)
      if (isRetryableError(error)) {
        const next = advanceFailover(chain)
        if (next.ok) {
          return this.dispatchWithFailover(payload, next.value)
        }
        // All failover models exhausted
        return {
          taskId: payload.taskId,
          success: false,
          artifacts: [],
          tokensUsed: 0,
          costUsd: 0,
          error: `All failover models exhausted. Last error: ${formatError(error)}`,
        }
      }

      // Non-retryable error (auth, bad request, etc.)
      return {
        taskId: payload.taskId,
        success: false,
        artifacts: [],
        tokensUsed: 0,
        costUsd: 0,
        error: formatError(error),
      }
    }
  }
}

/**
 * Compute cost from token usage using model catalog rates.
 * Uses output token rate for both input and output as a conservative estimate.
 * In production, input tokens are cheaper — this slightly overestimates.
 */
function computeCost(model: ModelConfig, inputTokens: number, outputTokens: number): number {
  // Use output rate for output tokens; input tokens are typically ~5x cheaper
  // but we use the catalog's costPer1kOutputUsd as the primary rate
  const outputCost = (outputTokens / 1000) * model.costPer1kOutputUsd
  // Input tokens cost ~1/5 of output tokens for Claude models
  const inputCost = (inputTokens / 1000) * (model.costPer1kOutputUsd / 5)
  return outputCost + inputCost
}

/** Check if an error from the Anthropic SDK is retryable */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) {
    return RETRYABLE_STATUS_CODES.has(error.status)
  }
  // Network errors are retryable
  if (error instanceof Anthropic.APIConnectionError) {
    return true
  }
  return false
}

/** Format an error into a human-readable string */
function formatError(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    return `Anthropic API error ${error.status}: ${error.message}`
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
