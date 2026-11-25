/*
 * OST 15, prova sem navegador do nome da sessão, do estado por máquina e do
 * rótulo da máquina no cartão. Compila tradutor.ts e formato.ts com o tsc do
 * próprio painel para a pasta desta rodada e roda contra casos montados.
 *
 * Cobre também as condições 19, 20 e 21 da segurança para o painel.
 *
 * Uso, da raiz do repositório: node painel/testes/rodada-2026-11-25-120439-ost15/prova.cjs
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
const tradutorJs = path.join(saida, 'dados', 'tradutor.js');
fs.writeFileSync(tradutorJs, fs.readFileSync(tradutorJs, 'utf8').replace(/require\("@\/formato"\)/g, 'require("../formato")'));

const T = require(tradutorJs);

let falhas = 0;
function confere(nome, ok, detalhe) {
  if (!ok) falhas++;
  log(`${ok ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? `  (${detalhe})` : ''}`);
}

const AGORA = new Date('2026-11-25T15:00:00Z');
const ha = (ms) => new Date(AGORA.getTime() - ms).toISOString();

/* O mesmo cálculo de painel.ts, montarEstadoDoPainel, para a lista de fábricas. */
function montar(maquinas, fabricas) {
  const ponte = T.avaliarPonte(maquinas.filter((m) => m.teste !== true), AGORA);
  const mapa = T.mapaDeMaquinas(maquinas, AGORA);
  const lista = T.distinguirExternas(
    fabricas.map((doc) => T.traduzirFabrica(doc, { ...T.ponteDaFabrica(doc, mapa, ponte), pedidoParado: null, agora: AGORA })),
    AGORA
  );
  return { ponte, lista, por: (id) => lista.find((f) => f.id === id) };
}

const notebook = (campos = {}) => ({ id: 'pc-rike', maquinaId: 'pc-rike', nome: 'PC-RIKE', rotulo: 'Notebook', estadoPonte: 'online', vistoPorUltimo: ha(5_000), ...campos });
const nuvem = (campos = {}) => ({ id: 'fabrica-1', maquinaId: 'fabrica-1', nome: 'fabrica-1', rotulo: 'Nuvem', estadoPonte: 'online', vistoPorUltimo: ha(5_000), ...campos });
const fab = (id, campos = {}) => ({ id, origem: 'mao', estado: 'em execucao', inicio: ha(3_600_000), projeto: 'C:\\x\\a-fabrica', ...campos });

/* ---------- caso 1: prioridade do nome ---------- */
log('Caso 1. Prioridade do nome: nomeDado, nomeDaSessao, tituloDaSessao, Fábrica externa.');
{
  const m = [notebook()];
  const { por } = montar(m, [
    fab('mao-1', { maquinaId: 'pc-rike', nome: 'Dado no painel', nomeDaSessao: 'Do rename', tituloDaSessao: 'Do Claude' }),
    fab('mao-2', { maquinaId: 'pc-rike', nomeDaSessao: 'Do rename', tituloDaSessao: 'Do Claude' }),
    fab('mao-3', { maquinaId: 'pc-rike', nomeDaSessao: null, tituloDaSessao: 'Do Claude' }),
    fab('mao-4', { maquinaId: 'pc-rike' })
  ]);
  confere('nomeDado vale mais que tudo', por('mao-1').project === 'Dado no painel');
  confere('a caixa de renomear começa com o nomeDado', por('mao-1').nomeDado === 'Dado no painel');
  confere('sem nomeDado, vale o customTitle', por('mao-2').project === 'Do rename');
  confere('renomeada só na sessão: a caixa de renomear começa vazia', por('mao-2').nomeDado === null);
  confere('sem customTitle, vale o aiTitle', por('mao-3').project === 'Do Claude');
  confere('sem nada, Fábrica externa', por('mao-4').project === 'Fábrica externa', por('mao-4').project);
}
{
  const { por } = montar([notebook()], [
    fab('mao-a', { maquinaId: 'pc-rike', inicio: ha(7_200_000) }),
    fab('mao-b', { maquinaId: 'pc-rike', inicio: ha(3_600_000) }),
    fab('mao-c', { maquinaId: 'pc-rike', tituloDaSessao: 'Com título' })
  ]);
  confere('duas sem nome ganham a hora', /^Fábrica externa das \d\d:\d\d$/.test(por('mao-a').project) && por('mao-a').project !== por('mao-b').project, `${por('mao-a').project} / ${por('mao-b').project}`);
  confere('a que tem título da sessão não entra na conta da hora', por('mao-c').project === 'Com título');
}
{
  const { por } = montar([notebook()], [fab('mao-a', { maquinaId: 'pc-rike' }), fab('mao-c', { maquinaId: 'pc-rike', nomeDaSessao: 'X' })]);
  confere('uma sem nome sozinha fica Fábrica externa, mesmo com outra nomeada pela sessão', por('mao-a').project === 'Fábrica externa');
}

/* ---------- caso 2: condição 21, tolerância e teto ---------- */
log('');
log('Caso 2. Condição 21: campo ausente, nulo ou que não é texto; teto de 80 no nome e 40 no rótulo.');
{
  const longo = 'n'.repeat(200);
  const { por } = montar([notebook()], [
    fab('mao-n1', { maquinaId: 'pc-rike', nomeDaSessao: 42, tituloDaSessao: 'Título bom' }),
    fab('mao-n2', { maquinaId: 'pc-rike', nomeDaSessao: { a: 1 }, tituloDaSessao: ['x'] }),
    fab('mao-n3', { maquinaId: 'pc-rike', nomeDaSessao: '   ', tituloDaSessao: '' }),
    fab('mao-n4', { maquinaId: 'pc-rike', nomeDaSessao: longo }),
    fab('mao-n5', { maquinaId: 'pc-rike', tituloDaSessao: longo }),
    fab('mao-n6', { maquinaId: 'pc-rike', nomeDaSessao: '  dois\n\tespaços  ' })
  ]);
  confere('nomeDaSessao numérico é ignorado e cai no título', por('mao-n1').project === 'Título bom');
  confere('objeto e lista nos dois campos caem em Fábrica externa', por('mao-n2').project.startsWith('Fábrica externa'), por('mao-n2').project);
  confere('texto em branco nos dois campos cai em Fábrica externa', por('mao-n3').project.startsWith('Fábrica externa'), por('mao-n3').project);
  confere('nomeDaSessao de 200 letras é cortado em 80', por('mao-n4').project.length === 80);
  confere('tituloDaSessao de 200 letras é cortado em 80', por('mao-n5').project.length === 80);
  confere('quebra de linha e tabulação viram espaço simples', por('mao-n6').project === 'dois espaços');
  const escritas = fs.readFileSync(path.join(painel, 'src', 'dados', 'escritas.ts'), 'utf8');
  const teto = Number((escritas.match(/export const TETO_NOME = (\d+);/) || [])[1]);
  confere('o teto do painel é o mesmo TETO_NOME de escritas.ts', T.TETO_NOME_DA_SESSAO === teto && teto === 80, `${T.TETO_NOME_DA_SESSAO} e ${teto}`);

  const r1 = T.avaliarMaquina(notebook({ rotulo: 'r'.repeat(100) }), AGORA);
  confere('rótulo de 100 letras é cortado em 40', r1.rotulo.length === 40 && T.TETO_ROTULO === 40);
  for (const [nome, valor] of [['ausente', undefined], ['nulo', null], ['número', 7], ['objeto', { x: 1 }], ['em branco', '  ']]) {
    const m = notebook({ rotulo: valor });
    if (valor === undefined) delete m.rotulo;
    const a = T.avaliarMaquina(m, AGORA);
    confere(`rótulo ${nome}: o painel usa o nome da máquina`, a.rotulo === null && a.ondeRoda === 'PC-RIKE');
  }
}

/* ---------- caso 3: estado por máquina ---------- */
log('');
log('Caso 3. A queda de uma máquina não derruba a fábrica da outra.');
const tres = (maquinas) =>
  montar(maquinas, [
    fab('mao-note', { maquinaId: 'pc-rike' }),
    fab('mao-nuvem', { maquinaId: 'fabrica-1' }),
    fab('painel-antiga', { origem: 'painel' }),
    fab('mao-sumida', { maquinaId: 'maquina-que-nao-existe' }),
    fab('mao-feita', { maquinaId: 'fabrica-1', estado: 'concluida' })
  ]);
{
  const { por, ponte } = tres([notebook(), nuvem({ vistoPorUltimo: ha(10 * 60_000) })]);
  confere('Nuvem caída: a fábrica do Notebook continua em execução', por('mao-note').state === 'running');
  confere('Nuvem caída: a fábrica da Nuvem fica ponte offline', por('mao-nuvem').state === 'offline');
  confere('Nuvem caída: concluída na Nuvem continua concluída', por('mao-feita').state === 'done');
  confere('Nuvem caída: a perda de conexão da Nuvem tem a hora do último sinal dela', por('mao-nuvem').perdeuConexaoEm?.toISOString() === ha(10 * 60_000));
  const frases = T.indicadoresDaPonte(ponte).map((i) => i.label);
  confere('o indicador geral diz cada máquina', frases.join(', ') === 'Notebook conectada, Nuvem offline', frases.join(', '));
  confere('a offline diz há quanto tempo', T.indicadoresDaPonte(ponte).find((i) => !i.online)?.detail === 'há 10 min');
}
{
  const { por, ponte } = tres([notebook({ estadoPonte: 'offline' }), nuvem()]);
  confere('Notebook caído: a fábrica da Nuvem continua em execução', por('mao-nuvem').state === 'running');
  confere('Notebook caído: a fábrica do Notebook fica ponte offline', por('mao-note').state === 'offline');
  const frases = T.indicadoresDaPonte(ponte).map((i) => i.label).join(', ');
  confere('o indicador geral diz Notebook offline e Nuvem conectada', frases === 'Notebook offline, Nuvem conectada', frases);
}
{
  const { por } = tres([notebook(), nuvem()]);
  confere('as duas no ar: as duas fábricas em execução', por('mao-note').state === 'running' && por('mao-nuvem').state === 'running');
  confere('máquina que a base não conhece: ponte offline, nunca em execução', por('mao-sumida').state === 'offline');
}

log('');
log('Caso 4. Fábrica sem maquinaId segue a regra de antes, a ponte geral.');
{
  confere('sem maquinaId, alguma máquina no ar: em execução', tres([notebook(), nuvem({ estadoPonte: 'offline' })]).por('painel-antiga').state === 'running');
  confere('sem maquinaId, todas caídas: ponte offline', tres([notebook({ estadoPonte: 'offline' }), nuvem({ estadoPonte: 'offline' })]).por('painel-antiga').state === 'offline');
  confere('sem maquinaId e sem máquina nenhuma: ponte offline', tres([]).por('painel-antiga').state === 'offline');
  confere('sem máquina nenhuma, o indicador geral fica com a regra de antes', T.indicadoresDaPonte(tres([]).ponte).length === 0 && tres([]).ponte.situacao === 'sem maquina');
  const teste = tres([notebook(), { id: 'teste-x', nome: 'teste', teste: true, estadoPonte: 'offline' }]).ponte;
  confere('máquina de rodada de teste fica fora do indicador geral', T.indicadoresDaPonte(teste).map((i) => i.label).join(', ') === 'Notebook conectada');
}

/* ---------- caso 5: rótulo e fallback no cartão ---------- */
log('');
log('Caso 5. Onde roda: rótulo; sem rótulo, nome; sem máquina, nada.');
{
  const { por } = tres([notebook(), nuvem({ rotulo: null })]);
  confere('com rótulo, o cartão diz Notebook', por('mao-note').ondeRoda === 'Notebook');
  confere('sem rótulo, o cartão diz o nome da máquina', por('mao-nuvem').ondeRoda === 'fabrica-1');
  confere('sem maquinaId, o cartão não diz nada', por('painel-antiga').ondeRoda === null);
  confere('máquina que a base não conhece, o cartão não diz nada', por('mao-sumida').ondeRoda === null);
  const semNada = T.avaliarMaquina({ id: 'x9', rotulo: null }, AGORA);
  confere('máquina sem rótulo e sem nome: o cartão não diz nada, o indicador usa o identificador', semNada.ondeRoda === null && semNada.chamada === 'x9');
}

/* ---------- caso 6: condições 19 e 20, e o travessão ---------- */
log('');
log('Caso 6. Condições 19 e 20: o nome só entra como texto; sem travessão na tela.');
function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(path.join(dir, e.name)) : /\.(tsx?|css)$/.test(e.name) ? [path.join(dir, e.name)] : []));
}
const fontes = [...arquivos(path.join(painel, 'src')), ...arquivos(path.join(painel, 'app'))];
const perigosas = [];
const nomeEmAtributo = [];
const notificacao = [];
for (const arq of fontes) {
  const texto = fs.readFileSync(arq, 'utf8');
  if (/dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(texto)) perigosas.push(path.relative(painel, arq));
  if (/new\s+Notification\s*\(|showNotification\s*\(/.test(texto)) notificacao.push(path.relative(painel, arq));
  texto.split(/\r?\n/).forEach((l, i) => {
    if (/\b(href|src|style|srcDoc|action|formAction)\s*=\s*\{[^}]*(project|ondeRoda|nomeDaSessao|tituloDaSessao|rotulo|chamada|label)\b/.test(l))
      nomeEmAtributo.push(`${path.relative(painel, arq)}:${i + 1}`);
  });
}
confere('nenhum arquivo do painel monta HTML cru', perigosas.length === 0, perigosas.join(', '));
confere('nome, título e rótulo não entram em href, src, estilo nem ação', nomeEmAtributo.length === 0, nomeEmAtributo.join(', '));
confere('o painel não monta aviso de celular com o nome (não há aviso de sistema no código do painel)', notificacao.length === 0, notificacao.join(', '));

const tocados = [
  'src/dados/tradutor.ts',
  'src/dados/painel.ts',
  'src/dados/tipos.ts',
  'src/componentes/ds/BridgeStatus.tsx',
  'src/componentes/ds/Sidebar.tsx',
  'src/telas/Celular.tsx',
  'src/telas/Computador.tsx',
  'src/telas/FabricaTela.tsx',
  'src/telas/FabricaViva.tsx',
  'src/telas/FabricasFechadas.tsx',
  'src/telas/VisaoGeral.tsx',
  'app/globals.css'
];
const comTravessao = tocados.filter((a) => /[\u2014\u2013]/.test(fs.readFileSync(path.join(painel, a), 'utf8')));
confere('nenhum travessão nos arquivos tocados', comTravessao.length === 0, comTravessao.join(', '));
{
  const { ponte } = tres([notebook(), nuvem({ vistoPorUltimo: ha(3_600_000) })]);
  const frases = T.indicadoresDaPonte(ponte).flatMap((i) => [i.label, i.detail ?? '', i.machine ?? '']).join(' ');
  confere('nenhum travessão nas frases do indicador', !/[\u2014\u2013]/.test(frases), frases);
}
const painelTs = fs.readFileSync(path.join(painel, 'src', 'dados', 'painel.ts'), 'utf8');
confere('painel.ts usa ponteDaFabrica, e não mais a ponte geral, para cada fábrica', /ponteDaFabrica\(doc, mapa, ponte\)/.test(painelTs) && !/const pontePerdida = !ponte\.online/.test(painelTs));

log('');
log(falhas ? `${falhas} verificação(ões) falharam.` : 'Todas as verificações passaram.');
fs.writeFileSync(path.join(aqui, 'saida-da-prova.txt'), linhas.join('\n') + '\n');
process.exit(falhas ? 1 : 0);
