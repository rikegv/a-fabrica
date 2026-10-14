// ponte.ts, o servico. Liga a base (peca 2) ao Claude Code (peca 3).
// Roda continuamente na maquina do diretor. So conexao de saida. Falha fechada.
//
// Regra de ouro do fluxo, §A.3: o painel nunca fala com a fabrica. O painel
// escreve na base, a ponte le e executa; a ponte escreve na base, o painel le.

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { onAuthStateChanged } from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';
import type { Portao } from './claudeCode.js';
import {
  atualizarFabrica,
  esperarResposta,
  initBase,
  iniciarHeartbeat,
  lerConversaDaFabrica,
  ouvirComandos,
  publicarAprovacao,
  publicarAtividade,
  reconciliarPendentes,
  recusarAprovacoesDaFabrica,
  tomarComando,
} from './base.js';
import {
  CAMINHO_CONFIG,
  CAMINHO_SESSAO,
  CAMINHO_SESSAO_EMULADOR,
  PASTA_LOCAL,
  carregarConfig,
} from './config.js';
import { SessaoDesprotegida, exigirProtecao } from './protecaoSessao.js';
import { iniciarPublicadorDeGanchos } from './ganchos.js';
import { mascararCampo } from './mascara.js';
import { despachar, type MundoDaPonte } from './acoes.js';
import { RegistroDeFabricas } from './vivas.js';
import type { NivelRisco, PacoteAprovacao } from './tipos.js';
import type { Firestore } from 'firebase/firestore';
import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { homedir } from 'node:os';

/**
 * As fabricas vivas deste processo, com o AbortController de cada uma. E por aqui
 * que encerrar e pausar alcancam uma sessao que esta rodando agora.
 */
const registro = new RegistroDeFabricas();

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
/**
 * Teto do texto do agente dentro do pacote de aprovacao.
 *
 * Existe por dois motivos. O primeiro e de leitura: o diretor decide olhando a
 * tela, e paragrafo de dez mil caracteres nao se le, se ignora. O segundo e de
 * seguranca: `aprovacoes` nao aceita apagar e aceita uma unica atualizacao, pela
 * regra do Firestore, entao tudo que entra ali entra para sempre. Quanto menos
 * texto livre atravessa esse caminho, menor a chance de levar junto o que nao
 * devia.
 */
const TETO_TEXTO_DO_AGENTE = 4000;

export function montarPacote(d: DadosPacote): PacoteAprovacao {
  const alvo = d.input['command'] ?? d.input['file_path'];
  const cmdBruto = typeof alvo === 'string' ? alvo : JSON.stringify(d.input).slice(0, 200);
  // MASCARA NO CAMINHO DA APROVACAO, §A.6 regra 5.
  //
  // Achado da auditoria da OST 7, e ela tinha razao: a mascara era chamada SO no
  // caminho dos ganchos. O pacote de aprovacao, que e o outro caminho em que texto
  // livre sai desta maquina, publicava o comando e TODO o texto acumulado do
  // agente sem mascara nenhuma, numa colecao que a regra proibe apagar. Ou seja: o
  // caminho mais permanente era o unico sem filtro.
  //
  // O que a mascara e o que ela nao e, dito aqui para ninguem confiar demais:
  // ela pega FORMAS CONHECIDAS de credencial, nao adivinha segredo. Ela reduz o
  // acidente; nao autoriza mandar segredo para ca.
  const cmdMascarado = mascararCampo(cmdBruto);
  const cmd = cmdMascarado.valor ?? cmdBruto;
  const r: NivelRisco = d.toolName === 'Write' ? 'medio' : risco(cmd);
  const impacto: Record<NivelRisco, string> = {
    baixo: 'Sem efeito colateral aparente.',
    medio: 'Cria ou altera arquivo ou estado local.',
    alto: 'Pode apagar, publicar ou acessar rede.',
  };
  const textoCru = d.textoAoVivo.trim();
  const textoMascarado = mascararCampo(textoCru.slice(0, TETO_TEXTO_DO_AGENTE));
  const texto = textoMascarado.valor ?? '';
  const pegou = [...new Set([...cmdMascarado.pegou, ...textoMascarado.pegou])];
  return {
    marcacao: 'origem fato = capturado do fluxo ao vivo. origem ponte = deducao, nunca declaracao do agente.',
    // Quando a mascara pegou algo, o diretor tem de saber que o que ele esta lendo
    // foi mexido antes de chegar na tela, senao ele le "[credencial mascarada]" e
    // acha que o agente escreveu aquilo.
    mascarou: pegou,
    textoDoAgenteCortado: textoCru.length > TETO_TEXTO_DO_AGENTE,
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
      // A fabrica pode ter sido encerrada ou pausada pelo diretor justamente agora.
      // Nesse caso nao se cria pedido novo: a sessao esta morrendo, e pedido de
      // fabrica morta e pedido fantasma na tela. Recusa, §A.6.
      if (registro.get(fabricaId)?.interrupcao !== null) {
        return { behavior: 'deny', message: 'fabrica interrompida por ordem do diretor, recusado por seguranca' };
      }
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
      // Volta para em execucao SO se a fabrica continua viva e sem ordem de parar.
      // Sem esta conferencia, a resposta que chega depois de o diretor encerrar ou
      // pausar reescreveria o estado e o painel passaria a mentir.
      if (registro.get(fabricaId)?.interrupcao === null) {
        await atualizarFabrica(db, fabricaId, { estado: 'em execucao' });
      }
      return r.decisao === 'allow'
        ? { behavior: 'allow' }
        : { behavior: 'deny', message: r.resposta };
    } catch {
      return { behavior: 'deny', message: 'erro no portao, negado por seguranca' };
    }
  };
}

/**
 * Monta o mundo da ponte: as portas que o roteador das acoes usa para falar com a
 * base e com o Claude Code. O roteador nao conhece Firestore, e e isso que permite
 * provar as cinco acoes sem base, com o Claude Code de verdade.
 */
export function mundoNaBase(db: Firestore, maquinaId: string, registrar: (l: string) => void): MundoDaPonte {
  return {
    maquinaId,
    registro,
    cwdPadrao,
    registrar,
    horaDoServidor: () => serverTimestamp(),
    anotarFabrica: (fabricaId, dados) => atualizarFabrica(db, fabricaId, dados),
    publicarPasso: async (fabricaId, passo): Promise<void> => {
      await publicarAtividade(db, fabricaId, passo);
    },
    lerConversa: (fabricaId) => lerConversaDaFabrica(db, fabricaId),
    recusarPendentes: (fabricaId, motivo) => recusarAprovacoesDaFabrica(db, fabricaId, motivo),
    fazerPortao: (ctx) =>
      portaoParaBase(db, maquinaId, ctx.fabricaId, ctx.tarefa, ctx.pegarTexto, ctx.pegarUltimoEventoEm),
  };
}

export interface OpcoesServico {
  emulador?: boolean;
}

export async function main(opcoes: OpcoesServico = {}): Promise<void> {
  const emulador = opcoes.emulador === true;
  const config = carregarConfig({ emulador });
  const caminhoSessao = emulador ? CAMINHO_SESSAO_EMULADOR : CAMINHO_SESSAO;

  // PORTAO DE SUBIDA, antes de qualquer coisa: a sessao em disco e a chave com que
  // a ponte responde aprovacao na base. Se ela nao estiver trancada para o dono e
  // so para ele, a ponte NAO SOBE. Isto nao e aviso, e recusa, §A.6, e fecha a
  // condicao 12 do parecer da seguranca.
  //
  // O arquivo de sessao do emulador pode ainda nao existir na primeira subida,
  // porque e o proprio degrau do emulador que o cria. Por isso a conferencia dele
  // acontece depois do initBase, logo abaixo, e nunca e dispensada.
  const antes = exigirProtecao([
    { caminho: PASTA_LOCAL, tipo: 'pasta' },
    { caminho: CAMINHO_CONFIG, tipo: 'arquivo' },
    ...(existsSync(caminhoSessao) ? [{ caminho: caminhoSessao, tipo: 'arquivo' as const }] : []),
  ]);
  for (const v of antes) console.log(`[tranca] ${v.motivo}`);

  const base = await initBase({ emulador, registrar: (l) => console.log(`[identidade] ${l}`) });

  // Segunda passada, agora com a sessao existindo com certeza. Fecha o caminho em
  // que o arquivo nasce aberto durante a propria abertura.
  for (const v of exigirProtecao([{ caminho: caminhoSessao, tipo: 'arquivo' }])) {
    console.log(`[tranca] ${v.motivo}`);
  }
  const maquinaId = config.maquinaId;
  console.log(`ponte entrou como ${base.identidade.usuario.email}, degrau ${base.identidade.degrau}`);

  const hb = iniciarHeartbeat(base.db, maquinaId, { nome: config.nomeMaquina });

  // Bloco 1 da OST 7: a fila que os ganchos do Claude Code escrevem. Com isto, a
  // sessao que o DIRETOR abre na mao, em qualquer projeto, aparece no painel.
  // Quem publica e a ponte, nunca o gancho, e a mascara de segredo acontece aqui.
  const ganchos = iniciarPublicadorDeGanchos(base.db, maquinaId, {
    registrar: (l) => console.log(`[ganchos] ${l}`),
  });
  const r = await reconciliarPendentes(base.db, maquinaId, registro);
  console.log(
    `reconciliacao no inicio: ${r.aprovacoesRecusadas} pedido(s) recusado(s) por seguranca, ` +
      `${r.fabricasMarcadasOffline} fabrica(s) marcada(s) como ponte offline`
  );

  const mundo = mundoNaBase(base.db, maquinaId, (l) => console.log(`[acao] ${l}`));

  const off = ouvirComandos(base.db, maquinaId, (comandoId) => {
    void (async () => {
      const c = await tomarComando(base.db, comandoId); // idempotente: so pendente, uma vez
      if (c) {
        const saida = await despachar(mundo, c);
        console.log(
          `fabrica ${saida.fabricaId}, acao ${saida.acao}: ${saida.cumprida ? 'cumprida' : 'recusada'}, ${saida.motivo}`
        );
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
    ganchos.parar();
    // Uma ultima passada na fila antes de morrer: o que o gancho escreveu nos
    // ultimos segundos nao fica para tras so porque a ponte esta encerrando.
    await ganchos.agora().catch(() => undefined);
    await hb.parar([...registro.keys()]);
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
    if (e instanceof SessaoDesprotegida) {
      console.error('');
      console.error('Isto e recusa de proposito, nao defeito. O que resolve, uma vez so:');
      console.error('  powershell -ExecutionPolicy Bypass -File ponte\\instalar.ps1');
      for (const v of e.vereditos) console.error(`  ${v.protegido ? 'TRANCADO' : 'ABERTO'}: ${v.motivo}`);
      process.exit(6);
    }
    process.exit(1);
  });
}
