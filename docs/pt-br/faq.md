# Perguntas Frequentes

## Qual a diferença entre usar o BuildPact e usar Claude Code / Cursor diretamente?

O BuildPact adiciona **estrutura** por cima da sua ferramenta de IA. Em vez de prompts avulsos, você ganha um pipeline repetível com especificações, planos e verificação. A IA continua fazendo o trabalho — o BuildPact garante que ela faça o trabalho *certo* e que você possa comprovar isso.

## Preciso usar todas as 4 fases?

Não. Use o que fizer sentido:

- **Mudanças rápidas**: `buildpact quick "corrigir o bug de login"` (um comando só)
- **Features médias**: `buildpact specify` + `buildpact plan` + `buildpact execute`
- **Trabalho crítico**: Pipeline completo incluindo `buildpact verify`

## Posso usar o BuildPact para projetos que não são software?

Sim. O BuildPact suporta os domínios de marketing, saúde, pesquisa e gestão. O pipeline é o mesmo — especificar, planejar, executar, verificar — mas os squads, regras e vocabulário se adaptam ao seu domínio.

## E se eu discordar da spec ou do plano gerado?

Edite. O BuildPact gera arquivos Markdown que você pode modificar antes de avançar para a próxima fase. O plano não será executado até você autorizar.

## Como funciona o suporte bilíngue?

Você escolhe o idioma durante o `init` ou `adopt`. Todas as mensagens da CLI, erros e conteúdo gerado respeitam sua escolha. Para trocar, edite `language` no `.buildpact/config.yaml`.

## O BuildPact envia dados para servidores externos?

Não. O BuildPact é uma ferramenta CLI local. Ele gera arquivos na sua máquina e delega para a ferramenta de IA que você já usa. O BuildPact em si não faz nenhuma requisição de rede.

## Qual a diferença entre `init` e `adopt`?

- **`init`** = projeto novo do zero, templates genéricos
- **`adopt`** = projeto existente, escaneia seu stack e pré-preenche a configuração com base no que encontrar

## Quais provedores de IA funcionam com o BuildPact?

O BuildPact funciona com qualquer ferramenta de IA para código que suporte prompts baseados em Markdown: Claude Code, Cursor, Gemini CLI, Codex e outros. O framework é agnóstico a provedor — ele gera prompts e specs, sua ferramenta de IA faz a implementação.

## Como crio um squad personalizado?

```bash
buildpact squad create meu-squad-customizado
```

Isso gera a estrutura de diretórios. Preencha o `squad.yaml` (metadados), `agents/chief.md` (agente líder) e `agents/*.md` (especialistas). Valide com `buildpact doctor --smoke`.

## Como contribuir?

O BuildPact é open source sob licença MIT. Clone o repositório, instale as dependências com `npm install` e rode os testes com `npm test`. Veja o [Guia de Contribuição](https://github.com/leoeloys/buildpact) para detalhes.
