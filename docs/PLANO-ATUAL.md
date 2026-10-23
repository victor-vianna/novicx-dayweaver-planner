# Plano Atual — Ciclo 1

- **Data:** 2026-10-23
- **Autor:** Claude Code (arquiteto)
- **Base:** `docs/AUDITORIA.md` (commit `67f8b16`)
- **Executor:** Codex
- **Status:** pronto para implementação

## Objetivo

Preparar a arquitetura para a integração futura com Supabase, deixando o
toolchain verde, o contrato dos services explícito e as regras de negócio
cobertas por testes — **sem alterar o visual**.

## Tarefas (visão geral)

- [x] Auditar a estrutura atual. → `docs/AUDITORIA.md`
- [x] Identificar dependências entre telas e mocks. → `docs/AUDITORIA.md` §3.3
- [ ] T1 — Toolchain verde (fim de linha + Prettier + lint).
- [ ] T2 — Testes das regras puras (`lib/`).
- [ ] T3 — Fronteira de autenticação: tirar mocks da UI.
- [ ] T4 — Contrato de autorização nos services de publicação.
- [ ] T5 — Mutação de publicação: erro visível e invalidação dirigida.
- [ ] T6 — Dividir `PlannerApp.tsx` e extrair métricas puras.
- [ ] T7 — Validação final e registro da entrega.

## Restrições

- Não alterar o visual (markup, classes Tailwind e textos permanecem idênticos,
  salvo onde a tarefa disser o contrário).
- Não conectar Supabase nem qualquer serviço externo.
- Não modificar produção.
- Não reescrever histórico Git já publicado (ver `AGENTS.md`).
- Fora do escopo deste ciclo (aguardam aprovação, ver Auditoria §6):
  navegação por URL, PWA, remoção de lockfile, mudanças de copy, comportamento
  de rascunhos no painel admin.

## Ordem e forma de trabalho

1. Executar **na ordem T1 → T7**. T1 reformata muitos arquivos e precisa ir
   sozinho, antes de qualquer outra mudança, para não poluir os diffs seguintes.
2. Trabalhar em uma branch (`codex/ciclo-1`), não direto na `main`: commits na
   `main` sincronizam imediatamente com o Lovable. Merge só após revisão aprovada.
3. Um commit por tarefa (no mínimo), mensagem descritiva em português.
4. Ao final, registrar a entrega em `docs/ENTREGA-CODEX.md` (modelo no fim deste arquivo).

---

## T1 — Toolchain verde

**Objetivo**
`npm run lint` terminar sem erros em Windows e em Linux.

**Arquivos envolvidos**
- `.gitattributes` (novo)
- os 18 arquivos listados em `docs/AUDITORIA.md` §2.1 (somente formatação)
- opcional: `eslint.config.js`

**Abordagem recomendada**
1. Criar `.gitattributes` com `* text=auto eol=lf` (e `*.jpg binary`, `*.ico binary`).
2. Renormalizar o working tree (`git add --renormalize .`) — no índice já está
   tudo em LF, então o commit deve trazer apenas o `.gitattributes`; confirmar
   com `git diff --cached --stat`.
3. Rodar `npx prettier --write` **apenas** em `src/` fora de `src/components/ui/`
   e nos arquivos de config (respeitando `.prettierignore`). Commit separado
   "Formata código com Prettier".
4. Os 4 avisos `react-refresh/only-export-components` em código próprio podem
   ficar como aviso neste ciclo (T3 e T6 eliminam a maioria). Não desligar a regra.

**Riscos**
- Reformatação em massa conflitar com edições em andamento no Lovable → fazer
  rápido e sincronizar antes de seguir.
- Prettier mudar algo semântico: improvável; o build e o tsc confirmam.

**Critérios de aceitação**
- `npm run lint` → 0 erros (avisos permitidos apenas em `components/ui/` e nos
  casos citados).
- `npx tsc --noEmit` e `npm run build` continuam passando.
- Diff do commit de formatação contém só whitespace/quebras de linha
  (`git diff -w` praticamente vazio).

**Testes necessários**
- Nenhum novo; rodar a suíte existente.

---

## T2 — Testes das regras puras

**Objetivo**
Cobrir as funções de `lib/` que sustentam calendário, status e distribuição de
publicações, para que as próximas tarefas (e a futura troca de backend) tenham
rede de segurança.

**Arquivos envolvidos**
- `src/lib/dates.test.ts`, `src/lib/scheduling.test.ts`,
  `src/lib/status.test.ts`, `src/lib/share.test.ts` (novos)
- nenhum arquivo de produção deve mudar (se um teste revelar bug, registrar na
  entrega e corrigir em commit separado)

**Abordagem recomendada**
- Testes unitários Vitest puros, sem renderização.
- Passar `now` explícito onde a função aceita (`todayISO(now)`, `greeting(now)`)
  para não depender do relógio; usar datas próximas da meia-noite de
  São Paulo para provar o fuso (ex.: `2026-10-24T02:30:00Z` → `2026-10-23`).
- `dates`: `todayISO`, `addDays` (virada de mês/ano, ano bissexto), `diffDays`,
  `shiftMonth` (dez→jan, jan→dez), `monthGrid` (42 células, começa no domingo),
  `formatLong`, `formatNumeric`, `relativeDayLabel`, `isValidISO`, `isValidTime`.
- `scheduling`: `count <= 0`, intervalo invertido, sem dias permitidos,
  `count` ≤ dias disponíveis (nenhum dia repetido), `count` > dias (rotação de
  horários e ordenação), `weekdays` vazio = todos, `times` vazio = `10:00`,
  `packageEndDate` com `periodDays` 0/1/30.
- `status`: as quatro saídas de `getDisplayStatus` e o limite `scheduled_date === today` (= `ready`).
- `share`: `slugify` (acentos, símbolos, 48 caracteres), `mediaFilename`,
  `saveResultMessage`.

**Riscos**
- Testes acoplados ao relógio real ficarem intermitentes → sempre injetar `now`.

**Critérios de aceitação**
- Todos os casos acima existem e passam.
- `npm test` continua rodando em menos de ~30 s.

**Testes necessários**
- Os próprios testes desta tarefa.

---

## T3 — Fronteira de autenticação: tirar mocks da UI

**Objetivo**
A UI não deve conhecer contas demo nem importar `mocks/`. Trocar o mock por
Supabase Auth no futuro deve exigir mudança apenas em `services/auth.ts` e no
provider.

**Arquivos envolvidos**
- `src/services/auth.ts`
- `src/features/auth/MockAuthProvider.tsx`
- `src/features/planner/PlannerApp.tsx` (apenas `LoginScreen`, estado inicial)

**Abordagem recomendada**
1. Em `services/auth.ts`, adicionar `signInAsDemo(role: Role): Promise<MockSession>`
   e exportar `DEMO_LOGIN_PREFILL = { email, password }` derivado de `DEMO_ACCOUNTS`.
2. `MockAuthProvider` passa a chamar `signInAsDemo` do service e deixa de
   importar `@/mocks/seed`.
3. `LoginScreen` inicializa `email`/`password` a partir de `DEMO_LOGIN_PREFILL`
   (o campo continua pré-preenchido — **sem mudança visual**).
4. Mover `useAuth`/`usePortalClientId` para `src/features/auth/useAuth.ts`
   (o contexto pode ir junto em `auth-context.ts`), deixando o arquivo do provider
   exportando só componente — resolve 2 avisos de `react-refresh`.
5. Não renomear `MockAuthProvider` neste ciclo.

**Riscos**
- Quebrar a restauração de sessão a partir do `sessionStorage` → testar.

**Critérios de aceitação**
- `grep -rn "@/mocks" src` só retorna arquivos dentro de `src/services/` e `src/mocks/`.
- Login por formulário, "Área cliente" e "Área equipe" funcionam como antes.
- Recarregar a página mantém a sessão (e o preview do admin).

**Testes necessários**
- `src/services/auth.test.ts`: senha correta/incorreta, e-mail com espaços e
  maiúsculas, `signInAsDemo` para os dois papéis, `getSessionFor` inexistente.
- `src/features/auth/MockAuthProvider.test.tsx` (React Testing Library):
  `signed_out` sem storage; restaura sessão gravada; `signOut` limpa storage;
  `startPreview` ignorado para role `client`.

---

## T4 — Contrato de autorização nos services de publicação

**Objetivo**
Tornar explícito *quem* executa cada operação do portal, espelhando a futura
RLS, e corrigir `published_by` no modo preview (achado B2).

**Arquivos envolvidos**
- `src/services/posts.ts`
- `src/features/client/queries.ts`
- `src/features/planner/PlannerApp.tsx` (`PostDetail` / chamada da mutação)
- `src/types/domain.ts` (se for criado o tipo `Actor`)

**Abordagem recomendada**
1. Definir em `types/domain.ts`:
   `type Actor = { role: "client"; clientId: string } | { role: "admin" }`.
2. `markPostPublished(id, actor)` e `unmarkPostPublished(id, actor)`:
   - se `actor.role === "client"` e `post.client_id !== actor.clientId` →
     lançar `Error("Publicação não encontrada")` (não vazar existência);
   - `draft` continua bloqueado para ambos;
   - `published_by = actor.role`.
3. `useTogglePublished` recebe o `Actor` (derivado de `useAuth()`: cliente logado
   → `client`; admin, inclusive em preview → `admin`).
4. Documentar no topo de `services/posts.ts`, em 3–4 linhas, a regra que a RLS
   deverá reproduzir (cliente só lê não-rascunhos próprios; só altera status de
   publicação dos próprios posts).
5. Não alterar assinaturas dos services de admin neste ciclo.

**Riscos**
- Chamadas antigas sem `actor` → o TypeScript deve acusar; não usar parâmetro opcional.

**Critérios de aceitação**
- Cliente não consegue marcar post de outro cliente (teste).
- Admin em preview marca como publicado → `published_by === "admin"`.
- Fluxo na UI idêntico ao atual.

**Testes necessários**
- `src/services/posts.test.ts` usando o store real com `resetDB()` em
  `beforeEach` (e `vi.useFakeTimers` ou mock de `delay` para não esperar latência):
  - `listPosts` sem `includeDrafts` nunca retorna `draft`;
  - `getPost` com `clientId` de outro cliente → `null`;
  - `markPostPublished`: dono ok, outro cliente rejeitado, draft rejeitado,
    `published_by` correto para cada papel;
  - `unmarkPostPublished` volta a `ready` e limpa `published_at/by`.

---

## T5 — Mutação de publicação: erro visível e invalidação dirigida

**Objetivo**
Falhas ao marcar/desmarcar publicação devem aparecer para o usuário, e o cache
deve ser invalidado de forma direcionada (achado I3).

**Arquivos envolvidos**
- `src/features/client/queries.ts`
- `src/features/admin/queries.ts` (exportar fábrica de keys `adminKeys`, se útil)

**Abordagem recomendada**
- `onError`: `toast.error(error.message || "Não foi possível atualizar a publicação.")`
  usando o `sonner` já montado no root (componente existente, sem novo visual).
- `onSuccess`: invalidar `["portal", clientId]` e `["admin"]` (o painel admin
  conta entregas pendentes), em vez de `invalidateQueries()` sem filtro.
- Não implementar atualização otimista neste ciclo.

**Riscos**
- Esquecer alguma key e a tela não atualizar → coberto pelo teste abaixo.

**Critérios de aceitação**
- Erro do service gera toast de erro.
- Após sucesso, lista do portal e contadores atualizam.

**Testes necessários**
- Teste com `renderHook` + `QueryClientProvider`: sucesso invalida as keys
  esperadas (espiar `invalidateQueries`); erro chama `toast.error` (mock de `sonner`).

---

## T6 — Dividir `PlannerApp.tsx` e extrair métricas puras

**Objetivo**
Reduzir o arquivo de 1.028 linhas a um orquestrador pequeno, com cada tela em
seu módulo, e mover a lógica derivada para uma função pura testada (achados I1 e I5).

**Arquivos envolvidos** (sugestão de destino)
- `src/features/planner/PlannerApp.tsx` — só o switch de sessão (≤ ~60 linhas)
- `src/features/auth/LoginScreen.tsx`
- `src/features/client/ClientWorkspace.tsx`, `src/features/client/summary.ts`
- `src/features/admin/AdminWorkspace.tsx`, `src/features/admin/ClientCard.tsx`
- `src/components/layout/AppFrame.tsx`
- `src/components/post/PostDetail.tsx`
- `src/components/common/MetricCards.tsx` (`MetricCard`, `AdminMetric`)
- `src/components/common/WorkspaceSkeleton.tsx`, `LoadingScreen`, `MissingClient`
  onde fizer sentido

**Abordagem recomendada**
1. **Mover código sem reescrever**: JSX, classes e textos copiados como estão.
   Revisão vai comparar markup.
2. Criar `summarizeClientPosts(posts, packages, today)` em `features/client/summary.ts`
   retornando `{ currentPackage, published, ready, pending, upcoming, usedInPackage, packageProgress }`.
   - Guardar divisão: `posts_total <= 0` → `packageProgress = 0`.
   - Manter o comportamento atual de `upcoming` (primeiros 4 não publicados em
     ordem de agenda) — mudar a ordenação é decisão de produto, fora do ciclo.
3. Extrair helper `initials(name)` (hoje duplicado em `AppFrame` e `ClientCard`).
4. Envolver `entries` em `useMemo` (M3) — ganho gratuito durante a mudança.
5. Não introduzir rotas novas (navegação por URL é ciclo 2).

**Riscos**
- Regressão visual sutil ao copiar JSX → comparar telas antes/depois (login,
  visão geral cliente, calendário, modal, painel admin, lista de clientes,
  preview, menu mobile).
- Ciclos de import entre `features/` → manter `components/` sem importar de `features/`
  exceto `useAuth`.

**Critérios de aceitação**
- `PlannerApp.tsx` ≤ ~60 linhas; nenhum arquivo novo > ~300 linhas.
- Nenhuma mudança de classe Tailwind ou texto visível (verificável via diff).
- Todas as telas acima navegáveis e idênticas.

**Testes necessários**
- `src/features/client/summary.test.ts`: contagens por status, pacote sem posts,
  `posts_total = 0`, posts de pacote anterior não contam no progresso, limite de 4 em `upcoming`.
- Teste de fumaça com RTL: `PlannerApp` sem sessão renderiza "Entrar no Planner";
  com sessão de cliente demo renderiza "Próximas publicações".

---

## T7 — Validação final e registro da entrega

**Objetivo**
Comprovar que nada regrediu e documentar a entrega para revisão.

**Abordagem**
Rodar e colar a saída resumida de:
- `npx tsc --noEmit`
- `npm run lint`
- `npm test`
- `npm run build`
- teste manual das telas listadas em T6 (desktop e largura de celular)

**Critérios de aceitação**
- Os quatro comandos passam.
- `docs/ENTREGA-CODEX.md` preenchido.

---

## Critérios de aceitação do ciclo

- Aplicação funcionando, sem mudança visual.
- `tsc`, lint, testes e build passando (lint passa a fazer parte do critério).
- Nenhum import de `@/mocks` fora de `src/services/` e `src/mocks/`.
- Services de publicação exigem `Actor` e têm testes de autorização.
- Alterações documentadas em `docs/ENTREGA-CODEX.md`.
- Revisão independente concluída em `docs/REVISAO-CLAUDE.md` sem itens bloqueantes.

## Backlog (ciclos seguintes — exigem aprovação)

1. Navegação por URL com TanStack Router (`/`, `/calendario`, `/publicacao/$id`,
   `/admin`, `/admin/clientes`, preview como parâmetro) — I2.
2. PWA: manifest, ícones, depois service worker — I9.
3. Unificar lockfile em `bun.lock` — I10.
4. Copy condicional ("em dia" / "sob controle") — I8.
5. Tela admin de publicação (resolver rascunhos em "Próximas entregas") — I7.
6. Acessibilidade do menu mobile e textos 404/erro em português — M2, M7.
7. Desenho do schema Supabase + políticas RLS + Storage (documento, sem aplicar) — Auditoria §5.

---

## Modelo para `docs/ENTREGA-CODEX.md`

```markdown
# Entrega Codex — Ciclo 1
- Branch / commits:
- Tarefas concluídas: T1 … T7 (marcar)
- Desvios do plano e motivo:
- Bugs encontrados durante a implementação:
- Saída de tsc / lint / test / build (resumo + nº de testes):
- Teste manual realizado (telas e larguras):
- Limitações e pendências:
```
