/*
 * Textos de tela que se repetem. Travessão proibido em todos, §A.11: so
 * vírgula, ponto, dois-pontos, parênteses e o ponto médio para separar
 * metadados.
 *
 * Esta onda e a Onda 2, comandar e aprovar: o painel escreve. Os controles de
 * comando e de decisao estao vivos, e desabilitam apenas quando a ordem nao
 * teria para onde ir, dizendo na hora por que. O que continua fora de escopo
 * segue como destino inerte, dito na tela e nao escondido.
 */

import type { Impedimento } from '@/dados/escritas';
import { ROTULO_DA_ORIGEM, type MarcaDaOrigem } from '@/dados/tradutor';

export const MARCA = 'A Fábrica';
export const DONO = 'Operação de Rike';

/* Por que o controle de escrita esta desabilitado agora, dito antes do clique.
   Null significa liberado, e a tela nao mostra frase nenhuma.

   A frase muda com o controle, porque "nenhuma ordem sai daqui" não serve para
   responder aprovação e "a fábrica não recebe ordem" não serve para abrir. */
function frase(impedimento: Impedimento | null, mapa: Record<Impedimento, string>): string | null {
  return impedimento ? mapa[impedimento] : null;
}

export function motivoDaCaixaDeComando(impedimento: Impedimento | null): string | null {
  return frase(impedimento, {
    'ponte offline': 'A ponte está offline, nenhuma ordem sai daqui até ela voltar.',
    'sem maquina': 'Nenhuma ponte pareada ainda, então não existe máquina para receber a ordem.',
    'sem base': 'O painel perdeu a ligação com a base. Recarregue para mandar ordem.',
    'sem sessao': 'A sua sessão não está mais válida. Entre de novo para mandar ordem.'
  });
}

export function motivoDaDecisao(impedimento: Impedimento | null): string | null {
  return frase(impedimento, {
    'ponte offline': 'A ponte está offline, a resposta não chega à fábrica até ela voltar.',
    'sem maquina': 'Nenhuma ponte pareada ainda, então a resposta não chega a ninguém.',
    'sem base': 'O painel perdeu a ligação com a base. Recarregue para responder.',
    'sem sessao': 'A sua sessão não está mais válida. Entre de novo para responder.'
  });
}

export function motivoDasAcoesDaFabrica(impedimento: Impedimento | null): string | null {
  return frase(impedimento, {
    'ponte offline': 'A ponte está offline. Pausar, reiniciar e encerrar voltam quando ela voltar.',
    'sem maquina': 'Nenhuma ponte pareada ainda, então a fábrica não recebe ordem.',
    'sem base': 'O painel perdeu a ligação com a base. Recarregue para comandar a fábrica.',
    'sem sessao': 'A sua sessão não está mais válida. Entre de novo para comandar a fábrica.'
  });
}

export function motivoDeAbrirFabrica(impedimento: Impedimento | null): string | null {
  return frase(impedimento, {
    'ponte offline': 'A ponte está offline, a fábrica só nasce quando ela voltar.',
    'sem maquina': 'Nenhuma ponte pareada ainda, então não existe máquina para abrir a fábrica.',
    'sem base': 'O painel perdeu a ligação com a base. Recarregue para abrir fábrica.',
    'sem sessao': 'A sua sessão não está mais válida. Entre de novo para abrir fábrica.'
  });
}

/* Marcação de honestidade do pacote de aprovação, como a OST 2 aprovou. */
export function rotuloDaOrigem(marca: MarcaDaOrigem | null): string | null {
  return marca ? ROTULO_DA_ORIGEM[marca] : null;
}

export const EXPLICACAO_DA_ORIGEM =
  'Cada campo diz de onde veio: fato capturado é o que o portão viu, leitura da ponte é o que ela concluiu do que viu.';

/* Confirmação do que não tem volta, §7 do contrato da Onda 2. */
export const CONFIRMAR_ENCERRAR = {
  titulo: (projeto: string) => `Encerrar ${projeto}?`,
  detalhe:
    'A fábrica para agora e não volta por este caminho. O que ela já fez continua gravado na base, e a trilha não se apaga.',
  botao: 'Encerrar a fábrica',
  cancelar: 'Deixar rodando'
};

/* Avisos de que a ordem foi registrada. O painel não diz que a fábrica já fez,
   porque ele não sabe: ele sabe que a ordem entrou na fila da ponte. */
export const AVISOS = {
  comandoEnviado: 'Ordem registrada na fila da ponte.',
  fabricaAberta: 'Ordem de abertura registrada. A ponte confere o portão e abre a fábrica.',
  encerrada: 'Ordem de encerramento registrada.',
  pausada: 'Ordem de pausa registrada.',
  retomada: 'Ordem de retomada registrada.',
  reiniciada: 'Ordem de reinício registrada.',
  aprovado: 'Aprovado. A ponte libera a fábrica.',
  recusado: 'Recusado. A ponte devolve o motivo à fábrica.',
  aprovadoComObservacao: 'Aprovado com observação. A observação fica na trilha.'
};

/* Destinos que a navegação do pacote do designer aponta e que esta onda não
   constrói. O destino existe, fica inerte e diz o que é, §A.12. */
export const DESTINOS_INERTES: Record<string, { titulo: string; detalhe: string }> = {
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
      'Projetos cadastrados, situação da ponte e avisos no celular aparecem aqui. Nesta onda, a situação da ponte fica no pé do menu e na faixa do topo, e a tela de nova fábrica aceita o caminho do projeto escrito à mão.'
  },
  more: {
    titulo: 'Mais entra nas ondas seguintes',
    detalhe:
      'Indicadores e Configurações moram aqui no celular. Nesta onda estão prontas Fábricas, Aprovações e a abertura de fábrica nova.'
  }
};
