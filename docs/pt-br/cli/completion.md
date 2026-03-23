# buildpact completion

Gerar scripts de autocompletar para o shell.

## Uso

```bash
buildpact completion [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--shell` | Shell alvo: `bash`, `zsh` ou `fish` |

## Exemplos

```bash
# Gerar autocompletar para zsh
buildpact completion --shell zsh

# Adicionar autocompletar do bash ao seu perfil
buildpact completion --shell bash >> ~/.bashrc

# Gerar autocompletar para fish
buildpact completion --shell fish
```

## Comandos Relacionados

- [`help`](/pt-br/cli/help) — Mostrar comandos e status do projeto
