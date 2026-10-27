# SCI++

## Project overview

SCI++ (working name; the real name isn't chosen yet) is a mental-health / wellbeing app for teenagers. It started as a school project (vocational internship), and the team wants to take it further. Team: Marcel (founder, backend, Supabase), Waldek (backend), Bartek (design + frontend), Tymek (frontend).

**This repo is the design prototype**, built in plain HTML/CSS/JS. The target product is **React Native + Expo Router + React Native Web** (iOS, Android and web from one codebase), styled with NativeWind and backed by Supabase. Build every screen here so it ports easily: split screens into components (JS functions that return markup), keep data separate from markup, and take all colours from tokens.

**Read `notes/CLAUDE.md` before designing anything.** It holds the product context from the team's plan: features, tabs, the check-in data model, the target stack, safety rules (crisis lines, PHQ-9 question 9, GDPR Art. 9), the team's decisions and the open questions.

## Working agreements

- UI copy is in **Polish**. Write code comments in Polish too, matching the existing files.
- **Mobile-first.** Phones are the main target. Every screen also has to look good on a tablet and on desktop.
- The mood is **calm, modern and orderly**. The **plant is the app's central motif**: it grows as the user takes care of themselves.
- **Never punish the user.** The plant never wilts or dies, and a missed day never removes anything. Guilt is harmful in a mental-health app.
- Keep an **SOS button visible** on in-app screens. For now it lists 116 111 (the free, 24/7 helpline for children and young people in Poland) and 112. The team still has to confirm the numbers.
- Accessibility: use real text rather than text drawn on canvas for anything important, keep visible focus styles, add `aria-*` where it's needed, support `prefers-reduced-motion`, and keep white text on `--primary` at least as readable as the default theme.

## Running it

- There's no build step. Each page also works opened straight from disk (`file://`), so use classic `<script defer>` files and never ES modules.
- For a local server, serve the `Main_Front-End/` folder with any static server, e.g. `npx serve Main_Front-End` or `python3 -m http.server -d Main_Front-End`, and open `index.html`, which lists all screens.
- After layout changes run `node narzedzia/sprawdz-nakladanie.js` (Playwright): it checks 6 widths × light/dark × Dom/Skrytka/Tracker/Blog × assistant closed/open (also mid-opening) for overlapping elements, elements under the assistant panel, a plant canvas wider than its stage, horizontal scroll and clipped tab labels.
- **Test in a phone viewport first**, e.g. 375×812, then tablet (~820) and desktop (≥1024).
- URL helpers:
  - `?motyw=<id>` previews a theme without saving it (`morski`, `zielony`, `niebieski`, `lawenda`, `rozowy`, `morelowy`).
  - `?widok=statyczny` renders a page without animation and with demo data (for screenshots and team previews).
- Canvas scenes only animate while the tab is visible. When the browser tab is in the background (e.g. during automated testing), call `HomeScene.debugAdvance(sec)` / `Home2Scene.debugAdvance(sec)` in the console to step the scene forward manually.

## Structure (`Main_Front-End/`)

| Screen | Files |
|---|---|
| Screen index | `index.html` |
| Login | `logowanie.html`, `js/logowanie.js` |
| Registration (3 stages, one question per screen on phones) | `rejestracja.html`, `js/rejestracja.js` |
| Shared by login and registration | `css/auth.css`, `js/auth-common.js` (toast, haptics, password field, `account` storage), `js/plant-scene.js` (growing plant canvas, `window.PlantScene`) |
| **The app: all tabs on one page (main entry)** | `aplikacja.html`, `css/app.css`, `js/app.js` (tabs/router) — see "The app" below |
| Home page, version 1: branch in the background | `strona-glowna.html`, `css/home.css`, `js/home.js`, `js/home-scene.js` |
| **Home page, version 2: plant on top (current direction)** | `strona-glowna-2.html`, `css/home2.css`, `js/home2.js`, `js/home2-scene.js` |
| Check-in, first question only (the design `aplikacja.html` reuses) | `nastroj.html`, `css/checkin.css`, `js/nastroj.js`, `css/mood-slider.css`, `js/mood-slider.js` |
| Bottom sheets (shared) | `js/sheets.js` (`window.Sheets`) |
| Themes and tokens | `css/tokens.css`, `js/theme.js` |

### The app (`aplikacja.html`)

- One page with five tabs from the plan: **Dom · Skrytka · Tracker · Testy · Blog**. The tab lives in the hash (`#/skrytka`), so it works from `file://` and the back button switches tabs. `js/app.js` handles the tabs, remembers each tab's scroll position, and wires `[data-sos]`, `[data-breath]` and `[data-go]`.
- The app should feel **calm**: little text per screen, soft cards, slow fade-in animations (`soft-in`, staggered by `--i`). Prefer hiding details behind a tap (expand) over showing everything.
- Phone: tab bar at the bottom; the plant stage shows only on the Dom tab. On Dom the content card scrolls **over** the plant (the stage sits underneath and drifts up slightly); the top bar with logo, colour and SOS (`.app-top`, outside the stage) stays on top and gets a background once the card reaches it. The stage has `data-blisko`, so on phones the plant is bigger and sits a bit to the right of the greeting. The plant can grow to **full screen** (`Home2Scene.full(t)`, logic in `js/app.js`): the zoom button at the stage's bottom-right corner (`#plant-zoom`, always works), pulling down at the very top, or the iOS rubber band (`scrollY < 0`). Some hosts (e.g. the Claude app showing the artifact) swallow the pull gesture, hence the button. The card slides down to a peek; a swipe up, a tap on the card or the button brings it back. Tablet: floating tab bar. Desktop: the plant stays in the left half on every tab, content and floating tab bar on the right.
- **Dom** is home v2 (`js/home2.js`). "Podlej roślinkę" opens the check-in (`js/checkin.js`, `window.Checkin`): the screen grows as a circle out of the button. Step 1 is the `nastroj.html` design (mood slider + support at mood ≤ 3), then sleep, "what mattered today" (food, family, friends, love, nature, study: −1/0/1) and a note. Every question can be skipped. After the last one the circle shrinks into the plant and it rains (`Home2Scene.water(mood)` sizes today's leaf from the mood).
- **Skrytka** has two panes (`#skrytka-seg`): thoughts and the **Słoik dobrych chwil** (`js/sloik.js`, `localStorage` `sci.sloik`): small good moments shown as fireflies in a jar; a tap draws one at random, and after a check-in with mood 1–3 the home page shows one (`watered` event from `js/home2.js`).
- **Asystent Wsparcia** (`js/asystent.js`, `css/asystent.css`, `window.Asystent`): chat screen that grows as a circle from where it was opened (on desktop a separate floating window on the right with its own solid background, not the page lights). Entry points: the sprout button (`#as-fab`, every tab, bottom-right; on desktop the content keeps a right gutter `--gutter` for it and the round „Napisz” button on Blog sits under it), the "Porozmawiaj z Asystentem" shortcut on Dom (`[data-asystent]`), the low-mood support button in the check-in, and Skrytka. Replies are demo text; user messages go through `js/moderacja.js` and `kryzys` shows 116 111 / 112 / breathing. `asystent-makieta.html` is the earlier standalone mockup.
- **Skrytka thoughts** (`js/skrytka.js`): one text field and two buttons. "Schowaj" saves (prototype: `localStorage` `sci.skrytka`, unencrypted), "Puść z wiatrem" lets a thought fly away as a leaf and saves nothing. Saved thoughts sit in a two-column grid (three on tablet), collapsed; a tap expands one to full width with "Zapytaj Asystenta" and "Usuń". "Zapytaj Asystenta" asks for consent first, then the card folds into a leaf that flies to the sprout button and the chat grows out of it (AI only on explicit request). On first open Skrytka is seeded with a few demo thoughts (prototype only).
- **Blog** (`js/blog.js`): a calm list (title + 2 lines), Popularne/Nowe and a floating "Napisz" button. A tap expands a post (full text, comments, report). Anonymous plant pseudonyms, votes. Every post and comment goes through **`js/moderacja.js`**, a word-list DEMO with the API the real AI moderation will have: `kryzys` (self-harm → not published, 116 111 / 112 / breathing / "schowaj w Skrytce"), `obrazliwe` (insults, threats → highlighted, "popraw"), `dane` (phone, e-mail, @nick), `ok`. Crisis words in the check-in note and in Skrytka don't block anything but show 116 111 right away.
- **Tracker** (`js/tracker.js`), insight-first (fixed demo data, 8 weeks):
  - "Twój tydzień w skrócie": 7 small bars and 3 sentences (average vs last week, best day and what helped, one thing to try);
  - "Co zauważyliśmy": personalised insights, each showing only a title, a small chart and one short sentence; the possible causes computed from the data and the suggestion are folded under "Skąd to może się brać?" (keep the screen calm) ("Może to wynikać z tego, że…": shorter sleep the night before, study stress, fewer outings…) and one suggestion. Example: "Niedzielne wieczory bywają trudniejsze". Wording is a hint, never a diagnosis;
  - "Co Ci pomaga": the 3 check-in answers with the highest mood above average;
  - "Zielnik": one pressed flower per week with at least 3 waterings; weeks without one simply don't appear. **Testy** (`js/testy.js`): empty "coming soon" screen for now.
- **Oddychaj z roślinką** (`js/oddech.js`, `window.Oddech`): one minute of breathing (4 s in, 2 s hold, 6 s out) with a flower that opens and closes, plus optional nature sounds generated with Web Audio (rain, waves that follow the breath, forest). Reachable from SOS, from a shortcut on Dom and from the blog's crisis screen.
- **SOS** also has **Twoje bliskie osoby** (`js/kontakty.js`, `localStorage` `sci.kontakty`): 1–3 trusted contacts, one tap to call, number also shown as text.
- **Myśl na dziś** (`js/cytaty.js`): a different own-written thought every day, heart to save (`sci.cytaty`), share (system share or copy), and a sheet with saved thoughts.
- **Tryb nocny**: `Theme.setMode('auto'|'light'|'dark')` in `js/theme.js` sets `<html data-mode>` (saved in `sci.mode`); `css/tokens.css` redefines only the neutral tokens for dark (also follows the system setting in auto). The switch is in the "Kolor roślinki" sheet. The plant scene shows a night sky with stars and the moon in dark mode. Use `--glass`, `--toast-bg` / `--toast-fg` instead of hard-coded white or dark colours.

### Colours and themes

- Tokens live in `css/tokens.css`. **Never hard-code theme colours**; use `var(--primary)`, `rgba(var(--primary-rgb), .1)`, `var(--plant-leaf-1)` and so on.
- The user picks a plant colour at the end of registration, and the whole palette follows it. There are six calm, muted themes and **no reds or neons**:
  - `morski` (default, the "Clean Teal" palette)
  - `zielony`
  - `niebieski`
  - `lawenda`
  - `rozowy`
  - `morelowy`
- The colour can be changed again on the home page (v2) with the round button next to SOS.
- `js/theme.js` is loaded **without `defer`** in `<head>`, right after the stylesheets, so the theme is set before first paint. It sets `<html data-theme>`, saves the choice in `localStorage` (`sci.theme`), and fires a `themechange` event on `window`.
- Canvas scenes read the `--plant-*` tokens (always written as `#RRGGBB`) and recolour smoothly on `themechange`.
- Background lights: `body::before` (drifting, `css/home2.css`) and the shared `--glow` token in `tokens.css` (strength `--aura`, weaker in dark). Any full-screen layer with its own background (assistant on phone, check-in) uses `var(--glow)` too, and bars over it (headers, tab bar, sticky footers) are transparent or semi-transparent (`color-mix(in srgb, var(--sheet) 86%, transparent)`) so they never cut the light with a hard edge.
- `[data-palette="<id>"]` gives any element the tokens of a given theme. The colour swatches use this.
- To add a theme, add one block to `tokens.css` and one entry to the `LIST` in `theme.js`.

### Canvas scenes (the plant)

- All three scenes (`plant-scene.js`, `home-scene.js`, `home2-scene.js`) follow the same pattern. Each is an IIFE that exposes a small API on `window`. Everything is drawn procedurally on a 2D canvas with DPR capped at 2. Growth uses critically damped springs, colours come from theme tokens, and `prefers-reduced-motion` or `?widok` turns the animation off.
- Geometry uses "plant units", where the full height is about 100 units and y points up (negative). The scene scales these to pixels (`S`) to fit its area.
- In React Native these would be rebuilt with `react-native-skia` (or SVG + Reanimated), measuring layout with `onLayout`.

### Home page v2: how the plant works

These are the current rules. They are also shown on the page under "Jak działa roślinka?", and the team still has to confirm them.

- The 7 twigs are the **last 7 days**. The window moves every day at midnight, and there is **no weekly reset**.
- A day with an entry ("Podlewanie" = watering = the daily mood check-in) gets a leaf. Its size and colour intensity come from that day's mood.
- A day without an entry gets a small, pale "sleeping" bud. Nothing wilts.
- Today is a bud in a dashed circle, and it opens after watering.
- The flower is open when there were at least 3 waterings in the last 7 days. Otherwise it closes into a bud and reopens with the next watering.
- The oldest leaf falls off every day, which the page animates on load.
- The weekly score is the average of the days that have an entry only.
- Scrolling:
  - scroll speed turns into wind;
  - reaching "Twój tydzień" shows day labels and sends a light wave through the day leaves;
  - reaching "Myśl na dziś" makes the flower flash and shed petals.
- Tapping a day leaf or a day bar highlights both, via the `dayselect` event.
- The stage tint depends on the time of day.

### Data and backend (not built yet)

- There's no backend. Login and password reset are simulated (see `TODO backend` in `js/logowanie.js`).
- Registration keeps the profile in `localStorage` (`sci.account`) so the other screens can greet the user. It **never stores the password**.
- The "Twój tydzień" data on the home page is **random demo data**, generated in `js/home2.js` and shaped like the planned `daily_checkins` table: mood 1–10 per day, `null` means no entry.
- In `aplikacja.html` the check-in answers, blog posts and votes live only in page memory; Skrytka uses `localStorage`. On `strona-glowna-2.html` the "Podlej roślinkę" button only plays the animation.
- Blog moderation is a word list (`js/moderacja.js`) until the AI moderation exists (planned as a server-side function).
