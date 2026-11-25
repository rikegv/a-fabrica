// entrar.ts, o login de uma vez da ponte. Chamado pela instalacao.
//
// Desce a escada de credencial (identidade.ts) e deixa a sessao gravada em
// %USERPROFILE%\.a-fabrica-ponte\sessao.json. Dali em diante o proprio SDK
// renova o token e o diretor nao loga de novo.
//
// §A.6 na leitura da OST 7: ESTE comando, e so ele, abre o laco de retorno em
// 127.0.0.1 para o login no navegador. Ele e o comando que o diretor roda na mao,
// vive segundos e fecha a porta sempre, inclusive em erro. O servico, que fica no
// ar o dia inteiro, nunca liga esse degrau. Veja entradaNavegador.ts.
//
// A COLAGEM MORREU na OST 7. Nao existe mais --colar, nem leitura de credencial
// pela entrada de texto, nem mensagem mandando o diretor copiar token de tela.
//
// Uso:
//   node dist/entrar.js                 confere a sessao, e faz o login no navegador se faltar
//   node dist/entrar.js --emulador      entra no emulador, para teste sem a nuvem
//   node dist/entrar.js --sem-navegador confere a sessao e NAO abre porta nenhuma
//   node dist/entrar.js --relato ARQ    grava o relato passo a passo no arquivo indicado
//
// No Linux, OST 14, o login e por codigo colado, no modelo do login do Claude
// Code, e nada escuta porta nenhuma (veja entradaPorCodigo.ts):
//   node dist/entrar.js                 mostra o link e espera o endereco colado na entrada
//   node dist/entrar.js --link          so gera o link e guarda a entrada pendente, 60 minutos
//   node dist/entrar.js --codigo        le o endereco colado da entrada e conclui a entrada pendente

import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { deleteApp, getApps } from 'firebase/app';
import {
  CAMINHO_CONFIG,
  CAMINHO_SESSAO,
  CAMINHO_SESSAO_EMULADOR,
  FaltaConfig,
  PASTA_LOCAL,
  protegerPastaLocal,
} from './config.js';
import { ESCADA, IdentidadeRecusada, abrirIdentidade, temSessaoSalva } from './identidade.js';
import { createInterface } from 'node:readline';
import { carregarConfig } from './config.js';
import {
  CAMINHO_ENTRADA_PENDENTE,
  EntradaPorCodigoFalhou,
  VALIDADE_DA_ENTRADA_MS,
  apagarEntradaPendente,
  gerarEntrada,
  gravarEntradaPendente,
  lerEntradaPendente,
  type EntradaPendente,
} from './entradaPorCodigo.js';
import { aplicarProtecao, conferirProtecao, exigirProtecao } from './protecaoSessao.js';
import { NO_WINDOWS, comoEntrar } from './plataforma.js';

/**
 * Sai fechando o que esta aberto.
 *
 * Sem isto, o Node pode cair no encerramento com os canais de rede do Firebase
 * ainda abertos e devolver codigo de falha do sistema operacional em vez do codigo
 * que este programa escolheu. A instalacao le esse codigo para decidir o que dizer
 * ao diretor, entao o codigo tem de ser o nosso, inclusive no caminho de erro.
 */
async function sairLimpo(codigo: number): Promise<never> {
  for (const app of getApps()) await deleteApp(app).catch(() => undefined);
  await new Promise<void>((r) => setTimeout(r, 400));
  process.exit(codigo);
}

function argumento(nome: string): string | null {
  const i = process.argv.indexOf(nome);
  if (i < 0) return null;
  const v = process.argv[i + 1];
  return v !== undefined && !v.startsWith('--') ? v : '';
}

/** O passo a passo que o diretor le junto do link. §A.11: sem travessao. */
function mostrarLink(e: EntradaPendente): void {
  console.log('');
  console.log('1. Abra este link em qualquer navegador, no computador ou no celular:');
  console.log('');
  console.log(e.link);
  console.log('');
  console.log('2. Entre com a conta do diretor, com a segunda etapa que a sua conta pedir.');
  console.log('3. A pagina vai parar numa tela do Firebase com uma mensagem em ingles,');
  console.log('   "Unable to process request due to missing initial state". Isso e esperado.');
  console.log('4. Copie o endereco INTEIRO da barra do navegador e cole aqui.');
  console.log('');
  console.log(`O link vale ${Math.round(VALIDADE_DA_ENTRADA_MS / 60_000)} minutos e serve uma vez so. Nada nesta maquina escuta porta.`);
}

/** Le uma linha da entrada, com prazo. Sem prazo, o login esperaria para sempre. */
function lerUmaLinha(prazoMs: number): Promise<string> {
  return new Promise((ok, erro) => {
    const rl = createInterface({ input: process.stdin, terminal: false });
    const relogio = setTimeout(() => {
      rl.close();
      erro(new EntradaPorCodigoFalhou('ninguem colou o endereco dentro do prazo', 'rode o login de novo'));
    }, prazoMs);
    rl.once('line', (l) => {
      clearTimeout(relogio);
      rl.close();
      ok(l);
    });
    rl.once('close', () => {
      clearTimeout(relogio);
      ok('');
    });
  });
}

/** Le a entrada inteira, para o modo --codigo, que recebe a colagem por cano. */
async function lerTudo(): Promise<string> {
  const partes: Buffer[] = [];
  for await (const p of process.stdin) partes.push(Buffer.isBuffer(p) ? p : Buffer.from(String(p)));
  return Buffer.concat(partes).toString('utf8').slice(0, 8192);
}

async function principal(): Promise<void> {
  // OST 14: pergunta sem rede, para o instalador do Linux. 0 com usuario salvo,
  // 1 sem. Nao abre nada, nao mostra nada da sessao.
  if (process.argv.includes('--tem-sessao')) {
    process.exit(temSessaoSalva(process.argv.includes('--emulador')) ? 0 : 1);
  }
  const emulador = process.argv.includes('--emulador') || process.env.PONTE_EMULADOR === '1';
  const semNavegador = process.argv.includes('--sem-navegador');
  const soLink = process.argv.includes('--link');
  const comCodigo = process.argv.includes('--codigo');
  // Login por codigo colado: no Linux, sempre que nao for emulador nem conferencia.
  const porCodigo = !NO_WINDOWS && !emulador && !semNavegador;
  const arquivoRelato = argumento('--relato');
  const relato: string[] = [];
  const registrar = (linha: string): void => {
    relato.push(linha);
    console.log(`  ${linha}`);
    if (arquivoRelato) appendFileSync(arquivoRelato, `${linha}\n`, 'utf8');
  };

  const caminhoSessao = emulador ? CAMINHO_SESSAO_EMULADOR : CAMINHO_SESSAO;

  console.log('A Fabrica, login de uma vez da ponte');
  console.log('');
  console.log('Fechando a pasta local para o seu usuario:');
  const icaclsPasta = protegerPastaLocal();
  console.log(icaclsPasta);
  if (arquivoRelato) writeFileSync(arquivoRelato, `icacls da pasta:\n${icaclsPasta}\n\n`, 'utf8');

  console.log('');
  console.log('Escada de credencial, na ordem de preferencia:');
  for (const d of ESCADA) console.log(`  ${d.nome} (${d.fase}): ${d.descricao}`);
  console.log('');

  let entradaPorCodigo: { pendente: EntradaPendente; colado: string } | null = null;
  try {
    if (porCodigo) {
      const jaTem = temSessaoSalva(emulador);
      if (soLink) {
        if (jaTem) {
          console.log(`A ponte ja tem sessao em ${caminhoSessao}. Nenhum link novo foi gerado.`);
          await sairLimpo(0);
        }
        const e = await gerarEntrada(carregarConfig());
        gravarEntradaPendente(e);
        aplicarProtecao(CAMINHO_ENTRADA_PENDENTE);
        mostrarLink(e);
        console.log('');
        console.log('Entrada pendente guardada na pasta trancada da ponte. Depois de colar, rode com --codigo.');
        await sairLimpo(0);
      }
      if (!jaTem) {
        if (comCodigo) {
          entradaPorCodigo = { pendente: lerEntradaPendente(), colado: await lerTudo() };
        } else {
          const e = await gerarEntrada(carregarConfig());
          gravarEntradaPendente(e);
          aplicarProtecao(CAMINHO_ENTRADA_PENDENTE);
          mostrarLink(e);
          console.log('');
          process.stdout.write('Cole aqui o endereco e aperte Enter: ');
          entradaPorCodigo = { pendente: e, colado: await lerUmaLinha(VALIDADE_DA_ENTRADA_MS) };
        }
      }
    }
    const id = await abrirIdentidade({
      emulador,
      permitirNavegador: NO_WINDOWS && !semNavegador,
      entradaPorCodigo,
      registrar,
    }).finally(() => {
      // A entrada pendente serve UMA vez, deu certo ou nao. Um arquivo, nomeado.
      if (entradaPorCodigo !== null) apagarEntradaPendente();
    });

    // Trancar o ARQUIVO de sessao, nao so a pasta. Na Onda 2 este arquivo vale
    // como chave de aprovacao: a ponte escreve resposta de aprovacao na base com
    // ele. Modo 0o600 do Node nao mexe na lista de controle de acesso do Windows,
    // entao quem tranca de verdade e o icacls, aqui.
    console.log('');
    console.log('Trancando o arquivo de sessao para o seu usuario, e so ele:');
    const icaclsArquivo = aplicarProtecao(caminhoSessao);
    console.log(icaclsArquivo);
    if (arquivoRelato) appendFileSync(arquivoRelato, `icacls do arquivo de sessao:\n${icaclsArquivo}\n\n`, 'utf8');

    // E conferir que trancou, em vez de afirmar que trancou. Afirmacao de
    // protecao sem conferencia foi exatamente o que a seguranca vetou antes.
    // Pasta com a mesma exigencia que o servico faz ao subir (ponte.ts): herança
    // quebrada. Antes a instalacao conferia a pasta mais frouxo que o servico.
    const vereditos = [
      conferirProtecao(PASTA_LOCAL, { exigirHerancaQuebrada: true }),
      conferirProtecao(CAMINHO_CONFIG),
      conferirProtecao(caminhoSessao),
    ];
    for (const v of vereditos) console.log(`  ${v.protegido ? 'TRANCADO' : 'ABERTO'}: ${v.motivo}`);
    if (arquivoRelato) {
      appendFileSync(
        arquivoRelato,
        `conferencia da tranca:\n${vereditos.map((v) => `${v.protegido ? 'TRANCADO' : 'ABERTO'}: ${v.motivo}\n${v.saidaIcacls}`).join('\n')}\n`,
        'utf8'
      );
    }
    const abertos = vereditos.filter((v) => !v.protegido);
    if (abertos.length > 0) {
      console.log('');
      console.error('O login funcionou, mas a tranca do arquivo de sessao NAO ficou de pe.');
      console.error('A ponte vai recusar subir assim, de proposito, porque esse arquivo vale como chave de aprovacao.');
      for (const v of abertos) console.error(`  ${v.motivo}`);
      await deleteApp(id.app).catch(() => undefined);
      await sairLimpo(5);
    }

    console.log('');
    console.log(`Pronto. A ponte entra como ${id.usuario.email}, pelo degrau ${id.degrau}.`);
    console.log(`Sessao guardada em ${caminhoSessao}, trancada para o seu usuario e so ele.`);
    console.log('O SDK renova o token sozinho. Voce nao precisa logar de novo.');
    // Fecha o aplicativo do Firebase antes de sair. Sem isto, o Node pode cair no
    // encerramento com os canais de rede ainda abertos e devolver codigo de erro
    // mesmo tendo dado tudo certo, o que faria a instalacao achar que falhou.
    await deleteApp(id.app).catch(() => undefined);
    await sairLimpo(0);
  } catch (e) {
    console.log('');
    if (e instanceof EntradaPorCodigoFalhou) {
      console.error(`O login nao terminou: ${e.message}.`);
      console.error(`O que fazer: ${e.oQueFazer}.`);
      await sairLimpo(4);
    }
    if (e instanceof FaltaConfig) {
      console.error('A ponte nao tem configuracao local ainda.');
      console.error(e.oQueFalta);
      await sairLimpo(2);
    }
    if (e instanceof IdentidadeRecusada) {
      console.error('A ponte nao tem sessao do diretor, e sem isso ela nao sobe, §A.6.');
      console.error(e.message);
      console.error('');
      console.error('O que resolve, uma vez so:');
      console.error(`  ${comoEntrar()}`);
      console.error(
        NO_WINDOWS
          ? '  Vai abrir uma pagina na sua maquina, em 127.0.0.1. Entre com a sua conta do Google.'
          : '  Vai aparecer um link. Abra em qualquer navegador, entre com o Google e cole aqui o endereco onde a pagina parou.'
      );
      console.error('');
      console.error('A ponte nunca usa o token do Firebase CLI, por decisao do diretor: aquele token tem');
      console.error('escopo de nuvem muito maior do que as regras do Firestore limitam.');
      if (existsSync(caminhoSessao)) {
        const v = conferirProtecao(caminhoSessao);
        console.error('');
        console.error(`Estado da tranca do arquivo de sessao: ${v.protegido ? 'TRANCADO' : 'ABERTO'}, ${v.motivo}`);
      }
      await sairLimpo(3);
    }
    console.error('Falha ao entrar.');
    console.error(e instanceof Error ? e.message : String(e));
    await sairLimpo(1);
  }
}

// Exportado para a prova usar o mesmo portao que o servico usa, sem copia.
export { exigirProtecao };

void principal();
