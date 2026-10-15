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

# A parte de PESO PESADO roda contra uma pasta de projeto FALSA, feita aqui.
#
# Motivo, e ele e de regra e nao de conveniencia: a autorizacao de producao e do
# diretor, §A.7, e a fabrica nao cria nenhuma. Se esta prova criasse uma de
# verdade em .claude/state, ela seria exatamente a autoassinatura que a regra
# acabou de proibir, e ficaria valendo por trinta minutos para qualquer
# publicacao. Numa pasta falsa, a autorizacao de mentira so autoriza na mentira.
FALSO=''
chamarFalso() {
  local comando="$1"
  local corpo
  corpo="$(node -e 'process.stdout.write(JSON.stringify({tool_input:{command:process.argv[1]}}))' "$comando")"
  printf '%s' "$corpo" | CLAUDE_PROJECT_DIR="$FALSO" bash "$GATE" >/dev/null 2>&1
  echo $?
}
conferirFalso() {
  local rotulo="$1" comando="$2" esperado="$3"
  local obtido
  obtido="$(chamarFalso "$comando")"
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
# Furo achado pela auditoria da OST 7: --conferir ao lado de um verbo que publica
# nao pode valer como exceção. O script aceita os dois na mesma linha.
conferir "conferir E publicar na mesma linha, a excecao nao vale" \
  "node scripts/publicar.mjs --conferir --painel" 2
conferir "conferir E publicar regra na mesma linha, ordem trocada" \
  "node scripts/publicar.mjs --regra --conferir" 2

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

echo "PARTE 2B, flag VAZIA nao libera mais nada, decisao do diretor na OST 7"
# A flag autoassinada acabou: arquivo vazio era autorizacao sem autor e sem
# motivo. Agora a flag so vale com as palavras do diretor dentro.
mkdir -p "$ESTADO"
: > "$FLAG"
conferir "flag VAZIA nao libera envio de ramo" "git push origin feature/exemplo" 2
conferir "flag VAZIA nao libera publicacao pela API" \
  'curl -s -X POST https://firebaserules.googleapis.com/v1/projects/a-fabrica-soulan/rulesets' 2
rm -f "$FLAG"

echo "PARTE 2C, o script de liberar RECUSA carimbo e aceita a frase do diretor"
if bash "$RAIZ/scripts/liberar.sh" prova-do-gate "ok" >/dev/null 2>&1; then
  echo "  FALHOU liberar com carimbo: criou a flag mesmo assim"
  erros=$((erros + 1))
  rm -f "$FLAG"
else
  echo "  PASSOU liberar com carimbo: recusado"
fi
if bash "$RAIZ/scripts/liberar.sh" prova-do-gate "curto" >/dev/null 2>&1; then
  echo "  FALHOU liberar com frase curta: criou a flag mesmo assim"
  erros=$((erros + 1))
  rm -f "$FLAG"
else
  echo "  PASSOU liberar com frase curta demais: recusado"
fi

echo "PARTE 3, COM flag de verdade: o que publica tem de LIBERAR (codigo 0)"
bash "$RAIZ/scripts/liberar.sh" prova-do-gate "Esta frase faz o papel da autorizacao escrita do diretor, so na prova do gate." >/dev/null
conferir "envio de ramo com flag" "git push origin feature/exemplo" 0
# Estes dois eram liberados pela flag da fabrica ate a decisao do diretor separar
# peso. Publicar regra e publicar painel sao PRODUCAO: a flag leve nao serve mais,
# e o esperado agora e bloqueio. A liberacao deles esta provada na PARTE 5, com a
# autorizacao do diretor.
conferir "flag da fabrica NAO libera publicar regra pela API, agora e producao" \
  'curl -s -X POST https://firebaserules.googleapis.com/v1/projects/a-fabrica-soulan/rulesets' 2
conferir "flag da fabrica NAO libera o script de publicacao, agora e producao" "node scripts/publicar.mjs --painel" 2
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

echo "PARTE 5, PESO PESADO: main e producao so com autorizacao DO DIRETOR, §A.7"
echo "  (contra uma pasta de projeto falsa, para a prova nao criar autorizacao de verdade)"
FALSO="$(mktemp -d)"
mkdir -p "$FALSO/.claude/state" "$FALSO/scripts"
cp "$GATE" "$FALSO/scripts/gate-deploy.sh"
git -C "$FALSO" init -q 2>/dev/null || true

# 5.1 Sem autorizacao nenhuma: main bloqueada, ramo de feature tambem.
conferirFalso "push para a MAIN sem autorizacao" "git push origin main" 2
conferirFalso "publicar painel sem autorizacao" "node scripts/publicar.mjs --painel" 2

# 5.2 A flag LEVE da fabrica NAO serve para producao. Este e o coracao da decisao.
printf 'autorizacao: frase de peso leve, criada pela fabrica, so para ramo de feature\n' > "$FALSO/.claude/state/READY_leve"
conferirFalso "flag LEVE da fabrica NAO libera push para a main" "git push origin main" 2
conferirFalso "flag LEVE da fabrica NAO libera publicacao do painel" "node scripts/publicar.mjs --painel" 2
conferirFalso "flag LEVE libera push de ramo de feature, que e o peso dela" "git push origin feature/exemplo" 0

# 5.3 Autorizacao de producao vazia nao vale.
: > "$FALSO/.claude/state/PROD_exemplo"
conferirFalso "autorizacao de producao VAZIA nao libera a main" "git push origin main" 2

# 5.4 Autorizacao de producao com as palavras do diretor libera.
printf 'autorizacao: Sobe tudo de uma vez, eu validei a Onda 2 na tela.\nmotivo: exemplo\n' > "$FALSO/.claude/state/PROD_exemplo"
conferirFalso "autorizacao de producao com as palavras do diretor libera a main" "git push origin main" 0
conferirFalso "a mesma autorizacao libera a publicacao do painel" "node scripts/publicar.mjs --painel" 0

# 5.5 Autorizacao VENCIDA nao vale: palavra de ontem nao autoriza hoje.
touch -d '2 hours ago' "$FALSO/.claude/state/PROD_exemplo" 2>/dev/null ||
  touch -t "$(date -d '2 hours ago' '+%Y%m%d%H%M' 2>/dev/null || echo 202001010000)" "$FALSO/.claude/state/PROD_exemplo"
conferirFalso "autorizacao de producao VENCIDA nao libera a main" "git push origin main" 2

# 5.6 Push sem nomear ramo, parado em cima da main, conta como producao.
rm -f "$FALSO/.claude/state/PROD_exemplo"
git -C "$FALSO" checkout -q -b main 2>/dev/null || git -C "$FALSO" checkout -q main 2>/dev/null || true
conferirFalso "push sem nomear ramo, em cima da main, conta como producao" "git push" 2

# Limpeza, caminho completo e nomeado, §A.18.
rm -f "$FALSO/.claude/state/READY_leve"
rm -f "$FALSO/.claude/state/PROD_exemplo"
rm -rf "$FALSO"

echo "PARTE 6, a fabrica NAO encosta na autorizacao de producao, bloqueio de primeira ordem"
conferir "criar autorizacao de producao pela fabrica" "bash scripts/autorizar-producao.sh x \"palavras inventadas pela fabrica\"" 2
conferir "copiar autorizacao de producao de outro lugar" "cp /tmp/qualquer .claude/state/PROD_roubada" 2
conferir "renovar a data de uma autorizacao de producao" "touch .claude/state/PROD_exemplo" 2
conferir "so LER a pasta de autorizacao de producao" "cat .claude/state/PROD_exemplo" 2

echo "PARTE 7, o liberar.sh recusa motivo com cara de producao"
for motivo in subir-main publicar-painel deploy-producao; do
  if bash "$RAIZ/scripts/liberar.sh" "$motivo" "Uma frase longa o bastante para passar na conferencia de tamanho." >/dev/null 2>&1; then
    echo "  FALHOU liberar com motivo '$motivo': criou a flag mesmo assim"
    erros=$((erros + 1))
    rm -f "$ESTADO/READY_$motivo"
  else
    echo "  PASSOU liberar com motivo '$motivo': recusado, producao nao passa por ali"
  fi
done

echo ""
if [ "$erros" -eq 0 ]; then
  echo "RESUMO: o gate bloqueia o que publica, libera leitura, obedece a flag e volta a bloquear."
  echo "E separa peso: ramo de feature a fabrica autoriza, main e producao so o diretor."
  exit 0
fi
echo "RESUMO: $erros caso(s) fora do esperado. O gate NAO esta confiavel."
exit 1
