# A Fábrica

Painel web de uso individual para abrir, acompanhar, comandar e encerrar sessões de agentes de IA (as fábricas) que rodam na máquina do diretor. Substitui no dia a dia as janelas do Antigravity, hoje o gargalo de gestão. Usuário único: o diretor.

## Arquitetura em três peças
- Painel web: interface em Next.js 14, só mostra e registra ordens.
- Base na nuvem: Firestore, o ponto de encontro com estado, filas e relatórios.
- Ponte local: serviço em Node 20 na máquina do diretor, abre as fábricas via Antigravity e troca dados com a base.

Regra de ouro: o painel nunca fala direto com a fábrica. Painel escreve na base, ponte lê e executa. Ponte escreve na base, painel lê e mostra.

## Como rodar
Este repositório contém, por enquanto, a constituição do projeto (CLAUDE.md) e a fábrica de agentes em .claude/. O produto ainda não foi construído.

Para trabalhar no projeto com a fábrica de agentes, comece pelo coordenador, que lê o CLAUDE.md e despacha os demais.

## Gate de deploy
Um hook PreToolUse chama scripts/gate-deploy.sh antes de comandos Bash e bloqueia deploy e push (git push, deploy, firebase deploy, docker push) enquanto não houver uma flag READY_* em .claude/state/. Para liberar, após validação do diretor:

```
touch .claude/state/READY_<motivo>
```

Remova a flag logo após o push. As flags são locais e não entram no versionamento.

## Documentos
- CLAUDE.md: a constituição, lida por todo agente em toda sessão.
- .claude/: os 8 agentes, o gate e as configurações do harness.
- DIARIO.md e TASKS.md: registro e fila de trabalho.
