"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactoryCard = FactoryCard;
/* FactoryCard, portado de bundle.js. Cartao de uma fabrica na Visao geral.

   OST 9: modo COMPACTO, pedido do diretor para caber mais fabricas na mesma
   altura. O compacto guarda o que ele pediu para nao perder: estado, nome, tempo
   da tarefa e consumo, mais a linha de pedido parado, que e quando ele precisa
   agir. Sai a frase do que a fabrica faz, porque ela e escrita a partir do
   proprio estado e repetia o selo; a tela da fabrica continua mostrando o passo
   real. */
const Icon_1 = require("./Icon");
const StateBadge_1 = require("./StateBadge");
const StateIcon_1 = require("./StateIcon");
const tipos_1 = require("./tipos");
function FactoryCard({ project, agent, state = 'idle', doing, elapsed, usage, pending, opened, onOpen, compact }) {
    const quando = opened ? <div className="caption gf-faint gf-fcard-agent">{opened}</div> : null;
    const pedido = pending ? (<div className="caption gf-fcard-pending">
      <StateIcon_1.StateIcon state="approval" size={10}/>
      {pending}
    </div>) : null;
    const pe = (<div className="caption gf-fcard-foot">
      <span className="mono gf-fcard-nums">{elapsed}</span>
      <span className="mono gf-fcard-nums">{usage}</span>
    </div>);
    const conteudo = compact ? (<>
      <div className="gf-fcard-top">
        <StateBadge_1.StateBadge state={state}/>
        {onOpen ? (<span className="gf-faint gf-fcard-go">
            <Icon_1.Icon name="chevronRight" size={16}/>
          </span>) : null}
      </div>
      <div className="gf-fcard-id">
        <div className="title-sm gf-fcard-project" title={project}>
          {project}
        </div>
        <div className="caption gf-faint gf-fcard-agent" title={agent}>
          {agent}
        </div>
        {quando}
      </div>
      {pedido}
      {pe}
    </>) : (<>
      <div className="gf-fcard-top">
        <StateBadge_1.StateBadge state={state}/>
        {onOpen ? (<span className="gf-faint gf-fcard-go">
            <Icon_1.Icon name="chevronRight" size={16}/>
          </span>) : null}
      </div>
      <div>
        <div className="title-sm gf-fcard-project">{project}</div>
        <div className="caption gf-faint gf-fcard-agent">{agent}</div>
        {quando}
      </div>
      <div className="body gf-fcard-doing">{doing}</div>
      {pedido}
      {pe}
    </>);
    const classe = (0, tipos_1.cx)('gf-card', 'gf-glass', 'gf-fcard', 'gf-fcard-' + state, compact && 'gf-fcard-compact');
    if (onOpen) {
        return (<button type="button" onClick={onOpen} className={classe}>
        {conteudo}
      </button>);
    }
    return <div className={classe}>{conteudo}</div>;
}
