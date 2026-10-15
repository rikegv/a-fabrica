// limpar-conteudo-nao-liberado.mjs
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// Decisao do diretor na retomada da OST 7: METADADO de todo projeto, CONTEUDO so
// de projeto liberado. A regra passou a valer no gancho, para frente. Este arquivo
// cuida do PASSADO: tira da base o conteudo que subiu antes da regra existir, de
// projeto que nao esta liberado.
//
// O QUE ELE NAO FAZ, e isto importa mais que o que ele faz
// -------------------------------------------------------
// Ele NAO apaga documento, NAO apaga passo e NAO apaga fabrica. §A.17 continua
// valendo: a trilha fica inteira, com a mesma quantidade de passos, na mesma
// ordem, com a mesma hora. O que sai e o CAMPO de conteudo, trocado por um aviso
// de que foi removido e por que. Quem olhar a trilha depois ve que houve remocao,
// em vez de ver um buraco sem explicacao.
//
// Por que precisa da credencial de administrador: a regra do Firestore nega
// update e delete em `atividade` para o cliente, de proposito, porque trilha nao
// se reescreve. Ou seja, a propria protecao da trilha impede a ponte de limpar.
// Entao a limpeza passa pela API de administracao, com o token do gcloud do
// diretor, que e dono do projeto. §A.20: projeto explicito em toda chamada.
//
// §A.18: nada aqui monta caminho com curinga sobre variavel. Cada documento e
// tocado pelo nome completo, um a um, e o nome de cada um vai para o relato.
//
// Uso:
//   node ganchos/limpar-conteudo-nao-liberado.mjs            so OLHA e relata
//   node ganchos/limpar-conteudo-nao-liberado.mjs --aplicar  remove de verdade

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { abrirIdentidade } from '../dist/identidade.js';
import { PASTA_LOCAL } from '../dist/config.js';
import { join } from 'node:path';

const PROJETO = 'a-fabrica-soulan';
const APLICAR = process.argv.includes('--aplicar');

/** Os campos de CONTEUDO de um passo. Metadado nao entra nesta lista. */
const CAMPOS_DE_CONTEUDO = ['alvo', 'descricao'];
const AVISO_REMOVIDO =
  'conteudo removido da base por decisao do diretor na OST 7: este projeto nao esta liberado para conteudo';

function selo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost7-limpeza-de-conteudo`);
mkdirSync(RODADA, { recursive: true });
const linhas = [];
function reg(t) {
  console.log(t);
  linhas.push(t);
}
function guardar() {
  writeFileSync(join(RODADA, 'saida.txt'), linhas.join('\n'), 'utf8');
}

/** Deixa um caminho do Windows comparavel. Igual ao do gancho, de proposito. */
function caminhoComparavel(valor) {
  let t = String(valor ?? '').toLowerCase().replace(/\//g, '\\');
  while (t.length > 1 && t.endsWith('\\')) t = t.slice(0, -1);
  return t;
}

/**
 * Esta pasta esta liberada para conteudo?
 *
 * Mesma regra de FRONTEIRA do gancho: igual, ou seguido de separador. Projeto
 * desconhecido, isto e, fabrica sem campo de projeto, conta como NAO liberado,
 * porque nao dar para provar de onde veio e motivo para tirar, nao para manter.
 */
function liberado(projeto, lista) {
  if (typeof projeto !== 'string' || projeto.length === 0) return false;
  const p = caminhoComparavel(projeto);
  return lista.some((a) => p === a || p.startsWith(a + '\\'));
}

function token() {
  const comSpec = process.env.ComSpec ?? 'cmd.exe';
  const saida = execFileSync(comSpec, ['/c', 'gcloud auth print-access-token'], { encoding: 'utf8', windowsHide: true }).trim();
  if (saida.length < 20) throw new Error('o gcloud nao devolveu token. Entre com: gcloud auth login');
  return saida;
}

async function removerCampos(caminhoDoDocumento, campos) {
  const mascara = [...campos, 'conteudoRemovido', 'conteudoPublicado']
    .map((c) => `updateMask.fieldPaths=${encodeURIComponent(c)}`)
    .join('&');
  const url = `https://firestore.googleapis.com/v1/${caminhoDoDocumento}?${mascara}`;
  const campo = {};
  for (const c of campos) campo[c] = { nullValue: null };
  campo['conteudoRemovido'] = { stringValue: AVISO_REMOVIDO };
  campo['conteudoPublicado'] = { booleanValue: false };
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token()}`,
      'x-goog-user-project': PROJETO,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ fields: campo }),
  });
  if (!r.ok) throw new Error(`PATCH ${caminhoDoDocumento}\nHTTP ${r.status}\n${(await r.text()).slice(0, 400)}`);
}

async function principal() {
  reg(`limpeza de conteudo de projeto nao liberado, projeto ${PROJETO}, explicito, §A.20`);
  reg(`rodada em ${RODADA}`);
  reg(APLICAR ? 'modo APLICAR: vai remover de verdade' : 'modo OLHAR: nao remove nada, so relata');

  const cfg = JSON.parse(readFileSync(join(PASTA_LOCAL, 'ganchos.json'), 'utf8'));
  const lista = (Array.isArray(cfg.projetosLiberados) ? cfg.projetosLiberados : []).map(caminhoComparavel);
  reg(`projetos liberados para conteudo, lidos da configuracao: ${lista.length === 0 ? 'nenhum' : lista.join(' | ')}`);

  const id = await abrirIdentidade({ emulador: false, permitirNavegador: false, registrar: () => undefined });
  const db = getFirestore(id.app);
  reg(`entrei na base como ${id.usuario.email}, so para LER; quem remove e a API de administracao`);
  reg('');

  const fabricas = (await getDocs(collection(db, 'fabricas'))).docs;
  let removidos = 0;
  let intocados = 0;
  const relatorio = [];

  for (const f of fabricas) {
    const projeto = f.data().projeto ?? null;
    const ok = liberado(projeto, lista);
    const passos = (await getDocs(collection(db, 'fabricas', f.id, 'atividade'))).docs;
    if (ok) {
      reg(`LIBERADO, nada a fazer: ${f.id}, ${passos.length} passo(s), projeto ${JSON.stringify(projeto)}`);
      intocados += passos.length;
      continue;
    }

    const comConteudo = passos.filter((p) => CAMPOS_DE_CONTEUDO.some((c) => {
      const v = p.data()[c];
      return typeof v === 'string' && v.length > 0;
    }));
    reg(
      `NAO liberado: ${f.id}, projeto ${JSON.stringify(projeto)}, ${passos.length} passo(s), ${comConteudo.length} com conteudo`
    );

    for (const p of comConteudo) {
      const d = p.data();
      const quais = CAMPOS_DE_CONTEUDO.filter((c) => typeof d[c] === 'string' && d[c].length > 0);
      // O relato guarda o TAMANHO e os campos, nunca o texto. Copiar o texto para
      // a evidencia seria so mudar o segredo de lugar.
      const item = {
        fabrica: f.id,
        passo: p.id,
        seq: d.seq ?? null,
        tipo: d.tipo ?? null,
        campos: quais.map((c) => `${c} (${String(d[c]).length} caractere(s))`),
      };
      relatorio.push(item);
      reg(`  passo ${item.seq}, tipo ${item.tipo}: ${item.campos.join(', ')}`);
      if (APLICAR) {
        await removerCampos(
          `projects/${PROJETO}/databases/(default)/documents/fabricas/${f.id}/atividade/${p.id}`,
          quais
        );
        removidos++;
      }
    }
  }

  reg('');
  reg(`passos de projeto liberado, intocados: ${intocados}`);
  reg(`passos de projeto NAO liberado com conteudo: ${relatorio.length}`);
  if (APLICAR) {
    reg(`passos limpos de verdade: ${removidos}`);
    reg('nenhum documento foi apagado. A trilha continua inteira, com aviso no lugar do conteudo.');
  } else {
    reg('nada foi removido. Rode com --aplicar para remover.');
  }
  writeFileSync(join(RODADA, 'relatorio.json'), JSON.stringify(relatorio, null, 2), 'utf8');
  guardar();
  process.exit(0);
}

principal().catch((e) => {
  reg(`FALHOU: ${e instanceof Error ? e.message : String(e)}`);
  guardar();
  process.exit(1);
});
