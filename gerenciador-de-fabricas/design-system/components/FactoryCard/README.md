# FactoryCard

Cartão de uma fábrica ativa na Visão geral: projeto, estado, o que está fazendo agora, tempo e consumo.

## O consumidor fornece
`project`, `agent`, `state`, `doing` (uma frase no presente, até duas linhas), `elapsed`, `usage`, `pending` (texto do pedido parado, quando houver) e `onOpen`.

## Ordem na grade
1. `approval` e `failed` primeiro, mais antigo antes. Ganham borda na cor do estado.
2. `running`.
3. `idle` e `done` por último, com opacidade reduzida: recuam de propósito.

## Escrita da linha `doing`
- Verbo no gerúndio quando rodando: "Escrevendo testes do fluxo de triagem."
- Quando parada, diga o que falta: "Quer rodar a migração..." ou "Parou no passo 7: ...".
- Nada de "Processando..." ou "Trabalhando na tarefa". Se não sabe o que é, mostre o último passo da linha do tempo.

## Layout
Na Visão geral, grade fixa de 3 colunas e 2 linhas (6 cartões) com gap `space-3`, preenchendo o painel sem rolagem. Mais de 6 fábricas ativas: os 6 mais urgentes aparecem e o cabeçalho do painel mostra "Ver todas (9)". No celular, uma coluna com no máximo 4.
