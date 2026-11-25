#!/bin/bash
# desinstalar.sh, desfaz a ponte no Linux. OST 14.
#
#   sudo bash /opt/a-fabrica-ponte/app/linux/desinstalar.sh
#
# O que faz: para e desliga o servico, tira do ~/.claude/settings.json do diretor
# SO as entradas da Fabrica (com copia de seguranca), e tira a regra do sudo, a
# unidade do systemd e os dois lancadores, arquivo por arquivo, pelo nome, §A.18.
#
# O que NAO apaga, de proposito, §A.17: a pasta da ponte (com a sessao, que vale
# como chave de aprovacao), a fila dos ganchos, as versoes em /opt e o usuario
# fabrica-ponte. O script diz no fim o que ficou e onde. A sessao pode ser cortada
# na pagina de permissoes da conta Google do diretor.
set -euo pipefail
[ "$(id -u)" = "0" ] || { echo "Rode com sudo: sudo bash $0"; exit 1; }
DIRETOR="$(systemctl show -p Environment --value a-fabrica-ponte 2>/dev/null | tr ' ' '\n' | sed -n 's/^PONTE_FABRICA_COMO=//p')"
NODE="$(readlink -f "$(command -v node)")"
systemctl disable --now a-fabrica-ponte >/dev/null 2>&1 || true
echo "1. servico a-fabrica-ponte parado e desligado"
if [ -n "$DIRETOR" ]; then
  sudo -u "$DIRETOR" -H "$NODE" /opt/a-fabrica-ponte/app/linux/desligar-ganchos.mjs
  echo "2. ganchos tirados do Claude Code de $DIRETOR"
else
  echo "2. nao achei o diretor na unidade; rode na mao, como ele: node /opt/a-fabrica-ponte/app/linux/desligar-ganchos.mjs"
fi
rm -f -- /etc/sudoers.d/a-fabrica-ponte
rm -f -- /etc/systemd/system/a-fabrica-ponte.service
rm -f -- /opt/a-fabrica-ponte/bin/claude-como-diretor
rm -f -- /opt/a-fabrica-ponte/bin/ler-transcricao
systemctl daemon-reload
echo "3. regra do sudo, unidade do systemd e lancadores tirados"
echo ""
echo "Ficou, de proposito: /var/lib/a-fabrica-ponte, /var/lib/a-fabrica-ganchos, /opt/a-fabrica-ponte/versao-* e o usuario fabrica-ponte."
