// ponte.mjs, o servico. Liga a base (peca 2) ao Claude Code (peca 3).
// Roda continuamente na maquina do diretor. So conexao de saida. Falha fechada.
import { randomUUID } from 'node:crypto';
import { openSync, closeSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { abrirFabrica } from './claudeCode.mjs';
import {
  initBase, iniciarHeartbeat, atualizarFabrica, publicarAtividade, publicarAprovacao,
  esperarResposta, tomarComando, ouvirComandos, reconciliarPendentes,
} from './base.mjs';

const MAQUINA = process.env.PONTE_MAQUINA_ID || 'maquina-do-diretor';
const CWD_PADRAO = process.env.PONTE_CWD || join(homedir(), 'a-fabrica-lab', 'projeto-cc');
const LOCKS = join(homedir(), '.a-fabrica-ponte', 'locks');
mkdirSync(LOCKS, { recursive: true });
const sessoesVivas = new Set();

function risco(cmd) {
  const c = String(cmd || '').toLowerCase();
  if (/\b(rm|remove-item|del|format|dd|curl|wget|invoke-webrequest|git\s+push|npm\s+publish|shutdown)\b|>/.test(c)) return 'alto';
  if (/\b(set-content|new-item|mkdir|out-file|move-item|copy-item|git\s+commit|npm\s+install)\b/.test(c)) return 'medio';
  return 'baixo';
}
function montarPacote({ toolName, input, textoAoVivo, tarefa, fabricaId }) {
  const cmd = input?.command ?? input?.file_path ?? JSON.stringify(input).slice(0, 200);
  const r = toolName === 'Write' ? 'medio' : risco(cmd);
  return {
    marcacao: 'origem fato = capturado do fluxo ao vivo. origem ponte = deducao, nunca declaracao do agente.',
    oQue: { valor: cmd, origem: 'fato' }, ferramenta: { valor: toolName, origem: 'fato' },
    tarefa: { valor: tarefa, origem: 'fato' }, fabrica: { valor: fabricaId, origem: 'fato' },
    agenteDisse: { valor: textoAoVivo?.trim() || null, origem: 'fato' },
    porQue: { valor: textoAoVivo ? 'A ponte le, do fluxo ao vivo, que a acao serve a tarefa.' : 'O agente nao narrou; a ponte infere pela tarefa.', origem: 'ponte' },
    impacto: { valor: { baixo: 'Sem efeito colateral aparente.', medio: 'Cria ou altera arquivo ou estado local.', alto: 'Pode apagar, publicar ou acessar rede.' }[r], origem: 'ponte' },
    oQueSeraTocado: { valor: (String(cmd).match(/[A-Za-z0-9._\-:\\/]+\.[A-Za-z0-9]{1,6}/g) || ['nada identificado']), origem: 'fato mais leitura da ponte' },
    risco: { valor: r, origem: 'ponte' },
  };
}

// O portao ligado a base: publica o pacote, espera a resposta do diretor, falha fechada.
function portaoParaBase(db, fabricaId, tarefa, pegarTexto) {
  return async (toolName, input) => {
    try {
      const aprovacaoId = randomUUID();
      await publicarAprovacao(db, aprovacaoId, { fabricaId, maquinaId: MAQUINA, pacote: montarPacote({ toolName, input, textoAoVivo: pegarTexto(), tarefa, fabricaId }), origem: 'ponte' });
      const r = await esperarResposta(db, aprovacaoId);
      return r.decisao === 'allow' ? { behavior: 'allow' } : { behavior: 'deny', message: r.resposta || 'recusado pelo diretor' };
    } catch { return { behavior: 'deny', message: 'erro no portao, negado por seguranca' }; }
  };
}

async function abrir(db, comando) {
  const fabricaId = comando.fabricaId || randomUUID();
  const cwd = comando.cwd || CWD_PADRAO;
  const lock = join(LOCKS, `${fabricaId}.lock`);
  let fd; try { fd = openSync(lock, 'wx'); } catch { return; } // trava de processo unico por fabrica
  sessoesVivas.add(fabricaId);
  let texto = '';
  try {
    await atualizarFabrica(db, fabricaId, { maquinaId: MAQUINA, projeto: cwd, estado: 'em execucao', inicio: new Date().toISOString() });
    let seq = 0;
    const estado = await abrirFabrica({
      cwd, prompt: comando.texto, resumeId: comando.conversationId,
      portao: portaoParaBase(db, fabricaId, comando.texto, () => texto),
      onEvento: async (ev) => {
        if (ev.tipo === 'init') await atualizarFabrica(db, fabricaId, { conversationId: ev.sessionId, modelo: ev.modelo });
        if (ev.tipo === 'texto') texto += ev.texto;
        await publicarAtividade(db, fabricaId, { seq: seq++, tipo: ev.tipo, ferramenta: ev.ferramenta || null, subagente: !!ev.sub, inicioSubagente: !!ev.inicioSubagente });
        if (ev.tipo === 'fim') await atualizarFabrica(db, fabricaId, { estado: ev.estado === 'success' ? 'concluida' : 'falhou', consumo: ev.usage || null });
      },
    });
    return estado;
  } catch (e) {
    await atualizarFabrica(db, fabricaId, { estado: 'falhou', erro: String(e).slice(0, 200) }).catch(() => {});
  } finally {
    sessoesVivas.delete(fabricaId);
    try { closeSync(fd); unlinkSync(lock); } catch {}
  }
}

export async function main({ emulador = false } = {}) {
  const { db } = await initBase({ emulador });
  const hb = iniciarHeartbeat(db, MAQUINA, { nome: 'maquina do diretor' });
  await reconciliarPendentes(db, MAQUINA, sessoesVivas); // crash-recovery no inicio
  const off = ouvirComandos(db, MAQUINA, async (comandoId) => {
    const c = await tomarComando(db, comandoId); // idempotente: so entrega pendente, uma vez
    if (c) await abrir(db, c);
  });
  const encerrar = async () => { try { off(); } catch {} await hb.parar(); process.exit(0); };
  process.on('SIGINT', encerrar); process.on('SIGTERM', encerrar);
  console.log('ponte no ar, maquina', MAQUINA, emulador ? '(emulador)' : '(nuvem)');
}

if (process.argv[1] && process.argv[1].endsWith('ponte.mjs')) main({ emulador: process.env.PONTE_EMULADOR === '1' });
