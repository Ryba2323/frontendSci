/*
 * Generuje notes/supabase-wnioski-dane.sql z Main_Front-End/js/wnioski-dane.js,
 * żeby podlewanie w aplikacji i baza miały tę samą listę pól (obszary dnia i „co dziś było”).
 *
 *   node narzedzia/baza/generuj-dane-wnioskow.js            zapisuje plik
 *   node narzedzia/baza/generuj-dane-wnioskow.js --sprawdz  kończy się błędem, gdy plik jest nieaktualny
 */
const fs = require('fs');
const path = require('path');

const { AREAS, ACTS, CZYNNIKI } = require('../../Main_Front-End/js/wnioski-dane.js');
const OUT = path.join(__dirname, '../../notes/supabase-wnioski-dane.sql');
const s = v => `'${String(v).replace(/'/g, "''")}'`;

const rows = [
  ...AREAS.map((f, i) => `  (${s(f.code)}, 'area', ${s(f.name)}, ${i + 1}, -1, 1)`),
  ...ACTS.map((f, i) => `  (${s(f.code)}, 'activity', ${s(f.name)}, ${i + 1}, 1, 1)`),
];
const sql = [
  '-- =====================================================================',
  '--  ReLeaf — katalog pól podlewania (obszary dnia i „co dziś było”).',
  '--  WYGENEROWANE z Main_Front-End/js/wnioski-dane.js — NIE EDYTOWAĆ RĘCZNIE.',
  '--  Zmiana listy: popraw wnioski-dane.js i uruchom',
  '--    node narzedzia/baza/generuj-dane-wnioskow.js',
  '--  Uruchamiać po notes/supabase-wnioski.sql. Powtórne uruchomienie aktualizuje nazwy i kolejność.',
  '-- =====================================================================',
  '',
  'insert into public.checkin_fields (code, kind, name, position, min_value, max_value) values',
  rows.join(',\n'),
  'on conflict (code) do update',
  '  set kind = excluded.kind, name = excluded.name, position = excluded.position,',
  '      min_value = excluded.min_value, max_value = excluded.max_value, is_active = true;',
  '',
  '-- pola usunięte z aplikacji (np. „Jedzenie” i „Miłość”, 13.11.2026): wyłączone, żeby nowe podlewania ich nie przyjmowały',
  `update public.checkin_fields set is_active = false where code not in (${[...AREAS, ...ACTS].map(f => s(f.code)).join(', ')});`,
  '-- …a to, co już z nich zebrano, usuwamy: nie trzymamy danych, z których nic nie korzysta (RODO art. 5 ust. 1 lit. c)',
  'delete from public.checkin_tags t using public.checkin_fields f where f.code = t.field_code and not f.is_active;',
  '',
  '-- czynniki silnika: ton i to, czy wolno zacząć z nich tygodniową próbę',
  'insert into public.insight_factors (code, tone, can_try) values',
  CZYNNIKI.map(f => `  (${s(f.code)}, ${s(f.tone)}, ${f.proba ? 'true' : 'false'})`).join(',\n'),
  'on conflict (code) do update set tone = excluded.tone, can_try = excluded.can_try;',
  '',
].join('\n');

if (process.argv.includes('--sprawdz')) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (now !== sql) {
    console.error('notes/supabase-wnioski-dane.sql jest nieaktualny. Uruchom: node narzedzia/baza/generuj-dane-wnioskow.js');
    process.exit(1);
  }
  console.log('supabase-wnioski-dane.sql zgodny z wnioski-dane.js');
} else {
  fs.writeFileSync(OUT, sql);
  console.log(`Zapisano ${path.relative(process.cwd(), OUT)} (${rows.length} pól, ${CZYNNIKI.length} czynników)`);
}
