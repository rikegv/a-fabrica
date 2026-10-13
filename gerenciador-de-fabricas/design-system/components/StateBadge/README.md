# StateBadge

Selo que diz o estado de uma fábrica ou tarefa pela cor, pela forma do ícone e pela palavra, nessa ordem de leitura.

## Estados
| `state` | Texto | Forma |
| --- | --- | --- |
| `running` | Em execução | ponto com anel pulsando |
| `approval` | Aguardando aprovação | losango cheio |
| `idle` | Aguardando comando | círculo vazio |
| `done` | Concluída | círculo com visto |
| `failed` | Falhou | X |
| `offline` | Ponte offline | círculo tracejado cortado |

## O consumidor fornece
`state`; opcional `label` para encurtar (ex.: "Ociosa" no celular) e `size="lg"` no cabeçalho da fábrica.

## Regras
- Nunca mostre só a cor. A forma e a palavra são o que garante leitura para quem não distingue verde de vermelho.
- `StateIcon` sozinho só onde o texto já está ao lado (linha do tempo, contador).
