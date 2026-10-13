# OST 6, auditoria final de seguranca

Agente responsavel: **seguranca** (poder de veto, §A.15). Nao implementei, nao corrigi e nao
alterei arquivo nenhum fora deste documento. Revisei codigo, repositorio, historico dos dois
commits da OST (`688ed2b` e `7f0c81f`) e o estado real da nuvem e da maquina. Todo comando de
gcloud e de firebase foi dado com `--project a-fabrica-soulan` explicito, §A.20. Nao rodei
`gcloud config set project`, nao rodei commit, nao publiquei nada.

Nao confiei na palavra dos tres relatorios (`docs/ost6-ponte.md`, `docs/ost6-base.md`,
`docs/ost6-painel.md`). Cada afirmacao abaixo tem evidencia colada de codigo com linha, de
saida de comando ou de resposta da nuvem.

## VEREDITO GERAL

**APROVADO COM RESSALVA.** Nenhum furo que deixe risco executar sem o diretor, nenhuma porta
de entrada na ponte, nenhum segredo no repositorio, e a regra que esta na nuvem nega todo mundo
fora da conta do diretor, provado ao vivo. Dez ressalvas, listadas no fim, sendo tres que eu
exijo resolvidas antes da main: o servidor de desenvolvimento do painel escutando em todas as
interfaces nesta maquina agora, o legado `.mjs` ainda executavel, e o segundo fator que o §A.6
exige e que este sistema nao verifica nem prova.

---

## 1. RISCO EXECUTA SEM RESPOSTA DO DIRETOR EM ALGUM CAMINHO?

**APROVADO.** Nao encontrei caminho de execucao de ferramenta de risco que escape do portao
nem que siga sem resposta explicita. Falha fechada em todos os ramos que a OST pediu para eu
olhar.

**Porta de entrada unica para a ferramenta.** `ponte/src/claudeCode.ts:185` entrega ao kit um
unico `canUseTool`, que e `portaoSeguro`, e nao existe lista de ferramenta pre-autorizada
(`allowedTools`, `disallowedTools` e `permissionPromptTool` nao aparecem em `ponte/src`).
`settingSources: []` em `ponte/src/claudeCode.ts:41` impede que arquivo de ajuste da maquina
injete permissao, o que e o "nao existe pre-autorizacao de comando" do §A.6 na pratica.

**Defesa antes do init,** `ponte/src/claudeCode.ts:174-183`:

```ts
const portaoSeguro: CanUseTool = async (toolName, input): Promise<PermissionResult> => {
  if (!estado.modoConferido) {
    return { behavior: 'deny', message: 'modo nao conferido no init, negado por seguranca' };
  }
  try {
    return await portao(toolName, input);
  } catch {
    return { behavior: 'deny', message: 'erro no portao, negado por seguranca' };
  }
};
```

Se o evento `init` nao chegou, nada passa. Se o portao lanca, nega.

**Erro no portao ligado a base,** `ponte/src/ponte.ts:128-130`: o `catch` do `portaoParaBase`
devolve `{ behavior: 'deny' }`. Vale para falha de rede ao publicar o pedido, falha ao
atualizar a fabrica e qualquer excecao do meio do caminho.

**Tempo esgotado, erro do ouvinte e resposta malformada,** `ponte/src/base.ts:150-187`. Os
quatro ramos de saida sao, em ordem, relogio de 300000 ms que resolve `deny`, resposta
reconhecida, `recusado`, e o ramo final:

```ts
// Respondida com resposta que a ponte nao reconhece: recusa, falha fechada.
fim({ decisao: 'deny', resposta: 'resposta malformada, recusado por seguranca' });
```

e o tratador de erro do `onSnapshot`:

```ts
() => fim({ decisao: 'deny', resposta: 'erro ao ouvir a base, recusado por seguranca' })
```

**Valor fora do conjunto esperado, duas camadas.** No codigo, `respostaDe` em
`ponte/src/tipos.ts:164-168` so reconhece os tres valores do §A.4 e devolve `null` para
qualquer outro, o que cai no ramo de recusa acima. Na base, a regra que esta na nuvem ja proibe
a escrita de valor estranho, `firebase/firestore.rules:124`:

```
&& request.resource.data.resposta in ['aprovado','recusado','aprovado com observacao']
```

**Documento apagado no meio da espera:** `textoDe(dado, 'situacao')` com `snap.data()`
indefinido devolve `null`, a funcao retorna sem resolver, e o relogio recusa. E a regra nao
deixa apagar de nenhum jeito pelo caminho do cliente, `firestore.rules:128`,
`allow delete: if false`.

**Reinicio no meio da espera.** `ponte/src/base.ts:244-277`, `reconciliarPendentes`, roda em
toda subida (`ponte/src/ponte.ts:268`) e transforma pedido pendente de sessao morta em
`recusado`, com trilha e com `respondidoPor`. Provado ao vivo no teste 7 da rodada da ponte:

```
TESTE 7 PASSOU: pedido pendente sobrevivendo a reinicio da ponte. pedido sobreviveu a parada: true;
  depois do reinicio a ponte resolveu como recusado com a trilha "ponte reiniciou, sessao encerrada,
  recusa por seguranca"; o arquivo que o agente queria escrever existe: false
```

A ultima linha e o que importa: a ferramenta que o agente queria usar nao executou.

**Filtro de comando nao e protecao, e nao esta sendo vendido como tal.** A funcao `risco` em
`ponte/src/ponte.ts:35-44` classifica o pedido para o diretor ler, e nao decide nada: quem
decide e `portaoSeguro`, que chama o portao para **toda** ferramenta que o kit submete, sem
olhar o nivel de risco. Confirmado por leitura: nao existe nenhum ramo do tipo
`if (risco === 'baixo') allow`.

**Duas observacoes honestas, que nao mudam o veredito deste item.**

1. O relogio e de cinco minutos fixos (`limiteMs = 300000`, `base.ts:150`, chamado com dois
   argumentos em `ponte.ts:123`). Passados cinco minutos, a ponte recusa e segue, mas **nao
   escreve nada no pedido**: o documento fica `pendente`. Se o diretor responder depois, a
   regra aceita a resposta, o documento passa a dizer `aprovado` e nada executou. A seguranca
   esta certa, falhou fechado; a trilha e que fica imprecisa. Virou condicao 4.
2. No modo `default` do kit, ferramenta de leitura nao passa pelo `canUseTool`. O portao cobre
   escrita, execucao de comando e rede, que e o que o §A.6 chama de risco. A isca da ressalva 1
   e justamente uma escrita, entao o que esta provado vivo e o portao de risco. Consequencia
   real: uma fabrica pode **ler** arquivo da maquina sem passar pelo portao, inclusive
   `%USERPROFILE%\.a-fabrica-ponte\sessao.json`. Hoje isso nao sai da maquina, porque
   `publicarAtividade` (`base.ts:121-127`) grava so `seq`, `tipo`, `ferramenta`, `subagente` e
   `inicioSubagente`, sem conteudo, e qualquer saida pela rede e ferramenta de risco, que passa
   pelo portao. Fica registrado como limite conhecido, nao como furo.

---

## 2. AS TRES RESSALVAS CONTINUAM COMO PORTAO DURO DEPOIS DO PORTE?

**APROVADO COM RESSALVA.** As tres sobreviveram, sao obrigatorias no unico caminho de abertura,
e nenhuma delas pode ser desligada por variavel de ambiente, por parametro ou por tipo frouxo.
A ressalva e o legado `.mjs`, que continua executavel.

**Ressalva 1, verificacao com isca antes de TODA abertura.** `ponte/src/claudeCode.ts:156-161`:

```ts
export async function abrirFabrica(opcoes: OpcoesAbertura): Promise<EstadoAbertura> {
  const { cwd, prompt, portao, onEvento } = opcoes;

  // Ressalva 1: so abre com o portao vivo.
  const prova = await verificaPortao(cwd);
  if (!prova.vivo) throw new PortaoNaoConfirmado(prova);
```

Sem flag, sem `if (opcoes.pular)`, sem leitura de ambiente. `OpcoesAbertura`
(`claudeCode.ts:143-150`) nao tem campo que desligue a verificacao: os campos sao `cwd`,
`prompt`, `resumeId`, `portao`, `onEvento` e `maxTurns`. `vivo` so e verdadeiro com
`chamado > 0 && !iscaExecutou` (`claudeCode.ts:105`), e erro ao sondar cai no `catch` da linha
90 sem mudar `chamado`, portanto erro resulta em nao abrir. Confirmacao por efeito na linha 95,
`if (existsSync(alvo)) iscaExecutou = true`.

**Mesmas opcoes e ambiente.** `opcoesBase(cwd)` (`claudeCode.ts:37-46`) e a mesma funcao usada
pela isca (`claudeCode.ts:75`) e pela sessao real (`claudeCode.ts:185`). A unica diferenca entre
as duas e `maxTurns` (2 contra 12) e o `resume` da sessao retomada (`claudeCode.ts:186`),
nenhum dos dois com efeito sobre permissao. O caso da sessao retomada fica coberto pela
ressalva 3, que confere o modo no `init` da propria sessao retomada.

**Ressalva 2, limpeza das variaveis de aninhamento.** `claudeCode.ts:26-34`, aplicada dentro de
`opcoesBase`, logo vale para a isca e para a sessao real:

```ts
if (/^CLAUDE/i.test(k) || k === 'CLAUDECODE' || k === 'AI_AGENT') continue;
```

Honestidade sobre a prova: `ponte/src/testes/prova-ressalvas.ts:40` filtra as variaveis com o
mesmo criterio de `ambienteLimpo`, entao aquele teste prova que o que a funcao remove sai, e nao
que a lista de variaveis de aninhamento esta completa. A prova de comportamento e a ressalva 1:
se o aninhamento tivesse vazado, o filho herdaria a sessao do pai, o portao nao seria chamado e
a isca teria executado. A saida real mostra o contrario, `chamado: 1`, `iscaExecutou: false`.

**Ressalva 3, modo fixado conferido no init.** `claudeCode.ts:20`:

```ts
/** Modo de permissao fixado na mao, sempre. Nunca o padrao do ambiente, §A.6. */
export const MODO: PermissionMode = 'default';
```

E constante do modulo, tipada como `PermissionMode`, sem `process.env` em volta. Comparei com a
unica variavel de ambiente vizinha, `PONTE_MODELO` na linha 18, que troca o modelo, nao o modo.
A conferencia esta em `claudeCode.ts:191-195`:

```ts
estado.modoConferido = m.permissionMode === MODO;
if (!estado.modoConferido) {
  throw new Error(`modo nao fixado como ${MODO} (veio ${String(m.permissionMode)}), falha fechada`);
}
```

Lanca, e `abrir` em `ponte.ts:243-249` marca a fabrica como `falhou` com o motivo. §A.6
cumprido: fixado na mao, nunca no padrao do ambiente, e conferido em toda abertura.

**Tipo frouxo nao abre brecha.** Busca em `ponte/src`: zero ocorrencias de `: any`, `as any`,
`<any>`, `@ts-ignore` e `@ts-expect-error`. Existem duas conversoes amplas, nenhuma no caminho
de decisao: `claudeCode.ts:238` (`m.usage`, telemetria de consumo) e
`persistenciaArquivo.ts:138` (entrega da classe de persistencia ao SDK). `ponte/tsconfig.json`
tem `strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`,
`noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters` e `noFallthroughCasesInSwitch`.

**Caminho alternativo de codigo.** `abrirFabrica` e a unica funcao que chama `query` do kit para
abrir sessao de trabalho, e `verificaPortao` e a unica outra chamada, que e a propria isca.
Nenhum outro arquivo de `ponte/src` importa `@anthropic-ai/claude-agent-sdk`.

**RESSALVA, o legado roda.** `ponte/legado-mjs/` esta versionado e e executavel por qualquer um,
ao contrario do que o `LEIA.md` afirma ("Ninguem executa daqui"). Provei:

```
$ node --check legado-mjs/ponte.mjs
SINTAXE OK, arquivo executavel por node
firebase/firestore -> C:\Users\Henrique\a-fabrica\ponte\node_modules\firebase\firestore\dist
claude-agent-sdk -> C:\Users\Henrique\a-fabrica\ponte\node_modules\@anthropic-ai\claude-ag
```

e o arquivo se auto executa, ultima linha de `legado-mjs/ponte.mjs`:

```js
if (process.argv[1] && process.argv[1].endsWith('ponte.mjs')) main({ emulador: process.env.PONTE_EMULADOR === '1' });
```

O que o legado perde: `legado-mjs/base.mjs:23-32`, o `initBase` dele **nao faz login nenhum** e
nao confere identidade; nao existe `conferirDiretor`, nao existe sessao persistida. O que o
legado mantem: as tres ressalvas, `legado-mjs/claudeCode.mjs:10,19,43,49,57-58`.

Tamanho real do dano hoje: nulo. Sem identidade, a regra que esta na nuvem nega tudo, inclusive
o ouvinte de comandos, entao essa ponte velha sobe e nunca abre fabrica nenhuma. Provei a
recusa ao vivo no item 3. Mesmo assim e codigo morto que roda, com identidade mais fraca que a
do codigo vivo, e a margem e fina demais para ficar como esta. Condicao 2.

---

## 3. ALGUEM QUE NAO SEJA O DIRETOR LE OU ESCREVE NA BASE?

**APROVADO COM RESSALVA.** A regra que esta na nuvem e exatamente a do repositorio, nega todo
mundo fora da conta do diretor, e a recusa esta provada **ao vivo contra a nuvem** para o caso
que da para provar hoje. A ressalva tem duas partes: o segundo fator que o §A.6 exige nao e
verificavel por este sistema, e a escada de credencial da ponte toca uma credencial com poder
muito maior que as regras do Firestore.

**O que esta na nuvem, buscado pela API, nao pelo comentario do arquivo.**

```
GET https://firebaserules.googleapis.com/v1/projects/a-fabrica-soulan/releases
  (Authorization: Bearer <token do gcloud>, x-goog-user-project: a-fabrica-soulan)

"name": "projects/a-fabrica-soulan/releases/cloud.firestore"
"rulesetName": "projects/a-fabrica-soulan/rulesets/f2672394-b4fb-4960-adca-d9c8bb5bb738"
"createTime": "2026-10-13T01:46:55.576020Z"
"updateTime": "2026-10-13T12:48:07.904318Z"
```

Baixei o conjunto e comparei com o arquivo local:

```
arquivos no conjunto: firestore.rules
createTime do conjunto: 2026-10-13T12:48:06.234319Z
=== DIFF nuvem vs local (firebase/firestore.rules) ===
IDENTICOS, byte a byte
```

Ou seja, o endurecimento esta no ar. Nota de documentacao: por ser identico byte a byte, o
cabecalho que esta na nuvem carrega a frase hoje falsa de `firebase/firestore.rules:11`,
"ESTA VERSAO, com o endurecimento da OST 6, AINDA NAO ESTA NA NUVEM". Condicao 7.

**Quem nao e o diretor, caso por caso.** Sem autenticacao, com a chave web publica, contra a
base real, agora:

```
$ curl ".../projects/a-fabrica-soulan/databases/(default)/documents/fabricas?key=AIzaSy..."
{ "error": { "code": 403, "message": "Missing or insufficient permissions.",
             "status": "PERMISSION_DENIED" } }

comandos   -> HTTP 403 PERMISSION_DENIED
aprovacoes -> HTTP 403 PERMISSION_DENIED
maquinas   -> HTTP 403 PERMISSION_DENIED
relatorios -> HTTP 403 PERMISSION_DENIED
```

Esta e a prova que vale hoje, e ela vale contra a nuvem de verdade, nao contra emulador.

Outro e-mail, e-mail nao verificado, anonimo, e-mail parecido e e-mail do diretor em maiusculas:
negados pela forma da regra, `firebase/firestore.rules:40-44`:

```
function diretor() {
  return request.auth != null
    && request.auth.token.email == 'henrique.vieira@soulan.com.br'
    && request.auth.token.email_verified == true;
}
```

Comparacao exata de texto, entao maiuscula ou dominio parecido nao casa; `request.auth != null`
derruba o anonimo; `email_verified == true` derruba o nao verificado; e token autenticado sem
e-mail nao casa com a igualdade. Mais o `nega tudo` final, `firestore.rules:139-141`. Esses
seis casos foram exercitados pelo agente da base no emulador (casos 1.1 a 1.17, 7.5 e 7.6 de
`firebase/testes/rodada-2026-10-13-091905/saida-regras.txt`) e **nao** contra a nuvem, porque o
Authentication do projeto ainda nao existe:

```
$ curl -X POST ".../v1/accounts:signUp?key=AIzaSy..."
{"error":{"code":400,"message":"CONFIGURATION_NOT_FOUND", ...}}
```

Entao sejamos exatos no que esta provado: hoje esta provado na nuvem que **ninguem sem sessao
entra**, e nao esta provado na nuvem que **outra conta com sessao e barrada**, porque nao existe
como criar sessao nenhuma ainda. Isso vai para o item 7.

**Segundo fator, §A.6, nao provado e nao exigivel por aqui.** As regras do Firestore nao
conferem segundo fator, e com entrada pelo provedor Google o token nao carrega essa informacao.
A protecao mora na conta Google do diretor, fora deste sistema, e nenhum agente desta OST
trouxe evidencia de que ela esta ligada. A OST me manda auditar "os dois fatores estao
exigidos"; eu nao posso aprovar o que nao consigo verificar. Condicao 1.

**A escada de credencial da ponte, o que ela permite de fato.** `ponte/src/identidade.ts:391`:

```ts
export const ESCADA: Degrau[] = [degrauEmulador, degrauTokenDoFirebaseCli, degrauColagemNaInstalacao];
```

O degrau (a) le o deposito do firebase CLI, so leitura, `identidade.ts:49` e `109-132`. **Sim,
aquele token carrega poder maior que as regras do Firestore, e muito maior.** Li os escopos do
deposito, sem imprimir token:

```
campo scope (string):
   https://www.googleapis.com/auth/cloud-platform
   https://www.googleapis.com/auth/cloudplatformprojects.readonly
   https://www.googleapis.com/auth/firebase
   https://www.googleapis.com/auth/userinfo.email
   openid
tem refresh_token de longa duracao: true
conta: henrique.vieira@soulan.com.br
activeProjects: {"...centrafin-app":"centra-fin","...CENTRA DASH":"soulan-central-indicador-a88bd","...reuniao-semanal":"reuniaosemanal-77019"}
```

Tamanho do achado, dito sem suavizar: `cloud-platform` mais um token de atualizacao de longa
duracao da conta do diretor, que e `roles/owner` do projeto (provado no item 9), e cuja conta
alcanca outros sistemas reais, inclusive o `dash-iff` do §A.20. Esse arquivo e a chave mestra
da nuvem do diretor, e nenhuma regra de Firestore limita quem o tem.

O que modera o achado, com evidencia:

- A ponte **nao guarda** esse token. O que vai para o disco e so a sessao do Firebase. Conferi
  a forma do que e persistido, sem ler valores:
  `stsTokenManager tem campos: refreshToken,accessToken,expirationTime`, e nada de token OAuth
  de nuvem.
- A ponte **nao usa** esse token em nenhuma API alem da troca de identidade com o proprio
  Google (`signInWithCredential`, `identidade.ts:206`).
- A ponte **nao registra** o token. As linhas de relato citam so o e-mail, o cliente OAuth e o
  vencimento (`identidade.ts:177-183`), o que importa porque `entrar.ts:45` sabe gravar relato
  em arquivo.
- O arquivo ja esta na maquina e no mesmo usuario, portanto a ponte nao cria privilegio novo
  para quem ja executa codigo como o diretor.

Conclusao do sub-item: achado real, de impacto alto e probabilidade baixa, que fica como
condicao 5, preferir o degrau (b), cujo material e so um token de atualizacao do Firebase deste
projeto, e nao a nuvem inteira.

**Limite honesto que a propria regra assume e eu confirmo:** sob conta unica nao existe
isolamento entre ponte e painel, e `maquinaId` e escopo logico, nao fronteira
(`firebase/firestore.rules:30-35`). Quem tem a conta do diretor alcanca tudo. Isso e
consequencia da decisao, correta, de nao usar chave de servico, e nao e furo.

---

## 4. O PAINEL DE VERDADE EXIGE LOGIN MESMO?

**APROVADO.** A barreira nao e de tela, e da fonte de dados. Nao achei caminho de leitura da
base sem usuario autenticado, nem por um instante.

`painel/app/page.tsx:19-25`:

```tsx
const entrada = usarEntrada();
const dentro = entrada.situacao === 'dentro';
const base = dentro ? entrada.base : null;
const estado = usarPainel(base);
...
if (!dentro) return <Barreira entrada={entrada} />;
```

`usarPainel` roda sempre, mas com `base` nula, e o ouvinte nao nasce com base nula,
`painel/src/dados/ouvintes.ts:53-57`:

```ts
useEffect(() => {
  if (!consulta) {
    setEstado({ itens: [], carregando: false, erro: null });
    return;
  }
```

e cada consulta e construida como `base ? query(...) : null` (`ouvintes.ts:74, 80, 88, 97, 108`).
`entrada.base` so recebe valor depois da conferencia de conta,
`painel/src/dados/autenticacao.ts:91-106`:

```ts
const email = (quem.email ?? '').toLowerCase();
if (email !== EMAIL_DO_DIRETOR || !quem.emailVerified) {
  await signOut(auth);
  ...
  setSituacao('recusada');
```

Note a ordem: para outra conta, `setBase` nunca e chamado, entao nenhum ouvinte e criado nem por
um instante, e a sessao e encerrada. Nao e tela escondendo: o painel nao tem outra rota (saida
estatica de uma pagina, `painel/out` com `index.html`, `404.html` e `_next`), e nao tem nenhuma
funcao de escrita importada. Varredura em `painel/src` e `painel/app` por `setDoc`, `addDoc`,
`updateDoc`, `deleteDoc`, `runTransaction` e `writeBatch`: zero ocorrencias.

**Barrada de verdade, em duas camadas, com honestidade sobre o que esta provado.** Camada do
painel: `signOut` imediato, provado pelo agente do painel contra o emulador do Auth
(`painel/testes/rodada-2026-10-13-102132-final/14-conta-recusada-computador.png`). Camada da
base: a regra que esta na nuvem nega a outra conta, e isso esta provado no emulador e **nao** na
nuvem, pelo motivo do item 3. A camada que importa mais e a da base, porque e a que resiste a
quem abre o console do navegador.

**O que esta servido agora em https://a-fabrica-soulan.web.app.** So a barreira:

```
$ curl -s https://a-fabrica-soulan.web.app/ | wc -c
6704
$ grep -o "Entrar com o Google" index.html
Entrar com o Google
$ grep -c "AIzaSy" index.html
0
```

**Sem sobra do prototipo antigo.** O canal publico morreu:

```
$ firebase hosting:channel:list --project a-fabrica-soulan
Channel ID  Last Release Time    URL                               Expire Time
live        2026-10-13 10:33:09  https://a-fabrica-soulan.web.app  never
```

Nenhum canal de preview. E os enderecos do prototipo nao existem mais como arquivo: todos caem
na reescrita para `/index.html`, provado pelo tipo de conteudo e pelo corpo:

```
$ curl -s https://a-fabrica-soulan.web.app/preview/dados.js | head -c 60
<!DOCTYPE html><html lang="pt-BR" data-theme="dark"><head>...
content-type: text/html; charset=utf-8
```

`firebase.json` da raiz confirma a pasta servida: `"public": "painel/out"` com reescrita de tudo
para `/index.html`.

**Duas observacoes de superficie, de baixa gravidade, sem veto.**

1. O endereco e publico e a pagina de entrada mostra o e-mail do diretor, `Barreira.tsx:48`,
   confirmado no HTML servido (`grep -c "henrique" index.html` devolveu 1). Isso entrega ao
   mundo exatamente qual conta atacar. Condicao 9, opcional.
2. A hospedagem serve apenas `Strict-Transport-Security`. Nao ha `Content-Security-Policy`,
   `X-Frame-Options` nem `X-Content-Type-Options`. Para um painel de leitura com entrada por
   janela do Google o risco e baixo, mas e superficie gratuita de fechar.

---

## 5. EXISTE SEGREDO EM CODIGO, REPOSITORIO OU ARQUIVO DESPROTEGIDO?

**APROVADO COM RESSALVA.** Nenhum segredo no repositorio nem no historico dos dois commits. A
ressalva e um identificador da nuvem em arquivo versionado, que e inconsistencia de principio e
nao vazamento.

**Varredura dos arquivos versionados (HEAD), fora de `package-lock.json` e `node_modules`, por
`AIzaSy`, `BEGIN ... PRIVATE KEY`, `private_key`, `client_secret`, `ya29.`, `1//<token>`,
`sk-ant-`, `firebase-adminsdk` e `serviceAccount`:**

```
docs/ost6-painel.md:336-343  (texto do relatorio citando a busca)
painel/scripts/construir-para-hospedagem.mjs:58:  return /AIzaSy/.test(readFileSync(caminho, 'utf8'));
```

**Mesma varredura dentro dos dois commits da OST** (`git grep` em `688ed2b` e `7f0c81f`) e **nas
linhas adicionadas pelo diff `688ed2b^..7f0c81f`**: as mesmas quatro linhas, nada mais. Nada de
chave privada, nada de chave de servico, nada de token. As pastas de evidencia versionadas (89
arquivos em `firebase/testes/rodada-*` e `painel/testes/rodada-*`) tambem estao limpas de
`AIzaSy`, de JWT (`eyJ...`), de `key=<valor>` e de `Bearer <valor>`.

**(a) A chave do cliente web do Firebase: tratada de forma correta.** Ela e publica por
natureza, e eu provei que a propria hospedagem a serve a quem pedir:

```
$ curl -i https://a-fabrica-soulan.web.app/__/firebase/init.json
HTTP/1.1 200 OK
{ "apiKey": "AIzaSy...", "appId": "1:352717030070:web:...", "authDomain": "...", ... }
```

O projeto nao a vende como segredo nem a trata como inofensiva por descuido: ela fica fora do
repositorio (`painel/.env.local` ignorado, `git check-ignore -v .env.local` devolve
`.gitignore:30:*.local`), o `painel/.env.example` nao tem valor nenhum, o pacote que vai para a
nuvem e construido com as variaveis em branco e varrido no fim
(`painel/scripts/construir-para-hospedagem.mjs:22-35, 56-65`), e eu confirmei que `painel/out`
nao contem `AIzaSy` nem o emulador embutido. O enquadramento certo, que a auditoria confirma, e
que a chave nao protege nada e nao precisa proteger: quem a tem continua barrado, provado no
item 3 com HTTP 403 em todas as colecoes usando exatamente essa chave. A unica consequencia dela
ser publica, e que vale registrar, e que qualquer pessoa pode falar com o Identity Toolkit deste
projeto, assunto do item 7.

**(b) O id do app em arquivo versionado: aceitavel como risco, achado como principio.**

```
ponte/instalar.ps1:31:$appWeb = '1:352717030070:web:6a784bc160ae657a0a9c17'
```

Nao e segredo: o mesmo valor esta no `init.json` publico acima e sai de `firebase apps:list`
para quem tem acesso ao projeto. Entao nao ha vazamento. O achado e de coerencia: a propria OST
escreveu o principio contrario em `painel/src/dados/configuracao.ts:12`, "Nenhuma chave, nenhum
appId e nenhum authDomain aparece em arquivo versionado", e o agente do painel tirou esse mesmo
id do `.env.example` por causa disso (`docs/ost6-painel.md`, decisao 5). Dois arquivos da mesma
OST seguem regras opostas. Condicao 6.

Sobre `563584335869-...apps.googleusercontent.com`, citado em `docs/ost6-ponte.md:264`: e o
cliente OAuth publico do proprio firebase CLI, valor aberto, nao e segredo.

**(c) O arquivo de sessao da ponte: permissao correta de verdade, conferida com icacls.**

```
$ icacls C:\Users\Henrique\.a-fabrica-ponte
C:\Users\Henrique\.a-fabrica-ponte DESKTOP-5LR6BRG\Henrique:(OI)(CI)(F)
Processados com sucesso 1 arquivos; falha no processamento de 0 arquivos

$ icacls C:/Users/Henrique/.a-fabrica-ponte/sessao.json
C:/Users/Henrique/.a-fabrica-ponte/sessao.json DESKTOP-5LR6BRG\Henrique:(I)(F)
(idem config.json, sessao-emulador.json e emulador-usuario.json)
```

Heranca quebrada, um unico titular, sem `SYSTEM`, sem `Administrators`, sem `Users`. Os arquivos
herdam dessa pasta. Isto bate com o que o codigo pede (`ponte/src/config.ts:133-149`,
`mode: 0o600` em `config.ts:120` e `persistenciaArquivo.ts:83-86`).

Fato que o relatorio da ponte nao destaca e que muda o tamanho do risco hoje: **a sessao da
nuvem esta vazia.**

```
sessao.json -> chaves da raiz: versao,atualizadoEm,entradas
               entradas: []
               bytes: 81
```

Nao existe token de atualizacao do diretor em disco neste momento, porque nenhum degrau de nuvem
conseguiu entrar. O que existe com token e `sessao-emulador.json`, cuja credencial so vale no
emulador local.

**Token de atualizacao em disco e risco aceitavel para esta arquitetura?** Sim, e por tres
razoes verificaveis. Primeira, a alternativa foi vetada com razao: chave de servico seria pior,
porque ignora as regras do Firestore e nao expira. Segunda, o alcance desse token e exatamente o
alcance das regras que estao na nuvem, isto e, as sete colecoes deste projeto e nada mais,
enquanto o arquivo do firebase CLI que ja estava na mesma maquina tem escopo `cloud-platform`
(item 3), ou seja, o token da ponte e a credencial **menos** poderosa daquela pasta de usuario.
Terceira, o modelo de ameaca deste sistema e um usuario, uma maquina: quem le esse arquivo ja
executa codigo como o diretor e, nesse ponto, ja podia abrir o navegador logado dele. O que eu
exijo e que continue assim, com a permissao conferida a cada instalacao, e que a OST 7 nao
resolva o degrau (b) guardando a colagem em arquivo nenhum.

---

## 6. A PONTE ABRE PORTA OU ACEITA CONEXAO DE FORA?

**APROVADO para a ponte.** A ponte nao escuta nada, em lugar nenhum, nem em laco de retorno.
**RESSALVA grave fora da ponte:** ha um servidor de desenvolvimento do painel escutando em todas
as interfaces desta maquina neste momento, deixado pela propria OST.

**A ponte, prova negativa.** Busca por `createServer`, `.listen(`, `.bind(`, `net.Server`,
`http.Server`, `WebSocket`, `Socket(`, `ngrok`, `localtunnel`, `cloudflared` e `0.0.0.0` em
`ponte/src`, `ponte/dist`, `ponte/legado-mjs`, `ponte/instalar.ps1`, `ponte/package.json` e
`ponte/emulador`: **zero ocorrencias**. O unico uso de entrada e a leitura da propria entrada de
texto do processo, `ponte/src/ponte.ts:310-315`, que nao e porta.

Tudo o que a ponte faz na rede e saida: `fetch` para `securetoken.googleapis.com`
(`identidade.ts:238`), `fetch` para o emulador local (`identidade.ts:345`) e os ouvintes do
Firestore, que sao conexao de saida persistente. O proibido explicito esta escrito e cumprido,
`identidade.ts:8-13`: nao existe degrau de navegador com retorno local.

**A tarefa agendada, conferida na maquina:**

```
TaskName        State
A Fabrica Ponte Ready

Execute          : C:\Program Files\nodejs\node.exe
Arguments        : "C:\Users\Henrique\a-fabrica\ponte\dist\ponte.js"
WorkingDirectory : C:\Users\Henrique\a-fabrica\ponte
UserId    : Henrique
RunLevel  : Limited
LogonType : Interactive
```

Um processo de usuario comum, sem elevacao, rodando o `dist/ponte.js`, que nao escuta. O
`instalar.ps1` nao abre porta nenhuma: o que ele faz e `icacls`, `npm install`,
`npm run compilar`, `firebase apps:sdkconfig`, `node dist/entrar.js`, `Register-ScheduledTask` e
`Start-ScheduledTask`.

**O que existe de escuta em `ponte/`, e por que nao e veto.** O `ponte/emulador/firebase.json`
sobe o emulador do Firebase para teste, e o emulador escuta em `auth` 9199, `firestore` 8099,
`hub` 4499 e `logging` 4599, todos com `"host": "127.0.0.1"` escrito no arquivo. Isso nao e a
ponte, nao e o servico, nao esta no caminho da instalacao nem da tarefa agendada, e so sobe
quando uma pessoa roda `ponte\emulador\subir.ps1`. Registro como limite a respeitar, nao como
furo: nenhuma dessas portas pode jamais ser movida para `0.0.0.0`.

**ACHADO, e e serio.** Levantei as portas em escuta na maquina agora:

```
porta 3000 em ::, pid 25352
   comando: "C:\Program Files\nodejs\node.exe" C:\Users\Henrique\a-fabrica\painel\node_modules\next\dist\server\lib\start-server.js
porta 9099 em 127.0.0.1, pid 18296   (emulador de Auth, firebase-tools)
porta 4400 em 127.0.0.1 e ::1, pid 18296   (hub do emulador)
porta 4500 em 127.0.0.1, pid 18296   (logging do emulador)
porta 8080 em 127.0.0.1, pid 2104    (emulador do Firestore, java)
```

O `::` da porta 3000 e escuta em **todas** as interfaces, nao em laco de retorno: e o `next dev`
do painel (`painel/package.json:10`, `"dev": "next dev"`, sem `--hostname`), deixado vivo desde
a rodada do agente do painel. Qualquer maquina na mesma rede alcanca `http://<ip-da-maquina>:3000`
e recebe o painel, e junto recebe os caminhos internos do servidor de desenvolvimento do Next,
que servem codigo fonte e nao foram feitos para ficar expostos.

Nao vetei o item porque a pergunta e sobre a ponte e a ponte esta limpa, e porque isso nao vai
para a main: e processo vivo de maquina, nao linha de codigo. Mas e exatamente a classe de coisa
que o §A.6 proibe, aberta agora, na maquina do diretor. Condicao 3, e a mais urgente da lista.

---

## 7. O QUE MUDA NO MEU PARECER QUANDO O AUTHENTICATION FOR LIGADO

Hoje o login nao existe em lugar nenhum, confirmado por mim nos dois lados:

```
accounts:signUp (chave web real) -> HTTP 400 CONFIGURATION_NOT_FOUND
```

Isso significa que parte do que esta aprovado acima esta aprovado **por ausencia de
funcionalidade**, e nao por prova. Esta e a lista para reauditar, na ordem em que eu refaria:

1. **A recusa de outra conta na nuvem.** Hoje provado so no emulador (item 3). Depois do clique,
   repetir contra a base real: entrar com uma segunda conta Google qualquer e provar
   `PERMISSION_DENIED` em `maquinas`, `fabricas`, `fabricas/{id}/atividade`,
   `fabricas/{id}/tarefas`, `comandos`, `aprovacoes` e `relatorios`, em leitura e em escrita, e
   provar que o painel a desconecta. Enquanto isso nao existir, a frase "a regra nega todo mundo
   fora da conta do diretor" vale para quem **nao tem sessao**, e so.
2. **Quem pode criar conta no projeto.** Com a chave web publica e o provedor Google ligado, o
   padrao do Firebase e deixar **qualquer** conta Google se cadastrar no projeto. Essas contas
   nao leem nada, porque `diretor()` barra, mas passam a existir na lista de usuarios. Conferir
   depois do clique: provedor Google ligado e **so** ele, e-mail e senha desligado, anonimo
   desligado, e a lista de dominios autorizados do login contendo apenas
   `a-fabrica-soulan.web.app`, `a-fabrica-soulan.firebaseapp.com` e `localhost`.
3. **O segundo fator, §A.6.** Depois do clique, o caminho de entrada passa a existir de verdade,
   e e nesse momento que a ausencia de prova de segundo fator deixa de ser teorica. Ver
   condicao 1.
4. **Qual degrau da escada vence na ponte, e com que material.** Se vencer o degrau (a), a ponte
   passa a depender, em cada instalacao, da credencial `cloud-platform` do item 3. Se vencer o
   degrau (b), o material e so um token de atualizacao deste projeto. Reauditar a decisao com o
   erro real na mao, e conferir que nenhuma colagem ficou em arquivo, em historico de terminal
   ou em arquivo de relato (`entrar.ts:45`).
5. **O arquivo de sessao da ponte com conteudo.** Hoje ele esta vazio (81 bytes). Quando ganhar
   token, reconferir `icacls` da pasta e do arquivo, e conferir que o token nao apareceu em
   registro, em relato nem em pasta de rodada.
6. **Os sete testes contra a base real.** Nenhum dos sete rodou contra a nuvem
   (`docs/ost6-ponte.md`, tabela do Passo 3). Em especial os testes 3, 4 e 7, que sao os que
   provam que risco nao executa sem resposta, foram provados so no emulador. Incluir na rodada o
   caso que nao existe hoje: matar a ponte de forma seca (`SIGKILL`) **com pedido pendente**, e
   provar que nada executou e que nenhum processo do Claude Code sobrou orfao. Hoje esse caso
   esta coberto so por parada limpa (`sete-testes.ts:594` e `613`) mais o `matarSeco` do teste 5,
   que acontece sem pedido pendente.
7. **O painel lendo a configuracao da hospedagem e entrando de verdade**, com a leitura ao vivo
   das cinco colecoes contra a nuvem, nao contra o emulador.
8. **A regra de escrita do painel na Onda 2.** Na Onda 1 o painel nao escreve, entao
   `criadoEm == request.time`, `respondidoPor` preenchido e a transicao de estado unica nunca
   foram exercitadas por ele. A primeira escrita do painel precisa de auditoria propria.

---

## 8. §A.9, PLANO B

**APROVADO.** Esta OST so acrescentou. Nao achei alteracao de configuracao existente do Claude
Code nem do Antigravity.

**Busca por referencia a configuracao do diretor** em `ponte`, `painel`, `firebase` e `scripts`,
com os termos `antigravity`, `.claude.json`, `.claude/settings`, `codeium`, `windsurf`,
`AppData\Roaming\Code` e `.vscode`: nenhuma ocorrencia de codigo. A unica linha encontrada e um
comentario de promessa, `ponte/instalar.ps1:11`, e um comentario do gate do §A.7, que e do
repositorio, nao da maquina.

**Todas as escritas em disco da ponte, por linha** (`ponte/src`): `config.ts:120` e `125-126`
dentro de `%USERPROFILE%\.a-fabrica-ponte`; `persistenciaArquivo.ts:83-87` no arquivo de sessao
da mesma pasta; `identidade.ts:335` na mesma pasta; `ponte.ts:153` e `175` nas travas da mesma
pasta; `claudeCode.ts:63` cria a pasta de trabalho da fabrica; `claudeCode.ts:100` remove o
arquivo da propria isca, nomeado, §A.18; `entrar.ts:45` e `53` no arquivo de relato que o
operador pede. Nenhuma escrita fora da pasta nova e das pastas de rodada.

**A tarefa agendada respeita o §A.9.** Nome proprio, `A Fabrica Ponte`, criado por esta OST, e o
`-Force` de `instalar.ps1:161` sobrescreve apenas essa tarefa. Nenhuma tarefa do diretor e
tocada. Roda como usuario comum, `RunLevel: Limited`.

**`%USERPROFILE%\.a-fabrica-ponte` tambem respeita.** Pasta nova, criada por esta OST, fechada
para o usuario. Nao convive com configuracao de ninguem.

**Tres notas honestas, nenhuma delas violacao.**

1. O `settingSources: []` de `claudeCode.ts:41` e, na pratica, uma garantia a favor do §A.9: as
   fabricas nao carregam nem influenciam os ajustes de Claude Code do diretor.
2. As fabricas rodam pelo CLI do Claude Code, que grava transcricao de sessao dentro de
   `~/.claude/projects/...`. Isso e acrescimo de arquivo novo, nao alteracao de configuracao, e e
   o mesmo que acontece quando o diretor roda na mao.
3. `instalar.ps1:79` chama `firebase apps:sdkconfig`, e o proprio firebase CLI reescreve o
   deposito de token dele a cada comando (conferi o `mtime` de
   `~/.config/configstore/firebase-tools.json`, que muda a cada uso). O codigo da ponte **so le**
   esse arquivo, `identidade.ts:15-16` e `109-132`, e eu confirmei que nao existe escrita nele em
   lugar nenhum de `ponte/src`. O que muda o arquivo e o CLI do diretor, nao a ponte.

**O plano B continua de pe:** as fabricas rodam sobre as mesmas pastas de projeto, a ponte e um
processo a mais que da para desligar (`Unregister-ScheduledTask`), e sem o painel o diretor abre
o Claude Code na mao como sempre. O gate do §A.7 tambem continua intacto: o diff
`688ed2b^..7f0c81f` nao toca `.claude/`, `CLAUDE.md` nem `scripts/`, e `.claude/state/` tem
apenas o `README.md`, sem flag de liberacao.

---

## 9. A TRILHA E INAPAGAVEL, INCLUSIVE PELO DIRETOR?

**APROVADO COM RESSALVA, e a verdade e menos bonita que a promessa.**

**Pelo caminho do cliente, que e o unico que o painel e a ponte usam, a trilha e imutavel, e
mais do que antes.** Regra que esta na nuvem, byte a byte igual ao arquivo:
`allow delete: if false` em `maquinas` (linha 64), `fabricas` (71), `tarefas` (75), `atividade`
(83), `comandos` (104), `aprovacoes` (128) e `relatorios` (135). Atividade nao se altera
(`allow update, delete: if false`, linha 83). Comando so anda de `pendente` para `entregue`, uma
vez, preservando `fabricaId`, `maquinaId`, `texto`, `criadoEm` e `origem` (linhas 99-103).
Aprovacao so anda de `pendente` para `respondida`, uma vez, com `respondidoPor` preenchido e o
pacote congelado (linhas 121-127). E a hora e do servidor, nao do cliente, porque toda escrita de
trilha exige `== request.time`, o que impede hora forjada.

**Pelo caminho administrativo, nao e inapagavel, e nem poderia ser.** Regra de Firestore nao e
avaliada para quem chega por IAM. Provei a diferenca na mesma colecao, na mesma hora:

```
cliente com a chave web, sem sessao:
  GET .../documents/comandos?key=AIzaSy...   -> 403 PERMISSION_DENIED

token do gcloud do diretor, mesma leitura:
  GET .../documents/comandos                 -> {}      (sem erro, regra nao avaliada)

$ gcloud projects get-iam-policy a-fabrica-soulan ... --filter=...henrique.vieira...
ROLE         MEMBERS
roles/owner  user:henrique.vieira@soulan.com.br
```

Quem e `roles/owner` apaga documento, apaga colecao pelo console (que usa o caminho
administrativo) e apaga o banco inteiro, e o `allow delete: if false` nao impede nada disso. E
hoje nao ha rede de seguranca:

```
$ gcloud firestore databases describe --database="(default)" --project a-fabrica-soulan
pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_DISABLED
deleteProtectionState: DELETE_PROTECTION_DISABLED
earliestVersionTime: '2026-10-13T12:44:59.998072Z'
```

Sem recuperacao por ponto no tempo e sem protecao contra exclusao do banco. Entao a frase exata
e: **a trilha nao se apaga pelo painel nem pela ponte, e ninguem sem a conta do diretor a
alcanca; o diretor, como proprietario do projeto, apaga o que quiser pelo console ou pela API
administrativa, e hoje isso nao seria recuperavel nem registrado em nenhum lugar que este
sistema leia.** Garantia contra erro e contra invasor de fora, sim. Garantia contra o dono, nao.
A condicao 8 oferece o unico caminho real para estreitar isso.

Segundo limite, menor e ja citado no item 1: a trilha pode ficar **imprecisa** sem ser apagada.
Quando o portao recusa por tempo esgotado, o pedido continua `pendente` na base, e uma resposta
tardia do diretor grava `aprovado` num pedido que nunca executou. Condicao 4.

Terceiro limite: `respondidoPor` e texto que o cliente escreve, e sob conta unica nao ha como a
regra provar que quem escreveu "ponte" foi a ponte e nao o painel
(`firebase/firestore.rules:30-35`). A origem na trilha e declaracao conferida por forma, nao por
identidade. Isso e consequencia aceita de nao usar chave de servico.

---

## CONDICOES PARA LEVANTAR A RESSALVA

Numeradas, objetivas e verificaveis. As tres primeiras eu considero bloqueio para a main.

1. **Segundo fator provado, §A.6.** O diretor confirma, com evidencia (tela de
   `myaccount.google.com/signinoptions/twosv` ou a politica de aplicacao do Workspace), que a
   conta `henrique.vieira@soulan.com.br` exige segundo fator, e essa evidencia fica no diario da
   OST. Verificacao: existe o registro, com data, dizendo qual fator esta exigido. Enquanto nao
   existir, a frase "dois fatores obrigatorio" nao pode ser afirmada em relatorio nenhum.
2. **O legado `.mjs` deixa de ser executavel.** `node ponte/legado-mjs/ponte.mjs` tem de nao
   subir servico nenhum. Verificacao: rodar esse comando e obter recusa imediata, sem abrir
   aplicativo do Firebase e sem ouvinte. Preservar os arquivos, §A.17; o que muda e a capacidade
   de execucao, nao a existencia deles.
3. **Nenhuma porta de entrada viva na maquina.** Encerrar o processo `pid 25352`
   (`painel/node_modules/next/dist/server/lib/start-server.js`, escutando em `::` na porta 3000)
   e os emuladores deixados de pe. Dali em diante, o painel em desenvolvimento so sobe preso ao
   laco de retorno. Verificacao: `Get-NetTCPConnection -State Listen` sem nenhuma linha com
   `LocalAddress` diferente de `127.0.0.1` ou `::1` para processo deste repositorio.
4. **Tempo esgotado deixa trilha.** Quando o portao recusar por tempo, o pedido nao pode
   continuar `pendente` na base: a recusa tem de ficar gravada, com hora do servidor e origem, e
   o painel nao pode mais oferecer resposta para um pedido ja decidido. Verificacao: teste que
   deixa o pedido expirar e conferir no documento `situacao: respondida` com `resposta: recusado`
   e a razao do tempo. Decidir junto o prazo, porque cinco minutos para responder do celular e
   curto.
5. **Degrau (a) sob decisao explicita do diretor.** Depois do clique do Authentication, registrar
   qual degrau venceu e, se for o (a), o diretor decide por escrito se aceita que a ponte leia,
   em cada instalacao, uma credencial de escopo `cloud-platform` que alcanca os outros projetos
   dele. Verificacao: decisao registrada no diario, com os escopos colados como estao neste
   documento.
6. **Coerencia sobre identificador da nuvem em arquivo versionado.** Ou `ponte/instalar.ps1:31`
   deixa de carregar o id do app, como o `painel/.env.example` fez, ou o principio de
   `painel/src/dados/configuracao.ts:12` e corrigido para dizer a verdade. Uma das duas, nao as
   duas regras ao mesmo tempo. Verificacao: `git grep "6a784bc160ae657a0a9c17"` devolve zero, ou
   o texto do principio reflete o que o repositorio faz.
7. **Cabecalho das regras deixa de mentir.** `firebase/firestore.rules:11-12` diz que esta versao
   ainda nao esta na nuvem, e ela esta, identica byte a byte, desde `2026-10-13T12:48:07Z`, no
   conjunto `f2672394-b4fb-4960-adca-d9c8bb5bb738`. Verificacao: o cabecalho passa a citar o
   conjunto que esta na nuvem e a data, ou nao afirma nada sobre isso.
8. **Decisao do diretor sobre a rede de seguranca da trilha.** Ligar ou nao
   `pointInTimeRecovery` e `deleteProtection` no banco e decisao de custo e de escopo, portanto
   dele. Verificacao: decisao registrada; se ligar, `gcloud firestore databases describe` passa a
   mostrar os dois habilitados. Sem isso, nenhum relatorio pode dizer que a trilha e inapagavel
   sem a ressalva do item 9.
9. **Opcional, superficie da pagina publica.** Tirar o e-mail do diretor do HTML servido e
   acrescentar `Content-Security-Policy`, `X-Frame-Options` e `X-Content-Type-Options` na
   hospedagem. Verificacao: `curl -s https://a-fabrica-soulan.web.app/ | grep henrique` devolve
   zero e os cabecalhos aparecem na resposta.
10. **Reauditoria depois do clique do Authentication**, com a lista do item 7 inteira. Esta
    condicao nao levanta ressalva desta OST: ela e o gatilho da proxima auditoria, e eu nao
    aprovo Onda 2 sem ela.

## O QUE EU NAO FIZ, DE PROPOSITO

Nao implementei, nao corrigi e nao propus codigo, §A.12 e o limite do meu papel. Nao criei
protecao artificial: nao sugeri filtro de comando como defesa, porque filtro de comando nao
protege nada aqui, a protecao e a porta de entrada, a conta unica e o portao. Nao publiquei nada,
nao rodei commit e nao alterei arquivo nenhum fora deste documento. Nao escrevi em
`%USERPROFILE%\.a-fabrica-ponte`, nao respondi aprovacao nenhuma e nao escrevi na base: todas as
minhas chamadas a nuvem foram de leitura.
