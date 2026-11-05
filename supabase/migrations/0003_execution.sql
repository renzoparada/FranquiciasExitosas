-- =====================================================================
-- 0003 · Ejecución por marca: pasos (Gantt), puertas, actas, tareas,
--        entregables, solicitudes de información, reuniones y decisiones.
--        Incluye las reglas ESCALA 5 y 6 y la creación desde plantilla.
-- =====================================================================

-- ---------- Ayudantes de acceso (usados por RLS y RPC) ----------
create or replace function public.my_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'especialista') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.has_project_access(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.project_members m where m.project_id = p_project and m.profile_id = auth.uid())
$$;

-- ¿El usuario puede ver un registro de este proyecto con esta visibilidad?
create or replace function public.can_see(p_project uuid, p_visibility public.visibility)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.has_project_access(p_project) and (p_visibility = 'cliente' or public.is_staff()))
$$;

create or replace function public.brand_project(p_brand uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select project_id from public.brands where id = p_brand
$$;

-- ---------- Pasos de cada marca (barras del Gantt) ----------
create table public.brand_steps (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands(id) on delete cascade,
  step_code     public.step_code not null references public.tpl_steps(code),
  planned_start date,
  planned_end   date,
  actual_start  date,
  actual_end    date,
  status        public.step_status not null default 'pendiente',
  notes         text,
  updated_at    timestamptz not null default now(),
  unique (brand_id, step_code),
  check (planned_end is null or planned_start is null or planned_end >= planned_start)
);
create trigger trg_brand_steps_updated before update on public.brand_steps
  for each row execute function public.set_updated_at();

-- ---------- Puertas de decisión (rombos) ----------
create table public.brand_gates (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brands(id) on delete cascade,
  gate_code    public.gate_code not null references public.tpl_gates(code),
  planned_date date,
  status       public.gate_status not null default 'pendiente',
  decision     text check (decision in ('franquiciar', 'ajustar', 'no_franquiciar')),
  passed_at    timestamptz,
  updated_at   timestamptz not null default now(),
  unique (brand_id, gate_code)
);
create trigger trg_brand_gates_updated before update on public.brand_gates
  for each row execute function public.set_updated_at();

-- ---------- Actas de puerta ----------
create table public.gate_minutes (
  id                uuid primary key default gen_random_uuid(),
  brand_gate_id     uuid not null references public.brand_gates(id) on delete cascade,
  version           int  not null default 1,
  title             text not null,
  content           jsonb not null default '{}'::jsonb,  -- antecedentes, resultados, decisión, próximos pasos
  status            public.review_status not null default 'borrador',
  sent_at           timestamptz,
  approved_by_user  uuid references public.profiles(id),
  approved_by_name  text,
  approved_at       timestamptz,
  approved_ip       text,
  content_hash      text,
  observation       text,
  pdf_file_id       uuid references public.files(id),
  created_by        uuid references public.profiles(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (brand_gate_id, version)
);
create trigger trg_gate_minutes_updated before update on public.gate_minutes
  for each row execute function public.set_updated_at();

-- ---------- Reuniones, acuerdos y decisiones ----------
create table public.meetings (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  brand_id         uuid references public.brands(id) on delete set null,
  title            text not null,
  scheduled_at     timestamptz not null,
  duration_min     int not null default 60,
  location_or_link text,
  minutes          text,
  visibility       public.visibility not null default 'cliente',
  created_by       uuid references public.profiles(id) default auth.uid(),
  created_at       timestamptz not null default now()
);
create index on public.meetings (project_id, scheduled_at);

-- ---------- Tareas ----------
create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  brand_id           uuid references public.brands(id) on delete cascade,
  step_code          public.step_code,
  title              text not null,
  description        text,
  assignee_id        uuid references public.profiles(id) on delete set null,
  specialty          public.specialty,
  status             public.task_status not null default 'por_hacer',
  priority           public.priority not null default 'media',
  visibility         public.visibility not null default 'cliente',
  planned_start      date,
  due_date           date,
  completed_at       timestamptz,
  sort               int not null default 0,
  template_task_id   uuid references public.tpl_tasks(id) on delete set null,
  created_by         uuid references public.profiles(id) default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.tasks (project_id, status);
create index on public.tasks (brand_id, step_code);
create index on public.tasks (assignee_id);
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.task_checklist_items (
  id      uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  text    text not null,
  done    boolean not null default false,
  sort    int not null default 0
);

create table public.meeting_agreements (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  text       text not null,
  owner_id   uuid references public.profiles(id),
  due_date   date,
  task_id    uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.decisions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  brand_id    uuid references public.brands(id) on delete set null,
  decided_on  date,
  title       text not null,
  description text,
  owner_id    uuid references public.profiles(id),
  file_id     uuid references public.files(id) on delete set null,
  status      text not null default 'pendiente' check (status in ('pendiente', 'tomada')),
  visibility  public.visibility not null default 'cliente',
  created_at  timestamptz not null default now()
);

-- ---------- Entregables ----------
create table public.deliverables (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references public.brands(id) on delete cascade,
  step_code        public.step_code not null,
  title            text not null,
  description      text,
  status           public.review_status not null default 'borrador',
  visibility       public.visibility not null default 'cliente',
  current_version  int not null default 0,
  release_trigger  text not null default 'firma',   -- regla 7: cuota que libera la descarga
  due_date         date,
  sort             int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.deliverables (brand_id, step_code);
create trigger trg_deliverables_updated before update on public.deliverables
  for each row execute function public.set_updated_at();

create table public.deliverable_versions (
  id             uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  version        int  not null,
  file_id        uuid references public.files(id) on delete set null,
  notes          text,
  submitted_at   timestamptz,
  review_status  public.review_status not null default 'borrador',
  reviewed_by    uuid references public.profiles(id),
  reviewed_at    timestamptz,
  review_comment text,
  created_by     uuid references public.profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (deliverable_id, version)
);

-- ---------- Solicitudes de información al cliente ----------
create table public.info_requests (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references public.brands(id) on delete cascade,
  category            text not null,
  title               text not null,
  description         text,
  status              public.request_status not null default 'pendiente',
  is_trademark        boolean not null default false,
  due_date            date,
  reminder_every_days int not null default 7,
  last_reminder_at    timestamptz,
  submitted_at        timestamptz,
  validated_at        timestamptz,
  observation         text,
  sort                int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on public.info_requests (brand_id, status);
create trigger trg_info_requests_updated before update on public.info_requests
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Reglas ESCALA
-- =====================================================================

-- Regla 5 · Sin marca registrada no se vende.
create or replace function public.trademark_ok(p_brand uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.brands b where b.id = p_brand and b.trademark_status = 'registrada')
      or exists (select 1 from public.info_requests r where r.brand_id = p_brand and r.is_trademark and r.status = 'validado')
$$;

-- Regla 6 · Ninguna etapa avanza sin acta.
create or replace function public.gate_minutes_approved(p_brand uuid, p_gate public.gate_code)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gate_minutes m
    join public.brand_gates g on g.id = m.brand_gate_id
    where g.brand_id = p_brand and g.gate_code = p_gate and m.status = 'aprobado'
  )
$$;

create or replace function public.enforce_step_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_gate public.gate_code;
begin
  -- Regla 5
  if new.step_code = 'A1' and new.status <> 'pendiente' and not public.trademark_ok(new.brand_id) then
    raise exception 'REGLA 5 · Sin marca registrada no se vende: el paso Atraer está bloqueado hasta cargar o validar el registro de marca.'
      using errcode = 'P0005';
  end if;

  -- Regla 6
  if new.status = 'cerrado' and (tg_op = 'INSERT' or old.status <> 'cerrado') then
    select closing_gate into v_gate from public.tpl_steps where code = new.step_code;
    if v_gate is not null and not public.gate_minutes_approved(new.brand_id, v_gate) then
      raise exception 'REGLA 6 · Ninguna etapa avanza sin acta: el paso no se puede cerrar sin el acta de la puerta % aprobada por el cliente.', v_gate
        using errcode = 'P0006';
    end if;
    new.actual_end := coalesce(new.actual_end, (now() at time zone 'America/La_Paz')::date);
  end if;

  if new.status in ('en_curso', 'en_revision') and new.actual_start is null then
    new.actual_start := (now() at time zone 'America/La_Paz')::date;
  end if;
  return new;
end $$;

create trigger trg_brand_steps_rules
  before insert or update on public.brand_steps
  for each row execute function public.enforce_step_rules();

create or replace function public.enforce_task_rules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.step_code = 'A1' and new.status <> 'por_hacer' and new.brand_id is not null
     and not public.trademark_ok(new.brand_id) then
    raise exception 'REGLA 5 · Sin marca registrada no se vende: las tareas de Atraer están bloqueadas hasta validar el registro de marca.'
      using errcode = 'P0005';
  end if;
  if new.status = 'hecho' and (tg_op = 'INSERT' or old.status <> 'hecho') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'hecho' then
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger trg_tasks_rules
  before insert or update on public.tasks
  for each row execute function public.enforce_task_rules();

-- =====================================================================
-- Notificaciones y feed de actividad
-- =====================================================================
create or replace function public.notify_project(
  p_project uuid, p_audience text, p_type text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, project_id, type, title, body, link)
  select p.id, p_project, p_type, p_title, p_body, p_link
  from public.profiles p
  where (p_audience in ('clientes', 'todos')
         and p.role = 'cliente'
         and exists (select 1 from public.project_members m where m.project_id = p_project and m.profile_id = p.id))
     or (p_audience in ('consultores', 'todos') and p.role = 'admin'
         and exists (select 1 from public.project_members m where m.project_id = p_project and m.profile_id = p.id));
end $$;

create or replace function public.log_activity(
  p_project uuid, p_brand uuid, p_kind text, p_summary text, p_step public.step_code,
  p_entity_type text, p_entity_id uuid, p_visibility public.visibility)
returns void language sql security definer set search_path = public as $$
  insert into public.activity_feed (project_id, brand_id, actor_id, kind, summary, step_code, entity_type, entity_id, visibility)
  values (p_project, p_brand, auth.uid(), p_kind, p_summary, p_step, p_entity_type, p_entity_id, p_visibility);
$$;

create or replace function public.tasks_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'hecho' and old.status <> 'hecho' then
    perform public.log_activity(new.project_id, new.brand_id, 'tarea_completada',
      'Completamos: ' || new.title, new.step_code, 'task', new.id, new.visibility);
  end if;
  return new;
end $$;
create trigger trg_tasks_activity after update on public.tasks
  for each row execute function public.tasks_activity();

create or replace function public.deliverables_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_project uuid := public.brand_project(new.brand_id);
begin
  if new.status is distinct from old.status then
    if new.status = 'enviado' then
      perform public.log_activity(v_project, new.brand_id, 'entregable_enviado',
        'Te enviamos para revisión: ' || new.title, new.step_code, 'deliverable', new.id, new.visibility);
      if new.visibility = 'cliente' then
        perform public.notify_project(v_project, 'clientes', 'entregable_revision',
          'Entregable para revisar', new.title, '/portal/' || v_project || '/entregables');
      end if;
    elsif new.status = 'aprobado' then
      perform public.log_activity(v_project, new.brand_id, 'entregable_aprobado',
        'Entregable aprobado: ' || new.title, new.step_code, 'deliverable', new.id, new.visibility);
      perform public.notify_project(v_project, 'consultores', 'entregable_revision',
        'El cliente aprobó un entregable', new.title, '/consultor/p/' || v_project || '/entregables');
    elsif new.status = 'observado' then
      perform public.notify_project(v_project, 'consultores', 'entregable_revision',
        'El cliente observó un entregable', new.title, '/consultor/p/' || v_project || '/entregables');
    end if;
  end if;
  return new;
end $$;
create trigger trg_deliverables_activity after update on public.deliverables
  for each row execute function public.deliverables_activity();

create or replace function public.steps_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_project uuid := public.brand_project(new.brand_id);
  v_name text;
  v_brand text;
begin
  if new.status is distinct from old.status and new.status in ('en_curso', 'cerrado') then
    select name into v_name from public.tpl_steps where code = new.step_code;
    select name into v_brand from public.brands where id = new.brand_id;
    perform public.log_activity(v_project, new.brand_id,
      case when new.status = 'en_curso' then 'paso_iniciado' else 'paso_cerrado' end,
      case when new.status = 'en_curso' then 'Iniciamos ' else 'Cerramos ' end || v_name || ' · ' || v_brand,
      new.step_code, 'brand_step', new.id, 'cliente');
  end if;
  return new;
end $$;
create trigger trg_steps_activity after update on public.brand_steps
  for each row execute function public.steps_activity();

create or replace function public.info_requests_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_project uuid := public.brand_project(new.brand_id);
begin
  if new.status is distinct from old.status then
    if new.status = 'recibido' then
      perform public.notify_project(v_project, 'consultores', 'general',
        'El cliente envió información', new.title, '/consultor/p/' || v_project || '/informacion');
    elsif new.status = 'validado' then
      new.validated_at := coalesce(new.validated_at, now());
      perform public.log_activity(v_project, new.brand_id, 'info_validada',
        'Validamos la información: ' || new.title, null, 'info_request', new.id, 'cliente');
    end if;
  end if;
  return new;
end $$;
create trigger trg_info_requests_activity before update on public.info_requests
  for each row execute function public.info_requests_activity();

-- =====================================================================
-- Programación (fechas planificadas)
-- =====================================================================

-- Recalcula las fechas planificadas de una marca a partir de la fecha de
-- inicio del proyecto, el desfase de la marca y las semanas de cada paso.
-- Los pasos L y A2 arrancan con la primera apertura.
create or replace function public.schedule_brand(p_brand uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_start   date;
  v_offset  int;
  v_opening date;
  v_week    int;
  r         record;
  v_pstart  date;
  v_pend    date;
begin
  select p.start_date, b.week_offset, b.first_opening_date
    into v_start, v_offset, v_opening
  from public.brands b join public.projects p on p.id = b.project_id
  where b.id = p_brand;

  v_week := v_offset;
  for r in
    select s.code, s.default_weeks, s.starts_at_first_opening, bs.id as bs_id, bs.planned_start, bs.planned_end
    from public.tpl_steps s
    join public.brand_steps bs on bs.step_code = s.code and bs.brand_id = p_brand
    order by s.sort
  loop
    if r.starts_at_first_opening then
      if v_opening is null then
        v_pstart := null; v_pend := null;
      else
        v_pstart := v_opening;
        v_pend   := v_opening + (r.default_weeks * 7 - 1);
      end if;
    else
      v_pstart := v_start + v_week * 7;
      v_pend   := v_pstart + (r.default_weeks * 7 - 1);
      v_week   := v_week + r.default_weeks;
    end if;

    update public.brand_steps set planned_start = v_pstart, planned_end = v_pend where id = r.bs_id;
    update public.brand_gates g set planned_date = v_pend
      from public.tpl_steps s
      where g.brand_id = p_brand and s.code = r.code and g.gate_code = s.closing_gate;
    update public.tasks t
       set planned_start = v_pstart,
           due_date = case when v_pstart is null then null
                           else least(v_pend, v_pstart + (tt.due_week * 7 - 1)) end
      from public.tpl_tasks tt
     where t.brand_id = p_brand and t.step_code = r.code and t.template_task_id = tt.id;
    update public.deliverables d set due_date = v_pend
     where d.brand_id = p_brand and d.step_code = r.code;
  end loop;
end $$;

create or replace function public.brands_reschedule()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.first_opening_date is distinct from old.first_opening_date
     or new.week_offset is distinct from old.week_offset then
    perform public.schedule_brand(new.id);
  end if;
  if new.trademark_status = 'registrada' and old.trademark_status <> 'registrada' then
    new.trademark_validated_at := coalesce(new.trademark_validated_at, now());
  end if;
  return new;
end $$;
create trigger trg_brands_reschedule before update on public.brands
  for each row execute function public.brands_reschedule();

-- Copia la plantilla ESCALA a una marca.
create or replace function public.instantiate_brand(p_brand uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_project uuid := public.brand_project(p_brand);
begin
  insert into public.brand_steps (brand_id, step_code)
  select p_brand, code from public.tpl_steps on conflict do nothing;

  insert into public.brand_gates (brand_id, gate_code)
  select p_brand, code from public.tpl_gates on conflict do nothing;

  insert into public.tasks (project_id, brand_id, step_code, title, description, specialty, visibility, sort, template_task_id)
  select v_project, p_brand, t.step_code, t.title, t.description, t.specialty, t.default_visibility, t.sort, t.id
  from public.tpl_tasks t;

  insert into public.deliverables (brand_id, step_code, title, description, release_trigger, sort)
  select p_brand, d.step_code, d.title, d.description, d.release_trigger, d.sort
  from public.tpl_deliverables d;

  insert into public.info_requests (brand_id, category, title, description, is_trademark, sort)
  select p_brand, r.category, r.title, r.description, r.is_trademark, r.sort
  from public.tpl_info_requests r;

  perform public.schedule_brand(p_brand);
end $$;

-- Crea un proyecto completo a partir de la plantilla ESCALA.
-- p_brands: [{"name":"Kfresas","week_offset":0,"entry_format":"kiosco","color":"#E30613"}, ...]
-- p_fee:    {"base_amount":35000,"tax_pct":16,"success_fee_pct":10,"currency":"BOB",
--            "installments":[{"label":"Firma","pct":40,"trigger":"firma"}, ...]}   (opcional)
create or replace function public.create_project_from_template(
  p_client uuid, p_name text, p_start date, p_currency public.currency,
  p_brands jsonb, p_fee jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_brand   uuid;
  b         jsonb;
  i         int := 0;
begin
  if not public.is_admin() then
    raise exception 'Solo el consultor puede crear proyectos.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_brands) <> 'array' or jsonb_array_length(p_brands) = 0 then
    raise exception 'El proyecto necesita al menos una marca.';
  end if;

  insert into public.projects (client_id, name, start_date, currency, created_by)
  values (p_client, p_name, p_start, coalesce(p_currency, 'BOB'), auth.uid())
  returning id into v_project;

  -- Miembros: el consultor que crea y los usuarios del cliente.
  insert into public.project_members (project_id, profile_id) values (v_project, auth.uid());
  insert into public.project_members (project_id, profile_id)
  select v_project, cm.profile_id from public.client_members cm where cm.client_id = p_client
  on conflict do nothing;

  for b in select * from jsonb_array_elements(p_brands) loop
    insert into public.brands (project_id, name, week_offset, entry_format, color, sort)
    values (v_project, b->>'name', coalesce((b->>'week_offset')::int, 0),
            nullif(b->>'entry_format', '')::public.entry_format, b->>'color', i)
    returning id into v_brand;
    perform public.instantiate_brand(v_brand);
    if p_fee is not null then
      perform public.create_fee_plan(v_brand, p_fee);
    end if;
    i := i + 1;
  end loop;

  return v_project;
end $$;

-- =====================================================================
-- Acciones del cliente (RPC con validación)
-- =====================================================================

-- Aprobación digital del acta de una puerta (regla 6).
create or replace function public.approve_gate_minutes(p_minutes uuid, p_full_name text, p_ip text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  m         public.gate_minutes%rowtype;
  g         public.brand_gates%rowtype;
  v_project uuid;
  v_step    public.step_code;
  v_next    public.step_code;
  v_gname   text;
begin
  select * into m from public.gate_minutes where id = p_minutes for update;
  if not found then raise exception 'Acta no encontrada.'; end if;
  select * into g from public.brand_gates where id = m.brand_gate_id for update;
  v_project := public.brand_project(g.brand_id);

  if not (public.is_admin() or (public.my_role() = 'cliente' and public.has_project_access(v_project))) then
    raise exception 'No tienes permiso para aprobar esta acta.' using errcode = '42501';
  end if;
  if m.status <> 'enviado' then
    raise exception 'El acta debe estar enviada para poder aprobarla.';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Escribe tu nombre completo para aprobar.';
  end if;

  update public.gate_minutes
     set status = 'aprobado', approved_by_user = auth.uid(), approved_by_name = trim(p_full_name),
         approved_at = now(), approved_ip = p_ip,
         content_hash = encode(digest(m.content::text || m.title, 'sha256'), 'hex')
   where id = p_minutes;

  update public.brand_gates set status = 'superada', passed_at = now() where id = g.id;

  select step_code, name into v_step, v_gname from public.tpl_gates where code = g.gate_code;
  update public.brand_steps set status = 'cerrado' where brand_id = g.brand_id and step_code = v_step;

  -- Abre el siguiente paso (salvo los que dependen de la apertura o del registro de marca).
  select s2.code into v_next
  from public.tpl_steps s1 join public.tpl_steps s2 on s2.sort = s1.sort + 1
  where s1.code = v_step;
  if v_next is not null and v_next not in ('L', 'A2') and (v_next <> 'A1' or public.trademark_ok(g.brand_id)) then
    update public.brand_steps set status = 'en_curso'
     where brand_id = g.brand_id and step_code = v_next and status = 'pendiente';
  end if;

  perform public.log_activity(v_project, g.brand_id, 'puerta_superada',
    'Puerta ' || upper(v_gname) || ' superada', v_step, 'brand_gate', g.id, 'cliente');
  perform public.notify_project(v_project, 'todos', 'general',
    'Puerta ' || upper(v_gname) || ' superada', 'Acta aprobada por ' || trim(p_full_name), '/portal/' || v_project);
end $$;

create or replace function public.observe_gate_minutes(p_minutes uuid, p_observation text)
returns void language plpgsql security definer set search_path = public as $$
declare v_project uuid; v_gate uuid;
begin
  select g.id, public.brand_project(g.brand_id) into v_gate, v_project
  from public.gate_minutes m join public.brand_gates g on g.id = m.brand_gate_id where m.id = p_minutes;
  if not (public.is_admin() or (public.my_role() = 'cliente' and public.has_project_access(v_project))) then
    raise exception 'No tienes permiso.' using errcode = '42501';
  end if;
  update public.gate_minutes set status = 'observado', observation = p_observation
   where id = p_minutes and status = 'enviado';
  update public.brand_gates set status = 'observada' where id = v_gate;
  perform public.notify_project(v_project, 'consultores', 'acta_revision', 'El cliente observó un acta', p_observation,
    '/consultor/p/' || v_project || '/puertas');
end $$;

-- El cliente aprueba u observa un entregable.
create or replace function public.review_deliverable(p_deliverable uuid, p_decision public.review_status, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare d public.deliverables%rowtype; v_project uuid;
begin
  select * into d from public.deliverables where id = p_deliverable for update;
  v_project := public.brand_project(d.brand_id);
  if not (public.is_admin() or (public.my_role() = 'cliente' and public.has_project_access(v_project) and d.visibility = 'cliente')) then
    raise exception 'No tienes permiso.' using errcode = '42501';
  end if;
  if p_decision not in ('aprobado', 'observado') then raise exception 'Decisión no válida.'; end if;
  if d.status <> 'enviado' then raise exception 'Solo se revisan entregables enviados.'; end if;

  update public.deliverable_versions
     set review_status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_comment = p_comment
   where deliverable_id = d.id and version = d.current_version;
  update public.deliverables set status = p_decision where id = d.id;
  if p_comment is not null and length(trim(p_comment)) > 0 then
    insert into public.comments (project_id, entity_type, entity_id, body, visibility)
    values (v_project, 'deliverable', d.id, p_comment, 'cliente');
  end if;
end $$;

-- El cliente marca una solicitud de información como enviada.
create or replace function public.submit_info_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_project uuid;
begin
  select public.brand_project(brand_id) into v_project from public.info_requests where id = p_request;
  if not public.has_project_access(v_project) then
    raise exception 'No tienes permiso.' using errcode = '42501';
  end if;
  update public.info_requests set status = 'recibido', submitted_at = now()
   where id = p_request and status in ('pendiente', 'observado');
end $$;
