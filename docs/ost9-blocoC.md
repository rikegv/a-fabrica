# OST 9, bloco C: provas contra a base real, 23/11/2026

Agente: coordenador, sozinho, em todas as partes. Base real `a-fabrica-soulan`, PC novo `SOULAN`, ponte instalada pelo diretor com as três linhas TRANCADO.

## O que foi solicitado
1. Commit e push no ramo `feature/ost5-madrugada` de tudo que estava pendente.
2. Rodar contra a base real o que ficou sem rodar: `prova:ressalvas`, os 7 testes, e os testes que dependiam do login (consumo subindo, fábrica externa, renomear).
3. Números sem arredondar, com o que falhou.
4. Registrar a decisão do diretor sobre a transcrição de projeto não liberado.
5. Não publicar, não tocar a main, deixar o painel pronto para a tela local.

## Números

| Prova | Resultado | Evidência |
|---|---|---|
| `npm run prova:ressalvas` | 3 de 3 ressalvas passaram | `a-fabrica-lab\rodadas\2026-11-23T1116-ost6-tres-ressalvas` |
| `npm run base-real`, os 7 testes | 7 de 7 passaram | `a-fabrica-lab\rodadas\2026-11-23T1117-ost6-sete-testes-base-real` |
| `npm run prova:tempo`, base real | passou; a resposta tardia foi negada pela base com `PERMISSION_DENIED`, e o arquivo que o agente queria escrever não existe | `a-fabrica-lab\rodadas\2026-11-23T1128-ost6-tempo-esgotado-base-real` |
| `npm run prova:ganchos` | 58 PASSOU, 0 FALHOU | |
| Provas do login, rodada nova | 13 de 14 conferências; a que falhou é critério meu, explicado abaixo | `a-fabrica-lab\rodadas\2026-11-23T112120-ost9-provas-login-base-real` |
| Externa retomada, código antigo (controle) | FALHOU: base 220.433 contra 110.258 reais | `...\2026-11-23T112648-ost9-externa-retomada-controle-sem-o-conserto-da-marca` |
| Externa retomada, com o conserto | PASSOU: base 110.249, transcrição 110.249, campo por campo | `...\2026-11-23T112553-ost9-externa-retomada-consertado` |

### As 14 conferências da rodada do login
**Fábrica aberta pela ponte (de teste)**
- O consumo subiu durante a execução: 99.419, depois 126.318, ainda em execução, e só então concluída.
- Dois comandos somam: 126.318 passou para 153.203.
- Renomear: o nome "TESTE renomeada pelo diretor" sobreviveu a um comando que trazia outro nome.
- O relógio da tarefa foi gravado, com início e fim.

**Externa, Claude Code aberto na mão numa pasta não liberada, publicada pela sua ponte de verdade**
- Apareceu na base com consumo e com modelo `claude-haiku-5-5`.
- Atividade: 4 passos, 0 com texto.
- Renomeada, o nome não voltou no prompt seguinte.
- **FALHOU, critério meu:** "externa sem nenhum caminho no documento". O campo `projeto` da base guarda o caminho completo, e isso é desenho do painel: a base guarda o caminho como metadado (§A.23, "qual projeto"), usado na escolha rápida de projeto. A tela mostra só o nome da pasta (`painel/src/dados/tradutor.ts`, linha 227). O pedido era "na tela, sem caminho", e isso se confere na validação visual.

## Problemas encontrados

### Consumo da externa contado em dobro na retomada (consertado)
A prova passou, mas os números não fechavam: o consumo da externa foi de 36.720 para 73.440, o dobro exato. A transcrição tem 2 mensagens, de 36.720 e 36.762, ou seja 73.482. Depois a base chegou a 110.202.

**Causa** (`ponte/src/ganchos.ts`): quando a sessão aberta na mão termina, a ponte arquiva o arquivo da fila e apagava junto a marca de até onde a transcrição já tinha sido lida. A mesma sessão retomada (`claude --resume`, `-c`, ou cada `claude -p`) nasce num arquivo de fila novo, sem marca, e a transcrição era relida do começo.

**Conserto:** a marca da transcrição passa a ser guardada também por fábrica, e sobrevive ao arquivamento (até 500 fábricas lembradas).

**Prova:** três prompts, com duas retomadas. Com o conserto, 110.249 na base e 110.249 na transcrição. Sem o conserto, nas mesmas condições, 220.433 contra 110.258.

**O que fica:** as externas que já estão na base com consumo inflado continuam assim, porque a trilha não se apaga. Inclui a externa de teste `mao-df5b6d70...`, renomeada "TESTE externa renomeada". O conserto só vale para a sua ponte depois que ela reiniciar.

### A ponte de teste não conseguia publicar ganchos com a ponte de verdade no ar (consertado)
A trava de dono da fila morava sempre na pasta local de produção, mesmo com a fila desviada para a rodada. Agora a trava mora junto da fila que ela protege. Em produção nada muda, porque é a mesma pasta. Duas pontes na mesma fila continuam disputando a mesma trava.

### Painel sem configuração neste PC
Faltava `painel/.env.local`. Foi gerado a partir de `~/.a-fabrica-ponte/config.json`, que a instalação leu do próprio Firebase, com o projeto conferido como `a-fabrica-soulan`. O arquivo é ignorado pelo Git. Os tipos estão limpos. O painel subiu uma vez em `localhost:3000`, respondeu 200 e foi desligado.

## Decisões tomadas
- A decisão do diretor sobre a transcrição foi registrada no §A.23 do `CLAUDE.md` e no cabeçalho de `ponte/src/transcricao.ts`.
- O Git deste PC não tem identidade configurada. O commit foi feito com a mesma autoria dos commits anteriores, só naquele comando, sem mexer na configuração global (§A.9).
- O `package-lock.json` da ponte não entrou no commit: a diferença dele era só de fim de linha. Os três arquivos gerados do painel ficaram de fora pelo mesmo motivo.

## Próximo passo
1. Reiniciar a ponte, para o conserto do consumo valer: `Stop-ScheduledTask -TaskName 'A Fabrica Ponte'; Start-ScheduledTask -TaskName 'A Fabrica Ponte'`. Faça isso sem fábrica rodando.
2. Validação visual, §A.13: `cd C:\Users\Henrique\a-fabrica\painel` e depois `npm run dev -- -H localhost`.
