-- Atrapa Supabase do testów na zwykłym Postgresie: role, schemat auth, auth.uid().
-- Tylko to, z czego korzystają notes/supabase-*.sql. NIE uruchamiać na prawdziwym projekcie.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create schema extensions;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb
);

-- jak w Supabase: identyfikator z tokenu żądania
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase domyślnie daje rolom API pełne prawa do nowych obiektów w `public` (schemat ma je zabrać)
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
