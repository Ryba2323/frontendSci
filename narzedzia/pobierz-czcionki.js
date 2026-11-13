/*
 * Pobiera czcionki aplikacji z Google Fonts do Main_Front-End/fonts/ i zapisuje css/fonts.css z lokalnymi adresami.
 * Uruchom: node narzedzia/pobierz-czcionki.js   (potrzebny Node 18+ i internet; wynik trafia do repozytorium)
 *
 * Po co: strona, która bierze czcionki z serwerów Google, wysyła tam adres IP czytającego, zanim ten cokolwiek
 * przeczyta, także z polityki prywatności (uwaga prawnika z rady, 12.11.2026). Lokalnie nic nie wychodzi poza
 * nasz serwer, a strony działają też bez internetu i z file://.
 * Licencje: wszystkie pięć rodzin jest na SIL Open Font License 1.1 (wolno hostować samemu); tekst: fonts/OFL.txt.
 * Bierzemy tylko zakresy latin i latin-ext (polskie znaki), w plikach zmiennych (jedna czcionka na cały zakres grubości).
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../Main_Front-End/fonts');
const CSS = path.join(__dirname, '../Main_Front-End/css/fonts.css');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';   // nowa przeglądarka = woff2 i pliki zmienne
const FAMILIES = [
  { name: 'Figtree', q: 'Figtree:wght@400..700' },
  { name: 'Bricolage Grotesque', q: 'Bricolage+Grotesque:opsz,wght@12..96,400..600' },
  { name: 'Plus Jakarta Sans', q: 'Plus+Jakarta+Sans:wght@400..800' },
  { name: 'Literata', q: 'Literata:opsz,wght@7..72,400..500' },
  // wordmark „ReLeaf” w górnym pasku: tylko potrzebne litery
  { name: 'Fredoka', q: 'Fredoka:wght@600&text=ReLaf', subset: 'wordmark' },
];
const KEEP = ['latin', 'latin-ext'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const blocks = [];
  let total = 0;
  for (const fam of FAMILIES) {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=${fam.q}&display=swap`, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${fam.name}: ${res.status}`);
    const css = await res.text();
    // bloki mają komentarz z nazwą zakresu (/* latin-ext */); wariant z `text=` ma jeden blok bez komentarza
    const re = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const subset = fam.subset || m[1];
      if (!fam.subset && !KEEP.includes(subset)) continue;
      const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/.exec(m[2]);
      if (!url) throw new Error(`${fam.name}: brak adresu pliku`);
      const file = `${fam.name.toLowerCase().replace(/\s+/g, '-')}-${subset}.woff2`;
      const buf = Buffer.from(await (await fetch(url[1], { headers: { 'User-Agent': UA } })).arrayBuffer());
      if (buf.subarray(0, 4).toString('latin1') !== 'wOF2') throw new Error(`${file}: to nie jest plik woff2`);
      fs.writeFileSync(path.join(OUT, file), buf);
      total += buf.length;
      const body = m[2].replace(/src:[^;]+;/, `src: url("../fonts/${file}") format("woff2");`).trim().replace(/\s*\n\s*/g, ' ');
      blocks.push(`/* ${fam.name} · ${subset} */\n@font-face { ${body} }`);
      console.log(`${file}  ${(buf.length / 1024).toFixed(1)} kB`);
    }
  }
  const ofl = await (await fetch('https://openfontlicense.org/documents/OFL.txt')).text().catch(() => '');
  if (/SIL OPEN FONT LICENSE/i.test(ofl)) fs.writeFileSync(path.join(OUT, 'OFL.txt'), ofl);
  fs.writeFileSync(CSS, [
    '/*',
    ' * Czcionki aplikacji, hostowane lokalnie (Main_Front-End/fonts/). WYGENEROWANE: node narzedzia/pobierz-czcionki.js',
    ' * Żadna strona nie łączy się już z Google Fonts, więc adres IP czytającego nie trafia do Google (rada 12.11.2026).',
    ' * Figtree, Bricolage Grotesque, Plus Jakarta Sans, Literata, Fredoka: SIL Open Font License 1.1 (fonts/OFL.txt).',
    ' * W React Native: te same pliki przez expo-font.',
    ' */',
    ...blocks, '',
  ].join('\n'));
  console.log(`razem ${(total / 1024).toFixed(0)} kB, ${blocks.length} plików → ${path.relative(process.cwd(), CSS)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
