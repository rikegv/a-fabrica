# O que falta para a ponte ter sessao de cliente, sem escutar porta e sem subir de credencial

Agente responsavel: **agente ponte** (§A.15). Este documento e o **achado** que o diretor pediu
para relatar, depois de proibir o uso do token do Firebase CLI como credencial da ponte. Nao e
construcao: nao existe tela nenhuma no painel feita por mim, §A.12. O que existe de codigo e so o
lado da ponte, que ja estava pronto e agora esta provado nos caminhos de erro.

## 1. A regra do terreno, em uma frase

A ponte precisa de uma **sessao de cliente do Firebase da conta do diretor**. Para o Firebase
emitir essa sessao com o provedor Google ligado, alguem tem de apresentar a ele uma **prova de
identidade do Google** daquela conta. Toda forma de obter essa prova cai numa de tres caixas:

1. **o navegador faz, e entrega** (o diretor ja fez o login no painel, basta passar a sessao
   adiante);
2. **um fluxo sem navegador no mesmo aparelho** (fluxo de dispositivo do Google, que precisa de um
   cliente OAuth proprio);
3. **o Google manda um segredo de uso unico por outro canal** (link por e-mail).

Nao existe uma quarta caixa que a ponte alcance sozinha. O caminho classico que faltaria,
`signInWithPopup` ou `signInWithRedirect` com retorno em `http://127.0.0.1:<porta>`, esta
**vetado pelo §A.6**, porque exige a ponte escutando porta, inclusive em laco de retorno. E o
caminho de chave de servico esta vetado pelo desenho (as regras do Firestore deixariam de valer).

## 2. Estado real da nuvem hoje, conferido agora, nao por memoria

Conferido com a chave web publica que a propria hospedagem serve em
`https://a-fabrica-soulan.web.app/__/firebase/init.json`:

```
POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSy...
HTTP 400
{ "error": { "code": 400, "message": "ADMIN_ONLY_OPERATION" } }

GET https://identitytoolkit.googleapis.com/v1/projects?key=AIzaSy...
HTTP 200
{ "projectId": "352717030070",
  "authorizedDomains": ["localhost","a-fabrica-soulan.firebaseapp.com","a-fabrica-soulan.web.app"] }
```

Leitura exata disso, sem otimismo:

- O Authentication **existe** agora. O erro deixou de ser `CONFIGURATION_NOT_FOUND`.
- `ADMIN_ONLY_OPERATION` diz que o cadastro por e-mail e senha pelo lado do cliente esta
  **fechado**. Isso e bom para a seguranca e tem uma consequencia pratica: **nenhum caminho de
  senha e nenhum caminho de link por e-mail funciona hoje**, porque os dois moram no provedor de
  e-mail e senha, que esta desligado.
- Os dominios autorizados sao os tres certos. A maquina do diretor **nao** esta nessa lista e nem
  poderia estar, porque ela nao tem dominio; e mais uma razao pela qual a janela de navegador com
  retorno local nao e so proibida, ela tambem nao esta habilitada.

Portanto, **hoje, a unica caixa aberta e a caixa 1**: a sessao que o navegador do diretor ja tem.

## 3. O que falta, exatamente, em termos tecnicos

Do lado do codigo da ponte: **nada**. O que falta e um dado de entrada que so o diretor pode
produzir. Em detalhe:

| Peca | Situacao |
| --- | --- |
| Troca de credencial por sessao propria, por conexao de saida (`securetoken.googleapis.com`) | pronta e provada contra o endpoint real |
| Conferencia de que a sessao e do diretor, com e-mail verificado e do projeto certo | pronta e provada com alegacoes forjadas |
| Sessao persistida em arquivo, com o SDK renovando sozinho depois | pronta, provada na OST 6 parte 1 |
| Recusa clara, sem gravar nada, para colagem vazia, truncada, de outro formato ou invalida | pronta e provada, dez casos |
| **O token de atualizacao da sessao do diretor** | **falta, e e acao dele** |

## 4. As opcoes que existem de fato, com custo e risco

### Opcao A, colagem unica da credencial de sessao obtida no painel ja logado

**Como funciona.** O diretor abre `https://a-fabrica-soulan.web.app`, entra com o Google (com o
segundo fator dele, como sempre), e copia o **token de atualizacao** daquela sessao de navegador.
Roda a instalacao com `-Colar` e cola. A ponte troca esse token por sessao propria no endpoint de
token seguro, por **POST de saida**, confere que a conta e a do diretor, com e-mail verificado e
com `aud` igual ao projeto desta ponte, e grava. Dali em diante o proprio SDK renova, e a colagem
nunca se repete.

**Custo.** Zero de configuracao na nuvem. Hoje, sem tela no painel, o diretor precisa abrir as
ferramentas de desenvolvedor do navegador e rodar uma linha (esta no fim deste documento). Com a
tela proposta no painel, viraria um botao de copiar.

**Risco, dito sem suavizar.** O que fica no disco e um **token de atualizacao do Firebase deste
projeto**. Quem o rouba vira o diretor **dentro do alcance das regras do Firestore**, isto e, as
sete colecoes deste projeto, e nada mais. Nao alcanca `dash-iff`, nao alcanca outro projeto, nao
alcanca `cloud-platform`. E, honestamente, o pior ponto desta opcao: **revogar nao e simples**.
Token de atualizacao do Firebase nao morre quando o diretor sai do navegador; ele morre quando o
usuario e desativado ou apagado no Authentication, ou quando alguem chama `revokeRefreshTokens`
pelo lado administrativo. Hoje nao existe um botao de "desligar a ponte" nesse sentido, e isso e
achado novo para a lista da seguranca.

### Opcao B, fluxo de dispositivo do Google com cliente OAuth dedicado de escopo minimo

**Como funciona.** O diretor cria no console do Google Cloud um cliente OAuth do tipo de aparelho
de entrada limitada, com escopo minimo, `openid` e `email`. A ponte pede um codigo de dispositivo
(saida), mostra no terminal um codigo curto e um endereco, o diretor confirma no celular ou no
navegador que quiser, com o segundo fator dele, e a ponte fica **perguntando** (saida) ate o
Google devolver o token de identificacao. Com esse token, a ponte chama
`signInWithCredential` e ganha a sessao do Firebase. **Nada escuta em momento nenhum**: fluxo de
dispositivo e feito de perguntas de saida, e por isso ele e a resposta correta para o §A.6.

**Custo.** Alto para o diretor numa vez so, e com uma incerteza real:

1. criar o cliente OAuth no console (e, se o projeto ainda nao tiver, configurar a tela de
   consentimento, que e mais alguns passos);
2. **incerteza que eu nao consigo eliminar sem o cliente existir**: o Identity Toolkit precisa
   aceitar um token de identificacao cuja audiencia e esse cliente novo. Tokens de clientes OAuth
   do mesmo projeto normalmente sao aceitos, mas eu nao vou afirmar o que nao testei. Se for
   recusado por audiencia, o caminho morre e o trabalho foi perdido;
3. codigo novo na ponte, cerca de uma tela de codigo, mais tratamento de espera e de recusa.

**Risco.** Fica **mais** material no disco, nao menos: o token de atualizacao do Google (escopo
`openid` e `email`, que nao le nada de nuvem) **mais** o token de atualizacao do Firebase. Em
troca vem uma vantagem concreta que a opcao A nao tem: aquele acesso aparece na pagina de
permissoes da conta Google do diretor e ele **revoga com um clique**, de qualquer lugar, sem
mexer no Authentication. Se revogabilidade for o que mais importa, esta e a melhor opcao.

### Opcao C, entrada por link de e-mail

**Como funciona.** A ponte pede ao Firebase que mande o link para o e-mail do diretor (saida), ele
abre o e-mail, copia o endereco do link e cola na instalacao. A ponte chama
`signInWithEmailLink` e ganha a sessao.

**Custo.** Um clique no console para ligar o provedor de e-mail e senha com entrada por link.
Codigo novo na ponte, pouco.

**Risco, e por isso eu nao recomendo.** Dois problemas serios:

1. **Contorna o segundo fator.** Quem tiver acesso a caixa de entrada do diretor por uma hora
   entra como ele neste projeto, sem passar pelo segundo fator do Google. O §A.6 exige dois
   fatores; esta opcao abre uma porta que nao os exige.
2. **Alarga a superficie do projeto.** Hoje o cadastro de cliente esta fechado
   (`ADMIN_ONLY_OPERATION`); ligar o provedor de e-mail e senha abre um caminho de autenticacao
   que hoje simplesmente nao existe, para ganhar comodidade de instalacao.

O material em disco e o mesmo da opcao A.

### Opcao D, funcao na nuvem emitindo token personalizado

Uma Cloud Function que emite token personalizado de curta duracao para a conta do diretor, e a
ponte troca por sessao. **Nao recomendo agora**, por tres razoes: exige publicacao de funcao, que
nao e minha para fazer; precisa de um segredo de pareamento para que a funcao nao emita sessao
para qualquer um, o que recria o problema de credencial em disco que se queria resolver; e cria na
nuvem uma peca cujo poder e **emitir a identidade do diretor**, que e um alvo melhor que qualquer
arquivo local. Fica registrada como caminho possivel para a Onda 5, se a colagem incomodar.

### Opcao E, criar credencial pelo lado administrativo

Usar o firebase CLI, que esta autenticado, para importar um usuario com senha conhecida e a ponte
entrar com senha. **Rejeitada por mim, e nem testei.** Ela usa exatamente o atalho administrativo
que o diretor acabou de proibir no espirito, cria credencial de senha de longa duracao na conta
real dele, contorna o segundo fator e colide com a conta do provedor Google do mesmo e-mail.

### Opcao F, janela de navegador com retorno em 127.0.0.1

**Vetada pelo §A.6**, e nao esta na mesa. Registro so para a lista ficar completa, porque e a
primeira coisa que qualquer biblioteca de OAuth sugere.

## 5. Recomendacao

**Opcao A agora, opcao B como evolucao se o diretor quiser revogacao com um clique.**

Por que a A: e a unica que funciona **hoje**, sem tocar na configuracao da nuvem, sem codigo novo,
e o material que fica no disco e o **menor possivel** para esta arquitetura, exatamente o escopo
que as regras do Firestore limitam. E ela e de uma vez: feita a colagem, o SDK renova sozinho e o
diretor nunca mais repete isso.

Por que a B depois: o unico defeito real da A e a revogacao, e a B resolve isso de verdade,
colocando o acesso da ponte na pagina de permissoes da conta Google do diretor. A B tambem elimina
a colagem. O preco e a configuracao no console, o codigo novo e a incerteza de audiencia.

## 6. Risco de guardar material de renovacao em disco, opcao por opcao

| Opcao | O que fica no disco | Alcance se roubado | Como revogar |
| --- | --- | --- | --- |
| A, colagem | token de atualizacao do Firebase deste projeto | as sete colecoes deste projeto, dentro das regras | desativar ou apagar o usuario no Authentication, ou `revokeRefreshTokens` pelo lado administrativo. Nao basta sair do navegador |
| B, dispositivo | token do Google com `openid` e `email`, mais o do Firebase | o do Google nao le nada de nuvem, so diz quem e; o do Firebase, igual a A | um clique na pagina de permissoes da conta Google, mais o caminho da A |
| C, link | igual a A | igual a A | igual a A, e ainda fica o provedor de e-mail ligado no projeto |
| proibido, token do CLI | token com `cloud-platform` e atualizacao de longa duracao | **a nuvem inteira do diretor**, inclusive `dash-iff` | `firebase logout` e revogacao na conta Google |

A ultima linha esta ai de proposito: ela e a razao da decisao do diretor, com os escopos que a
auditoria de seguranca ja colou no parecer dela. Qualquer das tres opcoes de cima e menos
perigosa que a linha de baixo, por uma margem grande.

Em todas as opcoes a pasta local continua fechada com `icacls`, so o usuario do diretor, heranca
quebrada, e o arquivo de sessao com permissao de usuario unico. Isso ja esta provado.

## 7. O que eu preciso do diretor, em um passo

Enquanto nao existir a tela no painel, isto e o caminho mais curto, e ele e de uma vez:

1. Abrir `https://a-fabrica-soulan.web.app` e entrar com a conta dele.
2. Abrir as ferramentas de desenvolvedor, aba de console, e rodar esta linha, que le a credencial
   da propria sessao do navegador:

```js
(async()=>{let u=null;try{const d=await new Promise((r,j)=>{const q=indexedDB.open('firebaseLocalStorageDb');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});const t=d.transaction('firebaseLocalStorage','readonly');const a=await new Promise(r=>{const q=t.objectStore('firebaseLocalStorage').getAll();q.onsuccess=()=>r(q.result)});u=a.map(e=>e.value).find(v=>v&&v.stsTokenManager)||null}catch(e){}if(!u){for(const k of Object.keys(localStorage)){if(k.startsWith('firebase:authUser:')){const v=JSON.parse(localStorage.getItem(k)||'null');if(v&&v.stsTokenManager){u=v;break}}}}console.log(u?JSON.stringify({email:u.email,refreshToken:u.stsTokenManager.refreshToken}):'nao achei sessao, entre no painel primeiro')})()
```

Duas notas praticas sobre essa linha, para ela nao falhar por detalhe bobo: o painel usa
`getAuth`, que guarda a sessao no banco interno do navegador e, se ele nao estiver disponivel, no
armazenamento local, e a linha procura nos dois; e, na primeira vez, o navegador pode pedir
autorizacao para colar no console, costuma ser digitar `allow pasting` e apertar Enter.

3. Copiar o JSON de uma linha que aparecer e rodar, na pasta do repositorio:

```
powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Colar
```

A ponte aceita esse JSON do jeito que sai, ou o token puro. Se vier errado, truncado ou de outra
conta, ela recusa dizendo o motivo e **nao grava nada**, o que esta provado caso por caso em
`C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-13T1324-ost6-prova-colagem`.

Nota honesta sobre essa linha: ela mostra na tela uma credencial de verdade. Ela nao vai para o
repositorio, nao vai para arquivo de relato (provado) e deve ser colada uma vez so. Se o diretor
preferir nao ver credencial em tela, a opcao B e justamente o caminho que elimina isso, pelo preco
descrito acima.

## 8. Proposta de tela no painel, para quem for construir

Isto e proposta, §A.12, e e do agente do painel, nao minha. Em Configuracoes, item situacao da
ponte (F7): um botao **Parear esta maquina**, visivel so para o diretor logado, que mostre numa
caixa de leitura o JSON de uma linha com `email` e `refreshToken` da sessao atual, com botao de
copiar e um aviso curto de que a credencial vale como a sessao dele e e para usar uma vez na
instalacao da ponte. A ponte ja aceita exatamente esse formato, sem mudanca nenhuma de codigo.
