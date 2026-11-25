#!/usr/bin/env node
// Guarda de subpasta do a-fabrica, §A.7.
//
// O Claude Code so le .claude/settings.json da pasta onde a sessao foi aberta.
// Sessao aberta em painel/, ponte/ ou qualquer outra subpasta do a-fabrica nasce
// sem o portao (scripts/gate-deploy.sh) e sem as travas da raiz. Isso aconteceu
// de verdade de 24/11/2026 09:47 ate 23:13: uma sessao aberta em painel/, em
// modo bypass, rodou comandos de push sem passar pelo portao.
//
// Este script e registrado como gancho no settings.json DO USUARIO (o unico que
// vale em toda pasta), nos eventos UserPromptSubmit e PreToolUse. Ele decide so
// pela pasta do projeto da sessao:
//   - fora do a-fabrica: sai 0 na hora, nao le nada, nao escreve nada;
//   - na raiz do a-fabrica: sai 0, porque la o portao e as travas carregam;
//   - em qualquer subpasta do a-fabrica: RECUSA (codigo 2), toda ordem e toda
//     ferramenta, e diz como reabrir na raiz.
// Comparacao por fronteira de caminho: a-fabrica-lab nao e subpasta do a-fabrica.
// Falha fechada: se a pasta e do a-fabrica e algo der errado aqui, recusa.

'use strict';
const path = require('node:path');

const RAIZ = 'c:\\users\\henrique\\a-fabrica';

function normalizar(p) {
  let s = String(p).trim().replace(/\//g, '\\');
  // caminho do Git Bash, /c/Users/... vira c:\Users\...
  const m = /^\\([a-zA-Z])\\(.*)$/.exec(s);
  if (m) s = `${m[1]}:\\${m[2]}`;
  s = path.win32.resolve(s).toLowerCase();
  return s.replace(/\\+$/, '');
}

function recusar(pasta) {
  process.stderr.write(
    'A FABRICA, sessao recusada pela guarda de subpasta, §A.7.\n' +
    `Esta sessao foi aberta em ${pasta}, que e uma subpasta do a-fabrica.\n` +
    'Aberta assim, ela fica sem o portao do §A.7 e sem as travas do .claude/settings.json da raiz, ' +
    'por isso nao executa nada.\n' +
    'Para trabalhar: feche esta sessao e abra na raiz, com\n' +
    '  cd C:\\Users\\Henrique\\a-fabrica\n' +
    '  claude\n'
  );
  process.exit(2);
}

function decidir(pastaBruta) {
  if (!pastaBruta) return; // sem pasta nenhuma, nao e sessao do a-fabrica que se possa reconhecer
  const pasta = normalizar(pastaBruta);
  if (pasta === RAIZ) process.exit(0);
  if (pasta.startsWith(RAIZ + '\\')) recusar(pastaBruta);
  process.exit(0);
}

// Caminho rapido: o Claude Code entrega a pasta do projeto no ambiente do gancho.
const doAmbiente = process.env.CLAUDE_PROJECT_DIR;
if (doAmbiente) {
  try { decidir(doAmbiente); } catch { /* cai para a leitura da entrada */ }
}

// Sem a variavel: le a entrada do gancho e usa o cwd dela.
let entrada = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { entrada += c; if (entrada.length > 1_000_000) process.stdin.destroy(); });
process.stdin.on('end', () => {
  let cwd = '';
  try {
    cwd = JSON.parse(entrada).cwd || '';
  } catch {
    // entrada malformada: falha fechada se ela fala de uma subpasta do a-fabrica
    const bruta = entrada.toLowerCase().replace(/\//g, '\\').replace(/\\+/g, '\\');
    if (bruta.includes('\\a-fabrica\\')) recusar('(entrada malformada do gancho)');
    process.exit(0);
  }
  try {
    decidir(cwd);
  } catch {
    // erro ao decidir: se a pasta parece do a-fabrica, recusa; se nao, deixa passar
    if (String(cwd).toLowerCase().replace(/\//g, '\\').includes('\\a-fabrica\\')) recusar(cwd);
  }
  process.exit(0);
});
process.stdin.on('error', () => process.exit(0));
