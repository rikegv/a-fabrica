var F = window.Fabricas, h = React.createElement, useState = React.useState;
function noop() {}

var FACTORIES = [
  { id: 'vagas', project: 'Portal de Vagas', agent: 'Claude Code', model: 'Opus', state: 'approval', doing: 'Quer rodar a migração que cria a tabela de documentos no banco de homologação.', elapsed: '1h 12min', usage: '412 mil tokens', pending: '1 pedido parado há 18 min', folder: '~/projetos/portal-vagas', agents: 3, tasksDone: 7 },
  { id: 'folha', project: 'Folha Integração', agent: 'Claude Code', model: 'Sonnet', state: 'failed', doing: 'Parou no passo 7: a API de ponto devolveu erro 502 três vezes.', elapsed: '2h 05min', usage: '1,2 mi tokens', folder: '~/projetos/folha-integracao', agents: 2, tasksDone: 4 },
  { id: 'triagem', project: 'Triagem Inteligente', agent: 'Claude Code', model: 'Sonnet', state: 'running', doing: 'Escrevendo testes do fluxo de triagem de currículos.', elapsed: '34min', usage: '96 mil tokens', folder: '~/projetos/triagem', agents: 2, tasksDone: 3 },
  { id: 'app', project: 'App do Colaborador', agent: 'Claude Code', model: 'Opus', state: 'running', doing: 'Refatorando a tela de holerite para carregar em uma chamada só.', elapsed: '52min', usage: '230 mil tokens', folder: '~/projetos/app-colaborador', agents: 1, tasksDone: 5 },
  { id: 'base', project: 'Base de Conhecimento', agent: 'Claude Code', model: 'Haiku', state: 'running', doing: 'Gerando resumos dos 40 artigos mais lidos.', elapsed: '18min', usage: '44 mil tokens', folder: '~/projetos/base-conhecimento', agents: 1, tasksDone: 2 },
  { id: 'site', project: 'Site Institucional', agent: 'Claude Code', model: 'Haiku', state: 'idle', doing: 'Terminou a revisão de textos. Esperando a próxima ordem.', elapsed: '48min', usage: '61 mil tokens', folder: '~/projetos/site', agents: 1, tasksDone: 2 }
];

var APPROVALS = [
  { id: 'a1', factory: 'vagas', risk: 'high', project: 'Portal de Vagas', task: 'Upload de documentos', waiting: '18 min', stale: true, title: 'Rodar a migração que cria a tabela documentos_candidato no banco de homologação', why: 'O upload novo precisa guardar tipo, validade e situação de cada documento. Sem a tabela, os testes de ponta a ponta não passam.', impact: 'Homologação fica fora do ar por cerca de 1 min. Nada é apagado. Reversível com a migração de volta.', touches: ['db/migrations/0042_documentos.sql', 'banco: homologacao', 'src/admissao/documentos.ts'] },
  { id: 'a2', factory: 'triagem', risk: 'low', project: 'Triagem Inteligente', task: 'Triagem de currículos', waiting: '3 min', title: 'Instalar a biblioteca pdf-parse como dependência de desenvolvimento', why: 'Os testes precisam ler currículos em PDF de exemplo.', impact: 'Só afeta o ambiente de testes.', touches: ['package.json'] },
  { id: 'a3', factory: 'folha', risk: 'medium', project: 'Folha Integração', task: 'Conector de ponto', waiting: '1 min', title: 'Repetir a chamada à API de ponto com tempo limite de 30 s', why: 'A API devolveu 502 três vezes seguidas. Com tempo maior, a chamada costuma passar.', impact: 'Pode gerar até 3 chamadas extras ao fornecedor do ponto.', touches: ['src/ponto/cliente.ts'] }
];

var HISTORY = [
  { decision: 'noted', title: 'Apagar a pasta de rascunhos antigos', decidedAt: 'hoje, 10:42', note: 'Pode apagar, mas mantenha os de março.' },
  { decision: 'approved', title: 'Criar branch feature/upload-documentos', decidedAt: 'hoje, 09:58' },
  { decision: 'approved', title: 'Atualizar o React no App do Colaborador', decidedAt: 'hoje, 09:31' },
  { decision: 'rejected', title: 'Enviar e-mail de teste para a base de candidatos', decidedAt: 'ontem, 17:15', note: 'Nunca dispare para a base real.' },
  { decision: 'approved', title: 'Rodar a suíte completa de testes de integração', decidedAt: 'ontem, 16:40' },
  { decision: 'approved', title: 'Publicar o site em homologação', decidedAt: 'ontem, 15:02' },
  { decision: 'rejected', title: 'Apagar logs com mais de 7 dias no servidor', decidedAt: 'ontem, 11:20', note: 'Guarde 30 dias.' },
  { decision: 'approved', title: 'Instalar dependência zod no Portal de Vagas', decidedAt: 'sexta, 18:05' },
  { decision: 'noted', title: 'Reescrever o README do conector de ponto', decidedAt: 'sexta, 14:12', note: 'Em português.' }
];

var TIMELINE = [
  { time: '14:32:08', text: 'Escrevendo teste do upload com arquivo acima de 10 MB', detail: 'tests/admissao/upload.spec.ts' },
  { time: '14:31:40', kind: 'approval', text: 'Pediu aprovação para rodar a migração 0042' },
  { time: '14:29:12', kind: 'error', text: 'Teste falhou: tabela documentos_candidato não existe', detail: 'npm test -- upload' },
  { time: '14:27:55', text: 'Criou o serviço de validação de documentos', detail: 'src/admissao/documentos.ts' },
  { time: '14:24:30', text: 'Leu o formulário de admissão e mapeou 18 campos', detail: 'src/admissao/formulario.tsx' },
  { time: '14:20:03', kind: 'done', text: 'Tarefa concluída: mapear campos do formulário de admissão' },
  { time: '14:12:47', text: 'Subagente de testes começou a escrever os casos de upload' }
];

var TASKS = [
  { state: 'approval', title: 'Criar tabela de documentos', agent: 'Fábrica principal', elapsed: '18min' },
  { state: 'running', title: 'Escrever testes do upload de documentos', agent: 'Subagente de testes', elapsed: '12min' },
  { state: 'running', title: 'Validar formatos de arquivo aceitos', agent: 'Subagente de validação', elapsed: '6min' },
  { state: 'done', title: 'Mapear campos do formulário de admissão', agent: 'Subagente de leitura', elapsed: '9min' },
  { state: 'done', title: 'Criar serviço de validação de documentos', agent: 'Fábrica principal', elapsed: '21min' },
  { state: 'done', title: 'Revisar nomes das rotas de upload', agent: 'Subagente de revisão', elapsed: '4min' }
];

var CHANGES = [
  { kind: 'added', path: 'db/migrations/0042_documentos.sql', add: 38 },
  { kind: 'modified', path: 'src/admissao/documentos.ts', add: 112, del: 24 },
  { kind: 'added', path: 'tests/admissao/upload.spec.ts', add: 146 },
  { kind: 'modified', path: 'src/admissao/formulario.tsx', add: 41, del: 18 },
  { kind: 'modified', path: 'src/api/rotas.ts', add: 9, del: 3 },
  { kind: 'removed', path: 'src/admissao/legado/upload-antigo.ts', del: 87 },
  { kind: 'modified', path: 'package.json', add: 2 }
];

var REPORT_BODY = [
  h('p', { key: 1 }, 'A fábrica terminou o fluxo de upload de documentos do Portal de Vagas e deixou dois pontos para você decidir antes de seguir para produção. O dia rendeu sete tarefas concluídas, uma aprovação pendente e nenhuma falha que não tenha sido resolvida.'),
  h('h2', { key: 2 }, 'O que ficou pronto'),
  h('ul', { key: 3 }, h('li', null, 'Validação de tipo e validade para RG, CPF, CNH e comprovante de residência, com mensagens claras quando o arquivo não serve.'), h('li', null, 'Limite de 10 MB por arquivo, com compressão automática de imagens acima de 4 MB antes do envio.'), h('li', null, 'Testes de ponta a ponta do upload, 23 casos, todos passando em homologação depois da migração.'), h('li', null, 'Remoção do upload antigo, que não era chamado por nenhuma rota desde agosto.')),
  h('h2', { key: 4 }, 'O que precisa de você'),
  h('p', { key: 5 }, 'A migração ', h('code', null, '0042_documentos'), ' foi aprovada e rodou em homologação. Para produção ela precisa de uma janela sem acesso de candidatos, porque cria um índice na tabela de inscrições. Pelo volume atual, o índice leva cerca de quatro minutos para ficar pronto.'),
  h('p', { key: 6 }, 'O segundo ponto é de produto: candidatos que enviam a CNH no lugar do RG hoje são aceitos. A fábrica deixou isso configurável e desligado por padrão, até você decidir se a CNH vale como documento de identidade no processo de admissão.'),
  h('h2', { key: 7 }, 'Decisões que a fábrica tomou sozinha'),
  h('p', { key: 8 }, 'Nenhuma delas mexe em dado real ou em produção. Ficam registradas aqui para você revisar quando puder.'),
  h('ul', { key: 9 }, h('li', null, 'Usou a biblioteca de validação que o projeto já tinha, em vez de instalar uma nova.'), h('li', null, 'Separou o serviço de documentos em três arquivos menores, porque o original passava de 600 linhas.'), h('li', null, 'Padronizou as mensagens de erro em português, no tom que o resto do portal já usa.')),
  h('h2', { key: 10 }, 'Números do dia'),
  h('p', { key: 11 }, 'Três horas e quarenta e dois minutos de execução, 412 mil tokens consumidos e três agentes trabalhando ao mesmo tempo no pico, entre 10h e 11h. O consumo ficou 8% acima da média dos últimos sete dias, puxado pelos testes de ponta a ponta, que rodaram quatro vezes até passar.'),
  h('h2', { key: 12 }, 'Próximos passos sugeridos'),
  h('ol', { key: 13 }, h('li', null, 'Marcar a janela de manutenção para rodar a migração em produção.'), h('li', null, 'Decidir sobre a CNH como documento de identidade.'), h('li', null, 'Liberar a fábrica para começar a tela de acompanhamento do candidato, que depende deste upload.')),
  h('p', { key: 14 }, 'Se preferir, a fábrica pode preparar o roteiro da janela de manutenção com os comandos exatos e o plano de volta. Basta mandar a ordem pela caixa de comando dela.')
];

var REPORTS = [
  { id: 'r0', daily: true, title: 'Consolidado do dia', meta: 'Domingo, 11 de outubro · 6 fábricas · 7h 18min', project: 'Todos' },
  { id: 'r1', title: 'Fechamento: upload de documentos', meta: 'Domingo, 11 de outubro · Portal de Vagas · 3h 42min', project: 'Portal de Vagas', factory: 'vagas' },
  { id: 'r2', title: 'Falha no conector de ponto', meta: 'Domingo, 11 de outubro · Folha Integração · 2h 05min', project: 'Folha Integração', factory: 'folha' },
  { id: 'r3', title: 'Testes da triagem, parcial', meta: 'Domingo, 11 de outubro · Triagem Inteligente · 34min', project: 'Triagem Inteligente', factory: 'triagem' },
  { id: 'r4', title: 'Revisão de textos do site', meta: 'Domingo, 11 de outubro · Site Institucional · 48min', project: 'Site Institucional', factory: 'site' },
  { id: 'r5', title: 'Consolidado do dia', meta: 'Sábado, 10 de outubro · 4 fábricas · 5h 02min', project: 'Todos', daily: true },
  { id: 'r6', title: 'Holerite em uma chamada', meta: 'Sábado, 10 de outubro · App do Colaborador · 1h 40min', project: 'App do Colaborador', factory: 'app' },
  { id: 'r7', title: 'Resumos da base, lote 1', meta: 'Sexta, 9 de outubro · Base de Conhecimento · 55min', project: 'Base de Conhecimento', factory: 'base' }
];

var SAVED = [
  { name: 'Revisar e corrigir testes', text: 'Rode a suíte de testes, corrija o que falhar e me traga um resumo do que mudou.' },
  { name: 'Fechamento do dia', text: 'Feche o dia: escreva o relatório do que ficou pronto, o que precisa de mim e os próximos passos.' },
  { name: 'Revisão de código', text: 'Revise as alterações da última semana e aponte riscos, sem mudar nada.' },
  { name: 'Atualizar dependências', text: 'Atualize as dependências com segurança, uma por vez, rodando os testes entre cada uma.' }
];

var DAYS = [['28/9', 1.2], ['29/9', 1.8], ['30/9', 1.5], ['1/10', 2.1], ['2/10', 1.9], ['3/10', 0.6], ['4/10', 0.4], ['5/10', 2.2], ['6/10', 2.6], ['7/10', 2.0], ['8/10', 2.9], ['9/10', 2.3], ['10/10', 1.7], ['11/10', 2.4]];
