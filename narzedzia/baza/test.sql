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
grant execute on all functions in schema t to anon, authenticated, service_role;

select t.new_user('ala@example.com', 17, 'f') as ala,
       t.new_user('ola@example.com', 18, 'm') as ola,
       t.new_user('kuba@example.com', 14, 'm') as kuba \gset

-- ---------------------------------------------------------------- profil
select t.ok((select nick = 'ala' and grammar_form = 'f' and plant_name = 'Mięta' and theme = 'zielony'
                    and birth_year = extract(year from now())::int - 17 from public.profiles where id = :'ala'),
            'profil powstaje sam z danych rejestracji');
select t.ok(not private.needs_guardian(:'ala') or extract(year from now())::int - 17 + 17 > extract(year from now())::int,
            'needs_guardian liczy ostrożnie od roku urodzenia');
select t.ok(private.needs_guardian(:'kuba'), '14 lat → potrzebna zgoda opiekuna');
select t.ok(not private.needs_guardian(:'ola'), '18 lat → bez zgody opiekuna');

-- ---------------------------------------------------------------- niezalogowany nie widzi nic
set role anon;
select t.raises('select * from public.profiles',                 'permission denied', 'anon: profile zamknięte');
select t.raises('select * from public.user_consents',            'permission denied', 'anon: zgody zamknięte');
select t.raises('select * from public.test_sessions',            'permission denied', 'anon: wyniki zamknięte');
select t.raises('select * from public.questionnaire_questions',  'permission denied', 'anon: pytania zamknięte');
select t.raises('select * from public.blog_posts',               'permission denied', 'anon: blog zamknięty');
select t.raises('select * from public.test_history',             'permission denied', 'anon: historia zamknięta');
select t.raises($$select public.submit_test('who5', array[1,1,1,1,1]::smallint[])$$, 'permission denied', 'anon: submit_test zamknięty');
select t.raises($$select public.give_consent(array['terms']::public.legal_doc_kind[])$$, 'permission denied', 'anon: give_consent zamknięty');
select t.raises('select public.delete_my_account()',             'permission denied', 'anon: delete_my_account zamknięty');
reset role;

-- ---------------------------------------------------------------- bez zgody nic o zdrowiu się nie zapisze
set role authenticated;
select t.login(:'ala');
select t.ok((select count(*) = 2 from public.test_overview), 'zalogowany widzi dwa aktywne testy');
select t.ok((select question_count = 5 from public.test_overview where code = 'who5')
        and (select question_count = 20 from public.test_overview where code = 'ipip20'), 'WHO-5 ma 5 pytań, IPIP 20');
select t.ok((select count(*) = 25 from public.questionnaire_questions), 'zalogowany czyta pytania');
select t.ok((public.health_consent_status()->>'reason') = 'no_consent', 'status zgody: brak');
select t.raises($$select public.submit_test('who5', array[3,3,3,3,3]::smallint[])$$, 'consent_required', 'test bez zgody: consent_required');
select t.raises($$insert into public.daily_checkins (user_id, day, mood) values (auth.uid(), current_date, 7)$$,
                'row-level security', 'podlewanie bez zgody: odrzucone');

-- ---------------------------------------------------------------- zgody
select t.raises($$select public.give_consent(array['guardian']::public.legal_doc_kind[])$$, 'forbidden', 'zgody opiekuna nie da się wpisać samemu');
select t.raises($$select public.give_consent(array[]::public.legal_doc_kind[])$$, 'invalid_input', 'pusta lista zgód: odrzucona');
select t.ok((select count(*) = 3 from public.give_consent(array['terms','privacy','health_data']::public.legal_doc_kind[])), 'give_consent zapisuje trzy zgody');
select t.ok((select count(*) = 3 from public.give_consent(array['terms','privacy','health_data']::public.legal_doc_kind[]))
        and (select count(*) = 3 from public.user_consents), 'powtórne give_consent nie dubluje');
select t.ok((select bool_and(active and not needs_renewal and version = '0.1') from public.my_consents), 'my_consents: aktywne, wersja 0.1');
select t.ok((select subject_hash = encode(sha256('ala@example.com'::bytea), 'hex') from public.user_consents limit 1), 'zgoda ma odcisk e-maila');
select t.ok((public.health_consent_status()->>'active')::boolean, 'status zgody: aktywna');
select t.raises($$insert into public.user_consents (user_id, subject_hash, document_id, kind)
                  select auth.uid(), 'x', id, kind from public.legal_documents where kind = 'guardian'$$,
                'permission denied', 'bezpośredni zapis zgody: brak prawa');
select t.raises('update public.user_consents set given_at = now() - interval ''1 year''', 'permission denied', 'zmiana zgody: brak prawa');
select t.raises('delete from public.user_consents', 'permission denied', 'kasowanie zgody: brak prawa');
select t.raises($$select public.withdraw_consent('terms')$$, 'use_delete_account', 'regulaminu nie wycofuje się osobno');
select t.raises($$select public.confirm_guardian_consent('abc')$$, 'permission denied', 'potwierdzenie opiekuna tylko dla serwera');
select t.raises('update public.profiles set birth_year = 1995', 'permission denied', 'roku urodzenia nie da się zmienić');
update public.profiles set nick = 'Alicja';
select t.ok((select nick = 'Alicja' and updated_at >= created_at from public.profiles), 'własny profil da się poprawić');

-- ---------------------------------------------------------------- podlewanie po zgodzie
insert into public.daily_checkins (user_id, day, mood) values (auth.uid(), current_date, 7);
select t.ok((select count(*) = 1 from public.daily_checkins), 'podlewanie po zgodzie: zapisane');
select t.raises(format($$insert into public.daily_checkins (user_id, day, mood) values (%L, current_date, 2)$$, :'ola'),
                'row-level security', 'podlewania za kogoś innego nie da się zapisać');

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
select t.ok((select last_completed_on = current_date and next_available_on = current_date + 7 from public.test_overview where code = 'who5'), 'test_overview pokazuje datę następnego podejścia');
select t.ok((select count(*) = 1 and bool_and(band_title is not null and scaled = 64) from public.test_history), 'test_history: wynik z opisem');

-- wyniku nie da się wpisać ani poprawić ręcznie
select t.raises(format($$insert into public.test_sessions (user_id, questionnaire_id, consent_id, completed_on)
                         select auth.uid(), 'ipip20-v1', id, current_date from public.user_consents where kind = 'health_data'$$),
                'permission denied', 'ręczny zapis sesji: brak prawa');
select t.raises('update public.test_scores set scaled = 100', 'permission denied', 'poprawienie wyniku: brak prawa');
select t.raises('delete from public.test_sessions', 'permission denied', 'kasowanie poza funkcją: brak prawa');
select t.raises($$update public.questionnaire_questions set text_m = 'x'$$, 'permission denied', 'zmiana pytań: brak prawa');

-- ---------------------------------------------------------------- druga osoba nie widzi cudzych danych
select t.login(:'ola');
select t.ok((select count(*) = 0 from public.test_sessions) and (select count(*) = 0 from public.test_answers)
        and (select count(*) = 0 from public.test_scores) and (select count(*) = 0 from public.test_history)
        and (select count(*) = 0 from public.user_consents) and (select count(*) = 0 from public.daily_checkins)
        and (select count(*) = 1 from public.profiles) and (select count(*) = 0 from public.privacy_events),
            'inna osoba nie widzi cudzych wyników, zgód, podlewań ani profilu');
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
select t.ok((select count(*) = 0 from public.test_sessions) and (select count(*) = 0 from public.daily_checkins), 'wycofanie zgody: testy i podlewania usunięte');
select t.ok((select count(*) = 1 from public.user_consents where kind = 'health_data' and withdrawn_at is not null), 'zgoda zostaje w dzienniku jako wycofana');
select t.ok((select count(*) = 1 from public.privacy_events where event = 'health_data_erased')
        and (select count(*) = 1 from public.privacy_events where details->>'scope' = 'consent_withdrawn'), 'wycofanie zostawia ślad');
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
select t.raises($$insert into public.daily_checkins (user_id, day, mood) values (auth.uid(), current_date, 5)$$, 'row-level security', '14 lat bez opiekuna: podlewanie odrzucone');
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
select t.ok(public.submit_test('who5', array[2,3,2,3,2]::smallint[]) #>> '{scores,0,band}' = 'lower', 'WHO-5 48% → „ostatnio trudniej”');
select t.ok((select c.given_by = 'guardian' and c.ip = '203.0.113.7' from public.user_consents c where c.kind = 'guardian'),
            'zgoda opiekuna zapisana z adresem');

-- ---------------------------------------------------------------- baza liczy tak samo jak aplikacja
\ir _wyniki.sql
reset role;

-- ---------------------------------------------------------------- słowniki: wersje i kompletność
select t.raises($$update public.questionnaire_questions set text_m = 'inne' where questionnaire_id = 'who5-v1' and position = 1$$,
                'questionnaire_in_use', 'używanej wersji pytań nie da się poprawić');
select t.raises($$update public.score_bands set body = 'inne' where questionnaire_id = 'who5-v1'$$, 'questionnaire_in_use', 'ani opisów wyniku');
select t.raises($$insert into public.score_bands values ('who5-v1', 'total', 'extra', numrange(40, 60), 'x', 'y')$$,
                '23P01', 'przedziały wyniku nie mogą na siebie zachodzić');
insert into public.questionnaires (id, code, version, title, official_name, instruction, answer_min, answer_max, answer_labels, source, licence)
  values ('who5-v2', 'who5', 2, 'S', 'WHO-5', 'i', 0, 5, array['a','b','c','d','e','f'], 's', 'l');
select t.raises($$update public.questionnaires set is_active = true where id = 'who5-v2'$$, 'questionnaire_incomplete', 'pustej wersji nie da się włączyć');
insert into public.questionnaire_scales values ('who5-v2', 'total', 1, 'Samopoczucie');
insert into public.questionnaire_questions values ('who5-v2', 1, 'total', false, null, 'a', 'a', 'a');
insert into public.score_bands values ('who5-v2', 'total', 'lower', numrange(0, 50, '[)'), 't', 'b');
select t.raises($$update public.questionnaires set is_active = true where id = 'who5-v2'$$, 'questionnaire_incomplete', 'opisy muszą pokryć całe 0–100');
insert into public.score_bands values ('who5-v2', 'total', 'ok', numrange(50, 100, '[]'), 't', 'b');
select t.raises($$update public.questionnaires set is_active = true where id = 'who5-v2'$$, '23505', 'dwie aktywne wersje jednego testu: odrzucone');
update public.questionnaires set is_active = false where id = 'who5-v1';
update public.questionnaires set is_active = true  where id = 'who5-v2';
set role authenticated;
select t.login(:'kuba');
select t.ok((select count(*) = 1 and bool_and(questionnaire_id = 'who5-v1' and band_title is not null) from public.test_history),
            'po zmianie wersji historia nadal pokazuje stary opis');
select t.ok((select questionnaire_id = 'who5-v2' and last_completed_on = current_date from public.test_overview where code = 'who5'),
            'odstęp liczy się między wersjami tego samego testu');
reset role;

-- ---------------------------------------------------------------- dziennik zgód jest niezmienny nawet dla administratora
select t.raises($$update public.user_consents set given_at = given_at - interval '1 day'$$, 'consent_immutable', 'administrator nie zmieni daty zgody');
select t.raises($$update public.user_consents set withdrawn_at = null where withdrawn_at is not null$$, 'consent_immutable', 'wycofania nie da się cofnąć');
select t.raises($$delete from public.user_consents$$, 'consent_immutable', 'zgody przypiętej do konta nie da się skasować');

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
