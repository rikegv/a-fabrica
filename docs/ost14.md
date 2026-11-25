Agentes: coordenador (fábrica da nuvem, desenho, código e instalação), segurança (auditoria), tester (provas), §A.15. OST 14, VM fabrica-1, ramo nuvem/ponte-linux.

# OST 14: a ponte em Linux

## O que foi pedido

1. A ponte rodando em Linux, com os ganchos capturando conteúdo de todos os projetos, como no notebook.
2. Instalada e provada na VM fabrica-1, com esta sessão aparecendo no painel.
3. Login no modelo do login do Claude: a fábrica entrega o link, o diretor abre e cola o código. Sem chave de conta de serviço.
4. A credencial da ponte trancada longe das fábricas, com prova de que esta sessão não lê o arquivo dela.
5. Volta sozinha se cair ou se a VM reiniciar, e recusa uma segunda ponte na mesma máquina.
6. Medir quanto a ponte ocupa, numa VM de 1 GB.
7. Instalador num comando só e passo a passo para a VM do escritório, sem instalar lá.
8. Não mexer no painel: a parte de várias pontes é da fábrica do notebook.

## O desenho, em uma página

**Dois usuários.** No Windows, a ponte e as fábricas rodam como o mesmo usuário, e por isso nenhuma tranca de arquivo segura uma fábrica (§A.7, limite declarado). No Linux isso tem conserto, e o conserto é o centro desta OST:

- a ponte roda como `fabrica-ponte`, um usuário de sistema sem senha e sem shell, dono de `/var/lib/a-fabrica-ponte` (modo 700). Ali moram a configuração, a sessão (que vale como chave de aprovação) e os registros;
- as fábricas rodam como o diretor, com a pasta, a conta do Claude Code e a configuração dele, como se ele tivesse aberto na mão (§A.9);
- quando a ponte precisa agir como o diretor, ela pede ao sistema por uma regra estreita do sudo, gravada em `/etc/sudoers.d/a-fabrica-ponte`, que libera só dois lançadores e só como o diretor: `claude-como-diretor` (abre o Claude Code do kit da ponte, e nenhum outro programa) e `ler-transcricao` (lê a transcrição do Claude Code e devolve só números de token e modelo, ou o texto do fechamento).

**A fila.** O gancho roda como o diretor, a cada passo de qualquer sessão, e escreve em `/var/lib/a-fabrica-ganchos/fila-ganchos` (modo 2770: o diretor escreve, a ponte lê e arquiva, outros nada). O gancho mora em `/opt`, dono root, então nenhuma fábrica consegue mexer no código dele. Conteúdo de todos os projetos, como no notebook (§A.23, decisão da OST 10). No Linux a comparação de caminho respeita maiúscula, para a liberação nunca alargar sozinha.

**O login.** O Authentication do próprio projeto gera o link do Google (createAuthUri). O diretor entra em qualquer navegador, com a segunda etapa da conta dele. O Google devolve o navegador para a página de retorno do Firebase, que mostra um erro em inglês e deixa o código no endereço. O diretor cola o endereço, e a ponte troca o código por sessão com um identificador que nunca sai da pasta trancada (signInWithIdp). Dali em diante é o caminho já provado da OST 6: troca no endpoint de token, conta do diretor, e-mail verificado, projeto certo, e só então grava. Nada escuta porta, nem por segundos.

**O serviço.** `a-fabrica-ponte.service` no systemd: sobe com a máquina sem ninguém logado, volta 10 segundos depois de qualquer queda, e não fica religando quando falta o login ou a tranca (códigos 3 e 6, que só o diretor destrava). A trava de instância única fica em `/run/a-fabrica-ponte`, uma pasta da máquina que todos leem e só a ponte escreve: uma segunda ponte, de qualquer usuário, vê a primeira viva e não sobe.

## Situação

PREENCHER NO FECHAMENTO.
