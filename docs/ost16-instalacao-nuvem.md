# OST 16, proposta de instalação do crachá na nuvem (item 8)

Proposta do coordenador, para o diretor decidir. Nada aqui foi executado. A parte de Linux é da fábrica da nuvem, §A.25; o notebook só entrega o código do crachá e este roteiro.

## Ponto de partida
- Na `fabrica-1` já está instalado o que a OST 14 deixou: o usuário de sistema `fabrica-ponte`, a pasta `/var/lib/a-fabrica-ponte` com modo 700, a unidade `a-fabrica-ponte.service` parada sem sessão, e os ganchos escrevendo na fila.
- O login por código colado da OST 14 (`entradaPorCodigo.ts`, `entrar.sh`) sai de cena. No lugar dele entra o `npm run cracha`, o mesmo código do notebook.

## Ressalva R4 da segurança da nuvem
A reinstalação como administrador não pode rodar de pasta que a fábrica escreve. Hoje a fábrica da nuvem roda como o usuário do diretor na VM e escreve na pasta pessoal dele, inclusive na cópia do repositório. Se o instalador rodar de lá com `sudo`, quem mexeu na cópia vira administrador.

## Caminho proposto, com o mínimo de mão do diretor
1. **Código.** O diretor junta o crachá ao ramo da nuvem: ele manda a fábrica da nuvem partir de `feature/ost5-madrugada` atualizado, levar o crachá para o Linux no ramo `nuvem/...` e subir. Essa parte é dela.
2. **Pacote fechado.** Depois que o diretor ler e aceitar o ramo `nuvem/...` no GitHub, a fábrica do notebook gera, na máquina dele, um pacote do commit aceito (`git archive`) e o hash SHA-256 dele. O hash é mostrado ao diretor no chat, e é ele que vale. Nada vem de pasta da VM.
3. **Um comando do diretor, pelo túnel.** O diretor roda, no terminal do notebook, um comando que a fábrica deixa pronto, com `--project soulan-fabricas` escrito. Esse comando:
   - copia o pacote para a VM;
   - como root, cria uma pasta nova em `/opt`, dona root, que a fábrica não escreve;
   - move o pacote para lá;
   - confere o hash DENTRO dessa pasta, contra o hash digitado no próprio comando;
   - só então descompacta e roda o instalador dali.

   A conferência acontece depois da cópia para a pasta do root, então trocar o arquivo no meio do caminho não adianta.

   É o único passo com `sudo`. Ele precisa do papel de administrador, que o diretor ainda tem.
4. **Crachá.** No mesmo terminal, o comando segue com `sudo -u fabrica-ponte npm run cracha` e mostra o código e o pedaço do uid. O diretor abre o painel no notebook, em Configurações, confere os dois e aperta "Emitir crachá". O crachá fica em `/var/lib/a-fabrica-ponte/cracha.json`, dono `fabrica-ponte`, modo 600.
5. **Serviço.** O comando termina ligando `a-fabrica-ponte.service` e conferindo três coisas:
   - a máquina "Nuvem" aparece online no painel;
   - uma sessão aberta lá aparece como fábrica com o selo Nuvem;
   - um pedido de risco chega ao celular.

   Mão do diretor nesta parte: um comando colado, um login do gcloud se tiver vencido, e um clique no painel.

## Depois de instalado (item 9)
A fábrica do notebook troca o papel do diretor no `soulan-fabricas`, sempre com o projeto escrito:
- tira `roles/compute.osAdminLogin`;
- põe `roles/compute.osLogin`;
- confere, antes, que o acesso pelo túnel (`roles/iap.tunnelResourceAccessor`) continua, para ele não perder a entrada na VM;
- confere, depois, por SSH, que `sudo` é negado e que a sessão normal entra.

**Efeito.** A sessão do diretor na VM, e portanto a fábrica da nuvem, deixa de ser administradora. Ela deixa de ler `/var/lib/a-fabrica-ponte`, e com isso o `cracha.json`.

**Custo.** Toda reinstalação futura pede o papel de administrador de volta, por tempo curto. Como dono do projeto, o diretor concede e retira.

**Por que antes não dá.** O passo 3 precisa de `sudo`. Tirar o administrador antes da instalação trava a instalação.

## Condição da segurança para a execução (A1)
Entre o passo 3 e o fim do item 9, a sessão do diretor na VM ainda é administradora, e a fábrica da nuvem roda como ela. Nessa janela, ela poderia ler o `cracha.json` e mexer em `/opt`. Por isso, a execução segue estas regras:
- a sessão "A Fábrica (nuvem)" fica PARADA do passo 3 até o fim do item 9;
- o item 9 é feito na mesma sentada da instalação;
- depois do item 9, o hash de `/opt` e da unidade do systemd é conferido de novo;
- as dependências vêm por `npm ci`, com o lockfile do pacote;
- o `tsc` do `npm run cracha` escreve numa pasta onde só `fabrica-ponte` escreve.

## Limites
- **A regra estreita do `sudo`** da OST 14 (`claude-como-diretor` e `ler-transcricao`) continua. Ela é da ponte para o usuário do diretor, não o contrário, e não dá à fábrica acesso ao crachá.
- **O que a nuvem enxerga.** Mesmo sem administrador, a fábrica da nuvem enxerga tudo o que o usuário do diretor enxerga na VM, inclusive a fila dos ganchos, que ele escreve. Isso não muda.
- **VM do escritório (item 11).** Fica para depois, com o mesmo roteiro.
