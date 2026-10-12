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
DEPLOY_RE='(^|[^a-z])(git[[:space:]]+push|docker[[:space:]]+push|kubectl[[:space:]]+apply|deploy)([^a-z]|$)'

if printf '%s' "$COMMAND" | grep -Eiq "$DEPLOY_RE"; then
  # Comando de deploy ou push detectado. Precisa de flag de liberação.
  if ls "$STATE_DIR"/READY_* >/dev/null 2>&1; then
    echo "gate-deploy: flag READY_ encontrada em .claude/state/, deploy liberado." >&2
    exit 0
  fi
  echo "gate-deploy: deploy BLOQUEADO." >&2
  echo "Motivo: nenhuma flag READY_ em .claude/state/." >&2
  echo "Comando recusado: $COMMAND" >&2
  echo "Para liberar, após validação do diretor: touch .claude/state/READY_<motivo>" >&2
  echo "Remova a flag logo após o push." >&2
  exit 2
fi

# Não é deploy nem push, segue normal.
exit 0
