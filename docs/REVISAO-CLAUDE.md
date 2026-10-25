# Revisão Claude — Ciclo 3

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
