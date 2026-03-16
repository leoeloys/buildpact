import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        'src/**/*.d.ts',
        // CLI entry point — not unit-testable (interactive TUI)
        'src/cli/index.ts',
        // Stub command handlers — no logic, covered by story 3.x+ implementation
        'src/commands/*/index.ts',
        'src/commands/registry.ts',
        // Interface-only contracts — no executable code (type definitions)
        'src/contracts/budget.ts',
        'src/contracts/i18n.ts',
        'src/contracts/profile.ts',
        'src/contracts/squad.ts',
        'src/contracts/task.ts',
        // Module index barrels
        'src/foundation/index.ts',
        'src/engine/index.ts',
      ],
      thresholds: {
        // Thresholds applied only to covered files (per architecture spec)
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
      reporter: ['text', 'lcov'],
    },
  },
})
