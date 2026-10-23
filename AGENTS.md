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
