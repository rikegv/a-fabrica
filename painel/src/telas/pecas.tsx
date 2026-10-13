/*
 * Pecas de montagem das telas, portadas das montagens do pacote do designer
 * (prototipo/computador.js e prototipo/celular.js): barra superior, painel de
 * vidro, cabecalho do celular e estado vazio.
 *
 * Elas organizam a tela; os componentes do design system continuam sendo os do
 * pacote, em src/componentes/ds.
 */

import type { CSSProperties, ReactNode } from 'react';
import { Icon, cx } from '@/componentes/ds';

export function Topbar({
  title,
  sub,
  right,
  onBack
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <header className="gf-topbar">
      {onBack ? (
        <button
          type="button"
          className="gf-iconbtn"
          aria-label="Voltar"
          onClick={onBack}
          style={{ width: 36, height: 36 }}
        >
          <Icon name="back" size={18} />
        </button>
      ) : null}
      <div className="gf-topbar-title">
        <h1 className="title-lg">{title}</h1>
        {sub ? <div className="caption gf-muted">{sub}</div> : null}
      </div>
      {right}
    </header>
  );
}

export function Panel({
  title,
  sub,
  right,
  solid,
  style,
  className,
  children
}: {
  title?: string;
  sub?: string;
  right?: ReactNode;
  solid?: boolean;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx('gf-panel', solid ? 'gf-panel-solid' : 'gf-glass', className)} style={style}>
      {title ? (
        <div className="gf-panel-head">
          <h2 className="title-md">{title}</h2>
          {sub ? <span className="caption gf-muted">{sub}</span> : null}
          <span className="gf-push" />
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function MHead({
  title,
  sub,
  right,
  onBack
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <header className="gf-mhead">
      {onBack ? (
        <button
          type="button"
          className="gf-iconbtn"
          aria-label="Voltar"
          onClick={onBack}
          style={{ width: 44, height: 44 }}
        >
          <Icon name="back" size={18} />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="title-lg truncate">{title}</div>
        {sub ? <div className="caption gf-muted truncate">{sub}</div> : null}
      </div>
      {right}
    </header>
  );
}

/* Estado vazio com dignidade: diz o que e, sem parecer erro e sem inventar dado. */
export function Vazio({ titulo, detalhe, icone }: { titulo: string; detalhe: string; icone?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-6 text-center">
      {icone ? <span className="gf-faint mb-1 flex">{icone}</span> : null}
      <div className="title-sm">{titulo}</div>
      <p className="body gf-muted max-w-reading">{detalhe}</p>
    </div>
  );
}

/* Falha de leitura da base. Fica acima do conteudo, porque pede acao. */
export function Falha({ mensagem }: { mensagem: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-6 text-center">
      <div className="title-sm">A base não devolveu os dados</div>
      <p className="body gf-muted max-w-reading">{mensagem}</p>
    </div>
  );
}
