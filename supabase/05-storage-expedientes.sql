-- KINAM Energy | PDFs de expedientes (reporte de Requisitos y Carta compromiso)
-- Bucket privado. Los enlaces que se envían por WhatsApp o correo son firmados y caducan a los 30 días.
-- Ruta de cada archivo: {proyecto_id}/{fecha}-{nombre}.pdf

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expedientes', 'expedientes', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "expedientes: subir pdf" on storage.objects;
create policy "expedientes: subir pdf" on storage.objects for insert to authenticated
  with check (bucket_id = 'expedientes' and (public.is_staff() or public.my_proyecto(((storage.foldername(name))[1])::uuid)));

drop policy if exists "expedientes: ver pdf" on storage.objects;
create policy "expedientes: ver pdf" on storage.objects for select to authenticated
  using (bucket_id = 'expedientes' and (public.is_staff() or public.my_proyecto(((storage.foldername(name))[1])::uuid)));
