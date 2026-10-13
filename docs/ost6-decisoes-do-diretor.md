# Decisões do diretor na OST 6

Registro das decisões que o diretor tomou durante a OST 6, para não se perderem no histórico de conversa. Quem decide escopo, regra de negócio e validação é o diretor, §A.0. A fábrica executa e registra.

## Decisão 1, credencial da ponte: NÃO ao token do Firebase CLI

Está PROIBIDO usar o token do Firebase CLI como credencial da ponte.

Razão, nas palavras do diretor: aquele token carrega escopo de nuvem muito maior do que as regras do Firestore limitam, então um arquivo roubado daria acesso a bem mais do que o painel. A ponte entra como o diretor pelo login de cliente, que é o escopo exato que as regras controlam.

E a parte que vale como regra de conduta para a fábrica inteira: se o login de cliente não der conta de algum caminho, isso é um achado para RELATAR, não um motivo para subir de credencial.

O que isso implica, na prática:
- O degrau da escada de credencial que lia o depósito do firebase-tools foi removido do código da ponte, sem ficar comentado nem atrás de bandeira.
- A ponte não pede escopo de nuvem. O acesso dela é exatamente o acesso que a regra do Firestore concede ao diretor, e nada além.
- Conveniência de instalação não é justificativa para credencial mais poderosa. Quando o caminho fácil exige mais poder, o caminho fácil está vetado.

Proposta ao diretor, decorrente desta decisão: a ponte precisa receber uma credencial de sessão de escopo puro de Firebase uma vez, na instalação, sem nunca escutar porta, §A.6. As opções, com custo e risco de cada uma, estão em docs/ost6-ponte-credencial.md. Isso é proposta, não obra, §A.12.

## Decisão 2, Firestore: SIM para recuperação a ponto no tempo e proteção contra exclusão

As duas ficam ligadas. A proteção contra exclusão é de graça e impede alguém apagar a base por acidente.

Observação honesta da segurança que esta decisão endereça: a trilha de comando e aprovação é inapagável pelo caminho do cliente, porque a regra nega delete nas sete coleções, mas NÃO é inapagável pelo caminho administrativo, porque o diretor é dono do projeto. A recuperação a ponto no tempo e a proteção contra exclusão são justamente a rede que faltava nesse segundo caminho.

## Sugestão da fábrica, pendente de decisão

A Decisão 1 tem cara de regra permanente, não de decisão de uma OST: ela vale para qualquer credencial de qualquer peça, hoje e depois. Se o diretor concordar, ela merece virar parágrafo do CLAUDE.md, como aconteceu com o §A.20 e o §A.21. A fábrica não altera a constituição por conta própria, então fica como sugestão.
