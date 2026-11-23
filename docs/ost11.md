# OST 11, A fábrica viva no painel

Ramo `feature/ost5-madrugada`. Nada publicado em produção, a main não foi tocada e nenhuma autorização de produção foi criada.

## Onda 0, a ponte de pé

**O que aconteceu às 16:44.** A ponte morreu às 16:43:43 com o código 0xC000013A. É o código que o Windows dá quando alguém fecha a janela de console. A tarefa agendada chamava o `node.exe` direto, com logon interativo, e isso abre uma janela preta na tela do diretor: fechar essa janela mata a ponte na hora, sem parada limpa. A base ficou dizendo "online" com o último sinal das 16:43:43. Minha sessão estava parada das 16:30 até a OST 11, então a queda não veio da fábrica. O agendador também não religou: o "reiniciar se falhar" dele não olha o código de saída.

**Conserto, em quatro partes:**
1. **Sem janela.** A ponte roda dentro de um console sem janela (`conhost --headless`), registrado por `ponte/registrar-tarefa.ps1`. Não existe mais janela para fechar por engano.
2. **Religamento.** Além do logon, a tarefa é chamada a cada 5 minutos. Se a ponte está no ar, o agendador ignora a chamada.
3. **Trava de instância única.** Está em `ponte/src/servico.ts`. Uma segunda ponte recusa subir, com o código 7, e diz qual processo já está no ar.
4. **Registro em arquivo.** Cada dia ganha um arquivo em `%USERPROFILE%\.a-fabrica-ponte\registros`. Ele só acrescenta, nada é apagado.

Também: fechar a janela, quando houver uma, agora faz a parada limpa (SIGHUP). O reinício certo é por `ponte/reiniciar.ps1`, porque parar a tarefa deixaria o `node` órfão.

**Provas, ao vivo, na máquina:**

| Prova | Resultado |
| --- | --- |
| Ponte sem janela | o node e o console sem janela nenhuma |
| Segunda ponte | recusada, código 7 |
| Ponte morta de propósito às 17:52:27 | voltou sozinha 18 s depois |
| Fila parada desde 16:43 | 63 passos publicados na volta |

**Defeito antigo achado no caminho.** A cada reinício, a reconciliação marcava como "ponte offline" as sessões abertas na mão, que não rodam dentro da ponte. Consertado em `ponte/src/base.ts`. A sessão viva da soulan, que tinha levado essa marca, voltou ao estado do último passo dela.

## Onda 1, o estado da ponte apagava o estado da fábrica

**Causa:** `painel/src/dados/tradutor.ts` trocava TODO estado por "ponte offline" quando a ponte caía.

**Conserto:** concluída e falhou ficam como terminaram, com ou sem ponte. Só a fábrica que ainda estava viva vira "ponte offline".

## Onda 2, qual agente agiu

**De onde vem.** No Antigravity, o Claude Code roda o principal como um agente (`coordenador`), e o próprio Claude Code carimba `agent_type` em todo evento. O gancho já gravava esse campo desde a OST 10. A fila da sessão da soulan tem `coordenador`, `arquiteto`, `engenheiro-backend`, `engenheiro-frontend`, `deployer`, `seguranca` e `testador-auditor`.

**O que faltava:**
1. **Fábrica aberta pelo painel.** Ela roda com `settingSources: []`, e por isso o Claude Code não carregava os agentes do projeto: o coordenador não tinha quem despachar. Agora a ponte lê `.claude/agents` de cada projeto (`lerAgentesDoProjeto`, sem nome fixo) e entrega o time inteiro. Sem agente pedido e com `coordenador.md` no projeto, a sessão principal roda como o coordenador. O portão continua parando toda chamada de risco, também a de agente.
2. **Lista do time na base.** A ponte publica, em cada fábrica, `agentesDoProjeto` com nome e descrição. Isso vale para a aberta pelo painel e para a aberta na mão.
3. **O painel ignorava o campo.** Agora ele usa o campo.

**Prova ao vivo, na base real e com a ponte de verdade.** A rodada fica em `a-fabrica-lab/rodadas/2026-11-23T1800-ost11-time-ao-vivo`. O projeto da rodada tem três agentes com nomes que não existem no a-fabrica: coordenador, leitor e revisor. Fábrica `painel-5027b4cc-5bb9-4500-a0e6-4cc293f635e8`, "Prova OST 11: time ao vivo":

| Hora | Passo | Agente na base |
| --- | --- | --- |
| 17:57:24 | passou trabalho para leitor | coordenador (principal) |
| 17:57:26 | Read nota.txt | leitor |
| 17:57:34 | passou trabalho para revisor | coordenador (principal) |
| 17:57:36 | Read nota.txt | revisor |
| 17:57:43 | resposta final | coordenador (principal) |

Na fábrica: `agente = coordenador`, `agentesDoProjeto = [coordenador, leitor, revisor]`. A evidência está em `evidencia/passos-da-base.json` e `saida-da-prova.txt`.

**Limite declarado.** Os passos gravados antes das 16:25 de hoje não têm o nome do agente. A regra da base só deixa acrescentar atividade, nunca alterar, então eles não são completados. A tela conta esses passos à parte e diz isso, sem atribuir a ninguém.

## Onda 3, Visão geral e Fábricas fechadas

- **Visão geral:** só a fábrica ativa e a que perdeu a conexão nas últimas 24 horas.
- **Menu novo, "Fábricas fechadas":** recebe a concluída e a que está sem conexão há mais de 24 horas. Nada é apagado, a fábrica abre igual. No celular, a tela Fábricas ganhou "Abertas" e "Fechadas".
- **Decisão miúda da fábrica:** a fábrica que **falhou** fica 24 horas na Visão geral, porque falha pede o diretor, e depois vai para as fechadas.

## Onda 4, o posto de comando vira a fábrica viva

`painel/src/telas/FabricaViva.tsx` e `painel/src/dados/time.ts`.

- **No topo, "Chat com o Coordenador".** Mostra as ordens do diretor e as respostas do coordenador, com a mais antiga em cima. A caixa de escrever é a do chat e substitui a caixa de ordem.
- **No centro, o cartão do Coordenador.** Embaixo dele, um cartão por agente do projeto, lado a lado, ligados por linhas. Dentro de cada cartão vai o que o agente fez em português claro, como "Leu nota.txt" ou "Passou trabalho para Revisor", com a mais recente em cima.
- **As linhas de luz:**
  - quando o coordenador passa trabalho, a luz **desce**;
  - enquanto o agente trabalha, ela **vai e volta**;
  - quando ele entrega, ela **sobe**;
  - agente parado fica apagado, e o cartão de quem trabalha ganha halo.

  A luz só anda com passo de verdade na base. Ela respeita o pedido de "movimento reduzido" do sistema.
- **O que saiu:** a lista por ordem de hora, os cartões grandes da direita e "Passos".
- **Rodapé discreto:** uma linha com o tempo da rodada, o consumo, as delegações ao time, a ponte e a máquina.
- **Nomes que não se confundem:** "Tarefa" virou **Rodada**, que é o tempo da rodada em curso. "Tarefas" virou **Delegações ao time**, que conta o que o coordenador passou aos agentes. A coleção antiga de tarefas nunca foi escrita pela ponte, e por isso a aba vazia saiu.
- **Pedido de aprovação:** o pedido parado da fábrica fica numa faixa acima do chat, porque ação vem antes de informação.
- **Celular:** o chat em cima e o time em coluna, com a luz na borda de cada cartão. Quem trabalha agora sobe para o topo.

**Prova da tela, sem navegador:** 30 de 30. O tradutor e o time novos foram compilados e rodados contra as regras e contra a base real da fábrica da prova. A prova reconstrói os instantes ao vivo:
- com o leitor lendo, só a linha dele acende;
- com o revisor lendo, a dele acende e a do leitor mostra a volta;
- na delegação, a luz desce.

A evidência está em `evidencia/prova-da-tela`.

**Limite declarado.** A fábrica aberta pelo painel não recebe o aviso de "agente terminou". Lá, o fim é lido quando o coordenador volta a agir depois do último passo do agente. Com dois agentes em paralelo numa fábrica do painel, o primeiro pode apagar um pouco antes da hora.

**O que não deu para fazer aqui.** O Chrome não estava ligado a esta sessão, e por isso a fábrica não conferiu a tela no navegador. A validação visual é só do diretor, §A.13.

## Quem fez o quê, §A.15
Tudo nesta OST foi feito pela sessão principal da fábrica, no papel de coordenador, sem despachar agentes. Ela cobriu os papéis de ponte, frontend e tester:
- a investigação e o conserto da ponte;
- a captura do agente;
- as telas;
- as provas.

## Depende do diretor
1. **Validar na tela**, §A.13, em http://localhost:3000.
2. **Depois de validar, a frase de produção**, §A.7. As palavras são sugestão:
```
! bash scripts/autorizar-producao.sh publicar-painel-ost11 "Publica o painel da OST 11: validei a fábrica viva com o chat do coordenador, o time com as linhas acendendo, as Fábricas fechadas e os cartões concluídos sem ponte offline."
```
Depois diga "publique o painel". A fábrica faz o resto, §A.24:
1. para o painel local;
2. constrói;
3. publica só o painel;
4. confere;
5. sobe o painel local de novo;
6. remove a autorização usada.

A regra e os índices do Firestore não mudam nesta OST. A ponte já roda o código novo, porque é local.
