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
import { ESCADA, IdentidadeRecusada, abrirIdentidade } from './identidade.js';
import { aplicarProtecao, conferirProtecao, exigirProtecao } from './protecaoSessao.js';

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

async function principal(): Promise<void> {
  const emulador = process.argv.includes('--emulador') || process.env.PONTE_EMULADOR === '1';
  const semNavegador = process.argv.includes('--sem-navegador');
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

  try {
    const id = await abrirIdentidade({ emulador, permitirNavegador: !semNavegador, registrar });

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
    const vereditos = [conferirProtecao(PASTA_LOCAL), conferirProtecao(CAMINHO_CONFIG), conferirProtecao(caminhoSessao)];
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
      console.error('  powershell -ExecutionPolicy Bypass -File ponte\\instalar.ps1');
      console.error('  Vai abrir uma pagina na sua maquina, em 127.0.0.1. Entre com a sua conta do Google.');
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
