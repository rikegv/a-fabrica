# Button

Botão de ação em quatro variantes.

## Variantes
- `primary`: preenchido com `action`, neutro claro. Um por bloco: Aprovar, Enviar, Abrir nova fábrica.
- `secondary`: borda `line-200`. Ação alternativa: Aprovar com observação, Pausar.
- `ghost`: sem borda. Cancelar, fechar.
- `danger`: borda e texto `state-failed`. Recusar, Encerrar.

## O consumidor fornece
`variant`, `children` (verbo no infinitivo, sem ponto), `size="touch"` no celular, `block` para largura total, e as props de `button`.

## Regras
- O primário é neutro de propósito: a cor da tela pertence aos estados. Um botão verde competiria com o selo Concluída.
- Texto de botão é verbo: "Aprovar", não "OK" nem "Confirmar ação".
