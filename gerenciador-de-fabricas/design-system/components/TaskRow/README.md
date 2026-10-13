# TaskRow

Linha da aba Tarefas: uma tarefa delegada nessa fábrica e a situação dela.

## O consumidor fornece
`state`, `title`, `agent` (quem está fazendo), `elapsed`, `stateLabel` opcional.

## Regras
- Use dentro de um contêiner `gf-card gf-glass`; as linhas se separam por `line-100`.
- Ordem: aguardando aprovação e falhas em cima, depois em execução, depois concluídas.
