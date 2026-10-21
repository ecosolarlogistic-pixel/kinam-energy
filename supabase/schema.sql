-- KINAM Energy | base de datos del área de trabajo (Supabase)
-- Cada usuario solo ve y edita lo suyo. El equipo KINAM (tabla staff) ve todo
-- y actualiza el estado y los comentarios de cada evaluación.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  company text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.evaluaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  project_name text not null,
  industry text not null,
  location text not null,
  peak_kw numeric,
  monthly_kwh numeric,
  hours_per_day numeric check (hours_per_day between 0 and 24),
  monthly_cost_mxn numeric,
  phases text,
  voltage text,
  frequency_hz smallint check (frequency_hz in (50, 60)),
  current_source text,
  backup_hours numeric,
  criticality text,
  container_space text,
  business_model text,
  notes text,
  status text not null default 'recibida' check (status in ('recibida', 'revision', 'propuesta', 'cerrada')),
  kinam_notes text
);
create index if not exists evaluaciones_user_idx on public.evaluaciones (user_id, created_at desc);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()));
$$;

-- Perfil automático al registrarse, con los datos del formulario de alta.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, company, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'company', new.raw_user_meta_data ->> 'phone')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- El cliente no puede cambiar el estado ni los comentarios de KINAM.
create or replace function public.guard_evaluacion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      new.status := 'recibida'; new.kinam_notes := null; new.user_id := auth.uid();
    else
      new.status := old.status; new.kinam_notes := old.kinam_notes; new.user_id := old.user_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists evaluaciones_guard on public.evaluaciones;
create trigger evaluaciones_guard before insert or update on public.evaluaciones
  for each row execute function public.guard_evaluacion();

-- Permisos explícitos: funciona aunque el proyecto no exponga tablas nuevas
-- automáticamente. Los visitantes sin sesión (anon) no tienen acceso.
revoke all on public.profiles, public.staff, public.evaluaciones from anon;
grant select, insert, update on public.profiles to authenticated;
grant select on public.staff to authenticated;
grant select, insert, update on public.evaluaciones to authenticated;

alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.evaluaciones enable row level security;

drop policy if exists "perfil propio: ver" on public.profiles;
create policy "perfil propio: ver" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_staff());
drop policy if exists "perfil propio: crear" on public.profiles;
create policy "perfil propio: crear" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "perfil propio: editar" on public.profiles;
create policy "perfil propio: editar" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "staff: ver" on public.staff;
create policy "staff: ver" on public.staff for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "evaluaciones: ver" on public.evaluaciones;
create policy "evaluaciones: ver" on public.evaluaciones for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());
drop policy if exists "evaluaciones: crear" on public.evaluaciones;
create policy "evaluaciones: crear" on public.evaluaciones for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "evaluaciones: editar" on public.evaluaciones;
create policy "evaluaciones: editar" on public.evaluaciones for update to authenticated using (user_id = (select auth.uid()) or public.is_staff());

-- Para dar acceso de equipo KINAM a una cuenta ya registrada:
-- insert into public.staff (user_id) select id from auth.users where email = 'correo@kinamenergy.com';
