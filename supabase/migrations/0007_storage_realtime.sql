-- =====================================================================
-- 0007 · Storage (documentos) y Realtime
-- =====================================================================

-- Buckets: documentos del proyecto (privado), plantillas del consultor
-- (privado, regla 7) y logos (público).
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false),
       ('templates', 'templates', false),
       ('branding', 'branding', true)
on conflict (id) do nothing;

-- project-files: ruta "<project_id>/<...>". Cada objeto tiene su fila en
-- public.files, que define la visibilidad y la regla 7.
create policy "project files read" on storage.objects for select to authenticated
  using (bucket_id = 'project-files'
         and exists (select 1 from public.files f
                     where f.bucket = 'project-files' and f.path = name and public.can_read_file(f.id)));

create policy "project files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files'
              and public.has_project_access(((storage.foldername(name))[1])::uuid));

create policy "project files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and (public.is_admin() or owner = auth.uid()));

-- templates: solo el consultor.
create policy "templates admin" on storage.objects for all to authenticated
  using (bucket_id = 'templates' and public.is_admin())
  with check (bucket_id = 'templates' and public.is_admin());

-- branding: lectura pública; escritura del consultor.
create policy "branding read" on storage.objects for select
  using (bucket_id = 'branding');
create policy "branding admin" on storage.objects for all to authenticated
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());

-- Realtime: el portal se actualiza en vivo.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table
  public.tasks, public.deliverables, public.brand_steps, public.brand_gates,
  public.gate_minutes, public.activity_feed, public.comments, public.notifications,
  public.info_requests;
