# DIÁRIO, A FÁBRICA

Registro cronológico do trabalho da fábrica. Entrada por dia, da mais recente para a mais antiga. Cada entrada diz qual agente fez cada parte, conforme §A.15.

## 2026-10-12, OST 1 Parte 2 tarefa 2, spike da aprovacao invertida

Agentes: ponte executou o spike, seguranca auditou ao final.

Inversao testada em sessao viva com agy: pre-autorizacao num HOME descartavel (a-fabrica-lab/agy-home-teste, sem tocar o ~/.gemini real, §A.9) e o hook PreToolUse como portao. Cinco resultados, todos com saida real em docs/prova-ponte.md: aprovar por fora EXECUTA (o que faltava na Parte 2); recusar, sem resposta (timeout), resposta malformada e hook morto BLOQUEIAM (falha fechada); hook AUSENTE com pre-grant ativo EXECUTA sem o diretor (furo). Espera longa de 140s sobreviveu. Pacote de aprovacao traz o que e resumo, falta por que, impacto e risco (estao no transcript).

Seguranca: VETADO. Caminho provado de execucao sem resposta do diretor (hook ausente mais pre-grant permanente), fere §A.6. Cinco condicoes para reavaliar, com destaque para garantir que a ponte so abre sessao com o portao ativo e pre-grant minimo.

Decisao: a Onda 2 nao deve ser construida sobre a inversao ainda. CLAUDE.md nao alterado; proposta de revisao do §A.6 registrada so como proposta.

## 2026-10-12, OST 1 Parte 2, prova de conceito da ponte

Agente: ponte. Provas refeitas em sessão viva com a CLI oficial `agy` 1.3.3, instalada pelo meio oficial. Cota autorizada pelo diretor. Pasta cobaia a-fabrica-lab/projeto-bobo. Nenhum projeto real usado, janela do Antigravity intacta (§A.9).

Resultado das quatro provas, todas em sessão viva com saída real colada em docs/prova-ponte.md: Prova 1 abrir, PASSA. Prova 2 enxergar, PASSA. Prova 3 aprovar, PARCIAL (perceber, capturar e recusar passam pelo hook PreToolUse; aprovar para executar não passa no agy headless, o allow com permissionOverrides é ignorado pelo motor de permissão). Prova 4 comandar de novo, PASSA.

Correção da rodada anterior: o `agy` existe e é a CLI oficial, só não estava instalado antes. A conclusão anterior de que não existia, e a recomendação de mudar a arquitetura, estavam erradas e foram descartadas.

Entregue: protótipo prototipo-ponte/ponte-poc.mjs reescrito para pilotar o agy, o hook pretool-hook.mjs, evidências em prototipo-ponte/evidencia/, e docs/prova-ponte.md reescrito do zero. CLAUDE.md não alterado, conforme a OST.

## 2026-10-12, OST 2, fechar o furo do portao

Agentes: ponte executou, seguranca auditou ao final.

Parte 1: spike da OST 1 subido para feature e main (7afffbf), gate reativado.

Parte 2, portao a prova, seis provas em sessao viva com agy, todas OK (saida real em docs/prova-ponte.md e prototipo-ponte/evidencia): aprovar por fora executa; recusar nao executa; isca bloqueada abre; isca nao confirmada recusa abrir nos tres casos (config removida, gancho ausente, gancho quebrado); gancho morto no meio nada executa; espera longa de 320s sobreviveu. Pre-autorizacao minima, dois echoes inertes ancorados, sem curinga.

Parte 3, pacote de aprovacao completo capturado de verdade, com o que, por que, impacto, o que sera tocado, risco baixo/medio/alto, tarefa e fabrica, tempo parado, marcando fato versus deducao da ponte.

Regras operacionais aplicadas: cada rodada em pasta nova e datada em a-fabrica-lab/rodadas, fila dentro, nada apagado para limpar.

Seguranca: APROVADO COM RESSALVA. O veto da OST 1 cai, nenhum caminho provado executa risco sem o diretor, cinco condicoes satisfeitas. Ressalvas de fronteira para a Onda 2, com destaque: pre-grant jamais contem comando de risco.

Recomendacao: a Onda 1 pode comecar. Proposta de revisao do §A.6 e das tres regras operacionais em docs/proposta-revisao-a6.md. CLAUDE.md nao alterado.

## 2026-10-12, OST 4, correcao de rota para Claude Code

Agentes: ponte executou, seguranca auditou. Erro de rota aceito: as fabricas rodam no Claude Code, nao no agy. O trabalho do agy fica como registro superado.

Parte 1: CLAUDE.md corrigido. §A.2 e §A.3, execucao no Claude Code pelo kit oficial para Node. §A.6, acrescentadas as regras do portao (falha fechada, modo fixado e conferido, verificacao na abertura, sem pre-autorizacao). §A.9 e §A.10 ajustados ao Claude Code. §A.17 a §A.19, as tres regras operacionais permanentes. prova-ponte.md marcado como superado; proposta de pre-autorizacao marcada como descartada.

Parte 2: sete provas no Claude Code em sessao viva, pelo @anthropic-ai/claude-agent-sdk, portao via canUseTool, modo fixado em default e conferido no init, ambiente limpo das variaveis de aninhamento. Todas passaram, mais a verificacao do portao na abertura. Detalhe e saida real em docs/prova-claude-code.md e prototipo-ponte/claude-code. Seguranca: APROVADO COM RESSALVA, sem furo aberto, tres ressalvas a costurar na ponte de producao.

Parte 3, Onda 1 Parte A: iniciada. Contrato confirmado para Claude Code, regras do Firestore e config em firebase/, plano e comando de login unico em docs/onda1-parte-a-plano.md. Parada no unico passo que a fabrica nao faz: o login interativo do diretor no Firebase (projeto a-fabrica-soulan). Depois do login, a fabrica cria o projeto, aplica regras, promove a ponte a servico, roda os oito testes e aciona a seguranca.

## 2026-10-13, OST 6, ligar a ponte na base e o painel de verdade

Agentes: ponte e backend em paralelo no Bloco 1, frontend no Bloco 2, coordenador no Bloco 3 e na publicação, seguranca na auditoria final.

Duas decisões da madrugada revertidas pelo diretor e cumpridas: a pré-visualização em cima do protótipo morreu, e a ponte voltou para TypeScript.

Coordenador: descobriu que o app web do Firebase não existia no projeto e criou, sem ele não há entrada de cliente nem para a ponte nem para o painel. Diagnosticou o bloqueio real do Bloco 1: o Authentication nunca foi inicializado em a-fabrica-soulan, a API de identidade responde CONFIGURATION_NOT_FOUND e a inicialização por programa é recusada com BILLING_NOT_ENABLED, porque o Identity Platform exige plano pago. Logo, é clique do diretor no console, e ficou registrado como pendência com o passo exato. Decidiu a arquitetura da entrada do cliente para não travar a ponte: provedor Google, sessão persistida em arquivo local fora do repositório, renovação pelo próprio SDK, e proibição expressa de servidor local de laço de retorno, porque escutar porta fere o §A.6.

Ponte: entrada do cliente sem chave de serviço, com persistência própria do SDK e escada de credencial explícita. Porte completo para TypeScript estrito, sem any nos caminhos de decisão. As três ressalvas provadas ao vivo depois do porte. Os .mjs movidos, não apagados, §A.17. Instalação de um passo rodada de verdade, com tarefa agendada criada e sinal de vida chegando na base. Os sete testes da OST: 7 de 7 com sessão viva do Claude Code e a base no emulador. NENHUM contra a base real, porque o login não existe ainda. Isso está dito sem maquiar.

Backend: provou o estado real da nuvem por API, não por comentário. Endureceu as regras, com hora do servidor obrigatória na trilha, respondidoPor obrigatório e aprovação nascendo sem resposta. Auditou contra o arquivo real da ponte: 76 casos de regra e 35 de escrita real, todos passando. Verificador de prontidão do login com falha fechada provada.

Frontend: painel de verdade em Next.js 14, React 18, TypeScript e Tailwind, com tokens.json como fonte única, provado trocando a cor. Escopo da Onda 1 e nada mais, em modo leitura, com zero escritas no Firestore em todo o código. Login obrigatório com conta única. Dois furos achados por medição no navegador: uma linha de texto com altura zero e alvos de toque de 30 e 40 pontos, abaixo dos 44 do manual.

Bloco 3: o protótipo público morreu nas duas frentes onde vivia. O canal preview-madrugada foi apagado, não deixado expirar, e o endereço antigo responde 404. O canal live, que também servia o protótipo sem login, passou a servir o painel de verdade com login exigido, em https://a-fabrica-soulan.web.app.

Seguranca: APROVADO COM RESSALVA. Nenhum caminho executa risco sem resposta do diretor, as três ressalvas continuam duras depois do porte, a ponte não abre porta, a regra na nuvem nega todo mundo fora da conta do diretor (403 provado ao vivo), o painel exige login na fonte de dados e não só na tela, e não há segredo no repositório. Dez ressalvas, três bloqueando a main. Duas foram resolvidas na hora pelo coordenador: o legado em .mjs deixou de ser executável sem perder um byte, e as portas de entrada que os agentes tinham deixado vivas na máquina foram encerradas, inclusive um servidor de desenvolvimento escutando em todas as interfaces. A terceira, prova do segundo fator da conta Google, é do diretor.

Gate de deploy: quatro ciclos de flag criada e removida. Uma vez ele bloqueou um push de verdade, porque o comando foi montado na ordem errada e a flag ainda não existia. É o teste obrigatório do §A.7 passando sem ensaio.

## 2026-10-13, OST 6 parte 2, com o login no ar

Agentes: ponte e frontend em paralelo, seguranca na reauditoria, coordenador na coordenação e nas correções de texto.

O diretor ligou o Authentication com o provedor Google e tomou as duas decisões que faltavam, registradas em docs/ost6-decisoes-do-diretor.md. A Decisão 1 proíbe o token do Firebase CLI como credencial da ponte, porque carrega escopo de nuvem muito maior do que as regras do Firestore limitam, e firma a regra de conduta: se o login de cliente não der conta, isso é achado para relatar, não motivo para subir de credencial.

Ponte: cumpriu a Decisão 1, o degrau morreu inteiro, sem resto comentado, e a ponte deixou de ler qualquer arquivo de configuração do diretor, o que é ganho também para o §A.9. Relatou o achado que a decisão gerou, com seis opções, custo e risco. Provou a colagem com 10 de 10 casos de erro falhando fechado. Fechou a ressalva da trilha: tempo esgotado agora deixa registro na base dizendo que foi recusa por tempo e não resposta do diretor, e a resposta tardia passou a ser negada pela própria base.

Frontend: provou na nuvem que o painel publicado lê a configuração da hospedagem, não leva chave dentro, abre a janela do Google sem erro de domínio e não faz uma única chamada ao Firestore sem usuário. Provou no emulador que outra conta e conta sem e-mail verificado não abrem o painel. Achou um furo de texto: as duas recusas davam a mesma frase, e ela afirmava que a conta não era a do diretor mesmo quando era.

Seguranca, reauditoria: APROVADO COM RESSALVA, nenhum furo novo, o que sustenta a ressalva é prova que falta e não defeito achado. Resposta à pergunta do diretor sobre a Onda 2: SIM para construir, NÃO para ligar. Confirmou por conta própria que as portas de escuta fecharam, inclusive as de outro agente, e que o legado em .mjs.txt continua recusando. Achado novo com veredito: o token de atualização do Firebase não morre quando o diretor sai do navegador, na Onda 2 o arquivo de sessão da ponte passa a valer como chave de aprovação, e a revogação hoje não é granular, derruba ponte e painel juntos.

Correção de honestidade feita pelo coordenador, a pedido da segurança: três arquivos vivos afirmavam que o segundo fator estava exigido, e nada neste projeto confere segundo fator. O texto da tela, o comentário da entrada do painel e o cabeçalho da regra passaram a dizer a verdade, que segunda etapa vive na conta Google e é responsabilidade dela.

O que não andou, e por quê: os sete testes contra a base real continuam não executados, presos na credencial de cliente que só o diretor entrega. E no meio do trabalho o gcloud e depois o Firebase CLI da máquina perderam a credencial e passaram a pedir login interativo, o que travou a republicação do painel, a republicação da regra e as duas opções do Firestore que o diretor aprovou. Nada disso é defeito do sistema, é credencial de ferramenta expirada, e virou pendência declarada em vez de silêncio.

## 2026-10-13, fechamento do dia e ponto de retomada da OST 6

Agente: coordenador. Encerramento pedido pelo diretor. Esta entrada existe para a próxima sessão não precisar reconstruir contexto nenhum: ela diz onde paramos, o que está no ar, o que falta e em que ordem retomar.

### Estado do que está no ar
Painel de verdade publicado em https://a-fabrica-soulan.web.app, com login exigido e funcionando, faltando apenas uma correção de texto da mensagem de recusa. Regras endurecidas publicadas em a-fabrica-soulan, com o corpo igual ao do arquivo e só o comentário divergindo, pendência declarada dentro do próprio firestore.rules. Índices publicados. Canal preview-madrugada apagado, endereço antigo respondendo 404. O protótipo público não existe mais em nenhuma frente.

### Estado do repositório
Branch feature/ost5-madrugada, último commit 94a7798, local igual ao remoto, árvore limpa, nenhuma flag do gate em .claude/state. A main continua intocada e só recebe trabalho validado, §A.21. Cinco commits da OST 6: 688ed2b, 7f0c81f, f7e6eff, d5a9ad9, 94a7798.

### Estado da máquina do diretor
Limpa. Nenhum processo do projeto vivo, nenhuma porta de teste escutando. No fechamento ainda havia dois processos presos de um gcloud que esperava reautenticação interativa, e foram encerrados. AnyDesk e ZeroTier escutam em todas as interfaces, são do diretor, anteriores ao projeto e fora do alcance da fábrica pelo §A.9.

### Onde exatamente paramos
Os sete testes contra a BASE REAL continuam NÃO EXECUTADOS. É a entrega principal que falta da OST 6. O executor está pronto, a escada de credencial está pronta, a colagem foi provada com 10 de 10 casos de erro falhando fechado, e no emulador os sete passam. O que falta é uma credencial de sessão de cliente que só o diretor entrega, porque a Decisão 1 dele proibiu o único caminho automático que existia.

No meio do trabalho o gcloud e depois o Firebase CLI da máquina perderam a credencial e passaram a pedir login interativo. Isso não é defeito do sistema, é credencial de ferramenta expirada, e travou três coisas: republicar o painel, republicar a regra e aplicar as duas opções do Firestore que o diretor aprovou.

### Para retomar, nesta ordem
Primeiro, quatro ações do diretor, todas de minutos:
1. `firebase login --reauth`
2. `gcloud auth login`
3. Entrar em https://a-fabrica-soulan.web.app com a conta Google, abrir o console do navegador e rodar a linha da seção 7 de docs/ost6-ponte-credencial.md, que imprime o e-mail e o token de atualização da própria sessão. Entregar a saída à fábrica.
4. Evidência do segundo fator da conta Google. Hoje bloqueia a main E a Onda 2, por decisão da segurança.

Depois, a fábrica fecha num bloco só, sem precisar de nova OST:
- `powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Colar` com a credencial, depois `npm run base-real` e `npm run prova:tempo` na pasta ponte, colando a saída real dos sete testes.
- Republicar o painel com a correção de texto e republicar a regra, cada um com flag do gate criada e removida.
- Ligar recuperação a ponto no tempo e proteção contra exclusão no Firestore.
- Acionar a segurança para fechar as condições 11 a 15 do parecer em docs/ost6-seguranca-parte2.md.

### Decisões em aberto esperando o diretor
Condição 12, o que protege a sessão da ponte em disco quando ela virar chave de aprovação na Onda 2. Condição 14 e 15 do parecer da segurança. A sugestão de transformar a Decisão 1 em regra permanente do CLAUDE.md, que a fábrica não faz por conta própria. E a proposta da ponte de evoluir para fluxo de dispositivo com cliente OAuth de escopo mínimo, que daria ao diretor revogar a ponte com um clique na própria conta Google.

### Onda 2
Liberada para CONSTRUIR, proibida de LIGAR, por parecer da segurança. Construir o caminho de escrita não cria superfície enquanto a ponte não tem credencial e o painel publicado não escreve.

### Onde está cada coisa escrita
docs/ost6-ponte.md e docs/ost6-ponte-parte2.md, a ponte. docs/ost6-ponte-credencial.md, o achado da credencial com seis opções. docs/ost6-base.md, a base. docs/ost6-painel.md e docs/ost6-painel-parte2.md, o painel. docs/ost6-seguranca.md e docs/ost6-seguranca-parte2.md, os dois pareceres. docs/ost6-decisoes-do-diretor.md, as duas decisões. Evidências em firebase/testes, painel/testes e C:\Users\Henrique\a-fabrica-lab\rodadas, nenhuma sobrescrita, nenhuma apagada, §A.17.

## 2026-10-14, retomada da OST 7: a sessão do diretor entrou e destravou tudo

Agentes: **coordenador** (login, provas na base real, gate, publicação, consertos)
e **seguranca** (auditoria e veto), §A.15.

### O que destravou
O diretor entrou pelo login no navegador. A sessão da ponte está gravada e trancada
em `C:\Users\Henrique\.a-fabrica-ponte\sessao.json`. Com ela, caiu a trava que vinha
desde a OST 6.

A primeira tentativa de login morreu calada: 15 minutos, porta fechada por tempo
esgotado, e o relato não sabia dizer se o diretor não clicou ou se a página abriu e
falhou. A causa provável era o Firebase autorizar `localhost` de fábrica e não
autorizar `127.0.0.1`. Três consertos antes da segunda tentativa, que funcionou em
93 segundos: as duas grafias aceitas na tranca de hospedeiro, a página contando o
erro dela para o terminal, e o tempo esgotado distinguindo três desfechos.

### O que está provado contra a base real
Sete testes, 7 de 7, **três rodadas**. Prova do tempo esgotado, com recusa por tempo,
hora de servidor, origem, e a resposta tardia do diretor negada pela própria regra
com `PERMISSION_DENIED`. Bloco 1 fim a fim, 9 de 9: sessão aberta na mão apareceu
sozinha na nuvem em 3 segundos, com os 5 passos em ordem. Prova das cinco ações do
painel, tudo passando. Prova do §A.7, quatro partes, 12 casos de bloqueio.

Custo do gancho, medido hoje: **p95 de 72 ms por passo**, dos quais 2,4 ms é trabalho
dele e o resto é processo subindo. A medida antiga de 220 a 280 ms vinha de dividir a
diferença de uma tarefa inteira pelo número de chamadas, que é mais ruidoso.

### Quatro defeitos achados ao vivo e consertados
1. **Gate cego para a PowerShell.** O hook estava amarrado só em `matcher: "Bash"`, e
   a sessão tem ferramenta PowerShell: um push por ela passava inteiro por fora do
   §A.7. Fechado e provado ao vivo.
2. **Publicação sem o Firebase CLI estava quebrada.** O script mandava os campos do
   `firebase.json` crus para a API de hospedagem, que recusou com HTTP 400. A tradução
   mora no script agora.
3. **Ponte de teste comia a fila de produção.** Pontes com identificador de máquina
   falso liam a fila real e publicavam as sessões de verdade do diretor carimbadas
   com a máquina de teste. No painel, a sessão viva dele aparecia pendurada numa ponte
   offline. A fila aceita pasta por ambiente e as três provas apontam para dentro da
   rodada.
4. **Fábrica fantasma.** Sessão cuja abertura a ponte perdeu nascia muda, sem máquina,
   sem agente, sem projeto, presa em execução. Agora a primeira atividade completa a
   fábrica por merge.

### O que está no ar
Painel com a Onda 2 dentro em https://a-fabrica-soulan.web.app, publicado com flag do
gate criada e removida. Regra do Firestore já estava byte a byte igual ao arquivo, não
precisou republicar. Ponte de produção rodando solta, máquina `maquina-b06c5b1e81b4`,
estado online.

### O veto da segurança
A Onda 2 **não podia ser ligada**: condições 1 e 12 do parecer da OST 6 abertas, 8
pela metade. Veto de processo e de risco, não de código. Validação visual do diretor
não está vetada e é recomendada. Parecer inteiro em
`docs/ost7-seguranca-retomada.md`.

Dois achados fechados na hora: máscara no caminho da aprovação, que publicava todo o
texto do agente sem filtro numa coleção que não se apaga; e o furo do gate que
liberava conferir e publicar na mesma linha.

### Cinco decisões esperando o diretor
1. **Evidência do segundo fator da conta Google.** Bloqueia a main e bloqueia manter a
   Onda 2 ligada. É o item mais barato e o que mais protege.
2. **Faturamento do projeto**, para ligar recuperação a ponto no tempo. A API recusou
   por plano gratuito. Sem ela, a trilha é imutável para o painel e para a ponte, e
   não para quem tem a conta.
3. **A flag do gate é autoassinada.** O agente que quer publicar cria a própria
   autorização, sem rastro de quem autorizou. Enquanto isso valer, a frase do §A.7 não
   é inteiramente verdade.
4. **O gancho captura o prompt de todos os projetos**, e a lista de ignorados está
   vazia. Prompt de sistema de cliente iria para a base, contra o §A.4.
5. **Lixo de teste na base de produção**: 10 fábricas de teste e 3 máquinas de teste
   offline. Proposta é rotular e filtrar, nunca apagar, §A.17.

### Condição 12, o que falta em uma frase
A pasta de trabalho da fábrica vem **de dentro do comando**, escolhida por quem
escreve no painel. Falta prova de que leitura fora dela passa pelo portão e é negada,
ou decisão escrita do diretor aceitando o risco.

## 2026-10-15, OST 7: o vazamento do gancho, o painel que falhava calado, e a autorização fora do alcance da fábrica

Agente: **coordenador** em tudo, §A.15. A auditoria da véspera foi da **seguranca**, e
metade do trabalho deste dia saiu do veto dela.

Dez commits, de `234e50b` a `0de0670`. Ramo `feature/ost5-madrugada`, árvore limpa.

### Três regras permanentes nasceram hoje
**§A.22, nenhuma ação do painel falha em silêncio.** Nasceu de um caso real: o diretor
abriu uma fábrica, tudo funcionou, a fábrica rodou e concluiu, e a tela não disse nada.

**§A.23, conteúdo só de projeto liberado.** Metadado de todo projeto, conteúdo só dos
liberados, um a um, começando com `a-fabrica` e mais nada.

**§A.7 reescrito, autorização separada por peso.** Peso leve, branch de feature: a fábrica
autoriza. Peso pesado, main e qualquer publicação: só o diretor, na mão, na sessão, com
validade de 30 minutos e de uma vez.

### O vazamento do gancho, prioridade zero do dia
O gancho capturava o TEXTO dos comandos de todos os projetos, e a lista de ignorados
estava vazia. CentraFin, CENTRA DASH e SoulTrell lidam com dado de cliente: a proteção do
§A.4 existia no papel e não no arquivo.

A lógica foi invertida. Quem decide é o gancho, dentro do projeto, então o que não está
liberado **não chega nem à fila em disco**. Projeto novo nasce sem liberação, inclusive com
a lista ausente, vazia ou corrompida. Comparação por fronteira de caminho: liberar
`a-fabrica` não alcança `a-fabrica-lab`.

**Nenhum byte de projeto de cliente chegou à base.** A fila local prova: as duas sessões
publicadas eram só de `a-fabrica`. Foram limpos 4 passos de uma sessão de teste do
laboratório, campo por campo, com aviso no lugar do conteúdo. Nada apagado.

### O bug que o diretor sentiu: abria fábrica e não via nada
Rastreado pela base, sem adivinhação. A ordem dele **funcionou inteira**: painel gravou,
regra aceitou, ponte leu e entregou no mesmo segundo, fábrica nasceu e concluiu em 22
segundos. O defeito era de exibição, e eram três: o painel jogava fora o identificador da
fábrica nova; na lista, concluída vai para o fim e a dele era a última de vinte, numa tela
que não rola; e se ele fosse levado até ela, a tela diria "esta fábrica não está mais no
painel", confundindo "ainda não nasceu" com "foi encerrada".

Agora o painel leva ele até a fábrica, no computador e no celular, com três momentos
honestos: esperando, passou do prazo com motivo e próximo passo, e encerrada.

### Cinco números que não batiam com a realidade
O diretor olhou a visão geral e apontou cinco. Causa de cada um, achada com evidência:

1. **Sessão viva aparecendo como concluída.** Causa minha: o conserto da fábrica fantasma
   preenchia o projeto a partir da linha que passava, e o gancho escreve o `cwd` de cada
   evento. A raiz era sobrescrita por subpasta. Ficou: preenche o que falta, nunca
   sobrescreve, e confere na base porque o controle em memória zera no reinício.
2. **Pasta do laboratório como fábrica de verdade.** Eu tinha aberto exceção para fábrica
   aberta por ele no painel. Ele disse o contrário e tem razão: regra sem exceção.
3. **Consumo 0 tokens.** Dois defeitos: a ponte grava o `usage` do kit e o painel lia
   `totalTokens`, campo que nunca existiu; e fábrica aberta na mão não tem medida nenhuma,
   porque o gancho não recebe contagem de token. Ficou: soma as duas grafias, e ausência
   virou "consumo não medido", que é diferente de zero.
4. **Tempo de 19h57.** O relógio contava até agora, em todo estado. Ficou: para quando a
   fábrica para. **O número é tempo de parede, não de trabalho**, e medir trabalho de
   verdade muda o §A.4: proposto, não feito.
5. **"Modelo não informado".** O gancho não recebe o modelo, conferido na fila. Ficou:
   "modelo não reportado pelo Claude Code", que explica a falta.

### Defeitos achados ao vivo e consertados, fora os acima
Gate cego para a ferramenta PowerShell, com push passando inteiro por fora. Publicação sem
o Firebase CLI quebrada, por vocabulário trocado com a API. Ponte de teste comendo a fila
de produção e carimbando sessões reais com máquina de teste. Fábrica fantasma, sem máquina,
agente nem projeto. Máscara ausente no caminho da aprovação, que era o único caminho
permanente sem filtro. Furo do `--conferir` no gate. Risco **baixo** para a fábrica ler a
própria credencial, que era a leitura mais perigosa do sistema com a cara mais inofensiva.

### O que está no ar
Painel em https://a-fabrica-soulan.web.app, publicado com autorização do diretor e
conferido arquivo por arquivo: **22 no ar, 22 iguais byte a byte** ao pacote local,
condição 14 cumprida. Regra do Firestore byte a byte igual ao arquivo. Ponte de produção
rodando solta, máquina `maquina-b06c5b1e81b4`. Base com 28 fábricas, **2 na tela** e 26
rotuladas de teste, nenhuma apagada. Zero aprovações pendentes.

### Provado contra a base real
Sete testes, 7 de 7, **quatro rodadas**. Tempo esgotado com recusa por tempo e resposta
tardia negada pela regra. Bloco 1 fim a fim, 9 de 9, sessão aberta na mão aparecendo
sozinha em 3 segundos. Abrir pelo painel, 7 de 7, fábrica nascendo em 13,7 s. Condição 12
pelo portão: a fábrica mandada ler a credencial da ponte foi barrada, **tentou de novo pelo
PowerShell e foi barrada de novo**, e nada vazou. §A.22 com navegador de verdade, 12 de 12,
com print de cada tela. Gate do §A.7, 23 de 24.

**Custo do gancho: p95 de 72 ms por passo**, dos quais 2,4 ms é trabalho dele.

### A trava que me pegou, e é para ficar
A decisão do diretor tirou o gate do alcance da fábrica. Funcionou na hora: tentei editar
`gate-deploy.sh` e recebi recusa da ferramenta, **no meio de um conserto de verdade**. Não
contornei. O conserto ficou escrito em `scripts/CONSERTO-PENDENTE-DO-GATE.md` e a prova do
§A.7 deixa o caso falhando de propósito.

O preço é real: a fábrica não mantém mais o gate nem o `settings.json`. Cada conserto deles
passa pelo diretor.

E o limite, dito sem maquiagem: a fábrica roda como o mesmo usuário do Windows. A negação
pega o caminho direto e não pega o indireto, um script dela alcança a pasta sem citá-la.
Isso é disciplina com campainha, não parede. Parede de verdade é fora desta máquina.

### Para retomar, nesta ordem
1. **Validação visual do diretor**, §A.13, dos cinco pontos da visão geral.
2. **A main**, 24 commits à frente, esperando só a validação dele. A subida agora exige
   `! bash scripts/autorizar-producao.sh subir-main "<as palavras dele>"`.
3. **Conserto do gate**, `scripts/CONSERTO-PENDENTE-DO-GATE.md`: push sem nomear ramo, em
   cima da main, ainda não conta como produção.
4. **Remover a autorização de produção usada**, se tiver sobrado:
   `! rm -f .claude/state/PROD_publicar-correcoes-da-visao-geral`.

### Decisões em aberto, todas do diretor
**Faturamento do projeto**, que destrava a recuperação a ponto no tempo. Sem ela, "a trilha
não se apaga" vale para o painel e para a ponte, e não para quem tem a conta.

**Publicação fora desta máquina**, por fluxo do GitHub que só dispara com aprovação dele,
com a fábrica sem credencial de produção nenhuma. É o que tira o atrito do gcloud, que
venceu três vezes num dia, sem desfazer o controle.

**Dois cartões com o mesmo título** quando duas fábricas dividem o projeto. Mostrar a hora
de abertura resolveria, e mexe no desenho do cartão.

**Tempo de trabalho** em vez de tempo de parede, que muda o §A.4.

**Rótulo em máquina de teste**: pela regra, exigiria escrever que ela foi vista agora, o
que seria mentira. Ficaram sem rótulo, visíveis só como offline. Mudar isso é mudar a regra
ou usar a API de administração.

**Condição 11**, dois sub-itens: processo órfão do Claude Code, e rede caindo no instante
exato da gravação da trilha.

### Onde está escrito
`docs/ost7-seguranca-retomada.md`, o parecer e o veto. `scripts/CONSERTO-PENDENTE-DO-GATE.md`,
o conserto que a trava impediu. Evidências em
`C:\Users\Henrique\a-fabrica-lab\rodadas\2026-10-14-ost7-retomada` e em
`painel/testes/rodada-2026-10-15-a22-sem-silencio`, com print de cada tela. Nada
sobrescrito, nada apagado, §A.17.

<!-- Nova entrada acima desta linha. Formato: ## AAAA-MM-DD, título curto -->
