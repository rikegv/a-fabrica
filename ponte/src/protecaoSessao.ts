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
import { chmodSync, existsSync, lstatSync, readFileSync, statSync } from 'node:fs';
import { userInfo } from 'node:os';
import { dirname, resolve } from 'node:path';
import { NO_WINDOWS } from './plataforma.js';

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
  if (!NO_WINDOWS) return conferirProtecaoPosix(caminho, opcoes);
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
 *
 * NÃO CONFIAR NO /inheritance:r SOZINHO. Ele só remove as entradas herdadas
 * quando a lista de acesso traz a marca de herança automática (AI). Sem a marca,
 * ele as COPIA como entradas próprias e ainda diz "processado com sucesso". Foi o
 * que aconteceu no PC novo do diretor, cujo perfil não tem a marca, e a pasta
 * ficou com SISTEMA e Administradores. Investigação em docs/tranca-da-ponte.md.
 *
 * Por isso, depois de quebrar a herança e dar acesso ao dono, lê a lista e remove
 * por nome toda identidade que não seja o dono. Quem decide se ficou trancado
 * continua sendo conferirProtecao, nunca esta função.
 */
export function aplicarProtecao(caminho: string): string {
  if (!NO_WINDOWS) return aplicarProtecaoPosix(caminho);
  const usuario = userInfo().username;
  const ehPasta = existsSync(caminho) && statSync(caminho).isDirectory();
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
  // Pasta passa o acesso adiante para o que nascer dentro dela, arquivo não.
  rodar([caminho, '/grant:r', ehPasta ? `${usuario}:(OI)(CI)F` : `${usuario}:F`]);

  let entradas: EntradaDeAcesso[] = [];
  try {
    entradas = lerAcesso(caminho).entradas;
  } catch (e) {
    // Não deu para ler: não remove nada, e a conferência depois responde "aberto".
    linhas.push(`falhou ao ler a lista de acesso: ${e instanceof Error ? e.message : String(e)}`);
  }
  const donos = nomesDoDono();
  const estranhas = [...new Set(entradas.filter((e) => !donos.includes(e.identidade.toLowerCase())).map((e) => e.identidade))];
  for (const identidade of estranhas) {
    // SID sem nome resolvido vem cru no icacls e precisa do asterisco para ser aceito.
    const alvo = /^S-1-\d/.test(identidade) ? `*${identidade}` : identidade;
    rodar([caminho, '/remove', alvo]);
  }
  return linhas.join('\n');
}

// ---------------------------------------------------------------------------
// Linux, OST 14
// ---------------------------------------------------------------------------
//
// No Linux o modo de arquivo E a tranca, e nao teatro como no Windows. O que
// conta como protegido, e cada item e conferido, nunca afirmado:
//   1. o caminho existe e NAO e atalho simbolico (atalho pode apontar para fora);
//   2. o dono e o usuario que roda este processo;
//   3. nenhum bit de grupo nem de outros: pasta 700, arquivo 600 ou mais fechado;
//   4. a pasta de cima nao deixa outro usuario trocar o caminho de lugar: dona
//      dela e o root ou o proprio dono, e sem escrita de grupo nem de outros;
//   5. o caminho NAO esta em pasta compartilhada com outra maquina ou com o
//      Windows. Pasta compartilhada de maquina virtual costuma ignorar o modo de
//      arquivo, e ai o chmod volta a ser teatro. Achado do estudo, secao 1.4.
// Qualquer leitura que falhar e NAO PROTEGIDO, igual ao Windows.

/** Sistemas de arquivo em que o modo de arquivo nao segura ninguem. */
const SISTEMAS_COMPARTILHADOS = /^(vboxsf|9p|v9fs|virtiofs|cifs|smb3?|smbfs|nfs4?|drvfs|prl_fs|vmhgfs|fuse(\..*)?|sshfs|afs|ceph|glusterfs)$/i;

/** Ponto de montagem mais longo que contem o caminho, com o tipo do sistema. */
export function montagemDe(caminho: string): { ponto: string; tipo: string } | null {
  let bruto: string;
  try {
    bruto = readFileSync('/proc/self/mountinfo', 'utf8');
  } catch {
    return null;
  }
  const alvo = resolve(caminho);
  let melhor: { ponto: string; tipo: string } | null = null;
  for (const linha of bruto.split('\n')) {
    // formato: id pai maior:menor raiz PONTO opcoes [campos opcionais] - TIPO origem opcoes
    const partes = linha.split(' ');
    const ponto = partes[4];
    const traco = partes.indexOf('-');
    const tipo = traco >= 0 ? partes[traco + 1] : undefined;
    if (ponto === undefined || tipo === undefined) continue;
    const p = ponto.replace(/\\040/g, ' ');
    const contem = p === '/' || alvo === p || alvo.startsWith(`${p}/`);
    if (contem && (melhor === null || p.length >= melhor.ponto.length)) melhor = { ponto: p, tipo };
  }
  return melhor;
}

function modoEmTexto(modo: number): string {
  return (modo & 0o7777).toString(8).padStart(4, '0');
}

function conferirProtecaoPosix(caminho: string, opcoes: OpcoesConferencia): Veredito {
  const nao = (motivo: string, evidencia = ''): Veredito => ({ protegido: false, motivo, saidaIcacls: evidencia, entradas: [] });
  let st: ReturnType<typeof lstatSync>;
  try {
    st = lstatSync(caminho);
  } catch {
    return nao(`o caminho ${caminho} não existe`);
  }
  const uid = typeof process.getuid === 'function' ? process.getuid() : -1;
  const evidencia = `${caminho} modo ${modoEmTexto(st.mode)} dono uid ${st.uid} grupo gid ${st.gid}, processo uid ${uid}`;
  const entradas: EntradaDeAcesso[] = [{ identidade: `uid ${st.uid}`, permissoes: modoEmTexto(st.mode), herdada: false }];
  if (st.isSymbolicLink()) return nao(`${caminho} é atalho simbólico, e atalho pode apontar para fora da tranca`, evidencia);
  if (opcoes.exigirHerancaQuebrada && !st.isDirectory()) return nao(`${caminho} devia ser pasta e não é`, evidencia);
  if (st.uid !== uid) return nao(`${caminho} é do uid ${st.uid}, e esta ponte roda como uid ${uid}`, evidencia);
  if ((st.mode & 0o077) !== 0) {
    return {
      protegido: false,
      motivo: `${caminho} dá acesso a grupo ou a outros usuários, modo ${modoEmTexto(st.mode)}; o certo é ${st.isDirectory() ? '0700' : '0600'}`,
      saidaIcacls: evidencia,
      entradas,
    };
  }
  // 4. A pasta de cima. Quem escreve nela pode trocar este caminho de lugar.
  const pai = dirname(resolve(caminho));
  try {
    const sp = statSync(pai);
    const donoOk = sp.uid === 0 || sp.uid === uid;
    const escritaAlheia = (sp.mode & 0o022) !== 0;
    const pegajosa = (sp.mode & 0o1000) !== 0;
    if (!donoOk || (escritaAlheia && !pegajosa)) {
      return nao(
        `a pasta de cima, ${pai}, deixa outro usuário trocar ${caminho} de lugar (dono uid ${sp.uid}, modo ${modoEmTexto(sp.mode)})`,
        evidencia
      );
    }
  } catch {
    return nao(`não deu para conferir a pasta de cima de ${caminho}`, evidencia);
  }
  // 5. Pasta compartilhada.
  const m = montagemDe(caminho);
  if (m === null) return nao(`não deu para ler as montagens do sistema, e sem isso a resposta é não protegido`, evidencia);
  if (SISTEMAS_COMPARTILHADOS.test(m.tipo)) {
    return nao(
      `${caminho} está numa pasta compartilhada (${m.tipo} em ${m.ponto}), onde o modo de arquivo não tranca nada`,
      `${evidencia}, montagem ${m.tipo} em ${m.ponto}`
    );
  }
  return {
    protegido: true,
    motivo: `${caminho} está trancado para o uid ${uid} e mais ninguém, modo ${modoEmTexto(st.mode)}, em ${m.tipo}`,
    saidaIcacls: `${evidencia}, montagem ${m.tipo} em ${m.ponto}`,
    entradas,
  };
}

function aplicarProtecaoPosix(caminho: string): string {
  try {
    const st = lstatSync(caminho);
    if (st.isSymbolicLink()) return `${caminho} é atalho simbólico, nada foi mudado`;
    const modo = st.isDirectory() ? 0o700 : 0o600;
    chmodSync(caminho, modo);
    return `chmod ${modo.toString(8)} ${caminho}`;
  } catch (e) {
    return `falhou ao trancar ${caminho}: ${e instanceof Error ? e.message : String(e)}`;
  }
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
