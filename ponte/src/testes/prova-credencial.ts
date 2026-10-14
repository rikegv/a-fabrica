// prova-credencial.ts, a entrada de credencial da ponte posta a prova, caminho de
// erro por caminho de erro.
//
// NASCEU como prova-colagem.ts, na OST 6, quando a colagem no terminal era a unica
// porta de entrada de credencial da ponte. Na OST 7 a colagem morreu e o lugar dela
// foi tomado pelo login no navegador, pelo laco de retorno em 127.0.0.1. A prova
// mudou de nome e ganhou duas partes novas, as que importam agora: as trancas da
// porta de laco de retorno, e a tranca do arquivo de sessao.
//
// O que esta prova faz, de verdade:
//   PARTE 1 exercita a leitura da forma da credencial, caso por caso, com a MESMA
//           funcao que roda de verdade no caminho do navegador;
//   PARTE 2 exercita a conferencia das alegacoes da sessao com alegacoes FORJADAS,
//           que e como se prova a recusa de outra conta sem ter o token de outra conta;
//   PARTE 3 sobe a porta de laco de retorno de verdade e ATACA ela: sem segredo, com
//           segredo errado, com cabecalho de hospedeiro de outro nome, sem tipo de
//           conteudo JSON, com corpo vazio, duas entregas, e depois confere que a
//           porta MORREU;
//   PARTE 4 confere que a porta so existe em 127.0.0.1, tentando pelo endereco de
//           rede da propria maquina;
//   PARTE 5 bate de verdade no endpoint de token do Google com credencial invalida
//           e cola a resposta real;
//   PARTE 6 prova a tranca do arquivo de sessao: aberto e detectado como aberto,
//           trancado e detectado como trancado, e o SERVICO recusando subir com a
//           sessao aberta;
//   PARTE 7 roda o proprio ponto de entrada da instalacao com --sem-navegador e
//           confere que ele recusa, com codigo de saida certo, sem gravar nada.
//
// §A.6 a unica porta que esta prova abre e a do proprio laco de retorno, que e o
//      objeto da prova, e ela fecha no fim de cada caso. As chamadas de rede para
//      fora sao POST de saida para securetoken.googleapis.com e GET da
//      configuracao publica da hospedagem.
// §A.17 pasta propria da rodada, com data e hora. Nada apagado, nada sobrescrito.
// §A.9  a prova NAO usa a pasta real da ponte: cria a sua propria, dentro da rodada,
//       entao a sessao de verdade do diretor nao corre risco nenhum.

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conferirAlegacoesDaSessao, lerCredencialEntregue } from '../identidade.js';
import { entrarPeloNavegador, EntradaPeloNavegadorFalhou } from '../entradaNavegador.js';
import { aplicarProtecao, conferirProtecao } from '../protecaoSessao.js';
import { DIRETOR } from '../config.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ENTRAR = join(AQUI, '..', 'entrar.js');
const SERVICO = join(AQUI, '..', 'ponte.js');
const RAIZ_PONTE = join(AQUI, '..', '..');

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost7-prova-credencial`);
const PASTA_DA_PROVA = join(RODADA, 'pasta-local-da-prova');
const SAIDA = join(RODADA, 'saida.txt');
mkdirSync(PASTA_DA_PROVA, { recursive: true });

function reg(linha: string): void {
  console.log(linha);
  appendFileSync(SAIDA, `${linha}\n`, 'utf8');
}

let erros = 0;
function conferir(ok: boolean, rotulo: string, detalhe: string): void {
  if (!ok) erros++;
  reg(`  ${ok ? 'PASSOU' : 'FALHOU'} ${rotulo}: ${detalhe}`);
}

interface Caso {
  rotulo: string;
  entregue: string;
  esperado: 'recusa pela forma' | 'recusa na troca';
  pista: RegExp;
}

/** Texto com cara de token de atualizacao do Firebase, mas invalido. */
const PARECE_TOKEN = 'AMf-vBx'.concat('K'.repeat(180));

const CASOS: Caso[] = [
  { rotulo: 'credencial vazia', entregue: '', esperado: 'recusa pela forma', pista: /linha veio vazia/ },
  { rotulo: 'credencial so de espacos', entregue: '      ', esperado: 'recusa pela forma', pista: /linha veio vazia/ },
  {
    rotulo: 'credencial truncada, cortada no caminho',
    entregue: 'AMf-vBxKpQ2sT1u',
    esperado: 'recusa pela forma',
    pista: /curta demais/,
  },
  {
    rotulo: 'token de identificacao (JWT) em vez do token de atualizacao',
    entregue:
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhlbnJpcXVlLnZpZWlyYUBzb3VsYW4uY29tLmJyIn0.assinatura-falsa-nao-vale-nada',
    esperado: 'recusa pela forma',
    pista: /token de ATUALIZACAO/,
  },
  {
    rotulo: 'JSON sem o campo refreshToken',
    entregue: '{"email":"henrique.vieira@soulan.com.br","idToken":"nada"}',
    esperado: 'recusa pela forma',
    pista: /nao tem o campo refreshToken/,
  },
  {
    rotulo: 'JSON pela metade',
    entregue: '{"refreshToken":"AMf-vBxKpQ2sT1u',
    esperado: 'recusa pela forma',
    pista: /nao e um JSON valido/,
  },
  {
    rotulo: 'JSON declarando OUTRA conta',
    entregue: `{"email":"outra.pessoa@gmail.com","refreshToken":"${PARECE_TOKEN}"}`,
    esperado: 'recusa pela forma',
    pista: /so o diretor entra/,
  },
  {
    rotulo: 'credencial com texto de pagina junto',
    entregue: 'credencial de sessao: AMf-vBxKpQ2sT1u <copiar>',
    esperado: 'recusa pela forma',
    pista: /caractere que token de atualizacao nao tem/,
  },
  {
    rotulo: 'token com forma boa, mas invalido de verdade, contra o endpoint real',
    entregue: PARECE_TOKEN,
    esperado: 'recusa na troca',
    pista: /endpoint de token do Google recusou/,
  },
  {
    rotulo: 'JSON com token de forma boa, mas invalido, contra o endpoint real',
    entregue: `{"email":"${DIRETOR}","refreshToken":"${PARECE_TOKEN}"}`,
    esperado: 'recusa na troca',
    pista: /endpoint de token do Google recusou/,
  },
];

interface SaidaDoFilho {
  codigo: number | null;
  texto: string;
}

function rodar(arquivo: string, args: string[], pastaLocal: string): Promise<SaidaDoFilho> {
  return new Promise((resolve) => {
    const ambiente: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) ambiente[k] = v;
    ambiente['PONTE_PASTA_LOCAL'] = pastaLocal;
    delete ambiente['PONTE_EMULADOR'];
    const filho = spawn(process.execPath, [arquivo, ...args], {
      cwd: RAIZ_PONTE,
      env: ambiente,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let texto = '';
    filho.stdout.on('data', (d: Buffer) => (texto += d.toString('utf8')));
    filho.stderr.on('data', (d: Buffer) => (texto += d.toString('utf8')));
    filho.stdin.end();
    const relogio = setTimeout(() => filho.kill('SIGKILL'), 120000);
    filho.on('close', (codigo) => {
      clearTimeout(relogio);
      resolve({ codigo, texto });
    });
  });
}

function entradasDaSessao(pasta: string): number {
  const caminho = join(pasta, 'sessao.json');
  if (!existsSync(caminho)) return 0;
  try {
    const j: unknown = JSON.parse(readFileSync(caminho, 'utf8'));
    const e = typeof j === 'object' && j !== null ? (j as Record<string, unknown>)['entradas'] : null;
    return typeof e === 'object' && e !== null ? Object.keys(e as Record<string, unknown>).length : 0;
  } catch {
    return -1;
  }
}

async function preparar(pasta: string): Promise<Record<string, unknown>> {
  // Configuracao do cliente lida da propria hospedagem, que a serve em aberto.
  // Conexao de SAIDA, sem segredo, §A.6.
  const r = await fetch('https://a-fabrica-soulan.web.app/__/firebase/init.json');
  const j = (await r.json()) as Record<string, unknown>;
  const cfg = {
    maquinaId: `maquina-teste-credencial-${selo().replace(/[:T-]/g, '')}`,
    nomeMaquina: 'maquina de prova da credencial',
    projectId: j['projectId'],
    apiKey: j['apiKey'],
    authDomain: j['authDomain'],
    appId: j['appId'],
    criadoEm: new Date().toISOString(),
  };
  writeFileSync(join(pasta, 'config.json'), JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 });
  reg(`configuracao do cliente lida da hospedagem publica, projeto ${String(cfg.projectId)}`);
  return cfg;
}

/** Endereco de rede da propria maquina, para provar que a porta NAO aparece nele. */
function enderecoDeRede(): string | null {
  for (const lista of Object.values(networkInterfaces())) {
    for (const i of lista ?? []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return null;
}

interface Tentativa {
  status: number | null;
  corpo: string;
  erro: string | null;
}

async function bater(url: string, opcoes: RequestInit = {}): Promise<Tentativa> {
  try {
    const r = await fetch(url, opcoes);
    return { status: r.status, corpo: (await r.text()).slice(0, 120), erro: null };
  } catch (e) {
    return { status: null, corpo: '', erro: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Bate na porta com um cabecalho de hospedeiro ESCOLHIDO, pelo cliente de baixo nivel.
 *
 * Por que nao da para usar fetch aqui, e isto foi achado na propria prova: o
 * cliente moderno do Node trata `host` como cabecalho proibido e IGNORA o valor
 * que a gente pede, em silencio. Com fetch, o ataque de nome de dominio nao chega
 * a ser disparado, e a prova passaria a mentir. Entao este caso usa o cliente HTTP
 * de baixo nivel, que manda o cabecalho que a gente escreveu.
 */
function baterComHospedeiro(porta: number, caminho: string, hospedeiro: string): Promise<Tentativa> {
  return new Promise((resolve) => {
    const pedido = httpRequest(
      { host: '127.0.0.1', port: porta, path: caminho, method: 'GET', headers: { Host: hospedeiro } },
      (resposta) => {
        let corpo = '';
        resposta.setEncoding('utf8');
        resposta.on('data', (p: string) => (corpo += p));
        resposta.on('end', () => resolve({ status: resposta.statusCode ?? null, corpo: corpo.slice(0, 120), erro: null }));
      }
    );
    pedido.on('error', (e) => resolve({ status: null, corpo: '', erro: e.message }));
    pedido.end();
  });
}

async function principal(): Promise<void> {
  reg(`rodada em ${RODADA}`);
  reg('pasta local da prova, separada da pasta real da ponte: ' + PASTA_DA_PROVA);
  reg('');
  const cfgBruta = await preparar(PASTA_DA_PROVA);
  const config = {
    maquinaId: String(cfgBruta['maquinaId']),
    nomeMaquina: String(cfgBruta['nomeMaquina']),
    projectId: String(cfgBruta['projectId']),
    apiKey: String(cfgBruta['apiKey']),
    authDomain: String(cfgBruta['authDomain']),
    appId: String(cfgBruta['appId']),
    criadoEm: String(cfgBruta['criadoEm']),
  };

  // ---- Parte 1, leitura da forma, em processo ------------------------------
  reg('');
  reg('PARTE 1, leitura da forma da credencial entregue');
  for (const caso of CASOS) {
    const leitura = lerCredencialEntregue(caso.entregue);
    const recusouNaForma = !leitura.ok;
    const deveriaRecusarNaForma = caso.esperado === 'recusa pela forma';
    const ok = recusouNaForma === deveriaRecusarNaForma && (!recusouNaForma || caso.pista.test(leitura.motivo));
    conferir(
      ok,
      caso.rotulo,
      recusouNaForma ? `recusada, "${leitura.motivo}"` : 'forma aceita, segue para a troca'
    );
  }

  // ---- Parte 2, alegacoes forjadas ----------------------------------------
  reg('');
  reg('PARTE 2, conferencia das alegacoes da sessao, com alegacoes FORJADAS');
  const projeto = 'a-fabrica-soulan';
  const forjadas: { rotulo: string; alegacoes: Record<string, unknown>; deveriaPassar: boolean }[] = [
    {
      rotulo: 'diretor, verificado, projeto certo',
      alegacoes: { email: DIRETOR, email_verified: true, aud: projeto, firebase: { sign_in_provider: 'google.com' } },
      deveriaPassar: true,
    },
    {
      rotulo: 'OUTRA conta, verificada, projeto certo',
      alegacoes: { email: 'outra.pessoa@gmail.com', email_verified: true, aud: projeto },
      deveriaPassar: false,
    },
    {
      // A regra do Firestore compara texto exato. Aceitar aqui o que a regra recusa
      // faria a ponte subir para nada, com toda escrita negada na base.
      rotulo: 'diretor em MAIUSCULAS (a regra compara texto exato, logo tem de recusar)',
      alegacoes: { email: DIRETOR.toUpperCase(), email_verified: true, aud: projeto },
      deveriaPassar: false,
    },
    {
      rotulo: 'diretor com e-mail NAO verificado',
      alegacoes: { email: DIRETOR, email_verified: false, aud: projeto },
      deveriaPassar: false,
    },
    { rotulo: 'diretor sem a alegacao de verificado', alegacoes: { email: DIRETOR, aud: projeto }, deveriaPassar: false },
    {
      rotulo: 'diretor, verificado, mas de OUTRO projeto',
      alegacoes: { email: DIRETOR, email_verified: true, aud: 'dash-iff' },
      deveriaPassar: false,
    },
    { rotulo: 'sessao sem e-mail nenhum', alegacoes: { aud: projeto, email_verified: true }, deveriaPassar: false },
    { rotulo: 'alegacoes vazias', alegacoes: {}, deveriaPassar: false },
  ];
  for (const f of forjadas) {
    const c = conferirAlegacoesDaSessao(f.alegacoes, projeto);
    conferir(c.ok === f.deveriaPassar, f.rotulo, `${c.ok ? 'aceita' : 'recusada'}, ${c.motivo}`);
  }

  // ---- Parte 3, as trancas da porta de laco de retorno --------------------
  reg('');
  reg('PARTE 3, a porta de laco de retorno ATACADA de verdade, com ela no ar');
  const ataques: { rotulo: string; fazer: (url: string, porta: number) => Promise<Tentativa>; esperado: number }[] = [
    {
      rotulo: 'raiz sem segredo nenhum',
      fazer: (_u, p) => bater(`http://127.0.0.1:${p}/`),
      esperado: 404,
    },
    {
      rotulo: 'segredo ERRADO, do tamanho certo',
      fazer: (_u, p) => bater(`http://127.0.0.1:${p}/${'a'.repeat(64)}`),
      esperado: 404,
    },
    {
      rotulo: 'segredo certo, mas com cabecalho de hospedeiro de OUTRO nome (nome que resolve para o laco)',
      fazer: (u, p) => baterComHospedeiro(p, new URL(u).pathname, `fabrica.exemplo.invalido:${p}`),
      esperado: 404,
    },
    {
      rotulo: 'segredo certo, mas entrega SEM tipo de conteudo JSON',
      fazer: (u) =>
        bater(`${u}/entregar`, {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: JSON.stringify({ email: DIRETOR, refreshToken: PARECE_TOKEN }),
        }),
      esperado: 415,
    },
    {
      rotulo: 'segredo certo, tipo certo, mas entrega SEM credencial',
      fazer: (u) =>
        bater(`${u}/entregar`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: DIRETOR }),
        }),
      esperado: 400,
    },
    {
      rotulo: 'caminho inventado por baixo do segredo certo',
      fazer: (u) => bater(`${u}/sessao.json`),
      esperado: 404,
    },
  ];

  for (const ataque of ataques) {
    let urlDaVez = '';
    let portaDaVez = 0;
    // A porta sobe, o ataque acontece, e a porta cai por tempo esgotado curto.
    // Cada caso tem a sua propria porta, com o seu proprio segredo.
    const promessa = entrarPeloNavegador({
      config,
      limiteMs: 12000,
      naoAbrirNavegador: true,
      registrar: () => undefined,
      aoSubir: (url, porta) => {
        urlDaVez = url;
        portaDaVez = porta;
      },
    });
    // Espera a porta subir antes de atacar.
    for (let i = 0; i < 100 && urlDaVez === ''; i++) await new Promise((r) => setTimeout(r, 50));
    const r = await ataque.fazer(urlDaVez, portaDaVez);
    conferir(
      r.status === ataque.esperado,
      ataque.rotulo,
      `resposta ${r.status === null ? `sem resposta (${r.erro ?? ''})` : r.status} (esperado ${ataque.esperado}), corpo ${JSON.stringify(r.corpo)}`
    );
    // A porta tem de cair por tempo esgotado, falha fechada, sem entregar nada.
    let fechouFechado = false;
    try {
      await promessa;
    } catch (e) {
      fechouFechado = e instanceof EntradaPeloNavegadorFalhou && /tempo esgotado/.test(e.message);
    }
    conferir(fechouFechado, `${ataque.rotulo}, fim da porta`, 'a porta caiu por tempo esgotado, sem entregar credencial');
    // E depois de cair, ninguem fala com ela.
    const depois = await bater(urlDaVez);
    conferir(
      depois.status === null,
      `${ataque.rotulo}, porta morta`,
      `depois de fechar, a porta ${depois.status === null ? `nao responde (${(depois.erro ?? '').slice(0, 60)})` : `AINDA responde ${depois.status}, o que seria furo`}`
    );
  }

  // Entrega boa, para provar que o caminho certo funciona e que a SEGUNDA entrega
  // nao acha porta nenhuma.
  reg('');
  reg('PARTE 3b, entrega boa pelo laco de retorno, e a segunda entrega sem porta');
  {
    let url = '';
    const promessa = entrarPeloNavegador({
      config,
      limiteMs: 20000,
      naoAbrirNavegador: true,
      registrar: (l) => reg(`    [porta] ${l}`),
      aoSubir: (u) => (url = u),
    });
    for (let i = 0; i < 100 && url === ''; i++) await new Promise((r) => setTimeout(r, 50));
    const entrega = await bater(`${url}/entregar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: DIRETOR, refreshToken: PARECE_TOKEN }),
    });
    const recebida = await promessa.catch((e: unknown) => {
      reg(`    a entrega boa falhou: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    });
    conferir(
      entrega.status === 200 && recebida !== null && recebida.refreshToken === PARECE_TOKEN,
      'entrega boa pelo laco de retorno',
      `resposta ${String(entrega.status)}, credencial chegou: ${recebida !== null}, porta ficou aberta ${recebida?.portaAbertaMs ?? '?'} ms`
    );
    const segunda = await bater(`${url}/entregar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: DIRETOR, refreshToken: PARECE_TOKEN }),
    });
    conferir(
      segunda.status === null,
      'segunda entrega, depois da primeira',
      `${segunda.status === null ? `a porta ja morreu (${(segunda.erro ?? '').slice(0, 60)})` : `AINDA responde ${segunda.status}, o que seria furo`}`
    );
  }

  // ---- Parte 4, a porta so existe no laco de retorno ----------------------
  reg('');
  reg('PARTE 4, a porta NAO aparece no endereco de rede da maquina');
  {
    const rede = enderecoDeRede();
    if (rede === null) {
      reg('  esta maquina nao tem endereco de rede agora, nao da para provar este caso');
    } else {
      let url = '';
      let porta = 0;
      const promessa = entrarPeloNavegador({
        config,
        limiteMs: 10000,
        naoAbrirNavegador: true,
        registrar: () => undefined,
        aoSubir: (u, p) => {
          url = u;
          porta = p;
        },
      });
      for (let i = 0; i < 100 && url === ''; i++) await new Promise((r) => setTimeout(r, 50));
      const pelaRede = await bater(`http://${rede}:${porta}/`);
      const peloLaco = await bater(`http://127.0.0.1:${porta}/`);
      conferir(
        pelaRede.status === null && peloLaco.status === 404,
        `porta ${porta} presa no laco de retorno`,
        `pelo endereco de rede ${rede}: ${pelaRede.status === null ? `nao responde (${(pelaRede.erro ?? '').slice(0, 50)})` : `responde ${pelaRede.status}, FURO`}; ` +
          `pelo laco 127.0.0.1: responde ${String(peloLaco.status)}`
      );
      await promessa.catch(() => undefined);
    }
  }

  // ---- Parte 5, a resposta real do endpoint de token ----------------------
  reg('');
  reg('PARTE 5, resposta REAL do endpoint de token do Google para credencial invalida');
  for (const [rotulo, valor] of [
    ['token invalido', PARECE_TOKEN],
    ['token truncado', 'AMf-vBxKpQ2sT1u'],
  ] as const) {
    const resposta = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: valor }).toString(),
    });
    const corpo = await resposta.text();
    const recusou = resposta.status >= 400;
    conferir(recusou, rotulo, `HTTP ${resposta.status} ${corpo.replace(/\s+/g, ' ').slice(0, 160)}`);
  }

  // ---- Parte 6, a tranca do arquivo de sessao -----------------------------
  reg('');
  reg('PARTE 6, a tranca do arquivo de sessao, e o SERVICO recusando subir sem ela');
  {
    const pastaAberta = join(RODADA, 'pasta-sessao-aberta');
    mkdirSync(pastaAberta, { recursive: true });
    writeFileSync(join(pastaAberta, 'config.json'), readFileSync(join(PASTA_DA_PROVA, 'config.json')));
    const sessaoFalsa = join(pastaAberta, 'sessao.json');
    // Sessao de mentira, so para a tranca ter o que trancar. Nao vale como
    // credencial e nunca chega a ser usada: o servico recusa antes.
    writeFileSync(
      sessaoFalsa,
      JSON.stringify({ versao: 1, atualizadoEm: new Date().toISOString(), entradas: {} }, null, 2),
      'utf8'
    );

    const abertoAntes = conferirProtecao(sessaoFalsa, { exigirHerancaQuebrada: false });
    conferir(
      !abertoAntes.protegido,
      'arquivo de sessao herdando a pasta aberta e visto como ABERTO',
      abertoAntes.motivo
    );
    writeFileSync(join(RODADA, 'icacls-sessao-aberta.txt'), abertoAntes.saidaIcacls, 'utf8');

    // O servico, com a sessao aberta, tem de RECUSAR SUBIR com codigo 6.
    const recusa = await rodar(SERVICO, [], pastaAberta);
    writeFileSync(join(RODADA, 'saida-servico-sessao-aberta.txt'), recusa.texto, 'utf8');
    conferir(
      recusa.codigo === 6 && /n[aã]o sobe com a sess[aã]o desprotegida/.test(recusa.texto),
      'o SERVICO recusa subir com a sessao aberta',
      `codigo de saida ${String(recusa.codigo)} (esperado 6), mensagem presente: ${/n[aã]o sobe com a sess[aã]o desprotegida/.test(recusa.texto)}`
    );
    const linha = recusa.texto
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /ABERTO:/.test(l));
    if (linha) reg(`      mensagem ao diretor: ${linha}`);

    // Agora tranca de verdade e confere que a tranca aparece.
    const icacls = aplicarProtecao(pastaAberta);
    const icaclsArquivo = aplicarProtecao(sessaoFalsa);
    writeFileSync(join(RODADA, 'icacls-aplicado.txt'), `${icacls}\n\n${icaclsArquivo}`, 'utf8');
    const depois = conferirProtecao(sessaoFalsa, { exigirHerancaQuebrada: false });
    conferir(depois.protegido, 'depois do icacls, o arquivo de sessao e visto como TRANCADO', depois.motivo);
    writeFileSync(join(RODADA, 'icacls-sessao-trancada.txt'), depois.saidaIcacls, 'utf8');

    // E falha fechada de verdade: caminho que nao existe nao pode ser "protegido".
    const inexistente = conferirProtecao(join(pastaAberta, 'nao-existe.json'), { exigirHerancaQuebrada: false });
    conferir(!inexistente.protegido, 'caminho inexistente nao e tratado como protegido', inexistente.motivo);
  }

  // ---- Parte 7, o ponto de entrada da instalacao, de verdade --------------
  reg('');
  reg('PARTE 7, node dist/entrar.js --sem-navegador, sem sessao, tem de recusar sem gravar nada');
  {
    const pastaSemSessao = join(RODADA, 'pasta-sem-sessao');
    mkdirSync(pastaSemSessao, { recursive: true });
    writeFileSync(join(pastaSemSessao, 'config.json'), readFileSync(join(PASTA_DA_PROVA, 'config.json')));
    const relato = join(RODADA, 'relato-entrar-sem-navegador.txt');
    const r = await rodar(ENTRAR, ['--sem-navegador', '--relato', relato], pastaSemSessao);
    writeFileSync(join(RODADA, 'saida-entrar-sem-navegador.txt'), r.texto, 'utf8');
    const entradas = entradasDaSessao(pastaSemSessao);
    conferir(
      r.codigo === 3 && entradas === 0,
      'sem sessao e sem navegador, a instalacao recusa e nao grava nada',
      `codigo de saida ${String(r.codigo)} (esperado 3), entradas gravadas na sessao: ${entradas} (tem de ser 0)`
    );
    const relatoTexto = existsSync(relato) ? readFileSync(relato, 'utf8') : '';
    conferir(
      !relatoTexto.includes(PARECE_TOKEN),
      'nenhuma credencial vazou para o arquivo de relato',
      `relato com ${relatoTexto.length} caractere(s), sem credencial dentro`
    );
  }

  reg('');
  reg(`RESUMO: ${erros === 0 ? 'todos os caminhos de erro falharam FECHADO' : `${erros} caso(s) fora do esperado`}`);
  reg(`sessao gravada na pasta da prova no fim: ${entradasDaSessao(PASTA_DA_PROVA)} entrada(s) (tem de ser 0)`);
  process.exit(erros === 0 ? 0 : 1);
}

principal().catch((e: unknown) => {
  reg(`prova quebrou: ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`);
  process.exit(1);
});
