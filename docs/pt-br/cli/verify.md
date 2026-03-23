# buildpact verify

Teste de aceite guiado.

## Uso

```bash
buildpact verify [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--spec` | Caminho para a spec a ser verificada |

## Exemplos

```bash
# Verificar contra a spec atual
buildpact verify

# Verificar contra uma spec específica
buildpact verify --spec .buildpact/specs/auth-spec.md
```

Percorre cada critério de aceite e gera um plano de correção para quaisquer falhas.

## Comandos Relacionados

- [`execute`](/pt-br/cli/execute) — Executar o plano com isolamento de subagentes
- [`specify`](/pt-br/cli/specify) — Capturar um requisito como spec estruturada
