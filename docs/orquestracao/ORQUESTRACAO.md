# Orquestração Claude Code + Codex — NOVICX Planner

- **Data:** 2026-10-24 · **Autor:** Claude Code (líder técnico)
- **Escopo:** como Claude e Codex trabalham juntos do ciclo 3 até a homologação.
- **Fonte de verdade do andamento:** `docs/orquestracao/FILA.md` (criada na tarefa O0).
- **Prompts:** `PROMPT-CLAUDE.md` e `PROMPT-CODEX.md` nesta pasta.

---

## 1. Diagnóstico (evidências de 2026-10-24)

### Repositório

| Item               | Estado                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack              | TanStack Start (React 19, SSR), Vite 8, TS strict, Tailwind 4, shadcn/ui, React Query, Supabase                                                          |
| Branch de trabalho | `claude/ciclo-3` (21 commits à frente da `main`; `main` ainda em `67f8b16`, sincroniza com o Lovable)                                                    |
| Banco              | Projeto **dev** remoto `smhrcfiwpqhumdclzdre`; 5 migrations aplicadas e sincronizadas (`migration list --linked` confere)                                |
| Testes             | pgTAP 74/74 (`db:test:remote`), E2E de services 7/7 (`test:supabase:remote`), vitest 66/66 com `--maxWorkers=2`                                          |
| Etapa 0 do ciclo 3 | **em curso, não commitada**: correções I1–I3, M1, M2 da revisão Codex X4 (`scripts/lib/*`, runner, setup E2E). I4 (`reorder_post_media`) ainda não feita |
| Codex ciclo 2      | Só X4 (revisão) entregue. **X1, X2, X3, X8, X9, X10 não feitas** (`codex/ciclo-2` sem commits próprios)                                                  |

### Funcionalidades × critérios do responsável

| Área              | Já existe                                                                                               | Falta                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação      | login real, sessão no navegador, recuperação por e-mail (`resetPasswordForEmail` + `NewPasswordScreen`) | criação de contas pelo admin, confirmação automática no backend, ativar/desativar, link de senha gerado pelo admin, encerrar sessões (Etapas 1–3)           |
| Permissões        | RLS nas 7 tabelas, Storage privado, RPCs `security definer` testadas                                    | bloqueio de conta nas funções auxiliares; remover política de exclusão de clientes                                                                          |
| Administração     | services `clients`/`plans`/`packages` (mock + supabase), métricas parciais                              | telas de clientes e planos, gestão de acesso, indicadores com dados reais                                                                                   |
| Calendário        | calendário por cliente, criação/edição/reagendamento, status visuais, persistência                      | teste manual no modo supabase                                                                                                                               |
| Publicações       | post único, carrossel, upload, substituição, reordenação, URL assinada, confirmar publicação            | `admin_set_post_status`, responsável pela publicação, excluir rascunho, CORS do download, **histórico de alterações (fora do plano atual — entra como T7)** |
| Pacotes           | `assign_plan` gera os slots, snapshot do plano no pacote, progresso                                     | idempotência, teste "catálogo não altera pacote", tela de atribuição                                                                                        |
| Portal da cliente | completo no mock, funcionando no supabase                                                               | auditoria 375 px e teste manual no supabase                                                                                                                 |
| Qualidade         | tsc/lint/vitest/build verdes                                                                            | `maxWorkers` (X1), build Vercel (X8), suíte de telas, jornada E2E completa                                                                                  |

### Ferramentas (verificadas)

| Ferramenta      | Versão / estado                                                                                                                                                                    | Uso na orquestração                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Claude Code     | 2.1.302; Agent tool (subagentes, `isolation: worktree`), Bash em segundo plano com notificação, `-p --json-schema`                                                                 | coordenador e executor                                                            |
| Codex CLI       | 0.164.0; `codex exec` não interativo com `--output-schema`, `-o`, `--json`, `-C`, `-s`, `exec resume`; `codex exec review`; feature `multi_agent` estável e ligada; hooks estáveis | revisor independente e executor de faixa própria, **chamado pelo Claude via CLI** |
| Supabase CLI    | 2.120.0 via `npx` (devDependency); projeto vinculado                                                                                                                               | só o Claude, só dev                                                               |
| Deno            | 2.9.7                                                                                                                                                                              | `deno check`/`deno test` da Edge Function sem deploy                              |
| Docker          | 29.9.1 instalado, **daemon parado**                                                                                                                                                | não usado (decisão do ciclo 2; RAM insuficiente)                                  |
| trail           | 0.23.0, MCP configurado no Claude e no Codex                                                                                                                                       | consultas direcionadas ao código                                                  |
| gh, vercel, bun | **não instalados**                                                                                                                                                                 | PR e deploy Vercel ficam manuais                                                  |
| Máquina         | 13,9 GB visíveis, **2,5 GB livres** com Edge, Cursor, ChatGPT e Spotify abertos; 8 threads; 122 GB livres em D:                                                                    | no máximo **1 Claude + 1 Codex** ativos; testes serializados                      |

### Limitações reais

1. **Vitest estoura memória** com workers padrão (X1 pendente); toda execução usa `--maxWorkers=2`.
2. **Um único banco dev compartilhado**: testes remotos e migrations não podem rodar em paralelo.
3. **Aprovações humanas obrigatórias** (AGENTS.md): push de migration no remoto, deploy de função, mudança de Auth remoto, merge na `main`. São pausas reais, não falhas.
4. Não existe canal nativo Claude ↔ Codex. O que existe e funciona: o Claude executa `codex exec` como processo e lê um JSON validado por schema. `codex queue` só enfileira texto numa sessão aberta e não acorda o Codex de forma confiável (`wake_on_agent_messages` está "under development") — não será usado.
5. SMTP próprio (A4) e projeto de produção estão fora da autonomia: o sistema sai **homologado no dev**, com checklist de produção.

---

## 2. Arquitetura escolhida

### Comparação

| Critério                    | A. Claude implementa, Codex audita | B. Independentes + integrador            | C. Coordenador distribui para os dois | D. Dois coordenadores, filas cruzadas   | **E. Coordenador único + Codex headless por tarefa**        |
| --------------------------- | ---------------------------------- | ---------------------------------------- | ------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| Complexidade                | baixa                              | média                                    | média                                 | alta                                    | baixa–média                                                 |
| Tokens                      | baixo                              | médio                                    | médio                                 | alto (dois contextos longos negociando) | **baixo** (Codex nasce com contexto mínimo por job)         |
| Memória                     | 2 processos                        | 2–3                                      | 2–3                                   | 2 longos + subagentes                   | **1 longo + 1 curto**                                       |
| Paralelismo efetivo         | baixo                              | alto, mas o caminho crítico é sequencial | médio                                 | médio                                   | médio, onde existe                                          |
| Risco de conflito           | baixo                              | alto                                     | médio                                 | alto (dois donos da fila)               | **baixo** (um só escritor da fila)                          |
| Automação                   | manual (você leva recados)         | manual                                   | depende de quem chama o outro         | depende de polling entre sessões        | **real**: o Claude chama o Codex e lê JSON                  |
| Confiabilidade da validação | alta                               | média                                    | alta                                  | alta                                    | **alta**: revisor sem o contexto do autor, reexecuta testes |

**Escolha: E.** Um único coordenador (sessão interativa do Claude Code) dona da fila;
o Codex entra como **processo não interativo por tarefa** (`codex exec`) em
worktrees próprios, nos dois papéis que fazem sentido para ele:
revisor independente (todas as entregas críticas do Claude) e executor de uma
faixa de arquivos disjunta (Vercel, a11y, testes de tela, homologação visual).

Por que não as duas árvores propostas:

- O caminho crítico (bloqueio → Edge Function → services → telas) é **sequencial**.
  Muitos subagentes de implementação só aumentariam conflitos e contexto.
- Dois coordenadores precisariam negociar a mesma fila por arquivos e polling,
  sem mecanismo de despertar confiável. Um escritor único elimina a corrida.
- O revisor que **corrige** o código do autor perde a independência e cria
  edições concorrentes. Aqui o Codex **reproduz** (entrega o teste que falha
  dentro do achado) e o autor corrige; o Codex valida de novo.
- 2,5 GB livres não sustentam mais que dois agentes pesados mais um vitest.

### Diagrama

```
                         VOCÊ (aprovações: migration remota, deploy, Auth, merge main)
                                   ▲  pausa "AGUARDANDO APROVAÇÃO" na FILA
                                   │
┌──────────────────────────────────┴──────────────────────────────────────────┐
│ COORDENADOR — Claude Code (sessão interativa, worktree principal)           │
│ branch claude/ciclo-3 · único escritor de FILA.md · integra e faz merge      │
│                                                                              │
│  Executa ele mesmo: SQL/RLS/Storage, Edge Function, services, auth, telas    │
│  Subagentes (no máx. 1 por vez, só quando há ganho):                         │
│   • Explore ............ varredura só de leitura, devolve conclusão          │
│   • ui-impl (worktree) . tela isolada (ex.: T4 Clientes) enquanto o          │
│                          coordenador faz SQL de T5/T6                        │
└───────┬───────────────────────────────┬──────────────────────────────────────┘
        │ scripts/orq/codex-job.mjs      │ scripts/orq/codex-job.mjs
        │ --kind review                  │ --kind task
        ▼                                ▼
┌──────────────────────────────┐  ┌───────────────────────────────────────────┐
│ CODEX REVISOR (headless)     │  │ CODEX EXECUTOR (headless)                 │
│ worktree ../novicx-review    │  │ worktree ../novicx-codex                  │
│ HEAD destacado no SHA exato  │  │ branch codex/ciclo-3                      │
│ sandbox workspace-write,     │  │ faixa: vite.config.ts, vercel.json,       │
│ sem rede, não commita        │  │ components/layout|common, *.test.tsx      │
│ lê brief + diff + evidências │  │ commita na própria branch                 │
│ reexecuta tsc/lint/vitest/   │  │ entrega em ENTREGA-CODEX.md               │
│ build; multi_agent só em R1/R2│ │                                           │
│ saída: JSON (review-schema)  │  │ saída: JSON (task-schema)                 │
└──────────────┬───────────────┘  └───────────────────┬───────────────────────┘
               │ docs/orquestracao/revisoes/<ID>-r<n>.json                    │
               └──────────────► Coordenador decide ◄──────────────────────────┘
                                (aprovado / correção / bloqueado)
```

### Fluxo por tarefa (máquina de estados da FILA)

```
todo ──► doing ──► review ──► approved ──► done (merge na claude/ciclo-3)
            ▲         │
            │         ├─► changes (achado bloqueante/importante) ──► doing (rodada n+1)
            │         └─► blocked (rodada 3 reprovada, job falhou 2x, ou aprovação humana)
            └── aprovado pelo humano / desbloqueado
```

- **Aprovação** é calculada pelo coordenador, não aceita do `verdict`:
  zero `bloqueante`, zero `importante`, todo critério de aceite `verified`
  com evidência, `commit` do JSON igual ao SHA enviado.
- `melhoria` não bloqueia: vira linha "Melhorias adiadas" na FILA.
- **Limites:** 3 rodadas de revisão por tarefa; 2 tentativas por job que falhou
  (timeout, JSON inválido); 45 min de timeout por job. Esgotou → `blocked`.
- Ausência de achados **não** aprova: critério sem evidência (`not_verifiable`)
  exige nova evidência do coordenador ou vira verificação manual sua.

---

## 3. Plano de execução

Legenda — **Dono:** CL = Claude, CL-sub = subagente do Claude, CX = Codex executor.
**Revisão:** CXR = Codex revisor (esforço `high`; `xhigh` nas marcadas com ★).
**AH** = aprovação humana necessária.

### Fase 0 — Infraestrutura e fechamento do ciclo 2

| ID    | Tarefa                                                                                                                                                                | Dono | Depende        | Aceite                                                                                      | Testes                                           | Revisão                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| O0    | Criar `FILA.md`, `scripts/orq/codex-job.mjs`, schemas, `.orq/` no `.gitignore`, worktrees `../novicx-review` e `../novicx-codex`, `npm ci` nelas; job-fumaça do Codex | CL   | —              | job-fumaça devolve JSON válido; lock, timeout e limite de rodadas testados em vitest        | `scripts/orq/*.test.ts`                          | CXR (o 1º job real revisa o próprio orquestrador) |
| O1    | `db:test:remote --pending`: executa migrations ainda não aplicadas **dentro** do lote revertido antes dos testes                                                      | CL   | O0             | migration pendente é testada sem ficar gravada (prova: `migration list` igual antes/depois) | teste do runner + execução                       | CXR ★                                             |
| E0    | Commit de I1–I3, M1, M2 (já no working tree) + I4 em migration nova (`count(distinct)` e igualdade de conjuntos) + pgTAP de duplicata/ausente/outro post              | CL   | O1             | X4 sem pendências; pgTAP verde com `--pending`                                              | `db:test:remote`, `test:supabase:remote`, vitest | CXR ★ (revalida X4) → AH push                     |
| E0b   | Selo de demonstração só no mock                                                                                                                                       | CL   | O0             | selo ausente em `VITE_DATA_SOURCE=supabase`                                                 | teste de tela                                    | CXR                                               |
| X1    | `maxWorkers` no `vitest.config.ts`                                                                                                                                    | CX   | O0             | `npm test` verde sem flag                                                                   | suíte                                            | CL                                                |
| X2/X3 | A11y do menu mobile; 404/erro em pt-BR                                                                                                                                | CX   | O0             | teclado ok; textos pt-BR                                                                    | testes de componente                             | CL                                                |
| X8    | Build Vercel (preset nitro), `vercel.json`                                                                                                                            | CX   | O0             | `npm run build` gera `.vercel/output`; Lovable não quebra                                   | build                                            | CL                                                |
| X10   | Bundle sem `service_role`/`sb_secret_`                                                                                                                                | CX   | X8             | grep vazio em `.output` e `.vercel/output`                                                  | script                                           | CL                                                |
| H0    | Teste manual das telas no modo supabase (dev local + contas `[E2E]`), desktop e 375 px                                                                                | CX   | E0             | relatório com capturas; defeitos viram tarefas                                              | navegador                                        | —                                                 |
| M0    | Merge `claude/ciclo-3` → `main` (D6)                                                                                                                                  | CL   | E0, E0b, X1–X3 | `main` verde                                                                                | suíte completa                                   | **AH**                                            |

### Fase 1 — Contas e acesso (caminho crítico, sequencial)

| ID  | Tarefa                                                                                                                                                                                     | Dono | Depende | Aceite                                                                                                      | Testes                                                                                         | Revisão                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| T1  | `profiles.blocked_at`; `is_admin()`/`current_client_id()` exigem conta não bloqueada                                                                                                       | CL   | E0      | conta bloqueada perde leitura em todas as tabelas e no Storage imediatamente                                | pgTAP de isolamento (bloqueada × ativa × outra cliente × anon)                                 | CXR ★ → AH push                                             |
| T2  | Edge Function `admin-users`: `create_account` (e-mail confirmado + cliente vinculada, com compensação), `set_access` (ban + `blocked_at`), `reset_access` (`generateLink`), `update_email` | CL   | T1      | lógica em módulo TS puro; entrada Deno fina; JWT validado; exige admin não bloqueado; nunca devolve segredo | vitest do handler (admin, cliente, bloqueado, anon, falha no meio → compensação); `deno check` | CXR ★ → AH deploy                                           |
| T3  | `services/accounts` (mock + supabase); estado "acesso suspenso" no auth; E2E do ciclo de vida                                                                                              | CL   | T2      | criar → definir senha pelo link → logar → bloquear → refresh falha → desbloquear                            | `test:supabase:remote` novo cenário; vitest                                                    | CXR ★ (R1: T1–T3 integrados, `multi_agent` com 2 revisores) |

### Fase 2 — Cadastros (paralelo controlado depois de T3)

| ID  | Tarefa                                                                     | Dono                                               | Depende | Aceite                                                                             | Testes               | Revisão         |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- | -------------------- | --------------- |
| T4a | Remover política de exclusão de clientes                                   | CL                                                 | T3      | `delete` de cliente negado a todos                                                 | pgTAP                | CXR → AH push   |
| T4b | Tela de Clientes: CRUD, arquivar/restaurar, acesso, ficha, atalhos         | CL-sub (worktree, `src/features/admin/clients/**`) | T3      | funciona nos dois modos; 375 px                                                    | testes de tela       | CXR             |
| T5  | `assign_plan` idempotente (`request_id`, trava na cliente); tela de Planos | CL                                                 | T3      | dupla submissão gera 1 pacote; mudar plano no catálogo não altera pacote existente | pgTAP; teste de tela | CXR ★ → AH push |
| X9  | Testes de a11y/responsividade das telas de entrega, clientes e planos      | CX                                                 | T4b, T5 | relatório + `*.test.tsx`                                                           | vitest               | CL              |

T4b roda em paralelo com T4a/T5 (arquivos disjuntos). Nada mais roda em paralelo nesta fase.

### Fase 3 — Publicações

| ID  | Tarefa                                                                                                                                                                                                     | Dono | Depende | Aceite                                                                                 | Testes                                         | Revisão         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------- |
| T6  | RPC `admin_set_post_status` (status, `published_at`, `published_by_user`, formato numa transação); excluir só rascunho; CORS do download                                                                   | CL   | T5      | cliente não chama a RPC; rascunho excluível, demais não                                | pgTAP; E2E download                            | CXR ★ → AH push |
| T7  | **Histórico de alterações** (critério do responsável, novo no plano — D7): `post_events` append-only por trigger (status, data, mídia substituída, publicação), leitura só admin; linha do tempo no editor | CL   | T6      | toda mudança relevante gera 1 evento com ator e horário; ninguém altera/exclui eventos | pgTAP (append-only, isolamento); teste de tela | CXR ★ → AH push |

### Fase 4 — Qualidade e homologação

| ID  | Tarefa                                                                                                                                                                                             | Dono  | Depende        | Aceite                                                | Testes                                | Revisão |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------- | ----------------------------------------------------- | ------------------------------------- | ------- |
| T8  | Métrica "clientes ativos", navegação persistente (`sessionStorage`), testes de tela restantes                                                                                                      | CL    | T7             | indicadores batem com o banco                         | vitest                                | CXR     |
| F1  | Jornada E2E completa no dev: admin cria conta → link de senha → cliente loga → admin entrega carrossel → cliente vê, baixa e confirma → histórico registra → admin bloqueia → cliente perde acesso | CL    | T8             | cenário automatizado verde, limpeza que falha a suíte | `test:supabase:remote`                | CXR ★   |
| H1  | Homologação visual desktop e 375 px no modo supabase                                                                                                                                               | CX    | T8             | relatório sem defeito bloqueante                      | navegador                             | —       |
| R2  | Revisão final integrada (segurança, RLS, regressões, bundle) com `multi_agent`                                                                                                                     | CXR ★ | F1, H1, X8–X10 | 0 bloqueante, 0 importante                            | suíte completa reexecutada pelo Codex | —       |
| M1  | Merge na `main` + checklist de produção (A4 SMTP, projeto prod, Site URL/Redirects, domínio Vercel)                                                                                                | CL    | R2             | `main` verde; checklist entregue                      | suíte completa                        | **AH**  |

**Conclusão do projeto:** todas as linhas da FILA em `done`, R2 aprovado,
`docs/ENTREGA-CLAUDE.md` com a saída da suíte completa (tsc, lint, vitest,
`db:test:remote`, `test:supabase:remote`, build mock e supabase, bundle limpo)
e M1 aprovado por você. Produção é uma decisão separada.

---

## 4. Protocolo de comunicação

### Arquivos

| Caminho                                                                                  | Versionado | Escritor                          | Conteúdo                                                                                   |
| ---------------------------------------------------------------------------------------- | ---------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| `docs/orquestracao/FILA.md`                                                              | sim        | **só o coordenador**              | tabela de tarefas, estado, rodada, SHA, travas, pausas                                     |
| `docs/orquestracao/tarefas/<ID>.md`                                                      | sim        | coordenador                       | brief: objetivo, arquivos, abordagem, riscos, aceite, testes, faixa de commits, evidências |
| `docs/orquestracao/revisoes/<ID>-r<n>.json`                                              | sim        | `codex-job.mjs` (copiado do `-o`) | resultado estruturado do revisor                                                           |
| `docs/orquestracao/review-schema.json` · `task-schema.json`                              | sim        | coordenador                       | contrato de saída do Codex                                                                 |
| `.orq/runs/<ID>-r<n>.*`                                                                  | não        | `codex-job.mjs`                   | prompt montado, eventos `--json`, stderr, `thread_id`                                      |
| `.orq/evidence/<ID>/*.log`                                                               | não        | coordenador                       | saídas de testes remotos e snapshot do catálogo (sem segredos)                             |
| `.orq/locks/codex.lock` · `remote.lock`                                                  | não        | scripts                           | 1 job Codex por vez; 1 operação remota por vez                                             |
| `docs/ENTREGA-CLAUDE.md` · `REVISAO-CODEX.md` · `ENTREGA-CODEX.md` · `REVISAO-CLAUDE.md` | sim        | como no AGENTS.md                 | resumo humano de cada marco                                                                |

### `scripts/orq/codex-job.mjs` (criado em O0)

Um script pequeno em vez de um daemon: o coordenador já é a sessão do Claude,
com fila persistida e notificação de processos em segundo plano.

```
node scripts/orq/codex-job.mjs --kind review --task T1 --round 1 --sha <sha> [--effort high|xhigh] [--resume]
node scripts/orq/codex-job.mjs --kind task   --task X8 --round 1 [--effort high]
```

Responsabilidades:

1. Recusa se `.orq/locks/codex.lock` existe com PID vivo, se a rodada > 3 ou se
   `os.freemem()` < 1,5 GB.
2. Review: `git -C ../novicx-review checkout --detach <sha>` (falha se o worktree
   estiver sujo). Task: confere que `../novicx-codex` está em `codex/ciclo-3` limpo.
3. Monta o prompt: `PROMPT-CODEX.md` + bloco `JOB` (tipo, ID, rodada, SHA, base,
   caminho do brief, das evidências e da revisão anterior).
4. Executa com `execFile` (sem shell; o caminho tem espaço e acento):
   `codex exec -C <worktree> -s workspace-write -c model_reasoning_effort=<e> --output-schema <schema abs> -o .orq/runs/<ID>-r<n>.json --json -`
   (ou `codex exec resume <thread_id>` na revalidação, quando `--resume`).
5. Timeout de 45 min; valida o JSON contra o schema e o `commit` contra o SHA;
   até 2 tentativas; registra tudo em `.orq/runs/`.
6. Copia o JSON para `docs/orquestracao/revisoes/` e imprime um resumo de 5 linhas.

Tarefas H* (homologação no navegador) precisam de rede para o `localhost` e
para o Supabase dev: o script passa `-c sandbox_workspace_write.network_access=true`
**só** para elas. Se o plugin de navegador do Codex não funcionar em `codex exec`
(verificar no O0), H0/H1 rodam numa sessão interativa do Codex (app ou TUI) com
o prompt e o JOB colados por você.

Recuperação: se existe `.orq/runs/<ID>-r<n>.events.jsonl` sem `.json`, o job
morreu → nova tentativa conta para o limite de 2.

### Concorrência

| Recurso                                       | Regra                                                                                                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worktree principal (`claude/ciclo-3`)         | só o coordenador e merges revisados                                                                                                                                                                       |
| `../novicx-review`                            | só o revisor, HEAD destacado; nunca commita                                                                                                                                                               |
| `../novicx-codex` (`codex/ciclo-3`)           | só o executor Codex, arquivos da faixa dele                                                                                                                                                               |
| Worktree de subagente (`.claude/worktrees/…`) | 1 subagente, diretórios declarados no brief                                                                                                                                                               |
| Processos pesados                             | 1 job Codex por vez; o coordenador não roda vitest/build enquanto há job ativo                                                                                                                            |
| Banco dev                                     | só o coordenador; `remote.lock`; testes remotos e push nunca em paralelo                                                                                                                                  |
| Migrations                                    | só o coordenador; timestamp novo; nunca editar migration aplicada; correção = migration aditiva nova                                                                                                      |
| Integração                                    | `git merge --no-ff codex/ciclo-3` na `claude/ciclo-3` só após revisão do Claude e com `git diff --name-only` dentro da faixa do Codex                                                                     |
| `main`                                        | só merge revisado, com aprovação humana (sincroniza com o Lovable)                                                                                                                                        |
| Rollback                                      | código: `git revert` do(s) commit(s) da tarefa; banco: migration compensatória aditiva, nunca `db reset` remoto; antes de cada push, `supabase db dump --linked --schema public` em `.orq/evidence/<ID>/` |

### Contexto mínimo por agente

- Coordenador: lê `FILA.md` e o brief da tarefa atual; usa `trail ask/skeleton/callers`
  antes de abrir arquivos; nunca relê documentos de ciclos anteriores sem motivo.
- Revisor Codex: recebe só o brief, `git diff <base>..<sha>`, as evidências e
  (na revalidação) a revisão anterior. Não lê o projeto inteiro.
- Executor Codex: recebe só o brief da tarefa e os contratos de integração.
- Subagente do Claude: recebe o brief e a lista de arquivos; devolve resumo + commits.
- Revalidação usa `codex exec resume` (o revisor já tem o contexto dos achados);
  se falhar, job novo com a revisão anterior anexada.

---

## 5. Pontos de aprovação humana

| Ponto                    | Quando                        | O que o coordenador apresenta                                                 |
| ------------------------ | ----------------------------- | ----------------------------------------------------------------------------- |
| Push de migration no dev | E0, T1, T4a, T5, T6, T7       | `supabase db push --dry-run`, revisão Codex aprovada, pgTAP `--pending` verde |
| Deploy da Edge Function  | T2                            | diff da função, revisão aprovada, `deno check`                                |
| Mudança de Auth remoto   | se necessário (Redirect URLs) | diff do `config.toml` temporário                                              |
| Merge na `main`          | M0, M1                        | suíte completa                                                                |

**Opcional, para reduzir pausas:** você pode conceder uma autorização permanente
para o **dev** escrevendo na sessão do Claude, por exemplo:
"Autorizo push de migrations **aditivas** no projeto dev `smhrcfiwpqhumdclzdre`
quando o dry-run não tiver DROP/DELETE/TRUNCATE e a revisão Codex estiver sem
bloqueantes e importantes." O coordenador registra isso na FILA e passa a só
informar esses pushes. Deploy de função e merge na `main` continuam pedindo aprovação.
