# registrar-tarefa.ps1, a tarefa agendada que mantem o painel local de pe. OST 12.
#
# Mesmo desenho da tarefa da ponte (ponte\registrar-tarefa.ps1): roda sem janela
# (conhost --headless), sobe no logon e e chamada a cada 5 minutos. Se o painel
# esta no ar, o agendador ignora a chamada (IgnoreNew), e o manter-no-ar.ps1
# tambem sai sozinho se a porta 3000 ja responde.
#
#   powershell -ExecutionPolicy Bypass -File painel\registrar-tarefa.ps1
#
# A.9: nao altera nada do Claude Code nem do Antigravity, so acrescenta esta tarefa.

param([switch]$SemSubir)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $raiz 'manter-no-ar.ps1'
$conhost = Join-Path $env:WINDIR 'System32\conhost.exe'
$ps = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path $conhost)) { throw "nao achei $conhost, o painel nao tem como rodar sem janela" }

$acao = New-ScheduledTaskAction -Execute $conhost -Argument "--headless `"$ps`" -NoProfile -ExecutionPolicy Bypass -File `"$script`"" -WorkingDirectory $raiz
$noLogon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$religar = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Days 0)
Register-ScheduledTask -TaskName 'A Fabrica Painel' -Action $acao -Trigger @($noLogon, $religar) -Settings $ajustes -Description 'Painel local da Fabrica em http://localhost:3000, so 127.0.0.1. Roda sem janela e se religa a cada 5 minutos se cair.' -Force | Out-Null
Write-Host '   tarefa A Fabrica Painel registrada: sem janela, sobe no logon e se religa a cada 5 minutos se cair'

if (-not $SemSubir) {
  Start-ScheduledTask -TaskName 'A Fabrica Painel'
}
