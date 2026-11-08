-- =====================================================================
-- 0010 · Corrige la política de lectura de archivos.
-- INSERT ... RETURNING evalúa la política SELECT sobre la fila nueva; la
-- función can_read_file(id) la buscaba por id y aún no la veía, así que
-- toda carga fallaba. Ahora la regla se evalúa con las columnas de la fila.
-- =====================================================================

create or replace function public.can_read_file_row(
  p_project uuid, p_visibility public.visibility, p_entity_type text, p_entity_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_see(p_project, p_visibility)
     and (
       public.is_staff()
       or p_entity_type is distinct from 'deliverable_version'
       or exists (select 1 from public.deliverable_versions v
                  where v.id = p_entity_id and v.submitted_at is not null
                    and public.deliverable_released(v.deliverable_id))   -- regla 7
     )
$$;

create or replace function public.can_read_file(p_file uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.files f
    where f.id = p_file and public.can_read_file_row(f.project_id, f.visibility, f.entity_type, f.entity_id))
$$;

alter policy files_select on public.files
  using (public.can_read_file_row(project_id, visibility, entity_type, entity_id));

grant execute on function public.can_read_file_row(uuid, public.visibility, text, uuid) to authenticated;
revoke execute on function public.can_read_file_row(uuid, public.visibility, text, uuid) from public, anon;
