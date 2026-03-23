import { describe, it, expect, vi, beforeEach } from 'vitest'
import { guardConstitutionModification } from '../../../src/commands/registry.js'

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
}))

const mockAuditLog = vi.fn().mockResolvedValue(undefined)
vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = mockAuditLog
  },
}))

describe('guardConstitutionModification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when output has no modification attempt', async () => {
    const result = await guardConstitutionModification('Use TypeScript strict mode.', '/tmp/proj')
    expect(result.ok).toBe(true)
  })

  it('prompts user when modification attempt is detected', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.confirm).mockResolvedValueOnce(true)
    await guardConstitutionModification('writeFile(".buildpact/constitution.md", data)', '/tmp/proj')
    expect(vi.mocked(clack.confirm)).toHaveBeenCalled()
  })

  it('returns ok when user approves modification', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.confirm).mockResolvedValueOnce(true)
    const result = await guardConstitutionModification('writeFile(".buildpact/constitution.md", data)', '/tmp/proj')
    expect(result.ok).toBe(true)
  })

  it('returns CONSTITUTION_MODIFICATION_BLOCKED when user denies', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.confirm).mockResolvedValueOnce(false)
    const result = await guardConstitutionModification('writeFile(".buildpact/constitution.md", data)', '/tmp/proj')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONSTITUTION_MODIFICATION_BLOCKED')
    }
  })

  it('returns CONSTITUTION_MODIFICATION_BLOCKED when user cancels (Ctrl+C)', async () => {
    const clack = await import('@clack/prompts')
    const cancelSymbol = Symbol('cancel')
    vi.mocked(clack.confirm).mockResolvedValueOnce(cancelSymbol as unknown as boolean)
    vi.mocked(clack.isCancel).mockReturnValueOnce(true)
    const result = await guardConstitutionModification('writeFile(".buildpact/constitution.md", data)', '/tmp/proj')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONSTITUTION_MODIFICATION_BLOCKED')
    }
  })

  it('audit logs constitution.modify.blocked when user denies', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.confirm).mockResolvedValueOnce(false)
    await guardConstitutionModification('writeFile(".buildpact/constitution.md", data)', '/tmp/proj')
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'constitution.modify.blocked',
        outcome: 'rollback',
      }),
    )
  })

  it('audit logs constitution.modify.approved when user consents', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.confirm).mockResolvedValueOnce(true)
    await guardConstitutionModification('writeFile(".buildpact/constitution.md", data)', '/tmp/proj')
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'constitution.modify.approved',
        outcome: 'success',
      }),
    )
  })

  it('uses i18n for the confirm message when resolver is provided', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.confirm).mockResolvedValueOnce(true)
    const mockI18n = {
      lang: 'en' as const,
      t: (key: string) => key === 'cli.constitution.violation.modification_blocked'
        ? 'Localized: approve changes?'
        : key,
    }
    await guardConstitutionModification('writeFile(".buildpact/constitution.md", data)', '/tmp/proj', mockI18n)
    expect(vi.mocked(clack.confirm)).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Localized: approve changes?' }),
    )
  })
})
