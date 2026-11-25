Agente: ponte, §A.15. OST 14, escrito pela fábrica da nuvem.

# Levar a ponte para a VM do escritório: passo a passo

Este roteiro é para o dia em que o diretor, junto da fábrica, instalar a ponte na VM do escritório, a das 7 sessões do SOUoperações. Nada aqui foi feito lá ainda: a OST 14 pede para preparar, não para instalar. O mesmo instalador já foi rodado e provado na VM fabrica-1, e o relatório está em docs/ost14.md.

## Antes de começar: o que precisa estar pronto

1. **O painel tem de saber lidar com várias pontes.** Hoje o painel olha só para a ponte vista por último (docs/ponte-na-vm.md, seção 2.2). Com três pontes (notebook, fabrica-1 e escritório), o indicador de "ponte conectada" passa a mentir assim que uma delas cair. Essa parte é da fábrica do notebook (OST 14, item 8). Recomendação: só instalar no escritório depois de ela estar pronta, ou aceitar por escrito que o indicador fica impreciso até lá.
2. **O código da OST 14 no GitHub.** O ramo `nuvem/ponte-linux` ou, depois de o diretor mandar juntar, o ramo de partida.
3. **Acesso de administrador na VM uma vez.** O instalador cria um usuário de sistema, uma regra do sudo e um serviço do systemd. Depois disso, o dia a dia não precisa de sudo.

## Passo 1. Conferir a VM (2 minutos)

Na VM do escritório, pelo SSH de sempre, como o usuário que abre as sessões:

```
node -v                 # precisa ser v20 ou mais novo
claude --version        # Claude Code instalado
ls ~/.claude/settings.json ~/.claude/.credentials.json   # Claude Code já aberto e logado
sudo -v                 # tem administrador
systemctl --version     # tem systemd
df -h / && free -m      # espaço: a instalação ocupa uns 750 MB de disco
```

Se o Node for mais velho que o 20, instale o 20 antes. Se o `~/.claude/settings.json` não existir, abra o Claude Code uma vez e saia.

## Passo 2. Trazer o código

Do jeito que o diretor já usa para levar o repositório para a VM. Se for clone:

```
git clone -b nuvem/ponte-linux git@github.com:rikegv/a-fabrica.git ~/a-fabrica
```

O instalador lê o código de `ponte/` do próprio repositório e compila uma cópia em `/opt/a-fabrica-ponte`. A pasta do repositório pode ficar onde estiver.

## Passo 3. Instalar, num comando só

```
cd ~/a-fabrica
sudo bash ponte/linux/instalar.sh
```

Opções, se precisar: `--nome "VM escritório"` para o nome que aparece no painel (o padrão é o nome da máquina); `--so-liberados` para voltar à regra antiga de conteúdo só de projeto liberado (o padrão, por decisão do diretor na OST 10, é conteúdo de todos); `--sem-login` para deixar o login para depois.

O instalador mostra cada passo. No passo 9 aparece o login.

## Passo 4. O login, igual ao do Claude Code

1. O instalador mostra um link do Google. Abra em qualquer navegador, no computador ou no celular.
2. Entre com a conta do diretor, com a segunda etapa que a conta pedir.
3. A página vai parar numa tela do Firebase com uma mensagem em inglês, "Unable to process request due to missing initial state". **Isso é esperado.** Essa página não usa o código, e ele fica intacto no endereço.
4. Copie o endereço inteiro da barra do navegador e cole no terminal da VM. Aperte Enter.

O link vale 60 minutos e serve uma vez. Depois de entrar no Google, cole em poucos minutos, porque o código do Google vence rápido. Se vencer, rode de novo só o login: `sudo bash /opt/a-fabrica-ponte/app/linux/entrar.sh`.

## Passo 5. Conferir que ficou de pé

```
systemctl status a-fabrica-ponte --no-pager
sudo journalctl -u a-fabrica-ponte -n 30 --no-pager
```

O registro tem de dizer "ponte entrou como" com o e-mail do diretor, e "ponte no ar". No painel, a máquina nova aparece com o nome do passo 3.

## Passo 6. As 7 sessões que já estão abertas

Na VM fabrica-1, com o Claude Code 2.1.332, a sessão que já estava aberta passou a escrever na fila sozinha, no primeiro passo depois da instalação: o Claude Code relê os ganchos do `settings.json`. Se no escritório a versão do Claude Code for mais velha e alguma sessão não aparecer, basta sair e voltar com `claude --continue` naquela pasta, sem perder a conversa.

Para conferir quais sessões estão escrevendo:

```
ls -la /var/lib/a-fabrica-ganchos/fila-ganchos/
```

Cada sessão viva tem um arquivo com o identificador dela, até a ponte arquivar no fim.

## Passo 7. Depois da instalação, o que o diretor decide

1. **Tirar o sudo sem senha do usuário das sessões.** Enquanto o usuário que roda as fábricas tiver sudo sem senha, a tranca da credencial da ponte segura uma leitura comum e não segura um `sudo cat`. Detalhes em docs/ost14.md, "O que depende da mão do diretor".
2. **Projetos a deixar de fora.** Para tirar uma frente inteira do painel, ponha o caminho em `projetosIgnorados` no arquivo `/var/lib/a-fabrica-ganchos/ganchos.json` (precisa de sudo). Lembrete: no Linux maiúscula conta, e a comparação é por fronteira de pasta.

## Como desfazer

```
sudo bash /opt/a-fabrica-ponte/app/linux/desinstalar.sh
```

Para o serviço, tira do `~/.claude/settings.json` só as entradas da Fábrica (com cópia de segurança antes), e tira a regra do sudo, a unidade do systemd e os lançadores. Não apaga a pasta da ponte, a fila, as versões em `/opt` nem o usuário `fabrica-ponte` (§A.17). Plano B (§A.9): com ou sem ponte, o Claude Code continua abrindo na mão, como hoje.

## Memória

Na fabrica-1, que tem 1 GB, a ponte mediu o que está em docs/ost14.md, seção "Quanto a ponte ocupa". Cada fábrica aberta PELO PAINEL é um Claude Code a mais, e um Claude Code ocupa uns 250 a 300 MB. As sessões abertas na mão não pesam na ponte: o gancho escreve uma linha e sai.
