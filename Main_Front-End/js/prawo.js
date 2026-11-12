/*
 * Dokumenty (regulamin.html, polityka-prywatnosci.html): powrót i spis treści.
 *   • „Wróć”: dokument otwarty w nowej karcie (z rejestracji albo z „Konto i prywatność”) zamyka się,
 *     otwarty w tej samej karcie cofa do poprzedniej strony; gdy to niemożliwe, prowadzi do aplikacji.
 *   • Spis treści: na komputerze jest zawsze rozwinięty i podświetla czytany rozdział.
 *   • Wersja i data dokumentu są w <body data-wersja data-od> — ten sam numer co w js/zgody.js (DOCS) i w tabeli legal_documents.
 * SOS i toast obsługuje js/auth-common.js.
 */
(function () {
  'use strict';

  // ---------- powrót ----------
  document.querySelectorAll('[data-back]').forEach(a => a.addEventListener('click', e => {
    if (history.length > 1) { e.preventDefault(); history.back(); return; }
    // nowa karta: próbujemy ją zamknąć; jeśli przeglądarka nie pozwoli, zadziała zwykły odnośnik do aplikacji
    window.close();
  }));

  // ---------- spis treści ----------
  const toc = document.querySelector('.doc-toc details');
  if (!toc) return;
  const wide = window.matchMedia('(min-width: 1100px)');
  const sync = () => { if (wide.matches) toc.open = true; };
  sync();
  wide.addEventListener('change', sync);
  // na telefonie stuknięcie w rozdział zwija spis
  toc.addEventListener('click', e => { if (e.target.closest('a') && !wide.matches) toc.open = false; });

  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const sections = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if (!('IntersectionObserver' in window) || !sections.length) return;
  const seen = new Set();
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) seen.add(en.target.id); else seen.delete(en.target.id); });
    // podświetlamy pierwszy widoczny rozdział
    const first = sections.find(s => seen.has(s.id));
    links.forEach(a => {
      if (first && a.getAttribute('href') === `#${first.id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }, { rootMargin: '-10% 0px -55% 0px' });
  sections.forEach(s => io.observe(s));
})();
