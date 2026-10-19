/*
 * Skrytka — prywatne myśli (zakładka „Skrytka” w aplikacji).
 *
 * Celowo mało tekstu: jedno pole i dwa przyciski.
 *   • „Schowaj” — myśl trafia na listę (tylko dla Ciebie; w aplikacji szyfrowana, plan: Supabase + szyfrowanie na urządzeniu),
 *   • „Puść z wiatrem” — myśl odlatuje jak liść i NIGDZIE się nie zapisuje (technika „liście na strumieniu”).
 * Wpis na liście jest zwinięty (data + 3 linijki); stuknięcie rozwija go i pokazuje „Zapytaj Asystenta” i „Usuń”.
 * Słowa kryzysowe (js/moderacja.js) nie blokują zapisu — Skrytka jest prywatna — ale od razu pokazujemy 116 111.
 *
 * PROTOTYP: wpisy są w localStorage (`sci.skrytka`) tej przeglądarki, bez szyfrowania.
 * window.Skrytka: add({ text, from, mood }) — dodaje wpis (np. notatkę z podlewania), list(), focus()
 */
(function () {
  'use strict';

  const root = document.getElementById('skrytka-root');
  const $ = (s, r = root) => r.querySelector(s);
  const { toast, haptic } = window.AuthCommon;
  const Mod = window.Moderacja || { check: () => ({ verdict: 'ok', hits: [] }) };
  const view = new URLSearchParams(location.search).get('widok');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!view;

  // ================================================================
  //  Dane
  // ================================================================
  const KEY = 'sci.skrytka';
  const MAX = 1000;
  // Podpowiedzi w pustym polu zmieniają się co chwilę
  const PROMPTS = [
    'Co Ci chodzi po głowie?',
    'Co było dziś dobre, choćby trochę?',
    'Czego się teraz obawiasz?',
    'Czego teraz potrzebujesz?',
  ];
  const store = {
    load() {
      if (view) return [];
      try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; }
    },
    save(list) {
      if (view) return;
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (_) { /* tryb prywatny */ }
    },
  };
  let items = store.load();

  // ================================================================
  //  Znaczniki (komponenty)
  // ================================================================
  const svg = (paths, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
    phone: '<path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6A2 2 0 0 1 18.4 19 15 15 0 0 1 5 5.6a2 2 0 0 1 1.6-2.1z"/>',
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function when(at) {
    const d = new Date(at), t = new Date();
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(t) - day(d)) / 864e5);
    const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    if (diff === 0) return `Dziś, ${time}`;
    if (diff === 1) return `Wczoraj, ${time}`;
    return `${d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}, ${time}`;
  }

  root.innerHTML = `
    <form class="card vault-compose" id="vault-form" novalidate>
      <textarea id="vault-text" rows="4" maxlength="${MAX}" placeholder="${PROMPTS[0]}" aria-label="Twoja myśl"></textarea>
      <div class="vault-bar">
        <button type="button" class="quiet-btn" id="vault-release">${svg(ICON.leaf)}Puść z wiatrem</button>
        <button type="submit" class="btn-primary is-small" id="vault-save">${svg(ICON.lock)}Schowaj</button>
      </div>
    </form>
    <section class="ci-alert" id="vault-alert" aria-live="polite" hidden>
      <p class="support-title">To brzmi naprawdę ciężko.</p>
      <p class="support-text">Możesz to tu zapisać, ale nie zostawaj z tym sam na sam.</p>
      <a class="support-call" href="tel:116111">${svg(ICON.phone)}Zadzwoń: 116 111 <small>całą dobę</small></a>
    </section>

    <h2 class="sub-title" id="vault-list-title">Twoje myśli</h2>
    <ol class="vault-list" id="vault-list" aria-labelledby="vault-list-title"></ol>
    <p class="demo-note">Prototyp: wpisy zostają tylko w tej przeglądarce.</p>`;

  const itemView = (it, i, fresh) => `
    <li class="vault-item${fresh ? ' is-new' : ''}" data-id="${it.id}" style="--i:${Math.min(i, 8)}">
      <button type="button" class="vault-open" aria-expanded="false">
        <span class="vault-when">${when(it.at)}${it.from === 'podlewanie' ? ' · z podlewania' : it.from === 'blog' ? ' · szkic z bloga' : ''}</span>
        <span class="vault-text">${esc(it.text)}</span>
      </button>
      <div class="vault-more" hidden>
        <button type="button" class="quiet-btn" data-act="ai">${svg(ICON.spark)}Zapytaj Asystenta</button>
        <button type="button" class="quiet-btn" data-act="del">${svg(ICON.trash)}Usuń</button>
      </div>
      <div class="vault-confirm" hidden>
        <span>Usunąć na zawsze?</span>
        <button type="button" class="quiet-btn" data-act="keep">Zostaw</button>
        <button type="button" class="btn-danger" data-act="really-del">Usuń</button>
      </div>
    </li>`;

  const form = $('#vault-form'), text = $('#vault-text'), list = $('#vault-list');

  function render(freshId) {
    list.innerHTML = items.length
      ? items.map((it, i) => itemView(it, i, it.id === freshId)).join('')
      : `<li class="empty-state is-small">
          <span class="empty-leaf">${svg(ICON.leaf)}</span>
          <p>Tu zamieszkają Twoje myśli.</p>
        </li>`;
  }
  render();

  // ================================================================
  //  Pisanie
  // ================================================================
  let promptAt = 0;
  setInterval(() => {
    if (text.value || document.activeElement === text || document.body.dataset.tab !== 'skrytka') return;
    promptAt = (promptAt + 1) % PROMPTS.length;
    text.placeholder = PROMPTS[promptAt];
  }, 6000);
  text.addEventListener('input', () => { $('#vault-alert').hidden = Mod.check(text.value).verdict !== 'kryzys'; });

  function add({ text: t, from = null, mood = null }) {
    const it = { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), text: t, from, mood };
    items.unshift(it);
    store.save(items);
    render(it.id);
    return it;
  }
  function clear() { text.value = ''; $('#vault-alert').hidden = true; }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const t = text.value.trim();
    if (!t) { text.focus(); return; }
    add({ text: t });
    clear();
    haptic([8, 40, 8]);
    toast('Schowane.');
  });

  // Puść z wiatrem: myśl odlatuje jak liść i znika (nic nie zapisujemy)
  $('#vault-release').addEventListener('click', () => {
    const t = text.value.trim();
    if (!t) { text.focus(); return; }
    if (!reduceMotion) {
      const r = text.getBoundingClientRect();
      const leaf = document.createElement('div');
      leaf.className = 'leaf-fly';
      leaf.setAttribute('aria-hidden', 'true');
      leaf.innerHTML = `${svg(ICON.leaf)}<span>${esc(t.length > 60 ? t.slice(0, 58) + '…' : t)}</span>`;
      leaf.style.left = `${r.left + r.width / 2}px`;
      leaf.style.top = `${r.top + r.height / 2}px`;
      document.body.appendChild(leaf);
      leaf.addEventListener('animationend', () => leaf.remove());
      setTimeout(() => leaf.remove(), 5000);
    }
    clear();
    haptic([4, 60, 4]);
    toast('Odleciała. Nigdzie jej nie zapisaliśmy.');
  });

  // ================================================================
  //  Lista: rozwijanie, Asystent, usuwanie
  // ================================================================
  list.addEventListener('click', e => {
    const li = e.target.closest('.vault-item');
    if (!li) return;
    const open = e.target.closest('.vault-open');
    if (open) {
      const on = open.getAttribute('aria-expanded') !== 'true';
      open.setAttribute('aria-expanded', String(on));
      li.classList.toggle('is-open', on);
      li.querySelector('.vault-more').hidden = !on;
      li.querySelector('.vault-confirm').hidden = true;
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'ai') {
      // TODO: Asystent Wsparcia (P2) — wpis idzie do AI tylko po tym kliknięciu, nigdy automatycznie
      toast('Asystent jest w przygotowaniu.');
    } else if (act === 'del') {
      li.querySelector('.vault-more').hidden = true;
      li.querySelector('.vault-confirm').hidden = false;
      li.querySelector('[data-act="keep"]').focus();
    } else if (act === 'keep') {
      li.querySelector('.vault-confirm').hidden = true;
      li.querySelector('.vault-more').hidden = false;
    } else if (act === 'really-del') {
      items = items.filter(it => it.id !== li.dataset.id);
      store.save(items);
      li.classList.add('is-leaving');
      setTimeout(render, reduceMotion ? 0 : 320);
    }
  });

  window.Skrytka = { add, list: () => items.slice(), focus: () => text.focus() };
})();
