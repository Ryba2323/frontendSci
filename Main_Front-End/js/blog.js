/*
 * Blog — anonimowa społeczność (zakładka „Blog” w aplikacji). Jak Reddit: wpisy, głosy w górę i w dół, komentarze.
 * Celowo spokojnie: lista wpisów (tytuł + 2 linijki), jedno przełączenie Popularne/Nowe i przycisk „Napisz”.
 * Stuknięcie we wpis rozwija go: cała treść, komentarze i „Zgłoś”.
 *
 * Anonimowość: każdy pisze jako „roślinkowy” pseudonim (np. Cicha Paproć), który można wylosować od nowa.
 * Każdy wpis i komentarz przechodzi przez moderację (js/moderacja.js — DEMO na liście słów, docelowo AI):
 *   ok         → publikujemy, wpis ma znaczek „sprawdzone”
 *   obrazliwe  → nie publikujemy, zaznaczamy fragmenty, prosimy o poprawkę
 *   kryzys     → NIE publikujemy publicznie; zamiast tego wsparcie: 116 111, 112, oddech z roślinką, „schowaj w Skrytce”
 *   dane       → prosimy o usunięcie numeru / maila / nicku
 * Wpisy, głosy i komentarze to dane przykładowe w pamięci strony (bez zapisu). Backend: Supabase (posts, comments, votes).
 * „Zgłoś” przy wpisie — plan: kolejka dla moderatora.
 */
(function () {
  'use strict';

  const root = document.getElementById('blog-root');
  const sheet = document.getElementById('compose-sheet');
  if (!root || !sheet) return;
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const { toast, haptic } = window.AuthCommon;
  const Sheets = window.Sheets || { show() {}, hide() {} };
  const Mod = window.Moderacja;
  const view = new URLSearchParams(location.search).get('widok');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!view;

  // ================================================================
  //  Dane przykładowe
  // ================================================================
  const NICKS = ['Cicha Paproć', 'Senny Kaktus', 'Mała Mięta', 'Dzielny Bluszcz', 'Ciepła Lawenda', 'Nocny Fiołek', 'Spokojny Klon',
    'Zielona Bazylia', 'Wesoły Słonecznik', 'Uważny Rumianek', 'Odważna Konwalia', 'Leniwy Mech', 'Rześka Melisa', 'Cierpliwy Dąb'];
  const now = Date.now(), MIN = 60e3, H = 60 * MIN;
  let posts = [
    {
      id: 'p1', nick: 'Senny Kaktus', at: now - 2 * H, score: 48,
      title: 'Jak ogarniacie stres przed sprawdzianem?',
      body: 'Jutro mam sprawdzian z matmy i od dwóch dni prawie nie śpię. Uczę się, ale mam wrażenie, że nic nie zostaje w głowie. Macie jakieś sposoby, żeby się wieczorem trochę uspokoić?',
      comments: [
        { nick: 'Uważny Rumianek', at: now - 90 * MIN, text: 'Mi pomaga zapisać na kartce wszystko, czym się martwię, i odłożyć ją do jutra. Głupie, ale działa.' },
        { nick: 'Ciepła Lawenda', at: now - 70 * MIN, text: 'Oddychanie 4–6: cztery sekundy wdech, sześć wydech. Jest w SOS w aplikacji, serio uspokaja.' },
      ],
    },
    {
      id: 'p2', nick: 'Mała Mięta', at: now - 5 * H, score: 112,
      title: 'Dziś pierwszy raz od dawna wyszłam na spacer',
      body: 'Niby nic, ale przez ostatnie tygodnie nie chciało mi się wychodzić z pokoju. Dziś poszłam do parku na 20 minut i było… okej. Chciałam się tym gdzieś pochwalić.',
      comments: [
        { nick: 'Dzielny Bluszcz', at: now - 4 * H, text: 'To wcale nie jest nic! Trzymam kciuki za jutrzejszy spacer.' },
      ],
    },
    {
      id: 'p3', nick: 'Nocny Fiołek', at: now - 9 * H, score: 31,
      title: 'Telefon przed snem — ktoś też nie umie odłożyć?',
      body: 'Kładę się o 23, a o 2 dalej scrolluję. Rano jestem zombie. Próbowaliście czegoś, co naprawdę działa?',
      comments: [],
    },
    {
      id: 'p4', nick: 'Spokojny Klon', at: now - 26 * H, score: 64,
      title: 'Czuję, że paczka znajomych mnie pomija',
      body: 'Ostatnio widzę na relacjach, że gdzieś wychodzą beze mnie. Nie wiem, czy coś zrobiłem, czy po prostu tak wyszło. Zapytać ich wprost?',
      comments: [
        { nick: 'Rześka Melisa', at: now - 20 * H, text: 'Zapytaj jedną osobę, której najbardziej ufasz, na spokojnie i bez pretensji. Często to zwykłe nieporozumienie.' },
      ],
    },
  ];
  const myVotes = {};                 // id → 1 / -1
  let sort = 'top';
  let nick = NICKS[Math.floor(Math.random() * NICKS.length)];

  // ================================================================
  //  Znaczniki (komponenty)
  // ================================================================
  const svg = (paths, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    up: '<path d="M12 5l7 8h-4.5v6h-5v-6H5z"/>',
    down: '<path d="M12 19l-7-8h4.5V5h5v6H19z"/>',
    chat: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    shield: '<path d="M12 3l8 3.5v5.5c0 4.6-3.4 8.3-8 9-4.6-.7-8-4.4-8-9V6.5z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01"/>',
    send: '<path d="M4 12l16-8-6 16-3-6.5z"/>',
    phone: '<path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6A2 2 0 0 1 18.4 19 15 15 0 0 1 5 5.6a2 2 0 0 1 1.6-2.1z"/>',
    sos: '<path d="M12 3l8 4v5c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V7z"/><path d="M12 8.5v4M12 15.5h.01"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4.1-2.9 7.5-6.5 7.5-2.4 0-4-1.3-5.2-3.4L3.7 14.8a1.5 1.5 0 0 1 2.5-1.7L8 15"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    breath: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5" stroke-dasharray="2 3"/>',
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const AV = ['--plant-leaf-1', '--plant-leaf-2', '--plant-leaf-3', '--plant-flower', '--plant-core', '--primary'];
  const avatar = name => {
    const k = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length;
    const ini = name.split(' ').map(w => w[0]).join('');
    return `<span class="avatar" style="--av: var(${AV[k]})" aria-hidden="true">${ini}</span>`;
  };
  function ago(at) {
    const m = Math.max(1, Math.round((Date.now() - at) / MIN));
    if (m < 60) return m < 2 ? 'przed chwilą' : `${m} min temu`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} godz. temu`;
    return h < 48 ? 'wczoraj' : `${Math.round(h / 24)} dni temu`;
  }

  const commentView = c => `
    <li class="comment${c.fresh ? ' is-new' : ''}">
      ${avatar(c.nick)}
      <div><p class="comment-head"><b>${esc(c.nick)}</b> · ${ago(c.at)}</p><p>${esc(c.text)}</p></div>
    </li>`;

  const postView = (p, i) => {
    const my = myVotes[p.id] || 0;
    const n = p.comments.length;
    return `
    <li class="post${p.fresh ? ' is-new' : ''}" data-id="${p.id}" style="--i:${Math.min(i, 8)}">
      <button type="button" class="post-open" aria-expanded="false">
        <span class="post-meta"><span class="dot" style="--av: var(${AV[[...p.nick].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]})"></span>${esc(p.nick)} · ${ago(p.at)}</span>
        <span class="post-title">${esc(p.title)}</span>
        <span class="post-body">${esc(p.body)}</span>
      </button>
      <div class="post-actions">
        <span class="vote${my ? (my > 0 ? ' is-up' : ' is-down') : ''}" role="group" aria-label="Głosy">
          <button type="button" data-vote="1" aria-pressed="${my > 0}" aria-label="Głos w górę">${svg(ICON.up)}</button>
          <b aria-live="polite">${p.score + my}</b>
          <button type="button" data-vote="-1" aria-pressed="${my < 0}" aria-label="Głos w dół">${svg(ICON.down)}</button>
        </span>
        <span class="post-count" aria-label="Komentarze">${svg(ICON.chat)}<span>${n}</span></span>
      </div>
      <div class="post-comments" hidden>
        <ol class="comments">${p.comments.map(commentView).join('') || '<li class="comments-empty">Nikt jeszcze nie odpisał.</li>'}</ol>
        <form class="comment-form" novalidate>
          <input type="text" maxlength="400" placeholder="Napisz coś życzliwego…" aria-label="Twój komentarz">
          <button type="submit" class="icon-btn is-primary" aria-label="Wyślij komentarz">${svg(ICON.send)}</button>
        </form>
        <div class="comment-msg" aria-live="polite"></div>
        <button type="button" class="quiet-btn post-report" data-act="report">${svg(ICON.flag)}<span>Zgłoś wpis</span></button>
      </div>
    </li>`;
  };

  root.innerHTML = `
    <div class="seg blog-sort" role="group" aria-label="Kolejność">
      <button type="button" data-sort="top" aria-pressed="true">Popularne</button>
      <button type="button" data-sort="new" aria-pressed="false">Nowe</button>
    </div>
    <ol class="blog-feed" id="blog-feed" aria-label="Wpisy"></ol>`;

  const feed = $('#blog-feed');
  function render() {
    const list = posts.slice().sort((a, b) => (sort === 'new' ? b.at - a.at : (b.score + (myVotes[b.id] || 0)) - (a.score + (myVotes[a.id] || 0))));
    feed.innerHTML = list.map(postView).join('');
    posts.forEach(p => { p.fresh = false; p.comments.forEach(c => { c.fresh = false; }); });
  }
  render();

  // ================================================================
  //  Lista: sortowanie, tematy, głosy, komentarze, zgłoszenia
  // ================================================================
  root.addEventListener('click', e => {
    const s = e.target.closest('[data-sort]');
    if (s) {
      sort = s.dataset.sort;
      $$('[data-sort]').forEach(b => b.setAttribute('aria-pressed', String(b === s)));
      render();
      return;
    }
    const li = e.target.closest('.post');
    if (!li) return;
    const p = posts.find(x => x.id === li.dataset.id);
    const v = e.target.closest('[data-vote]');
    if (v) {
      const dir = Number(v.dataset.vote);
      myVotes[p.id] = myVotes[p.id] === dir ? 0 : dir;
      const my = myVotes[p.id];
      const box = v.parentElement;
      box.classList.toggle('is-up', my > 0);
      box.classList.toggle('is-down', my < 0);
      box.querySelector('[data-vote="1"]').setAttribute('aria-pressed', String(my > 0));
      box.querySelector('[data-vote="-1"]').setAttribute('aria-pressed', String(my < 0));
      const num = box.querySelector('b');
      num.textContent = p.score + my;
      if (!reduceMotion) { num.classList.remove('is-bump'); void num.offsetWidth; num.classList.add('is-bump'); }
      haptic(8);
      return;
    }
    const open = e.target.closest('.post-open');
    if (open) {
      const on = open.getAttribute('aria-expanded') !== 'true';
      open.setAttribute('aria-expanded', String(on));
      li.classList.toggle('is-open', on);
      li.querySelector('.post-comments').hidden = !on;
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'report') {
      // TODO backend: kolejka zgłoszeń dla moderatora
      toast('Dzięki. Moderator sprawdzi ten wpis.');
      act.disabled = true;
      act.querySelector('span').textContent = 'Zgłoszone';
    }
  });

  // Komentarz — ta sama moderacja co wpisy, komunikat pod polem
  root.addEventListener('submit', e => {
    const f = e.target.closest('.comment-form');
    if (!f) return;
    e.preventDefault();
    const li = f.closest('.post');
    const p = posts.find(x => x.id === li.dataset.id);
    const input = f.querySelector('input');
    const msg = li.querySelector('.comment-msg');
    const t = input.value.trim();
    if (!t) return;
    const r = Mod.check(t);
    msg.className = 'comment-msg';
    if (r.verdict === 'ok') {
      const c = { nick, at: Date.now(), text: t, fresh: true };
      p.comments.push(c);
      const ol = li.querySelector('.comments');
      const empty = ol.querySelector('.comments-empty');
      if (empty) empty.remove();
      ol.insertAdjacentHTML('beforeend', commentView(c));
      c.fresh = false;
      const n = p.comments.length;
      li.querySelector('.post-count span').textContent = n;
      input.value = '';
      msg.textContent = '';
      haptic(8);
      return;
    }
    msg.classList.add(`is-${r.verdict}`);
    if (r.verdict === 'kryzys') {
      msg.innerHTML = `<b>Ten komentarz zostaje tylko u Ciebie.</b> Brzmi, jakby było Ci bardzo ciężko — porozmawiaj z kimś teraz: <a href="tel:116111">116 111</a> (całą dobę) albo <a href="tel:112">112</a>.`;
    } else if (r.verdict === 'obrazliwe') {
      msg.innerHTML = `<b>Ten komentarz może kogoś zranić.</b> Zmień zaznaczone słowa: <span class="mod-quote">${Mod.mark(t, r.hits)}</span>`;
    } else {
      msg.innerHTML = `<b>Bez danych kontaktowych.</b> Blog jest anonimowy: <span class="mod-quote">${Mod.mark(t, r.hits)}</span>`;
    }
  });

  // ================================================================
  //  Nowy wpis (arkusz) + moderacja
  // ================================================================
  sheet.innerHTML = `
    <span class="grabber" aria-hidden="true"></span>
    <div class="compose" data-state="edit">
      <div class="compose-edit">
        <h2 class="sos-title" id="compose-title">Nowy wpis</h2>
        <p class="compose-who">Piszesz jako <b id="compose-nick">${esc(nick)}</b> <button type="button" class="quiet-btn" id="compose-reroll">${svg(ICON.dice)}Losuj</button></p>
        <label class="field"><span>Tytuł</span><input id="compose-head" maxlength="80" placeholder="Krótko: o czym piszesz?"></label>
        <label class="field"><span>Treść</span><textarea id="compose-body" rows="6" maxlength="1500" placeholder="Opowiedz, co się dzieje…"></textarea></label>
        <p class="mod-live" id="mod-live" data-kind="idle">${svg(ICON.shield)}<span>Bez wyzwisk i danych kontaktowych. Wpis sprawdzi moderator.</span></p>
        <button type="button" class="btn-primary" id="compose-send">${svg(ICON.send)}Opublikuj anonimowo</button>
        <button type="button" class="sos-close" data-close>Anuluj</button>
      </div>
      <div class="compose-check" aria-live="polite">
        <div class="scan" aria-hidden="true">${svg(ICON.shield)}<i></i></div>
        <p class="sos-title">Moderator sprawdza wpis…</p>
        <ul class="scan-list">
          <li>Czy nikt nie jest w niebezpieczeństwie</li>
          <li>Czy jest życzliwie</li>
          <li>Czy nie ma danych osobowych</li>
        </ul>
      </div>
      <div class="compose-result" id="compose-result" tabindex="-1"></div>
    </div>`;

  const fab = document.getElementById('blog-fab');
  if (fab) fab.addEventListener('click', () => openCompose());

  const S = s => sheet.querySelector(s);
  const compose = S('.compose');
  const head = S('#compose-head'), body = S('#compose-body'), live = S('#mod-live');
  let liveTimer, checkTimer;

  function setState(state) {
    compose.dataset.state = state;
    if (state === 'result') setTimeout(() => S('#compose-result').focus({ preventScroll: true }), 30);
  }

  function openCompose() {
    setState('edit');
    S('#compose-nick').textContent = nick;
    Sheets.show(sheet, { onClose: () => clearTimeout(checkTimer) });
    setTimeout(() => head.focus({ preventScroll: true }), 80);
  }

  S('#compose-reroll').addEventListener('click', () => {
    let n;
    do n = NICKS[Math.floor(Math.random() * NICKS.length)]; while (n === nick);
    nick = n;
    S('#compose-nick').textContent = nick;
    haptic(6);
  });
  // Podpowiedź na żywo (łagodna) — właściwa decyzja zapada po „Opublikuj”
  const LIVE = {
    idle: 'Bez wyzwisk i danych kontaktowych. Wpis sprawdzi moderator.',
    ok: 'Wygląda dobrze.',
    obrazliwe: 'Niektóre słowa nie przejdą moderacji.',
    dane: 'Usuń numer, maila albo nick — blog jest anonimowy.',
    kryzys: 'Widzimy, że może być Ci bardzo ciężko. Pomoc jest pod SOS.',
  };
  function liveCheck() {
    const t = `${head.value}\n${body.value}`.trim();
    const kind = t.length < 3 ? 'idle' : Mod.check(t).verdict;
    live.dataset.kind = kind;
    live.querySelector('span').textContent = LIVE[kind];
  }
  [head, body].forEach(el => el.addEventListener('input', () => { clearTimeout(liveTimer); liveTimer = setTimeout(liveCheck, 350); }));

  S('#compose-send').addEventListener('click', () => {
    const title = head.value.trim(), text = body.value.trim();
    if (title.length < 3 || text.length < 10) {
      toast(title.length < 3 ? 'Dodaj krótki tytuł.' : 'Napisz trochę więcej (min. 10 znaków).');
      (title.length < 3 ? head : body).focus();
      return;
    }
    setState('check');
    haptic(8);
    // DEMO: „AI” myśli chwilę; docelowo tu będzie zapytanie do serwera
    const all = `${title}\n${text}`;
    const r = Mod.check(all);
    checkTimer = setTimeout(() => showResult(r, title, text, all), reduceMotion ? 300 : 1700);
  });

  function showResult(r, title, text, all) {
    const box = S('#compose-result');
    if (r.verdict === 'ok') {
      posts.unshift({ id: `u${Date.now()}`, nick, at: Date.now(), score: 1, title, body: text, comments: [], fresh: true });
      myVotes[posts[0].id] = 0;
      head.value = ''; body.value = ''; liveCheck();
      Sheets.hide();
      sort = 'new';
      $$('[data-sort]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sort === 'new')));
      render();
      feed.firstElementChild.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      toast('Opublikowano anonimowo. Wpis przeszedł moderację.');
      haptic([8, 40, 8]);
      return;
    }
    const quote = `<blockquote class="mod-quote">${Mod.mark(all, r.hits).replace(/\n/, '<br>')}</blockquote>`;
    if (r.verdict === 'kryzys') {
      box.className = 'compose-result is-kryzys';
      box.innerHTML = `
        <span class="result-ico">${svg(ICON.leaf)}</span>
        <h2 class="sos-title">Nie zostawiamy Cię z tym</h2>
        <p class="sos-sub">Z tego, co piszesz, wynika, że jest Ci teraz bardzo ciężko. Taki wpis nie trafi na publicznego bloga — tu odpisują obce osoby, a Ty zasługujesz na prawdziwą pomoc od razu.</p>
        <ul class="sos-list">
          <li><a class="sos-item is-main" href="tel:116111"><span class="sos-ico">${svg(ICON.phone)}</span><span><b>Zadzwoń: 116 111</b><small>Telefon zaufania dla dzieci i młodzieży — bezpłatnie, całą dobę</small></span></a></li>
          <li><a class="sos-item" href="tel:112"><span class="sos-ico">${svg(ICON.sos)}</span><span><b>Zagrożenie życia: 112</b><small>Numer alarmowy</small></span></a></li>
        </ul>
        <div class="result-actions">
          <button type="button" class="btn-ghost" data-r="breath">${svg(ICON.breath)}Minuta oddechu</button>
          <button type="button" class="btn-ghost" data-r="vault">${svg(ICON.lock)}Schowaj w Skrytce</button>
        </div>
        <button type="button" class="sos-close" data-r="edit">Wróć do wpisu</button>`;
    } else {
      const abuse = r.verdict === 'obrazliwe';
      box.className = `compose-result is-${r.verdict}`;
      box.innerHTML = `
        <span class="result-ico">${svg(abuse ? ICON.hand : ICON.lock)}</span>
        <h2 class="sos-title">${abuse ? 'Ten wpis może kogoś zranić' : 'Usuń dane kontaktowe'}</h2>
        <p class="sos-sub">${abuse
          ? 'Na blogu nie ma miejsca na wyzwiska, hejt i groźby — nawet gdy ktoś bardzo Cię zdenerwował. Zaznaczyliśmy fragmenty do zmiany:'
          : 'Blog jest anonimowy. Dla Twojego bezpieczeństwa nie podawaj numeru, maila ani nicku z innych aplikacji:'}</p>
        ${quote}
        ${abuse ? '<p class="result-tip"><b>Podpowiedź:</b> opisz, co czujesz, zamiast kogoś obrażać. Np. „Jestem na nich strasznie wściekły/wściekła, bo…”.</p>' : ''}
        <button type="button" class="btn-primary" data-r="edit">${svg(ICON.pen)}Popraw wpis</button>`;
    }
    setState('result');
    haptic(14);
  }

  S('#compose-result').addEventListener('click', e => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    if (b.dataset.r === 'edit') { setState('edit'); body.focus(); return; }
    if (b.dataset.r === 'vault') {
      if (window.Skrytka) window.Skrytka.add({ text: `${head.value.trim()}\n${body.value.trim()}`.trim(), from: 'blog' });
      head.value = ''; body.value = ''; liveCheck();
      Sheets.hide();
      toast('Schowane w Skrytce — tylko dla Ciebie.');
      return;
    }
    if (b.dataset.r === 'breath') {
      Sheets.hide(true);
      if (window.Oddech) window.Oddech.open();
    }
  });
})();
