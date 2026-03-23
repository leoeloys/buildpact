import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'BuildPact',
  description: 'Spec-Driven Development framework — bilingual CLI for developers and domain experts',
  base: '/buildpact/',

  srcExclude: [
    'decisions/**',
    'community/**',
    'prd/**',
    'DECISIONS.md',
    'STATUS.md',
    'project-context.md',
    'voice-dna-guide.md',
    'prompt-mode-agent-loading-guide.md',
    'architecture.mermaid',
    'pipeline-flow.mermaid',
  ],

  locales: {
    en: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/en/guide/quick-start' },
          { text: 'CLI Reference', link: '/en/cli/' },
          { text: 'Architecture', link: '/en/architecture/overview' },
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Getting Started',
              items: [
                { text: 'Quick Start', link: '/en/guide/quick-start' },
                { text: 'Installation', link: '/en/guide/installation' },
                { text: 'The Pipeline', link: '/en/guide/pipeline' },
              ],
            },
            {
              text: 'Migration Guides',
              items: [
                { text: 'Overview', link: '/en/guide/migration/' },
                { text: 'From BMAD', link: '/en/guide/migration/from-bmad' },
                { text: 'From GSD', link: '/en/guide/migration/from-gsd' },
                { text: 'From SpecKit', link: '/en/guide/migration/from-speckit' },
              ],
            },
            {
              text: 'Squads & Agents',
              items: [
                { text: 'Creating Squads', link: '/en/guide/creating-squads' },
                { text: 'Voice DNA', link: '/en/guide/voice-dna' },
                { text: 'Walkthrough: Squad', link: '/en/guide/squad-walkthrough' },
              ],
            },
          ],
          '/en/cli/': [
            {
              text: 'Core Pipeline',
              items: [
                { text: 'Overview', link: '/en/cli/' },
                { text: 'quick', link: '/en/cli/quick' },
                { text: 'specify', link: '/en/cli/specify' },
                { text: 'plan', link: '/en/cli/plan' },
                { text: 'execute', link: '/en/cli/execute' },
                { text: 'verify', link: '/en/cli/verify' },
                { text: 'orchestrate', link: '/en/cli/orchestrate' },
              ],
            },
            {
              text: 'Setup & Maintenance',
              items: [
                { text: 'init', link: '/en/cli/init' },
                { text: 'adopt', link: '/en/cli/adopt' },
                { text: 'doctor', link: '/en/cli/doctor' },
                { text: 'upgrade', link: '/en/cli/upgrade' },
                { text: 'constitution', link: '/en/cli/constitution' },
              ],
            },
            {
              text: 'Squads & Agents',
              items: [
                { text: 'squad', link: '/en/cli/squad' },
              ],
            },
            {
              text: 'Advanced',
              items: [
                { text: 'memory', link: '/en/cli/memory' },
                { text: 'status', link: '/en/cli/status' },
                { text: 'export-web', link: '/en/cli/export-web' },
                { text: 'optimize', link: '/en/cli/optimize' },
                { text: 'quality', link: '/en/cli/quality' },
                { text: 'docs', link: '/en/cli/docs' },
                { text: 'investigate', link: '/en/cli/investigate' },
                { text: 'audit', link: '/en/cli/audit' },
                { text: 'diff', link: '/en/cli/diff' },
                { text: 'completion', link: '/en/cli/completion' },
                { text: 'help', link: '/en/cli/help' },
              ],
            },
          ],
          '/en/architecture/': [
            {
              text: 'Architecture',
              items: [
                { text: 'Overview', link: '/en/architecture/overview' },
                { text: 'Pipeline Flow', link: '/en/architecture/pipeline' },
                { text: 'Squads', link: '/en/architecture/squads' },
              ],
            },
          ],
        },
      },
    },
    'pt-br': {
      label: 'Português (BR)',
      lang: 'pt-BR',
      themeConfig: {
        nav: [
          { text: 'Guia', link: '/pt-br/guide/quick-start' },
          { text: 'Referência CLI', link: '/pt-br/cli/' },
          { text: 'Arquitetura', link: '/pt-br/architecture/overview' },
        ],
        sidebar: {
          '/pt-br/guide/': [
            {
              text: 'Primeiros Passos',
              items: [
                { text: 'Início Rápido', link: '/pt-br/guide/quick-start' },
                { text: 'Instalação', link: '/pt-br/guide/installation' },
                { text: 'O Pipeline', link: '/pt-br/guide/pipeline' },
              ],
            },
            {
              text: 'Guias de Migração',
              items: [
                { text: 'Visão Geral', link: '/pt-br/guide/migration/' },
                { text: 'Do BMAD', link: '/pt-br/guide/migration/from-bmad' },
                { text: 'Do GSD', link: '/pt-br/guide/migration/from-gsd' },
                { text: 'Do SpecKit', link: '/pt-br/guide/migration/from-speckit' },
              ],
            },
            {
              text: 'Squads & Agentes',
              items: [
                { text: 'Criando Squads', link: '/pt-br/guide/creating-squads' },
                { text: 'Voice DNA', link: '/pt-br/guide/voice-dna' },
                { text: 'Walkthrough: Squad', link: '/pt-br/guide/squad-walkthrough' },
              ],
            },
          ],
          '/pt-br/cli/': [
            {
              text: 'Pipeline Principal',
              items: [
                { text: 'Visão Geral', link: '/pt-br/cli/' },
                { text: 'quick', link: '/pt-br/cli/quick' },
                { text: 'specify', link: '/pt-br/cli/specify' },
                { text: 'plan', link: '/pt-br/cli/plan' },
                { text: 'execute', link: '/pt-br/cli/execute' },
                { text: 'verify', link: '/pt-br/cli/verify' },
                { text: 'orchestrate', link: '/pt-br/cli/orchestrate' },
              ],
            },
            {
              text: 'Configuração',
              items: [
                { text: 'init', link: '/pt-br/cli/init' },
                { text: 'adopt', link: '/pt-br/cli/adopt' },
                { text: 'doctor', link: '/pt-br/cli/doctor' },
                { text: 'upgrade', link: '/pt-br/cli/upgrade' },
                { text: 'constitution', link: '/pt-br/cli/constitution' },
              ],
            },
            {
              text: 'Squads & Agentes',
              items: [
                { text: 'squad', link: '/pt-br/cli/squad' },
              ],
            },
            {
              text: 'Avançado',
              items: [
                { text: 'memory', link: '/pt-br/cli/memory' },
                { text: 'status', link: '/pt-br/cli/status' },
                { text: 'export-web', link: '/pt-br/cli/export-web' },
                { text: 'optimize', link: '/pt-br/cli/optimize' },
                { text: 'quality', link: '/pt-br/cli/quality' },
                { text: 'docs', link: '/pt-br/cli/docs' },
                { text: 'investigate', link: '/pt-br/cli/investigate' },
                { text: 'audit', link: '/pt-br/cli/audit' },
                { text: 'diff', link: '/pt-br/cli/diff' },
                { text: 'completion', link: '/pt-br/cli/completion' },
                { text: 'help', link: '/pt-br/cli/help' },
              ],
            },
          ],
          '/pt-br/architecture/': [
            {
              text: 'Arquitetura',
              items: [
                { text: 'Visão Geral', link: '/pt-br/architecture/overview' },
                { text: 'Fluxo do Pipeline', link: '/pt-br/architecture/pipeline' },
                { text: 'Squads', link: '/pt-br/architecture/squads' },
              ],
            },
          ],
        },
      },
    },
  },

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/leoeloys/buildpact' },
    ],
  },
})
