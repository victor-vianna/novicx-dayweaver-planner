-- I4 (revisão X4): reorder_post_media exige que p_media_ids seja exatamente o
-- conjunto de mídias do post — sem duplicatas, nulos, ausentes ou de outro post.
-- Antes, [A, A] passava pela checagem de tamanho e omitia B.
-- create or replace mantém os grants (só authenticated executa).

create or replace function public.reorder_post_media(p_post_id uuid, p_media_ids uuid[])
returns setof public.post_media
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas a equipe pode reordenar mídias' using errcode = '42501';
  end if;
  if p_media_ids is null
     or array_position(p_media_ids, null) is not null
     or (select count(distinct m) from unnest(p_media_ids) as m) <> cardinality(p_media_ids)
     or exists (
       (select id from public.post_media where post_id = p_post_id)
       except
       (select unnest(p_media_ids))
     )
     or exists (
       (select unnest(p_media_ids))
       except
       (select id from public.post_media where post_id = p_post_id)
     ) then
    raise exception 'Lista de mídias não confere com a publicação' using errcode = '22023';
  end if;

  update public.post_media pm
     set position = o.ord - 1
    from unnest(p_media_ids) with ordinality as o(id, ord)
   where pm.id = o.id;

  return query
    select * from public.post_media where post_id = p_post_id order by position;
end;
$$;
