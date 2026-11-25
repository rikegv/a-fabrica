#!/bin/bash
# entrar.sh, o login da ponte no Linux, no modelo do login do Claude Code. OST 14.
#
#   sudo bash /opt/a-fabrica-ponte/app/linux/entrar.sh            mostra o link e espera o endereco colado
#   sudo bash /opt/a-fabrica-ponte/app/linux/entrar.sh --link     so gera o link (vale 15 minutos)
#   sudo bash /opt/a-fabrica-ponte/app/linux/entrar.sh --codigo   le o endereco colado da entrada e conclui
#
# Roda o login COMO o usuario da ponte, para a sessao nascer na pasta trancada
# dela e nunca passar pelo usuario do diretor. Nada escuta porta.
set -euo pipefail
[ "$(id -u)" = "0" ] || { echo "Rode com sudo: sudo bash $0 $*"; exit 1; }
UNIDADE='a-fabrica-ponte'
PASTA_PONTE='/var/lib/a-fabrica-ponte'
APP='/opt/a-fabrica-ponte/app'
NODE="$(systemctl show -p ExecStart --value "$UNIDADE" 2>/dev/null | sed -n 's/.*path=\([^ ;]*\).*/\1/p')"
[ -n "$NODE" ] && [ -x "$NODE" ] || NODE="$(readlink -f "$(command -v node)")"
cd /
codigo=0
sudo -u fabrica-ponte env HOME="$PASTA_PONTE" PONTE_PASTA_LOCAL="$PASTA_PONTE" "$NODE" "$APP/dist/entrar.js" "$@" || codigo=$?
if [ "$codigo" = "0" ] && [ -f "$PASTA_PONTE/sessao.json" ] && [ "${1:-}" != "--link" ]; then
  systemctl restart "$UNIDADE" && echo "Ponte subindo. Registro: journalctl -u $UNIDADE"
fi
exit "$codigo"
