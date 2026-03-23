# buildpact optimize

Melhoria contínua com AutoResearch.

## Uso

```bash
buildpact optimize [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--budget` | Definir o budget do experimento |
| `--target` | Área alvo: `code`, `copy` ou `squad` |

## Exemplos

```bash
# Executar otimização com padrões
buildpact optimize

# Otimizar código com um budget específico
buildpact optimize --target code --budget 2.00

# Otimizar definições de squad
buildpact optimize --target squad
```

Utiliza uma estratégia de git ratchet para commitar apenas melhorias comprovadas, garantindo que a qualidade nunca regrida.

## Comandos Relacionados

- [`execute`](/pt-br/cli/execute) — Executar o plano com isolamento de subagentes
