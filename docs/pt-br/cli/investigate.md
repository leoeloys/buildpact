# buildpact investigate

Pesquisar domínio, codebase ou tecnologia.

## Uso

```bash
buildpact investigate [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--topic` | Focar a pesquisa em um tópico específico |

## Exemplos

```bash
# Investigar o codebase atual
buildpact investigate

# Pesquisar um tópico específico
buildpact investigate --topic "authentication best practices"

# Investigar uma tecnologia
buildpact investigate --topic "PostgreSQL indexing strategies"
```

## Comandos Relacionados

- [`plan`](/pt-br/cli/plan) — Gerar um plano de implementação baseado em ondas
- [`docs`](/pt-br/cli/docs) — Organizar a documentação do projeto
