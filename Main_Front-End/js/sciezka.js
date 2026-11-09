/*
 * ŚCIEŻKA — „Ścieżka dookoła planety” (<html data-uklad="d" data-sciezka>, css/sciezka.css).
 *
 * Ten plik tylko przestawia to, co zbudował układ D (js/dom-uklad.js, buildD) — logika i dane zostają w window.Podlewanie:
 *  • Dom to jedna ścieżka: dziś (roślinka + panel na planecie) → Twój tydzień → Dla Ciebie teraz → Myśl na dziś.
 *    „Twój tydzień” idzie na początek, bo wzgórza tygodnia stoją tuż nad nim.
 *  • W panelu dnia dochodzi link „Twój tydzień”, który przewija do pierwszego przystanku (bez niego nie widać, że niżej coś jest).
 *  • Roślinka stoi teraz NAD treścią i nie łapie dotyku — stukanie w liście, wzgórza i przesuwanie palcem obsługuje scena
 *    (js/home2-scene.js, blok „Ścieżka”).
 * W React Native: kolejność sekcji w komponencie ekranu Dom; link = scrollTo na ref sekcji.
 */
(function () {
  'use strict';
  if (!document.documentElement.hasAttribute('data-sciezka')) return;

  const $ = (s, r = document) => r.querySelector(s);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('widok');

  const week = $('#sec-week'), next = $('.zy-next'), panel = $('#zy-panel');
  if (!week || !next || !panel) return;

  // 1. Kolejność przystanków
  next.parentNode.insertBefore(week, next);

  // Panel dnia leży na planecie, a planeta (canvas) jest NAD treścią — panel musi więc wyjść z <main> (inny kontekst warstw).
  // Stoi tuż przed treścią, więc kolejność czytania i fokusu zostaje: powitanie → dziś → reszta ścieżki.
  const content = $('#content');
  content.parentNode.insertBefore(panel, content);

  // 2. Link do pierwszego przystanku
  const main = $('.zy-f-main', panel);
  main.insertAdjacentHTML('beforeend', `
    <button type="button" class="sc-more" id="sc-more">Twój tydzień
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
    </button>`);
  $('#sc-more').addEventListener('click', () => {
    const top = week.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 84);
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    const h = $('.kicker', week);
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  });

  // 3. „Jak to działa?”: te same zasady co dla liści, plus jedno zdanie o wzgórzach
  const how = $('.how', week);
  if (how) {
    const lead = $('summary b', how);
    if (lead) lead.textContent = 'Każdy liść i każde wzgórze to jeden z ostatnich 7 dni.';
    const tip = $('summary span', how);
    if (tip && tip.childNodes[1]) tip.childNodes[1].textContent = ' Stuknij dzień, liść albo wzgórze. ';
    const ul = $('ul', how);
    if (ul) ul.insertAdjacentHTML('afterbegin', '<li><b>Wzgórza za roślinką to Twój tydzień.</b> Wyższe wzgórze = lepszy dzień. Dzień odpoczynku to równa łąka z uśpionym pąkiem: nic nie znika.</li>');
  }
})();
