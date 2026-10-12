# DIÁRIO, A FÁBRICA

Registro cronológico do trabalho da fábrica. Entrada por dia, da mais recente para a mais antiga. Cada entrada diz qual agente fez cada parte, conforme §A.15.

## 2026-10-12, OST 1 Parte 2, prova de conceito da ponte

Agente: ponte. Provas refeitas em sessão viva com a CLI oficial `agy` 1.3.3, instalada pelo meio oficial. Cota autorizada pelo diretor. Pasta cobaia a-fabrica-lab/projeto-bobo. Nenhum projeto real usado, janela do Antigravity intacta (§A.9).

Resultado das quatro provas, todas em sessão viva com saída real colada em docs/prova-ponte.md: Prova 1 abrir, PASSA. Prova 2 enxergar, PASSA. Prova 3 aprovar, PARCIAL (perceber, capturar e recusar passam pelo hook PreToolUse; aprovar para executar não passa no agy headless, o allow com permissionOverrides é ignorado pelo motor de permissão). Prova 4 comandar de novo, PASSA.

Correção da rodada anterior: o `agy` existe e é a CLI oficial, só não estava instalado antes. A conclusão anterior de que não existia, e a recomendação de mudar a arquitetura, estavam erradas e foram descartadas.

Entregue: protótipo prototipo-ponte/ponte-poc.mjs reescrito para pilotar o agy, o hook pretool-hook.mjs, evidências em prototipo-ponte/evidencia/, e docs/prova-ponte.md reescrito do zero. CLAUDE.md não alterado, conforme a OST.

<!-- Nova entrada acima desta linha. Formato: ## AAAA-MM-DD, título curto -->
