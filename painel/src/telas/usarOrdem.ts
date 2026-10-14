'use client';

/*
 * Estado de UMA ordem saindo do painel, para as telas nao repetirem a mesma
 * mecanica em cinco lugares:
 *
 *  - ocupado, enquanto a escrita nao voltou. O controle fica desabilitado e a
 *    mesma ordem nao entra duas vezes na fila.
 *  - erro, quando a base recusou ou a rede caiu. Fica na tela, em portugues, e
 *    NAO desaparece sozinho: ordem que nao foi registrada nao pode sumir da
 *    vista do diretor.
 *  - aviso de que deu certo. Esse NAO fica aqui: ele sobe para a casca da tela,
 *    pelo avisar que vem de fora, porque so pode existir UM aviso na tela de
 *    cada vez. Medido na rodada da Onda 2: com cada controle guardando o seu, a
 *    tela mostrava dois avisos no mesmo ponto e o antigo cobria o novo.
 *
 * O painel nunca diz que a fabrica fez; diz que a ordem entrou na fila da ponte.
 * Quem executa e a ponte, §A.3.
 */

import { useCallback, useRef, useState } from 'react';

export interface Resposta {
  ok: boolean;
  erro?: string;
}

export interface Ordem {
  ocupado: boolean;
  erro: string | null;
  limparErro: () => void;
  /* Devolve true quando a ordem foi registrada, para o controle poder limpar o
     que o diretor escreveu somente nesse caso. */
  enviar: (tarefa: () => Promise<Resposta>, avisoDeSucesso: string) => Promise<boolean>;
}

export function usarOrdem(avisar: (mensagem: string) => void): Ordem {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emCurso = useRef(false);
  const aviso = useRef(avisar);
  aviso.current = avisar;

  const enviar = useCallback(async (tarefa: () => Promise<Resposta>, avisoDeSucesso: string) => {
    if (emCurso.current) return false;
    emCurso.current = true;
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await tarefa();
      if (resultado.ok) {
        aviso.current(avisoDeSucesso);
        return true;
      }
      setErro(resultado.erro ?? 'A ordem não foi registrada, e a base não disse o motivo.');
      return false;
    } catch (falha) {
      /* Nenhuma funcao da camada de escrita lanca, mas se alguma lancar um dia,
         a tela mostra erro em vez de ficar travada em "Enviando". */
      setErro(
        falha instanceof Error
          ? `Não deu para registrar a ordem: ${falha.message}`
          : 'Não deu para registrar a ordem.'
      );
      return false;
    } finally {
      emCurso.current = false;
      setOcupado(false);
    }
  }, []);

  return {
    ocupado,
    erro,
    limparErro: useCallback(() => setErro(null), []),
    enviar
  };
}
