(() => {
  'use strict';

  const root = document.documentElement;
  if (root.dataset.uklad !== 'd') return;

  const rail = document.querySelector('.releaf-scrollbar');
  const handle = rail.querySelector('.rl-handle');
  const range = rail.querySelector('.rl-range');
  const page = document.scrollingElement;
  const desktop = matchMedia('(min-width: 1024px) and (min-height: 360px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = value => Math.max(0, Math.min(1, value));
  const handleHeight = parseFloat(getComputedStyle(rail).getPropertyValue('--handle-h'));

  let maxScroll = 0;
  let travel = 0;
  let progress = 0;
  let angle = 22;
  let velocity = 0;
  let frame = null;
  let previousTime = null;
  let requestedTop = null;
  let drag = null;

  function schedule() {
    if (!rail.hidden && frame === null) frame = requestAnimationFrame(paint);
  }

  function measure() {
    root.classList.toggle('has-releaf-scrollbar', desktop.matches);
    maxScroll = desktop.matches ? Math.max(0, page.scrollHeight - page.clientHeight) : 0;
    rail.hidden = maxScroll === 0;
    travel = rail.hidden ? 0 : Math.max(0, rail.clientHeight - handleHeight);
    schedule();
  }

  // Ten sam ruch listka co w eksporcie: +22° u góry, 0° w połowie, −22° u dołu.
  function updateAngle(target, time) {
    if (reducedMotion.matches || root.classList.contains('is-static')) {
      angle = target;
      velocity = 0;
      return false;
    }
    // Tłumienie z eksportu wygładza ruch bez odbijania.
    const dt = previousTime === null ? 1 / 60 : Math.min((time - previousTime) / 1000, .05);
    const damping = 16;
    const displacement = angle - target;
    if ((target - angle) * velocity < 0) velocity = 0;
    const momentum = velocity + damping * displacement;
    const decay = Math.exp(-damping * dt);
    angle = target + (displacement + momentum * dt) * decay;
    velocity = (velocity - damping * momentum * dt) * decay;
    if (Math.abs(angle - target) < .015 && Math.abs(velocity) < .08) {
      angle = target;
      velocity = 0;
      return false;
    }
    return true;
  }

  function paint(time) {
    frame = null;
    const top = requestedTop;
    requestedTop = null;
    if (rail.hidden) {
      previousTime = null;
      return;
    }

    // Najwyżej jedno przewinięcie na klatkę, bez ponownego mierzenia układu.
    progress = clamp((top ?? window.scrollY) / maxScroll);
    if (top !== null) window.scrollTo({ top, behavior: 'instant' });
    const moving = updateAngle(22 - 44 * progress, time);
    const position = (progress * travel).toFixed(2);
    handle.style.transform = `translate3d(-50%, ${position}px, 0) rotate(${angle.toFixed(4)}deg)`;
    rail.classList.toggle('is-moving', moving);
    const value = String(Math.round(progress * 1000));
    if (range.value !== value) range.value = value;
    const description = Math.round(progress * 100) + '% strony';
    if (range.getAttribute('aria-valuetext') !== description) range.setAttribute('aria-valuetext', description);
    previousTime = moving ? time : null;
    if (moving) schedule();
  }

  function requestScroll(top) {
    requestedTop = top;
    schedule();
  }

  function move(event) {
    if (travel === 0) return;
    const y = event.clientY - drag.top - drag.offset;
    requestScroll(clamp(y / travel) * maxScroll);
  }

  range.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    rail.classList.add('is-pointer-focused');
    range.focus({ preventScroll: true });
    range.setPointerCapture(event.pointerId);
    const top = rail.getBoundingClientRect().top;
    const y = event.clientY - top - progress * travel;
    drag = { id: event.pointerId, top, offset: y >= 0 && y <= handleHeight ? y : handleHeight / 2 };
    move(event);
  });
  range.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId) move(event);
  });
  range.addEventListener('lostpointercapture', () => { drag = null; });
  // Natywny suwak nie przejmuje przeciągania na ekranie dotykowym komputera.
  for (const type of ['touchstart', 'touchmove']) {
    range.addEventListener(type, event => {
      event.preventDefault();
    }, { passive: false });
  }

  range.addEventListener('input', () => requestScroll(Number(range.value) / 1000 * maxScroll));
  range.addEventListener('blur', () => rail.classList.remove('is-pointer-focused'));
  range.addEventListener('keydown', event => {
    rail.classList.remove('is-pointer-focused');
    const step = page.clientHeight * .8;
    const top = requestedTop ?? window.scrollY;
    const positions = {
      ArrowUp: top - 40,
      ArrowDown: top + 40,
      PageUp: top - step,
      PageDown: top + step,
      Home: 0,
      End: maxScroll,
    };
    if (!Object.hasOwn(positions, event.key)) return;
    event.preventDefault();
    requestScroll(positions[event.key]);
  });

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('tabchange', () => {
    requestedTop = null;
    measure();
  });
  desktop.addEventListener('change', measure);
  reducedMotion.addEventListener('change', schedule);
  const observer = new ResizeObserver(measure);
  observer.observe(document.body);
  observer.observe(rail);
  measure();
})();
