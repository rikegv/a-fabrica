'use client';

/*
 * OST 11, Fábricas fechadas. Vai para cá:
 *  - toda fábrica concluída;
 *  - toda fábrica que perdeu a conexão há mais de 24 horas;
 *  - e a que falhou há mais de 24 horas, decisão miúda da fábrica: falha pede
 *    o diretor, então fica um dia na Visão geral antes de vir para cá.
 * Nada é apagado, §A.17. A fábrica só muda de lugar, e abre igual.
 */

import { useState } from 'react';
import { FactoryCard, Pager } from '@/componentes/ds';
import type { EstadoDoPainel } from '@/dados/painel';
import { plural, quandoCurto } from '@/formato';
import { Falha, Panel, Vazio } from './pecas';

const POR_PAGINA = 12;

export function FabricasFechadas({
  estado,
  abrirFabrica
}: {
  estado: EstadoDoPainel;
  abrirFabrica: (id: string) => void;
}) {
  const [pagina, setPagina] = useState(1);
  const lista = estado.fabricasFechadas;
  const total = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const atual = Math.min(pagina, total);
  const visiveis = lista.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  return (
    <div className="gf-body" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
      <Panel
        title="Fábricas fechadas"
        sub={
          lista.length
            ? `${plural(lista.length, 'fábrica', 'fábricas')} · a mais recente primeiro · concluídas e sem conexão há mais de 24 horas`
            : undefined
        }
        right={lista.length > POR_PAGINA ? <Pager page={atual} total={total} onChange={setPagina} /> : undefined}
      >
        {estado.erro ? (
          <Falha mensagem={estado.erro} />
        ) : lista.length === 0 ? (
          <Vazio
            titulo={estado.carregando ? 'Lendo a base' : 'Nenhuma fábrica fechada'}
            detalhe="Quando uma fábrica concluir, ou ficar mais de 24 horas sem conexão, ela sai da Visão geral e vem para cá. Nada é apagado."
          />
        ) : (
          <div className="gf-fgrid gf-fgrid-compact">
            {visiveis.map((f) => (
              <FactoryCard
                key={f.id}
                project={f.project}
                agent={`${f.projeto} · ${f.model}`}
                compact
                state={f.state}
                doing={
                  f.state === 'offline' && f.perdeuConexaoEm
                    ? `Perdeu a conexão em ${quandoCurto(f.perdeuConexaoEm, estado.agora)}.`
                    : f.doing
                }
                elapsed={f.elapsed}
                usage={f.usage}
                opened={f.ondeRoda ? `${f.abertaEm} · ${f.ondeRoda}` : f.abertaEm}
                onOpen={() => abrirFabrica(f.id)}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
