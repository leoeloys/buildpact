#!/usr/bin/env tsx
/**
 * Release publish script — builds and tags a release.
 * Run: npm run release:publish
 * @see Epic 21.3: v1.0 Release Checklist
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const projectDir = process.cwd()

function run(cmd: string, label: string): void {
  console.log(`  ${label}...`)
  execSync(cmd, { stdio: 'inherit', cwd: projectDir })
}

// Read version
const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8')) as { version: string; name: string; private?: boolean }
const version = pkg.version
const tag = `v${version}`

console.log(`\n  Releasing ${pkg.name}@${version}\n`)

// Step 1: Run release check first
try {
  execSync('npm run release:check', { stdio: 'pipe', cwd: projectDir, timeout: 180_000 })
} catch {
  console.error('  Release checks failed — aborting. Run npm run release:check for details.')
  process.exit(1)
}

// Step 2: Clean build
run('npm run build', 'Building')

// Step 3: Git tag
run(`git tag -a ${tag} -m "Release ${tag}"`, `Tagging ${tag}`)

console.log(`\n  ${pkg.name}@${version} tagged successfully!\n`)
