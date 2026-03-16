import { describe, it, expect } from 'vitest'
import { createI18n } from '../../../src/foundation/i18n.js'

describe('createI18n', () => {
  it('resolves a simple key in English', () => {
    const i18n = createI18n('en')
    expect(i18n.lang).toBe('en')
    const result = i18n.t('cli.install.select_language')
    expect(result).toBe('Select your language')
  })

  it('resolves a simple key in PT-BR', () => {
    const i18n = createI18n('pt-br')
    expect(i18n.lang).toBe('pt-br')
    const result = i18n.t('cli.install.select_language')
    expect(result).toBe('Selecione seu idioma')
  })

  it('interpolates params correctly', () => {
    const i18n = createI18n('en')
    const result = i18n.t('cli.install.welcome', { version: 'v0.1.0' })
    expect(result).toBe('Welcome to BuildPact v0.1.0')
  })

  it('returns visible bug indicator for missing key — never crashes', () => {
    const i18n = createI18n('en')
    const result = i18n.t('does.not.exist')
    expect(result).toBe('[DOES_NOT_EXIST]')
  })

  it('returns placeholder for missing interpolation param', () => {
    const i18n = createI18n('en')
    const result = i18n.t('cli.install.welcome')  // version param missing
    expect(result).toBe('Welcome to BuildPact {version}')
  })

  it('interpolates multiple params', () => {
    const i18n = createI18n('en')
    const result = i18n.t('error.squad.not_found', { name: 'software' })
    expect(result).toBe("Squad 'software' not found in .buildpact/squads/")
  })

  it('resolves PT-BR error messages', () => {
    const i18n = createI18n('pt-br')
    const result = i18n.t('error.squad.validation_failed', { count: '3' })
    expect(result).toBe('Validação falhou: 3 erro(s) encontrado(s)')
  })
})
