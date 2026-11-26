# OST 16, crachá por máquina

Ramo `feature/ost5-madrugada`. Nada publicado, a main não foi tocada. O contrato e todas as condições da segurança estão em `docs/ost16-contrato.md`; a proposta de instalação na nuvem, em `docs/ost16-instalacao-nuvem.md`.

## O que foi solicitado
Cada ponte passa a ter um crachá próprio, por máquina, que só informa e nunca aprova, garantido pela regra da base, sem nada que pule a regra. A ponte do notebook também troca a conta do diretor pelo crachá. Emitir pede o diretor uma vez, sem a conta dele na máquina; revogar uma máquina não afeta as outras. Depois: proposta de instalação na nuvem (R4), troca do papel de administrador na VM, exceção no §A.25, VM do escritório para depois, publicação única do painel e frase de autorização.

## O que foi feito
- **O crachá:**
  - é uma conta anônima do Firebase Authentication, uma por máquina, mais o documento `crachas/{uid}`, que só o diretor escreve;
  - não usa conta de serviço, kit de administrador nem Cloud Function.
- **Na máquina:**
  - `npm run cracha` cria a conta e guarda em `cracha.json`, com a mesma tranca da sessão;
  - pede o crachá e mostra um código de 6 dígitos e o começo do uid.
- **No painel**, em Configurações:
  - o diretor confere os dois sinais e aperta "Emitir crachá";
  - "Revogar" corta aquela máquina na hora e não mexe nas outras.
- **A regra nova da base.** O crachá:
  - grava sinal de vida, fábricas, passos, consumo, pedidos de aprovação e relatórios só da própria máquina;
  - lê só as ordens da própria máquina;
  - marca comando como entregue;
  - recusa pedido por segurança (tempo esgotado, reinício, encerramento), em formato exato.
- **O que o crachá não faz:** aprovar, criar comando, trocar a máquina de uma fábrica ou tocar outra máquina. Uma consulta sem filtro de máquina é negada. Isso fecha o "não há isolamento entre pontes" da OST 15.
- **A ponte:**
  - com `cracha.json` presente, entra só com o crachá e nunca abre `sessao.json`;
  - crachá revogado, ilegível ou de outra máquina: não sobe;
  - revogar com a ponte no ar derruba a ponte.
- **A publicação:** `scripts/publicar.mjs` ganhou dois modos:
  - `--cracha` liga só o provedor anônimo e prova que nada mais mudou; o segredo da configuração nunca é gravado nem impresso;
  - `--encerrar-sessoes-do-diretor` invalida as sessões antigas da conta do diretor, depois da troca do notebook.
- **§A.25:** exceção registrada no CLAUDE.md. A ponte da nuvem fala com o `a-fabrica-soulan` só com o crachá, depois da publicação.
- **Instalação na nuvem:** proposta escrita, com a R4 respeitada. O instalador sai de uma pasta do root em `/opt`, conferido pelo hash que o diretor vê no chat. A condição A1 da segurança foi acrescentada.

## Quem trabalhou
- **Coordenador:**
  - leu a configuração do Authentication, só leitura;
  - escreveu o contrato, a exceção do §A.25 e a proposta da nuvem;
  - baixou o Java portátil com a licença do diretor;
  - fez o relatório e o commit.
- **Segurança:**
  - revisão do desenho: APROVADO COM CONDIÇÕES, com 37 condições;
  - revisão do código: LIBERADO COM RESSALVA, com todas as condições atendidas e nenhum veto.
- **Devops:**
  - a regra;
  - `firebase/testes/cracha.test.mjs`;
  - os dois modos do `publicar.mjs`;
  - quatro mutantes de regra com furo plantado, todos pegos pela prova.
- **Ponte:** `cracha.ts`, `pedirCracha.ts`, `identidade.ts`, `base.ts`, `relatoriosBase.ts`, `acoes.ts`, `ponte.ts` e a prova do crachá.
- **Frontend:** `dados/crachas.ts`, `escritas.ts`, `ouvintes.ts` e a tela `Configuracoes.tsx`, no computador e no celular.
- **Tester:** rodou tudo de novo contra a regra final e fez o caso de ponta a ponta.

## Provas (tester, regra final, sha256 `3b73a416...`)
| Prova | Resultado |
|---|---|
| regra do crachá no emulador | 236 de 236, 3 vezes |
| regra antiga no emulador | 76 de 76, 3 vezes |
| ponte, crachá sem base e com emuladores | 102 de 102 |
| ponte, nome (OST 15) | 46 de 46 |
| ponte, ganchos | 65 de 65 |
| ponte, relatórios | 99 de 99 |
| painel, prova da OST 16 | 87 de 87 |
| tipos da ponte e do painel | limpos |
| `prova-gate.sh` | 50 de 50 |
| ponta a ponta: pedido, emissão, escritas, aprovação negada ao crachá, revogação | 39 de 39, 3 vezes |

A evidência está em `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-11-25-220020-ost16-tester\`.

## O que ficou faltando
- **Publicar** a regra, o provedor anônimo e o painel (OSTs 11, 13, 15 e 16 juntas). Depende da frase do diretor.
- **Troca do notebook (item 5), depois da publicação:**
  1. `npm run cracha` no notebook;
  2. o diretor emite no painel;
  3. a ponte reinicia com o crachá;
  4. `sessao.json` é apagado por nome;
  5. `--encerrar-sessoes-do-diretor`, que desloga o navegador dele uma vez.
- **Nuvem (itens 8 e 9):** levar o crachá para o Linux é da fábrica da nuvem. Instalar e trocar o papel do OS Login vêm depois, pela proposta.
- **VM do escritório (item 11):** fica para depois.
- **Validação visual do diretor (§A.13):** a tela de crachás em Configurações.

## Decisões tomadas
- **Conta anônima mais crachá na base**, e não token personalizado nem e-mail e senha por máquina: é o único caminho que passa pela regra sem kit de administrador e sem a conta do diretor na máquina.
- **"Nunca grava aprovação"** foi lido como "nunca grava aprovado". A ponte continua recusando sozinha, porque é o lado seguro. O diretor confirma.
- **O diretor continua podendo tudo o que pode hoje.** Por isso a ponte antiga do notebook segue funcionando no dia da publicação, e a troca acontece depois, sem parar nada.
- **`respondidoPor` da ponte** passa a ser `ponte, <motivo>, <maquinaId>`, sem o e-mail do diretor.
- **A ponte compilada para prova** ficou em pasta própria, `dist-ost16*`, ignorada pelo git, para a tarefa agendada não pegar código ainda não validado.

## Problemas encontrados e ressalvas
1. **Java** não existia nesta máquina. Foi baixado com a licença do diretor: Temurin 21, hash conferido, portátil em `a-fabrica-lab\ferramentas`, sem instalar nada.
2. **Segredo na tela do coordenador.** Na leitura da configuração do Authentication, a saída mostrou a chave de assinatura dos hashes de senha (`hashConfig.signerKey`). Ela ficou só no registro local desta sessão, e o projeto não usa senha. O script novo retira esse campo.
3. **A primeira versão da regra deixou instável o teste antigo** de hora forjada. Corrigido pondo o diretor na frente; depois disso, foram 13 rodadas seguidas verdes.
4. **Ressalvas baixas da segurança (A2 a A8):**
   - máquina revogada fica "online" até a hora envelhecer;
   - leitura de passo inexistente dentro da própria fábrica;
   - campo livre no documento da máquina;
   - pedido falso de aprovação na própria máquina com crachá roubado;
   - nome antigo de pasta no script.
5. **A prova de relatórios abriu uma sessão real do Claude Code** (haiku, portão negando tudo), sem a configuração do diretor.

## Próximo passo
O diretor lê os avisos do relatório, valida a tela e diz a frase de produção.
