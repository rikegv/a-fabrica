# OST 6, Bloco 1: ligar a ponte na base

Agente responsável: **agente ponte** (dono da ponte local, §A.15). Fez tudo o que está neste documento: o código de entrada do cliente, o porte para TypeScript, a instalação de um passo, o executor dos sete testes e esta prova. Não tocou em `painel/**`, `firebase/**`, `firebase.json`, `.firebaserc`, `CLAUDE.md`, `DIARIO.md` nem `TASKS.md`, que estavam com outros agentes ao mesmo tempo. Não rodou commit, push nem publicação de nuvem.

## O que foi solicitado

1. **Passo 1, código de entrada do cliente.** A ponte entra como o próprio diretor, sem chave de serviço, com login feito uma vez na instalação e renovado sozinho depois: sessão guardada em `%USERPROFILE%\.a-fabrica-ponte\sessao.json` com permissão só do usuário, configuração do cliente gravada pelo instalador fora do repositório, persistência própria para o SDK cliente, escada de credencial com dois degraus definidos pelo diretor, e conferência de que o usuário autenticado é o diretor com e-mail verificado. Proibido abrir porta ou escutar qualquer coisa, inclusive laço de retorno de OAuth.
2. **Passo 4, porte para TypeScript.** `base.mjs`, `claudeCode.mjs` e `ponte.mjs` em TypeScript de verdade, modo estrito, tipos nas entidades do contrato, sem `any` solto nos caminhos de decisão de aprovação, comando de verificação de tipos passando limpo, e as três ressalvas da segurança sobrevivendo idênticas e provadas.
3. **Passo 5, instalação de um passo testada de verdade.** O diretor roda uma coisa só; a instalação resolve ou diz o clique exato, nunca manda procurar em lista de pendências.
4. **Passo 3, os sete testes ao vivo** contra a base, sem simulação de base, com sessão viva do Claude Code, apontando para base real ou emulador por uma única variável de ambiente.

## O que foi feito

### Passo 1, a entrada do cliente

- **Persistência própria da sessão** (`ponte/src/persistenciaArquivo.ts`). O SDK do Firebase para navegador, rodando em Node, não persiste nada: é só memória. A ponte implementa a interface interna de persistência do SDK e a entrega em `initializeAuth`. Descoberta que custou tempo e está registrada no código: **o SDK exige uma classe, não uma instância**; com objeto ele quebra com `INTERNAL ASSERTION FAILED: Expected a class definition`. Com a classe, funciona, e a renovação de token passa a ser do próprio SDK.
- **Prova de que renova sozinho**: na segunda execução do login, o degrau que venceu foi `sessao-salva`, com a linha `token renovado pelo SDK para henrique.vieira@soulan.com.br`. O diretor não loga de novo.
- **Configuração fora do repositório** (`ponte/src/config.ts`). O instalador lê a configuração do cliente do próprio Firebase (`firebase apps:sdkconfig ... --project a-fabrica-soulan`, §A.20) e grava em `%USERPROFILE%\.a-fabrica-ponte\config.json`. A ponte só lê de lá. Sem o arquivo, a ponte **não sobe** e diz o que falta e o que rodar.
- **Pasta local fechada com icacls**, evidência real da máquina:

```
icacls C:\Users\Henrique\.a-fabrica-ponte /inheritance:r
icacls C:\Users\Henrique\.a-fabrica-ponte /grant:r Henrique:(OI)(CI)F
icacls C:\Users\Henrique\.a-fabrica-ponte
C:\Users\Henrique\.a-fabrica-ponte DESKTOP-5LR6BRG\Henrique:(OI)(CI)(F)
Processados com sucesso 1 arquivos; falha no processamento de 0 arquivos
```

- **Escada de credencial** (`ponte/src/identidade.ts`), abstração explícita, com degraus que declaram nome, descrição, fase e aplicabilidade. Ordem: `sessao-salva`, depois `token-do-firebase-cli` (degrau a), depois `colagem-na-instalacao` (degrau b). No modo emulador entra um degrau extra, `emulador-usuario-de-teste`, que não vale na nuvem.
- **Conferência de identidade**: a ponte lê as alegações do token (`email`, `email_verified`) e o cadastro do usuário. Se não for o e-mail do diretor, ou se o e-mail não estiver verificado, ela não sobe e registra o motivo.
- **Nada escuta.** Não existe servidor HTTP local, nem em 127.0.0.1. O degrau (b) troca a credencial colada no endpoint de token seguro por um POST de saída, e o degrau (a) só lê arquivo local. A regra do §A.6 ficou intacta por desenho, não por sorte.

### Passo 4, o porte para TypeScript

- Código novo em `ponte/src/*.ts`, compilado para `ponte/dist`, alvo Node 20 (`ES2022`, `module NodeNext`), modo estrito ligado com extras: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- Tipos das entidades do contrato em `ponte/src/tipos.ts`: `Maquina`, `Fabrica`, `PassoAtividade`, `Comando`, `Aprovacao`, `PacoteAprovacao`, `DecisaoPortao`, `Relatorio`, com os estados do §A.4 como tipos fechados.
- **Zero `any`**: busca por `: any`, `as any` e `<any>` em `ponte/src` não devolve nada. O que vem da base entra como `unknown` e passa por leitura segura (`textoDe`, `respostaDe`) antes de virar decisão. A única conversão ampla do código é a entrega da classe de persistência ao SDK, comentada no arquivo, e ela não decide aprovação.
- Verificação de tipos, saída real:

```
> a-fabrica-ponte@0.2.0 tipos
> tsc --noEmit -p tsconfig.json

exit=0
```

- **As três ressalvas sobreviveram e foram provadas ao vivo depois do porte** (`node dist/testes/prova-ressalvas.js`, rodada `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T0950-ost6-tres-ressalvas`):

```
modo fixado no codigo: default

RESSALVA 2, limpeza das variaveis de aninhamento
  variaveis de aninhamento neste processo: AI_AGENT, CLAUDECODE, CLAUDE_CODE_CHILD_SESSION, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_EXECPATH, CLAUDE_CODE_SESSION_ID, CLAUDE_EFFORT, CLAUDE_PID
  sobraram no ambiente entregue a sessao: nenhuma
  resultado: PASSOU

RESSALVA 1, verificacao do portao com isca, nas mesmas opcoes e ambiente
  prova: {"vivo":true,"chamado":1,"iscaExecutou":false}
  arquivo da isca existe: false
  resultado: PASSOU

RESSALVA 3, conferencia do modo fixado no evento init, com portao que recusa
  modo que veio no init: default
  modo conferido pela ponte: true
  portao chamado 1 vez(es), arquivo criado: false
  resultado: PASSOU

RESUMO: as tres ressalvas SOBREVIVERAM ao porte
```

- Continuam de pé, agora tipados: idempotência do comando em transação, heartbeat, reconciliação no reinício, trava de processo único por fábrica, e falha fechada em todos os caminhos.
- Os `.mjs` da OST 5 **não foram apagados**, §A.17. Foram movidos inteiros para `ponte/legado-mjs/`, com `LEIA.md` explicando por quê. Justificativa da escolha: deixar os dois no mesmo lugar é convite para um dia alguém subir a ponte pelo arquivo errado e perder as garantias que só o código novo tem. Mover deixa uma porta de entrada só, e `package.json` não aponta mais para nenhum `.mjs`.

### Passo 5, a instalação

`ponte/instalar.ps1` faz, numa rodada: fecha a pasta local, instala dependências, compila, pareia a máquina, grava a configuração do cliente lendo do Firebase, faz o login de uma vez, registra a tarefa agendada e sobe a ponte. Testada de verdade na máquina do diretor.

Tarefa agendada criada, saída real:

```
TaskName : A Fabrica Ponte
State    : Ready
Execute          : C:\Program Files\nodejs\node.exe
Arguments        : "C:\Users\Henrique\a-fabrica\ponte\dist\ponte.js"
WorkingDirectory : C:\Users\Henrique\a-fabrica\ponte
UserId           : DESKTOP-5LR6BRG\Henrique
CimClass         : MSFT_TaskLogonTrigger
```

Prova de que a ponte sobe, com o mesmo comando exato da tarefa agendada, base no emulador:

```
[identidade] identidade confirmada, henrique.vieira@soulan.com.br, pelo degrau sessao-salva
ponte entrou como henrique.vieira@soulan.com.br, degrau sessao-salva
reconciliacao no inicio: 0 pedido(s) recusado(s) por seguranca, 0 fabrica(s) marcada(s) como ponte offline
ponte no ar, maquina maquina-prova-instalacao (emulador)
```

E o sinal de vida chegando na base, lido do próprio Firestore:

```
"maquinaId": "maquina-prova-instalacao",
"estadoPonte": "online",
"vistoPorUltimo": "2026-10-13T12:52:09.349Z",
"versaoPonte": "0.2.0"
```

Com a base real, a mesma tarefa roda e a ponte **falha fechada**, porque ainda não existe sessão, e diz exatamente isso:

```
a ponte nao subiu.
nenhum degrau da escada de credencial entregou sessao. A ponte nao sobe sem identidade do diretor, §A.6.
Rode a instalacao da ponte para fazer o login uma vez.
```

A frase inaceitável da OST 5, que mandava o diretor procurar o comando na lista de pendências, saiu. No lugar, a instalação diz o clique exato:

```
Clique 1, uma vez so, no console do Firebase:
  abra https://console.firebase.google.com/project/a-fabrica-soulan/authentication/providers
  clique em Comecar, escolha Google na lista de provedores, clique em Ativar e depois em Salvar.
Passo 2, no terminal, nesta pasta:
  powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1
Passo 3, so se o passo 2 ainda recusar: abra o painel no navegador, ja logado como voce,
  copie a credencial de sessao que ele mostra e rode
  powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Colar
```

§A.9 cumprido: a instalação só acrescenta. Não encosta em configuração do Claude Code nem do Antigravity, e o arquivo do firebase-tools é lido, nunca escrito. O plano B do diretor continua de pé: ele abre o Claude Code na mão como sempre.

### Passo 3, os sete testes

Executor: `ponte/src/testes/sete-testes.ts`. Ele sobe a **ponte de verdade como serviço em processo separado**, com o mesmo `node dist/ponte.js` da tarefa agendada, e faz o papel do painel do outro lado da base: escreve comando, ouve atividade ao vivo, responde aprovação, lê estado. O Claude Code é sempre real, sessão viva.

Para onde aponta, **uma única variável de ambiente, sem mudar código**: com `PONTE_EMULADOR=1` vai para o emulador, sem ela vai para a base real do projeto `a-fabrica-soulan`.

Resultado da rodada, saída real resumida (rodada completa em `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T0948-ost6-sete-testes-emulador`):

```
TESTE 1 PASSOU: abrir fabrica pela ponte e a atividade chegando na base ao vivo. comando entregue true,
  estado final concluida, 4 evento(s) de atividade na base, 4 deles chegaram ao vivo, antes do fim,
  evento init presente true, consumo {...}
TESTE 2 PASSOU: comando gravado na base e a fabrica executando. comando entregue true, retomou a conversa
  4cfd2969-3ab, atividade nova depois do comando: 4 evento(s), novo evento de fim: true, estado final concluida
TESTE 3 PASSOU: pedido de aprovacao com pacote completo, aprovado pela base, e o comando executando.
  pedido 01be2bdd, campos faltando no pacote: nenhum, arquivo criado true, estado final concluida
TESTE 4 PASSOU: pedido recusado pela base, e nada executando. pedido 99a26a38 recusado,
  arquivo ...\projeto-cc\recusado.txt existe: false (tem de ser false), estado final concluida
TESTE 5 PASSOU: conexao caindo no meio, nada perdido, nada executado duas vezes. comando sobreviveu a ponte
  fora do ar: true; atividade com sequencia sem buraco: true (4 evento(s), sequencia 0,1,2,3);
  aberturas da fabrica: 1 (tem de ser 1); segunda tentativa de entrega do mesmo comando devolveu null,
  nao executa de novo; estado final concluida
TESTE 6 PASSOU: ponte parada, estado virando ponte offline na base.
  maquinas/maquina-teste-202610130948.estadoPonte = offline, fabricas/f6-685a8eb3.estado = ponte offline
TESTE 7 PASSOU: pedido pendente sobrevivendo a reinicio da ponte. pedido sobreviveu a parada: true;
  depois do reinicio a ponte resolveu como recusado com a trilha "ponte reiniciou, sessao encerrada,
  recusa por seguranca"; o arquivo que o agente queria escrever existe: false

RESUMO: 7 de 7 testes passaram
ROTULO HONESTO: base no emulador, sessao do Claude Code viva. NAO E o teste ao vivo contra a base real
que a OST pede.
```

**Leitura honesta, teste por teste:**

| Teste | Onde rodou | Veredito |
| --- | --- | --- |
| 1, abrir fábrica e atividade ao vivo | base no emulador, Claude Code vivo | passou. Contra a base real, **não rodou** |
| 2, comando gravado na base e fábrica executando | base no emulador, Claude Code vivo | passou. Contra a base real, **não rodou** |
| 3, aprovação com pacote completo, aprovada, comando executa | base no emulador, Claude Code vivo | passou. Contra a base real, **não rodou** |
| 4, mesma recusada, nada executa | base no emulador, Claude Code vivo | passou. Contra a base real, **não rodou** |
| 5, conexão caindo, nada perdido, nada em dobro | base no emulador, Claude Code vivo | passou. Contra a base real, **não rodou** |
| 6, ponte parada vira ponte offline | base no emulador, Claude Code vivo | passou. Contra a base real, **não rodou** |
| 7, pedido pendente sobrevive a reinício | base no emulador, Claude Code vivo | passou. Contra a base real, **não rodou** |

Nenhum dos sete rodou contra a base real, porque o Firebase Authentication do projeto ainda não foi inicializado. Checado duas vezes, no começo e no fim do trabalho, com a mesma resposta:

```
CHECAGEM NO COMECO   2026-10-13T12:19Z  HTTP 400  CONFIGURATION_NOT_FOUND
CHECAGEM NO FIM      2026-10-13T12:52:45Z  HTTP 400  CONFIGURATION_NOT_FOUND
RECHECAGEM FINAL     2026-10-13T12:57:40Z  HTTP 400  CONFIGURATION_NOT_FOUND
GET https://identitytoolkit.googleapis.com/v1/projects?key=...
{"error":{"code":400,"message":"CONFIGURATION_NOT_FOUND"}}
```

Comando exato, já pronto, para rodar os sete contra a base real no minuto seguinte ao clique do diretor:

```
cd C:\Users\Henrique\a-fabrica\ponte
npm run compilar
node dist\entrar.js
npm run testes
```

Regras operacionais cumpridas: cada rodada na sua pasta nova com data e hora no nome, nada sobrescrito e nada apagado (§A.17); a fila de pedidos e respostas vive dentro da pasta da rodada, em `fila\pedido-*.json` e `fila\resposta-*.json` (§A.19); as fábricas rodaram numa pasta de projeto criada dentro da própria rodada, nenhum projeto real do diretor serviu de cobaia; todo comando de firebase foi com `--project a-fabrica-soulan` explícito (§A.20).

Evidência de que o pacote de aprovação chega completo, recortada da fila da rodada (`fila\pedido-01be2bdd-....json`): `oQue`, `ferramenta`, `tarefa`, `fabrica`, `agenteDisse`, `porQue`, `impacto`, `oQueSeraTocado`, `risco` e `tempoParadoMs`, cada um com `valor` e `origem`, mais `origem` do pedido e `criadoEm`. Nesse pedido `agenteDisse` veio nulo porque o agente foi direto para a ferramenta sem narrar, e a ponte registra isso como fato em vez de inventar narrativa.

## O que ficou faltando

1. **Os sete testes contra a base real.** Dependem de um clique do diretor, descrito abaixo. O código, o executor e o comando estão prontos.
2. **Saber qual degrau da escada vence na base real.** Hoje os dois degraus de nuvem falham pelo mesmo motivo, que é o Authentication não existir no projeto, e não por recusa de credencial. Só depois do clique se descobre se o degrau (a) serve.
3. **A tela do painel para o degrau (b)**, que é proposta, não construção, §A.12. Veja a proposta abaixo.
4. **Validação visual do diretor**, §A.13. A ponte não tem interface, mas o efeito dela aparece no painel, e isso é do agente do painel.

## Decisões que tomei durante a execução

1. **Legado em pasta separada.** Mover `*.mjs` para `ponte/legado-mjs/` em vez de deixar junto do código novo, para existir uma porta de entrada só. Nada apagado.
2. **Sessão do emulador em arquivo separado** (`sessao-emulador.json`). A chave de persistência do SDK é formada por apiKey mais nome do aplicativo, igual nos dois mundos: sem separar, uma rodada de teste sobrescreveria a sessão real da nuvem.
3. **Portas próprias para o emulador**, Firestore 8099 e Auth 9199. Durante o trabalho havia outro emulador vivo nas portas padrão desta máquina, e a primeira tentativa morreu com `port taken`. Porta própria evita ler a base do projeto errado.
4. **`ponte/emulador/subir.ps1` copia as regras** de `firebase/firestore.rules` antes de subir, porque o firebase CLI recusa arquivo de regras fora da pasta do projeto. A fonte da verdade continua sendo `firebase/`, que eu só li. A cópia está fora do versionamento.
5. **Parada limpa também por linha na entrada de texto.** No Windows, sinal enviado a processo filho encerra sem passar pelo tratador, então sem isso a parada limpa não existiria de verdade e o teste 6 seria teatro. Ler a própria entrada de texto não abre porta.
6. **Trava de processo único mais esperta.** A trava da OST 5 prendia a fábrica para sempre se o processo dono morresse. Agora a trava guarda o pid e, se o dono não existe mais, pode ser reusada.
7. **`tempoParadoMs` no pacote**, medido como o tempo desde o último evento da fábrica até o pedido. É fato medido, e o campo é exigido pelo contrato. Entra na criação do pedido, porque a regra do Firestore proíbe mexer no pacote depois.
8. **`maquinaId` por variável de ambiente** nos testes, para a rodada não escrever na fila da máquina de verdade.
9. **Estado da fábrica vai para ponte offline na parada limpa**, e também na reconciliação do reinício, para o painel não mentir, §A.10.
10. **Parar o `entrar` com o aplicativo do Firebase fechado.** Sem isso o Node caía no encerramento e devolvia código 127 mesmo tendo dado tudo certo, o que fazia a instalação achar que o login havia falhado.

## Arquivos e áreas alteradas

Tudo dentro de `ponte/` e um documento novo em `docs/`.

Novos:
- `ponte/src/tipos.ts`, `ponte/src/config.ts`, `ponte/src/persistenciaArquivo.ts`, `ponte/src/identidade.ts`, `ponte/src/base.ts`, `ponte/src/claudeCode.ts`, `ponte/src/ponte.ts`, `ponte/src/entrar.ts`
- `ponte/src/testes/sete-testes.ts`, `ponte/src/testes/prova-ressalvas.ts`
- `ponte/tsconfig.json`, `ponte/.gitignore`
- `ponte/emulador/firebase.json`, `ponte/emulador/subir.ps1`, `ponte/emulador/LEIA.md`
- `ponte/legado-mjs/LEIA.md`
- `docs/ost6-ponte.md` (este documento)

Alterados:
- `ponte/package.json` (TypeScript, comandos novos)
- `ponte/instalar.ps1` (instalação de um passo de verdade)
- `ponte/README.md`

Movidos, sem apagar nada:
- `ponte/src/base.mjs`, `ponte/src/claudeCode.mjs`, `ponte/src/ponte.mjs` para `ponte/legado-mjs/`

Fora do repositório, na máquina do diretor:
- `%USERPROFILE%\.a-fabrica-ponte\config.json` (pareamento e configuração do cliente)
- `%USERPROFILE%\.a-fabrica-ponte\sessao.json` e `sessao-emulador.json` (sessões)
- `%USERPROFILE%\.a-fabrica-ponte\locks\` (travas por fábrica)
- tarefa agendada `A Fabrica Ponte`
- evidências em `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T09*-ost6-*`

## Problemas encontrados

1. **O SDK do Firebase exige classe de persistência.** Com objeto, quebra com `INTERNAL ASSERTION FAILED: Expected a class definition`. Resolvido, e o motivo está comentado no arquivo para ninguém refazer o caminho.
2. **Marca de ordem de bytes do PowerShell.** `Set-Content -Encoding utf8` grava BOM, e o `JSON.parse` do Node recusa. A ponte agora tolera o BOM na leitura, e o instalador grava sem BOM.
3. **Código de saída falso no login.** O Node caía no encerramento com os canais de rede abertos e devolvia 127 depois de um login bem sucedido. Resolvido fechando o aplicativo do Firebase antes de sair.
4. **Porta de emulador ocupada** por outro emulador vivo na máquina. Resolvido com portas próprias.
5. **O firebase CLI recusa regras fora da pasta do projeto.** Resolvido com a cópia feita pelo `subir.ps1`.
6. **Primeira versão do teste 2 era fraca:** a condição casava com o estado `concluida` que tinha sobrado do teste 1, então ela podia passar sem o segundo comando ter rodado. Corrigido para exigir atividade nova e um novo evento de fim depois do comando, e a rodada foi refeita em pasta nova. A rodada anterior ficou preservada, §A.17.
7. **Degrau (a) ainda não tem veredito.** O erro real das três tentativas, colado sem maquiagem:

```
id_token mais access_token: auth/configuration-not-found | Firebase: Error (auth/configuration-not-found).
so id_token:                auth/configuration-not-found | Firebase: Error (auth/configuration-not-found).
so access_token:            auth/configuration-not-found | Firebase: Error (auth/configuration-not-found).
```

Nota de honestidade sobre o arquivo do firebase-tools: o código da ponte **só lê** esse arquivo, a única escrita em arquivo que `identidade.ts` faz é a senha do usuário de teste do emulador, dentro da pasta da própria ponte. O arquivo do firebase-tools mudou de data durante o trabalho porque o próprio firebase CLI atualiza o depósito dele a cada comando que se roda, como o `apps:sdkconfig` e o emulador. Isso é comportamento do CLI do diretor, não escrita da ponte.

Isso não é recusa da credencial: é o projeto sem Authentication. O cliente OAuth do token é `563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com`, que é do firebase CLI e não do projeto, então continua de pé a chance de o Identity Toolkit recusar por audiência depois que o Authentication existir. É exatamente para isso que a escada tem o degrau (b).

## O que depende do diretor, com o passo pronto

**Único clique, e ele destrava a base real:**

1. Abrir `https://console.firebase.google.com/project/a-fabrica-soulan/authentication/providers`
2. Clicar em **Começar**
3. Em Sign-in method, escolher **Google**, clicar em **Ativar** e em **Salvar**

Depois disso, no terminal:

```
cd C:\Users\Henrique\a-fabrica\ponte
powershell -ExecutionPolicy Bypass -File instalar.ps1
```

Se o degrau (a) for recusado por audiência, a mesma instalação com `-Colar` resolve, e aí entra a proposta abaixo.

## Proposta ao diretor, o lado do painel do degrau (b)

Isto é **proposta**, §A.12. Não construí tela nenhuma no painel. O lado da ponte já está pronto para receber a colagem.

O que o painel precisaria mostrar, numa tela de configurações, item **situação da ponte** (F7):

- Um botão com o rótulo **Parear esta máquina** ou **Mostrar credencial de pareamento**, visível só para o diretor já logado.
- Ao clicar, o painel mostra numa caixa de texto de leitura, com botão de copiar, o **token de atualização da sessão do navegador**, que no SDK do cliente é `auth.currentUser.refreshToken`. Junto, o e-mail da conta e um aviso curto: esta credencial vale como a sua sessão, use uma vez na instalação da ponte e não guarde em arquivo.
- Opcionalmente, em vez do token puro, um JSON de uma linha com `{"refreshToken": "...", "email": "..."}`. A ponte aceita os dois formatos.
- O diretor cola isso na instalação com `-Colar`. A ponte troca a credencial por sessão própria no endpoint de token seguro, confere que a conta é a dele e que o e-mail está verificado, e grava a sessão. Dali em diante o SDK renova sozinho e a colagem nunca é repetida.

Se o diretor preferir não mostrar credencial em tela, a alternativa é uma Cloud Function que emita um token personalizado de curta duração para a própria conta, e o painel mostrar só um código de pareamento. Isso é mais trabalho e muda escopo, então fica como opção, não como recomendação.

## Próximo passo recomendado

1. O diretor dá o clique do Authentication, que é o único bloqueio real.
2. Rodar `npm run testes` na ponte contra a **base real** e colar a saída dos sete no diário. Se o degrau (a) for recusado, usar `-Colar` e registrar qual degrau venceu.
3. Com a base real provada, a Onda 2 fecha do lado da ponte, e o que sobra é o painel mostrar a fila de aprovação e a caixa de comando, que é de outro agente.
4. Depois disso, vale propor ao diretor um índice composto só se alguma consulta nova pedir. As consultas de hoje são todas de igualdade e não precisam de índice.
