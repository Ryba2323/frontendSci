/*
 * Testy (zakładka „Testy”): WHO-5 (samopoczucie) i Big Five IPIP-BFM-20 (osobowość).
 * Treść pytań, skale i opisy wyników: js/testy-dane.js (dane osobno od znaczników).
 *
 * Zakładka, od góry:
 *   1. Zgoda — testy widać od razu; o zgodę na dane o samopoczuciu (js/zgody.js) pytamy dopiero po „Zacznij”,
 *      arkuszem z js/konto.js (13.11.2026, uwaga rady: karta zgody zasłaniała testy). Po zgodzie test otwiera się sam.
 *      Tylko „czekamy na zgodę opiekuna” zostaje kartą na górze, bo wtedy nie ma czego stuknąć.
 *   2. Pole koloru (jedno na ekran): ostatni wynik samopoczucia z małą historią słupków albo zaproszenie do pierwszego testu.
 *   3. Karta „Osobowość”: pięć cech jako suwaki między dwoma końcami (żaden nie jest lepszy) albo zaproszenie.
 *   4. Historia: każde podejście; stuknięcie pokazuje wynik dokładnie tak, jak wyglądał tamtego dnia.
 *   5. „Konto i prywatność” (js/konto.js) i usuwanie historii.
 *
 * Przebieg testu (ekran jak podlewanie: wyrasta kołem z przycisku, css/app.css .ci-overlay):
 *   wstęp → jedno zdanie na ekran, stuknięcie w odpowiedź przechodzi dalej (ostatnie czeka na „Zobacz wynik”) → wynik.
 *   Pytań nie da się pominąć (wynik potrzebuje wszystkich), ale test można zamknąć w każdej chwili — nic się wtedy nie zapisuje.
 *
 * Bezpieczeństwo (notes/CLAUDE.md): wynik WHO-5 28% i mniej → ZAWSZE wsparcie (Asystent, 116 111, bliskie osoby);
 * poniżej 50% łagodna podpowiedź i Asystent. Słowa wyniku to podpowiedź, nigdy diagnoza. SOS jest w pasku testu.
 *
 * Odstęp między podejściami (WHO-5: 7 dni, Big Five: 30 dni) to nie kara: test pyta o dłuższy czas, więc częściej nie ma sensu.
 *
 * PROTOTYP: wyniki leżą w localStorage (`sci.testy`) w kształcie tabel `test_sessions` + `test_answers` + `test_scores`:
 *   { id, questionnaireId, code, completedAt, answers: [..], scores: [{ scale, raw, scaled, band }], supportShown, consentId }
 * Wynik liczy tu TestyDane.score(); docelowo liczy go serwer — TODO backend: supabase.rpc('submit_test', { p_code, p_answers }),
 * historia z widoku `test_history`, usuwanie przez rpc('delete_test_results').
 *
 * window.Testy:
 *   open(code, from)      otwiera test (albo prośbę o zgodę)
 *   sessions()            kopia historii (eksport danych w js/konto.js)
 *   count                 liczba zapisanych wyników
 *   deleteAll()           usuwa całą historię testów
 * W React Native: lista = ekran (tabs)/testy.tsx, przebieg i wynik = modal Expo Router, dane z TanStack Query.
 */
(function () {
  'use strict';

  const root = document.getElementById('testy-root');
  const Dane = window.TestyDane, Zgody = window.Zgody;
  if (!root || !Dane || !Zgody) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { toast, haptic, account } = window.AuthCommon;
  const view = new URLSearchParams(location.search).get('widok');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!view;
  const KEY = 'sci.testy';
  const DAY = 864e5;

  const acc = account.load() || {};
  const form = ['f', 'm', 'n'].includes(acc.form) ? acc.form : 'n';
  // dopisek „test powstał dla osób od 16 lat” pokazujemy także wtedy, gdy wieku nie znamy (brak konta)
  const under16 = !acc.age || /^1[3-5]$/.test(String(acc.age));
  // Test z `validatedFromAge` (Big Five: 16) jest dla młodszych ZAMKNIĘTY (13.11.2026, decyzja Marcela po uwadze psychologa
  // z rady: narzędzie badano na osobach 16–83 lata). Dotyczy kont ze znanym wiekiem 13–15; wersja pokazowa bez konta
  // zostaje otwarta z dopiskiem. To samo sprawdza baza w submit_test (notes/supabase-testy.sql).
  const tooYoung = t => !!(t && t.validatedFromAge && acc.age && Number.parseInt(acc.age, 10) < t.validatedFromAge);

  // ================================================================
  //  Pamięć
  // ================================================================
  let sessions = null;
  function load() {
    if (sessions) return sessions;
    if (view) { sessions = demoSessions(); return sessions; }
    try { sessions = JSON.parse(localStorage.getItem(KEY)); } catch (_) { sessions = null; }
    if (!Array.isArray(sessions)) sessions = [];
    // wyniki kwestionariuszy, których już nie znamy, pomijamy (nie da się ich pokazać)
    sessions = sessions.filter(s => Dane.byId(s.questionnaireId));
    return sessions;
  }
  function save() {
    if (view) return;
    try { localStorage.setItem(KEY, JSON.stringify(sessions)); } catch (_) { /* tryb prywatny, brak miejsca */ }
  }
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  function makeSession(test, answers, when) {
    const scores = Dane.score(test, answers);
    const consent = Zgody.state('health_data').row;
    return {
      id: uid(), questionnaireId: test.id, code: test.code, completedAt: (when || new Date()).toISOString(),
      answers: answers.slice(), scores,
      supportShown: scores.some(sc => !!(Dane.bandOf(test, sc.scale, sc.band) || {}).wsparcie),
      consentId: consent ? consent.id : null,
    };
  }

  // Dane przykładowe do widoku statycznego (zrzuty ekranu, podgląd dla zespołu)
  function demoSessions() {
    const ago = d => new Date(Date.now() - d * DAY);
    const who = Dane.byCode('who5'), ipip = Dane.byCode('ipip20');
    return [
      makeSession(who, [2, 2, 3, 2, 2], ago(38)),
      makeSession(who, [3, 2, 3, 2, 3], ago(24)),
      makeSession(ipip, [2, 2, 4, 4, 3, 2, 4, 4, 5, 3, 1, 3, 4, 2, 2, 4, 3, 3, 4, 5], ago(20)),
      makeSession(who, [3, 3, 3, 3, 3], ago(10)),
      makeSession(who, [4, 3, 3, 2, 4], ago(3)),
    ];
  }

  const byCode = code => load().filter(s => s.code === code).sort((a, b) => a.completedAt < b.completedAt ? -1 : 1);
  const lastOf = code => { const l = byCode(code); return l[l.length - 1] || null; };

  // ================================================================
  //  Daty i słowa
  // ================================================================
  const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const daysAgo = iso => Math.round((startOfDay(new Date()) - startOfDay(iso)) / DAY);
  const dateLong = iso => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateDay = iso => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
  const dateShort = iso => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }).replace('.', '');
  function ago(iso) {
    const d = daysAgo(iso);
    if (d <= 0) return 'dziś';
    if (d === 1) return 'wczoraj';
    if (d < 14) return `${d} dni temu`;
    return dateShort(iso);
  }
  // kiedy można powtórzyć test: dzień ostatniego podejścia + odstęp (tak samo liczy baza)
  function nextDate(test) {
    const last = lastOf(test.code);
    if (!last || !test.minIntervalDays) return null;
    const d = startOfDay(last.completedAt);
    d.setDate(d.getDate() + test.minIntervalDays);
    return d;
  }
  const canTake = test => { const d = nextDate(test); return !d || d <= startOfDay(new Date()) || unlocked.has(test.code); };
  const unlocked = new Set();            // PROTOTYP: „zrób teraz” mimo odstępu (do testów z zespołem)
  const pct = v => Math.round(v);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ================================================================
  //  Znaczniki (komponenty)
  // ================================================================
  const svg = (paths, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ARROW = svg('<path d="M5 12h14M13 6l6 6-6 6"/>');
  const CHEV = svg('<path d="M9 6l6 6-6 6"/>', 'tst-chev');
  const CHECK = svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>');
  const PHONE = '<path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6A2 2 0 0 1 18.4 19 15 15 0 0 1 5 5.6a2 2 0 0 1 1.6-2.1z"/>';
  const LEAF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21C3.5 10.5 10 4 21 3c-.5 11-7 18-16 18z"/></svg>';

  // ---------- Zgoda ----------
  function consentCard() {
    const st = Zgody.state('health_data');
    if (st.pendingGuardian) {
      return `
      <section class="insight tst-consent" style="--i:0" aria-labelledby="tst-consent-title">
        <h3 id="tst-consent-title">Czekamy na zgodę opiekuna</h3>
        <p>Masz mniej niż 16 lat, więc wyniki testów możemy zapisywać dopiero po zgodzie opiekuna. Wysłaliśmy prośbę${acc.parentEmail ? ` na adres <b>${esc(acc.parentEmail)}</b>` : ''}. Nic nie przepadnie.</p>
        <!-- PROTOTYP: zgody opiekuna nie ma jeszcze kto potwierdzić -->
        <button type="button" class="tst-proto" data-tst-guardian>Wersja testowa: opiekun potwierdził</button>
      </section>`;
    }
    return '';
  }

  // ---------- Pole koloru: samopoczucie ----------
  function lockLine(test) {
    const d = nextDate(test);
    return `
      <p class="tst-lock">Kolejny raz od ${dateDay(d)}. ${test.code === 'who5' ? 'Test pyta o dwa tygodnie, więc częściej nic nowego nie pokaże.' : 'Cechy zmieniają się powoli.'}</p>
      <button type="button" class="tst-proto" data-tst-unlock="${test.code}">Wersja testowa: zrób teraz</button>`;
  }

  // Wsparcie zostaje na wierzchu także na liście, gdy świeży wynik (do 14 dni) był w najniższym przedziale
  function tabSupport() {
    const last = lastOf('who5');
    if (!last || daysAgo(last.completedAt) > 14) return '';
    const band = Dane.bandOf(Dane.byId(last.questionnaireId), last.scores[0].scale, last.scores[0].band);
    return band && band.wsparcie ? supportHTML(true, 'tst-tab-support') : '';
  }

  function heroWho5(test, locked) {
    const list = byCode(test.code);
    const last = list[list.length - 1];
    if (!last) {
      return `
      <section class="tr-sec week-sum tst-hero is-empty" aria-labelledby="tst-hero-title">
        <p class="kicker" id="tst-hero-title">${test.title}</p>
        <p class="tst-hero-q">${test.lead}</p>
        <p class="sum-sub">${test.kicker}</p>
        <button type="button" class="tst-btn-light" data-test="${test.code}"${locked ? ' disabled' : ''}>Zacznij${ARROW}</button>
      </section>`;
    }
    const sc = last.scores[0];
    const band = Dane.bandOf(Dane.byId(last.questionnaireId), sc.scale, sc.band);
    const shown = list.slice(-7);
    const strip = shown.map((s, i) => {
      const v = s.scores[0].scaled;
      return `<span class="sum-day${s === last ? ' is-today' : ''}" style="--v:${Math.max(.08, v / 100).toFixed(2)};--k:${i}"><b>${pct(v)}</b><i></i><small>${dateShort(s.completedAt)}</small></span>`;
    }).join('');
    const label = 'Wyniki: ' + shown.map(s => `${dateDay(s.completedAt)} ${pct(s.scores[0].scaled)} procent`).join(', ');
    // Wynik w paśmie wsparcia: bez wielkiej liczby i opadłych słupków, które przez dwa tygodnie wyglądałyby jak ocena
    // (uwaga rady, 12.11.2026). Zostaje zdanie i wejście do wyniku; karta wsparcia jest tuż pod spodem (tabSupport).
    if (band && band.wsparcie) {
      return `
      <section class="tr-sec week-sum tst-hero" aria-labelledby="tst-hero-title">
        <p class="kicker" id="tst-hero-title">Twoje samopoczucie</p>
        <p class="tst-hero-q">${band.title}</p>
        <p class="sum-sub">Test z ${dateDay(last.completedAt)}. To sygnał, nie ocena.</p>
        <div class="tst-hero-foot">
          <button type="button" class="tst-btn-light" data-session="${last.id}">Zobacz wynik</button>
          ${canTake(test) ? `<button type="button" class="tst-btn-ghost" data-test="${test.code}">Zrób ponownie</button>` : ''}
        </div>
        ${canTake(test) ? '' : lockLine(test)}
      </section>`;
    }
    return `
      <section class="tr-sec week-sum tst-hero" aria-labelledby="tst-hero-title">
        <p class="kicker" id="tst-hero-title">Twoje samopoczucie</p>
        <p class="sum-head"><b>${pct(sc.scaled)}</b><span>% · ${ago(last.completedAt)}</span></p>
        ${shown.length > 1 ? `<div class="sum-strip tst-strip" style="--n:${shown.length}" role="img" aria-label="${label}">${strip}</div>` : ''}
        <p class="sum-sub">${band ? band.title : ''}</p>
        <div class="tst-hero-foot">
          <button type="button" class="tst-btn-light" data-session="${last.id}">Zobacz wynik</button>
          ${canTake(test) ? `<button type="button" class="tst-btn-ghost" data-test="${test.code}">Zrób ponownie</button>` : ''}
        </div>
        ${canTake(test) ? '' : lockLine(test)}
      </section>`;
  }

  // ---------- Karta: osobowość ----------
  // czytnik ekranu słyszy stronę skali, nie liczbę („Wyobraźnia: 25 na 100” brzmiałoby jak ocena)
  const side = (scale, v) => (v < 34 ? `bliżej „${scale.lowLabel}”` : v >= 67 ? `bliżej „${scale.highLabel}”` : `pośrodku między „${scale.lowLabel}” a „${scale.highLabel}”`);
  const poleBar = (scale, sc) => `
    <span class="tst-pole" role="img" aria-label="${scale.name}: ${side(scale, sc.scaled)}"><i style="--v:${(sc.scaled / 100).toFixed(3)}"></i></span>
    <span class="tst-ends" aria-hidden="true"><small>${scale.lowLabel}</small><small>${scale.highLabel}</small></span>`;

  function cardIpip(test, locked) {
    const last = lastOf(test.code);
    const young = tooYoung(test);
    if (!last) {
      return `
      <li class="insight tst-card" style="--i:1">
        <p class="insight-tag">${test.kicker}</p>
        <h3>${test.title}</h3>
        <p>${test.lead}</p>
        ${young
          ? `<p class="tst-lock">Ten test jest dla osób od ${test.validatedFromAge} lat, bo tylko na nich był sprawdzany. Poczeka tu na Ciebie.</p>`
          : `<button type="button" class="btn-soft tst-btn" data-test="${test.code}"${locked ? ' disabled' : ''}>Zacznij${ARROW}</button>`}
      </li>`;
    }
    const t = Dane.byId(last.questionnaireId);
    return `
      <li class="insight tst-card" style="--i:1">
        <p class="insight-tag">${test.title} · ${ago(last.completedAt)}</p>
        <h3>Twoje pięć cech</h3>
        <ul class="tst-mini">${last.scores.map(sc => { const s = Dane.scaleOf(t, sc.scale); return `<li><b>${s.name}</b>${poleBar(s, sc)}</li>`; }).join('')}</ul>
        <div class="tst-card-foot">
          <button type="button" class="btn-soft tst-btn" data-session="${last.id}">Zobacz opis${ARROW}</button>
          ${canTake(test) && !young ? `<button type="button" class="tst-btn-text" data-test="${test.code}">Zrób ponownie</button>` : ''}
        </div>
        ${young ? '' : canTake(test) ? '' : lockLine(test)}
      </li>`;
  }

  // ---------- Historia ----------
  let showAll = false;
  function historyBlock() {
    const all = load().slice().sort((a, b) => a.completedAt < b.completedAt ? 1 : -1);
    if (!all.length) return '';
    const list = showAll ? all : all.slice(0, 5);
    return `
      <h2 class="sub-title" id="tst-hist-title">Historia</h2>
      <ul class="tst-history" aria-labelledby="tst-hist-title">${list.map(s => {
        const t = Dane.byId(s.questionnaireId);
        const val = s.code === 'who5' ? `${pct(s.scores[0].scaled)}%` : `${s.scores.length} cech`;
        return `<li><button type="button" class="tst-hrow" data-session="${s.id}">
          <span class="tst-hdate">${dateShort(s.completedAt)}</span>
          <span class="tst-hname">${t.title}</span>
          <b>${val}</b>${CHEV}
        </button></li>`;
      }).join('')}</ul>
      ${all.length > list.length ? `<button type="button" class="tst-btn-text" data-tst-all>Pokaż wszystkie (${all.length})</button>` : ''}`;
  }

  // ================================================================
  //  Zakładka
  // ================================================================
  function render() {
    const ok = Zgody.has('health_data');
    const waiting = Zgody.state('health_data').pendingGuardian;     // tylko wtedy testy są wyszarzone
    const who = Dane.byCode('who5'), ipip = Dane.byCode('ipip20');
    const n = load().length;
    root.innerHTML = `
      ${consentCard()}
      <div class="tst-body${waiting ? ' is-locked' : ''}">
        ${heroWho5(who, waiting)}
        ${ok ? tabSupport() : ''}
        <ul class="tr-list tst-list">${cardIpip(ipip, waiting)}</ul>
        ${ok ? historyBlock() : ''}
      </div>
      <div class="tst-foot">
        <button type="button" class="tst-btn-text" data-konto>Konto i prywatność</button>
        ${n ? '<button type="button" class="tst-btn-text" data-tst-delete-all>Usuń historię testów</button>' : ''}
      </div>
      <p class="demo-note">Testy to podpowiedź, nie diagnoza. ${who.officialName}: © WHO 2024, ${who.licence}. ${ipip.officialName}: ${ipip.licence}.</p>`;
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tstAssist != null) { openAssistant(b); return; }
    if (b.dataset.tstGuardian != null) { Zgody.confirmGuardian(); toast('Opiekun potwierdził zgodę.'); return; }
    if (b.dataset.tstUnlock) { unlocked.add(b.dataset.tstUnlock); render(); return; }
    if (b.dataset.tstAll != null) { showAll = true; render(); return; }
    if (b.dataset.tstDeleteAll != null) { if (window.Konto) window.Konto.open('usun-historie'); return; }
    if (b.dataset.test) { open(b.dataset.test, b); return; }
    if (b.dataset.session) { openResult(b.dataset.session, b); }
  });

  // ================================================================
  //  Ekran testu (nakładka jak podlewanie)
  // ================================================================
  const flow = document.createElement('section');
  flow.className = 'ci-overlay tst-overlay';
  flow.id = 'test-flow';
  flow.setAttribute('role', 'dialog');
  flow.setAttribute('aria-modal', 'true');
  flow.setAttribute('aria-labelledby', 'tst-kicker');
  flow.hidden = true;
  flow.innerHTML = `
    <div class="ci tst">
      <header class="ci-top">
        <button type="button" class="ci-close" data-tst-close aria-label="Zamknij test">${svg('<path d="M6 6l12 12M18 6L6 18"/>')}</button>
        <p class="ci-kicker" id="tst-kicker">${LEAF}<span></span></p>
        <span class="ci-count" id="tst-count"></span>
        <!-- SOS zostaje pod ręką także w trakcie testu (arkusz SOS otwiera js/app.js przez [data-sos]) -->
        <button type="button" class="sos ci-sos" data-sos aria-haspopup="dialog">${svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>')}<span>SOS</span></button>
      </header>
      <div class="tst-progress" id="tst-progress" role="progressbar" aria-label="Postęp testu" aria-valuemin="0"><span><i></i></span></div>
      <section class="ci-main ci-step" id="tst-step"></section>
      <footer class="ci-actions">
        <button type="button" class="ci-back" id="tst-back">${svg('<path d="M19 12H5M11 6l-6 6 6 6"/>')}<span>Wstecz</span></button>
        <button type="button" class="btn-primary" id="tst-next"><span id="tst-next-label">Dalej</span>${ARROW}</button>
      </footer>
    </div>`;
  ($('#checkin') || document.body.lastElementChild).insertAdjacentElement('afterend', flow);

  const stepEl = $('#tst-step', flow), nextBtn = $('#tst-next', flow), nextLabel = $('#tst-next-label', flow), backBtn = $('#tst-back', flow);
  const progress = $('#tst-progress', flow);
  // stan: test, odpowiedzi, krok (-1 wstęp, 0..n-1 pytania, n wynik), a przy podglądzie historii — session
  let cur = null, isOpen = false, fromEl = null, lastFocus = null, advanceTimer = null;

  // ---------- kroki ----------
  function introHTML(t) {
    const n = t.questions.length;
    return `
      <h2 class="ci-q" id="tst-q" tabindex="-1">${t.lead}</h2>
      <p class="ci-hint">${t.instruction}</p>
      <ul class="tst-facts">
        <li>${svg('<path d="M4 6h16M4 12h16M4 18h10"/>')}<span><b>${n} zdań</b>, jedno na ekran. Stuknij odpowiedź.</span></li>
        <li>${svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>')}<span>${t.code === 'who5' ? 'Około minuty.' : 'Około 3 minut.'} Możesz przerwać w każdej chwili.</span></li>
        <li>${svg('<path d="M12 21v-9"/><path d="M12 12c0-4.2 3-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5z"/><path d="M12 14.5c0-3.2-2.4-5.2-6-5.2 0 3.2 2.4 5.2 6 5.2z"/>')}<span>To podpowiedź, nie diagnoza. Inni użytkownicy nie zobaczą wyniku.</span></li>
      </ul>
      ${t.validatedFromAge && under16 ? `<p class="tst-small">Ten test powstał z myślą o osobach od ${t.validatedFromAge} lat. Potraktuj wynik jako ciekawostkę o sobie.</p>` : ''}`;
  }

  function questionHTML(t, i) {
    const q = t.questions[i];
    const values = [];
    for (let v = t.answerMin; v <= t.answerMax; v++) values.push(v);
    if (t.answerOrder === 'desc') values.reverse();
    const chosen = cur.answers[i];
    const tabStop = chosen != null ? chosen : values[0];
    return `
      <p class="tst-stem">${t.stem}</p>
      <h2 class="ci-q tst-q" id="tst-q" tabindex="-1">${q.text[form]}</h2>
      <div class="tst-answers" role="radiogroup" aria-labelledby="tst-q">${values.map(v => `
        <button type="button" class="tst-answer" role="radio" aria-checked="${chosen === v}" tabindex="${v === tabStop ? 0 : -1}" data-v="${v}">
          <span class="tst-dot" aria-hidden="true"></span>${t.answerLabels[v - t.answerMin]}
        </button>`).join('')}
      </div>`;
  }

  // Wsparcie przy wyniku. `strong`: wynik 28% i mniej — pełna karta w ciepłym świetle, zawsze.
  // Kolejność (uwaga rady): najpierw ludzie — telefon zaufania i bliskie osoby — dopiero potem Asystent, który jest programem.
  const BLISCY = `<button type="button" class="support-call tst-call-btn" data-sos>${svg('<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>')}Twoje bliskie osoby i oddech</button>`;
  const supportHTML = (strong, cls = '') => `
    <section class="support is-low tst-support${cls ? ` ${cls}` : ''}" aria-label="Wsparcie">
      ${strong ? `<div class="support-low">
        <p class="support-title">Nie musisz być z tym w pojedynkę</p>
        <p class="support-text">Rozmowa z człowiekiem naprawdę może pomóc. Wybierz, co Ci teraz pasuje.</p>
      </div>` : ''}
      <a class="support-call" href="tel:116111">${svg(PHONE)}Zadzwoń: 116 111 <small>bezpłatnie, całą dobę</small></a>
      ${strong ? BLISCY : ''}
      <button type="button" class="assist-btn" data-tst-assist>
        <span class="assist-ico" aria-hidden="true">${svg('<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>')}</span>
        <span class="assist-text"><b>Porozmawiaj z Asystentem Wsparcia</b><small>Gdy chcesz pogadać</small></span>
        ${svg('<path d="M9 6l6 6-6 6"/>', 'assist-chev')}
      </button>
    </section>`;

  function resultHTML(s, fresh) {
    const t = Dane.byId(s.questionnaireId);
    const head = `<p class="tst-stem">${t.title} · ${dateLong(s.completedAt)}</p>`;
    const note = `<p class="tst-small">To podpowiedź, nie diagnoza. ${fresh ? 'Wynik zapisaliśmy w Twojej historii — usuniesz go, kiedy zechcesz.' : ''}</p>`;

    if (s.code === 'who5') {
      const sc = s.scores[0];
      const band = Dane.bandOf(t, sc.scale, sc.band);
      const list = byCode('who5');
      const prev = list[list.findIndex(x => x.id === s.id) - 1];
      let compare = '';
      if (prev) {
        const diff = pct(sc.scaled) - pct(prev.scores[0].scaled);
        // zmiana o 10 punktów to wyraźna różnica (WHO-5), mniejsze traktujemy jako „podobnie”
        compare = Math.abs(diff) >= 10
          ? `<p class="tst-compare">O <b>${Math.abs(diff)} ${diff > 0 ? 'więcej' : 'mniej'}</b> niż ${dateDay(prev.completedAt)} (${pct(prev.scores[0].scaled)}%).</p>`
          : `<p class="tst-compare">Podobnie jak ${dateDay(prev.completedAt)} (${pct(prev.scores[0].scaled)}%).</p>`;
      }
      // Drugi z rzędu wynik w paśmie wsparcia: dopisujemy zdanie o dorosłym, to samo co karta w Trackerze przy długo niskim
      // nastroju (js/wnioski.js). Propozycja psychologa z rady; tekst czeka na zatwierdzenie (notes/rada-uwagi.md, punkt 17).
      const prevBand = prev ? Dane.bandOf(Dane.byId(prev.questionnaireId), prev.scores[0].scale, prev.scores[0].band) : null;
      const longer = band.wsparcie && prevBand && prevBand.wsparcie
        ? '<p class="ci-hint tst-longer"><b>To drugi taki wynik z rzędu, więc to trwa już dłużej.</b> Warto powiedzieć o tym dorosłemu, któremu ufasz: rodzicowi, pedagogowi albo psychologowi w szkole.</p>' : '';
      return `${head}
        <p class="tst-score"><b>${pct(sc.scaled)}</b><span>%</span></p>
        <div class="tst-meter" role="img" aria-label="${pct(sc.scaled)} na 100"><i style="--v:${(sc.scaled / 100).toFixed(3)}"></i></div>
        <p class="tst-scale" aria-hidden="true"><span>0</span><span>wskaźnik samopoczucia z dwóch tygodni</span><span>100</span></p>
        <h2 class="ci-q tst-res-title" id="tst-q" tabindex="-1">${band.title}</h2>
        ${longer}
        <p class="ci-hint">${band.body}</p>
        ${band.wsparcie ? '' : compare}
        ${band.wsparcie ? supportHTML(true) : band.code === 'lower' ? supportHTML(false) : ''}
        ${note}`;
    }

    return `${head}
      <h2 class="ci-q" id="tst-q" tabindex="-1">Twoje pięć cech</h2>
      <p class="ci-hint">Żaden koniec skali nie jest lepszy. To obraz z dziś, nie etykieta, i z czasem się zmienia. Stuknij cechę, żeby przeczytać więcej.</p>
      <ul class="tst-traits">${s.scores.map(sc => {
        const scale = Dane.scaleOf(t, sc.scale), band = Dane.bandOf(t, sc.scale, sc.band);
        return `<li class="tst-trait"><details>
          <summary><span class="tst-trait-name">${scale.name}</span><b class="tst-trait-title">${band.title}</b>${poleBar(scale, sc)}</summary>
          <p>${band.body}</p>
        </details></li>`;
      }).join('')}</ul>
      ${t.validatedFromAge && under16 ? `<p class="tst-small">Ten test powstał z myślą o osobach od ${t.validatedFromAge} lat, więc potraktuj wynik jako ciekawostkę.</p>` : ''}
      ${note}`;
  }

  // ---------- rysowanie kroku ----------
  function paint(dir) {
    const t = cur.test, n = t.questions.length;
    const mode = cur.session ? 'result' : cur.step < 0 ? 'intro' : 'question';
    flow.dataset.mode = cur.session && !cur.fresh ? 'history' : mode;
    // wynik ze wsparciem: dolny przycisk nie jest przyklejony, żeby nie zasłaniał 116 111 (css/testy.css)
    if (mode === 'result' && cur.session.supportShown) flow.dataset.support = ''; else delete flow.dataset.support;
    $('#tst-kicker span', flow).textContent = t.title;
    $('#tst-count', flow).textContent = mode === 'question' ? `${cur.step + 1} z ${n}` : '';

    stepEl.innerHTML = mode === 'intro' ? introHTML(t) : mode === 'question' ? questionHTML(t, cur.step) : resultHTML(cur.session, cur.fresh);
    if (dir) {
      stepEl.classList.remove('from-left', 'from-right');
      void stepEl.offsetWidth;
      stepEl.classList.add(dir > 0 ? 'from-right' : 'from-left');
    }
    flow.scrollTop = 0;

    const done = mode === 'result' ? n : cur.answers.filter(v => v != null).length;
    progress.hidden = mode !== 'question';
    progress.setAttribute('aria-valuemax', n);
    progress.setAttribute('aria-valuenow', done);
    progress.style.setProperty('--p', (done / n).toFixed(3));

    backBtn.classList.toggle('is-hidden', mode !== 'question');
    backBtn.querySelector('span').textContent = cur.step === 0 ? 'Wstęp' : 'Wstecz';
    if (mode === 'intro') { nextLabel.textContent = 'Zaczynam'; nextBtn.disabled = false; }
    else if (mode === 'question') {
      nextLabel.textContent = cur.step === n - 1 ? 'Zobacz wynik' : 'Dalej';
      nextBtn.disabled = cur.answers[cur.step] == null;
    } else { nextLabel.textContent = cur.fresh ? 'Gotowe' : 'Zamknij'; nextBtn.disabled = false; }
    $('.ci-actions', flow).classList.toggle('has-delete', flow.dataset.mode === 'history');
  }

  function focusStep() {
    const h = $('#tst-q', flow);
    if (h) h.focus({ preventScroll: true });
  }

  function go(step, dir) {
    clearTimeout(advanceTimer);
    cur.step = step;
    paint(dir);
    focusStep();
  }

  function finish() {
    const t = cur.test;
    let s;
    try { s = makeSession(t, cur.answers); } catch (_) { toast('Odpowiedz na wszystkie zdania, żeby zobaczyć wynik.'); return; }
    load().push(s);
    save();
    unlocked.delete(t.code);
    cur.session = s;
    cur.fresh = true;
    haptic([10, 40, 14]);
    paint(1);
    focusStep();
    render();
  }

  // ---------- odpowiedzi ----------
  function choose(btn) {
    const v = Number(btn.dataset.v);
    cur.answers[cur.step] = v;
    $$('.tst-answer', stepEl).forEach(b => {
      const on = b === btn;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    haptic(6);
    const n = cur.test.questions.length;
    nextBtn.disabled = false;
    progress.style.setProperty('--p', (cur.answers.filter(x => x != null).length / n).toFixed(3));
    // jedno stuknięcie = odpowiedź i następne zdanie; ostatnie czeka na „Zobacz wynik”
    clearTimeout(advanceTimer);
    if (cur.step < n - 1) {
      const at = cur.step;
      advanceTimer = setTimeout(() => { if (isOpen && cur && cur.step === at) go(at + 1, 1); }, reduceMotion ? 120 : 340);
    } else nextBtn.focus({ preventScroll: true });
  }

  stepEl.addEventListener('click', e => {
    const a = e.target.closest('.tst-answer');
    if (a) { choose(a); return; }
    const as = e.target.closest('[data-tst-assist]');
    if (as) openAssistant(as);
  });
  // Asystent Wsparcia (js/asystent.js) wyrasta z przycisku
  function openAssistant(from) {
    if (window.Asystent) window.Asystent.open({ from, zrodlo: 'testy' });
    else toast('Asystent Wsparcia jest w przygotowaniu — tu otworzy się rozmowa.');
  }
  // grupa odpowiedzi: strzałki przesuwają fokus, spacja / Enter wybiera (jak przyciski opcji)
  stepEl.addEventListener('keydown', e => {
    const a = e.target.closest('.tst-answer');
    if (!a) return;
    const list = $$('.tst-answer', stepEl), i = list.indexOf(a);
    let j = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % list.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + list.length) % list.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = list.length - 1;
    if (j == null) return;
    e.preventDefault();
    list.forEach((b, k) => { b.tabIndex = k === j ? 0 : -1; });
    list[j].focus();
  });

  nextBtn.addEventListener('click', () => {
    haptic(10);
    const n = cur.test.questions.length;
    if (cur.session) { close(); return; }
    if (cur.step < n - 1) go(cur.step + 1, 1);
    else finish();
  });
  backBtn.addEventListener('click', () => go(cur.step - 1, -1));

  // ---------- usuwanie jednego wyniku (z „Cofnij”) ----------
  const undoBar = document.createElement('div');
  undoBar.className = 'toast tst-undo';
  undoBar.setAttribute('role', 'status');
  undoBar.innerHTML = '<span></span><button type="button">Cofnij</button>';
  document.body.appendChild(undoBar);
  let undoTimer = null, undoItem = null;
  function hideUndo() { clearTimeout(undoTimer); undoBar.classList.remove('show'); undoItem = null; }
  undoBar.querySelector('button').addEventListener('click', () => {
    if (!undoItem) return;
    load().push(undoItem);
    save();
    hideUndo();
    render();
    toast('Wynik wrócił do historii.');
  });
  function removeSession(id) {
    const i = load().findIndex(s => s.id === id);
    if (i < 0) return;
    // TODO backend: żądanie usunięcia wysyłamy dopiero, gdy „Cofnij” zniknie — w bazie usunięcie jest ostateczne
    undoItem = sessions.splice(i, 1)[0];
    save();
    render();
    undoBar.querySelector('span').textContent = 'Wynik usunięty.';
    undoBar.classList.add('show');
    clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndo, 6000);
  }
  // przycisk „Usuń ten wynik” w podglądzie historii (obok „Zamknij”)
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'ci-back tst-delete';
  delBtn.innerHTML = `${svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>')}<span>Usuń ten wynik</span>`;
  backBtn.insertAdjacentElement('afterend', delBtn);
  delBtn.addEventListener('click', () => {
    if (!cur || !cur.session) return;
    const id = cur.session.id;
    close();
    removeSession(id);
  });

  // ================================================================
  //  Otwieranie i zamykanie (koło z przycisku, jak podlewanie)
  // ================================================================
  function setOrigin(x, y) {
    const r = flow.getBoundingClientRect();
    const ox = x - r.left, oy = y - r.top;
    const far = Math.hypot(Math.max(ox, r.width - ox), Math.max(oy, r.height - oy));
    flow.style.setProperty('--ox', `${ox}px`);
    flow.style.setProperty('--oy', `${oy}px`);
    flow.style.setProperty('--or', `${Math.ceil(far) + 20}px`);
  }
  const centerOf = el => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };

  function show(state, from) {
    if (window.Checkin && window.Checkin.isOpen) window.Checkin.close();
    cur = state;
    fromEl = from && document.contains(from) ? from : null;
    lastFocus = document.activeElement;
    isOpen = true;
    flow.hidden = false;
    document.body.classList.add('ci-open');
    flow.classList.remove('is-closing');
    const [x, y] = fromEl ? centerOf(fromEl) : [window.innerWidth / 2, window.innerHeight];
    setOrigin(x, y);
    void flow.offsetWidth;
    flow.classList.add('is-open');
    stepEl.classList.remove('from-left', 'from-right');
    paint(0);
    setTimeout(() => { if (isOpen) $('[data-tst-close]', flow).focus({ preventScroll: true }); }, reduceMotion ? 0 : 320);
  }

  function open(code, from) {
    const t = Dane.byCode(code);
    if (!t || isOpen) return;
    if (location.hash !== '#/testy') location.hash = '#/testy';
    if (tooYoung(t)) { toast(`Ten test jest dla osób od ${t.validatedFromAge} lat.`); return; }
    if (!Zgody.has('health_data')) {
      // bez zgody nie zaczynamy. Czekamy na opiekuna → pokazujemy kartę z wyjaśnieniem; inaczej prosimy o zgodę arkuszem
      // (ten sam co po wycofaniu zgody) i pamiętamy, który test miał się otworzyć.
      const card = $('.tst-consent', root);
      if (card) { card.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }); return; }
      wanted = { code, at: Date.now() };
      if (window.Konto) window.Konto.open('zgoda');
      return;
    }
    if (!canTake(t)) { toast(`Kolejny raz od ${dateDay(nextDate(t))}.`); return; }
    show({ test: t, answers: Array(t.questions.length).fill(null), step: -1, session: null, fresh: false }, from);
  }

  function openResult(id, from) {
    const s = load().find(x => x.id === id);
    if (!s || isOpen) return;
    show({ test: Dane.byId(s.questionnaireId), answers: s.answers, step: 0, session: s, fresh: false }, from);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    clearTimeout(advanceTimer);
    if (fromEl && document.contains(fromEl)) setOrigin(...centerOf(fromEl));
    flow.classList.add('is-closing');
    flow.classList.remove('is-open');
    // podlewanie mogło w tym czasie się nie otworzyć, więc klasę zdejmujemy tylko, gdy to my ją trzymamy
    if (!(window.Checkin && window.Checkin.isOpen)) document.body.classList.remove('ci-open');
    setTimeout(() => { if (!isOpen) { flow.hidden = true; flow.classList.remove('is-closing'); stepEl.innerHTML = ''; } }, reduceMotion ? 0 : 720);   // = --dur-slow
    // po odświeżeniu listy przycisk, z którego wyszliśmy, jest już innym elementem — szukamy jego następcy
    const back = (lastFocus && document.contains(lastFocus) && lastFocus) || $('.tst-hero button, .tst-card button', root) || $('#testy-title');
    if (back) { if (!back.matches('button, a')) back.setAttribute('tabindex', '-1'); back.focus({ preventScroll: true }); }
    cur = null;
  }

  flow.addEventListener('click', e => { if (e.target.closest('[data-tst-close]')) close(); });
  document.addEventListener('keydown', e => {
    if (!isOpen || (window.Sheets && window.Sheets.current) || document.body.classList.contains('as-open')) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('a[href], button:not([disabled]), summary', flow).filter(el => el.offsetParent !== null && !el.classList.contains('is-hidden') && el.tabIndex !== -1);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  window.addEventListener('tabchange', () => { if (isOpen) close(); });

  // ================================================================
  //  Zgoda i usuwanie
  // ================================================================
  function deleteAll() {
    const n = load().length;
    sessions = [];
    save();
    hideUndo();
    showAll = false;
    render();
    return n;
  }
  // wycofanie zgody od razu usuwa wyniki (w bazie robi to wyzwalacz na user_consents)
  let wanted = null;      // test, o który ktoś poprosił, zanim dał zgodę
  window.addEventListener('consentchange', e => {
    if (e.detail.kind !== 'health_data') return;
    if (!e.detail.active && Zgody.state('health_data').withdrawn) { if (isOpen) close(); deleteAll(); return; }
    render();
    // zgoda dana przed chwilą w arkuszu po „Zacznij”: otwieramy ten test, gdy arkusz zdąży się schować
    const w = wanted;
    wanted = null;
    if (e.detail.active && w && Date.now() - w.at < 5 * 60e3) {
      setTimeout(() => { if (location.hash === '#/testy' && !(window.Sheets && window.Sheets.current)) open(w.code, $(`[data-test="${w.code}"]`, root)); }, reduceMotion ? 50 : 450);
    }
  });

  window.Testy = {
    open, deleteAll,
    sessions: () => load().map(s => JSON.parse(JSON.stringify(s))),
    get count() { return load().length; },
    get isOpen() { return isOpen; },
  };

  render();
})();
