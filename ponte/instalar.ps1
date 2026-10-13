# instalar.ps1, instalacao de um passo da ponte da Fabrica.
#
# O diretor roda ISTO e so isto. Nao digita comando de instalacao complicado e nao
# edita arquivo de configuracao na mao.
#
# Faz, em ordem: instala dependencias, compila a ponte em TypeScript, pareia a
# maquina, grava a configuracao do cliente lendo do proprio Firebase, faz o login
# de uma vez, registra a ponte para subir sozinha quando o computador liga, e sobe
# a ponte agora.
#
# §A.9: nao altera nada do Claude Code nem do Antigravity, so acrescenta a ponte.
# §A.6: nenhum segredo entra no repositorio. A configuracao e a sessao vivem em
#       %USERPROFILE%\.a-fabrica-ponte, com permissao so do seu usuario.
# §A.20: todo comando do firebase diz o projeto de forma explicita.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1
#   powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Colar
#       (pede a credencial de sessao que o painel mostra, caso o login direto nao sirva)
#   powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -SemSubir
#       (instala e registra, sem subir a ponte agora)

param(
  [switch]$Colar,
  [switch]$SemSubir
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$projetoNuvem = 'a-fabrica-soulan'
$appWeb = '1:352717030070:web:6a784bc160ae657a0a9c17'
$configDir = Join-Path $env:USERPROFILE '.a-fabrica-ponte'
$cfg = Join-Path $configDir 'config.json'

Write-Host 'A Fabrica, instalacao da ponte'
Write-Host ''

# ---------------------------------------------------------------------------
# 1. Pasta local fechada para o seu usuario
# ---------------------------------------------------------------------------
Write-Host '1. Preparando a pasta local da ponte'
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $configDir 'locks') | Out-Null
icacls $configDir /inheritance:r | Out-Null
icacls $configDir /grant:r "$($env:USERNAME):(OI)(CI)F" | Out-Null
Write-Host "   pasta $configDir, so o seu usuario le e escreve"

# ---------------------------------------------------------------------------
# 2. Dependencias e compilacao
# ---------------------------------------------------------------------------
Write-Host '2. Instalando dependencias e compilando a ponte'
Push-Location $raiz
try {
  npm install --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { throw 'a instalacao de dependencias falhou' }
  npm run compilar
  if ($LASTEXITCODE -ne 0) { throw 'a compilacao da ponte falhou' }
} finally {
  Pop-Location
}
Write-Host '   dependencias instaladas e ponte compilada'

# ---------------------------------------------------------------------------
# 3. Pareamento da maquina e configuracao do cliente, lida do proprio Firebase
# ---------------------------------------------------------------------------
Write-Host '3. Pareando a maquina e gravando a configuracao do cliente'
$atual = $null
if (Test-Path $cfg) { $atual = Get-Content $cfg -Raw | ConvertFrom-Json }

$maquinaId = if ($atual -and $atual.maquinaId) { $atual.maquinaId } else { 'maquina-' + [guid]::NewGuid().ToString('N').Substring(0, 12) }
$nomeMaquina = if ($atual -and $atual.nomeMaquina) { $atual.nomeMaquina } else { $env:COMPUTERNAME }

# O firebase CLI escreve o andamento na saida de erro; por isso aqui a parada em
# erro fica suspensa e o JSON e recortado da saida junta.
$sdk = $null
$guardaErro = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $bruto = (& firebase apps:sdkconfig WEB $appWeb --project $projetoNuvem --json 2>&1 | Out-String)
  $inicio = $bruto.IndexOf('{')
  if ($inicio -ge 0) {
    $resposta = $bruto.Substring($inicio) | ConvertFrom-Json
    if ($resposta.result -and $resposta.result.sdkConfig) { $sdk = $resposta.result.sdkConfig }
    elseif ($resposta.result) { $sdk = $resposta.result }
  }
} catch {
  $sdk = $null
} finally {
  $ErrorActionPreference = $guardaErro
}

if (-not $sdk) {
  if ($atual -and $atual.apiKey) {
    Write-Host '   nao deu para falar com o Firebase agora, mantendo a configuracao que ja estava gravada'
    $sdk = [pscustomobject]@{ projectId = $atual.projectId; apiKey = $atual.apiKey; authDomain = $atual.authDomain; appId = $atual.appId }
  } else {
    Write-Host ''
    Write-Host 'Nao deu para ler a configuracao do cliente no Firebase.'
    Write-Host 'Entre na sua conta do Firebase com este comando e rode a instalacao de novo:'
    Write-Host '   firebase login'
    exit 2
  }
}

$novo = [ordered]@{
  maquinaId   = $maquinaId
  nomeMaquina = $nomeMaquina
  projectId   = $sdk.projectId
  apiKey      = $sdk.apiKey
  authDomain  = $sdk.authDomain
  appId       = $sdk.appId
  criadoEm    = if ($atual -and $atual.criadoEm) { $atual.criadoEm } else { (Get-Date).ToString('o') }
}
# Sem marca de ordem de bytes: o arquivo e lido por programa, nao por pessoa.
[System.IO.File]::WriteAllText($cfg, ($novo | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "   maquina pareada com id $maquinaId, configuracao gravada em $cfg"

# ---------------------------------------------------------------------------
# 4. Login de uma vez
# ---------------------------------------------------------------------------
Write-Host '4. Login de uma vez, a ponte entra como voce, sem chave de servico'
Push-Location $raiz
$loginOk = $false
try {
  if ($Colar) {
    node dist/entrar.js --colar
  } else {
    node dist/entrar.js
  }
  $loginOk = ($LASTEXITCODE -eq 0)
} finally {
  Pop-Location
}

if (-not $loginOk) {
  Write-Host ''
  Write-Host 'A instalacao seguiu, mas a ponte ainda nao tem sessao sua.'
  Write-Host 'Resolva assim, nesta ordem, e o resto da instalacao ja esta feito:'
  Write-Host ''
  Write-Host '  Clique 1, uma vez so, no console do Firebase:'
  Write-Host '    abra https://console.firebase.google.com/project/a-fabrica-soulan/authentication/providers'
  Write-Host '    clique em Comecar, escolha Google na lista de provedores, clique em Ativar e depois em Salvar.'
  Write-Host ''
  Write-Host '  Passo 2, no terminal, nesta pasta:'
  Write-Host '    powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1'
  Write-Host ''
  Write-Host '  Passo 3, so se o passo 2 ainda recusar: abra o painel no navegador, ja logado como voce,'
  Write-Host '    copie a credencial de sessao que ele mostra e rode'
  Write-Host '    powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Colar'
}

# ---------------------------------------------------------------------------
# 5. Subir sozinha quando o computador liga
# ---------------------------------------------------------------------------
Write-Host '5. Registrando a ponte para subir sozinha quando o computador liga'
$node = (Get-Command node).Source
$script = Join-Path $raiz 'dist\ponte.js'
$acao = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $raiz
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)
Register-ScheduledTask -TaskName 'A Fabrica Ponte' -Action $acao -Trigger $gatilho -Settings $ajustes -Description 'Ponte local da Fabrica. So conexao de saida, nunca abre porta.' -Force | Out-Null
Write-Host '   tarefa agendada A Fabrica Ponte criada'

# ---------------------------------------------------------------------------
# 6. Subir a ponte agora
# ---------------------------------------------------------------------------
if ($SemSubir) {
  Write-Host ''
  Write-Host 'Instalacao concluida. A ponte sobe no proximo logon, ou agora com: Start-ScheduledTask -TaskName "A Fabrica Ponte"'
  exit 0
}

if ($loginOk) {
  Write-Host '6. Subindo a ponte agora'
  Start-ScheduledTask -TaskName 'A Fabrica Ponte'
  Start-Sleep -Seconds 3
  $info = Get-ScheduledTask -TaskName 'A Fabrica Ponte' | Get-ScheduledTaskInfo
  Write-Host "   estado da tarefa: $((Get-ScheduledTask -TaskName 'A Fabrica Ponte').State), ultimo resultado: $($info.LastTaskResult)"
  Write-Host ''
  Write-Host 'Pronto. A ponte esta no ar e sobe sozinha quando o computador liga.'
} else {
  Write-Host ''
  Write-Host 'Instalacao concluida, menos a sessao. Depois do clique 1 acima, rode a instalacao de novo e a ponte sobe.'
}
