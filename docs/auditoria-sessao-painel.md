# Auditoria da sessão aberta em painel/, antes da publicação

Feita em 25/11/2026 pela sessão da raiz, no papel de coordenador. A evidência fica em `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-11-25T1059-auditoria-sessao-painel`.

## Resposta curta
O portão NÃO foi alterado. `gate-deploy.sh`, `autorizar-producao.sh`, `liberar.sh`, `prova-gate.sh` e `.claude/settings.json` estão byte a byte iguais ao commit `0a67f27`, de 23/11. Não existe autorização sobrando em `.claude/state`, e a main no GitHub continua em `7d589fd`.

O achado que pede o diretor é outro. A sessão antiga criou na VM uma chave do GitHub **com escrita**. Ela foi cadastrada no repositório com `read_only=false`, e por isso a nuvem consegue escrever em qualquer ramo, a main inclusive.

## 1. O que a sessão antiga fez
Sessão `505e8cbc`, aberta em `C:\Users\Henrique\a-fabrica\painel`. Rodou de 24/11 09:47 a 23:13, com 92 usos de ferramenta, todos em `bypassPermissions`. Ela não despachou subagente. A lista inteira está em `sessao-antiga-usos-de-ferramenta.txt`.

**Portão e travas.** Os três arquivos são iguais ao histórico. O hash de cada um no disco é igual ao do HEAD e ao do `0a67f27`:

| arquivo | hash |
|---|---|
| `gate-deploy.sh` | `9b011de` |
| `autorizar-producao.sh` | `5dd8a60` |
| `.claude/settings.json` | `bdd3ed9` |

O último commit que tocou `scripts/` ou `.claude/` é o `0a67f27`. A data de gravação mais nova desses arquivos é de 23/11 09:41. A sessão só leu o `settings.json` e o começo do `gate-deploy.sh`.

**Autorizações.** Em `.claude/state` existe só o `README.md`. A sessão criou duas flags LEVES, `READY_ost12-regra-duas-fabricas` e `READY_ost12-painel-volta-sozinho`, e removeu cada uma depois do push. Ela não criou nenhuma PROD_.

**Pasta da ponte e credencial.** Nenhum comando abriu `%USERPROFILE%\.a-fabrica-ponte\sessao.json`, `config.json` ou outro arquivo dessa pasta. Na pasta `ponte\` ela só leu `registrar-tarefa.ps1` e a configuração da tarefa agendada. Também não alterou nada dentro de `ponte\`.

**O que foi para o GitHub.** Só o ramo `feature/ost5-madrugada` recebeu push:
- `ce0b123`, com a regra §A.25 no CLAUDE.md, empurrado às 22:12 de 24/11;
- `d8a6872`, com `painel/manter-no-ar.ps1` e `painel/registrar-tarefa.ps1`, às 23:01.

A main e os outros ramos não foram tocados. A base `a-fabrica-soulan` não recebeu nenhum comando: nada de Firebase, regra, índice ou hospedagem.

**O que ela fez fora do repositório, tudo dentro da OST 12 e pedido pelo diretor:**
- desligou o faturamento do `centradash-auth`, por ordem escrita do diretor às 19:58;
- criou o projeto `soulan-fabricas`, a rede, a VM `fabrica-1`, o alerta de gasto de R$ 1 e o firewall só pelo túnel;
- desligou o SSH e o RDP abertos da rede padrão.

**Achado 1, chave com escrita.** Às 01:11 UTC, a sessão pegou o token do GitHub do diretor no Gerenciador de Credenciais do Windows, pelo `git credential fill`, e com ele cadastrou a chave da VM no repositório: "fabrica-1 (VM soulan-fabricas)", com `read_only=false`, resposta 201. O token não apareceu em nenhuma saída. O diretor pediu "o menor acesso que resolver". Do jeito que está, a VM empurra para a main se a main não tiver proteção no GitHub, e eu não consegui conferir essa proteção daqui porque não há `gh` instalado. Não removi nem troquei a chave: é decisão do diretor.

**Achado 2, uso direto do token.** Pegar o token guardado e chamar a API com ele não passa por portão nenhum. Na raiz, o portão também não pegaria isso, porque o comando não tem palavra de push.

## 2. Prova do portão
`bash scripts/prova-gate.sh`: 50 casos PASSOU e nenhum FALHOU, com código de saída 0. A saída completa está em `prova-gate-saida.txt`.

## 3. Furo fechado
**Causa.** O Claude Code só lê `.claude/settings.json` da pasta onde a sessão foi aberta. O único settings que vale em toda pasta é o do usuário.

**Conserto.** Criei a guarda `scripts/guarda-subpasta.cjs` e a registrei no `~/.claude/settings.json` do usuário, em `UserPromptSubmit` e em `PreToolUse` com `*`. O registro só acrescenta, pelo §A.9: a diferença está em `depois/diferenca-settings.txt`, e a cópia de antes está em `antes/`. O que a guarda faz:
- a sessão aberta em qualquer subpasta do a-fabrica é recusada, tanto nas ordens quanto nas ferramentas, e a mensagem diz como reabrir na raiz;
- na raiz e fora do a-fabrica, ela não faz nada;
- a comparação é por fronteira de caminho, então `a-fabrica-lab` passa.

**Prova com sessões reais**, usando `claude -p --dangerously-skip-permissions`, o mesmo modo do diretor:

| pasta | antes | depois |
|---|---|---|
| `painel` | RODOU o texto com palavras de push | recusada pela guarda |
| `ponte` | RODOU | recusada pela guarda |
| `ponte\src` | | recusada pela guarda |
| `painel`, pedindo só leitura | | recusada pela guarda |
| raiz | | o portão bloqueou, como sempre |
| `a-fabrica-lab`, controle | | rodou, a guarda não interfere |

A prova da guarda sem sessão passou em 14 de 14 casos (`prova-da-guarda.mjs`).

**Limites declarados:**
- **Ramo sem o arquivo.** A guarda mora no repositório. Se alguém fizer checkout de um ramo que não tenha o arquivo, como a main hoje, o Claude Code só mostra erro do gancho e não recusa. Ela sobe neste ramo. Na main, entra quando o diretor mandar subir.
- **Escrita na guarda.** Ela não está na lista de travas da raiz, e a fábrica não pode editar `.claude/settings.json` para acrescentar. Proposta ao diretor: acrescentar `Edit(/scripts/guarda-subpasta.cjs)` nas travas.
- **Settings do usuário.** O `settings.json` do usuário não tem trava. Qualquer sessão pode tirar a guarda de lá, como poderia tirar o gancho do §A.23.
- **Sessões já abertas.** Sessões abertas antes da guarda podem não recarregar o settings. A sessão antiga parou às 23:13 de 24/11.

## 4. De onde veio o bypass
Foi ligado na mão, não por configuração. No histórico do PowerShell do Antigravity, a sequência foi:
1. `cd C:\Users\Henrique\a-fabrica\painel`, para subir o painel;
2. `npm run dev`;
3. `claude --dangerously-skip-permissions`, no mesmo terminal.

Assim, a sessão nasceu em `painel/` e em bypass.

Nenhuma configuração liga o bypass sozinha. Não há `defaultMode` no settings do usuário nem no do projeto, e não há perfil de PowerShell, apelido, atalho nem configuração do Antigravity com essa opção. O que existe é `"skipDangerousModePermissionPrompt": true` no settings do usuário: essa opção só tira o aviso de confirmação quando o bypass é pedido, não liga o bypass. Esta sessão da raiz também foi aberta com `--dangerously-skip-permissions`. Nada foi mudado.

## 5. Consumo movido do dia 24 para o dia 25
**Por quê.** A janela do diário vai das 20h às 20h de Brasília. As duas sessões gastaram depois das 20h de 24/11, então o consumo pertence ao dia 25. Só o campo `consumoPorDia` mudou. O consumo total da fábrica não foi tocado.

`mao-76486df0` (esta sessão da raiz):

| | input | output | cache criado | cache lido |
|---|---|---|---|---|
| antes, 24/11 | 6 | 1.393 | 5.529 | 332.118 |
| antes, 25/11 | 6 | 593 | 2.317 | 340.955 |
| depois, 24/11 | (sem chave) | | | |
| depois, 25/11 | 12 | 1.986 | 7.846 | 673.073 |

`mao-1f407a26`:

| | input | output | cache criado | cache lido |
|---|---|---|---|---|
| antes, 24/11 | 18 | 3.712 | 13.087 | 930.590 |
| depois, 25/11 | 18 | 3.712 | 13.087 | 930.590 |

As somas fecham. A evidência original está em `ponte/testes-ost13/rodada-2026-11-24-234846-consumo-janela/antes-e-depois.json`, e há uma cópia na pasta da auditoria.

## Depende do diretor
1. A chave da VM com escrita: trocar por uma só de leitura, ou manter e proteger a main no GitHub, em Settings, Branches. Daqui eu não consigo conferir se a main tem proteção.
2. Acrescentar a trava `Edit(/scripts/guarda-subpasta.cjs)` no `.claude/settings.json` da raiz. A fábrica não edita esse arquivo.
3. Abrir as sessões sempre da raiz. Agora a subpasta recusa sozinha.
