# OST 6, parte 2: a ponte com escopo puro de Firebase, a colagem provada e a trilha do tempo esgotado

Agente responsavel: **agente ponte** (dono da ponte local, §A.15). Fez tudo o que esta neste
documento: a remocao do degrau proibido, o achado da credencial, o endurecimento da colagem, a
prova dos caminhos de erro, a trilha da recusa por tempo e a tentativa contra a base real. Nao
tocou em `painel/**`, `firebase/firestore.rules`, `firebase.json`, `.firebaserc`, `CLAUDE.md`,
`DIARIO.md` nem `TASKS.md`. Nao rodou commit, nao subiu branch, nao publicou nada na nuvem, nao
usou `gcloud` e nao desfez o `.mjs.txt` do legado. Todo comando de firebase foi com
`--project a-fabrica-soulan` explicito, §A.20.

## O que foi solicitado

1. **Cumprir a decisao do diretor**: remover de `ponte/src/identidade.ts` o degrau que usa o token
   do Firebase CLI, inclusive a leitura do deposito do firebase-tools, sem deixar comentado, sem
   bandeira e sem caminho de codigo que alcance aquele arquivo, e provar por busca no codigo.
2. **O achado**: dizer com precisao tecnica o que falta para a ponte obter uma sessao de cliente na
   instalacao, sem nunca escutar porta e sem subir de credencial, com as opcoes reais, custo,
   risco e recomendacao, em `docs/ost6-ponte-credencial.md`.
3. **Deixar a instalacao pronta para receber a credencial**: caminho `-Colar` robusto e provado,
   com validacao, troca por sessao propria em chamada de saida, conferencia de conta e e-mail
   verificado, recusa clara fora disso, e teste dos caminhos de erro.
4. **Os sete testes contra a base real**, com o executor pronto para disparar num comando so.
5. **Ressalva 4 da seguranca**: tempo esgotado tem de deixar registro na base, dizendo que foi
   recusa por tempo e nao resposta do diretor, respeitando as regras publicadas.

## O que foi feito

### Passo 1, a decisao do diretor cumprida

O degrau `token-do-firebase-cli` **nao existe mais**. Saiu o degrau, saiu a funcao que lia o
deposito (`lerTokensDoFirebaseCli`), saiu o tipo dela (`TokensDoCli`), saiu a constante do caminho
(`CAMINHO_FIREBASE_TOOLS`) e sairam os dois imports que so ela usava (`GoogleAuthProvider` e
`signInWithCredential`). A escada ficou com dois degraus de escopo puro de Firebase, mais a sessao
ja salva:

```ts
export const ESCADA: Degrau[] = [degrauEmulador, degrauColagemNaInstalacao];
```

Prova por busca, feita em `ponte/src` inteiro, nos termos que importam. A unica coisa que sobrou
com a palavra firebase-tools e **comentario explicando a remocao**, e o `cloud-platform` aparece
so na frase que registra a razao do diretor:

```
ponte\src\identidade.ts:17:// firebase-tools foi REMOVIDO, nao desligado: nao existe mais funcao, constante,
ponte\src\identidade.ts:19:// diretor: aquele token carrega escopo de nuvem (cloud-platform) muito maior do que
```

Busca por `lerTokensDoFirebaseCli`, `CAMINHO_FIREBASE_TOOLS`, `TokensDoCli`, `configstore`,
`GoogleAuthProvider`, `signInWithCredential`, `cloudplatform` e `auth/firebase` em `ponte/src`:
**zero ocorrencias de codigo**. No codigo compilado, que e o que roda de verdade:

```
$ grep -rn "firebase-tools|configstore|GoogleAuthProvider|signInWithCredential" dist/*.js
dist/identidade.js:17:// firebase-tools foi REMOVIDO, nao desligado: nao existe mais funcao, constante,
```

Tudo o que a ponte alcanca na rede, lista completa, e so saida:

```
ponte\src\identidade.ts:153:  fetch(`https://securetoken.googleapis.com/v1/token?key=...`)   troca de token deste projeto
ponte\src\identidade.ts:380:  fetch(`${EMULADOR_AUTH}/identitytoolkit.googleapis.com/...`)    so com PONTE_EMULADOR=1
```

Mais os ouvintes do Firestore, que sao conexao de saida persistente. Nenhum escopo de nuvem e
pedido em lugar nenhum, porque a ponte nao fala com nenhuma API de nuvem: ela fala com o Firebase
deste projeto e nada mais.

Efeito colateral bom para o §A.9: a ponte agora **nao le nenhum arquivo de configuracao do
diretor**. Antes lia um, so para leitura; agora, nenhum.

### Passo 2, o achado, em documento proprio

Esta em `docs/ost6-ponte-credencial.md`, e o resumo dele e este:

- Conferi o estado real da nuvem agora: `accounts:signUp` devolve `ADMIN_ONLY_OPERATION`, o que
  diz que o Authentication existe e que o cadastro de cliente esta **fechado**. Consequencia
  pratica que muda as opcoes: **nenhum caminho de senha e nenhum caminho de link por e-mail
  funciona hoje**, porque os dois moram no provedor de e-mail e senha, que esta desligado.
- Para o Firebase emitir sessao com o provedor Google, alguem tem de apresentar prova de
  identidade do Google. Isso cai em tres caixas: o navegador do diretor entrega o que ja tem; um
  fluxo de dispositivo com cliente OAuth proprio; ou um segredo de uso unico por outro canal. Nao
  existe quarta caixa que a ponte alcance sozinha, e a janela com retorno em 127.0.0.1 esta vetada
  pelo §A.6.
- Enumerei seis opcoes com custo e risco, inclusive as duas que rejeitei (link por e-mail, por
  contornar o segundo fator e alargar a superficie do projeto; e credencial criada pelo lado
  administrativo, que e o atalho que o diretor acabou de proibir no espirito).
- **Recomendacao: colagem agora, fluxo de dispositivo como evolucao** se o diretor quiser revogar
  o acesso da ponte com um clique na propria conta Google. O defeito honesto da colagem esta
  escrito: token de atualizacao do Firebase nao morre quando ele sai do navegador, e hoje nao
  existe botao de revogar a ponte; o caminho real e desativar o usuario no Authentication ou
  chamar `revokeRefreshTokens` pelo lado administrativo. Isso e achado novo para a seguranca.
- Nao construi tela nenhuma no painel, §A.12. A proposta de tela esta escrita para quem for
  construir.

### Passo 3, a colagem robusta e provada

O que mudou em `ponte/src/identidade.ts` e `ponte/src/entrar.ts`:

- `lerColagem` deixou de devolver "serve ou nao serve" e passou a devolver **o motivo exato** da
  recusa. Reconhece as duas formas (token puro e JSON de uma linha), tira espaco e quebra de linha
  que vem da copia de tela, e recusa com texto legivel a colagem vazia, a cortada, a que nao e
  JSON valido, a que e JSON sem `refreshToken`, a que traz texto da pagina junto, a que declara
  outra conta e, caso bonito de pegar, **a que e token de identificacao em vez de token de
  atualizacao**, que e o erro mais provavel de quem copia da tela errada.
- Nova funcao pura `conferirAlegacoesDaSessao`, que decide identidade: tem de ser o e-mail do
  diretor, **com comparacao de texto exata, igual a da regra do Firestore**, com e-mail verificado
  e com `aud` igual ao projeto desta ponte. Decidi deixar a comparacao exata, e nao normalizar
  maiusculas, porque aceitar aqui o que a regra recusa faria a ponte subir para nada, com toda
  escrita negada na base e sem motivo visivel.
- A gravacao da sessao acontece **so depois** de tudo conferido. Colagem recusada nao grava nada,
  em nenhum caminho.
- A instalacao agora distingue o codigo de saida: 4 e recusa pela forma, antes de qualquer chamada
  de rede, com o motivo na tela; 3 e recusa na troca com o Google; 2 e falta de configuracao.
- Corrigi um defeito que a prova encontrou: nos caminhos de erro o Node caia no encerramento com os
  canais de rede do Firebase abertos e devolvia `3221226505` (codigo do sistema operacional) em vez
  do codigo escolhido pelo programa, que e o que a instalacao le para decidir o que dizer ao
  diretor. Agora todas as saidas passam por `sairLimpo`, que fecha os aplicativos do Firebase antes
  de sair.

**Prova, saida real** (`npm run prova:colagem`, rodada em
`C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T1324-ost6-prova-colagem`). A prova roda o
**proprio ponto de entrada da instalacao**, `node dist/entrar.js --colar`, um processo por caso,
numa pasta local propria da rodada, para a sessao de verdade do diretor nao correr risco nenhum:

```
PARTE 1, leitura da forma da colagem
  PASSOU colagem vazia: recusada, "nada foi colado, a linha veio vazia"
  PASSOU colagem so de espacos: recusada, "nada foi colado, a linha veio vazia"
  PASSOU colagem truncada, cortada na copia: recusada, "a credencial colada tem so 15 caractere(s), curta demais para um token de atualizacao, provavelmente foi cortada na copia"
  PASSOU colagem de token de identificacao (JWT) em vez do token de atualizacao: recusada, "o que foi colado e um token de identificacao (JWT de tres partes), e a ponte precisa do token de ATUALIZACAO da sessao. O token de identificacao vence em uma hora e nao serve para a ponte renovar sozinha."
  PASSOU JSON sem o campo refreshToken: recusada, "o JSON colado nao tem o campo refreshToken (campos presentes: email, idToken)"
  PASSOU JSON pela metade: recusada, "a colagem comeca com { mas nao e um JSON valido, provavelmente foi copiada pela metade"
  PASSOU JSON declarando OUTRA conta: recusada, "o JSON colado diz que a conta e outra.pessoa@gmail.com, e so o diretor entra, §A.6"
  PASSOU colagem com texto da pagina junto: recusada, "a credencial colada tem caractere que token de atualizacao nao tem, provavelmente veio texto da pagina junto"
  PASSOU token com forma boa, mas invalido de verdade, contra o endpoint real: forma aceita, segue para a troca
  PASSOU JSON com token de forma boa, mas invalido, contra o endpoint real: forma aceita, segue para a troca

PARTE 2, conferencia das alegacoes da sessao, com alegacoes FORJADAS
  PASSOU diretor, verificado, projeto certo: aceita, conta henrique.vieira@soulan.com.br, e-mail verificado, projeto a-fabrica-soulan, provedor google.com
  PASSOU OUTRA conta, verificada, projeto certo: recusada, a credencial colada e da conta outra.pessoa@gmail.com, nao do diretor, §A.6
  PASSOU diretor em MAIUSCULAS (a regra compara texto exato, logo tem de recusar): recusada, a credencial colada e da conta HENRIQUE.VIEIRA@SOULAN.COM.BR, nao do diretor, §A.6
  PASSOU diretor com e-mail NAO verificado: recusada, a credencial colada tem e-mail nao verificado, e o verificado e obrigatorio, §A.6
  PASSOU diretor sem a alegacao de verificado: recusada, a credencial colada tem e-mail nao verificado, e o verificado e obrigatorio, §A.6
  PASSOU diretor, verificado, mas de OUTRO projeto: recusada, a credencial colada e do projeto dash-iff, e esta ponte e do projeto a-fabrica-soulan
  PASSOU sessao sem e-mail nenhum: recusada, a sessao devolvida nao tem e-mail nenhum
  PASSOU alegacoes vazias: recusada, a sessao devolvida nao tem e-mail nenhum

PARTE 3, node dist/entrar.js --colar de verdade, um processo por caso
  PASSOU colagem vazia: codigo de saida 4 (esperado 4), entradas na sessao gravadas: 0 (tem de ser 0), credencial vazou para o relato: false
  PASSOU colagem so de espacos: codigo de saida 4 (esperado 4), entradas na sessao gravadas: 0, credencial vazou para o relato: false
  PASSOU colagem truncada, cortada na copia: codigo de saida 4 (esperado 4), entradas na sessao gravadas: 0, credencial vazou para o relato: false
  PASSOU colagem de token de identificacao (JWT): codigo de saida 4 (esperado 4), entradas na sessao gravadas: 0, credencial vazou para o relato: false
  PASSOU JSON sem o campo refreshToken: codigo de saida 4 (esperado 4), entradas na sessao gravadas: 0, credencial vazou para o relato: false
  PASSOU JSON pela metade: codigo de saida 4 (esperado 4), entradas na sessao gravadas: 0, credencial vazou para o relato: false
  PASSOU JSON declarando OUTRA conta: codigo de saida 4 (esperado 4), entradas na sessao gravadas: 0, credencial vazou para o relato: false
  PASSOU colagem com texto da pagina junto: codigo de saida 4 (esperado 4), entradas na sessao gravadas: 0, credencial vazou para o relato: false
  PASSOU token com forma boa, mas invalido de verdade, contra o endpoint real: codigo de saida 3 (esperado 3), entradas na sessao gravadas: 0, credencial vazou para o relato: false
  PASSOU JSON com token de forma boa, mas invalido, contra o endpoint real: codigo de saida 3 (esperado 3), entradas na sessao gravadas: 0, credencial vazou para o relato: false

PARTE 4, resposta REAL do endpoint de token do Google para credencial invalida
  token invalido: HTTP 400 { "error": { "code": 400, "message": "INVALID_REFRESH_TOKEN", "status": "INVALID_ARGUMENT" } }
  token truncado: HTTP 400 { "error": { "code": 400, "message": "INVALID_REFRESH_TOKEN", "status": "INVALID_ARGUMENT" } }

RESUMO: todos os caminhos de erro falharam FECHADO
sessao gravada na pasta da prova no fim: 0 entrada(s) (tem de ser 0)
```

**A metade boa do caminho tambem foi provada, e ela estava sem prova.** A colagem grava a sessao no
arquivo **com a mao**, pela funcao `escrever` da persistencia, e nao pelo SDK. Se o formato gravado
nao fosse aceito pelo SDK, a colagem do diretor falharia justamente na primeira tentativa, que e o
pior momento para descobrir. Fechei essa duvida sem credencial da nuvem (`npm run prova:sessao`,
rodada em `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T1338-ost6-prova-sessao-colada`):

```
PASSO 1, identidade de verdade no emulador, sessao gravada pelo PROPRIO SDK, pasta A
  codigo de saida 0, identidade confirmada, henrique.vieira@soulan.com.br, pelo degrau emulador-usuario-de-teste

PASSO 2, copiar a entrada para a pasta B usando a MESMA funcao que o degrau de colagem usa
  entrada escrita a mao em ...\pasta-b-sessao-escrita-a-mao\sessao-emulador.json

PASSO 3, abrir a identidade na pasta B e exigir que o SDK carregue a sessao escrita a mao
  codigo de saida 0, identidade confirmada, henrique.vieira@soulan.com.br, pelo degrau sessao-salva
  o SDK renovou o token da sessao escrita a mao: true

PASSOU: sessao escrita a mao pela funcao da colagem e carregada pelo SDK e sobrevive a conferencia de identidade
```

Isso prova tres elos de uma vez: o formato que a colagem grava e consumivel pelo SDK; o SDK renova o
token a partir dele, que e o que faz o diretor nunca precisar colar de novo; e a sessao passa pela
conferencia de identidade, que forca um token novo contra o servidor. O unico elo do caminho da
colagem que continua sem prova de sucesso e a troca no endpoint do Google com credencial **valida**,
que depende da credencial do diretor. O mesmo endpoint esta provado no negativo, com HTTP 400 real.

Tres leituras honestas dessa saida:

1. **O caso de outra conta com token de verdade nao foi simulado, e eu digo por que**: para isso eu
   precisaria de um token de atualizacao legitimo de outra conta neste projeto, que eu nao tenho e
   nao posso fabricar. O que foi provado e a **funcao que decide**, com alegacoes forjadas, e ela e
   o unico caminho de decisao; mais a recusa pela declaracao no JSON; mais a segunda rede de
   protecao, que e a regra do Firestore negando qualquer conta que nao seja a do diretor.
2. **A credencial colada nao vai para arquivo**, provado: a prova compara o conteudo de cada
   arquivo de relato com o texto colado e nao encontra.
3. A rodada anterior desta mesma prova, `2026-10-13T1323-ost6-prova-colagem`, ficou preservada com
   os dois casos falhando pelo codigo de saida do sistema operacional, §A.17. E ela que mostra que o
   defeito existia e foi corrigido, em vez de a correcao aparecer do nada.

### Passo 5, tempo esgotado deixando trilha (ressalva 4)

O que mudou em `ponte/src/base.ts`:

- `LIMITE_APROVACAO_MS`, cinco minutos por padrao, trocavel por ambiente dentro de limite sao (de 1
  segundo a 1 hora) para prova de caminho. Mexer nisso nao afrouxa nada, porque tempo esgotado
  sempre resulta em recusa.
- `registrarRecusaPorTempo`, nova: grava no pedido `situacao: respondida`, `resposta: recusado`,
  `respondidoEm` com **hora do servidor**, `respondidoPor: ponte, tempo esgotado, <diretor>` e
  observacao dizendo, em portugues, que foi recusa por tempo e nao resposta do diretor.
- `esperarResposta` agora, no tempo esgotado, grava a trilha **antes** de devolver a recusa. A
  decisao nao depende da gravacao: se a gravacao falhar, continua recusado, e a saida da funcao diz
  qual foi o destino da trilha.

**Prova ao vivo, saida real** (`npm run prova:tempo`, rodada em
`C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T1327-ost6-tempo-esgotado-emulador`). Ponte de
verdade em processo separado, Claude Code vivo, prazo da prova de 25 segundos, e ninguem responde
de proposito:

```
pedido 25ff3dd2-56c6-45bc-bc2d-faadd34cd016 esta pendente. NINGUEM vai responder, de proposito.
depois de 25s o pedido virou situacao respondida
  resposta: recusado
  respondidoPor: ponte, tempo esgotado, henrique.vieira@soulan.com.br
  observacao: recusa por tempo esgotado, nao resposta do diretor: ninguem respondeu em 25 segundo(s), a ponte negou por seguranca e nada executou, §A.6
  respondidoEm (hora do servidor): {"type":"firestore/timestamp/1.0","seconds":1791908902,"nanoseconds":905000000}
resposta tardia do diretor: negada pela base: 7 PERMISSION_DENIED:
evaluation error at L128:24 for 'update' @ L128, false for 'update' @ L147, false for 'update' @ L128, false for 'update' @ L147
o arquivo que o agente queria escrever existe: false (tem de ser false)

PASSOU: tempo esgotado deixa trilha na base, com recusa por tempo, hora do servidor e origem, e nada executou
```

A linha da resposta tardia e a que fecha a ressalva: depois da recusa por tempo, a **regra
publicada** nega a tentativa do diretor de gravar `aprovado` naquele pedido, porque ele nao esta
mais pendente. Era exatamente isso que a auditoria apontou como trilha imprecisa, e agora a trilha
diz a verdade: quem recusou foi a ponte, por tempo, com hora do servidor.

Onde rodou, com rotulo honesto: **no emulador**, com as regras do arquivo
`firebase/firestore.rules` copiadas, que a seguranca ja provou serem identicas byte a byte as que
estao na nuvem. Contra a base real, esta prova esta pronta e nao rodou, pelo mesmo motivo dos sete
testes. O comando e `npm run prova:tempo`, sem variavel de ambiente nenhuma.

Decisao que **nao** tomei: mudar o prazo de cinco minutos. A seguranca observou que cinco minutos
e curto para responder do celular, e prazo e decisao do diretor, §A.12. O que fiz foi deixar o
prazo num lugar so, nomeado, facil de trocar quando ele decidir.

### Passo 4, os sete testes contra a base real

**Nao rodaram contra a base real.** Nenhum dos sete. O bloqueio e um so, e nao e tecnico do meu
lado: a ponte nao tem sessao de cliente do diretor, e eu nao posso produzir uma sem (a) escutar
porta, que o §A.6 veta, (b) usar o token proibido, ou (c) uma acao do diretor.

Tentativa de verdade, feita agora, saida real, sem maquiagem:

```
$ node dist/testes/sete-testes.js
rodada em C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T1330-ost6-sete-testes-base-real
base REAL, projeto a-fabrica-soulan
Claude Code sempre de verdade, sessao viva, nunca simulado
maquina de teste maquina-TESTE-ost6-202610131330, pasta de projeto das fabricas ...\projeto-cc
[identidade do executor] configuracao local lida, maquina maquina-b06c5b1e81b4, projeto a-fabrica-soulan
[identidade do executor] sessao persistida em C:\Users\Henrique\.a-fabrica-ponte\sessao.json
[identidade do executor] degrau colagem-na-instalacao: nao aplicavel agora
[identidade do executor] degrau emulador-usuario-de-teste: nao aplicavel agora
executor quebrou: nenhum degrau da escada de credencial entregou sessao. A ponte nao sobe sem
  identidade do diretor, §A.6. Rode a instalacao com a colagem, uma vez so:
  powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Colar
```

Estado do deposito de sessao, conferido duas vezes, no comeco e no fim do trabalho:

```
C:\Users\Henrique\.a-fabrica-ponte\sessao.json  81 bytes
{ "versao": 1, "atualizadoEm": "2026-10-13T16:30:55.100Z", "entradas": {} }
```

Vazio nas duas vezes. Nenhuma credencial chegou enquanto eu trabalhava.

**O executor esta pronto para disparar num comando so**, e ele compila antes de rodar para nao
haver versao velha no caminho:

```
cd C:\Users\Henrique\a-fabrica\ponte
npm run base-real
```

E a credencial entra tambem num comando so:

```
cd C:\Users\Henrique\a-fabrica\ponte
npm run colar
```

**Regressao, para o trabalho desta rodada nao ter quebrado o que ja funcionava.** Rodei os sete no
emulador depois de todas as mudancas, com a ponte de verdade como servico e o Claude Code vivo
(`C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T1328-ost6-sete-testes-emulador`):

```
RESUMO: 7 de 7 testes passaram
  teste 1: PASSOU, abrir fabrica pela ponte e a atividade chegando na base ao vivo
  teste 2: PASSOU, comando gravado na base e a fabrica executando
  teste 3: PASSOU, pedido de aprovacao com pacote completo, aprovado pela base, e o comando executando
  teste 4: PASSOU, pedido recusado pela base, e nada executando
  teste 5: PASSOU, conexao caindo no meio, nada perdido, nada executado duas vezes
  teste 6: PASSOU, ponte parada, estado virando ponte offline na base
  teste 7: PASSOU, pedido pendente sobrevivendo a reinicio da ponte
ROTULO HONESTO: base no emulador, sessao do Claude Code viva. NAO E o teste ao vivo contra a base
real que a OST pede.
```

**Leitura honesta, teste por teste:**

| Teste | Base real | Emulador, depois das mudancas desta rodada |
| --- | --- | --- |
| 1, abrir fabrica e atividade ao vivo | **nao rodou**, sem sessao do diretor | passou |
| 2, comando gravado na base e fabrica executando | **nao rodou**, sem sessao do diretor | passou |
| 3, aprovacao com pacote completo, aprovada, comando executa | **nao rodou**, sem sessao do diretor | passou |
| 4, mesma recusada, nada executa | **nao rodou**, sem sessao do diretor | passou |
| 5, conexao caindo, nada perdido, nada em dobro | **nao rodou**, sem sessao do diretor | passou |
| 6, ponte parada vira ponte offline | **nao rodou**, sem sessao do diretor | passou |
| 7, pedido pendente sobrevive a reinicio | **nao rodou**, sem sessao do diretor | passou |
| extra, tempo esgotado deixa trilha | **nao rodou**, sem sessao do diretor | passou |

**Identificadores de teste, para quando rodar na base real.** Como a trilha e inapagavel de
proposito e eu nao apago nada, §A.17, os documentos de teste vao nascer com marca no proprio nome,
e esta e a mudanca que fiz no executor para o diretor distinguir teste de trabalho de relance:

- maquina: `maquina-TESTE-ost6-<ano><mes><dia><hora><minuto>`, por exemplo
  `maquina-TESTE-ost6-202610131330`;
- fabricas: `TESTE-ost6-f1-<oito caracteres>` ate `TESTE-ost6-f6-...`, uma por teste;
- comandos e aprovacoes nascem com identificador sorteado, e carregam `maquinaId` com a marca
  acima, entao filtrar por `maquinaId` que comeca com `maquina-TESTE-ost6` separa tudo o que e
  teste;
- a origem gravada nos comandos e `painel de teste, henrique.vieira@soulan.com.br`, que tambem
  distingue do painel de verdade.

**Nenhum documento de teste existe na base real neste momento**, porque nada rodou contra ela. Os
documentos que existem na base real, de rodadas anteriores a esta, nao sao meus: a minha rodada
anterior escreveu so no emulador. Quando rodar, eu volto e listo aqui o que ficou, com os
identificadores exatos.

## O que ficou faltando

1. **Os sete testes contra a base real**, e tambem a prova do tempo esgotado contra a base real.
   Dependem de uma acao do diretor, descrita no fim deste documento. Codigo, executor e comando
   estao prontos e provados contra o emulador.
2. **A tela do painel para a colagem**, que e proposta, nao obra minha, §A.12.
3. **A decisao do diretor sobre o prazo de aprovacao**. Hoje cinco minutos, num lugar so, facil de
   trocar.
4. **Revogacao do acesso da ponte**, achado novo: nao existe hoje caminho simples para matar a
   sessao da ponte sem mexer no usuario do Authentication. Esta descrito em
   `docs/ost6-ponte-credencial.md`, secao 6, e e material para a seguranca.
5. **Validacao visual do diretor**, §A.13. A ponte nao tem interface; o efeito dela aparece no
   painel, que e de outro agente.

## Decisoes que tomei durante a execucao

1. **Remover de verdade, nao desligar.** O degrau proibido saiu com funcao, tipo, constante e
   imports. Deixar atras de bandeira seria exatamente o que a OST proibiu, e deixaria o caminho
   vivo para quem mexesse na bandeira amanha.
2. **Comparacao de e-mail exata, sem normalizar maiusculas**, para a ponte recusar o que a regra do
   Firestore recusa, em vez de subir com uma sessao que a base rejeita em silencio.
3. **Conferir tambem o projeto da sessao** (`aud`), que nao estava sendo conferido. Credencial de
   outro projeto agora e recusada antes de gravar.
4. **Recusar a colagem antes de qualquer chamada de rede**, com codigo de saida proprio (4), para a
   instalacao poder dizer ao diretor o que fazer sem gastar uma viagem a nuvem.
5. **Pegar o caso do token de identificacao colado por engano**, porque e o erro mais provavel de
   quem copia da tela errada, e o motivo generico de recusa nao ajudaria ninguem.
6. **Nao apagar o legado nem a rodada que falhou.** O `.mjs.txt` ficou como estava, e a rodada da
   prova que pegou o defeito do codigo de saida ficou preservada ao lado da que passou, §A.17.
7. **Emulador em portas proprias da rodada**, 8199, 9299, 4699 e 4799, porque havia outro emulador
   vivo nesta maquina nas portas vizinhas e colidir faria o teste ler a base do projeto errado. A
   configuracao e as regras copiadas ficaram dentro da pasta da rodada, nao em pasta fixa.
8. **Encerrei os emuladores que eu subi** e conferi que nenhuma porta minha ficou escutando, por
   causa da condicao 3 da seguranca.
9. **Prova da colagem numa pasta local propria**, apontada por `PONTE_PASTA_LOCAL`, para a sessao
   de verdade do diretor nunca entrar no caminho de um teste.
10. **Nao mexi no prazo de cinco minutos**, por ser decisao do diretor.

## Arquivos e areas alteradas

Alterados, todos dentro de `ponte/`:

- `ponte/src/identidade.ts`: degrau proibido removido, leitura do deposito do firebase-tools
  removida, colagem endurecida, `conferirAlegacoesDaSessao` nova.
- `ponte/src/base.ts`: `LIMITE_APROVACAO_MS`, `registrarRecusaPorTempo`, trilha no tempo esgotado.
- `ponte/src/entrar.ts`: recusa da colagem pela forma antes da rede, mensagens novas, saida limpa
  em todos os caminhos.
- `ponte/src/testes/sete-testes.ts`: marca `TESTE-ost6` nos identificadores de maquina e fabrica.
- `ponte/instalar.ps1`: passo unico da colagem no lugar do clique do Authentication, que ja foi
  feito, e mensagens por codigo de saida do login.
- `ponte/package.json`: comandos `base-real`, `colar`, `prova:colagem`, `prova:tempo`,
  `prova:tempo:emulador`, `prova:ressalvas`.
- `ponte/README.md`: escada com dois degraus, a razao da remocao, a trilha do tempo esgotado e os
  comandos novos.

Novos:

- `ponte/src/testes/prova-colagem.ts`
- `ponte/src/testes/prova-tempo-esgotado.ts`
- `ponte/src/testes/prova-sessao-colada.ts`
- `docs/ost6-ponte-credencial.md`
- `docs/ost6-ponte-parte2.md` (este documento)

Nao tocados, de proposito: `painel/**`, `firebase/**`, `firebase.json`, `.firebaserc`, `CLAUDE.md`,
`DIARIO.md`, `TASKS.md`, `ponte/legado-mjs/**`.

Fora do repositorio, na maquina do diretor:

- `C:\Users\Henrique\.a-fabrica-ponte\sessao.json` continua **vazio**, 81 bytes, sem credencial
  nenhuma. Nada foi gravado la nesta rodada.
- evidencias em `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T13*-ost6-*`, seis pastas
  novas, nada sobrescrito, nada apagado. O emulador que eu subi para as provas foi encerrado, e
  conferi que nenhuma porta minha ficou escutando nesta maquina.

## Problemas encontrados

1. **Codigo de saida falso nos caminhos de erro do login.** O Node devolvia `3221226505` em vez do
   codigo do programa, porque caia no encerramento com os canais de rede do Firebase abertos. A
   prova pegou isso, e nao a leitura do codigo. Resolvido com `sairLimpo`, e a rodada que mostra o
   defeito ficou preservada.
2. **Porta de emulador ocupada por outro agente.** Havia um emulador vivo nas portas vizinhas desta
   maquina. Resolvido com portas proprias da rodada.
3. **Verificacao de tipos reclamando depois da saida limpa.** Com uma funcao que nunca retorna, a
   analise de fluxo do TypeScript perdia o estreitamento do tipo da leitura da colagem. Resolvido
   com um retorno explicito logo depois da saida, e `npm run tipos` voltou a passar limpo
   (`exit=0`).
4. **O caso de outra conta com token de verdade nao e simulavel por mim**, e isso esta dito em vez
   de maquiado. O que foi provado e a funcao que decide, com alegacoes forjadas, mais a recusa pela
   declaracao, mais a regra do Firestore.

## Proximo passo recomendado

1. **A acao do diretor, que destrava tudo**, esta em `docs/ost6-ponte-credencial.md`, secao 7: abrir
   o painel ja logado, copiar a credencial de sessao com a linha que esta la, e rodar
   `powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Colar`.
2. Com a sessao no lugar, rodar `npm run base-real` e `npm run prova:tempo` e colar as duas saidas
   no diario, com os identificadores de teste que ficaram na base.
3. Reauditoria da seguranca com a lista do item 7 do parecer dela, agora que o Authentication
   existe e que o degrau proibido morreu.
4. Decisao do diretor sobre o prazo de aprovacao e sobre revogacao do acesso da ponte.
5. Proposta, para ele decidir: incluir na rodada o caso que a seguranca pediu e que hoje nao
   existe, matar a ponte de forma seca **com pedido pendente** e provar que nada executou e que
   nenhum processo do Claude Code sobrou orfao. Nao construi porque esta fora do que esta OST pediu,
   §A.12.
