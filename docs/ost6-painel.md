# OST 6, Bloco 2, lado do painel web

Agente responsavel por este fechamento: frontend (peca 1, telas do computador e do celular).

Quem fez o que, §A.15:

- **Agente frontend anterior** (mesma OST, caiu por erro de rede sem deixar relatorio):
  construiu o painel inteiro que esta no disco. Projeto Next 14 com saida estatica, 19
  componentes do pacote do designer portados para React 18 com TypeScript, tradutor entre a
  base em portugues e o design system em ingles, ouvintes ao vivo do Firestore, barreira de
  entrada, casca do computador, casca do celular, destinos inertes, gerador de estilos a
  partir de `tokens.json` e script de construcao limpa para a hospedagem. Deixou uma rodada
  de evidencia em `painel/testes/rodada-2026-10-13-094421/`.
- **Agente frontend deste fechamento** (eu): terminei o ajuste do celular que ficou no meio,
  revisei o trabalho item por item contra o que a OST exige, corrigi tres furos que a
  revisao encontrou, produzi a evidencia visual do estado final e escrevi este relatorio.

Nao toquei em `painel/preview/**` (evidencia da rodada anterior, §A.17), nem em `ponte/**`,
`firebase/**`, `firebase.json`, `.firebaserc`, `CLAUDE.md`, `DIARIO.md` ou `TASKS.md`.
Nao rodei commit, nao rodei push e nao publiquei nada.

Pastas de evidencia desta rodada, §A.17, nada sobrescrito e nada apagado:

- `painel/testes/rodada-2026-10-13-101200/` revisao, com as fotos que mostram o furo do
  celular antes do conserto e a prova de que `tokens.json` manda na tela.
- `painel/testes/rodada-2026-10-13-102132-final/` estado final, 14 fotos do computador e do
  celular, mais `conferencia-toque/` com as medidas de alvo de toque depois do ajuste.

## 1. O que foi solicitado

1. Terminar o ajuste do celular que o agente anterior deixou no meio: tela de entrada
   derivada ao vivo e linha do que a fabrica esta fazendo visivel.
2. Revisar a conformidade do painel, item por item, com veredito e evidencia, corrigindo
   onde houvesse furo: escopo da Onda 1, modo leitura de verdade, login obrigatorio, nada
   de dado embutido, ponte offline, `tokens.json` como fonte unica, regras de tela, e base
   vazia tratada com dignidade.
3. Registrar, sem implementar, o que o endurecimento das regras vai exigir quando o painel
   comecar a escrever, na Onda 2.
4. Listar todas as consultas do painel ao Firestore, para o coordenador saber de que indice
   precisa.
5. Checar se o Authentication do projeto ja foi ligado e provar o login ao vivo, se der.
6. Rodar de novo as provas de tipo, construcao, travessao e chave.
7. Dizer qual pasta a hospedagem serve e para que serve o script de construcao.

## 2. O que foi feito

### 2.1 O ajuste do celular, terminado

O agente anterior tinha escrito as duas mudancas no arquivo antes de cair. A primeira
estava certa e funcionando; a segunda estava escrita mas nao aparecia na tela.

**Tela de entrada derivada ao vivo.** Esta certa, e provada. Em `painel/src/telas/Celular.tsx`
a tela corrente e `telaEscolhida ?? (dados ja chegaram e ha pedido parado ? 'approvals' :
'factories')`. Antes, a escolha era feita no instante em que a tela montava, quando a base
ainda nao tinha respondido, e o celular caia sempre em Fabricas mesmo com pedido parado.
Foto `08-celular-entrada-aprovacoes.png` da rodada final: o painel abre direto no pedido
que espera o diretor, com a decisao visivel e desabilitada.

**Linha do que a fabrica esta fazendo.** Estava escrita no codigo e nao aparecia. Medi o
cartao no navegador: o elemento existia, com o texto certo, e com altura zero. Causa: a
lista de cartoes e uma coluna de flex com espaco limitado; quatro cartoes nao cabiam, o
flex espremeu cada cartao, e quem absorveu todo o aperto foi justamente a linha do que a
fabrica faz, por ser a unica com recorte (`overflow: hidden`). Conserto em tres partes:

1. o cartao nao encolhe mais (`shrink-0`), entao a linha nunca mais e espremida a zero;
2. a lista deixou de ter numero fixo de cartoes por pagina. Ela mede o espaco que tem e o
   cartao que ja desenhou, e mostra o que couber, com paginacao para o resto. A medida e
   tomada do topo da lista ate o pe do corpo, descontando o paginador, e nenhuma dessas
   medidas depende de quantos cartoes estao na tela, para a conta nao mudar o desenho e o
   desenho nao mudar a conta;
3. antes da primeira medida, tres cartoes.

Resultado medido: em aparelho de 390 por 844 cabem tres cartoes com a linha visivel e
sobra espaco; em aparelho baixo, de 375 por 667, cabe um, porque a faixa de aprovacao e os
dois indicadores ja ocupam a metade de cima. Em nenhum caso a pagina rola e em nenhum caso
o conteudo fica cortado. Fotos `09-celular-fabricas.png` (final) e, na rodada de revisao,
`09` antes e `19` depois.

### 2.2 Revisao de conformidade, item por item

#### a. Escopo exato da Onda 1, §A.12

**Certo.** Existem duas telas construidas, Visao geral (`src/telas/VisaoGeral.tsx`) e Fabrica
(`src/telas/FabricaTela.tsx` no computador, `CelularFabrica` dentro de `src/telas/Celular.tsx`
no celular), as duas em modo leitura, no computador e no celular. As outras cinco entradas
do menu existem como destino e caem em `src/telas/Inerte.tsx`, que mostra o texto de
`src/telas/textos.ts` dizendo em que onda cada uma entra, por exemplo "A fila de aprovacoes
entra na Onda 2" e "Relatorios entra na Onda 3". No celular o mesmo vale para Relatorios e
Mais. Foto `07-destino-inerte-computador.png` e `11-celular-mais-inerte.png`.

#### b. Caixa de comando e decisao visiveis e desabilitadas, sem caminho de escrita

**Certo, e mais forte do que desabilitado.** Tres provas de leitura de codigo:

1. Busca por escrita no Firestore em todo `painel/src` e `painel/app`, com os termos
   `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `runTransaction` e `writeBatch`:
   **zero ocorrencias**. O numero correto nesta OST, portanto, bate.
2. O painel nem sequer importa funcao de escrita. O unico arquivo que importa valor de
   `firebase/firestore` e `src/dados/ouvintes.ts`, e o que ele importa e `collection`,
   `limit`, `onSnapshot`, `orderBy` e `query`. Todo o resto importa apenas o tipo
   `Firestore`.
3. Nenhuma tela passa manipulador de acao para componente nenhum. Busca por `onSend`,
   `onApprove`, `onReject`, `onApproveWithNote`, `onPause`, `onRestart`, `onStop` e
   `onSaved` em `painel/src/telas` e `painel/app`: **zero ocorrencias**. Sem manipulador,
   o `CommandBox` se desabilita sozinho (`const off = Boolean(disabledReason) || !onSend`)
   e o `ApprovalItem` com `readOnlyReason` desenha os tres botoes com `disabled`, sem
   `onClick`, e nunca abre o campo de motivo.

Na tela, os controles aparecem e dizem por que estao parados: "Mandar comando entra na
Onda 2. Nesta onda o painel e de leitura", "Responder aprovacao entra na Onda 2", "Pausar,
reiniciar e encerrar entram na Onda 2", "Abrir nova fabrica entra na Onda 2". Com a ponte
offline, o texto muda e diz isso primeiro. Fotos `04`, `05` e `08`.

#### c. Login obrigatorio, §A.6

**Certo.** A barreira fica na raiz, em `painel/app/page.tsx`: a pagina chama `usarEntrada()`,
e so devolve as telas quando a situacao e `dentro`; caso contrario devolve `<Barreira>`.
O que impede contornar nao e a tela, e a fonte de dados: `const base = dentro ? entrada.base
: null`, e todos os ouvintes de `src/dados/ouvintes.ts` devolvem lista vazia e nao criam
assinatura nenhuma quando a base e nula. Sem usuario autenticado, nenhuma leitura sai do
painel, nem por rota, nem por atalho, porque nao existe outra rota: a saida e estatica, de
uma pagina so.

Conta unica: em `src/dados/autenticacao.ts`, assim que o Firebase avisa quem entrou, o
painel compara com `EMAIL_DO_DIRETOR` e exige `emailVerified`. Qualquer outro e-mail leva
`signOut` na hora e a tela volta com a mensagem "Esta conta nao e a do diretor, entao a
sessao foi encerrada. O painel so abre para henrique.vieira@soulan.com.br, com e-mail
verificado pelo Google". Provado ao vivo contra o emulador do Auth, foto
`14-conta-recusada-computador.png`. A entrada e pelo provedor Google (`GoogleAuthProvider`,
`signInWithPopup`, com queda para `signInWithRedirect` quando o navegador bloqueia a
janela), que e quem carrega o segundo fator e entrega o e-mail verificado que a regra do
Firestore exige.

#### d. Nada de dado embutido

**Certo.** Nao existe `dados.js`, nao existe fixture, nao existe lista de exemplo em
`painel/src` nem em `painel/app`. Tudo que aparece na tela vem de `onSnapshot`. O unico
dado de exemplo do projeto vive nos semeadores das pastas de teste
(`painel/testes/rodada-*/semear.mjs`), que escrevem no emulador local, nunca na nuvem, e
nao sao importados por nenhum arquivo do painel. O `painel/preview/dados.js` e o prototipo
estatico da OST 5 e nao e importado por nada do aplicativo.

#### e. Ponte offline, §A.10

**Certo.** O limite usado e **60 segundos** de silencio, em
`LIMITE_HEARTBEAT_MS` de `src/dados/tradutor.ts`. A escolha: a ponte bate a cada 15
segundos (`ponte/src/base.ts`, `intervaloMs = 15000`), entao 60 segundos sao quatro batidas
perdidas, folga suficiente para uma falha de rede curta e curto o bastante para o diretor
nao olhar para um numero velho. O relogio do painel acorda a cada 15 segundos, entao a
troca para offline acontece em no maximo 75 segundos depois da ultima batida.

A regra dura esta no tradutor, num lugar so: quando a ponte esta offline, ou quando a
maquina declarou `estadoPonte: "offline"`, **toda** fabrica passa a `offline`, qualquer que
seja o estado gravado. O painel nunca diz em execucao com sinal de vida velho. Provado ao
vivo: foto `12-ponte-offline-computador.png`, com a base semeada com batida de cinco
minutos atras. As sete fabricas viram "Ponte offline", o indicador "Em execucao" cai para
zero de sete, a faixa do topo explica, e o pe do menu mostra "Ponte offline ha 5 min". O
pedido parado continua visivel, porque ele continua esperando o diretor.

#### f. `tokens.json` como fonte unica de cor, tamanho e raio

**Certo, provado trocando o valor.** `painel/scripts/gerar-estilos.mjs` le
`gerenciador-de-fabricas/design-system/tokens.json` e escreve tres arquivos gerados que
ninguem edita a mao: as variaveis CSS dos dois temas, a copia do CSS dos componentes do
pacote, e o tema do Tailwind. O tema do Tailwind nao repete valor nenhum: cada cor aponta
para `var(--nome-do-token)`.

Prova: troquei `state-approval` de `#f5b93e` para `#00e5ff` em `tokens.json`, rodei
`npm run estilos` e abri o celular. Os cartoes de aprovacao e os selos viraram ciano, sem
tocar em uma linha de componente. Foto `21-prova-de-token-cor-trocada.png` na rodada de
revisao. Depois disso o `tokens.json` foi devolvido ao original (`git checkout`, conferido
com `git diff` vazio e com a copia guardada em `tokens.json.copia`) e os estilos foram
gerados de novo.

Busca por cor escrita a mao em `painel/src` e `painel/app`, fora dos arquivos gerados:
uma unica ocorrencia, `themeColor: '#05060a'` em `app/layout.tsx`, que e a cor da barra do
navegador no celular e so aceita valor literal em metadado, nao variavel CSS. E o mesmo
valor do token `bg-000`.

#### g. Regras de tela

- **Tela unica sem rolagem de pagina.** Certo e medido. `html, body { overflow: hidden }`
  em `app/globals.css`, e a medida no navegador deu `scrollHeight - innerHeight = 0` nas
  quatro telas medidas (`medidas.json` da rodada final). A rolagem interna autorizada pelo
  manual existe num lugar so, nos detalhes do pedido acima dos botoes fixos do celular.
- **Estado nunca so pela cor.** Certo. `StateIcon` da forma propria a cada estado (ponto
  com anel pulsando, losango, circulo vazio, circulo com visto, X, circulo tracejado
  cortado) e o `StateBadge` sempre leva a palavra junto. Ate na lista de projetos do menu,
  onde nao cabe a palavra, a forma distingue.
- **Celular com desenho proprio.** Certo. Casca separada, barra de navegacao na base com
  quatro destinos, cabecalho curto, cartao de fabrica proprio, e um deck de aprovacao em
  modo toque. Nao e o computador encolhido.
- **Alvo de toque de 44px.** Era um **furo, e foi corrigido**. A medida no navegador
  mostrou tres controles abaixo de 44px no celular: as duas setas do paginador (30px, do
  CSS do pacote) e as abas Atividade e Tarefas (40px, do CSS do pacote). Como o CSS do
  pacote e copiado por gerador e nao se edita a mao, o ajuste entrou em `app/globals.css`,
  escopado na casca do celular, usando a propria medida de `tokens.json`
  (`var(--size-touch)`, 44px). Medida depois do ajuste: **nenhum alvo abaixo de 44px** nas
  tres telas do celular. Evidencia em
  `rodada-2026-10-13-102132-final/conferencia-toque/medidas-de-toque.json`.
- **Sem emoji.** Certo. Busca nas faixas de emoji em `painel/src`, `painel/app` e
  `painel/scripts`: nada. A unica ocorrencia fora da faixa ASCII em componente e a seta de
  variacao do `KpiTile`, num ramo que nenhuma tela do painel usa, porque nenhuma passa a
  propriedade de variacao.
- **Botao no infinitivo.** Certo: Entrar com o Google, Sair, Aprovar, Recusar, Aprovar com
  observacao, Pausar, Reiniciar, Encerrar, Enviar, Ver pedido, Abrir nova fabrica, Abrir o
  painel Aguardando voce, Cancelar.
- **Formatos de tempo e consumo do manual.** Certo, em `src/formato.ts`, arquivo unico:
  "1h 12min", "34min", "412 mil tokens", "2,4 mi tokens", "parado ha 18 min", "ha 5 min",
  "hoje, 10:42", "Terca, 13 de outubro".
- **Travessao, §A.11.** Nenhum, nos dois caracteres, em `app`, `src` e `scripts`.

#### h. Base vazia tratada com dignidade

**Certo**, e e exatamente o que o diretor vai ver quando abrir, porque a base de verdade
esta vazia hoje. Provado limpando o emulador antes de olhar. Fotos
`02-base-vazia-computador.png` e `03-base-vazia-celular.png`.

No computador: faixa roxa no topo com "Nenhuma ponte pareada. O painel esta ligado a base,
mas nenhuma maquina se apresentou ainda. Quando a ponte iniciar, ela aparece aqui"; os
cinco indicadores em zero, com dica "nenhuma fabrica ainda"; o painel Fabricas com
"Nenhuma fabrica no painel. A ponte ainda nao abriu nenhuma fabrica. Quando abrir a
primeira, o cartao aparece aqui, ao vivo, sem recarregar a pagina"; e o painel da direita
com "Nada esperando voce". No celular, a mesma coisa na forma do celular. Nada parece erro,
nada parece quebrado, e cada texto diz o que falta acontecer.

### 2.3 Informacao nova, registrada para a Onda 2, nao implementada

O backend endureceu as regras do Firestore e o coordenador ja publicou. Esta OST nao
escreve nada, §A.12, entao fica aqui o recado para quem fizer a Onda 2 no painel:

- **Hora do servidor, obrigatoria.** `comandos.criadoEm` e `aprovacoes.respondidoEm` tem de
  ser escritos com `serverTimestamp()`. Hora do cliente e negada pela regra. Como o painel
  grava e depois le pelo ouvinte, lembrar que o campo chega nulo no instante da escrita
  local e so ganha valor quando o servidor confirma; a tela precisa aguentar isso sem
  piscar.
- **Quem respondeu, obrigatorio.** `aprovacoes.respondidoPor` nao pode ser vazio na
  resposta. O painel ja tem o usuario autenticado em maos, entao o natural e gravar o
  e-mail do diretor.
- **Criar comando exige o pacote completo:** `fabricaId`, `maquinaId`, `texto` e `origem`
  preenchidos, e `situacao` igual a `pendente`. O `maquinaId` ja esta traduzido e
  disponivel em cada fabrica (`Fabrica.maquinaId` em `src/dados/tradutor.ts`), entao a
  caixa de comando tem de onde tira-lo sem consulta nova.
- A transicao de resposta tambem exige que `situacao` passe de `pendente` para `respondida`
  e que os campos de identidade do pedido nao mudem.

### 2.4 Indices: todas as consultas que o painel faz

Todas estao em `painel/src/dados/ouvintes.ts`, e todas sao `onSnapshot` ao vivo.

| coleccao | filtro | ordenacao | limite | precisa de indice composto |
| --- | --- | --- | --- | --- |
| `maquinas` | nenhum | nenhuma | nenhum | nao |
| `fabricas` | nenhum | nenhuma | nenhum | nao |
| `aprovacoes` | nenhum | `criadoEm` crescente | 50 | nao, campo unico |
| `fabricas/{id}/atividade` | nenhum | `seq` decrescente | 4 no celular, 6 no computador | nao, campo unico |
| `fabricas/{id}/tarefas` | nenhum | `criadaEm` crescente | 50 | nao, campo unico |

**Nenhuma consulta do painel cai nos dois casos que o backend provou que faltam indice.**
O painel nao consulta `fabricas` filtrando por `maquinaId` nem ordenando por `atualizadoEm`,
e nao consulta `comandos` de forma alguma nesta onda.

E verdade, e de proposito, que **o painel ordena e filtra na memoria**:

- a ordem da grade de fabricas e por urgencia (aprovacao, falha, execucao, offline, ociosa,
  concluida, e dentro de cada grupo a mais antiga primeiro), uma regra que o banco nao sabe
  fazer, entao a consulta vem sem ordenacao e o tradutor ordena;
- o filtro de pedido pendente tambem e feito na memoria, depois de ler a colecao ordenada
  por data, justamente para nao depender de indice composto que ainda nao exista.

O preco honesto disso: a consulta de `aprovacoes` le as 50 mais antigas. Com a trilha
crescendo ao longo dos meses, um pedido pendente novo pode cair fora dessa janela. Com a
operacao de hoje, um diretor, uma maquina, poucas fabricas, isso nao acontece. Na Onda 2,
quando o painel passar a responder, vale trocar por `where('situacao','==','pendente')` com
`orderBy('criadoEm')`, que e exatamente o indice `aprovacoes: situacao + criadoEm` que ja
esta declarado em `firebase/firestore.indexes.json`. Enquanto esse indice nao estiver
publicado, a troca quebra a tela, entao ela fica para quem publicar o indice.

Resumo para publicar: **o painel, nesta onda, nao precisa de nenhum indice novo.**

### 2.5 Estado do login na nuvem

**Continua desligado.** Conferido agora, nao assumido: chamada real a
`https://identitytoolkit.googleapis.com/v1/accounts:signUp` com a chave de
`painel/.env.local` do projeto `a-fabrica-soulan` devolveu HTTP 400 com
`CONFIGURATION_NOT_FOUND`, que e exatamente a resposta de projeto sem Authentication
ligado.

O que ficou **sem prova ao vivo** por causa disso:

- entrar de verdade com a conta do diretor na nuvem, com o segundo fator do Google;
- a regra do Firestore recusando a leitura de outra conta na nuvem (foi provada no emulador
  pelo agente da base, nao pelo painel contra a nuvem);
- o painel lendo a configuracao de `/__/firebase/init.json` servido pela hospedagem, que so
  acontece depois de publicado.

O que **foi** provado ao vivo, contra o emulador do Auth e do Firestore, com o painel real
rodando: entrada pelo Google, conta do diretor aceita, conta diferente desconectada na hora
com mensagem clara, leitura ao vivo das cinco colecoes, base vazia, base com dados, e queda
da ponte.

Passo para provar depois, quando o diretor ligar o Authentication: no console do Firebase,
projeto `a-fabrica-soulan`, Authentication, Comecar, habilitar o provedor Google, e incluir
o dominio do Hosting em dominios autorizados. Para conferir sem abrir o navegador, repetir
a chamada acima: enquanto responder `CONFIGURATION_NOT_FOUND`, esta desligado. O agente da
base deixou `firebase/testes/verificar-login.mjs` para isso.

### 2.6 Provas finais, saida real

```
$ npm run tipos
> painel-a-fabrica@0.1.0 tipos
> tsc --noEmit
(sem nenhuma linha de erro, codigo de saida 0)

$ npm run build
   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
 ✓ Generating static pages (4/4)

Route (app)                              Size     First Load JS
┌ ○ /                                    122 kB          209 kB
└ ○ /_not-found                          873 B          88.3 kB
+ First Load JS shared by all            87.4 kB
○  (Static)  prerendered as static content

$ npm run construir-para-hospedagem
 ✓ Compiled successfully
 ✓ Generating static pages (4/4)
Saída limpa de chave do Firebase. Pasta para a hospedagem servir: painel/out

$ grep -rnP "[\x{2014}\x{2013}]" app src scripts
nenhum travessao encontrado

$ grep -rn "AIzaSy" app src scripts package.json tailwind.config.ts next.config.mjs tsconfig.json .env.example
scripts/construir-para-hospedagem.mjs:58:  return /AIzaSy/.test(readFileSync(caminho, 'utf8'));

$ git check-ignore -v .env.local
.gitignore:30:*.local   .env.local
```

A unica ocorrencia de `AIzaSy` e o pedaco de texto que o proprio script usa para **procurar**
chave dentro da saida construida e falhar se achar. Nao e chave, e a armadilha que impede
chave de passar. O `painel/.env.local` existe no disco, tem a chave de verdade, e esta
ignorado pelo git. O `painel/.env.example` nao tem valor nenhum.

### 2.7 Pasta da hospedagem e o script de construcao

**A pasta a servir e `painel/out`.** E o que o `firebase.json` da raiz, no disco, ja diz
(`"hosting": { "public": "painel/out" }`), com reescrita de tudo para `/index.html`.

Aviso honesto sobre esse arquivo, porque ele nao e meu: **o `firebase.json` da raiz esta
alterado no disco e ainda nao esta comitado.** O que esta comitado em `688ed2b` aponta para
`painel/preview`, sem reescrita. A alteracao para `painel/out` foi escrita as 10:04 do dia
13, antes desta sessao, provavelmente pelo agente frontend anterior; eu nao toquei nesse
arquivo, como a ordem mandava. Quem publica precisa decidir conscientemente: publicar o
painel de verdade pede `painel/out` com a reescrita, que e o que esta no disco.

**Sim, rode `npm run construir-para-hospedagem`, e nao `npm run build`.** Os dois constroem
a mesma coisa, mas o `npm run build` enxerga o `painel/.env.local` da maquina e o Next
embute a chave do Firebase dentro do pacote. Publicado, o painel nao precisa dela: ele le a
configuracao do endereco reservado `/__/firebase/init.json`, que a propria hospedagem do
Firebase serve. O script zera essas variaveis antes de construir e, no fim, varre toda a
pasta `painel/out` procurando chave; se achar, falha com codigo diferente de zero e nao
deixa publicar. A ultima construcao foi feita com esse script, entao `painel/out` ja esta
limpa e pronta.

Dois avisos para quem publica:

1. a pasta `painel/out` de hoje tem so o painel de verdade. O prototipo estatico da OST 5,
   em `painel/preview`, nao esta dentro dela, entao o endereco do prototipo publicado no
   canal de preview nao e servido por esta publicacao. Isso ja esta previsto no TASKS como
   o Bloco 3;
2. o painel so vai conseguir entrar depois que o Authentication estiver ligado. Publicar
   antes mostra a barreira com a mensagem "O Authentication do projeto ainda nao esta
   ligado. Ligue o provedor Google no console do Firebase e entre de novo", que e o
   comportamento desejado, mas nao da para validar a tela de dentro.

## 3. O que ficou faltando

- Validacao visual do diretor, §A.13. Teste verde e foto nao substituem. As fotos das duas
  rodadas existem para encurtar essa conversa, nao para substituir.
- Login ao vivo na nuvem, porque o Authentication continua desligado (item 2.5).
- Leitura da configuracao pela hospedagem, que so da para provar depois de publicado.
- As cinco telas fora do escopo da Onda 1 seguem como destino inerte, de proposito, §A.12.
- A aba Alteracoes da tela da fabrica nao existe, porque o contrato das tres pecas nao tem
  campo de arquivo tocado. Esta dito na propria tela, nao inventado.

## 4. Decisoes tomadas durante a execucao

1. **Nao reescrever o que ja funcionava.** O trabalho do agente anterior esta integro e
   bem documentado por dentro. Mexi em tres pontos, cada um com motivo medido.
2. **Numero de cartoes por pagina no celular, medido em vez de fixo.** Numero fixo quebra o
   princípio de tela unica em aparelho baixo, cortando conteudo. Medir custou quinze linhas
   e vale pelos aparelhos que nao conheco.
3. **Ajuste de 44px em `app/globals.css`, escopado na casca do celular**, e nao no CSS do
   pacote. O CSS do pacote e copiado por gerador e qualquer edicao a mao seria apagada na
   proxima geracao. No computador os controles continuam como o designer desenhou.
4. **Nao trocar a consulta de aprovacoes por filtro no banco**, mesmo existindo indice
   declarado para isso, porque nao ha prova de que esse indice esteja publicado e a troca
   quebraria a tela. Fica registrado para a Onda 2 (item 2.4).
5. **Tirar o identificador do app do `painel/.env.example`.** O arquivo trazia o id do app
   dentro do comando de exemplo, o que contraria o proprio principio escrito em
   `src/dados/configuracao.ts`, de que arquivo versionado nao carrega valor da nuvem.
   Troquei por `firebase apps:list WEB --project a-fabrica-soulan` seguido de
   `firebase apps:sdkconfig WEB <id-do-app> --project a-fabrica-soulan`, com o projeto
   explicito, §A.20.
6. **Reusar o emulador que ja estava de pe** na maquina, da sessao anterior, em vez de
   derrubar processo do diretor. A rodada nova tem pasta propria e semeia a propria base.

## 5. Arquivos e areas alteradas por mim

- `painel/src/telas/Celular.tsx`: cartao que nao encolhe, numero de cartoes medido em vez
  de fixo, e o gancho `usarQuantosCartoesCabem`.
- `painel/app/globals.css`: alvo de toque de 44px no celular, escopado em `.gf-mapp`.
- `painel/.env.example`: tirado o identificador do app do comentario.
- `painel/testes/rodada-2026-10-13-101200/`: rodada de revisao (semeador, roteiro de prova,
  roteiro de medida, copia das regras e dos indices, copia do `tokens.json` antes da prova
  de token, 21 fotos numeradas mais a foto do teste isolado de corte de texto).
- `painel/testes/rodada-2026-10-13-102132-final/`: rodada final (14 fotos, `medidas.json`,
  e `conferencia-toque/` com mais tres fotos e as medidas de toque).
- `painel/out/`: reconstruida com o script de hospedagem, limpa de chave.
- `docs/ost6-painel.md`: este relatorio.

Arquivos gerados que mudaram de valor so por regeneracao, sem edicao a mao:
`painel/app/tokens.gerado.css`, `painel/app/componentes.gerado.css`,
`painel/src/tema/tokens.gerado.ts`. O `gerenciador-de-fabricas/design-system/tokens.json`
foi alterado durante a prova do item f e devolvido ao original, conferido com `git diff`
vazio.

## 6. Problemas encontrados

1. **A linha do que a fabrica faz existia e nao aparecia** no celular, por aperto de flex,
   nao por CSS de recorte. So apareceu medindo o elemento no navegador; olhar o codigo nao
   bastava, e a foto da rodada anterior mostrava o sintoma sem a causa. Corrigido.
2. **Tres alvos de toque abaixo de 44px no celular**, vindos do CSS do proprio pacote do
   designer (setas de paginacao com 30px, abas com 40px). Corrigido no painel, sem tocar no
   pacote.
3. **Identificador do app dentro de arquivo versionado**, em comentario do `.env.example`.
   Corrigido.
4. **Authentication ainda desligado na nuvem**, o que impede a prova de ponta a ponta.
   Nao e furo do painel, e passo do diretor no console.
5. As fotos da rodada do agente anterior foram tiradas **antes** das ultimas edicoes dele,
   entao nao provavam o codigo que ficou no disco. Por isso refiz a rodada inteira.

## 7. Proximo passo recomendado

1. Diretor liga o Authentication do `a-fabrica-soulan` e habilita o provedor Google.
2. Diretor valida visualmente as fotos da rodada final, §A.13, em especial as tres telas do
   celular, que sao as que mudaram neste fechamento.
3. Coordenador publica `painel/out` depois de rodar `npm run construir-para-hospedagem`.
4. Com o painel no ar, provar o login de verdade e a leitura da configuracao pela
   hospedagem.
5. So entao abrir a Onda 2, levando o que esta no item 2.3 deste relatorio.

## 8. Proposta ao diretor, §A.12, nao construida

Em aparelho de tela baixa, de 667 pontos de altura, a tela Fabricas do celular mostra uma
fabrica por pagina, porque a faixa de aprovacao e os dois indicadores ocupam a metade de
cima. Se o diretor usar um aparelho assim, proponho, para a Onda 2, trocar os dois
indicadores do celular por uma linha unica de texto, do tipo "2 em execucao de 7, 2
esperando voce". Isso devolve cerca de 140 pontos de altura e faz caber de duas a tres
fabricas. Nao fiz agora porque muda o desenho do celular e isso e decisao do diretor.
