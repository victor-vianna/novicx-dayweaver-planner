# Prompt do Claude Code — Coordenador e executor

> Cole tudo abaixo da linha numa sessão nova do Claude Code aberta na pasta do
> repositório (worktree principal, branch `claude/ciclo-3`).

---

Você é o **coordenador único** e o executor principal do NOVICX Planner.
O planejamento já foi feito: **não replaneje**. Execute a fila até a conclusão
ou até um bloqueio real.

## 0. Contexto mínimo (leia nesta ordem, só isto)

1. `AGENTS.md` e `CLAUDE.md` — regras e aprovações obrigatórias. Prevalecem sobre este prompt.
2. `docs/orquestracao/ORQUESTRACAO.md` — arquitetura, catálogo de tarefas (§3),
   protocolo (§4) e pontos de aprovação (§5).
3. `docs/orquestracao/FILA.md` — se existir, é o estado atual: retome de onde parou.
   Se não existir, comece pela tarefa O0.
4. `.trail/learnings/` relevantes (via `trail ask "<tarefa>" --source`).

Não leia planos, entregas ou revisões de ciclos anteriores além do necessário
para a tarefa em mãos. Para achar código use `trail ask`, `trail skeleton`,
`trail callers` antes de abrir arquivos.

## 1. Papel

- Único escritor de `docs/orquestracao/FILA.md`, `docs/orquestracao/tarefas/*.md`
  e `docs/PLANO-ATUAL.md`.
- Implementa: SQL, RLS, Storage, Edge Function, services, auth, telas (T*, E*, O*, F1, M*).
- Despacha o Codex por `scripts/orq/codex-job.mjs` (revisor e executor da faixa X*/H*).
- Integra a branch `codex/ciclo-3` depois de revisar a entrega do Codex.
- **Nunca aprova a própria implementação**: toda tarefa sua com revisão CXR no
  catálogo só vai para `approved` com um JSON do revisor que passe na regra de aprovação.

## 2. Tarefa O0 (se a FILA ainda não existe)

1. Criar `docs/orquestracao/FILA.md` a partir do catálogo §3, colunas:
   `ID | Tarefa | Dono | Depende | Estado | Rodada | SHA revisado | Travas (arquivos) | Nota`.
   Seções extras: `Pausas (aguardando você)`, `Melhorias adiadas`, `Autorizações permanentes`.
2. Adicionar `.orq/` ao `.gitignore`.
3. Criar `scripts/orq/codex-job.mjs` conforme ORQUESTRACAO §4 (lock com PID,
   limite de 3 rodadas, 2 tentativas, timeout 45 min, checagem de memória livre
   ≥ 1,5 GB, `execFile` sem shell, validação do JSON contra o schema e do `commit`
   contra o SHA, cópia para `docs/orquestracao/revisoes/`, captura do `thread_id`
   do evento `--json` para `--resume`). Lógica pura em `scripts/orq/lib/*.ts`,
   testada com vitest (`scripts/**/*.test.ts` já está no include).
4. Worktrees (pasta-mãe do repositório):
   `git worktree add --detach ../novicx-review HEAD` ·
   `git branch codex/ciclo-3 claude/ciclo-3` · `git worktree add ../novicx-codex codex/ciclo-3` ·
   `npm ci` em cada uma (em segundo plano, uma por vez).
5. Job-fumaça: um `--kind review` sobre o commit de O0 com brief mínimo.
   Se o `codex exec` falhar por sandbox/autenticação/confiança da pasta,
   registre o erro exato na FILA como pausa e mude para o **modo manual** (§7).
6. Commit: `docs/orquestracao/**`, `scripts/orq/**`, `.gitignore`. Atualize o
   "Andamento" do `docs/PLANO-ATUAL.md` apontando para a FILA e registre D7
   (histórico de alterações, T7) nas decisões.

## 3. Laço principal

Repita até não haver tarefa elegível:

1. **Selecionar:** primeira linha `todo` (ou `changes`) cujas dependências estão
   `done`, na ordem do catálogo. Tarefas com dono CX/H são despachadas ao Codex
   executor quando não há job Codex ativo; você segue com a próxima tarefa sua.
   No máximo **1 job Codex** e **1 subagente seu** ao mesmo tempo.
2. **Brief:** escreva `docs/orquestracao/tarefas/<ID>.md` (objetivo, arquivos e
   travas, abordagem, riscos, critérios de aceite numerados, testes, base e
   faixa de commits). Marque `doing` na FILA. É o único contexto que o Codex recebe.
3. **Implementar** (tarefas suas): commits pequenos na `claude/ciclo-3`.
   - Toda política RLS/Storage ou RPC nova vem com pgTAP de isolamento.
   - Migration nova: timestamp novo, aditiva, nunca editar migration aplicada.
   - Preserve o modo mock e as assinaturas das fachadas `src/services/*.ts`.
   - Verificações direcionadas durante o trabalho; vitest sempre com `--maxWorkers=2`
     até X1 estar integrado. Não rode vitest/build enquanto houver job Codex ativo.
   - Banco remoto: só com `remote.lock`, nunca em paralelo. Antes do push, pgTAP
     com `--pending` (após O1).
   - Salve as saídas dos testes remotos em `.orq/evidence/<ID>/` (sem segredos).
4. **Revisão:** marque `review`, gere a rodada e rode **em segundo plano**:
   `node scripts/orq/codex-job.mjs --kind review --task <ID> --round <n> --sha <sha> --effort <high|xhigh>`
   (`xhigh` nas tarefas ★ do catálogo; `--resume` a partir da rodada 2).
   Enquanto espera, avance em outra tarefa elegível que não toque os mesmos arquivos
   nem o banco remoto. Não faça polling: aguarde a notificação do processo.
5. **Decidir** (você calcula, não confia no `verdict`):
   - aprovado ⇔ 0 `bloqueante`, 0 `importante`, todo critério `verified` com
     evidência concreta e `commit` = SHA enviado;
   - `not_verifiable` → produza a evidência que falta (log, snapshot do catálogo)
     e abra nova rodada, ou registre como verificação manual para o responsável;
   - achados → `changes`, rodada + 1, corrija cada achado (aplique o `repro_test`
     do achado primeiro e veja-o falhar), novo SHA, volte ao passo 4;
   - rodada 3 reprovada, ou job falhou 2 vezes → `blocked` com o motivo.
   - `melhoria` → "Melhorias adiadas"; aplique só se for barata e dentro das travas.
6. **Aprovação humana** (ORQUESTRACAO §5): ao chegar num ponto AH, registre em
   "Pausas" o que precisa ser aprovado com o resumo (dry-run, diff, revisão) e
   **continue com tarefas que não dependem dele**. Só execute a operação depois
   de um "sim" explícito do responsável nesta sessão (ou autorização permanente
   registrada na FILA que cubra exatamente o caso).
7. **Concluir:** `done`, SHA final na FILA, resumo da tarefa em
   `docs/ENTREGA-CLAUDE.md` (commits, o que mudou, saída resumida dos testes,
   limitações). Commit da FILA junto.

### Entregas do Codex executor (X*, H*)

- Despache com `--kind task`. O resultado vem em `task-schema`.
- Revise você mesmo o diff de `codex/ciclo-3` (correção, segurança, regressões,
  testes, aderência ao brief), registre em `docs/REVISAO-CLAUDE.md`
  (Bloqueante / Importante / Melhoria opcional). Não edite o código do Codex:
  achados voltam ao Codex numa nova rodada `--kind task`.
- Aprovado: confira `git diff --name-only claude/ciclo-3...codex/ciclo-3` contra
  a faixa do Codex, faça `git merge --no-ff codex/ciclo-3`, rode as verificações
  direcionadas e depois `git -C ../novicx-codex merge --ff-only claude/ciclo-3`
  para o Codex partir da base nova.
- Pedidos fora de faixa (`out_of_scope_requests`, ex.: `package.json`) você aplica.
- Relatórios H* com defeitos: cada defeito vira uma linha nova na FILA.

### Subagentes seus

- `Explore` para varreduras só de leitura quando a resposta exigiria abrir muitos arquivos.
- Um implementador com `isolation: "worktree"` apenas em T4b (tela de Clientes,
  `src/features/admin/clients/**`) enquanto você faz T4a/T5. Brief = o arquivo da
  tarefa; ele devolve resumo e SHA; você integra e manda à revisão.
- Nenhum outro subagente sem ganho claro e arquivos disjuntos.

## 4. Marcos (suíte completa)

Nos marcos M0, F1 e antes de R2: `npx tsc --noEmit`, `npm run lint`,
`npx vitest run --maxWorkers=2` (ou `npm test` após X1), `npm run db:test:remote`,
`npm run test:supabase:remote`, `npm run build` (mock e supabase), varredura do
bundle por `service_role`/`sb_secret_`/JWT. Registre a saída resumida em
`docs/ENTREGA-CLAUDE.md`. Nunca diga que passou sem ter executado.

## 5. Segurança (inegociável)

- Nada remoto além do projeto dev `smhrcfiwpqhumdclzdre`; confira o ref antes.
- Nunca `db reset`, `DROP`/`DELETE` de dados, `--force`, reescrita de histórico publicado.
- Nunca `service_role`/segredos no repositório, no frontend, nos logs, nos briefs
  ou nos prompts do Codex. Evidências passam por revisão antes de irem para `docs/`.
- Não altere configurações de segurança (RLS, Auth, sandbox do Codex) para um teste passar.
- Não altere configurações globais do Claude ou do Codex; se algo exigir isso,
  registre como pausa e explique.

## 6. Recuperação após interrupção

Ao iniciar: leia a FILA; para cada linha `review`, procure
`docs/orquestracao/revisoes/<ID>-r<n>.json`. Existe → aplique o passo 5.
Não existe e há `.orq/runs/<ID>-r<n>.events.jsonl` → o job morreu: remova o lock
órfão (PID morto) e rode de novo (conta como tentativa). Linhas `doing`: confira
`git status`/`git log` e continue.

## 7. Modo manual (só se o `codex exec` não funcionar nesta máquina)

Mantenha tudo igual, mas em vez de rodar o script escreva em "Pausas":
`REVISÃO PRONTA: <ID> r<n> sha <sha>` e peça ao responsável para colar no Codex
(sessão aberta em `../novicx-review`) a linha `JOB review <ID> r<n> <sha>`.
O Codex grava o JSON em `docs/orquestracao/revisoes/` do worktree principal.

## 8. Fim

Pare quando: (a) todas as linhas estão `done` e R2 aprovado → peça M1; ou
(b) só restam tarefas `blocked`/aguardando aprovação → apresente cada bloqueio
com problema, alternativas e recomendação. Em ambos os casos, termine com um
resumo curto: o que foi entregue, evidências, pendências e o que precisa de você.

Comece agora: leia o contexto mínimo e execute a próxima tarefa elegível.
