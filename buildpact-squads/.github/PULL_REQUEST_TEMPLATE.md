## Description / Descrição

<!-- EN: Briefly describe the Squad being added or the change being made. -->
<!-- PT-BR: Descreva brevemente o Squad sendo adicionado ou a mudança sendo feita. -->

Fixes # (issue)

---

## Type of Change / Tipo de Mudança

- [ ] New Squad / Novo Squad
- [ ] Update to existing Squad / Atualização em Squad existente
- [ ] Documentation fix / Correção de documentação
- [ ] Other / Outro: ___

---

## Checklist

### Squad Structure / Estrutura do Squad

- [ ] `manifest.json` is present in the Squad directory / `manifest.json` está presente no diretório do Squad
- [ ] `squad.yaml` is present in the Squad directory / `squad.yaml` está presente no diretório do Squad
- [ ] `README.md` is present in the Squad directory / `README.md` está presente no diretório do Squad
- [ ] `agents/` directory is present and contains at least one agent file / diretório `agents/` está presente e contém ao menos um arquivo de agente

### Voice DNA Compliance / Conformidade Voice DNA

Every agent file in `agents/` must include all 5 sections. Check each agent:

- [ ] **Role & Identity** — present in all agent files / presente em todos os arquivos de agente
- [ ] **Communication Style** — present in all agent files / presente em todos os arquivos de agente
- [ ] **Domain Knowledge** — present in all agent files / presente em todos os arquivos de agente
- [ ] **Decision Framework** — present in all agent files / presente em todos os arquivos de agente
- [ ] **Anti-Patterns** — present in all agent files (✘/✔ pairs) / presente em todos os arquivos de agente (pares ✘/✔)

### Security / Segurança

The `npx buildpact squad validate <squad-dir>` command checks the following — all must be green:

- [ ] No external URLs inside agent files / Sem URLs externas dentro dos arquivos de agentes
- [ ] No executable code blocks (`bash`, `eval`, `exec`, shell) / Sem blocos de código executável (`bash`, `eval`, `exec`, shell)
- [ ] No path traversal patterns (`../`, absolute paths) / Sem padrões de travessia de caminho (`../`, caminhos absolutos)
- [ ] No prompt injection patterns ("ignore previous instructions", etc.) / Sem padrões de injeção de prompt ("ignore as instruções anteriores", etc.)

### Bilingual Content / Conteúdo Bilíngue

> **Required if the Squad has user-facing text / Obrigatório se o Squad tem texto visível ao usuário**

- [ ] If `README.md` has usage instructions or descriptions: PT-BR and EN versions are both present at equal quality / Se `README.md` tem instruções de uso ou descrições: versões PT-BR e EN estão ambas presentes com qualidade equivalente
- [ ] If `squad.yaml` has user-facing description fields: bilingual content provided / Se `squad.yaml` tem campos de descrição visíveis ao usuário: conteúdo bilíngue fornecido
- [ ] If this Squad has no user-facing text beyond file structure: mark this section N/A / Se este Squad não tem texto visível ao usuário além da estrutura de arquivos: marque esta seção como N/A

### CI / Integração Contínua

- [ ] **Squad Validation** CI check is green (automated structural + security validation passes) / CI check **Squad Validation** está verde (validação estrutural e de segurança automática passou)

---

## Test Plan / Plano de Testes

<!-- List the validation commands you ran and what you verified manually -->
<!-- Liste os comandos de validação que executou e o que verificou manualmente -->

```bash
npx buildpact squad validate <squad-dir>
```

---

## Screenshots (if applicable) / Capturas de Tela (se aplicável)

<!-- Add screenshots for any notable aspects of the Squad's output or agent behavior -->
<!-- Adicione capturas de tela de aspectos notáveis da saída do Squad ou comportamento do agente -->
