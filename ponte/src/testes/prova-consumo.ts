// prova-consumo.ts, OST 9: o consumo medido de verdade, do Claude Code ate a base.
//
// Sem credencial de producao e sem base: a base e trocada por memoria, e o Claude
// Code e SEMPRE de verdade. Quatro partes:
//   1. medidor de consumo, casos montados (mensagem repetida, crescimento, resultado)
//   2. leitura da transcricao, arquivo montado (repeticao, linha pela metade, troca)
//   3. leitura da transcricao REAL de uma sessao do diretor, so numeros
//   4. fabrica de verdade pelo kit: consumo sobe DURANTE a execucao, fecha com o
//      total oficial, e dois comandos SOMAM em vez de substituir
//
// Uso: npm run prova:consumo
//      PONTE_TRANSCRICAO_REAL=<caminho .jsonl> para escolher a transcricao da parte 3

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const RODADA =
  process.env['PONTE_RODADA'] ?? join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost9-prova-consumo`);

// Pasta local da ponte dentro da rodada, §A.19, antes de importar a ponte.
if (process.env['PONTE_CONSUMO_FILHO'] !== '1') {
  mkdirSync(RODADA, { recursive: true });
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PONTE_CONSUMO_FILHO: '1',
      PONTE_RODADA: RODADA,
      PONTE_PASTA_LOCAL: join(RODADA, 'ponte-local'),
      PONTE_INTERVALO_CONSUMO_MS: '1000',
    },
  });
  process.exit(r.status ?? 1);
}

const { MedidorDeConsumo, abrirFabrica } = await import('../claudeCode.js');
const { lerTranscricao } = await import('../transcricao.js');
const { rodarSessao, LoteDeConsumo } = await import('../sessao.js');
const { RegistroDeFabricas } = await import('../vivas.js');
type Fabrica = import('../tipos.js').Fabrica;
type PortasDaSessao = import('../sessao.js').PortasDaSessao;
type PermissionResult = import('@anthropic-ai/claude-agent-sdk').PermissionResult;

const MODELO = process.env['PONTE_MODELO_PROVA'] ?? 'claude-haiku-5-5';
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
const CAMPOS = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'] as const;
function soma(c: Record<string, number> | null | undefined): number {
  if (!c) return 0;
  return CAMPOS.reduce((s, k) => s + (typeof c[k] === 'number' ? (c[k] as number) : 0), 0);
}
function somarEm(alvo: Record<string, number>, mais: Record<string, number>): void {
  for (const [k, v] of Object.entries(mais)) alvo[k] = (alvo[k] ?? 0) + v;
}

reg(`prova do consumo, OST 9, ${new Date().toISOString()}`);
reg(`rodada: ${RODADA}`);

// ---------------------------------------------------------------------------
reg('');
reg('PARTE 1, medidor de consumo com casos montados');
{
  const m = new MedidorDeConsumo();
  const a = m.mensagem('msg-1', { input_tokens: 10, output_tokens: 2 });
  conferir(soma(a) === 12, 'primeira vez da mensagem conta inteira', `acrescimo ${JSON.stringify(a)}`);
  const b = m.mensagem('msg-1', { input_tokens: 10, output_tokens: 2 });
  conferir(b === null, 'a MESMA mensagem repetida nao conta de novo', `acrescimo ${JSON.stringify(b)}`);
  const c = m.mensagem('msg-1', { input_tokens: 10, output_tokens: 7 });
  conferir(soma(c) === 5, 'a mensagem que cresceu conta so o que cresceu', `acrescimo ${JSON.stringify(c)}`);
  const d = m.mensagem('msg-2', { input_tokens: 3, cache_read_input_tokens: 100 });
  conferir(soma(d) === 103, 'mensagem nova conta inteira', `acrescimo ${JSON.stringify(d)}`);
  const e = m.resultado({ input_tokens: 20, output_tokens: 7, cache_read_input_tokens: 100 });
  conferir(soma(e) === 7, 'resultado oficial maior entra so com a diferenca', `falta ${JSON.stringify(e)}`);
  const f = m.resultado({ input_tokens: 1 });
  conferir(f === null, 'resultado menor que o medido nao tira nada', `falta ${JSON.stringify(f)}`);
  conferir(soma(m.total()) === 127, 'total do comando igual ao maior dos dois medidos', `total ${JSON.stringify(m.total())}`);
  const g = m.mensagem('msg-3', 'lixo');
  conferir(g === null, 'usage malformado nao conta', String(g));
}

{
  const gravados: Record<string, number>[] = [];
  let falhar = true;
  const lote = new LoteDeConsumo(
    async (x) => {
      if (falhar) {
        falhar = false;
        throw new Error('base fora do ar de mentira');
      }
      gravados.push(x);
    },
    60_000
  );
  lote.somar({ input_tokens: 5 });
  lote.somar({ input_tokens: 5, output_tokens: 1 });
  await lote.esvaziar();
  conferir(gravados.length === 0, 'lote com a base fora nao perde nada, guarda para depois', `${gravados.length} gravado(s)`);
  await lote.esvaziar();
  conferir(
    gravados.length === 1 && gravados[0]?.['input_tokens'] === 10 && gravados[0]?.['output_tokens'] === 1,
    'lote devolvido grava inteiro na proxima vez',
    JSON.stringify(gravados)
  );
}

// ---------------------------------------------------------------------------
reg('');
reg('PARTE 2, leitura da transcricao, arquivo montado');
{
  const pasta = join(RODADA, 'transcricao-montada');
  mkdirSync(pasta, { recursive: true });
  const arq = join(pasta, 'sessao.jsonl');
  const linha = (o: unknown): string => `${JSON.stringify(o)}\n`;
  writeFileSync(
    arq,
    linha({ type: 'user', message: { content: 'texto do diretor que NAO pode sair' } }) +
      linha({ type: 'assistant', message: { id: 'm1', model: 'claude-modelo-x', usage: { input_tokens: 10, output_tokens: 1 }, content: [{ type: 'text', text: 'segredo' }] } }) +
      linha({ type: 'assistant', message: { id: 'm1', model: 'claude-modelo-x', usage: { input_tokens: 10, output_tokens: 4 }, content: [{ type: 'tool_use' }] } }) +
      '{"type":"assistant","message":{"id":"m2","usage":{"input_tokens":99'
  );
  const l1 = lerTranscricao(arq, null);
  conferir(soma(l1.acrescimo) === 14, 'mensagem repetida em duas linhas conta uma vez, com o maior', JSON.stringify(l1.acrescimo));
  conferir(l1.modelo === 'claude-modelo-x', 'o modelo sai da transcricao', String(l1.modelo));
  const devolvido = JSON.stringify(l1);
  conferir(
    !devolvido.includes('segredo') && !devolvido.includes('diretor que NAO'),
    'nenhum TEXTO da transcricao sai da leitura, so numero e modelo',
    `${devolvido.length} caracteres devolvidos, sem conteudo`
  );
  conferir(l1.acrescimo?.input_tokens === 10, 'linha pela metade no fim nao conta ainda', JSON.stringify(l1.acrescimo));
  appendFileSync(arq, ',"output_tokens":1}}}\n');
  const l2 = lerTranscricao(arq, l1.marca);
  conferir(soma(l2.acrescimo) === 100, 'quando a linha termina, conta so ela', JSON.stringify(l2.acrescimo));
  const l3 = lerTranscricao(arq, l2.marca);
  conferir(l3.acrescimo === null, 'ler de novo sem nada novo nao soma nada', JSON.stringify(l3.acrescimo));
  const l4 = lerTranscricao(join(pasta, 'nao-existe.jsonl'), l2.marca);
  conferir(l4.acrescimo === null, 'transcricao ausente nao quebra e nao soma', JSON.stringify(l4.acrescimo));
}

// ---------------------------------------------------------------------------
reg('');
reg('PARTE 3, transcricao REAL de sessao do Claude Code nesta maquina, so numeros');
{
  let caminho = process.env['PONTE_TRANSCRICAO_REAL'] ?? null;
  if (caminho === null) {
    const raiz = join(homedir(), '.claude', 'projects');
    let melhor: { c: string; t: number } | null = null;
    if (existsSync(raiz)) {
      for (const p of readdirSync(raiz)) {
        const dir = join(raiz, p);
        let arquivos: string[] = [];
        try {
          arquivos = readdirSync(dir).filter((n) => n.endsWith('.jsonl'));
        } catch {
          continue;
        }
        for (const n of arquivos) {
          const c = join(dir, n);
          const t = statSync(c).mtimeMs;
          if (melhor === null || t > melhor.t) melhor = { c, t };
        }
      }
    }
    caminho = melhor?.c ?? null;
  }
  if (caminho === null) {
    conferir(false, 'achar uma transcricao real', 'nenhuma em ~/.claude/projects');
  } else {
    reg(`  transcricao: ${caminho.replace(homedir(), '~')}`);
    // Le em passadas, como a ponte faz, ate acabar.
    let marca = null as import('../transcricao.js').MarcaDaTranscricao | null;
    const total: Record<string, number> = {};
    let modelo: string | null = null;
    let passadas = 0;
    for (;;) {
      const l = lerTranscricao(caminho, marca);
      passadas++;
      if (l.acrescimo !== null) somarEm(total, l.acrescimo);
      if (l.modelo !== null) modelo = l.modelo;
      if (marca !== null && l.marca.bytes === marca.bytes) break;
      marca = l.marca;
      if (passadas > 200) break;
    }
    conferir(soma(total) > 0, 'a sessao real tem consumo medido', `${soma(total)} tokens em ${passadas} passada(s): ${JSON.stringify(total)}`);
    conferir(modelo !== null, 'a sessao real tem modelo', String(modelo));
  }
}

// ---------------------------------------------------------------------------
reg('');
reg(`PARTE 4, fabrica de verdade pelo kit do Claude Code, modelo ${MODELO}, base em memoria`);
{
  const projeto = join(RODADA, 'projeto-consumo');
  mkdirSync(projeto, { recursive: true });
  for (const n of ['um', 'dois', 'tres']) writeFileSync(join(projeto, `${n}.txt`), `arquivo ${n} da prova do consumo\n`);
  const negaTudo = async (): Promise<PermissionResult> => ({ behavior: 'deny', message: 'prova do consumo, nada executa' });

  // 4.1 direto no kit: o ao vivo bate com o total oficial do comando.
  const vivos: { em: number; acrescimo: Record<string, number> }[] = [];
  const t0 = Date.now();
  const estado = await abrirFabrica({
    cwd: projeto,
    prompt: 'Leia um.txt, depois dois.txt, depois tres.txt, um de cada vez, com a ferramenta Read. Depois diga em uma frase o que leu.',
    portao: negaTudo,
    modelo: MODELO,
    maxTurns: 8,
    onConsumo: (a) => {
      vivos.push({ em: Date.now() - t0, acrescimo: a });
    },
  });
  const somaViva: Record<string, number> = {};
  for (const v of vivos) somarEm(somaViva, v.acrescimo);
  const oficial = (estado.usage ?? {}) as Record<string, number>;
  reg(`  ${vivos.length} acrescimo(s) ao vivo, em ms: ${vivos.map((v) => v.em).join(', ')}`);
  reg(`  soma ao vivo: ${JSON.stringify(somaViva)}`);
  reg(`  total oficial do kit: ${JSON.stringify(Object.fromEntries(CAMPOS.map((k) => [k, oficial[k] ?? 0])))}`);
  conferir(vivos.length >= 2, 'consumo chega em mais de um momento, nao so no fim', `${vivos.length} acrescimos`);
  conferir(
    CAMPOS.every((k) => (somaViva[k] ?? 0) >= (oficial[k] ?? 0)),
    'nada do total oficial fica de fora da soma',
    'campo por campo, soma >= oficial'
  );
  conferir(
    CAMPOS.every((k) => (somaViva[k] ?? 0) === Math.max(somaViva[k] ?? 0, oficial[k] ?? 0)),
    'a soma e o maior dos dois numeros medidos, nenhum inventado',
    `${soma(somaViva)} tokens`
  );

  // 4.2 pela sessao da ponte: sobe ANTES do fim, e dois comandos SOMAM.
  const fabricas = new Map<string, Partial<Fabrica>>();
  const somas: { em: number; acrescimo: Record<string, number> }[] = [];
  const eventos: string[] = [];
  const base: Record<string, number> = {};
  const portas: PortasDaSessao = {
    registro: new RegistroDeFabricas(),
    anotarFabrica: async (id, dados) => {
      fabricas.set(id, { ...(fabricas.get(id) ?? {}), ...dados });
      if (dados.estado) eventos.push(`estado ${dados.estado} em ${Date.now() - t1}ms`);
    },
    somarConsumo: async (_id, a) => {
      somas.push({ em: Date.now() - t1, acrescimo: a });
      somarEm(base, a);
    },
    publicarPasso: async () => undefined,
    fazerPortao: () => negaTudo,
    horaDoServidor: () => new Date().toISOString(),
  };
  const fabricaId = `prova-consumo-${selo()}`;
  const t1 = Date.now();
  const r1 = await rodarSessao(portas, {
    fabricaId,
    cwd: projeto,
    prompt: 'Leia um.txt, depois dois.txt, depois tres.txt, um de cada vez, com a ferramenta Read. Depois diga em uma frase o que leu.',
    tarefa: 'prova do consumo, comando 1',
    resumeId: null,
    modelo: MODELO,
    agent: null,
    agents: null,
    dadosIniciais: { estado: 'em execucao' },
    maxTurns: 8,
  });
  const fimDo1 = eventos.find((e) => e.startsWith('estado concluida') || e.startsWith('estado falhou'));
  const msFim1 = fimDo1 ? Number(/em (\d+)ms/.exec(fimDo1)?.[1]) : Number.NaN;
  const antesDoFim = somas.filter((s) => s.em < msFim1);
  const depoisDo1 = soma(base);
  reg(`  comando 1: ${r1.estado}, ${somas.length} gravacao(oes) de consumo em ms ${somas.map((s) => s.em).join(', ')}, fim em ${msFim1}ms`);
  conferir(antesDoFim.length >= 1, 'consumo chega na base ANTES do estado final', `${antesDoFim.length} gravacao(oes) antes do fim`);
  const f1 = fabricas.get(fabricaId);
  conferir(f1?.tarefaInicio != null && f1?.tarefaFim != null, 'relogio da tarefa gravado, comeco e fim', `${String(f1?.tarefaInicio)} ate ${String(f1?.tarefaFim)}`);
  conferir(f1 !== undefined && !('consumo' in f1), 'o fim NAO escreve mais o consumo por cima', f1 && 'consumo' in f1 ? 'escreveu' : 'nao escreveu');

  const r2 = await rodarSessao(portas, {
    fabricaId,
    cwd: projeto,
    prompt: 'Diga apenas: pronto.',
    tarefa: 'prova do consumo, comando 2',
    resumeId: r1.sessionId,
    modelo: MODELO,
    agent: null,
    agents: null,
    dadosIniciais: { estado: 'em execucao' },
    maxTurns: 2,
  });
  const depoisDo2 = soma(base);
  reg(`  comando 2: ${r2.estado}, consumo da fabrica foi de ${depoisDo1} para ${depoisDo2} tokens`);
  conferir(depoisDo2 > depoisDo1, 'o segundo comando SOMA ao primeiro, nao substitui', `${depoisDo1} + ${depoisDo2 - depoisDo1}`);
}

reg('');
reg(erros === 0 ? 'RESUMO: tudo passou.' : `RESUMO: ${erros} caso(s) falharam.`);
process.exit(erros === 0 ? 0 : 1);
