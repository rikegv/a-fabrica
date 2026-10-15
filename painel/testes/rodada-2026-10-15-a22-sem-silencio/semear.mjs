/*
 * RODADA DA ONDA 2, OST 7 Bloco 2, §A.17 e §A.19: pasta propria, com data e
 * hora, e nada reaproveitado de rodada anterior.
 *
 * EMULADOR, nao a base real. Emulador PROPRIO desta rodada, subido com
 * firebase.emulador.json desta pasta: Firestore 127.0.0.1:8399 e Authentication
 * 127.0.0.1:9399. Em portas proprias para nao colidir com o emulador da ponte,
 * que nesta noite ocupa 8099 e 9199, e para a base da prova do painel nascer
 * limpa: assim o que aparece em comandos foi o painel que escreveu, e nao sobra
 * duvida.
 *
 * Semeia o emulador do Firestore com documentos no formato exato do contrato
 * das tres pecas, para provar o painel ao vivo. Nada disto vai para a nuvem e
 * nada disto entra no codigo do painel: o painel nao tem dado embutido.
 *
 * Uso:
 *   node semear.mjs ponte-viva     heartbeat de agora, fabricas e pedidos
 *   node semear.mjs ponte-velha    heartbeat de 5 minutos atras, §A.10
 */

const PROJETO = 'a-fabrica-soulan';
const BASE = `http://127.0.0.1:8399/v1/projects/${PROJETO}/databases/(default)/documents`;

function valor(v) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: campos(v) } };
}

function campos(objeto) {
  const saida = {};
  for (const [k, v] of Object.entries(objeto)) saida[k] = valor(v);
  return saida;
}

async function escrever(caminho, id, dados) {
  const resposta = await fetch(`${BASE}/${caminho}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: campos(dados) })
  });
  if (resposta.ok) return;
  if (resposta.status === 409) {
    const patch = await fetch(`${BASE}/${caminho}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields: campos(dados) })
    });
    if (!patch.ok) throw new Error(`${caminho}/${id}: ${patch.status} ${await patch.text()}`);
    return;
  }
  throw new Error(`${caminho}/${id}: ${resposta.status} ${await resposta.text()}`);
}

const agora = Date.now();
const atras = (ms) => new Date(agora - ms);
const MIN = 60_000;
const H = 60 * MIN;

const modo = process.argv[2] ?? 'ponte-viva';
const heartbeat = modo === 'ponte-velha' ? atras(5 * MIN) : atras(3_000);

await escrever('maquinas', 'maquina-do-diretor', {
  maquinaId: 'maquina-do-diretor',
  nome: 'notebook do diretor',
  estadoPonte: 'online',
  vistoPorUltimo: heartbeat,
  versaoPonte: '0.9.4',
  pareadoEm: atras(3 * H)
});

if (modo === 'ponte-velha') {
  console.log('Heartbeat envelhecido para 5 minutos atras.');
  process.exit(0);
}

const fabricas = [
  {
    id: 'fab-portal',
    projeto: 'Portal de Vagas',
    pasta: '~/projetos/portal-de-vagas',
    modelo: 'claude-opus-4-6',
    estado: 'aguardando aprovacao',
    inicio: atras(H + 12 * MIN),
    tempoDecorridoMs: H + 12 * MIN,
    total: 412_000
  },
  {
    id: 'fab-folha',
    projeto: 'Folha Integração',
    pasta: '~/projetos/folha-integracao',
    modelo: 'claude-sonnet-4-6',
    estado: 'em execucao',
    inicio: atras(2 * H + 41 * MIN),
    tempoDecorridoMs: 2 * H + 41 * MIN,
    total: 2_430_000
  },
  {
    id: 'fab-app',
    projeto: 'App do Colaborador',
    pasta: '~/projetos/app-do-colaborador',
    modelo: 'claude-opus-4-6',
    estado: 'aguardando aprovacao',
    inicio: atras(34 * MIN),
    tempoDecorridoMs: 34 * MIN,
    total: 188_000
  },
  {
    id: 'fab-triagem',
    projeto: 'Triagem Inteligente',
    pasta: '~/projetos/triagem-inteligente',
    modelo: 'claude-sonnet-4-6',
    estado: 'falhou',
    inicio: atras(3 * H + 8 * MIN),
    tempoDecorridoMs: 3 * H + 8 * MIN,
    total: 905_000
  },
  {
    id: 'fab-base',
    projeto: 'Base de Conhecimento',
    pasta: '~/projetos/base-de-conhecimento',
    modelo: 'claude-haiku-4-6',
    estado: 'aguardando comando',
    inicio: atras(26 * MIN),
    tempoDecorridoMs: 26 * MIN,
    total: 74_000,
    /* Pausada e campo, nao estado: §A.4 fecha a lista de estados e a fabrica
       pausada fica em aguardando comando. Quem escreve isto e a ponte. */
    pausada: true
  },
  {
    id: 'fab-site',
    projeto: 'Site Institucional',
    pasta: '~/projetos/site-institucional',
    modelo: 'claude-haiku-4-6',
    estado: 'concluida',
    inicio: atras(5 * H),
    tempoDecorridoMs: 4 * H + 2 * MIN,
    total: 243_000
  },
  {
    id: 'fab-financeiro',
    projeto: 'Painel Financeiro',
    pasta: '~/projetos/painel-financeiro',
    modelo: 'claude-sonnet-4-6',
    estado: 'em execucao',
    inicio: atras(18 * MIN),
    tempoDecorridoMs: 18 * MIN,
    total: 61_000
  }
];

for (const f of fabricas) {
  await escrever('fabricas', f.id, {
    fabricaId: f.id,
    maquinaId: 'maquina-do-diretor',
    conversationId: 'conversa-' + f.id,
    projeto: f.projeto,
    pasta: f.pasta,
    agente: 'Claude Code',
    modelo: f.modelo,
    estado: f.estado,
    pausada: f.pausada === true,
    origem: 'mao',
    inicio: f.inicio,
    tempoDecorridoMs: f.tempoDecorridoMs,
    consumo: {
      inputTokens: Math.round(f.total * 0.6),
      outputTokens: Math.round(f.total * 0.25),
      thinkingTokens: Math.round(f.total * 0.1),
      cacheReadTokens: Math.round(f.total * 0.05),
      totalTokens: f.total
    },
    atualizadoEm: atras(4_000)
  });
}

const passos = [
  {
    seq: 48,
    tipo: 'tool',
    estado: 'ACTIVE',
    ferramenta: 'Bash',
    toolInfo: { name: 'Bash', parameters: { command: 'npx prisma migrate status' } },
    em: atras(2 * MIN)
  },
  {
    seq: 47,
    tipo: 'agent_response',
    estado: 'DONE',
    textoDelta: 'Preparou a migração 0042 e separou o que muda em cada tabela.',
    em: atras(6 * MIN)
  },
  {
    seq: 46,
    tipo: 'tool',
    estado: 'ERROR',
    ferramenta: 'Bash',
    toolInfo: { name: 'Bash', parameters: { command: 'npm test -- documentos' }, error: 'exit 1' },
    em: atras(9 * MIN)
  },
  { seq: 45, tipo: 'checkpoint', estado: 'DONE', em: atras(14 * MIN) },
  {
    seq: 44,
    tipo: 'agent_response',
    estado: 'DONE',
    textoDelta: 'Escreveu o serviço de upload de documentos do candidato.',
    em: atras(21 * MIN)
  },
  {
    seq: 43,
    tipo: 'user_input',
    estado: 'DONE',
    textoDelta: 'Implemente o upload de documentos e me peça aprovação antes de mexer no banco.',
    em: atras(H + 10 * MIN)
  }
];

for (const p of passos) {
  await escrever('fabricas/fab-portal/atividade', String(p.seq), {
    seq: p.seq,
    stepIndex: p.seq,
    tipo: p.tipo,
    estado: p.estado,
    ferramenta: p.ferramenta ?? null,
    textoDelta: p.textoDelta ?? null,
    toolInfo: p.toolInfo ?? null,
    consumoParcial: null,
    em: p.em
  });
}

const tarefas = [
  { id: 't1', titulo: 'Subir o upload de documentos do candidato', situacao: 'em andamento', criadaEm: atras(H) },
  { id: 't2', titulo: 'Rodar a migração 0042 em homologação', situacao: 'em andamento', criadaEm: atras(40 * MIN) },
  { id: 't3', titulo: 'Escrever os testes do fluxo de triagem', situacao: 'concluida', criadaEm: atras(2 * H) },
  { id: 't4', titulo: 'Corrigir o formato do CPF no cadastro', situacao: 'falhou', criadaEm: atras(3 * H) }
];

for (const t of tarefas) {
  await escrever('fabricas/fab-portal/tarefas', t.id, {
    tarefaId: t.id,
    titulo: t.titulo,
    situacao: t.situacao,
    criadaEm: t.criadaEm,
    atualizadaEm: atras(5 * MIN)
  });
}

const pedidos = [
  {
    id: 'ap-1',
    fabricaId: 'fab-portal',
    criadoEm: atras(18 * MIN),
    situacao: 'pendente',
    pacote: {
      oQue: { valor: 'Rodar a migração 0042, que cria a tabela documentos_do_candidato', origem: 'fato' },
      resumo: { valor: 'Migração no banco de homologação', origem: 'fato' },
      tarefa: { valor: 'Rodar a migração 0042 em homologação', origem: 'fato' },
      fabrica: { valor: 'Portal de Vagas', origem: 'fato' },
      ferramenta: { valor: 'Bash: npx prisma migrate status', origem: 'fato' },
      agenteDisse: { valor: 'Preciso aplicar a migração para seguir com o upload.', origem: 'fato' },
      porQue: { valor: 'Sem a tabela, o upload não tem onde gravar o arquivo do candidato.', origem: 'ponte' },
      impacto: {
        valor: 'Pior caso: a tabela nasce errada em homologação. É reversível com a migração de volta.',
        origem: 'ponte'
      },
      oQueSeraTocado: {
        valor: ['prisma/migrations/0042_documentos.sql', 'banco: homologacao.documentos_do_candidato'],
        origem: 'fato mais leitura da ponte'
      },
      risco: { valor: 'medio', origem: 'ponte' },
      tempoParadoMs: { valor: 18 * MIN, origem: 'fato' }
    }
  },
  {
    id: 'ap-2',
    fabricaId: 'fab-app',
    criadoEm: atras(4 * MIN),
    situacao: 'pendente',
    pacote: {
      oQue: { valor: 'Apagar a pasta de cache do build antes de recompilar o app', origem: 'fato' },
      resumo: { valor: 'Limpeza de cache do build', origem: 'fato' },
      tarefa: { valor: 'Recompilar o app do colaborador', origem: 'fato' },
      fabrica: { valor: 'App do Colaborador', origem: 'fato' },
      agenteDisse: { valor: 'O build está pegando artefato velho.', origem: 'fato' },
      porQue: { valor: 'O build falha com artefato antigo na pasta de cache.', origem: 'ponte' },
      impacto: { valor: 'Pior caso: o próximo build demora mais. Reversível, o cache se refaz.', origem: 'ponte' },
      oQueSeraTocado: { valor: ['~/projetos/app-do-colaborador/.cache'], origem: 'fato mais leitura da ponte' },
      risco: { valor: 'baixo', origem: 'ponte' },
      tempoParadoMs: { valor: 4 * MIN, origem: 'fato' }
    }
  },
  {
    id: 'ap-3',
    fabricaId: 'fab-folha',
    criadoEm: atras(9 * MIN),
    situacao: 'pendente',
    pacote: {
      oQue: { valor: 'Instalar a biblioteca de leitura de planilha no projeto', origem: 'fato' },
      resumo: { valor: 'Dependência nova no projeto', origem: 'fato' },
      ferramenta: { valor: 'Bash: npm install xlsx', origem: 'fato' },
      tarefa: { valor: 'Ler a planilha da folha', origem: 'fato' },
      fabrica: { valor: 'Folha Integração', origem: 'fato' },
      agenteDisse: { valor: 'A planilha da folha vem em xlsx e preciso de um leitor.', origem: 'fato' },
      porQue: { valor: 'Sem o leitor, a fábrica não abre a planilha da folha.', origem: 'ponte' },
      impacto: { valor: 'Pior caso: uma dependência a mais no projeto. Reversível.', origem: 'ponte' },
      oQueSeraTocado: { valor: ['package.json', 'package-lock.json'], origem: 'fato mais leitura da ponte' },
      risco: { valor: 'baixo', origem: 'ponte' },
      tempoParadoMs: { valor: 9 * MIN, origem: 'fato' }
    }
  },
  {
    id: 'ap-0',
    fabricaId: 'fab-folha',
    criadoEm: atras(2 * H),
    situacao: 'respondida',
    resposta: 'aprovado',
    respondidoEm: atras(H + 50 * MIN),
    respondidoPor: 'henrique.vieira@soulan.com.br',
    pacote: {
      oQue: { valor: 'Instalar a biblioteca de leitura de planilha', origem: 'fato' },
      fabrica: { valor: 'Folha Integração', origem: 'fato' },
      porQue: { valor: 'A planilha da folha vem em xlsx.', origem: 'ponte' },
      impacto: { valor: 'Pior caso: dependência a mais no projeto. Reversível.', origem: 'ponte' },
      oQueSeraTocado: { valor: ['package.json'], origem: 'fato mais leitura da ponte' },
      risco: { valor: 'baixo', origem: 'ponte' },
      tempoParadoMs: { valor: 3 * MIN, origem: 'fato' }
    }
  }
];

for (const p of pedidos) {
  await escrever('aprovacoes', p.id, {
    aprovacaoId: p.id,
    fabricaId: p.fabricaId,
    maquinaId: 'maquina-do-diretor',
    pacote: p.pacote,
    situacao: p.situacao,
    criadoEm: p.criadoEm,
    origem: 'ponte da maquina do diretor',
    resposta: p.resposta ?? null,
    observacao: null,
    respondidoEm: p.respondidoEm ?? null,
    respondidoPor: p.respondidoPor ?? null
  });
}

console.log(
  `Semeado: 1 maquina, ${fabricas.length} fabricas, ${passos.length} passos, ${tarefas.length} tarefas, ${pedidos.length} aprovacoes.`
);
