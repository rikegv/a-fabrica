# OST 15, contrato entre ponte e painel

Escrito pelo coordenador em 25/11/2026, antes de despachar o time. É a fonte única do que a ponte grava e do que o painel lê nesta OST. Nada de regra nova, nada de índice novo, nada publicado: a regra atual já aceita campo novo em `maquinas` e em `fabricas`.

## Item 1, o nome da sessão

### De onde vem
O Claude Code grava o nome na transcrição da sessão, `~/.claude/projects/<pasta>/<sid>.jsonl`, em linhas próprias. Conferido em transcrição real:
- `{"type":"custom-title","customTitle":"...","sessionId":"..."}`: o nome que o diretor deu, por `/rename` ou `--name`. Se houver mais de uma linha, vale a última.
- `{"type":"ai-title","aiTitle":"...","sessionId":"..."}`: o título que o próprio Claude Code dá quando a sessão não tem nome. O app do Claude mostra esse título.

### Decisão do coordenador
O "nome que aparece no app" é `customTitle` quando existir e `aiTitle` quando não. A fábrica só fica "Fábrica externa" sem nenhum dos dois. Se o diretor renomear no painel, vale o do painel (`nomeDado`, o campo que já existe).

### Prioridade na tela
1. `nomeDado`: renomeada no painel;
2. `nomeDaSessao`: o customTitle;
3. `tituloDaSessao`: o aiTitle;
4. "Fábrica externa", com a regra de hora que já existe.

### O que a PONTE grava
Na fábrica aberta na mão (`mao-<sid>`):
- `nomeDaSessao`: texto ou null, do último `custom-title` da transcrição;
- `tituloDaSessao`: texto ou null, do último `ai-title`;
- `nomeDaSessaoLidoEm`: hora do servidor, a mesma de `atualizadoEm`, se for prático.

Os campos só são escritos quando mudam.

Como lê:
- reaproveita o caminho de transcrição já aceito, `caminhoDeTranscricaoAceito` da OST 13: dentro de `~/.claude/projects`, `.jsonl`, nome igual ao sid;
- lê só as linhas que começam com `{"type":"custom-title"` ou `{"type":"ai-title"`;
- respeita o mesmo teto de leitura da OST 13;
- aplica a máscara de credencial;
- corta em `TETO_NOME`, o mesmo do painel;
- projeto ignorado não tem nada.

O nome é CONTEÚDO, não metadado. O `customTitle` é texto do diretor e o `aiTitle` resume a conversa. Correção pedida pela segurança na revisão do desenho. Ele só é lido quando a linha do gancho que disparou a leitura vem com `conteudo === true`, e quem decide isso é o gancho, §A.23. As condições completas da segurança estão na seção abaixo.

## Revisão do desenho pela segurança
Aprovado com condições, sem veto. Resumo:
1. **Quando ler:** só com `conteudo === true` na linha.
2. **Projeto ignorado:** conferir `projetoIgnorado()` na hora, com falha fechada.
3. **Caminho:** passar por `caminhoDeTranscricaoAceito` e abrir só para leitura.
4. **Conferência da linha:** `JSON.parse` em cada linha, conferindo `type`, o tipo string do campo e o `sessionId`.
5. **Limpeza do valor:** tirar `\p{Cc}` e `\p{Cf}`, juntar espaços, mascarar e cortar em 80.
6. **Leitura:** incremental, com teto de 8 MB.
7. **Onde o título não vai:** nem em registro, nem em erro, nem em marca.
8. **Prova:** cobre esses casos.
9. **`config.json`:**
   - guardar cópia antes;
   - preservar todas as chaves;
   - conferir a permissão da pasta com `icacls`;
   - nunca mostrar a `apiKey`.
10. **`rotulo`:**
    - validado com no máximo 40 caracteres, e o inválido vira null;
    - `PONTE_ROTULO` não se mistura com `PONTE_ROTULO_TESTE`.
11. **Isolamento entre pontes:** provar que uma fábrica de outra máquina não muda. Nenhum código novo grava `maquinaId` em fábrica que já tem outro dono.
12. **Painel:** o nome entra só como texto do React, com corte em 80, e tolera campo ausente.

Limites declarados ao diretor:
- os nomes ficam na trilha;
- não há isolamento real entre pontes com a conta única;
- as pontes Linux precisariam da credencial do diretor fora do notebook, o que esbarra no §A.25.

Veto automático se a implementação furar a leitura sem `conteudo`, o caminho sem conferência, a preservação do `config.json` ou a gravação de `maquinaId` alheio.

Quando lê: na primeira vez que vê a sessão, e de novo a cada `Stop` e `UserPromptSubmit`, porque o `/rename` pode vir a qualquer hora. Não pode ler a transcrição inteira a cada passo.

## Itens 2 e 3, várias pontes, cada uma com o seu estado e o seu rótulo

### Documento `maquinas/{maquinaId}`
O que já existe continua: `estadoPonte`, `vistoPorUltimo` do servidor e `nome`.

Campo novo: `rotulo`, texto curto que diz onde a máquina está, para o diretor ler. Valores combinados: `Notebook`, `Nuvem`, `Escritório`.
- A ponte lê o rótulo da configuração, a chave `rotulo` no `config.json` dela, ou da variável de ambiente `PONTE_ROTULO`, que vale mais.
- Sem configuração, a ponte grava `rotulo: null` e o painel mostra o `nome` da máquina.
- Na ponte do notebook, a chave `rotulo: "Notebook"` é ACRESCENTADA ao `%USERPROFILE%\.a-fabrica-ponte\config.json`, sem mexer em mais nada do arquivo, §A.9.
- As pontes da nuvem e do escritório são Linux e a fábrica da nuvem está construindo, §A.25. Aqui só se escreve o contrato: elas gravam `rotulo` igual. O notebook não mexe em nada de Linux nem em instalador.

### Uma ponte não derruba o estado da outra
- **Ponte:** a reconciliação na subida, e qualquer marcação de "ponte offline", só toca fábrica com `maquinaId` igual ao da própria ponte. O agente ponte confere isso no código e prova. Se já for assim, diz que já era e mostra onde.
- **Painel:**
  - o estado de "ponte offline" de cada fábrica sai do sinal de vida da máquina DELA, `maquinas[fabrica.maquinaId]`, e não da "melhor" máquina;
  - fábrica sem `maquinaId`, que é dado antigo, usa a regra de hoje;
  - o indicador geral de ponte mostra cada máquina com o seu estado, "Notebook conectada, Nuvem offline", em vez de um estado só.

### O cartão diz a máquina
Cada cartão de fábrica, tanto na visão geral quanto nas fechadas e no celular, e a linha fina do topo da fábrica mostram onde ela roda, em palavras simples: o `rotulo` da máquina dela. Sem rótulo, mostram o `nome`. Sem máquina conhecida, não mostram nada. Nada de travessão, §A.11.

## Fora de alcance
`ponte/ganchos/**`, `ponte/instalar.ps1`, `ponte/ganchos/ligar.ps1`, qualquer coisa de Linux, regra e índices do Firestore, publicação.

## Convivência
A fábrica da nuvem trabalha na ponte em Linux, provavelmente em `ponte/src` no ramo `nuvem/...`. A mudança daqui tem de ser pequena e localizada, para o merge ser simples.
