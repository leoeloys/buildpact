// Agent Namer — Generate alliterative, culturally-appropriate agent names
// Inspired by OpenSquad's naming convention (e.g., "Pedro Pesquisa", "Rita Research")

/** Name pools organized by first letter, bilingual */
const NAME_POOLS: Record<string, { 'en': string[]; 'pt-br': string[] }> = {
  a: { en: ['Ace', 'Ada', 'Ash'], 'pt-br': ['Ana', 'André', 'Aurora'] },
  b: { en: ['Blake', 'Briar', 'Brook'], 'pt-br': ['Bruno', 'Bruna', 'Bianca'] },
  c: { en: ['Cade', 'Cedar', 'Coral'], 'pt-br': ['Caio', 'Celina', 'Cauã'] },
  d: { en: ['Dale', 'Dawn', 'Drew'], 'pt-br': ['Davi', 'Diana', 'Dina'] },
  e: { en: ['Eden', 'Elm', 'Echo'], 'pt-br': ['Elena', 'Eli', 'Estela'] },
  f: { en: ['Fern', 'Finn', 'Flint'], 'pt-br': ['Flora', 'Fábio', 'Flávia'] },
  g: { en: ['Glen', 'Gale', 'Gray'], 'pt-br': ['Gil', 'Gaia', 'Guido'] },
  h: { en: ['Hart', 'Haven', 'Haze'], 'pt-br': ['Hugo', 'Helena', 'Heitor'] },
  i: { en: ['Iris', 'Ivy', 'Indie'], 'pt-br': ['Iris', 'Iago', 'Isadora'] },
  j: { en: ['Jade', 'Jay', 'Joss'], 'pt-br': ['Jana', 'Jorge', 'Jade'] },
  k: { en: ['Kai', 'Kit', 'Knox'], 'pt-br': ['Kaio', 'Kiara', 'Kiko'] },
  l: { en: ['Lane', 'Lake', 'Lark'], 'pt-br': ['Lia', 'Leo', 'Laís'] },
  m: { en: ['Mars', 'Mace', 'Merit'], 'pt-br': ['Maya', 'Milo', 'Mirela'] },
  n: { en: ['Nash', 'Neve', 'North'], 'pt-br': ['Nara', 'Nico', 'Nina'] },
  o: { en: ['Oak', 'Onyx', 'Orion'], 'pt-br': ['Olga', 'Otto', 'Olívia'] },
  p: { en: ['Penn', 'Pike', 'Piper'], 'pt-br': ['Pedro', 'Paola', 'Paulo'] },
  q: { en: ['Quinn', 'Quest'], 'pt-br': ['Quim'] },
  r: { en: ['Reef', 'Ridge', 'Rowan'], 'pt-br': ['Raí', 'Rosa', 'Ravi'] },
  s: { en: ['Sage', 'Scout', 'Slate'], 'pt-br': ['Sol', 'Sara', 'Saulo'] },
  t: { en: ['Tate', 'Thorne', 'True'], 'pt-br': ['Tiago', 'Taís', 'Tomás'] },
  u: { en: ['Urban', 'Unity'], 'pt-br': ['Ugo', 'Ula'] },
  v: { en: ['Vale', 'Voss', 'Vine'], 'pt-br': ['Val', 'Vitor', 'Viola'] },
  w: { en: ['Wren', 'West', 'Wilder'], 'pt-br': ['Wanda'] },
  x: { en: ['Xander'], 'pt-br': ['Xavier'] },
  y: { en: ['York'], 'pt-br': ['Yara', 'Yuri'] },
  z: { en: ['Zen', 'Zara', 'Zion'], 'pt-br': ['Zara', 'Zeca', 'Zilda'] },
}

/** Role descriptors for alliterative pairing */
const ROLE_DESCRIPTORS: Record<string, Record<string, string[]>> = {
  en: {
    a: ['Analyst', 'Architect', 'Auditor'],
    b: ['Builder', 'Benchmarker'],
    c: ['Crafter', 'Curator', 'Checker'],
    d: ['Designer', 'Director', 'Debugger'],
    e: ['Engineer', 'Editor', 'Evaluator'],
    f: ['Facilitator', 'Formatter'],
    g: ['Guardian', 'Guide'],
    h: ['Handler', 'Harmonizer'],
    i: ['Inspector', 'Integrator'],
    j: ['Judge'],
    k: ['Keeper'],
    l: ['Liaison', 'Librarian'],
    m: ['Manager', 'Mediator', 'Monitor'],
    n: ['Navigator', 'Narrator'],
    o: ['Optimizer', 'Organizer'],
    p: ['Planner', 'Producer', 'Proofer'],
    q: ['Qualifier'],
    r: ['Reviewer', 'Researcher', 'Reporter'],
    s: ['Strategist', 'Specialist', 'Scribe'],
    t: ['Tester', 'Tracker', 'Translator'],
    u: ['Unifier'],
    v: ['Validator', 'Verifier'],
    w: ['Writer', 'Watcher'],
    x: ['Examiner'],
    y: ['Yielder'],
    z: ['Zealot'],
  },
  'pt-br': {
    a: ['Analista', 'Arquiteto', 'Auditor'],
    b: ['Builder'],
    c: ['Curador', 'Criador', 'Checador'],
    d: ['Designer', 'Diretor'],
    e: ['Engenheiro', 'Editor', 'Estrategista'],
    f: ['Facilitador', 'Formatador'],
    g: ['Guardião', 'Guia'],
    h: ['Harmonizador'],
    i: ['Inspetor', 'Integrador'],
    j: ['Juiz'],
    k: ['Keeper'],
    l: ['Líder', 'Ligador'],
    m: ['Moderador', 'Monitor'],
    n: ['Navegador', 'Narrador'],
    o: ['Otimizador', 'Organizador'],
    p: ['Planejador', 'Produtor', 'Pesquisador'],
    q: ['Qualificador'],
    r: ['Revisor', 'Relator'],
    s: ['Estrategista', 'Supervisor'],
    t: ['Testador', 'Tradutor'],
    u: ['Unificador'],
    v: ['Validador', 'Verificador'],
    w: ['Writer'],
    x: ['Examinador'],
    y: ['Yielder'],
    z: ['Zelador'],
  },
}

/** Names already used by competing frameworks — NEVER generate these */
const FORBIDDEN_NAMES = new Set([
  'dex', 'aria', 'dara', 'sage',  // AIOX
  'mary', 'john', 'winston', 'bob', 'amelia', 'quinn', 'barry', 'sally', 'paige', 'murat',  // BMAD
  'pacto', 'sófia', 'renzo', 'coda', 'crivo', 'lira',  // BuildPact (reserved)
])

export type SupportedLanguage = 'en' | 'pt-br'

export interface GeneratedAgentName {
  name: string
  descriptor: string
  fullName: string  // "Name the Descriptor" or "Name Descriptor"
  language: SupportedLanguage
}

/**
 * Generate an alliterative agent name for a given role keyword.
 * @param roleKeyword - The role or function (e.g., "researcher", "writer", "analyst")
 * @param language - Target language
 * @param usedNames - Names already used in this squad (to avoid duplicates)
 */
export function generateAgentName(
  roleKeyword: string,
  language: SupportedLanguage = 'en',
  usedNames: Set<string> = new Set(),
): GeneratedAgentName {
  const firstLetter = roleKeyword.charAt(0).toLowerCase()
  const pool = NAME_POOLS[firstLetter]?.[language] ?? NAME_POOLS[firstLetter]?.en ?? ['Agent']
  const descriptors = ROLE_DESCRIPTORS[language]?.[firstLetter] ?? ROLE_DESCRIPTORS.en?.[firstLetter] ?? [roleKeyword]

  // Find a name not already used and not forbidden
  let selectedName = pool[0]!
  for (const candidate of pool) {
    if (!usedNames.has(candidate.toLowerCase()) && !FORBIDDEN_NAMES.has(candidate.toLowerCase())) {
      selectedName = candidate
      break
    }
  }

  // Find best descriptor match
  let selectedDescriptor = descriptors[0] ?? roleKeyword
  for (const d of descriptors) {
    if (d.toLowerCase().includes(roleKeyword.toLowerCase().slice(0, 3))) {
      selectedDescriptor = d
      break
    }
  }

  const fullName = language === 'pt-br'
    ? `${selectedName} ${selectedDescriptor}`
    : `${selectedName} the ${selectedDescriptor}`

  return {
    name: selectedName,
    descriptor: selectedDescriptor,
    fullName,
    language,
  }
}

/**
 * Generate names for a batch of roles.
 */
export function generateSquadNames(
  roles: string[],
  language: SupportedLanguage = 'en',
): GeneratedAgentName[] {
  const usedNames = new Set<string>()
  return roles.map(role => {
    const result = generateAgentName(role, language, usedNames)
    usedNames.add(result.name.toLowerCase())
    return result
  })
}
