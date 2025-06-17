import { rgb } from 'pdf-lib';

const fetchFont = async (base64DataUri: string): Promise<Uint8Array> => {
  const response = await fetch(base64DataUri);
  return new Uint8Array(await response.arrayBuffer());
};

export const loadFonts = async () => {
  return {
    fontBytesMap: {
      'Dancing Script': await fetchFont(process.env.FONT_DANCING_SCRIPT_URI!),
      'Great Vibes': await fetchFont(process.env.FONT_GREAT_VIBES_URI!),
      Cookie: await fetchFont(process.env.FONT_COOKIE_URI!),
      'Monte Carlo': await fetchFont(process.env.FONT_MONTE_CARLO_URI!),
      Lato: await fetchFont(process.env.FONT_LATO_URI!),
      'Noto Sans': await fetchFont(process.env.FONT_NOTO_SANS_URI!),
      Caveat: await fetchFont(process.env.FONT_CAVEAT_URI!),
    },
    colorMap: {
      black: rgb(0, 0, 0),
      red: rgb(1, 0, 0),
      blue: rgb(0.2, 0.4, 0.8),
      green: rgb(0, 0.6, 0.3),
    },
  };
};

export const SUPPORTED_FONT_NAMES = [
  'Dancing Script',
  'Great Vibes',
  'Cookie',
  'Monte Carlo',
  'Lato',
  'Noto Sans',
  'Caveat',
] as const;

export type FontName = (typeof SUPPORTED_FONT_NAMES)[number];
export const SUPPORTED_COLOR_NAMES = ['black', 'red', 'blue', 'green'] as const;
export type ColorName = (typeof SUPPORTED_COLOR_NAMES)[number];
