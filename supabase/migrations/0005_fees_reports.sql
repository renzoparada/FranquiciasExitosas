-- =====================================================================
-- 0005 · Honorarios (solo consultor), estado de cuenta del cliente,
--        regla 7 (descarga liberada al pagar), informes y resumen del
--        dashboard.
-- =====================================================================

create table public.fee_plans (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null unique references public.brands(id) on delete cascade,
  base_amount     numeric(14,2) not null,
  tax_pct         numeric(5,2)  not null default 16,   -- IVA 13 % + IT 3 %
  success_fee_pct numeric(5,2)  not null default 10,   -- sobre el derecho de entrada
  currency        public.currency not null default 'BOB',
  notes           text,
  created_at      timestamptz not null default now()
);

create table public.installments (
  id          uuid primary key default gen_random_uuid(),
  fee_plan_id uuid not null references public.fee_plans(id) on delete cascade,
  label       text not null,
  pct         numeric(5,2) not null,
  trigger     text not null,                 -- 'firma' | gate_code
  net_amount  numeric(14,2) not null,
  tax_amount  numeric(14,2) not null,
  due_date    date,
  status      public.payment_status not null default 'pendiente',
  invoice_no  text,
  invoiced_at timestamptz,
  paid_at     timestamptz,
  sort        int not null default 0
);

create table public.franchise_sales (
  id                 uuid primary key default gen_random_uuid(),
  brand_id           uuid not null references public.brands(id) on delete cascade,
  franchisee_name    text not null,
  city               text,
  signed_at          date not null,
  entry_fee_amount   numeric(14,2) not null,      -- derecho de entrada cobrado al franquiciado
  success_fee_pct    numeric(5,2) not null,
  tax_pct            numeric(5,2) not null,
  success_fee_net    numeric(14,2) generated always as (round(entry_fee_amount * success_fee_pct / 100, 2)) stored,
  success_fee_tax    numeric(14,2) generated always as (round(entry_fee_amount * success_fee_pct / 100 * tax_pct / 100, 2)) stored,
  currency           public.currency not null default 'BOB',
  status             public.payment_status not null default 'pendiente',
  invoice_no         text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);

create or replace function public.create_fee_plan(p_brand uuid, p_fee jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_plan uuid;
  v_base numeric := (p_fee->>'base_amount')::numeric;
  v_tax  numeric := coalesce((p_fee->>'tax_pct')::numeric, 16);
  inst   jsonb;
  i      int := 0;
begin
  if not public.is_admin() then raise exception 'Solo el consultor.' using errcode = '42501'; end if;
  insert into public.fee_plans (brand_id, base_amount, tax_pct, success_fee_pct, currency)
  values (p_brand, v_base, v_tax, coalesce((p_fee->>'success_fee_pct')::numeric, 10),
          coalesce((p_fee->>'currency')::public.currency, 'BOB'))
  returning id into v_plan;

  for inst in select * from jsonb_array_elements(coalesce(p_fee->'installments',
      '[{"label":"Firma del contrato","pct":40,"trigger":"firma"},
        {"label":"Puerta RENTABLE","pct":30,"trigger":"RENTABLE"},
        {"label":"Puerta REPLICABLE","pct":30,"trigger":"REPLICABLE"}]'::jsonb))
  loop
    insert into public.installments (fee_plan_id, label, pct, trigger, net_amount, tax_amount, sort)
    values (v_plan, inst->>'label', (inst->>'pct')::numeric, inst->>'trigger',
            round(v_base * (inst->>'pct')::numeric / 100, 2),
            round(v_base * (inst->>'pct')::numeric / 100 * v_tax / 100, 2), i);
    i := i + 1;
  end loop;
  return v_plan;
end $$;

-- Al superar una puerta, la cuota ligada vence en 7 días.
create or replace function public.gate_installment_due()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'superada' and old.status <> 'superada' then
    update public.installments i
       set due_date = coalesce(i.due_date, (now() at time zone 'America/La_Paz')::date + 7)
      from public.fee_plans f
     where f.id = i.fee_plan_id and f.brand_id = new.brand_id and i.trigger = new.gate_code::text;
  end if;
  return new;
end $$;
create trigger trg_gate_installment after update on public.brand_gates
  for each row execute function public.gate_installment_due();

-- Regla 7 · Un entregable se descarga cuando su cuota está pagada
-- (si la marca no tiene plan de honorarios, no se bloquea).
create or replace function public.deliverable_released(p_deliverable uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select bool_and(i.status = 'pagada')
    from public.deliverables d
    join public.fee_plans f on f.brand_id = d.brand_id
    join public.installments i on i.fee_plan_id = f.id and i.trigger = d.release_trigger
    where d.id = p_deliverable
  ), true)
$$;

-- Estado de cuenta que ve el cliente (sin notas internas).
create or replace function public.get_account_statement(p_project uuid)
returns table (brand_name text, concept text, net_amount numeric, tax_amount numeric, total numeric,
               currency public.currency, due_date date, status public.payment_status)
language sql stable security definer set search_path = public as $$
  select b.name, i.label, i.net_amount, i.tax_amount, i.net_amount + i.tax_amount, f.currency, i.due_date, i.status
  from public.brands b
  join public.fee_plans f on f.brand_id = b.id
  join public.installments i on i.fee_plan_id = f.id
  where b.project_id = p_project and public.has_project_access(p_project) and (public.is_admin() or public.my_role() = 'cliente')
  union all
  select b.name, 'Fee de éxito · ' || s.franchisee_name, s.success_fee_net, s.success_fee_tax,
         s.success_fee_net + s.success_fee_tax, s.currency, s.signed_at, s.status
  from public.brands b
  join public.franchise_sales s on s.brand_id = b.id
  where b.project_id = p_project and public.has_project_access(p_project) and (public.is_admin() or public.my_role() = 'cliente')
$$;

-- ---------- Informes ----------
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  snapshot     jsonb not null default '{}'::jsonb,
  pdf_file_id  uuid references public.files(id) on delete set null,
  visibility   public.visibility not null default 'cliente',
  generated_by uuid references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now()
);

-- =====================================================================
-- Resumen para el dashboard (cuenta también las tareas internas, pero
-- solo como números; nunca expone su contenido al cliente).
-- =====================================================================
create or replace function public.get_project_overview(p_project uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/La_Paz')::date;
  v_week_start date := date_trunc('week', v_today)::date;
  v_result jsonb;
begin
  if not public.has_project_access(p_project) then
    raise exception 'Sin acceso al proyecto.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'today', v_today,
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'color', b.color, 'logo_url', b.logo_url,
        'entry_format', b.entry_format, 'trademark_ok', public.trademark_ok(b.id),
        'first_opening_date', b.first_opening_date,
        'progress', coalesce((select round(100.0 * count(*) filter (where t.status = 'hecho') / nullif(count(*), 0))
                              from public.tasks t where t.brand_id = b.id
                                and t.step_code not in ('L', 'A2')), 0),
        'steps', (
          select jsonb_agg(jsonb_build_object(
            'code', s.code, 'letter', s.letter, 'name', s.name, 'pillar', s.pillar,
            'status', bs.status, 'planned_start', bs.planned_start, 'planned_end', bs.planned_end,
            'actual_start', bs.actual_start, 'actual_end', bs.actual_end,
            'locked', (s.code = 'A1' and not public.trademark_ok(b.id)),
            'progress', coalesce((select round(100.0 * count(*) filter (where t.status = 'hecho') / nullif(count(*), 0))
                                  from public.tasks t where t.brand_id = b.id and t.step_code = s.code), 0)
          ) order by s.sort)
          from public.tpl_steps s join public.brand_steps bs on bs.step_code = s.code and bs.brand_id = b.id),
        'gates', (
          select jsonb_agg(jsonb_build_object(
            'id', g.id, 'code', g.gate_code, 'name', tg.name, 'status', g.status,
            'planned_date', g.planned_date, 'passed_at', g.passed_at
          ) order by tg.sort)
          from public.tpl_gates tg join public.brand_gates g on g.gate_code = tg.code and g.brand_id = b.id)
      ) order by b.sort)
      from public.brands b where b.project_id = p_project), '[]'::jsonb),
    'stats', jsonb_build_object(
      'tasks_done_week', (select count(*) from public.tasks t
                           where t.project_id = p_project and t.status = 'hecho'
                             and (t.completed_at at time zone 'America/La_Paz')::date >= v_week_start),
      'deliverables_to_review', (select count(*) from public.deliverables d join public.brands b on b.id = d.brand_id
                                  where b.project_id = p_project and d.status = 'enviado' and d.visibility = 'cliente'),
      'minutes_to_review', (select count(*) from public.gate_minutes m
                              join public.brand_gates g on g.id = m.brand_gate_id
                              join public.brands b on b.id = g.brand_id
                             where b.project_id = p_project and m.status = 'enviado'),
      'info_pending', (select count(*) from public.info_requests r join public.brands b on b.id = r.brand_id
                        where b.project_id = p_project and r.status in ('pendiente', 'observado')),
      'next_gate', (select jsonb_build_object('name', tg.name, 'brand', b.name, 'date', g.planned_date,
                                              'days', g.planned_date - v_today)
                      from public.brand_gates g
                      join public.brands b on b.id = g.brand_id
                      join public.tpl_gates tg on tg.code = g.gate_code
                     where b.project_id = p_project and g.status <> 'superada' and g.planned_date is not null
                     order by g.planned_date limit 1),
      'overall_progress', coalesce((select round(100.0 * count(*) filter (where t.status = 'hecho') / nullif(count(*), 0))
                                     from public.tasks t where t.project_id = p_project
                                       and t.step_code not in ('L', 'A2')), 0)
    )
  ) into v_result;
  return v_result;
end $$;
