# Ponte da Fábrica (serviço local)

Serviço em Node 20, escrito em TypeScript estrito, que roda continuamente na máquina do diretor. Pilota o Claude Code pelo kit oficial e conversa com a base no Firestore. É a Peça 3 do §A.3.

## Garantias (regra dura)

- Só conexão de saída. Nunca abre porta, nunca escuta, nunca aceita conexão de fora, §A.6. Em especial, não existe servidor local de laço de retorno para receber redirecionamento de OAuth, nem em 127.0.0.1: a escada de credencial foi desenhada para dispensar isso.
- A ponte entra como o próprio diretor, pelo SDK cliente, sem chave de serviço. Ao subir, confere que o usuário autenticado é o e-mail do diretor e que o e-mail está verificado. Qualquer outro, ela não sobe e registra o motivo.
- Portão duro antes de TODA abertura de fábrica, com as três ressalvas da segurança costuradas em `src/claudeCode.ts`:
  1. verificação do portão com isca, nas mesmas opções e ambiente da sessão real;
  2. limpeza das variáveis de aninhamento do Claude Code;
  3. conferência do modo fixado em `default` no evento init.
  Qualquer uma falhando, a fábrica não nasce. Prova ao vivo: `node dist/testes/prova-ressalvas.js`.
- Falha fechada em qualquer erro: espera de resposta, portão, entrega de comando e leitura de configuração.
- Comando idempotente: entregue numa transação antes de executar, não executa duas vezes e não se perde se a conexão cair (`tomarComando`).
- Máquina indisponível vira ponte offline: o heartbeat marca a máquina, e a parada limpa passa as fábricas vivas para ponte offline, §A.10.
- Pedido de aprovação sobrevive a reinício: a reconciliação no início recusa por segurança os pedidos de sessões que não existem mais, com trilha. Nada executa sem resposta do diretor.
- Tempo esgotado deixa trilha: quando ninguém responde no prazo, a ponte recusa **e grava a recusa na base**, dizendo que foi recusa por tempo e não resposta do diretor, com hora do servidor e origem. Depois disso a regra publicada nega resposta tardia, porque o pedido já está decidido. Prova: `npm run prova:tempo`.
- Trava de processo único por fábrica, que não prende a fábrica quando o processo dono morreu.
- Nenhum segredo no código ou no repositório. Configuração e sessão vivem em `%USERPROFILE%\.a-fabrica-ponte`, com permissão só do usuário atual.

## Instalação de um passo

```
powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1
```

Faz tudo: instala dependências, compila, pareia a máquina, grava a configuração do cliente lendo do próprio Firebase, faz o login de uma vez, registra a tarefa agendada `A Fabrica Ponte` para subir no logon e sobe a ponte. Se o login ainda não puder ser feito, a instalação diz o clique exato que falta, sem mandar ninguém procurar em relatório nenhum.

A credencial entra por colagem, uma vez só. É este o caminho de entrada da ponte na nuvem:

```
powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Colar
```

O diretor abre o painel já logado, copia a credencial de sessão daquela sessão de navegador e cola quando a instalação pedir. Colagem vazia, truncada, de outro formato, de outro projeto ou de outra conta é recusada com o motivo escrito, e nada é gravado. Prova caso por caso: `npm run prova:colagem`.

## Identidade da ponte, escada de credencial

Quem manda é `src/identidade.ts`. A ordem é esta, e o primeiro degrau que funcionar vence:

1. `sessao-salva`: já existe sessão em `%USERPROFILE%\.a-fabrica-ponte\sessao.json`. O próprio SDK renova o token, o diretor não loga de novo. Isto funciona porque a ponte implementa uma persistência própria para o SDK cliente (`src/persistenciaArquivo.ts`), que o SDK em Node não tem.
2. `colagem-na-instalacao`: o diretor cola uma vez a credencial de sessão do painel já logado, e a ponte troca por sessão própria no endpoint de token seguro, por conexão de saída. A ponte confere que a conta é a do diretor, que o e-mail está verificado e que a sessão é deste projeto, antes de gravar qualquer coisa.

No modo emulador existe um degrau extra, `emulador-usuario-de-teste`, que só vale contra o emulador local.

**Escopo puro de Firebase, por decisão do diretor na OST 6.** O degrau que lia o token do Firebase CLI foi **removido**, não desligado: não existe função, constante, bandeira nem caminho de código em `src/` que alcance o depósito do firebase-tools. Razão: aquele token carrega escopo de nuvem muito maior do que as regras do Firestore limitam, então um arquivo roubado daria acesso a bem mais do que o painel. O que falta, exatamente, para a ponte obter sessão de cliente, com o custo e o risco de cada opção, está em `docs/ost6-ponte-credencial.md`.

## Arquivos

- `src/tipos.ts`: tipos das entidades do contrato (`docs/contrato-tres-pecas.md`).
- `src/config.ts`: configuração local, pasta fechada por icacls, leitura que falha falando o que falta.
- `src/persistenciaArquivo.ts`: persistência própria da sessão do Firebase em arquivo.
- `src/identidade.ts`: a escada de credencial e a conferência de que é o diretor.
- `src/base.ts`: Firestore, heartbeat, idempotência, espera de resposta, reconciliação.
- `src/claudeCode.ts`: Claude Code pelo SDK, com as três ressalvas e o portão.
- `src/ponte.ts`: o serviço, liga base e Claude Code, trava de processo único por fábrica.
- `src/entrar.ts`: o login de uma vez, chamado pela instalação.
- `src/testes/sete-testes.ts`: os sete testes de ponta a ponta.
- `src/testes/prova-ressalvas.ts`: prova ao vivo das três ressalvas.
- `src/testes/prova-colagem.ts`: o caminho da colagem posto a prova, dez casos de erro, nenhum deles gravando nada.
- `src/testes/prova-tempo-esgotado.ts`: prova de que o tempo esgotado deixa trilha na base.
- `src/testes/prova-sessao-colada.ts`: prova de que a sessão escrita à mão pela colagem é carregada pelo SDK e sobrevive à conferência de identidade.
- `emulador/`: configuração para subir a base no emulador, em portas próprias.
- `legado-mjs/`: a ponte como nasceu na OST 5, em `.mjs`, preservada e fora de uso, §A.17.

## Comandos

```
npm run tipos        confere os tipos, modo estrito, tem de passar limpo
npm run compilar     compila para dist
npm run ponte        sobe o serviço contra a base real
npm run testes       roda os sete testes contra a BASE REAL
npm run base-real    compila e roda os sete contra a BASE REAL, num comando só
npm run colar        pede a credencial de sessão e entra, uma vez só
npm run prova:colagem  prova os caminhos de erro da colagem
npm run prova:tempo    prova que o tempo esgotado deixa trilha na base
npm run prova:sessao   prova que a sessão escrita pela colagem serve para o SDK
```

Os sete testes apontam para o emulador em vez da base real com UMA variável de ambiente, sem mudar código:

```
powershell -ExecutionPolicy Bypass -File ponte\emulador\subir.ps1
cd ponte
$env:PONTE_EMULADOR = '1'
npm run testes
```

O emulador substitui só a base. O Claude Code é sempre de verdade, com sessão viva.

## O que foi provado e o que falta

- Os sete testes passaram 7 de 7 com a base no emulador e sessão do Claude Code viva, inclusive depois da remoção do degrau proibido. Isso não é o mesmo que a base real.
- As três ressalvas provadas ao vivo depois do porte para TypeScript.
- Tempo esgotado deixando trilha: provado ao vivo contra as regras publicadas, no emulador.
- Caminhos de erro da colagem: provados, inclusive contra o endpoint de token real do Google.
- A sessão escrita à mão pela colagem: provada consumível pelo SDK, com renovação de token e conferência de identidade.
- Falta a credencial de sessão do diretor para rodar os sete contra a base real. Leitura honesta teste por teste em `docs/ost6-ponte-parte2.md`, e o passo único que destrava em `docs/ost6-ponte-credencial.md`.
