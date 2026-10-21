-- KINAM Energy | actividades del panel de control (calendario y agenda entre áreas)
-- Correr después de 03-expedientes.sql. Ya aplicado en el proyecto kaduddyydbqzjanrrjxa.
--
-- Cada persona del equipo ve las actividades que tiene asignadas, las que creó y las de quien supervisa.
-- Dirección ve todas. Quien recibe una actividad solo cambia su estado y nota de cierre.

create table if not exists public.actividades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  tipo text not null default 'tarea' check (tipo in ('tarea', 'reunion', 'llamada', 'visita', 'instalacion', 'otro')),
  prioridad text not null default 'media' check (prioridad in ('baja', 'media', 'alta')),
  inicio timestamptz not null,
  fin timestamptz,
  todo_el_dia boolean not null default false,
  ubicacion text,
  proyecto_id uuid references public.proyectos (id) on delete set null,
  asignado_a uuid not null references auth.users (id) on delete cascade,
  creado_por uuid not null default auth.uid() references auth.users (id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'terminada', 'cancelada')),
  nota_cierre text,
  completada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fin is null or fin >= inicio)
);
create index if not exists actividades_asignado_idx on public.actividades (asignado_a, inicio);
create index if not exists actividades_creador_idx on public.actividades (creado_por, inicio);
alter table public.actividades enable row level security;

create or replace function public.supervisa(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = p_user and supervisor_id = (select auth.uid()));
$$;
grant execute on function public.supervisa(uuid) to authenticated;

create or replace function public.guard_actividad() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    if not exists (select 1 from public.staff where user_id = new.asignado_a) then
      raise exception 'Solo se pueden asignar actividades a personas del equipo.';
    end if;
  else
    new.creado_por := old.creado_por;
    if old.creado_por is distinct from auth.uid() and not public.is_admin() then
      new.titulo := old.titulo; new.descripcion := old.descripcion; new.tipo := old.tipo; new.prioridad := old.prioridad;
      new.inicio := old.inicio; new.fin := old.fin; new.todo_el_dia := old.todo_el_dia; new.ubicacion := old.ubicacion;
      new.proyecto_id := old.proyecto_id; new.asignado_a := old.asignado_a;
    end if;
  end if;
  if new.estado = 'terminada' and (tg_op = 'INSERT' or old.estado is distinct from 'terminada') then new.completada_at := now(); end if;
  if new.estado <> 'terminada' then new.completada_at := null; end if;
  return new;
end $$;
drop trigger if exists actividades_guard on public.actividades;
create trigger actividades_guard before insert or update on public.actividades
  for each row execute function public.guard_actividad();

-- Las actividades ligadas a un proyecto quedan en su bitácora de seguimiento.
create or replace function public.log_actividad() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.proyecto_id is not null and (tg_op = 'INSERT' or old.estado is distinct from new.estado) then
    insert into public.seguimiento (proyecto_id, accion, detalle)
    values (new.proyecto_id, case when tg_op = 'INSERT' then 'Actividad agendada' else 'Actividad: ' || new.estado end, new.titulo);
  end if;
  return new;
end $$;
drop trigger if exists actividades_log on public.actividades;
create trigger actividades_log after insert or update on public.actividades
  for each row execute function public.log_actividad();

grant select, insert, update on public.actividades to authenticated;
drop policy if exists "actividades: ver" on public.actividades;
create policy "actividades: ver" on public.actividades for select to authenticated
  using (public.is_staff() and (asignado_a = (select auth.uid()) or creado_por = (select auth.uid()) or public.is_admin() or public.supervisa(asignado_a)));
drop policy if exists "actividades: crear" on public.actividades;
create policy "actividades: crear" on public.actividades for insert to authenticated
  with check (public.is_staff() and creado_por = (select auth.uid()));
drop policy if exists "actividades: editar" on public.actividades;
create policy "actividades: editar" on public.actividades for update to authenticated
  using (asignado_a = (select auth.uid()) or creado_por = (select auth.uid()) or public.is_admin() or public.supervisa(asignado_a));
