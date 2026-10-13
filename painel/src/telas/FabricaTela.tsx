'use client';

/*
 * Tela 3, Fabrica (posto de comando), no computador. Montagem portada de
 * prototipo/computador.js: cabecalho, abas, corpo e caixa de comando no pe; na
 * direita o pedido parado desta fabrica e os indicadores dela.
 *
 * Modo leitura, Onda 1: caixa de comando e botoes de decisao aparecem
 * desabilitados, dizendo em que onda entram, e sem caminho de clique que
 * escreva na base.
 *
 * As abas do pacote sao quatro. Nesta onda existem as duas que o contrato
 * alimenta, Atividade e Tarefas; Relatórios e Alterações ficam ditos na tela,
 * sem tela inventada.
 */

import { useMemo, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import {
  ActivityTimeline,
  Button,
  CommandBox,
  FactoryHeader,
  KpiTile,
  StateIcon,
  Tabs,
  TaskRow
} from '@/componentes/ds';
import { usarAtividade, usarTarefas } from '@/dados/ouvintes';
import type { EstadoDoPainel } from '@/dados/painel';
import { ordenarTarefas, traduzirAtividade, traduzirTarefa } from '@/dados/tradutor';
import { consumoEmPartes, plural } from '@/formato';
import { Falha, Panel, Vazio } from './pecas';
import {
  MOTIVO_DAS_ACOES_DA_FABRICA,
  motivoDaCaixaDeComando,
  motivoDaDecisao
} from './textos';

const PASSOS_NO_COMPUTADOR = 6;
const TAREFAS_NO_COMPUTADOR = 6;

export function FabricaTela({
  base,
  estado,
  fabricaId,
  verPedido
}: {
  base: Firestore | null;
  estado: EstadoDoPainel;
  fabricaId: string;
  verPedido: () => void;
}) {
  const [aba, setAba] = useState('atividade');
  const fabrica = estado.fabricas.find((f) => f.id === fabricaId) ?? null;
  const pedidos = estado.porFabrica.get(fabricaId) ?? [];
  const pedido = pedidos[0];

  const atividade = usarAtividade(base, fabricaId, PASSOS_NO_COMPUTADOR);
  const tarefas = usarTarefas(base, fabricaId);

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
  const motivoComando = motivoDaCaixaDeComando(estado.ponte.situacao);
  const motivoDecisao = motivoDaDecisao(estado.ponte.situacao);

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
          actionsDisabledReason={MOTIVO_DAS_ACOES_DA_FABRICA}
        />
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
          <CommandBox disabledReason={motivoComando} />
        </div>
      </section>

      <div className="flex min-h-0 flex-col gap-3">
        {pedido ? (
          <section
            className="gf-panel gf-glass"
            style={{ gap: 10, padding: 18, borderColor: 'var(--state-approval)' }}
          >
            <div
              className="caption flex items-center gap-2"
              style={{ color: 'var(--state-approval)', fontWeight: 700 }}
            >
              <StateIcon state="approval" size={10} />
              {`Esta fábrica espera você há ${pedido.waiting}`}
            </div>
            <div className="title-sm">{pedido.title}</div>
            <div className="flex gap-2">
              <Button variant="primary" disabled>
                Aprovar
              </Button>
              <Button variant="danger" disabled>
                Recusar
              </Button>
            </div>
            <span className="caption gf-faint">{motivoDecisao}</span>
            <Button variant="secondary" onClick={verPedido}>
              Abrir o painel Aguardando você
            </Button>
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
          </div>
        </Panel>
      </div>
    </div>
  );
}
