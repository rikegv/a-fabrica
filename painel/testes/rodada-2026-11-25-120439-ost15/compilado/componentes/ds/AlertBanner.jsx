"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertBanner = AlertBanner;
const StateIcon_1 = require("./StateIcon");
const tipos_1 = require("./tipos");
function AlertBanner({ tone = 'approval', title, detail, actionLabel, onAction, actionDisabled }) {
    return (<div className={(0, tipos_1.cx)('gf-banner', 'gf-banner-' + tone)} role={tone === 'approval' ? 'status' : 'alert'}>
      <span className="gf-banner-icon">
        <StateIcon_1.StateIcon state={tone} size={16}/>
      </span>
      <div className="gf-banner-text">
        <div className="title-sm">{title}</div>
        {detail ? <div className="caption gf-banner-detail">{detail}</div> : null}
      </div>
      {actionLabel ? (<button type="button" className="gf-btn gf-banner-btn body-strong" onClick={actionDisabled ? undefined : onAction} disabled={actionDisabled} aria-disabled={actionDisabled ? true : undefined}>
          {actionLabel}
        </button>) : null}
    </div>);
}
