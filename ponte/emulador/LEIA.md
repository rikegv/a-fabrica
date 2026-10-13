# Emulador da base, só para prova local

Este `firebase.json` é da ponte, serve só para subir o emulador do Firestore e do
Auth na máquina, apontando para as MESMAS regras que estão implantadas na nuvem
(`../../firebase/firestore.rules`, lidas, nunca alteradas por aqui).

Subir o emulador, com o projeto sempre explícito, §A.20:

```
powershell -ExecutionPolicy Bypass -File ponte\emulador\subir.ps1
```

As portas são próprias da ponte, Firestore em 8099 e Auth em 9199, de propósito
diferentes das portas padrão: na máquina do diretor rodam emuladores de outros
projetos, e colidir de porta faria um teste ler a base do projeto errado.

O script copia `firebase/firestore.rules` e `firebase/firestore.indexes.json` para
esta pasta antes de subir, porque o firebase CLI recusa arquivo de regras fora da
pasta do projeto. A fonte da verdade continua sendo `firebase/firestore.rules`. Os
arquivos copiados aqui são cópia de trabalho do emulador, nunca o contrário.

O emulador substitui só a base. O Claude Code continua de verdade, sessão viva,
em qualquer rodada de teste. Rodar os sete testes contra o emulador:

```
cd ponte
$env:PONTE_EMULADOR = '1'
npm run testes
```

Contra a base real, a mesma coisa sem a variável:

```
cd ponte
npm run testes
```
