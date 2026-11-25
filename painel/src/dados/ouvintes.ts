'use client';

/*
 * Ouvintes ao vivo da base (onSnapshot). Visao geral e Fabrica precisam de
 * atualizacao ao vivo: novo passo, novo pedido, mudanca de estado.
 *
 * So e chamado depois do login, com a Firestore que a entrada devolve. Sem
 * usuario autenticado, nenhuma leitura sai do painel.
 *
 * As consultas sao de proposito simples, sem indice composto: ordenam por um
 * campo so e o painel filtra o resto em memoria. As colecoes desta operacao
 * sao pequenas (um diretor, uma maquina, poucas fabricas) e assim o painel nao
 * depende de indice novo para subir.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getCountFromServer,
  limit as limitar,
  where,
  onSnapshot,
  orderBy,
  query,
  type Firestore,
  type FirestoreError,
  type Query
} from 'firebase/firestore';
import type { AprovacaoBase, AtividadeBase, ComandoBase, FabricaBase, MaquinaBase, RelatorioBase, TarefaBase } from './tipos';

export interface Colecao<T> {
  itens: T[];
  carregando: boolean;
  erro: string | null;
}

const VAZIA = { itens: [], carregando: true, erro: null } as const;

function mensagemDoErro(erro: FirestoreError): string {
  if (erro.code === 'permission-denied') {
    return 'A base recusou a leitura desta conta. Confira a regra do Firestore e a conta do diretor.';
  }
  if (erro.code === 'unavailable') {
    return 'Sem conexão com a base agora. O painel volta a atualizar sozinho quando a rede voltar.';
  }
  if (erro.code === 'failed-precondition') {
    return 'A base pediu um índice que ainda não existe para esta consulta.';
  }
  return `A base devolveu um erro: ${erro.message}`;
}

function usarConsulta<T extends { id: string }>(consulta: Query | null): Colecao<T> {
  const [estado, setEstado] = useState<Colecao<T>>(VAZIA as unknown as Colecao<T>);

  useEffect(() => {
    if (!consulta) {
      setEstado({ itens: [], carregando: false, erro: null });
      return;
    }
    setEstado((anterior) => ({ ...anterior, carregando: true }));
    const parar = onSnapshot(
      consulta,
      (foto) => {
        const itens = foto.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as T[];
        setEstado({ itens, carregando: false, erro: null });
      },
      (erro) => setEstado({ itens: [], carregando: false, erro: mensagemDoErro(erro) })
    );
    return parar;
  }, [consulta]);

  return estado;
}

export function usarMaquinas(base: Firestore | null): Colecao<MaquinaBase> {
  const consulta = useMemo(() => (base ? query(collection(base, 'maquinas')) : null), [base]);
  return usarConsulta<MaquinaBase>(consulta);
}

export function usarFabricas(base: Firestore | null): Colecao<FabricaBase> {
  /* Sem orderBy: a ordem da grade e por urgencia, decidida no tradutor. */
  const consulta = useMemo(() => (base ? query(collection(base, 'fabricas')) : null), [base]);
  return usarConsulta<FabricaBase>(consulta);
}

export function usarAprovacoes(base: Firestore | null): Colecao<AprovacaoBase> {
  /* Mais RECENTE primeiro na consulta, e a ordem da fila (mais antiga primeiro)
     e refeita em memoria pelo tradutor. Parece invertido e nao e: com ordem
     crescente, o limite guardaria as 50 mais ANTIGAS, e um dia de respostas
     acumuladas empurraria o pedido novo, que e justamente o que esta parado
     esperando o diretor, para fora da janela. Com ordem decrescente o pedido
     novo esta sempre dentro, e o historico que sobra de fora e o mais velho.
     Continua sendo consulta de um campo so, sem indice composto. */
  const consulta = useMemo(
    () => (base ? query(collection(base, 'aprovacoes'), orderBy('criadoEm', 'desc'), limitar(100)) : null),
    [base]
  );
  return usarConsulta<AprovacaoBase>(consulta);
}

/*
 * Atividade da fábrica, do mais NOVO para o mais antigo na consulta, os
 * `quantos` mais recentes. A tela inverte para a ordem de leitura.
 *
 * OST 10, DEFEITO QUE ISTO CONSERTA, visto na tela do diretor: a consulta
 * ordenava por `seq`, e o `seq` recomeça do zero a cada comando (fábrica aberta
 * pelo painel) e a cada retomada da sessão (fábrica aberta na mão). Com dois
 * comandos, os dois passos de seq 3 vinham juntos no topo, um das 15:39 e outro
 * das 15:34, e a lista saía fora de ordem. Agora a ordem é a HORA DO SERVIDOR
 * em que o passo foi gravado (`em`), que é única e só cresce. Consulta de um
 * campo só, sem índice composto.
 */
export function usarAtividade(base: Firestore | null, fabricaId: string | null, quantos: number): Colecao<AtividadeBase> {
  const consulta = useMemo(
    () =>
      base && fabricaId
        ? query(collection(base, 'fabricas', fabricaId, 'atividade'), orderBy('em', 'desc'), limitar(quantos))
        : null,
    [base, fabricaId, quantos]
  );
  return usarConsulta<AtividadeBase>(consulta);
}

/*
 * OST 10: QUANTOS passos a fábrica tem na base, contados pelo servidor.
 *
 * O quadro "Passos registrados" lia o `seq` do passo do topo, e o `seq`
 * recomeça a cada comando: a tela dizia 3 com 8 passos gravados. Agora é a
 * contagem de verdade, refeita sempre que chega passo novo (`gatilho`).
 */
export function usarTotalDeAtividade(
  base: Firestore | null,
  fabricaId: string | null,
  gatilho: string | null
): number | null {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    if (!base || !fabricaId) {
      setTotal(null);
      return;
    }
    let vivo = true;
    getCountFromServer(collection(base, 'fabricas', fabricaId, 'atividade'))
      .then((r) => {
        if (vivo) setTotal(r.data().count);
      })
      .catch(() => {
        if (vivo) setTotal(null);
      });
    return () => {
      vivo = false;
    };
  }, [base, fabricaId, gatilho]);
  return total;
}

/*
 * OST 10: as ordens que o diretor mandou para ESTA fábrica pelo painel. É a
 * própria fila de comandos, que a trilha guarda para sempre, com a situação
 * (pendente ou entregue). Filtro de um campo só, sem índice composto; a ordem é
 * feita na tela.
 */
export function usarComandosDaFabrica(base: Firestore | null, fabricaId: string | null): Colecao<ComandoBase> {
  const consulta = useMemo(
    () => (base && fabricaId ? query(collection(base, 'comandos'), where('fabricaId', '==', fabricaId)) : null),
    [base, fabricaId]
  );
  return usarConsulta<ComandoBase>(consulta);
}

/*
 * OST 13, item 2: a CONVERSA da fábrica, lida à parte, sem o limite de 200 da
 * atividade. Numa sessão longa as ordens e as respostas ficavam fora da janela
 * e o chat aparecia vazio. Só os passos de conversa, num único `in`, sem
 * orderBy: assim a base não pede índice composto. A ordem é feita no painel.
 * A escuta se encerra ao sair da tela, no cleanup do efeito de usarConsulta.
 */
export const TIPOS_DA_CONVERSA = ['comando do diretor', 'fim de rodada', 'texto', 'agent_response', 'user_input'];

export function usarConversa(base: Firestore | null, fabricaId: string | null): Colecao<AtividadeBase> {
  const consulta = useMemo(
    () =>
      base && fabricaId
        ? query(collection(base, 'fabricas', fabricaId, 'atividade'), where('tipo', 'in', TIPOS_DA_CONVERSA))
        : null,
    [base, fabricaId]
  );
  return usarConsulta<AtividadeBase>(consulta);
}

/*
 * OST 13, Onda 3: relatórios. Três leituras, todas sem índice composto:
 *  - os de UMA fábrica, filtro de um campo só, sem orderBy (a aba da fábrica e o
 *    filtro por fábrica do menu);
 *  - os mais recentes de todas, por criadoEm, com limite (o menu);
 *  - os de uma faixa de criadoEm, quando a data pedida está fora do que já foi
 *    carregado. Faixa e ordem no mesmo campo, que a base atende sem índice novo.
 */
export function usarRelatoriosDaFabrica(base: Firestore | null, fabricaId: string | null): Colecao<RelatorioBase> {
  const consulta = useMemo(
    () => (base && fabricaId ? query(collection(base, 'relatorios'), where('fabricaId', '==', fabricaId)) : null),
    [base, fabricaId]
  );
  return usarConsulta<RelatorioBase>(consulta);
}

export function usarRelatoriosRecentes(base: Firestore | null, quantos: number, ativo = true): Colecao<RelatorioBase> {
  const consulta = useMemo(
    () => (base && ativo ? query(collection(base, 'relatorios'), orderBy('criadoEm', 'desc'), limitar(quantos)) : null),
    [base, quantos, ativo]
  );
  return usarConsulta<RelatorioBase>(consulta);
}

export function usarRelatoriosDaFaixa(
  base: Firestore | null,
  faixa: { de: Date; ate: Date } | null
): Colecao<RelatorioBase> {
  const de = faixa?.de.getTime() ?? null;
  const ate = faixa?.ate.getTime() ?? null;
  const consulta = useMemo(
    () =>
      base && de !== null && ate !== null
        ? query(
            collection(base, 'relatorios'),
            where('criadoEm', '>=', new Date(de)),
            where('criadoEm', '<', new Date(ate)),
            orderBy('criadoEm', 'desc'),
            limitar(500)
          )
        : null,
    [base, de, ate]
  );
  return usarConsulta<RelatorioBase>(consulta);
}

export function usarTarefas(base: Firestore | null, fabricaId: string | null): Colecao<TarefaBase> {
  const consulta = useMemo(
    () =>
      base && fabricaId
        ? query(collection(base, 'fabricas', fabricaId, 'tarefas'), orderBy('criadaEm', 'asc'), limitar(50))
        : null,
    [base, fabricaId]
  );
  return usarConsulta<TarefaBase>(consulta);
}

/* Relogio do painel: mantem "parado há 18 min" e o tempo decorrido vivos sem
   depender de nova escrita da ponte. */
export function usarRelogio(intervaloMs = 15_000): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}
