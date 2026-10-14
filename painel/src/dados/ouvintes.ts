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
  limit as limitar,
  onSnapshot,
  orderBy,
  query,
  type Firestore,
  type FirestoreError,
  type Query
} from 'firebase/firestore';
import type { AprovacaoBase, AtividadeBase, FabricaBase, MaquinaBase, TarefaBase } from './tipos';

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

export function usarAtividade(base: Firestore | null, fabricaId: string | null, quantos: number): Colecao<AtividadeBase> {
  const consulta = useMemo(
    () =>
      base && fabricaId
        ? query(collection(base, 'fabricas', fabricaId, 'atividade'), orderBy('seq', 'desc'), limitar(quantos))
        : null,
    [base, fabricaId, quantos]
  );
  return usarConsulta<AtividadeBase>(consulta);
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
