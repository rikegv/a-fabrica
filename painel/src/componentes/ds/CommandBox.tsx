'use client';

/* CommandBox, portado de bundle.js. Caixa de comando no rodape da tela Fabrica.
   Desabilitada sempre diz por que, no proprio campo.

   Adicional do painel na Onda 2, porque escrever na base pode falhar e demora o
   que a rede demorar:

   - onSend pode devolver promessa com o resultado. Enquanto ela nao volta, a
     caixa fica em "Enviando" e nao aceita um segundo envio, para a mesma ordem
     nao entrar duas vezes na fila.
   - o texto SO e limpo quando a ordem foi registrada de verdade. Se a escrita
     falhar, o que o diretor escreveu continua no campo, e o erro aparece acima
     dele, em portugues. O painel nao finge que deu certo.
   - enquanto ha erro na tela, mexer no texto nao apaga o erro sozinho; ele sai
     quando a proxima tentativa der certo ou quando o diretor fechar. */
import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { cx } from './tipos';

export interface CommandBoxProps {
  onSend?: (text: string) => void | boolean | Promise<boolean | void>;
  onSaved?: () => void;
  placeholder?: string;
  defaultValue?: string;
  disabledReason?: string | null;
  /** Mensagem de falha da ultima tentativa, mostrada acima do campo. */
  error?: string | null;
  onDismissError?: () => void;
  touch?: boolean;
}

export function CommandBox({
  onSend,
  onSaved,
  placeholder,
  defaultValue,
  disabledReason,
  error,
  onDismissError,
  touch
}: CommandBoxProps) {
  const [valor, setValor] = useState(defaultValue ?? '');
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const off = Boolean(disabledReason) || !onSend;

  useEffect(() => {
    const el = campo.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  }, [valor]);

  async function enviar() {
    if (!valor.trim() || off || !onSend || enviando) return;
    setEnviando(true);
    try {
      const resultado = await onSend(valor.trim());
      /* Sem resposta explicita, a caixa trata como enviado: e o que o pacote do
         designer fazia. Com resposta falsa, o texto fica onde esta. */
      if (resultado !== false) setValor('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <div className="gf-erro" role="alert">
          <span className="body flex-1">{error}</span>
          {onDismissError ? (
            <button type="button" className="gf-linkbtn caption" onClick={onDismissError}>
              Entendi
            </button>
          ) : null}
        </div>
      ) : null}
      <div className={cx('gf-cmd', off && 'gf-cmd-off')}>
        <textarea
          ref={campo}
          rows={1}
          className="gf-cmd-input body"
          value={valor}
          disabled={off || enviando}
          aria-label="Comando para esta fábrica"
          placeholder={off ? (disabledReason ?? '') : (placeholder ?? 'Escreva uma ordem para esta fábrica')}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviar();
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
          {off ? null : (
            <span className="caption gf-faint gf-cmd-hint">Enter envia. Shift + Enter quebra a linha.</span>
          )}
          <Button
            variant="primary"
            size={touch ? 'touch' : undefined}
            className={off ? 'ml-auto' : undefined}
            onClick={off ? undefined : () => void enviar()}
            disabled={off || enviando || !valor.trim()}
          >
            {enviando ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
