# OST 9, noite de retomada: relatório de fechamento

Agentes, §A.15:
- **coordenador:** Ondas 0, 1, 2 e 4, provas, ensaios e este relatório.
- **ponte:** Onda 3 inteira, `docs/ponte-na-vm.md`, só leitura.

Rodada: `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-11-22T2330-ost9-noite`. Lá estão as cópias de antes, as evidências e os ensaios. Nada sobrescrito, nada apagado, §A.17.

---

## 1. O que foi pedido

1. Onda 0: aplicar o conserto das travas no `settings.json`, com cópia antes, e provar que as negações pegam com a sessão em outra pasta.
2. Onda 1: aplicar o conserto pendente do gate e fechar `prova-gate.sh` inteira.
3. Onda 2:
   - `npm install` na ponte e no painel.
   - Consertar o consumo, que não media a fábrica em execução.
   - Nome de fábrica dado pelo diretor; "Fábrica externa" para a aberta na mão.
   - Caminho fora das telas.
   - Tempo da tarefa no lugar do tempo somado.
   - Cartões compactos.
   - Menu recolhido.
   - Provar o que der sem credencial.
4. Onda 3: investigar a ponte na VM Ubuntu e escrever `docs/ponte-na-vm.md`.
5. Onda 4: commit, push no ramo de feature, diário e a lista da manhã.

## 2. O que foi feito

### Onda 0, as travas: APLICADO, e com uma correção ao meu diagnóstico de ontem
- O bloco de negação do `settings.json` virou cinco regras `Edit(/...)`, com barra. A cópia de antes está na rodada.
- A escrita saiu por script, porque a ferramenta de arquivo está negada para esse caminho de propósito. É o caminho indireto do §A.7, usado por ordem expressa e registrado.
- As três conferências do documento passaram:
  1. o aviso de abertura sumiu, de 5 linhas para 0;
  2. a edição do gate, do `settings.json` e a escrita em `.claude/state` foram recusadas;
  3. as mesmas recusas se repetiram com a sessão dentro de `ponte/`.
- O laboratório usou sessões do Claude Code sem interação, num projeto falso, com um controle sem negação. Ele mostrou duas coisas:
  - **A correção:** a "pasta atual" das regras é a pasta onde a sessão foi **aberta**. A regra antiga, sem barra, já pegava a sessão que só entrou em `ponte/` pelo terminal. O que eu afirmei ontem estava errado nesse caso.
  - **O furo real:** uma sessão **aberta** dentro de uma subpasta não carrega o `settings.json` da raiz. Nenhuma regra de projeto alcança essa sessão, com barra, sem barra ou absoluta. O gancho do gate também não. Está escrito em `docs/conserto-das-travas.md`, com a proposta.

### Onda 1, o portão: NÃO APLICADO no gate real, pronto em um comando
- O classificador do modo automático do Claude Code **recusou** a escrita da fábrica no gate, por ser mexer na supervisão. Não contornei: o gate real está intacto, byte a byte.
- Lendo o conserto contra a prova, achei dois pontos em que o texto do documento não fechava o que prometia:
  - na main sem commit da prova, `rev-parse` não devolve `main`;
  - `git push origin`, parado na main, empurra a main e contaria como "nomeou destino".
- Os dois foram corrigidos em `scripts/aplicar-conserto-do-portao.mjs`.
- Entraram cinco casos novos na prova.
- Ensaiei duas vezes numa cópia do gate, inclusive com o arquivo exato do repositório: **50 de 50**.
- No gate real, hoje: **46 de 50**. Os 4 casos vermelhos são os do push que não nomeia ramo.
- O "24 de 24" da OST é um número antigo: a prova tinha 45 casos antes desta noite e tem 50 agora.

### Onda 2, a OST 8

**Dependências.** `npm install` rodou limpo na ponte e no painel. O `package-lock.json` do painel mudou uma linha, só para alinhar com o `package.json`, que já fixava o Next.

**Consumo, a causa de verdade, do Claude Code até a tela:**
1. **Fábrica aberta pelo painel:**
   - A ponte só gravava `consumo` quando chegava a mensagem de resultado, que é o **fim** do comando. Durante a execução o campo não existia, e a tela dizia "consumo não medido" justamente para quem estava gastando. O indicador do dia somava só quem já tinha terminado.
   - Pior: no fim de cada comando o valor era **substituído**, então fábrica com três comandos mostrava só o último.
   - Agora a ponte soma o `usage` de cada mensagem enquanto a fábrica roda, sem contar duas vezes a mesma mensagem, e grava na base com incremento a cada 5 segundos. No fim, o total oficial do kit fecha a diferença.
2. **Fábrica aberta na mão:**
   - O gancho do Claude Code não recebe token nem modelo. Mas recebe o caminho da transcrição que o próprio Claude Code grava, e ali cada mensagem traz o `usage` medido e o modelo.
   - O gancho passa a anotar só o caminho, na fila local. A ponte lê da transcrição **apenas** números de token e nome do modelo.
   - Nenhum texto sai, de projeto liberado ou não. Projeto ignorado nem entra.
   - Bônus: "modelo não reportado pelo Claude Code" deixa de aparecer para a externa, porque o modelo vem da transcrição.

**Nome e identidade:**
- O nome é o passo 1 da tela de nova fábrica e é obrigatório.
- Viaja na ordem de abrir. A ponte grava o nome **uma vez**, no nascimento, e nunca mais escreve esse campo.
- Renomear é escrita direta do painel no campo `nome`, em qualquer estado, até com a ponte offline. A regra do Firestore já permitia, então **nenhuma regra muda e nada precisa ser publicado na regra**.
- A externa nasce "Fábrica externa". Duas ao mesmo tempo ganham a hora de abertura, e se até a hora bater, o número.

**Telas:**
- O caminho saiu de todas as telas: cartões, cabeçalho da fábrica, celular, tela de nova fábrica e lista de projetos do menu, que agora mostra um projeto por linha, pelo nome da pasta, com a contagem.
- "Tempo somado" saiu. Entrou "Tarefa em execução": a mais longa andando agora, e quantas estão andando.
- Os cartões e o quadro da tela da fábrica mostram o tempo da tarefa. Andando, conta até agora; parada, do começo ao fim. Sem relógio gravado, diz "tarefa não medida", sem estimar.
- **Cartões compactos:** quatro por linha no computador largo, doze por página no lugar de seis. Guardam estado, nome, projeto e modelo, tempo da tarefa, consumo e pedido parado. Saiu a frase do estado, que repetia o selo.
- **Menu lateral:** recolhido sempre, abre ao passar o mouse, por cima da tela, sem empurrar nada. Abre também pelo teclado.
- **Celular:** já tinha navegação na base, própria para toque, e ficou como estava. Os cartões do celular ficaram compactos também.

### Onda 3, a ponte na VM: documento entregue
Feito pelo agente ponte, em `docs/ponte-na-vm.md`:
- A ponte não roda em Linux hoje: instalador, tranca da sessão por `icacls`, login que chama `cmd`, gancho com caminho de Windows. Em todos os casos ela falha fechada.
- **A base e as regras aceitam duas pontes sem mudar nada. O painel não:** ele enxerga uma ponte só e faria a tela mentir quando uma das duas cair.
- Login na VM: encaminhamento local do SSH, condicionado à sua leitura do §A.6, ou fluxo de dispositivo, que depende de você no console.
- Quatro ondas, sem prazo.

## 3. O que foi provado, e como

| Prova | Resultado | Onde está a evidência |
|---|---|---|
| Laboratório das travas, 4 configurações por 3 casos | descrito acima | `evidencia/lab-travas-*.txt` |
| Conferências na sessão viva | 3 recusas, aviso sumiu | `evidencia/conferencias-sessao-viva.txt`, `aviso-*.err` |
| `prova-gate.sh` no gate real | 46 de 50, os 4 vermelhos com causa | `evidencia/prova-gate-gate-intocado-casos-novos.txt` |
| `prova-gate.sh` com o conserto, numa cópia | 50 de 50, duas vezes | `evidencia/prova-gate-ensaio-na-copia.txt`, `ensaio-script-do-repositorio.txt` |
| `npm run prova:consumo`, nova | tudo passou; na fábrica de verdade, a soma ao vivo bateu **campo por campo** com o total oficial do kit (99.768 tokens), chegou na base antes do estado final, e o segundo comando somou (100.138 para 126.935) | `rodadas\2026-11-22T235151-ost9-prova-consumo\saida.txt` |
| `npm run prova:acoes:sem-claude`, com 3 casos novos de nome | tudo passou | pasta `rodadas\2026-11-23T0004*-ost7-prova-acoes` |
| Gancho de verdade, projeto liberado e não liberado | caminho da transcrição nos dois, nenhum conteúdo no não liberado | `evidencia/gancho-linha-transcricao.txt` |
| Ensaio de lógica do painel, componentes reais com dados montados | 28 de 28 | `evidencia/ensaio-painel-logica.txt` |
| Fotos das telas, componentes reais no Chrome sem janela | visão geral, menu aberto pelo mouse, fábrica, renomear, nova fábrica, celular | `evidencia/fotos-painel-2/` |
| Tipos estritos da ponte e do painel, construção do painel | limpos | |

**O que NÃO foi provado, porque depende do seu login:** nada desta noite rodou contra a base real. Os testes a rodar amanhã estão na seção 7.

## 4. O que ficou faltando
- O conserto do portão no gate real: é a sua mão, um comando.
- Tudo contra a base real: instalar a ponte, os ganchos e os testes de ponta a ponta.
- A validação visual, §A.13. As fotos são de dados montados, não da sua base.
- O consumo do **subagente** em sessão aberta na mão fica de fora, se esta versão do Claude Code gravar o subagente em arquivo separado. A tela mostra só o medido, sem estimativa.

## 5. Decisões tomadas durante a execução
- **Tempo da tarefa:**
  - Começa quando a ponte entrega o comando, ou quando você manda o prompt na sessão aberta na mão, e para no fim da rodada.
  - O quadro mostra a tarefa mais longa andando agora, e diz quantas são.
  - Fábrica antiga, sem relógio gravado, diz "tarefa não medida".
  - O cabeçalho da tela da fábrica também passou a mostrar o tempo da tarefa, para não contradizer o cartão.
- **Nome obrigatório na abertura.** A ordem diz "toda fábrica passa a ter nome dado pelo diretor".
- **Renomear não passa pela ponte.** É campo de exibição, então funciona com a ponte offline e com a fábrica concluída.
- **Ler a transcrição para o consumo da externa.** O §A.23 manda publicar metadado de todo projeto, e token e modelo são metadado. O texto da transcrição nunca sai da leitura, e a prova confere isso. **Fica registrado para a sua ciência:** a ponte abre a transcrição de projeto não liberado para tirar só os números. Se preferir que nem abra, o custo é a externa de projeto não liberado voltar a "consumo não medido".
- **Cartão compacto sem a frase do estado.** Ela era escrita a partir do próprio estado e repetia o selo.
- O cálculo do estado do painel foi separado numa função pura, `montarEstadoDoPainel`, só para poder ser provado sem base. O comportamento não mudou.

## 6. Arquivos e áreas alteradas
- **Travas e gate:**
  - `.claude/settings.json`
  - `scripts/prova-gate.sh`, com os 5 casos novos
  - `scripts/aplicar-conserto-do-portao.mjs`, novo
  - `scripts/CONSERTO-PENDENTE-DO-GATE.md`
  - `docs/conserto-das-travas.md`
- **Ponte:**
  - `src/claudeCode.ts`, o medidor de consumo
  - `src/sessao.ts`, o lote de consumo e o relógio da tarefa
  - `src/base.ts`, a soma com incremento
  - `src/acoes.ts`, o nome no nascimento
  - `src/ganchos.ts`, a transcrição e o relógio da tarefa da externa
  - `src/transcricao.ts`, novo
  - `src/tipos.ts`, `src/ponte.ts`
  - `ganchos/gancho.cjs`, que agora anota o caminho da transcrição
  - `src/testes/prova-consumo.ts`, novo
  - `src/testes/prova-acoes.ts`
  - `package.json`
- **Painel:**
  - `src/dados/`: `tipos.ts`, `tradutor.ts`, `painel.ts`, `escritas.ts`
  - `src/telas/`: `VisaoGeral.tsx`, `Computador.tsx`, `FabricaTela.tsx`, `NovaFabrica.tsx`, `Celular.tsx` e `renomear.tsx`, novo
  - `src/componentes/ds/`: `FactoryCard.tsx`, `FactoryHeader.tsx`, `Sidebar.tsx`
  - `app/globals.css`
  - `package-lock.json`
- **Documentos:** `docs/ponte-na-vm.md`, `docs/ost9-noite.md`, `DIARIO.md`.
- **Não tocados:** `scripts/gate-deploy.sh`, `scripts/autorizar-producao.sh`, `firebase/firestore.rules`, a main e a produção.

## 7. Amanhã de manhã, em ordem

Tudo com o prefixo `!` é você quem roda, na sessão do Claude Code aberta na **raiz** do projeto, `C:\Users\Henrique\a-fabrica`. Comando sem `!` é no PowerShell.

### Passo 1, remover o acesso antigo, ANTES de instalar a ponte nova
1. **Credenciais de ferramenta do PC antigo**, as de escopo de nuvem inteira, inclusive o dash-iff. Em https://myaccount.google.com/connections, remova o acesso de **Google Cloud SDK** e de **Firebase CLI**. Neste PC novo eles nem estão instalados, então nada aqui quebra.
2. **A sessão da ponte do PC antigo** é um token do Firebase deste projeto e **não morre** com o passo anterior.
   - **Se o PC antigo ainda liga:** lá, desligue a tarefa "A Fabrica Ponte" e apague `C:\Users\Henrique\.a-fabrica-ponte\sessao.json`. É o caminho mais limpo.
   - **Se não liga mais:** no console do Firebase, projeto a-fabrica-soulan, entre em Authentication, depois Users. Na sua conta, use **Desativar conta** e, em seguida, **Ativar conta**. Pela documentação do Firebase, desativar o usuário invalida os tokens de atualização que existiam.
   - O preço, já registrado na OST 6: isso derruba também o painel aberto no celular. Depois é só entrar de novo.

### Passo 2, aplicar o conserto do portão
```
! node scripts/aplicar-conserto-do-portao.mjs
! bash scripts/prova-gate.sh
```
Tem de fechar em **50 de 50**.

### Passo 3, a ponte nova neste PC
```
powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1
powershell -ExecutionPolicy Bypass -File ponte\ganchos\ligar.ps1 -Liberar "C:\Users\Henrique\a-fabrica"
```
O primeiro abre o login no navegador. Entre com a sua conta Google. O segundo só acrescenta os ganchos na sua configuração geral do Claude Code e faz cópia antes. A ponte entra como máquina nova, e a antiga fica na base como offline.

### Passo 4, as provas, na pasta `ponte`
```
cd ponte
npm run prova:ressalvas
npm run base-real
npm run prova:tempo
npm run prova:consumo
```

### Passo 5, os testes de amanhã, que dependem do seu login
1. **Consumo ao vivo, fábrica do painel.** Abra uma fábrica pelo painel com uma tarefa de alguns minutos. Enquanto ela roda, o consumo do cartão e do quadro "Consumo somado" têm de **subir**, sem esperar o fim.
2. **Dois comandos somam.** Mande um segundo comando para a mesma fábrica. O consumo tem de crescer a partir do valor anterior, não voltar a um número menor.
3. **Fábrica externa.** Abra o Claude Code na mão, em qualquer projeto, e mande um prompt. No painel tem de aparecer "Fábrica externa", com o modelo e o consumo, e sem nenhum caminho.
4. **Duas externas.** Abra uma segunda sessão na mão. As duas têm de se distinguir pela hora.
5. **Renomear.** Renomeie uma externa e uma concluída. Mande um comando para a renomeada: o nome não pode voltar.
6. **Tarefa.** O cartão mostra "tarefa 3min" enquanto anda e "última tarefa 3min" depois que para. O quadro "Tarefa em execução" acompanha.

### Passo 6, validação visual sem publicar, §A.13
```
cd painel
npm run dev -- -H localhost
```
Abra http://localhost:3000 e entre com a sua conta. É o painel novo lendo a sua base de verdade, só nesta máquina. O `-H localhost` deixa o servidor preso ao laço de retorno. Feche com Ctrl+C quando terminar.

### Passo 7, publicar o painel em produção, só depois de validar
Você cria a autorização. As palavras abaixo são sugestão: troque pelo que você realmente validou.
```
! bash scripts/autorizar-producao.sh publicar-painel-ost9 "Publica o painel da OST 9: validei na tela o nome, o tempo da tarefa, o consumo ao vivo e os cartões."
```
Depois diga à fábrica: **"publique o painel"**. Ela roda, nesta ordem:
```
npm --prefix painel run construir-para-hospedagem
node scripts/publicar.mjs --painel
node scripts/publicar.mjs --conferir
```
Os três rodam a partir da raiz do projeto.
O publicador precisa do gcloud logado. Neste PC ele não está instalado: `winget install --id Google.CloudSDK -e` e depois `gcloud auth login`, sem nunca rodar `gcloud config set project`, §A.20. A regra do Firestore **não** muda nesta OST, então só o painel é publicado.

Remova a autorização usada:
```
! rm -f .claude/state/PROD_publicar-painel-ost9
```

### Passo 8, subir para a main, uma autorização nova, porque a de produção vale para um pedido
```
! bash scripts/autorizar-producao.sh subir-main-ost9 "Sobe a OST 9 para a main: validei na tela e as provas da manhã passaram."
```
Depois diga à fábrica: **"suba para a main"**. Ela faz o avanço da main até o ramo de feature e o envio. Depois:
```
! rm -f .claude/state/PROD_subir-main-ost9
```

### Decisões que ficam com você
1. **Configuração geral do Claude Code.** Proteger o gate também para sessão aberta em subpasta, com regra de caminho absoluto em `~/.claude/settings.json`. É só acrescentar, §A.9.
2. **Transcrição de projeto não liberado:** ler só os números, como está, ou não abrir.
3. **Ponte na VM:**
   - a sua leitura do §A.6 para o encaminhamento do SSH;
   - a ordem das ondas;
   - o resto da lista no fim de `docs/ponte-na-vm.md`.
4. **As pendentes de antes:** evidência do segundo fator, faturamento e publicação fora desta máquina.
