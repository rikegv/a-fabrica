"use strict";
/*
 * Tipos da base na nuvem, em portugues, exatamente como o contrato das tres
 * pecas descreve (docs/contrato-tres-pecas.md), mais os campos que a Onda 2
 * acrescenta (docs/ost7-contrato-onda2.md).
 *
 * Quem escreve fabricas, atividade, tarefas e o pedido de aprovacao e a ponte.
 * O painel escreve comandos e a resposta da aprovacao, e so por
 * src/dados/escritas.ts.
 *
 * Campos marcados como tolerados nao estao no contrato: se a ponte escrever,
 * o painel aproveita; se nao escrever, o painel segue sem eles.
 */
Object.defineProperty(exports, "__esModule", { value: true });
