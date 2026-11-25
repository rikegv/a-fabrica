# OST 13, contrato entre ponte e painel

Quem escreveu: o coordenador, 24/11/2026, antes de despachar o time. Este arquivo é a fonte única do que a ponte grava e do que o painel lê nesta OST.

## Onda 0, resultado

Esta sessão abriu em `C:\Users\Henrique\a-fabrica`, a raiz. O portão rodou: um texto inofensivo com as palavras de push foi bloqueado pelo `gate-deploy.sh`, e `scripts/prova-gate.sh` passou inteiro. Na base, a fábrica desta sessão aparece com projeto `C:\Users\Henrique\a-fabrica` e oito agentes. A sessão anterior, que aparecia como "painel", tinha sido aberta mesmo dentro de `painel/`, então a tela estava certa para ela. Não há conserto de tela a fazer no item 1.

Cuidado achado no caminho: o gancho grava o `cwd` de cada evento. Se um agente deixa o terminal parado dentro de `painel/` ou `ponte/`, os eventos seguintes saem com a subpasta. A ponte já não sobrescreve o projeto, mas todo agente desta OST usa subshell (`(cd painel && ...)`) e não deixa o terminal fora da raiz.

## Diagnóstico dos defeitos da Onda 1

### Item 2, o chat só mostra três pontinhos

Três causas, todas medidas no código e na fila real:

1. A tela lê só os últimos 200 passos da atividade. Numa sessão longa (a do SOUsystem tem 800), as ordens do diretor e as respostas ficam fora da janela, e o chat fica vazio.
2. Os três pontinhos ficam acesos para sempre. Depois de cada `Stop`, o Claude Code manda um `Notification` e um `SubagentStop` sem nome de agente (o resumo automático da sessão). A ponte traduz o `SubagentStop` com estado `em execucao`, e a fábrica volta a parecer viva. No painel, o `montarTime` acha que o coordenador não parou porque a última linha não é a resposta.
3. A resposta do coordenador entra como ação "Respondeu" no cartão dele, repetindo o que é do chat.

### Item 3, "0 agentes no time"

A ponte lê `.claude/agents` exatamente da pasta que veio na linha do gancho. Sessão aberta numa subpasta (ou a primeira linha vista pela ponte vindo de uma subpasta) não acha pasta nenhuma. O Claude Code acha os agentes subindo de pasta em pasta até a raiz do projeto; a ponte tem de fazer o mesmo.

## O que a PONTE faz

Arquivos: `ponte/src/**`. Fora de alcance nesta OST: `ponte/ganchos/gancho.cjs`, `ponte/ganchos/ligar.ps1`, `ponte/instalar.ps1`, qualquer coisa de Linux (§A.25, a nuvem trabalha nisso).

P1. `SubagentStart` e `SubagentStop` não mudam o estado da fábrica (estado `null`). O agente principal já está em execução quando um subagente roda; o resumo automático depois do `Stop` não pode reacender a fábrica.

P2. `lerAgentesDoProjeto(cwd)` sobe de pasta em pasta a partir do `cwd` até achar `.claude/agents`, parando na pasta do usuário (não lê a pasta `.claude/agents` do próprio usuário como se fosse do projeto) e na raiz do disco. A ponte usa, de preferência, o `projeto` já gravado na fábrica.

P3. Fechamento. Quando chega um `Stop` da sessão principal (fábrica aberta na mão) ou a resposta final de uma rodada da fábrica aberta pelo painel, a ponte aplica o critério abaixo ao texto. Se for fechamento, grava um documento em `relatorios`.

Texto inteiro: o gancho corta a resposta em 4000 caracteres, e fechamento real passa disso (o da OST 12 tem 5208). Para a fábrica aberta na mão, e SOMENTE quando a linha do gancho veio com `conteudo: true`, a ponte abre a transcrição e pega o texto da última mensagem do assistente da sessão principal (não `isSidechain`) que termina a rodada. Ela confere que esse texto começa com o mesmo trecho que o gancho entregou (sem o `[...cortado]`). Se não bater, grava o texto do gancho e marca `cortado: true`. A máscara de credencial roda antes de gravar. Sem `conteudo: true`, não existe fechamento: nada de texto sai.

P4. Diário. Um por fábrica, por dia do calendário de Brasília (UTC menos 3, sem horário de verão), gerado pela ponte na primeira passada depois das 20h00 de Brasília. Fábrica sem atividade no dia não gera. Se a máquina estiver dormindo às 20h, a ponte gera assim que acordar, para o dia que ficou para trás (até 7 dias), e o documento diz a hora em que foi gerado. Conteúdo: os fechamentos do dia, inteiros; o que ficou pendente (a seção "o que ficou faltando" de cada fechamento, copiada sem reescrever); o tempo (soma das rodadas do dia, do comando do diretor ao fim da rodada); o consumo do dia. Para o consumo do dia, a ponte passa a somar, junto com o consumo total, um campo `consumoPorDia` na fábrica, chave `AAAA-MM-DD` de Brasília. Dia sem medição diz "não medido", não inventa.

P5. Depois de compilar e provar, a ponte é reiniciada pela fábrica (§A.24), conferindo antes que nenhuma fábrica aberta pelo painel está trabalhando.

### Documento `relatorios/{id}`

A regra publicada já permite: criar uma vez, com `criadoEm == request.time`, sem atualizar nem apagar. Nenhuma regra nova, nenhum índice novo, nada a publicar.

Comuns:

| campo | tipo | o quê |
|---|---|---|
| `tipo` | `'fechamento'` ou `'diario'` | |
| `fabricaId` | texto | |
| `maquinaId` | texto | |
| `projeto` | texto ou null | caminho da raiz do projeto, como na fábrica |
| `titulo` | texto ou null | nome da fábrica, se tiver |
| `texto` | texto | o fechamento inteiro, ou o diário montado, já mascarado |
| `criadoEm` | hora do servidor | |
| `versao` | 1 | |

Fechamento, a mais:

| campo | o quê |
|---|---|
| `id` | `fech-<fabricaId>-<hash curto da sessão e da hora do fim da rodada>`, sem o texto, para a mesma rodada nunca gravar duas vezes (condição da segurança: com o texto no hash, a rodada lida uma vez pelo gancho e outra pela transcrição viraria dois documentos) |
| `rodadaInicio`, `rodadaFim` | ISO, hora do gancho ou da ponte |
| `dia` | `AAAA-MM-DD` de Brasília do fim da rodada |
| `origem` | `'mao'` ou `'painel'` |
| `fonteDoTexto` | `'transcricao'`, `'gancho'` ou `'kit'` |
| `cortado` | verdadeiro quando não deu para ter o texto inteiro |
| `marcas` | lista dos grupos do critério que o texto tem |

Diário, a mais:

| campo | o quê |
|---|---|
| `id` | `diario-<fabricaId>-<AAAA-MM-DD>` |
| `dia` | `AAAA-MM-DD` de Brasília |
| `fechamentos` | lista de `{ relatorioId, rodadaFim }` |
| `pendencias` | lista de textos, copiados das seções de pendência |
| `rodadas` | número de rodadas no dia |
| `tempoMs` | soma das rodadas do dia, ou null |
| `consumoDoDia` | objeto de tokens do dia, ou null quando não medido |
| `geradoAtrasado` | verdadeiro quando foi gerado depois do dia seguinte começar |

Antes de criar, a ponte lê o documento pelo id; se já existe, não escreve.

## Critério do fechamento, item 13

Escolha do coordenador, e é isto que o tester prova com fábrica real.

Uma mensagem é fechamento quando TODAS valem:

1. É o fim de rodada da sessão PRINCIPAL. `Stop` na fábrica aberta na mão, nunca `SubagentStop`, nunca linha com nome de subagente. Na fábrica do painel, o texto final da rodada do agente principal, nunca texto de subagente.
2. Não é aviso automático (`<task-notification>`, `<system-reminder>`) e não é o comando do diretor.
3. Tem os títulos do §A.16 COMO TÍTULO: no começo de uma linha, com ou sem `#`, `**` ou número na frente, e seguido de `:`, `.`, `**` ou fim de linha. Menção no meio de frase não conta. Os grupos, sem diferença de maiúscula e acento:
   - FEITO: "o que foi feito"
   - FALTA: "o que ficou faltando", "o que falta", "o que ficou pendente", "pendências"
   - PEDIDO: "o que foi solicitado", "o que foi pedido"
   - DECISOES: "decisões tomadas", "decisões que tomei", "decisões"
   - ARQUIVOS: "arquivos e áreas alteradas", "arquivos alterados"
   - PROBLEMAS: "problemas encontrados"
   - PROXIMO: "próximo passo"
   - QUEM: "quem trabalhou", "quem fez o quê", "quem fez"
4. Tem FEITO e FALTA, e pelo menos mais dois grupos.

Por que assim: os títulos são o formato que o diretor exige em todo fechamento (§A.15 e §A.16), então a regra lê o próprio contrato. Exigir o título no começo de linha impede que uma resposta qualquer que cite "o que falta" no meio da frase vire relatório. Exigir quatro grupos impede que uma resposta parcial ("o que foi feito até agora") vire relatório. O que não é fechamento continua no chat, inteiro.

Erro do critério que se aceita: um fechamento escrito fora do formato não vira relatório. O diretor vê o texto no chat, e a regra pede o formato de qualquer jeito.

## Revisão do desenho pela segurança

Primeira passagem do agente de segurança, antes do código: aprovado com condições, sem veto. As condições foram repassadas ao pé da letra aos agentes ponte e frontend. Resumo: a transcrição só é aberta quando o gancho cortou a resposta, com o caminho conferido, só blocos de texto do assistente principal, conferência exata do trecho, tetos de 8 MB lidos e 200.000 caracteres, máscara antes de gravar e nenhum texto fora da base; o critério só se aplica ao fim de rodada principal; o id do fechamento não depende do texto; a marca da fila só anda depois de o relatório existir; o painel mostra todo texto como texto puro, sem HTML montado a partir dele. Divergência registrada: o comentário de `ponte/ganchos/gancho.cjs` que diz que a ponte não abre a transcrição para tirar texto fica falso, e o gancho não é mexido nesta OST.

## O que o PAINEL faz

Arquivos: `painel/src/**`, `painel/app/**`.

Chat (item 2):
- lê a conversa numa consulta própria, só dos passos de conversa (`tipo` em `['comando do diretor', 'fim de rodada', 'texto', 'agent_response', 'user_input']`), sem limite de 200, e junta com os comandos do painel; ordena no próprio painel. Consulta com um único `where ... in`, sem `orderBy`, para não pedir índice composto (índice novo é produção).
- mostra o que o diretor mandou e o que o coordenador respondeu, inteiro, com rolagem; avisos automáticos não entram como "Você".
- os três pontinhos só acendem quando a fábrica está em execução E a última coisa da conversa é ordem do diretor sem resposta depois dela (ou passo do time depois da última resposta). Aviso automático e resumo automático depois da resposta não acendem.
- a resposta sai do cartão do coordenador; o cartão mostra o que ele fez (ferramentas, delegações).

Disposição (Onda 2): linha fina no topo (nome, situação, consumo, botões, sem título grande); esquerda um terço com o chat de cima a baixo e a caixa embaixo; direita dois terços com o coordenador no topo em largura inteira e os agentes embaixo em grade de três por linha, com as linhas de luz; cada cartão com as últimas ações (várias); rodapé atual; sem parágrafo explicativo no meio; celular como está, chat em cima e time embaixo.

Relatórios (Onda 3): aba "Relatórios" dentro de cada fábrica (fechamentos e diários dela, mais novo em cima, texto inteiro, sem resumir); menu lateral "Relatórios" juntando todas, com filtro por fábrica e por data. Consulta: `relatorios` com `where('fabricaId','==',id)` sem `orderBy` na aba; `orderBy('criadoEm','desc')` com limite no menu, filtro por fábrica e data no próprio painel, e consulta por faixa de `criadoEm` quando a data pedida está fora do que foi carregado. Toda falha aparece na tela (§A.22). Nada de travessão (§A.11).
