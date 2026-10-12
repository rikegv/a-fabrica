# .claude/state, flags de liberação do gate

Guarda as flags READY_* consumidas por scripts/gate-deploy.sh (hook PreToolUse em settings.json). Sem uma flag READY_* aqui, os verbos de deploy e push (git push, deploy, firebase deploy, docker push) são bloqueados.

- Liberar: touch .claude/state/READY_<motivo>, após validação do diretor.
- Remover após o push. As flags são locais e nunca versionadas (ver .gitignore).

Em estado normal este diretório fica vazio de flags, trava ativa.
