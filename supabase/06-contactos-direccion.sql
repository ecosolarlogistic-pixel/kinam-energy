-- KINAM Energy | responsables por empresa y edición de formatos por Dirección
-- Correr después de 05-storage-expedientes.sql. Se puede repetir sin problema.
--
-- contactos   listado de personas de cada empresa con su perfil (proyecto, técnico, eléctrico).
--             Lo usan los formatos para elegir responsables. Quitar a alguien lo marca como inactivo.
-- Dirección   solo Dirección (role admin o área direccion) puede cambiar el contenido de un formato desde Interno.
-- Realtime    Interno ve los formatos al momento en que el cliente los guarda.

create table if not exists public.contactos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  perfil text not null check (perfil in ('proyecto', 'tecnico', 'electrico')),
  nombre text not null,
  cargo text,
  telefono text,
  email text,
  activo boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists contactos_cliente_idx on public.contactos (cliente_id, perfil);

grant select, insert, update on public.contactos to authenticated;
alter table public.contactos enable row level security;

drop policy if exists "contactos: ver" on public.contactos;
create policy "contactos: ver" on public.contactos for select to authenticated using (public.is_staff() or public.my_cliente(cliente_id));
drop policy if exists "contactos: crear" on public.contactos;
create policy "contactos: crear" on public.contactos for insert to authenticated with check (public.is_staff() or public.my_cliente(cliente_id));
drop policy if exists "contactos: editar" on public.contactos;
create policy "contactos: editar" on public.contactos for update to authenticated using (public.is_staff() or public.my_cliente(cliente_id));

-- ¿Quien pregunta es de Dirección?
create or replace function public.is_director() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and (role = 'admin' or area = 'direccion'));
$$;
grant execute on function public.is_director() to authenticated;

-- Formatos: el equipo cambia estado y comentarios; el contenido solo lo cambia Dirección (o el cliente).
create or replace function public.guard_formato() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if public.is_staff() then
    if not public.is_director() then
      if tg_op = 'INSERT' then raise exception '%', 'Solo Dirección puede crear o llenar formatos desde Interno.'; end if;
      new.data := old.data; new.firmado_por := old.firmado_por; new.firmado_at := old.firmado_at;
    end if;
  else
    if tg_op = 'UPDATE' then
      new.proyecto_id := old.proyecto_id; new.tipo := old.tipo; new.kinam_notes := old.kinam_notes;
    else
      new.kinam_notes := null;
    end if;
    if new.status not in ('borrador', 'enviado') then new.status := coalesce(old.status, 'borrador'); end if;
  end if;
  if new.status = 'enviado' and (tg_op = 'INSERT' or old.status is distinct from 'enviado') then new.submitted_at := now(); end if;
  return new;
end $$;

-- Bitácora: también registra cuando Dirección edita el contenido.
create or replace function public.log_formato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text := case new.tipo when 'requisitos' then 'Requisitos de instalación' else 'Carta compromiso' end;
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.seguimiento (proyecto_id, accion, detalle) values (new.proyecto_id, v_name || ': ' || new.status, null);
  end if;
  if tg_op = 'UPDATE' and new.data is distinct from old.data and public.is_staff() then
    insert into public.seguimiento (proyecto_id, accion, detalle) values (new.proyecto_id, v_name || ': editado por Dirección', null);
  end if;
  if tg_op = 'UPDATE' and new.kinam_notes is distinct from old.kinam_notes and new.kinam_notes is not null then
    insert into public.seguimiento (proyecto_id, accion, detalle) values (new.proyecto_id, v_name || ': comentario de KINAM', new.kinam_notes);
  end if;
  return new;
end $$;

-- Cambios en vivo para Interno (Realtime respeta las políticas de cada tabla).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'formatos') then
    alter publication supabase_realtime add table public.formatos;
  end if;
end $$;
