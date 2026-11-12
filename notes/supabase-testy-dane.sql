-- =====================================================================
--  ReLeaf — pytania, skale i opisy wyników testów (część 3: dane).
--  WYGENEROWANE z Main_Front-End/js/testy-dane.js — NIE EDYTOWAĆ RĘCZNIE.
--  Zmiana treści: popraw testy-dane.js (z nową wersją id) i uruchom
--    node narzedzia/baza/generuj-dane-testow.js
--  Uruchamiać po notes/supabase-testy.sql.
-- =====================================================================

-- ---------- WHO-5 — Wskaźnik Dobrego Samopoczucia (who5-v1) ----------
insert into public.questionnaires (id, code, version, title, official_name, instruction, answer_min, answer_max, answer_labels,
                                   min_interval_days, validated_from_age, source, licence) values
  ('who5-v1', 'who5', 1, 'Samopoczucie', 'WHO-5 — Wskaźnik Dobrego Samopoczucia',
   'Pomyśl o ostatnich dwóch tygodniach. Przy każdym zdaniu wybierz odpowiedź, która najlepiej opisuje Twoje samopoczucie.',
   0, 5, array['Nigdy', 'Od czasu do czasu', 'Mniej niż połowę czasu', 'Więcej niż połowę czasu', 'Prawie cały czas', 'Cały czas'],
   7, null,
   'World Health Organization (2024). The World Health Organization-Five Well-Being Index (WHO-5). Polskie tłumaczenie: Psychiatric Centre North Zealand.',
   'CC BY-NC-SA 3.0 IGO');

insert into public.questionnaire_scales (questionnaire_id, code, position, name, low_label, high_label) values
  ('who5-v1', 'total', 1, 'Samopoczucie', null, null);

insert into public.questionnaire_questions (questionnaire_id, position, scale_code, is_reversed, source_item, text_m, text_f, text_n) values
  ('who5-v1', 1, 'total', false, null, 'Czułem się wesoły i w dobrym nastroju', 'Czułam się wesoła i w dobrym nastroju', 'Czułem(-am) się wesoły(-a) i w dobrym nastroju'),
  ('who5-v1', 2, 'total', false, null, 'Czułem się spokojny i odprężony', 'Czułam się spokojna i odprężona', 'Czułem(-am) się spokojny(-a) i odprężony(-a)'),
  ('who5-v1', 3, 'total', false, null, 'Czułem się aktywny i energiczny', 'Czułam się aktywna i energiczna', 'Czułem(-am) się aktywny(-a) i energiczny(-a)'),
  ('who5-v1', 4, 'total', false, null, 'Budziłem się z uczuciem świeżości i wypoczęty', 'Budziłam się z uczuciem świeżości i wypoczęta', 'Budziłem(-am) się z uczuciem świeżości i wypoczęty(-a)'),
  ('who5-v1', 5, 'total', false, null, 'Moje życie codzienne było wypełnione interesującymi mnie sprawami', 'Moje życie codzienne było wypełnione interesującymi mnie sprawami', 'Moje życie codzienne było wypełnione interesującymi mnie sprawami');

insert into public.score_bands (questionnaire_id, scale_code, code, scaled_range, title, body, shows_support) values
  ('who5-v1', 'total', 'support', numrange(0, 29, '[)'), 'To były ciężkie dwa tygodnie',
   'Dobrze, że to sprawdzasz. Taki wynik to sygnał, żeby nie zostawać z tym w pojedynkę. Porozmawiaj z kimś zaufanym albo zadzwoń pod 116 111 — bezpłatnie, o każdej porze.', true),
  ('who5-v1', 'total', 'lower', numrange(29, 50, '[)'), 'Ostatnio jest Ci trudniej',
   'Ostatnie dwa tygodnie były dla Ciebie cięższe. To się zdarza. Zadbaj o podstawy: sen, ruch, chwila z kimś bliskim. Jeśli tak zostanie na dłużej, porozmawiaj z kimś zaufanym.', false),
  ('who5-v1', 'total', 'ok', numrange(50, 100, '[]'), 'Ostatnio jest Ci całkiem dobrze',
   'W ostatnich dwóch tygodniach było u Ciebie sporo dobrego samopoczucia. Warto zauważyć, co Ci w tym pomaga.', false);

-- włączenie sprawdza kompletność (pytania 1..n, każda skala ma pytania i opisy na całe 0–100)
update public.questionnaires set is_active = true where id = 'who5-v1';

-- ---------- IPIP-BFM-20 — krótki kwestionariusz Wielkiej Piątki (ipip20-v1) ----------
insert into public.questionnaires (id, code, version, title, official_name, instruction, answer_min, answer_max, answer_labels,
                                   min_interval_days, validated_from_age, source, licence) values
  ('ipip20-v1', 'ipip20', 1, 'Osobowość', 'IPIP-BFM-20 — krótki kwestionariusz Wielkiej Piątki',
   'Przy każdym zdaniu zaznacz, jak trafnie Cię opisuje. Opisuj siebie tak, jak zwykle jest, a nie tak, jak chcesz, żeby było. Nie ma dobrych ani złych odpowiedzi.',
   1, 5, array['Całkowicie nietrafnie', 'Raczej nietrafnie', 'Trochę trafnie, trochę nietrafnie', 'Raczej trafnie', 'Całkowicie trafnie'],
   30, 16,
   'Topolewska, Skimina, Strus, Cieciuch, Rowiński (2014). Krótki kwestionariusz do pomiaru Wielkiej Piątki IPIP-BFM-20. Roczniki Psychologiczne, 17(2), 367–384.',
   'domena publiczna (International Personality Item Pool, ipip.ori.org)');

insert into public.questionnaire_scales (questionnaire_id, code, position, name, low_label, high_label) values
  ('ipip20-v1', 'extraversion', 1, 'Ekstrawersja', 'cisza i małe grono', 'ludzie i rozmowy'),
  ('ipip20-v1', 'agreeableness', 2, 'Ugodowość', 'własne zdanie', 'troska o innych'),
  ('ipip20-v1', 'conscientiousness', 3, 'Sumienność', 'spontanicznie', 'według planu'),
  ('ipip20-v1', 'stability', 4, 'Stabilność emocjonalna', 'mocne emocje', 'spokój'),
  ('ipip20-v1', 'intellect', 5, 'Intelekt', 'konkret', 'wyobraźnia');

insert into public.questionnaire_questions (questionnaire_id, position, scale_code, is_reversed, source_item, text_m, text_f, text_n) values
  ('ipip20-v1', 1, 'extraversion', false, '1', 'Jestem duszą towarzystwa', 'Jestem duszą towarzystwa', 'Jestem duszą towarzystwa'),
  ('ipip20-v1', 2, 'agreeableness', true, '2', 'Niezbyt obchodzą mnie inni ludzie', 'Niezbyt obchodzą mnie inni ludzie', 'Niezbyt obchodzą mnie inni ludzie'),
  ('ipip20-v1', 3, 'intellect', false, '5', 'Mam bogate słownictwo', 'Mam bogate słownictwo', 'Mam bogate słownictwo'),
  ('ipip20-v1', 4, 'conscientiousness', true, '8', 'Zostawiam moje rzeczy, gdzie popadnie', 'Zostawiam moje rzeczy, gdzie popadnie', 'Zostawiam moje rzeczy, gdzie popadnie'),
  ('ipip20-v1', 5, 'stability', false, '9', 'Zwykle jestem zrelaksowany', 'Zwykle jestem zrelaksowana', 'Zwykle jestem zrelaksowany(-a)'),
  ('ipip20-v1', 6, 'intellect', true, '10', 'Mam trudności ze zrozumieniem abstrakcyjnych pojęć', 'Mam trudności ze zrozumieniem abstrakcyjnych pojęć', 'Mam trudności ze zrozumieniem abstrakcyjnych pojęć'),
  ('ipip20-v1', 7, 'stability', true, '14', 'Często martwię się czymś', 'Często martwię się czymś', 'Często martwię się czymś'),
  ('ipip20-v1', 8, 'extraversion', true, '16', 'Trzymam się z boku', 'Trzymam się z boku', 'Trzymam się z boku'),
  ('ipip20-v1', 9, 'agreeableness', false, '17', 'Jestem wyrozumiały dla uczuć innych ludzi', 'Jestem wyrozumiała dla uczuć innych ludzi', 'Jestem wyrozumiały(-a) dla uczuć innych ludzi'),
  ('ipip20-v1', 10, 'stability', false, '19', 'Rzadko czuję się przygnębiony', 'Rzadko czuję się przygnębiona', 'Rzadko czuję się przygnębiony(-a)'),
  ('ipip20-v1', 11, 'agreeableness', true, '22', 'Nie interesują mnie problemy innych ludzi', 'Nie interesują mnie problemy innych ludzi', 'Nie interesują mnie problemy innych ludzi'),
  ('ipip20-v1', 12, 'conscientiousness', false, '23', 'Bez zwłoki wypełniam codzienne obowiązki', 'Bez zwłoki wypełniam codzienne obowiązki', 'Bez zwłoki wypełniam codzienne obowiązki'),
  ('ipip20-v1', 13, 'conscientiousness', true, '28', 'Często zapominam odkładać rzeczy na miejsce', 'Często zapominam odkładać rzeczy na miejsce', 'Często zapominam odkładać rzeczy na miejsce'),
  ('ipip20-v1', 14, 'intellect', true, '30', 'Nie mam zbyt bogatej wyobraźni', 'Nie mam zbyt bogatej wyobraźni', 'Nie mam zbyt bogatej wyobraźni'),
  ('ipip20-v1', 15, 'extraversion', false, '31', 'Rozmawiam z wieloma różnymi ludźmi na przyjęciach', 'Rozmawiam z wieloma różnymi ludźmi na przyjęciach', 'Rozmawiam z wieloma różnymi ludźmi na przyjęciach'),
  ('ipip20-v1', 16, 'agreeableness', false, '37', 'Znajduję czas dla innych', 'Znajduję czas dla innych', 'Znajduję czas dla innych'),
  ('ipip20-v1', 17, 'stability', true, '39', 'Często miewam huśtawki nastrojów', 'Często miewam huśtawki nastrojów', 'Często miewam huśtawki nastrojów'),
  ('ipip20-v1', 18, 'conscientiousness', false, '43', 'Postępuję zgodnie z harmonogramem', 'Postępuję zgodnie z harmonogramem', 'Postępuję zgodnie z harmonogramem'),
  ('ipip20-v1', 19, 'extraversion', true, '46', 'Wśród nieznajomych jestem małomówny', 'Wśród nieznajomych jestem małomówna', 'Wśród nieznajomych jestem małomówny(-a)'),
  ('ipip20-v1', 20, 'intellect', false, '50', 'Mam głowę pełną pomysłów', 'Mam głowę pełną pomysłów', 'Mam głowę pełną pomysłów');

insert into public.score_bands (questionnaire_id, scale_code, code, scaled_range, title, body, shows_support) values
  ('ipip20-v1', 'extraversion', 'low', numrange(0, 34, '[)'), 'Bliżej Ci do ciszy',
   'Ładujesz baterie w spokoju i w małym gronie. Lubisz mieć czas tylko dla siebie.', false),
  ('ipip20-v1', 'extraversion', 'mid', numrange(34, 67, '[)'), 'Trochę tak, trochę tak',
   'Lubisz ludzi, ale potrzebujesz też chwili dla siebie. Dużo zależy od dnia i towarzystwa.', false),
  ('ipip20-v1', 'extraversion', 'high', numrange(67, 100, '[]'), 'Ciągnie Cię do ludzi',
   'Rozmowy i towarzystwo dodają Ci energii. Łatwo nawiązujesz kontakt.', false),
  ('ipip20-v1', 'agreeableness', 'low', numrange(0, 34, '[)'), 'Mówisz, jak jest',
   'Kierujesz się swoim zdaniem i potrafisz go bronić. Cudze sprawy rzadziej Cię pochłaniają.', false),
  ('ipip20-v1', 'agreeableness', 'mid', numrange(34, 67, '[)'), 'Między sobą a innymi',
   'Potrafisz pomóc i wysłuchać, ale pamiętasz też o własnych potrzebach.', false),
  ('ipip20-v1', 'agreeableness', 'high', numrange(67, 100, '[]'), 'Masz dużo ciepła dla innych',
   'Zauważasz, co czują inni, i znajdujesz dla nich czas.', false),
  ('ipip20-v1', 'conscientiousness', 'low', numrange(0, 34, '[)'), 'Działasz spontanicznie',
   'Plan i porządek nie są dla Ciebie najważniejsze. Lubisz swobodę i decyzje na bieżąco.', false),
  ('ipip20-v1', 'conscientiousness', 'mid', numrange(34, 67, '[)'), 'Plan, ale bez przesady',
   'Umiesz się zorganizować, gdy trzeba, i odpuścić, gdy można.', false),
  ('ipip20-v1', 'conscientiousness', 'high', numrange(67, 100, '[]'), 'Lubisz mieć poukładane',
   'Plan, porządek i sprawy załatwione na czas dają Ci spokój.', false),
  ('ipip20-v1', 'stability', 'low', numrange(0, 34, '[)'), 'Mocno przeżywasz',
   'Emocje bywają u Ciebie silne i zmienne, a zmartwienia potrafią wracać. To wrażliwość, nie wada. Warto mieć swoje sposoby na uspokojenie.', false),
  ('ipip20-v1', 'stability', 'mid', numrange(34, 67, '[)'), 'Raz spokojnie, raz burzliwie',
   'Zwykle trzymasz równowagę, choć trudniejsze chwile potrafią Cię poruszyć.', false),
  ('ipip20-v1', 'stability', 'high', numrange(67, 100, '[]'), 'Trudno wytrącić Cię z równowagi',
   'Zwykle zachowujesz spokój, a zmartwienia nie zostają z Tobą na długo.', false),
  ('ipip20-v1', 'intellect', 'low', numrange(0, 34, '[)'), 'Stawiasz na konkret',
   'Wolisz to, co praktyczne i sprawdzone, od abstrakcyjnych rozważań.', false),
  ('ipip20-v1', 'intellect', 'mid', numrange(34, 67, '[)'), 'Trochę praktyki, trochę wyobraźni',
   'Lubisz nowe pomysły, ale cenisz też to, co znane i konkretne.', false),
  ('ipip20-v1', 'intellect', 'high', numrange(67, 100, '[]'), 'Masz głowę pełną pomysłów',
   'Ciekawią Cię nowe idee. Lubisz myśleć, wyobrażać sobie i szukać słów.', false);

-- włączenie sprawdza kompletność (pytania 1..n, każda skala ma pytania i opisy na całe 0–100)
update public.questionnaires set is_active = true where id = 'ipip20-v1';
