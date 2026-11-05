-- =====================================================================
-- Franquicias Exitosas · Portal ESCALA
-- 0001 · Núcleo: tipos, perfiles, clientes, proyectos, marcas y tablas
--        transversales (archivos, comentarios, actividad, notificaciones)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type public.app_role       as enum ('admin', 'especialista', 'cliente');
create type public.specialty      as enum ('financiero', 'alimentos', 'legal', 'marketing', 'operaciones', 'tecnologia');
create type public.visibility     as enum ('interno', 'cliente');
create type public.step_code      as enum ('E', 'S', 'C', 'A1', 'L', 'A2');
create type public.pillar         as enum ('estructuracion', 'desarrollo', 'expansion');
create type public.gate_code      as enum ('FRANQUICIABLE', 'RENTABLE', 'REPLICABLE', 'VENDIBLE', 'AUTONOMA');
create type public.step_status    as enum ('pendiente', 'en_curso', 'en_revision', 'cerrado');
create type public.gate_status    as enum ('pendiente', 'acta_enviada', 'observada', 'superada');
create type public.task_status    as enum ('por_hacer', 'en_curso', 'en_revision', 'hecho');
create type public.priority       as enum ('baja', 'media', 'alta', 'urgente');
create type public.review_status  as enum ('borrador', 'enviado', 'observado', 'aprobado');
create type public.request_status as enum ('pendiente', 'recibido', 'observado', 'validado');
create type public.data_label     as enum ('comprobado', 'estimacion', 'supuesto');
create type public.entry_format   as enum ('kiosco', 'isla', 'local_pequeno', 'dark_kitchen', 'modulo_movil', 'otro');
create type public.scenario       as enum ('conservador', 'moderado', 'optimista');
create type public.payment_status as enum ('pendiente', 'facturada', 'pagada');
create type public.currency       as enum ('BOB', 'USD');
create type public.trademark_status as enum ('sin_registro', 'en_tramite', 'registrada');

-- ---------- Utilidades ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Perfiles ----------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  role         public.app_role not null default 'cliente',
  specialty    public.specialty,
  avatar_url   text,
  phone        text,
  notify_email boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil al registrarse (enlace mágico o invitación).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'cliente'  -- el rol nunca se toma de los metadatos del usuario; solo el admin lo cambia
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Clientes ----------
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  legal_name  text,
  nit         text,
  logo_url    text,
  city        text,
  country     text not null default 'Bolivia',
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_clients_updated before update on public.clients
  for each row execute function public.set_updated_at();

create table public.client_members (
  client_id  uuid not null references public.clients(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (client_id, profile_id)
);

-- ---------- Proyectos ----------
create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete restrict,
  name             text not null,
  start_date       date not null,
  currency         public.currency not null default 'BOB',
  status           text not null default 'activo' check (status in ('activo', 'pausado', 'cerrado')),
  template_version int  not null default 1,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();

-- Quién entra a cada proyecto (consultores, especialistas y usuarios del cliente).
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);
create index on public.project_members (profile_id);

-- ---------- Marcas ----------
create table public.brands (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null references public.projects(id) on delete cascade,
  name                   text not null,
  logo_url               text,
  color                  text,
  week_offset            int  not null default 0 check (week_offset >= 0),
  entry_format           public.entry_format,          -- regla 3
  trademark_status       public.trademark_status not null default 'sin_registro', -- regla 5
  trademark_validated_at timestamptz,
  first_opening_date     date,
  sort                   int  not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on public.brands (project_id);
create trigger trg_brands_updated before update on public.brands
  for each row execute function public.set_updated_at();

-- ---------- Archivos (metadatos de Storage) ----------
create table public.files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  brand_id    uuid references public.brands(id) on delete cascade,
  entity_type text,          -- 'task' | 'deliverable_version' | 'info_request' | 'gate_minutes' | 'report' | ...
  entity_id   uuid,
  bucket      text not null default 'project-files',
  path        text not null,
  name        text not null,
  mime        text,
  size        bigint,
  visibility  public.visibility not null default 'interno',
  uploaded_by uuid references public.profiles(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (bucket, path)
);
create index on public.files (project_id);
create index on public.files (entity_type, entity_id);

-- ---------- Comentarios ----------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  entity_type text not null,
  entity_id   uuid not null,
  body        text not null check (length(body) between 1 and 5000),
  visibility  public.visibility not null default 'cliente',
  author_id   uuid not null references public.profiles(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index on public.comments (entity_type, entity_id);

-- ---------- Feed de actividad ("Lo que hicimos por ti esta semana") ----------
create table public.activity_feed (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  brand_id    uuid references public.brands(id) on delete cascade,
  actor_id    uuid references public.profiles(id),
  kind        text not null,
  summary     text not null,
  step_code   public.step_code,
  entity_type text,
  entity_id   uuid,
  visibility  public.visibility not null default 'cliente',
  created_at  timestamptz not null default now()
);
create index on public.activity_feed (project_id, created_at desc);

-- ---------- Notificaciones ----------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  type       text not null, -- entregable_revision | tarea_vencida | comentario | puerta_proxima | cuota_por_vencer | acta_revision | general
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
