'use client';

/*
 * Casca do computador: menu lateral de vidro, barra superior, faixa de alerta e
 * corpo da tela. Uma tela so, sem rolagem da pagina.
 *
 * Telas desta onda: Visao geral e Fabrica. Os outros itens do menu existem como
 * destino inerte, dito na tela.
 */

import { useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { AlertBanner, Button, Icon, Sidebar } from '@/componentes/ds';
import type { Entrada } from '@/dados/autenticacao';
import type { EstadoDoPainel } from '@/dados/painel';
import { desdeQuando, diaPorExtenso, plural } from '@/formato';
import { FabricaTela } from './FabricaTela';
import { Inerte } from './Inerte';
import { Topbar } from './pecas';
import { DONO, MARCA, MOTIVO_DE_ABRIR_FABRICA } from './textos';
import { LinhaDeIndicadores, VisaoGeral } from './VisaoGeral';

const ITENS = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'approvals', label: 'Aprovações' },
  { id: 'factories', label: 'Fábricas' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'metrics', label: 'Indicadores' },
  { id: 'settings', label: 'Configurações' }
];

export function Computador({
  base,
  estado,
  entrada,
  menuRecolhido
}: {
  base: Firestore | null;
  estado: EstadoDoPainel;
  entrada: Entrada;
  menuRecolhido: boolean;
}) {
  const [tela, setTela] = useState('overview');
  const [fabricaId, setFabricaId] = useState<string | null>(null);

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
  const titulo = naFabrica ? 'Posto de comando' : (ITENS.find((i) => i.id === tela)?.label ?? MARCA);
  const nomeDaFabrica = estado.fabricas.find((f) => f.id === fabricaId)?.project;
  const sub = naFabrica
    ? `Fábricas  ›  ${nomeDaFabrica ?? 'fábrica fora do painel'}`
    : tela === 'overview'
      ? `${diaPorExtenso(estado.agora)} · ${plural(estado.contagem.total, 'fábrica no painel', 'fábricas no painel')}`
      : undefined;

  const direita =
    tela === 'overview' ? (
      <div className="flex flex-col items-end gap-1">
        <Button variant="primary" icon={<Icon name="plus" size={16} />} disabled>
          Abrir nova fábrica
        </Button>
        <span className="caption gf-faint">{MOTIVO_DE_ABRIR_FABRICA}</span>
      </div>
    ) : undefined;

  let corpo: React.ReactNode;
  if (naFabrica) {
    corpo = (
      <FabricaTela
        base={base}
        estado={estado}
        fabricaId={fabricaId as string}
        verPedido={() => {
          setFabricaId(null);
          setTela('overview');
        }}
      />
    );
  } else if (tela === 'overview') {
    corpo = (
      <VisaoGeral
        estado={estado}
        abrirFabrica={(id) => {
          setFabricaId(id);
          setTela('factory');
        }}
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
          onBack={
            naFabrica
              ? () => {
                  setFabricaId(null);
                  setTela('overview');
                }
              : undefined
          }
        />
        {faixa}
        {comKpis ? <LinhaDeIndicadores estado={estado} /> : null}
        {corpo}
      </main>
    </div>
  );
}
