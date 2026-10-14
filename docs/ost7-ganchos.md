# Bloco 1 da OST 7, o painel enxerga o que o diretor abre na mão

Agente responsável: **coordenador** (§A.15). Toda sessão do Claude Code que o diretor
abrir, de qualquer projeto, se anuncia sozinha, e o painel passa a mostrar as fábricas de
verdade dele sem que ele mude o jeito de trabalhar.

## 1. Como funciona, em quatro peças

```
  sessão do Claude Code                   gancho.cjs                 ponte (serviço)
  do diretor, em qualquer   ---->   escreve UMA linha na     ---->   lê a fila,
  projeto, abre na mão              fila local e MORRE               mascara, publica
                                                                            |
                                                                            v
                                                                    base na nuvem
                                                                            |
                                                                            v
                                                                        painel
```

O gancho **não fala com a nuvem**. Não abre conexão, não carrega SDK, não sabe o que é
Firestore. Essa separação não é elegância: gancho lento atrasa o trabalho do diretor em
todos os projetos ao mesmo tempo, e foi o diretor que escreveu essa regra na OST.

Onde cada peça mora:

| Peça | Arquivo | O que faz |
| --- | --- | --- |
| O gancho | `ponte/ganchos/gancho.cjs` | chamado pelo Claude Code em oito eventos, escreve e morre |
| Instalar | `ponte/ganchos/ligar.ps1` | acrescenta as entradas em `settings.json`, com cópia antes |
| Desligar | `ponte/ganchos/desligar.ps1` | o botão de um passo, devolve o Claude Code como era |
| Medir | `ponte/ganchos/medir.mjs` e `medir-ao-vivo.mjs` | o custo, de duas formas |
| Publicar | `ponte/src/ganchos.ts` | o lado da ponte: lê a fila, traduz, publica |
| Mascarar | `ponte/src/mascara.ts` | tira o que tem forma de credencial, antes de subir |

## 2. Os oito eventos capturados, e o que falta

| Evento do Claude Code | Vira, no painel | Estado da fábrica |
| --- | --- | --- |
| `SessionStart` | nasce a fábrica | em execução |
| `UserPromptSubmit` | comando do diretor | em execução |
| `PostToolUse` | um passo, com ferramenta e alvo | em execução |
| `SubagentStart` | início de subagente | em execução |
| `SubagentStop` | fim de subagente | em execução |
| `Stop` | fim de rodada | aguardando comando |
| `SessionEnd` | fim | concluída, ou falhou quando o motivo diz |
| `Notification` | aviso | não muda |

**`PreToolUse` está de fora, e é decisão consciente, não esquecimento.** Gancho de
`PreToolUse` que devolve código 2 **bloqueia a ferramenta** no Claude Code. Um gancho de
observação não pode ter esse poder nem por acidente. O passo é capturado em `PostToolUse`,
que não bloqueia nada. Consequência boa de tabela: o gate de deploy do §A.7, que é um
gancho de `PreToolUse`, continua sozinho naquele evento e não convive com ninguém.

## 3. As seis regras duras, e onde cada uma está provada

A OST disse que estas regras "valem mais que a entrega". Então cada uma tem prova, e a
prova roda com `npm run prova:ganchos` dentro de `ponte/`.

### R1, nunca atrapalhar o trabalho do diretor

O gancho sai **sempre** com código 0 e **nunca** escreve na tela. Não existe caminho neste
arquivo que devolva outro código. Provado em nove casos de coisa dando errado, todos com
código 0, tela vazia, e a sessão seguindo:

```
  PASSOU configuracao AUSENTE: codigo 0, escreveu na tela "", linha na fila false
  PASSOU configuracao CORROMPIDA, nao e JSON: codigo 0, escreveu na tela "", linha na fila false
  PASSOU DESLIGADO pelo interruptor: codigo 0, escreveu na tela "", linha na fila false
  PASSOU projeto na lista de IGNORAR: codigo 0, escreveu na tela "", linha na fila false
  PASSOU projeto FORA da lista de ignorar: codigo 0, linha na fila true
  PASSOU carga GIGANTE, resposta de ferramenta de 5 MB: codigo 0, linha na fila true
  PASSOU entrada que NAO e JSON: codigo 0, escreveu na tela "", linha na fila false
  PASSOU entrada VAZIA: codigo 0, escreveu na tela "", linha na fila false
  PASSOU fila no TETO de tamanho: codigo 0, escreveu na tela "", linha na fila false
```

Ponte fora do ar não muda nada para o diretor, por construção: o gancho não conhece a
ponte. Ele escreve num arquivo e morre. Com a ponte morta, a fila só cresce até o teto, e
no teto o gancho passa a sair calado.

**Um defeito de verdade foi achado aqui e corrigido.** A primeira versão decidia se ia
trabalhar **antes** de ler a entrada de texto. Quando ela decidia sair, quem tinha escrito
na entrada dela levava erro de escrita encerrada. Ou seja: o caminho de "desligado", que
era justamente o caminho que não podia incomodar ninguém, era o mais capaz de incomodar. A
ordem foi invertida: **lê a entrada primeiro, decide depois.** Custa quase nada e tira do
Claude Code qualquer chance de tropeçar por causa deste gancho.

### R2, ser rápido

Resposta curta: **o trabalho do gancho custa de 2 a 7 ms por passo. O resto é o processo
do Node subindo, e esse é o piso de qualquer gancho de Claude Code nesta máquina.**

Medido de três formas, porque uma só mentiria:

**Primeira, o trabalho dele por dentro.** O gancho cronometra a si mesmo e grava o número
em cada linha da fila. Nas sessões ao vivo do diretor, inclusive na sessão em que esta OST
foi executada:

```
  custo por dentro, so PostToolUse: mediana 3.8 ms, maior 5.1 ms
```

**Segunda, o piso da máquina.** Um programa que não faz nada, só sobe e sai:

```
  node -e 0     menor 79.7  mediana 105.6  p95 128.2  maior 130.7
  vazio.cjs     menor 81.6  mediana 102.8  p95 129.4  maior 145.3
  vazio.mjs     menor 92.4  mediana 129.3  p95 224.8  maior 243.5
```

Essa tabela decidiu uma coisa do desenho: o gancho é **módulo comum** (`.cjs`), não módulo
de ECMAScript (`.mjs`). O carregador de módulo de ECMAScript custou quase 100 ms a mais no
pior caso. Para um programa chamado a cada passo, em todos os projetos, isso é muito. O
gancho também não importa `node:path` nem `node:os`: os caminhos são montados com texto.

**Terceira, o que o diretor paga de verdade.** A mesma tarefa de várias leituras, na mesma
máquina, com os ganchos **fora** do `settings.json` e depois dentro dele. Desligar aqui é
de verdade, não o interruptor leve: o interruptor leve faz o gancho sair na primeira linha,
mas o processo ainda sobe, e o processo é quase todo o custo. Medido duas vezes:

```
  três amostras por fase
  SEM ganchos: menor 13231 ms, mediana 14838 ms, maior 21542 ms
  COM ganchos: menor 14861 ms, mediana 16371 ms, maior 16945 ms
  diferenca: +1533 ms na tarefa inteira, 5 turnos, cerca de 7 chamadas de gancho

  seis amostras por fase
  SEM ganchos: mediana 14507 ms
  COM ganchos: menor 14988 ms, mediana 17054 ms, maior 18833 ms
  diferenca: +2547 ms na tarefa inteira, 5 a 6 turnos, cerca de 9 chamadas de gancho
```

As duas medidas, independentes, dão o mesmo número por chamada: **220 a 280 ms por chamada
de gancho**, dos quais 2 a 7 ms são trabalho e o resto é processo subindo. Numa tarefa
curta de 15 segundos isso é cerca de **15% a mais de tempo de parede**.

**O veredito honesto, e ele não é um "passou" redondo.** 220 a 280 ms por chamada está
dentro do piscar de olhos pela definição comum (100 a 400 ms), mas no teto dela, e está
**acima do alvo de 100 ms que eu mesmo tinha posto**. Em tarefa longa, que é o caso de uso
real do diretor, o peso relativo cai, porque o número de chamadas cresce bem mais devagar
que a duração do trabalho. O número firme é o de dentro, 2 a 7 ms; os 15% de uma tarefa de
15 segundos é o número honesto de pior caso.

**O que faria descer, e o preço, para o diretor decidir:** sair do Node. Um redirecionador
puro do interpretador de comandos custaria cerca de 15 ms, porque não sobe máquina de
JavaScript nenhuma. O preço é alto e eu não recomendo: ele não sabe ler JSON, então
perderia o encaminhamento por sessão, os tetos de fila, o interruptor, a lista de projetos
a ignorar, e, o pior, escreveria no disco a **resposta inteira de cada ferramenta**,
inclusive o conteúdo de todo arquivo lido. Isso contraria a regra 3 e a regra 5 da própria
OST. Fica registrado como opção, com o custo dito.

### R3, §A.9, só acrescentar

`ligar.ps1` grava cópia de segurança datada antes de tocar no arquivo, em
`%USERPROFILE%\.a-fabrica-ponte\copias-settings\`, e nunca sobrescreve cópia anterior.
Conferido depois de ligar, comparando a cópia de antes com o arquivo de agora:

```
  chaves antes: agentPushNotifEnabled, autoUpdatesChannel, model, permissions,
                skipDangerousModePermissionPrompt, tui
  chaves agora: agentPushNotifEnabled, autoUpdatesChannel, hooks, model, permissions,
                skipDangerousModePermissionPrompt, tui
  chaves acrescentadas: hooks
  chaves removidas: (nenhuma)
  chaves preexistentes identicas: 6 de 6
  chaves preexistentes alteradas: (nenhuma)
```

O gancho em si é instalado **fora do repositório**, em
`%USERPROFILE%\.a-fabrica-ponte\ganchos\a-fabrica-gancho.cjs`. Motivo: se o diretor mover
ou renomear a pasta do projeto, o gancho continua existindo e a sessão dele não quebra.

### R4, o botão de desligar, em um passo

```
powershell -ExecutionPolicy Bypass -File ponte\ganchos\desligar.ps1
```

Existem três níveis, e o diretor escolhe:

| Nível | Como | O que acontece |
| --- | --- | --- |
| leve | pôr `ligado: false` em `%USERPROFILE%\.a-fabrica-ponte\ganchos.json` | o gancho continua sendo chamado e sai sem fazer nada. Serve para desligar e religar na mesma tarde. **Não devolve o tempo**, porque o processo ainda sobe |
| completo | `desligar.ps1` | tira as entradas do `settings.json`. O Claude Code deixa de chamar o gancho, e o tempo volta ao que era |
| total | `desligar.ps1 -ApagarFila` | o acima, e a fila local vai para pasta de arquivo morto. Nada é apagado, §A.17 |

O `desligar.ps1` tira **só** as entradas que apontam para `a-fabrica-gancho`. Gancho que o
diretor tenha por conta própria passa intacto. Se o bloco de ganchos ficar vazio, ele sai
inteiro, e o arquivo volta a não ter bloco de ganchos nenhum, que é exatamente como estava
antes da Fábrica.

Detalhe que importa e que está escrito na tela do script: sessão que já estava aberta
continua com o gancho carregado até ser fechada, porque o Claude Code lê a configuração na
abertura. O interruptor leve, que o `desligar.ps1` aciona primeiro, já cobre isso: nessas
sessões o gancho é chamado e sai sem fazer nada.

### R5, nada de segredo na base

A ponte mascara antes de publicar, nunca o gancho, porque mascarar custa tempo e o gancho
tem de ser rápido. Treze formas de credencial, uma prova por forma:

```
  PASSOU chave de API do Google: curl "https://x.googleapis.com/v1/y?key=[credencial mascarada]"
  PASSOU token de identificacao em tres partes: authorization: [credencial mascarada]
  PASSOU token de atualizacao do Firebase: node entrar.js [credencial mascarada]
  PASSOU token de acesso do Google: Authorization: Bearer [credencial mascarada]
  PASSOU token de atualizacao com barra dupla: refresh_token=[credencial mascarada]
  PASSOU segredo de cliente do Google: client_secret: [credencial mascarada]
  PASSOU chave da plataforma do GitHub: https://[credencial mascarada]@github.com/x/y
  PASSOU chave de modelo da Anthropic: export ANTHROPIC_API_KEY=[credencial mascarada]
  PASSOU chave de acesso da Amazon: aws configure set aws_access_key_id [credencial mascarada]
  PASSOU token do Slack: SLACK=[credencial mascarada]
  PASSOU senha em atribuicao: psql --dbname x password=[credencial mascarada]
  PASSOU senha por bandeira curta: mysql -u root -p [credencial mascarada]
  PASSOU bloco de chave privada: [credencial mascarada]
```

E seis casos de texto comum que a máscara **não pode estragar**, porque falso positivo
também é defeito, todos passando intactos: comando comum, caminho de arquivo, mensagem de
commit, frase do diretor, endereço do painel, e a palavra token numa frase sem valor
nenhum ao lado.

**O que a máscara NÃO promete, dito antes de alguém achar que promete.** Máscara por forma
de texto não é garantia. Segredo sem forma reconhecível passa. A defesa que não depende de
reconhecer forma é outra, e é a que vale de verdade:

1. o gancho **não guarda a resposta das ferramentas**, que é onde mora quase todo conteúdo
   de arquivo lido, logo quase todo segredo de repositório. Da resposta sai só se deu erro;
2. a base só é legível pela conta do diretor, e a regra nega todo o resto;
3. a trilha não se apaga, então o que sobe fica, e é por isso que o que sobe tem de ser
   pouco.

### R6, lista de projetos a ignorar

Em `%USERPROFILE%\.a-fabrica-ponte\ganchos.json`, campo `projetosIgnorados`. **Começa
vazia**, como a OST mandou. A comparação é pelo começo do caminho da pasta, sem diferenciar
maiúscula de minúscula, porque o diretor pensa em pasta de projeto e não em caminho exato.

Para deixar uma frente de fora:

```
powershell -ExecutionPolicy Bypass -File ponte\ganchos\ligar.ps1 -Ignorar "C:\Users\Henrique\Desktop\centrafin-app"
```

Provado nos dois sentidos: projeto na lista não deixa linha na fila; projeto fora da lista,
com a lista cheia, deixa.

## 4. A prova ao vivo que a OST pediu

**Uma sessão aberta na mão, aparecendo sozinha.** Duas, na verdade, abertas ao mesmo tempo,
em dois projetos de teste diferentes, com a saída real:

```
=== sessao 73a90637 ===
01:58:49.035 | SessionStart      | -      |  95.0ms | -
01:58:51.213 | UserPromptSubmit  | -      | 575.7ms | Liste os arquivos desta pasta com o comando ls
01:58:57.078 | PostToolUse       | Bash   |   3.6ms | ls
01:58:58.656 | Stop              | -      |   3.3ms | -
01:58:58.926 | SessionEnd        | -      |   4.2ms | other
projeto: ...\2026-10-13T2257-ost7-bloco1-ao-vivo\projeto-de-teste-dois

=== sessao 74addf3a ===
01:58:49.755 | SessionStart      | -      |   7.1ms | -
01:58:51.044 | UserPromptSubmit  | -      |   4.6ms | Leia o arquivo leia.txt desta pasta
01:58:54.568 | PostToolUse       | Read   |   4.0ms | ...\projeto-de-teste-um\leia.txt
01:58:56.123 | Stop              | -      |   2.8ms | -
01:58:56.505 | SessionEnd        | -      |   4.8ms | other
projeto: ...\2026-10-13T2257-ost7-bloco1-ao-vivo\projeto-de-teste-um
```

As duas ao mesmo tempo: os dois `SessionStart` estão a 720 ms um do outro, cada sessão com
o seu arquivo de fila e o seu projeto. Nenhuma embaralhou com a outra.

Aquele 575.7 ms solitário é o primeiro `UserPromptSubmit` de uma sessão nova: é a primeira
escrita num arquivo que ainda não existe, com o cache do disco frio. Acontece uma vez por
sessão e está dito aqui em vez de ser escondido na mediana.

**Início e fim de subagente, que a OST pede por nome.** Uma terceira sessão delegou a um
subagente, e o ciclo inteiro dele apareceu, inclusive os passos que ele deu por dentro:

```
02:11:29.488 | SessionStart      | -      |  2.9ms | -
02:11:30.083 | UserPromptSubmit  | -      |  2.2ms | Use a ferramenta Task para delegar a um subag
02:11:36.033 | SubagentStart     | -      |  1.8ms | [sub: general-purpose]
02:11:39.375 | PostToolUse       | Read   |  1.4ms | [sub: general-purpose] ...\a.txt
02:11:40.216 | PostToolUse       | Read   |  2.1ms | [sub: general-purpose] ...\b.txt
02:11:43.380 | SubagentStop      | -      |  1.2ms | [sub: general-purpose]
02:11:43.531 | PostToolUse       | Agent  |  1.2ms | Read a.txt and b.txt
02:11:45.315 | Stop              | -      |  1.4ms | -
02:11:45.489 | SessionEnd        | -      |  1.8ms | other
```

O nome do subagente vem capturado, e os dois passos de leitura que ele deu ficam entre o
início e o fim dele. O painel consegue mostrar trabalho de subagente aninhado sem adivinhar
nada.

**A quarta sessão, a que mais vale.** A sessão em que esta própria OST foi executada,
no projeto `C:\Users\Henrique\a-fabrica`, também foi capturada, e ela tinha começado
**antes** dos ganchos serem instalados. Ou seja: o Claude Code pegou a configuração nova
sem reiniciar. Dez passos capturados, custo por dentro de 2.2 a 5.1 ms, e o trabalho
seguiu sem nada travar, atrasar ou quebrar.

**Com a ponte fora do ar.** Todas as provas acima foram feitas com a **ponte parada**,
porque ela ainda não tem sessão na base real. Logo, a prova de que uma ponte morta não
atrapalha a sessão do diretor está feita, e por acidente feliz ela é a prova mais forte
possível: não é que a ponte caiu no meio, é que ela nunca subiu, e as sessões funcionaram
igual.

## 4b. Um furo achado por acidente, e fechado

Enquanto esta prova rodava, outra prova rodava na mesma máquina, e as duas tinham
publicador ligado **sobre a mesma fila**. O resultado foi uma prova mentindo: ela publicou
de verdade, a contagem dela deu zero, e os passos apareceram na base pela mão do outro
processo. Levei um tempo convencido de que havia defeito na contagem, até perceber que
havia dois publicadores.

Ninguém perdeu passo, porque a marca de leitura é por arquivo e em bytes. Mas dois
publicadores sobre a mesma marca **podem publicar o mesmo passo duas vezes**, e a trilha
não se apaga, §A.6. E isso não é caso de laboratório: na máquina do diretor a ponte sobe
por tarefa agendada, e nada impede ele de rodar uma segunda à mão.

Fechado: o publicador agora toma uma **trava de processo único** da fila antes de começar.
Quem não conseguir a trava não publica nada e diz por quê, em vez de publicar em dobro em
silêncio. Trava de processo morto não prende a fila, mesma técnica da trava por fábrica que
já existia.

A primeira versão da trava protegia contra OUTRO processo e deixava passar o caso de dois
publicadores no MESMO processo, porque a trava em arquivo guarda o identificador do dono e
não barra o próprio. Isso é proposital, para trava velha de processo morto poder ser
retomada, mas deixava um furo. A prova cobrou na hora, e agora são duas trancas juntas: um
sinalizador dentro do processo e a trava em arquivo entre processos.

A conferência também teve de ser refeita duas vezes, e as duas por honestidade. A primeira
versão dizia que o segundo publicador não publicava, mas a fila estava vazia naquele
instante: zero por falta de dado, não por trava. Agora a prova abre uma sessão nova de
propósito, para a fila ter o que publicar. A segunda versão conferia o retorno da chamada
do dono, e dava zero por motivo certo, porque o dono tem relógio próprio e já tinha
publicado sozinho. Agora ela confere o EFEITO: os passos da sessão nova na base.

Saída real:

```
  [dois] fila de ganchos: OUTRO processo da ponte ja e o dono desta fila nesta maquina,
         entao este nao publica nada. Isso evita o mesmo passo subir duas vezes.
  PASSOU o primeiro publicador e o dono da fila, o segundo sai calado:
         primeiro ativo true, segundo ativo false
  PASSOU o segundo nao publica NEM com a fila cheia e mandado publicar na mao
  PASSOU o DONO da fila publicou a sessao nova, enquanto o segundo nao publicou nada
  PASSOU quando o dono para, a fila volta a aceitar dono
```

## 4c. A prova de ponta a ponta, com a base no emulador

Isto fecha o único pedaço que as provas anteriores não cobriam: a ponte lendo a fila de
verdade e **publicando**, com sessões do Claude Code abertas na mão.

O que é de verdade aqui, sem maquiar: a sessão do Claude Code, o gancho, a fila local (a
mesma pasta que as sessões do diretor usam) e o publicador (o mesmo código que o serviço
roda). O que **não** é a base real: a base é o emulador, com as mesmas regras que estão
publicadas na nuvem. O rótulo é esse e não outro.

**Correção de rota que preciso registrar:** eu disse antes, aqui e aos agentes, que o
emulador não subia por causa da credencial vencida do Firebase CLI. **Estava errado.** O
que matou a minha primeira tentativa foi o meu próprio tempo limite no comando, que
encerrou o emulador com código 143. `emulators:start` não pede login; só `projects:list`
pede. A afirmação errada atrasou o trabalho e foi desfeita assim que medi em vez de supor.

```
PARTE 1, duas sessoes do Claude Code abertas na mao AO MESMO TEMPO
  PASSOU as duas sessoes do diretor terminaram normalmente: codigos 0 e 0, com a
         ponte NAO rodando como servico
  PASSOU as duas se anunciaram na fila, cada uma no seu arquivo: 2 arquivo(s) novo(s)

PARTE 2, o publicador da ponte lendo a fila e publicando na base
  PASSOU a varredura publicou sem erro
  PASSOU a fabrica mao-4831b8d9 chegou na base com a sessao inteira: estado concluida,
         projeto ...\projeto-um, 6 passo(s): init, comando do diretor, ferramenta,
         ferramenta, fim de rodada, fim
  PASSOU a fabrica mao-633a981a chegou na base com a sessao inteira: estado concluida,
         projeto ...\projeto-dois, 8 passo(s)

PARTE 3, segunda varredura: nada pode subir de novo
  PASSOU a marca de leitura impede republicar: segunda varredura publicou 0 passo(s)

PARTE 4, arquivo de sessao encerrada arquivado, nunca apagado, §A.17
  PASSOU as duas sessoes encerradas foram movidas para a pasta de consumidas
  PASSOU elas sairam da fila ativa

PARTE 6, publicador MORTO com sessao do diretor acontecendo
  PASSOU com NENHUM publicador no ar, a sessao do diretor terminou normalmente: codigo 0
  PASSOU o que ela fez ficou guardado na fila, esperando a ponte voltar
  PASSOU quando a ponte voltou, ela publicou o que estava guardado, nada perdido
```

A parte 6 é a prova que a OST pede por nome: **a ponte fora do ar e a sessão do diretor
seguindo normal**, e mais do que isso, nada perdido quando ela volta.

**A parte 5, que passou por vácuo e eu não vou contar como prova.** Ela pedia uma sessão
que carregasse algo com cara de credencial no comando, para ver a máscara agindo no caminho
de verdade. A sessão não executou o comando pedido (o Claude Code resolveu a tarefa de
outro jeito, listando a pasta), então não havia credencial nenhuma para vazar, e a
conferência passou sem conferir nada. Prova que passa por falta de dado não é prova. A
máscara continua provada nas treze formas da parte 5 da seção 3, que são conferência de
texto de verdade, e o caminho dela dentro do publicador está provado na parte 2 da prova
de regras duras. O que falta é só o caso de ponta a ponta, e ele vale a pena refazer com
um comando que a sessão não consiga contornar.

## 5. O que ficou faltando, e por quê

1. **A sessão aberta na mão aparecendo no painel contra a BASE REAL.** O caminho inteiro
   está pronto e provado contra o emulador, de ponta a ponta. O que falta é a base real, e
   ela depende da ponte ter sessão do diretor, que é um clique dele no navegador.
2. **O caso de ponta a ponta da máscara**, pelo motivo dito na seção 4c.

O primeiro destrava com o clique, e depois dele são minutos.

## 6. Onde está cada evidência

| O que | Onde |
| --- | --- |
| Duas sessões ao vivo, fila e custo | `a-fabrica-lab\rodadas\2026-10-13T2257-ost7-bloco1-ao-vivo` |
| Diferença no `settings.json` | mesma pasta, `01-diferenca-settings.txt` |
| Prova do gate de deploy, 19 casos | mesma pasta, `03-prova-do-gate.txt` |
| Regras duras, 40 casos | `a-fabrica-lab\rodadas\2026-10-13T2256-ost7-prova-ganchos` |
| Medida do gancho sozinho | `a-fabrica-lab\rodadas\...-ost7-medida-do-gancho` |
| Medida com e sem ganchos | `a-fabrica-lab\rodadas\...-ost7-medida-ao-vivo` |
| Cópias do `settings.json` | `%USERPROFILE%\.a-fabrica-ponte\copias-settings\` |
