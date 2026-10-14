// entradaNavegador.ts, a entrada da ponte pelo login no navegador do diretor.
//
// POR QUE ESTE ARQUIVO EXISTE, e o que mudou
// ------------------------------------------
// Até a OST 6 a ponte recebia a credencial por COLAGEM: o diretor abria o painel,
// copiava o token de atualização da própria sessão de navegador e colava no
// terminal. Aquilo funcionava e foi provado caminho de erro por caminho de erro,
// mas tinha dois defeitos: mostrava credencial de verdade na tela, e dependia de
// o diretor abrir as ferramentas de desenvolvedor do navegador.
//
// Na OST 7 o diretor esclareceu o §A.6: laço de retorno local em 127.0.0.1 está
// LIBERADO para a entrada da ponte. Com isso a colagem morreu e este caminho
// nasceu. O que o §A.6 continua vetando é porta de ENTRADA na máquina, isto é,
// túnel de entrada, endereço público apontando para cá, ou serviço escutando em
// interface que a rede alcança. Nada disso acontece aqui.
//
// O QUE ESTE CAMINHO FAZ, em ordem
// --------------------------------
//   1. abre um servidor HTTP preso em 127.0.0.1, em porta sorteada pelo sistema;
//   2. abre o navegador do diretor num endereço com segredo de uso único;
//   3. a página roda o SDK do Firebase e faz o login com o Google, do jeito que a
//      conta dele estiver configurada no Google;
//      NADA NESTE PROJETO CONFERE SEGUNDO FATOR, e este arquivo não pode afirmar
//      que confere. A regra do Firestore já diz isso por escrito, desde a OST 6: o
//      token do provedor Google não carrega essa informação e o Authentication
//      deste projeto não impõe segunda etapa. Se o diretor tem verificação em duas
//      etapas, ela vive na conta Google dele e é responsabilidade dela. A primeira
//      versão deste arquivo afirmava o contrário, inclusive na tela que ele lê, e a
//      auditoria da OST 7 vetou com razão.
//   4. a página devolve, pelo laço de retorno, o token de atualização daquela
//      sessão;
//   5. o servidor fecha, e quem confere e grava é identidade.ts, pelo mesmo
//      caminho já provado da OST 6.
//
// AS SETE TRANCAS DESTA PORTA, e cada uma existe por um motivo
// ------------------------------------------------------------
//   T1 Endereço de escuta fixado em 127.0.0.1, nunca 0.0.0.0 e nunca o nome da
//      máquina. Só processo rodando nesta máquina alcança.
//   T2 Porta sorteada pelo sistema (porta 0). Não existe porta conhecida para
//      alguém tentar.
//   T3 Vive segundos, não para sempre. Abre no login, fecha no fim, e fecha
//      também por tempo esgotado, por erro e por sinal. Sempre em finally.
//   T4 Segredo de uso único no caminho do endereço. Pedido sem o segredo recebe
//      404 e nada mais, nem dica.
//   T5 Confere o cabeçalho de hospedeiro. Só 127.0.0.1 ou localhost, com a porta
//      desta rodada, passam. Isso fecha o ataque de nome de domínio que aponta
//      para o laço de retorno, porque o nome dele não é nenhum dos dois. As duas
//      grafias são aceitas porque o Firebase autoriza localhost de fábrica e não
//      autoriza 127.0.0.1; a ESCUTA continua presa em 127.0.0.1 nos dois casos.
//   T6 A entrega exige tipo de conteúdo JSON e não existe resposta de
//      pré-verificação. Página de outra origem não consegue entregar nada aqui.
//   T7 Uma entrega e acabou. A segunda chega depois do servidor ter fechado.
//
// §A.9: nada aqui lê nem escreve configuração do Claude Code ou do Antigravity.
// §A.6: nenhum segredo neste arquivo. A configuração do cliente (chave de API e
//       afins) é pública por desenho e vem da configuração local, gravada pela
//       instalação.

import { spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ConfigLocal } from './config.js';
import { DIRETOR } from './config.js';

/** Endereço de ESCUTA, fixado em texto. Laço de retorno e nada mais, §A.6. */
const LACO_DE_RETORNO = '127.0.0.1';

/**
 * As duas grafias do laço de retorno que a tranca de hospedeiro aceita, T5.
 *
 * Existe por um motivo concreto, descoberto na retomada da OST 7: o Firebase
 * Authentication traz localhost na lista de domínios autorizados de fábrica, e
 * NÃO traz 127.0.0.1. Com a página servida em 127.0.0.1, o login do Google
 * recusava com auth/unauthorized-domain, o diretor via o erro na tela e a ponte
 * só via tempo esgotado, sem saber a diferença entre erro e clique que não veio.
 *
 * Aceitar as duas grafias não abre nada: a ESCUTA continua presa em 127.0.0.1,
 * então só processo desta máquina alcança, e o navegador manda no cabeçalho de
 * hospedeiro exatamente o nome que foi digitado no endereço. Página de outro
 * domínio, mesmo que ele resolva para o laço de retorno, continua barrada aqui,
 * porque o nome dela nunca vai ser nenhuma destas duas.
 */
const GRAFIAS_DO_LACO = ['127.0.0.1', 'localhost'] as const;

/**
 * Qual grafia vai no endereço que o navegador abre. Padrão localhost, que é a
 * que o Firebase autoriza de fábrica. A variável de ambiente serve para a prova
 * forçar a outra grafia e conferir que a tranca de hospedeiro continua de pé.
 */
const GRAFIA_ESCOLHIDA: string = ((): string => {
  const bruto = (process.env.PONTE_ENTRADA_HOSPEDEIRO ?? '').trim();
  return (GRAFIAS_DO_LACO as readonly string[]).includes(bruto) ? bruto : 'localhost';
})();

/** Versão do SDK que a página carrega, a mesma que a ponte usa no pacote. */
const VERSAO_SDK = '11.10.0';

/**
 * Quanto tempo a porta pode viver, no máximo, antes de fechar por tempo esgotado.
 *
 * Três minutos por padrão, que é o tempo de o diretor clicar duas vezes. A variável
 * de ambiente serve para a fábrica deixar a página esperando ele num momento
 * combinado, e ela só pode ESTICAR dentro de um teto: valor maior que quinze
 * minutos é ignorado, para ninguém deixar porta aberta a tarde inteira por engano.
 */
export const LIMITE_PADRAO_MS = ((): number => {
  const bruto = Number(process.env.PONTE_LIMITE_ENTRADA_MS ?? '');
  if (!Number.isFinite(bruto) || bruto <= 0) return 180_000;
  return Math.min(bruto, 15 * 60_000);
})();

export interface CredencialDoNavegador {
  /** Token de atualização da sessão que o diretor acabou de abrir no navegador. */
  refreshToken: string;
  /** E-mail que a página declarou. Não é prova: a prova é a conferência das alegações. */
  emailDeclarado: string | null;
  /** Para o relato: quanto tempo a porta ficou aberta, em milissegundos. */
  portaAbertaMs: number;
  /** Para o relato e para a evidência: qual porta o sistema sorteou. */
  porta: number;
}

export class EntradaPeloNavegadorFalhou extends Error {
  constructor(
    mensagem: string,
    /** O que fazer, em português, para o diretor ler no meio da instalação. */
    public readonly oQueFazer: string
  ) {
    super(mensagem);
    this.name = 'EntradaPeloNavegadorFalhou';
  }
}

export interface OpcoesEntradaNavegador {
  config: ConfigLocal;
  limiteMs?: number;
  registrar?: (linha: string) => void;
  /** Só para prova: não abre o navegador, devolve o endereço e espera. */
  naoAbrirNavegador?: boolean;
  /** Chamado com o endereço assim que a porta sobe. Serve para a prova e para o relato. */
  aoSubir?: (endereco: string, porta: number) => void;
}

/** Compara dois segredos sem vazar o tamanho da parte igual pelo tempo de resposta. */
function segredoBate(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido, 'utf8');
  const b = Buffer.from(esperado, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function escaparParaHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A página que o navegador do diretor abre. Ela é servida do laço de retorno e
 * carrega o SDK do Firebase do endereço oficial do Google.
 *
 * Decisão de desenho, e ela tem efeito de segurança: a página usa persistência
 * EM MEMÓRIA. Logo este login não deixa sessão nova guardada no navegador do
 * diretor; ele serve a esta entrega e morre quando a aba fecha. A sessão que
 * passa a existir é a da ponte, em arquivo fechado, e só ela.
 *
 * §A.11: nenhum travessão em texto que o diretor lê.
 */
function paginaDeEntrada(config: ConfigLocal, segredo: string): string {
  const cfgParaPagina = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    appId: config.appId,
  };
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>A Fábrica, entrada da ponte</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #0d1117; color: #e6edf3;
    font-family: "Segoe UI", system-ui, sans-serif;
    padding: 24px;
  }
  .caixa { width: 100%; max-width: 460px; }
  h1 { font-size: 20px; margin: 0 0 6px; font-weight: 650; }
  p { margin: 0 0 14px; line-height: 1.55; color: #9aa7b4; font-size: 14px; }
  button {
    width: 100%; min-height: 48px; border: 0; border-radius: 10px; cursor: pointer;
    background: #2f81f7; color: #fff; font-size: 15px; font-weight: 600;
    font-family: inherit;
  }
  button:disabled { background: #30363d; color: #7d8590; cursor: default; }
  .aviso { margin-top: 16px; padding: 12px 14px; border-radius: 10px; font-size: 14px; line-height: 1.5; display: none; }
  .aviso.certo { display: block; background: #0f2e1a; color: #7ee2a8; border: 1px solid #1f6f3f; }
  .aviso.errado { display: block; background: #2e1416; color: #ff9fa6; border: 1px solid #7a2a30; }
  .nota { margin-top: 18px; font-size: 12px; color: #6e7781; line-height: 1.6; }
</style>
</head>
<body>
<div class="caixa">
  <h1>Entrada da ponte</h1>
  <p>Entre com a conta <strong>${escaparParaHtml(DIRETOR)}</strong>. Esta página roda na sua máquina, em 127.0.0.1, e serve só para esta entrada.</p>
  <button id="entrar">Entrar com o Google</button>
  <div id="aviso" class="aviso"></div>
  <p class="nota">
    O que acontece aqui: o Google confirma quem você é, do jeito que a sua conta estiver
    configurada, e a ponte guarda a sessão num arquivo fechado só para o seu usuário.
    Esta página não guarda sessão no navegador e pode ser fechada no fim.
  </p>
</div>
<script type="module">
import { initializeApp } from 'https://www.gstatic.com/firebasejs/${VERSAO_SDK}/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, setPersistence, inMemoryPersistence, signOut
} from 'https://www.gstatic.com/firebasejs/${VERSAO_SDK}/firebase-auth.js';

const DIRETOR = ${JSON.stringify(DIRETOR)};
const SEGREDO = ${JSON.stringify(segredo)};
const botao = document.getElementById('entrar');
const aviso = document.getElementById('aviso');

function dizer(texto, certo) {
  aviso.textContent = texto;
  aviso.className = 'aviso ' + (certo ? 'certo' : 'errado');
}

// Conta para o terminal o que apareceu nesta tela. Sem isto, erro de login aqui
// chegava na ponte como tempo esgotado, sem motivo nenhum.
async function contarFalha(codigo, texto) {
  try {
    await fetch('/' + SEGREDO + '/falha', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ codigo: codigo, texto: texto }),
    });
  } catch (e) { /* o aviso na tela já está escrito; isto aqui é só o relato */ }
}

const app = initializeApp(${JSON.stringify(cfgParaPagina)});
const auth = getAuth(app);
// Persistência em memória: este login não fica guardado no navegador.
await setPersistence(auth, inMemoryPersistence);

botao.addEventListener('click', async () => {
  botao.disabled = true;
  dizer('Abrindo a janela do Google...', true);
  try {
    const provedor = new GoogleAuthProvider();
    provedor.setCustomParameters({ prompt: 'select_account', login_hint: DIRETOR });
    const r = await signInWithPopup(auth, provedor);
    const u = r.user;
    if (u.email !== DIRETOR) {
      await signOut(auth);
      dizer('Esta conta é ' + u.email + ', e só a conta do diretor entra. Nada foi enviado para a ponte.', false);
      await contarFalha('conta-errada', 'entrou com ' + u.email);
      botao.disabled = false;
      return;
    }
    if (!u.emailVerified) {
      await signOut(auth);
      dizer('Esta conta está com e-mail não verificado, e o verificado é obrigatório. Nada foi enviado para a ponte.', false);
      await contarFalha('email-nao-verificado', 'a conta do diretor está sem e-mail verificado');
      botao.disabled = false;
      return;
    }
    dizer('Conta confirmada. Entregando para a ponte...', true);
    const resposta = await fetch('/' + SEGREDO + '/entregar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: u.email, refreshToken: u.refreshToken }),
    });
    // A sessão da página morre aqui. A que vale, dali em diante, é a da ponte.
    await signOut(auth);
    if (!resposta.ok) {
      dizer('A ponte recusou a entrega, resposta ' + resposta.status + '. Veja o terminal.', false);
      botao.disabled = false;
      return;
    }
    dizer('Pronto. A ponte recebeu a sua sessão. Pode fechar esta página e voltar ao terminal.', true);
  } catch (e) {
    const codigo = (e && e.code) ? e.code : '';
    let texto = 'Não deu para entrar: ' + (codigo || (e && e.message) || String(e));
    if (codigo === 'auth/popup-blocked') texto = 'O navegador bloqueou a janela do Google. Libere a janela para este endereço e clique de novo.';
    if (codigo === 'auth/popup-closed-by-user') texto = 'A janela do Google foi fechada antes de terminar. Clique de novo.';
    if (codigo === 'auth/unauthorized-domain') texto = 'O projeto não autoriza este endereço. Avise a fábrica: falta ' + location.hostname + ' na lista de domínios autorizados do Authentication.';
    dizer(texto, false);
    await contarFalha(codigo || 'sem-codigo', (e && e.message) ? e.message : String(e));
    botao.disabled = false;
  }
});
</script>
</body>
</html>
`;
}

/** Abre o navegador padrão do diretor no endereço, sem travar se não der. */
function abrirNavegador(endereco: string, registrar: (l: string) => void): void {
  try {
    // No Windows o start é do próprio interpretador de comandos. O par de aspas
    // vazias é o título da janela, e sem ele o start trata o endereço como título.
    const filho = spawn('cmd', ['/c', 'start', '', endereco], { detached: true, stdio: 'ignore' });
    filho.unref();
    registrar('navegador aberto no endereço da entrada');
  } catch (e) {
    registrar(`não deu para abrir o navegador sozinho (${e instanceof Error ? e.message : String(e)}), abra o endereço na mão`);
  }
}

/** Lê o corpo do pedido com teto de tamanho, para um corpo enorme não derrubar nada. */
function lerCorpo(pedido: IncomingMessage, tetoBytes: number): Promise<string | null> {
  return new Promise((resolve) => {
    const partes: Buffer[] = [];
    let total = 0;
    pedido.on('data', (pedaco: Buffer) => {
      total += pedaco.length;
      if (total > tetoBytes) {
        resolve(null);
        pedido.destroy();
        return;
      }
      partes.push(pedaco);
    });
    pedido.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    pedido.on('error', () => resolve(null));
  });
}

/**
 * Abre a porta de laço de retorno, espera o diretor entrar no navegador, e devolve
 * o token de atualização da sessão dele. Fecha a porta SEMPRE, inclusive em erro.
 *
 * Não confere identidade e não grava nada: isso é de identidade.ts, no mesmo
 * caminho já provado. Aqui o trabalho é só transportar, com as sete trancas.
 */
export async function entrarPeloNavegador(opcoes: OpcoesEntradaNavegador): Promise<CredencialDoNavegador> {
  const registrar = opcoes.registrar ?? ((): void => undefined);
  const limiteMs = opcoes.limiteMs ?? LIMITE_PADRAO_MS;
  const segredo = randomBytes(32).toString('hex');
  const comecou = Date.now();

  let resolver: ((c: CredencialDoNavegador) => void) | null = null;
  let rejeitar: ((e: Error) => void) | null = null;
  let entregou = false;
  let porta = 0;
  /** A página chegou a ser servida? Muda o que o tempo esgotado significa. */
  let serviuPagina = false;
  /** O último motivo que a própria página relatou, se relatou algum. */
  let ultimaFalhaDaPagina: string | null = null;

  const servidor: Server = createServer((pedido: IncomingMessage, resposta: ServerResponse) => {
    void (async (): Promise<void> => {
      const recusar = (codigo: number, texto: string): void => {
        resposta.writeHead(codigo, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        resposta.end(texto);
      };

      // T5, cabeçalho de hospedeiro. Só uma das duas grafias do laço de retorno,
      // com a porta desta rodada, passa. Nome de domínio que resolve para o laço
      // de retorno bate aqui, porque o nome dele não é nenhuma das duas.
      const hospedeiro = pedido.headers.host ?? '';
      const aceitos = GRAFIAS_DO_LACO.map((g) => `${g}:${porta}`);
      if (!aceitos.includes(hospedeiro)) {
        registrar(`pedido recusado, hospedeiro ${hospedeiro || 'ausente'} não é ${aceitos.join(' nem ')}`);
        recusar(404, 'nada aqui');
        return;
      }

      const caminho = (pedido.url ?? '/').split('?')[0] ?? '/';
      const partes = caminho.split('/').filter((p) => p.length > 0);
      const primeira = partes[0] ?? '';

      // T4, segredo de uso único. Sem ele, 404 e nada mais.
      if (!segredoBate(primeira, segredo)) {
        recusar(404, 'nada aqui');
        return;
      }

      if (pedido.method === 'GET' && partes.length === 1) {
        const html = paginaDeEntrada(opcoes.config, segredo);
        resposta.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'referrer-policy': 'no-referrer',
        });
        resposta.end(html);
        // Registrar que a página FOI servida. Sem esta linha, tempo esgotado era
        // uma coisa só, e podia ser o diretor que não clicou ou a página que
        // abriu e falhou. Eram dois problemas diferentes com o mesmo relato.
        serviuPagina = true;
        registrar(`página de entrada servida para o navegador, em ${hospedeiro}`);
        return;
      }

      // O canal de volta do erro de tela. A página manda para cá o que deu errado
      // no login, para o terminal e o relato saberem. Não decide nada, não grava
      // nada, só conta: a porta continua esperando a entrega de verdade.
      if (pedido.method === 'POST' && partes[1] === 'falha') {
        const tipoFalha = String(pedido.headers['content-type'] ?? '');
        if (!tipoFalha.toLowerCase().startsWith('application/json')) {
          recusar(415, 'tipo de conteúdo não aceito');
          return;
        }
        const corpoFalha = await lerCorpo(pedido, 8 * 1024);
        let motivo = 'não deu para ler o motivo';
        if (corpoFalha !== null) {
          try {
            const j = JSON.parse(corpoFalha) as Record<string, unknown>;
            const c = typeof j['codigo'] === 'string' ? j['codigo'] : '';
            const t = typeof j['texto'] === 'string' ? j['texto'] : '';
            motivo = [c, t].filter((p) => p.length > 0).join(', ').slice(0, 400);
          } catch {
            motivo = 'motivo não era JSON';
          }
        }
        resposta.writeHead(204, { 'cache-control': 'no-store' });
        resposta.end();
        ultimaFalhaDaPagina = motivo;
        registrar(`a página relatou falha no login: ${motivo}`);
        return;
      }

      if (pedido.method === 'POST' && partes[1] === 'entregar') {
        // T6, tipo de conteúdo JSON obrigatório. Página de outra origem não
        // consegue mandar JSON sem pré-verificação, e pré-verificação aqui não
        // tem resposta. Nenhum cabeçalho de origem cruzada é servido, de propósito.
        const tipo = String(pedido.headers['content-type'] ?? '');
        if (!tipo.toLowerCase().startsWith('application/json')) {
          registrar(`entrega recusada, tipo de conteúdo ${tipo || 'ausente'}`);
          recusar(415, 'tipo de conteúdo não aceito');
          return;
        }
        // T7, uma entrega e acabou.
        if (entregou) {
          recusar(409, 'esta entrada já foi usada');
          return;
        }
        const corpo = await lerCorpo(pedido, 64 * 1024);
        if (corpo === null) {
          recusar(413, 'corpo grande demais');
          return;
        }
        let j: unknown;
        try {
          j = JSON.parse(corpo);
        } catch {
          recusar(400, 'corpo não é JSON');
          return;
        }
        const o = typeof j === 'object' && j !== null ? (j as Record<string, unknown>) : {};
        const refreshToken = typeof o['refreshToken'] === 'string' ? o['refreshToken'] : '';
        const emailDeclarado = typeof o['email'] === 'string' ? o['email'].trim().toLowerCase() : null;
        if (refreshToken.length === 0) {
          recusar(400, 'a entrega veio sem credencial');
          return;
        }
        entregou = true;
        resposta.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        resposta.end('{"ok":true}');
        registrar(`credencial recebida pelo laço de retorno, conta declarada ${emailDeclarado ?? 'não declarada'}`);
        resolver?.({ refreshToken, emailDeclarado, portaAbertaMs: Date.now() - comecou, porta });
        return;
      }

      recusar(404, 'nada aqui');
    })();
  });

  const promessa = new Promise<CredencialDoNavegador>((ok, erro) => {
    resolver = ok;
    rejeitar = erro;
  });

  let relogio: NodeJS.Timeout | null = null;

  try {
    await new Promise<void>((ok, erro) => {
      servidor.once('error', erro);
      // T1 e T2: endereço fixo no laço de retorno, porta sorteada pelo sistema.
      servidor.listen(0, LACO_DE_RETORNO, () => {
        servidor.removeListener('error', erro);
        ok();
      });
    });

    const endereco = servidor.address() as AddressInfo | null;
    if (endereco === null || typeof endereco === 'string') {
      throw new EntradaPeloNavegadorFalhou(
        'o sistema não devolveu a porta do laço de retorno',
        'rode a instalação de novo; se repetir, avise a fábrica'
      );
    }
    porta = endereco.port;
    const url = `http://${GRAFIA_ESCOLHIDA}:${porta}/${segredo}`;
    registrar(
      `porta de entrada aberta, escutando em ${LACO_DE_RETORNO}:${porta}, endereço na grafia ${GRAFIA_ESCOLHIDA}, só laço de retorno, com segredo de uso único`
    );
    opcoes.aoSubir?.(url, porta);

    servidor.on('error', (e) => {
      rejeitar?.(
        new EntradaPeloNavegadorFalhou(
          `a porta de entrada falhou: ${e instanceof Error ? e.message : String(e)}`,
          'rode a instalação de novo'
        )
      );
    });

    relogio = setTimeout(() => {
      const segundos = Math.round(limiteMs / 1000);
      // Três desfechos diferentes, três mensagens diferentes. Antes os três
      // chegavam como a mesma frase e não davam para diagnosticar.
      const oQueAconteceu =
        ultimaFalhaDaPagina !== null
          ? `tempo esgotado em ${segundos} segundo(s): a página abriu e o login falhou com ${ultimaFalhaDaPagina}`
          : serviuPagina
            ? `tempo esgotado em ${segundos} segundo(s): a página abriu mas nenhuma conta foi entregue`
            : `tempo esgotado em ${segundos} segundo(s): a página nem chegou a ser aberta no navegador`;
      const oQueFazer =
        ultimaFalhaDaPagina !== null
          ? 'leia o motivo acima, resolva e rode o login de novo'
          : serviuPagina
            ? 'rode o login de novo e termine a entrada na página, clicando em Entrar com o Google'
            : 'rode o login de novo e abra na mão o endereço que aparecer no terminal';
      rejeitar?.(new EntradaPeloNavegadorFalhou(`${oQueAconteceu}, e a porta fechou`, oQueFazer));
    }, limiteMs);

    console.log('');
    console.log('Abra esta página e entre com a sua conta do Google:');
    console.log(`  ${url}`);
    console.log('');
    console.log(`A página vive nesta máquina, em ${LACO_DE_RETORNO}, e fecha sozinha no fim ou em ${Math.round(limiteMs / 1000)} segundo(s).`);
    if (opcoes.naoAbrirNavegador !== true) abrirNavegador(url, registrar);

    return await promessa;
  } finally {
    // T3, a porta fecha SEMPRE. Sucesso, recusa, erro, tempo esgotado: tudo passa
    // por aqui. Nada desta ponte continua escutando depois desta linha.
    if (relogio !== null) clearTimeout(relogio);
    await new Promise<void>((ok) => {
      servidor.closeAllConnections?.();
      servidor.close(() => ok());
      setTimeout(ok, 3000);
    });
    registrar(`porta de entrada fechada depois de ${Date.now() - comecou} ms`);
  }
}
