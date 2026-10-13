# Teste das regras do Firestore (emulador, sem login)

Prova, pelo emulador do Firebase, que: so o diretor (e-mail verificado) le e escreve;
outra conta e anonimo sao negados; a trilha de comando e aprovacao e imutavel (nao
altera criadoEm, nao apaga). Rodar:

  npm i firebase @firebase/rules-unit-testing --legacy-peer-deps
  firebase emulators:exec --only firestore --project demo-afabrica "node regras.test.mjs"

Resultado em 2026-10-13: PASSOU 12, FALHOU 0.
