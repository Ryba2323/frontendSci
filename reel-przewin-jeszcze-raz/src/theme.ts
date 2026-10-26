/*
 * Kolory i kroje filmu.
 * Marka: turkus i brzoskwinia z oficjalnego logo ReLeaf (#35899C, #F7B79B) oraz tokeny aplikacji
 * (Main_Front-End/css/tokens.css: --primary #3A8D9E, --peach #F6B89E, --mint, --mist, szałwia z motywu „Zielony”).
 * Neutralne kolory świata (krem ściany, drewno stołu, herbata) są dobrane do tej palety.
 */
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

export const C = {
  // z aplikacji / logo
  ink: '#1E2A32',
  inkMuted: '#5E6F78',
  inkSoft: '#8A9BA4',
  teal: '#3A8D9E',
  tealDark: '#2F7F8F',
  tealDeep: '#2A6E7B',
  logoTeal: '#35899C',
  logoPeach: '#F7B79B',
  mist: '#B7DCE5',
  mint: '#B8E3D3',
  sage: '#9CCFA8',
  sageMist: '#CFE5D3',
  peach: '#F6B89E',
  peachDeep: '#F3A487',
  peachTip: '#FBD6C6',
  apricot: '#F6B86A',
  line: '#D6E7EB',
  track: '#DCE9EC',
  bg: '#F4FAFB',
  bg2: '#E9F4F6',
  surface: '#FFFFFF',
  // świat
  cream: '#F4ECDF',
  ivory: '#FBF7F0',
  wall: '#EEE3D1',
  wallShade: '#E0D1BA',
  sageFrame: '#9DBBA5',
  sageFrameDark: '#7FA28B',
  wood: '#D8B791',
  woodLight: '#E6CBA6',
  woodDark: '#C09A72',
  woodEdge: '#A88059',
  tea: '#B06E33',
  teaLight: '#CF9453',
  clay: '#EBDCC6',
  sunlight: '#FFF3DA',
  shadow: '#5B4A3A',
} as const;

export const SANS = 'Plus Jakarta Sans';

const latin = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const latinExt = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF';

// Plus Jakarta Sans — krój aplikacji (zmienna grubość), latin + latin-ext dla polskich znaków
export const fontsReady = Promise.all([
  loadFont({family: SANS, url: staticFile('fonts/PlusJakartaSans-latin.woff2'), weight: '200 800', unicodeRange: latin}),
  loadFont({family: SANS, url: staticFile('fonts/PlusJakartaSans-latin-ext.woff2'), weight: '200 800', unicodeRange: latinExt}),
]);
