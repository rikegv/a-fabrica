Painel de uso individual para comandar várias fábricas de agentes ao mesmo tempo. Escuro, de vidro e de tela única: tudo que importa cabe em uma visualização, sem rolar a página. A cor existe para dizer estado, e o que pede ação do dono salta acima de todo o resto.

## Princípios

1. **Uma tela, sem rolagem.** A aplicação ocupa exatamente a janela (`gf-app`, 100dvh). A página nunca rola, nem na vertical nem na horizontal. O que não cabe vira paginação (1 de 3), "Ver todas" ou outra tela, nunca barra de rolagem.
2. **Ação acima de informação.** O painel Aguardando você fica sempre visível na Visão geral. Falhas e pedidos parados encabeçam a grade de fábricas.
3. **Estado se lê pela cor antes do texto, e nunca só pela cor.** Cada estado tem cor, forma de ícone e palavra.
4. **A cor é reservada.** Vidro, botões e gráficos são neutros. Se algo tem cor, tem estado.

## Layout da tela única

- `gf-app`: grade de duas colunas com `space-3` de respiro em volta. À esquerda o `Sidebar` (`size-sidebar`, recolhe para `size-rail` abaixo de 1280px). À direita `gf-main`.
- `gf-main`, de cima para baixo: barra superior (`size-topbar`) com título da tela e o botão primário; linha de KPIs (`gf-kpis`, cinco `KpiTile`); corpo (`gf-body`) que ocupa o resto da altura.
- Corpo da Visão geral: painel Fábricas à esquerda (grade 3 por 2, seis cartões, `gf-fgrid`) e `ApprovalDeck` à direita, com 400px.
- Altura mínima de projeto: 1366 x 768. Abaixo disso, a grade de fábricas cai para 2 colunas e o quinto KPI some, sem criar rolagem.
- **Única exceção:** a leitura de relatório. A página continua fixa, e só o painel do `ReportView` rola por dentro. Texto longo não cabe em tela única sem ficar ilegível.

## Vidro

- `glass` com `blur-glass` em tudo que é estrutura: menu lateral, KPIs, painel Fábricas, cartões. `glass-strong` com `blur-strong` em item ativo, caixa de comando e barra do celular.
- Todo vidro tem borda `glass-line`, o fio de luz `glass-highlight` no topo e `shadow-glass`. Sem esses três ele parece só um cinza.
- Por trás de tudo, o fundo `gf-ambient`: `bg-000` com dois brilhos muito suaves, `glow-warm` no canto superior direito (atrás das aprovações) e `glow-cool` no inferior esquerdo. O vidro precisa de algo atrás para parecer vidro, mas o brilho nunca passa de uma sugestão.
- **Texto longo nunca sobre vidro.** Relatório, campo de texto e menu aberto usam `bg-100` sólido.

## Escrita

- **Proibido travessão** (o traço longo e o médio) em qualquer texto de tela. Use vírgula, dois-pontos, ponto ou parênteses. Para separar metadados use o ponto médio: `Claude Code · Opus`.
- Português direto, frase curta. Sem "Processando...", "Ação realizada com sucesso", "Por favor".
- Botão é verbo no infinitivo, sem ponto: Aprovar, Recusar, Enviar, Abrir nova fábrica.
- Número junto da coisa: "parado há 18 min", "3 de 6". Formatos pt-BR: `1h 12min`, `2,4 mi tokens`, `412 mil tokens`, `hoje, 10:42`.
- A linha do que a fábrica faz é no gerúndio quando roda ("Escrevendo testes do upload") e diz o que falta quando para ("Quer rodar a migração 0042", "Parou no passo 7: a API devolveu 502").
- Sem emoji.

## Cor

Tema escuro é o principal; o claro existe para o celular no sol. Todo texto passa 4.5:1 nos dois temas, medido sobre o vidro em cima do ponto mais claro do brilho ambiente.

- Texto `ink` em tudo que importa, `ink-muted` em metadado e rótulo, `ink-faint` só em hora e unidade.
- Bordas de controle `line-200` (3:1). Divisores `line-100`, decorativos.
- Botão primário `action` com `on-action`: branco no escuro, preto no claro. Nunca colorido.
- Gráficos de KPI em `chart-line` e `chart-fill`: neutros.

### Estados

| Estado | Token | Forma | Uso de cor |
| --- | --- | --- | --- |
| Em execução | `state-running` | ponto com anel pulsando | selo, ponto do projeto no menu |
| Aguardando aprovação | `state-approval` | losango cheio | o mais forte: contador sólido `state-approval-solid`, borda e halo do cartão |
| Aguardando comando | `state-idle` | círculo vazio | só o selo; o cartão recua com opacidade |
| Concluída | `state-done` | círculo com visto | só o selo; o cartão recua |
| Falhou | `state-failed` | X | selo e borda do cartão |
| Ponte offline | `state-offline` | círculo tracejado cortado | indicador da ponte e faixa sólida |

Cada estado tem `state-*-bg` para selos. Sólidos têm texto próprio: `on-approval`, `on-offline`, `on-failed`. Risco usa `risk-low`, `risk-medium`, `risk-high`.

## Tipografia

Manrope para interface, números e leitura; JetBrains Mono para caminhos, horários e consumo. Manrope tem desenho geométrico refinado e algarismos elegantes em peso leve, o que sustenta os KPIs grandes.

- `kpi` (34px, peso 300) para o número do indicador, com `kpi-unit` ao lado em `ink-faint`. O contraste entre número leve e grande e rótulo pequeno em caixa alta é a assinatura do painel.
- `label` (10.5px, 700, espaçado, caixa alta) para títulos de KPI, seções do menu e blocos do pedido.
- `title-lg` um por tela, na barra superior. `title-md` título de painel. `title-sm` cartões e pedidos.
- `body`, `body-strong`, `caption` para a interface. `prose` e `prose-heading` só no relatório. `mono` para dado técnico.

## Espaço, forma e foco

- Grade de 4px: `space-1` a `space-6`. Gap entre regiões `space-3`, padding de painel `space-5`, de cartão `space-4`.
- Raios generosos: `radius-sm` selos, `radius-md` botões e itens de menu, `radius-lg` cartões e KPIs, `radius-xl` painéis grandes e menu, `radius-pill` ponte.
- Anel de foco `focus`, 2px sólido com 2px de afastamento.
- Movimento: só o pulso de Em execução e transições de 150ms em hover. Respeita `prefers-reduced-motion`.

## Telas

Cada tela tem uma página de protótipo navegável (`Tela1VisaoGeral` a `Tela7Configuracoes`, e `Celular1` a `Celular5`). Todas rodam o mesmo protótipo; só muda a tela inicial.

- **Visão geral:** KPIs, grade de Fábricas e `ApprovalDeck`.
- **Fábricas:** todas as fábricas com filtro (`Segmented`): Todas, Precisam de mim, Rodando, Paradas.
- **Fábrica (posto de comando):** `FactoryHeader`, `Tabs`, aba ativa no corpo e `CommandBox` fixo no pé. À direita, o pedido parado desta fábrica, quatro `KpiTile` e os agentes. A linha do tempo mostra os passos que cabem; "Ver histórico completo" abre o resto.
- **Aprovações:** `ApprovalDeck` à esquerda; histórico com filtro e `Pager` à direita.
- **Nova fábrica:** projeto em cartões, agente e modelo em `Segmented`, comando inicial e comandos salvos ao lado.
- **Relatórios:** lista com busca e período à esquerda; leitor sobre `bg-100` à direita, com rolagem interna, barra de progresso de leitura e "% lido". É a única rolagem do produto.
- **Indicadores:** cinco KPIs, consumo por dia e tarefas por dia (`BarChart`), consumo por projeto e tabela por fábrica.
- **Configurações:** projetos e pastas, ponte local, avisos no celular (`Toggle`).
- Ponte offline: `AlertBanner tone="offline"` entra entre a barra superior e o corpo, e a caixa de comando fica desabilitada dizendo por quê.

## Celular

Mesmo endereço, desenho próprio (ver `VisaoGeralCelular`). Abaixo de 560px:

- `MobileNav` flutuante na base: Aprovações, Fábricas, Relatórios, Mais. Indicadores e Configurações ficam em Mais.
- Entrada em Aprovações quando há pedido. Um pedido por vez no `ApprovalDeck` com `touch`: Aprovar ocupa a largura toda, os outros dois embaixo. Também sem rolagem.
- Os botões de decisão ficam sempre fixos no pé do pedido. Em telefone baixo (667px ou menos), só os detalhes acima deles rolam por dentro; os botões nunca saem da tela.
- Aprovações tem Pendentes e Histórico num `Segmented`; o histórico pagina de 5 em 5.
- Fábricas no celular: filtro e quatro cartões por página, com `Pager`.
- Ações da fábrica (Pausar, Reiniciar, Encerrar) e Comandos salvos abrem numa folha que sobe de baixo (`gf-sheet`). Encerrar sempre pede confirmação na própria folha.
- Indicadores e Configurações ficam em Mais. Configurações no celular tem Avisos, Ponte, Projetos e Tema; adicionar ou editar projeto é só no computador.
- Todo alvo de toque com `size-touch` (44px).

## Ícones

Sem biblioteca externa. Os ícones são SVG do próprio sistema (`Icon`, `StateIcon`), traço de 1.6px, cor `currentColor`, grade de 20px (navegação) ou 12px (estado). Ícone novo segue o mesmo traço e nunca aparece sem rótulo, salvo no menu recolhido, onde o rótulo vai para o tooltip.
