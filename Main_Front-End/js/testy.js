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
      <span class="empty-mascot" aria-hidden="true"><img src="img/listek.webp" alt="" width="76" height="53"></span>
      <p class="empty-title">Wkrótce</p>
      <p>Tu pojawią się krótkie testy samopoczucia.</p>
    </div>`;
})();
