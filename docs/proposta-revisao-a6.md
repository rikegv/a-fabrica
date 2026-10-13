# Proposta de revisao do CLAUDE.md, a partir da OST 2

Proposta apenas. NAO altera o CLAUDE.md. Entra no arquivo quando o diretor aprovar, no fechamento combinado. Baseada no que a OST 2 provou em sessao viva.

## Proposta para o §A.6, regra da falha fechada e do portao

Texto proposto para acrescentar ao §A.6 (Seguranca obrigatoria):

> Aprovacao pelo portao, regra dura. A execucao de uma fabrica passa por um portao que segura toda chamada de risco. Nada de risco executa sem resposta explicita do diretor. O portao falha fechado: qualquer erro, excecao, pedido ilegivel, resposta ausente, resposta malformada, decisao desconhecida, tempo esgotado ou portao que nao respondeu resulta em recusa, nunca em liberacao.
>
> Prova positiva do portao na abertura. Antes de abrir qualquer fabrica, a ponte dispara um comando isca inofensivo que o portao tem de bloquear, reconhecido por um sinal exato que so o portao vivo e correto produz. Se o sinal nao vier, por portao ausente, removido ou quebrado, a ponte recusa abrir a fabrica e registra o motivo. Nenhuma fabrica nasce sem essa prova passar.
>
> Pre-autorizacao minima. O que for pre-autorizado ao agente de execucao, para ele nao travar sozinho, e o minimo possivel, por recurso exato, nunca curinga nem expressao larga nem categoria inteira. Cada item pre-autorizado e documentado e justificado. Quanto menor a pre-autorizacao, menor o estrago se o portao cair.

## Proposta das tres regras operacionais da fabrica

Texto proposto para acrescentar como regras permanentes:

> Nao apagar para limpar. A fabrica nao apaga arquivo para preparar um teste ou uma rodada. Cada rodada cria a sua propria pasta nova, com data e hora no nome, e escreve la dentro. Nada e sobrescrito, nada e apagado. A evidencia de cada rodada fica preservada.
>
> Quando apagar for inevitavel. Escreva o caminho completo, por extenso, sem atalho de variavel, e apague arquivo por arquivo, nomeado. Nunca apague usando curinga sobre um caminho guardado em variavel.
>
> Onde mora a fila. A fila de pedidos e respostas da ponte vive dentro da pasta da rodada, nunca numa pasta fixa reaproveitada. Fila nova a cada rodada, sem heranca da anterior.

## Observacao de escopo
Estas propostas so descrevem o que a OST 2 provou. A revisao efetiva do §A.6 e a entrada das tres regras no CLAUDE.md dependem da validacao do diretor e do parecer de seguranca da OST 2.
