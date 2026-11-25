"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Button = Button;
const tipos_1 = require("./tipos");
function Button({ variant = 'secondary', size, block, icon, className, children, type, disabled, ...resto }) {
    return (<button {...resto} type={type ?? 'button'} disabled={disabled} aria-disabled={disabled ? true : undefined} className={(0, tipos_1.cx)('gf-btn', 'gf-btn-' + variant, size === 'touch' && 'gf-btn-touch', block && 'gf-btn-block', 'body-strong', className)}>
      {icon ?? null}
      {children}
    </button>);
}
