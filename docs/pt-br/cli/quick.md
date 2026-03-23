# buildpact quick

Tudo-em-um: da descrição ao código commitado em um único comando.

## Uso

```bash
buildpact quick "descrição" [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--discuss` | Fazer perguntas de esclarecimento antes de iniciar |
| `--full` | Executar o pipeline completo (specify, plan, execute, verify) |

## Exemplos

```bash
# Implementação rápida a partir de uma frase
buildpact quick "add dark mode toggle to settings page"

# Fazer perguntas de esclarecimento primeiro
buildpact quick "user auth with OAuth" --discuss

# Executar o pipeline completo com verificação
buildpact quick "REST API for products" --full
```

## Comandos Relacionados

- [`specify`](/pt-br/cli/specify) — Capturar um requisito como spec estruturada
- [`plan`](/pt-br/cli/plan) — Gerar um plano de implementação baseado em ondas
- [`execute`](/pt-br/cli/execute) — Executar o plano com isolamento de subagentes
