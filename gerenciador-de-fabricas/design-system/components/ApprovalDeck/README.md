# ApprovalDeck

Painel Aguardando você: mostra um pedido de cada vez, completo, com navegação 1 de N. É como a fila de aprovações cabe na tela sem rolagem.

## O consumidor fornece
`items[]` (as props de `ApprovalItem`, já ordenadas do mais antigo para o mais novo), `onApprove(item)`, `onReject(item, motivo)`, `onApproveWithNote(item, obs)`, `touch` no celular.

## Regras
- Abre sempre no mais antigo. Ao decidir, o consumidor remove o item e o próximo entra no lugar.
- O contador âmbar sólido no cabeçalho é o ponto mais forte da tela.
- Na Visão geral ocupa a coluna direita inteira (400px). Na tela Aprovações, fica ao lado do histórico.
- Sem pedidos, o painel continua no lugar com uma frase curta. Ele não some, para o layout não pular.
