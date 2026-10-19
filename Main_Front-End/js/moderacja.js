/*
 * Moderacja wpisów — WERSJA DEMO (lista słów i wzorów).
 *
 * Docelowo wpisy na blogu i komentarze sprawdzi model AI po stronie serwera (np. Edge Function `moderate-post`
 * w Supabase), bo lista słów łatwo się myli: nie rozumie kontekstu („kiedyś chciałem się zabić, dziś jest lepiej”
 * to historia wyjścia z kryzysu, a nie kryzys), nie łapie ironii ani nowych słów. Ten plik pokazuje tylko,
 * JAK to ma wyglądać w aplikacji — i ma to samo API, które potem zwróci serwer.
 *
 * Kolejność ważności:
 *   'kryzys'     myśli samobójcze / samookaleczenie → wpis NIE idzie publicznie, pokazujemy wsparcie i 116 111
 *   'obrazliwe'  wulgaryzmy, wyzwiska, groźby, „zabij się” → wpis do poprawy, zaznaczamy fragmenty
 *   'dane'       numer telefonu, e-mail, @nick → blog jest anonimowy, prosimy o usunięcie
 *   'ok'         można publikować
 *
 * window.Moderacja:
 *   check(text) → { verdict, hits: [{ start, end, kind }] }   (start/end — pozycje w oryginalnym tekście)
 *   mark(text, hits) → HTML z <mark> na znalezionych fragmentach (tekst bezpiecznie escapowany)
 */
(function () {
  'use strict';

  // ---------- Normalizacja 1:1 (ta sama długość, żeby pozycje pasowały do oryginału) ----------
  const MAP = {
    ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
    0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i',
  };
  const norm = text => [...text.toLowerCase()].map(c => MAP[c] || c).join('');

  // Litera może się powtarzać („kuuurwa”), więc każda litera wzoru dostaje „+”
  const stretch = word => word.replace(/[a-z]/g, c => c + '+');
  const words = (list, kind, edges = true) => list.map(w => ({
    kind,
    re: new RegExp((edges ? '(?<![a-z])' : '') + stretch(w) + '[a-z]*', 'g'),   // zaznaczamy całe słowo
  }));
  const B = '(?<![a-z])', E = '(?![a-z])';

  const RULES = [
    // ---------- kryzys ----------
    ...[
      `${B}(zabi(c|je|ja|jesz)|zabil(a|bym|abym)?) ?sie`,
      `${B}sie ?zabi(c|je|ja)`,
      `${B}(chce|chcialbym|chcialabym|wolal(a)?bym) ?(juz )?umrzec`,
      `${B}nie ?chce ?(mi sie )?(juz )?zyc`,
      `${B}nie ?ma ?sensu ?zyc`,
      `${B}samoboj\\w*`,
      `${B}(pociac|pocielam|pocialem|ciac|tne|tniesz) ?sie`,
      `${B}sie ?(pociac|potne|ciac|tne|okaleczyc|okaleczam)${E}`,
      `${B}samookalecz\\w*`,
      `${B}skoncz(e|yc|yla|yl) ?ze ?soba`,
      `${B}powies(ic|ze) ?sie`,
      `${B}odebrac ?sobie ?zycie`,
      `${B}(lepiej|latwiej) ?(by bylo )?(gdyby|zeby) ?mnie ?nie ?bylo`,
      `${B}kms${E}`,
    ].map(src => ({ kind: 'kryzys', re: new RegExp(src, 'g') })),

    // ---------- obraźliwe: groźby i „zabij się” do kogoś (ważniejsze niż same przekleństwa) ----------
    ...[
      `${B}zabij ?sie`,
      `${B}(zabije|zajebie|zatluke|pobije) ?(cie|was|go|ja)${E}`,
      `${B}zdychaj\\w*`,
      `${B}(nienawidze|jebac) ?(was|cie|wszystkich)`,
      `${B}jestes ?(nikim|zerem|smieciem)`,
    ].map(src => ({ kind: 'obrazliwe', re: new RegExp(src, 'g') })),

    // ---------- obraźliwe: wulgaryzmy i wyzwiska (rdzenie) ----------
    ...words(['jeb', 'pierdol', 'kurw', 'chuj', 'huj', 'pizd', 'spierdal', 'wypierdal', 'debil', 'kretyn', 'idiot', 'cwel', 'dziwk', 'frajer'], 'obrazliwe', false),
    ...[`${B}cip(a|y|ie|o|ka)${E}`, `${B}szmat(a|o|y)${E}`, `${B}ciot(a|o|y)${E}`].map(src => ({ kind: 'obrazliwe', re: new RegExp(src, 'g') })),

    // ---------- dane kontaktowe ----------
    // (szukane w tekście bez normalizacji — cyfry i @ muszą zostać sobą)
    { kind: 'dane', raw: true, re: /(\+?48[ -]?)?(?<!\d)\d{3}[ -]?\d{3}[ -]?\d{3}(?!\d)/g },
    { kind: 'dane', raw: true, re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g },
    { kind: 'dane', raw: true, re: /(^|\s)@[a-z0-9_.]{3,}/g },
  ];
  const ORDER = ['kryzys', 'obrazliwe', 'dane'];

  function check(text) {
    const raw = (text || '').toLowerCase();
    const n = norm(text || '');
    const hits = [];
    for (const rule of RULES) {
      const { kind, re } = rule, t = rule.raw ? raw : n;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(t))) {
        let start = m.index, end = m.index + m[0].length;
        while (start < end && /\s/.test(t[start])) start++;      // bez spacji na początku (@nick)
        if (!hits.some(h => start < h.end && end > h.start)) hits.push({ start, end, kind });
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    hits.sort((a, b) => a.start - b.start);
    const verdict = ORDER.find(k => hits.some(h => h.kind === k)) || 'ok';
    return { verdict, hits };
  }

  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function mark(text, hits) {
    let out = '', at = 0;
    for (const h of hits) {
      out += esc(text.slice(at, h.start)) + `<mark class="mod-mark is-${h.kind}">${esc(text.slice(h.start, h.end))}</mark>`;
      at = h.end;
    }
    return out + esc(text.slice(at));
  }

  window.Moderacja = { check, mark };
})();
