# OST 7 Bloco 2, metade do PAINEL: a Onda 2, comandar e aprovar

Agente: **frontend** (telas do painel, computador e celular). A metade da ponte foi
feita em paralelo por outro agente, sobre o mesmo contrato, e nada em `painel/` foi
tocado por ele.

Base: `CLAUDE.md` e `docs/ost7-contrato-onda2.md`. O contrato não foi alterado.

---

## 1. O que foi solicitado

Transformar o painel, que estava em modo leitura (zero escritas no Firestore e
controles desabilitados dizendo "entra na Onda 2"), no posto de comando da Onda 2:

1. camada de escrita única, em `painel/src/dados/escritas.ts`, com abrir fábrica,
   mandar comando, encerrar, pausar, reiniciar e responder aprovação, tudo com hora
   de servidor, situação nascendo pendente e origem legível;
2. tela de nova fábrica, com projeto, agente, modelo e comando inicial, sem inventar
   cadastro de projetos (F7 está fora desta OST);
3. caixa de comando viva na tela da fábrica;
4. fila de aprovação viva, com as três respostas, mostrando na tela o que é fato
   capturado e o que é leitura da ponte;
5. encerrar fábrica sempre com confirmação, mais pausar e reiniciar;
6. regras duras: travessão proibido, tela única sem rolagem no computador, alvo de
   toque de 44 pontos no celular, tokens.json como fonte única de estilo, nenhum
   botão de escrita clicável com a ponte offline e com a tela dizendo por quê, erro
   de escrita mostrado em português, escopo fechado.

---

## 2. O que foi feito

### 2.1 Camada de escrita, a porta única

`painel/src/dados/escritas.ts`, arquivo novo. É o único lugar do painel que chama
`addDoc` ou `updateDoc`, e por isso as regras duras cabem numa leitura só:

- **Sem usuário autenticado, nada sai.** Toda função começa por `conferir()`, que
  exige base ligada, usuário presente, e-mail igual ao do diretor e e-mail
  verificado pelo provedor. A `Firestore` só aparece dentro do objeto que `conferir`
  devolve: sem passar pela guarda, não existe base para escrever.
- **Hora de servidor sempre.** `criadoEm` e `respondidoEm` saem de
  `serverTimestamp()`. A regra do Firestore compara com `request.time` e nega hora de
  cliente, então errar isso quebraria tudo.
- **Situação nasce pendente**, e só a ponte marca entregue.
- **Origem legível**, por exemplo `painel no computador, henrique.vieira@soulan.com.br`.
  O painel distingue computador de celular, porque a trilha não se apaga e precisa
  dizer de onde veio a ordem.
- **Texto sempre preenchido**, inclusive em encerrar, pausar e reiniciar, com a frase
  que o diretor leria na trilha: `encerrar a fábrica`, `pausar a fábrica`,
  `retomar a fábrica pausada`, `reiniciar a fábrica`.
- **Ponte offline não escreve.** Falha fechada: na dúvida recusa.
- Nenhuma função lança exceção para a tela. Todas devolvem resultado, com erro em
  português, sem código e sem jargão.

O campo novo `acao` segue a tabela da seção 2 do contrato: `abrir` leva `cwd`,
`agente` e `modelo`; `comando` leva `conversationId` quando existe; `encerrar`,
`pausar` e `reiniciar` não levam campo extra, e `reiniciar` leva `conversationId`.

### 2.2 Tela de nova fábrica

`painel/src/telas/NovaFabrica.tsx`, com dois desenhos, computador e celular, e as
mesmas regras.

- **Projeto:** os caminhos que já apareceram na base aparecem como escolha rápida, e
  um campo aceita caminho escrito à mão. Nenhum projeto é inventado. A tela diz, com
  essas palavras, que o cadastro de projetos entra em Configurações numa onda
  seguinte.
- **Agente:** campo de texto com o padrão `claude code`, que é o que a ponte usa
  hoje. Nenhuma lista de agentes foi inventada.
- **Modelo:** escolha entre `Padrão da ponte` e `Escolher na mão`. Herdar o padrão é
  o caminho recomendado e não escreve o campo `modelo`, para a ponte usar o dela.
  Escolher na mão pede o identificador exato, com exemplo da forma do identificador
  no texto de apoio. Nenhuma lista de modelos foi inventada.
- **Comando inicial:** obrigatório.
- Painel lateral `Antes de nascer` diz o que a ponte faz antes de abrir: confere o
  portão com isca, limpa o ambiente e fixa o modo de permissão. Isso é informação, e
  não promessa: o painel não abre fábrica, ele registra a ordem.

### 2.3 Caixa de comando viva

`CommandBox` ligado de verdade na tela da fábrica, no computador e no celular. O
componente do pacote ganhou três acréscimos do painel, documentados no próprio
arquivo:

- `onSend` pode devolver promessa, e enquanto ela não volta a caixa fica em
  `Enviando` e não aceita segundo envio, para a mesma ordem não entrar duas vezes na
  fila;
- o texto só é limpo quando a ordem foi registrada de verdade. Se a escrita falhar, o
  que o diretor escreveu continua no campo;
- o erro aparece acima do campo, em português, e não desaparece sozinho.

### 2.4 Fila de aprovação viva

`painel/src/telas/Aprovacoes.tsx`, tela nova no computador, mais a fila do celular e
o atalho na Visão geral. Três respostas, como o contrato manda: aprovar, recusar com
motivo opcional, aprovar com observação obrigatória. O botão de aprovar com
observação fica desabilitado enquanto a observação estiver vazia.

A marcação de honestidade da OST 2 está na cara, e não escondida: cada campo do
pacote mostra se é **fato capturado** (ponto verde) ou **leitura da ponte** (ponto
âmbar), e `oQueSeraTocado` mostra **fato mais leitura da ponte**. Uma linha curta
explica a diferença na própria tela.

O histórico das respostas, com filtro de todas, aprovadas e recusadas, sai do mesmo
ouvinte da fila, sem leitura nova na base. Ele estava prometido na tela da Onda 1
("responder, com histórico e filtro, entra junto da Onda 2"), e por isso entrou.

### 2.5 Encerrar, pausar e reiniciar

- **Encerrar sempre confirma.** No computador a confirmação é a folha do pacote do
  designer, centrada; no celular ela sobe do pé, como o manual manda. O botão de
  desistir se chama `Deixar rodando` e não escreve nada, o que está medido.
- **Pausar e retomar**: o primeiro botão do cabeçalho diz `Pausar` ou `Retomar`
  conforme o campo `pausada` que a ponte escreve, e não conforme o estado, porque
  §A.4 fecha a lista de estados.
- No celular as três ordens moram numa folha que sobe do pé, com alvo de toque de 44.

---

## 3. O que ficou faltando, dito como pendência e não como esquecimento

- **Aviso no celular (F8).** Fora desta OST, e depende de plano pago no Google Cloud.
- **Relatórios, Indicadores e Configurações.** Continuam como destino inerte, dizendo
  na tela em que onda entram. A tela `Fábricas` do menu também segue inerte, porque a
  Visão geral já lista as fábricas.
- **Cadastro de projetos (F7).** Enquanto não existir, a tela de nova fábrica oferece
  o que a base já viu e aceita caminho escrito à mão, como o contrato previu.
- **Comandos salvos.** É Onda 5. A caixa de comando entra sem o atalho.
- **Prova contra a base real.** Tudo o que está abaixo foi provado contra EMULADOR,
  não contra a nuvem. A validação visual do diretor continua pendente, §A.13.

---

## 4. Decisões tomadas durante a execução

1. **`fabricaId` da fábrica que nasce pelo painel.** O comando de abrir precisa do
   campo `fabricaId` preenchido, e a fábrica ainda não existe. O painel gera o
   identificador com o prefixo `painel-`, pelo mesmo motivo que a fábrica aberta na
   mão usa `mao-`: ler o identificador e saber de onde ela nasceu. **A ponte precisa
   usar esse identificador**, e não gerar outro, senão a fábrica nasce com nome
   diferente do que o painel registrou na trilha.
2. **Ordem da consulta de aprovações.** A consulta era crescente com limite de 50, o
   que guardava as 50 mais ANTIGAS: um dia de respostas acumuladas empurraria o
   pedido novo, que é justamente o que está parado esperando, para fora da janela.
   Passou a decrescente com limite de 100, e a ordem da fila (mais antiga primeiro)
   é refeita em memória. Continua sendo consulta de um campo só, sem índice composto.
3. **O pacote inteiro não cabe na coluna da tela da fábrica.** Medido: espremido em
   340 pontos, o pacote ficava ilegível. Na tela da fábrica ficou o aviso curto, com
   risco, título e o botão de aprovar; recusar e aprovar com observação ficam na fila,
   junto do pacote completo. Decidir sobre risco sem conseguir ler o pacote seria pior
   do que um clique a mais.
4. **Um aviso por vez, e a casca é a dona dele.** Medido na rodada: com cada controle
   guardando o seu aviso, dois apareciam no mesmo ponto da tela e o antigo cobria o
   novo. O aviso subiu para a casca.
5. **Confirmação com fundo sólido**, usando `gf-panel-solid` do próprio pacote, e não
   vidro: o que não tem volta precisa ser lido sem o texto de trás aparecendo por
   baixo.
6. **`Segmented` entrou no design system portado** (20 dos 24 componentes do pacote),
   porque a tela de nova fábrica e o filtro do histórico o usam.
7. **Alvo de toque do celular**: a medição achou campo de digitar com 40 pontos e a
   caixa de comando com 36. Os dois subiram para a medida de toque de tokens.json.
8. **Texto da marcação de origem**: `fato capturado`, `leitura da ponte` e
   `fato mais leitura da ponte`, com ponto verde para fato e âmbar para leitura.

---

## 5. Arquivos e áreas alteradas

Novos:

- `painel/src/dados/escritas.ts`, camada de escrita, porta única
- `painel/src/telas/NovaFabrica.tsx`, tela de nova fábrica, computador e celular
- `painel/src/telas/Aprovacoes.tsx`, fila de aprovação no computador
- `painel/src/telas/pedido.tsx`, o pedido da base para a tela, e as três respostas
- `painel/src/telas/usarOrdem.ts`, estado de uma ordem saindo do painel
- `painel/src/componentes/ds/Segmented.tsx`, componente do pacote portado

Alterados:

- `painel/src/componentes/ds/CommandBox.tsx`, envio assíncrono, erro e pendência
- `painel/src/componentes/ds/ApprovalItem.tsx`, marcação de origem, observação
  obrigatória, pendência e erro
- `painel/src/componentes/ds/ApprovalDeck.tsx`, repasse das respostas
- `painel/src/componentes/ds/FactoryHeader.tsx`, `paused` e `busy`
- `painel/src/componentes/ds/index.ts`, exporta `Segmented`
- `painel/src/dados/tipos.ts`, campos novos de `fabricas` e do pacote
- `painel/src/dados/tradutor.ts`, `maquinaId` da ponte, `pausada`, marcação de
  origem, decisões do histórico e caminhos de projeto
- `painel/src/dados/ouvintes.ts`, ordem da consulta de aprovações
- `painel/src/dados/painel.ts`, decisões já respondidas no estado do painel
- `painel/src/telas/textos.ts`, os motivos deixaram de dizer "entra na Onda 2"
- `painel/src/telas/pecas.tsx`, confirmação, aviso, erro de escrita, campo e marca de
  origem
- `painel/src/telas/Computador.tsx`, `Celular.tsx`, `FabricaTela.tsx`,
  `VisaoGeral.tsx`, telas novas e controles vivos
- `painel/app/page.tsx`, contexto de escrita
- `painel/app/globals.css`, alvo de toque dos controles novos, folha de confirmação,
  erro, aviso e marcação de origem

Nada fora de `painel/`, `docs/ost7-painel.md` e as pastas de rodada em
`painel/testes/` foi tocado.

---

## 6. Problemas encontrados

1. **A tela de aprovação da fábrica ficava ilegível** espremida na coluna de 340
   pontos. Corrigido, ver decisão 3.
2. **Dois avisos no mesmo ponto da tela**, com o antigo cobrindo o novo. Corrigido,
   ver decisão 4.
3. **Alvo de toque abaixo do manual** em dois campos do celular. Corrigido e medido.
4. **A marcação de origem saía pela borda no celular**, quando o título tinha palavra
   longa, como nome de tabela. Corrigido com quebra de linha.
5. **`next build` com o servidor de desenvolvimento no ar** sobrescreve `.next` e o
   painel passa a servir o pacote de produção, sem a configuração de emulador. Isso
   custou uma rodada, que caiu tentando entrar no Google de verdade. Fica registrado:
   não construir com o servidor de desenvolvimento no ar.
6. **O emulador do coordenador já tinha documentos** da prova da ponte, o que
   confundiria a autoria do que apareceu em `comandos`. Resolvido subindo um emulador
   próprio do painel, em portas próprias, com base limpa.

---

## 7. Conferências, com saída real

### 7.1 Tipos e construção

```
$ npm run tipos
> painel-a-fabrica@0.1.0 tipos
> tsc --noEmit

$ npm run build
> painel-a-fabrica@0.1.0 build
> next build
 ✓ Compiled successfully
 ✓ Generating static pages (4/4)
Route (app)                              Size     First Load JS
┌ ○ /                                    134 kB          221 kB
└ ○ /_not-found                          873 B          88.3 kB
○  (Static)  prerendered as static content
```

### 7.2 A porta de escrita é uma só

```
$ grep -rn "addDoc\|setDoc\|updateDoc\|deleteDoc\|writeBatch\|runTransaction" src/ app/ --include="*.ts" --include="*.tsx"
src/dados/escritas.ts:6: * Nenhuma tela chama addDoc, setDoc ou updateDoc. Toda ordem que sai do painel
src/dados/escritas.ts:35:import { addDoc, collection, doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore';
src/dados/escritas.ts:178:    const criado = await addDoc(collection(pronto.base, 'comandos'), documento);
src/dados/escritas.ts:316:    await updateDoc(doc(pronto.base, 'aprovacoes', aprovacaoId), {
```

Duas escritas no painel inteiro, as duas em `escritas.ts`, e nenhuma em `fabricas`,
`atividade`, `maquinas` ou `relatorios`, que são da ponte.

### 7.3 Nenhuma escrita sem usuário autenticado

```
$ grep -n "conferir(ctx)\|function conferir\|EMAIL_DO_DIRETOR\|emailVerified" src/dados/escritas.ts
36:import { EMAIL_DO_DIRETOR } from './firebase';
86:function conferir(ctx: ContextoDeEscrita): Confirmado | { impedimento: Impedimento } {
90:  if (!quem || !email || email !== EMAIL_DO_DIRETOR || !quem.emailVerified) return { impedimento: 'sem sessao' };
153:  const pronto = conferir(ctx);
304:  const pronto = conferir(ctx);
339:  const pronto = conferir(ctx);
```

Linha 153 é a entrada de `escreverComando`, que é por onde passam as cinco ações de
comando; linha 304 é `responderAprovacao`; linha 339 é a consulta que a tela usa para
desabilitar o controle antes de qualquer clique. A `Firestore` só existe dentro do
objeto devolvido por `conferir`, então não há caminho de código que escreva sem ela:

```
interface Confirmado {
  base: Firestore;
  origem: string;
  maquinaId: string;
}

function conferir(ctx: ContextoDeEscrita): Confirmado | { impedimento: Impedimento } {
  if (!ctx.base) return { impedimento: 'sem base' };
  const quem = ctx.usuario;
  const email = (quem?.email ?? '').toLowerCase();
  if (!quem || !email || email !== EMAIL_DO_DIRETOR || !quem.emailVerified) return { impedimento: 'sem sessao' };
  if (!ctx.pontePronta) return { impedimento: 'ponte offline' };
  const maquinaId = (ctx.maquinaId ?? '').trim();
  if (!maquinaId) return { impedimento: 'sem maquina' };
  return { base: ctx.base, origem: `painel no ${ctx.celular ? 'celular' : 'computador'}, ${email}`, maquinaId };
}
```

### 7.4 Toda hora de trilha é hora de servidor

```
$ grep -rn "serverTimestamp\|criadoEm:\|respondidoEm:\|new Date()\|Date.now()" src/dados/escritas.ts
13: *  2. HORA DE SERVIDOR SEMPRE. criadoEm e respondidoEm saem de serverTimestamp()
35:import { addDoc, collection, doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore';
135:      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
168:    criadoEm: serverTimestamp(),
320:    respondidoEm: serverTimestamp(),

$ grep -rn "Date.now()\|new Date()" src/ app/ --include="*.ts" --include="*.tsx" | grep -v "escritas.ts"
src/dados/ouvintes.ts:124:  const [agora, setAgora] = useState(() => new Date());
src/dados/ouvintes.ts:126:    const id = setInterval(() => setAgora(new Date()), intervaloMs);
src/dados/tradutor.ts:152:export function avaliarPonte(maquinas: MaquinaBase[], agora: Date = new Date()): Ponte {
src/dados/tradutor.ts:227:  const agora = opcoes.agora ?? new Date();
src/dados/tradutor.ts:385:export function traduzirAprovacao(doc: AprovacaoBase, agora: Date = new Date()): Aprovacao {
src/dados/tradutor.ts:429:export function traduzirDecisao(doc: AprovacaoBase, agora: Date = new Date()): Decisao | null {
src/dados/tradutor.ts:533:export function traduzirTarefa(doc: TarefaBase, agora: Date = new Date()): Tarefa {
src/formato.ts:72:export function dataAmigavel(data: Date | null, agora: Date = new Date()): string {
```

Os dois campos de trilha que o painel escreve usam `serverTimestamp()`. O único
`Date.now()` da camada de escrita, na linha 135, é o sorteio do identificador quando
o navegador não tem `crypto.randomUUID`, e não vai para campo de hora. Todas as
outras horas são relógio de LEITURA, para a tela dizer "parado há 18 min" sem esperar
escrita nova da ponte.

### 7.5 Travessão, §A.11

```
$ grep -rn $'—\|–' src/ app/ --include="*.ts" --include="*.tsx" --include="*.css"
codigo de saida do grep: 1 (1 = nenhuma ocorrencia)

$ grep -c $'—\|–' out/index.html .next/static/chunks/*.js | grep -v ":0"
codigo de saida: 1 (1 = nenhum arquivo com ocorrencia)
```

Nenhum travessão no código e nenhum no que a tela entrega, incluindo mensagem de erro
e texto de confirmação.

### 7.6 tokens.json como fonte única

```
$ grep -rn "#[0-9a-fA-F]\{3,8\}\b" src/ app/globals.css --include="*.ts" --include="*.tsx" --include="*.css"
codigo de saida: 1 (1 = nenhuma ocorrencia)

$ grep -rn "rgba\?(\|hsla\?(" src/ app/globals.css --include="*.ts" --include="*.tsx" --include="*.css"
codigo de saida: 1 (1 = nenhuma ocorrencia)
```

Nenhuma cor escrita à mão. Todo bloco novo do `globals.css` usa `var(--token)`,
inclusive espaçamento, raio e a medida de toque.

Exceção declarada, para ninguém descobrir depois: duas alturas mínimas de área de
texto continuam em pixel no estilo da tela de nova fábrica (`minHeight: 120` no
computador e `minHeight: 60` no celular). Não existe token de altura de campo de
texto em tokens.json, e a prática já existia desde a Onda 1 nas montagens de tela.

### 7.7 Nenhum botão de escrita clicável com a ponte offline

A mesma guarda da camada de escrita é quem decide o que a tela desabilita:

```
$ grep -rn "impedimentoDaEscrita" src/ --include="*.tsx" --include="*.ts"
src/dados/escritas.ts:338:export function impedimentoDaEscrita(ctx: ContextoDeEscrita): Impedimento | null {
src/telas/Celular.tsx:124:  const motivoDeAbrir = motivoDeAbrirFabrica(impedimentoDaEscrita(escrita));
src/telas/Computador.tsx:93:  const motivoDeAbrir = motivoDeAbrirFabrica(impedimentoDaEscrita(escrita));
src/telas/FabricaTela.tsx:65:  const motivo = motivoDasAcoesDaFabrica(impedimentoDaEscrita(escrita));
src/telas/FabricaTela.tsx:109:  const motivo = motivoDaCaixaDeComando(impedimentoDaEscrita(escrita));
src/telas/NovaFabrica.tsx:59:  const impedimento = impedimentoDaEscrita(escrita);
src/telas/pedido.tsx:40:  const motivo = motivoDaDecisao(impedimentoDaEscrita(escrita));
```

---

## 8. Prova ao vivo, contra EMULADOR

Rotulado com todas as letras: **emulador, não a base real**. A nuvem não foi tocada.

- Emulador próprio do painel, subido com `painel/testes/rodada-2026-10-13-235607-onda2-entrega/firebase.emulador.json`:
  Firestore `127.0.0.1:8299`, Authentication `127.0.0.1:9399`. Portas próprias para
  não colidir com o emulador da ponte, que nesta noite ocupava 8099 e 9199, e para a
  base da prova nascer limpa: `comandos` começou em zero, então todo documento que
  aparece abaixo foi o painel que escreveu.
- Regras carregadas: cópia de `firebase/firestore.rules`, guardada na própria rodada
  como `firestore.rules.copia`.
- Evidência: `painel/testes/rodada-2026-10-13-235607-onda2-entrega/`, com 33 prints em
  `telas/`, a saída crua em `saida-da-prova.txt` e as medidas em `medidas.json`.

### 8.1 Abrir fábrica pela tela de nova fábrica

```
{"passo":"1 abrir fabrica pela tela de nova fabrica","comandosDoPainel":1,"documento":{
 "id":"eRmACHjICf39NdsopmHH","acao":"abrir","situacao":"pendente",
 "criadoEm":"2026-10-14T02:56:21.742Z","entregueEm":"ausente",
 "origem":"painel no computador, henrique.vieira@soulan.com.br",
 "fabricaId":"painel-f53285d9-4bef-42d8-a0f2-47f65ef1f595","maquinaId":"maquina-do-diretor",
 "texto":"Implemente o envio de documentos e me peça aprovação antes de mexer no banco.",
 "cwd":"~/projetos/app-do-colaborador","agente":"claude code","modelo":"ausente"}}
```

`modelo: ausente` é o caminho de herdar o padrão da ponte: o campo não é escrito.

### 8.2 Mandar comando pela caixa viva

```
{"passo":"2 mandar comando pela caixa viva","comandosDoPainel":2,"documento":{
 "id":"N0U3ADNHt7m1KYVgRtRD","acao":"comando","situacao":"pendente",
 "criadoEm":"2026-10-14T02:56:24.801Z","entregueEm":"ausente",
 "origem":"painel no computador, henrique.vieira@soulan.com.br",
 "fabricaId":"fab-portal","conversationId":"conversa-fab-portal",
 "texto":"Rode os testes do fluxo de documentos e me diga o que quebrou."}}
```

### 8.3 Encerrar com confirmação, e o cancelar não escrevendo nada

```
{"passo":"4a cancelar o encerramento nao escreve nada","comandosAntes":2,"comandosDepois":2,"escreveu":false}
{"passo":"4b encerrar com confirmacao","documento":{"id":"c0PuApAd9Ddv1uVUHBLu","acao":"encerrar",
 "situacao":"pendente","criadoEm":"2026-10-14T02:56:29.702Z",
 "origem":"painel no computador, henrique.vieira@soulan.com.br",
 "fabricaId":"fab-portal","texto":"encerrar a fábrica"}}
{"passo":"4d celular, cancelar o encerramento nao escreve nada","comandosAntes":7,"comandosDepois":7,"escreveu":false}
```

### 8.4 Pausar e retomar

```
{"passo":"4c retomar a fabrica pausada","documento":{"acao":"reiniciar","situacao":"pendente",
 "fabricaId":"fab-base","texto":"retomar a fábrica pausada","conversationId":"conversa-fab-base"}}
{"passo":"4c pausar a fabrica que esta rodando","documento":{"acao":"pausar","situacao":"pendente",
 "fabricaId":"fab-folha","texto":"pausar a fábrica"}}
```

### 8.5 As três respostas de aprovação

```
{"passo":"3a aprovar com observacao","travadoSemObservacao":true,"documento":{
 "id":"ap-1","situacao":"respondida","resposta":"aprovado com observacao",
 "observacao":"Pode seguir, mas rode a migração de volta se algo falhar.",
 "respondidoEm":"2026-10-14T02:53:05.611Z",
 "respondidoPor":"painel no computador, henrique.vieira@soulan.com.br"},
 "marcacaoDeOrigemNaTela":["leitura da ponte","fato capturado","leitura da ponte",
 "leitura da ponte","fato capturado","fato mais leitura da ponte"]}

{"passo":"3b recusar com motivo","documento":{"id":"ap-3","situacao":"respondida","resposta":"recusado",
 "observacao":"Não mexa no cache agora, estou usando o build.",
 "respondidoPor":"painel no computador, henrique.vieira@soulan.com.br"}}

{"passo":"3c aprovar","documento":{"id":"ap-2","situacao":"respondida","resposta":"aprovado",
 "observacao":null,"respondidoPor":"painel no computador, henrique.vieira@soulan.com.br"}}
```

`travadoSemObservacao: true` é o botão de aprovar com observação desabilitado
enquanto a observação está vazia. `marcacaoDeOrigemNaTela` foi lido do próprio HTML do
pedido, e é a marcação da OST 2 aparecendo na tela.

### 8.6 A forma de tudo o que o painel escreveu

```
{"passo":"tudo o que o painel escreveu em comandos, no computador","total":5,
 "porAcao":{"comando":1,"encerrar":1,"abrir":1,"reiniciar":1,"pausar":1},
 "todosPendentes":true,"todosComHoraDeServidor":true,
 "todosComOrigemLegivel":true,"todosComTexto":true}

{"passo":"tudo o que o painel escreveu em comandos, no fim da prova","total":7,
 "porAcao":{"abrir":2,"pausar":1,"comando":2,"encerrar":1,"reiniciar":1},
 "porOrigem":{"painel no celular, henrique.vieira@soulan.com.br":2,
 "painel no computador, henrique.vieira@soulan.com.br":5}}
```

### 8.7 Celular: alvo de toque de 44 e tela que não rola

```
{"passo":"5 celular, alvo de toque e rolagem da pagina",
 "aprovacoes":{"rolagemDaPagina":0,"totalDeAlvos":10,"abaixoDe44":[]},
 "respostaComObservacao":{"rolagemDaPagina":0,"totalDeAlvos":10,"abaixoDe44":[]},
 "fabricas":{"rolagemDaPagina":0,"totalDeAlvos":10,"abaixoDe44":[]},
 "novaFabrica":{"rolagemDaPagina":0,"totalDeAlvos":10,"abaixoDe44":[]},
 "fabrica":{"rolagemDaPagina":0,"totalDeAlvos":5,"abaixoDe44":[]},
 "folhaDeAcoes":{"rolagemDaPagina":0,"totalDeAlvos":9,"abaixoDe44":[]},
 "confirmacao":{"rolagemDaPagina":0,"totalDeAlvos":7,"abaixoDe44":[]}}
```

Sete telas do celular medidas, nenhum alvo abaixo de 44 pontos e nenhuma rolagem de
página. A medição inclui botão, campo de digitar, área de texto e opção de escolhedor.

### 8.8 Ponte offline: nada clicável, e a tela diz por quê

```
{"passo":"6 ponte offline no computador",
 "offlineAprovacoes":{"pedidosNaFila":"3",
  "botoes":[{"texto":"Aprovar","desabilitado":true},
            {"texto":"Aprovar com observação","desabilitado":true},
            {"texto":"Recusar","desabilitado":true}],
  "motivo":"A ponte está offline, a resposta não chega à fábrica até ela voltar."},
 "offlineAbrir":{"desabilitado":true,
  "motivo":"A ponte está offline, a fábrica só nasce quando ela voltar."},
 "offlineFabrica":{"acoes":[{"texto":"Pausar","desabilitado":true},
                            {"texto":"Reiniciar","desabilitado":true},
                            {"texto":"Encerrar","desabilitado":true}],
  "motivoDasAcoes":"A ponte está offline. Pausar, reiniciar e encerrar voltam quando ela voltar.",
  "caixaDesabilitada":true,
  "motivoDaCaixa":"A ponte está offline, nenhuma ordem sai daqui até ela voltar.",
  "botaoEnviarDesabilitado":true}}

{"passo":"6 ponte offline no celular",
 "offlineCelular":{"caixaDesabilitada":true,
  "motivoDaCaixa":"A ponte está offline, nenhuma ordem sai daqui até ela voltar.",
  "acoesDesabilitadas":true,
  "motivoDasAcoes":"A ponte está offline. Pausar, reiniciar e encerrar voltam quando ela voltar."},
 "offlineAbrirCelular":{"desabilitado":true}}
```

### 8.9 Prints para a validação visual

Em `painel/testes/rodada-2026-10-13-235607-onda2-entrega/telas/`. Os principais:

| Print | O que mostra |
| --- | --- |
| `02-computador-nova-fabrica.png` | tela de nova fábrica, com escolha rápida de pasta, agente, modelo e comando |
| `04-computador-fabrica-caixa-viva.png` | posto de comando com caixa viva e o aviso de aprovação parada |
| `06b-computador-confirmacao-assentada.png` | confirmação de encerrar, no computador |
| `10-computador-aprovacoes-pacote-com-origem.png` | fila com o pacote inteiro e a marcação de fato e leitura |
| `11-computador-observacao-obrigatoria.png` | aprovar com observação, com o botão travado sem texto |
| `15-computador-aprovado-e-historico.png` | histórico das respostas, com filtro |
| `17-computador-ponte-offline-visao-geral.png` | ponte offline, tudo travado e dito |
| `19-celular-aprovacoes.png` | fila no celular, pacote completo e três respostas |
| `23-celular-nova-fabrica.png` | nova fábrica no celular |
| `27-celular-folha-de-acoes.png` | folha de pausar, reiniciar e encerrar |
| `28-celular-confirmacao-de-encerrar.png` | confirmação no celular |

Rodadas anteriores desta noite, preservadas por §A.17, com a evidência parcial de cada
etapa: `rodada-2026-10-13-232726-onda2`, `rodada-2026-10-13-234558-onda2-prova-final`
e `rodada-2026-10-13-235054-onda2-codigo-entregue`.

---

## 9. O que a metade da ponte precisa saber

Nada aqui muda o contrato; são consequências dele, que valem conferir no encaixe:

1. **`fabricaId` do comando de abrir vem do painel**, com prefixo `painel-`. A ponte
   deve usar esse identificador, e não gerar outro.
2. **`modelo` ausente significa herdar o padrão da ponte.** O painel só escreve o
   campo quando o diretor escolheu na mão.
3. **`agente` chega como texto livre**, com `claude code` por padrão.
4. **`pausada` é a ponte quem escreve.** O painel só registra a ordem de pausar e de
   retomar; enquanto a ponte não mudar o campo, a tela continua dizendo pausada, e
   isso está certo.
5. **`reiniciar` leva `conversationId`** quando a ponte informou um.
6. O painel nunca escreve em `fabricas`, `atividade`, `maquinas` nem `relatorios`.

---

## 10. Próximo passo recomendado

1. **Validação visual do diretor, §A.13.** Teste verde não é funcionalidade aprovada.
   Os prints da seção 8.9 são o material.
2. **Encaixe com a metade da ponte**, com uma rodada conjunta: o painel escreve, a
   ponte consome e devolve, no mesmo emulador.
3. **Prova contra a base real**, depois que a ponte tiver sessão, com uma fábrica de
   verdade aberta pelo painel.
4. **Propostas ao diretor, não construídas:** `pausada` como estado de primeira classe
   no §A.4; cadastro de projetos em Configurações, que hoje é caminho escrito à mão;
   comandos salvos na caixa de comando, que é Onda 5.
