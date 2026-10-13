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
- Trava de processo único por fábrica, que não prende a fábrica quando o processo dono morreu.
- Nenhum segredo no código ou no repositório. Configuração e sessão vivem em `%USERPROFILE%\.a-fabrica-ponte`, com permissão só do usuário atual.

## Instalação de um passo

```
powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1
```

Faz tudo: instala dependências, compila, pareia a máquina, grava a configuração do cliente lendo do próprio Firebase, faz o login de uma vez, registra a tarefa agendada `A Fabrica Ponte` para subir no logon e sobe a ponte. Se o login ainda não puder ser feito, a instalação diz o clique exato que falta, sem mandar ninguém procurar em relatório nenhum.

Variação, só se o login direto não servir:

```
powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Colar
```

## Identidade da ponte, escada de credencial

Quem manda é `src/identidade.ts`. A ordem é esta, e o primeiro degrau que funcionar vence:

1. `sessao-salva`: já existe sessão em `%USERPROFILE%\.a-fabrica-ponte\sessao.json`. O próprio SDK renova o token, o diretor não loga de novo. Isto funciona porque a ponte implementa uma persistência própria para o SDK cliente (`src/persistenciaArquivo.ts`), que o SDK em Node não tem.
2. `token-do-firebase-cli`: troca o token do Google que o `firebase login` do diretor já deixou na máquina por sessão do Firebase. Só leitura do arquivo do firebase-tools, nunca escrita, §A.9.
3. `colagem-na-instalacao`: o diretor cola uma vez a credencial de sessão que o painel mostra, e a ponte troca por sessão própria no endpoint de token seguro, por conexão de saída.

No modo emulador existe um degrau extra, `emulador-usuario-de-teste`, que só vale contra o emulador local.

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
- `emulador/`: configuração para subir a base no emulador, em portas próprias.
- `legado-mjs/`: a ponte como nasceu na OST 5, em `.mjs`, preservada e fora de uso, §A.17.

## Comandos

```
npm run tipos        confere os tipos, modo estrito, tem de passar limpo
npm run compilar     compila para dist
npm run ponte        sobe o serviço contra a base real
npm run testes       roda os sete testes contra a BASE REAL
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

- Os sete testes passaram 7 de 7 com a base no emulador e sessão do Claude Code viva. Isso não é o mesmo que a base real. Veja `docs/ost6-ponte.md` para a leitura honesta de cada teste e o que depende do diretor.
- As três ressalvas provadas ao vivo depois do porte para TypeScript.
- Falta ligar o provedor Google no Firebase Authentication do projeto `a-fabrica-soulan`, que é clique do diretor, para a ponte entrar na base real.
