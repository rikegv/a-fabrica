// prova-ganchos.ts, as regras duras do Bloco 1 da OST 7 postas a prova.
//
// A OST 7 diz, com estas palavras: as regras duras deste bloco "valem mais que a
// entrega". Entao elas tem prova propria, e a prova vem antes de qualquer demo.
//
// O que esta prova exercita, parte por parte:
//   PARTE 1 a mascara de segredo, um caso por forma de credencial. Nenhuma pode
//           sobreviver, e a prova confere o texto de saida, nao a boa vontade.
//   PARTE 2 a traducao de cada evento de gancho no passo que o painel mostra e no
//           estado em que a fabrica fica.
//   PARTE 3 o gancho NAO atrapalhando, caso por caso de coisa dando errado:
//           configuracao ausente, configuracao corrompida, desligado, projeto
//           ignorado, carga gigante, carga que nao e JSON, entrada vazia, pasta de
//           fila que nao da para criar, e fila no teto. Em todos: codigo 0, nada
//           escrito na tela, e a sessao do diretor seguiria normal.
//   PARTE 4 o teto da fila sendo respeitado de verdade.
//
// §A.6  nenhuma chamada de rede aqui. Nada escuta.
// §A.17 pasta propria da rodada, com data e hora. Nada apagado, nada sobrescrito.
// §A.9  pasta local propria da prova: a fila de verdade do diretor nao e tocada.

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mascarar, MARCA } from '../mascara.js';
import { traduzir, type LinhaDeGancho } from '../ganchos.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const GANCHO = join(AQUI, '..', '..', 'ganchos', 'gancho.cjs');

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost7-prova-ganchos`);
mkdirSync(RODADA, { recursive: true });
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

// ---------------------------------------------------------------------------
// PARTE 1, a mascara
// ---------------------------------------------------------------------------
//
// Nota honesta: todos os valores abaixo sao INVENTADOS, com a FORMA de credencial
// de verdade e nenhum valor de verdade. Nenhuma credencial real entra em arquivo
// deste repositorio, §A.6.

interface CasoDeMascara {
  rotulo: string;
  texto: string;
  /** Pedaco que NAO pode sobrar no texto de saida. */
  oQueNaoPodeSobrar: string;
}

const CASOS_MASCARA: CasoDeMascara[] = [
  {
    rotulo: 'chave de API do Google numa linha de comando',
    texto: 'curl "https://x.googleapis.com/v1/y?key=AIzaSyINVENTADA0123456789abcdefghijkLMN"',
    oQueNaoPodeSobrar: 'AIzaSyINVENTADA0123456789abcdefghijkLMN',
  },
  {
    rotulo: 'token de identificacao em tres partes',
    texto: 'authorization: eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJpbnZlbnRhZG8ifQ.assinaturaInventadaAqui123',
    oQueNaoPodeSobrar: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJpbnZlbnRhZG8ifQ.assinaturaInventadaAqui123',
  },
  {
    rotulo: 'token de atualizacao do Firebase',
    texto: 'node entrar.js AMf-vBxINVENTADO0123456789abcdefghijklmnop',
    oQueNaoPodeSobrar: 'AMf-vBxINVENTADO0123456789abcdefghijklmnop',
  },
  {
    rotulo: 'token de acesso do Google',
    texto: 'Authorization: Bearer ya29.a0INVENTADO0123456789abcdefghijklmnopqrs',
    oQueNaoPodeSobrar: 'ya29.a0INVENTADO0123456789abcdefghijklmnopqrs',
  },
  {
    rotulo: 'token de atualizacao com barra dupla',
    texto: 'refresh_token=1//0gINVENTADO0123456789abcdefghijklmnop',
    oQueNaoPodeSobrar: '1//0gINVENTADO0123456789abcdefghijklmnop',
  },
  {
    rotulo: 'segredo de cliente do Google',
    texto: 'client_secret: GOCSPX-INVENTADO123456789abcdef',
    oQueNaoPodeSobrar: 'GOCSPX-INVENTADO123456789abcdef',
  },
  {
    rotulo: 'chave da plataforma do GitHub',
    texto: 'git remote set-url origin https://ghp_INVENTADO0123456789abcdefghij@github.com/x/y',
    oQueNaoPodeSobrar: 'ghp_INVENTADO0123456789abcdefghij',
  },
  {
    rotulo: 'chave de modelo da Anthropic',
    texto: 'export ANTHROPIC_API_KEY=sk-ant-INVENTADA0123456789abcdefghij',
    oQueNaoPodeSobrar: 'sk-ant-INVENTADA0123456789abcdefghij',
  },
  {
    rotulo: 'chave de acesso da Amazon',
    texto: 'aws configure set aws_access_key_id AKIAINVENTADA12345678',
    oQueNaoPodeSobrar: 'AKIAINVENTADA12345678',
  },
  {
    rotulo: 'token do Slack',
    texto: 'SLACK=xoxb-INVENTADO-0123456789-abcdefghij',
    oQueNaoPodeSobrar: 'xoxb-INVENTADO-0123456789-abcdefghij',
  },
  {
    rotulo: 'senha em atribuicao',
    texto: 'psql --dbname x password=SenhaInventadaDoBanco123',
    oQueNaoPodeSobrar: 'SenhaInventadaDoBanco123',
  },
  {
    rotulo: 'senha por bandeira curta',
    texto: 'mysql -u root -p SenhaInventada123',
    oQueNaoPodeSobrar: 'SenhaInventada123',
  },
  {
    rotulo: 'bloco de chave privada',
    texto: '-----BEGIN RSA PRIVATE KEY-----\nMIIEoINVENTADOnaoEhChaveDeVerdade\n-----END RSA PRIVATE KEY-----',
    oQueNaoPodeSobrar: 'MIIEoINVENTADOnaoEhChaveDeVerdade',
  },
];

/** Texto normal, que a mascara NAO pode estragar. Falso positivo tambem e defeito. */
const CASOS_LIMPOS: { rotulo: string; texto: string }[] = [
  { rotulo: 'comando comum', texto: 'npm run tipos' },
  { rotulo: 'caminho de arquivo', texto: 'C:\\Users\\Henrique\\a-fabrica\\ponte\\src\\ponte.ts' },
  { rotulo: 'mensagem de commit', texto: 'git commit -m "OST 7 Bloco 1: ganchos de ciclo de vida"' },
  { rotulo: 'frase do diretor', texto: 'Quero ver as fabricas de verdade aparecendo no painel sozinhas.' },
  { rotulo: 'endereco do painel', texto: 'https://a-fabrica-soulan.web.app' },
  { rotulo: 'palavra token em frase, sem valor', texto: 'o token de atualizacao vence e o SDK renova sozinho' },
];

// ---------------------------------------------------------------------------
// PARTE 3, o gancho nao atrapalhando
// ---------------------------------------------------------------------------

interface SaidaDoGancho {
  codigo: number | null;
  texto: string;
  ms: number;
}

function rodarGancho(carga: string, pasta: string, evento = 'PostToolUse'): Promise<SaidaDoGancho> {
  return new Promise((resolve) => {
    const ambiente: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) ambiente[k] = v;
    ambiente['PONTE_PASTA_LOCAL'] = pasta;
    const t0 = process.hrtime.bigint();
    const filho = spawn(process.execPath, [GANCHO, evento], { stdio: ['pipe', 'pipe', 'pipe'], env: ambiente });
    let texto = '';
    filho.stdout.on('data', (d: Buffer) => (texto += d.toString('utf8')));
    filho.stderr.on('data', (d: Buffer) => (texto += d.toString('utf8')));
    filho.stdin.on('error', () => undefined);
    filho.stdin.write(carga);
    filho.stdin.end();
    filho.on('close', (codigo) => resolve({ codigo, texto, ms: Number(process.hrtime.bigint() - t0) / 1e6 }));
  });
}

function cargaNormal(sessao = 'prova'): string {
  return JSON.stringify({
    hook_event_name: 'PostToolUse',
    session_id: sessao,
    cwd: 'C:\\Users\\Henrique\\projeto-de-teste',
    tool_name: 'Bash',
    tool_input: { command: 'ls', description: 'listar' },
    tool_response: { stdout: 'ok', is_error: false },
  });
}

function linhasNaFila(pasta: string, sessao = 'prova'): number {
  const caminho = join(pasta, 'fila-ganchos', `${sessao}.jsonl`);
  if (!existsSync(caminho)) return 0;
  return readFileSync(caminho, 'utf8').split('\n').filter((l) => l.trim().length > 0).length;
}

async function principal(): Promise<void> {
  reg(`rodada em ${RODADA}`);
  reg('nenhuma credencial de verdade nesta prova: todos os valores tem a FORMA e nenhum e real');
  reg('');

  // ---- PARTE 1 ------------------------------------------------------------
  reg('PARTE 1, a mascara de segredo, uma forma de credencial por caso');
  for (const caso of CASOS_MASCARA) {
    const r = mascarar(caso.texto);
    const sobrou = r.texto.includes(caso.oQueNaoPodeSobrar);
    const marcou = r.texto.includes(MARCA);
    conferir(
      !sobrou && marcou && r.pegou.length > 0,
      caso.rotulo,
      sobrou
        ? `A CREDENCIAL SOBROU no texto publicado: ${r.texto.slice(0, 90)}`
        : `mascarada por "${r.pegou.join(', ')}", saida: ${r.texto.replace(/\n/g, ' ').slice(0, 90)}`
    );
  }
  reg('');
  reg('PARTE 1b, texto comum nao pode ser estragado pela mascara');
  for (const caso of CASOS_LIMPOS) {
    const r = mascarar(caso.texto);
    conferir(r.texto === caso.texto, caso.rotulo, r.texto === caso.texto ? 'passou intacto' : `foi mexido: ${r.texto}`);
  }

  // ---- PARTE 2 ------------------------------------------------------------
  reg('');
  reg('PARTE 2, traducao de evento de gancho em passo e estado');
  const esperado: { ev: string; tipo: string; estado: string | null; extra?: (p: ReturnType<typeof traduzir>) => boolean }[] = [
    { ev: 'SessionStart', tipo: 'init', estado: 'em execucao' },
    { ev: 'UserPromptSubmit', tipo: 'comando do diretor', estado: 'em execucao' },
    { ev: 'PostToolUse', tipo: 'ferramenta', estado: 'em execucao' },
    { ev: 'SubagentStart', tipo: 'subagente', estado: 'em execucao', extra: (p) => p.passo.inicioSubagente === true && p.passo.subagente === true },
    { ev: 'SubagentStop', tipo: 'subagente', estado: 'em execucao', extra: (p) => p.passo.inicioSubagente === false && p.passo.subagente === true },
    { ev: 'Stop', tipo: 'fim de rodada', estado: 'aguardando comando' },
    { ev: 'SessionEnd', tipo: 'fim', estado: 'concluida', extra: (p) => p.encerra === true },
    { ev: 'Notification', tipo: 'aviso', estado: null },
  ];
  for (const [i, e] of esperado.entries()) {
    const linha: LinhaDeGancho = {
      t: new Date().toISOString(),
      ev: e.ev,
      sid: 'sessao-de-prova',
      projeto: 'C:\\x',
      ferramenta: e.ev === 'PostToolUse' ? 'Bash' : null,
      alvo: e.ev === 'PostToolUse' ? 'ls' : null,
      subagente: e.ev.startsWith('Subagent') ? 'seguranca' : null,
      motivo: null,
      aviso: e.ev === 'Notification' ? 'o agente quer permissao' : null,
      pedidoDoDiretor: e.ev === 'UserPromptSubmit' ? 'faca o teste' : null,
    };
    const p = traduzir(linha, i);
    const ok = p.passo.tipo === e.tipo && p.estado === e.estado && (e.extra === undefined || e.extra(p));
    conferir(ok, e.ev, `tipo ${p.passo.tipo} (esperado ${e.tipo}), estado ${String(p.estado)} (esperado ${String(e.estado)})`);
  }

  // Falha de sessao tem de virar falhou, e fechar na mao NAO pode virar falhou.
  const falhou = traduzir({ ev: 'SessionEnd', sid: 's', motivo: 'error: crashed' }, 0);
  conferir(falhou.estado === 'falhou', 'SessionEnd com motivo de erro vira falhou', `estado ${String(falhou.estado)}`);
  const normal = traduzir({ ev: 'SessionEnd', sid: 's', motivo: 'clear' }, 0);
  conferir(normal.estado === 'concluida', 'SessionEnd sem erro NAO vira falhou', `estado ${String(normal.estado)}`);

  // A traducao tem de mascarar, nao so a publicacao.
  const comSegredo = traduzir(
    { ev: 'PostToolUse', sid: 's', ferramenta: 'Bash', alvo: 'curl -H "Authorization: Bearer ya29.a0INVENTADO0123456789abcdefghij"' },
    0
  );
  conferir(
    !String(comSegredo.passo.alvo).includes('ya29.a0INVENTADO0123456789abcdefghij') && comSegredo.passo.mascarou.length > 0,
    'a traducao mascara antes de o passo existir',
    `alvo publicado: ${String(comSegredo.passo.alvo)}`
  );

  // ---- PARTE 3 ------------------------------------------------------------
  reg('');
  reg('PARTE 3, o gancho NAO atrapalhando a sessao do diretor, caso por caso');

  const casos: { rotulo: string; preparar: () => string; carga: string; esperaLinha: boolean }[] = [
    {
      rotulo: 'configuracao AUSENTE',
      preparar: () => {
        const p = join(RODADA, 'sem-config');
        mkdirSync(p, { recursive: true });
        return p;
      },
      carga: cargaNormal(),
      esperaLinha: false,
    },
    {
      rotulo: 'configuracao CORROMPIDA, nao e JSON',
      preparar: () => {
        const p = join(RODADA, 'config-corrompida');
        mkdirSync(p, { recursive: true });
        writeFileSync(join(p, 'ganchos.json'), '{isto nao e json', 'utf8');
        return p;
      },
      carga: cargaNormal(),
      esperaLinha: false,
    },
    {
      rotulo: 'DESLIGADO pelo interruptor',
      preparar: () => {
        const p = join(RODADA, 'desligado');
        mkdirSync(p, { recursive: true });
        writeFileSync(join(p, 'ganchos.json'), JSON.stringify({ ligado: false }), 'utf8');
        return p;
      },
      carga: cargaNormal(),
      esperaLinha: false,
    },
    {
      rotulo: 'projeto na lista de IGNORAR',
      preparar: () => {
        const p = join(RODADA, 'ignorado');
        mkdirSync(p, { recursive: true });
        writeFileSync(
          join(p, 'ganchos.json'),
          JSON.stringify({ ligado: true, projetosIgnorados: ['C:\\Users\\Henrique\\projeto-de-teste'] }),
          'utf8'
        );
        return p;
      },
      carga: cargaNormal(),
      esperaLinha: false,
    },
    {
      rotulo: 'projeto FORA da lista de ignorar, com a lista cheia',
      preparar: () => {
        const p = join(RODADA, 'nao-ignorado');
        mkdirSync(p, { recursive: true });
        writeFileSync(
          join(p, 'ganchos.json'),
          JSON.stringify({ ligado: true, projetosIgnorados: ['C:\\outro\\projeto'] }),
          'utf8'
        );
        return p;
      },
      carga: cargaNormal(),
      esperaLinha: true,
    },
    {
      rotulo: 'carga GIGANTE, resposta de ferramenta de 5 MB',
      preparar: () => {
        const p = join(RODADA, 'carga-gigante');
        mkdirSync(p, { recursive: true });
        writeFileSync(join(p, 'ganchos.json'), JSON.stringify({ ligado: true, projetosIgnorados: [] }), 'utf8');
        return p;
      },
      carga: JSON.stringify({
        hook_event_name: 'PostToolUse',
        session_id: 'prova',
        cwd: 'C:\\x',
        tool_name: 'Read',
        tool_input: { file_path: 'C:\\x\\grande.txt' },
        tool_response: { content: 'y'.repeat(5 * 1024 * 1024) },
      }),
      esperaLinha: true,
    },
    {
      rotulo: 'entrada que NAO e JSON',
      preparar: () => {
        const p = join(RODADA, 'entrada-torta');
        mkdirSync(p, { recursive: true });
        writeFileSync(join(p, 'ganchos.json'), JSON.stringify({ ligado: true, projetosIgnorados: [] }), 'utf8');
        return p;
      },
      carga: 'isto nao e json nenhum',
      esperaLinha: false,
    },
    {
      rotulo: 'entrada VAZIA',
      preparar: () => {
        const p = join(RODADA, 'entrada-vazia');
        mkdirSync(p, { recursive: true });
        writeFileSync(join(p, 'ganchos.json'), JSON.stringify({ ligado: true, projetosIgnorados: [] }), 'utf8');
        return p;
      },
      carga: '',
      esperaLinha: false,
    },
    {
      rotulo: 'fila no TETO de tamanho',
      preparar: () => {
        const p = join(RODADA, 'fila-no-teto');
        mkdirSync(join(p, 'fila-ganchos'), { recursive: true });
        writeFileSync(join(p, 'ganchos.json'), JSON.stringify({ ligado: true, projetosIgnorados: [], tetoBytesPorSessao: 10 }), 'utf8');
        writeFileSync(join(p, 'fila-ganchos', 'prova.jsonl'), `${'z'.repeat(50)}\n`, 'utf8');
        return p;
      },
      carga: cargaNormal(),
      esperaLinha: false,
    },
  ];

  for (const caso of casos) {
    const pasta = caso.preparar();
    const antes = linhasNaFila(pasta);
    const r = await rodarGancho(caso.carga, pasta);
    const depois = linhasNaFila(pasta);
    const escreveu = depois > antes;
    const ok = r.codigo === 0 && r.texto.trim().length === 0 && escreveu === caso.esperaLinha;
    conferir(
      ok,
      caso.rotulo,
      `codigo ${String(r.codigo)} (tem de ser 0), escreveu na tela ${JSON.stringify(r.texto.trim().slice(0, 80))} (tem de ser vazio), ` +
        `linha na fila ${escreveu} (esperado ${caso.esperaLinha}), ${r.ms.toFixed(0)} ms`
    );
  }

  // ---- PARTE 4 ------------------------------------------------------------
  reg('');
  reg('PARTE 4, o teto de numero de arquivos na fila');
  {
    const pasta = join(RODADA, 'fila-cheia-de-arquivos');
    mkdirSync(join(pasta, 'fila-ganchos'), { recursive: true });
    writeFileSync(
      join(pasta, 'ganchos.json'),
      JSON.stringify({ ligado: true, projetosIgnorados: [], tetoArquivosNaFila: 3 }),
      'utf8'
    );
    for (const n of ['a', 'b', 'c']) writeFileSync(join(pasta, 'fila-ganchos', `${n}.jsonl`), '', 'utf8');
    const r = await rodarGancho(cargaNormal('sessao-nova'), pasta);
    const criou = existsSync(join(pasta, 'fila-ganchos', 'sessao-nova.jsonl'));
    conferir(
      r.codigo === 0 && !criou,
      'fila no teto de arquivos: sessao nova nao cria arquivo e o gancho sai calado',
      `codigo ${String(r.codigo)}, criou arquivo novo: ${criou} (tem de ser false)`
    );
  }

  reg('');
  reg(`RESUMO: ${erros === 0 ? 'todas as regras duras do Bloco 1 passaram' : `${erros} caso(s) fora do esperado`}`);
  process.exit(erros === 0 ? 0 : 1);
}

principal().catch((e: unknown) => {
  reg(`prova quebrou: ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`);
  process.exit(1);
});
