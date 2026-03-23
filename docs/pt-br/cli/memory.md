# buildpact memory

Gerenciar camadas de memória dos agentes.

## Uso

```bash
buildpact memory <subcomando>
```

## Subcomandos

| Subcomando | Descrição |
|------------|-----------|
| `list` | Listar todas as memórias armazenadas |
| `clear` | Limpar entradas de memória |
| `export` | Exportar memórias para arquivo |

## Camadas de Memória

1. **Feedback de sessão** — Contexto de curto prazo da sessão atual
2. **Lições e padrões** — Insights reutilizáveis aprendidos entre sessões
3. **Registro de decisões** — Decisões arquiteturais e de design com justificativa

## Exemplos

```bash
# Listar todas as memórias
buildpact memory list

# Limpar memórias de sessão
buildpact memory clear

# Exportar memórias
buildpact memory export
```

## Comandos Relacionados

- [`verify`](/pt-br/cli/verify) — Teste de aceite guiado
