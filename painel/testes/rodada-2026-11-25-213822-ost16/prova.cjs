/*
 * OST 16, prova sem navegador do crachá por máquina no painel: janela dos
 * pedidos, pedido duplicado, montagem do lote de emissão e de revogação, origem
 * "painel" (R5) e as condições N1 a N5 que se conferem lendo o código.
 *
 * Compila crachas.ts, tradutor.ts e formato.ts com o tsc do próprio painel para
 * a pasta desta rodada e roda contra casos montados.
 *
 * Uso, da raiz do repositório: node painel/testes/rodada-2026-11-25-213822-ost16/prova.cjs
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

const C = require(path.join(saida, 'dados', 'crachas.js'));

let falhas = 0;
let total = 0;
function confere(nome, ok, detalhe) {
  total++;
  if (!ok) falhas++;
  log(`${ok ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? `  (${detalhe})` : ''}`);
}

const AGORA = new Date('2026-11-25T21:00:00Z');
const MIN = 60_000;
const ha = (ms) => new Date(AGORA.getTime() - ms);
/* Hora como o Firestore entrega: um Timestamp, com toDate(). */
const ts = (d) => (d instanceof Date ? { toDate: () => d } : d);
const comHora = (campos, chaves) => { const c = { ...campos }; for (const k of chaves) if (k in c) c[k] = ts(c[k]); return c; };
const lerSrc = (rel) => fs.readFileSync(path.join(painel, rel), 'utf8');

const UID_A = 'AaAaAaAa1111111111111111111A';
const UID_B = 'BbBbBbBb2222222222222222222B';
const UID_C = 'CcCcCcCc3333333333333333333C';
const pedido = (uid, campos = {}) =>
  C.traduzirPedido({
    id: uid,
    uid,
    maquinaId: 'maquina-fa546467f75e',
    nome: 'PC-RIKE',
    rotulo: 'Notebook',
    codigo: '482913',
    ...comHora({ criadoEm: ha(2 * MIN), ...campos }, ['criadoEm'])
  });
const cracha = (uid, campos = {}) =>
  C.traduzirCracha({
    id: uid,
    uid,
    maquinaId: 'maquina-fa546467f75e',
    rotulo: 'Notebook',
    ativo: true,
    emitidoEm: ts(ha(60 * MIN)),
    emitidoPor: 'painel no computador, diretor',
    ...comHora(campos, ['emitidoEm', 'revogadoEm'])
  });

/* ---------- caso 1: janela de 15 minutos ---------- */
log('Caso 1. Janela de 15 minutos, N2 e R12.');
confere('janela é de 15 minutos', C.JANELA_DO_PEDIDO_MS === 15 * MIN);
confere('limite da consulta é 20', C.LIMITE_DE_PEDIDOS === 20);
confere('pedido de agora está dentro', C.dentroDaJanela(AGORA, AGORA));
confere('pedido de 14 min 59 s está dentro', C.dentroDaJanela(ha(15 * MIN - 1000), AGORA));
confere('pedido de 15 min exatos está dentro', C.dentroDaJanela(ha(15 * MIN), AGORA));
confere('pedido de 15 min e 1 s está fora', !C.dentroDaJanela(ha(15 * MIN + 1000), AGORA));
confere('pedido de 2 h está fora', !C.dentroDaJanela(ha(120 * MIN), AGORA));
confere('pedido sem hora está fora (falha fechada)', !C.dentroDaJanela(null, AGORA));
confere('pedido 1 min no futuro (relógio atrasado) está dentro', C.dentroDaJanela(new Date(AGORA.getTime() + MIN), AGORA));
confere('pedido 3 min no futuro está fora', !C.dentroDaJanela(new Date(AGORA.getTime() + 3 * MIN), AGORA));
confere('início da janela é agora menos 15 min', C.inicioDaJanela(AGORA).getTime() === AGORA.getTime() - 15 * MIN);
confere('quanto falta: pedido de 2 min vence em 13 min', C.restaDoPedido(pedido(UID_A), AGORA) === 13 * MIN);

/* ---------- caso 2: pedidos abertos ---------- */
log('');
log('Caso 2. Pedidos abertos: na janela, sem crachá para o mesmo uid, mais novo em cima.');
{
  const lista = [
    pedido(UID_A, { criadoEm: ha(10 * MIN) }),
    pedido(UID_B, { criadoEm: ha(1 * MIN), maquinaId: 'maquina-nuvem', codigo: '111111' }),
    pedido(UID_C, { criadoEm: ha(20 * MIN), maquinaId: 'maquina-escritorio', codigo: '222222' })
  ];
  const abertos = C.pedidosAbertos(lista, [], AGORA);
  confere('o vencido sai', abertos.length === 2 && !abertos.some((p) => p.uid === UID_C));
  confere('mais novo em cima', abertos[0].uid === UID_B && abertos[1].uid === UID_A);
  const comAtivo = C.pedidosAbertos(lista, [cracha(UID_A)], AGORA);
  confere('pedido cujo uid já tem crachá ativo sai', !comAtivo.some((p) => p.uid === UID_A));
  const comRevogado = C.pedidosAbertos(lista, [cracha(UID_A, { ativo: false })], AGORA);
  confere('pedido cujo uid já teve crachá revogado sai (revogado não volta)', !comRevogado.some((p) => p.uid === UID_A));
}

/* ---------- caso 3: pedido malformado ---------- */
log('');
log('Caso 3. Pedido malformado não vira crachá.');
confere('pedido bem formado', pedido(UID_A).malformado === null);
confere('uid diferente do id', C.traduzirPedido({ id: UID_A, uid: UID_B, maquinaId: 'maquina-x', codigo: '123456', criadoEm: ts(AGORA) }).malformado !== null);
confere('máquina fora do padrão', pedido(UID_A, { maquinaId: 'PC-RIKE' }).malformado !== null);
confere('máquina com maiúscula', pedido(UID_A, { maquinaId: 'maquina-ABC' }).malformado !== null);
confere('código de 5 dígitos', pedido(UID_A, { codigo: '12345' }).malformado !== null);
confere('código como número, e não texto', pedido(UID_A, { codigo: 482913 }).malformado !== null);
confere('código com letra', pedido(UID_A, { codigo: '12a456' }).malformado !== null);
confere('crachá com ativo "true" em texto conta como revogado', C.traduzirCracha({ id: 'x', uid: 'x', ativo: 'true' }).ativo === false);
confere('crachá com ativo true é ativo', cracha(UID_A).ativo === true);
confere('pedaço do uid tem 8 caracteres', C.uidCurto(UID_A) === 'AaAaAaAa');

/* ---------- caso 4: duplicidade, N1 ---------- */
log('');
log('Caso 4. Pedido duplicado, N1: mesma máquina ou mesmo código barra a emissão.');
const ctx = (abertos, extra = {}) => ({ abertos, crachas: [], agora: AGORA, listaCheia: false, conferido: true, ...extra });
{
  const a = pedido(UID_A);
  const b = pedido(UID_B, { codigo: '999999' });
  const abertos = C.pedidosAbertos([a, b], [], AGORA);
  const d = C.duplicidadeDoPedido(a, abertos);
  confere('dois pedidos para a mesma máquina: duplicidade', d.mesmaMaquina === 1 && d.mesmoCodigo === 0);
  confere('barra o primeiro', C.barreiraDaEmissao(a, ctx(abertos))?.tipo === 'duplicado');
  confere('barra o segundo também', C.barreiraDaEmissao(b, ctx(abertos))?.tipo === 'duplicado');
}
{
  const a = pedido(UID_A);
  const b = pedido(UID_B, { maquinaId: 'maquina-nuvem' });
  const abertos = C.pedidosAbertos([a, b], [], AGORA);
  const d = C.duplicidadeDoPedido(a, abertos);
  confere('mesmo código em máquinas diferentes: duplicidade', d.mesmoCodigo === 1 && d.mesmaMaquina === 0);
  confere('barra', C.barreiraDaEmissao(a, ctx(abertos))?.tipo === 'duplicado');
}
{
  const a = pedido(UID_A);
  const b = pedido(UID_B, { maquinaId: 'maquina-nuvem', codigo: '111111' });
  const abertos = C.pedidosAbertos([a, b], [], AGORA);
  confere('máquinas e códigos diferentes: nada barra', C.barreiraDaEmissao(a, ctx(abertos)) === null);
}
{
  const a = pedido(UID_A);
  const velho = pedido(UID_B, { criadoEm: ha(16 * MIN) });
  const abertos = C.pedidosAbertos([a, velho], [], AGORA);
  confere('pedido vencido da mesma máquina não conta como duplicado', C.barreiraDaEmissao(a, ctx(abertos)) === null);
}
{
  const a = pedido(UID_A);
  const atendido = pedido(UID_B);
  const crachas = [cracha(UID_B)];
  const abertos = C.pedidosAbertos([a, atendido], crachas, AGORA);
  confere(
    'pedido já atendido da mesma máquina não conta como duplicado (é troca, N3)',
    C.barreiraDaEmissao(a, ctx(abertos, { crachas })) === null
  );
}
{
  const a = pedido(UID_A);
  const frase = C.fraseDaBarreira(C.barreiraDaEmissao(a, ctx(C.pedidosAbertos([a, pedido(UID_B)], [], AGORA))));
  confere('a frase diz que pode ser falsificação e o que fazer', /falsifica/.test(frase) && /O que fazer/.test(frase) && /Nada foi emitido/.test(frase));
}

/* ---------- caso 5: ordem das barreiras ---------- */
log('');
log('Caso 5. O que barra a emissão, na ordem, falha fechada.');
{
  const a = pedido(UID_A);
  const abertos = [a];
  confere('malformado barra primeiro', C.barreiraDaEmissao(pedido(UID_A, { codigo: '1' }), ctx(abertos))?.tipo === 'malformado');
  confere('uid já com crachá barra', C.barreiraDaEmissao(a, ctx(abertos, { crachas: [cracha(UID_A, { ativo: false })] }))?.tipo === 'ja emitido');
  confere('vencido barra', C.barreiraDaEmissao(pedido(UID_A, { criadoEm: ha(16 * MIN) }), ctx(abertos))?.tipo === 'vencido');
  confere('lista no teto de 20 barra', C.barreiraDaEmissao(a, ctx(abertos, { listaCheia: true }))?.tipo === 'lista cheia');
  confere('sem a conferência do diretor, barra', C.barreiraDaEmissao(a, ctx(abertos, { conferido: false }))?.tipo === 'nao conferido');
  confere('pedido certo, conferido, sem duplicado: libera', C.barreiraDaEmissao(a, ctx(abertos)) === null);
  const tipos = ['malformado', 'vencido', 'ja emitido', 'lista cheia', 'nao conferido'];
  const frases = [
    ...tipos.map((t) => C.fraseDaBarreira(t === 'malformado' ? { tipo: t, motivo: 'teste' } : { tipo: t })),
    C.fraseDaBarreira({ tipo: 'duplicado', duplicidade: { mesmaMaquina: 1, mesmoCodigo: 1 } })
  ];
  confere('nenhuma frase de barreira tem travessão', !frases.some((f) => /[—–]/.test(f)));
  confere('toda frase de barreira diz que nada foi emitido ou o que fazer', frases.every((f) => /Nada foi emitido|nada é emitido|nada foi emitido|Rode de novo/.test(f)));
}

/* ---------- caso 6: lote de emissão, N3 e R12 ---------- */
log('');
log('Caso 6. Lote de emissão: cria o crachá com os campos exatos e revoga os ativos da máquina no mesmo lote.');
const HORA = { marcador: 'hora do servidor' };
const ORIGEM = C.origemDoPainel(false, 'henrique.vieira@soulan.com.br');
{
  const lote = C.loteDeEmissao(pedido(UID_A), [], ORIGEM, HORA);
  confere('máquina sem crachá: uma escrita só, a criação', lote.length === 1 && lote[0].operacao === 'criar');
  const criar = lote[0];
  confere('documento é crachas/{uid}', criar.colecao === 'crachas' && criar.id === UID_A);
  const chaves = Object.keys(criar.dados).sort().join(',');
  confere('campos exatos: uid, maquinaId, rotulo, ativo, emitidoEm, emitidoPor', chaves === 'ativo,emitidoEm,emitidoPor,maquinaId,rotulo,uid', chaves);
  confere('uid igual ao id do documento', criar.dados.uid === UID_A);
  confere('maquinaId igual ao do pedido', criar.dados.maquinaId === 'maquina-fa546467f75e');
  confere('rótulo igual ao do pedido', criar.dados.rotulo === 'Notebook');
  confere('ativo é true', criar.dados.ativo === true);
  confere('emitidoEm é a hora do servidor', criar.dados.emitidoEm === HORA);
  confere('emitidoPor começa com "painel"', /^painel/.test(criar.dados.emitidoPor), criar.dados.emitidoPor);
  const semRotulo = C.loteDeEmissao(pedido(UID_A, { rotulo: null }), [], ORIGEM, HORA)[0];
  confere('pedido sem rótulo: crachá com rótulo null, não ausente', 'rotulo' in semRotulo.dados && semRotulo.dados.rotulo === null);
  const rotuloCru = C.loteDeEmissao(pedido(UID_A, { rotulo: 'Note  book' }), [], ORIGEM, HORA)[0];
  confere('rótulo vai para o crachá exatamente como está no pedido', rotuloCru.dados.rotulo === 'Note  book');
}
{
  const crachas = [
    cracha('velho1'),
    cracha('velho2'),
    cracha('revogado', { ativo: false }),
    cracha('outra', { maquinaId: 'maquina-nuvem' })
  ];
  const lote = C.loteDeEmissao(pedido(UID_A), crachas, ORIGEM, HORA);
  confere('máquina com 2 ativos: 1 criação e 2 revogações no mesmo lote', lote.length === 3 && lote[0].operacao === 'criar' && lote.slice(1).every((e) => e.operacao === 'revogar'));
  const revogados = lote.slice(1).map((e) => e.id).sort().join(',');
  confere('revoga só os ativos desta máquina', revogados === 'velho1,velho2', revogados);
  const rev = lote[1];
  const chaves = Object.keys(rev.dados).sort().join(',');
  confere('revogação mexe só em ativo, revogadoEm, revogadoPor', chaves === 'ativo,revogadoEm,revogadoPor', chaves);
  confere('revogação põe ativo false', rev.dados.ativo === false);
  confere('revogadoEm é a hora do servidor', rev.dados.revogadoEm === HORA);
  confere('revogadoPor começa com "painel"', /^painel/.test(rev.dados.revogadoPor));
}

/* ---------- caso 7: lote de revogação, N3 ---------- */
log('');
log('Caso 7. Revogar revoga todos os ativos da máquina.');
{
  const crachas = [cracha('a1'), cracha('a2'), cracha('r1', { ativo: false }), cracha('n1', { maquinaId: 'maquina-nuvem' })];
  const lote = C.loteDeRevogacao('maquina-fa546467f75e', crachas, ORIGEM, HORA);
  confere('revoga os 2 ativos', lote.length === 2 && lote.every((e) => e.operacao === 'revogar'));
  confere('não toca no revogado nem na outra máquina', !lote.some((e) => e.id === 'r1' || e.id === 'n1'));
  confere('máquina sem ativo: lote vazio, e a escrita diz que não havia o que revogar', C.loteDeRevogacao('maquina-nada', crachas, ORIGEM, HORA).length === 0);
  const ordem = C.ordenarCrachas([cracha('r', { ativo: false, emitidoEm: ha(1 * MIN) }), cracha('a', { emitidoEm: ha(90 * MIN) })]);
  confere('lista da tela: ativo em cima do revogado', ordem[0].id === 'a');
}

/* ---------- caso 8: R5 e a porta única de escrita ---------- */
log('');
log('Caso 8. R5 e a porta única: o que o código grava.');
{
  confere('origem do computador começa com "painel"', /^painel/.test(C.origemDoPainel(false, 'x@y')));
  confere('origem do celular começa com "painel"', /^painel/.test(C.origemDoPainel(true, 'x@y')));
  const escritas = lerSrc('src/dados/escritas.ts');
  confere('conferir() monta a origem com origemDoPainel', /origem: origemDoPainel\(ctx\.celular, email\)/.test(escritas));
  confere('a resposta de aprovação grava respondidoPor com essa origem', /respondidoPor: pronto\.origem/.test(escritas));
  confere('a resposta de aprovação mantém situacao, resposta, observacao e respondidoEm', /situacao: 'respondida'/.test(escritas) && /resposta: dados\.resposta/.test(escritas) && /observacao: observacao \|\| null/.test(escritas) && /respondidoEm: serverTimestamp\(\)/.test(escritas));
  confere('emissão e revogação gravam em lote (writeBatch)', /writeBatch\(base\)/.test(escritas) && /gravacao\.commit\(\)/.test(escritas));
  confere('emissão relê os pedidos na base antes de decidir', /lerParaDecidir\(pronto\.base/.test(escritas) && /barreiraDaEmissao\(pedido/.test(escritas));
  confere('a hora gravada é serverTimestamp()', /loteDeEmissao<FieldValue>\([^)]*serverTimestamp\(\)\)/.test(escritas) && /loteDeRevogacao<FieldValue>\([^)]*serverTimestamp\(\)\)/.test(escritas));
  const tela = lerSrc('src/telas/Configuracoes.tsx');
  confere('a tela não chama setDoc, updateDoc, addDoc nem writeBatch', !/\b(setDoc|updateDoc|addDoc|writeBatch)\b/.test(tela));
  confere('a tela não importa firebase/firestore para escrever', !/from 'firebase\/firestore'/.test(tela.replace(/import type \{[^}]*\} from 'firebase\/firestore';/g, '')));
  const ouvintes = lerSrc('src/dados/ouvintes.ts');
  confere(
    'consulta de pedidos: criadoEm >= início da janela, ordem por criadoEm e limite',
    /collection\(base, 'pedidosDeCracha'\),\s*where\('criadoEm', '>=', new Date\(desdeMs\)\),\s*orderBy\('criadoEm', 'desc'\),\s*limitar\(quantos\)/.test(ouvintes)
  );
  confere('a tela pede o limite de 20', /usarPedidosDeCracha\(base, desde, LIMITE_DE_PEDIDOS\)/.test(tela));
  confere(
    'a releitura da emissão usa a mesma janela e o mesmo limite',
    /collection\(base, 'pedidosDeCracha'\),\s*where\('criadoEm', '>=', inicioDaJanela\(agora\)\),\s*orderBy\('criadoEm', 'desc'\),\s*limitar\(LIMITE_DE_PEDIDOS\)/.test(escritas)
  );
}

/* ---------- caso 9: N1 na tela, N4 e N5 ---------- */
log('');
log('Caso 9. N1 na tela, N4 (texto puro) e N5 (§A.22 e §A.11).');
{
  const tela = lerSrc('src/telas/Configuracoes.tsx');
  confere('a confirmação mostra o código e o começo do uid', /<Codigo codigo=\{p\.codigo\} grande \/>/.test(tela) && /uidCurto\(p\.uid\)/.test(tela));
  confere('o botão de confirmar diz que são os mesmos', /São os mesmos, emitir crachá/.test(tela));
  confere('a emissão só sai com conferido: true pela confirmação', /emitirCracha\(escrita, \{ pedido, conferido: true \}\)/.test(tela));
  confere('máquina com crachá ativo: a tela avisa antes que emitir revoga o antigo', /Emitir revoga/.test(tela) && /Na mesma gravação/.test(tela));
  confere('revogar pede confirmação', /titulo=\{`Revogar o crachá de/.test(tela) && /aoConfirmar=\{acoes\.confirmarRevogacao\}/.test(tela));
  confere('erro da escrita fica na tela, dentro e fora da confirmação', /erro=\{acoes\.ordem\.erro\}/.test(tela) && /<ErroDeEscrita mensagem=\{acoes\.ordem\.erro\}/.test(tela));
  confere('erro de leitura aparece na tela', /dados\.erroDeLeitura \? <ErroDeEscrita/.test(tela));

  const arquivos = [];
  const andar = (dir) => {
    for (const nome of fs.readdirSync(dir)) {
      const p = path.join(dir, nome);
      if (fs.statSync(p).isDirectory()) andar(p);
      else if (/\.(tsx?|css)$/.test(nome)) arquivos.push(p);
    }
  };
  andar(path.join(painel, 'src'));
  const comHtmlCru = arquivos.filter((a) => /dangerouslySetInnerHTML|innerHTML\s*=/.test(fs.readFileSync(a, 'utf8')));
  confere('nenhum arquivo do painel monta HTML cru', comHtmlCru.length === 0, comHtmlCru.join(', '));
  confere('a tela de crachás não tem link, src nem estilo montado com dado', !/\bhref=|\bsrc=|style=\{/.test(tela));

  const tocados = [
    'src/dados/crachas.ts',
    'src/dados/escritas.ts',
    'src/dados/ouvintes.ts',
    'src/telas/Configuracoes.tsx',
    'src/telas/Computador.tsx',
    'src/telas/Celular.tsx',
    'src/telas/textos.ts',
    'app/globals.css'
  ];
  const comTravessao = tocados.filter((a) => /[—–]/.test(lerSrc(a)));
  confere('nenhum travessão nos arquivos tocados', comTravessao.length === 0, comTravessao.join(', '));
}

log('');
log(falhas ? `${falhas} de ${total} verificações falharam.` : `Todas as ${total} verificações passaram.`);
fs.writeFileSync(path.join(aqui, 'saida-da-prova.txt'), linhas.join('\n') + '\n');
process.exit(falhas ? 1 : 0);
