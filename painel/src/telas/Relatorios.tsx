'use client';

/*
 * OST 13, Onda 3, RELATÓRIOS. Duas portas para o mesmo leitor:
 *  - a aba "Relatórios" dentro de cada fábrica, com os fechamentos e diários
 *    dela, mais novo em cima;
 *  - o menu "Relatórios", juntando todas as fábricas, com filtro por fábrica e
 *    por data. Vale para fábrica aberta na mão e pelo painel.
 *
 * O texto é mostrado INTEIRO, sem resumir nem reescrever. Os títulos e o
 * negrito ganham forma a partir de elementos React montados aqui; nada vira
 * HTML e nenhum endereço do texto vira link (condição da segurança, OST 13).
 *
 * Toda falha de leitura aparece na tela, §A.22.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { Button } from '@/componentes/ds';
import type { EstadoDoPainel } from '@/dados/painel';
import {
  usarRelatoriosDaFabrica,
  usarRelatoriosDaFaixa,
  usarRelatoriosRecentes,
  type Colecao
} from '@/dados/ouvintes';
import {
  blocosDoTexto,
  diaLegivel,
  faixaDoDia,
  filtrarRelatorios,
  inicioDoDiaDeBrasilia,
  nomeDoRelatorio,
  ordenarRelatorios,
  traduzirRelatorio,
  type Relatorio,
  type Trecho
} from '@/dados/relatorios';
import type { RelatorioBase } from '@/dados/tipos';
import { consumo, plural, quandoCurto, tempoDecorrido } from '@/formato';
import { Falha, Vazio } from './pecas';

/* Quantos relatórios o menu lê por vez, de todas as fábricas. */
const LOTE_DE_RELATORIOS = 100;

/* ---------- texto ---------- */

function Trechos({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((t, i) =>
        t.forte ? (
          <strong key={i}>{t.texto}</strong>
        ) : t.codigo ? (
          <code key={i} className="gf-rel-codigo">
            {t.texto}
          </code>
        ) : (
          <Fragment key={i}>{t.texto}</Fragment>
        )
      )}
    </>
  );
}

export function TextoDoRelatorio({ texto }: { texto: string }) {
  const blocos = useMemo(() => blocosDoTexto(texto), [texto]);
  if (!texto) return <div className="body gf-muted">A ponte gravou este relatório sem texto.</div>;
  return (
    <div className="gf-rel-texto">
      {blocos.map((b, i) => {
        switch (b.tipo) {
          case 'titulo':
            return (
              <div key={i} className={b.nivel <= 2 ? 'title-sm gf-rel-titulo' : 'body-strong gf-rel-titulo'}>
                <Trechos trechos={b.trechos} />
              </div>
            );
          case 'item':
            return (
              <div key={i} className="body gf-rel-item" style={{ paddingLeft: `${1.6 + b.recuo * 1.2}em` }}>
                <span className="gf-rel-marca" aria-hidden>
                  {b.marca}
                </span>
                <Trechos trechos={b.trechos} />
              </div>
            );
          case 'paragrafo':
            return (
              <div key={i} className="body gf-rel-par">
                <Trechos trechos={b.trechos} />
              </div>
            );
          case 'codigo':
            return (
              <pre key={i} className="mono gf-rel-pre">
                {b.texto}
              </pre>
            );
          case 'regra':
            return <hr key={i} className="gf-rel-regra" />;
          default:
            return <div key={i} className="gf-rel-vazio" />;
        }
      })}
    </div>
  );
}

/* ---------- leitor ---------- */

function rotuloDoTipo(r: Relatorio): string {
  return r.tipo === 'diario' ? `Diário de ${diaLegivel(r.dia)}` : 'Fechamento';
}

function Leitor({ r, nome, agora }: { r: Relatorio; nome: string; agora: Date }) {
  const meta = [
    r.criadoEm ? `gravado ${quandoCurto(r.criadoEm, agora)}` : null,
    r.tipo === 'fechamento' && r.dia ? `dia ${diaLegivel(r.dia)}` : null,
    r.origem === 'mao' ? 'aberta na mão' : r.origem === 'painel' ? 'aberta pelo painel' : null,
    r.tipo === 'diario' && r.rodadas !== null ? plural(r.rodadas, 'rodada', 'rodadas') : null,
    r.tipo === 'diario' ? `tempo: ${r.tempoMs === null ? 'não medido' : tempoDecorrido(r.tempoMs)}` : null,
    r.tipo === 'diario' ? `consumo do dia: ${r.tokensDoDia === null ? 'não medido' : consumo(r.tokensDoDia)}` : null,
    r.tipo === 'diario' && r.geradoAtrasado ? 'gerado depois do dia, quando a máquina acordou' : null
  ].filter(Boolean);
  return (
    <article className="gf-rel-leitor" aria-label={`${rotuloDoTipo(r)}, ${nome}`}>
      <header className="gf-rel-cabeca">
        <div className="flex items-center gap-2 min-w-0">
          <span className={r.tipo === 'diario' ? 'gf-rel-chip gf-rel-chip-diario' : 'gf-rel-chip'}>{rotuloDoTipo(r)}</span>
          <span className="title-sm gf-rel-nome">{nome}</span>
        </div>
        <div className="caption gf-muted">{meta.join(' · ')}</div>
        {r.cortado ? (
          <div className="caption gf-rel-aviso">
            Texto incompleto: a ponte não conseguiu ler o fechamento inteiro e gravou o trecho que o gancho entregou.
          </div>
        ) : null}
      </header>
      <TextoDoRelatorio texto={r.texto} />
    </article>
  );
}

/* ---------- lista e leitor ---------- */

function ListaComLeitor({
  itens,
  nomes,
  agora,
  celular,
  mostrarFabrica,
  vazio,
  pe
}: {
  itens: Relatorio[];
  nomes: Map<string, string>;
  agora: Date;
  celular?: boolean;
  mostrarFabrica: boolean;
  vazio: React.ReactNode;
  pe?: React.ReactNode;
}) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const atual = itens.find((r) => r.id === escolhido) ?? (celular ? null : itens[0] ?? null);

  /* No celular, a escolha some quando o relatório sai da lista pelo filtro. */
  useEffect(() => {
    if (escolhido && !itens.some((r) => r.id === escolhido)) setEscolhido(null);
  }, [itens, escolhido]);

  if (itens.length === 0) return <div className="gf-rel-vaziobox">{vazio}</div>;

  if (celular && atual) {
    return (
      <div className="gf-rel-cel-leitor">
        <Button variant="secondary" size="touch" block onClick={() => setEscolhido(null)}>
          Voltar à lista
        </Button>
        <div className="gf-rel-rolagem">
          <Leitor r={atual} nome={nomeDoRelatorio(atual, nomes)} agora={agora} />
        </div>
      </div>
    );
  }

  const lista = (
    <ul className="gf-rel-lista" aria-label="Relatórios, mais novo em cima">
      {itens.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            className={atual?.id === r.id ? 'gf-rel-linha gf-rel-linha-on' : 'gf-rel-linha'}
            aria-current={atual?.id === r.id}
            onClick={() => setEscolhido(r.id)}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className={r.tipo === 'diario' ? 'gf-rel-chip gf-rel-chip-diario' : 'gf-rel-chip'}>
                {r.tipo === 'diario' ? 'Diário' : 'Fechamento'}
              </span>
              <span className="caption gf-faint gf-push">{r.criadoEm ? quandoCurto(r.criadoEm, agora) : diaLegivel(r.dia)}</span>
            </span>
            {mostrarFabrica ? <span className="body-strong gf-rel-nome">{nomeDoRelatorio(r, nomes)}</span> : null}
            <span className="caption gf-muted gf-rel-previa">
              {r.tipo === 'diario' ? `Dia ${diaLegivel(r.dia)}` : primeiraFrase(r.texto)}
            </span>
          </button>
        </li>
      ))}
      {pe ? <li className="gf-rel-pe">{pe}</li> : null}
    </ul>
  );

  if (celular) return <div className="gf-rel-rolagem">{lista}</div>;

  return (
    <div className="gf-rel-corpo">
      <div className="gf-rel-rolagem">{lista}</div>
      <div className="gf-rel-rolagem gf-rel-leitorbox gf-glass">
        {atual ? <Leitor r={atual} nome={nomeDoRelatorio(atual, nomes)} agora={agora} /> : null}
      </div>
    </div>
  );
}

/* Só para a linha da lista saber qual é qual. O relatório inteiro está no
   leitor, sem corte. */
function primeiraFrase(texto: string): string {
  const linha =
    texto
      .split(/\r?\n/)
      .map((l) => l.replace(/^[#>*\-\s\d.)]+/, '').replace(/\*\*/g, '').trim())
      .find((l) => l.length > 0) ?? 'Sem texto';
  return linha.length > 90 ? `${linha.slice(0, 89)}…` : linha;
}

function nomesDasFabricas(estado: EstadoDoPainel): Map<string, string> {
  return new Map(estado.fabricas.map((f) => [f.id, f.project]));
}

function situacaoDaLeitura(c: Colecao<RelatorioBase>, vazio: { titulo: string; detalhe: string }) {
  if (c.erro) return <Falha mensagem={c.erro} />;
  if (c.carregando) return <Vazio titulo="Lendo os relatórios" detalhe="O painel está abrindo a leitura ao vivo na base." />;
  return <Vazio titulo={vazio.titulo} detalhe={vazio.detalhe} />;
}

const SEM_RELATORIO = {
  titulo: 'Nenhum relatório ainda',
  detalhe:
    'O fechamento aparece aqui quando uma rodada termina com o relatório de fechamento, e o diário sai depois das 20h de Brasília.'
};

/* ---------- aba da fábrica ---------- */

export function RelatoriosDaFabrica({
  leitura,
  estado,
  celular
}: {
  leitura: Colecao<RelatorioBase>;
  estado: EstadoDoPainel;
  celular?: boolean;
}) {
  const itens = useMemo(() => ordenarRelatorios(leitura.itens.map(traduzirRelatorio)), [leitura.itens]);
  const nomes = useMemo(() => nomesDasFabricas(estado), [estado]);
  return (
    <div className="gf-rel">
      {leitura.erro ? (
        <Falha mensagem={leitura.erro} />
      ) : (
        <ListaComLeitor
          itens={itens}
          nomes={nomes}
          agora={estado.agora}
          celular={celular}
          mostrarFabrica={false}
          vazio={situacaoDaLeitura(leitura, SEM_RELATORIO)}
        />
      )}
    </div>
  );
}

/* ---------- menu, todas as fábricas ---------- */

export function RelatoriosGerais({
  base,
  estado,
  celular
}: {
  base: Firestore | null;
  estado: EstadoDoPainel;
  celular?: boolean;
}) {
  const [fabricaId, setFabricaId] = useState('');
  const [dia, setDia] = useState('');
  const [quantos, setQuantos] = useState(LOTE_DE_RELATORIOS);

  const daFabrica = usarRelatoriosDaFabrica(base, fabricaId || null);
  const recentes = usarRelatoriosRecentes(base, quantos, !fabricaId);
  const recentesCompletos = !recentes.carregando && recentes.itens.length < quantos;
  const maisAntigo = useMemo(() => {
    let menor: number | null = null;
    for (const r of recentes.itens.map(traduzirRelatorio)) {
      const t = r.criadoEm?.getTime();
      if (t !== undefined && (menor === null || t < menor)) menor = t;
    }
    return menor;
  }, [recentes.itens]);
  /* Data fora do que já veio: lê a faixa daquele dia direto na base. */
  const inicio = dia ? inicioDoDiaDeBrasilia(dia) : null;
  const precisaDaFaixa =
    !fabricaId && inicio !== null && !recentes.carregando && !recentesCompletos && (maisAntigo === null || maisAntigo > inicio.getTime());
  const faixa = useMemo(() => (precisaDaFaixa && dia ? faixaDoDia(dia) : null), [precisaDaFaixa, dia]);
  const daFaixa = usarRelatoriosDaFaixa(base, faixa);

  const fonte = fabricaId ? daFabrica : faixa ? daFaixa : recentes;
  const todos = useMemo(() => ordenarRelatorios(fonte.itens.map(traduzirRelatorio)), [fonte.itens]);
  const itens = useMemo(() => filtrarRelatorios(todos, { fabricaId: fabricaId || null, dia: dia || null }), [todos, fabricaId, dia]);
  const nomes = useMemo(() => nomesDasFabricas(estado), [estado]);

  /* Na lista de fábricas do filtro: as do painel, menos as de teste, e toda
     fábrica que já tem relatório carregado, mesmo fora do painel. */
  const opcoes = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const f of estado.fabricas) if (!f.teste) mapa.set(f.id, f.project);
    for (const r of todos) if (r.fabricaId && !mapa.has(r.fabricaId)) mapa.set(r.fabricaId, nomeDoRelatorio(r, nomes));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [estado.fabricas, todos, nomes]);

  const filtrando = Boolean(fabricaId || dia);
  const podeCarregarMais = !fabricaId && !faixa && !recentesCompletos && !recentes.carregando && !recentes.erro;

  return (
    <div className="gf-rel">
      <div className={celular ? 'gf-rel-filtros gf-rel-filtros-cel' : 'gf-rel-filtros'}>
        <label className="gf-rel-campo">
          <span className="caption gf-muted">Fábrica</span>
          <select className="gf-input body" value={fabricaId} onChange={(e) => setFabricaId(e.target.value)}>
            <option value="">Todas as fábricas</option>
            {opcoes.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        <label className="gf-rel-campo">
          <span className="caption gf-muted">Dia</span>
          <input className="gf-input body" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        </label>
        {filtrando ? (
          <Button
            variant="ghost"
            size={celular ? 'touch' : undefined}
            onClick={() => {
              setFabricaId('');
              setDia('');
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
        <span className="caption gf-faint gf-push">
          {fonte.carregando ? 'Lendo na base' : plural(itens.length, 'relatório', 'relatórios')}
        </span>
      </div>
      {fonte.erro ? (
        <Falha mensagem={fonte.erro} />
      ) : (
        <ListaComLeitor
          itens={itens}
          nomes={nomes}
          agora={estado.agora}
          celular={celular}
          mostrarFabrica={!fabricaId}
          vazio={situacaoDaLeitura(
            fonte,
            filtrando
              ? { titulo: 'Nenhum relatório com este filtro', detalhe: 'Troque a fábrica ou o dia, ou limpe os filtros.' }
              : SEM_RELATORIO
          )}
          pe={
            podeCarregarMais ? (
              <Button variant="secondary" block onClick={() => setQuantos((q) => q + LOTE_DE_RELATORIOS)}>
                Carregar relatórios mais antigos
              </Button>
            ) : null
          }
        />
      )}
    </div>
  );
}
