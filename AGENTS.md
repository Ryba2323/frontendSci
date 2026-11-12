# SCI++

## Project overview

SCI++ (working name; the real name isn't chosen yet) is a mental-health / wellbeing app for teenagers. It started as a school project (vocational internship), and the team wants to take it further. Team: Marcel (founder, backend, Supabase), Waldek (backend), Bartek (design + frontend), Tymek (frontend).

**This repo is the design prototype**, built in plain HTML/CSS/JS. The target product is **React Native + Expo Router + React Native Web** (iOS, Android and web from one codebase), styled with NativeWind and backed by Supabase. Build every screen here so it ports easily: split screens into components (JS functions that return markup), keep data separate from markup, and take all colours from tokens.

**Read `notes/AGENTS.md` before designing anything.** It holds the product context from the team's plan: features, tabs, the check-in data model, the target stack, safety rules (crisis lines, support at a low WHO-5 result, GDPR Art. 9), the team's decisions and the open questions.

## Working agreements

- UI copy is in **Polish**. Write code comments in Polish too, matching the existing files.
- **Mobile-first.** Phones are the main target. Every screen also has to look good on a tablet and on desktop.
- The mood is **calm, modern and orderly**. The **plant is the app's central motif**: it grows as the user takes care of themselves.
- **Never punish the user.** The plant never wilts or dies, and a missed day never removes anything. Guilt is harmful in a mental-health app.
- Keep an **SOS button visible** on in-app screens. For now it lists 116 111 (the free, 24/7 helpline for children and young people in Poland) and 112. The team still has to confirm the numbers.
- Accessibility: use real text rather than text drawn on canvas for anything important, keep visible focus styles, add `aria-*` where it's needed, support `prefers-reduced-motion`, and keep white text on `--primary` at least as readable as the default theme.

## Visual direction: "Żywa planeta" (default since 6.11.2026, `css/zywa.css`, proposal to confirm with the team)

Built on "Mała planeta" below; it fixes the phone: the plant used to disappear behind a white card, leaving only text. Scope: `<html data-uklad="d">` (set by an inline script in `aplikacja.html`). `?uklad=a|b|c|stary` still show the older versions, unchanged.

- **One world, no card (phone, tablet).** The planet's surface and the page background are the same colour, `--ground`; the scene computes it from `--sheet`, `--plant-ground` and `--ground-k` and writes it to `<html>`, so canvas and CSS can't drift apart. Content lies on the planet. Never put a full-width opaque card under it.
- **The plant never leaves the screen.** While scrolling, the scene collapses with the content into a band (`--band-h`) with a small live plant; tapping the band scrolls back up. `frameLayoutPlanet()` in `js/home2-scene.js` does this with one canvas, without resizing it.
- **Quiet scene (rule after user feedback, "too much is happening").** Dom's first screen has three things: the plant, the week, "Podlej roślinkę"; the top bar has only the wordmark, the Assistant and SOS. On other tabs the scene shows the plant and that tab's single place next to it (`SLOT`). The plant is only the stem, the 7 day leaves, two lower leaves and the flower. No bokeh, falling leaves, automatic petals, grass, or other places on the horizon; by day fireflies appear only after a touch; motion answers a touch. Don't add anything to this screen without removing something. Colour and full screen moved to the end of Dom (`.zy-foot-links`). Desktop keeps the whole globe with all places.
- **Shapes and type.** Soft, never pills and never hard rectangles: `--radius-sm` 16, `--radius-md` 24, `--radius-lg` 30; don't use `corner-shape: squircle` (it looks square and iPhones don't support it). Depth comes from shadows (`--e1` cards and tiles, `--e2` floating things), not borders; this replaces the "no shadow on cards" rule in layout D. Bricolage Grotesque for headings, big numbers and personal content (still `--font-serif`, though it's a sans) + Figtree for the rest (Marcel's pick, 6.11.2026; login and registration still use the old fonts). Weight 400 for text, 600 for emphasis, 500 for serif headings; no 800.
- **Motion explains what happened; tokens only (`--dur-*`, `--spring`, `--spring-soft`), `.is-static` turns it off.** First entry: the week branch draws, leaves sprout one by one, the button rises. "Podlej roślinkę" opens into the number card (`clip-path` from the button's exact spot). A tapped number sends a drop along an arc to today's bud (`Scene.budPos()`, 700 ms); its landing saves the entry and starts the rain, the plant "breathes", light runs along the branch and today's leaf sprouts. Tabs: sliding indicator, content enters from the tab's direction with a short stagger, the place springs out of the planet. Everything tappable compresses and springs back. "Myśl na dziś" reveals word by word once.
- **The week is one branch:** one stem with a leaf per day (better day = bigger leaf), rest day = small bud, today = bud at the end that opens after watering.
- **Colour has three jobs.** Sky = time of day (the main colour field, stronger than before). Theme = what you do and what grows (`--primary`, leaves). Warm light = support and good moments (`--plant-core`: SOS lantern, help at low mood, fireflies, flower core). `--cat-*` stays Tracker-only.
- **Dom's first screen doesn't scroll:** plant, 7 days, one button. The panel (`.zy-panel`, `buildD()` in `js/dom-uklad.js`) keeps one height (`--dom-panel`) in every state, so nothing jumps and the rain stays visible: `idle` (7 days + "Podlej roślinkę") → `choose` (10 numbers in the same spot) → `done` ("Podlane · 7/10 · dobrze", Zmień) or `low` (mood 1–3: Asystent + 116 111 right there). Two taps, no overlay. Details stay optional behind the "+" chips below; the data flow is still `window.Podlewanie`.
- **Nothing floats on phones.** The Assistant is a tile in the top bar (mascot peeking over its edge, same shape as SOS), so it never covers text; "Napisz" sits next to the Blog title.
- **Tracker is readable at a glance:** each block is a card (conclusion first, chart under it), bars are tall and solid with a value above each one, the day an insight is about is the only coloured bar in its chart.
- **Three levels of text, on every tab:** section titles are real serif headings (`.sheet .kicker` too, no small grey labels), reading text uses `--text-body`, only dates and captions use `--text-muted` / `--text-soft`. Cards use `--surface` + `--line` and must stand out from `--ground` (at night the card is lighter than the ground). The contrast test can't see hierarchy, so check this by eye.
- Not tested on a real phone yet (only Playwright and browser emulation). Test with teenagers before the team treats this as chosen.
- **Colour fields ("Pola koloru", 8.11.2026, `css/pola.css`, `<html data-pola>`, on by default in D and E; `?pola=0` shows the look without them).** The team's feedback was that every box was white and the app had no character. The fix keeps colour scarce: only two colours on cards, both from the theme, so each of the 6 themes gives a different app.
  - **Field (`--pole`)**: one card per screen filled with `--primary`, white text and a leaf silhouette in the corner: the most important data about you (Dom: "Twój tydzień", Tracker: the week summary). Never two on one screen. Every text in it is white; hierarchy comes from size, never grey. Its gradient only darkens towards the bottom, so white text keeps its contrast.
  - **Card (`--pole-soft`)**: ordinary cards are tinted with the theme colour instead of white (insights, "Co Ci pomaga", thoughts in Skrytka, an open blog post, the "Podlane" chip).
  - **Warm (`--pole-warm`)**: suggestions and support ("Dla Ciebie teraz", "Spróbuj" in Tracker) use the same warm light as SOS and the fireflies.
  - **Leaf shape (`--leaf`)**: every card has one sharp corner (bottom left). "Myśl na dziś" and lists (Blog) stay without a card.
  - `--cat-*` stays Tracker-only, in charts. Don't add a third card colour; if something new needs emphasis, it is either the screen's one field or a tinted card.
  - **Card backgrounds**: every card (and the field) has a pale background motif behind the text, one `::after` with several masks: a = leaves + flower, b = leaves + water drops, c = vine with a bud, d = leaf + petals. Lists alternate them; low cards (SOS, "Dla Ciebie teraz") use b/d so nothing sits under the text. `--k` scales the motif to the card. The ground under the content has a sparse pattern of a few pale leaves (`.content::before`).
- **Desktop "Jeden świat" (`css/pulpit.css`, `<div class="stage" data-swiat>`)**: no split screen. The sky and planet span the whole width (the plant stands at `PLANT_X` in `js/home2-scene.js`), and the content, the tab bar and the check-in lie on a frosted, semi-transparent pane (`--tafla`, leaf-shaped corner) whose left edge catches the plant's light. Phones and tablets are unchanged.

## Tests, consents and legal pages (12.11.2026, Marcel's task; a proposal to confirm with the team)

**Testy tab** (`js/testy.js`, data in `js/testy-dane.js`, look in `css/testy.css`). Only two tests are allowed (team decision, 9.11.2026): **WHO-5** (wellbeing, 5 statements about the last two weeks, official Polish wording) and **Big Five as IPIP-BFM-20** (20 statements, Polish adaptation by Topolewska et al., 2014). PHQ-9, GAD-7 and PSS-10 are gone.

- **The tab, top to bottom:** consent card (only without an active health-data consent; the tests below are dimmed) → the screen's one colour field: the latest wellbeing result with a small bar history, or an invitation to the first test (`.tr-sec.week-sum`, the same classes as the Tracker summary) → a warm support card when a result from the last 14 days was in the lowest band → the "Osobowość" card (five traits as a dot between two poles) → "Historia" (every attempt; a tap shows the result exactly as it looked that day) → "Twoje dane i zgody" and "Usuń historię testów".
- **Taking a test** is a screen like the check-in (`#test-flow.ci-overlay`, grows as a circle out of the button): intro → one statement per screen, a tap on an answer moves on (the last one waits for "Zobacz wynik") → result. Questions can't be skipped (the score needs all of them), but closing the test saves nothing. Progress is a stem with a leaf that moves with every answer. Answers are a `role="radiogroup"` with arrow keys. Statements use the grammatical form from registration (`m` / `f` / `n`).
- **Results are a hint, never a diagnosis.** WHO-5: raw 0–25 × 4 = 0–100. Below 50 → "Ostatnio jest Ci trudniej" + the Assistant and 116 111; **28 and below → support always** (Assistant, 116 111, trusted contacts and breathing), in the warm light. A change counts as real only from 10 points. Big Five: position 0–100 on each of five scales and a short description; **no stens** (IPIP-BFM-20 was validated on ages 16–83 and we have no youth norms), no "good / bad" end, theme colour only. Under 16 the result carries a note that the test was made for 16+.
- **Intervals** (WHO-5 every 7 days, Big Five every 30) are explained as "the questions cover a longer time", never as a penalty. "Wersja testowa: zrób teraz" unlocks a test in the prototype.
- **Deleting:** one result from its preview (toast with "Cofnij" for 6 s), the whole history from "Konto i prywatność" (confirmation, because it can't be undone).
- **One source of content:** `js/testy-dane.js` holds the questions, scales, result bands and `score()`. `node narzedzia/baza/generuj-dane-testow.js` writes `notes/supabase-testy-dane.sql` from it. Changing the wording means a new version id (`who5-v2`), never an edit, so history always shows what the person saw.
- **Licences to check before any business model:** WHO-5 is © WHO 2024, CC BY-NC-SA 3.0 IGO (non-commercial, with attribution); IPIP is public domain. The tab's footnote names both.
- **Prototype storage:** `localStorage` `sci.testy`, shaped like `test_sessions` + `test_answers` + `test_scores`. `?widok=statyczny` shows a demo history and saves nothing.

**Consents** (`js/zgody.js`, `window.Zgody`). A consent log in `localStorage` `sci.zgody`, shaped like the `user_consents` table: kinds `terms`, `privacy`, `health_data` (GDPR Art. 9, can be withdrawn) and `guardian` (under 16). Rows are never deleted; withdrawal sets `withdrawnAt`, a new document version sets `supersededAt` on the old row and keeps the data. Consents given in registration (`sci.account.consents`) move into the log on first run. `Zgody.DOCS` holds the document versions and the wording of the health-data consent; the same version numbers are in the legal pages and in `legal_documents`. Every change fires `consentchange` on `window`.

- **Withdrawing the health-data consent deletes at once** the test history (`js/testy.js`) and today's check-in entry (`js/home2.js`); in the database a trigger also deletes check-ins and insights. The plant, Skrytka, the jar and trusted contacts stay. After a withdrawal "Podlej roślinkę" shows the consent request instead of the questions. Someone who never withdrew it waters as before, so the 20.11 test with teenagers is unaffected.
- **Under 16** the consent is pending until the guardian confirms ("Wersja testowa: opiekun potwierdził" simulates it).

**Konto i prywatność** (`js/konto.js`, `window.Konto.open(view)`, any element with `[data-konto]`; entries: the end of Dom and the Testy tab). A bottom sheet with: the consents (version, date, "Wycofaj zgodę" / "Wyraź zgodę"), "Pobierz moje dane" (a JSON file with every `sci.*` key), "Usuń historię testów", "Usuń konto". Each confirmation says what disappears and what stays, has one checkbox and one clearly named action; deleting is a dark button, never red. After deleting the account the sheet says goodbye, shows 116 111 and leads to login. While the sheet is open, toasts move to the top so they don't cover its buttons.

**Legal pages:** `regulamin.html` and `polityka-prywatnosci.html` (`css/prawo.css`, `js/prawo.js`), linked from registration (new tab) and from "Konto i prywatność". Plain language, a "W skrócie" card, a table of data / purpose / legal basis, SOS in the corner. **Both are working drafts (version 0.1):** a lawyer has to check them, and the `<mark class="todo">` places (who the controller is, contact, providers, retention periods) have to be filled in before real accounts.

**Database** (`notes/supabase-schema.sql` → `notes/supabase-testy.sql` → `notes/supabase-testy-dane.sql`, run in this order). The earlier prototype schema was rewritten:

- Consents are a server-written log (`legal_documents`, `user_consents`, RPC `give_consent`, `withdraw_consent`); the phone can't write, change or delete a consent, and a guardian's consent is recorded only by the server. After an account is deleted the proof stays without a link to the account (a hash of the e-mail) for 3 years (to confirm with a lawyer).
- The server scores tests (`submit_test(p_code, p_answers)`), checks the consent and the interval, and stores answers, scores and the band the person saw. Clients can only read their own rows. `delete_test_results`, `delete_my_account` and withdrawing the consent delete for real and leave a content-free trace in `privacy_events`.
- Check-ins can be written only with an active health-data consent. The `anon` role has no access to anything; privileges are granted explicitly on top of RLS.
- `bash narzedzia/sprawdz-baze.sh` loads everything into a temporary local Postgres with a small Supabase stub and runs about 220 checks (RLS, consents, scoring equal to `TestyDane.score()` for random answers, deletion). **Not run on a real Supabase project yet**: check there the request-IP header, the `extensions` schema and the right to delete from `auth.users`.

## Proposal E: "Pokoje" (8.11.2026, preview `?uklad=e`, `css/pokoje.css`, `js/pokoje.js`)

Answers Tymek's feedback that everything in the app blends into one and it's hard to "collect your thoughts". It is layout D plus clear boundaries between tabs; D stays the default until the team compares them. Scope: `<html data-uklad="d" data-pokoje>` (set by the inline script in `aplikacja.html`; `js/dom-uklad.js` builds Dom exactly like D). Logic is only rearranged, never duplicated: `js/pokoje.js` moves existing elements and adds new entry points.

1. **The header stays.** Once the scene collapses into the band (`body.is-band`), the tab's name replaces the wordmark on every tab except Dom. Content disappears under a 1 px line with a short shadow (`.stage-fade`) instead of fading into the sky.
2. **Every tab is a room.** Outside Dom the stage is lower (`--stage-compact`), and the ground has the tab's own tint, computed in the scene (`ROOM` in `js/home2-scene.js`; it writes `--ground`, so canvas and CSS stay in sync and the tint changes smoothly with the tab). Skrytka mixes in the warm light (`--plant-core`), Tracker is lighter and neutral (`--sheet`), Blog has a touch of `--primary`.
3. **Writing in Skrytka is its own screen.** Skrytka shows "Napisz myśl" (the screen's one filled button) and the list. The button opens `#vault-form` full screen (`body.pk-writing`): close button, title, SOS, the text field, "Puść z wiatrem" and "Schowaj". The draft survives closing; save and release return to the list. The phone's back button, Escape and the close button all close it (a history entry is pushed while writing). "Zapisz myśl" on Dom opens it directly (`Skrytka.focus`). The crisis support box moves inside the writing screen.
4. **Three heading levels on every tab:** page title (big, Bricolage) · chapter (`.pk-h2`, `.sub-title`, `.sheet .kicker`: 1.5rem Bricolage) · card (`.pk-h3`, `.insight h3`: 1.08rem Figtree 600). Chapters are separated by `--pk-gap-chapter` (48 px), cards inside a chapter by `--pk-gap-in` (12 px). Tracker has three chapters: "Ten tydzień" (summary), "Co zauważyliśmy" (insights + "Co Ci pomaga" as a card), "Zielnik" (one row; "Pokaż cały zielnik" shows the rest).
5. **Dom below the first screen has three blocks:** "Dla Ciebie teraz", "Twój tydzień" (one card with a "Więcej w Trackerze" link) and "Myśl na dziś", with no dividing lines. The plant's name, colour, full screen and "Jak działa roślinka?" moved into one sheet, "Twoja roślinka" (`#plant-sheet`), opened from a single row at the end of Dom.

Still open: Dom's weekly score is random demo data and doesn't match Tracker's fixed demo data, so the "Więcej w Trackerze" link makes the mismatch visible (proposal 6, not built yet). Not tested on a real phone.

## Visual direction: "Mała planeta" (redesign around the plant, branch `redesign/mala-planeta`)

- **The world is a tiny planet.** The plant stands on a small round planet (`js/home2-scene.js`), and every tab is a place on it: Dom = the plant, Skrytka = a jar with fireflies, Tracker = 7 standing stones (the week; height = mood, a day without an entry is a small pebble), Testy = a signpost, Blog = other people's sprouts. The tab-bar icons are the same places. Switching tabs (`tabchange`) **rotates the planet** the shortest way until the place is on top, while **fog** drifts across the stage; the content comes out of the fog (`fog-in` in `css/planeta.css`). Tapping a place on the planet switches tabs.
- **The planet is on every tab.** On phones the stage is on every tab; outside Dom it's lower (`--stage-compact`). SOS lives in the top bar on every tab.
- **The sky follows the time of day**: morning, day, evening, night (night mode is always night). The scene writes `<html data-pora="rano|dzien|wieczor|noc">` (and `.noc-jasny` for light mode at real night); at night the greeting turns light and **SOS glows like a lantern** (`--plant-core`). Preview with `?pora=rano|dzien|wieczor|noc`.
- **Typography with a lot of air** (Eco Center): headings and big numbers in the serif (Literata 500), body in Plus Jakarta Sans, one colour. The look lives in `css/planeta.css`, loaded last; the old CSS files still hold the mechanics (positions, overlays, desktop Assistant window).

The rules below still apply on top of this direction:

1. **Colourful background lights**: the sky is the main colour field; the drifting page lights (`body::before`) stay only on Dom, other tabs have a calm, solid `var(--bg)` under the content.
2. **Serif for personal content**: thoughts in Skrytka (list and writing field), "Myśl na dziś", saved thoughts, good moments in the jar, the check-in note and Skrytka quotes in the chat use `var(--font-serif)` (Literata, Google Fonts). Everything else stays in Plus Jakarta Sans.
3. **Fewer white cards**: lists in Tracker and Blog are separated by spacing and a 1 px `--line`. Only things you can tap or expand get a card (`.card`: surface + 1 px line, **no shadow**); an expanded blog post turns into a card. Shadows (`--shadow-float`) only for things that float: tab bar, sheets, toast, floating buttons, the desktop Assistant window.
4. **Colour has to mean something**: one filled `--primary` button per screen, the most important action ("Podlej roślinkę", "Schowaj", "Napisz", "Dalej"). Other actions use `.btn-soft` / `.icon-btn.is-soft` / outlines; the Assistant button is a light bubble with a coloured outline. Section labels (`.kicker`) are grey. Category colours (`--cat-sleep`, `--cat-friends`, …) are used **only in Tracker**, as bars and dots next to `--text` text, never as a background under text. Mood has no category colour, it's always the theme colour.
5. **Readable text**: `--primary` in every theme is dark enough for white text (≥ 4.5:1), `--text-muted` / `--text-soft` pass 4.5:1 on `--bg-2`. Check with `narzedzia/sprawdz-kontrast.js`.
6. **Mascot in moderation**: it's the face of the Assistant (button, avatar, replies, hello jump) and appears on empty screens (`.empty-mascot`: peeking over a line). Nowhere else — the top bar shows only the wordmark.
7. **One spacing scale and three speeds** (`css/tokens.css`): margins, paddings and gaps use only `--sp-1 … --sp-16` (4 px steps, same names as Tailwind/NativeWind: `--sp-4` = `p-4` = 16 px; 1–3 px optical tweaks and negative offsets stay as numbers). Transitions and entrance animations use only `--dur-fast` (.2 s, touch feedback), `--dur-base` (.4 s, state changes) and `--dur-slow` (.7 s, screen entrances and big transitions). Background loops (sway, breathing, lights) keep their own long durations. JS timers that wait for a CSS transition must match these values.

## Running it

- There's no build step. Each page also works opened straight from disk (`file://`), so use classic `<script defer>` files and never ES modules.
- For a local server, serve the `Main_Front-End/` folder with any static server, e.g. `npx serve Main_Front-End` or `python3 -m http.server -d Main_Front-End`, and open `index.html`, which lists all screens.
- After layout changes run `node narzedzia/sprawdz-nakladanie.js` (Playwright): it checks 6 widths × light/dark × Dom/Skrytka/Tracker/Blog × assistant closed/open (also mid-opening) for overlapping elements, elements under the assistant panel, a plant canvas wider than its stage, horizontal scroll and clipped tab labels.
- After changes to the sky or the stage run `node narzedzia/sprawdz-niebo.js`: it reads the canvas pixels under the greeting for 4 times of day × 6 themes × light/dark × phone/desktop (the normal contrast test can't see the canvas).
- After colour or text changes run `node narzedzia/sprawdz-kontrast.js` (Playwright, ~2 min): it checks the contrast of every visible text in all 6 themes × light/dark (tabs, expanded blog post, jar, SOS, colour sheet, Assistant, check-in incl. low mood). Target: 4.5:1, large text 3:1.
- After changes to the database files in `notes/` or to `js/testy-dane.js` run `bash narzedzia/sprawdz-baze.sh` (needs a local PostgreSQL 15+ and Node; it starts a temporary server and removes it afterwards).
- **Test in a phone viewport first**, e.g. 375×812, then tablet (~820) and desktop (≥1024).
- URL helpers:
  - `?motyw=<id>` previews a theme without saving it (`morski`, `zielony`, `niebieski`, `lawenda`, `rozowy`, `morelowy`).
  - `?widok=statyczny` renders a page without animation and with demo data (for screenshots and team previews).
  - `?pora=rano|dzien|wieczor|noc` previews the sky at a given time of day.
  - `?uklad=e` previews proposal E "Pokoje" (D with clearly separated tabs, see above). `UKLAD=e` works with the test tools too.
  - `?uklad=a|b|c` previews the earlier home-page layouts (A "Dziś jednym dotknięciem", B "Strona dnia", C "Wszystko pod kciukiem"), `?uklad=stary` the old home page with the "Podlej roślinkę" button. With `?uklad=a|b|c` a switcher appears at the top of Dom; `porownanie.html` shows D, A, B and C side by side. Layout D "Żywa planeta" is the default. `UKLAD=a|b|c` also works with `sprawdz-nakladanie.js` and `sprawdz-kontrast.js`.
- Canvas scenes only animate while the tab is visible. When the browser tab is in the background (e.g. during automated testing), call `HomeScene.debugAdvance(sec)` / `Home2Scene.debugAdvance(sec)` in the console to step the scene forward manually.

## Structure (`Main_Front-End/`)

| Screen | Files |
|---|---|
| Screen index | `index.html` |
| Login | `logowanie.html`, `js/logowanie.js` |
| Registration (3 stages, one question per screen on phones) | `rejestracja.html`, `js/rejestracja.js` |
| Shared by login and registration | `css/auth.css`, `js/auth-common.js` (toast, haptics, password field, `account` storage), `js/plant-scene.js` (growing plant canvas, `window.PlantScene`) |
| **The app: all tabs on one page (main entry)** | `aplikacja.html`, `css/app.css`, `css/planeta.css` (look of the "Mała planeta" direction), `js/app.js` (tabs/router) — see "The app" below |
| Home page, version 1: branch in the background | `strona-glowna.html`, `css/home.css`, `js/home.js`, `js/home-scene.js` |
| **Home page, version 2: plant on top (current direction)** | `strona-glowna-2.html`, `css/home2.css`, `js/home2.js`, `js/home2-scene.js` |
| **Home page in the app: layout D "Żywa planeta" (default)** | `js/dom-uklad.js` (`buildD`), `css/zywa.css` (look of the whole app on phones) |
| Earlier layouts A, B, C (previews) | `js/dom-uklad.js`, `css/dom-uklad.css`; comparison: `porownanie.html` |
| Check-in, first question only (the design `aplikacja.html` reuses) | `nastroj.html`, `css/checkin.css`, `js/nastroj.js`, `css/mood-slider.css`, `js/mood-slider.js` |
| Tests WHO-5 and Big Five (tab, test screen, result, history) | `js/testy.js`, `js/testy-dane.js` (content and scoring), `css/testy.css` |
| Consents and "Konto i prywatność" | `js/zgody.js` (`window.Zgody`), `js/konto.js` (`window.Konto`), `css/testy.css` |
| Legal pages (working drafts) | `regulamin.html`, `polityka-prywatnosci.html`, `css/prawo.css`, `js/prawo.js` |
| Database schema and its tests | `notes/supabase-schema.sql`, `notes/supabase-testy.sql`, `notes/supabase-testy-dane.sql` (generated), `narzedzia/sprawdz-baze.sh`, `narzedzia/baza/` |
| Bottom sheets (shared) | `js/sheets.js` (`window.Sheets`) |
| Themes and tokens | `css/tokens.css`, `js/theme.js` |

### The app (`aplikacja.html`)

- One page with five tabs from the plan: **Dom · Skrytka · Tracker · Testy · Blog**. The tab lives in the hash (`#/skrytka`), so it works from `file://` and the back button switches tabs. `js/app.js` handles the tabs, remembers each tab's scroll position, and wires `[data-sos]`, `[data-breath]` and `[data-go]`.
- The app should feel **calm**: little text per screen, soft cards, slow fade-in animations (`soft-in`, staggered by `--i`). Prefer hiding details behind a tap (expand) over showing everything.
- Phone: tab bar at the bottom; the planet stage shows on every tab (lower outside Dom). The content card scrolls **over** the stage (the stage sits underneath and drifts up slightly); the top bar with logo, colour and SOS (`.app-top`, outside the stage) stays on top and gets a background once the card reaches it. The stage has `data-blisko`, so on phones the plant is bigger and sits a bit to the right of the greeting. The plant can grow to **full screen** (`Home2Scene.full(t)`, logic in `js/app.js`): the zoom button at the stage's bottom-right corner (`#plant-zoom`, always works), pulling down at the very top, or the iOS rubber band (`scrollY < 0`). Some hosts (e.g. the Codex app showing the artifact) swallow the pull gesture, hence the button. The card slides down to a peek; a swipe up, a tap on the card or the button brings it back. Tablet: floating tab bar. Desktop: the plant stays in the left half on every tab, content and floating tab bar on the right.
- **Dom** is home v2 (`js/home2.js`) with **layout D** on top (`js/dom-uklad.js`, details in "Żywa planeta" above): "Podlej roślinkę", then a number in the same spot, then rain. The full check-in (`js/checkin.js`, `window.Checkin`) is still there for the optional questions: the screen grows as a circle out of the "+" chip and starts at that question (`Checkin.open({ step })`). Its questions: mood (the `nastroj.html` design, mood slider + support at mood ≤ 3), sleep, "what mattered today" (food, family, friends, love, nature, study: −1/0/1) and a note. Every question can be skipped. After the last one the circle shrinks into the plant and it rains (`Home2Scene.water(mood)` sizes today's leaf from the mood).
- **Skrytka** has two panes (`#skrytka-seg`): thoughts and the **Słoik dobrych chwil** (`js/sloik.js`, `localStorage` `sci.sloik`): small good moments shown as fireflies in a jar; a tap draws one at random, and after a check-in with mood 1–3 the home page shows one (`watered` event from `js/home2.js`).
- **Asystent Wsparcia** (`js/asystent.js`, `css/asystent.css`, `window.Asystent`): chat screen that grows as a circle from where it was opened (on desktop a separate floating window on the right with its own solid background, not the page lights). Entry points: the sprout button (`#as-fab`, every tab, bottom-right; on desktop the content keeps a right gutter `--gutter` for it and the round „Napisz” button on Blog sits under it), the "Porozmawiaj z Asystentem" shortcut on Dom (`[data-asystent]`), the low-mood support button in the check-in, and Skrytka. Replies are demo text; user messages go through `js/moderacja.js` and `kryzys` shows 116 111 / 112 / breathing. `asystent-makieta.html` is the earlier standalone mockup.
- **Skrytka thoughts** (`js/skrytka.js`): one text field and two buttons. "Schowaj" saves (prototype: `localStorage` `sci.skrytka`, unencrypted), "Puść z wiatrem" lets a thought fly away as a leaf and saves nothing. Saved thoughts sit in a two-column grid (three on tablet), collapsed; a tap expands one to full width with "Zapytaj Asystenta" and "Usuń". "Zapytaj Asystenta" asks for consent first, then the card folds into a leaf that flies to the sprout button and the chat grows out of it (AI only on explicit request). On first open Skrytka is seeded with a few demo thoughts (prototype only).
- **Blog** (`js/blog.js`): a calm list (title + 2 lines), Popularne/Nowe and a floating "Napisz" button. A tap expands a post (full text, comments, report). Anonymous plant pseudonyms, votes. Every post and comment goes through **`js/moderacja.js`**, a word-list DEMO with the API the real AI moderation will have: `kryzys` (self-harm → not published, 116 111 / 112 / breathing / "schowaj w Skrytce"), `obrazliwe` (insults, threats → highlighted, "popraw"), `dane` (phone, e-mail, @nick), `ok`. Crisis words in the check-in note and in Skrytka don't block anything but show 116 111 right away.
- **Tracker** (`js/tracker.js`), insight-first (fixed demo data, 8 weeks). No cards: sections and rows are split by a thin line; the only place with category colours (dot + highlighted bar per insight / per "Co Ci pomaga" row):
  - "Twój tydzień w skrócie": 7 small bars and 3 sentences (average vs last week, best day and what helped, one thing to try);
  - "Co zauważyliśmy": personalised insights, each showing only a title, a small chart and one short sentence; the possible causes computed from the data and the suggestion are folded under "Skąd to może się brać?" (keep the screen calm) ("Może to wynikać z tego, że…": shorter sleep the night before, study stress, fewer outings…) and one suggestion. Example: "Niedzielne wieczory bywają trudniejsze". Wording is a hint, never a diagnosis;
  - "Co Ci pomaga": the 3 check-in answers with the highest mood above average;
  - "Zielnik": one pressed flower per week with at least 3 waterings; weeks without one simply don't appear. **Testy** (`js/testy.js`): WHO-5 and Big Five, see "Tests, consents and legal pages" above.
- **Oddychaj z roślinką** (`js/oddech.js`, `window.Oddech`): one minute of breathing (4 s in, 2 s hold, 6 s out) with a flower that opens and closes, plus optional nature sounds generated with Web Audio (rain, waves that follow the breath, forest). Reachable from SOS, from a shortcut on Dom and from the blog's crisis screen.
- **SOS** also has **Twoje bliskie osoby** (`js/kontakty.js`, `localStorage` `sci.kontakty`): 1–3 trusted contacts, one tap to call, number also shown as text.
- **Myśl na dziś** (`js/cytaty.js`): a different own-written thought every day, heart to save (`sci.cytaty`), share (system share or copy), and a sheet with saved thoughts.
- **Tryb nocny**: `Theme.setMode('auto'|'light'|'dark')` in `js/theme.js` sets `<html data-mode>` (saved in `sci.mode`); `css/tokens.css` redefines only the neutral tokens for dark (also follows the system setting in auto). The switch is in the "Kolor roślinki" sheet. The plant scene shows a night sky with stars and the moon in dark mode. Use `--glass`, `--toast-bg` / `--toast-fg` instead of hard-coded white or dark colours.

### Logo and mascot (`Main_Front-End/img/`)

- The app is called **ReLeaf**. `releaf-logo.webp` is the full logo (mascot + wordmark), `releaf-wordmark.webp` is the wordmark alone, and each has a `-dark` variant with the dark lettering lightened for night mode.
- The mascot, a round sprout with a leaf, is the face of the Assistant: `listek.webp` (peeking over an edge, like in the logo) and `listek-hop.webp` (jumping).
  - It peeks over the chat bubble in the Assistant button (a light bubble with a coloured outline, not a filled button).
  - It sits in the avatar and next to each reply, and sways while "typing".
  - It jumps above the first message when the chat is opened from Dom.
- The top bar shows `.brand.is-word` (wordmark only, no mascot; CSS in `css/home2.css` swaps the wordmark for night mode). Favicon: `favicon-64.png`; home-screen icon: `ikona-180.png`.
- Empty screens (Testy, empty Skrytka list) show the mascot peeking over a line (`.empty-mascot` in `css/app.css`).
- The images were cut out of the originals the team sent (background removed). Replace them with clean exports from the designer when available.

### Colours and themes

- Tokens live in `css/tokens.css`. **Never hard-code theme colours**; use `var(--primary)`, `rgba(var(--primary-rgb), .1)`, `var(--plant-leaf-1)` and so on.
- The user picks a plant colour at the end of registration, and the whole palette follows it. There are six calm, muted themes and **no reds or neons**:
  - `morski` (default, the "Clean Teal" palette)
  - `zielony`
  - `niebieski`
  - `lawenda`
  - `rozowy`
  - `morelowy`
- The colour can be changed again on the home page: round button next to SOS on desktop, "Kolor roślinki" at the end of Dom on phones (layout D).
- `js/theme.js` is loaded **without `defer`** in `<head>`, right after the stylesheets, so the theme is set before first paint. It sets `<html data-theme>`, saves the choice in `localStorage` (`sci.theme`), and fires a `themechange` event on `window`.
- Canvas scenes read the `--plant-*` tokens (always written as `#RRGGBB`) and recolour smoothly on `themechange`.
- Background lights: `body::before` (drifting, `css/home2.css`) and the shared `--glow` token in `tokens.css` (strength `--aura`, weaker in dark). Any full-screen layer with its own background (assistant on phone, check-in) uses `var(--glow)` too, and bars over it (headers, tab bar, sticky footers) are transparent or semi-transparent (`color-mix(in srgb, var(--sheet) 86%, transparent)`) so they never cut the light with a hard edge.
- `[data-palette="<id>"]` gives any element the tokens of a given theme. The colour swatches use this.
- To add a theme, add one block to `tokens.css` and one entry to the `LIST` in `theme.js`.

### Canvas scenes (the plant)

- All three scenes (`plant-scene.js`, `home-scene.js`, `home2-scene.js`) follow the same pattern. Each is an IIFE that exposes a small API on `window`. Everything is drawn procedurally on a 2D canvas with DPR capped at 2. Growth uses critically damped springs, colours come from theme tokens, and `prefers-reduced-motion` or `?widok` turns the animation off.
- Geometry uses "plant units", where the full height is about 100 units and y points up (negative). The scene scales these to pixels (`S`) to fit its area.
- In React Native these would be rebuilt with `react-native-skia` (or SVG + Reanimated), measuring layout with `onLayout`.

### Home page: layout A "Dziś jednym dotknięciem" (4.11.2026, now a preview; D reuses its rules)

Picked by the team from three layouts built with `/redesign-ui` (sources and the other two in `.redesign-history.md`). Inspiration: Daylio (one-tap mood entry, details optional), Gentler Streak (rest days, a suggestion that follows how you feel) and Things 3 (add things from where you are). The main task, **watering the plant (the daily mood check-in), went from 6 steps to 1**.

**What's on the Dom card, top to bottom** (phone; on desktop the same order in the right column):
1. **"Dziś · <weekday>" → "Jak się dziś czujesz?"**: 10 mood buttons (1–10) in a 5 × 2 grid, numbers in the serif. The background gets a slightly stronger shade of `--primary` the higher the number (colour = mood, no category colour). Below: a one-line hint, after the tap "Podlane · 7/10 · dobrze. Możesz zmienić, stukając inną liczbę."
2. **Support at mood 1–3** (same rule as the check-in, `Checkin.DATA.LOW`): straight under the buttons, "Porozmawiaj z Asystentem" (`data-asystent="dom"`) and "Zadzwoń: 116 111". Never hidden behind a tap.
3. **"Chcesz dodać więcej? Nie musisz."**: three optional chips, "+ Sen", "+ Co było ważne", "+ Notatka". Each opens the full check-in **at that question** with today's entry filled in. An answered part turns into a ✓ chip.
4. **"Dla Ciebie teraz"**: **one** suggestion chosen from the mood (`suggestion()` in `js/dom-uklad.js`): nothing yet → "Minuta oddechu"; 1–3 → "Porozmawiaj z Asystentem"; 4–6 → "Minuta oddechu z roślinką"; 7–10 → "Wrzuć dobrą chwilę do słoika" (opens Skrytka on the jar pane with the cursor in the field). Under it, the quick shortcuts in one row: Zapisz myśl · Oddech · Asystent (they used to be at the very bottom of Dom).
5. Then, unchanged: "Twój tydzień" (score, days, "Jak to działa?"), "Myśl na dziś", the plant's name. The old "Podlej roślinkę" block (`#sec-water`) and the old "Na skróty" block are hidden in A.

**States**: no entry yet (hint + breathing suggestion) · watered (selected number filled, "Podlane …", "+" chips, mood-based suggestion) · low mood (support box) · details added (✓ chips) · **a day without an entry is "odpoczynek"**: tapping it says "odpoczynek — też się liczy, roślinka nic nie traci", and its `aria-label` says "odpoczynek" (never "missed" or "brak").

**Data flow** (keep it when porting to React Native):
- `window.Podlewanie` in `js/home2.js` is the single place that owns today's entry: `entry`, `save(patch, { rain })` (merges answers; a new mood triggers the rain and the leaf, `rain: false` for silent updates), `open({ from, step })` (full check-in), `week` (`days`, `names`, `labels`, `missed`) and `MOOD_WORDS`. Every change fires `entrychange` on `window`, and the layout repaints from it. The entry keeps the `daily_checkins` shape (`mood`, `sleepHours`, `sleepQuality`, `areas`, `note`, `toVault`).
- `Checkin.open({ from, entry, step, onDone })` takes `step: 'mood' | 'sleep' | 'areas' | 'note'`; `Checkin.DATA` exposes the answer scales, so the page and the check-in never drift apart.
- The `watered` event still fires, so the jar reminder after a low-mood day keeps working.

**Accessibility**: the mood buttons are a `role="radiogroup"` with `role="radio"` / `aria-checked`, a roving `tabindex` and arrow keys (←/→ by one, ↑/↓ by a row). The result line is `aria-live="polite"`. Every control is at least **44 × 44 px** (`--tap` in `css/dom-uklad.css`). Focus rings use `--ring`. `prefers-reduced-motion` / `?widok` turns off the pop animation.

**Building the other tabs on layout A** (the agreed direction for the rest of the UI):
- **The main task of a screen takes one tap where possible**, right where the user already is (no extra screen in between). Details are optional, behind small "+" chips, and open exactly at the question they belong to.
- **One suggestion, not a menu**: show the single most useful next step for the current state, and keep the other actions as a small row of chips under it.
- **Prefer undo over "are you sure?"** for reversible actions (e.g. deleting a thought → toast with "Cofnij"). Keep a real confirmation only where nothing can be undone (deleting the account).
- **Missed time is rest, never a gap**: wording like "odpoczynek", "roślinka poczeka", no counters of missed days.
- **Safety stays inline**: wherever a mood or a crisis word can appear, the support (Asystent + 116 111) shows up in place, without an extra tap.
- 44 px targets, `role` + arrow keys for custom choice groups, `aria-live` for results, tokens only (`--sp-*`, `--dur-*`, colours).

**Tests**: `sprawdz-nakladanie.js` and `sprawdz-kontrast.js` run on layout D by default; `UKLAD=a` runs them on layout A.

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
- In `aplikacja.html` the check-in answers, blog posts and votes live only in page memory; Skrytka, test results (`sci.testy`) and the consent log (`sci.zgody`) use `localStorage`. On `strona-glowna-2.html` the "Podlej roślinkę" button only plays the animation.
- Blog moderation is a word list (`js/moderacja.js`) until the AI moderation exists (planned as a server-side function).
