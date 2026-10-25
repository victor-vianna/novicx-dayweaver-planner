---
title: "Jobs Codex no Windows: commit, vitest e worktrees"
author: Victor
date: 2026-10-25
branch: claude/ciclo-3
cost: { minutes: 150, tokens: 774861 }
touches:
  - docs/orquestracao/FILA.md
  - docs/orquestracao/tarefas/T3.md
  - scripts/lib/e2e-setup-sql.ts
  - src/features/auth/LoginScreen.tsx
  - src/features/auth/MockAuthProvider.tsx
  - src/features/auth/SupabaseAuthProvider.tsx
  - src/features/auth/auth-context.ts
  - src/integrations/supabase/database.types.ts
  - src/lib/access.ts
  - src/services/accounts.test.ts
---

## Decided
- O Codex (sandbox workspace-write) não grava no `.git` compartilhado dos worktrees: tarefas entregam o diff sem commit e o coordenador commita sem alterar, marcando "Conteúdo produzido pelo Codex". PROMPT-CODEX diz isso; status `delivered` com `commits: []`.
- Vitest dentro da sandbox: `node --import "data:text/javascript,globalThis.__dirname%3Dprocess.cwd()%3B" node_modules/vitest/vitest.mjs run --configLoader native --pool=threads`. Só testes que criam subprocessos continuam falhando lá.
- `codex-job.mjs --extra-round` libera uma única rodada além de 3, só com "sim" do responsável registrado na FILA.
- `db push` aplica todas as pendentes: revise todas antes de mostrar o dry-run.

## Tried and ruled out
- Afrouxar a sandbox do Codex para commit/vitest (regra de segurança; não precisa).

## Watch out
- `.trail/cache/` sujava os worktrees e fazia o job recusar ("worktree is dirty"); agora `.trail/.gitignore` está versionado. Nunca `rm -rf .trail` (apaga learnings versionados).
- Lifecycle E2E (`accounts.it.ts`) reusa a cliente fixa c3: o frontend não apaga usuários Auth.
