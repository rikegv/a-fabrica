# OST 13: Tela da fábrica arrumada e relatórios no painel

Fechamento escrito pelo coordenador em 25/11/2026. Contrato da OST: `docs/ost13-contrato.md`. O arquivo `docs/ost13-onda0-parada.md` é a parada da tentativa anterior, feita na sessão aberta em `painel/`. Ele fica como registro, e esta sessão o substitui.

## O que foi solicitado

Conferir antes de tudo em que pasta a sessão abriu (Onda 0). Consertar o chat da fábrica viva e o "0 agentes no time" (Onda 1). Refazer a disposição da tela (Onda 2). Criar os relatórios de fechamento e diário, com aba na fábrica e menu lateral (Onda 3). Despachar de verdade a segurança e o tester. Fechar com commit e push no ramo de feature, o painel no ar e o roteiro da manhã.

## Quem trabalhou

| Agente | O que fez |
|---|---|
| coordenador | Onda 0. Diagnóstico dos três defeitos, medido na fila real e no código. Contrato entre ponte e painel e critério do fechamento. Decisões de detalhe. Este relatório, o commit e o push. |
| ponte | Itens P1 a P5 do contrato, em `ponte/src`: estado, leitura do time, detector de fechamento, leitura do texto inteiro da transcrição, diário das 20h, consumo por dia, reinícios da ponte. Depois, as duas ressalvas da segurança e a correção do consumo na base. |
| frontend | Chat novo, disposição nova, aba e menu Relatórios, celular, em `painel/src` e `painel/app`. |
| seguranca | Duas passagens, com veto. A primeira revisou o desenho antes do código: aprovado com condições. A segunda auditou o código contra cada condição: liberado com ressalvas. |
| tester | Rodou de novo todas as provas e provou o critério do fechamento com cinco sessões reais do Claude Code no a-fabrica-lab, conferidas na base real. |

## O que foi feito

### Onda 0, conferência

Esta sessão abriu em `C:\Users\Henrique\a-fabrica`, a raiz. O portão rodou: um texto inofensivo com as palavras de push foi bloqueado, e `scripts/prova-gate.sh` passou inteiro. Na base, a fábrica desta sessão aparece com o projeto da raiz e os oito agentes. A sessão anterior aparecia como "painel" porque foi aberta mesmo dentro de `painel/`, então a tela estava certa e não havia o que consertar.

### Onda 1, defeitos

- **Chat só com três pontinhos.** Eram três causas:
  1. A tela lia só os últimos 200 passos, e numa sessão longa a conversa ficava fora.
  2. Depois de cada fim de rodada, o Claude Code manda um resumo automático como "subagente terminou" sem nome. A ponte religava a fábrica com ele, e o painel achava que o coordenador continuava trabalhando.
  3. A resposta do coordenador entrava no cartão dele.

  Conserto da ponte: subagente não muda mais o estado da fábrica. Conserto do frontend: a conversa vem de uma leitura própria e inteira, os pontinhos só acendem com ordem sem resposta, e a resposta saiu do cartão.
- **"0 agentes no time" na fábrica aberta na mão.** A ponte lia `.claude/agents` exatamente da pasta do evento. Agora ela sobe de pasta até achar o time, só dentro da pasta do usuário, e lê a partir do projeto gravado na fábrica. Feito pela ponte.

### Onda 2, disposição (frontend)

- Saiu o título grande. No lugar ficou uma linha fina com voltar, nome, situação, consumo, tempo, as abas "Ao vivo" e "Relatórios" e os botões.
- Na esquerda, um terço com o chat de cima a baixo e a caixa embaixo.
- Na direita, dois terços: o coordenador em largura inteira e os agentes em grade de três, com as linhas de luz pelos vãos. Cada cartão mostra várias ações.
- O rodapé ficou como estava. Os parágrafos explicativos saíram. No celular, o chat fica em cima e o time embaixo.

### Onda 3, relatórios

- **Fechamento.** A ponte reconhece o fechamento no fim de rodada da sessão principal e grava em `relatorios` o texto inteiro, com a máscara de credencial aplicada. O gancho corta a resposta em 4000 caracteres, então, quando ele corta, a ponte tira o texto inteiro da transcrição. Ela confere que é a mesma mensagem por igualdade exata do começo. Vale para fábrica aberta na mão e pelo painel.
- **Diário.** Sai um por fábrica, por dia, na primeira passada da ponte depois das 20h00 de Brasília. Junta os fechamentos inteiros, as pendências copiadas sem reescrever, o tempo das rodadas e o consumo do dia. Fábrica sem atividade não gera diário. Se a máquina estiver dormindo às 20h, o diário sai quando ela acordar, marcado como atrasado.
- **Onde ver.** Aba "Relatórios" na linha fina do topo de cada fábrica. Menu lateral "Relatórios", com filtro por fábrica e por dia. No celular, aba "Relatórios" na barra de baixo.

### O critério do fechamento, item 13

Uma mensagem é fechamento quando atende a todas estas condições:

1. É o fim de rodada da sessão principal. Nunca texto de subagente nem a sua ordem.
2. Não é aviso automático do Claude Code.
3. Tem os títulos do §A.16 escritos como título, no começo da linha. A mesma expressão no meio de uma frase não conta.
4. Tem "o que foi feito" e "o que ficou faltando", e pelo menos mais dois destes: pedido, decisões, arquivos, problemas, próximo passo, quem trabalhou.

O motivo: o critério lê o formato que você mesmo exige em todo fechamento. O erro que se aceita é este: um fechamento escrito fora do formato não vira relatório, mas continua inteiro no chat.

Provado com sessões reais no a-fabrica-lab, pelo tester:

| Caso | Resultado |
|---|---|
| Fechamento de 9965 caracteres | Gravado inteiro pela transcrição, idêntico à mensagem. A máscara pegou duas senhas fictícias, uma delas depois do ponto de corte do gancho. |
| Resposta que cita "o que falta" no meio da frase | Não gravou. |
| Resposta com só três títulos | Não gravou. |
| Subagente devolve um fechamento e a principal responde "Recebido." | Não gravou. |
| Sessão aberta como `--agent coordenador` | Gravou. |

Ids na base: `fech-mao-9d253bab-cf7c-48d6-accd-5335571ffb60-b8b7157157ce9673` e `fech-mao-3d0240d5-ec60-4dc8-8ef3-84bec9a10177-5ffe8bf18ef3fd34`. Os dois começam com "LABORATÓRIO OST 13" e vão aparecer no menu Relatórios.

### Provas

| Prova | Resultado | Rodada por |
|---|---|---|
| `ponte`, `prova:relatorios` | 91 de 91 | ponte, e de novo pelo tester |
| `ponte`, `prova:ganchos` | 65 de 65 | tester |
| `painel`, prova do chat e dos relatórios | 38 de 38 | frontend, e de novo pelo tester |
| `ponte` e `painel`, `tipos` | limpos | tester |
| Construção do painel | passou | frontend |
| `prova-gate.sh` | passou | coordenador e tester |
| Painel local na 3000 | responde 200 e compila sem erro | tester |

## Decisões tomadas durante a execução

1. **Janela do diário.** O diário do dia D cobre das 20h00 de D-1 às 20h00 de D, e não o dia do calendário. Você trabalha à noite, e com o calendário o que acontecesse depois das 20h não entraria em diário nenhum. O texto do diário diz a janela por extenso. Coordenador.
2. **A mensagem das 01:36 de 25/11 conta como fechamento.** Ela abre com "A OST 12 está fechada" e tem quatro títulos. Coordenador.
3. **Id do fechamento sem o texto.** Assim a mesma rodada nunca vira dois documentos. Condição da segurança.
4. **Consumo movido de dia.** O consumo somado entre 23:40 e 23:47 de 24/11 caiu na chave do dia 24 pela versão anterior da ponte. Mandei passar para a chave do dia 25, nas duas fábricas afetadas. É uma escrita de dado na base, não é publicação, regra nem índice. O antes e o depois estão em `ponte/testes-ost13/rodada-2026-11-24-234846-consumo-janela/antes-e-depois.json`. Coordenador decidiu, ponte executou, e a segurança pediu este registro.
5. **Leitura do time.** A subida de pasta vale só para a lista do time da fábrica aberta na mão, que guarda só nome e descrição. A fábrica aberta pelo painel lê exatamente a pasta cadastrada, como antes. Ressalva da segurança.
6. **Formato do texto.** O texto dos relatórios ganha forma (títulos, negrito, listas) com elementos montados a partir do texto, sem HTML. Condição da segurança, porque o texto pode trazer conteúdo de arquivo de cliente.

## Problemas encontrados

1. **Dois diários vazios de 24/11 na base, para sempre.** O primeiro reinício da ponte, às 23:40, gerou diários de 24/11 com 0 rodadas para `mao-1f407a26-…` e `mao-76486df0-…`. A regra não deixa apagar nem corrigir. A causa foi consertada antes do segundo reinício.
2. **Quatro rodadas sem diário.** O livro local guardou quatro rodadas da noite de 24/11 (23:43 a 23:45) sob o dia 24, pela versão anterior. Elas não vão entrar no diário de 25/11, que vai sair marcado como parcial. É sobra da troca de versão, não defeito do código atual.
3. **Comentário falso no gancho.** O comentário em `ponte/ganchos/gancho.cjs` diz que a ponte não abre a transcrição para tirar texto, e agora ela abre, nas condições acima. O gancho não foi mexido porque esta OST o tirou do alcance. Fica a divergência registrada para a próxima vez que alguém mexer nele.
4. **Extensão do navegador desconectada.** O coordenador não conseguiu olhar a tela no navegador. Nenhum agente viu a tela nova com os olhos.

## O que ficou faltando

1. **Sua validação visual**, §A.13. Nada da tela nova foi visto por ninguém.
2. **Estado da fábrica depois do fim de rodada, ao vivo.** Está provado no código e na prova automática, mas não fotografado na base, porque só acontece em sessão interativa parada. Depois desta resposta, esta fábrica tem de ficar em "aguardando comando", e não voltar para "em execução".
3. **Fechamento de fábrica aberta pelo painel na base real.** Provado só com base em memória, porque exigiria abrir uma fábrica pelo painel.
4. **Um risco lido no código, sem caso reproduzido.** Numa sessão aberta com `--agent` cujo evento de abertura nunca chegou à ponte, a fábrica fica com o agente "claude code". Nesse caso, o fim de rodada com o nome do agente seria lido como de subagente, e o fechamento não seria gravado. O texto continuaria no chat.

## Arquivos e áreas alteradas

- **Ponte:** `ponte/src/relatorios.ts` e `relatoriosBase.ts` (novos), `ganchos.ts`, `personas.ts`, `transcricao.ts`, `base.ts`, `claudeCode.ts`, `sessao.ts`, `ponte.ts`, `testes/prova-relatorios.ts` (novo), `testes/prova-ganchos.ts`, `package.json`. Leitor só de leitura `ponte/ganchos/ver-relatorios.mjs` (novo). Evidência em `ponte/testes-ost13/`, com transcrições sintéticas, conferidas pela segurança.
- **Painel:** `painel/src/dados/relatorios.ts` e `painel/src/telas/Relatorios.tsx` (novos), `dados/time.ts`, `ouvintes.ts`, `tipos.ts`, `telas/FabricaViva.tsx`, `FabricaTela.tsx`, `Computador.tsx`, `Celular.tsx`, `LinhaDoTempo.tsx`, `renomear.tsx`, `textos.ts`, `app/globals.css` e os estilos gerados. Evidência em `painel/testes/rodada-2026-11-24-233848-ost13-chat/`.
- **Base real:** dois fechamentos de laboratório, dois diários vazios de 24/11 e o campo `consumoPorDia` de duas fábricas.
- **Fora do repositório:** evidência do tester em `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-11-25T1015-ost13-fechamento-real\`.
- **Não tocados:** regra, índices, hospedagem, main, gancho, instalador e Linux.

## Para a manhã, com o diretor

O painel local está no ar em http://localhost:3000 e volta sozinho pela tarefa "A Fabrica Painel". A ponte já roda o código novo. A OST 11 e a OST 13 estão no ramo `feature/ost5-madrugada`, e nenhuma das duas está na main nem publicada.

### 1. O que olhar para validar as OSTs 11 e 13 juntas

Abra a fábrica desta sessão (a-fabrica, a mais recente) e confira:

1. **Topo.** Uma linha fina com nome, situação, consumo, tempo, as abas "Ao vivo" e "Relatórios" e os botões. Sem título grande.
2. **Chat, na esquerda.** Um terço da largura, de cima a baixo. Mostra a sua ordem da OST 13 e esta resposta inteira, rolando, com a caixa embaixo. Sem três pontinhos acesos depois que a resposta chegou.
3. **Situação da fábrica.** Fica em "aguardando comando" depois desta resposta, e não volta para "em execução".
4. **Time, na direita.** O coordenador no topo, em largura inteira. Embaixo, os oito agentes em grade de três. Os que trabalharam nesta OST (ponte, frontend, seguranca, tester) mostram várias ações cada um. As linhas de luz ligam o coordenador aos agentes, e a do agente que trabalha acende (OST 11). A resposta do coordenador não aparece dentro do cartão dele.
5. **Aba "Relatórios" desta fábrica.** Fica vazia até um fechamento dela ser gravado, e o diário de 25/11 sai depois das 20h00.
6. **Menu lateral "Relatórios".** Aparecem os dois fechamentos "LABORATÓRIO OST 13", com texto inteiro e forma de título e lista. Os filtros por fábrica e por dia funcionam. Aparecem também os dois diários vazios de 24/11 (problema 1).
7. **Celular.** Chat em cima, time embaixo, e a aba Relatórios funciona.
8. **Itens da OST 11 que continuam valendo.** Fábricas fechadas, e cartões concluídos sem "ponte offline".

### 2. Frase para publicar o painel

Depois de validar, digite (as palavras são sugestão, troque pelas suas):

```
! bash scripts/autorizar-producao.sh publicar-painel-ost11-ost13 "Publica o painel das OSTs 11 e 13: validei na tela o chat inteiro com o coordenador, o time em grade de três com as linhas de luz, a linha fina do topo e os relatórios na aba e no menu."
```

Depois diga "publique o painel". A fábrica para o painel local, constrói, publica só o painel com `--project a-fabrica-soulan`, confere, sobe o painel local de novo e remove a autorização usada. A regra e os índices não mudam nesta OST.

### 3. Frase para subir tudo para a main

Cada autorização de produção vale uma vez. Esta é uma segunda frase, separada:

```
! bash scripts/autorizar-producao.sh subir-main-ost11-ost13 "Sobe as OSTs 11, 12 e 13 para a main: validei na tela a fábrica viva, o chat, o time e os relatórios."
```

Depois diga "suba para a main". A fábrica faz o merge de `feature/ost5-madrugada` na main sem reescrever nada, sobe e remove a autorização. O ramo carrega também a OST 12 (a regra das duas fábricas e o painel que volta sozinho), por isso a frase cita a 12. Se algum ramo `nuvem/` tiver subido nesse meio tempo, ele não entra junto: juntar o trabalho da nuvem é outra decisão sua (§A.25).

### 4. Decisões que são suas

1. Encerrar a sessão antiga aberta em `painel/`, se ela ainda estiver aberta. Ela continua sem portão.
2. Se quer que o risco do item 4 de "O que ficou faltando" seja fechado numa próxima OST.
