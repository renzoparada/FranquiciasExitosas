-- =====================================================================
-- 0006 · Row Level Security
--   admin        → todo
--   especialista → sus proyectos; en tareas, solo las asignadas; sin finanzas
--   cliente      → sus proyectos, solo lo "visible para el cliente"; sin finanzas
-- =====================================================================

-- Activar RLS en todas las tablas del esquema public.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Perfiles ----------
create or replace function public.shares_project_with(p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members a
    join public.project_members b on b.project_id = a.project_id
    where a.profile_id = auth.uid() and b.profile_id = p_profile)
$$;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff() or public.shares_project_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy profiles_admin_write on public.profiles for insert to authenticated with check (public.is_admin());
create policy profiles_admin_delete on public.profiles for delete to authenticated using (public.is_admin());

-- Nadie cambia su propio rol: solo el admin.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Solo el consultor puede cambiar roles.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_protect_profile_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- Clientes ----------
create policy clients_select on public.clients for select to authenticated
  using (public.is_admin()
         or exists (select 1 from public.client_members m where m.client_id = id and m.profile_id = auth.uid())
         or exists (select 1 from public.projects p where p.client_id = id and public.has_project_access(p.id)));
create policy clients_admin on public.clients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy client_members_select on public.client_members for select to authenticated
  using (public.is_admin() or profile_id = auth.uid());
create policy client_members_admin on public.client_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Proyectos, miembros y marcas ----------
create policy projects_select on public.projects for select to authenticated
  using (public.has_project_access(id));
create policy projects_admin on public.projects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy project_members_select on public.project_members for select to authenticated
  using (public.has_project_access(project_id));
create policy project_members_admin on public.project_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy brands_select on public.brands for select to authenticated
  using (public.has_project_access(project_id));
create policy brands_admin on public.brands for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy brand_steps_select on public.brand_steps for select to authenticated
  using (public.has_project_access(public.brand_project(brand_id)));
create policy brand_steps_admin on public.brand_steps for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy brand_gates_select on public.brand_gates for select to authenticated
  using (public.has_project_access(public.brand_project(brand_id)));
create policy brand_gates_admin on public.brand_gates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Actas ----------
create policy gate_minutes_select on public.gate_minutes for select to authenticated
  using (exists (select 1 from public.brand_gates g
                 where g.id = brand_gate_id
                   and public.has_project_access(public.brand_project(g.brand_id))
                   and (public.is_staff() or gate_minutes.status <> 'borrador')));
create policy gate_minutes_admin on public.gate_minutes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Tareas ----------
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_admin()
         or (public.my_role() = 'especialista' and assignee_id = auth.uid() and public.has_project_access(project_id))
         or (public.my_role() = 'cliente' and visibility = 'cliente' and public.has_project_access(project_id)));
create policy tasks_admin on public.tasks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy tasks_specialist_update on public.tasks for update to authenticated
  using (public.my_role() = 'especialista' and assignee_id = auth.uid())
  with check (public.my_role() = 'especialista' and assignee_id = auth.uid());

create policy checklist_select on public.task_checklist_items for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));          -- hereda RLS de tasks
create policy checklist_write on public.task_checklist_items for all to authenticated
  using (public.is_admin() or exists (select 1 from public.tasks t where t.id = task_id and t.assignee_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.tasks t where t.id = task_id and t.assignee_id = auth.uid()));

-- ---------- Reuniones, acuerdos y decisiones ----------
create policy meetings_select on public.meetings for select to authenticated
  using (public.can_see(project_id, visibility));
create policy meetings_admin on public.meetings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy agreements_select on public.meeting_agreements for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_id));
create policy agreements_admin on public.meeting_agreements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy decisions_select on public.decisions for select to authenticated
  using (public.can_see(project_id, visibility));
create policy decisions_admin on public.decisions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Entregables ----------
create policy deliverables_select on public.deliverables for select to authenticated
  using (public.can_see(public.brand_project(brand_id), visibility)
         and (public.is_staff() or status <> 'borrador'));
create policy deliverables_admin on public.deliverables for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy deliverable_versions_select on public.deliverable_versions for select to authenticated
  using (exists (select 1 from public.deliverables d where d.id = deliverable_id)
         and (public.is_staff() or submitted_at is not null));
create policy deliverable_versions_staff on public.deliverable_versions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- Solicitudes de información ----------
create policy info_requests_select on public.info_requests for select to authenticated
  using (public.has_project_access(public.brand_project(brand_id)));
create policy info_requests_admin on public.info_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Archivos y comentarios ----------
create or replace function public.can_read_file(p_file uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.files f
    where f.id = p_file
      and public.can_see(f.project_id, f.visibility)
      and (
        public.is_staff()
        or f.entity_type is distinct from 'deliverable_version'
        or exists (select 1 from public.deliverable_versions v
                   where v.id = f.entity_id and v.submitted_at is not null
                     and public.deliverable_released(v.deliverable_id))   -- regla 7
      ))
$$;

create policy files_select on public.files for select to authenticated
  using (public.can_read_file(id));
create policy files_insert on public.files for insert to authenticated
  with check (public.has_project_access(project_id)
              and uploaded_by = auth.uid()
              and (public.is_staff() or visibility = 'cliente'));
create policy files_delete on public.files for delete to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

create policy comments_select on public.comments for select to authenticated
  using (public.can_see(project_id, visibility));
create policy comments_insert on public.comments for insert to authenticated
  with check (public.has_project_access(project_id)
              and author_id = auth.uid()
              and (public.is_staff() or visibility = 'cliente'));
create policy comments_delete on public.comments for delete to authenticated
  using (public.is_admin() or author_id = auth.uid());

-- ---------- Actividad y notificaciones ----------
create policy activity_select on public.activity_feed for select to authenticated
  using (public.can_see(project_id, visibility));
create policy activity_admin on public.activity_feed for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy notifications_own on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Plantilla ESCALA ----------
do $$
declare t text;
begin
  foreach t in array array['tpl_steps','tpl_gates','tpl_tasks','tpl_deliverables','tpl_info_requests','tpl_criteria','tpl_manual_sections'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;

-- ---------- Módulos analíticos: lectura del proyecto, escritura del equipo ----------
create policy fscores_select on public.franchisability_scores for select to authenticated
  using (public.has_project_access(public.brand_project(brand_id)));
create policy fscores_staff on public.franchisability_scores for all to authenticated
  using (public.is_staff() and public.has_project_access(public.brand_project(brand_id)))
  with check (public.is_staff() and public.has_project_access(public.brand_project(brand_id)));

create policy competitors_select on public.competitors for select to authenticated
  using (public.can_see(project_id, visibility));
create policy competitors_staff on public.competitors for all to authenticated
  using (public.is_staff() and public.has_project_access(project_id))
  with check (public.is_staff() and public.has_project_access(project_id));

create policy comp_locations_select on public.competitor_locations for select to authenticated
  using (exists (select 1 from public.competitors c where c.id = competitor_id));
create policy comp_locations_staff on public.competitor_locations for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy comp_prices_select on public.competitor_prices for select to authenticated
  using (exists (select 1 from public.competitors c where c.id = competitor_id));
create policy comp_prices_staff on public.competitor_prices for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy fin_scen_select on public.financial_scenarios for select to authenticated
  using (public.has_project_access(public.brand_project(brand_id)));
create policy fin_scen_staff on public.financial_scenarios for all to authenticated
  using (public.is_staff() and public.has_project_access(public.brand_project(brand_id)))
  with check (public.is_staff() and public.has_project_access(public.brand_project(brand_id)));
create policy fin_values_select on public.financial_values for select to authenticated
  using (exists (select 1 from public.financial_scenarios s where s.id = scenario_id));
create policy fin_values_staff on public.financial_values for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy terms_select on public.franchise_terms for select to authenticated
  using (public.has_project_access(public.brand_project(brand_id)));
create policy terms_admin on public.franchise_terms for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy manual_select on public.manual_sections for select to authenticated
  using (public.has_project_access(public.brand_project(brand_id)));
create policy manual_staff on public.manual_sections for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy units_select on public.units for select to authenticated
  using (public.has_project_access(public.brand_project(brand_id)));
create policy units_admin on public.units for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy audits_select on public.audits for select to authenticated
  using (exists (select 1 from public.units u where u.id = unit_id
                 and public.can_see(public.brand_project(u.brand_id), visibility)));
create policy audits_staff on public.audits for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy findings_select on public.audit_findings for select to authenticated
  using (exists (select 1 from public.audits a where a.id = audit_id));
create policy findings_staff on public.audit_findings for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy kpis_select on public.unit_kpis for select to authenticated
  using (exists (select 1 from public.units u where u.id = unit_id));
create policy kpis_staff on public.unit_kpis for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- Honorarios: solo el consultor ----------
create policy fee_plans_admin on public.fee_plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy installments_admin on public.installments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy franchise_sales_admin on public.franchise_sales for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Informes ----------
create policy reports_select on public.reports for select to authenticated
  using (public.can_see(project_id, visibility));
create policy reports_admin on public.reports for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Las funciones internas no se exponen como RPC a usuarios anónimos.
revoke execute on all functions in schema public from anon;
