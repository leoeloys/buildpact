import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createIsolatedWorkspace,
  applyVariant,
  commitWinner,
  cleanupWorkspace,
} from '../../../src/engine/optimization-isolation.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'bp-iso-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// createIsolatedWorkspace
// ---------------------------------------------------------------------------

describe('createIsolatedWorkspace', () => {
  it('creates a workspace with copied files', async () => {
    const squadDir = join(tmpDir, 'squad')
    await mkdir(squadDir)
    await writeFile(join(squadDir, 'squad.yaml'), 'name: test')

    const result = await createIsolatedWorkspace(squadDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const copied = await readFile(join(result.value, 'squad.yaml'), 'utf-8')
      expect(copied).toBe('name: test')
      await rm(result.value, { recursive: true, force: true })
    }
  })

  it('returns a path different from the source', async () => {
    const squadDir = join(tmpDir, 'squad2')
    await mkdir(squadDir)
    await writeFile(join(squadDir, 'file.txt'), 'content')

    const result = await createIsolatedWorkspace(squadDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).not.toBe(squadDir)
      await rm(result.value, { recursive: true, force: true })
    }
  })

  it('returns error for non-existent source directory', async () => {
    const result = await createIsolatedWorkspace('/nonexistent/path/squad')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_WRITE_FAILED')
    }
  })

  it('copies nested directories', async () => {
    const squadDir = join(tmpDir, 'squad3')
    await mkdir(join(squadDir, 'agents'), { recursive: true })
    await writeFile(join(squadDir, 'agents', 'dev.md'), '# Developer')

    const result = await createIsolatedWorkspace(squadDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const nested = await readFile(join(result.value, 'agents', 'dev.md'), 'utf-8')
      expect(nested).toBe('# Developer')
      await rm(result.value, { recursive: true, force: true })
    }
  })

  it('workspace is writable', async () => {
    const squadDir = join(tmpDir, 'squad4')
    await mkdir(squadDir)
    await writeFile(join(squadDir, 'test.txt'), 'original')

    const result = await createIsolatedWorkspace(squadDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      await writeFile(join(result.value, 'test.txt'), 'modified')
      const modified = await readFile(join(result.value, 'test.txt'), 'utf-8')
      expect(modified).toBe('modified')
      // Source unchanged
      const original = await readFile(join(squadDir, 'test.txt'), 'utf-8')
      expect(original).toBe('original')
      await rm(result.value, { recursive: true, force: true })
    }
  })
})

// ---------------------------------------------------------------------------
// applyVariant
// ---------------------------------------------------------------------------

describe('applyVariant', () => {
  it('writes variant content to file in workspace', async () => {
    const workspace = join(tmpDir, 'ws')
    await mkdir(workspace)
    await writeFile(join(workspace, 'agent.md'), 'old content')

    const result = await applyVariant(workspace, 'agent.md', 'new content')
    expect(result.ok).toBe(true)

    const content = await readFile(join(workspace, 'agent.md'), 'utf-8')
    expect(content).toBe('new content')
  })

  it('returns error for invalid path', async () => {
    const result = await applyVariant('/nonexistent', 'deep/nested/agent.md', 'content')
    expect(result.ok).toBe(false)
  })

  it('overwrites existing file completely', async () => {
    const workspace = join(tmpDir, 'ws2')
    await mkdir(workspace)
    await writeFile(join(workspace, 'agent.md'), 'long original content here')

    await applyVariant(workspace, 'agent.md', 'short')
    const content = await readFile(join(workspace, 'agent.md'), 'utf-8')
    expect(content).toBe('short')
  })

  it('handles UTF-8 content', async () => {
    const workspace = join(tmpDir, 'ws3')
    await mkdir(workspace)

    const utf8Content = '# Agente Desenvolvedor\nDescricao com acentos'
    const result = await applyVariant(workspace, 'agent.md', utf8Content)
    expect(result.ok).toBe(true)

    const content = await readFile(join(workspace, 'agent.md'), 'utf-8')
    expect(content).toBe(utf8Content)
  })

  it('can write to subdirectory paths', async () => {
    const workspace = join(tmpDir, 'ws4')
    await mkdir(join(workspace, 'agents'), { recursive: true })

    const result = await applyVariant(workspace, 'agents/dev.md', 'variant content')
    expect(result.ok).toBe(true)

    const content = await readFile(join(workspace, 'agents', 'dev.md'), 'utf-8')
    expect(content).toBe('variant content')
  })
})

// ---------------------------------------------------------------------------
// commitWinner
// ---------------------------------------------------------------------------

describe('commitWinner', () => {
  it('formats commit message with metric improvement', () => {
    const msg = commitWinner('/squad', 'developer.md', 'content', 5.0, 8.3)
    expect(msg).toBe('optimize(developer): improve metric 5.0 → 8.3')
  })

  it('strips file extension from agent name', () => {
    const msg = commitWinner('/squad', 'architect.md', 'content', 1.0, 2.0)
    expect(msg).toContain('optimize(architect)')
  })

  it('handles nested path by extracting filename', () => {
    const msg = commitWinner('/squad', 'agents/qa.md', 'content', 3.0, 7.0)
    expect(msg).toContain('optimize(qa)')
  })

  it('formats decimal places consistently', () => {
    const msg = commitWinner('/squad', 'dev.md', 'c', 3.14159, 9.87654)
    expect(msg).toContain('3.1')
    expect(msg).toContain('9.9')
  })

  it('handles zero improvement', () => {
    const msg = commitWinner('/squad', 'dev.md', 'c', 5.0, 5.0)
    expect(msg).toBe('optimize(dev): improve metric 5.0 → 5.0')
  })
})

// ---------------------------------------------------------------------------
// cleanupWorkspace
// ---------------------------------------------------------------------------

describe('cleanupWorkspace', () => {
  it('removes the workspace directory', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'bp-cleanup-'))
    await writeFile(join(workspace, 'file.txt'), 'data')

    await cleanupWorkspace(workspace)

    await expect(stat(workspace)).rejects.toThrow()
  })

  it('does not throw for non-existent directory', async () => {
    await expect(
      cleanupWorkspace('/tmp/nonexistent-bp-workspace-' + Date.now()),
    ).resolves.toBeUndefined()
  })
})
