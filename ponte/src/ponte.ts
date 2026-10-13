// ponte.ts, o servico. Liga a base (peca 2) ao Claude Code (peca 3).
// Roda continuamente na maquina do diretor. So conexao de saida. Falha fechada.
//
// Regra de ouro do fluxo, §A.3: o painel nunca fala com a fabrica. O painel
// escreve na base, a ponte le e executa; a ponte escreve na base, o painel le.

import { randomUUID } from 'node:crypto';
import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { onAuthStateChanged } from 'firebase/auth';
import { abrirFabrica, PortaoNaoConfirmado, type EventoFabrica, type Portao } from './claudeCode.js';
import {
  atualizarFabrica,
  esperarResposta,
  initBase,
  iniciarHeartbeat,
  ouvirComandos,
  publicarAprovacao,
  publicarAtividade,
  reconciliarPendentes,
  tomarComando,
} from './base.js';
import { PASTA_TRAVAS, carregarConfig, garantirPastaLocal } from './config.js';
import type { ComandoTomado, NivelRisco, PacoteAprovacao } from './tipos.js';
import type { Firestore } from 'firebase/firestore';
import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { homedir } from 'node:os';

const sessoesVivas = new Set<string>();

function cwdPadrao(): string {
  return process.env.PONTE_CWD ?? join(homedir(), 'a-fabrica-lab', 'projeto-cc');
}

export function risco(cmd: string): NivelRisco {
  const c = String(cmd).toLowerCase();
  if (/\b(rm|remove-item|del|format|dd|curl|wget|invoke-webrequest|git\s+push|npm\s+publish|shutdown)\b|>/.test(c)) {
    return 'alto';
  }
  if (/\b(set-content|new-item|mkdir|out-file|move-item|copy-item|git\s+commit|npm\s+install)\b/.test(c)) {
    return 'medio';
  }
  return 'baixo';
}

interface DadosPacote {
  toolName: string;
  input: Record<string, unknown>;
  textoAoVivo: string;
  tarefa: string;
  fabricaId: string;
  tempoParadoMs: number;
}

/**
 * Monta o pacote completo do pedido: o que quer fazer, por que precisa, impacto,
 * o que sera tocado, risco, origem e tempo parado. Cada campo diz se e FATO
 * capturado do fluxo ao vivo ou DEDUCAO da ponte. Nunca declaracao do agente
 * tomada como verdade.
 */
export function montarPacote(d: DadosPacote): PacoteAprovacao {
  const alvo = d.input['command'] ?? d.input['file_path'];
  const cmd = typeof alvo === 'string' ? alvo : JSON.stringify(d.input).slice(0, 200);
  const r: NivelRisco = d.toolName === 'Write' ? 'medio' : risco(cmd);
  const impacto: Record<NivelRisco, string> = {
    baixo: 'Sem efeito colateral aparente.',
    medio: 'Cria ou altera arquivo ou estado local.',
    alto: 'Pode apagar, publicar ou acessar rede.',
  };
  const texto = d.textoAoVivo.trim();
  return {
    marcacao: 'origem fato = capturado do fluxo ao vivo. origem ponte = deducao, nunca declaracao do agente.',
    oQue: { valor: cmd, origem: 'fato' },
    ferramenta: { valor: d.toolName, origem: 'fato' },
    tarefa: { valor: d.tarefa, origem: 'fato' },
    fabrica: { valor: d.fabricaId, origem: 'fato' },
    agenteDisse: { valor: texto.length > 0 ? texto : null, origem: 'fato' },
    porQue: {
      valor:
        texto.length > 0
          ? 'A ponte le, do fluxo ao vivo, que a acao serve a tarefa.'
          : 'O agente nao narrou; a ponte infere pela tarefa.',
      origem: 'ponte',
    },
    impacto: { valor: impacto[r], origem: 'ponte' },
    oQueSeraTocado: {
      valor: String(cmd).match(/[A-Za-z0-9._\-:\\/]+\.[A-Za-z0-9]{1,6}/g) ?? ['nada identificado'],
      origem: 'fato mais leitura da ponte',
    },
    risco: { valor: r, origem: 'ponte' },
    // Fato medido: quanto tempo a fabrica ja estava parada, sem evento novo,
    // quando o pedido foi criado.
    tempoParadoMs: { valor: d.tempoParadoMs, origem: 'fato' },
  };
}

/** O portao ligado a base: publica o pacote, espera a resposta do diretor, falha fechada. */
export function portaoParaBase(
  db: Firestore,
  maquinaId: string,
  fabricaId: string,
  tarefa: string,
  pegarTexto: () => string,
  pegarUltimoEventoEm: () => number
): Portao {
  return async (toolName, input): Promise<PermissionResult> => {
    try {
      const aprovacaoId = randomUUID();
      await publicarAprovacao(db, aprovacaoId, {
        fabricaId,
        maquinaId,
        origem: 'ponte',
        pacote: montarPacote({
          toolName,
          input,
          textoAoVivo: pegarTexto(),
          tarefa,
          fabricaId,
          tempoParadoMs: Math.max(0, Date.now() - pegarUltimoEventoEm()),
        }),
      });
      await atualizarFabrica(db, fabricaId, { estado: 'aguardando aprovacao' });
      const r = await esperarResposta(db, aprovacaoId);
      await atualizarFabrica(db, fabricaId, { estado: 'em execucao' });
      return r.decisao === 'allow'
        ? { behavior: 'allow' }
        : { behavior: 'deny', message: r.resposta };
    } catch {
      return { behavior: 'deny', message: 'erro no portao, negado por seguranca' };
    }
  };
}

/** Trava de processo unico por fabrica. Trava de processo morto nao prende a fabrica. */
function tentarTrava(fabricaId: string): (() => void) | null {
  garantirPastaLocal();
  const caminho = join(PASTA_TRAVAS, `${fabricaId}.lock`);
  const soltar = (fd: number) => (): void => {
    try {
      closeSync(fd);
    } catch {
      // ja fechado
    }
    try {
      // Caminho nomeado, arquivo por arquivo, §A.18. Trava nao e evidencia.
      unlinkSync(caminho);
    } catch {
      // ja removida
    }
  };
  try {
    const fd = openSync(caminho, 'wx');
    writeFileSync(caminho, String(process.pid), 'utf8');
    return soltar(fd);
  } catch {
    // Ja existe trava. Se o processo dono morreu, a trava e velha e pode ser reusada.
    let dono = 0;
    try {
      dono = Number(readFileSync(caminho, 'utf8').trim());
    } catch {
      dono = 0;
    }
    let vivo = false;
    if (dono > 0) {
      try {
        process.kill(dono, 0);
        vivo = true;
      } catch {
        vivo = false;
      }
    }
    if (vivo) return null;
    try {
      const fd = openSync(caminho, 'w');
      writeFileSync(caminho, String(process.pid), 'utf8');
      return soltar(fd);
    } catch {
      return null;
    }
  }
}

export interface ResultadoAbertura {
  fabricaId: string;
  sessionId: string | null;
  estado: string;
}

async function abrir(db: Firestore, maquinaId: string, comando: ComandoTomado): Promise<ResultadoAbertura> {
  const fabricaId = comando.fabricaId ?? randomUUID();
  const cwd = comando.cwd ?? cwdPadrao();
  const soltarTrava = tentarTrava(fabricaId);
  if (!soltarTrava) return { fabricaId, sessionId: null, estado: 'ja em execucao nesta maquina' };
  sessoesVivas.add(fabricaId);
  let texto = '';
  let ultimoEventoEm = Date.now();
  try {
    await atualizarFabrica(db, fabricaId, {
      maquinaId,
      projeto: cwd,
      estado: 'em execucao',
      inicio: new Date().toISOString(),
      agente: 'claude code',
    });
    let seq = 0;
    const estado = await abrirFabrica({
      cwd,
      prompt: comando.texto,
      resumeId: comando.conversationId,
      portao: portaoParaBase(
        db,
        maquinaId,
        fabricaId,
        comando.texto,
        () => texto,
        () => ultimoEventoEm
      ),
      onEvento: async (ev: EventoFabrica): Promise<void> => {
        if (ev.tipo === 'init') {
          await atualizarFabrica(db, fabricaId, {
            conversationId: ev.sessionId ?? null,
            modelo: ev.modelo ?? null,
          });
        }
        if (ev.tipo === 'texto' && ev.texto) texto += ev.texto;
        await publicarAtividade(db, fabricaId, {
          seq: seq++,
          tipo: ev.tipo,
          ferramenta: ev.ferramenta ?? null,
          subagente: ev.sub === true,
          inicioSubagente: ev.inicioSubagente === true,
        });
        if (ev.tipo === 'fim') {
          await atualizarFabrica(db, fabricaId, {
            estado: ev.estado === 'success' ? 'concluida' : 'falhou',
            consumo: ev.usage ?? null,
          });
        }
        ultimoEventoEm = Date.now();
      },
    });
    return { fabricaId, sessionId: estado.sessionId, estado: estado.resultado ?? 'sem resultado' };
  } catch (e) {
    const motivo =
      e instanceof PortaoNaoConfirmado
        ? `portao nao confirmado, prova ${JSON.stringify(e.prova)}`
        : String(e).slice(0, 200);
    await atualizarFabrica(db, fabricaId, { estado: 'falhou', erro: motivo }).catch(() => undefined);
    return { fabricaId, sessionId: null, estado: `falhou: ${motivo}` };
  } finally {
    sessoesVivas.delete(fabricaId);
    soltarTrava();
  }
}

export interface OpcoesServico {
  emulador?: boolean;
}

export async function main(opcoes: OpcoesServico = {}): Promise<void> {
  const emulador = opcoes.emulador === true;
  const config = carregarConfig({ emulador });
  const base = await initBase({ emulador, registrar: (l) => console.log(`[identidade] ${l}`) });
  const maquinaId = config.maquinaId;
  console.log(`ponte entrou como ${base.identidade.usuario.email}, degrau ${base.identidade.degrau}`);

  const hb = iniciarHeartbeat(base.db, maquinaId, { nome: config.nomeMaquina });
  const r = await reconciliarPendentes(base.db, maquinaId, sessoesVivas);
  console.log(
    `reconciliacao no inicio: ${r.aprovacoesRecusadas} pedido(s) recusado(s) por seguranca, ` +
      `${r.fabricasMarcadasOffline} fabrica(s) marcada(s) como ponte offline`
  );

  const off = ouvirComandos(base.db, maquinaId, (comandoId) => {
    void (async () => {
      const c = await tomarComando(base.db, comandoId); // idempotente: so pendente, uma vez
      if (c) {
        const saida = await abrir(base.db, maquinaId, c);
        console.log(`fabrica ${saida.fabricaId}: ${saida.estado}`);
      }
    })();
  });

  // Identidade perdida e parada segura: a ponte nao executa nada sem o diretor.
  onAuthStateChanged(base.auth, (u) => {
    if (!u) {
      console.error('sessao do diretor perdida, a ponte para por seguranca');
      void encerrar();
    }
  });

  let encerrando = false;
  const encerrar = async (): Promise<void> => {
    if (encerrando) return;
    encerrando = true;
    try {
      off();
    } catch {
      // ouvinte ja desligado
    }
    await hb.parar(sessoesVivas);
    process.exit(0);
  };
  process.on('SIGINT', () => void encerrar());
  process.on('SIGTERM', () => void encerrar());
  // Parada limpa tambem por linha na entrada de texto. No Windows, sinal enviado
  // a um processo filho encerra sem passar pelo tratador, e a parada limpa tem de
  // existir de verdade para a base nao ficar mentindo. Ler a propria entrada de
  // texto nao abre porta nenhuma, §A.6.
  if (process.stdin.isTTY !== true) {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d: string) => {
      if (/\bparar\b/i.test(d)) void encerrar();
    });
  }

  console.log(`ponte no ar, maquina ${maquinaId} ${emulador ? '(emulador)' : '(nuvem)'}`);
}

const executadoDireto = process.argv[1] !== undefined && /ponte\.(js|ts)$/.test(process.argv[1]);
if (executadoDireto) {
  main({ emulador: process.env.PONTE_EMULADOR === '1' }).catch((e: unknown) => {
    console.error('a ponte nao subiu.');
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
