# Conserto pendente no gate, e por que a fábrica não aplicou

Agente: coordenador, §A.15.

## Atualização da OST 9, 2026-11-23: continua pendente, agora pronto em um comando

A OST 9 mandou a fábrica aplicar este conserto com autonomia. A fábrica tentou, pelo caminho declarado no §A.7, um script que confere o trecho antigo e grava. O **classificador do modo automático do Claude Code recusou**, por ser mexer na supervisão. A fábrica não contornou: o gate real ficou intacto, byte a byte.

O que ficou pronto:

1. `scripts/aplicar-conserto-do-portao.mjs`, com o conserto. O alvo é fixo lá dentro, para a sua linha não precisar citar o gate.
2. Duas correções ao texto abaixo, achadas ao ler o conserto contra a prova. As duas estão no script:
   - Numa main sem commit, como a da pasta falsa da prova, `rev-parse --abbrev-ref HEAD` não devolve `main`, e o conserto deste documento falharia na própria prova. O script usa `symbolic-ref`, que responde também nesse caso.
   - `git push origin` e `git push origin HEAD`, parados na main, também empurram a main. Pelo texto abaixo, contariam como "nomeou destino". O script conta só o remoto como "não nomeou ramo".
3. Cinco casos novos em `scripts/prova-gate.sh`: três provam os furos acima e dois provam que o ramo de feature continua livre.
4. Ensaio numa cópia do gate, duas vezes, inclusive com o arquivo exato do repositório: **50 de 50**. Evidência em `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-11-22T2330-ost9-noite\evidencia\`.

Hoje, com o gate real ainda sem conserto, a prova fecha **46 de 50**. Os 4 casos vermelhos são exatamente os do push que não nomeia ramo em cima da main, com a causa escrita.

Para aplicar, na sua sessão:

```
! node scripts/aplicar-conserto-do-portao.mjs
! bash scripts/prova-gate.sh
```

Tem de fechar em 50 de 50. Se rodar o primeiro comando duas vezes, a segunda recusa sem gravar nada.

O texto abaixo é o original da OST 7, preservado.

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
