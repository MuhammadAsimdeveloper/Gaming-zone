import { build } from 'vite';

// Fake but well-formed publisher identifiers used only by the configured-consent
// browser matrix. The Playwright suite intercepts both provider hosts, so no
// request ever reaches Google.
Object.assign(process.env, {
  VITE_GA_MEASUREMENT_ID: 'G-TEST00000',
  VITE_ADS_ENABLED: 'true',
  VITE_ADSENSE_CLIENT: 'ca-pub-0000000000000000',
  VITE_ADSENSE_SLOT_HOME: '1111111111',
  VITE_ADSENSE_SLOT_HOME_BOTTOM: '2222222222',
  VITE_ADSENSE_SLOT_CATEGORY: '3333333333',
  VITE_ADSENSE_SLOT_GAME: '4444444444',
  VITE_ADSENSE_SLOT_GAME_SIDEBAR: '5555555555',
  VITE_ADSENSE_SLOT_LISTING: '6666666666',
});

await build({ build: { outDir: 'dist-consent', emptyOutDir: true } });
