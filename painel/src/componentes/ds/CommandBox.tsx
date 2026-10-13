'use client';

/* CommandBox, portado de bundle.js. Caixa de comando no rodape da tela Fabrica.
   Desabilitada sempre diz por que, no proprio campo. Na Onda 1 ela entra sem
   onSend: alem de desabilitada, nao existe caminho de clique que escreva na
   base. */
import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { cx } from './tipos';

export interface CommandBoxProps {
  onSend?: (text: string) => void;
  onSaved?: () => void;
  placeholder?: string;
  defaultValue?: string;
  disabledReason?: string;
}

export function CommandBox({ onSend, onSaved, placeholder, defaultValue, disabledReason }: CommandBoxProps) {
  const [valor, setValor] = useState(defaultValue ?? '');
  const campo = useRef<HTMLTextAreaElement>(null);
  const off = Boolean(disabledReason) || !onSend;

  useEffect(() => {
    const el = campo.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  }, [valor]);

  function enviar() {
    if (!valor.trim() || off || !onSend) return;
    onSend(valor.trim());
    setValor('');
  }

  return (
    <div className={cx('gf-cmd', off && 'gf-cmd-off')}>
      <textarea
        ref={campo}
        rows={1}
        className="gf-cmd-input body"
        value={valor}
        disabled={off}
        aria-label="Comando para esta fábrica"
        placeholder={off ? disabledReason : (placeholder ?? 'Escreva uma ordem para esta fábrica')}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviar();
          }
        }}
      />
      <div className="gf-cmd-bar">
        {onSaved ? (
          <button type="button" className="gf-linkbtn caption" onClick={onSaved} disabled={off}>
            Comandos salvos
          </button>
        ) : (
          <span />
        )}
        {off ? null : <span className="caption gf-faint gf-cmd-hint">Enter envia. Shift + Enter quebra a linha.</span>}
        <Button
          variant="primary"
          className={off ? 'ml-auto' : undefined}
          onClick={off ? undefined : enviar}
          disabled={off || !valor.trim()}
        >
          Enviar
        </Button>
      </div>
    </div>
  );
}
