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
import { deleteApp } from 'firebase/app';
import { CAMINHO_SESSAO, CAMINHO_SESSAO_EMULADOR, FaltaConfig, protegerPastaLocal } from './config.js';
import { ESCADA, IdentidadeRecusada, abrirIdentidade } from './identidade.js';

function argumento(nome: string): string | null {
  const i = process.argv.indexOf(nome);
  if (i < 0) return null;
  const v = process.argv[i + 1];
  return v !== undefined && !v.startsWith('--') ? v : '';
}

async function lerColagem(): Promise<string> {
  console.log('');
  console.log('Cole a credencial de sessao que o painel mostra e aperte Enter.');
  console.log('Ela e usada uma vez, trocada por sessao propria e nao fica no repositorio.');
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

  const colagem = process.argv.includes('--colar') ? await lerColagem() : null;

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
    await new Promise<void>((r) => setTimeout(r, 400));
    process.exit(0);
  } catch (e) {
    console.log('');
    if (e instanceof FaltaConfig) {
      console.error('A ponte nao tem configuracao local ainda.');
      console.error(e.oQueFalta);
      process.exit(2);
    }
    if (e instanceof IdentidadeRecusada) {
      console.error('Nenhum degrau da escada entregou sessao do diretor.');
      console.error(e.message);
      console.error('');
      console.error('O que resolve, na ordem:');
      console.error('1. Ligar o provedor Google no Firebase Authentication do projeto a-fabrica-soulan.');
      console.error('   Console do Firebase, Authentication, Comecar, Sign-in method, Google, Ativar, Salvar.');
      console.error('2. Rodar este login mais uma vez.');
      console.error('3. Se ainda recusar, rodar com --colar e colar a credencial de sessao que o painel mostra.');
      process.exit(3);
    }
    console.error('Falha ao entrar.');
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

void principal();
