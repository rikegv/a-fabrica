# instalar.ps1, instalacao de um passo da ponte da Fabrica.
# O diretor roda isto UMA vez. Nao edita arquivo de configuracao na mao.
# Faz: instala dependencias, gera o id de pareamento da maquina, registra a ponte
# para subir sozinha no logon, e aponta o unico passo interativo que falta (o login
# de cliente do diretor no Firebase).
#
# §A.9: nao altera nada do Claude Code nem do Antigravity. So acrescenta a ponte.
# Nenhum segredo entra no repositorio: a configuracao local vive em ~/.a-fabrica-ponte.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$configDir = Join-Path $env:USERPROFILE '.a-fabrica-ponte'
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

Write-Host 'A Fabrica, instalacao da ponte'

# 1. Dependencias
Write-Host '1. Instalando dependencias...'
Push-Location $raiz
npm install --no-fund --no-audit
Pop-Location

# 2. Id de pareamento da maquina (gerado uma vez, fica local)
$cfg = Join-Path $configDir 'config.json'
if (-not (Test-Path $cfg)) {
  $maquinaId = 'maquina-' + [guid]::NewGuid().ToString('N').Substring(0,12)
  @{ maquinaId = $maquinaId; projeto = 'a-fabrica-soulan' } | ConvertTo-Json | Set-Content -Encoding utf8 $cfg
  Write-Host "2. Maquina pareada com id $maquinaId"
} else {
  Write-Host '2. Maquina ja pareada'
}

# 3. Registrar para subir sozinha no logon (Agendador de Tarefas, so acrescenta)
$node = (Get-Command node).Source
$script = Join-Path $raiz 'src\ponte.mjs'
$acao = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $raiz
$gatilho = New-ScheduledTaskTrigger -AtLogOn
$cfgObj = Get-Content $cfg | ConvertFrom-Json
$env:PONTE_MAQUINA_ID = $cfgObj.maquinaId
Register-ScheduledTask -TaskName 'A Fabrica Ponte' -Action $acao -Trigger $gatilho -Force | Out-Null
Write-Host '3. Ponte registrada para subir sozinha quando o computador liga'

Write-Host ''
Write-Host 'Falta um unico passo, so o diretor faz, uma vez:'
Write-Host '  o login de cliente do diretor no Firebase, para a ponte entrar como voce, sem chave de servico.'
Write-Host '  O comando exato esta na LISTA DE PENDENCIAS do relatorio da OST 5.'
Write-Host ''
Write-Host 'Pronto. Depois do login, a ponte sobe sozinha no proximo logon, ou rode agora: npm run ponte'
