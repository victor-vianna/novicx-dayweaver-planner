# Auditoria Técnica — NOVICX Planner

- **Data:** 2026-10-23
- **Responsável:** Claude Code (arquiteto/revisor)
- **Commit auditado:** `67f8b16` (branch `main`)
- **Escopo:** leitura completa de `src/` (exceto `components/ui/`, gerado pelo shadcn), configs e toolchain. Nenhum arquivo de código foi alterado.

---

## 1. Resumo executivo

O projeto está em bom estado para um protótipo: a separação **UI → queries (React Query) → services → mocks** já existe e é respeitada quase integralmente, os tipos de domínio espelham futuras tabelas e as regras de negócio puras (datas em America/Sao_Paulo, distribuição de slots, status de exibição) estão isoladas em `src/lib/`.

Os principais problemas são:

1. **Lint quebrado** (7.091 problemas) — impede cumprir o critério "build e lint sem regressões".
2. **Autorização implícita na UI**: os services não sabem *quem* está agindo; o escopo por cliente depende de a UI passar o `clientId` certo. Isso precisa virar contrato explícito antes do Supabase (RLS).
3. **`PlannerApp.tsx` monolítico** (1.028 linhas) com toda a navegação em `useState` — sem URLs, sem botão voltar, sem deep link.
4. **Cobertura de testes mínima** (1 teste de roteamento).
5. **Mutação sem tratamento de erro** e invalidação global do cache.

Nenhum problema de segurança real existe *hoje* (não há backend nem dados reais), mas há itens que **se tornam bloqueantes no dia da integração** e estão listados na seção 5.

---

## 2. Verificações executadas

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | ✅ sem erros (modo `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`) |
| Testes | `npm test` | ✅ 1 arquivo, 1 teste passou (16 s, maior parte em setup do jsdom) |
| Build | `npm run build` | ✅ concluído (Vite 8 + Nitro, alvo Cloudflare Workers) |
| Lint | `npm run lint` | ❌ **7.091 problemas** (7.081 erros, 10 avisos) |
| Formatação (ignorando fim de linha) | `npx prettier --check --end-of-line auto "src/**/*.{ts,tsx}"` | ❌ 18 arquivos fora do padrão |

Ambiente: Node 24.20.0, npm 11.19.0, Windows 11.

**Não verificado:** execução visual da aplicação no navegador (não foi feito teste manual de telas nesta auditoria).

### 2.1 Detalhe do lint

- **~7.080 erros são `Delete ␍`**: `core.autocrlf=true` no Git do Windows, sem `.gitattributes`. O repositório guarda LF, o checkout converte para CRLF e o Prettier (padrão `endOfLine: "lf"`) acusa cada linha. Não é defeito do código, é de configuração do repositório.
- **18 arquivos com formatação real fora do Prettier** (linhas > 100 colunas etc.): `components/brand/Wordmark.tsx`, `components/calendar/MonthCalendar.tsx`, `components/common/States.tsx`, `components/post/{CaptionBlock,PostArt,PostListItem}.tsx`, `components/post/useSaveArt.ts`, `features/{admin,client}/queries.ts`, `features/auth/MockAuthProvider.tsx`, `lib/{dates,scheduling,share,status}.ts`, `mocks/seed.ts`, `services/{clients,notes,packages}.ts`.
- **10 avisos `react-refresh/only-export-components`**: 6 em `components/ui/` (padrão shadcn, aceitável) e 4 em código próprio (`CaptionBlock.tsx:8`, `PostListItem.tsx:19`, `MockAuthProvider.tsx:123,130`).

---

## 3. Arquitetura atual

### 3.1 Stack real

A documentação (`AGENTS.md`) descreve "React, TypeScript, Vite, Tailwind e shadcn/ui". O stack real é mais específico e isso importa para o planejamento:

- **TanStack Start 1.168** (SSR) + **TanStack Router** (roteamento por arquivo em `src/routes/`) + **Nitro** com alvo **Cloudflare Workers** (`.output/server/wrangler.json`).
- React 19, Tailwind 4, shadcn/ui (estilo new-york), React Query 5, Vitest 4 + jsdom.
- Config Vite encapsulada por `@lovable.dev/vite-tanstack-config` (não adicionar plugins manualmente).
- Há **dois lockfiles**: `bun.lock` (Lovable) e `package-lock.json` (adicionado no commit `67f8b16`). Podem divergir.

### 3.2 Camadas

```
routes/index.tsx ──► features/planner/PlannerApp.tsx (todas as telas)
                         │
                         ├─► features/auth/MockAuthProvider  ──► services/auth ──► mocks/seed, mocks/store
                         ├─► features/client/queries         ──► services/{clients,packages,posts}
                         └─► features/admin/queries          ──► services/{clients,notes,packages,plans,posts}
                                                                        │
                                                                        ▼
                                                     mocks/store (sessionStorage) + mocks/seed
```

**Pontos fortes**

- Apenas `services/` importa `mocks/store` — a fronteira de troca para Supabase já está no lugar certo.
- `types/domain.ts` usa nomes em `snake_case` alinhados a futuras colunas (`client_package_id`, `published_at`, `archived_at`…).
- Services retornam `clone(...)`, então a UI nunca muta o "banco" por referência.
- `lib/dates.ts` trabalha com strings `YYYY-MM-DD` e meio-dia UTC — robusto contra mudança de fuso.
- `lib/scheduling.ts` é puro e determinístico; `lib/status.ts` concentra a regra "pendente nunca é atrasado".
- `plan_name_snapshot` em `ClientPackage` preserva histórico — boa modelagem.

### 3.3 Mapa de dependências telas ↔ dados

| Tela (em `PlannerApp.tsx`) | Queries | Services | Mutações |
| --- | --- | --- | --- |
| `LoginScreen` | — | `auth.signInWithPassword` (via provider) | — |
| `ClientWorkspace` (visão geral + calendário) | `portalClientQuery`, `portalPostsQuery`, `portalPackagesQuery` | `getClient`, `listPosts({clientId})`, `listClientPackages` | — |
| `PostDetail` (modal) | — (usa post da lista) | `markPostPublished`, `unmarkPostPublished` | `useTogglePublished` |
| `AdminWorkspace` (visão geral + clientes) | `adminClientsQuery(false)`, `adminActivePackagesQuery`, `adminUpcomingQuery`, `adminEndingQuery` | `listClients`, `listAllActivePackages`, `listUpcomingDeliveries`, `listEndingPackages` | `startPreview` (estado local) |

**Código sem consumidor na UI** (preparado para fases futuras, não é defeito): `assignPlan`, `setPostMedia`, `updatePost`, `notes.*`, `plans.*`, `createClient`/`updateClient`/`setClientArchived`, `requestPasswordReset`, `adminPostQuery`, `adminNotesQuery`, `adminPlansQuery`, `adminPackagesQuery`, `adminClientQuery`, `portalPostQuery`, `isClientVisible`, `resetDB`, `useIsMobile`. Por não serem usados, **também não são testados** — risco de estarem errados quando forem ligados.

---

## 4. Achados

Classificação: **Bloqueante** (impede critério de aceitação atual ou integração segura), **Importante** (deve entrar no próximo ciclo), **Melhoria opcional**.

### 4.1 Bloqueantes

| # | Achado | Local | Impacto |
| --- | --- | --- | --- |
| B1 | Lint falha: CRLF sem `.gitattributes` + 18 arquivos fora do Prettier. | raiz, arquivos listados em 2.1 | Critério "validar build e lint" não pode ser cumprido; qualquer diff fica poluído. |
| B2 | Services não recebem o ator/escopo. `markPostPublished(id)` e `unmarkPostPublished(id)` alteram qualquer post sem verificar `client_id`; `published_by` é sempre `"client"`, inclusive quando é a equipe agindo no modo "visualizar portal". | `services/posts.ts:67-88`, `features/client/queries.ts:31-38` | Na migração, a regra de acesso precisa existir em RLS; hoje ela não está nem documentada no contrato. Dado de auditoria (`published_by`) fica errado no preview. |

### 4.2 Importantes

| # | Achado | Local |
| --- | --- | --- |
| I1 | `PlannerApp.tsx` com 1.028 linhas reúne login, dois workspaces, layout, cards, modal e skeleton. Dificulta revisão, testes e trabalho paralelo de agentes. | `features/planner/PlannerApp.tsx` |
| I2 | Navegação 100% em `useState` (`view`, `selectedPostId`, `previewClientId`). Sem URL por tela; recarregar volta à visão geral; botão voltar do celular sai do app; não há link direto para uma publicação. Relevante para PWA. | `PlannerApp.tsx:250-256, 477` |
| I3 | `useTogglePublished` sem `onError` → falha silenciosa; `onSuccess` invalida **todo** o cache (`qc.invalidateQueries()`). | `features/client/queries.ts:31-38`, `PlannerApp.tsx:973` |
| I4 | Credenciais demo hardcoded em dois lugares fora de `services/`: estado inicial do formulário de login e `MockAuthProvider` importando `DEMO_ACCOUNTS` de `mocks/seed` (quebra a fronteira "só services importam mocks"). | `PlannerApp.tsx:104-105`, `MockAuthProvider.tsx:5,87` |
| I5 | Lógica derivada dentro do componente sem testes: progresso do pacote divide por `posts_total` sem guarda (0 → `NaN%`); "Próximas publicações" pega `status !== "published"` em ordem crescente, então mostra primeiro as **pendentes antigas**. | `PlannerApp.tsx:283-294` |
| I6 | Cobertura de testes: só `app-routing.test.tsx`. Funções puras críticas (`dates`, `scheduling`, `status`, `share.slugify/mediaFilename`) e services sem nenhum teste. | `src/test/` |
| I7 | Admin "Próximas entregas" inclui **rascunhos** (`listUpcomingDeliveries` não filtra `draft`), mas o clique abre o portal do cliente, onde rascunhos são ocultos — a equipe cai numa tela que não mostra o item clicado. | `services/posts.ts:115-126`, `PlannerApp.tsx:553-561` |
| I8 | Textos fixos que podem ser falsos: "Seu conteúdo está em dia." aparece mesmo com pendências; "Tudo sob controle." idem. | `PlannerApp.tsx:318, 533` |
| I9 | Objetivo declarado é PWA, mas não existe `manifest.webmanifest`, ícones nem service worker. | `public/` |
| I10 | Dois lockfiles (`bun.lock` e `package-lock.json`). | raiz |

### 4.3 Melhorias opcionais

| # | Achado | Local |
| --- | --- | --- |
| M1 | "Tentar novamente" faz `window.location.reload()` em vez de `refetch()`. | `PlannerApp.tsx:276, 502` |
| M2 | Menu lateral mobile: sem focus trap; fora da tela continua focável via teclado; botão de fechar (X) sem `aria-label`. | `PlannerApp.tsx:689-703` |
| M3 | `entries` do calendário recriado a cada render, anulando o `useMemo` interno do `MonthCalendar`. | `PlannerApp.tsx:263-267` |
| M4 | Modal fecha sem animação porque `PostDetail` retorna `null` assim que `post` vira `null`. | `PlannerApp.tsx:900` |
| M5 | Prop `audience` declarada e nunca usada; comentário "Detail pages are not built yet" desatualizado. | `PostListItem.tsx:13, 46` |
| M6 | `setTimeout` do "Copiada" não é limpo no unmount. | `CaptionBlock.tsx:15` |
| M7 | Páginas 404 e erro em inglês num app `lang="pt-BR"`. | `routes/__root.tsx:18-76` |
| M8 | README contém texto residual de prompt ("Implement exactly the screenshot and nothing else"). | `README.md:3` |
| M9 | `AGENTS.md` descreve o stack de forma incompleta (ver 3.1). | `AGENTS.md` |
| M10 | Pasta vazia `graft/` na raiz (não versionada). | raiz |

---

## 5. Prontidão para Supabase (não integrar agora — apenas registro)

O que já ajuda:
- Fronteira em `services/` com assinaturas `async` e retornos tipados.
- Query keys separadas por público (`portal/<clientId>/…` e `admin/…`).
- `PostMedia.storage_path` já segue `clients/{client_id}/posts/{post_id}/{n}.jpg` — compatível com políticas de Storage por prefixo.

O que falta decidir/fazer **antes** da integração:
1. **Contrato de autorização** (B2): cada operação do portal deve ser expressa como "cliente X agindo sobre seus próprios dados"; isso vira RLS (`client_id = auth.uid()`-relacionado). Rascunhos e `internal_notes` nunca podem ser legíveis por role `client` — hoje isso é só filtro no service (`includeDrafts`) e comentário.
2. **Sessão**: `MockAuthProvider` lê `profileId` do `sessionStorage`; qualquer pessoa pode editar esse valor e virar admin. Aceitável no mock, mas a interface do provider deve ser desenhada para ser trocada por `supabase.auth` sem tocar nas telas.
3. **Mídia**: `share.ts` faz `fetch(url)` para gerar `File`; com Storage privado será preciso URL assinada + CORS configurado.
4. **SSR**: hoje nada busca dados no servidor (o provider começa em `loading`). Se no futuro houver loaders, `mocks/store` tem um singleton de módulo que seria compartilhado entre requisições no Worker — não usar services mock em loaders.
5. **Nunca** usar `service_role` no frontend (regra do `AGENTS.md`) — operações administrativas sensíveis (criar cliente/convite) exigirão server function ou Edge Function.

---

## 6. Decisões que exigem aprovação do responsável

| Decisão | Por que exige aprovação | Recomendação |
| --- | --- | --- |
| Navegação por URL (I2) | Muda comportamento percebido (voltar, recarregar) e a estrutura de rotas; visual permanece igual. | Aprovar para o **ciclo 2**, depois da divisão do `PlannerApp`. |
| PWA (manifest + service worker) (I9) | Amplia escopo entregue e afeta cache em produção. | Aprovar para ciclo próprio; começar só com manifest + ícones, SW depois. |
| Remover um dos lockfiles (I10) | Exclusão de arquivo de build; o Lovable usa `bun`. | Manter `bun.lock`, remover `package-lock.json`, padronizar instruções no README. |
| Ajustar textos "em dia"/"sob controle" (I8) | Copy é parte do design aprovado. | Tornar condicional ao nº de pendências, mantendo o texto atual quando verdadeiro. |
| Rascunhos em "Próximas entregas" do admin (I7) | Decisão de produto (o que a equipe vê ao clicar). | Manter rascunhos na lista e, no futuro, abrir uma tela admin do post; por ora não alterar. |
