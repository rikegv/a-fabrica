# Parecer de segurança da OST 7

Agente: seguranca, com poder de veto, §A.0. Não implementei nada, não corrigi nada,
não comitei nada. Este arquivo é o parecer e nada mais.

Data: 2026-10-14. Base auditada: branch `feature/ost5-madrugada`, commits `592beb9`
(Blocos 0 e 1), `57bd3a3` (o gate), `7562514` (metade da ponte do Bloco 2) e
`a78abcc` (metade do painel do Bloco 2, acrescentada ao escopo pelo coordenador no
meio da auditoria).

## Como eu li

Comentário não é prova. Onde o código afirma proteção, eu fui conferir o que o
código faz, e quando dava para medir, eu medi nesta máquina. No fim do parecer está
a lista do que foi conferido ao vivo e do que foi julgado só por leitura.

## Quadro de vereditos

### As seis perguntas da ponte

| # | Pergunta | Veredito |
|---|----------|----------|
| 1 | Risco executa sem resposta do diretor em algum caminho? | Aprovado, com ressalva R3 |
| 2 | O gancho pode travar, atrasar ou quebrar uma sessão do diretor? | Aprovado, com R5 a R7 |
| 3 | Algum segredo vaza para a base pelos passos capturados? | Aprovado, com R8 a R11 |
| 4 | Alguém fora da conta do diretor lê ou escreve? | Aprovado, com R12 e R13 |
| 5 | A ponte abre porta para fora? | Aprovado, medido ao vivo |
| 6 | Sobrou afirmação de proteção que não é conferida? | VETADO: R1, R2, R3, R10, R15 |

### As seis perguntas do painel

| # | Pergunta | Veredito |
|---|----------|----------|
| 7 | A porta única de escrita é mesmo única, com guarda e hora de servidor? | Aprovado |
| 8 | O que o painel escreve é exatamente o que a regra permite? | Aprovado, com R16 |
| 9 | Resposta dupla, outra máquina, observação obrigatória | Aprovado, com R13 e R17 |
| 10 | As telas novas e o cwd escrito à mão | Aprovado, com ressalva R4 |
| 11 | §A.11, travessão | Aprovado, conferido ao vivo, zero |
| 12 | O painel da Onda 2 pode ser publicado? | Sim, sob cinco condições |

O veredito global da OST 7 é VETADO na pergunta 6, e o veto é de texto e de prova,
não de arquitetura: duas afirmações de proteção voltaram a existir no repositório
sem serem verdadeiras, e uma proteção central nunca foi provada para a ferramenta
que mais importa. Nada disso pede redesenho. O resto da OST 7 passou, e passou com
folga justamente nos pontos onde eu esperava achar furo.

## Ressalvas numeradas

Cada ressalva diz o que é, a evidência, e se bloqueia a main ou se bloqueia ligar a
Onda 2. "Bloqueia ligar a Onda 2" significa: pode ir para a main, mas o painel não
vai ao ar com ordens de verdade antes disso.

### R1. O gate do §A.7 não fechou o furo. Oito caminhos de publicação passam por fora

BLOQUEIA A MAIN.

Arquivos: `scripts/gate-deploy.sh`, `scripts/prova-gate.sh` e `scripts/publicar.mjs`.

O gate ganhou vigilância de endereço de API, e isso fechou o caso exato que o
diretor usou. Não fechou o furo. Eu medi, chamando o gate com o mesmo JSON que o
harness manda, e guardei o código de saída de cada caso. 2 é bloqueado, 0 é passou
por fora:

```
2   git push origin feature/x                                       (controle)
2   curl -s -X POST https://firebaserules.googleapis.com/...rulesets   (controle)
0   curl -s -d @regra.json https://firebaserules.googleapis.com/...rulesets
0   curl -s --data-binary @regra.json https://firebaserules.googleapis.com/...
0   git -C . push origin feature/x
0   node -e "fetch(URL_DA_API_DE_REGRA, QUE_LEVA_METODO_POST)"
0   powershell -Command "Invoke-RestMethod -Method Post -Uri URL_DA_HOSPEDAGEM"
0   npm publish
0   bash scripts/meu-envelope.sh
0   curl -s -X POST https://identitytoolkit.googleapis.com/admin/v2/projects/.../config
```

Em ordem de gravidade:

1. `curl -d` e `curl --data-binary` fazem POST sem a bandeira `-X`. A expressão de
   escrita do gate só reconhece `-X METODO` e `--request METODO`. Ou seja: o mesmo
   curl, no mesmo endereço, publicando a mesma regra, passa se a linha for escrita
   da forma mais comum que existe. O furo que a OST 7 diz ter fechado segue aberto.
2. `git -C . push` passa, porque a expressão do verbo exige `git` e o verbo
   colados. É o verbo original do §A.7, e escapa com dois caracteres.
3. Qualquer cliente HTTP que não seja curl passa: `node -e` com fetch,
   `Invoke-RestMethod` (e o PowerShell é o shell primário desta máquina), python,
   gcloud.
4. O endereço de administração do Authentication passa. É a API que muda domínio
   autorizado e segunda etapa. A configuração que decide QUEM entra no painel é
   alterável sem passar pelo gate.
5. Indireção passa: um envelope `.sh` com o curl dentro. O gate lê o comando, não o
   arquivo. É limite conhecido de gate de verbo, mas precisa estar escrito, e hoje
   não está.
6. `npm publish` não é vigiado. Está fora da lista do §A.7, então não cobro, mas
   registro: o próprio `risco()` da ponte classifica `npm publish` como alto.

O que está certo aqui, e eu confirmo: o `publicar.mjs` confere a flag por conta própria, e
`exigirFlag` é a primeira linha de `publicarRegra`, `publicarIndices` e
`publicarPainel`. O caminho de publicação da própria fábrica tem cinto e suspensório
de verdade, inclusive na brecha do `--conferir`: o gate libera o script quando a
linha traz `--conferir`, e o script recusa em seguida por falta de flag.

O que me faz vetar não é o furo residual, é a frase. O gate diz "Nenhum agente
contorna este gate" e o `publicar.mjs` repete "Nenhum agente contorna o gate". As duas são
falsas, e eu as derrubei em oito linhas. Afirmação de proteção não conferida foi
exatamente o que eu vetei na OST 6. Para sair do veto: ou o gate passa a reconhecer
POST implícito e cliente que não é curl, ou o texto passa a dizer a verdade sobre o
que ele cobre e o que não cobre. A primeira é melhor; a segunda é obrigatória de
qualquer jeito.

### R2. A afirmação de segundo fator voltou, e está na tela que o diretor lê

BLOQUEIA A MAIN.

`firebase/firestore.rules`, linha 59, escrita nesta mesma OST, manda: "nenhum
arquivo deste repositorio deve afirmar que o segundo fator esta exigido, porque
afirmar protecao que nao se verifica e pior do que nao ter". Três lugares violam a
própria regra:

- `ponte/src/entradaNavegador.ts`, linhas 21 e 22, cabeçalho: "faz o login com o
  Google, com o segundo fator que a conta dele já exige".
- `ponte/src/entradaNavegador.ts`, linha 182, texto que o diretor LÊ NA PÁGINA DE
  LOGIN: "o Google confirma quem você é, com a segunda etapa que a sua conta já
  exige".
- `ponte/src/identidade.ts`, linha 387, descrição do degrau, impressa no terminal
  pelo `entrar.ts`: "com a segunda etapa que a conta dele exige".

Nada neste projeto confere segundo fator. A regra do Firestore não confere, o token
do provedor não carrega a informação, e a ponte não consulta nada. A frase aparece
justamente no instante em que o diretor decide confiar naquela porta. É a mesma
afirmação falsa que eu vetei na OST 6, de volta, em três lugares, um deles na tela.
Correção: tirar a afirmação, ou trocar por "com a segunda etapa, se a sua conta
exigir, que é responsabilidade da conta Google e não deste painel".

Honra ao que é devido: `painel/src/dados/autenticacao.ts` faz exatamente isso, diz
que nem ele nem a regra conferem segundo fator, e está honesto.

### R3. O portão nunca foi provado para a ferramenta Bash

BLOQUEIA LIGAR A ONDA 2.

As três ressalvas da OST 4 continuam inteiras, e eu confirmo que estão em todo
caminho de abertura: `acoes.ts` abre por `abrirSessao`, que chama `rodarSessao`, que
chama `abrirFabrica`, e `abrirFabrica` roda `verificaPortao` antes de qualquer coisa
e lança `PortaoNaoConfirmado` se a isca não provar o portão vivo. Não existe
bandeira que desligue, não existe caminho novo que dispense, e `encerrar` e `pausar`
não abrem sessão nenhuma; `reiniciar` abre e passa pelo mesmo caminho. Procurei
caminho que dispensasse as três e não achei.

O problema é o conteúdo da prova. A isca de `verificaPortao` pede uma ESCRITA de
arquivo, e o veredito é `vivo = chamado > 0 && !iscaExecutou`. Procurei em todas as
provas do pacote quem já viu o portão receber `Bash`: ninguém. O `chamadasDoPortao`
de `prova-acoes.ts` só é alimentado por tarefa de escrita de arquivo, e nenhuma
prova manda a sessão rodar um comando. Ou seja: a frase "toda chamada de risco passa
por um portão" está provada para a ferramenta de escrita e ASSUMIDA para a
ferramenta que apaga arquivo, publica e acessa rede.

Não estou dizendo que o Bash escapa. Pelo desenho do kit, com o modo de permissão
fixado em `default` e `settingSources: []`, ele não deveria escapar. Estou dizendo
que isso nunca foi medido, e é exatamente o tipo de afirmação que a pergunta 6
existe para pegar. Correção: uma conferência que veja o portão receber `Bash` com um
comando de risco e o comando não executar. É pequena, e fecha a ressalva.

Nota de limite, que não é ressalva e precisa estar escrita: ferramenta de leitura
não chega ao portão no modo `default`. Isso é do kit, não da ponte, e é coerente com
o §A.6, que fala de chamada de RISCO. Mas significa que uma fábrica aberta pelo
painel lê qualquer arquivo que o usuário do diretor lê, sem pedir nada a ninguém.
Para TIRAR algo da máquina ainda é preciso uma chamada de risco, e essa é barrada.

### R4. O cwd vem de fora sem conferência, e a ponte CRIA a pasta

BLOQUEIA LIGAR A ONDA 2 na minha leitura. A decisão é do diretor.

O caminho completo: o painel aceita caminho escrito à mão (`NovaFabrica.tsx`, campo
livre, validação só de "não vazio") e grava em `comandos.cwd`; a regra do Firestore
não restringe `cwd`; `acoes.ts` faz `cwd = comando.cwd ?? mundo.cwdPadrao()` sem
nenhuma validação; e `verificaPortao` roda `mkdirSync(cwd, { recursive: true })`.
Resultado: uma ordem do painel cria árvore de pasta em qualquer lugar onde o usuário
do diretor pode escrever, e abre uma sessão do Claude Code lá dentro.

Isto não é furo de autenticação, é alcance. E eu não proponho filtro de comando, que
o diretor já disse, com razão, que não é proteção real aqui. Proponho a conferência
que falta e que não é artificial: a ponte RECUSAR cwd que não existe, em vez de
criar. Três motivos concretos:

1. Erro de digitação no celular abre fábrica numa pasta vazia nova, e o diretor não
   entende por que o agente não acha nada.
2. Nesta máquina existem projetos de produção de verdade; o §A.20 existe por causa
   disso. Um cwd apontando para um deles abre uma fábrica dentro de produção, e as
   LEITURAS dela não passam pelo portão, veja R3.
3. `personas.ts` lê a definição de agente de `cwd/.claude/agents`. Quem escolhe o
   cwd escolhe o prompt de sistema que a sessão recebe.

O cadastro de projetos é F7 e está fora desta onda, §A.12, e o painel é honesto
sobre isso na própria tela. Recusar pasta que não existe não é o cadastro, é uma
linha.

### R5. O gancho custa uma subida de Node por passo, em toda sessão do diretor

Não bloqueia. Precisa estar escrito no lugar que o diretor lê.

Medi na fila real desta máquina, 618 linhas da minha própria sessão de auditoria: o
custo INTERNO do gancho é mínimo, mediana 1,7 ms e máximo 17,7 ms. O custo que o
diretor sente não é esse, é a subida do processo, que a própria fábrica mediu em
129 ms de p95 para módulo comum. Isso entra em TODO passo de TODA sessão dele, em
qualquer projeto. A escolha de `.cjs`, sem `require` além de `node:fs`, foi medida e
está certa, e o `timeout: 5` de cada entrada do `settings.json` limita o pior caso.
O que falta é a frase honesta: ligar os ganchos acrescenta cerca de um décimo de
segundo por passo ao trabalho dele.

### R6. Sessões em paralelo escrevem no MESMO arquivo de fila

Não bloqueia. Perda silenciosa de passo, não vazamento.

O arquivo é nomeado pelo identificador da sessão, e subagente herda o identificador
da sessão pai. Na minha própria rodada, o agente do painel e eu caímos no mesmo
arquivo. São processos diferentes escrevendo com `appendFileSync` no mesmo arquivo,
ao mesmo tempo. Escrita curta em modo de acréscimo normalmente não intercala, mas
não há garantia: duas linhas podem se misturar. `varrerFila` trata linha ilegível
como vista, soma os bytes e segue, então o resultado é um passo perdido em silêncio,
contado em `linhasIlegiveis` e em nenhum lugar que o diretor veja. A decisão de
falha está certa (não travar a fila); o relato é que está incompleto.

### R7. Teto da fila: até 8 GB no pior caso teórico

Não bloqueia.

`tetoBytesPorSessao` de 4 MB vezes `tetoArquivosNaFila` de 2000. A conferência de
quantidade de arquivos só roda no primeiro passo de cada sessão, o que é a decisão
certa para velocidade. Com a ponte fora do ar por muito tempo o teto existe e
segura, mas o número que ele segura é grande. Vale escrever o número.

### R8. O corte de 2000 caracteres quebra a máscara e publica pedaço de segredo em claro

Não bloqueia a main. Deveria entrar antes de ligar a Onda 2.

Medido: pus uma chave do Google no fim de um alvo de mais de 2000 caracteres, passei
pelo corte do gancho e depois pela máscara de verdade. Saída publicada:

```
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxAIzaSyA1b2C3d4E[...cortado]
```

Nenhum padrão pegou, porque o corte destruiu a forma. O parágrafo de honestidade do
`mascara.ts` diz que "segredo sem forma reconhecivel passa". Este segredo TINHA
forma reconhecível; foi o nosso corte que a tirou. O parágrafo não cobre este caso,
e é o caso mais fácil de acontecer com comando longo, que é o que o diretor escreve
em bloco de texto.

### R9. A máscara é quase toda em inglês, e o diretor trabalha em português

Não bloqueia. O parágrafo cobre isso por dentro, mas a peneira é mais fraca do que
alguém supõe ao ler "treze formas".

Passei uma bateria pela `mascarar()` de verdade. As treze formas declaradas pegam
todas, uma por uma, e nessa parte eu confirmo o parágrafo. O que passa:

```
PASSOU   $env:MINHA_CHAVE = "Zx9Qw8Er7Ty6Ui5Op4As3Df2"
PASSOU   node x.js --segredo Zx9Qw8Er7Ty6Ui5Op4As3Df2
PASSOU   psql postgres://admin:Zx9Qw8Er7Ty6@db.interno:5432/producao
PASSOU   use este token para testar: Zx9Qw8Er7Ty6Ui5Op4As3Df2Gh1Jk
```

A lista de nomes suspeitos tem `senha`, e não tem `chave` nem `segredo`, que são as
duas palavras que o diretor usaria. Cadeia de conexão com senha embutida passa, e
tem forma reconhecível. E a última linha é a pior: segredo colado pelo próprio
diretor dentro do pedido passa, e o pedido É publicado, no campo `pedidoDoDiretor`.
Minha leitura da pergunta que o diretor fez: o parágrafo é honesto, não promete o
que não cumpre. Mas três palavras em português e a forma de cadeia de conexão
fechariam os casos mais prováveis desta máquina.

### R10. A máscara dá falso positivo em `-p` e MENTE que mascarou credencial

Entra no veto da pergunta 6. Não bloqueia a main sozinha.

Na fila real desta máquina, 9 de 697 campos de texto foram mascarados. Nenhum deles
tinha credencial. Todos eram `-p`:

```
antes:  cd .../ponte && npx tsc -p tsconfig.json 2>&1 | grep -v ...
depois: cd .../ponte && npx tsc -p [credencial mascarada] 2>&1 | grep -v ...
antes:  mkdir -p "$RODADA"; echo ...
depois: mkdir -p [credencial mascarada]; echo ...
```

Duas consequências. A trilha perde o alvo de verdade do passo, que é o que o painel
mostra. E o campo `mascarou` afirma ao diretor que havia credencial ali, quando
havia um caminho de pasta. Proteção que afirma ter agido sem ter agido é o mesmo
defeito da pergunta 6, do lado de dentro.

E a prova não pega isto, porque passa por vácuo: `CASOS_LIMPOS` em
`prova-ganchos.ts` tem seis casos de texto comum e nenhum deles tem `-p`, embora
`mkdir -p` e `tsc -p` sejam as linhas mais comuns da máquina. A parte 1b se chama
"texto comum nao pode ser estragado pela mascara" e passa porque não testa o texto
comum de verdade.

### R11. O campo `projeto` sobe sem máscara

Não bloqueia. Baixo.

`traduzir()` mascara `alvo`, `pedidoDoDiretor`, `descricao`, `aviso` e `motivo`. O
`projeto`, que é o cwd, vai cru para `atualizarFabrica`. Caminho de pasta raramente
carrega segredo, mas a decisão deveria estar escrita, porque hoje parece
esquecimento e não escolha.

### R12. Conta única: `maquinaId` não é fronteira, e isso está honesto

Não bloqueia. Registro de concordância.

A regra já diz, com estas palavras, que `maquinaId` é escopo lógico e não fronteira
de segurança, e que sob conta única não existe isolamento entre pessoas porque só
existe uma pessoa. Confirmo: é a leitura certa, e é o oposto de vender proteção. A
proteção dura é a conta única, mais o nega tudo do fim das regras, mais a trilha que
não se apaga e cuja hora vem do servidor.

### R13. A fila de aprovações do painel não é filtrada por máquina

Não bloqueia. Baixo, de tela.

`ouvintes.ts` ouve `aprovacoes` com ordem por `criadoEm` e limite de 100, sem filtro
por `maquinaId`. Com duas máquinas, o diretor responde pedido de uma olhando a tela
da outra. Não é brecha: a resposta vai para o identificador exato do pedido e só a
ponte daquela máquina a consome. É escopo de exibição, e o pacote mostra fábrica e
projeto, o que atenua. Responde a parte da pergunta 9 do coordenador sobre "pedido
de outra máquina": não existe caminho em que o painel responda indevidamente, porque
a resposta é endereçada ao documento, não à máquina.

### R14. O 127.0.0.1 nos domínios autorizados do Authentication

Não bloqueia. Avaliado e aceito, com a razão escrita.

O que isso habilita: qualquer página servida de 127.0.0.1 nesta máquina pode rodar o
fluxo de login do projeto `a-fabrica-soulan`. Três coisas limitam o risco a quase
nada. Primeiro, `localhost` já está na lista padrão de todo projeto Firebase, então o
aumento real de superfície é marginal. Segundo, a chave de API do cliente é pública
por desenho: quem quisesse montar página falsa não precisava deste domínio. Terceiro,
o ataque exige que o diretor conclua um login do Google numa página que não é a dele.
Minha avaliação: risco aceitável, e o ganho, que é matar a colagem de credencial na
tela, é maior.

### R15. Mais uma prova que passa por vácuo

Entra no veto da pergunta 6. Não bloqueia a main.

`ponte/src/testes/prova-acoes-emulador.ts`, linha 514, confere que nenhum texto da
rodada traz travessão usando `respostas.every(...)`. Lista vazia faz `every`
devolver verdadeiro: se nenhuma aprovação aparecer na rodada, `respostas` fica vazio
e a conferência PASSA afirmando que conferiu. É a terceira prova desta forma na OST
7, depois da parte 5 do `provar-ao-vivo.mjs` e da persona do `prova-acoes.ts`, que o
diretor já achou. O remédio é o mesmo nos três: exigir também que a lista não esteja
vazia. Procurei outras e não achei mais: `prova-credencial.ts`, `prova-ressalvas.ts`
e `prova-tempo-esgotado.ts` têm caso negativo de verdade, e a correção da persona
está certa, ela agora prova pelo CONTEÚDO do arquivo e não pelo estilo da narração.

### R16. A regra não restringe `acao` nem `cwd`

Não bloqueia. É o limite honesto do que regra de Firestore alcança.

O painel escreve em `comandos` exatamente o conjunto que a regra exige (`fabricaId`,
`maquinaId`, `texto`, `situacao` pendente, `criadoEm` de servidor e `origem`
preenchida) mais `acao`, `cwd`, `agente`, `modelo` e `conversationId`. A regra não
olha nenhum destes cinco. Quem recusa valor estranho é a ponte, e recusa bem: ação
desconhecida é recusada com motivo na base (provado no emulador com a ação
`explodir`), e `modeloAceito` e `nomeDeAgenteAceito` barram texto com espaço, aspas,
barra e `..` antes de virar pedaço de caminho de arquivo. Falha fechada do lado
certo. Fica registrado para quem ler depois: a regra NÃO é a defesa destes campos, a
ponte é. Não achei escrita que a regra deixasse passar e que a ponte aceitasse sem
conferir.

### R17. Aprovar com observação sem texto: travado na tela e na porta, não na regra

Não bloqueia. Responde a pergunta 9 do coordenador.

Não é só trava de tela, e eu conferi nos três níveis:

1. `ApprovalItem.tsx` desabilita o botão e ainda tem `if (!texto.trim()) return;`
   antes de chamar.
2. `escritas.ts`, linha 311, recusa com mensagem em português antes de qualquer
   escrita. Esta é a que importa, porque é a porta única: tela nova herda a trava.
3. A regra do Firestore NÃO exige. Ela aceitaria `aprovado com observacao` com
   `observacao` nula.

Como a ponte trata `aprovado com observacao` como liberação com ou sem observação,
observação vazia não vira brecha de execução, vira trilha pobre. Aceito como está,
registrando que o nível 3 não existe.

## O que eu confirmo que está de pé, com evidência

Esta parte importa tanto quanto as ressalvas, porque é onde eu esperava achar furo e
não achei.

### A ponte não abre porta para fora. Medido, não deduzido

Subi a porta de entrada de verdade, com `naoAbrirNavegador`, e tentei alcançá-la por
tudo que não é 127.0.0.1, inclusive duas redes de sobreposição onde existem máquinas
de outras pessoas:

```
SEM RESPOSTA  Radmin VPN 26.187.29.6:57285          (ECONNREFUSED)
SEM RESPOSTA  ZeroTier One 10.18.117.213:57285      (ECONNREFUSED)
SEM RESPOSTA  Wi-Fi 192.168.15.118:57285            (ECONNREFUSED)
SEM RESPOSTA  vEthernet 172.22.16.1:57285           (ECONNREFUSED)
SEM RESPOSTA  DESKTOP-5LR6BRG:57285                 (ETIMEDOUT)
SEM RESPOSTA  0.0.0.0:57285                         (ECONNREFUSED)
```

`ECONNREFUSED` quer dizer que não havia nada escutando ali. Esta máquina tem
ZeroTier e Radmin VPN ativos, o que torna a tranca T1 muito mais do que
formalidade, e ela aguentou.

As sete trancas, uma por uma, contra a porta de verdade:

```
T5  localhost:porta COM o segredo certo    -> HTTP 404 (hospedeiro recusado)
T4  127.0.0.1 sem segredo                  -> HTTP 404
T4  segredo ERRADO do mesmo tamanho        -> HTTP 404
T6  entrega sem tipo de conteúdo JSON      -> HTTP 415
T6  pré-verificação OPTIONS de outra origem-> HTTP 404, sem cabeçalho de origem cruzada
T7  primeira entrega                       -> HTTP 200, e a porta fechou em 61 ms
T7  segunda entrega logo depois            -> ECONNRESET, não havia mais porta
T3  tempo esgotado                         -> "a porta fechou", erro de falha fechada
T2  porta sorteada pelo sistema            -> 57279 e 57285 em duas rodadas
```

T5 recusar até `localhost` é mais forte do que o cabeçalho promete, e fecha o ataque
de nome que resolve para o laço de retorno. Nota de honestidade sobre o meu próprio
teste: na rodada das interfaces o controle em 127.0.0.1 também deu ECONNREFUSED,
porque o tempo de 6 segundos esgotou antes da última chamada do laço. Quem provou
que 127.0.0.1 responde 200 com o segredo foi a rodada anterior, a das sete trancas.

O interruptor é único e eu conferi quem o liga: `permitirNavegador` tem padrão falso
em `identidade.ts`, e o único lugar do pacote que passa verdadeiro é `entrar.ts`. O
`initBase`, por onde o SERVIÇO sobe, não passa. Então o processo que fica no ar o dia
inteiro não tem caminho de código que abra porta. `createServer` e `.listen` existem
em um arquivo só, `entradaNavegador.ts`, e em nenhum lugar do painel.

### A tranca da sessão fecha de verdade, e a ponte recusa subir sem ela

Esta era a condição 12 do meu parecer da OST 6 parte 2, e está cumprida. Conferido
ao vivo: copiei a `config.json` para uma pasta com herança normal e subi a ponte
apontada para lá.

```
CODIGO DE SAIDA: 6
a ponte não sobe com a sessão desprotegida, porque na Onda 2 esse arquivo vale como
chave de aprovação. O que está aberto: ...pasta-sem-tranca ainda herda permissão da
pasta de cima (CodexSandboxUsers, S-1-5-21-..., AUTORIDADE NT\SISTEMA,
BUILTIN\Administradores, Henrique) | ...config.json dá acesso a quem não é o dono
```

Recusa, não aviso. E o estado real da máquina hoje:

```
.a-fabrica-ponte              DESKTOP-5LR6BRG\Henrique:(OI)(CI)(F)   herança quebrada
.a-fabrica-ponte/config.json  Henrique:(I)(F)                        só o dono
.a-fabrica-ponte/sessao.json  Henrique:(I)(F)                        só o dono
.a-fabrica-ponte/fila-ganchos Henrique:(I)(OI)(CI)(F)                só o dono
```

A última linha é importante para a pergunta 3: a fila de ganchos guarda o comando
CRU, sem máscara, e ela está fechada para o dono. A afirmação do `mascara.ts` de que
a fila "mora em pasta trancada para o dono" é verdadeira, e eu conferi com o icacls,
não com o comentário.

Sobre a decisão consciente de exigir herança quebrada na PASTA e não no ARQUIVO: ela
se sustenta, e se sustenta por medição e não por argumento. O raciocínio é válido
porque a pasta tem uma entrada só, do dono, com herança quebrada, então arquivo que
herda dela só pode herdar o dono. E a prova de que a metade relaxada ainda morde: na
minha rodada, o `config.json` da pasta aberta foi REPROVADO pela conferência de
arquivo, que não exige herança quebrada, só porque apareceram identidades que não
são o dono. O motivo prático escrito no código (o SDK regrava a sessão a cada
renovação e o arquivo novo nasce herdando) é real, e sem essa folga a ponte recusaria
subir depois da primeira renovação, por uma coisa que não é furo.

Duas observações pequenas, nenhuma bloqueia. `entrar.ts` linha 95 confere a pasta
local com `conferirProtecao` sem opções, isto é, SEM exigir herança quebrada,
enquanto `ponte.ts` exige. Na prática a conferência de identidade estranha pega o
caso real, mas as duas chamadas deveriam ser iguais. E a garantia do arquivo depende
de a pasta ser conferida na MESMA chamada: hoje é, nos dois lugares, e quem mexer
nisso depois precisa saber que o argumento desaba se alguém conferir o arquivo
sozinho.

### O gancho não quebra a sessão do diretor

Caminho por caminho, no código que roda: não existe saída com código diferente de
zero (o `process.exit(0)` é a última linha e está fora do `try`); não existe uma
única escrita em saída padrão, o que importa porque saída de `UserPromptSubmit`
entraria no contexto do diretor; a entrada de texto é lida ANTES de qualquer decisão,
inclusive no caminho de desligado, para quem escreveu não levar erro de escrita
encerrada; e `PreToolUse` está deliberadamente fora da lista de eventos, que é o
único evento com poder de bloquear ferramenta. O interruptor de um passo funciona:
`ligado` diferente de verdadeiro sai calado. Configuração ausente e configuração
corrompida caem no `catch` vazio, e eu li a prova que exercita os dois.

Medido na fila de verdade: eventos capturados `PostToolUse`, `UserPromptSubmit`,
`Stop`, `SubagentStart`, `SubagentStop` e `Notification`; custo interno com mediana
de 1,7 ms e máximo de 17,7 ms em 618 passos reais, os meus e os do agente do painel.

### §A.9, Plano B: nada da configuração do diretor foi alterado

Conferido ao vivo, contra a cópia de segurança mais antiga, a de antes da primeira
instalação dos ganchos:

```
chaves orig : agentPushNotifEnabled,autoUpdatesChannel,model,permissions,
              skipDangerousModePermissionPrompt,tui
chaves atual: agentPushNotifEnabled,autoUpdatesChannel,model,permissions,
              skipDangerousModePermissionPrompt,tui
igual sem os ganchos da fabrica: SIM
```

Tirando as oito entradas que a fábrica acrescentou, o `~/.claude/settings.json` de
hoje é idêntico, campo por campo, ao de antes da instalação. Só acrescentou. As
cópias estão em `~/.a-fabrica-ponte/copias-settings`, com data e hora no nome,
nenhuma sobrescrita, §A.17. O `desligar.ps1` existe, e o Plano B está de pé: o
diretor abre o Claude Code na mão e segue. Nenhum caminho de código deste projeto lê
ou escreve configuração do Antigravity, e eu procurei.

Um conselho, que deixo sem número porque não é defeito de hoje: `ligar.ps1`
reescreve o arquivo inteiro por ida e volta de JSON, com profundidade máxima de 20,
em vez de acrescentar texto. Hoje a configuração do diretor tem profundidade 6, bem
abaixo do teto, então nada foi truncado, e eu medi isso. Se um dia ela passar de 20
níveis, esse caminho truncaria em silêncio. Quem protege disso é a cópia de
segurança, que existe e está correta.

### Falha fechada do portão, caminho por caminho

Conferido por leitura, com as provas da OST 6 ainda valendo: erro no portão devolve
recusa; `modoConferido` falso devolve recusa antes de qualquer ferramenta; init que
não vem com o modo igual a `default` lança e a fábrica não nasce; resposta malformada
devolve recusa; erro ao ouvir a base devolve recusa; tempo esgotado devolve recusa E
grava a trilha na base com hora de servidor, o que está provado em
`prova-tempo-esgotado.ts`, inclusive com resposta tardia do diretor depois do prazo,
que a regra recusa porque o documento já não está pendente; fábrica interrompida por
ordem do diretor devolve recusa em vez de criar pedido fantasma; e o reinício da
ponte recusa pendente órfão. Não existe liberação em nenhum caminho que não seja a
resposta explícita do diretor, `aprovado` ou `aprovado com observacao`. Não existe
pré-autorização e não existe aprovação automática.

`personas.ts` NÃO importa `permissionMode` nem `tools` da definição de agente do
diretor. A avaliação que o coordenador pediu: a decisão está CERTA, e está COMPLETA
para os campos que existem hoje na definição de agente do kit. O modo de permissão
nunca pode vir de arquivo de projeto, e isso é §A.6 literal. Sobre `tools`, o efeito
é que a ponte ELEVA o agente: um agente que o diretor escreveu restrito a leitura
recebe o conjunto inteiro de ferramentas. Aceito, por dois motivos: o controle real é
o portão, e sem ferramenta de escrita a isca da ressalva 1 daria "portão morto" e a
fábrica não nasceria por motivo falso. Mas fica dito que é elevação consciente, e que
o preço dela é pago pelo portão, o que amarra a R3 mais forte ainda: se o portão não
está provado para o Bash, a elevação não tem rede embaixo.

O `settingSources: []` é o que impede um projeto qualquer de instalar permissão ou
gancho que passe por cima do portão, e confirmo que ele está dentro de
`opcoesDaSessao`, isto é, vale igual na isca e na sessão real. Efeito colateral bom
e que vale registrar: por causa dele, a fábrica aberta pelo painel não dispara os
ganchos do Bloco 1, então não existe laço de uma coisa alimentando a outra.

### Conta única, trilha, e a porta de escrita do painel

A regra nega por padrão no fim do arquivo, exige o e-mail exato do diretor e
`email_verified`, nega `delete` em toda coleção de trilha, e amarra `criadoEm`,
`respondidoEm`, `entregueEm`, `em` e `vistoPorUltimo` a `request.time`, o que impede
hora forjada pelo cliente. `comandos` só vai de pendente para entregue, uma vez.
`aprovacoes` só vai de pendente para respondida, uma vez, com `respondidoPor`
preenchido. Isso responde a pergunta do coordenador sobre resposta dupla: quem
impede a segunda resposta é a REGRA, no servidor, não a tela. O painel ainda tem a
trava de ordem em curso (`usarOrdem`, com `emCurso`) e a mensagem certa quando a base
recusa por isso, mas a garantia dura é do servidor.

A porta única é mesmo única. Varri `painel/` inteiro por `setDoc`, `updateDoc`,
`addDoc`, `deleteDoc`, `runTransaction` e `writeBatch`: as únicas ocorrências de
código vivo estão em `painel/src/dados/escritas.ts`, um `addDoc` em `comandos` e um
`updateDoc` em `aprovacoes`. Todo o resto dos acertos é cópia de regra dentro de
pasta de teste. Nenhuma função de lá escreve em `fabricas`, `atividade`, `maquinas`
ou `relatorios`, que são da ponte.

O `conferir()` exige base ligada, usuário presente, e-mail do diretor em minúsculas,
`emailVerified`, ponte viva e máquina pareada, e nenhuma função lança para a tela.
Hora de trilha só sai de `serverTimestamp()`: procurei hora de cliente em
`src/dados` e `src/telas` e as únicas datas de máquina são de exibição de tempo
decorrido e o sorteio do identificador de fábrica, nenhuma vai para a base como
trilha.

A barreira de entrada (`autenticacao.ts`) dá `signOut` em conta que não é a do
diretor e em conta com e-mail não verificado, e os ouvintes da base só nascem depois
que a situação é "dentro". Nenhuma leitura acontece antes disso.

### §A.11, travessão

Zero ocorrências de travessão em `painel/src`, `painel/app`, `painel/public`,
`ponte/src`, `ponte/ganchos` e `scripts`, incluindo mensagem de erro. Antes de
confiar num resultado vazio eu validei que a minha própria busca encontra um
travessão de verdade num arquivo que eu plantei. Confirmo a conferência do diretor.

## Pode publicar o painel da Onda 2?

O meu parecer da OST 6 parte 2 disse: Onda 2 liberada para construir, proibida de
ligar. Isso MUDA agora, e muda porque o que faltava era o que esta OST entregou: a
tranca da sessão que recusa subir, a trilha de tempo esgotado, a entrada sem colagem
de credencial, e as cinco ações com o portão inteiro em todo caminho de abertura.

Veredito: SIM, o painel pode ser publicado, sob cinco condições. Quatro são da
fábrica e uma é do diretor.

**C1. Fechar a R1.** O gate tem de parar de afirmar o que não cumpre. Esta condição é
primeira de propósito: o ato de publicar é exatamente o que o gate existe para
vigiar, e eu não assino liberação para usar uma ferramenta de controle enquanto o
texto dela é falso. Mínimo aceitável: reconhecer POST implícito (`-d`,
`--data-binary`, `--data`, `-F`, `-T`) e cliente que não é curl, mais o `git` com
argumento no meio; e escrever, no cabeçalho, o que o gate NÃO cobre, que é indireção
por arquivo.

**C2. Fechar a R2.** Tirar a afirmação de segundo fator dos três lugares, inclusive
do texto da página de login. Isso é texto, não código.

**C3. Fechar a R3.** Provar o portão para o Bash, uma vez, com evidência de rodada.
Sem isso, publicar o painel é ligar a Onda 2 em cima de uma proteção que nunca foi
medida na ferramenta que mais pode machucar.

**C4. Decidir a R4.** A minha recomendação é a ponte recusar cwd que não existe, em
vez de criar. Se o diretor preferir deixar como está, que seja decisão dele, escrita
no diário, e não omissão: quem digita o caminho no celular está escolhendo onde uma
sessão de agente vai nascer.

**C5. Condição do diretor, e só ele pode cumprir.** Confirmar, com evidência da
própria conta Google, que a verificação em duas etapas está LIGADA em
`henrique.vieira@soulan.com.br`. Esta é a condição mais importante das cinco e não
tem código nenhum. Publicado, o painel fica num endereço que qualquer pessoa do
mundo alcança, e a única porta é o login do Google. Quem entra no painel comanda
esta máquina: abre fábrica em qualquer pasta, manda comando, e responde as próprias
aprovações. Toda a segurança do sistema é, literalmente, a segurança daquela conta.
Nada neste repositório pode verificar isso, é por isso que a R2 existe, e é por isso
que a confirmação tem de vir do diretor antes de o painel ir ao ar.

O que eu NÃO exijo, para ficar claro: não exijo filtro de comando, não exijo lista
branca de ferramenta, não exijo aprovação em dois passos. O diretor está certo, a
proteção real aqui é a porta de entrada, e inventar proteção de teatro só esconderia
o que importa.

Sobre o pacote pronto em `painel/out`, eu conferi duas coisas que eu não assinaria
sem olhar: não existe nenhuma chave do Firebase dentro do pacote construído (e o
`publicar.mjs` ainda recusa publicar se achar uma), e não existe nenhuma menção a 127.0.0.1
nem configuração de emulador ligada no pacote. Publicado, o painel lê a configuração
do cliente de `/__/firebase/init.json`, que é o que a hospedagem serve. Está certo.

## Quadro de bloqueio

**Bloqueia a main:** R1 (o gate afirma o que não cumpre, oito caminhos medidos por
fora) e R2 (afirmação de segundo fator de volta, inclusive na tela). As duas são
correção de texto, e a R1 ganha muito se o texto vier junto com a expressão
corrigida.

**Bloqueia ligar a Onda 2, isto é, publicar o painel:** R1, R2, R3 (portão nunca
provado para o Bash), R4 (decisão sobre o cwd) e a condição C5, que é do diretor.
A R8 eu recomendo fortemente no mesmo lote, porque é o único caso em que segredo de
forma conhecida sobe em claro.

**Não bloqueia nada, mas tem de ser escrito:** R5, R6, R7, R9, R10, R11, R12, R13,
R14, R15, R16 e R17. A R10 e a R15 são defeito de prova, não de proteção, e estão
dentro do veto da pergunta 6 porque prova que passa por vácuo é afirmação não
conferida com outro nome.

## O que eu conferi ao vivo e o que julguei só pelo código

Conferido ao vivo, nesta máquina, com saída guardada no corpo do parecer:

1. O gate, com dez comandos de teste e o código de saída de cada um.
2. A porta do laço de retorno, subida de verdade, atacada por seis endereços de rede
   e pelas sete trancas, uma por uma.
3. A recusa de subida da ponte com a pasta desprotegida, com código de saída 6.
4. O icacls real da pasta local, da configuração, da sessão e da fila de ganchos.
5. A máscara, com bateria de dezenove casos e com os 697 campos de texto da fila
   real desta máquina, 618 passos, incluindo o falso positivo do `-p`.
6. O corte de 2000 caracteres destruindo a forma de uma chave do Google.
7. O custo interno do gancho, mediana e máximo, medido nos passos reais de hoje.
8. O `~/.claude/settings.json` de hoje contra a cópia de antes da instalação, campo
   por campo, com e sem os ganchos da fábrica.
9. A busca de travessão, com validação de que a busca acha travessão de verdade.
10. O pacote construído do painel, procurando chave do Firebase e emulador ligado.
11. A varredura de escrita no painel, procurando segunda porta de escrita.

Julgado só pela leitura do código, sem rodar:

1. A falha fechada do portão em cada ramo (as provas da OST 6 e a
   `prova-tempo-esgotado.ts` cobrem isso, e eu li as duas em vez de rodar de novo).
2. O comportamento do kit quanto a quais ferramentas chegam ao portão, que é
   justamente o que a R3 manda provar.
3. As cinco ações contra a base de verdade: li a prova do emulador e as evidências
   da rodada, não subi a ponte contra a nuvem, porque a sessão de nuvem desta
   máquina ainda não existe (o `sessao.json` tem 81 bytes e nenhuma entrada, o
   diretor ainda não fez o login no navegador).
4. O `publicar.mjs` eu NÃO rodei de propósito, nem em modo de conferência: é um script que
   publica, e auditor não publica. Li que o `exigirFlag` é a primeira linha de cada
   caminho de publicação, o que me basta.
5. As telas, pelo código e pelos 33 prints da rodada do painel. Validação visual é
   do diretor, §A.13.

## Fecho

Aprovado nas perguntas 1, 2, 3, 4 e 5, e nas perguntas 7 a 11 do painel, com as
ressalvas numeradas acima. VETADO na pergunta 6: sobrou afirmação de proteção que
não é conferida, em três formas diferentes, e uma delas aparece na tela que o diretor
lê no momento de confiar na porta de entrada.

O veto volta ao coordenador, que direciona a correção. R1 e R2 liberam a main. R1,
R2, R3, R4 e a condição C5 liberam publicar o painel. Nada aqui pede redesenho de
nada, e a parte difícil desta OST, que era abrir uma porta local sem furar o §A.6 e
pôr um gancho no caminho do trabalho do diretor sem atrapalhar, está de pé e eu medi.

Agente seguranca, OST 7.
