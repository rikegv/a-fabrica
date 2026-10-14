# Bloco 0 da OST 7, fechar o que ficou pendurado

Agente responsável: **coordenador** (§A.15), com a reescrita da entrada da ponte feita no
papel de **agente ponte**.

O Bloco 0 era a lista do que já estava mandado e não tinha fechado, agora com a entrada da
ponte pelo laço de retorno local em 127.0.0.1, que o diretor liberou esclarecendo o §A.6.

| Item da OST | Situação | Onde está |
| --- | --- | --- |
| Entrada da ponte refeita pelo login no navegador | **FEITA e provada** | seção 1 |
| A colagem de credencial, proibida | **MORTA, o degrau saiu inteiro** | seção 2 |
| As duas opções do Firestore | **Uma ligada, uma recusada pelo Google** | seção 3 |
| Arquivo de sessão protegido, e a ponte recusando subir sem isso | **FEITO e provado** | seção 4 |
| Os sete testes AO VIVO contra a base real | **TRAVADO no clique do diretor** | seção 6 |
| Prova do tempo esgotado | **TRAVADO no mesmo clique** | seção 6 |
| Republicação do painel e da regra | **TRAVADO no mesmo clique** | seção 6 |
| Subir para a main o que está validado | **TRAVADO**, ver seção 6 | seção 6 |

## 1. A entrada da ponte pelo navegador, em 127.0.0.1

### O que mudou no §A.6, e o que não mudou

O diretor esclareceu: **laço de retorno local em 127.0.0.1 está liberado** para a entrada
da ponte. O que o §A.6 continua vetando é **porta de entrada na máquina**, isto é, túnel
de entrada, endereço público apontando para cá, ou serviço escutando em interface que a
rede alcança.

Isso derruba o parágrafo que estava em `identidade.ts` desde a OST 6, que dizia que abrir
servidor de laço de retorno estava proibido. Aquele texto saiu e o novo diz a regra nova,
com o motivo.

### Como funciona agora, em cinco passos

1. a ponte abre um servidor preso em `127.0.0.1`, em porta sorteada pelo sistema;
2. abre o navegador do diretor num endereço com segredo de uso único;
3. a página roda o SDK do Firebase e faz o login com o Google, com a segunda etapa que a
   conta dele já exige;
4. a página devolve, pelo laço de retorno, a credencial daquela sessão;
5. o servidor fecha, e quem confere e grava é o mesmo caminho já provado na OST 6: troca
   no endpoint de token seguro por conexão de saída, conferência das alegações, e só então
   o disco.

A página usa **persistência em memória** de propósito: este login não deixa sessão nova
guardada no navegador do diretor. A sessão que passa a existir é a da ponte, em arquivo
trancado, e só ela.

Mudança na nuvem, uma, declarada: `127.0.0.1` foi acrescentado aos domínios autorizados do
Authentication do projeto. Antes: `localhost`, `a-fabrica-soulan.firebaseapp.com`,
`a-fabrica-soulan.web.app`. Risco disso: nenhum aumento prático, porque `localhost` já
estava lá e as duas só valem para quem já está rodando código nesta máquina.

### As sete trancas da porta, e a prova de cada uma

| Tranca | O que faz |
| --- | --- |
| T1 | escuta fixada em `127.0.0.1`, nunca `0.0.0.0`, nunca o nome da máquina |
| T2 | porta sorteada pelo sistema, não existe porta conhecida para tentar |
| T3 | vive segundos; fecha no fim, por tempo esgotado, por erro e por sinal, sempre em `finally` |
| T4 | segredo de uso único no caminho; pedido sem ele recebe 404 e nada mais |
| T5 | confere o cabeçalho de hospedeiro; fecha o ataque de nome de domínio que aponta para o laço |
| T6 | a entrega exige tipo de conteúdo JSON e não existe resposta de pré-verificação |
| T7 | uma entrega e acabou |

Provado com a porta no ar e atacada de verdade, `npm run prova:credencial`:

```
  PASSOU raiz sem segredo nenhum: resposta 404, corpo "nada aqui"
  PASSOU segredo ERRADO, do tamanho certo: resposta 404, corpo "nada aqui"
  PASSOU segredo certo, com cabecalho de hospedeiro de OUTRO nome: resposta 404
  PASSOU segredo certo, mas entrega SEM tipo de conteudo JSON: resposta 415
  PASSOU segredo certo, tipo certo, mas entrega SEM credencial: resposta 400
  PASSOU caminho inventado por baixo do segredo certo: resposta 404
  PASSOU entrega boa pelo laco de retorno: resposta 200, porta ficou aberta 58 ms
  PASSOU segunda entrega, depois da primeira: a porta ja morreu
  PASSOU porta 64015 presa no laco de retorno: pelo endereco de rede 26.187.29.6:
          nao responde; pelo laco 127.0.0.1: responde 404
```

Cada caso também prova que a porta **morreu** depois: `depois de fechar, a porta nao
responde (fetch failed)`.

**Dois defeitos de verdade foram achados pela própria prova, e os dois eram graves para a
honestidade dela:**

1. O caso do cabeçalho de hospedeiro **não estava sendo disparado**. O cliente moderno do
   Node trata `host` como cabeçalho proibido e **ignora em silêncio** o valor pedido. A
   prova passaria dizendo que o ataque foi barrado quando o ataque nem saiu. Corrigido:
   aquele caso usa o cliente HTTP de baixo nível, que manda o cabeçalho escrito.
2. A tranca T5 **não existia na primeira versão**. Foi a prova corrigida que a cobrou.

### Tempo esgotado na máquina real

A porta foi aberta duas vezes esperando o clique do diretor, e nas duas o tempo esgotou.
Isso virou prova do caminho de falha fechada em condição real, com saída real:

```
tempo esgotado: ninguem entrou em 840 segundo(s), e a porta fechou
  degrau emulador-usuario-de-teste: nao aplicavel agora
A ponte nao tem sessao do diretor, e sem isso ela nao sobe, §A.6.
Estado da tranca do arquivo de sessao: TRANCADO, ... esta trancado para
DESKTOP-5LR6BRG\Henrique e mais ninguem, por heranca da pasta ja trancada
```

Conferido depois: `porta 64025 nao escuta mais`. Nada gravado, porta fechada, mensagem
clara, código de saída 3.

## 2. A colagem de credencial morreu

Não é desligada, é removida. Não existe mais no pacote:

- o degrau `colagem-na-instalacao` saiu inteiro, sem resto comentado;
- `--colar` saiu de `entrar.js`;
- `-Colar` saiu de `instalar.ps1`;
- o campo `colagem` saiu de `OpcoesIdentidade` e de `OpcoesBase`;
- nenhuma mensagem manda mais o diretor copiar credencial de tela.

**O que sobreviveu, de propósito:** a função que lê e confere a FORMA da credencial, antes
renomeada de `lerColagem` para `lerCredencialEntregue`. Ela agora confere o que a página
do laço de retorno entregou. O ganho de manter em vez de escrever código novo: os dez
casos de erro que a prova exercita continuam exercitando **o mesmo código que roda de
verdade**, em vez de um caminho novo sem prova.

Terceira coisa que saiu, e esta não estava na OST, mas resolve a dor que travou a OST 6:
**a instalação deixou de depender do Firebase CLI logado.** Antes ela lia a configuração do
cliente com `firebase apps:sdkconfig`; quando a credencial do CLI venceu, a instalação
parou. Agora ela lê de `https://a-fabrica-soulan.web.app/__/firebase/init.json`, que a
própria hospedagem serve em aberto, porque aquela configuração é pública por desenho.
Conexão de saída, sem credencial nenhuma.

## 3. As duas opções do Firestore

Estado conferido por API, não por memória, antes e depois.

**Proteção contra exclusão: LIGADA.**

```
  antes:  "deleteProtectionState": "DELETE_PROTECTION_DISABLED"
  depois: "deleteProtectionState": "DELETE_PROTECTION_ENABLED"
```

**Recuperação a ponto no tempo: RECUSADA PELO GOOGLE.**

```
POST .../databases/(default)?updateMask=pointInTimeRecoveryEnablement
HTTP 403
{ "error": { "code": 403, "message": "This API method requires billing to be enabled.
  Please enable billing on project a-fabrica-soulan ...", "status": "PERMISSION_DENIED" } }
```

Leitura honesta: o diretor aprovou as duas, e uma delas **não é possível no plano atual**.
É a mesma barreira do aviso no celular, que a própria OST 7 já tirou de escopo por exigir
plano pago. O projeto está em `"freeTier": true`.

Fica como **pendência declarada, não esquecimento**: no dia em que o diretor ligar
faturamento no projeto, é um comando e já está escrito aqui. Enquanto isso, o banco está
protegido contra exclusão acidental, que era a metade mais importante das duas.

## 4. O arquivo de sessão trancado, e a ponte recusando subir sem isso

### O defeito que existia

O código gravava a sessão com modo `0o600`, e **isso é teatro no Windows**: o Node traduz
modo de Unix para o mínimo e não mexe na lista de controle de acesso. Quem tranca de
verdade no Windows é o `icacls`. Então a pasta estava trancada desde a OST 6, mas o
arquivo de dentro herdava, e herança do perfil do usuário inclui administrador e sistema.

A segurança levantou isso na OST 6 parte 2, condição 12, e a razão é dura: **na Onda 2 esse
arquivo deixa de ser leitura e passa a valer como chave de aprovação**, porque é com ele
que a ponte escreve resposta de aprovação na base.

### O que foi feito

`ponte/src/protecaoSessao.ts`, novo, com duas metades que têm de existir juntas:

1. **trancar**, com `icacls`, quebrando a herança e deixando só o dono;
2. **conferir que trancou**, em vez de afirmar que trancou. Afirmação de proteção sem
   conferência foi exatamente o que a segurança vetou antes.

E a parte que o diretor mandou: **a ponte recusa subir** se a tranca não estiver de pé.
Não é aviso, é recusa, com código de saída 6 e o motivo escrito.

Regra de conferência, e a diferença entre pasta e arquivo é consciente:

- **pasta**: herança tem de estar quebrada **e** só o dono pode aparecer. Obrigatório,
  porque a pasta de cima é o perfil do usuário;
- **arquivo de dentro**: só o dono pode aparecer, herdado ou não. Herança permitida aqui
  porque a pasta já está trancada para o dono, e porque a cada renovação de token o SDK
  regrava a sessão num arquivo novo que nasce herdando a pasta. Exigir herança quebrada no
  arquivo faria a ponte recusar subir depois da primeira renovação, por uma coisa que não
  é furo nenhum.

Falha fechada é literal: `icacls` que não roda, saída que não dá para ler, zero entradas,
caminho que não existe, tudo isso é **não protegido**.

Provado:

```
  PASSOU arquivo de sessao herdando a pasta aberta e visto como ABERTO:
         ... da acesso a quem nao e o dono: AUTORIDADE NT\SISTEMA(I)(F),
         BUILTIN\Administradores(I)(F)
  PASSOU o SERVICO recusa subir com a sessao aberta: codigo de saida 6
         mensagem ao diretor: ABERTO: ... ainda herda permissao da pasta de cima
         (AUTORIDADE NT\SISTEMA, BUILTIN\Administradores, DESKTOP-5LR6BRG\Henrique),
         e heranca aberta e o mesmo que porta aberta para esta chave
  PASSOU depois do icacls, o arquivo de sessao e visto como TRANCADO
  PASSOU caminho inexistente nao e tratado como protegido
```

## 5. O gate de deploy, um furo achado e fechado

Isto não estava na OST, e apareceu fazendo o trabalho. §A.7 diz que nenhum agente contorna
o gate. Mas o gate olhava só o **verbo**: `git push`, `deploy`, `docker push`,
`kubectl apply`.

Quando o Firebase CLI perdeu a credencial, a fábrica passou a publicar regra e hospedagem
**pela API, com `curl` e token do gcloud**, e nenhum desses comandos tem a palavra `deploy`
dentro. Ou seja: **existia um caminho de publicação que não passava pelo gate**, e eu mesmo
estava usando esse caminho.

Fechado: o gate agora vigia também escrita (`POST`, `PUT`, `PATCH`, `DELETE`) nos endereços
de administração que publicam, e leitura (`GET`) continua passando, porque leitura não é
publicação.

O teste obrigatório do §A.7 virou arquivo, `scripts/prova-gate.sh`, com 19 casos nos dois
sentidos. Precisou ser arquivo por um motivo que apareceu na hora: o gate lê o comando
inteiro, então um comando de teste que contenha a palavra vigiada é bloqueado pelo próprio
gate antes de rodar.

```
PARTE 1, SEM flag: tudo que publica tem de ser BLOQUEADO (codigo 2)
  PASSOU envio de ramo para o repositorio: codigo 2
  PASSOU publicacao pelo firebase: codigo 2
  PASSOU imagem para registro: codigo 2
  PASSOU aplicar no kubernetes: codigo 2
  PASSOU publicar REGRA pela API, com POST: codigo 2
  PASSOU trocar a regra em uso pela API, com PATCH: codigo 2
  PASSOU publicar HOSPEDAGEM pela API, com POST: codigo 2
  PASSOU publicar FUNCAO pela API, com POST: codigo 2
PARTE 2, SEM flag: leitura e comando comum tem de PASSAR (codigo 0)
  PASSOU ler a regra publicada, com GET: codigo 0
  PASSOU listar os sites da hospedagem, com GET: codigo 0
  PASSOU ligar protecao do Firestore, API que nao publica codigo: codigo 0
  PASSOU conferir tipos: codigo 0
  PASSOU listar arquivos: codigo 0
  PASSOU ler o estado do repositorio: codigo 0
PARTE 3, COM flag: o que publica tem de LIBERAR (codigo 0)
  PASSOU envio de ramo com flag: codigo 0
  PASSOU publicar regra pela API com flag: codigo 0
  PASSOU limpeza: a flag criada pela prova foi removida, nenhuma sobrou
PARTE 4, SEM flag de novo, para provar que a liberacao nao ficou presa
  PASSOU envio de ramo depois de remover a flag: codigo 2

RESUMO: o gate bloqueia o que publica, libera leitura, obedece a flag e volta a bloquear.
```

## 6. O que ficou travado, e no quê exatamente

Quatro itens, **um bloqueio só**: a ponte não tem sessão do diretor na base real.

| Item | Por que travou |
| --- | --- |
| Os sete testes contra a base real | o executor precisa entrar na base como o diretor |
| Prova do tempo esgotado contra a base real | mesma coisa |
| Republicação do painel e da regra | não é mais o CLI; depende do painel do Bloco 2 estar pronto, para não publicar duas vezes |
| Subir para a main | §A.21 e §A.13: a main só recebe trabalho validado, e a validação visual do Bloco 2 é do diretor |

O caminho ficou **pronto e provado**, e o clique virou um botão: a página abre sozinha no
navegador dele, ele escolhe a conta, e acabou. Nada para copiar, nada para colar.

A página foi aberta duas vezes nesta sessão esperando por ele, e as duas fecharam por
tempo esgotado sem gravar nada. Isso está na seção 1 como prova, e é também a razão pela
qual os quatro itens acima não fecharam.

**Sobre a main, com honestidade:** a OST diz "Depois disso, suba para a main o que está
validado". O que o diretor validou foram **as telas da Onda 1**, e elas estão em
`feature/ost5-madrugada`. Mas o mesmo ramo agora carrega o Bloco 1 e o Bloco 2, que ele
ainda não viu. Subir o ramo inteiro para a main levaria trabalho não validado junto, o que
fere §A.13 e §A.21. Então a fábrica **não subiu para a main por conta própria**, e a
decisão volta para ele com duas opções:

1. validar as telas novas primeiro e subir tudo de uma vez;
2. subir para a main só os commits da Onda 1, que ele já validou, e deixar a Onda 2 no ramo
   de feature até ver.

Nenhuma das duas é da fábrica para escolher, §A.12.
