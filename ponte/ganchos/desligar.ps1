# desligar.ps1, o botao de desligar de UM PASSO que a OST 7 exige.
#
# Depois de rodar isto, o Claude Code volta a ser exatamente o que era: as entradas
# que a Fabrica colocou em settings.json saem, e nada mais e tocado. O que o diretor
# tinha de gancho proprio, se tiver, fica onde estava.
#
# Tres niveis de desligar, do mais leve ao mais completo. Este script faz o mais
# completo, e o mais leve esta aqui escrito para o diretor saber que existe:
#
#   leve      abrir %USERPROFILE%\.a-fabrica-ponte\ganchos.json e por ligado: false.
#             O gancho continua sendo chamado, mas sai na primeira linha sem fazer
#             nada. Serve para desligar e religar na mesma tarde.
#   completo  ESTE SCRIPT. Tira as entradas de settings.json. O Claude Code deixa
#             de chamar o gancho.
#   total     ESTE SCRIPT com -ApagarFila, que tambem move a fila local para uma
#             pasta de arquivo morto. Nada e apagado, §A.17.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File ponte\ganchos\desligar.ps1
#   powershell -ExecutionPolicy Bypass -File ponte\ganchos\desligar.ps1 -ApagarFila

param(
  [switch]$ApagarFila
)

$ErrorActionPreference = 'Stop'
$pastaPonte = Join-Path $env:USERPROFILE '.a-fabrica-ponte'
$pastaCopias = Join-Path $pastaPonte 'copias-settings'
$settings = Join-Path $env:USERPROFILE '.claude\settings.json'
$configGanchos = Join-Path $pastaPonte 'ganchos.json'
$selo = (Get-Date).ToString('yyyy-MM-ddTHHmmss')

Write-Host 'A Fabrica, desligando os ganchos de ciclo de vida do Claude Code'
Write-Host ''

# ---------------------------------------------------------------------------
# 1. Interruptor leve primeiro, para o gancho parar JA, mesmo que o resto falhe
# ---------------------------------------------------------------------------
if (Test-Path $configGanchos) {
  try {
    $cfg = Get-Content $configGanchos -Raw | ConvertFrom-Json
    $cfg.ligado = $false
    [System.IO.File]::WriteAllText($configGanchos, ($cfg | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
    Write-Host '1. Interruptor desligado: o gancho sai calado na primeira linha, a partir de agora'
  } catch {
    Write-Host "1. Nao deu para escrever $configGanchos ($($_.Exception.Message)), seguindo para a configuracao"
  }
} else {
  Write-Host '1. Nao existe configuracao de gancho nesta maquina, seguindo'
}

# ---------------------------------------------------------------------------
# 2. Tirar as entradas de settings.json, e SO as nossas
# ---------------------------------------------------------------------------
if (-not (Test-Path $settings)) {
  Write-Host "2. Nao achei $settings, nada a tirar"
  exit 0
}

New-Item -ItemType Directory -Force -Path $pastaCopias | Out-Null
$copia = Join-Path $pastaCopias "settings-antes-de-desligar-$selo.json"
Copy-Item -LiteralPath $settings -Destination $copia
Write-Host "2. Copia de seguranca gravada em $copia"

$json = Get-Content $settings -Raw | ConvertFrom-Json
$tirados = 0

if ($json.PSObject.Properties.Name -contains 'hooks') {
  $eventos = @($json.hooks.PSObject.Properties.Name)
  foreach ($evento in $eventos) {
    $antes = @($json.hooks.$evento)
    # Fica tudo que NAO aponta para o nosso gancho. Entrada de gancho do diretor
    # passa por aqui intacta.
    $depois = @($antes | Where-Object {
        $nossa = $_.hooks | Where-Object { $_.command -and $_.command.Contains('a-fabrica-gancho') }
        -not $nossa
      })
    $tirados += ($antes.Count - $depois.Count)
    if ($depois.Count -eq 0) {
      $json.hooks.PSObject.Properties.Remove($evento)
    } else {
      $json.hooks | Add-Member -NotePropertyName $evento -NotePropertyValue $depois -Force
    }
  }
  # Se o bloco de ganchos ficou vazio, ele sai inteiro: o arquivo volta a nao ter
  # bloco de ganchos nenhum, que e exatamente como estava antes da Fabrica.
  if (@($json.hooks.PSObject.Properties.Name).Count -eq 0) {
    $json.PSObject.Properties.Remove('hooks')
    Write-Host '   o bloco de ganchos ficou vazio e foi removido inteiro'
  }
}

$temporario = "$settings.novo"
[System.IO.File]::WriteAllText($temporario, ($json | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
$null = Get-Content $temporario -Raw | ConvertFrom-Json
Move-Item -LiteralPath $temporario -Destination $settings -Force
Write-Host "3. settings.json: $tirados entrada(s) da Fabrica retirada(s)"

# ---------------------------------------------------------------------------
# 4. Fila local, se o diretor pedir. Movida, nunca apagada, §A.17
# ---------------------------------------------------------------------------
if ($ApagarFila) {
  $fila = Join-Path $pastaPonte 'fila-ganchos'
  if (Test-Path $fila) {
    $morto = Join-Path $pastaPonte "fila-ganchos-arquivada-$selo"
    Move-Item -LiteralPath $fila -Destination $morto
    Write-Host "4. Fila movida para $morto. Nada foi apagado, §A.17"
  } else {
    Write-Host '4. Nao existe fila local para arquivar'
  }
}

Write-Host ''
Write-Host 'Pronto. O Claude Code voltou a ser o que era.'
Write-Host 'Sessao que ja estava aberta continua com o gancho carregado ate ser fechada, porque'
Write-Host 'o Claude Code le a configuracao na abertura. O interruptor do passo 1 ja cobre isso:'
Write-Host 'nessas sessoes o gancho e chamado e sai sem fazer nada.'
Write-Host ''
Write-Host 'Para religar:'
Write-Host '  powershell -ExecutionPolicy Bypass -File ponte\ganchos\ligar.ps1'
