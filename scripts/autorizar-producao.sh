#!/usr/bin/env bash
# autorizar-producao.sh, a autorizacao de PESO PESADO, §A.7.
#
# ESTE SCRIPT E DO DIRETOR, NAO DA FABRICA.
#
# Ele cria a autorizacao que o gate exige para push na main e para qualquer
# publicacao em producao. A fabrica NAO roda este script: o gate bloqueia, de
# primeira ordem, qualquer comando dela que mencione PROD_ ou o nome deste
# arquivo. Quem roda e o diretor, na propria sessao, com o prefixo de exclamacao,
# que executa fora das chamadas de ferramenta da fabrica:
#
#   ! bash scripts/autorizar-producao.sh subir-main "Sobe tudo de uma vez, eu validei a Onda 2 na tela."
#
# POR QUE E DE UMA VEZ E COM VALIDADE CURTA
# -----------------------------------------
# Para palavra de ontem nao autorizar hoje. Sem prazo, uma frase de uma rodada
# antiga ficaria no disco autorizando publicacao para sempre, e a fabrica so
# precisaria esperar. Com prazo de 30 minutos e remocao depois do uso, cada
# publicacao em producao precisa de uma decisao do diretor daquele momento.
#
# O LIMITE, dito aqui e no CLAUDE.md, porque esconder limite de seguranca e pior
# do que nao ter o controle: a fabrica roda como o MESMO usuario do Windows que o
# diretor. Tudo que ele escreve, ela consegue escrever. Isto nao e uma parede, e
# uma porta com fechadura e campainha: a fabrica so passa desobedecendo de forma
# explicita, deixando rastro em tres lugares. Parede de verdade so existe fora
# desta maquina, com protecao de branch no GitHub e credencial de publicacao que
# a fabrica nao possua.

set -euo pipefail

RAIZ="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ESTADO="$RAIZ/.claude/state"

MOTIVO="${1:-}"
PALAVRAS="${2:-}"

if [ -z "$MOTIVO" ] || [ -z "$PALAVRAS" ]; then
  echo "autorizar-producao: RECUSADO, falta argumento." >&2
  echo "" >&2
  echo "Uso, e quem roda e voce, diretor, com o prefixo de exclamacao:" >&2
  echo "  ! bash scripts/autorizar-producao.sh <motivo-curto> \"<as suas palavras>\"" >&2
  echo "" >&2
  echo "As suas palavras ficam registradas na autorizacao, no gate e no commit." >&2
  exit 2
fi

if [ "${#PALAVRAS}" -lt 15 ]; then
  echo "autorizar-producao: RECUSADO, a autorizacao tem ${#PALAVRAS} caractere(s)." >&2
  echo "Isso e carimbo, nao autorizacao. Escreva o que voce esta autorizando, com as suas palavras." >&2
  exit 2
fi

case "$(printf '%s' "$PALAVRAS" | tr '[:upper:]' '[:lower:]')" in
  "ok"* | "liberado"* | "pode"* | "autorizado"* | "sim"*)
    echo "autorizar-producao: RECUSADO, a autorizacao comeca por palavra de carimbo." >&2
    echo "O registro precisa das suas palavras, para alguem conferir depois do que se tratava." >&2
    exit 2
    ;;
esac

# Autorizacao de producao e de UMA VEZ: a anterior sai de cena antes, nomeada, uma
# por uma, §A.18. Nada e apagado as cegas e nada por curinga sobre variavel solta.
if ls "$ESTADO"/PROD_* >/dev/null 2>&1; then
  echo "Existe autorizacao de producao anterior. Removendo, uma por uma, antes de criar a nova:"
  for ANTERIOR in "$ESTADO"/PROD_*; do
    echo "  removendo $ANTERIOR"
    rm -f "$ANTERIOR"
  done
fi

mkdir -p "$ESTADO"
ARQUIVO="$ESTADO/PROD_${MOTIVO}"

{
  echo "autorizacao: $PALAVRAS"
  echo "motivo: $MOTIVO"
  echo "peso: producao"
  echo "criada em: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "validade: 30 minutos, e de uma vez so"
  echo "criada por: o diretor, na mao, na sessao"
} > "$ARQUIVO"

echo ""
echo "autorizar-producao: autorizacao criada em $ARQUIVO"
echo "palavras registradas: $PALAVRAS"
echo "Vale por 30 minutos e para UM pedido. Depois de usada, peca para a fabrica remover."
