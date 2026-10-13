# Legado em .mjs, preservado, fora de uso

Estes três arquivos são a ponte como ela nasceu na OST 5, em JavaScript puro:
`base.mjs.txt`, `claudeCode.mjs.txt` e `ponte.mjs.txt`.

## Por que terminam em .txt

A auditoria de segurança da OST 6 achou que mover não bastava. Com o nome
original, `node legado-mjs/ponte.mjs` ainda rodava: as dependências resolviam de
`ponte/node_modules` e a última linha do arquivo se auto executava. Pior, o
`initBase` do legado não faz login nenhum, então o que subia dali era uma ponte
com identidade mais fraca que a de hoje. Dano real era nulo, porque a regra do
Firestore nega quem não tem a identidade do diretor, mas código morto que roda
é porta aberta e a segurança pediu que deixasse de rodar.

A extensão final virou `.txt`, e com isso o Node recusa na partida, com
`ERR_UNKNOWN_FILE_EXTENSION`. Nenhum byte do conteúdo foi tocado, §A.17: a
evidência do que existia antes do porte continua inteira e legível. Para ler
como código, basta abrir o arquivo.

Na OST 6 a ponte voltou para TypeScript por decisão do diretor, §A.2: a ponte decide
aprovação, e erro ali tem consequência de segurança. O código vivo está em `../src`
em `.ts`, compilado para `../dist`.

Nada foi apagado, §A.17. Os arquivos foram movidos para cá, inteiros, como evidência
do que existia antes do porte. Ninguém executa daqui: o serviço roda por
`node dist/ponte.js`, e o `package.json` não tem mais nenhum caminho apontando para
estes arquivos.

Por que mover e não deixar em `src`: com os dois no mesmo lugar, um dia alguém sobe a
ponte pelo arquivo errado e perde as garantias que só o código novo tem (identidade do
diretor conferida, sessão persistida, trava de processo que não prende fábrica por
processo morto). Mover deixa uma única porta de entrada.
