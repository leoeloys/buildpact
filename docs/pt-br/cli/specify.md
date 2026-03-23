# buildpact specify

Capturar um requisito como spec estruturada.

## Uso

```bash
buildpact specify "descrição" [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--description` | Fornecer texto literal, pular modo interativo |

## Exemplos

```bash
# Captura de especificação interativa
buildpact specify "user auth with email"

# Não-interativo com descrição literal
buildpact specify --description "Add JWT-based authentication with email/password login"
```

Gera um `spec.md` contendo user story, critérios de aceite e requisitos.

## Comandos Relacionados

- [`plan`](/pt-br/cli/plan) — Gerar um plano de implementação baseado em ondas a partir de uma spec
