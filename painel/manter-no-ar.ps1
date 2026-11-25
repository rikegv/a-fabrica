# manter-no-ar.ps1, sobe o painel local em http://localhost:3000. OST 12.
#
# Chamado pela tarefa agendada "A Fabrica Painel" (ver registrar-tarefa.ps1), no
# logon e a cada 5 minutos. Se o painel ja responde na porta 3000, sai sem fazer
# nada. Se nao responde, sobe o next dev e fica preso a ele.
#
# CASO REAL que criou isto, 24/11/2026: o diretor abriu localhost:3000 e deu
# "conexao recusada". O painel nunca teve tarefa propria: rodava preso a uma
# sessao da fabrica e morreu junto com ela. A ponte ja voltava sozinha, o painel nao.
#
# A.6: escuta so em 127.0.0.1. Nada fora desta maquina alcanca a porta.
# A.17: cada subida escreve o seu proprio registro, com data e hora no nome.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path

$ocupada = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($ocupada) { exit 0 }

$pasta = Join-Path $env:LOCALAPPDATA 'a-fabrica\painel-registros'
New-Item -ItemType Directory -Force -Path $pasta | Out-Null
$registro = Join-Path $pasta ("painel-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".log")

Set-Location $raiz
$node = (Get-Command node).Source
"$(Get-Date -Format s) subindo o painel em 127.0.0.1:3000" | Out-File -FilePath $registro -Encoding utf8
# Gera os estilos antes, como o predev faria no npm run dev.
& $node scripts/gerar-estilos.mjs *>> $registro
& $node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3000 *>> $registro
"$(Get-Date -Format s) o painel saiu com codigo $LASTEXITCODE" | Out-File -FilePath $registro -Append -Encoding utf8
