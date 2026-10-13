# Legado em .mjs, preservado, fora de uso

Estes três arquivos são a ponte como ela nasceu na OST 5, em JavaScript puro:
`base.mjs`, `claudeCode.mjs` e `ponte.mjs`.

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
