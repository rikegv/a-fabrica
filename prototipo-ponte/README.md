# prototipo-ponte, prova de conceito da ponte (OST 1, Parte 2)

Codigo descartavel. Serve so para provar as quatro provas da OST em sessao viva, pilotando a CLI oficial `agy`. Nao e producao e nao vira a ponte final.

## Como rodar

```
node prototipo-ponte/ponte-poc.mjs
```

Precisa de Node 20, do `agy` instalado e autenticado, e da pasta de teste `a-fabrica-lab/projeto-bobo`. Gasta cota, pois abre sessoes de verdade.

## Arquivos

- `ponte-poc.mjs`: roda as provas 1, 2, 3 e 4 contra o `agy`, imprimindo a saida real.
- `pretool-hook.mjs`: o hook `PreToolUse` da prova 3. A ponte, no ponto de decisao: percebe o pedido, grava em arquivo local, espera a resposta do diretor vinda de fora e devolve `allow` ou `deny` ao `agy`.
- `hooks.json.exemplo`: como registrar o hook. Na prova, viveu em `a-fabrica-lab/projeto-bobo/.agents/hooks.json`, nunca na config global (§A.9).
- `evidencia/`: saidas reais capturadas nas provas.

## Regras honradas

- §A.6: nao abre porta de entrada, nao fala com nuvem. So escreve em arquivos locais.
- §A.9: nao altera a configuracao existente do Antigravity. O hook fica na pasta de teste descartavel.

O veredito completo, com os formatos de dados reais e as limitacoes, esta em `docs/prova-ponte.md`.
