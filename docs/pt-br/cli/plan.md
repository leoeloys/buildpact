# buildpact plan

Gerar um plano de implementação baseado em ondas.

## Uso

```bash
buildpact plan [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--research` | Habilitar pesquisa paralela antes do planejamento |
| `--spec` | Caminho para um arquivo de spec |

## Exemplos

```bash
# Gerar um plano a partir da spec atual
buildpact plan

# Planejar com pesquisa paralela habilitada
buildpact plan --research

# Planejar a partir de um arquivo de spec específico
buildpact plan --spec .buildpact/specs/auth-spec.md
```

Gera um `plan.md` com ondas, resumo de pesquisa e etapas de validação.

## Comandos Relacionados

- [`specify`](/pt-br/cli/specify) — Capturar um requisito como spec estruturada
- [`execute`](/pt-br/cli/execute) — Executar o plano com isolamento de subagentes
