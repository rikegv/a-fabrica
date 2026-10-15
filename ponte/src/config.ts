// config.ts, a configuracao local da ponte. Vive FORA do repositorio, em
// %USERPROFILE%\.a-fabrica-ponte, com permissao so do usuario atual.
//
// §A.6: nenhum segredo, chave ou credencial entra no codigo ou no repositorio.
// A configuracao do cliente (apiKey e afins) e gravada pelo instalador, que a
// obtem do proprio Firebase, e a ponte apenas le dali. Sem o arquivo, a ponte
// nao sobe e diz o que falta.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';

export const DIRETOR = 'henrique.vieira@soulan.com.br';
export const PROJETO_NUVEM = 'a-fabrica-soulan';
export const VERSAO_PONTE = '0.2.0';

/**
 * Esta ponte e de RODADA DE TESTE? Decisao do diretor: rotular e filtrar, §A.17.
 *
 * Ligado pela propria rodada de teste, com PONTE_ROTULO_TESTE=1. Nunca deduzido
 * do nome da maquina: nome e convencao, e convencao quebra calada. Tudo que esta
 * ponte criar na base nasce com o rotulo, e o painel esconde por padrao.
 */
export const ROTULO_DE_TESTE = process.env.PONTE_ROTULO_TESTE === '1';

/** Pasta local da ponte. Trocavel por variavel de ambiente para teste de rodada. */
export const PASTA_LOCAL = process.env.PONTE_PASTA_LOCAL
  ? String(process.env.PONTE_PASTA_LOCAL)
  : join(homedir(), '.a-fabrica-ponte');

export const CAMINHO_CONFIG = join(PASTA_LOCAL, 'config.json');
export const CAMINHO_SESSAO = join(PASTA_LOCAL, 'sessao.json');
/** Sessao do emulador em arquivo separado, para nunca escrever sobre a sessao da nuvem. */
export const CAMINHO_SESSAO_EMULADOR = join(PASTA_LOCAL, 'sessao-emulador.json');
export const PASTA_TRAVAS = join(PASTA_LOCAL, 'locks');

export interface ConfigLocal {
  maquinaId: string;
  nomeMaquina: string;
  projectId: string;
  apiKey: string;
  authDomain: string;
  appId: string;
  criadoEm: string;
}

export class FaltaConfig extends Error {
  constructor(public readonly oQueFalta: string) {
    super(oQueFalta);
    this.name = 'FaltaConfig';
  }
}

/** Le texto de arquivo tolerando a marca de ordem de bytes que o PowerShell grava. */
export function lerTexto(caminho: string): string {
  const bruto = readFileSync(caminho, 'utf8');
  return bruto.charCodeAt(0) === 0xfeff ? bruto.slice(1) : bruto;
}

function lerJson(caminho: string): Record<string, unknown> | null {
  if (!existsSync(caminho)) return null;
  try {
    const bruto = lerTexto(caminho);
    const j: unknown = JSON.parse(bruto);
    return typeof j === 'object' && j !== null ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function texto(o: Record<string, unknown>, campo: string): string | null {
  const v = o[campo];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Le a configuracao local. Falha fechada e falante: diz exatamente o que falta e
 * o que o diretor roda para resolver.
 */
export function carregarConfig(opcoes: { emulador?: boolean } = {}): ConfigLocal {
  const emulador = opcoes.emulador === true;
  const bruto = lerJson(CAMINHO_CONFIG);
  if (!bruto) {
    throw new FaltaConfig(
      `configuracao local ausente em ${CAMINHO_CONFIG}. ` +
        'Rode a instalacao da ponte: powershell -ExecutionPolicy Bypass -File ponte\\instalar.ps1'
    );
  }
  // A maquina pode ser apontada por ambiente, para rodada de teste nao escrever
  // na fila da maquina de verdade. Sem a variavel, vale o pareamento da instalacao.
  const maquinaId = process.env.PONTE_MAQUINA_ID
    ? String(process.env.PONTE_MAQUINA_ID)
    : texto(bruto, 'maquinaId');
  const projectId = texto(bruto, 'projectId') ?? texto(bruto, 'projeto');
  const apiKey = texto(bruto, 'apiKey') ?? (emulador ? 'chave-de-emulador' : null);
  const authDomain = texto(bruto, 'authDomain') ?? (emulador ? 'localhost' : null);
  const appId = texto(bruto, 'appId') ?? (emulador ? 'app-de-emulador' : null);

  const faltando: string[] = [];
  if (!maquinaId) faltando.push('maquinaId');
  if (!projectId) faltando.push('projectId');
  if (!apiKey) faltando.push('apiKey');
  if (!authDomain) faltando.push('authDomain');
  if (!appId) faltando.push('appId');
  if (faltando.length > 0 || !maquinaId || !projectId || !apiKey || !authDomain || !appId) {
    throw new FaltaConfig(
      `configuracao local incompleta em ${CAMINHO_CONFIG}, falta ${faltando.join(', ')}. ` +
        'Rode a instalacao da ponte de novo para regravar a configuracao do cliente.'
    );
  }

  return {
    maquinaId,
    nomeMaquina: texto(bruto, 'nomeMaquina') ?? 'maquina do diretor',
    projectId,
    apiKey,
    authDomain,
    appId,
    criadoEm: texto(bruto, 'criadoEm') ?? new Date().toISOString(),
  };
}

/** Grava a configuracao local. Usado pelo instalador, nunca pelo servico. */
export function gravarConfig(dados: Partial<ConfigLocal>): ConfigLocal {
  garantirPastaLocal();
  const atual = lerJson(CAMINHO_CONFIG) ?? {};
  const novo = { ...atual, ...dados, criadoEm: texto(atual, 'criadoEm') ?? new Date().toISOString() };
  writeFileSync(CAMINHO_CONFIG, JSON.stringify(novo, null, 2), { encoding: 'utf8', mode: 0o600 });
  return carregarConfig();
}

export function garantirPastaLocal(): void {
  mkdirSync(PASTA_LOCAL, { recursive: true });
  mkdirSync(PASTA_TRAVAS, { recursive: true });
}

/**
 * Fecha a pasta local para o usuario atual: quebra a heranca e deixa so ele.
 * Devolve a saida do icacls para servir de evidencia.
 */
export function protegerPastaLocal(): string {
  garantirPastaLocal();
  const usuario = `${userInfo().username}`;
  const linhas: string[] = [];
  const rodar = (args: string[]): void => {
    try {
      linhas.push(`icacls ${args.join(' ')}`);
      linhas.push(execFileSync('icacls', args, { encoding: 'utf8' }).trim());
    } catch (e) {
      linhas.push(`falhou: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  rodar([PASTA_LOCAL, '/inheritance:r']);
  rodar([PASTA_LOCAL, '/grant:r', `${usuario}:(OI)(CI)F`]);
  rodar([PASTA_LOCAL]);
  return linhas.join('\n');
}
