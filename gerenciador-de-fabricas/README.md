# Gerenciador de Fábricas: pacote de entrega

Este pacote leva o design system e o protótipo navegável do Gerenciador de Fábricas: um painel de uso individual para comandar várias sessões de agentes de IA (fábricas) ao mesmo tempo, no computador e no celular, no mesmo endereço.

**Para o Claude Code:** leia este arquivo inteiro antes de escrever código. Depois leia `design-system/README.md` (o manual visual) e o `README.md` de cada componente que for usar.

## O que é cada coisa

```
gerenciador-de-fabricas/
  README.md                  este arquivo
  design-system/
    README.md                manual: princípios, cor, tipo, vidro, layout, celular
    tokens.json              fonte única de cor, tipo, espaço, raio, sombra, blur e tamanhos
    tokens.css               gerado de tokens.json (variáveis CSS e classes de texto)
    components/
      bundle.js              os 24 componentes em React 18 (script clássico, sem build)
      bundle.css             estilos de todos os componentes e das telas
      index.d.ts             props de cada componente (documentação de tipos)
      <Componente>/README.md quando usar, o que recebe, regras
  prototipo/
    computador.html          protótipo do computador (1440 x 900, sem rolagem)
    celular.html             protótipo do celular (390 x 844)
    computador.js            telas do computador
    celular.js               telas do celular
    dados.js                 dados de exemplo (fábricas, aprovações, relatórios)
```

## Como abrir o protótipo

Abra `prototipo/computador.html` ou `prototipo/celular.html` no navegador. Ele precisa de internet para carregar React 18.3.1 do cdnjs e as fontes do Google Fonts.

Para abrir direto numa tela: `computador.html?tela=approvals`. Telas do computador: `overview`, `factories`, `factory`, `approvals`, `new`, `reports`, `metrics`, `settings`. Telas do celular: `approvals`, `factories`, `factory`, `reports`, `report`, `more`, `metrics`, `settings`, `new`.

## O que é protótipo e o que é produto

O protótipo serve para validar a interface. **Não é a base do produto.**

- Os componentes em `bundle.js` são reais e reaproveitáveis: estado visual, props, acessibilidade básica.
- As telas em `computador.js` e `celular.js` são montagens de demonstração: estado em memória, dados falsos de `dados.js`, sem rede.
- A ponte local não existe no protótipo. Clicar em "Ponte conectada" só simula a queda.

Construa o produto na stack do projeto e porte os componentes para ela. Mantenha `tokens.json` como fonte única: qualquer cor, tamanho ou raio novo entra lá primeiro.

## Regras que não podem quebrar

1. **Sem travessão em texto de tela.** Nem o traço longo nem o médio, em título, botão, rótulo, mensagem ou descrição. Use vírgula, dois-pontos, ponto ou parênteses. Para separar metadados use o ponto médio: `Claude Code · Opus`.
2. **Tela única, sem rolagem da página.** A aplicação ocupa a janela inteira e a página nunca rola, nem na vertical nem na horizontal. O que não cabe vira paginação (`Pager`, "1 de 3"), filtro ou outra tela.
3. **Únicas rolagens internas permitidas:** o leitor de relatório (`gf-reader-scroll`) e, no celular baixo, os detalhes de um pedido de aprovação acima dos botões fixos (`gf-ap-content`). Os botões de decisão nunca saem da tela.
4. **O que pede ação vem antes do que só informa.** Aprovações pendentes, falhas e ponte offline ficam no topo e com mais peso visual.
5. **Estado nunca só pela cor.** Cada estado tem cor, forma de ícone e palavra (`StateBadge`, `StateIcon`).
6. **A cor é reservada para estado.** Botão primário, vidro e gráficos são neutros.
7. **Texto longo nunca sobre vidro.** Relatório, campos e menus abertos usam `bg-100` sólido.
8. **Contraste:** todo texto passa 4.5:1 nos dois temas, medido sobre o vidro no ponto mais claro do brilho do fundo. Ao criar um par novo de cor, meça.
9. **Celular é desenho próprio, não encolhimento.** Abaixo de 560px a navegação é a `MobileNav` na base (Aprovações, Fábricas, Relatórios, Mais), e todo alvo de toque tem 44px.
10. **Encerrar fábrica sempre pede confirmação.**

## Estados de fábrica

| Valor | Texto na tela | Forma do ícone |
| --- | --- | --- |
| `running` | Em execução | ponto com anel pulsando |
| `approval` | Aguardando aprovação | losango cheio |
| `idle` | Aguardando comando | círculo vazio |
| `done` | Concluída | círculo com visto |
| `failed` | Falhou | X |
| `offline` | Ponte offline | círculo tracejado cortado |

Ponte offline é um estado do sistema inteiro, não de uma fábrica só. Quando a ponte cai, todas as fábricas passam a `offline`, aparece `AlertBanner tone="offline"` e a caixa de comando fica desabilitada dizendo por quê.

## Dados que a interface espera

Estes formatos saem do protótipo. São o mínimo que cada tela precisa; a fonte real (a ponte local) define o resto.

```ts
type FactoryState = 'running' | 'approval' | 'idle' | 'done' | 'failed' | 'offline';
type Risk = 'low' | 'medium' | 'high';

interface Factory {
  id: string;
  project: string;          // nome do projeto
  folder: string;           // pasta do projeto na máquina local
  agent: string;            // ex.: "Claude Code"
  model: string;            // ex.: "Opus"
  state: FactoryState;
  doing: string;            // uma frase: gerúndio quando roda, o que falta quando para
  startedAt: string;        // para calcular o tempo decorrido
  tokens: number;           // consumo acumulado
  agents: number;           // agentes ativos agora
  tasksDone: number;
}

interface Approval {
  id: string;
  factoryId: string;
  project: string;
  task: string;             // tarefa que originou o pedido
  title: string;            // o que a fábrica quer fazer, começando por verbo
  why: string;
  impact: string;           // pior caso e se é reversível
  touches: string[];        // arquivos, bancos, serviços
  risk: Risk;
  requestedAt: string;      // para "parado há 18 min" e ordenar do mais antigo
}

interface ApprovalDecision {
  approvalId: string;
  decision: 'approved' | 'rejected' | 'noted';  // noted = aprovado com observação
  note?: string;            // motivo da recusa (opcional) ou observação
  decidedAt: string;
}

interface TimelineEvent { at: string; kind: 'step' | 'approval' | 'error' | 'done'; text: string; detail?: string; }
interface Task { title: string; agent: string; state: FactoryState; startedAt: string; }
interface Change { path: string; kind: 'added' | 'modified' | 'removed'; add?: number; del?: number; }
interface Report { id: string; factoryId?: string; daily?: boolean; title: string; createdAt: string; durationMin: number; body: string; }
interface SavedCommand { name: string; text: string; }
interface Bridge { online: boolean; machine: string; version: string; latencyMs?: number; lastSeenAt: string; connectedSince: string; }
interface NotificationPrefs { approval: boolean; failed: boolean; bridgeOffline: boolean; done: boolean; dailyReport: boolean; quietHours: boolean; }
```

Ações que a interface dispara: aprovar, recusar (com motivo opcional), aprovar com observação, enviar comando a uma fábrica, pausar, retomar, reiniciar, encerrar, abrir nova fábrica (projeto, agente, modelo, comando inicial).

A Visão geral, a Fábrica e as Aprovações precisam de atualização ao vivo (novo passo, novo pedido, mudança de estado). O protótipo não define o transporte.

## Formatos de texto

- Tempo: `1h 12min`, `34min`. Consumo: `412 mil tokens`, `1,2 mi tokens`. Datas: `hoje, 10:42`, `ontem, 17:15`.
- Botão é verbo no infinitivo, sem ponto: Aprovar, Recusar, Enviar, Abrir nova fábrica.
- Sem emoji. Sem "Processando...", "Ação realizada com sucesso", "Por favor".

## Decisões ainda abertas (perguntar ao Rike antes de construir)

1. **Agentes:** só "Claude Code" está previsto. Quais outros agentes entram?
2. **Histórico completo da fábrica:** a linha do tempo mostra os 6 passos mais recentes e um link "Ver histórico completo". Essa tela não existe. Paginada ou com rolagem interna?
3. **Pedido de aprovação no celular baixo:** hoje os detalhes rolam por dentro acima dos botões fixos. A alternativa é mostrar só título e impacto e abrir o resto num toque.
4. **Transporte da ponte e avisos no celular:** como a ponte expõe os dados e como os avisos chegam ao telefone.

## Fontes

Manrope (interface, números, leitura) e JetBrains Mono (caminhos, horários, consumo), as duas do Google Fonts, importadas no topo de `bundle.css`. Se o produto não puder carregar fonte externa, hospede os arquivos localmente com os mesmos nomes de família.
