-- =====================================================================
-- 0012 · Notificaciones (Fase C)
--   · dedup_key: evita repetir el mismo aviso
--   · avisos por comentario nuevo, tarea asignada y cuota pagada
--   · generate_due_notifications(): tareas vencidas, puerta próxima,
--     cuota por vencer y recordatorios de información (lo llama el cron)
-- =====================================================================

alter table public.notifications add column if not exists dedup_key text;
create unique index if not exists notifications_dedup_idx
  on public.notifications (user_id, dedup_key) where dedup_key is not null;

-- Aviso a una persona (ignora duplicados).
create or replace function public.notify_user(
  p_user uuid, p_project uuid, p_type text, p_title text, p_body text, p_link text, p_dedup text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, project_id, type, title, body, link, dedup_key)
  values (p_user, p_project, p_type, p_title, p_body, p_link, p_dedup)
  on conflict (user_id, dedup_key) where dedup_key is not null do nothing;
$$;

-- Miembros de un proyecto por rol.
create or replace function public.project_people(p_project uuid, p_roles public.app_role[])
returns table (id uuid, role public.app_role) language sql stable security definer set search_path = public as $$
  select p.id, p.role from public.profiles p
  join public.project_members m on m.profile_id = p.id and m.project_id = p_project
  where p.role = any (p_roles)
$$;

-- ---------- Comentario nuevo ----------
create or replace function public.comments_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_author public.app_role;
  v_name text;
  v_title text;
  v_portal text;
  v_console text;
  r record;
begin
  select role, coalesce(full_name, email) into v_author, v_name from public.profiles where id = new.author_id;

  if new.entity_type = 'task' then
    select title into v_title from public.tasks where id = new.entity_id;
    v_portal := '/portal/' || new.project_id || '/tareas/' || new.entity_id;
    v_console := '/consultor/p/' || new.project_id || '/tareas/' || new.entity_id;
  elsif new.entity_type = 'deliverable' then
    select title into v_title from public.deliverables where id = new.entity_id;
    v_portal := '/portal/' || new.project_id || '/entregables?d=' || new.entity_id;
    v_console := '/consultor/p/' || new.project_id || '/entregables?d=' || new.entity_id;
  else
    v_portal := '/portal/' || new.project_id;
    v_console := '/consultor/p/' || new.project_id;
  end if;

  for r in select * from public.project_people(new.project_id, array['admin', 'especialista', 'cliente']::public.app_role[]) loop
    continue when r.id = new.author_id;
    -- El cliente solo recibe comentarios visibles; el especialista solo los de sus tareas.
    continue when r.role = 'cliente' and new.visibility <> 'cliente';
    continue when r.role = 'especialista' and not exists (
      select 1 from public.tasks t where t.id = new.entity_id and t.assignee_id = r.id);
    continue when v_author <> 'cliente' and r.role <> 'cliente';  -- entre el equipo no se avisa cada nota
    perform public.notify_user(r.id, new.project_id, 'comentario',
      'Comentario nuevo de ' || v_name, coalesce(v_title, '') || ': ' || left(new.body, 140),
      case when r.role = 'cliente' then v_portal else v_console end, 'comentario:' || new.id);
  end loop;
  return new;
end $$;
drop trigger if exists trg_comments_notify on public.comments;
create trigger trg_comments_notify after insert on public.comments
  for each row execute function public.comments_notify();

-- ---------- Tarea asignada ----------
create or replace function public.tasks_assigned_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and new.assignee_id is distinct from auth.uid() then
    perform public.notify_user(new.assignee_id, new.project_id, 'general', 'Te asignaron una tarea', new.title,
      '/consultor/p/' || new.project_id || '/tareas/' || new.id, 'asignada:' || new.id || ':' || new.assignee_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_tasks_assigned_notify on public.tasks;
create trigger trg_tasks_assigned_notify after insert or update of assignee_id on public.tasks
  for each row execute function public.tasks_assigned_notify();

-- ---------- Cuota pagada (libera entregables, regla 7) ----------
create or replace function public.installments_paid_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_project uuid; v_brand text; r record;
begin
  if new.status = 'pagada' and old.status <> 'pagada' then
    new.paid_at := coalesce(new.paid_at, now());
    select b.project_id, b.name into v_project, v_brand
      from public.fee_plans f join public.brands b on b.id = f.brand_id where f.id = new.fee_plan_id;
    for r in select * from public.project_people(v_project, array['cliente']::public.app_role[]) loop
      perform public.notify_user(r.id, v_project, 'general', 'Pago registrado · ' || v_brand,
        new.label || ': los entregables ligados a esta cuota ya se pueden descargar.',
        '/portal/' || v_project || '/entregables', 'pagada:' || new.id);
    end loop;
  elsif new.status = 'facturada' and old.status = 'pendiente' then
    new.invoiced_at := coalesce(new.invoiced_at, now());
  end if;
  return new;
end $$;
drop trigger if exists trg_installments_paid on public.installments;
create trigger trg_installments_paid before update on public.installments
  for each row execute function public.installments_paid_notify();

-- ---------- Avisos por fecha (los dispara el cron diario) ----------
create or replace function public.generate_due_notifications()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/La_Paz')::date;
  v_before int;
  v_after int;
  t record;
  r record;
begin
  select count(*) into v_before from public.notifications;

  -- Tareas vencidas: responsable y consultores (una vez por tarea).
  for t in
    select tk.id, tk.project_id, tk.title, tk.assignee_id, tk.due_date
    from public.tasks tk join public.projects p on p.id = tk.project_id
    where p.status = 'activo' and tk.status <> 'hecho' and tk.due_date < v_today
  loop
    for r in select * from public.project_people(t.project_id, array['admin']::public.app_role[])
             union select t.assignee_id, 'especialista'::public.app_role where t.assignee_id is not null loop
      perform public.notify_user(r.id, t.project_id, 'tarea_vencida', 'Tarea vencida', t.title || ' · venció el ' || to_char(t.due_date, 'DD/MM'),
        '/consultor/p/' || t.project_id || '/tareas/' || t.id, 'vencida:' || t.id);
    end loop;
  end loop;

  -- Puerta en los próximos 7 días: todo el proyecto.
  for t in
    select g.id, b.project_id, b.name as brand, tg.name as gate, g.planned_date
    from public.brand_gates g join public.brands b on b.id = g.brand_id
    join public.projects p on p.id = b.project_id join public.tpl_gates tg on tg.code = g.gate_code
    where p.status = 'activo' and g.status <> 'superada' and g.planned_date between v_today and v_today + 7
  loop
    for r in select * from public.project_people(t.project_id, array['admin', 'cliente']::public.app_role[]) loop
      perform public.notify_user(r.id, t.project_id, 'puerta_proxima', 'Puerta ' || upper(t.gate) || ' próxima',
        t.brand || ' · prevista para el ' || to_char(t.planned_date, 'DD/MM/YYYY'),
        case when r.role = 'cliente' then '/portal/' || t.project_id || '/puertas/' || t.id
             else '/consultor/p/' || t.project_id || '/puertas/' || t.id end,
        'puerta:' || t.id || ':' || t.planned_date);
    end loop;
  end loop;

  -- Cuota por vencer en 3 días (o vencida): consultor y cliente.
  for t in
    select i.id, b.project_id, b.name as brand, i.label, i.due_date
    from public.installments i join public.fee_plans f on f.id = i.fee_plan_id join public.brands b on b.id = f.brand_id
    where i.status <> 'pagada' and i.due_date is not null and i.due_date <= v_today + 3
  loop
    for r in select * from public.project_people(t.project_id, array['admin', 'cliente']::public.app_role[]) loop
      perform public.notify_user(r.id, t.project_id, 'cuota_por_vencer',
        case when t.due_date < v_today then 'Cuota vencida' else 'Cuota por vencer' end,
        t.brand || ' · ' || t.label || ' · ' || to_char(t.due_date, 'DD/MM/YYYY'),
        case when r.role = 'cliente' then '/portal/' || t.project_id || '/estado-de-cuenta'
             else '/consultor/p/' || t.project_id || '/honorarios' end,
        'cuota:' || t.id || ':' || case when t.due_date < v_today then 'vencida' else 'proxima' end);
    end loop;
  end loop;

  -- Recordatorio de información pendiente: un solo aviso por proyecto
  -- (cada reminder_every_days de cada solicitud).
  for t in
    select b.project_id, count(*) as n, array_agg(q.id) as ids
    from public.info_requests q join public.brands b on b.id = q.brand_id join public.projects p on p.id = b.project_id
    where p.status = 'activo' and q.status in ('pendiente', 'observado')
      and (q.due_date is null or q.due_date <= v_today + 7)
      and (q.last_reminder_at is null or q.last_reminder_at < now() - make_interval(days => q.reminder_every_days))
    group by b.project_id
  loop
    for r in select * from public.project_people(t.project_id, array['cliente']::public.app_role[]) loop
      perform public.notify_user(r.id, t.project_id, 'general', 'Recordatorio: información pendiente',
        case when t.n = 1 then 'Tienes 1 solicitud de información por enviar.'
             else 'Tienes ' || t.n || ' solicitudes de información por enviar.' end,
        '/portal/' || t.project_id || '/informacion', 'info:' || t.project_id || ':' || v_today);
    end loop;
    update public.info_requests set last_reminder_at = now() where id = any (t.ids);
  end loop;

  select count(*) into v_after from public.notifications;
  return v_after - v_before;
end $$;

-- Solo el cron (service_role) genera avisos y solo los triggers usan los ayudantes.
revoke execute on function public.generate_due_notifications() from public, anon, authenticated;
revoke execute on function public.notify_user(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.project_people(uuid, public.app_role[]) from public, anon, authenticated;
revoke execute on function public.comments_notify() from public, anon, authenticated;
revoke execute on function public.tasks_assigned_notify() from public, anon, authenticated;
revoke execute on function public.installments_paid_notify() from public, anon, authenticated;
grant execute on function public.generate_due_notifications() to service_role;
