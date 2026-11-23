// sessao.ts, uma sessao de fabrica rodando, do inicio ao fim.
//
// Este arquivo e o corpo do que a Onda 1 fazia dentro de ponte.ts, agora com as
// portas de fora injetadas. Duas razoes, e a segunda e a que importa:
//   1. as cinco acoes da Onda 2 compartilham exatamente o mesmo caminho de
//      abertura, entao nenhuma delas pode ter um atalho que desvie do portao;
//   2. da para provar o caminho sem base: a prova injeta portas de memoria e roda
//      o Claude Code DE VERDADE. Sem isso, encerrar e pausar so teriam prova no
//      dia em que o diretor fizer o login do navegador.
//
// REGRAS DURAS QUE VIVEM AQUI
// ---------------------------
// Trava de processo unico por fabrica, para o mesmo comando nao rodar duas vezes.
// Portao da OST 4 inteiro, pelo abrirFabrica, sem bandeira que desligue.
// Interrupcao com motivo: sessao que o diretor mandou encerrar ou pausar NAO vira
// `falhou`, porque isso seria mentira na tela.

import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PASTA_TRAVAS, garantirPastaLocal } from './config.js';
import { PortaoNaoConfirmado, abrirFabrica, type EventoFabrica, type Portao } from './claudeCode.js';
import type { RegistroDeFabricas } from './vivas.js';
import type { Fabrica, Momento, PassoAtividade } from './tipos.js';
import { mascarar } from './mascara.js';

/**
 * OST 10: o texto do passo, mascarado e com teto, para a tela dizer o que
 * aconteceu. Antes a ponte publicava so o tipo e o nome da ferramenta, e o painel
 * escrevia "Deu um passo" em toda linha.
 */
function campoDoPasso(valor: unknown, teto: number): string | null {
  if (typeof valor !== 'string' || valor.trim().length === 0) return null;
  const limpo = mascarar(valor).texto;
  return limpo.length > teto ? `${limpo.slice(0, teto)}[...cortado]` : limpo;
}

function detalhesDoPasso(ev: EventoFabrica): Pick<PassoAtividade, 'alvo' | 'descricao' | 'agente' | 'agenteChamado'> {
  const e = ev.entrada ?? {};
  const alvo =
    ev.tipo === 'ferramenta'
      ? campoDoPasso(e['command'] ?? e['file_path'] ?? e['path'] ?? e['pattern'] ?? e['url'] ?? e['notebook_path'] ?? null, 2000)
      : null;
  let descricao: string | null = null;
  if (ev.tipo === 'ferramenta') descricao = campoDoPasso(e['description'] ?? null, 300);
  else if (ev.tipo === 'texto') descricao = campoDoPasso(ev.texto ?? null, 4000);
  else if (ev.tipo === 'init') descricao = campoDoPasso(ev.modelo ? `modelo ${ev.modelo}` : null, 120);
  else if (ev.tipo === 'fim') descricao = campoDoPasso(ev.estado ?? null, 120);
  const chamado = ev.tipo === 'ferramenta' ? campoDoPasso(e['subagent_type'] ?? null, 120) : null;
  return {
    alvo,
    descricao,
    agente: ev.agente ?? null,
    agenteChamado: chamado ?? (ev.inicioSubagente === true ? 'general-purpose' : null),
  };
}

/** Trava de processo unico por fabrica. Trava de processo morto nao prende a fabrica. */
export function tentarTrava(fabricaId: string): (() => void) | null {
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

/** Quanto se espera a sessao anterior desmontar antes de abrir a proxima. */
const ESPERA_DESMONTAR_MS = 20000;

export interface ContextoDoPortao {
  fabricaId: string;
  tarefa: string;
  pegarTexto: () => string;
  pegarUltimoEventoEm: () => number;
}

/** As portas de fora da sessao. O servico liga na base; a prova liga na memoria. */
export interface PortasDaSessao {
  registro: RegistroDeFabricas;
  anotarFabrica: (fabricaId: string, dados: Partial<Fabrica>) => Promise<void>;
  publicarPasso: (fabricaId: string, passo: Omit<PassoAtividade, 'em'>) => Promise<void>;
  fazerPortao: (ctx: ContextoDoPortao) => Portao;
  registrar?: (linha: string) => void;
  /**
   * OST 9: soma consumo na fabrica, nunca substitui. Ausente, o consumo nao sobe,
   * e a tela diz "consumo nao medido", que e verdade.
   */
  somarConsumo?: (fabricaId: string, acrescimo: Record<string, number>) => Promise<void>;
  /** OST 9: hora do servidor para o relogio da tarefa. Ausente, vale a hora local. */
  horaDoServidor?: () => Momento;
}

/**
 * De quanto em quanto tempo o consumo ao vivo sobe para a base. Cada mensagem do
 * assistente gera um acrescimo; gravar um por mensagem seria uma escrita por
 * segundo em sessao rapida. Junta em memoria e grava no maximo a cada intervalo,
 * e SEMPRE no fim do comando, antes do estado final.
 */
export const INTERVALO_CONSUMO_MS = Number(process.env['PONTE_INTERVALO_CONSUMO_MS']) > 0
  ? Number(process.env['PONTE_INTERVALO_CONSUMO_MS'])
  : 5000;

/** Junta acrescimos de consumo e grava em lote, sem perder nenhum. */
export class LoteDeConsumo {
  private pendente: Record<string, number> = {};
  private relogio: ReturnType<typeof setTimeout> | null = null;
  private gravando: Promise<void> = Promise.resolve();

  constructor(
    private readonly gravar: (acrescimo: Record<string, number>) => Promise<void>,
    private readonly intervaloMs = INTERVALO_CONSUMO_MS,
    private readonly aoFalhar: (erro: unknown) => void = () => undefined
  ) {}

  somar(acrescimo: Record<string, number>): void {
    for (const [c, v] of Object.entries(acrescimo)) {
      if (v > 0) this.pendente[c] = (this.pendente[c] ?? 0) + v;
    }
    if (this.relogio === null) {
      this.relogio = setTimeout(() => {
        this.relogio = null;
        void this.esvaziar();
      }, this.intervaloMs);
    }
  }

  /** Grava o que estiver junto. Em falha, devolve o lote para a proxima vez. */
  esvaziar(): Promise<void> {
    if (this.relogio !== null) {
      clearTimeout(this.relogio);
      this.relogio = null;
    }
    this.gravando = this.gravando.then(async () => {
      const lote = this.pendente;
      this.pendente = {};
      if (Object.keys(lote).length === 0) return;
      try {
        await this.gravar(lote);
      } catch (e) {
        for (const [c, v] of Object.entries(lote)) this.pendente[c] = (this.pendente[c] ?? 0) + v;
        this.aoFalhar(e);
      }
    });
    return this.gravando;
  }
}

export interface PedidoDeSessao {
  fabricaId: string;
  cwd: string;
  /** Prompt final, ja com a instrucao de abertura quando houver, veja personas.ts. */
  prompt: string;
  /** Texto do comando do diretor, que vai no pacote de aprovacao como tarefa. */
  tarefa: string;
  resumeId: string | null;
  modelo: string;
  agent: string | null;
  agents: Record<string, import('@anthropic-ai/claude-agent-sdk').AgentDefinition> | null;
  /** O que a ponte grava na fabrica antes de abrir. Montado por quem despachou. */
  dadosIniciais: Partial<Fabrica>;
  maxTurns?: number;
}

export interface ResultadoDaSessao {
  fabricaId: string;
  sessionId: string | null;
  /** Texto legivel do desfecho, para o registro da ponte e para o relatorio. */
  estado: string;
  /** false quando a trava impediu, quando o portao nao confirmou ou quando falhou. */
  rodou: boolean;
}

/**
 * Roda uma sessao de fabrica inteira: trava, registro de viva, portao, atividade
 * ao vivo, estado final.
 */
export async function rodarSessao(portas: PortasDaSessao, pedido: PedidoDeSessao): Promise<ResultadoDaSessao> {
  const { fabricaId, cwd } = pedido;
  const registrar = portas.registrar ?? ((): void => undefined);

  if (portas.registro.jaEncerrada(fabricaId)) {
    return {
      fabricaId,
      sessionId: null,
      estado: 'fabrica encerrada por ordem do diretor, nao volta',
      rodou: false,
    };
  }

  let soltarTrava = tentarTrava(fabricaId);
  if (!soltarTrava && portas.registro.terminando(fabricaId)) {
    // A sessao anterior desta mesma fabrica ja acabou o trabalho e esta so
    // desmontando. Medido na prova contra o emulador: o estado final chega a base
    // alguns segundos antes de a trava ser solta, entao o diretor que manda o
    // comando seguinte assim que a tela diz "concluida" batia em "ja em execucao".
    // Esperar a sessao antiga desmontar e o certo, e o limite e curto.
    registrar(`fabrica ${fabricaId}: esperando a sessao anterior desmontar antes de abrir a proxima`);
    await portas.registro.esperarFim(fabricaId, ESPERA_DESMONTAR_MS);
    soltarTrava = tentarTrava(fabricaId);
  }
  if (!soltarTrava) {
    return { fabricaId, sessionId: null, estado: 'ja em execucao nesta maquina', rodou: false };
  }
  // Registrada como viva antes de qualquer espera, para a ordem de encerrar ou de
  // pausar que chegue no instante seguinte encontrar o AbortController.
  const viva = portas.registro.abrir(fabricaId, cwd);

  let texto = '';
  let ultimoEventoEm = Date.now();
  const hora = (): Momento => portas.horaDoServidor?.() ?? new Date().toISOString();
  const somar = portas.somarConsumo;
  const lote =
    somar !== undefined
      ? new LoteDeConsumo(
          (acrescimo) => somar(fabricaId, acrescimo),
          INTERVALO_CONSUMO_MS,
          (e) => registrar(`fabrica ${fabricaId}: consumo nao subiu agora, fica para a proxima gravacao (${String(e).slice(0, 120)})`)
        )
      : null;
  let tarefaFechada = false;
  try {
    // O relogio da TAREFA comeca aqui, a cada comando, OST 9. O fim fica nulo
    // enquanto ela roda, para o painel contar ate agora.
    await portas.anotarFabrica(fabricaId, { ...pedido.dadosIniciais, tarefaInicio: hora(), tarefaFim: null });
    let seq = 0;
    const estado = await abrirFabrica({
      cwd,
      prompt: pedido.prompt,
      resumeId: pedido.resumeId,
      modelo: pedido.modelo,
      agent: pedido.agent,
      agents: pedido.agents,
      controle: viva.controle,
      ...(pedido.maxTurns !== undefined ? { maxTurns: pedido.maxTurns } : {}),
      ...(lote !== null ? { onConsumo: (acrescimo) => lote.somar(acrescimo) } : {}),
      portao: portas.fazerPortao({
        fabricaId,
        tarefa: pedido.tarefa,
        pegarTexto: () => texto,
        pegarUltimoEventoEm: () => ultimoEventoEm,
      }),
      onEvento: async (ev: EventoFabrica): Promise<void> => {
        if (ev.tipo === 'init') {
          viva.conversationId = ev.sessionId ?? null;
          await portas.anotarFabrica(fabricaId, {
            conversationId: ev.sessionId ?? null,
            modelo: ev.modelo ?? null,
          });
        }
        if (ev.tipo === 'texto' && ev.texto) texto += ev.texto;
        await portas.publicarPasso(fabricaId, {
          seq: seq++,
          tipo: ev.tipo,
          ferramenta: ev.ferramenta ?? null,
          subagente: ev.sub === true,
          inicioSubagente: ev.inicioSubagente === true,
          ...detalhesDoPasso(ev),
        });
        if (ev.tipo === 'fim') {
          viva.recebeuFim = true;
          // OST 9: o consumo ja foi SOMADO ao vivo, inclusive a diferenca do total
          // oficial. Aqui so esvazia o lote, antes do estado final, para a tela
          // nunca ver "concluida" com consumo atrasado. O consumo NAO e mais
          // escrito por cima: escrever o usage do comando substituia a soma dos
          // comandos anteriores.
          await lote?.esvaziar();
          tarefaFechada = true;
          // Interrompida por ordem do diretor nao vira concluida nem falhou por
          // aqui: quem mandou encerrar ou pausar ja gravou o estado verdadeiro.
          if (viva.interrupcao === null) {
            await portas.anotarFabrica(fabricaId, {
              estado: ev.estado === 'success' ? 'concluida' : 'falhou',
              tarefaFim: hora(),
            });
          } else {
            await portas.anotarFabrica(fabricaId, { tarefaFim: hora() });
          }
        }
        ultimoEventoEm = Date.now();
      },
    });
    if (viva.interrupcao !== null) {
      return {
        fabricaId,
        sessionId: estado.sessionId,
        estado: `interrompida por ordem do diretor: ${viva.interrupcao}`,
        rodou: true,
      };
    }
    return { fabricaId, sessionId: estado.sessionId, estado: estado.resultado ?? 'sem resultado', rodou: true };
  } catch (e) {
    // Sessao que morreu porque a ponte abortou a pedido do diretor nao e falha.
    if (viva.interrupcao !== null) {
      registrar(`fabrica ${fabricaId}: sessao interrompida a pedido do diretor (${viva.interrupcao})`);
      return {
        fabricaId,
        sessionId: viva.conversationId,
        estado: `interrompida por ordem do diretor: ${viva.interrupcao}`,
        rodou: true,
      };
    }
    const motivo =
      e instanceof PortaoNaoConfirmado
        ? `portao nao confirmado, prova ${JSON.stringify(e.prova)}`
        : String(e).slice(0, 200);
    await portas.anotarFabrica(fabricaId, { estado: 'falhou', erro: motivo }).catch(() => undefined);
    return { fabricaId, sessionId: null, estado: `falhou: ${motivo}`, rodou: false };
  } finally {
    // OST 9: sessao que terminou sem evento de fim (interrompida, falhou, caiu)
    // tambem fecha o relogio da tarefa e o lote de consumo. Sem isto, a tela
    // contaria a tarefa ate agora para sempre. NAO espera a rede: com a base fora
    // do ar a gravacao fica pendente, e a trava abaixo nao pode ficar presa nela.
    void lote?.esvaziar().catch(() => undefined);
    if (!tarefaFechada) {
      void portas.anotarFabrica(fabricaId, { tarefaFim: hora() }).catch(() => undefined);
    }
    // A trava sai PRIMEIRO. Quem estiver esperando o fim desta sessao e avisado
    // depois, e encontra a trava livre de verdade, nao prestes a ficar livre.
    soltarTrava();
    portas.registro.fechar(fabricaId);
  }
}
