// i18n Resolver Interface
// Contracts are stubs in Alpha — shapes stable from commit one

/** Supported UI languages */
export type SupportedLanguage = 'pt-br' | 'en'

/** Interface for resolving localized strings */
export interface I18nResolver {
  /** Active language */
  lang: SupportedLanguage
  /**
   * Resolve a localized string by dot-notation key.
   * Missing keys return a visible bug indicator: [KEY_NAME]
   * @param key - dot-notation key (max 3 levels): 'cli.install.welcome'
   * @param params - optional interpolation params: { version: '1.0' }
   */
  t(key: string, params?: Record<string, string>): string
}
