# .claude, fábrica do projeto A FÁBRICA

Materializa a fábrica de 8 agentes, o gate de deploy e as configurações do harness.

- agents/: os 8 agentes. O coordenador é a porta de entrada e o ponto de partida convencional. Ele lê o CLAUDE.md a cada sessão e articula os demais.
- settings.json: registra o hook PreToolUse amarrado ao scripts/gate-deploy.sh e o allowlist de permissões.
- state/: flags READY_* que liberam o gate. Vazio por padrão, trava ativa.

Ao despachar trabalho, comece pelo coordenador.
