-- =====================================================================
--  SCI++ / Releaf — schemat bazy (Supabase / PostgreSQL)
--  Do wklejenia w Supabase → SQL Editor. Region: Frankfurt (RODO).
--
--  Zasady:
--   • każda tabela z danymi użytkownika ma RLS: widzisz i zmieniasz tylko swoje,
--   • usunięcie konta (auth.users) kasuje wszystko kaskadowo (RODO: prawo do usunięcia),
--   • Skrytka jest szyfrowana PO STRONIE TELEFONU — baza trzyma tylko szyfrogram,
--   • blog jest anonimowy: author_id nigdy nie wychodzi na zewnątrz (czytamy przez widoki),
--   • wpisy na blog/komentarze dodaje tylko Edge Function `moderate-post` (service role),
--   • dane o zdrowiu = RODO art. 9 → osobna, jawna zgoda w profilu.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  1. Profil
-- ---------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  nick                text not null check (char_length(nick) between 2 and 24),
  birth_year          smallint check (birth_year between 1990 and 2020),
  plant_name          text check (char_length(plant_name) <= 24),          -- „Mięta”
  theme               text not null default 'morski'
                      check (theme in ('morski','zielony','niebieski','lawenda','rozowy','morelowy')),
  mode                text not null default 'auto' check (mode in ('auto','light','dark')),
  -- zgody (RODO)
  terms_accepted_at   timestamptz not null default now(),
  health_consent_at   timestamptz,          -- art. 9: zgoda na dane o zdrowiu (bez niej nie zapisujemy podlewań)
  parent_consent_at   timestamptz,          -- poniżej 16 lat
  -- przypomnienia
  reminder_time       time,                 -- np. 20:00; null = bez przypomnień
  timezone            text not null default 'Europe/Warsaw',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- profil tworzy się sam przy rejestracji (nick przekazujemy w options.data.nick)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nick) values (new.id, coalesce(new.raw_user_meta_data->>'nick', 'Ja'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- tokeny push (kilka urządzeń na osobę)
create table public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null check (platform in ('ios','android','web')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  2. Codzienne podlewanie (check-in) — jedno na dzień, można edytować
-- ---------------------------------------------------------------------
create table public.daily_checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  day            date not null,                                  -- dzień w strefie użytkownika
  mood           smallint check (mood between 1 and 10),        -- plan: wymagany; design pozwala pominąć → do ustalenia
  sleep_hours    numeric(3,1) check (sleep_hours between 0 and 16),
  sleep_quality  smallint check (sleep_quality between 1 and 4), -- źle / tak sobie / dobrze / świetnie
  -- obszary dnia: -1 ciężko, 0 ok, 1 dobrze, null = nie zaznaczono
  food           smallint check (food between -1 and 1),
  family         smallint check (family between -1 and 1),
  friends        smallint check (friends between -1 and 1),
  love           smallint check (love between -1 and 1),
  nature         smallint check (nature between -1 and 1),
  study          smallint check (study between -1 and 1),
  note           text check (char_length(note) <= 500),
  created_at     timestamptz not null default now(),             -- godzina wpisu → wnioski typu „niedzielne wieczory”
  updated_at     timestamptz not null default now(),
  unique (user_id, day)
);
create index on public.daily_checkins (user_id, day desc);

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
--  3. Skrytka (szyfrowana na urządzeniu) i Słoik dobrych chwil
-- ---------------------------------------------------------------------
create table public.vault_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  ciphertext     text not null,             -- AES-GCM, klucz tylko na telefonie
  iv             text not null,
  source         text not null default 'manual' check (source in ('manual','checkin','blog')),
  checkin_id     uuid references public.daily_checkins(id) on delete set null,
  sent_to_ai_at  timestamptz,               -- tylko gdy użytkownik sam kliknie „Zapytaj Asystenta”
  created_at     timestamptz not null default now()
);
create index on public.vault_entries (user_id, created_at desc);

create table public.good_moments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 300),
  created_at  timestamptz not null default now()
);
create index on public.good_moments (user_id, created_at desc);

-- ---------------------------------------------------------------------
--  4. SOS: bliskie osoby (max 3)
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
--  5. Myśl na dziś
-- ---------------------------------------------------------------------
create table public.daily_quotes (
  id          serial primary key,
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

-- ---------------------------------------------------------------------
--  6. Testy (PHQ-9, GAD-7, PSS-10) — każdy najwyżej raz w tygodniu
-- ---------------------------------------------------------------------
create table public.test_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  test         text not null check (test in ('phq9','gad7','pss10')),
  answers      smallint[] not null,         -- odpowiedzi po kolei (0–3 / 0–4)
  score        smallint not null,
  severity     text not null,               -- np. 'minimal','mild','moderate','severe'
  crisis_flag  boolean not null default false, -- PHQ-9 pyt. 9 > 0 → apka ZAWSZE pokazuje 116 111
  taken_on     date not null default current_date,
  taken_week   date generated always as (date_trunc('week', taken_on::timestamp)::date) stored,
  created_at   timestamptz not null default now(),
  unique (user_id, test, taken_week)
);

-- ---------------------------------------------------------------------
--  7. Wnioski i podsumowania (pisze Edge Function `generate-insights`)
-- ---------------------------------------------------------------------
create table public.insights (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('weekly_summary','weekday','sleep','helps','other')),
  title         text not null,              -- „Niedzielne wieczory bywają trudniejsze”
  summary       text not null,              -- jedno krótkie zdanie
  details       jsonb not null default '{}', -- { reasons: [...], tip: "...", chart: {...} }
  period_start  date not null,
  period_end    date not null,
  dismissed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.insights (user_id, created_at desc);

-- ---------------------------------------------------------------------
--  8. Blog (anonimowy, moderowany)
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

create table public.votes (
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references auth.users(id) on delete cascade,
  post_id      uuid references public.posts(id) on delete cascade,
  comment_id   uuid references public.comments(id) on delete cascade,
  reason       text,
  status       text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at   timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);

-- liczniki głosów i komentarzy
create or replace function public.refresh_post_counters() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  update public.posts set
    score = coalesce((select sum(value) from public.votes where post_id = pid), 0),
    comment_count = (select count(*) from public.comments where post_id = pid and status = 'published')
  where id = pid;
  return null;
end $$;
create trigger votes_counters after insert or update or delete on public.votes
  for each row execute function public.refresh_post_counters();
create trigger comments_counters after insert or update or delete on public.comments
  for each row execute function public.refresh_post_counters();

-- publiczne widoki bez author_id (apka czyta bloga TYLKO stąd)
create view public.blog_posts as
  select id, pseudonym, title, body, score, comment_count, created_at,
         (author_id = auth.uid()) as is_mine
  from public.posts where status = 'published';
create view public.blog_comments as
  select id, post_id, pseudonym, body, created_at, (author_id = auth.uid()) as is_mine
  from public.comments where status = 'published';
grant select on public.blog_posts, public.blog_comments to authenticated;

-- ---------------------------------------------------------------------
--  9. Asystent Wsparcia (P2) — limit 10 wiadomości dziennie
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
--  RLS
-- =====================================================================
alter table public.profiles           enable row level security;
alter table public.push_tokens        enable row level security;
alter table public.daily_checkins     enable row level security;
alter table public.vault_entries      enable row level security;
alter table public.good_moments       enable row level security;
alter table public.trusted_contacts   enable row level security;
alter table public.daily_quotes       enable row level security;
alter table public.saved_quotes       enable row level security;
alter table public.test_results       enable row level security;
alter table public.insights           enable row level security;
alter table public.posts              enable row level security;
alter table public.comments           enable row level security;
alter table public.votes              enable row level security;
alter table public.reports            enable row level security;
alter table public.assistant_messages enable row level security;

-- „tylko moje” — pełny dostęp do własnych wierszy
do $$
declare t text;
begin
  foreach t in array array['push_tokens','daily_checkins','vault_entries','good_moments',
                           'trusted_contacts','saved_quotes','test_results'] loop
    execute format('create policy own_all on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

create policy own_profile on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- wnioski i asystent: czytasz swoje, zapisuje tylko serwer (service role omija RLS)
create policy own_read on public.insights for select to authenticated using (user_id = auth.uid());
create policy own_dismiss on public.insights for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_read on public.assistant_messages for select to authenticated using (user_id = auth.uid());

-- myśli na dziś: każdy zalogowany czyta
create policy read_all on public.daily_quotes for select to authenticated using (active);

-- blog: dodawanie TYLKO przez Edge Function `moderate-post` (brak polityki insert dla użytkownika);
-- autor widzi swoje wpisy (też odrzucone), reszta czyta przez widoki blog_posts / blog_comments
create policy own_posts on public.posts for select to authenticated using (author_id = auth.uid());
create policy own_posts_delete on public.posts for delete to authenticated using (author_id = auth.uid());
create policy own_comments on public.comments for select to authenticated using (author_id = auth.uid());
create policy own_comments_delete on public.comments for delete to authenticated using (author_id = auth.uid());

create policy own_votes on public.votes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy add_report on public.reports for insert to authenticated with check (reporter_id = auth.uid());
