# ActivityTimeline

Linha do tempo ao vivo da fábrica, com o passo mais recente no topo e em destaque.

## O consumidor fornece
`items[]` com `time` (hh:mm:ss), `text` (o que aconteceu, em uma frase), `detail` opcional (arquivo ou comando, em `mono`) e `kind` (`step`, `approval`, `error`, `done`); `live` destaca o primeiro item como o passo atual.

## Regras
- Mais recente em cima. Quem abre a tela quer saber o agora.
- Erro pinta a linha inteira de `state-failed`. Pedido de aprovação usa o losango âmbar.
- Escreva como relato: "Criou o serviço...", "Pediu aprovação para...". Nada de log cru; o log cru vai em `detail`.
