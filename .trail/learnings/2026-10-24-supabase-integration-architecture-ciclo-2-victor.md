---
title: Supabase integration architecture (ciclo 2)
author: Victor
date: 2026-10-24
branch: claude/ciclo-2
cost: { minutes: 24, tokens: 265116 }
touches:
  - AGENTS.md
  - supabase/migrations/20261023120000_schema.sql
  - supabase/migrations/20261023120100_rls.sql
  - supabase/migrations/20261023120200_storage.sql
  - supabase/seed-media.json
  - supabase/seed.sql
  - supabase/tests/00_schema.test.sql
  - supabase/tests/01_rls.test.sql
  - supabase/tests/02_storage.test.sql
  - docs/OPERACAO.md
---

## Decided
- src/services/*.ts are facades: `impl = (): typeof mock => isMockMode() ? mock : remote`; mock impls in services/mock, Supabase in services/supabase. The `typeof mock` annotation is the compile-time contract — remote must match mock signatures.
- Real auth: SupabaseAuthProvider exposes the same AuthContextValue as MockAuthProvider; __root picks by VITE_DATA_SOURCE. Demo buttons/prefill only in mock.
- Slots for assign_plan are computed in TS (distributeSlots) and validated by the RPC — one scheduling algorithm.
- Client storage read policy requires the object to be registered in post_media of an own non-draft post (orphans invisible).
- Seed media: supabase/seed-media.json + scripts/seed-media.mjs (local only, refuses non-localhost).

## Tried and ruled out
- Generic Record<string, unknown> row mapping: tsconfig has noPropertyAccessFromIndexSignature; use explicit row types (services/supabase/shared.ts).

## Watch out
- pgTAP tests switch roles via set_config('role'); always `reset role` before re-login.
- Storage may block direct SQL DELETE unless storage.allow_delete_query = 'true' (set in tests).
- Build defaults to nitro Cloudflare target (@lovable.dev/vite-tanstack-config); Vercel needs preset change (Codex X8).
- Full vitest needs --maxWorkers=2 on this machine (OOM).
