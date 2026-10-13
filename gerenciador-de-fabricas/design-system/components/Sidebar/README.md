# Sidebar

Menu lateral de vidro, fixo em todas as telas do computador. Leva a navegação, os projetos com o estado de cada um e a ponte.

## O consumidor fornece
`items[]` (`id`, `label`, `icon` opcional, `count`, `alert` para o contador âmbar sólido), `value`, `onChange`, `projects[]` (`name`, `state`, `count`), `bridge` (as props de `BridgeStatus`), `brand`, `owner`, `collapsed`.

## Itens, nesta ordem
Visão geral, Aprovações, Fábricas, Relatórios, Indicadores, Configurações. Aprovações leva `alert` quando há pedido: é o único contador colorido do menu.

## Regras
- Aberto com `size-sidebar` a partir de 1280px. Abaixo disso, `collapsed` vira trilho de ícones com `size-rail`, e o rótulo vai para o tooltip.
- Ocupa a altura toda da tela, com `space-3` de margem, e nunca rola. Lista de projetos longa corta no fim; projetos completos ficam em Configurações.
- A ponte fica no pé do menu. Offline, além do menu, a tela mostra `AlertBanner tone="offline"`.
