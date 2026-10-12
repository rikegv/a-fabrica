# CLAUDE.md, A FÁBRICA

## A.0 Princípio de operação
Esta é a constituição do projeto. Todo agente lê este arquivo antes de qualquer trabalho, em toda sessão. O coordenador é a porta de entrada e despacha os demais.

O diretor (Henrique Vieira, "Rike") decide escopo, regra de negócio e validação visual. A fábrica executa.

## A.1 O que é A Fábrica
Painel web de uso individual para abrir, acompanhar, comandar e encerrar sessões de agentes de IA (chamadas de fábricas) que rodam na máquina do diretor.

Hoje essas sessões rodam cada uma em uma janela do Antigravity e o custo de gerenciar as janelas virou o gargalo. O painel substitui as janelas no dia a dia.

Objetivo principal: gestão, ver e comandar.

Objetivo secundário: medir tempo, consumo e produtividade.

Usuário único: o diretor. Não há perfis, não há papéis, não há acesso de cliente nem de colaborador.

Este painel é separado do SOUsystem de propósito e não se integra a ele.

## A.2 Stack
Painel: Next.js 14 App Router, React 18, TypeScript, Tailwind.

Nuvem: Firebase. Auth para login, Firestore para estado ao vivo, Cloud Functions onde precisar de servidor, Hosting para publicar.

Ponte local: Node 20 e TypeScript, serviço contínuo na máquina do diretor.

Execução das fábricas: Antigravity em linha de comando (agy).

## A.3 Arquitetura em três peças
PEÇA 1, PAINEL WEB. Interface. Não executa nada sozinho, apenas mostra e registra ordens.

PEÇA 2, BASE NA NUVEM (Firestore). Ponto de encontro. Guarda estado das fábricas, fila de comandos, fila de aprovações, atividade e relatórios.

PEÇA 3, PONTE LOCAL. Serviço na máquina do diretor. Abre e executa as fábricas via agy, envia para a base tudo que a fábrica produz, e lê da base os comandos e as aprovações.

REGRA DE OURO DO FLUXO: o painel nunca fala direto com a fábrica. Painel escreve na base, ponte lê e executa. Ponte escreve na base, painel lê e mostra. É isso que permite comandar do celular.

## A.4 Modelo de dados
maquina: identificação da máquina, estado da ponte, visto por último.

fabrica: projeto, agente, modelo, estado, início, tempo decorrido, consumo.

Estados possíveis: em execução, aguardando aprovação, aguardando comando, concluída, falhou, ponte offline.

tarefa: tarefa delegada dentro de uma fábrica, com situação.

atividade: cada passo que a fábrica dá, em ordem de tempo.

comando: ordem escrita pelo diretor, com situação de entregue ou pendente.

aprovacao: pedido da fábrica, com o que quer fazer, por que precisa, impacto, o que será tocado, risco, origem e tempo parado. Resposta: aprovado, recusado, aprovado com observação.

relatorio: fechamento por tarefa e consolidado diário.

Nada de dado pessoal de terceiros trafega neste sistema.

## A.5 Catálogo funcional
F1 Visão geral das fábricas.

F2 Tela da fábrica, com atividade, tarefas, relatórios, alterações e caixa de comando.

F3 Fila de aprovações.

F4 Abertura de nova fábrica.

F5 Relatórios, fechamento por tarefa e diário.

F6 Indicadores de tempo e consumo.

F7 Configurações, projetos cadastrados e situação da ponte.

F8 Avisos no celular.

## A.6 Segurança obrigatória (regra dura)
A ponte NUNCA abre porta de entrada na máquina do diretor. Só conexão de saída. Qualquer solução que exija porta aberta, túnel de entrada ou endereço público apontando para a máquina é vetada.

Conta única. Só o e-mail do diretor entra. Dois fatores obrigatório. Regra do Firestore nega qualquer outro usuário.

A ponte tem segredo próprio de pareamento. Só ela lê e escreve a fila da sua máquina.

Todo comando e toda aprovação ficam registrados com hora e origem. Trilha não se apaga.

Nenhum segredo, chave ou credencial entra no código ou no repositório.

Não existe aprovação automática nesta versão.

## A.7 Gate de deploy
O hook PreToolUse nasce amarrado em .claude/settings.json ao scripts/gate-deploy.sh, cobrindo git push, deploy, firebase deploy e docker push. Sem flag em .claude/state/READY_*, bloqueia com exit 2. Teste obrigatório: push sem flag tem de ser bloqueado de fato. Nenhum agente contorna esse gate.

## A.8 Ondas de implantação
ONDA 1, ENXERGAR. Ponte instalada, base na nuvem, visão geral e tela da fábrica em modo leitura.

ONDA 2, COMANDAR E APROVAR. Caixa de comando, abrir e encerrar fábrica, fila de aprovação completa, aviso no celular. As duas saem juntas: sem aprovação o comando trava no primeiro pedido.

ONDA 3, RELATÓRIOS.

ONDA 4, INDICADORES.

ONDA 5, EVOLUÇÃO. Comandos salvos e estudo de mover a execução para máquina dedicada na nuvem.

## A.9 Plano B, obrigatório
As fábricas continuam rodando sobre as mesmas pastas de projeto, as mesmas regras e a mesma configuração usadas hoje pelo Antigravity. Se o painel sair do ar, o diretor abre a janela do Antigravity e segue sem perda.

Nada criado por este projeto pode alterar configuração existente do Antigravity na máquina. Só acrescentar, nunca modificar o que já está lá.

## A.10 Limitação conhecida e registrada
Enquanto a execução for local, o painel depende da máquina ligada e acordada. Se o computador dormir, as fábricas param mesmo com o painel acessível pelo celular. O painel precisa mostrar isso na tela com o indicador de ponte conectada ou ponte offline.

## A.11 Travessão PROIBIDO (regra permanente)
Nunca usar travessão em título, botão, rótulo, mensagem, descrição ou qualquer texto que o usuário lê na tela. Usar pontuação correta em português no lugar, vírgula, ponto ou dois pontos conforme a frase pedir. Não substituir mecanicamente por outro símbolo.

## A.12 Só o que a OST pede (regra permanente)
Escopo fechado. O que faltar, se PROPÕE ao diretor, não se constrói por conta própria.

## A.13 Validação visual do diretor (regra permanente)
Teste técnico verde não significa funcionalidade aprovada. Toda entrega com interface passa por validação visual do diretor antes de ser considerada concluída.

## A.14 A fábrica só volta com tudo pronto (regra permanente)
A fábrica não devolve o diretor a cada rodada por ajuste pequeno. Decide o detalhe miúdo, executa e volta com o relatório final. Interrompe apenas quando existe conflito de requisito, falta de informação essencial, mudança de regra de negócio, decisão arquitetural não definida, credencial que a fábrica não possui, ou risco acima do próprio escopo.

## A.15 Sempre dizer quem trabalhou e em quê (regra permanente)
Todo relatório diz qual agente fez cada parte.

## A.16 Relatório de fechamento (regra permanente)
Todo fechamento de tarefa traz: o que foi solicitado, o que foi feito, o que ficou faltando, decisões tomadas durante a execução, arquivos e áreas alteradas, problemas encontrados e próximo passo recomendado. Texto legível, não registro técnico bruto.
