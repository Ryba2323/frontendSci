/* Dwa niezależne podglądy. Docelowo ekran wejścia wybierze stan sesji z backendu. */
(function () {
  'use strict';

  const start = document.querySelector('.start');
  const home = start.querySelector('[data-start-home]');
  const params = new URLSearchParams(location.search);
  const staticView = params.get('widok') === 'statyczny';
  const inPhonePreview = params.get('ramka') === '1' && window.parent !== window;
  // Linki do demonstracji pozwalają świadomie obejrzeć pełny ruch.
  const reduced = params.get('ruch') !== 'pelny' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const homeMessage = 'releaf:otworz-dom';

  function renderPhonePreview() {
    const preview = document.createElement('main');
    preview.className = 'phone-preview';
    preview.innerHTML = `
      <div class="phone-controls">
        <span class="phone-size">390 × 844 px</span>
        <button class="phone-replay" type="button">Odtwórz ponownie</button>
      </div>
      <div class="phone-footprint">
        <div class="phone-case">
          <div class="phone-screen"></div>
        </div>
      </div>`;
    return preview;
  }

  function mountPhonePreview() {
    const preview = renderPhonePreview();
    const shell = preview.querySelector('.phone-case');
    const screen = preview.querySelector('.phone-screen');
    const controls = preview.querySelector('.phone-controls');
    const replay = preview.querySelector('.phone-replay');
    const introURL = new URL(location.href);
    introURL.searchParams.set('ramka', '1');
    let intro;
    let app;
    let appReady;
    let requested;

    preview.classList.toggle('is-reduced', reduced);
    start.replaceWith(preview);

    function fitPhone() {
      const width = (window.innerWidth - 32) / shell.offsetWidth;
      const height = (window.innerHeight - controls.offsetHeight - 44) / shell.offsetHeight;
      const scale = Math.max(.55, Math.min(1, width, height));
      preview.style.setProperty('--phone-scale', scale);
    }

    function revealHome() {
      if (!appReady || !requested || intro.classList.contains('is-leaving')) return;
      const cover = intro;
      const destination = app;
      cover.classList.add('is-leaving');
      const transitions = cover.getAnimations?.() ?? [];
      Promise.allSettled(transitions.map(animation => animation.finished)).then(() => {
        if (intro !== cover) return;
        const hadFocus = document.activeElement === cover;
        cover.remove();
        destination.inert = false;
        destination.removeAttribute('aria-hidden');
        if (hadFocus) destination.focus();
      });
    }

    function reset(replaying = false) {
      appReady = false;
      requested = false;
      screen.replaceChildren();
      if (home) {
        // Dom ładuje się pod animacją. Oba dokumenty używają mobilnych wymiarów.
        const destination = document.createElement('iframe');
        app = destination;
        destination.title = 'ReLeaf — ekran Dom';
        destination.inert = true;
        destination.setAttribute('aria-hidden', 'true');
        destination.addEventListener('load', () => {
          if (app !== destination) return;
          appReady = true;
          revealHome();
        }, { once: true });
        destination.src = home.href;
        screen.append(destination);
      }
      const source = new URL(introURL);
      if (replaying) source.hash = '';
      intro = document.createElement('iframe');
      intro.title = 'ReLeaf — animacja wejścia';
      intro.className = 'phone-intro';
      intro.src = source.href;
      screen.append(intro);
    }

    window.addEventListener('message', event => {
      if (!home || event.source !== intro?.contentWindow || event.data !== homeMessage) return;
      requested = true;
      revealHome();
    });
    window.addEventListener('resize', fitPhone);
    replay.addEventListener('click', () => reset(true));
    fitPhone();
    reset();
  }

  function playOpening(onStart) {
    start.classList.toggle('is-reduced', reduced);
    start.classList.add('is-waiting');
    const artwork = Array.from(start.querySelectorAll('.start-logo img')).filter(img => img.offsetWidth);
    const ready = Promise.allSettled(artwork.map(img => img.decode?.()));

    ready.then(() => {
      // Najpierw rysujemy tło, potem zaczynamy od pierwszej klatki animacji.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!start.classList.replace('is-waiting', 'is-opening')) return;
        if (onStart) onStart();
      }));
    });
  }

  // Po lądowaniu ustalamy początek lotu, zanim ruszy noga i zmieni się widoczność nasionka.
  start.addEventListener('animationend', event => {
    if (event.animationName !== 'start-flight') return;
    const seed = start.querySelector('.start-seed');
    const screen = start.querySelector('.start-screen').getBoundingClientRect();
    const rest = start.querySelector('.start-seed-rest').getBoundingClientRect();
    const targetY = parseFloat(getComputedStyle(start).getPropertyValue('--start-seed-y')) / 100;
    seed.style.setProperty('--seed-from-x', (rest.left + rest.width / 2 - screen.left - screen.width / 2) + 'px');
    seed.style.setProperty('--seed-from-y', (rest.top + rest.height / 2 - screen.top - screen.height * targetY) + 'px');
  });

  if (home) {
    // Parametry podglądu przechodzą z animacji do właściwego Domu.
    const destination = new URL(home.href);
    for (const key of ['motyw', 'pora', 'uklad', 'pola', 'widok']) {
      if (params.has(key)) destination.searchParams.set(key, params.get(key));
    }
    home.href = destination.href;
  }

  if (!inPhonePreview && matchMedia('(min-width: 560px) and (pointer: fine)').matches) {
    mountPhonePreview();
    return;
  }

  if (!home) {
    const links = Array.from(start.querySelectorAll('.start-actions a'));
    window.addEventListener('hashchange', event => {
      start.classList.remove('is-waiting', 'is-opening');
      const heading = start.querySelector('.start-destination:target h1');
      const previous = new URL(event.oldURL).hash;
      const link = links.find(item => item.hash === previous);
      (heading || link || links[0]).focus({ preventScroll: true });
    });

    const startsAtMenu = !location.hash || location.hash === '#wejscie';
    if (startsAtMenu && !staticView) playOpening();
    return;
  }

  function openHome() {
    if (inPhonePreview) {
      // Przy otwarciu z dysku dokumenty w ramkach mogą mieć nieprzezroczyste pochodzenie.
      window.parent.postMessage(homeMessage, '*');
    } else {
      location.replace(home.href);
    }
  }

  if (inPhonePreview) {
    home.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openHome();
    });
  }
  if (staticView) return;

  playOpening(() => {
    const finale = reduced ? 'start-logo-out' : 'start-bloom';
    const phase = inPhonePreview && !reduced ? 'animationstart' : 'animationend';
    const styles = getComputedStyle(start.querySelector(reduced ? '.start-figure' : '.start-seed'));
    const milliseconds = value => {
      value = value.trim();
      return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
    };
    // Zapas na wypadek, gdy przeglądarka nie wyśle zdarzenia końca animacji.
    const durations = styles.animationDuration.split(',').map(milliseconds);
    const delays = styles.animationDelay.split(',').map(milliseconds);
    const total = Math.max(...durations.map((duration, i) => duration + delays[i % delays.length]));
    const beat = milliseconds(getComputedStyle(start).getPropertyValue('--dur-fast'));
    const fallback = setTimeout(openHome, total + beat);

    start.addEventListener(phase, event => {
      const layer = reduced ? 'start-figure' : 'start-seed';
      if (event.animationName !== finale || !event.target.classList.contains(layer)) return;
      clearTimeout(fallback);
      openHome();
    });
  });
})();
