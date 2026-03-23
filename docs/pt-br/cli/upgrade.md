# buildpact upgrade

Migrar o schema do projeto para a versão mais recente.

## Uso

```bash
buildpact upgrade [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--dry-run` | Visualizar mudanças sem aplicá-las |

## Exemplos

```bash
# Atualizar o schema do projeto
buildpact upgrade

# Visualizar o que mudaria
buildpact upgrade --dry-run
```

Executa migrações sequenciais para atualizar a configuração do seu projeto.

## Comandos Relacionados

- [`doctor`](/pt-br/cli/doctor) — Verificação de saúde
