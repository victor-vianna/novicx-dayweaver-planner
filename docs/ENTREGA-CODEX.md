# Entrega Codex — Ciclo 1

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
