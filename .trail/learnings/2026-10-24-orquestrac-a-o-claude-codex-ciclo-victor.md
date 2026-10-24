---
title: Orquestração Claude + Codex (ciclo 3)
author: Victor
date: 2026-10-24
branch: claude/ciclo-3
cost: { minutes: 10, tokens: 156499 }
touches:
  - docs/PLANO-ATUAL.md
  - scripts/db-test-remote.mjs
  - scripts/e2e-remote-setup.mjs
  - src/services/supabase/flow.it.ts
  - tsconfig.json
  - vitest.config.ts
  - docs/orquestracao/ORQUESTRACAO.md
  - docs/orquestracao/PROMPT-CLAUDE.md
  - docs/orquestracao/PROMPT-CODEX.md
  - docs/orquestracao/review-schema.json
---

## Decided
- Coordenador único: sessão interativa do Claude Code, único escritor de docs/orquestracao/FILA.md.
- Codex entra como processo headless por tarefa (`codex exec --output-schema -o --json -C <worktree> -s workspace-write`), via scripts/orq/codex-job.mjs (criado na tarefa O0): revisor em ../novicx-review (HEAD destacado no SHA, sem rede, não commita) e executor de faixa em ../novicx-codex (codex/ciclo-3).
- A aprovação é calculada pelo Claude: 0 bloqueante, 0 importante, todo critério `verified`, commit = SHA. Máx. 3 rodadas, 2 tentativas por job.
- O revisor não corrige o código do autor; ele anexa um `repro_test` ao achado.
- Histórico de alterações das publicações entrou como T7/D7 (critério do responsável que estava fora do plano).

## Tried and ruled out
- Dois coordenadores com filas cruzadas: corrida pela fila, sem mecanismo de despertar.
- `codex queue` para acordar sessão: não acorda de forma confiável (wake_on_agent_messages ainda em desenvolvimento).
- Daemon orquestrador com `claude -p`: perde contexto e as aprovações humanas seguem obrigatórias.

## Watch out
- ~2,5 GB de RAM livre: 1 Claude + 1 job Codex por vez; vitest só com --maxWorkers=2 até X1.
- As tarefas X1–X3 e X8–X10 do Codex no ciclo 2 nunca foram feitas.
- Tarefas H* (navegador) precisam de network_access no sandbox; se o plugin de navegador não funcionar headless, usar sessão interativa.
- Caminho com espaço e acento: chamar o codex com execFile, sem shell.
