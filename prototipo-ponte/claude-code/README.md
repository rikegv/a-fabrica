# prototipo-ponte/claude-code, prova da ponte sobre o Claude Code (OST 4)

Codigo descartavel. Pilota o Claude Code pelo kit oficial @anthropic-ai/claude-agent-sdk.
Portao = callback canUseTool. Modo fixado em default e conferido no init. Falha fechada.

- provas-cc.mjs: provas 1, 2, 3, 4, 6, 7.
- extra-cc.mjs: subagente e verificacao do portao na abertura (§A.6).
- espera-longa-cc.mjs: prova 5, espera acima de 5 minutos.

Como rodar: instalar @anthropic-ai/claude-agent-sdk num node_modules local, Claude Code logado, Node 20.
  node provas-cc.mjs ; node extra-cc.mjs ; node espera-longa-cc.mjs

Veredito, formato dos dados e limitacoes em docs/prova-claude-code.md.
Nenhuma credencial no codigo: usa a autenticacao do Claude Code ja logado.
