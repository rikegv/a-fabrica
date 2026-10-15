// acoes.ts, o roteador das cinco acoes da Onda 2.
//
// O QUE ELE DECIDE, e so ele
// --------------------------
// Um documento de comando chega com o campo `acao` (contrato da Onda 2, secao 2) e
// este arquivo decide o que a ponte faz:
//
//   abrir      nasce fabrica nova, com agente e modelo do comando
//   comando    texto para fabrica que ja existe. E o caminho da Onda 1, intocado
//   encerrar   aborta a sessao viva, estado concluida, sem volta
//   pausar     aborta a sessao viva guardando a conversa, pausada true
//   reiniciar  retoma a conversa guardada, limpa pausada
//
// COMPATIBILIDADE, obrigatoria
// ----------------------------
// Comando SEM o campo `acao` vale como `comando` e segue pelo mesmo caminho da
// Onda 1. Os sete testes da OST 6 escrevem sem `acao` e nao precisam de uma linha
// de mudanca.
//
// FALHA FECHADA
// -------------
// Acao presente e nao reconhecida e RECUSADA, com motivo gravado na base. A ponte
// nao adivinha intencao. O mesmo vale para encerrar ou pausar fabrica que nao esta
// viva aqui e para reiniciar sem conversa guardada: a ponte recusa e diz o motivo,
// em vez de gravar um estado bonito que nao aconteceu.
//
// O PORTAO CONTINUA INTEIRO
// -------------------------
// Toda abertura, em `abrir`, `comando` e `reiniciar`, passa por rodarSessao, que
// passa por abrirFabrica, que faz as tres ressalvas. Nao existe caminho aqui que
// abra sessao sem elas, e nao existe bandeira para desligar.
//
// Encerrar, pausar e reiniciar sao ordens do DIRETOR pelo painel, nao execucao de
// risco de um agente, entao nao passam pelo portao de aprovacao. Quem pediu foi
// ele, e o pedido ja esta na trilha de `comandos`, com hora e origem do servidor.

import { randomUUID } from 'node:crypto';
import { modeloAceito, MODELO_PADRAO } from './claudeCode.js';
import { ROTULO_DE_TESTE } from './config.js';
import { aplicarPersona, nomeDeAgenteAceito } from './personas.js';
import { PREFIXO_MAO } from './ganchos.js';
import { rodarSessao, type PedidoDeSessao, type PortasDaSessao, type ResultadoDaSessao } from './sessao.js';
import type { AcaoComando, ComandoTomado, Fabrica, Momento } from './tipos.js';

/**
 * Quanto a ponte espera a sessao abortada desmontar antes de responder.
 *
 * Medido na prova contra o emulador: abortar e instantaneo, desmontar leva alguns
 * segundos, e sem esta espera o diretor pausava e o retomar logo depois batia em
 * "ja esta rodando aqui".
 */
const LIMITE_DESMONTAR_MS = 45000;

export interface MundoDaPonte extends PortasDaSessao {
  maquinaId: string;
  cwdPadrao: () => string;
  /** Le na base a conversa guardada da fabrica, para reiniciar. */
  lerConversa: (fabricaId: string) => Promise<string | null>;
  /**
   * Recusa os pedidos de aprovacao pendentes da fabrica, com motivo. Chamado por
   * encerrar e por pausar: sessao interrompida nao deixa pedido pendente na tela.
   */
  recusarPendentes: (fabricaId: string, motivo: string) => Promise<number>;
  /** Hora do servidor, para encerradaEm. Na prova, texto de hora local. */
  horaDoServidor: () => Momento;
  /** Trocavel so na prova, para exercitar o roteador sem abrir sessao de verdade. */
  rodar?: (portas: PortasDaSessao, pedido: PedidoDeSessao) => Promise<ResultadoDaSessao>;
}

export interface SaidaDeAcao {
  acao: AcaoComando | 'desconhecida';
  fabricaId: string;
  /** false quando a ponte recusou a ordem. Falha fechada diz nao, e diz por que. */
  cumprida: boolean;
  /** Texto legivel, sem travessao, §A.11. O mesmo que vai para a base. */
  motivo: string;
  sessao?: ResultadoDaSessao;
}

/**
 * Grava a recusa na base sem mentir sobre o estado.
 *
 * Usa o campo `erro` da fabrica, que o contrato ja reserva para o motivo que a
 * ponte precisa contar, e NAO toca em `estado`: uma ordem recusada nao muda o que
 * a fabrica e. Assim o painel mostra o motivo e continua mostrando o estado certo.
 */
async function recusar(
  mundo: MundoDaPonte,
  acao: AcaoComando | 'desconhecida',
  fabricaId: string,
  motivo: string
): Promise<SaidaDeAcao> {
  mundo.registrar?.(`ordem ${acao} recusada, fabrica ${fabricaId}: ${motivo}`);
  if (fabricaId.length > 0) {
    await mundo.anotarFabrica(fabricaId, { erro: motivo }).catch(() => undefined);
  }
  return { acao, fabricaId, cumprida: false, motivo };
}

/** Modelo pedido no comando, validado. null quando o texto nao serve. */
function escolherModelo(pedido: string | null): { modelo: string; motivo: string | null } {
  if (pedido === null || pedido.trim().length === 0) return { modelo: MODELO_PADRAO, motivo: null };
  const limpo = pedido.trim();
  if (!modeloAceito(limpo)) {
    return { modelo: MODELO_PADRAO, motivo: `modelo recusado por seguranca: ${JSON.stringify(limpo.slice(0, 60))}` };
  }
  return { modelo: limpo, motivo: null };
}

/** Caminho comum de abertura, usado por abrir, comando e reiniciar. */
async function abrirSessao(
  mundo: MundoDaPonte,
  acao: AcaoComando,
  comando: ComandoTomado,
  fabricaId: string,
  resumeId: string | null,
  extras: Partial<Fabrica>
): Promise<SaidaDeAcao> {
  const cwd = comando.cwd ?? mundo.cwdPadrao();
  const escolha = escolherModelo(comando.modelo);
  if (escolha.motivo !== null) return recusar(mundo, acao, fabricaId, escolha.motivo);
  // Nome de agente vira pedaco de caminho de arquivo. Valor estranho e recusado
  // antes de abrir, nao contornado, §A.6.
  if (comando.agente !== null && !nomeDeAgenteAceito(comando.agente.trim())) {
    return recusar(
      mundo,
      acao,
      fabricaId,
      `nome de agente recusado por seguranca: ${JSON.stringify(comando.agente.slice(0, 60))}`
    );
  }

  const persona = aplicarPersona(comando.agente, cwd, escolha.modelo, comando.texto);
  if (comando.agente !== null) {
    mundo.registrar?.(`fabrica ${fabricaId}, agente ${comando.agente}: ${persona.nota}`);
  }

  // Campos iniciais da fabrica. O caminho da Onda 1 escrevia estes quatro; a Onda 2
  // acrescenta, nunca tira.
  const dadosIniciais: Partial<Fabrica> = {
    maquinaId: mundo.maquinaId,
    projeto: cwd,
    estado: 'em execucao',
    inicio: new Date().toISOString(),
    agente: comando.agente ?? 'claude code',
    erro: null,
    // Rodada de teste nasce rotulada, para o painel poder esconder, §A.17: a
    // trilha de teste fica, e so sai da frente do trabalho de verdade.
    ...(ROTULO_DE_TESTE ? { teste: true } : {}),
    ...extras,
  };
  // A fabrica que o diretor abriu na mao pertence ao Bloco 1 e a origem dela nao se
  // reescreve. So fabrica de identificador do painel recebe origem painel.
  if (!fabricaId.startsWith(PREFIXO_MAO)) dadosIniciais.origem = 'painel';

  const rodar = mundo.rodar ?? rodarSessao;
  const sessao = await rodar(mundo, {
    fabricaId,
    cwd,
    prompt: persona.prompt,
    tarefa: comando.texto,
    resumeId,
    modelo: escolha.modelo,
    agent: persona.agent,
    agents: persona.agents,
    dadosIniciais,
  });
  return { acao, fabricaId, cumprida: sessao.rodou, motivo: sessao.estado, sessao };
}

/**
 * Despacha um comando ja tomado da base. Nunca lanca: toda saida e uma decisao
 * explicada, porque a ponte nao pode cair por causa de um documento torto.
 */
export async function despachar(mundo: MundoDaPonte, comando: ComandoTomado): Promise<SaidaDeAcao> {
  const fabricaId = comando.fabricaId ?? '';

  if (comando.acao === null) {
    return recusar(
      mundo,
      'desconhecida',
      fabricaId,
      `acao ${JSON.stringify(comando.acaoBruta ?? '')} nao reconhecida, recusada por seguranca. ` +
        'As acoes aceitas sao abrir, comando, encerrar, pausar e reiniciar.'
    );
  }

  if (comando.acao !== 'abrir' && fabricaId.length === 0) {
    return recusar(mundo, comando.acao, fabricaId, `ordem de ${comando.acao} sem fabrica, recusada`);
  }

  switch (comando.acao) {
    case 'abrir': {
      const nova = fabricaId.length > 0 ? fabricaId : randomUUID();
      if (mundo.registro.jaEncerrada(nova)) {
        return recusar(mundo, 'abrir', nova, 'fabrica encerrada por ordem do diretor, nao volta');
      }
      return abrirSessao(mundo, 'abrir', comando, nova, comando.conversationId, { pausada: false });
    }

    case 'comando': {
      // Caminho da Onda 1, igual: resume quando o comando trouxe conversa.
      return abrirSessao(mundo, 'comando', comando, fabricaId, comando.conversationId, { pausada: false });
    }

    case 'encerrar': {
      const viva = mundo.registro.interromper(fabricaId, 'encerrar');
      if (viva === null) {
        return recusar(
          mundo,
          'encerrar',
          fabricaId,
          'ordem de encerrar nao cumprida: nao existe sessao viva desta fabrica nesta ponte, ' +
            'nada foi encerrado. Se a fabrica foi aberta na mao, feche na janela do editor.'
        );
      }
      await mundo.anotarFabrica(fabricaId, {
        estado: 'concluida',
        encerradaEm: mundo.horaDoServidor(),
        pedidoDeEncerramento: comando.texto,
        pausada: false,
        erro: null,
      });
      const recusados = await mundo.recusarPendentes(
        fabricaId,
        'fabrica encerrada por ordem do diretor antes da resposta, pedido recusado por seguranca, nada executou'
      );
      // Abortar e instantaneo, desmontar nao e. Espera a sessao soltar a trava
      // antes de dizer que cumpriu, senao a ordem seguinte do diretor bate numa
      // fabrica que parece viva.
      const desmontou = await mundo.registro.esperarFim(fabricaId, LIMITE_DESMONTAR_MS);
      mundo.registrar?.(`fabrica ${fabricaId} encerrada por ordem do painel`);
      return {
        acao: 'encerrar',
        fabricaId,
        cumprida: true,
        motivo:
          `fabrica encerrada por ordem do painel, sessao abortada e ${desmontou ? 'trava solta' : 'ainda desmontando'}` +
          (recusados > 0 ? `, ${recusados} pedido(s) de aprovacao recusado(s) por seguranca` : ''),
      };
    }

    case 'pausar': {
      const viva = mundo.registro.interromper(fabricaId, 'pausar');
      if (viva === null) {
        return recusar(
          mundo,
          'pausar',
          fabricaId,
          'ordem de pausar nao cumprida: nao existe sessao viva desta fabrica nesta ponte, nada foi pausado.'
        );
      }
      // Estado aguardando comando com pausada true, contrato secao 3: a lista de
      // estados do §A.4 e fechada e pausada nao esta nela.
      await mundo.anotarFabrica(fabricaId, {
        estado: 'aguardando comando',
        pausada: true,
        conversationId: viva.conversationId,
        erro: null,
      });
      await mundo.recusarPendentes(
        fabricaId,
        'fabrica pausada por ordem do diretor antes da resposta, pedido recusado por seguranca, nada executou'
      );
      const desmontou = await mundo.registro.esperarFim(fabricaId, LIMITE_DESMONTAR_MS);
      mundo.registrar?.(`fabrica ${fabricaId} pausada, conversa guardada ${viva.conversationId ?? 'nenhuma'}`);
      return {
        acao: 'pausar',
        fabricaId,
        cumprida: true,
        motivo:
          (viva.conversationId === null
            ? 'fabrica pausada antes de a conversa comecar, nao ha o que retomar'
            : `fabrica pausada, conversa guardada ${viva.conversationId}`) +
          (desmontou ? '' : ', a sessao ainda esta desmontando'),
      };
    }

    case 'reiniciar': {
      if (mundo.registro.jaEncerrada(fabricaId)) {
        return recusar(mundo, 'reiniciar', fabricaId, 'fabrica encerrada por ordem do diretor, nao volta');
      }
      if (mundo.registro.has(fabricaId)) {
        // Se a sessao esta apenas desmontando depois de um pausar, vale esperar:
        // o diretor pausou e mandou retomar em seguida, e isso tem de funcionar.
        const interrompida = mundo.registro.get(fabricaId)?.interrupcao !== null;
        const livre = interrompida ? await mundo.registro.esperarFim(fabricaId, LIMITE_DESMONTAR_MS) : false;
        if (!livre) {
          return recusar(mundo, 'reiniciar', fabricaId, 'ordem de reiniciar nao cumprida: a fabrica ja esta rodando aqui');
        }
      }
      const conversa = comando.conversationId ?? (await mundo.lerConversa(fabricaId));
      if (conversa === null || conversa.length === 0) {
        return recusar(
          mundo,
          'reiniciar',
          fabricaId,
          'ordem de reiniciar nao cumprida: a fabrica nao tem conversa guardada para retomar. ' +
            'Retomar sem conversa seria abrir fabrica nova fingindo ser a antiga.'
        );
      }
      return abrirSessao(mundo, 'reiniciar', comando, fabricaId, conversa, { pausada: false });
    }
  }
}
