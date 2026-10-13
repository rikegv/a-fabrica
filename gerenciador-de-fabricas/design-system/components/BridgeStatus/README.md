# BridgeStatus

Indicador compacto da ponte local, fixo no topo de todas as telas.

## O consumidor fornece
`online` (booleano), `detail` (nome da máquina quando conectada; tempo sem resposta quando offline), `machine` opcional para o tooltip.

## Regras
- Conectada é discreta: borda fina, ponto verde, texto apagado. Não chama atenção quando está tudo bem.
- Offline usa `state-offline` e vem acompanhada de `AlertBanner tone="offline"` na Visão geral.
