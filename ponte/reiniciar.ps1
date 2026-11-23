# reiniciar.ps1, reinicia a ponte de verdade. OST 11, Onda 0.
#
# Parar a tarefa nao basta desde que a ponte roda sem janela: o agendador encerra
# o console sem janela, e o node que estava dentro dele fica vivo, orfao. Por isso
# este script encerra tambem o processo que a trava de instancia unica aponta, e
# so ele, pelo numero, nunca por nome. Depois sobe a tarefa de novo e confere que
# a ponte nova tomou a trava.
#
# Quem roda e a fabrica, §A.24, DEPOIS de conferir que nenhuma fabrica aberta pela
# ponte esta trabalhando. Este script nao confere isso sozinho.

$ErrorActionPreference = 'Stop'
$trava = Join-Path $env:USERPROFILE '.a-fabrica-ponte\locks\ponte-no-ar.json'

Stop-ScheduledTask -TaskName 'A Fabrica Ponte' -ErrorAction SilentlyContinue
if (Test-Path $trava) {
  $antes = Get-Content $trava -Raw | ConvertFrom-Json
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($antes.pid)"
  if ($p -and $p.CommandLine -match 'ponte\.js') {
    Stop-Process -Id $antes.pid -Force
    Write-Host "   ponte antiga encerrada, processo $($antes.pid)"
  }
}
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName 'A Fabrica Ponte'
$nova = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $trava) {
    $t = Get-Content $trava -Raw | ConvertFrom-Json
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($t.pid)"
    if ($p -and $p.CommandLine -match 'ponte\.js') { $nova = $t; break }
  }
}
if ($nova) {
  Write-Host "   ponte no ar, processo $($nova.pid), desde $($nova.desde)"
} else {
  Write-Host '   a ponte nao tomou a trava em 30 segundos. Veja o registro do dia em .a-fabrica-ponte\registros'
  exit 1
}
