# Pager

Paginação compacta: "1 de 3" e duas setas. É o que substitui a rolagem em listas.

## O consumidor fornece
`page`, `total`, `onChange(página)`, `label` opcional.

## Regras
- Fica no canto inferior direito do painel que pagina.
- Calcule quantos itens cabem no painel e pagine por esse número. Nunca deixe a lista criar rolagem.
