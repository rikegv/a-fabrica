// vivas.ts, o registro das fabricas vivas DENTRO desta ponte.
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// Encerrar e pausar sao ordens do diretor que precisam interromper uma sessao que
// esta rodando agora, neste processo. Para interromper e preciso guardar, na
// memoria da ponte, quem esta vivo e por onde se interrompe. O kit oficial aceita
// `abortController` em `Options` (veja sdk.d.ts, "Controller for cancelling the
// query"), e e esse o caminho usado aqui: um AbortController por fabrica.
//
// `interrupt()` do objeto Query NAO serve neste desenho: ele existe so no modo de
// entrada em fluxo (streaming input), e a ponte abre a sessao com prompt de texto,
// que fecha a entrada. Por isso o AbortController.
//
// DUAS COISAS QUE O REGISTRO GARANTE
// ----------------------------------
// 1. O MOTIVO DA INTERRUPCAO E GRAVADO ANTES DO ABORTO. Sem isso, o laco da sessao
//    veria a sessao morrer e marcaria `falhou`, o que seria mentira na tela do
//    diretor: ele mandou encerrar, nao falhou nada.
// 2. A FABRICA ENCERRADA NAO VOLTA. O identificador fica numa lista de encerradas
//    e qualquer ordem posterior para ela, nesta ponte, e recusada.
//
// Nada aqui escuta nada, §A.6. E memoria de processo, e so.

/** Por que a ponte interrompeu a sessao. Ordem do diretor, nunca falha do agente. */
export type MotivoDeInterrupcao = 'encerrar' | 'pausar';

export interface FabricaViva {
  readonly fabricaId: string;
  readonly cwd: string;
  readonly controle: AbortController;
  readonly abertaEm: number;
  /** Preenchido no init da sessao. E o que a acao `pausar` guarda para retomar. */
  conversationId: string | null;
  /** null enquanto a sessao esta rodando normal. */
  interrupcao: MotivoDeInterrupcao | null;
  /** true depois do evento de fim do Claude Code: a sessao ja esta desmontando. */
  recebeuFim: boolean;
  /**
   * Cumpre quando o laco da sessao termina de desmontar e a trava e solta.
   *
   * Existe por uma razao medida na prova do emulador: abortar e instantaneo, mas
   * desmontar a sessao leva alguns segundos. Sem esperar por isto, o diretor
   * pausava e, ao mandar retomar em seguida, ouvia "a fabrica ja esta rodando
   * aqui", porque a trava ainda estava na mao da sessao antiga.
   */
  readonly terminou: Promise<void>;
}

export class RegistroDeFabricas {
  private readonly vivas = new Map<string, FabricaViva>();
  private readonly encerradas = new Set<string>();
  private readonly avisarFim = new Map<string, () => void>();

  /** Anota a fabrica como viva e devolve o registro dela, com AbortController proprio. */
  abrir(fabricaId: string, cwd: string): FabricaViva {
    let avisar: () => void = () => undefined;
    const terminou = new Promise<void>((resolve) => {
      avisar = resolve;
    });
    const viva: FabricaViva = {
      fabricaId,
      cwd,
      controle: new AbortController(),
      abertaEm: Date.now(),
      conversationId: null,
      interrupcao: null,
      recebeuFim: false,
      terminou,
    };
    this.vivas.set(fabricaId, viva);
    this.avisarFim.set(fabricaId, avisar);
    return viva;
  }

  get(fabricaId: string): FabricaViva | undefined {
    return this.vivas.get(fabricaId);
  }

  has(fabricaId: string): boolean {
    return this.vivas.has(fabricaId);
  }

  /** Tira da lista de vivas. Chamado quando o laco da sessao termina, sempre. */
  fechar(fabricaId: string): void {
    const viva = this.vivas.get(fabricaId);
    if (viva?.interrupcao === 'encerrar') this.encerradas.add(fabricaId);
    this.vivas.delete(fabricaId);
    const avisar = this.avisarFim.get(fabricaId);
    this.avisarFim.delete(fabricaId);
    avisar?.();
  }

  /**
   * Espera a sessao desmontar de verdade, com limite de tempo.
   *
   * Devolve true quando a fabrica ja nao esta viva. False quando o tempo acabou e
   * ela continua desmontando, e quem chamou tem de dizer isso em vez de fingir.
   */
  async esperarFim(fabricaId: string, limiteMs: number): Promise<boolean> {
    const viva = this.vivas.get(fabricaId);
    if (viva === undefined) return true;
    let relogio: NodeJS.Timeout | undefined;
    const prazo = new Promise<'tempo'>((resolve) => {
      relogio = setTimeout(() => resolve('tempo'), limiteMs);
    });
    try {
      const quem = await Promise.race([viva.terminou.then(() => 'fim' as const), prazo]);
      return quem === 'fim' || !this.vivas.has(fabricaId);
    } finally {
      if (relogio !== undefined) clearTimeout(relogio);
    }
  }

  /**
   * A sessao desta fabrica ja acabou o trabalho e esta apenas desmontando, ou
   * recebeu ordem de parar. Vale esperar por ela; nao vale esperar por uma sessao
   * que esta no meio do trabalho.
   */
  terminando(fabricaId: string): boolean {
    const viva = this.vivas.get(fabricaId);
    if (viva === undefined) return false;
    return viva.recebeuFim || viva.interrupcao !== null;
  }

  /** A fabrica foi encerrada por ordem do diretor nesta ponte, e nao volta. */
  jaEncerrada(fabricaId: string): boolean {
    return this.encerradas.has(fabricaId);
  }

  /**
   * Marca o motivo e manda o aborto, nesta ordem, que importa: primeiro o motivo,
   * depois o aborto. Devolve false quando nao existe sessao viva, e quem chamou
   * tem de RECUSAR a ordem em vez de fingir que cumpriu.
   */
  interromper(fabricaId: string, motivo: MotivoDeInterrupcao): FabricaViva | null {
    const viva = this.vivas.get(fabricaId);
    if (viva === undefined) return null;
    viva.interrupcao = motivo;
    if (motivo === 'encerrar') this.encerradas.add(fabricaId);
    try {
      viva.controle.abort();
    } catch {
      // AbortController nao lanca em uso normal; se lancar, o motivo ja esta
      // gravado e o laco da sessao vai tratar como interrupcao do diretor.
    }
    return viva;
  }

  /** Identificadores vivos agora. Usado pelo sinal de vida e pela reconciliacao. */
  keys(): IterableIterator<string> {
    return this.vivas.keys();
  }

  get quantas(): number {
    return this.vivas.size;
  }
}
