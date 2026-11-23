'use client';

/*
 * OST 10, a linha do tempo da fábrica, no computador e no celular.
 *
 * O que o diretor pediu, nas palavras dele: ver a ORDEM DE EXECUÇÃO e os
 * COMANDOS QUE ELE DEU. Por isso esta tela:
 *  - tem UM sentido só, dito no topo: do mais antigo, em cima, para o mais
 *    novo, embaixo. Ela abre rolada até o fim, no que acabou de acontecer;
 *  - destaca cada ordem dele e põe embaixo dela o que a fábrica fez em
 *    resposta, até a próxima ordem;
 *  - diz em cada linha qual evento, o que aconteceu, qual ferramenta, qual
 *    arquivo ou comando, e qual agente agiu, §A.15 na tela;
 *  - carrega o histórico inteiro, aos lotes, com o total contado pela base.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { Button } from '@/componentes/ds';
import { usarAtividade, usarComandosDaFabrica, usarTotalDeAtividade } from '@/dados/ouvintes';
import { horaDaLinha, montarAtividade, type BlocoDaAtividade, type LinhaDaAtividade } from '@/dados/tradutor';
import { chaveDoDia, plural, rotuloDoDia } from '@/formato';
import { Falha, Vazio } from './pecas';

/* Quantos passos o painel lê por vez. O botão do topo traz o lote seguinte,
   até o histórico inteiro. */
export const LOTE_DE_PASSOS = 200;

/* Texto longo aparece cortado aqui, e inteiro com um toque. */
const CORTE_DO_TEXTO = 420;

export function usarLinhaDoTempo(base: Firestore | null, fabricaId: string | null) {
  const [quantos, setQuantos] = useState(LOTE_DE_PASSOS);
  const atividade = usarAtividade(base, fabricaId, quantos);
  const comandos = usarComandosDaFabrica(base, fabricaId);
  const maisNovo = atividade.itens[0]?.id ?? null;
  const total = usarTotalDeAtividade(base, fabricaId, maisNovo);
  /* Completo quando a base devolveu menos do que o pedido, ou quando a conta do
     servidor bate com o que já está na tela. */
  const completo =
    !atividade.carregando && (atividade.itens.length < quantos || (total !== null && atividade.itens.length >= total));
  const montada = useMemo(
    () => montarAtividade(atividade.itens, comandos.itens, completo),
    [atividade.itens, comandos.itens, completo]
  );
  return {
    ...montada,
    carregando: atividade.carregando,
    erro: atividade.erro ?? comandos.erro,
    carregados: atividade.itens.length,
    total,
    completo,
    carregarMais: () => setQuantos((q) => q + LOTE_DE_PASSOS)
  };
}

export type DadosDaLinhaDoTempo = ReturnType<typeof usarLinhaDoTempo>;

function Texto({ texto }: { texto: string }) {
  const [inteiro, setInteiro] = useState(false);
  const longo = texto.length > CORTE_DO_TEXTO;
  return (
    <div className="gf-lt-texto">
      {longo && !inteiro ? `${texto.slice(0, CORTE_DO_TEXTO)}…` : texto}
      {longo ? (
        <button type="button" className="gf-lt-mais caption" onClick={() => setInteiro(!inteiro)}>
          {inteiro ? 'mostrar menos' : 'mostrar tudo'}
        </button>
      ) : null}
    </div>
  );
}

function Agente({ agente, principal }: { agente: string | null; principal: string }) {
  return agente ? (
    <span className="gf-lt-chip gf-lt-chip-sub">{`subagente ${agente}`}</span>
  ) : (
    <span className="gf-lt-chip">{principal}</span>
  );
}

function Passo({ l, principal, atual }: { l: LinhaDaAtividade; principal: string; atual: boolean }) {
  return (
    <li
      className={[
        'gf-lt-passo',
        `gf-lt-${l.tipo}`,
        l.erro ? 'gf-lt-erro' : '',
        l.agente ? 'gf-lt-do-sub' : '',
        atual ? 'gf-lt-atual' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="mono gf-lt-hora">{horaDaLinha(l)}</span>
      <div className="gf-lt-corpo">
        <div className="gf-lt-cabeca">
          <span className="gf-lt-evento caption">{l.evento}</span>
          <Agente agente={l.agente} principal={principal} />
        </div>
        <div className={atual ? 'body-strong' : 'body'}>{l.titulo}</div>
        {l.detalhe ? <div className="mono gf-muted gf-lt-detalhe">{l.detalhe}</div> : null}
        {l.texto ? <Texto texto={l.texto} /> : null}
      </div>
    </li>
  );
}

function Ordem({ l }: { l: LinhaDaAtividade }) {
  return (
    <div className="gf-lt-ordem">
      <div className="gf-lt-cabeca">
        <span className="mono gf-lt-hora">{horaDaLinha(l)}</span>
        <span className="gf-lt-evento caption">{l.evento}</span>
        {l.situacao ? <span className="caption gf-muted">{l.situacao}</span> : null}
      </div>
      <div className="body-strong">{l.titulo}</div>
      {l.texto ? <Texto texto={l.texto} /> : null}
    </div>
  );
}

/* Separador de dia: aparece no começo e sempre que o dia muda. */
function Dia({ quando, agora }: { quando: Date | null; agora: Date }) {
  return <div className="gf-lt-dia caption">{quando ? rotuloDoDia(quando, agora) : 'Sem hora gravada'}</div>;
}

export function LinhaDoTempo({
  dados,
  agentePrincipal,
  viva,
  agora
}: {
  dados: DadosDaLinhaDoTempo;
  agentePrincipal: string;
  viva: boolean;
  agora: Date;
}) {
  const rolagem = useRef<HTMLDivElement>(null);
  const colado = useRef(true);
  const ultimo = dados.linhas[dados.linhas.length - 1]?.id ?? null;

  /* Abre no fim, e segue o fim enquanto o diretor não rolar para cima. */
  useEffect(() => {
    const el = rolagem.current;
    if (el && colado.current) el.scrollTop = el.scrollHeight;
  }, [ultimo]);

  if (dados.erro) return <Falha mensagem={dados.erro} />;
  if (dados.linhas.length === 0) {
    return (
      <Vazio
        titulo={dados.carregando ? 'Lendo a atividade' : 'Nenhum passo registrado'}
        detalhe={
          dados.carregando
            ? 'O painel está abrindo o ouvinte ao vivo desta fábrica.'
            : 'Esta fábrica ainda não registrou passos na base. Cada ordem sua e cada passo dela aparecem aqui, do mais antigo, em cima, para o mais novo, embaixo.'
        }
      />
    );
  }

  const contagem =
    dados.total === null
      ? plural(dados.carregados, 'passo carregado', 'passos carregados')
      : dados.completo
        ? `${plural(dados.total, 'passo registrado', 'passos registrados')}, todos na tela`
        : `${plural(dados.total, 'passo registrado', 'passos registrados')}, ${dados.carregados} na tela`;

  let diaAnterior: string | null = null;
  const dia = (quando: Date | null) => {
    const chave = chaveDoDia(quando);
    if (chave === diaAnterior) return null;
    diaAnterior = chave;
    return <Dia key={`dia-${chave}`} quando={quando} agora={agora} />;
  };

  return (
    <div
      className="gf-lt"
      ref={rolagem}
      onScroll={(e) => {
        const el = e.currentTarget;
        colado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
    >
      <div className="gf-lt-topo caption gf-muted">
        <span>{`Ordem de execução: do mais antigo, em cima, para o mais novo, embaixo. ${contagem}.`}</span>
        {!dados.completo ? (
          <Button variant="secondary" onClick={dados.carregarMais}>
            Carregar passos mais antigos
          </Button>
        ) : null}
      </div>
      {dados.blocos.map((b: BlocoDaAtividade, i) => (
        <section key={b.ordem?.id ?? `inicio-${i}`} className="gf-lt-bloco">
          {b.ordem ? (
            <>
              {dia(b.ordem.quando)}
              <Ordem l={b.ordem} />
            </>
          ) : null}
          {b.passos.length > 0 ? (
            <ol className="gf-lt-passos">
              {b.passos.map((l) => (
                <PassoComDia key={l.id} l={l} dia={dia(l.quando)} principal={agentePrincipal} atual={viva && l.id === ultimo} />
              ))}
            </ol>
          ) : b.ordem ? (
            <div className="caption gf-faint gf-lt-sem-passo">A fábrica ainda não registrou passo depois desta ordem.</div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function PassoComDia({
  l,
  dia,
  principal,
  atual
}: {
  l: LinhaDaAtividade;
  dia: React.ReactNode;
  principal: string;
  atual: boolean;
}) {
  return (
    <>
      {dia ? <li className="gf-lt-dia-item">{dia}</li> : null}
      <Passo l={l} principal={principal} atual={atual} />
    </>
  );
}
