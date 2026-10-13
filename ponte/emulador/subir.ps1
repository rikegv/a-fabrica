# subir.ps1, sobe o emulador da base para a rodada de teste.
#
# O firebase CLI nao aceita arquivo de regras fora da pasta do projeto, por isso
# este script copia as regras implantadas para ca antes de subir. A fonte da
# verdade continua sendo firebase/firestore.rules, que ninguem altera por aqui.
#
# §A.20: o projeto vai explicito, sempre.

$ErrorActionPreference = 'Stop'
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$raizRepo = Resolve-Path (Join-Path $aqui '..\..')

Copy-Item (Join-Path $raizRepo 'firebase\firestore.rules') (Join-Path $aqui 'firestore.rules') -Force
Copy-Item (Join-Path $raizRepo 'firebase\firestore.indexes.json') (Join-Path $aqui 'firestore.indexes.json') -Force
Write-Host 'regras e indices copiados de firebase/ para o emulador'

firebase emulators:start --only firestore,auth --project a-fabrica-soulan --config (Join-Path $aqui 'firebase.json')
