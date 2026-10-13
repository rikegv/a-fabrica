# BarChart

Barras de uma série só, em tinta neutra, verticais (por dia) ou horizontais (por projeto).

## O consumidor fornece
`data[]` (`label`, `value`, `display` formatado, `short` opcional para o eixo), `horizontal`, `height`, `ticks` (linhas de grade, a última define o máximo), `format` para o rótulo da grade, `labelEvery`, `highlightLast`.

## Regras
- Uma série, uma cor: `chart-line`. O dia atual pode vir destacado com `highlightLast`.
- Passar o mouse mostra o valor exato. Nada de número em cima de cada barra.
- Grade com ticks redondos (1, 2, 3 mi). Um eixo só.
- Horizontal já tem o valor ao lado da barra; ordene do maior para o menor.
