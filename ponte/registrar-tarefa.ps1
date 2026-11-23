# registrar-tarefa.ps1, a tarefa agendada que mantem a ponte de pe. OST 11, Onda 0.
#
# Chamado pelo instalar.ps1, e tambem sozinho, quando so a tarefa precisa mudar:
#   powershell -ExecutionPolicy Bypass -File ponte\registrar-tarefa.ps1
#
# CASO REAL que mudou isto, 23/11/2026: a ponte caiu as 16:43:43 e nao voltou.
# 1. A tarefa chamava o node.exe direto, e com logon interativo o Windows abre uma
#    janela preta de console na tela do diretor. Fechar a janela mata a ponte com
#    0xC000013A, sem parada limpa. Agora o node roda dentro de um console SEM
#    JANELA (conhost --headless): nao existe janela para fechar por engano.
# 2. O "reiniciar se falhar" do agendador nao olha codigo de saida, entao a ponte
#    morta ficou morta. Agora, alem do logon, a tarefa e chamada a cada 5 minutos.
#    Se a ponte esta no ar, o agendador ignora a chamada (IgnoreNew), e se uma
#    ponte orfa estiver viva, a trava de instancia unica da propria ponte recusa
#    subir a segunda. Ver ponte\src\servico.ts.
#
# §A.9: nao altera nada do Claude Code nem do Antigravity, so a tarefa da ponte.
# §A.6: a ponte continua so com conexao de saida.

param([switch]$SemSubir)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node).Source
$script = Join-Path $raiz 'dist\ponte.js'
$conhost = Join-Path $env:WINDIR 'System32\conhost.exe'
if (-not (Test-Path $conhost)) { throw "nao achei $conhost, a ponte nao tem como rodar sem janela" }

$acao = New-ScheduledTaskAction -Execute $conhost -Argument "--headless `"$node`" `"$script`"" -WorkingDirectory $raiz
$noLogon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$religar = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)
Register-ScheduledTask -TaskName 'A Fabrica Ponte' -Action $acao -Trigger @($noLogon, $religar) -Settings $ajustes -Description 'Ponte local da Fabrica. So conexao de saida, nunca abre porta. Roda sem janela e se religa a cada 5 minutos se cair.' -Force | Out-Null
Write-Host '   tarefa A Fabrica Ponte registrada: sem janela, sobe no logon e se religa a cada 5 minutos se cair'

if (-not $SemSubir) {
  Start-ScheduledTask -TaskName 'A Fabrica Ponte'
  Start-Sleep -Seconds 3
  $info = Get-ScheduledTask -TaskName 'A Fabrica Ponte' | Get-ScheduledTaskInfo
  Write-Host "   estado da tarefa: $((Get-ScheduledTask -TaskName 'A Fabrica Ponte').State), ultimo resultado: $($info.LastTaskResult)"
}
