# buildpact execute

Executar o plano com isolamento de subagentes.

## Uso

```bash
buildpact execute [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--plan` | Caminho para o diretório do plano |
| `--budget` | Sobrescrever o budget padrão |

## Exemplos

```bash
# Executar o plano atual
buildpact execute

# Executar um plano específico
buildpact execute --plan .buildpact/plans/auth-plan

# Executar com um budget personalizado
buildpact execute --budget 5.00
```

Cada tarefa recebe contexto isolado e um commit git atômico.

## Comandos Relacionados

- [`plan`](/pt-br/cli/plan) — Gerar um plano de implementação baseado em ondas
- [`verify`](/pt-br/cli/verify) — Teste de aceite guiado
