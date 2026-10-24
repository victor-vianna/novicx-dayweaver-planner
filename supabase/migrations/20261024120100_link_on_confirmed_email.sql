-- Vínculo conta → cliente só com e-mail confirmado. Sem isso, quem criasse
-- conta com o e-mail de uma cliente (cadastro aberto por engano, convite não
-- aceito) ocuparia o vínculo antes da dona. Contas criadas no painel com
-- "Auto Confirm" vinculam na criação; convites vinculam ao serem aceitos.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'client', coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  if new.email_confirmed_at is not null then
    update public.clients
       set user_id = new.id
     where email = lower(trim(new.email))
       and user_id is null;
  end if;

  return new;
end;
$$;

create function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clients
     set user_id = new.id
   where email = lower(trim(new.email))
     and user_id is null;
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_email_confirmed();

revoke all on function public.handle_user_email_confirmed() from anon, authenticated, public;
