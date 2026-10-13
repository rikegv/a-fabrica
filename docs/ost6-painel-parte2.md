# OST 6, parte 2, lado do painel web, com o Authentication ligado

Agente responsavel por este fechamento: **frontend** (peca 1, telas do computador e do
celular), §A.15.

Quem fez o que nesta parte 2: tudo abaixo e deste agente. O painel que esta no disco foi
construido pelos dois agentes frontend anteriores, relatado em `docs/ost6-painel.md`. Nesta
rodada eu nao reescrevi tela nenhuma: eu **provei ao vivo** o que estava sem prova porque o
login nao existia, e consertei um texto de recusa que a propria prova mostrou impreciso.

Nao rodei commit, nao rodei push, nao publiquei nada. Nao toquei em `ponte/**`,
`firebase/**`, `firebase.json`, `.firebaserc`, `CLAUDE.md`, `DIARIO.md` nem `TASKS.md`. Nao
construi tela nova, §A.12, e em especial **nao** construi a tela de pareamento da ponte, que
segue como proposta pendente de decisao do diretor. Nao usei gcloud. Todo comando de
firebase foi dado com `--project a-fabrica-soulan` explicito, §A.20.

Pasta desta rodada, §A.17, nada sobrescrito e nada apagado:
`painel/testes/rodada-2026-10-13-131541-nuvem/`, com tres subpastas, `nuvem/`, `emulador/` e
`portas/`.

**O limite que eu respeitei sem tentar contornar:** eu nao tenho a senha do Google do diretor
e nao completei o consentimento no lugar dele. A prova do item 2 vai ate a tela de entrada do
Google, de onde em diante o clique e dele. Nao criei conta nova no projeto da nuvem e nao
tentei adivinhar senha nenhuma.

---

## 1. O que foi solicitado

Provar, com evidencia real, os sete pontos que a auditoria de seguranca marcou como pendentes
de reauditoria do lado do painel, agora que o Authentication do projeto esta ligado com o
provedor Google e conta unica:

1. o painel publicado le a configuracao da hospedagem de verdade, e o pacote publicado nao
   leva chave dentro;
2. o caminho de login ate onde da sem a senha, com navegador de verdade controlado por
   codigo;
3. nenhuma leitura da base antes de haver usuario autenticado, contra a nuvem, com captura de
   rede;
4. conta diferente da do diretor barrada de verdade, e tambem o e-mail do diretor sem
   verificacao;
5. depois do login, o painel funciona, no computador e no celular, com atualizacao ao vivo;
6. ponte offline contra dado real;
7. zero escrita no Firestore em todo o painel, com o Auth no ar.

Mais a regra operacional: encerrar todo processo subido e provar que nao ficou nada escutando
porta, com servidor de desenvolvimento preso ao laco de retorno, §A.6.

---

## 2. O que foi feito, item por item

Resumo antes do detalhe:

| item | o que e | onde foi provado |
| --- | --- | --- |
| 1 | configuracao da hospedagem, pacote sem chave | **NUVEM** |
| 2 | barreira, botao, janela do Google abrindo | **NUVEM**, ate a tela do Google |
| 3 | nenhuma leitura da base sem usuario | **NUVEM** |
| 4 | conta diferente e e-mail nao verificado barrados | **EMULADOR** |
| 5 | painel funcionando e ao vivo, computador e celular | **EMULADOR** |
| 6 | ponte offline com dado real | **EMULADOR** |
| 7 | zero escrita, controles parados | **EMULADOR** na rede, codigo no repositorio |
| final | nada escutando porta na maquina | **MAQUINA DO DIRETOR** |

### 2.1 Item 1, a configuracao vem da hospedagem e o pacote nao leva chave

**Provado na nuvem.** Roteiro `nuvem/01-configuracao-da-hospedagem.mjs`, saida completa em
`nuvem/01-saida.txt`.

```
--- 1.a GET https://a-fabrica-soulan.web.app/__/firebase/init.json ---
HTTP 200 OK
  content-type: application/json
  strict-transport-security: max-age=31556926; includeSubDomains; preload
corpo, com chave e id do app mascarados:
{
  "apiKey": "AIzaSy<mascarado>",
  "appId": "1:<remetente>:web:<mascarado>",
  "authDomain": "a-fabrica-soulan.firebaseapp.com",
  "databaseURL": "",
  "messagingSenderId": "352717030070",
  "projectId": "a-fabrica-soulan",
  "storageBucket": "a-fabrica-soulan.firebasestorage.app"
}
  veredito: a hospedagem entrega configuracao completa, lerConfiguracao devolve origem "hospedagem"
```

A chave aparece mascarada na evidencia de proposito: ela e publica por natureza, mas pasta de
rodada versionada nao carrega valor de credencial.

Que o painel servido usa **essa** origem, e nao variavel embutida, esta provado de tres
formas, uma delas visivel na propria tela:

```
--- 1.c varredura de todo arquivo de /_next que a pagina carrega ---
arquivos citados no HTML: 10
bytes de JavaScript e CSS baixados e varridos: 858005
arquivos que contem o endereco /__/firebase/init.json: 1 -> /_next/static/chunks/app/page-48755427e3a89250.js
arquivos que contem AIzaSy: 0

padroes de configuracao embutida, um por um:
  AIzaSy: ZERO ocorrencias
  a-fabrica-soulan.firebaseapp.com embutido: ZERO ocorrencias
  id do app embutido: ZERO ocorrencias
  remetente de mensagens embutido: ZERO ocorrencias

--- 1.d varredura da pasta publicada no disco, painel/out ---
arquivos em painel/out: 22
ZERO ocorrencia de chave, authDomain, id do app ou remetente em painel/out.
```

A terceira prova e a melhor, porque e a que o diretor ve: o rodape da barreira publicada diz
**"Configuração lida: hospedagem."** Foto `nuvem/02-barreira-na-nuvem.png`. No painel rodando
na maquina, o mesmo rodape diz "Configuração lida: ambiente local", foto
`emulador/10-barreira-desenvolvimento.png`. O texto sai de `origemDaConfiguracao`, que e o
valor que `lerConfiguracao()` devolveu de verdade naquela carga.

O raciocinio que fecha o item: `doAmbiente()` depende de `process.env.NEXT_PUBLIC_*`, que o
Next substitui por texto literal em tempo de construcao. Como o pacote publicado nao contem
nenhum desses valores, servido pela hospedagem o painel **nao tem de onde** tirar
configuracao a nao ser de `/__/firebase/init.json`.

### 2.2 Item 2, o caminho de login ate onde da sem a senha

**Provado na nuvem,** com Chromium de verdade dirigido por codigo. Roteiro
`nuvem/02-entrada-e-rede.mjs`, saida em `nuvem/02-saida.txt`, trafego completo em
`nuvem/02-trafego-de-rede.json`.

A barreira aparece, e e so ela:

```
HTTP da raiz: 200
botao "Entrar com o Google" existe: true
botao desabilitado: false
painel de dentro desenhado antes do login (.gf-app ou .gf-mapp): false
texto que a tela mostra, na integra:
  A Fábrica
  Acompanhar e comandar as fábricas de agentes.
  ENTRADA ÚNICA
  Só a conta do diretor entra, pelo Google, que carrega o segundo fator. O painel é de uso individual.
  henrique.vieira@soulan.com.br
  Entrar com o Google
  Configuração lida: hospedagem.
```

O botao dispara, a janela abre e chega no Google:

```
a janela abriu, evento popup recebido.
url inicial da janela: https://a-fabrica-soulan.firebaseapp.com/__/auth/handler?apiKey=<mascarado>
  &appName=%5BDEFAULT%5D&authType=signInViaPopup&redirectUrl=https%3A%2F%2Fa-fabrica-soulan.web.app%2F
  &v=10.14.1&providerId=google.com
  &customParameters=%7B%22prompt%22%3A%22select_account%22%2C%22login_hint%22%3A%22henrique.vieira%40soulan.com.br%22%7D
janela ainda aberta: true
host: accounts.google.com
titulo da janela: Fazer login nas Contas do Google
texto que a janela mostra: Fazer Login com o Google  Faça login  Prosseguir para
  a-fabrica-soulan.firebaseapp.com  @soulan.com.br  Insira seu e-mail  ...  Avançar
VEREDITO 2.b: a janela chegou no accounts.google.com. Daqui para frente e o clique do diretor.
```

Foto `nuvem/04-janela-do-google.png`: a tela do Google, em portugues, dizendo "Prosseguir
para a-fabrica-soulan.firebaseapp.com", com o campo de e-mail ja preenchido com
`henrique.vieira` e o dominio `@soulan.com.br` fixado ao lado. Isso e o `login_hint` que o
painel manda. Enquanto o painel espera, a barreira mostra "A janela do Google está abrindo" e
o botao fica desabilitado, foto `nuvem/03-painel-depois-do-clique.png`.

Honestidade sobre o que a foto mostra: como o navegador da prova nasce limpo, sem nenhuma
sessao Google, o Google abre a tela de **entrada de conta**, nao a de escolha entre contas ja
logadas. No navegador do diretor, que ja tem sessao, o `prompt: select_account` leva direto a
lista de contas. Os dois casos sao a mesma tela do Google, e em nenhum dos dois o painel
participa.

**Nenhum erro de configuracao,** que era o achado grave que a OST mandou avisar na hora:

```
--- 2.d procura por erro de configuracao ---
  auth/unauthorized-domain: nao apareceu
  auth/configuration-not-found: nao apareceu
  auth/operation-not-allowed: nao apareceu
  auth/popup-blocked: nao apareceu
  auth/internal-error: nao apareceu
  disallowed_useragent: nao apareceu
resumo: nenhum erro de configuracao do Auth
```

O console do navegador registrou cinco linhas, todas iguais:

```
  [error] Failed to load resource: the server responded with a status of 403 ()
```

e **essas cinco linhas sao minhas**, nao do painel: sao as cinco colecoes que eu mesmo pedi ao
Firestore na mao, no item 3 logo abaixo, para provar a negacao. Fora delas, o console ficou
limpo.

### 2.3 Item 3, nenhuma leitura da base antes de haver usuario, contra a nuvem

**Provado na nuvem,** com captura de todo pedido de rede do navegador, nao por leitura de
codigo.

```
--- 3.a trafego de rede do navegador, painel aberto e SEM login ---
total de pedidos observados ate aqui: 14
pedidos por destino:
  a-fabrica-soulan.web.app: 11
  fonts.gstatic.com: 2
  fonts.googleapis.com: 1

pedidos ao FIRESTORE antes de haver usuario: 0
pedidos ao Identity Toolkit antes de clicar em entrar: 0

VEREDITO 3.a: ZERO chamada ao Firestore. O ouvinte nao nasce porque a base e nula sem usuario.
```

O painel carrega o proprio pacote, a configuracao da hospedagem e duas fontes. Mais nada.

E a outra metade do item, que a OST pediu explicitamente, a negacao da nuvem. Fiz a chamada
na mao, **de dentro da origem do painel publicado**, com a chave que a propria hospedagem
entrega:

```
--- 3.b a mesma leitura feita na mao, da origem do painel publicado, com a chave publica ---
  maquinas    -> HTTP 403 PERMISSION_DENIED Missing or insufficient permissions.
  fabricas    -> HTTP 403 PERMISSION_DENIED Missing or insufficient permissions.
  aprovacoes  -> HTTP 403 PERMISSION_DENIED Missing or insufficient permissions.
  comandos    -> HTTP 403 PERMISSION_DENIED Missing or insufficient permissions.
  relatorios  -> HTTP 403 PERMISSION_DENIED Missing or insufficient permissions.
VEREDITO 3.b: a regra que esta na nuvem nega leitura sem sessao em todas as colecoes, agora,
com Auth ligado.
```

Isso importa porque a seguranca so tinha provado esse 403 com a chave avulsa, fora do
navegador. Agora esta provado com o Auth ligado, da origem publicada, exatamente como um
curioso faria abrindo o console do navegador na pagina do diretor.

E durante a entrada, com a janela do Google aberta:

```
--- 3.c depois do clique no botao, e com a janela do Google aberta ---
pedidos novos depois do clique: 16
destinos novos:
  a-fabrica-soulan.firebaseapp.com: 6
  accounts.google.com: 4
  apis.google.com: 2
  www.googleapis.com: 2
  identitytoolkit.googleapis.com: 1
  ssl.gstatic.com: 1
pedidos ao Firestore feitos pelo PAINEL (fora da sonda 3.b): 0
VEREDITO 3.c: nem durante a entrada o painel le a base.
```

### 2.4 Item 4, quem nao e o diretor e barrado

**Provado no emulador,** com o painel real rodando contra o emulador de Auth e de Firestore,
porque eu nao tenho uma segunda conta Google de verdade nem a senha de nenhuma. Roteiro
`emulador/03-prova-no-emulador.mjs`, saida em `emulador/03-saida.txt`; a segunda passada, com
o texto consertado, em `emulador/05-mensagens-de-recusa.mjs` e `emulador/05-saida.txt`.

**Caso A, conta diferente** (`outra.pessoa@exemplo.com`, com e-mail verificado):

```
contas que existem no emulador agora: [{"email":"outra.pessoa@exemplo.com","emailVerified":true}]
painel de dentro desenhado: false
mensagem: Esta conta não é a do diretor, então a sessão foi encerrada. O painel só abre para
          henrique.vieira@soulan.com.br, com e-mail verificado pelo Google.
botao: Entrar com a conta do diretor
pedidos ao Firestore desde o clique de entrar: 0
sessao guardada no navegador depois da recusa: {"base":true,"usuarios":0}
```

Tres coisas provadas de uma vez: o painel nao abre, **nenhuma leitura da base acontece nem por
um instante**, e a sessao foi mesmo encerrada, porque o deposito de sessao do Firebase no
navegador (o IndexedDB `firebaseLocalStorageDb`) ficou com **zero** usuario guardado. Fotos
`emulador/11-conta-diferente-recusada.png` e `emulador/30-recusa-conta-diferente.png`.

**Caso B, e-mail do diretor sem verificacao.** O formulario do emulador de Auth nao oferece
essa opcao, ele sempre marca o e-mail como verificado. Entao a prova chama a propria funcao do
widget do emulador com a reivindicacao `email_verified: false`, que e o mesmo caminho de
codigo: o painel recebe do provedor Google um usuario com `emailVerified` falso.

```
contas que existem no emulador agora: [{"email":"henrique.vieira@soulan.com.br","emailVerified":false}]
painel de dentro desenhado: false
mensagem: Esta é a conta do diretor, mas o Google não diz que o e-mail está verificado, então a
          sessão foi encerrada. A regra da base exige e-mail verificado. Verifique o e-mail na
          conta do Google e entre de novo.
pedidos ao Firestore desde o clique de entrar: 0
```

Foto `emulador/31-recusa-email-nao-verificado.png`.

Esse segundo texto e novo, e e o unico conserto de codigo desta rodada. Esta explicado na
secao 4, decisao 1.

### 2.5 Item 5, depois do login o painel funciona

**Provado no emulador,** com o painel real, nas duas telas.

Entrada aceita e base vazia tratada com dignidade, antes de qualquer dado:

```
conta que entrou: [{"email":"henrique.vieira@soulan.com.br","emailVerified":true}]
painel de dentro desenhado: true
  Nenhuma ponte pareada
  O painel está ligado à base, mas nenhuma máquina se apresentou ainda. Quando a ponte iniciar,
  ela aparece aqui.
  ... Nenhuma fábrica no painel ... Nada esperando você
```

Foto `emulador/13-dentro-base-vazia-computador.png`.

**A atualizacao ao vivo de verdade, que a OST pediu se desse.** Deu, e esta medida duas vezes,
sem recarregar a pagina em nenhum momento.

Primeira: a base recebe, de fora do navegador, exatamente os documentos que a ponte escreveria
(uma maquina, sete fabricas, seis passos de atividade, quatro tarefas, tres aprovacoes), com o
painel aberto:

```
a pagina foi recarregada entre as duas leituras: nao, nenhum goto e nenhum reload foi chamado.
texto da tela ANTES da escrita (resumo): ... Visão geral Terça, 13 de outubro · 0 fábricas
texto da tela DEPOIS da escrita (resumo): ... Aprovações 2 Fábricas 7 ... PROJETOS Portal de Vagas ...
a tela mudou sozinha: true
```

Segunda, medida no contador, com fotos lado a lado (`emulador/15-ao-vivo-antes.png` e
`emulador/16-ao-vivo-depois.png`):

```
antes da escrita:  {"cartoes":6,"textoDoIndicador":"Em execução 2 de 7 ...","temProvaAoVivo":false}
depois da escrita: {"cartoes":6,"textoDoIndicador":"Em execução 3 de 8 ...","temProvaAoVivo":true}
VEREDITO 5.2: a fabrica nova apareceu na tela sem recarregar. Ouvinte ao vivo provado.
```

E dentro da tela da fabrica, com a aba Atividade aberta:

```
o passo novo estava na tela antes: false; depois da escrita: true
```

Foto `emulador/18-fabrica-atividade-ao-vivo.png`.

**Computador:** `14-visao-geral-computador.png` (sete fabricas por urgencia, cinco
indicadores, painel Aguardando voce com o pedido aberto) e `17-fabrica-computador.png` (posto
de comando com atividade, tarefas, pedido parado, tempo, consumo e situacao da ponte). Rolagem
da pagina medida: **0**.

**Celular:** `20-celular-entrada.png` (entra direto em Aprovacoes, porque ha pedido parado),
`21-celular-fabricas.png` e `22-celular-fabrica.png`. Rolagem da pagina medida: **0**.

### 2.6 Item 6, ponte offline contra dado real

**Provado no emulador,** com as duas telas abertas e sem recarregar: o sinal de vida da
maquina foi envelhecido para cinco minutos atras e o painel virou sozinho, dentro da janela de
15 segundos do relogio dele.

```
selos de estado na tela: {"selos":["Ponte offline","Ponte offline","Ponte offline",
                                   "Ponte offline","Ponte offline","Ponte offline"],"cartoes":6}
cartoes: 6, selos dizendo Ponte offline: 6
```

Toda fabrica virou offline, nenhuma exceção, inclusive as que estavam gravadas como "em
execucao". Os indicadores acompanham: "EM EXECUÇÃO 0 de 8". A faixa do topo diz
**"A ponte está offline. Sem sinal da máquina local há 5 min. As fábricas não andam e nenhum
comando é entregue até ela voltar."** e o pe do menu diz "Ponte offline, há 5 min". O pedido
parado continua visivel, porque ele continua esperando o diretor, e a propria decisao muda de
texto para "A ponte está offline. Responder entra na Onda 2."

Fotos `emulador/23-ponte-offline-computador.png`, `24-fabrica-offline-comando-desabilitado.png`
e `25-celular-ponte-offline.png`. O celular virou offline ao vivo tambem, sem recarregar.

**A caixa de comando fica desabilitada dizendo por que,** e o motivo muda quando a ponte cai.
Esse motivo mora dentro do proprio campo, entao ele nao aparece no texto corrido da pagina e
precisa ser lido do campo e fotografado de perto. Roteiro `emulador/04-caixa-de-comando.mjs`,
saida em `emulador/04-saida.txt`:

```
--- ponte CONECTADA, computador ---
 "desabilitada": true,
 "motivoNoCampo": "Mandar comando entra na Onda 2. Nesta onda o painel é de leitura.",
 "classe": "gf-cmd gf-cmd-off",
 "botaoEnviarDesabilitado": true

--- ponte OFFLINE, computador ---
 "desabilitada": true,
 "motivoNoCampo": "A ponte está offline, nenhuma ordem sai daqui. Mandar comando entra na Onda 2.",
 "botaoEnviarDesabilitado": true

celular, o motivo muda tambem: true
travessao em algum desses textos, §A.11: false
```

Fotos de perto: `26-caixa-ponte-conectada.png`, `27-celular-caixa-ponte-conectada.png`,
`28-caixa-ponte-offline.png`, `29-celular-caixa-ponte-offline.png`.

### 2.7 Item 7, zero escrita, com o Auth no ar

**Provado por rede no emulador e por codigo no repositorio.** O Auth ligado nao abriu caminho
de escrita nenhum, porque nao existe caminho de escrita para abrir.

Rede, sessao inteira, com o diretor autenticado, nas duas telas, com dados, com pedido parado
e com a ponte caindo:

```
pedidos ao emulador do Firestore na sessao inteira: 15
por caminho:
    15  /google.firestore.v1.Firestore/Listen/channel
pedidos de ESCRITA (Write/channel, commit, batchWrite): 0

documentos na base do emulador no fim: {"maquinas":1,"fabricas":8,"aprovacoes":3,"comandos":0,"relatorios":0}
VEREDITO 7: ZERO escrita. O painel so abre canal de Listen.
```

Quinze canais de Listen e **nenhum** de Write. As colecoes `comandos` e `relatorios`
terminaram em zero documento, e o painel esteve aberto o tempo todo com os botoes na tela.

Codigo, em `07-conferencias-de-codigo.txt`:

```
=== escrita no Firestore em painel/src e painel/app ===
termos: setDoc addDoc updateDoc deleteDoc runTransaction writeBatch
ZERO ocorrencias

=== o unico .set( do painel e um Map do JavaScript, nao o Firestore ===
src/dados/painel.ts:64:      porFabrica.set(pedido.factoryId, lista);

=== o que o painel importa como VALOR de firebase/firestore ===
import { collection, limit as limitar, onSnapshot, orderBy, query, type Firestore, ... }
(todo o resto importa apenas o tipo Firestore)

=== manipulador de acao passado para componente, em telas e app ===
ZERO ocorrencias
```

Os controles, lidos da tela com o diretor dentro e a ponte conectada:

```
controles DESABILITADOS: ["Pausar","Reiniciar","Encerrar","Comando para esta fábrica","Enviar","Aprovar","Recusar"]
controles habilitados: ["Visão geral","Aprovações 2","Fábricas 8","Relatórios","Indicadores",
                        "Configurações","Sair","Voltar","Atividade 6","Tarefas 4",
                        "Abrir o painel Aguardando você"]

--- botoes de decisao na Visao geral ---
  "Abrir nova fábrica" desabilitado: true
  "Aprovar" desabilitado: true
  "Aprovar com observação" desabilitado: true
  "Recusar" desabilitado: true
```

Tudo que continua habilitado e navegacao ou leitura. E cada controle parado diz em que onda
entra: "Responder aprovação entra na Onda 2.", "Pausar, reiniciar e encerrar entram na Onda
2.", "Abrir nova fábrica entra na Onda 2." e, dentro do campo, "Mandar comando entra na Onda
2. Nesta onda o painel é de leitura." Foto `19-decisao-desabilitada-computador.png`.

### 2.8 Regra operacional, nenhuma porta de entrada deixada aberta

A condicao 3 da auditoria de seguranca, a mais urgente da lista dela, era um servidor de
desenvolvimento escutando em **todas** as interfaces. Nesta rodada isso nao aconteceu, por
construcao e por prova.

**Antes** (`portas/portas-antes.txt`): a maquina ja estava limpa, a porta 3000 e os emuladores
antigos tinham sido encerrados.

```
--- filtro que a seguranca exige: processo deste repositorio escutando fora do laco de retorno ---
NENHUM processo de a-fabrica escutando porta nenhuma.
```

**Durante** (`portas/portas-durante.txt`): tudo preso ao laco de retorno, inclusive o servidor
de desenvolvimento, que foi subido com `--hostname 127.0.0.1` de proposito.

```
porta 3399   em 127.0.0.1    pid 10148
   comando: node ... painel\node_modules\next\dist\server\lib\start-server.js
porta 8399   em 127.0.0.1    pid 30084   (emulador do Firestore)
porta 9399   em 127.0.0.1    pid 7024    (emulador de Auth)
porta 4399, 4499, 9150 em 127.0.0.1      (hub, registro e websocket do emulador)

--- qualquer processo deste repositorio escutando FORA do laco de retorno ---
NENHUM. Zero processo de a-fabrica escutando fora de 127.0.0.1 ou ::1.
```

**Depois** (`portas/encerramento.txt` e `portas/portas-depois.txt`): encerrei o que subi,
nomeando cada processo.

```
encerrando pid 7024 (node) ... firebase.js emulators:start --config firebase.emulador.json
   taskkill: EXITO: o processo com PID 30084 (processo filho de PID 7024) foi finalizado.
             EXITO: o processo com PID 7024 foi finalizado.
encerrando pid 10148 (node) ... next\dist\server\lib\start-server.js
   taskkill: EXITO: o processo com PID 10148 foi finalizado.

--- 1. as portas que ESTA rodada subiu ---
NENHUMA. Todas as portas desta rodada estao fechadas.

--- 2. qualquer processo do repositorio C:\Users\Henrique\a-fabrica vivo ---
NENHUM. Nenhum servidor de desenvolvimento e nenhum emulador desta rodada continua vivo.
```

A lista de escuta fora do laco de retorno depois da rodada e **identica** a de antes: servicos
do Windows, AnyDesk, ZeroTier, Hyper-V e impressora. Nenhuma linha deste repositorio.

**Aviso honesto:** a conferencia encontrou um emulador do Firebase vivo em
`C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T1330-ost6-emulador-tempo`, portas 8199,
9299, 4699, 4799 e 9151. **Nao e desta rodada**, e de outro agente trabalhando em paralelo
agora, e todas as portas dele estao presas a 127.0.0.1. Nao encerrei processo de outro agente;
registro aqui para quem fechar a OST conferir no fim.

---

## 3. O que ficou faltando

1. **O clique do diretor na tela do Google.** Esta e a parte que so ele pode provar: digitar a
   senha, passar o segundo fator e aceitar o consentimento. Depois disso ficam provados, na
   nuvem: a sessao real, a leitura ao vivo das cinco colecoes contra a base de verdade e o
   painel por dentro no endereco publicado. Tudo o que vem antes e tudo o que vem depois esta
   provado aqui.
2. **A recusa de outra conta contra a nuvem.** Esta provada no emulador, nas duas formas, e
   nao na nuvem, porque eu nao tenho uma segunda conta Google de verdade. Quem tiver uma
   segunda conta repete o roteiro `emulador/05-mensagens-de-recusa.mjs` apontando para o
   endereco publicado.
3. **O segundo fator, §A.6.** Continua fora do alcance deste sistema: o token do Google nao
   carrega essa informacao e a regra do Firestore nao a confere. Isso e a condicao 1 da
   auditoria e segue com o diretor.
4. **O pacote publicado nao tem o texto novo de recusa.** Eu **nao** reconstrui `painel/out`
   de proposito, para que a pasta no disco continue byte a byte igual ao que esta no ar e a
   prova do item 1 continue valendo. Quem for publicar roda
   `npm run construir-para-hospedagem` antes, e a partir dai o painel publicado passa a ter as
   duas frases de recusa.
5. **Validacao visual do diretor, §A.13.** Teste verde e foto nao substituem. As 20 fotos
   desta rodada existem para encurtar a conversa, nao para substituir.

---

## 4. Decisoes tomadas durante a execucao

1. **Consertar o texto de recusa do e-mail nao verificado.** A primeira passada mostrou que os
   dois casos davam a mesma frase, e que a frase dizia "Esta conta não é a do diretor" mesmo
   quando a conta **era** a do diretor, so que sem e-mail verificado. Verdadeiro no efeito,
   errado na causa, e mandaria o diretor procurar o problema no lugar errado. Agora sao duas
   frases, uma por motivo. E a unica mudanca de codigo desta rodada, cabe em nove linhas, e
   esta provada nas duas direcoes. Mantive a prova antiga na pasta, §A.17: a foto
   `12-diretor-sem-email-verificado.png` mostra o texto velho e a `31` mostra o novo.
2. **Nao reconstruir `painel/out`.** Explicado no item 4 da secao acima: a pasta no disco e a
   evidencia de que o que esta publicado nao leva chave. Reconstruir destruiria essa
   correspondencia no meio da propria rodada que a usa como prova.
3. **Mascarar a chave e o id do app em toda a evidencia.** A chave do cliente web e publica e
   a propria hospedagem a serve, mas pasta de rodada versionada nao carrega valor de
   credencial. A varredura no fim confirma: nenhum `AIzaSy` de verdade, nenhum JWT, nenhum id
   de app nos 55 arquivos desta rodada.
4. **Portas altas e proprias, 3399, 8399, 9399.** Em vez de reusar 3000, 8080 e 9099, para que
   qualquer processo encontrado nessas portas seja inequivocamente meu, e para nao brigar com
   o emulador do outro agente que esta rodando em paralelo na mesma maquina.
5. **Provar o e-mail nao verificado pela funcao do widget do emulador,** e nao por um token
   forjado. O widget do emulador de Auth grava `email_verified: true` fixo e nao oferece
   opcao; chamar `finishWithUser` com a reivindicacao certa usa o mesmo caminho de codigo do
   formulario, so que com o valor que interessa. O resultado foi conferido no proprio
   emulador: a conta existe com `emailVerified: false`.
6. **Nao encerrar processo de outro agente.** O emulador de `a-fabrica-lab` ficou vivo, preso
   ao laco de retorno, e esta registrado.

---

## 5. Arquivos e areas alteradas por mim

- `painel/src/dados/autenticacao.ts`: duas frases de recusa em vez de uma, uma para conta
  diferente e outra para e-mail do diretor sem verificacao. Nove linhas, nenhuma mudanca de
  comportamento: quem e recusado continua sendo recusado do mesmo jeito, com `signOut`
  imediato e sem nenhum ouvinte criado.
- `painel/testes/rodada-2026-10-13-131541-nuvem/`: a rodada inteira, 55 arquivos.
  - `nuvem/`: `01-configuracao-da-hospedagem.mjs`, `02-entrada-e-rede.mjs`, as saidas
    `01-saida.txt` e `02-saida.txt`, o `01-init.json.mascarado.json`, o trafego completo em
    `02-trafego-de-rede.json` e tres fotos.
  - `emulador/`: `03-prova-no-emulador.mjs`, `04-caixa-de-comando.mjs`,
    `05-mensagens-de-recusa.mjs`, `semear.mjs`, `semear-ao-vivo.mjs`, as saidas e registros,
    a copia das regras e dos indices usados pelo emulador, e 22 fotos.
  - `portas/`: `conferir-portas.ps1` e os tres retratos da maquina, antes, durante e depois.
  - `07-conferencias-de-codigo.txt`: tipos, escrita, importacao, manipulador, travessao, chave
    e `.gitignore`.
- `docs/ost6-painel-parte2.md`: este relatorio.

Nada mais foi tocado. `painel/out` segue exatamente como foi publicado.

---

## 6. Problemas encontrados

1. **Texto de recusa impreciso para o e-mail nao verificado.** Achado pela propria prova,
   consertado e reprovado. Detalhe na decisao 1.
2. **O motivo da caixa de comando nao aparece no texto da pagina.** Ele vive no atributo
   `placeholder` do campo, por desenho do pacote do designer. Quem conferir o painel lendo so
   o texto corrido vai concluir, errado, que a caixa nao diz por que esta parada. Ela diz, e
   esta fotografado de perto. Fica o registro para a proxima auditoria nao tropecar nisso.
3. **O emulador de Auth nao deixa criar conta com e-mail nao verificado pelo formulario.**
   Contornado pelo caminho da decisao 5.
4. **Emulador de outro agente vivo na maquina.** Nao e furo, esta no laco de retorno, e nao e
   meu para encerrar. Registrado na secao 2.8.
5. **Nenhum achado grave.** Em especial, nenhum `auth/unauthorized-domain` e nenhum outro erro
   de configuracao do Auth, que era o que a OST mandou avisar na hora se aparecesse.

---

## 7. Proximo passo recomendado

1. **Diretor entra de verdade** em https://a-fabrica-soulan.web.app, com a conta dele, e faz a
   validacao visual, §A.13. O painel vai abrir vazio, porque a base de verdade esta vazia, e e
   exatamente a tela `13-dentro-base-vazia-computador.png` desta rodada.
2. **Diretor olha as fotos do celular** (`20`, `21`, `22`, `25`), que sao as que mais mudam a
   rotina dele, e diz se a ordem de prioridade esta certa: responder aprovacao, ver o que esta
   rodando, mandar comando, ler relatorio.
3. **Coordenador roda `npm run construir-para-hospedagem`** e publica, quando quiser levar o
   texto novo de recusa para o ar. Antes disso o painel publicado continua valido, apenas com
   a frase antiga nos dois casos de recusa.
4. **Seguranca reaudita** a lista do item 7 dela com este relatorio na mao: os pontos 1, 7 e o
   que ela chamou de "nenhuma porta de entrada viva na maquina" estao cobertos aqui; o segundo
   fator e a parte da nuvem com sessao real continuam com o diretor.
5. **So entao abrir a Onda 2**, levando o recado que `docs/ost6-painel.md` ja deixou na secao
   2.3: hora do servidor obrigatoria, `respondidoPor` preenchido, pacote completo para criar
   comando e transicao de situacao unica.
