'use client';

/*
 * Casca do celular. Desenho proprio, nao o computador encolhido, portado de
 * prototipo/celular.js: barra de navegacao na base, cabecalho curto, corpo que
 * nao rola e alvo de toque de 44px.
 *
 * Prioridade no celular, nesta ordem: responder aprovacao, ver o que esta
 * rodando, mandar comando, ler relatorio. Na Onda 2 as tres primeiras estao
 * vivas; ler relatorio segue como destino inerte, §A.12.
 *
 * O pedido parado abre direto na entrada, com o pacote completo e as tres
 * respostas. Pausar, reiniciar e encerrar moram numa folha que sobe do pe, e
 * encerrar pede confirmacao, sempre.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import {
  ActivityTimeline,
  AlertBanner,
  ApprovalDeck,
  ApprovalItem,
  BridgeStatus,
  Button,
  CommandBox,
  Icon,
  KpiTile,
  MobileNav,
  Pager,
  Segmented,
  StateBadge,
  StateIcon,
  Tabs,
  TaskRow,
  rotuloCurto
} from '@/componentes/ds';
import type { Entrada } from '@/dados/autenticacao';
import { impedimentoDaEscrita, type ContextoDeEscrita } from '@/dados/escritas';
import { usarAtividade, usarTarefas } from '@/dados/ouvintes';
import type { EstadoDoPainel } from '@/dados/painel';
import { ordenarTarefas, traduzirAtividade, traduzirTarefa } from '@/dados/tradutor';
import { desdeQuando, plural } from '@/formato';
import { usarAcoesDaFabrica, usarCaixaDeComando, type AcoesDaFabrica } from './FabricaTela';
import { NovaFabricaCelular } from './NovaFabrica';
import {
  Aviso,
  Confirmacao,
  ErroDeEscrita,
  EsperandoNascer,
  MHead,
  Falha,
  PRAZO_PARA_NASCER_MS,
  Vazio
} from './pecas';
import { paraPedidoDeTela, usarResposta, type EstadoDaResposta } from './pedido';
import { CONFIRMAR_ENCERRAR, DESTINOS_INERTES, motivoDeAbrirFabrica } from './textos';

/* Quantos cartoes de fabrica a lista mostra por pagina no celular. Nao e numero
   fixo: a tela do celular e unica e nao rola, o cartao leva a linha do que a
   fabrica esta fazendo, e a altura disponivel muda com o aparelho e com a faixa
   de aprovacao em cima. A lista mede o espaco que tem e o cartao que ja
   desenhou, e mostra o que couber. Antes da primeira medida, tres.
   O cartao vai com shrink-0: sem isso a lista espreme os cartoes e a linha do
   que a fabrica faz, que e a unica com recorte, some. */
const FABRICAS_POR_PAGINA = 3;
const VAO_ENTRE_CARTOES = 8;
const PASSOS_NO_CELULAR = 4;
const TAREFAS_NO_CELULAR = 4;

/* chave: o que muda o desenho acima da lista, como a faixa da ponte e a faixa de
   aprovacao. Quando muda, a lista mede de novo. */
function usarQuantosCartoesCabem(ativo: boolean, chave: string) {
  const lista = useRef<HTMLDivElement>(null);
  const [cabem, setCabem] = useState(FABRICAS_POR_PAGINA);

  useEffect(() => {
    const alvo = lista.current;
    const corpo = alvo?.parentElement;
    if (!ativo || !alvo || !corpo || typeof ResizeObserver === 'undefined') return;
    /* O espaco e medido do topo da lista ate o pe do corpo, descontando o
       paginador. Nenhuma dessas medidas depende de quantos cartoes estao
       desenhados, senao a conta mudaria o desenho e o desenho mudaria a conta. */
    const medir = () => {
      const vaoDoCorpo = parseFloat(getComputedStyle(corpo).rowGap) || 0;
      const paginador = alvo.nextElementSibling;
      const pe = paginador ? paginador.getBoundingClientRect().height + vaoDoCorpo : 0;
      const espaco = corpo.getBoundingClientRect().bottom - alvo.getBoundingClientRect().top - pe;
      const cartao = alvo.querySelector('.gf-mrow')?.getBoundingClientRect().height ?? 0;
      if (espaco <= 0 || cartao <= 0) return;
      setCabem(Math.max(1, Math.floor((espaco + VAO_ENTRE_CARTOES) / (cartao + VAO_ENTRE_CARTOES))));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(corpo);
    return () => observador.disconnect();
  }, [ativo, chave]);

  return { lista, cabem };
}

export function Celular({
  base,
  estado,
  escrita,
  entrada
}: {
  base: Firestore | null;
  estado: EstadoDoPainel;
  escrita: ContextoDeEscrita;
  entrada: Entrada;
}) {
  /* Entrada em Aprovacoes quando ha pedido parado, como o manual do celular
     manda. Enquanto o diretor nao escolhe uma tela, a entrada se decide pelos
     dados que chegam, e nao pelo instante em que a tela montou: no primeiro
     instante a base ainda nao respondeu. */
  const [telaEscolhida, setTela] = useState<string | null>(null);
  const [fabricaId, setFabricaId] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [aba, setAba] = useState<'pendentes' | 'historico'>('pendentes');
  /* UM aviso por vez, e a casca e a dona dele, § mesma razao do computador. */
  const [aviso, setAviso] = useState<string | null>(null);
  /* Qual fabrica foi pedida agora e quando, §A.22. */
  const [pedidaEm, setPedidaEm] = useState<{ id: string; em: Date } | null>(null);
  const avisar = useCallback((mensagem: string) => setAviso(mensagem), []);
  const tela = telaEscolhida ?? (!estado.carregando && estado.aprovacoes.length ? 'approvals' : 'factories');
  const resposta = usarResposta(escrita, avisar);

  const { lista: listaDeFabricas, cabem } = usarQuantosCartoesCabem(
    tela === 'factories',
    `${estado.fabricasDeTrabalho.length}|${estado.aprovacoes.length}|${estado.ponte.online}`
  );

  const ponte = estado.ponte;
  const motivoDeAbrir = motivoDeAbrirFabrica(impedimentoDaEscrita(escrita));

  const faixaDaPonte = ponte.online ? null : (
    <AlertBanner
      key="ponte"
      tone="offline"
      title={ponte.situacao === 'sem maquina' ? 'Nenhuma ponte pareada' : 'A ponte está offline'}
      detail={
        ponte.situacao === 'sem maquina'
          ? 'Nenhuma máquina se apresentou ainda.'
          : `Sem sinal da máquina ${desdeQuando(ponte.atrasoMs)}.`
      }
    />
  );

  const chipDaPonte = (
    <BridgeStatus
      online={ponte.online}
      detail={ponte.online ? undefined : ponte.situacao === 'sem maquina' ? 'sem máquina' : desdeQuando(ponte.atrasoMs)}
    />
  );

  const botaoDeNovaFabrica = (
    <button
      type="button"
      className="gf-iconbtn"
      aria-label="Abrir nova fábrica"
      disabled={Boolean(motivoDeAbrir)}
      onClick={() => setTela('new')}
    >
      <Icon name="plus" size={18} />
    </button>
  );

  let cabecalho: React.ReactNode = null;
  let corpo: React.ReactNode = null;
  let mostrarNav = true;
  let navAtiva = tela;

  if (tela === 'approvals') {
    cabecalho = (
      <MHead
        title="Aprovações"
        sub={
          estado.aprovacoes.length
            ? `${plural(estado.aprovacoes.length, 'pedido esperando você', 'pedidos esperando você')}`
            : 'Nada esperando você'
        }
        right={chipDaPonte}
      />
    );
    corpo = (
      <>
        {faixaDaPonte}
        {estado.decisoes.length ? (
          <Segmented
            block
            label="Fila ou histórico"
            value={aba}
            onChange={(id) => setAba(id as 'pendentes' | 'historico')}
            options={[
              { id: 'pendentes', label: `Na fila (${estado.aprovacoes.length})` },
              { id: 'historico', label: 'Histórico' }
            ]}
          />
        ) : null}
        {aba === 'pendentes' || !estado.decisoes.length ? (
          <div className="flex min-h-0 flex-1">
            <ApprovalDeck
              items={estado.aprovacoes.map((p) => paraPedidoDeTela(p, resposta))}
              touch
              readOnlyReason={resposta.motivo}
              onApprove={(item) => resposta.aprovar({ id: item.id ?? '' })}
              onReject={(item, motivoDaRecusa) => resposta.recusar({ id: item.id ?? '' }, motivoDaRecusa)}
              onApproveWithNote={(item, observacao) =>
                resposta.aprovarComObservacao({ id: item.id ?? '' }, observacao)
              }
              emptyText="Nada parado esperando você. Quando uma fábrica pedir aprovação, o pedido aparece aqui."
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            {estado.decisoes.slice(0, 5).map((d) => (
              <ApprovalItem
                key={d.id}
                title={d.title}
                decision={d.resposta}
                decidedAt={d.quando}
                note={d.observacao ?? undefined}
              />
            ))}
          </div>
        )}
      </>
    );
  } else if (tela === 'factories') {
    const total = Math.max(1, Math.ceil(estado.fabricasDeTrabalho.length / cabem));
    const atual = Math.min(pagina, total);
    const visiveis = estado.fabricasDeTrabalho.slice((atual - 1) * cabem, atual * cabem);
    cabecalho = (
      <MHead
        title="Fábricas"
        sub={
          estado.fabricasDeTrabalho.length
            ? `${plural(estado.fabricasDeTrabalho.length, 'no painel', 'no painel')} · mais urgente primeiro`
            : 'Nenhuma no painel'
        }
        right={botaoDeNovaFabrica}
      />
    );
    corpo = (
      <>
        {faixaDaPonte}
        {estado.aprovacoes.length ? (
          <AlertBanner
            tone="approval"
            title={`${plural(estado.aprovacoes.length, 'aprovação esperando você', 'aprovações esperando você')}`}
            detail={`A mais antiga está parada há ${estado.aprovacoes[0].waiting}.`}
            actionLabel="Ver pedido"
            onAction={() => setTela('approvals')}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <KpiTile
            label="Em execução"
            value={String(estado.contagem.emExecucao)}
            unit={`de ${estado.contagem.total}`}
            progress={estado.contagem.total ? estado.contagem.emExecucao / estado.contagem.total : 0}
          />
          <KpiTile
            label="Aguardando você"
            value={String(estado.contagem.aguardandoAprovacao)}
            unit={estado.contagem.aguardandoAprovacao === 1 ? 'pedido' : 'pedidos'}
            hint={estado.aprovacoes[0] ? `há ${estado.aprovacoes[0].waiting}` : 'nada parado'}
          />
        </div>
        <div ref={listaDeFabricas} className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          {estado.erro ? (
            <Falha mensagem={estado.erro} />
          ) : visiveis.length === 0 ? (
            <Vazio
              titulo={estado.carregando ? 'Lendo a base' : 'Nenhuma fábrica no painel'}
              detalhe={
                estado.carregando
                  ? 'O painel está abrindo os ouvintes ao vivo.'
                  : 'Quando a ponte abrir a primeira fábrica, ela aparece aqui, ao vivo.'
              }
            />
          ) : (
            visiveis.map((f) => (
              <button
                key={f.id}
                type="button"
                className="gf-glass gf-mrow shrink-0 flex-col items-stretch gap-2"
                style={{
                  borderColor:
                    f.state === 'approval'
                      ? 'var(--state-approval)'
                      : f.state === 'failed'
                        ? 'var(--state-failed)'
                        : undefined
                }}
                onClick={() => {
                  setFabricaId(f.id);
                  setTela('factory');
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="title-sm flex-1 truncate text-left">{f.project}</span>
                  <StateBadge state={f.state} label={rotuloCurto(f.state)} />
                </span>
                <span
                  className="body gf-muted text-left"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {f.doing}
                </span>
                <span className="mono gf-faint text-left">{`${f.elapsed} · ${f.usage}`}</span>
              </button>
            ))
          )}
        </div>
        {estado.fabricasDeTrabalho.length > cabem ? (
          <div className="flex justify-end">
            <Pager page={atual} total={total} onChange={setPagina} />
          </div>
        ) : null}
      </>
    );
  } else if (tela === 'new') {
    mostrarNav = false;
    navAtiva = 'factories';
    cabecalho = <MHead title="Nova fábrica" onBack={() => setTela('factories')} />;
    corpo = (
      <>
        {faixaDaPonte}
        <NovaFabricaCelular
          escrita={escrita}
          estado={estado}
          celular
          aoAbrir={(novaFabricaId, mensagem) => {
            // §A.22: leva o diretor para a fabrica que ele acabou de abrir, no
            // celular tambem. Antes o identificador era jogado fora.
            setAviso(mensagem);
            setFabricaId(novaFabricaId);
            setPedidaEm({ id: novaFabricaId, em: new Date() });
            setTela('factory');
          }}
          aoCancelar={() => setTela('factories')}
        />
      </>
    );
  } else if (tela === 'factory' && fabricaId) {
    mostrarNav = false;
    navAtiva = 'factories';
    const fabrica = estado.fabricas.find((f) => f.id === fabricaId) ?? null;
    cabecalho = (
      <MHead
        title={fabrica?.project ?? 'Fábrica'}
        sub={fabrica ? `${fabrica.agent} · ${fabrica.model} · ${fabrica.elapsed}` : undefined}
        onBack={() => {
          setFabricaId(null);
          setTela('factories');
        }}
      />
    );
    corpo = fabrica ? (
      <CelularFabrica
        base={base}
        estado={estado}
        escrita={escrita}
        fabricaId={fabricaId}
        faixa={faixaDaPonte}
        resposta={resposta}
        avisar={avisar}
        verPedido={() => setTela('approvals')}
      />
    ) : pedidaEm !== null && pedidaEm.id === fabricaId ? (
      // §A.22, o mesmo conserto do computador: fabrica pedida agora espera, em vez
      // de aparecer como fabrica que nao existe mais.
      <EsperandoNascer
        segundos={Math.round(Math.max(0, estado.agora.getTime() - pedidaEm.em.getTime()) / 1000)}
        passouDoPrazo={estado.agora.getTime() - pedidaEm.em.getTime() > PRAZO_PARA_NASCER_MS}
        pontePronta={escrita.pontePronta}
      />
    ) : (
      <Vazio
        titulo="Esta fábrica não está mais no painel"
        detalhe="A ponte removeu ou encerrou a fábrica. Volte para Fábricas para ver o que está aberto agora."
      />
    );
  } else {
    const texto = DESTINOS_INERTES[tela] ?? DESTINOS_INERTES.more;
    cabecalho = <MHead title={tela === 'reports' ? 'Relatórios' : 'Mais'} right={chipDaPonte} />;
    corpo = (
      <>
        {faixaDaPonte}
        <div className="gf-glass flex min-h-0 flex-1 flex-col rounded-lg">
          <Vazio titulo={texto.titulo} detalhe={texto.detalhe} icone={<Icon name="overview" size={20} />} />
        </div>
        {tela === 'more' ? (
          <Button
            variant="secondary"
            size="touch"
            block
            disabled={Boolean(motivoDeAbrir)}
            onClick={() => setTela('new')}
          >
            Abrir nova fábrica
          </Button>
        ) : null}
        <Button variant="ghost" size="touch" block onClick={entrada.sair}>
          Sair
        </Button>
      </>
    );
  }

  return (
    <div className="gf-mapp">
      {cabecalho}
      <div className="gf-mbody">{corpo}</div>
      {mostrarNav ? (
        <MobileNav
          value={navAtiva}
          onChange={(id) => {
            setTela(id);
            if (id !== 'factory') setFabricaId(null);
          }}
          items={[
            { id: 'approvals', label: 'Aprovações', count: estado.contagem.aguardandoAprovacao || null },
            { id: 'factories', label: 'Fábricas' },
            { id: 'reports', label: 'Relatórios' },
            { id: 'more', label: 'Mais' }
          ]}
        />
      ) : null}
      {aviso ? <Aviso mensagem={aviso} celular aoSumir={() => setAviso(null)} /> : null}
    </div>
  );
}

function CelularFabrica({
  base,
  estado,
  escrita,
  fabricaId,
  faixa,
  resposta,
  avisar,
  verPedido
}: {
  base: Firestore | null;
  estado: EstadoDoPainel;
  escrita: ContextoDeEscrita;
  fabricaId: string;
  faixa: React.ReactNode;
  resposta: EstadoDaResposta;
  avisar: (mensagem: string) => void;
  verPedido: () => void;
}) {
  const [aba, setAba] = useState('atividade');
  const [folha, setFolha] = useState<'acoes' | null>(null);
  const fabrica = estado.fabricas.find((f) => f.id === fabricaId) ?? null;
  const pedido = (estado.porFabrica.get(fabricaId) ?? [])[0];
  const atividade = usarAtividade(base, fabricaId, PASSOS_NO_CELULAR);
  const tarefas = usarTarefas(base, fabricaId);
  const acoes = usarAcoesDaFabrica(escrita, fabrica, avisar);
  const caixa = usarCaixaDeComando(escrita, fabrica, avisar);

  const passos = useMemo(() => atividade.itens.map(traduzirAtividade), [atividade.itens]);
  const listaDeTarefas = useMemo(
    () => ordenarTarefas(tarefas.itens.map((t) => traduzirTarefa(t, estado.agora))),
    [tarefas.itens, estado.agora]
  );

  if (!fabrica) return null;

  let miolo: React.ReactNode;
  if (aba === 'atividade') {
    miolo = atividade.erro ? (
      <Falha mensagem={atividade.erro} />
    ) : passos.length === 0 ? (
      <Vazio
        titulo={atividade.carregando ? 'Lendo a atividade' : 'Nenhum passo registrado'}
        detalhe="Cada passo que a fábrica der aparece aqui, do mais recente para o mais antigo."
      />
    ) : (
      <ActivityTimeline live={fabrica.state === 'running' || fabrica.state === 'approval'} items={passos} />
    );
  } else {
    miolo = tarefas.erro ? (
      <Falha mensagem={tarefas.erro} />
    ) : listaDeTarefas.length === 0 ? (
      <Vazio
        titulo={tarefas.carregando ? 'Lendo as tarefas' : 'Nenhuma tarefa delegada'}
        detalhe="Quando a fábrica delegar uma tarefa, ela aparece aqui com a situação dela."
      />
    ) : (
      <div className="gf-card gf-glass">
        {listaDeTarefas.slice(0, TAREFAS_NO_CELULAR).map((t) => (
          <TaskRow key={t.id} state={t.state} title={t.title} elapsed={t.elapsed} />
        ))}
      </div>
    );
  }

  return (
    <>
      {faixa}
      <div className="flex items-center gap-2">
        <StateBadge state={fabrica.state} label={rotuloCurto(fabrica.state)} />
        {fabrica.pausada ? <span className="caption gf-muted">pausada</span> : null}
        <span className="mono gf-faint">{fabrica.usage}</span>
        <span className="mono gf-faint gf-push">{fabrica.elapsed}</span>
      </div>
      {pedido ? (
        <button
          type="button"
          className="gf-glass gf-mrow"
          style={{ borderColor: 'var(--state-approval)', padding: '10px 14px' }}
          onClick={verPedido}
        >
          <span style={{ color: 'var(--state-approval)', display: 'flex' }}>
            <StateIcon state="approval" size={12} />
          </span>
          <span className="body-strong flex-1 text-left">{`Esperando você há ${pedido.waiting}`}</span>
          <span className="caption gf-muted">Responder</span>
        </button>
      ) : null}
      <Tabs
        value={aba}
        onChange={setAba}
        tabs={[
          { id: 'atividade', label: 'Atividade' },
          { id: 'tarefas', label: 'Tarefas' }
        ]}
      />
      <div className="min-h-0 flex-1 overflow-hidden">{miolo}</div>
      {acoes.ordem.erro && !acoes.confirmando && !folha ? (
        <ErroDeEscrita mensagem={acoes.ordem.erro} aoFechar={acoes.ordem.limparErro} />
      ) : null}
      <CommandBox
        touch
        disabledReason={caixa.motivo}
        error={caixa.ordem.erro}
        onDismissError={caixa.ordem.limparErro}
        onSend={caixa.enviar}
      />
      <Button
        variant="secondary"
        size="touch"
        block
        disabled={Boolean(acoes.motivo) || acoes.ordem.ocupado}
        onClick={() => setFolha('acoes')}
      >
        Pausar, reiniciar ou encerrar
      </Button>
      {acoes.motivo ? <span className="caption gf-faint gf-motivo">{acoes.motivo}</span> : null}

      {folha === 'acoes' && !acoes.confirmando ? (
        <FolhaDeAcoes
          acoes={acoes}
          pausada={fabrica.pausada}
          aoFechar={() => setFolha(null)}
        />
      ) : null}

      {acoes.confirmando ? (
        <Confirmacao
          celular
          perigo
          titulo={CONFIRMAR_ENCERRAR.titulo(fabrica.project)}
          detalhe={CONFIRMAR_ENCERRAR.detalhe}
          rotuloDoBotao={CONFIRMAR_ENCERRAR.botao}
          rotuloDeCancelar={CONFIRMAR_ENCERRAR.cancelar}
          ocupado={acoes.ordem.ocupado}
          erro={acoes.ordem.erro}
          aoConfirmar={() => {
            acoes.encerrar();
            setFolha(null);
          }}
          aoCancelar={() => {
            /* Deixar rodando fecha tudo, inclusive a folha de ordens: o diretor
               disse que nao quer mexer nesta fabrica agora. */
            acoes.desistirDoEncerramento();
            setFolha(null);
          }}
        />
      ) : null}
    </>
  );
}

/* Folha que sobe do pe com as ordens de ciclo de vida, como o manual do celular
   manda. Encerrar daqui ainda passa pela confirmacao. */
function FolhaDeAcoes({
  acoes,
  pausada,
  aoFechar
}: {
  acoes: AcoesDaFabrica;
  pausada: boolean;
  aoFechar: () => void;
}) {
  return (
    <div className="gf-sheet-wrap" onClick={aoFechar}>
      <div
        className="gf-sheet gf-panel-solid"
        role="dialog"
        aria-label="Ordens para esta fábrica"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="gf-sheet-grip" aria-hidden />
        <div className="title-md">O que fazer com esta fábrica</div>
        <div className="caption gf-muted">A ordem entra na fila da ponte, que executa na sua máquina.</div>
        {acoes.ordem.erro ? <ErroDeEscrita mensagem={acoes.ordem.erro} aoFechar={acoes.ordem.limparErro} /> : null}
        <div className="gf-sheet-actions">
          <Button
            variant="secondary"
            size="touch"
            block
            disabled={acoes.ordem.ocupado}
            onClick={() => {
              if (pausada) acoes.retomar();
              else acoes.pausar();
              aoFechar();
            }}
          >
            {pausada ? 'Retomar' : 'Pausar'}
          </Button>
          <Button
            variant="secondary"
            size="touch"
            block
            disabled={acoes.ordem.ocupado}
            onClick={() => {
              acoes.reiniciar();
              aoFechar();
            }}
          >
            Reiniciar
          </Button>
          <Button
            variant="danger"
            size="touch"
            block
            disabled={acoes.ordem.ocupado}
            onClick={acoes.pedirConfirmacaoDeEncerramento}
          >
            Encerrar
          </Button>
          <Button variant="ghost" size="touch" block onClick={aoFechar}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
