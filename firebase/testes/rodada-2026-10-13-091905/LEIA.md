# Rodada de 2026-10-13, 09:19:05, OST 6 Bloco 1, base na nuvem

Agente: backend. Evidencia desta rodada, §A.17. Nada aqui foi sobrescrito e nada foi
apagado. Projeto sempre explicito, `--project a-fabrica-soulan`, §A.20.

| Arquivo | O que prova |
| --- | --- |
| `nuvem-releases.json` | qual conjunto de regras esta publicado no projeto, com data |
| `nuvem-ruleset.json` | o conjunto publicado, como a nuvem devolve |
| `nuvem-firestore.rules` | a regra publicada, extraida do conjunto |
| `diferenca-regras.txt` | comparacao linha a linha com `firebase/firestore.rules` antes desta OST. So o comentario de cabecalho divergia |
| `nuvem-indices.json` | os indices compostos que existem de fato no banco, dois, os dois READY |
| `nuvem-indices-erro.txt` | vazio, o comando de listar indices nao deu erro |
| `nuvem-indices-prova-completa.txt` | cobertura de indice provada por consulta de leitura no banco de verdade, nove consultas, tres sem indice |
| `nuvem-indices-prova.txt` | primeira passada da mesma prova, preservada |
| `nuvem-validacao-regras-novas.json` | a regra nova compila no servico de verdade, sem publicar. Resposta vazia significa nenhum problema |
| `nuvem-validacao-controle-negativo.json` | controle negativo: a mesma regra com erro de proposito volta com `issues`. Prova que a resposta vazia acima quer dizer algo |
| `saida-verificar-login.txt` | prontidao do login hoje: NAO PRONTO, Authentication nao inicializado |
| `saida-verificar-login-falha-fechada.txt` | o verificador com o gcloud fora do caminho, prova que falha fechada |
| `saida-regras.txt` | regras no emulador, 76 de 76 |
| `saida-ponte-real.txt` | escrita real da ponte e do painel contra a regra, 35 de 35 |

A regra e os indices desta rodada ainda NAO estao na nuvem. Quem publica e o coordenador,
com a flag do gate, §A.7.
