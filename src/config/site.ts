function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function parseOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean);
}

export const SITE_NAME = 'NeonRift';
export const SITE_TAGLINE = 'Free browser games. Instant play.';
export const SITE_DESCRIPTION =
  'Play free original browser games instantly. Arcade, puzzle, strategy and more — no downloads, no account, no waiting.';

export const SITE_URL = trimTrailingSlash(
  import.meta.env.VITE_SITE_URL?.trim() || 'https://neonrift.pages.dev',
);

export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? '';

export const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? '';

export const EXTERNAL_GAME_ORIGINS = parseOrigins(import.meta.env.VITE_EXTERNAL_GAME_ORIGINS);

export const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT?.trim() ?? '';
export const ADS_ENABLED = import.meta.env.VITE_ADS_ENABLED === 'true';

export const AD_SLOT_IDS = {
  'home-top': import.meta.env.VITE_ADSENSE_SLOT_HOME?.trim() ?? '',
  'home-bottom': import.meta.env.VITE_ADSENSE_SLOT_HOME_BOTTOM?.trim() ?? '',
  'category-top': import.meta.env.VITE_ADSENSE_SLOT_CATEGORY?.trim() ?? '',
  'game-below': import.meta.env.VITE_ADSENSE_SLOT_GAME?.trim() ?? '',
  'game-sidebar': import.meta.env.VITE_ADSENSE_SLOT_GAME_SIDEBAR?.trim() ?? '',
  'listing-top': import.meta.env.VITE_ADSENSE_SLOT_LISTING?.trim() ?? '',
} as const;

export type AdPlacement = keyof typeof AD_SLOT_IDS;

export const AD_PLACEMENTS: AdPlacement[] = [
  'home-top',
  'home-bottom',
  'listing-top',
  'category-top',
  'game-below',
  'game-sidebar',
];
