-- Testy schematu bazy: uprawnienia (RLS), zgody, liczenie wyników, usuwanie.
-- Uruchamia je narzedzia/sprawdz-baze.sh na czystej bazie po wgraniu atrapy i plików notes/supabase-*.sql.
-- Każdy t.ok / t.raises to jedno sprawdzenie; pierwszy błąd zatrzymuje całość.
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = warning;

create schema t;
grant usage on schema t to anon, authenticated, service_role;
create table t.results (id serial, name text);

create function t.ok(cond boolean, name text) returns void language plpgsql security definer as $$
begin
  if cond is not true then raise exception 'NIE PRZESZŁO: %', name; end if;
  insert into t.results (name) values (name);
end $$;

-- polecenie MUSI skończyć się błędem pasującym do wzorca (komunikat albo SQLSTATE)
create function t.raises(cmd text, pattern text, name text) returns void language plpgsql as $$
begin
  begin
    execute cmd;
  exception when others then
    if sqlerrm ~ pattern or sqlstate ~ pattern then
      perform t.ok(true, name);
      return;
    end if;
    raise exception 'NIE PRZESZŁO: % — inny błąd niż oczekiwany: [%] %', name, sqlstate, sqlerrm;
  end;
  raise exception 'NIE PRZESZŁO: % — polecenie się udało, a miało być odrzucone', name;
end $$;

create function t.new_user(p_email text, p_age int, p_form text default 'n') returns uuid
language plpgsql security definer as $$
declare uid uuid;
begin
  insert into auth.users (email, raw_user_meta_data)
  values (p_email, jsonb_build_object('nick', split_part(p_email, '@', 1), 'age', p_age::text, 'form', p_form, 'plant', 'Mięta', 'theme', 'zielony'))
  returning id into uid;
  return uid;
end $$;

-- „logowanie”: jak token w Supabase. Rolę zmienia się osobno (set role authenticated).
create function t.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
$$;
-- nowa osoba z kompletem zgód, od razu zalogowana (do testów liczenia wyników)
create function t.fresh_user_with_consent() returns uuid language plpgsql security definer as $$
declare uid uuid := t.new_user('auto' || nextval('t.results_id_seq') || '@example.com', 18);
begin
  perform t.login(uid);
  insert into public.user_consents (user_id, subject_hash, document_id, kind)
    select uid, private.subject_hash(uid), private.current_document(k), k
    from unnest(array['terms','privacy','health_data']::public.legal_doc_kind[]) k;
  return uid;
end $$;
-- wynik z bazy musi być taki sam jak policzony w aplikacji (js/testy-dane.js → score)
create function t.check_scores(p_code text, p_answers smallint[], p_expected jsonb) returns void
language plpgsql as $$
declare res jsonb; got jsonb;
begin
  reset role;
  perform t.fresh_user_with_consent();
  set role authenticated;
  res := public.submit_test(p_code, p_answers);
  select jsonb_object_agg(s->>'scale', jsonb_build_array((s->>'raw')::int, (s->>'scaled')::numeric, s->>'band'))
    into got from jsonb_array_elements(res->'scores') s;
  perform t.ok(got = p_expected, format('%s %s: baza liczy tak samo jak aplikacja (%s)', p_code, p_answers, got));
end $$;
-- „dziś” tak, jak liczy je baza dla profilu z domyślną strefą: testy nie zależą od strefy serwera ani pory dnia
create function t.dzis() returns date language sql stable as $$ select (now() at time zone 'Europe/Warsaw')::date $$;
grant execute on all functions in schema t to anon, authenticated, service_role;

select t.new_user('ala@example.com', 17, 'f') as ala,
       t.new_user('ola@example.com', 18, 'm') as ola,
       t.new_user('kuba@example.com', 14, 'm') as kuba \gset

-- ---------------------------------------------------------------- profil
select t.ok((select nick = 'ala' and grammar_form = 'f' and plant_name = 'Mięta' and theme = 'zielony'
                    and birth_year = extract(year from now())::int - 17 from public.profiles where id = :'ala'),
            'profil powstaje sam z danych rejestracji');
select t.ok(not private.needs_guardian(:'ala'), '17 lat → bez zgody opiekuna');
select t.ok(private.needs_guardian(:'kuba'), '14 lat → potrzebna zgoda opiekuna');
select t.ok(not private.needs_guardian(:'ola'), '18 lat → bez zgody opiekuna');
-- każdy wiek z formularza rejestracji (13–18, „19+”), brak wieku i śmieci
select t.new_user('w13@example.com', 13) as w13, t.new_user('w15@example.com', 15) as w15, t.new_user('w16@example.com', 16) as w16 \gset
insert into auth.users (email, raw_user_meta_data) values ('w19@example.com', '{"nick": "w19", "age": "19+"}') returning id as w19 \gset
insert into auth.users (email, raw_user_meta_data) values ('w0@example.com', '{"nick": "w0"}') returning id as w0 \gset
insert into auth.users (email, raw_user_meta_data) values ('w136@example.com', '{"nick": "x", "age": "136"}') returning id as w136 \gset
select t.ok(private.needs_guardian(:'w13') and private.needs_guardian(:'w15'), '13 i 15 lat → potrzebna zgoda opiekuna');
select t.ok(not private.needs_guardian(:'w16'), '16 lat → bez zgody opiekuna (rejestracja nie pyta wtedy o e-mail opiekuna)');
select t.ok(not private.needs_guardian(:'w19') and (select birth_year = extract(year from now())::int - 19 from public.profiles where id = :'w19'), '„19+” → 19 lat, bez opiekuna');
select t.ok(private.needs_guardian(:'w0') and private.needs_guardian(gen_random_uuid()), 'brak wieku albo profilu → jak poniżej 16 lat');
select t.ok((select birth_year is null and nick = 'Ja' from public.profiles where id = :'w136'), 'wiek „136” i jednoznakowy pseudonim nie psują rejestracji');
-- 15-latek sprzed dwóch lat ma dziś co najmniej 16
update public.profiles set created_at = now() - interval '2 years', birth_year = extract(year from now())::int - 2 - 15 where id = :'w15';
select t.ok(not private.needs_guardian(:'w15'), '15 lat przy rejestracji dwa lata temu → opiekun już niepotrzebny');

-- ---------------------------------------------------------------- niezalogowany nie widzi nic
set role anon;
select t.raises('select * from public.profiles',                 'permission denied', 'anon: profile zamknięte');
select t.raises('select * from public.user_consents',            'permission denied', 'anon: zgody zamknięte');
select t.raises('select * from public.test_sessions',            'permission denied', 'anon: wyniki zamknięte');
select t.raises('select * from public.questionnaire_questions',  'permission denied', 'anon: pytania zamknięte');
select t.raises('select * from public.blog_posts',               'permission denied', 'anon: blog zamknięty');
select t.raises('select * from public.test_history',             'permission denied', 'anon: historia zamknięta');
select t.raises('select * from public.checkin_days',             'permission denied', 'anon: podlewania zamknięte');
select t.raises('select * from public.my_insights',              'permission denied', 'anon: wnioski zamknięte');
select t.raises('select * from public.checkin_fields',           'permission denied', 'anon: katalog pól zamknięty');
select t.raises($$select public.save_checkin(t.dzis(), 5::smallint)$$, 'permission denied', 'anon: save_checkin zamknięty');
select t.raises($$select public.submit_test('who5', array[1,1,1,1,1]::smallint[])$$, 'permission denied', 'anon: submit_test zamknięty');
select t.raises($$select public.give_consent(array['terms']::public.legal_doc_kind[])$$, 'permission denied', 'anon: give_consent zamknięty');
select t.raises('select public.delete_my_account()',             'permission denied', 'anon: delete_my_account zamknięty');
reset role;

-- ---------------------------------------------------------------- 16 lat: zgoda bez opiekuna wystarcza
set role authenticated;
select t.login(:'w16');
select public.give_consent(array['terms','privacy','health_data']::public.legal_doc_kind[]);
select t.ok((public.health_consent_status()->>'active')::boolean and public.save_checkin(t.dzis(), 6::smallint) is not null, '16-latek po własnej zgodzie zapisuje podlewanie');

-- ---------------------------------------------------------------- bez zgody nic o zdrowiu się nie zapisze
select t.login(:'ala');
select t.ok((select count(*) = 2 from public.test_overview), 'zalogowany widzi dwa aktywne testy');
select t.ok((select question_count = 5 from public.test_overview where code = 'who5')
        and (select question_count = 20 from public.test_overview where code = 'ipip20'), 'WHO-5 ma 5 pytań, IPIP 20');
select t.ok((select count(*) = 25 from public.questionnaire_questions), 'zalogowany czyta pytania');
select t.ok((public.health_consent_status()->>'reason') = 'no_consent', 'status zgody: brak');
select t.raises($$select public.submit_test('who5', array[3,3,3,3,3]::smallint[])$$, 'consent_required', 'test bez zgody: consent_required');
select t.raises($$select public.save_checkin(t.dzis(), 7::smallint)$$, 'consent_required', 'podlewanie bez zgody: odrzucone');
select t.raises($$select public.start_experiment('czynnik:ruch', 'ruch', 3::smallint)$$, 'consent_required', 'próba bez zgody: odrzucona');

-- ---------------------------------------------------------------- zgody
select t.raises($$select public.give_consent(array['guardian']::public.legal_doc_kind[])$$, 'forbidden', 'zgody opiekuna nie da się wpisać samemu');
select t.raises($$select public.give_consent(array[]::public.legal_doc_kind[])$$, 'invalid_input', 'pusta lista zgód: odrzucona');
select t.ok((select count(*) = 3 from public.give_consent(array['terms','privacy','health_data']::public.legal_doc_kind[])), 'give_consent zapisuje trzy zgody');
select t.ok((select count(*) = 3 from public.give_consent(array['terms','privacy','health_data']::public.legal_doc_kind[]))
        and (select count(*) = 3 from public.user_consents), 'powtórne give_consent nie dubluje');
select t.ok((select bool_and(active and not needs_renewal and version = '0.1') from public.my_consents), 'my_consents: aktywne, wersja 0.1');
reset role;
select t.ok((select bool_and(subject_hash = encode(sha256('ala@example.com'::bytea), 'hex')) from public.user_consents where user_id = :'ala'), 'zgoda ma odcisk e-maila (widzi go tylko serwer)');
set role authenticated;
select t.ok((public.health_consent_status()->>'active')::boolean, 'status zgody: aktywna');
select t.raises($$insert into public.user_consents (user_id, subject_hash, document_id, kind)
                  select auth.uid(), 'x', id, kind from public.legal_documents where kind = 'guardian'$$,
                'permission denied', 'bezpośredni zapis zgody: brak prawa');
select t.raises('update public.user_consents set given_at = now() - interval ''1 year''', 'permission denied', 'zmiana zgody: brak prawa');
select t.raises('delete from public.user_consents', 'permission denied', 'kasowanie zgody: brak prawa');
select t.raises($$select public.withdraw_consent('terms')$$, 'use_delete_account', 'regulaminu nie wycofuje się osobno');
select t.raises($$select public.confirm_guardian_consent('abc')$$, 'permission denied', 'potwierdzenie opiekuna tylko dla serwera');
select t.raises('update public.profiles set birth_year = 1995', 'permission denied', 'roku urodzenia nie da się zmienić');
select t.raises('select ip from public.user_consents', 'permission denied', 'adres IP z dziennika zgód nie jest dla telefonu');
select t.raises('select subject_hash, user_agent from public.user_consents', 'permission denied', 'ani odcisk e-maila i przeglądarka');
select t.raises(format($$select private.has_consent(%L, 'health_data')$$, :'ola'), 'permission denied', 'cudzej zgody nie da się sprawdzić po identyfikatorze');
update public.profiles set nick = 'Alicja';
select t.ok((select nick = 'Alicja' and updated_at >= created_at from public.profiles), 'własny profil da się poprawić');

-- ---------------------------------------------------------------- podlewanie: jedna droga zapisu, znaczniki dnia
select public.save_checkin(t.dzis(), 7::smallint, 7.5, 3::smallint, 2::smallint, '{"friends": 1, "study": -1, "move": 1}', '  dobry dzień  ') as checkin \gset
select t.ok((select count(*) = 1 from public.daily_checkins), 'podlewanie po zgodzie: zapisane');
select t.ok((select mood = 7 and bedtime = 2 and note = 'dobry dzień' and entry_hour between 0 and 23 from public.daily_checkins), 'wpis ma nastrój, porę snu, przyciętą notatkę i godzinę');
select t.ok((select areas = '{"friends": 1, "study": -1}'::jsonb and acts = '{"move": 1}'::jsonb from public.checkin_days), 'checkin_days oddaje obszary i „co dziś było” osobno');
select t.ok(public.save_checkin(t.dzis(), 6::smallint, null, null, null, '{"hobby": 1}') = :'checkin', 'drugi zapis tego dnia trafia do tego samego wpisu');
select t.ok((select count(*) = 1 and bool_and(mood = 6 and sleep_hours is null) from public.daily_checkins)
        and (select count(*) = 1 and bool_and(field_code = 'hobby') from public.checkin_tags), 'drugi zapis zastępuje wpis i znaczniki');
select t.raises($$select public.save_checkin(t.dzis() + 2, 5::smallint)$$, 'invalid_day', 'podlewania nie da się zapisać w przyszłość');
select t.raises($$select public.save_checkin(t.dzis() - 30, 5::smallint)$$, 'invalid_day', 'ani miesiąc wstecz');
select t.raises($$select public.save_checkin(t.dzis(), 5::smallint, null, null, null, '{"waga": 1}')$$, 'invalid_tags', 'nieznane pole: odrzucone');
select t.raises($$select public.save_checkin(t.dzis(), 5::smallint, null, null, null, '{"friends": 5}')$$, 'invalid_tags', 'wartość poza zakresem: odrzucona');
select t.raises($$select public.save_checkin(t.dzis(), 5::smallint, null, null, null, '{"move": 0}')$$, 'invalid_tags', '„co dziś było” przyjmuje tylko 1');
select t.raises($$select public.save_checkin(t.dzis(), 5::smallint, null, null, null, '{"friends": "1"}')$$, 'invalid_tags', 'wartość musi być liczbą');
select t.raises($$select public.save_checkin(t.dzis(), 5::smallint, null, null, null, '[1]')$$, 'invalid_tags', 'znaczniki muszą być obiektem');
select t.raises($$select public.save_checkin(t.dzis(), 11::smallint)$$, '23514', 'nastrój poza skalą 1–10: odrzucony');
select t.ok((select count(*) = 1 and bool_and(mood = 6) from public.daily_checkins), 'po błędach wpis jest nietknięty');
select t.raises($$insert into public.daily_checkins (user_id, day, mood) values (auth.uid(), t.dzis() - 1, 7)$$, 'permission denied', 'bezpośredni zapis podlewania: brak prawa');
select t.raises($$delete from public.daily_checkins$$, 'permission denied', 'bezpośrednie kasowanie podlewania: brak prawa');
select t.raises($$select public.save_checkin(t.dzis(), 5::smallint, null, null, null, '{"friends": 99999999999}')$$, 'invalid_tags', 'ogromna liczba w znaczniku: czytelny błąd');
select public.save_checkin(t.dzis() - 2, 4::smallint) as wczesniej \gset
select t.ok((select entry_hour is null from public.daily_checkins where day = t.dzis() - 2) and (select entry_hour is not null from public.daily_checkins where day = t.dzis()), 'wpis uzupełniony po fakcie nie ma godziny');
select t.ok(public.delete_checkin(t.dzis() - 2), 'delete_checkin usuwa podlewanie z dnia');
select t.ok(not public.delete_checkin(t.dzis() - 2) and (select count(*) = 1 from public.daily_checkins), 'drugi raz nie ma czego usuwać');
select t.raises($$update public.daily_checkins set mood = 10$$, 'permission denied', 'bezpośrednia zmiana podlewania: brak prawa');
select t.raises($$insert into public.checkin_tags values ('00000000-0000-0000-0000-000000000000', 'move', 1)$$, 'permission denied', 'bezpośredni zapis znaczników: brak prawa');
select t.ok((select count(*) = 12 from public.checkin_fields), 'katalog ma 6 obszarów i 6 rzeczy „co dziś było”');

-- ---------------------------------------------------------------- wnioski: zapisuje serwer, osoba czyta i ocenia
select t.raises($$select public.replace_insights(auth.uid(), 1::smallint, 30::smallint, '[]')$$, 'permission denied', 'wniosków nie zapisuje telefon');
select t.raises($$insert into public.insights (user_id, key, kind, tone, confidence, effect, n_days, title, summary, engine_version)
                  values (auth.uid(), 'czynnik:ruch', 'czynnik', 'pomaga', 3, 9, 1, 'x', 'y', 1)$$, 'permission denied', 'bezpośredni zapis wniosku: brak prawa');
reset role;
select t.ok((select needs_run from public.insight_runs where user_id = :'ala'), 'zapis podlewania zgłasza osobę do przeliczenia wniosków');
set role service_role;
select t.ok(public.replace_insights(:'ala', 1::smallint, 40::smallint, $j$[
  {"key": "czynnik:ruch", "typ": "czynnik", "ton": "pomaga", "czynnik": "ruch", "pewnosc": 2, "efekt": 1.234, "n": 40, "n1": 15, "n0": 25,
   "tytul": "Ruch dodaje Ci energii", "zdanie": "W dni z ruchem…", "tag": "Ruch", "kat": "--cat-nature", "powody": ["a"], "sprobuj": "ruszyć się", "proba": {"czynnik": "ruch", "ile": 3}},
  {"key": "czynnik:rodzina_ciezko", "typ": "czynnik", "ton": "wsparcie", "czynnik": "rodzina_ciezko", "pewnosc": 2, "efekt": -1.5, "n": 40, "n1": 8, "n0": 32,
   "tytul": "Gdy w domu jest ciężko, to czuć", "zdanie": "…", "wsparcie": "To nie Twoja wina.", "sprobuj": "TEGO NIE WOLNO ZAPISAĆ"},
  {"key": "dzien:0", "typ": "dzien_tygodnia", "ton": "zauwazone", "pewnosc": 1, "efekt": -1.1, "n": 40, "n1": 6, "n0": 34, "tytul": "Niedzielne wieczory…", "zdanie": "…"}
]$j$) = 3, 'serwer zapisuje trzy wnioski');
select t.ok((select not needs_run and days_used = 40 from public.insight_runs where user_id = :'ala'), 'przeliczenie zdejmuje osobę z kolejki');
select t.raises(format($$insert into public.insights (user_id, key, kind, tone, factor, confidence, effect, n_days, title, summary, engine_version, details)
                         values (%L, 'czynnik:przyjaciele_ciezko', 'czynnik', 'wsparcie', 'przyjaciele_ciezko', 1, -1, 20, 't', 's', 1, '{"sprobuj": "rada"}')$$, :'ala'), '23514', 'wniosek-wsparcie z radą: odrzucony przez bazę');
select t.raises(format($$select public.replace_insights(%L, 1::smallint, 40::smallint, '[{"key": "czynnik:love", "typ": "czynnik", "ton": "pomaga", "czynnik": "love", "pewnosc": 2, "efekt": 1, "n": 40, "tytul": "t", "zdanie": "z"}]')$$, :'ala'),
                'invalid_input', 'wniosek o czynniku spoza katalogu (miłość): odrzucony');
select t.raises(format($$select public.replace_insights(%L, 1::smallint, 40::smallint, '[{"key": "czynnik:rodzina_ciezko", "typ": "czynnik", "ton": "pomaga", "czynnik": "rodzina_ciezko", "pewnosc": 2, "efekt": 1, "n": 40, "tytul": "t", "zdanie": "z", "sprobuj": "rada"}]')$$, :'ala'),
                'invalid_input', 'trudna sprawa podana jako „pomaga”: odrzucona');
select t.ok((select count(*) = 3 from public.insights where user_id = :'ala' and status = 'active'), 'odrzucone wywołania niczego nie zmieniły');
reset role;
set role authenticated;
select t.ok((select count(*) = 3 from public.my_insights), 'osoba widzi swoje wnioski');
select t.ok((select effect = 1.23 and details->>'sprobuj' = 'ruszyć się' and (details->'proba'->>'ile')::int = 3 from public.my_insights where key = 'czynnik:ruch'), 'wniosek ma wielkość różnicy, podpowiedź i próbę');
select t.ok((select not (details ? 'sprobuj') and details->>'wsparcie' is not null from public.my_insights where key = 'czynnik:rodzina_ciezko'), 'wniosek-wsparcie nigdy nie ma rady, nawet gdy silnik by ją przysłał');
select id as ins_ruch from public.my_insights where key = 'czynnik:ruch' \gset
select id as ins_dzien from public.my_insights where key = 'dzien:0' \gset
select public.set_insight_feedback(:'ins_ruch', 'pasuje');
select public.set_insight_feedback(:'ins_dzien', 'nie');
select t.ok((select count(*) = 2 from public.my_insights) and (select feedback = 'pasuje' from public.my_insights where key = 'czynnik:ruch'), '„nie pasuje” chowa wniosek, „pasuje” zostaje zapisane');
select t.raises(format($$select public.set_insight_feedback(%L, 'super')$$, :'ins_ruch'), 'invalid_input', 'nieznana opinia: odrzucona');
select t.raises($$update public.insights set confidence = 3$$, 'permission denied', 'osoba nie poprawi pewności wniosku');
select t.raises($$delete from public.insights$$, 'permission denied', 'ani nie skasuje go poza wycofaniem zgody');
reset role;
set role service_role;
select t.ok(public.replace_insights(:'ala', 1::smallint, 47::smallint, $j$[
  {"key": "czynnik:ruch", "typ": "czynnik", "ton": "pomaga", "czynnik": "ruch", "pewnosc": 3, "efekt": 1.4, "n": 47, "n1": 18, "n0": 29, "tytul": "Ruch dodaje Ci energii", "zdanie": "…"}
]$j$) = 1, 'kolejne liczenie: został jeden aktywny wniosek');
reset role;
set role authenticated;
select t.ok((select confidence = 3 and feedback = 'pasuje' and first_seen_at < computed_at from public.my_insights where key = 'czynnik:ruch'), 'opinia i data pierwszego pojawienia przeżywają przeliczenie');
select t.ok((select count(*) = 2 from public.insights where status = 'expired'), 'wnioski, które się nie potwierdziły, wygasają (nie znikają)');

-- ---------------------------------------------------------------- tygodniowa próba
select public.start_experiment('czynnik:ruch', 'ruch', 3::smallint) as proba \gset
select t.ok((select status = 'active' and ends_on = started_on + 6 and times = 3 from public.insight_experiments), 'próba trwa 7 dni');
select t.raises($$select public.start_experiment('czynnik:sen_dlugi', 'sen_dlugi', 4::smallint)$$, 'experiment_active', 'jedna próba naraz');
select t.raises(format($$select public.finish_experiment(%L, 'done', '{"typ": "CUD", "roznica": 99}')$$, :'proba'), '23514', 'wynik próby spoza listy: odrzucony');
select t.raises(format($$select public.finish_experiment(%L, 'done', jsonb_build_object('typ', 'lepsze_dni', 'smiec', repeat('x', 5000)))$$, :'proba'), '23514', 'za duży wynik próby: odrzucony');
select public.finish_experiment(:'proba', 'done', '{"typ": "lepsze_dni", "zrobione": 3}');
select t.ok((select status = 'done' and finished_at is not null and result->>'typ' = 'lepsze_dni' from public.insight_experiments), 'zakończona próba ma wynik');
select t.raises($$select public.start_experiment('czynnik:ruch', 'ruch', 9::smallint)$$, '23514', 'próba najwyżej 7 razy w tygodniu');
select t.raises($$select public.start_experiment('czynnik:rodzina_ciezko', 'rodzina_ciezko', 2::smallint)$$, 'invalid_input', 'z trudnej sprawy nie da się zrobić próby');
select t.raises($$select public.start_experiment('czynnik:cokolwiek', 'cokolwiek', 2::smallint)$$, 'invalid_input', 'ani z czynnika spoza katalogu');
select t.raises($$select public.start_experiment(repeat('k', 5000) || ':x', 'ruch', 2::smallint)$$, '23514', 'ani z kluczem wielkości megabajta');
select t.raises(format($$select public.finish_experiment(%L)$$, :'proba'), 'not_found', 'zakończonej próby nie kończy się drugi raz');
select t.ok(public.start_experiment('ogolne:natura', 'natura', 3::smallint) is not null, 'po zakończeniu można zacząć następną');
select t.raises($$update public.insight_experiments set result = '{"typ": "lepsze_dni"}'$$, 'permission denied', 'wyniku próby nie da się zmienić poza funkcją');

-- ---------------------------------------------------------------- test: błędne odpowiedzi
select t.raises($$select public.submit_test('phq9', array[1]::smallint[])$$, 'unknown_test', 'nieznany test');
select t.raises($$select public.submit_test('who5', array[3,3,3,3]::smallint[])$$, 'invalid_answers', 'za mało odpowiedzi');
select t.raises($$select public.submit_test('who5', array[3,3,3,3,6]::smallint[])$$, 'invalid_answers', 'odpowiedź poza skalą (6)');
select t.raises($$select public.submit_test('who5', array[3,3,3,3,-1]::smallint[])$$, 'invalid_answers', 'odpowiedź poza skalą (−1)');
select t.raises($$select public.submit_test('who5', array[3,3,null,3,3]::smallint[])$$, 'invalid_answers', 'pusta odpowiedź');
select t.raises($$select public.submit_test('who5', array[[3,3],[3,3]]::smallint[])$$, 'invalid_answers', 'tablica dwuwymiarowa');
select t.raises($$select public.submit_test('ipip20', array[0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]::smallint[])$$, 'invalid_answers', 'IPIP: 0 poza skalą 1–5');
select t.ok((select count(*) = 0 from public.test_sessions), 'po błędach nic nie zostało w bazie');

-- ---------------------------------------------------------------- test: poprawny zapis
select public.submit_test('who5', array[4,3,3,2,4]::smallint[]) as who5 \gset
select t.ok((:'who5'::jsonb #>> '{scores,0,raw}')::int = 16 and (:'who5'::jsonb #>> '{scores,0,scaled}')::numeric = 64
        and :'who5'::jsonb #>> '{scores,0,band}' = 'ok' and not (:'who5'::jsonb ->> 'support_shown')::boolean,
            'WHO-5 [4,3,3,2,4] → 16 pkt, 64%, ok');
select t.ok((:'who5'::jsonb ->> 'next_available_on')::date = (:'who5'::jsonb ->> 'completed_on')::date + 7, 'następny WHO-5 za 7 dni');
select t.ok((select count(*) = 5 from public.test_answers) and (select count(*) = 1 from public.test_scores), 'zapisane odpowiedzi i wynik');
select t.ok((select consent_id = (select id from public.user_consents where kind = 'health_data') from public.test_sessions), 'sesja pamięta zgodę');
select t.raises($$select public.submit_test('who5', array[5,5,5,5,5]::smallint[])$$, 'too_soon', 'powtórka przed czasem: too_soon');
select t.raises($$select public.submit_test('ipip20', array[3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]::smallint[], 'ipip20-v0')$$, 'version_changed', 'odpowiedzi na pytania innej wersji: odrzucone');
select t.ok((select last_completed_on = t.dzis() and next_available_on = t.dzis() + 7 from public.test_overview where code = 'who5'), 'test_overview pokazuje datę następnego podejścia');
select t.ok((select count(*) = 1 and bool_and(band_title is not null and scaled = 64) from public.test_history), 'test_history: wynik z opisem');

-- wyniku nie da się wpisać ani poprawić ręcznie
select t.raises(format($$insert into public.test_sessions (user_id, questionnaire_id, consent_id, completed_on)
                         select auth.uid(), 'ipip20-v1', id, t.dzis() from public.user_consents where kind = 'health_data'$$),
                'permission denied', 'ręczny zapis sesji: brak prawa');
select t.raises('update public.test_scores set scaled = 100', 'permission denied', 'poprawienie wyniku: brak prawa');
select t.raises('delete from public.test_sessions', 'permission denied', 'kasowanie poza funkcją: brak prawa');
select t.raises($$update public.questionnaire_questions set text_m = 'x'$$, 'permission denied', 'zmiana pytań: brak prawa');

-- ---------------------------------------------------------------- druga osoba nie widzi cudzych danych
select t.login(:'ola');
select t.ok((select count(*) = 0 from public.test_sessions) and (select count(*) = 0 from public.test_answers)
        and (select count(*) = 0 from public.test_scores) and (select count(*) = 0 from public.test_history)
        and (select count(*) = 0 from public.user_consents) and (select count(*) = 0 from public.daily_checkins)
        and (select count(*) = 1 from public.profiles) and (select count(*) = 0 from public.privacy_events)
        and (select count(*) = 0 from public.checkin_tags) and (select count(*) = 0 from public.checkin_days)
        and (select count(*) = 0 from public.insights) and (select count(*) = 0 from public.my_insights)
        and (select count(*) = 0 from public.insight_experiments),
            'inna osoba nie widzi cudzych wyników, zgód, podlewań, znaczników, wniosków, prób ani profilu');
select t.raises(format($$select public.set_insight_feedback(%L, 'nie')$$, :'ins_ruch'), 'not_found', 'cudzego wniosku nie da się ocenić');
select t.raises(format($$select public.finish_experiment(%L)$$, :'proba'), 'not_found', 'cudzej próby nie da się zakończyć');
select t.raises('select * from public.insight_runs', 'permission denied', 'kolejka przeliczeń jest tylko dla serwera');
select t.ok((select last_completed_on is null from public.test_overview where code = 'who5'), 'test_overview nie zdradza cudzej daty');
select t.ok(public.delete_test_results() = 0, 'delete_test_results nie rusza cudzych wyników');
select t.login(:'ala');
select t.ok((select count(*) = 1 from public.test_sessions), 'wynik Ali nadal jest');

-- ---------------------------------------------------------------- nowa wersja dokumentu ≠ wycofanie
reset role;
insert into public.legal_documents (kind, version, title, url) values ('health_data', '0.2', 'Zgoda v0.2', 'https://releaf.example/zgoda-0.2');
set role authenticated;
select t.ok((select needs_renewal from public.my_consents where kind = 'health_data' and active), 'po nowej wersji: needs_renewal');
select public.give_consent(array['health_data']::public.legal_doc_kind[]);
select t.ok((select count(*) = 2 from public.user_consents where kind = 'health_data')
        and (select count(*) = 1 from public.user_consents where kind = 'health_data' and superseded_at is not null and withdrawn_at is null)
        and (select version = '0.2' from public.my_consents where kind = 'health_data' and active),
            'ponowna akceptacja: stara zgoda zastąpiona, nowa aktywna');
select t.ok((select count(*) = 1 from public.test_sessions) and (select count(*) = 1 from public.daily_checkins), 'zastąpienie zgody NIE usuwa danych');

-- ---------------------------------------------------------------- usunięcie jednego wyniku i historii
select t.ok(public.delete_test_results(p_code => 'ipip20') = 0, 'usunięcie historii innego testu: 0');
select t.ok(public.delete_test_results(p_session => (:'who5'::jsonb ->> 'session_id')::uuid) = 1, 'usunięcie jednego wyniku');
select t.ok((select count(*) = 0 from public.test_sessions) and (select count(*) = 0 from public.test_answers)
        and (select count(*) = 0 from public.test_scores), 'wynik zniknął razem z odpowiedziami');
select t.ok((select count(*) = 1 from public.privacy_events where event = 'test_history_deleted' and details->>'scope' = 'one'), 'usunięcie zostawia ślad bez treści');
select public.submit_test('who5', array[1,2,1,2,1]::smallint[]) as who5b \gset
select t.ok((:'who5b'::jsonb #>> '{scores,0,scaled}')::numeric = 28 and :'who5b'::jsonb #>> '{scores,0,band}' = 'support'
        and (:'who5b'::jsonb ->> 'support_shown')::boolean, 'WHO-5 28% → wsparcie zawsze');
select public.submit_test('ipip20', array[3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]::smallint[]) as ipip \gset
select t.ok((select count(*) = 5 and bool_and((s->>'scaled')::numeric = 50 and s->>'band' = 'mid' and (s->>'raw')::int = 12)
             from jsonb_array_elements(:'ipip'::jsonb -> 'scores') s), 'IPIP same trójki → 5 cech po 50, „pośrodku”');
select t.ok((select count(*) = 6 from public.test_history), 'historia: 1 + 5 wierszy');

-- ---------------------------------------------------------------- wycofanie zgody usuwa dane o zdrowiu
select t.ok(public.withdraw_consent('health_data') is not null, 'withdraw_consent zwraca czas');
select t.ok((select count(*) = 0 from public.test_sessions) and (select count(*) = 0 from public.daily_checkins)
        and (select count(*) = 0 from public.checkin_tags), 'wycofanie zgody: testy, podlewania i znaczniki usunięte');
select t.ok((select count(*) = 0 from public.insights) and (select count(*) = 0 from public.insight_experiments), 'wycofanie zgody: wnioski i próby usunięte');
select t.ok((select count(*) = 1 from public.user_consents where kind = 'health_data' and withdrawn_at is not null), 'zgoda zostaje w dzienniku jako wycofana');
select t.ok((select count(*) = 1 from public.privacy_events where event = 'health_data_erased' and details->>'by' = 'user')
        and (select count(*) = 1 from public.privacy_events where details->>'scope' = 'consent_withdrawn')
        and not exists (select 1 from public.privacy_events where details::text ~ '[0-9]' or details ? 'checkins' or details ? 'sessions'),
            'wycofanie zostawia ślad bez liczb i bez treści');
select t.ok((public.health_consent_status()->>'reason') = 'no_consent', 'po wycofaniu: brak zgody');
select t.raises($$select public.submit_test('ipip20', array[3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]::smallint[])$$, 'consent_required', 'po wycofaniu test się nie zapisze');
select t.ok(public.withdraw_consent('health_data') is null, 'drugie wycofanie nic nie robi');
select t.ok((select count(*) = 2 from public.user_consents where kind in ('terms','privacy') and withdrawn_at is null), 'regulamin i polityka zostają');
select public.give_consent(array['health_data']::public.legal_doc_kind[]);
select t.ok((public.health_consent_status()->>'active')::boolean and (select count(*) = 3 from public.user_consents where kind = 'health_data'),
            'zgodę można dać ponownie (nowy wiersz)');
select t.ok(public.submit_test('who5', array[5,5,5,5,5]::smallint[]) #>> '{scores,0,band}' = 'ok', 'po ponownej zgodzie test działa od razu (historia była usunięta)');

-- ---------------------------------------------------------------- poniżej 16 lat: zgoda opiekuna
select t.login(:'kuba');
select public.give_consent(array['terms','privacy','health_data']::public.legal_doc_kind[]);
select t.ok((public.health_consent_status()->>'reason') = 'guardian_pending', '14 lat: zgoda czeka na opiekuna');
select t.raises($$select public.submit_test('who5', array[3,3,3,3,3]::smallint[])$$, 'consent_required', '14 lat bez opiekuna: test się nie zapisze');
select t.raises($$select public.save_checkin(t.dzis(), 5::smallint)$$, 'consent_required', '14 lat bez opiekuna: podlewanie odrzucone');
select t.raises($$insert into public.guardian_requests (user_id, guardian_email, token_hash) values (auth.uid(), 'x@y.pl', repeat('a', 64))$$,
                'permission denied', 'prośby do opiekuna nie tworzy telefon');
reset role;
insert into public.guardian_requests (user_id, guardian_email, token_hash)
  values (:'kuba', 'mama@example.com', encode(sha256('tajny-token'::bytea), 'hex'));
set role service_role;
select t.raises($$select public.confirm_guardian_consent('zly-token')$$, 'token_invalid', 'zły token opiekuna');
select t.ok(public.confirm_guardian_consent('tajny-token', '203.0.113.7') = :'kuba', 'opiekun potwierdza linkiem');
select t.ok(public.confirm_guardian_consent('tajny-token') = :'kuba'
        and (select count(*) = 1 from public.user_consents where kind = 'guardian'), 'drugie kliknięcie linku nie dubluje zgody');
reset role;
set role authenticated;
select t.ok((public.health_consent_status()->>'active')::boolean, '14 lat po zgodzie opiekuna: aktywna');
select t.ok(public.save_checkin(t.dzis(), 5::smallint) is not null, '14 lat po zgodzie opiekuna: podlewanie działa');
select t.ok(public.submit_test('who5', array[2,3,2,3,2]::smallint[]) #>> '{scores,0,band}' = 'lower', 'WHO-5 48% → „ostatnio trudniej”');
select t.raises('select ip from public.user_consents', 'permission denied', 'dziecko nie czyta adresu IP opiekuna');
select t.raises('select token_hash from public.guardian_requests', 'permission denied', 'ani odcisku tokenu z prośby');
select t.ok((select count(*) = 1 and bool_and(guardian_email = 'mama@example.com' and confirmed_at is not null) from public.guardian_requests), 'widzi za to, że prośba poszła i została potwierdzona');
reset role;
select t.ok((select c.given_by = 'guardian' and c.ip = '203.0.113.7' from public.user_consents c where c.kind = 'guardian' and c.user_id = :'kuba'),
            'zgoda opiekuna zapisana z adresem (widzi to tylko serwer)');
set role authenticated;

-- ---------------------------------------------------------------- baza liczy tak samo jak aplikacja
\ir _wyniki.sql
reset role;

-- ---------------------------------------------------------------- słowniki: wersje i kompletność
select t.raises($$update public.questionnaire_questions set text_m = 'inne' where questionnaire_id = 'who5-v1' and position = 1$$,
                'questionnaire_in_use', 'używanej wersji pytań nie da się poprawić');
select t.raises($$update public.score_bands set body = 'inne' where questionnaire_id = 'who5-v1'$$, 'questionnaire_in_use', 'ani opisów wyniku');
select t.raises($$insert into public.questionnaire_questions values ('who5-v1', 6, 'total', false, null, 'a', 'a', 'a')$$, 'questionnaire_in_use', 'ani dopisać do niej pytania');
select t.raises($$update public.questionnaires set min_interval_days = 0, title = 'Inny' where id = 'who5-v1'$$, 'questionnaire_in_use', 'ani zmienić odstępu i tytułu');
insert into public.questionnaires (id, code, version, title, official_name, instruction, answer_min, answer_max, answer_labels, source, licence)
  values ('who5-v2', 'who5', 2, 'S', 'WHO-5', 'i', 0, 5, array['a','b','c','d','e','f'], 's', 'l');
select t.raises($$update public.questionnaires set is_active = true where id = 'who5-v2'$$, 'questionnaire_incomplete', 'pustej wersji nie da się włączyć');
insert into public.questionnaire_scales values ('who5-v2', 'total', 1, 'Samopoczucie');
insert into public.questionnaire_questions values ('who5-v2', 1, 'total', false, null, 'a', 'a', 'a');
insert into public.score_bands values ('who5-v2', 'total', 'lower', numrange(0, 50, '[)'), 't', 'b');
select t.raises($$update public.questionnaires set is_active = true where id = 'who5-v2'$$, 'questionnaire_incomplete', 'opisy muszą pokryć całe 0–100');
insert into public.score_bands values ('who5-v2', 'total', 'ok', numrange(50, 100, '[]'), 't', 'b');
select t.raises($$insert into public.score_bands values ('who5-v2', 'total', 'extra', numrange(40, 60), 'x', 'y')$$,
                '23P01', 'przedziały wyniku nie mogą na siebie zachodzić');
select t.raises($$update public.questionnaires set is_active = true where id = 'who5-v2'$$, '23505', 'dwie aktywne wersje jednego testu: odrzucone');
update public.questionnaires set is_active = false where id = 'who5-v1';
update public.questionnaires set is_active = true  where id = 'who5-v2';
set role authenticated;
select t.login(:'kuba');
select t.ok((select count(*) = 1 and bool_and(questionnaire_id = 'who5-v1' and band_title is not null) from public.test_history),
            'po zmianie wersji historia nadal pokazuje stary opis');
select t.ok((select questionnaire_id = 'who5-v2' and last_completed_on = t.dzis() from public.test_overview where code = 'who5'),
            'odstęp liczy się między wersjami tego samego testu');
reset role;

-- ---------------------------------------------------------------- dziennik zgód jest niezmienny nawet dla administratora
select t.raises($$update public.user_consents set given_at = given_at - interval '1 day'$$, 'consent_immutable', 'administrator nie zmieni daty zgody');
select t.raises($$update public.user_consents set withdrawn_at = null where withdrawn_at is not null$$, 'consent_immutable', 'wycofania nie da się cofnąć');
select t.raises($$delete from public.user_consents$$, 'consent_immutable', 'zgody przypiętej do konta nie da się skasować');
select t.raises($$update public.user_consents set user_id = null$$, 'consent_immutable', 'ani odpiąć od istniejącego konta, żeby skasować w drugim kroku');

-- ---------------------------------------------------------------- opiekun cofa zgodę: dane dziecka znikają
set role authenticated;
select t.login(:'kuba');
select t.ok((select count(*) >= 1 from public.daily_checkins) and (select count(*) >= 1 from public.test_sessions), 'przed cofnięciem: dziecko ma podlewanie i wynik testu');
select t.raises($$select public.withdraw_guardian_consent('tajny-token')$$, 'permission denied', 'cofnięcie zgody opiekuna tylko dla serwera');
reset role;
set role service_role;
select t.raises($$select public.withdraw_guardian_consent('zly')$$, 'token_invalid', 'zły token przy cofnięciu');
select t.ok(public.withdraw_guardian_consent('tajny-token') = :'kuba', 'opiekun cofa zgodę swoim linkiem');
reset role;
set role authenticated;
select t.ok((select count(*) = 0 from public.daily_checkins) and (select count(*) = 0 from public.test_sessions)
        and (public.health_consent_status()->>'reason') = 'guardian_pending', 'po cofnięciu przez opiekuna: dane o zdrowiu usunięte, zapis wstrzymany');
select t.raises($$select public.save_checkin(t.dzis(), 5::smallint)$$, 'consent_required', 'i nowego podlewania nie da się zapisać');
reset role;

-- ---------------------------------------------------------------- blog, głosy, zgłoszenia, powiadomienia
insert into public.posts (author_id, pseudonym, title, body, status, moderation) values
  (:'ola', 'Cicha Paproć', 'Dobry dzień', 'Dziś było naprawdę dobrze.', 'published', '{"verdict": "ok"}'),
  (:'ola', 'Cicha Paproć', 'Odrzucony', 'Ten wpis nie przeszedł moderacji.', 'rejected', '{"verdict": "obrazliwe", "threshold": 0.7}');
select id as post_ok from public.posts where status = 'published' \gset
select id as post_zly from public.posts where status = 'rejected' \gset
set role authenticated;
select t.login(:'ola');
select t.ok((select count(*) = 2 from public.posts), 'autor widzi swoje wpisy, także odrzucony');
select t.raises('select moderation from public.posts', 'permission denied', 'ale nie wynik moderacji z progami');
select t.login(:'kuba');
select t.ok((select count(*) = 1 and bool_and(not is_mine) from public.blog_posts) and (select count(*) = 0 from public.posts), 'inni czytają tylko opublikowane, przez widok bez autora');
insert into public.votes (post_id, user_id, value) values (:'post_ok', auth.uid(), 1);
select t.raises(format($$insert into public.votes (post_id, user_id, value) values (%L, auth.uid(), 1)$$, :'post_zly'), 'row-level security', 'głos na nieopublikowany wpis: odrzucony');
select t.raises(format($$insert into public.votes (post_id, user_id, value) values (%L, %L, 1)$$, :'post_ok', :'ola'), 'row-level security', 'głos w cudzym imieniu: odrzucony');
select t.raises(format($$update public.votes set post_id = %L$$, :'post_zly'), 'permission denied', 'głosu nie da się przenieść na inny wpis');
update public.votes set value = -1;
select t.raises(format($$insert into public.reports (reporter_id, post_id, status) values (auth.uid(), %L, 'dismissed')$$, :'post_ok'), 'permission denied', 'zgłaszający nie ustawia statusu zgłoszenia');
insert into public.reports (reporter_id, post_id, reason) values (auth.uid(), :'post_ok', 'test');
select t.raises($$insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[abcdefgh]', auth.uid(), 'ios')$$, 'permission denied', 'tokenu push nie wpisuje się wprost');
select public.register_push_token('ExponentPushToken[abcdefgh]', 'ios');
select t.login(:'ola');
select public.register_push_token('ExponentPushToken[abcdefgh]', 'ios');
select t.ok((select count(*) = 1 from public.push_tokens), 'ten sam telefon po zmianie konta: token przechodzi na nowe konto');
select t.login(:'kuba');
select t.ok((select count(*) = 0 from public.push_tokens), 'i znika u poprzedniego');
reset role;
select t.ok((select score = -1 from public.posts where id = :'post_ok') and (select status = 'open' from public.reports), 'licznik głosów i zgłoszenie zapisane poprawnie');

-- ---------------------------------------------------------------- katalog uprawnień: nic nie zostało otwarte przez pomyłkę
select t.ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind in ('r', 'v', 'S')
    and (has_table_privilege('anon', c.oid, 'select') or (c.relkind <> 'S' and has_table_privilege('anon', c.oid, 'insert, update, delete')))
), 'anon nie ma prawa do żadnej tabeli, widoku ani sekwencji');
select t.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
), 'anon nie może wykonać żadnej funkcji schematu');
select t.ok((select array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname in ('public', 'private') and p.prokind = 'f' and has_function_privilege('authenticated', p.oid, 'execute')
               and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'))
  = array['private.can_read_questionnaire', 'private.current_document', 'private.is_timezone',
          'public.delete_checkin', 'public.delete_my_account', 'public.delete_test_results', 'public.finish_experiment',
          'public.give_consent', 'public.health_consent_status', 'public.register_push_token', 'public.save_checkin',
          'public.set_insight_feedback', 'public.start_experiment', 'public.submit_test', 'public.withdraw_consent'],
  'zalogowany może wykonać dokładnie te funkcje, które ma móc (lista jawna — nowa funkcja wymaga decyzji)');
select t.ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
), 'każda tabela ma włączone RLS');

-- ---------------------------------------------------------------- usunięcie konta
set role authenticated;
select t.login(:'ala');
select public.delete_my_account();
reset role;
select t.ok(not exists (select 1 from auth.users where id = :'ala')
        and not exists (select 1 from public.profiles where id = :'ala')
        and not exists (select 1 from public.test_sessions where user_id = :'ala')
        and not exists (select 1 from public.daily_checkins where user_id = :'ala'), 'usunięcie konta kasuje profil i dane');
select t.ok((select count(*) = 5 and bool_and(user_id is null and orphaned_at is not null)
             from public.user_consents where subject_hash = encode(sha256('ala@example.com'::bytea), 'hex')),
            'dowód zgód zostaje bez powiązania z kontem');
select t.ok((select count(*) = 1 from public.privacy_events where event = 'account_deleted' and user_id is null), 'usunięcie konta zostawia ślad');
select t.ok(private.purge_orphaned_records(interval '10 years') = 0, 'przed terminem nic nie znika');
select t.ok(private.purge_orphaned_records(interval '0 seconds') = 5, 'po terminie czyszczenie kasuje 5 dowodów');
select t.ok(not exists (select 1 from public.user_consents where user_id is null)
        and not exists (select 1 from public.privacy_events where user_id is null), 'po czyszczeniu nie ma osieroconych wierszy');
select t.ok((select count(*) > 0 from public.user_consents where user_id = :'kuba'), 'czyszczenie nie rusza istniejących kont');

select count(*) || ' sprawdzeń przeszło' as wynik from t.results;
