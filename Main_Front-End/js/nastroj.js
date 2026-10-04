/*
 * Ekran „Jak się dziś czujesz?” — pierwsze pytanie codziennego podlewania (nastroj.html).
 * Suwak: js/mood-slider.js. Toast i wibracja: js/auth-common.js.
 *
 * Każde pytanie można pominąć: bez wyboru przycisk mówi „Pomiń”, po wyborze — „Dalej”.
 * Przy nastroju 1–3 karta wsparcia się wyróżnia (Asystent + 116 111). Asystent to plan P2 — na razie tylko przycisk.
 * ?widok=statyczny — bez animacji, z przykładową wartością (zrzuty dla zespołu).
 */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const { toast, haptic } = window.AuthCommon;
  const view = new URLSearchParams(location.search).get('widok');
  if (view) document.documentElement.classList.add('is-static');

  // Zdanie pod suwakiem dla każdej wartości (bez form zależnych od płci)
  const NOTES = [
    'Dzięki, że mówisz, jak jest.',
    'Daj sobie dziś chwilę oddechu.',
    'Bywają takie dni. Dobrze, że jesteś.',
    'Tak sobie też jest w porządku.',
    'Zwyczajny dzień też się liczy.',
    'Nieźle! Co dziś pomogło?',
    'Miło to słyszeć.',
    'Super! Roślinka zakwita.',
    'Świetnie! Zapamiętaj, co pomogło.',
    'Wspaniale! Pełny rozkwit.',
  ];
  const LOW = 3; // do tej wartości włącznie wyróżniamy wsparcie

  const note = $('#mood-note');
  const support = $('#support');
  const nextLabel = $('#next-label');

  let noteTimer;
  function showNote(v) {
    const text = v == null ? '' : NOTES[v - 1];
    if (note.textContent === text) return;
    clearTimeout(noteTimer);
    note.classList.add('is-fading');
    noteTimer = setTimeout(() => { note.textContent = text; note.classList.remove('is-fading'); }, view ? 0 : 160);
  }

  function update(v) {
    showNote(v);
    support.classList.toggle('is-low', v != null && v <= LOW);
    nextLabel.textContent = v == null ? 'Pomiń' : 'Dalej';
  }

  const mood = window.MoodSlider.create($('#mood'), {
    value: view ? 7 : null,
    onInput: update,
    onChange: update,
  });
  update(mood.value);

  // ================================================================
  //  Przyciski
  // ================================================================
  $('#next-btn').addEventListener('click', () => {
    const v = mood.value;
    haptic(10);
    // TODO: tu przejdziemy do kolejnego pytania, a po ostatnim — na stronę główną z animacją podlewania
    toast(v == null ? 'Pominięte — tu pojawi się kolejne pytanie.' : `Zapisane: ${v}/10 — tu pojawi się kolejne pytanie.`);
  });

  $('#assist-btn').addEventListener('click', () => {
    // TODO: Asystent Wsparcia (chatbot AI, plan P2) — tu otworzy się rozmowa
    toast('Asystent Wsparcia jest w przygotowaniu — tu otworzy się rozmowa.');
  });
})();
