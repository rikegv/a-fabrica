"use strict";
/*
 * OST 16, CRACHÁ POR MÁQUINA. Cálculo puro, sem React e sem Firebase, para poder
 * ser provado sozinho (painel/testes/rodada-...-ost16/prova.cjs).
 *
 * O contrato é docs/ost16-contrato.md. Aqui moram as decisões que a tela e a
 * camada de escrita tomam ANTES de gravar:
 *
 *  - quais pedidos estão abertos: os de menos de 15 minutos, cujo uid ainda não
 *    tem crachá (N2, R12);
 *  - quando a emissão é barrada: mais de um pedido aberto para a mesma máquina
 *    ou com o mesmo código, lista no teto, pedido malformado ou vencido (N1);
 *  - o que o lote grava: criar o crachá novo e, na MESMA gravação, revogar todo
 *    crachá ativo da máquina (N3). Revogar sozinho também revoga todos os ativos
 *    da máquina.
 *
 * A hora do servidor entra de fora (H), porque serverTimestamp() é do Firebase e
 * este arquivo não carrega o Firebase. A camada de escrita passa
 * serverTimestamp(); a prova passa um marcador.
 *
 * Texto que vem da base só vai para a tela como texto filho do React, N4. Nada
 * daqui vira HTML, endereço ou estilo.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PADRAO_CODIGO = exports.PADRAO_MAQUINA = exports.FOLGA_DO_RELOGIO_MS = exports.LIMITE_DE_PEDIDOS = exports.JANELA_DO_PEDIDO_MS = void 0;
exports.traduzirPedido = traduzirPedido;
exports.traduzirCracha = traduzirCracha;
exports.uidCurto = uidCurto;
exports.maquinaCurta = maquinaCurta;
exports.chamadaDoPedido = chamadaDoPedido;
exports.chamadaDoCracha = chamadaDoCracha;
exports.dentroDaJanela = dentroDaJanela;
exports.inicioDaJanela = inicioDaJanela;
exports.pedidosAbertos = pedidosAbertos;
exports.restaDoPedido = restaDoPedido;
exports.duplicidadeDoPedido = duplicidadeDoPedido;
exports.temDuplicidade = temDuplicidade;
exports.ativosDaMaquina = ativosDaMaquina;
exports.ordenarCrachas = ordenarCrachas;
exports.barreiraDaEmissao = barreiraDaEmissao;
exports.fraseDaBarreira = fraseDaBarreira;
exports.loteDeEmissao = loteDeEmissao;
exports.loteDeRevogacao = loteDeRevogacao;
exports.origemDoPainel = origemDoPainel;
const tradutor_1 = require("./tradutor");
/* ---------- limites do contrato ---------- */
/* R12 e N2: pedido vale por 15 minutos, contados da hora do servidor. */
exports.JANELA_DO_PEDIDO_MS = 15 * 60000;
/* N2: a consulta de pedidos traz no máximo 20. */
exports.LIMITE_DE_PEDIDOS = 20;
/* Folga para relógio do computador um pouco atrás do servidor: pedido "do
   futuro" até este tanto ainda é aceito como aberto. Além disso, é descartado. */
exports.FOLGA_DO_RELOGIO_MS = 2 * 60000;
exports.PADRAO_MAQUINA = /^maquina-[a-z0-9-]{1,40}$/;
exports.PADRAO_CODIGO = /^[0-9]{6}$/;
function texto(valor, teto = 80) {
    if (typeof valor !== 'string')
        return null;
    const limpo = valor.replace(/\s+/g, ' ').trim();
    return limpo ? limpo.slice(0, teto) : null;
}
function traduzirPedido(doc) {
    const uid = typeof doc.uid === 'string' ? doc.uid : '';
    const maquinaId = typeof doc.maquinaId === 'string' ? doc.maquinaId : '';
    const codigo = typeof doc.codigo === 'string' ? doc.codigo : '';
    let malformado = null;
    if (!uid || uid !== doc.id)
        malformado = 'o uid do pedido não é o mesmo do documento';
    else if (!exports.PADRAO_MAQUINA.test(maquinaId))
        malformado = 'a máquina do pedido não tem o formato esperado';
    else if (!exports.PADRAO_CODIGO.test(codigo))
        malformado = 'o código do pedido não tem seis dígitos';
    return {
        id: doc.id,
        uid,
        maquinaId,
        nome: texto(doc.nome, 60),
        /* O rótulo vai para o crachá exatamente como está no pedido, sem limpar,
           porque a regra pode comparar os dois. A tela mostra com chamadaDoPedido,
           como texto do React. */
        rotulo: typeof doc.rotulo === 'string' && doc.rotulo ? doc.rotulo : null,
        codigo,
        criadoEm: (0, tradutor_1.paraData)(doc.criadoEm),
        malformado
    };
}
function traduzirCracha(doc) {
    return {
        id: doc.id,
        uid: typeof doc.uid === 'string' ? doc.uid : doc.id,
        maquinaId: typeof doc.maquinaId === 'string' ? doc.maquinaId : '',
        rotulo: texto(doc.rotulo, 40),
        /* Só o valor exato true é ativo. Qualquer outra coisa conta como revogado. */
        ativo: doc.ativo === true,
        emitidoEm: (0, tradutor_1.paraData)(doc.emitidoEm),
        emitidoPor: texto(doc.emitidoPor, 120),
        revogadoEm: (0, tradutor_1.paraData)(doc.revogadoEm),
        revogadoPor: texto(doc.revogadoPor, 120)
    };
}
/* ---------- como a tela escreve ---------- */
/* P5 e N1: os 8 primeiros caracteres do uid, os mesmos que o terminal mostra. */
function uidCurto(uid) {
    return uid.slice(0, 8);
}
/* "maquina-fa546467f75e" cabe inteiro. Mais comprido que isso, corta. */
function maquinaCurta(maquinaId) {
    return maquinaId.length > 24 ? `${maquinaId.slice(0, 24)}...` : maquinaId;
}
/* Como a tela chama a máquina: rótulo, nome, identificador. */
function chamadaDoPedido(p) {
    return texto(p.rotulo, 40) ?? p.nome ?? p.maquinaId;
}
/* O crachá não guarda o nome da máquina; quando não tem rótulo, a tela passa o
   nome que a máquina publica em maquinas, se houver. */
function chamadaDoCracha(c, nomeDaMaquina) {
    return c.rotulo || nomeDaMaquina || c.maquinaId || uidCurto(c.uid);
}
/* ---------- janela e pedidos abertos ---------- */
function dentroDaJanela(criadoEm, agora) {
    if (!criadoEm)
        return false;
    const idade = agora.getTime() - criadoEm.getTime();
    return idade <= exports.JANELA_DO_PEDIDO_MS && idade >= -exports.FOLGA_DO_RELOGIO_MS;
}
/* O início da janela, para a consulta da base: criadoEm >= isto. */
function inicioDaJanela(agora) {
    return new Date(agora.getTime() - exports.JANELA_DO_PEDIDO_MS);
}
/* Pedidos abertos: dentro da janela e sem crachá já emitido para o mesmo uid
   (ativo ou revogado: crachá revogado não volta, contrato). Mais novo em cima. */
function pedidosAbertos(pedidos, crachas, agora) {
    const atendidos = new Set(crachas.map((c) => c.uid));
    return pedidos
        .filter((p) => dentroDaJanela(p.criadoEm, agora) && !atendidos.has(p.uid))
        .sort((a, b) => (b.criadoEm?.getTime() ?? 0) - (a.criadoEm?.getTime() ?? 0) || a.id.localeCompare(b.id));
}
/* Quanto falta para o pedido vencer, em ms. Zero ou menos é vencido. */
function restaDoPedido(p, agora) {
    if (!p.criadoEm)
        return 0;
    return p.criadoEm.getTime() + exports.JANELA_DO_PEDIDO_MS - agora.getTime();
}
function duplicidadeDoPedido(pedido, abertos) {
    const outros = abertos.filter((p) => p.uid !== pedido.uid);
    return {
        mesmaMaquina: outros.filter((p) => p.maquinaId === pedido.maquinaId).length,
        mesmoCodigo: outros.filter((p) => p.codigo === pedido.codigo).length
    };
}
function temDuplicidade(d) {
    return d.mesmaMaquina > 0 || d.mesmoCodigo > 0;
}
/* ---------- crachás da máquina ---------- */
function ativosDaMaquina(crachas, maquinaId) {
    return crachas.filter((c) => c.ativo && c.maquinaId === maquinaId);
}
/* Lista da tela: ativos primeiro, depois revogados; dentro de cada grupo, o
   emitido mais novo em cima. */
function ordenarCrachas(crachas) {
    return [...crachas].sort((a, b) => Number(b.ativo) - Number(a.ativo) ||
        (b.emitidoEm?.getTime() ?? 0) - (a.emitidoEm?.getTime() ?? 0) ||
        a.id.localeCompare(b.id));
}
/*
 * Decide se este pedido pode virar crachá agora. A ordem importa: o que é mais
 * grave aparece primeiro. Falha fechada: na dúvida, barra.
 *
 *  abertos     todos os pedidos abertos, inclusive este
 *  listaCheia  a consulta voltou no teto de 20: pode haver pedido que o painel
 *              não viu, então a duplicidade não pode ser descartada
 *  conferido   o diretor confirmou na tela que o código e o começo do uid são os
 *              do terminal da máquina
 */
function barreiraDaEmissao(pedido, contexto) {
    if (pedido.malformado)
        return { tipo: 'malformado', motivo: pedido.malformado };
    if (contexto.crachas.some((c) => c.uid === pedido.uid))
        return { tipo: 'ja emitido' };
    if (!dentroDaJanela(pedido.criadoEm, contexto.agora))
        return { tipo: 'vencido' };
    if (contexto.listaCheia)
        return { tipo: 'lista cheia' };
    const duplicidade = duplicidadeDoPedido(pedido, contexto.abertos);
    if (temDuplicidade(duplicidade))
        return { tipo: 'duplicado', duplicidade };
    if (!contexto.conferido)
        return { tipo: 'nao conferido' };
    return null;
}
/* A frase da barreira, para a tela e para o erro da escrita. Sem travessão. */
function fraseDaBarreira(b) {
    switch (b.tipo) {
        case 'malformado':
            return `Este pedido não pode virar crachá: ${b.motivo}. Nada foi emitido. Rode de novo o pedido de crachá na máquina.`;
        case 'vencido':
            return 'Este pedido passou dos 15 minutos e venceu. Nada foi emitido. Rode de novo o pedido de crachá na máquina e emita o pedido novo.';
        case 'ja emitido':
            return 'Esta conta da máquina já recebeu crachá antes. Crachá não é emitido duas vezes para a mesma conta. Rode de novo o pedido de crachá na máquina.';
        case 'lista cheia':
            return `Chegaram ${exports.LIMITE_DE_PEDIDOS} pedidos ou mais em 15 minutos, mais do que uma troca normal faz. Pode ser tentativa de falsificação, e o painel não consegue conferir os pedidos que ficaram fora da lista, então nada foi emitido. Espere 15 minutos sem pedido novo e rode o pedido de crachá uma vez só, na máquina.`;
        case 'duplicado': {
            const partes = [];
            if (b.duplicidade.mesmaMaquina)
                partes.push('outro pedido aberto para a mesma máquina');
            if (b.duplicidade.mesmoCodigo)
                partes.push('outro pedido aberto com o mesmo código');
            return `Existe ${partes.join(' e ')}. Pode ser tentativa de falsificação: alguém pedindo crachá no lugar da máquina. Nada foi emitido. O que fazer: se foi você que rodou o pedido mais de uma vez, espere 15 minutos para os pedidos vencerem e rode uma vez só, na máquina. Se não foi você, não emita nada e revogue os crachás desta máquina.`;
        }
        case 'nao conferido':
            return 'Confira no terminal da máquina o código e o começo do uid antes de emitir. Sem essa conferência, nada é emitido.';
    }
}
/*
 * N3 e R12: emitir é UMA gravação em lote. Cria crachas/{uid} com os campos
 * exatos do contrato e, se a máquina já tem crachá ativo, revoga cada um no mesmo
 * lote. Ou tudo entra, ou nada entra.
 */
function loteDeEmissao(pedido, crachas, origem, hora) {
    const revogacoes = loteDeRevogacao(pedido.maquinaId, crachas, origem, hora);
    const criar = {
        operacao: 'criar',
        colecao: 'crachas',
        id: pedido.uid,
        dados: {
            uid: pedido.uid,
            maquinaId: pedido.maquinaId,
            rotulo: pedido.rotulo,
            ativo: true,
            emitidoEm: hora,
            emitidoPor: origem
        }
    };
    return [criar, ...revogacoes];
}
/* N3: revogar revoga TODOS os crachás ativos daquela máquina. A atualização só
   mexe em ativo, revogadoEm e revogadoPor, R12. */
function loteDeRevogacao(maquinaId, crachas, origem, hora) {
    return ativosDaMaquina(crachas, maquinaId).map((c) => ({
        operacao: 'revogar',
        colecao: 'crachas',
        id: c.id,
        dados: { ativo: false, revogadoEm: hora, revogadoPor: origem }
    }));
}
/* R5 e R12: toda origem gravada pelo painel começa com "painel". */
function origemDoPainel(celular, email) {
    return `painel no ${celular ? 'celular' : 'computador'}, ${email}`;
}
