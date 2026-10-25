# T4b — Tela de Clientes

- **Dono:** CL-sub (worktree) · **Revisão:** CXR (`high`) · **Depende:** T3 · **Faixa:** `src/features/admin/clients/**` (novo), `src/features/admin/AdminWorkspace.tsx` (só o ramo `view === "clients"` passa a renderizar a tela nova), `src/services/mock/clients.ts` (`createClient` sem conta) + `src/services/clients.test.ts` (novo)

## Objetivo

A equipe cadastra, edita, arquiva/restaura clientes e gerencia o acesso delas numa única tela, igual nos dois modos e utilizável a 375 px.

## Abordagem

- `ClientsView` (substitui a grade atual de "Clientes" no `AdminWorkspace`): busca por nome/e-mail, filtro **Ativas / Arquivadas** (`adminClientsQuery(true)` + filtro local), botão "Nova cliente", lista em cartões (uma coluna no celular).
- **Formulário** (`client-form.ts` puro + componente): nome de exibição, nome do negócio (obrigatórios, sem só espaços), profissão, e-mail (obrigatório, formato válido, normalizado `trim().toLowerCase()`), telefone. Erro anunciado com `role="alert"` sem salvar. Criar usa `createClient`; editar usa `updateClient` **sem** o e-mail; e-mail alterado vai por `changeClientEmail` (a função mantém Auth e `clients` juntos). Mensagem de erro do serviço vai para toast/alert.
- **Ficha** (painel/página da cliente): dados, status do acesso (`getAccess` → "Sem acesso" / "Ativo" / "Suspenso"), pacote ativo (`adminPackagesQuery`), e ações:
  - Acesso: "Criar acesso" (`createAccess`) quando `none`; "Suspender"/"Reativar" (`setAccessBlocked`) com confirmação; "Gerar novo link" (`resetAccess`) quando ativo. O link aparece uma vez num campo somente leitura com botão "Copiar" (`navigator.clipboard`, com fallback de seleção); nunca vai para log, toast persistente ou estado global.
  - Arquivar/Restaurar (`setClientArchived`) com confirmação. Arquivar não mexe no acesso; a ficha avisa "Arquivar não suspende o acesso" quando o acesso está ativo.
  - Atalhos: "Abrir entregas" (chama o `onOpenDelivery(clientId)` já existente no `AdminWorkspace`) e "Ver como cliente" (`startPreview`, já existente).
- Não há exclusão de cliente (T4a removeu a política); nenhum botão de excluir.
- Mutations invalidam `["admin"]` (padrão de `PlansView`/`useDeliveryMutation`). Componentes e estilos existentes (`Button`, `EmptyState`, `ErrorState`, `Skeleton`, classes de `PlansView`); confirmações com `AlertDialog` (`src/components/ui/alert-dialog.tsx`).
- Mock: `createClient` deixa de criar perfil (`user_id: ""`), como no Supabase, para que o acesso nasça só por `createAccess` nos dois modos.

## Riscos

- Link de acesso é credencial temporária: só na tela, só para quem gerou.
- `changeClientEmail` em cliente com conta muda o e-mail de login dela; a UI avisa antes de salvar.
- Fora do escopo: métricas, navegação persistente (T8), histórico (T7).

## Critérios de aceite

1. Criar, editar (incluindo e-mail por `changeClientEmail`), arquivar e restaurar no modo mock, com teste de tela; filtro e busca funcionam.
2. Validação do formulário em `client-form.ts` com testes unitários; erro anunciado (`role="alert"`) sem chamar o serviço.
3. Acesso: criar → link exibido e copiável; suspender → status "Suspenso" e "Gerar novo link" indisponível; reativar → "Ativo". Contas de equipe nunca aparecem.
4. Nenhum botão de excluir; arquivadas fora da lista padrão.
5. Mock `createClient` cria cliente sem conta (`getAccess` → `none`), testado em `src/services/clients.test.ts`.
6. Sem rolagem horizontal a 375 px (classes responsivas, uma coluna; teste verifica ausência de larguras fixas > 375 px nos contêineres principais, ou justificativa).
7. `npm test`, `npx tsc --noEmit`, `npm run lint` e `npm run build` verdes; modo Supabase sem mudança de serviço remoto.

## Testes

`src/features/admin/clients/*.test.ts(x)` (mock), `src/services/clients.test.ts`; suíte completa.

## Rodada 2 (achados de `revisoes/T4b-r1.json`)

- **T4b-R1-001:** `createAccess` com link vazio (conta criada, link falhou no Supabase) → a ficha chama `resetAccess(userId)` na hora; só anuncia sucesso com link; se falhar de novo, alerta com "Gerar novo link" disponível. Testes novos para os dois casos.
- Critério 7 (`not_verifiable` na sandbox): evidências em `.orq/evidence/T4b/` (`npm-test-r2.log`, `tsc-r2.log`, `lint-r2.log`, `build-r2.log`, `r2-without-fix.log`).
