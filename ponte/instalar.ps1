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
# OST 7: a COLAGEM de credencial MORREU. O login agora e no navegador, por laco de
# retorno em 127.0.0.1, liberado pelo esclarecimento do §A.6 do diretor. Nao existe
# mais -Colar, e nao existe mais caminho que peca credencial no terminal.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1
#   powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -SemSubir
#       (instala e registra, sem subir a ponte agora)
#   powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -SemNavegador
#       (nao abre a pagina de login; serve para conferir o que ja esta instalado)

param(
  [switch]$SemSubir,
  [switch]$SemNavegador
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

# A configuracao do cliente vem da PROPRIA HOSPEDAGEM, que a serve em aberto, de
# proposito, porque ela e publica por desenho (chave de API de cliente, dominio de
# autenticacao, identificador do projeto e do aplicativo). Isto e conexao de SAIDA
# e nao pede credencial nenhuma.
#
# Mudou na OST 7, e o motivo e pratico: antes isto dependia do firebase CLI estar
# logado, e quando a credencial dele venceu a instalacao travou. A instalacao da
# ponte nao pode depender de login de outra ferramenta.
$sdk = $null
$guardaErro = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $sdk = Invoke-RestMethod -Uri "https://$projetoNuvem.web.app/__/firebase/init.json" -TimeoutSec 20
} catch {
  $sdk = $null
} finally {
  $ErrorActionPreference = $guardaErro
}

if ($sdk -and $sdk.apiKey) {
  Write-Host "   configuracao do cliente lida da hospedagem de $projetoNuvem"
} elseif ($atual -and $atual.apiKey) {
  Write-Host '   nao deu para falar com a hospedagem agora, mantendo a configuracao que ja estava gravada'
  $sdk = [pscustomobject]@{ projectId = $atual.projectId; apiKey = $atual.apiKey; authDomain = $atual.authDomain; appId = $atual.appId }
} else {
  Write-Host ''
  Write-Host 'Nao deu para ler a configuracao do cliente, e nao existe nenhuma gravada aqui ainda.'
  Write-Host "Confira a sua conexao e se o painel responde: https://$projetoNuvem.web.app"
  exit 2
}
if (-not $sdk.appId) { $sdk | Add-Member -NotePropertyName appId -NotePropertyValue $appWeb -Force }

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
Write-Host '4. Login de uma vez, no seu navegador. A ponte entra como voce, sem chave de servico'
Push-Location $raiz
$loginOk = $false
$codigoLogin = -1
try {
  if ($SemNavegador) {
    node dist/entrar.js --sem-navegador
  } else {
    node dist/entrar.js
  }
  $codigoLogin = $LASTEXITCODE
  $loginOk = ($codigoLogin -eq 0)
} finally {
  Pop-Location
}

if ($codigoLogin -eq 2) {
  Write-Host ''
  Write-Host 'A ponte nao tem configuracao local. Rode a instalacao de novo, sem -SemNavegador.'
}
if ($codigoLogin -eq 5) {
  Write-Host ''
  Write-Host 'O login funcionou, mas a tranca do arquivo de sessao nao ficou de pe.'
  Write-Host 'A ponte vai recusar subir assim, de proposito: esse arquivo vale como chave de aprovacao.'
  Write-Host 'Rode a instalacao de novo. Se repetir, avise a fabrica com a mensagem acima.'
}

if (-not $loginOk) {
  Write-Host ''
  Write-Host 'A instalacao seguiu, mas a ponte ainda nao tem sessao sua. Falta um passo, uma vez so.'
  Write-Host 'O resto da instalacao ja esta feito, inclusive a tarefa que sobe a ponte sozinha.'
  Write-Host ''
  Write-Host '  Passo unico:'
  Write-Host '    powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1'
  Write-Host '    Vai abrir uma pagina nesta maquina, em 127.0.0.1. Entre com a sua conta do Google.'
  Write-Host ''
  Write-Host '  Por que no navegador, e nao uma chave de servico: a ponte entra como voce pelo login de'
  Write-Host '  CLIENTE, que e o escopo exato que as regras do Firestore controlam. Ela nao usa o token do'
  Write-Host '  Firebase CLI, que carrega escopo de nuvem muito maior. A pagina do login vive segundos,'
  Write-Host '  so no laco de retorno desta maquina, e fecha sozinha. Nenhuma porta fica aberta depois.'
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
  Write-Host 'Instalacao concluida, menos a sessao. Faca o passo unico acima e a ponte sobe.'
}
