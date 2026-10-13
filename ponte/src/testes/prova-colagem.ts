// prova-colagem.ts, o caminho da colagem posto a prova, caminho de erro por caminho de erro.
//
// Por que existe: depois da decisao do diretor que proibiu o token do Firebase CLI,
// a colagem e a UNICA porta de entrada de credencial da ponte na nuvem. Entao ela
// tem de ser dura: recusar com motivo legivel, nunca gravar nada quando recusa, e
// nunca escrever a credencial em arquivo de relato.
//
// O que esta prova faz, de verdade:
//   1. exercita a leitura da colagem (forma) caso por caso;
//   2. exercita a conferencia das alegacoes da sessao com alegacoes FORJADAS, que e
//      como se prova a recusa de outra conta sem ter o token de outra conta;
//   3. roda o PROPRIO ponto de entrada da instalacao, node dist/entrar.js --colar,
//      em processo separado, com a credencial chegando pela entrada de texto, e
//      confere codigo de saida, mensagem e, o que mais importa, que NADA foi gravado;
//   4. bate de verdade no endpoint de token do Google com credencial invalida e cola
//      a resposta real.
//
// §A.6 so conexao de saida: as unicas chamadas de rede aqui sao POST de saida para
//      securetoken.googleapis.com e GET da configuracao publica da hospedagem.
// §A.17 pasta propria da rodada, com data e hora. Nada apagado, nada sobrescrito.
// §A.9  a prova NAO usa a pasta real da ponte: cria a sua propria, dentro da rodada,
//       entao a sessao de verdade do diretor nao corre risco nenhum.

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conferirAlegacoesDaSessao, lerColagem } from '../identidade.js';
import { DIRETOR } from '../config.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ENTRAR = join(AQUI, '..', 'entrar.js');
const RAIZ_PONTE = join(AQUI, '..', '..');

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost6-prova-colagem`);
const PASTA_DA_PROVA = join(RODADA, 'pasta-local-da-prova');
const SAIDA = join(RODADA, 'saida.txt');
mkdirSync(PASTA_DA_PROVA, { recursive: true });

function reg(linha: string): void {
  console.log(linha);
  appendFileSync(SAIDA, `${linha}\n`, 'utf8');
}

interface Caso {
  rotulo: string;
  colado: string;
  esperado: 'recusa pela forma' | 'recusa na troca';
  pista: RegExp;
}

/** Texto com cara de token de atualizacao do Firebase, mas invalido. */
const PARECE_TOKEN = 'AMf-vBx'.concat('K'.repeat(180));

const CASOS: Caso[] = [
  { rotulo: 'colagem vazia', colado: '', esperado: 'recusa pela forma', pista: /linha veio vazia/ },
  { rotulo: 'colagem so de espacos', colado: '      ', esperado: 'recusa pela forma', pista: /linha veio vazia/ },
  {
    rotulo: 'colagem truncada, cortada na copia',
    colado: 'AMf-vBxKpQ2sT1u',
    esperado: 'recusa pela forma',
    pista: /curta demais/,
  },
  {
    rotulo: 'colagem de token de identificacao (JWT) em vez do token de atualizacao',
    colado:
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhlbnJpcXVlLnZpZWlyYUBzb3VsYW4uY29tLmJyIn0.assinatura-falsa-nao-vale-nada',
    esperado: 'recusa pela forma',
    pista: /token de ATUALIZACAO/,
  },
  {
    rotulo: 'JSON sem o campo refreshToken',
    colado: '{"email":"henrique.vieira@soulan.com.br","idToken":"nada"}',
    esperado: 'recusa pela forma',
    pista: /nao tem o campo refreshToken/,
  },
  {
    rotulo: 'JSON pela metade',
    colado: '{"refreshToken":"AMf-vBxKpQ2sT1u',
    esperado: 'recusa pela forma',
    pista: /nao e um JSON valido/,
  },
  {
    rotulo: 'JSON declarando OUTRA conta',
    colado: `{"email":"outra.pessoa@gmail.com","refreshToken":"${PARECE_TOKEN}"}`,
    esperado: 'recusa pela forma',
    pista: /so o diretor entra/,
  },
  {
    rotulo: 'colagem com texto da pagina junto',
    colado: 'credencial de sessao: AMf-vBxKpQ2sT1u <copiar>',
    esperado: 'recusa pela forma',
    pista: /caractere que token de atualizacao nao tem/,
  },
  {
    rotulo: 'token com forma boa, mas invalido de verdade, contra o endpoint real',
    colado: PARECE_TOKEN,
    esperado: 'recusa na troca',
    pista: /endpoint de token do Google recusou/,
  },
  {
    rotulo: 'JSON com token de forma boa, mas invalido, contra o endpoint real',
    colado: `{"email":"${DIRETOR}","refreshToken":"${PARECE_TOKEN}"}`,
    esperado: 'recusa na troca',
    pista: /endpoint de token do Google recusou/,
  },
];

interface SaidaDoFilho {
  codigo: number | null;
  texto: string;
}

function rodarEntrar(colado: string, relato: string): Promise<SaidaDoFilho> {
  return new Promise((resolve) => {
    const ambiente: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) ambiente[k] = v;
    ambiente['PONTE_PASTA_LOCAL'] = PASTA_DA_PROVA;
    delete ambiente['PONTE_EMULADOR'];
    const filho = spawn(process.execPath, [ENTRAR, '--colar', '--relato', relato], {
      cwd: RAIZ_PONTE,
      env: ambiente,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let texto = '';
    filho.stdout.on('data', (d: Buffer) => (texto += d.toString('utf8')));
    filho.stderr.on('data', (d: Buffer) => (texto += d.toString('utf8')));
    filho.stdin.write(`${colado}\n`);
    filho.stdin.end();
    filho.on('close', (codigo) => resolve({ codigo, texto }));
  });
}

function entradasDaSessao(): number {
  const caminho = join(PASTA_DA_PROVA, 'sessao.json');
  if (!existsSync(caminho)) return 0;
  try {
    const j: unknown = JSON.parse(readFileSync(caminho, 'utf8'));
    const e = typeof j === 'object' && j !== null ? (j as Record<string, unknown>)['entradas'] : null;
    return typeof e === 'object' && e !== null ? Object.keys(e as Record<string, unknown>).length : 0;
  } catch {
    return -1;
  }
}

async function preparar(): Promise<void> {
  // Configuracao do cliente lida da propria hospedagem, que a serve em aberto.
  // Conexao de SAIDA, sem segredo, §A.6.
  const r = await fetch('https://a-fabrica-soulan.web.app/__/firebase/init.json');
  const j = (await r.json()) as Record<string, unknown>;
  const cfg = {
    maquinaId: `maquina-teste-colagem-${selo().replace(/[:T-]/g, '')}`,
    nomeMaquina: 'maquina de prova da colagem',
    projectId: j['projectId'],
    apiKey: j['apiKey'],
    authDomain: j['authDomain'],
    appId: j['appId'],
    criadoEm: new Date().toISOString(),
  };
  writeFileSync(join(PASTA_DA_PROVA, 'config.json'), JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 });
  reg(`configuracao do cliente lida da hospedagem publica, projeto ${String(cfg.projectId)}`);
}

async function principal(): Promise<void> {
  reg(`rodada em ${RODADA}`);
  reg('pasta local da prova, separada da pasta real da ponte: ' + PASTA_DA_PROVA);
  reg('');
  await preparar();

  // ---- Parte 1, leitura da forma, em processo ------------------------------
  reg('');
  reg('PARTE 1, leitura da forma da colagem');
  let erros = 0;
  for (const caso of CASOS) {
    const leitura = lerColagem(caso.colado);
    const recusouNaForma = !leitura.ok;
    const deveriaRecusarNaForma = caso.esperado === 'recusa pela forma';
    const ok = recusouNaForma === deveriaRecusarNaForma && (!recusouNaForma || caso.pista.test(leitura.motivo));
    if (!ok) erros++;
    reg(
      `  ${ok ? 'PASSOU' : 'FALHOU'} ${caso.rotulo}: ${recusouNaForma ? `recusada, "${leitura.motivo}"` : 'forma aceita, segue para a troca'}`
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
    const ok = c.ok === f.deveriaPassar;
    if (!ok) erros++;
    reg(`  ${ok ? 'PASSOU' : 'FALHOU'} ${f.rotulo}: ${c.ok ? 'aceita' : 'recusada'}, ${c.motivo}`);
  }

  // ---- Parte 3, o ponto de entrada da instalacao, de verdade ---------------
  reg('');
  reg('PARTE 3, node dist/entrar.js --colar de verdade, um processo por caso');
  for (const [i, caso] of CASOS.entries()) {
    const relato = join(RODADA, `relato-caso-${String(i + 1).padStart(2, '0')}.txt`);
    const r = await rodarEntrar(caso.colado, relato);
    const esperadoCodigo = caso.esperado === 'recusa pela forma' ? 4 : 3;
    const texto = r.texto;
    const bateu = r.codigo === esperadoCodigo && caso.pista.test(texto);
    const entradas = entradasDaSessao();
    // A credencial colada nao pode aparecer em arquivo de relato nenhum.
    const relatoTexto = existsSync(relato) ? readFileSync(relato, 'utf8') : '';
    const vazou =
      caso.colado.trim().length > 20 &&
      (relatoTexto.includes(caso.colado.trim()) || relatoTexto.includes(PARECE_TOKEN));
    const ok = bateu && entradas === 0 && !vazou;
    if (!ok) erros++;
    reg(
      `  ${ok ? 'PASSOU' : 'FALHOU'} ${caso.rotulo}: codigo de saida ${String(r.codigo)} (esperado ${esperadoCodigo}), ` +
        `entradas na sessao gravadas: ${entradas} (tem de ser 0), credencial vazou para o relato: ${vazou}`
    );
    const linhaDeMotivo = texto
      .split('\n')
      .map((l) => l.trim())
      .find((l) => caso.pista.test(l));
    if (linhaDeMotivo) reg(`      mensagem ao diretor: ${linhaDeMotivo}`);
    writeFileSync(join(RODADA, `saida-caso-${String(i + 1).padStart(2, '0')}.txt`), texto, 'utf8');
  }

  // ---- Parte 4, a resposta real do endpoint de token ----------------------
  reg('');
  reg('PARTE 4, resposta REAL do endpoint de token do Google para credencial invalida');
  const cfg: unknown = JSON.parse(readFileSync(join(PASTA_DA_PROVA, 'config.json'), 'utf8'));
  const apiKey = String((cfg as Record<string, unknown>)['apiKey']);
  for (const [rotulo, valor] of [
    ['token invalido', PARECE_TOKEN],
    ['token truncado', 'AMf-vBxKpQ2sT1u'],
  ] as const) {
    const resposta = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: valor }).toString(),
    });
    const corpo = await resposta.text();
    reg(`  ${rotulo}: HTTP ${resposta.status} ${corpo.replace(/\s+/g, ' ').slice(0, 200)}`);
  }

  reg('');
  reg(`RESUMO: ${erros === 0 ? 'todos os caminhos de erro falharam FECHADO' : `${erros} caso(s) fora do esperado`}`);
  reg(`sessao gravada na pasta da prova no fim: ${entradasDaSessao()} entrada(s) (tem de ser 0)`);
  process.exit(erros === 0 ? 0 : 1);
}

principal().catch((e: unknown) => {
  reg(`prova quebrou: ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`);
  process.exit(1);
});
