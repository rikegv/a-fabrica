'use client';

/*
 * OST 16, CONFIGURAÇÕES, F7: a situação da ponte e os crachás das máquinas.
 *
 * O que pede ação vem primeiro: pedidos de crachá abertos, com o código grande,
 * em âmbar. Depois os crachás emitidos, ativos em verde e revogados em cinza.
 * Depois a situação de cada ponte.
 *
 * Regras desta tela, docs/ost16-contrato.md:
 *  - N1: emitir mostra o código e o começo do uid e pede ao diretor conferir no
 *    terminal da máquina. Pedido duplicado (mesma máquina ou mesmo código) não
 *    emite e diz por quê. A camada de escrita confere de novo, lendo a base.
 *  - N2: pedidos dos últimos 15 minutos, no máximo 20.
 *  - N3: máquina com crachá ativo: a tela avisa antes que emitir revoga o antigo,
 *    na mesma gravação. Revogar revoga todos os ativos da máquina.
 *  - N4: todo texto da base entra como texto do React. Nenhum link, nenhum HTML.
 *  - N5: toda ação responde na tela, §A.22; nenhum travessão, §A.11.
 *
 * Projetos cadastrados e avisos no celular continuam fora desta OST, §A.12, e a
 * tela diz isso no pé.
 */

import { useCallback, useMemo, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { Button, StateBadge, cx } from '@/componentes/ds';
import {
  LIMITE_DE_PEDIDOS,
  ativosDaMaquina,
  barreiraDaEmissao,
  chamadaDoCracha,
  chamadaDoPedido,
  fraseDaBarreira,
  inicioDaJanela,
  maquinaCurta,
  ordenarCrachas,
  pedidosAbertos,
  restaDoPedido,
  traduzirCracha,
  traduzirPedido,
  uidCurto,
  type Cracha,
  type PedidoDeCracha
} from '@/dados/crachas';
import { emitirCracha, revogarCrachasDaMaquina, type ContextoDeEscrita } from '@/dados/escritas';
import { usarCrachas, usarPedidosDeCracha } from '@/dados/ouvintes';
import type { EstadoDoPainel } from '@/dados/painel';
import type { PonteDaMaquina } from '@/dados/tradutor';
import { desdeQuando, plural, quandoCurto, tempoParado } from '@/formato';
import { Confirmacao, ErroDeEscrita, Panel } from './pecas';
import { usarOrdem, type Ordem } from './usarOrdem';

/* ---------- dados da tela ---------- */

interface DadosDosCrachas {
  carregando: boolean;
  erroDeLeitura: string | null;
  abertos: PedidoDeCracha[];
  listaCheia: boolean;
  crachas: Cracha[];
  todosOsPedidos: PedidoDeCracha[];
}

/* A leitura negada aqui quase sempre quer dizer regra nova ainda não publicada. */
function explicarLeitura(erro: string | null): string | null {
  if (!erro) return null;
  if (/recusou a leitura/.test(erro)) {
    return 'A base não deixou ler os crachás. O motivo mais provável é a regra nova da OST 16 ainda não estar publicada. Enquanto ela não for publicada, nenhum crachá pode ser emitido nem revogado. As pontes seguem funcionando como hoje.';
  }
  return erro;
}

function usarDadosDosCrachas(base: Firestore | null, agora: Date): DadosDosCrachas {
  /* Início da janela arredondado ao minuto, para a escuta não reabrir a cada
     batida do relógio. O corte exato de 15 minutos é refeito em memória. */
  const inicio = inicioDaJanela(agora);
  const desdeMs = Math.floor(inicio.getTime() / 60_000) * 60_000;
  const desde = useMemo(() => (base ? new Date(desdeMs) : null), [base, desdeMs]);
  const crachasLidos = usarCrachas(base, true);
  const pedidosLidos = usarPedidosDeCracha(base, desde, LIMITE_DE_PEDIDOS);

  return useMemo(() => {
    const crachas = ordenarCrachas(crachasLidos.itens.map(traduzirCracha));
    const todosOsPedidos = pedidosLidos.itens.map(traduzirPedido);
    return {
      carregando: crachasLidos.carregando || pedidosLidos.carregando,
      erroDeLeitura: explicarLeitura(pedidosLidos.erro ?? crachasLidos.erro),
      abertos: pedidosAbertos(todosOsPedidos, crachas, agora),
      listaCheia: pedidosLidos.itens.length >= LIMITE_DE_PEDIDOS,
      crachas,
      todosOsPedidos
    };
  }, [crachasLidos, pedidosLidos, agora]);
}

/* ---------- ações ---------- */

interface AcoesDosCrachas {
  ordem: Ordem;
  emitindo: PedidoDeCracha | null;
  revogando: { maquinaId: string; chamada: string; quantos: number } | null;
  pedirEmissao: (p: PedidoDeCracha) => void;
  pedirRevogacao: (c: Cracha, chamada: string) => void;
  confirmarEmissao: () => void;
  confirmarRevogacao: () => void;
  desistir: () => void;
}

function usarAcoesDosCrachas(
  escrita: ContextoDeEscrita,
  dados: DadosDosCrachas,
  avisar: (mensagem: string) => void
): AcoesDosCrachas {
  const ordem = usarOrdem(avisar);
  const [emitindo, setEmitindo] = useState<PedidoDeCracha | null>(null);
  const [revogando, setRevogando] = useState<AcoesDosCrachas['revogando']>(null);

  const desistir = useCallback(() => {
    setEmitindo(null);
    setRevogando(null);
    ordem.limparErro();
  }, [ordem]);

  const confirmarEmissao = useCallback(() => {
    const pedido = emitindo;
    if (!pedido) return;
    const antigos = ativosDaMaquina(dados.crachas, pedido.maquinaId).length;
    const chamada = chamadaDoPedido(pedido);
    void (async () => {
      let revogados = antigos;
      const deu = await ordem.enviar(async () => {
        const r = await emitirCracha(escrita, { pedido, conferido: true });
        if (r.ok) revogados = r.revogados;
        return r;
      }, `Crachá emitido para ${chamada}. O terminal da máquina diz "crachá emitido" em instantes.`);
      if (deu) {
        if (revogados > 0) {
          avisar(
            `Crachá emitido para ${chamada}. ${plural(revogados, 'crachá antigo foi revogado', 'crachás antigos foram revogados')} na mesma gravação.`
          );
        }
        setEmitindo(null);
      }
    })();
  }, [emitindo, dados.crachas, escrita, ordem, avisar]);

  const confirmarRevogacao = useCallback(() => {
    const alvo = revogando;
    if (!alvo) return;
    void (async () => {
      let revogados = alvo.quantos;
      const deu = await ordem.enviar(async () => {
        const r = await revogarCrachasDaMaquina(escrita, { maquinaId: alvo.maquinaId });
        if (r.ok) revogados = r.revogados;
        return r;
      }, `Crachá de ${alvo.chamada} revogado. A máquina perde o acesso à base agora.`);
      if (deu) {
        if (revogados > 1) {
          avisar(`${plural(revogados, 'crachá revogado', 'crachás revogados')} de ${alvo.chamada}. A máquina perde o acesso à base agora.`);
        }
        setRevogando(null);
      }
    })();
  }, [revogando, escrita, ordem, avisar]);

  return {
    ordem,
    emitindo,
    revogando,
    pedirEmissao: (p) => {
      ordem.limparErro();
      setEmitindo(p);
    },
    pedirRevogacao: (c, chamada) => {
      ordem.limparErro();
      setRevogando({ maquinaId: c.maquinaId, chamada, quantos: ativosDaMaquina(dados.crachas, c.maquinaId).length });
    },
    confirmarEmissao,
    confirmarRevogacao,
    desistir
  };
}

/* ---------- peças ---------- */

function Codigo({ codigo, grande }: { codigo: string; grande?: boolean }) {
  return (
    <span className={cx('gf-cr-codigo', 'mono', grande && 'gf-cr-codigo-grande')} aria-label={`código ${codigo.split('').join(' ')}`}>
      {codigo}
    </span>
  );
}

function CartaoDoPedido({
  pedido,
  dados,
  agora,
  celular,
  ocupado,
  aoEmitir
}: {
  pedido: PedidoDeCracha;
  dados: DadosDosCrachas;
  agora: Date;
  celular?: boolean;
  ocupado: boolean;
  aoEmitir: () => void;
}) {
  /* A barreira sem a conferência: o que barra ANTES de o diretor abrir a
     confirmação. A conferência é a própria confirmação. */
  const barreira = barreiraDaEmissao(pedido, {
    abertos: dados.abertos,
    crachas: dados.crachas,
    agora,
    listaCheia: dados.listaCheia,
    conferido: true
  });
  const antigos = ativosDaMaquina(dados.crachas, pedido.maquinaId).length;
  const resta = restaDoPedido(pedido, agora);
  const idade = pedido.criadoEm ? agora.getTime() - pedido.criadoEm.getTime() : null;

  return (
    <li className={cx('gf-cr-pedido', barreira && 'gf-cr-pedido-barrado')}>
      <div className="gf-cr-linha">
        <Codigo codigo={pedido.codigo || '??????'} />
        <div className="gf-cr-quem">
          <span className="body-strong truncate">{chamadaDoPedido(pedido)}</span>
          <span className="caption gf-muted truncate">{`uid começa com ${uidCurto(pedido.uid)}`}</span>
        </div>
        <StateBadge state={barreira ? 'failed' : 'approval'} label={barreira ? 'barrado' : 'esperando você'} />
      </div>
      <dl className="gf-cr-campos caption">
        <dt className="gf-faint">máquina</dt>
        <dd className="mono truncate">{maquinaCurta(pedido.maquinaId) || 'sem máquina'}</dd>
        <dt className="gf-faint">nome</dt>
        <dd className="truncate">{pedido.nome ?? 'sem nome'}</dd>
        <dt className="gf-faint">rótulo</dt>
        <dd className="truncate">{pedido.rotulo ?? 'sem rótulo'}</dd>
        <dt className="gf-faint">pedido</dt>
        <dd>{`${desdeQuando(idade)}, vence em ${tempoParado(Math.max(0, resta))}`}</dd>
      </dl>
      {barreira ? (
        <ErroDeEscrita mensagem={fraseDaBarreira(barreira)} />
      ) : antigos > 0 ? (
        <p className="caption gf-cr-aviso">
          {`Esta máquina já tem ${plural(antigos, 'crachá ativo', 'crachás ativos')}. Emitir revoga ${antigos === 1 ? 'o antigo' : 'os antigos'} na mesma gravação.`}
        </p>
      ) : null}
      <div className="gf-cr-acao">
        <Button
          variant="primary"
          size={celular ? 'touch' : undefined}
          block={celular}
          disabled={Boolean(barreira) || ocupado}
          onClick={aoEmitir}
        >
          Emitir crachá
        </Button>
      </div>
    </li>
  );
}

function LinhaDoCracha({
  cracha,
  chamada,
  agora,
  celular,
  ocupado,
  aoRevogar
}: {
  cracha: Cracha;
  chamada: string;
  agora: Date;
  celular?: boolean;
  ocupado: boolean;
  aoRevogar: () => void;
}) {
  return (
    <li className={cx('gf-cr-cracha', !cracha.ativo && 'gf-cr-cracha-revogado')}>
      <div className="gf-cr-linha">
        <div className="gf-cr-quem">
          <span className="body-strong truncate">{chamada}</span>
          <span className="caption gf-muted mono truncate">{`${maquinaCurta(cracha.maquinaId) || 'sem máquina'} · uid ${uidCurto(cracha.uid)}`}</span>
        </div>
        <StateBadge state={cracha.ativo ? 'done' : 'offline'} label={cracha.ativo ? 'ativo' : 'revogado'} />
      </div>
      <div className="caption gf-muted">
        {`emitido ${cracha.emitidoEm ? quandoCurto(cracha.emitidoEm, agora) : 'agora, esperando a hora da base'}`}
        {!cracha.ativo
          ? `, revogado ${cracha.revogadoEm ? quandoCurto(cracha.revogadoEm, agora) : 'agora, esperando a hora da base'}`
          : ''}
      </div>
      {cracha.ativo ? (
        <div className="gf-cr-acao">
          <Button variant="danger" size={celular ? 'touch' : undefined} block={celular} disabled={ocupado} onClick={aoRevogar}>
            Revogar
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function LinhaDaMaquina({ m, crachaAtivo, agora }: { m: PonteDaMaquina; crachaAtivo: boolean; agora: Date }) {
  return (
    <li className="gf-cr-cracha">
      <div className="gf-cr-linha">
        <div className="gf-cr-quem">
          <span className="body-strong truncate">{m.chamada}</span>
          <span className="caption gf-muted mono truncate">{maquinaCurta(m.id)}</span>
        </div>
        <StateBadge state={m.online ? 'done' : 'offline'} label={m.online ? 'conectada' : 'offline'} />
      </div>
      <div className="caption gf-muted">
        {[
          m.online ? `sinal ${desdeQuando(m.atrasoMs)}` : m.vistoPorUltimo ? `visto por último ${quandoCurto(m.vistoPorUltimo, agora)}` : 'sem sinal',
          m.versao ? `ponte ${m.versao}` : null,
          crachaAtivo ? 'com crachá ativo' : 'sem crachá'
        ]
          .filter(Boolean)
          .join(' · ')}
      </div>
    </li>
  );
}

/* ---------- confirmações ---------- */

function Confirmacoes({ acoes, dados, celular }: { acoes: AcoesDosCrachas; dados: DadosDosCrachas; celular?: boolean }) {
  if (acoes.emitindo) {
    const p = acoes.emitindo;
    const antigos = ativosDaMaquina(dados.crachas, p.maquinaId).length;
    return (
      <Confirmacao
        celular={celular}
        titulo={`Emitir crachá para ${chamadaDoPedido(p)}?`}
        detalhe="Olhe agora o terminal da máquina onde o pedido foi feito. Os dois números abaixo têm de ser exatamente os que ele mostra. Se qualquer um for diferente, não emita: o pedido pode ser falso."
        rotuloDoBotao="São os mesmos, emitir crachá"
        rotuloDeCancelar="Não são os mesmos, cancelar"
        ocupado={acoes.ordem.ocupado}
        erro={acoes.ordem.erro}
        aoConfirmar={acoes.confirmarEmissao}
        aoCancelar={acoes.desistir}
      >
        <div className="gf-cr-conferir">
          <div className="gf-cr-conferir-item">
            <span className="label gf-faint">código</span>
            <Codigo codigo={p.codigo} grande />
          </div>
          <div className="gf-cr-conferir-item">
            <span className="label gf-faint">começo do uid</span>
            <span className="mono gf-cr-codigo gf-cr-codigo-grande">{uidCurto(p.uid)}</span>
          </div>
        </div>
        <div className="caption gf-muted">{`máquina ${p.maquinaId}${p.rotulo ? `, rótulo ${p.rotulo}` : ''}`}</div>
        {antigos > 0 ? (
          <p className="caption gf-cr-aviso">
            {`Esta máquina já tem ${plural(antigos, 'crachá ativo', 'crachás ativos')}. Na mesma gravação, ${antigos === 1 ? 'ele é revogado' : 'eles são revogados'}, e a ponte que usa ${antigos === 1 ? 'o crachá antigo' : 'os crachás antigos'} perde o acesso.`}
          </p>
        ) : null}
      </Confirmacao>
    );
  }
  if (acoes.revogando) {
    const r = acoes.revogando;
    return (
      <Confirmacao
        celular={celular}
        perigo
        titulo={`Revogar o crachá de ${r.chamada}?`}
        detalhe={`A ponte desta máquina perde o acesso à base agora e para de receber ordem. ${
          r.quantos > 1 ? `Os ${r.quantos} crachás ativos desta máquina são revogados juntos. ` : ''
        }Crachá revogado não volta: para a máquina voltar, ela pede crachá novo e você emite de novo. A trilha guarda quem revogou e quando.`}
        rotuloDoBotao={r.quantos > 1 ? `Revogar os ${r.quantos} crachás` : 'Revogar crachá'}
        rotuloDeCancelar="Manter o crachá"
        ocupado={acoes.ordem.ocupado}
        erro={acoes.ordem.erro}
        aoConfirmar={acoes.confirmarRevogacao}
        aoCancelar={acoes.desistir}
      />
    );
  }
  return null;
}

/* ---------- a tela ---------- */

function SecaoDosCrachas({
  dados,
  acoes,
  agora,
  nomes,
  celular
}: {
  dados: DadosDosCrachas;
  acoes: AcoesDosCrachas;
  agora: Date;
  nomes: Map<string, string>;
  celular?: boolean;
}) {
  const ocupado = acoes.ordem.ocupado;
  return (
    <>
      {dados.erroDeLeitura ? <ErroDeEscrita mensagem={dados.erroDeLeitura} /> : null}
      {acoes.ordem.erro && !acoes.emitindo && !acoes.revogando ? (
        <ErroDeEscrita mensagem={acoes.ordem.erro} aoFechar={acoes.ordem.limparErro} />
      ) : null}

      <div className="gf-cr-titulo">
        <h3 className="title-sm">Pedidos abertos</h3>
        <span className="caption gf-faint">últimos 15 minutos</span>
      </div>
      {dados.listaCheia ? (
        <ErroDeEscrita
          mensagem={`A lista chegou ao teto de ${LIMITE_DE_PEDIDOS} pedidos em 15 minutos. Pode haver pedidos que o painel não mostra, então nenhuma emissão sai enquanto a lista estiver cheia. Pode ser tentativa de falsificação.`}
        />
      ) : null}
      {dados.abertos.length ? (
        <ul className="gf-cr-lista">
          {dados.abertos.map((p) => (
            <CartaoDoPedido
              key={p.id}
              pedido={p}
              dados={dados}
              agora={agora}
              celular={celular}
              ocupado={ocupado}
              aoEmitir={() => acoes.pedirEmissao(p)}
            />
          ))}
        </ul>
      ) : (
        <p className="caption gf-muted">
          {dados.carregando
            ? 'Lendo os pedidos na base.'
            : 'Nenhum pedido aberto. Para uma máquina pedir crachá, rode na pasta da ponte dela o pedido de crachá (npm run cracha). O pedido aparece aqui sozinho, com o mesmo código que o terminal mostra.'}
        </p>
      )}

      <div className="gf-cr-titulo">
        <h3 className="title-sm">Máquinas com crachá</h3>
        <span className="caption gf-faint">
          {dados.crachas.length
            ? `${plural(dados.crachas.filter((c) => c.ativo).length, 'ativo', 'ativos')} · ${plural(
                dados.crachas.filter((c) => !c.ativo).length,
                'revogado',
                'revogados'
              )}`
            : ''}
        </span>
      </div>
      {dados.crachas.length ? (
        <ul className="gf-cr-lista">
          {dados.crachas.map((c) => {
            const chamada = chamadaDoCracha(c, nomes.get(c.maquinaId));
            return (
              <LinhaDoCracha
                key={c.id}
                cracha={c}
                chamada={chamada}
                agora={agora}
                celular={celular}
                ocupado={ocupado}
                aoRevogar={() => acoes.pedirRevogacao(c, chamada)}
              />
            );
          })}
        </ul>
      ) : (
        <p className="caption gf-muted">
          {dados.carregando ? 'Lendo os crachás na base.' : 'Nenhuma máquina tem crachá ainda. As pontes entram como você, como sempre entraram.'}
        </p>
      )}
    </>
  );
}

function ListaDeMaquinas({ estado, dados }: { estado: EstadoDoPainel; dados: DadosDosCrachas }) {
  const ativas = new Set(dados.crachas.filter((c) => c.ativo).map((c) => c.maquinaId));
  const maquinas = estado.ponte.maquinas.filter((m) => !m.teste);
  return maquinas.length ? (
    <ul className="gf-cr-lista">
      {maquinas.map((m) => (
        <LinhaDaMaquina key={m.id} m={m} crachaAtivo={ativas.has(m.id)} agora={estado.agora} />
      ))}
    </ul>
  ) : (
    <p className="caption gf-muted">Nenhuma ponte se apresentou à base ainda.</p>
  );
}

const FORA_DESTA_OST =
  'Projetos cadastrados e avisos no celular entram numa onda seguinte. Nesta tela, por enquanto, a situação da ponte e os crachás.';

function usarTela(base: Firestore | null, estado: EstadoDoPainel, escrita: ContextoDeEscrita, avisar: (m: string) => void) {
  const dados = usarDadosDosCrachas(base, estado.agora);
  const acoes = usarAcoesDosCrachas(escrita, dados, avisar);
  const nomes = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const m of estado.ponte.maquinas) if (m.nome) mapa.set(m.id, m.nome);
    return mapa;
  }, [estado.ponte.maquinas]);
  return { dados, acoes, nomes };
}

/* Computador: crachás à esquerda, que é onde mora a ação; pontes à direita. */
export function Configuracoes({
  base,
  estado,
  escrita,
  avisar
}: {
  base: Firestore | null;
  estado: EstadoDoPainel;
  escrita: ContextoDeEscrita;
  avisar: (mensagem: string) => void;
}) {
  const { dados, acoes, nomes } = usarTela(base, estado, escrita, avisar);
  return (
    <div className="gf-body">
      <Panel
        title="Crachás das máquinas"
        sub={dados.abertos.length ? plural(dados.abertos.length, 'pedido esperando você', 'pedidos esperando você') : undefined}
      >
        <div className="gf-cr-rola">
          <SecaoDosCrachas dados={dados} acoes={acoes} agora={estado.agora} nomes={nomes} />
        </div>
      </Panel>
      <Panel title="Situação da ponte">
        <div className="gf-cr-rola">
          <ListaDeMaquinas estado={estado} dados={dados} />
          <p className="caption gf-faint">{FORA_DESTA_OST}</p>
        </div>
      </Panel>
      <Confirmacoes acoes={acoes} dados={dados} />
    </div>
  );
}

/* Celular: uma coluna só, pedidos em cima, a lista rola por dentro. */
export function ConfiguracoesCelular({
  base,
  estado,
  escrita,
  avisar
}: {
  base: Firestore | null;
  estado: EstadoDoPainel;
  escrita: ContextoDeEscrita;
  avisar: (mensagem: string) => void;
}) {
  const { dados, acoes, nomes } = usarTela(base, estado, escrita, avisar);
  return (
    <>
      <div className="gf-cr-rola gf-cr-rola-celular">
        <SecaoDosCrachas dados={dados} acoes={acoes} agora={estado.agora} nomes={nomes} celular />
        <div className="gf-cr-titulo">
          <h3 className="title-sm">Situação da ponte</h3>
        </div>
        <ListaDeMaquinas estado={estado} dados={dados} />
        <p className="caption gf-faint">{FORA_DESTA_OST}</p>
      </div>
      <Confirmacoes acoes={acoes} dados={dados} celular />
    </>
  );
}
