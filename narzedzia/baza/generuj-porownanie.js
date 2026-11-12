/*
 * Wypisuje SQL, który porównuje wyniki z bazy (submit_test) z wynikami liczonymi w aplikacji
 * (Main_Front-End/js/testy-dane.js → score) dla skrajnych i losowych odpowiedzi.
 * Używa go narzedzia/sprawdz-baze.sh (wynik trafia do narzedzia/baza/_wyniki.sql i jest dołączany do test.sql).
 */
const { TESTY, score } = require('../../Main_Front-End/js/testy-dane.js');

// stałe ziarno: te same przypadki przy każdym uruchomieniu
let seed = 20261112;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const out = [];
TESTY.forEach(t => {
  const n = t.questions.length;
  const span = t.answerMax - t.answerMin + 1;
  const cases = [
    Array(n).fill(t.answerMin),
    Array(n).fill(t.answerMax),
    // najwyższy możliwy wynik każdej skali: maksimum w pytaniach wprost, minimum w odwróconych
    t.questions.map(q => (q.reversed ? t.answerMin : t.answerMax)),
    t.questions.map(q => (q.reversed ? t.answerMax : t.answerMin)),
  ];
  // WHO-5: każda możliwa suma 0–25 (granice 28 / 32 i 48 / 52)
  if (t.code === 'who5') {
    for (let sum = 0; sum <= 25; sum++) {
      const a = Array(n).fill(0);
      for (let left = sum, i = 0; left > 0; i = (i + 1) % n) if (a[i] < t.answerMax) { a[i]++; left--; }
      cases.push(a);
    }
  }
  for (let i = 0; i < 40; i++) cases.push(Array.from({ length: n }, () => t.answerMin + Math.floor(rnd() * span)));

  cases.forEach(a => {
    const expected = {};
    score(t, a).forEach(s => { expected[s.scale] = [s.raw, s.scaled, s.band]; });
    out.push(`select t.check_scores('${t.code}', array[${a.join(',')}]::smallint[], '${JSON.stringify(expected)}'::jsonb);`);
  });
});
console.log(out.join('\n'));
