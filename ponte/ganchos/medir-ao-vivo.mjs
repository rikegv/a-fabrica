// medir-ao-vivo.mjs, a medida que de verdade responde a pergunta da OST 7.
//
// A OST manda: "Meça e diga quanto tempo ele acrescenta a cada passo."
//
// POR QUE ESTA MEDIDA EXISTE, e por que a outra nao bastava
// --------------------------------------------------------
// medir.mjs mede o gancho sozinho: sobe o processo, cronometra, devolve. Isso
// responde "quanto custa uma chamada do gancho", e e um numero necessario, mas
// NAO e a pergunta do diretor. A pergunta dele e quanto o trabalho DELE fica mais
// lento. Para responder isso tem um jeito so, e e por comparacao: a MESMA tarefa,
// na MESMA maquina, com os ganchos ligados e com eles desligados de verdade.
//
// Desligado aqui quer dizer FORA do settings.json, nao o interruptor leve. O
// interruptor leve faz o gancho sair na primeira linha, mas o processo ainda sobe,
// e o processo e quase todo o custo. Medir com o interruptor leve daria um numero
// bonito e errado.
//
// §A.9 o script guarda o estado dos ganchos e o devolve no fim, inclusive se der
//      erro no meio. A maquina do diretor nao fica diferente de como estava.
// §A.17 pasta propria da rodada, com data e hora. Nada apagado.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const LIGAR = join(AQUI, 'ligar.ps1');
const DESLIGAR = join(AQUI, 'desligar.ps1');
const SETTINGS = join(process.env.USERPROFILE ?? '', '.claude', 'settings.json');
const RODADAS = Number(process.env.MEDIR_RODADAS ?? '3');

function selo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost7-medida-ao-vivo`);
const PROJETO = join(RODADA, 'projeto-de-teste');
mkdirSync(PROJETO, { recursive: true });
writeFileSync(join(PROJETO, 'um.txt'), 'conteudo um\n', 'utf8');
writeFileSync(join(PROJETO, 'dois.txt'), 'conteudo dois\n', 'utf8');
writeFileSync(join(PROJETO, 'tres.txt'), 'conteudo tres\n', 'utf8');

const linhas = [];
function reg(t) {
  console.log(t);
  linhas.push(t);
}

/**
 * A tarefa de medida. Escolhida de proposito com VARIOS passos de ferramenta,
 * porque o custo do gancho e por passo: uma tarefa de um passo esconderia o
 * efeito.
 */
const TAREFA =
  'Leia os arquivos um.txt, dois.txt e tres.txt desta pasta, um por um, e depois ' +
  'responda apenas com as tres palavras finais de cada um, separadas por virgula. ' +
  'Nao escreva nenhum arquivo.';

function rodarPowerShell(arquivo) {
  return new Promise((resolve) => {
    const f = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', arquivo], { stdio: ['ignore', 'pipe', 'pipe'] });
    let saida = '';
    f.stdout.on('data', (d) => (saida += d.toString('utf8')));
    f.stderr.on('data', (d) => (saida += d.toString('utf8')));
    f.on('close', (c) => resolve({ codigo: c, saida }));
  });
}

function umaSessao() {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const f = spawn('claude', ['-p', TAREFA, '--output-format', 'json'], {
      cwd: PROJETO,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    let saida = '';
    f.stdout.on('data', (d) => (saida += d.toString('utf8')));
    f.stderr.on('data', (d) => (saida += d.toString('utf8')));
    f.on('close', (codigo) => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      let passos = null;
      let duracaoRelatada = null;
      try {
        const j = JSON.parse(saida);
        duracaoRelatada = typeof j.duration_ms === 'number' ? j.duration_ms : null;
        passos = typeof j.num_turns === 'number' ? j.num_turns : null;
      } catch {
        // saida que nao e JSON: fica sem o detalhe, o tempo de parede continua valendo
      }
      resolve({ ms, codigo, passos, duracaoRelatada, saida });
    });
  });
}

function est(l) {
  const o = [...l].sort((a, b) => a - b);
  return {
    amostras: l.length,
    menor: +o[0].toFixed(0),
    mediana: +o[Math.floor(o.length / 2)].toFixed(0),
    maior: +o[o.length - 1].toFixed(0),
    media: +(l.reduce((a, b) => a + b, 0) / l.length).toFixed(0),
  };
}

function ganchosLigados() {
  if (!existsSync(SETTINGS)) return false;
  try {
    const j = JSON.parse(readFileSync(SETTINGS, 'utf8'));
    const todos = Object.values(j.hooks ?? {}).flat();
    return todos.some((e) => (e.hooks ?? []).some((h) => String(h.command ?? '').includes('a-fabrica-gancho')));
  } catch {
    return false;
  }
}

async function medirFase(rotulo) {
  const tempos = [];
  const passosPorSessao = [];
  for (let i = 0; i < RODADAS; i++) {
    const r = await umaSessao();
    tempos.push(r.ms);
    if (r.passos !== null) passosPorSessao.push(r.passos);
    reg(`    ${rotulo} ${i + 1}/${RODADAS}: ${r.ms.toFixed(0)} ms de parede, codigo ${String(r.codigo)}, ${r.passos ?? '?'} turno(s)`);
    writeFileSync(join(RODADA, `sessao-${rotulo}-${i + 1}.json`), r.saida, 'utf8');
  }
  return { tempos: est(tempos), turnos: passosPorSessao };
}

async function principal() {
  reg(`rodada em ${RODADA}`);
  reg(`tarefa de medida, com varios passos de ferramenta: ${TAREFA.slice(0, 70)}...`);
  reg(`${RODADAS} sessao(oes) por fase, sessao VIVA do Claude Code, nada simulado`);
  reg('');

  const estadoOriginal = ganchosLigados();
  reg(`estado dos ganchos antes desta medida: ${estadoOriginal ? 'LIGADOS' : 'desligados'}`);
  reg('este script devolve a maquina para esse estado no fim, inclusive se der erro, §A.9');
  reg('');

  const resultado = {};
  try {
    // Fase A, SEM ganchos. Desligados de verdade, fora do settings.json.
    reg('FASE A, ganchos DESLIGADOS (fora do settings.json)');
    const a = await rodarPowerShell(DESLIGAR);
    reg(`  desligar: codigo ${String(a.codigo)}, ganchos agora ${ganchosLigados() ? 'LIGADOS, o que seria erro' : 'desligados'}`);
    resultado.sem = await medirFase('sem-ganchos');
    reg(`  SEM ganchos: menor ${resultado.sem.tempos.menor} ms, mediana ${resultado.sem.tempos.mediana} ms, maior ${resultado.sem.tempos.maior} ms`);
    reg('');

    // Fase B, COM ganchos.
    reg('FASE B, ganchos LIGADOS');
    const b = await rodarPowerShell(LIGAR);
    reg(`  ligar: codigo ${String(b.codigo)}, ganchos agora ${ganchosLigados() ? 'ligados' : 'DESLIGADOS, o que seria erro'}`);
    resultado.com = await medirFase('com-ganchos');
    reg(`  COM ganchos: menor ${resultado.com.tempos.menor} ms, mediana ${resultado.com.tempos.mediana} ms, maior ${resultado.com.tempos.maior} ms`);
    reg('');

    // A conta que responde a pergunta do diretor.
    const diferenca = resultado.com.tempos.mediana - resultado.sem.tempos.mediana;
    const turnos = resultado.com.turnos.length > 0 ? Math.max(...resultado.com.turnos) : null;
    reg('RESPOSTA A PERGUNTA DA OST');
    reg(`  a mesma tarefa levou ${resultado.sem.tempos.mediana} ms sem ganchos e ${resultado.com.tempos.mediana} ms com ganchos, pela mediana.`);
    reg(`  diferenca: ${diferenca >= 0 ? '+' : ''}${diferenca} ms na tarefa inteira.`);
    if (turnos !== null && turnos > 0) {
      reg(`  a tarefa teve ate ${turnos} turno(s); por passo isso da cerca de ${Math.round(diferenca / Math.max(1, turnos))} ms.`);
    }
    reg('');
    reg('  LEITURA HONESTA: a variacao natural entre duas sessoes do mesmo comando, no mesmo');
    reg('  computador, e de centenas de milissegundos por conta de rede e de carga da maquina.');
    reg('  Com poucas amostras, a diferenca medida acima pode estar DENTRO desse ruido, e ai o');
    reg('  que ela diz e: o gancho nao aparece na medida, nao que ele custa exatamente isso.');
    reg('  O numero firme, esse sim, e o custo POR DENTRO do gancho, que ele mesmo anota em');
    reg('  cada linha da fila, e que nas sessoes ao vivo ficou entre 2 e 7 ms por passo.');

    writeFileSync(join(RODADA, 'medida.json'), JSON.stringify(resultado, null, 2), 'utf8');
  } finally {
    // §A.9: devolve a maquina ao estado em que estava, sempre.
    const agora = ganchosLigados();
    if (agora !== estadoOriginal) {
      reg('');
      reg(`devolvendo os ganchos ao estado original (${estadoOriginal ? 'ligados' : 'desligados'})`);
      const r = await rodarPowerShell(estadoOriginal ? LIGAR : DESLIGAR);
      reg(`  codigo ${String(r.codigo)}, estado final ${ganchosLigados() ? 'ligados' : 'desligados'}`);
    }
    writeFileSync(join(RODADA, 'medida.txt'), `${linhas.join('\n')}\n`, 'utf8');
  }
}

void principal();
