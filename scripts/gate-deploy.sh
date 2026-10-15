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
# Os verbos do script que PUBLICAM de verdade. Se um deles estiver na linha, nao
# existe exceção: --conferir ao lado nao salva.
PUBLICA_RE='--(regra|indices|painel)'

MOTIVO=''
if printf '%s' "$COMMAND" | grep -Eiq "$DEPLOY_RE"; then
  MOTIVO='verbo de deploy ou push'
elif printf '%s' "$COMMAND" | grep -Eiq "$API_RE" && printf '%s' "$COMMAND" | grep -Eq "$ESCRITA_RE"; then
  MOTIVO='escrita na API de publicacao (regra, hospedagem, funcao ou servico)'
elif printf '%s' "$COMMAND" | grep -Eq "$SCRIPT_RE" &&
  { printf '%s' "$COMMAND" | grep -Eq -- "$PUBLICA_RE" || ! printf '%s' "$COMMAND" | grep -Eq -- '--conferir'; }; then
  # A EXCECAO DO --conferir SO VALE SE ELE ESTIVER SOZINHO.
  #
  # Furo achado pela auditoria da OST 7: a versao anterior liberava qualquer linha
  # que contivesse --conferir, e o script aceita --conferir e --painel na MESMA
  # linha. Logo "publicar.mjs --conferir --painel" passava pelo gate, e quem
  # segurava era so a conferencia interna do proprio script. Cinto e suspensorio
  # tem de ser dois, nao um.
  MOTIVO='script de publicacao da fabrica'
fi

if [ -n "$MOTIVO" ]; then
  # Comando de deploy ou push detectado. Precisa de flag de liberação, E a flag
  # precisa carregar a AUTORIZAÇÃO ESCRITA DO DIRETOR.
  #
  # DECISÃO DO DIRETOR NA OST 7: a flag autoassinada acaba. Antes, qualquer
  # arquivo vazio em .claude/state/ liberava, e criar arquivo é escrita comum:
  # a fábrica criava a própria autorização de publicar, sem rastro de quem
  # autorizou nem por quê. Agora a flag só vale com as PALAVRAS DELE dentro, e
  # elas ficam no registro, que é o que torna a autorização conferível depois.
  #
  # O LIMITE DISTO, dito aqui porque esconder limite de segurança é pior que não
  # ter o controle: nenhum arquivo impede um agente com terminal de escrever
  # outro arquivo. Isto não torna a forja impossível, torna a forja EXPLÍCITA e
  # atribuível, porque alguém teria de inventar, por escrito, uma frase que o
  # diretor nunca disse. O fechamento de verdade é tirar a autorização do
  # alcance do agente, e está proposto ao diretor no relatório da OST 7.
  FLAG="$(ls "$STATE_DIR"/READY_* 2>/dev/null | head -n 1 || true)"
  if [ -n "$FLAG" ]; then
    AUTORIZACAO="$(grep -m 1 '^autorizacao:' "$FLAG" 2>/dev/null | sed 's/^autorizacao:[[:space:]]*//' || true)"
    if [ -z "$AUTORIZACAO" ]; then
      echo "gate-deploy: deploy BLOQUEADO." >&2
      echo "Motivo da vigilância: $MOTIVO." >&2
      echo "Motivo do bloqueio: a flag $(basename "$FLAG") NÃO traz a autorização escrita do diretor." >&2
      echo "Flag vazia não libera mais nada, por decisão do diretor na OST 7." >&2
      echo "Para liberar: bash scripts/liberar.sh <motivo> \"<as palavras do diretor, como ele escreveu>\"" >&2
      exit 2
    fi
    echo "gate-deploy: liberado ($MOTIVO)." >&2
    echo "Flag: $(basename "$FLAG")" >&2
    echo "Autorização do diretor, registrada: $AUTORIZACAO" >&2
    exit 0
  fi
  echo "gate-deploy: deploy BLOQUEADO." >&2
  echo "Motivo da vigilância: $MOTIVO." >&2
  echo "Motivo do bloqueio: nenhuma flag READY_ em .claude/state/." >&2
  echo "Comando recusado: $COMMAND" >&2
  echo "Para liberar: bash scripts/liberar.sh <motivo> \"<as palavras do diretor>\"" >&2
  echo "Remova a flag logo após o push." >&2
  exit 2
fi

# Não é deploy nem push, segue normal.
exit 0
