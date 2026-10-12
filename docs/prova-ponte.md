# Prova de conceito da ponte (OST 1, Parte 2)

Agente responsavel: ponte. Investigacao com prova real, em sessao viva, usando a CLI oficial do Antigravity, o `agy`. Cota autorizada pelo diretor para rodar as sessoes de teste. Pasta cobaia descartavel `a-fabrica-lab/projeto-bobo`. Nenhum projeto real usado. Esta OST nao constroi produto.

Correcao em relacao a versao anterior desta OST: o `agy` existe, e a linha de comando oficial do Antigravity. Antes nao estava instalado nesta maquina. Agora foi instalado pelo meio oficial e as quatro provas foram refeitas com ele, em sessao viva, nao por deducao.

## Ferramenta e instalacao

Instalado pelo meio oficial, no PowerShell:

```
irm https://antigravity.google/cli/install.ps1 | iex
```

- Binario em `C:\Users\Henrique\AppData\Local\agy\bin\agy.exe`, versao `1.3.3`.
- Autenticacao: o `agy` ja entrou autenticado, reaproveitando a credencial Google da conta do diretor que a IDE ja usava. Nao foi preciso novo login.
- A instalacao so acrescentou: incluiu a pasta do `agy` no PATH do usuario e criou a pasta propria da CLI em `~/.gemini/antigravity-cli`. Nao alterou a configuracao da IDE. A janela do Antigravity continua funcionando normalmente (§A.9 respeitado).

## Veredito das quatro provas

| Prova | Resultado | Em uma linha |
| --- | --- | --- |
| 1. Abrir sem janela | PASSA | `agy -p` abre sessao headless, devolve id, estado e consumo. |
| 2. Enxergar | PASSA | `--output-format stream-json` entrega atividade, modelo e consumo ao vivo. |
| 3. Aprovar por fora | PARCIAL | Perceber, capturar e RECUSAR funcionam pelo hook. APROVAR para executar nao, o motor de permissao headless ignora o grant. |
| 4. Comandar de novo | PASSA | `--conversation <id>` retoma a sessao e executa o comando novo. |

A prova 3, a mais importante, e a unica que fica parcial. O ponto exato onde esbarra esta na secao da prova 3, com a saida real na mao.

## Prova 1, abrir

Comando:

```
agy -p "Responda com uma frase curta confirmando que a sessao abriu." \
    --model gemini-3.8-flash-low --output-format json --print-timeout 0
```

Saida real (envelope json):

```json
{"conversation_id":"24fe84af-838e-4ef2-852d-ae902b2c34af","status":"SUCCESS","response":"Sessão iniciada com sucesso! Em que posso ajudar?","duration_seconds":3.36,"num_turns":1,"usage":{"input_tokens":16303,"output_tokens":3,"thinking_tokens":0,"cache_read_tokens":0,"total_tokens":16308}}
```

PASSA. A sessao abriu por fora, sem janela da IDE, com um comando inicial, e ja devolveu identificador de conversa, estado e consumo.

## Prova 2, enxergar

Comando:

```
agy -p "Em uma frase, diga o que o soma.js faz." \
    --model gemini-3.8-flash-low --output-format stream-json --print-timeout 0
```

Chegada real dos eventos, com o atraso medido ate a ponte perceber cada passo (evidencia em `prototipo-ponte/evidencia/saida-prototipo.txt`):

```
+4287ms init  modelo=gemini-3.8-flash-low  modo=request-review
+4391ms passo 0 user_input/DONE
+6774ms passo 1 agent_response/DONE uso=16355
+6774ms passo 2 tool/ACTIVE
+6799ms passo 2 tool/DONE
+8599ms passo 3 agent_response/ACTIVE   (primeiro pedaco de texto)
 ...   pedacos de texto a cada 25 ms ...
+9338ms passo 3 agent_response/DONE uso=2409
+9364ms result SUCCESS  uso_acumulado=18764
```

PASSA. A ponte acompanha a atividade ao vivo: passos do agente, chamadas de ferramenta, pedacos de texto, e no fim o consumo acumulado. Modelo, estado e consumo saem todos no proprio stream.

## Prova 3, aprovar pelo hook de ciclo de vida

Caminho suportado, como a OST mandou: hook `PreToolUse` registrado na pasta de teste em `.agents/hooks.json`, apontando para `pretool.mjs`. O hook e a ponte no ponto de decisao: percebe o pedido, grava o conteudo num arquivo local, espera a resposta do diretor vinda de fora (arquivo local, pois nesta OST nao ha nuvem, §A.6) e devolve a decisao ao `agy`.

Para provocar um pedido de verdade, a sessao recebeu a ordem de rodar um comando no shell (`run_command`), que cai na permissao em modo `request-review`.

### a) perceber e b) capturar: PASSAM

Conteudo REAL que o hook recebeu do `agy` no stdin (evidencia em `prototipo-ponte/evidencia/prova3-hook.log`):

```json
{
  "artifactDirectoryPath": "C:/Users/Henrique/.gemini/antigravity-cli/brain/96eaf185-...",
  "conversationId": "96eaf185-c64e-4dca-9c6d-29d50fd46bd4",
  "modelName": "gemini-3.8-flash-low",
  "stepIdx": 2,
  "toolCall": {
    "name": "run_command",
    "args": {
      "CommandLine": "echo prova-de-aprovacao",
      "Cwd": "C:\\Users\\Henrique\\a-fabrica-lab\\projeto-bobo",
      "IsDaemon": false,
      "WaitMsBeforeAsync": 5000,
      "toolAction": "Executing echo command",
      "toolSummary": "Echo approval proof"
    }
  },
  "transcriptPath": "C:/Users/Henrique/.gemini/antigravity-cli/brain/96eaf185-.../.system_generated/logs/transcript_full.jsonl",
  "workspacePaths": ["C:/Users/Henrique/a-fabrica-lab/projeto-bobo"]
}
```

A ponte percebe que ha pedido parado e captura o conteudo: a ferramenta (`run_command`), o comando exato (`CommandLine`), a pasta, um resumo legivel (`toolAction`, `toolSummary`) e a conversa. Da para montar a tela de aprovacao com isso.

Observacao sincera sobre o §A.4: o pedido traz o QUE sera feito e um resumo, mas nao traz, em campo proprio, o POR QUE, o IMPACTO e o RISCO estruturados. Esse texto, quando existe, vem no corpo da conversa (o `transcriptPath`), nao no payload do hook. A ponte teria de ler o transcript para enriquecer o pedido.

### c) responder por fora: RECUSAR passa, APROVAR nao

RECUSAR funciona de ponta a ponta. O diretor, por fora, escreveu a recusa e a sessao parou o comando e reportou. Saida real da sessao:

```
status: SUCCESS
resposta: "A execução do comando foi recusada pelo painel com a mensagem:
          > Diretor recusou pelo painel, demonstracao da prova 3."
```

APROVAR para a sessao executar NAO funciona no `agy` 1.3.3 em modo headless. O hook devolveu `{"decision":"allow","permissionOverrides":["command(echo prova-de-aprovacao)"]}` e, mesmo assim, o comando foi negado pelo motor de permissao. Saida real do stream (evidencia em `prototipo-ponte/evidencia/prova3-allow-negado-pelo-motor.ndjson`):

```json
{"event":"step_update","step_update":{"step_index":2,"state":"ERROR","step_type":"tool","tool_name":"run_command","tool_info":{"error":{"type":"TOOL_ERROR","message":"permission check failed for command \"echo prova-de-aprovacao\": user denied permission to run command..."}}}}
{"event":"result","result":{"status":"SUCCESS","response":"","denied_actions":[{"action":"command","display_name":"RunCommand"}]}}
```

Isolei a causa, com controle:

- Com o hook desligado e `--dangerously-skip-permissions`, o MESMO comando executa de verdade. Saida real do tool: `"output":"prova-de-aprovacao\r\n"`, resposta `"O comando foi executado"`. Ou seja, o comando em si funciona, o problema e so o caminho de aprovacao.
- Testei o grant nos dois formatos, `command(echo prova-de-aprovacao)` e `command(echo)`. Os dois foram ignorados, o resultado veio sempre com `denied_actions: command`.
- O `agy` ainda sugere no proprio stream: "a tool required the command permission that headless mode cannot prompt for, so it was auto-denied. Add an allow-rule under permissions.allow ... Alternatively, re-run with --dangerously-skip-permissions".

Onde esbarrou, com todas as letras: no modo headless, o `agy` 1.3.3 nao aceita a aprovacao caso a caso vinda do hook para liberar um comando. O `decision: allow` com `permissionOverrides` e ignorado pelo motor de permissao (comportamento conhecido e aberto no projeto do `agy`). As unicas formas de executar sao pre-autorizar em `permissions.allow` antes de comecar, ou usar `--dangerously-skip-permissions`, que libera tudo. As duas sao aprovacao automatica de fato, o que §A.6 proibe, porque a decisao tem de ser humana, por pedido.

Resumo da prova 3: a ponte CONSEGUE perceber o pedido, capturar o conteudo e RECUSAR por fora, tudo pelo caminho suportado. A ponte NAO consegue, hoje, APROVAR por fora um comando para a sessao seguir, sem cair em liberacao geral. A recusa protege, a aprovacao fina ainda nao fecha.

## Prova 4, comandar de novo

Dois turnos na mesma conversa, o segundo retomando pela id.

Turno 1:

```json
{"conversation_id":"b0cbd878-a7c4-4b0d-8194-5f209f31221e","status":"SUCCESS","response":"guardado.","num_turns":1}
```

Turno 2, retomando com `--conversation b0cbd878-...`:

```json
{"conversation_id":"b0cbd878-a7c4-4b0d-8194-5f209f31221e","status":"SUCCESS","response":"42","num_turns":2,"usage":{"cache_read_tokens":14257,"total_tokens":18571}}
```

PASSA. Mesma conversa (mesmo id), `num_turns` foi de 1 para 2, o contexto foi lembrado (respondeu 42) e o comando novo executou.

## O formato real dos dados, o que vira contrato do backend e do painel

Tudo abaixo e capturado de verdade do `agy`.

### Passo de atividade (stream-json)

```json
{"event":"step_update","step_update":{
  "conversation_id":"...","step_index":2,"state":"ACTIVE|DONE|ERROR",
  "step_type":"user_input|agent_response|tool|checkpoint",
  "tool_name":"run_command",
  "text_delta":"pedaco de texto quando e resposta",
  "tool_info":{"name":"run_command","parameters":{"CommandLine":"..."},"output":"...","error":{"type":"TOOL_ERROR","message":"..."}},
  "usage":{"input_tokens":...,"output_tokens":...,"total_tokens":...}
}}
```

O stream comeca com um `init` (traz `model`, `cwd`, lista de `tools` e `permission_mode`) e termina com um `result`.

### Pedido de aprovacao (stdin do hook PreToolUse)

O formato esta colado na prova 3: `toolCall.name`, `toolCall.args.CommandLine`, `toolCall.args.toolAction`, `toolCall.args.toolSummary`, `conversationId`, `workspacePaths`, `transcriptPath`. A resposta do hook no stdout e `{"decision":"allow|deny","reason":"...","permissionOverrides":["command(...)"]}`. O `deny` vale, o `allow` ainda nao libera comando em headless.

### Estado e fechamento (envelope json)

```json
{"conversation_id":"...","status":"SUCCESS|ERROR|CANCELED|WAITING|RUNNING",
 "response":"...","duration_seconds":...,"num_turns":...,
 "usage":{"input_tokens":...,"output_tokens":...,"thinking_tokens":...,"cache_read_tokens":...,"total_tokens":...}}
```

### Consumo

O consumo vem em TOKENS por turno e acumulado, dentro de `usage`, muito melhor que a porcentagem de cota da IDE. Da para medir consumo por tarefa de verdade, somando os `usage` dos turnos de uma conversa.

### Modelo

Vem no `init` do stream e em `agy models` (id e nome amigavel). Exemplos reais: `gemini-3.8-flash-low`, `gemini-3.1-pro-high`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`.

## O que o agy entrega pronto, e o que a ponte tera de montar

Pronto:
- Abrir sessao headless sem janela (`-p`).
- Atividade ao vivo em NDJSON (`--output-format stream-json`), com passos, ferramentas, texto, estado e consumo.
- Estado e fechamento num envelope json fechado.
- Consumo em tokens, por turno e acumulado.
- Lista de modelos (`agy models`).
- Retomar conversa pela id (`--conversation`, `-c`) e mandar comando novo.
- Gancho de ciclo de vida `PreToolUse` que entrega o pedido de ferramenta e aceita `deny` por fora.
- Fila e id de conversa ja prontos, a ponte nao precisa inventar correlacao.

A ponte tera de montar:
- A captura do pedido de aprovacao com o POR QUE, IMPACTO e RISCO, lendo o `transcriptPath`, porque o payload do hook so traz o QUE e um resumo.
- A trilha de comando e aprovacao com hora e origem (§A.6), gravando cada pedido e cada resposta.
- O caminho de APROVAR por fora, que hoje o agy headless nao fecha. Ver limitacoes.
- A normalizacao dos `usage` em consumo por tarefa e por dia.
- O laco de vida da sessao: abrir, acompanhar o stream, detectar `WAITING`, parear com a fila de aprovacao.

## Limitacoes reais encontradas

1. Aprovacao fina por fora nao fecha no agy 1.3.3 headless. `deny` pelo hook funciona, `allow` com `permissionOverrides` e ignorado. Executar so com pre-autorizacao em `permissions.allow` ou com `--dangerously-skip-permissions`, ambos aprovacao automatica, o que §A.6 proibe. Esta e a limitacao que mais pesa para a Onda 2.
2. O pedido de aprovacao do hook nao traz impacto e risco estruturados, so o QUE e um resumo. O resto esta no transcript, a ponte tera de ler e montar.
3. Custo fixo de cerca de 3 segundos para subir cada sessao headless. Bom para tarefas, ruim se alguem esperar resposta instantanea de um comando curto.
4. O hook roda ate sob `--dangerously-skip-permissions`, e o `deny` dele vence. Isso e bom para seguranca, mas significa que a ponte precisa sempre responder, senao trava no timeout.

## Atraso medido entre a sessao agir e a ponte perceber

Medido de verdade no stream (saida colada na prova 2):

- Subir a sessao ate o primeiro evento `init`: cerca de 3 a 4 segundos, custo fixo por invocacao.
- Depois que o agente comeca a agir, cada passo e cada pedaco de texto chega na ponte em 25 a 100 milissegundos.
- Na prova 3, o hook gravou o pedido de aprovacao assim que a ferramenta foi chamada, e a ponte percebeu em menos de meio segundo (intervalo de polling que a ponte escolhe, pode ser menor).

Conclusao de latencia: da para ter tela ao vivo de verdade. A atividade chega em tempo real pelo stream. O unico atraso perceptivel e o arranque de cada sessao, nao o acompanhamento.

## Recomendacao do agente ponte

Conforme a OST, NAO altero o CLAUDE.md nesta OST. Fica so o registro do que funciona de fato, para embasar a proposta de revisao da constituicao numa proxima OST:

- Provas 1, 2 e 4 provam que a ponte, por fora e via `agy`, abre sessao, enxerga ao vivo e comanda de novo. O eixo "enxergar e comandar" da fabrica esta de pe.
- A prova 3 mostra que "perceber, capturar e recusar" funcionam, mas "aprovar por fora caso a caso" ainda nao, por limite do `agy` headless. A Onda 2, que depende de aprovar por fora, precisa resolver isso antes, e esse e o item a investigar em seguida: acompanhar a evolucao do `agy` nesse ponto, ou achar o caminho suportado de grant por pedido.

## Como reproduzir

```
node prototipo-ponte/ponte-poc.mjs
```

Roda as quatro provas em sessao viva e imprime a saida real. O hook de aprovacao esta em `prototipo-ponte/pretool-hook.mjs`, registrado pelo exemplo `prototipo-ponte/hooks.json.exemplo`, que na prova viveu na pasta de teste `a-fabrica-lab/projeto-bobo/.agents/`. As evidencias estao em `prototipo-ponte/evidencia/`.

---

# Spike da aprovacao invertida (OST 1, Parte 2, tarefa 2)

Agente responsavel: ponte. Seguranca audita ao final. Sessao viva com `agy` 1.3.3, cota autorizada. Pasta cobaia `a-fabrica-lab/projeto-bobo`.

## Hipotese testada
Como o hook sabe recusar com confiabilidade, invertemos a logica: pre-autoriza no `agy` o necessario para ele nao travar sozinho, e o hook `PreToolUse` passa a ser o PORTAO que segura toda chamada de risco, grava o pedido na fila, espera a resposta do diretor e so entao deixa passar ou recusa. O `agy` deixa de decidir, o hook decide. Nada anda sem resposta do diretor.

## Como a pre-autorizacao ficou fora da config global (§A.9)
O achado de permissao: em headless, o `agy` 1.3.3 ignora `permissions.allow` em `antigravity-cli/settings.json` e ignora o `allow` do proprio hook (os dois sao soft-denied). A unica pre-autorizacao que funciona e um grant em `config.json`, em `userSettings.globalPermissionGrants.allow`, com padrao regex.

Para nao tocar a config global do diretor, rodei o `agy` com o HOME apontado para uma pasta descartavel, `a-fabrica-lab/agy-home-teste`. A autenticacao sobreviveu, porque fica no gerenciador de credenciais do Windows, nao no perfil. Entao todo o grant vive no config descartavel, e o `~/.gemini` real do diretor nao e tocado. Confirmei: `agy models` autenticado com HOME relocado, e o comando executa com o grant so no sandbox.

Grant usado, no sandbox:

```json
{ "userSettings": { "globalPermissionGrants": { "allow": ["command(regex:echo.*)"] } } }
```

## Os cinco resultados, saida real

Saida consolidada do protótipo `prototipo-ponte/ponte-inversao.mjs` (em `prototipo-ponte/evidencia/saida-inversao.txt`):

```
EXECUTOU   aprovar                executou
bloqueado  recusar                diretor recusou
bloqueado  falha-sem-resposta     Sem resposta do diretor no tempo. Negado por seguranca.
bloqueado  falha-malformada       Resposta malformada. Negado por seguranca.
EXECUTOU   hook-ausente(furo)     EXECUTOU sem o diretor
```

### 1. Aprovar por fora executa. PASSA.
O que faltava na Parte 2. Diretor aprova por fora, o hook devolve `allow`, e o comando executa de verdade. Saida real (`evidencia/inv1-aprovar-executa.ndjson`):

```
"output":"prova-de-aprovacao\r\n"
response: "O comando foi executado com sucesso:\n\n```\nprova-de-aprovacao\n```"
```

### 2. Recusar por fora nao executa. PASSA.
Diretor recusa, o comando e bloqueado: `tool call denied by pre-tool hook: diretor recusou`.

### 3. Falha fechada, testada de proposito.
Em todos os casos abaixo, com o hook presente, a chamada foi RECUSADA e nada executou:

- Sem resposta (tempo esgotado): `Sem resposta do diretor no tempo. Negado por seguranca.`
- Resposta malformada (JSON invalido): `Resposta malformada. Negado por seguranca.`
- Hook morto no meio da espera: matei o processo `node` do hook durante a espera. O `agy` bloqueou. Saida real (`evidencia/inv-p3c-hook-morto.ndjson`): `"A execução do comando foi bloqueada pelo hook de pré-execução do ambiente"`.

O hook falha fechado por construcao: stdin ilegivel, resposta ausente, resposta malformada, decisao desconhecida, tempo esgotado e excecao, tudo cai em `deny`.

MAS existe um caminho de FALHA ABERTA, e e o achado grave do spike:

- Hook AUSENTE com o pre-grant ativo: removi o `hooks.json` e rodei. O comando EXECUTOU SEM o diretor responder. Saida real (`evidencia/inv-p3d-hook-ausente.ndjson`): `"output":"prova-de-aprovacao\r\n"`.

Ou seja, o pre-grant e uma permissao permanente. Enquanto o hook esta de pe, ele segura tudo e falha fechado. Se o hook nao roda, por remocao, pasta sem trust, ou erro de registro, a pre-autorizacao sozinha deixa passar o que foi pre-concedido, sem o diretor. A seguranca da inversao depende de o hook SEMPRE rodar, o que o `agy` nao garante.

### 4. Espera longa. PASSA.
A sessao sobreviveu a uma espera de 140 segundos ate a resposta do diretor, e executou depois. Medido: passo da ferramenta parado por 147 s, total 151 s. O teto e o `timeout` do hook em `hooks.json`, que coloquei em 600 s. Da para esperar minutos, compativel com o diretor respondendo pelo celular.

### 5. O pedido capturado traz o que a tela precisa? PARCIAL.
O pedido traz o QUE e um resumo curto, mas nao o POR QUE, o IMPACTO e o RISCO estruturados. Conteudo real capturado:

```json
{
  "ferramenta": "run_command",
  "comando": "echo prova-de-aprovacao",
  "args": { "CommandLine": "echo prova-de-aprovacao", "Cwd": "...projeto-bobo",
            "toolAction": "Executing command", "toolSummary": "Echo command" },
  "conversationId": "...",
  "workspacePaths": ["...projeto-bobo"],
  "transcriptPath": ".../transcript_full.jsonl"
}
```

Para a tela mostrar por que e qual o impacto, a ponte tera de ler o `transcriptPath` e compor. O payload do hook sozinho nao basta para o pacote do §A.4.

## Atraso e tempo parado
Percepcao do pedido pela ponte: abaixo de meio segundo. Tempo parado esperando o diretor: o que o diretor levar, ate o teto de `hooks.json` (600 s no teste, pode subir). A sessao nao morre na espera.

## Recomendacao do agente ponte
A inversao resolve o que faltava: aprovar por fora passa a executar, e recusar, timeout e malformada falham fechado. Mas o pre-grant abre um furo: se o hook nao rodar, o pre-autorizado executa sem o diretor. Portanto a Onda 2 PODE ser construida sobre a inversao, com duas condicoes duras:

1. Pre-grant minimo. Conceder o menos possivel, e nunca `command(*)` nem regex amplo. Quanto menor o pre-grant, menor o estrago se o hook cair.
2. Garantia de que o hook roda. A ponte tem de recusar abrir qualquer sessao sem confirmar que o hook esta registrado, a pasta esta trusted e o portao responde. Se nao conseguir confirmar, nao abre a sessao.

Proposta para o §A.6, como proposta, sem alterar o arquivo agora:

- Registrar a regra da falha fechada: toda chamada de risco e negada por padrao e so executa com resposta explicita do diretor; qualquer erro, ausencia, malformacao ou tempo esgotado e recusa.
- Registrar o limite do pre-grant: a pre-autorizacao concedida ao agente de execucao e minima e auditada, e a ponte nao abre sessao sem o portao ativo, porque o pre-grant sem portao executa sem o diretor.


## Parecer de seguranca (agente seguranca)

### Veredito: VETADO

Existe um caminho provado em que uma chamada de risco EXECUTA sem o diretor ter respondido, o que fere a regra dura do §A.6 ("Nao existe aprovacao automatica nesta versao").

Caminho de risco, com evidencia: hook ausente com pre-grant ativo. Em `evidencia/inv-p3d-hook-ausente.ndjson` o `run_command` executou (`"output":"prova-de-aprovacao\r\n"`, result SUCCESS) sem nenhum `resposta.json` consultado. O pre-grant em `userSettings.globalPermissionGrants.allow` e uma permissao permanente; o portao e o hook; se o hook nao roda (remocao do hooks.json, pasta sem trust, falha de registro), o pre-grant sozinho libera o pre-concedido, sem o diretor.

Caminhos que falham fechado, verificados pela seguranca (nao sustentam o veto, mas ficam no registro): hook morto no meio da espera (bloqueado), sem resposta no tempo (deny), resposta malformada (deny), decisao desconhecida ou ausente (deny). Com o hook presente, nada executa sem resposta.

Observacoes secundarias da seguranca, que nao sao base do veto: pacote de aprovacao do §A.4 incompleto (falta por que, impacto e risco, que estao no transcript); amplitude do pre-grant (regex largo ou `command(*)` tornaria o furo catastrofico); §A.9 preservado no spike, com o grant isolado no HOME descartavel.

### Condicoes para reavaliacao (aprovado condicional)
O veto cai se, e so se, todas forem satisfeitas e provadas por evidencia:

1. Garantia de portao antes de abrir sessao: a ponte recusa abrir fabrica sem confirmar, no ato, que o hook esta registrado, a pasta trusted e o portao respondeu a um teste vivo.
2. Pre-grant minimo, por recurso, nunca `command(*)` nem regex largo.
3. Verificacao continua do portao durante a sessao, nao so na abertura.
4. Isolacao do grant fora da config real do diretor em producao, mantendo §A.9.
5. Completar o pacote do §A.4 lendo o `transcriptPath`.

## Conclusao da ponte, reconciliada com o veto
A inversao prova que aprovar por fora executa e que, com o hook presente, tudo falha fechado. Mas a seguranca VETOU a inversao como base da Onda 2 enquanto o furo do hook ausente puder executar um pre-concedido sem o diretor. Portanto: a Onda 2 NAO deve ser construida sobre a inversao ainda. O caminho e atacar as cinco condicoes, com a numero 1 (garantia de portao antes de abrir, e recusar abrir sem portao) e a numero 2 (pre-grant minimo) como as que fecham o furo principal. So depois disso, com a evidencia na mao, vale propor a revisao do §A.6.
