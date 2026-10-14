'use client';

/*
 * Tela 3, Fabrica (posto de comando), no computador. Montagem portada de
 * prototipo/computador.js: cabecalho, abas, corpo e caixa de comando no pe; na
 * direita o pedido parado desta fabrica e os indicadores dela.
 *
 * Onda 2, o painel comanda:
 *  - caixa de comando viva, que escreve na fila da ponte;
 *  - pausar, reiniciar e encerrar vivos no cabecalho;
 *  - encerrar SEMPRE com confirmacao, porque nao tem volta;
 *  - o pedido parado desta fabrica responde aqui mesmo, com as tres respostas.
 *
 * O painel nunca fala com a fabrica, §A.3: todo botao daqui escreve em comandos
 * ou em aprovacoes, e a ponte le.
 *
 * As abas do pacote sao quatro. Existem as duas que o contrato alimenta,
 * Atividade e Tarefas; Relatórios e Alterações ficam ditos na tela, sem tela
 * inventada, §A.12.
 */

import { useMemo, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import {
  ActivityTimeline,
  Button,
  CommandBox,
  FactoryHeader,
  KpiTile,
  RiskTag,
  StateIcon,
  Tabs,
  TaskRow
} from '@/componentes/ds';
import {
  encerrarFabrica,
  impedimentoDaEscrita,
  mandarComando,
  pausarFabrica,
  reiniciarFabrica,
  type ContextoDeEscrita
} from '@/dados/escritas';
import { usarAtividade, usarTarefas } from '@/dados/ouvintes';
import type { EstadoDoPainel } from '@/dados/painel';
import type { Fabrica } from '@/dados/tradutor';
import { ordenarTarefas, traduzirAtividade, traduzirTarefa } from '@/dados/tradutor';
import { consumoEmPartes, plural } from '@/formato';
import { Confirmacao, ErroDeEscrita, Falha, MarcaDeOrigem, Panel, Vazio } from './pecas';
import { type EstadoDaResposta } from './pedido';
import { AVISOS, CONFIRMAR_ENCERRAR, motivoDaCaixaDeComando, motivoDasAcoesDaFabrica } from './textos';
import { usarOrdem, type Ordem } from './usarOrdem';

const PASSOS_NO_COMPUTADOR = 6;
const TAREFAS_NO_COMPUTADOR = 6;

/* As ordens de ciclo de vida da fabrica, no computador e no celular. Uma
   mecanica, dois desenhos. */
export function usarAcoesDaFabrica(
  escrita: ContextoDeEscrita,
  fabrica: Fabrica | null,
  avisar: (mensagem: string) => void
) {
  const ordem = usarOrdem(avisar);
  const [confirmando, setConfirmando] = useState(false);
  const motivo = motivoDasAcoesDaFabrica(impedimentoDaEscrita(escrita));
  const alvo = fabrica
    ? { fabricaId: fabrica.id, maquinaId: fabrica.maquinaId, conversationId: fabrica.conversationId }
    : null;

  return {
    ordem,
    motivo,
    confirmando,
    pedirConfirmacaoDeEncerramento: () => {
      ordem.limparErro();
      setConfirmando(true);
    },
    desistirDoEncerramento: () => setConfirmando(false),
    pausar: () => {
      if (!alvo) return;
      void ordem.enviar(() => pausarFabrica(escrita, alvo), AVISOS.pausada);
    },
    retomar: () => {
      if (!alvo) return;
      void ordem.enviar(() => reiniciarFabrica(escrita, { ...alvo, pausada: true }), AVISOS.retomada);
    },
    reiniciar: () => {
      if (!alvo) return;
      void ordem.enviar(() => reiniciarFabrica(escrita, { ...alvo, pausada: false }), AVISOS.reiniciada);
    },
    encerrar: () => {
      if (!alvo) return;
      void ordem.enviar(() => encerrarFabrica(escrita, alvo), AVISOS.encerrada).then((deuCerto) => {
        if (deuCerto) setConfirmando(false);
      });
    }
  };
}

export type AcoesDaFabrica = ReturnType<typeof usarAcoesDaFabrica>;

/* Caixa de comando viva. O texto so e limpo quando a ordem entrou na fila. */
export function usarCaixaDeComando(
  escrita: ContextoDeEscrita,
  fabrica: Fabrica | null,
  avisar: (mensagem: string) => void
) {
  const ordem: Ordem = usarOrdem(avisar);
  const motivo = motivoDaCaixaDeComando(impedimentoDaEscrita(escrita));

  async function enviar(texto: string): Promise<boolean> {
    if (!fabrica) return false;
    return ordem.enviar(
      () =>
        mandarComando(escrita, {
          fabricaId: fabrica.id,
          maquinaId: fabrica.maquinaId,
          conversationId: fabrica.conversationId,
          texto
        }),
      AVISOS.comandoEnviado
    );
  }

  return { ordem, motivo, enviar };
}

export function FabricaTela({
  base,
  estado,
  escrita,
  fabricaId,
  resposta,
  avisar,
  verPedido
}: {
  base: Firestore | null;
  estado: EstadoDoPainel;
  escrita: ContextoDeEscrita;
  fabricaId: string;
  resposta: EstadoDaResposta;
  avisar: (mensagem: string) => void;
  verPedido: () => void;
}) {
  const [aba, setAba] = useState('atividade');
  const fabrica = estado.fabricas.find((f) => f.id === fabricaId) ?? null;
  const pedidos = estado.porFabrica.get(fabricaId) ?? [];
  const pedido = pedidos[0];

  const atividade = usarAtividade(base, fabricaId, PASSOS_NO_COMPUTADOR);
  const tarefas = usarTarefas(base, fabricaId);
  const acoes = usarAcoesDaFabrica(escrita, fabrica, avisar);
  const caixa = usarCaixaDeComando(escrita, fabrica, avisar);

  const passos = useMemo(() => atividade.itens.map(traduzirAtividade), [atividade.itens]);
  const listaDeTarefas = useMemo(
    () => ordenarTarefas(tarefas.itens.map((t) => traduzirTarefa(t, estado.agora))),
    [tarefas.itens, estado.agora]
  );

  if (!fabrica) {
    return (
      <div className="gf-body" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
        <Panel>
          <Vazio
            titulo="Esta fábrica não está mais no painel"
            detalhe="A ponte removeu ou encerrou a fábrica. Volte para a Visão geral para ver o que está aberto agora."
          />
        </Panel>
      </div>
    );
  }

  const uso = consumoEmPartes(fabrica.tokens);
  const concluidas = listaDeTarefas.filter((t) => t.state === 'done').length;

  let corpo: React.ReactNode;
  if (aba === 'atividade') {
    corpo = (
      <div className="gf-panel-body">
        {atividade.erro ? (
          <Falha mensagem={atividade.erro} />
        ) : passos.length === 0 ? (
          <Vazio
            titulo={atividade.carregando ? 'Lendo a atividade' : 'Nenhum passo registrado'}
            detalhe={
              atividade.carregando
                ? 'O painel está abrindo o ouvinte ao vivo desta fábrica.'
                : 'Esta fábrica ainda não registrou passos na base. Cada passo que ela der aparece aqui, do mais recente para o mais antigo.'
            }
          />
        ) : (
          <>
            <ActivityTimeline live={fabrica.state === 'running' || fabrica.state === 'approval'} items={passos} />
            <span className="caption gf-faint pl-3">
              {`Mostrando os ${passos.length} passos mais recentes. O histórico completo entra numa onda seguinte.`}
            </span>
          </>
        )}
      </div>
    );
  } else {
    corpo = (
      <div className="gf-panel-body">
        {tarefas.erro ? (
          <Falha mensagem={tarefas.erro} />
        ) : listaDeTarefas.length === 0 ? (
          <Vazio
            titulo={tarefas.carregando ? 'Lendo as tarefas' : 'Nenhuma tarefa delegada'}
            detalhe={
              tarefas.carregando
                ? 'O painel está abrindo o ouvinte ao vivo das tarefas desta fábrica.'
                : 'Quando a fábrica delegar uma tarefa, ela aparece aqui com a situação dela.'
            }
          />
        ) : (
          <>
            <div className="gf-card gf-glass">
              {listaDeTarefas.slice(0, TAREFAS_NO_COMPUTADOR).map((t) => (
                <TaskRow key={t.id} state={t.state} title={t.title} elapsed={t.elapsed} />
              ))}
            </div>
            {listaDeTarefas.length > TAREFAS_NO_COMPUTADOR ? (
              <span className="caption gf-faint pl-3">
                {`Mostrando ${TAREFAS_NO_COMPUTADOR} de ${listaDeTarefas.length} tarefas, as que pedem atenção primeiro.`}
              </span>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="gf-body" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
      <section className="gf-panel gf-glass">
        <FactoryHeader
          project={fabrica.project}
          agent={[fabrica.agent, fabrica.model, fabrica.folder].filter(Boolean).join(' · ')}
          state={fabrica.state}
          elapsed={fabrica.elapsed}
          usage={fabrica.usage}
          paused={fabrica.pausada}
          busy={acoes.ordem.ocupado}
          actionsDisabledReason={acoes.motivo}
          onPause={fabrica.pausada ? acoes.retomar : acoes.pausar}
          onRestart={acoes.reiniciar}
          onStop={acoes.pedirConfirmacaoDeEncerramento}
        />
        {acoes.ordem.erro && !acoes.confirmando ? (
          <ErroDeEscrita mensagem={acoes.ordem.erro} aoFechar={acoes.ordem.limparErro} />
        ) : null}
        {fabrica.erro ? (
          <div className="caption gf-muted">{`A ponte registrou uma falha nesta fábrica: ${fabrica.erro}`}</div>
        ) : null}
        <div>
          <Tabs
            value={aba}
            onChange={setAba}
            tabs={[
              { id: 'atividade', label: 'Atividade', count: passos.length || undefined },
              { id: 'tarefas', label: 'Tarefas', count: listaDeTarefas.length || undefined }
            ]}
          />
        </div>
        {corpo}
        <div className="flex flex-col gap-2">
          <span className="caption gf-faint">
            Relatórios desta fábrica entram na Onda 3. A aba Alterações entra quando a ponte passar a registrar
            arquivos tocados.
          </span>
          <CommandBox
            disabledReason={caixa.motivo}
            error={caixa.ordem.erro}
            onDismissError={caixa.ordem.limparErro}
            onSend={caixa.enviar}
          />
        </div>
      </section>

      <div className="flex min-h-0 flex-col gap-3">
        {pedido ? (
          /* Aviso curto, do jeito do pacote do designer: aqui cabe a decisao
             rapida de aprovar, e o pacote inteiro, com a marcacao de fato e de
             leitura da ponte, mora na fila de aprovacoes, que tem a tela
             inteira. Espremer o pacote nesta coluna seria o diretor decidir sem
             conseguir ler, e isso nao se faz num botao que libera risco. */
          <section
            className="gf-panel gf-glass"
            style={{ gap: 'var(--space-2)', padding: 'var(--space-4)', borderColor: 'var(--state-approval)' }}
          >
            <div
              className="caption flex items-center gap-2"
              style={{ color: 'var(--state-approval)', fontWeight: 700 }}
            >
              <StateIcon state="approval" size={10} />
              {`Esta fábrica espera você há ${pedido.waiting}`}
            </div>
            <div className="flex items-center gap-2">
              <RiskTag level={pedido.risk} />
              <MarcaDeOrigem marca={pedido.origens.risk} />
            </div>
            <div className="title-sm">{pedido.title}</div>
            {resposta.respondendo === pedido.id && resposta.ordem.erro ? (
              <ErroDeEscrita mensagem={resposta.ordem.erro} aoFechar={resposta.ordem.limparErro} />
            ) : null}
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={Boolean(resposta.motivo) || resposta.ordem.ocupado}
                onClick={() => resposta.aprovar(pedido)}
              >
                {resposta.ordem.ocupado ? 'Registrando...' : 'Aprovar'}
              </Button>
              <Button variant="secondary" onClick={verPedido}>
                Ver o pedido inteiro
              </Button>
            </div>
            <span className="caption gf-faint gf-motivo">
              {resposta.motivo ??
                'Recusar e aprovar com observação ficam na fila, junto do pacote completo do pedido.'}
            </span>
          </section>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <KpiTile label="Tempo" value={fabrica.elapsed} hint="desde a abertura" />
          <KpiTile label="Consumo" value={uso.valor} unit={uso.unidade} hint="acumulado" />
          <KpiTile
            label="Tarefas"
            value={String(concluidas)}
            unit={`de ${listaDeTarefas.length}`}
            hint="concluídas"
          />
          <KpiTile
            label="Passos"
            value={String(atividade.itens[0]?.seq ?? passos.length)}
            unit="registrados"
            hint={plural(pedidos.length, 'pedido parado', 'pedidos parados')}
          />
        </div>

        <Panel title="Máquina">
          <div className="flex flex-col gap-2">
            <div className="gf-stat-row body">
              <span className="gf-muted">Ponte</span>
              <span className="mono">{estado.ponte.online ? 'conectada' : 'offline'}</span>
            </div>
            <div className="gf-stat-row body">
              <span className="gf-muted">Máquina</span>
              <span className="mono">{estado.ponte.maquina ?? 'nenhuma pareada'}</span>
            </div>
            <div className="gf-stat-row body">
              <span className="gf-muted">Versão da ponte</span>
              <span className="mono">{estado.ponte.versao ?? 'não informada'}</span>
            </div>
            <div className="gf-stat-row body">
              <span className="gf-muted">Nasceu</span>
              <span className="mono">{fabrica.nasceuNoPainel ? 'pelo painel' : 'na mão'}</span>
            </div>
          </div>
        </Panel>
      </div>

      {acoes.confirmando ? (
        <Confirmacao
          titulo={CONFIRMAR_ENCERRAR.titulo(fabrica.project)}
          detalhe={CONFIRMAR_ENCERRAR.detalhe}
          rotuloDoBotao={CONFIRMAR_ENCERRAR.botao}
          rotuloDeCancelar={CONFIRMAR_ENCERRAR.cancelar}
          perigo
          ocupado={acoes.ordem.ocupado}
          erro={acoes.ordem.erro}
          aoConfirmar={acoes.encerrar}
          aoCancelar={acoes.desistirDoEncerramento}
        />
      ) : null}
    </div>
  );
}
