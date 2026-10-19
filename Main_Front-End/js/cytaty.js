/*
 * Myśl na dziś (strona główna): codziennie inna, do zapisania (serduszko) i udostępnienia.
 * Plan P1: „Cytat / myśl dnia: powiadomienie push, udostępnianie, ulubione”.
 *
 * Myśli są nasze (bez cudzych cytatów — prawa autorskie). Wybór zależy od dnia roku, więc cały dzień jest ta sama.
 * Udostępnianie: systemowe „Udostępnij”, a gdzie go nie ma — kopiowanie do schowka.
 * Zapisane myśli: arkusz #quotes-sheet. PROTOTYP: localStorage (`sci.cytaty`). Docelowo: Edge Function `send-daily-quote`.
 */
(function () {
  'use strict';

  const sec = document.getElementById('sec-quote');
  const quoteEl = document.getElementById('quote');
  const sheet = document.getElementById('quotes-sheet');
  if (!sec || !quoteEl || !sheet) return;
  const { toast, haptic } = window.AuthCommon;
  const Sheets = window.Sheets || { show() {} };
  const KEY = 'sci.cytaty';
  const view = new URLSearchParams(location.search).get('widok');

  const QUOTES = [
    'Nie musisz mieć dziś wszystkiego poukładanego. Wystarczy jeden mały krok.',
    'Odpoczynek to też robienie czegoś dla siebie.',
    'Trudny dzień to nie trudne życie.',
    'Możesz być w trakcie i to jest w porządku.',
    'Rośliny też nie kwitną cały rok. A potem wracają.',
    'Nie porównuj swojego środka z czyimś pokazem.',
    'Powiedzieć „nie wiem” to też odwaga.',
    'Jeden spokojny oddech to już zmiana.',
    'Nie wszystko, co myślisz, jest prawdą o Tobie.',
    'Możesz prosić o pomoc. To znak siły, nie słabości.',
    'Małe rzeczy też się liczą. Często najbardziej.',
    'Dziś wystarczy odrobina łagodności dla siebie.',
    'Każdy wschód słońca to nowa szansa, nie egzamin.',
    'To, co czujesz, ma znaczenie. Nawet jeśli nikt tego nie widzi.',
  ];
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
  const today = QUOTES[day % QUOTES.length];
  quoteEl.textContent = today;

  const load = () => { if (view) return []; try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; } };
  const store = l => { if (view) return; try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) { /* tryb prywatny */ } };
  let saved = load();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const HEART = '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>';
  const SHARE = '<path d="M12 4v11M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>';

  sec.insertAdjacentHTML('beforeend', `
    <div class="quote-actions">
      <button type="button" class="quiet-btn quote-heart" id="quote-save" aria-pressed="false">${svg(HEART)}<span>Zapisz</span></button>
      <button type="button" class="quiet-btn" id="quote-share">${svg(SHARE)}<span>Udostępnij</span></button>
      <button type="button" class="quiet-btn quote-list" id="quote-list"></button>
    </div>`);
  const saveBtn = sec.querySelector('#quote-save'), listBtn = sec.querySelector('#quote-list');

  function paint() {
    const on = saved.some(q => q.text === today);
    saveBtn.setAttribute('aria-pressed', String(on));
    saveBtn.querySelector('span').textContent = on ? 'Zapisane' : 'Zapisz';
    listBtn.textContent = saved.length ? `Twoje zapisane (${saved.length})` : '';
    listBtn.hidden = !saved.length;
  }
  paint();

  saveBtn.addEventListener('click', () => {
    const on = saved.some(q => q.text === today);
    saved = on ? saved.filter(q => q.text !== today) : [{ text: today, at: Date.now() }, ...saved];
    store(saved);
    paint();
    if (!on) { saveBtn.classList.remove('is-pop'); void saveBtn.offsetWidth; saveBtn.classList.add('is-pop'); haptic(10); }
  });

  sec.querySelector('#quote-share').addEventListener('click', async () => {
    const text = `${today}\n— myśl na dziś`;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch (err) { if (err && err.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast('Skopiowane. Możesz wkleić, gdzie chcesz.'); }
    catch (_) {
      const r = document.createRange(); r.selectNodeContents(quoteEl);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      toast('Zaznaczyłem myśl — skopiuj ją.');
    }
  });

  // ---------- Arkusz z zapisanymi ----------
  function renderSheet() {
    sheet.innerHTML = `
      <span class="grabber" aria-hidden="true"></span>
      <h2 class="sos-title" id="quotes-title">Zapisane myśli</h2>
      ${saved.length ? `<ul class="quotes-list">${saved.map((q, i) => `
        <li><p>${esc(q.text)}</p><button type="button" class="quiet-btn quote-heart" aria-pressed="true" data-i="${i}" aria-label="Usuń z zapisanych">${svg(HEART)}</button></li>`).join('')}</ul>`
        : '<p class="sos-sub">Nic tu jeszcze nie ma. Stuknij serduszko pod myślą na dziś.</p>'}
      <button type="button" class="sos-close" data-close>Zamknij</button>`;
  }
  listBtn.addEventListener('click', () => { renderSheet(); Sheets.show(sheet); });
  sheet.addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    saved.splice(+b.dataset.i, 1);
    store(saved);
    renderSheet();
    paint();
  });
})();
