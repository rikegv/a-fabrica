// prova-relatorios.ts, OST 13: fechamento, diario, P1, P2 e consumo por dia.
//
// Sem base: tudo que fala com o Firestore fica de fora, e o que e regra fica em
// funcao pura ou com porta injetada. A ultima parte abre uma fabrica DE VERDADE
// pelo kit do Claude Code, com portao que nega tudo, para ver a resposta final do
// agente principal chegar ao fim da rodada.
//
// Nada aqui imprime texto de transcricao: so tamanho, grupos e veredito.
//
// Uso: npm run prova:relatorios
//      PONTE_SEM_CLAUDE=1 pula a fabrica de verdade
//      PONTE_TRANSCRICAO_OST12=<caminho .jsonl> troca a transcricao de calibragem

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RODADA =
  process.env['PONTE_RODADA'] ?? join(AQUI, '..', '..', 'testes-ost13', `rodada-${selo()}-relatorios`);

// Pasta local da ponte e fila DENTRO da rodada, §A.19, antes de importar a ponte.
if (process.env['PONTE_RELATORIOS_FILHO'] !== '1') {
  mkdirSync(RODADA, { recursive: true });
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PONTE_RELATORIOS_FILHO: '1',
      PONTE_RODADA: RODADA,
      PONTE_PASTA_LOCAL: join(RODADA, 'ponte-local'),
      PONTE_PASTA_FILA_GANCHOS: join(RODADA, 'ponte-local'),
    },
  });
  process.exit(r.status ?? 1);
}

const R = await import('../relatorios.js');
const RB = await import('../relatoriosBase.js');
const T = await import('../transcricao.js');
const { traduzir } = await import('../ganchos.js');
const { lerAgentesDoProjeto, acharPastaDeAgentes } = await import('../personas.js');

const SAIDA = join(RODADA, 'saida.txt');
let erros = 0;
function reg(linha: string): void {
  console.log(linha);
  appendFileSync(SAIDA, `${linha}\n`, 'utf8');
}
function conferir(ok: boolean, rotulo: string, detalhe: string): void {
  if (!ok) erros++;
  reg(`  ${ok ? 'PASSOU' : 'FALHOU'} ${rotulo}: ${detalhe}`);
}
const TRAVESSAO = /[\u2014\u2013]/;

reg(`prova dos relatorios, OST 13, ${new Date().toISOString()}`);
reg(`rodada: ${RODADA}`);

// ---------------------------------------------------------------------------
reg('');
reg('PARTE 1, criterio do fechamento com os tres textos reais da OST 12');
const TRANSCRICAO =
  process.env['PONTE_TRANSCRICAO_OST12'] ??
  join(homedir(), '.claude', 'projects', 'C--Users-Henrique-a-fabrica-painel', '505e8cbc-62a5-4fdc-b587-868cacf3cec0.jsonl');
const SID_REAL = '505e8cbc-62a5-4fdc-b587-868cacf3cec0';

/** Texto da mensagem principal cujo timestamp comeca com o prefixo. So em memoria. */
function textoReal(prefixo: string): string | null {
  if (!existsSync(TRANSCRICAO)) return null;
  const partes: string[] = [];
  for (const l of readFileSync(TRANSCRICAO, 'utf8').split('\n')) {
    if (l.length === 0) continue;
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(l) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (o['type'] !== 'assistant' || o['isSidechain'] === true) continue;
    if (typeof o['timestamp'] !== 'string' || !o['timestamp'].startsWith(prefixo)) continue;
    const c = (o['message'] as { content?: unknown[] } | undefined)?.content ?? [];
    for (const b of c) {
      const bb = b as { type?: unknown; text?: unknown };
      if (bb.type === 'text' && typeof bb.text === 'string') partes.push(bb.text);
    }
  }
  return partes.length > 0 ? partes.join('\n') : null;
}

const real0144 = textoReal('2026-11-25T01:44:41');
const real0136 = textoReal('2026-11-25T01:36:34');
const real0209 = textoReal('2026-11-25T02:09:58');
conferir(real0144 !== null && real0136 !== null && real0209 !== null, 'os tres textos reais existem na transcricao', `transcricao ${TRANSCRICAO.replace(homedir(), '~')}`);
if (real0144 !== null) {
  const v = R.avaliarFechamento(real0144);
  conferir(real0144.length === 5208, 'o fechamento real tem 5208 caracteres', `${real0144.length}`);
  conferir(v.fechamento, '01:44:41, o fechamento da OST 12, PASSA', `grupos ${v.marcas.join(', ')}`);
}
if (real0136 !== null) {
  // Caso esperado VERDADEIRO, decisao do coordenador na OST 13: a mensagem das
  // 01:36 abre com "A OST 12 esta fechada" e tem quatro titulos (o que foi
  // feito, decisoes que tomei, o que ficou faltando e "Quem trabalhou:"), entao
  // e fechamento pelo criterio, e o criterio fica como esta.
  const v = R.avaliarFechamento(real0136);
  conferir(
    v.fechamento && v.marcas.join(',') === 'FEITO,FALTA,DECISOES,QUEM',
    '01:36:34, abre com "A OST 12 esta fechada" e tem quatro titulos, PASSA',
    `grupos ${v.marcas.join(', ')}, ${v.motivo}`
  );
}
if (real0209 !== null) {
  const v = R.avaliarFechamento(real0209);
  conferir(!v.fechamento, '02:09:58, a parada da Onda 0, NAO passa', `grupos ${v.marcas.join(', ') || 'nenhum'}, ${v.motivo}`);
}

reg('');
reg('PARTE 2, criterio com casos falsos e formas de titulo');
{
  const bom = [
    '## O que foi solicitado',
    'x',
    '**O que foi feito:**',
    '1. coisa',
    '3. **Decisões tomadas durante a execução:** nenhuma',
    '### O que ficou faltando',
    '- prova no celular',
    '- validação visual',
    '**Próximo passo recomendado:** validar',
  ].join('\n');
  const vb = R.avaliarFechamento(bom);
  conferir(vb.fechamento, 'titulos com #, **, numero e forma longa do §A.16', `grupos ${vb.marcas.join(', ')}`);
  const meio = 'Eu disse o que foi feito, o que ficou faltando, as decisões tomadas e os arquivos alterados, tudo no meio da frase.';
  conferir(!R.avaliarFechamento(meio).fechamento, 'mencao no meio de frase nao conta', R.avaliarFechamento(meio).motivo);
  const frase = 'O que falta é pouco, so a prova.\nO que foi feito ontem foi bom.\nDecisões: nenhuma\nArquivos alterados: nenhum';
  const vf = R.avaliarFechamento(frase);
  conferir(!vf.fechamento, 'titulo seguido de mais palavras na mesma frase nao conta', `grupos ${vf.marcas.join(', ') || 'nenhum'}`);
  const parcial = '## O que foi feito\nx\n## O que ficou faltando\ny\n## Decisões\nz';
  conferir(!R.avaliarFechamento(parcial).fechamento, 'tres grupos nao bastam', R.avaliarFechamento(parcial).motivo);
  const aviso = `${bom}\n\n<task-notification>\n<task-id>x</task-id>\n</task-notification>`;
  conferir(!R.avaliarFechamento(aviso).fechamento, 'task-notification no FIM do texto exclui o texto inteiro', R.avaliarFechamento(aviso).motivo);
  const lembrete = `Texto\n<system-reminder>\n${bom}\n</system-reminder>`;
  conferir(!R.avaliarFechamento(lembrete).fechamento, 'system-reminder no meio exclui', R.avaliarFechamento(lembrete).motivo);

  conferir(!R.ehFimDaSessaoPrincipal('SubagentStop', null, null), 'SubagentStop nunca e fim da sessao principal', 'falso');
  conferir(!R.ehFimDaSessaoPrincipal('SubagentStop', 'coordenador', 'coordenador'), 'SubagentStop com o nome do principal tambem nao', 'falso');
  conferir(R.ehFimDaSessaoPrincipal('Stop', null, 'claude code'), 'Stop sem subagente e da sessao principal', 'verdadeiro');
  conferir(R.ehFimDaSessaoPrincipal('Stop', 'coordenador', 'coordenador'), 'Stop com agent_type igual ao principal (--agent) conta', 'verdadeiro');
  conferir(!R.ehFimDaSessaoPrincipal('Stop', 'ponte', 'coordenador'), 'Stop com nome de outro agente, texto de subagente, nao conta', 'falso');
  conferir(!R.ehFimDaSessaoPrincipal('Stop', 'ponte', null), 'Stop com subagente e principal desconhecido nao conta', 'falso');
  conferir(!R.ehFimDaSessaoPrincipal('UserPromptSubmit', null, null), 'comando do diretor nunca e fechamento', 'falso');
  conferir(!R.ehFimDaSessaoPrincipal('Notification', null, null), 'aviso nunca e fechamento', 'falso');
}

reg('');
reg('PARTE 3, texto inteiro pela transcricao, condicoes da seguranca');
{
  const casaReal = homedir();
  conferir(T.caminhoDeTranscricaoAceito(TRANSCRICAO, SID_REAL, casaReal), 'caminho real da sessao e aceito', 'dentro de ~/.claude/projects, .jsonl, nome igual ao sid');
  conferir(!T.caminhoDeTranscricaoAceito(TRANSCRICAO, 'outro-sid-0000-0000', casaReal), 'nome diferente do sid, recusado', 'falso');
  conferir(
    !T.caminhoDeTranscricaoAceito(join(casaReal, '.claude', 'projects-x', 'p', `${SID_REAL}.jsonl`), SID_REAL, casaReal),
    'pasta de nome parecido, fronteira de pasta, recusado',
    'projects-x'
  );
  conferir(
    !T.caminhoDeTranscricaoAceito(join(casaReal, '.claude', 'projects', 'p', '..', '..', 'x', `${SID_REAL}.jsonl`), SID_REAL, casaReal),
    'caminho com .. recusado',
    'falso'
  );
  conferir(!T.caminhoDeTranscricaoAceito(TRANSCRICAO.replace('.jsonl', '.txt'), SID_REAL, casaReal), 'sem .jsonl, recusado', 'falso');

  if (real0144 !== null) {
    const trecho = real0144.slice(0, 4000);
    const lido = T.lerTextoDoFechamento(TRANSCRICAO, trecho, '2026-11-25T01:44:43.000Z');
    conferir(lido.texto !== null && lido.texto === real0144, 'calibragem real: o Stop das 01:44 acha o texto inteiro', `${lido.texto?.length ?? 0} caracteres, ${lido.motivo}`);
    const cedo = T.lerTextoDoFechamento(TRANSCRICAO, trecho, '2026-11-25T01:40:00.000Z');
    conferir(cedo.texto === null, 'Stop anterior a mensagem nao pega mensagem do futuro', cedo.motivo);
    const torto = T.lerTextoDoFechamento(TRANSCRICAO, `${trecho.slice(0, 3999)}X`, '2026-11-25T01:44:43.000Z');
    conferir(torto.texto === null, 'trecho que nao bate exato, sem normalizar, nao acha', torto.motivo);
    const pelaMao = RB.textoDoFimDaMao(`${trecho}${T.SUFIXO_DE_CORTE}`, TRANSCRICAO, SID_REAL, '2026-11-25T01:44:43.000Z', casaReal);
    conferir(pelaMao.fonte === 'transcricao' && !pelaMao.cortado && pelaMao.texto.length === 5208, 'resposta cortada do gancho vira texto inteiro da transcricao', `fonte ${pelaMao.fonte}, ${pelaMao.texto.length} caracteres`);
    const foraDaRegra = RB.textoDoFimDaMao(`${trecho}${T.SUFIXO_DE_CORTE}`, TRANSCRICAO, 'sid-errado-000000', '2026-11-25T01:44:43.000Z', casaReal);
    conferir(foraDaRegra.fonte === 'gancho' && foraDaRegra.cortado && foraDaRegra.texto === trecho, 'caminho fora da regra: texto do gancho, cortado', `fonte ${foraDaRegra.fonte}, cortado ${foraDaRegra.cortado}`);
  }
  let abriu = 0;
  const leitorEspiao: typeof T.lerTextoDoFechamento = (c, tr, h) => {
    abriu++;
    return T.lerTextoDoFechamento(c, tr, h);
  };
  const semCorte = RB.textoDoFimDaMao('texto curto inteiro', TRANSCRICAO, SID_REAL, '2026-11-25T01:44:43.000Z', homedir(), leitorEspiao);
  conferir(abriu === 0 && semCorte.fonte === 'gancho' && !semCorte.cortado, 'resposta sem corte nem abre a transcricao', `aberturas ${abriu}`);

  // Transcricao montada: subagente com o mesmo comeco e rodada seguinte depois do Stop.
  const pasta = join(RODADA, 'transcricao-montada');
  mkdirSync(pasta, { recursive: true });
  const arq = join(pasta, 'montada.jsonl');
  const comeco = 'A'.repeat(4000);
  const linha = (o: unknown): string => `${JSON.stringify(o)}\n`;
  writeFileSync(
    arq,
    linha({ type: 'user', timestamp: '2026-11-24T10:00:00Z', message: { content: [{ type: 'text', text: `${comeco}DO DIRETOR` }] } }) +
      linha({ type: 'assistant', timestamp: '2026-11-24T10:01:00Z', message: { id: 'p1', content: [{ type: 'thinking', thinking: `${comeco}PENSAMENTO` }] } }) +
      linha({ type: 'assistant', timestamp: '2026-11-24T10:01:01Z', message: { id: 'p1', content: [{ type: 'text', text: `${comeco}PRINCIPAL` }] } }) +
      linha({ type: 'assistant', timestamp: '2026-11-24T10:01:01Z', message: { id: 'p1', content: [{ type: 'tool_use', name: 'x', input: { a: comeco } }] } }) +
      linha({ type: 'assistant', isSidechain: true, timestamp: '2026-11-24T10:01:02Z', message: { id: 's1', content: [{ type: 'text', text: `${comeco}SUBAGENTE` }] } }) +
      linha({ type: 'assistant', timestamp: '2026-11-24T10:09:00Z', message: { id: 'p2', content: [{ type: 'text', text: `${comeco}RODADA SEGUINTE` }] } })
  );
  const m = T.lerTextoDoFechamento(arq, comeco, '2026-11-24T10:01:03Z');
  conferir(m.texto === `${comeco}PRINCIPAL`, 'pega a mensagem principal, nunca subagente, pensamento, ferramenta ou usuario', `termina em ${m.texto?.slice(4000) ?? 'nada'}`);
  const grande = join(pasta, 'grande.jsonl');
  writeFileSync(grande, linha({ type: 'assistant', timestamp: '2026-11-24T10:01:01Z', message: { id: 'g', content: [{ type: 'text', text: `${comeco}${'b'.repeat(250_000)}` }] } }));
  const g = T.lerTextoDoFechamento(grande, comeco, '2026-11-24T10:01:03Z');
  conferir(g.cortado && g.texto?.length === T.TETO_TEXTO_DO_FECHAMENTO, 'texto acima de 200.000 caracteres e cortado e marcado', `${g.texto?.length}`);
  const ausente = T.lerTextoDoFechamento(join(pasta, 'nao-existe.jsonl'), comeco, '2026-11-24T10:01:03Z');
  conferir(ausente.texto === null && ausente.motivo === 'transcricao ilegivel', 'transcricao ausente diz so "ilegivel", sem trecho', ausente.motivo);

  // Projetos ignorados, relidos do ganchos.json na hora.
  const pl = join(RODADA, 'ganchos-config');
  mkdirSync(pl, { recursive: true });
  writeFileSync(join(pl, 'ganchos.json'), JSON.stringify({ ligado: true, projetosIgnorados: ['C:\\Users\\Henrique\\cliente'] }));
  conferir(RB.projetoIgnorado(['C:\\Users\\Henrique\\cliente\\sub'], pl), 'projeto ignorado nao gera relatorio', 'verdadeiro');
  conferir(!RB.projetoIgnorado(['C:\\Users\\Henrique\\cliente-lab'], pl), 'nome parecido nao e alcancado, fronteira de caminho', 'falso');
  // Ressalva da seguranca: o fechamento da fabrica do painel tambem consulta a
  // lista. A base aqui e de mentira e lanca se for tocada: nada pode ser lido
  // nem gravado para projeto ignorado.
  const baseIntocavel = new Proxy(
    {},
    {
      get: (): never => {
        throw new Error('a base foi tocada');
      },
    }
  ) as unknown as import('firebase/firestore').Firestore;
  const fechamentoBom = '## O que foi feito\nx\n## O que ficou faltando\ny\n## Problemas encontrados\nz\n## Quem trabalhou\nponte';
  const doPainel = async (cwd: string): Promise<string> => {
    try {
      return await RB.fechamentoDoPainel(
        baseIntocavel,
        { fabricaId: 'painel-x', maquinaId: 'm', sessao: 's', texto: fechamentoBom, inicio: null, fim: '2026-11-24T10:00:00Z', cwd },
        pl
      );
    } catch (e) {
      return `erro: ${e instanceof Error ? e.message : String(e)}`;
    }
  };
  const ignorado = await doPainel('C:\\Users\\Henrique\\cliente\\app');
  conferir(ignorado === 'projeto ignorado ou lista ilegivel', 'fabrica do painel em projeto ignorado nao grava, nem toca a base', ignorado);
  const liberado = await doPainel('C:\\Users\\Henrique\\cliente-lab');
  conferir(liberado === 'erro: a base foi tocada', 'fabrica do painel fora da lista segue para a base', liberado);
  writeFileSync(join(pl, 'ganchos.json'), '{isto nao e json');
  const ilegivel = await doPainel('C:\\Users\\Henrique\\a-fabrica');
  conferir(ilegivel === 'projeto ignorado ou lista ilegivel', 'fabrica do painel com lista ilegivel, falha fechada', ilegivel);
  conferir(RB.projetoIgnorado(['C:\\Users\\Henrique\\a-fabrica'], pl), 'lista ilegivel, falha fechada, nada sai', 'verdadeiro');
}

reg('');
reg('PARTE 4, ids sem texto');
{
  const a = R.idDoFechamento('mao-x', 'sid-1', '2026-11-24T10:00:00Z');
  const b = R.idDoFechamento('mao-x', 'sid-1', '2026-11-24T10:00:00Z');
  const c = R.idDoFechamento('mao-x', 'sid-1', '2026-11-24T10:00:01Z');
  conferir(a === b && a !== c && a.startsWith('fech-mao-x-'), 'mesma rodada, mesmo id; outra hora, outro id', `${a}, ${c}`);
  conferir(R.idDoDiario('mao-x', '2026-11-24') === 'diario-mao-x-2026-11-24', 'id do diario', R.idDoDiario('mao-x', '2026-11-24'));
}

reg('');
reg('PARTE 5, P1: subagente nao muda o estado da fabrica');
{
  const sStop = traduzir({ ev: 'SubagentStop', sid: 's', conteudo: true }, 1);
  const sStart = traduzir({ ev: 'SubagentStart', sid: 's', subagente: 'ponte' }, 2);
  const stop = traduzir({ ev: 'Stop', sid: 's' }, 3);
  const post = traduzir({ ev: 'PostToolUse', sid: 's', ferramenta: 'Read' }, 4);
  conferir(sStop.estado === null, 'SubagentStop sem nome (resumo automatico) nao reacende a fabrica', String(sStop.estado));
  conferir(sStart.estado === null, 'SubagentStart nao muda estado', String(sStart.estado));
  conferir(stop.estado === 'aguardando comando', 'Stop continua aguardando comando', String(stop.estado));
  conferir(post.estado === 'em execucao', 'passo de ferramenta continua em execucao', String(post.estado));
}

reg('');
reg('PARTE 6, P2: agentes achados subindo de pasta');
{
  const casa = join(RODADA, 'casa');
  const agente = (pasta: string, nome: string): void => {
    mkdirSync(join(pasta, '.claude', 'agents'), { recursive: true });
    writeFileSync(join(pasta, '.claude', 'agents', `${nome}.md`), `---\nname: ${nome}\ndescription: agente ${nome}\n---\ncorpo do ${nome}\n`);
  };
  agente(casa, 'do-usuario');
  const proj = join(casa, 'projeto');
  agente(proj, 'coordenador');
  agente(proj, 'ponte');
  const funda = join(proj, 'painel', 'src', 'telas');
  mkdirSync(funda, { recursive: true });
  const outro = join(casa, 'outro', 'sub');
  mkdirSync(outro, { recursive: true });
  const daFunda = lerAgentesDoProjeto(funda, { casa, subir: true }).map((a) => a.nome);
  conferir(daFunda.join(',') === 'coordenador,ponte', 'subpasta acha os agentes da raiz do projeto', daFunda.join(', '));
  const daRaiz = lerAgentesDoProjeto(proj, { casa, subir: true }).map((a) => a.nome);
  conferir(daRaiz.join(',') === 'coordenador,ponte', 'a propria raiz continua achando', daRaiz.join(', '));
  const doOutro = lerAgentesDoProjeto(outro, { casa, subir: true });
  conferir(doOutro.length === 0, 'projeto sem agentes nao sobe alem da pasta do usuario', `${doOutro.length} agente(s)`);
  conferir(acharPastaDeAgentes(casa, casa, true) === null, 'a pasta do usuario nao e lida como projeto', 'null');
  const realPainel = lerAgentesDoProjeto(join(AQUI, '..', '..', '..', 'painel'), { subir: true });
  conferir(realPainel.length >= 8, 'real: a-fabrica\\painel acha o time da raiz', `${realPainel.length} agente(s)`);
  const raizDoDisco = acharPastaDeAgentes('C:\\', casa, true);
  conferir(raizDoDisco === null, 'raiz do disco, fora da pasta do usuario, le so ela e nao acha', String(raizDoDisco));

  // Ressalva da seguranca: fora da pasta do usuario, so o proprio cwd, sem subir.
  const foraDaCasa = join(RODADA, 'fora-da-casa');
  agente(foraDaCasa, 'de-fora');
  const foraFunda = join(foraDaCasa, 'sub');
  mkdirSync(foraFunda, { recursive: true });
  const foraSub = lerAgentesDoProjeto(foraFunda, { casa, subir: true });
  conferir(foraSub.length === 0, 'projeto fora da pasta do usuario nao sobe de pasta', `${foraSub.length} agente(s) na subpasta`);
  const foraRaiz = lerAgentesDoProjeto(foraDaCasa, { casa, subir: true }).map((a) => a.nome);
  conferir(foraRaiz.join(',') === 'de-fora', 'fora da pasta do usuario le o proprio cwd', foraRaiz.join(', '));
  // Fabrica do painel: nao sobe nunca, le exatamente o cwd cadastrado.
  const semSubir = lerAgentesDoProjeto(funda, { casa });
  conferir(semSubir.length === 0, 'sem subir, subpasta nao acha a raiz', `${semSubir.length} agente(s)`);
  const { aplicarPersonaComTime } = await import('../personas.js');
  const painelFundo = aplicarPersonaComTime(null, join(AQUI, '..', '..', '..', 'painel'), 'claude-haiku-5-5', 'x');
  conferir(painelFundo.time.length === 0, 'fabrica do painel em a-fabrica\\painel nao sobe para a raiz', `${painelFundo.time.length} agente(s)`);
  const painelRaiz = aplicarPersonaComTime(null, join(AQUI, '..', '..', '..'), 'claude-haiku-5-5', 'x');
  conferir(painelRaiz.time.length >= 8, 'fabrica do painel na raiz cadastrada continua achando o time', `${painelRaiz.time.length} agente(s)`);
}

reg('');
reg('PARTE 7, dia de Brasilia e consumo por dia');
{
  conferir(R.diaDeBrasilia('2026-11-25T02:59:59Z') === '2026-11-24', '23:59:59 de Brasilia ainda e o dia 24', String(R.diaDeBrasilia('2026-11-25T02:59:59Z')));
  conferir(R.diaDeBrasilia('2026-11-25T03:00:00Z') === '2026-11-25', '00:00 de Brasilia ja e o dia 25', String(R.diaDeBrasilia('2026-11-25T03:00:00Z')));
  conferir(R.diaDeBrasilia('lixo') === null, 'hora ilegivel nao inventa dia', 'null');
  const s = R.somaDoDia({ input_tokens: 10, output_tokens: 0, cache_read_input_tokens: 5 }, '2026-11-24');
  conferir(JSON.stringify(s) === JSON.stringify({ '2026-11-24': { input_tokens: 10, cache_read_input_tokens: 5 } }), 'acrescimo soma na chave do dia, sem zero', JSON.stringify(s));
  conferir(Object.keys(R.somaDoDia({ input_tokens: 0 }, '2026-11-24')).length === 0, 'acrescimo zerado nao escreve dia', '{}');
  // Janela do diario: de 20h00 de D-1 ate 20h00 de D, Brasilia.
  conferir(R.diaDaJanela('2026-11-24T22:59:59Z') === '2026-11-24', '19:59:59 de 24/11 cai na janela do dia 24', String(R.diaDaJanela('2026-11-24T22:59:59Z')));
  conferir(R.diaDaJanela('2026-11-24T23:00:00Z') === '2026-11-25', '20:00 de 24/11 ja cai na janela do dia 25', String(R.diaDaJanela('2026-11-24T23:00:00Z')));
  conferir(R.diaDaJanela('2026-11-25T02:30:00Z') === '2026-11-25', '23:30 de 24/11, trabalho da noite, vai para o diario do dia 25', String(R.diaDaJanela('2026-11-25T02:30:00Z')));
  const j = R.janelaDoDia('2026-11-24');
  conferir(j.inicio === '2026-11-23T23:00:00.000Z' && j.fim === '2026-11-24T23:00:00.000Z', 'janela do dia 24 em ISO', `${j.inicio} ate ${j.fim}`);
  const chave = Object.keys(R.somaDoDia({ input_tokens: 1 }, String(R.diaDaJanela('2026-11-25T01:00:00Z'))))[0];
  conferir(chave === '2026-11-25', 'consumo somado as 22:00 de 24/11 entra na chave do dia 25, mesma janela', String(chave));
}

reg('');
reg('PARTE 8, diario: quando gera, e o que leva');
{
  const livro = R.livroVazio(new Date('2026-11-01T12:00:00Z'));
  // Dia 24/11 de Brasilia: duas rodadas, uma sem comeco conhecido.
  R.anotarPasso(livro, 'mao-a', '2026-11-24T13:00:00Z');
  R.anotarRodada(livro, 'mao-a', '2026-11-24T13:00:00Z', '2026-11-24T13:30:00Z');
  R.anotarRodada(livro, 'mao-a', '2026-11-24T13:00:00Z', '2026-11-24T13:30:00Z'); // repetida
  R.anotarRodada(livro, 'mao-a', '2026-11-24T18:00:00Z', '2026-11-24T18:45:00Z');
  R.anotarRodada(livro, 'mao-a', null, '2026-11-24T19:00:00Z');
  // Fabrica b so tem atividade no dia 23. Fabrica c, velha demais.
  R.anotarPasso(livro, 'painel-b', '2026-11-23T15:00:00Z');
  R.anotarPasso(livro, 'painel-c', '2026-11-10T15:00:00Z');
  livro.fabricas['vazia'] = { '2026-11-24': { passos: 0, rodadas: [] } };

  const as1959 = R.diariosAFazer(livro, new Date('2026-11-24T22:59:00Z'));
  conferir(!as1959.some((d) => d.dia === '2026-11-24'), '19:59 de Brasilia: o dia de hoje ainda nao gera', JSON.stringify(as1959));
  conferir(as1959.some((d) => d.fabricaId === 'painel-b' && d.dia === '2026-11-23' && d.geradoAtrasado), 'dia anterior que ficou para tras gera, marcado atrasado', 'painel-b 23/11');
  const as2000 = R.diariosAFazer(livro, new Date('2026-11-24T23:00:00Z'));
  const hoje = as2000.filter((d) => d.dia === '2026-11-24');
  conferir(hoje.length === 1 && hoje[0]?.fabricaId === 'mao-a' && hoje[0]?.geradoAtrasado === false, '20:00 de Brasilia gera o do dia, no horario', JSON.stringify(hoje));
  conferir(!as2000.some((d) => d.fabricaId === 'vazia'), 'fabrica sem atividade no dia nao gera', 'vazia fora');
  conferir(!as2000.some((d) => d.fabricaId === 'painel-c'), 'mais de sete dias para tras nao gera', 'painel-c fora');
  livro.gerados[R.idDoDiario('mao-a', '2026-11-24')] = '2026-11-24T23:00:00Z';
  conferir(!R.diariosAFazer(livro, new Date('2026-11-24T23:30:00Z')).some((d) => d.fabricaId === 'mao-a'), 'diario ja gerado nao gera de novo', 'fora');
  delete livro.gerados[R.idDoDiario('mao-a', '2026-11-24')];
  const acordou = R.diariosAFazer(livro, new Date('2026-11-25T11:00:00Z'));
  conferir(acordou.some((d) => d.fabricaId === 'mao-a' && d.dia === '2026-11-24' && d.geradoAtrasado), 'maquina dormiu as 20h: gera ao acordar, para o dia que ficou para tras', JSON.stringify(acordou));
  R.podarLivro(livro, new Date('2026-11-25T11:00:00Z'));
  conferir(livro.fabricas['painel-c'] === undefined, 'livro esquece o que passou do prazo', Object.keys(livro.fabricas).join(', '));

  const fech1 = [
    '## O que foi solicitado',
    'Arrumar o chat.',
    '## O que foi feito',
    'Arrumei.',
    '## O que ficou faltando',
    '- validação visual do diretor',
    '- prova no celular',
    '',
    '## Próximo passo',
    'Validar.',
  ].join('\n');
  const fech2 = '**O que foi feito:** a ponte.\n**O que ficou faltando:** nada.\n**Problemas encontrados:** nenhum.\n**Quem trabalhou:** ponte.';
  const d = R.montarDiario({
    fabricaId: 'mao-a',
    maquinaId: 'maq',
    dia: '2026-11-24',
    projeto: 'C:\\Users\\Henrique\\a-fabrica',
    titulo: null,
    fechamentos: [
      { relatorioId: 'fech-2', rodadaFim: '2026-11-24T18:45:00Z', texto: fech2 },
      { relatorioId: 'fech-1', rodadaFim: '2026-11-24T13:30:00Z', texto: fech1 },
    ],
    rodadas: livro.fabricas['mao-a']?.['2026-11-24']?.rodadas ?? [],
    consumoDoDia: null,
    geradoAtrasado: false,
    agora: new Date('2026-11-24T23:00:30Z'),
  });
  conferir(d.janelaInicio === '2026-11-23T23:00:00.000Z' && d.janelaFim === '2026-11-24T23:00:00.000Z', 'janelaInicio e janelaFim no documento', `${d.janelaInicio} ate ${d.janelaFim}`);
  conferir(d.texto.includes('Janela: de 23/11 às 20h00 até 24/11 às 20h00, horário de Brasília.'), 'o texto diz a janela por extenso', 'sim');
  writeFileSync(join(RODADA, 'diario-de-exemplo.txt'), d.texto, 'utf8');
  conferir(d.id === 'diario-mao-a-2026-11-24' && d.tipo === 'diario', 'id e tipo', d.id);
  conferir(d.rodadas === 3, 'rodada repetida nao conta duas vezes', `${d.rodadas} rodadas`);
  conferir(d.tempoMs === 75 * 60000, 'tempo e a soma das rodadas com comeco conhecido', `${d.tempoMs} ms`);
  conferir(d.texto.includes('somando 2 de 3 rodadas'), 'o texto diz quantas rodadas o tempo cobre', 'sim');
  conferir(d.consumoDoDia === null && d.texto.includes('Consumo do dia: não medido'), 'dia sem medicao diz "nao medido"', 'sim');
  conferir(
    d.pendencias.length === 2 && d.pendencias[0] === '- validação visual do diretor\n- prova no celular' && d.pendencias[1] === 'nada.',
    'pendencias copiadas sem reescrever, na ordem do dia',
    JSON.stringify(d.pendencias)
  );
  conferir(d.fechamentos[0]?.relatorioId === 'fech-1' && d.texto.includes(fech1) && d.texto.includes(fech2), 'fechamentos inteiros, em ordem de tempo', d.fechamentos.map((f) => f.relatorioId).join(', '));
  conferir(d.texto.includes('Gerado em 24/11/2026 às 20:00, horário de Brasília.'), 'o diario diz a hora em que foi gerado', 'sim');
  conferir(!TRAVESSAO.test(d.texto), 'nenhum travessao no texto do diario, §A.11', 'sem travessao');
  conferir(!d.cortado, 'diario normal nao e cortado', 'falso');

  // Fechamento e rodada fora da janela nao entram, mesmo se vierem na entrada.
  const fora = R.montarDiario({
    fabricaId: 'mao-a', maquinaId: 'maq', dia: '2026-11-24', projeto: null, titulo: null,
    fechamentos: [
      { relatorioId: 'dentro', rodadaFim: '2026-11-24T01:00:00Z', texto: fech2 },
      { relatorioId: 'depois', rodadaFim: '2026-11-24T23:30:00Z', texto: fech2 },
    ],
    rodadas: [{ inicio: '2026-11-24T00:30:00Z', fim: '2026-11-24T01:00:00Z' }, { inicio: '2026-11-24T23:10:00Z', fim: '2026-11-24T23:30:00Z' }],
    consumoDoDia: null, geradoAtrasado: false, agora: new Date('2026-11-24T23:01:00Z'),
  });
  conferir(fora.fechamentos.length === 1 && fora.fechamentos[0]?.relatorioId === 'dentro' && fora.rodadas === 1 && fora.tempoMs === 30 * 60000, '22:00 de 23/11 entra no diario do dia 24; 20:30 de 24/11 fica para o do dia 25', JSON.stringify({ f: fora.fechamentos.map((x) => x.relatorioId), r: fora.rodadas, t: fora.tempoMs }));

  // Livro que comecou no meio de uma janela: gera, e diz desde quando anotou.
  {
    const novo = R.livroVazio(new Date('2026-11-24T23:40:00Z'));
    R.anotarPasso(novo, 'mao-z', '2026-11-25T02:30:00Z');
    const aberta = R.diariosAFazer(novo, new Date('2026-11-25T02:45:00Z'));
    conferir(aberta.length === 0, 'janela ainda aberta nao gera', JSON.stringify(aberta));
    const fechou = R.diariosAFazer(novo, new Date('2026-11-25T23:00:10Z'));
    conferir(fechou.length === 1 && fechou[0]?.dia === '2026-11-25' && fechou[0]?.parcialDesde === '2026-11-24T23:40:00.000Z', 'janela fechada gera, marcada parcial desde o comeco do livro', JSON.stringify(fechou));
    const parcial = R.montarDiario({ fabricaId: 'mao-z', maquinaId: 'maq', dia: '2026-11-25', projeto: null, titulo: null, fechamentos: [], rodadas: [], consumoDoDia: null, geradoAtrasado: false, parcialDesde: fechou[0]?.parcialDesde ?? null, agora: new Date('2026-11-25T23:00:10Z') });
    conferir(parcial.texto.includes('A ponte só passou a anotar em 24/11/2026 às 20:40.') && !TRAVESSAO.test(parcial.texto), 'o texto do parcial diz desde quando, sem travessao', 'sim');
  }

  // O livro real da maquina: entrada de 24/11 com desde depois da janela, e id ja gerado.
  {
    const real = R.livroVazio(new Date('2026-11-25T02:42:14Z'));
    real.fabricas['mao-76486df0-903f-4d72-ba63-b2e684810fcf'] = { '2026-11-24': { passos: 3, rodadas: [] } };
    real.gerados['diario-mao-76486df0-903f-4d72-ba63-b2e684810fcf-2026-11-24'] = '2026-11-25T02:41:08.254Z';
    const a = R.diariosAFazer(real, new Date('2026-11-25T03:00:00Z'));
    delete real.gerados['diario-mao-76486df0-903f-4d72-ba63-b2e684810fcf-2026-11-24'];
    const b = R.diariosAFazer(real, new Date('2026-11-25T03:00:00Z'));
    conferir(a.length === 0 && b.length === 0, 'o 24/11 ja gravado nao e gerado de novo, nem pelo livro nem pela janela', JSON.stringify({ comId: a, semId: b }));
  }

  const atrasado = R.montarDiario({
    fabricaId: 'painel-b',
    maquinaId: 'maq',
    dia: '2026-11-23',
    projeto: null,
    titulo: 'Fabrica B',
    fechamentos: [],
    rodadas: [],
    consumoDoDia: { input_tokens: 1200, output_tokens: 300 },
    geradoAtrasado: true,
    agora: new Date('2026-11-24T11:00:00Z'),
  });
  conferir(atrasado.geradoAtrasado && atrasado.texto.includes('Gerado com atraso'), 'diario atrasado diz que saiu atrasado', 'sim');
  conferir(atrasado.texto.includes('1.500 tokens') && atrasado.tempoMs === null, 'consumo do dia por extenso, tempo nao medido', 'sim');
  conferir(!TRAVESSAO.test(atrasado.texto), 'sem travessao no atrasado', 'sem travessao');

  const enorme = R.montarDiario({
    fabricaId: 'mao-a',
    maquinaId: 'maq',
    dia: '2026-11-24',
    projeto: null,
    titulo: null,
    fechamentos: Array.from({ length: 8 }, (_, i) => ({
      relatorioId: `f${i}`,
      rodadaFim: `2026-11-24T1${i}:00:00Z`,
      texto: `## O que ficou faltando\n${'ç'.repeat(150_000)}`,
    })),
    rodadas: [],
    consumoDoDia: null,
    geradoAtrasado: false,
    agora: new Date('2026-11-24T23:00:00Z'),
  });
  const bytes = Buffer.byteLength(JSON.stringify(enorme), 'utf8');
  conferir(enorme.cortado && bytes <= R.TETO_BYTES_DO_DIARIO && enorme.texto.includes('[diário cortado'), 'diario acima de 1 MiB e cortado, marcado e dito no texto', `${bytes} bytes`);
}

// ---------------------------------------------------------------------------
reg('');
if (process.env['PONTE_SEM_CLAUDE'] === '1') {
  reg('PARTE 9, fabrica de verdade: PULADA por PONTE_SEM_CLAUDE=1');
} else {
  const MODELO = process.env['PONTE_MODELO_PROVA'] ?? 'claude-haiku-5-5';
  reg(`PARTE 9, fabrica de verdade pelo kit, modelo ${MODELO}, portao nega tudo, base em memoria`);
  const { rodarSessao } = await import('../sessao.js');
  const { RegistroDeFabricas } = await import('../vivas.js');
  type PortasDaSessao = import('../sessao.js').PortasDaSessao;
  type PermissionResult = import('@anthropic-ai/claude-agent-sdk').PermissionResult;
  const projeto = join(RODADA, 'projeto-fabrica');
  mkdirSync(projeto, { recursive: true });
  const negaTudo = async (): Promise<PermissionResult> => ({ behavior: 'deny', message: 'prova dos relatorios, nada executa' });
  const fins: Array<{ sessao: string; inicio: string; fim: string; resposta: string | null }> = [];
  const portas: PortasDaSessao = {
    registro: new RegistroDeFabricas(),
    anotarFabrica: async () => undefined,
    publicarPasso: async () => undefined,
    fazerPortao: () => negaTudo,
    horaDoServidor: () => new Date().toISOString(),
    fimDaRodada: async (d) => {
      fins.push({ sessao: d.sessao, inicio: d.inicio, fim: d.fim, resposta: d.resposta });
    },
  };
  const fabricaId = `prova-relatorios-${selo()}`;
  const r1 = await rodarSessao(portas, {
    fabricaId,
    cwd: projeto,
    prompt:
      'Sem usar ferramenta nenhuma, responda exatamente com este texto, linha por linha, sem acrescentar nada:\n' +
      '## O que foi solicitado\nUma prova.\n## O que foi feito\nNada de verdade.\n## O que ficou faltando\nTudo.\n## Problemas encontrados\nNenhum.',
    tarefa: 'prova dos relatorios, rodada 1',
    resumeId: null,
    modelo: MODELO,
    agent: null,
    agents: null,
    dadosIniciais: { estado: 'em execucao' },
    maxTurns: 2,
  });
  const f1 = fins[0];
  reg(`  rodada 1: ${r1.estado}, ${fins.length} fim(ns) de rodada, resposta com ${f1?.resposta?.length ?? 0} caracteres`);
  const v1 = f1?.resposta ? R.avaliarFechamento(f1.resposta) : null;
  conferir(r1.rodou && v1 !== null && v1.fechamento, 'resposta final do agente principal chega pelo kit e passa no criterio', `grupos ${v1?.marcas.join(', ') ?? 'nenhum'}`);
  conferir(f1 !== undefined && f1.sessao !== fabricaId && f1.inicio < f1.fim, 'rodada tem sessao do kit, comeco e fim', `sessao ${f1?.sessao.slice(0, 8)}...`);
  const r2 = await rodarSessao(portas, {
    fabricaId,
    cwd: projeto,
    prompt: 'Diga apenas: pronto.',
    tarefa: 'prova dos relatorios, rodada 2',
    resumeId: r1.sessionId,
    modelo: MODELO,
    agent: null,
    agents: null,
    dadosIniciais: { estado: 'em execucao' },
    maxTurns: 2,
  });
  const f2 = fins[1];
  const v2 = f2?.resposta ? R.avaliarFechamento(f2.resposta) : null;
  conferir(r2.rodou && v2 !== null && !v2.fechamento, 'resposta comum da rodada seguinte nao vira relatorio', `${f2?.resposta?.length ?? 0} caracteres, ${v2?.motivo ?? 'sem resposta'}`);
  conferir(
    f1 !== undefined && f2 !== undefined && R.idDoFechamento(fabricaId, f1.sessao, f1.fim) !== R.idDoFechamento(fabricaId, f2.sessao, f2.fim),
    'cada rodada do painel tem id proprio',
    'sim'
  );
}

reg('');
reg(erros === 0 ? 'RESUMO: tudo passou.' : `RESUMO: ${erros} caso(s) falharam.`);
process.exit(erros === 0 ? 0 : 1);
