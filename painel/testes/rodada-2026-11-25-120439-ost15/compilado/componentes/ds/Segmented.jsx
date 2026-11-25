"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Segmented = Segmented;
/* Segmented, portado de bundle.js. Escolha de uma opcao entre poucas, no lugar
   de uma lista: e o que a tela de nova fabrica usa para o modelo.

   Na Onda 1 este componente ficou de fora porque nenhuma tela do escopo o usava.
   A Onda 2 traz a tela de nova fabrica, que o usa, entao ele entra aqui com o
   mesmo desenho e as mesmas classes do pacote. */
const tipos_1 = require("./tipos");
function Segmented({ options, value, onChange, block, label }) {
    return (<div className={(0, tipos_1.cx)('gf-seg', block && 'gf-seg-block')} role="radiogroup" aria-label={label}>
      {(options ?? []).map((opcao) => {
            const o = typeof opcao === 'string' ? { id: opcao, label: opcao } : opcao;
            const ligada = o.id === value;
            return (<button key={o.id} type="button" role="radio" aria-checked={ligada} disabled={o.disabled} className={(0, tipos_1.cx)('gf-seg-opt', 'caption', ligada && 'gf-seg-on')} onClick={() => onChange?.(o.id)}>
            {o.label}
            {o.hint ? <span className="gf-seg-hint">{o.hint}</span> : null}
          </button>);
        })}
    </div>);
}
