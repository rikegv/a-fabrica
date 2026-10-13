# AlertBanner

Faixa de topo para o que trava a operação: aprovações pendentes ou ponte offline.

## Quando usar
- `tone="approval"`: sempre que existir ao menos um pedido parado. É o elemento mais forte da Visão geral e fica acima de tudo.
- `tone="offline"`: quando a ponte não responde. Aparece acima da faixa de aprovação, porque sem ponte nada anda.
- `tone="failed"`: falha que afeta mais de uma fábrica. Falha de uma fábrica só fica no cartão dela.

## O consumidor fornece
`title` (frase curta com o número), `detail` (contexto: há quanto tempo, qual projeto), `actionLabel` e `onAction`.

## Faça e não faça
- Escreva o número por extenso no título: "3 aprovações esperando você".
- Não empilhe mais de duas faixas. Não use para informação que não pede ação.
- Some com a faixa quando o motivo acabar. Não existe estado "tudo certo" em faixa.
