# OST 13, Onda 0: a fábrica parou antes de começar

Data: 24/11/2026, à noite. Quem escreveu: o coordenador, na sessão aberta em `painel/`.

## O que a conferência achou

A OST 13 mandou, no item 1, conferir em qual pasta esta sessão foi aberta. A resposta é: dentro de `C:\Users\Henrique\a-fabrica\painel`, e não na raiz do projeto.

A prova, feita na própria sessão:

1. A pasta de trabalho da sessão é `C:\Users\Henrique\a-fabrica\painel`.
2. Escrevi um texto inofensivo com as palavras `git push` (só texto, nenhum push de verdade), uma vez pelo PowerShell e outra pelo Bash. O portão do §A.7 bloqueia qualquer comando com essas palavras quando não existe a flag READY_. Nas duas ferramentas, o texto passou sem bloqueio. Ou seja: o portão não está rodando nesta sessão.
3. A pasta `painel/` não tem `.claude/settings.json` próprio. O Claude Code lê o settings.json da pasta onde a sessão abriu, e por isso o portão e as negações de escrita da raiz não valem aqui. O CLAUDE.md vale, porque ele é lido também das pastas acima. Isso explica por que as regras estavam presentes e as travas não.

Pela OST 13, sem trava não se segue. A fábrica parou aqui e não fez nenhum item das Ondas 1, 2 e 3.

## Correção do que foi dito na OST 12

No relatório da OST 12, eu disse que os dois pushes do ramo feature/ost5-madrugada (commits `ce0b123` e `d8a6872`) passaram pelo portão com a flag de peso leve. Isso está errado. Eu criei a flag e a removi depois, mas o portão não rodou, e o push teria subido mesmo sem a flag. Os dois pushes foram de ramo de feature, que o §A.21 libera. Nenhum foi para a main nem para a produção. Mesmo assim, a afirmação de que o portão foi conferido não era verdadeira.

Este arquivo não foi enviado ao GitHub. Subir agora seria um push sem portão, e a OST 13 pede para não seguir sem trava.

## Como reabrir na raiz, pela manhã

No terminal do Antigravity (PowerShell), digite, uma linha por vez:

```
cd C:\Users\Henrique\a-fabrica
claude
```

Dentro do Claude, para ligar o acesso pelo celular:

```
/remote-control A Fabrica
```

Depois, cole a OST 13 de novo. A primeira coisa que a fábrica vai fazer é a Onda 0 outra vez: provar que o portão bloqueia (`scripts/prova-gate.sh`) antes de seguir.

Se preferir abrir pelo painel, escolha o projeto a-fabrica na abertura de nova fábrica. O painel abre na raiz.

## Com o diretor

1. Reabrir a sessão na raiz, como explicado acima. É o que destrava a OST 13 inteira.
2. Decidir se esta sessão de `painel/` deve ser encerrada. Ela continua sem portão enquanto estiver aberta.
