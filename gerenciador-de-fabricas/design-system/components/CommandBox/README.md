# CommandBox

Caixa de comando fixa no rodapé da tela Fábrica, para mandar uma ordem nova sem sair dali.

## O consumidor fornece
`onSend(texto)`, `onSaved` (abre comandos salvos), `placeholder` opcional, `disabledReason` quando não dá para enviar (ponte offline, fábrica encerrada).

## Regras
- Enter envia, Shift + Enter quebra a linha. Cresce até 160px e depois rola.
- Fixe no rodapé do painel da fábrica. É vidro forte (`glass-strong` com `blur-strong`), então a linha do tempo passa por baixo sem sumir.
- Desabilitada sempre diz por quê, no próprio campo.
