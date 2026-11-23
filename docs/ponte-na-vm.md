Agente: ponte, §A.15. OST 9, Onda 3, só leitura.

Nota do coordenador, mesma noite: as linhas do painel citadas aqui foram lidas antes das mudanças da Onda 2 da OST 9. O exemplo de caminho de Windows na tela de nova fábrica já saiu, e a lista de pastas agora sai do campo interno `caminho`. O diagnóstico de duas máquinas continua valendo igual.

# Ponte dentro da VM Ubuntu: o que trava, o que muda e como fazer o login

Este documento responde a uma pergunta só: o que é preciso para o painel enxergar e comandar as fábricas que o diretor abre dentro da VM Ubuntu, por SSH, neste mesmo PC. Nada foi construído, instalado ou executado para escrevê-lo. Tudo aqui foi lido no código, e cada afirmação traz o arquivo e a linha.

Resumo em quatro frases. A ponte de hoje não roda em Linux: ela tropeça no login, na tranca da sessão, no gancho e na instalação, e em todos os casos falha fechada, ou seja, não sobe em vez de subir insegura. A base e as regras do Firestore já aceitam duas pontes, uma por máquina, sem mudar nada. O painel não: ele enxerga uma ponte só, a mais recente, e isso faz a tela mentir e faz a ordem de abrir fábrica cair na máquina errada. O login dentro da VM tem dois caminhos honestos, o encaminhamento de porta do SSH (rápido, mas pede a sua leitura do §A.6) e o fluxo de dispositivo (mais limpo, mas pede trabalho seu no console do Google).

---

## 1. O que trava a ponte de rodar em Linux hoje

### 1.1 Instalador

`ponte/instalar.ps1` é PowerShell do começo ao fim e não tem equivalente para Linux.

- Pasta local montada com `$env:USERPROFILE` (instalar.ps1:36). Não existe no Ubuntu.
- Tranca da pasta com `icacls` (instalar.ps1:48 e 49). Não existe no Ubuntu.
- Nome da máquina com `$env:COMPUTERNAME` (instalar.ps1:75).
- Leitura da configuração do cliente com `Invoke-RestMethod` (instalar.ps1:89). No Linux seria um `curl` ou o próprio Node, e é só conexão de saída, então não fere nada.
- Subida automática por Tarefa Agendada do Windows, `Register-ScheduledTask` e `Start-ScheduledTask` (instalar.ps1:171 a 193). No Ubuntu o equivalente é um serviço de usuário do systemd. Ponto de atenção, mais abaixo em 6: serviço de usuário para quando a última sessão do usuário fecha, a menos que se ligue a permanência do usuário (`loginctl enable-linger`), e isso pode pedir senha de administrador da VM.

### 1.2 Ganchos de ciclo de vida

- `ponte/ganchos/ligar.ps1` e `ponte/ganchos/desligar.ps1` são PowerShell e montam caminhos com `$env:USERPROFILE` e barra invertida (ligar.ps1:35 a 40, desligar.ps1:27 a 30), inclusive o caminho do `settings.json` do Claude Code, `.claude\settings.json` (ligar.ps1:38).
- `ponte/ganchos/gancho.cjs`, o programa que o Claude Code chama a cada passo, monta a pasta com `process.env.USERPROFILE + '\\.a-fabrica-ponte'` (gancho.cjs:124) e todos os arquivos com barra invertida (gancho.cjs:125, 142, 143). No Linux, `USERPROFILE` não existe, o caminho vira o texto `undefined\.a-fabrica-ponte\ganchos.json`, a leitura falha, e o gancho sai calado pela regra R1 (gancho.cjs:218 a 223). Ou seja: não atrapalha a sessão do diretor, mas também não captura nada. Pior ainda se alguém definir `PONTE_PASTA_LOCAL`: no Linux a barra invertida é um caractere comum de nome de arquivo, e o gancho criaria arquivos com nomes como `.a-fabrica-ponte\ganchos.json` dentro da pasta pessoal, em vez de entrar na pasta.
- A comparação de liberação do §A.23 (gancho.cjs:95 a 118) troca barra por barra invertida e põe tudo em minúscula. A troca de barra funciona igual nos dois lados, então a fronteira de caminho continua valendo. A minúscula não: no Windows nome de pasta não diferencia maiúscula, no Linux diferencia. Liberar `/home/rike/a-fabrica` liberaria também uma pasta distinta chamada `/home/rike/A-Fabrica`. É um alargamento pequeno, mas é alargamento de liberação de conteúdo, e o §A.23 diz que a liberação nunca cresce sozinha. A versão Linux do gancho não pode baixar a caixa.
- O lado da ponte que lê a fila, `ponte/src/ganchos.ts`, já usa `join` do Node para tudo (ganchos.ts:84 a 86, 129 a 131, 539) e funciona em Linux sem mudança.

### 1.3 Caminhos e configuração

- `ponte/src/config.ts` usa `homedir()` e `join` (config.ts:28 a 36), então a pasta `~/.a-fabrica-ponte` sai certa no Linux.
- Mas `protegerPastaLocal` tranca a pasta com `icacls` (config.ts:142 a 157). No Linux o comando não existe, cada chamada cai no `catch` e vira a linha "falhou" (config.ts:150 a 152). Não derruba o login sozinho, só registra.
- As mensagens de erro mandam rodar `powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1` (config.ts:87, entrar.ts:135, ponte.ts:347, identidade.ts:607). No Linux é instrução errada.
- `ponte/src/persistenciaArquivo.ts` é portável: grava com `mode: 0o600` e troca atômica por renomeação (persistenciaArquivo.ts:80 a 88). Curiosidade que conta a favor: o comentário de protecaoSessao.ts:10 a 12 diz que `0o600` é teatro no Windows. No Linux não é teatro, é exatamente a tranca certa.

### 1.4 Tranca da sessão, `protecaoSessao.ts`

Este é o ponto que, sozinho, impede a ponte de subir na VM.

- A conferência roda `icacls` (protecaoSessao.ts:56 a 59) e lê a saída no formato do Windows, `MAQUINA\usuario:(F)` (protecaoSessao.ts:64 a 91). O dono é procurado com `USERDOMAIN` e `COMPUTERNAME` (protecaoSessao.ts:45 a 53).
- A aplicação da tranca também é `icacls` (protecaoSessao.ts:188 a 202).
- A ponte só sobe se a conferência disser "protegido" (ponte.ts:254 a 268, protecaoSessao.ts:226 a 237). No Linux o `icacls` não roda, a conferência cai em "não deu para conferir é igual a não protegido" (protecaoSessao.ts:139 a 147), e a ponte recusa subir. É falha fechada, o comportamento certo, mas significa que nada funciona até existir uma tranca de Linux.
- O que a tranca de Linux tem de fazer, para manter o mesmo nível: pasta `~/.a-fabrica-ponte` com modo 700, arquivos com 600, dono igual ao usuário que roda a ponte, e a conferência lendo o modo e o dono de verdade com `stat`, em vez de afirmar. Conferir também que a pasta não está numa pasta compartilhada com o Windows (pasta compartilhada da VM costuma ignorar modo de arquivo, e aí `chmod` vira teatro de novo).

### 1.5 Login, `entrar.ts` e `entradaNavegador.ts`

- O laço de retorno escuta em `127.0.0.1`, porta sorteada (entradaNavegador.ts:67, 492). Isso funciona igual no Linux.
- Abrir o navegador é `spawn('cmd', ['/c', 'start', '', endereco])` (entradaNavegador.ts:314). No Linux `cmd` não existe. O `try` em volta (entradaNavegador.ts:311 a 320) não pega esse erro, porque o Node avisa a falta do programa por evento assíncrono, depois do `try` ter terminado, e um evento de erro sem ouvinte derruba o processo. Resultado provável: o login morre logo depois de imprimir o endereço. Isto é leitura de código, não foi rodado.
- Mesmo que não morresse, a VM não tem navegador. O endereço é impresso no terminal (entradaNavegador.ts:539 a 545), mas é `localhost` da VM, que o navegador do Windows não alcança sem encaminhamento. Ver a seção 3.
- Existe a opção `naoAbrirNavegador` (entradaNavegador.ts:140, 545), mas quem chama não a passa (identidade.ts:397), e a opção `--sem-navegador` do `entrar.ts` (entrar.ts:57, 81) desliga o degrau inteiro, não só a abertura da janela.
- A conferência do Host aceita só `localhost:PORTA` ou `127.0.0.1:PORTA`, com a porta desta rodada (entradaNavegador.ts:369 a 377). Isto importa para o encaminhamento de porta, na seção 3.
- Depois do login, `entrar.ts` tranca e confere a sessão com `icacls` (entrar.ts:71, 89, 95 a 112) e sai com código 5 quando a tranca não fica de pé. No Linux sairia sempre com 5.

### 1.6 O kit `@anthropic-ai/claude-agent-sdk`

Funciona em Linux. O pacote declara binários opcionais por plataforma, entre eles `claude-agent-sdk-linux-x64` e `claude-agent-sdk-linux-x64-musl` (node_modules/@anthropic-ai/claude-agent-sdk/package.json:63 a 72). Nesta máquina só está instalado o de Windows, `claude-agent-sdk-win32-x64`. Consequência prática: a pasta `node_modules` não pode ser copiada do Windows para a VM, a instalação tem de rodar `npm install` dentro da VM, e o npm escolhe o binário de Linux sozinho. O Ubuntu usa a biblioteca padrão comum, então o binário certo é o `linux-x64` (ou `linux-arm64` se a VM for de processador ARM, o que neste PC não é o esperado).

O kit usa a conta do Claude Code que já estiver logada dentro da VM. Como o diretor já abre o Claude Code lá, a conta deve existir, mas isso precisa ser conferido, não presumido.

As três ressalvas do portão em `claudeCode.ts` são portáveis: a isca usa `join` (claudeCode.ts:114), a limpeza de ambiente só filtra variáveis (claudeCode.ts:45 a 53), e a configuração de fontes vazia (claudeCode.ts:78) não depende de sistema.

### 1.7 Outras suposições de Windows que achei

- **Classificação de risco só conhece verbo de Windows e alguns comuns.** `risco()` reconhece `rm`, `curl`, `git push` e o redirecionamento `>`, mas os verbos de média gravidade são de PowerShell: `set-content`, `new-item`, `out-file`, `move-item`, `copy-item` (ponte.ts:66 a 71). No Linux, `mv`, `cp`, `chmod`, `chown`, `sudo`, `tee`, `ssh`, `scp` e `apt` aparecem como risco baixo. Não é furo de portão, porque o portão pergunta ao diretor em toda chamada (ponte.ts:181 a 209), mas é a mesma desonestidade de tela que o comentário de ponte.ts:55 a 64 já corrigiu uma vez: o pedido mais perigoso aparecendo como o mais inofensivo.
- **A isca cria a pasta do projeto se ela não existir.** `verificaPortao` começa com `mkdirSync(cwd, { recursive: true })` (claudeCode.ts:107). Se uma ordem com caminho de Linux, como `/home/rike/projeto`, chegar à ponte do Windows, ela cria `C:\home\rike\projeto` antes de abrir a fábrica nele. É o efeito direto do problema de máquina errada da seção 2.
- **Pasta padrão de fábrica** é `~/a-fabrica-lab/projeto-cc` (ponte.ts:49 a 51). Portável, mas na VM talvez não seja o que o diretor quer.
- **README desatualizado.** `ponte/README.md` ainda fala de colagem de credencial e diz que não existe laço de retorno, o que deixou de ser verdade na OST 7. Fora do escopo desta onda, só registro.
- **`icacls` também em `entrar.ts`** (entrar.ts:71 a 73, 89 a 91), já coberto acima.

---

## 2. Duas pontes, uma no Windows e outra na VM: a base aguenta, o painel não

### 2.1 O que já funciona do jeito que está

A base foi desenhada por máquina desde o começo, e isso foi conferido no código, não só no contrato.

- **Identidade.** Cada instalação gera o seu `maquinaId` (instalar.ps1:74), e a ponte lê da configuração local (config.ts:92 a 94). A VM teria o seu próprio.
- **Fila de comandos por máquina.** A ponte só escuta comandos pendentes com o seu `maquinaId` (base.ts:296 a 312). O contrato diz o mesmo (contrato-tres-pecas.md:140 e 146).
- **Sinal de vida por máquina.** Cada ponte escreve só em `maquinas/{seu maquinaId}` (base.ts:100 a 106). A parada limpa marca offline só as fábricas vivas daquele processo (base.ts:111 a 119).
- **Reconciliação no início.** Recusa pedidos pendentes e marca "ponte offline" só nos documentos do seu `maquinaId` (base.ts:321 a 390, filtros em base.ts:329 e 359). **Resposta direta à pergunta: não, uma ponte não recusa aprovação nem marca offline fábrica da outra no reinício.**
- **Recusa de pedidos ao encerrar ou pausar** é por `fabricaId` (base.ts:397 a 427), e só acontece quando chega um comando endereçado àquela máquina para uma fábrica dela. Não cruza.
- **Fábrica aberta na mão** ganha o nome `mao-` mais o identificador de sessão do Claude Code (ganchos.ts:134, 455), e leva o `maquinaId` da ponte que leu a fila (ganchos.ts:463, 485). Cada ponte lê só a fila da sua máquina, e o identificador de sessão é único, então as fábricas da VM não colidem com as do Windows.
- **Regras do Firestore.** Exigem `maquinaId` preenchido e imutável em comando e aprovação (firestore.rules:116, 121, 128, 137, 144, 152), e nada nelas presume máquina única. O próprio cabeçalho já declara que `maquinaId` é escopo lógico, não fronteira de segurança, porque a conta é uma só (firestore.rules:48 a 52). Com duas pontes isso continua verdade e continua declarado. **As regras não precisam mudar.**
- **Comando para fábrica que já existe** vai com o `maquinaId` da própria fábrica (FabricaTela.tsx:76 e 126), então comandar e aprovar uma fábrica da VM chega na ponte da VM.

Uma observação de segurança que já valia e com duas pontes pesa um pouco mais: a regra de `fabricas` não protege o `maquinaId` da fábrica (firestore.rules:92 a 96), então uma ponte com defeito conseguiria escrever na fábrica da outra. Hoje nenhum código faz isso. Não proponho mudar agora, só registro.

### 2.2 O que quebra no painel

O painel foi escrito para uma ponte só. Achei três problemas, e os dois primeiros fazem a tela mentir, o que o §A.10 e o §A.22 proíbem.

1. **O painel escolhe UMA máquina, a vista mais recentemente.** `avaliarPonte` ordena as máquinas pelo último sinal e fica com a primeira (painel/src/dados/tradutor.ts:153 a 184). O indicador "ponte conectada" e o bloqueio de escrita "ponte offline" (painel/src/dados/escritas.ts:91) olham só para ela.
2. **O estado de ponte perdida é global.** `pontePerdida = !ponte.online` vale para todas as fábricas (painel/src/dados/painel.ts:71 a 76, aplicado em painel.ts:100). Cenário concreto: a ponte da VM cai sem parada limpa (processo morto, VM suspensa sozinha) e a do Windows segue batendo. O painel acha a ponte do Windows, diz "conectada", e as fábricas da VM continuam aparecendo "em execução" sem ninguém executando. Isso é exatamente o painel mentindo. O inverso também acontece.
3. **Abrir nova fábrica não deixa escolher a máquina.** A ordem de abrir usa o `maquinaId` de contexto (painel/src/dados/escritas.ts:165), que vem da máquina mais recente (painel/app/page.tsx:36). Como as duas pontes batem a cada 15 segundos (base.ts:98), a máquina que recebe a ordem é praticamente sorteada. A tela mostra uma linha "Máquina" com o nome dessa escolhida (NovaFabrica.tsx:224 a 227), mas não deixa trocar. **Resposta direta à pergunta: não, a tela de abrir nova fábrica não sabe escolher a máquina.**
4. **A lista de projetos mistura as duas máquinas.** As sugestões de pasta saem de todas as fábricas já vistas, sem olhar a máquina (painel/src/dados/tradutor.ts:368 a 382, usado em NovaFabrica.tsx:49). Caminho de Linux vai aparecer como sugestão para abrir no Windows e vice versa, e combinado com o item 3 isso leva à pasta criada no lugar errado da seção 1.7. O exemplo do campo também é só de Windows (NovaFabrica.tsx:142).

### 2.3 O que o painel precisa mudar, e só o painel

Nada na base, nada nas regras. No painel:

- o indicador de ponte por máquina, um para o Windows e um para a VM, cada um com o seu "visto por último";
- o estado "ponte offline" de cada fábrica calculado pela máquina DELA, não pela mais recente;
- na tela de abrir fábrica, a escolha explícita da máquina, sem padrão escondido, e a lista de pastas filtrada pela máquina escolhida;
- o bloqueio de escrita "ponte offline" conferindo a máquina do alvo da ordem.

Isto é decisão de interface e passa pela sua validação visual, §A.13. Pelo §A.12, está proposto aqui, não construído.

Uma nota sobre o PC novo: como a ponte ainda não foi instalada aqui, a instalação do Windows também vai gerar um `maquinaId` novo, e a máquina antiga continua na base, offline (o script de conserto ainda aponta para ela, consertar-fabrica-fantasma.mjs:167). Só a ponte nova do Windows já cria um segundo registro de máquina. Hoje isso não quebra a tela porque a máquina antiga está parada e perde na ordenação, mas é mais um motivo para o painel aprender a lidar com várias máquinas.

---

## 3. Como fazer o login da ponte dentro de uma VM sem navegador

### 3.1 Encaminhamento de porta local do SSH, `ssh -L`

**Como seria.** Na VM, o login sobe o laço de retorno em `127.0.0.1` e imprime o endereço com a porta. No Windows, o diretor abre um encaminhamento do SSH para essa mesma porta, por exemplo `ssh -N -L 127.0.0.1:PORTA:127.0.0.1:PORTA usuario@vm`, e abre o endereço no navegador do Windows. O navegador fala com o laço de retorno do Windows, o cliente SSH carrega isso pela conexão que ele mesmo abriu até a VM, e lá dentro o servidor SSH entrega ao laço de retorno da VM, onde a ponte está escutando.

**Detalhes que fazem diferença.**
- A porta tem de ser a mesma dos dois lados. A ponte confere o Host, e só aceita `localhost:PORTA` com a porta desta rodada (entradaNavegador.ts:369 a 377). Se o lado do Windows usar outra porta, a página responde "nada aqui".
- A porta é sorteada (entradaNavegador.ts:492) e só se conhece depois que o login começa. O diretor teria de ler a porta e só então abrir o encaminhamento, em outro terminal, dentro do limite de três minutos (entradaNavegador.ts:107 a 111). Para isso virar passo simples, a ponte precisaria de uma porta combinada, escolhida pela instalação. Isso enfraquece um pouco a tranca T2 (porta imprevisível), mas a tranca que de fato segura é a T4, o segredo de uso único no endereço, e ela continua.
- Se a janela do editor estiver conectada à VM por SSH remoto e encaminhar portas sozinha, o encaminhamento pode acontecer sem comando nenhum. Mas encaminhador automático às vezes escolhe outra porta no Windows quando a original está ocupada, e aí a conferência do Host recusa. Não testei.
- O login com o Google acontece no navegador do Windows, na origem `localhost`, que é a que o Firebase autoriza de fábrica (entradaNavegador.ts:70 a 84). Não precisa mudar nada no Authentication.

**Isso fere o §A.6? Análise com cuidado.**

O §A.6 veta três coisas: porta aberta de entrada, túnel de entrada e endereço público apontando para a máquina. Na OST 7 o diretor esclareceu que laço de retorno em `127.0.0.1` está liberado para o login (entradaNavegador.ts:11 a 15).

- No Windows, quem escuta é o cliente SSH, em `127.0.0.1`, enquanto o diretor deixar o comando aberto. É laço de retorno, a rede não alcança. Atenção: só é laço de retorno se o comando disser `127.0.0.1:` na frente, ou se o cliente SSH estiver no padrão. Com a opção `-g`, ou com `GatewayPorts` ligado, ele escutaria na rede, e isso seria porta de entrada de verdade. Por isso a forma escrita tem de trazer o endereço explícito.
- A conexão em si é de saída: é o Windows que liga para a VM.
- Na VM, quem recebe é o servidor SSH, que já existe e é do diretor, não deste projeto. Nada novo passa a escutar além do laço de retorno temporário que a ponte já abre hoje.
- Nenhum endereço público aponta para nada.

Leitura que eu faço: pela letra do §A.6 e pelo esclarecimento da OST 7, **não fere**. Mas existe uma leitura contrária razoável: o encaminhamento é, tecnicamente, um túnel cuja ponta de chegada fica dentro da VM, e "túnel de entrada" está na lista do que é vetado. Interpretar regra dura não é decisão minha, é sua, pelo §A.14. Por isso recomendo este caminho só com a sua confirmação escrita de que encaminhamento local do SSH, preso em `127.0.0.1` dos dois lados e só durante o login, está dentro do §A.6.

Registro também um ponto que não é deste projeto, mas que o §A.6 deixa claro: a própria VM já tem um servidor SSH escutando, porque é assim que o diretor entra nela. Se a rede da VM estiver em modo ponte, e não em modo NAT, esse servidor é alcançável pela rede local. Não fomos nós que abrimos, e a ponte não usa isso para nada além deste login, mas é bom o diretor saber.

### 3.2 Copiar a sessão da ponte do Windows para a VM

**Como seria.** Fazer o login no Windows e copiar `sessao.json` para `~/.a-fabrica-ponte/` da VM.

**Por que eu não recomendo.**
- Esse arquivo vale como chave de aprovação. É com ele que a ponte responde aprovação na base (protecaoSessao.ts:3 a 8). Copiar é transportar a chave por um caminho que nenhuma tranca da ponte confere: área de transferência, pasta compartilhada, arquivo temporário. Qualquer um desses pode deixar cópia para trás.
- As duas pontes passariam a usar o mesmo token de atualização. Se um dia for preciso cortar só a da VM, não dá: revogar um derruba as duas.
- A tranca da ponte confere o arquivo depois que ele chega, mas não confere por onde ele passou. A proteção vira "confie em quem copiou".
- E hoje nem existe a sessão do Windows para copiar: o diretor não tem login feito neste PC novo.

### 3.3 Fluxo de dispositivo do Google

Já proposto em docs/ost6-ponte-credencial.md:91 a 117, como opção B.

**Como seria.** A ponte da VM pede um código ao Google, mostra no terminal um código curto e um endereço, o diretor confirma no celular ou no navegador do Windows, e a ponte fica perguntando ao Google, sempre por saída, até receber a identidade. Depois troca isso pela sessão do Firebase.

**A favor.** Nada escuta em momento nenhum, nem laço de retorno. Não depende de SSH, de encaminhamento nem de porta combinada. Funciona igual para a VM, para o Windows e para uma máquina na nuvem no futuro (Onda 5 do §A.8). E o acesso aparece na página de permissões da conta Google, onde o diretor corta com um clique.

**Contra.** Depende de você criar um cliente OAuth de dispositivo no console do Google Cloud, coisa que a fábrica não tem credencial para fazer. E tem uma incerteza que só se resolve testando: se o Authentication aceita a identidade emitida para esse cliente novo (ost6-ponte-credencial.md:105 a 109). Se não aceitar, esse trabalho se perde.

### 3.4 Recomendação

**Para a primeira ponte na VM: encaminhamento local do SSH, condicionado à sua confirmação do §A.6.** Ele reaproveita o login que já foi provado na OST 7, com as sete trancas, e pede da ponte só três ajustes pequenos: não tentar abrir navegador no Linux, aceitar uma porta combinada pela instalação, e escrever na tela o comando exato do encaminhamento para você copiar.

**Para depois, se você quiser um caminho só para todas as máquinas: fluxo de dispositivo.** É o mais limpo diante do §A.6, mas depende da sua mão no console e de uma prova que pode dar errado.

**Copiar a sessão: não.**

---

## 4. O §A.23 e o §A.9 dentro da VM

### 4.1 §A.9, só acrescentar

- O gancho entraria no `~/.claude/settings.json` **da VM**, que é um arquivo separado do `settings.json` do Windows. A ponte da VM nunca toca no do Windows, e a do Windows nunca toca no da VM.
- O jeito de acrescentar já existe e é o certo, só precisa ser reescrito para Linux: cópia de segurança com data e hora antes de tocar (ligar.ps1:49 a 56), não duplicar a entrada se ela já está lá (ligar.ps1:127 a 135), manter qualquer gancho que já exista (ligar.ps1:122 a 137), gravar em arquivo temporário, conferir que é JSON válido e só então trocar (ligar.ps1:141 a 147). O desligar de um passo tira só as entradas que a Fábrica pôs (desligar.ps1:1 a 6).
- A versão de Linux deve ser em Node, não em script de shell, para ler e escrever JSON de forma segura. E deve ser escrita para não depender de `bash` nem de PowerShell estarem presentes.
- Uma ressalva que já vale hoje no Windows e vale igual no Linux: reler e regravar o JSON mantém todo o conteúdo do diretor, mas pode mudar a formatação do arquivo (espaços, ordem de quebra de linha). O conteúdo não muda, a aparência pode mudar. Declaro para não vender como intocado.
- Se o `~/.claude/settings.json` da VM não existir, o comportamento certo é o de hoje: parar e pedir para abrir o Claude Code uma vez (ligar.ps1:49 a 52), e não criar o arquivo por conta própria.
- O plano B continua de pé: se o painel cair, o diretor abre o Claude Code na VM por SSH exatamente como hoje. O gancho só escreve na fila local e sai com código 0 em qualquer caso (gancho.cjs:29 a 35, 217 a 223).

### 4.2 §A.23, liberação por caminho de Linux

- A configuração do gancho fica em `~/.a-fabrica-ponte/ganchos.json` da VM, com a sua própria lista de liberados. Ela não herda a lista do Windows. Começa vazia: projeto novo nasce sem liberação (ligar.ps1:80 a 82), e isso vale para todos os projetos da VM.
- Os caminhos liberados serão de Linux, como `/home/USUARIO/a-fabrica`. Liberar `C:\Users\Henrique\a-fabrica` no Windows não libera nada na VM, e é bom que seja assim.
- A comparação continua por fronteira de caminho, igual ou seguido de `/`, e **sem baixar a caixa** no Linux, pelo motivo da seção 1.2.
- Atenção a pasta compartilhada: se o mesmo projeto existir dos dois lados, por exemplo uma pasta do Windows montada dentro da VM, ele terá dois caminhos diferentes, um em cada lista. Liberar de um lado não libera do outro. Isso é falha fechada e está certo, mas o diretor precisa saber para não achar que liberou.
- A decisão continua dentro do gancho, na VM. O que não é liberado não entra nem na fila em disco da VM (gancho.cjs:192 a 212).

---

## 5. O tamanho do trabalho, em ondas

Sem prazo. Cada onda diz o que entrega e o que depende da sua mão.

**Onda A, a ponte sobe na VM, só para enxergar.**
Entrega: instalação de Linux em um comando só, sem editar arquivo na mão, em Node; tranca de Linux com modo 700 e 600 e conferência real do modo e do dono; mensagens de erro com a instrução de Linux; login sem tentar abrir navegador, com porta combinada e com o comando do encaminhamento escrito na tela; serviço de usuário do systemd; gancho de Linux, ligar e desligar em Node, com fronteira de caminho sem baixar caixa. Prova com fábrica de verdade na VM: sessão aberta por SSH na mão aparece no painel com o `maquinaId` da VM.
Depende do diretor: confirmar o §A.6 para o encaminhamento; ter Node 20 e o repositório dentro da VM; conferir que o Claude Code da VM está logado; rodar o login uma vez com o encaminhamento aberto; dizer quais pastas da VM liberar para conteúdo; se quiser a ponte de pé sem SSH aberto, aceitar o `enable-linger`, que pode pedir a senha de administrador da VM.

**Onda B, o painel para de mentir com duas máquinas.**
Entrega: indicador de ponte por máquina; estado "ponte offline" de cada fábrica pela máquina dela; bloqueio de escrita pela máquina do alvo. Nenhuma mudança de regra nem de base.
Depende do diretor: validação visual, §A.13. Esta onda deveria sair junto ou antes da Onda A chegar a uso diário, porque sem ela a tela mente no primeiro tropeço de uma das pontes.

**Onda C, abrir fábrica escolhendo a máquina.**
Entrega: escolha explícita de máquina na tela de nova fábrica, sem padrão escondido; lista de pastas filtrada por máquina; exemplo de caminho de acordo com a máquina; classificação de risco que conhece os verbos de Linux; a ponte recusando, com motivo na tela, caminho que não é do seu sistema, em vez de criar pasta (claudeCode.ts:107).
Depende do diretor: validação visual, e decidir se a escolha de máquina deve lembrar a última usada ou perguntar sempre.

**Onda D, opcional, login sem porta nenhuma.**
Entrega: fluxo de dispositivo do Google para qualquer máquina.
Depende do diretor: criar o cliente OAuth de dispositivo no console do Google Cloud do projeto a-fabrica-soulan, e aceitar o risco de a prova dar negativo.

---

## 6. Limites declarados

- **§A.10 em dobro.** A VM roda dentro deste PC. Se o Windows dormir, a VM para junto, e as duas pontes param. Pior: a VM pode ficar suspensa mesmo com o Windows acordado, dependendo do programa de virtualização. Em qualquer dos casos, a parada não é limpa, então quem diz "ponte offline" é o painel, pela falta de sinal de vida passados 60 segundos (painel/src/dados/tradutor.ts:67). Isso só vira verdade por máquina depois da Onda B.
- **Serviço de usuário morre com a última sessão.** Sem `enable-linger`, o systemd para a ponte da VM quando o diretor fecha o último SSH. Ou seja: fechou o terminal, a ponte da VM some, e as fábricas abertas pelo painel na VM morrem junto. Com o `linger`, ela fica de pé enquanto a VM estiver ligada.
- **Relógio da VM.** Depois de uma suspensão, o relógio da VM pode voltar atrasado até sincronizar. A trilha não sofre, porque toda hora de trilha é do servidor (firestore.rules:35 a 37), mas tempos medidos localmente, como tempo parado de pedido, podem sair errados logo depois de acordar.
- **Mesmo usuário, mesmo limite do §A.7.** A fábrica na VM roda como o mesmo usuário Linux que o diretor, igual ao Windows. Ela alcança a pasta `~/.a-fabrica-ponte` da VM. A tranca protege de outros usuários, não da própria fábrica. Quem segura isso é o portão, que pergunta em toda chamada, e a classificação de risco alto para a pasta da ponte (ponte.ts:55 a 65), que já é portável.
- **`maquinaId` não é fronteira.** Com conta única, a ponte da VM tem o mesmo poder na base que a do Windows (firestore.rules:48 a 52). Duas pontes são dois lugares de onde a chave de aprovação pode vazar, não um. Cada uma deve ter a sua própria sessão, nunca a mesma copiada.
- **Pasta compartilhada entre Windows e VM.** Se a pasta da ponte cair numa pasta compartilhada, modo de arquivo deixa de valer e a tranca vira teatro. A conferência da Onda A tem de recusar subir nesse caso.
- **Servidor SSH da VM.** Já existe, é do diretor, e é porta de entrada da VM. Não é deste projeto e a ponte não depende dele para funcionar, só para o login pelo encaminhamento. Se a rede da VM estiver em modo ponte, ele é alcançável pela rede local.
- **O que não foi verificado.** Este documento é leitura de código. Não rodei a ponte em Linux, não testei o encaminhamento, não conferi a versão do Node nem do Claude Code dentro da VM, e não sei qual programa de virtualização nem qual modo de rede a VM usa. A queda do login na chamada de `cmd` é dedução da leitura (entradaNavegador.ts:314), não observação.

---

## O que depende do diretor

1. **Confirmar o §A.6 para o encaminhamento.** Dizer, por escrito, se encaminhamento local do SSH, preso em `127.0.0.1` dos dois lados e aberto só durante o login, está dentro do §A.6. Sem isso, o único caminho de login para a VM é o fluxo de dispositivo.
2. **Escolher o caminho de login:** encaminhamento do SSH agora, fluxo de dispositivo depois, ou fluxo de dispositivo direto.
3. **Se for fluxo de dispositivo:** criar o cliente OAuth de dispositivo no console do Google Cloud do projeto a-fabrica-soulan. A fábrica não tem essa credencial.
4. **Dentro da VM:** ter Node 20 e o repositório, conferir que o Claude Code está logado, e rodar o login da ponte uma vez.
5. **Decidir sobre o `enable-linger`:** ponte da VM de pé enquanto a VM estiver ligada, ou só enquanto houver SSH aberto. O primeiro pode pedir a senha de administrador da VM.
6. **Dizer quais pastas da VM liberar para conteúdo**, uma a uma, com caminho de Linux. Até lá, a VM manda só metadado.
7. **Aprovar a ordem das ondas**, em especial se a Onda B, a do painel que para de mentir com duas máquinas, sai antes ou junto da Onda A.
8. **Dizer como a VM está montada:** qual programa de virtualização, rede em modo NAT ou ponte, e se os projetos ficam no disco da VM ou numa pasta compartilhada com o Windows.
9. **Validação visual**, §A.13, das telas das Ondas B e C.
10. **Fazer o login da ponte também no Windows deste PC novo**, que hoje não tem ponte instalada nem sessão.
