/*
 * Bliskie osoby (kontakty zaufane) w arkuszu SOS — plan P2: „kontakty zaufane jednym dotknięciem”.
 *
 * 1–3 osoby (imię + numer). Stuknięcie dzwoni (tel:). Numer jest też widoczny jako tekst — w niektórych
 * przeglądarkach i aplikacjach link tel: nic nie robi, więc numer musi dać się przepisać.
 * Dodawanie w tym samym arkuszu (bez przechodzenia na inny ekran). Usuwanie przyciskiem „×” z potwierdzeniem.
 * PROTOTYP: lista w localStorage (`sci.kontakty`) tej przeglądarki. W aplikacji: tabela w Supabase albo kontakty z telefonu.
 */
(function () {
  'use strict';

  const root = document.getElementById('trusted');
  if (!root) return;
  const { toast, haptic } = window.AuthCommon;
  const KEY = 'sci.kontakty';
  const MAX = 3;
  const view = new URLSearchParams(location.search).get('widok');

  const load = () => { if (view) return []; try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; } };
  const save = l => { if (view) return; try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) { /* tryb prywatny */ } };
  let list = load(), adding = false, confirmId = null;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const digits = n => n.replace(/[^\d+]/g, '');
  const pretty = n => { const d = digits(n).replace(/^\+48/, ''); return d.length === 9 ? d.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : n.trim(); };
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const PHONE = '<path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6A2 2 0 0 1 18.4 19 15 15 0 0 1 5 5.6a2 2 0 0 1 1.6-2.1z"/>';

  function render() {
    root.innerHTML = `
      <p class="sheet-label" id="trusted-title">Twoje bliskie osoby</p>
      ${list.length ? `<ul class="trusted-list">${list.map(c => `
        <li class="trusted-item">
          <a class="trusted-call" href="tel:${esc(digits(c.phone))}">
            <span class="trusted-av" aria-hidden="true">${esc(c.name.trim()[0] || '?').toUpperCase()}</span>
            <span class="grow"><b>${esc(c.name)}</b><small>${esc(pretty(c.phone))}</small></span>
            <span class="trusted-ico">${svg(PHONE)}</span>
          </a>
          ${confirmId === c.id
            ? `<span class="trusted-confirm"><button type="button" class="quiet-btn" data-keep>Zostaw</button><button type="button" class="btn-danger" data-del="${c.id}">Usuń</button></span>`
            : `<button type="button" class="trusted-x" data-ask="${c.id}" aria-label="Usuń: ${esc(c.name)}">${svg('<path d="M6 6l12 12M18 6L6 18"/>')}</button>`}
        </li>`).join('')}</ul>` : '<p class="trusted-empty">Dodaj 1–3 osoby, do których możesz zadzwonić, gdy jest ciężko — mamę, przyjaciółkę, wychowawcę.</p>'}
      ${adding ? `
        <form class="trusted-form" novalidate>
          <input id="trusted-name" type="text" maxlength="30" placeholder="Imię, np. Mama" autocomplete="off" aria-label="Imię">
          <input id="trusted-phone" type="tel" maxlength="20" placeholder="Numer telefonu" autocomplete="off" aria-label="Numer telefonu">
          <div class="trusted-actions"><button type="button" class="quiet-btn" data-cancel>Anuluj</button><button type="submit" class="btn-primary is-small">Zapisz</button></div>
        </form>`
      : list.length < MAX ? `<button type="button" class="quiet-btn trusted-add" data-add>${svg('<path d="M12 5v14M5 12h14"/>')}Dodaj osobę</button>` : ''}`;
    if (adding) setTimeout(() => root.querySelector('#trusted-name').focus(), 30);
  }
  render();

  root.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-add]')) { adding = true; render(); return; }
    if (t.closest('[data-cancel]')) { adding = false; render(); return; }
    const ask = t.closest('[data-ask]');
    if (ask) { confirmId = ask.dataset.ask; render(); return; }
    if (t.closest('[data-keep]')) { confirmId = null; render(); return; }
    const del = t.closest('[data-del]');
    if (del) { list = list.filter(c => c.id !== del.dataset.del); confirmId = null; save(list); render(); }
  });
  root.addEventListener('submit', e => {
    e.preventDefault();
    const name = root.querySelector('#trusted-name').value.trim();
    const phone = root.querySelector('#trusted-phone').value.trim();
    if (!name) { root.querySelector('#trusted-name').focus(); return; }
    if (digits(phone).replace(/^\+/, '').length < 6) { toast('Wpisz cały numer telefonu.'); root.querySelector('#trusted-phone').focus(); return; }
    list.push({ id: `k${Date.now().toString(36)}`, name, phone });
    save(list);
    adding = false;
    render();
    haptic(10);
  });
})();
