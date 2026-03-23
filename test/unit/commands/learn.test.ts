/**
 * Learn command — unit tests
 * @see Epic 21.1: Onboarding Learn Command
 */

import { describe, it, expect } from 'vitest'
import { buildTutorialUrl } from '../../../src/commands/learn/handler.js'

describe('buildTutorialUrl', () => {
  it('returns EN URL for English', () => {
    expect(buildTutorialUrl('en')).toBe('https://buildpact.dev/guide/getting-started')
  })

  it('returns PT-BR URL for Portuguese', () => {
    expect(buildTutorialUrl('pt-br')).toBe('https://buildpact.dev/pt-br/guide/getting-started')
  })
})
