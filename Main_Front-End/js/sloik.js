/*
 * Słoik dobrych chwil (druga karta w zakładce Skrytka).
 *
 * Zapisujesz drobne dobre rzeczy („ciepła herbata po deszczu”). Każda chwila to świetlik w słoiku —
 * te same ciepłe światełka, które latają wokół roślinki. Stuknięcie w słoik losuje jedną chwilę.
 * W gorszy dzień (podlewanie z nastrojem 1–3) strona główna sama przypomina jedną chwilę ze słoika.
 * PROTOTYP: localStorage (`sci.sloik`). window.Sloik: random(), count
 * Przełącznik Myśli / Słoik (#skrytka-seg) też jest tutaj.
 */
(function () {
  'use strict';

  const root = document.getElementById('sloik-root');
  if (!root) return;
  const { toast, haptic } = window.AuthCommon;
  const KEY = 'sci.sloik';
  const view = new URLSearchParams(location.search).get('widok');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!view;

  const load = () => { if (view) return []; try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; } };
  const save = l => { if (view) return; try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) { /* tryb prywatny */ } };
  let items = load();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = n => (n === 1 ? 'dobra chwila' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'dobre chwile' : 'dobrych chwil');

  // Świetliki: pozycja stała dla danej chwili (z jej id), żeby słoik wyglądał tak samo po odświeżeniu
  const hash = str => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  function light(it, fresh) {
    const h = hash(it.id);
    const x = 12 + (h % 76), y = 12 + ((h >>> 7) % 80), d = ((h >>> 3) % 40) / 10, s = .8 + ((h >>> 11) % 6) / 10;
    return `<i class="${fresh ? 'is-new' : ''}" style="--x:${x}%;--y:${y}%;--d:-${d}s;--s:${s}"></i>`;
  }

  root.innerHTML = `
    <section class="card jar-card">
      <button type="button" class="jar" id="jar" aria-label="Wylosuj dobrą chwilę">
        <svg viewBox="0 0 160 190" aria-hidden="true">
          <rect class="jar-lid" x="46" y="8" width="68" height="18" rx="6"/>
          <path class="jar-glass" d="M52 26h56v10c0 6 22 12 22 34v86c0 14-10 24-24 24H54c-14 0-24-10-24-24V70c0-22 22-28 22-34z"/>
          <path class="jar-shine" d="M44 80c0-8 4-14 10-17M42 96v40"/>
        </svg>
        <span class="jar-lights" id="jar-lights"></span>
      </button>
      <p class="jar-count" id="jar-count"></p>
      <p class="jar-pick" id="jar-pick" aria-live="polite"></p>
    </section>
    <form class="card vault-compose" id="jar-form" novalidate>
      <textarea id="jar-text" rows="3" maxlength="300" placeholder="Co dobrego się dziś wydarzyło? Nawet coś małego." aria-label="Dobra chwila"></textarea>
      <div class="vault-bar">
        <span></span>
        <button type="submit" class="btn-primary is-small">Wrzuć do słoika</button>
      </div>
    </form>`;

  const lights = root.querySelector('#jar-lights'), count = root.querySelector('#jar-count'), pick = root.querySelector('#jar-pick');
  function render(freshId) {
    lights.innerHTML = items.slice(0, 30).map(it => light(it, it.id === freshId)).join('');
    count.textContent = items.length ? `${items.length} ${plural(items.length)}` : 'Słoik czeka na pierwszą chwilę';
    if (!pick.dataset.shown) pick.textContent = items.length ? 'Stuknij słoik, żeby wylosować chwilę.' : 'Ciepła herbata, dobra piosenka, miła wiadomość — wszystko się liczy.';
  }
  render();

  const random = () => (items.length ? items[Math.floor(Math.random() * items.length)] : null);
  root.querySelector('#jar').addEventListener('click', () => {
    const it = random();
    if (!it) { root.querySelector('#jar-text').focus(); return; }
    pick.dataset.shown = '1';
    pick.classList.remove('is-in');
    void pick.offsetWidth;
    pick.innerHTML = `„${esc(it.text)}”<small>${new Date(it.at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}</small>`;
    pick.classList.add('is-in');
    haptic(8);
  });
  root.querySelector('#jar-form').addEventListener('submit', e => {
    e.preventDefault();
    const ta = root.querySelector('#jar-text');
    const t = ta.value.trim();
    if (!t) { ta.focus(); return; }
    const it = { id: `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: Date.now(), text: t };
    items.unshift(it);
    save(items);
    ta.value = '';
    render(it.id);
    haptic([6, 40, 6]);
    toast('W słoiku. Jedno światełko więcej.');
  });

  // ---------- Przełącznik Myśli / Słoik ----------
  const seg = document.getElementById('skrytka-seg');
  const thoughts = document.getElementById('skrytka-root');
  if (seg) seg.addEventListener('click', e => {
    const b = e.target.closest('[data-pane]');
    if (!b) return;
    const jar = b.dataset.pane === 'sloik';
    seg.querySelectorAll('[data-pane]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    thoughts.hidden = jar;
    root.hidden = !jar;
  });

  // ---------- Gorszy dzień: przypomnienie na stronie głównej ----------
  window.addEventListener('watered', e => {
    const entry = e.detail;
    const old = document.getElementById('jar-remind');
    if (old) old.remove();
    const it = random();
    if (!entry || !entry.mood || entry.mood > 3 || !it) return;
    const sec = document.getElementById('sec-water');
    if (!sec) return;
    sec.insertAdjacentHTML('beforeend', `
      <div class="jar-remind" id="jar-remind">
        <span class="jar-remind-light" aria-hidden="true"></span>
        <p><small>Z Twojego słoika dobrych chwil</small>„${esc(it.text)}”</p>
      </div>`);
  });

  window.Sloik = { random, get count() { return items.length; } };
  if (reduceMotion) root.classList.add('is-still');
})();
