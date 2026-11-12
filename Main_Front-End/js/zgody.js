/*
 * Zgody (RODO) — jedno miejsce, które wie, na co osoba się zgodziła.
 *
 * Rodzaje (te same co w bazie, notes/supabase-schema.sql → legal_doc_kind):
 *   terms        regulamin (warunek konta; „wycofanie” = usunięcie konta)
 *   privacy      zapoznanie się z polityką prywatności
 *   health_data  wyraźna zgoda na dane o zdrowiu i samopoczuciu (art. 9 ust. 2 lit. a) — da się wycofać w każdej chwili
 *   guardian     zgoda opiekuna poniżej 16 lat (zapisuje ją tylko serwer)
 *
 * PROTOTYP: dziennik zgód leży w localStorage (`sci.zgody`) w kształcie tabeli `user_consents`:
 *   { id, kind, version, givenAt, withdrawnAt, supersededAt, givenBy }
 * Zgoda jest aktywna, gdy nie ma ani withdrawnAt, ani supersededAt. Wierszy się nie kasuje (dowód zgody).
 * TODO backend: give() → supabase.rpc('give_consent', { p_kinds }), withdraw() → rpc('withdraw_consent'),
 * odczyt z widoku `my_consents`; IP i czas ustawia serwer.
 *
 * Zgody z rejestracji (`sci.account.consents`) wchodzą do dziennika przy pierwszym uruchomieniu.
 * Wycofanie zgody na dane o zdrowiu od razu usuwa historię testów i dzisiejsze podlewanie (zdarzenie `consentchange`).
 *
 * window.Zgody:
 *   DOCS                          wersje i adresy dokumentów + treść zgody na dane o zdrowiu
 *   has(kind)                     czy jest aktywna zgoda (dla health_data: także zgoda opiekuna, jeśli potrzebna)
 *   state(kind)                   { active, row, pendingGuardian, withdrawn }
 *   give(kinds)                   zapisuje zgodę na aktualną wersję dokumentu
 *   withdraw('health_data')       wycofuje zgodę i usuwa dane o zdrowiu
 *   log()                         cały dziennik (do ekranu „Konto i prywatność” i eksportu)
 *   confirmGuardian()             PROTOTYP: symuluje kliknięcie opiekuna w link z e-maila
 * Zdarzenie na window: `consentchange` ({ detail: { kind, active } }).
 */
(function () {
  'use strict';

  const KEY = 'sci.zgody';
  const view = new URLSearchParams(location.search).get('widok');
  const account = () => (window.AuthCommon ? window.AuthCommon.account.load() : null);

  // Wersje dokumentów. Zmiana treści = nowy numer wersji tutaj i nowy wiersz w `legal_documents`.
  const DOCS = {
    terms: { version: '0.1', title: 'Regulamin', url: 'regulamin.html' },
    privacy: { version: '0.1', title: 'Polityka prywatności', url: 'polityka-prywatnosci.html' },
    health_data: {
      version: '0.1', title: 'Zgoda na dane o samopoczuciu', url: 'polityka-prywatnosci.html#zgoda',
      // TREŚĆ ROBOCZA — przed prawdziwymi kontami sprawdza ją prawnik (notes/CLAUDE.md).
      // Ta sama treść MUSI być w rejestracja.html (pole #health) i w polityka-prywatnosci.html (#zgoda):
      // dowód zgody wskazuje wersję dokumentu, więc osoba musi widzieć wszędzie to samo zdanie.
      text: 'Zgadzam się, żeby ReLeaf zapisywał i automatycznie analizował moje dane o samopoczuciu: wpisy z podlewania i wyniki testów. Posłużą tylko do tego, żeby pokazać mi moją historię, wykresy i wnioski o tym, co zwykle idzie w parze z moim nastrojem.',
      note: 'To dane o zdrowiu, dlatego pytamy osobno. Zgodę cofniesz w każdej chwili w „Konto i prywatność” — wtedy od razu usuniemy te dane.',
    },
    guardian: { version: '0.1', title: 'Zgoda opiekuna', url: 'polityka-prywatnosci.html#opiekun' },
  };

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const row = (kind, at, givenBy = 'user') => ({
    id: uid(), kind, version: DOCS[kind].version, givenAt: at || new Date().toISOString(),
    withdrawnAt: null, supersededAt: null, givenBy,
  });

  // ---------- pamięć ----------
  let rows = null;
  function load() {
    if (rows) return rows;
    if (view) {
      // widok statyczny (zrzuty ekranu): konto z kompletem zgód sprzed 6 tygodni, nic nie zapisujemy
      const at = new Date(Date.now() - 45 * 864e5).toISOString();
      rows = ['terms', 'privacy', 'health_data'].map(k => row(k, at));
      return rows;
    }
    try { rows = JSON.parse(localStorage.getItem(KEY)); } catch (_) { rows = null; }
    if (!Array.isArray(rows)) {
      // pierwsze uruchomienie: przenosimy zgody z rejestracji
      rows = [];
      const acc = account();
      const c = acc && acc.consents;
      if (c && c.terms) rows.push(row('terms', c.at), row('privacy', c.at));
      if (c && c.health) rows.push(row('health_data', c.at));
      if (acc && acc.parentEmail && acc.parentPending === false) rows.push(row('guardian', c && c.at, 'guardian'));
      if (rows.length) save();
    }
    return rows;
  }
  function save() {
    if (view) return;
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (_) { /* tryb prywatny, brak miejsca */ }
  }

  const activeRow = kind => load().find(r => r.kind === kind && !r.withdrawnAt && !r.supersededAt) || null;
  // poniżej 16 lat dane o zdrowiu wymagają też zgody opiekuna (w rejestracji: e-mail opiekuna)
  function needsGuardian() {
    const acc = account();
    return !!(acc && acc.parentEmail);
  }

  // PROTOTYP: „opiekun potwierdził” z rejestracji (parentPending === false) liczy się jak zgoda opiekuna
  const guardianOk = () => !!activeRow('guardian') || (account() || {}).parentPending === false;

  function state(kind) {
    const r = activeRow(kind);
    const pendingGuardian = kind === 'health_data' && !!r && needsGuardian() && !guardianOk();
    const withdrawn = !r && load().some(x => x.kind === kind && x.withdrawnAt);
    return { active: !!r && !pendingGuardian, row: r, pendingGuardian, withdrawn, outdated: !!r && r.version !== DOCS[kind].version };
  }
  const has = kind => state(kind).active;

  function emit(kind) {
    window.dispatchEvent(new CustomEvent('consentchange', { detail: { kind, active: has(kind) } }));
  }

  function give(kinds) {
    [].concat(kinds).forEach(kind => {
      if (kind === 'guardian' || !DOCS[kind]) return;                 // zgody opiekuna nie da się wpisać samemu
      const cur = activeRow(kind);
      if (cur && cur.version === DOCS[kind].version) return;          // ta wersja jest już zaakceptowana
      if (cur) cur.supersededAt = new Date().toISOString();           // nowa wersja dokumentu: stara zgoda zastąpiona, dane zostają
      rows.push(row(kind));
      save();
      emit(kind);
    });
  }

  function withdraw(kind) {
    if (kind !== 'health_data') return false;                          // regulamin i politykę „wycofuje” usunięcie konta
    const cur = activeRow(kind);
    if (!cur) return false;
    cur.withdrawnAt = new Date().toISOString();
    save();
    emit(kind);                                                        // js/testy.js i js/home2.js usuwają swoje dane
    return true;
  }

  function confirmGuardian() {
    if (activeRow('guardian')) return;
    load().push(row('guardian', null, 'guardian'));
    save();
    emit('health_data');
  }

  // usunięcie konta: w prototypie czyścimy też dziennik (w bazie zostaje dowód bez powiązania z kontem)
  function clear() { rows = []; if (!view) { try { localStorage.removeItem(KEY); } catch (_) { /* nic */ } } }

  window.Zgody = {
    DOCS, has, state, give, withdraw, confirmGuardian, clear,
    log: () => load().map(r => ({ ...r })),
  };
})();
