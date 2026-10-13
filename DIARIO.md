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

<!-- Nova entrada acima desta linha. Formato: ## AAAA-MM-DD, título curto -->
