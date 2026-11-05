-- =====================================================================
-- 0008 · Función para cargar el ejemplo Kfresas y Vaca Lechera.
-- Solo se ejecuta desde el SQL Editor (no está expuesta a los usuarios).
-- =====================================================================

create or replace function public.seed_demo_escala(p_consultant_email text, p_client_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_admin   uuid;
  v_client_user uuid;
  v_client  uuid;
  v_project uuid;
  v_start   date := date_trunc('week', (now() at time zone 'America/La_Paz'))::date;  -- lunes de esta semana
  v_kf      uuid;
begin
  select id into v_admin from public.profiles where lower(email) = lower(p_consultant_email);
  select id into v_client_user from public.profiles where lower(email) = lower(p_client_email);
  if v_admin is null or v_client_user is null then
    raise exception 'Primero crea o invita a ambos usuarios en Authentication → Users.';
  end if;

  update public.profiles set role = 'admin',   full_name = 'Renzo Parada'  where id = v_admin;
  update public.profiles set role = 'cliente', full_name = 'Félix Alarcón' where id = v_client_user;

  -- Actuar como el consultor para que las funciones validen sus permisos.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  insert into public.clients (name, city, created_by)
  values ('Félix Alarcón · Kfresas y Vaca Lechera', null, v_admin)
  returning id into v_client;
  insert into public.client_members (client_id, profile_id, is_primary) values (v_client, v_client_user, true);

  v_project := public.create_project_from_template(
    v_client,
    'Franquiciamiento Kfresas y Vaca Lechera',
    v_start,
    'BOB',
    '[{"name":"Kfresas","week_offset":0,"color":"#E30613"},
      {"name":"Vaca Lechera","week_offset":4,"color":"#1D1D1F"}]'::jsonb,
    '{"base_amount":35000,"tax_pct":16,"success_fee_pct":10,"currency":"BOB"}'::jsonb
  );

  -- Kfresas arranca esta semana con el paso E.
  select id into v_kf from public.brands where project_id = v_project and name = 'Kfresas';
  update public.brand_steps set status = 'en_curso' where brand_id = v_kf and step_code = 'E';

  -- Competidores (todos los datos en [POR CONFIRMAR]).
  insert into public.competitors (project_id, name, source, notes)
  values (v_project, 'Chico Fresa',          null, 'Datos por levantar en el estudio de competidores.'),
         (v_project, 'Merengón Colombiano',  null, 'Datos por levantar en el estudio de competidores.'),
         (v_project, 'Choco Fresa',          null, 'Datos por levantar en el estudio de competidores.'),
         (v_project, 'Antojos',              null, 'Datos por levantar en el estudio de competidores.');

  return v_project;
end $$;

revoke execute on function public.seed_demo_escala(text, text) from public, anon, authenticated;
