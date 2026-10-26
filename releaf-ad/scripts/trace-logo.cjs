// Obrys kształtów logo z oryginalnego PNG (tylko do animacji przejścia; w kadrze końcowym jest sam PNG).
const potrace = require('potrace');
const fs = require('fs');
const names = ['wingL', 'body', 'wingR'];
const out = {};
let left = names.length;
for (const n of names) {
  potrace.trace(`scripts/mask-${n}.png`, { turdSize: 50, optTolerance: 0.2, threshold: 128 }, (err, svg) => {
    if (err) throw err;
    const d = svg.match(/ d="([^"]+)"/)[1];
    out[n] = d.trim();
    if (--left === 0) {
      fs.writeFileSync('src/brand/logo-paths.ts',
        '// Obrys z public/brand/releaf-logo.png (1254×1254) — skrypt scripts/trace-logo.cjs. Nie edytować ręcznie.\n' +
        'export const LOGO_SIZE = 1254;\n' +
        `export const LOGO_PATHS = ${JSON.stringify(out, null, 2)} as const;\n`);
      console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
    }
  });
}
