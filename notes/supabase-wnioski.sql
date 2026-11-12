-- =====================================================================
--  ReLeaf — schemat bazy, część 3 z 3: zapis podlewania, znaczniki dnia, wnioski i tygodniowe próby
--  Uruchamiać PO notes/supabase-schema.sql (i supabase-testy.sql), a po tym pliku:
--  notes/supabase-wnioski-dane.sql (katalog pól podlewania, generowany z Main_Front-End/js/wnioski-dane.js).
--
--  Jak to działa (opis zasad i progów: notes/wnioski.md):
--   1. Telefon zapisuje podlewanie JEDNĄ funkcją save_checkin(): nastrój, sen, pora snu, znaczniki dnia, notatka.
--      Funkcja sprawdza zgodę na dane o zdrowiu, dzień i znaczniki; bezpośredniego zapisu do tabel nie ma.
--   2. Znaczniki („obszary dnia” −1/0/1 i „co dziś było” = 1) są w checkin_tags, a ich lista w checkin_fields.
--      Nowe pole to nowy wiersz w katalogu, nie zmiana tabeli.
--   3. Wnioski liczy Edge Function `generate-insights` (service_role) TYM SAMYM silnikiem co aplikacja
--      (Main_Front-End/js/wnioski.js): czyta dni z checkin_days, zapisuje wynik przez replace_insights().
--      Baza nie zna statystyki — pilnuje za to tożsamości wniosku (klucz), opinii osoby i tego, kto co widzi.
--   4. Osoba może wnioskowi powiedzieć „pasuje” / „nie pasuje” (set_insight_feedback) i zacząć tygodniową próbę
--      (start_experiment). Opinia przeżywa kolejne przeliczenia, bo wniosek ma stały klucz, np. 'czynnik:ruch'.
--   5. To dane o zdrowiu: bez zgody nic się nie liczy, a wycofanie zgody usuwa wnioski i próby od razu.
--
--  Czego tu celowo NIE ma: tekstów wniosków po stronie bazy (są w silniku, żeby telefon i serwer mówiły to samo)
--  i kopii surowych statystyk każdej próby testu (wystarcza wynik i liczby dni).
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Katalog pól podlewania i znaczniki dnia
-- ---------------------------------------------------------------------
create table public.checkin_fields (
  code        text primary key check (code ~ '^[a-z_]+$'),          -- 'friends', 'move', …
  kind        text not null check (kind in ('area', 'activity')),   -- obszar dnia (−1/0/1) albo „co dziś było” (1)
  name        text not null,
  position    smallint not null check (position > 0),
  min_value   smallint not null,
  max_value   smallint not null,
  is_active   boolean not null default true,                        -- wyłączone pole znika z podlewania, stare dane zostają
  created_at  timestamptz not null default now(),
  check (max_value >= min_value),
  unique (kind, position)
);
comment on table public.checkin_fields is 'Co da się zaznaczyć w podlewaniu poza nastrojem i snem. Każde pole musi służyć jakiemuś wnioskowi (minimalizacja danych).';

create table public.checkin_tags (
  checkin_id  uuid not null references public.daily_checkins(id) on delete cascade,
  field_code  text not null references public.checkin_fields(code),
  value       smallint not null,
  primary key (checkin_id, field_code)
);
create index on public.checkin_tags (field_code);

-- Czynniki, które zna silnik (generowane z js/wnioski-dane.js): ton i to, czy wolno zacząć z nich tygodniową próbę.
-- Dzięki temu baza odrzuci wniosek o czymś, czego nie analizujemy (np. miłość), i próbę z czegoś, co nie jest radą.
create table public.insight_factors (
  code       text primary key check (code ~ '^[a-z_]+$'),
  tone       text not null check (tone in ('pomaga', 'zauwazone', 'wsparcie')),
  can_try    boolean not null default false,
  check (not can_try or tone = 'pomaga')
);

-- wartość musi mieścić się w zakresie pola (pilnuje też zapisów serwera, nie tylko save_checkin)
create or replace function private.checkin_tags_guard() returns trigger
language plpgsql set search_path = '' as $$
declare f public.checkin_fields;
begin
  select * into f from public.checkin_fields x where x.code = new.field_code;
  if new.value < f.min_value or new.value > f.max_value then
    raise exception 'invalid_tags' using detail = format('Pole „%s” przyjmuje wartości %s–%s.', new.field_code, f.min_value, f.max_value);
  end if;
  return new;
end $$;
create trigger checkin_tags_guard before insert or update on public.checkin_tags
  for each row execute function private.checkin_tags_guard();

-- ---------------------------------------------------------------------
--  2. Zapis podlewania — jedyna droga
-- ---------------------------------------------------------------------
-- kolejka przeliczeń: kto ma nowe dane od ostatniego liczenia wniosków
create table public.insight_runs (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  needs_run       boolean not null default true,
  last_run_at     timestamptz,
  engine_version  smallint,
  days_used       smallint
);
create index on public.insight_runs (needs_run) where needs_run;

-- RPC: supabase.rpc('save_checkin', { p_day: '2026-11-12', p_mood: 7, p_sleep_hours: 7.5, p_sleep_quality: 3,
--                                     p_bedtime: 2, p_tags: { friends: 1, study: -1, move: 1 }, p_note: '…' })
-- Zapisuje CAŁY wpis dnia (zastępuje poprzedni z tego dnia razem ze znacznikami). Zwraca id wpisu.
-- Błędy (pole message): not_authenticated · consent_required · invalid_day · invalid_tags.
create or replace function public.save_checkin(
  p_day date, p_mood smallint default null, p_sleep_hours numeric default null, p_sleep_quality smallint default null,
  p_bedtime smallint default null, p_tags jsonb default '{}'::jsonb, p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid    uuid := auth.uid();
  tz     text;
  now_l  timestamp;
  cid    uuid;
  bad    text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- blokada na wierszach zgody: wycofanie zgody czeka na koniec zapisu (i wtedy go usuwa)
  perform 1 from public.user_consents c
    where c.user_id = uid and c.kind in ('health_data', 'guardian') and c.withdrawn_at is null and c.superseded_at is null
    for share;
  if not private.has_consent(uid, 'health_data') then
    raise exception 'consent_required'
      using detail = 'Do zapisania podlewania potrzebna jest zgoda na dane o samopoczuciu (poniżej 16 lat także zgoda opiekuna).';
  end if;

  select coalesce((select p.timezone from public.profiles p where p.id = uid), 'Europe/Warsaw') into tz;
  now_l := now() at time zone tz;
  -- dziś albo do 6 dni wstecz (uzupełnienie wpisu); nigdy w przyszłość. Strefę ustawia sama osoba, więc dodatkowo
  -- dzień nie może wyprzedzać daty UTC o więcej niż jeden (żadna strefa nie daje więcej).
  if p_day is null or p_day > now_l::date or p_day < now_l::date - 6 or p_day > (now() at time zone 'UTC')::date + 1 then
    raise exception 'invalid_day' using detail = 'Podlewanie można zapisać za dziś albo najwyżej 6 dni wstecz.';
  end if;

  p_tags := coalesce(p_tags, '{}'::jsonb);
  if jsonb_typeof(p_tags) <> 'object' then
    raise exception 'invalid_tags' using detail = 'Znaczniki muszą być obiektem { kod: wartość }.';
  end if;
  select t.key into bad
    from jsonb_each(p_tags) t
    left join public.checkin_fields f on f.code = t.key and f.is_active
    where f.code is null or jsonb_typeof(t.value) <> 'number' or (t.value #>> '{}') !~ '^-?[0-9]{1,3}$'
       or (t.value #>> '{}')::int < f.min_value or (t.value #>> '{}')::int > f.max_value
    limit 1;
  if bad is not null then
    raise exception 'invalid_tags' using detail = format('Nieznane pole albo wartość poza zakresem: „%s”.', bad);
  end if;

  insert into public.daily_checkins as c (user_id, day, mood, sleep_hours, sleep_quality, bedtime, note, entry_hour)
    values (uid, p_day, p_mood, p_sleep_hours, p_sleep_quality, p_bedtime, nullif(trim(p_note), ''),
            case when p_day = now_l::date then extract(hour from now_l)::smallint end)   -- wpis uzupełniany po fakcie nie ma godziny
  on conflict (user_id, day) do update
    set mood = excluded.mood, sleep_hours = excluded.sleep_hours, sleep_quality = excluded.sleep_quality,
        bedtime = excluded.bedtime, note = excluded.note                 -- entry_hour zostaje z pierwszego zapisu
  returning c.id into cid;

  delete from public.checkin_tags t where t.checkin_id = cid;
  insert into public.checkin_tags (checkin_id, field_code, value)
    select cid, t.key, (t.value #>> '{}')::smallint from jsonb_each(p_tags) t;

  insert into public.insight_runs (user_id) values (uid)
  on conflict (user_id) do update set needs_run = true;
  return cid;
end $$;

-- RPC: supabase.rpc('delete_checkin', { p_day: '2026-11-12' }) — usuwa podlewanie z danego dnia (ze znacznikami)
-- i zgłasza wnioski do przeliczenia. Zwraca true, gdy było co usunąć.
create or replace function public.delete_checkin(p_day date) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.daily_checkins c where c.user_id = uid and c.day = p_day;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.insight_runs (user_id) values (uid) on conflict (user_id) do update set needs_run = true;
  end if;
  return n > 0;
end $$;

-- Dni w kształcie, którego oczekuje silnik (js/wnioski.js): { day, mood, sleep_hours, sleep_quality, bedtime, entry_hour, areas, acts }
create view public.checkin_days with (security_invoker = true) as
select c.id, c.user_id, c.day, c.mood, c.sleep_hours, c.sleep_quality, c.bedtime, c.entry_hour, c.note,
       coalesce((select jsonb_object_agg(t.field_code, t.value) from public.checkin_tags t
                 join public.checkin_fields f on f.code = t.field_code
                 where t.checkin_id = c.id and f.kind = 'area'), '{}'::jsonb) as areas,
       coalesce((select jsonb_object_agg(t.field_code, t.value) from public.checkin_tags t
                 join public.checkin_fields f on f.code = t.field_code
                 where t.checkin_id = c.id and f.kind = 'activity'), '{}'::jsonb) as acts
from public.daily_checkins c;

-- ---------------------------------------------------------------------
--  3. Wnioski
-- ---------------------------------------------------------------------
create table public.insights (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  key             text not null check (key ~ '^[a-z_]+(:[a-z0-9_]+)?$'),     -- stała tożsamość: 'czynnik:ruch', 'dzien:0', 'trend:dol', 'powrot'
  -- Od wersji 2 silnika (12.11.2026) serwer nie zapisuje wniosków o tonie 'wsparcie' ani rodzaju 'powrot': trudne sprawy
  -- (dom, znajomi) to karta wsparcia liczona z dni na telefonie, bez wiersza w bazie. Ograniczenia zostają jako bezpiecznik.
  kind            text not null check (kind in ('czynnik', 'dzien_tygodnia', 'trend', 'powrot')),
  tone            text not null check (tone in ('pomaga', 'zauwazone', 'wsparcie')),
  factor          text references public.insight_factors(code),              -- kod czynnika z katalogu silnika (dla kind = 'czynnik')
  confidence      smallint not null check (confidence between 1 and 3),      -- 1 wstępnie · 2 dość wyraźnie · 3 wyraźnie
  effect          numeric(4,2) not null,                                     -- różnica nastroju w punktach (ze znakiem)
  n_days          smallint not null check (n_days > 0),                      -- z ilu dni policzono
  n_with          smallint,
  n_without       smallint,
  title           text not null,
  summary         text not null,
  details         jsonb not null default '{}'::jsonb,                        -- { tag, kat, wykres, powody, sprobuj, wsparcie, proba }
  engine_version  smallint not null,
  status          text not null default 'active' check (status in ('active', 'expired')),   -- expired: w ostatnim liczeniu już się nie potwierdził
  first_seen_at   timestamptz not null default now(),
  computed_at     timestamptz not null default now(),
  feedback        text check (feedback in ('pasuje', 'nie')),                -- opinia osoby; przeżywa kolejne liczenia
  feedback_at     timestamptz,
  unique (user_id, key),
  check ((feedback is null) = (feedback_at is null)),
  check ((kind = 'czynnik') = (factor is not null)),
  check (tone <> 'wsparcie' or not (details ? 'sprobuj' or details ? 'proba')),   -- trudne sprawy nigdy nie mają rady ani próby
  check (pg_column_size(details) < 8000)
);
comment on table public.insights is 'Wnioski policzone silnikiem js/wnioski.js. Zapisuje wyłącznie replace_insights() (service_role). To dane o zdrowiu.';
create index on public.insights (user_id, status);

-- Edge Function `generate-insights` (service_role): supabase.rpc('replace_insights', { p_user, p_engine_version, p_days_used, p_insights })
--   p_insights: tablica z silnika: [{ key, typ, ton, czynnik, pewnosc, efekt, n, n1, n0, tytul, zdanie, tag, kat, wykres, powody, sprobuj, wsparcie, proba }]
-- Wniosek o znanym kluczu jest aktualizowany (opinia i data pierwszego pojawienia zostają), brakujący dostaje status 'expired'.
-- Zwraca liczbę aktywnych wniosków. Bez zgody osoby usuwa jej wnioski i nic nie zapisuje.
create or replace function public.replace_insights(p_user uuid, p_engine_version smallint, p_days_used smallint, p_insights jsonb)
returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform 1 from public.user_consents c
    where c.user_id = p_user and c.kind in ('health_data', 'guardian') and c.withdrawn_at is null and c.superseded_at is null
    for share;
  if not private.has_consent(p_user, 'health_data') then
    delete from public.insights i where i.user_id = p_user;
    return 0;
  end if;
  if p_insights is null or jsonb_typeof(p_insights) <> 'array' then
    raise exception 'invalid_input' using detail = 'p_insights musi być tablicą.';
  end if;
  -- czynnik musi być w katalogu i mieć ton z katalogu: silnik w innej wersji nie przemyci rady przy trudnej sprawie
  if exists (select 1 from jsonb_array_elements(p_insights) e
             left join public.insight_factors f on f.code = e->>'czynnik'
             where e->>'typ' = 'czynnik' and (f.code is null or f.tone <> e->>'ton')) then
    raise exception 'invalid_input' using detail = 'Nieznany czynnik albo ton niezgodny z katalogiem (insight_factors).';
  end if;

  update public.insights i set status = 'expired'
    where i.user_id = p_user and i.status = 'active'
      and not exists (select 1 from jsonb_array_elements(p_insights) e where e->>'key' = i.key);

  insert into public.insights as i (user_id, key, kind, tone, factor, confidence, effect, n_days, n_with, n_without,
                                    title, summary, details, engine_version)
    select p_user, e->>'key', e->>'typ', e->>'ton', e->>'czynnik', (e->>'pewnosc')::smallint, round((e->>'efekt')::numeric, 2),
           (e->>'n')::smallint, (e->>'n1')::smallint, (e->>'n0')::smallint, e->>'tytul', e->>'zdanie',
           jsonb_strip_nulls(jsonb_build_object('tag', e->'tag', 'kat', e->'kat', 'wykres', e->'wykres', 'powody', e->'powody',
                                                'sprobuj', case when e->>'ton' = 'wsparcie' then null else e->'sprobuj' end,
                                                'wsparcie', e->'wsparcie',
                                                'proba', case when e->>'ton' = 'pomaga' then e->'proba' end)),
           p_engine_version
    from jsonb_array_elements(p_insights) e
  on conflict (user_id, key) do update
    set kind = excluded.kind, tone = excluded.tone, factor = excluded.factor, confidence = excluded.confidence,
        effect = excluded.effect, n_days = excluded.n_days, n_with = excluded.n_with, n_without = excluded.n_without,
        title = excluded.title, summary = excluded.summary, details = excluded.details,
        engine_version = excluded.engine_version, status = 'active', computed_at = now();

  insert into public.insight_runs (user_id, needs_run, last_run_at, engine_version, days_used)
    values (p_user, false, now(), p_engine_version, p_days_used)
  on conflict (user_id) do update
    set needs_run = false, last_run_at = now(), engine_version = excluded.engine_version, days_used = excluded.days_used;

  select count(*) into n from public.insights i where i.user_id = p_user and i.status = 'active';
  return n;
end $$;

-- RPC: supabase.rpc('set_insight_feedback', { p_id, p_feedback: 'pasuje' | 'nie' | null })
create or replace function public.set_insight_feedback(p_id uuid, p_feedback text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_feedback is not null and p_feedback not in ('pasuje', 'nie') then
    raise exception 'invalid_input' using detail = 'Opinia to „pasuje”, „nie” albo null.';
  end if;
  update public.insights i
    set feedback = p_feedback, feedback_at = case when p_feedback is null then null else now() end
    where i.id = p_id and i.user_id = uid;
  if not found then
    raise exception 'not_found' using detail = 'Nie ma takiego wniosku.';
  end if;
end $$;

-- To, co ekran pokazuje: aktywne wnioski bez schowanych („nie pasuje” chowa wniosek na 60 dni)
create view public.my_insights with (security_invoker = true) as
select i.id, i.key, i.kind, i.tone, i.factor, i.confidence, i.effect, i.n_days, i.n_with, i.n_without,
       i.title, i.summary, i.details, i.feedback, i.feedback_at, i.first_seen_at, i.computed_at
from public.insights i
where i.user_id = (select auth.uid()) and i.status = 'active'
  and not (i.feedback is not null and i.feedback = 'nie' and i.feedback_at > now() - interval '60 days');

-- ---------------------------------------------------------------------
--  4. Tygodniowa próba: „spróbuj 3 razy i zobacz”
-- ---------------------------------------------------------------------
create table public.insight_experiments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  insight_key  text not null check (insight_key ~ '^[a-z_]+:[a-z0-9_]+$' and char_length(insight_key) <= 60),   -- 'czynnik:ruch', 'obserwacja:ruch', 'ogolne:ruch'
  factor       text not null references public.insight_factors(code),   -- kod czynnika z silnika
  times        smallint not null check (times between 1 and 7),  -- ile razy w tygodniu (propozycja, nie zobowiązanie)
  started_on   date not null,
  ends_on      date generated always as (started_on + 6) stored,
  status       text not null default 'active' check (status in ('active', 'done', 'stopped')),
  result       jsonb check (result is null or (pg_column_size(result) < 2000 and result->>'typ' in ('lepsze_dni', 'bez_roznicy', 'za_malo', 'bez_porownania'))),   -- { typ, zrobione }
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  check ((status = 'active') = (finished_at is null))
);
comment on table public.insight_experiments is 'Próba nie jest zadaniem do zaliczenia: mniej razy niż plan to „mniej okazji”, nigdy porażka.';
create unique index insight_experiments_one_active on public.insight_experiments (user_id) where status = 'active';
create index on public.insight_experiments (user_id, started_on desc);

-- RPC: supabase.rpc('start_experiment', { p_insight_key: 'czynnik:ruch', p_factor: 'ruch', p_times: 3 })
create or replace function public.start_experiment(p_insight_key text, p_factor text, p_times smallint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  eid uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform 1 from public.user_consents c
    where c.user_id = uid and c.kind in ('health_data', 'guardian') and c.withdrawn_at is null and c.superseded_at is null
    for share;
  if not private.has_consent(uid, 'health_data') then
    raise exception 'consent_required' using detail = 'Próba korzysta z danych o samopoczuciu.';
  end if;
  if not exists (select 1 from public.insight_factors f where f.code = p_factor and f.can_try) then
    raise exception 'invalid_input' using detail = 'Z tego czynnika nie da się zacząć próby.';
  end if;
  if exists (select 1 from public.insight_experiments x where x.user_id = uid and x.status = 'active') then
    raise exception 'experiment_active' using detail = 'Jedna próba naraz. Zakończ bieżącą, żeby zacząć nową.';
  end if;
  begin
    insert into public.insight_experiments (user_id, insight_key, factor, times, started_on)
      values (uid, p_insight_key, p_factor, p_times,
              (now() at time zone coalesce((select p.timezone from public.profiles p where p.id = uid), 'Europe/Warsaw'))::date)
      returning id into eid;
  exception when unique_violation then                    -- dwa żądania naraz
    raise exception 'experiment_active' using detail = 'Jedna próba naraz. Zakończ bieżącą, żeby zacząć nową.';
  end;
  return eid;
end $$;

-- RPC: supabase.rpc('finish_experiment', { p_id, p_status: 'done' | 'stopped', p_result: { … } })
create or replace function public.finish_experiment(p_id uuid, p_status text default 'stopped', p_result jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_status not in ('done', 'stopped') then
    raise exception 'invalid_input' using detail = 'Status to „done” albo „stopped”.';
  end if;
  update public.insight_experiments x set status = p_status, result = p_result, finished_at = now()
    where x.id = p_id and x.user_id = uid and x.status = 'active';
  if not found then
    raise exception 'not_found' using detail = 'Nie ma takiej aktywnej próby.';
  end if;
end $$;

-- ---------------------------------------------------------------------
--  5. Wycofanie zgody usuwa wnioski i próby (podlewania ze znacznikami usuwa supabase-schema.sql)
-- ---------------------------------------------------------------------
create or replace function private.erase_insight_data() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n_i int; n_e int;
begin
  delete from public.insights i where i.user_id = new.user_id;
  get diagnostics n_i = row_count;
  delete from public.insight_experiments x where x.user_id = new.user_id;
  get diagnostics n_e = row_count;
  delete from public.insight_runs r where r.user_id = new.user_id;
  return null;                                            -- ślad zostawia wyzwalacz z supabase-schema.sql (jeden na wycofanie)
end $$;
create trigger user_consents_erase_insights after update of withdrawn_at on public.user_consents
  for each row when (new.kind in ('health_data', 'guardian') and old.withdrawn_at is null and new.withdrawn_at is not null
                     and new.user_id is not null)
  execute function private.erase_insight_data();

-- =====================================================================
--  UPRAWNIENIA I RLS
-- =====================================================================
revoke all on public.checkin_fields, public.checkin_tags, public.insight_factors, public.insight_runs, public.insights,
              public.insight_experiments, public.checkin_days, public.my_insights from public, anon, authenticated;
revoke all on function public.save_checkin(date, smallint, numeric, smallint, smallint, jsonb, text),
                       public.replace_insights(uuid, smallint, smallint, jsonb),
                       public.set_insight_feedback(uuid, text),
                       public.start_experiment(text, text, smallint),
                       public.finish_experiment(uuid, text, jsonb),
                       public.delete_checkin(date) from public, anon, authenticated;

alter table public.checkin_fields      enable row level security;
alter table public.checkin_tags        enable row level security;
alter table public.insight_factors     enable row level security;
alter table public.insight_runs        enable row level security;
alter table public.insights            enable row level security;
alter table public.insight_experiments enable row level security;

-- katalog pól: każdy zalogowany czyta; znaczniki, wnioski i próby: tylko własne, tylko do odczytu
grant select on public.checkin_fields, public.checkin_tags, public.insight_factors, public.insights, public.insight_experiments to authenticated;
create policy read_all   on public.checkin_fields  for select to authenticated using (true);
create policy read_all   on public.insight_factors for select to authenticated using (true);
create policy own_select on public.checkin_tags   for select to authenticated
  using (exists (select 1 from public.daily_checkins c where c.id = checkin_id and c.user_id = (select auth.uid())));
create policy own_select on public.insights            for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on public.insight_experiments for select to authenticated using (user_id = (select auth.uid()));
-- insight_runs: bez polityk — to kolejka serwera

grant select on public.checkin_days, public.my_insights to authenticated;
grant execute on function public.save_checkin(date, smallint, numeric, smallint, smallint, jsonb, text) to authenticated;
grant execute on function public.delete_checkin(date)                    to authenticated;
grant execute on function public.set_insight_feedback(uuid, text)        to authenticated;
grant execute on function public.start_experiment(text, text, smallint)  to authenticated;
grant execute on function public.finish_experiment(uuid, text, jsonb)    to authenticated;
grant execute on function public.replace_insights(uuid, smallint, smallint, jsonb) to service_role;

grant all on public.checkin_fields, public.checkin_tags, public.insight_factors, public.insight_runs, public.insights, public.insight_experiments to service_role;
grant select on public.checkin_days to service_role;
grant execute on all functions in schema private to service_role;
