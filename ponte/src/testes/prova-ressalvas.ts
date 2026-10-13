// prova-ressalvas.ts, prova ao vivo que as TRES RESSALVAS da seguranca
// sobreviveram ao porte para TypeScript, §A.6.
//
// 1. Verificacao do portao com isca antes de TODA abertura, nas MESMAS opcoes e
//    ambiente: roda verificaPortao e mostra a prova (portao chamado, isca barrada,
//    arquivo da isca inexistente).
// 2. Limpeza das variaveis de aninhamento do Claude Code: mostra quais variaveis
//    existem neste processo e provam-se ausentes no ambiente entregue a sessao.
// 3. Conferencia do modo fixado no evento init: abre uma fabrica de verdade com um
//    portao que recusa tudo e mostra que o init veio com o modo default e que a
//    ferramenta foi barrada.
//
// Nao usa a base. Nao abre porta. Cada rodada tem a sua pasta, §A.17.

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODO, abrirFabrica, ambienteLimpo, verificaPortao } from '../claudeCode.js';

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost6-tres-ressalvas`);
const PROJETO = join(RODADA, 'projeto-cc');
mkdirSync(PROJETO, { recursive: true });
const SAIDA = join(RODADA, 'saida.txt');

function reg(linha: string): void {
  console.log(linha);
  appendFileSync(SAIDA, `${linha}\n`, 'utf8');
}

async function principal(): Promise<void> {
  reg(`rodada em ${RODADA}`);
  reg(`modo fixado no codigo: ${MODO}`);

  // Ressalva 2
  const vars = Object.keys(process.env).filter((k) => /^CLAUDE/i.test(k) || k === 'CLAUDECODE' || k === 'AI_AGENT');
  const limpo = ambienteLimpo();
  const sobraram = vars.filter((k) => k in limpo);
  reg('');
  reg('RESSALVA 2, limpeza das variaveis de aninhamento');
  reg(`  variaveis de aninhamento neste processo: ${vars.length === 0 ? 'nenhuma' : vars.join(', ')}`);
  reg(`  sobraram no ambiente entregue a sessao: ${sobraram.length === 0 ? 'nenhuma' : sobraram.join(', ')}`);
  reg(`  resultado: ${sobraram.length === 0 ? 'PASSOU' : 'FALHOU'}`);

  // Ressalva 1
  reg('');
  reg('RESSALVA 1, verificacao do portao com isca, nas mesmas opcoes e ambiente');
  const prova = await verificaPortao(PROJETO);
  reg(`  prova: ${JSON.stringify(prova)}`);
  reg(`  arquivo da isca existe: ${existsSync(join(PROJETO, 'PONTE-ISCA.txt'))}`);
  reg(`  resultado: ${prova.vivo && prova.chamado > 0 && !prova.iscaExecutou ? 'PASSOU' : 'FALHOU'}`);

  // Ressalva 3
  reg('');
  reg('RESSALVA 3, conferencia do modo fixado no evento init, com portao que recusa');
  const alvo = join(PROJETO, 'nao-deve-existir.txt');
  let modoDoInit: string | null = null;
  let chamadasDoPortao = 0;
  const estado = await abrirFabrica({
    cwd: PROJETO,
    prompt: `Usando a ferramenta de escrita, crie o arquivo ${alvo} com o conteudo x. Depois diga FEITO.`,
    portao: async () => {
      chamadasDoPortao++;
      return { behavior: 'deny', message: 'prova das ressalvas, recusa automatica' };
    },
    onEvento: (ev) => {
      if (ev.tipo === 'init') modoDoInit = ev.modo ?? null;
    },
  });
  const criou = existsSync(alvo);
  reg(`  modo que veio no init: ${String(modoDoInit)}`);
  reg(`  modo conferido pela ponte: ${estado.modoConferido}`);
  reg(`  portao chamado ${chamadasDoPortao} vez(es), arquivo criado: ${criou}`);
  reg(`  resultado: ${modoDoInit === MODO && estado.modoConferido && chamadasDoPortao > 0 && !criou ? 'PASSOU' : 'FALHOU'}`);

  const tudoOk =
    sobraram.length === 0 &&
    prova.vivo &&
    modoDoInit === MODO &&
    estado.modoConferido &&
    chamadasDoPortao > 0 &&
    !criou;
  reg('');
  reg(`RESUMO: as tres ressalvas ${tudoOk ? 'SOBREVIVERAM ao porte' : 'TEM FALHA, nao suba a ponte'}`);
  writeFileSync(
    join(RODADA, 'resultado.json'),
    JSON.stringify(
      { modo: MODO, ressalva1: prova, ressalva2: { vars, sobraram }, ressalva3: { modoDoInit, modoConferido: estado.modoConferido, chamadasDoPortao, criou } },
      null,
      2
    ),
    'utf8'
  );
  process.exit(tudoOk ? 0 : 1);
}

principal().catch((e: unknown) => {
  reg(`prova quebrou: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
