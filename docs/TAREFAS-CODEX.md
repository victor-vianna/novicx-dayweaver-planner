# Tarefas do Codex — Ciclo 2 (MVP + deploy Vercel)

- **Data:** 2026-10-23
- **Branch/worktree do Codex:** `codex/ciclo-2`, criada a partir de `claude/ciclo-2`
  (`git worktree add ../novicx-codex codex/ciclo-2`). Nunca trabalhar no
  working tree do Claude.
- **Entrega:** `docs/ENTREGA-CODEX.md` · **Revisões:** `docs/REVISAO-CODEX.md`.
- Merge: o Claude integra `codex/ciclo-2` em `claude/ciclo-2` depois de revisar.

## Contratos de integração (não alterar sem combinar)

| Contrato | Onde | Regra |
| --- | --- | --- |
| Fonte de dados | `src/lib/data-source.ts` | `VITE_DATA_SOURCE=mock\|supabase` (padrão `mock`) |
| Services | `src/services/*.ts` (fachadas) | UI só importa das fachadas; assinaturas iguais nos dois modos |
| Auth | `AuthContextValue` em `src/features/auth/auth-context.ts` | Mock e Supabase expõem a mesma interface |
| Variáveis do front | `.env.example` | Só `VITE_DATA_SOURCE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca `service_role` |
| Sessão | navegador | Nenhum loader SSR consulta o Supabase |

## Arquivos reservados

- **Claude (não tocar):** `supabase/**`, `src/integrations/**`, `src/services/**`,
  `src/features/auth/**`, `src/features/admin/**`, `src/features/*/queries.ts`,
  `src/lib/data-source.ts`, `src/lib/media-files.ts`, `scripts/**`,
  `package.json`, `.env.example`, `docs/PLANO-ATUAL.md`, `docs/OPERACAO.md`.
- **Codex:** `vercel.json`, `vite.config.ts`, `vitest.config.ts`,
  `src/components/layout/**`, `src/components/common/**`, `src/routes/__root.tsx`
  (só 404/erro; a escolha do provider de auth já está lá — preservar),
  `src/features/client/ClientWorkspace.tsx`, testes de UI que criar.
  Precisa mexer em `package.json`? Registre o pedido na entrega; o Claude aplica.

## Tarefas

| ID | Tarefa | Arquivos | Aceite | Tam. |
| --- | --- | --- | --- | --- |
| X1 | `maxWorkers` do Vitest (suíte estoura memória nesta máquina) | `vitest.config.ts` | `npm test` verde sem `--maxWorkers` | P |
| X2 | A11y do menu mobile (`aria-label`, `inert`, foco) | `AppFrame.tsx` | navegação por teclado ok; teste | P |
| X3 | 404 e erro em pt-BR | `__root.tsx` | textos em pt-BR, sem mexer no provider | P |
| X8 | **Deploy Vercel.** O build usa nitro com alvo Cloudflare por padrão (`@lovable.dev/vite-tanstack-config`). Fazer o build gerar saída Vercel (ex.: preset `vercel` do nitro via `vite.config.ts`/env) sem quebrar o Lovable; `vercel.json` se necessário; SPA/SSR funcionando em rota raiz e 404 | `vite.config.ts`, `vercel.json` | `npm run build` gera `.vercel/output`; `vercel build` local ou preview ok; documentar passos na entrega | M |
| X9 | Responsividade e a11y das telas novas de entrega (`src/features/admin/delivery/*`): revisar em 360 px e teclado; **propor** ajustes na entrega (arquivos são do Claude) ou escrever testes de componente em `src/features/admin/delivery/*.test.tsx` | só testes | relatório + testes | P |
| X4 | Revisão independente de segurança: migrations, RLS, Storage, auth, services e upload (commits do Claude no ciclo 2) | só leitura → `docs/REVISAO-CODEX.md` | itens classificados Bloqueante/Importante/Melhoria | M |
| X10 | Verificação de bundle: nenhum `service_role`/`sb_secret_` em `.output`/`.vercel/output` | só leitura | registrado na revisão | P |

Ordem sugerida: X8 → X4/X10 → X1/X2/X3 → X9.
