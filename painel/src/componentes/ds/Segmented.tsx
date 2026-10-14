'use client';

/* Segmented, portado de bundle.js. Escolha de uma opcao entre poucas, no lugar
   de uma lista: e o que a tela de nova fabrica usa para o modelo.

   Na Onda 1 este componente ficou de fora porque nenhuma tela do escopo o usava.
   A Onda 2 traz a tela de nova fabrica, que o usa, entao ele entra aqui com o
   mesmo desenho e as mesmas classes do pacote. */
import { cx } from './tipos';

export interface SegmentedOption {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface SegmentedProps {
  options: Array<string | SegmentedOption>;
  value: string;
  onChange?: (id: string) => void;
  block?: boolean;
  /** Rotulo para leitor de tela, porque o grupo nasce sem titulo visivel. */
  label?: string;
}

export function Segmented({ options, value, onChange, block, label }: SegmentedProps) {
  return (
    <div className={cx('gf-seg', block && 'gf-seg-block')} role="radiogroup" aria-label={label}>
      {(options ?? []).map((opcao) => {
        const o: SegmentedOption = typeof opcao === 'string' ? { id: opcao, label: opcao } : opcao;
        const ligada = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={ligada}
            disabled={o.disabled}
            className={cx('gf-seg-opt', 'caption', ligada && 'gf-seg-on')}
            onClick={() => onChange?.(o.id)}
          >
            {o.label}
            {o.hint ? <span className="gf-seg-hint">{o.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
