# Parecer de segurança da retomada da OST 7

Agente: **seguranca**, com poder de veto, §A.0 e §A.15. Ela auditou e vetou. Não
implementou, não corrigiu e não comitou nada. Os consertos que saíram deste parecer
foram executados pelo **coordenador** e estão no commit `a3f4b8b`.

Data: 2026-10-14. Base auditada: branch `feature/ost5-madrugada`, commit `234e50b`,
mais a máquina e a nuvem ao vivo.

## Veredito geral

| Pergunta | Resposta |
| --- | --- |
| As mudanças desta sessão abriram porta nova na máquina? | Não. Escuta só em 127.0.0.1, porta sorteada, segredo de uso único, fecha sempre |
| Alguma mudança desta sessão deve ser revertida? | Nenhuma. Todas são conserto de defeito real |
| Risco executa sem resposta do diretor? | Não. Portão inteiro, falha fechada, provado na base real |
| Segredo no código ou no repositório? | Nenhum, varrido pela segurança |
| §A.9, plano B | Respeitado, com evidência de data de modificação |
| A Onda 2 podia ser LIGADA? | **Não. VETADO**, condições 1 e 12 abertas, 8 pela metade |
| Bloqueia a main | Condição 1, achado 3 e achado 1 |

## Item por item

| Item | Veredito |
| --- | --- |
| T5 aceita as duas grafias do laço de retorno | APROVADO COM RESSALVA. A escuta segue presa em 127.0.0.1 e domínio de fora continua barrado. Perdeu-se uma camada, não a porta: antes T5 barrava, agora barra o segredo de 64 caracteres e o tipo de conteúdo |
| Canal novo de falha da página | APROVADO COM RESSALVA. Exige segredo e JSON, não grava na base, teto de 8 KB. Sem a trava de uso único, processo local que saiba o segredo polui o relato; e o motivo vai cru para a tela |
| Relato com página servida e três desfechos | APROVADO |
| Gate cobrindo Bash e PowerShell | APROVADO COM RESSALVA. O furo era real e grave, o fechamento está provado ao vivo. O que sobrou está nos achados 1, 2 e 7 |
| Tradução do firebase.json para a API | APROVADO COM RESSALVA. Hoje não publica nada mais permissivo, e há evidência. Descarta em silêncio chave de hospedagem que não conheça |
| Fila de ganchos por ambiente | APROVADO. Não é caminho de ataque. A causa raiz é identidade de máquina poder ser inventada contra a base real |
| Fábrica fantasma completada por merge | APROVADO COM RESSALVA. Não cura fantasma antigo, e tem um vivo na base |
| Os dois arquivos novos de prova e leitura | APROVADO COM RESSALVA. Só leem, não vazam credencial. Um comentário afirma o contrário do argumento que usa |
| Sessão da ponte trancada em disco | APROVADO. Tranca conferida, não afirmada, e a ponte recusa subir desprotegida |
| Onda 2 ligada e publicada | **VETADO.** Veto de processo e de risco, não de código: o caminho de escrita do painel está bem feito |
| Segundo fator | **VETADO como está.** Honesto no código e na regra, e honestidade não é proteção |
| Lixo de teste na base de produção | APROVADO COM RESSALVA, com proposta de rótulo, sem apagar |
| Regra do Firestore | APROVADO COM RESSALVA. Conferida em si, e provado ao vivo que nega quem não entrou |

## Achados novos da auditoria

1. **A flag do gate é autoassinada.** Qualquer `READY_*` libera, criar arquivo é
   escrita comum, e `Write` está na lista de permitidos sem hook em cima. O agente
   que quer publicar cria a própria autorização, e não fica rastro de quem autorizou.
   **Em aberto, decisão do diretor.**
2. **O gancho captura o prompt de todos os projetos, e a lista de ignorados está
   vazia.** Prompt sobre sistema de cliente iria para a base da Fábrica em texto,
   contra o §A.4. **Em aberto, decisão do diretor.**
3. **O pacote de aprovação publicava texto livre sem máscara.** FECHADO no commit
   `a3f4b8b`: máscara no comando e no texto do agente, teto de 4000 caracteres, e o
   pacote diz que mascarou e que cortou.
4. **Recuperação a ponto no tempo desligada.** Tentada nesta sessão e recusada pela
   API: exige faturamento ativo no projeto. **Em aberto, decisão de dinheiro do
   diretor.** Sem ela, a trilha é imutável para o painel e para a ponte, e não para
   quem tem a conta do projeto.
5. **Existe uma fábrica fantasma viva na base**, `mao-38c600ab`, em execução para
   sempre, sem máquina e sem projeto. O conserto vale para frente e não a alcança.
   **Em aberto, proposta no relatório.**
6. **O gate liberava conferir e publicar na mesma linha.** FECHADO no commit
   `a3f4b8b`, com dois casos novos na prova do §A.7. Efeito colateral registrado: o
   gate lê o comando inteiro, então mensagem de commit que cite comando vigiado
   também é bloqueada, e isso aconteceu de fato.
7. **Fábrica aberta pelo painel roda sem o gate do §A.7 dentro dela**, porque a
   sessão filha não carrega o `settings.json` do projeto. Quem segura lá dentro é o
   portão de aprovação, que é mais forte. A segurança não pede mudança, pede que
   esteja dito.
8. **Nenhuma outra porta de execução sobrou** nesta sessão fora de Bash e PowerShell.

## Condições 11 a 15 do parecer da OST 6 parte 2

| Condição | Estado hoje |
| --- | --- |
| 11, sete testes e tempo esgotado contra a base real | FECHADA no essencial. Três rodadas de 7 de 7 e a prova do tempo, com trilha e resposta tardia negada pela regra. Aberto: processo órfão do Claude Code não conferido, e rede caída no instante da gravação da trilha não foi feita |
| 12, o que protege a sessão quando ela vira chave de aprovação | METADE FECHADA. A parte de disco está fechada e conferida. Falta prova de que leitura desse caminho por uma fábrica é negada pelo portão, ou decisão escrita do diretor aceitando o risco. É esta metade que sustenta o veto |
| 13, nenhum arquivo versionado afirma o segundo fator | FECHADA, conferida |
| 14, toda publicação deixa evidência | PARCIAL. Regra fechada, com comparação byte a byte. Painel aberto: a rodada grava a configuração e a versão, e não compara o que está no ar com o pacote local |
| 15, decisão do diretor sobre revogação do acesso da ponte | ABERTA. E mudou de peso: com a sessão em disco, o token vive na máquina e não morre quando o navegador fecha, então revogar deixou de ser teoria |

## O que a segurança não aceita como conserto

Proteção artificial. Filtro de comando não resolve, nem lista de pasta proibida,
nem expressão regular em prompt. A proteção desta fábrica são quatro coisas: a conta
única com segundo fator de verdade na conta Google, a regra que nega todo o resto, o
portão que segura toda chamada de risco até o diretor responder, e a trilha que não
se apaga, que para valer precisa da recuperação a ponto no tempo ligada.
