/*
 * OST 13, prova sem navegador do chat, dos três pontinhos e do leitor de
 * relatório. Compila time.ts, tradutor.ts, relatorios.ts e formato.ts com o tsc
 * do próprio painel para a pasta desta rodada e roda contra casos montados.
 *
 * Uso, da raiz do repositório: node painel/testes/rodada-2026-11-24-233848-ost13-chat/prova.cjs
 * Saída: saida-da-prova.txt nesta mesma pasta. Nada fora desta pasta é escrito.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const aqui = __dirname;
const painel = path.resolve(aqui, '..', '..');
const saida = path.join(aqui, 'compilado');
const linhas = [];
const log = (t) => {
  linhas.push(t);
  console.log(t);
};

const tsc = path.join(painel, 'node_modules', 'typescript', 'bin', 'tsc');
const r = spawnSync(process.execPath, [tsc, '-p', path.join(aqui, 'tsconfig.prova.json')], { encoding: 'utf8' });
if (r.status !== 0) {
  console.error(r.stdout, r.stderr);
  process.exit(1);
}
/* O apelido @/ do painel vira caminho relativo na cópia compilada. */
const tradutorJs = path.join(saida, 'dados', 'tradutor.js');
fs.writeFileSync(tradutorJs, fs.readFileSync(tradutorJs, 'utf8').replace(/require\("@\/formato"\)/g, 'require("../formato")'));

const { montarTime, juntarSemRepetir } = require(path.join(saida, 'dados', 'time.js'));
const { traduzirPasso, traduzirComando, montarAtividade } = require(path.join(saida, 'dados', 'tradutor.js'));
const { blocosDoTexto, diaDeBrasilia, faixaDoDia, filtrarRelatorios, ordenarRelatorios, traduzirRelatorio } = require(
  path.join(saida, 'dados', 'relatorios.js')
);

const TIPOS_DA_CONVERSA = ['comando do diretor', 'fim de rodada', 'texto', 'agent_response', 'user_input'];
let falhas = 0;
function confere(nome, ok, detalhe) {
  if (!ok) falhas++;
  log(`${ok ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? `  (${detalhe})` : ''}`);
}

/* ---------- montagem dos passos, do jeito que a ponte grava ---------- */
const BASE = Date.UTC(2026, 10, 24, 12, 0, 0);
let relogio = 0;
let contador = 0;
function passo(campos) {
  const em = new Date(BASE + relogio++ * 1000).toISOString();
  return { id: `p${String(contador++).padStart(5, '0')}`, agente: null, em, anotadoEm: em, seq: contador, ...campos };
}
const ordem = (texto) => passo({ evento: 'UserPromptSubmit', tipo: 'comando do diretor', descricao: texto });
const ferramenta = (nome, agente = null) => passo({ evento: 'PostToolUse', tipo: 'ferramenta', ferramenta: nome, alvo: 'x.ts', agente });
const fimDeRodada = (resposta) => passo({ evento: 'Stop', tipo: 'fim de rodada', resposta });
const aviso = () => passo({ evento: 'Notification', tipo: 'aviso', descricao: 'Claude is waiting for your input' });
const fimDeAgenteSemNome = () => passo({ evento: 'SubagentStop', tipo: 'subagente', agente: null });

/* Simula o painel: janela recente de 200 pela hora, mais a conversa inteira
   pela consulta própria (where tipo in), mais os comandos do painel. */
function montar(docs, { estado = 'running', comandos = [], semConversa = false, agora } = {}) {
  const janela = [...docs].sort((a, b) => b.em.localeCompare(a.em)).slice(0, 200);
  const atividade = montarAtividade(janela, comandos, false);
  const conversa = semConversa
    ? undefined
    : [...docs.filter((d) => TIPOS_DA_CONVERSA.includes(d.tipo)).map(traduzirPasso), ...comandos.map(traduzirComando)];
  return montarTime({
    linhas: atividade.linhas,
    conversa,
    agentePrincipal: 'claude code',
    agentesDoProjeto: [{ nome: 'frontend', descricao: 'telas' }],
    estado,
    agora: agora ?? new Date(BASE + relogio * 1000 + 1000)
  });
}

/* ---------- caso 1: conversa longa, mais de 200 passos ---------- */
log('Caso 1. Conversa longa: 300 rodadas, cada uma com ordem, 3 ferramentas e resposta (1500 passos).');
relogio = 0;
const longa = [];
for (let i = 0; i < 300; i++) {
  longa.push(ordem(`ordem ${i}`), ferramenta('Read'), ferramenta('Edit'), ferramenta('Bash'), fimDeRodada(`resposta ${i}`));
}
const antes = montar(longa, { semConversa: true });
const depois = montar(longa);
confere('antes do conserto, a janela de 200 perde a conversa', antes.chat.length < 600, `${antes.chat.length} mensagens no chat`);
confere('agora o chat tem as 600 mensagens', depois.chat.length === 600, `${depois.chat.length} mensagens`);
confere('a primeira mensagem é a ordem 0, do diretor', depois.chat[0].de === 'diretor' && depois.chat[0].texto === 'ordem 0');
confere(
  'a última é a resposta 299, do coordenador',
  depois.chat[599].de === 'coordenador' && depois.chat[599].texto === 'resposta 299'
);
confere(
  'ordem e resposta alternam, em ordem de hora',
  depois.chat.every((m, i) => m.de === (i % 2 === 0 ? 'diretor' : 'coordenador'))
);
confere('sem passo repetido', new Set(depois.chat.map((m) => m.id)).size === 600);
confere('fábrica parada depois da última resposta: pontinho apagado', depois.coordenador.trabalhando === false);

/* ---------- caso 2: Stop, Notification, SubagentStop sem nome ---------- */
log('');
log('Caso 2. Fim de rodada seguido do aviso e do resumo automático, fábrica marcada em execução.');
relogio = 0;
const resumo = [ordem('faça a tela'), ferramenta('Edit'), fimDeRodada('pronto'), aviso(), fimDeAgenteSemNome()];
const t2 = montar(resumo, { estado: 'running' });
confere('pontinho apagado', t2.coordenador.trabalhando === false);
confere('nenhum agente aceso', t2.agentes.every((a) => !a.trabalhando));
confere('o aviso não entra no chat', t2.chat.length === 2, t2.chat.map((m) => m.de).join(', '));
/* O jeito antigo olhava só a última linha. */
confere(
  'a última linha é o fim de agente sem nome, que antes acendia',
  traduzirPasso(resumo[resumo.length - 1]).tipo === 'subagente'
);

/* ---------- caso 3: ordem sem resposta, fábrica em execução ---------- */
log('');
log('Caso 3. Ordem sem resposta com a fábrica em execução.');
relogio = 0;
const semResposta = [ordem('primeira'), fimDeRodada('feito'), aviso(), fimDeAgenteSemNome(), ordem('segunda')];
const t3 = montar(semResposta, { estado: 'running' });
confere('pontinho aceso pela ordem da mão', t3.coordenador.trabalhando === true);
const t3b = montar(semResposta, { estado: 'idle' });
confere('mesma conversa com a fábrica esperando comando: apagado', t3b.coordenador.trabalhando === false);
relogio = 0;
const soResposta = [ordem('primeira'), fimDeRodada('feito'), aviso()];
const comando = { id: 'c1', fabricaId: 'f', acao: 'comando', texto: 'pelo painel', situacao: 'pendente', criadoEm: new Date(BASE + 3600_000).toISOString() };
const t3c = montar(soResposta, { estado: 'running', comandos: [comando], agora: new Date(BASE + 3601_000) });
confere('pontinho aceso pela ordem do painel ainda sem resposta', t3c.coordenador.trabalhando === true);
confere('a ordem do painel aparece no chat como Você', t3c.chat[t3c.chat.length - 1].de === 'diretor' && t3c.chat[t3c.chat.length - 1].texto === 'pelo painel');
relogio = 0;
const trabalhando = [ordem('faça'), fimDeRodada('parcial'), ferramenta('Read')];
confere('passo do time depois da última resposta: aceso', montar(trabalhando).coordenador.trabalhando === true);

/* ---------- caso 4: a resposta sai do cartão ---------- */
log('');
log('Caso 4. A resposta fica no chat e sai do cartão do coordenador.');
relogio = 0;
const cartao = [ordem('arrume'), ferramenta('Read'), ferramenta('Agent'), ferramenta('Edit', 'frontend'), fimDeRodada('Arrumei a tela.')];
cartao[2].agenteChamado = 'frontend';
const t4 = montar(cartao);
const frases = t4.coordenador.acoes.map((a) => a.frase);
confere('o cartão do coordenador não tem "Respondeu"', !frases.includes('Respondeu'), frases.join(' | '));
confere('o cartão mostra o que ele fez: leu e passou trabalho', frases.includes('Leu') && frases.some((f) => f.startsWith('Passou trabalho para')));
confere('a resposta está no chat', t4.chat.some((m) => m.de === 'coordenador' && m.texto === 'Arrumei a tela.'));
confere('o agente frontend tem a ação dele no cartão dele', (t4.agentes.find((a) => a.nome === 'frontend')?.acoes ?? []).some((a) => a.frase === 'Alterou'));

/* ---------- caso 5: aviso automático nunca é "Você" ---------- */
log('');
log('Caso 5. Aviso automático do Claude Code entregue como prompt.');
relogio = 0;
const notificacao = [ordem('vai'), fimDeRodada('ok'), passo({ evento: 'UserPromptSubmit', tipo: 'comando do diretor', descricao: '<task-notification>tarefa terminou</task-notification>' }), fimDeRodada('visto')];
const t5 = montar(notificacao);
confere('o aviso não aparece como Você', t5.chat.filter((m) => m.de === 'diretor').length === 1);
confere('pontinho apagado depois da resposta ao aviso', t5.coordenador.trabalhando === false);

/* ---------- caso 6: fábrica aberta pelo painel ---------- */
log('');
log('Caso 6. Fábrica aberta pelo painel, passos do kit.');
relogio = 0;
const kit = (campos) => {
  const d = passo(campos);
  delete d.evento;
  return d;
};
const doPainel = [kit({ tipo: 'init' }), kit({ tipo: 'texto', descricao: 'Vou ler.' }), kit({ tipo: 'ferramenta', ferramenta: 'Read' })];
confere('texto seguido de ferramenta: aceso', montar(doPainel).coordenador.trabalhando === true);
doPainel.push(kit({ tipo: 'texto', descricao: 'Terminei.' }), kit({ tipo: 'fim', descricao: 'success' }));
const t6 = montar(doPainel);
confere('texto final e fim da rodada: apagado', t6.coordenador.trabalhando === false);
confere('as duas falas do coordenador estão no chat', t6.chat.filter((m) => m.de === 'coordenador').length === 2);

/* ---------- caso 7: corte do gancho ---------- */
log('');
log('Caso 7. Resposta cortada pelo gancho em 4000 caracteres.');
relogio = 0;
const t7 = montar([ordem('relatório'), fimDeRodada('x'.repeat(3990) + '[...cortado]')]);
confere('a mensagem diz que foi cortada na gravação', t7.chat[1].situacao === 'texto cortado na gravação');

/* ---------- caso 8: leitor de relatório ---------- */
log('');
log('Caso 8. Texto do fechamento em blocos, sem HTML.');
const fechamento = [
  '## O que foi feito',
  '**Frontend** mexeu no chat.',
  '1. Primeiro item',
  '2. Segundo item com `codigo`',
  '',
  '<script>alert(1)</script> e [link](https://exemplo.invalido)',
  '## O que ficou faltando',
  '- nada'
].join('\n');
const blocos = blocosDoTexto(fechamento);
confere('dois títulos', blocos.filter((b) => b.tipo === 'titulo').length === 2);
confere('negrito vira trecho forte', blocos[1].tipo === 'paragrafo' && blocos[1].trechos[0].forte === true && blocos[1].trechos[0].texto === 'Frontend');
confere('lista numerada guarda o número', blocos[2].tipo === 'item' && blocos[2].marca === '1.');
const script = blocos.find((b) => b.tipo === 'paragrafo' && b.trechos.some((t) => t.texto.includes('<script>')));
confere('o <script> continua texto puro, inteiro', Boolean(script) && script.trechos.map((t) => t.texto).join('') === '<script>alert(1)</script> e [link](https://exemplo.invalido)');
confere('nada some do texto: todo caractere visível está nos blocos', (() => {
  const juntado = blocos.map((b) => ('trechos' in b ? b.trechos.map((t) => t.texto).join('') : '')).join('');
  return ['O que foi feito', 'Frontend', 'Primeiro item', 'codigo', 'alert(1)', 'nada'].every((p) => juntado.includes(p));
})());

/* ---------- caso 9: dia de Brasília e filtro ---------- */
log('');
log('Caso 9. Dia de Brasília e filtros.');
confere('23h59 de Brasília ainda é o mesmo dia', diaDeBrasilia(new Date('2026-11-25T02:59:00Z')) === '2026-11-24');
confere('00h00 de Brasília já é o dia seguinte', diaDeBrasilia(new Date('2026-11-25T03:00:00Z')) === '2026-11-25');
const faixa = faixaDoDia('2026-11-24');
confere('a faixa começa à meia-noite de Brasília e cobre o diário atrasado', faixa.de.toISOString() === '2026-11-24T03:00:00.000Z' && faixa.ate.toISOString() === '2026-12-02T03:00:00.000Z');
const rels = [
  { id: 'a', tipo: 'fechamento', fabricaId: 'f1', texto: 'um', criadoEm: '2026-11-24T15:00:00Z', dia: '2026-11-24' },
  { id: 'b', tipo: 'diario', fabricaId: 'f1', texto: 'dois', criadoEm: '2026-11-26T10:00:00Z', dia: '2026-11-24', geradoAtrasado: true },
  { id: 'c', tipo: 'fechamento', fabricaId: 'f2', texto: 'tres', criadoEm: '2026-11-25T15:00:00Z', dia: '2026-11-25' }
].map(traduzirRelatorio);
const ordenados = ordenarRelatorios(rels);
confere('mais novo em cima', ordenados.map((x) => x.id).join('') === 'bca');
confere('filtro por dia acha o diário gerado depois', filtrarRelatorios(ordenados, { dia: '2026-11-24' }).map((x) => x.id).join('') === 'ba');
confere('filtro por fábrica', filtrarRelatorios(ordenados, { fabricaId: 'f2' }).map((x) => x.id).join('') === 'c');
confere('diário sem consumo diz não medido (nulo, não zero)', rels[1].tokensDoDia === null);

log('');
log(falhas ? `${falhas} verificação(ões) falharam.` : 'Todas as verificações passaram.');
fs.writeFileSync(path.join(aqui, 'saida-da-prova.txt'), linhas.join('\n') + '\n');
process.exit(falhas ? 1 : 0);
