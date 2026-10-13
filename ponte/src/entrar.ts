// entrar.ts, o login de uma vez da ponte. Chamado pela instalacao.
//
// Desce a escada de credencial (identidade.ts) e deixa a sessao gravada em
// %USERPROFILE%\.a-fabrica-ponte\sessao.json. Dali em diante o proprio SDK
// renova o token e o diretor nao loga de novo.
//
// §A.6: so conexao de saida. Nada aqui escuta nada, nem em 127.0.0.1.
//
// Uso:
//   node dist/entrar.js                 confere a sessao e tenta os degraus que nao pedem nada
//   node dist/entrar.js --colar         le da entrada de texto a credencial que o painel mostra
//   node dist/entrar.js --emulador      entra no emulador, para teste sem a nuvem
//   node dist/entrar.js --relato ARQ    grava o relato passo a passo no arquivo indicado

import { appendFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { deleteApp, getApps } from 'firebase/app';
import { CAMINHO_SESSAO, CAMINHO_SESSAO_EMULADOR, FaltaConfig, protegerPastaLocal } from './config.js';
import { ESCADA, IdentidadeRecusada, abrirIdentidade, lerColagem } from './identidade.js';

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

async function pedirColagem(): Promise<string> {
  // Se a credencial vier por entrada de texto redirecionada (instalacao sem teclado,
  // prova de caminho), le o que chegou. Senao, pergunta.
  console.log('');
  console.log('Cole aqui a credencial de sessao do painel, ja logado como voce, e aperte Enter.');
  console.log('Ela e usada UMA vez: a ponte troca por sessao propria e dali em diante o SDK renova sozinho.');
  console.log('A credencial colada nao e gravada em arquivo nenhum, nem em relato.');
  const leitor = createInterface({ input: process.stdin, output: process.stdout });
  const linha = await new Promise<string>((resolve) => leitor.question('credencial: ', resolve));
  leitor.close();
  return linha;
}

async function principal(): Promise<void> {
  const emulador = process.argv.includes('--emulador') || process.env.PONTE_EMULADOR === '1';
  const arquivoRelato = argumento('--relato');
  const relato: string[] = [];
  const registrar = (linha: string): void => {
    relato.push(linha);
    console.log(`  ${linha}`);
    if (arquivoRelato) appendFileSync(arquivoRelato, `${linha}\n`, 'utf8');
  };

  console.log('A Fabrica, login de uma vez da ponte');
  console.log('');
  console.log('Fechando a pasta local para o seu usuario:');
  const icacls = protegerPastaLocal();
  console.log(icacls);
  if (arquivoRelato) writeFileSync(arquivoRelato, `icacls:\n${icacls}\n\n`, 'utf8');

  console.log('');
  console.log('Escada de credencial, na ordem de preferencia:');
  for (const d of ESCADA) console.log(`  ${d.nome} (${d.fase}): ${d.descricao}`);
  console.log('');

  const colagem = process.argv.includes('--colar') ? await pedirColagem() : null;

  // Confere a forma do que foi colado ANTES de qualquer chamada de rede, e recusa
  // com mensagem clara. Falha fechada: colagem fora de forma nao vira sessao e nao
  // grava nada em disco.
  if (colagem !== null) {
    const leitura = lerColagem(colagem);
    if (!leitura.ok) {
      console.log('');
      console.error('A credencial colada foi recusada, e nada foi gravado.');
      console.error(`Motivo: ${leitura.motivo}`);
      console.error('');
      console.error('O que fazer: volte ao painel ja logado, copie a credencial de sessao inteira e rode de novo');
      console.error('  powershell -ExecutionPolicy Bypass -File ponte\\instalar.ps1 -Colar');
      await sairLimpo(4);
      return;
    }
    registrar(
      `colagem conferida na forma: ${leitura.formato}, ${leitura.refreshToken.length} caractere(s), ` +
        `conta declarada ${leitura.emailDeclarado ?? 'nao declarada'}`
    );
  }

  try {
    const id = await abrirIdentidade({ emulador, colagem, registrar });
    console.log('');
    console.log(`Pronto. A ponte entra como ${id.usuario.email}, pelo degrau ${id.degrau}.`);
    console.log(`Sessao guardada em ${emulador ? CAMINHO_SESSAO_EMULADOR : CAMINHO_SESSAO}, so o seu usuario le.`);
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
      console.error('1. Abra https://a-fabrica-soulan.web.app e entre com a sua conta do Google.');
      console.error('2. Com o painel aberto, copie a credencial de sessao daquela sessao de navegador.');
      console.error('3. Rode: powershell -ExecutionPolicy Bypass -File ponte\\instalar.ps1 -Colar');
      console.error('   e cole a credencial quando ele pedir.');
      console.error('');
      console.error('A ponte nunca usa o token do Firebase CLI, por decisao do diretor: aquele token tem');
      console.error('escopo de nuvem muito maior do que as regras do Firestore limitam.');
      await sairLimpo(3);
    }
    console.error('Falha ao entrar.');
    console.error(e instanceof Error ? e.message : String(e));
    await sairLimpo(1);
  }
}

void principal();
