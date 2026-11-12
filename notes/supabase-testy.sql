-- =====================================================================
--  ReLeaf — schemat bazy, część 2 z 3: testy WHO-5 i Big Five (IPIP-BFM-20)
--  Uruchamiać PO notes/supabase-schema.sql (korzysta z jego zgód i funkcji),
--  a po tym pliku: notes/supabase-testy-dane.sql (pytania i opisy wyników).
--
--  Zastępuje prototyp Waldka z 9.11.2026. Co się zmieniło i dlaczego:
--   1. Wynik liczy SERWER (submit_test). Telefon wysyła tylko odpowiedzi i nie ma
--      prawa zapisu do tabel wyników — nie da się wpisać sobie dowolnego wyniku.
--   2. Bez zgody `health_data` (i zgody opiekuna poniżej 16 lat) test się nie zapisze.
--      Sesja pamięta, na podstawie której zgody powstała (consent_id).
--   3. Zgody przeniesione do supabase-schema.sql: są dziennikiem, którego nie da się
--      skasować ani podrobić; IP ustawia serwer. Wycofanie zgody usuwa wyniki testów.
--   4. Usuwanie jest prawdziwe (delete), nie `deleted_at`. „Cofnij” robi telefon,
--      zanim wyśle żądanie. Każde usunięcie zostawia ślad w privacy_events (bez treści).
--   5. Wersje: zmiana pytań albo opisów wyniku = nowy wiersz w questionnaires
--      ('who5-v2'). Używanej wersji nie da się edytować, więc historia zawsze pokazuje
--      to, co osoba zobaczyła tamtego dnia.
--   6. Jedna skala (WHO-5) i wiele skal (Big Five) w tym samym modelu: test_scores
--      ma wiersz na skalę. Pytania odwrócone odwraca serwer.
--   7. Odstęp między podejściami (min_interval_days) pilnuje serwer.
--   8. Klucze obce złożone pilnują, żeby odpowiedź i wynik należały do tego samego
--      kwestionariusza co sesja. Wszystkie kolumny mają NOT NULL i CHECK tam, gdzie trzeba.
--
--  Co przechowujemy (ustalenia z 9.11.2026) i nic więcej:
--    surowe odpowiedzi (test_answers) · wynik policzony (test_scores.raw, scaled) ·
--    komunikat, który osoba zobaczyła (test_scores.band_code → score_bands) ·
--    czas wykonania (test_sessions.completed_at) · zgoda (test_sessions.consent_id → user_consents).
--
--  DO POTWIERDZENIA:
--   • Big Five: IPIP-BFM-20 był badany na osobach 16–83 lata. Nie mamy norm dla młodzieży,
--     dlatego NIE liczymy stenów — pokazujemy tylko położenie na skali 0–100 i opis słowny.
--   • WHO-5: licencja CC BY-NC-SA 3.0 IGO (użycie niekomercyjne, z podaniem źródła).
--     Przy modelu biznesowym trzeba sprawdzić, czy aplikacja się w tym mieści.
--   • Odstępy: WHO-5 co 7 dni (plan: „najwyżej raz w tygodniu”), Big Five co 30 dni.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Słowniki: kwestionariusz, skale, pytania, opisy wyników
-- ---------------------------------------------------------------------
create table public.questionnaires (
  id                  text primary key check (id ~ '^[a-z0-9]+-v[0-9]+$'),   -- 'who5-v1'
  code                text not null check (code ~ '^[a-z0-9]+$'),            -- 'who5' | 'ipip20'
  version             smallint not null check (version > 0),
  title               text not null,                                         -- nazwa w aplikacji
  official_name       text not null,                                         -- nazwa narzędzia
  instruction         text not null,                                         -- zdanie nad pytaniami
  answer_min          smallint not null,
  answer_max          smallint not null,
  answer_labels       text[] not null,                                       -- podpisy odpowiedzi od answer_min do answer_max
  min_interval_days   smallint not null default 0 check (min_interval_days >= 0),
  validated_from_age  smallint check (validated_from_age between 0 and 120),
  source              text not null,                                         -- skąd pochodzi polska wersja
  licence             text not null,
  is_active           boolean not null default false,                        -- włącza się po wgraniu pytań i opisów
  created_at          timestamptz not null default now(),
  unique (code, version),
  check (answer_max > answer_min),
  check (cardinality(answer_labels) = answer_max - answer_min + 1)
);
comment on table public.questionnaires is 'Wersje kwestionariuszy. Nowa treść = nowy wiersz (id z numerem wersji); stare wyniki wskazują na swoją wersję.';
-- w aplikacji działa jedna wersja danego testu naraz
create unique index questionnaires_one_active on public.questionnaires (code) where is_active;

create table public.questionnaire_scales (
  questionnaire_id  text not null references public.questionnaires(id) on delete cascade,
  code              text not null check (code ~ '^[a-z_]+$'),                -- 'total' | 'extraversion' | …
  position          smallint not null check (position > 0),
  name              text not null,
  low_label         text,                                                    -- podpis lewego końca skali („cisza i małe grono”)
  high_label        text,
  primary key (questionnaire_id, code),
  unique (questionnaire_id, position)
);

create table public.questionnaire_questions (
  questionnaire_id  text not null references public.questionnaires(id) on delete cascade,
  position          smallint not null check (position > 0),                  -- kolejność w teście, od 1
  scale_code        text not null,
  is_reversed       boolean not null default false,                          -- pytanie odwrócone: liczy się min + max − odpowiedź
  source_item       text,                                                    -- numer pozycji w oryginale (IPIP-BFM-50)
  -- treść w trzech formach gramatycznych (profiles.grammar_form): męska, żeńska, neutralna
  text_m            text not null,
  text_f            text not null,
  text_n            text not null,
  primary key (questionnaire_id, position),
  foreign key (questionnaire_id, scale_code) references public.questionnaire_scales (questionnaire_id, code) on delete cascade
);
create index on public.questionnaire_questions (questionnaire_id, scale_code);

-- Opis wyniku dla przedziału skali 0–100. To jest „komunikat, który użytkownik zobaczył”.
-- Wykluczenie GiST nie pozwala, żeby dwa przedziały tej samej skali na siebie zachodziły.
create table public.score_bands (
  questionnaire_id  text not null,
  scale_code        text not null,
  code              text not null check (code ~ '^[a-z_]+$'),                -- 'ok' | 'lower' | 'support' | 'low' | 'mid' | 'high'
  scaled_range      numrange not null check (not isempty(scaled_range) and scaled_range <@ numrange(0, 100, '[]')),
  title             text not null,
  body              text not null,
  shows_support     boolean not null default false,                          -- przy tym wyniku ZAWSZE pokazujemy 116 111, Asystenta i bliskie osoby
  primary key (questionnaire_id, scale_code, code),
  foreign key (questionnaire_id, scale_code) references public.questionnaire_scales (questionnaire_id, code) on delete cascade,
  exclude using gist (questionnaire_id with =, scale_code with =, scaled_range with &&)
);

-- Kwestionariusz da się włączyć tylko wtedy, gdy jest kompletny.
create or replace function private.validate_questionnaire(p_id text) returns void
language plpgsql set search_path = '' as $$
declare n int; bad text;
begin
  select count(*) into n from public.questionnaire_questions q where q.questionnaire_id = p_id;
  if n = 0 or exists (select 1 from public.questionnaire_questions q where q.questionnaire_id = p_id and q.position > n) then
    raise exception 'questionnaire_incomplete' using detail = format('%s: pytania muszą mieć pozycje 1..n bez dziur.', p_id);
  end if;
  select s.code into bad from public.questionnaire_scales s
    where s.questionnaire_id = p_id
      and not exists (select 1 from public.questionnaire_questions q where q.questionnaire_id = p_id and q.scale_code = s.code)
    limit 1;
  if bad is not null then
    raise exception 'questionnaire_incomplete' using detail = format('%s: skala „%s” nie ma pytań.', p_id, bad);
  end if;
  select s.code into bad from public.questionnaire_scales s
    where s.questionnaire_id = p_id
      and coalesce((select range_agg(b.scaled_range) from public.score_bands b
                    where b.questionnaire_id = p_id and b.scale_code = s.code), '{}'::nummultirange)
          <> nummultirange(numrange(0, 100, '[]'))
    limit 1;
  if bad is not null then
    raise exception 'questionnaire_incomplete' using detail = format('%s: opisy wyniku skali „%s” nie pokrywają całego zakresu 0–100.', p_id, bad);
  end if;
end $$;

create or replace function private.questionnaires_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    perform private.validate_questionnaire(new.id);
  end if;
  return new;
end $$;
create trigger questionnaires_guard before insert or update on public.questionnaires
  for each row execute function private.questionnaires_guard();

-- Wersji, którą ktoś już wypełnił, nie wolno zmieniać: historia ma pokazywać dokładnie to, co było na ekranie.
create or replace function private.forbid_change_when_used() returns trigger
language plpgsql set search_path = '' as $$
declare qid text := case when tg_op = 'DELETE' then old.questionnaire_id else new.questionnaire_id end;
begin
  if exists (select 1 from public.test_sessions s where s.questionnaire_id = qid) then
    raise exception 'questionnaire_in_use'
      using detail = format('%s ma już wyniki. Zamiast poprawiać, dodaj nową wersję kwestionariusza.', qid);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- ---------------------------------------------------------------------
--  2. Wyniki użytkownika
-- ---------------------------------------------------------------------
create table public.test_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  questionnaire_id  text not null references public.questionnaires(id),
  consent_id        uuid not null references public.user_consents(id),      -- zgoda health_data, na podstawie której zapisano wynik
  completed_at      timestamptz not null default now(),
  completed_on      date not null,                                          -- dzień w strefie użytkownika (odstępy, wykres)
  support_shown     boolean not null default false,                         -- czy przy wyniku pokazaliśmy wsparcie
  unique (id, questionnaire_id)                                             -- dla kluczy obcych z odpowiedzi i wyników
);
comment on table public.test_sessions is 'Jedno wypełnienie testu. Zapisuje wyłącznie submit_test().';
create index on public.test_sessions (user_id, completed_at desc);
create index on public.test_sessions (questionnaire_id);
create index on public.test_sessions (consent_id);

create table public.test_answers (
  session_id        uuid not null,
  questionnaire_id  text not null,
  position          smallint not null,
  value             smallint not null,
  primary key (session_id, position),
  foreign key (session_id, questionnaire_id) references public.test_sessions (id, questionnaire_id) on delete cascade,
  foreign key (questionnaire_id, position)   references public.questionnaire_questions (questionnaire_id, position)
);
comment on table public.test_answers is 'Surowe odpowiedzi. Zakres wartości sprawdza submit_test() względem answer_min..answer_max.';

create table public.test_scores (
  session_id        uuid not null,
  questionnaire_id  text not null,
  scale_code        text not null,
  raw               smallint not null,                                      -- suma punktów po odwróceniu pytań odwróconych
  scaled            numeric(5,2) not null check (scaled between 0 and 100), -- położenie na skali 0–100 (WHO-5: procent)
  band_code         text not null,                                          -- opis, który osoba zobaczyła
  primary key (session_id, scale_code),
  foreign key (session_id, questionnaire_id) references public.test_sessions (id, questionnaire_id) on delete cascade,
  foreign key (questionnaire_id, scale_code, band_code) references public.score_bands (questionnaire_id, scale_code, code)
);

create trigger scales_locked    before update or delete on public.questionnaire_scales
  for each row execute function private.forbid_change_when_used();
create trigger questions_locked before update or delete on public.questionnaire_questions
  for each row execute function private.forbid_change_when_used();
create trigger bands_locked     before update or delete on public.score_bands
  for each row execute function private.forbid_change_when_used();

-- ---------------------------------------------------------------------
--  3. Zapis wyniku — jedyna droga
-- ---------------------------------------------------------------------
-- RPC: supabase.rpc('submit_test', { p_code: 'who5', p_answers: [3, 4, 2, 3, 4] })
--   p_answers: odpowiedzi w kolejności pytań (position 1..n), w skali kwestionariusza, bez odwracania.
-- Zwraca to, co ekran wyniku ma pokazać:
--   { session_id, questionnaire_id, completed_at, support_shown, next_available_on,
--     scores: [{ scale, name, raw, scaled, band, title, body, shows_support }] }
-- Błędy (pole message): not_authenticated · unknown_test · consent_required · too_soon · invalid_answers.
create or replace function public.submit_test(p_code text, p_answers smallint[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid       uuid := auth.uid();
  q         public.questionnaires;
  consent   uuid;
  today     date;
  last_on   date;
  n         int;
  sid       uuid;
  support   boolean;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into q from public.questionnaires x where x.code = p_code and x.is_active;
  if not found then
    raise exception 'unknown_test' using detail = format('Nie ma aktywnego testu „%s”.', p_code);
  end if;

  if not private.has_consent(uid, 'health_data') then
    raise exception 'consent_required'
      using detail = 'Do zapisania wyniku potrzebna jest zgoda na przetwarzanie danych o samopoczuciu (poniżej 16 lat także zgoda opiekuna).';
  end if;
  select c.id into consent from public.user_consents c
    where c.user_id = uid and c.kind = 'health_data' and c.withdrawn_at is null and c.superseded_at is null;

  -- dwa żądania naraz nie obejdą odstępu między podejściami
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || q.code, 0));

  select (now() at time zone coalesce((select p.timezone from public.profiles p where p.id = uid), 'Europe/Warsaw'))::date
    into today;
  select max(s.completed_on) into last_on
    from public.test_sessions s join public.questionnaires x on x.id = s.questionnaire_id
    where s.user_id = uid and x.code = q.code;
  if last_on is not null and today < last_on + q.min_interval_days then
    raise exception 'too_soon'
      using detail = format('Ten test można powtórzyć od %s.', to_char(last_on + q.min_interval_days, 'YYYY-MM-DD'));
  end if;

  select count(*) into n from public.questionnaire_questions qq where qq.questionnaire_id = q.id;
  if p_answers is null or array_ndims(p_answers) <> 1 or cardinality(p_answers) <> n
     or exists (select 1 from unnest(p_answers) v where v is null or v < q.answer_min or v > q.answer_max) then
    raise exception 'invalid_answers'
      using detail = format('Potrzeba %s odpowiedzi w zakresie %s–%s.', n, q.answer_min, q.answer_max);
  end if;

  insert into public.test_sessions (user_id, questionnaire_id, consent_id, completed_on)
    values (uid, q.id, consent, today) returning id into sid;

  insert into public.test_answers (session_id, questionnaire_id, position, value)
    select sid, q.id, a.position, a.value from unnest(p_answers) with ordinality a(value, position);

  -- wynik skali: suma punktów (pytania odwrócone: min + max − odpowiedź) przeliczona na 0–100
  insert into public.test_scores (session_id, questionnaire_id, scale_code, raw, scaled, band_code)
    select sid, q.id, t.scale_code, t.raw, t.scaled,
           (select b.code from public.score_bands b
            where b.questionnaire_id = q.id and b.scale_code = t.scale_code and b.scaled_range @> t.scaled)
    from (
      select qq.scale_code,
             sum(case when qq.is_reversed then q.answer_min + q.answer_max - a.value else a.value end)::smallint as raw,
             round((sum(case when qq.is_reversed then q.answer_min + q.answer_max - a.value else a.value end)
                    - count(*) * q.answer_min)::numeric
                   / (count(*) * (q.answer_max - q.answer_min)) * 100, 2) as scaled
      from public.test_answers a
      join public.questionnaire_questions qq on qq.questionnaire_id = a.questionnaire_id and qq.position = a.position
      where a.session_id = sid
      group by qq.scale_code
    ) t;

  select coalesce(bool_or(b.shows_support), false) into support
    from public.test_scores sc
    join public.score_bands b on b.questionnaire_id = sc.questionnaire_id and b.scale_code = sc.scale_code and b.code = sc.band_code
    where sc.session_id = sid;
  update public.test_sessions s set support_shown = support where s.id = sid;

  return private.test_result(sid);
end $$;

-- wynik jednej sesji w kształcie dla ekranu (używa go submit_test i historia)
create or replace function private.test_result(p_session uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'session_id', s.id,
    'questionnaire_id', s.questionnaire_id,
    'code', q.code,
    'completed_at', s.completed_at,
    'completed_on', s.completed_on,
    'support_shown', s.support_shown,
    'next_available_on', s.completed_on + q.min_interval_days,
    'scores', (
      select jsonb_agg(jsonb_build_object(
               'scale', sc.scale_code, 'name', qs.name, 'raw', sc.raw, 'scaled', sc.scaled,
               'band', sc.band_code, 'title', b.title, 'body', b.body, 'shows_support', b.shows_support)
             order by qs.position)
      from public.test_scores sc
      join public.questionnaire_scales qs on qs.questionnaire_id = sc.questionnaire_id and qs.code = sc.scale_code
      join public.score_bands b on b.questionnaire_id = sc.questionnaire_id and b.scale_code = sc.scale_code and b.code = sc.band_code
      where sc.session_id = s.id))
  from public.test_sessions s join public.questionnaires q on q.id = s.questionnaire_id
  where s.id = p_session;
$$;

-- ---------------------------------------------------------------------
--  4. Usuwanie (RODO art. 17)
-- ---------------------------------------------------------------------
-- RPC: supabase.rpc('delete_test_results', {})                        cała historia testów
--      supabase.rpc('delete_test_results', { p_code: 'who5' })        historia jednego testu
--      supabase.rpc('delete_test_results', { p_session: '<uuid>' })   jeden wynik
-- Zwraca liczbę usuniętych wyników. Kasuje naprawdę (razem z odpowiedziami), zostaje tylko ślad w privacy_events.
-- Kopie zapasowe Supabase wygasają same po okresie retencji — wpisać go do polityki prywatności.
create or replace function public.delete_test_results(p_session uuid default null, p_code text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n   int;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.test_sessions s
    where s.user_id = uid
      and (p_session is null or s.id = p_session)
      and (p_code is null or s.questionnaire_id in (select x.id from public.questionnaires x where x.code = p_code));
  get diagnostics n = row_count;
  if n > 0 then
    perform private.log_privacy_event(uid, 'test_history_deleted',
      jsonb_build_object('sessions', n, 'scope', case when p_session is not null then 'one' when p_code is not null then p_code else 'all' end));
  end if;
  return n;
end $$;

-- Wycofanie zgody na dane o zdrowiu usuwa też wyniki testów (podlewania i wnioski usuwa supabase-schema.sql).
create or replace function private.erase_test_data() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.test_sessions s where s.user_id = new.user_id;
  get diagnostics n = row_count;
  if n > 0 then
    perform private.log_privacy_event(new.user_id, 'test_history_deleted', jsonb_build_object('sessions', n, 'scope', 'consent_withdrawn'));
  end if;
  return null;
end $$;
create trigger user_consents_erase_tests after update of withdrawn_at on public.user_consents
  for each row when (new.kind = 'health_data' and old.withdrawn_at is null and new.withdrawn_at is not null
                     and new.user_id is not null)
  execute function private.erase_test_data();

-- ---------------------------------------------------------------------
--  5. Widoki dla aplikacji (security_invoker: obowiązuje RLS osoby, która pyta)
-- ---------------------------------------------------------------------
-- Lista testów na zakładce „Testy”: co jest dostępne i od kiedy można powtórzyć.
create view public.test_overview with (security_invoker = true) as
select q.id as questionnaire_id, q.code, q.title, q.official_name, q.instruction,
       q.answer_min, q.answer_max, q.answer_labels, q.min_interval_days, q.validated_from_age, q.source, q.licence,
       (select count(*) from public.questionnaire_questions qq where qq.questionnaire_id = q.id) as question_count,
       l.session_id as last_session_id,
       l.completed_on as last_completed_on,
       l.completed_on + q.min_interval_days as next_available_on
from public.questionnaires q
left join lateral (
  select s.id as session_id, s.completed_on
  from public.test_sessions s join public.questionnaires x on x.id = s.questionnaire_id
  where x.code = q.code and s.user_id = (select auth.uid())
  order by s.completed_at desc limit 1
) l on true
where q.is_active;

-- Historia: wiersz na wynik skali, razem z opisem, który osoba wtedy zobaczyła.
create view public.test_history with (security_invoker = true) as
select s.id as session_id, q.code, s.questionnaire_id, s.completed_at, s.completed_on, s.support_shown,
       sc.scale_code, qs.name as scale_name, qs.position as scale_position, qs.low_label, qs.high_label,
       sc.raw, sc.scaled, sc.band_code, b.title as band_title, b.body as band_body, b.shows_support
from public.test_sessions s
join public.questionnaires q on q.id = s.questionnaire_id
join public.test_scores sc on sc.session_id = s.id
join public.questionnaire_scales qs on qs.questionnaire_id = sc.questionnaire_id and qs.code = sc.scale_code
join public.score_bands b on b.questionnaire_id = sc.questionnaire_id and b.scale_code = sc.scale_code and b.code = sc.band_code;

-- =====================================================================
--  UPRAWNIENIA I RLS
-- =====================================================================
revoke all on public.questionnaires, public.questionnaire_scales, public.questionnaire_questions, public.score_bands,
              public.test_sessions, public.test_answers, public.test_scores,
              public.test_overview, public.test_history from public, anon, authenticated;
revoke all on function public.submit_test(text, smallint[]), public.delete_test_results(uuid, text) from public, anon;

alter table public.questionnaires          enable row level security;
alter table public.questionnaire_scales    enable row level security;
alter table public.questionnaire_questions enable row level security;
alter table public.score_bands             enable row level security;
alter table public.test_sessions           enable row level security;
alter table public.test_answers            enable row level security;
alter table public.test_scores             enable row level security;

-- Słowniki: zalogowany czyta aktywne wersje oraz te, w których ma wyniki (historia po zmianie wersji).
-- Zapisuje tylko administrator / service_role.
grant select on public.questionnaires, public.questionnaire_scales, public.questionnaire_questions, public.score_bands to authenticated;

create or replace function private.can_read_questionnaire(p_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.questionnaires q where q.id = p_id and q.is_active)
      or exists (select 1 from public.test_sessions s where s.questionnaire_id = p_id and s.user_id = auth.uid());
$$;
grant execute on function private.can_read_questionnaire(text) to authenticated;

create policy read_available on public.questionnaires          for select to authenticated using ((select private.can_read_questionnaire(id)));
create policy read_available on public.questionnaire_scales    for select to authenticated using ((select private.can_read_questionnaire(questionnaire_id)));
create policy read_available on public.questionnaire_questions for select to authenticated using ((select private.can_read_questionnaire(questionnaire_id)));
create policy read_available on public.score_bands             for select to authenticated using ((select private.can_read_questionnaire(questionnaire_id)));

-- Wyniki: tylko odczyt własnych. Brak polityk insert / update / delete = zapis wyłącznie przez funkcje wyżej.
grant select on public.test_sessions, public.test_answers, public.test_scores to authenticated;
create policy own_select on public.test_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on public.test_answers  for select to authenticated
  using (exists (select 1 from public.test_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy own_select on public.test_scores   for select to authenticated
  using (exists (select 1 from public.test_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

grant select on public.test_overview, public.test_history to authenticated;
grant execute on function public.submit_test(text, smallint[])        to authenticated;
grant execute on function public.delete_test_results(uuid, text)      to authenticated;

grant all on public.questionnaires, public.questionnaire_scales, public.questionnaire_questions, public.score_bands,
             public.test_sessions, public.test_answers, public.test_scores to service_role;
grant execute on all functions in schema private to service_role;
