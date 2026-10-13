// persistenciaArquivo.ts, persistencia propria para o SDK cliente do Firebase.
//
// Por que existe: o SDK do Firebase para navegador, rodando em Node, nao persiste
// nada por conta propria, e so memoria. Sem persistencia, o diretor teria de logar
// de novo a cada reinicio da ponte. Com esta persistencia, a sessao vive em
// %USERPROFILE%\.a-fabrica-ponte\sessao.json e o proprio SDK renova o token de
// atualizacao sozinho, sem pedir nada ao diretor.
//
// §A.6: o arquivo fica fora do repositorio, com permissao so do usuario atual
// (a instalacao fecha a pasta com icacls). Nenhuma credencial em codigo.
// §A.6: isto e so leitura e escrita de arquivo local. Nenhuma porta e aberta.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Persistence } from 'firebase/auth';

type ValorPersistido = string | Record<string, unknown>;

interface ArquivoSessao {
  versao: 1;
  atualizadoEm: string;
  entradas: Record<string, ValorPersistido>;
}

/**
 * Interface interna de persistencia do SDK (PersistenceInternal, nao exportada
 * pelo pacote publico). Declarada aqui com os mesmos nomes e assinaturas, para
 * a conversao final ser uma so, explicita e comentada.
 */
interface PersistenciaInterna {
  readonly type: 'LOCAL';
  _isAvailable(): Promise<boolean>;
  _set(chave: string, valor: ValorPersistido): Promise<void>;
  _get<T extends ValorPersistido>(chave: string): Promise<T | null>;
  _remove(chave: string): Promise<void>;
  _addListener(chave: string, ouvinte: (valor: ValorPersistido | null) => void): void;
  _removeListener(chave: string, ouvinte: (valor: ValorPersistido | null) => void): void;
  _shouldAllowMigration: boolean;
}

export interface SessaoEmArquivo {
  /**
   * O que se entrega ao SDK em initializeAuth. O SDK exige uma CLASSE, nao uma
   * instancia: ele faz new por dentro e guarda a instancia unica. Por isso aqui
   * vai a classe, com o caminho do arquivo fechado dentro dela.
   */
  persistencia: Persistence;
  /** Caminho do arquivo de sessao, para registro e evidencia. */
  caminho: string;
  /** Chave que o SDK usa para o usuario desta configuracao. */
  chaveDoUsuario(apiKey: string, nomeApp: string): string;
  /** Le uma entrada bruta, sem o SDK. Usado para conferir se ja existe sessao. */
  ler(chave: string): ValorPersistido | null;
  /** Escreve uma entrada bruta, sem o SDK. Usado no degrau de colagem. */
  escrever(chave: string, valor: ValorPersistido): void;
  /** Lista as chaves guardadas, para registro. */
  chaves(): string[];
}

function lerArquivo(caminho: string): ArquivoSessao {
  if (!existsSync(caminho)) return { versao: 1, atualizadoEm: new Date().toISOString(), entradas: {} };
  try {
    const bruto: unknown = JSON.parse(readFileSync(caminho, 'utf8'));
    if (typeof bruto === 'object' && bruto !== null) {
      const entradas = (bruto as Record<string, unknown>)['entradas'];
      if (typeof entradas === 'object' && entradas !== null) {
        return {
          versao: 1,
          atualizadoEm: new Date().toISOString(),
          entradas: entradas as Record<string, ValorPersistido>,
        };
      }
    }
  } catch {
    // arquivo ilegivel: trata como sessao ausente, o login refaz. Nada e apagado.
  }
  return { versao: 1, atualizadoEm: new Date().toISOString(), entradas: {} };
}

function gravarArquivo(caminho: string, dados: ArquivoSessao): void {
  mkdirSync(dirname(caminho), { recursive: true });
  const temporario = `${caminho}.novo`;
  writeFileSync(temporario, JSON.stringify({ ...dados, atualizadoEm: new Date().toISOString() }, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  renameSync(temporario, caminho);
}

export function criarPersistenciaEmArquivo(caminho: string): SessaoEmArquivo {
  const ouvintes = new Map<string, Set<(valor: ValorPersistido | null) => void>>();

  class PersistenciaEmArquivo implements PersistenciaInterna {
    readonly type = 'LOCAL' as const;
    readonly _shouldAllowMigration = true;

    async _isAvailable(): Promise<boolean> {
      return true;
    }

    async _set(chave: string, valor: ValorPersistido): Promise<void> {
      const dados = lerArquivo(caminho);
      dados.entradas[chave] = valor;
      gravarArquivo(caminho, dados);
      for (const o of ouvintes.get(chave) ?? []) o(valor);
    }

    async _get<T extends ValorPersistido>(chave: string): Promise<T | null> {
      const dados = lerArquivo(caminho);
      const v = dados.entradas[chave];
      return v === undefined ? null : (v as T);
    }

    async _remove(chave: string): Promise<void> {
      // Remocao de entrada de sessao do proprio SDK (saida de conta ou troca de
      // token). Nao e remocao de arquivo nem de evidencia, §A.17.
      const dados = lerArquivo(caminho);
      delete dados.entradas[chave];
      gravarArquivo(caminho, dados);
      for (const o of ouvintes.get(chave) ?? []) o(null);
    }

    _addListener(chave: string, ouvinte: (valor: ValorPersistido | null) => void): void {
      const atual = ouvintes.get(chave) ?? new Set<(valor: ValorPersistido | null) => void>();
      atual.add(ouvinte);
      ouvintes.set(chave, atual);
    }

    _removeListener(chave: string, ouvinte: (valor: ValorPersistido | null) => void): void {
      ouvintes.get(chave)?.delete(ouvinte);
    }
  }

  return {
    // Conversao unica e explicita: o tipo publico Persistence so expoe `type`;
    // o SDK recebe a classe e instancia por dentro, e consome a interface interna
    // acima, implementada por inteiro.
    persistencia: PersistenciaEmArquivo as unknown as Persistence,
    caminho,
    chaveDoUsuario: (apiKey: string, nomeApp: string) => `firebase:authUser:${apiKey}:${nomeApp}`,
    ler: (chave: string) => lerArquivo(caminho).entradas[chave] ?? null,
    escrever: (chave: string, valor: ValorPersistido) => {
      const dados = lerArquivo(caminho);
      dados.entradas[chave] = valor;
      gravarArquivo(caminho, dados);
    },
    chaves: () => Object.keys(lerArquivo(caminho).entradas),
  };
}
