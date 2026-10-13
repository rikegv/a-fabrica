# Testes da peca 2, base na nuvem

Agente responsavel: backend. Tres verificadores, todos com saida real e em portugues.
Nenhuma credencial aqui: o token vem do gcloud da maquina e a chave do cliente web e
obtida em tempo de execucao, §A.6. Todo comando de gcloud e de firebase leva
`--project a-fabrica-soulan`, §A.20.

Instalar as dependencias uma vez:

    npm install

## 1. Prontidao do login, porta de entrada dos testes ao vivo

    npm run login
    # ou: node verificar-login.mjs

Diz se o Authentication do projeto esta ligado, se o provedor Google esta ativo e se os
dominios do login estao autorizados. Falha fechada: qualquer erro, resposta ausente,
resposta malformada, tempo esgotado ou verificacao que nao pode ser feita resulta em
NAO PRONTO, com codigo de saida 1, e imprime o passo exato do console para o diretor.
Enquanto este verificador nao disser PRONTO, nao existe teste ao vivo com login.

## 2. Regras do Firestore no emulador

    npm run regras
    # firebase emulators:exec --only firestore --project a-fabrica-soulan "node regras.test.mjs"

Matriz de identidade (conta unica), trilha imutavel com hora do servidor, cada transicao
de estado de comando e de aprovacao, colecoes fora do modelo negadas, e as consultas de
leitura que o painel usa.

## 3. Escrita real da ponte e do painel contra a regra

    npm run ponte
    # firebase emulators:exec --only firestore,auth --project a-fabrica-soulan \
    #   "node --experimental-transform-types --import ./registrar-resolucao.mjs ponte-real.test.mjs"

Importa `ponte/src/base.ts`, o arquivo de verdade da ponte, sem copiar e sem alterar, e
entra com login de verdade no emulador de Auth, com o e-mail do diretor e e-mail
verificado, como o provedor Google entrega na nuvem. Cobre heartbeat, fabrica, atividade,
pedido de aprovacao, entrega de comando em transacao, reconciliacao no reinicio, portao de
ponta a ponta com falha fechada, os ouvintes ao vivo do painel, e a conta que nao e do
diretor sendo barrada em tudo.

Os dois arquivos `ganchos-resolucao.mjs` e `registrar-resolucao.mjs` existem so para o
Node achar os modulos: trocam `.js` por `.ts` nos vizinhos da ponte e fazem o teste e a
ponte usarem a MESMA copia do SDK do Firebase. Nenhuma linha da ponte e alterada.

## Evidencia por rodada, §A.17

Cada rodada escreve numa pasta nova com data e hora no nome, `rodada-AAAA-MM-DD-HHMMSS`,
e nada e sobrescrito nem apagado. A pasta guarda a regra baixada da nuvem, a diferenca
contra o arquivo local, os indices que existem de fato, a prova de cobertura de indice
contra o banco de verdade e a saida dos tres verificadores.

Rodada da OST 6 Bloco 1: `rodada-2026-10-13-091905`.
Resultado: regras 76 de 76, escrita real da ponte 35 de 35, login NAO PRONTO porque
depende de um clique do diretor no console.

Resultado anterior, da OST 5, preservado em `resultado-regras.txt`: 12 de 12.
