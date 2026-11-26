"use strict";
/*
 * TRADUTOR ENTRE A BASE E A TELA. Arquivo unico, de proposito.
 *
 * A base na nuvem fala portugues, como manda o contrato das tres pecas
 * (docs/contrato-tres-pecas.md): colecoes fabricas, atividade, aprovacoes,
 * comandos, maquinas, e estados como "em execucao" e "aguardando aprovacao".
 * O design system do pacote do designer fala ingles: Factory, FactoryState
 * 'running' | 'approval' | 'idle' | 'done' | 'failed' | 'offline'.
 *
 * Toda a conversao entre os dois mundos mora aqui. Nenhum outro arquivo
 * compara texto de estado com string solta.
 *
 * MAPA DE ESTADO DA FABRICA, um a um:
 *
 *   base (contrato)            tela (design system)   texto na tela           forma do icone
 *   -------------------------  ---------------------  ----------------------  --------------------------
 *   "em execucao"              running                Em execução             ponto com anel pulsando
 *   "aguardando aprovacao"     approval               Aguardando aprovação    losango cheio
 *   "aguardando comando"       idle                   Aguardando comando      círculo vazio
 *   "concluida"                done                   Concluída               círculo com visto
 *   "falhou"                   failed                 Falhou                  X
 *   "ponte offline"            offline                Ponte offline           círculo tracejado cortado
 *   qualquer outra coisa       idle                   Aguardando comando      círculo vazio
 *
 * O contrato escreve sem acento. O painel aceita com acento tambem ("em
 * execução", "aguardando aprovação", "concluída"), porque normaliza antes de
 * comparar. Estado desconhecido cai em idle, nunca em running: o painel nao
 * inventa que a fabrica esta trabalhando.
 *
 * REGRA DURA DA PONTE, §A.10: quando a ponte esta offline (heartbeat velho ou
 * estadoPonte "offline"), toda fabrica passa a offline, qualquer que seja o
 * estado gravado. O painel nunca diz em execução com heartbeat velho. OST 15:
 * "a ponte" é a da máquina da própria fábrica, veja ponteDaFabrica.
 *
 * MAPA DE RISCO: "baixo" vira low, "medio" (ou "médio") vira medium, "alto"
 * vira high. Desconhecido vira high, porque na duvida o risco sobe, nao desce.
 *
 * MAPA DE SITUACAO DE TAREFA: "em andamento" vira running, "concluida" vira
 * done, "falhou" vira failed, desconhecida vira idle.
 *
 * ATIVIDADE: veja traduzirPasso, na secao de atividade. OST 10: o mapa antigo
 * esperava tipos que a ponte nunca gravou e escrevia "Deu um passo" em tudo.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROTULO_DA_ORIGEM = exports.LIMITE_FECHADA_MS = exports.NOME_EXTERNA = exports.TETO_ROTULO = exports.TETO_NOME_DA_SESSAO = exports.LIMITE_PARADO_MS = exports.LIMITE_HEARTBEAT_MS = void 0;
exports.paraData = paraData;
exports.traduzirEstado = traduzirEstado;
exports.traduzirRisco = traduzirRisco;
exports.traduzirSituacaoDeTarefa = traduzirSituacaoDeTarefa;
exports.avaliarMaquina = avaliarMaquina;
exports.fraseDaMaquina = fraseDaMaquina;
exports.avaliarPonte = avaliarPonte;
exports.ponteDaFabrica = ponteDaFabrica;
exports.mapaDeMaquinas = mapaDeMaquinas;
exports.nomeDaExternaPelaHora = nomeDaExternaPelaHora;
exports.distinguirExternas = distinguirExternas;
exports.somarTokens = somarTokens;
exports.traduzirFabrica = traduzirFabrica;
exports.ordenarFabricas = ordenarFabricas;
exports.caminhosDeProjeto = caminhosDeProjeto;
exports.marcaDaOrigem = marcaDaOrigem;
exports.traduzirAprovacao = traduzirAprovacao;
exports.traduzirDecisao = traduzirDecisao;
exports.ordenarDecisoes = ordenarDecisoes;
exports.ordenarAprovacoes = ordenarAprovacoes;
exports.aprovacaoPendente = aprovacaoPendente;
exports.traduzirPasso = traduzirPasso;
exports.traduzirComando = traduzirComando;
exports.montarAtividade = montarAtividade;
exports.resumoDaLinha = resumoDaLinha;
exports.horaDaLinha = horaDaLinha;
exports.traduzirTarefa = traduzirTarefa;
exports.ordenarTarefas = ordenarTarefas;
exports.indicadoresDaPonte = indicadoresDaPonte;
const formato_1 = require("../formato");
/* ---------- limites ---------- */
/* Heartbeat mais velho que isto e ponte offline, §A.10. A ponte bate a cada
   poucos segundos; um minuto de silencio ja e queda. */
exports.LIMITE_HEARTBEAT_MS = 60000;
/* Pedido parado acima disto acende o tempo em âmbar (prop stale do pedido). */
exports.LIMITE_PARADO_MS = 15 * 60000;
/* ---------- hora ---------- */
function paraData(valor) {
    if (valor == null)
        return null;
    if (typeof valor === 'object' && typeof valor.toDate === 'function') {
        try {
            return valor.toDate();
        }
        catch {
            return null;
        }
    }
    if (typeof valor === 'number')
        return new Date(valor);
    if (typeof valor === 'string') {
        const d = new Date(valor);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}
function semAcento(texto) {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}
/* ---------- estado ---------- */
const MAPA_DE_ESTADO = {
    'em execucao': 'running',
    'aguardando aprovacao': 'approval',
    'aguardando comando': 'idle',
    concluida: 'done',
    falhou: 'failed',
    'ponte offline': 'offline'
};
function traduzirEstado(estado) {
    if (!estado)
        return 'idle';
    return MAPA_DE_ESTADO[semAcento(estado)] ?? 'idle';
}
const MAPA_DE_RISCO = {
    baixo: 'low',
    medio: 'medium',
    alto: 'high'
};
function traduzirRisco(risco) {
    if (!risco)
        return 'high';
    return MAPA_DE_RISCO[semAcento(risco)] ?? 'high';
}
const MAPA_DE_SITUACAO_DE_TAREFA = {
    'em andamento': 'running',
    concluida: 'done',
    falhou: 'failed'
};
function traduzirSituacaoDeTarefa(situacao) {
    if (!situacao)
        return 'idle';
    return MAPA_DE_SITUACAO_DE_TAREFA[semAcento(situacao)] ?? 'idle';
}
/* OST 15, condição 21 da segurança: o painel também corta, sem confiar na ponte.
   O teto do nome é o mesmo TETO_NOME de escritas.ts (80); não é importado de lá
   porque escritas.ts carrega o Firebase, e o tradutor tem de ser puro. A prova
   confere que os dois números são iguais. */
exports.TETO_NOME_DA_SESSAO = 80;
exports.TETO_ROTULO = 40;
/* Tolera ausente, nulo e o que não for texto: tudo isso vira nulo. O resultado
   só entra na tela como texto filho do React, condição 19. */
function textoLimpo(valor, teto) {
    if (typeof valor !== 'string')
        return null;
    const limpo = valor.replace(/\s+/g, ' ').trim();
    if (!limpo)
        return null;
    return teto ? limpo.slice(0, teto).trim() : limpo;
}
function avaliarMaquina(m, agora = new Date()) {
    const visto = paraData(m.vistoPorUltimo);
    const atrasoMs = visto ? agora.getTime() - visto.getTime() : null;
    const declaradaOffline = semAcento(m.estadoPonte ?? '') === 'offline';
    const online = !declaradaOffline && atrasoMs != null && atrasoMs <= exports.LIMITE_HEARTBEAT_MS;
    const id = m.maquinaId ?? m.id;
    const rotulo = textoLimpo(m.rotulo, exports.TETO_ROTULO);
    const nome = textoLimpo(m.nome, exports.TETO_NOME_DA_SESSAO);
    return {
        id,
        rotulo,
        nome,
        ondeRoda: rotulo ?? nome,
        chamada: rotulo ?? nome ?? id,
        online,
        versao: m.versaoPonte ?? null,
        vistoPorUltimo: visto,
        atrasoMs,
        teste: m.teste === true
    };
}
/* Frase de uma máquina no indicador geral: "Notebook conectada", "Nuvem offline". */
function fraseDaMaquina(m) {
    return `${m.chamada} ${m.online ? 'conectada' : 'offline'}`;
}
function avaliarPonte(maquinas, agora = new Date()) {
    if (!maquinas.length) {
        return {
            situacao: 'sem maquina',
            online: false,
            maquina: null,
            maquinaId: null,
            versao: null,
            vistoPorUltimo: null,
            atrasoMs: null,
            maquinas: []
        };
    }
    const vistas = maquinas
        .map((m) => ({ maquina: m, visto: paraData(m.vistoPorUltimo) }))
        .sort((a, b) => (b.visto?.getTime() ?? 0) - (a.visto?.getTime() ?? 0));
    const melhor = vistas[0];
    const avaliada = avaliarMaquina(melhor.maquina, agora);
    /* Ordem estável no indicador: pelo nome que aparece, para o chip não trocar de
       lugar a cada sinal de vida. */
    const todas = maquinas
        .map((m) => avaliarMaquina(m, agora))
        .sort((a, b) => a.chamada.localeCompare(b.chamada, 'pt-BR'));
    return {
        situacao: avaliada.online ? 'conectada' : 'offline',
        online: avaliada.online,
        maquina: melhor.maquina.nome ?? melhor.maquina.maquinaId ?? melhor.maquina.id,
        maquinaId: melhor.maquina.maquinaId ?? melhor.maquina.id ?? null,
        versao: melhor.maquina.versaoPonte ?? null,
        vistoPorUltimo: melhor.visto,
        atrasoMs: avaliada.atrasoMs,
        maquinas: todas
    };
}
/*
 * OST 15: de qual sinal de vida a fábrica depende.
 *
 * Fábrica com maquinaId: o da máquina DELA, e só dela. A queda de outra máquina
 * não muda nada aqui. Se a máquina dela não aparece na base, não há sinal de vida
 * nenhum, e o painel não diz que ela está trabalhando, §A.10.
 *
 * Fábrica sem maquinaId, dado antigo: a regra de antes, a ponte geral.
 */
function ponteDaFabrica(doc, mapa, geral) {
    const id = textoLimpo(doc.maquinaId);
    if (!id)
        return { pontePerdida: !geral.online, ponteVistaEm: geral.vistoPorUltimo, maquina: null };
    const maquina = mapa.get(id) ?? null;
    if (!maquina)
        return { pontePerdida: true, ponteVistaEm: null, maquina: null };
    return { pontePerdida: !maquina.online, ponteVistaEm: maquina.vistoPorUltimo, maquina };
}
function mapaDeMaquinas(maquinas, agora = new Date()) {
    const mapa = new Map();
    for (const m of maquinas) {
        const avaliada = avaliarMaquina(m, agora);
        mapa.set(m.id, avaliada);
        if (m.maquinaId)
            mapa.set(m.maquinaId, avaliada);
    }
    return mapa;
}
/* ---------- fabrica ---------- */
/* OST 9: como nasce, na tela, a fábrica aberta na mão. Pode ser renomeada. */
exports.NOME_EXTERNA = 'Fábrica externa';
/*
 * Duas fábricas externas ao mesmo tempo têm de ser distinguíveis SEM mostrar
 * caminho, pedido do diretor. Só as que ainda não ganharam nome entram na conta.
 * Uma sozinha fica "Fábrica externa". Duas ou mais ganham a hora em que abriram;
 * se até a hora bater, ganham o número, na ordem em que abriram.
 *
 * OST 10: a hora sozinha era ambígua entre dias. Na tela de 23/11 apareciam
 * "das 18:30" e "das 21:57" que eram de outro dia. Agora a de hoje leva só a
 * hora, e a de outro dia leva a data junto: "Fábrica externa de 22/11 às 18:30".
 */
function nomeDaExternaPelaHora(inicio, agora = new Date()) {
    if (!inicio)
        return exports.NOME_EXTERNA;
    const quando = (0, formato_1.quandoCurto)(inicio, agora);
    return quando.includes(' às ') ? `${exports.NOME_EXTERNA} de ${quando}` : `${exports.NOME_EXTERNA} das ${quando}`;
}
function distinguirExternas(lista, agora = new Date()) {
    const semNome = lista.filter((f) => f.externa && f.nomeDado === null && f.nomeDaSessao === null);
    if (semNome.length < 2)
        return lista;
    const ordem = [...semNome].sort((a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0));
    const rotulo = new Map();
    const vezes = new Map();
    for (const f of ordem) {
        const base = nomeDaExternaPelaHora(f.startedAt, agora);
        const n = (vezes.get(base) ?? 0) + 1;
        vezes.set(base, n);
        rotulo.set(f.id, n === 1 ? base : `${base}, nº ${n}`);
    }
    /* Se a primeira de uma hora repetida ficou sem número, ela ganha o 1. */
    for (const f of ordem) {
        const r = rotulo.get(f.id);
        if (!r.includes(', nº ') && (vezes.get(r) ?? 0) > 1)
            rotulo.set(f.id, `${r}, nº 1`);
    }
    return lista.map((f) => (rotulo.has(f.id) ? { ...f, project: rotulo.get(f.id) } : f));
}
/* O contrato nao tem campo para a frase do que a fabrica faz agora. Em vez de
   inventar, o painel escreve a frase a partir do estado, e a tela da fabrica
   mostra o passo real da atividade ao lado. */
function frasePeloEstado(estado, temPedido, pausada = false) {
    if (estado === 'approval' || temPedido)
        return 'Parou para pedir aprovação.';
    if (estado === 'running')
        return 'Em execução. Abra a fábrica para ver o passo atual.';
    /* Pausada não é estado novo, §A.4 fecha a lista: ela fica em aguardando
       comando, com o campo pausada, e a tela diz a palavra certa ao diretor. */
    if (estado === 'idle' && pausada)
        return 'Pausada por você. Retome para ela voltar a andar.';
    if (estado === 'idle')
        return 'Esperando a próxima ordem.';
    if (estado === 'done')
        return 'Concluída.';
    if (estado === 'failed')
        return 'Falhou. Abra a fábrica para ver o último passo.';
    return 'A ponte está offline, o painel não sabe o passo atual.';
}
/*
 * Soma os tokens do consumo, aceitando a grafia do kit e a nossa.
 *
 * Devolve null quando NAO EXISTE medida, que é o caso de toda fábrica aberta na
 * mão: o gancho não recebe contagem de token do Claude Code. Zero seria mentira,
 * porque zero afirma que ela não gastou nada.
 */
function somarTokens(consumo) {
    if (consumo == null || typeof consumo !== 'object')
        return null;
    const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
    if (typeof consumo.totalTokens === 'number')
        return consumo.totalTokens;
    const soma = n(consumo.input_tokens) +
        n(consumo.output_tokens) +
        n(consumo.cache_read_input_tokens) +
        n(consumo.cache_creation_input_tokens) +
        n(consumo.inputTokens) +
        n(consumo.outputTokens) +
        n(consumo.cacheReadTokens) +
        n(consumo.thinkingTokens);
    /* Objeto de consumo existe mas sem nenhum número conhecido: isso é medida que
       não deu para ler, e continua sendo "não medido", não zero. */
    return soma > 0 ? soma : null;
}
/* OST 11: fábrica que perdeu a conexão há mais que isto sai da Visão geral e vai
   para Fábricas fechadas. Nada é apagado, §A.17: só muda de lugar. */
exports.LIMITE_FECHADA_MS = 24 * 60 * 60000;
/* Estado que acabou não muda porque a ponte caiu. */
function estadoFinal(estado) {
    return estado === 'done' || estado === 'failed';
}
function traduzirFabrica(doc, opcoes) {
    const agora = opcoes.agora ?? new Date();
    const inicio = paraData(doc.inicio);
    const estadoGravado = traduzirEstado(doc.estado);
    /*
     * OST 11, DEFEITO: com a ponte caída, TODO cartão virava "Ponte offline",
     * inclusive fábricas concluídas em 14/10 e 18/10, que às 15:41 diziam
     * "Concluída". A regra do §A.10 é não dizer que a fábrica está trabalhando com
     * a ponte muda, e ela só alcança quem ainda estava viva. Fábrica que terminou,
     * concluída ou com falha, continua do jeito que terminou, com ou sem ponte.
     */
    const state = opcoes.pontePerdida && !estadoFinal(estadoGravado) ? 'offline' : estadoGravado;
    /* Quando perdeu a conexão: a que a ponte já gravou como offline, pela hora da
       gravação; a que só está offline porque a ponte caiu agora, pelo último sinal
       da ponte. */
    const perdeuConexaoEm = state !== 'offline'
        ? null
        : estadoGravado === 'offline'
            ? (paraData(doc.atualizadoEm) ?? opcoes.ponteVistaEm ?? null)
            : (opcoes.ponteVistaEm ?? null);
    const fechada = state === 'done' ||
        (state === 'offline' &&
            (perdeuConexaoEm === null || agora.getTime() - perdeuConexaoEm.getTime() > exports.LIMITE_FECHADA_MS)) ||
        (state === 'failed' &&
            agora.getTime() - (paraData(doc.atualizadoEm) ?? inicio ?? agora).getTime() > exports.LIMITE_FECHADA_MS);
    /*
     * TEMPO DECORRIDO, e o que ele mede de verdade.
     *
     * Defeito achado na tela do diretor: fábrica CONCLUÍDA mostrava 19h57, e a
     * sessão não trabalhou 19 horas seguidas. O relógio era contado da abertura até
     * AGORA, para todo estado, então fábrica encerrada continuava contando a noite
     * inteira, o computador dormindo e o tempo parado junto.
     *
     * Agora o relógio PARA quando a fábrica para. Para a que já terminou, conta do
     * início até o fim; para a que está viva, conta do início até agora.
     *
     * O que este número é, dito sem enfeite: tempo de PAREDE desde a abertura, e
     * não tempo de trabalho. Fábrica aberta de manhã e usada duas vezes no dia
     * mostra o dia inteiro, porque o relógio não sabe distinguir espera de
     * trabalho. Medir tempo de trabalho de verdade é somar os intervalos entre
     * passos, e isso muda o desenho do §A.4: está proposto ao diretor, não feito.
     */
    /*
     * OST 9: o número que a tela mostra passou a ser o TEMPO DA TAREFA, pedido do
     * diretor. Tarefa é o comando que está rodando, ou o último que rodou: começa
     * quando a ponte entrega o comando (ou quando o diretor manda o prompt na
     * sessão aberta na mão) e para quando a rodada termina.
     *
     * Andando: conta do começo até agora. Parada: do começo até o fim gravado.
     * Sem começo gravado, ou parada sem fim gravado, é "não medida": a tela não
     * estima, e fábrica antiga, de antes da OST 9, cai aqui.
     */
    const tarefaInicio = paraData(doc.tarefaInicio);
    const tarefaFim = paraData(doc.tarefaFim ?? null);
    const ativa = estadoGravado === 'running' || estadoGravado === 'approval';
    const tarefaAndando = tarefaInicio !== null && tarefaFim === null && ativa && !opcoes.pontePerdida;
    const taskMs = tarefaInicio === null
        ? null
        : tarefaFim !== null && tarefaFim.getTime() >= tarefaInicio.getTime()
            ? tarefaFim.getTime() - tarefaInicio.getTime()
            : tarefaAndando
                ? Math.max(0, agora.getTime() - tarefaInicio.getTime())
                : null;
    const externa = semAcento(doc.origem ?? '') === 'mao' || doc.id.startsWith('mao-');
    const caminho = doc.projeto?.trim() || doc.pasta?.trim() || null;
    const nomeDaPasta = caminho ? (caminho.split(/[\\/]+/).filter(Boolean).pop() ?? null) : null;
    const nomeDado = doc.nome?.trim() || null;
    /* OST 15, prioridade do nome: o dado no painel; o dado com /rename na sessão;
       o título que o Claude Code deu; e só então "Fábrica externa". */
    const nomeDaSessao = textoLimpo(doc.nomeDaSessao, exports.TETO_NOME_DA_SESSAO) ?? textoLimpo(doc.tituloDaSessao, exports.TETO_NOME_DA_SESSAO);
    const maquina = opcoes.maquina ?? null;
    /*
     * CONSUMO. `null` quer dizer NÃO MEDIDO, e isso é diferente de zero.
     *
     * Fábrica que o diretor abre na mão não tem medida nenhuma: o gancho do Claude
     * Code não entrega contagem de token, e inventar zero ali seria dizer que ela
     * não gastou nada. Fábrica aberta pelo painel tem a medida do kit.
     */
    const tokens = somarTokens(doc.consumo);
    const temPedido = opcoes.pedidoParado != null;
    const pausada = doc.pausada === true;
    return {
        id: doc.id,
        project: nomeDado ?? nomeDaSessao ?? (externa ? exports.NOME_EXTERNA : (nomeDaPasta ?? 'Fábrica sem nome')),
        nomeDado,
        nomeDaSessao,
        maquina,
        ondeRoda: maquina?.ondeRoda ?? null,
        externa,
        projeto: nomeDaPasta ?? 'projeto não informado',
        caminho,
        agent: doc.agente?.trim() || 'Agente não informado',
        /*
         * MODELO. Quando falta, a tela tem de dizer POR QUE falta.
         *
         * "modelo não informado" soava como campo que alguém esqueceu de preencher.
         * A verdade é outra: numa sessão que o diretor abre na mão, o gancho do
         * Claude Code não recebe o modelo, e nenhuma parte da Fábrica tem como saber
         * qual é. Conferido na fila de verdade: as chaves que chegam são t, ev, sid,
         * projeto, origem, ferramenta, alvo, descricao, erro, pedidoDoDiretor,
         * subagente, permissao, fonte, motivo, aviso, custoMs, e nenhuma é modelo.
         * Fábrica aberta pelo painel tem modelo, porque ali quem escolhe é a ponte.
         */
        model: doc.modelo?.trim() ||
            (semAcento(doc.origem ?? '') === 'mao' || doc.id.startsWith('mao-')
                ? 'modelo não reportado pelo Claude Code'
                : 'modelo não informado'),
        state,
        doing: frasePeloEstado(state, temPedido, pausada),
        startedAt: inicio,
        abertaEm: inicio
            ? (0, formato_1.quandoCurto)(inicio, agora).includes(' às ')
                ? `aberta em ${(0, formato_1.quandoCurto)(inicio, agora)}`
                : `aberta às ${(0, formato_1.quandoCurto)(inicio, agora)}`
            : 'abertura sem hora',
        taskMs,
        tarefaAndando,
        tokens,
        elapsed: taskMs === null ? 'tarefa não medida' : `${tarefaAndando ? 'tarefa' : 'última tarefa'} ${(0, formato_1.tempoDecorrido)(taskMs)}`,
        usage: (0, formato_1.consumo)(tokens),
        pending: temPedido ? `Parado há ${(0, formato_1.tempoParado)(opcoes.pedidoParado)}` : null,
        maquinaId: doc.maquinaId ?? null,
        conversationId: doc.conversationId ?? null,
        pausada,
        nasceuNoPainel: semAcento(doc.origem ?? '') === 'painel' || doc.id.startsWith('painel-'),
        erro: doc.erro?.trim() || null,
        teste: doc.teste === true,
        agentesDoProjeto: (Array.isArray(doc.agentesDoProjeto) ? doc.agentesDoProjeto : [])
            .map((a) => ({ nome: String(a?.nome ?? '').trim(), descricao: String(a?.descricao ?? '').trim() }))
            .filter((a) => a.nome.length > 0),
        perdeuConexaoEm,
        fechada
    };
}
/* Ordem da grade, como o manual do FactoryCard manda: quem precisa do diretor
   primeiro (aprovacao e falha, mais antigo antes), depois quem roda, depois
   quem esta parado. */
const PESO_DO_ESTADO = {
    approval: 0,
    failed: 1,
    running: 2,
    offline: 3,
    idle: 4,
    done: 5
};
function ordenarFabricas(lista) {
    return [...lista].sort((a, b) => {
        const peso = PESO_DO_ESTADO[a.state] - PESO_DO_ESTADO[b.state];
        if (peso !== 0)
            return peso;
        const ta = a.startedAt?.getTime() ?? 0;
        const tb = b.startedAt?.getTime() ?? 0;
        return ta - tb;
    });
}
function caminhosDeProjeto(lista) {
    const vistos = new Map();
    for (const f of lista) {
        const caminho = (f.caminho ?? '').trim();
        if (!caminho)
            continue;
        const anterior = vistos.get(caminho);
        if (anterior) {
            anterior.quantas += 1;
            continue;
        }
        const pedacos = caminho.split(/[\\/]+/).filter(Boolean);
        vistos.set(caminho, { caminho, nome: pedacos[pedacos.length - 1] ?? caminho, quantas: 1 });
    }
    return [...vistos.values()].sort((a, b) => b.quantas - a.quantas || a.caminho.localeCompare(b.caminho));
}
function marcaDaOrigem(origem) {
    if (!origem)
        return null;
    const limpa = semAcento(origem);
    if (limpa === 'fato')
        return 'fato';
    if (limpa === 'ponte')
        return 'ponte';
    if (limpa.includes('fato') && limpa.includes('ponte'))
        return 'fato e ponte';
    if (limpa.includes('ponte'))
        return 'ponte';
    if (limpa.includes('fato'))
        return 'fato';
    return null;
}
exports.ROTULO_DA_ORIGEM = {
    fato: 'fato capturado',
    ponte: 'leitura da ponte',
    'fato e ponte': 'fato mais leitura da ponte'
};
function comoLista(valor) {
    if (!valor)
        return [];
    if (Array.isArray(valor))
        return valor.filter(Boolean);
    return valor
        .split(/\r?\n|;|,/)
        .map((p) => p.trim())
        .filter(Boolean);
}
function traduzirAprovacao(doc, agora = new Date()) {
    const pacote = doc.pacote ?? {};
    const criado = paraData(doc.criadoEm);
    const paradoGravado = pacote.tempoParadoMs?.valor;
    const paradoAgora = criado ? agora.getTime() - criado.getTime() : null;
    const waitingMs = Math.max(typeof paradoGravado === 'number' ? paradoGravado : 0, typeof paradoAgora === 'number' ? paradoAgora : 0);
    return {
        id: doc.id,
        factoryId: doc.fabricaId ?? null,
        maquinaId: doc.maquinaId ?? null,
        project: pacote.fabrica?.valor?.trim() || 'Fábrica não informada',
        task: pacote.tarefa?.valor?.trim() || '',
        title: pacote.oQue?.valor?.trim() || pacote.resumo?.valor?.trim() || 'Pedido sem descrição',
        why: pacote.porQue?.valor?.trim() || 'A ponte não informou o motivo.',
        impact: pacote.impacto?.valor?.trim() || 'A ponte não informou o impacto.',
        touches: comoLista(pacote.oQueSeraTocado?.valor),
        risk: traduzirRisco(pacote.risco?.valor),
        tool: pacote.ferramenta?.valor?.trim() || null,
        agentSaid: pacote.agenteDisse?.valor?.trim() || null,
        requestedAt: criado,
        waitingMs,
        waiting: (0, formato_1.tempoParado)(waitingMs),
        stale: waitingMs > exports.LIMITE_PARADO_MS,
        origens: {
            title: marcaDaOrigem(pacote.oQue?.origem ?? pacote.resumo?.origem),
            why: marcaDaOrigem(pacote.porQue?.origem),
            impact: marcaDaOrigem(pacote.impacto?.origem),
            touches: marcaDaOrigem(pacote.oQueSeraTocado?.origem),
            risk: marcaDaOrigem(pacote.risco?.origem),
            tool: marcaDaOrigem(pacote.ferramenta?.origem),
            agentSaid: marcaDaOrigem(pacote.agenteDisse?.origem)
        }
    };
}
const MAPA_DE_RESPOSTA = {
    aprovado: 'approved',
    recusado: 'rejected',
    'aprovado com observacao': 'noted'
};
function traduzirDecisao(doc, agora = new Date()) {
    const resposta = MAPA_DE_RESPOSTA[semAcento(doc.resposta ?? '')];
    if (!resposta)
        return null;
    const quando = paraData(doc.respondidoEm);
    return {
        id: doc.id,
        title: doc.pacote?.oQue?.valor?.trim() || doc.pacote?.resumo?.valor?.trim() || 'Pedido sem descrição',
        resposta,
        observacao: doc.observacao?.trim() || null,
        respondidoEm: quando,
        quando: quando ? (0, formato_1.dataAmigavel)(quando, agora) : 'sem hora na base',
        respondidoPor: doc.respondidoPor?.trim() || null
    };
}
function ordenarDecisoes(lista) {
    /* Resposta mais recente primeiro: no histórico, o que acabou de acontecer é o
       que o diretor procura. */
    return [...lista].sort((a, b) => (b.respondidoEm?.getTime() ?? 0) - (a.respondidoEm?.getTime() ?? 0));
}
function ordenarAprovacoes(lista) {
    /* Mais antiga primeiro, como o deck manda. Nunca reordenar por risco. */
    return [...lista].sort((a, b) => (a.requestedAt?.getTime() ?? 0) - (b.requestedAt?.getTime() ?? 0));
}
function aprovacaoPendente(doc) {
    return semAcento(doc.situacao ?? 'pendente') === 'pendente' && !doc.resposta;
}
/* Relato da ferramenta do Claude Code, em português. O nome cru da ferramenta é
   fato e aparece junto, no evento; a frase é só a tradução dele. */
const RELATO_DA_FERRAMENTA = {
    bash: 'Rodou um comando no terminal',
    powershell: 'Rodou um comando no PowerShell',
    read: 'Leu um arquivo',
    write: 'Escreveu um arquivo',
    edit: 'Alterou um arquivo',
    multiedit: 'Alterou um arquivo em vários pontos',
    glob: 'Procurou arquivos pelo nome',
    grep: 'Procurou um trecho nos arquivos',
    task: 'Delegou uma tarefa a um subagente',
    agent: 'Delegou uma tarefa a um subagente',
    todowrite: 'Atualizou a lista de tarefas',
    webfetch: 'Buscou uma página na internet',
    websearch: 'Pesquisou na internet',
    notebookedit: 'Alterou um caderno de notas',
    skill: 'Carregou uma habilidade',
    toolsearch: 'Procurou uma ferramenta'
};
function textoOuNulo(valor) {
    return typeof valor === 'string' && valor.trim().length > 0 ? valor.trim() : null;
}
function primeiraLinha(texto, limite = 160) {
    const limpo = texto.replace(/\s+/g, ' ').trim();
    return limpo.length > limite ? limpo.slice(0, limite - 1) + '…' : limpo;
}
/* Texto que a ponte grava quando o projeto não estava liberado para conteúdo. */
function semConteudo(valor) {
    return valor !== null && /^conteudo nao publicado/i.test(valor);
}
const AVISO_SEM_CONTEUDO = 'O texto não foi gravado: quando este passo aconteceu, o projeto não estava liberado para conteúdo.';
function linhaDeFerramenta(doc, base) {
    const nome = textoOuNulo(doc.ferramenta) ?? textoOuNulo(doc.toolInfo?.name) ?? 'ferramenta';
    const chave = nome.toLowerCase();
    const chamado = textoOuNulo(doc.agenteChamado);
    let titulo = RELATO_DA_FERRAMENTA[chave] ??
        (nome.startsWith('mcp__') ? `Usou a ferramenta externa ${nome.split('__').slice(1).join(' ')}` : `Usou ${nome}`);
    if ((chave === 'agent' || chave === 'task') && chamado)
        titulo = `Delegou uma tarefa ao subagente ${chamado}`;
    const parametros = doc.toolInfo?.parameters;
    let detalhe = textoOuNulo(doc.alvo);
    if (!detalhe && parametros && typeof parametros === 'object') {
        for (const chaveP of ['command', 'file_path', 'path', 'pattern', 'url']) {
            const v = textoOuNulo(parametros[chaveP]);
            if (v) {
                detalhe = v;
                break;
            }
        }
    }
    return {
        ...base,
        tipo: 'ferramenta',
        evento: `Ferramenta ${nome}`,
        titulo: base.erro ? `${titulo}, e a ferramenta devolveu erro` : titulo,
        detalhe: detalhe ? primeiraLinha(detalhe, 400) : null,
        texto: textoOuNulo(doc.descricao)
    };
}
function traduzirPasso(doc) {
    const quando = paraData(doc.anotadoEm ?? null) ?? paraData(doc.em);
    const erro = doc.erro === true || String(doc.estado ?? '').toUpperCase() === 'ERROR';
    const agente = textoOuNulo(doc.agente);
    const descricao = textoOuNulo(doc.descricao);
    const base = {
        id: doc.id,
        quando,
        seq: typeof doc.seq === 'number' ? doc.seq : 0,
        detalhe: null,
        texto: null,
        agente,
        semRegistroDeAgente: !Object.prototype.hasOwnProperty.call(doc, 'agente'),
        agenteChamado: textoOuNulo(doc.agenteChamado),
        ferramenta: textoOuNulo(doc.ferramenta) ?? textoOuNulo(doc.toolInfo?.name),
        erro,
        doDiretor: false,
        situacao: null
    };
    const evento = textoOuNulo(doc.evento);
    const tipo = String(doc.tipo ?? '');
    /* Fábrica aberta na MÃO: a fila de ganchos grava o evento do Claude Code. */
    if (evento) {
        switch (evento) {
            case 'SessionStart':
                return {
                    ...base,
                    tipo: 'inicio',
                    evento: 'Início',
                    titulo: /origem resume/i.test(descricao ?? '') ? 'Sessão retomada na mão pelo diretor' : 'Sessão aberta na mão pelo diretor',
                    detalhe: descricao
                };
            case 'UserPromptSubmit':
                /* Achado da prova da OST 10: quando um subagente roda em segundo plano,
                   o próprio Claude Code entrega o aviso de "terminou" como se fosse um
                   prompt. Isso NÃO é ordem do diretor e não pode aparecer como "Você
                   mandou". */
                if (descricao !== null && /^\s*<(task-notification|system-reminder)>/i.test(descricao)) {
                    return {
                        ...base,
                        tipo: 'aviso',
                        evento: 'Aviso automático',
                        titulo: /task-notification/i.test(descricao)
                            ? 'O Claude Code avisou a fábrica que uma tarefa em segundo plano terminou. Não foi você quem mandou.'
                            : 'O Claude Code mandou um lembrete automático à fábrica. Não foi você quem mandou.',
                        texto: descricao
                    };
                }
                return {
                    ...base,
                    tipo: 'ordem',
                    evento: 'Sua ordem',
                    titulo: 'Você mandou',
                    texto: semConteudo(descricao) ? AVISO_SEM_CONTEUDO : descricao,
                    doDiretor: true
                };
            case 'PostToolUse':
                return linhaDeFerramenta(doc, base);
            case 'SubagentStart':
                return { ...base, tipo: 'subagente', evento: 'Subagente', titulo: `O subagente ${agente ?? 'sem nome'} começou` };
            case 'SubagentStop':
                return {
                    ...base,
                    tipo: 'subagente',
                    evento: 'Subagente',
                    titulo: `O subagente ${agente ?? 'sem nome'} terminou`,
                    texto: textoOuNulo(doc.resposta)
                };
            case 'Stop': {
                const resposta = textoOuNulo(doc.resposta);
                return {
                    ...base,
                    tipo: 'resposta',
                    evento: 'Resposta',
                    titulo: resposta
                        ? 'A fábrica respondeu e parou, esperando a próxima ordem'
                        : 'A fábrica terminou a rodada e espera a próxima ordem. O texto da resposta não foi gravado neste passo.',
                    texto: resposta
                };
            }
            case 'SessionEnd':
                return {
                    ...base,
                    tipo: 'fim',
                    evento: 'Fim',
                    titulo: 'Sessão encerrada',
                    detalhe: descricao && descricao !== 'sessao encerrada' ? descricao : null
                };
            case 'Notification':
                return {
                    ...base,
                    tipo: 'aviso',
                    evento: 'Aviso',
                    titulo: 'O Claude Code avisou',
                    texto: semConteudo(descricao) ? AVISO_SEM_CONTEUDO : descricao
                };
            default:
                return { ...base, tipo: 'passo', evento, titulo: `Evento ${evento}`, texto: descricao };
        }
    }
    /* Fábrica aberta pelo PAINEL: a ponte grava o que o kit do Claude Code entrega. */
    switch (tipo) {
        case 'init':
            return { ...base, tipo: 'inicio', evento: 'Início', titulo: 'A ponte abriu a sessão no Claude Code', detalhe: descricao };
        case 'texto':
        case 'agent_response': {
            const t = descricao ?? textoOuNulo(doc.textoDelta);
            return {
                ...base,
                tipo: 'resposta',
                evento: 'Resposta',
                titulo: t ? 'A fábrica escreveu' : 'A fábrica escreveu uma resposta. O texto não era gravado antes da OST 10.',
                texto: t
            };
        }
        case 'pensamento':
            return { ...base, tipo: 'pensamento', evento: 'Raciocínio', titulo: 'Pensou antes de agir. O raciocínio não é gravado.' };
        case 'ferramenta':
        case 'tool':
            return linhaDeFerramenta(doc, base);
        case 'resultado':
            return { ...base, tipo: 'resultado', evento: 'Resultado', titulo: 'Recebeu o resultado da ferramenta' };
        case 'fim':
        case 'checkpoint': {
            const falhou = descricao !== null && descricao !== 'success';
            return {
                ...base,
                tipo: 'fim',
                evento: 'Fim da rodada',
                titulo: descricao === null
                    ? 'Terminou a rodada'
                    : falhou
                        ? `Terminou a rodada com falha (${descricao})`
                        : 'Terminou a rodada com sucesso',
                erro: base.erro || falhou
            };
        }
        case 'user_input':
            return { ...base, tipo: 'ordem', evento: 'Sua ordem', titulo: 'Você mandou', texto: textoOuNulo(doc.textoDelta), doDiretor: true };
        default:
            return {
                ...base,
                tipo: 'passo',
                evento: tipo || 'Passo',
                titulo: `Passo do tipo ${tipo || 'não informado'}`,
                texto: descricao
            };
    }
}
const ORDEM_POR_ACAO = {
    abrir: 'Você abriu a fábrica com esta ordem',
    comando: 'Você mandou',
    pausar: 'Você pausou a fábrica',
    reiniciar: 'Você mandou reiniciar a fábrica',
    encerrar: 'Você encerrou a fábrica'
};
/* A ordem do diretor pelo painel, lida da própria fila de comandos. */
function traduzirComando(doc) {
    const acao = semAcento(doc.acao ?? 'comando');
    const situacao = semAcento(doc.situacao ?? '');
    const comTexto = acao === 'abrir' || acao === 'comando';
    return {
        id: `comando-${doc.id}`,
        quando: paraData(doc.criadoEm),
        seq: -1,
        tipo: 'ordem',
        evento: 'Sua ordem',
        titulo: ORDEM_POR_ACAO[acao] ?? `Você mandou a ordem ${doc.acao ?? ''}`.trim(),
        detalhe: null,
        texto: comTexto ? textoOuNulo(doc.texto) : null,
        agente: null,
        semRegistroDeAgente: false,
        agenteChamado: null,
        ferramenta: null,
        erro: false,
        doDiretor: true,
        situacao: situacao === 'entregue' ? 'entregue à ponte' : situacao === 'pendente' ? 'ainda não entregue à ponte' : null
    };
}
/*
 * A ordem de execução, do mais ANTIGO para o mais NOVO, e o sentido é este em
 * toda a tela. Cada ordem do diretor abre um bloco com o que veio em resposta a
 * ela, até a próxima ordem.
 *
 * `completo` diz se o histórico inteiro da atividade está carregado. Quando não
 * está, as ordens mais antigas que o passo mais antigo carregado ficam de fora,
 * para não aparecer ordem sem o que veio depois dela.
 */
function montarAtividade(passos, comandos, completo) {
    const traduzidos = passos.map(traduzirPasso);
    let maisAntigo = null;
    for (const l of traduzidos) {
        const t = l.quando?.getTime();
        if (t !== undefined && (maisAntigo === null || t < maisAntigo))
            maisAntigo = t;
    }
    const ordens = comandos
        .map(traduzirComando)
        .filter((o) => completo || maisAntigo === null || (o.quando !== null && o.quando.getTime() >= maisAntigo));
    /* Fábrica aberta pelo painel: cada comando retoma a mesma conversa e grava um
       novo início. Do segundo em diante, a frase certa é "retomou". */
    const inicios = traduzidos
        .filter((l) => l.tipo === 'inicio' && l.titulo === 'A ponte abriu a sessão no Claude Code')
        .sort((a, b) => (a.quando?.getTime() ?? 0) - (b.quando?.getTime() ?? 0));
    for (const l of inicios.slice(1))
        l.titulo = 'A ponte retomou a sessão no Claude Code';
    const linhas = [...traduzidos, ...ordens].sort((a, b) => {
        const ta = a.quando?.getTime() ?? 0;
        const tb = b.quando?.getTime() ?? 0;
        if (ta !== tb)
            return ta - tb;
        if (a.doDiretor !== b.doDiretor)
            return a.doDiretor ? -1 : 1;
        return a.seq - b.seq;
    });
    const blocos = [];
    for (const l of linhas) {
        if (l.doDiretor)
            blocos.push({ ordem: l, passos: [] });
        else if (blocos.length === 0)
            blocos.push({ ordem: null, passos: [l] });
        else
            blocos[blocos.length - 1].passos.push(l);
    }
    return { linhas, blocos };
}
/* Frase curta: o que a linha diz, com o começo do texto quando há texto. */
function resumoDaLinha(l) {
    return l.texto && l.tipo !== 'ferramenta' ? `${l.titulo}: ${primeiraLinha(l.texto, 120)}` : l.titulo;
}
function horaDaLinha(l) {
    return (0, formato_1.horaComSegundos)(l.quando);
}
function traduzirTarefa(doc, agora = new Date()) {
    const criada = paraData(doc.criadaEm);
    const atualizada = paraData(doc.atualizadaEm);
    const fim = doc.situacao && semAcento(doc.situacao) !== 'em andamento' ? atualizada : null;
    const base = criada ? ((fim ?? agora).getTime() - criada.getTime()) : null;
    return {
        id: doc.id,
        title: doc.titulo?.trim() || 'Tarefa sem título',
        state: traduzirSituacaoDeTarefa(doc.situacao),
        startedAt: criada,
        elapsed: base == null ? '' : (0, formato_1.tempoDecorrido)(base)
    };
}
const PESO_DA_TAREFA = {
    approval: 0,
    failed: 1,
    running: 2,
    idle: 3,
    offline: 4,
    done: 5
};
function ordenarTarefas(lista) {
    return [...lista].sort((a, b) => {
        const peso = PESO_DA_TAREFA[a.state] - PESO_DA_TAREFA[b.state];
        if (peso !== 0)
            return peso;
        return (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0);
    });
}
function indicadoresDaPonte(ponte) {
    return ponte.maquinas.map((m) => ({
        online: m.online,
        label: fraseDaMaquina(m),
        detail: m.online ? undefined : (0, formato_1.desdeQuando)(m.atrasoMs),
        machine: [m.rotulo, m.nome, m.versao ? `versão ${m.versao}` : null].filter(Boolean).join(', ') || undefined
    }));
}
