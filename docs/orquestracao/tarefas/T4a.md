# T4a — Sem exclusão de clientes

- **Dono:** Claude · **Revisão:** CXR (`high`) · **Depende:** T3 · **Faixa:** `supabase/migrations/20261025200000_no_client_delete.sql`, `supabase/tests/04_clients_no_delete.test.sql` · **Depois:** AH push

## Objetivo

Nenhum papel exclui uma cliente pelo app; o histórico (planos, posts, artes) depende dela. Arquivar (`archived_at`) é o caminho.

## Abordagem

`drop policy clients_admin_delete` (sem política de DELETE a RLS nega) + `revoke delete ... from anon, authenticated` (o DELETE falha com `42501` em vez de afetar 0 linhas). A compensação da Edge Function `admin-users` usa `service_role`, fora da RLS e dos grants de `authenticated`, então continua funcionando. Nenhum código do app exclui clientes (`.delete()` não é usado em `clients`).

## Critérios de aceite

1. Migration nova e aditiva (remove só a política, não toca dados).
2. `clients` com exatamente as políticas `select`, `admin_insert`, `admin_update`; sem privilégio DELETE para `anon`/`authenticated`.
3. Admin, cliente e anon recebem `42501` ao excluir; admin continua arquivando; a cliente segue cadastrada.
4. pgTAP falha sem a migration e passa com `--pending`; demais arquivos inalterados.

## Testes

`npm run db:test:remote` e `-- --pending`. Evidência: `.orq/evidence/T4a/db-test.log` (sem: 04 3/9, exit 1; com: 19 · 47 · 13 · 30 · 9, aplicadas inalteradas).
