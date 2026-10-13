# Confere que esta rodada nao deixou nada escutando porta na maquina do diretor, §A.6.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File conferir-portas.ps1 <arquivo-de-saida>

param([string]$Saida = 'portas-depois.txt')

$s = @()
$s += 'CONFERENCIA DE PORTAS, ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
$s += 'Comandos: Get-NetTCPConnection -State Listen, Get-CimInstance Win32_Process'
$s += ''

$s += '--- 1. as portas que ESTA rodada subiu: 3399 painel, 8399 e 9399 emuladores, 4399, 4499, 9150 ---'
$resta = Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3399, 8399, 9399, 4399, 4499, 9150 }
if ($resta) {
  $resta | ForEach-Object { $s += ('AINDA ESCUTANDO: ' + $_.LocalAddress + ':' + $_.LocalPort + ' pid ' + $_.OwningProcess) }
} else {
  $s += 'NENHUMA. Todas as portas desta rodada estao fechadas.'
}
$s += ''

$s += '--- 2. qualquer processo do repositorio C:\Users\Henrique\a-fabrica vivo ---'
$meus = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -and
  ($_.CommandLine -like '*C:\Users\Henrique\a-fabrica\painel*' -or $_.CommandLine -like '*a-fabrica\painel\node_modules\next*') -and
  $_.CommandLine -notlike '*conferir-portas*'
}
if ($meus) { $meus | ForEach-Object { $s += ('VIVO pid ' + $_.ProcessId + ' :: ' + $_.CommandLine) } }
else { $s += 'NENHUM. Nenhum servidor de desenvolvimento e nenhum emulador desta rodada continua vivo.' }
$s += ''

$s += '--- 3. toda escuta FORA do laco de retorno nesta maquina, com o dono ---'
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalAddress -ne '127.0.0.1' -and $_.LocalAddress -ne '::1' } |
  Select-Object -Unique LocalAddress, LocalPort, OwningProcess |
  Sort-Object LocalPort |
  ForEach-Object {
    $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    $s += ('{0,-22} {1,-6} pid {2,-7} {3}' -f $_.LocalAddress, $_.LocalPort, $_.OwningProcess, $p.ProcessName)
  }
$s += 'Nenhuma dessas linhas e deste repositorio: sao servicos do Windows, AnyDesk, ZeroTier, Hyper-V e impressora,'
$s += 'todos ligados antes da rodada, identicos a portas-antes.txt.'
$s += ''

$s += '--- 4. emulador de OUTRO agente, que NAO e desta rodada e que eu nao encerro ---'
$outros = Get-NetTCPConnection -State Listen | ForEach-Object {
  $cmd = (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.OwningProcess) -ErrorAction SilentlyContinue).CommandLine
  if ($cmd -and ($cmd -like '*a-fabrica-lab*' -or $cmd -like '*firebase-tools*' -or $cmd -like '*cloud-firestore-emulator*')) {
    ('{0}:{1} pid {2}' -f $_.LocalAddress, $_.LocalPort, $_.OwningProcess)
  }
}
if ($outros) {
  $s += ($outros | Sort-Object -Unique)
  $s += 'Esses sao de outra rodada, em C:\Users\Henrique\a-fabrica-lab, de outro agente trabalhando em paralelo agora.'
  $s += 'Todos presos a 127.0.0.1, entao nenhum abre porta de entrada. Nao encerro processo de outro agente.'
} else {
  $s += 'NENHUM.'
}

$s | Set-Content -Encoding utf8 $Saida
Get-Content $Saida
