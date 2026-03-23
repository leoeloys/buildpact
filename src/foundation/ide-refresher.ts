/**
 * IDE command refresher — delegates to reinstaller.
 * Kept for backward compatibility with migrator.ts references.
 * @module foundation/ide-refresher
 * @deprecated Use reinstaller.ts directly
 */

export { reinstall as refreshIdeCommands } from './reinstaller.js'
