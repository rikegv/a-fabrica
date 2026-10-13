'use client';

/*
 * Destino inerte. A navegacao do pacote do designer aponta para sete telas; esta
 * onda constroi duas, Visao geral e Fabrica. As outras cinco existem como
 * destino, ficam inertes e dizem na tela em que onda entram, §A.12. Nenhuma
 * tela e inventada aqui.
 */

import { Icon } from '@/componentes/ds';
import { Panel, Vazio } from './pecas';
import { DESTINOS_INERTES } from './textos';

export function Inerte({ destino }: { destino: string }) {
  const texto = DESTINOS_INERTES[destino] ?? {
    titulo: 'Esta tela entra numa onda seguinte',
    detalhe: 'Nesta onda, o painel mostra a Visão geral e a tela da fábrica.'
  };
  return (
    <div className="gf-body" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
      <Panel>
        <Vazio titulo={texto.titulo} detalhe={texto.detalhe} icone={<Icon name="overview" size={20} />} />
      </Panel>
    </div>
  );
}
