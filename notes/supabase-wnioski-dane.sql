-- =====================================================================
--  ReLeaf — katalog pól podlewania (obszary dnia i „co dziś było”).
--  WYGENEROWANE z Main_Front-End/js/wnioski-dane.js — NIE EDYTOWAĆ RĘCZNIE.
--  Zmiana listy: popraw wnioski-dane.js i uruchom
--    node narzedzia/baza/generuj-dane-wnioskow.js
--  Uruchamiać po notes/supabase-wnioski.sql. Powtórne uruchomienie aktualizuje nazwy i kolejność.
-- =====================================================================

insert into public.checkin_fields (code, kind, name, position, min_value, max_value) values
  ('food', 'area', 'Jedzenie', 1, -1, 1),
  ('family', 'area', 'Rodzina', 2, -1, 1),
  ('friends', 'area', 'Przyjaciele', 3, -1, 1),
  ('love', 'area', 'Miłość', 4, -1, 1),
  ('nature', 'area', 'Natura', 5, -1, 1),
  ('study', 'area', 'Nauka', 6, -1, 1),
  ('move', 'activity', 'Ruch', 1, 1, 1),
  ('hobby', 'activity', 'Hobby', 2, 1, 1),
  ('rest', 'activity', 'Odpoczynek', 3, 1, 1),
  ('talk', 'activity', 'Szczera rozmowa', 4, 1, 1),
  ('kindness', 'activity', 'Coś dla kogoś', 5, 1, 1),
  ('prepare', 'activity', 'Plecak na jutro', 6, 1, 1)
on conflict (code) do update
  set kind = excluded.kind, name = excluded.name, position = excluded.position,
      min_value = excluded.min_value, max_value = excluded.max_value, is_active = true;

-- czynniki silnika: ton i to, czy wolno zacząć z nich tygodniową próbę
insert into public.insight_factors (code, tone, can_try) values
  ('sen_dlugi', 'pomaga', false),
  ('spac_wczesnie', 'pomaga', true),
  ('sen_dobry', 'zauwazone', false),
  ('ruch', 'pomaga', true),
  ('natura', 'pomaga', true),
  ('przyjaciele', 'pomaga', true),
  ('rodzina', 'zauwazone', false),
  ('rozmowa', 'pomaga', true),
  ('dla_kogos', 'pomaga', true),
  ('hobby', 'pomaga', true),
  ('odpoczynek', 'pomaga', true),
  ('przygotowanie', 'pomaga', true),
  ('nauka_dobrze', 'zauwazone', false),
  ('nauka_ciezko', 'zauwazone', false),
  ('rodzina_ciezko', 'wsparcie', false),
  ('przyjaciele_ciezko', 'wsparcie', false)
on conflict (code) do update set tone = excluded.tone, can_try = excluded.can_try;
