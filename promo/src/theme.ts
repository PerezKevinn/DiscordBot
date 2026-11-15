import { loadFont as loadCinzel } from '@remotion/google-fonts/Cinzel';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

const cinzel = loadCinzel('normal', { weights: ['600', '700', '800'], subsets: ['latin', 'latin-ext'] });
const inter = loadInter('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin', 'latin-ext'] });

export const FONT_DISPLAY = `${cinzel.fontFamily}, Georgia, serif`;
export const FONT_BODY = `${inter.fontFamily}, 'Segoe UI', system-ui, sans-serif`;
export const FONT_EMOJI = `'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji'`;

/** Identidad «oro y azul pizarra» (tema oscuro de la web) */
export const C = {
  bg: '#0b0e14',
  surface: '#131822',
  border: '#212836',
  text: '#eef1f6',
  muted: '#a9b3c4',
  gold: '#e3c060',
  goldDeep: '#d4af37',
  slate: '#8ab4f8',
  slateDeep: '#2c5aa0',
  // Discord (oscuro)
  dChat: '#313338',
  dEmbed: '#2b2d31',
  dInput: '#383a40',
  dSelect: '#1e1f22',
  dMention: 'rgba(88, 101, 242, 0.3)',
  dMentionText: '#c9cdfb',
  dGreen: '#248046',
  dRed: '#da373c',
  dGrey: '#4e5058',
  dBlurple: '#5865f2',
};

export const FPS = 30;

/** Tiempos de cada escena (en fotogramas a 30 fps). Total 25 s. */
export const T = {
  hook: { from: 0, dur: 90 },
  wizard: { from: 90, dur: 120 },
  pingRoster: { from: 210, dur: 240 },
  mando: { from: 450, dur: 130 },
  outro: { from: 580, dur: 170 },
};
export const TOTAL = 750;
