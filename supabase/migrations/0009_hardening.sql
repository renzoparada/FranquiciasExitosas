-- =====================================================================
-- 0009 · Endurecimiento (avisos del Security/Performance Advisor)
-- =====================================================================

-- search_path fijo en la función de updated_at.
alter function public.set_updated_at() set search_path = public;

-- Funciones internas: solo se ejecutan desde triggers u otras funciones
-- SECURITY DEFINER; ningún usuario debe poder llamarlas por /rest/v1/rpc.
do $$
declare f text;
begin
  foreach f in array array[
    -- funciones de trigger
    'public.handle_new_user()', 'public.protect_profile_role()', 'public.enforce_step_rules()',
    'public.enforce_task_rules()', 'public.enforce_franchisee_first()', 'public.tasks_activity()',
    'public.deliverables_activity()', 'public.steps_activity()', 'public.info_requests_activity()',
    'public.brands_reschedule()', 'public.copy_manual_sections()', 'public.gate_installment_due()',
    -- ayudantes que escriben datos
    'public.log_activity(uuid, uuid, text, text, public.step_code, text, uuid, public.visibility)',
    'public.notify_project(uuid, text, text, text, text, text)',
    'public.instantiate_brand(uuid)', 'public.schedule_brand(uuid)', 'public.create_fee_plan(uuid, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Políticas con auth.uid() evaluado una sola vez por consulta.
alter policy profiles_select on public.profiles
  using (id = (select auth.uid()) or public.is_staff() or public.shares_project_with(id));
alter policy profiles_update_self on public.profiles
  using (id = (select auth.uid()) or public.is_admin()) with check (id = (select auth.uid()) or public.is_admin());
alter policy clients_select on public.clients
  using (public.is_admin()
         or exists (select 1 from public.client_members m where m.client_id = id and m.profile_id = (select auth.uid()))
         or exists (select 1 from public.projects p where p.client_id = id and public.has_project_access(p.id)));
alter policy client_members_select on public.client_members
  using (public.is_admin() or profile_id = (select auth.uid()));
alter policy tasks_select on public.tasks
  using (public.is_admin()
         or (public.my_role() = 'especialista' and assignee_id = (select auth.uid()) and public.has_project_access(project_id))
         or (public.my_role() = 'cliente' and visibility = 'cliente' and public.has_project_access(project_id)));
alter policy tasks_specialist_update on public.tasks
  using (public.my_role() = 'especialista' and assignee_id = (select auth.uid()))
  with check (public.my_role() = 'especialista' and assignee_id = (select auth.uid()));
alter policy checklist_write on public.task_checklist_items
  using (public.is_admin() or exists (select 1 from public.tasks t where t.id = task_id and t.assignee_id = (select auth.uid())))
  with check (public.is_admin() or exists (select 1 from public.tasks t where t.id = task_id and t.assignee_id = (select auth.uid())));
alter policy files_insert on public.files
  with check (public.has_project_access(project_id) and uploaded_by = (select auth.uid())
              and (public.is_staff() or visibility = 'cliente'));
alter policy files_delete on public.files
  using (public.is_admin() or uploaded_by = (select auth.uid()));
alter policy comments_insert on public.comments
  with check (public.has_project_access(project_id) and author_id = (select auth.uid())
              and (public.is_staff() or visibility = 'cliente'));
alter policy comments_delete on public.comments
  using (public.is_admin() or author_id = (select auth.uid()));
alter policy notifications_own on public.notifications
  using (user_id = (select auth.uid()));
alter policy notifications_mark_read on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Índices de claves foráneas usadas en consultas y políticas.
create index if not exists client_members_profile_idx   on public.client_members (profile_id);
create index if not exists projects_client_idx          on public.projects (client_id);
create index if not exists comments_project_idx         on public.comments (project_id);
create index if not exists activity_brand_idx           on public.activity_feed (brand_id);
create index if not exists checklist_task_idx           on public.task_checklist_items (task_id);
create index if not exists installments_plan_idx        on public.installments (fee_plan_id);
create index if not exists franchise_sales_brand_idx    on public.franchise_sales (brand_id);
create index if not exists competitors_project_idx      on public.competitors (project_id);
create index if not exists comp_locations_comp_idx      on public.competitor_locations (competitor_id);
create index if not exists comp_prices_comp_idx         on public.competitor_prices (competitor_id);
create index if not exists decisions_project_idx        on public.decisions (project_id);
create index if not exists reports_project_idx          on public.reports (project_id);
create index if not exists agreements_meeting_idx       on public.meeting_agreements (meeting_id);
create index if not exists units_brand_idx              on public.units (brand_id);
create index if not exists audits_unit_idx              on public.audits (unit_id);
create index if not exists findings_audit_idx           on public.audit_findings (audit_id);
create index if not exists findings_section_idx         on public.audit_findings (manual_section_id);
create index if not exists notifications_project_idx    on public.notifications (project_id);
create index if not exists files_brand_idx              on public.files (brand_id);
