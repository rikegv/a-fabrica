# FactoryHeader

Cabeçalho da tela Fábrica: projeto, estado, agente, tempo, consumo e os três controles.

## O consumidor fornece
`project`, `state`, `agent`, `elapsed`, `usage`, `onPause`, `onRestart`, `onStop`.

## Regras
- Encerrar é o único botão vermelho e fica por último. Peça confirmação antes de executar.
- Pausar vira Retomar quando o estado é `idle`.
- No celular os três botões ocupam a linha inteira com altura `size-touch`.
