// prova-sessao-colada.ts, a metade boa do caminho da colagem.
//
// O que ficava sem prova: a colagem grava a sessao no arquivo COM A MAO, pela funcao
// `escrever` da persistencia, e nao pelo SDK. Se o formato gravado nao for aceito
// pelo SDK, a colagem do diretor falharia na primeira tentativa, e isso e o pior
// momento possivel para descobrir.
//
// Esta prova fecha essa duvida sem precisar de credencial da nuvem:
//   1. sobe uma identidade de verdade no emulador, em pasta local propria A, onde
//      quem grava a sessao e o PROPRIO SDK;
//   2. copia essa entrada para uma pasta local propria B usando exatamente a funcao
//      `escrever` que o degrau de colagem usa;
//   3. abre a identidade na pasta B e exige que o SDK carregue aquela sessao, e que
//      ela passe pela conferencia de identidade, que forca a renovacao do token
//      contra o servidor.
//
// Se o passo 3 entra pelo degrau `sessao-salva`, esta provado que a sessao escrita
// a mao e consumivel pelo SDK e sobrevive a conferencia de quem e o usuario.
//
// Precisa do emulador no ar. Rode antes:
//   firebase emulators:start --only firestore,auth --project a-fabrica-soulan --config <config da rodada>
//
// §A.17 pasta propria e datada. §A.9 nao usa a pasta real da ponte.

import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarPersistenciaEmArquivo } from '../persistenciaArquivo.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ENTRAR = join(AQUI, '..', 'entrar.js');
const RAIZ_PONTE = join(AQUI, '..', '..');
const NOME_APP = 'ponte-da-fabrica';

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost6-prova-sessao-colada`);
const PASTA_A = join(RODADA, 'pasta-a-sessao-do-sdk');
const PASTA_B = join(RODADA, 'pasta-b-sessao-escrita-a-mao');
mkdirSync(PASTA_A, { recursive: true });
mkdirSync(PASTA_B, { recursive: true });

function reg(linha: string): void {
  console.log(linha);
  writeFileSync(join(RODADA, 'saida.txt'), `${linha}\n`, { encoding: 'utf8', flag: 'a' });
}

function rodarEntrar(pasta: string): Promise<{ codigo: number | null; texto: string }> {
  return new Promise((resolve) => {
    const ambiente: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) ambiente[k] = v;
    ambiente['PONTE_PASTA_LOCAL'] = pasta;
    ambiente['PONTE_EMULADOR'] = '1';
    const filho = spawn(process.execPath, [ENTRAR, '--emulador'], {
      cwd: RAIZ_PONTE,
      env: ambiente,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let texto = '';
    filho.stdout.on('data', (d: Buffer) => (texto += d.toString('utf8')));
    filho.stderr.on('data', (d: Buffer) => (texto += d.toString('utf8')));
    filho.stdin.end();
    filho.on('close', (codigo) => resolve({ codigo, texto }));
  });
}

async function principal(): Promise<void> {
  reg(`rodada em ${RODADA}`);
  // Configuracao do cliente: a publica da hospedagem, para ser fiel a de verdade.
  const r = await fetch('https://a-fabrica-soulan.web.app/__/firebase/init.json');
  const j = (await r.json()) as Record<string, unknown>;
  const cfg = {
    maquinaId: `maquina-teste-sessao-${selo().replace(/[:T-]/g, '')}`,
    nomeMaquina: 'maquina de prova da sessao colada',
    projectId: j['projectId'],
    apiKey: j['apiKey'],
    authDomain: j['authDomain'],
    appId: j['appId'],
    criadoEm: new Date().toISOString(),
  };
  for (const pasta of [PASTA_A, PASTA_B]) {
    writeFileSync(join(pasta, 'config.json'), JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 });
  }

  reg('');
  reg('PASSO 1, identidade de verdade no emulador, sessao gravada pelo PROPRIO SDK, pasta A');
  const a = await rodarEntrar(PASTA_A);
  const linhaA = a.texto.split('\n').map((l) => l.trim()).find((l) => /pelo degrau/.test(l)) ?? '(sem linha)';
  reg(`  codigo de saida ${String(a.codigo)}, ${linhaA}`);
  if (a.codigo !== 0) {
    reg('FALHOU: o emulador nao entregou identidade. O emulador esta no ar nas portas da rodada?');
    process.exit(1);
  }

  reg('');
  reg('PASSO 2, copiar a entrada para a pasta B usando a MESMA funcao que o degrau de colagem usa');
  const arquivoA = join(PASTA_A, 'sessao-emulador.json');
  const arquivoB = join(PASTA_B, 'sessao-emulador.json');
  const chave = `firebase:authUser:${String(cfg.apiKey)}:${NOME_APP}`;
  const bruto: unknown = JSON.parse(readFileSync(arquivoA, 'utf8'));
  const entradas =
    typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>)['entradas'] : null;
  const entrada =
    typeof entradas === 'object' && entradas !== null ? (entradas as Record<string, unknown>)[chave] : undefined;
  if (entrada === undefined) {
    reg(`FALHOU: nao achei a entrada ${chave} no arquivo da pasta A`);
    process.exit(1);
  }
  copyFileSync(arquivoA, join(RODADA, 'entrada-original-do-sdk.json'));
  const persistencia = criarPersistenciaEmArquivo(arquivoB);
  persistencia.escrever(chave, entrada as Record<string, unknown>);
  reg(`  entrada escrita a mao em ${arquivoB}, chaves guardadas: ${persistencia.chaves().join(', ')}`);

  reg('');
  reg('PASSO 3, abrir a identidade na pasta B e exigir que o SDK carregue a sessao escrita a mao');
  const b = await rodarEntrar(PASTA_B);
  const linhaB = b.texto.split('\n').map((l) => l.trim()).find((l) => /pelo degrau/.test(l)) ?? '(sem linha)';
  const renovou = /token renovado pelo SDK/.test(b.texto);
  reg(`  codigo de saida ${String(b.codigo)}, ${linhaB}`);
  reg(`  o SDK renovou o token da sessao escrita a mao: ${renovou}`);
  writeFileSync(join(RODADA, 'saida-passo-3.txt'), b.texto, 'utf8');

  const passou = b.codigo === 0 && /degrau sessao-salva/.test(b.texto) && existsSync(arquivoB);
  reg('');
  reg(
    passou
      ? 'PASSOU: sessao escrita a mao pela funcao da colagem e carregada pelo SDK e sobrevive a conferencia de identidade'
      : 'FALHOU: veja as linhas acima'
  );
  process.exit(passou ? 0 : 1);
}

principal().catch((e: unknown) => {
  reg(`prova quebrou: ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`);
  process.exit(1);
});
