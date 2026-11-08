-- =====================================================================
-- 0011 · Quien subió un objeto puede leerlo (la API de Storage lo necesita
-- para borrar un archivo huérfano si falla el registro en public.files).
-- =====================================================================
alter policy "project files read" on storage.objects
  using (bucket_id = 'project-files'
         and (owner = (select auth.uid())
              or exists (select 1 from public.files f
                         where f.bucket = 'project-files' and f.path = name and public.can_read_file(f.id))));
