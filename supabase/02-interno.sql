-- KINAM Energy | actualización para el panel Interno
-- Correr una vez en el SQL Editor, después de schema.sql. Se puede repetir sin problema.

-- Roles del equipo: admin (Dirección, gestiona al equipo) y equipo (opera evaluaciones).
alter table public.staff add column if not exists role text not null default 'equipo';
alter table public.staff add column if not exists created_at timestamptz not null default now();
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check check (role in ('admin', 'equipo'));

-- Correo en el perfil, para que el equipo vea cómo contactar a cada cliente.
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, company, phone, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'company', new.raw_user_meta_data ->> 'phone', new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'admin');
$$;

-- El equipo ve a todo el equipo.
drop policy if exists "staff: ver" on public.staff;
create policy "staff: ver" on public.staff for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());

-- Alta y baja de miembros del equipo (solo admin). La persona debe tener cuenta.
create or replace function public.add_staff(p_email text, p_role text default 'equipo') returns text
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Solo Dirección puede gestionar al equipo.'; end if;
  if p_role not in ('admin', 'equipo') then raise exception 'Rol no válido.'; end if;
  select id into v_id from auth.users where email = lower(trim(p_email));
  if v_id is null then raise exception 'No existe una cuenta con ese correo. Pide a la persona que se registre primero.'; end if;
  insert into public.staff (user_id, role) values (v_id, p_role)
    on conflict (user_id) do update set role = excluded.role;
  return 'ok';
end $$;

create or replace function public.remove_staff(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Solo Dirección puede gestionar al equipo.'; end if;
  if p_user = (select auth.uid()) then raise exception 'No puedes quitarte a ti mismo.'; end if;
  delete from public.staff where user_id = p_user;
  return 'ok';
end $$;

revoke execute on function public.add_staff(text, text) from public, anon;
revoke execute on function public.remove_staff(uuid) from public, anon;
grant execute on function public.add_staff(text, text) to authenticated;
grant execute on function public.remove_staff(uuid) to authenticated;

-- Bitácora de accesos al panel Interno (la ve Dirección).
create table if not exists public.access_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  user_agent text
);
create index if not exists access_log_at_idx on public.access_log (at desc);
revoke all on public.access_log from anon;
grant select, insert on public.access_log to authenticated;
alter table public.access_log enable row level security;
drop policy if exists "bitacora: registrar" on public.access_log;
create policy "bitacora: registrar" on public.access_log for insert to authenticated with check (user_id = (select auth.uid()) and public.is_staff());
drop policy if exists "bitacora: ver" on public.access_log;
create policy "bitacora: ver" on public.access_log for select to authenticated using (public.is_admin());

-- Primer administrador: cambia el correo si usaste otro al registrarte.
insert into public.staff (user_id, role)
select id, 'admin' from auth.users where email = 'admin@kinamenergy.com'
on conflict (user_id) do update set role = 'admin';
