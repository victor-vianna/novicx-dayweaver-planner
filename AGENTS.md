# NOVICX Planner — Regras dos Agentes

## Objetivo

Desenvolver e manter o NOVICX Planner, um PWA para a NOVICX **organizar,
entregar e acompanhar** publicações das clientes. As clientes consultam
publicações, salvam artes e copiam legendas; a equipe envia os materiais prontos.

O app **não** é editor de conteúdo: nada de editor de artes, geração de texto
por IA ou publicação automática em redes sociais.

Stack: TanStack Start (React 19, SSR, alvo Cloudflare Workers), TypeScript,
Vite, Tailwind 4, shadcn/ui, React Query e Supabase (Postgres, Auth, Storage).

## Supabase

- Gerenciado **somente pelo Supabase CLI**: migrations em `supabase/migrations/`,
  testes em `supabase/tests/`, seed fictício em `supabase/seed.sql`.
- Não usar a integração automática do Lovable para criar tabelas, políticas ou auth.
- Desenvolvimento e testes no stack local (Docker).
- `VITE_DATA_SOURCE=mock` mantém o modo demonstração com dados fictícios;
  `supabase` usa o backend. O modo mock deve continuar funcionando.

## Responsabilidades

Claude Code — líder técnico e executor do backend:
- Arquitetura e planejamento (`docs/PLANO-ATUAL.md`).
- Banco, migrations, RLS, autenticação e Storage.
- Integração dos services e entrega administrativa de materiais.
- Revisão das entregas do Codex.
- Registra entregas em `docs/ENTREGA-CLAUDE.md`.

Codex — ajustes e revisão independente:
- Ajustes pontuais de interface, correções menores e acessibilidade.
- Testes específicos.
- Revisão independente das alterações críticas do Claude
  (SQL, RLS, Storage, auth), registrada em `docs/REVISAO-CODEX.md`.
- Registra entregas em `docs/ENTREGA-CODEX.md`.

Nenhum agente aprova a própria implementação.

## Trabalho paralelo

- Cada agente trabalha em branch ou worktree próprio
  (`claude/<ciclo>`, `codex/<ciclo>`).
- Cada arquivo tem um único dono por vez; as travas ficam em `docs/PLANO-ATUAL.md`.
- Commits na `main` sincronizam com o Lovable: só fazer merge de trabalho revisado
  e manter a `main` funcionando. Não reescrever histórico já publicado.

## Autonomia

Os agentes podem, sem autorização adicional:
- Implementar tarefas do plano aprovado.
- Corrigir bugs e problemas apontados em revisão.
- Refatorar código de baixo risco quando houver benefício direto.
- Criar e executar testes e migrations **locais**.
- Escolher soluções técnicas equivalentes.

## Aprovação obrigatória

Solicitar autorização antes de:
- Criar ou conectar projetos Supabase remotos.
- Aplicar migrations ou alterar políticas/permissões em bancos remotos
  (apresentar antes o resumo, ex.: `supabase db push --dry-run`).
- Modificar ambientes de produção.
- Contratar serviços ou gerar custos.
- Alterar significativamente o design aprovado ou ampliar o escopo.
- Excluir dados ou arquivos importantes.
- Executar operações destrutivas no Git ou no banco.

## Segurança

- Nunca expor credenciais nem versionar `.env`.
- Nunca usar `service_role` no frontend ou no repositório.
- Isolamento entre clientes garantido por RLS e provado por testes.
- Não alterar dados reais de clientes.
- Não conectar serviços externos sem autorização.

## Qualidade

- Preservar o visual existente e reutilizar componentes.
- Rodar verificações direcionadas durante o trabalho e a suíte completa
  (`tsc`, lint, `vitest`, `db:test`, build) nos marcos.
- Não afirmar que testes passaram sem executá-los.
- Registrar falhas e limitações.
- Commits pequenos e descritivos.

## Fluxo

1. Claude planeja e implementa o backend e as tarefas complexas.
2. Codex executa ajustes pontuais em paralelo, sem conflito de arquivos.
3. Cada agente registra sua entrega.
4. Mudanças críticas do Claude são revisadas pelo Codex; entregas do Codex são
   revisadas pelo Claude.
5. O autor corrige; o revisor valida.
6. O ciclo termina quando os critérios de aceitação forem cumpridos.

Se surgir uma decisão que exige autorização, interromper somente a parte afetada.

<!-- trail:start -->
## Trail — repo context graph

This repo is indexed in `.trail/cache/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `trail map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `trail ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `trail grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `trail skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `trail callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `.trail/cache/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `trail ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `trail build` (deterministic,
no API key, $0).
<!-- trail:end -->
