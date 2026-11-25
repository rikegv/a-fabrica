#!/bin/bash
# instalar.sh, a ponte da Fabrica no Linux, num comando so. OST 14.
#
# Uso, de dentro do repositorio, como o usuario que abre as fabricas:
#   sudo bash ponte/linux/instalar.sh
# Opcoes:
#   --diretor USUARIO   quem abre as fabricas nesta maquina (padrao: quem chamou o sudo)
#   --nome NOME         nome da maquina no painel (padrao: o nome da maquina)
#   --sem-login         instala tudo e deixa o login para depois (entrar.sh)
#   --so-liberados      ganchos so com a lista de liberados, em vez de conteudo de todos
#
# O QUE ESTE INSTALADOR FAZ, e cada passo e refeito igual se rodar de novo:
#   1. confere a maquina: Linux com systemd, Node 20 ou mais, Claude Code do
#      diretor instalado e logado;
#   2. cria o usuario do sistema fabrica-ponte, sem senha e sem shell;
#   3. cria as pastas: /var/lib/a-fabrica-ponte (700, so a ponte le: credencial,
#      configuracao, registros) e /var/lib/a-fabrica-ganchos (a fila onde o gancho
#      do diretor escreve e a ponte le);
#   4. compila a ponte numa pasta nova com data e hora em /opt/a-fabrica-ponte, e
#      aponta /opt/a-fabrica-ponte/app para ela. A versao anterior fica, §A.17;
#   5. grava os dois lancadores e a regra estreita do sudo que deixa a ponte rodar
#      SO eles e SO como o diretor;
#   6. pareia a maquina e grava a configuracao do cliente, lida da hospedagem do
#      projeto, que a serve em aberto de proposito;
#   7. liga os ganchos no ~/.claude/settings.json do diretor, so acrescentando;
#   8. grava o servico do systemd, que sobe com a maquina e volta sozinho se cair;
#   9. faz o login, no modelo do login do Claude Code: link, entrar, colar;
#  10. sobe a ponte e confere que ficou de pe.
#
# §A.6: nada aqui abre porta, e a ponte so faz conexao de saida. Nenhuma chave de
# conta de servico. Nenhum segredo neste arquivo.
# §A.9: a configuracao do Claude Code do diretor so recebe acrescimo, com copia
# de seguranca antes. Desfazer: sudo bash /opt/a-fabrica-ponte/app/linux/desinstalar.sh
# §A.11: nenhum travessao em texto que o diretor le.
set -euo pipefail

PROJETO_NUVEM='a-fabrica-soulan'
USUARIO_PONTE='fabrica-ponte'
PASTA_PONTE='/var/lib/a-fabrica-ponte'
PASTA_GANCHOS='/var/lib/a-fabrica-ganchos'
RAIZ_APP='/opt/a-fabrica-ponte'
UNIDADE='a-fabrica-ponte'

falhar() { echo ""; echo "A instalacao parou: $1"; [ -n "${2:-}" ] && echo "O que fazer: $2"; exit 1; }

[ "$(uname -s)" = "Linux" ] || falhar "este instalador e so para Linux" "no Windows use ponte\\instalar.ps1"
[ "$(id -u)" = "0" ] || falhar "precisa de administrador" "rode: sudo bash ponte/linux/instalar.sh"

DIRETOR="${SUDO_USER:-}"
NOME_MAQUINA="$(hostname)"
SEM_LOGIN=0
CONTEUDO_DE_TODOS=true
while [ $# -gt 0 ]; do
  case "$1" in
    --diretor) DIRETOR="${2:-}"; shift 2 ;;
    --nome) NOME_MAQUINA="${2:-}"; shift 2 ;;
    --sem-login) SEM_LOGIN=1; shift ;;
    --so-liberados) CONTEUDO_DE_TODOS=false; shift ;;
    *) falhar "opcao desconhecida: $1" "veja o cabecalho de ponte/linux/instalar.sh" ;;
  esac
done
[ -n "$DIRETOR" ] && [ "$DIRETOR" != "root" ] || falhar "nao sei quem abre as fabricas nesta maquina" "rode com sudo a partir do seu usuario, ou passe --diretor SEU_USUARIO"
getent passwd "$DIRETOR" >/dev/null || falhar "o usuario $DIRETOR nao existe nesta maquina"
[ "$DIRETOR" != "$USUARIO_PONTE" ] || falhar "o diretor nao pode ser o proprio usuario da ponte"
CASA="$(getent passwd "$DIRETOR" | cut -d: -f6)"
GRUPO_DIRETOR="$(id -gn "$DIRETOR")"
REPO_PONTE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$REPO_PONTE/package.json" ] && [ -d "$REPO_PONTE/src" ] || falhar "nao achei o codigo da ponte em $REPO_PONTE"

echo "A Fabrica, instalacao da ponte no Linux"
echo "   diretor: $DIRETOR ($CASA), maquina: $NOME_MAQUINA"
echo ""

# ---------------------------------------------------------------------------
echo "1. Conferindo a maquina"
[ -d /run/systemd/system ] || falhar "esta maquina nao roda o systemd" "a ponte precisa dele para voltar sozinha"
NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then NODE="$(sudo -u "$DIRETOR" -H bash -lc 'command -v node' 2>/dev/null || true)"; fi
[ -n "$NODE" ] && [ -x "$NODE" ] || falhar "nao achei o Node" "instale o Node 20 ou mais novo"
NODE="$(readlink -f "$NODE")"
VERSAO_NODE="$("$NODE" -p 'process.versions.node.split(".")[0]')"
[ "$VERSAO_NODE" -ge 20 ] || falhar "o Node desta maquina e a versao $VERSAO_NODE, e a ponte precisa da 20 ou mais"
NPM="$(dirname "$NODE")/npm"; [ -x "$NPM" ] || NPM="$(command -v npm || true)"
[ -n "$NPM" ] || falhar "nao achei o npm junto do Node"
[ -f "$CASA/.claude/settings.json" ] || falhar "o Claude Code de $DIRETOR nunca foi aberto, falta $CASA/.claude/settings.json" "abra o Claude Code uma vez como $DIRETOR e rode de novo"
[ -f "$CASA/.claude/.credentials.json" ] || echo "   aviso: nao achei $CASA/.claude/.credentials.json; confira que o Claude Code de $DIRETOR esta logado, senao a fabrica aberta pelo painel nao nasce"
echo "   systemd ok, Node $("$NODE" -v) em $NODE, Claude Code de $DIRETOR configurado"

# ---------------------------------------------------------------------------
echo "2. Usuario do sistema da ponte"
if id "$USUARIO_PONTE" >/dev/null 2>&1; then
  echo "   $USUARIO_PONTE ja existe"
else
  useradd --system --user-group --home-dir "$PASTA_PONTE" --no-create-home --shell /usr/sbin/nologin \
    --comment "A Fabrica, ponte local" "$USUARIO_PONTE"
  echo "   $USUARIO_PONTE criado, sem senha e sem shell"
fi

# ---------------------------------------------------------------------------
echo "3. Pastas"
install -d -o "$USUARIO_PONTE" -g "$USUARIO_PONTE" -m 0700 "$PASTA_PONTE"
chown "$USUARIO_PONTE:$USUARIO_PONTE" "$PASTA_PONTE"; chmod 0700 "$PASTA_PONTE"
install -d -o "$USUARIO_PONTE" -g "$USUARIO_PONTE" -m 0755 "$PASTA_GANCHOS"
chown "$USUARIO_PONTE:$USUARIO_PONTE" "$PASTA_GANCHOS"; chmod 0755 "$PASTA_GANCHOS"
# A fila: o diretor escreve (grupo dele), a ponte le e arquiva (dona), outros nada.
install -d -o "$USUARIO_PONTE" -g "$GRUPO_DIRETOR" -m 2770 "$PASTA_GANCHOS/fila-ganchos"
chown "$USUARIO_PONTE:$GRUPO_DIRETOR" "$PASTA_GANCHOS/fila-ganchos"; chmod 2770 "$PASTA_GANCHOS/fila-ganchos"
echo "   $PASTA_PONTE modo 700, so $USUARIO_PONTE"
echo "   $PASTA_GANCHOS/fila-ganchos modo 2770, $DIRETOR escreve e $USUARIO_PONTE le"

# ---------------------------------------------------------------------------
echo "4. Compilando a ponte"
SELO="$(date +%Y%m%d-%H%M%S)"
VERSAO="$RAIZ_APP/versao-$SELO"
install -d -o root -g root -m 0755 "$RAIZ_APP" "$RAIZ_APP/bin" "$VERSAO"
cp -r "$REPO_PONTE/src" "$REPO_PONTE/package.json" "$REPO_PONTE/package-lock.json" "$REPO_PONTE/tsconfig.json" "$VERSAO/"
install -d -m 0755 "$VERSAO/ganchos" "$VERSAO/linux"
# O nome com a-fabrica-gancho e a marca que o desligar procura, igual ao Windows.
install -m 0644 "$REPO_PONTE/ganchos/gancho.cjs" "$VERSAO/ganchos/a-fabrica-gancho.cjs"
install -m 0644 "$REPO_PONTE/linux/"*.mjs "$VERSAO/linux/"
install -m 0755 "$REPO_PONTE/linux/"*.sh "$VERSAO/linux/"
(
  cd "$VERSAO"
  # Sem rodar script de instalacao de pacote de terceiro: os dois que existem
  # (firebase util e protobufjs) sao dispensaveis, conferido na OST 14.
  PATH="$(dirname "$NODE"):$PATH" "$NPM" ci --ignore-scripts --no-audit --no-fund --loglevel=error >/dev/null
  PATH="$(dirname "$NODE"):$PATH" "$NPM" run --silent compilar
  PATH="$(dirname "$NODE"):$PATH" "$NPM" prune --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error >/dev/null
)
chown -R root:root "$VERSAO"; chmod -R go-w "$VERSAO"
ln -sfn "$VERSAO" "$RAIZ_APP/app.novo" && mv -Tf "$RAIZ_APP/app.novo" "$RAIZ_APP/app"
echo "   versao $SELO em $VERSAO, e $RAIZ_APP/app aponta para ela"

# ---------------------------------------------------------------------------
echo "5. Lancadores e regra do sudo"
cat > "$RAIZ_APP/bin/claude-como-diretor" <<EOF
#!/bin/bash
# Roda o Claude Code como o diretor. Chamado SO pela ponte, pelo sudo. OST 14.
# Aceita so o Claude Code do kit da propria ponte, e so as variaveis do kit.
set -euo pipefail
APP="\$(readlink -f $RAIZ_APP/app)"
vars=()
while [ "\${1:-}" = "--env" ]; do
  par="\${2:-}"; shift 2
  nome="\${par%%=*}"
  if [[ "\$nome" =~ ^(CLAUDE_CODE_ENTRYPOINT|CLAUDE_AGENT_SDK[A-Z_]*|DEBUG)\$ ]]; then vars+=("\$par"); else echo "variavel recusada: \$nome" >&2; exit 64; fi
done
[ "\${1:-}" = "--" ] && shift
alvo="\$(readlink -f -- "\${1:-}")"; shift || true
case "\$alvo" in
  "\$APP"/node_modules/@anthropic-ai/*) ;;
  *) echo "programa recusado: so o Claude Code do kit da ponte" >&2; exit 64 ;;
esac
eu="\$(id -un)"; casa="\$(getent passwd "\$eu" | cut -d: -f6)"
# O umask do servico e 077; a fabrica volta ao padrao do diretor, como na mao.
umask 022
exec env -i HOME="\$casa" USER="\$eu" LOGNAME="\$eu" SHELL=/bin/bash LANG="\${LANG:-C.UTF-8}" \\
  PATH="\$casa/.local/bin:$(dirname "$NODE"):/usr/local/bin:/usr/bin:/bin" "\${vars[@]}" "\$alvo" "\$@"
EOF
cat > "$RAIZ_APP/bin/ler-transcricao" <<EOF
#!/bin/bash
# Le a transcricao do Claude Code como o diretor e devolve so numeros, ou o
# texto do fechamento. Chamado SO pela ponte, pelo sudo. OST 14.
set -euo pipefail
eu="\$(id -un)"; casa="\$(getent passwd "\$eu" | cut -d: -f6)"
exec env -i HOME="\$casa" USER="\$eu" PATH=/usr/bin:/bin "$NODE" "$RAIZ_APP/app/dist/leitorTranscricao.js"
EOF
chown root:root "$RAIZ_APP/bin/claude-como-diretor" "$RAIZ_APP/bin/ler-transcricao"
chmod 0755 "$RAIZ_APP/bin/claude-como-diretor" "$RAIZ_APP/bin/ler-transcricao"
REGRA="$(mktemp)"
cat > "$REGRA" <<EOF
# A Fabrica, OST 14. A ponte ($USUARIO_PONTE) roda so estes dois programas, e so
# como o diretor ($DIRETOR). Nenhum outro comando, nenhum outro usuario.
$USUARIO_PONTE ALL=($DIRETOR) NOPASSWD: $RAIZ_APP/bin/claude-como-diretor, $RAIZ_APP/bin/ler-transcricao
EOF
visudo -cf "$REGRA" >/dev/null || { rm -f -- "$REGRA"; falhar "a regra do sudo nao passou na conferencia do visudo"; }
install -o root -g root -m 0440 "$REGRA" /etc/sudoers.d/a-fabrica-ponte
rm -f -- "$REGRA"
echo "   /etc/sudoers.d/a-fabrica-ponte: $USUARIO_PONTE roda so os dois lancadores, so como $DIRETOR"

# ---------------------------------------------------------------------------
echo "6. Pareamento e configuracao do cliente"
CONFIG="$PASTA_PONTE/config.json"
INIT="$(mktemp)"
if curl -fsS --max-time 20 "https://$PROJETO_NUVEM.web.app/__/firebase/init.json" -o "$INIT"; then
  echo "   configuracao do cliente lida da hospedagem de $PROJETO_NUVEM"
else
  echo "   nao deu para falar com a hospedagem agora"
  : > "$INIT"
fi
# A configuracao do cliente e publica por desenho; o arquivo temporario so precisa
# ser lido pelo usuario da ponte, que e quem grava a configuracao local.
chmod 0644 "$INIT"
(cd / && sudo -u "$USUARIO_PONTE" "$NODE" - "$CONFIG" "$INIT" "$NOME_MAQUINA") <<'EOF'
const fs = require('fs');
const crypto = require('crypto');
const [caminho, init, nome] = process.argv.slice(2);
let atual = {};
try { atual = JSON.parse(fs.readFileSync(caminho, 'utf8')); } catch {}
let sdk = {};
try { sdk = JSON.parse(fs.readFileSync(init, 'utf8')); } catch {}
if (!sdk.apiKey && !atual.apiKey) { console.error('   sem configuracao do cliente, nem nova nem gravada'); process.exit(2); }
const novo = {
  maquinaId: atual.maquinaId || 'maquina-' + crypto.randomBytes(6).toString('hex'),
  nomeMaquina: atual.nomeMaquina || nome,
  projectId: sdk.projectId || atual.projectId,
  apiKey: sdk.apiKey || atual.apiKey,
  authDomain: sdk.authDomain || atual.authDomain,
  appId: sdk.appId || atual.appId,
  criadoEm: atual.criadoEm || new Date().toISOString(),
};
fs.writeFileSync(caminho + '.novo', JSON.stringify(novo, null, 2), { mode: 0o600 });
fs.renameSync(caminho + '.novo', caminho);
console.log(`   maquina ${novo.maquinaId}, "${novo.nomeMaquina}", projeto ${novo.projectId}`);
EOF
rm -f -- "$INIT"
chmod 0600 "$CONFIG"

GANCHOS_JSON="$PASTA_GANCHOS/ganchos.json"
if [ -f "$GANCHOS_JSON" ]; then
  echo "   $GANCHOS_JSON ja existe e foi mantido como estava"
else
  "$NODE" - "$GANCHOS_JSON" "$CONTEUDO_DE_TODOS" <<'EOF'
const fs = require('fs');
const [caminho, todos] = process.argv.slice(2);
const cfg = {
  ligado: true,
  conteudoDeTodos: todos === 'true',
  projetosLiberados: [],
  projetosIgnorados: [],
  tetoBytesPorSessao: 4194304,
  tetoArquivosNaFila: 2000,
  nota: 'ligado=false desliga os ganchos na hora, sem mexer no Claude Code. conteudoDeTodos=true, decisao do diretor na OST 10, sobe CONTEUDO de todo projeto que nao esta em projetosIgnorados. projetosIgnorados tira o projeto por inteiro, nem metadado. As listas comparam por fronteira de caminho, e no Linux maiuscula conta.',
};
fs.writeFileSync(caminho, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o644 });
EOF
  chown "$USUARIO_PONTE:$USUARIO_PONTE" "$GANCHOS_JSON"; chmod 0644 "$GANCHOS_JSON"
  echo "   $GANCHOS_JSON gravado, conteudo de todos os projetos: $CONTEUDO_DE_TODOS"
fi

# ---------------------------------------------------------------------------
echo "7. Ganchos do Claude Code de $DIRETOR"
sudo -u "$DIRETOR" -H "$NODE" "$RAIZ_APP/app/linux/ligar-ganchos.mjs" "$NODE" "$RAIZ_APP/app/ganchos/a-fabrica-gancho.cjs"
echo "   sessao do Claude Code que ja estava aberta so passa a aparecer depois de reabrir"

# ---------------------------------------------------------------------------
echo "8. Servico do systemd"
cat > "/etc/systemd/system/$UNIDADE.service" <<EOF
# A Fabrica, ponte local, OST 14. Gravado por ponte/linux/instalar.sh.
[Unit]
Description=A Fabrica: ponte local entre o painel e o Claude Code
After=network-online.target
Wants=network-online.target
# Sem login feito, a ponte nao tem o que fazer: nao sobe, e nao fica tentando.
ConditionPathExists=$PASTA_PONTE/sessao.json
StartLimitIntervalSec=0

[Service]
Type=simple
User=$USUARIO_PONTE
Group=$USUARIO_PONTE
UMask=0077
WorkingDirectory=$PASTA_PONTE
Environment=HOME=$PASTA_PONTE
Environment=PONTE_PASTA_LOCAL=$PASTA_PONTE
Environment=PONTE_PASTA_GANCHOS=$PASTA_GANCHOS
Environment=PONTE_PASTA_FILA_GANCHOS=$PASTA_GANCHOS
Environment=PONTE_FABRICA_COMO=$DIRETOR
Environment=PONTE_CASA_DIRETOR=$CASA
Environment=PONTE_CWD=$CASA
Environment=PONTE_TRAVA_MAQUINA=/run/$UNIDADE/ponte-no-ar.json
RuntimeDirectory=$UNIDADE
RuntimeDirectoryMode=0755
ExecStart=$NODE $RAIZ_APP/app/dist/ponte.js
Restart=always
RestartSec=10
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
chmod 0644 "/etc/systemd/system/$UNIDADE.service"
systemctl daemon-reload
systemctl enable "$UNIDADE" >/dev/null 2>&1
echo "   $UNIDADE.service ligado: sobe com a maquina e volta em 10 segundos se cair"

# ---------------------------------------------------------------------------
echo "9. Login"
if [ -f "$PASTA_PONTE/sessao.json" ]; then
  echo "   a ponte ja tem sessao, nada a fazer"
elif [ "$SEM_LOGIN" = "1" ]; then
  echo "   deixado para depois: sudo bash $RAIZ_APP/app/linux/entrar.sh"
else
  bash "$RAIZ_APP/app/linux/entrar.sh" || true
fi

# ---------------------------------------------------------------------------
echo "10. Subindo a ponte"
if [ -f "$PASTA_PONTE/sessao.json" ]; then
  systemctl restart "$UNIDADE"
  sleep 8
  if systemctl is-active --quiet "$UNIDADE"; then
    echo "   ponte no ar. Registro: journalctl -u $UNIDADE"
  else
    echo "   a ponte nao ficou de pe. Veja: journalctl -u $UNIDADE -n 50"
    exit 1
  fi
else
  echo "   a ponte ainda nao tem sessao. Falta o login: sudo bash $RAIZ_APP/app/linux/entrar.sh"
fi
echo ""
echo "Instalacao concluida."
