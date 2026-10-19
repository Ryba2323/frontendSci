/*
 * Strona główna, wersja 2 — treść i interakcje.
 *
 * Zasady roślinki (opisane też na stronie w „Jak działa roślinka?”):
 *   • Każda z 7 odnóg to jeden z OSTATNICH 7 dni (okno przesuwa się codziennie o północy — nie ma resetu tygodnia).
 *   • Dzień z podlaniem → liść: im lepsze samopoczucie, tym większy i żywszy.
 *   • Dzień bez podlania → mały, uśpiony pąk. Roślinka nie więdnie i nie traci liści — nie karzemy za przerwę.
 *   • Dziś → pąk w przerywanym kółku, który rozwija się po podlaniu.
 *   • Kwiat jest otwarty przy co najmniej 3 podlaniach w ostatnich 7 dniach; inaczej zamyka się w pąk.
 *   • Bilans tygodnia = średnia tylko z dni z wpisem.
 *
 * Tydzień jest na razie LOSOWY (dane demonstracyjne), z jednym dniem bez podlania dla przykładu.
 * „Podlewanie” to codzienny wpis o samopoczuciu. W aplikacji (aplikacja.html) przycisk otwiera pytania
 * (js/checkin.js, window.Checkin), a po ostatnim roślinka dostaje deszcz. Bez pytań (strona-glowna-2.html) — sama animacja.
 * Roślinka: js/home2-scene.js (window.Home2Scene). Motyw: js/theme.js (window.Theme). Arkusze: js/sheets.js (window.Sheets).
 */
(function () {
  'use strict';

  const Scene = window.Home2Scene || { start() {}, water() {}, select() {} };
  const Theme = window.Theme || { list: [], current: null, apply() {} };
  const { toast, haptic, account } = window.AuthCommon;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);
  const isStatic = window.matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('widok');
  if (isStatic) document.documentElement.classList.add('is-static');

  const fmt = v => v.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  // ================================================================
  //  Profil (z rejestracji w tej przeglądarce albo demonstracyjny; w podglądzie zawsze demonstracyjny)
  // ================================================================
  const saved = params.has('widok') ? null : account.load();
  const nick = (saved && saved.nick) || 'Ola';
  const plant = saved ? saved.plant || '' : 'Mięta';

  const now = new Date();
  const h = now.getHours();
  const greet = h >= 5 && h < 12 ? 'Dzień dobry' : h >= 12 && h < 18 ? 'Cześć' : 'Dobry wieczór';
  const weekday = now.toLocaleDateString('pl-PL', { weekday: 'long' });
  $('#greet-date').textContent = `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${now.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}`;
  $('#greet-title').textContent = `${greet}, ${nick}!`;
  $('#plant-name').textContent = plant || 'Twoja roślinka';
  $('#plant-days').textContent = 'rośnie z Tobą od 24 dni · każde podlewanie to nowy listek';
  if (plant) $('#water-lead').textContent = `Kilka krótkich pytań o Twój dzień. Każda odpowiedź to kropla dla roślinki ${plant}.`;

  // ================================================================
  //  Ostatnie 7 dni (losowe) — ten sam zestaw danych dostaje roślinka
  //  wartość 1–10 = dzień z podlaniem, null = dzień bez podlania, ostatni element = dziś
  // ================================================================
  const DAY_LETTER = ['N', 'P', 'W', 'Ś', 'C', 'P', 'S'];
  const DAY_NAME = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  const base = rand(5.6, 8.2);
  const missedDay = 1 + Math.floor(Math.random() * 4);          // przykład dnia bez podlania
  const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - 6 + i); return d; });
  const days = dates.map((d, i) => (i === 6 || i === missedDay ? null : Math.round(clamp(base + rand(-2.2, 1.8), 2, 10))));
  const missed = days.map((v, i) => i < 6 && v == null);
  const labels = dates.map((d, i) => (i === 6 ? 'dziś' : DAY_LETTER[d.getDay()]));
  const names = dates.map((d, i) => (i === 6 ? 'Dziś' : DAY_NAME[d.getDay()]));

  const WORDS = [[8.5, 'Świetny tydzień'], [7, 'Całkiem dobrze'], [5.5, 'Nieźle'], [4, 'Tak sobie'], [0, 'Trudniejszy czas']];
  const MOOD_WORDS = ['', 'bardzo źle', 'bardzo źle', 'słabo', 'słabo', 'tak sobie', 'tak sobie', 'dobrze', 'dobrze', 'świetnie', 'świetnie'];
  function avg(list) {
    const rec = list.filter(v => v != null);
    return rec.length ? Math.round(rec.reduce((a, b) => a + b, 0) / rec.length * 10) / 10 : 0;
  }
  const prev = Math.round(clamp(avg(days) + rand(-1.2, .9), 3, 9.6) * 10) / 10;

  // Bilans tygodnia — liczony od nowa po podlaniu (dzisiejszy nastrój też się liczy)
  let todayMood = null;                                          // null = jeszcze nie podlano albo nastrój pominięty
  let score = 0;
  function renderScore() {
    const all = days.slice(0, 6).concat(todayMood);
    score = avg(all);
    const n = all.filter(v => v != null).length;
    $('#score-word').textContent = WORDS.find(([min]) => score >= min)[1];
    $('#meter').setAttribute('aria-label', `Ogólny bilans ostatnich 7 dni: ${fmt(score)} na 10. Tydzień wcześniej: ${fmt(prev)}.`);
    $('#meter-prev').style.left = `${prev * 10}%`;
    const diff = score - prev;
    $('#trend').innerHTML = `<b>${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))}</b> od zeszłego tygodnia · średnia z ${n} ${n === 1 ? 'dnia' : 'dni'} z podlaniem`;
  }
  renderScore();

  const daysEl = $('#days');
  daysEl.innerHTML = days.map((v, i) => {
    const today = i === 6, off = missed[i];
    const cls = today ? ' is-today' : off ? ' is-missed' : '';
    const aria = today ? 'Dziś — roślinka czeka na podlanie' : off ? `${names[i]}: bez podlania` : `${names[i]}: ${v} na 10`;
    const hgt = today ? .5 : off ? .18 : v / 10;
    const val = today ? '?' : off ? '–' : v;
    return `<button type="button" class="day${cls}" data-i="${i}" style="--v:${hgt};--k:${i}" aria-label="${aria}" aria-pressed="false"><b aria-hidden="true">${val}</b><i></i><span>${labels[i]}</span></button>`;
  }).join('');

  const detail = $('#day-detail');
  let watered = false;
  function showDay(i) {
    $$('.day', daysEl).forEach(b => {
      const on = +b.dataset.i === i;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    detail.textContent = i === 6
      ? (watered ? (todayMood ? `Dziś · ${todayMood}/10 · ${MOOD_WORDS[todayMood]}` : 'Dziś — roślinka podlana') : 'Dziś — roślinka czeka na podlanie')
      : missed[i]
        ? `${names[i]} · bez podlania — został uśpiony pąk, nic się nie stało`
        : `${names[i]} · ${days[i]}/10 · ${MOOD_WORDS[days[i]]}`;
  }
  daysEl.addEventListener('click', e => {
    const b = e.target.closest('.day');
    if (!b) return;
    const i = +b.dataset.i;
    showDay(i);
    Scene.select(i);
  });
  window.addEventListener('dayselect', e => showDay(e.detail.index));

  // Liczby, słupek i słupki dni ruszają, gdy sekcja wjedzie na ekran
  const scoreNum = $('#score-num');
  scoreNum.textContent = fmt(0);
  let counted = false;
  function countUp() {
    if (counted) return;
    counted = true;
    daysEl.classList.add('is-in');
    $('#meter-fill').style.width = `${score * 10}%`;
    if (isStatic) { scoreNum.textContent = fmt(score); return; }
    const t0 = performance.now() + 200, dur = 1300;
    const step = t => {
      const p = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
      scoreNum.textContent = fmt(score * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window && !isStatic) {
    const io = new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting)) { countUp(); io.disconnect(); }
    }, { threshold: .01 });
    io.observe($('#sec-week'));
  } else countUp();

  $('#quote').textContent = 'Nie musisz mieć dziś wszystkiego poukładanego. Wystarczy jeden mały krok.';

  // ================================================================
  //  Podlewanie: przycisk → pytania (js/checkin.js) → deszcz na roślince
  // ================================================================
  const waterBtn = $('#water-btn');
  let toastTimer, entry = null;

  function pour(e) {
    Scene.water(e && e.mood);
    waterBtn.classList.remove('is-pouring');
    void waterBtn.offsetWidth;
    waterBtn.classList.add('is-pouring');
    haptic([10, 30, 10]);
    // Na telefonie przewiń na górę, żeby było widać deszcz na roślince
    if (window.innerWidth < 1024 && window.scrollY > 0) window.scrollTo({ top: 0, behavior: isStatic ? 'auto' : 'smooth' });
    setTimeout(() => {
      watered = true;
      todayMood = e ? e.mood : null;
      const t = $('.day.is-today', daysEl);
      t.classList.add('is-watered');
      if (todayMood) t.style.setProperty('--v', todayMood / 10);
      $('b', t).textContent = todayMood || '✓';
      t.setAttribute('aria-label', todayMood ? `Dziś: ${todayMood} na 10` : 'Dziś — roślinka podlana');
      renderScore();
      if (counted) { $('#meter-fill').style.width = `${score * 10}%`; scoreNum.textContent = fmt(score); }
      if (e) showWatered(e);
      window.dispatchEvent(new CustomEvent('watered', { detail: e }));   // np. słoik dobrych chwil przy niskim nastroju
    }, 1000);
  }

  // Po podlaniu sekcja mówi, co zapisaliśmy, i pozwala zmienić wpis
  function showWatered(e) {
    $('#sec-water').classList.add('is-done');
    $('#water-title').textContent = 'Roślinka podlana';
    $('#water-lead').textContent = e.mood
      ? `Dziś: ${e.mood}/10 · ${MOOD_WORDS[e.mood]}. Dzięki, że o siebie dbasz. Wpis możesz jeszcze zmienić.`
      : 'Dzięki, że o siebie dbasz. Wpis możesz jeszcze zmienić.';
    $('#water-label').textContent = 'Zmień dzisiejszy wpis';
  }

  waterBtn.addEventListener('click', () => {
    if (window.Checkin) {
      window.Checkin.open({ from: waterBtn, entry, onDone(e) { entry = e; pour(e); } });
      return;
    }
    // bez pytań (strona-glowna-2.html): sama animacja
    pour(null);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast('W aplikacji tu otworzą się pytania o Twój dzień.'), 1400);
  });

  // ================================================================
  //  Arkusze od dołu (SOS, kolor roślinki) — js/sheets.js
  // ================================================================
  const Sheets = window.Sheets || { show() {}, hide() {} };
  $('#sos-open').addEventListener('click', () => Sheets.show($('#sos-sheet')));

  // ================================================================
  //  Kolor roślinki — ten sam wybór co w rejestracji, aktualny motyw zaznaczony
  // ================================================================
  const swatches = $('#swatches');
  swatches.innerHTML = Theme.list.map(t =>
    `<label class="swatch" data-palette="${t.id}"><input type="radio" name="theme" value="${t.id}"${t.id === Theme.current ? ' checked' : ''}><span><i></i>${t.name}</span></label>`).join('');
  swatches.addEventListener('change', e => {
    if (e.target.name !== 'theme') return;
    // w podglądzie (?motyw=… / ?widok=…) tylko podgląd, bez zapisywania
    const preview = params.has('motyw') || params.has('widok');
    Theme.apply(e.target.value, { save: !preview });
    if (!preview && saved) account.save({ ...saved, theme: e.target.value });
    haptic(8);
  });
  $('#color-open').addEventListener('click', () => {
    const cur = $(`input[value="${Theme.current}"]`, swatches);
    if (cur) cur.checked = true;
    Sheets.show($('#color-sheet'));
  });

  // ================================================================
  //  Start
  // ================================================================
  Scene.start({ days, labels, missed });
})();
