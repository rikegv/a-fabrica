# Conserto pendente no gate, e por que a fábrica não aplicou

Agente: coordenador, §A.15.

## O que aconteceu

A decisão do diretor na OST 7 tirou o gate do alcance da fábrica: `.claude/settings.json`
passou a negar escrita da fábrica em `scripts/gate-deploy.sh`, em
`scripts/autorizar-producao.sh`, no próprio `settings.json` e em `.claude/state`.

A trava funcionou, e funcionou **na hora**. A fábrica tentou editar o gate e recebeu
recusa da ferramenta, com estas palavras: `File is in a directory that is denied by your
permission settings`. O mesmo na tentativa de mexer no `settings.json`.

Só que ela estava no meio de um conserto de verdade, e ficou do lado de fora. Este arquivo
existe para o conserto não se perder, em vez de alguém achar um jeito de contornar a
trava, que é exatamente o que a regra proíbe.

## O defeito, em uma frase

Um `git push` **sem nomear ramo**, parado em cima da `main`, não é reconhecido como peso
pesado, e seria liberado pela autorização leve da fábrica.

A prova `scripts/prova-gate.sh` cobre esse caso e ele aparece como FALHOU, de propósito:
suíte vermelha com causa escrita vale mais do que suíte verde que mente.

```
  FALHOU push sem nomear ramo, em cima da main, conta como producao: codigo 0 (esperado 2)
```

O que está certo hoje, e provado: push com a palavra `main` na linha é bloqueado; a flag
leve da fábrica não libera main nem publicação; autorização vazia não vale; autorização
vencida não vale; e a fábrica não consegue criar, copiar, renovar nem ler a autorização de
produção.

## O conserto, para o diretor aplicar

Em `scripts/gate-deploy.sh`, dentro do bloco `case "$MOTIVO" in`, trocar este trecho:

```sh
    elif printf '%s' "$COMMAND" | grep -Eq 'git[[:space:]]+push' &&
      ! printf '%s' "$COMMAND" | grep -Eq 'git[[:space:]]+push[^|;&]*[[:space:]][^-][^[:space:]]*[[:space:]][^-]'; then
      RAMO_DE_AGORA="$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
      case "$RAMO_DE_AGORA" in
        main | master) PESO='pesado' ;;
      esac
    fi
```

por este:

```sh
    elif printf '%s' "$COMMAND" | grep -Eq 'git[[:space:]]+push'; then
      # A linha NOMEIA um destino, ou e um push pelado? Push pelado em cima da
      # main e push para a main, e seria um furo bobo deixar passar so porque a
      # palavra main nao esta escrita na linha.
      RESTO="$(printf '%s' "$COMMAND" | sed -n 's/.*git[[:space:]]\{1,\}push[[:space:]]*//p')"
      NOMEOU=0
      for PEDACO in $RESTO; do
        case "$PEDACO" in
          -*) ;;
          *) NOMEOU=1 ;;
        esac
      done
      if [ "$NOMEOU" -eq 0 ]; then
        RAMO_DE_AGORA="$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
        case "$RAMO_DE_AGORA" in
          main | master) PESO='pesado' ;;
        esac
      fi
    fi
```

Depois, para conferir que fechou:

```
! bash scripts/prova-gate.sh
```

## Uma pergunta que fica para o diretor

A trava também impede a fábrica de **manter** o gate: corrigir defeito, acrescentar verbo
vigiado, cobrir ferramenta nova. Isso é o preço do controle, e é um preço real, não uma
formalidade: cada conserto do gate passa a depender de você.

Duas saídas, as duas decisão sua, nenhuma construída:

1. **Fica como está.** O gate só muda pela sua mão. Mais seguro, mais lento.
2. **A fábrica propõe, você aplica.** A fábrica escreve o conserto num arquivo ao lado,
   como este, e você aplica com um comando depois de ler. É o que está acontecendo agora,
   e funcionou: o defeito não sumiu e ninguém contornou a trava.

## O arquivo de prova que ficou preso

A fábrica criou `.claude/state/PROD_prova-da-trava` para testar a negação, ANTES de ela
pegar. Ele **não é autorização**: não tem a linha `autorizacao:`, então o gate o recusa.
Mas a fábrica não consegue mais removê-lo, porque o gate bloqueia qualquer comando dela que
mencione esse caminho. Para apagar, um comando seu:

```
! rm -f .claude/state/PROD_prova-da-trava
```
