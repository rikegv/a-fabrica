# ApprovalItem

Um pedido de aprovação completo, decidível sem abrir nada. É o coração da tela Aprovações.

## Anatomia, na ordem de leitura
1. Linha de contexto: `RiskTag`, projeto e tarefa de origem, e há quanto tempo está parado.
2. O que a fábrica quer fazer (`title`), escrito como ação concreta.
3. Por que e Impacto, lado a lado no computador e empilhados no celular.
4. O que será tocado: arquivos, bancos, serviços, em `mono`.
5. Ações: Aprovar, Aprovar com observação, Recusar.

Recusar e Aprovar com observação abrem um campo no próprio cartão. Na recusa o motivo é opcional.

## O consumidor fornece
`title`, `why`, `impact`, `touches[]`, `risk` (`low`, `medium`, `high`), `project`, `task`, `waiting`, `stale` (passou do limite, o tempo fica âmbar), `touch` (botões de 44px), `onApprove`, `onReject(motivo)`, `onApproveWithNote(obs)`.
Para o histórico: `decision` (`approved`, `rejected`, `noted`), `decidedAt`, `note`. Vira uma linha compacta e apagada.

## Regras
- Fila do mais antigo para o mais novo. Nunca reordene por risco: risco alto já ganha borda vermelha.
- `title` começa com verbo e nomeia o alvo: "Rodar a migração que cria a tabela X no banco Y". Nunca "Executar comando".
- Impacto diz o pior caso e se é reversível.
- No celular passe `touch` e deixe o cartão ocupar a largura toda.
