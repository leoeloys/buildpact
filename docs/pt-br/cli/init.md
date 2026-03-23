# buildpact init

Inicializar um novo projeto.

## Uso

```bash
buildpact init [nome] [opções]
```

## Opções

| Flag | Descrição |
|------|-----------|
| `--name` | Nome do projeto |
| `--lang` | Idioma (`en` ou `pt-br`) |

## Exemplos

```bash
# Inicializar com o assistente interativo de 6 etapas
buildpact init

# Inicializar com um nome de projeto
buildpact init my-app

# Inicializar com idioma pré-definido
buildpact init my-app --lang pt-br
```

O assistente de 6 etapas guia você por: idioma, localização, domínio, IDE, nível de experiência e seleção de squad.

## Comandos Relacionados

- [`adopt`](/pt-br/cli/adopt) — Integrar um projeto existente
- [`doctor`](/pt-br/cli/doctor) — Verificação de saúde
