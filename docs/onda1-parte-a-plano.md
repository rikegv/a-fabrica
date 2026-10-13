# Onda 1, Parte A, plano e passo do diretor (OST 4, Parte 3)

A rota do Claude Code esta provada e aprovada com ressalva. A Parte A constroi a ponte de verdade e a base na nuvem. Sem tela, §A.8. O resultado se verifica olhando a base e rodando script.

## O unico passo que a fabrica nao faz sozinha

Criar o projeto Firebase e autenticar exige um login interativo, com a sua conta Google da Soulan, que abre o navegador. A fabrica nao pode fazer isso por voce. Rode uma vez, aqui mesmo com o prefixo, ou no seu terminal:

```
! firebase login
```

So isso. Depois do login, a CLI fica autenticada e a fabrica faz o resto sem voce.

## O que a fabrica faz assim que voce logar

1. Cria o projeto, com o identificador que voce autorizou:
   ```
   firebase projects:create a-fabrica-soulan --display-name "A Fabrica"
   ```
2. Liga os servicos da Parte A: Firestore, Authentication e Hosting. Cloud Functions NAO entra na Parte A, porque exige plano pago.
3. Aplica as regras do Firestore ja redigidas em firebase/firestore.rules, com a conta unica, a trilha imutavel e a fila por maquina. O deploy passa pelo gate, entao so sobe apos a sua validacao e a flag READY_.
4. Promove o prototipo a servico de verdade em Node 20, pilotando o Claude Code, com o portao costurado como portao duro, conforme as tres ressalvas da seguranca:
   - verificacao do portao na abertura, antes de TODA fabrica, sob o mesmo ambiente da sessao real;
   - ambiente limpo das variaveis de aninhamento do Claude Code;
   - modo de permissao fixado e conferido em toda abertura.
5. Entrega a instalacao de um passo: autentica, pareia a maquina e registra para subir sozinha quando o computador liga.
6. Roda os oito testes do Passo 4, agora com Claude Code, com a base real, e cola a saida:
   abrir e ver atividade ao vivo na base; comando pela base executa; aprovacao pela base com pacote completo executa; recusa nao executa; queda de conexao sem perder nem repetir comando; parar a ponte vira ponte offline; outra conta negada; fila de outra maquina negada.
7. Aciona a seguranca para o parecer final.

## Credencial, regra dura
A ponte entra como o proprio diretor, com a autenticacao feita uma vez no login acima e renovada sozinha depois. Nao existe arquivo de chave de servico na maquina, nem segredo no codigo ou no repositorio. O acesso da ponte e exatamente o acesso do diretor, limitado pelas regras do Firestore.

## Plano B preservado, §A.9
Nada disto altera a configuracao existente da sua maquina. O Claude Code e o Antigravity seguem funcionando na mao, como hoje.
