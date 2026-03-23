# Análise Comparativa de Frameworks AI-Driven Development
## BuildPact — Documento de Evolução

> Versão: 1.0.0 | Data: 2026-03-21 | Autor: Análise técnica profunda
> Propósito: Guia estratégico de evolução do BuildPact baseado em estudo de 8 frameworks

---

## 1. Contexto

Este documento registra a análise crítica de todos os frameworks de referência estudados para o BuildPact, identifica as melhores inovações de cada um, e define o roadmap de implementação para tornar o BuildPact o framework mais preciso, ágil e seguro para desenvolvimento de software com IA.

**Frameworks analisados:**
| # | Framework | Repositório | Licença | Versão |
|---|-----------|------------|---------|--------|
| 1 | BMAD Method v6 | bmad-code-org/BMAD-METHOD | MIT | 6.2.0 |
| 2 | GSD v1 | gsd-build/get-shit-done | MIT | 1.24 |
| 3 | GSD v2 | gsd-build/gsd-2 | MIT | 2.15 |
| 4 | AIOX Core | SynkraAI/aiox-core | MIT | 3.0 |
| 5 | AIOX Squads | SynkraAI/aiox-squads | MIT | latest |
| 6 | SpecKit | github/spec-kit | MIT | latest |
| 7 | Paperclip | paperclipai/paperclip | MIT | latest |
| 8 | Mega Brain | thiagofinch/mega-brain | **SEM LICENÇA** | latest |

---

## 2. Análise Crítica por Framework

### 2.1 BMAD Method v6 — Melhor em UX de Workflow e Qualidade de Artefatos

**Paradigma:** Lifecycle completo orchestrado por named agents com step-file architecture.

**Inovações que definem o estado da arte:**

| Inovação | Por que importa |
|----------|----------------|
| **Scale-Adaptive Routing (L0–L4)** | Classsifica automaticamente a complexidade antes de qualquer execução. L0=mudança atômica, L4=enterprise. Elimina cerimônia desnecessária em tarefas simples. |
| **Step-File Architecture** | Cada fase é um arquivo discreto com variáveis de estado explícitas e diretiva `NEXT STEP` obrigatória. Previne degradação por contexto longo nos LLMs. |
| **Adversarial Review Mandate** | Zero findings = halt forçado + reanálise obrigatória. Quebra viés de confirmação por design. Mínimo N issues deve ser encontrado. |
| **Implementation Readiness Gate** | Checkpoint formal PASS/CONCERNS/FAIL antes de qualquer execução. "Está tudo que o executor precisa disponível?" |
| **Named Personas** | Mary (Analyst), John (PM), Winston (Architect), Bob (SM), Amelia (Dev). Personas nomeadas melhoram ativação contextual e clareza de responsabilidade. |
| **Party Mode** | Múltiplos agentes deliberando em uma sessão com personalidades distintas. Útil para decisões complexas com trade-offs. |
| **Advanced Elicitation** | 5 métodos analíticos (Pre-mortem, First Principles, Inversão, Red Team, Socrático). Melhora specs sem iteração livre. |
| **ADR Integration** | Decisões arquiteturais documentadas com: contexto, opções, decisão, rationale, trade-offs. Previne conflitos entre agentes. |
| **MoSCoW Prioritization** | Must/Should/Could/Won't por requirement. Requirements priorizados são verificáveis. |

**Limitações críticas:**
- Context isolation é declarativa (espera que o LLM respeite) — não programática
- Sem rastreamento de custo nativo
- Sem controle de autonomia granular por task
- Sem compliance de domínio específico (CFM, PRISMA, etc.)
- Document sharding depreciado (LLMs modernos tornaram desnecessário)

**Veredito:** Framework mais maduro em UX de workflow. A step-file architecture e adversarial review são contribuições genuínas ao estado da arte.

---

### 2.2 GSD v1 — Melhor em Validação Formal e Wave Parallelism

**Paradigma:** Prompt-orchestrated pipeline com Nyquist validation e wave execution.

**Inovações:**

| Inovação | Por que importa |
|----------|----------------|
| **Nyquist Validation Layer** | Mapeia cobertura de testes para requirements *antes* do código. Sem o Nyquist, você descobre lacunas de cobertura após implementar. |
| **Wave-Based Parallelism** | Agrupa tarefas independentes em waves, executa em paralelo. Dependency graph → topological sort → waves. |
| **Context Rot Prevention** | Fresh 200k context por subagente + post-tool context monitor hook. O hook monitora uso e avisa o agente quando >65%. |
| **Deviation Rules (1-3)** | Auto-fix para bugs críticos/bloqueantes sem interromper o fluxo. Rule 1: fix bugs encontrados. Rule 2: implementar funções críticas faltantes. Rule 3: resolver blockers. |
| **Brownfield Mapping** | `/gsd:map-codebase` com agentes paralelos de análise (tech, arch, quality, concerns). |
| **UI Design Contract** | Fase dedicada de design com revisão antes do código. Consistência de UI garantida por contrato. |

**Limitações:**
- Orquestração via LLM = 10-15% overhead de contexto
- Sem rastreamento de custo
- Crash recovery manual (crash = intervenção humana)
- Auto-mode não confiável (LLM orquestrando LLM)

**Veredito:** A Nyquist Validation é a melhor contribuição. Wave-based parallelism está corretamente implementado e é superior à execução sequencial.

---

### 2.3 GSD v2 — Mais Confiável para Execução Autônoma

**Paradigma:** Application-orchestrated agent com state machine determinística.

A maior evolução conceitual de todos os frameworks: **de "LLM orquestrando sistema" para "aplicação orquestrando agentes"**.

**Inovações que mudam o paradigma:**

| Inovação | Por que é revolucionária |
|----------|------------------------|
| **Disk-Driven State Machine** | Orquestração determinística sem overhead de LLM. ~2-3% overhead vs ~10-15% no v1. Estado derivado de arquivos em disco, não de contexto de conversação. |
| **Branchless Worktree Architecture** | Single branch por milestone, commits sequenciais, zero conflitos de merge. Removeu ~2600 linhas de código de merge/conflict/branch-switching. |
| **Context Pre-Injection** | Todo contexto necessário injetado no dispatch antes da execução. Zero tool calls de leitura durante execução. |
| **Real-Time Dashboard** | Tokens, custo, projeções, progresso em tempo real. Visibility total do estado do sistema. |
| **Adaptive Roadmap Reassessment** | Após cada slice, roadmap atualiza automaticamente se novas informações mudam os planos. |
| **Watchdog com Heartbeat** | Soft 20min, idle 10min, hard 30min. Stuck = retry com deep diagnostics, depois hard stop. |
| **Token Cost Ledger** | Por unidade/fase/modelo com budget ceiling e pause automático. |
| **Auto-Mode Walk-Away** | Full pipeline unattended: research→plan→execute→complete. 2-8 horas sem intervenção. |

**O ADR do Branchless Model (ADR-001) é leitura obrigatória:**
Documenta como ~770 linhas de código de detecção de loop e ~2600 linhas de merge/conflict foram eliminadas adotando um modelo mais simples. A simplicidade é mais confiável que a complexidade.

**Limitações:**
- Sem paralelismo entre slices (workaround: múltiplos terminais)
- Modelo mental complexo para novos usuários (worktrees, state machines)
- Sem skill system — agentes hardcoded
- Sem compliance de domínio

**Veredito:** A implementação mais confiável para execução autônoma. O state machine determinístico é o padrão que o BuildPact deve adotar para o execute.

---

### 2.4 AIOX Core — Melhor em Anatomia de Agentes de Software

**Paradigma:** Software lifecycle multi-agent com workflow chains e autoClaude versioning.

**Inovações:**

| Inovação | Por que importa |
|----------|----------------|
| **6-Layer Agent Anatomy** | identity + persona + scope + voice_dna + heuristics + examples + handoffs. Estrutura mais completa e verificável da análise. |
| **Workflow Chains YAML** | `(from_agent + last_command) → next_command[]`. Handoffs determinísticos. Elimina "o agente decide o que fazer a seguir". |
| **autoClaude v3.0** | Feature-level autonomy: `canExecute`, `canVerify`, `canRollback`, `selfCritique`, `stuckDetection`. Mais granular que tier-based. |
| **Gotchas Memory** | Captura automática de padrões e armadilhas com recuperação contextual durante desenvolvimento. |
| **CodeRabbit Integration** | Code review com self-healing loop (max 2 iterações para issues CRITICAL). |
| **Multi-IDE Parity** | Claude Code, Codex CLI, Gemini CLI, Cursor com compatibility matrix de hooks. |
| **Technical Preferences Layer** | `technical-preferences.md` persiste personalizações do desenvolvedor entre projetos. |

**Limitações:**
- Domain-specific: extensão para non-software exige heavy customization
- 6-step greeting pipeline com GREENFIELD_GUARD pode ser frágil
- Handoff artifacts podem ficar stale sem garbage collection
- Sem budget guards

**Veredito:** Os workflow chains YAML são o padrão mais elegante de handoff. A anatomia de 6 camadas é superior ao que qualquer outro framework oferece.

---

### 2.5 AIOX Squads — Melhor em Domínios Não-Software

**Paradigma:** Community library de domain-specific "Elite Minds" — clonagem de expertise real.

**Inovações:**

| Inovação | Por que importa |
|----------|----------------|
| **Elite Minds Cloning** | Agentes derivados de frameworks reais (Marty Neumeier, April Dunford, Alexandra Watkins). Metodologias clonadas, não prompts genéricos. |
| **Voice DNA + Thinking DNA explícitos** | Anchor words, heuristics SE/THEN, anti-patterns, output examples, veto conditions. Mais estruturado que persona ad hoc. |
| **Smoke Tests por Agente** | 3 testes comportamentais por agente validando que age como o especialista real. Smoke tests de personalidade. |
| **4-Tier Hierarchy** | Chief (0) → Masters (1) → Specialists (2) → Support (3). Responsabilidades e limites claros por tier. |
| **Executor Type Selection** | `requires_creativity: human`, `requires_judgment: [human, hybrid]`. Declarativo e auditável — não é opinião do agente. |
| **Workflow YAML Files** | `wf-brand-from-zero.yaml` com fases e checkpoints. Mais transparente que chains implícitas. |
| **Axioma Assessment (Pro)** | 10 meta-axiomas com scoring ponderado PASS/FAIL. Validação sistemática de qualidade. |

**Limitações:**
- Sem execution engine próprio
- Sem memory layer entre usos
- Sem recovery system
- Sem web bundle export

**Veredito:** Os smoke tests de personalidade + Voice/Thinking DNA são o padrão mais rigoroso para validar comportamento de agentes. Essencial para o Squad system do BuildPact.

---

### 2.6 SpecKit — Melhor em Especificação como Artefato Primário

**Paradigma:** Specification-Driven Development — a spec é a fonte de verdade, o código é output gerado.

**Inovações:**

| Inovação | Por que importa |
|----------|----------------|
| **Spec = Source of Truth** | Não o código, não o PRD: a spec. Código é output gerado a partir dela. Muda fundamentalmente quem/o quê fica desatualizado primeiro. |
| **`[NEEDS_CLARIFICATION]` Obrigatório** | O LLM é forçado a marcar ambiguidades explicitamente em vez de adivinhar. Ambiguidades ficam visíveis no artefato. |
| **Living Docs com Feedback Loop** | Produção alimenta de volta a spec: incidentes, métricas, learnings operacionais refinam requirements. |
| **What-If Simulation** | Mesma spec gera múltiplas implementações com targets diferentes (performance vs UX vs custo). |
| **Spec Branching** | Specs existem em git branches, revisadas como código. Feature spec = feature branch. |
| **9 Constitutional Articles** | Library-First, CLI Mandate, Test-First, Anti-Abstraction, Integration-First Testing. Gates constitucionais previnem over-engineering na geração. |
| **Templates como LLM Constraints** | Templates previnem: feature creep, premature implementation, speculative features, assumptions não declaradas. |

**Limitações:**
- Sem distributed execution model
- Sem governance para approval gates
- Sem cost/token budgets
- Como specs evoluem quando implementação revela inviabilidade? Não documentado.
- Requer disciplina para manter spec-first mindset

**Veredito:** Os `[NEEDS_CLARIFICATION]` blocks obrigatórios são uma inovação real. Nenhum outro framework força o LLM a marcar ambiguidades em vez de assumir respostas.

---

### 2.7 Paperclip — Melhor em Governança e Budget Real

**Paradigma:** Corporate OS para agentes autônomos — org charts, budgets, heartbeats.

**Inovações:**

| Inovação | Por que importa |
|----------|----------------|
| **Heartbeat Protocol** | Estado por agente: Identity → Assignments → Checkout (atômico) → Work → Update → Delegate. Zero double-work, zero runaway spend. |
| **Atomic Checkout com 409 Conflict** | Nunca retry se outro agente está executando. Previne corrupção de estado sem código de detecção de loop. |
| **Cost Tracking por Heartbeat** | Provider, model, tokens in/out, custo em centavos. Agregado por agente por mês calendário UTC. |
| **80%/100% Thresholds** | Soft alert → hard stop → auto-pause reversível. Granularidade: por agente, por mês. |
| **Goal Lineage** | Toda task carrega hierarquia completa de "por quê existe". Missão → projeto → goal → task sempre visível. |
| **Chain of Command** | Escalation, delegation, visibilidade determinísticos via org chart. |
| **Runtime Skill Injection** | Agentes aprendem workflows do projeto em runtime sem retreinamento. |
| **Multi-Company Isolation** | Single deployment, companies completamente isoladas. |

**Limitações:**
- Sem dynamic task creation from specs
- Budget = cost tracking + hard stop, sem alocação adaptativa
- Org chart rígida (single parent)
- Approval gates parecem manuais

**Veredito:** O heartbeat protocol com atomic checkout é o mecanismo mais confiável de execução de todos os 8 frameworks. Goal lineage resolve o problema de "por quê estou fazendo isso" que todo agente autônomo tem.

---

### 2.8 Mega Brain — Melhor em Fidelidade Cognitiva ⚠️ SEM LICENÇA

> **IMPORTANTE:** Este framework não possui licença. Apenas conceitos podem ser estudados.
> Toda implementação no BuildPact deve ser clean-room (D-009).

**Paradigma:** Cognitive DNA extraction e hybrid personality synthesis com layered consciousness.

**Inovações conceituais:**

| Inovação | Por que importa |
|----------|----------------|
| **5-Layer Cognitive DNA** | Philosophies → Mental Models → Heuristics → Frameworks → Methodologies. Captura *como* alguém pensa, não só o que sabe. |
| **SOUL.md** | Narrativa em primeira pessoa que cresce com novos inputs. Evolução documentada com "antes vs depois" por milestone. |
| **100% Traceability** | Toda claim linka ao source material com navegação reversa `^[chunk_id]`. |
| **Hybrid DNA** | Blend ponderado de múltiplos experts com conflict maps explícitos. |
| **Auto Skill Generation** | Regex patterns extraem 128+ skills de frameworks detectados automaticamente. |
| **Conclave (3 roles)** | CRÍTICO (metodológico) + ADVOGADO DO DIABO + SINTETIZADOR com 6 fases e princípios constitucionais (Empirismo, Pareto, Inversão, Antifragilidade). |
| **Confidence-Based Escalation** | ≥70%: decide. 50-69%: decide com caveat. <50%: escalate ao humano com opções A/B/C. |

**Veredito:** Os conceitos de Cognitive DNA + Conclave são os mais inovadores da análise inteira. O Conclave é especialmente relevante para decisions que afetam o plano (ADRs críticos).

---

## 3. Matriz Comparativa

### 3.1 O Que Cada Framework Faz Melhor

| Dimensão | Melhor Framework | Por Quê |
|----------|-----------------|---------|
| Workflow UX | BMAD v6 | Step-files, named personas, adversarial review |
| Execução confiável | GSD v2 | State machine, branchless worktree, cost ledger |
| Validação formal | GSD v1 | Nyquist coverage mapping |
| Wave parallelism | GSD v1/v2 | Dependency graph + topological sort |
| Anatomia de agentes | AIOX Core | 6 camadas + workflow chains + autoClaude |
| Extensão de domínio | AIOX Squads | Elite Minds + Voice DNA + Smoke Tests |
| Qualidade de spec | SpecKit | [NEEDS_CLARIFICATION], constitutional gates |
| Governança e budget | Paperclip | Atomic checkout, cost ledger, goal lineage |
| Fidelidade cognitiva | Mega Brain | 5-layer DNA, Conclave, confidence escalation |

### 3.2 O Que o BuildPact tem e Nenhum Replicou

| Inovação BuildPact | Por Que é Única |
|-------------------|----------------|
| **Constitution com modification guard** | AIOX/BMAD têm project-context mas sem versioning + guard automático |
| **Budget guard com failover de perfis** | Paperclip tem cost tracking mas sem failover quality→balanced→budget |
| **Compliance de domínio (CFM, PRISMA)** | Nenhum dos 8 tem compliance regulatória por domínio |
| **Bilíngue nativo EN/PT-BR** | BMAD tem EN/ZH, nenhum tem PT-BR com 300+ strings |
| **AutoResearch (git ratchet)** | Nenhum tem loop de otimização contínua com commit só de melhorias comprovadas |
| **Memory layer 3 tiers formais** | GSD v2 tem decisions register, nenhum tem os 3 tiers como sistema formal |
| **Web bundle com token budgets por plataforma** | AIOX Core tem web builder mas sem limites por plataforma |
| **Autonomia L1-L4 por contrato de task** | Nenhum tem contrato explícito de autonomia por task com aprovação granular |

---

## 4. Extração e Roadmap de Implementação

### 4.1 Prioridade Crítica 🔴 — Confiabilidade do Pipeline

**Problema:** O execute atual é um stub. Sem execução real confiável, todo o resto é teoria.

**Solução (GSD v2 + Paperclip):**

1. **State machine disk-driven para execute**
   - Origem: GSD v2 (branchless worktree model)
   - Implementação: Estado derivado de arquivos em disco, não contexto de conversação
   - Impact: Crash recovery automático, zero overhead de orquestração LLM
   - Arquivo: `src/engine/wave-executor.ts` + `templates/commands/execute.md`

2. **Context pre-injection no dispatch**
   - Origem: GSD v2
   - Implementação: Toda spec, constitution, research injetada no prompt de dispatch antes da execução
   - Impact: Zero tool calls de leitura durante execução, prompts mais ricos
   - Arquivo: `src/engine/wave-executor.ts`

3. **Atomic checkout com conflito explícito**
   - Origem: Paperclip (409 Conflict)
   - Implementação: Antes de executar qualquer task, verificar se outra sessão está rodando via lock file
   - Impact: Previne corrupção de estado sem código de detecção de loop
   - Arquivo: `src/engine/wave-executor.ts` + novo `src/engine/execution-lock.ts`

4. **Implementation Readiness Gate**
   - Origem: BMAD v6
   - Implementação: Checkpoint PASS/CONCERNS/FAIL entre plan e execute
   - Impact: Execução só começa quando spec + plano + research estão completos
   - Arquivo: novo `src/engine/readiness-gate.ts` + `templates/commands/execute.md`

### 4.2 Prioridade Alta 🟠 — Qualidade dos Artefatos

5. **Scale Router L0–L4**
   - Origem: BMAD v6
   - Implementação: Gate de triagem em quick/specify — calcula complexity score objetivamente
   - Impact: Elimina cerimônia desnecessária em tasks simples, garante profundidade em tarefas complexas
   - Arquivo: novo `src/engine/scale-router.ts`

6. **Step-File Architecture nos templates**
   - Origem: BMAD v6
   - Implementação: Variáveis de estado explícitas (`{{state.baseline_commit}}`) + `NEXT STEP →` diretivas
   - Impact: Previne degradação por contexto longo, execução mais previsível
   - Arquivo: todos os `templates/commands/*.md`

7. **`[NEEDS_CLARIFICATION]` blocks no specify**
   - Origem: SpecKit
   - Implementação: Instruir o orchestrator a marcar todo assumption explicitamente
   - Impact: Ambiguidades ficam visíveis no artefato, não nas suposições silenciosas do LLM
   - Arquivo: `templates/commands/specify.md`

8. **Adversarial Review Mandate no verify**
   - Origem: BMAD v6
   - Implementação: Mínimo de issues a reportar configurável via constitution (`adversarial_minimum: 3`)
   - Impact: Quebra viés de confirmação — zero findings = sistema avisa que a revisão é superficial
   - Arquivo: `templates/commands/verify.md`

9. **MoSCoW + Gherkin nos artefatos do specify**
   - Origem: BMAD v6
   - Implementação: Cada requirement com Must/Should/Could/Won't + criteria em Given/When/Then
   - Impact: Requirements priorizados + critérios verificáveis automaticamente no verify
   - Arquivo: `templates/commands/specify.md`

### 4.3 Prioridade Média 🟡 — Capacidades Expandidas

10. **ADRs no plan**
    - Origem: BMAD v6
    - Implementação: Seção `## Architecture Decision Records` no plano gerado
    - Impact: Conflitos entre agentes de waves diferentes são prevenidos por decisões documentadas
    - Arquivo: `templates/commands/plan.md`

11. **Workflow Chains YAML para handoffs de squad**
    - Origem: AIOX Core
    - Implementação: `templates/squads/{name}/workflow-chains.yaml` mapeando `(agent, command) → next[]`
    - Impact: Handoffs determinísticos em vez de "o agente decide o que fazer a seguir"
    - Arquivo: novo arquivo por squad

12. **Voice DNA + Smoke Tests por agente**
    - Origem: AIOX Squads
    - Implementação: Campos `smoke_tests`, `voice_dna.anchor_words`, `voice_dna.anti_patterns` no squad.yaml
    - Impact: Validação comportamental de que o agente age como declarado
    - Arquivo: `src/contracts/squad.ts` + todos os `squad.yaml`

13. **Conclave para decisions críticas no plan**
    - Origem: Mega Brain (conceito clean-room)
    - Implementação: 3-role deliberation (Crítico + Advogado + Sintetizador) para ADRs high-stakes
    - Impact: Decisions com <70% confidence são flagged para aprovação humana
    - Arquivo: novo `src/engine/conclave.ts`

14. **Nyquist na fase plan (coverage mapping)**
    - Origem: GSD v1
    - Implementação: Mapear cobertura de testes para requirements *antes* de gerar o plano
    - Nota: BuildPact já tem Nyquist validation no plan, mas falta o *pre-plan* coverage check
    - Arquivo: `templates/commands/plan.md` + `src/engine/plan-validator.ts`

### 4.4 Prioridade Baixa 🟢 — Refinamentos e UX

15. **Cognitive DNA layers nos squad agents**
    - Origem: Mega Brain (conceito clean-room)
    - Implementação: Adicionar camadas: philosophies, mental_models, decision_heuristics, methodologies
    - Arquivo: `src/contracts/squad.ts` + agentes de referência

16. **Advanced Elicitation no specify/plan**
    - Origem: BMAD v6
    - Implementação: Após geração de spec/plano, oferecer segunda passagem analítica
    - Arquivo: `templates/commands/specify.md`, `templates/commands/plan.md`

17. **`bp:help` contextual**
    - Origem: BMAD v6
    - Implementação: Escaneia estado do projeto e recomenda próximo passo específico
    - Arquivo: novo `src/commands/help/handler.ts`

18. **Runtime skill injection no adopt**
    - Origem: Paperclip
    - Implementação: Durante `adopt`, injetar contexto do projeto nos squad agents
    - Arquivo: `src/foundation/adopter.ts`

---

## 5. Posicionamento Estratégico

### O Que Nenhum Framework Fez ao Mesmo Tempo

```
BMAD v6    → Melhor UX + workflow     ✓   Sem execução confiável
GSD v2     → Melhor execução          ✓   Sem domínios + sem squads
AIOX       → Melhor agents            ✓   Só software
Paperclip  → Melhor governança        ✓   Sem spec-driven
SpecKit    → Melhor spec              ✓   Sem execução
```

**BuildPact é o único que combina:**
- ✅ Spec-driven pipeline (specify → plan → execute → verify)
- ✅ Constitution imutável com modification guard
- ✅ Budget guard com failover de perfis de modelo
- ✅ Compliance de domínio (CFM, PRISMA, CONSORT)
- ✅ Squad system com domínios (software + medical + research + management)
- ✅ Memory layer 3-tier formal
- ✅ Bilíngue nativo (EN + PT-BR)
- ✅ Web bundle export para plataformas não-agente

### Tese de Diferenciação

**BuildPact não compete com BMAD** — BMAD é uma metodologia de processo.
**BuildPact não compete com GSD v2** — GSD é um executor autônomo.
**BuildPact compete com nenhum** porque é o único framework que:

1. Trata compliance regulatório como cidadão de primeira classe
2. Fornece squads de domínio prontos para uso (médico, pesquisa, gestão)
3. É construído nativamente para o mercado de língua portuguesa
4. Tem constitution com imutabilidade real (não só recomendação)

---

## 6. Implementações Realizadas Neste Ciclo

Este documento é acompanhado pela implementação das seguintes melhorias (v0.2.0):

### Templates Atualizados
- [x] `templates/commands/specify.md` — MoSCoW, Gherkin, [NEEDS_CLARIFICATION], Advanced Elicitation
- [x] `templates/commands/plan.md` — ADRs, Readiness Gate prep, Step-file structure
- [x] `templates/commands/execute.md` — Pre-injection, Atomic Checkout, State Machine documentation
- [x] `templates/commands/verify.md` — Adversarial Review Mandate
- [x] `templates/commands/quick.md` — Scale Router L0–L4

### Novos Módulos de Engine
- [x] `src/engine/scale-router.ts` — Complexity scoring + L0–L4 routing
- [x] `src/engine/readiness-gate.ts` — PASS/CONCERNS/FAIL checkpoint
- [x] `src/engine/conclave.ts` — 3-role deliberation for critical ADRs
- [x] `src/engine/execution-lock.ts` — Atomic checkout com conflict detection

### Contratos Expandidos
- [x] `src/contracts/task.ts` — ScaleLevel, ReadinessDecision, AdrEntry, ConclaveResult
- [x] `src/contracts/squad.ts` — VoiceDna, SmokeTest, WorkflowChains, CognitiveDna

### Squad YAMLs Aprimorados
- [x] Todos os squad.yaml — Voice DNA + Smoke Tests + Workflow Chains

---

## 7. Decisões Arquiteturais (ADRs deste ciclo)

### ADR-001: Manter templates como orquestradores, não converter para state machine de app

**Contexto:** GSD v2 usa uma aplicação TypeScript como state machine, sem LLM na orquestração.
**Opções:**
- A) Converter execute para app-orchestrated (como GSD v2)
- B) Melhorar os templates existentes com step-file architecture
- C) Caminho híbrido: state machine para execução, templates para planejamento

**Decisão:** Opção C — caminho híbrido.

**Rationale:** BuildPact opera como slash commands no Claude Code, não como CLI standalone. O usuário não roda `buildpact execute` — roda `/bp:execute`. O host LLM (Claude) lê o template e executa. Converter para app-orchestrated quebraria a compatibilidade com o modelo de distribuição atual (slash commands + web bundle). O correto é tornar os templates mais robustos com step-file architecture e variáveis de estado explícitas, e reservar a app-orchestration para o execute real (Agent Mode v2.0).

**Trade-offs aceitos:** Sem watchdog real, sem dashboard real, sem auto-mode walk-away (reservados para Agent Mode v2.0).

### ADR-002: Scale Router como gate declarativo, não algoritmo automático

**Contexto:** BMAD v6 roteia automaticamente L0-L4. BuildPact poderia fazer o mesmo.
**Decisão:** Scale Router apresenta a classificação ao usuário e pede confirmação antes de rotear.

**Rationale:** O LLM pode classificar errado. Uma mudança "simples" pode ser L3 por razões que o modelo não conhece (sistema legado, acoplamento oculto). Apresentar a classificação + justificativa ao usuário e pedir confirmação mantém o humano no controle de decisões de complexidade.

### ADR-003: Conclave é opt-in para ADRs, não obrigatório

**Contexto:** Mega Brain usa Conclave para todas as decisões importantes.
**Decisão:** Conclave só é ativado quando o plano contém ADRs com classificação `high_stakes: true` ou quando o usuário solicita explicitamente via `--conclave` flag.

**Rationale:** Adicionar 3 perspectivas a toda decisão arquitetural aumenta latência e tokens. O valor do Conclave está em decisions realmente difíceis com trade-offs significativos — não no boilerplate de toda planning session.

---

## 8. Análise Opus — Efetividade, Segurança, Intuitividade e User-Friendliness

> Adicionado em 2026-03-21 | Perspectiva: análise profunda do estado real do BuildPact vs. promessas dos templates, com foco em UX, safety, e design intuitivo.

### 8.1 O Estado Real vs. As Promessas

O diagnóstico profundo do BuildPact revela uma discrepância entre o que os templates v2.0.0 prometem e o que os handlers TypeScript efetivamente entregam:

| Capacidade | Template Promete | Handler Entrega | Gap |
|-----------|-----------------|-----------------|-----|
| Scale Router L0–L4 | STEP 0 do quick.md | ❌ Não existia | **CORRIGIDO** — agora wired no handler |
| Readiness Gate | STEP 6 do plan.md | ❌ Não existia | **CORRIGIDO** — agora wired no handler |
| Execution Lock | STEP 0 do execute.md | ❌ Não existia | **CORRIGIDO** — agora wired no handler |
| Adversarial Audit | STEP 3 do verify.md | ✅ Template mode | OK — LLM segue template |
| Context Pre-Injection | STEP 1 do execute.md | ⚠️ Stub dispatch | Funcional para quando dispatch real existir |
| Subagent Dispatch Real | STEP 2 do execute.md | ❌ executeTaskStub | Reservado para Agent Mode v2.0 |
| Advanced Elicitation | STEP 10 do specify.md | ⚠️ Template mode | LLM segue template |
| ADR Generation | STEP 3 do plan.md | ⚠️ Keyword-conditional | Aceitável — keywords são heurísticos |

**Ação tomada nesta sessão:** Os 3 gaps críticos (Scale Router, Readiness Gate, Execution Lock) foram wired nos handlers TypeScript. As promessas dos templates agora são cumpridas pelo código.

### 8.2 Padrões de UX Extraídos dos 8 Frameworks

#### O que todos os bons frameworks fazem (e BuildPact deve manter):

1. **First 5 minutes matter** — BMAD: `npx bmad-method install`. GSD: single command. Paperclip: branded wizard. **BuildPact:** `buildpact init` com wizard de 6 passos → ✅ já implementado e friendly.

2. **Contextual help always available** — BMAD: `bmad-help` sabe o estado do projeto. GSD: `/gsd:help` lista comandos. **BuildPact:** `buildpact doctor` para saúde, mas **falta um `bp:help` contextual** que recomende o próximo passo baseado no estado do projeto.

3. **Dual mode (interactive + autonomous)** — GSD v2: step mode (pausa entre tasks) vs auto mode (walk-away). **BuildPact:** quick=autônomo, specify/plan=interativo → ✅ ambos existem. Mas falta a opção de `/bp:execute --auto` para walk-away.

4. **Escape hatch always works** — GSD v2: Escape pausa, inspeciona, retoma. **BuildPact:** Ctrl+C cancela com mensagem i18n → ✅ implementado em todos os handlers.

5. **Git as safety net** — Todos usam atomic commits como ponto de reversão. **BuildPact:** ✅ formatCommitMessage + runAtomicCommit existem e são functional.

6. **State on disk = recovery** — GSD v2: `.gsd/` files derive state. **BuildPact:** `.buildpact/` com specs, plans, memory, audit → ✅ tudo em disco, recovery possível.

#### O que os melhores frameworks fazem e BuildPact ainda pode melhorar:

1. **GSD v2: Real-time dashboard** — BuildPact não tem dashboard. No Agent Mode v2.0, isso se torna necessário. Para agora, um `bp:status` que mostre o estado do pipeline (spec ready? plan ready? execution pending?) seria suficiente.

2. **GSD v2: Cost projection** — BuildPact tem budget guards mas sem projeção ("se continuar neste ritmo, vai custar $X"). Adicionar `estimatedTotalCost` ao budget check.

3. **Paperclip: Goal lineage** — Toda task carrega o "por quê". BuildPact tem o constitution mas não injeta o _propósito_ da spec em cada task dispatch. A pre-injection resolve parcialmente, mas falta um campo `purpose: string` no TaskDispatchPayload.

4. **BMAD: Party Mode** — Múltiplos agentes deliberando. O Conclave do BuildPact é análogo mas limitado a 3 papéis fixos para ADRs. Um modo mais geral de deliberação multi-agente seria útil para decisões de design (não apenas arquiteturas).

### 8.3 Segurança — O Que Nenhum Framework Resolveu Completamente

| Risco de Segurança | Quem resolve | Como BuildPact resolve |
|-------|------|---------|
| Runaway spend | GSD v2, Paperclip | ✅ Budget guard 3-level + failover de perfis |
| Concurrent corruption | Paperclip (409 Conflict) | ✅ Execution lock (agora wired) |
| Context poisoning | GSD (fresh context per task) | ✅ Subagent isolation + 20KB payload limit |
| Constitution drift | Nenhum completamente | ✅ Modification guard + version tracking — **BuildPact é o melhor** |
| Stale locks | GSD v2 (watchdog 30min) | ✅ 30min stale detection no execution-lock |
| Agent escape | Nenhum | ✅ Constitution enforcement + scope constraints |
| Rollback capability | GSD v1 (git reset) | ✅ Recovery session com git reset --hard |
| Compliance violations | Nenhum | ✅ CFM compliance gate — **único framework com isso** |

**O que falta:** Nenhum framework (incluindo BuildPact) tem:
- **Sandboxing real** de subagentes (filesystem isolation, network restriction)
- **Audit trail criptograficamente assinado** (logs são append-only mas não tamper-proof)
- **Rate limiting por agente** (budget é financeiro, mas não limita nº de operações)

### 8.4 Intuitividade — O Que Torna um Framework "Óbvio"

A análise dos 8 frameworks revela que a intuitividade vem de 3 dimensões:

**1. Nomes que contam a história**
- BMAD: Mary (Analyst), John (PM), Winston (Architect). Nomes humanizam.
- GSD: "Get Shit Done" — nome diz exatamente o propósito.
- BuildPact: `specify` → `plan` → `execute` → `verify` — **pipeline verbal intuitivo**. `quick` é o atalho óbvio. ✅ Excelente naming.

**2. Feedback contínuo sem ser invasivo**
- GSD v2: Dashboard overlay em tempo real. Informativo mas não interrompe.
- BMAD: `bmad-help` sob demanda. Disponível, não forçado.
- BuildPact: `clack.log.info/warn/success` em cada etapa. ✅ Bom nível de feedback. O Scale Router adiciona um feedback visual antes de começar.

**3. O sistema previne erros antes que aconteçam**
- SpecKit: `[NEEDS_CLARIFICATION]` força marcar ambiguidades.
- BMAD: Adversarial review força encontrar problemas.
- BuildPact (agora): Scale Router bloqueia L3+ no quick. Readiness Gate bloqueia execução sem artifacts. Adversarial review no verify. ✅ **BuildPact é agora o framework com mais gates preventivos.**

### 8.5 Recomendações Finais de UX para o BuildPact

| # | Recomendação | Impacto | Esforço | Status |
|---|-------------|---------|---------|--------|
| 1 | Wiring do Scale Router no quick handler | 🔴 Crítico | Baixo | ✅ FEITO |
| 2 | Wiring do Readiness Gate no plan handler | 🔴 Crítico | Baixo | ✅ FEITO |
| 3 | Wiring do Execution Lock no execute handler | 🔴 Crítico | Baixo | ✅ FEITO |
| 4 | `bp:status` command — mostra estado do pipeline | 🟠 Alto | Médio | TODO |
| 5 | `bp:help` contextual — recomenda próximo passo | 🟠 Alto | Médio | TODO |
| 6 | Projeção de custo no budget guard | 🟡 Médio | Baixo | TODO |
| 7 | `--auto` flag no execute para walk-away | 🟡 Médio | Médio | TODO (Agent Mode v2.0) |
| 8 | `purpose` field no TaskDispatchPayload | 🟢 Baixo | Baixo | TODO |
| 9 | Party Mode para deliberação geral | 🟢 Baixo | Alto | TODO (v2.0) |

### 8.6 Wiring Realizado nesta Sessão

Os 3 gaps mais críticos entre template e handler foram fechados:

1. **`src/commands/quick/handler.ts`** — Scale Router (L0–L4) agora executa antes da spec. L3+ bloqueia. L2 pede confirmação. i18n keys em EN e PT-BR.

2. **`src/commands/plan/handler.ts`** — Readiness Gate agora executa após Nyquist validation. FAIL bloqueia salvamento do plano. CONCERNS pede override. PASS exibe sucesso. i18n keys em EN e PT-BR.

3. **`src/commands/execute/handler.ts`** — Execution Lock agora adquirido no início. 409 Conflict se sessão ativa. Stale lock (>30min) removido automaticamente. Lock liberado via try/finally. i18n keys em EN e PT-BR.

---

## 9. Referências

- BMAD Method v6.2.0: https://docs.bmad-method.org / https://github.com/bmad-code-org/BMAD-METHOD
- GSD v1 clone: `/Volumes/Leo/Leo/IA/References/get-shit-done/`
- GSD v2 clone: `/Volumes/Leo/Leo/IA/References/gsd-2/`
- AIOX Core clone: `/Volumes/Leo/Leo/IA/References/aiox-core/`
- AIOX Squads clone: `/Volumes/Leo/Leo/IA/References/aiox-squads/`
- SpecKit clone: `/Volumes/Leo/Leo/IA/References/spec-kit/`
- Paperclip clone: `/Volumes/Leo/Leo/IA/References/paperclip/`
- Mega Brain clone: `/Volumes/Leo/Leo/IA/References/mega-brain/` ⚠️ SEM LICENÇA — conceitos apenas
