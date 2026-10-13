# OST 6, Bloco 1, lado da base na nuvem

Agente responsavel: backend (peca 2, Firestore, regras, indices, prontidao do login).
Nao mexeu em `ponte/**`, `painel/**`, `firebase.json` da raiz, `.firebaserc`, `CLAUDE.md`,
`DIARIO.md` nem `TASKS.md`. Nao publicou nada: quem publica e o coordenador, com a flag
do gate, §A.7. Todo comando de gcloud e de firebase foi dado com `--project a-fabrica-soulan`
explicito, §A.20.

Pasta de evidencia desta rodada, §A.17, nada sobrescrito e nada apagado:
`firebase/testes/rodada-2026-10-13-091905/`.

## 1. O que foi solicitado

1. Provar, com saida real, o que esta de fato na nuvem hoje: a regra publicada, baixada e
   comparada linha a linha com o arquivo local, e os indices compostos que existem de fato.
2. Escrever e rodar um verificador de prontidao do login, que falhe fechado e diga ao
   diretor o passo exato do console.
3. Auditar as regras contra a nova realidade, a ponte entrando autenticada como o proprio
   diretor pelo SDK cliente e o painel entrando como o diretor pelo navegador, item por
   item, com prova no emulador.
4. Estender os testes, rodar tudo e preservar a evidencia em pasta nova com data e hora.

## 2. O que foi feito

### 2.1 Estado real da nuvem, provado, nao assumido

A regra publicada foi baixada pela API de regras do Firebase com o token do gcloud.
Existe uma unica publicacao, `projects/a-fabrica-soulan/releases/cloud.firestore`,
apontando para o conjunto `rulesets/f57036e6-6929-41b3-a5a6-81f6d2436ef8`, criado em
2026-10-13T01:46:55Z e atualizado em 2026-10-13T02:18:45Z. Arquivos baixados:
`nuvem-releases.json`, `nuvem-ruleset.json`, `nuvem-firestore.rules`.

Comparacao linha a linha com `firebase/firestore.rules` como estava antes desta OST:
a unica diferenca era o comentario de cabecalho. O corpo das regras, da linha
`service cloud.firestore` em diante, estava identico. Ou seja, a afirmacao do comentario
"IMPLANTADAS na OST 5" era verdadeira no conteudo que importa, mas o arquivo local
carregava um cabecalho mais novo que o publicado. A prova esta em `diferenca-regras.txt`,
e o trecho e so este:

```
-// Regras do Firestore da Fabrica.
-// IMPLANTADAS no projeto a-fabrica-soulan na OST 5 ...
+// Regras do Firestore da Fabrica (OST 3, Parte 2, Passo 2).
+// RASCUNHO para revisao do diretor e da seguranca. Ainda NAO implantado ...
```

Indices compostos que existem de fato no banco, por
`gcloud firestore indexes composite list --project a-fabrica-soulan`, em
`nuvem-indices.json`: exatamente dois, os dois declarados em
`firebase/firestore.indexes.json` antes desta OST, ambos no estado READY.

| Colecao | Campos | Estado |
| --- | --- | --- |
| comandos | maquinaId asc, situacao asc, criadoEm asc | READY |
| aprovacoes | maquinaId asc, situacao asc, criadoEm asc | READY |

Nao havia divergencia de indice entre o arquivo e o banco.

Cobertura de indice provada contra o banco de verdade, em
`nuvem-indices-prova-completa.txt`, por consulta de leitura via REST com o token do
gcloud, sem nenhuma escrita. O Firestore recusa com FAILED_PRECONDITION quando falta
indice, mesmo com a colecao vazia, entao a prova vale com o banco ainda sem dados.
Nove consultas, as nove que ponte e painel fazem de verdade:

| Consulta | Resultado hoje |
| --- | --- |
| A, aprovacoes maquinaId e situacao, sem ordenacao (ponte) | passa |
| B, aprovacoes situacao pendente ordenado por criadoEm (fila do painel) | FALTA INDICE |
| C, fabricas ordenado por atualizadoEm (visao geral) | passa |
| D, fabricas maquinaId ordenado por atualizadoEm | FALTA INDICE |
| E, comandos maquinaId e situacao, sem ordenacao (ouvinte da ponte) | passa |
| F, comandos fabricaId ordenado por criadoEm (tela da fabrica) | FALTA INDICE |
| G, atividade de uma fabrica ordenada por seq | passa |
| H, aprovacoes maquinaId e situacao ordenado por criadoEm | passa |
| I, fabricas maquinaId e estado, sem ordenacao (reconciliacao da ponte) | passa |

Descoberta util: duas igualdades sem ordenacao nao exigem indice composto neste banco,
provado em I, que nao tem indice nenhum cobrindo a combinacao e passa. O que exige indice
e igualdade mais ordenacao por outro campo.

### 2.2 Prontidao do login

Novo verificador: `firebase/testes/verificar-login.mjs`. Faz quatro verificacoes, duas
pelo lado administrativo e uma pela mesma porta que o painel e a ponte usam:

1. token de acesso do gcloud para o projeto;
2. configuracao de identidade do projeto existe, `admin/v2/projects/{projeto}/config`;
3. provedor `google.com` presente e habilitado, `defaultSupportedIdpConfigs`;
4. dominios autorizados do login, pela porta do cliente, com a chave web obtida em tempo
   de execucao por `firebase apps:sdkconfig web --project a-fabrica-soulan`, nunca do
   repositorio, §A.6.

Falha fechada de verdade, nao de papel: sem token, nada e verificado e o veredito e NAO
PRONTO; erro de rede, resposta malformada ou tempo esgotado em 20 segundos tambem dao NAO
PRONTO. Codigo de saida 1 em qualquer caso que nao seja tudo OK. Isso foi provado rodando
o verificador com o gcloud fora do caminho, saida em
`saida-verificar-login-falha-fechada.txt`, codigo de saida 1.

Saida real de hoje, `saida-verificar-login.txt`:

```
=== PRONTIDAO DO LOGIN, projeto a-fabrica-soulan ===
  OK   token do gcloud: token de acesso obtido na maquina, nada gravado
  NAO  Authentication ligado: a API de identidade responde CONFIGURATION_NOT_FOUND, HTTP 404, o Authentication nunca foi inicializado neste projeto
  NAO  provedor Google ativo: nao ha lista de provedores porque o Authentication nao esta ligado, HTTP 404
  NAO  dominios autorizados do login: a porta do cliente responde CONFIGURATION_NOT_FOUND, HTTP 400, o login do painel e da ponte ainda nao funciona

VEREDITO: LOGIN NAO PRONTO. 3 de 4 verificacoes falharam. Nenhum teste ao vivo com login deve rodar agora.
```

Confirmado pelos dois lados: o lado administrativo responde 404 CONFIGURATION_NOT_FOUND e
o lado do cliente, com a chave web de verdade, responde 400 CONFIGURATION_NOT_FOUND. Nao
e falta de permissao, e ausencia de configuracao. O caminho e o clique do diretor.

### 2.3 Revisao das regras contra a nova realidade

As regras foram endurecidas em `firebase/firestore.rules`. O que mudou, e por que:

1. Hora do servidor obrigatoria na trilha. Toda hora de trilha tem de ser escrita com
   `serverTimestamp()`, porque a regra exige `== request.time`. Vale para
   `maquinas.vistoPorUltimo`, `fabricas.atualizadoEm`, `atividade.em`,
   `comandos.criadoEm`, `comandos.entregueEm`, `aprovacoes.criadoEm`,
   `aprovacoes.respondidoEm` e `relatorios.criadoEm`. Antes, um cliente podia gravar
   qualquer hora, inclusive hora passada, e a trilha mentiria. Isso tambem protege o
   indicador de ponte offline do §A.10: nao existe heartbeat com hora inventada.
2. Origem da resposta obrigatoria. Responder uma aprovacao exige `respondidoPor`
   preenchido. §A.6 pede hora e origem em toda aprovacao; a criacao ja exigia `origem`, a
   resposta nao exigia nada. A ponte de verdade ja grava `respondidoPor` na reconciliacao,
   entao isso nao quebra a ponte, e passa a ser requisito do painel.
3. Nada se apaga. `delete` negado tambem em `maquinas`, `fabricas` e
   `fabricas/{id}/tarefas`, nao so em comando e aprovacao. Fabrica encerrada vira estado
   `concluida`, nao desaparece, senao a atividade e os relatorios ficariam orfaos e a
   trilha perderia o registro do trabalho.
4. Comando nasce limpo. Criar comando exige `situacao: pendente`, proibe `entregueEm`
   preenchido no nascimento e exige `fabricaId`, `maquinaId`, `texto` e `origem` como texto
   nao vazio. Antes era possivel criar um comando ja marcado como entregue, o que e trilha
   falsa.
5. Aprovacao nasce sem resposta. Criar pedido proibe `resposta`, `respondidoEm` e
   `respondidoPor` preenchidos e exige `situacao: pendente`. Isso e o "nao existe
   pre-autorizacao" do §A.6 escrito na regra.
6. Estado de ponte restrito a `online` ou `offline`.

O que nao mudou: a funcao `diretor()`, conta unica com e-mail verificado, e o `nega tudo`
final. A verificacao de segundo fator continua sendo da camada de Auth, nao daqui.

A regra nova foi validada contra o servico de verdade, sem publicar, pela API
`projects/a-fabrica-soulan:test`. Resposta `{}`, ou seja, nenhum problema de compilacao,
em `nuvem-validacao-regras-novas.json`. Para a resposta vazia nao ser lida como engano,
foi feito um controle negativo: a mesma regra com um erro de proposito volta com
`issues` e `severity: ERROR`, em `nuvem-validacao-controle-negativo.json`. O validador
funciona, logo o `{}` significa regra sa.

### 2.4 Veredito item por item do ponto 3

Dois conjuntos de prova no emulador. `regras.test.mjs`, 76 de 76, com a matriz de
identidade e as transicoes de estado. `ponte-real.test.mjs`, 35 de 35, que importa
`ponte/src/base.ts`, o arquivo de verdade da ponte, sem copiar e sem alterar, e entra com
login de verdade no emulador de Auth, com o e-mail do diretor e e-mail verificado, como o
provedor Google entrega na nuvem.

**A conta unica continua sendo a unica que le e escreve? Sim.** Negados: outro e-mail
verificado, e-mail do diretor com `email_verified` falso, token autenticado sem e-mail,
anonimo, e-mail parecido com o do diretor terminando em outro dominio, e o e-mail do
diretor em maiusculas. Negados em todas as colecoes do modelo, leitura e escrita, e
tambem em consulta de lista. Casos 1.1 a 1.17 e 7.5 e 7.6 de `saida-regras.txt`, mais
6.1 a 6.6 de `saida-ponte-real.txt`, onde a conta invasora usa o codigo real da ponte e e
barrada em tudo.

Observacao honesta e obrigatoria, sem vender protecao que nao existe: sob conta unica nao
existe isolamento entre pessoas, porque so existe uma pessoa. `maquinaId` e escopo logico,
nao fronteira de seguranca. Quem tiver a conta do diretor alcanca a fila de qualquer
maquina. A regra garante que o documento sempre carrega `maquinaId` e que ele nao muda
depois de criado, o que mantem o escopo honesto, mas nao finge que separa identidades. A
protecao dura e a conta unica com segundo fator, mais o nega tudo, mais a trilha que nao
se apaga e com hora do servidor. Para separar de verdade a ponte do painel seria preciso
uma credencial propria da ponte com reivindicacao de maquina, o que hoje exigiria chave de
servico, vetada nesta OST.

**A trilha continua imutavel? Sim, e mais do que antes.** Comando nao se apaga, nao volta
de entregue para pendente, nao tem `criadoEm`, `texto`, `origem`, `fabricaId` nem
`maquinaId` alterados, e so pode ser marcado entregue uma vez. Aprovacao nao se apaga, nao
tem o pacote reescrito junto da resposta, e depois de respondida congela. Atividade so
adiciona, nao altera e nao apaga. Relatorio nasce e nao muda. Casos 2.1 a 2.13, 3.1 a
3.14, 4.9 a 4.12 e 5.1 a 5.5.

**A escrita que a ponte de verdade faz passa? Sim, as sete.** Provado com o arquivo real:
heartbeat em `maquinas` com setDoc merge, incluindo a parada limpa que marca offline e poe
a fabrica viva em `ponte offline`; `fabricas` com setDoc merge nas quatro formas que
`ponte.ts` usa; atividade com addDoc; pedido de aprovacao com setDoc e o pacote completo;
marcacao de comando entregue em transacao, com idempotencia provada, a segunda tomada
devolve nulo; reconciliacao no reinicio, que recusa o pendente de sessao morta e marca a
fabrica como `ponte offline`; e a contagem de pendentes. Nenhuma dessas escritas e barrada
pela regra. Casos 1.1 a 1.8, 2.5 a 2.7 e 4.1 a 4.3 de `saida-ponte-real.txt`.

Aviso de realidade: a ponte deixou de ser `.mjs` e virou TypeScript durante esta OST. O
arquivo real auditado e provado e `ponte/src/base.ts`. Os `.mjs` antigos foram movidos
pelo agente da ponte para `ponte/legado-mjs/`. A auditoria foi refeita sobre o arquivo
novo, inclusive as duas escritas que nao existiam no `.mjs`: a fabrica virar
`ponte offline` na parada limpa e o `respondidoPor` na reconciliacao.

**A escrita que o painel de verdade vai fazer passa? Sim, com dois requisitos novos.**
Criar comando pendente passa e responder aprovacao passa, uma vez so; a segunda resposta e
barrada, provado tanto no emulador puro quanto com cliente de verdade. Os dois requisitos
que o painel tem de cumprir: `criadoEm` do comando e `respondidoEm` da resposta tem de ser
`serverTimestamp()`, e a resposta tem de trazer `respondidoPor`. Hoje o painel ainda nao
escreve nada, so le, entao o requisito chega antes do codigo. Casos 2.1 a 2.11.

**A leitura ao vivo que o painel precisa passa, e passa com os indices que existem?
Passa na regra; nos indices, duas das tres passavam e uma nao.** Os tres ouvintes
funcionam na regra e no emulador, casos 5.1 a 5.3. Contra o banco de verdade: ouvinte de
`fabricas` ordenado por `atualizadoEm` passa, consulta C; ouvinte de `atividade` de uma
fabrica ordenado por `seq` passa, consulta G; fila de `aprovacoes` filtrada por
`situacao: pendente` e ordenada por `criadoEm` NAO passava, consulta B,
FAILED_PRECONDITION. Corrigido: `firebase/firestore.indexes.json` agora declara
`aprovacoes (situacao, criadoEm)` nas duas direcoes, para a fila poder ser lida do mais
antigo, que e quem espera ha mais tempo, ou do mais recente. Falta publicar, e quem
publica e o coordenador.

**O modelo do §A.4 e do contrato esta coberto? Sim, as sete colecoes.** `maquinas`,
`fabricas`, `fabricas/{id}/tarefas`, `fabricas/{id}/atividade`, `comandos`, `aprovacoes` e
`relatorios`, cada uma com dono de escrita, trilha e delete negado conforme o contrato.
`relatorios` e `tarefas` tem regra de acesso e de trilha provadas, casos 4.13 a 4.15 e 5.1
a 5.5, mas sem validacao de formato, porque ainda nao existe quem escreva nelas e eu nao
vou travar o formato na cara do agente da ponte no meio da OST. Qualquer colecao fora do
modelo e negada, inclusive subcolecao desconhecida dentro de `fabricas` e uma colecao de
usuarios ou perfis, que nao existe neste sistema, casos 6.1 a 6.4.

## 3. O que ficou faltando

1. O clique do diretor no console para ligar o Authentication e o provedor Google. Sem
   isso nao existe teste ao vivo com login, e o verificador continua dizendo NAO PRONTO.
2. Publicar a regra nova e os indices novos. Esta pronto no repositorio, nao foi publicado
   de proposito. Quem publica e o coordenador, com a flag do gate, §A.7.
3. Dois indices propostos, nao decididos, em `docs/ost6-base-indices-propostos.json`:
   `comandos (fabricaId, criadoEm)` para a tela da fabrica e
   `fabricas (maquinaId, atualizadoEm desc)` para a visao geral filtrada por maquina. As
   duas consultas falham hoje, provado em D e F, mas nao estavam entre os tres ouvintes
   que a OST pediu, entao sao proposta e nao obra, §A.12.
4. Validacao de formato de `tarefas` e de `relatorios`, quando existir quem escreva nelas.
5. Prova ao vivo na nuvem, que depende do item 1.

## 4. Decisoes tomadas durante a execucao

1. Provar a nuvem por API, nao por comentario. A regra publicada foi baixada e comparada,
   e os indices foram listados do banco. Comentario de arquivo nao e prova.
2. Provar cobertura de indice com consulta de leitura real no banco de producao, em vez de
   raciocinar sobre a documentacao. Leitura nao escreve nada e o Firestore recusa por falta
   de indice mesmo com a colecao vazia, entao a prova e honesta e sem risco.
3. Exigir hora do servidor na trilha. Foi a decisao mais invasiva, e e a que transforma a
   trilha de "registro que o cliente diz" em "registro que o servidor assina". Nenhuma
   escrita real da ponte quebrou, porque a ponte ja usava `serverTimestamp()` em todas.
4. Exigir `respondidoPor` na resposta, e nao exigir no nascimento do pedido. A ponte ja
   grava, o painel passa a ter de gravar. Preferi exigir agora, antes de o painel escrever
   a primeira linha, do que descobrir depois que a trilha nao diz quem respondeu.
5. Negar delete em `maquinas`, `fabricas` e `tarefas`. Nenhum codigo apaga nada hoje e
   nenhuma funcionalidade pede apagar; falha fechada e o certo, e liberar depois e barato.
6. Testar com o arquivo real da ponte, nao com uma copia. Isso custou dois arquivos de
   resolucao de modulo em `firebase/testes`, porque a ponte e TypeScript e importa os
   vizinhos com extensao `.js`, e porque o teste e a ponte precisam da mesma copia do SDK.
   Em troca, se a ponte mudar uma escrita e a regra barrar, o teste acusa no mesmo dia.
   Nenhuma linha da ponte foi alterada.
7. Rodar o emulador com o projeto de verdade, `a-fabrica-soulan`, e nao com um projeto
   `demo-`. O emulador aplica a regra carregada ao projeto com que foi iniciado; com outro
   identificador o teste poderia passar sem a regra valer. Nao ha risco de escrever na
   nuvem, porque o emulador e local.
8. Nao cobrir `initBase` da ponte neste teste. Ele depende da identidade do diretor gravada
   na maquina, que e dono do agente da ponte e do verificador de login. O teste monta a
   propria sessao para poder exercitar as escritas contra a regra, e isso esta dito no
   cabecalho do arquivo, para ninguem achar que o login da ponte foi provado aqui.

## 5. Arquivos e areas alteradas

Alterados:
- `firebase/firestore.rules`, endurecimento descrito em 2.3, mais cabecalho com o estado
  real conferido contra a nuvem.
- `firebase/firestore.indexes.json`, dois indices novos de `aprovacoes (situacao, criadoEm)`.
- `firebase/firebase.json`, portas do emulador fixadas em 8080 e 9099, as mesmas que a
  ponte usa, para a rodada ser deterministica. Este e o `firebase.json` de dentro de
  `firebase/`, nao o da raiz.
- `firebase/testes/regras.test.mjs`, de 12 para 76 casos.
- `firebase/testes/README.md`, como rodar os tres verificadores e onde fica a evidencia.

Criados:
- `firebase/testes/verificar-login.mjs`, prontidao do login, falha fechada.
- `firebase/testes/ponte-real.test.mjs`, escrita real da ponte e do painel contra a regra.
- `firebase/testes/ganchos-resolucao.mjs` e `firebase/testes/registrar-resolucao.mjs`,
  resolucao de modulo so para o teste.
- `firebase/testes/package.json`, dependencias dos testes, SDK na mesma versao maior da
  ponte.
- `firebase/testes/rodada-2026-10-13-091905/`, evidencia desta rodada, onze arquivos.
- `docs/ost6-base-indices-propostos.json`, proposta de dois indices.
- `docs/ost6-base.md`, este relatorio.

Preservados, nada apagado, §A.17: `firebase/testes/resultado-regras.txt`, o resultado 12
de 12 da OST 5, continua como estava.

Nao tocados: `ponte/**` (apenas lido), `painel/**` (apenas lido), `firebase.json` da raiz,
`.firebaserc`, `CLAUDE.md`, `DIARIO.md`, `TASKS.md`.

## 6. Problemas encontrados

1. O Authentication do projeto nunca foi inicializado. Confirmado pelos dois lados, 404 no
   lado administrativo e 400 no lado do cliente, os dois com CONFIGURATION_NOT_FOUND.
   Inicializar por programa e recusado com BILLING_NOT_ENABLED, porque a API administrativa
   do Identity Platform exige plano pago. O caminho e o clique do diretor no console, no
   plano gratuito. Nao foi feita nenhuma tentativa de contornar, nem de ligar plano pago,
   nem de criar chave de servico, nem de criar usuario de e-mail e senha.
2. A API de regras e a de Firestore exigem projeto de cota no cabecalho quando o token vem
   do gcloud do usuario. Resolvido com `x-goog-user-project: a-fabrica-soulan`, sem mexer
   em nenhuma configuracao da maquina e sem `gcloud config set project`, §A.20.
3. A ponte virou TypeScript no meio desta OST, e `ponte/src/base.mjs` deixou de existir. O
   teste foi refeito sobre `ponte/src/base.ts` e passou a cobrir as duas escritas novas.
4. Uma consulta de leitura do painel nao tinha indice, a fila de aprovacoes pendentes
   ordenada por hora. Indice declarado, falta publicar.
5. O primeiro heartbeat lido logo depois de escrito vinha com a hora ainda nula, porque o
   SDK so preenche a hora do servidor quando o servidor confirma. O teste passou a esperar
   a confirmacao, com limite de dez segundos, em vez de dormir um tempo fixo.

## 7. Proximo passo recomendado

1. Diretor: ligar o Authentication e o provedor Google no console, passo pronto em 8.
2. Coordenador: publicar regra e indices com a flag do gate, e rodar os tres verificadores
   depois, para a evidencia ficar com a nuvem ja atualizada.
3. Coordenador: decidir sobre os dois indices propostos, com o agente do painel, antes de a
   tela da fabrica listar comandos.
4. Agente do painel: ao escrever comando e resposta de aprovacao, usar `serverTimestamp()`
   em `criadoEm` e `respondidoEm`, e sempre mandar `respondidoPor`. Sem isso a escrita e
   negada, de proposito.
5. Com o login ligado, rodar a prova ao vivo na nuvem, a mesma bateria apontada para o
   projeto, e nao para o emulador.

## 8. O que depende do diretor, com o passo pronto

Ligar o login, uma vez, no console. O proprio verificador imprime isto:

```
  1. Abrir https://console.firebase.google.com/project/a-fabrica-soulan/authentication
  2. Clicar em "Get started", ou "Vamos comecar", na tela do Authentication.
  3. Na aba "Sign-in method", ou "Metodo de login", escolher o provedor Google.
  4. Ligar a chave "Enable", ou "Ativar".
  5. Em "Project support email", ou "E-mail de suporte do projeto", escolher
     henrique.vieira@soulan.com.br.
  6. Salvar.
  7. Rodar o verificador de novo: node verificar-login.mjs
```

Depois disso, recomendado no mesmo console, e nao e bloqueio para esta OST: exigir segundo
fator na conta Google do diretor, porque o §A.6 pede dois fatores e isso vive na conta, nao
nas regras do Firestore.

Decisao de aprovacao que cabe ao diretor, nao a fabrica: os dois indices propostos em
`docs/ost6-base-indices-propostos.json`.
