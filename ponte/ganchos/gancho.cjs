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
//   R6 METADADO DE TODOS, CONTEUDO SO DE PROJETO LIBERADO. Decisao do diretor na
//      retomada da OST 7, e ela INVERTEU a logica anterior. Veja abaixo.
//
// R6, A LOGICA INVERTIDA, e por que ela existe
// --------------------------------------------
// Antes: o gancho guardava o texto de tudo, em todos os projetos, e o diretor
// podia tirar um projeto da lista de ignorados. Isso punha o texto dos comandos
// dele sobre CentraFin, CENTRA DASH e SoulTrell, que lidam com dado de cliente,
// na base da Fabrica, contra o §A.4. A lista de ignorados estava vazia, entao a
// protecao existia no papel e nao no arquivo.
//
// Agora, e so assim:
//   METADADO de todo projeto, sempre. Qual projeto, qual evento, nome da
//   ferramenta, se deu erro, subagente, modo de permissao, tempo. E o que o
//   painel precisa para mostrar as fabricas.
//   CONTEUDO somente de projeto LIBERADO, um a um, em projetosLiberados. Texto do
//   comando do diretor, alvo da ferramenta, descricao, aviso e motivo.
//
// Projeto novo nasce SEM liberacao, e isso vale inclusive quando a configuracao
// nao tem a lista, esta corrompida ou vazia: nesses casos nada de conteudo sai.
// Falha fechada. A lista nunca e deduzida, nunca cresce sozinha.
//
// A comparacao e por FRONTEIRA DE CAMINHO, nao por comeco de texto. Isto nao e
// detalhe: liberar "C:\Users\Henrique\a-fabrica" por comeco de texto liberaria
// tambem "C:\Users\Henrique\a-fabrica-lab" e qualquer pasta futura que comece
// igual, inclusive uma de cliente. So passa o caminho igual, ou seguido de
// separador.
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

/** Deixa um caminho do Windows comparavel: minusculo, barra invertida, sem barra no fim. */
function caminhoComparavel(valor) {
  let t = String(valor).toLowerCase().replace(/\//g, '\\');
  while (t.length > 1 && t.charAt(t.length - 1) === '\\') t = t.slice(0, t.length - 1);
  return t;
}

/**
 * O projeto esta dentro de um dos caminhos da lista, respeitando fronteira?
 *
 * Fronteira quer dizer: igual, ou seguido de separador. "a-fabrica" NAO alcanca
 * "a-fabrica-lab". Veja a nota de R6 no cabecalho; e o que impede uma liberacao
 * de pegar pasta vizinha por acidente de nome.
 */
function dentroDe(projeto, lista) {
  if (!Array.isArray(lista) || lista.length === 0) return false;
  const p = caminhoComparavel(projeto);
  for (let i = 0; i < lista.length; i++) {
    const alvo = lista[i];
    if (typeof alvo !== 'string' || alvo.length === 0) continue;
    const a = caminhoComparavel(alvo);
    if (p === a || p.startsWith(a + '\\')) return true;
  }
  return false;
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

  // R5, lista de projetos a ignorar. Projeto ignorado nao gera NEM metadado: ele
  // sai do painel por inteiro, e e o que o diretor usa para deixar uma frente de
  // fora de tudo.
  if (dentroDe(projeto, config.projetosIgnorados)) return;

  // R6, a liberacao de CONTEUDO. Ausente, vazia ou corrompida: nao libera nada.
  const liberado = dentroDe(projeto, config.projetosLiberados);

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

  const motivoBruto = typeof payload.reason === 'string' ? payload.reason : null;

  // METADADO, de todo projeto, sempre. Nada aqui carrega texto escrito pelo
  // diretor, pelo agente ou por arquivo de cliente.
  const linha = {
    t: new Date().toISOString(),
    ev: evento,
    sid: sessao,
    projeto: projeto,
    origem: 'mao',
    ferramenta: typeof payload.tool_name === 'string' ? payload.tool_name : null,
    // R3: da resposta da ferramenta sai SO se deu erro. O conteudo nao entra.
    erro: resposta && typeof resposta === 'object' ? resposta.is_error === true || typeof resposta.error === 'string' : false,
    subagente: pedacoDeTexto(payload.subagent_type || payload.agent_type || null, 120),
    permissao: pedacoDeTexto(payload.permission_mode || null, 60),
    fonte: pedacoDeTexto(payload.source || null, 60),
    // A CLASSIFICACAO do fim, sem o texto do fim. A ponte precisa saber se a
    // sessao falhou para nao mentir o estado na tela, e nao precisa do motivo
    // escrito para isso. Projeto nao liberado continua tendo estado honesto.
    falhouNoFim: motivoBruto !== null && /error|fail|crash|falh/i.test(motivoBruto),
    // Este projeto esta liberado para CONTEUDO? A ponte le isto e nao deduz.
    conteudo: liberado,
    // Quanto este gancho custou por dentro, em milissegundos. Fica na propria
    // linha para a medicao nao depender de instrumento de fora.
    custoMs: Number(process.hrtime.bigint() - COMECOU) / 1e6,
  };

  // CONTEUDO, somente de projeto liberado. Fora da liberacao estes campos nao
  // sao cortados nem mascarados: eles NAO EXISTEM na linha, e por isso nao tem
  // como vazar depois, nem pela fila em disco, nem pela base, nem por relatorio.
  if (liberado) {
    // O alvo e o que a ferramenta mexe: comando, arquivo, padrao de busca ou
    // endereco. Um so campo, porque o painel mostra uma linha por passo.
    linha.alvo = pedacoDeTexto(
      entrada.command ||
        entrada.file_path ||
        entrada.path ||
        entrada.pattern ||
        entrada.url ||
        entrada.notebook_path ||
        null,
      TETO_ALVO
    );
    linha.descricao = pedacoDeTexto(entrada.description || null, 300);
    linha.pedidoDoDiretor = pedacoDeTexto(payload.prompt || null, TETO_PROMPT);
    linha.motivo = pedacoDeTexto(motivoBruto, 200);
    linha.aviso = pedacoDeTexto(payload.message || null, 500);
  }

  appendFileSync(arquivo, JSON.stringify(linha) + '\n', 'utf8');
}

// R1, a casca que garante o silencio. Nada sai daqui a nao ser codigo 0.
try {
  principal();
} catch {
  // De proposito vazio. Gancho que reclama e gancho que atrapalha.
}
process.exit(0);
