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

# ---------------------------------------------------------------------------
# TRAVA DE PRIMEIRA ORDEM: a fabrica NAO toca a autorizacao de producao.
# ---------------------------------------------------------------------------
# Decisao do diretor, §A.7: a autorizacao de producao e dele, na mao, na sessao.
# Entao qualquer comando DA FABRICA que mencione .claude/state/PROD_ ou o script
# que a cria e bloqueado aqui, antes de qualquer outra coisa, inclusive comando
# que so leria. Ler nao e o problema; o problema e que uma linha que mexe nesse
# caminho nunca deveria sair da fabrica, e bloquear tudo tira a discussao de
# qual mexida era inocente.
#
# Esta trava vale para o que a FABRICA executa. O diretor roda o comando dele na
# propria sessao, com o prefixo de exclamacao, e aquilo nao e chamada de
# ferramenta da fabrica: nao passa por este gancho. E essa a assimetria que faz a
# separacao existir neste harness.
if printf '%s' "$COMMAND" | grep -Eq 'PROD_|autorizar-producao'; then
  echo "gate-deploy: BLOQUEADO, e este bloqueio e de primeira ordem." >&2
  echo "A fabrica NAO cria, nao copia, nao renova e nao encosta na autorizacao de producao, §A.7." >&2
  echo "Comando recusado: $COMMAND" >&2
  echo "" >&2
  echo "Quem autoriza producao e o diretor, na mao, nesta sessao, com o prefixo de exclamacao:" >&2
  echo "  ! bash scripts/autorizar-producao.sh <motivo> \"<as suas palavras>\"" >&2
  exit 2
fi

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

# ---------------------------------------------------------------------------
# O PESO, e e ele que decide QUEM pode autorizar, §A.7.
# ---------------------------------------------------------------------------
#   leve    branch de feature. A fabrica pode autorizar, flag READY_.
#   pesado  main e qualquer publicacao em producao. So o diretor, flag PROD_.
#
# Um push conta como pesado quando a linha nomeia a main, e TAMBEM quando a linha
# nao nomeia ramo nenhum e o ramo de agora e a main: "git push" sozinho, parado em
# cima da main, e push para a main, e seria um furo bobo de deixar passar.
PESO='leve'
case "$MOTIVO" in
  'verbo de deploy ou push')
    if printf '%s' "$COMMAND" | grep -Eq '(^|[^a-z])(main|master)([^a-z]|$)'; then
      PESO='pesado'
    elif printf '%s' "$COMMAND" | grep -Eq 'git[[:space:]]+push' &&
      ! printf '%s' "$COMMAND" | grep -Eq 'git[[:space:]]+push[^|;&]*[[:space:]][^-][^[:space:]]*[[:space:]][^-]'; then
      RAMO_DE_AGORA="$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
      case "$RAMO_DE_AGORA" in
        main | master) PESO='pesado' ;;
      esac
    fi
    # Publicacao por outro verbo que nao e push e sempre producao.
    if printf '%s' "$COMMAND" | grep -Eiq 'deploy|docker[[:space:]]+push|kubectl[[:space:]]+apply'; then
      PESO='pesado'
    fi
    ;;
  'escrita na API de publicacao'* | 'script de publicacao da fabrica')
    PESO='pesado'
    ;;
esac

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
  # Qual porta vale, pelo peso. A de produção não aceita flag da fábrica, e a de
  # ramo de feature não é satisfeita por autorização de produção vencida.
  if [ "$PESO" = 'pesado' ]; then
    PREFIXO='PROD_'
    QUEM='o diretor, na mão, nesta sessão'
    COMO="  ! bash scripts/autorizar-producao.sh <motivo> \"<as suas palavras>\""
  else
    PREFIXO='READY_'
    QUEM='a fábrica, com as palavras do diretor'
    COMO="  bash scripts/liberar.sh <motivo> \"<as palavras do diretor>\""
  fi

  FLAG="$(ls "$STATE_DIR"/${PREFIXO}* 2>/dev/null | head -n 1 || true)"

  if [ -z "$FLAG" ]; then
    echo "gate-deploy: BLOQUEADO." >&2
    echo "Motivo da vigilância: $MOTIVO." >&2
    echo "Peso: $PESO. Quem autoriza este peso: $QUEM." >&2
    echo "Motivo do bloqueio: nenhuma autorização ${PREFIXO}em .claude/state/." >&2
    echo "Comando recusado: $COMMAND" >&2
    echo "Para autorizar:" >&2
    echo "$COMO" >&2
    exit 2
  fi

  AUTORIZACAO="$(grep -m 1 '^autorizacao:' "$FLAG" 2>/dev/null | sed 's/^autorizacao:[[:space:]]*//' || true)"
  if [ -z "$AUTORIZACAO" ]; then
    echo "gate-deploy: BLOQUEADO." >&2
    echo "Motivo da vigilância: $MOTIVO (peso $PESO)." >&2
    echo "Motivo do bloqueio: $(basename "$FLAG") NÃO traz a autorização escrita do diretor." >&2
    echo "Autorização vazia não libera nada, §A.7." >&2
    exit 2
  fi

  # VALIDADE CURTA, e ela vale para os dois pesos, com prazos diferentes.
  #
  # Decisão do diretor: a autorização de produção é de uma vez e expira sozinha,
  # para palavra de ontem não autorizar hoje. É isso que impede a fábrica de
  # reaproveitar uma frase antiga dele, que seria a autoassinatura voltando pela
  # porta dos fundos.
  if [ "$PESO" = 'pesado' ]; then
    VALIDADE_S=1800
  else
    VALIDADE_S=86400
  fi
  NASCEU="$(stat -c %Y "$FLAG" 2>/dev/null || echo 0)"
  AGORA="$(date +%s)"
  IDADE=$((AGORA - NASCEU))
  if [ "$NASCEU" -gt 0 ] && [ "$IDADE" -gt "$VALIDADE_S" ]; then
    echo "gate-deploy: BLOQUEADO." >&2
    echo "Motivo da vigilância: $MOTIVO (peso $PESO)." >&2
    echo "Motivo do bloqueio: a autorização $(basename "$FLAG") tem $((IDADE / 60)) minuto(s) e vale $((VALIDADE_S / 60))." >&2
    echo "Autorização vencida não autoriza, §A.7. Palavra de ontem não vale hoje." >&2
    echo "Para autorizar de novo:" >&2
    echo "$COMO" >&2
    exit 2
  fi

  echo "gate-deploy: liberado ($MOTIVO, peso $PESO)." >&2
  echo "Autorização: $(basename "$FLAG"), $((IDADE / 60)) minuto(s) de idade." >&2
  echo "Palavras registradas: $AUTORIZACAO" >&2
  if [ "$PESO" = 'pesado' ]; then
    echo "Lembrete: autorização de produção é de UMA VEZ. Remova-a agora que foi usada." >&2
  fi
  exit 0
fi

# Não é deploy nem push, segue normal.
exit 0
