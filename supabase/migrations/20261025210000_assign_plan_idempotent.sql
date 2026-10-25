-- T5 — assign_plan idempotente. Dupla submissão (duplo clique, retry de rede)
-- com o mesmo request_id devolve o pacote já criado em vez de criar outro e
-- encerrar o anterior. A linha da cliente é travada (FOR UPDATE), então duas
-- contratações simultâneas para a mesma cliente rodam em série.
-- A assinatura muda (p_request_id obrigatório): a versão de 4 argumentos sai
-- para não deixar um caminho não idempotente nem chamadas ambíguas. Só código;
-- nenhum dado é alterado.

alter table public.client_packages add column request_id uuid;
create unique index client_packages_request_id_key on public.client_packages (request_id);

drop function public.assign_plan(uuid, uuid, date, jsonb);

create function public.assign_plan(
  p_client_id uuid,
  p_plan_id uuid,
  p_start_date date,
  p_slots jsonb,
  p_request_id uuid
)
returns public.client_packages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_pkg public.client_packages;
  v_end date;
  v_slot jsonb;
  v_i integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Apenas a equipe pode contratar planos' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'Identificador da contratação ausente' using errcode = '22023';
  end if;

  -- Trava a cliente: contratações concorrentes para ela esperam esta terminar.
  perform 1 from public.clients where id = p_client_id for update;
  if not found then
    raise exception 'Cliente não encontrada' using errcode = 'P0002';
  end if;

  select * into v_pkg from public.client_packages where request_id = p_request_id;
  if found then
    if v_pkg.client_id <> p_client_id or v_pkg.plan_id <> p_plan_id
       or v_pkg.start_date <> p_start_date then
      raise exception 'Identificador da contratação já usado em outra contratação'
        using errcode = '22023';
    end if;
    return v_pkg;
  end if;

  select * into v_plan from public.plans where id = p_plan_id;
  if not found then
    raise exception 'Plano não encontrado' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) <> v_plan.posts_per_period then
    raise exception 'Quantidade de horários diferente do plano' using errcode = '22023';
  end if;

  v_end := p_start_date + (greatest(1, v_plan.period_days) - 1);

  update public.client_packages
     set status = 'ended'
   where client_id = p_client_id and status = 'active';

  insert into public.client_packages
    (client_id, plan_id, plan_name_snapshot, posts_total, start_date, end_date, status, request_id)
  values
    (p_client_id, v_plan.id, v_plan.name, v_plan.posts_per_period, p_start_date, v_end, 'active',
     p_request_id)
  returning * into v_pkg;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    v_i := v_i + 1;
    if (v_slot ->> 'date')::date not between p_start_date and v_end then
      raise exception 'Horário fora do período do pacote' using errcode = '22023';
    end if;
    insert into public.posts
      (client_id, client_package_id, format, title, scheduled_date, scheduled_time, status)
    values
      (p_client_id, v_pkg.id, 'single', 'Publicação ' || v_i,
       (v_slot ->> 'date')::date, (v_slot ->> 'time')::time, 'draft');
  end loop;

  return v_pkg;
end;
$$;

revoke all on function public.assign_plan(uuid, uuid, date, jsonb, uuid) from anon, public;
grant execute on function public.assign_plan(uuid, uuid, date, jsonb, uuid) to authenticated;
