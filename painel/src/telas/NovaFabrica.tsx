'use client';

/*
 * Tela 4, nova fabrica. F4 do catalogo, §A.5.
 *
 * O que ela pede, na ordem em que o diretor decide: projeto, agente, modelo e o
 * comando inicial. Nada mais, §A.12.
 *
 * CADASTRO DE PROJETOS E F7, CONFIGURACOES, E ESTA FORA DESTA ONDA. Enquanto
 * ele nao existir, esta tela faz o honesto: oferece os caminhos de projeto que
 * JA apareceram na base, como escolha rapida, e aceita um caminho escrito a
 * mao. Nenhum projeto e inventado, nenhuma lista e fingida.
 *
 * AGENTE: a tela nao inventa lista de agente que a maquina nao tem. Ela oferece
 * escrever o nome, com o padrao que a ponte usa hoje.
 *
 * MODELO: ou herda o padrao da ponte, que e o caminho normal, ou o diretor
 * escreve o identificador do modelo na mao. Inventar uma lista de modelos aqui
 * seria prometer o que esta fabrica nao sabe se a maquina aceita.
 *
 * O desenho muda entre computador e celular; as regras sao as mesmas.
 */

import { useMemo, useState } from 'react';
import { Button, Segmented, cx } from '@/componentes/ds';
import { abrirFabrica, impedimentoDaEscrita, type ContextoDeEscrita } from '@/dados/escritas';
import type { EstadoDoPainel } from '@/dados/painel';
import { caminhosDeProjeto } from '@/dados/tradutor';
import { Campo, ErroDeEscrita, Panel } from './pecas';
import { AVISOS, motivoDeAbrirFabrica } from './textos';
import { usarOrdem } from './usarOrdem';

const AGENTE_PADRAO = 'claude code';

/* Placeholder do modelo: o identificador que a ponte usa como padrao hoje. Nao e
   lista de opcoes, e exemplo da forma do identificador. */
const EXEMPLO_DE_MODELO = 'Ex.: claude-haiku-4-5-20251001';

export interface NovaFabricaProps {
  escrita: ContextoDeEscrita;
  estado: EstadoDoPainel;
  celular?: boolean;
  /* Chamado quando a ordem de abertura foi registrada. */
  aoAbrir: (fabricaId: string, aviso: string) => void;
  aoCancelar: () => void;
}

function usarFormulario({ escrita, estado, aoAbrir }: Omit<NovaFabricaProps, 'aoCancelar' | 'celular'>) {
  const sugestoes = useMemo(() => caminhosDeProjeto(estado.fabricas), [estado.fabricas]);
  const [caminho, setCaminho] = useState('');
  const [agente, setAgente] = useState(AGENTE_PADRAO);
  const [modoDoModelo, setModoDoModelo] = useState<'ponte' | 'mao'>('ponte');
  const [modelo, setModelo] = useState('');
  const [comando, setComando] = useState('');
  /* O aviso de sucesso quem mostra e a casca, depois de levar o diretor de volta
     para a Visao geral: por isso aqui o avisar nao faz nada. */
  const ordem = usarOrdem(() => undefined);

  const impedimento = impedimentoDaEscrita(escrita);
  const motivo = motivoDeAbrirFabrica(impedimento);
  const faltaCaminho = !caminho.trim();
  const faltaComando = !comando.trim();
  const faltaModelo = modoDoModelo === 'mao' && !modelo.trim();
  const travado = Boolean(motivo) || ordem.ocupado || faltaCaminho || faltaComando || faltaModelo;

  async function abrir() {
    if (travado) return;
    let nascida: string | null = null;
    const deuCerto = await ordem.enviar(async () => {
      const r = await abrirFabrica(escrita, {
        cwd: caminho,
        agente,
        modelo: modoDoModelo === 'mao' ? modelo : undefined,
        comandoInicial: comando
      });
      if (r.ok) nascida = r.fabricaId;
      return r;
    }, AVISOS.fabricaAberta);
    if (deuCerto && nascida) {
      setComando('');
      aoAbrir(nascida, AVISOS.fabricaAberta);
    }
  }

  return {
    sugestoes,
    caminho,
    setCaminho,
    agente,
    setAgente,
    modoDoModelo,
    setModoDoModelo,
    modelo,
    setModelo,
    comando,
    setComando,
    ordem,
    motivo,
    faltaCaminho,
    faltaComando,
    travado,
    abrir
  };
}

/* ---------- computador ---------- */

export function NovaFabrica(props: NovaFabricaProps) {
  const f = usarFormulario(props);

  return (
    <div className="gf-body" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
      <Panel>
        <Campo
          rotulo="1. Projeto"
          ajuda={
            f.sugestoes.length
              ? 'Escolha uma pasta que já apareceu na base ou escreva o caminho completo. O cadastro de projetos entra em Configurações, numa onda seguinte.'
              : 'Nenhuma pasta apareceu na base ainda. Escreva o caminho completo da pasta do projeto na sua máquina.'
          }
        >
          {f.sugestoes.length ? (
            <div className="grid grid-cols-3 gap-2">
              {f.sugestoes.slice(0, 6).map((p) => (
                <button
                  key={p.caminho}
                  type="button"
                  className={cx('gf-pick', f.caminho === p.caminho && 'gf-pick-on')}
                  onClick={() => f.setCaminho(p.caminho)}
                >
                  <span className="title-sm truncate">{p.nome}</span>
                  <span className="mono gf-faint truncate">{p.caminho}</span>
                </button>
              ))}
            </div>
          ) : null}
          <input
            className="gf-input body"
            value={f.caminho}
            spellCheck={false}
            aria-label="Caminho da pasta do projeto"
            placeholder="Caminho da pasta do projeto, por exemplo C:\Users\Henrique\a-fabrica"
            onChange={(e) => f.setCaminho(e.target.value)}
          />
        </Campo>

        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
          <Campo rotulo="2. Agente" ajuda="A ponte executa pelo Claude Code. Mude o nome só se souber o que vai abrir.">
            <input
              className="gf-input body"
              value={f.agente}
              spellCheck={false}
              aria-label="Nome do agente"
              placeholder={AGENTE_PADRAO}
              onChange={(e) => f.setAgente(e.target.value)}
            />
          </Campo>
          <Campo
            rotulo="Modelo"
            ajuda={
              f.modoDoModelo === 'ponte'
                ? 'A fábrica nasce com o modelo que a ponte usa por padrão na sua máquina.'
                : 'Escreva o identificador exato do modelo. Se a máquina não aceitar, a fábrica não nasce e o motivo volta na base.'
            }
          >
            <Segmented
              block
              label="Modelo da fábrica"
              value={f.modoDoModelo}
              onChange={(id) => f.setModoDoModelo(id as 'ponte' | 'mao')}
              options={[
                { id: 'ponte', label: 'Padrão da ponte', hint: 'recomendado' },
                { id: 'mao', label: 'Escolher na mão', hint: 'identificador exato' }
              ]}
            />
            {f.modoDoModelo === 'mao' ? (
              <input
                className="gf-input body"
                value={f.modelo}
                spellCheck={false}
                aria-label="Identificador do modelo"
                placeholder={EXEMPLO_DE_MODELO}
                onChange={(e) => f.setModelo(e.target.value)}
              />
            ) : null}
          </Campo>
        </div>

        <Campo rotulo="3. Comando inicial" estica>
          <textarea
            className="gf-input body"
            style={{ flex: 1, minHeight: 120 }}
            value={f.comando}
            aria-label="Comando inicial da fábrica"
            placeholder="Diga o que a fábrica deve fazer primeiro. Ex.: implemente o envio de documentos e me peça aprovação antes de mexer no banco."
            onChange={(e) => f.setComando(e.target.value)}
          />
        </Campo>

        {f.ordem.erro ? <ErroDeEscrita mensagem={f.ordem.erro} aoFechar={f.ordem.limparErro} /> : null}

        <div className="flex items-center justify-end gap-2">
          {f.motivo ? <span className="caption gf-faint flex-1">{f.motivo}</span> : null}
          <Button variant="ghost" onClick={props.aoCancelar} disabled={f.ordem.ocupado}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={f.travado} onClick={() => void f.abrir()}>
            {f.ordem.ocupado ? 'Registrando...' : 'Abrir fábrica'}
          </Button>
        </div>
      </Panel>

      <Panel title="Antes de nascer">
        <div className="flex flex-col gap-3">
          <p className="body gf-muted">
            O painel não abre a fábrica: ele registra a ordem na fila. A ponte lê, confere o portão de aprovação com
            uma isca, limpa o ambiente e fixa o modo de permissão na mão. Qualquer uma dessas falhando, a fábrica não
            nasce e o motivo aparece na base.
          </p>
          <div className="gf-stat-row body">
            <span className="gf-muted">Ponte</span>
            <span className="mono">{props.estado.ponte.online ? 'conectada' : 'offline'}</span>
          </div>
          <div className="gf-stat-row body">
            <span className="gf-muted">Máquina</span>
            <span className="mono">{props.estado.ponte.maquina ?? 'nenhuma pareada'}</span>
          </div>
          <div className="gf-stat-row body">
            <span className="gf-muted">Fábricas no painel</span>
            <span className="mono">{props.estado.contagem.total}</span>
          </div>
          <p className="caption gf-faint">
            Nada de risco roda sem a sua resposta. O pedido de aprovação chega na fila e espera por você.
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* ---------- celular ---------- */

export function NovaFabricaCelular(props: NovaFabricaProps) {
  const f = usarFormulario(props);

  return (
    <>
      <Campo rotulo="Projeto">
        {f.sugestoes.length ? (
          <div className="gf-list">
            {f.sugestoes.slice(0, 3).map((p) => (
              <button
                key={p.caminho}
                type="button"
                className={cx('gf-li', f.caminho === p.caminho && 'gf-li-on')}
                onClick={() => f.setCaminho(p.caminho)}
              >
                <div className="gf-li-main">
                  <div className="body-strong">{p.nome}</div>
                  <div className="mono gf-faint">{p.caminho}</div>
                </div>
              </button>
            ))}
          </div>
        ) : null}
        <input
          className="gf-input body"
          value={f.caminho}
          spellCheck={false}
          aria-label="Caminho da pasta do projeto"
          placeholder="Ou escreva o caminho da pasta"
          onChange={(e) => f.setCaminho(e.target.value)}
        />
      </Campo>

      <Campo rotulo="Agente">
        <input
          className="gf-input body"
          value={f.agente}
          spellCheck={false}
          aria-label="Nome do agente"
          placeholder={AGENTE_PADRAO}
          onChange={(e) => f.setAgente(e.target.value)}
        />
      </Campo>

      <Campo rotulo="Modelo">
        <Segmented
          block
          label="Modelo da fábrica"
          value={f.modoDoModelo}
          onChange={(id) => f.setModoDoModelo(id as 'ponte' | 'mao')}
          options={[
            { id: 'ponte', label: 'Padrão da ponte' },
            { id: 'mao', label: 'Na mão' }
          ]}
        />
        {f.modoDoModelo === 'mao' ? (
          <input
            className="gf-input body"
            value={f.modelo}
            spellCheck={false}
            aria-label="Identificador do modelo"
            placeholder={EXEMPLO_DE_MODELO}
            onChange={(e) => f.setModelo(e.target.value)}
          />
        ) : null}
      </Campo>

      <Campo rotulo="Comando inicial" estica>
        <textarea
          className="gf-input body"
          style={{ flex: 1, minHeight: 60 }}
          value={f.comando}
          aria-label="Comando inicial da fábrica"
          placeholder="Diga o que a fábrica deve fazer primeiro."
          onChange={(e) => f.setComando(e.target.value)}
        />
      </Campo>

      {f.ordem.erro ? <ErroDeEscrita mensagem={f.ordem.erro} aoFechar={f.ordem.limparErro} /> : null}
      {f.motivo ? <span className="caption gf-faint gf-motivo">{f.motivo}</span> : null}

      <Button variant="primary" size="touch" block disabled={f.travado} onClick={() => void f.abrir()}>
        {f.ordem.ocupado ? 'Registrando...' : 'Abrir fábrica'}
      </Button>
    </>
  );
}
