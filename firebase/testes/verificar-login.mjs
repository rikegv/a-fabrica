// verificar-login.mjs, prontidao do login do diretor no projeto da nuvem.
//
// Porta de entrada dos testes ao vivo: enquanto este verificador nao disser PRONTO,
// nada de teste ao vivo com login roda, porque nao ha como entrar.
//
// Falha fechada, §A.6: qualquer erro, resposta ausente, resposta malformada, tempo
// esgotado ou verificacao que nao pode ser feita resulta em NAO PRONTO, nunca em
// pronto por omissao. Codigo de saida 0 somente quando as tres verificacoes passam.
//
// Nenhuma credencial no codigo nem no repositorio, §A.6. O token vem do gcloud da
// maquina do diretor e a chave do cliente web vem de firebase apps:sdkconfig em
// tempo de execucao, ou da variavel de ambiente FIREBASE_API_KEY. Nada e gravado.
//
// §A.20: todo comando de gcloud e de firebase leva o projeto explicito.
//
// Uso:
//   node verificar-login.mjs
//   node verificar-login.mjs --projeto a-fabrica-soulan

import { exec, execFile } from 'node:child_process';

const args = process.argv.slice(2);
const argProjeto = args.indexOf('--projeto');
const PROJETO = argProjeto >= 0 ? args[argProjeto + 1] : 'a-fabrica-soulan';
const DIRETOR = 'henrique.vieira@soulan.com.br';
const LIMITE_MS = 20000;

const resultados = [];
function registrar(nome, situacao, detalhe) {
  resultados.push({ nome, situacao, detalhe });
}

// No Windows, gcloud e firebase sao scripts .cmd e precisam de shell. Para nao
// concatenar argumentos soltos no shell, a linha e montada aqui e os argumentos
// sao fixos e conhecidos, nenhum vem de entrada do usuario.
function rodar(comando, argumentos) {
  const noWindows = process.platform === 'win32';
  const linha = noWindows ? [comando, ...argumentos].join(' ') : null;
  return new Promise((resolve) => {
    const terminou = (erro, saida, erroSaida) => {
      if (erro) return resolve({ ok: false, texto: String(erroSaida || erro.message || '').trim() });
      resolve({ ok: true, texto: String(saida || '').trim() });
    };
    const opcoes = { timeout: LIMITE_MS, windowsHide: true, maxBuffer: 4 * 1024 * 1024 };
    const filho = noWindows
      ? exec(linha, opcoes, terminou)
      : execFile(comando, argumentos, opcoes, terminou);
    filho.on('error', () => resolve({ ok: false, texto: 'nao foi possivel executar ' + comando }));
  });
}

async function buscar(url, cabecalhos) {
  const corte = new AbortController();
  const relogio = setTimeout(() => corte.abort(), LIMITE_MS);
  try {
    const r = await fetch(url, { headers: cabecalhos || {}, signal: corte.signal });
    const bruto = await r.text();
    let corpo = null;
    try { corpo = JSON.parse(bruto); } catch { corpo = null; }
    return { http: r.status, corpo, bruto: bruto.slice(0, 400), erro: null };
  } catch (e) {
    return { http: 0, corpo: null, bruto: '', erro: String(e && e.message ? e.message : e) };
  } finally {
    clearTimeout(relogio);
  }
}

// 1. Token do gcloud da maquina do diretor. Sem token, nada pode ser verificado.
async function pegarToken() {
  const r = await rodar('gcloud', ['auth', 'print-access-token', '--project', PROJETO]);
  if (!r.ok || !/^ya29\.|^[A-Za-z0-9._-]{40,}$/.test(r.texto.split('\n').pop().trim())) return null;
  return r.texto.split('\n').pop().trim();
}

// 2. Chave do cliente web, em tempo de execucao, nunca do repositorio.
async function pegarChaveWeb() {
  if (process.env.FIREBASE_API_KEY && process.env.FIREBASE_API_KEY !== 'emulador') return process.env.FIREBASE_API_KEY;
  const r = await rodar('firebase', ['apps:sdkconfig', 'web', '--project', PROJETO, '--json']);
  if (!r.ok) return null;
  const inicio = r.texto.indexOf('{');
  if (inicio < 0) return null;
  try {
    const j = JSON.parse(r.texto.slice(inicio));
    const conteudo = j?.result?.fileContents;
    const config = conteudo ? JSON.parse(conteudo) : (j?.result?.sdkConfig || null);
    return config && typeof config.apiKey === 'string' && config.apiKey.length > 20 ? config.apiKey : null;
  } catch { return null; }
}

const PASSOS_CONSOLE = [
  'Passo do diretor no console, nesta ordem:',
  `  1. Abrir https://console.firebase.google.com/project/${PROJETO}/authentication`,
  '  2. Clicar em "Get started", ou "Vamos comecar", na tela do Authentication.',
  '  3. Na aba "Sign-in method", ou "Metodo de login", escolher o provedor Google.',
  '  4. Ligar a chave "Enable", ou "Ativar".',
  `  5. Em "Project support email", ou "E-mail de suporte do projeto", escolher ${DIRETOR}.`,
  '  6. Salvar.',
  '  7. Rodar este verificador de novo: node verificar-login.mjs',
];

async function principal() {
  console.log('=== PRONTIDAO DO LOGIN, projeto ' + PROJETO + ' ===');
  console.log('Momento da verificacao: ' + new Date().toISOString());
  console.log('');

  const token = await pegarToken();
  if (!token) {
    registrar('token do gcloud', 'NAO', 'gcloud nao devolveu token de acesso para o projeto ' + PROJETO);
    registrar('Authentication ligado', 'NAO', 'nao verificado, sem token, falha fechada');
    registrar('provedor Google ativo', 'NAO', 'nao verificado, sem token, falha fechada');
    registrar('dominios autorizados do login', 'NAO', 'nao verificado, sem token, falha fechada');
    return concluir(['Antes de tudo, autenticar o gcloud na maquina: gcloud auth login', ...PASSOS_CONSOLE]);
  }
  registrar('token do gcloud', 'OK', 'token de acesso obtido na maquina, nada gravado');

  const cab = { Authorization: 'Bearer ' + token, 'x-goog-user-project': PROJETO };

  // Verificacao A, lado administrativo: a configuracao de identidade do projeto existe?
  const conf = await buscar(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJETO}/config`, cab);
  let authLigado = false;
  if (conf.erro) {
    registrar('Authentication ligado', 'NAO', 'erro de rede ao consultar a configuracao: ' + conf.erro);
  } else if (conf.http === 404 || /CONFIGURATION_NOT_FOUND/.test(conf.bruto)) {
    registrar('Authentication ligado', 'NAO', 'a API de identidade responde CONFIGURATION_NOT_FOUND, HTTP ' + conf.http + ', o Authentication nunca foi inicializado neste projeto');
  } else if (conf.http === 200 && conf.corpo && typeof conf.corpo === 'object') {
    authLigado = true;
    registrar('Authentication ligado', 'OK', 'configuracao de identidade existe, HTTP 200');
  } else {
    registrar('Authentication ligado', 'NAO', 'resposta inesperada, HTTP ' + conf.http + ', conteudo: ' + conf.bruto.replace(/\s+/g, ' ').slice(0, 160));
  }

  // Verificacao B, provedor Google ativo.
  let googleAtivo = false;
  const idps = await buscar(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJETO}/defaultSupportedIdpConfigs`, cab);
  if (idps.erro) {
    registrar('provedor Google ativo', 'NAO', 'erro de rede ao listar provedores: ' + idps.erro);
  } else if (idps.http === 404 || /CONFIGURATION_NOT_FOUND/.test(idps.bruto)) {
    registrar('provedor Google ativo', 'NAO', 'nao ha lista de provedores porque o Authentication nao esta ligado, HTTP ' + idps.http);
  } else if (idps.http === 200 && idps.corpo && typeof idps.corpo === 'object') {
    const lista = Array.isArray(idps.corpo.defaultSupportedIdpConfigs) ? idps.corpo.defaultSupportedIdpConfigs : [];
    const google = lista.find((c) => typeof c?.name === 'string' && c.name.endsWith('/google.com'));
    if (google && google.enabled === true) {
      googleAtivo = true;
      registrar('provedor Google ativo', 'OK', 'provedor google.com presente e habilitado');
    } else if (google) {
      registrar('provedor Google ativo', 'NAO', 'provedor google.com existe mas esta desabilitado');
    } else {
      registrar('provedor Google ativo', 'NAO', 'provedor google.com ausente, provedores encontrados: ' + (lista.map((c) => String(c.name).split('/').pop()).join(', ') || 'nenhum'));
    }
  } else {
    registrar('provedor Google ativo', 'NAO', 'resposta inesperada, HTTP ' + idps.http + ', conteudo: ' + idps.bruto.replace(/\s+/g, ' ').slice(0, 160));
  }

  // Verificacao C, lado do cliente: a mesma pergunta pela porta que o painel e a ponte usam.
  // Confirma tambem que o dominio de onde o painel roda esta autorizado a fazer login.
  let clienteOk = false;
  const chave = await pegarChaveWeb();
  if (!chave) {
    registrar('dominios autorizados do login', 'NAO', 'chave do cliente web nao obtida em tempo de execucao, verificacao do lado do cliente nao feita, falha fechada');
  } else {
    const pub = await buscar(`https://identitytoolkit.googleapis.com/v1/projects?key=${chave}`);
    if (pub.erro) {
      registrar('dominios autorizados do login', 'NAO', 'erro de rede na porta do cliente: ' + pub.erro);
    } else if (/CONFIGURATION_NOT_FOUND/.test(pub.bruto)) {
      registrar('dominios autorizados do login', 'NAO', 'a porta do cliente responde CONFIGURATION_NOT_FOUND, HTTP ' + pub.http + ', o login do painel e da ponte ainda nao funciona');
    } else if (pub.http === 200 && pub.corpo && Array.isArray(pub.corpo.authorizedDomains)) {
      const dominios = pub.corpo.authorizedDomains;
      const exigidos = ['localhost', `${PROJETO}.firebaseapp.com`, `${PROJETO}.web.app`];
      const faltando = exigidos.filter((d) => !dominios.includes(d));
      if (faltando.length === 0) {
        clienteOk = true;
        registrar('dominios autorizados do login', 'OK', 'dominios autorizados: ' + dominios.join(', '));
      } else {
        registrar('dominios autorizados do login', 'NAO', 'faltam dominios autorizados: ' + faltando.join(', ') + '. Autorizados hoje: ' + dominios.join(', '));
      }
    } else {
      registrar('dominios autorizados do login', 'NAO', 'resposta inesperada na porta do cliente, HTTP ' + pub.http + ', conteudo: ' + pub.bruto.replace(/\s+/g, ' ').slice(0, 160));
    }
  }

  const pronto = authLigado && googleAtivo && clienteOk;
  return concluir(pronto ? null : PASSOS_CONSOLE);
}

function concluir(passos) {
  for (const r of resultados) console.log('  ' + r.situacao.padEnd(4) + ' ' + r.nome + ': ' + r.detalhe);
  const falhas = resultados.filter((r) => r.situacao !== 'OK');
  console.log('');
  if (falhas.length === 0) {
    console.log('VEREDITO: LOGIN PRONTO. O diretor pode entrar pelo navegador e a ponte pode entrar pelo SDK cliente.');
    console.log('Lembrete de seguranca, §A.6: o segundo fator e exigido na conta Google do diretor, nao nas regras do Firestore.');
    process.exit(0);
  }
  console.log('VEREDITO: LOGIN NAO PRONTO. ' + falhas.length + ' de ' + resultados.length + ' verificacoes falharam. Nenhum teste ao vivo com login deve rodar agora.');
  console.log('');
  if (passos) for (const p of passos) console.log(p);
  console.log('');
  console.log('Observacao do backend: inicializar o Authentication por programa e recusado com BILLING_NOT_ENABLED,');
  console.log('porque o Identity Platform exige plano pago para a API administrativa. O caminho e o clique do diretor');
  console.log('no console, no plano gratuito, pela tela do Authentication.');
  process.exit(1);
}

principal().catch((e) => {
  registrar('execucao do verificador', 'NAO', 'erro inesperado: ' + String(e && e.message ? e.message : e));
  concluir(PASSOS_CONSOLE);
});
