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

<!-- Nova entrada acima desta linha. Formato: ## AAAA-MM-DD, título curto -->
