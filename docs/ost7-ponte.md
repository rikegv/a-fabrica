# OST 7 Bloco 2, a metade da PONTE: as cinco ações da Onda 2

Agente: **ponte** (§A.15). O Bloco 1 (ganchos) e a metade do painel são de outros
agentes e não foram tocados aqui.

Base deste trabalho: `docs/ost7-contrato-onda2.md`, que não foi alterado. Há duas
propostas ao coordenador no fim deste documento, nenhuma delas construída por
conta própria (§A.12).

## 1. O que foi solicitado

Dar à ponte as cinco ações do contrato, pelo campo `acao` do documento de comando:
`abrir` (com `agente` e `modelo` chegando ao Claude Code de verdade), `comando`
(o caminho da Onda 1, intocado), `encerrar`, `pausar` e `reiniciar`. Manter o
portão da OST 4 inteiro em toda abertura, falha fechada, nenhum `any` nos caminhos
de decisão, só conexão de saída, e escrever `origem: 'painel'` nas fábricas que
nascem por comando do painel.

## 2. O que foi feito

### 2.1 O roteador das cinco ações

`ponte/src/acoes.ts` é novo e é o único lugar que decide o que uma ordem faz. Ele
recebe um comando já tomado da base e devolve uma decisão explicada. Não conhece
Firestore: fala com o mundo por portas injetadas, e é isso que permitiu provar as
cinco ações com o Claude Code de verdade mesmo antes de a base real existir.

| Ação | O que a ponte faz |
| --- | --- |
| `abrir` | Fábrica nova, com `agente` e `modelo` do comando, `origem: 'painel'`, `pausada: false` |
| `comando` | Caminho da Onda 1, igual, com `resume` quando o comando traz conversa |
| `encerrar` | Aborta a sessão viva, estado `concluida`, `encerradaEm` em hora do servidor, `pedidoDeEncerramento`, solta a trava, e a fábrica não volta |
| `pausar` | Aborta a sessão viva guardando o `conversationId`, estado `aguardando comando` com `pausada: true` |
| `reiniciar` | Retoma com `resume` no `conversationId` guardado e limpa `pausada` |

Compatibilidade: comando **sem** o campo `acao` vale como `comando`. Os sete
testes da OST 6 passaram sem uma linha de mudança neles, provado no item 4.

Ação presente e não reconhecida é **recusada**, com o motivo gravado na base, e
nada abre. Falha fechada, §A.6.

### 2.2 O campo `agente` chegando ao Claude Code, pelo caminho suportado do kit

Existe forma suportada no kit instalado, e ela foi usada. Em
`ponte/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`, `Options` traz:

- `agent?: string`, "Agent name for the main thread. When specified, the agent's
  system prompt, tool restrictions, and model will be applied to the main
  conversation. The agent must be defined either in the `agents` option or in
  settings." Equivale à bandeira `--agent` da linha de comando.
- `agents?: Record<string, AgentDefinition>`, para definir o agente.

A ponte abre a sessão com `settingSources: []`, de propósito, para nenhum projeto
poder instalar permissão ou gancho que passe por cima do portão. O preço é que o
kit não descobre sozinho os agentes de `.claude/agents`. Então
`ponte/src/personas.ts` **lê** o arquivo do agente que o diretor já escreve hoje
(`<projeto>/.claude/agents/<nome>.md` e depois `~/.claude/agents/<nome>.md`) e
entrega a definição pela opção `agents`. Leitura e nada mais: nenhum arquivo de
configuração do diretor é criado, alterado ou removido, §A.9.

Provado ao vivo: um agente de prova, escrito dentro da pasta da rodada, manda
começar toda resposta com `PROVADO-OST7`. O agente obedeceu uma instrução que
existia **só** no arquivo do agente. Saída real no item 4.

O que a ponte **não** importa do arquivo, e por quê:

1. `tools`. O controle de verdade é o portão, que segura toda chamada de risco até
   o diretor responder. E a ressalva 1 precisa que a isca de escrita seja
   alcançável: com a lista de ferramentas do agente aplicada, um agente sem
   ferramenta de escrita faria a verificação do portão concluir "portão morto" e a
   fábrica não nasceria por um motivo falso.
2. `permissionMode`. Nunca. O modo é fixado na mão pela ponte e conferido no init.
3. `model`. A ponte grava na definição o modelo resolvido do comando, para o
   arquivo do agente não trocar o modelo que o diretor escolheu no painel.

Sem definição na máquina, a ponte **não inventa persona**: guarda o nome na base e
diz no prompt de abertura, com estas palavras, que a persona veio por instrução e
não por definição de agente.

### 2.3 Interrupção: qual é o caminho real do kit

`Options.abortController?: AbortController` existe e é o caminho usado. O
`interrupt()` do objeto `Query` **não** serve neste desenho: ele só existe no modo
de entrada em fluxo, e a ponte abre com prompt de texto, que fecha a entrada.

`ponte/src/vivas.ts` guarda as fábricas vivas do processo, cada uma com o seu
AbortController, o `conversationId` do init, o motivo da interrupção e uma promessa
que cumpre quando a sessão termina de desmontar. O motivo é gravado **antes** do
aborto, para a sessão abortada por ordem do diretor nunca virar `falhou`, que seria
mentira na tela.

### 2.4 O portão continua inteiro

`abrir`, `comando` e `reiniciar` passam todos por `rodarSessao`, que passa por
`abrirFabrica`, que faz as três ressalvas: isca antes de abrir nas mesmas opções e
ambiente, ambiente limpo, modo fixado e conferido no init. Não existe caminho novo
que dispense isso e não existe bandeira para desligar. A verificação do portão
agora recebe as mesmas escolhas da sessão (modelo e persona incluídos), senão a
isca provaria outra sessão e não esta. `npm run prova:ressalvas` continua passando.

Encerrar, pausar e reiniciar são ordens do diretor pelo painel, não execução de
risco de um agente, então não passam pelo portão de aprovação. O pedido dele já
está na trilha de `comandos`, com hora e origem do servidor.

### 2.5 Validação de borda, porque o valor vem da base

`modelo` e `agente` viram argumento de linha de comando e pedaço de caminho de
arquivo. Modelo fora de `[A-Za-z0-9._-]` é recusado antes de abrir. Nome de agente
com barra, contrabarra, dois pontos, `..` ou caractere de controle é recusado antes
de abrir. Espaço é aceito no nome por um motivo medido: o painel manda
`claude code` nesse campo, que é o valor que a própria ponte grava desde a Onda 1.

## 3. Três defeitos encontrados durante a execução, e corrigidos

Os três apareceram ao rodar contra o emulador. Nenhum deles aparecia em teste de
unidade.

**1. O pedido de aprovação fantasma.** Se a sessão estava parada no portão
esperando o diretor e ele mandava encerrar ou pausar, o pedido ficava `pendente`
para sempre na tela de uma fábrica que já não existe, e uma resposta tardia dele
aprovaria algo que nunca executaria. Agora encerrar e pausar recusam, com motivo,
os pedidos pendentes daquela fábrica (`recusarAprovacoesDaFabrica` em `base.ts`).
Nada executa por causa disso: recusa é o desfecho seguro.

**2. O portão reescrevendo o estado de uma fábrica morta.** `portaoParaBase`
gravava `estado: 'em execucao'` depois de qualquer resposta. Se o diretor tinha
encerrado ou pausado nesse meio tempo, o painel voltava a dizer "em execução" para
uma sessão morta. Agora o portão confere o registro de vivas antes de criar pedido
e antes de reescrever o estado, e recusa quando a fábrica foi interrompida.

**3. A trava solta tarde demais.** Abortar é instantâneo; desmontar a sessão leva
alguns segundos. O diretor pausava e, ao mandar retomar em seguida, ouvia "a
fábrica já está rodando aqui". Pior: o estado final chega à base **antes** de a
trava sair, então o comando mandado assim que a tela diz "concluída" era recusado.
Agora a trava sai antes de o fim ser anunciado, e quem precisa da trava espera a
sessão anterior desmontar, com limite de tempo e só quando ela já está terminando.
Esperar por uma sessão que está no meio do trabalho continua sendo recusa imediata.

## 4. As provas, com saída real

### 4.1 Tipos

```
> a-fabrica-ponte@0.2.0 tipos
> tsc --noEmit -p tsconfig.json
```

Limpo, sem saída. `exactOptionalPropertyTypes` fora, `strict` dentro, nenhum `any`
nos caminhos de decisão.

### 4.2 As cinco ações contra o EMULADOR, com a ponte de verdade como serviço

Rótulo honesto: **emulador**, não a base real. Firestore em `127.0.0.1:8099` e
Authentication em `127.0.0.1:9199`, com as regras publicadas do projeto carregadas.
A prova faz o papel do painel: escreve `comandos` com o campo `acao` e responde
`aprovacoes`. Quem executa é a ponte, em processo separado, com o Claude Code de
verdade. Quem respondeu as aprovações foi a prova no papel do diretor, e cada
resposta está no registro; a ponte não aprova nada sozinha.

Comando: `node dist/testes/prova-acoes-emulador.js`.
Evidência: `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T234154-ost7-acoes-emulador\saida.txt`.

```
ACAO 1, abrir: fabrica nova com agente e modelo vindos do comando
PASSOU abrir: a ponte tomou o comando uma vez e a fabrica foi ao fim: comando entregue true, estado concluida, erro nenhum
PASSOU abrir: a fabrica nasceu com origem painel e com o agente pedido: origem painel, agente provador
PASSOU abrir: o modelo pedido no comando e o que o Claude Code usou: modelo na base claude-haiku-5-5
PASSOU abrir: a conversa da sessao ficou guardada na base: conversa ...
ACAO 2, comando: texto para a fabrica que ja existe, retomando a conversa
PASSOU comando: a ponte executou na fabrica que ja existia, retomando a conversa
ACAO 3, pausar: aborta a sessao viva guardando a conversa
PASSOU pausar: estado aguardando comando com pausada true, contrato secao 3: estado aguardando comando, pausada true
PASSOU pausar: a conversa ficou guardada para o reiniciar
PASSOU pausar: nao sobrou pedido de aprovacao pendente da fabrica pausada, o painel nao mostra pedido fantasma: pedidos pendentes 0
ACAO 4, reiniciar: retoma a conversa guardada e limpa pausada
PASSOU reiniciar: a fabrica voltou, pausada limpa, sem abrir fabrica nova: estado concluida, pausada false
PASSOU reiniciar: retomou a MESMA conversa, nao abriu conversa nova
ACAO 5, encerrar: aborta a sessao viva, estado concluida, sem volta
PASSOU encerrar: estado concluida com encerradaEm em hora do servidor
PASSOU encerrar: o texto do pedido do diretor fica na fabrica, legivel por pessoa
PASSOU encerrar: a fabrica encerrada NAO volta, e o motivo da recusa fica na base
ACAO 6, acao desconhecida: recusada, falha fechada, com motivo
PASSOU acao desconhecida: recusada com motivo na base, e nenhuma fabrica entrou em execucao
ACAO 7, as bordas: ordem para o que nao esta vivo aqui
PASSOU encerrar fabrica que nao existe: recusado, e a ponte NAO finge que encerrou
PASSOU pausar fabrica que nao esta viva: recusado, e nada vira pausada
PASSOU reiniciar sem conversationId: recusado, porque retomar sem conversa seria abrir fabrica nova fingindo ser a antiga
PASSOU o campo agente chegou ao Claude Code pela opcao agent do kit, com definicao lida do arquivo do agente
PASSOU nenhum texto desta rodada traz travessao, §A.11
PASSOU parada limpa: a ponte marcou a maquina como offline, e o painel nao fica mentindo: estadoPonte offline

RESUMO: todas as conferencias passaram
```

### 4.3 Os sete testes da OST 6, sem uma linha de mudança neles

Comando: `npm run testes:emulador`, com o código final já no lugar.

```
RESUMO: 7 de 7 testes passaram
  teste 1: PASSOU, abrir fabrica pela ponte e a atividade chegando na base ao vivo
  teste 2: PASSOU, comando gravado na base e a fabrica executando
  teste 3: PASSOU, pedido de aprovacao com pacote completo, aprovado pela base, e o comando executando
  teste 4: PASSOU, pedido recusado pela base, e nada executando
  teste 5: PASSOU, conexao caindo no meio, nada perdido, nada executado duas vezes
  teste 6: PASSOU, ponte parada, estado virando ponte offline na base
  teste 7: PASSOU, pedido pendente sobrevivendo a reinicio da ponte
ROTULO HONESTO: base no emulador, sessao do Claude Code viva. NAO E o teste ao vivo contra a base real que a OST pede.
```

`ponte/src/testes/sete-testes.ts` não foi tocado. É essa a prova de que comando sem
o campo `acao` continua valendo como `comando`.

### 4.4 A prova sem base, 51 conferências

`ponte/src/testes/prova-acoes.ts`, comando `npm run prova:acoes`. Ela roda o
roteador com documentos de comando montados à mão e, na parte 3, o Claude Code de
verdade com base de memória. Evidência da rodada em
`C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T234529-ost7-prova-acoes\saida.txt`.
Trechos:

```
PASSOU acao AUSENTE vale comando, compatibilidade da OST 6: leu "comando", bruta null
PASSOU acao DESCONHECIDA e recusada: leu null, bruta "explodir"
PASSOU acao que nao e texto e recusada: leu null, bruta "{\"truque\":1}"
PASSOU a definicao NAO importa tools nem permissionMode, e o modelo e o do comando: chaves da definicao: description, prompt, model
PASSOU as opcoes do kit levam modelo, persona, aborto, e o modo continua fixado na mao: model haiku, agent provador, permissionMode default, settingSources []
PASSOU modelo com texto estranho e recusado ANTES de abrir: modelo recusado por seguranca: "haiku; rm -rf /"
PASSOU nome de agente que tenta sair da pasta e recusado ANTES de abrir
PASSOU comando para fabrica aberta na mao NAO reescreve a origem do Bloco 1
  sessao ao vivo 3b: success, texto do agente ate o portao: "PROVADO-OST7"
PASSOU persona aplicada pelo kit: o agente obedeceu a instrucao que estava SO no arquivo do agente
PASSOU depois da pausa a fabrica sai do registro de vivas e a trava e solta: travas no disco: nenhuma
PASSOU sessao abortada por ordem do diretor NAO vira falhou, porque isso seria mentira na tela
PASSOU a fabrica encerrada NAO volta, nem por reiniciar nem por abrir
RESUMO: todas as conferencias passaram
```

### 4.5 As três ressalvas e o Bloco 1 continuam de pé

```
> prova:ressalvas
RESSALVA 1  prova: {"vivo":true,"chamado":1,"iscaExecutou":false}; arquivo da isca existe: false; PASSOU
RESSALVA 3  modo que veio no init: default; modo conferido pela ponte: true; PASSOU
RESUMO: as tres ressalvas SOBREVIVERAM ao porte

> prova:ganchos
RESUMO: todas as regras duras do Bloco 1 passaram
```

## 5. O que ficou faltando, dito sem maquiagem

1. **Base real da nuvem, não provada.** Tudo acima roda contra o emulador. A ponte
   não tem sessão do diretor gravada para a nuvem, porque o login no navegador
   depende de um clique dele. O que o emulador prova: o fluxo das três peças, a
   forma dos documentos, as transições de estado e as regras publicadas. O que ele
   não prova: a identidade real na nuvem e a latência de verdade.
2. **Validação visual do diretor, §A.13.** Não houve. Esta metade não tem tela.
3. **Comando para fábrica aberta na mão.** A ponte não reescreve a `origem` dessas
   fábricas, de propósito. Mas mandar comando para uma sessão que o diretor abriu
   na mão abriria uma sessão nova do Claude Code em vez de conversar com a janela
   dele. Isso não está no escopo desta OST e não foi construído. Proposta no item 7.
4. **Fila de comandos.** Comando para fábrica que está no meio do trabalho é
   recusado, não enfileirado. Enfileirar é escopo que a OST não pediu.

## 6. Arquivos e áreas alteradas

Novos:

- `C:\Users\Henrique\a-fabrica\ponte\src\acoes.ts`, o roteador das cinco ações.
- `C:\Users\Henrique\a-fabrica\ponte\src\sessao.ts`, uma sessão do início ao fim, com portas injetadas, e a trava.
- `C:\Users\Henrique\a-fabrica\ponte\src\vivas.ts`, o registro das fábricas vivas com AbortController.
- `C:\Users\Henrique\a-fabrica\ponte\src\personas.ts`, o campo `agente` chegando ao kit.
- `C:\Users\Henrique\a-fabrica\ponte\src\testes\prova-acoes.ts`, a prova sem base.
- `C:\Users\Henrique\a-fabrica\ponte\src\testes\prova-acoes-emulador.ts`, a prova ao vivo contra o emulador.

Alterados:

- `C:\Users\Henrique\a-fabrica\ponte\src\ponte.ts`, deixou de ter o corpo da abertura e passou a montar o mundo das ações; o portão ganhou a conferência do registro de vivas.
- `C:\Users\Henrique\a-fabrica\ponte\src\claudeCode.ts`, `opcoesDaSessao` exportada com modelo, persona e AbortController, e a verificação do portão rodando nas mesmas escolhas.
- `C:\Users\Henrique\a-fabrica\ponte\src\base.ts`, `tomarComando` lê `acao`, `agente` e `modelo`; novas `lerConversaDaFabrica` e `recusarAprovacoesDaFabrica`.
- `C:\Users\Henrique\a-fabrica\ponte\src\tipos.ts`, `AcaoComando`, `acaoDe`, campos novos de `Fabrica` e de `ComandoTomado`.
- `C:\Users\Henrique\a-fabrica\ponte\package.json`, scripts `prova:acoes`, `prova:acoes:sem-claude` e `prova:acoes:emulador`.

Não tocados, por serem de outro agente nesta rodada: `ganchos.ts`, `mascara.ts`,
`protecaoSessao.ts`, `entradaNavegador.ts`, `testes/prova-credencial.ts`,
`testes/prova-ganchos.ts`, `testes/sete-testes.ts`. Regras do Firestore também não
foram alteradas: os campos novos de `fabricas` já passam pelas regras publicadas.

## 7. Duas propostas ao coordenador, nenhuma construída

1. **Onde mora o motivo de uma ordem recusada.** Hoje a ponte grava o motivo no
   campo `erro` da fábrica, sem tocar em `estado`, porque o contrato já reserva
   `erro` para o motivo que a ponte precisa contar e porque inventar campo novo
   mudaria o contrato sem avisar a outra metade. Funciona e não mente, mas `erro`
   acaba carregando dois sentidos: "a fábrica falhou" e "a sua ordem não foi
   cumprida". Se o painel preferir, um campo próprio, por exemplo `ordemRecusada`,
   separa os dois. É uma linha no contrato e um ajuste pequeno nas duas pontas.
2. **Comando para fábrica aberta na mão.** O identificador dessas fábricas é
   `mao-<sessionId>`, então tecnicamente dá para retomar a conversa do diretor. Mas
   isso abriria uma sessão paralela sobre a mesma conversa, e o efeito na janela
   dele não está estudado. Enquanto não houver decisão, a ponte trata como comando
   comum e não reescreve a `origem`. O painel deveria não oferecer o botão.

## 8. Próximo passo recomendado

1. O diretor fazer o login no navegador, uma vez, para a ponte ganhar sessão na
   nuvem. Só depois disso faz sentido rodar as cinco ações contra a base real, e aí
   o rótulo deixa de ser "emulador".
2. O coordenador decidir sobre as duas propostas do item 7.
3. Validação visual da metade do painel, §A.13, com estas ações já funcionando por
   baixo.
