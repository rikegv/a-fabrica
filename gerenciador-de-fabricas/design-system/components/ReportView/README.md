# ReportView

Leitura de relatório em formato de documento, confortável para texto longo.

## O consumidor fornece
`title`, `meta` (data, fábrica, duração) e o conteúdo como filhos: `p`, `h2`, `ul`, `ol`, `code`, `strong`, `blockquote`.

## Regras
- Coluna de leitura em `size-reading`, estilo `prose`, linhas de no máximo 68 caracteres.
- Sempre sobre `bg-100` sólido, nunca sobre vidro: blur atrás de texto longo cansa a leitura.
- É a única exceção à regra de tela sem rolagem: a página continua fixa, e só o painel do relatório rola por dentro.
