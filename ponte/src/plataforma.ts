// plataforma.ts, o que muda entre a ponte do Windows e a ponte do Linux. OST 14.
//
// A ponte nasceu no Windows do diretor. Na OST 14 ela passa a rodar tambem em
// Linux, primeiro na VM fabrica-1 e depois na VM do escritorio. Tudo o que depende
// do sistema mora aqui, num lugar so, para quem auditar ter um arquivo para ler.
//
// REGRA DESTE ARQUIVO: no Windows, nada muda. Toda funcao daqui devolve, no
// Windows, exatamente o que o codigo fazia antes da OST 14.
//
// O DESENHO NO LINUX, em uma frase: a ponte roda como um usuario proprio do
// sistema (fabrica-ponte), dono de uma pasta que so ele le, e as fabricas rodam
// como o diretor. Por isso a credencial da ponte fica fora do alcance das
// fabricas, coisa que no Windows nao existe (§A.7, limite declarado). Quando a
// ponte precisa agir como o diretor (abrir o Claude Code, ler a transcricao), ela
// pede ao sistema por uma regra estreita do sudo, e so para dois programas.
//
// Sem imports do projeto, de proposito: este arquivo e importado por config.ts e
// nao pode criar ciclo.

import { homedir } from 'node:os';

export const NO_WINDOWS = process.platform === 'win32';

/** O comando que o diretor roda para instalar ou refazer a ponte, neste sistema. */
export function comoInstalar(): string {
  return NO_WINDOWS
    ? 'powershell -ExecutionPolicy Bypass -File ponte\\instalar.ps1'
    : 'sudo bash ponte/linux/instalar.sh';
}

/** Como fazer o login da ponte de novo, neste sistema, sem reinstalar. */
export function comoEntrar(): string {
  return NO_WINDOWS
    ? 'powershell -ExecutionPolicy Bypass -File ponte\\instalar.ps1'
    : 'sudo bash /opt/a-fabrica-ponte/app/linux/entrar.sh';
}

/**
 * A pasta pessoal do DIRETOR, que no Linux nao e a do processo da ponte.
 *
 * No Windows a ponte roda como o diretor e as duas coincidem. No Linux a ponte
 * roda como fabrica-ponte, e o servico diz qual e a casa do diretor pela variavel
 * PONTE_CASA_DIRETOR. E dali que saem a transcricao do Claude Code e a pasta de
 * agentes do diretor.
 */
export function casaDoDiretor(): string {
  const bruto = (process.env.PONTE_CASA_DIRETOR ?? '').trim();
  return bruto.length > 0 ? bruto : homedir();
}

/**
 * O usuario do sistema como quem as fabricas rodam, quando nao e o da ponte.
 * Vazio quer dizer: o mesmo processo, como no Windows. No Linux o servico diz
 * quem e, pela variavel PONTE_FABRICA_COMO.
 */
export function usuarioDasFabricas(): string | null {
  const bruto = (process.env.PONTE_FABRICA_COMO ?? '').trim();
  return /^[a-z_][a-z0-9_.-]{0,63}$/i.test(bruto) ? bruto : null;
}

/** Separador de pasta do sistema em que a ponte roda. */
export const SEPARADOR = NO_WINDOWS ? '\\' : '/';

/**
 * Deixa um caminho comparavel por fronteira de pasta.
 *
 * Windows: minusculo e barra invertida, porque la nome de pasta nao diferencia
 * maiuscula. Linux: do jeito que veio, porque la diferencia, e baixar a caixa
 * seria ALARGAR a comparacao: liberar /home/x/a-fabrica liberaria tambem uma
 * pasta distinta chamada /home/x/A-Fabrica. Achado do estudo docs/ponte-na-vm.md,
 * secao 1.2. Nos dois, sem separador no fim.
 */
export function caminhoComparavel(valor: string): string {
  let t = NO_WINDOWS ? String(valor).toLowerCase().replace(/\//g, '\\') : String(valor);
  while (t.length > 1 && t.endsWith(SEPARADOR)) t = t.slice(0, -1);
  return t;
}

/** O caminho e igual ao alvo, ou fica dentro dele, por fronteira de pasta? */
export function dentroDaPasta(caminho: string, pasta: string): boolean {
  const c = caminhoComparavel(caminho);
  const a = caminhoComparavel(pasta);
  return c === a || c.startsWith(`${a}${SEPARADOR}`);
}
