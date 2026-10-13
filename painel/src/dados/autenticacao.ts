'use client';

/*
 * Entrada do painel, §A.6: conta unica do diretor, pelo provedor Google.
 *
 * O Google e quem entrega email_verified verdadeiro, que a regra do Firestore
 * exige. Aviso da seguranca da OST 6, para nao vender protecao que nao existe:
 * nem esta camada nem a regra do Firestore conferem segundo fator, e o token do
 * provedor Google nao carrega essa informacao. Segunda etapa, se existe, e da
 * conta Google do diretor. Qualquer outro e-mail e
 * desconectado na hora, com mensagem clara. Nao existe cadastro, nao existe
 * recuperacao de senha, nao existe segunda conta.
 *
 * O painel nao abre sem login: enquanto a situacao nao for "dentro", nenhum
 * ouvinte da base e criado.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User
} from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { EMAIL_DO_DIRETOR, ligarFirebase } from './firebase';

export type SituacaoDaEntrada =
  | 'carregando'
  | 'fora'
  | 'entrando'
  | 'dentro'
  | 'recusada'
  | 'sem configuracao'
  | 'sem authentication';

export interface Entrada {
  situacao: SituacaoDaEntrada;
  usuario: User | null;
  base: Firestore | null;
  mensagem: string | null;
  origemDaConfiguracao: string | null;
  entrar: () => void;
  sair: () => void;
}

const MENSAGEM_SEM_AUTHENTICATION =
  'O Authentication do projeto ainda não está ligado. Ligue o provedor Google no console do Firebase e entre de novo.';

function mensagemDoErro(erro: unknown): { situacao: SituacaoDaEntrada; mensagem: string } {
  const codigo = (erro as { code?: string } | null)?.code ?? '';
  if (codigo === 'auth/configuration-not-found' || codigo === 'auth/operation-not-allowed') {
    return { situacao: 'sem authentication', mensagem: MENSAGEM_SEM_AUTHENTICATION };
  }
  if (codigo === 'auth/popup-closed-by-user' || codigo === 'auth/cancelled-popup-request') {
    return { situacao: 'fora', mensagem: 'A entrada foi cancelada. Tente de novo quando quiser.' };
  }
  if (codigo === 'auth/network-request-failed') {
    return { situacao: 'fora', mensagem: 'Sem rede para falar com o Google. Confira a conexão e tente de novo.' };
  }
  const detalhe = (erro as { message?: string } | null)?.message;
  return { situacao: 'fora', mensagem: detalhe ? `Não deu para entrar: ${detalhe}` : 'Não deu para entrar.' };
}

export function usarEntrada(): Entrada {
  const [situacao, setSituacao] = useState<SituacaoDaEntrada>('carregando');
  const [usuario, setUsuario] = useState<User | null>(null);
  const [base, setBase] = useState<Firestore | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [origemDaConfiguracao, setOrigem] = useState<string | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    let cancelarOuvinte: (() => void) | null = null;

    (async () => {
      try {
        const { auth, base: firestore, origem } = await ligarFirebase();
        if (!montado.current) return;
        setOrigem(origem);
        cancelarOuvinte = onAuthStateChanged(
          auth,
          async (quem) => {
            if (!montado.current) return;
            if (!quem) {
              setUsuario(null);
              setBase(null);
              setSituacao((anterior) => (anterior === 'recusada' ? 'recusada' : 'fora'));
              return;
            }
            const email = (quem.email ?? '').toLowerCase();
            if (email !== EMAIL_DO_DIRETOR || !quem.emailVerified) {
              /* Dois motivos diferentes, duas frases diferentes: dizer "não é a
                 conta do diretor" para a conta do diretor com e-mail sem
                 verificação mandaria o diretor procurar o problema no lugar
                 errado. */
              const eOutraConta = email !== EMAIL_DO_DIRETOR;
              await signOut(auth);
              if (!montado.current) return;
              setUsuario(null);
              setBase(null);
              setSituacao('recusada');
              setMensagem(
                eOutraConta
                  ? `Esta conta não é a do diretor, então a sessão foi encerrada. O painel só abre para ${EMAIL_DO_DIRETOR}, com e-mail verificado pelo Google.`
                  : 'Esta é a conta do diretor, mas o Google não diz que o e-mail está verificado, então a sessão foi encerrada. A regra da base exige e-mail verificado. Verifique o e-mail na conta do Google e entre de novo.'
              );
              return;
            }
            setUsuario(quem);
            setBase(firestore);
            setMensagem(null);
            setSituacao('dentro');
          },
          (erro) => {
            if (!montado.current) return;
            const r = mensagemDoErro(erro);
            setSituacao(r.situacao);
            setMensagem(r.mensagem);
          }
        );
      } catch (erro) {
        if (!montado.current) return;
        setSituacao('sem configuracao');
        setMensagem(erro instanceof Error ? erro.message : 'Sem configuração do Firebase.');
      }
    })();

    return () => {
      montado.current = false;
      if (cancelarOuvinte) cancelarOuvinte();
    };
  }, []);

  const entrar = useCallback(() => {
    setMensagem(null);
    setSituacao('entrando');
    (async () => {
      try {
        const { auth } = await ligarFirebase();
        const provedor = new GoogleAuthProvider();
        provedor.setCustomParameters({ prompt: 'select_account', login_hint: EMAIL_DO_DIRETOR });
        try {
          await signInWithPopup(auth, provedor);
        } catch (erro) {
          const codigo = (erro as { code?: string }).code ?? '';
          if (codigo === 'auth/popup-blocked' || codigo === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, provedor);
            return;
          }
          throw erro;
        }
      } catch (erro) {
        if (!montado.current) return;
        const r = mensagemDoErro(erro);
        setSituacao(r.situacao);
        setMensagem(r.mensagem);
      }
    })();
  }, []);

  const sair = useCallback(() => {
    (async () => {
      try {
        const { auth } = await ligarFirebase();
        await signOut(auth);
        if (!montado.current) return;
        setMensagem(null);
        setSituacao('fora');
      } catch {
        /* Sem rede, a sessao cai sozinha na proxima abertura. */
      }
    })();
  }, []);

  return { situacao, usuario, base, mensagem, origemDaConfiguracao, entrar, sair };
}
