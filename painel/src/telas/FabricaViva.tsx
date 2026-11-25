'use client';

/*
 * OST 13, DISPOSIÇÃO NOVA, pedido do diretor: "a tela tem de aproveitar a área
 * inteira". No computador, o chat ocupa a coluna da esquerda, um terço, de cima
 * a baixo; a direita, dois terços, tem o coordenador em largura inteira e os
 * agentes embaixo em grade de três por linha, ligados a ele pelas linhas de
 * luz, que correm pelos vãos entre os cartões. Sem parágrafo explicativo no
 * meio da tela. O celular segue como estava: chat em cima, time embaixo.
 *
 * OST 11, A FÁBRICA VIVA. O posto de comando, do jeito que o diretor desenhou:
 *
 *   - no topo, o CHAT COM O COORDENADOR. É ali que o diretor conversa: manda
 *     para o coordenador, o coordenador repassa para o time, e a resposta do
 *     coordenador aparece ali também. Toma o lugar da caixa de ordem;
 *   - embaixo, no centro, o cartão do COORDENADOR;
 *   - embaixo dele, um cartão por AGENTE da fábrica, lado a lado, ligados ao
 *     coordenador por linhas. Dentro de cada cartão, o que aquele agente fez,
 *     em português claro;
 *   - as LINHAS acendem quando existe troca de verdade: a luz desce quando o
 *     coordenador passa trabalho, vai e volta enquanto o agente trabalha, e
 *     sobe quando ele entrega. Agente parado fica apagado.
 *
 * Toma o lugar da lista de atividade por ordem de hora, que saiu, item 6.
 * Os nomes dos agentes vêm do projeto, lidos pela ponte, item 3: nada de nome
 * fixo aqui.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { CommandBox, StateIcon } from '@/componentes/ds';
import type { EstadoDoPainel } from '@/dados/painel';
import { usarConversa } from '@/dados/ouvintes';
import { montarTime, type CartaoDeAgente, type Fluxo, type TimeDaFabrica } from '@/dados/time';
import { traduzirComando, traduzirPasso, type Fabrica } from '@/dados/tradutor';
import { consumoEmPartes, horaCurta, plural, quandoCurto, tempoDecorrido } from '@/formato';
import { usarLinhaDoTempo } from './LinhaDoTempo';
import { Falha, Vazio } from './pecas';

/* A luz das linhas precisa de relógio mais fino que o do painel, que bate a
   cada 15 segundos. */
function usarRelogioFino(ms = 2000): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return agora;
}

export function usarTimeDaFabrica(base: Firestore | null, fabrica: Fabrica | null) {
  const dados = usarLinhaDoTempo(base, fabrica?.id ?? null);
  /* OST 13: a conversa inteira, numa escuta própria, sem o limite de 200. */
  const conversaDaBase = usarConversa(base, fabrica?.id ?? null);
  const conversa = useMemo(
    () => [...conversaDaBase.itens.map(traduzirPasso), ...dados.comandos.map(traduzirComando)],
    [conversaDaBase.itens, dados.comandos]
  );
  const agora = usarRelogioFino();
  const time = useMemo<TimeDaFabrica | null>(
    () =>
      fabrica
        ? montarTime({
            linhas: dados.linhas,
            conversa,
            agentePrincipal: fabrica.agent,
            agentesDoProjeto: fabrica.agentesDoProjeto,
            estado: fabrica.state,
            agora
          })
        : null,
    [dados.linhas, conversa, fabrica, agora]
  );
  const chat = {
    erro: conversaDaBase.erro ?? dados.erro,
    carregando: conversaDaBase.carregando || dados.carregando
  };
  return { dados, time, agora, chat };
}

export type DadosDoTime = ReturnType<typeof usarTimeDaFabrica>;

/* ---------- chat ---------- */

export function ChatComCoordenador({
  dados,
  coordenador,
  caixa,
  celular
}: {
  dados: DadosDoTime;
  coordenador: string;
  caixa: {
    motivo: string | null;
    ordem: { erro: string | null; limparErro: () => void };
    enviar: (texto: string) => Promise<boolean>;
  };
  celular?: boolean;
}) {
  const lista = useRef<HTMLDivElement>(null);
  const colado = useRef(true);
  const chat = dados.time?.chat ?? [];
  const ultimo = chat[chat.length - 1]?.id ?? null;
  const trabalhando = dados.time?.coordenador.trabalhando ?? false;
  /* Abre no fim e segue o fim, enquanto o diretor não rolar para cima para ler
     uma resposta antiga. */
  useEffect(() => {
    const el = lista.current;
    if (el && colado.current) el.scrollTop = el.scrollHeight;
  }, [ultimo, trabalhando]);

  return (
    <section className={celular ? 'gf-fv-chat gf-fv-chat-cel gf-glass' : 'gf-fv-chat gf-glass'} aria-label="Chat com o Coordenador">
      <div className="gf-fv-chat-topo">
        <span className="title-sm">Chat com o Coordenador</span>
        {trabalhando ? <span className="caption gf-fv-chat-vivo">{`${coordenador} trabalhando`}</span> : null}
        {chat.length ? <span className="caption gf-faint gf-push">{plural(chat.length, 'mensagem', 'mensagens')}</span> : null}
      </div>
      <div
        className="gf-fv-chat-lista"
        ref={lista}
        onScroll={(e) => {
          const el = e.currentTarget;
          colado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
      >
        {dados.chat.erro ? (
          <Falha mensagem={dados.chat.erro} />
        ) : chat.length === 0 ? (
          <span className="caption gf-faint">
            {dados.chat.carregando ? 'Lendo a conversa na base.' : 'Nenhuma mensagem ainda. Escreva abaixo para o coordenador.'}
          </span>
        ) : (
          chat.map((m) => (
            <div key={m.id} className={`gf-fv-msg gf-fv-msg-${m.de}`}>
              <div className="caption gf-fv-msg-de">
                {m.de === 'diretor' ? 'Você' : coordenador}
                <span className="gf-faint">{` · ${m.quando ? quandoCurto(m.quando, dados.agora) : 'sem hora'}`}</span>
                {m.situacao ? <span className="gf-faint">{` · ${m.situacao}`}</span> : null}
              </div>
              <div className="body gf-fv-msg-texto">{m.texto}</div>
            </div>
          ))
        )}
        {trabalhando ? (
          <div className="gf-fv-msg gf-fv-msg-coordenador gf-fv-digitando" aria-live="polite">
            <span className="gf-fv-ponto" />
            <span className="gf-fv-ponto" />
            <span className="gf-fv-ponto" />
          </div>
        ) : null}
      </div>
      <CommandBox
        touch={celular}
        placeholder="Escreva para o coordenador"
        disabledReason={caixa.motivo}
        error={caixa.ordem.erro}
        onDismissError={caixa.ordem.limparErro}
        onSend={caixa.enviar}
      />
    </section>
  );
}

/* ---------- cartão ---------- */

function situacaoDoCartao(c: CartaoDeAgente, agora: Date): string {
  if (c.trabalhando) return c.fluxo === 'ida' ? 'recebendo trabalho agora' : 'trabalhando agora';
  if (c.fluxo === 'volta') return 'acabou de entregar';
  if (!c.ultimaVez) return 'ainda não agiu nesta fábrica';
  return `parado, última ação ${quandoCurto(c.ultimaVez, agora)}`;
}

export function CartaoDoAgente({
  c,
  agora,
  principal,
  refDoCartao
}: {
  c: CartaoDeAgente;
  agora: Date;
  principal?: boolean;
  refDoCartao?: (el: HTMLDivElement | null) => void;
}) {
  const classes = ['gf-fv-cartao', 'gf-glass'];
  if (principal) classes.push('gf-fv-cartao-coord');
  if (c.trabalhando) classes.push('gf-fv-vivo');
  else if (c.fluxo !== 'volta') classes.push('gf-fv-quieto');
  return (
    <div ref={refDoCartao} className={classes.join(' ')}>
      <div className="gf-fv-cartao-topo">
        <span className={c.trabalhando ? 'gf-s-running' : 'gf-s-idle'} style={{ color: 'var(--s)', display: 'flex' }}>
          <StateIcon state={c.trabalhando ? 'running' : 'idle'} size={12} />
        </span>
        <span className="title-sm gf-fv-nome">{principal ? `Coordenador` : c.rotulo}</span>
        {c.totalDeAcoes ? <span className="caption gf-faint gf-push">{plural(c.totalDeAcoes, 'ação', 'ações')}</span> : null}
      </div>
      <div className="caption gf-muted">{situacaoDoCartao(c, agora)}</div>
      {c.descricao && !principal ? (
        <div className="caption gf-faint gf-fv-desc" title={c.descricao}>
          {c.descricao}
        </div>
      ) : null}
      <ul className="gf-fv-acoes" aria-label={`O que ${principal ? 'o coordenador' : c.rotulo} fez, mais recente em cima`}>
        {c.acoes.length === 0 ? (
          <li className="caption gf-faint">Nada ainda.</li>
        ) : (
          c.acoes.map((a) => (
            <li key={a.id} className={a.erro ? 'gf-fv-acao gf-fv-acao-erro' : 'gf-fv-acao'}>
              <span className="mono gf-faint gf-fv-hora">{horaCurta(a.quando)}</span>
              <span className="caption">
                <span className="gf-fv-frase">{a.frase}</span>
                {a.objeto ? <span className="gf-muted">{` ${a.objeto}`}</span> : null}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/* ---------- linhas de luz ---------- */

interface Traco {
  nome: string;
  d: string;
  fluxo: Fluxo;
}

function LinhaDeLuz({ t }: { t: Traco }) {
  return (
    <g className={`gf-fv-linha gf-fv-${t.fluxo}`}>
      <path d={t.d} pathLength={100} className="gf-fv-fio" />
      {t.fluxo === 'apagada' ? null : (
        <>
          <path d={t.d} pathLength={100} className="gf-fv-aceso" />
          {t.fluxo !== 'volta' ? <path d={t.d} pathLength={100} className="gf-fv-luz gf-fv-luz-ida" /> : null}
          {t.fluxo !== 'ida' ? <path d={t.d} pathLength={100} className="gf-fv-luz gf-fv-luz-volta" /> : null}
        </>
      )}
    </g>
  );
}

/*
 * Caminho das linhas na grade de três por linha. A linha sai do pé do
 * coordenador, desce até o vão entre ele e a primeira linha de cartões e, para
 * quem está nas linhas de baixo, corre pelo vão entre as colunas e pelo vão
 * entre as linhas, sem passar por cima de cartão nenhum. Cantos arredondados.
 */
type Ponto = [number, number];

function caminhoComCantos(pontos: Ponto[], raio = 10): string {
  const limpos = pontos.filter((p, i) => i === 0 || p[0] !== pontos[i - 1][0] || p[1] !== pontos[i - 1][1]);
  if (limpos.length < 2) return '';
  let d = `M ${limpos[0][0]} ${limpos[0][1]}`;
  for (let i = 1; i < limpos.length - 1; i++) {
    const [ax, ay] = limpos[i - 1];
    const [px, py] = limpos[i];
    const [bx, by] = limpos[i + 1];
    const la = Math.hypot(px - ax, py - ay);
    const lb = Math.hypot(bx - px, by - py);
    const r = Math.min(raio, la / 2, lb / 2);
    const x1 = px - ((px - ax) / (la || 1)) * r;
    const y1 = py - ((py - ay) / (la || 1)) * r;
    const x2 = px + ((bx - px) / (lb || 1)) * r;
    const y2 = py + ((by - py) / (lb || 1)) * r;
    d += ` L ${x1} ${y1} Q ${px} ${py} ${x2} ${y2}`;
  }
  const ultimo = limpos[limpos.length - 1];
  return `${d} L ${ultimo[0]} ${ultimo[1]}`;
}

interface Caixa {
  nome: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function tracarLinhas(coord: Omit<Caixa, 'nome'>, cartoes: Caixa[]): Omit<Traco, 'fluxo'>[] {
  if (!cartoes.length) return [];
  /* Linhas da grade pela altura do topo, colunas pela posição na primeira. */
  const topos: number[] = [];
  for (const c of [...cartoes].sort((a, b) => a.top - b.top)) {
    if (!topos.length || c.top - topos[topos.length - 1] > 4) topos.push(c.top);
  }
  const linhaDe = (c: Caixa) => topos.findIndex((t) => Math.abs(c.top - t) <= 4);
  const fundoDaLinha = topos.map((_, i) => Math.max(...cartoes.filter((c) => linhaDe(c) === i).map((c) => c.bottom)));
  const primeira = cartoes.filter((c) => linhaDe(c) === 0).sort((a, b) => a.left - b.left);
  const vaos: number[] = [];
  for (let i = 0; i < primeira.length - 1; i++) vaos.push((primeira[i].right + primeira[i + 1].left) / 2);
  const meio = (c: { left: number; right: number }) => (c.left + c.right) / 2;
  const x0 = meio(coord);
  const y0 = coord.bottom;
  const yA = (coord.bottom + topos[0]) / 2;
  return cartoes.map((c) => {
    const r = linhaDe(c);
    const cx = meio(c);
    if (r <= 0 || !vaos.length) {
      return { nome: c.nome, d: caminhoComCantos([[x0, y0], [x0, yA], [cx, yA], [cx, c.top]]) };
    }
    /* Coluna pela proximidade com os cartões da primeira linha. */
    let col = 0;
    primeira.forEach((p, i) => {
      if (Math.abs(meio(p) - cx) < Math.abs(meio(primeira[col]) - cx)) col = i;
    });
    const gx = vaos[Math.min(Math.max(col - 1, 0), vaos.length - 1)];
    const yR = (fundoDaLinha[r - 1] + topos[r]) / 2;
    return {
      nome: c.nome,
      d: caminhoComCantos([[x0, y0], [x0, yA], [gx, yA], [gx, yR], [cx, yR], [cx, c.top]])
    };
  });
}

export function PalcoDoTime({ time, agora }: { time: TimeDaFabrica; agora: Date }) {
  const conteudo = useRef<HTMLDivElement>(null);
  const coord = useRef<HTMLDivElement | null>(null);
  const cartoes = useRef(new Map<string, HTMLDivElement>());
  const [geo, setGeo] = useState<{ w: number; h: number; tracos: Omit<Traco, 'fluxo'>[] }>({ w: 0, h: 0, tracos: [] });
  const chaveDosNomes = time.agentes.map((a) => a.nome).join('|');

  useLayoutEffect(() => {
    const el = conteudo.current;
    if (!el) return;
    const medir = () => {
      const caixa = el.getBoundingClientRect();
      const c = coord.current?.getBoundingClientRect();
      if (!c) return;
      const rel = (r: DOMRect) => ({
        left: r.left - caixa.left,
        right: r.right - caixa.left,
        top: r.top - caixa.top,
        bottom: r.bottom - caixa.top
      });
      const caixas: Caixa[] = [];
      for (const nome of chaveDosNomes ? chaveDosNomes.split('|') : []) {
        const a = cartoes.current.get(nome)?.getBoundingClientRect();
        if (a) caixas.push({ nome, ...rel(a) });
      }
      setGeo({ w: caixa.width, h: caixa.height, tracos: tracarLinhas(rel(c), caixas) });
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [chaveDosNomes]);

  const fluxoDe = new Map(time.agentes.map((a) => [a.nome, a.fluxo]));
  /* As linhas dividem os vãos: a apagada vai por baixo, a acesa por cima. */
  const tracos = geo.tracos
    .map((t) => ({ ...t, fluxo: fluxoDe.get(t.nome) ?? ('apagada' as Fluxo) }))
    .sort((a, b) => Number(a.fluxo !== 'apagada') - Number(b.fluxo !== 'apagada'));

  return (
    <div className="gf-fv-palco">
      <div className="gf-fv-palco-conteudo" ref={conteudo}>
        <svg className="gf-fv-svg" width={geo.w} height={geo.h} aria-hidden>
          <defs>
            <filter id="gf-fv-brilho" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {tracos.map((t) => (
            <LinhaDeLuz key={t.nome} t={t} />
          ))}
        </svg>
        <div className="gf-fv-linha-coord">
          <CartaoDoAgente
            c={time.coordenador}
            agora={agora}
            principal
            refDoCartao={(el) => {
              coord.current = el;
            }}
          />
        </div>
        {time.agentes.length === 0 ? (
          <div className="gf-fv-semtime caption gf-faint">Nenhum agente no time ainda.</div>
        ) : (
          <div className="gf-fv-time">
            {time.agentes.map((a) => (
              <CartaoDoAgente
                key={a.nome}
                c={a}
                agora={agora}
                refDoCartao={(el) => {
                  if (el) cartoes.current.set(a.nome, el);
                  else cartoes.current.delete(a.nome);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- celular ---------- */

/* No celular não cabe o palco lado a lado. Os cartões ficam em coluna, cada um
   com a luz própria na borda esquerda, e o que trabalha agora sobe para o
   topo: em tela pequena, quem está fazendo o quê é o que importa. */
export function TimeNoCelular({ time, agora }: { time: TimeDaFabrica; agora: Date }) {
  const ordem = [...time.agentes].sort(
    (a, b) => Number(b.trabalhando) - Number(a.trabalhando) || (b.ultimaVez?.getTime() ?? 0) - (a.ultimaVez?.getTime() ?? 0)
  );
  return (
    <div className="gf-fv-cel">
      <CartaoDoAgente c={time.coordenador} agora={agora} principal />
      {ordem.map((a) => (
        <div key={a.nome} className={`gf-fv-cel-item gf-fv-${a.fluxo}`}>
          <span className="gf-fv-cel-luz" aria-hidden />
          <CartaoDoAgente c={a} agora={agora} />
        </div>
      ))}
    </div>
  );
}

/* ---------- rodapé ---------- */

/*
 * Item 7 e 8 da OST 11: "Tarefa" e "Consumo" viram uma linha discreta, e
 * "Tarefa" e "Tarefas" ganham nomes que não se confundem: o tempo da RODADA em
 * curso, e as DELEGAÇÕES que o coordenador fez ao time. A máquina vira detalhe
 * pequeno, item 10.
 */
export function RodapeDaFabrica({ fabrica, estado, time }: { fabrica: Fabrica; estado: EstadoDoPainel; time: TimeDaFabrica | null }) {
  const uso = consumoEmPartes(fabrica.tokens);
  const partes = [
    fabrica.taskMs === null
      ? 'Rodada: não medida'
      : `${fabrica.tarefaAndando ? 'Rodada em curso' : 'Última rodada'}: ${tempoDecorrido(fabrica.taskMs)}`,
    fabrica.tokens === null ? 'Consumo: não medido' : `Consumo: ${uso.valor} ${uso.unidade}`.trim(),
    time ? plural(time.agentes.length, 'agente no time', 'agentes no time') : null,
    time
      ? `Delegações ao time: ${time.delegacoes}${time.delegacoes ? `, ${time.delegacoesEntregues} entregues` : ''}`
      : null,
    time?.semRegistro
      ? plural(time.semRegistro, 'passo antigo sem agente registrado', 'passos antigos sem agente registrado')
      : null,
    /* OST 15: a ponte da máquina desta fábrica, não a geral. Sem máquina
       conhecida, a regra de antes. */
    fabrica.maquina
      ? `Ponte ${fabrica.maquina.online ? 'conectada' : 'offline'}, ${fabrica.maquina.chamada}${
          fabrica.maquina.versao ? `, versão ${fabrica.maquina.versao}` : ''
        }`
      : fabrica.maquinaId
        ? 'Ponte offline, a máquina desta fábrica não aparece na base'
        : `${estado.ponte.online ? 'Ponte conectada' : 'Ponte offline'}${estado.ponte.maquina ? `, ${estado.ponte.maquina}` : ''}${
          estado.ponte.versao ? `, versão ${estado.ponte.versao}` : ''
        }`,
    fabrica.nasceuNoPainel ? 'nasceu pelo painel' : 'aberta na mão'
  ].filter(Boolean);
  return <div className="gf-fv-rodape caption gf-faint">{partes.join(' · ')}</div>;
}

export function SemFabrica({ carregando }: { carregando: boolean }) {
  return (
    <Vazio
      titulo={carregando ? 'Lendo a fábrica' : 'Fábrica sem atividade'}
      detalhe="Quando o coordenador agir, o time aparece aqui."
    />
  );
}
