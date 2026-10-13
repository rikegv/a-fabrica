# OST 6, reauditoria de seguranca depois do Authentication ligado

Agente responsavel: **seguranca** (poder de veto, §A.15). Nao implementei, nao corrigi e nao
alterei arquivo nenhum fora deste documento. Nao rodei commit, nao subi branch, nao publiquei
nada. Nao respondi aprovacao nenhuma e nao escrevi na base, com uma excecao declarada e
deliberada: fiz tres TENTATIVAS de escrita sem sessao contra a base real, para provar que a
regra nega escrita e nao so leitura. Todas as tres voltaram 403, nada entrou na base.

Esta reauditoria e a condicao 10 do meu parecer anterior (`docs/ost6-seguranca.md`), que eu
mesmo coloquei como gatilho: eu disse que nao aprovo a Onda 2 sem reauditar os oito itens que
estavam aprovados por ausencia de login. O Authentication esta no ar, entao reauditei.

## O que eu NAO pude verificar, e por que

O `gcloud` e o Firebase CLI desta maquina perderam a credencial no meio do trabalho. Provei
isso, nao aceitei de ouvido:

```
$ gcloud auth print-access-token --project a-fabrica-soulan
ERROR: (gcloud.auth.print-access-token) There was a problem refreshing your current auth
tokens: Reauthentication failed. cannot prompt during non-interactive execution.
```

Logo, nesta rodada eu **nao consigo repetir nenhuma chamada administrativa** da primeira
auditoria. Ficou sem prova, por falta de credencial administrativa, exatamente isto, com o que
eu rodaria em cada caso:

| O que ficou sem prova | O que eu rodaria |
| --- | --- |
| Os bytes do conjunto de regras que esta publicado | `GET https://firebaserules.googleapis.com/v1/projects/a-fabrica-soulan/releases` e baixar o conjunto, comparando com `firebase/firestore.rules` |
| A lista de provedores habilitados no Authentication | `GET https://identitytoolkit.googleapis.com/admin/v2/projects/a-fabrica-soulan/config` |
| A lista de usuarios que existem no projeto | `firebase auth:export --project a-fabrica-soulan` |
| Estado de recuperacao a ponto no tempo e de protecao contra exclusao | `gcloud firestore databases describe --database="(default)" --project a-fabrica-soulan` |
| A politica de IAM do projeto, de novo | `gcloud projects get-iam-policy a-fabrica-soulan --project a-fabrica-soulan` |

Tudo o mais abaixo foi provado por mim, agora, por um destes tres caminhos, e cada item diz
qual: **NUVEM** (chave web publica que a hospedagem serve em `/__/firebase/init.json`, mais o
que a propria hospedagem entrega), **MAQUINA** (processos, portas, permissao de arquivo) ou
**LEITURA DE CODIGO** (codigo fonte, codigo compilado e historico do git). Onde a prova e de
outro agente, eu digo de quem e e digo se conferi o arquivo de evidencia.

---

## VEREDITO GERAL

**APROVADO COM RESSALVA.**

Nenhum furo novo. A decisao dura do diretor foi cumprida de verdade no codigo, e nao
maquiada. A trilha do tempo esgotado passou a dizer a verdade. As quatro condicoes que o
diretor fechou na rodada anterior fecharam de fato, conferidas uma por uma, inclusive a minha
condicao bloqueante 3: **nao ha nenhuma porta de entrada viva nesta maquina agora**. O que
sustenta a ressalva e o que falta de prova, nao o que foi achado de errado: o segundo fator
continua sem evidencia, os sete testes contra a base real continuam sem rodar, e a rede de
seguranca da trilha foi decidida e nao foi aplicada.

---

## A RESPOSTA DIRETA: A ONDA 2 PODE COMECAR?

**SIM para construir, NAO para ligar.** E a distincao e a coisa mais importante deste
documento, porque nao e meia resposta, sao duas respostas exatas.

**SIM, pode comecar a construir agora.** Escrever o codigo de escrita do painel, o contrato dos
documentos, a caixa de comando, a fila de aprovacao completa e o aviso no celular nao cria
superficie de ataque nenhuma enquanto nao houver credencial na ponte e enquanto o painel
publicado nao escrever. A reauditoria que eu exigia esta feita, e ela nao achou nada que a Onda
2 fosse herdar como defeito. A base esta endurecida, o portao esta duro, a ponte nao escuta
nada e o degrau de credencial perigoso morreu.

**NAO, nao pode ser LIGADA nem considerada entregue antes destas quatro coisas.** Nenhuma delas
e trabalho de agente, todas sao do diretor ou dependem dele, e nenhuma leva mais que minutos:

1. **Condicao 1, prova do segundo fator.** Esta e a trava dura, e eu explico por que ela muda de
   peso agora. Na Onda 1 a porta da leitura: quem passa por ela ve o painel. Na Onda 2 a mesma
   porta da **execucao na maquina do diretor**: quem passa manda comando e aprova chamada de
   risco. A minha propria doutrina diz que a protecao aqui e a porta de entrada, nao filtro de
   comando. Entao aprovar a Onda 2 com a porta sem prova seria aprovar um console de execucao
   remota guardado por uma barreira que ninguem verificou. Evidencia aceita: a tela de
   `myaccount.google.com/signinoptions/twosv` ou a politica do Workspace, guardada no diario.
2. **Condicao 11, os sete testes e a prova do tempo contra a base real.** Hoje a plataforma
   inteira esta provada no emulador e nao na nuvem. Detalhe no ponto 7.
3. **Condicao 12, decidir o que fazer com o arquivo de sessao, que na Onda 2 vira a chave de
   aprovacao.** Detalhe no ponto 4 e na condicao 12.
4. **Condicao 8, aplicar a recuperacao a ponto no tempo e a protecao contra exclusao**, que o
   diretor ja decidiu que quer. Detalhe no ponto 6.

Fora disso, o que bloqueia a main continua sendo a condicao 1 e passa a incluir a condicao 13,
que e tirar dos arquivos versionados a afirmacao de que o segundo fator esta exigido, enquanto
isso nao estiver provado.

---

## OS OITO ITENS DA LISTA ANTERIOR, UM POR UM

### Item 1, a recusa de outra conta na nuvem

**APROVADO COM RESSALVA, prova parcial. NUVEM para metade, EMULADOR mais LEITURA DE CODIGO para
a outra metade.**

**Provado por mim na NUVEM, agora, e indo mais longe do que a primeira auditoria foi.** Na
primeira rodada eu provei que quem nao tem sessao nao **le**. Agora provei tambem que quem nao
tem sessao nao **escreve**, e provei nas subcolecoes, com a chave web publica que a hospedagem
serve:

```
LEITURA sem sessao
  maquinas                     -> HTTP 403 "status": "PERMISSION_DENIED"
  fabricas                     -> HTTP 403 "status": "PERMISSION_DENIED"
  comandos                     -> HTTP 403 "status": "PERMISSION_DENIED"
  aprovacoes                   -> HTTP 403 "status": "PERMISSION_DENIED"
  relatorios                   -> HTTP 403 "status": "PERMISSION_DENIED"
  fabricas/qualquer/atividade  -> HTTP 403 "status": "PERMISSION_DENIED"
  fabricas/qualquer/tarefas    -> HTTP 403 "status": "PERMISSION_DENIED"

ESCRITA sem sessao (POST criando documento AUDITORIA-SEGURANCA-ost6-nao-deve-existir)
  comandos    -> HTTP 403 "status": "PERMISSION_DENIED"
  aprovacoes  -> HTTP 403 "status": "PERMISSION_DENIED"
  relatorios  -> HTTP 403 "status": "PERMISSION_DENIED"
```

As sete colecoes do §A.4, em leitura, e as tres que mais importam, em escrita. Nada entrou na
base.

**Tambem provado por mim na NUVEM, e e um achado bom que ninguem tinha medido:** um site de
terceiro **nao consegue** usar a chave publica deste projeto para pescar um token da conta do
diretor. Pedi ao Identity Toolkit um endereco de entrada apontando o retorno para um dominio
meu, e o Identity Toolkit montou o endereco, mas o Google recusou na porta dele:

```
POST .../v1/accounts:createAuthUri  (continueUri de dominio de fora, providerId google.com)
  -> devolveu authUri com redirect_uri=https://site-de-ataque-ost6.example.com

GET nesse authUri, seguindo redirecionamento:
  url final: https://accounts.google.com/signin/oauth/error?authError=...
  decodificado: redirect_uri_mismatch, "nao e possivel fazer login no app porque ele nao
  obedece a politica do OAuth 2.0 do Google. Se voce e o desenvolvedor do app, registre o
  URI de redirecionamento no Console do Google Cloud."
```

Quem protege esse flanco e a lista de enderecos de retorno registrados no cliente OAuth do
projeto, e ela esta fechada.

**O que continua SEM PROVA na nuvem, e eu nao vou aprovar no escuro:** outra conta **com sessao
de verdade** sendo barrada. Isso exige uma segunda conta Google real, que nem eu nem o agente do
painel temos, e fabricar uma seria criar usuario no projeto do diretor, o que eu nao faco. O que
existe no lugar, e eu digo exatamente o peso de cada camada:

1. **A regra**, LEITURA DE CODIGO, `firebase/firestore.rules:47-51`: comparacao de texto exata
   com o e-mail do diretor mais `email_verified == true`, mais o nega tudo final da linha 146.
   Esta e a camada que importa, porque e a que resiste a quem abre o console do navegador.
2. **O painel que esta no ar**, e aqui eu li o pacote publicado, nao o fonte. O trecho de decisao
   que esta servido agora, com `eS` sendo o e-mail do diretor e `ew.w7` sendo o `signOut`:
   `if((...e.email...).toLowerCase()!==eS||!e.emailVerified){ if(await (0,ew.w7)(n),!u.current)`
   `return; t(null),l(null),a("recusada"), ...`
   O `t(null),l(null)` zera usuario e base antes de qualquer ouvinte nascer. Ordem correta, no
   pacote que o mundo recebe.
3. **O emulador**, prova do agente frontend, cujos arquivos eu conferi na pasta da rodada: conta
   diferente recusada com zero pedido ao Firestore e zero usuario sobrando no deposito do
   navegador, e e-mail do diretor sem verificacao tambem recusado.

Nota de precisao que eu devo registrar: o painel compara com `toLowerCase()` e a regra compara
texto exato. Uma hipotetica alegacao de e-mail com maiusculas passaria pelo painel e seria negada
pela base, o que daria painel aberto e vazio, nao vazamento. A ponte escolheu o caminho oposto e
melhor, comparacao exata igual a da regra (`ponte/src/identidade.ts:291`). Nao e furo, e
inconsistencia de borda, e a base e a rede de seguranca.

### Item 2, quem pode criar conta no projeto

**APROVADO COM RESSALVA, e o estado real e melhor do que eu temia. NUVEM.**

Eu havia escrito que, com o provedor Google ligado, o padrao do Firebase deixaria qualquer um se
cadastrar. Medi, e o projeto esta mais fechado do que o padrao:

```
POST .../v1/accounts:signUp?key=<chave publica>  (e-mail e senha)
  HTTP 400  "message": "OPERATION_NOT_ALLOWED"      -> provedor de e-mail e senha DESLIGADO

POST .../v1/accounts:signUp?key=<chave publica>  (corpo vazio, cadastro anonimo)
  HTTP 400  "message": "ADMIN_ONLY_OPERATION"       -> entrada anonima DESLIGADA

GET .../v1/projects?key=<chave publica>
  HTTP 200  authorizedDomains: ["localhost","a-fabrica-soulan.firebaseapp.com",
                                "a-fabrica-soulan.web.app"]

POST .../v1/accounts:createAuthUri  (so com identifier)
  HTTP 200  devolveu apenas kind e sessionId, sem "registered" e sem "allProviders"
  -> a protecao contra enumeracao de e-mail esta ligada: a API nao diz se a conta existe
```

Correcao honesta de um numero do relatorio da ponte: ela registrou `ADMIN_ONLY_OPERATION` para
`accounts:signUp`. Com e-mail e senha no corpo, a resposta de agora e `OPERATION_NOT_ALLOWED`, que
e mais forte: nao e cadastro fechado dentro de um provedor ligado, e o provedor desligado. A
conclusao pratica da ponte continua certa, nenhum caminho de senha e nenhum caminho de link por
e-mail funciona hoje, e os tres dominios autorizados sao os tres certos.

**O que continua SEM PROVA:** que o provedor Google e o **unico** habilitado, e que uma conta
Google qualquer, ao entrar no endereco publico, cria um registro de usuario no projeto. O
primeiro exige leitura administrativa da configuracao do Authentication, que eu nao tenho. O
segundo e o comportamento padrao do Firebase, e nao existe no console uma lista de contas Google
permitidas: a conta estranha nasce no projeto, nao le nada por causa da regra, e e desconectada
pelo painel. A evidencia mais proxima disso e do emulador, onde a conta recusada **ficou
existindo** na lista de contas. Consequencia a registrar sem drama: a conta unica do §A.6 e
garantida pela **regra do Firestore**, nao pela camada de Auth. A lista de usuarios do projeto
pode ganhar curiosos, e isso nao da acesso a nada.

### Item 3, o segundo fator, §A.6

**NAO PROVADO, e agora pior que antes, porque tres arquivos afirmam o que ninguem provou. SEM
PROVA na nuvem, por impossibilidade tecnica, mais achado novo por LEITURA DE CODIGO.**

As regras do Firestore nao conferem segundo fator, o token do provedor Google nao carrega essa
informacao, e nenhum agente desta OST trouxe evidencia de que a conta do diretor exige segundo
fator. Nada mudou nisso. O que mudou e que, enquanto a condicao 1 segue aberta, tres arquivos
versionados ja afirmam a protecao:

```
painel/src/telas/Barreira.tsx:46
  "So a conta do diretor entra, pelo Google, que carrega o segundo fator."
painel/src/dados/autenticacao.ts:6
  "O Google e quem carrega o segundo fator da conta e entrega email_verified"
firebase/firestore.rules:41
  "segundo fator, exigido na camada de Auth, mais o nega tudo daqui"
```

A terceira e a mais grave das tres, por dois motivos. Primeiro, ela nao e so otimista, ela e
tecnicamente falsa: o segundo fator **nao** esta exigido na camada de Auth deste projeto, nada
aqui o exige, ele mora na conta Google do diretor, e e justamente por isso que eu nao consigo
verificar. Segundo, ela esta no arquivo de regras, que e o documento para onde qualquer auditoria
futura vai olhar primeiro. A primeira esta no HTML publico, que qualquer pessoa le. Condicao 13.

### Item 4, qual degrau da escada vence, e com que material

**APROVADO, e esta e a melhor noticia da rodada. LEITURA DE CODIGO no fonte e no compilado.**

Detalhe completo no ponto 2 abaixo, porque e um dos pontos que a OST pediu em separado. Resumo: o
degrau proibido saiu de verdade, a escada ficou com dois degraus de escopo puro de Firebase, e
nenhum caminho de codigo deste pacote alcanca o deposito do firebase-tools.

### Item 5, o arquivo de sessao da ponte com conteudo

**SEM PROVA, por impossibilidade: o arquivo continua vazio. MAQUINA.**

```
C:\Users\Henrique\.a-fabrica-ponte\sessao.json   81 bytes   13/10/2026 13:30:55
{ "versao": 1, "atualizadoEm": "2026-10-13T16:30:55.100Z", "entradas": {} }

icacls C:\Users\Henrique\.a-fabrica-ponte
  DESKTOP-5LR6BRG\Henrique:(OI)(CI)(F)
icacls C:\Users\Henrique\.a-fabrica-ponte\sessao.json
  DESKTOP-5LR6BRG\Henrique:(I)(F)
```

Heranca quebrada, um unico titular, sem SYSTEM, sem Administrators, sem Users, igual a primeira
auditoria. Nao existe token do diretor em disco nesta maquina neste momento. A reconferencia com
o arquivo cheio continua pendente, e ela e parte da condicao 11.

Prova adicional que eu fiz e que vale registrar: varri as doze pastas de rodada em
`C:\Users\Henrique\a-fabrica-lab\rodadas` procurando credencial, e o unico padrao que apareceu foi
a **chave web publica**, que a propria hospedagem serve a quem pedir. Nenhum token de atualizacao
de nuvem em pasta de prova. O relato de caso da colagem tambem esta limpo:
`grep -c "refresh" relato-caso-09.txt` devolveu `0`.

### Item 6, os sete testes contra a base real

**NAO EXECUTADOS, confirmado por mim, e nao por aceitar o relatorio. MAQUINA mais LEITURA DE
CODIGO.** Detalhe e consequencias no ponto 7, que e onde a OST pediu o julgamento.

### Item 7, o painel lendo a configuracao da hospedagem e entrando de verdade

**APROVADO na primeira metade, SEM PROVA na segunda. NUVEM.**

Provado por mim na NUVEM, repetindo a prova do frontend em vez de acreditar nela, e indo um passo
alem: baixei todos os nove arquivos de JavaScript e o CSS que o `index.html` publicado carrega, e
varri cada um:

```
/_next/static/chunks/117-fc53ebbd280db30e.js       124635 bytes  AIzaSy=0  authDomain=0
/_next/static/chunks/69806262-9b1bf237d90a1c6a.js   82175 bytes  AIzaSy=0  authDomain=0
/_next/static/chunks/943-d0fd642c66a592b1.js       106439 bytes  AIzaSy=0  authDomain=0
/_next/static/chunks/app/page-48755427e3a89250.js   60058 bytes  AIzaSy=0  authDomain=0
/_next/static/chunks/bc9e92e6-eefd28af5d48e094.js  156657 bytes  AIzaSy=0  authDomain=0
/_next/static/chunks/fd9d1056-88c8a1669018f964.js  172834 bytes  AIzaSy=0  authDomain=0
/_next/static/chunks/main-app-420f529edf8f0f74.js     461 bytes  AIzaSy=0  authDomain=0
/_next/static/chunks/polyfills-42372ed130431b0a.js 112594 bytes  AIzaSy=0  authDomain=0
/_next/static/chunks/webpack-41724c6f5ce24d04.js     3606 bytes  AIzaSy=0  authDomain=0
/_next/static/css/eccdd7b899fb3640.css              38607 bytes  AIzaSy=0  authDomain=0

index.html servido: 6704 bytes, ocorrencias de AIzaSy: 0
GET /__/firebase/init.json: HTTP 200, apiKey AIzaSy<mascarado>, projectId a-fabrica-soulan
```

Zero chave e zero `authDomain` em 858 mil bytes publicados, e a configuracao vem da hospedagem
porque nao existe outro lugar de onde ela possa vir. Isso fecha o item com prova de nuvem.

**O que continua SEM PROVA:** o painel entrando de verdade e lendo as cinco colecoes contra a
nuvem, com sessao real. Isso depende do clique do diretor, que nenhum agente pode dar. O frontend
levou a prova ate a tela do `accounts.google.com`, sem nenhum erro de dominio nem de configuracao,
e eu conferi os arquivos da rodada dele. Dali para frente e o diretor.

### Item 8, a regra de escrita do painel na Onda 2

**AINDA NAO AUDITAVEL, porque o codigo nao existe, e o pacote publicado prova que nao existe.
LEITURA DE CODIGO mais NUVEM.**

No fonte: `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `runTransaction` e `writeBatch` em
`painel/src` e `painel/app`, zero ocorrencias. Conferi por mim.

E uma prova melhor que a do fonte, feita contra o que esta no ar: procurei nos nove arquivos
publicados os nomes das chamadas remotas do Firestore. O unico que existe e o de **escuta**:

```
bc9e92e6-eefd28af5d48e094.js   "firestore.v1.Firestore"=1   "Listen"=1   "Write"=0   "Commit"=0
(nos outros oito arquivos, todos os quatro contadores sao zero)

trecho: [this.Do,"/","google.firestore.v1.Firestore","/",e,"/channel"]
```

O painel que esta publicado nao carrega o caminho de escrita do Firestore. Nao e so que ele nao
escreve: ele nao saberia escrever. Quando a Onda 2 acrescentar a primeira escrita isso muda, e e
por isso que a primeira escrita do painel precisa de auditoria propria, com o roteiro que o
`docs/ost6-painel.md` ja deixou: hora do servidor obrigatoria, `respondidoPor` preenchido, pacote
completo para criar comando e transicao de situacao unica.

---

## PONTO 1, O ESTADO DO AUTHENTICATION, CONFERIDO POR MIM

**CONFIRMADO, e melhor do que o relatado. NUVEM, pelo lado do cliente, com a chave web publica.**

O Authentication existe, o provedor de e-mail e senha esta desligado, a entrada anonima esta
desligada, a protecao contra enumeracao de e-mail esta ligada, os tres dominios autorizados sao os
certos e um dominio de fora e recusado pelo proprio Google. Evidencia colada nos itens 1 e 2 acima.
O que nao deu para conferir, por falta de credencial administrativa, e a lista de provedores
habilitados e a lista de usuarios do projeto, com os comandos ditos na secao de abertura.

## PONTO 2, A DECISAO DURA DO DIRETOR FOI CUMPRIDA DE VERDADE?

**APROVADO. A remocao e real e completa. LEITURA DE CODIGO no fonte e no compilado.**

Eu procurei o caminho de volta, nao a promessa. Em `ponte/src` inteiro, pelos termos que
importariam se alguem tivesse deixado uma porta: `lerTokensDoFirebaseCli`,
`CAMINHO_FIREBASE_TOOLS`, `TokensDoCli`, `configstore`, `GoogleAuthProvider`,
`signInWithCredential`, `cloud-platform`, `cloudplatform`, `auth/firebase`, `googleusercontent` e
`.config/`:

```
ponte\src\identidade.ts:17:// firebase-tools foi REMOVIDO, nao desligado: nao existe mais funcao, constante,
ponte\src\identidade.ts:19:// diretor: aquele token carrega escopo de nuvem (cloud-platform) muito maior do que
```

Duas linhas, as duas comentario explicando a remocao. Nenhuma linha de codigo. Repeti no
compilado, que e o que roda de verdade, e o resultado e o mesmo:

```
dist/identidade.js:17:// firebase-tools foi REMOVIDO, nao desligado: nao existe mais funcao, constante,
dist/identidade.js:19:// diretor: aquele token carrega escopo de nuvem (cloud-platform) muito maior do que
```

Nao ficou bandeira, nao ficou variavel de ambiente, nao ficou funcao orfa e nao ficou resto
comentado que alguem religue: o que esta comentado e a **explicacao**, nao o codigo. A escada:

```
ponte/src/identidade.ts:437
export const ESCADA: Degrau[] = [degrauEmulador, degrauColagemNaInstalacao];
ponte/dist/identidade.js:343
export const ESCADA = [degrauEmulador, degrauColagemNaInstalacao];
```

Fonte e compilado estao em dia, e o compilado e mais novo que o fonte (`identidade.ts` 13:23:03,
`identidade.js` 13:39:27).

**A lista completa de rede da ponte, conferida por mim e confirmada.** Busquei em `ponte/src`
inteiro por `fetch(`, endereco `http`, `createServer`, `.listen(`, `.bind(`, `WebSocket`, `net.`,
`http.Server`, `0.0.0.0`, `ngrok`, `localtunnel` e `cloudflared`. Fora dos testes existem
exatamente tres coisas, todas de saida:

```
ponte/src/identidade.ts:153  fetch POST https://securetoken.googleapis.com/v1/token?key=...
                             troca do token de atualizacao por sessao, so no degrau de colagem
ponte/src/identidade.ts:384  fetch POST para o emulador local, so com PONTE_EMULADOR=1
ponte/src/entrar.ts:123      um console.log com o endereco do painel, texto na tela, nao chamada
```

Mais os ouvintes do Firestore, que sao conexao de saida persistente do SDK. **Zero** ocorrencia de
qualquer forma de escutar porta, em `ponte/src`, em `ponte/src/testes`, em `ponte/emulador`, em
`ponte/instalar.ps1` e em `ponte/package.json`. O emulador de teste continua com o host
`127.0.0.1` escrito nas quatro portas (auth 9199, firestore 8099, hub 4499, logging 4599), e so
sobe quando uma pessoa manda subir.

Nenhum escopo de nuvem e pedido em lugar nenhum, porque a ponte nao fala com nenhuma API de
nuvem: ela fala com o Firebase deste projeto, e nada mais. O §A.9 ganhou de graca com isso: a
ponte agora nao le **nenhum** arquivo de configuracao do diretor, nem para leitura.

**Dois detalhes que eu conferi porque sao onde credencial costuma vazar, e os dois estao certos.**
A colagem entra pela entrada padrao do processo (`createInterface` em `entrar.ts:49`), nunca como
argumento de linha de comando: `instalar.ps1:126-129` chama `node dist/entrar.js --colar` e nada
mais, logo a credencial nao aparece na lista de processos nem no historico do PowerShell. E a
gravacao da sessao acontece so depois de tudo conferido (`identidade.ts:340`), o que a prova de
dez casos do agente da ponte mostra com zero entrada gravada em todos os caminhos de erro.
Conferi o arquivo de evidencia dessa prova, nao so o relatorio: o `saida.txt` da rodada
`2026-10-13T1324-ost6-prova-colagem` tem 28 linhas de PASSOU, zero de FALHOU, e termina com
`sessao gravada na pasta da prova no fim: 0 entrada(s)`.

Observacao honesta, de baixa gravidade, que eu nao vou inflar: a colagem e lida com eco na tela,
porque e uma colagem. A credencial aparece no terminal e fica no rolo do terminal enquanto a
janela existir. Nao vai para arquivo nenhum, isso esta provado. Recomendacao de uso, nao condicao:
fechar a janela depois.

## PONTO 3, A TRILHA DO TEMPO ESGOTADO FICOU CERTA?

**APROVADO. LEITURA DE CODIGO mais EMULADOR (prova do agente da ponte, arquivo conferido por
mim).**

Tres coisas tinham de ser verdade. As tres sao.

**Primeira, a recusa fica gravada com hora do servidor e origem.** `ponte/src/base.ts:175-202`,
`registrarRecusaPorTempo`, grava situacao respondida, resposta recusado, `respondidoEm` com
`serverTimestamp()`, `respondidoPor` igual a "ponte, tempo esgotado, <e-mail do diretor>" e uma
observacao em portugues dizendo que foi recusa por tempo e nao resposta do diretor. Conferi contra
a regra publicada, campo por campo: a atualizacao toca situacao, resposta, observacao,
`respondidoEm` e `respondidoPor`, e **nao** toca `fabricaId`, `maquinaId`, `pacote`, `criadoEm` nem
`origem`, que sao exatamente os cinco campos que a funcao `mantem` exige preservados em
`firestore.rules:134`. A hora e do servidor porque a linha 132 exige `respondidoEm ==
request.time`. Ou seja, a trilha nova nao e escrita por fora da regra, ela passa pela regra.

**Segunda, a resposta tardia do diretor e mesmo negada pela base.** Isto e o que eu havia apontado
como trilha que mentia, e e o ponto que fecha a ressalva. A regra de aprovacoes so aceita
atualizacao de documento que ainda esteja pendente (`firestore.rules:129`). Depois da recusa por
tempo o documento esta respondida, logo a tentativa tardia morre na regra. A prova ao vivo esta no
arquivo da rodada, que eu abri:

```
C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T1327-ost6-tempo-esgotado-emulador\saida.txt
  respondidoPor: ponte, tempo esgotado, henrique.vieira@soulan.com.br
  resposta tardia do diretor: negada pela base: 7 PERMISSION_DENIED
  o arquivo que o agente queria escrever existe: false (tem de ser false)
  PASSOU: tempo esgotado deixa trilha na base, com recusa por tempo, hora do servidor e origem,
          e nada executou
```

**Terceira, a trilha diz a verdade sobre quem recusou.** Diz "ponte, tempo esgotado, <diretor>", e
e a verdade literal: quem negou foi a ponte, por tempo. Fica de pe o limite que eu ja havia
registrado e que nao muda: sob conta unica, `respondidoPor` e texto que o cliente escreve, e
nenhuma regra pode provar que quem escreveu "ponte" foi a ponte. A origem na trilha e declaracao
conferida por forma, nao por identidade. Consequencia aceita de nao usar chave de servico.

**E o painel nao oferece mais resposta para pedido ja decidido**, que era a segunda metade da
minha condicao 4. Conferi no codigo: `painel/src/dados/tradutor.ts:324-326`, a funcao
`aprovacaoPendente` exige situacao pendente **e** ausencia de resposta, e
`painel/src/dados/painel.ts:56` filtra a fila por ela. Pedido recusado por tempo desaparece da
fila sozinho.

**Uma observacao tecnica honesta, que nao e furo e eu nao vou vender como tal.** No tempo
esgotado, a devolucao da recusa passou a acontecer **dentro** do `then` da gravacao
(`base.ts:218-220`). Se a gravacao nunca se resolver, por exemplo com a rede caida, a decisao nao
e devolvida e a sessao fica parada, em vez de receber a recusa limpa. Em termos de seguranca
continua fechado, porque nada executa sem resposta, e na pratica o proprio ouvinte local do
Firestore enxerga a escrita pendente e resolve a recusa na hora. Mas o caso de rede caida com
pedido pendente nunca foi exercitado, e por isso ele entra na condicao 11.

Prazo de cinco minutos: continua decisao do diretor, §A.12, e o agente da ponte agiu certo em nao
mexer. O `LIMITE_APROVACAO_MS` (`base.ts:154-158`) aceita ajuste por ambiente apenas entre 1
segundo e 1 hora, e qualquer valor resulta sempre em recusa, entao mexer nisso nao afrouxa nada.
Conferido por leitura.

## PONTO 4, O ACHADO NOVO DA PONTE: TOKEN QUE NAO MORRE E REVOGACAO QUE NAO EXISTE

**O achado e verdadeiro e e serio, mas nao e veto. Tamanho: alto se o arquivo for roubado, baixo
de acontecer hoje. LEITURA DE CODIGO mais raciocinio sobre o produto.**

Primeiro, o tamanho real, dito sem suavizar, porque o agente da ponte descreveu o mecanismo e nao
descreveu a consequencia inteira.

**O que o token permite.** O que vai ficar no disco e um token de atualizacao do Firebase deste
projeto. Quem o rouba vira o diretor dentro do alcance das regras, isto e, as sete colecoes deste
projeto. Isso nao e so leitura: **com esse token da para responder aprovacao**. Sob conta unica, a
regra nao distingue ponte de painel, entao quem tem o token escreve
`situacao: respondida, resposta: aprovado` num pedido pendente, e a ponte, que confia na base,
executa a chamada de risco. Dito na linguagem do §A.6: a partir da colagem, o arquivo
`%USERPROFILE%\.a-fabrica-ponte\sessao.json` passa a valer como a **chave de aprovacao** do
sistema. Hoje isso e teorico, porque o arquivo esta vazio, provado no item 5.

**O que o diretor perde.** Tres coisas concretas:

1. **O segundo fator deixa de proteger esse caminho.** Segundo fator protege a **entrada**. Token
   de atualizacao e credencial ao portador: quem o apresenta nao passa por fator nenhum. Entao a
   protecao da porta, que e a protecao que este projeto escolheu, nao cobre o arquivo em disco.
2. **Sair do navegador nao desliga nada**, e trocar a senha do Google tambem nao e caminho
   confiavel aqui, porque a sessao do Firebase nao nasce de senha. O que funciona com certeza e
   desativar ou apagar o usuario no Authentication, ou chamar a revogacao de tokens pelo lado
   administrativo.
3. **A revogacao nao e granular.** Qualquer um desses caminhos derruba **tudo** de uma vez: a
   ponte e o proprio painel do diretor, no computador e no celular. Nao existe hoje desligar a
   ponte e continuar logado.

**O que ele pode fazer, em ordem de custo.**

1. **Desligar a ponte, hoje, com duas acoes locais e sem nuvem:** parar a tarefa agendada
   `A Fabrica Ponte` e apagar, nomeado e por extenso,
   `C:\Users\Henrique\.a-fabrica-ponte\sessao.json`. Isso tira a ponte do ar na hora, §A.18. O que
   isso **nao** faz e invalidar uma copia que alguem ja tenha levado.
2. **Revogar de verdade, quando for preciso:** desativar o usuario no Authentication, entrar de
   novo e colar outra vez. Custo: o painel para junto, e a nova colagem.
3. **Comprar revogacao com um clique, se ele quiser:** e a opcao B do relatorio da ponte, o fluxo
   de dispositivo com cliente OAuth proprio. Eu confirmo o enquadramento do agente da ponte: esse
   fluxo e feito de perguntas de saida e nao escuta nada, logo nao viola o §A.6, e coloca o acesso
   da ponte na pagina de permissoes da conta Google, de onde ele revoga de qualquer lugar. O preco
   e configuracao no console, codigo novo e a incerteza de audiencia que o proprio relatorio
   admitiu. Isso e decisao dele, nao minha, e eu nao peco como condicao.
4. **O que eu peco como condicao** e mais barato que tudo isso e esta na condicao 12: decidir, por
   escrito, o que acontece com esse arquivo depois que ele tiver token, sabendo que uma fabrica
   pode ler arquivo da maquina sem passar pelo portao.

**Por que eu nao veto.** Porque a alternativa e pior e ja foi vetada com razao: chave de servico
ignora as regras e nao expira. Porque o alcance do token e exatamente o alcance das regras, e nao
a nuvem inteira, que era o que o degrau proibido trazia. E porque o modelo de ameaca deste sistema
e um usuario, uma maquina: quem le esse arquivo ja executa codigo como o diretor. O que muda na
Onda 2, e por isso a condicao 12 existe, e que a **fabrica** passa a ser um programa que roda como
o diretor e que o diretor nao escreveu linha por linha.

## PONTO 5, AS PROVAS DO FRONTEND, CONFERIDAS E NAO ACREDITADAS

**APROVADO no conteudo, com uma correcao de fato que eu achei e ele nao sabia. NUVEM.**

As quatro provas que a OST mandou conferir:

1. **Nenhuma chamada ao Firestore sem usuario.** Confirmado. A prova de rede dele e do navegador
   dele, e eu nao a repeti com navegador. O que eu fiz foi melhor para o meu proposito: li no
   **pacote publicado** que o caminho de escrita do Firestore nao existe (item 8) e que o ouvinte
   so nasce com base nao nula, e provei na nuvem que a base nega leitura e escrita sem sessao
   (item 1). As tres coisas juntas fecham o item sem depender da palavra dele.
2. **Pacote publicado sem chave.** Confirmado por mim, nos dez arquivos servidos, 858 mil bytes,
   zero `AIzaSy` e zero `authDomain` (item 7).
3. **Janela do Google abrindo sem erro de dominio.** Confirmado indiretamente e por caminho
   proprio: os dominios autorizados sao os tres certos, e a entrada pelo provedor Google esta
   configurada, o que o Identity Toolkit confirma ao devolver `forExistingProvider: true` para
   `providerId: google.com`. A foto da tela do Google e dele, e eu a aceito como ilustracao, nao
   como a prova que sustenta o item.
4. **Zero escrita no Firestore com o Auth no ar.** Confirmado, e com prova mais forte que a dele:
   o pacote que esta no ar nao carrega o nome da chamada de escrita do Firestore. Nao ha o que
   disparar.

**A correcao de fato, e ela importa para quem for publicar.** O frontend decidiu nao reconstruir
`painel/out` para a pasta continuar igual ao que esta no ar, e escreveu que ela "segue exatamente
como foi publicado". **Isso deixou de ser verdade depois que ele escreveu.** Medi:

```
chunk citado no index SERVIDO ......... page-48755427e3a89250.js   (contem o texto antigo)
chunk citado no index do DISCO ........ page-a2740b0dd7613fa8.js   (contem o texto novo)
painel/out/index.html no disco ........ 13/10/2026 13:36:32
painel/src/dados/autenticacao.ts ...... 13/10/2026 13:27:36
index.html servido, Last-Modified ..... 13/10/2026 13:33:09
diff do index servido com o do disco .. DIFEREM
```

A leitura certa disso e inocente: alguem reconstruiu o pacote as 13:36 para publicar, e a
publicacao nao aconteceu porque o Firebase CLI tinha perdido a credencial, que e exatamente o que
o diretor relatou. Consequencia pratica: a varredura do frontend sobre `painel/out` deixou de ser
evidencia do que esta no ar. A minha varredura, feita contra os arquivos servidos, substitui essa
evidencia e chega ao mesmo veredito. Fica a condicao 14 para que isso nao se repita.

**O texto de recusa que nao esta publicado tem consequencia de seguranca? NAO. E so texto, e eu
provei lendo o pacote que esta no ar**, nao o fonte. No pacote publicado, o ramo de recusa testa
o e-mail e o `emailVerified` juntos e, nos dois casos, chama `signOut` e zera usuario e base antes
de qualquer outra coisa. O comportamento publicado e identico ao do fonte corrigido; o diff do
fonte confirma, sao oito linhas acrescentadas que so escolhem entre duas frases:

```
git diff f7e6eff..HEAD -- painel/src/dados/autenticacao.ts
+ const eOutraConta = email !== EMAIL_DO_DIRETOR;
  await signOut(auth); ... setUsuario(null); setBase(null); setSituacao("recusada");
+   eOutraConta ? <frase antiga> : <frase nova sobre e-mail nao verificado>
```

Quem for recusado hoje continua recusado do mesmo jeito, com a sessao encerrada e sem nenhum
ouvinte criado. O unico prejuizo de nao publicar e que o diretor, se o e-mail dele aparecer sem
verificacao, leria uma frase que o manda procurar o problema no lugar errado. Isso e usabilidade,
nao seguranca, e eu nao exijo publicacao por causa disso.

## PONTO 6, A REDE DE SEGURANCA DA TRILHA, DECIDIDA E NAO APLICADA

**PENDENCIA ACEITA, registrada, e nao muda o meu veredito sobre a trilha. SEM PROVA do estado
atual, por falta de credencial administrativa.**

O diretor decidiu SIM para recuperacao a ponto no tempo e SIM para protecao contra exclusao
(`docs/ost6-decisoes-do-diretor.md`, decisao 2). Nao foi aplicado, porque depende do `gcloud`, que
hoje pede login interativo. Nao consigo nem reconferir o estado, que na primeira auditoria era
`POINT_IN_TIME_RECOVERY_DISABLED` e `DELETE_PROTECTION_DISABLED`.

Os comandos prontos, para o diretor rodar depois de `gcloud auth login`, com projeto explicito,
§A.20:

```
gcloud firestore databases update --database="(default)" --enable-pitr --project a-fabrica-soulan
gcloud firestore databases update --database="(default)" --delete-protection --project a-fabrica-soulan

conferir depois:
gcloud firestore databases describe --database="(default)" --project a-fabrica-soulan
  tem de passar a mostrar POINT_IN_TIME_RECOVERY_ENABLED e DELETE_PROTECTION_ENABLED
```

**Por que isso nao muda o meu veredito sobre a trilha.** Porque o meu veredito anterior ja era
exato e ja contava com a ausencia dessa rede. A frase continua valendo palavra por palavra: a
trilha nao se apaga pelo painel nem pela ponte, e ninguem sem a conta do diretor a alcanca; o
diretor, como proprietario do projeto, apaga o que quiser pelo caminho administrativo, e hoje isso
nao seria recuperavel nem registrado em nenhum lugar que este sistema leia. Garantia contra erro e
contra invasor de fora, sim; garantia contra o dono, nao.

O que a aplicacao muda e o tamanho do estrago recuperavel, e e por isso que eu a mantenho na lista
de antes de ligar a Onda 2: a Onda 2 e a primeira onda em que a trilha deixa de ser so historico e
passa a ser a prova de que o diretor autorizou alguma coisa. Protecao contra exclusao e de graca.

## PONTO 7, OS SETE TESTES CONTRA A BASE REAL CONTINUAM SEM RODAR

**Confirmado por mim, e o motivo e real, nao desculpa. MAQUINA mais LEITURA DE CODIGO.**

O bloqueio e um so e eu o verifiquei de tres angulos: `sessao.json` tem 81 bytes com `entradas`
vazio (item 5); a escada nao tem mais nenhum degrau que consiga obter sessao sozinho, porque o
unico degrau de nuvem exige a colagem do diretor (ponto 2); e o executor realmente para, com
mensagem, em vez de inventar um caminho. Os comandos estao prontos em `ponte/package.json`:
`npm run colar` e `npm run base-real`, os dois compilando antes de rodar.

**Agora o que a OST pediu, e eu vou ser literal. Sem esses sete testes, eis o que eu NAO posso
afirmar sobre este sistema:**

1. **Nao posso afirmar que a ponte consegue entrar na base real.** O elo da troca do token de
   atualizacao por sessao esta provado **so no negativo**, com HTTP 400 `INVALID_REFRESH_TOKEN`
   para credencial invalida. Com credencial valida, nunca aconteceu. Se esse elo falhar, a Onda 1
   inteira nao funciona na nuvem.
2. **Nao posso afirmar que o portao resiste contra a base real.** Os testes 3, 4 e 7, que sao
   justamente os que provam que risco nao executa sem resposta, foram provados no emulador. O
   emulador roda uma copia das regras, nao as regras publicadas, e eu nao consegui nesta rodada
   reconferir que as duas sao identicas.
3. **Nao posso afirmar que a regra publicada aceita as escritas que a ponte faz.** Conferi por
   leitura que a forma dos documentos casa com a regra, campo por campo, e isso e forte, mas
   leitura de regra nao substitui escrita aceita. Em particular, nunca ninguem escreveu uma linha
   de `maquinas`, `fabricas`, `atividade`, `tarefas` ou `aprovacoes` na base real.
4. **Nao posso afirmar que a trilha do tempo esgotado funciona na nuvem**, pelo mesmo motivo. O
   caso de resposta tardia negada esta provado contra a copia das regras, no emulador.
5. **Nao posso afirmar que o indicador de ponte offline do §A.10 funciona com dado real**, porque
   ele depende do sinal de vida escrito pela ponte, que nunca chegou a base real.
6. **Nao posso afirmar nada sobre o arquivo de sessao com conteudo**: permissao reconferida com o
   arquivo cheio, token ausente de registro e de relato, renovacao automatica do SDK contra o
   servidor de verdade. Tudo isso esta provado contra o emulador e so contra ele.
7. **E continua sem existir o caso que eu pedi na auditoria anterior**, matar a ponte de forma seca
   com pedido pendente e provar que nada executou e que nenhum processo do Claude Code sobrou
   orfao. O agente da ponte foi correto em nao construir sem a OST pedir, §A.12, e propos. Eu
   mantenho o pedido na condicao 11.

O que eu **posso** afirmar, e o que sustenta o veredito de aprovado com ressalva, e que nada disso
e furo descoberto: e prova que falta. A colagem foi provada em dez casos de erro, todos falhando
fechado, com o proprio ponto de entrada da instalacao, um processo por caso, e eu conferi os
arquivos. A regressao dos sete no emulador passou 7 de 7 depois de todas as mudancas da rodada. O
codigo de decisao, que e o que me interessa como auditor, nao mudou nesta rodada: `git diff
7f0c81f..HEAD -- ponte/src/claudeCode.ts ponte/src/tipos.ts` devolve **vazio**, ou seja, o portao,
o modo fixado na mao, a isca antes de abrir e a limpeza das variaveis de aninhamento estao
exatamente como eu os aprovei na primeira auditoria.

---

## PORTA DE ENTRADA NESTA MAQUINA AGORA, CONFERIDO POR MIM

**NADA DESTE REPOSITORIO ESTA ESCUTANDO. A minha condicao bloqueante 3 esta FECHADA. MAQUINA.**

Esta foi a primeira coisa que eu fiz, antes de ler codigo, porque na auditoria anterior eu achei
tres processos vivos e um deles escutava em **todas** as interfaces.

Levantei todas as portas em escuta e mapeei o dono de cada uma. Resultado:

```
escuta FORA do laco de retorno, com o dono de cada porta:
  135, 49664 a 49673  -> svchost, lsass, wininit, services (Windows)
  139, 445            -> System (compartilhamento do Windows)
  1434                -> sqlservr
  2179                -> vmms (Hyper-V)
  5040                -> svchost
  7070                -> AnyDesk
  9993                -> zerotier-one_x64
  60496, 62355        -> RvControlSvc (impressora)

escuta no laco de retorno, com o dono de cada porta:
  11438, 12588, 22102, 49670, 50363, 52348, 54943 a 54966, 55079 a 55082, 62020,
  64457, 65268 a 65285          -> Antigravity IDE e o language_server dele
  51531 a 51543, 51898 a 51910  -> language_server do Antigravity
  1434, 59652                   -> sqlservr
  19294                         -> AdobeCollabSync
```

**Nenhuma linha deste repositorio, em nenhuma das duas listas.** Em especial:

```
porta 3000 (servidor de desenvolvimento do painel) -> NAO EXISTE MAIS
portas 8080, 9099, 4400, 4500   -> NAO EXISTEM MAIS (emuladores da rodada anterior)
portas 3399, 8399, 9399         -> NAO EXISTEM MAIS (servidor e emulador do frontend)
portas 8199, 9299, 4699, 4799, 9151 -> NAO EXISTEM MAIS (o emulador do outro agente)
```

Confirmei tambem pelo outro lado, pelos processos: nao existe nenhum processo `java`, nenhum
emulador do Firebase e nenhum servidor do Next nesta maquina. Os vinte processos `node` vivos sao
todos servidores de ferramenta do proprio ambiente de agente (`chrome-devtools-mcp` e
`@google-cloud/cloud-run-mcp`, por `npx`), nenhum deles com `a-fabrica` na linha de comando, e
nenhum deles escutando porta.

Sobre o aviso do agente frontend, de que havia um emulador de outro agente vivo em
`a-fabrica-lab`: era verdade na hora em que ele escreveu, esta registrado na evidencia dele
(`portas/portas-depois.txt`, secao 4, portas 8199, 9299, 4699, 4799 e 9151 nos pids 26080 e
31184), e **nao e mais verdade agora**: o agente da ponte encerrou o que subiu, como declarou na
decisao 8 dele, e eu confirmei que aquelas portas e aqueles processos nao existem mais. Os dois
agentes falaram a verdade, cada um no seu momento.

A tarefa agendada continua como eu a aprovei, e continua **parada**, porque nao tem credencial:

```
TaskName         State
A Fabrica Ponte  Ready

Execute   : C:\Program Files\nodejs\node.exe
Arguments : "C:\Users\Henrique\a-fabrica\ponte\dist\ponte.js"
UserId    : Henrique     RunLevel : Limited     LogonType : Interactive
```

**Uma observacao que eu devo ao diretor, e nao e condicao porque nao e deste projeto.** Duas
coisas escutam em todas as interfaces nesta maquina e nao sao nossas: o AnyDesk na 7070 e o
ZeroTier na 9993. Sao ferramentas dele, anteriores a este projeto, e o §A.9 me proibe de tocar na
configuracao que ele ja tem. Registro porque o §A.6 raciocina sobre a premissa de que nao existe
caminho de entrada na maquina, e essas duas sao, por desenho, caminhos de entrada que ele mesmo
escolheu ter. Isso nao enfraquece a ponte, que continua sem escutar nada. Muda apenas o que ele
deve saber ao avaliar o risco total da maquina onde as fabricas rodam.

## §A.9, PLANO B, RECONFERIDO

**APROVADO. Nada desta rodada alterou configuracao existente do Claude Code nem do Antigravity.
LEITURA DE CODIGO mais MAQUINA.**

1. **Busca em todo o codigo** por `antigravity`, `.claude.json`, `.claude/settings`, `codeium`,
   `windsurf`, `AppData\Roaming\Code`, `.vscode` e `configstore`, em `ponte/src`,
   `ponte/instalar.ps1`, `ponte/package.json`, `painel/src`, `painel/app` e `firebase`: **uma unica
   linha**, e e a promessa, `ponte/instalar.ps1:11`, "§A.9: nao altera nada do Claude Code nem do
   Antigravity, so acrescenta a ponte."
2. **Melhorou em relacao a rodada anterior.** Na primeira auditoria eu registrei que a ponte lia um
   arquivo do diretor, o deposito do firebase-tools, so para leitura. Com a remocao do degrau
   proibido, **nao le mais nenhum**. A decisao do diretor, que era sobre credencial, saiu de graca
   em cima do §A.9.
3. **Todas as escritas em disco da ponte, por linha, reconferidas:** `config.ts:120, 125-126`,
   `persistenciaArquivo.ts:81-87`, `identidade.ts:374`, `ponte.ts:146, 153, 175`,
   `claudeCode.ts:63` e `claudeCode.ts:100`, `entrar.ts:62, 70`. Todas dentro de
   `%USERPROFILE%\.a-fabrica-ponte`, da pasta de trabalho da propria fabrica, do arquivo da propria
   isca ou do arquivo de relato que o operador pede. Nenhuma escrita em pasta de ninguem.
4. **Na maquina:** `AppData\Roaming\Antigravity IDE\User\settings.json` com data de **22/04/2026**,
   intocado. O que muda naquela pasta e `globalStorage` e `workspaceStorage`, que o proprio editor
   mexe porque esta aberto. `C:\Users\Henrique\.claude.json` mudou as 13:40, e isso e o proprio
   Claude Code registrando sessao, nao obra deste projeto, que nao tem uma linha de codigo
   apontando para esse arquivo.
5. **As evidencias desta rodada nasceram em pasta nova**, doze pastas em
   `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T*`, nada sobrescrito e nada apagado, §A.17
   e §A.19 respeitados, inclusive a rodada que falhou ficou preservada ao lado da que passou.
6. **O gate do §A.7 esta intacto, e eu provei do pior jeito possivel: ele me bloqueou.** Mandei um
   comando de conferencia cujo texto continha uma das palavras vigiadas, e o hook recusou com
   "BLOQUEADO. Motivo: nenhuma flag READY_ em .claude/state/." O hook segue amarrado em
   `.claude/settings.json:10` ao script de `scripts/`, e `.claude/state/` contem apenas o
   `README.md`, sem nenhuma flag de liberacao. O diff `f7e6eff..HEAD` nao toca `CLAUDE.md`,
   `.claude`, `scripts`, `firebase`, `firebase.json` nem `.firebaserc`.
7. **O plano B continua de pe:** as fabricas rodariam sobre as mesmas pastas de projeto, a ponte e
   um processo a mais que da para desligar, e sem painel o diretor abre o Claude Code na mao como
   sempre. Hoje, inclusive, e o unico jeito: a ponte esta parada por falta de credencial, e o
   diretor nao perdeu nada por isso, que e exatamente o que o §A.9 promete.

## SEGREDO NO REPOSITORIO, RECONFERIDO

**APROVADO. LEITURA DE CODIGO.**

Varredura na arvore inteira, fora de `node_modules`, de `.git` e do `package-lock.json`, por
`AIzaSy` seguido de valor, `BEGIN PRIVATE KEY`, `private_key`, `client_secret`, `ya29.`,
`sk-ant-`, `firebase-adminsdk`, `serviceAccount` e JWT com valor. Quatro ocorrencias, nenhuma
delas vazamento:

```
docs/ost6-seguranca.md:459-460   o texto do meu parecer anterior citando a propria busca
painel/.env.local:1              a chave web publica, arquivo IGNORADO pelo git
                                 (git check-ignore: .gitignore:30:*.local), nao rastreado
ponte/src/testes/prova-colagem.ts:73   JWT de mentira, com a assinatura escrita
ponte/dist/testes/prova-colagem.js:58  o mesmo, compilado
```

O id do app continua em `ponte/instalar.ps1:31`, e isso agora e coerente, veja a condicao 6.

Acrescento uma confissao de higiene, porque auditoria tambem se aplica ao auditor: dois arquivos
temporarios meus, `ar-chunk.js` e `corpo.txt`, caíram na raiz do repositorio quando eu baixei o
pacote publicado para varrer. Eram meus, nao eram evidencia de ninguem, e eu os removi nomeados e
por extenso, §A.18: `C:/Users/Henrique/a-fabrica/ar-chunk.js` e
`C:/Users/Henrique/a-fabrica/corpo.txt`. O `git status` voltou a ficar limpo. As minhas evidencias
de verdade ficaram fora do repositorio, na pasta de trabalho temporaria da sessao.

---

## SITUACAO DAS DEZ CONDICOES DO PARECER ANTERIOR

Conferi as quatro que o diretor fechou, uma por uma, com comando proprio. Nao aceitei a palavra
dele, como ele mesmo pediu.

**Condicao 1, segundo fator provado. ABERTA, e agora bloqueia a Onda 2, nao apenas a main.**
Nenhuma evidencia foi trazida. Motivo do agravamento: na Onda 2 a porta passa a dar execucao, nao
leitura. Veja o item 3 e a resposta direta no inicio.

**Condicao 2, o legado deixa de ser executavel. FECHADA, conferida por mim.**

```
$ ls ponte/legado-mjs/
base.mjs.txt  claudeCode.mjs.txt  LEIA.md  ponte.mjs.txt

$ node ponte/legado-mjs/ponte.mjs.txt
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".txt" for
C:\Users\Henrique\a-fabrica\ponte\legado-mjs\ponte.mjs.txt
    at Object.getFileProtocolModuleFormat [as file:] (node:internal/modules/esm/get_format:185:9)
codigo de saida real: 1

$ git ls-files "*.mjs" dentro de ponte/legado-mjs  -> nenhum
```

O erro acontece **antes** de qualquer modulo carregar, logo nao abre aplicativo do Firebase e nao
cria ouvinte nenhum, que era exatamente a minha verificacao. Os tres arquivos foram preservados,
§A.17: nada foi apagado, mudou a capacidade de execucao.

**Condicao 3, nenhuma porta de entrada viva. FECHADA, conferida por mim.** Secao propria acima,
com a lista completa de portas e donos. O criterio que eu mesmo escrevi esta satisfeito: nao existe
nenhuma linha com endereco diferente de `127.0.0.1` ou `::1` para processo deste repositorio, e,
mais que isso, nao existe processo deste repositorio escutando nada.

**Condicao 4, tempo esgotado deixa trilha. FECHADA no codigo e no emulador, com uma pendencia de
prova que entra na condicao 11.** Veja o ponto 3. Falta a mesma prova contra a base real, e falta
o caso de rede caida no meio da gravacao da trilha.

**Condicao 5, degrau (a) sob decisao explicita do diretor. FECHADA, DECIDIDA pelo diretor, e
cumprida no codigo.** A decisao foi mais dura do que a condicao pedia: em vez de aceitar por
escrito, ele proibiu. Registrada em `docs/ost6-decisoes-do-diretor.md`, decisao 1, com a razao
dele. Cumprimento provado no ponto 2. Registro o acerto da decisao: era o unico lugar do sistema
onde um arquivo roubado valia mais do que o painel inteiro.

**Condicao 6, coerencia do identificador do app. FECHADA, pelo caminho do texto, conferida por
mim.** A minha condicao aceitava qualquer um dos dois caminhos. O escolhido foi corrigir o
principio para dizer a verdade, `painel/src/dados/configuracao.ts:12-21`: "Nenhuma chave e nenhum
authDomain aparece em arquivo versionado" mais o paragrafo que assume que o identificador do app
aparece, onde aparece e por que e aceito. O `git grep` do identificador agora devolve apenas
`ponte/instalar.ps1:31` e as duas citacoes dentro do meu parecer anterior. Os dois arquivos
pararam de seguir regras opostas, que era o defeito.

**Condicao 7, o cabecalho das regras deixa de mentir. FECHADA no texto; a identidade byte a byte
com a nuvem ficou SEM PROVA nesta rodada.** O texto esta corrigido,
`firebase/firestore.rules:11-13`: "ESTA VERSAO, com o endurecimento da OST 6, JA ESTA NA NUVEM",
mais a instrucao de como conferir. Nao consigo repetir a conferencia administrativa que provaria a
identidade, porque e exatamente a chamada que perdeu credencial, e nao existe no repositorio
nenhum arquivo de evidencia daquela republicacao (o commit `f7e6eff` nao traz nada em
`firebase/testes/`). O que eu consigo dizer com prova: o **comportamento** das regras publicadas
esta reconferido ao vivo agora, com 403 em leitura nas sete colecoes e em escrita em tres, e o
corpo das regras ja havia sido provado identico. O que mudou entre as duas versoes foi comentario.
Risco residual: baixo. Para nao depender de fe na proxima vez, condicao 14.

**Condicao 8, rede de seguranca da trilha. DECIDIDA pelo diretor, NAO APLICADA.** Ponto 6 acima,
com os comandos prontos. Entra na lista de antes de ligar a Onda 2.

**Condicao 9, superficie da pagina publica. ABERTA, opcional, reconferida por mim.** Continua
igual:

```
$ curl -s https://a-fabrica-soulan.web.app/ | grep -c henrique   -> 1
cabecalhos da resposta: Strict-Transport-Security: max-age=31556926; includeSubDomains; preload
  (nenhum Content-Security-Policy, nenhum X-Frame-Options, nenhum X-Content-Type-Options)
```

Continua opcional e de baixa gravidade. Ganhou um agravante pequeno: a mesma pagina publica
afirma que a conta carrega segundo fator, o que entrega ao mundo a conta a atacar **e** a
afirmacao de como ela esta protegida, sem que ninguem tenha verificado. Veja a condicao 13.

**Condicao 10, reauditoria depois do clique do Authentication. FECHADA. E este documento.**

---

## CONDICOES NOVAS, NUMERADAS A PARTIR DE 11

**11. Os sete testes e a prova do tempo contra a BASE REAL, antes de a Onda 2 ser ligada.** Com a
colagem feita, rodar `npm run base-real` e `npm run prova:tempo` contra a nuvem e colar as duas
saidas no diario, com os identificadores `maquina-TESTE-ost6-*` que ficarem na base. Incluir na
mesma rodada tres casos que hoje nao existem: (a) matar a ponte de forma seca com pedido pendente
e provar que nada executou e que nenhum processo do Claude Code sobrou orfao; (b) rede caida no
instante da gravacao da trilha do tempo esgotado, provando que a recusa chega a sessao de todo
jeito; (c) reconferir `icacls` da pasta e do arquivo de sessao **com o arquivo cheio**, mais
busca pelo token em registro, em relato e em pasta de rodada. Verificacao: as saidas existem, com
data, e dizem base real.

**12. Decidir o que protege o arquivo de sessao depois que ele tiver token, porque na Onda 2 ele
vira a chave de aprovacao.** O fato que obriga a decisao esta no meu parecer anterior e nao mudou:
no modo de permissao fixado, ferramenta de leitura nao passa pelo portao, e nenhuma das duas
rodadas provou o que acontece quando uma fabrica tenta ler um arquivo fora da pasta de trabalho
dela. Com o arquivo vazio isso era teorico. Com token dentro, o arquivo passa a valer como
autorizacao de risco. Verificacao: ou existe prova de que a leitura desse caminho passa pelo
portao e e negada, ou existe decisao escrita do diretor aceitando o risco, com a razao. Uma das
duas, antes de ligar a Onda 2. Eu nao proponho a solucao, §A.12 e o limite do meu papel.

**13. Nenhum arquivo versionado afirma o segundo fator enquanto a condicao 1 estiver aberta.** Sao
tres linhas: `firebase/firestore.rules:41`, `painel/src/telas/Barreira.tsx:46` e
`painel/src/dados/autenticacao.ts:6`. A da regra e a mais errada das tres, porque diz "exigido na
camada de Auth", e nada neste projeto o exige. Verificacao: ou a condicao 1 fecha com evidencia,
e entao as frases passam a ser verdade e podem ficar, ou as frases dizem o que e verificavel, que
e "so a conta do diretor, com e-mail verificado". Bloqueia a main, nao a Onda 2.

**14. Toda publicacao deixa evidencia, para ninguem mais precisar de fe.** Dois casos concretos
desta OST: a republicacao das regras nao deixou arquivo de evidencia, e a pasta `painel/out` deixou
de corresponder ao que esta no ar sem ninguem notar. Verificacao: cada publicacao de regra grava,
numa pasta de rodada, o conjunto publicado baixado da nuvem e a diferenca com o arquivo local; cada
publicacao do painel grava a lista dos arquivos servidos e a conferencia de que o que esta no ar e
o que esta em `painel/out`. Custo baixo, e resolve uma classe inteira de afirmacao que eu nao posso
verificar depois.

**15. Decisao do diretor sobre revogacao do acesso da ponte.** Ponto 4 acima. Ele escolhe entre
aceitar o caminho de hoje, que e desativar o usuario no Authentication e derrubar tudo junto, ou
pedir o fluxo de dispositivo da opcao B, que poe o botao de revogar na conta Google dele.
Verificacao: decisao registrada no diario, com a consequencia escolhida escrita. Nao bloqueia a
Onda 2; bloqueia dizer em relatorio que existe caminho de revogacao, porque hoje nao existe caminho
simples.

---

## RESUMO EXECUTIVO, PARA O COORDENADOR

| Pergunta | Resposta |
| --- | --- |
| Veredito | APROVADO COM RESSALVA |
| Risco executa sem o diretor? | Nao. Codigo de decisao intocado nesta rodada, diff vazio |
| Ponte abre porta? | Nao. Zero escuta no codigo, zero escuta na maquina |
| A decisao dura do diretor foi cumprida? | Sim, remocao real no fonte e no compilado |
| Trilha do tempo esgotado | Correta, e a resposta tardia e negada pela base |
| Segredo no repositorio | Nenhum |
| §A.9 plano B | Respeitado, e melhorou com a remocao do degrau |
| Onda 2 pode ser construida? | Sim |
| Onda 2 pode ser ligada? | Nao, antes das condicoes 1, 8, 11 e 12 |
| Bloqueia a main | Condicoes 1 e 13 |

Ordem que eu recomendo, e as duas primeiras sao do diretor e levam minutos: condicao 1 (prova do
segundo fator), colagem da credencial, condicao 11 (os sete testes na base real), condicao 8
(aplicar as duas protecoes do Firestore), condicao 12 (decidir sobre o arquivo de sessao). As
condicoes 13, 14, 15 e 9 andam em paralelo com a construcao.

## O QUE EU NAO FIZ, DE PROPOSITO

Nao implementei, nao corrigi, nao propus codigo e nao escolhi solucao, §A.12 e o limite do meu
papel. Nao criei protecao artificial: nao sugeri filtro de comando em lugar nenhum, porque filtro
de comando nao protege nada aqui, a protecao e a porta de entrada, a conta unica e o portao. Nao
alterei arquivo nenhum fora deste documento, com a excecao declarada dos dois arquivos temporarios
meus que eu mesmo removi. Nao rodei commit, nao subi branch e nao publiquei nada. Nao usei `gcloud`
nem o Firebase CLI para operacao que exigisse credencial, e disse o que faria em cada caso. Nao
escrevi em `%USERPROFILE%\.a-fabrica-ponte`, nao respondi aprovacao nenhuma, e a unica escrita que
tentei na base real foi a sonda de tres pedidos que tinha de voltar 403 e voltou.
