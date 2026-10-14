# TAREFAS, A FÁBRICA

Fila de trabalho da fábrica. Pendentes no topo, concluídas no rodapé. Cada tarefa indica onda (§A.8), agentes envolvidos e situação.

## Pendentes
<!-- Formato: - [ ] Título, onda, agentes, situação -->
<!-- OST 7 executada em 2026-10-13 e 14. O ponto de retomada, com a ordem exata dos
     passos, está na última entrada do DIARIO.md. Leia de lá. -->

### Um clique do diretor destrava quatro coisas
- [ ] OST 7, o login da ponte no navegador: `cd ponte && npm run entrar`, abre pagina em 127.0.0.1, escolher a conta. Caminho pronto e provado, duas tentativas fecharam por tempo esgotado esperando o clique
- [ ] OST 7, os sete testes contra a BASE REAL mais a prova do tempo esgotado, Onda 1, agente ponte, BLOQUEADO no login acima. No emulador passam 7 de 7
- [ ] OST 7, o Bloco 1 publicando na BASE REAL, Onda 2, BLOQUEADO no login acima. No emulador fecha de ponta a ponta
- [ ] OST 7, as cinco acoes e o painel contra a BASE REAL, Onda 2, BLOQUEADO no login acima. No emulador passam 20 de 20

### Do diretor, decisoes e validacao
- [ ] OST 7, validacao visual das telas da Onda 2, §A.13, diretor
- [ ] OST 7, decidir como subir para a main: validar a Onda 2 e subir tudo, ou subir so os commits da Onda 1 que ele ja validou. A fabrica nao escolhe, §A.12
- [ ] OST 6, prova do segundo fator da conta Google, §A.6, condicao 1 da seguranca, bloqueia a main E a Onda 2, aguarda o diretor
- [ ] OST 7, decidir se `pausada` vira estado de primeira classe no §A.4. Hoje a fabrica pausada fica em aguardando comando com o campo `pausada`, para nao inventar escopo

### Pendencias com motivo declarado, nao esquecimento
- [ ] OST 7, recuperacao a ponto no tempo do Firestore: RECUSADA pelo Google, exige plano pago. Mesma barreira do aviso no celular. Protecao contra exclusao ja esta ligada
- [ ] OST 2 em diante, aviso no celular, F8: exige plano pago no Google Cloud, fora da OST 7 por decisao do diretor
- [ ] OST 7, o caso de ponta a ponta da mascara de segredo: a prova passou por vacuo porque a sessao resolveu a tarefa de outro jeito e nao havia credencial para vazar. A mascara segue provada nas treze formas por conferencia de texto
- [ ] OST 7, custo do gancho acima do alvo: 220 a 280 ms por chamada, dos quais 2 a 7 ms sao trabalho e o resto e o processo do Node subindo. Dentro do piscar de olhos, no teto dele. Descer disso exige sair do Node, e o preco esta escrito em docs/ost7-ganchos.md

## Concluídas
<!-- Formato: - [x] Título, onda, agentes, data -->
- [x] OST Zero, nascimento da fábrica, agente coordenador e fábrica, 2026-10-11
- [x] OST 1 Parte 1, apontar remote e subir OST Zero, 2026-10-11
- [x] OST 1 Parte 2, prova de conceito da ponte, agente ponte, 2026-10-12
- [x] OST 1 Parte 2 tarefa 1, subir feature e main (validado), 2026-10-12
- [x] OST 1 Parte 2 tarefa 2, spike da aprovacao invertida, agente ponte e seguranca, 2026-10-12
- [x] OST 2, fechar o furo do portao, agente ponte e seguranca, 2026-10-12
- [x] OST 3 Parte 1, subir OST 2, 2026-10-12
- [x] OST 4 Parte 1, corrigir a constituicao para Claude Code, 2026-10-12
- [x] OST 4 Parte 2, provar no Claude Code, agente ponte e seguranca, 2026-10-12
- [x] OST 6 Bloco 1, entrada do cliente, porte para TypeScript, instalacao de um passo e base endurecida, Onda 1, agentes ponte e backend, 2026-10-13
- [x] OST 6 Bloco 2, o painel de verdade na stack do §A.2, Onda 1, agente frontend, 2026-10-13
- [x] OST 6 Bloco 3, canal preview-madrugada apagado e painel de verdade publicado com login, Onda 1, coordenador, 2026-10-13
- [x] OST 6, auditoria de seguranca, APROVADO COM RESSALVA, agente seguranca, 2026-10-13
- [x] OST 7 Bloco 0, entrada da ponte pelo navegador em 127.0.0.1, colagem morta, Onda 1, coordenador no papel de ponte, 2026-10-13
- [x] OST 7 Bloco 0, arquivo de sessao trancado e a ponte recusando subir sem a tranca, condicao 12 da seguranca, 2026-10-13
- [x] OST 7 Bloco 0, protecao contra exclusao do Firestore ligada, 2026-10-13
- [x] OST 7 Bloco 0, regra do Firestore republicada e conferida byte a byte, pendencia da OST 6 fechada, 2026-10-14
- [x] OST 7 Bloco 0, publicacao sem depender do Firebase CLI, scripts/publicar.mjs, 2026-10-14
- [x] OST 7, furo do gate de deploy fechado: publicacao por API nao passava pelo gate, §A.7, 2026-10-14
- [x] OST 7 Bloco 1, ganchos de ciclo de vida no Claude Code da maquina, com fila local, publicador, mascara, medida e botao de desligar, Onda 1, coordenador, 2026-10-13
- [x] OST 7 Bloco 1, prova de ponta a ponta contra o emulador, inclusive a ponte fora do ar com a sessao do diretor seguindo normal, 2026-10-14
- [x] OST 7 Bloco 2, metade da ponte: as cinco acoes do painel com o portao inteiro, Onda 2, agente ponte, 2026-10-14
