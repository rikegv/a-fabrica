# OST 16, contrato do crachá por máquina

Escrito pelo coordenador em 25/11/2026, antes de despachar o time. É a fonte única do que muda na regra, na ponte e no painel. Nada é publicado sem a frase do diretor, §A.7.

## O que existe hoje, conferido no código e na nuvem
- A ponte entra como o diretor: `ponte/src/identidade.ts` troca o token de atualização guardado em `%USERPROFILE%\.a-fabrica-ponte\sessao.json` no endpoint de token. A regra (`firebase/firestore.rules`) só conhece `diretor()`, então a ponte pode tudo que o diretor pode, inclusive responder aprovação.
- Authentication do `a-fabrica-soulan`, lido pela API de administração, só leitura: subtipo `FIREBASE_AUTH` (não é Identity Platform), segundo fator `DISABLED`, nenhuma função de bloqueio, provedor anônimo DESLIGADO.
- A ponte já responde aprovação em três casos, sempre com `recusado`: tempo esgotado (`base.ts` `registrarRecusaPorTempo`), reconciliação na subida e encerramento pedido pelo painel. É recusa por segurança, nunca aprovação.

## Decisão de desenho do coordenador
O crachá é uma conta ANÔNIMA do Firebase Authentication, uma por máquina, mais um documento `crachas/{uid}` que só o diretor escreve. Por que este caminho:
- passa pela regra, como pede o item 4. Nada de conta de serviço, nada de kit de administrador, nada de Cloud Functions (o faturamento do projeto não pôde ser lido daqui e não é preciso);
- a conta pessoal do diretor nunca pousa na máquina nova, item 6: a máquina cria a própria conta anônima e pede o crachá; o diretor emite pelo painel, no navegador dele, com um clique;
- revogar é uma escrita do diretor em `crachas/{uid}`. A regra lê esse documento em toda escrita e leitura da ponte, então a revogação vale na hora e só para aquela máquina, item 7;
- o único ajuste de produção fora da regra é ligar o provedor anônimo, uma vez.

Rejeitado: token personalizado assinado pela conta de serviço (precisa de kit de administrador ou de transportar o token para a VM), conta de e-mail e senha por máquina (senha viaja para a VM e revogar pede o console).

## Fluxo do crachá
1. Na máquina, `npm run cracha` (ponte): entra anônima, guarda o token de atualização da conta anônima em `~/.a-fabrica-ponte/cracha.json` com a mesma tranca de `sessao.json`, sorteia um código de 6 dígitos, grava `pedidosDeCracha/{uid}` e mostra no terminal: o código, a máquina e o rótulo.
2. No painel, Configurações, situação da ponte: o diretor vê o pedido com o mesmo código, a máquina e o rótulo, e aperta "Emitir crachá". O painel grava `crachas/{uid}`.
3. A ponte, ainda no `npm run cracha`, espera até ler o próprio crachá ativo e diz "crachá emitido". Tempo esgotado em 15 minutos, falha fechada.
4. Dali em diante `npm start` entra com o crachá.

Regra da subida: com `cracha.json` presente, a ponte entra SÓ com o crachá e nunca abre `sessao.json`. Sem `cracha.json`, ela continua entrando como hoje, até a troca do notebook. Depois da troca, `sessao.json` é apagado pelo coordenador, por nome, §A.18, e a ponte sem crachá não sobe.

## Documentos novos
`pedidosDeCracha/{uid}`, criado pela conta anônima, uma vez:
- campos exatos: `uid` (igual ao id e ao `request.auth.uid`), `maquinaId` (`^maquina-[a-z0-9-]{1,40}$`), `nome` (texto até 60), `rotulo` (texto até 40 ou null), `codigo` (6 dígitos), `criadoEm` (hora do servidor);
- não muda, não se apaga, só o diretor lê.

`crachas/{uid}`, só o diretor cria e muda:
- `uid`, `maquinaId`, `rotulo`, `ativo: true`, `emitidoEm` (hora do servidor), `emitidoPor` (texto);
- muda uma vez só: `ativo` de true para false, com `revogadoEm` (hora do servidor) e `revogadoPor`. Revogado não volta; máquina revogada pede crachá novo;
- não se apaga. O próprio dono do crachá pode LER o seu documento, para a ponte saber se está ativo.

## O que o crachá pode, na regra
Função `cracha()`: `request.auth.token.firebase.sign_in_provider == 'anonymous'`, existe `crachas/{request.auth.uid}` com `ativo == true`. `minhaMaquina()` é o `maquinaId` desse documento.

| coleção | o crachá pode |
|---|---|
| `maquinas/{id}` | ler, criar e atualizar só quando `id == minhaMaquina()` e o campo `maquinaId`, se vier, é igual |
| `fabricas/{id}` | ler quando não existe ou é da minha máquina; criar com `maquinaId == minhaMaquina()`; atualizar só fábrica da minha máquina, sem trocar `maquinaId` |
| `fabricas/{id}/atividade` e `tarefas` | ler e criar só quando a fábrica-mãe é da minha máquina |
| `comandos` | ler só da minha máquina; marcar `entregue` só da minha máquina; nunca criar |
| `aprovacoes` | ler só da minha máquina; criar pedido `pendente` só da minha máquina; atualizar SÓ para `respondida` com `resposta == 'recusado'` e `respondidoPor` começando com `ponte`; NUNCA `aprovado` nem `aprovado com observacao` |
| `relatorios` | ler e criar só com `maquinaId == minhaMaquina()` |
| `crachas`, `pedidosDeCracha` | ler só o próprio crachá; nada mais |

Leitura em lista (consulta) só passa se a consulta filtrar por `maquinaId`. A ponte já filtra assim em quase todo lugar; onde não filtra (`relatoriosBase.ts` consulta relatórios por `fabricaId`, `base.ts` consulta aprovações por `fabricaId`), a ponte acrescenta o filtro.

O diretor continua podendo tudo que pode hoje: a ponte antiga do notebook segue funcionando no dia da publicação, e a troca acontece depois, sem parar nada.

Conta anônima SEM crachá ativo: só cria o próprio `pedidosDeCracha/{uid}` e lê o próprio `crachas/{uid}` (para saber que foi emitido). Nada mais.

## Ponte
- `ponte/src/cracha.ts` (novo): entrar anônima, pedir, esperar, guardar; entrar com o crachá na subida.
- `identidade.ts`: escolhe crachá quando `cracha.json` existe.
- `respondidoPor` da ponte passa a ser `ponte, <motivo>, <maquinaId>`, sem o e-mail do diretor, porque quem escreve já não é ele.
- consultas sem filtro de máquina ganham o filtro.
- na subida, a ponte com crachá confere que o `maquinaId` do crachá é o da configuração dela; diferente, não sobe.
- nada de Linux, nada de instalador. A ponte da nuvem usa este mesmo código quando a fábrica da nuvem fizer a parte dela, §A.25.

## Painel
- Configurações, situação da ponte: lista de máquinas com crachá (rótulo, emitido em, ativo ou revogado), pedidos abertos nos últimos 15 minutos com código, máquina e rótulo, botão "Emitir crachá" e botão "Revogar". Revogar pede confirmação na tela.
- Emitir um crachá para uma máquina que já tem crachá ativo avisa e oferece revogar o antigo.
- §A.22: toda ação responde na tela. §A.11: sem travessão.

## Publicação
`scripts/publicar.mjs` ganha `--cracha`, que liga o provedor anônimo no `a-fabrica-soulan` e confere que ficou ligado. A frase do diretor cobre regra, provedor e painel juntos.

## Fora de alcance
Linux, instalador, `ponte/ganchos/**`, a VM do escritório, o papel do OS Login (item 9 só depois da instalação na nuvem), índices novos (se a regra pedir índice, a fábrica para e propõe).

## Revisão do desenho pela segurança: APROVADO COM CONDIÇÕES
As condições valem como parte deste contrato.

Regra:
- R1: conferir `diretor()` primeiro, depois o que não lê documento (provedor `anonymous`, forma do id), e só então `get(crachas/uid)`.
- R2: `cracha()` exige o documento existindo, `ativo == true` e `uid == request.auth.uid`.
- R3: toda atualização do crachá usa `affectedKeys().hasOnly([...])`. Comando: `situacao`, `entregueEm`. Aprovação: `situacao`, `resposta`, `observacao`, `respondidoEm`, `respondidoPor`. Fábrica: qualquer campo menos `maquinaId` e `fabricaId`, que não mudam nem somem.
- R4: o crachá só recusa: `pendente` para `respondida`, `resposta == 'recusado'`, `respondidoEm == request.time`, `respondidoPor` exatamente `ponte, (tempo esgotado|reconciliacao|ordem do diretor pelo painel), <minhaMaquina>`, `observacao` texto até 300.
- R5: o painel passa a gravar `respondidoPor` começando com `painel`.
- R6: criar aprovação ou relatório, e criar ou atualizar em `atividade` e `tarefas`, confere que `fabricas/{fabricaId}` é da minha máquina.
- R7: criar fábrica exige `maquinaId == minhaMaquina()` e `fabricaId == id`. A ponte manda `maquinaId` na PRIMEIRA gravação de toda fábrica, inclusive `mao-<sid>`.
- R8: ler documento inexistente só em `fabricas` e `relatorios`.
- R9: consulta em lista só com filtro por `maquinaId`, com prova de que sem filtro é negada.
- R10: `maquinas/{id}` só com `id == minhaMaquina()`.
- R11: `pedidosDeCracha/{uid}`: uma vez, id igual ao uid, provedor anônimo, `criadoEm == request.time`, `codigo` `^[0-9]{6}$`, `nome` e `rotulo` só `^[A-Za-z0-9 ._-]{1,60}$` (o rótulo pode ser null), campos exatos.
- R12: `crachas/{uid}` criado pelo diretor só com pedido existente, mesmo `maquinaId` e pedido de menos de 15 minutos. Atualização só `ativo` true para false com `revogadoEm == request.time` e `revogadoPor`.
- R13: conta anônima sem crachá ativo só cria o próprio pedido e só lê o próprio crachá; prova no emulador.

Ponte:
- P1: com `cracha.json`, nunca abre `sessao.json`. Crachá revogado, ilegível ou de outra máquina: não sobe, registra o motivo. `PONTE_MAQUINA_ID` não sobrepõe o crachá.
- P2: `cracha.json` com a tranca de `sessao.json`, fora do repositório, token nunca em registro nem erro.
- P3: filtro de `maquinaId` em `recusarAprovacoesDaFabrica` e em `passadaDoDiario`.
- P4: `respondidoPor` sem o e-mail do diretor; `aprovacaoId` impossível de adivinhar.
- P5: `npm run cracha` mostra o código e os 8 primeiros caracteres do uid.
- P6: §A.9, nada fora de `~/.a-fabrica-ponte`, com prova antes e depois.

Painel:
- N1: emitir confere código e pedaço do uid; com mais de um pedido aberto para a mesma máquina ou o mesmo código, não emite e avisa possível falsificação.
- N2: lista de pedidos com `limit` 20 e janela de 15 minutos.
- N3: máquina com crachá ativo: emitir revoga o antigo na mesma gravação em lote; revogar revoga todos os ativos da máquina.
- N4: texto puro, sem `dangerouslySetInnerHTML`, nenhum link com dado da base.
- N5: §A.22 e §A.11.

Publicação:
- U1: só com a autorização de produção do diretor, `--project a-fabrica-soulan`.
- U2: `--cracha` liga só o provedor anônimo, grava a configuração antes e depois e prova que nada mais mudou.
- U3: `--conferir` depois.
- U4: depois da troca do notebook, além de apagar `sessao.json`, invalidar os tokens de atualização da conta do diretor (`validSince`). Isso desloga o navegador dele uma vez.
- U5: conferir que o `maquinaId` real casa com `^maquina-[a-z0-9-]{1,40}$`.

Limites declarados ao diretor: o texto do §A.6 muda e é ele quem muda; crachá sem segundo fator; o que faz quem rouba o `cracha.json` de uma máquina; revogar não apaga a conta anônima; spam de contas anônimas e custo de leitura (App Check fica como proposta); a recusa automática da ponte continua e ele deve confirmar que isso não é "gravar aprovação"; dentro da mesma máquina, fábrica e ponte seguem como o mesmo usuário.

## Quem faz o quê
- devops: `firebase/firestore.rules`, `firebase/testes/cracha.test.mjs` (prova no emulador, linha a linha da tabela, o que passa e o que é negado), `scripts/publicar.mjs` com `--cracha` e `--encerrar-sessoes-do-diretor`.
- ponte: `ponte/src/cracha.ts`, a escolha em `identidade.ts`, P1 a P6, R7, prova da ponte contra o emulador.
- frontend: tela de crachás em Configurações, R5, N1 a N5.
