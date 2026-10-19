/*
 * Testy samopoczucia (zakładka „Testy”) — na razie pusty ekran („wkrótce”).
 *
 * Plan: PHQ-9 (nastrój), GAD-7 (niepokój), PSS-10 (stres); każdy najwyżej raz w tygodniu.
 * Zasada bezpieczeństwa: PHQ-9, pytanie 9 > 0 → ZAWSZE linia kryzysowa i kontakty pomocowe (notes/CLAUDE.md).
 */
(function () {
  'use strict';

  const root = document.getElementById('testy-root');
  if (!root) return;

  root.innerHTML = `
    <div class="empty-state">
      <span class="empty-leaf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21v-9"/><path d="M12 12c0-4.2 3-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5z"/><path d="M12 14.5c0-3.2-2.4-5.2-6-5.2 0 3.2 2.4 5.2 6 5.2z"/></svg></span>
      <p class="empty-title">Wkrótce</p>
      <p>Tu pojawią się krótkie testy samopoczucia.</p>
    </div>`;
})();
