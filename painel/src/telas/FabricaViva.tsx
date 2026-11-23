'use client';

/*
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
import { CommandBox, Pager, StateIcon } from '@/componentes/ds';
import type { EstadoDoPainel } from '@/dados/painel';
import { montarTime, type CartaoDeAgente, type Fluxo, type TimeDaFabrica } from '@/dados/time';
import type { Fabrica } from '@/dados/tradutor';
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
  const agora = usarRelogioFino();
  const time = useMemo<TimeDaFabrica | null>(
    () =>
      fabrica
        ? montarTime({
            linhas: dados.linhas,
            agentePrincipal: fabrica.agent,
            agentesDoProjeto: fabrica.agentesDoProjeto,
            estado: fabrica.state,
            agora
          })
        : null,
    [dados.linhas, fabrica, agora]
  );
  return { dados, time, agora };
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
  const fim = useRef<HTMLDivElement>(null);
  const chat = dados.time?.chat ?? [];
  const ultimo = chat[chat.length - 1]?.id ?? null;
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [ultimo]);
  const trabalhando = dados.time?.coordenador.trabalhando ?? false;

  return (
    <section className={celular ? 'gf-fv-chat gf-fv-chat-cel gf-glass' : 'gf-fv-chat gf-glass'} aria-label="Chat com o Coordenador">
      <div className="gf-fv-chat-topo">
        <span className="title-sm">Chat com o Coordenador</span>
        <span className="caption gf-faint">
          {trabalhando
            ? `${coordenador} está trabalhando com o time`
            : 'Você fala com o coordenador, e ele repassa para o time. Mais antiga em cima.'}
        </span>
      </div>
      <div className="gf-fv-chat-lista">
        {dados.dados.erro ? (
          <Falha mensagem={dados.dados.erro} />
        ) : chat.length === 0 ? (
          <span className="caption gf-faint">
            {dados.dados.carregando ? 'Lendo a conversa na base.' : 'Nenhuma mensagem ainda. Escreva abaixo para o coordenador.'}
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
        <div ref={fim} />
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
      {c.descricao && !principal ? <div className="caption gf-faint gf-fv-desc">{c.descricao}</div> : null}
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

const AGENTES_POR_PAGINA = 7;

export function PalcoDoTime({ time, agora, semRegistro }: { time: TimeDaFabrica; agora: Date; semRegistro: number }) {
  const palco = useRef<HTMLDivElement>(null);
  const coord = useRef<HTMLDivElement | null>(null);
  const cartoes = useRef(new Map<string, HTMLDivElement>());
  const [pagina, setPagina] = useState(1);
  const total = Math.max(1, Math.ceil(time.agentes.length / AGENTES_POR_PAGINA));
  const atual = Math.min(pagina, total);
  const visiveis = time.agentes.slice((atual - 1) * AGENTES_POR_PAGINA, atual * AGENTES_POR_PAGINA);
  const [geo, setGeo] = useState<{ w: number; h: number; tracos: Omit<Traco, 'fluxo'>[] }>({ w: 0, h: 0, tracos: [] });
  const chaveDosNomes = visiveis.map((a) => a.nome).join('|');

  useLayoutEffect(() => {
    const el = palco.current;
    if (!el) return;
    const medir = () => {
      const caixa = el.getBoundingClientRect();
      const c = coord.current?.getBoundingClientRect();
      if (!c) return;
      const x1 = c.left + c.width / 2 - caixa.left;
      const y1 = c.bottom - caixa.top;
      const tracos: Omit<Traco, 'fluxo'>[] = [];
      for (const nome of chaveDosNomes ? chaveDosNomes.split('|') : []) {
        const a = cartoes.current.get(nome)?.getBoundingClientRect();
        if (!a) continue;
        const x2 = a.left + a.width / 2 - caixa.left;
        const y2 = a.top - caixa.top;
        const meio = y1 + (y2 - y1) / 2;
        tracos.push({ nome, d: `M ${x1} ${y1} C ${x1} ${meio}, ${x2} ${meio}, ${x2} ${y2}` });
      }
      setGeo({ w: caixa.width, h: caixa.height, tracos });
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [chaveDosNomes]);

  const fluxoDe = new Map(time.agentes.map((a) => [a.nome, a.fluxo]));

  return (
    <div className="gf-fv-palco" ref={palco}>
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
        {geo.tracos.map((t) => (
          <LinhaDeLuz key={t.nome} t={{ ...t, fluxo: fluxoDe.get(t.nome) ?? 'apagada' }} />
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
        <div className="gf-fv-semtime caption gf-faint">
          Esta fábrica ainda não tem agentes do projeto lidos pela ponte, e o coordenador não passou trabalho a ninguém.
          Quando ele despachar um agente, o cartão dele aparece aqui.
        </div>
      ) : (
        <div className="gf-fv-time" style={{ gridTemplateColumns: `repeat(${visiveis.length}, minmax(0, 1fr))` }}>
          {visiveis.map((a) => (
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
      <div className="gf-fv-palco-pe caption gf-faint">
        <span>
          {`${plural(time.agentes.length, 'agente no time', 'agentes no time')}. Dentro de cada cartão, a ação mais recente fica em cima.`}
          {semRegistro
            ? ` ${plural(semRegistro, 'passo antigo ficou', 'passos antigos ficaram')} sem cartão: foram gravados antes de a ponte registrar qual agente agiu.`
            : ''}
        </span>
        {total > 1 ? <Pager page={atual} total={total} onChange={setPagina} /> : null}
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
    time
      ? `Delegações ao time: ${time.delegacoes}${time.delegacoes ? `, ${time.delegacoesEntregues} entregues` : ''}`
      : null,
    `${estado.ponte.online ? 'Ponte conectada' : 'Ponte offline'}${estado.ponte.maquina ? `, ${estado.ponte.maquina}` : ''}${
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
