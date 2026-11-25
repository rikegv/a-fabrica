"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalItem = ApprovalItem;
/* ApprovalItem, portado de bundle.js. Um pedido de aprovacao completo.

   Adicionais do painel:

   - readOnlyReason: com ele, os tres botoes aparecem desabilitados de verdade
     (sem onClick, com disabled), o campo de motivo nunca abre e nada pode ser
     escrito na base. E assim que a tela mostra que a ordem nao tem para onde ir,
     por exemplo com a ponte offline.
   - origins: a marcacao de honestidade aprovada na OST 2. Cada campo do pacote
     diz se e fato capturado pelo portao ou leitura da ponte sobre o que viu. O
     painel NAO esconde essa marcacao: ela e o que permite ao diretor confiar no
     pacote.
   - busy, error e onDismissError: responder escreve na base e pode falhar. O
     botao diz "Registrando", nao aceita segunda resposta, e a falha aparece em
     portugues, no proprio pedido. Em aprovar com observacao a observacao e
     obrigatoria, e o botao fica desabilitado enquanto ela estiver vazia. */
const react_1 = require("react");
const Button_1 = require("./Button");
const RiskTag_1 = require("./RiskTag");
const StateIcon_1 = require("./StateIcon");
const tipos_1 = require("./tipos");
const DECISAO = {
    approved: 'Aprovado',
    rejected: 'Recusado',
    noted: 'Aprovado com observação'
};
function Bloco({ rotulo, corpo, origem }) {
    return (<div className="gf-ap-block">
      <div className="flex items-center gap-2">
        <div className="label gf-muted">{rotulo}</div>
        {origem}
      </div>
      <div className="body">{corpo}</div>
    </div>);
}
function ApprovalItem(props) {
    const [modo, setModo] = (0, react_1.useState)(null);
    const [texto, setTexto] = (0, react_1.useState)('');
    const risco = props.risk ?? 'low';
    const somenteLeitura = Boolean(props.readOnlyReason);
    const ocupado = props.busy === true;
    if (props.decision) {
        return (<div className="gf-card gf-glass gf-ap gf-ap-done">
        <div className="gf-ap-row">
          <span className={(0, tipos_1.cx)('caption', 'gf-dec', 'gf-dec-' + props.decision)}>{DECISAO[props.decision]}</span>
          <span className="title-sm gf-ap-donetitle">{props.title}</span>
          <span className="caption gf-faint gf-push">{props.decidedAt}</span>
        </div>
        {props.note ? <div className="caption gf-muted gf-ap-note">{'Observação: ' + props.note}</div> : null}
      </div>);
    }
    function confirmar() {
        if (somenteLeitura || ocupado)
            return;
        if (modo === 'reject' && props.onReject)
            props.onReject(texto.trim());
        if (modo === 'note' && props.onApproveWithNote) {
            if (!texto.trim())
                return;
            props.onApproveWithNote(texto.trim());
        }
    }
    const origens = props.origins ?? {};
    const informacao = (<>
      <div className="gf-ap-row">
        <RiskTag_1.RiskTag level={risco}/>
        {origens.risk}
        <span className="caption gf-muted">
          {props.project}
          {props.task ? ' · ' + props.task : ''}
        </span>
        <span className={(0, tipos_1.cx)('caption', 'gf-push', props.stale ? 'gf-wait-stale' : 'gf-faint')}>
          <StateIcon_1.StateIcon state="approval" size={10}/>
          {' parado há ' + (props.waiting ?? '')}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {/* flex-wrap com min-w-0: no celular o titulo tem palavra longa, como
            nome de tabela, e sem isto a marcacao de origem saia pela borda. */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="title-sm gf-ap-title min-w-0 flex-1 break-words">{props.title}</h3>
          {origens.title}
        </div>
        {props.tool ? <span className="mono gf-faint">{props.tool}</span> : null}
      </div>
      {props.originsHint ? <span className="caption gf-faint">{props.originsHint}</span> : null}
      <div className="gf-ap-grid">
        <Bloco rotulo="Por que" corpo={props.why} origem={origens.why}/>
        <Bloco rotulo="Impacto" corpo={props.impact} origem={origens.impact}/>
      </div>
      {props.agentSaid ? (<Bloco rotulo="O agente disse" corpo={props.agentSaid} origem={origens.agentSaid}/>) : null}
      {props.touches && props.touches.length ? (<div className="gf-ap-block">
          <div className="flex items-center gap-2">
            <div className="label gf-muted">O que será tocado</div>
            {origens.touches}
          </div>
          <ul className="gf-touch">
            {props.touches.map((t, i) => (<li key={i} className="mono">
                {t}
              </li>))}
          </ul>
        </div>) : null}
    </>);
    const tamanho = props.touch ? 'touch' : undefined;
    const erro = props.error ? (<div className="gf-erro" role="alert">
      <span className="body flex-1">{props.error}</span>
      {props.onDismissError ? (<button type="button" className="gf-linkbtn caption" onClick={props.onDismissError}>
          Entendi
        </button>) : null}
    </div>) : null;
    let acoes;
    if (somenteLeitura) {
        acoes = (<>
        <div className="gf-ap-actions">
          <Button_1.Button variant="primary" size={tamanho} disabled>
            Aprovar
          </Button_1.Button>
          <Button_1.Button variant="secondary" size={tamanho} disabled>
            {props.touch ? 'Com observação' : 'Aprovar com observação'}
          </Button_1.Button>
          <Button_1.Button variant="danger" size={tamanho} disabled>
            Recusar
          </Button_1.Button>
        </div>
        <div className="caption gf-faint gf-motivo">{props.readOnlyReason}</div>
      </>);
    }
    else if (modo) {
        const faltaObservacao = modo === 'note' && !texto.trim();
        acoes = (<div className="gf-ap-reason">
        <label className="caption gf-muted" htmlFor={'motivo-' + (props.id ?? 'pedido')}>
          {modo === 'reject' ? 'Motivo da recusa (opcional)' : 'Observação para a fábrica (obrigatória)'}
        </label>
        <textarea id={'motivo-' + (props.id ?? 'pedido')} className="gf-input body" rows={2} value={texto} autoFocus disabled={ocupado} onChange={(e) => setTexto(e.target.value)} placeholder={modo === 'reject' ? 'Ex.: não mexa no banco de produção.' : 'Ex.: pode seguir, mas faça backup antes.'}/>
        {erro}
        <div className="gf-ap-actions">
          <Button_1.Button variant={modo === 'reject' ? 'danger' : 'primary'} size={tamanho} disabled={ocupado || faltaObservacao} onClick={confirmar}>
            {ocupado ? 'Registrando...' : modo === 'reject' ? 'Confirmar recusa' : 'Aprovar com observação'}
          </Button_1.Button>
          <Button_1.Button variant="ghost" size={tamanho} disabled={ocupado} onClick={() => {
                setModo(null);
                setTexto('');
                props.onDismissError?.();
            }}>
            Cancelar
          </Button_1.Button>
        </div>
        {faltaObservacao ? (<span className="caption gf-faint">Escreva a observação para poder aprovar com ela.</span>) : null}
      </div>);
    }
    else {
        acoes = (<>
        {erro}
        <div className="gf-ap-actions">
          <Button_1.Button variant="primary" size={tamanho} disabled={ocupado} onClick={props.onApprove}>
            {ocupado ? 'Registrando...' : 'Aprovar'}
          </Button_1.Button>
          <Button_1.Button variant="secondary" size={tamanho} disabled={ocupado} onClick={() => setModo('note')}>
            {props.touch ? 'Com observação' : 'Aprovar com observação'}
          </Button_1.Button>
          <Button_1.Button variant="danger" size={tamanho} disabled={ocupado} onClick={() => setModo('reject')}>
            Recusar
          </Button_1.Button>
        </div>
      </>);
    }
    if (props.flat) {
        /* No deck as acoes ficam fixas; so os detalhes acima delas rolam, no
           celular baixo, como o manual autoriza. */
        return (<article className={(0, tipos_1.cx)('gf-ap-flat', 'gf-ap', 'gf-ap-' + risco)}>
        <div className="gf-ap-content">{informacao}</div>
        <div className="gf-ap-foot">{acoes}</div>
      </article>);
    }
    return (<article className={(0, tipos_1.cx)('gf-card gf-glass', 'gf-ap', 'gf-ap-' + risco)}>
      {informacao}
      {acoes}
    </article>);
}
