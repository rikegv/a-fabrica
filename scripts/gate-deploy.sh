#!/usr/bin/env bash
# gate-deploy.sh, trava de deploy da fábrica A FÁBRICA
#
# Hook PreToolUse (ver .claude/settings.json). Lê o comando que o harness
# enviou na entrada padrão, identifica os verbos de deploy e push
# (git push, deploy, firebase deploy, kubectl apply, docker push) e, se
# não existir nenhuma flag READY_* em .claude/state/, bloqueia com exit 2.
# Encontrando a flag, libera com exit 0. Nenhum agente contorna este gate.

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_DIR="$PROJECT_DIR/.claude/state"

# Tudo que o hook mandou na entrada padrão.
INPUT="$(cat || true)"

# Extrai o campo command do JSON do hook. Se falhar, usa o texto bruto.
COMMAND="$INPUT"
if command -v node >/dev/null 2>&1; then
  PARSED="$(printf '%s' "$INPUT" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);process.stdout.write(((j.tool_input||{}).command)||"")}catch(e){}})' 2>/dev/null || true)"
  if [ -n "$PARSED" ]; then
    COMMAND="$PARSED"
  fi
fi

# Verbos vigiados. firebase deploy cai dentro do termo deploy.
#
# FURO FECHADO NA OST 7: a lista acima só pegava o VERBO. Quando o Firebase CLI
# da máquina perdeu a credencial, a fábrica passou a publicar regra e hospedagem
# pela API, com curl e token do gcloud, e nada disso tem a palavra deploy dentro.
# Ou seja: existia um caminho de publicação que não passava pelo gate, e §A.7 diz
# que nenhum agente contorna o gate. Agora os endereços de administração das APIs
# que publicam também estão vigiados, e o gate pega o caminho novo igual.
#
# O que entra nesta segunda lista, e por quê:
#   firebaserules.googleapis.com     publica regra do Firestore
#   firebasehosting.googleapis.com   publica o painel
#   /v1beta1/sites/ e /releases      as rotas de publicação das duas acima
#   cloudfunctions.googleapis.com    publica função na nuvem
#   run.googleapis.com               publica serviço na nuvem
# Leitura NÃO é publicação, e por isso o gate olha o MÉTODO junto: um GET nesses
# endereços passa, um POST, PUT, PATCH ou DELETE precisa da flag.
DEPLOY_RE='(^|[^a-z])(git[[:space:]]+push|docker[[:space:]]+push|kubectl[[:space:]]+apply|deploy)([^a-z]|$)'
API_RE='(firebaserules|firebasehosting|cloudfunctions|run)\.googleapis\.com'
ESCRITA_RE='(-X[[:space:]]*(POST|PUT|PATCH|DELETE)|--request[[:space:]]+(POST|PUT|PATCH|DELETE))'
# O script de publicacao da propria fabrica. Ele tambem confere a flag por conta
# propria e recusa sem ela, mas vigiado aqui tambem: quem publica passa pelo gate,
# sem depender de o script estar correto.
SCRIPT_RE='publicar\.mjs'

MOTIVO=''
if printf '%s' "$COMMAND" | grep -Eiq "$DEPLOY_RE"; then
  MOTIVO='verbo de deploy ou push'
elif printf '%s' "$COMMAND" | grep -Eiq "$API_RE" && printf '%s' "$COMMAND" | grep -Eq "$ESCRITA_RE"; then
  MOTIVO='escrita na API de publicacao (regra, hospedagem, funcao ou servico)'
elif printf '%s' "$COMMAND" | grep -Eq "$SCRIPT_RE" && ! printf '%s' "$COMMAND" | grep -Eq -- '--conferir'; then
  MOTIVO='script de publicacao da fabrica'
fi

if [ -n "$MOTIVO" ]; then
  # Comando de deploy ou push detectado. Precisa de flag de liberação.
  if ls "$STATE_DIR"/READY_* >/dev/null 2>&1; then
    echo "gate-deploy: flag READY_ encontrada em .claude/state/, deploy liberado ($MOTIVO)." >&2
    exit 0
  fi
  echo "gate-deploy: deploy BLOQUEADO." >&2
  echo "Motivo da vigilância: $MOTIVO." >&2
  echo "Motivo do bloqueio: nenhuma flag READY_ em .claude/state/." >&2
  echo "Comando recusado: $COMMAND" >&2
  echo "Para liberar, após validação do diretor: touch .claude/state/READY_<motivo>" >&2
  echo "Remova a flag logo após o push." >&2
  exit 2
fi

# Não é deploy nem push, segue normal.
exit 0
