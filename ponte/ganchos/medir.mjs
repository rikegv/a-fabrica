// medir.mjs, quanto tempo o gancho acrescenta a cada passo do diretor.
//
// A OST 7 manda medir e dizer: "Se passar de um piscar de olhos, esta errado."
// Piscar de olhos, na literatura, e 100 a 400 ms. Entao o alvo aqui e ficar
// claramente abaixo de 100 ms por passo, no pior caso, nao na media.
//
// O QUE ESTA MEDIDA INCLUI, e isto importa para ela nao mentir: o tempo de SUBIR
// UM PROCESSO do Node, que e a maior parte do custo e e inevitavel, porque gancho
// de Claude Code e um programa que ele chama. Medir so o que roda por dentro
// daria um numero bonito e falso.
//
// §A.17 cada rodada escreve na sua propria pasta, com data e hora no nome.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const GANCHO = join(AQUI, 'gancho.cjs');
const RODADAS = Number(process.env.MEDIR_RODADAS ?? '40');

/**
 * Caminho curto do node, no formato antigo de 8 caracteres, quando existir.
 *
 * Serve para a linha de comando do gancho nao ter espaco nenhum: o node mora em
 * "C:\Program Files\nodejs", que tem espaco e por isso exigiria aspas, e aspas em
 * linha de comando de cmd e a origem de toda a confusao deste arquivo.
 */
const CAMINHO_CURTO_DO_NODE = (() => {
  const exe = process.execPath;
  if (!/\s/.test(exe)) return exe;
  const curto = exe.replace('C:\\Program Files\\', 'C:\\PROGRA~1\\');
  try {
    const { existsSync } = require('node:fs');
    return existsSync(curto) ? curto : null;
  } catch {
    return null;
  }
})();

function selo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost7-medida-do-gancho`);
const PASTA = join(RODADA, 'pasta-local-da-medida');
mkdirSync(PASTA, { recursive: true });

// Configuracao propria da medida, para nao escrever na fila de verdade, §A.9.
writeFileSync(
  join(PASTA, 'ganchos.json'),
  JSON.stringify({ ligado: true, projetosIgnorados: [], tetoBytesPorSessao: 4194304, tetoArquivosNaFila: 2000 }, null, 2),
  'utf8'
);

/**
 * Carga realista de PostToolUse, com resposta de ferramenta GRANDE, que e o pior
 * caso de verdade: o Claude Code devolve o conteudo lido do arquivo aqui dentro.
 */
function cargaPostToolUse(i) {
  return JSON.stringify({
    hook_event_name: 'PostToolUse',
    session_id: `medida-${i % 3}`,
    cwd: 'C:\\Users\\Henrique\\a-fabrica',
    permission_mode: 'default',
    tool_name: 'Bash',
    tool_input: {
      command: 'npm run tipos',
      description: 'Conferir os tipos do projeto',
    },
    tool_response: {
      stdout: 'x'.repeat(200000),
      stderr: '',
      is_error: false,
    },
  });
}

function cargaSessionStart(i) {
  return JSON.stringify({
    hook_event_name: 'SessionStart',
    session_id: `medida-${i % 3}`,
    cwd: 'C:\\Users\\Henrique\\a-fabrica',
    source: 'startup',
  });
}

function rodarUma(carga, evento) {
  return new Promise((resolve) => {
    const ambiente = { ...process.env, PONTE_PASTA_LOCAL: PASTA };
    const t0 = process.hrtime.bigint();
    const filho = spawn(process.execPath, [GANCHO, evento], { env: ambiente, stdio: ['pipe', 'pipe', 'pipe'] });
    let saida = '';
    filho.stdout.on('data', (d) => (saida += d.toString('utf8')));
    filho.stderr.on('data', (d) => (saida += d.toString('utf8')));
    // Achado da medicao: quando o gancho sai antes de ler a entrada, quem escreve
    // nela leva erro de escrita encerrada. O gancho foi corrigido para ler
    // primeiro, e este tratador fica aqui de proposito, porque quem mede nao pode
    // quebrar por causa do que esta medindo.
    filho.stdin.on('error', () => undefined);
    filho.stdin.write(carga);
    filho.stdin.end();
    filho.on('close', (codigo) => {
      resolve({ ms: Number(process.hrtime.bigint() - t0) / 1e6, codigo, saida });
    });
  });
}

/**
 * Mede COMO O CLAUDE CODE CHAMA DE VERDADE.
 *
 * A entrada de settings.json e uma LINHA DE COMANDO, e o Claude Code a executa por
 * meio do interpretador do sistema. Medir so com spawn direto do Node daria um
 * numero menor do que o diretor paga, porque esconderia a subida do cmd.
 *
 * Por que por a linha num arquivo de lote em vez de passar para o cmd como
 * argumento: achado de duas tentativas erradas nesta propria medida. Passar a
 * linha como argumento de spawn faz as aspas serem reescritas no caminho, e o
 * comando chega quebrado. Deu tempo menor que o piso do Node e codigo de saida
 * diferente de 0 nas 30 chamadas, o que denunciou a medida falsa. Com a linha
 * dentro de um arquivo de lote, o que roda e exatamente o texto que vai para o
 * settings.json, sem ninguem reescrever nada no meio.
 */
function rodarPeloInterpretador(carga, comando, nomeDoLote) {
  return new Promise((resolve) => {
    const lote = join(RODADA, `${nomeDoLote}.bat`);
    writeFileSync(lote, `@echo off
${comando}
`, 'utf8');
    const ambiente = { ...process.env, PONTE_PASTA_LOCAL: PASTA };
    const t0 = process.hrtime.bigint();
    const filho = spawn('cmd', ['/c', lote], { env: ambiente, stdio: ['pipe', 'pipe', 'pipe'] });
    let saida = '';
    filho.stdout.on('data', (d) => (saida += d.toString('utf8')));
    filho.stderr.on('data', (d) => (saida += d.toString('utf8')));
    filho.stdin.on('error', () => undefined);
    filho.stdin.write(carga);
    filho.stdin.end();
    filho.on('close', (codigo) => {
      resolve({ ms: Number(process.hrtime.bigint() - t0) / 1e6, codigo, saida });
    });
  });
}

function estatistica(lista) {
  const ordenada = [...lista].sort((a, b) => a - b);
  const pos = (p) => ordenada[Math.min(ordenada.length - 1, Math.floor((p / 100) * ordenada.length))];
  return {
    amostras: lista.length,
    menor: +ordenada[0].toFixed(1),
    mediana: +pos(50).toFixed(1),
    p95: +pos(95).toFixed(1),
    maior: +ordenada[ordenada.length - 1].toFixed(1),
    media: +(lista.reduce((a, b) => a + b, 0) / lista.length).toFixed(1),
  };
}

async function principal() {
  const linhas = [];
  const reg = (t) => {
    console.log(t);
    linhas.push(t);
  };

  reg(`rodada em ${RODADA}`);
  reg(`${RODADAS} medidas por evento, com o custo de subir o processo do Node incluido`);
  reg('');

  const resultado = {};
  for (const [nome, carga, evento] of [
    ['PostToolUse, com resposta de 200 KB (pior caso)', cargaPostToolUse, 'PostToolUse'],
    ['SessionStart (carga pequena)', cargaSessionStart, 'SessionStart'],
  ]) {
    const tempos = [];
    let codigosErrados = 0;
    let falou = 0;
    // Uma rodada fora da conta, para nao medir o primeiro acesso ao disco.
    await rodarUma(carga(0), evento);
    for (let i = 0; i < RODADAS; i++) {
      const r = await rodarUma(carga(i), evento);
      tempos.push(r.ms);
      if (r.codigo !== 0) codigosErrados++;
      if (r.saida.trim().length > 0) falou++;
    }
    const e = estatistica(tempos);
    resultado[evento] = e;
    reg(`${nome}`);
    reg(`  menor ${e.menor} ms, mediana ${e.mediana} ms, p95 ${e.p95} ms, maior ${e.maior} ms, media ${e.media} ms`);
    reg(`  codigo de saida diferente de 0: ${codigosErrados} (tem de ser 0)`);
    reg(`  vezes que o gancho escreveu algo na tela: ${falou} (tem de ser 0)`);
    reg('');
  }

  // Caminhos em que ele tem de sair AINDA mais rapido e sem escrever nada.
  reg('Caminhos de desligado e de projeto ignorado');
  writeFileSync(join(PASTA, 'ganchos.json'), JSON.stringify({ ligado: false }, null, 2), 'utf8');
  const desligado = [];
  for (let i = 0; i < RODADAS; i++) desligado.push((await rodarUma(cargaPostToolUse(i), 'PostToolUse')).ms);
  const ed = estatistica(desligado);
  resultado['desligado'] = ed;
  reg(`  desligado: mediana ${ed.mediana} ms, p95 ${ed.p95} ms, maior ${ed.maior} ms`);

  writeFileSync(
    join(PASTA, 'ganchos.json'),
    JSON.stringify({ ligado: true, projetosIgnorados: ['C:\\Users\\Henrique\\a-fabrica'] }, null, 2),
    'utf8'
  );
  const ignorado = [];
  for (let i = 0; i < RODADAS; i++) ignorado.push((await rodarUma(cargaPostToolUse(i), 'PostToolUse')).ms);
  const ei = estatistica(ignorado);
  resultado['ignorado'] = ei;
  reg(`  projeto ignorado: mediana ${ei.mediana} ms, p95 ${ei.p95} ms, maior ${ei.maior} ms`);

  // Prova de que o projeto ignorado NAO deixou linha nova na fila.
  const fila = join(PASTA, 'fila-ganchos');
  let linhasNaFila = 0;
  let custoPorDentro = [];
  try {
    const { readdirSync } = await import('node:fs');
    for (const arquivo of readdirSync(fila)) {
      const texto = readFileSync(join(fila, arquivo), 'utf8');
      for (const l of texto.split('\n')) {
        if (l.trim().length === 0) continue;
        linhasNaFila++;
        const j = JSON.parse(l);
        if (typeof j.custoMs === 'number') custoPorDentro.push(j.custoMs);
      }
    }
  } catch {
    // sem fila, nada a contar
  }
  const esperado = RODADAS * 2 + 2;
  reg('');
  reg(`Linhas na fila: ${linhasNaFila}. Esperado ${esperado}, que e so o que foi escrito ligado e nao ignorado.`);
  reg(`  (desligado e ignorado somam ${RODADAS * 2} chamadas que NAO deviam escrever nada)`);
  if (custoPorDentro.length > 0) {
    const ec = estatistica(custoPorDentro);
    resultado['custoPorDentro'] = ec;
    reg(`Custo POR DENTRO do gancho, sem o tempo de subir o processo: mediana ${ec.mediana} ms, p95 ${ec.p95} ms, maior ${ec.maior} ms`);
  }

  // ---- Como o Claude Code chama de verdade -------------------------------
  //
  // O gancho e instalado num caminho SEM ESPACO, de proposito: assim a linha de
  // comando nao precisa de aspas nenhuma e nao existe o que quebrar.
  writeFileSync(
    join(PASTA, 'ganchos.json'),
    JSON.stringify({ ligado: true, projetosIgnorados: [], tetoBytesPorSessao: 4194304, tetoArquivosNaFila: 2000 }, null, 2),
    'utf8'
  );
  const semEspaco = join(RODADA, 'a-fabrica-gancho.cjs');
  writeFileSync(semEspaco, readFileSync(GANCHO, 'utf8'), 'utf8');
  const curto = CAMINHO_CURTO_DO_NODE;
  reg('');
  reg('Como o Claude Code chama de verdade: linha de comando pelo interpretador');
  const formas = [
    ['node pelo caminho do sistema', `node ${semEspaco} PostToolUse`, 'lote-path'],
  ];
  if (curto !== null) formas.push(['caminho curto do node, sem busca no caminho', `${curto} ${semEspaco} PostToolUse`, 'lote-curto']);
  for (const [rotulo, comando, nome] of formas) {
    await rodarPeloInterpretador(cargaPostToolUse(0), comando, nome);
    const l = [];
    let codigosErrados = 0;
    let gritou = 0;
    for (let i = 0; i < RODADAS; i++) {
      const r = await rodarPeloInterpretador(cargaPostToolUse(i), comando, nome);
      l.push(r.ms);
      if (r.codigo !== 0) codigosErrados++;
      if (r.saida.trim().length > 0) gritou++;
    }
    const e = estatistica(l);
    resultado[`interpretador, ${rotulo}`] = e;
    reg(`  ${rotulo}`);
    reg(`    mediana ${e.mediana} ms, p95 ${e.p95} ms, maior ${e.maior} ms`);
    reg(`    codigo diferente de 0: ${codigosErrados} (tem de ser 0), escreveu na tela: ${gritou} (tem de ser 0)`);
    if (codigosErrados > 0) reg('    MEDIDA INVALIDA: codigo diferente de 0 quer dizer que o comando nao rodou');
  }

  reg('');
  const pelasFormas = Object.entries(resultado)
    .filter(([k]) => k.startsWith('interpretador, '))
    .map(([, v]) => v.p95);
  const pior = Math.min(...pelasFormas);
  const dentro = resultado['custoPorDentro'] ? resultado['custoPorDentro'].mediana : null;
  reg(`VEREDITO, pelo numero que o diretor paga de verdade (chamada pelo interpretador):`);
  reg(`  p95 de ${pior} ms por passo. Desses, a mediana de trabalho do gancho e ${dentro} ms;`);
  reg('  o resto e o custo de subir um processo, que e o piso de qualquer gancho de Claude Code.');
  reg(pior < 400 ? 'DENTRO do piscar de olhos (100 a 400 ms).' : 'FORA do piscar de olhos, tem de melhorar.');

  writeFileSync(join(RODADA, 'medida.txt'), `${linhas.join('\n')}\n`, 'utf8');
  writeFileSync(join(RODADA, 'medida.json'), JSON.stringify(resultado, null, 2), 'utf8');
  process.exit(pior < 400 && linhasNaFila === esperado ? 0 : 1);
}

void principal();
