# Plano Atual — Ciclo 2: Supabase + Entrega Administrativa (MVP)

- **Data:** 2026-10-23 (revisão 2)
- **Líder técnico / executor do backend:** Claude Code
- **Revisor independente das mudanças críticas:** Codex
- **Base:** `codex/ciclo-1` aprovado (`docs/REVISAO-CLAUDE.md`)
- **Status:** aprovado. Responsável autorizou (2026-10-23) integração com projeto remoto **de desenvolvimento** existente, com migrations não destrutivas testadas localmente; produção, resets e exclusões remotas continuam proibidos.
- **Andamento (2026-10-24):** C0–C6 ✅. Docker abandonado (memória): C7 feito no remoto dev `smhrcfiwpqhumdclzdre` — migrations aplicadas, pgTAP 74/74 via `db:test:remote`, fluxo E2E 7/7 via `test:supabase:remote`, cadastro público desligado. Endurecimentos: revoga EXECUTE de funções de trigger; vínculo conta→cliente só com e-mail confirmado. Pendente: revisão Codex X4 (C1–C7), teste manual das telas no modo supabase, Vercel (X8), A4 (SMTP). Entrega: `docs/ENTREGA-CLAUDE.md`.
- Planos anteriores: histórico Git deste arquivo.

## Escopo do MVP

O NOVICX Planner **organiza, entrega e acompanha** publicações. Não é editor.

**Dentro:** banco real com isolamento por cliente (RLS), Storage privado com URL
assinada, login real por e-mail/senha com recuperação de acesso, portal da
cliente igual ao atual, e uma tela administrativa para entregar materiais:
cliente → pacote → calendário → data → upload (1 imagem ou carrossel) →
título / legenda opcional / horário → rascunho → pronto → visível para a cliente.
Inclui substituir arquivos, reordenar carrossel, reagendar e alterar status.

**Fora:** editor de artes, criação de posts "do zero" com ferramentas visuais,
IA para legendas, publicação automática em redes, convites automáticos
(Edge Function), CRUD de clientes e de planos na interface, notas internas na
interface, navegação por URL, PWA offline.

## Decisões de arquitetura

1. **Supabase CLI é a fonte da verdade.** Migrations em `supabase/migrations/`,
   testes pgTAP em `supabase/tests/`, seed fictício em `supabase/seed.sql`.
   Desenvolvimento no stack local (Docker). A integração automática do Lovable
   **não** é usada para tabelas, políticas ou auth.
2. **Chave de fonte de dados:** `VITE_DATA_SOURCE = "mock" | "supabase"` (padrão
   `mock`). Assinaturas de `src/services/*` não mudam; cada service delega a
   `services/mock/*` ou `services/supabase/*`. O modo mock fica para demo e testes.
3. **Somente chave publicável no frontend.** Nenhum `service_role` no app nem no repositório.
4. **Usuários criados manualmente** no painel do Supabase (cadastro público
   desligado: `enable_signup = false`). Um trigger em `auth.users` cria o
   `profile` (`role = 'client'`) e **vincula automaticamente** à `clients` com o
   mesmo e-mail. Promoção a admin só por SQL. Ninguém altera o próprio `role`.
5. **Mutações sensíveis por RPC `security definer`:** `set_post_published`
   (cliente e admin) e `assign_plan` (admin; cria pacote + slots numa transação).
   Cliente não tem `UPDATE` direto em nenhuma tabela.
6. **Storage:** bucket privado `post-media`, caminho
   `clients/{client_id}/posts/{post_id}/{uuid}.{ext}` (uuid evita cache ao
   substituir arquivo), limite de tamanho e tipos `image/jpeg|png|webp` no bucket.
   URL assinada (1 h) gerada no service; `PostMedia.url` vira campo derivado.
   Ordem do carrossel = coluna `post_media.position`.
7. **Sessão só no navegador** (sem loaders SSR consultando Supabase).
8. **Demo:** botões "Área cliente/Área equipe" e credenciais pré-preenchidas só
   existem com `VITE_DATA_SOURCE=mock`.

## Simplificações em relação à versão anterior do plano

| Removido / simplificado | Substituído por |
| --- | --- |
| Edge Function `invite-client` | Criação manual no painel + vínculo automático por e-mail (trigger) |
| Slot P genérico | C6 — Entrega administrativa de materiais |
| CRUD de clientes e planos na UI | Seed/SQL ou Supabase Studio (documentado em `docs/OPERACAO.md`) |
| UI de notas internas | Tabela mantida (faz parte das 7), sem tela no MVP |
| Escritas admin "opcionais" no C5 | Movidas para C6, onde são realmente usadas |
| Revisão separada de C4 | Uma revisão de auth + storage + services no marco M1 |

---

## Tarefas de Claude (branch `claude/ciclo-2`)

Complexidade: **P** ≤ ½ dia · **M** ~1 dia · **G** 2–3 dias.

### C0 — Fundação local · P · *autorizado*
- **Objetivo:** stack Supabase local sobe por script; app tem cliente Supabase e a chave `VITE_DATA_SOURCE`, sem mudar comportamento (padrão `mock`).
- **Arquivos:** `package.json` (devDep `supabase`, dep `@supabase/supabase-js`, scripts `db:*`), `supabase/config.toml`, `.env.example`, `.gitignore`, `src/integrations/supabase/client.ts`, `src/lib/data-source.ts`.
- **Riscos:** `bun.lock` desatualizado (não há bun nesta máquina) — registrar; Lovable reinstala pelo `package.json`.
- **Aceite:** `npm run db:start` / `db:stop` funcionam; `signup` desligado no `config.toml`; app inalterado em modo mock; suíte verde.
- **Testes:** unitário de `data-source` (padrão `mock`, valor inválido → `mock`); cliente Supabase não é criado em modo mock.

### C1 — Schema e migrations · M · depende de C0
- **Objetivo:** 7 tabelas (`profiles`, `clients`, `plans`, `client_packages`, `posts`, `post_media`, `internal_notes`), enums, FKs com `on delete` explícito, `check`s (horário, `posts_total > 0`, `position >= 0`, datas), `unique (post_id, position)`, índices por `client_id`/`scheduled_date`, trigger de perfil + vínculo por e-mail, `updated_at`.
- **Arquivos:** `supabase/migrations/*_schema.sql`, `supabase/seed.sql`, `src/integrations/supabase/database.types.ts` (gerado).
- **Aceite:** `db:reset` do zero sem erro; tipos gerados compilam.
- **Testes (pgTAP):** estrutura, restrições, trigger cria profile `client` e vincula pelo e-mail.

### C2 — RLS e isolamento · G · depende de C1
- **Objetivo:** RLS em todas as tabelas; `is_admin()`, `current_client_id()`; RPCs `set_post_published` e `assign_plan`.
- **Regras:** admin tudo · cliente lê só o próprio `clients`, `client_packages`, `posts` não-rascunho e `post_media` desses posts · cliente nunca lê `plans`, `internal_notes`, rascunhos ou dados de outra cliente · `anon` nada.
- **Arquivos:** `supabase/migrations/*_rls.sql`, `supabase/tests/rls_*.test.sql`.
- **Riscos:** política permissiva por engano → **revisão X4 obrigatória antes de C7**.
- **Testes:** A não lê B (todas as tabelas) · A não vê rascunho próprio · A não lê notas/planos · A sem `UPDATE`/`INSERT`/`DELETE` direto · RPC recusa post de B e rascunho · `published_by` correto · `assign_plan` recusa não-admin · A não muda o próprio `role` · anon zero linhas.

### C3 — Storage privado · M · depende de C2
- **Objetivo:** bucket `post-media` + políticas em `storage.objects` (admin lê/escreve/apaga; cliente só lê do próprio prefixo e de post não-rascunho); helper de URL assinada em lote.
- **Arquivos:** `supabase/migrations/*_storage.sql`, `supabase/tests/storage_*.test.sql`, `src/services/supabase/media.ts`.
- **Riscos:** CORS no download/zip de `share.ts`; URL expirar com o modal aberto → reassinar ao abrir.
- **Testes:** A não lê objeto de B nem de rascunho; cliente não grava; tipos/limite recusados.

### C4 — Autenticação real · M · depende de C2
- **Objetivo:** `SupabaseAuthProvider` com a mesma interface de `AuthContextValue` + `useActor()`; login, logout, restauração de sessão, preview do admin; **recuperação de acesso** (pedido por e-mail + tela de nova senha); demo só em mock.
- **Arquivos:** `src/features/auth/*`, `src/services/supabase/auth.ts`, `src/routes/__root.tsx` (escolha do provider), rota de redefinição de senha, `LoginScreen.tsx` (ocultar demo fora do mock).
- **Riscos:** e-mail de recuperação no remoto depende de SMTP (ver A4). Local usa o Mailpit do CLI.
- **Testes:** provider com cliente simulado (estados, erro de login, logout, preview negado a cliente); `LoginScreen` sem botões demo em modo supabase.

### C5 — Services do portal e leituras do admin · G · depende de C3, C4
- **Objetivo:** `services/supabase/*` para `getClient`, `listPosts`, `getPost`, `listClientPackages`, `mark/unmarkPostPublished` (RPC), `listClients`, pacotes ativos/encerrando, próximas entregas; fachadas em `services/*.ts`.
- **Aceite:** em modo supabase local, todas as telas atuais funcionam com o `seed.sql`; em mock, nada muda.
- **Testes:** suíte de contrato comum (mock sempre; local opcional via `npm run test:integration`).

### M1 — Marco local 1 · P
Suíte completa + `db:test` + teste manual nos dois modos. Entrega em `docs/ENTREGA-CLAUDE.md` → **revisão Codex X4** (C1–C5).

### C6 — Entrega administrativa de materiais · G · depende de M1
- **Objetivo:** interface simples, com componentes existentes (`MonthCalendar`, `MediaCarousel`, `StatusBadge`, `Dialog`, `Button`, `PostListItem`), para:
  1. escolher a cliente (lista atual do admin);
  2. ver/atribuir pacote (`assign_plan`);
  3. ver o calendário do pacote com os slots (incluindo rascunhos);
  4. abrir a publicação da data;
  5. enviar 1 ou várias imagens, substituir, remover, reordenar;
  6. editar título, legenda opcional, data e horário;
  7. salvar como rascunho → marcar "pronto" → (opcional) "publicado".
- **Arquivos:** `src/features/admin/delivery/*` (novos), `src/features/admin/AdminWorkspace.tsx` (entrada para a cliente), `src/services/{posts,packages,media}.ts` + implementações mock e supabase, `features/admin/queries.ts`.
- **Riscos:** upload parcial (arquivo enviado e registro falhou) → apagar o objeto órfão; arquivos grandes no celular → limite e mensagem clara; aparência de telas novas → só padrões visuais existentes.
- **Aceite:** fluxo completo em mock e em supabase local; cliente só vê o post depois de "pronto"; reordenar/substituir refletem no portal.
- **Testes:** services de escrita (mock e contrato), upload com falha limpa o órfão, componente de reordenação, fumaça do fluxo.

### M2 — Marco local 2 · P
Suíte completa + teste manual do fluxo admin → cliente. Entrega → **revisão Codex** de C6.

### C7 — Projeto remoto de desenvolvimento · M · **requer autorização**
1. Criar ou conectar projeto dev em São Paulo (`sa-east-1`) via CLI (`supabase link`) — *A2*.
2. Apresentar resumo das migrations (`supabase db push --dry-run`) e **aguardar confirmação** — *A3*.
3. Aplicar, criar usuários de teste manualmente, smoke test, documentar em `docs/OPERACAO.md`.

---

## Tarefas do Codex (branch/worktree próprio: `codex/ciclo-2`)

| ID | Tarefa | Arquivos (trava do Codex) | Quando | Tam. |
| --- | --- | --- | --- | --- |
| X1 | `maxWorkers` do Vitest (suíte estoura memória) | `vitest.config.ts` | já | P |
| X2 | A11y do menu mobile (`aria-label`, `inert`, foco) | `src/components/layout/AppFrame.tsx` | já | P |
| X3 | 404 e erro em pt-BR | `src/routes/__root.tsx` | **já — antes de C4** | P |
| X6 | Copy condicional "em dia"/"sob controle" | `ClientWorkspace.tsx`, `AdminWorkspace.tsx` | já — **antes de C6** | P |
| X4 | Revisão independente de C1–C5 e depois C6 | só leitura → `docs/REVISAO-CODEX.md` | após M1 e M2 | M |
| X7 | Testes específicos/a11y das telas de C6 | arquivos de teste de `features/admin/delivery/` | após C6 | P |

**Travas de Claude:** `supabase/**`, `src/integrations/**`, `src/services/**`,
`src/features/auth/**`, `src/features/admin/**` (a partir de C6),
`src/features/*/queries.ts`, `package.json`, `.env.example`.
Arquivos de X3/X6 voltam para Claude depois do merge das entregas do Codex.

## Sequência

```
Codex:  X1 · X2 · X3 · X6 ──(merge em claude/ciclo-2)──────────── X4 ──────── X4' · X7
Claude: C0 → C1 → C2 → C3 ┐                                     ↑            ↑
                     └ C4 ┴→ C5 → M1 ─────────────────────────────┘ → C6 → M2 ┘ → [A2/A3] C7
```

## Autorizações pendentes

| # | Decisão | Recomendação |
| --- | --- | --- |
| A1 | Merge `codex/ciclo-1` → `main` (sincroniza com Lovable) | Aprovar. Até lá, Ciclo 2 parte de `codex/ciclo-1`. |
| A2 | Criar/conectar projeto remoto dev em `sa-east-1` (plano Free; pausa após 7 dias sem uso) | Aprovar ao fim de M2. |
| A3 | Aplicar migrations no remoto | Confirmar após ver o `--dry-run`. |
| A4 | SMTP próprio para recuperação de senha: o SMTP padrão do Supabase só envia para membros da equipe do projeto, então a recuperação **não chega às clientes** sem um provedor (pode ter custo, ex.: plano gratuito de um serviço transacional) | Decidir antes de liberar o remoto para clientes reais; no dev, testar com e-mails da equipe. |
| A5 | Clientes e planos cadastrados via SQL/Studio, sem tela no MVP | Confirmar a simplificação. |
| A6 | Unificar lockfile em `bun.lock` (X5, adiado) | Decidir; enquanto isso os dois são mantidos. |

## Critérios de aceitação do ciclo

- `db:test` (RLS + Storage) verde e revisado pelo Codex antes de C7.
- Portal da cliente idêntico ao atual nos modos mock e supabase.
- Fluxo administrativo completo funcionando localmente.
- Sem `service_role` no bundle (`grep` em `.output/public`); sem `.env` versionado.
- `tsc`, lint, `vitest`, build verdes em M1 e M2.
- Nenhuma operação remota sem A2/A3.
