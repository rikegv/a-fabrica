# ligar.ps1, liga os ganchos de ciclo de vida na configuracao GERAL do Claude Code.
#
# Depois disto, TODA sessao que o diretor abrir, de qualquer projeto, se anuncia na
# fila local, e a ponte publica na base. O diretor nao muda o jeito de trabalhar.
#
# §A.9, e aqui ela manda: este script SO ACRESCENTA. Ele nunca altera nem remove
# nada que ja estava em settings.json. Antes de tocar no arquivo, grava uma copia
# com data e hora no nome, numa pasta que nunca e sobrescrita, §A.17.
#
# DESLIGAR E UM PASSO SO:
#   powershell -ExecutionPolicy Bypass -File ponte\ganchos\desligar.ps1
# Ele devolve o Claude Code exatamente como era, tirando so as entradas que este
# script colocou.
#
# METADADO DE TODOS, CONTEUDO SO DE LIBERADO, decisao do diretor na retomada da
# OST 7. A liberacao de conteudo e projeto por projeto, e a lista comeca com so
# a-fabrica. Projeto novo nasce SEM liberacao, sempre. Este script nunca libera
# nada sozinho: fora do que o diretor passar em -Liberar, so mantem o que ja
# estava liberado antes.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File ponte\ganchos\ligar.ps1
#   powershell -ExecutionPolicy Bypass -File ponte\ganchos\ligar.ps1 -Ignorar "C:\Users\Henrique\Desktop\centrafin-app"
#   powershell -ExecutionPolicy Bypass -File ponte\ganchos\ligar.ps1 -Liberar "C:\Users\Henrique\a-fabrica"

param(
  # Projeto que nao gera NEM metadado: sai do painel por inteiro.
  [string[]]$Ignorar = @(),
  # Projeto liberado para CONTEUDO. Sem isto, so metadado.
  [string[]]$Liberar = @()
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$pastaPonte = Join-Path $env:USERPROFILE '.a-fabrica-ponte'
$pastaGanchos = Join-Path $pastaPonte 'ganchos'
$pastaCopias = Join-Path $pastaPonte 'copias-settings'
$settings = Join-Path $env:USERPROFILE '.claude\settings.json'
$ganchoInstalado = Join-Path $pastaGanchos 'a-fabrica-gancho.cjs'
$configGanchos = Join-Path $pastaPonte 'ganchos.json'
$selo = (Get-Date).ToString('yyyy-MM-ddTHHmmss')

Write-Host 'A Fabrica, ligando os ganchos de ciclo de vida do Claude Code'
Write-Host ''

# ---------------------------------------------------------------------------
# 1. Copia de seguranca da configuracao do diretor, ANTES de qualquer coisa
# ---------------------------------------------------------------------------
if (-not (Test-Path $settings)) {
  Write-Host "Nao achei $settings. Abra o Claude Code uma vez e rode de novo."
  exit 2
}
New-Item -ItemType Directory -Force -Path $pastaCopias | Out-Null
$copia = Join-Path $pastaCopias "settings-$selo.json"
Copy-Item -LiteralPath $settings -Destination $copia
Write-Host "1. Copia de seguranca gravada em $copia"

# ---------------------------------------------------------------------------
# 2. O gancho instalado fora do repositorio, em pasta estavel e fechada
# ---------------------------------------------------------------------------
# Fora do repositorio de proposito: se o diretor mover ou renomear a pasta do
# projeto, o gancho continua existindo e a sessao dele nao quebra.
New-Item -ItemType Directory -Force -Path $pastaGanchos | Out-Null
Copy-Item -LiteralPath (Join-Path $raiz 'gancho.cjs') -Destination $ganchoInstalado -Force
Write-Host "2. Gancho instalado em $ganchoInstalado"

# ---------------------------------------------------------------------------
# 3. Configuracao dos ganchos, com a lista de projetos a ignorar
# ---------------------------------------------------------------------------
$ignoradosAtuais = @()
$liberadosAtuais = @()
if (Test-Path $configGanchos) {
  try {
    $antes = Get-Content $configGanchos -Raw | ConvertFrom-Json
    if ($antes.projetosIgnorados) { $ignoradosAtuais = @($antes.projetosIgnorados) }
    if ($antes.projetosLiberados) { $liberadosAtuais = @($antes.projetosLiberados) }
  } catch { $ignoradosAtuais = @(); $liberadosAtuais = @() }
}
$listaIgnorar = @($ignoradosAtuais + $Ignorar | Where-Object { $_ } | Select-Object -Unique)
# A lista de liberados NUNCA cresce sozinha. Projeto novo nasce sem liberacao, e
# e o diretor quem acrescenta, um a um, com -Liberar.
$listaLiberar = @($liberadosAtuais + $Liberar | Where-Object { $_ } | Select-Object -Unique)

$cfg = [ordered]@{
  ligado             = $true
  projetosLiberados  = $listaLiberar
  projetosIgnorados  = $listaIgnorar
  tetoBytesPorSessao = 4194304
  tetoArquivosNaFila = 2000
  nota               = 'ligado=false desliga os ganchos na hora, sem mexer no Claude Code. projetosLiberados libera CONTEUDO (texto do comando, alvo, descricao, aviso, motivo) daquele projeto; fora dela sobe so METADADO. projetosIgnorados tira o projeto por inteiro, nem metadado. As duas comparam por fronteira de caminho: igual, ou seguido de separador, entao a-fabrica nao alcanca a-fabrica-lab.'
}
[System.IO.File]::WriteAllText($configGanchos, ($cfg | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "3. Configuracao em $configGanchos"
Write-Host "   $($listaLiberar.Count) projeto(s) liberado(s) para conteudo, $($listaIgnorar.Count) projeto(s) ignorado(s) por inteiro"
if ($listaLiberar.Count -eq 0) {
  Write-Host '   Nenhum projeto liberado para conteudo: o painel vai mostrar as fabricas, sem o texto.'
}

# ---------------------------------------------------------------------------
# 4. Acrescentar as entradas em settings.json, sem tocar no que ja esta la
# ---------------------------------------------------------------------------
# PreToolUse NAO entra nesta lista, e e decisao consciente: gancho de PreToolUse
# que devolve codigo 2 BLOQUEIA a ferramenta. O passo e capturado em PostToolUse,
# que nao tem esse poder, e assim o gancho nao tem nem como atrapalhar por engano.
$eventos = @('SessionStart', 'UserPromptSubmit', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'Stop', 'SessionEnd', 'Notification')

$texto = Get-Content $settings -Raw
$json = $texto | ConvertFrom-Json

if (-not $json.PSObject.Properties.Name.Contains('hooks')) {
  $json | Add-Member -NotePropertyName hooks -NotePropertyValue ([pscustomobject]@{}) -Force
}

$acrescentados = 0
$jaTinha = 0
foreach ($evento in $eventos) {
  $comando = "node `"$ganchoInstalado`" $evento"
  $entrada = [pscustomobject]@{
    hooks = @([pscustomobject]@{ type = 'command'; command = $comando; timeout = 5 })
  }

  $existentes = @()
  if ($json.hooks.PSObject.Properties.Name -contains $evento) {
    $existentes = @($json.hooks.$evento)
  }

  # Se a nossa entrada ja esta la, nao duplica. Qualquer outra entrada que o
  # diretor tenha fica intacta, §A.9.
  $nossa = $existentes | Where-Object {
    $_.hooks | Where-Object { $_.command -and $_.command.Contains('a-fabrica-gancho') }
  }
  if ($nossa) {
    $jaTinha++
    continue
  }

  $json.hooks | Add-Member -NotePropertyName $evento -NotePropertyValue (@($existentes) + @($entrada)) -Force
  $acrescentados++
}

# Grava em arquivo temporario e so entao troca, para uma falha no meio nao deixar
# a configuracao do diretor pela metade.
$temporario = "$settings.novo"
[System.IO.File]::WriteAllText($temporario, ($json | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
# Confere que o que foi escrito e JSON valido ANTES de trocar.
$null = Get-Content $temporario -Raw | ConvertFrom-Json
Move-Item -LiteralPath $temporario -Destination $settings -Force

Write-Host "4. settings.json: $acrescentados evento(s) acrescentado(s), $jaTinha ja estava(m) ligado(s)"
Write-Host ''
Write-Host 'Pronto. Abra uma sessao nova do Claude Code em qualquer projeto e ela aparece no painel.'
Write-Host 'Sessao que ja estava aberta antes disto nao tem gancho, porque o Claude Code le a'
Write-Host 'configuracao na abertura.'
Write-Host ''
Write-Host 'Para desligar, um passo:'
Write-Host '  powershell -ExecutionPolicy Bypass -File ponte\ganchos\desligar.ps1'
