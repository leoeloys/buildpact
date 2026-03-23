# buildpact audit

Exportar e inspecionar trilhas de auditoria.

## Uso

```bash
buildpact audit [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--format` | Formato de saída: `json` ou `csv` |
| `--from` | Data de início para o filtro de intervalo |
| `--to` | Data de fim para o filtro de intervalo |

## Exemplos

```bash
# Exportar a trilha de auditoria completa
buildpact audit

# Exportar como CSV
buildpact audit --format csv

# Exportar um intervalo de datas como JSON
buildpact audit --format json --from 2026-01-01 --to 2026-03-01
```

## Comandos Relacionados

- [`quality`](/pt-br/cli/quality) — Relatório de qualidade inspirado na ISO 9001
