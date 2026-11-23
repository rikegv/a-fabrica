# Conserto das travas do settings.json

Agente: coordenador, §A.15. Rodada de diagnóstico do PC novo, 2026-11-22. Só proposta: nada foi aplicado no `.claude/settings.json`. Quem aplica é o diretor.

## Atualização da OST 9, 2026-11-23: APLICADO, e com uma correção ao diagnóstico

Por ordem do diretor na OST 9, o trecho corrigido abaixo foi aplicado no `.claude/settings.json`, com cópia antes, em `C:\Users\Henrique\a-fabrica-lab\rodadas\2026-11-22T2330-ost9-noite\copias\settings.json.antes`. A escrita saiu por script, porque a ferramenta de arquivo está negada para esse caminho, de propósito. É o caminho indireto que o §A.7 declara, usado por ordem expressa e registrado aqui.

As três conferências deste documento:

1. **O aviso sumiu.** Antes, cinco linhas na abertura; depois, nenhuma. Arquivos `aviso-antes.err` e `aviso-depois.err` na evidência da rodada.
2. **A edição do gate foi recusada** pela ferramenta de arquivo, assim como a do `settings.json` e a escrita em `.claude/state`.
3. **Com a sessão dentro de `ponte/`, as três recusas se repetiram.**

A correção, que vale mais do que o conserto: **a seção "Um segundo defeito, mais sério" abaixo estava errada no caso que ela descreve.** O laboratório da rodada abriu sessões do Claude Code sem interação, em modo de aceitar edições, num projeto falso, com um controle sem negação nenhuma. Resultado:

| Caso | Regra antiga, sem barra | Regra nova, com barra | Caminho absoluto | Sem negação (controle) |
|---|---|---|---|---|
| A. Sessão aberta na raiz | recusou | recusou | recusou | editou |
| B. Sessão na raiz, depois `cd ponte` | **recusou** | recusou | recusou | editou |
| C. Sessão **aberta** dentro de `ponte/` | editou | **editou** | **editou** | editou |

- **Caso B:** a "pasta atual" das regras é a pasta onde a sessão foi aberta, não a que o terminal visitou depois. A regra antiga já pegava. O que o diagnóstico de ontem afirmou não acontece.
- **Caso C:** é o furo de verdade, e ele **não se fecha com regra de projeto nenhuma**, nem com barra, nem com caminho absoluto. Uma sessão aberta numa subpasta não carrega o `.claude/settings.json` da raiz, e isso vale também para o gancho do gate.

O conserto com barra fica, porque é a forma que a documentação manda e porque tirou o aviso. Mas ele não muda a proteção em nenhum dos três casos.

Proposto ao diretor, não feito: para o caso C, a proteção teria de morar na configuração **geral** do Claude Code, em `~/.claude/settings.json`, com caminho absoluto. Pelo §A.9 isso é só acrescentar e, por ser a configuração dele, é decisão dele. Até lá, a regra prática é: abrir o Claude Code sempre na raiz do projeto. A ponte já abre as fábricas na pasta do projeto escolhida, e as dela nem carregam `settings.json`, porque quem segura o risco nelas é o portão.

## O aviso

O Claude Code 2.1.330, ao abrir, avisou que cinco regras de negação nunca casam:

```
Write(.claude/state/PROD_*)
Write(.claude/state/**)
Write(scripts/gate-deploy.sh)
Write(scripts/autorizar-producao.sh)
Write(.claude/settings.json)
```

## A causa, conforme a documentação oficial

Fonte: https://code.claude.com/docs/en/permissions.md, seção "Read and Edit", subseção "`Write(path)`, `Glob(path)`, and `Grep(path)` rules don't match":

> "Claude Code checks file permissions against `Edit(path)` and `Read(path)` rules. It accepts a rule with a path other than `*` for one of the tools below but doesn't match a read, search, or edit against it."
>
> "`Write`, `NotebookEdit`, or legacy `MultiEdit`: use `Edit(docs/**)` in place of `Write(docs/**)`."

E, na mesma página: "`Edit` rules apply to all built-in tools that edit files." A referência de ferramentas (https://code.claude.com/docs/en/tools-reference.md) confirma que `Edit(...)` cobre Edit, Write e NotebookEdit.

Em português: a regra `Write(caminho)` é aceita no arquivo, mas o Claude Code nunca a consulta. Quem trava a ferramenta Write é a regra `Edit(caminho)`. As cinco linhas `Write(...)` eram enfeite. A proteção existia de fato, porque cada uma delas tem a irmã `Edit(...)` logo ao lado, e é ela que barrou a fábrica na OST 7.

Não achei no registro de mudanças a entrada exata que criou esse aviso. As versões 2.1.326 a 2.1.330 falam de "hook matchers that never match" e de aviso na abertura para ferramentas mal escritas, mas não citam `Write(...)`. O comportamento em si está documentado, o que falta é só a data em que o aviso nasceu.

## Um segundo defeito, mais sério, que o aviso não mostra

Fonte: a mesma página, "How path patterns match". O padrão de caminho segue a sintaxe do gitignore, com quatro formas:

| Forma | Significa |
|---|---|
| `//caminho` | absoluto, a partir da raiz do disco |
| `~/caminho` | a partir da pasta do usuário |
| `/caminho` | relativo à origem da configuração; no `.claude/settings.json` do projeto, à pasta de trabalho principal |
| `caminho` ou `./caminho` | relativo à pasta ATUAL |

Todas as nossas regras estão na última forma, sem barra na frente. Ou seja, `Edit(scripts/gate-deploy.sh)` quer dizer "scripts/gate-deploy.sh dentro da pasta em que a sessão está agora". Se a sessão muda de pasta, por exemplo para `ponte/`, a regra passa a apontar para `ponte/scripts/gate-deploy.sh`, que não existe, e o gate verdadeiro fica sem trava. Isso aconteceu nesta mesma rodada: a pasta de trabalho da sessão mudou para `ponte` durante a leitura e depois voltou.

A forma certa para proteger um arquivo do projeto é com uma barra na frente: `Edit(/scripts/gate-deploy.sh)`. A barra ancora na pasta do projeto, não na raiz do disco.

Ressalva da própria documentação: a barra ancora na pasta de trabalho principal da sessão. Se o Claude Code for aberto a partir de uma subpasta do projeto, a âncora vai junto. A ponte abre as fábricas na raiz do projeto, e o diretor abre na raiz também, então isso fica coberto na prática.

## Trecho atual do settings.json

```json
    "deny": [
      "Write(.claude/state/PROD_*)",
      "Edit(.claude/state/PROD_*)",
      "Write(.claude/state/**)",
      "Edit(.claude/state/**)",
      "Write(scripts/gate-deploy.sh)",
      "Edit(scripts/gate-deploy.sh)",
      "Write(scripts/autorizar-producao.sh)",
      "Edit(scripts/autorizar-producao.sh)",
      "Write(.claude/settings.json)",
      "Edit(.claude/settings.json)"
    ]
```

## Trecho corrigido, pronto para colar

Substitui o bloco `"deny": [ ... ]` inteiro. O resto do arquivo fica igual.

```json
    "deny": [
      "Edit(/.claude/state/PROD_*)",
      "Edit(/.claude/state/**)",
      "Edit(/scripts/gate-deploy.sh)",
      "Edit(/scripts/autorizar-producao.sh)",
      "Edit(/.claude/settings.json)"
    ]
```

## Cada mudança, explicada

1. **As cinco linhas `Write(...)` saem.** Não protegiam nada, e a documentação manda usar `Edit(...)` no lugar. Tirar não abre buraco: a `Edit(...)` já cobria a ferramenta Write antes, e continua cobrindo.
2. **As cinco linhas `Edit(...)` ganham uma barra na frente do caminho.** Passam a valer para o arquivo do projeto, qualquer que seja a pasta em que a sessão esteja naquele momento. Antes valiam só enquanto a sessão estivesse na raiz.
3. **`Edit(/.claude/state/PROD_*)` fica, mesmo sendo coberta por `Edit(/.claude/state/**)`.** Não muda o efeito. Fica para que quem lê o arquivo veja, escrito, que a autorização de produção é o alvo principal.
4. **Nada é acrescentado.** Escopo fechado, §A.12.

## O que este conserto NÃO resolve, dito sem maquiagem

Fonte: permissions.md, aviso da seção "Read and Edit":

> "Read and Edit deny rules apply to Claude's built-in file tools. In a Bash command Claude Code can analyze, they also apply to redirection targets and to file commands it recognizes, such as `cat`, `head`, `tail`, `sed`, and `tee`."
>
> "They also don't apply to arbitrary subprocesses that read or write files indirectly, like a Python or Node script that opens files itself."

A negação pega a ferramenta de arquivo e o redirecionamento óbvio no terminal. Não pega um script da fábrica que abre o arquivo por conta própria. Quem fecha esse caminho hoje é o `gate-deploy.sh`, que barra toda linha de comando que cite `PROD_` ou `autorizar-producao`. Continua valendo o limite declarado no §A.7: é disciplina com campainha, não parede.

A documentação indica a caixa de areia do Claude Code (sandbox) como trava no nível do sistema operacional para comandos de terminal. Fica como proposta ao diretor, não construída.

## Proteção que já vem de fábrica

Fonte: https://code.claude.com/docs/en/permission-modes.md, "Protected paths". A pasta `.claude` é protegida pelo próprio Claude Code: no modo padrão, escrita nela pede confirmação; no modo automático, vai para o classificador decidir; no modo de contornar permissões, passa. A pasta `scripts/` NÃO é protegida de fábrica: o gate e o script de autorização dependem só das nossas regras de negação. Mais um motivo para a barra na frente.

## Para conferir depois de aplicar

1. Fechar e abrir o Claude Code na raiz do projeto. O aviso das cinco regras não pode aparecer.
2. Pedir à fábrica para editar `scripts/gate-deploy.sh` com a ferramenta de arquivo. Tem de vir recusa.
3. Repetir o passo 2 com a sessão parada em `ponte/`. Tem de vir recusa também. Antes do conserto, pela documentação, não viria. Isso não foi testado nesta rodada, que era só de leitura.
