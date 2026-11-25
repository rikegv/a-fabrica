#!/bin/bash
# provar.sh, as provas da ponte no Linux, depois de instalada e com login. OST 14.
#
#   bash ponte/linux/provar.sh PASTA_DA_RODADA
#
# Roda COMO O DIRETOR, que e o usuario das fabricas. A parte 1 nao usa sudo de
# proposito: ela e a prova de que uma sessao do diretor nao le a credencial. As
# outras partes usam sudo para ler o registro do servico e para derrubar a ponte,
# e dizem isso na tela. Tudo vai para a pasta da rodada, §A.17. Nada e apagado.
set -uo pipefail
R="${1:?passe a pasta da rodada}"
mkdir -p "$R"
PASTA='/var/lib/a-fabrica-ponte'
U='a-fabrica-ponte'
ok=0; falhou=0
conta() { if [ "$1" = "0" ]; then ok=$((ok+1)); echo "  PASSOU: $2"; else falhou=$((falhou+1)); echo "  FALHOU: $2"; fi; }

PID="$(systemctl show -p MainPID --value "$U")"
[ -n "$PID" ] && [ "$PID" != "0" ] || { echo "a ponte nao esta no ar; rode depois do login"; exit 2; }

echo "1. A sessao do diretor ($(id -un)) NAO le a credencial da ponte, sem sudo" | tee "$R/1-tranca.txt"
{
  for alvo in "$PASTA/sessao.json" "$PASTA/config.json" "$PASTA/entrada-pendente.json"; do
    echo "--- cat $alvo"; cat "$alvo" 2>&1 | head -c 200; echo " (codigo $?)"
  done
  echo "--- ls $PASTA"; ls "$PASTA" 2>&1
  echo "--- stat"; stat -c '%n %a %U:%G' "$PASTA" 2>&1
  echo "--- node fs.readFileSync"; node -e "try{require('fs').readFileSync('$PASTA/sessao.json');console.log('LEU')}catch(e){console.log(e.code)}"
  echo "--- python open"; python3 -c "
try:
    open('$PASTA/sessao.json').read(); print('LEU')
except Exception as e: print(type(e).__name__)"
  echo "--- cp"; cp "$PASTA/sessao.json" "$R/copia-que-nao-pode-existir.json" 2>&1
  echo "--- memoria e ambiente do processo da ponte (pid $PID)"
  cat "/proc/$PID/environ" 2>&1 | head -c 100; echo
  head -c 100 "/proc/$PID/mem" 2>&1; echo
  echo "--- gdb/ptrace no processo da ponte"
  python3 -c "
import ctypes,os
libc=ctypes.CDLL(None,use_errno=True)
r=libc.ptrace(16,$PID,0,0)
print('ptrace attach', 'CONSEGUIU' if r==0 else 'negado, errno %d' % ctypes.get_errno())
if r==0: libc.ptrace(17,$PID,0,0)"
} >> "$R/1-tranca.txt" 2>&1
grep -q "LEU\|CONSEGUIU" "$R/1-tranca.txt"; [ $? -ne 0 ]; conta $? "nenhuma leitura da credencial, da memoria nem do ambiente da ponte"
[ ! -e "$R/copia-que-nao-pode-existir.json" ]; conta $? "a copia da sessao nao foi criada"
sed 's/^/    /' "$R/1-tranca.txt" | tail -n +2

echo "2. Nada escuta porta nova (§A.6). Usa sudo para ver o dono de cada porta" | tee "$R/2-portas.txt"
sudo ss -ltnup >> "$R/2-portas.txt" 2>&1
grep -q "pid=$PID," "$R/2-portas.txt"; [ $? -ne 0 ]; conta $? "o processo da ponte nao escuta porta nenhuma"

echo "3. Segunda ponte na mesma maquina e recusada" | tee "$R/3-segunda.txt"
APP=/opt/a-fabrica-ponte/app
NODE="$(systemctl show -p ExecStart --value "$U" | sed -n 's/.*path=\([^ ;]*\).*/\1/p')"
echo "--- como o diretor, sem sudo" >> "$R/3-segunda.txt"
# Pasta local falsa, dentro da rodada, para esta tentativa nao criar nada na casa do diretor.
timeout 30 env PONTE_PASTA_LOCAL="$R/pasta-local-da-tentativa" "$NODE" "$APP/dist/ponte.js" >> "$R/3-segunda.txt" 2>&1; c1=$?
echo "codigo $c1" >> "$R/3-segunda.txt"
echo "--- como o proprio usuario da ponte (sudo)" >> "$R/3-segunda.txt"
(cd / && timeout 30 sudo -u fabrica-ponte env HOME=$PASTA PONTE_PASTA_LOCAL=$PASTA PONTE_TRAVA_MAQUINA=/run/$U/ponte-no-ar.json "$NODE" "$APP/dist/ponte.js") >> "$R/3-segunda.txt" 2>&1; c2=$?
echo "codigo $c2" >> "$R/3-segunda.txt"
[ "$c1" = "7" ]; conta $? "segunda ponte rodada pelo diretor sai com 7 (recusa), sem subir"
[ "$c2" = "7" ]; conta $? "segunda ponte rodada pelo usuario da ponte sai com 7 (recusa), sem subir"
[ "$(systemctl show -p MainPID --value "$U")" = "$PID" ]; conta $? "a ponte de verdade continua no ar, mesmo processo $PID"
sed 's/^/    /' "$R/3-segunda.txt" | tail -n +2

echo "4. Memoria da ponte" | tee "$R/4-memoria.txt"
{
  date -Is
  grep -E 'VmRSS|VmHWM' "/proc/$PID/status"
  sudo grep -E '^(Rss|Pss|Private)' "/proc/$PID/smaps_rollup"
  echo "cgroup do servico, em bytes: $(cat /sys/fs/cgroup/system.slice/$U.service/memory.current 2>/dev/null) (pico $(cat /sys/fs/cgroup/system.slice/$U.service/memory.peak 2>/dev/null))"
  free -m
} >> "$R/4-memoria.txt" 2>&1
sed 's/^/    /' "$R/4-memoria.txt" | tail -n +2

echo "5. A ponte volta sozinha se cair (sudo kill -9 no processo $PID)" | tee "$R/5-queda.txt"
sudo kill -9 "$PID"
antes=$(date +%s)
novo=""
for i in $(seq 1 40); do
  sleep 1
  n="$(systemctl show -p MainPID --value "$U")"
  if [ -n "$n" ] && [ "$n" != "0" ] && [ "$n" != "$PID" ] && systemctl is-active --quiet "$U"; then novo="$n"; break; fi
done
echo "processo novo: ${novo:-nenhum}, depois de $(( $(date +%s) - antes )) segundo(s)" >> "$R/5-queda.txt"
sleep 12
sudo journalctl -u "$U" --since "@$antes" --no-pager -o short-iso >> "$R/5-queda.txt" 2>&1
[ -n "$novo" ]; conta $? "systemd religou a ponte depois do kill -9"
grep -q "ponte no ar" "$R/5-queda.txt"; conta $? "a ponte nova disse ponte no ar"
sed 's/^/    /' "$R/5-queda.txt" | tail -n +2 | grep -v "^\s*$" | tail -15

echo ""
echo "Resultado: $ok passou, $falhou falhou. Evidencia em $R" | tee "$R/resultado.txt"
[ "$falhou" = "0" ]
