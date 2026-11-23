# OST 10: o painel passa a mostrar o que a fábrica faz, 23/11/2026

Agente: coordenador, sozinho, em todas as partes: investigação, ponte, gancho, painel, provas e este relatório. Nenhum subagente foi chamado.

## O que foi pedido
A validação do diretor na tela: "não está claro a ordem de execução, e os comandos que eu dei não aparecem".
- **Onda 1.** Três defeitos do posto de comando:
  - lista fora de ordem;
  - "3 passos registrados" com 6 na lista;
  - toda linha dizendo "Deu um passo".
- **Onda 2.** Liberar o conteúdo de todos os projetos e registrar a decisão. Confirmar a versão da ponte no ar.
- **Onda 3.** A tela tem de servir para acompanhar:
  - cada linha diz o que aconteceu;
  - as ordens dele aparecem destacadas, com o que veio em resposta;
  - ordem cronológica declarada;
  - histórico completo;
  - subagente identificado.
- **Onda 4.** Commit e push no ramo, painel pronto para a tela local, e o comando de publicação escrito, sem publicar.
- **Acréscimo.** Cartão e nome automático com data quando a fábrica é de outro dia.

## Onda 1, a causa de cada defeito
A tela que o diretor mandou era da fábrica `painel-95374cd0...`, "Fabrica teste Testando", aberta **pelo painel** no projeto-cc. Ela tinha 2 ordens dele e 8 passos na base. Conferido na base real, só leitura.

### 1. Fora de ordem
A tela pedia os 6 passos de `seq` mais alto. O `seq` é o número do passo, e ele **recomeça do zero a cada comando**:
- na fábrica aberta pelo painel (`ponte/src/sessao.ts`, `let seq = 0` a cada execução);
- na fábrica aberta na mão a cada retomada da sessão, porque a marca morria com o arquivo da fila.

Com dois comandos, havia dois passos de seq 3, dois de seq 2 e dois de seq 1. A consulta trazia os dois de seq 3 juntos no topo, um das 15:39 e outro das 15:34. Foi exatamente o que ele viu: 15:39, 15:34, 15:34, 15:39, 15:34, 15:38.

**Conserto:**
- **Painel.** A tela ordena pela hora em que o servidor gravou o passo, que é única e só cresce.
- **Ponte.** A fábrica aberta na mão não recomeça mais o `seq` na retomada: a sequência fica guardada por fábrica, como a marca da transcrição do bloco C.

### 2. Os números não batiam
O quadro "Passos" mostrava o `seq` do passo do topo, que era 3, com 8 gravados. **Conserto:** o quadro e a contagem da aba passaram a ser a contagem feita pelo próprio servidor da base.

### 3. "Deu um passo" em tudo
O tradutor do painel esperava nomes de passo de outra versão do kit (`user_input`, `agent_response`, `tool`, `checkpoint`). A ponte nunca gravou esses nomes:
- a fábrica aberta pelo painel grava `init`, `texto`, `pensamento`, `ferramenta`, `resultado` e `fim`;
- a aberta na mão grava `comando do diretor`, `ferramenta`, `subagente`, `fim de rodada` e os outros.

Nenhum nome casava, e tudo caía na frase padrão. Além disso, a fábrica aberta pelo painel gravava só o tipo e o nome da ferramenta: sem texto, sem arquivo, sem agente.

**Conserto:** tradutor novo, e a ponte passou a gravar o que faltava, como está na Onda 3.

### A pergunta: a fábrica do a-fabrica, liberada, já mostrava detalhe?
**Não. Ela também mostrava só "Deu um passo" em toda linha.**

O conteúdo dela chegava na base: comando, arquivo, descrição. O painel simplesmente não lia esses campos.

A liberação de conteúdo não tem relação com o defeito da tela. A fábrica da tela, aliás, nem passava pela lista de liberação, porque foi aberta pelo painel, e a lista só vale para sessão aberta na mão.

## Onda 2, conteúdo de todos os projetos
- **Decisão registrada** no §A.23 do `CLAUDE.md`, onde a regra da lista mora, com a data e escrita como reversão consciente. Os cabeçalhos de `ponte/ganchos/gancho.cjs` (R7) e de `ponte/ganchos/ligar.ps1` também a registram.
- **Como funciona.** A configuração ganha a chave `conteudoDeTodos: true`. Com ela, todo projeto sobe com conteúdo, menos os da lista de ignorados.
  - A lista de ignorados continua, porque é o interruptor do próprio diretor para tirar uma frente do painel por inteiro. Hoje ela está vazia.
  - A chave só vale com `true` exato. Faltando, ou com qualquer outro valor, a regra antiga volta, falha fechada.
  - A máscara de credencial continua antes de publicar.
- **Campos novos do gancho**, conferidos no que o Claude Code entrega de verdade, numa rodada de despejo: `a-fabrica-lab\rodadas\2026-11-23T155700-ost10-campos-do-gancho`.
  - `agent_type`, em todo passo dado dentro de subagente;
  - `last_assistant_message`, no fim da rodada e no fim do subagente.

  Com isso a resposta da fábrica chega pelo próprio gancho. A ponte continua sem tirar texto da transcrição.
- **Ponte no ar.** O processo da tarefa agendada nasceu em 23/11 às 15:30:23, e o commit do conserto do consumo em dobro é das 11:35:09.
  - **A ponte no ar já tem o conserto do consumo em dobro.**
  - Ela **não** tem o que esta OST mudou. Precisa reiniciar, como está em "Depende da mão do diretor".

## Onda 3, o que a tela mostra agora
- **Sentido.** Um só, escrito no topo da aba: "do mais antigo, em cima, para o mais novo, embaixo". A aba abre rolada até o fim, no que acabou de acontecer, e segue o fim enquanto o diretor não rolar para cima. Um separador marca a troca de dia: Hoje, Ontem, ou o dia por extenso.
- **Ordens do diretor.** Aparecem em destaque, cada uma abrindo um bloco com o que a fábrica fez em resposta, até a próxima ordem.
  - Na fábrica aberta pelo painel, a ordem vem da própria fila de comandos, com a situação: entregue à ponte, ou ainda não entregue. Abrir, comandar, pausar, reiniciar e encerrar entram todos.
  - Na aberta na mão, vem do que ele digitou.
- **Cada linha diz:**
  - o evento: Sua ordem, Ferramenta Read, Resposta, Subagente, Início, Fim;
  - o que aconteceu, em português;
  - o arquivo ou comando, em fonte de código;
  - a descrição;
  - o agente: o principal, ou "subagente tester", destacado.
- **A resposta da fábrica** aparece com o texto.
  - Nas fábricas antigas, o texto não foi gravado, e a linha diz isso em vez de inventar.
  - Na fábrica aberta pelo painel, a ponte passou a gravar o texto da resposta, o arquivo e a descrição da ferramenta e o agente. Tudo passa pela máscara de credencial e tem teto de tamanho.
- **Histórico completo.** A tela lê os 200 passos mais recentes, e o botão "Carregar passos mais antigos" traz os 200 seguintes, até o fim. O topo diz quantos passos existem e quantos estão na tela.
- **No celular**, a mesma linha do tempo.

### Acréscimo, data nos cartões
- **Cartão da fábrica.** Ganhou a linha de quando abriu: "aberta às 15:41" hoje, e "aberta em 22/11 às 18:30" em outro dia. Em outro ano, vai com o ano.
- **Nome automático da externa:**
  - "Fábrica externa das 09:05", hoje;
  - "Fábrica externa de 22/11 às 18:30", em outro dia.

  O nome é calculado na hora de mostrar, então o de hoje ganha a data sozinho amanhã.
- **Lista do celular.** Mostra o mesmo.

## Provas contra a base real
| Prova | Resultado | Evidência em `a-fabrica-lab\rodadas\` |
|---|---|---|
| Despejo do que o Claude Code entrega ao gancho | `agent_type` e `last_assistant_message` existem | `2026-11-23T155700-ost10-campos-do-gancho` |
| `npm run prova:ganchos` | 65 PASSOU, 0 FALHOU (58 antes, mais 7 novas: R7, agente e resposta) | |
| Tela de atividade, rodada 1 | 14 de 16 | `2026-11-23T161054-ost10-tela-de-atividade` |
| Tela de atividade, rodada 2 | 14 de 17 | `2026-11-23T161253-ost10-tela-de-atividade` |
| Tela de atividade, rodada 3 | 16 de 18 | `2026-11-23T161457-ost10-tela-de-atividade` |
| Tela de atividade, rodada final | **18 de 18** | `2026-11-23T161614-ost10-tela-de-atividade` |
| `npm run base-real`, os 7 testes, depois de tudo | 7 de 7 | `2026-11-23T1618-ost6-sete-testes-base-real` |
| Corte da fila em produção, só leitura | sessão do a-fabrica com acento: 208 linhas até a marca, 199 publicadas, **9 passos perdidos**; sessão sem acento: 568 = 568 | `~\.a-fabrica-ponte\fila-ganchos` |

**Como a prova da tela funciona.** É uma ponte de TESTE com a fila dentro da rodada, contra a base real. A conferência passa os documentos da base pelo tradutor NOVO do painel, compilado do próprio `painel/src/dados/tradutor.ts`, e grava a tela resultante em `tela-*.txt` na rodada. O script e o tradutor compilado ficam guardados em `script-da-prova` na rodada final.
- **Parte A: fábrica aberta pelo painel, com duas ordens.**
  - Ordem de hora certa.
  - Contagem 8 = 8.
  - As duas ordens com o texto.
  - Cada ordem com o que veio depois, até o fim da rodada.
  - A resposta com o texto.
  - "Leu um arquivo | ...\um.txt".
  - Nenhum "Deu um passo".
- **Parte B: fábrica externa com o gancho novo, um subagente de verdade e uma retomada.**
  - 15 linhas na fila e 15 passos na base.
  - `seq` de 0 a 14 sem repetir, atravessando a retomada.
  - As duas ordens digitadas com o texto.
  - "subagente general-purpose" nas linhas do Glob e do Read que ele fez.
  - A chamada dizendo qual subagente chamou.
  - O aviso automático fora das ordens.

**O que cada rodada vermelha ensinou, sem esconder:**
- **Rodada 1, aviso automático com cara de ordem.** O aviso automático do Claude Code apareceu como "Você mandou". Quando o subagente roda em segundo plano, o Claude Code entrega o "terminou" como se fosse um prompt (`<task-notification>`). Consertado no tradutor: vira "Aviso automático... Não foi você quem mandou", dentro do bloco da ordem.
- **Rodada 2, passos perdidos.** Dois passos sumiram entre a fila e a base. **Defeito antigo da ponte, que já existia antes desta OST:**
  - A marca da fila conta bytes, e o corte era feito no texto decodificado, que conta caracteres.
  - Um acento antes da marca (o "está" de uma resposta) fazia o corte cair no meio da linha seguinte, e os passos depois dela se perdiam como ilegíveis.
  - Isso já afetava as sessões do a-fabrica, liberado, sempre que havia acento no comando. Conferido na fila de produção, só leitura: esta sessão do coordenador tem 208 linhas até a marca e só 199 chegaram à base. Com conteúdo de todos os projetos, viraria regra.
  - A marca que a ponte de produção gravou com o defeito pode não cair em fim de linha. No primeiro passe depois do reinício, no máximo um pedaço de linha é lido como ilegível e pulado. Dali em diante o corte fica certo.
  - Consertado em `ponte/src/ganchos.ts`: o corte agora é feito nos bytes. A rodada final prova 15 de 15.
- **Rodadas 3 e final, critério meu.** Na rodada 3 caíram dois critérios meus, errados:
  - esperei exatamente 2 respostas, e a volta do aviso automático gera uma terceira, que é correta;
  - contei como bloco sem ordem o início da sessão, que vem antes da primeira ordem.

  Corrigi o critério, não a tela. A rodada final passou inteira.

**Limite da prova.** Na fábrica aberta pelo painel, o subagente não chegou a rodar, porque a prova recusa todo pedido de aprovação e a chamada dele foi recusada no portão. A identificação de subagente nessa fábrica segue o mesmo campo, ligado pela chamada que o abriu (`ponte/src/claudeCode.ts`), mas ela está provada ao vivo só na fábrica externa.

## O que ficou faltando
- **Passos antigos.** Os que já estão na base continuam sem o texto que a ponte não gravava. A tela diz isso na linha, por exemplo "O texto não era gravado antes da OST 10", em vez de inventar.
- **Passos perdidos.** Os que se perderam por causa do corte por caracteres não voltam. A trilha não se apaga, e esses passos nunca chegaram nela.
- **Validação visual do diretor, §A.13.** A tela só está concluída depois dela.

## Decisões tomadas durante a execução
- **Fonte das ordens.** A ordem do diretor, na fábrica aberta pelo painel, vem da própria fila de comandos, e não de um passo novo gravado pela ponte. É a fonte de verdade, já guardada para sempre, e assim as ordens antigas aparecem também, não só as novas.
- **Sentido de leitura.** Do mais antigo, em cima, para o mais novo, embaixo, como numa conversa, com a tela aberta no fim. É o único sentido em que "a ordem e o que veio em resposta" lê de cima para baixo.
- **Passos da tela.** Raciocínio e "recebeu o resultado" continuam na tela, ditos como são, para nada ficar escondido.
- **Projetos ignorados.** A lista continua, vazia, porque é o interruptor do próprio diretor.
- **Regra do Firestore e índices.** Nenhum dos dois muda. A contagem, a ordem por hora e o filtro de comandos por fábrica rodam com a regra e os índices que já existem.
- **Texto sobre a Onda 3.** O texto da tela que diz "Relatórios desta fábrica entram na Onda 3" ficou. Continua verdadeiro: no §A.8 a Onda 3 é a dos relatórios, e ela é a próxima OST. Saiu o "o histórico completo entra numa onda seguinte", que ficaria mentiroso.

## Arquivos alterados
- **Ponte:**
  - `ponte/ganchos/gancho.cjs`
  - `ponte/ganchos/ligar.ps1`
  - `ponte/src/ganchos.ts`
  - `ponte/src/sessao.ts`
  - `ponte/src/claudeCode.ts`
  - `ponte/src/tipos.ts`
  - `ponte/src/testes/prova-ganchos.ts`
- **Painel:**
  - `painel/src/dados/tradutor.ts`
  - `painel/src/dados/ouvintes.ts`
  - `painel/src/dados/tipos.ts`
  - `painel/src/dados/painel.ts`
  - `painel/src/formato.ts`
  - `painel/src/telas/LinhaDoTempo.tsx` (novo)
  - `painel/src/telas/FabricaTela.tsx`
  - `painel/src/telas/Celular.tsx`
  - `painel/src/telas/VisaoGeral.tsx`
  - `painel/src/componentes/ds/FactoryCard.tsx`
  - `painel/app/globals.css`
- **Regra:** `CLAUDE.md`, §A.23.

## Depende da mão do diretor, na ordem
### 1. Ligar o conteúdo de todos os projetos
Numa janela do **PowerShell normal**, sem ser administrador, de preferência sem sessão do Claude Code trabalhando:
```
powershell -ExecutionPolicy Bypass -File C:\Users\Henrique\a-fabrica\ponte\ganchos\ligar.ps1
```
O que ele faz:
- copia o gancho novo para `~\.a-fabrica-ponte\ganchos`;
- grava `conteudoDeTodos: true` em `ganchos.json`;
- guarda uma cópia do `settings.json` antes de tocar nele. As entradas do gancho já estão lá, então nada é acrescentado.

A linha 3 do resultado tem de dizer "CONTEUDO DE TODOS OS PROJETOS ligado". Vale para sessão aberta depois disto; sessão já aberta continua com o gancho velho até ser reaberta.

### 2. Reiniciar a ponte, sem fábrica rodando
```
Stop-ScheduledTask -TaskName 'A Fabrica Ponte'; Start-ScheduledTask -TaskName 'A Fabrica Ponte'
```
Sem isso, a ponte no ar continua sem:
- o texto e o agente da fábrica aberta pelo painel;
- o conserto do corte da fila;
- o `seq` contínuo.

### 3. Olhar na tela local, §A.13
```
cd C:\Users\Henrique\a-fabrica\painel
npm run dev -- -H localhost
```
Abra http://localhost:3000 e entre com a sua conta. Feche com Ctrl+C.

O que conferir:
- **A fábrica "Fabrica teste Testando".** É a da sua tela. Tem de mostrar as suas duas ordens destacadas, cada uma com o que veio embaixo, em ordem de hora, e "8 passos registrados".
- **Uma fábrica do a-fabrica.** Tem de mostrar comando, arquivo, ferramenta e agente em cada linha.
- **A Visão geral.** Cartões de outro dia com a data.

As fábricas de teste desta rodada ficam escondidas por padrão, como as de antes.

### 4. Publicar o painel, só depois de validar
Você cria a autorização. As palavras são sugestão: troque pelo que de fato validou.
```
! bash scripts/autorizar-producao.sh publicar-painel-ost10 "Publica o painel da OST 10: validei na tela a ordem de execução, as minhas ordens destacadas com a resposta, o agente em cada linha e a data nos cartões."
```
Depois diga à fábrica: **"publique o painel"**. Ela roda, da raiz do projeto, nesta ordem:
```
npm --prefix painel run construir-para-hospedagem
node scripts/publicar.mjs --painel
node scripts/publicar.mjs --conferir
```
Depois, remova a autorização usada:
```
! rm -f .claude/state/PROD_publicar-painel-ost10
```
Só o painel é publicado. A regra do Firestore não muda nesta OST. O publicador precisa do gcloud logado neste PC. Se ainda não estiver: `winget install --id Google.CloudSDK -e` e `gcloud auth login`, sem `gcloud config set project`, §A.20.
