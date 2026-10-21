-- KINAM Energy | expediente de cada cliente y proyecto, y roles del equipo
-- Correr una vez en el SQL Editor, después de 02-interno.sql. Se puede repetir sin problema.
--
-- clientes      alta de cliente (empresa). La cuenta del cliente lo ve y edita; el equipo ve todos.
-- proyectos     proyectos de cada cliente, con su etapa.
-- formatos      Requisitos de instalación y Carta compromiso de cada proyecto (contenido en JSON).
-- seguimiento   bitácora de cada proyecto: envíos, cambios de estado y notas.

-- Área de cada persona del equipo. role sigue siendo el permiso (admin = Dirección, equipo = resto).
alter table public.staff add column if not exists area text not null default 'tecnico'
  check (area in ('direccion', 'administracion', 'comercial', 'tecnico', 'operaciones'));
update public.staff set area = 'direccion' where role = 'admin';
alter table public.staff add column if not exists supervisor_id uuid references auth.users (id) on delete set null;
alter table public.staff add column if not exists mailbox boolean not null default false;

-- Tablas del expediente.
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  razon_social text not null,
  rfc text,
  pais text default 'México',
  domicilio text,
  ciudad text,
  estado text,
  actividad text,
  representante text,
  cargo text,
  telefono text,
  email text,
  responsable_kinam uuid references auth.users (id) on delete set null,
  notas text
);
create index if not exists clientes_user_idx on public.clientes (user_id);

create table if not exists public.proyectos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nombre text not null,
  ubicacion text,
  etapa text not null default 'evaluacion' check (etapa in ('evaluacion', 'requisitos', 'carta', 'contrato', 'instalacion', 'operacion', 'cancelado')),
  kinam_notes text
);
create index if not exists proyectos_cliente_idx on public.proyectos (cliente_id);

create table if not exists public.formatos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos (id) on delete cascade,
  tipo text not null check (tipo in ('requisitos', 'carta')),
  data jsonb not null default '{}'::jsonb,
  status text not null default 'borrador' check (status in ('borrador', 'enviado', 'revision', 'observado', 'aprobado')),
  kinam_notes text,
  submitted_at timestamptz,
  firmado_por text,
  firmado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (proyecto_id, tipo)
);

create table if not exists public.seguimiento (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.proyectos (id) on delete cascade,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  accion text not null,
  detalle text
);
create index if not exists seguimiento_proyecto_idx on public.seguimiento (proyecto_id, at desc);

alter table public.evaluaciones add column if not exists proyecto_id uuid references public.proyectos (id) on delete set null;

-- ¿El cliente o proyecto pertenece a la cuenta que pregunta?
create or replace function public.my_cliente(p_cliente uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clientes where id = p_cliente and user_id = (select auth.uid()));
$$;
create or replace function public.my_proyecto(p_proyecto uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.proyectos p join public.clientes c on c.id = p.cliente_id
                 where p.id = p_proyecto and c.user_id = (select auth.uid()));
$$;

-- Reglas que el cliente no puede saltarse (el equipo sí puede editar todo).
create or replace function public.guard_cliente() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      new.user_id := auth.uid(); new.created_by := auth.uid(); new.responsable_kinam := null; new.notas := null;
    else
      new.user_id := old.user_id; new.created_by := old.created_by; new.responsable_kinam := old.responsable_kinam; new.notas := old.notas;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists clientes_guard on public.clientes;
create trigger clientes_guard before insert or update on public.clientes
  for each row execute function public.guard_cliente();

create or replace function public.guard_proyecto() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      new.etapa := 'evaluacion'; new.kinam_notes := null; new.created_by := auth.uid();
    else
      new.etapa := old.etapa; new.kinam_notes := old.kinam_notes; new.cliente_id := old.cliente_id; new.created_by := old.created_by;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists proyectos_guard on public.proyectos;
create trigger proyectos_guard before insert or update on public.proyectos
  for each row execute function public.guard_proyecto();

create or replace function public.guard_formato() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if not public.is_staff() then
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
drop trigger if exists formatos_guard on public.formatos;
create trigger formatos_guard before insert or update on public.formatos
  for each row execute function public.guard_formato();

-- Bitácora automática de cada proyecto.
create or replace function public.log_formato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text := case new.tipo when 'requisitos' then 'Requisitos de instalación' else 'Carta compromiso' end;
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.seguimiento (proyecto_id, accion, detalle) values (new.proyecto_id, v_name || ': ' || new.status, null);
  end if;
  if tg_op = 'UPDATE' and new.kinam_notes is distinct from old.kinam_notes and new.kinam_notes is not null then
    insert into public.seguimiento (proyecto_id, accion, detalle) values (new.proyecto_id, v_name || ': comentario de KINAM', new.kinam_notes);
  end if;
  return new;
end $$;
drop trigger if exists formatos_log on public.formatos;
create trigger formatos_log after insert or update on public.formatos
  for each row execute function public.log_formato();

create or replace function public.log_proyecto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.seguimiento (proyecto_id, accion) values (new.id, 'Proyecto creado');
  elsif old.etapa is distinct from new.etapa then
    insert into public.seguimiento (proyecto_id, accion) values (new.id, 'Etapa: ' || new.etapa);
  end if;
  return new;
end $$;
drop trigger if exists proyectos_log on public.proyectos;
create trigger proyectos_log after insert or update on public.proyectos
  for each row execute function public.log_proyecto();

-- Permisos.
revoke all on public.clientes, public.proyectos, public.formatos, public.seguimiento from anon;
grant select, insert, update, delete on public.clientes, public.proyectos, public.formatos to authenticated;
grant select, insert on public.seguimiento to authenticated;
revoke execute on function public.my_cliente(uuid), public.my_proyecto(uuid) from public, anon;
grant execute on function public.my_cliente(uuid), public.my_proyecto(uuid) to authenticated;
revoke execute on function public.log_formato(), public.log_proyecto(), public.handle_new_user() from public, anon, authenticated;

alter table public.clientes enable row level security;
alter table public.proyectos enable row level security;
alter table public.formatos enable row level security;
alter table public.seguimiento enable row level security;

drop policy if exists "clientes: ver" on public.clientes;
create policy "clientes: ver" on public.clientes for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());
drop policy if exists "clientes: crear" on public.clientes;
create policy "clientes: crear" on public.clientes for insert to authenticated with check (public.is_staff() or user_id = (select auth.uid()));
drop policy if exists "clientes: editar" on public.clientes;
create policy "clientes: editar" on public.clientes for update to authenticated using (user_id = (select auth.uid()) or public.is_staff());
drop policy if exists "clientes: borrar" on public.clientes;
create policy "clientes: borrar" on public.clientes for delete to authenticated using (public.is_admin());

drop policy if exists "proyectos: ver" on public.proyectos;
create policy "proyectos: ver" on public.proyectos for select to authenticated using (public.is_staff() or public.my_cliente(cliente_id));
drop policy if exists "proyectos: crear" on public.proyectos;
create policy "proyectos: crear" on public.proyectos for insert to authenticated with check (public.is_staff() or public.my_cliente(cliente_id));
drop policy if exists "proyectos: editar" on public.proyectos;
create policy "proyectos: editar" on public.proyectos for update to authenticated using (public.is_staff() or public.my_cliente(cliente_id));
drop policy if exists "proyectos: borrar" on public.proyectos;
create policy "proyectos: borrar" on public.proyectos for delete to authenticated using (public.is_admin());

drop policy if exists "formatos: ver" on public.formatos;
create policy "formatos: ver" on public.formatos for select to authenticated using (public.is_staff() or public.my_proyecto(proyecto_id));
drop policy if exists "formatos: crear" on public.formatos;
create policy "formatos: crear" on public.formatos for insert to authenticated with check (public.is_staff() or public.my_proyecto(proyecto_id));
-- El cliente solo edita mientras el formato está en borrador o con observaciones.
drop policy if exists "formatos: editar" on public.formatos;
create policy "formatos: editar" on public.formatos for update to authenticated
  using (public.is_staff() or (public.my_proyecto(proyecto_id) and status in ('borrador', 'observado')));
drop policy if exists "formatos: borrar" on public.formatos;
create policy "formatos: borrar" on public.formatos for delete to authenticated using (public.is_admin());

drop policy if exists "seguimiento: ver" on public.seguimiento;
create policy "seguimiento: ver" on public.seguimiento for select to authenticated using (public.is_staff() or public.my_proyecto(proyecto_id));
drop policy if exists "seguimiento: anotar" on public.seguimiento;
create policy "seguimiento: anotar" on public.seguimiento for insert to authenticated with check (user_id = (select auth.uid()) and (public.is_staff() or public.my_proyecto(proyecto_id)));
