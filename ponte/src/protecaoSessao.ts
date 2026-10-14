// protecaoSessao.ts, a tranca do arquivo de sessão da ponte, e a conferência dela.
//
// POR QUE EXISTE
// --------------
// A segurança levantou isto na OST 6 parte 2, e tem razão: na Onda 2 o arquivo de
// sessão da ponte deixa de ser só leitura e passa a valer como CHAVE DE APROVAÇÃO,
// porque é com ela que a ponte escreve resposta de aprovação na base. Um arquivo
// com essa força não pode ficar com permissão herdada da pasta do usuário.
//
// Até aqui o código gravava o arquivo com modo 0o600, e isso é teatro no Windows:
// o Node traduz modo de Unix para o mínimo no Windows e NÃO mexe na lista de
// controle de acesso. Quem tranca de verdade no Windows é o icacls.
//
// E tem a segunda metade, que é a que o diretor mandou: não basta trancar, a ponte
// tem de RECUSAR SUBIR se a tranca não estiver lá. Afirmação de proteção que
// ninguém confere foi exatamente o que a segurança vetou em OST anterior.
//
// FALHA FECHADA, e aqui ela é literal: qualquer dúvida é "não protegido". Se o
// icacls não rodar, se a saída vier estranha, se aparecer uma identidade que não
// é a do dono, a resposta é NÃO PROTEGIDO. Nunca o contrário.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { userInfo } from 'node:os';

export interface EntradaDeAcesso {
  /** Identidade como o sistema a escreve, por exemplo MAQUINA\\usuario. */
  identidade: string;
  /** Permissões entre parênteses, cruas, como o icacls escreveu. */
  permissoes: string;
  /** Verdadeiro quando a entrada foi herdada da pasta de cima. */
  herdada: boolean;
}

export interface Veredito {
  protegido: boolean;
  /** Em português, para o diretor ler no terminal. */
  motivo: string;
  /** Saída crua do icacls, para servir de evidência no relatório. */
  saidaIcacls: string;
  entradas: EntradaDeAcesso[];
}

/** O usuário dono desta ponte, nas duas formas que o icacls pode escrever. */
function nomesDoDono(): string[] {
  const u = userInfo().username;
  const dominio = process.env['USERDOMAIN'] ?? '';
  const computador = process.env['COMPUTERNAME'] ?? '';
  const formas = [u];
  if (dominio) formas.push(`${dominio}\\${u}`);
  if (computador) formas.push(`${computador}\\${u}`);
  return formas.map((f) => f.toLowerCase());
}

function rodarIcacls(caminho: string): string {
  // Sem shell, argumento por argumento. Caminho vai como argumento, nunca
  // interpolado em linha de comando, §A.18 no espírito.
  return execFileSync('icacls', [caminho], { encoding: 'utf8', windowsHide: true });
}

/**
 * Lê a lista de controle de acesso de um caminho.
 *
 * A saída do icacls vem assim, a primeira linha com o caminho e a primeira
 * entrada juntos, as demais só com a entrada:
 *
 *   C:\...\sessao.json MAQUINA\usuario:(F)
 *                      BUILTIN\Administradores:(I)(F)
 *
 * O (I) na frente das permissões é o que marca entrada HERDADA.
 */
export function lerAcesso(caminho: string): { entradas: EntradaDeAcesso[]; saida: string } {
  const saida = rodarIcacls(caminho);
  const entradas: EntradaDeAcesso[] = [];
  for (const linhaBruta of saida.split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (linha.length === 0) continue;
    if (/^Successfully processed|^Arquivos processados|^\d+ arquivo/i.test(linha)) continue;
    // Tira o caminho do começo, quando ele vem junto na primeira linha.
    const sem = linha.startsWith(caminho) ? linha.slice(caminho.length).trim() : linha;
    if (sem.length === 0) continue;
    // Identidade é tudo antes do último ":(" , porque identidade de domínio
    // também tem barra e pode ter ponto, mas não tem ":(" .
    const corte = sem.indexOf(':(');
    if (corte < 0) continue;
    const identidade = sem.slice(0, corte).trim();
    const permissoes = sem.slice(corte + 1).trim();
    entradas.push({
      identidade,
      permissoes,
      herdada: /^\(I\)/.test(permissoes) || permissoes.includes('(I)'),
    });
  }
  return { entradas, saida };
}

export interface OpcoesConferencia {
  /**
   * Exige que a herança esteja quebrada neste caminho.
   *
   * Vale true para a PASTA, e aí é obrigatório: a pasta de cima é o perfil do
   * usuário, e herdar dela é herdar o que o perfil der a administrador e a
   * sistema.
   *
   * Vale false para os ARQUIVOS de dentro, e isto é decisão consciente, não
   * desleixo. A pasta já está trancada para o dono e só para ele, então um
   * arquivo que herda dela herda exatamente uma entrada, a do dono. E tem um
   * motivo prático que importa: a cada renovação de token o SDK regrava a sessão
   * num arquivo novo e troca pelo antigo, e o arquivo novo nasce herdando a
   * pasta. Exigir herança quebrada no arquivo faria a ponte recusar subir depois
   * da primeira renovação, por uma coisa que não é furo nenhum.
   *
   * O que continua valendo para o arquivo, e é o que de fato protege: NENHUMA
   * identidade além do dono pode aparecer, herdada ou não.
   */
  exigirHerancaQuebrada: boolean;
}

/**
 * Confere se um caminho está trancado para o dono e só para ele.
 *
 * Protegido significa: existe, toda entrada de acesso é do próprio dono, e, se
 * for pasta, a herança está quebrada. Administrador e sistema contam como "não
 * protegido" de propósito: a tranca que a segurança pediu é de usuário único.
 */
export function conferirProtecao(
  caminho: string,
  opcoes: OpcoesConferencia = { exigirHerancaQuebrada: false }
): Veredito {
  if (!existsSync(caminho)) {
    return { protegido: false, motivo: `o caminho ${caminho} não existe`, saidaIcacls: '', entradas: [] };
  }
  let lido: { entradas: EntradaDeAcesso[]; saida: string };
  try {
    lido = lerAcesso(caminho);
  } catch (e) {
    // Falha fechada: não deu para conferir é igual a não protegido.
    return {
      protegido: false,
      motivo: `não deu para conferir a tranca de ${caminho}: ${e instanceof Error ? e.message : String(e)}`,
      saidaIcacls: '',
      entradas: [],
    };
  }
  if (lido.entradas.length === 0) {
    return {
      protegido: false,
      motivo: `a leitura da tranca de ${caminho} não devolveu nenhuma entrada, e sem leitura a resposta é não protegido`,
      saidaIcacls: lido.saida,
      entradas: [],
    };
  }
  const donos = nomesDoDono();
  const herdadas = lido.entradas.filter((e) => e.herdada);
  if (opcoes.exigirHerancaQuebrada && herdadas.length > 0) {
    return {
      protegido: false,
      motivo:
        `${caminho} ainda herda permissão da pasta de cima (${herdadas.map((e) => e.identidade).join(', ')}), ` +
        'e herança aberta é o mesmo que porta aberta para esta chave',
      saidaIcacls: lido.saida,
      entradas: lido.entradas,
    };
  }
  const estranhas = lido.entradas.filter((e) => !donos.includes(e.identidade.toLowerCase()));
  if (estranhas.length > 0) {
    return {
      protegido: false,
      motivo:
        `${caminho} dá acesso a quem não é o dono: ${estranhas.map((e) => `${e.identidade}${e.permissoes}`).join(', ')}`,
      saidaIcacls: lido.saida,
      entradas: lido.entradas,
    };
  }
  return {
    protegido: true,
    motivo:
      `${caminho} está trancado para ${lido.entradas.map((e) => e.identidade).join(', ')} e mais ninguém` +
      (opcoes.exigirHerancaQuebrada ? ', com a herança quebrada' : herdadas.length > 0 ? ', por herança da pasta já trancada' : ''),
    saidaIcacls: lido.saida,
    entradas: lido.entradas,
  };
}

/**
 * Tranca um caminho para o dono: quebra a herança e deixa só ele.
 * Devolve a saída crua dos comandos, para evidência.
 */
export function aplicarProtecao(caminho: string): string {
  const usuario = userInfo().username;
  const linhas: string[] = [];
  const rodar = (args: string[]): void => {
    linhas.push(`icacls ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`);
    try {
      linhas.push(execFileSync('icacls', args, { encoding: 'utf8', windowsHide: true }).trim());
    } catch (e) {
      linhas.push(`falhou: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  rodar([caminho, '/inheritance:r']);
  rodar([caminho, '/grant:r', `${usuario}:F`]);
  return linhas.join('\n');
}

export class SessaoDesprotegida extends Error {
  constructor(
    mensagem: string,
    public readonly vereditos: Veredito[]
  ) {
    super(mensagem);
    this.name = 'SessaoDesprotegida';
  }
}

export interface AlvoDeTranca {
  caminho: string;
  /** Pasta exige herança quebrada. Arquivo de dentro não, e o porquê está em OpcoesConferencia. */
  tipo: 'pasta' | 'arquivo';
}

/**
 * O portão de subida da ponte: ou os caminhos estão trancados, ou a ponte NÃO SOBE.
 *
 * Chamado por ponte.ts antes de qualquer coisa, e por entrar.ts depois de trancar,
 * para conferir que trancou mesmo em vez de só afirmar que trancou.
 */
export function exigirProtecao(alvos: AlvoDeTranca[]): Veredito[] {
  const vereditos = alvos.map((a) => conferirProtecao(a.caminho, { exigirHerancaQuebrada: a.tipo === 'pasta' }));
  const abertos = vereditos.filter((v) => !v.protegido);
  if (abertos.length > 0) {
    throw new SessaoDesprotegida(
      'a ponte não sobe com a sessão desprotegida, porque na Onda 2 esse arquivo vale como chave de aprovação. ' +
        `O que está aberto: ${abertos.map((v) => v.motivo).join(' | ')}`,
      vereditos
    );
  }
  return vereditos;
}
