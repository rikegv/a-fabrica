"use strict";
/*
 * Tipos e rotulos do design system, portados de
 * gerenciador-de-fabricas/design-system/components/index.d.ts e bundle.js.
 *
 * Os nomes dos tipos ficam em ingles de proposito: sao os do pacote do
 * designer. A base na nuvem fala portugues, e a traducao entre os dois mora
 * num arquivo so, src/dados/tradutor.ts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ESTADOS = void 0;
exports.rotuloCurto = rotuloCurto;
exports.cx = cx;
exports.ESTADOS = {
    running: { label: 'Em execução' },
    approval: { label: 'Aguardando aprovação' },
    idle: { label: 'Aguardando comando' },
    done: { label: 'Concluída' },
    failed: { label: 'Falhou' },
    offline: { label: 'Ponte offline' }
};
/* Rotulo curto, usado no celular e em tabela: o manual do StateBadge permite. */
function rotuloCurto(estado) {
    if (estado === 'approval')
        return 'Aprovação';
    if (estado === 'idle')
        return 'Ociosa';
    return exports.ESTADOS[estado].label;
}
function cx(...partes) {
    return partes.filter(Boolean).join(' ');
}
