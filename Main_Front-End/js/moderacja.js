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
 * OSOBNO: słowa o krzywdzie (13.11.2026, uwaga psychologa z rady, notes/rada-uwagi.md punkt 14). „Tata mnie bije”
 * to nie myśli samobójcze, więc dawniej przechodziło bez żadnej reakcji. Teraz check() zwraca też `krzywda: true`
 * (bicie, znęcanie się, strach przed domem, zły dotyk). To NIE jest werdykt: niczego nie blokuje i nie zmienia
 * `verdict` ani `hits`, więc blog działa jak wcześniej. Notatka z podlewania, Skrytka i Asystent pokazują wtedy kartę
 * wsparcia (krzywdaCard): „to nigdy nie jest Twoja wina”, 116 111 i 112. Tekst karty pochodzi z karty „trudny dom”
 * w Trackerze (js/wnioski-dane.js, `rodzina_ciezko`) i czeka na zatwierdzenie przez psychologa.
 * Lista słów łapie tylko proste zdania; docelowo robi to model po stronie serwera.
 *
 * window.Moderacja:
 *   check(text) → { verdict, hits: [{ start, end, kind }], krzywda }   (start/end — pozycje w oryginalnym tekście)
 *   mark(text, hits) → HTML z <mark> na znalezionych fragmentach (tekst bezpiecznie escapowany)
 *   KRZYWDA → { title, text } karty wsparcia; krzywdaCard({ id, hidden }) → jej znaczniki (klasy z css/app.css)
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

  // ---------- krzywda: ktoś robi krzywdę piszącemu (osobno od werdyktu, patrz opis na górze pliku) ----------
  const BIJE = '(bije|bija|bil|bila|bili|pobil|pobila|pobili|uderzyl|uderzyla|uderzyli|uderza|leje|lal|kopie|kopnal|kopnela|dusi|dusil|dusila|szarpie|szarpal|szarpala|katuje|krzywdzi|krzywdza|skrzywdzil|skrzywdzila|molestuje|molestowal|zgwalcil|obmacuje|obmacywal)';
  const DOTYK = '(dotyka|dotykal|dotykala)', GDZIE = '(tam|po|pod|miedzy|w\\s+miejsc\\w*)';
  const HARM = [
    `${B}${BIJE}\\s+mnie${E}`,
    `${B}mnie\\s+(znowu\\s+|ciagle\\s+|czesto\\s+|wczoraj\\s+|dzis\\s+)?${BIJE}${E}`,
    `${B}znec\\w*\\s+sie\\s+nade?\\s+mna`,
    `${B}nade?\\s+mna\\s+sie\\s+znec\\w*`,
    `${B}przemoc\\w*\\s+(w\\s+)?(domu|domow\\w*|rodzin\\w*)`,
    `${B}(domu|rodzinie)\\s+(jest\\s+|byla\\s+|panuje\\s+)?przemoc`,
    `${B}robi(a)?\\s+mi\\s+krzywde`,
    `${B}boje\\s+sie\\s+(wracac|wrocic|isc|byc)\\s+(do|w)\\s+domu`,
    `${B}boje\\s+sie\\s+(taty|ojca|ojczyma|mamy|matki|macochy|brata|wujka|dziadka)${E}`,
    `${B}nie\\s+(chce|moge)\\s+(wracac|wrocic)\\s+do\\s+domu`,
    `${B}(uciekne|uciec|ucieklam|ucieklem|uciekam)\\s+z\\s+domu`,
    `${B}(wyrzucil|wyrzucila|wyrzucili|wyrzuca|wyrzucaja)\\s+mnie\\s+z\\s+domu`,
    `${B}${DOTYK}\\s+mnie\\s+${GDZIE}${E}`,
    `${B}mnie\\s+${DOTYK}\\s+${GDZIE}${E}`,
    `${B}(zly|niechciany)\\s+dotyk`,
    `${B}molest\\w*`,
    `${B}z?gwalc\\w*`,
    `${B}gwalt(u|em|y|ow)?${E}`,
  ].map(src => new RegExp(src));
  // Tekst karty: do zatwierdzenia przez psychologa (notes/rada-uwagi.md, punkt 17). Numery: 116 111 i 112, jak w SOS.
  const KRZYWDA = {
    title: 'To nigdy nie jest Twoja wina.',
    text: 'Jeśli ktoś Cię krzywdzi, straszy albo boisz się wracać do domu, nie musisz dźwigać tego w pojedynkę. Pod 116 111 możesz o tym powiedzieć anonimowo, o każdej porze. Gdy coś Ci grozi teraz, dzwoń pod 112.',
  };
  const PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6A2 2 0 0 1 18.4 19 15 15 0 0 1 5 5.6a2 2 0 0 1 1.6-2.1z"/></svg>';
  const krzywdaCard = ({ id = '', hidden = true } = {}) => `
    <section class="ci-alert is-krzywda"${id ? ` id="${id}" aria-live="polite"` : ''}${hidden ? ' hidden' : ''}>
      <p class="support-title">${KRZYWDA.title}</p>
      <p class="support-text">${KRZYWDA.text}</p>
      <a class="support-call" href="tel:116111">${PHONE}Zadzwoń: 116 111 <small>całą dobę, za darmo</small></a>
      <a class="support-call" href="tel:112">${PHONE}Coś Ci grozi teraz: 112</a>
    </section>`;

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
    return { verdict, hits, krzywda: HARM.some(re => re.test(n)) };
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

  window.Moderacja = { check, mark, KRZYWDA, krzywdaCard };
})();
