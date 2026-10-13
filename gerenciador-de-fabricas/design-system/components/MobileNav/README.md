# MobileNav

Barra inferior do celular, na ordem de prioridade de uso.

## O consumidor fornece
`items[]` (`id`, `label`, `count`, `icon` opcional entre `approvals`, `factories`, `reports`, `more`), `value`, `onChange`.

## Regras
- Ordem fixa: Aprovações, Fábricas, Relatórios, Mais. Indicadores e Configurações ficam em Mais.
- O contador de Aprovações é âmbar sólido e só aparece quando há pedido.
- O comando não é aba: ele vive no rodapé da tela de cada fábrica.
- Só no celular. No computador a navegação é o `Sidebar`.
- Flutua sobre o conteúdo como vidro forte, com `radius-xl` e margem de `space-3` das bordas.
