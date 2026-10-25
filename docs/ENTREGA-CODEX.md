# Entrega Codex — Ciclo 1

## X10 — Bundle sem segredos

- **Branch:** `codex/ciclo-3`
- **Commits:** nenhum; o coordenador deve commitar o diff após a revisão.
- **Mudanças:** `scripts/check-bundle.mjs` percorre as saídas publicáveis da
  Vercel/Nitro e retorna 1 ao encontrar material privilegiado ou 2 quando não
  há build. A lógica pura em `scripts/lib/bundle-scan.ts` detecta chaves
  `sb_secret_`, JWT de `service_role`, o nome da variável privilegiada e chaves
  privadas PEM, retornando apenas arquivo e tipo do achado.
- **Testes:** `scripts/lib/bundle-scan.test.ts` cobre cada padrão, os valores
  publicáveis permitidos, JWTs `anon`/`authenticated` e a ausência do valor
  sensível nos achados e na mensagem formatada.
- **Verificações:** o teste direcionado passou com 9 testes; TypeScript passou;
  o lint passou sem erros e manteve os 8 avisos preexistentes de Fast Refresh.
  Os builds `mock` e `supabase`, executados com `--configLoader native`, foram
  escaneados com 132 arquivos cada e zero achados.
- **Limitações:** o comando literal `npm run build` não carregou a configuração
  por `spawn EPERM` na sandbox. O fallback nativo executou o mesmo pipeline nos
  dois modos e concluiu os builds e escaneamentos.
- **Revisão do Claude:** conferir os padrões de detecção, os códigos de saída
  do comando e repetir os dois builds/escaneamentos antes de integrar.

## X8 — Build para a Vercel

- **Branch:** `codex/ciclo-3`
- **Commits:** nenhum; o coordenador fará o commit do diff entregue.
- **Mudanças:** `vite.config.ts` fixa `nitro.preset` em `vercel` para builds
  externos ao Lovable. O wrapper dá precedência à configuração do ambiente
  Lovable e mantém o preset `cloudflare-module` nesse fluxo. `vercel.json`
  declara `npm run build` e desativa a detecção de framework; o Nitro escreve
  diretamente o Build Output API v3, portanto não se configura
  `outputDirectory`.
- **Deploy na Vercel:** configurar somente `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_DATA_SOURCE` (`mock` ou `supabase`),
  sem `service_role`. Usar o comando `npm run build`. A saída esperada é
  `.vercel/output/config.json`, `.vercel/output/functions/__server.func/` e
  `.vercel/output/static/`.
- **Verificações:** builds mock e Supabase passaram com
  `npx vite build --configLoader native`; ambos geraram o contrato Vercel, uma
  função SSR e 25 arquivos estáticos. A função gerada respondeu `200` em `/` e
  `404` em `/rota-inexistente-x8`. `npx tsc --noEmit` passou;
  `npm run lint` passou sem erros e com os 8 avisos preexistentes de Fast
  Refresh; Prettier passou nos dois arquivos de configuração. Um build de
  compatibilidade com `LOVABLE_SANDBOX=1` confirmou o preset
  `cloudflare-module` e gerou `dist/client`, `dist/server` e o `wrangler.json`.
- **Limitações:** o comando literal `npm run build` não conseguiu carregar a
  configuração nesta sandbox devido a `spawn EPERM`; o fallback nativo do Vite
  executou o mesmo pipeline com sucesso. `.vercel/` não está no `.gitignore` e
  a saída local foi removida após a verificação para não contaminar o diff.
- **Riscos para o Lovable:** uma futura versão do wrapper pode alterar a
  precedência do preset; por isso, o Claude deve manter no marco a verificação
  do build com `LOVABLE_SANDBOX=1`. O build validado preservou o alvo Cloudflare
  mesmo com o preset Vercel declarado no projeto.
- **Revisão do Claude:** reexecutar `npm run build` fora da sandbox nos modos
  mock e Supabase, confirmar a estrutura `.vercel/output` e avaliar a inclusão
  de `.vercel/` no `.gitignore`, que está fora da faixa desta tarefa.

## X3 — Páginas 404 e de erro em pt-BR

- **Branch:** `codex/ciclo-3`
- **Commits:** nenhum; o coordenador fará o commit do diff entregue.
- **Mudanças:** as páginas 404 e de erro da rota raiz agora exibem título,
  mensagem e ações em pt-BR. A tela de erro mantém somente uma mensagem segura
  para o usuário, sem exibir mensagem técnica ou stack trace, e oferece tentar
  novamente ou voltar ao início. O provider de autenticação e o restante da
  rota raiz foram preservados.
- **Testes:** `root-status-pages.test.tsx` cobre os textos e o link da página 404, os textos
  e as duas ações da página de erro, o acionamento de `invalidate`/`reset` e a
  ausência de mensagem técnica e stack trace na interface.
- **Verificações:** o fallback do Vitest com `--configLoader native` passou com
  1 arquivo e 2 testes; `npx tsc --noEmit` passou; `npm run lint` passou sem
  erros e com os 8 avisos preexistentes de Fast Refresh; o build com
  `--configLoader native` concluiu client, SSR e Nitro/Cloudflare.
- **Limitações:** os comandos padrão do Vitest e do build não carregaram a
  configuração por `spawn EPERM` na sandbox. Os fallbacks equivalentes com
  `--configLoader native` passaram. O build manteve apenas os avisos já
  conhecidos de `vite-tsconfig-paths` e `inlineDynamicImports`.
- **Revisão do Claude:** confirmar que o diff em `__root.tsx` ficou restrito aos
  componentes de 404/erro e reexecutar as verificações antes de integrar.

## X2 — A11y do menu mobile

- **Branch:** `codex/ciclo-3`
- **Commits:** nenhum; o coordenador fará o commit do diff entregue.
- **Mudanças:** o acionador do menu agora informa nome, estado e painel controlado
  por `aria-label`, `aria-expanded` e `aria-controls`. Até o breakpoint desktop,
  o painel fechado recebe `inert` e `aria-hidden`; ao abrir, recebe foco. `Esc`,
  o botão interno, o backdrop e a navegação fecham o painel, com restauração do
  foco para o acionador. As classes responsivas e o comportamento desktop foram
  preservados.
- **Testes:** `AppFrame.test.tsx` cobre os atributos ARIA, isolamento do painel
  fechado, foco ao abrir, fechamento/restauração de foco por `Esc`, a faixa entre
  768 e 1023 px e a disponibilidade da barra lateral no desktop.
- **Verificações:** o comando Vitest solicitado encontrou `spawn EPERM` ao
  carregar a configuração; o fallback com `--configLoader native` passou com 1
  arquivo e 3 testes. `npx tsc --noEmit` e `npm run lint` passaram; o lint manteve
  apenas 8 avisos preexistentes de Fast Refresh, sem erros.
- **Limitações:** o Vitest sem o fallback não pôde iniciar por restrição de
  subprocesso da sandbox. Nenhum teste visual foi exigido para esta tarefa.
- **Revisão do Claude:** confirmar o pareamento do breakpoint `lg` com a media
  query de 64 rem e o fluxo de foco do menu em navegador real; criar o commit da
  entrega sem incluir o cache local não versionado do Trail.

## X1 — `maxWorkers` do Vitest

- **Branch:** `codex/ciclo-3`
- **Commits:** nenhum; a sandbox negou a criação de `index.lock` no diretório
  Git do worktree principal, que fica fora da raiz gravável.
- **Mudança:** `vitest.config.ts` agora define `maxWorkers: 2`, preservando
  `environment`, `globals`, `setupFiles`, `include`, plugins e aliases.
- **Verificações:** `npx tsc --noEmit` e `npx eslint vitest.config.ts` passaram
  sem erros. `npm test` não iniciou porque o Vite recebeu `spawn EPERM` ao
  carregar a configuração. O fallback com `--configLoader native` executou 20
  arquivos e 170 testes em 44,91 s: 19 arquivos/168 testes passaram e os dois
  testes que criam subprocessos em `scripts/orq/lib/job.test.ts` falharam pelo
  mesmo bloqueio `spawn EPERM` da sandbox.
- **Limitações:** o critério de `npm test` verde sem flags não pôde ser validado
  neste ambiente. A configuração compila e passa no lint, mas a suíte completa
  deve ser reexecutada fora desta sandbox.
- **Revisão do Claude:** confirmar `npm test` sem flags e criar os commits da
  entrega após validar o diff, já que este worktree não pôde gravar no Git.

- **Branch:** `codex/ciclo-1`
- **Commits:**
  - `7d470a8` — Configura finais de linha do repositório
  - `1a221d1` — Formata código com Prettier
  - `88cd32d` — Testa regras puras do planner
  - `7f5c1cd` — Isola autenticação demo da interface
  - `957b4d6` — Exige ator nas mutações de publicação
  - `842ac00` — Trata falhas ao atualizar publicações
  - `5cd0860` — Divide telas e extrai métricas do planner
  - T7 — este commit, com a validação e o registro da entrega
- **Tarefas concluídas:** T1, T2, T3, T4, T5, T6 e T7.

## Alterações entregues

- Configuração de LF por `.gitattributes` e formatação dos 18 arquivos previstos.
- 55 novos testes além do teste de roteamento inicial, cobrindo regras de datas,
  agendamento, status, nomes de arquivos, autenticação, autorização de posts,
  mutação/caches, resumo do cliente e fumaça do `PlannerApp`.
- Contas e preenchimento demo isolados em `services/auth.ts`; nenhum import de
  `@/mocks` permanece fora de `src/services/` e `src/mocks/`.
- Tipo `Actor` obrigatório nas mutações de publicação, com escopo por cliente e
  `published_by` correto para cliente e admin em preview.
- Erros de mutação exibidos via toast e invalidação restrita ao portal afetado e
  ao prefixo de cache administrativo.
- `PlannerApp.tsx` reduzido de 1.034 para 22 linhas. Telas, layout, modal, cards e
  estados foram separados; nenhum arquivo novo ultrapassa 300 linhas.
- Métricas do cliente extraídas para função pura, incluindo proteção para
  `posts_total = 0`; entradas do calendário memoizadas e helper de iniciais
  compartilhado.

## Desvios do plano e motivo

- Para fazer o lint passar no checkout Windows atual, o Prettier também
  normalizou apenas os finais de linha de `src/components/ui/`. Esses arquivos
  não produziram diff nem entraram nos commits; a formatação semântica ficou
  restrita aos 18 arquivos listados no plano.
- O conector de controle do navegador não expôs apps ou browsers nesta sessão.
  A inspeção visual foi feita com o Microsoft Edge já instalado, em modo
  headless, controlado localmente por CDP. Nenhuma dependência foi instalada e
  os artefatos temporários foram removidos ao final.

## Bugs encontrados durante a implementação

- Confirmado e corrigido o caso `posts_total = 0`, que antes produziria
  progresso `NaN%`.
- Nenhum outro bug de produção fora do escopo aprovado foi alterado.

## Validação automatizada final

| Verificação        | Resultado                                                 |
| ------------------ | --------------------------------------------------------- |
| `npx tsc --noEmit` | Passou, 0 erros                                           |
| `npm run lint`     | Passou, 0 erros e 8 avisos `react-refresh` já catalogados |
| `npm test`         | Passou, 11 arquivos e 56 testes, 18,32 s                  |
| `npm run build`    | Passou, builds client, SSR e Nitro/Cloudflare concluídos  |

O build manteve dois avisos não bloqueantes do toolchain: recomendação do Vite
sobre `vite-tsconfig-paths` e aviso do Nitro/Rolldown sobre
`inlineDynamicImports` com code splitting.

## Teste visual realizado

- **Desktop (1440 × 900):** login, visão geral do cliente, calendário, modal de
  publicação, visão geral administrativa, lista de clientes e preview do portal.
- **Mobile (390 × 844):** login, visão geral do cliente e menu lateral aberto.
- Foram exercitadas navegação entre telas, abertura do modal, entrada no preview
  e abertura do menu. As capturas foram inspecionadas sem regressões visuais.
- Uma comparação automatizada entre o arquivo anterior e os módulos extraídos
  confirmou o mesmo conjunto de textos literais e a mesma contagem de classes
  `className` estáticas.

## Limitações e pendências

- A revisão independente de Claude em `docs/REVISAO-CLAUDE.md` ainda é a próxima
  etapa do fluxo e não foi simulada pelo Codex.
- Itens do backlog que exigem aprovação (rotas por URL, PWA, lockfile, copy e
  comportamento de rascunhos) permaneceram intocados.
- Nenhum serviço externo, Supabase, ambiente de produção ou dado real foi
  acessado.
