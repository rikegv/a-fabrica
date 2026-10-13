/*
 * Tipos e rotulos do design system, portados de
 * gerenciador-de-fabricas/design-system/components/index.d.ts e bundle.js.
 *
 * Os nomes dos tipos ficam em ingles de proposito: sao os do pacote do
 * designer. A base na nuvem fala portugues, e a traducao entre os dois mora
 * num arquivo so, src/dados/tradutor.ts.
 */

export type FactoryState = 'running' | 'approval' | 'idle' | 'done' | 'failed' | 'offline';
export type RiskLevel = 'low' | 'medium' | 'high';

export const ESTADOS: Record<FactoryState, { label: string }> = {
  running: { label: 'Em execução' },
  approval: { label: 'Aguardando aprovação' },
  idle: { label: 'Aguardando comando' },
  done: { label: 'Concluída' },
  failed: { label: 'Falhou' },
  offline: { label: 'Ponte offline' }
};

/* Rotulo curto, usado no celular e em tabela: o manual do StateBadge permite. */
export function rotuloCurto(estado: FactoryState): string {
  if (estado === 'approval') return 'Aprovação';
  if (estado === 'idle') return 'Ociosa';
  return ESTADOS[estado].label;
}

export function cx(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(' ');
}
