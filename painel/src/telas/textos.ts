/*
 * Textos de tela que se repetem. Travessão proibido em todos, §A.11: so
 * vírgula, ponto, dois-pontos, parênteses e o ponto médio para separar
 * metadados.
 *
 * Esta onda e a Onda 1, enxergar: o painel mostra e nao escreve. Os controles
 * de comando e de decisao aparecem desabilitados, dizendo em que onda entram.
 */

import type { SituacaoDaPonte } from '@/dados/tradutor';

export const MARCA = 'A Fábrica';
export const DONO = 'Operação de Rike';

export function motivoDaCaixaDeComando(ponte: SituacaoDaPonte): string {
  if (ponte === 'offline') {
    return 'A ponte está offline, nenhuma ordem sai daqui. Mandar comando entra na Onda 2.';
  }
  if (ponte === 'sem maquina') {
    return 'Nenhuma ponte pareada ainda, nenhuma ordem sai daqui. Mandar comando entra na Onda 2.';
  }
  return 'Mandar comando entra na Onda 2. Nesta onda o painel é de leitura.';
}

export function motivoDaDecisao(ponte: SituacaoDaPonte): string {
  if (ponte === 'offline') return 'A ponte está offline. Responder entra na Onda 2.';
  if (ponte === 'sem maquina') return 'Sem ponte pareada. Responder entra na Onda 2.';
  return 'Responder aprovação entra na Onda 2.';
}

export const MOTIVO_DAS_ACOES_DA_FABRICA = 'Pausar, reiniciar e encerrar entram na Onda 2.';
export const MOTIVO_DE_ABRIR_FABRICA = 'Abrir nova fábrica entra na Onda 2.';

/* Destinos que a navegação do pacote do designer aponta e que esta onda não
   constrói. O destino existe, fica inerte e diz o que é. */
export const DESTINOS_INERTES: Record<string, { titulo: string; detalhe: string }> = {
  approvals: {
    titulo: 'A fila de aprovações entra na Onda 2',
    detalhe:
      'Nesta onda, o pedido parado aparece no painel Aguardando você, na Visão geral, e na tela da fábrica que pediu. Responder, com histórico e filtro, entra junto da Onda 2.'
  },
  factories: {
    titulo: 'A tela Fábricas entra numa onda seguinte',
    detalhe:
      'Nesta onda, a Visão geral lista as fábricas por urgência, pagina quando passam de seis e abre cada uma no posto de comando.'
  },
  reports: {
    titulo: 'Relatórios entra na Onda 3',
    detalhe: 'O fechamento por tarefa e o consolidado diário aparecem aqui quando a Onda 3 for construída.'
  },
  metrics: {
    titulo: 'Indicadores entra na Onda 4',
    detalhe:
      'Tempo e consumo por dia, por projeto e por fábrica aparecem aqui quando a Onda 4 for construída. Nesta onda, os números do dia estão na linha de indicadores da Visão geral.'
  },
  settings: {
    titulo: 'Configurações entra numa onda seguinte',
    detalhe:
      'Projetos cadastrados, situação da ponte e avisos no celular aparecem aqui. Nesta onda, a situação da ponte fica no pé do menu e na faixa do topo.'
  },
  more: {
    titulo: 'Mais entra nas ondas seguintes',
    detalhe: 'Indicadores e Configurações moram aqui no celular. Nesta onda, só Fábricas e Aprovações estão prontas.'
  }
};
