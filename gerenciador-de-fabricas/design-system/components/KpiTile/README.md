# KpiTile

Indicador de vidro: rótulo em caixa alta, número grande em peso leve, unidade discreta, e um sparkline ou barra de progresso.

## O consumidor fornece
`label`, `value` (formatado em pt-BR, sem a unidade), `unit`, e um dos dois: `series[]` (números para o sparkline) ou `progress` (0 a 1). Opcional: `delta` (`dir` `up`/`down`, `text`, `tone` `good`/`bad`) e `hint`.

## Regras
- O número usa o estilo `kpi`: 34px, peso 300. É o peso leve em tamanho grande que dá o ar premium; não engrosse.
- Sparkline e barra usam `chart-line`, neutro. KPI não é estado: só o `delta` pode ganhar verde ou vermelho, e só quando subir é claramente bom ou ruim.
- Na Visão geral, cinco KPIs em uma linha: Em execução, Agentes ativos, Tempo hoje, Consumo hoje, Tarefas concluídas. Abaixo de 1280px, quatro.
- Sem eixo, sem rótulo de ponto. Detalhe fica na tela Indicadores.
