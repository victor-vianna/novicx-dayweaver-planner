-- T4a — Clientes não são excluídas pelo app: o histórico (planos, posts,
-- artes) fica preso a elas. Arquivar (archived_at) é o caminho. Sem política
-- de DELETE, a RLS nega a todos; o REVOKE é defesa em profundidade.
-- A compensação da Edge Function admin-users usa service_role (fora da RLS).
drop policy clients_admin_delete on public.clients;
revoke delete on table public.clients from anon, authenticated;
