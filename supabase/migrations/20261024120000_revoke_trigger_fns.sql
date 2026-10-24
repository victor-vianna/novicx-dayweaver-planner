-- Funções de trigger não são RPC: o grant padrão do Supabase dá EXECUTE a
-- authenticated/service_role em funções novas; retirar de authenticated.
-- (Advisor 0029; chamada direta já falharia, mas não deve ficar exposta.)
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.set_updated_at() from authenticated;
