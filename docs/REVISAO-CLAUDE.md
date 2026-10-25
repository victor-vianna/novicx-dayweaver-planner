# Revisão Claude — Ciclo 3

## X10 — Bundle sem segredos (`a4c69e2`, `codex/ciclo-3`)

- **Data:** 2026-10-25 · **Veredito:** aprovado, sem bloqueantes nem importantes.
- **Diff:** lógica pura em `scripts/lib/bundle-scan.ts` (sb_secret_, JWT com `role: service_role` decodificado, `SUPABASE_SERVICE_ROLE_KEY`, PEM privada; publicável e JWT anon/authenticated permitidos; só arquivo e tipo na saída) e `scripts/check-bundle.mjs` (exit 1 achado, 2 sem build).
- **Verificação do revisor:** 9/9; builds mock e supabase → 132 arquivos, zero achados; segredo plantado → exit 1 sem imprimir o valor (`.orq/evidence/X10/`); `tsc`/`eslint` sem erros.
- **Melhoria opcional:** links simbólicos dentro da saída não são seguidos (hoje não há).

## X8 — Build para a Vercel (`7d179cf`, `codex/ciclo-3`)

- **Data:** 2026-10-25 · **Veredito:** aprovado, sem bloqueantes nem importantes.
- **Diff:** `vite.config.ts` ganha `nitro: { preset: "vercel" }`; `vercel.json` só com `framework: null` e `buildCommand`.
- **Lovable:** conferido no código do wrapper (`@lovable.dev/vite-tanstack-config`, `dist/index.js` ~L1187–1203): no ambiente Lovable (`isSandbox`) o preset é forçado para `cloudflare-module` com os diretórios de publicação dele, então a escolha `vercel` só vale fora do Lovable.
- **Verificação do revisor:** `npm run build` mock e `VITE_DATA_SOURCE=supabase` exit 0; `.vercel/output` com `config.json` (v3, rota `/(.*)` → `/__server`), `functions/__server.func` (Node 24, streaming) e `static/`; função SSR executada localmente: `/` 200, rota inexistente 404 com a página em pt-BR (`.orq/evidence/X8/`).
- **Fora da faixa (feito pelo coordenador):** `.vercel/` no `.gitignore`.
- **Melhoria opcional:** o build local agora gera `.vercel/output` em vez de `.output`; scripts de preview que dependam de `.output` precisariam de ajuste (nenhum hoje).

## X3 — 404 e erro em pt-BR (`61f31d1`, `codex/ciclo-3`)

- **Data:** 2026-10-25 · **Veredito:** aprovado, sem itens.
- **Diff:** só textos de `NotFoundComponent` e `ErrorComponent` em `__root.tsx`; provider de auth, `console.error` e `reportLovableError` inalterados. A tela não mostra `error.message` nem stack.
- **Verificação do revisor:** teste novo 2/2; `tsc`, `eslint` e `npm run build` sem erros (`.orq/evidence/X3/build.log`).

## X2 — A11y do menu mobile (`021eb75`, `codex/ciclo-3`)

- **Data:** 2026-10-25 · **Veredito:** aprovado, sem bloqueantes nem importantes.
- **Diff:** botão com `aria-label` dinâmico, `aria-expanded` e `aria-controls`; painel `inert` + `aria-hidden` só abaixo de `lg` (media query 64rem = 1024 px, o mesmo breakpoint das classes `lg:`); foco vai ao painel ao abrir e volta ao botão ao fechar (Esc, backdrop, botão interno, navegação). Desktop inalterado. React 19.3 aceita `inert` booleano.
- **Verificação do revisor:** `npx vitest run src/components/layout` 3/3; `tsc` e `eslint` sem erros.
- **Melhoria opcional:** até o primeiro efeito (SSR/primeira pintura no celular) o painel fechado ainda não está `inert`; está fora da tela, então o impacto é mínimo.

## X1 — `maxWorkers` do Vitest (`c15cee8`, `codex/ciclo-3`)

- **Data:** 2026-10-25 · **Veredito:** aprovado, sem itens.
- **Diff:** `vitest.config.ts` ganha `maxWorkers: 2`; nada removido (`include`, `setupFiles`, `environment`, aliases intactos). `docs/ENTREGA-CODEX.md` registra a entrega.
- **Verificação do revisor:** `npm test` sem flags → 20 arquivos, 170/170, 17 s (`.orq/evidence/X1/npm-test.log`). Os 2 testes de subprocesso que falharam no Codex só falham dentro da sandbox.
- **Observação:** o Codex não conseguiu commitar (sandbox sem escrita no `.git` compartilhado do worktree); o coordenador commitou o diff sem alterações.
- **Melhoria opcional:** o título de `docs/ENTREGA-CODEX.md` ainda diz "Ciclo 1".

---

# Revisão Claude — Ciclo 1

- **Data:** 2026-10-23
- **Revisor:** Claude Code
- **Branch:** `codex/ciclo-1` (`7d470a8` … `88b6ab0`; `d54f81d` contém só documentação)
- **Escopo da revisão:** diff de lógica (services, auth, queries, summary, tipos) e
  verificação automatizada. A movimentação de JSX do T6 foi conferida por
  amostragem; a comparação de textos/classes relatada pelo Codex foi aceita.

## Veredito

**Aprovado, sem itens bloqueantes.** O ciclo cumpre os critérios do plano. A
branch pode ir para `main` (fast-forward, 9 commits) quando o responsável
autorizar — lembrando que a `main` sincroniza com o Lovable.

## Verificação executada pelo revisor

| Verificação | Resultado |
| --- | --- |
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run lint` | ✅ 0 erros, 8 avisos `react-refresh` (catalogados) |
| `npx vitest run --maxWorkers=2` | ✅ 11 arquivos, 56 testes |
| `npm test` (workers padrão) | ⚠️ 32 testes passaram e 3 workers morreram por falta de memória (`Zone Allocation failed`) nesta máquina |

## Conferência com o plano

| Tarefa | Situação |
| --- | --- |
| T1 Toolchain | ✅ `.gitattributes` LF; lint verde |
| T2 Testes puros | ✅ datas (incl. fuso), agendamento, status, share |
| T3 Fronteira auth | ✅ `@/mocks` só em `services/` e `mocks/`; contexto separado do provider |
| T4 Actor | ✅ `postForActor` não vaza existência; `published_by = actor.role`; admin em preview → `admin` |
| T5 Mutação | ✅ toast de erro; invalidação `["portal", client_id]` + `["admin"]` |
| T6 Divisão | ✅ `PlannerApp.tsx` com 22 linhas; `summarizeClientPosts` com guarda de `posts_total = 0` |
| T7 Entrega | ✅ registrada |

## Achados

### Importante

1. **Suíte instável com workers padrão.** Na máquina do responsável, o Vitest
   abre um worker jsdom por núcleo e estoura memória. Fixar `maxWorkers` (ex.: 2)
   em `vitest.config.ts`. → atribuído ao Codex no Ciclo 2 (tarefa X1).

### Melhoria opcional

1. `ClientWorkspace.tsx:45-48` usa o literal `"__missing_client__"` como
   `clientId` de fallback. O caso não é alcançável (o `PlannerApp` mostra
   `MissingClient` antes), mas um `Actor` derivado no `useAuth` (ex.:
   `useActor()`) elimina o literal. Será resolvido naturalmente no Ciclo 2 (C4).
2. `unmarkPostPublished` agora também rejeita rascunhos — mudança correta e
   coberta por teste, mas não estava descrita na entrega.
