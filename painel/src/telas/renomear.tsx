'use client';

/*
 * NOME DA FÁBRICA, editável a qualquer momento e em qualquer estado, OST 9.
 *
 * Mostra o nome como título, com "Renomear" ao lado. Ao renomear, o título vira
 * uma caixa com Salvar e Cancelar. Toda tentativa responde na tela, §A.22: o
 * aviso de sucesso sobe pela casca, e o erro aparece aqui mesmo, com o motivo.
 *
 * Fábrica aberta na mão nasce como "Fábrica externa" e se renomeia igual. A
 * caixa começa com o nome digitado; sem nome digitado, começa vazia, para o
 * diretor não ter de apagar "Fábrica externa" antes de escrever.
 */

import { useState } from 'react';
import { Button } from '@/componentes/ds';
import { renomearFabrica, TETO_NOME, type ContextoDeEscrita } from '@/dados/escritas';
import type { Fabrica } from '@/dados/tradutor';
import { ErroDeEscrita } from './pecas';
import { usarOrdem } from './usarOrdem';

export const AVISO_NOME_SALVO = 'Nome salvo. Ele já aparece no painel.';

export function TituloEditavel({
  fabrica,
  escrita,
  avisar,
  celular
}: {
  fabrica: Pick<Fabrica, 'id' | 'project' | 'nomeDado'>;
  escrita: ContextoDeEscrita;
  avisar: (mensagem: string) => void;
  celular?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState('');
  const ordem = usarOrdem(avisar);

  function abrir() {
    setNome(fabrica.nomeDado ?? '');
    ordem.limparErro();
    setEditando(true);
  }

  async function salvar() {
    const deuCerto = await ordem.enviar(
      () => renomearFabrica(escrita, { fabricaId: fabrica.id, nome }),
      AVISO_NOME_SALVO
    );
    if (deuCerto) setEditando(false);
  }

  if (!editando) {
    return (
      <span className="gf-nome">
        <span className={celular ? 'title-sm gf-nome-texto' : 'title-lg gf-nome-texto'} title={fabrica.project}>
          {fabrica.project}
        </span>
        <button type="button" className="gf-linkbtn caption" onClick={abrir}>
          Renomear
        </button>
      </span>
    );
  }

  const vazio = !nome.trim();
  return (
    <span className="gf-nome-edita">
      <span className="gf-nome-linha">
        <input
          className="gf-input body"
          value={nome}
          maxLength={TETO_NOME}
          autoFocus
          aria-label="Nome da fábrica"
          placeholder="Nome da fábrica"
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !vazio) void salvar();
            if (e.key === 'Escape') setEditando(false);
          }}
        />
        <Button variant="primary" disabled={vazio || ordem.ocupado} onClick={() => void salvar()}>
          {ordem.ocupado ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button variant="ghost" disabled={ordem.ocupado} onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </span>
      {vazio ? <span className="caption gf-faint">Escreva o nome para poder salvar.</span> : null}
      {ordem.erro ? <ErroDeEscrita mensagem={ordem.erro} aoFechar={ordem.limparErro} /> : null}
    </span>
  );
}
