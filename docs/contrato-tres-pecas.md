# Contrato das tres pecas (OST 3, Parte 2, Passo 1)

Agente responsavel: arquiteto. Nao implementa, define o contrato. Base no formato real dos dados provado nas OST 1 e 2 (`docs/prova-ponte.md`).

Este contrato liga as tres pecas do §A.3: painel escreve na base, ponte le e executa; ponte escreve na base, painel le e mostra. O painel nao fala direto com a fabrica. Cobre o §A.4: maquina, fabrica, tarefa, atividade, comando, aprovacao, relatorio.

Entregue cedo, para backend e ponte trabalharem em paralelo sem travar um esperando o outro.

## Principio de propriedade de escrita

Cada documento tem um unico dono de escrita. O outro lado so le. Isto evita corrida e deixa as regras do Firestore simples e duras.

| Colecao | Quem escreve | Quem le |
| --- | --- | --- |
| maquinas | ponte | painel |
| fabricas | ponte | painel |
| fabricas/{id}/tarefas | ponte | painel |
| fabricas/{id}/atividade | ponte (so adiciona) | painel |
| comandos | painel (diretor) escreve; ponte marca entregue | ambos |
| aprovacoes | ponte escreve o pedido; painel escreve a resposta | ambos |
| relatorios | ponte | painel |

Regra de ouro do fluxo, em dados: o painel nunca chama a fabrica. Para mandar algo, o painel escreve em `comandos` ou na resposta de `aprovacoes`. A ponte le isso e executa. A ponte escreve atividade, estado e pedidos; o painel le e mostra.

## Colecoes e documentos

### maquinas/{maquinaId}
Identidade da maquina e sinal de vida. Escrita so pela ponte daquela maquina.
```
{
  maquinaId: string,              // id estavel, gerado no pareamento da instalacao
  nome: string,                   // nome amigavel, ex. "notebook do diretor"
  estadoPonte: "online" | "offline",
  vistoPorUltimo: Timestamp,      // heartbeat, atualizado a cada N segundos
  versaoPonte: string,
  pareadoEm: Timestamp
}
```
Offline, §A.10: se `vistoPorUltimo` ficar velho alem do limite, o painel mostra ponte offline. A propria ponte, ao parar de forma limpa, grava `estadoPonte: "offline"`. O painel nunca diz em execucao quando o heartbeat esta velho.

### fabricas/{fabricaId}
Uma sessao de agente viva, aberta pela ponte via agy. Escrita so pela ponte.
```
{
  fabricaId: string,
  maquinaId: string,              // de qual maquina, para parear a fila
  conversationId: string,         // id da conversa do agy, para retomar
  projeto: string,                // pasta de projeto sobre a qual roda
  agente: string,
  modelo: string,                 // ex. gemini-3.8-flash-low ou claude-sonnet-4-6
  estado: "em execucao" | "aguardando aprovacao" | "aguardando comando" | "concluida" | "falhou" | "ponte offline",
  inicio: Timestamp,
  tempoDecorridoMs: number,
  consumo: {                      // vem do usage do agy, acumulado
    inputTokens: number, outputTokens: number, thinkingTokens: number,
    cacheReadTokens: number, totalTokens: number
  },
  atualizadoEm: Timestamp
}
```

### fabricas/{fabricaId}/tarefas/{tarefaId}
Tarefa delegada dentro de uma fabrica. Escrita so pela ponte.
```
{ tarefaId: string, titulo: string, situacao: "em andamento" | "concluida" | "falhou", criadaEm, atualizadaEm }
```

### fabricas/{fabricaId}/atividade/{seq}
Cada passo que a fabrica da, em ordem de tempo. So adiciona, nunca altera. Vem direto do stream-json do agy (evento step_update).
```
{
  seq: number,                    // ordem
  stepIndex: number,
  tipo: "user_input" | "agent_response" | "tool" | "checkpoint",
  estado: "ACTIVE" | "DONE" | "ERROR",
  ferramenta: string | null,      // tool_name quando tipo tool
  textoDelta: string | null,      // pedaco de texto quando agent_response
  toolInfo: object | null,        // name, parameters, output, error
  consumoParcial: object | null,  // usage quando disponivel
  em: Timestamp
}
```

### comandos/{comandoId}
Ordem escrita pelo diretor pelo painel. Escrita pelo painel; a ponte so marca entregue. Trilha com hora e origem, §A.6.
```
{
  comandoId: string,
  fabricaId: string,
  maquinaId: string,
  texto: string,                  // o comando em linguagem natural, vira prompt do agy
  situacao: "pendente" | "entregue",
  criadoEm: Timestamp,            // hora, nao editavel depois
  origem: string,                 // quem e de onde, ex. email do diretor mais dispositivo
  entregueEm: Timestamp | null    // so a ponte escreve, uma vez
}
```
Idempotencia, §A.6/Passo 4: a ponte so entrega um comando com `situacao: "pendente"`, e numa transacao marca `entregue` antes de executar. Se a conexao cair, o comando continua pendente e e reentregue; o marcador impede executar duas vezes.

### aprovacoes/{aprovacaoId}
Pedido da fabrica e resposta do diretor. A ponte escreve o pedido com o pacote completo da OST 2; o painel escreve a resposta. Trilha imutavel.
```
{
  aprovacaoId: string,
  fabricaId: string,
  maquinaId: string,
  pacote: {                       // formato aprovado na OST 2, marcando fato e deducao
    oQue: {valor, origem:"fato"},
    resumo: {valor, origem:"fato"},
    tarefa: {valor, origem:"fato"},
    fabrica: {valor, origem:"fato"},
    agenteDisse: {valor, origem:"fato"},
    porQue: {valor, origem:"ponte"},
    impacto: {valor, origem:"ponte"},
    oQueSeraTocado: {valor, origem:"fato mais leitura da ponte"},
    risco: {valor:"baixo"|"medio"|"alto", origem:"ponte"},
    tempoParadoMs: {valor, origem:"fato"}
  },
  situacao: "pendente" | "respondida",
  criadoEm: Timestamp,            // hora do pedido, imutavel
  origem: string,
  resposta: "aprovado" | "recusado" | "aprovado com observacao" | null,
  observacao: string | null,
  respondidoEm: Timestamp | null, // so o painel escreve, uma vez
  respondidoPor: string | null    // origem da resposta, para a trilha
}
```
A ponte observa `aprovacoes` da sua fabrica; ao ver `situacao: "respondida"`, devolve ao portao da OST 2 o allow ou deny correspondente. Falha fechada: sem resposta, o portao recusa.

### relatorios/{relatorioId}
Fechamento por tarefa e consolidado diario, §A.16. Escrita so pela ponte.
```
{ relatorioId, tipo:"tarefa"|"diario", fabricaId, conteudo: {solicitado, feito, faltou, decisoes, arquivosAreas, problemas, proximoPasso}, criadoEm }
```

## O que a ponte escreve e o que le

Escreve: heartbeat em `maquinas`; `fabricas` com estado, modelo e consumo; `atividade` ao vivo; pedido em `aprovacoes`; `relatorios`; marca `comandos.entregue` e `aprovacoes` consumidas.

Le: `comandos` pendentes da sua `maquinaId`; respostas em `aprovacoes` da sua `maquinaId`.

Tudo por conexao de saida, §A.6. A ponte nunca abre porta. O SDK do Firestore fala com a nuvem por saida, inclusive os ouvintes ao vivo (listeners), que sao conexao de saida persistente, nao porta de entrada.

## Pareamento de maquina, base para a regra do Firestore

Toda fila, `comandos` e `aprovacoes`, carrega `maquinaId`. A ponte so le e escreve documentos da sua propria `maquinaId`, definida no pareamento da instalacao. A regra do Firestore nega acesso a fila de maquina que nao seja a do pedido. Como ha conta unica, o principal e sempre o diretor; o `maquinaId` escopa qual maquina, e o pareamento e dono do diretor. Ponto de atencao para a seguranca: sob conta unica, a separacao por maquina e escopo logico, nao isolamento entre pessoas, porque so existe uma pessoa. A protecao dura e a conta unica com segundo fator e a regra que nega todo o resto.

## Formato de origem dos dados, ja provado

Atividade, modelo e consumo vem do stream-json do agy (eventos init, step_update, result), provado na OST 1. O pacote de aprovacao vem do hook PreToolUse mais o transcript, provado na OST 2. Este contrato apenas acomoda esses formatos nas colecoes acima, sem reabrir o que ja foi provado.

## Dependencias e paralelismo
Com este contrato fechado, backend e ponte seguem em paralelo. O backend e dono das colecoes e das regras; a ponte e dona de escrever e ler conforme a tabela de propriedade. O unico ponto de sincronismo e este documento. Falta, para backend e ponte concluirem e serem provados ao vivo, o identificador do projeto Firebase, que o diretor informa, e a autenticacao unica do diretor na instalacao.
