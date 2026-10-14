'use client';

/*
 * Casca do computador: menu lateral de vidro, barra superior, faixa de alerta e
 * corpo da tela. Uma tela so, sem rolagem da pagina.
 *
 * Telas construidas: Visao geral, Fabrica (posto de comando), Aprovacoes e Nova
 * fabrica. Relatórios, Indicadores, Configurações e a tela Fábricas seguem como
 * destino inerte, dito na tela, §A.12.
 */

import { useCallback, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { AlertBanner, Button, Icon, Sidebar } from '@/componentes/ds';
import type { Entrada } from '@/dados/autenticacao';
import { impedimentoDaEscrita, type ContextoDeEscrita } from '@/dados/escritas';
import type { EstadoDoPainel } from '@/dados/painel';
import { desdeQuando, diaPorExtenso, plural } from '@/formato';
import { Aprovacoes } from './Aprovacoes';
import { FabricaTela } from './FabricaTela';
import { Inerte } from './Inerte';
import { NovaFabrica } from './NovaFabrica';
import { Aviso, Topbar } from './pecas';
import { usarResposta } from './pedido';
import { DONO, MARCA, motivoDeAbrirFabrica } from './textos';
import { LinhaDeIndicadores, VisaoGeral } from './VisaoGeral';

const ITENS = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'approvals', label: 'Aprovações' },
  { id: 'factories', label: 'Fábricas' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'metrics', label: 'Indicadores' },
  { id: 'settings', label: 'Configurações' }
];

const TITULOS: Record<string, string> = {
  factory: 'Posto de comando',
  new: 'Nova fábrica'
};

export function Computador({
  base,
  estado,
  escrita,
  entrada,
  menuRecolhido
}: {
  base: Firestore | null;
  estado: EstadoDoPainel;
  escrita: ContextoDeEscrita;
  entrada: Entrada;
  menuRecolhido: boolean;
}) {
  const [tela, setTela] = useState('overview');
  const [fabricaId, setFabricaId] = useState<string | null>(null);
  /* UM aviso por vez, e a casca e a dona dele. Cada controle que registra uma
     ordem chama avisar; nenhum guarda aviso proprio, senao dois apareceriam no
     mesmo ponto da tela e o antigo cobriria o novo. */
  const [aviso, setAviso] = useState<string | null>(null);
  const avisar = useCallback((mensagem: string) => setAviso(mensagem), []);
  const resposta = usarResposta(escrita, avisar);

  const ponte = estado.ponte;
  const faixa = ponte.online ? null : (
    <AlertBanner
      key="ponte"
      tone="offline"
      title={ponte.situacao === 'sem maquina' ? 'Nenhuma ponte pareada' : 'A ponte está offline'}
      detail={
        ponte.situacao === 'sem maquina'
          ? 'O painel está ligado à base, mas nenhuma máquina se apresentou ainda. Quando a ponte iniciar, ela aparece aqui.'
          : `Sem sinal da máquina local ${desdeQuando(ponte.atrasoMs)}. As fábricas não andam e nenhum comando é entregue até ela voltar.`
      }
    />
  );

  const naFabrica = tela === 'factory' && fabricaId;
  const titulo = naFabrica
    ? TITULOS.factory
    : (TITULOS[tela] ?? ITENS.find((i) => i.id === tela)?.label ?? MARCA);
  const nomeDaFabrica = estado.fabricas.find((f) => f.id === fabricaId)?.project;
  const sub = naFabrica
    ? `Fábricas  ›  ${nomeDaFabrica ?? 'fábrica fora do painel'}`
    : tela === 'new'
      ? 'Escolha o projeto, o agente, o modelo e diga o que fazer primeiro'
      : tela === 'overview'
        ? `${diaPorExtenso(estado.agora)} · ${plural(estado.contagem.total, 'fábrica no painel', 'fábricas no painel')}`
        : tela === 'approvals'
          ? 'Mais antiga primeiro'
          : undefined;

  const motivoDeAbrir = motivoDeAbrirFabrica(impedimentoDaEscrita(escrita));
  const direita =
    tela === 'overview' || tela === 'approvals' ? (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="primary"
          icon={<Icon name="plus" size={16} />}
          disabled={Boolean(motivoDeAbrir)}
          onClick={() => setTela('new')}
        >
          Abrir nova fábrica
        </Button>
        {motivoDeAbrir ? <span className="caption gf-faint gf-motivo">{motivoDeAbrir}</span> : null}
      </div>
    ) : undefined;

  function voltarParaVisaoGeral() {
    setFabricaId(null);
    setTela('overview');
  }

  let corpo: React.ReactNode;
  if (naFabrica) {
    corpo = (
      <FabricaTela
        base={base}
        estado={estado}
        escrita={escrita}
        fabricaId={fabricaId as string}
        resposta={resposta}
        avisar={avisar}
        verPedido={() => {
          setFabricaId(null);
          setTela('approvals');
        }}
      />
    );
  } else if (tela === 'overview') {
    corpo = (
      <VisaoGeral
        estado={estado}
        resposta={resposta}
        abrirFabrica={(id) => {
          setFabricaId(id);
          setTela('factory');
        }}
      />
    );
  } else if (tela === 'approvals') {
    corpo = <Aprovacoes estado={estado} resposta={resposta} />;
  } else if (tela === 'new') {
    corpo = (
      <NovaFabrica
        escrita={escrita}
        estado={estado}
        aoAbrir={(_fabricaId, mensagem) => {
          setAviso(mensagem);
          voltarParaVisaoGeral();
        }}
        aoCancelar={voltarParaVisaoGeral}
      />
    );
  } else {
    corpo = <Inerte destino={tela} />;
  }

  const comKpis = tela === 'overview' && !naFabrica;
  const linhas = [
    'var(--size-topbar)',
    faixa ? 'auto' : null,
    comKpis ? 'auto' : null,
    'minmax(0,1fr)'
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="gf-app">
      <Sidebar
        brand={MARCA}
        owner={DONO}
        collapsed={menuRecolhido}
        value={naFabrica ? 'factories' : tela}
        onChange={(id) => {
          setTela(id);
          if (id !== 'factory') setFabricaId(null);
        }}
        items={ITENS.map((item) =>
          item.id === 'approvals'
            ? { ...item, count: estado.contagem.aguardandoAprovacao || null, alert: true }
            : item.id === 'factories'
              ? { ...item, count: estado.contagem.total || null }
              : item
        )}
        projects={estado.fabricas.map((f) => ({ name: f.project, state: f.state }))}
        bridge={{
          online: ponte.online,
          detail: ponte.online
            ? (ponte.maquina ?? undefined)
            : ponte.situacao === 'sem maquina'
              ? 'sem máquina pareada'
              : desdeQuando(ponte.atrasoMs)
        }}
        footer={
          <Button variant="ghost" onClick={entrada.sair}>
            Sair
          </Button>
        }
      />
      <main className="gf-main" style={{ gridTemplateRows: linhas }}>
        <Topbar
          title={titulo}
          sub={sub}
          right={direita}
          onBack={naFabrica || tela === 'new' ? voltarParaVisaoGeral : undefined}
        />
        {faixa}
        {comKpis ? <LinhaDeIndicadores estado={estado} /> : null}
        {corpo}
      </main>
      {aviso ? <Aviso mensagem={aviso} aoSumir={() => setAviso(null)} /> : null}
    </div>
  );
}
