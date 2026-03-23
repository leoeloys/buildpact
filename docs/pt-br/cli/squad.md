# buildpact squad

Gerenciamento de squads.

## Uso

```bash
buildpact squad <subcomando> [opções]
```

## Subcomandos

| Subcomando | Descrição |
|------------|-----------|
| `create <nome>` | Criar scaffold de um novo squad |
| `validate [dir]` | Validar definições de squad |
| `add <nome>` | Adicionar agentes a um squad existente |

## Exemplos

```bash
# Criar um novo squad
buildpact squad create my-squad

# Validar o squad atual
buildpact squad validate

# Validar um diretório de squad específico
buildpact squad validate ./squads/backend

# Adicionar um agente a um squad
buildpact squad add reviewer
```

## Comandos Relacionados

- [`doctor`](/pt-br/cli/doctor) — Verificação de saúde
