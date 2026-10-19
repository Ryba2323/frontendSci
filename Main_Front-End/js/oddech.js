/*
 * Oddychaj z roślinką — minuta spokojnego oddechu (BreathingCircle z planu, tryb SOS z P2).
 *
 * Kwiat z 6 płatków otwiera się przy wdechu (4 s), chwilę trwa (2 s) i zamyka przy wydechu (6 s).
 * Dłuższy wydech niż wdech uspokaja. 5 oddechów ≈ 1 minuta; pierścień pokazuje postęp.
 * Najważniejszy jest tekst (Wdech / Zatrzymaj / Wydech + sekundy) — działa też bez animacji (prefers-reduced-motion).
 * Otwierany z arkusza SOS, ze skrótu na stronie głównej i z bloga (gdy wpis brzmi kryzysowo).
 *
 * Dźwięki natury (do wyboru, domyślnie cisza): deszcz, fale, las — generowane w przeglądarce (Web Audio, bez plików).
 * Fale idą razem z oddechem: rosną przy wdechu, cichną przy wydechu. Dźwięk startuje dopiero po stuknięciu (wymóg przeglądarek)
 * i gaśnie łagodnie po zamknięciu arkusza.
 *
 * window.Oddech.open()
 * W React Native: Reanimated (withTiming / withSequence) + Haptics przy zmianie fazy.
 */
(function () {
  'use strict';

  const sheet = document.getElementById('breath-sheet');
  if (!sheet) return;
  const Sheets = window.Sheets || { show() {} };
  const { haptic } = window.AuthCommon;

  const PHASES = [
    { name: 'Wdech', hint: 'nosem, powoli', dur: 4, open: true },
    { name: 'Zatrzymaj', hint: 'bez spinania', dur: 2, open: true },
    { name: 'Wydech', hint: 'ustami, dłużej niż wdech', dur: 6, open: false },
  ];
  const ROUNDS = 5;
  const TOTAL = ROUNDS * PHASES.reduce((a, p) => a + p.dur, 0);
  const R = 92, C = 2 * Math.PI * R;

  // ================================================================
  //  Dźwięki natury (Web Audio). W React Native: expo-av z nagraniami.
  // ================================================================
  const Sound = (() => {
    let ac = null, master = null, bed = null, live = [], loop = null, kind = 'cisza';
    const VOL = .55;
    function ensure() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ac) { ac = new AC(); master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination); }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    // szum: 'white' albo 'brown' (cieplejszy, niski — fale, wiatr)
    const bufs = {};
    function noise(color) {
      if (bufs[color]) return bufs[color];
      const len = ac.sampleRate * 3, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (color === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
      }
      return (bufs[color] = b);
    }
    function loopSrc(color) { const n = ac.createBufferSource(); n.buffer = noise(color); n.loop = true; n.start(); live.push(n); return n; }
    function filter(type, f, q = .7) { const x = ac.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
    function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }

    function rain() {
      const g = ac.createGain(); g.gain.value = .32;
      chain(loopSrc('white'), filter('highpass', 500), filter('lowpass', 5200), g, master);
      // pojedyncze krople
      const drop = () => {
        const n = ac.createBufferSource(); n.buffer = noise('white');
        const f = filter('bandpass', 1800 + Math.random() * 3200, 6), e = ac.createGain(), t = ac.currentTime;
        e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(.05 + Math.random() * .06, t + .005); e.gain.exponentialRampToValueAtTime(.0001, t + .06);
        chain(n, f, e, master); n.start(t, Math.random() * 2); n.stop(t + .08);
      };
      loop = setInterval(() => { for (let k = 0; k < 3; k++) if (Math.random() < .7) setTimeout(drop, Math.random() * 120); }, 120);
    }
    function waves() {
      bed = ac.createGain(); bed.gain.value = .2;
      chain(loopSrc('brown'), filter('lowpass', 650), bed, master);
      // bez ćwiczenia: fala co 9 s
      let up = true;
      const swell = () => { if (!bed) return; const t = ac.currentTime; bed.gain.cancelScheduledValues(t); bed.gain.setValueAtTime(bed.gain.value, t); bed.gain.linearRampToValueAtTime(up ? .75 : .14, t + 4.5); up = !up; };
      swell(); loop = setInterval(() => { if (!running) swell(); }, 4500);
    }
    function forest() {
      const g = ac.createGain(); g.gain.value = .16;
      chain(loopSrc('brown'), filter('lowpass', 1400), g, master);
      const bird = () => {
        const t0 = ac.currentTime, n = 2 + Math.floor(Math.random() * 3), base = 2400 + Math.random() * 1400;
        for (let k = 0; k < n; k++) {
          const o = ac.createOscillator(), e = ac.createGain(), t = t0 + k * (.11 + Math.random() * .05);
          o.type = 'sine'; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * .3), t + .08);
          e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(.035, t + .02); e.gain.exponentialRampToValueAtTime(.0001, t + .1);
          chain(o, e, master); o.start(t); o.stop(t + .12);
        }
      };
      loop = setInterval(() => { if (Math.random() < .5) bird(); }, 1300);
    }
    function silence(now) {
      clearInterval(loop); loop = null;
      const old = live; live = []; bed = null;
      if (!ac) return;
      const t = ac.currentTime;
      master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + (now ? .05 : .7));
      setTimeout(() => old.forEach(n => { try { n.stop(); } catch (_) { /* już stoi */ } }), now ? 80 : 750);
    }
    function play(k) {
      kind = k;
      if (k === 'cisza') { silence(); return; }
      if (!ensure()) return;
      silence(true);
      setTimeout(() => {
        if (kind !== k) return;
        ({ deszcz: rain, fale: waves, las: forest })[k]();
        const t = ac.currentTime;
        master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(0, t); master.gain.linearRampToValueAtTime(VOL, t + 1.2);
      }, 90);
    }
    // fale za oddechem
    function phase(open, dur) {
      if (!bed || kind !== 'fale') return;
      const t = ac.currentTime;
      bed.gain.cancelScheduledValues(t); bed.gain.setValueAtTime(bed.gain.value, t);
      bed.gain.linearRampToValueAtTime(open ? .8 : .12, t + dur);
    }
    return { play, stop: () => { kind = 'cisza'; silence(); }, phase, get kind() { return kind; } };
  })();

  sheet.innerHTML = `
    <span class="grabber" aria-hidden="true"></span>
    <h2 class="sos-title" id="breath-title">Oddychaj z roślinką</h2>
    <p class="sos-sub">Kwiat się otwiera — wdech. Zamyka — wydech. Około minuty.</p>
    <div class="breath" aria-hidden="true">
      <svg class="breath-ring" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="${R}" class="track"/>
        <circle cx="100" cy="100" r="${R}" class="fill" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/>
      </svg>
      <div class="breath-flower">${Array.from({ length: 6 }, (_, k) => `<i style="--k:${k}"></i>`).join('')}<b></b></div>
    </div>
    <p class="breath-phase" id="breath-phase" aria-live="polite">Usiądź wygodnie</p>
    <p class="breath-hint" id="breath-hint">Gdy zaczniesz, prowadź oddech za kwiatem.</p>
    <div class="sound-row" role="group" aria-label="Dźwięk w tle">
      ${['cisza', 'deszcz', 'fale', 'las'].map((k, i) => `<button type="button" class="chip sound-chip" data-sound="${k}" aria-pressed="${i === 0}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}
    </div>
    <button type="button" class="btn-primary" id="breath-go">Zacznij</button>
    <button type="button" class="sos-close" data-close>Zamknij</button>`;

  const flower = sheet.querySelector('.breath-flower');
  const fill = sheet.querySelector('.fill');
  const phaseEl = sheet.querySelector('#breath-phase');
  const hintEl = sheet.querySelector('#breath-hint');
  const go = sheet.querySelector('#breath-go');
  let timers = [], running = false;

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    running = false;
    flower.classList.remove('is-open');
    flower.style.setProperty('--dur', '.6s');
    fill.style.transition = 'stroke-dashoffset .4s ease';
    fill.style.strokeDashoffset = C;
  }

  function start() {
    stop();
    running = true;
    go.hidden = true;
    void fill.getBoundingClientRect();
    fill.style.transition = `stroke-dashoffset ${TOTAL}s linear`;
    fill.style.strokeDashoffset = 0;
    let t = 0;
    for (let r = 0; r < ROUNDS; r++) {
      for (const p of PHASES) {
        const at = t;
        timers.push(setTimeout(() => {
          flower.style.setProperty('--dur', `${p.dur}s`);
          flower.classList.toggle('is-open', p.open);
          Sound.phase(p.open, p.dur);
          haptic(p.open && p.name === 'Wdech' ? 12 : 6);
          for (let s = 0; s < p.dur; s++) {
            timers.push(setTimeout(() => {
              phaseEl.textContent = `${p.name} · ${p.dur - s}`;
              hintEl.textContent = `${p.hint} · oddech ${r + 1} z ${ROUNDS}`;
            }, s * 1000));
          }
        }, at * 1000));
        t += p.dur;
      }
    }
    timers.push(setTimeout(() => {
      running = false;
      flower.classList.remove('is-open');
      phaseEl.textContent = 'Dobra robota.';
      hintEl.textContent = 'Zauważ, jak się teraz czujesz. Możesz powtórzyć, ile chcesz.';
      go.textContent = 'Jeszcze raz';
      go.hidden = false;
      go.focus({ preventScroll: true });
    }, TOTAL * 1000));
  }

  go.addEventListener('click', start);
  sheet.querySelector('.sound-row').addEventListener('click', e => {
    const b = e.target.closest('[data-sound]');
    if (!b) return;
    sheet.querySelectorAll('[data-sound]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    Sound.play(b.dataset.sound);
  });

  function open() {
    stop();
    go.hidden = false;
    go.textContent = 'Zacznij';
    phaseEl.textContent = 'Usiądź wygodnie';
    hintEl.textContent = 'Gdy zaczniesz, prowadź oddech za kwiatem.';
    sheet.querySelectorAll('[data-sound]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.sound === 'cisza')));
    Sheets.show(sheet, { onClose: () => { stop(); Sound.stop(); } });
  }

  window.Oddech = { open, get running() { return running; } };
})();
