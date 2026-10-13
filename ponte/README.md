# Ponte da Fabrica (serviço local)

Serviço em Node 20 que roda continuamente na máquina do diretor. Pilota o Claude Code pelo kit oficial e conversa com a base no Firestore. É a Peça 3 do §A.3.

## Garantias (regra dura)
- So conexão de saída. Nunca abre porta, nunca aceita conexão de fora. O SDK do Firestore e do Claude Code falam por saída.
- Portão duro antes de TODA abertura de fábrica, as três ressalvas da segurança costuradas em `src/claudeCode.mjs`:
  1. verificação do portão com isca, nas mesmas opções e ambiente da sessão real;
  2. limpeza das variáveis de aninhamento do Claude Code;
  3. conferência do modo fixado em `default` no evento init.
  Qualquer uma falhando, a fábrica não nasce.
- Falha fechada em qualquer erro, em `src/base.mjs` (espera de resposta) e no portão.
- Comando idempotente: entregue numa transação antes de executar, não executa duas vezes, não se perde se a conexão cair (`tomarComando`).
- Máquina indisponível vira ponte offline (`iniciarHeartbeat`, parada limpa marca offline).
- Pedido de aprovação sobrevive a reinício: a reconciliação no início recusa por segurança pedidos de sessões que não existem mais, nada executa sem resposta, o painel não mostra fantasma nem perde pedido real (`reconciliarPendentes`).
- A ponte entra como o próprio diretor, sem chave de serviço. Nenhum segredo no código ou no repositório; a configuração local vive em `~/.a-fabrica-ponte`.

## Instalação de um passo
```
powershell -ExecutionPolicy Bypass -File ponte/instalar.ps1
```
Instala dependências, pareia a máquina, registra a ponte para subir sozinha no logon. Falta só o login de cliente do diretor no Firebase (ver LISTA DE PENDÊNCIAS da OST 5).

## Arquivos
- `src/base.mjs`: Firestore, heartbeat, idempotência, espera de resposta, reconciliação.
- `src/claudeCode.mjs`: Claude Code pelo SDK, com as três ressalvas e o portão.
- `src/ponte.mjs`: o serviço, liga base e Claude Code, trava de processo único por fábrica.
- `instalar.ps1`: instalação de um passo.

## O que foi provado e o que falta
- Regras do Firestore provadas pelo emulador, sem login: `firebase/testes/regras.test.mjs` (PASSOU 12).
- O portão e as três ressalvas provados em sessão viva na OST 4, Parte 2 (`docs/prova-claude-code.md`).
- O fluxo ponte mais base ao vivo (abrir, comando, aprovação, offline, reinício) depende do login de cliente do diretor, ainda não feito. Está marcado NÃO EXECUTADO na OST 5, com o comando pronto na LISTA DE PENDÊNCIAS. O código está pronto para esse login.
