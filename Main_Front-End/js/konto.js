/*
 * Konto i prywatność — arkusz z tym, co RODO daje osobie do ręki:
 *   • Twoje zgody: regulamin i polityka (wersja, data), zgoda na dane o samopoczuciu (art. 9) z wycofaniem,
 *   • Twoje dane: pobranie kopii (art. 15 i 20), usunięcie historii testów, usunięcie konta (art. 17),
 *   • dokumenty: regulamin.html, polityka-prywatnosci.html.
 *
 * Zasady:
 *   • Wycofanie zgody ma być tak łatwe jak jej udzielenie (art. 7 ust. 3): jeden przycisk, jedno potwierdzenie.
 *   • Potwierdzamy tylko to, czego nie da się cofnąć, i mówimy wprost, co zniknie, a co zostaje.
 *   • Bez straszenia i bez poczucia winy: roślinka nie znika przy wycofaniu zgody, a pożegnanie jest ciepłe.
 *   • Jedno wypełnione działanie na widok; usuwanie nie jest czerwone (motywy nie mają czerwieni), tylko wyraźnie nazwane.
 *
 * PROTOTYP: wszystko dzieje się w localStorage. TODO backend:
 *   wycofanie → supabase.rpc('withdraw_consent', { p_kind: 'health_data' }) (baza sama usuwa testy, podlewania i wnioski),
 *   historia → rpc('delete_test_results'), konto → Edge Function `delete-account` (rpc('delete_my_account') + pliki + wylogowanie),
 *   kopia danych → Edge Function `export-data`.
 *
 * Wejścia: każdy element z [data-konto] (opcjonalnie data-konto="wycofaj" | "usun-historie" | "usun-konto").
 * window.Konto.open(widok)
 * W React Native: ekran ustawień (Expo Router, modal) z tymi samymi krokami.
 */
(function () {
  'use strict';

  const Sheets = window.Sheets, Zgody = window.Zgody;
  if (!Sheets || !Zgody || !window.AuthCommon) return;

  const { toast, haptic, account } = window.AuthCommon;
  const view = new URLSearchParams(location.search).get('widok');
  const svg = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICO = {
    doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5v4h4M9.5 12h5M9.5 15.5h5"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    down: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const day = iso => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  const testCount = () => (window.Testy ? window.Testy.count : 0);
  const plural = n => (n === 1 ? 'wynik' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'wyniki' : 'wyników');

  const sheet = document.createElement('section');
  sheet.className = 'bsheet bsheet-tall kp';
  sheet.id = 'konto-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'kp-title');
  sheet.hidden = true;
  (document.getElementById('sos-sheet') || document.body.lastElementChild).insertAdjacentElement('afterend', sheet);

  // ================================================================
  //  Widoki
  // ================================================================
  const row = (icon, title, sub, attrs) => `
    <button type="button" class="sos-item kp-row" ${attrs}>
      <span class="sos-ico">${svg(icon)}</span>
      <span><b>${title}</b><small>${sub}</small></span>
      ${svg(ICO.chev)}
    </button>`;

  function main() {
    const acc = account.load();
    const terms = Zgody.state('terms'), health = Zgody.state('health_data');
    const D = Zgody.DOCS;
    const n = testCount();
    const healthLine = health.pendingGuardian ? 'Czeka na zgodę opiekuna'
      : health.active ? `Zgoda od ${day(health.row.givenAt)}`
      : health.withdrawn ? 'Zgoda wycofana — dane usunięte' : 'Brak zgody';
    return `
      <span class="grabber" aria-hidden="true"></span>
      <h2 class="sos-title" id="kp-title" tabindex="-1">Konto i prywatność</h2>
      <p class="sos-sub">${acc ? `${esc(acc.nick || 'Twoje konto')}${acc.email ? ` · ${esc(acc.email)}` : ''}` : 'Wersja pokazowa bez konta — dane zostają tylko w tej przeglądarce.'}</p>

      <p class="sheet-label" id="kp-l-zgody">Twoje zgody</p>
      <ul class="sos-list kp-list" aria-labelledby="kp-l-zgody">
        <li class="sos-item kp-static">
          <span class="sos-ico">${svg(ICO.doc)}</span>
          <span><b>Regulamin i polityka prywatności</b>
            <small>${terms.active ? `Zaakceptowane ${day(terms.row.givenAt)} · wersja ${terms.row.version}` : 'Do przeczytania przed założeniem konta'}</small>
          </span>
          <span class="kp-links"><a href="${D.terms.url}" target="_blank" rel="noopener">Regulamin</a><a href="${D.privacy.url}" target="_blank" rel="noopener">Polityka prywatności</a></span>
        </li>
        <li class="sos-item kp-static">
          <span class="sos-ico">${svg(ICO.heart)}</span>
          <span><b>Dane o samopoczuciu</b>
            <small>${healthLine}. Podlewania i wyniki testów.</small>
          </span>
          <span class="kp-links">${health.row
            ? '<button type="button" data-kp="wycofaj">Wycofaj zgodę</button>'
            : '<button type="button" data-kp="zgoda">Wyraź zgodę</button>'}</span>
        </li>
      </ul>

      <p class="sheet-label" id="kp-l-dane">Twoje dane</p>
      <ul class="sos-list kp-list" aria-labelledby="kp-l-dane">
        <li>${row(ICO.down, 'Pobierz moje dane', 'Kopia wszystkiego, co o Tobie zapisaliśmy', 'data-kp-do="eksport"')}</li>
        <li>${row(ICO.list, 'Usuń historię testów', n ? `${n} ${plural(n)} · zgoda zostaje` : 'Historia jest pusta', `data-kp="usun-historie"${n ? '' : ' disabled'}`)}</li>
        <li>${row(ICO.user, 'Usuń konto', 'Wszystkie Twoje dane znikną na zawsze', 'data-kp="usun-konto"')}</li>
      </ul>
      <button type="button" class="sos-close" data-close>Gotowe</button>`;
  }

  // jeden układ dla wszystkich potwierdzeń: co zniknie, co zostaje, jedno działanie, jedno wyjście
  const confirm = ({ title, lead, gone, stay, check, action, label }) => `
    <span class="grabber" aria-hidden="true"></span>
    <h2 class="sos-title" id="kp-title" tabindex="-1">${title}</h2>
    <p class="sos-sub">${lead}</p>
    <div class="kp-what">
      <p class="sheet-label">Usuniemy od razu</p>
      <ul>${gone.map(g => `<li>${g}</li>`).join('')}</ul>
      ${stay ? `<p class="sheet-label">Zostaje</p><ul class="is-stay">${stay.map(g => `<li>${g}</li>`).join('')}</ul>` : ''}
    </div>
    ${check ? `<label class="ci-check kp-check"><input type="checkbox" id="kp-sure"><span class="ci-check-box" aria-hidden="true">${svg(ICO.check)}</span><span>${check}</span></label>` : ''}
    <div class="kp-actions">
      <button type="button" class="kp-danger" data-kp-do="${action}"${check ? ' disabled' : ''}>${label}</button>
      <button type="button" class="sos-close" data-kp="main">Zostaw, jak jest</button>
    </div>`;

  const VIEWS = {
    main,
    zgoda() {
      const doc = Zgody.DOCS.health_data;
      return `
        <span class="grabber" aria-hidden="true"></span>
        <h2 class="sos-title" id="kp-title" tabindex="-1">Zgoda na dane o samopoczuciu</h2>
        <p class="sos-sub">Dzięki niej możemy zapisywać podlewania i wyniki testów. Widzisz je tylko Ty.</p>
        <label class="ci-check kp-check"><input type="checkbox" id="kp-sure"><span class="ci-check-box" aria-hidden="true">${svg(ICO.check)}</span><span>${doc.text}</span></label>
        <p class="kp-small">${doc.note} <a href="${doc.url}" target="_blank" rel="noopener">Polityka prywatności</a></p>
        <div class="kp-actions">
          <button type="button" class="btn-primary" data-kp-do="zgoda" disabled><span>Zgadzam się</span></button>
          <button type="button" class="sos-close" data-kp="main">Nie teraz</button>
        </div>`;
    },
    wycofaj() {
      const n = testCount();
      return confirm({
        title: 'Wycofać zgodę?',
        lead: 'Masz do tego prawo w każdej chwili. Bez zgody nie zapisujemy danych o Twoim samopoczuciu.',
        gone: [`historię testów${n ? ` (${n} ${plural(n)})` : ''}`, 'wpisy z podlewania: nastrój, sen, to, co było ważne, notatki', 'wnioski w Trackerze'],
        stay: ['Twoja roślinka i konto', 'Skrytka, słoik dobrych chwil, bliskie osoby', 'możliwość ponownej zgody — kiedy zechcesz'],
        check: 'Rozumiem, że tych danych nie da się przywrócić.',
        action: 'wycofaj', label: 'Wycofaj zgodę i usuń dane',
      });
    },
    'usun-historie'() {
      const n = testCount();
      return confirm({
        title: 'Usunąć historię testów?',
        lead: 'Zgoda zostaje, więc testy możesz robić dalej.',
        gone: [`${n} ${plural(n)} testów razem z odpowiedziami`],
        stay: null,
        check: 'Rozumiem, że tego nie da się cofnąć.',
        action: 'usun-historie', label: 'Usuń historię',
      });
    },
    'usun-konto'() {
      return confirm({
        title: 'Usunąć konto?',
        lead: 'Możesz wcześniej pobrać kopię swoich danych. Usunięcia nie da się cofnąć.',
        gone: ['profil i roślinkę', 'podlewania, testy i wnioski', 'Skrytkę, słoik dobrych chwil i bliskie osoby', 'Twoje wpisy i komentarze na blogu'],
        stay: null,
        check: 'Rozumiem, że konta nie da się przywrócić.',
        action: 'usun-konto', label: 'Usuń konto na zawsze',
      });
    },
    pozegnanie() {
      return `
        <span class="grabber" aria-hidden="true"></span>
        <h2 class="sos-title" id="kp-title" tabindex="-1">Konto usunięte</h2>
        <p class="sos-sub">Twoje dane zniknęły. Dziękujemy za wspólny czas — dbaj o siebie. Gdy zechcesz wrócić, nowa roślinka wyrośnie od nasionka.</p>
        <a class="sos-item is-main" href="tel:116111">
          <span class="sos-ico">${svg('<path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6A2 2 0 0 1 18.4 19 15 15 0 0 1 5 5.6a2 2 0 0 1 1.6-2.1z"/>')}</span>
          <span><b>116 111 działa zawsze</b><small>Telefon zaufania dla dzieci i młodzieży — bezpłatnie, całą dobę, bez konta</small></span>
        </a>
        <a class="sos-close kp-bye" href="logowanie.html">Zamknij</a>`;
    },
  };

  let current = 'main', entered = 'main';
  function paint(name) {
    current = VIEWS[name] ? name : 'main';
    sheet.innerHTML = VIEWS[current]();
    sheet.dataset.view = current;
    sheet.scrollTop = 0;
    const h = sheet.querySelector('#kp-title');
    if (h && Sheets.current === sheet) h.focus({ preventScroll: true });
  }

  function open(name) {
    entered = name || 'main';
    paint(entered);
    // po usunięciu konta zamknięcie arkusza (tłem albo Escape) też prowadzi do logowania
    // komunikaty (toast) przenosimy na górę, żeby nie zasłaniały przycisków arkusza (css/testy.css: body.kp-open)
    document.body.classList.add('kp-open');
    Sheets.show(sheet, { onClose() {
      document.body.classList.remove('kp-open');
      if (current === 'pozegnanie') location.href = 'logowanie.html';
    } });
  }

  // ================================================================
  //  Działania
  // ================================================================
  function exportData() {
    const data = { wygenerowano: new Date().toISOString(), aplikacja: 'ReLeaf (prototyp)', dane: {} };
    try {
      Object.keys(localStorage).filter(k => k.startsWith('sci.')).sort().forEach(k => {
        let v = localStorage.getItem(k);
        try { v = JSON.parse(v); } catch (_) { /* zwykły napis */ }
        data.dane[k] = v;
      });
    } catch (_) { /* brak dostępu do pamięci przeglądarki */ }
    if (view) { data.dane['sci.zgody'] = Zgody.log(); if (window.Testy) data.dane['sci.testy'] = window.Testy.sessions(); }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'releaf-moje-dane.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Kopia danych zapisana jako plik.');
  }

  function deleteAccount() {
    if (!view) {
      try { Object.keys(localStorage).filter(k => k.startsWith('sci.')).forEach(k => localStorage.removeItem(k)); } catch (_) { /* nic */ }
    }
    Zgody.clear();
    haptic([12, 60, 12]);
    paint('pozegnanie');
  }

  const ACTIONS = {
    eksport: exportData,
    zgoda() {
      Zgody.give('health_data');
      toast('Dziękujemy. Zgodę cofniesz w każdej chwili.');
      // prośba o zgodę otwarta wprost (np. z „Podlej roślinkę”) zamyka się, żeby można było wrócić do tego, co się robiło
      if (entered === 'zgoda') Sheets.hide(); else paint('main');
    },
    wycofaj() {
      // dane usuwają moduły, które je trzymają (zdarzenie consentchange): js/testy.js, js/home2.js
      Zgody.withdraw('health_data');
      haptic(12);
      toast('Zgoda wycofana. Dane o samopoczuciu usunięte.');
      paint('main');
    },
    'usun-historie'() {
      const n = window.Testy ? window.Testy.deleteAll() : 0;
      haptic(12);
      toast(n ? 'Historia testów usunięta.' : 'Historia była już pusta.');
      paint('main');
    },
    'usun-konto': deleteAccount,
  };

  sheet.addEventListener('change', e => {
    if (e.target.id !== 'kp-sure') return;
    const b = sheet.querySelector('.kp-actions [data-kp-do]');
    if (b) b.disabled = !e.target.checked;
  });
  sheet.addEventListener('click', e => {
    const go = e.target.closest('[data-kp]');
    if (go && !go.disabled) { paint(go.dataset.kp); return; }
    const act = e.target.closest('[data-kp-do]');
    if (act && !act.disabled && ACTIONS[act.dataset.kpDo]) ACTIONS[act.dataset.kpDo]();
  });

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-konto]');
    if (b) open(b.dataset.konto || 'main');
  });
  // zgoda zmieniona gdzie indziej (np. na zakładce Testy), gdy arkusz jest otwarty
  window.addEventListener('consentchange', () => { if (Sheets.current === sheet && current === 'main') paint('main'); });

  window.Konto = { open };
})();
