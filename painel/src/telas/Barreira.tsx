'use client';

/*
 * Barreira de entrada, §A.6. O painel nao abre sem login: enquanto esta tela
 * esta no ar, nenhum ouvinte da base existe.
 *
 * Conta unica do diretor, pelo provedor Google, que e quem carrega o segundo
 * fator e entrega o e-mail verificado que a regra do Firestore exige. Sem
 * cadastro, sem recuperacao de senha, sem segunda conta.
 */

import { Button, StateIcon } from '@/componentes/ds';
import { EMAIL_DO_DIRETOR } from '@/dados/firebase';
import type { Entrada } from '@/dados/autenticacao';
import { MARCA } from './textos';

export function Barreira({ entrada }: { entrada: Entrada }) {
  const { situacao, mensagem, entrar, origemDaConfiguracao } = entrada;
  const carregando = situacao === 'carregando';
  const entrando = situacao === 'entrando';
  const semConfiguracao = situacao === 'sem configuracao';
  const semAuthentication = situacao === 'sem authentication';
  const podeEntrar = !carregando && !entrando && !semConfiguracao;

  const rotulo = situacao === 'recusada' ? 'Entrar com a conta do diretor' : 'Entrar com o Google';

  return (
    <div className="flex h-full items-center justify-center p-4">
      <main className="gf-glass flex w-full max-w-reading flex-col gap-4 rounded-xl p-6" style={{ maxWidth: 420 }}>
        <div className="flex items-center gap-3">
          <span className="gf-side-mark" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </span>
          <div>
            <h1 className="title-lg">{MARCA}</h1>
            <p className="caption gf-muted">Acompanhar e comandar as fábricas de agentes.</p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="label gf-muted">Entrada única</div>
          <p className="body gf-muted">
            Só a conta do diretor entra, pelo Google, que carrega o segundo fator. O painel é de uso individual.
          </p>
          <p className="mono gf-faint">{EMAIL_DO_DIRETOR}</p>
        </div>

        {mensagem ? (
          <div
            className="gf-card flex items-start gap-2 p-3"
            role={situacao === 'recusada' || semConfiguracao || semAuthentication ? 'alert' : 'status'}
            style={{ background: 'var(--bg-100)' }}
          >
            <span style={{ color: 'var(--state-offline)', display: 'flex', paddingTop: 2 }}>
              <StateIcon state="offline" size={12} />
            </span>
            <p className="body">{mensagem}</p>
          </div>
        ) : null}

        <Button variant="primary" block size="touch" onClick={podeEntrar ? entrar : undefined} disabled={!podeEntrar}>
          {rotulo}
        </Button>

        <p className="caption gf-faint">
          {carregando
            ? 'Lendo a configuração da nuvem.'
            : entrando
              ? 'A janela do Google está abrindo.'
              : semConfiguracao
                ? 'Sem configuração, o painel não tem como falar com a nuvem.'
                : origemDaConfiguracao
                  ? `Configuração lida: ${origemDaConfiguracao}.`
                  : ''}
        </p>
      </main>
    </div>
  );
}
