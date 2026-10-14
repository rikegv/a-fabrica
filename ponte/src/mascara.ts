// mascara.ts, a mascara de segredo antes de qualquer coisa subir para a base.
//
// POR QUE EXISTE
// --------------
// Regra 5 do Bloco 1 da OST 7, nas palavras do diretor: "Nada de segredo na base.
// Se um passo carregar algo com cara de senha, chave ou token, a ponte mascara
// antes de publicar."
//
// Quem mascara e a PONTE, de propósito, nao o gancho. O gancho roda a cada passo
// do diretor, em todos os projetos, e precisa ser rapido; a ponte roda em segundo
// plano e pode gastar tempo. Entao a ordem e: o gancho escreve na fila local, que
// mora em pasta trancada para o dono; a ponte le, mascara, e so entao publica.
//
// O QUE ELA NAO PROMETE, dito antes de alguem achar que promete
// ------------------------------------------------------------
// Mascara por padrao de texto NAO e garantia. Ela pega o que tem forma conhecida
// de credencial: chave do Google, token de atualizacao, token de portador, chave
// de modelo, chave da Amazon, chave da plataforma do GitHub, bloco de chave
// privada, e atribuicao com nome de campo suspeito. Segredo sem forma reconhecivel
// passa, e isso esta dito aqui para ninguem vender protecao que nao existe.
//
// A defesa que nao depende de reconhecer forma e outra, e ela e a que vale:
//   1. o gancho NAO guarda a resposta das ferramentas, que e onde mora quase todo
//      conteudo de arquivo lido, logo quase todo segredo de repositorio;
//   2. a base so e legivel pela conta do diretor, e a regra nega todo o resto;
//   3. a trilha nao se apaga, entao o que sobe fica, e e por isso que o que sobe
//      tem de ser pouco.

/** Texto que entra no lugar do segredo. Fica legivel de propósito, para o diretor saber que houve mascara. */
export const MARCA = '[credencial mascarada]';

interface Padrao {
  nome: string;
  regra: RegExp;
  /** Quando houver grupo de captura 1, o que e mascarado e so o grupo. */
  soOGrupo?: boolean;
}

/**
 * Os padroes, em ordem. Cada um tem nome para a evidencia poder dizer QUAL pegou.
 *
 * Observacao de quem escreveu: todos sao globais e sem sensibilidade a caixa onde
 * isso faz sentido, e nenhum usa repeticao aninhada, para nao existir caminho de
 * texto que faca a mascara travar.
 */
const PADROES: Padrao[] = [
  { nome: 'bloco de chave privada', regra: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { nome: 'token de identificacao em tres partes', regra: /\bey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { nome: 'chave de API do Google', regra: /\bAIza[0-9A-Za-z_-]{20,}/g },
  { nome: 'segredo de cliente do Google', regra: /\bGOCSPX-[A-Za-z0-9_-]{10,}/g },
  { nome: 'token de acesso do Google', regra: /\bya29\.[A-Za-z0-9_-]{20,}/g },
  { nome: 'token de atualizacao do Google', regra: /\b1\/\/[A-Za-z0-9_-]{20,}/g },
  { nome: 'token de atualizacao do Firebase', regra: /\bAMf-[A-Za-z0-9_-]{20,}/g },
  { nome: 'chave da plataforma do GitHub', regra: /\bgh[pousr]_[A-Za-z0-9]{16,}/g },
  { nome: 'chave de modelo da Anthropic', regra: /\bsk-ant-[A-Za-z0-9_-]{16,}/g },
  { nome: 'chave de modelo em formato sk', regra: /\bsk-[A-Za-z0-9]{24,}/g },
  { nome: 'chave de acesso da Amazon', regra: /\b(?:AKIA|ASIA)[0-9A-Z]{12,}/g },
  { nome: 'token do Slack', regra: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { nome: 'cabecalho de portador', regra: /\b(?:Bearer|Basic)\s+([A-Za-z0-9._~+/=-]{16,})/gi, soOGrupo: true },
  {
    // Atribuicao com nome de campo suspeito, nas formas que aparecem de verdade em
    // linha de comando e em arquivo de configuracao: campo=valor, campo: valor,
    // --campo valor.
    // O colchete esta FORA da classe de caracteres do valor de propósito: sem isso,
    // quando um padrao anterior ja trocou o segredo por "[credencial mascarada]",
    // esta regra casava com o pedaco "[credencial" e marcava de novo, deixando
    // "[credencial mascarada] mascarada]" na tela. O segredo saia nos dois casos,
    // mas o texto ficava torto para o diretor ler.
    nome: 'atribuicao com nome suspeito',
    regra:
      /\b(?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|client[_-]?secret|secret[_-]?key|private[_-]?key|password|passwd|senha|credential|token|secret)\b["']?\s*(?:[:=]|=>|\s--?)\s*["']?([^\s"',;)}[\]]{8,})/gi,
    soOGrupo: true,
  },
  {
    // Senha passada por bandeira curta em linha de comando.
    nome: 'bandeira de senha em linha de comando',
    regra: /(?:^|\s)(?:-p|--password|--token|--secret)[=\s]+("?[^\s"']{6,}"?)/g,
    soOGrupo: true,
  },
];

export interface ResultadoMascara {
  texto: string;
  /** Nomes dos padroes que pegaram algo, para a evidencia e para o relatorio. */
  pegou: string[];
}

/**
 * Passa a mascara num texto. Devolve o texto limpo e quais padroes pegaram.
 *
 * Nao recebe nada de null nem de outro tipo: quem chama resolve isso antes, para
 * esta funcao ficar pura e facil de provar.
 */
export function mascarar(texto: string): ResultadoMascara {
  let saida = texto;
  const pegou: string[] = [];
  for (const padrao of PADROES) {
    // Cada regra e reconstruida por chamada, para o indice interno de uma regra
    // global nao atravessar chamadas e deixar de casar na segunda vez.
    const regra = new RegExp(padrao.regra.source, padrao.regra.flags);
    let achou = false;
    saida = saida.replace(regra, (inteiro: string, grupo?: string) => {
      achou = true;
      if (padrao.soOGrupo === true && typeof grupo === 'string') {
        return inteiro.replace(grupo, MARCA);
      }
      return MARCA;
    });
    if (achou) pegou.push(padrao.nome);
  }
  return { texto: saida, pegou };
}

/** Mascara um campo que pode nao existir, mantendo nulo como nulo. */
export function mascararCampo(valor: string | null | undefined): { valor: string | null; pegou: string[] } {
  if (typeof valor !== 'string' || valor.length === 0) return { valor: valor === '' ? '' : null, pegou: [] };
  const r = mascarar(valor);
  return { valor: r.texto, pegou: r.pegou };
}
