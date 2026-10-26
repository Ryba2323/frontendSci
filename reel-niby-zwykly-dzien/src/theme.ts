/*
 * Kolory i kroje — wzięte z aplikacji (Main_Front-End/css/tokens.css, motyw „Morski”)
 * i z oficjalnego logo ReLeaf (turkus #35889C, brzoskwinia #F6B69A).
 * Tylko „krem” i „papier” są dodane dla filmu: ciepłe tło stołu i kartek.
 */
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

export const C = {
  // z tokens.css
  text: '#1E2A32',
  textMuted: '#5E6F78',
  textSoft: '#8A9BA4',
  surface: '#FFFFFF',
  primary: '#3A8D9E',
  primaryDark: '#2F7F8F',
  primaryRgb: '58, 141, 158',
  peach: '#F6B89E',
  peachTip: '#FBD6C6', // --plant-flower-tip
  apricot: '#F6B86A', // --energy
  mist: '#B7DCE5',
  mint: '#B8E3D3',
  sageMist: '#CFE5D3', // motyw „Zielony” --mist
  sage: '#9CCFA8', // motyw „Zielony” --accent-light
  line: '#D6E7EB',
  track: '#DCE9EC',
  bg: '#F4FAFB',
  bg2: '#E9F4F6',
  // tylko film: ciepły krem i papier
  cream: '#F4EEE3',
  creamDeep: '#EDE5D6',
  paper: '#FCFAF5',
} as const;

export const SANS = 'Plus Jakarta Sans';
export const SERIF = 'Instrument Serif';

// Plus Jakarta Sans (krój aplikacji) — zmienna grubość 200–800; latin + latin-ext (polskie znaki)
const latin = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const latinExt = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF';

export const fontsReady = Promise.all([
  loadFont({family: SANS, url: staticFile('fonts/PlusJakartaSans-latin.woff2'), weight: '200 800', unicodeRange: latin}),
  loadFont({family: SANS, url: staticFile('fonts/PlusJakartaSans-latin-ext.woff2'), weight: '200 800', unicodeRange: latinExt}),
  // Instrument Serif Italic — jedyny akcent redakcyjny: słowo „coś” i stopka strony
  loadFont({family: SERIF, url: staticFile('fonts/InstrumentSerif-Italic-latin.woff2'), style: 'italic', weight: '400', unicodeRange: latin}),
  loadFont({family: SERIF, url: staticFile('fonts/InstrumentSerif-Italic-latin-ext.woff2'), style: 'italic', weight: '400', unicodeRange: latinExt}),
]);
