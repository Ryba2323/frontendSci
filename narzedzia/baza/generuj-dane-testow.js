/*
 * Generuje notes/supabase-testy-dane.sql z Main_Front-End/js/testy-dane.js,
 * żeby aplikacja i baza miały te same pytania, skale i opisy wyników.
 *
 *   node narzedzia/baza/generuj-dane-testow.js            zapisuje plik
 *   node narzedzia/baza/generuj-dane-testow.js --sprawdz  kończy się błędem, gdy plik jest nieaktualny
 */
const fs = require('fs');
const path = require('path');

const { TESTY } = require('../../Main_Front-End/js/testy-dane.js');
const OUT = path.join(__dirname, '../../notes/supabase-testy-dane.sql');

const s = v => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = list => `array[${list.map(s).join(', ')}]`;

const lines = [
  '-- =====================================================================',
  '--  ReLeaf — pytania, skale i opisy wyników testów (część 3: dane).',
  '--  WYGENEROWANE z Main_Front-End/js/testy-dane.js — NIE EDYTOWAĆ RĘCZNIE.',
  '--  Zmiana treści: popraw testy-dane.js (z nową wersją id) i uruchom',
  '--    node narzedzia/baza/generuj-dane-testow.js',
  '--  Uruchamiać po notes/supabase-testy.sql.',
  '-- =====================================================================',
  '',
];

TESTY.forEach(t => {
  lines.push(`-- ---------- ${t.officialName} (${t.id}) ----------`);
  lines.push(
    'insert into public.questionnaires (id, code, version, title, official_name, instruction, answer_min, answer_max, answer_labels,',
    '                                   min_interval_days, validated_from_age, source, licence) values',
    `  (${s(t.id)}, ${s(t.code)}, ${t.version}, ${s(t.title)}, ${s(t.officialName)},`,
    `   ${s(t.instruction)},`,
    `   ${t.answerMin}, ${t.answerMax}, ${arr(t.answerLabels)},`,
    `   ${t.minIntervalDays}, ${t.validatedFromAge == null ? 'null' : t.validatedFromAge},`,
    `   ${s(t.source)},`,
    `   ${s(t.licence)});`,
    '');

  lines.push('insert into public.questionnaire_scales (questionnaire_id, code, position, name, low_label, high_label) values');
  lines.push(t.scales.map((sc, i) =>
    `  (${s(t.id)}, ${s(sc.code)}, ${i + 1}, ${s(sc.name)}, ${s(sc.lowLabel)}, ${s(sc.highLabel)})`).join(',\n') + ';', '');

  lines.push('insert into public.questionnaire_questions (questionnaire_id, position, scale_code, is_reversed, source_item, text_m, text_f, text_n) values');
  lines.push(t.questions.map((q, i) =>
    `  (${s(t.id)}, ${i + 1}, ${s(q.scale)}, ${q.reversed ? 'true' : 'false'}, ${s(q.sourceItem)}, ${s(q.text.m)}, ${s(q.text.f)}, ${s(q.text.n)})`).join(',\n') + ';', '');

  // przedziały: [od, następne od), ostatni [od, 100]
  lines.push('insert into public.score_bands (questionnaire_id, scale_code, code, scaled_range, title, body, shows_support) values');
  const bands = [];
  t.scales.forEach(sc => sc.bands.forEach((b, i) => {
    const next = sc.bands[i + 1];
    const range = next ? `numrange(${b.od}, ${next.od}, '[)')` : `numrange(${b.od}, 100, '[]')`;
    bands.push(`  (${s(t.id)}, ${s(sc.code)}, ${s(b.code)}, ${range}, ${s(b.title)},\n   ${s(b.body)}, ${b.wsparcie ? 'true' : 'false'})`);
  }));
  lines.push(bands.join(',\n') + ';', '');

  lines.push('-- włączenie sprawdza kompletność (pytania 1..n, każda skala ma pytania i opisy na całe 0–100)');
  lines.push(`update public.questionnaires set is_active = true where id = ${s(t.id)};`, '');
});

const sql = lines.join('\n');
if (process.argv.includes('--sprawdz')) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (now !== sql) {
    console.error('notes/supabase-testy-dane.sql jest nieaktualny. Uruchom: node narzedzia/baza/generuj-dane-testow.js');
    process.exit(1);
  }
  console.log('supabase-testy-dane.sql zgodny z testy-dane.js');
} else {
  fs.writeFileSync(OUT, sql);
  console.log(`Zapisano ${path.relative(process.cwd(), OUT)} (${TESTY.length} testy)`);
}
