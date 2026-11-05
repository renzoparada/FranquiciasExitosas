-- =====================================================================
-- 0004 · Matriz de franquiciabilidad, competidores, modelo financiero,
--        manual, unidades y auditorías. Reglas ESCALA 1, 2 y 4.
-- =====================================================================

-- ---------- Matriz de franquiciabilidad (paso E) ----------
create table public.franchisability_scores (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands(id) on delete cascade,
  criterion_code text not null references public.tpl_criteria(code),
  score         int check (score between 1 and 5),
  evidence      text,
  data_label    public.data_label,
  scored_by     uuid references public.profiles(id) default auth.uid(),
  updated_at    timestamptz not null default now(),
  unique (brand_id, criterion_code),
  check (score is null or data_label is not null)               -- regla 1
);
create trigger trg_fscores_updated before update on public.franchisability_scores
  for each row execute function public.set_updated_at();

-- Promedio ponderado, semáforo y veto.
create or replace view public.v_franchisability
with (security_invoker = true) as
select
  b.id as brand_id,
  b.project_id,
  count(s.score)                                                   as scored,
  (select count(*) from public.tpl_criteria)                       as total_criteria,
  round(sum(s.score * c.weight) / nullif(sum(c.weight) filter (where s.score is not null), 0), 2) as weighted_avg,
  bool_or(c.is_veto and s.score = 1)                               as vetoed,
  case
    when bool_or(c.is_veto and s.score = 1) then 'rojo'
    when count(s.score) < (select count(*) from public.tpl_criteria) then 'incompleto'
    when sum(s.score * c.weight) / sum(c.weight) >= 4 then 'verde'
    when sum(s.score * c.weight) / sum(c.weight) >= 3 then 'amarillo'
    else 'rojo'
  end as traffic_light
from public.brands b
left join public.franchisability_scores s on s.brand_id = b.id
left join public.tpl_criteria c on c.code = s.criterion_code
group by b.id, b.project_id;

-- ---------- Competidores (paso E) ----------
create table public.competitors (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  name             text not null,
  format           public.entry_format,
  format_notes     text,
  digital_presence jsonb not null default '{}'::jsonb,  -- {"instagram": "...", "tiktok": "...", "seguidores": null}
  source           text,
  observed_on      date,
  confidence       public.data_label,
  notes            text,
  visibility       public.visibility not null default 'cliente',
  created_at       timestamptz not null default now()
);

create table public.competitor_locations (
  id            uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  address       text,
  city          text,
  lat           double precision,
  lng           double precision
);

create table public.competitor_prices (
  id               uuid primary key default gen_random_uuid(),
  competitor_id    uuid not null references public.competitors(id) on delete cascade,
  size_name        text not null,
  price            numeric(12,2),
  currency         public.currency not null default 'BOB',
  grams            numeric(10,2),
  service_time_sec int,
  data_label       public.data_label,
  check ((price is null and grams is null and service_time_sec is null) or data_label is not null) -- regla 1
);

-- ---------- Modelo financiero (paso S) ----------
create table public.financial_scenarios (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brands(id) on delete cascade,
  scenario   public.scenario not null,
  format     public.entry_format,
  notes      text,
  created_at timestamptz not null default now(),
  unique (brand_id, scenario)
);

create table public.financial_values (
  id          uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.financial_scenarios(id) on delete cascade,
  metric      text not null check (metric in (
                'inversion', 'ventas_mensuales', 'costo_ventas_pct', 'gastos_fijos_mensuales',
                'punto_equilibrio_mensual', 'punto_equilibrio_meses', 'ebitda_mensual', 'ebitda_pct',
                'payback_meses', 'canon_entrada', 'regalia_pct', 'fondo_marketing_pct')),
  value       numeric(14,2),
  currency    public.currency,
  data_label  public.data_label,
  source      text,
  updated_at  timestamptz not null default now(),
  unique (scenario_id, metric),
  check (value is null or data_label is not null)               -- regla 1
);

-- Regla 2 · El franquiciado gana primero.
create table public.franchise_terms (
  brand_id             uuid primary key references public.brands(id) on delete cascade,
  entry_fee            numeric(14,2),
  royalty_pct          numeric(5,2),
  marketing_fund_pct   numeric(5,2),
  currency             public.currency not null default 'BOB',
  data_label           public.data_label,
  payback_validated_at timestamptz,
  payback_validated_by uuid references public.profiles(id),
  updated_at           timestamptz not null default now(),
  check ((entry_fee is null and royalty_pct is null and marketing_fund_pct is null) or data_label is not null)
);

create or replace function public.enforce_franchisee_first()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.entry_fee is not null or new.royalty_pct is not null) and new.payback_validated_at is null then
    raise exception 'REGLA 2 · El franquiciado gana primero: valida el payback de la unidad antes de guardar el canon o la regalía.'
      using errcode = 'P0002';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_franchise_terms_rule2 before insert or update on public.franchise_terms
  for each row execute function public.enforce_franchisee_first();

-- Valida el payback (requiere el payback del escenario moderado cargado).
create or replace function public.validate_payback(p_brand uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el consultor valida el payback.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.financial_values v
    join public.financial_scenarios s on s.id = v.scenario_id
    where s.brand_id = p_brand and s.scenario = 'moderado' and v.metric = 'payback_meses' and v.value is not null
  ) then
    raise exception 'Carga el payback del escenario moderado antes de validarlo.';
  end if;
  insert into public.franchise_terms (brand_id, payback_validated_at, payback_validated_by)
  values (p_brand, now(), auth.uid())
  on conflict (brand_id) do update set payback_validated_at = now(), payback_validated_by = auth.uid();
end $$;

-- ---------- Manual, unidades y auditorías (pasos C, L y A) ----------
create table public.manual_sections (
  id       uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  code     text not null,
  title    text not null,
  status   text not null default 'pendiente' check (status in ('pendiente', 'borrador', 'aprobado')),
  file_id  uuid references public.files(id) on delete set null,
  sort     int not null default 0,
  unique (brand_id, code)
);

create table public.units (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references public.brands(id) on delete cascade,
  name            text not null,
  franchisee_name text,
  format          public.entry_format,
  city            text,
  opened_at       date,
  status          text not null default 'en_preapertura' check (status in ('en_preapertura', 'operando', 'cerrada')),
  created_at      timestamptz not null default now()
);

create table public.audits (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references public.units(id) on delete cascade,
  audited_on date not null,
  score      numeric(5,2),
  auditor_id uuid references public.profiles(id),
  notes      text,
  visibility public.visibility not null default 'cliente',
  created_at timestamptz not null default now()
);

-- Regla 4 · El manual manda: todo hallazgo apunta a una sección del manual.
create table public.audit_findings (
  id                uuid primary key default gen_random_uuid(),
  audit_id          uuid not null references public.audits(id) on delete cascade,
  manual_section_id uuid not null references public.manual_sections(id),
  severity          text not null default 'media' check (severity in ('baja', 'media', 'alta', 'critica')),
  description       text not null,
  status            text not null default 'abierto' check (status in ('abierto', 'en_correccion', 'cerrado')),
  task_id           uuid references public.tasks(id) on delete set null,
  created_at        timestamptz not null default now()
);

create table public.unit_kpis (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references public.units(id) on delete cascade,
  period     date not null,
  metric     text not null,
  value      numeric(14,2),
  data_label public.data_label,
  unique (unit_id, period, metric),
  check (value is null or data_label is not null)               -- regla 1
);

-- Al instanciar una marca, se copian también las 53 secciones del manual.
create or replace function public.copy_manual_sections()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.manual_sections (brand_id, code, title, sort)
  select new.id, code, title, sort from public.tpl_manual_sections
  on conflict do nothing;
  return new;
end $$;
create trigger trg_brands_manual after insert on public.brands
  for each row execute function public.copy_manual_sections();
