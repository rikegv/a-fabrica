#!/usr/bin/env bash
# liberar.sh, a UNICA porta de liberacao do gate de deploy, §A.7.
#
# DECISAO DO DIRETOR NA OST 7: a fabrica NAO cria a propria autorizacao de
# publicacao. A flag so nasce quando o diretor autoriza por escrito na sessao, e
# o registro guarda AS PALAVRAS DELE, nao um carimbo da fabrica. Se ele nao
# autorizou, nao publica.
#
# Por isso este script EXIGE a frase dele e recusa sem ela. Ele tambem recusa
# frase generica de fabrica, do tipo "liberado" ou "ok", que seria o carimbo
# voltando pela janela.
#
# O LIMITE, dito aqui e tambem no gate: nenhum arquivo impede um agente com
# terminal de escrever outro arquivo. Isto nao torna a forja impossivel, torna a
# forja EXPLICITA, porque obriga quem forjar a inventar por escrito uma frase que
# o diretor nunca disse, e essa frase fica no registro, no commit e na saida do
# gate. O fechamento de verdade e tirar a autorizacao do alcance do agente, e
# esta proposto ao diretor.
#
# Uso:
#   bash scripts/liberar.sh <motivo-curto> "<as palavras do diretor>"
#
# Exemplo, com a frase que ele escreveu na sessao:
#   bash scripts/liberar.sh publicar-painel "Sobe tudo de uma vez, depois que ele validar a Onda 2."

set -euo pipefail

RAIZ="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ESTADO="$RAIZ/.claude/state"

MOTIVO="${1:-}"
PALAVRAS="${2:-}"

# ESTE SCRIPT E DE PESO LEVE, E SO. Branch de feature, §A.21.
#
# Producao tem outra porta, que a fabrica nao abre: scripts/autorizar-producao.sh,
# rodado pelo diretor na mao. Se alguem tentar usar este aqui para producao, a
# recusa e explicita, em vez de criar uma flag que o gate vai ignorar e deixar o
# agente achando que autorizou.
case "$(printf '%s' "$MOTIVO" | tr '[:upper:]' '[:lower:]')" in
  *main* | *producao* | *produção* | *publicar* | *publicacao* | *deploy* | *painel* | *regra* | *indices*)
    echo "liberar: RECUSADO. Isto tem cara de PRODUCAO, e producao nao passa por aqui." >&2
    echo "" >&2
    echo "Peso leve, branch de feature: este script." >&2
    echo "Peso pesado, main e producao: so o diretor, na mao, na sessao:" >&2
    echo "  ! bash scripts/autorizar-producao.sh $MOTIVO \"<as palavras dele>\"" >&2
    exit 2
    ;;
esac

if [ -z "$MOTIVO" ] || [ -z "$PALAVRAS" ]; then
  echo "liberar: RECUSADO, falta argumento." >&2
  echo "Uso: bash scripts/liberar.sh <motivo-curto> \"<as palavras do diretor>\"" >&2
  echo "A autorizacao e a frase DELE. Sem ela, a flag nao nasce." >&2
  exit 2
fi

# Frase curta demais nao e autorizacao, e carimbo.
if [ "${#PALAVRAS}" -lt 15 ]; then
  echo "liberar: RECUSADO, a autorizacao tem ${#PALAVRAS} caractere(s)." >&2
  echo "Isso e carimbo, nao autorizacao. Escreva o que o diretor disse, com as palavras dele." >&2
  exit 2
fi

case "$(printf '%s' "$PALAVRAS" | tr '[:upper:]' '[:lower:]')" in
  "ok"*|"liberado"*|"pode"*|"autorizado"*|"sim"*)
    echo "liberar: RECUSADO, a autorizacao comeca por palavra de carimbo." >&2
    echo "O registro precisa das palavras do diretor, para alguem conferir depois do que se tratava." >&2
    exit 2
    ;;
esac

mkdir -p "$ESTADO"
ARQUIVO="$ESTADO/READY_${MOTIVO}"

{
  echo "autorizacao: $PALAVRAS"
  echo "motivo: $MOTIVO"
  echo "criada em: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "lembrete: remova esta flag logo depois de publicar."
} > "$ARQUIVO"

echo "liberar: flag criada em $ARQUIVO"
echo "autorizacao registrada: $PALAVRAS"
echo "Remova a flag logo depois de publicar."
