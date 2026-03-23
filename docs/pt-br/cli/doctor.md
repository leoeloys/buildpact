# buildpact doctor

Verificação de saúde do seu projeto BuildPact.

## Uso

```bash
buildpact doctor [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--smoke` | Executar testes de fumaça do squad |

## Exemplos

```bash
# Executar uma verificação de saúde padrão
buildpact doctor

# Incluir testes de fumaça do squad
buildpact doctor --smoke
```

Verifica versão do Node.js, disponibilidade do Git, validade da configuração, definições de squad e integridade da constituição.

## Comandos Relacionados

- [`init`](/pt-br/cli/init) — Inicializar um novo projeto
