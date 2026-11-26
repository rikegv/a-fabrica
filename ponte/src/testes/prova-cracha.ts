// prova-cracha.ts, OST 16: o cracha por maquina, da ponte. Contrato em
// docs/ost16-contrato.md, condicoes P1 a P6, R4, R7, R9 e R10.
//
// PARTES, cada uma em processo proprio, porque a pasta local da ponte e decidida
// na hora do import:
//   SEM BASE (roda sempre): normalizacao do nome, forma do codigo, escolha do
//     caminho de entrada (com arquivo de verdade e o espiao de sessao.json), forma
//     do respondidoPor, e varredura do codigo.
//   EMULADOR (PONTE_EMULADOR=1, pula com PONTE_SEM_BASE=1): contra os emuladores
//     de auth (9199) e firestore (8099) da ponte, com a regra que estiver em
//     firebase/firestore.rules carregada neles. A prova faz o papel do DIRETOR e
//     do PAINEL; quem pede o cracha e o `pedirCracha.js` de verdade, e quem sobe
//     e a ponte de verdade, `ponte.js`, em processo separado.
//
// §A.17 pasta nova da rodada com data e hora, nada apagado, nada sobrescrito.
// §A.19 a pasta local de cada ponte e a fila vivem dentro da rodada.
// §A.9 e P6: a prova tira um retrato do que fica fora da pasta local antes e
// depois, e compara. A pasta real da ponte (~/.a-fabrica-ponte) nao e lida: so se
// confere que nao nasceu cracha nela.
//
// Uso: npm run prova:cracha:sem-base
//      npm run prova:cracha:emulador   (com os emuladores no ar)

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const ESTE = fileURLToPath(import.meta.url);
const DIST = join(AQUI, '..');
const SRC = join(AQUI, '..', '..', 'src');
const ESPIAO = pathToFileURL(join(AQUI, 'espiao-sessao.js')).href;
const PARTE = process.env['PONTE_PROVA_PARTE'] ?? '';
const RODADA = process.env['PONTE_RODADA'] ?? join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost16-prova-cracha`);
const SAIDA = join(RODADA, 'saida.txt');
const SELO = process.env['PONTE_PROVA_SELO'] ?? selo().replace('-', '');
const MAQ = `maquina-prova-ost16-${SELO}`;
const OUTRA = `maquina-prova-ost16-outra-${SELO}`;
const PL = join(RODADA, 'ponte-local');
const PL_OUTRA = join(RODADA, 'ponte-local-config-de-outra-maquina');
const DIRETOR_LOCAL = join(RODADA, 'diretor-local');
const PROJETO = 'a-fabrica-soulan';

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
function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function escreverConfig(pasta: string, maquinaId: string, extra: Record<string, string> = {}): void {
  mkdirSync(pasta, { recursive: true });
  writeFileSync(
    join(pasta, 'config.json'),
    JSON.stringify(
      { maquinaId, projectId: PROJETO, nomeMaquina: 'Escritório da prova', rotulo: 'Escritório', criadoEm: new Date().toISOString(), ...extra },
      null,
      2
    ),
    'utf8'
  );
}
/** Sentinelas: se alguem abrir, o espiao anota. Conteudo inventado, nao e sessao nenhuma. */
function escreverSentinelas(pasta: string): void {
  for (const n of ['sessao.json', 'sessao-emulador.json']) {
    writeFileSync(join(pasta, n), JSON.stringify({ sentinela: 'prova ost16, nao e sessao, ninguem deveria abrir' }), 'utf8');
  }
}
function linhasDoEspiao(arquivo: string): string[] {
  return existsSync(arquivo) ? readFileSync(arquivo, 'utf8').split('\n').filter((l) => l.trim().length > 0) : [];
}

// ---------------------------------------------------------------------------
// Orquestrador
// ---------------------------------------------------------------------------
if (PARTE === '') {
  mkdirSync(RODADA, { recursive: true });
  const base: NodeJS.ProcessEnv = { ...process.env, PONTE_RODADA: RODADA, PONTE_PROVA_SELO: SELO };
  delete base['PONTE_MAQUINA_ID'];
  delete base['PONTE_ROTULO'];
  let falhou = 0;
  const p1 = spawnSync(process.execPath, [ESTE], {
    stdio: 'inherit',
    env: { ...base, PONTE_PROVA_PARTE: 'sem-base', PONTE_PASTA_LOCAL: join(RODADA, 'sem-base-local'), PONTE_EMULADOR: '' },
  });
  if (p1.status !== 0) falhou++;
  if (process.env['PONTE_SEM_BASE'] !== '1') {
    const p2 = spawnSync(process.execPath, [ESTE], {
      stdio: 'inherit',
      env: { ...base, PONTE_PROVA_PARTE: 'emulador', PONTE_PASTA_LOCAL: DIRETOR_LOCAL, PONTE_EMULADOR: '1' },
    });
    if (p2.status !== 0) falhou++;
  } else {
    appendFileSync(SAIDA, 'PARTE EMULADOR pulada, PONTE_SEM_BASE=1\n', 'utf8');
  }
  const fim = falhou === 0 ? 'RESUMO GERAL: as partes passaram.' : `RESUMO GERAL: ${falhou} parte(s) com falha.`;
  console.log(fim);
  appendFileSync(SAIDA, `${fim}\n`, 'utf8');
  process.exit(falhou === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// SEM BASE
// ---------------------------------------------------------------------------
if (PARTE === 'sem-base') {
  const PLS = process.env['PONTE_PASTA_LOCAL'] as string;
  mkdirSync(PLS, { recursive: true });
  const ESPIAO_SB = join(RODADA, 'espiao-sem-base.txt');
  process.env['PONTE_ESPIAO_SAIDA'] = ESPIAO_SB;
  // Configuracao de mentira: nenhuma chamada de rede acontece nesta parte, todas
  // as recusas saem antes da troca de token.
  escreverConfig(PLS, 'maquina-prova-sem-base', { apiKey: 'chave-de-mentira', authDomain: 'mentira.local', appId: 'app-de-mentira' });
  escreverSentinelas(PLS);
  await import('./espiao-sessao.js');
  const K = await import('../cracha.js');
  const B = await import('../base.js');
  const I = await import('../identidade.js');

  reg(`prova do cracha da ponte, OST 16, ${new Date().toISOString()}`);
  reg(`rodada: ${RODADA}`);
  reg('');
  reg('PARTE SEM BASE');

  reg('');
  reg('1 normalizacao do nome e do rotulo, R11');
  conferir(K.normalizarParaPedido('Escritório', 60) === 'Escritorio', 'Escritório vira Escritorio', String(K.normalizarParaPedido('Escritório', 60)));
  conferir(K.normalizarParaPedido('São Paulo/Centro', 60) === 'Sao Paulo Centro', 'acento sai e barra vira espaco', String(K.normalizarParaPedido('São Paulo/Centro', 60)));
  conferir(K.normalizarParaPedido('Ação, ç e ü', 60) === 'Acao c e u', 'cedilha e trema saem', String(K.normalizarParaPedido('Ação, ç e ü', 60)));
  conferir(K.normalizarParaPedido('  nuvem  1  ', 60) === 'nuvem 1', 'espacos juntados e aparados', String(K.normalizarParaPedido('  nuvem  1  ', 60)));
  conferir(K.normalizarParaPedido('x'.repeat(90), 60)?.length === 60, 'corte em 60', String(K.normalizarParaPedido('x'.repeat(90), 60)?.length));
  conferir(K.normalizarParaPedido('y'.repeat(50), 40)?.length === 40, 'rotulo cortado em 40', String(K.normalizarParaPedido('y'.repeat(50), 40)?.length));
  conferir(K.normalizarParaPedido('\u0007\u200b', 60) === null && K.normalizarParaPedido('', 60) === null, 'so controle ou vazio vira null', 'null');
  conferir(K.normalizarParaPedido(12, 60) === null && K.normalizarParaPedido(null, 60) === null, 'nao texto vira null', 'null');
  const amostras = ['Escritório', 'Nüvem<script>', 'a/b\\c:d', '日本', 'ok.v1_2-3'];
  conferir(
    amostras.every((a) => {
      const n = K.normalizarParaPedido(a, 60);
      return n === null || K.FORMA_NOME.test(n);
    }),
    'toda saida casa ^[A-Za-z0-9 ._-]{1,60}$ ou e null',
    amostras.map((a) => JSON.stringify(K.normalizarParaPedido(a, 60))).join(', ')
  );

  reg('');
  reg('2 o pedido, campos exatos de R11');
  const ped = K.montarPedido({ uid: 'uid-de-prova-123456', maquinaId: 'maquina-notebook', nomeMaquina: 'Escritório', rotulo: 'Escritório', codigo: '012345' });
  conferir(JSON.stringify(Object.keys(ped).sort()) === '["codigo","maquinaId","nome","rotulo","uid"]', 'campos exatos (criadoEm entra na gravacao, hora do servidor)', Object.keys(ped).sort().join(', '));
  conferir(ped.nome === 'Escritorio' && ped.rotulo === 'Escritorio', 'no pedido, Escritório vira Escritorio', `${ped.nome}, ${String(ped.rotulo)}`);
  const semNome = K.montarPedido({ uid: 'u', maquinaId: 'maquina-x1', nomeMaquina: '日本', rotulo: null, codigo: '999999' });
  conferir(semNome.nome === 'maquina-x1' && semNome.rotulo === null, 'nome vazio depois da limpeza vira o maquinaId; rotulo ausente vira null', `${semNome.nome}, ${String(semNome.rotulo)}`);
  const ruins = ['maquina-Notebook', 'notebook', `maquina-${'a'.repeat(41)}`, 'maquina-', 'maquina-a_b'];
  conferir(
    ruins.every((m) => {
      try {
        K.montarPedido({ uid: 'u', maquinaId: m, nomeMaquina: 'n', rotulo: null, codigo: '000000' });
        return false;
      } catch {
        return true;
      }
    }),
    'maquinaId fora de ^maquina-[a-z0-9-]{1,40}$ e recusado antes da base, U5',
    ruins.join(', ')
  );

  reg('');
  reg('3 codigo de seis digitos, sorteado com crypto');
  const codigos = Array.from({ length: 3000 }, () => K.sortearCodigo());
  conferir(codigos.every((c) => /^[0-9]{6}$/.test(c)), 'todo codigo casa ^[0-9]{6}$', `${codigos.length} sorteio(s), exemplo ${codigos[0]}`);
  const distintos = new Set(codigos).size;
  conferir(distintos > 2900, 'sorteio espalhado', `${distintos} distintos em 3000`);
  const fonteCracha = readFileSync(join(SRC, 'cracha.ts'), 'utf8');
  conferir(/randomInt\(0, 1_000_000\)/.test(fonteCracha) && !/Math\.random/.test(fonteCracha), 'gerador e randomInt de node:crypto, nunca Math.random', 'sim');

  reg('');
  reg('4 escolha do caminho de entrada, P1');
  conferir(K.escolherCaminhoDeEntrada(true) === 'cracha' && K.escolherCaminhoDeEntrada(false) === 'sessao do diretor', 'cracha presente: cracha; ausente: caminho antigo', 'sim');
  const m1 = K.conferirMaquinaDoCracha('maquina-a', 'maquina-b');
  conferir(!m1.ok && /nao sobrepoe/.test(m1.ok ? '' : m1.motivo), 'PONTE_MAQUINA_ID diferente nao sobrepoe o cracha: nao sobe', m1.ok ? 'subiu' : m1.motivo);
  conferir(K.conferirMaquinaDoCracha('maquina-a', 'maquina-a').ok && K.conferirMaquinaDoCracha('maquina-a', undefined).ok, 'igual ou ausente segue', 'sim');
  conferir(!K.conferirMaquinaDoCracha(null, undefined).ok, 'config sem maquinaId: nao sobe', 'sim');
  const uidA = 'uidA';
  conferir(K.avaliarCracha({ uid: uidA, maquinaId: 'maquina-a', ativo: true }, uidA, 'maquina-a').ok, 'ativo, mesma conta e maquina: sobe', 'sim');
  conferir(!K.avaliarCracha({ uid: uidA, maquinaId: 'maquina-a', ativo: false }, uidA, 'maquina-a').ok, 'revogado: nao sobe', 'sim');
  conferir(!K.avaliarCracha({ uid: uidA, maquinaId: 'maquina-a', ativo: 'true' }, uidA, 'maquina-a').ok, 'ativo que nao e true exato: nao sobe', 'sim');
  conferir(!K.avaliarCracha({ uid: uidA, maquinaId: 'maquina-b', ativo: true }, uidA, 'maquina-a').ok, 'cracha de outra maquina: nao sobe', 'sim');
  conferir(!K.avaliarCracha({ uid: 'outro', maquinaId: 'maquina-a', ativo: true }, uidA, 'maquina-a').ok, 'documento de outra conta: nao sobe', 'sim');
  conferir(!K.avaliarCracha(null, uidA, 'maquina-a').ok, 'sem documento: nao sobe', 'sim');

  // Com arquivo de verdade: cracha.json ilegivel e sessao.json ao lado.
  writeFileSync(join(PLS, 'cracha.json'), JSON.stringify({ versao: 1, entradas: {} }), 'utf8');
  let recusa1 = '';
  try {
    await I.abrirIdentidade({ emulador: false, registrar: () => undefined });
    recusa1 = 'SUBIU, o que seria falha';
  } catch (e) {
    recusa1 = e instanceof I.IdentidadeRecusada ? e.message : `outro erro: ${String(e)}`;
  }
  conferir(/nao sobe com este cracha/.test(recusa1) && /ilegivel/.test(recusa1), 'cracha.json ilegivel: nao sobe, e nao cai para a sessao do diretor', recusa1);
  process.env['PONTE_MAQUINA_ID'] = 'maquina-de-outra';
  let recusa2 = '';
  try {
    await I.abrirIdentidade({ emulador: false, registrar: () => undefined });
    recusa2 = 'SUBIU';
  } catch (e) {
    recusa2 = e instanceof Error ? e.message : String(e);
  }
  delete process.env['PONTE_MAQUINA_ID'];
  conferir(/nao sobrepoe/.test(recusa2), 'com cracha, PONTE_MAQUINA_ID nao sobrepoe', recusa2);
  const SEGREDO = 'TOKEN-INVENTADO-DA-PROVA-0123456789abcdefghijklmnop';
  const chave = `firebase:authUser:chave-de-mentira:${I.NOME_APP}`;
  writeFileSync(
    join(PLS, 'cracha.json'),
    JSON.stringify({ versao: 1, entradas: { [chave]: { uid: 'u1', isAnonymous: false, stsTokenManager: { refreshToken: SEGREDO } } } }),
    'utf8'
  );
  let recusa3 = '';
  let relato3: string[] = [];
  try {
    await I.abrirIdentidade({ emulador: false, registrar: () => undefined });
    recusa3 = 'SUBIU';
  } catch (e) {
    recusa3 = e instanceof Error ? e.message : String(e);
    relato3 = e instanceof I.IdentidadeRecusada ? e.relato : [];
  }
  conferir(/nao e anonima/.test(recusa3), 'conta que nao e anonima no cracha: nao sobe', recusa3);
  conferir(relato3.length > 0 && !recusa3.includes(SEGREDO) && !relato3.join('\n').includes(SEGREDO),'P2: o token nao aparece na recusa nem no relato', `${relato3.length} linha(s) de relato conferida(s)`);
  const espiadas = linhasDoEspiao(ESPIAO_SB);
  conferir(espiadas.length === 0, 'P1: com cracha.json presente, sessao.json e sessao-emulador.json nao foram tocados', espiadas.length === 0 ? 'zero toque' : espiadas.join(' | '));

  reg('');
  reg('5 respondidoPor da ponte, R4 e P4');
  const FORMA_R4 = /^ponte, (tempo esgotado|reconciliacao|ordem do diretor pelo painel), maquina-[a-z0-9-]{1,40}$/;
  const tres = [
    B.respondidoPorDaPonte('tempo esgotado', 'maquina-notebook'),
    B.respondidoPorDaPonte('reconciliacao', 'maquina-notebook'),
    B.respondidoPorDaPonte('ordem do diretor pelo painel', 'maquina-notebook'),
  ];
  conferir(tres.every((t) => FORMA_R4.test(t)), 'os tres casam com a forma exata de R4', tres.join(' | '));
  conferir(tres[0] === 'ponte, tempo esgotado, maquina-notebook', 'texto exato do tempo esgotado', String(tres[0]));
  conferir(tres.every((t) => !t.includes('@')), 'P4: nenhum leva e-mail', 'sim');
  conferir(B.observacaoDaPonte('z'.repeat(500)).length === 300 && B.TETO_OBSERVACAO_DA_PONTE === 300, 'observacao cortada em 300', '300');

  reg('');
  reg('6 varredura do codigo');
  const fBase = readFileSync(join(SRC, 'base.ts'), 'utf8');
  const fRel = readFileSync(join(SRC, 'relatoriosBase.ts'), 'utf8');
  const fPonte = readFileSync(join(SRC, 'ponte.ts'), 'utf8');
  const fGanchos = readFileSync(join(SRC, 'ganchos.ts'), 'utf8');
  const fAcoes = readFileSync(join(SRC, 'acoes.ts'), 'utf8');
  const fIdent = readFileSync(join(SRC, 'identidade.ts'), 'utf8');
  const fPedir = readFileSync(join(SRC, 'pedirCracha.ts'), 'utf8');
  conferir(!/respondidoPor:\s*`[^`]*DIRETOR/.test(fBase), 'P4: base.ts nao grava respondidoPor com o e-mail do diretor', 'sim');
  const motivos = [...fBase.matchAll(/respondidoPorDaPonte\('([^']+)', maquinaId\)/g)].map((m) => m[1]);
  conferir(
    motivos.length === 3 && ['tempo esgotado', 'reconciliacao', 'ordem do diretor pelo painel'].every((m) => motivos.includes(m)),
    'as tres recusas usam respondidoPorDaPonte com o maquinaId da ponte',
    motivos.join(', ')
  );
  const recusar = fBase.slice(fBase.indexOf('export async function recusarAprovacoesDaFabrica'), fBase.indexOf('export async function lerConversaDaFabrica'));
  conferir(/where\('maquinaId', '==', maquinaId\)/.test(recusar), 'P3: recusarAprovacoesDaFabrica filtra por maquinaId', 'sim');
  const diario = fRel.slice(fRel.indexOf('export async function passadaDoDiario'), fRel.indexOf('export function iniciarDiario'));
  conferir(/where\('maquinaId', '==', maquinaId\)/.test(diario), 'P3: passadaDoDiario filtra por maquinaId', 'sim');
  // R9: toda consulta (query) dos modulos da ponte filtra por maquinaId.
  const consultas: string[] = [];
  for (const a of readdirSync(SRC).filter((n) => n.endsWith('.ts'))) {
    const t = readFileSync(join(SRC, a), 'utf8');
    for (const m of t.matchAll(/query\(\s*collection\(db, '(\w+)'\)([\s\S]*?)\)\s*;?\s*\n/g)) {
      consultas.push(`${a}:${m[1]}:${/where\('maquinaId', '==', maquinaId\)/.test(m[2] ?? '') ? 'filtra' : 'SEM FILTRO'}`);
    }
  }
  conferir(consultas.length >= 6 && consultas.every((c) => c.endsWith(':filtra')), 'R9: toda consulta em lista da ponte filtra por maquinaId', consultas.join(', '));
  conferir(/const aprovacaoId = randomUUID\(\);/.test(fPonte), 'P4: aprovacaoId e randomUUID de node:crypto, 122 bits sorteados', 'sim');
  const nascimentos = [...fGanchos.matchAll(/await atualizarFabrica\(db, fabricaId, \{\s*maquinaId,/g)].length;
  conferir(nascimentos === 2, 'R7: na fabrica mao-<sid>, abertura e conserto da fantasma nascem com maquinaId', `${nascimentos} de 2`);
  conferir(/acao === 'abrir' \? \{ maquinaId: mundo\.maquinaId/.test(fAcoes), 'R7: recusa da ordem de abrir nasce com maquinaId', 'sim');
  conferir(/doc\(db, 'fabricas', fabricaId\), \{ fabricaId, atualizadoEm/.test(fBase), 'R7: atualizarFabrica sempre leva fabricaId', 'sim');
  const crachaNaIdent = fIdent.slice(fIdent.indexOf('async function abrirComCracha'));
  conferir(!/CAMINHO_SESSAO|sessao\.json|ctxBase|ESCADA/.test(crachaNaIdent), 'P1: o caminho do cracha nao menciona sessao.json nem a escada', 'sim');
  const ramo = fIdent.indexOf("=== 'cracha') {");
  const sessaoAberta = fIdent.indexOf('const sessao = criarPersistenciaEmArquivo(emulador ? CAMINHO_SESSAO_EMULADOR : CAMINHO_SESSAO)');
  conferir(ramo > 0 && sessaoAberta > ramo, 'P1: a escolha do cracha acontece antes de qualquer abertura de sessao', `${ramo} antes de ${sessaoAberta}`);
  const vazamento = [fIdent, fPedir, fonteCracha]
    .join('\n')
    .split('\n')
    .filter((l) => /(registrar|dizer|console\.(log|error))\(/.test(l) && /refreshToken|stsTokenManager/.test(l));
  conferir(vazamento.length === 0, 'P2: nenhuma linha de registro leva token', vazamento.length === 0 ? 'nenhuma' : vazamento.join(' | '));
  conferir(/vigiarCracha\(/.test(fPonte) && /SAIDA_CRACHA_CAIU/.test(fPonte), 'a ponte vigia o cracha e sai com codigo proprio quando ele cai', 'sim');

  fechar('PARTE SEM BASE');
}

// ---------------------------------------------------------------------------
// EMULADOR, papel do diretor e do painel
// ---------------------------------------------------------------------------
if (PARTE === 'emulador') {
  const fs = await import('firebase/firestore');
  const B = await import('../base.js');
  const P = await import('../protecaoSessao.js');

  reg('');
  reg('PARTE EMULADOR');
  reg(`  maquina da prova ${MAQ}, outra maquina ${OUTRA}`);
  const regra = readFileSync(join(SRC, '..', '..', 'firebase', 'firestore.rules'), 'utf8');
  reg(`  regra carregada no emulador: firebase/firestore.rules de ${statSync(join(SRC, '..', '..', 'firebase', 'firestore.rules')).mtime.toISOString()}, ${regra.length} caractere(s), cracha(): ${/function cracha\(/.test(regra) ? 'sim' : 'NAO'}`);

  for (const [nome, url] of [
    ['auth', 'http://127.0.0.1:9199/'],
    ['firestore', 'http://127.0.0.1:8099/'],
  ] as const) {
    const ok = await fetch(url).then(
      () => true,
      () => false
    );
    if (!ok) {
      reg(`  o emulador de ${nome} nao responde em ${url}. Suba os emuladores antes desta parte.`);
      process.exit(1);
    }
  }

  // P6, retrato antes.
  const casa = homedir();
  const retrato = (): Record<string, string> => {
    const r: Record<string, string> = {};
    for (const n of readdirSync(casa)) r[`casa:${n}`] = 'existe';
    const ver = (c: string): void => {
      if (!existsSync(c)) return;
      const s = statSync(c);
      if (s.isDirectory()) {
        for (const n of readdirSync(c)) ver(join(c, n));
      } else r[c] = `${s.size}:${s.mtimeMs}`;
    };
    ver(join(casa, '.claude', 'settings.json'));
    ver(join(casa, '.claude', 'agents'));
    ver(join(process.env['APPDATA'] ?? join(casa, 'AppData', 'Roaming'), 'Antigravity', 'User', 'settings.json'));
    for (const n of ['cracha.json', 'cracha-emulador.json']) {
      r[`ponte-real:${n}`] = existsSync(join(casa, '.a-fabrica-ponte', n)) ? 'existe' : 'nao existe';
    }
    const raiz = join(SRC, '..');
    for (const n of readdirSync(raiz)) if (!n.startsWith('dist')) r[`ponte:${n}`] = 'existe';
    return r;
  };
  const antes = retrato();

  // As pastas locais desta rodada.
  escreverConfig(PL, MAQ);
  escreverSentinelas(PL);
  escreverConfig(DIRETOR_LOCAL, 'maquina-prova-ost16-diretor');
  // O usuario de teste do diretor pode ja existir no emulador, de rodada anterior,
  // com outra senha. Senha nova desta rodada, gravada na pasta da rodada e
  // aplicada a conta pela API de administracao do EMULADOR (so existe nele).
  {
    const { randomBytes } = await import('node:crypto');
    const { DIRETOR } = await import('../config.js');
    const senha = randomBytes(18).toString('base64url');
    writeFileSync(join(DIRETOR_LOCAL, 'emulador-usuario.json'), JSON.stringify({ senha, nota: 'usuario de teste do emulador, prova ost16' }), 'utf8');
    const admin = (caminho: string, corpo: unknown): Promise<Record<string, unknown>> =>
      fetch(`http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/projects/${PROJETO}/${caminho}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
        body: JSON.stringify(corpo),
      }).then((r) => r.json() as Promise<Record<string, unknown>>);
    const achado = await admin('accounts:lookup', { email: [DIRETOR] });
    const contas = Array.isArray(achado['users']) ? (achado['users'] as Array<Record<string, unknown>>) : [];
    for (const c of contas) await admin('accounts:update', { localId: c['localId'], password: senha, emailVerified: true });
    reg(`  usuario de teste do diretor no emulador: ${contas.length === 0 ? 'nasce nesta rodada' : 'ja existia, senha desta rodada aplicada'}`);
  }
  const base = await B.initBase({ emulador: true, registrar: () => undefined });
  const db = base.db;
  reg(`  diretor de teste no emulador: ${base.identidade.usuario.email}, degrau ${base.identidade.degrau}`);

  type Fim = { codigo: number | null; saida: string };
  const lancar = (args: string[], env: NodeJS.ProcessEnv, espiao: string | null): { fim: Promise<Fim>; filho: ReturnType<typeof spawn> } => {
    const e: NodeJS.ProcessEnv = { ...process.env, PONTE_EMULADOR: '1', PONTE_PASTA_LOCAL: PL, ...env };
    delete e['PONTE_PASTA_FILA_GANCHOS'];
    if (!('PONTE_MAQUINA_ID' in env)) delete e['PONTE_MAQUINA_ID'];
    if (espiao !== null) e['PONTE_ESPIAO_SAIDA'] = espiao;
    const filho = spawn(process.execPath, [...(espiao !== null ? ['--import', ESPIAO] : []), ...args], { env: e, stdio: ['pipe', 'pipe', 'pipe'] });
    let saida = '';
    filho.stdout?.on('data', (d: Buffer) => (saida += d.toString('utf8')));
    filho.stderr?.on('data', (d: Buffer) => (saida += d.toString('utf8')));
    const fim = new Promise<Fim>((resolve) => filho.on('exit', (c) => resolve({ codigo: c, saida })));
    return { fim, filho };
  };
  const node = (args: string[], env: NodeJS.ProcessEnv, espiao: string | null): Promise<Fim> => lancar(args, env, espiao).fim;
  const guardar = (nome: string, texto: string): void => writeFileSync(join(RODADA, nome), texto, 'utf8');

  // 1. Pedido.
  reg('');
  reg('E1 pedido do cracha, `pedirCracha.js` de verdade');
  const espiaoPedido = join(RODADA, 'espiao-pedido.txt');
  const pedidoP = node([join(DIST, 'pedirCracha.js'), '--emulador'], { PONTE_CRACHA_ESPERA_MS: '180000' }, espiaoPedido);
  let codigo = '';
  let conta = '';
  const pedidoAte = Date.now() + 60000;
  let achado: { id: string; dado: Record<string, unknown> } | null = null;
  while (Date.now() < pedidoAte && achado === null) {
    await dormir(1500);
    const q = await fs.getDocs(fs.query(fs.collection(db, 'pedidosDeCracha'), fs.where('maquinaId', '==', MAQ)));
    if (q.size > 0) achado = { id: q.docs[0]!.id, dado: q.docs[0]!.data() as Record<string, unknown> };
  }
  if (achado === null) {
    reg('  FALHOU: o pedido nao chegou na base em 60 s');
    process.exit(1);
  }
  await dormir(1500);
  const keys = Object.keys(achado.dado).sort();
  conferir(JSON.stringify(keys) === '["codigo","criadoEm","maquinaId","nome","rotulo","uid"]', 'pedido com os campos exatos de R11', keys.join(', '));
  conferir(achado.dado['uid'] === achado.id, 'uid do pedido e o id do documento', String(achado.id).slice(0, 8));
  conferir(achado.dado['nome'] === 'Escritorio da prova' && achado.dado['rotulo'] === 'Escritorio', 'nome e rotulo sem acento no pedido', `${String(achado.dado['nome'])}, ${String(achado.dado['rotulo'])}`);
  conferir(/^[0-9]{6}$/.test(String(achado.dado['codigo'])), 'codigo de seis digitos', 'sim');
  codigo = String(achado.dado['codigo']);
  conta = achado.id.slice(0, 8);
  const uid = achado.id;
  conferir(existsSync(join(PL, 'cracha-emulador.json')) && !existsSync(join(PL, 'cracha.json')), 'conta anonima guardada em cracha-emulador.json na pasta local da rodada', 'sim');
  conferir(P.conferirProtecao(join(PL, 'cracha-emulador.json')).protegido, 'P2: o arquivo do cracha esta trancado para o dono', P.conferirProtecao(join(PL, 'cracha-emulador.json')).motivo);

  // 2. Emissao pelo diretor, como o painel faz.
  reg('');
  reg('E2 emissao simulada pelo diretor');
  await fs.setDoc(fs.doc(db, 'crachas', uid), {
    uid,
    maquinaId: MAQ,
    rotulo: 'Escritorio',
    ativo: true,
    emitidoEm: fs.serverTimestamp(),
    emitidoPor: 'painel, prova da OST 16 no papel do diretor',
  });
  const fimPedido = await pedidoP;
  guardar('saida-pedido.txt', fimPedido.saida);
  conferir(fimPedido.saida.includes(`CODIGO DO PEDIDO:  ${codigo}`) && fimPedido.saida.includes(`CONTA:             ${conta}`), 'P5: o terminal mostrou o codigo e os 8 primeiros caracteres do uid', `${codigo}, ${conta}`);
  conferir(fimPedido.saida.includes(`MAQUINA:           ${MAQ}`) && fimPedido.saida.includes('ROTULO:            Escritorio'), 'o terminal mostrou maquina e rotulo', 'sim');
  conferir(fimPedido.codigo === 0 && /cracha emitido/.test(fimPedido.saida), 'pedido termina com cracha emitido, saida 0', `saida ${String(fimPedido.codigo)}`);
  const tokenNoTerminal = /AMf-|eyJ/.test(fimPedido.saida);
  conferir(!tokenNoTerminal, 'P2: nada com cara de token no terminal', 'sim');

  const deNovo = await node([join(DIST, 'pedirCracha.js'), '--emulador'], {}, espiaoPedido);
  guardar('saida-pedido-de-novo.txt', deNovo.saida);
  const contagem = (await fs.getDocs(fs.query(fs.collection(db, 'pedidosDeCracha'), fs.where('maquinaId', '==', MAQ)))).size;
  conferir(deNovo.codigo === 0 && /ja tem arquivo de cracha/.test(deNovo.saida) && contagem === 1, 'com cracha.json, nao cria outro e confere o estado', `saida ${String(deNovo.codigo)}, ${contagem} pedido(s)`);

  // Tempo esgotado, numa pasta local propria e com prazo de prova de 4 segundos.
  const PL_TEMPO = join(RODADA, 'ponte-local-tempo-esgotado');
  escreverConfig(PL_TEMPO, `maquina-prova-ost16-tempo-${SELO}`);
  const tempo = await node([join(DIST, 'pedirCracha.js'), '--emulador'], { PONTE_PASTA_LOCAL: PL_TEMPO, PONTE_CRACHA_ESPERA_MS: '4000' }, espiaoPedido);
  guardar('saida-pedido-tempo-esgotado.txt', tempo.saida);
  conferir(tempo.codigo === 3 && /tempo esgotado/.test(tempo.saida), 'sem emissao no prazo: tempo esgotado, saida 3, falha fechada', `saida ${String(tempo.codigo)}`);

  // 3. Preparo do diretor: fabrica e pedido de outra maquina, comando para esta.
  const s = SELO;
  const FA = `prova-ost16-${s}-fabrica-a`;
  const FB = `prova-ost16-${s}-fabrica-b`;
  const CMD = `prova-ost16-${s}-comando`;
  const APB = `prova-ost16-${s}-aprovacao-de-outra`;
  await fs.setDoc(fs.doc(db, 'fabricas', FB), { fabricaId: FB, maquinaId: OUTRA, estado: 'em execucao', projeto: 'prova ost16', agente: 'prova', teste: true, atualizadoEm: fs.serverTimestamp() });
  await fs.setDoc(fs.doc(db, 'comandos', CMD), {
    comandoId: CMD, fabricaId: FA, maquinaId: MAQ, texto: 'prova ost16, ninguem executa', situacao: 'pendente', criadoEm: fs.serverTimestamp(),
    origem: 'prova ost16 no papel do diretor', cwd: RODADA, conversationId: null, entregueEm: null,
  });
  await fs.setDoc(fs.doc(db, 'aprovacoes', APB), {
    aprovacaoId: APB, fabricaId: FB, maquinaId: OUTRA, situacao: 'pendente', resposta: null, observacao: null, respondidoEm: null, respondidoPor: null,
    criadoEm: fs.serverTimestamp(), origem: 'ponte', pacote: { marcacao: 'prova ost16' },
  });
  const antesFB = (await fs.getDoc(fs.doc(db, 'fabricas', FB))).data() as Record<string, unknown>;

  // 4. Escritas reais da ponte, com o cracha, em processo proprio sob o espiao.
  reg('');
  reg('E3 escritas reais da ponte com o cracha');
  const espiaoEscritas = join(RODADA, 'espiao-escritas.txt');
  const escritas = await node([ESTE], { PONTE_PROVA_PARTE: 'escritas', PONTE_RODADA: RODADA, PONTE_PROVA_SELO: SELO }, espiaoEscritas);
  guardar('saida-escritas.txt', escritas.saida);
  let r: Record<string, unknown> = {};
  try {
    r = JSON.parse(readFileSync(join(RODADA, 'escritas.json'), 'utf8')) as Record<string, unknown>;
  } catch {
    reg(`  FALHOU: a parte de escritas nao deixou resultado (saida ${String(escritas.codigo)})`);
  }
  for (const [k, v] of Object.entries(r)) {
    const caso = v as { ok: boolean; detalhe: string };
    conferir(caso.ok, k, caso.detalhe);
  }
  const fa = (await fs.getDoc(fs.doc(db, 'fabricas', FA))).data() as Record<string, unknown> | undefined;
  conferir(fa?.['maquinaId'] === MAQ && fa?.['fabricaId'] === FA, 'R7: a fabrica nasceu com maquinaId e fabricaId', `${String(fa?.['maquinaId'])}`);
  const fb = (await fs.getDoc(fs.doc(db, 'fabricas', FB))).data() as Record<string, unknown>;
  const ms = (v: unknown): number | null => (v !== null && typeof v === 'object' && 'toMillis' in (v as object) ? (v as { toMillis(): number }).toMillis() : null);
  conferir(fb['estado'] === antesFB['estado'] && ms(fb['atualizadoEm']) === ms(antesFB['atualizadoEm']) && fb['maquinaId'] === OUTRA, 'a fabrica da outra maquina nao mudou', `${String(fb['estado'])}, ${String(fb['maquinaId'])}`);
  const apb = (await fs.getDoc(fs.doc(db, 'aprovacoes', APB))).data() as Record<string, unknown>;
  conferir(apb['situacao'] === 'pendente', 'o pedido da outra maquina continua pendente', String(apb['situacao']));
  conferir(!(await fs.getDoc(fs.doc(db, 'maquinas', OUTRA))).exists(), 'R10: o cracha nao criou o documento da outra maquina', 'nao existe');
  conferir(linhasDoEspiao(espiaoEscritas).length === 0, 'P1: nas escritas, sessao.json nao foi tocado', linhasDoEspiao(espiaoEscritas).join(' | ') || 'zero toque');

  // 5. A ponte de verdade.
  reg('');
  reg('E4 a ponte de verdade sobe com o cracha, e nao sobe quando nao deve');
  const PONTE = join(DIST, 'ponte.js');
  const espiaoPonte = join(RODADA, 'espiao-ponte.txt');
  const comOutraNoAmbiente = await node([PONTE], { PONTE_MAQUINA_ID: OUTRA }, espiaoPonte);
  guardar('saida-ponte-com-maquina-no-ambiente.txt', comOutraNoAmbiente.saida);
  conferir(comOutraNoAmbiente.codigo !== 0 && /nao sobrepoe/.test(comOutraNoAmbiente.saida), 'P1: PONTE_MAQUINA_ID de outra maquina nao sobrepoe o cracha, a ponte nao sobe', `saida ${String(comOutraNoAmbiente.codigo)}`);

  escreverConfig(PL_OUTRA, OUTRA);
  copyFileSync(join(PL, 'cracha-emulador.json'), join(PL_OUTRA, 'cracha-emulador.json'));
  P.aplicarProtecao(PL_OUTRA);
  const deOutra = await node([PONTE], { PONTE_PASTA_LOCAL: PL_OUTRA }, espiaoPonte);
  guardar('saida-ponte-config-de-outra-maquina.txt', deOutra.saida);
  conferir(deOutra.codigo !== 0 && /emitido para outra maquina/.test(deOutra.saida), 'P1: cracha de outra maquina, a ponte nao sobe', `saida ${String(deOutra.codigo)}`);

  const lancada = lancar([PONTE], { PONTE_CWD: join(RODADA, 'projeto') }, espiaoPonte);
  const viva = lancada.fim;
  const filhoVivo = lancada.filho;
  let noAr = false;
  for (let i = 0; i < 60 && !noAr; i++) {
    await dormir(1000);
    const m = await fs.getDoc(fs.doc(db, 'maquinas', MAQ));
    noAr = m.exists() && m.data()['estadoPonte'] === 'online' && existsSync(join(PL, 'registros'));
  }
  await dormir(3000);
  const maqViva = (await fs.getDoc(fs.doc(db, 'maquinas', MAQ))).data() as Record<string, unknown> | undefined;
  conferir(noAr && filhoVivo.exitCode === null, 'a ponte subiu com o cracha e bateu o sinal de vida', `estadoPonte ${String(maqViva?.['estadoPonte'])}, rotulo ${String(maqViva?.['rotulo'])}`);

  // 6. Revogacao.
  await fs.updateDoc(fs.doc(db, 'crachas', uid), { ativo: false, revogadoEm: fs.serverTimestamp(), revogadoPor: 'painel, prova da OST 16 no papel do diretor' });
  const corrida = await Promise.race([viva, dormir(60000).then(() => null)]);
  if (corrida === null) filhoVivo.kill('SIGKILL');
  const fimViva = corrida ?? (await viva);
  guardar('saida-ponte-viva.txt', fimViva.saida);
  conferir(corrida !== null && fimViva.codigo === 8 && /cracha caiu/.test(fimViva.saida), 'cracha revogado derruba a ponte no ar, saida 8, com motivo', `saida ${String(fimViva.codigo)}`);
  conferir(/degrau cracha/.test(fimViva.saida) && !/sessao salva encontrada/.test(fimViva.saida), 'a ponte entrou pelo cracha, nao pela sessao', 'sim');

  const revogada = await node([PONTE], {}, espiaoPonte);
  guardar('saida-ponte-revogada.txt', revogada.saida);
  conferir(revogada.codigo !== 0 && /revogado/.test(revogada.saida), 'cracha revogado: a ponte nao sobe, e diz por que', `saida ${String(revogada.codigo)}`);
  const pedidoRevogado = await node([join(DIST, 'pedirCracha.js'), '--emulador'], {}, espiaoPedido);
  guardar('saida-pedido-revogado.txt', pedidoRevogado.saida);
  conferir(pedidoRevogado.codigo === 6 && /revogado/.test(pedidoRevogado.saida), 'npm run cracha com cracha revogado diz revogado, saida 6', `saida ${String(pedidoRevogado.codigo)}`);

  const toques = [...linhasDoEspiao(espiaoPonte), ...linhasDoEspiao(espiaoPedido)];
  conferir(toques.length === 0, 'P1: nem a ponte nem o pedido tocaram sessao.json, com a sentinela ao lado', toques.join(' | ') || 'zero toque');

  // 7. P6, retrato depois.
  const depois = retrato();
  const mudou = [...new Set([...Object.keys(antes), ...Object.keys(depois)])].filter((k) => antes[k] !== depois[k]);
  writeFileSync(join(RODADA, 'retrato-p6.json'), JSON.stringify({ antes, depois, mudou }, null, 2), 'utf8');
  conferir(mudou.length === 0, 'P6: nada mudou fora da pasta local da rodada (casa, ~/.claude, Antigravity, pasta real da ponte, ponte/)', mudou.join(', ') || 'nada');
  fechar('PARTE EMULADOR');
}

// ---------------------------------------------------------------------------
// ESCRITAS, a ponte com o cracha (processo filho da parte do emulador)
// ---------------------------------------------------------------------------
if (PARTE === 'escritas') {
  const { randomUUID } = await import('node:crypto');
  const fs = await import('firebase/firestore');
  const B = await import('../base.js');
  const RB = await import('../relatoriosBase.js');
  const R = await import('../relatorios.js');
  const resultado: Record<string, { ok: boolean; detalhe: string }> = {};
  const caso = (nome: string, ok: boolean, detalhe: string): void => {
    resultado[nome] = { ok, detalhe };
    console.log(`${ok ? 'ok' : 'FALHOU'} ${nome}: ${detalhe}`);
  };
  const negado = async (f: () => Promise<unknown>): Promise<string> => {
    try {
      await f();
      return 'ACEITO';
    } catch (e) {
      return typeof e === 'object' && e !== null ? String((e as Record<string, unknown>)['code'] ?? e) : String(e);
    }
  };
  const s = SELO;
  const FA = `prova-ost16-${s}-fabrica-a`;
  const FB = `prova-ost16-${s}-fabrica-b`;
  const CMD = `prova-ost16-${s}-comando`;
  const APB = `prova-ost16-${s}-aprovacao-de-outra`;
  try {
    const base = await B.initBase({ emulador: true, registrar: (l) => console.log(`[identidade] ${l}`) });
    const db = base.db;
    caso('a ponte entra com o cracha, nao com a sessao', base.identidade.degrau === 'cracha' && base.identidade.cracha?.maquinaId === MAQ, `degrau ${base.identidade.degrau}`);

    // R7: primeira gravacao com maquinaId, pelo mesmo caminho da sessao (dadosIniciais).
    await B.atualizarFabrica(db, FA, { maquinaId: MAQ, projeto: 'prova ost16', estado: 'em execucao', agente: 'prova', teste: true } as never);
    await B.somarConsumoDaFabrica(db, FA, { entrada: 10, saida: 5 });
    await B.publicarAtividade(db, FA, { seq: 0, tipo: 'init', ferramenta: null, subagente: false, inicioSubagente: false } as never);
    caso('R6 e R7: fabrica nasce, soma consumo e publica atividade', true, FA);
    const semMaquina = await negado(() => B.atualizarFabrica(db, `prova-ost16-${s}-sem-maquina`, { estado: 'em execucao' }));
    caso('R7: fabrica nova sem maquinaId e negada', semMaquina !== 'ACEITO', semMaquina);
    const trocar = await negado(() => B.atualizarFabrica(db, FA, { maquinaId: OUTRA } as never));
    caso('R7: update que troca maquinaId e negado', trocar !== 'ACEITO', trocar);

    // R10: sinal de vida.
    const hb = B.iniciarHeartbeat(db, MAQ, { nome: 'Escritorio da prova', rotulo: 'Escritorio' }, 1500);
    await dormir(2500);
    const maq = await fs.getDoc(fs.doc(db, 'maquinas', MAQ));
    caso('R10: sinal de vida na propria maquina', maq.exists() && maq.data()['estadoPonte'] === 'online', String(maq.data()?.['estadoPonte']));
    const outraMaq = await negado(() => fs.setDoc(fs.doc(db, 'maquinas', OUTRA), { maquinaId: OUTRA, estadoPonte: 'online', vistoPorUltimo: fs.serverTimestamp() }, { merge: true }));
    caso('R10: sinal de vida em outra maquina e negado', outraMaq !== 'ACEITO', outraMaq);

    // Comando.
    const c = await B.tomarComando(db, CMD);
    caso('comando da propria maquina e tomado e marcado entregue', c !== null && c.fabricaId === FA, c === null ? 'nao tomou' : 'tomado');
    const criarCmd = await negado(() => fs.setDoc(fs.doc(db, 'comandos', `prova-ost16-${s}-cmd-do-cracha`), {
        fabricaId: FA, maquinaId: MAQ, texto: 'x', situacao: 'pendente', criadoEm: fs.serverTimestamp(), origem: 'cracha', entregueEm: null,
      }));
    caso('o cracha nunca cria comando', criarCmd !== 'ACEITO', criarCmd);

    // Recusas da ponte, R4.
    const pacote = { marcacao: 'prova ost16' } as never;
    const A1 = randomUUID();
    await B.publicarAprovacao(db, A1, { fabricaId: FA, maquinaId: MAQ, origem: 'ponte', pacote });
    const d1 = await B.esperarResposta(db, A1, MAQ, 1500);
    const a1 = (await fs.getDoc(fs.doc(db, 'aprovacoes', A1))).data() as Record<string, unknown>;
    caso('R4: recusa por tempo esgotado passa, com respondidoPor exato', d1.decisao === 'deny' && a1['resposta'] === 'recusado' && a1['respondidoPor'] === `ponte, tempo esgotado, ${MAQ}`, String(a1['respondidoPor']));
    const A2 = randomUUID();
    await B.publicarAprovacao(db, A2, { fabricaId: FA, maquinaId: MAQ, origem: 'ponte', pacote });
    const n2 = await B.recusarAprovacoesDaFabrica(db, FA, 'fabrica encerrada por ordem do diretor antes da resposta, prova ost16', MAQ);
    const a2 = (await fs.getDoc(fs.doc(db, 'aprovacoes', A2))).data() as Record<string, unknown>;
    caso('R4 e P3: recusa por ordem do painel passa, consulta filtrada', n2 === 1 && a2['respondidoPor'] === `ponte, ordem do diretor pelo painel, ${MAQ}`, `${n2} recusado(s), ${String(a2['respondidoPor'])}`);
    const A3 = randomUUID();
    await B.publicarAprovacao(db, A3, { fabricaId: FA, maquinaId: MAQ, origem: 'ponte', pacote });
    const resposta = (resp: string, quem: string): Promise<unknown> =>
      fs.updateDoc(fs.doc(db, 'aprovacoes', A3), { situacao: 'respondida', resposta: resp, observacao: 'prova', respondidoEm: fs.serverTimestamp(), respondidoPor: quem });
    const ap = await negado(() => resposta('aprovado', `ponte, tempo esgotado, ${MAQ}`));
    caso('R4: o cracha tentando gravar aprovado e negado', ap !== 'ACEITO', ap);
    const apObs = await negado(() => resposta('aprovado com observacao', `ponte, tempo esgotado, ${MAQ}`));
    caso('R4: aprovado com observacao tambem e negado', apObs !== 'ACEITO', apObs);
    const outroMotivo = await negado(() => resposta('recusado', `ponte, qualquer motivo, ${MAQ}`));
    caso('R4: respondidoPor fora dos tres motivos e negado', outroMotivo !== 'ACEITO', outroMotivo);
    const outraNoTexto = await negado(() => resposta('recusado', `ponte, tempo esgotado, ${OUTRA}`));
    caso('R4: respondidoPor com outra maquina e negado', outraNoTexto !== 'ACEITO', outraNoTexto);
    const longa = await negado(() =>
      fs.updateDoc(fs.doc(db, 'aprovacoes', A3), { situacao: 'respondida', resposta: 'recusado', observacao: 'o'.repeat(301), respondidoEm: fs.serverTimestamp(), respondidoPor: `ponte, tempo esgotado, ${MAQ}` })
    );
    caso('R4: observacao acima de 300 e negada', longa !== 'ACEITO', longa);
    const rec = await B.reconciliarPendentes(db, MAQ, new Set<string>());
    const a3 = (await fs.getDoc(fs.doc(db, 'aprovacoes', A3))).data() as Record<string, unknown>;
    caso('R4: recusa da reconciliacao passa', rec.aprovacoesRecusadas >= 1 && a3['respondidoPor'] === `ponte, reconciliacao, ${MAQ}` && a3['resposta'] === 'recusado', String(a3['respondidoPor']));
    const deOutra = await negado(() =>
      fs.updateDoc(fs.doc(db, 'aprovacoes', APB), { situacao: 'respondida', resposta: 'recusado', observacao: 'prova', respondidoEm: fs.serverTimestamp(), respondidoPor: `ponte, reconciliacao, ${MAQ}` })
    );
    caso('pedido de outra maquina nao pode ser recusado pelo cracha', deOutra !== 'ACEITO', deOutra);

    // Fabrica de outra maquina.
    const lerB = await negado(() => fs.getDoc(fs.doc(db, 'fabricas', FB)));
    caso('fabrica de outra maquina: leitura negada', lerB !== 'ACEITO', lerB);
    const conversa = await B.lerConversaDaFabrica(db, FB).then(
      (v) => `devolveu ${String(v)}`,
      () => 'LANCOU'
    );
    caso('leitura negada vira "nao e minha" sem derrubar nada', conversa === 'devolveu null', conversa);
    const escreverB = await negado(() => B.atualizarFabrica(db, FB, { estado: 'falhou' }));
    caso('fabrica de outra maquina: escrita negada', escreverB !== 'ACEITO', escreverB);
    const atividadeB = await negado(() => B.publicarAtividade(db, FB, { seq: 0, tipo: 'init', ferramenta: null, subagente: false, inicioSubagente: false } as never));
    caso('R6: atividade em fabrica de outra maquina negada', atividadeB !== 'ACEITO', atividadeB);
    const liberado = join(RODADA, 'ganchos-sem-ignorados');
    mkdirSync(liberado, { recursive: true });
    writeFileSync(join(liberado, 'ganchos.json'), JSON.stringify({ projetosIgnorados: [] }), 'utf8');
    const fechB = await RB.fechamentoDoPainel(
      db,
      { fabricaId: FB, maquinaId: MAQ, sessao: 's', texto: '## O que foi solicitado\nx\n## O que foi feito\nx\n## O que ficou faltando\nx\n## Proximo passo\nx', inicio: null, fim: new Date().toISOString(), cwd: 'C:\\prova-ost16' },
      liberado
    ).then(
      (v) => v,
      (e: unknown) => `LANCOU ${String(e)}`
    );
    caso('fechamento de fabrica de outra maquina vira "nao e minha", nao lanca e nao grava', fechB === 'fabrica de outra maquina', fechB);

    // R9: consultas sem filtro de maquina sao negadas.
    const semFiltroA = await negado(() => fs.getDocs(fs.query(fs.collection(db, 'aprovacoes'), fs.where('situacao', '==', 'pendente'))));
    caso('R9: consulta de aprovacoes sem filtro de maquina negada', semFiltroA !== 'ACEITO', semFiltroA);
    const semFiltroR = await negado(() => fs.getDocs(fs.query(fs.collection(db, 'relatorios'), fs.where('fabricaId', '==', FA))));
    caso('R9: consulta de relatorios so por fabricaId (o jeito antigo) negada', semFiltroR !== 'ACEITO', semFiltroR);
    const semFiltroF = await negado(() => fs.getDocs(fs.query(fs.collection(db, 'fabricas'), fs.where('estado', '==', 'em execucao'))));
    caso('R9: consulta de fabricas sem filtro de maquina negada', semFiltroF !== 'ACEITO', semFiltroF);

    // Relatorios: fechamento direto e diario pela passada de verdade.
    const idF = `prova-ost16-${s}-fechamento`;
    const g = await B.atualizarFabrica(db, FA, { estado: 'em execucao' }).then(() => RB.gravarRelatorio(db, idF, { tipo: 'fechamento', fabricaId: FA, maquinaId: MAQ, texto: 'prova ost16', rodadaFim: new Date().toISOString(), teste: true }));
    caso('relatorio da propria maquina e gravado', g === 'gravado', g);
    const livro = R.livroDaPonte();
    const ontem = R.somarDias(R.diaDaJanela(new Date()) as string, -1);
    livro.desde = new Date(Date.now() - 4 * 86400000).toISOString();
    const meio = new Date(new Date(R.janelaDoDia(ontem).inicio).getTime() + 3600000).toISOString();
    R.anotarPasso(livro, FA, meio);
    const nDiario = await RB.passadaDoDiario(db, MAQ, new Date(), (l) => console.log(`[diario] ${l}`));
    caso('P3: passada do diario, com consulta filtrada, grava o diario', nDiario === 1, `${nDiario} diario(s)`);

    await hb.parar([FA, FB]);
    const maqOff = await fs.getDoc(fs.doc(db, 'maquinas', MAQ));
    caso('parada da ponte com fabrica de outra maquina na lista: nao lanca, marca so a sua', maqOff.data()?.['estadoPonte'] === 'offline', String(maqOff.data()?.['estadoPonte']));
  } catch (e) {
    caso('a parte de escritas rodou ate o fim', false, e instanceof Error ? e.message.slice(0, 300) : String(e));
  }
  writeFileSync(join(RODADA, 'escritas.json'), JSON.stringify(resultado, null, 2), 'utf8');
  process.exit(0);
}
