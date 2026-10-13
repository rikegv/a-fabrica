# prototipo-ponte, prova de conceito da ponte

Codigo descartavel. Prova, em sessao viva com a CLI oficial `agy`, o que a ponte consegue fazer. Nao e producao.

## Arquivos por OST

OST 1 Parte 2, prova de conceito:
- `ponte-poc.mjs`: abre, enxerga e comanda de novo pelo `agy`.

OST 1 Parte 2 tarefa 2, spike da inversao (vetado):
- `ponte-inversao.mjs`: o hook como portao, com o furo do hook ausente.

OST 2, portao a prova e pacote completo:
- `ponte-portao.mjs`: roda as provas 1 a 5. So abre fabrica com prova positiva do portao (isca bloqueada).
- `ponte-espera-longa.mjs`: prova 6, espera acima de 5 minutos.
- `pretool-hook.mjs`: o PORTAO. Isca, pacote de aprovacao, espera do diretor, falha fechada.
- `pacote.mjs`: monta o pacote de aprovacao marcando fato e deducao.
- `hooks.json.exemplo`: registro do hook (vive na pasta de teste, nunca global).
- `config-grant-minimo.exemplo.json`: pre-autorizacao minima, dois echoes inertes ancorados.
- `evidencia/`: saidas reais.

## Como rodar

```
node prototipo-ponte/ponte-portao.mjs       # provas 1 a 5
node prototipo-ponte/ponte-espera-longa.mjs # prova 6, demora mais de 5 min
```

Precisa de Node 20, `agy` instalado e autenticado, e da pasta `a-fabrica-lab`. Gasta cota, pois abre sessoes de verdade.

## Regras honradas
- §A.6: sem porta de entrada, sem nuvem, so arquivos locais.
- §A.9: nao altera a config do Antigravity. Hook e pre-autorizacao vivem na pasta de teste e num HOME descartavel.
- Cada rodada tem pasta nova e datada em `a-fabrica-lab/rodadas`, com a fila dentro. Nada e apagado para limpar.

Veredito completo, formato dos dados e parecer de seguranca em `docs/prova-ponte.md`.
