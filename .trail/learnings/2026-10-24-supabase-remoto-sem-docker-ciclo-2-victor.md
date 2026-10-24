---
title: Supabase remoto sem Docker (ciclo 2)
author: Victor
date: 2026-10-24
branch: claude/ciclo-2
cost: { minutes: 19, tokens: 163594 }
touches:
  - docs/OPERACAO.md
  - docs/PLANO-ATUAL.md
  - docs/ENTREGA-CLAUDE.md
  - package.json
  - scripts/e2e-remote-setup.mjs
  - src/services/supabase/flow.it.ts
  - vitest.supabase.config.ts
  - scripts/db-test-remote.mjs
  - src/integrations/supabase/database.types.ts
  - supabase/migrations/20261024120000_revoke_trigger_fns.sql
---

## Decided
- Integração usa o projeto remoto dev smhrcfiwpqhumdclzdre; Docker não é usado nesta máquina (16 GB RAM).
- pgTAP no remoto: npm run db:test:remote (scripts/db-test-remote.mjs) — cada arquivo termina num bloco que sempre lança exceção, então nada é commitado.
- E2E remoto: npm run e2e:setup:remote + npm run test:supabase:remote, contas [E2E] (ids ee2e0000-…), senha só em .env.e2e.local.
- Vínculo conta→cliente só com e-mail confirmado (migration 20261024120100).

## Tried and ruled out
- Ler __tresults__ do pgTAP: na 1.3 não existe; só __tcache__ (labels plan/failed) + sequência __tresults___numb_seq, e finish() apaga tudo — ler antes.
- supabase config push direto do repo: levaria valores do dev local (confirmação de e-mail off, MFA off). Usar cópia temporária com --workdir e conferir o diff com "n".

## Watch out
- Projeto hospedado novo vem com cadastro público LIGADO.
- Grant padrão do Supabase dá EXECUTE a authenticated em toda função nova; revogar nas funções de trigger.
- Editar arquivos .ts com \r\n via python/sed no Git Bash corrompeu regex; use node ou Edit.
