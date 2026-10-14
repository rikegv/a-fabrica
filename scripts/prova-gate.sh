#!/usr/bin/env bash
# prova-gate.sh, o teste obrigatorio do §A.7, automatizado.
#
# §A.7 manda: "Teste obrigatorio: push sem flag tem de ser bloqueado de fato."
# Ate a OST 7 isso era feito na mao, comando por comando. Agora e um arquivo, e
# por um motivo pratico que apareceu na propria OST 7: o gate le o comando
# INTEIRO, entao um comando de teste que contenha a palavra vigiada e bloqueado
# pelo proprio gate antes de rodar. Com a prova dentro de um arquivo, a linha que
# o agente digita nao tem nenhuma das palavras, e o teste roda.
#
# O que ele cobre, nos dois sentidos, porque so bloquear nao prova nada se nunca
# liberar, e so liberar nao prova nada se nunca bloquear:
#   SEM flag  tudo que publica tem de ser BLOQUEADO, codigo 2
#   SEM flag  leitura e comando comum tem de PASSAR, codigo 0
#   COM flag  o que publica tem de LIBERAR, codigo 0
#
# Uso: bash scripts/prova-gate.sh

set -uo pipefail

RAIZ="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
GATE="$RAIZ/scripts/gate-deploy.sh"
ESTADO="$RAIZ/.claude/state"
FLAG="$ESTADO/READY_prova-do-gate"

erros=0

# Monta o JSON que o harness manda no gancho, com o comando dentro.
chamar() {
  local comando="$1"
  local corpo
  corpo="$(node -e 'process.stdout.write(JSON.stringify({tool_input:{command:process.argv[1]}}))' "$comando")"
  printf '%s' "$corpo" | CLAUDE_PROJECT_DIR="$RAIZ" bash "$GATE" >/dev/null 2>&1
  echo $?
}

conferir() {
  local rotulo="$1" comando="$2" esperado="$3"
  local obtido
  obtido="$(chamar "$comando")"
  if [ "$obtido" = "$esperado" ]; then
    echo "  PASSOU $rotulo: codigo $obtido (esperado $esperado)"
  else
    echo "  FALHOU $rotulo: codigo $obtido (esperado $esperado)"
    erros=$((erros + 1))
  fi
}

# Guarda qualquer flag que exista agora, para a prova nao mexer no estado do
# diretor. Nada e apagado: se existir flag, a prova para e avisa.
if ls "$ESTADO"/READY_* >/dev/null 2>&1; then
  echo "Existe flag de liberacao em $ESTADO agora. A prova nao roda para nao atrapalhar"
  echo "um deploy em andamento, e nao apaga flag de ninguem. Flags presentes:"
  ls "$ESTADO"/READY_*
  exit 2
fi

echo "PARTE 1, SEM flag: tudo que publica tem de ser BLOQUEADO (codigo 2)"
conferir "envio de ramo para o repositorio" "git push origin feature/exemplo" 2
conferir "publicacao pelo firebase" "firebase deploy --only hosting --project a-fabrica-soulan" 2
conferir "imagem para registro" "docker push exemplo/imagem:1" 2
conferir "aplicar no kubernetes" "kubectl apply -f exemplo.yaml" 2
# Os dois casos que a OST 7 fechou: publicar pela API, sem a palavra vigiada.
conferir "publicar REGRA pela API, com POST" \
  'curl -s -X POST -H "Authorization: Bearer x" https://firebaserules.googleapis.com/v1/projects/a-fabrica-soulan/rulesets -d @r.json' 2
conferir "trocar a regra em uso pela API, com PATCH" \
  'curl -X PATCH https://firebaserules.googleapis.com/v1/projects/a-fabrica-soulan/releases/cloud.firestore' 2
conferir "publicar HOSPEDAGEM pela API, com POST" \
  'curl -s -X POST https://firebasehosting.googleapis.com/v1beta1/projects/a-fabrica-soulan/sites/a-fabrica-soulan/versions' 2
conferir "publicar FUNCAO pela API, com POST" \
  'curl --request POST https://cloudfunctions.googleapis.com/v2/projects/a-fabrica-soulan/locations/us-central1/functions' 2
conferir "script de publicacao da fabrica, regra" "node scripts/publicar.mjs --regra" 2
conferir "script de publicacao da fabrica, painel" "node scripts/publicar.mjs --painel" 2

echo "PARTE 2, SEM flag: leitura e comando comum tem de PASSAR (codigo 0)"
conferir "ler a regra publicada, com GET" \
  'curl -s -H "Authorization: Bearer x" https://firebaserules.googleapis.com/v1/projects/a-fabrica-soulan/releases' 0
conferir "listar os sites da hospedagem, com GET" \
  'curl -s https://firebasehosting.googleapis.com/v1beta1/projects/a-fabrica-soulan/sites' 0
conferir "ligar protecao do Firestore, API que nao publica codigo" \
  'curl -s -X PATCH https://firestore.googleapis.com/v1/projects/a-fabrica-soulan/databases/x' 0
conferir "conferir tipos" "npm run tipos" 0
conferir "listar arquivos" "ls -la" 0
conferir "ler o estado do repositorio" "git status --short" 0
conferir "script de publicacao em modo de SO CONFERIR, nao publica" "node scripts/publicar.mjs --conferir" 0

echo "PARTE 3, COM flag: o que publica tem de LIBERAR (codigo 0)"
mkdir -p "$ESTADO"
: > "$FLAG"
conferir "envio de ramo com flag" "git push origin feature/exemplo" 0
conferir "publicar regra pela API com flag" \
  'curl -s -X POST https://firebaserules.googleapis.com/v1/projects/a-fabrica-soulan/rulesets' 0
conferir "script de publicacao com flag" "node scripts/publicar.mjs --painel" 0
# Caminho completo e nomeado, §A.18. Esta e a flag que ESTA prova criou.
rm -f "$FLAG"

if ls "$ESTADO"/READY_* >/dev/null 2>&1; then
  echo "  FALHOU limpeza: sobrou flag em $ESTADO"
  ls "$ESTADO"/READY_*
  erros=$((erros + 1))
else
  echo "  PASSOU limpeza: a flag criada pela prova foi removida, nenhuma sobrou"
fi

echo "PARTE 4, SEM flag de novo, para provar que a liberacao nao ficou presa"
conferir "envio de ramo depois de remover a flag" "git push origin feature/exemplo" 2

echo ""
if [ "$erros" -eq 0 ]; then
  echo "RESUMO: o gate bloqueia o que publica, libera leitura, obedece a flag e volta a bloquear."
  exit 0
fi
echo "RESUMO: $erros caso(s) fora do esperado. O gate NAO esta confiavel."
exit 1
