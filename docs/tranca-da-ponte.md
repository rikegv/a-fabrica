# A tranca da pasta da ponte, investigação de 23/11/2026

Agente: coordenador, sozinho, nesta máquina (PC novo, `SOULAN`). Tudo abaixo foi medido aqui, com leitura da pasta real e com pastas de teste novas criadas no scratchpad da sessão. Nenhuma permissão da pasta real foi alterada durante a investigação.

## Resposta curta

É o **CASO A**. A tranca deveria funcionar, o Windows entrega o que a conferência exige, e o defeito está no instalador: ele confia que `icacls /inheritance:r` remove as entradas herdadas, e neste PC esse comando, do jeito que o perfil foi criado, **copia** as entradas em vez de remover.

**Não é política de domínio.** A conta não é de domínio. O diretor não depende de ninguém.

A conferência está certa e continua como está.

## A premissa da conta de domínio não se confirma

O nome `Soulan\Henrique` parece conta de domínio, mas é conta local de uma máquina que se chama `SOULAN`:

| Conferência | Resultado |
|---|---|
| `Win32_ComputerSystem.PartOfDomain` | `False`, grupo de trabalho `WORKGROUP` |
| Nome do computador | `SOULAN`, igual ao "domínio" que aparece no nome |
| `Get-LocalUser Henrique` | existe como usuário local |
| SID do usuário | `S-1-5-21-3514902318-1198954765-3932053677-1002`, final 1002, típico de conta local |
| `whoami /groups` | contém `Conta local e membro do grupo de Administradores` (S-1-5-114) |

Como o Windows escreve o nome da máquina na frente do usuário local, o `icacls` mostra `Soulan\Henrique`.

## A causa de verdade

O `icacls /inheritance:r` só remove as entradas herdadas quando a lista de acesso do objeto traz a marca de herança automática (o `AI` da SDDL). Quando ela não traz essa marca, o comando quebra a herança e transforma as entradas herdadas em entradas próprias, igual ao `/inheritance:d`. E diz "Processados com sucesso" nos dois casos.

A raiz está no perfil deste PC. A pasta `C:\Users\Henrique` está protegida, mas **sem** a marca `AI`:

```
C:\Users\Henrique   D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;FA;;;<Henrique>)...
```

Tudo que nasce direto embaixo dela herda SISTEMA, Administradores e Henrique, também sem a marca `AI`. É o caso da `.a-fabrica-ponte`. O `/inheritance:r` então vira cópia, e as duas entradas viram próprias (sem `(I)`), que é exatamente o que apareceu no terminal do diretor:

```
.a-fabrica-ponte    D:PAI(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;FA;;;<Henrique>)
```

O `config.json` herda as duas da pasta (por isso aparece com `(I)`). O `sessao.json` trancou porque ele nasce dentro da pasta, já com a marca `AI`, e aí o `/inheritance:r` funciona como o manual diz.

No PC antigo, a mesma sequência deixou só o usuário (registrado em `docs/ost6-ponte.md`), o que bate com o perfil daquele PC ter a marca. O nome da máquina também era outro, `DESKTOP-5LR6BRG`.

### As provas, todas em pastas novas

| Teste | Resultado |
|---|---|
| Pasta nova sem marca `AI`, `/inheritance:r` | cópia: SISTEMA e Administradores viram entradas próprias |
| A mesma coisa chamando o `icacls` pelo Node, como a ponte faz | cópia, igual |
| Arquivo novo sem marca `AI`, `/inheritance:r` e `/grant:r` | cópia, igual |
| Pasta nova com marca `AI`, `/inheritance:r` | remove de verdade, lista vazia |
| Arquivo novo com marca `AI` (a situação do `sessao.json`) | remove de verdade, fica só Henrique |
| Pasta sem marca, `/inheritance:r` e depois `/remove` de SISTEMA e Administradores | fica só Henrique |
| Arquivo criado depois nessa pasta | herda só Henrique |
| Arquivo que já existia, depois que a pasta é limpa | o Windows propaga e ele fica só com Henrique |
| API do .NET, proteger sem copiar | remove de verdade |

Versão do `icacls` nesta máquina: 10.0.26100.9949.

Conclusão: o sistema operacional **deixa** tirar SISTEMA e Administradores da lista de acesso da pasta. A conferência pede uma coisa possível. Quem não entregou foi o instalador.

## O conserto

O instalador e a ponte deixam de confiar no efeito do `/inheritance:r`. Depois de quebrar a herança e dar acesso ao dono, leem a lista de acesso e removem, uma a uma e por nome, toda identidade que não seja o dono. Depois disso a conferência roda igual a antes e decide. Se alguma coisa sobrar, a ponte continua recusando subir.

Isso funciona com e sem a marca `AI`, então serve para este PC, para o antigo e para o próximo.

## O que a tranca protege, e o que não protege

Isto é o que vale para qualquer Windows, mesmo com a tranca de pé, e o diretor precisa saber:

**Protege contra**
- outra conta comum desta máquina, que não consegue ler o `sessao.json`;
- processo de outro usuário sem elevação;
- herança acidental: arquivo novo que o SDK grava na pasta nasce só com o dono.

**Não protege contra**
- **o próprio usuário e tudo que roda como ele**, inclusive as fábricas. É o mesmo limite declarado no §A.7: a fábrica roda como o diretor e lê o que ele lê;
- **administrador com elevação**. Tirar Administradores da lista não tira o poder de administrador: ele pode tomar posse do arquivo e mudar a lista. Como o diretor é administrador desta máquina, qualquer programa que ele rodar como administrador alcança a chave;
- **o SISTEMA e quem tem privilégio de cópia de segurança**, que leem por cima da lista de acesso. Isso inclui o antivírus e ferramentas de backup.

Ou seja, a tranca é real contra outras contas e contra acidente, e é só um obstáculo contra administrador. Separação de verdade contra administrador e contra a própria fábrica só existe fora desta máquina, como o §A.7 já registra.

## Efeito colateral de tirar o SISTEMA

A ponte roda como tarefa agendada no logon, com a conta do diretor, não como SISTEMA. Então ela não perde acesso. O agendador de tarefas não precisa ler a pasta. Antivírus e backup leem por privilégio próprio. Não encontrei nada nesta máquina que dependa de SISTEMA ter entrada nessa pasta.

## Conserto aplicado nesta rodada

Arquivos alterados, todos pelo coordenador:

- `ponte/src/protecaoSessao.ts`: `aplicarProtecao` quebra a herança, dá acesso ao dono (com `(OI)(CI)` quando é pasta) e depois remove por nome toda identidade que não seja o dono. A conferência não mudou.
- `ponte/src/config.ts`: `protegerPastaLocal` passa a usar `aplicarProtecao`, em vez de ter a sua própria sequência de `icacls`.
- `ponte/src/entrar.ts`: a conferência feita na instalação passa a exigir herança quebrada na pasta, igual ao serviço já exigia ao subir (`ponte.ts`). Antes a instalação conferia a pasta de um jeito mais frouxo que o serviço.
- `ponte/instalar.ps1`: o passo 1 faz o mesmo por SID e para com erro se algum `icacls` falhar.

Provado em pastas novas sem a marca `AI`, que é o caso do perfil deste PC:

- pela ponte compilada: pasta, `config.json` que já existia e `sessao.json` regravado do jeito que a renovação do SDK faz, os três saem TRANCADO;
- pelo trecho do `instalar.ps1`: a pasta fica `D:PAI` só com Henrique, e o `config.json` que já existia passa a herdar só Henrique.

Não rodei a `prova:credencial` completa, porque ela fala com a nuvem. A pasta real `C:\Users\Henrique\.a-fabrica-ponte` não foi alterada por mim: quem conserta é a próxima instalação.

## Próximo passo

Rodar de novo `powershell -ExecutionPolicy Bypass -File ponte\instalar.ps1`. A conferência tem de mostrar as três linhas como TRANCADO.
