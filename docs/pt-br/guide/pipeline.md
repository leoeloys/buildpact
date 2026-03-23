# O Pipeline

O BuildPact organiza o trabalho em um pipeline de 4 fases. Cada fase produz artefatos que alimentam a próxima:

```
  specify          plan            execute          verify
 ─────────>    ─────────>      ─────────>      ─────────>
   "o quê"       "como"        "executa"       "confere"

  spec.md     plan-wave-N.md   git commits    relatório de
  + ACs       + pesquisa       + log de        verificação
              + validação       auditoria
```

## Fase 1: Especificar

```bash
buildpact specify "adicionar toggle de dark mode na página de configurações"
```

Transforma sua descrição em linguagem natural em uma especificação estruturada:

- **User Story** — "Como [persona], eu quero [objetivo], para que [motivação]"
- **Critérios de Aceite** — Condições numeradas e testáveis
- **Requisitos Funcionais** — O que o sistema deve fazer
- **Requisitos Não-Funcionais** — Performance, segurança, acessibilidade
- **Autoavaliação Constitucional** — Como esta spec se relaciona com as regras do projeto

A **detecção de ambiguidade** identifica termos vagos como "rápido", "escalável", "fácil" e pede que você os defina.

Saída: `.buildpact/specs/{slug}/spec.md`

## Fase 2: Planejar

```bash
buildpact plan
```

Gera um plano de implementação com:

- **Pesquisa paralela** — Múltiplos agentes analisam seu stack e domínio simultaneamente
- **Tarefas baseadas em ondas** — Tarefas organizadas em ondas; tarefas na mesma onda rodam em paralelo
- **Detecção de etapas humanas** — Revisões de design e aprovações marcadas para ação manual
- **Validação Nyquist** — Verificações multi-perspectiva para ACs faltantes, dependências circulares e desvio de escopo

Saída: `.buildpact/plans/{slug}/plan.md` + arquivos de onda + resumo de pesquisa

## Fase 3: Executar

```bash
buildpact execute
```

Implementa o plano:

- Cada tarefa roda em um **contexto isolado de subagente**
- Cada tarefa concluída ganha um **commit git atômico**
- **Budget guards** verificam limites de gasto antes de cada onda
- **Verificação goal-backward** checa a saída de cada onda contra a spec
- Se um AC falha, um **plano de correção** é gerado automaticamente

Saída: Commits git + relatórios de verificação por onda

## Fase 4: Verificar

```bash
buildpact verify
```

Conduz você pelo Teste de Aceite do Usuário:

```
  AC-1: Toggle de dark mode visível na página de configurações
  Veredito: (Passou / Falhou / Pular) > Passou

  AC-2: Toggle persiste a preferência entre sessões
  Veredito: (Passou / Falhou / Pular) > Falhou
  O que deu errado? > Preferência reseta após atualizar o navegador

  Resultado: 1 passou, 1 falhou, 0 pulados
  Plano de correção gerado: .buildpact/specs/dark-mode/fix/plan-uat.md
```

ACs que falharam geram automaticamente um plano de correção que pode ser alimentado de volta no `buildpact execute`.

## Fluxo Rápido

Para tarefas menores, pule o pipeline completo:

| Variante | Comportamento |
|----------|--------------|
| `buildpact quick "..."` | Zero cerimônia — direto para código e commit |
| `buildpact quick "..." --discuss` | 3-5 perguntas de esclarecimento primeiro |
| `buildpact quick "..." --full` | Pipeline completo em um único comando |
