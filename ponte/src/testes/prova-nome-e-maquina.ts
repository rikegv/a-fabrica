// prova-nome-e-maquina.ts, OST 15: nome da sessao, rotulo da maquina, e uma
// ponte que nao derruba o estado da outra.
//
// TRES PARTES, cada uma em processo proprio, porque a pasta local da ponte e
// decidida na hora do import:
//   PARTE 1, sem base, pasta local DENTRO da rodada: leitura do nome, as
//            condicoes da seguranca, limpeza, rotulo e carregarConfig.
//   PARTE 2, BASE REAL, com maquinas e fabricas DE TESTE, rotuladas teste: true
//            (§A.17, rotular e filtrar, nunca apagar): a reconciliacao, o sinal
//            de vida, a parada e o ouvinte de comandos da maquina A nao tocam a
//            maquina B nem a fabrica dela. Pula com PONTE_SEM_BASE=1.
//   PARTE 3, sem base: varredura do codigo, toda escrita em `maquinas` usa o
//            maquinaId da propria ponte.
//
// Nada aqui imprime texto de transcricao real, nem segredo: os segredos sao
// inventados, e so se confere que nao sobraram.
//
// §A.17 pasta nova da rodada com data e hora, nada apagado. §A.19 a fila e a
// pasta local de teste vivem dentro da rodada.
//
// Uso: npm run prova:nome

import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const ESTE = fileURLToPath(import.meta.url);
const PARTE = process.env['PONTE_PROVA_PARTE'] ?? '';
const RODADA =
  process.env['PONTE_RODADA'] ?? join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost15-prova-nome-e-maquina`);
const SAIDA = join(RODADA, 'saida.txt');

if (PARTE === '') {
  mkdirSync(RODADA, { recursive: true });
  const base = { ...process.env, PONTE_RODADA: RODADA };
  let falhou = 0;
  const p1 = spawnSync(process.execPath, [ESTE], {
    stdio: 'inherit',
    env: {
      ...base,
      PONTE_PROVA_PARTE: '1',
      PONTE_PASTA_LOCAL: join(RODADA, 'ponte-local'),
      PONTE_PASTA_FILA_GANCHOS: join(RODADA, 'ponte-local'),
    },
  });
  if (p1.status !== 0) falhou++;
  if (process.env['PONTE_SEM_BASE'] !== '1') {
    // Pasta local de verdade (a identidade da ponte mora la), mas a fila de
    // ganchos dentro da rodada, para esta prova nunca encostar na fila real.
    const env2: NodeJS.ProcessEnv = { ...base, PONTE_PROVA_PARTE: '2', PONTE_PASTA_FILA_GANCHOS: join(RODADA, 'fila-parte2') };
    delete env2['PONTE_PASTA_LOCAL'];
    delete env2['PONTE_MAQUINA_ID'];
    const p2 = spawnSync(process.execPath, [ESTE], { stdio: 'inherit', env: env2 });
    if (p2.status !== 0) falhou++;
  } else {
    appendFileSync(SAIDA, 'PARTE 2 pulada, PONTE_SEM_BASE=1\n', 'utf8');
  }
  const p3 = spawnSync(process.execPath, [ESTE], { stdio: 'inherit', env: { ...base, PONTE_PROVA_PARTE: '3' } });
  if (p3.status !== 0) falhou++;
  const fim = falhou === 0 ? 'RESUMO GERAL: as partes passaram.' : `RESUMO GERAL: ${falhou} parte(s) com falha.`;
  console.log(fim);
  appendFileSync(SAIDA, `${fim}\n`, 'utf8');
  process.exit(falhou === 0 ? 0 : 1);
}

let erros = 0;
let casos = 0;
function reg(linha: string): void {
  console.log(linha);
  appendFileSync(SAIDA, `${linha}\n`, 'utf8');
}
function conferir(ok: boolean, rotulo: string, detalhe: string): void {
  casos++;
  if (!ok) erros++;
  reg(`  ${ok ? 'PASSOU' : 'FALHOU'} ${rotulo}: ${detalhe}`);
}
function fechar(nome: string): never {
  reg(erros === 0 ? `RESUMO ${nome}: ${casos} caso(s), todos passaram.` : `RESUMO ${nome}: ${erros} de ${casos} caso(s) falharam.`);
  process.exit(erros === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
if (PARTE === '1') {
  const N = await import('../nomeDaSessao.js');
  const G = await import('../ganchos.js');
  const C = await import('../config.js');
  const { MARCA } = await import('../mascara.js');
  const { TETO_LEITURA_BYTES } = await import('../transcricao.js');

  reg(`prova do nome da sessao e do rotulo, OST 15, ${new Date().toISOString()}`);
  reg(`rodada: ${RODADA}`);
  reg('');
  reg('PARTE 1, sem base');

  // Casa de mentira dentro da rodada: nada se escreve no ~/.claude de verdade.
  const CASA = join(RODADA, 'casa');
  const SID = '11111111-2222-4333-8444-555555555555';
  const PROJ = join(CASA, '.claude', 'projects', 'C--prova');
  mkdirSync(PROJ, { recursive: true });
  const TRANS = join(PROJ, `${SID}.jsonl`);
  const L = (o: unknown): string => `${JSON.stringify(o)}\n`;
  const SEGREDO = 'sk-ant-INVENTADA0123456789abcdefghij';

  writeFileSync(
    TRANS,
    L({ type: 'user', message: { content: 'conversa que nao interessa' }, sessionId: SID }) +
      L({ type: 'ai-title', aiTitle: 'Primeiro titulo', sessionId: SID }) +
      L({ type: 'custom-title', customTitle: 'Nome velho', sessionId: SID }) +
      L({ type: 'custom-title', customTitle: 'Nome de OUTRA sessao', sessionId: 'outra-sessao-0000' }) +
      L({ type: 'custom-title', customTitle: 12345, sessionId: SID }) +
      `{"type":"custom-title" isto nao e json\n` +
      L({ type: 'ai-title', aiTitle: 'Titulo final', sessionId: SID }) +
      L({ type: 'custom-title', customTitle: 'Nome\u0007 com\u200b   controle', sessionId: SID }),
    'utf8'
  );

  reg('');
  reg('1.1 leitura e escolha da ultima linha');
  const r1 = N.lerNomeDaSessao(TRANS, SID, null);
  conferir(r1.achado.tituloDaSessao === 'Titulo final', 'ultimo ai-title vale', String(r1.achado.tituloDaSessao));
  conferir(r1.achado.nomeDaSessao === 'Nome com controle', 'ultimo custom-title vale, sem controle, espacos juntos', String(r1.achado.nomeDaSessao));
  conferir(
    JSON.stringify(Object.keys(r1.marca).sort()) === '["bytes","caminho"]',
    'marca guarda so posicao em bytes e caminho, nada de titulo',
    Object.keys(r1.marca).join(', ')
  );
  conferir(!JSON.stringify(r1.marca).includes('Titulo') && !JSON.stringify(r1.marca).includes('Nome'), 'titulo nao aparece na marca', 'sim');

  reg('');
  reg('1.2 incremental, sem reler tudo');
  const r2 = N.lerNomeDaSessao(TRANS, SID, r1.marca);
  conferir(Object.keys(r2.achado).length === 0 && r2.marca.bytes === r1.marca.bytes, 'sem linha nova, nada achado e marca parada', `bytes ${r2.marca.bytes}`);
  appendFileSync(TRANS, L({ type: 'assistant', message: { content: [] } }) + '{"type":"custom-title","customTitle":"pela metade"', 'utf8');
  const r3 = N.lerNomeDaSessao(TRANS, SID, r2.marca);
  conferir(r3.achado.nomeDaSessao === undefined, 'linha sem fim nao conta', `bytes ${r3.marca.bytes}`);
  appendFileSync(TRANS, `,"sessionId":"${SID}"}\n`, 'utf8');
  const r4 = N.lerNomeDaSessao(TRANS, SID, r3.marca);
  conferir(r4.achado.nomeDaSessao === 'pela metade' && r4.achado.tituloDaSessao === undefined, 'so o que entrou depois da marca e lido', String(r4.achado.nomeDaSessao));

  reg('');
  reg('1.3 teto de 8 MB por passada');
  const GRANDE = join(PROJ, '99999999-2222-4333-8444-555555555555.jsonl');
  const enchimento = L({ type: 'user', message: { content: 'x'.repeat(1000) } });
  const vezes = Math.ceil((TETO_LEITURA_BYTES + 200_000) / Buffer.byteLength(enchimento));
  writeFileSync(GRANDE, enchimento.repeat(vezes) + L({ type: 'ai-title', aiTitle: 'Depois do teto' }), 'utf8');
  const g1 = N.lerNomeDaSessao(GRANDE, '99999999-2222-4333-8444-555555555555', null);
  conferir(g1.marca.bytes <= TETO_LEITURA_BYTES && g1.achado.tituloDaSessao === undefined, 'primeira passada para no teto', `${g1.marca.bytes} bytes lidos`);
  const g2 = N.lerNomeDaSessao(GRANDE, '99999999-2222-4333-8444-555555555555', g1.marca);
  conferir(g2.achado.tituloDaSessao === 'Depois do teto', 'segunda passada continua de onde parou', String(g2.achado.tituloDaSessao));

  reg('');
  reg('1.4 limpeza: controle, espacos, mascara, corte em 80');
  const comSegredo = N.limparNomeDaSessao(`deploy com ${SEGREDO} no meio`);
  conferir(comSegredo !== null && !comSegredo.includes(SEGREDO) && comSegredo.includes(MARCA), 'titulo com segredo inventado sai mascarado', 'segredo nao sobrou');
  const longo = N.limparNomeDaSessao('a'.repeat(300));
  conferir(longo !== null && longo.length === N.TETO_NOME && N.TETO_NOME === 80, 'corte em TETO_NOME, o mesmo do painel', `${longo?.length}`);
  conferir(N.limparNomeDaSessao(' \u0000\u200e  ') === null, 'so controle e espaco vira null', 'null');
  const segredoNoFim = N.limparNomeDaSessao(`${'b'.repeat(70)} ${SEGREDO}`);
  conferir(segredoNoFim !== null && !segredoNoFim.includes('sk-ant-INV'), 'mascara antes do corte: segredo no fim nao sobra pela metade', `${segredoNoFim?.length}`);
  const tSeg = join(PROJ, '22222222-2222-4333-8444-555555555555.jsonl');
  writeFileSync(tSeg, L({ type: 'custom-title', customTitle: `cliente ${SEGREDO}` }), 'utf8');
  const lidoSeg = N.lerNomeDaSessao(tSeg, '22222222-2222-4333-8444-555555555555', null);
  conferir(
    lidoSeg.achado.nomeDaSessao !== undefined && lidoSeg.achado.nomeDaSessao !== null && !lidoSeg.achado.nomeDaSessao.includes(SEGREDO),
    'pela leitura de arquivo o segredo tambem sai mascarado',
    'segredo nao sobrou'
  );

  reg('');
  reg('1.5 so grava o que mudou');
  conferir(N.mudancaDoNome({ tituloDaSessao: 'X' }, { tituloDaSessao: 'X' }) === null, 'igual ao gravado, nada a escrever', 'null');
  const m = N.mudancaDoNome({ nomeDaSessao: 'Novo', tituloDaSessao: 'X' }, { nomeDaSessao: 'Velho', tituloDaSessao: 'X' });
  conferir(m !== null && JSON.stringify(Object.keys(m)) === '["nomeDaSessao"]', 'so o campo que mudou vai', JSON.stringify(m ? Object.keys(m) : null));
  conferir(N.mudancaDoNome({ nomeDaSessao: null }, {}) === null, 'null contra ausente nao escreve', 'null');
  conferir(N.eventoPedeNome('Stop') && N.eventoPedeNome('UserPromptSubmit') && !N.eventoPedeNome('PostToolUse'), 'gatilhos: Stop e UserPromptSubmit', 'sim');

  reg('');
  reg('1.6 condicoes da seguranca antes de abrir a transcricao');
  const PL = join(RODADA, 'ponte-local');
  mkdirSync(PL, { recursive: true });
  writeFileSync(join(PL, 'ganchos.json'), JSON.stringify({ ligado: true, conteudoDeTodos: true, projetosIgnorados: ['C:\\cliente'] }), 'utf8');
  const ok = { sid: SID, projeto: 'C:\\liberado', conteudo: true };
  conferir(G.deveLerNome(ok, TRANS, CASA, PL), 'tudo certo, le', 'sim');
  conferir(!G.deveLerNome({ ...ok, conteudo: false }, TRANS, CASA, PL), 'sem conteudo === true, nao le', 'nao abre');
  conferir(!G.deveLerNome({ ...ok, projeto: 'C:\\cliente\\sub' }, TRANS, CASA, PL), 'projeto ignorado (subpasta, fronteira), nao le', 'nao abre');
  conferir(G.deveLerNome({ ...ok, projeto: 'C:\\cliente-lab' }, TRANS, CASA, PL), 'nome parecido nao e ignorado', 'le');
  conferir(!G.deveLerNome({ ...ok, projeto: null }, TRANS, CASA, PL), 'projeto desconhecido, nao le', 'nao abre');
  conferir(!G.deveLerNome(ok, join(RODADA, `${SID}.jsonl`), CASA, PL), 'caminho fora de .claude/projects, nao le', 'nao abre');
  conferir(!G.deveLerNome(ok, `${PROJ}\\..\\C--prova\\${SID}.jsonl`, CASA, PL), 'caminho com .., nao le', 'nao abre');
  conferir(!G.deveLerNome({ ...ok, sid: 'aaaaaaaa-0000-4000-8000-000000000000' }, TRANS, CASA, PL), 'arquivo de outra sessao, nao le', 'nao abre');
  conferir(!G.deveLerNome(ok, TRANS, CASA, join(RODADA, 'sem-ganchos')), 'ganchos.json ausente, falha fechada', 'nao abre');
  mkdirSync(join(RODADA, 'ruim'), { recursive: true });
  writeFileSync(join(RODADA, 'ruim', 'ganchos.json'), '{quebrado', 'utf8');
  conferir(!G.deveLerNome(ok, TRANS, CASA, join(RODADA, 'ruim')), 'ganchos.json ilegivel, falha fechada', 'nao abre');
  // A fonte de ganchos.ts: a leitura do nome so acontece dentro de deveLerNome.
  const fonteG = readFileSync(join(AQUI, '..', '..', 'src', 'ganchos.ts'), 'utf8');
  const chamadas = fonteG.split('lerNomeDaSessao(').length - 1;
  const guardada = /if \(deveLerNome\(g, caminhoDaTranscricao\)\) \{\s*const leitura = lerNomeDaSessao\(/.test(fonteG);
  conferir(chamadas === 1 && guardada, 'no codigo, a unica chamada de lerNomeDaSessao esta dentro de deveLerNome', `${chamadas} chamada(s)`);
  const escritaNome = fonteG.slice(
    fonteG.indexOf('if (deveLerNome(g, caminhoDaTranscricao))'),
    fonteG.indexOf('if (fabricaDaSessao !== null) lembrarSeq')
  );
  conferir(escritaNome.length > 0 && !escritaNome.includes('maquinaId'), 'a escrita do nome nao leva maquinaId', 'sim');
  const linhasDoBloco = escritaNome.split('\n').filter((l) => /registrar\(|erros\.push\(/.test(l));
  conferir(
    linhasDoBloco.length === 2 &&
      linhasDoBloco.every((l) => !/mudanca\.|achado|e\.message|String\(e\)/.test(l.replace('Object.keys(mudanca)', ''))),
    'registro e erro do nome levam so o nome dos campos, nunca o valor',
    `${linhasDoBloco.length} linha(s) conferida(s)`
  );

  reg('');
  reg('1.7 rotulo da maquina');
  conferir(C.rotuloValido('Notebook') === 'Notebook', 'Notebook vale', 'Notebook');
  conferir(C.rotuloValido('  Nuvem ') === 'Nuvem', 'espaco das pontas sai', 'Nuvem');
  conferir(C.rotuloValido('x'.repeat(40)) !== null && C.rotuloValido('x'.repeat(41)) === null, 'teto de 40', '40 sim, 41 nao');
  conferir(C.rotuloValido('Note\nbook') === null && C.rotuloValido('Note\u200bbook') === null, 'caractere de controle vira null', 'null');
  conferir(C.rotuloValido(7) === null && C.rotuloValido(null) === null && C.rotuloValido('') === null, 'nao texto ou vazio vira null', 'null');
  conferir(C.escolherRotulo('Escritorio', 'Notebook') === 'Escritorio', 'PONTE_ROTULO vale mais que o arquivo', 'Escritorio');
  conferir(C.escolherRotulo(undefined, 'Notebook') === 'Notebook', 'sem variavel, vale o arquivo', 'Notebook');
  conferir(C.escolherRotulo(undefined, undefined) === null, 'sem nada, null', 'null');

  // carregarConfig na pasta local da RODADA, com um config de mentira.
  writeFileSync(
    join(PL, 'config.json'),
    JSON.stringify({ maquinaId: 'maquina-de-prova', projectId: 'p', apiKey: 'chave-de-mentira', authDomain: 'd', appId: 'a', rotulo: 'Notebook' }),
    'utf8'
  );
  delete process.env['PONTE_ROTULO'];
  conferir(C.carregarConfig().rotulo === 'Notebook', 'carregarConfig le a chave rotulo', String(C.carregarConfig().rotulo));
  process.env['PONTE_ROTULO'] = 'Nuvem';
  conferir(C.carregarConfig().rotulo === 'Nuvem', 'carregarConfig: PONTE_ROTULO vale mais', String(C.carregarConfig().rotulo));
  delete process.env['PONTE_ROTULO'];
  // Independencia de ROTULO_DE_TESTE: processo novo, cada variavel sozinha.
  const urlConfig = new URL('../config.js', import.meta.url).href;
  const filho = (env: Record<string, string>): string => {
    const e: NodeJS.ProcessEnv = { ...process.env, ...env };
    if (!('PONTE_ROTULO' in env)) delete e['PONTE_ROTULO'];
    if (!('PONTE_ROTULO_TESTE' in env)) delete e['PONTE_ROTULO_TESTE'];
    const r = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `const c = await import(${JSON.stringify(urlConfig)}); console.log(JSON.stringify([c.ROTULO_DE_TESTE, c.carregarConfig().rotulo ?? null]));`],
      { env: e, encoding: 'utf8' }
    );
    return r.stdout.trim();
  };
  conferir(filho({ PONTE_ROTULO: 'Nuvem' }) === '[false,"Nuvem"]', 'PONTE_ROTULO nao liga ROTULO_DE_TESTE', filho({ PONTE_ROTULO: 'Nuvem' }));
  conferir(filho({ PONTE_ROTULO_TESTE: '1' }) === '[true,"Notebook"]', 'PONTE_ROTULO_TESTE nao mexe no rotulo', filho({ PONTE_ROTULO_TESTE: '1' }));

  fechar('PARTE 1');
}

// ---------------------------------------------------------------------------
if (PARTE === '2') {
  const fs = await import('firebase/firestore');
  const B = await import('../base.js');
  const { ROTULO_DE_TESTE } = await import('../config.js');
  type Maq = import('../tipos.js').Maquina;

  reg('');
  reg('PARTE 2, BASE REAL, com maquinas e fabricas DE TESTE (teste: true)');
  const s = selo();
  const A = `prova-ost15-a-${s}`;
  const OUTRA = `prova-ost15-b-${s}`;
  const FA = `prova-ost15-${s}-fabrica-a`;
  const FB = `prova-ost15-${s}-fabrica-b`;
  reg(`  maquina A ${A}, maquina B ${OUTRA}`);
  reg(`  ROTULO_DE_TESTE neste processo: ${ROTULO_DE_TESTE} (as escritas da prova levam teste: true por conta propria)`);

  const base = await B.initBase({ registrar: () => undefined });
  const db = base.db;
  const lerDoc = async (col: string, id: string): Promise<Record<string, unknown>> => {
    const d = await fs.getDoc(fs.doc(db, col, id));
    return d.exists() ? (d.data() as Record<string, unknown>) : {};
  };
  const ms = (v: unknown): number | null =>
    v !== null && typeof v === 'object' && 'toMillis' in (v as object) ? (v as { toMillis(): number }).toMillis() : null;

  // O papel da OUTRA ponte: maquina B viva, fabrica dela em execucao, comando pendente.
  await fs.setDoc(fs.doc(db, 'maquinas', OUTRA), {
    maquinaId: OUTRA,
    nome: 'prova ost15, outra ponte',
    rotulo: 'Nuvem',
    estadoPonte: 'online',
    vistoPorUltimo: fs.serverTimestamp(),
    teste: true,
  });
  for (const [id, maq] of [
    [FA, A],
    [FB, OUTRA],
  ] as const) {
    await fs.setDoc(fs.doc(db, 'fabricas', id), {
      fabricaId: id,
      maquinaId: maq,
      estado: 'em execucao',
      projeto: 'prova ost15',
      agente: 'prova',
      teste: true,
      atualizadoEm: fs.serverTimestamp(),
    });
  }
  const cA = await fs.addDoc(fs.collection(db, 'comandos'), {
    fabricaId: FA, maquinaId: A, texto: 'prova ost15, ninguem executa', situacao: 'pendente', criadoEm: fs.serverTimestamp(), origem: 'prova ost15', teste: true,
  });
  const cB = await fs.addDoc(fs.collection(db, 'comandos'), {
    fabricaId: FB, maquinaId: OUTRA, texto: 'prova ost15, ninguem executa', situacao: 'pendente', criadoEm: fs.serverTimestamp(), origem: 'prova ost15', teste: true,
  });
  const antesB = await lerDoc('maquinas', OUTRA);
  const antesFB = await lerDoc('fabricas', FB);
  reg(`  preparado: maquina B ${String(antesB['estadoPonte'])}, fabrica B ${String(antesFB['estado'])}, comandos ${cA.id} (A) e ${cB.id} (B)`);

  // 2.1 ouvirComandos da maquina A.
  const chegaram: string[] = [];
  const off = B.ouvirComandos(db, A, (id) => chegaram.push(id));
  await new Promise((r) => setTimeout(r, 6000));
  off();
  conferir(chegaram.includes(cA.id), 'ouvirComandos de A recebe o comando de A', `${chegaram.length} recebido(s)`);
  conferir(!chegaram.includes(cB.id), 'ouvirComandos de A NAO recebe o comando de B', 'nao recebeu');

  // 2.2 sinal de vida de A.
  const hb = B.iniciarHeartbeat(db, A, { nome: 'prova ost15, ponte A', rotulo: 'Prova', teste: true } as unknown as Partial<Maq>, 2000);
  await new Promise((r) => setTimeout(r, 5000));
  const maqA = await lerDoc('maquinas', A);
  conferir(maqA['estadoPonte'] === 'online' && maqA['rotulo'] === 'Prova', 'sinal de vida de A grava A, com rotulo', `${String(maqA['estadoPonte'])}, rotulo ${String(maqA['rotulo'])}`);

  // 2.3 reconciliacao de A, sem nenhuma sessao viva.
  const vivas = new Set<string>();
  const rec = await B.reconciliarPendentes(db, A, vivas);
  const fa1 = await lerDoc('fabricas', FA);
  const fb1 = await lerDoc('fabricas', FB);
  conferir(fa1['estado'] === 'ponte offline', 'reconciliacao de A marca a fabrica de A', `${String(fa1['estado'])}, ${rec.fabricasMarcadasOffline} marcada(s)`);
  conferir(
    fb1['estado'] === 'em execucao' && ms(fb1['atualizadoEm']) === ms(antesFB['atualizadoEm']),
    'reconciliacao de A NAO toca a fabrica de B',
    `${String(fb1['estado'])}, atualizadoEm igual`
  );

  // 2.4 parada de A, recebendo de proposito a fabrica de B na lista de vivas.
  await fs.setDoc(fs.doc(db, 'fabricas', FA), { estado: 'em execucao', atualizadoEm: fs.serverTimestamp() }, { merge: true });
  await hb.parar([FA, FB]);
  const fa2 = await lerDoc('fabricas', FA);
  const fb2 = await lerDoc('fabricas', FB);
  const maqA2 = await lerDoc('maquinas', A);
  const depoisB = await lerDoc('maquinas', OUTRA);
  conferir(fa2['estado'] === 'ponte offline' && maqA2['estadoPonte'] === 'offline', 'parada de A marca A offline e a fabrica de A', `${String(maqA2['estadoPonte'])}, ${String(fa2['estado'])}`);
  conferir(
    fb2['estado'] === 'em execucao' && ms(fb2['atualizadoEm']) === ms(antesFB['atualizadoEm']),
    'parada de A NAO toca a fabrica de B, mesmo recebendo o id dela',
    `${String(fb2['estado'])}, atualizadoEm igual`
  );
  conferir(
    depoisB['estadoPonte'] === 'online' && ms(depoisB['vistoPorUltimo']) === ms(antesB['vistoPorUltimo']) && depoisB['rotulo'] === 'Nuvem',
    'documento da maquina B nao mudou com nada que A fez',
    `${String(depoisB['estadoPonte'])}, vistoPorUltimo igual, rotulo ${String(depoisB['rotulo'])}`
  );

  // Fecho da prova: os dois comandos de teste saem de pendente, com nota. Nada
  // executou; a trilha fica. A fabrica de B vai para concluida, rotulada teste.
  for (const c of [cA, cB]) {
    await fs.updateDoc(c, { situacao: 'entregue', entregueEm: fs.serverTimestamp(), nota: 'prova ost15, fechado pela propria prova, nada executou' }).catch(() => undefined);
  }
  await fs.setDoc(fs.doc(db, 'fabricas', FB), { estado: 'concluida', atualizadoEm: fs.serverTimestamp() }, { merge: true }).catch(() => undefined);
  await fs.setDoc(fs.doc(db, 'maquinas', OUTRA), { estadoPonte: 'offline', vistoPorUltimo: fs.serverTimestamp() }, { merge: true }).catch(() => undefined);
  reg('  fecho: comandos de teste marcados entregues com nota, fabrica B concluida, maquina B offline; tudo rotulado teste');
  // Sem signOut de proposito: a sessao em arquivo e a da ponte de verdade.
  fechar('PARTE 2');
}

// ---------------------------------------------------------------------------
if (PARTE === '3') {
  reg('');
  reg('PARTE 3, varredura do codigo da ponte');
  const SRC = join(AQUI, '..', '..', 'src');
  const arquivos = readdirSync(SRC).filter((n) => n.endsWith('.ts'));
  const achados: string[] = [];
  for (const a of arquivos) {
    const t = readFileSync(join(SRC, a), 'utf8');
    for (const m of t.matchAll(/doc\(\s*db\s*,\s*'maquinas'\s*,\s*([^)]+)\)/g)) achados.push(`${a}: ${m[1]?.trim()}`);
    if (/collection\(\s*db\s*,\s*'maquinas'/.test(t)) achados.push(`${a}: CONSULTA em maquinas`);
  }
  conferir(achados.length > 0 && achados.every((x) => x.endsWith(': maquinaId')), "toda referencia a 'maquinas' usa o maquinaId da propria ponte", achados.join('; '));
  const base = readFileSync(join(SRC, 'base.ts'), 'utf8');
  const consultas = [...base.matchAll(/collection\(db, '(aprovacoes|fabricas|comandos)'\),\s*where\('(\w+)', '==', (\w+)\)/g)].map((m) => `${m[1]}:${m[2]}=${m[3]}`);
  conferir(
    consultas.includes('aprovacoes:maquinaId=maquinaId') && consultas.includes('fabricas:maquinaId=maquinaId') && consultas.includes('comandos:maquinaId=maquinaId'),
    'consultas de reconciliacao e de comandos filtram pelo maquinaId da ponte',
    consultas.join(', ')
  );
  const tranca = (base.match(/ehDaMaquina\(/g) ?? []).length;
  conferir(tranca >= 5, 'segunda tranca ehDaMaquina na reconciliacao (2), na parada (1) e no ouvinte (1)', `${tranca - 1} uso(s) mais a definicao`);
  fechar('PARTE 3');
}
