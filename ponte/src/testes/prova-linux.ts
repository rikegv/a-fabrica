// prova-linux.ts, OST 14: a ponte em Linux posta a prova, sem rede e sem base.
//
// Escrita pelo TESTER da OST 14. Cada parte tem caso de acerto E caso de recusa.
//   PARTE 1 lerColagem, o login por codigo colado, com entrada pendente FALSA
//   PARTE 2 conferirProtecao no Linux, com pastas e arquivos da rodada
//   PARTE 3 caminhoComparavel, dentroDaPasta e o gancho pelo comportamento
//   PARTE 4 caminhoDentroDasTranscricoes, com casa falsa
//   PARTE 5 risco() de ponte.ts, verbos de Linux
//   PARTE 6 a trava da maquina, com PONTE_TRAVA_MAQUINA na rodada
//   PARTE 7 os lancadores de verdade, pelo sudo, como fabrica-ponte
//   PARTE 8 ligar-ganchos.mjs e desligar-ganchos.mjs contra uma casa FALSA
//
// Sem rede. Sem base. Nada do projeto da nuvem. Nao le /var/lib/a-fabrica-ponte.
// Nao sobe, nao para e nao reinicia servico. Nao toca o ~/.claude/settings.json
// real: so le tamanho e hora dele, antes e depois, para provar que nao mudou.
//
// §A.17 pasta nova da rodada, com data e hora. Nada apagado, nada sobrescrito.
// §A.18 nenhum apagamento nesta prova.
//
// Uso: cd ponte && npx tsc -p tsconfig.json && node dist/testes/prova-linux.js
//      PONTE_RODADA=<pasta> para escolher a pasta da rodada

import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ESTE = fileURLToPath(import.meta.url);
const GANCHO = join(AQUI, '..', '..', 'ganchos', 'gancho.cjs');
const LINUX = join(AQUI, '..', '..', 'linux');

// ---------------------------------------------------------------------------
// Modos de filho. Rodam ANTES de qualquer coisa, e nao escrevem na rodada.
// ---------------------------------------------------------------------------

if (process.argv[2] === '--filho-trava') {
  const { tomarTravaDeInstancia, CAMINHO_TRAVA } = await import('../servico.js');
  const r = tomarTravaDeInstancia();
  process.stdout.write(JSON.stringify({ caminho: CAMINHO_TRAVA, pid: process.pid, r }));
  process.exit(0);
}

if (process.argv[2] === '--filho-leitor') {
  // leitorTranscricao.ts roda o principal dele na carga e fica esperando a entrada
  // padrao. O pai mantem a entrada aberta ate este filho responder.
  const casa = String(process.argv[3]);
  const caminhos = JSON.parse(String(process.argv[4])) as string[];
  const { caminhoDentroDasTranscricoes } = await import('../leitorTranscricao.js');
  const r = caminhos.map((c) => caminhoDentroDasTranscricoes(c, casa));
  process.stdout.write(JSON.stringify(r));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// A rodada
// ---------------------------------------------------------------------------

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const RODADA = process.env['PONTE_RODADA'] ?? join(homedir(), `ost14-testes-${selo()}`);
if (existsSync(RODADA)) {
  console.error(`a pasta da rodada ${RODADA} ja existe; esta prova so escreve em pasta nova, §A.17`);
  process.exit(2);
}
mkdirSync(RODADA, { recursive: true, mode: 0o755 });
chmodSync(RODADA, 0o755);
const SAIDA = join(RODADA, 'saida.txt');

// A pasta local da ponte DESTE processo fica dentro da rodada, antes de importar
// qualquer modulo da ponte, §A.19.
process.env['PONTE_PASTA_LOCAL'] = join(RODADA, 'ponte-local');
process.env['PONTE_PASTA_GANCHOS'] = join(RODADA, 'ponte-local');
mkdirSync(join(RODADA, 'ponte-local'), { recursive: true });

let passou = 0;
let falhou = 0;
const falhas: string[] = [];
function reg(linha: string): void {
  console.log(linha);
  appendFileSync(SAIDA, `${linha}\n`, 'utf8');
}
function conferir(ok: boolean, rotulo: string, detalhe: string): void {
  if (ok) passou++;
  else {
    falhou++;
    falhas.push(`${rotulo}: ${detalhe}`);
  }
  reg(`  ${ok ? 'PASSOU' : 'FALHOU'} ${rotulo}: ${detalhe}`);
}
function parte(titulo: string): void {
  reg('');
  reg(`=== ${titulo}`);
}

reg(`prova-linux, OST 14, maquina ${hostname()}, node ${process.version}, plataforma ${process.platform}`);
reg(`rodada em ${RODADA}`);

const SETTINGS_REAL = join(homedir(), '.claude', 'settings.json');
function marcaDoSettingsReal(): string {
  try {
    const s = statSync(SETTINGS_REAL);
    return `${s.size} bytes, mtime ${s.mtimeMs}, modo ${(s.mode & 0o777).toString(8)}`;
  } catch {
    return 'ausente';
  }
}
const settingsAntes = marcaDoSettingsReal();
reg(`~/.claude/settings.json real, so tamanho e hora: ${settingsAntes}`);

// ---------------------------------------------------------------------------
// PARTE 1, lerColagem
// ---------------------------------------------------------------------------

{
  parte('PARTE 1, lerColagem (entradaPorCodigo.ts), entrada pendente fabricada a mao, sem rede');
  const { lerColagem } = await import('../entradaPorCodigo.js');
  const ESTADO = 'estadoFalsoDaRodadaOST14xxxxxxxxxx';
  const pendente = {
    link: 'https://accounts.google.com/o/oauth2/auth?state=' + ESTADO,
    sessionId: 'sessaoFalsaOST14nao-vale-nada-0000',
    estado: ESTADO,
    retorno: 'https://a-fabrica-soulan.firebaseapp.com/__/auth/handler',
    criadoEm: new Date().toISOString(),
  };
  const CODIGO = '4/0AeanS0FalsoOST14codigoDeTeste_abc-123.xyz';
  const cod = encodeURIComponent(CODIGO);
  const bom = `https://a-fabrica-soulan.firebaseapp.com/__/auth/handler?state=${ESTADO}&code=${cod}&scope=email%20openid&authuser=0&prompt=consent`;

  type Caso = { rotulo: string; colado: string; aceita: boolean };
  const casos: Caso[] = [
    { rotulo: 'endereco inteiro certo', colado: bom, aceita: true },
    { rotulo: 'so o codigo', colado: CODIGO, aceita: true },
    { rotulo: 'so o codigo, com barra codificada %2F', colado: cod, aceita: true },
    { rotulo: 'endereco com HTTPS maiusculo', colado: bom.replace('https://', 'HTTPS://'), aceita: true },
    {
      rotulo: 'colagem com espacos e quebra de linha no meio',
      colado: `  ${bom.slice(0, 40)}\n   ${bom.slice(40, 90)} \r\n\t${bom.slice(90)}  \n`,
      aceita: true,
    },
    { rotulo: 'host errado, a-fabrica-soulan.web.app', colado: bom.replace('a-fabrica-soulan.firebaseapp.com', 'a-fabrica-soulan.web.app'), aceita: false },
    { rotulo: 'dominio parecido, sufixo .evil.com', colado: bom.replace('firebaseapp.com/', 'firebaseapp.com.evil.com/'), aceita: false },
    { rotulo: 'dominio parecido, hifen no lugar do ponto', colado: bom.replace('a-fabrica-soulan.firebaseapp.com', 'a-fabrica-soulan-firebaseapp.com'), aceita: false },
    { rotulo: 'dominio parecido, usuario@ na frente do host', colado: bom.replace('a-fabrica-soulan.firebaseapp.com', 'a-fabrica-soulan.firebaseapp.com@evil.com'), aceita: false },
    { rotulo: 'host certo com porta', colado: bom.replace('firebaseapp.com/', 'firebaseapp.com:8443/'), aceita: false },
    { rotulo: 'http em vez de https', colado: bom.replace('https://', 'http://'), aceita: false },
    { rotulo: 'path errado, /__/auth/iframe', colado: bom.replace('/__/auth/handler', '/__/auth/iframe'), aceita: false },
    { rotulo: 'path errado, barra no fim', colado: bom.replace('/__/auth/handler', '/__/auth/handler/'), aceita: false },
    { rotulo: 'state de outra rodada', colado: bom.replace(ESTADO, 'estadoDeOutraRodadaOST14yyyyyyyyyyy'), aceita: false },
    { rotulo: 'state ausente', colado: bom.replace(`state=${ESTADO}&`, ''), aceita: false },
    { rotulo: 'state duplicado, o primeiro de outra rodada', colado: bom.replace(`state=${ESTADO}`, `state=outraRodada&state=${ESTADO}`), aceita: false },
    { rotulo: 'sem code', colado: bom.replace(`&code=${cod}`, ''), aceita: false },
    { rotulo: 'code vazio', colado: bom.replace(`code=${cod}`, 'code='), aceita: false },
    { rotulo: 'com error=access_denied', colado: `https://a-fabrica-soulan.firebaseapp.com/__/auth/handler?state=${ESTADO}&error=access_denied`, aceita: false },
    { rotulo: 'com error=access_denied e code junto', colado: `${bom}&error=access_denied`, aceita: false },
    { rotulo: 'lixo', colado: 'isto nao e codigo nenhum!!! <script>', aceita: false },
    { rotulo: 'lixo, javascript:', colado: 'javascript:alert(1)//aaaaaaaaaaaaaaaaaaaaa', aceita: false },
    { rotulo: 'codigo curto demais', colado: '4/0abc', aceita: false },
    { rotulo: 'codigo com % quebrado', colado: '4/0AeanS0Falso%E0%A4%Aaaaaaaaaaaaaaaaa', aceita: false },
    { rotulo: 'texto vazio', colado: '', aceita: false },
    { rotulo: 'so espacos e quebras', colado: '  \n\t \r\n ', aceita: false },
    { rotulo: 'grande demais', colado: 'https://a-fabrica-soulan.firebaseapp.com/__/auth/handler?x=' + 'a'.repeat(5000), aceita: false },
  ];
  for (const c of casos) {
    const r = lerColagem(c.colado, pendente);
    if (c.aceita) {
      let det = r.ok ? '' : `recusou: ${r.motivo}`;
      let ok = r.ok;
      if (r.ok) {
        const u = new URL(r.requestUri);
        ok =
          u.host === 'a-fabrica-soulan.firebaseapp.com' &&
          u.pathname === '/__/auth/handler' &&
          u.searchParams.get('state') === ESTADO &&
          u.searchParams.get('code') === CODIGO;
        det = ok ? 'aceito, requestUri com host, path, state e code certos' : `aceito com requestUri errado: ${r.requestUri}`;
      }
      conferir(ok, `aceita: ${c.rotulo}`, det);
    } else {
      // A recusa nao pode ecoar o codigo colado.
      const ecoou = !r.ok && (r.motivo.includes(CODIGO) || r.motivo.includes(cod) || r.motivo.includes('evil.com'));
      conferir(!r.ok && !ecoou, `recusa: ${c.rotulo}`, r.ok ? `ACEITOU, requestUri ${r.requestUri}` : `${r.motivo}${ecoou ? ' (ECOOU o colado)' : ''}`);
    }
  }
}

// ---------------------------------------------------------------------------
// PARTE 2, conferirProtecao no Linux
// ---------------------------------------------------------------------------

{
  parte('PARTE 2, conferirProtecao no Linux (protecaoSessao.ts)');
  const { conferirProtecao, exigirProtecao, SessaoDesprotegida } = await import('../protecaoSessao.js');
  const P = join(RODADA, 'parte2-protecao');
  mkdirSync(P, { mode: 0o755 });
  chmodSync(P, 0o755);
  const pasta700 = join(P, 'pasta-700');
  const pasta755 = join(P, 'pasta-755');
  const arq600 = join(P, 'arquivo-600.json');
  const arq644 = join(P, 'arquivo-644.json');
  const arq640 = join(P, 'arquivo-640.json');
  const arq400 = join(P, 'arquivo-400.json');
  const atalho = join(P, 'atalho-para-arquivo-600.json');
  const atalhoPasta = join(P, 'atalho-para-pasta-700');
  const deRoot = join(P, 'arquivo-600-de-root.json');
  mkdirSync(pasta700);
  chmodSync(pasta700, 0o700);
  mkdirSync(pasta755);
  chmodSync(pasta755, 0o755);
  for (const [c, m] of [
    [arq600, 0o600],
    [arq644, 0o644],
    [arq640, 0o640],
    [arq400, 0o400],
    [deRoot, 0o600],
  ] as const) {
    writeFileSync(c, '{"falso":true}\n', { mode: m });
    chmodSync(c, m);
  }
  symlinkSync(arq600, atalho);
  symlinkSync(pasta700, atalhoPasta);
  const chown = spawnSync('sudo', ['-n', 'chown', 'root', deRoot], { encoding: 'utf8' });
  reg(`  sudo chown root ${deRoot}: codigo ${chown.status}${chown.stderr ? `, ${chown.stderr.trim()}` : ''}`);

  // Ramo da pasta de cima gravavel por outros, sem e com o bit pegajoso.
  const cima777 = join(P, 'cima-777');
  const cima1777 = join(P, 'cima-1777');
  const cima775 = join(P, 'cima-775');
  for (const [c, m] of [
    [cima777, 0o777],
    [cima1777, 0o1777],
    [cima775, 0o775],
  ] as const) {
    mkdirSync(c);
    chmodSync(c, m);
    writeFileSync(join(c, 'sessao-600.json'), '{}\n', { mode: 0o600 });
    chmodSync(join(c, 'sessao-600.json'), 0o600);
    mkdirSync(join(c, 'pasta-700'));
    chmodSync(join(c, 'pasta-700'), 0o700);
  }

  const pasta = { exigirHerancaQuebrada: true };
  const arquivo = { exigirHerancaQuebrada: false };
  type C = { rotulo: string; caminho: string; op: { exigirHerancaQuebrada: boolean }; protegido: boolean; motivoTem?: RegExp };
  const casos: C[] = [
    { rotulo: 'pasta 700', caminho: pasta700, op: pasta, protegido: true },
    { rotulo: 'pasta 755', caminho: pasta755, op: pasta, protegido: false, motivoTem: /modo 0755/ },
    { rotulo: 'arquivo 600', caminho: arq600, op: arquivo, protegido: true },
    { rotulo: 'arquivo 400', caminho: arq400, op: arquivo, protegido: true },
    { rotulo: 'arquivo 644', caminho: arq644, op: arquivo, protegido: false, motivoTem: /modo 0644/ },
    { rotulo: 'arquivo 640, so grupo le', caminho: arq640, op: arquivo, protegido: false, motivoTem: /modo 0640/ },
    { rotulo: 'atalho simbolico para arquivo 600', caminho: atalho, op: arquivo, protegido: false, motivoTem: /atalho/ },
    { rotulo: 'atalho simbolico para pasta 700', caminho: atalhoPasta, op: pasta, protegido: false, motivoTem: /atalho/ },
    { rotulo: 'arquivo 600 de outro dono (root)', caminho: deRoot, op: arquivo, protegido: false, motivoTem: /uid 0/ },
    { rotulo: 'arquivo 600 conferido como pasta', caminho: arq600, op: pasta, protegido: false, motivoTem: /devia ser pasta/ },
    { rotulo: 'caminho que nao existe', caminho: join(P, 'nao-existe.json'), op: arquivo, protegido: false, motivoTem: /não existe/ },
    { rotulo: 'arquivo 600 em pasta de cima 777', caminho: join(cima777, 'sessao-600.json'), op: arquivo, protegido: false, motivoTem: /pasta de cima/ },
    { rotulo: 'pasta 700 em pasta de cima 777', caminho: join(cima777, 'pasta-700'), op: pasta, protegido: false, motivoTem: /pasta de cima/ },
    { rotulo: 'arquivo 600 em pasta de cima 775 (grupo escreve)', caminho: join(cima775, 'sessao-600.json'), op: arquivo, protegido: false, motivoTem: /pasta de cima/ },
    { rotulo: 'arquivo 600 em pasta de cima 1777 (pegajosa, aceita pelo desenho)', caminho: join(cima1777, 'sessao-600.json'), op: arquivo, protegido: true },
  ];
  for (const c of casos) {
    const v = conferirProtecao(c.caminho, c.op);
    const ok = v.protegido === c.protegido && (c.motivoTem === undefined || c.motivoTem.test(v.motivo));
    conferir(ok, `${c.protegido ? 'protegido' : 'recusado'}: ${c.rotulo}`, v.motivo);
  }
  // O portao de subida, com um alvo aberto, tem de lancar.
  try {
    exigirProtecao([
      { caminho: pasta700, tipo: 'pasta' },
      { caminho: arq644, tipo: 'arquivo' },
    ]);
    conferir(false, 'exigirProtecao recusa com um alvo aberto', 'NAO lancou');
  } catch (e) {
    conferir(e instanceof SessaoDesprotegida, 'exigirProtecao recusa com um alvo aberto', e instanceof Error ? e.message.slice(0, 160) : String(e));
  }
  try {
    const v = exigirProtecao([
      { caminho: pasta700, tipo: 'pasta' },
      { caminho: arq600, tipo: 'arquivo' },
    ]);
    conferir(v.every((x) => x.protegido), 'exigirProtecao passa com tudo trancado', `${v.length} vereditos protegidos`);
  } catch (e) {
    conferir(false, 'exigirProtecao passa com tudo trancado', e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// PARTE 3, plataforma.ts e o gancho
// ---------------------------------------------------------------------------

{
  parte('PARTE 3a, caminhoComparavel e dentroDaPasta (plataforma.ts), no Linux');
  const { caminhoComparavel, dentroDaPasta, NO_WINDOWS } = await import('../plataforma.js');
  conferir(NO_WINDOWS === false, 'NO_WINDOWS e falso neste Linux', String(NO_WINDOWS));
  conferir(caminhoComparavel('/home/x/A-Fabrica/') === '/home/x/A-Fabrica', 'caminhoComparavel tira a barra do fim e mantem a caixa', caminhoComparavel('/home/x/A-Fabrica/'));
  conferir(caminhoComparavel('/home/x///') === '/home/x', 'caminhoComparavel tira varias barras do fim', caminhoComparavel('/home/x///'));
  conferir(caminhoComparavel('/') === '/', 'caminhoComparavel mantem a raiz', caminhoComparavel('/'));
  type D = { c: string; p: string; esperado: boolean; rotulo: string };
  const ds: D[] = [
    { c: '/home/x/a-fabrica', p: '/home/x/a-fabrica', esperado: true, rotulo: 'igual' },
    { c: '/home/x/a-fabrica/', p: '/home/x/a-fabrica', esperado: true, rotulo: 'igual com barra no fim' },
    { c: '/home/x/a-fabrica/painel/src', p: '/home/x/a-fabrica/', esperado: true, rotulo: 'dentro, alvo com barra no fim' },
    { c: '/home/x/a-fabrica-lab', p: '/home/x/a-fabrica', esperado: false, rotulo: 'a-fabrica nao alcanca a-fabrica-lab' },
    { c: '/home/x/a-fabricax/y', p: '/home/x/a-fabrica', esperado: false, rotulo: 'a-fabrica nao alcanca a-fabricax/y' },
    { c: '/home/x/A-Fabrica', p: '/home/x/a-fabrica', esperado: false, rotulo: 'no Linux a-fabrica nao alcanca A-Fabrica' },
    { c: '/home/x/a-fabrica', p: '/home/x/A-Fabrica', esperado: false, rotulo: 'no Linux A-Fabrica nao alcanca a-fabrica' },
    { c: '/home/x', p: '/home/x/a-fabrica', esperado: false, rotulo: 'pasta de cima nao esta dentro' },
    { c: '/home/x/a-fabrica', p: '', esperado: false, rotulo: 'alvo vazio nao alcanca nada' },
    { c: '/home/x/a-fabrica', p: '/', esperado: true, rotulo: 'a raiz / contem tudo' },
  ];
  for (const d of ds) {
    const r = dentroDaPasta(d.c, d.p);
    conferir(r === d.esperado, `dentroDaPasta: ${d.rotulo}`, `${d.c} em ${JSON.stringify(d.p)} deu ${r}, esperado ${d.esperado}`);
  }
  // Informativo, sem contar: a comparacao e de texto, sem normalizar '..'.
  reg(`  INFORMATIVO: dentroDaPasta('/home/x/a-fabrica/../cliente', '/home/x/a-fabrica') = ${dentroDaPasta('/home/x/a-fabrica/../cliente', '/home/x/a-fabrica')} (comparacao de texto, sem resolver '..')`);
}

{
  parte('PARTE 3b, o gancho (ganchos/gancho.cjs) pelo comportamento, PONTE_PASTA_LOCAL na rodada');
  const G = join(RODADA, 'parte3-gancho');
  mkdirSync(G);
  let n = 0;
  type R = { codigo: number | null; saida: string; erro: string; linhas: Record<string, unknown>[]; arquivos: string[]; pasta: string };
  function rodarGancho(config: unknown | null, payload: unknown | string, evento = 'PostToolUse'): R {
    n++;
    const pasta = join(G, `caso-${String(n).padStart(2, '0')}`);
    mkdirSync(pasta);
    if (config !== null) writeFileSync(join(pasta, 'ganchos.json'), typeof config === 'string' ? config : JSON.stringify(config, null, 2), 'utf8');
    const entrada = typeof payload === 'string' ? payload : JSON.stringify(payload);
    writeFileSync(join(pasta, 'evento-entrada.json'), entrada, 'utf8');
    const r = spawnSync(process.execPath, [GANCHO, evento], {
      input: entrada,
      encoding: 'utf8',
      env: { PATH: process.env['PATH'] ?? '/usr/bin:/bin', PONTE_PASTA_LOCAL: pasta },
      cwd: pasta,
      timeout: 10_000,
    });
    const fila = join(pasta, 'fila-ganchos');
    const arquivos = existsSync(fila) ? readdirSync(fila) : [];
    const linhas: Record<string, unknown>[] = [];
    for (const a of arquivos) {
      for (const l of readFileSync(join(fila, a), 'utf8').split('\n')) if (l.trim()) linhas.push(JSON.parse(l) as Record<string, unknown>);
    }
    return { codigo: r.status, saida: r.stdout ?? '', erro: r.stderr ?? '', linhas, arquivos, pasta };
  }
  const evento = (cwd: string, sid: string): Record<string, unknown> => ({
    hook_event_name: 'PostToolUse',
    session_id: sid,
    cwd,
    tool_name: 'Bash',
    tool_input: { command: 'ls -la alvo-secreto-da-prova', description: 'descricao da prova' },
    tool_response: { stdout: 'conteudo que nunca entra' },
    transcript_path: '/home/x/.claude/projects/p/s.jsonl',
  });
  const calado = (r: R): boolean => r.codigo === 0 && r.saida === '' && r.erro === '';
  const base = { ligado: true };
  type CasoG = { rotulo: string; config: unknown | null; payload: unknown | string; escreve: boolean; alvo?: boolean };
  const casos: CasoG[] = [
    { rotulo: 'liberado /home/x/a-fabrica, projeto /home/x/a-fabrica/painel: escreve com alvo', config: { ...base, projetosLiberados: ['/home/x/a-fabrica'] }, payload: evento('/home/x/a-fabrica/painel', 's01'), escreve: true, alvo: true },
    { rotulo: 'liberado /home/x/a-fabrica, projeto /home/x/a-fabrica-lab: escreve SEM alvo', config: { ...base, projetosLiberados: ['/home/x/a-fabrica'] }, payload: evento('/home/x/a-fabrica-lab', 's02'), escreve: true, alvo: false },
    { rotulo: 'liberado /home/x/a-fabrica, projeto /home/x/A-Fabrica: escreve SEM alvo', config: { ...base, projetosLiberados: ['/home/x/a-fabrica'] }, payload: evento('/home/x/A-Fabrica', 's03'), escreve: true, alvo: false },
    { rotulo: 'ignorado /home/x/cliente, projeto /home/x/cliente: nada escrito', config: { ...base, conteudoDeTodos: true, projetosIgnorados: ['/home/x/cliente'] }, payload: evento('/home/x/cliente', 's04'), escreve: false },
    { rotulo: 'ignorado /home/x/cliente, projeto /home/x/cliente/sub: nada escrito', config: { ...base, conteudoDeTodos: true, projetosIgnorados: ['/home/x/cliente/'] }, payload: evento('/home/x/cliente/sub', 's05'), escreve: false },
    { rotulo: 'ignorado /home/x/cliente, projeto /home/x/cliente-b: escreve', config: { ...base, conteudoDeTodos: true, projetosIgnorados: ['/home/x/cliente'] }, payload: evento('/home/x/cliente-b', 's06'), escreve: true, alvo: true },
    { rotulo: 'conteudoDeTodos true: escreve com alvo', config: { ...base, conteudoDeTodos: true }, payload: evento('/home/x/qualquer', 's07'), escreve: true, alvo: true },
    { rotulo: 'conteudoDeTodos ausente: escreve SEM alvo', config: { ...base }, payload: evento('/home/x/qualquer', 's08'), escreve: true, alvo: false },
    { rotulo: 'conteudoDeTodos "true" em texto: escreve SEM alvo', config: { ...base, conteudoDeTodos: 'true' }, payload: evento('/home/x/qualquer', 's09'), escreve: true, alvo: false },
    { rotulo: 'conteudoDeTodos 1: escreve SEM alvo', config: { ...base, conteudoDeTodos: 1 }, payload: evento('/home/x/qualquer', 's10'), escreve: true, alvo: false },
    { rotulo: 'projetosLiberados corrompido (texto): escreve SEM alvo', config: { ...base, projetosLiberados: '/home/x/qualquer' }, payload: evento('/home/x/qualquer', 's11'), escreve: true, alvo: false },
    { rotulo: 'ligado false: nada escrito', config: { ligado: false, conteudoDeTodos: true }, payload: evento('/home/x/qualquer', 's12'), escreve: false },
    { rotulo: 'ganchos.json ausente: nada escrito', config: null, payload: evento('/home/x/qualquer', 's13'), escreve: false },
    { rotulo: 'ganchos.json corrompido: nada escrito', config: '{ isto nao e json', payload: evento('/home/x/qualquer', 's14'), escreve: false },
    { rotulo: 'entrada padrao que nao e JSON: nada escrito', config: { ...base, conteudoDeTodos: true }, payload: 'lixo na entrada', escreve: false },
    { rotulo: 'entrada padrao vazia: nada escrito', config: { ...base, conteudoDeTodos: true }, payload: '', escreve: false },
    { rotulo: 'session_id com barras e ..: arquivo fica dentro da fila', config: { ...base }, payload: evento('/home/x/qualquer', '../../fora/da/fila'), escreve: true, alvo: false },
  ];
  for (const c of casos) {
    const r = rodarGancho(c.config, c.payload);
    const linha = r.linhas[0];
    let ok = calado(r);
    let det = `codigo ${r.codigo}, saida padrao ${r.saida.length} bytes, erro ${r.erro.length} bytes, ${r.linhas.length} linha(s) em ${r.arquivos.length} arquivo(s)`;
    if (c.escreve) {
      ok = ok && r.linhas.length === 1 && linha !== undefined;
      if (linha !== undefined && c.alvo !== undefined) {
        const temAlvo = linha['alvo'] === 'ls -la alvo-secreto-da-prova';
        const semConteudo = !('alvo' in linha) && !('descricao' in linha) && !('pedidoDoDiretor' in linha);
        ok = ok && (c.alvo ? temAlvo && linha['conteudo'] === true : semConteudo && linha['conteudo'] === false);
        det += `, conteudo=${String(linha['conteudo'])}, alvo ${'alvo' in linha ? 'presente' : 'ausente'}`;
      }
      if (linha !== undefined) {
        ok = ok && !JSON.stringify(linha).includes('conteudo que nunca entra');
      }
      if (c.rotulo.startsWith('session_id')) {
        ok = ok && r.arquivos.length === 1 && !r.arquivos[0]!.includes('/') && existsSync(join(r.pasta, 'fila-ganchos', r.arquivos[0]!));
        det += `, arquivo ${r.arquivos.join(',')}`;
      }
    } else {
      ok = ok && r.linhas.length === 0 && r.arquivos.length === 0;
    }
    conferir(ok, `gancho: ${c.rotulo}`, `${det} (caso em ${r.pasta})`);
  }
}

// ---------------------------------------------------------------------------
// PARTE 4, caminhoDentroDasTranscricoes
// ---------------------------------------------------------------------------

{
  parte('PARTE 4, caminhoDentroDasTranscricoes (leitorTranscricao.ts), casa falsa na rodada');
  const casa = join(RODADA, 'parte4-casa-falsa');
  const proj = join(casa, '.claude', 'projects', '-home-x-a-fabrica');
  mkdirSync(proj, { recursive: true });
  const dentro = join(proj, 'sessao-dentro.jsonl');
  writeFileSync(dentro, '{"type":"user"}\n', 'utf8');
  writeFileSync(join(proj, 'sessao.json'), '{}\n', 'utf8');
  mkdirSync(join(proj, 'pasta-que-parece.jsonl'));
  const fora = join(casa, 'fora.jsonl');
  writeFileSync(fora, '{"type":"user"}\n', 'utf8');
  symlinkSync(fora, join(proj, 'atalho-para-fora.jsonl'));
  symlinkSync(dentro, join(proj, 'atalho-para-dentro.jsonl'));
  // Pasta irma com nome que comeca igual a projects.
  mkdirSync(join(casa, '.claude', 'projects-irma'), { recursive: true });
  writeFileSync(join(casa, '.claude', 'projects-irma', 'x.jsonl'), '{}\n', 'utf8');

  type T = { rotulo: string; caminho: string; aceita: boolean };
  const casos: T[] = [
    { rotulo: 'dentro e .jsonl', caminho: dentro, aceita: true },
    { rotulo: 'atalho de dentro para dentro', caminho: join(proj, 'atalho-para-dentro.jsonl'), aceita: true },
    { rotulo: 'fora de projects', caminho: fora, aceita: false },
    { rotulo: "com '..' que volta para dentro", caminho: `${proj}/../-home-x-a-fabrica/sessao-dentro.jsonl`, aceita: true },
    { rotulo: "com '..' literal no texto", caminho: `${proj}/../../../fora.jsonl`, aceita: false },
    { rotulo: 'atalho simbolico de dentro para fora', caminho: join(proj, 'atalho-para-fora.jsonl'), aceita: false },
    { rotulo: '.json em vez de .jsonl', caminho: join(proj, 'sessao.json'), aceita: false },
    { rotulo: 'pasta com nome .jsonl', caminho: join(proj, 'pasta-que-parece.jsonl'), aceita: false },
    { rotulo: 'pasta irma projects-irma', caminho: join(casa, '.claude', 'projects-irma', 'x.jsonl'), aceita: false },
    { rotulo: 'nao existe', caminho: join(proj, 'nao-existe.jsonl'), aceita: false },
    { rotulo: 'texto vazio', caminho: '', aceita: false },
    { rotulo: 'byte nulo', caminho: `${dentro}\u0000.jsonl`, aceita: false },
    { rotulo: '/etc/hostname', caminho: '/etc/hostname', aceita: false },
  ];
  const resultado = await new Promise<{ r: (string | null)[] | null; bruto: string; codigo: number | null }>((resolver) => {
    const filho = spawn(process.execPath, [ESTE, '--filho-leitor', casa, JSON.stringify(casos.map((c) => c.caminho))], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let bruto = '';
    filho.stdout.on('data', (b: Buffer) => (bruto += b.toString('utf8')));
    filho.on('exit', (codigo) => {
      try {
        resolver({ r: JSON.parse(bruto) as (string | null)[], bruto, codigo });
      } catch {
        resolver({ r: null, bruto, codigo });
      }
    });
    setTimeout(() => filho.kill('SIGKILL'), 15_000).unref();
  });
  if (resultado.r === null) {
    conferir(false, 'filho do leitor respondeu', `codigo ${resultado.codigo}, saida ${resultado.bruto.slice(0, 200)}`);
  } else {
    casos.forEach((c, i) => {
      const v = resultado.r![i] ?? null;
      const ok = c.aceita ? v !== null && v.startsWith(join(casa, '.claude', 'projects') + '/') : v === null;
      conferir(ok, `${c.aceita ? 'aceito' : 'recusado'}: ${c.rotulo}`, `devolveu ${v === null ? 'null' : v.replace(RODADA, '<rodada>')}`);
    });
  }

  // O leitor de verdade, como programa, com HOME apontando para a casa falsa.
  const leitor = join(AQUI, '..', 'leitorTranscricao.js');
  const rodarLeitor = (pedido: unknown): { codigo: number | null; saida: string } => {
    const r = spawnSync(process.execPath, [leitor], {
      input: typeof pedido === 'string' ? pedido : JSON.stringify(pedido),
      encoding: 'utf8',
      env: { PATH: '/usr/bin:/bin', HOME: casa },
      timeout: 15_000,
    });
    return { codigo: r.status, saida: r.stdout ?? '' };
  };
  const a = rodarLeitor({ op: 'consumo', caminho: dentro });
  conferir(a.codigo === 0 && a.saida.startsWith('{'), 'programa leitor, consumo dentro: codigo 0 e JSON', `codigo ${a.codigo}, ${a.saida.length} bytes`);
  const b = rodarLeitor({ op: 'consumo', caminho: fora });
  conferir(b.codigo === 3 && b.saida === '', 'programa leitor, consumo fora: codigo 3 e nada na saida', `codigo ${b.codigo}, ${b.saida.length} bytes`);
  const c = rodarLeitor({ op: 'apagar', caminho: dentro });
  conferir(c.codigo === 4 && c.saida === '', 'programa leitor, operacao desconhecida: codigo 4 e nada na saida', `codigo ${c.codigo}, ${c.saida.length} bytes`);
  const d = rodarLeitor('nao e json');
  conferir(d.codigo === 2 && d.saida === '', 'programa leitor, pedido que nao e JSON: codigo 2 e nada na saida', `codigo ${d.codigo}, ${d.saida.length} bytes`);
}

// ---------------------------------------------------------------------------
// PARTE 5, risco()
// ---------------------------------------------------------------------------

{
  parte('PARTE 5, risco() de ponte.ts');
  const { risco } = await import('../ponte.js');
  const casos: Array<[string, string]> = [
    ['sudo apt-get install x', 'alto'],
    ['ssh outra-maquina', 'alto'],
    ['scp a b:/c', 'alto'],
    ['systemctl restart a-fabrica-ponte', 'alto'],
    ['systemctl status nginx', 'alto'],
    ['kill -9 1234', 'alto'],
    ['su - root', 'alto'],
    ['crontab -e', 'alto'],
    ['cat /var/lib/a-fabrica-ponte/sessao.json', 'alto'],
    ['ls /var/lib/a-fabrica-ponte', 'alto'],
    ['cat ~/.a-fabrica-ponte/config.json', 'alto'],
    ['rm -rf pasta', 'alto'],
    ['echo x > arquivo', 'alto'],
    ['curl https://exemplo', 'alto'],
    ['git push origin nuvem/x', 'alto'],
    ['chmod 600 arquivo', 'medio'],
    ['chown eu arquivo', 'medio'],
    ['mv a b', 'medio'],
    ['cp a b', 'medio'],
    ['sed -i s/a/b/ arquivo', 'medio'],
    ['npx tsc -p tsconfig.json', 'medio'],
    ['ls', 'baixo'],
    ['ls -la', 'baixo'],
    ['git status', 'baixo'],
    ['cat resumo.txt', 'baixo'],
    ['grep -r issue .', 'baixo'],
  ];
  for (const [cmd, esperado] of casos) {
    const r = risco(cmd);
    conferir(r === esperado, `risco(${JSON.stringify(cmd)})`, `deu ${r}, esperado ${esperado}`);
  }
  // Informativo, sem contar: comandos que executam outro comando por dentro.
  for (const cmd of ['bash -c "id"', 'python3 -c "import os"', 'node -e "1"', 'find . -delete', 'perl -pi -e s/a/b/ f', 'xargs -a lista echo', 'install -m 600 a b', 'truncate -s 0 f']) {
    reg(`  INFORMATIVO: risco(${JSON.stringify(cmd)}) = ${risco(cmd)}`);
  }
}

// ---------------------------------------------------------------------------
// PARTE 6, a trava da maquina
// ---------------------------------------------------------------------------

{
  parte('PARTE 6, tomarTravaDeInstancia no Linux (servico.ts), PONTE_TRAVA_MAQUINA na rodada');
  const T = join(RODADA, 'parte6-trava');
  mkdirSync(T);
  const rodarTrava = (pasta: string): { r: { ok: boolean; pidDaOutra?: number; motivo?: string } | null; pid: number; bruto: string; lida: string } => {
    const caminho = join(pasta, 'ponte-no-ar.json');
    const s = spawnSync(process.execPath, [ESTE, '--filho-trava'], {
      encoding: 'utf8',
      env: { ...process.env, PONTE_TRAVA_MAQUINA: caminho, PONTE_PASTA_LOCAL: join(pasta, 'ponte-local') },
      timeout: 15_000,
    });
    let r = null;
    let pid = -1;
    try {
      const o = JSON.parse(s.stdout) as { r: { ok: boolean; pidDaOutra?: number; motivo?: string }; pid: number };
      r = o.r;
      pid = o.pid;
    } catch {
      r = null;
    }
    const lida = existsSync(caminho) ? readFileSync(caminho, 'utf8') : '';
    return { r, pid, bruto: `${s.stdout}${s.stderr}`, lida };
  };
  const novaPasta = (nome: string): string => {
    const p = join(T, nome);
    mkdirSync(p);
    return p;
  };
  const escreverTrava = (pasta: string, pid: number): void => {
    writeFileSync(join(pasta, 'ponte-no-ar.json'), JSON.stringify({ pid, desde: '2026-11-25T00:00:00.000Z' }), 'utf8');
  };

  // 1. sem trava, toma.
  {
    const p = novaPasta('1-sem-trava');
    const x = rodarTrava(p);
    const lida = x.lida ? (JSON.parse(x.lida) as { pid: number }) : null;
    conferir(x.r?.ok === true && lida?.pid === x.pid, 'sem trava: toma e grava o proprio pid', `${JSON.stringify(x.r)}, trava com pid ${lida?.pid}, filho ${x.pid}`);
  }
  // 2. trava de processo vivo que e ponte, recusa.
  {
    const p = novaPasta('2-ponte-viva');
    const falsa = join(p, 'ponte-falsa');
    mkdirSync(falsa);
    writeFileSync(join(falsa, 'ponte.js'), 'setTimeout(() => {}, 60000);\n', 'utf8');
    const viva = spawn(process.execPath, [join(falsa, 'ponte.js')], { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 300));
    escreverTrava(p, viva.pid ?? -1);
    const x = rodarTrava(p);
    conferir(x.r?.ok === false && x.r.pidDaOutra === viva.pid && !('motivo' in (x.r ?? {})), 'trava de ponte viva: recusa e diz o pid da outra', `${JSON.stringify(x.r)}, ponte falsa pid ${viva.pid}`);
    viva.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
  }
  // 3. trava de pid morto, retoma.
  {
    const p = novaPasta('3-pid-morto');
    const morto = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
    const pidMorto = Number(morto.stdout);
    escreverTrava(p, pidMorto);
    const x = rodarTrava(p);
    const lida = x.lida ? (JSON.parse(x.lida) as { pid: number }) : null;
    conferir(x.r?.ok === true && lida?.pid === x.pid, 'trava de pid morto: retoma', `${JSON.stringify(x.r)}, pid morto ${pidMorto}, trava agora com ${lida?.pid}`);
  }
  // 4. trava de pid vivo que nao e ponte (o shell que chamou esta prova), retoma.
  {
    const p = novaPasta('4-pid-vivo-nao-ponte');
    const shell = process.ppid;
    const linha = existsSync(`/proc/${shell}/cmdline`) ? readFileSync(`/proc/${shell}/cmdline`, 'utf8').replace(/\0/g, ' ').trim() : '?';
    escreverTrava(p, shell);
    const x = rodarTrava(p);
    conferir(x.r?.ok === true, 'trava com pid vivo que nao e ponte (shell que chamou): retoma', `${JSON.stringify(x.r)}, pid ${shell} (${linha.slice(0, 60)})`);
  }
  // 4b. trava ilegivel, retoma.
  {
    const p = novaPasta('4b-trava-ilegivel');
    writeFileSync(join(p, 'ponte-no-ar.json'), 'nao e json', 'utf8');
    const x = rodarTrava(p);
    conferir(x.r?.ok === true, 'trava ilegivel: retoma', JSON.stringify(x.r));
  }
  // 5. pasta sem permissao de escrita, recusa com motivo.
  {
    const p = novaPasta('5-pasta-sem-escrita');
    chmodSync(p, 0o555);
    const x = rodarTrava(p);
    conferir(x.r?.ok === false && typeof x.r.motivo === 'string' && /nao deu para escrever a trava/.test(x.r.motivo), 'pasta sem escrita: recusa com motivo', JSON.stringify(x.r));
  }
  // 6. pasta que nao existe, recusa com motivo.
  {
    const p = join(T, '6-pasta-que-nao-existe');
    const x = rodarTrava(p);
    conferir(x.r?.ok === false && typeof x.r.motivo === 'string', 'pasta ausente: recusa com motivo', JSON.stringify(x.r));
    conferir(!existsSync(p), 'pasta ausente: a trava nao cria a pasta', existsSync(p) ? 'CRIOU' : 'nao criou');
  }
  // 7. sobra de temporario do mesmo pid nao existe na pratica, mas uma trava de ponte viva
  //    de outro usuario, legivel, tambem segura: coberto em 2.
}

// ---------------------------------------------------------------------------
// PARTE 7, os lancadores de verdade
// ---------------------------------------------------------------------------

{
  parte('PARTE 7, os lancadores, pelo sudo, como fabrica-ponte');
  const DIRETOR_SIS = 'henrique_vieira_soulan_com_br';
  const BIN = '/opt/a-fabrica-ponte/bin';
  const APP = '/opt/a-fabrica-ponte/app';
  const L = join(RODADA, 'parte7-lancadores');
  mkdirSync(L);
  let k = 0;
  const comoPonte = (args: string[], entrada?: string): { codigo: number | null; saida: string; erro: string } => {
    k++;
    const r = spawnSync('sudo', ['-n', '-u', 'fabrica-ponte', ...args], {
      encoding: 'utf8',
      cwd: '/',
      input: entrada ?? '',
      timeout: 60_000,
    });
    const o = { codigo: r.status, saida: r.stdout ?? '', erro: r.stderr ?? '' };
    writeFileSync(join(L, `caso-${String(k).padStart(2, '0')}.txt`), `sudo -n -u fabrica-ponte ${args.join(' ')}\ncodigo ${o.codigo}\n--- saida\n${o.saida}\n--- erro\n${o.erro}\n`, 'utf8');
    return o;
  };
  const nomeDaMaquina = readFileSync('/etc/hostname', 'utf8').trim();
  const lancador = [`sudo`, `-n`, `-u`, DIRETOR_SIS, `${BIN}/claude-como-diretor`];

  const a = comoPonte([...lancador, '--', '/bin/cat', '/etc/hostname']);
  conferir(a.codigo !== 0 && !a.saida.includes(nomeDaMaquina), 'claude-como-diretor com /bin/cat: recusado', `codigo ${a.codigo}, erro ${a.erro.trim()}`);
  const b = comoPonte([...lancador, '--env', 'LD_PRELOAD=x', '--', `${APP}/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude`, '--version']);
  conferir(b.codigo === 64 && b.saida === '' && /variavel recusada: LD_PRELOAD/.test(b.erro), 'claude-como-diretor com --env LD_PRELOAD: recusado', `codigo ${b.codigo}, erro ${b.erro.trim()}`);
  const b2 = comoPonte([...lancador, '--env', 'PATH=/tmp', '--', `${APP}/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude`, '--version']);
  conferir(b2.codigo === 64 && b2.saida === '', 'claude-como-diretor com --env PATH: recusado', `codigo ${b2.codigo}, erro ${b2.erro.trim()}`);
  const c = comoPonte([...lancador, '--', `${APP}/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude`, '--version']);
  conferir(c.codigo === 0 && /\d+\.\d+\.\d+/.test(c.saida), 'claude-como-diretor com o Claude Code do kit e --version: aceito', `codigo ${c.codigo}, ${c.saida.trim().slice(0, 80)}`);
  const c2 = comoPonte([...lancador, '--env', 'CLAUDE_CODE_ENTRYPOINT=sdk-ts', '--', `${APP}/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude`, '--version']);
  conferir(c2.codigo === 0 && /\d+\.\d+\.\d+/.test(c2.saida), 'claude-como-diretor com --env da lista e --version: aceito', `codigo ${c2.codigo}, ${c2.saida.trim().slice(0, 80)}`);
  // Atalho em pasta da rodada apontando para /bin/cat: readlink -f resolve e recusa.
  const atalhoCat = join(L, 'atalho-para-cat');
  symlinkSync('/bin/cat', atalhoCat);
  const c3 = comoPonte([...lancador, '--', atalhoCat, '/etc/hostname']);
  conferir(c3.codigo !== 0 && !c3.saida.includes(nomeDaMaquina), 'claude-como-diretor com atalho para /bin/cat: recusado', `codigo ${c3.codigo}, erro ${c3.erro.trim()}`);
  // Achado: o prefixo aceito e a pasta @anthropic-ai inteira. O programa do SDK de API
  // (sdk/bin/cli, que roda npx com endereco da internet no subcomando migrate) passa.
  // Rodado SEM argumento, que so imprime a ajuda.
  const c4 = comoPonte([...lancador, '--', `${APP}/node_modules/@anthropic-ai/sdk/bin/cli`]);
  conferir(c4.codigo === 64, 'claude-como-diretor com @anthropic-ai/sdk/bin/cli (outro programa do kit): recusado', `codigo ${c4.codigo}, saida ${c4.saida.trim().split('\n')[0] ?? ''}`);

  const d = comoPonte(['sudo', '-n', '-u', 'root', 'true']);
  conferir(d.codigo !== 0, 'fabrica-ponte: sudo -n -u root true falha', `codigo ${d.codigo}, erro ${d.erro.trim().split('\n')[0] ?? ''}`);
  const d2 = comoPonte(['sudo', '-n', '-u', DIRETOR_SIS, '/bin/cat', '/etc/hostname']);
  conferir(d2.codigo !== 0 && !d2.saida.includes(nomeDaMaquina), 'fabrica-ponte: sudo direto como o diretor com /bin/cat falha', `codigo ${d2.codigo}`);

  const ler = ['sudo', '-n', '-u', DIRETOR_SIS, `${BIN}/ler-transcricao`];
  const e = comoPonte(ler, JSON.stringify({ op: 'consumo', caminho: '/etc/hostname' }));
  conferir(e.codigo !== 0 && e.saida === '', 'ler-transcricao com /etc/hostname: codigo diferente de 0 e nada na saida', `codigo ${e.codigo}, saida ${e.saida.length} bytes`);
  const e2 = comoPonte(ler, JSON.stringify({ op: 'fechamento', caminho: '/etc/passwd', trecho: 'root', hora: '' }));
  conferir(e2.codigo !== 0 && e2.saida === '', 'ler-transcricao fechamento com /etc/passwd: codigo diferente de 0 e nada na saida', `codigo ${e2.codigo}, saida ${e2.saida.length} bytes`);
  const e3 = comoPonte(ler, JSON.stringify({ op: 'consumo', caminho: `/home/${DIRETOR_SIS}/.claude/settings.json` }));
  conferir(e3.codigo !== 0 && e3.saida === '', 'ler-transcricao com ~/.claude/settings.json: codigo diferente de 0 e nada na saida', `codigo ${e3.codigo}, saida ${e3.saida.length} bytes`);
  const e4 = comoPonte(ler, JSON.stringify({ op: 'consumo', caminho: `/home/${DIRETOR_SIS}/.claude/projects/../settings.json` }));
  conferir(e4.codigo !== 0 && e4.saida === '', "ler-transcricao com '..' saindo de projects: codigo diferente de 0 e nada na saida", `codigo ${e4.codigo}, saida ${e4.saida.length} bytes`);
  // Caso de acerto do leitor: uma transcricao real que ja existe, so numeros (consumo).
  // Guardado na evidencia so o codigo e os nomes dos campos, nada de valor.
  const projetos = `/home/${DIRETOR_SIS}/.claude/projects`;
  let real = '';
  try {
    for (const p of readdirSync(projetos)) {
      const f = readdirSync(join(projetos, p)).find((x) => x.endsWith('.jsonl'));
      if (f) {
        real = join(projetos, p, f);
        break;
      }
    }
  } catch {
    real = '';
  }
  if (real) {
    k++;
    const r = spawnSync('sudo', ['-n', '-u', 'fabrica-ponte', ...ler], { encoding: 'utf8', cwd: '/', input: JSON.stringify({ op: 'consumo', caminho: real }), timeout: 60_000 });
    let campos = '';
    try {
      campos = Object.keys(JSON.parse(r.stdout) as Record<string, unknown>).join(',');
    } catch {
      campos = '(nao e JSON)';
    }
    writeFileSync(join(L, `caso-${String(k).padStart(2, '0')}.txt`), `ler-transcricao consumo de uma transcricao real (caminho omitido)\ncodigo ${r.status}\ncampos ${campos}\n`, 'utf8');
    conferir(r.status === 0 && campos.length > 0 && campos !== '(nao e JSON)', 'ler-transcricao consumo de transcricao real dentro de projects: aceito, devolve JSON', `codigo ${r.status}, campos ${campos}`);
  } else {
    reg('  PULADO ler-transcricao caso de acerto: nenhuma transcricao em ~/.claude/projects');
  }
}

// ---------------------------------------------------------------------------
// PARTE 8, ligar e desligar ganchos contra casa falsa
// ---------------------------------------------------------------------------

{
  parte('PARTE 8, ligar-ganchos.mjs e desligar-ganchos.mjs contra uma casa FALSA');
  const casa = join(RODADA, 'parte8-casa-falsa');
  mkdirSync(join(casa, '.claude'), { recursive: true });
  const settings = join(casa, '.claude', 'settings.json');
  const ALHEIO = '/usr/local/bin/gancho-alheio-do-diretor.sh';
  const original = {
    model: 'opus',
    permissions: { allow: ['Bash(ls:*)'] },
    hooks: {
      PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: ALHEIO }] }],
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/caminho/gate-deploy.sh' }] }],
    },
  };
  writeFileSync(settings, JSON.stringify(original, null, 2), { encoding: 'utf8', mode: 0o600 });
  chmodSync(settings, 0o600);
  const NODE = '/usr/bin/node';
  const GANCHO_INST = '/opt/a-fabrica-ponte/app/ganchos/a-fabrica-gancho.cjs';
  const rodar = (script: string, args: string[], home: string): { codigo: number | null; saida: string; erro: string } => {
    const r = spawnSync(process.execPath, [join(LINUX, script), ...args], {
      encoding: 'utf8',
      env: { PATH: '/usr/bin:/bin', HOME: home },
      cwd: home,
      timeout: 15_000,
    });
    appendFileSync(join(RODADA, 'parte8-saidas.txt'), `HOME=${home} node ${script} ${args.join(' ')}\ncodigo ${r.status}\n${r.stdout}${r.stderr}\n`, 'utf8');
    return { codigo: r.status, saida: r.stdout ?? '', erro: r.stderr ?? '' };
  };
  type H = { command?: string };
  type Grupo = { matcher?: string; hooks?: H[] };
  const ler = (): { hooks?: Record<string, Grupo[]>; [k: string]: unknown } => JSON.parse(readFileSync(settings, 'utf8')) as { hooks?: Record<string, Grupo[]> };
  const nossos = (j: ReturnType<typeof ler>): number =>
    Object.values(j.hooks ?? {}).reduce((s, gs) => s + gs.reduce((t, g) => t + (g.hooks ?? []).filter((h) => (h.command ?? '').includes('a-fabrica-gancho')).length, 0), 0);
  const temAlheio = (j: ReturnType<typeof ler>): boolean =>
    (j.hooks?.['PostToolUse'] ?? []).some((g) => g.matcher === 'Bash' && (g.hooks ?? []).some((h) => h.command === ALHEIO)) &&
    (j.hooks?.['PreToolUse'] ?? []).some((g) => (g.hooks ?? []).some((h) => h.command === '/caminho/gate-deploy.sh'));
  const copias = (): string[] => (existsSync(join(casa, '.a-fabrica-ponte-copias')) ? readdirSync(join(casa, '.a-fabrica-ponte-copias')) : []);

  const l1 = rodar('ligar-ganchos.mjs', [NODE, GANCHO_INST], casa);
  const j1 = ler();
  conferir(l1.codigo === 0, 'ligar, primeira vez: codigo 0', `codigo ${l1.codigo}, ${l1.saida.trim().split('\n').pop() ?? ''}`);
  conferir(copias().length === 1 && readFileSync(join(casa, '.a-fabrica-ponte-copias', copias()[0]!), 'utf8') === JSON.stringify(original, null, 2), 'ligar: copia de seguranca criada, igual ao original', copias().join(', '));
  conferir(nossos(j1) === 8, 'ligar: 8 eventos com o gancho da Fabrica', `${nossos(j1)} entradas`);
  conferir(temAlheio(j1) && j1['model'] === 'opus' && JSON.stringify(j1['permissions']) === JSON.stringify(original.permissions), 'ligar: gancho alheio e o resto do arquivo mantidos', `alheio ${temAlheio(j1)}, model ${String(j1['model'])}`);
  conferir((statSync(settings).mode & 0o777) === 0o600, 'ligar: modo 600 do settings mantido', (statSync(settings).mode & 0o777).toString(8));
  // Espera um pouco para o selo da copia mudar.
  await new Promise((r) => setTimeout(r, 20));
  const l2 = rodar('ligar-ganchos.mjs', [NODE, GANCHO_INST], casa);
  const j2 = ler();
  conferir(l2.codigo === 0 && nossos(j2) === 8 && /0 evento\(s\) acrescentado\(s\), 8 ja estava/.test(l2.saida), 'ligar, segunda vez: nao duplica', `codigo ${l2.codigo}, ${nossos(j2)} entradas, ${l2.saida.trim().split('\n').pop() ?? ''}`);
  conferir(temAlheio(j2), 'ligar, segunda vez: alheio mantido', String(temAlheio(j2)));
  conferir(copias().length === 2, 'ligar, segunda vez: nova copia, a anterior preservada', copias().join(', '));
  conferir(!readdirSync(join(casa, '.claude')).some((f) => f.includes('.novo-')), 'ligar: nao sobra arquivo temporario', readdirSync(join(casa, '.claude')).join(', '));

  await new Promise((r) => setTimeout(r, 20));
  const d1 = rodar('desligar-ganchos.mjs', [], casa);
  const j3 = ler();
  conferir(d1.codigo === 0 && nossos(j3) === 0 && /8 entrada\(s\) da Fabrica tirada/.test(d1.saida), 'desligar: tira as 8 nossas', `codigo ${d1.codigo}, ${nossos(j3)} sobrando, ${d1.saida.trim().split('\n').pop() ?? ''}`);
  conferir(temAlheio(j3) && j3['model'] === 'opus', 'desligar: alheio e o resto mantidos', `alheio ${temAlheio(j3)}`);
  conferir(JSON.stringify(j3) === JSON.stringify(original), 'desligar: o arquivo volta ao conteudo original', JSON.stringify(j3).slice(0, 160));
  conferir(copias().length === 3, 'desligar: copia de seguranca antes de mexer', copias().join(', '));
  const d2 = rodar('desligar-ganchos.mjs', [], casa);
  conferir(d2.codigo === 0 && JSON.stringify(ler()) === JSON.stringify(original), 'desligar, segunda vez: nada muda', `codigo ${d2.codigo}`);

  // Grupo misto: o nosso e um alheio no MESMO grupo. Desligar tira so o nosso.
  const casaMista = join(RODADA, 'parte8-casa-grupo-misto');
  mkdirSync(join(casaMista, '.claude'), { recursive: true });
  const mista = { hooks: { Stop: [{ hooks: [{ type: 'command', command: ALHEIO }, { type: 'command', command: `"${NODE}" "${GANCHO_INST}" Stop` }] }] } };
  writeFileSync(join(casaMista, '.claude', 'settings.json'), JSON.stringify(mista), 'utf8');
  const d3 = rodar('desligar-ganchos.mjs', [], casaMista);
  const jm = JSON.parse(readFileSync(join(casaMista, '.claude', 'settings.json'), 'utf8')) as { hooks?: Record<string, Grupo[]> };
  const stop = jm.hooks?.['Stop'] ?? [];
  conferir(d3.codigo === 0 && stop.length === 1 && stop[0]?.hooks?.length === 1 && stop[0].hooks[0]?.command === ALHEIO, 'desligar, grupo misto: fica so o alheio', JSON.stringify(jm));

  // Sem settings.json: ligar para e nao cria.
  const casaVazia = join(RODADA, 'parte8-casa-sem-settings');
  mkdirSync(casaVazia);
  const l3 = rodar('ligar-ganchos.mjs', [NODE, GANCHO_INST], casaVazia);
  conferir(l3.codigo === 2 && !existsSync(join(casaVazia, '.claude', 'settings.json')), 'ligar sem settings.json: para com codigo 2 e nao cria', `codigo ${l3.codigo}`);
  const d4 = rodar('desligar-ganchos.mjs', [], casaVazia);
  conferir(d4.codigo === 0 && !existsSync(join(casaVazia, '.claude', 'settings.json')), 'desligar sem settings.json: sai 0 e nao cria', `codigo ${d4.codigo}`);
  // Gancho sem a marca: recusa.
  const l4 = rodar('ligar-ganchos.mjs', [NODE, '/opt/outro/gancho.cjs'], casa);
  conferir(l4.codigo === 64 && JSON.stringify(ler()) === JSON.stringify(original), 'ligar com gancho sem a marca: recusa com 64 e nao mexe', `codigo ${l4.codigo}`);
  // settings.json que nao e objeto: ligar recusa e nao mexe.
  const casaLista = join(RODADA, 'parte8-casa-settings-lista');
  mkdirSync(join(casaLista, '.claude'), { recursive: true });
  writeFileSync(join(casaLista, '.claude', 'settings.json'), '[1,2]', 'utf8');
  const l5 = rodar('ligar-ganchos.mjs', [NODE, GANCHO_INST], casaLista);
  conferir(l5.codigo === 3 && readFileSync(join(casaLista, '.claude', 'settings.json'), 'utf8') === '[1,2]', 'ligar com settings que nao e objeto: recusa com 3 e nao mexe', `codigo ${l5.codigo}`);
}

// ---------------------------------------------------------------------------
// Fim
// ---------------------------------------------------------------------------

parte('FIM');
const settingsDepois = marcaDoSettingsReal();
conferir(settingsDepois === settingsAntes, '~/.claude/settings.json real nao mudou', settingsDepois);
reg(`total: ${passou} passaram, ${falhou} falharam`);
for (const f of falhas) reg(`  FALHA: ${f}`);
reg(`evidencia em ${RODADA}`);
process.exit(falhou === 0 ? 0 : 1);
