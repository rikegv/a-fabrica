// gancho.cjs, o gancho de ciclo de vida do Claude Code da maquina do diretor.
//
// O QUE ELE E
// -----------
// Um programa minusculo que o proprio Claude Code chama a cada acontecimento de
// uma sessao: quando nasce, a cada passo, no inicio e no fim de subagente, quando
// termina e quando falha. Ele vale para TODA sessao que o diretor abrir, de
// qualquer projeto, porque mora na configuracao geral dele.
//
// O QUE ELE NAO E, e isto e regra dura da OST 7
// ---------------------------------------------
// Ele NAO fala com a nuvem. Nao abre conexao, nao carrega SDK, nao sabe o que e
// Firestore. Ele escreve uma linha num arquivo de fila local e MORRE. Quem publica
// na base e a ponte, que ja roda como servico. Motivo, nas palavras da OST: gancho
// lento atrasa o trabalho do diretor em todos os projetos.
//
// POR QUE .cjs E NAO .mjs, e isto foi MEDIDO nesta maquina, nao chutado
// --------------------------------------------------------------------
// Um programa vazio em modulo de ECMAScript mediu p95 de 225 ms, e o mesmo programa
// vazio em modulo comum mediu p95 de 129 ms. O carregador de modulo de ECMAScript
// e assincrono e custa caro na subida. Como este gancho roda a cada passo do
// diretor, em todos os projetos dele, essa diferenca de quase 100 ms no pior caso
// e grande. Por isso: modulo comum, e NENHUM require alem de node:fs. Sem
// node:path e sem node:os de proposito, os caminhos sao montados com texto.
// A medida esta em ponte/ganchos/medir.mjs e em docs/ost7-ganchos.md.
//
// AS CINCO REGRAS QUE VALEM MAIS QUE A ENTREGA
// --------------------------------------------
//   R1 NUNCA atrapalhar. Qualquer erro, fila cheia, configuracao estranha, disco
//      ocupado: sai calado, codigo 0, e a sessao segue. Nao existe caminho neste
//      arquivo que devolva codigo diferente de 0, e nao existe caminho que escreva
//      em saida padrao. Em especial, gancho de PreToolUse que devolve 2 BLOQUEIA a
//      ferramenta no Claude Code; por isso este gancho nao e usado em PreToolUse e,
//      mesmo se fosse, nunca devolveria 2.
//   R2 Ser rapido. Nenhuma dependencia, nenhuma chamada de rede, nenhuma espera.
//   R3 Nao guardar o que nao precisa. Resposta de ferramenta pode trazer arquivo
//      inteiro; nada disso entra na fila. Entra o nome da ferramenta, o alvo e se
//      deu erro. Menos byte na fila e, de uma vez, mais velocidade e menos
//      exposicao.
//   R4 Interruptor de um passo. Sem o arquivo de configuracao, ou com ligado
//      falso, ele sai na hora sem escrever nada.
//   R5 Lista de projetos a ignorar, para o diretor deixar uma frente de fora.
//
// ORDEM DE PROPOSITO: a entrada de texto e lida ANTES de qualquer decisao.
// Achado da propria medicao: se o gancho morre sem ler a entrada, quem escreveu
// nela leva erro de escrita encerrada. Ler primeiro custa quase nada e tira do
// Claude Code qualquer chance de tropecar por causa deste gancho, inclusive no
// caminho de desligado.
//
// §A.9: este arquivo e NOVO e so ACRESCENTA. Ele nao le nem altera nada do Claude
//       Code nem do Antigravity. Quem o chama e uma entrada nova na configuracao,
//       com copia de seguranca do arquivo antes de tocar nele.

const COMECOU = process.hrtime.bigint();
const { appendFileSync, mkdirSync, readFileSync, readdirSync, statSync } = require('fs');

/** Teto de tamanho do alvo guardado, por passo. */
const TETO_ALVO = 2000;
/** Teto de tamanho do texto de pedido do diretor. */
const TETO_PROMPT = 2000;

function pedacoDeTexto(valor, teto) {
  if (typeof valor !== 'string' || valor.length === 0) return null;
  return valor.length > teto ? valor.slice(0, teto) + '[...cortado]' : valor;
}

function principal() {
  // 1. Ler a entrada ANTES de tudo. Veja a nota de ordem no cabecalho.
  const bruto = readFileSync(0, 'utf8');

  const pasta = process.env.PONTE_PASTA_LOCAL || process.env.USERPROFILE + '\\.a-fabrica-ponte';
  const config = JSON.parse(readFileSync(pasta + '\\ganchos.json', 'utf8'));
  // R4, interruptor. Arquivo ausente cai no catch de fora e tambem sai calado.
  if (config.ligado !== true) return;

  const payload = JSON.parse(bruto);
  const evento = payload.hook_event_name || process.argv[2] || 'desconhecido';
  const sessao = payload.session_id || 'sem-sessao';
  const projeto = payload.cwd || process.cwd();

  // R5, lista de projetos a ignorar. Comparacao por comeco de caminho, sem caso,
  // porque o diretor pensa em pasta de projeto, nao em caminho exato.
  const ignorados = Array.isArray(config.projetosIgnorados) ? config.projetosIgnorados : [];
  if (ignorados.length > 0) {
    const projetoMinusculo = String(projeto).toLowerCase().replace(/\//g, '\\');
    for (let i = 0; i < ignorados.length; i++) {
      const alvo = ignorados[i];
      if (typeof alvo === 'string' && alvo.length > 0 && projetoMinusculo.startsWith(alvo.toLowerCase().replace(/\//g, '\\'))) {
        return;
      }
    }
  }

  const fila = pasta + '\\fila-ganchos';
  const arquivo = fila + '\\' + String(sessao).replace(/[^A-Za-z0-9_-]/g, '_') + '.jsonl';

  // R1 e R3, tetos. Fila cheia nao e erro: e motivo para sair calado. A ponte tira
  // os arquivos consumidos de dentro desta pasta, entao em operacao normal ela
  // fica pequena. Se a ponte estiver fora do ar por muito tempo, o teto segura.
  const tetoArquivo = Number(config.tetoBytesPorSessao) > 0 ? Number(config.tetoBytesPorSessao) : 4194304;
  const tetoArquivos = Number(config.tetoArquivosNaFila) > 0 ? Number(config.tetoArquivosNaFila) : 2000;
  let existe = true;
  try {
    if (statSync(arquivo).size >= tetoArquivo) return;
  } catch {
    existe = false;
  }
  if (!existe) {
    // So no primeiro passo de cada sessao, que e uma vez por sessao, nao por passo.
    mkdirSync(fila, { recursive: true });
    if (readdirSync(fila).length >= tetoArquivos) return;
  }

  const entrada = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
  const resposta = payload.tool_response;

  const linha = {
    t: new Date().toISOString(),
    ev: evento,
    sid: sessao,
    projeto: projeto,
    origem: 'mao',
    ferramenta: typeof payload.tool_name === 'string' ? payload.tool_name : null,
    // O alvo e o que a ferramenta mexe: comando, arquivo, padrao de busca ou
    // endereco. Um so campo, porque o painel mostra uma linha por passo.
    alvo: pedacoDeTexto(
      entrada.command ||
        entrada.file_path ||
        entrada.path ||
        entrada.pattern ||
        entrada.url ||
        entrada.notebook_path ||
        null,
      TETO_ALVO
    ),
    descricao: pedacoDeTexto(entrada.description || null, 300),
    // R3: da resposta da ferramenta sai SO se deu erro. O conteudo nao entra.
    erro: resposta && typeof resposta === 'object' ? resposta.is_error === true || typeof resposta.error === 'string' : false,
    pedidoDoDiretor: pedacoDeTexto(payload.prompt || null, TETO_PROMPT),
    subagente: pedacoDeTexto(payload.subagent_type || payload.agent_type || null, 120),
    permissao: pedacoDeTexto(payload.permission_mode || null, 60),
    fonte: pedacoDeTexto(payload.source || null, 60),
    motivo: pedacoDeTexto(payload.reason || null, 200),
    aviso: pedacoDeTexto(payload.message || null, 500),
    // Quanto este gancho custou por dentro, em milissegundos. Fica na propria
    // linha para a medicao nao depender de instrumento de fora.
    custoMs: Number(process.hrtime.bigint() - COMECOU) / 1e6,
  };

  appendFileSync(arquivo, JSON.stringify(linha) + '\n', 'utf8');
}

// R1, a casca que garante o silencio. Nada sai daqui a nao ser codigo 0.
try {
  principal();
} catch {
  // De proposito vazio. Gancho que reclama e gancho que atrapalha.
}
process.exit(0);
