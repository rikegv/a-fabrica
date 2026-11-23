// servico.ts, o que a ponte precisa para viver como servico de verdade. OST 11, Onda 0.
//
// POR QUE ISTO EXISTE, caso real de 23/11/2026: a ponte caiu as 16:43:43 e nao
// voltou. A tarefa agendada chamava o node.exe direto, com logon interativo, entao
// o Windows abria uma JANELA PRETA de console na tela do diretor. Fechar essa
// janela mata a ponte na hora, com o codigo 0xC000013A, sem parada limpa: a base
// ficou dizendo "online" com o ultimo sinal das 16:43:43. E o agendador nao
// religou, porque o "reiniciar se falhar" dele nao olha codigo de saida.
//
// O conserto tem quatro partes, e as duas daqui sao as que moram no codigo:
//   1. registro em arquivo, porque sem janela a saida da ponte nao vai para lugar
//      nenhum, e a proxima queda precisa deixar rastro;
//   2. trava de instancia unica, porque o religamento automatico da tarefa pode
//      chamar a ponte de novo enquanto uma antiga, orfa, ainda esta viva.
// As outras duas estao em instalar.ps1: rodar sem janela e religar a cada 5 min.
//
// §A.17: o registro so acrescenta, um arquivo por dia, nada e apagado.
// §A.6: nada aqui abre porta. E arquivo local, na pasta trancada da ponte.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { format } from 'node:util';
import { PASTA_LOCAL, PASTA_TRAVAS } from './config.js';

export const PASTA_REGISTROS = join(PASTA_LOCAL, 'registros');
export const CAMINHO_TRAVA = join(PASTA_TRAVAS, 'ponte-no-ar.json');

/** Codigo de saida de quando outra ponte ja esta no ar. Nao e falha, e recusa. */
export const SAIDA_OUTRA_PONTE = 7;

function dia(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function carimbo(d: Date): string {
  const p = (n: number, t = 2): string => String(n).padStart(t, '0');
  return `${dia(d)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/**
 * Copia tudo o que a ponte escreve no console para o registro do dia. O console
 * continua funcionando igual, para quem roda a ponte numa janela de proposito.
 * Erro de escrita no registro nunca derruba a ponte.
 */
export function registrarEmArquivo(): string {
  mkdirSync(PASTA_REGISTROS, { recursive: true });
  const escrever = (nivel: string, args: unknown[]): void => {
    const agora = new Date();
    try {
      appendFileSync(
        join(PASTA_REGISTROS, `ponte-${dia(agora)}.log`),
        `${carimbo(agora)} [${nivel}] ${format(...args)}\n`,
        'utf8'
      );
    } catch {
      // registro e ajuda, nao condicao para a ponte trabalhar
    }
  };
  const log = console.log.bind(console);
  const err = console.error.bind(console);
  console.log = (...args: unknown[]): void => {
    escrever('info', args);
    try {
      log(...args);
    } catch {
      // console sem destino, comum quando roda sem janela
    }
  };
  console.error = (...args: unknown[]): void => {
    escrever('erro', args);
    try {
      err(...args);
    } catch {
      // idem
    }
  };
  return join(PASTA_REGISTROS, `ponte-${dia(new Date())}.log`);
}

/** O processo existe E e um node rodando ponte.js. PID reaproveitado nao conta. */
function ponteViva(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return false;
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  if (process.platform !== 'win32') return true;
  const r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 15000 }
  );
  const linha = String(r.stdout ?? '');
  /* Sem resposta da conferencia: na duvida, trata como viva. Duas pontes ao mesmo
     tempo e pior do que esperar o proximo religamento. */
  if (r.status !== 0 && linha.trim() === '') return true;
  return /node/i.test(linha) && /ponte\.js/i.test(linha);
}

export type ResultadoDaTrava = { ok: true } | { ok: false; pidDaOutra: number; desde: string };

/**
 * Trava de instancia unica, por pasta local. A trava antiga de um processo que ja
 * morreu e reescrita, porque ela so diz quem esta no ar, e quem estava nao esta.
 */
export function tomarTravaDeInstancia(): ResultadoDaTrava {
  mkdirSync(PASTA_TRAVAS, { recursive: true });
  if (existsSync(CAMINHO_TRAVA)) {
    try {
      const antes = JSON.parse(readFileSync(CAMINHO_TRAVA, 'utf8')) as { pid?: unknown; desde?: unknown };
      const pid = Number(antes.pid);
      if (ponteViva(pid)) return { ok: false, pidDaOutra: pid, desde: String(antes.desde ?? '') };
    } catch {
      // trava ilegivel: quem escreveu nao esta mais la para dizer
    }
  }
  writeFileSync(CAMINHO_TRAVA, JSON.stringify({ pid: process.pid, desde: new Date().toISOString() }), 'utf8');
  return { ok: true };
}
