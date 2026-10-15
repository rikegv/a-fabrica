/*
 * Pecas de montagem das telas, portadas das montagens do pacote do designer
 * (prototipo/computador.js e prototipo/celular.js): barra superior, painel de
 * vidro, cabecalho do celular e estado vazio.
 *
 * Elas organizam a tela; os componentes do design system continuam sendo os do
 * pacote, em src/componentes/ds.
 */

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Button, Icon, cx } from '@/componentes/ds';
import type { MarcaDaOrigem } from '@/dados/tradutor';
import { rotuloDaOrigem } from './textos';

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

/* Quanto tempo a fabrica pode levar para nascer antes de o painel dizer que algo
   deu errado. A ponte costuma criar a fabrica em menos de um segundo; vinte
   segundos e folga larga para maquina ocupada, e e curto o bastante para o
   diretor nao ficar olhando tela parada sem explicacao. */
export const PRAZO_PARA_NASCER_MS = 20_000;

/*
 * A FABRICA PEDIDA E AINDA NAO NASCIDA, §A.22.
 *
 * Este estado nao existia, e a falta dele foi o defeito que o diretor sentiu na
 * pele: ele abria uma fabrica, a ordem era aceita, e a tela nao dizia nada. Pior,
 * se o painel levasse ele para a fabrica nova, a tela diria "esta fabrica nao
 * esta mais no painel", porque nao sabia diferenciar "ainda nao nasceu" de "foi
 * encerrada". Uma frase falsa e assustadora para uma fabrica que estava a caminho.
 *
 * Agora sao tres momentos, e cada um diz a verdade daquele momento:
 *   esperando  a ordem foi registrada e a ponte vai abrir
 *   demorou    passou do prazo, com o motivo mais provavel e o proximo passo
 *   encerrada  a fabrica existiu e nao esta mais aqui
 */
export function EsperandoNascer({
  segundos,
  passouDoPrazo,
  pontePronta
}: {
  segundos: number;
  passouDoPrazo: boolean;
  pontePronta: boolean;
}) {
  if (!passouDoPrazo) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-6 text-center">
        <div className="title-sm">Ordem registrada, abrindo a fábrica</div>
        <p className="body gf-muted max-w-reading">
          A ordem está na fila da ponte e ela abre a fábrica em instantes. Esta tela se preenche sozinha
          quando os primeiros passos chegarem. Esperando há {segundos} segundo(s).
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-6 text-center">
      <div className="title-sm">A fábrica não nasceu em {segundos} segundos</div>
      <p className="body gf-muted max-w-reading">
        {pontePronta
          ? 'A ordem foi registrada e a ponte está no ar, então ela recebeu a ordem e algo travou na abertura. O motivo mais provável é a pasta do projeto não existir na máquina, ou o modelo pedido ter sido recusado. Veja a Visão geral: se a fábrica aparecer com falha, o motivo está escrito nela.'
          : 'A ponte ficou offline depois que a ordem foi registrada, então ninguém executou. A ordem continua na fila e é entregue quando a ponte voltar. Inicie a ponte na máquina.'}
      </p>
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

/* ---------- pecas da Onda 2 ---------- */

/* Erro de ESCRITA, do lado do controle que falhou. Fica na tela e nao
   desaparece sozinho: ordem que nao foi registrada nao pode sumir da vista do
   diretor, senao o painel estaria fingindo que deu certo. */
export function ErroDeEscrita({ mensagem, aoFechar }: { mensagem: string; aoFechar?: () => void }) {
  return (
    <div className="gf-erro" role="alert">
      <span className="body flex-1">{mensagem}</span>
      {aoFechar ? (
        <button type="button" className="gf-linkbtn caption" onClick={aoFechar}>
          Entendi
        </button>
      ) : null}
    </div>
  );
}

/* Aviso curto de que a ordem entrou na fila. Some sozinho, porque e boa
   noticia: o que fica na tela e o estado real da fabrica, ao vivo. */
export function Aviso({
  mensagem,
  celular,
  aoSumir,
  segundos = 4
}: {
  mensagem: string;
  celular?: boolean;
  aoSumir: () => void;
  segundos?: number;
}) {
  const guardado = useRef(aoSumir);
  guardado.current = aoSumir;
  useEffect(() => {
    const id = setTimeout(() => guardado.current(), segundos * 1000);
    return () => clearTimeout(id);
  }, [mensagem, segundos]);

  return (
    <div className={cx(celular ? 'gf-toast' : 'gf-aviso', 'gf-glass-strong', 'body-strong')} role="status">
      {mensagem}
    </div>
  );
}

/* Confirmacao do que nao tem volta. Usa a folha do pacote do designer: no
   celular ela sobe do pe, como o manual manda, e no computador a mesma folha
   fica no centro da tela. */
export function Confirmacao({
  titulo,
  detalhe,
  rotuloDoBotao,
  rotuloDeCancelar,
  perigo,
  celular,
  ocupado,
  erro,
  aoConfirmar,
  aoCancelar,
  children
}: {
  titulo: string;
  detalhe?: string;
  rotuloDoBotao: string;
  rotuloDeCancelar: string;
  perigo?: boolean;
  celular?: boolean;
  ocupado?: boolean;
  erro?: string | null;
  aoConfirmar: () => void;
  aoCancelar: () => void;
  children?: ReactNode;
}) {
  const tamanho = celular ? 'touch' : undefined;
  return (
    <div className={cx('gf-sheet-wrap', !celular && 'gf-sheet-centro')} onClick={ocupado ? undefined : aoCancelar}>
      {/* Fundo sólido, e não vidro, de propósito: o que não tem volta precisa ser
          lido sem o texto da tela de trás aparecendo por baixo. As duas classes
          são do pacote, e a cor sai de tokens.json. */}
      <div
        className="gf-sheet gf-panel-solid"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        {celular ? <span className="gf-sheet-grip" aria-hidden /> : null}
        <div className="title-md">{titulo}</div>
        {detalhe ? <div className="caption gf-muted">{detalhe}</div> : null}
        {children}
        {erro ? <ErroDeEscrita mensagem={erro} /> : null}
        <div className="gf-sheet-actions">
          <Button
            variant={perigo ? 'danger' : 'primary'}
            size={tamanho}
            block
            disabled={ocupado}
            onClick={aoConfirmar}
          >
            {ocupado ? 'Registrando...' : rotuloDoBotao}
          </Button>
          <Button variant="ghost" size={tamanho} block disabled={ocupado} onClick={aoCancelar}>
            {rotuloDeCancelar}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* Campo de formulario: rotulo em cima, controle embaixo, do jeito do pacote. */
export function Campo({
  rotulo,
  ajuda,
  direita,
  estica,
  children
}: {
  rotulo: string;
  ajuda?: string;
  direita?: ReactNode;
  estica?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="gf-field" style={estica ? { flex: 1, minHeight: 0 } : undefined}>
      <div className="flex items-center gap-2">
        <div className="label gf-muted flex-1">{rotulo}</div>
        {direita}
      </div>
      {children}
      {ajuda ? <span className="caption gf-faint">{ajuda}</span> : null}
    </div>
  );
}

/* Marcacao de origem do campo do pacote de aprovacao, aprovada na OST 2: fato
   capturado e uma coisa, leitura da ponte e outra, e a cor separa as duas antes
   da leitura do texto. */
export function MarcaDeOrigem({ marca }: { marca: MarcaDaOrigem | null }) {
  const rotulo = rotuloDaOrigem(marca);
  if (!rotulo || !marca) return null;
  return (
    <span className={cx('gf-origem', 'label', marca === 'fato' ? 'gf-origem-fato' : 'gf-origem-ponte')}>
      <span className="gf-origem-ponto" aria-hidden />
      {rotulo}
    </span>
  );
}
