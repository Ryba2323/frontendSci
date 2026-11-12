-- =====================================================================
--  ReLeaf (SCI++) — schemat bazy, część 1 z 3: konto, zgody, dane aplikacji
--  Supabase / PostgreSQL 15+. Region: Frankfurt (RODO).
--
--  Kolejność uruchamiania (Supabase → SQL Editor albo migracje):
--    1. notes/supabase-schema.sql   (ten plik)
--    2. notes/supabase-testy.sql    (testy WHO-5 i Big Five; wymaga tego pliku) + supabase-testy-dane.sql
--    3. notes/supabase-wnioski.sql  (zapis podlewania, znaczniki dnia, wnioski, próby) + supabase-wnioski-dane.sql
--  Oba pliki przechodzą na czystym Postgresie 16: narzedzia/sprawdz-baze.sh
--  (atrapa Supabase + testy uprawnień i liczenia wyników).
--
--  Zasady:
--   • Każda tabela ma RLS. Użytkownik widzi i zmienia tylko swoje wiersze.
--   • Rola `anon` (niezalogowany) nie ma dostępu do niczego.
--   • To, od czego zależy bezpieczeństwo albo dowód (zgody, wyniki testów,
--     wnioski, moderacja), zapisuje WYŁĄCZNIE serwer: funkcje `security definer`
--     albo Edge Functions z kluczem service_role. Telefon tylko prosi.
--   • Dane o zdrowiu (RODO art. 9: podlewania, testy, wnioski) zapisujemy tylko
--     przy aktywnej zgodzie `health_data`. Wycofanie zgody usuwa je od razu.
--   • Usunięcie konta (auth.users) kasuje wszystko kaskadowo. Zostaje tylko
--     dowód zgód bez powiązania z kontem (patrz sekcja 2).
--   • Skrytka jest szyfrowana NA TELEFONIE — baza trzyma tylko szyfrogram.
--   • Blog jest anonimowy: author_id nigdy nie wychodzi na zewnątrz (widoki).
--
--  Szyfrowanie („dane muszą być szyfrowane”): Supabase szyfruje dysk (AES-256)
--  i ruch (TLS). Kolumn dodatkowo nie szyfrujemy: klucz leżałby w tej samej
--  bazie, a serwer musi liczyć wyniki testów i wnioski. Dostęp ograniczają RLS
--  i brak bezpośredniego zapisu. DO POTWIERDZENIA z prawnikiem / zespołem.
--
--  DO POTWIERDZENIA (prawnik, przed pierwszym prawdziwym kontem):
--   • jak długo trzymamy dowód zgody po usunięciu konta (tu: 3 lata),
--   • czy wycofanie zgody `health_data` ma usuwać też rozmowy z Asystentem,
--   • zgoda opiekuna poniżej 16 lat: sposób potwierdzenia (tu: link w e-mailu).
-- =====================================================================

-- W Supabase rozszerzenia mieszkają w schemacie `extensions`.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;   -- zakresy bez nakładania (supabase-testy.sql)

-- Schemat `private`: funkcje pomocnicze, niewidoczne przez API (PostgREST wystawia tylko `public`).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- updated_at ustawia baza, nie telefon
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function private.is_timezone(tz text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- Adres IP i przeglądarka żądania — ustawia je brama Supabase, nie telefon.
-- `cf-connecting-ip` wpisuje Cloudflare (nie da się podrobić). Z x-forwarded-for bierzemy OSTATNI adres,
-- czyli dopisany przez naszą bramę: pierwszy podaje sam klient i można go zmyślić.
-- SPRAWDZIĆ na naszym projekcie, który nagłówek faktycznie przychodzi i ile serwerów pośredniczy.
create or replace function private.request_ip() returns inet
language plpgsql stable set search_path = '' as $$
declare h json; parts text[];
begin
  h := nullif(current_setting('request.headers', true), '')::json;
  parts := string_to_array(h->>'x-forwarded-for', ',');
  return nullif(trim(coalesce(h->>'cf-connecting-ip', parts[cardinality(parts)])), '')::inet;
exception when others then
  return null;                                   -- brak nagłówków albo śmieci zamiast adresu / JSON-a
end $$;

create or replace function private.request_user_agent() returns text
language plpgsql stable set search_path = '' as $$
begin
  return left(nullif(current_setting('request.headers', true), '')::json->>'user-agent', 300);
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------
--  1. Profil
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nick          text not null check (char_length(nick) between 2 and 24),
  -- Rejestracja pyta o wiek (13–19+), nie o datę urodzenia: zapisujemy rok rejestracji − wiek.
  -- To najpóźniejszy możliwy rok urodzenia, więc reguły wieku liczymy ostrożnie (private.needs_guardian).
  birth_year    smallint check (birth_year between 1990 and 2100),
  grammar_form  text not null default 'n' check (grammar_form in ('f','m','n')),   -- „zrobiłaś / zrobiłeś / udało Ci się”
  plant_name    text check (char_length(plant_name) <= 24),                        -- „Mięta”
  theme         text not null default 'morski'
                check (theme in ('morski','zielony','niebieski','lawenda','rozowy','morelowy')),
  mode          text not null default 'auto' check (mode in ('auto','light','dark')),
  reminder_time time,                                                              -- np. 20:00; null = bez przypomnień
  timezone      text not null default 'Europe/Warsaw' check (private.is_timezone(timezone)),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is 'Profil użytkownika. Zgody NIE są tutaj (user_consents), żeby telefon nie mógł ich sam sobie wpisać.';

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Profil tworzy się sam przy rejestracji. Dane z formularza przychodzą w options.data
-- (supabase.auth.signInWithOtp({ email, options: { data: { nick, age, form, plant, theme } } })).
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  age   int   := case when m->>'age' ~ '^[0-9]{1,2}\+?$' then substring(m->>'age' from '^[0-9]{1,2}')::int end;   -- „19+” → 19; „136” odrzucone
  nick  text  := nullif(left(trim(m->>'nick'), 24), '');
  theme text  := m->>'theme';
  form  text  := m->>'form';
begin
  insert into public.profiles (id, nick, birth_year, grammar_form, plant_name, theme)
  values (
    new.id,
    case when char_length(nick) >= 2 then nick else 'Ja' end,                 -- za krótki pseudonim nie może zablokować założenia konta
    case when age between 13 and 36 then extract(year from now())::int - age end,
    case when form in ('f','m','n') then form else 'n' end,
    nullif(left(trim(m->>'plant'), 24), ''),
    case when theme in ('morski','zielony','niebieski','lawenda','rozowy','morelowy') then theme else 'morski' end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Poniżej 16 lat dane o zdrowiu wymagają zgody opiekuna (RODO art. 8, w Polsce 16 lat).
-- Znamy wiek podany przy rejestracji (rok rejestracji − birth_year), nie datę urodzenia. Kto podał 16 lat lub więcej,
-- opiekuna nie potrzebuje. Kto podał mniej, potrzebuje go, dopóki od rejestracji nie minie tyle pełnych lat, ile
-- brakowało do 16 (ostrożnie: urodziny mogły być dzień przed rejestracją albo dzień po).
-- Brak roku urodzenia albo profilu = traktujemy jak osobę poniżej 16 lat.
create or replace function private.needs_guardian(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.birth_year is null
         or current_date < (p.created_at + make_interval(years =>
              greatest(0, 16 - (extract(year from p.created_at)::int - p.birth_year))))::date
     from public.profiles p where p.id = p_user),
    true);
$$;

-- odcisk adresu e-mail: zostaje przy dowodzie zgody po usunięciu konta (sam adres znika)
create or replace function private.subject_hash(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select encode(sha256(convert_to(lower(u.email), 'UTF8')), 'hex') from auth.users u where u.id = p_user;
$$;

-- tokeny push (kilka urządzeń na osobę)
create table public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null check (platform in ('ios','android','web')),
  created_at  timestamptz not null default now()
);
create index on public.push_tokens (user_id);

-- ---------------------------------------------------------------------
--  2. Dokumenty i zgody (RODO art. 6, 7, 8, 9; rozliczalność: art. 5 ust. 2)
-- ---------------------------------------------------------------------
--  kind:
--    terms        regulamin (umowa; „wycofanie” = usunięcie konta)
--    privacy      zapoznanie się z polityką prywatności
--    health_data  wyraźna zgoda na dane o zdrowiu i samopoczuciu (art. 9 ust. 2 lit. a) — da się wycofać
--    guardian     zgoda opiekuna dla osoby poniżej 16 lat — zapisuje ją tylko serwer
create type public.legal_doc_kind as enum ('terms', 'privacy', 'health_data', 'guardian');

-- Każda wersja dokumentu to osobny wiersz. Wierszy się nie poprawia: nowa treść = nowa wersja.
create table public.legal_documents (
  id              uuid primary key default gen_random_uuid(),
  kind            public.legal_doc_kind not null,
  version         text not null check (version ~ '^[0-9]+\.[0-9]+$'),      -- '1.0'
  title           text not null,
  url             text not null,                                           -- gdzie leży pełna treść tej wersji
  body_sha256     text check (body_sha256 ~ '^[0-9a-f]{64}$'),             -- odcisk treści, na którą ktoś się zgodził
  effective_from  timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (kind, version),
  unique (id, kind)                                                        -- dla klucza obcego z user_consents
);
comment on table public.legal_documents is 'Wersje regulaminu, polityki prywatności i treści zgód. Obowiązuje najnowsza wersja z effective_from <= teraz.';

create or replace function private.current_document(p_kind public.legal_doc_kind) returns uuid
language sql stable security definer set search_path = '' as $$
  select d.id from public.legal_documents d
  where d.kind = p_kind and d.effective_from <= now()
  order by d.effective_from desc limit 1;
$$;

-- Dziennik zgód. Tylko dopisywanie. Zgoda jest AKTYWNA, gdy withdrawn_at i superseded_at są puste:
--   withdrawn_at   — osoba wycofała zgodę (dla health_data usuwa to dane, patrz sekcja 8),
--   superseded_at  — zastąpiła ją zgoda na nowszą wersję dokumentu (dane zostają).
-- Telefon nie ma tu prawa zapisu, więc nikt nie wpisze sobie zgody opiekuna ani nie skasuje dowodu.
-- Po usunięciu konta user_id robi się NULL, a wiersz zostaje jako dowód (subject_hash) do czasu purge_orphaned_records().
create table public.user_consents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  subject_hash  text not null,                                             -- sha256(e-mail) osoby, której dotyczy zgoda
  document_id   uuid not null,
  kind          public.legal_doc_kind not null,
  given_by      text not null default 'user' check (given_by in ('user','guardian')),
  given_at      timestamptz not null default now(),
  withdrawn_at  timestamptz,
  superseded_at timestamptz,
  ip            inet,                                                      -- ustawia serwer (private.request_ip)
  user_agent    text,
  orphaned_at   timestamptz,                                               -- kiedy usunięto konto
  foreign key (document_id, kind) references public.legal_documents (id, kind),
  check (withdrawn_at is null or withdrawn_at >= given_at),
  check (superseded_at is null or superseded_at >= given_at),
  check (withdrawn_at is null or superseded_at is null),
  check ((kind = 'guardian') = (given_by = 'guardian'))
);
comment on table public.user_consents is 'Dowód zgód (art. 7 ust. 1 RODO): kto, na którą wersję, kiedy, z jakiego adresu, kiedy wycofał.';
-- najwyżej jedna aktywna zgoda danego rodzaju na osobę
create unique index user_consents_one_active on public.user_consents (user_id, kind)
  where withdrawn_at is null and superseded_at is null;
create index on public.user_consents (user_id, given_at desc);
create index on public.user_consents (orphaned_at) where user_id is null;

-- Wiersz zgody jest niezmienny poza: (a) wycofaniem, (b) zastąpieniem nowszą wersją, (c) odpięciem od usuniętego konta.
create or replace function private.user_consents_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- odpiąć zgodę od konta wolno tylko wtedy, gdy konto właśnie zostało usunięte (robi to klucz obcy), nie „ręcznie”
  if tg_op = 'UPDATE' and old.user_id is not null and new.user_id is null
     and exists (select 1 from auth.users u where u.id = old.user_id) then
    raise exception 'consent_immutable' using detail = 'Zgody nie da się odpiąć od istniejącego konta.';
  end if;
  if tg_op = 'DELETE' then
    if old.user_id is not null then
      raise exception 'consent_immutable' using detail = 'Zgody nie da się skasować. Wycofanie ustawia withdrawn_at.';
    end if;
    return old;
  end if;
  if old.user_id is not null and new.user_id is null then
    new.orphaned_at := now();
  end if;
  if (new.id, new.subject_hash, new.document_id, new.kind, new.given_by, new.given_at, new.ip, new.user_agent)
     is distinct from
     (old.id, old.subject_hash, old.document_id, old.kind, old.given_by, old.given_at, old.ip, old.user_agent)
     or (new.user_id is distinct from old.user_id and new.user_id is not null)
     or (old.withdrawn_at is not null and new.withdrawn_at is distinct from old.withdrawn_at)
     or (old.superseded_at is not null and new.superseded_at is distinct from old.superseded_at) then
    raise exception 'consent_immutable' using detail = 'W zgodzie można tylko raz ustawić withdrawn_at albo superseded_at.';
  end if;
  return new;
end $$;
create trigger user_consents_guard before update or delete on public.user_consents
  for each row execute function private.user_consents_guard();

-- Czy osoba ma teraz ważną zgodę danego rodzaju? Dla danych o zdrowiu poniżej 16 lat potrzebna jest też zgoda opiekuna.
create or replace function private.has_consent(p_user uuid, p_kind public.legal_doc_kind) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_consents c
                 where c.user_id = p_user and c.kind = p_kind and c.withdrawn_at is null and c.superseded_at is null)
     and (p_kind <> 'health_data'
          or not private.needs_guardian(p_user)
          or exists (select 1 from public.user_consents c
                     where c.user_id = p_user and c.kind = 'guardian' and c.withdrawn_at is null and c.superseded_at is null));
$$;

-- RPC: supabase.rpc('give_consent', { p_kinds: ['terms','privacy','health_data'] })
-- Zapisuje zgodę na AKTUALNĄ wersję dokumentu. Powtórne wywołanie nic nie psuje;
-- po zmianie dokumentu zamyka starą zgodę i zapisuje nową (ponowna akceptacja).
create or replace function public.give_consent(p_kinds public.legal_doc_kind[])
returns table (kind public.legal_doc_kind, version text, given_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid  uuid := auth.uid();
  k    public.legal_doc_kind;
  doc  uuid;
  cur  public.user_consents;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_kinds is null or cardinality(p_kinds) = 0 then
    raise exception 'invalid_input' using detail = 'Podaj co najmniej jeden rodzaj zgody.';
  end if;
  if private.subject_hash(uid) is null then
    raise exception 'email_required' using detail = 'Zgody zapisujemy tylko dla kont z adresem e-mail (logowanie anonimowe i telefoniczne musi być wyłączone).';
  end if;
  foreach k in array p_kinds loop
    if k = 'guardian' then
      raise exception 'forbidden' using detail = 'Zgodę opiekuna zapisuje tylko serwer po potwierdzeniu z e-maila.';
    end if;
    doc := private.current_document(k);
    if doc is null then
      raise exception 'document_missing' using detail = format('Brak opublikowanego dokumentu „%s”.', k);
    end if;
    select * into cur from public.user_consents c
      where c.user_id = uid and c.kind = k and c.withdrawn_at is null and c.superseded_at is null for update;
    if found and cur.document_id = doc then
      continue;                                           -- ta wersja jest już zaakceptowana
    end if;
    if found then
      update public.user_consents c set superseded_at = now() where c.id = cur.id;
    end if;
    insert into public.user_consents (user_id, subject_hash, document_id, kind, ip, user_agent)
    values (uid, private.subject_hash(uid), doc, k, private.request_ip(), private.request_user_agent())
    on conflict do nothing;                               -- dwa żądania naraz: drugie nic nie robi zamiast błędu
  end loop;
  return query
    select c.kind, d.version, c.given_at
    from public.user_consents c join public.legal_documents d on d.id = c.document_id
    where c.user_id = uid and c.withdrawn_at is null and c.superseded_at is null and c.kind = any (p_kinds);
end $$;

-- RPC: supabase.rpc('withdraw_consent', { p_kind: 'health_data' })
-- Wycofanie zgody jest tak samo łatwe jak jej udzielenie (art. 7 ust. 3). Dane o zdrowiu usuwa wyzwalacz niżej.
create or replace function public.withdraw_consent(p_kind public.legal_doc_kind) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ts  timestamptz;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_kind <> 'health_data' then
    raise exception 'use_delete_account'
      using detail = 'Regulaminu i polityki nie da się wycofać osobno — to warunki konta. Użyj delete_my_account().';
  end if;
  update public.user_consents c set withdrawn_at = now()
    where c.user_id = uid and c.kind = p_kind and c.withdrawn_at is null and c.superseded_at is null
    returning c.withdrawn_at into ts;
  return ts;                                              -- null = nie było czego wycofać
end $$;

-- Widok dla ekranu „Konto i prywatność”: moje zgody z wersją dokumentu i informacją, czy wyszła nowsza.
create view public.my_consents with (security_invoker = true) as
select c.id, c.kind, d.version, d.title, d.url, c.given_by, c.given_at, c.withdrawn_at,
       c.superseded_at,
       (c.withdrawn_at is null and c.superseded_at is null) as active,
       (c.withdrawn_at is null and c.superseded_at is null and c.document_id <> private.current_document(c.kind)) as needs_renewal
from public.user_consents c join public.legal_documents d on d.id = c.document_id
where c.user_id = (select auth.uid());

-- RPC: czy mogę teraz zapisywać dane o zdrowiu? (ekran podlewania i testów pyta o to przed startem)
--   { "active": true }  albo  { "active": false, "reason": "no_consent" | "guardian_pending" }
create or replace function public.health_consent_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when private.has_consent(auth.uid(), 'health_data') then jsonb_build_object('active', true)
    when exists (select 1 from public.user_consents c
                 where c.user_id = auth.uid() and c.kind = 'health_data' and c.withdrawn_at is null and c.superseded_at is null)
      then jsonb_build_object('active', false, 'reason', 'guardian_pending')
    else jsonb_build_object('active', false, 'reason', 'no_consent')
  end;
$$;

-- Dziennik żądań dotyczących danych (usunięcia, eksport). Bez treści — tylko fakt i liczby.
create table public.privacy_events (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users(id) on delete set null,
  subject_hash  text not null,
  event         text not null check (event in ('health_data_erased', 'test_history_deleted', 'account_deleted', 'data_exported')),
  details       jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
comment on table public.privacy_events is 'Rozliczalność: kiedy spełniliśmy żądanie usunięcia / eksportu. Nie zawiera danych o zdrowiu.';
create index on public.privacy_events (user_id, created_at desc);

create or replace function private.log_privacy_event(p_user uuid, p_event text, p_details jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.privacy_events (user_id, subject_hash, event, details)
  values (p_user, private.subject_hash(p_user), p_event, coalesce(p_details, '{}'::jsonb));
$$;

-- Zgoda opiekuna (osoby poniżej 16 lat). Wysyłką zajmuje się Edge Function `guardian-consent`:
-- losuje token, zapisuje tu jego odcisk, wysyła link. Po kliknięciu woła confirm_guardian_consent(token).
create table public.guardian_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  guardian_email  text not null check (guardian_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  token_hash      text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),   -- sha256(token); sam token jest tylko w e-mailu
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '14 days',
  confirmed_at    timestamptz
);
create index on public.guardian_requests (user_id, created_at desc);

-- Tylko service_role (Edge Function). p_ip: adres opiekuna z żądania do funkcji.
create or replace function public.confirm_guardian_consent(p_token text, p_ip inet default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  req public.guardian_requests;
  doc uuid := private.current_document('guardian');
begin
  select * into req from public.guardian_requests r
    where r.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') for update;
  if not found or req.expires_at < now() then
    raise exception 'token_invalid' using detail = 'Link wygasł albo jest nieprawidłowy.';
  end if;
  if doc is null then
    raise exception 'document_missing' using detail = 'Brak opublikowanej treści zgody opiekuna.';
  end if;
  if req.confirmed_at is null then
    update public.guardian_requests r set confirmed_at = now() where r.id = req.id;
    insert into public.user_consents (user_id, subject_hash, document_id, kind, given_by, ip)
    values (req.user_id, private.subject_hash(req.user_id), doc, 'guardian', 'guardian', p_ip)
    on conflict do nothing;
  end if;
  return req.user_id;
end $$;

-- Tylko service_role (Edge Function): opiekun cofa zgodę linkiem, który jest w każdej wiadomości do niego.
-- Działa tak samo jak wycofanie zgody przez osobę: dane o zdrowiu znikają od razu (wyzwalacze niżej i w kolejnych plikach).
-- CZY usuwać, czy tylko wstrzymać zapis — DO POTWIERDZENIA z prawnikiem.
create or replace function public.withdraw_guardian_consent(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare req public.guardian_requests;
begin
  select * into req from public.guardian_requests r
    where r.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if not found then
    raise exception 'token_invalid' using detail = 'Link jest nieprawidłowy.';
  end if;
  update public.user_consents c set withdrawn_at = now()
    where c.user_id = req.user_id and c.kind = 'guardian' and c.withdrawn_at is null and c.superseded_at is null;
  return req.user_id;
end $$;

-- RPC: supabase.rpc('delete_my_account'). Kasuje konto i kaskadowo wszystkie dane.
-- Edge Function `delete-account` woła to, a potem czyści pliki w Storage i wylogowuje urządzenia.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform private.log_privacy_event(uid, 'account_deleted');
  delete from auth.users u where u.id = uid;
end $$;

-- Dowody zgód po usuniętych kontach trzymamy 3 lata (roszczenia), potem kasujemy. Okres DO POTWIERDZENIA.
-- Uruchamiać raz dziennie, np.: select cron.schedule('purge-consents', '15 3 * * *', 'select private.purge_orphaned_records()');
create or replace function private.purge_orphaned_records(p_keep interval default interval '3 years') returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.privacy_events e where e.user_id is null and e.created_at < now() - p_keep;
  delete from public.user_consents c where c.user_id is null and c.orphaned_at < now() - p_keep;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
--  3. Codzienne podlewanie (check-in) — jedno na dzień, można edytować
-- ---------------------------------------------------------------------
create table public.daily_checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  day            date not null,                                  -- dzień w strefie użytkownika
  mood           smallint check (mood between 1 and 10),        -- plan: wymagany; design pozwala pominąć → do ustalenia
  sleep_hours    numeric(3,1) check (sleep_hours between 0 and 16),
  sleep_quality  smallint check (sleep_quality between 1 and 4), -- źle / tak sobie / dobrze / świetnie
  bedtime        smallint check (bedtime between 1 and 4),       -- zeszła noc: 1 przed 22 · 2 22–23 · 3 23–24 · 4 po północy
  note           text check (char_length(note) <= 500),
  entry_hour     smallint check (entry_hour between 0 and 23),   -- godzina pierwszego zapisu w strefie użytkownika („niedzielne wieczory”); null, gdy wpis uzupełniono po fakcie
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, day)                                          -- to także indeks do historii (user_id, day)
);
comment on table public.daily_checkins is 'Jedno podlewanie na dzień. Zapisuje wyłącznie save_checkin() (supabase-wnioski.sql). Obszary dnia i „co dziś było” są w checkin_tags, żeby nowe pole nie wymagało zmiany tabeli.';
create trigger daily_checkins_touch before update on public.daily_checkins
  for each row execute function private.touch_updated_at();

-- Zielnik: kwiat za tydzień z ≥ 3 podlaniami (liczone, nie zapisywane)
create view public.herbarium with (security_invoker = true) as
select user_id,
       date_trunc('week', day)::date        as week_start,
       count(*)                              as waterings,
       round(avg(mood)::numeric, 1)          as avg_mood
from public.daily_checkins
group by user_id, date_trunc('week', day)
having count(*) >= 3;

-- ---------------------------------------------------------------------
--  4. Skrytka (szyfrowana na urządzeniu) i Słoik dobrych chwil
-- ---------------------------------------------------------------------
create table public.vault_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  ciphertext     text not null check (char_length(ciphertext) <= 20000),   -- AES-GCM, klucz tylko na telefonie
  iv             text not null check (char_length(iv) <= 64),
  source         text not null default 'manual' check (source in ('manual','checkin','blog')),
  checkin_id     uuid references public.daily_checkins(id) on delete set null,
  sent_to_ai_at  timestamptz,               -- tylko gdy użytkownik sam kliknie „Zapytaj Asystenta”
  created_at     timestamptz not null default now()
);
create index on public.vault_entries (user_id, created_at desc);
create index on public.vault_entries (checkin_id) where checkin_id is not null;   -- bez tego usunięcie podlewań skanuje całą Skrytkę

create table public.good_moments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 300),
  created_at  timestamptz not null default now()
);
create index on public.good_moments (user_id, created_at desc);

-- ---------------------------------------------------------------------
--  5. SOS: bliskie osoby (max 3)
-- ---------------------------------------------------------------------
create table public.trusted_contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 30),
  phone       text not null check (phone ~ '^\+?[0-9 ]{6,20}$'),
  position    smallint not null check (position between 1 and 3),
  created_at  timestamptz not null default now(),
  unique (user_id, position)                -- unikalna pozycja 1–3 = najwyżej 3 osoby
);

-- ---------------------------------------------------------------------
--  6. Myśl na dziś
-- ---------------------------------------------------------------------
create table public.daily_quotes (
  id          integer generated always as identity primary key,
  text        text not null unique,
  show_on     date unique,                  -- konkretny dzień albo null (wtedy rotacja)
  active      boolean not null default true
);
create table public.saved_quotes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  quote_id    int  not null references public.daily_quotes(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, quote_id)
);
create index on public.saved_quotes (quote_id);

-- ---------------------------------------------------------------------
--  7. Testy WHO-5 i Big Five → osobny plik: notes/supabase-testy.sql
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
--  8. Wnioski, znaczniki dnia i próby → osobny plik: notes/supabase-wnioski.sql
-- ---------------------------------------------------------------------

-- Wycofanie zgody na dane o zdrowiu (przez osobę albo przez opiekuna) usuwa je od razu (RODO art. 17 ust. 1 lit. b):
-- tu podlewania (ze znacznikami) i rozmowy z Asystentem, bo to też treści o samopoczuciu.
-- Testy dopina swoim wyzwalaczem supabase-testy.sql, wnioski i próby — supabase-wnioski.sql.
-- Roślinka, Skrytka (szyfrogram) i słoik zostają. Ślad w privacy_events nie ma liczb ani treści: sam fakt i data.
create or replace function private.erase_health_data() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.daily_checkins d where d.user_id = new.user_id;
  delete from public.assistant_messages a where a.user_id = new.user_id;
  perform private.log_privacy_event(new.user_id, 'health_data_erased',
    jsonb_build_object('by', case when new.kind = 'guardian' then 'guardian' else 'user' end));
  return null;
end $$;
create trigger user_consents_erase_health after update of withdrawn_at on public.user_consents
  for each row when (new.kind in ('health_data', 'guardian') and old.withdrawn_at is null and new.withdrawn_at is not null
                     and new.user_id is not null)
  execute function private.erase_health_data();

-- ---------------------------------------------------------------------
--  9. Blog (anonimowy, moderowany)
-- ---------------------------------------------------------------------
create type public.mod_status as enum ('pending','published','rejected','crisis','removed');

create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references auth.users(id) on delete cascade,  -- NIGDY nie pokazujemy innym
  pseudonym      text not null,             -- „Cicha Paproć”
  title          text not null check (char_length(title) between 3 and 80),
  body           text not null check (char_length(body) between 10 and 1500),
  status         public.mod_status not null default 'pending',
  moderation     jsonb,                     -- wynik AI: { verdict, categories, scores, model }
  score          int not null default 0,    -- suma głosów (trigger)
  comment_count  int not null default 0,
  created_at     timestamptz not null default now()
);
create index on public.posts (status, created_at desc);
create index on public.posts (status, score desc);
create index on public.posts (author_id);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  pseudonym   text not null,
  body        text not null check (char_length(body) between 1 and 400),
  status      public.mod_status not null default 'pending',
  moderation  jsonb,
  created_at  timestamptz not null default now()
);
create index on public.comments (post_id, created_at);
create index on public.comments (author_id);

create table public.votes (
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index on public.votes (user_id);

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references auth.users(id) on delete cascade,
  post_id      uuid references public.posts(id) on delete cascade,
  comment_id   uuid references public.comments(id) on delete cascade,
  reason       text check (char_length(reason) <= 300),
  status       text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at   timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);
create index on public.reports (status, created_at);
create index on public.reports (post_id);
create index on public.reports (comment_id);
create index on public.reports (reporter_id);

-- liczniki głosów i komentarzy
create or replace function private.refresh_post_counters() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  update public.posts set
    score = coalesce((select sum(v.value) from public.votes v where v.post_id = pid), 0),
    comment_count = (select count(*) from public.comments c where c.post_id = pid and c.status = 'published')
  where id = pid;
  return null;
end $$;
create trigger votes_counters after insert or update or delete on public.votes
  for each row execute function private.refresh_post_counters();
create trigger comments_counters after insert or update or delete on public.comments
  for each row execute function private.refresh_post_counters();

-- Publiczne widoki bez author_id (apka czyta bloga TYLKO stąd). Celowo BEZ security_invoker:
-- widok działa z prawami właściciela, żeby pokazać opublikowane wpisy innych osób mimo RLS na tabelach.
create view public.blog_posts as
  select id, pseudonym, title, body, score, comment_count, created_at,
         (author_id = (select auth.uid())) as is_mine
  from public.posts where status = 'published';
create view public.blog_comments as
  select id, post_id, pseudonym, body, created_at, (author_id = (select auth.uid())) as is_mine
  from public.comments where status = 'published';

-- ---------------------------------------------------------------------
--  10. Asystent Wsparcia (P2) — limit 10 wiadomości dziennie
-- ---------------------------------------------------------------------
create table public.assistant_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index on public.assistant_messages (user_id, created_at desc);
-- limit liczy Edge Function `ai-chat` (count z dzisiaj, role = 'user')

-- Czat peer (P2): Supabase Realtime Broadcast, BEZ zapisu do bazy.

-- =====================================================================
--  UPRAWNIENIA I RLS
--  Supabase domyślnie daje rolom anon i authenticated pełne prawa do wszystkiego w `public`
--  i liczy na RLS. Tu zabieramy wszystko i oddajemy tylko to, co potrzebne — RLS jest drugą warstwą.
-- =====================================================================
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
alter default privileges in schema public  revoke all on tables    from anon, authenticated;
alter default privileges in schema public  revoke all on sequences from anon, authenticated;
alter default privileges in schema public  revoke execute on functions from anon, authenticated;
alter default privileges revoke execute on functions from public;   -- PUBLIC da się zabrać tylko globalnie, nie per schemat

alter table public.profiles           enable row level security;
alter table public.push_tokens        enable row level security;
alter table public.legal_documents    enable row level security;
alter table public.user_consents      enable row level security;
alter table public.privacy_events     enable row level security;
alter table public.guardian_requests  enable row level security;
alter table public.daily_checkins     enable row level security;
alter table public.vault_entries      enable row level security;
alter table public.good_moments       enable row level security;
alter table public.trusted_contacts   enable row level security;
alter table public.daily_quotes       enable row level security;
alter table public.saved_quotes       enable row level security;
alter table public.posts              enable row level security;
alter table public.comments           enable row level security;
alter table public.votes              enable row level security;
alter table public.reports            enable row level security;
alter table public.assistant_messages enable row level security;

-- (select auth.uid()) zamiast auth.uid(): Postgres liczy to raz na zapytanie, nie raz na wiersz.

-- Profil: czytasz i poprawiasz swój. Tworzy go wyzwalacz, znika razem z kontem.
-- Roku urodzenia nie da się zmienić (od niego zależy zgoda opiekuna).
grant select on public.profiles to authenticated;
grant update (nick, grammar_form, plant_name, theme, mode, reminder_time, timezone) on public.profiles to authenticated;
grant execute on function private.is_timezone(text) to authenticated;   -- używa jej CHECK na profiles.timezone
create policy own_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy own_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- „Tylko moje” — pełny dostęp do własnych wierszy
do $$
declare t text;
begin
  foreach t in array array['vault_entries','good_moments','trusted_contacts','saved_quotes'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy own_all on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Tokeny push: czytasz i kasujesz swoje; rejestruje je register_push_token(), bo ten sam telefon może zmienić konto.
grant select, delete on public.push_tokens to authenticated;
create policy own_select on public.push_tokens for select to authenticated using (user_id = (select auth.uid()));
create policy own_delete on public.push_tokens for delete to authenticated using (user_id = (select auth.uid()));
create or replace function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_token is null or char_length(p_token) not between 10 and 400 then
    raise exception 'invalid_input' using detail = 'Nieprawidłowy token powiadomień.';
  end if;
  insert into public.push_tokens as t (token, user_id, platform) values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, created_at = now();
end $$;
revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Podlewania: czytać swoje można zawsze; ZAPIS i KASOWANIE tylko przez save_checkin() / delete_checkin()
-- (supabase-wnioski.sql), które sprawdzają zgodę, dzień i znaczniki oraz zgłaszają wnioski do przeliczenia.
grant select on public.daily_checkins to authenticated;
grant select on public.herbarium to authenticated;
create policy own_select on public.daily_checkins for select to authenticated using (user_id = (select auth.uid()));

-- Dokumenty: każdy zalogowany czyta. Zgody, dziennik i prośby do opiekuna: czytasz swoje, zapisuje serwer.
-- Uprawnienia do KOLUMN: osoba nie czyta adresu IP (także opiekuna), przeglądarki, odcisku e-maila ani odcisku tokenu.
grant select on public.legal_documents, public.privacy_events to authenticated;
grant select (id, user_id, document_id, kind, given_by, given_at, withdrawn_at, superseded_at) on public.user_consents to authenticated;
grant select (id, user_id, guardian_email, created_at, expires_at, confirmed_at) on public.guardian_requests to authenticated;
create policy read_all   on public.legal_documents   for select to authenticated using (effective_from <= now());
create policy own_select on public.user_consents     for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on public.privacy_events    for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on public.guardian_requests for select to authenticated using (user_id = (select auth.uid()));
grant execute on function public.give_consent(public.legal_doc_kind[])   to authenticated;
grant execute on function public.withdraw_consent(public.legal_doc_kind) to authenticated;
grant execute on function public.delete_my_account()                     to authenticated;
grant execute on function public.confirm_guardian_consent(text, inet)    to service_role;
grant execute on function public.withdraw_guardian_consent(text)         to service_role;
grant select on public.my_consents to authenticated;
grant execute on function private.current_document(public.legal_doc_kind) to authenticated;
grant execute on function public.health_consent_status() to authenticated;

-- Asystent: czytasz swoje, zapisuje tylko serwer (service_role omija RLS).
grant select on public.assistant_messages to authenticated;
create policy own_select on public.assistant_messages for select to authenticated using (user_id = (select auth.uid()));

-- Myśli na dziś: każdy zalogowany czyta
grant select on public.daily_quotes to authenticated;
create policy read_all on public.daily_quotes for select to authenticated using (active);

-- Blog: dodawanie TYLKO przez Edge Function `moderate-post` (brak prawa insert dla użytkownika);
-- autor widzi swoje wpisy (też odrzucone) i może je usunąć, reszta czyta przez widoki blog_posts / blog_comments.
-- Wynik moderacji (kolumna moderation) jest tylko dla serwera: autor nie powinien widzieć progów, które łatwo potem obejść.
grant delete on public.posts, public.comments to authenticated;
grant select (id, author_id, pseudonym, title, body, status, score, comment_count, created_at) on public.posts to authenticated;
grant select (id, post_id, author_id, pseudonym, body, status, created_at) on public.comments to authenticated;
grant select on public.blog_posts, public.blog_comments to authenticated;
create policy own_select on public.posts    for select to authenticated using (author_id = (select auth.uid()));
create policy own_delete on public.posts    for delete to authenticated using (author_id = (select auth.uid()));
create policy own_select on public.comments for select to authenticated using (author_id = (select auth.uid()));
create policy own_delete on public.comments for delete to authenticated using (author_id = (select auth.uid()));

-- Głos: zmienić można tylko wartość (nie wpis), a głosować tylko na wpisy opublikowane.
grant select, insert, delete on public.votes to authenticated;
grant update (value) on public.votes to authenticated;
create policy own_all on public.votes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy only_published on public.votes as restrictive for insert to authenticated
  with check (exists (select 1 from public.blog_posts b where b.id = post_id));

-- Zgłoszenie: status ustawia moderator, nie zgłaszający.
grant insert (reporter_id, post_id, comment_id, reason) on public.reports to authenticated;
create policy add_report on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));

-- Edge Functions (service_role) omijają RLS, ale potrzebują praw do obiektów
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema private to service_role;

-- =====================================================================
--  DANE STARTOWE: dokumenty (wersje robocze — przed startem podmienić url i odciski)
-- =====================================================================
insert into public.legal_documents (kind, version, title, url) values
  ('terms',       '0.1', 'Regulamin ReLeaf',                               'https://releaf.example/regulamin.html'),
  ('privacy',     '0.1', 'Polityka prywatności ReLeaf',                    'https://releaf.example/polityka-prywatnosci.html'),
  ('health_data', '0.1', 'Zgoda na przetwarzanie danych o samopoczuciu',   'https://releaf.example/polityka-prywatnosci.html#zgoda'),
  ('guardian',    '0.1', 'Zgoda opiekuna osoby poniżej 16 lat',            'https://releaf.example/polityka-prywatnosci.html#opiekun');
