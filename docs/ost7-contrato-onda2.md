# Contrato da Onda 2, o painel vira posto de comando

Decidido pelo **coordenador** na OST 7 Bloco 2, antes de qualquer código, para as duas
metades (painel e ponte) fecharem sem conversa no meio. Quem muda este contrato avisa a
outra metade.

Base: `docs/contrato-tres-pecas.md`, que continua valendo inteiro. Este documento só
ACRESCENTA o que a Onda 2 precisa.

## 1. A regra de ouro não muda, §A.3

O painel **nunca** fala com a fábrica. O painel escreve em `comandos` e em `aprovacoes`;
a ponte lê e executa. A ponte escreve em `fabricas`, `atividade` e `aprovacoes`; o painel
lê. Nenhuma exceção nesta onda.

## 2. `comandos`, o campo novo `acao`

O documento de comando já existe e as regras do Firestore já o cobrem. A Onda 2
acrescenta **um** campo, `acao`, e nada mais.

| `acao` | O que significa | Campos que ela usa além dos obrigatórios |
| --- | --- | --- |
| `abrir` | Nasce uma fábrica nova | `cwd` (pasta do projeto), `agente`, `modelo` |
| `comando` | Texto para uma fábrica que já existe | `conversationId`, quando houver |
| `encerrar` | Encerra a fábrica, sem volta | nenhum |
| `pausar` | Para a fábrica, guardando a conversa | nenhum |
| `reiniciar` | Retoma a fábrica pausada | `conversationId` |

Compatibilidade, e ela é obrigatória: comando **sem** o campo `acao` vale como `comando`.
Os sete testes da OST 6 escrevem sem `acao` e têm de continuar passando sem uma linha de
mudança neles.

Campos obrigatórios, que a regra do Firestore já exige e continua exigindo:
`fabricaId`, `maquinaId`, `texto`, `situacao`, `criadoEm`, `origem`.

- `situacao` nasce `pendente` e só a ponte muda para `entregue`, uma vez, §A.6.
- `criadoEm` e `entregueEm` são hora do SERVIDOR. A regra nega hora de cliente.
- `origem` é texto legível que diz de onde a ordem veio, por exemplo
  `painel no computador, henrique.vieira@soulan.com.br`.
- `texto` tem de estar preenchido, inclusive em `encerrar`, `pausar` e `reiniciar`. Nessas
  três, o painel escreve a frase que o diretor leria na trilha, por exemplo
  `encerrar a fábrica`. A trilha não se apaga, então ela tem de ser legível por pessoa.

## 3. `fabricas`, os campos novos

| Campo | Quem escreve | Para quê |
| --- | --- | --- |
| `origem` | ponte | `painel` ou `mao`. Diz se a fábrica nasceu pelo painel ou se o diretor abriu na mão. A fábrica aberta na mão vem do Bloco 1, com identificador prefixado por `mao-` |
| `pausada` | ponte | `true` enquanto a fábrica está pausada |
| `encerradaEm` | ponte | hora do servidor do encerramento pedido pelo painel |
| `pedidoDeEncerramento` | ponte | texto do motivo, quando houver |

### Por que `pausada` é campo e não estado novo

§A.4 fecha a lista de estados: em execução, aguardando aprovação, aguardando comando,
concluída, falhou, ponte offline. Pausada não está lá, e §A.12 proíbe a fábrica de
inventar escopo. Então a fábrica pausada fica em `aguardando comando`, que é a verdade do
que ela é (parada, esperando ordem), com `pausada: true` para a tela poder dizer a palavra
certa ao diretor.

**Proposta ao diretor, não construída:** se ele quiser `pausada` como estado de primeira
classe no §A.4, é uma linha na constituição e um ajuste pequeno nas duas pontas.

## 4. `aprovacoes`, a resposta do diretor

Nada muda na forma. O que a Onda 2 acrescenta é o painel **escrevendo** a resposta, que
antes só o teste escrevia:

```
situacao:      'pendente'  ->  'respondida'     (uma vez só, a regra garante)
resposta:      'aprovado' | 'recusado' | 'aprovado com observacao'
observacao:    texto ou null
respondidoEm:  hora do SERVIDOR, obrigatória
respondidoPor: texto preenchido, obrigatório
```

As três respostas que a tela oferece, e o que cada uma faz na ponte:

| Botão na tela | `resposta` | `observacao` | A ponte |
| --- | --- | --- | --- |
| Aprovar | `aprovado` | `null` | executa |
| Aprovar com observação | `aprovado com observacao` | texto do diretor, obrigatório | executa, e a observação fica na trilha |
| Recusar | `recusado` | texto do diretor, **opcional** | não executa, e devolve o motivo ao agente |

Resposta tardia é negada pela própria base: pedido já respondido não aceita segunda
resposta. Isso foi fechado na OST 6 parte 2 e continua valendo.

## 5. O portão da OST 4 continua inteiro

Toda abertura de fábrica, inclusive a que nasce pelo painel, passa pelas três ressalvas,
sem exceção e sem bandeira para desligar:

1. verificação do portão com isca antes de abrir, nas mesmas opções e ambiente;
2. limpeza das variáveis de aninhamento do Claude Code;
3. modo de permissão fixado na mão e conferido no evento de início.

Falha fechada: qualquer uma falhando, a fábrica **não nasce**, e o motivo vai para a base
no campo `erro` da fábrica.

Nada de risco executa sem resposta do diretor. Não existe pré-autorização, não existe
aprovação automática, e o painel não ganha nenhum botão que dispense o portão.

## 6. O que o painel NÃO faz nesta onda

§A.12, escopo fechado. Fora desta OST, e dito como pendência e não como esquecimento:

- aviso no celular, que exige plano pago no Google Cloud;
- telas de Relatórios, Indicadores e Configurações;
- cadastro de projetos (é F7, Configurações). Enquanto não existir, a tela de nova
  fábrica oferece os caminhos de projeto que já apareceram na base e aceita um caminho
  escrito à mão.

## 7. Regras de tela que valem em tudo

- §A.11, travessão PROIBIDO em qualquer texto que o diretor lê.
- Tela única, sem rolagem da página, no computador.
- Celular com desenho próprio, alvo de toque de 44 pontos no mínimo.
- Toda ação que não tem volta pede confirmação: encerrar fábrica, sempre.
- O pacote de aprovação na tela mostra o que é **fato capturado** e o que é **leitura da
  ponte**, do jeito que já foi aprovado na OST 2.
- Nenhum botão de escrita fica clicável com a ponte offline, e a tela diz por quê.
